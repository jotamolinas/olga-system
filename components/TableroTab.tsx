import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../services/auth';
import { useWorkspace } from '../hooks/useWorkspace';
import { Pagare, Persona, GlobalConfig, formatCurrencyValue } from '../types';
import { fetchPersonasFromFirestore, normalizePersona } from '../services/firestore';
import {
  FileText,
  Users,
  Clock,
  DollarSign,
  Activity,
  ChevronRight,
  X,
  PieChartIcon,
  AlertTriangle,
  MessageCircle,
  Bell,
  Bot,
  ArrowRight,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PagaresTab } from './PagaresTab';
import { PersonasTab } from './PersonasTab';
import { WhatsAppSendModal } from './WhatsAppSendModal';
import { generatePagarePdfBase64 } from '../services/pdfExport';

interface TableroTabProps {
  pagares: Pagare[];
  personas: Persona[];
  config: GlobalConfig;
  onSelectPagareForPreview?: (pagare: Pagare) => void;
  onOpenDocument?: (text: string) => void;
  onAddPagare: (pagare: Pagare) => void;
  onUpdatePagare?: (pagare: Pagare) => void;
  onDeletePagare: (id: string) => void;
  onAddPersona: (persona: Persona) => boolean;
  onUpdatePersona: (persona: Persona) => void;
  onDeletePersona: (id: string) => void;
  isAdmin: boolean;
  userData?: any;
  workspaceId?: string;
  workspaceName?: string;
  isSoftBlocked?: boolean; // <-- NUEVO
  esPlanFull?: boolean;
  canUseWhatsApp?: boolean;
  onNavigateTab?: (tab: 'pagares' | 'whatsapp' | 'escritos' | 'personas') => void;
}

interface WhatsAppActivityItem {
  id: string;
  pushName: string;
  phone: string;
  jid: string | null;
  messagesCount: number;
  timestampMs: number;
  delaySeconds: number;
}

const parseTableroLocalYmd = (raw?: string): Date | null => {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (match) {
    const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const getTableroPagareDueInfo = (pag: Pagare) => {
  if (pag.status === 'anulado' || (pag as any).estado === 'Anulado') {
    return { status: 'anulado' as const, dueDate: null, dueDateRaw: null, diffDays: null };
  }
  if (pag.status === 'cobrado' || (pag as any).estado === 'Cobrado') {
    return { status: 'pagado' as const, dueDate: null, dueDateRaw: null, diffDays: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let dueDate: Date | null = null;
  let dueDateRaw: string | null = null;

  if (pag.cronograma && pag.cronograma.length > 0) {
    const pending = pag.cronograma.filter((c: any) => c.estado !== 'cobrado' && c.pagado !== true);
    if (pending.length === 0) {
      return { status: 'pagado' as const, dueDate: null, dueDateRaw: null, diffDays: null };
    }
    const sorted = [...pending].sort((a: any, b: any) => {
      const da = parseTableroLocalYmd(a.fecha_pag || a.fecha_vencimiento || a.fecha)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const dbDate = parseTableroLocalYmd(b.fecha_pag || b.fecha_vencimiento || b.fecha)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return da - dbDate;
    });
    const first = sorted[0];
    dueDateRaw = first?.fecha_pag || (first as any)?.fecha_vencimiento || (first as any)?.fecha || null;
    dueDate = parseTableroLocalYmd(dueDateRaw || undefined);
  } else {
    dueDateRaw =
      pag.fecha_primer_pago ||
      (pag as any).fecha_vencimiento ||
      (pag as any).fecha_pago ||
      (pag as any).fechaVencimiento ||
      (pag as any).fecha ||
      null;
    dueDate = parseTableroLocalYmd(dueDateRaw || undefined);
  }

  if (!dueDate) {
    return { status: 'al_dia' as const, dueDate: null, dueDateRaw: null, diffDays: null };
  }

  const diffDays = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return { status: 'vencido' as const, dueDate, dueDateRaw, diffDays };
  }
  if (diffDays <= 5) {
    return { status: 'proximo' as const, dueDate, dueDateRaw, diffDays };
  }
  return { status: 'al_dia' as const, dueDate, dueDateRaw, diffDays };
};

const parseWaTimestampMs = (rawTs: unknown): number => {
  if (typeof rawTs === 'number' && Number.isFinite(rawTs)) {
    return rawTs < 1_000_000_000_000 ? rawTs * 1000 : rawTs;
  }
  if (typeof rawTs === 'string' && rawTs.trim()) {
    const num = Number(rawTs);
    if (Number.isFinite(num) && num > 0) {
      return num < 1_000_000_000_000 ? num * 1000 : num;
    }
    const parsed = Date.parse(rawTs);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
};

const cleanWaPhone = (raw: unknown): string => {
  if (typeof raw !== 'string' && typeof raw !== 'number') return '';
  return (String(raw).split('@')[0] || '').replace(/[^\d+]/g, '').trim();
};

const countPendingWaThreadsFromInbox = (rawMessages: any[], wsId: string): number => {
  let archivedMap: Record<string, number> = {};
  try {
    const stored = localStorage.getItem(`olga_wa_archived_${wsId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        archivedMap = parsed;
      }
    }
  } catch {
    archivedMap = {};
  }

  const threadLatestMap = new Map<
    string,
    { threadKey: string; phone: string; jid: string | null; latestTimestampMs: number }
  >();

  rawMessages.forEach((raw, idx) => {
    if (!raw || typeof raw !== 'object') return;
    const jidCandidate = raw.jid ?? raw.remoteJid ?? raw.chatId ?? raw.key?.remoteJid;
    const jid = typeof jidCandidate === 'string' && jidCandidate.trim() ? jidCandidate.trim() : null;
    const phone = cleanWaPhone(raw.phone ?? raw.from ?? raw.sender ?? jid ?? '');
    const digits = phone.replace(/^\+/, '');
    const threadKey = digits || (jid ? jid.toLowerCase() : `anon-${idx}`);
    const ts = parseWaTimestampMs(raw.timestampMs ?? raw.timestamp ?? raw.createdAt ?? raw.date);

    const existing = threadLatestMap.get(threadKey);
    if (!existing || ts > existing.latestTimestampMs) {
      threadLatestMap.set(threadKey, {
        threadKey,
        phone: phone || existing?.phone || '',
        jid: jid || existing?.jid || null,
        latestTimestampMs: ts,
      });
    }
  });

  let pendingCount = 0;
  for (const thread of threadLatestMap.values()) {
    const archiveKey = thread.jid || thread.phone || thread.threadKey;
    const archivedTs = archivedMap[archiveKey] ?? archivedMap[thread.threadKey];
    const isAttended =
      typeof archivedTs === 'number' &&
      Number.isFinite(archivedTs) &&
      thread.latestTimestampMs <= archivedTs;
    if (!isAttended) {
      pendingCount += 1;
    }
  }

  return pendingCount;
};

const CountUp: React.FC<{ end: number; duration?: number; isCurrency?: boolean }> = ({ end, duration = 1500, isCurrency = false }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress); // easeOutExpo
      setCount(Math.floor(easeProgress * end));
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };
    requestAnimationFrame(animate);
  }, [end, duration]);

  return <span>{isCurrency ? formatCurrencyValue(count, 'PYG') : count}</span>;
};

const OverlayDetails: React.FC<{
  title: string;
  icon: React.ReactNode;
  onClose: () => void;
  items: any[];
  type: 'pagares' | 'personas' | 'escritos';
  onOpenDocument?: (text: string) => void;
  onSelectPagare?: (id: string) => void;
  onSelectPersona?: (id: string) => void;
}> = ({ title, icon, onClose, items, type, onOpenDocument, onSelectPagare, onSelectPersona }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Prevent closing if a higher z-index modal is open (like Editor de Pagaré)
        const hasHigherModal = document.querySelector('.z-\\[60\\], .z-\\[100\\]');
        if (!hasHigherModal) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const portalNode = document.getElementById('main-content-viewport');
  if (!portalNode) return null;

  return createPortal(
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 md:p-8 animate-fade-in bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full box-border max-w-4xl max-h-full flex flex-col overflow-hidden animate-slide-up border border-slate-100 relative">
        <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-slate-700">
               {icon}
             </div>
             <div>
               <h3 className="text-xl font-bold font-serif text-slate-800">{title}</h3>
               <p className="text-xs font-black uppercase tracking-widest text-slate-400 mt-1">{items.length} Registros</p>
             </div>
          </div>
          <button onClick={onClose} className="p-3 bg-white hover:bg-slate-100 text-slate-500 rounded-2xl transition-colors shadow-sm">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 md:p-8 overflow-y-auto flex-grow bg-slate-50">
           {items.length === 0 ? (
             <div className="text-center py-12">
               <p className="text-slate-400 font-bold">No hay registros para mostrar.</p>
             </div>
           ) : (
             <div className="space-y-3">
               {items.map((item, idx) => (
                 <div 
                   key={idx} 
                   className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-all cursor-pointer hover:-translate-y-0.5 hover:bg-slate-50`}
                   onClick={() => {
                     if (type === 'escritos' && onOpenDocument && item.texto) {
                       onOpenDocument(item.texto);
                     } else if (type === 'pagares' && onSelectPagare && item.id) {
                       onSelectPagare(item.id);
                     } else if (type === 'personas' && onSelectPersona && item.id) {
                       onSelectPersona(item.id);
                     }
                   }}
                 >
                   {type === 'pagares' ? (
                     <>
                       <div>
                         <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                           <FileText className="w-4 h-4 text-blue-400" />
                           Pagaré Correlativo: {(item as Pagare).correlativo || `#${(item as Pagare).id?.slice(0,6)}`}
                         </p>
                         <p className="text-xs text-slate-500 mt-1.5 ml-6">Fecha de pago: {(item as Pagare).fecha_primer_pago || 'No definida'}</p>
                         <div className="flex items-center gap-1.5 mt-1 ml-6 text-[10px]">
                           <span className="text-slate-400 font-medium">Responsable:</span>
                           <span className="font-bold text-slate-700 truncate max-w-[140px]">{(item as Pagare).creator_name || (item as any).creatorName || 'Titular'}</span>
                           {((item as Pagare).creator_role === 'operador' || (item as any).creatorRole === 'operador') && (
                             <span className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                               Operador
                             </span>
                           )}
                         </div>
                       </div>
                       <div className="text-right">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Total ({(item as Pagare).moneda})</p>
                         <p className="text-sm font-bold text-emerald-600 mt-0.5">{formatCurrencyValue((item as Pagare).valor_total || 0, (item as Pagare).moneda)}</p>
                       </div>
                     </>
                   ) : type === 'escritos' ? (
                     <>
                       <div className="flex-1 min-w-0 pr-4">
                         <p className="text-sm font-bold text-slate-800 flex items-center gap-2 truncate">
                           <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                           {item.tipo || 'Escrito'}
                         </p>
                         <p className="text-xs text-slate-500 mt-1 ml-6">
                           {item.createdAt ? new Date(item.createdAt).toLocaleDateString('es-PY') : (item.fechaCreacion?.toMillis ? new Date(item.fechaCreacion.toMillis()).toLocaleDateString('es-PY') : 'Fecha desconocida')}
                         </p>
                         <div className="flex items-center gap-1.5 mt-1 ml-6 text-[10px]">
                           <span className="text-slate-400 font-medium">Responsable:</span>
                           <span className="font-bold text-slate-700 truncate max-w-[140px]">{item.creator_name || item.creatorName || 'Titular'}</span>
                           {(item.creator_role === 'operador' || item.creatorRole === 'operador') && (
                             <span className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                               Operador
                             </span>
                           )}
                         </div>
                         <p className="text-xs text-slate-500 mt-1.5 ml-6 italic line-clamp-2">
                           {item.texto ? `"${item.texto.substring(0, 150)}..."` : 'Sin contenido de texto extraído'}
                         </p>
                       </div>
                       <div className="text-right shrink-0">
                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3 py-1.5 bg-slate-100 rounded-xl inline-block">Guardado</p>
                       </div>
                     </>
                   ) : (
                     <>
                        <div>
                         <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                           <Users className="w-4 h-4 text-emerald-400" />
                           {(item as Persona).nombre} {(item as Persona).apellido || ''}
                         </p>
                         <p className="text-xs text-slate-500 mt-1.5 ml-6">{(item as Persona).tipo_documento}: {(item as Persona).nro_documento}</p>
                         <div className="flex items-center gap-1.5 mt-1 ml-6 text-[10px]">
                           <span className="text-slate-400 font-medium">Responsable:</span>
                           <span className="font-bold text-slate-700 truncate max-w-[140px]">{(item as Persona).creator_name || (item as any).creatorName || 'Titular'}</span>
                           {((item as Persona).creator_role === 'operador' || (item as any).creatorRole === 'operador') && (
                             <span className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                               Operador
                             </span>
                           )}
                         </div>
                       </div>
                       <div className="text-right">
                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3 py-1.5 bg-slate-100 rounded-xl inline-block">{(item as Persona).tipo_persona}</p>
                       </div>
                     </>
                   )}
                 </div>
               ))}
             </div>
           )}
        </div>
      </div>
    </div>,
    portalNode
  );
};

export const TableroTab: React.FC<TableroTabProps> = ({ 
  pagares, 
  personas, 
  config, 
  onSelectPagareForPreview, 
  onOpenDocument,
  onAddPagare,
  onUpdatePagare,
  onDeletePagare,
  onAddPersona,
  onUpdatePersona,
  onDeletePersona,
  isAdmin,
  userData,
  workspaceId,
  workspaceName,
  esPlanFull,
  canUseWhatsApp,
  onNavigateTab,
}) => {
  const { workspaceId: hookWorkspaceId } = useWorkspace(auth?.currentUser, userData);
  const activeWorkspaceId = workspaceId || hookWorkspaceId;

  const isWhatsAppEnabled =
    typeof canUseWhatsApp === 'boolean'
      ? canUseWhatsApp
      : auth?.currentUser?.email === 'jotamolinas@gmail.com' || Boolean(userData?.whatsappEnabled);

  const [escritos, setEscritos] = useState<any[]>([]);
  const [activeOverlay, setActiveOverlay] = useState<'pagares' | 'personas' | 'escritos' | 'valor' | 'vencimientos' | 'vencidos' | null>(null);

  const [isPagareEditorOpen, setIsPagareEditorOpen] = useState(false);
  const [editingPagareId, setEditingPagareId] = useState<string | null>(null);
  
  const [isPersonasEditorOpen, setIsPersonasEditorOpen] = useState(false);
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null);

  // Centro de Notificaciones: Recordatorio rápido WhatsApp desde Pagarés
  const [pagareForWhatsApp, setPagareForWhatsApp] = useState<Pagare | null>(null);

  // Centro de Notificaciones: Actividad WhatsApp
  const [waActivities, setWaActivities] = useState<WhatsAppActivityItem[]>([]);
  const [waPendingThreadsCount, setWaPendingThreadsCount] = useState<number>(0);
  const [isLoadingWaMonitor, setIsLoadingWaMonitor] = useState<boolean>(false);
  const [waMonitorError, setWaMonitorError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isPagareEditorOpen) {
          setIsPagareEditorOpen(false);
          setEditingPagareId(null);
        } else if (isPersonasEditorOpen) {
          setIsPersonasEditorOpen(false);
          setEditingPersonaId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPagareEditorOpen, isPersonasEditorOpen]);

  // FASE 2: Sincronización en tiempo real de Documentos para Métricas de Tablero
  useEffect(() => {
    // Bloqueo de seguridad: No ejecutar si el ID no está listo
    if (!activeWorkspaceId) return;

    const q = query(
      collection(db, 'documentos_olga'),
      where('userId', '==', activeWorkspaceId) // Filtro maestro por Tenant
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a: any, b: any) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : (a.fechaCreacion?.toMillis?.() || 0);
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : (b.fechaCreacion?.toMillis?.() || 0);
        return bTime - aTime;
      });
      setEscritos(docs);
    }, (error) => {
      console.error("Fallo en sincronización de documentos_olga en Tablero:", error);
    });

    return () => unsubscribe(); // Limpieza estricta de memoria
  }, [activeWorkspaceId]); // Dependencia única

  const [localPersonas, setLocalPersonas] = useState<Persona[]>([]);

  // Sincronización en tiempo real de Personas por Workspace desde directorio_personas
  useEffect(() => {
    if (!activeWorkspaceId) {
      setLocalPersonas([]);
      return;
    }

    let activo = true;
    const uid = auth?.currentUser?.uid || '';
    const mapa = new Map<string, Persona>();

    fetchPersonasFromFirestore(activeWorkspaceId)
      .then((cloud) => {
        if (!activo) return;
        cloud.forEach((p) => mapa.set(p.id, p));
        setLocalPersonas(Array.from(mapa.values()));
      })
      .catch((err) => console.error('Error cargando directorio_personas en Tablero:', err));

    const qWorkspace = query(
      collection(db, 'directorio_personas'),
      where('ownedByWorkspace', '==', activeWorkspaceId)
    );

    const unsubscribeWorkspace = onSnapshot(
      qWorkspace,
      (snapshot) => {
        if (!activo) return;
        snapshot.docs.forEach((d) => {
          mapa.set(d.id, normalizePersona(d.data(), d.id));
        });
        setLocalPersonas(Array.from(mapa.values()));
      },
      (error) => {
        console.error('Fallo en sincronización de directorio_personas en Tablero:', error);
      }
    );

    let unsubscribeUser: (() => void) | null = null;
    if (uid) {
      const qUser = query(
        collection(db, 'directorio_personas'),
        where('userId', '==', uid)
      );
      unsubscribeUser = onSnapshot(
        qUser,
        (snapshot) => {
          if (!activo) return;
          snapshot.docs.forEach((d) => {
            mapa.set(d.id, normalizePersona(d.data(), d.id));
          });
          setLocalPersonas(Array.from(mapa.values()));
        },
        (error) => {
          console.error('Fallo en sincronización retrocompatible de directorio_personas en Tablero:', error);
        }
      );
    }

    return () => {
      activo = false;
      unsubscribeWorkspace();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, [activeWorkspaceId]);

  const effectivePersonas = (personas && Array.isArray(personas) && personas.length > 0) ? personas : localPersonas;

  const getTableroAuthHeaders = useCallback(async (withJson = false): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {};
    if (withJson) {
      headers['Content-Type'] = 'application/json';
    }
    try {
      const user = auth?.currentUser;
      if (user) {
        const token = await user.getIdToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
    } catch {
      // Continuar sin token si no está disponible
    }
    return headers;
  }, []);

  // Polling cada 10s de Actividad (Bitácora de Ausencia) + Bandeja Pendiente WhatsApp
  useEffect(() => {
    if (!isWhatsAppEnabled || !activeWorkspaceId) {
      setWaActivities([]);
      setWaPendingThreadsCount(0);
      setWaMonitorError(null);
      setIsLoadingWaMonitor(false);
      return;
    }

    let active = true;

    const fetchWaMonitorData = async (isInitial: boolean) => {
      if (isInitial) setIsLoadingWaMonitor(true);
      try {
        const headers = await getTableroAuthHeaders(false);
        const [actRes, inboxRes] = await Promise.all([
          fetch(`/api/whatsapp/activity/${encodeURIComponent(activeWorkspaceId)}`, {
            method: 'GET',
            headers,
          }),
          fetch(`/api/whatsapp/inbox/${encodeURIComponent(activeWorkspaceId)}`, {
            method: 'GET',
            headers,
          }),
        ]);

        if (!active) return;

        const actData = await actRes.json().catch(() => ({}));
        const inboxData = await inboxRes.json().catch(() => ({}));

        if (actRes.ok) {
          const rawActs = Array.isArray(actData.activities) ? actData.activities : [];
          const normalizedActs: WhatsAppActivityItem[] = rawActs
            .filter((item: any) => item && typeof item === 'object')
            .map((item: any, idx: number) => {
              const phone = cleanWaPhone(item.phone ?? item.from ?? item.jid ?? '');
              const jid = typeof item.jid === 'string' ? item.jid : null;
              const rawName = typeof item.pushName === 'string' ? item.pushName.trim() : '';
              const pushName =
                rawName ||
                (typeof item.contactName === 'string' ? item.contactName.trim() : '') ||
                (phone ? `+${phone.replace(/^\+/, '')}` : jid || 'Cliente');
              const messagesCount = Math.max(
                1,
                Number(item.messagesCount ?? item.messageCount ?? item.count ?? 1) || 1
              );
              const timestampMs = parseWaTimestampMs(
                item.timestampMs ?? item.timestamp ?? item.sentAt ?? item.createdAt
              );
              const delaySec = Number(item.delaySeconds) || 120;
              return {
                id: String(item.id || `${phone || jid || 'act'}-${timestampMs}-${idx}`),
                pushName,
                phone,
                jid,
                messagesCount,
                timestampMs,
                delaySeconds: delaySec,
              };
            })
            .sort((a: WhatsAppActivityItem, b: WhatsAppActivityItem) => b.timestampMs - a.timestampMs);
          setWaActivities(normalizedActs);
        }

        if (inboxRes.ok) {
          const rawMsgs = Array.isArray(inboxData.messages) ? inboxData.messages : [];
          setWaPendingThreadsCount(countPendingWaThreadsFromInbox(rawMsgs, activeWorkspaceId));
        }

        if (!actRes.ok && !inboxRes.ok) {
          setWaMonitorError(actData.error || inboxData.error || 'No se pudo consultar la actividad de WhatsApp.');
        } else {
          setWaMonitorError(null);
        }
      } catch (err: unknown) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : 'Error de conexión con WhatsApp.';
        setWaMonitorError(msg);
      } finally {
        if (active) setIsLoadingWaMonitor(false);
      }
    };

    fetchWaMonitorData(true);
    const intervalId = window.setInterval(() => {
      fetchWaMonitorData(false);
    }, 10000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [isWhatsAppEnabled, activeWorkspaceId, getTableroAuthHeaders]);

  const { totalPagares, pagaresAnulados, personasActivas, totalValorNotariado } = useMemo(() => {
    const totalPagares = pagares.length;
    const pagaresAnulados = pagares.filter(p => p.status === 'anulado').length;
    
    // Contamos personas que pertenecen al entorno de trabajo (workspaceId)
    const personasActivas = effectivePersonas.length;

    // Total valor notariado
    const totalValorNotariado = pagares.reduce((sum, p) => p.status !== 'anulado' ? sum + p.valor_total : sum, 0);

    return { totalPagares, pagaresAnulados, personasActivas, totalValorNotariado };
  }, [pagares, effectivePersonas]);

  const pagareAlertItems = useMemo(() => {
    const items: Array<{
      pagare: Pagare;
      status: 'vencido' | 'proximo';
      diffDays: number;
      dueDate: Date;
      dueDateRaw: string | null;
      deudorNombre: string;
    }> = [];

    for (const p of pagares) {
      const info = getTableroPagareDueInfo(p);
      if ((info.status === 'vencido' || info.status === 'proximo') && info.dueDate && info.diffDays !== null) {
        const deudorPersona = effectivePersonas.find((per) => per.id === p.deudor_id);
        const deudorNombre =
          p.deudor_nombre_raw ||
          (deudorPersona ? `${deudorPersona.nombre || ''} ${deudorPersona.apellido || ''}`.trim() : '') ||
          (p as any).nombreDeudor ||
          'Deudor sin especificar';

        items.push({
          pagare: p,
          status: info.status,
          diffDays: info.diffDays,
          dueDate: info.dueDate,
          dueDateRaw: info.dueDateRaw,
          deudorNombre,
        });
      }
    }

    return items.sort((a, b) => a.diffDays - b.diffDays);
  }, [pagares, effectivePersonas]);

  const pagaresVencidos = useMemo(
    () => pagareAlertItems.filter((item) => item.status === 'vencido').map((item) => item.pagare),
    [pagareAlertItems]
  );

  const pagaresProximosAVencer = useMemo(
    () => pagareAlertItems.filter((item) => item.status === 'proximo').map((item) => item.pagare),
    [pagareAlertItems]
  );

  const chartData = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const recentPagares = pagares.filter(p => {
      if (!p.created_at) return true; // Fallback
      const createdAt = new Date(p.created_at);
      return createdAt >= thirtyDaysAgo;
    });

    const stateCount = {
      Pendiente: 0,
      Cobrado: 0,
      Vencido: 0,
      Anulado: 0
    };

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    recentPagares.forEach(pag => {
      if (pag.status === 'anulado' || pag.estado === 'Anulado') {
        stateCount.Anulado += (pag.cronograma?.length || 1);
        return;
      }

      if (pag.cronograma && pag.cronograma.length > 0) {
        pag.cronograma.forEach((cuota) => {
          // Compatibility with any 'estado' or 'pagado' field in cuota, 
          // or if the whole pagare is 'cobrado', we assume all its cuotas are paid.
          if ((cuota as any).estado === 'cobrado' || (cuota as any).pagado === true) {
            stateCount.Cobrado++;
          } else {
            const rawDate = (cuota as any).fecha_vencimiento || (cuota as any).fecha || cuota.fecha_pag;
            const cDate = new Date(rawDate);
            if (typeof rawDate === 'string') {
               const parts = rawDate.split('-');
               if (parts.length === 3) {
                 cDate.setFullYear(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
               }
            }
            cDate.setHours(0, 0, 0, 0);

            if (cDate.getTime() < hoy.getTime()) {
              stateCount.Vencido++;
            } else {
              stateCount.Pendiente++;
            }
          }
        });
      } else {
        // Pago Único
        if (pag.status === 'cobrado' || pag.estado === 'Cobrado') {
          stateCount.Cobrado++;
        } else {
          let rawDate = (pag as any).fecha_vencimiento || (pag as any).fecha || pag.fecha_primer_pago;
          const cDate = new Date(rawDate || new Date());
          if (typeof rawDate === 'string') {
             const parts = rawDate.split('-');
             if (parts.length === 3) {
               cDate.setFullYear(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
             }
          }
          cDate.setHours(0, 0, 0, 0);

          if (cDate.getTime() < hoy.getTime()) {
            stateCount.Vencido++;
          } else {
            stateCount.Pendiente++;
          }
        }
      }
    });

    return [
      { name: 'Pendiente', value: stateCount.Pendiente, color: '#3b82f6' }, // Blue
      { name: 'Cobrado', value: stateCount.Cobrado, color: '#10b981' }, // Emerald
      { name: 'Vencido', value: stateCount.Vencido, color: '#ef4444' }, // Red
      { name: 'Anulado', value: stateCount.Anulado, color: '#94a3b8' } // Slate
    ];
  }, [pagares]);

  return (
    <div className="w-full box-border flex flex-col gap-8 w-full animate-fade-in pb-12">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 md:p-7 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="relative z-10 text-center md:text-left w-full box-border">
          <h2 className="text-white text-xl md:text-2xl font-black font-serif flex items-center justify-center md:justify-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center border border-slate-700 shadow-xs">
              <Activity className="w-5 h-5" />
            </div>
            Tablero Principal
          </h2>
          <p className="text-slate-400 text-xs md:text-sm mt-1 max-w-md mx-auto md:mx-0">
            Resumen de actividad y volumen notariado de {config.escribania.nombre}.
          </p>
        </div>
      </div>

      {/* CENTRO DE NOTIFICACIONES COMPACTO */}
      <section
        className={`rounded-2xl border p-4 transition-all ${
          esPlanFull
            ? 'bg-[#F4F4F0]/85 dark:bg-[#12141C]/85 backdrop-blur-xl border-amber-200/40 dark:border-amber-500/30 shadow-xs'
            : 'bg-white dark:bg-[#121824]/90 border-slate-100 dark:border-slate-800/80 shadow-xs'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-slate-800 text-amber-400 flex items-center justify-center shrink-0">
              <Bell className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-extrabold font-serif text-slate-900 dark:text-slate-100">
              Centro de Notificaciones
            </h3>
          </div>

          {pagareAlertItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
              {pagaresVencidos.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                  {pagaresVencidos.length} vencido{pagaresVencidos.length > 1 ? 's' : ''}
                </span>
              )}
              {pagaresProximosAVencer.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  {pagaresProximosAVencer.length} por vencer (5d)
                </span>
              )}
            </div>
          )}
        </div>

        <div className={`grid grid-cols-1 ${isWhatsAppEnabled ? 'lg:grid-cols-2' : ''} gap-3`}>
          {/* Alertas de Pagarés */}
          <div className="rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#0B0F17]/60 p-3 flex flex-col justify-center">
            {pagareAlertItems.length === 0 ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="truncate">Sin alertas de pagarés próximos a vencer</span>
                </div>
                <button
                  type="button"
                  onClick={() => (onNavigateTab ? onNavigateTab('pagares') : setActiveOverlay('pagares'))}
                  className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <span>Ver todos</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      Alertas de Pagarés
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => (onNavigateTab ? onNavigateTab('pagares') : setActiveOverlay('pagares'))}
                    className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Ver todos</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {pagareAlertItems.map((item) => {
                    const { pagare, status, diffDays, dueDate, deudorNombre } = item;
                    const correlativoStr = String(pagare.correlativo || 'S/N').padStart(4, '0');
                    const monCode = (pagare.moneda || 'PYG').toUpperCase();
                    const monPrefix = monCode === 'USD' ? 'US$' : monCode === 'BRL' ? 'R$' : 'Gs.';
                    const montoFmt = `${monPrefix} ${formatCurrencyValue(
                      pagare.valor_total || (pagare as any).monto || 0,
                      monCode
                    )}`;
                    const fechaFmt = dueDate.toLocaleDateString('es-PY', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    });
                    const absDays = Math.abs(diffDays);
                    const badgeText =
                      status === 'vencido'
                        ? absDays === 1
                          ? 'Vencido 1d'
                          : `Vencido ${absDays}d`
                        : diffDays === 0
                          ? 'Vence hoy'
                          : diffDays === 1
                            ? 'Vence en 1d'
                            : `Vence en ${diffDays}d`;

                    return (
                      <div
                        key={pagare.id}
                        className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#121824] px-2.5 py-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-black uppercase rounded border whitespace-nowrap ${
                              status === 'vencido'
                                ? 'bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800'
                                : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                            }`}
                          >
                            {badgeText}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                            {deudorNombre}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            Nº {correlativoStr} · <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{montoFmt}</span> · {fechaFmt}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              if (onNavigateTab) {
                                onNavigateTab('pagares');
                              } else {
                                setEditingPagareId(pagare.id);
                                setIsPagareEditorOpen(true);
                              }
                            }}
                            className="px-2 py-1 rounded-md text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Ir a Pagarés
                          </button>

                          {isWhatsAppEnabled && (
                            <button
                              type="button"
                              onClick={() => setPagareForWhatsApp(pagare)}
                              className="px-2 py-1 rounded-md text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>Recordar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Notificaciones de WhatsApp (solo si canUseWhatsApp === true) */}
          {isWhatsAppEnabled && (
            <div className="rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#0B0F17]/60 p-3 flex flex-col justify-center space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                    {waPendingThreadsCount === 0
                      ? 'Sin chats pendientes'
                      : `${waPendingThreadsCount} ${
                          waPendingThreadsCount === 1
                            ? 'chat pendiente por revisar'
                            : 'chats pendientes por revisar'
                        }`}
                  </span>
                  {isLoadingWaMonitor && (
                    <Loader2 className="w-3 h-3 text-emerald-600 animate-spin shrink-0" />
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onNavigateTab?.('whatsapp')}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>Abrir Bandeja</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {waActivities.length > 0 ? (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pt-2 border-t border-slate-200/70 dark:border-slate-800/80">
                  {waActivities.slice(0, 5).map((act) => {
                    const horaFmt = (() => {
                      try {
                        return new Intl.DateTimeFormat('es-PY', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                        }).format(new Date(act.timestampMs));
                      } catch {
                        return '';
                      }
                    })();

                    return (
                      <div
                        key={act.id}
                        className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#121824] px-2.5 py-1.5 flex items-center justify-between gap-2"
                      >
                        <p className="text-[11px] text-slate-700 dark:text-slate-200 truncate">
                          🤖 <span className="font-bold">O.L.G.A.</span> respondió a{' '}
                          <span className="font-bold text-slate-900 dark:text-white">{act.pushName}</span> ({act.messagesCount}{' '}
                          {act.messagesCount === 1 ? 'msj' : 'msjs'})
                          {horaFmt ? ` · ${horaFmt}` : ''}
                        </p>
                        <button
                          type="button"
                          onClick={() => onNavigateTab?.('whatsapp')}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          Revisar
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {waMonitorError
                    ? waMonitorError
                    : 'Sin respuestas automáticas recientes en ausencia.'}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* TARJETA 1: Pagarés */}
        <div className={`group relative rounded-[2rem] p-6 flex flex-col gap-4 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${esPlanFull ? 'bg-[#F4F4F0]/80 dark:bg-[#12141C]/80 backdrop-blur-xl border border-amber-200/40 dark:border-amber-500/30 shadow-[0_8px_32px_0_rgba(0,0,0,0.06)]' : 'bg-white border border-slate-100 shadow-sm'}`}>
          <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center shadow-inner transition-transform duration-300 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Total Pagarés</p>
            <p className="text-3xl font-black text-slate-800 flex items-baseline gap-2">
              <CountUp end={totalPagares} />
              {pagaresAnulados > 0 && <span className="text-sm font-bold text-slate-400">({pagaresAnulados} ANULADOS)</span>}
            </p>
          </div>
          <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <button onClick={() => setActiveOverlay('pagares')} className="bg-white text-slate-900 border border-slate-200 shadow-xl px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300 hover:bg-slate-50">
              Ver Detalles <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* TARJETA 2: Personas Activas */}
        <div className={`group relative rounded-[2rem] p-6 flex flex-col gap-4 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${esPlanFull ? 'bg-[#F4F4F0]/80 dark:bg-[#12141C]/80 backdrop-blur-xl border border-amber-200/40 dark:border-amber-500/30 shadow-[0_8px_32px_0_rgba(0,0,0,0.06)]' : 'bg-white border border-slate-100 shadow-sm'}`}>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center shadow-inner transition-transform duration-300 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Personas Activas</p>
            <p className="text-3xl font-black text-slate-800"><CountUp end={personasActivas} /></p>
          </div>
          <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <button onClick={() => setActiveOverlay('personas')} className="bg-white text-slate-900 border border-slate-200 shadow-xl px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300 hover:bg-slate-50">
              Ver Detalles <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* TARJETA 3: Escritos Guardados */}
        
        <div className={`group relative rounded-[2rem] p-6 flex flex-col gap-4 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${esPlanFull ? 'bg-[#F4F4F0]/80 dark:bg-[#12141C]/80 backdrop-blur-xl border border-amber-200/40 dark:border-amber-500/30 shadow-[0_8px_32px_0_rgba(0,0,0,0.06)]' : 'bg-white border border-slate-100 shadow-sm'}`}>
          <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center shadow-inner transition-transform duration-300 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Escritos Guardados</p>
            <p className="text-3xl font-black text-slate-800"><CountUp end={escritos.length} /></p>
          </div>
          <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <button onClick={() => setActiveOverlay('escritos')} className="bg-white text-slate-900 border border-slate-200 shadow-xl px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300 hover:bg-slate-50">
              Ver Detalles <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* TARJETA 4: Valor Notariado */}
        <div className={`group relative rounded-[2rem] p-6 flex flex-col gap-4 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${esPlanFull ? 'bg-[#F4F4F0]/80 dark:bg-[#12141C]/80 backdrop-blur-xl border border-amber-200/40 dark:border-amber-500/30 shadow-[0_8px_32px_0_rgba(0,0,0,0.06)]' : 'bg-white border border-slate-100 shadow-sm'}`}>
          <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center shadow-inner transition-transform duration-300 group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Total Valor Notariado</p>
            <p className="text-3xl font-black text-slate-800">
              Gs. <CountUp end={totalValorNotariado} isCurrency={true} />
            </p>
          </div>
          <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <button onClick={() => setActiveOverlay('valor')} className="bg-white text-slate-900 border border-slate-200 shadow-xl px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300 hover:bg-slate-50">
              Ver Detalles <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

      </div>

      {/* Resumen de Estado de Pagarés (30 días) */}
      <div className={`rounded-[2.5rem] p-6 md:p-8 flex flex-col md:flex-row gap-8 ${esPlanFull ? 'bg-[#F4F4F0]/80 dark:bg-[#12141C]/80 backdrop-blur-xl border border-amber-200/40 dark:border-amber-500/30 shadow-[0_8px_32px_0_rgba(0,0,0,0.06)]' : 'bg-white border border-slate-100 shadow-sm'}`}>
        <div className="flex flex-col flex-1 gap-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <PieChartIcon className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">Estado de Pagarés</h3>
          </div>
          <p className="text-slate-500 text-sm leading-relaxed max-w-md">
            Distribución de los pagarés registrados en los últimos 30 días según su estado operativo (Pendiente, Cobrado, Vencido, Anulado).
          </p>
          
          <div className="mt-4 flex flex-col gap-3">
            {chartData.map(entry => (
              <div key={entry.name} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-sm font-bold text-slate-700 flex-1">{entry.name}</span>
                <span className="text-sm font-black text-slate-900">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex-1 h-[300px] w-full box-border min-w-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      
      {/* Últimos Registros */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-xl font-bold font-serif text-slate-800">Gestión de Escritos (O.L.G.A.)</h3>
        </div>
        <div className="p-6 md:p-8">
          <div className="space-y-4">
            {escritos.slice(0, 10).map((escrito, idx) => {
              const previewText = escrito.texto ? escrito.texto.substring(0, 80) + '...' : '';
              let dateStr = 'Fecha desconocida';
              if (escrito.createdAt) {
                 dateStr = new Date(escrito.createdAt).toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
              } else if (escrito.fechaCreacion && typeof escrito.fechaCreacion.toMillis === 'function') {
                 dateStr = new Date(escrito.fechaCreacion.toMillis()).toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
              }
              
              return (
                <div 
                  key={escrito.id || idx}
                  className="p-4 rounded-2xl border bg-white border-slate-100 shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-blue-50 text-blue-600">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800">
                        {escrito.tipo || 'Documento Generado'}
                      </h4>
                      <div className="text-xs text-slate-500 mt-1 max-w-[200px] md:max-w-md truncate">
                        {previewText}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between md:flex-col md:items-end gap-1.5">
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {dateStr}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-700">
                        Por: {escrito.creator_name || 'Titular'}
                      </span>
                      {escrito.creator_role === 'operador' && (
                        <span className="text-[9px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-md">
                          Operador
                        </span>
                      )}
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                        Guardado
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {escritos.length === 0 && (
              <div className="text-center py-8 text-slate-400 font-bold text-sm">
                Aún no hay documentos generados por O.L.G.A.
              </div>
            )}
          </div>
        </div>
      </div>

      {activeOverlay === 'pagares' && (
        <OverlayDetails 
          title="Listado de Pagarés"
          icon={<FileText className="w-6 h-6" />}
          onClose={() => setActiveOverlay(null)}
          items={pagares}
          type="pagares"
          onSelectPagare={(id) => {
            setEditingPagareId(id);
            setIsPagareEditorOpen(true);
          }}
        />
      )}

      {activeOverlay === 'personas' && (
        <OverlayDetails 
          title="Personas Registradas"
          icon={<Users className="w-6 h-6" />}
          onClose={() => setActiveOverlay(null)}
          items={effectivePersonas}
          type="personas"
          onSelectPersona={(id) => {
            setEditingPersonaId(id);
            setIsPersonasEditorOpen(true);
          }}
        />
      )}

      {activeOverlay === 'escritos' && (
        <OverlayDetails 
          title="Escritos Guardados"
          icon={<Clock className="w-6 h-6" />}
          onClose={() => setActiveOverlay(null)}
          items={escritos}
          type="escritos"
          onOpenDocument={onOpenDocument}
        />
      )}
      {activeOverlay === 'valor' && (
        <OverlayDetails 
          title="Pagarés por Valor Notariado"
          icon={<DollarSign className="w-6 h-6" />}
          onClose={() => setActiveOverlay(null)}
          items={[...pagares].filter(p => p.status !== 'anulado').sort((a, b) => b.valor_total - a.valor_total)}
          type="pagares"
          onSelectPagare={(id) => {
            setEditingPagareId(id);
            setIsPagareEditorOpen(true);
          }}
        />
      )}
      {activeOverlay === 'vencidos' && (
        <OverlayDetails 
          title="Pagarés Vencidos"
          icon={<AlertTriangle className="w-6 h-6 text-red-500" />}
          onClose={() => setActiveOverlay(null)}
          items={pagaresVencidos}
          type="pagares"
          onSelectPagare={(id) => {
            setEditingPagareId(id);
            setIsPagareEditorOpen(true);
          }}
        />
      )}
      {activeOverlay === 'vencimientos' && (
        <OverlayDetails 
          title="Próximos Vencimientos (7 días)"
          icon={<AlertTriangle className="w-6 h-6 text-amber-500" />}
          onClose={() => setActiveOverlay(null)}
          items={pagaresProximosAVencer}
          type="pagares"
          onSelectPagare={(id) => {
            setEditingPagareId(id);
            setIsPagareEditorOpen(true);
          }}
        />
      )}

      {isPagareEditorOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm animate-fade-in flex flex-col">
          <div className="flex-1 bg-slate-50 overflow-y-auto">
            <div className="max-w-7xl mx-auto p-4 md:p-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold font-serif text-slate-800">Editor de Pagaré</h2>
                <button 
                  onClick={() => { setIsPagareEditorOpen(false); setEditingPagareId(null); }}
                  className="p-2 bg-white rounded-xl shadow-sm text-slate-500 hover:text-slate-800 border border-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <PagaresTab
                pagares={pagares}
                personas={personas}
                config={config}
                onAddPagare={onAddPagare}
                onUpdatePagare={onUpdatePagare}
                onDeletePagare={onDeletePagare}
                onAddPersona={onAddPersona}
                onSelectPagareForPreview={onSelectPagareForPreview!}
                isAdmin={isAdmin}
                userData={userData}
                initialPanelView="create"
                initialEditingId={editingPagareId}
                onClose={() => { setIsPagareEditorOpen(false); setEditingPagareId(null); }}
              />
            </div>
          </div>
        </div>
      )}

      {isPersonasEditorOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm animate-fade-in flex flex-col">
          <div className="flex-1 bg-slate-50 overflow-y-auto">
            <div className="max-w-7xl mx-auto p-4 md:p-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold font-serif text-slate-800">Fichero de Personas</h2>
                <button 
                  onClick={() => { setIsPersonasEditorOpen(false); setEditingPersonaId(null); }}
                  className="p-2 bg-white rounded-xl shadow-sm text-slate-500 hover:text-slate-800 border border-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <PersonasTab
                personas={personas}
                onAddPersona={onAddPersona}
                onUpdatePersona={onUpdatePersona}
                onDeletePersona={onDeletePersona}
                isAdmin={isAdmin}
                initialEditingId={editingPersonaId}
                onClose={() => { setIsPersonasEditorOpen(false); setEditingPersonaId(null); }}
              />
            </div>
          </div>
        </div>
      )}

      {isWhatsAppEnabled && pagareForWhatsApp && (() => {
        const acreedorPersona = effectivePersonas.find((p) => p.id === pagareForWhatsApp.acreedor_id);
        const normDoc = (v?: string) => String(v || '').replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
        const deudorDocNorm = normDoc(pagareForWhatsApp.deudor_documento_raw);
        const deudorNameNorm = String(
          pagareForWhatsApp.deudor_nombre_raw || (pagareForWhatsApp as any).nombreDeudor || ''
        )
          .trim()
          .toLowerCase();

        const deudorPersona =
          effectivePersonas.find((p) => p.id === pagareForWhatsApp.deudor_id) ||
          (deudorDocNorm ? effectivePersonas.find((p) => normDoc(p.nro_documento) === deudorDocNorm) : undefined) ||
          (deudorNameNorm
            ? effectivePersonas.find(
                (p) => `${p.nombre || ''} ${p.apellido || ''}`.trim().toLowerCase() === deudorNameNorm
              )
            : undefined);

        const codeudor1Persona = effectivePersonas.find((p) => p.id === pagareForWhatsApp.codeudor1_id);
        const codeudor2Persona = effectivePersonas.find((p) => p.id === pagareForWhatsApp.codeudor2_id);

        const nombreAcreedorWa =
          pagareForWhatsApp.acreedor_nombre_raw ||
          (acreedorPersona ? `${acreedorPersona.nombre || ''} ${acreedorPersona.apellido || ''}`.trim() : '') ||
          'Acreedor / Beneficiario';
        const docAcreedorWa =
          pagareForWhatsApp.acreedor_documento_raw || acreedorPersona?.nro_documento || '';
        const domAcreedorWa =
          pagareForWhatsApp.acreedor_domicilio_raw || acreedorPersona?.domicilio || '';

        const nombreDeudorWa =
          pagareForWhatsApp.deudor_nombre_raw ||
          (deudorPersona ? `${deudorPersona.nombre || ''} ${deudorPersona.apellido || ''}`.trim() : '') ||
          (pagareForWhatsApp as any).nombreDeudor ||
          'Cliente';
        const docDeudorWa =
          pagareForWhatsApp.deudor_documento_raw || deudorPersona?.nro_documento || '';
        const domDeudorWa =
          pagareForWhatsApp.deudor_domicilio_raw || deudorPersona?.domicilio || '';
        const telefonoDeudorWa = String(
          (pagareForWhatsApp as any).deudor_telefono_raw ||
            (pagareForWhatsApp as any).deudorTelefono ||
            (pagareForWhatsApp as any).telefonoDeudor ||
            deudorPersona?.telefono ||
            ''
        ).trim();

        const montoValor = Number(pagareForWhatsApp.valor_total || (pagareForWhatsApp as any).monto || 0);
        const monCode = (pagareForWhatsApp.moneda || 'PYG').toUpperCase();
        const monSimbolo = monCode === 'USD' ? 'US$' : monCode === 'BRL' ? 'R$' : 'Gs.';
        const montoParaMensaje =
          monCode === 'PYG' || monCode === 'GS'
            ? `Gs. ${formatCurrencyValue(montoValor, 'PYG')}`
            : `${monSimbolo} ${formatCurrencyValue(montoValor, monCode)}`;

        const dueInfoWa = getTableroPagareDueInfo(pagareForWhatsApp);
        const rawFechaVenc =
          dueInfoWa.dueDateRaw ||
          pagareForWhatsApp.cronograma?.find((c: any) => c.estado !== 'cobrado' && c.pagado !== true)?.fecha_pag ||
          pagareForWhatsApp.cronograma?.[0]?.fecha_pag ||
          pagareForWhatsApp.fecha_primer_pago ||
          '';
        const fechaVencDate = parseTableroLocalYmd(rawFechaVenc || undefined);
        const fechaVencFmt = fechaVencDate
          ? `${String(fechaVencDate.getDate()).padStart(2, '0')}/${String(fechaVencDate.getMonth() + 1).padStart(2, '0')}/${fechaVencDate.getFullYear()}`
          : rawFechaVenc || 'A confirmar';
        const escribaniaNombreWa =
          workspaceName ||
          userData?.razonSocial ||
          userData?.nombreEscribania ||
          config?.escribania?.nombre ||
          'Escribanía Titular';
        const correlativoStr = String(pagareForWhatsApp.correlativo || 'S/N').padStart(4, '0');

        const totalCuotas = pagareForWhatsApp.cronograma?.length || 1;
        const nextPendingIdx =
          pagareForWhatsApp.cronograma?.findIndex((c: any) => c.estado !== 'cobrado' && c.pagado !== true) ?? -1;
        const cuotaPlazo =
          totalCuotas > 1
            ? nextPendingIdx >= 0
              ? `Cuota ${pagareForWhatsApp.cronograma[nextPendingIdx].numero_cuota} de ${totalCuotas}`
              : `${totalCuotas} cuotas`
            : 'Pago único';

        const pdfPagare = generatePagarePdfBase64({
          numero: correlativoStr,
          certificadoFirmasNro: pagareForWhatsApp.certificado_firmas_nro,
          escribania: {
            nombre: escribaniaNombreWa,
            ruc: userData?.ruc || '',
            registro: userData?.registroNotarial || config?.escribania?.nro_registro || '',
            telefono: userData?.telefono || config?.escribania?.telefono || '',
            direccion: userData?.direccion || config?.escribania?.direccion || '',
          },
          acreedorNombre: nombreAcreedorWa,
          acreedorDocumento: docAcreedorWa,
          acreedorDomicilio: domAcreedorWa,
          deudorNombre: nombreDeudorWa,
          deudorDocumento: docDeudorWa,
          deudorDomicilio: domDeudorWa,
          codeudor1Nombre:
            pagareForWhatsApp.codeudor1_nombre_raw ||
            (codeudor1Persona ? `${codeudor1Persona.nombre || ''} ${codeudor1Persona.apellido || ''}`.trim() : ''),
          codeudor1Documento: pagareForWhatsApp.codeudor1_documento_raw || codeudor1Persona?.nro_documento,
          codeudor2Nombre:
            pagareForWhatsApp.codeudor2_nombre_raw ||
            (codeudor2Persona ? `${codeudor2Persona.nombre || ''} ${codeudor2Persona.apellido || ''}`.trim() : ''),
          codeudor2Documento: pagareForWhatsApp.codeudor2_documento_raw || codeudor2Persona?.nro_documento,
          montoValor,
          moneda: monCode,
          cuotaPlazo,
          fechaEmision: pagareForWhatsApp.created_at,
          fechaVencimiento: rawFechaVenc,
          lugarPago:
            (pagareForWhatsApp as any).ciudadEmision ||
            (pagareForWhatsApp as any).ciudad ||
            userData?.ciudad ||
            config?.escribania?.ciudad ||
            config?.escribania?.direccion ||
            'Asunción, Paraguay',
          tasaInteres:
            pagareForWhatsApp.interesPersonalizado ||
            pagareForWhatsApp.tasaInteres ||
            pagareForWhatsApp.tasa_interes,
          cuerpoTexto:
            pagareForWhatsApp.texto_personalizado ||
            pagareForWhatsApp.textoPersonalizado ||
            pagareForWhatsApp.textoCuerpo ||
            pagareForWhatsApp.contenido,
        });

        const defaultMsg =
          dueInfoWa.status === 'vencido'
            ? `Estimado/a ${nombreDeudorWa}, le informamos desde ${escribaniaNombreWa} que el Pagaré Nº ${correlativoStr} por ${montoParaMensaje} registró vencimiento el ${fechaVencFmt}. Adjuntamos copia y quedamos atentos para coordinar la regularización.`
            : `Estimado/a ${nombreDeudorWa}, le recordamos cordialmente desde ${escribaniaNombreWa} que el Pagaré Nº ${correlativoStr} por ${montoParaMensaje} vence el ${fechaVencFmt}. Adjuntamos copia para su referencia. Quedamos a disposición.`;

        return (
          <WhatsAppSendModal
            isOpen={!!pagareForWhatsApp}
            onClose={() => setPagareForWhatsApp(null)}
            workspaceId={activeWorkspaceId || pagareForWhatsApp.userId || auth?.currentUser?.uid || ''}
            defaultPhone={telefonoDeudorWa}
            defaultMessage={defaultMsg}
            documentTitle={`Pagaré Notarial Nº ${correlativoStr}`}
            fileBase64={pdfPagare.fileBase64}
            fileName={pdfPagare.fileName}
            mimetype="application/pdf"
          />
        );
      })()}
    </div>
  );
};
