import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, getDocs, doc, updateDoc, setDoc, onSnapshot, query, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/auth';
import { SuperAdminOnboarding } from './SuperAdminOnboarding';
import { 
  KeyRound, CheckCircle, XCircle, AlertTriangle, Users, FileText, 
  Activity, ExternalLink, ShieldCheck, ShieldAlert, Shield, 
  Search, DollarSign, Mail, Phone, Clock, Sparkles, Crown,
  Building, Zap, CheckCircle2, UserCheck, ShieldQuestion,
  MessageSquare, CreditCard, Check, Trash2, Maximize2, Minimize2, X,
  Megaphone, Copy, Bell, Send, Eye, ChevronDown, ChevronUp, MessageCircle
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area
} from 'recharts';

export interface RegisteredUser {
  id: string;
  email: string;
  telefono: string;
  nombre: string;
  razonSocial: string;
  plan: string;
  estadoSuscripcion: 'activo' | 'prueba' | 'pendiente' | 'vencido';
  estadoPago: string;
  modalidadPago: string;
  montoAPagar: number;
  timestamp: number;
  fechaFormateada: string;
  diasRestantes?: number;
  isRecent: boolean;
  categoriaCuenta: 'cliente' | 'cortesia' | 'equipo';
  whatsappEnabled?: boolean;
  lienzoEnabled?: boolean;
  presupuestoEnabled?: boolean;
  raw: any;
}

type AddonField = 'whatsappEnabled' | 'lienzoEnabled' | 'presupuestoEnabled';

const ADDON_MODULES: { field: AddonField; shortLabel: string; fullLabel: string }[] = [
  { field: 'whatsappEnabled', shortLabel: 'WhatsApp', fullLabel: 'WhatsApp IA' },
  { field: 'lienzoEnabled', shortLabel: 'Lienzo', fullLabel: 'Lienzo Notarial' },
  { field: 'presupuestoEnabled', shortLabel: 'Presup.', fullLabel: 'Presupuestos' },
];

const getEffectiveAddonState = (
  user: RegisteredUser,
  field: AddonField
): { enabled: boolean; isInherited: boolean } => {
  const emailLower = String(user.email || '').toLowerCase();
  const roleUpper = String(user.raw?.role || user.raw?.rol || '').toUpperCase();
  const isUserSuperAdmin =
    emailLower === 'jotamolinas@gmail.com' ||
    roleUpper === 'ADMIN' ||
    roleUpper === 'SUPERADMIN';

  if (isUserSuperAdmin) {
    return { enabled: true, isInherited: false };
  }

  const rawVal = user.raw?.[field] ?? user[field];
  if (rawVal === true) return { enabled: true, isInherited: false };
  if (rawVal === false) return { enabled: false, isInherited: false };

  if (field === 'whatsappEnabled') {
    return { enabled: false, isInherited: true };
  }

  const planLower = String(user.plan || '').toLowerCase();
  const planIncludesProPlus =
    planLower.includes('pro') ||
    planLower.includes('empresa') ||
    planLower.includes('full');
  return { enabled: planIncludesProPlus, isInherited: true };
};

interface PendingPayment {
  id: string;
  userId: string;
  email: string;
  nombreCliente?: string;
  montoAPagar: number;
  modalidadPago: string;
  urlComprobante: string;
  fechaSolicitud: any;
  planSolicitado: string;
}

interface PagareGlobal {
  id: string;
  userId: string;
  empresa?: string;
  acreedor_nombre: string;
  acreedor_documento?: string;
  deudor_nombre: string;
  deudor_cedula: string;
  monto: string | number;
  fecha_vencimiento: string;
  fecha_emision: string;
  created_at: any;
  userEmail?: string;
}

interface Metrics {
  totalUsers: number;
  activeUsers: number;
  totalPagares: number;
  aiQueries: number;
  alerts: number;
  clientesCount: number;
  equipoCortesiaCount: number;
}

type OfertaTemplateId =
  | 'cierre_prueba'
  | 'rescate_vencida'
  | 'upgrade_full'
  | 'promo_anual'
  | 'personalizado';

interface OfertaTemplateOption {
  id: OfertaTemplateId;
  title: string;
  subtitle: string;
  badge: string;
}

const OFERTA_TEMPLATES: OfertaTemplateOption[] = [
  {
    id: 'cierre_prueba',
    title: 'Cierre de Prueba (Últimos días)',
    subtitle: 'Activar Plan Básico o Pro con beneficio de bienvenida antes de expirar',
    badge: 'Conversión',
  },
  {
    id: 'rescate_vencida',
    title: 'Rescate de Cuenta Vencida',
    subtitle: 'Reactivar cuenta con extensión corta o descuento en el primer mes',
    badge: 'Reactivación',
  },
  {
    id: 'upgrade_full',
    title: 'Upgrade a Plan Full / Empresa',
    subtitle: 'Desbloquear El Oráculo Legal IA, Lienzo Notarial y Presupuestos',
    badge: 'Upsell',
  },
  {
    id: 'promo_anual',
    title: 'Descuento Especial / Promo Anual',
    subtitle: 'Oferta preferencial por pago semestral o anual con ahorro',
    badge: 'Ahorro',
  },
  {
    id: 'personalizado',
    title: 'Mensaje Personalizado',
    subtitle: 'Redactar asunto y cuerpo completamente desde cero',
    badge: 'Libre',
  },
];

const getDefaultOfertaTemplate = (estado: RegisteredUser['estadoSuscripcion']): OfertaTemplateId => {
  if (estado === 'vencido') return 'rescate_vencida';
  if (estado === 'activo') return 'upgrade_full';
  return 'cierre_prueba';
};

const buildOfertaTemplateContent = (
  templateId: OfertaTemplateId,
  user: RegisteredUser
): { asunto: string; mensaje: string } => {
  const displayName = user.razonSocial || user.nombre || 'Escribano/a';
  const planActual = user.plan || 'Prueba Gratuita';
  const diasTxt =
    typeof user.diasRestantes === 'number'
      ? user.diasRestantes === 1
        ? '1 día'
        : `${user.diasRestantes} días`
      : 'tus últimos días';

  switch (templateId) {
    case 'cierre_prueba':
      return {
        asunto: `Activa hoy tu Plan O.L.G.A. con beneficio de bienvenida — ${displayName}`,
        mensaje: `¡Hola ${displayName}! Te saluda el equipo de O.L.G.A. Notarial.\n\nVemos que actualmente estás en ${planActual} (${diasTxt} restantes de prueba). Antes de que expire tu período de evaluación, queremos ofrecerte un beneficio exclusivo de bienvenida para activar tu Plan Básico o Plan Pro hoy mismo y continuar sin interrupciones.\n\n¿Te enviamos los datos para activar tu cuenta hoy?\n\nContacto directo:\n• WhatsApp: +595 983 440021\n• Correo: soporte@olgatech.com.py`,
      };
    case 'rescate_vencida':
      return {
        asunto: `Reactiva tu cuenta en O.L.G.A. con beneficio especial — ${displayName}`,
        mensaje: `¡Hola ${displayName}! Te escribimos desde el equipo de O.L.G.A. Notarial.\n\nNotamos que tu cuenta (${planActual}) figura actualmente como vencida. Queremos ayudarte a retomar el trabajo en tu escribanía ofreciéndote una extensión corta de cortesía o un descuento especial en tu primer mes de reactivación.\n\nRespondenos por este medio y reactivamos tu acceso de inmediato.\n\nContacto directo:\n• WhatsApp: +595 983 440021\n• Correo: soporte@olgatech.com.py`,
      };
    case 'upgrade_full':
      return {
        asunto: `Desbloquea El Oráculo IA, Lienzo y Presupuestos en O.L.G.A. — ${displayName}`,
        mensaje: `¡Hola ${displayName}! Gracias por trabajar con nosotros en tu ${planActual}.\n\nQueremos invitarte a subir al Plan Empresa o Plan Full con una condición preferencial para clientes activos, desbloqueando de inmediato El Oráculo Legal IA, el Lienzo Notarial Oficial y el módulo completo de Presupuestos.\n\nEscribinos si querés que apliquemos el upgrade a tu escribanía hoy mismo.\n\nContacto directo:\n• WhatsApp: +595 983 440021\n• Correo: soporte@olgatech.com.py`,
      };
    case 'promo_anual':
      return {
        asunto: `Promo Anual / Semestral O.L.G.A. con ahorro exclusivo — ${displayName}`,
        mensaje: `¡Hola ${displayName}! Te saluda el equipo comercial de O.L.G.A. Notarial.\n\nPara tu cuenta (${planActual}), tenemos habilitada una promoción especial por pago semestral o anual con ahorro preferencial sobre la tarifa regular, congelando tu abono y sumando soporte prioritario para tu estudio.\n\nAvísanos si deseás recibir el detalle con el monto bonificado.\n\nContacto directo:\n• WhatsApp: +595 983 440021\n• Correo: soporte@olgatech.com.py`,
      };
    case 'personalizado':
    default:
      return {
        asunto: '',
        mensaje: '',
      };
  }
};

type CampaignSegment = 'all' | 'active' | 'trial' | 'expired' | 'cortesia';
type AnnouncementType = 'novedad' | 'mantenimiento' | 'promocion';
type CenterTab = 'aviso' | 'masiva';

interface AnnouncementViewer {
  uid: string;
  nombre: string;
  email: string;
  vistoEn: string;
}

interface GlobalAnnouncementDoc {
  active: boolean;
  announcementId?: string;
  title: string;
  message: string;
  type: AnnouncementType;
  targetSegment: CampaignSegment;
  vistoPor?: AnnouncementViewer[];
  updatedAt?: any;
}

const SEGMENT_OPTIONS: { id: CampaignSegment; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Clientes Activos' },
  { id: 'trial', label: 'En Prueba' },
  { id: 'expired', label: 'Vencidos' },
  { id: 'cortesia', label: 'Cortesía / Equipo' },
];

const ANNOUNCEMENT_QUICK_TEMPLATES: {
  id: string;
  label: string;
  type: AnnouncementType;
  title: string;
  message: string;
}[] = [
  {
    id: 'nueva_actualizacion',
    label: 'Nueva actualización disponible',
    type: 'novedad',
    title: 'Nueva actualización disponible en O.L.G.A.',
    message:
      'Mejoramos la precisión de impresión oficial multipágina y la velocidad de El Oráculo Legal IA para tus contratos y dictámenes notariales.',
  },
  {
    id: 'proximas_novedades',
    label: 'Próximas novedades en O.L.G.A.',
    type: 'novedad',
    title: 'Próximas novedades para tu escribanía',
    message:
      'Muy pronto habilitaremos nuevas herramientas de automatización documental y facturación electrónica SIFEN integradas en tu consola.',
  },
  {
    id: 'mantenimiento',
    label: 'Aviso de mantenimiento',
    type: 'mantenimiento',
    title: 'Ventana programada de mantenimiento',
    message:
      'Realizaremos tareas de optimización de servidores hoy de 22:00 a 22:20 hs. Tus documentos y pagarés permanecerán resguardados sin interrupciones.',
  },
  {
    id: 'promo_especial',
    label: 'Promoción especial',
    type: 'promocion',
    title: 'Beneficio exclusivo por tiempo limitado',
    message:
      'Activa o actualiza a Plan Pro / Empresa / Full esta semana y accede a condiciones preferenciales y soporte prioritario.',
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

export const SuperAdminDashboard: React.FC = () => {
  const [adminSubTab, setAdminSubTab] = useState<'metricas' | 'onboarding'>('metricas');
  const [metrics, setMetrics] = useState<Metrics>({ totalUsers: 0, activeUsers: 0, totalPagares: 0, aiQueries: 0, alerts: 0, clientesCount: 0, equipoCortesiaCount: 0 });
  const [loading, setLoading] = useState(true);
  const [pendingTicketsCount, setPendingTicketsCount] = useState<number>(0);
  const [pendingTickets, setPendingTickets] = useState<any[]>([]);

  // Centro de Avisos & Campañas Masivas state
  const [centerModalOpen, setCenterModalOpen] = useState(false);
  const [centerTab, setCenterTab] = useState<CenterTab>('aviso');
  const [campaignSegment, setCampaignSegment] = useState<CampaignSegment>('all');
  const [announcementType, setAnnouncementType] = useState<AnnouncementType>('novedad');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [publishingAnnouncement, setPublishingAnnouncement] = useState(false);
  const [announcementFeedback, setAnnouncementFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [floatingToast, setFloatingToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState<GlobalAnnouncementDoc | null>(null);
  const [showViewersList, setShowViewersList] = useState(false);
  const [campaignSubject, setCampaignSubject] = useState(MASS_CAMPAIGN_TEMPLATES[0].asunto);
  const [campaignBody, setCampaignBody] = useState(MASS_CAMPAIGN_TEMPLATES[0].mensaje);
  const [emailsCopiedCount, setEmailsCopiedCount] = useState<number | null>(null);
  const [sentWhatsappIds, setSentWhatsappIds] = useState<string[]>([]);
  const centerModalOpenRef = useRef(false);
  centerModalOpenRef.current = centerModalOpen;

  const showToast = (kind: 'ok' | 'err', text: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setFloatingToast({ kind, text });
    toastTimerRef.current = window.setTimeout(() => {
      setFloatingToast(null);
      toastTimerRef.current = null;
    }, 5000);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const handlePublicarAviso = async () => {
    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      const msg = 'Ingresa un título y un mensaje antes de publicar el aviso.';
      setAnnouncementFeedback({ kind: 'err', text: msg });
      showToast('err', msg);
      return;
    }
    setPublishingAnnouncement(true);
    setAnnouncementFeedback(null);
    const segmentLabel = SEGMENT_OPTIONS.find((s) => s.id === campaignSegment)?.label || campaignSegment;
    const targetCount = segmentCounts[campaignSegment] ?? 0;

    try {
      await setDoc(doc(db, 'system_config', 'global_announcement'), {
        active: true,
        announcementId: String(Date.now()),
        title: announcementTitle.trim(),
        message: announcementMessage.trim(),
        type: announcementType,
        targetSegment: campaignSegment,
        vistoPor: [],
        updatedAt: serverTimestamp(),
      });
      setShowViewersList(false);
      const okMsg = `✅ Aviso publicado para ${targetCount} usuarios del segmento ${segmentLabel}`;
      setAnnouncementFeedback({ kind: 'ok', text: okMsg });
      showToast('ok', okMsg);
    } catch (err: any) {
      console.error('Error al publicar aviso global:', err);
      const errMsg = err?.message || 'No se pudo publicar el aviso en Firestore.';
      setAnnouncementFeedback({ kind: 'err', text: errMsg });
      showToast('err', `Error al publicar: ${errMsg}`);
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
      showToast('ok', okMsg);
    } catch (err: any) {
      console.error('Error al desactivar aviso global:', err);
      const errMsg = err?.message || 'No se pudo desactivar el aviso.';
      setAnnouncementFeedback({ kind: 'err', text: errMsg });
      showToast('err', `Error al desactivar: ${errMsg}`);
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

  const handleMarcarEnProceso = async (ticketId: string) => {
    try {
      await updateDoc(doc(db, 'support_tickets', ticketId), { 
        estado: 'en_proceso',
        respuestaAdmin: 'Hemos revisado tu consulta en el buzón y nuestro equipo ya está analizando tu inquietud. Te responderemos a la brevedad.',
        leidoPorUsuario: false,
        fechaActualizacion: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error al poner en proceso:", err);
    }
  };

  const handleResolverTicket = async (ticketId: string) => {
    try {
      await updateDoc(doc(db, 'support_tickets', ticketId), { 
        estado: 'resuelto',
        respuestaAdmin: 'Tu consulta ha sido atendida y marcada como resuelta por nuestro equipo de soporte. Pronto nos contactaremos por correo. Gracias.',
        leidoPorUsuario: false,
        fechaActualizacion: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error al resolver ticket:", err);
    }
  };

  const handleEliminarTicket = async (ticketId: string) => {
    setPendingTickets(prev => prev.filter(t => t.id !== ticketId));
    setPendingTicketsCount(prev => Math.max(0, prev - 1));
    try {
      await deleteDoc(doc(db, 'support_tickets', ticketId));
      await deleteDoc(doc(db, 'consultas_soporte', ticketId)).catch(() => {});
    } catch (err) {
      console.error("Error al eliminar ticket en SuperAdmin:", err);
    }
  };

  const handleCambiarPlanUsuario = async (userId: string, nuevoPlan: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      const fechaActual = new Date();
      const fechaVencimientoMs = Date.now() + (30 * 24 * 60 * 60 * 1000);
      const fechaVencimiento = new Date(fechaVencimientoMs);

      await updateDoc(userRef, {
        planActual: nuevoPlan,
        plan: nuevoPlan,
        estadoPago: 'APROBADO',
        estadoPlataforma: 'Aprobado',
        estado_cuenta: 'activa',
        fecha_inicio_plan: fechaActual.toISOString(),
        fecha_vencimiento_plan: fechaVencimiento.toISOString()
      });
      alert(`Plan actualizado con éxito a "${nuevoPlan}".`);
    } catch (err) {
      console.error("Error al actualizar plan:", err);
      alert('Error al actualizar el plan.');
    }
  };

  const handleCambiarCategoriaUsuario = async (userId: string, nuevaCat: 'cliente' | 'cortesia' | 'equipo') => {
    try {
      await updateDoc(doc(db, 'users', userId), { categoriaCuenta: nuevaCat });
    } catch (err) {
      console.error("Error al actualizar categoría de cuenta:", err);
      alert('Error al actualizar categoría.');
    }
  };

  const [togglingAddonKeys, setTogglingAddonKeys] = useState<Record<string, boolean>>({});
  const [whatsappToast, setWhatsappToast] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const whatsappToastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (whatsappToastTimerRef.current !== null) {
        window.clearTimeout(whatsappToastTimerRef.current);
      }
    };
  }, []);

  const showWhatsAppToast = (kind: 'success' | 'error', message: string) => {
    if (whatsappToastTimerRef.current !== null) {
      window.clearTimeout(whatsappToastTimerRef.current);
    }
    setWhatsappToast({ kind, message });
    whatsappToastTimerRef.current = window.setTimeout(() => {
      setWhatsappToast(null);
      whatsappToastTimerRef.current = null;
    }, 3500);
  };

  const handleToggleAddon = async (user: RegisteredUser, field: AddonField) => {
    const toggleKey = `${user.id}:${field}`;
    if (togglingAddonKeys[toggleKey]) return;

    const { enabled: currentEnabled } = getEffectiveAddonState(user, field);
    const prevExplicitValue = user.raw?.[field] ?? user[field];
    const nextValue = !currentEnabled;
    const displayName = user.razonSocial || user.nombre || user.email || user.id;
    const addonMeta = ADDON_MODULES.find((m) => m.field === field);
    const moduleLabel = addonMeta?.fullLabel || field;

    setTogglingAddonKeys((prev) => ({ ...prev, [toggleKey]: true }));
    setRegisteredUsers((prev) =>
      prev.map((u) =>
        u.id === user.id
          ? {
              ...u,
              [field]: nextValue,
              raw: u.raw ? { ...u.raw, [field]: nextValue } : { [field]: nextValue },
            }
          : u
      )
    );

    try {
      await updateDoc(doc(db, 'users', user.id), { [field]: nextValue });
      showWhatsAppToast(
        'success',
        nextValue
          ? `${moduleLabel} habilitado para ${displayName}.`
          : `${moduleLabel} revocado para ${displayName}.`
      );
    } catch (err) {
      console.error(`Error al actualizar ${field}:`, err);
      setRegisteredUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? {
                ...u,
                [field]: prevExplicitValue,
                raw: u.raw ? { ...u.raw, [field]: prevExplicitValue } : { [field]: prevExplicitValue },
              }
            : u
        )
      );
      showWhatsAppToast('error', `No se pudo actualizar ${moduleLabel} para ${displayName}.`);
    } finally {
      setTogglingAddonKeys((prev) => ({ ...prev, [toggleKey]: false }));
    }
  };

  const formatWhatsAppNumber = (tel: string) => {
    if (!tel) return '';
    let cleaned = tel.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('09')) {
      cleaned = '595' + cleaned.substring(1);
    } else if (!cleaned.startsWith('595') && cleaned.length >= 9) {
      cleaned = '595' + cleaned;
    }
    return cleaned;
  };

  const [ofertaModalUser, setOfertaModalUser] = useState<RegisteredUser | null>(null);
  const [ofertaTemplateId, setOfertaTemplateId] = useState<OfertaTemplateId>('cierre_prueba');
  const [ofertaAsunto, setOfertaAsunto] = useState('');
  const [ofertaMensaje, setOfertaMensaje] = useState('');
  const ofertaModalOpenRef = useRef(false);
  ofertaModalOpenRef.current = Boolean(ofertaModalUser);

  const openOfertaModal = (user: RegisteredUser) => {
    const defaultTpl = getDefaultOfertaTemplate(user.estadoSuscripcion);
    const { asunto, mensaje } = buildOfertaTemplateContent(defaultTpl, user);
    setOfertaModalUser(user);
    setOfertaTemplateId(defaultTpl);
    setOfertaAsunto(asunto);
    setOfertaMensaje(mensaje);
  };

  const handleSelectOfertaTemplate = (templateId: OfertaTemplateId) => {
    setOfertaTemplateId(templateId);
    if (!ofertaModalUser) return;
    const { asunto, mensaje } = buildOfertaTemplateContent(templateId, ofertaModalUser);
    setOfertaAsunto(asunto);
    setOfertaMensaje(mensaje);
  };
  
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [reciboSeleccionado, setReciboSeleccionado] = useState<string | null>(null);

  const [pagaresGlobal, setPagaresGlobal] = useState<PagareGlobal[]>([]);
  const [auditoriaSeleccionada, setAuditoriaSeleccionada] = useState<{pagare: PagareGlobal, reporte: {riesgo: string, razones: string[]}} | null>(null);
  const [expandedModule, setExpandedModule] = useState<'usuarios' | 'pagares' | null>(null);
  const [pagaresSearchTerm, setPagaresSearchTerm] = useState('');
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [pagosModalOpen, setPagosModalOpen] = useState(false);
  const [buzonModalOpen, setBuzonModalOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (ofertaModalOpenRef.current) {
          setOfertaModalUser(null);
          return;
        }
        if (centerModalOpenRef.current) {
          setCenterModalOpen(false);
          return;
        }
        setExpandedModule(null);
        setAiModalOpen(false);
        setPagosModalOpen(false);
        setBuzonModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredPagares = useMemo(() => {
    const term = pagaresSearchTerm.trim().toLowerCase();
    if (!term) return pagaresGlobal;
    return pagaresGlobal.filter(p => {
      const emisor = (p.empresa || p.acreedor_nombre || p.userEmail || '').toLowerCase();
      const acreedor = (p.acreedor_nombre || '').toLowerCase();
      const deudor = (p.deudor_nombre || '').toLowerCase();
      const cedula = (p.deudor_cedula || '').toLowerCase();
      return emisor.includes(term) || acreedor.includes(term) || deudor.includes(term) || cedula.includes(term);
    });
  }, [pagaresGlobal, pagaresSearchTerm]);

  const [chartData, setChartData] = useState<{name: string, cantidad: number}[]>([]);
  const [lineData, setLineData] = useState<{name: string, volumen: number}[]>([]);

  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userFilter, setUserFilter] = useState<'todos' | 'clientes' | 'cortesia_equipo' | 'prueba' | 'vencidos'>('todos');
  const [userSearchTerm, setUserSearchTerm] = useState('');

  const filteredUsers = useMemo(() => {
    return registeredUsers.filter(u => {
      const term = userSearchTerm.trim().toLowerCase();
      if (term) {
        const matchNombre = (u.nombre || '').toLowerCase().includes(term);
        const matchEmail = (u.email || '').toLowerCase().includes(term);
        const matchTel = (u.telefono || '').toLowerCase().includes(term);
        const matchRazon = (u.razonSocial || '').toLowerCase().includes(term);
        if (!matchNombre && !matchEmail && !matchTel && !matchRazon) return false;
      }
      if (userFilter === 'clientes') return u.categoriaCuenta === 'cliente';
      if (userFilter === 'cortesia_equipo') return u.categoriaCuenta === 'cortesia' || u.categoriaCuenta === 'equipo';
      if (userFilter === 'prueba') return u.estadoSuscripcion === 'prueba' && u.categoriaCuenta === 'cliente';
      if (userFilter === 'vencidos') return u.estadoSuscripcion === 'vencido';
      return true;
    });
  }, [registeredUsers, userSearchTerm, userFilter]);

  const segmentCounts = useMemo<Record<CampaignSegment, number>>(() => ({
    all: registeredUsers.length,
    active: registeredUsers.filter((u) => u.categoriaCuenta === 'cliente' && u.estadoSuscripcion === 'activo').length,
    trial: registeredUsers.filter((u) => u.categoriaCuenta === 'cliente' && u.estadoSuscripcion === 'prueba').length,
    expired: registeredUsers.filter((u) => u.estadoSuscripcion === 'vencido').length,
    cortesia: registeredUsers.filter((u) => u.categoriaCuenta === 'cortesia' || u.categoriaCuenta === 'equipo').length,
  }), [registeredUsers]);

  const segmentedUsers = useMemo(() => {
    switch (campaignSegment) {
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
  }, [segmentedUsers]);

  const getUserTimestamp = (u: any): number => {
    if (!u) return 0;
    const candidates = [
      u.createdAt,
      u.created_at,
      u.fechaCreacion,
      u.fecha_creacion,
      u.fechaRegistro,
      u.fecha_registro,
      u.fechaSolicitud,
      u.fecha_solicitud,
      u.fecha_inicio_plan,
      u.fechaAprobacion,
      u.timestamp,
      u.updatedAt,
      u.updated_at
    ];

    for (const c of candidates) {
      if (!c) continue;
      if (typeof c?.toDate === 'function') {
        const ms = c.toDate().getTime();
        if (!isNaN(ms) && ms > 0) return ms;
      }
      if (typeof c === 'number' && !isNaN(c)) {
        if (c > 1000000000000) return c;
        if (c > 100000000) return c * 1000;
      }
      if (typeof c === 'string') {
        const ms = Date.parse(c);
        if (!isNaN(ms) && ms > 0) return ms;
      }
    }
    return 0;
  };

  const formatUserDate = (timestamp: number) => {
    if (!timestamp || timestamp === 0) return 'Reciente / No registrada';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return 'Fecha inválida';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  useEffect(() => {
    let unsubscribeUsers: (() => void) | null = null;
    let isMounted = true;

    // 1. Sincronización en TIEMPO REAL de Usuarios
    try {
      const usersCol = collection(db, 'users');
      unsubscribeUsers = onSnapshot(usersCol, (usersSnap) => {
        if (!isMounted) return;

        const usersList: RegisteredUser[] = [];
        const pend: PendingPayment[] = [];
        let tUsers = 0;
        let aUsers = 0;
        let aiQ = 0;
        let clientesC = 0;
        let equipoC = 0;

        usersSnap.forEach((docSnap) => {
          const data = docSnap.data();
          const docId = docSnap.id;
          tUsers++;

          const userAiUsage = Number(data.usoIA || data.consultasUsadas || data.aiConsultationsCount || 0);
          aiQ += userAiUsage;

          const emailStr = String(data.email || data.correo || '').toLowerCase();
          let categoriaCuenta: 'cliente' | 'cortesia' | 'equipo' = data.categoriaCuenta;
          if (!categoriaCuenta) {
            if (emailStr.includes('jotamolinas') || emailStr.includes('probit.com.py') || emailStr.includes('olga')) {
              categoriaCuenta = 'equipo';
            } else {
              categoriaCuenta = 'cliente';
            }
          }

          if (categoriaCuenta === 'cliente') {
            clientesC++;
          } else {
            equipoC++;
          }

          const planStr = String(data.planActual || data.plan || data.planSolicitado || '').toLowerCase();
          const estadoPago = String(data.estadoPago || '').toUpperCase();
          const estadoPlataforma = String(data.estadoPlataforma || '').toUpperCase();

          const isPending = estadoPago === 'PAGO_PENDIENTE_VERIFICACION' || estadoPago === 'PENDIENTE';
          if (isPending) {
            pend.push({
              id: docId,
              userId: docId,
              email: data.email || data.correo || data.phoneNumber || data.telefono || docId || 'Desconocido',
              nombreCliente: data.nombre || data.razonSocial || data.nombreCompleto || data.displayName || 'Cliente sin nombre registrado',
              montoAPagar: data.montoAPagar || 0,
              modalidadPago: data.modalidadPago || 'Desconocido',
              urlComprobante: data.urlComprobante || '',
              fechaSolicitud: data.fechaSolicitud,
              planSolicitado: data.planSolicitado || 'Plan desconocido',
            });
          }

          const isPaidPlan = planStr.includes('pro') || planStr.includes('empresa') || planStr.includes('full') || planStr.includes('basico') || planStr.includes('básico') || estadoPago === 'APROBADO' || estadoPago === 'ACTIVO' || estadoPlataforma === 'APROBADO';
          if (isPaidPlan) aUsers++;

          const timestamp = getUserTimestamp(data);

          let estadoSuscripcion: 'activo' | 'prueba' | 'pendiente' | 'vencido' = 'prueba';
          let diasRestantes = 5;

          if (isPending) {
            estadoSuscripcion = 'pendiente';
          } else if (isPaidPlan) {
            estadoSuscripcion = 'activo';
          } else {
            if (timestamp > 0) {
              const diffMs = Date.now() - timestamp;
              const daysPassed = diffMs / (1000 * 60 * 60 * 24);
              diasRestantes = Math.max(0, Math.ceil(5 - daysPassed));
              if (daysPassed > 5 || diasRestantes <= 0) {
                estadoSuscripcion = 'vencido';
              } else {
                estadoSuscripcion = 'prueba';
              }
            } else {
              estadoSuscripcion = 'prueba';
              diasRestantes = 5;
            }
          }

          const isRecent = timestamp > 0 && (Date.now() - timestamp) < (24 * 60 * 60 * 1000);

          usersList.push({
            id: docId,
            email: data.email || data.correo || '',
            telefono: data.phoneNumber || data.telefono || data.celular || data.phone || '',
            nombre: data.nombre || data.razonSocial || data.nombreCompleto || data.displayName || 'Usuario Registrado',
            razonSocial: data.razonSocial || data.escribania?.nombre || '',
            plan: data.planActual || data.plan || (estadoSuscripcion === 'activo' ? 'Plan Activo' : 'Prueba Gratuita'),
            estadoSuscripcion,
            estadoPago: data.estadoPago || data.estadoPlataforma || (estadoSuscripcion === 'activo' ? 'APROBADO' : 'PRUEBA'),
            modalidadPago: data.modalidadPago || (data.tipoPlan ? `Plan ${data.tipoPlan}` : ''),
            montoAPagar: data.montoAPagar || 0,
            timestamp,
            fechaFormateada: formatUserDate(timestamp),
            diasRestantes,
            isRecent,
            categoriaCuenta,
            whatsappEnabled: typeof data.whatsappEnabled === 'boolean' ? data.whatsappEnabled : undefined,
            lienzoEnabled: typeof data.lienzoEnabled === 'boolean' ? data.lienzoEnabled : undefined,
            presupuestoEnabled: typeof data.presupuestoEnabled === 'boolean' ? data.presupuestoEnabled : undefined,
            raw: data
          });
        });

        usersList.sort((a, b) => b.timestamp - a.timestamp);

        setRegisteredUsers(usersList);
        setPendingPayments(pend.sort((a, b) => (b.fechaSolicitud?.toDate?.()?.getTime() || 0) - (a.fechaSolicitud?.toDate?.()?.getTime() || 0)));
        setLoadingUsers(false);
        setLoadingPayments(false);

        setMetrics(prev => ({
          ...prev,
          totalUsers: tUsers,
          activeUsers: aUsers,
          aiQueries: aiQ,
          alerts: pend.length,
          clientesCount: clientesC,
          equipoCortesiaCount: equipoC
        }));
      }, (err) => {
        console.error("Error en snapshot en tiempo real de usuarios:", err);
        setLoadingUsers(false);
      });
    } catch (err) {
      console.error("Error inicializando listener de usuarios:", err);
      setLoadingUsers(false);
    }

    // 2. Carga de Pagarés Globales
    const fetchPagaresData = async () => {
      try {
        const pagaresSnap = await getDocs(collection(db, 'pagares'));
        const pgs: PagareGlobal[] = [];
        const mesCounts: Record<string, number> = {};
        const mesVolumen: Record<string, number> = {};

        const safeFormatDate = (timestamp: any) => {
          if (!timestamp) return 'Fecha no registrada';
          if (timestamp.toDate) {
            const d = timestamp.toDate();
            const pad = (n: number) => n.toString().padStart(2, '0');
            return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
          }
          if (typeof timestamp === 'string' || typeof timestamp === 'number') {
            const d = new Date(timestamp);
            if (!isNaN(d.getTime())) {
              const pad = (n: number) => n.toString().padStart(2, '0');
              return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
            }
          }
          return 'Fecha no registrada';
        };

        pagaresSnap.forEach(doc => {
          const rawData = doc.data();
          let rawMonto = rawData.valor_total || rawData.monto || 0;
          if (typeof rawMonto === 'string') {
            rawMonto = parseFloat(rawMonto.replace(/[^\d.-]/g, '')) || 0;
          }

          const fechaRaw = rawData.created_at;
          const uid = rawData.userId || rawData.creator_id || '';

          const mappedPagare: PagareGlobal = {
            id: doc.id,
            userId: uid,
            userEmail: rawData.creatorEmail || rawData.userEmail || `ID: ${uid}`,
            empresa: rawData.acreedor_nombre_raw || 'Empresa Desconocida',
            acreedor_nombre: rawData.acreedor_nombre_raw || 'Emisor Desconocido',
            acreedor_documento: rawData.acreedor_documento_raw || '',
            deudor_nombre: rawData.deudor_nombre_raw || 'Deudor Desconocido',
            deudor_cedula: rawData.deudor_documento_raw || '',
            monto: rawMonto,
            fecha_vencimiento: rawData.fechaVencimiento || rawData.fecha_vencimiento || '',
            fecha_emision: safeFormatDate(fechaRaw),
            created_at: fechaRaw || null
          };

          pgs.push(mappedPagare);

          if (mappedPagare.created_at) {
            const d = mappedPagare.created_at.toDate ? mappedPagare.created_at.toDate() : new Date(mappedPagare.created_at);
            if (!isNaN(d.getTime())) {
              const mes = d.toLocaleString('es-ES', { month: 'short' }).toUpperCase();
              mesCounts[mes] = (mesCounts[mes] || 0) + 1;
              const monto = typeof mappedPagare.monto === 'number' ? mappedPagare.monto : 0;
              mesVolumen[mes] = (mesVolumen[mes] || 0) + monto;
            }
          }
        });

        const parseDateSort = (val: any) => {
          if (!val) return 0;
          if (val.toDate) return val.toDate().getTime();
          if (typeof val === 'string') {
            const parts = val.split('/');
            if (parts.length === 3) {
              return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00Z`).getTime();
            }
            const d = new Date(val);
            if (!isNaN(d.getTime())) return d.getTime();
          }
          if (typeof val === 'number') return val;
          return 0;
        };

        setPagaresGlobal(pgs.sort((a, b) => parseDateSort(b.created_at) - parseDateSort(a.created_at)));
        setMetrics(prev => ({ ...prev, totalPagares: pagaresSnap.size }));

        const meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        const currentMonth = new Date().getMonth();
        const last6Months = [];
        for (let i = 5; i >= 0; i--) {
          let m = currentMonth - i;
          if (m < 0) m += 12;
          last6Months.push(meses[m]);
        }

        setChartData(last6Months.map(m => ({ name: m, cantidad: mesCounts[m] || 0 })));
        setLineData(last6Months.map(m => ({ name: m, volumen: mesVolumen[m] || 0 })));

        setLoading(false);
      } catch (err) {
        console.error("Error al obtener pagarés globales:", err);
        setLoading(false);
      }
    };

    fetchPagaresData();

    // 3. Listener de tickets de soporte
    let unsubscribeTickets: (() => void) | null = null;
    try {
      const qTickets = query(collection(db, 'support_tickets'));
      unsubscribeTickets = onSnapshot(qTickets, (snapshot) => {
        let count = 0;
        const ticketsList: any[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          ticketsList.push({ id: docSnap.id, ...data });
          if (data.estado !== 'resuelto') {
            count++;
          }
        });
        ticketsList.sort((a, b) => {
          const aRes = a.estado === 'resuelto' ? 1 : 0;
          const bRes = b.estado === 'resuelto' ? 1 : 0;
          return aRes - bRes;
        });
        setPendingTickets(ticketsList);
        setPendingTicketsCount(count);
      }, (err) => {
        console.error("Error en snapshot de tickets de soporte:", err);
      });
    } catch (err) {
      console.error("Error inicializando listener de tickets:", err);
    }

    // 4. Listener de aviso global en plataforma
    let unsubscribeAnnouncement: (() => void) | null = null;
    try {
      unsubscribeAnnouncement = onSnapshot(
        doc(db, 'system_config', 'global_announcement'),
        (snap) => {
          if (!isMounted) return;
          if (snap.exists()) {
            const d = snap.data() as Partial<GlobalAnnouncementDoc>;
            setLiveAnnouncement({
              active: Boolean(d.active),
              announcementId: String(d.announcementId || ''),
              title: String(d.title || ''),
              message: String(d.message || ''),
              type: d.type === 'mantenimiento' || d.type === 'promocion' ? d.type : 'novedad',
              targetSegment: ['all', 'active', 'trial', 'expired', 'cortesia'].includes(String(d.targetSegment))
                ? (d.targetSegment as CampaignSegment)
                : 'all',
              vistoPor: Array.isArray(d.vistoPor) ? d.vistoPor : [],
              updatedAt: d.updatedAt,
            });
          } else {
            setLiveAnnouncement(null);
          }
        },
        (err) => {
          console.error('Error en snapshot de aviso global:', err);
        }
      );
    } catch (err) {
      console.error('Error inicializando listener de aviso global:', err);
    }

    return () => {
      isMounted = false;
      if (unsubscribeUsers) unsubscribeUsers();
      if (unsubscribeTickets) unsubscribeTickets();
      if (unsubscribeAnnouncement) unsubscribeAnnouncement();
    };
  }, []);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Fecha no disponible';
    if (timestamp.toDate) {
      const d = timestamp.toDate();
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    return 'Fecha inválida';
  };

  const handleAprobar = async (userId: string, planSolicitado: string, modalidadPago?: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      const fechaActual = new Date();
      const esAnual = String(modalidadPago || '').toLowerCase().includes('anual');
      const diasVigencia = esAnual ? 365 : 30;
      const fechaVencimientoMs = Date.now() + (diasVigencia * 24 * 60 * 60 * 1000);
      const fechaVencimiento = new Date(fechaVencimientoMs);

      await updateDoc(userRef, {
        planActual: planSolicitado,
        plan: planSolicitado,
        estadoPago: 'APROBADO',
        estadoPlataforma: 'Aprobado',
        estado_cuenta: 'activa',
        modalidadPago: esAnual ? 'Anual (12 meses)' : 'Mensual (1 mes)',
        fecha_inicio_plan: fechaActual.toISOString(),
        fecha_vencimiento_plan: fechaVencimiento.toISOString(),
        fechaAprobacion: fechaActual.toISOString()
      });

      setPendingPayments(prev => prev.filter(p => p.userId !== userId));
      alert(`¡Suscripción aprobada!\nEl plan "${planSolicitado}" vencerá el ${fechaVencimiento.toLocaleDateString('es-ES')}.`);
    } catch (err) {
      console.error(err);
      alert('Error al aprobar la suscripción.');
    }
  };

  const evaluarRiesgo = (pagare: PagareGlobal) => {
    let riesgo: 'Normal' | 'Sospechoso' | 'Critico' = 'Normal';
    let razones: string[] = [];

    const montoStr = String(pagare.monto || '0').replace(/[^\d.-]/g, '');
    const monto = parseFloat(montoStr);

    if (monto > 50000000) {
      riesgo = 'Sospechoso';
      razones.push('Monto inusualmente alto (> 50.000.000 Gs).');
    }

    if (pagare.fecha_vencimiento && pagare.fecha_emision) {
      const v = new Date(pagare.fecha_vencimiento);
      const e = new Date(pagare.fecha_emision);
      if (v < e) {
        riesgo = 'Critico';
        razones.push('Fecha de vencimiento es anterior a la fecha de emisión.');
      }
    }

    if (!pagare.deudor_cedula || pagare.deudor_cedula.trim() === '') {
      riesgo = 'Critico';
      razones.push('Falta C.I. o RUC del deudor.');
    }

    return { riesgo, razones };
  };

  const handleAuditoria = (pagare: PagareGlobal) => {
    const reporte = evaluarRiesgo(pagare);
    setAuditoriaSeleccionada({ pagare, reporte });
  };

  const renderRiesgoIcon = (riesgo: string) => {
    if (riesgo === 'Critico') return <ShieldAlert className="w-5 h-5 text-red-500" />;
    if (riesgo === 'Sospechoso') return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    return <ShieldCheck className="w-5 h-5 text-emerald-500" />;
  };

  const renderRiesgoBadge = (riesgo: string) => {
    if (riesgo === 'Critico') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20"><ShieldAlert className="w-3 h-3"/> CRÍTICO</span>;
    if (riesgo === 'Sospechoso') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"><AlertTriangle className="w-3 h-3"/> SOSPECHOSO</span>;
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><ShieldCheck className="w-3 h-3"/> NORMAL</span>;
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-[#09090b] text-gray-200 p-2 md:p-4 w-full box-border h-full overflow-x-hidden">
      {whatsappToast && (
        <div
          role="status"
          className={`fixed top-4 right-4 z-[80] flex items-center gap-2.5 px-4 py-2.5 rounded-xl border shadow-xl text-xs font-semibold backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 ${
            whatsappToast.kind === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/90 border-red-500/40 text-red-200'
          }`}
        >
          {whatsappToast.kind === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{whatsappToast.message}</span>
        </div>
      )}
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col overflow-hidden overflow-x-hidden">
        {/* Header / Subtabs */}
        <div className="mb-3 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              Monitor Central
            </h1>
            <p className="text-[11px] text-gray-400 mt-0.5">Super Admin • Métricas, emisión y auditoría en tiempo real.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setAnnouncementFeedback(null);
                setCenterModalOpen(true);
              }}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 transition-all flex items-center gap-2 cursor-pointer"
              title="Abrir Centro de Avisos y Campañas Masivas"
            >
              <Megaphone className="w-3.5 h-3.5 text-purple-400" />
              <span>Avisos & Campañas</span>
              {liveAnnouncement?.active && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Hay un aviso activo en plataforma" />
              )}
            </button>

            <div className="inline-flex items-center bg-[#121214] border border-white/5 rounded-xl p-1 shadow-sm shrink-0">
              <button
                type="button"
                onClick={() => setAdminSubTab('metricas')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                  adminSubTab === 'metricas'
                    ? 'bg-white/10 text-white shadow-xs'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-blue-400" />
                Métricas
              </button>
              <button
                type="button"
                onClick={() => setAdminSubTab('onboarding')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                  adminSubTab === 'onboarding'
                    ? 'bg-white/10 text-white shadow-xs'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                Onboarding SIFEN
              </button>
            </div>
          </div>
        </div>

        {adminSubTab === 'onboarding' ? (
          <div className="flex-1 overflow-y-auto">
            <SuperAdminOnboarding />
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden gap-3">
            {/* 1. Grid Superior de KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
              <div 
                onClick={() => setExpandedModule('usuarios')}
                className="bg-[#121214] border border-white/5 hover:border-blue-500/40 hover:bg-white/[0.02] rounded-2xl p-3.5 shadow-sm flex flex-col justify-between cursor-pointer transition-all"
                title="Click para ver lista completa de usuarios"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Usuarios Totales</span>
                  <div className="p-1 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                </div>
                <div>
                  {loading ? (
                    <div className="h-6 w-16 bg-zinc-800/60 rounded animate-pulse"></div>
                  ) : (
                    <>
                      <p className="text-2xl font-light text-white mt-0.5">{metrics.totalUsers}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {metrics.clientesCount || 0} clientes • {metrics.equipoCortesiaCount || 0} equipo/cortesía
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div 
                onClick={() => setExpandedModule('pagares')}
                className="bg-[#121214] border border-white/5 hover:border-emerald-500/40 hover:bg-white/[0.02] rounded-2xl p-3.5 shadow-sm flex flex-col justify-between cursor-pointer transition-all"
                title="Click para ver emisión de pagarés en pantalla completa"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Pagarés Emitidos</span>
                  <div className="p-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                </div>
                <div>
                  {loading ? <div className="h-6 w-16 bg-zinc-800/60 rounded animate-pulse"></div> : <p className="text-2xl font-light text-white mt-0.5">{metrics.totalPagares}</p>}
                </div>
              </div>

              <div 
                onClick={() => setAiModalOpen(true)}
                className="bg-[#121214] border border-white/5 hover:border-purple-500/40 hover:bg-white/[0.02] rounded-2xl p-3.5 shadow-sm flex flex-col justify-between cursor-pointer transition-all"
                title="Click para ver detalles de consultas IA"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Consultas IA</span>
                  <div className="p-1 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <Activity className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                </div>
                <div>
                  {loading ? <div className="h-6 w-16 bg-zinc-800/60 rounded animate-pulse"></div> : <p className="text-2xl font-light text-white mt-0.5">{metrics.aiQueries}</p>}
                </div>
              </div>

              <div 
                onClick={() => setPagosModalOpen(true)}
                className="bg-[#121214] border border-white/5 hover:border-orange-500/40 hover:bg-white/[0.02] rounded-2xl p-3.5 shadow-sm flex flex-col justify-between cursor-pointer transition-all"
                title="Click para revisar pagos pendientes"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Pagos Pendientes</span>
                  <div className="p-1 bg-orange-500/10 rounded-lg border border-orange-500/20">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                  </div>
                </div>
                <div>
                  {loadingPayments ? <div className="h-6 w-16 bg-zinc-800/60 rounded animate-pulse"></div> : <p className={`text-2xl font-light mt-0.5 ${pendingPayments.length > 0 ? 'text-orange-400' : 'text-white'}`}>{pendingPayments.length}</p>}
                </div>
              </div>

              <div 
                onClick={() => setBuzonModalOpen(true)}
                className="bg-[#121214] border border-white/5 hover:border-amber-500/40 hover:bg-white/[0.02] rounded-2xl p-3.5 shadow-sm flex flex-col justify-between col-span-2 md:col-span-1 cursor-pointer transition-all"
                title="Click para ver buzón de consultas"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Buzón de Consultas</span>
                  <div className="p-1 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                </div>
                <div>
                  <p className={`text-2xl font-light mt-0.5 ${pendingTicketsCount > 0 ? 'text-amber-400 font-normal' : 'text-gray-400'}`}>
                    {pendingTicketsCount}
                  </p>
                </div>
              </div>
            </div>

            {/* Split 50/50 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0 overflow-hidden">
              
              {/* Columna Izquierda */}
              <div className="flex flex-col gap-3 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-800 pr-1">
                
                {/* Gráficos */}
                <div className="bg-[#121214] border border-white/5 rounded-2xl p-3 shadow-sm shrink-0">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3 h-3 text-blue-400" /> Emisión (6 Meses) & Volumen
                    </span>
                    <span className="text-[9px] text-gray-400 font-mono">
                      {metrics.totalPagares} docs
                    </span>
                  </div>
                  <div className="h-20 bg-transparent">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 2, right: 5, left: -25, bottom: 0 }}>
                        <CartesianGrid stroke="#27272a" vertical={false} strokeOpacity={0.4} />
                        <XAxis dataKey="name" stroke="#71717a" fontSize={8} tickLine={false} axisLine={false} />
                        <YAxis stroke="#71717a" fontSize={8} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip 
                          cursor={{ fill: '#27272a', opacity: 0.3 }}
                          contentStyle={{ backgroundColor: '#18181b', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '12px', color: '#f4f4f5', fontSize: '10px' }}
                        />
                        <Bar dataKey="cantidad" fill="#3b82f6" barSize={12} radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gestión de Cobros */}
                <div className="bg-[#121214] border border-white/5 rounded-2xl p-3 shadow-sm shrink-0">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="w-3 h-3 text-orange-400" /> Gestión de Cobros
                    </span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono ${
                      pendingPayments.length > 0 
                        ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20 font-bold' 
                        : 'text-gray-500 bg-white/5'
                    }`}>
                      {pendingPayments.length} pendientes
                    </span>
                  </div>

                  <div className="max-h-[140px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 pr-1 space-y-1.5">
                    {loadingPayments ? (
                      <div className="p-4 flex justify-center items-center">
                        <div className="w-4 h-4 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
                      </div>
                    ) : pendingPayments.length === 0 ? (
                      <div className="py-4 text-center flex flex-col items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-emerald-500/30 mb-1" />
                        <p className="text-[11px] text-gray-400 font-medium">Al día con las suscripciones</p>
                      </div>
                    ) : (
                      pendingPayments.map((pago) => {
                        const nombreEscribano = pago.nombreCliente || pago.email || 'Escribano';
                        const montoFormatted = pago.montoAPagar && pago.montoAPagar > 0 
                          ? `Gs. ${pago.montoAPagar.toLocaleString('es-PY')}` 
                          : pago.planSolicitado || 'Plan';

                        return (
                          <div 
                            key={pago.id}
                            className="flex items-center justify-between py-1.5 px-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 transition-colors gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] text-gray-200 font-medium truncate" title={nombreEscribano}>
                                {nombreEscribano}
                              </p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-white font-medium text-[10px] font-mono">
                                  {montoFormatted}
                                </span>
                                <span className="text-[9px] text-gray-500 truncate">• {pago.planSolicitado}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {pago.urlComprobante && (
                                <button
                                  onClick={() => setReciboSeleccionado(pago.urlComprobante)}
                                  className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-[9px] px-1.5 py-0.5 rounded transition-colors font-medium flex items-center gap-0.5 cursor-pointer"
                                >
                                  <ExternalLink className="w-2.5 h-2.5" /> Revisar
                                </button>
                              )}
                              <button
                                onClick={() => handleAprobar(pago.userId || pago.id, pago.planSolicitado || '', pago.modalidadPago)}
                                className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-[9px] px-1.5 py-0.5 rounded transition-colors font-medium flex items-center gap-0.5 cursor-pointer"
                              >
                                <CheckCircle className="w-2.5 h-2.5" /> Aprobar
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Buzón de Consultas */}
                <div className="bg-[#121214] border border-white/5 rounded-2xl p-3 shadow-sm shrink-0">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <MessageSquare className="w-3 h-3 text-amber-400" /> Buzón de Consultas
                    </span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-mono ${
                      pendingTicketsCount > 0 
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold' 
                        : 'text-gray-500 bg-white/5'
                    }`}>
                      {pendingTicketsCount} pendientes
                    </span>
                  </div>

                  <div className="max-h-[140px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 pr-1 space-y-1.5">
                    {pendingTickets.length === 0 ? (
                      <div className="py-4 text-center flex flex-col items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-emerald-500/30 mb-1" />
                        <p className="text-[11px] text-gray-400 font-medium">No hay consultas pendientes</p>
                      </div>
                    ) : (
                      pendingTickets.map((ticket) => {
                        const isResuelto = ticket.estado === 'resuelto';
                        const isPendiente = ticket.estado === 'pendiente' || !ticket.estado;
                        return (
                          <div 
                            key={ticket.id}
                            className={`flex items-center justify-between py-1.5 px-2 rounded-xl border transition-colors gap-2 ${
                              isResuelto ? 'bg-white/[0.01] opacity-60 border-white/5' : 'bg-white/[0.03] border-amber-500/20'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] text-gray-200 font-medium truncate" title={ticket.asunto || ticket.mensaje || 'Consulta'}>
                                {ticket.asunto || ticket.mensaje || 'Consulta de soporte'}
                              </p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[9px] text-gray-400 truncate">
                                  {ticket.userEmail || ticket.email || 'Usuario'} • {ticket.estado || 'pendiente'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {isPendiente && (
                                <button
                                  onClick={() => handleMarcarEnProceso(ticket.id)}
                                  className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-[9px] px-2 py-0.5 rounded transition-colors font-medium flex items-center gap-0.5 cursor-pointer"
                                >
                                  <Clock className="w-2.5 h-2.5" /> En Proceso
                                </button>
                              )}
                              {!isResuelto && (
                                <button
                                  onClick={() => handleResolverTicket(ticket.id)}
                                  className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-[9px] px-2 py-0.5 rounded transition-colors font-medium flex items-center gap-0.5 cursor-pointer"
                                >
                                  <Check className="w-2.5 h-2.5" /> Resolver
                                </button>
                              )}
                              <button
                                onClick={() => handleEliminarTicket(ticket.id)}
                                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[9px] px-1.5 py-0.5 rounded transition-colors font-medium flex items-center gap-0.5 cursor-pointer"
                                title="Eliminar ticket"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                              {isResuelto && (
                                <span className="text-[9px] text-emerald-400 font-semibold px-1.5 py-0.5">Resuelto</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Emisión Reciente */}
                <div className="bg-[#121214] border border-white/5 rounded-2xl p-3 shadow-sm shrink-0">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3 h-3 text-emerald-400" /> Emisión Reciente de Pagarés
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-full font-mono">
                        {pagaresGlobal.length} docs
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpandedModule('pagares')}
                        className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white p-1.5 rounded-lg border border-white/10 transition-all cursor-pointer flex items-center gap-1"
                        title="Expandir a pantalla completa (ESC para salir)"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[140px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 pr-1 space-y-1">
                    {loading ? (
                      <div className="p-4 flex justify-center items-center">
                        <div className="w-4 h-4 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                      </div>
                    ) : pagaresGlobal.length === 0 ? (
                      <div className="py-4 text-center text-[11px] text-gray-500">
                        No hay pagarés registrados aún.
                      </div>
                    ) : (
                      pagaresGlobal.map((pagare) => {
                        const emisor = pagare.empresa || pagare.acreedor_nombre || pagare.userEmail || 'Emisor';
                        const fecha = pagare.fecha_emision || 'Fecha no registrada';
                        const montoFormatted = typeof pagare.monto === 'number' 
                          ? `Gs. ${pagare.monto.toLocaleString('es-PY')}` 
                          : pagare.monto;

                        return (
                          <div 
                            key={pagare.id} 
                            onClick={() => handleAuditoria(pagare)}
                            className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0 hover:bg-white/[0.02] px-2 rounded-lg transition-colors cursor-pointer group"
                            title="Click para auditar detalle"
                          >
                            <div className="min-w-0 mr-2">
                              <p className="text-[11px] text-gray-200 font-medium truncate group-hover:text-emerald-400 transition-colors">
                                {emisor}
                              </p>
                              <div className="flex items-center gap-1 text-[9px] text-gray-500 mt-0.5">
                                <span>{fecha}</span>
                                {pagare.deudor_nombre && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate max-w-[100px] text-gray-400">{pagare.deudor_nombre}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <span className="text-[11px] font-medium text-white font-mono">
                                {montoFormatted}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>

              {/* Columna Derecha: Panel de Usuarios Activos & Registrados */}
              <div className="bg-[#121214] border border-white/5 rounded-2xl p-4 shadow-sm flex flex-col h-full overflow-hidden">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2 flex items-center justify-between shrink-0">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-blue-400" /> Panel de Usuarios Activos & Registrados
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-full font-mono">
                      {filteredUsers.length} / {registeredUsers.length} total
                    </span>
                    <button
                      type="button"
                      onClick={() => setExpandedModule('usuarios')}
                      className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white p-1.5 rounded-lg border border-white/10 transition-all cursor-pointer flex items-center gap-1"
                      title="Expandir a pantalla completa (ESC para salir)"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Barra de búsqueda y filtros rápidos */}
                <div className="mb-3 shrink-0 space-y-2">
                  <input
                    type="text"
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    placeholder="Buscar por nombre, email, teléfono..."
                    className="w-full bg-[#09090b] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <div className="flex items-center gap-1 overflow-x-auto pb-1">
                    {(['todos', 'clientes', 'cortesia_equipo', 'prueba', 'vencidos'] as const).map((filtro) => (
                      <button
                        key={filtro}
                        type="button"
                        onClick={() => setUserFilter(filtro)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-colors cursor-pointer shrink-0 ${
                          userFilter === filtro
                            ? 'bg-blue-600 text-white'
                            : 'bg-white/5 text-gray-400 hover:text-white'
                        }`}
                      >
                        {filtro === 'todos' ? 'Todos' : filtro === 'clientes' ? 'Clientes Pagos' : filtro === 'cortesia_equipo' ? 'Cortesía / Equipo' : filtro === 'prueba' ? 'En Prueba' : 'Vencidos'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 pr-1 space-y-1.5">
                  {loadingUsers ? (
                    <div className="p-6 flex justify-center items-center">
                      <div className="w-5 h-5 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="py-6 text-center text-xs text-gray-500">
                      No se encontraron usuarios con los filtros seleccionados.
                    </div>
                  ) : (
                    filteredUsers.map((user) => {
                      const inicial = (user.nombre || user.razonSocial || user.email || 'U').charAt(0).toUpperCase();
                      const nombreDisplay = user.razonSocial || user.nombre || user.email;
                      const subInfo = user.email || user.telefono || '';
                      const isActivo = user.estadoSuscripcion === 'activo';
                      const isPrueba = user.estadoSuscripcion === 'prueba';
                      const isPendiente = user.estadoSuscripcion === 'pendiente';

                      return (
                        <div key={user.id} className="flex flex-col py-2.5 border-b border-white/5 last:border-0 hover:bg-white/[0.02] px-2 rounded-lg transition-colors gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-medium text-gray-300 shrink-0">
                                {inicial}
                              </div>
                              <div className="min-w-0 truncate">
                                <p className="text-xs text-gray-200 font-medium truncate" title={nombreDisplay}>{nombreDisplay}</p>
                                <p className="text-[10px] text-gray-500 truncate">{subInfo}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {/* 1. WhatsApp Commercial Button */}
                              <a
                                href={`https://wa.me/${formatWhatsAppNumber(user.telefono || '')}?text=${encodeURIComponent('¡Hola ' + (user.nombre || 'Escribano') + '! Te saluda el equipo de O.L.G.A. Notarial (soporte@olgatech.com.py / WhatsApp +595 983 440021). Vimos que tu cuenta está en estado ' + user.estadoSuscripcion + '. Queremos ofrecerte un descuento especial en tu primer mes para impulsar tu escribanía con automatización notarial total.')}`}
                                target="_blank"
                                rel="noreferrer"
                                className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${user.telefono ? 'bg-green-600/20 hover:bg-green-600/35 text-green-400' : 'bg-white/5 text-gray-600 cursor-not-allowed'}`}
                                title={user.telefono ? `Contactar por WhatsApp (${user.telefono})` : 'Sin teléfono registrado'}
                                onClick={(e) => { if (!user.telefono) e.preventDefault(); }}
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>

                              {/* 2. Corporate Gmail Button */}
                              <a
                                href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(user.email || '')}&su=${encodeURIComponent('Promoción Exclusiva O.L.G.A. Notarial - Primer Mes con Descuento Especial')}&body=${encodeURIComponent('Estimado/a ' + (user.nombre || 'Escribano/a') + ',\n\nLe escribimos desde el equipo de Soporte y Ventas de O.L.G.A. Notarial (soporte@olgatech.com.py).\n\nHemos notado que su cuenta se encuentra en estado ' + user.estadoSuscripcion + '. Queremos facilitarle el acceso al sistema completo con una tarifa preferencial y soporte personalizado.\n\nContáctenos directamente a:\n• Correo: soporte@olgatech.com.py\n• WhatsApp: +595 983 440021\n\nAtentamente,\nEquipo de Soporte y Ventas O.L.G.A.')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 bg-blue-600/20 hover:bg-blue-600/35 text-blue-400 rounded-lg transition-colors flex items-center justify-center"
                                title={`Enviar correo corporativo a ${user.email}`}
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </a>

                              {/* 3. Open Offer / Campaign Modal Button */}
                              <button
                                type="button"
                                onClick={() => openOfertaModal(user)}
                                className="p-1.5 bg-purple-600/20 hover:bg-purple-600/35 text-purple-400 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                                title="Oferta / Campaña personalizada"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                              </button>

                              <select
                                value={user.categoriaCuenta || 'cliente'}
                                onChange={(e) => handleCambiarCategoriaUsuario(user.id, e.target.value as any)}
                                className={`border rounded-lg text-[10px] px-2 py-1 outline-none cursor-pointer ${
                                  user.categoriaCuenta === 'cortesia' 
                                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                                    : user.categoriaCuenta === 'equipo'
                                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                }`}
                                title="Clasificación de cuenta"
                              >
                                <option value="cliente" className="bg-zinc-900 text-white">Cliente</option>
                                <option value="cortesia" className="bg-zinc-900 text-white">Cortesía / Tester</option>
                                <option value="equipo" className="bg-zinc-900 text-white">Equipo / Vendedor</option>
                              </select>

                              <select
                                value={user.plan || 'Prueba Gratuita'}
                                onChange={(e) => handleCambiarPlanUsuario(user.id, e.target.value)}
                                className="bg-[#09090b] border border-white/10 rounded-lg text-[10px] text-gray-300 px-2 py-1 outline-none cursor-pointer"
                                title="Cambiar plan en vivo"
                              >
                                <option value="Prueba Gratuita">Prueba (5d)</option>
                                <option value="Plan Básico">Plan Básico</option>
                                <option value="Plan Pro">Plan Pro</option>
                                <option value="Plan Empresa">Plan Empresa</option>
                                <option value="Plan Full">Plan Full</option>
                              </select>

                              <div>
                                {isActivo ? (
                                  <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-medium border border-emerald-500/20">
                                    Activo
                                  </span>
                                ) : isPrueba ? (
                                  <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full font-medium border border-cyan-500/20">
                                    Prueba ({user.diasRestantes ?? 5}d)
                                  </span>
                                ) : isPendiente ? (
                                  <span className="text-[9px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-medium border border-amber-500/20">
                                    Pendiente
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full font-medium border border-red-500/20">
                                    Vencido
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Fila compacta: 3 switches independientes de Módulos / Add-ons */}
                          <div className="flex flex-wrap items-center gap-1.5 pl-9">
                            <span className="text-[9px] uppercase tracking-wider font-semibold text-gray-500 mr-0.5">
                              Add-ons:
                            </span>
                            {ADDON_MODULES.map((mod) => {
                              const { enabled, isInherited } = getEffectiveAddonState(user, mod.field);
                              const isBusy = Boolean(togglingAddonKeys[`${user.id}:${mod.field}`]);
                              return (
                                <button
                                  key={mod.field}
                                  type="button"
                                  role="switch"
                                  aria-checked={enabled}
                                  disabled={isBusy}
                                  onClick={() => handleToggleAddon(user, mod.field)}
                                  title={`${mod.fullLabel}: ${enabled ? 'Activo' : 'Inactivo'}${isInherited ? ' (heredado del plan)' : ' (manual)'} — clic para cambiar`}
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                                    enabled
                                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                                      : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                                  }`}
                                >
                                  <span>{mod.shortLabel}</span>
                                  <span
                                    className={`relative inline-flex h-3 w-5 items-center rounded-full transition-colors ${
                                      enabled ? 'bg-emerald-500' : 'bg-zinc-700'
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-2 w-2 transform rounded-full bg-white transition-transform ${
                                        enabled ? 'translate-x-2.5' : 'translate-x-0.5'
                                      }`}
                                    />
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* MODAL EXPANDIDO: USUARIOS */}
        {expandedModule === 'usuarios' && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200">
            <div className="w-full max-w-7xl h-[90vh] bg-[#121214] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Panel de Usuarios Activos & Registrados (Pantalla Completa)</h2>
                    <p className="text-xs text-gray-400">Gestión ejecutiva de clientes, pruebas y cuentas de cortesía/equipo ({filteredUsers.length} de {registeredUsers.length})</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 font-mono">
                    ESC para contraer
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpandedModule(null)}
                    className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white p-2 rounded-xl border border-white/10 transition-all cursor-pointer flex items-center gap-1.5"
                    title="Contraer (ESC)"
                  >
                    <Minimize2 className="w-4 h-4" /> Contraer
                  </button>
                </div>
              </div>

              {/* Barra de búsqueda y filtros en modal */}
              <div className="mb-4 shrink-0 flex flex-col md:flex-row items-center gap-3">
                <input
                  type="text"
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  placeholder="Buscar por nombre, email, teléfono..."
                  className="w-full md:flex-1 bg-[#09090b] border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                />
                <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
                  {(['todos', 'clientes', 'cortesia_equipo', 'prueba', 'vencidos'] as const).map((filtro) => (
                    <button
                      key={filtro}
                      type="button"
                      onClick={() => setUserFilter(filtro)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer shrink-0 ${
                        userFilter === filtro
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      {filtro === 'todos' ? 'Todos' : filtro === 'clientes' ? 'Clientes' : filtro === 'cortesia_equipo' ? 'Cortesía/Equipo' : filtro === 'prueba' ? 'Prueba' : 'Vencidos'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tabla expandida */}
              <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 rounded-2xl border border-white/5 bg-[#09090b]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/[0.02] border-b border-white/10 text-gray-400 text-[11px] uppercase tracking-wider font-semibold">
                      <th className="p-3.5">Usuario / Razón Social</th>
                      <th className="p-3.5">Contacto</th>
                      <th className="p-3.5">Registro</th>
                      <th className="p-3.5">Categoría</th>
                      <th className="p-3.5">Plan</th>
                      <th className="p-3.5">Estado</th>
                      <th className="p-3.5 text-left whitespace-nowrap">Módulos / Add-ons</th>
                      <th className="p-3.5 text-right">Acciones Comerciales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs">
                    {filteredUsers.map((user) => {
                      const inicial = (user.nombre || user.razonSocial || user.email || 'U').charAt(0).toUpperCase();
                      const nombreDisplay = user.razonSocial || user.nombre || user.email;
                      const isActivo = user.estadoSuscripcion === 'activo';
                      const isPrueba = user.estadoSuscripcion === 'prueba';
                      const isPendiente = user.estadoSuscripcion === 'pendiente';

                      return (
                        <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-gray-300 shrink-0">
                                {inicial}
                              </div>
                              <div>
                                <p className="font-semibold text-white">{nombreDisplay}</p>
                                <p className="text-[10px] text-gray-500">{user.nombre || 'Sin nombre fiscal'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <p className="text-gray-300">{user.email}</p>
                            <p className="text-[10px] text-gray-500 font-mono">{user.telefono || 'Sin teléfono'}</p>
                          </td>
                          <td className="p-3.5 text-gray-400 font-mono text-[11px]">
                            {user.fechaFormateada}
                          </td>
                          <td className="p-3.5">
                            <select
                              value={user.categoriaCuenta || 'cliente'}
                              onChange={(e) => handleCambiarCategoriaUsuario(user.id, e.target.value as any)}
                              className={`border rounded-lg text-xs px-2.5 py-1 outline-none cursor-pointer ${
                                user.categoriaCuenta === 'cortesia' 
                                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                                  : user.categoriaCuenta === 'equipo'
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              }`}
                            >
                              <option value="cliente" className="bg-zinc-900 text-white">Cliente</option>
                              <option value="cortesia" className="bg-zinc-900 text-white">Cortesía / Tester</option>
                              <option value="equipo" className="bg-zinc-900 text-white">Equipo / Vendedor</option>
                            </select>
                          </td>
                          <td className="p-3.5">
                            <select
                              value={user.plan || 'Prueba Gratuita'}
                              onChange={(e) => handleCambiarPlanUsuario(user.id, e.target.value)}
                              className="bg-[#121214] border border-white/10 rounded-lg text-xs text-gray-200 px-2.5 py-1 outline-none cursor-pointer"
                            >
                              <option value="Prueba Gratuita">Prueba (5d)</option>
                              <option value="Plan Básico">Plan Básico</option>
                              <option value="Plan Pro">Plan Pro</option>
                              <option value="Plan Empresa">Plan Empresa</option>
                              <option value="Plan Full">Plan Full</option>
                            </select>
                          </td>
                          <td className="p-3.5">
                            {isActivo ? (
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full font-medium border border-emerald-500/20">
                                Activo
                              </span>
                            ) : isPrueba ? (
                              <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2.5 py-1 rounded-full font-medium border border-cyan-500/20">
                                Prueba ({user.diasRestantes ?? 5}d)
                              </span>
                            ) : isPendiente ? (
                              <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full font-medium border border-amber-500/20">
                                Pendiente
                              </span>
                            ) : (
                              <span className="text-[10px] bg-red-500/10 text-red-400 px-2.5 py-1 rounded-full font-medium border border-red-500/20">
                                Vencido
                              </span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <div className="flex flex-col gap-1.5 min-w-[175px]">
                              {ADDON_MODULES.map((mod) => {
                                const { enabled, isInherited } = getEffectiveAddonState(user, mod.field);
                                const isBusy = Boolean(togglingAddonKeys[`${user.id}:${mod.field}`]);
                                return (
                                  <div
                                    key={mod.field}
                                    className="flex items-center justify-between gap-2.5"
                                  >
                                    <span
                                      className={`text-[11px] font-medium whitespace-nowrap ${
                                        enabled ? 'text-emerald-300' : 'text-gray-400'
                                      }`}
                                      title={isInherited ? 'Heredado del plan' : 'Configuración manual'}
                                    >
                                      {mod.shortLabel}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        role="switch"
                                        aria-checked={enabled}
                                        disabled={isBusy}
                                        onClick={() => handleToggleAddon(user, mod.field)}
                                        title={`${mod.fullLabel}: ${enabled ? 'Activo' : 'Inactivo'}${isInherited ? ' (heredado del plan)' : ' (manual)'} — clic para cambiar`}
                                        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border transition-colors cursor-pointer disabled:opacity-50 ${
                                          enabled
                                            ? 'bg-emerald-500 border-emerald-400/50'
                                            : 'bg-zinc-800 border-white/10'
                                        }`}
                                      >
                                        <span
                                          className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow transition-transform ${
                                            enabled ? 'translate-x-3.5' : 'translate-x-0.5'
                                          }`}
                                        />
                                      </button>
                                      <span
                                        className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold border whitespace-nowrap ${
                                          enabled
                                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                            : 'bg-white/5 text-gray-500 border-white/10'
                                        }`}
                                      >
                                        {enabled ? 'Activo' : 'Inactivo'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <a
                                href={`https://wa.me/${formatWhatsAppNumber(user.telefono || '')}?text=${encodeURIComponent('¡Hola ' + (user.nombre || 'Escribano') + '! Te saluda el equipo de O.L.G.A. Notarial (soporte@olgatech.com.py / WhatsApp +595 983 440021). Vimos que tu cuenta está en estado ' + user.estadoSuscripcion + '. Queremos ofrecerte un descuento especial en tu primer mes para impulsar tu escribanía con automatización notarial total.')}`}
                                target="_blank"
                                rel="noreferrer"
                                className={`px-2.5 py-1.5 rounded-xl transition-colors flex items-center gap-1 text-xs font-semibold ${user.telefono ? 'bg-green-600/20 hover:bg-green-600/35 text-green-400' : 'bg-white/5 text-gray-600 cursor-not-allowed'}`}
                                onClick={(e) => { if (!user.telefono) e.preventDefault(); }}
                              >
                                <Phone className="w-3.5 h-3.5" /> WhatsApp
                              </a>
                              <a
                                href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(user.email || '')}&su=${encodeURIComponent('Promoción Exclusiva O.L.G.A. Notarial - Primer Mes con Descuento Especial')}&body=${encodeURIComponent('Estimado/a ' + (user.nombre || 'Escribano/a') + ',\n\nLe escribimos desde el equipo de Soporte y Ventas de O.L.G.A. Notarial (soporte@olgatech.com.py).\n\nHemos notado que su cuenta se encuentra en estado ' + user.estadoSuscripcion + '. Queremos facilitarle el acceso al sistema completo con una tarifa preferencial y soporte personalizado.\n\nContáctenos directamente a:\n• Correo: soporte@olgatech.com.py\n• WhatsApp: +595 983 440021\n\nAtentamente,\nEquipo de Soporte y Ventas O.L.G.A.')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/35 text-blue-400 rounded-xl transition-colors flex items-center gap-1 text-xs font-semibold"
                              >
                                <Mail className="w-3.5 h-3.5" /> Gmail
                              </a>
                              <button
                                type="button"
                                onClick={() => openOfertaModal(user)}
                                className="px-2.5 py-1.5 bg-purple-600/20 hover:bg-purple-600/35 text-purple-400 rounded-xl transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer"
                              >
                                <Sparkles className="w-3.5 h-3.5" /> Oferta / Campaña
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODAL EXPANDIDO: PAGARES */}
        {expandedModule === 'pagares' && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200">
            <div className="w-full max-w-7xl h-[90vh] bg-[#121214] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Auditoría Global & Emisión de Pagarés (Pantalla Completa)</h2>
                    <p className="text-xs text-gray-400">Listado completo de instrumentos notariales emitidos en el sistema ({filteredPagares.length} de {pagaresGlobal.length})</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 font-mono">
                    ESC para contraer
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpandedModule(null)}
                    className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white p-2 rounded-xl border border-white/10 transition-all cursor-pointer flex items-center gap-1.5"
                    title="Contraer (ESC)"
                  >
                    <Minimize2 className="w-4 h-4" /> Contraer
                  </button>
                </div>
              </div>

              {/* Barra de búsqueda rápida */}
              <div className="mb-4 shrink-0">
                <input
                  type="text"
                  value={pagaresSearchTerm}
                  onChange={(e) => setPagaresSearchTerm(e.target.value)}
                  placeholder="Buscar por acreedor, deudor, C.I./R.U.C. o escribano emisor..."
                  className="w-full bg-[#09090b] border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Tabla expandida de pagarés */}
              <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 rounded-2xl border border-white/5 bg-[#09090b]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/[0.02] border-b border-white/10 text-gray-400 text-[11px] uppercase tracking-wider font-semibold">
                      <th className="p-3.5">Fecha Emisión</th>
                      <th className="p-3.5">Escribanía / Emisor</th>
                      <th className="p-3.5">Acreedor</th>
                      <th className="p-3.5">Deudor (C.I. / R.U.C.)</th>
                      <th className="p-3.5">Monto (Gs.)</th>
                      <th className="p-3.5">Vencimiento</th>
                      <th className="p-3.5 text-right">Auditoría IA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs">
                    {filteredPagares.map((pagare) => {
                      const emisor = pagare.empresa || pagare.acreedor_nombre || pagare.userEmail || 'Emisor';
                      const montoFormatted = typeof pagare.monto === 'number' 
                        ? `Gs. ${pagare.monto.toLocaleString('es-PY')}` 
                        : pagare.monto;

                      return (
                        <tr key={pagare.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-3.5 font-mono text-gray-400 text-[11px]">
                            {pagare.fecha_emision}
                          </td>
                          <td className="p-3.5 font-semibold text-white">
                            {emisor}
                          </td>
                          <td className="p-3.5 text-gray-200">
                            {pagare.acreedor_nombre}
                          </td>
                          <td className="p-3.5">
                            <p className="text-gray-200 font-medium">{pagare.deudor_nombre}</p>
                            <p className="text-[10px] text-gray-500 font-mono">{pagare.deudor_cedula || 'Sin documento'}</p>
                          </td>
                          <td className="p-3.5 font-mono font-semibold text-emerald-400">
                            {montoFormatted}
                          </td>
                          <td className="p-3.5 font-mono text-gray-300 text-[11px]">
                            {pagare.fecha_vencimiento || 'No especificada'}
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleAuditoria(pagare)}
                              className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-400 rounded-xl transition-colors font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" /> Ver Auditoría IA
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CONSUMO DE IA */}
        {aiModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200">
            <div className="w-full max-w-3xl bg-[#121214] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-white/15 pb-4 mb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-500/10 rounded-2xl border border-purple-500/20 text-purple-400">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Análisis de Consultas IA (Asistente O.L.G.A.)</h2>
                    <p className="text-xs text-gray-400">Estado de integración Gemini SDK y consumo por operador</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAiModalOpen(false)}
                  className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white p-2 rounded-xl border border-white/10 transition-all cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto flex-1 pr-1 text-xs text-gray-300">
                <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-2xl space-y-2">
                  <h4 className="font-bold text-purple-300 text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" /> ¿La Consulta IA está configurada?
                  </h4>
                  <p className="leading-relaxed text-gray-300">
                    <strong>¡Sí, está 100% configurada y activa!</strong> El sistema utiliza el SDK oficial de Google GenAI para asistir en la redacción de escritos y análisis de pagarés.
                    El contador marca <strong>{metrics.aiQueries}</strong> porque los usuarios activos aún no han realizado generaciones en esta base de datos o se encuentran en el inicio de su periodo de prueba. Cada vez que un escribano genere una minuta o escrito asistido en el módulo correspondiente, el contador se incrementará automáticamente.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-white mb-2 uppercase tracking-wider text-[11px] text-gray-400">Desglose de Consumo por Usuario:</h4>
                  <div className="bg-[#09090b] rounded-2xl border border-white/5 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-white/[0.02] border-b border-white/10 text-gray-400 text-[10px] uppercase">
                          <th className="p-3">Escribano / Usuario</th>
                          <th className="p-3">Plan</th>
                          <th className="p-3 text-right">Consultas Usadas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {registeredUsers.map(u => {
                          const uso = Number(u.raw?.usoIA || u.raw?.consultasUsadas || u.raw?.aiConsultationsCount || 0);
                          return (
                            <tr key={u.id} className="hover:bg-white/[0.02]">
                              <td className="p-3">
                                <p className="font-semibold text-white">{u.nombre || u.razonSocial || u.email}</p>
                                <p className="text-[10px] text-gray-500">{u.email}</p>
                              </td>
                              <td className="p-3 text-gray-400">{u.plan}</td>
                              <td className="p-3 text-right font-mono font-bold text-purple-400">{uso}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-white/15 mt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setAiModalOpen(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: PAGOS PENDIENTES */}
        {pagosModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200">
            <div className="w-full max-w-3xl bg-[#121214] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-white/15 pb-4 mb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-orange-500/10 rounded-2xl border border-orange-500/20 text-orange-400">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Gestión de Cobros y Suscripciones Pendientes</h2>
                    <p className="text-xs text-gray-400">Verificación de comprobantes de transferencia y aprobación de planes</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPagosModalOpen(false)}
                  className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white p-2 rounded-xl border border-white/10 transition-all cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 overflow-y-auto flex-1 pr-1 text-xs">
                {pendingPayments.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 flex flex-col items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-emerald-500/30 mb-2" />
                    <p className="font-medium text-gray-300">No hay pagos pendientes de verificación en este momento.</p>
                  </div>
                ) : (
                  pendingPayments.map(pago => (
                    <div key={pago.id} className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl flex items-center justify-between gap-4">
                      <div>
                        <p className="font-bold text-white text-sm">{pago.nombreCliente || pago.email}</p>
                        <p className="text-gray-400 mt-0.5">Plan solicitado: <span className="text-white font-medium">{pago.planSolicitado}</span> • Monto: <span className="font-mono text-emerald-400 font-bold">Gs. {(pago.montoAPagar || 0).toLocaleString('es-PY')}</span></p>
                      </div>
                      <div className="flex items-center gap-2">
                        {pago.urlComprobante && (
                          <button
                            type="button"
                            onClick={() => { setReciboSeleccionado(pago.urlComprobante); setPagosModalOpen(false); }}
                            className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/35 text-blue-400 rounded-xl font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> Ver Recibo
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => { handleAprobar(pago.userId || pago.id, pago.planSolicitado || '', pago.modalidadPago); }}
                          className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-400 rounded-xl font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Aprobar Plan
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end pt-4 border-t border-white/15 mt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setPagosModalOpen(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: BUZÓN DE CONSULTAS */}
        {buzonModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200">
            <div className="w-full max-w-4xl bg-[#121214] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-white/15 pb-4 mb-4 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-amber-400">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Buzón de Consultas y Soporte Técnico</h2>
                    <p className="text-xs text-gray-400">Gestión de solicitudes e inquietudes de usuarios ({pendingTicketsCount} pendientes)</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setBuzonModalOpen(false)}
                  className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white p-2 rounded-xl border border-white/10 transition-all cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 overflow-y-auto flex-1 pr-1 text-xs">
                {pendingTickets.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 flex flex-col items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-emerald-500/30 mb-2" />
                    <p className="font-medium text-gray-300">No hay consultas en el buzón actualmente.</p>
                  </div>
                ) : (
                  pendingTickets.map(ticket => {
                    const isResuelto = ticket.estado === 'resuelto';
                    const isPendiente = ticket.estado === 'pendiente' || !ticket.estado;
                    return (
                      <div key={ticket.id} className={`p-4 border rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${isResuelto ? 'bg-white/[0.01] opacity-70 border-white/5' : 'bg-white/[0.03] border-amber-500/20'}`}>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-white text-sm truncate">{ticket.asunto || ticket.mensaje || 'Consulta'}</p>
                          <p className="text-[11px] text-gray-300 mt-1">{ticket.mensaje}</p>
                          <p className="text-[10px] text-gray-500 mt-1 font-mono">{ticket.userEmail || ticket.email || 'Usuario'} • Estado: <span className="uppercase text-white font-semibold">{ticket.estado || 'pendiente'}</span></p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          {isPendiente && (
                            <button
                              type="button"
                              onClick={() => handleMarcarEnProceso(ticket.id)}
                              className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/35 text-blue-400 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer"
                            >
                              En Proceso
                            </button>
                          )}
                          {!isResuelto && (
                            <button
                              type="button"
                              onClick={() => handleResolverTicket(ticket.id)}
                              className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/35 text-amber-400 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer"
                            >
                              Resolver
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleEliminarTicket(ticket.id)}
                            className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/35 text-red-400 rounded-lg font-semibold text-[11px] transition-colors cursor-pointer"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex justify-end pt-4 border-t border-white/15 mt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setBuzonModalOpen(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Recibo */}
        {reciboSeleccionado && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="relative max-w-4xl max-h-screen overflow-hidden flex flex-col items-center justify-center bg-[#121214] border border-white/10 rounded-2xl p-4">
              <button
                onClick={() => setReciboSeleccionado(null)}
                className="absolute top-4 right-4 bg-zinc-900/80 hover:bg-zinc-800 text-white p-2 rounded-full transition-colors z-10 border border-white/10 cursor-pointer"
                title="Cerrar"
              >
                ✕
              </button>
              <h3 className="text-white text-sm font-bold mb-3">Comprobante de Pago Subido por el Usuario</h3>
              <div className="overflow-auto max-h-[80vh] max-w-full">
                <img src={reciboSeleccionado} alt="Comprobante de Pago" className="object-contain max-h-[70vh] rounded-xl border border-white/10" />
              </div>
            </div>
          </div>
        )}

        {/* Modal Auditoría */}
        {auditoriaSeleccionada && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="relative max-w-lg w-full bg-[#121214] border border-white/10 rounded-2xl p-5 space-y-4 shadow-2xl text-white">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  {renderRiesgoIcon(auditoriaSeleccionada.reporte.riesgo)}
                  <h3 className="font-bold text-base">Auditoría Automática de Pagaré</h3>
                </div>
                <button
                  onClick={() => setAuditoriaSeleccionada(null)}
                  className="text-gray-400 hover:text-white text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
                  <span className="text-gray-400">Nivel de Riesgo Detectado:</span>
                  {renderRiesgoBadge(auditoriaSeleccionada.reporte.riesgo)}
                </div>

                <div className="bg-white/[0.02] p-3 rounded-xl border border-white/5 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Detalle del Instrumento:</span>
                  <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                    <div><span className="text-gray-500">Emisor:</span> {auditoriaSeleccionada.pagare.acreedor_nombre}</div>
                    <div><span className="text-gray-500">Deudor:</span> {auditoriaSeleccionada.pagare.deudor_nombre}</div>
                    <div><span className="text-gray-500">Monto:</span> {typeof auditoriaSeleccionada.pagare.monto === 'number' ? `Gs. ${auditoriaSeleccionada.pagare.monto.toLocaleString('es-PY')}` : auditoriaSeleccionada.pagare.monto}</div>
                    <div><span className="text-gray-500">Vencimiento:</span> {auditoriaSeleccionada.pagare.fecha_vencimiento || 'No especificado'}</div>
                  </div>
                </div>

                {auditoriaSeleccionada.reporte.razones.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 space-y-1.5 text-red-300">
                    <span className="font-bold block text-[11px]">Observaciones y Alertas:</span>
                    <ul className="list-disc pl-4 space-y-1 text-[11px]">
                      {auditoriaSeleccionada.reporte.razones.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {auditoriaSeleccionada.reporte.razones.length === 0 && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-300 text-center">
                    ✓ Instrumento auditado sin anomalías detectadas. Coherencia jurídica e impositiva válida.
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setAuditoriaSeleccionada(null)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cerrar Auditoría
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: OFERTA / CAMPAÑA COMERCIAL */}
        {ofertaModalUser && (() => {
          const telefonoLimpio = formatWhatsAppNumber(ofertaModalUser.telefono || '');
          const hasPhone = Boolean(telefonoLimpio);
          const emailDestino = (ofertaModalUser.email || '').trim();
          const hasEmail = Boolean(emailDestino);
          const nombreUsuarioDisplay = ofertaModalUser.razonSocial || ofertaModalUser.nombre || emailDestino || 'Usuario';
          const whatsappHref = hasPhone
            ? `https://wa.me/${telefonoLimpio}?text=${encodeURIComponent(ofertaMensaje)}`
            : '#';
          const gmailHref = hasEmail
            ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emailDestino)}&su=${encodeURIComponent(ofertaAsunto)}&body=${encodeURIComponent(ofertaMensaje)}`
            : '#';

          return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-200">
              <div className="w-full max-w-2xl bg-[#121214] border border-white/10 rounded-3xl p-5 md:p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 text-gray-200">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-white/10 pb-4 mb-4 shrink-0 gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2.5 bg-purple-500/15 rounded-2xl border border-purple-500/30 text-purple-400 shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-white truncate">
                        Oferta / Campaña Comercial
                      </h2>
                      <p className="text-xs text-gray-300 font-medium truncate mt-0.5" title={nombreUsuarioDisplay}>
                        {nombreUsuarioDisplay}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-300 font-medium">
                          {ofertaModalUser.plan || 'Prueba Gratuita'}
                        </span>
                        {ofertaModalUser.estadoSuscripcion === 'activo' ? (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-medium border border-emerald-500/20">
                            Activo
                          </span>
                        ) : ofertaModalUser.estadoSuscripcion === 'prueba' ? (
                          <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full font-medium border border-cyan-500/20">
                            Prueba ({ofertaModalUser.diasRestantes ?? 5}d)
                          </span>
                        ) : ofertaModalUser.estadoSuscripcion === 'pendiente' ? (
                          <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-medium border border-amber-500/20">
                            Pendiente
                          </span>
                        ) : (
                          <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full font-medium border border-red-500/20">
                            Vencido
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400 font-mono truncate">
                          {hasEmail ? emailDestino : 'Sin email'} • {ofertaModalUser.telefono || 'Sin teléfono'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOfertaModalUser(null)}
                    className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white p-2 rounded-xl border border-white/10 transition-all cursor-pointer shrink-0"
                    title="Cerrar (ESC)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 pr-1 space-y-4">
                  {/* Selector de plantillas */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                      1. Selecciona una plantilla de oferta
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {OFERTA_TEMPLATES.map((tpl) => {
                        const selected = ofertaTemplateId === tpl.id;
                        return (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => handleSelectOfertaTemplate(tpl.id)}
                            className={`text-left p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                              tpl.id === 'personalizado' ? 'sm:col-span-2' : ''
                            } ${
                              selected
                                ? 'bg-purple-500/15 border-purple-500/50 text-white shadow-sm'
                                : 'bg-[#09090b] border-white/10 hover:border-white/20 text-gray-300 hover:bg-white/[0.03]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold">{tpl.title}</span>
                              <span
                                className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                                  selected
                                    ? 'bg-purple-500/30 text-purple-200 border border-purple-400/30'
                                    : 'bg-white/5 text-gray-400 border border-white/10'
                                }`}
                              >
                                {tpl.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-400 leading-snug">
                              {tpl.subtitle}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Asunto */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                      2. Asunto (para envío por Gmail)
                    </label>
                    <input
                      type="text"
                      value={ofertaAsunto}
                      onChange={(e) => setOfertaAsunto(e.target.value)}
                      placeholder={`Ej: Propuesta exclusiva O.L.G.A. para ${nombreUsuarioDisplay}`}
                      className="w-full bg-[#09090b] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>

                  {/* Cuerpo del mensaje */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                      3. Vista previa y edición del mensaje
                    </label>
                    <textarea
                      rows={7}
                      value={ofertaMensaje}
                      onChange={(e) => setOfertaMensaje(e.target.value)}
                      placeholder={`Redacta aquí el mensaje para ${nombreUsuarioDisplay}...`}
                      className="w-full bg-[#09090b] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors resize-y leading-relaxed"
                    />
                  </div>

                  {(!hasPhone || !hasEmail) && (
                    <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-3.5 py-2.5 text-[11px] text-amber-300 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        {!hasPhone && <p>Este usuario no tiene teléfono registrado para WhatsApp.</p>}
                        {!hasEmail && <p>Este usuario no tiene correo electrónico registrado para Gmail.</p>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-4 border-t border-white/10 mt-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => setOfertaModalUser(null)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noreferrer"
                      aria-disabled={!hasPhone || !ofertaMensaje.trim()}
                      onClick={(e) => {
                        if (!hasPhone || !ofertaMensaje.trim()) e.preventDefault();
                      }}
                      title={
                        !hasPhone
                          ? 'Usuario sin teléfono registrado'
                          : !ofertaMensaje.trim()
                            ? 'Escribe un mensaje antes de enviar'
                            : `Enviar por WhatsApp (${ofertaModalUser.telefono})`
                      }
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border ${
                        hasPhone && ofertaMensaje.trim()
                          ? 'bg-green-600/25 hover:bg-green-600/40 text-green-300 border-green-500/30 cursor-pointer'
                          : 'bg-white/5 text-gray-500 border-white/5 cursor-not-allowed pointer-events-auto opacity-60'
                      }`}
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {hasPhone ? 'Enviar por WhatsApp' : 'WhatsApp (Sin teléfono)'}
                    </a>

                    <a
                      href={gmailHref}
                      target="_blank"
                      rel="noreferrer"
                      aria-disabled={!hasEmail || !ofertaMensaje.trim()}
                      onClick={(e) => {
                        if (!hasEmail || !ofertaMensaje.trim()) e.preventDefault();
                      }}
                      title={
                        !hasEmail
                          ? 'Usuario sin email registrado'
                          : !ofertaMensaje.trim()
                            ? 'Escribe un mensaje antes de enviar'
                            : `Redactar en Gmail para ${emailDestino}`
                      }
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border ${
                        hasEmail && ofertaMensaje.trim()
                          ? 'bg-blue-600/25 hover:bg-blue-600/40 text-blue-300 border-blue-500/30 cursor-pointer'
                          : 'bg-white/5 text-gray-500 border-white/5 cursor-not-allowed pointer-events-auto opacity-60'
                      }`}
                    >
                      <Mail className="w-3.5 h-3.5" />
                      {hasEmail ? 'Enviar por Gmail' : 'Gmail (Sin email)'}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
        {/* MODAL: CENTRO DE AVISOS & CAMPAÑAS MASIVAS */}
        {centerModalOpen && (() => {
          const gmailBccHref =
            segmentValidEmails.length > 0 && campaignSubject.trim() && campaignBody.trim()
              ? `https://mail.google.com/mail/?view=cm&fs=1&bcc=${encodeURIComponent(segmentValidEmails.join(','))}&su=${encodeURIComponent(campaignSubject)}&body=${encodeURIComponent(campaignBody)}`
              : '#';

          return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-200">
              <div className="w-full max-w-3xl bg-[#121214] border border-white/10 rounded-3xl p-5 md:p-6 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200 text-gray-200">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-white/10 pb-4 mb-4 shrink-0 gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2.5 bg-purple-500/15 rounded-2xl border border-purple-500/30 text-purple-400 shrink-0">
                      <Megaphone className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-white truncate">
                        Centro de Avisos & Campañas
                      </h2>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Publica banners globales en O.L.G.A. o ejecuta campañas segmentadas por Gmail y WhatsApp.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCenterModalOpen(false)}
                    className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white p-2 rounded-xl border border-white/10 transition-all cursor-pointer shrink-0"
                    title="Cerrar (ESC)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Selector de Audiencia (Segmentación en vivo) */}
                <div className="mb-4 shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      Audiencia objetivo ({segmentedUsers.length} usuarios seleccionados)
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {SEGMENT_OPTIONS.map((seg) => {
                      const active = campaignSegment === seg.id;
                      const count = segmentCounts[seg.id];
                      return (
                        <button
                          key={seg.id}
                          type="button"
                          onClick={() => setCampaignSegment(seg.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border ${
                            active
                              ? 'bg-purple-600/25 border-purple-500/50 text-white'
                              : 'bg-[#09090b] border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                          }`}
                        >
                          <span>{seg.label}</span>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
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
                <div className="inline-flex items-center bg-[#09090b] border border-white/10 rounded-xl p-1 mb-4 shrink-0 self-start">
                  <button
                    type="button"
                    onClick={() => setCenterTab('aviso')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                      centerTab === 'aviso'
                        ? 'bg-white/10 text-white shadow-xs'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <Bell className="w-3.5 h-3.5 text-amber-400" />
                    Aviso en Plataforma (Banner)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCenterTab('masiva')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                      centerTab === 'masiva'
                        ? 'bg-white/10 text-white shadow-xs'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5 text-blue-400" />
                    Campaña Masiva (Email & WhatsApp)
                  </button>
                </div>

                {/* Contenido Scrollable */}
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 pr-1 space-y-4">
                  {centerTab === 'aviso' ? (
                    <>
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
                                    {liveAnnouncement.type} • {liveAnnouncement.targetSegment}
                                  </span>
                                </div>
                                <p className="text-xs font-bold text-white mt-1.5 truncate" title={liveAnnouncement.title}>
                                  {liveAnnouncement.title}
                                </p>
                                <div className="flex flex-wrap items-center gap-2.5 mt-2">
                                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-200 bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-1 rounded-lg">
                                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                    Recibido / Visto por <strong>{uniqueViewers.length}</strong> de <strong>{totalObjetivo}</strong> usuarios
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
                                className="px-3 py-1.5 rounded-xl bg-red-600/25 hover:bg-red-600/40 disabled:opacity-50 text-red-300 border border-red-500/35 text-xs font-bold transition-colors cursor-pointer shrink-0 self-start sm:self-center"
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

                      {/* Tipo de Aviso */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                          Tipo de aviso
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {[
                            {
                              id: 'novedad' as AnnouncementType,
                              label: 'Novedad / Actualización',
                              clsActive: 'bg-blue-500/20 border-blue-400/50 text-blue-200',
                            },
                            {
                              id: 'mantenimiento' as AnnouncementType,
                              label: 'Mantenimiento / Cambio',
                              clsActive: 'bg-amber-500/20 border-amber-400/50 text-amber-200',
                            },
                            {
                              id: 'promocion' as AnnouncementType,
                              label: 'Promoción / Oferta',
                              clsActive: 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200',
                            },
                          ].map((t) => {
                            const selected = announcementType === t.id;
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setAnnouncementType(t.id)}
                                className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center ${
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

                      {/* Plantillas rápidas */}
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                          Plantillas rápidas
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {ANNOUNCEMENT_QUICK_TEMPLATES.map((tpl) => (
                            <button
                              key={tpl.id}
                              type="button"
                              onClick={() => {
                                setAnnouncementType(tpl.type);
                                setAnnouncementTitle(tpl.title);
                                setAnnouncementMessage(tpl.message);
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-[#09090b] hover:bg-white/5 border border-white/10 hover:border-purple-500/40 text-[11px] font-medium text-gray-300 transition-colors cursor-pointer"
                            >
                              {tpl.label}
                            </button>
                          ))}
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
                            className="w-full bg-[#09090b] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
                            Mensaje del banner
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
                          <span>{announcementFeedback.text}</span>
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
                              className="px-2.5 py-1.5 rounded-xl bg-[#09090b] hover:bg-white/5 border border-white/10 hover:border-blue-500/40 text-[11px] font-medium text-gray-300 transition-colors cursor-pointer"
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
                            className="w-full bg-[#09090b] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
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
                        <div className="text-xs">
                          <p className="font-bold text-white">
                            Envío por Correo Electrónico ({segmentValidEmails.length} emails válidos)
                          </p>
                          <p className="text-[11px] text-gray-400">
                            Copia los destinatarios o abre Gmail directamente con copia oculta (CCO).
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={segmentValidEmails.length === 0}
                            onClick={() => handleCopySegmentEmails(segmentValidEmails)}
                            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
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
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border ${
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
                            <Phone className="w-3.5 h-3.5 text-green-400" />
                            Envío rápido por WhatsApp ({segmentPhoneUsers.length} con teléfono)
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
                                <div
                                  key={segUser.id}
                                  className="py-2 flex items-center justify-between gap-3"
                                >
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-gray-200 truncate">
                                      {nombrePersona}
                                    </p>
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
                                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-colors shrink-0 border ${
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
                <div className="flex items-center justify-between gap-3 pt-4 border-t border-white/10 mt-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCenterModalOpen(false)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
                  >
                    Cerrar
                  </button>
                  {centerTab === 'aviso' && (
                    <button
                      type="button"
                      onClick={handlePublicarAviso}
                      disabled={publishingAnnouncement}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Megaphone className="w-3.5 h-3.5" />
                      {publishingAnnouncement ? 'Publicando...' : 'Publicar Aviso'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* TOAST FLOTANTE FIJO (Confirmación inmediata de Avisos) */}
        {floatingToast && (
          <div
            role="status"
            aria-live="polite"
            className={`fixed bottom-5 right-5 z-[80] max-w-md rounded-2xl px-4 py-3 shadow-2xl border backdrop-blur-md flex items-center gap-3 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200 ${
              floatingToast.kind === 'ok'
                ? 'bg-emerald-950/95 border-emerald-500/45 text-emerald-100'
                : 'bg-red-950/95 border-red-500/45 text-red-100'
            }`}
          >
            {floatingToast.kind === 'ok' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span className="leading-snug">{floatingToast.text}</span>
            <button
              type="button"
              onClick={() => setFloatingToast(null)}
              className="p-1 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer shrink-0"
              aria-label="Cerrar notificación"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
