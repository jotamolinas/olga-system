import React, { useEffect, useMemo, useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  Mail,
  Megaphone,
  Phone,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { db } from '../services/auth';
import { draftNotificationWithAI } from '../services/gemini';

export type CampaignSegment = 'all' | 'plan_full' | 'active' | 'trial' | 'expired' | 'cortesia';
export type AnnouncementType = 'informativo' | 'importante' | 'novedad' | 'mantenimiento' | 'promocion';
export type CenterTab = 'aviso' | 'masiva';

export interface AnnouncementViewer {
  uid: string;
  nombre: string;
  email: string;
  vistoEn: string;
}

export interface AnnouncementHistoryItem {
  announcementId: string;
  title: string;
  message: string;
  type: AnnouncementType;
  targetSegment: CampaignSegment;
  targetCount?: number;
  sentAt: string;
}

export interface GlobalAnnouncementDoc {
  active: boolean;
  announcementId?: string;
  title: string;
  message: string;
  type: AnnouncementType;
  targetSegment: CampaignSegment;
  vistoPor?: AnnouncementViewer[];
  historialReciente?: AnnouncementHistoryItem[];
  updatedAt?: unknown;
}

export interface NotificationRecipientUser {
  id: string;
  email: string;
  telefono: string;
  nombre: string;
  razonSocial: string;
  plan: string;
  estadoSuscripcion: 'activo' | 'prueba' | 'pendiente' | 'vencido';
  categoriaCuenta: 'cliente' | 'cortesia' | 'equipo';
}

export const SEGMENT_OPTIONS: { id: CampaignSegment; label: string }[] = [
  { id: 'all', label: 'Todos los usuarios' },
  { id: 'plan_full', label: 'Solo Plan Full' },
  { id: 'active', label: 'Clientes Activos' },
  { id: 'trial', label: 'Solo Prueba / Gratis' },
  { id: 'expired', label: 'Vencidos' },
  { id: 'cortesia', label: 'Cortesía / Equipo' },
];

export const ANNOUNCEMENT_TYPE_LABELS: Record<AnnouncementType, string> = {
  informativo: 'Informativo',
  importante: 'Importante',
  novedad: 'Novedad',
  mantenimiento: 'Mantenimiento',
  promocion: 'Promoción',
};

const STANDARDIZED_NOTIFICATION_TEMPLATES: {
  id: string;
  label: string;
  type: AnnouncementType;
  title: string;
  message: string;
}[] = [
  {
    id: 'mantenimiento',
    label: 'Mantenimiento',
    type: 'mantenimiento',
    title: 'Ventana programada de mantenimiento del sistema',
    message:
      'Estimado/a usuario/a: realizaremos tareas programadas de optimización y seguridad en O.L.G.A. durante una breve ventana técnica. Tus pagarés, escritos y comprobantes permanecerán íntegramente resguardados.',
  },
  {
    id: 'nueva_funcion',
    label: 'Nueva Función',
    type: 'novedad',
    title: 'Nueva función disponible en tu consola O.L.G.A.',
    message:
      'Ya se encuentra habilitada una nueva mejora en tu plataforma para agilizar la gestión documental y la precisión de impresión oficial en tu escribanía. Ingresa al módulo correspondiente para probarla hoy.',
  },
  {
    id: 'vencimiento_plan',
    label: 'Vencimiento / Plan',
    type: 'importante',
    title: 'Recordatorio de renovación y continuidad de tu plan',
    message:
      'Te recordamos verificar la vigencia de tu suscripción en el módulo de Configuración para evitar interrupciones en tus módulos habilitados. Si ya realizaste el pago, adjunta tu comprobante para la aprobación inmediata.',
  },
  {
    id: 'recordatorio_legal',
    label: 'Recordatorio Legal / Normativo',
    type: 'informativo',
    title: 'Recordatorio normativo y actualización documental',
    message:
      'Recordamos revisar y mantener actualizados los datos fiscales, membretes y parámetros de emisión conforme a las disposiciones notariales y tributarias vigentes en la República del Paraguay.',
  },
];

const MASS_CAMPAIGN_TEMPLATES: {
  id: string;
  label: string;
  asunto: string;
  mensaje: string;
}[] = [
  {
    id: 'novedades',
    label: 'Novedades y Actualizaciones',
    asunto: 'Novedades en O.L.G.A. Notarial — Nuevas mejoras para tu escribanía',
    mensaje:
      '¡Hola {nombre}! Te saluda el equipo de O.L.G.A. Notarial.\n\nQueremos contarte que lanzamos nuevas mejoras en El Oráculo Legal IA, impresión multipágina de contratos y gestión de pagarés para agilizar el trabajo diario de tu estudio.\n\nIngresa hoy a tu consola para probar las últimas funciones.\n\nSoporte O.L.G.A.: soporte@olgatech.com.py | WhatsApp +595 983 440021',
  },
  {
    id: 'rescate_vencidos',
    label: 'Rescate de Vencidos',
    asunto: 'Reactiva tu cuenta en O.L.G.A. con un beneficio especial',
    mensaje:
      '¡Hola {nombre}! Te escribimos desde O.L.G.A. Notarial.\n\nVimos que tu período de acceso finalizó y queremos invitarte a reactivar tu cuenta con un descuento especial en el primer mes o una extensión breve de cortesía para que retomes tus escritos y pagarés.\n\nRespondenos por este medio y lo activamos al instante.\n\nContacto: soporte@olgatech.com.py | WhatsApp +595 983 440021',
  },
  {
    id: 'cierre_prueba',
    label: 'Cierre de Prueba',
    asunto: 'Últimos días de prueba en O.L.G.A. — Activa tu plan con beneficio',
    mensaje:
      '¡Hola {nombre}! Esperamos que estés aprovechando tu prueba gratuita en O.L.G.A. Notarial.\n\nAntes de que termine tu evaluación, queremos ofrecerte un beneficio de bienvenida para activar Plan Básico o Plan Pro hoy mismo y conservar toda tu gestión sin pausas.\n\nEscribinos y te pasamos los datos de activación.\n\nContacto: soporte@olgatech.com.py | WhatsApp +595 983 440021',
  },
  {
    id: 'promo_upgrade',
    label: 'Promo Upgrade',
    asunto: 'Desbloquea El Oráculo IA, Lienzo Notarial y Presupuestos en O.L.G.A.',
    mensaje:
      '¡Hola {nombre}! Gracias por formar parte de O.L.G.A. Notarial.\n\nTenemos una promoción exclusiva de upgrade al Plan Empresa / Plan Full para que desbloquees El Oráculo Legal IA, el Lienzo Notarial Oficial y el módulo de Presupuestos con condición preferencial.\n\nAvísanos si querés que actualicemos tu plan hoy.\n\nContacto: soporte@olgatech.com.py | WhatsApp +595 983 440021',
  },
];

interface NotificationsCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  registeredUsers: NotificationRecipientUser[];
  liveAnnouncement: GlobalAnnouncementDoc | null;
  announcementHistory: AnnouncementHistoryItem[];
  formatWhatsAppNumber: (tel: string) => string;
  onShowToast: (kind: 'ok' | 'err', text: string) => void;
}

export const NotificationsCenterModal: React.FC<NotificationsCenterModalProps> = ({
  isOpen,
  onClose,
  registeredUsers,
  liveAnnouncement,
  announcementHistory,
  formatWhatsAppNumber,
  onShowToast,
}) => {
  const [centerTab, setCenterTab] = useState<CenterTab>('aviso');
  const [campaignSegment, setCampaignSegment] = useState<CampaignSegment>('all');
  const [announcementType, setAnnouncementType] = useState<AnnouncementType>('informativo');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [publishingAnnouncement, setPublishingAnnouncement] = useState(false);
  const [announcementFeedback, setAnnouncementFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [showViewersList, setShowViewersList] = useState(false);

  // Redactor con IA
  const [aiDraftIdea, setAiDraftIdea] = useState('');
  const [isDraftingAI, setIsDraftingAI] = useState(false);
  const [aiDraftError, setAiDraftError] = useState<string | null>(null);

  // Campaña Masiva
  const [campaignSubject, setCampaignSubject] = useState(MASS_CAMPAIGN_TEMPLATES[0].asunto);
  const [campaignBody, setCampaignBody] = useState(MASS_CAMPAIGN_TEMPLATES[0].mensaje);
  const [emailsCopiedCount, setEmailsCopiedCount] = useState<number | null>(null);
  const [sentWhatsappIds, setSentWhatsappIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setAnnouncementFeedback(null);
    setAiDraftError(null);

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const segmentCounts = useMemo<Record<CampaignSegment, number>>(
    () => ({
      all: registeredUsers.length,
      plan_full: registeredUsers.filter(
        (u) => String(u.plan || '').toLowerCase().includes('full') && u.estadoSuscripcion !== 'vencido'
      ).length,
      active: registeredUsers.filter((u) => u.categoriaCuenta === 'cliente' && u.estadoSuscripcion === 'activo').length,
      trial: registeredUsers.filter((u) => u.categoriaCuenta === 'cliente' && u.estadoSuscripcion === 'prueba').length,
      expired: registeredUsers.filter((u) => u.estadoSuscripcion === 'vencido').length,
      cortesia: registeredUsers.filter((u) => u.categoriaCuenta === 'cortesia' || u.categoriaCuenta === 'equipo').length,
    }),
    [registeredUsers]
  );

  const segmentedUsers = useMemo(() => {
    switch (campaignSegment) {
      case 'plan_full':
        return registeredUsers.filter(
          (u) => String(u.plan || '').toLowerCase().includes('full') && u.estadoSuscripcion !== 'vencido'
        );
      case 'active':
        return registeredUsers.filter((u) => u.categoriaCuenta === 'cliente' && u.estadoSuscripcion === 'activo');
      case 'trial':
        return registeredUsers.filter((u) => u.categoriaCuenta === 'cliente' && u.estadoSuscripcion === 'prueba');
      case 'expired':
        return registeredUsers.filter((u) => u.estadoSuscripcion === 'vencido');
      case 'cortesia':
        return registeredUsers.filter((u) => u.categoriaCuenta === 'cortesia' || u.categoriaCuenta === 'equipo');
      case 'all':
      default:
        return registeredUsers;
    }
  }, [registeredUsers, campaignSegment]);

  const segmentValidEmails = useMemo(() => {
    const unique = new Set<string>();
    segmentedUsers.forEach((u) => {
      const mail = (u.email || '').trim();
      if (mail && mail.includes('@')) unique.add(mail);
    });
    return Array.from(unique);
  }, [segmentedUsers]);

  const segmentPhoneUsers = useMemo(() => {
    return segmentedUsers
      .map((u) => ({ user: u, whatsappNumber: formatWhatsAppNumber(u.telefono || '') }))
      .filter((item) => Boolean(item.whatsappNumber));
  }, [segmentedUsers, formatWhatsAppNumber]);

  const handleRedactarConIA = async () => {
    const idea = aiDraftIdea.trim();
    if (!idea) {
      setAiDraftError('Escribe una idea breve primero (ej: "Mañana a las 22hs actualizamos el servidor 15 min").');
      return;
    }
    setIsDraftingAI(true);
    setAiDraftError(null);
    setAnnouncementFeedback(null);

    try {
      const drafted = await draftNotificationWithAI(idea, {
        type: announcementType,
        targetSegment: campaignSegment,
      });
      setAnnouncementTitle(drafted.title);
      setAnnouncementMessage(drafted.message);
      onShowToast('ok', 'Borrador redactado con IA. Revísalo antes de publicar.');
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'No se pudo generar el borrador con IA. Puedes redactar el aviso manualmente.';
      setAiDraftError(msg);
    } finally {
      setIsDraftingAI(false);
    }
  };

  const handlePublicarAviso = async () => {
    const cleanTitle = announcementTitle.trim();
    const cleanMessage = announcementMessage.trim();
    if (!cleanTitle || !cleanMessage) {
      const msg = 'Ingresa un título y un mensaje antes de publicar el aviso.';
      setAnnouncementFeedback({ kind: 'err', text: msg });
      onShowToast('err', msg);
      return;
    }

    setPublishingAnnouncement(true);
    setAnnouncementFeedback(null);
    const segmentLabel = SEGMENT_OPTIONS.find((s) => s.id === campaignSegment)?.label || campaignSegment;
    const targetCount = segmentCounts[campaignSegment] ?? 0;
    const announcementId = String(Date.now());
    const newEntry: AnnouncementHistoryItem = {
      announcementId,
      title: cleanTitle,
      message: cleanMessage,
      type: announcementType,
      targetSegment: campaignSegment,
      targetCount,
      sentAt: new Date().toISOString(),
    };
    const nextHistory = [
      newEntry,
      ...announcementHistory.filter((item) => item.announcementId !== announcementId),
    ].slice(0, 10);

    try {
      await setDoc(doc(db, 'system_config', 'global_announcement'), {
        active: true,
        announcementId,
        title: cleanTitle,
        message: cleanMessage,
        type: announcementType,
        targetSegment: campaignSegment,
        vistoPor: [],
        historialReciente: nextHistory,
        updatedAt: serverTimestamp(),
      });
      setShowViewersList(false);
      const okMsg = `Aviso publicado con éxito para ${targetCount} ${targetCount === 1 ? 'usuario' : 'usuarios'} (${segmentLabel}).`;
      setAnnouncementFeedback({ kind: 'ok', text: okMsg });
      onShowToast('ok', `📢 ${okMsg}`);
    } catch (err: unknown) {
      console.error('Error al publicar aviso global:', err);
      const errMsg =
        err instanceof Error && err.message ? err.message : 'No se pudo enviar la notificación en Firestore.';
      setAnnouncementFeedback({ kind: 'err', text: errMsg });
      onShowToast('err', `Error al enviar: ${errMsg}`);
    } finally {
      setPublishingAnnouncement(false);
    }
  };

  const handleDesactivarAviso = async () => {
    setPublishingAnnouncement(true);
    setAnnouncementFeedback(null);
    try {
      await setDoc(
        doc(db, 'system_config', 'global_announcement'),
        {
          active: false,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setShowViewersList(false);
      const okMsg = 'Aviso global desactivado correctamente.';
      setAnnouncementFeedback({ kind: 'ok', text: okMsg });
      onShowToast('ok', okMsg);
    } catch (err: unknown) {
      console.error('Error al desactivar aviso global:', err);
      const errMsg = err instanceof Error && err.message ? err.message : 'No se pudo desactivar el aviso.';
      setAnnouncementFeedback({ kind: 'err', text: errMsg });
      onShowToast('err', `Error al desactivar: ${errMsg}`);
    } finally {
      setPublishingAnnouncement(false);
    }
  };

  const handleCopySegmentEmails = async (emails: string[]) => {
    if (emails.length === 0) return;
    const textToCopy = emails.join(', ');
    try {
      await navigator.clipboard.writeText(textToCopy);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setEmailsCopiedCount(emails.length);
    setTimeout(() => setEmailsCopiedCount(null), 3000);
  };

  if (!isOpen) return null;

  const gmailBccHref =
    segmentValidEmails.length > 0 && campaignSubject.trim() && campaignBody.trim()
      ? `https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(segmentValidEmails.join(','))}&su=${encodeURIComponent(campaignSubject)}&body=${encodeURIComponent(campaignBody)}`
      : '#';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-2.5 sm:p-4 md:p-6 animate-in fade-in duration-200 overflow-x-hidden">
      <div className="w-full max-w-3xl bg-[#121214] border border-white/10 rounded-3xl p-4 sm:p-5 md:p-6 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200 text-gray-200">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-3.5 mb-3.5 shrink-0 gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2.5 bg-purple-500/15 rounded-2xl border border-purple-500/30 text-purple-400 shrink-0">
              <Megaphone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white leading-snug">
                Centro de Notificaciones
              </h2>
              <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5 leading-snug">
                Publica banners globales en plataforma o lanza campañas por Email y WhatsApp.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white p-2 rounded-xl border border-white/10 transition-all cursor-pointer shrink-0"
            title="Cerrar (ESC)"
            aria-label="Cerrar Centro de Notificaciones"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selector de Audiencia (Segmentación en vivo) */}
        <div className="mb-3.5 shrink-0">
          <div className="flex items-center justify-between mb-1.5 gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Audiencia objetivo ({segmentedUsers.length} usuarios)
            </span>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5">
            {SEGMENT_OPTIONS.map((seg) => {
              const active = campaignSegment === seg.id;
              const count = segmentCounts[seg.id];
              return (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => setCampaignSegment(seg.id)}
                  className={`min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold transition-all cursor-pointer flex items-center justify-between sm:justify-start gap-1.5 border ${
                    active
                      ? 'bg-purple-600/25 border-purple-500/50 text-white'
                      : 'bg-[#09090b] border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                  }`}
                >
                  <span className="truncate">{seg.label}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md shrink-0 ${
                      active ? 'bg-purple-500/30 text-purple-100' : 'bg-white/5 text-gray-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pestañas del Centro */}
        <div className="grid grid-cols-2 sm:inline-flex items-center bg-[#09090b] border border-white/10 rounded-xl p-1 mb-3.5 shrink-0 sm:self-start gap-1">
          <button
            type="button"
            onClick={() => setCenterTab('aviso')}
            className={`min-h-[38px] px-2.5 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              centerTab === 'aviso'
                ? 'bg-white/10 text-white shadow-xs'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">Aviso en Plataforma</span>
          </button>
          <button
            type="button"
            onClick={() => setCenterTab('masiva')}
            className={`min-h-[38px] px-2.5 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              centerTab === 'masiva'
                ? 'bg-white/10 text-white shadow-xs'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Send className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="truncate">Campaña Masiva</span>
          </button>
        </div>

        {/* Contenido Scrollable */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 pr-0.5 space-y-4">
          {centerTab === 'aviso' ? (
            <>
              {/* Estado del aviso activo actualmente */}
              {liveAnnouncement?.active && (() => {
                const rawViewers = Array.isArray(liveAnnouncement.vistoPor) ? liveAnnouncement.vistoPor : [];
                const uniqueViewersMap = new Map<string, AnnouncementViewer>();
                rawViewers.forEach((v) => {
                  if (v && v.uid) {
                    uniqueViewersMap.set(v.uid, v);
                  }
                });
                const uniqueViewers = Array.from(uniqueViewersMap.values());
                const totalObjetivo = segmentCounts[liveAnnouncement.targetSegment] ?? 0;

                return (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Aviso activo actualmente
                          </span>
                          <span className="text-[10px] text-gray-400 uppercase font-mono">
                            {ANNOUNCEMENT_TYPE_LABELS[liveAnnouncement.type] || liveAnnouncement.type} •{' '}
                            {SEGMENT_OPTIONS.find((s) => s.id === liveAnnouncement.targetSegment)?.label ||
                              liveAnnouncement.targetSegment}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-white mt-1.5 break-words" title={liveAnnouncement.title}>
                          {liveAnnouncement.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-200 bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-1 rounded-lg">
                            <Eye className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>
                              Recibido / Visto por <strong>{uniqueViewers.length}</strong> de{' '}
                              <strong>{totalObjetivo}</strong> usuarios
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowViewersList((prev) => !prev)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-200 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            <span>Ver quiénes lo vieron</span>
                            {showViewersList ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleDesactivarAviso}
                        disabled={publishingAnnouncement}
                        className="min-h-[36px] px-3 py-1.5 rounded-xl bg-red-600/25 hover:bg-red-600/40 disabled:opacity-50 text-red-300 border border-red-500/35 text-xs font-bold transition-colors cursor-pointer shrink-0 self-start sm:self-center"
                      >
                        Desactivar Aviso
                      </button>
                    </div>

                    {showViewersList && (
                      <div className="bg-[#09090b]/90 border border-white/10 rounded-xl p-2.5 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800">
                        {uniqueViewers.length === 0 ? (
                          <p className="text-[11px] text-gray-400 text-center py-2">
                            Aún ningún usuario del segmento ha visualizado este aviso.
                          </p>
                        ) : (
                          <div className="divide-y divide-white/5">
                            {uniqueViewers.map((viewer) => {
                              let horaFmt = '';
                              if (viewer.vistoEn) {
                                const dt = new Date(viewer.vistoEn);
                                if (!isNaN(dt.getTime())) {
                                  horaFmt = dt.toLocaleString('es-PY', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  });
                                }
                              }
                              return (
                                <div
                                  key={viewer.uid}
                                  className="py-1.5 px-1 flex items-center justify-between gap-2 text-[11px]"
                                >
                                  <div className="min-w-0">
                                    <p className="font-semibold text-gray-200 truncate">
                                      {viewer.nombre || viewer.email || viewer.uid}
                                    </p>
                                    {viewer.email && (
                                      <p className="text-[10px] text-gray-500 truncate">{viewer.email}</p>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-mono text-emerald-300 shrink-0">
                                    {horaFmt || 'Visto'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Plantillas estandarizadas (1 clic) */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  Plantillas estandarizadas (1 clic)
                </label>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5">
                  {STANDARDIZED_NOTIFICATION_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        setAnnouncementType(tpl.type);
                        setAnnouncementTitle(tpl.title);
                        setAnnouncementMessage(tpl.message);
                        setAiDraftError(null);
                        setAnnouncementFeedback(null);
                      }}
                      className="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#09090b] hover:bg-white/5 border border-white/10 hover:border-purple-500/40 text-[11px] font-semibold text-gray-200 transition-colors cursor-pointer text-left sm:text-center truncate"
                      title={tpl.title}
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Redactor con IA */}
              <div className="bg-purple-500/[0.06] border border-purple-500/25 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-purple-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    Redactor con IA
                  </label>
                  <span className="text-[10px] text-gray-400">Opcional • Completa título y mensaje</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={aiDraftIdea}
                    onChange={(e) => {
                      setAiDraftIdea(e.target.value);
                      if (aiDraftError) setAiDraftError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isDraftingAI) {
                        e.preventDefault();
                        handleRedactarConIA();
                      }
                    }}
                    placeholder="Ej: Mañana a las 22hs actualizamos el servidor 15 minutos, no afecta pagarés guardados"
                    className="flex-1 min-h-[40px] bg-[#09090b] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleRedactarConIA}
                    disabled={isDraftingAI}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/45 disabled:opacity-50 text-purple-100 border border-purple-400/40 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0"
                  >
                    {isDraftingAI ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-purple-200/30 border-t-purple-200 rounded-full animate-spin" />
                        <span>Redactando...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                        <span>✨ Redactar con IA</span>
                      </>
                    )}
                  </button>
                </div>
                {aiDraftError && (
                  <div className="rounded-xl px-3 py-2 text-[11px] bg-red-500/10 border border-red-500/30 text-red-200 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                    <span className="leading-snug">{aiDraftError}</span>
                  </div>
                )}
              </div>

              {/* Tipo de Aviso */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  Tipo de aviso
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 sm:gap-2">
                  {[
                    {
                      id: 'informativo' as AnnouncementType,
                      label: 'Informativo',
                      clsActive: 'bg-blue-500/20 border-blue-400/50 text-blue-200',
                      defaultTitle: 'Aviso informativo de O.L.G.A.',
                      defaultMessage:
                        'Les compartimos una novedad operativa en su consola de O.L.G.A. Sus registros, pagarés y documentos continúan disponibles con normalidad. Ante cualquier consulta, nuestro equipo de soporte está a disposición.',
                    },
                    {
                      id: 'importante' as AnnouncementType,
                      label: 'Importante',
                      clsActive: 'bg-amber-500/20 border-amber-400/50 text-amber-200',
                      defaultTitle: 'Aviso importante para su cuenta en O.L.G.A.',
                      defaultMessage:
                        'Atención: les pedimos revisar los datos de su escribanía, vigencia de timbrado o estado de suscripción en la consola de O.L.G.A. para evitar interrupciones en la emisión de documentos.',
                    },
                    {
                      id: 'novedad' as AnnouncementType,
                      label: 'Novedad',
                      clsActive: 'bg-purple-500/20 border-purple-400/50 text-purple-200',
                      defaultTitle: 'Nueva mejora disponible en O.L.G.A.',
                      defaultMessage:
                        'Ya se encuentra disponible una nueva mejora en O.L.G.A. pensada para agilizar su trabajo diario en la escribanía. Ingrese a su consola para conocerla y utilizarla.',
                    },
                    {
                      id: 'mantenimiento' as AnnouncementType,
                      label: 'Mantenimiento',
                      clsActive: 'bg-white text-zinc-950 border-white font-semibold',
                      defaultTitle: 'Ventana de mantenimiento programado en O.L.G.A.',
                      defaultMessage:
                        'Informamos que realizaremos tareas de mantenimiento técnico programado en O.L.G.A. Durante ese breve lapso la plataforma podría presentar pausas momentáneas; sus datos y documentos guardados permanecen seguros.',
                    },
                    {
                      id: 'promocion' as AnnouncementType,
                      label: 'Promoción',
                      clsActive: 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200',
                      defaultTitle: 'Beneficio especial disponible en O.L.G.A.',
                      defaultMessage:
                        'Aproveche las condiciones y beneficios vigentes en O.L.G.A. para potenciar la gestión diaria de su escribanía o estudio. Consulte los detalles directamente desde su consola.',
                    },
                  ].map((t) => {
                    const selected = announcementType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setAnnouncementType(t.id);
                          setAnnouncementTitle(t.defaultTitle);
                          setAnnouncementMessage(t.defaultMessage);
                          setAiDraftError(null);
                          setAnnouncementFeedback(null);
                        }}
                        className={`min-h-[38px] px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center truncate ${
                          selected
                            ? t.clsActive
                            : 'bg-[#09090b] border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Título & Mensaje */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                    Título del aviso
                  </label>
                  <input
                    type="text"
                    value={announcementTitle}
                    onChange={(e) => setAnnouncementTitle(e.target.value)}
                    placeholder="Ej: Nueva actualización disponible en O.L.G.A."
                    className="w-full min-h-[42px] bg-[#09090b] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                    Mensaje del aviso
                  </label>
                  <textarea
                    rows={4}
                    value={announcementMessage}
                    onChange={(e) => setAnnouncementMessage(e.target.value)}
                    placeholder="Redacta el aviso que verán los usuarios del segmento seleccionado..."
                    className="w-full bg-[#09090b] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors resize-y leading-relaxed"
                  />
                </div>
              </div>

              {announcementFeedback && (
                <div
                  className={`rounded-xl px-3.5 py-2.5 text-xs border flex items-center gap-2 ${
                    announcementFeedback.kind === 'ok'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-red-500/10 border-red-500/30 text-red-300'
                  }`}
                >
                  {announcementFeedback.kind === 'ok' ? (
                    <CheckCircle className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                  )}
                  <span className="leading-snug">{announcementFeedback.text}</span>
                </div>
              )}

              {announcementHistory.length > 0 && (
                <div className="pt-3 border-t border-white/10 space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Historial de avisos recientes ({announcementHistory.length})
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 pr-1">
                    {announcementHistory.map((item) => {
                      const segLabel =
                        SEGMENT_OPTIONS.find((s) => s.id === item.targetSegment)?.label || item.targetSegment;
                      const typeLabel = ANNOUNCEMENT_TYPE_LABELS[item.type] || item.type;
                      const sentDate = item.sentAt ? new Date(item.sentAt) : null;
                      const dateStr =
                        sentDate && !isNaN(sentDate.getTime())
                          ? sentDate.toLocaleString('es-PY', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '';
                      return (
                        <div
                          key={item.announcementId}
                          className="p-2.5 rounded-xl bg-[#09090b] border border-white/10 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300">
                              {typeLabel}
                            </span>
                            <span className="text-[10px] text-gray-500 font-mono">{dateStr}</span>
                          </div>
                          <p className="text-xs font-semibold text-white break-words">{item.title}</p>
                          {item.message && (
                            <p className="text-[11px] text-gray-400 line-clamp-2 break-words">{item.message}</p>
                          )}
                          <p className="text-[10px] text-gray-500 font-mono">
                            Destino: {segLabel}
                            {typeof item.targetCount === 'number' ? ` (${item.targetCount})` : ''}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Plantillas Campaña Masiva */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  Plantillas rápidas de campaña
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {MASS_CAMPAIGN_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        setCampaignSubject(tpl.asunto);
                        setCampaignBody(tpl.mensaje);
                      }}
                      className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-[#09090b] hover:bg-white/5 border border-white/10 hover:border-blue-500/40 text-[11px] font-medium text-gray-300 transition-colors cursor-pointer"
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Asunto & Mensaje */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                    Asunto (para Gmail CCO)
                  </label>
                  <input
                    type="text"
                    value={campaignSubject}
                    onChange={(e) => setCampaignSubject(e.target.value)}
                    placeholder="Asunto de la campaña..."
                    className="w-full min-h-[42px] bg-[#09090b] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      Mensaje
                    </label>
                    <span className="text-[10px] text-gray-500">
                      Usa <code className="font-mono text-purple-300">{'{nombre}'}</code> para personalizar cada WhatsApp
                    </span>
                  </div>
                  <textarea
                    rows={5}
                    value={campaignBody}
                    onChange={(e) => setCampaignBody(e.target.value)}
                    placeholder="Escribe el mensaje de la campaña..."
                    className="w-full bg-[#09090b] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors resize-y leading-relaxed"
                  />
                </div>
              </div>

              {/* Acciones de Email en Lote */}
              <div className="bg-[#09090b] border border-white/10 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs min-w-0">
                  <p className="font-bold text-white">
                    Envío por Correo Electrónico ({segmentValidEmails.length} emails válidos)
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Copia los destinatarios o abre Gmail directamente con copia oculta (CCO).
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={segmentValidEmails.length === 0}
                    onClick={() => handleCopySegmentEmails(segmentValidEmails)}
                    className="min-h-[38px] px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {emailsCopiedCount !== null ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">¡{emailsCopiedCount} correos copiados!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Correos</span>
                      </>
                    )}
                  </button>

                  <a
                    href={gmailBccHref}
                    target="_blank"
                    rel="noreferrer"
                    aria-disabled={segmentValidEmails.length === 0 || !campaignSubject.trim() || !campaignBody.trim()}
                    onClick={(e) => {
                      if (segmentValidEmails.length === 0 || !campaignSubject.trim() || !campaignBody.trim()) {
                        e.preventDefault();
                      }
                    }}
                    className={`min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border ${
                      segmentValidEmails.length > 0 && campaignSubject.trim() && campaignBody.trim()
                        ? 'bg-blue-600/25 hover:bg-blue-600/40 text-blue-300 border-blue-500/35 cursor-pointer'
                        : 'bg-white/5 text-gray-500 border-white/5 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Abrir en Gmail (CCO)
                  </a>
                </div>
              </div>

              {/* Lista rápida de WhatsApp del segmento */}
              <div className="bg-[#09090b] border border-white/10 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-green-400 shrink-0" />
                    <span>Envío rápido por WhatsApp ({segmentPhoneUsers.length} con teléfono)</span>
                  </p>
                </div>

                {segmentPhoneUsers.length === 0 ? (
                  <p className="text-[11px] text-gray-500 py-3 text-center">
                    No hay usuarios con teléfono registrado en este segmento.
                  </p>
                ) : (
                  <div className="max-h-52 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 divide-y divide-white/5 pr-1">
                    {segmentPhoneUsers.map(({ user: segUser, whatsappNumber }) => {
                      const nombrePersona = segUser.razonSocial || segUser.nombre || 'Escribano/a';
                      const mensajePersonalizado = campaignBody.replace(/\{nombre\}/gi, nombrePersona);
                      const waUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(mensajePersonalizado)}`;
                      const isSent = sentWhatsappIds.includes(segUser.id);
                      return (
                        <div key={segUser.id} className="py-2 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-200 truncate">{nombrePersona}</p>
                            <p className="text-[10px] text-gray-500 font-mono truncate">
                              {segUser.telefono} • {segUser.plan || 'Prueba Gratuita'}
                            </p>
                          </div>
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => {
                              if (!campaignBody.trim()) {
                                e.preventDefault();
                                return;
                              }
                              setSentWhatsappIds((prev) =>
                                prev.includes(segUser.id) ? prev : [...prev, segUser.id]
                              );
                            }}
                            className={`min-h-[34px] px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-colors shrink-0 border ${
                              isSent
                                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
                                : 'bg-green-600/20 hover:bg-green-600/35 text-green-300 border-green-500/30'
                            }`}
                          >
                            {isSent ? (
                              <>
                                <Check className="w-3 h-3" />
                                Enviado ✓
                              </>
                            ) : (
                              <>
                                <Phone className="w-3 h-3" />
                                Enviar WhatsApp
                              </>
                            )}
                          </a>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 pt-3.5 border-t border-white/10 mt-3.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
          {centerTab === 'aviso' && (
            <button
              type="button"
              onClick={handlePublicarAviso}
              disabled={publishingAnnouncement}
              className="min-h-[40px] px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Megaphone className="w-3.5 h-3.5" />
              {publishingAnnouncement ? 'Publicando...' : 'Publicar Aviso'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
