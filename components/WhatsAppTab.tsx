import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  MessageCircle,
  QrCode,
  RefreshCw,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Smartphone,
  Unplug,
  Inbox,
  Sparkles,
  FileText,
  Mic,
  UserPlus,
  User,
  Users,
  CreditCard,
  MapPin,
  Clock,
  ListChecks,
  FilePlus2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Bot,
  ShieldCheck,
  RotateCcw,
  X,
} from 'lucide-react';
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/auth';
import {
  fetchPersonasFromFirestore,
  normalizePersona,
  syncPersonaToFirestore,
} from '../services/firestore';
import { buscarPersonaDuplicada } from '../services/personaDedup';
import { formatearRUCConDV } from '../services/dnitService';
import {
  buildWhatsAppDocumentMessage,
  generateDocumentPdfBase64,
  type EscribaniaPdfMetadata,
} from '../services/pdfExport';
import type { Persona, TipoDocumento, TipoPersona } from '../types';

export interface WhatsAppTabProps {
  workspaceId: string;
  esPlanFull?: boolean;
  esAbogado?: boolean;
  escribania?: EscribaniaPdfMetadata;
  onOpenEscritos?: () => void;
}

type WhatsAppConnectionStatus = 'disconnected' | 'connecting' | 'qr_ready' | 'connected';

interface WhatsAppStatusPayload {
  status?: string;
  qr?: string | null;
  phone?: string | null;
  error?: string;
}

interface WhatsAppInboxMessage {
  id: string;
  pushName: string;
  phone: string;
  jid: string | null;
  timestampMs: number;
  text: string;
  mediaType: 'text' | 'image' | 'pdf' | 'audio' | 'document';
  mimetype: string | null;
  mediaBase64: string | null;
  mediaUrl: string | null;
  fileName: string | null;
}

interface WhatsAppExtractedParty {
  rol: string;
  nombreCompleto: string | null;
  documento: string | null;
  direccion: string | null;
}

interface WhatsAppAnalysisResult {
  resumen: string;
  tramite: string;
  partes: WhatsAppExtractedParty[];
  datosClave: string[];
  respuestaSugerida: string;
}

interface WhatsAppGeneratedContract {
  docId: string;
  titulo: string;
  categoria: string;
  texto: string;
}

interface WhatsAppConversationThread {
  threadKey: string;
  phone: string;
  jid: string | null;
  pushName: string;
  messages: WhatsAppInboxMessage[];
  latestTimestampMs: number;
}

interface PersonaSaveStatus {
  kind: 'success' | 'error';
  message: string;
}

interface ReplySendStatus {
  kind: 'success' | 'error';
  message: string;
}

const SAFE_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const DEFAULT_AUTO_REPLY_MESSAGE =
  '¡Hola! En este momento el escribano no se encuentra disponible, pero recibimos tu mensaje correctamente. En breve nos pondremos en contacto contigo.';

const DEFAULT_AFTER_HOURS_MESSAGE =
  '¡Hola! Nuestro horario de atención es de 08:00 a 17:00 (hora Paraguay). Recibimos tu mensaje y te responderemos a primera hora del siguiente día hábil.';

const DEFAULT_MEDIA_REPLY_MESSAGE =
  '¡Recibimos tu documento/cédula correctamente! Lo estamos revisando y en breve te confirmamos.';

const DEFAULT_WORK_KEYWORDS: string[] = [
  'escribania',
  'escritura',
  'pagare',
  'certificacion',
  'poder',
  'presupuesto',
  'honorarios',
  'transferencia',
  'firma',
  'contrato',
  'vehiculo',
  'terreno',
  'sociedad',
  'ruc',
];

const DEFAULT_ABOGADO_KEYWORDS: string[] = [
  'abogado',
  'consulta',
  'demanda',
  'juicio',
  'expediente',
  'juzgado',
  'audiencia',
  'notificacion',
  'cedula',
  'plazo',
  'sucesion',
  'divorcio',
  'alimentos',
  'desalojo',
  'embargo',
  'laboral',
  'despido',
  'penal',
  'denuncia',
  'pagare',
  'contrato',
  'presupuesto',
  'honorarios',
];

const normalizeFilterText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const DELAY_OPTIONS: Array<{ seconds: number; label: string }> = [
  { seconds: 60, label: '1 min' },
  { seconds: 120, label: '2 min' },
  { seconds: 300, label: '5 min' },
  { seconds: 600, label: '10 min' },
  { seconds: 900, label: '15 min' },
];

const COOLDOWN_OPTIONS: Array<{ minutes: number; label: string }> = [
  { minutes: 0, label: 'Sin límite' },
  { minutes: 60, label: '1 hora' },
  { minutes: 360, label: '6 horas' },
  { minutes: 1440, label: '24 horas' },
];

const normalizeStatus = (raw?: string): WhatsAppConnectionStatus => {
  if (raw === 'connected' || raw === 'qr_ready' || raw === 'connecting' || raw === 'disconnected') {
    return raw;
  }
  return 'disconnected';
};

const normalizeQrImageSrc = (rawQr: string | null): string | null => {
  if (!rawQr || typeof rawQr !== 'string') return null;
  const trimmed = rawQr.trim();
  if (!trimmed) return null;
  if (/^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/i.test(trimmed)) {
    return trimmed;
  }
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return `data:image/png;base64,${trimmed}`;
  }
  return null;
};

const normalizeIncomingImageSrc = (
  rawBase64: string | null,
  rawMimetype: string | null,
  rawUrl: string | null
): string | null => {
  if (rawBase64 && typeof rawBase64 === 'string') {
    const trimmed = rawBase64.trim();
    const dataPrefixMatch = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=\r\n\s]+)$/i.exec(trimmed);
    if (dataPrefixMatch) {
      const mime = dataPrefixMatch[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : dataPrefixMatch[1].toLowerCase();
      const b64 = dataPrefixMatch[2].replace(/[\r\n\s]/g, '');
      if (SAFE_IMAGE_MIMES.has(mime) && /^[A-Za-z0-9+/=]+$/.test(b64)) {
        return `data:${mime};base64,${b64}`;
      }
    }
    const cleanB64 = trimmed.replace(/[\r\n\s]/g, '');
    const cleanMime = (rawMimetype || 'image/jpeg').split(';')[0].trim().toLowerCase();
    const resolvedMime = cleanMime === 'image/jpg' ? 'image/jpeg' : cleanMime;
    if (SAFE_IMAGE_MIMES.has(resolvedMime) && /^[A-Za-z0-9+/=]+$/.test(cleanB64)) {
      return `data:${resolvedMime};base64,${cleanB64}`;
    }
  }

  if (rawUrl && typeof rawUrl === 'string') {
    const trimmedUrl = rawUrl.trim();
    if (trimmedUrl.startsWith('https://') || trimmedUrl.startsWith('/')) {
      return trimmedUrl;
    }
  }

  return null;
};

const cleanPhoneNumber = (rawPhone: unknown): string => {
  if (typeof rawPhone !== 'string' && typeof rawPhone !== 'number') return '';
  const withoutJid = String(rawPhone).split('@')[0] || '';
  return withoutJid.replace(/[^\d+]/g, '').trim();
};

const parseTimestampMs = (rawTs: unknown): number => {
  if (typeof rawTs === 'number' && Number.isFinite(rawTs)) {
    return rawTs < 1_000_000_000_000 ? rawTs * 1000 : rawTs;
  }
  if (typeof rawTs === 'string' && rawTs.trim()) {
    const num = Number(rawTs);
    if (Number.isFinite(num) && num > 0) {
      return num < 1_000_000_000_000 ? num * 1000 : num;
    }
    const parsed = Date.parse(rawTs);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return Date.now();
};

const formatMessageDateTime = (timestampMs: number): string => {
  try {
    return new Intl.DateTimeFormat('es-PY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestampMs));
  } catch {
    return '';
  }
};

const formatCompactMessageTime = (timestampMs: number): string => {
  try {
    return new Intl.DateTimeFormat('es-PY', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestampMs));
  } catch {
    return '';
  }
};

const normalizeThreadKey = (phone: string, jid: string | null, fallbackId: string): string => {
  const digits = cleanPhoneNumber(phone).replace(/^\+/, '');
  if (digits) return digits;
  if (jid && jid.trim()) return jid.trim().toLowerCase();
  return `anon-${fallbackId}`;
};

const isGenericPushName = (name: string, phone: string): boolean => {
  const trimmed = name.trim();
  if (!trimmed || trimmed === 'Contacto WhatsApp') return true;
  const digitsName = trimmed.replace(/\D/g, '');
  const digitsPhone = phone.replace(/\D/g, '');
  return Boolean(digitsPhone && digitsName === digitsPhone);
};

const extractMessageJid = (raw: any): string | null => {
  const candidate = raw?.jid ?? raw?.remoteJid ?? raw?.chatId ?? raw?.key?.remoteJid;
  if (typeof candidate !== 'string') return null;
  const trimmed = candidate.trim();
  return trimmed ? trimmed : null;
};

const normalizeInboxMessage = (raw: any, index: number): WhatsAppInboxMessage | null => {
  if (!raw || typeof raw !== 'object') return null;

  const jid = extractMessageJid(raw);
  const phone = cleanPhoneNumber(raw.phone ?? raw.from ?? raw.sender ?? raw.remoteJid ?? '');
  const timestampMs = parseTimestampMs(raw.timestamp ?? raw.messageTimestamp ?? raw.createdAt);
  const rawId = raw.id ?? raw.messageId ?? raw.key?.id;
  const id =
    typeof rawId === 'string' && rawId.trim()
      ? rawId.trim()
      : `wa-${phone || jid || 'anon'}-${timestampMs}-${index}`;

  const pushName =
    (typeof raw.pushName === 'string' && raw.pushName.trim()) ||
    (typeof raw.senderName === 'string' && raw.senderName.trim()) ||
    (typeof raw.notifyName === 'string' && raw.notifyName.trim()) ||
    (typeof raw.name === 'string' && raw.name.trim()) ||
    (phone ? `+${phone.replace(/^\+/, '')}` : 'Contacto WhatsApp');

  const text =
    (typeof raw.text === 'string' && raw.text) ||
    (typeof raw.body === 'string' && raw.body) ||
    (typeof raw.caption === 'string' && raw.caption) ||
    (typeof raw.message === 'string' && raw.message) ||
    '';

  const rawMimetype =
    typeof raw.mimetype === 'string' && raw.mimetype.trim()
      ? raw.mimetype.split(';')[0].trim().toLowerCase()
      : typeof raw.mimeType === 'string' && raw.mimeType.trim()
        ? raw.mimeType.split(';')[0].trim().toLowerCase()
        : null;

  const rawMediaType = String(raw.mediaType ?? raw.type ?? '').trim().toLowerCase();
  const fileName = typeof raw.fileName === 'string' && raw.fileName.trim() ? raw.fileName.trim() : null;

  let mediaType: WhatsAppInboxMessage['mediaType'] = 'text';
  if (rawMediaType === 'image' || rawMimetype?.startsWith('image/')) {
    mediaType = 'image';
  } else if (
    rawMediaType === 'audio' ||
    rawMediaType === 'ptt' ||
    rawMediaType === 'voice' ||
    rawMimetype?.startsWith('audio/')
  ) {
    mediaType = 'audio';
  } else if (
    rawMediaType === 'pdf' ||
    rawMimetype === 'application/pdf' ||
    (fileName && fileName.toLowerCase().endsWith('.pdf'))
  ) {
    mediaType = 'pdf';
  } else if (rawMediaType === 'document') {
    mediaType = 'document';
  }

  const mediaBase64 =
    typeof raw.mediaBase64 === 'string' && raw.mediaBase64.trim()
      ? raw.mediaBase64.trim()
      : typeof raw.base64 === 'string' && raw.base64.trim()
        ? raw.base64.trim()
        : null;

  const mediaUrl =
    typeof raw.mediaUrl === 'string' && raw.mediaUrl.trim() ? raw.mediaUrl.trim() : null;

  return {
    id,
    pushName,
    phone,
    jid,
    timestampMs,
    text,
    mediaType,
    mimetype: rawMimetype,
    mediaBase64,
    mediaUrl,
    fileName,
  };
};

const getAuthHeaders = async (includeJsonContentType = false): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {};
  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }
  try {
    const user = auth?.currentUser;
    if (user) {
      const token = await user.getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch {
    // Continuar si el token no está disponible en desarrollo
  }
  return headers;
};

export const WhatsAppTab: React.FC<WhatsAppTabProps> = ({
  workspaceId,
  esPlanFull = false,
  esAbogado = false,
  escribania,
  onOpenEscritos,
}) => {
  const [status, setStatus] = useState<WhatsAppConnectionStatus>('disconnected');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [linkedPhone, setLinkedPhone] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Formulario de prueba rápida de envío
  const [testPhone, setTestPhone] = useState<string>('');
  const [testMessage, setTestMessage] = useState<string>(
    'Hola, este es un mensaje de prueba enviado desde O.L.G.A.'
  );
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendSuccessMsg, setSendSuccessMsg] = useState<string | null>(null);
  const [sendErrorMsg, setSendErrorMsg] = useState<string | null>(null);

  // Bandeja Inteligente (Etapa 3)
  const [inboxMessages, setInboxMessages] = useState<WhatsAppInboxMessage[]>([]);
  const [isLoadingInbox, setIsLoadingInbox] = useState<boolean>(false);
  const [isRefreshingInbox, setIsRefreshingInbox] = useState<boolean>(false);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [lastInboxSyncAt, setLastInboxSyncAt] = useState<number | null>(null);

  const [analyzingThreadKeys, setAnalyzingThreadKeys] = useState<Record<string, boolean>>({});
  const [analysisErrorByThreadKey, setAnalysisErrorByThreadKey] = useState<Record<string, string>>({});
  const [analysisByThreadKey, setAnalysisByThreadKey] = useState<
    Record<string, WhatsAppAnalysisResult>
  >({});
  const [replyDraftByThreadKey, setReplyDraftByThreadKey] = useState<Record<string, string>>({});
  const [sendingReplyThreadKeys, setSendingReplyThreadKeys] = useState<Record<string, boolean>>({});
  const [replyStatusByThreadKey, setReplyStatusByThreadKey] = useState<
    Record<string, ReplySendStatus>
  >({});
  const [savingPartyKeys, setSavingPartyKeys] = useState<Record<string, boolean>>({});
  const [savedPartyStatusByKey, setSavedPartyStatusByKey] = useState<
    Record<string, PersonaSaveStatus>
  >({});
  const [generatingContractThreadKeys, setGeneratingContractThreadKeys] = useState<
    Record<string, boolean>
  >({});
  const [contractErrorByThreadKey, setContractErrorByThreadKey] = useState<
    Record<string, string>
  >({});
  const [generatedContractByThreadKey, setGeneratedContractByThreadKey] = useState<
    Record<string, WhatsAppGeneratedContract>
  >({});
  const [sendingPdfThreadKeys, setSendingPdfThreadKeys] = useState<Record<string, boolean>>({});
  const [pdfSendStatusByThreadKey, setPdfSendStatusByThreadKey] = useState<
    Record<string, ReplySendStatus>
  >({});

  // UX diaria: panel de conexión/prueba colapsable y filtro Pendientes / Atendidos
  const [showConnectionPanel, setShowConnectionPanel] = useState<boolean>(false);
  const [inboxFilterTab, setInboxFilterTab] = useState<'pending' | 'attended'>('pending');
  const [archivedThreads, setArchivedThreads] = useState<Record<string, number>>({});

  // Configuración avanzada de Respuesta Automática por Ausencia
  const [autoReplyEnabled, setAutoReplyEnabled] = useState<boolean>(true);
  const [delaySeconds, setDelaySeconds] = useState<number>(120);
  const [cooldownMinutes, setCooldownMinutes] = useState<number>(0);
  const [businessHoursEnabled, setBusinessHoursEnabled] = useState<boolean>(false);
  const [businessStart, setBusinessStart] = useState<string>('08:00');
  const [businessEnd, setBusinessEnd] = useState<string>('17:00');
  const [autoReplyMessage, setAutoReplyMessage] = useState<string>(DEFAULT_AUTO_REPLY_MESSAGE);
  const [afterHoursMessage, setAfterHoursMessage] = useState<string>(DEFAULT_AFTER_HOURS_MESSAGE);
  const [mediaReplyEnabled, setMediaReplyEnabled] = useState<boolean>(false);
  const [mediaReplyMessage, setMediaReplyMessage] = useState<string>(DEFAULT_MEDIA_REPLY_MESSAGE);
  const [aiReceptionistEnabled, setAiReceptionistEnabled] = useState<boolean>(true);
  const [showFallbackMessages, setShowFallbackMessages] = useState<boolean>(false);
  const [workFilterEnabled, setWorkFilterEnabled] = useState<boolean>(true);
  const [allowDocuments, setAllowDocuments] = useState<boolean>(true);
  const suggestedKeywords = useMemo(
    () => (esAbogado ? DEFAULT_ABOGADO_KEYWORDS : DEFAULT_WORK_KEYWORDS),
    [esAbogado]
  );
  const [workKeywords, setWorkKeywords] = useState<string[]>(() =>
    esAbogado ? [...DEFAULT_ABOGADO_KEYWORDS] : [...DEFAULT_WORK_KEYWORDS]
  );
  const hasLoadedSavedKeywordsRef = useRef<boolean>(false);
  const [newKeywordInput, setNewKeywordInput] = useState<string>('');
  const [liveTestMessage, setLiveTestMessage] = useState<string>('');
  const [showConfigMessageBox, setShowConfigMessageBox] = useState<boolean>(false);
  const [isSavingWaConfig, setIsSavingWaConfig] = useState<boolean>(false);
  const [waConfigSavedBadge, setWaConfigSavedBadge] = useState<boolean>(false);
  const [waConfigFeedback, setWaConfigFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const waFeedbackTimerRef = useRef<number | null>(null);
  const waSavedBadgeTimerRef = useRef<number | null>(null);

  // Exclusión de chats personales (ocultar de O.L.G.A. sin bloquear en WhatsApp)
  const [excludedJids, setExcludedJids] = useState<string[]>([]);
  const [showExcludedPanel, setShowExcludedPanel] = useState<boolean>(false);
  const [mutingJidKey, setMutingJidKey] = useState<string | null>(null);
  const [confirmPersonalJid, setConfirmPersonalJid] = useState<string | null>(null);
  const [muteErrorByThreadKey, setMuteErrorByThreadKey] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!workspaceId) {
      setArchivedThreads({});
      return;
    }
    try {
      const raw = localStorage.getItem(`olga_wa_archived_${workspaceId}`);
      if (!raw) {
        setArchivedThreads({});
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const sanitized: Record<string, number> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'number' && Number.isFinite(v)) {
            sanitized[k] = v;
          }
        }
        setArchivedThreads(sanitized);
      } else {
        setArchivedThreads({});
      }
    } catch {
      setArchivedThreads({});
    }
  }, [workspaceId]);

  const getArchiveThreadKey = useCallback(
    (thread: WhatsAppConversationThread): string =>
      thread.jid || thread.phone || thread.threadKey,
    []
  );

  const persistArchivedThreads = useCallback(
    (nextMap: Record<string, number>) => {
      if (!workspaceId) return;
      try {
        localStorage.setItem(`olga_wa_archived_${workspaceId}`, JSON.stringify(nextMap));
      } catch {
        // Ignorar errores de cuota de almacenamiento local
      }
    },
    [workspaceId]
  );

  const handleMarkThreadAttended = useCallback(
    (thread: WhatsAppConversationThread) => {
      const archiveKey = getArchiveThreadKey(thread);
      setArchivedThreads((prev) => {
        const next = {
          ...prev,
          [archiveKey]: thread.latestTimestampMs,
        };
        persistArchivedThreads(next);
        return next;
      });
    },
    [getArchiveThreadKey, persistArchivedThreads]
  );

  const handleReopenThread = useCallback(
    (thread: WhatsAppConversationThread) => {
      const archiveKey = getArchiveThreadKey(thread);
      setArchivedThreads((prev) => {
        const next = { ...prev };
        delete next[archiveKey];
        if (next[thread.threadKey] !== undefined) {
          delete next[thread.threadKey];
        }
        persistArchivedThreads(next);
        return next;
      });
    },
    [getArchiveThreadKey, persistArchivedThreads]
  );

  const excludedLookup = useMemo(() => {
    const exactSet = new Set<string>();
    const digitsSet = new Set<string>();
    for (const rawJid of excludedJids) {
      const trimmed = rawJid.trim().toLowerCase();
      if (!trimmed) continue;
      exactSet.add(trimmed);
      if (!trimmed.endsWith('@lid')) {
        const digits = cleanPhoneNumber(trimmed).replace(/^\+/, '');
        if (digits) digitsSet.add(digits);
      }
    }
    return { exactSet, digitsSet };
  }, [excludedJids]);

  const conversationThreads = useMemo<WhatsAppConversationThread[]>(() => {
    const grouped = new Map<string, WhatsAppInboxMessage[]>();
    for (const msg of inboxMessages) {
      const key = normalizeThreadKey(msg.phone, msg.jid, msg.id);
      const list = grouped.get(key);
      if (list) {
        list.push(msg);
      } else {
        grouped.set(key, [msg]);
      }
    }

    const threads: WhatsAppConversationThread[] = [];
    for (const [threadKey, msgs] of grouped.entries()) {
      const chronological = [...msgs].sort((a, b) => a.timestampMs - b.timestampMs);
      const latestMsg = chronological[chronological.length - 1];
      let resolvedPhone = '';
      let resolvedJid: string | null = null;
      let resolvedPushName = '';

      for (let i = chronological.length - 1; i >= 0; i -= 1) {
        const candidate = chronological[i];
        if (!resolvedPhone && candidate.phone) {
          resolvedPhone = candidate.phone;
        }
        if (!resolvedJid && candidate.jid) {
          resolvedJid = candidate.jid;
        }
        if (
          !resolvedPushName &&
          candidate.pushName &&
          !isGenericPushName(candidate.pushName, candidate.phone)
        ) {
          resolvedPushName = candidate.pushName;
        }
        if (resolvedPhone && resolvedJid && resolvedPushName) break;
      }

      if (!resolvedPushName) {
        resolvedPushName =
          latestMsg.pushName ||
          (resolvedPhone ? `+${resolvedPhone.replace(/^\+/, '')}` : resolvedJid || 'Contacto WhatsApp');
      }

      const finalPhone = resolvedPhone || latestMsg.phone;
      const finalJid = resolvedJid || latestMsg.jid;
      const normalizedFinalJid = finalJid ? finalJid.trim().toLowerCase() : '';
      const normalizedFinalDigits = cleanPhoneNumber(finalPhone).replace(/^\+/, '');

      if (
        (normalizedFinalJid && excludedLookup.exactSet.has(normalizedFinalJid)) ||
        (normalizedFinalDigits && excludedLookup.digitsSet.has(normalizedFinalDigits))
      ) {
        continue;
      }

      threads.push({
        threadKey,
        phone: finalPhone,
        jid: finalJid,
        pushName: resolvedPushName,
        messages: chronological,
        latestTimestampMs: latestMsg.timestampMs,
      });
    }

    return threads.sort((a, b) => b.latestTimestampMs - a.latestTimestampMs);
  }, [inboxMessages, excludedLookup]);

  const { pendingThreads, attendedThreads } = useMemo(() => {
    const pending: WhatsAppConversationThread[] = [];
    const attended: WhatsAppConversationThread[] = [];

    for (const thread of conversationThreads) {
      const archiveKey = getArchiveThreadKey(thread);
      const archivedTs = archivedThreads[archiveKey] ?? archivedThreads[thread.threadKey];
      const isAttended =
        typeof archivedTs === 'number' &&
        Number.isFinite(archivedTs) &&
        thread.latestTimestampMs <= archivedTs;

      if (isAttended) {
        attended.push(thread);
      } else {
        pending.push(thread);
      }
    }

    return { pendingThreads: pending, attendedThreads: attended };
  }, [conversationThreads, archivedThreads, getArchiveThreadKey]);

  const visibleThreads = inboxFilterTab === 'attended' ? attendedThreads : pendingThreads;

  const fetchStatus = useCallback(
    async (silent = false) => {
      if (!workspaceId) {
        setIsInitialLoading(false);
        return;
      }
      if (!silent) {
        setIsRefreshing(true);
      }

      try {
        const headers = await getAuthHeaders(false);
        const res = await fetch(`/api/whatsapp/status/${encodeURIComponent(workspaceId)}`, {
          method: 'GET',
          headers,
        });
        const data: WhatsAppStatusPayload = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || 'No se pudo consultar el estado de WhatsApp.');
        }

        const nextStatus = normalizeStatus(data.status);
        setStatus(nextStatus);
        setQrCode(normalizeQrImageSrc(data.qr ?? null));
        setLinkedPhone(data.phone ? String(data.phone) : null);
        setErrorMsg(null);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al consultar el estado de WhatsApp.';
        setErrorMsg(message);
      } finally {
        setIsInitialLoading(false);
        setIsRefreshing(false);
      }
    },
    [workspaceId]
  );

  const fetchInbox = useCallback(
    async (silent = false) => {
      if (!workspaceId) return;
      if (!silent) {
        setIsRefreshingInbox(true);
      }

      try {
        const headers = await getAuthHeaders(false);
        const res = await fetch(`/api/whatsapp/inbox/${encodeURIComponent(workspaceId)}`, {
          method: 'GET',
          headers,
        });
        const data: { ok?: boolean; messages?: unknown[]; error?: string } = await res
          .json()
          .catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.error || 'No se pudo obtener la bandeja de entrada de WhatsApp.');
        }

        const rawList = Array.isArray(data.messages) ? data.messages : [];
        const normalizedList = rawList
          .map((item, idx) => normalizeInboxMessage(item, idx))
          .filter((item): item is WhatsAppInboxMessage => item !== null)
          .sort((a, b) => b.timestampMs - a.timestampMs);

        setInboxMessages(normalizedList);
        setInboxError(null);
        setLastInboxSyncAt(Date.now());
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Error al consultar la bandeja de entrada.';
        setInboxError(message);
      } finally {
        setIsLoadingInbox(false);
        setIsRefreshingInbox(false);
      }
    },
    [workspaceId]
  );

  // Consulta inicial de estado al montar o cambiar de workspaceId
  useEffect(() => {
    setIsInitialLoading(true);
    fetchStatus(true);
  }, [fetchStatus]);

  // Polling automático cada 3 segundos mientras espera escaneo QR
  useEffect(() => {
    if (!workspaceId || (status !== 'qr_ready' && status !== 'connecting')) {
      return;
    }

    const intervalId = window.setInterval(() => {
      fetchStatus(true);
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [status, workspaceId, fetchStatus]);

  // Polling automático cada 5 segundos de la Bandeja Inteligente cuando está conectado
  useEffect(() => {
    if (!workspaceId || status !== 'connected') {
      return;
    }

    setIsLoadingInbox(true);
    fetchInbox(true);

    const intervalId = window.setInterval(() => {
      fetchInbox(true);
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [status, workspaceId, fetchInbox]);

  const showWaConfigNotice = useCallback((kind: 'success' | 'error', text: string) => {
    setWaConfigFeedback({ kind, text });
    if (waFeedbackTimerRef.current !== null) {
      window.clearTimeout(waFeedbackTimerRef.current);
    }
    waFeedbackTimerRef.current = window.setTimeout(() => {
      setWaConfigFeedback(null);
      waFeedbackTimerRef.current = null;
    }, 3500);
  }, []);

  useEffect(() => {
    return () => {
      if (waFeedbackTimerRef.current !== null) {
        window.clearTimeout(waFeedbackTimerRef.current);
      }
      if (waSavedBadgeTimerRef.current !== null) {
        window.clearTimeout(waSavedBadgeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedSavedKeywordsRef.current) {
      setWorkKeywords(esAbogado ? [...DEFAULT_ABOGADO_KEYWORDS] : [...DEFAULT_WORK_KEYWORDS]);
    }
  }, [esAbogado]);

  // Carga de configuración avanzada de Respuesta Automática (Firestore + servidor WhatsApp)
  useEffect(() => {
    if (!workspaceId) return;
    let active = true;
    hasLoadedSavedKeywordsRef.current = false;

    const isExactNotaryDefault = (list: string[]) =>
      list.length === DEFAULT_WORK_KEYWORDS.length &&
      list.every((kw, idx) => normalizeFilterText(kw) === normalizeFilterText(DEFAULT_WORK_KEYWORDS[idx]));

    const applyConfigFields = (cfg: Record<string, any>, fromFirestore: boolean) => {
      if (typeof cfg.autoReplyEnabled === 'boolean') {
        setAutoReplyEnabled(cfg.autoReplyEnabled);
      }
      if (typeof cfg.delaySeconds === 'number' && Number.isFinite(cfg.delaySeconds)) {
        setDelaySeconds(cfg.delaySeconds);
      }
      if (typeof cfg.cooldownMinutes === 'number' && Number.isFinite(cfg.cooldownMinutes)) {
        setCooldownMinutes(cfg.cooldownMinutes);
      }
      if (typeof cfg.businessHoursEnabled === 'boolean') {
        setBusinessHoursEnabled(cfg.businessHoursEnabled);
      }
      if (typeof cfg.businessStart === 'string' && /^\d{2}:\d{2}$/.test(cfg.businessStart.trim())) {
        setBusinessStart(cfg.businessStart.trim());
      }
      if (typeof cfg.businessEnd === 'string' && /^\d{2}:\d{2}$/.test(cfg.businessEnd.trim())) {
        setBusinessEnd(cfg.businessEnd.trim());
      }
      if (typeof cfg.autoReplyMessage === 'string' && cfg.autoReplyMessage.trim()) {
        setAutoReplyMessage(cfg.autoReplyMessage);
      }
      if (typeof cfg.afterHoursMessage === 'string' && cfg.afterHoursMessage.trim()) {
        setAfterHoursMessage(cfg.afterHoursMessage);
      }
      if (typeof cfg.mediaReplyEnabled === 'boolean') {
        setMediaReplyEnabled(cfg.mediaReplyEnabled);
      }
      if (typeof cfg.mediaReplyMessage === 'string' && cfg.mediaReplyMessage.trim()) {
        setMediaReplyMessage(cfg.mediaReplyMessage);
      }
      if (typeof cfg.aiReceptionistEnabled === 'boolean') {
        setAiReceptionistEnabled(cfg.aiReceptionistEnabled);
      }
      if (typeof cfg.workFilterEnabled === 'boolean') {
        setWorkFilterEnabled(cfg.workFilterEnabled);
      }
      if (typeof cfg.allowDocuments === 'boolean') {
        setAllowDocuments(cfg.allowDocuments);
      }
      if (Array.isArray(cfg.workKeywords)) {
        const cleaned = cfg.workKeywords
          .filter((k: unknown): k is string => typeof k === 'string' && k.trim().length > 0)
          .map((k: string) => k.trim());
        if (!(esAbogado && !fromFirestore && !hasLoadedSavedKeywordsRef.current && isExactNotaryDefault(cleaned))) {
          hasLoadedSavedKeywordsRef.current = true;
          setWorkKeywords(cleaned);
        }
      }
      if (Array.isArray(cfg.excludedJids)) {
        setExcludedJids(
          cfg.excludedJids.filter((j: unknown): j is string => typeof j === 'string' && j.trim().length > 0)
        );
      }
    };

    const loadWaConfig = async () => {
      try {
        if (auth.currentUser) {
          const fsSnap = await getDoc(doc(db, 'users', workspaceId, 'whatsapp_config', 'settings')).catch(() => null);
          if (active && fsSnap?.exists()) {
            applyConfigFields(fsSnap.data() as Record<string, any>, true);
          }
        }

        const headers = await getAuthHeaders(false);
        const res = await fetch(`/api/whatsapp/config/${encodeURIComponent(workspaceId)}`, {
          method: 'GET',
          headers,
        });
        const data = await res.json().catch(() => ({}));
        if (!active || !res.ok) return;

        applyConfigFields(data, false);
      } catch {
        // Mantener valores por defecto si aún no hay configuración guardada
      }
    };

    loadWaConfig();
    return () => {
      active = false;
    };
  }, [workspaceId, esAbogado]);

  const saveWaAbsenceConfig = async (
    overrides: Partial<{
      autoReplyEnabled: boolean;
      delaySeconds: number;
      cooldownMinutes: number;
      businessHoursEnabled: boolean;
      businessStart: string;
      businessEnd: string;
      autoReplyMessage: string;
      afterHoursMessage: string;
      mediaReplyEnabled: boolean;
      mediaReplyMessage: string;
      aiReceptionistEnabled: boolean;
      workFilterEnabled: boolean;
      allowDocuments: boolean;
      workKeywords: string[];
    }>,
    feedbackText: string
  ) => {
    if (!workspaceId || isSavingWaConfig) return false;
    setIsSavingWaConfig(true);
    try {
      const payload = {
        autoReplyEnabled: overrides.autoReplyEnabled ?? autoReplyEnabled,
        delaySeconds: overrides.delaySeconds ?? (delaySeconds || 120),
        cooldownMinutes: overrides.cooldownMinutes ?? cooldownMinutes,
        businessHoursEnabled: overrides.businessHoursEnabled ?? businessHoursEnabled,
        businessStart: overrides.businessStart ?? businessStart,
        businessEnd: overrides.businessEnd ?? businessEnd,
        autoReplyMessage: overrides.autoReplyMessage ?? autoReplyMessage,
        afterHoursMessage: overrides.afterHoursMessage ?? afterHoursMessage,
        mediaReplyEnabled: overrides.mediaReplyEnabled ?? mediaReplyEnabled,
        mediaReplyMessage: overrides.mediaReplyMessage ?? mediaReplyMessage,
        aiReceptionistEnabled: overrides.aiReceptionistEnabled ?? aiReceptionistEnabled,
        workFilterEnabled: overrides.workFilterEnabled ?? workFilterEnabled,
        allowDocuments: overrides.allowDocuments ?? allowDocuments,
        workKeywords: overrides.workKeywords ?? workKeywords,
      };

      if (auth.currentUser) {
        await setDoc(
          doc(db, 'users', workspaceId, 'whatsapp_config', 'settings'),
          {
            ...payload,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      const headers = await getAuthHeaders(true);
      const res = await fetch(`/api/whatsapp/config/${encodeURIComponent(workspaceId)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo sincronizar la configuración con WhatsApp.');
      }
      showWaConfigNotice('success', feedbackText);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar configuración.';
      showWaConfigNotice('error', msg);
      return false;
    } finally {
      setIsSavingWaConfig(false);
    }
  };

  const handleAddWorkKeyword = () => {
    const parts = newKeywordInput
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    if (parts.length === 0) return;

    setWorkKeywords((prev) => {
      const existingNormalized = new Set(prev.map(normalizeFilterText));
      const next = [...prev];
      for (const rawItem of parts) {
        const clean = rawItem.slice(0, 60);
        const norm = normalizeFilterText(clean);
        if (norm && !existingNormalized.has(norm) && next.length < 100) {
          existingNormalized.add(norm);
          next.push(clean);
        }
      }
      return next;
    });
    setNewKeywordInput('');
  };

  const handleRemoveWorkKeyword = (keywordToRemove: string) => {
    setWorkKeywords((prev) => prev.filter((k) => k !== keywordToRemove));
  };

  const handleRestoreSuggestedKeywords = () => {
    setWorkKeywords([...suggestedKeywords]);
  };

  const liveTestMatchedKeyword = useMemo(() => {
    const normalizedInput = normalizeFilterText(liveTestMessage);
    if (!normalizedInput) return null;
    for (const kw of workKeywords) {
      const normKw = normalizeFilterText(kw);
      if (normKw && normalizedInput.includes(normKw)) {
        return kw;
      }
    }
    return null;
  }, [liveTestMessage, workKeywords]);

  const delayMinutesLabel = Math.max(1, Math.round((delaySeconds || 120) / 60));

  const handleToggleAutoReply = async () => {
    const prev = autoReplyEnabled;
    const next = !prev;
    setAutoReplyEnabled(next);
    const ok = await saveWaAbsenceConfig(
      { autoReplyEnabled: next },
      next
        ? `Respuesta automática (${delayMinutesLabel} min) activada`
        : 'Respuesta automática desactivada'
    );
    if (!ok) {
      setAutoReplyEnabled(prev);
    }
  };

  const handleSaveAdvancedConfig = async () => {
    const ok = await saveWaAbsenceConfig({}, 'Configuración de O.L.G.A. guardada');
    if (ok) {
      setWaConfigSavedBadge(true);
      if (waSavedBadgeTimerRef.current !== null) {
        window.clearTimeout(waSavedBadgeTimerRef.current);
      }
      waSavedBadgeTimerRef.current = window.setTimeout(() => {
        setWaConfigSavedBadge(false);
        waSavedBadgeTimerRef.current = null;
      }, 3000);
    }
  };

  const formatExcludedJidLabel = (jid: string): string => {
    const trimmed = jid.trim();
    if (!trimmed) return 'Contacto';
    if (/@lid$/i.test(trimmed)) {
      return `ID ${trimmed.replace(/@lid$/i, '')}`;
    }
    const base = trimmed.split('@')[0] || trimmed;
    const digits = base.replace(/\D/g, '');
    return digits ? `+${digits}` : base;
  };

  const handleMuteThread = async (thread: WhatsAppConversationThread) => {
    if (!workspaceId || mutingJidKey) return;
    const targetJid = (thread.jid || thread.phone || '').trim();
    if (!targetJid) {
      setMuteErrorByThreadKey((prev) => ({
        ...prev,
        [thread.threadKey]: 'No se pudo identificar el JID o número de esta conversación.',
      }));
      return;
    }

    setMuteErrorByThreadKey((prev) => {
      const next = { ...prev };
      delete next[thread.threadKey];
      return next;
    });
    setMutingJidKey(targetJid);
    try {
      const headers = await getAuthHeaders(true);
      const res = await fetch(`/api/whatsapp/mute/${encodeURIComponent(workspaceId)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jid: targetJid, muted: true }),
      });
      const data: { ok?: boolean; excludedJids?: unknown; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo marcar el chat como personal.');
      }

      if (Array.isArray(data.excludedJids)) {
        setExcludedJids(
          data.excludedJids.filter((j): j is string => typeof j === 'string' && j.trim().length > 0)
        );
      } else {
        setExcludedJids((prev) => (prev.includes(targetJid) ? prev : [...prev, targetJid]));
      }

      setConfirmPersonalJid(null);
      showWaConfigNotice('success', 'Chat personal oculto de O.L.G.A. (no bloqueado en WhatsApp)');
      await fetchInbox(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al marcar como chat personal.';
      setMuteErrorByThreadKey((prev) => ({ ...prev, [thread.threadKey]: msg }));
      showWaConfigNotice('error', msg);
    } finally {
      setMutingJidKey(null);
    }
  };

  const handleRestoreExcludedJid = async (jid: string) => {
    if (!workspaceId || mutingJidKey) return;
    setMutingJidKey(jid);
    try {
      const headers = await getAuthHeaders(true);
      const res = await fetch(`/api/whatsapp/mute/${encodeURIComponent(workspaceId)}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ jid, muted: false }),
      });
      const data: { ok?: boolean; excludedJids?: unknown; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo restaurar el contacto.');
      }

      let nextList: string[];
      if (Array.isArray(data.excludedJids)) {
        nextList = data.excludedJids.filter(
          (item): item is string => typeof item === 'string' && item.trim().length > 0
        );
      } else {
        nextList = excludedJids.filter((item) => item !== jid);
      }
      setExcludedJids(nextList);
      if (nextList.length === 0) {
        setShowExcludedPanel(false);
      }

      showWaConfigNotice('success', 'Contacto restaurado en O.L.G.A.');
      await fetchInbox(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al restaurar el contacto.';
      showWaConfigNotice('error', msg);
    } finally {
      setMutingJidKey(null);
    }
  };

  const handleConnect = async () => {
    if (!workspaceId || isConnecting) return;
    setIsConnecting(true);
    setErrorMsg(null);
    setSendSuccessMsg(null);

    try {
      const headers = await getAuthHeaders(true);
      const res = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers,
        body: JSON.stringify({ workspaceId }),
      });
      const data: WhatsAppStatusPayload = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo iniciar la vinculación con WhatsApp.');
      }

      const nextStatus = normalizeStatus(data.status || 'connecting');
      setStatus(nextStatus);
      setQrCode(normalizeQrImageSrc(data.qr ?? null));
      setLinkedPhone(data.phone ? String(data.phone) : null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al generar el código QR.';
      setErrorMsg(message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || isSending) return;

    const cleanPhone = testPhone.replace(/[^\d+]/g, '').trim();
    const trimmedMessage = testMessage.trim();

    setSendSuccessMsg(null);
    setSendErrorMsg(null);

    if (!cleanPhone || cleanPhone.length < 7) {
      setSendErrorMsg('Ingresa un número de teléfono válido con código de país (ej. 595981123456).');
      return;
    }

    if (!trimmedMessage) {
      setSendErrorMsg('Escribe un mensaje antes de enviar.');
      return;
    }

    setIsSending(true);
    try {
      const headers = await getAuthHeaders(true);
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          workspaceId,
          phone: cleanPhone,
          message: trimmedMessage,
        }),
      });
      const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo enviar el mensaje de prueba.');
      }

      setSendSuccessMsg(`Mensaje enviado correctamente a ${cleanPhone}.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al enviar el mensaje de prueba.';
      setSendErrorMsg(message);
    } finally {
      setIsSending(false);
    }
  };

  const handleAnalyzeThread = async (thread: WhatsAppConversationThread) => {
    const { threadKey } = thread;
    if (analyzingThreadKeys[threadKey]) return;

    setAnalyzingThreadKeys((prev) => ({ ...prev, [threadKey]: true }));
    setAnalysisErrorByThreadKey((prev) => {
      const next = { ...prev };
      delete next[threadKey];
      return next;
    });

    try {
      const headers = await getAuthHeaders(true);
      const res = await fetch('/api/whatsapp/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          phone: thread.phone,
          pushName: thread.pushName,
          messages: thread.messages.map((m) => ({
            text: m.text,
            mediaType: m.mediaType,
            mimetype: m.mimetype,
            mediaBase64: m.mediaBase64,
            timestamp: m.timestampMs,
          })),
        }),
      });

      const rawBody = await res.text().catch(() => '');
      let data: {
        ok?: boolean;
        analysis?: Partial<WhatsAppAnalysisResult>;
        resumen?: string;
        tramite?: string;
        partes?: WhatsAppExtractedParty[];
        datosClave?: string[];
        respuestaSugerida?: string;
        error?: string;
        message?: string;
      } = {};

      if (rawBody) {
        try {
          data = JSON.parse(rawBody);
        } catch {
          data = {};
        }
      }

      const rawAnalysis = data.analysis ?? (typeof data.resumen === 'string' ? data : null);

      if (!res.ok || !rawAnalysis) {
        const serverError =
          (typeof data.error === 'string' && data.error.trim()) ||
          (typeof data.message === 'string' && data.message.trim()) ||
          (rawBody.trim() ? rawBody.trim().slice(0, 300) : '') ||
          `Error HTTP ${res.status} al analizar la conversación.`;
        throw new Error(serverError);
      }

      const normalizedAnalysis: WhatsAppAnalysisResult = {
        resumen:
          typeof rawAnalysis.resumen === 'string' && rawAnalysis.resumen.trim()
            ? rawAnalysis.resumen.trim()
            : 'Conversación analizada correctamente.',
        tramite:
          typeof rawAnalysis.tramite === 'string' && rawAnalysis.tramite.trim()
            ? rawAnalysis.tramite.trim()
            : 'Consulta notarial',
        partes: Array.isArray(rawAnalysis.partes)
          ? rawAnalysis.partes.map((p) => ({
              rol: typeof p?.rol === 'string' && p.rol.trim() ? p.rol.trim() : 'Cliente / Interviniente',
              nombreCompleto: p?.nombreCompleto ?? null,
              documento: p?.documento ?? null,
              direccion: p?.direccion ?? null,
            }))
          : [],
        datosClave: Array.isArray(rawAnalysis.datosClave)
          ? rawAnalysis.datosClave.filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
          : [],
        respuestaSugerida:
          typeof rawAnalysis.respuestaSugerida === 'string' ? rawAnalysis.respuestaSugerida.trim() : '',
      };

      setAnalysisByThreadKey((prev) => ({ ...prev, [threadKey]: normalizedAnalysis }));
      setReplyDraftByThreadKey((prev) => ({
        ...prev,
        [threadKey]: normalizedAnalysis.respuestaSugerida || prev[threadKey] || '',
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al analizar la conversación.';
      setAnalysisErrorByThreadKey((prev) => ({ ...prev, [threadKey]: message }));
    } finally {
      setAnalyzingThreadKeys((prev) => ({ ...prev, [threadKey]: false }));
    }
  };

  const handleSavePartyToFichero = async (
    thread: WhatsAppConversationThread,
    party: WhatsAppExtractedParty,
    partKey: string,
    tramite: string,
    totalPartes: number
  ) => {
    if (!workspaceId || savingPartyKeys[partKey]) return;
    if (!party.nombreCompleto && !party.documento) return;

    setSavingPartyKeys((prev) => ({ ...prev, [partKey]: true }));
    setSavedPartyStatusByKey((prev) => {
      const next = { ...prev };
      delete next[partKey];
      return next;
    });

    try {
      const uid = String(auth?.currentUser?.uid || workspaceId).trim();
      const nombreBruto = (party.nombreCompleto || thread.pushName || 'Cliente WhatsApp').trim();
      const docBruto = (party.documento || '').trim();
      const domicilioBruto = (party.direccion || '').trim();
      const telefonoRemitente = thread.phone ? thread.phone.trim() : '';
      const asignarTelefono = totalPartes <= 1 ? telefonoRemitente : '';

      const docDigits = docBruto.replace(/\D/g, '');
      const esJuridica =
        docDigits.startsWith('800') ||
        /(S\.?A\.?|S\.?R\.?L\.?|S\.?A\.?E\.?C\.?A\.?|E\.?A\.?S\.?|EMPRESA|CONSTRUCTORA|IMPORTADORA|SOCIEDAD)/i.test(
          nombreBruto
        );
      const tipoPersona: TipoPersona = esJuridica ? 'jurídica' : 'física';
      const tipoDocumento: TipoDocumento =
        docBruto.includes('-') || esJuridica ? 'RUC' : 'CI';

      let nombreParte = nombreBruto;
      let apellidoParte = '';
      if (tipoPersona === 'física') {
        const partes = nombreBruto.split(/\s+/).filter(Boolean);
        if (partes.length > 2) {
          nombreParte = partes.slice(0, 2).join(' ');
          apellidoParte = partes.slice(2).join(' ');
        } else if (partes.length === 2) {
          nombreParte = partes[0];
          apellidoParte = partes[1];
        }
      }

      const docFormateado =
        tipoDocumento === 'RUC' && docBruto
          ? formatearRUCConDV(docBruto) || docBruto
          : docBruto;

      const existentes = await fetchPersonasFromFirestore(workspaceId);
      const existente = buscarPersonaDuplicada(
        {
          nro_documento: docFormateado,
          nombre: nombreParte,
          apellido: apellidoParte,
        },
        existentes
      );

      const notaIngreso = `Registrado desde WhatsApp IA (${new Date().toLocaleDateString('es-PY')}) · Rol: ${party.rol} · Trámite: ${tramite} · Teléfono remitente: ${telefonoRemitente || 'N/D'}.`;

      let personaFinal: Persona;
      let statusMessage = 'Guardado en el Fichero de Personas.';

      if (existente) {
        const notasPrevias = (existente.notas_notariales || '').trim();
        const mergedNotas = notasPrevias
          ? `${notasPrevias}\n${notaIngreso}`
          : notaIngreso;

        personaFinal = normalizePersona(
          {
            ...existente,
            telefono: existente.telefono || asignarTelefono,
            domicilio: existente.domicilio || domicilioBruto,
            nro_documento: existente.nro_documento || docFormateado,
            documento_numero: existente.documento_numero || docFormateado,
            notas_notariales: mergedNotas,
            ownedByWorkspace: existente.ownedByWorkspace || workspaceId,
            userId: existente.userId || uid,
          },
          existente.id
        );
        statusMessage = 'Cliente existente actualizado en el Fichero de Personas.';
      } else {
        const nuevoId = `p-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        personaFinal = normalizePersona(
          {
            id: nuevoId,
            tipo_persona: tipoPersona,
            nombre: nombreParte,
            apellido: apellidoParte,
            nombre_o_razon_social: nombreBruto,
            tipo_documento: tipoDocumento,
            nro_documento: docFormateado,
            documento_numero: docFormateado,
            domicilio: domicilioBruto,
            telefono: asignarTelefono,
            email: '',
            representante_id: '',
            representanteLegal: tipoPersona === 'física' ? 'No aplica' : 'Sin Asignar',
            responsable: null,
            ownedByWorkspace: workspaceId,
            userId: uid,
            createdBy: uid,
            creator_id: uid,
            origen: 'WHATSAPP_IA',
            notas_notariales: notaIngreso,
          },
          nuevoId
        );
      }

      await syncPersonaToFirestore(workspaceId, personaFinal);

      // Sincronizar copia local para actualización inmediata en módulos del navegador
      try {
        const storageKey = `olga_directorio_personas_${workspaceId}`;
        const rawLocal = localStorage.getItem(storageKey);
        const listaLocal: Persona[] = rawLocal ? JSON.parse(rawLocal) : [];
        const filtrada = Array.isArray(listaLocal)
          ? listaLocal.filter((p) => p.id !== personaFinal.id)
          : [];
        const actualizada = [personaFinal, ...filtrada];
        localStorage.setItem(storageKey, JSON.stringify(actualizada));
        window.dispatchEvent(new CustomEvent('olga_personas_updated', { detail: actualizada }));
      } catch {
        // Ignorar errores de cuota de almacenamiento local
      }

      setSavedPartyStatusByKey((prev) => ({
        ...prev,
        [partKey]: { kind: 'success', message: statusMessage },
      }));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'No se pudo guardar la persona en el Fichero.';
      setSavedPartyStatusByKey((prev) => ({
        ...prev,
        [partKey]: { kind: 'error', message },
      }));
    } finally {
      setSavingPartyKeys((prev) => ({ ...prev, [partKey]: false }));
    }
  };

  const handleSendThreadReply = async (thread: WhatsAppConversationThread) => {
    const { threadKey } = thread;
    if (!workspaceId || sendingReplyThreadKeys[threadKey]) return;

    const draft = (replyDraftByThreadKey[threadKey] ?? '').trim();
    const targetPhone = thread.phone.replace(/[^\d+]/g, '').trim();
    const targetJid = thread.jid ? thread.jid.trim() : '';

    if (!targetJid && (!targetPhone || targetPhone.length < 7)) {
      setReplyStatusByThreadKey((prev) => ({
        ...prev,
        [threadKey]: {
          kind: 'error',
          message: 'La conversación no tiene un número de teléfono o JID válido.',
        },
      }));
      return;
    }

    if (!draft) {
      setReplyStatusByThreadKey((prev) => ({
        ...prev,
        [threadKey]: { kind: 'error', message: 'Escribe una respuesta antes de enviar.' },
      }));
      return;
    }

    setSendingReplyThreadKeys((prev) => ({ ...prev, [threadKey]: true }));
    setReplyStatusByThreadKey((prev) => {
      const next = { ...prev };
      delete next[threadKey];
      return next;
    });

    try {
      const headers = await getAuthHeaders(true);
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          workspaceId,
          phone: targetPhone,
          ...(targetJid ? { jid: targetJid } : {}),
          message: draft,
        }),
      });
      const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo enviar la respuesta por WhatsApp.');
      }

      setReplyStatusByThreadKey((prev) => ({
        ...prev,
        [threadKey]: {
          kind: 'success',
          message: `Respuesta enviada a ${targetPhone || targetJid}.`,
        },
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al enviar la respuesta.';
      setReplyStatusByThreadKey((prev) => ({
        ...prev,
        [threadKey]: { kind: 'error', message },
      }));
    } finally {
      setSendingReplyThreadKeys((prev) => ({ ...prev, [threadKey]: false }));
    }
  };

  const handleGenerateContractForThread = async (
    thread: WhatsAppConversationThread,
    analysis: WhatsAppAnalysisResult
  ) => {
    const { threadKey } = thread;
    if (!workspaceId || generatingContractThreadKeys[threadKey]) return;

    setGeneratingContractThreadKeys((prev) => ({ ...prev, [threadKey]: true }));
    setContractErrorByThreadKey((prev) => {
      const next = { ...prev };
      delete next[threadKey];
      return next;
    });
    setPdfSendStatusByThreadKey((prev) => {
      const next = { ...prev };
      delete next[threadKey];
      return next;
    });

    try {
      const headers = await getAuthHeaders(true);
      const res = await fetch('/api/whatsapp/generate-contract', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          tramite: analysis.tramite,
          resumen: analysis.resumen,
          partes: analysis.partes,
          datosClave: analysis.datosClave,
          escribania,
        }),
      });

      const rawBody = await res.text().catch(() => '');
      let data: {
        ok?: boolean;
        titulo?: string;
        categoria?: string;
        texto?: string;
        error?: string;
        message?: string;
      } = {};
      if (rawBody) {
        try {
          data = JSON.parse(rawBody);
        } catch {
          data = {};
        }
      }

      if (!res.ok || !data.texto) {
        const serverError =
          (typeof data.error === 'string' && data.error.trim()) ||
          (typeof data.message === 'string' && data.message.trim()) ||
          (rawBody.trim() ? rawBody.trim().slice(0, 300) : '') ||
          `Error HTTP ${res.status} al redactar el documento.`;
        throw new Error(serverError);
      }

      const titulo = (data.titulo || analysis.tramite || 'Contrato Privado').trim();
      const categoria = (data.categoria || 'Contratos Privados').trim();
      const texto = data.texto.trim();

      const currentAuthUser = auth?.currentUser;
      const docRef = await addDoc(collection(db, 'documentos_olga'), {
        userId: workspaceId,
        tipo: titulo,
        categoria,
        texto,
        tipoHoja: 'blanca',
        tipoPapel: 'blanco',
        modoImpresion: 'simple',
        createdAt: new Date().toISOString(),
        fechaCreacion: serverTimestamp(),
        origen: 'whatsapp_ia',
        ...(currentAuthUser?.uid
          ? {
              creator_id: currentAuthUser.uid,
              createdBy: currentAuthUser.uid,
              creator_name:
                currentAuthUser.displayName ||
                currentAuthUser.email?.split('@')[0] ||
                'Usuario',
            }
          : {}),
      });

      setGeneratedContractByThreadKey((prev) => ({
        ...prev,
        [threadKey]: {
          docId: docRef.id,
          titulo,
          categoria,
          texto,
        },
      }));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'No se pudo redactar o guardar el documento.';
      setContractErrorByThreadKey((prev) => ({ ...prev, [threadKey]: message }));
    } finally {
      setGeneratingContractThreadKeys((prev) => ({ ...prev, [threadKey]: false }));
    }
  };

  const handleSendContractPdf = async (
    thread: WhatsAppConversationThread,
    contract: WhatsAppGeneratedContract
  ) => {
    const { threadKey } = thread;
    if (!workspaceId || sendingPdfThreadKeys[threadKey]) return;

    const targetPhone = thread.phone.replace(/[^\d+]/g, '').trim();
    const targetJid = thread.jid ? thread.jid.trim() : '';

    if (!targetJid && (!targetPhone || targetPhone.length < 7)) {
      setPdfSendStatusByThreadKey((prev) => ({
        ...prev,
        [threadKey]: {
          kind: 'error',
          message: 'La conversación no tiene un número o JID válido para enviar el PDF.',
        },
      }));
      return;
    }

    setSendingPdfThreadKeys((prev) => ({ ...prev, [threadKey]: true }));
    setPdfSendStatusByThreadKey((prev) => {
      const next = { ...prev };
      delete next[threadKey];
      return next;
    });

    try {
      const pdfResult = generateDocumentPdfBase64({
        title: contract.titulo,
        content: contract.texto,
        escribania,
      });

      const caption = buildWhatsAppDocumentMessage(contract.titulo, escribania?.nombre);
      const headers = await getAuthHeaders(true);
      const res = await fetch('/api/whatsapp/send-document', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          workspaceId,
          phone: targetPhone,
          ...(targetJid ? { jid: targetJid } : {}),
          fileBase64: pdfResult.fileBase64,
          fileName: pdfResult.fileName,
          mimetype: 'application/pdf',
          caption,
        }),
      });

      const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo enviar el borrador PDF por WhatsApp.');
      }

      setPdfSendStatusByThreadKey((prev) => ({
        ...prev,
        [threadKey]: {
          kind: 'success',
          message: `Borrador PDF (${pdfResult.fileName}) enviado a ${targetPhone || targetJid}.`,
        },
      }));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Error al generar o enviar el PDF por WhatsApp.';
      setPdfSendStatusByThreadKey((prev) => ({
        ...prev,
        [threadKey]: { kind: 'error', message },
      }));
    } finally {
      setSendingPdfThreadKeys((prev) => ({ ...prev, [threadKey]: false }));
    }
  };

  const isWaitingScan = status === 'qr_ready' || status === 'connecting';
  const formattedConnectedPhone = linkedPhone
    ? linkedPhone.startsWith('+')
      ? linkedPhone
      : `+${linkedPhone.replace(/^\+/, '')}`
    : 'Sesión activa';

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5 animate-fade-in overflow-x-hidden">
      {/* Cabecera compacta cuando está conectado; cabecera completa en QR / desconectado / carga */}
      {!isInitialLoading && status === 'connected' ? (
        <div className="space-y-3">
          <div
            className={`rounded-2xl px-4 py-3 border transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
              esPlanFull
                ? 'bg-white dark:bg-[#121824]/90 border-amber-200/70 dark:border-amber-500/30 shadow-sm'
                : 'bg-white dark:bg-[#121824]/90 border-slate-200 dark:border-slate-800 shadow-sm'
            }`}
          >
            <div className="flex flex-wrap items-center gap-2.5 min-w-0">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                <span>Conectado: {formattedConnectedPhone}</span>
              </span>
              <span className="hidden md:inline-flex items-center text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums truncate">
                Workspace {workspaceId || '—'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowConnectionPanel((prev) => !prev)}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                  showConnectionPanel
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                    : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Prueba rápida / Conexión</span>
                {showConnectionPanel ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  fetchStatus(false);
                  fetchInbox(false);
                }}
                disabled={isRefreshing || isRefreshingInbox || !workspaceId}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRefreshing || isRefreshingInbox ? 'animate-spin' : ''}`}
                />
                <span>Actualizar</span>
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 flex items-start gap-3 text-xs text-red-800 dark:text-red-200">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold">Error de conexión WhatsApp</p>
                <p className="mt-0.5 opacity-90">{errorMsg}</p>
              </div>
              <button
                type="button"
                onClick={() => fetchStatus(false)}
                className="px-2.5 py-1 rounded-lg font-semibold bg-white dark:bg-slate-900 border border-red-200 dark:border-red-500/40 text-red-700 dark:text-red-300 hover:bg-red-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          className={`rounded-2xl p-6 md:p-7 border transition-colors ${
            esPlanFull
              ? 'bg-white dark:bg-[#121824]/90 border-amber-200/70 dark:border-amber-500/30 shadow-sm'
              : 'bg-white dark:bg-[#121824]/90 border-slate-200 dark:border-slate-800 shadow-sm'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4 min-w-0">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                  esPlanFull
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-amber-300/70 dark:border-amber-500/40 text-emerald-600 dark:text-emerald-400'
                    : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                <MessageCircle className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    Conexión WhatsApp Institucional
                  </h2>
                  {isWaitingScan ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 whitespace-nowrap">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Esperando vinculación QR</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                      <Unplug className="w-3.5 h-3.5" />
                      <span>Desconectado</span>
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Vincula el número de tu escribanía para notificaciones, recepción en vivo y análisis notarial · Workspace{' '}
                  <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {workspaceId || '—'}
                  </span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fetchStatus(false)}
              disabled={isRefreshing || isInitialLoading || !workspaceId}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Actualizar estado</span>
            </button>
          </div>

          {errorMsg && (
            <div className="mt-5 p-4 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 flex items-start gap-3 text-sm text-red-800 dark:text-red-200">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold">No se pudo completar la operación</p>
                <p className="text-xs mt-0.5 opacity-90">{errorMsg}</p>
              </div>
              <button
                type="button"
                onClick={() => fetchStatus(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-red-200 dark:border-red-500/40 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Barra compacta de Configuración Avanzada de Respuesta Automática */}
      {!isInitialLoading && workspaceId && (
        <div
          className={`rounded-2xl px-4 py-2.5 border transition-colors space-y-3 ${
            esPlanFull
              ? 'bg-white dark:bg-[#121824]/90 border-amber-200/70 dark:border-amber-500/30 shadow-xs'
              : 'bg-white dark:bg-[#121824]/90 border-slate-200 dark:border-slate-800 shadow-xs'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={autoReplyEnabled}
                disabled={isSavingWaConfig}
                onClick={() => handleToggleAutoReply()}
                className="inline-flex items-center gap-2.5 cursor-pointer disabled:opacity-60"
              >
                <span
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
                    autoReplyEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                      autoReplyEnabled ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
                    }`}
                  />
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                  <Bot className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Respuesta automática por ausencia ({delayMinutesLabel} min)</span>
                </span>
              </button>

              {waConfigFeedback && (
                <span
                  className={`text-[11px] font-semibold ${
                    waConfigFeedback.kind === 'success'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {waConfigFeedback.text}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {excludedJids.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowExcludedPanel((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    showExcludedPanel
                      ? 'bg-slate-900 dark:bg-slate-700 border-slate-900 dark:border-slate-600 text-white'
                      : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title="Ver y restaurar contactos marcados como chat personal"
                >
                  <span>👤 Personales ({excludedJids.length})</span>
                  {showExcludedPanel ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowConfigMessageBox((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  showConfigMessageBox
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                    : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>⚙️ Configurar O.L.G.A.</span>
                {showConfigMessageBox ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {showExcludedPanel && excludedJids.length > 0 && (
            <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Chats personales excluidos de O.L.G.A. (siguen activos normalmente en tu WhatsApp)
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {excludedJids.map((jid) => {
                  const isRestoring = mutingJidKey === jid;
                  return (
                    <div
                      key={jid}
                      className="inline-flex items-center gap-2 pl-2.5 pr-1.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F17] text-xs"
                    >
                      <span
                        className="font-mono tabular-nums text-slate-700 dark:text-slate-200 font-medium"
                        title={jid}
                      >
                        {formatExcludedJidLabel(jid)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRestoreExcludedJid(jid)}
                        disabled={Boolean(mutingJidKey)}
                        className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/15 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {isRestoring ? 'Restaurando...' : 'Restaurar'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {showConfigMessageBox && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-4">
              {/* Selector visual: Recepcionista IA vs Mensaje Fijo */}
              <div className="w-full p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F17]/70 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    💬 ¿Cómo debe responder O.L.G.A.?
                  </h4>
                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Modo activo:{' '}
                    <strong className="text-emerald-700 dark:text-emerald-300">
                      {aiReceptionistEnabled ? 'Recepcionista IA' : 'Mensaje Fijo'}
                    </strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Opción A: Recepcionista IA */}
                  <button
                    type="button"
                    aria-pressed={aiReceptionistEnabled}
                    disabled={isSavingWaConfig}
                    onClick={() => setAiReceptionistEnabled(true)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer disabled:opacity-60 flex flex-col justify-between gap-2 ${
                      aiReceptionistEnabled
                        ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-500/15 ring-1 ring-emerald-500/30 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/90 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                          🤖 Recepcionista IA
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/25 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-500/40 whitespace-nowrap">
                          Recomendado
                        </span>
                      </div>
                      {aiReceptionistEnabled && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Activo</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Lee lo que escribió el cliente y responde de forma natural como una secretaria real (sin inventar precios ni turnos).
                    </p>
                  </button>

                  {/* Opción B: Mensaje Fijo */}
                  <button
                    type="button"
                    aria-pressed={!aiReceptionistEnabled}
                    disabled={isSavingWaConfig}
                    onClick={() => setAiReceptionistEnabled(false)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer disabled:opacity-60 flex flex-col justify-between gap-2 ${
                      !aiReceptionistEnabled
                        ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-500/15 ring-1 ring-emerald-500/30 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/90 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        📝 Mensaje Fijo (Manual)
                      </span>
                      {!aiReceptionistEnabled && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Activo</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      Envía siempre el texto exacto que escribas en la caja de abajo, sin usar inteligencia artificial.
                    </p>
                  </button>
                </div>
              </div>

              {/* 1. Delay y 2. Frecuencia anti-spam */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F17]/70 space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                    <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>1. Tiempo de espera (Delay)</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {DELAY_OPTIONS.map((opt) => {
                      const active = delaySeconds === opt.seconds;
                      return (
                        <button
                          key={opt.seconds}
                          type="button"
                          disabled={isSavingWaConfig}
                          onClick={() => setDelaySeconds(opt.seconds)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer disabled:opacity-60 ${
                            active
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F17]/70 space-y-1.5">
                  <label
                    htmlFor="wa-cooldown-select"
                    className="block text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    2. Frecuencia anti-spam (Cooldown por cliente)
                  </label>
                  <select
                    id="wa-cooldown-select"
                    value={cooldownMinutes}
                    disabled={isSavingWaConfig}
                    onChange={(e) => setCooldownMinutes(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    {COOLDOWN_OPTIONS.map((opt) => (
                      <option key={opt.minutes} value={opt.minutes}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Evita repetir el mensaje automático al mismo cliente en ese lapso.
                  </p>
                </div>
              </div>

              {/* 3. Horario de atención (Hora Paraguay) */}
              <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F17]/70 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    3. Horario de atención (Hora Paraguay)
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={businessHoursEnabled}
                    disabled={isSavingWaConfig}
                    onClick={() => setBusinessHoursEnabled((prev) => !prev)}
                    className="inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    <span
                      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
                        businessHoursEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                          businessHoursEnabled ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
                        }`}
                      />
                    </span>
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {businessHoursEnabled ? 'Activo' : 'Inactivo'}
                    </span>
                  </button>
                </div>

                {businessHoursEnabled && (
                  <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        <span>Inicio:</span>
                        <input
                          type="time"
                          value={businessStart}
                          disabled={isSavingWaConfig}
                          onChange={(e) => setBusinessStart(e.target.value)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono tabular-nums text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        <span>Fin:</span>
                        <input
                          type="time"
                          value={businessEnd}
                          disabled={isSavingWaConfig}
                          onChange={(e) => setBusinessEnd(e.target.value)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono tabular-nums text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                        />
                      </label>
                    </div>

                    {aiReceptionistEnabled ? (
                      <div className="space-y-1.5 pt-0.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            Mensaje de respaldo (solo se envía si la IA no logra responder en 8 segundos)
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowFallbackMessages((prev) => !prev)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
                          >
                            <span>{showFallbackMessages ? 'Ocultar mensaje de respaldo' : 'Ver mensaje de respaldo'}</span>
                            {showFallbackMessages ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        {showFallbackMessages && (
                          <div className="space-y-1">
                            <label
                              htmlFor="wa-after-hours-msg"
                              className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300"
                            >
                              Mensaje fuera de horario (respaldo)
                            </label>
                            <textarea
                              id="wa-after-hours-msg"
                              rows={2}
                              value={afterHoursMessage}
                              onChange={(e) => setAfterHoursMessage(e.target.value)}
                              disabled={isSavingWaConfig}
                              placeholder="Mensaje de respaldo cuando el cliente escriba fuera del horario configurado..."
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-y"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <label
                          htmlFor="wa-after-hours-msg"
                          className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300"
                        >
                          Mensaje fuera de horario
                        </label>
                        <textarea
                          id="wa-after-hours-msg"
                          rows={2}
                          value={afterHoursMessage}
                          onChange={(e) => setAfterHoursMessage(e.target.value)}
                          disabled={isSavingWaConfig}
                          placeholder="Mensaje que enviará O.L.G.A. cuando el cliente escriba fuera del horario configurado..."
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-y"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 4. Mensaje de ausencia habitual y 5. Confirmación de Documentos / Cédulas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F17]/70 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label
                      htmlFor="wa-auto-reply-msg"
                      className="block text-xs font-bold text-slate-800 dark:text-slate-100"
                    >
                      4. Mensaje de ausencia habitual
                    </label>
                    {aiReceptionistEnabled && (
                      <button
                        type="button"
                        onClick={() => setShowFallbackMessages((prev) => !prev)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
                      >
                        <span>{showFallbackMessages ? 'Ocultar mensaje de respaldo' : 'Ver mensaje de respaldo'}</span>
                        {showFallbackMessages ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  {aiReceptionistEnabled ? (
                    <>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        Mensaje de respaldo (solo se envía si la IA no logra responder en 8 segundos)
                      </p>
                      {showFallbackMessages && (
                        <textarea
                          id="wa-auto-reply-msg"
                          rows={3}
                          value={autoReplyMessage}
                          onChange={(e) => setAutoReplyMessage(e.target.value)}
                          disabled={isSavingWaConfig}
                          placeholder={`Escribe el mensaje de respaldo que enviará O.L.G.A. tras ${delayMinutesLabel} min si la IA no responde...`}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-y"
                        />
                      )}
                    </>
                  ) : (
                    <textarea
                      id="wa-auto-reply-msg"
                      rows={3}
                      value={autoReplyMessage}
                      onChange={(e) => setAutoReplyMessage(e.target.value)}
                      disabled={isSavingWaConfig}
                      placeholder={`Escribe el mensaje automático que enviará O.L.G.A. tras ${delayMinutesLabel} min de ausencia...`}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-y"
                    />
                  )}
                </div>

                <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F17]/70 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label
                      htmlFor="wa-media-reply-msg"
                      className="text-xs font-bold text-slate-800 dark:text-slate-100"
                    >
                      5. Confirmación de Documentos / Cédulas
                    </label>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={mediaReplyEnabled}
                      disabled={isSavingWaConfig}
                      onClick={() => setMediaReplyEnabled((prev) => !prev)}
                      className="inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      <span
                        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
                          mediaReplyEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                            mediaReplyEnabled ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
                          }`}
                        />
                      </span>
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        {mediaReplyEnabled ? 'Activo' : 'Inactivo'}
                      </span>
                    </button>
                  </div>
                  <textarea
                    id="wa-media-reply-msg"
                    rows={3}
                    value={mediaReplyMessage}
                    onChange={(e) => setMediaReplyMessage(e.target.value)}
                    disabled={isSavingWaConfig}
                    placeholder="Mensaje de acuse de recibo para cédulas, fotos o documentos PDF..."
                    className={`w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-y ${
                      mediaReplyEnabled ? '' : 'opacity-70'
                    }`}
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Se envía automáticamente si el cliente adjuntó una foto o PDF
                  </p>
                </div>
              </div>

              {/* 6. Tarjeta Filtro Solo Trabajo (Protección para Número Personal) */}
              <div className="w-full p-3.5 sm:p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-500/30 bg-emerald-50/40 dark:bg-[#0B0F17]/80 space-y-4">
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>🛡️ Filtro Solo Trabajo (Protección para Número Personal)</span>
                    </h4>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    Evita que O.L.G.A. le responda a familiares, amigos o grupos. Solo se activa cuando detecta una consulta de trabajo o un archivo PDF/Word.
                  </p>
                </div>

                {/* Switches principal y secundario */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      Activar Filtro Solo Trabajo
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={workFilterEnabled}
                      disabled={isSavingWaConfig}
                      onClick={() => setWorkFilterEnabled((prev) => !prev)}
                      className="inline-flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-60"
                    >
                      <span
                        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
                          workFilterEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                            workFilterEnabled ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
                          }`}
                        />
                      </span>
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        {workFilterEnabled ? 'Activo' : 'Inactivo'}
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      Aceptar siempre documentos PDF y Word
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={allowDocuments}
                      disabled={isSavingWaConfig}
                      onClick={() => setAllowDocuments((prev) => !prev)}
                      className="inline-flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-60"
                    >
                      <span
                        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
                          allowDocuments ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
                            allowDocuments ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
                          }`}
                        />
                      </span>
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        {allowDocuments ? 'Activo' : 'Inactivo'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Editor visual de Palabras Clave */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      Palabras clave de trabajo ({workKeywords.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleRestoreSuggestedKeywords}
                      disabled={isSavingWaConfig}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restaurar sugeridas</span>
                    </button>
                  </div>

                  {/* Chips activos */}
                  <div className="flex flex-wrap gap-1.5">
                    {workKeywords.length === 0 ? (
                      <span className="text-[11px] italic text-slate-500 dark:text-slate-400">
                        Sin palabras clave cargadas. Agrega una abajo o usa «Restaurar sugeridas».
                      </span>
                    ) : (
                      workKeywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-semibold bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-500/40 text-slate-800 dark:text-slate-100 shadow-2xs max-w-full"
                        >
                          <span className="truncate">{keyword}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveWorkKeyword(keyword)}
                            disabled={isSavingWaConfig}
                            aria-label={`Quitar palabra clave ${keyword}`}
                            className="p-0.5 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/15 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  {/* Input para agregar nueva palabra */}
                  <div className="flex flex-col sm:flex-row gap-2 w-full">
                    <input
                      type="text"
                      value={newKeywordInput}
                      disabled={isSavingWaConfig}
                      onChange={(e) => setNewKeywordInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddWorkKeyword();
                        }
                      }}
                      placeholder={esAbogado ? 'Ej: apelación, amparo...' : 'Ej: sucesión, hipoteca...'}
                      className="w-full flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                    <button
                      type="button"
                      onClick={handleAddWorkKeyword}
                      disabled={isSavingWaConfig || !newKeywordInput.trim()}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white transition-colors cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap"
                    >
                      <span>+ Agregar</span>
                    </button>
                  </div>
                </div>

                {/* Mini Probador en Vivo */}
                <div className="pt-3 border-t border-emerald-200/70 dark:border-slate-800 space-y-2">
                  <label
                    htmlFor="wa-work-filter-tester"
                    className="block text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    Prueba un mensaje aquí para ver qué haría O.L.G.A.:
                  </label>
                  <input
                    id="wa-work-filter-tester"
                    type="text"
                    value={liveTestMessage}
                    onChange={(e) => setLiveTestMessage(e.target.value)}
                    placeholder={
                      esAbogado
                        ? 'Ej: Hola doctor, recibí una cédula de notificación de demanda o vamos al asado?'
                        : 'Ej: Hola, cuánto sale una certificación de firma o vamos al asado?'
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                  {liveTestMessage.trim().length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {liveTestMatchedKeyword ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-500/40">
                          ✅ O.L.G.A. intervendría (Consulta de trabajo)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                          🔇 O.L.G.A. lo ignoraría (Charla personal / ruido)
                        </span>
                      )}
                      {liveTestMatchedKeyword && (
                        <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                          Coincidencia: «{liveTestMatchedKeyword}»
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 7. Botón Guardar configuración */}
              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                {waConfigSavedBadge && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                    ✓ Guardado
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowConfigMessageBox(false)}
                  disabled={isSavingWaConfig}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveAdvancedConfig()}
                  disabled={isSavingWaConfig}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer disabled:opacity-60 shadow-xs"
                >
                  {isSavingWaConfig ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Guardar configuración</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Contenido principal según estado */}
      {isInitialLoading ? (
        <div className="rounded-2xl p-12 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121824]/90 shadow-sm flex flex-col items-center justify-center text-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Consultando estado de la sesión de WhatsApp...
          </p>
        </div>
      ) : status === 'connected' ? (
        <>
          {showConnectionPanel && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Estado de sesión vinculada y reconexión */}
              <div className="lg:col-span-5 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121824]/90 shadow-sm flex flex-col justify-between gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        🟢 WhatsApp Conectado
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Sesión activa y lista para envíos y recepción
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Número vinculado
                      </p>
                      <p className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                        {formattedConnectedPhone}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Identificador de espacio
                      </p>
                      <p className="mt-0.5 text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300 break-all">
                        {workspaceId}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Sincronización activa con O.L.G.A.
                  </span>
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={isConnecting || !workspaceId}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
                  >
                    {isConnecting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <QrCode className="w-3.5 h-3.5" />
                    )}
                    <span>Reconectar / QR</span>
                  </button>
                </div>
              </div>

              {/* Formulario de Prueba rápida de envío */}
              <div className="lg:col-span-7 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121824]/90 shadow-sm">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 shrink-0">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Prueba rápida de envío
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Verifica la salida de mensajes directamente desde tu número vinculado
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSendTestMessage} className="mt-5 space-y-4">
                  <div>
                    <label
                      htmlFor="wa-test-phone"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Teléfono de destino
                    </label>
                    <input
                      id="wa-test-phone"
                      type="tel"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="595981123456"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F17] text-sm font-mono tabular-nums text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-colors"
                      required
                    />
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      Incluye el código de país sin signos ni espacios (ej. 595981123456).
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="wa-test-message"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Mensaje
                    </label>
                    <textarea
                      id="wa-test-message"
                      rows={3}
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      placeholder="Escribe el texto de prueba..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F17] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-colors resize-y"
                      required
                    />
                  </div>

                  {sendErrorMsg && (
                    <div className="p-3 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 flex items-center gap-2.5 text-xs text-red-800 dark:text-red-200">
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                      <span>{sendErrorMsg}</span>
                    </div>
                  )}

                  {sendSuccessMsg && (
                    <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 flex items-center gap-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{sendSuccessMsg}</span>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isSending}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors disabled:opacity-60 whitespace-nowrap cursor-pointer"
                    >
                      {isSending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Enviar mensaje de prueba</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Bandeja de Entrada Inteligente (En Vivo) */}
          <section className="rounded-2xl p-6 md:p-7 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121824]/90 shadow-sm space-y-5">
            <div className="flex flex-col gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Inbox className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                      Bandeja de Entrada Inteligente (En Vivo)
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      <span>Actualización automática cada 5 s</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {conversationThreads.length}{' '}
                        {conversationThreads.length === 1 ? 'conversación' : 'conversaciones'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {inboxMessages.length}{' '}
                        {inboxMessages.length === 1 ? 'mensaje' : 'mensajes'}
                      </span>
                      {lastInboxSyncAt && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            Última sync {new Date(lastInboxSyncAt).toLocaleTimeString('es-PY')}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                      💡 Usa «Chat personal» en familiares o amigos para ocultarlos de O.L.G.A. y evitar respuestas automáticas (no bloquea el contacto en tu WhatsApp).
                    </p>
                  </div>
                </div>

                {/* Pestañas de filtro: Pendientes / Atendidos */}
                <div className="inline-flex items-center p-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-[#0B0F17] self-start sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setInboxFilterTab('pending')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      inboxFilterTab === 'pending'
                        ? 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 shadow-xs border border-slate-200/80 dark:border-slate-700'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>Pendientes ({pendingThreads.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInboxFilterTab('attended')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      inboxFilterTab === 'attended'
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>Atendidos ({attendedThreads.length})</span>
                  </button>
                </div>
              </div>
            </div>

            {inboxError && (
              <div className="p-4 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 flex items-start justify-between gap-3 text-xs text-red-800 dark:text-red-200">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <span>{inboxError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => fetchInbox(false)}
                  className="px-3 py-1 rounded-lg font-semibold bg-white dark:bg-slate-900 border border-red-200 dark:border-red-500/40 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Reintentar
                </button>
              </div>
            )}

            {isLoadingInbox && inboxMessages.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
                <Loader2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400 animate-spin" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Cargando mensajes entrantes de WhatsApp...
                </p>
              </div>
            ) : conversationThreads.length === 0 ? (
              <div className="py-12 px-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-[#0B0F17]/50">
                <Inbox className="w-8 h-8 text-slate-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  No hay mensajes entrantes todavía
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  Cuando los clientes envíen textos, fotos de Cédula/RUC, documentos PDF o notas de voz a tu línea vinculada, aparecerán agrupados por conversación aquí.
                </p>
              </div>
            ) : visibleThreads.length === 0 ? (
              <div className="py-12 px-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-[#0B0F17]/50 space-y-2.5">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {inboxFilterTab === 'pending'
                    ? 'No tienes conversaciones pendientes por atender'
                    : 'No hay conversaciones marcadas como atendidas'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  {inboxFilterTab === 'pending'
                    ? 'Si un cliente atendido envía un nuevo mensaje, volverá automáticamente a esta bandeja.'
                    : 'Usa el botón "✓ Marcar atendido" en cualquier hilo de Pendientes para archivarlo aquí.'}
                </p>
                {inboxFilterTab === 'pending' && attendedThreads.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setInboxFilterTab('attended')}
                    className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <span>Ver atendidos ({attendedThreads.length})</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                {visibleThreads.map((thread) => {
                  const { threadKey } = thread;
                  const isAnalyzing = Boolean(analyzingThreadKeys[threadKey]);
                  const analysis = analysisByThreadKey[threadKey];
                  const analysisError = analysisErrorByThreadKey[threadKey];
                  const isSendingReply = Boolean(sendingReplyThreadKeys[threadKey]);
                  const replyStatus = replyStatusByThreadKey[threadKey];
                  const replyDraft = replyDraftByThreadKey[threadKey] ?? '';

                  const imageAttachments = thread.messages
                    .map((m) => ({
                      id: m.id,
                      timestampMs: m.timestampMs,
                      src:
                        m.mediaType === 'image'
                          ? normalizeIncomingImageSrc(m.mediaBase64, m.mimetype, m.mediaUrl)
                          : null,
                    }))
                    .filter((item): item is { id: string; timestampMs: number; src: string } => Boolean(item.src));

                  const docAndAudioAttachments = thread.messages.filter(
                    (m) => m.mediaType === 'pdf' || m.mediaType === 'document' || m.mediaType === 'audio'
                  );

                  return (
                    <article
                      key={threadKey}
                      className="rounded-xl p-5 border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#0B0F17]/80 space-y-4"
                    >
                      {/* Cabecera de la conversación */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {thread.pushName}
                            </h4>
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold font-mono tabular-nums bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {thread.messages.length}{' '}
                              {thread.messages.length === 1 ? 'mensaje' : 'mensajes'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                              {thread.phone || thread.jid || 'Contacto sin número visible'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                              <Clock className="w-3 h-3" />
                              <span>Último: {formatMessageDateTime(thread.latestTimestampMs)}</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {inboxFilterTab === 'pending' ? (
                            <button
                              type="button"
                              onClick={() => handleMarkThreadAttended(thread)}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-500/15 hover:text-emerald-700 dark:hover:text-emerald-300 hover:border-emerald-300 dark:hover:border-emerald-500/40 transition-colors whitespace-nowrap cursor-pointer"
                            >
                              <span>✓ Marcar atendido</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleReopenThread(thread)}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-500/15 hover:text-amber-700 dark:hover:text-amber-300 hover:border-amber-300 dark:hover:border-amber-500/40 transition-colors whitespace-nowrap cursor-pointer"
                            >
                              <span>↩ Reabrir</span>
                            </button>
                          )}

                          {(() => {
                            const personalKey = (thread.jid || thread.phone || thread.threadKey).trim();
                            const isConfirmingPersonal = confirmPersonalJid === personalKey;
                            const isMutingThis = mutingJidKey === (thread.jid || thread.phone || '').trim();

                            if (isConfirmingPersonal) {
                              return (
                                <div className="inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10">
                                  <span className="text-[11px] font-semibold text-amber-900 dark:text-amber-200 whitespace-nowrap">
                                    ¿Ocultar en O.L.G.A.?
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleMuteThread(thread)}
                                    disabled={Boolean(mutingJidKey)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition-colors disabled:opacity-60 whitespace-nowrap cursor-pointer"
                                  >
                                    {isMutingThis ? (
                                      <>
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        <span>Ocultando...</span>
                                      </>
                                    ) : (
                                      <span>Sí, es personal</span>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmPersonalJid(null)}
                                    disabled={Boolean(mutingJidKey)}
                                    className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  setMuteErrorByThreadKey((prev) => {
                                    if (!prev[threadKey]) return prev;
                                    const next = { ...prev };
                                    delete next[threadKey];
                                    return next;
                                  });
                                  setConfirmPersonalJid(personalKey);
                                }}
                                disabled={Boolean(mutingJidKey)}
                                title="Ocultar de O.L.G.A. y desactivar IA para este contacto (no bloquea en WhatsApp)"
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
                              >
                                <span>👤 Chat personal</span>
                              </button>
                            );
                          })()}

                          <button
                            type="button"
                            onClick={() => handleAnalyzeThread(thread)}
                            disabled={isAnalyzing}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors disabled:opacity-60 whitespace-nowrap cursor-pointer"
                          >
                            {isAnalyzing ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Analizando conversación...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Analizar Conversación con O.L.G.A. IA</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {muteErrorByThreadKey[threadKey] && (
                        <div className="p-3 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{muteErrorByThreadKey[threadKey]}</span>
                        </div>
                      )}

                      {/* Cuerpo compacto cronológico de textos y adjuntos del cliente */}
                      <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800/80 space-y-3">
                        <div className="space-y-1.5">
                          {thread.messages.map((msg) => {
                            const hasAttachmentLabel =
                              msg.mediaType === 'image' ||
                              msg.mediaType === 'pdf' ||
                              msg.mediaType === 'document' ||
                              msg.mediaType === 'audio';

                            if (!msg.text && !hasAttachmentLabel) return null;

                            return (
                              <div
                                key={msg.id}
                                className="flex items-baseline gap-2.5 text-sm leading-relaxed text-slate-700 dark:text-slate-200"
                              >
                                <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 shrink-0">
                                  {formatCompactMessageTime(msg.timestampMs)}
                                </span>
                                <div className="min-w-0 flex-1 break-words whitespace-pre-wrap">
                                  {msg.text ? (
                                    <span>{msg.text}</span>
                                  ) : (
                                    <span className="text-xs italic text-slate-500 dark:text-slate-400">
                                      {msg.mediaType === 'image'
                                        ? 'Imagen adjunta'
                                        : msg.mediaType === 'audio'
                                          ? 'Nota de voz / Audio adjunto'
                                          : msg.fileName || 'Documento adjunto'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {imageAttachments.length > 0 && (
                          <div className="flex flex-wrap gap-2.5 pt-1">
                            {imageAttachments.map((img, idx) => (
                              <div
                                key={img.id}
                                className="w-36 sm:w-44 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                              >
                                <img
                                  src={img.src}
                                  alt={`Adjunto ${idx + 1} de ${thread.pushName}`}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-28 object-cover bg-slate-100 dark:bg-slate-950"
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {docAndAudioAttachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-0.5">
                            {docAndAudioAttachments.map((att) =>
                              att.mediaType === 'audio' ? (
                                <span
                                  key={att.id}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/10 text-xs font-medium text-amber-800 dark:text-amber-200"
                                >
                                  <Mic className="w-3.5 h-3.5 shrink-0" />
                                  <span>Nota de voz ({formatCompactMessageTime(att.timestampMs)})</span>
                                </span>
                              ) : (
                                <span
                                  key={att.id}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50/70 dark:bg-rose-500/10 text-xs font-medium text-rose-800 dark:text-rose-200"
                                >
                                  <FileText className="w-3.5 h-3.5 shrink-0" />
                                  <span>{att.fileName || 'Documento PDF'}</span>
                                </span>
                              )
                            )}
                          </div>
                        )}
                      </div>

                      {analysisError && (
                        <div className="p-3 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 flex items-center gap-2 text-xs text-red-800 dark:text-red-200">
                          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                          <span>{analysisError}</span>
                        </div>
                      )}

                      {/* Resultado unificado de Gemini para toda la conversación */}
                      {analysis && (
                        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                Trámite detectado
                              </p>
                              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                                {analysis.tramite}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                Resumen unificado
                              </p>
                              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                                {analysis.resumen}
                              </p>
                            </div>
                          </div>

                          {/* Datos clave de la operación */}
                          {analysis.datosClave.length > 0 && (
                            <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800/80 space-y-2">
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                <ListChecks className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Datos clave del trámite</span>
                              </div>
                              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-700 dark:text-slate-200">
                                {analysis.datosClave.map((dato, idx) => (
                                  <li key={`${threadKey}-dato-${idx}`} className="flex items-start gap-2">
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold select-none">
                                      ·
                                    </span>
                                    <span>{dato}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Partes detectadas con guardado individual en Fichero */}
                          {analysis.partes.length > 0 && (
                            <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800/80 space-y-3">
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Partes detectadas ({analysis.partes.length})</span>
                              </div>

                              <div className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
                                {analysis.partes.map((party, idx) => {
                                  const partKey = `${threadKey}::${idx}`;
                                  const isSavingParty = Boolean(savingPartyKeys[partKey]);
                                  const savedPartyStatus = savedPartyStatusByKey[partKey];
                                  const canSaveParty = Boolean(party.nombreCompleto || party.documento);

                                  return (
                                    <div
                                      key={partKey}
                                      className="py-3 first:pt-1 last:pb-1 space-y-2.5"
                                    >
                                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                                        <span className="inline-flex items-center self-start px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                                          {party.rol}
                                        </span>

                                        {canSaveParty && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleSavePartyToFichero(
                                                thread,
                                                party,
                                                partKey,
                                                analysis.tramite,
                                                analysis.partes.length
                                              )
                                            }
                                            disabled={isSavingParty}
                                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border border-emerald-600/30 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 transition-colors disabled:opacity-60 whitespace-nowrap self-start sm:self-auto cursor-pointer"
                                          >
                                            {isSavingParty ? (
                                              <>
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                <span>Guardando...</span>
                                              </>
                                            ) : (
                                              <>
                                                <UserPlus className="w-3.5 h-3.5" />
                                                <span>Guardar en Fichero</span>
                                              </>
                                            )}
                                          </button>
                                        )}
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                        <div className="space-y-0.5">
                                          <span className="inline-flex items-center gap-1 font-semibold text-slate-500 dark:text-slate-400">
                                            <User className="w-3.5 h-3.5" />
                                            <span>Nombre / Razón social</span>
                                          </span>
                                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                                            {party.nombreCompleto || 'No especificado'}
                                          </p>
                                        </div>
                                        <div className="space-y-0.5">
                                          <span className="inline-flex items-center gap-1 font-semibold text-slate-500 dark:text-slate-400">
                                            <CreditCard className="w-3.5 h-3.5" />
                                            <span>C.I. / RUC</span>
                                          </span>
                                          <p className="text-sm font-mono tabular-nums font-medium text-slate-900 dark:text-white">
                                            {party.documento || 'No especificado'}
                                          </p>
                                        </div>
                                        <div className="space-y-0.5">
                                          <span className="inline-flex items-center gap-1 font-semibold text-slate-500 dark:text-slate-400">
                                            <MapPin className="w-3.5 h-3.5" />
                                            <span>Dirección</span>
                                          </span>
                                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                                            {party.direccion || 'No especificada'}
                                          </p>
                                        </div>
                                      </div>

                                      {savedPartyStatus && (
                                        <div
                                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                                            savedPartyStatus.kind === 'success'
                                              ? 'text-emerald-700 dark:text-emerald-400'
                                              : 'text-red-700 dark:text-red-400'
                                          }`}
                                        >
                                          {savedPartyStatus.kind === 'success' ? (
                                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                                          ) : (
                                            <AlertCircle className="w-4 h-4 shrink-0" />
                                          )}
                                          <span>{savedPartyStatus.message}</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Acción de redacción automática de documento legal en Archivo Documental */}
                          <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800/80 space-y-3">
                            {(() => {
                              const isGeneratingContract = Boolean(generatingContractThreadKeys[threadKey]);
                              const contractError = contractErrorByThreadKey[threadKey];
                              const generatedContract = generatedContractByThreadKey[threadKey];
                              const isSendingPdf = Boolean(sendingPdfThreadKeys[threadKey]);
                              const pdfSendStatus = pdfSendStatusByThreadKey[threadKey];
                              const hasContactTarget = Boolean(thread.phone || thread.jid);

                              return (
                                <>
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      Convierte este análisis en un borrador completo listo para editar, imprimir en A4 simple o remitir en PDF.
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => handleGenerateContractForThread(thread, analysis)}
                                      disabled={isGeneratingContract}
                                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-sm transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
                                    >
                                      {isGeneratingContract ? (
                                        <>
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          <span>Redactando documento...</span>
                                        </>
                                      ) : (
                                        <>
                                          <FilePlus2 className="w-3.5 h-3.5" />
                                          <span>✨ Redactar Documento con O.L.G.A. IA</span>
                                        </>
                                      )}
                                    </button>
                                  </div>

                                  {contractError && (
                                    <div className="p-3 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 flex items-center gap-2 text-xs text-red-800 dark:text-red-200">
                                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                                      <span>{contractError}</span>
                                    </div>
                                  )}

                                  {generatedContract && (
                                    <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/90 dark:bg-emerald-500/10 space-y-3">
                                      <div className="flex items-start gap-2.5 text-xs sm:text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                        <span>
                                          ✅ Documento &apos;{generatedContract.titulo}&apos; creado y guardado en Archivo Documental (Carpeta: {generatedContract.categoria})
                                        </span>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-2.5">
                                        <button
                                          type="button"
                                          onClick={() => handleSendContractPdf(thread, generatedContract)}
                                          disabled={isSendingPdf || !hasContactTarget}
                                          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors disabled:opacity-60 whitespace-nowrap cursor-pointer"
                                        >
                                          {isSendingPdf ? (
                                            <>
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                              <span>Enviando PDF...</span>
                                            </>
                                          ) : (
                                            <>
                                              <Send className="w-3.5 h-3.5" />
                                              <span>Enviar borrador PDF por WhatsApp</span>
                                            </>
                                          )}
                                        </button>

                                        {onOpenEscritos && (
                                          <button
                                            type="button"
                                            onClick={() => onOpenEscritos()}
                                            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-emerald-600/30 bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/60 dark:hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
                                          >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            <span>Ir a Escritos y Documentos</span>
                                          </button>
                                        )}
                                      </div>

                                      {pdfSendStatus && (
                                        <div
                                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                                            pdfSendStatus.kind === 'success'
                                              ? 'text-emerald-800 dark:text-emerald-300'
                                              : 'text-red-700 dark:text-red-400'
                                          }`}
                                        >
                                          {pdfSendStatus.kind === 'success' ? (
                                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                                          ) : (
                                            <AlertCircle className="w-4 h-4 shrink-0" />
                                          )}
                                          <span>{pdfSendStatus.message}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>

                          {/* Respuesta sugerida editable + envío directo */}
                          <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800/80 space-y-2.5">
                            <label
                              htmlFor={`reply-draft-${threadKey}`}
                              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                            >
                              Respuesta sugerida (editable)
                            </label>
                            <textarea
                              id={`reply-draft-${threadKey}`}
                              rows={3}
                              value={replyDraft}
                              onChange={(e) =>
                                setReplyDraftByThreadKey((prev) => ({
                                  ...prev,
                                  [threadKey]: e.target.value,
                                }))
                              }
                              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121824] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-colors resize-y"
                            />

                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="min-w-0">
                                {replyStatus && (
                                  <span
                                    className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                                      replyStatus.kind === 'success'
                                        ? 'text-emerald-700 dark:text-emerald-400'
                                        : 'text-red-700 dark:text-red-400'
                                    }`}
                                  >
                                    {replyStatus.kind === 'success' ? (
                                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    ) : (
                                      <AlertCircle className="w-4 h-4 shrink-0" />
                                    )}
                                    <span>{replyStatus.message}</span>
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => handleSendThreadReply(thread)}
                                disabled={isSendingReply || (!thread.phone && !thread.jid)}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                {isSendingReply ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Enviando respuesta...</span>
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-3.5 h-3.5" />
                                    <span>Enviar respuesta por WhatsApp</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      ) : isWaitingScan ? (
        <div className="rounded-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121824]/90 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-5 flex flex-col items-center justify-center">
              <div className="w-64 h-64 rounded-2xl bg-white border border-slate-200 p-4 flex items-center justify-center shadow-sm">
                {qrCode ? (
                  <img
                    src={qrCode}
                    alt="Código QR de WhatsApp"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center gap-3 text-slate-500">
                    <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                    <span className="text-xs font-medium">Generando código QR...</span>
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-7 space-y-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Escanea el código QR para vincular tu dispositivo
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                  Abre WhatsApp en tu celular → Dispositivos vinculados → Vincular dispositivo
                </p>
              </div>

              <div className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
                <p>1. Abre WhatsApp en tu teléfono principal.</p>
                <p>2. Toca Menú o Configuración y selecciona Dispositivos vinculados.</p>
                <p>3. Apunta la cámara hacia este código QR. La pantalla se actualizará automáticamente al conectarse.</p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={isConnecting}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-60 whitespace-nowrap cursor-pointer"
                >
                  {isConnecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <QrCode className="w-4 h-4" />
                  )}
                  <span>Regenerar QR</span>
                </button>

                <span className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
                  <span>Verificando conexión cada 3 segundos...</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-8 md:p-10 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121824]/90 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4 max-w-2xl">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  No hay un dispositivo de WhatsApp vinculado
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Genera un código QR seguro para conectar la línea de WhatsApp de tu escribanía y realizar envíos de prueba directamente desde O.L.G.A.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleConnect}
              disabled={isConnecting || !workspaceId}
              className={`inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer ${
                esPlanFull
                  ? 'bg-emerald-600 hover:bg-emerald-700 ring-1 ring-amber-400/40'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generando QR...</span>
                </>
              ) : (
                <>
                  <QrCode className="w-4 h-4" />
                  <span>Conectar WhatsApp (Generar QR)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
