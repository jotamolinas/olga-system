import React, { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Info,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  Plus,
  Printer,
  QrCode,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { auth, db } from '../services/auth';
import { useWorkspace } from '../hooks/useWorkspace';
import { Persona } from '../types';
import { cargarMembreteUsuario } from '../types/presupuesto';
import { WhatsAppSendModal } from './WhatsAppSendModal';

export type RubroContratoPublico =
  | 'Taller Mecánico'
  | 'Cubiertas'
  | 'Seguros de Vehículos'
  | 'Insumos de Limpieza'
  | 'Alimentos'
  | 'Bienes y Servicios'
  | 'Otro';

export type TipoLlamadoPublico =
  | 'Llamado Mínimo Inicial'
  | 'Licitación Anual'
  | 'Plurianual';

export type ModalidadContratacionPublica =
  | 'LPN'
  | 'Concurso de Ofertas'
  | 'Menor Cuantía'
  | 'Convenio Marco'
  | 'Locación'
  | 'Contratación Directa'
  | 'Excepción'
  | 'Otro';

export type TipoMontoContrato = 'Cerrado' | 'Abierto';

export interface ContratoPublicoRecord {
  id: string;
  userId: string;
  workspaceId?: string;
  proveedor: string;
  rubro: string;
  tipoLlamado: TipoLlamadoPublico;
  numeroContrato: string;
  montoAdjudicado: number;
  fechaInicio: string;
  fechaVencimiento: string;
  observaciones: string;
  codigoPac?: string;
  modalidad?: ModalidadContratacionPublica | string;
  objetoGasto?: string;
  administradorContrato?: string;
  tipoMonto?: TipoMontoContrato | '';
  fechaVencimientoGarantia?: string;
  createdAt?: any;
  updatedAt?: any;
}

interface ContratosPublicosBetaProps {
  currentUser: User | null;
  userData?: any;
  workspaceId?: string;
  personas?: Persona[];
  onNavigateEscritos?: () => void;
  canUseWhatsApp?: boolean;
}

const RUBROS_DISPONIBLES: RubroContratoPublico[] = [
  'Taller Mecánico',
  'Cubiertas',
  'Seguros de Vehículos',
  'Insumos de Limpieza',
  'Alimentos',
  'Bienes y Servicios',
  'Otro',
];

const TIPOS_LLAMADO: TipoLlamadoPublico[] = [
  'Llamado Mínimo Inicial',
  'Licitación Anual',
  'Plurianual',
];

const MODALIDADES_CONTRATACION: ModalidadContratacionPublica[] = [
  'LPN',
  'Concurso de Ofertas',
  'Menor Cuantía',
  'Convenio Marco',
  'Locación',
  'Contratación Directa',
  'Excepción',
  'Otro',
];

const addDaysToIsoDate = (isoDate: string, days: number): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((isoDate || '').trim());
  if (!m) return '';
  const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
};

const formatMesAnioLabel = (mesAnio: string): string => {
  const m = /^(\d{4})-(\d{2})$/.exec((mesAnio || '').trim());
  if (!m) return mesAnio;
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  const idx = parseInt(m[2], 10) - 1;
  return `${meses[idx] || m[2]} ${m[1]}`;
};

const formatGs = (value: number): string => {
  const safe = Number.isFinite(value) ? value : 0;
  return `Gs. ${new Intl.NumberFormat('es-PY', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(safe))}`;
};

const formatMontoInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10);
  return Number.isFinite(num) ? num.toLocaleString('es-PY') : '';
};

const parseMontoInput = (raw: string): number => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 0;
  const parsed = parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseIsoLocalMidnight = (isoDate: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((isoDate || '').trim());
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  const day = parseInt(m[3], 10);
  const d = new Date(year, month, day, 0, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
};

const formatFechaDisplay = (isoDate: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((isoDate || '').trim());
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return isoDate || '—';
};

type SemaforoEstado = 'verde' | 'amarillo' | 'rojo';

interface SemaforoInfo {
  estado: SemaforoEstado;
  diasRestantes: number | null;
  etiqueta: string;
  detalleDias: string;
  badgeClass: string;
  dotClass: string;
}

const calcularSemaforo = (fechaVencimiento: string): SemaforoInfo => {
  const target = parseIsoLocalMidnight(fechaVencimiento);
  if (!target) {
    return {
      estado: 'amarillo',
      diasRestantes: null,
      etiqueta: 'Sin fecha',
      detalleDias: 'No definida',
      badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
      dotClass: 'bg-slate-400',
    };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  const dias = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (dias > 60) {
    return {
      estado: 'verde',
      diasRestantes: dias,
      etiqueta: 'Vigente',
      detalleDias: `${dias} días`,
      badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
      dotClass: 'bg-emerald-500',
    };
  }

  if (dias >= 30) {
    return {
      estado: 'amarillo',
      diasRestantes: dias,
      etiqueta: 'Por vencer',
      detalleDias: `${dias} días`,
      badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
      dotClass: 'bg-amber-500',
    };
  }

  if (dias < 0) {
    const absDias = Math.abs(dias);
    return {
      estado: 'rojo',
      diasRestantes: dias,
      etiqueta: 'Vencido',
      detalleDias: `hace ${absDias} ${absDias === 1 ? 'día' : 'días'}`,
      badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
      dotClass: 'bg-red-500',
    };
  }

  return {
    estado: 'rojo',
    diasRestantes: dias,
    etiqueta: 'Por vencer',
    detalleDias: dias === 0 ? 'hoy' : `${dias} ${dias === 1 ? 'día' : 'días'}`,
    badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
    dotClass: 'bg-red-500',
  };
};

export const ContratosPublicosBeta: React.FC<ContratosPublicosBetaProps> = ({
  currentUser,
  userData,
  workspaceId: workspaceIdProp,
  personas = [],
  onNavigateEscritos,
  canUseWhatsApp,
}) => {
  const { workspaceId: hookWorkspaceId, workspaceData } = useWorkspace(currentUser, userData);
  const authUid = auth?.currentUser?.uid || currentUser?.uid || '';
  const effectiveWorkspaceId = workspaceIdProp || hookWorkspaceId || userData?.tenant_id || authUid;

  const isWhatsAppEnabled = useMemo(() => {
    if (typeof canUseWhatsApp === 'boolean') return canUseWhatsApp;
    if (typeof userData?.whatsappEnabled === 'boolean') return userData.whatsappEnabled;
    if (typeof workspaceData?.whatsappEnabled === 'boolean') return workspaceData.whatsappEnabled;
    return false;
  }, [canUseWhatsApp, userData?.whatsappEnabled, workspaceData?.whatsappEnabled]);

  const institucionNombre = useMemo(() => {
    const src = { ...(userData || {}), ...(workspaceData || {}) };
    const candidates = [
      src.razonSocial,
      src.nombreInstitucion,
      src.nombreComercial,
      src.nombre,
    ];
    for (const c of candidates) {
      const s = String(c || '').trim();
      if (s && s !== '---' && s !== 'Mi Escribanía') return s;
    }
    return 'Unidad Operativa de Contratación (UOC)';
  }, [userData, workspaceData]);

  const perfilInstitucionalInforme = useMemo(() => {
    const membrete = cargarMembreteUsuario(effectiveWorkspaceId || authUid);
    const src = { ...(userData || {}), ...(workspaceData || {}) };
    const pick = (...vals: Array<any>) => {
      for (const v of vals) {
        const s = String(v || '').trim();
        if (s && s !== '---' && s !== 'Mi Escribanía') return s;
      }
      return '';
    };
    return {
      institucion:
        pick(
          src.razonSocial,
          src.nombreInstitucion,
          src.nombreComercial,
          membrete.nombreEscribania,
          src.nombre
        ) || 'Ministerio de la Niñez y la Adolescencia (MINNA)',
      dependencia:
        pick(src.registroNotarial, membrete.registroNotarial) ||
        'Unidad Operativa de Contrataciones (UOC)',
      responsable: pick(src.nombreTitular, membrete.nombreNotario),
      ruc: pick(src.ruc, membrete.ruc),
      direccion: pick(src.direccion, src.domicilio, membrete.direccion),
      ciudad: pick(src.ciudad, membrete.ciudad) || 'Asunción',
      telefono: pick(src.telefono, src.whatsapp, membrete.telefono),
      email: pick(src.email, src.correo, membrete.email),
      logoUrl: src.logo_institucional || src.logoUrl || membrete.logoUrl || null,
    };
  }, [userData, workspaceData, effectiveWorkspaceId, authUid]);

  const [contratos, setContratos] = useState<ContratoPublicoRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [firestoreError, setFirestoreError] = useState<string>('');

  // Formulario rápido de Alta / Edición
  const [mostrarFormulario, setMostrarFormulario] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [proveedor, setProveedor] = useState<string>('');
  const [rubroSelect, setRubroSelect] = useState<RubroContratoPublico>('Taller Mecánico');
  const [rubroOtro, setRubroOtro] = useState<string>('');
  const [tipoLlamado, setTipoLlamado] = useState<TipoLlamadoPublico>('Llamado Mínimo Inicial');
  const [numeroContrato, setNumeroContrato] = useState<string>('');
  const [montoInput, setMontoInput] = useState<string>('');
  const [fechaInicio, setFechaInicio] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [fechaVencimiento, setFechaVencimiento] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');
  const [codigoPac, setCodigoPac] = useState<string>('');
  const [modalidad, setModalidad] = useState<string>('');
  const [objetoGasto, setObjetoGasto] = useState<string>('');
  const [administradorContrato, setAdministradorContrato] = useState<string>('');
  const [tipoMonto, setTipoMonto] = useState<TipoMontoContrato | ''>('');
  const [fechaVencimientoGarantia, setFechaVencimientoGarantia] = useState<string>('');

  const [guardando, setGuardando] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Modal de Exportar Informe Mensual
  const [mostrarInformeMensual, setMostrarInformeMensual] = useState<boolean>(false);
  const [informeModo, setInformeModo] = useState<'mes' | 'activos'>('mes');
  const [informeMesAnio, setInformeMesAnio] = useState<string>(() =>
    new Date().toISOString().slice(0, 7)
  );

  // Filtros
  const [busqueda, setBusqueda] = useState<string>('');
  const [filtroSemaforo, setFiltroSemaforo] = useState<'todos' | SemaforoEstado>('todos');

  // Estado de WhatsApp (QR vinculado / Modal de envío / Modal de activación)
  const [waSessionConnected, setWaSessionConnected] = useState<boolean | null>(null);
  const [checkingWaContractId, setCheckingWaContractId] = useState<string | null>(null);
  const [waSendModalData, setWaSendModalData] = useState<{
    documentTitle: string;
    defaultMessage: string;
    defaultPhone: string;
  } | null>(null);
  const [showWaUpgradeModal, setShowWaUpgradeModal] = useState<boolean>(false);

  const checkWhatsAppQrConnected = async (): Promise<boolean> => {
    const ws = String(effectiveWorkspaceId || '').trim();
    if (!ws || !/^[a-zA-Z0-9_-]{4,128}$/.test(ws)) {
      setWaSessionConnected(false);
      return false;
    }
    try {
      const headers: Record<string, string> = {};
      const user = auth?.currentUser;
      if (user) {
        const token = await user.getIdToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/whatsapp/status/${encodeURIComponent(ws)}`, {
        method: 'GET',
        headers,
      });
      if (!res.ok) {
        setWaSessionConnected(false);
        return false;
      }
      const data = await res.json().catch(() => ({}));
      const connected = data?.status === 'connected';
      setWaSessionConnected(connected);
      return connected;
    } catch {
      setWaSessionConnected(false);
      return false;
    }
  };

  useEffect(() => {
    if (!isWhatsAppEnabled || !effectiveWorkspaceId) {
      setWaSessionConnected(false);
      return;
    }
    let cancelled = false;
    const ws = String(effectiveWorkspaceId).trim();
    if (!/^[a-zA-Z0-9_-]{4,128}$/.test(ws)) {
      setWaSessionConnected(false);
      return;
    }
    (async () => {
      try {
        const headers: Record<string, string> = {};
        const user = auth?.currentUser;
        if (user) {
          const token = await user.getIdToken();
          if (token) headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(`/api/whatsapp/status/${encodeURIComponent(ws)}`, {
          method: 'GET',
          headers,
        });
        if (!cancelled) {
          if (!res.ok) {
            setWaSessionConnected(false);
          } else {
            const data = await res.json().catch(() => ({}));
            setWaSessionConnected(data?.status === 'connected');
          }
        }
      } catch {
        if (!cancelled) setWaSessionConnected(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isWhatsAppEnabled, effectiveWorkspaceId]);

  useEffect(() => {
    if (!effectiveWorkspaceId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setFirestoreError('');

    const q = query(
      collection(db, 'contratos_sector_publico'),
      where('userId', '==', effectiveWorkspaceId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: ContratoPublicoRecord[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data() as any;
          return {
            id: docSnap.id,
            userId: String(d.userId || ''),
            workspaceId: d.workspaceId ? String(d.workspaceId) : undefined,
            proveedor: String(d.proveedor || ''),
            rubro: String(d.rubro || 'Bienes y Servicios'),
            tipoLlamado: TIPOS_LLAMADO.includes(d.tipoLlamado)
              ? d.tipoLlamado
              : 'Llamado Mínimo Inicial',
            numeroContrato: String(d.numeroContrato || ''),
            montoAdjudicado: Number(d.montoAdjudicado) || 0,
            fechaInicio: String(d.fechaInicio || ''),
            fechaVencimiento: String(d.fechaVencimiento || ''),
            observaciones: String(d.observaciones || ''),
            codigoPac: d.codigoPac ? String(d.codigoPac) : '',
            modalidad: d.modalidad ? String(d.modalidad) : '',
            objetoGasto: d.objetoGasto ? String(d.objetoGasto) : '',
            administradorContrato: d.administradorContrato ? String(d.administradorContrato) : '',
            tipoMonto:
              d.tipoMonto === 'Cerrado' || d.tipoMonto === 'Abierto' ? d.tipoMonto : '',
            fechaVencimientoGarantia: d.fechaVencimientoGarantia
              ? String(d.fechaVencimientoGarantia)
              : '',
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
          };
        });

        list.sort((a, b) => {
          const da = a.fechaVencimiento || '9999-12-31';
          const dbVal = b.fechaVencimiento || '9999-12-31';
          if (da !== dbVal) return da.localeCompare(dbVal);
          return a.proveedor.localeCompare(b.proveedor);
        });

        setContratos(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error al cargar contratos_sector_publico:', err);
        setFirestoreError('No se pudo sincronizar la lista de contratos. Verifique su conexión.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [effectiveWorkspaceId]);

  const resetForm = () => {
    setEditingId(null);
    setProveedor('');
    setRubroSelect('Taller Mecánico');
    setRubroOtro('');
    setTipoLlamado('Llamado Mínimo Inicial');
    setNumeroContrato('');
    setMontoInput('');
    setFechaInicio(new Date().toISOString().slice(0, 10));
    setFechaVencimiento('');
    setObservaciones('');
    setCodigoPac('');
    setModalidad('');
    setObjetoGasto('');
    setAdministradorContrato('');
    setTipoMonto('');
    setFechaVencimientoGarantia('');
    setFormError('');
  };

  const handleAbrirNuevo = () => {
    resetForm();
    setMostrarFormulario(true);
  };

  const handleEditarContrato = (c: ContratoPublicoRecord) => {
    setEditingId(c.id);
    setProveedor(c.proveedor);
    if ((RUBROS_DISPONIBLES as string[]).includes(c.rubro) && c.rubro !== 'Otro') {
      setRubroSelect(c.rubro as RubroContratoPublico);
      setRubroOtro('');
    } else {
      setRubroSelect('Otro');
      setRubroOtro(c.rubro === 'Otro' ? '' : c.rubro);
    }
    setTipoLlamado(c.tipoLlamado || 'Llamado Mínimo Inicial');
    setNumeroContrato(c.numeroContrato);
    setMontoInput(c.montoAdjudicado > 0 ? Math.round(c.montoAdjudicado).toLocaleString('es-PY') : '');
    setFechaInicio(c.fechaInicio || '');
    setFechaVencimiento(c.fechaVencimiento || '');
    setObservaciones(c.observaciones || '');
    setCodigoPac(c.codigoPac || '');
    setModalidad(c.modalidad || '');
    setObjetoGasto(c.objetoGasto || '');
    setAdministradorContrato(c.administradorContrato || '');
    setTipoMonto(c.tipoMonto || '');
    setFechaVencimientoGarantia(c.fechaVencimientoGarantia || '');
    setFormError('');
    setMostrarFormulario(true);
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // Ignorar si no aplica
    }
  };

  const handleGuardarContrato = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const uidActual = auth?.currentUser?.uid;
    if (!uidActual) {
      setFormError('Sesión no autenticada. Inicia sesión nuevamente para guardar.');
      return;
    }

    const proveedorClean = proveedor.trim();
    const rubroFinal =
      rubroSelect === 'Otro' ? rubroOtro.trim() || 'Otro' : rubroSelect;
    const numeroClean = numeroContrato.trim();
    const montoNum = parseMontoInput(montoInput);

    if (!proveedorClean) {
      setFormError('Ingresa el nombre del Proveedor / Empresa.');
      return;
    }
    if (!numeroClean) {
      setFormError('Ingresa el N.º de Contrato o ID DNCP.');
      return;
    }
    if (!fechaInicio || !fechaVencimiento) {
      setFormError('Completa la Fecha de Inicio y la Fecha de Vencimiento.');
      return;
    }
    if (fechaVencimiento < fechaInicio) {
      setFormError('La Fecha de Vencimiento no puede ser anterior a la Fecha de Inicio.');
      return;
    }

    setGuardando(true);
    try {
      const payloadBase = {
        proveedor: proveedorClean,
        rubro: rubroFinal,
        tipoLlamado,
        numeroContrato: numeroClean,
        montoAdjudicado: montoNum,
        fechaInicio,
        fechaVencimiento,
        observaciones: observaciones.trim(),
        codigoPac: codigoPac.trim(),
        modalidad: modalidad.trim(),
        objetoGasto: objetoGasto.trim(),
        administradorContrato: administradorContrato.trim(),
        tipoMonto: tipoMonto || '',
        fechaVencimientoGarantia: fechaVencimientoGarantia.trim(),
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, 'contratos_sector_publico', editingId), payloadBase);
        setFeedbackMsg(`Contrato "${numeroClean}" actualizado correctamente.`);
      } else {
        await addDoc(collection(db, 'contratos_sector_publico'), {
          ...payloadBase,
          userId: uidActual,
          workspaceId: effectiveWorkspaceId || uidActual,
          createdAt: serverTimestamp(),
        });
        setFeedbackMsg(`Contrato "${numeroClean}" registrado en el tablero UOC.`);
      }

      resetForm();
      setMostrarFormulario(false);
      setTimeout(() => setFeedbackMsg(''), 4000);
    } catch (err) {
      console.error('Error guardando contrato público:', err);
      setFormError('No se pudo guardar el contrato en Firestore. Intenta nuevamente.');
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminarContrato = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'contratos_sector_publico', id));
      setConfirmDeleteId(null);
      setFeedbackMsg('Contrato eliminado del registro.');
      setTimeout(() => setFeedbackMsg(''), 3500);
    } catch (err) {
      console.error('Error eliminando contrato:', err);
      setFirestoreError('No se pudo eliminar el contrato. Verifica tus permisos.');
    }
  };

  const kpis = useMemo(() => {
    let activos = 0;
    let porVencer60 = 0;
    let urgentes30 = 0;
    let montoTotal = 0;

    for (const c of contratos) {
      montoTotal += Number(c.montoAdjudicado) || 0;
      const sem = calcularSemaforo(c.fechaVencimiento);
      if (sem.diasRestantes === null || sem.diasRestantes >= 0) {
        activos += 1;
      }
      if (sem.diasRestantes !== null && sem.diasRestantes >= 0 && sem.diasRestantes <= 60) {
        porVencer60 += 1;
      }
      if (sem.estado === 'rojo') {
        urgentes30 += 1;
      }
    }

    return { activos, porVencer60, urgentes30, montoTotal };
  }, [contratos]);

  const contratosFiltrados = useMemo(() => {
    const qNorm = busqueda.trim().toLowerCase();
    return contratos.filter((c) => {
      const sem = calcularSemaforo(c.fechaVencimiento);
      if (filtroSemaforo !== 'todos' && sem.estado !== filtroSemaforo) {
        return false;
      }
      if (!qNorm) return true;
      return (
        c.proveedor.toLowerCase().includes(qNorm) ||
        c.numeroContrato.toLowerCase().includes(qNorm) ||
        c.rubro.toLowerCase().includes(qNorm) ||
        c.tipoLlamado.toLowerCase().includes(qNorm) ||
        c.observaciones.toLowerCase().includes(qNorm) ||
        (c.codigoPac || '').toLowerCase().includes(qNorm) ||
        (c.modalidad || '').toLowerCase().includes(qNorm) ||
        (c.objetoGasto || '').toLowerCase().includes(qNorm) ||
        (c.administradorContrato || '').toLowerCase().includes(qNorm)
      );
    });
  }, [contratos, busqueda, filtroSemaforo]);

  const contratosInforme = useMemo(() => {
    if (informeModo === 'activos') {
      return contratos.filter((c) => {
        const sem = calcularSemaforo(c.fechaVencimiento);
        return sem.diasRestantes === null || sem.diasRestantes >= 0;
      });
    }
    const ym = (informeMesAnio || '').trim();
    if (!ym) return contratos;
    return contratos.filter((c) => {
      const iniYm = (c.fechaInicio || '').slice(0, 7);
      const venYm = (c.fechaVencimiento || '').slice(0, 7);
      const afterStart = !iniYm || iniYm <= ym;
      const beforeEnd = !venYm || venYm >= ym;
      return afterStart && beforeEnd;
    });
  }, [contratos, informeModo, informeMesAnio]);

  const totalMontoInforme = useMemo(
    () => contratosInforme.reduce((acc, c) => acc + (Number(c.montoAdjudicado) || 0), 0),
    [contratosInforme]
  );

  const buildWhatsAppAlertText = (c: ContratoPublicoRecord, sem: SemaforoInfo): string => {
    const estadoTexto =
      sem.estado === 'rojo'
        ? `URGENTE (${sem.detalleDias})`
        : sem.estado === 'amarillo'
          ? `ATENCIÓN: Iniciar Adenda / Nuevo Llamado (${sem.detalleDias})`
          : `Vigente (${sem.detalleDias})`;

    const lines = [
      `*ALERTA DE VENCIMIENTO DE CONTRATO (UOC)*`,
      `Institución: ${institucionNombre}`,
      `Proveedor: ${c.proveedor}`,
      `Rubro: ${c.rubro}`,
      c.codigoPac ? `ID PAC / Llamado: ${c.codigoPac}` : '',
      c.modalidad ? `Modalidad: ${c.modalidad}` : `Tipo de Llamado: ${c.tipoLlamado}`,
      c.objetoGasto ? `Objeto del Gasto: ${c.objetoGasto}` : '',
      `N.º Contrato / ID DNCP: ${c.numeroContrato}`,
      c.tipoMonto ? `Tipo de Monto: ${c.tipoMonto}` : '',
      `Monto Adjudicado: ${formatGs(c.montoAdjudicado)}`,
      `Vencimiento Contrato: ${formatFechaDisplay(c.fechaVencimiento)}`,
      c.fechaVencimientoGarantia
        ? `Vencimiento Garantía: ${formatFechaDisplay(c.fechaVencimientoGarantia)}`
        : '',
      c.administradorContrato ? `Admin. Contrato: ${c.administradorContrato}` : '',
      `Estado: ${estadoTexto}`,
      c.observaciones ? `Obs./Adendas: ${c.observaciones}` : '',
    ].filter(Boolean);

    return lines.join('\n');
  };

  const resolveProveedorPhone = (proveedorNombre: string): string => {
    const target = proveedorNombre.trim().toLowerCase();
    if (!target) return '';
    const match = personas.find((p) => {
      const fullName = String(
        p.nombre_o_razon_social || [p.nombre, p.apellido].filter(Boolean).join(' ')
      )
        .trim()
        .toLowerCase();
      return fullName === target || fullName.includes(target) || target.includes(fullName);
    });
    return String(match?.telefono || '').trim();
  };

  const handleClickWhatsApp = async (c: ContratoPublicoRecord, sem: SemaforoInfo) => {
    if (!isWhatsAppEnabled) {
      setShowWaUpgradeModal(true);
      return;
    }

    if (checkingWaContractId) return;
    setCheckingWaContractId(c.id);
    try {
      const connected = await checkWhatsAppQrConnected();
      if (!connected) {
        const aviso = 'Primero vinculá tu WhatsApp escaneando el código QR en Configuración.';
        try {
          sessionStorage.setItem('olga_wa_qr_notice', aviso);
        } catch {
          // Ignorar restricciones de storage
        }
        setFeedbackMsg(aviso);
        window.dispatchEvent(new CustomEvent('olga_wa_qr_notice', { detail: aviso }));
        window.dispatchEvent(new CustomEvent('olga_navigate_tab', { detail: { tab: 'whatsapp' } }));
        return;
      }

      setWaSendModalData({
        documentTitle: `Alerta UOC · ${c.numeroContrato || c.proveedor}`,
        defaultMessage: buildWhatsAppAlertText(c, sem),
        defaultPhone: resolveProveedorPhone(c.proveedor),
      });
    } finally {
      setCheckingWaContractId(null);
    }
  };

  const proveedoresSugeridos = useMemo(() => {
    const set = new Set<string>();
    personas.forEach((p) => {
      const n = String(
        p.nombre_o_razon_social || [p.nombre, p.apellido].filter(Boolean).join(' ')
      ).trim();
      if (n) set.add(n);
    });
    contratos.forEach((c) => {
      if (c.proveedor) set.add(c.proveedor);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [personas, contratos]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabecera Institucional del Módulo */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-sm">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Mis Contratos (UOC)
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                Sector Público · UOC
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Control de contratos adjudicados, llamados mínimos, adendas y semáforo de vencimientos para{' '}
              <span className="font-semibold text-slate-700">{institucionNombre}</span>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setMostrarInformeMensual(true)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-4 h-4 text-slate-500" />
            Exportar Informe Mensual
          </button>
          {onNavigateEscritos && (
            <button
              type="button"
              onClick={() => onNavigateEscritos()}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
              Redactar Nota / Adenda
            </button>
          )}
          <button
            type="button"
            onClick={() => (mostrarFormulario && !editingId ? setMostrarFormulario(false) : handleAbrirNuevo())}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            {mostrarFormulario && !editingId ? (
              <>
                <X className="w-4 h-4" />
                Cerrar Formulario
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Nuevo Contrato
              </>
            )}
          </button>
        </div>
      </div>

      {/* Banners de estado */}
      {feedbackMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-xs font-semibold flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {feedbackMsg}
          </span>
          <button
            type="button"
            onClick={() => setFeedbackMsg('')}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {firestoreError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-xs font-semibold flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            {firestoreError}
          </span>
          <button
            type="button"
            onClick={() => setFirestoreError('')}
            className="text-red-700 hover:text-red-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Contratos Activos
            </span>
            <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-2">{kpis.activos}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            De {contratos.length} {contratos.length === 1 ? 'contrato registrado' : 'contratos registrados'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Por Vencer (&lt; 60 días)
            </span>
            <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-2">{kpis.porVencer60}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            {kpis.urgentes30 > 0
              ? `${kpis.urgentes30} en alerta roja (< 30 días o vencido)`
              : 'Sin alertas críticas menores a 30 días'}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Monto Total Adjudicado (Gs.)
            </span>
            <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-2 truncate">
            {formatGs(kpis.montoTotal)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Suma acumulada de contratos cargados
          </p>
        </div>
      </div>

      {/* Formulario rápido de Alta / Edición */}
      {mostrarFormulario && (
        <form
          onSubmit={handleGuardarContrato}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {editingId ? 'Editar Contrato Adjudicado' : 'Registrar Nuevo Contrato'}
              </h3>
              <p className="text-[11px] text-slate-500">
                Completa los datos del llamado, proveedor y vigencia para activar el control automático de vencimientos.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setMostrarFormulario(false);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              title="Cancelar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Proveedor / Empresa *
              </label>
              <input
                type="text"
                list="uoc-proveedores-sugeridos"
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                placeholder="Ej: Kilcopar S.A."
                className="w-full box-border border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none"
                required
              />
              <datalist id="uoc-proveedores-sugeridos">
                {proveedoresSugeridos.map((nom) => (
                  <option key={nom} value={nom} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Rubro / Objeto *
              </label>
              <select
                value={rubroSelect}
                onChange={(e) => setRubroSelect(e.target.value as RubroContratoPublico)}
                className="w-full box-border border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none cursor-pointer"
              >
                {RUBROS_DISPONIBLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {rubroSelect === 'Otro' && (
                <input
                  type="text"
                  value={rubroOtro}
                  onChange={(e) => setRubroOtro(e.target.value)}
                  placeholder="Especificar rubro u objeto..."
                  className="mt-2 w-full box-border border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none"
                />
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Tipo de Llamado *
              </label>
              <select
                value={tipoLlamado}
                onChange={(e) => setTipoLlamado(e.target.value as TipoLlamadoPublico)}
                className="w-full box-border border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none cursor-pointer"
              >
                {TIPOS_LLAMADO.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                N.º de Contrato / ID DNCP *
              </label>
              <input
                type="text"
                value={numeroContrato}
                onChange={(e) => setNumeroContrato(e.target.value)}
                placeholder="Ej: Contrato N.º 12/2026 — ID DNCP 451820"
                className="w-full box-border border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Monto Adjudicado (Gs.) *
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={montoInput}
                onChange={(e) => setMontoInput(formatMontoInput(e.target.value))}
                placeholder="Ej: 150.000.000"
                className="w-full box-border border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Fecha de Inicio *
                </label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full box-border border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-900 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Fecha de Vencimiento *
                </label>
                <input
                  type="date"
                  value={fechaVencimiento}
                  onChange={(e) => setFechaVencimiento(e.target.value)}
                  className="w-full box-border border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-900 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* Datos Técnicos UOC / DNCP (Opcionales) */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Datos Técnicos UOC / DNCP (Opcionales)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  ID PAC / ID Llamado
                </label>
                <input
                  type="text"
                  value={codigoPac}
                  onChange={(e) => setCodigoPac(e.target.value)}
                  placeholder="Ej: 492689"
                  className="w-full box-border border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Modalidad de Contratación
                </label>
                <select
                  value={modalidad}
                  onChange={(e) => setModalidad(e.target.value)}
                  className="w-full box-border border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none cursor-pointer"
                >
                  <option value="">Sin especificar</option>
                  {MODALIDADES_CONTRATACION.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Objeto del Gasto / Partida
                </label>
                <input
                  type="text"
                  value={objetoGasto}
                  onChange={(e) => setObjetoGasto(e.target.value)}
                  placeholder="Ej: 231, 251, 350, 537"
                  className="w-full box-border border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Administrador de Contrato
                </label>
                <input
                  type="text"
                  value={administradorContrato}
                  onChange={(e) => setAdministradorContrato(e.target.value)}
                  placeholder="Ej: Lic. Marcos Benítez"
                  className="w-full box-border border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Tipo de Monto Contractual
                </label>
                <select
                  value={tipoMonto}
                  onChange={(e) => setTipoMonto(e.target.value as TipoMontoContrato | '')}
                  className="w-full box-border border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none cursor-pointer"
                >
                  <option value="">Sin especificar</option>
                  <option value="Cerrado">Cerrado</option>
                  <option value="Abierto">Abierto</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Vencimiento Garantía (+30d post-contrato)
                  </label>
                  {fechaVencimiento && (
                    <button
                      type="button"
                      onClick={() => setFechaVencimientoGarantia(addDaysToIsoDate(fechaVencimiento, 30))}
                      className="text-[10px] font-semibold text-blue-700 hover:underline cursor-pointer"
                    >
                      Calcular +30d
                    </button>
                  )}
                </div>
                <input
                  type="date"
                  value={fechaVencimientoGarantia}
                  onChange={(e) => setFechaVencimientoGarantia(e.target.value)}
                  className="w-full box-border border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-900 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none"
                />
              </div>
            </div>

            {tipoMonto === 'Abierto' && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-slate-700">Contrato Abierto (Ley N.º 7021/2022):</strong> recordar tope de ampliación/modificación del <strong className="text-slate-700">20%</strong> y vigencia de la Garantía de Fiel Cumplimiento por <strong className="text-slate-700">+30 días</strong> posteriores al vencimiento contractual.
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Observaciones / Estado de Adendas
            </label>
            <textarea
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Ej: Sin adendas activas. Saldo ejecutado al 65%. Iniciar nuevo llamado con 60 días de anticipación."
              className="w-full box-border border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none resize-y"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setMostrarFormulario(false);
              }}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              {guardando
                ? 'Guardando...'
                : editingId
                  ? 'Guardar Cambios'
                  : 'Registrar Contrato'}
            </button>
          </div>
        </form>
      )}

      {/* Barra de Búsqueda y Filtros por Semáforo */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por proveedor, contrato, ID PAC, modalidad, objeto de gasto o rubro..."
            className="w-full box-border pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setFiltroSemaforo('todos')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
              filtroSemaforo === 'todos'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Todos ({contratos.length})
          </button>
          <button
            type="button"
            onClick={() => setFiltroSemaforo('verde')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer flex items-center gap-1.5 ${
              filtroSemaforo === 'verde'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            &gt; 60 días
          </button>
          <button
            type="button"
            onClick={() => setFiltroSemaforo('amarillo')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer flex items-center gap-1.5 ${
              filtroSemaforo === 'amarillo'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            30–60 días
          </button>
          <button
            type="button"
            onClick={() => setFiltroSemaforo('rojo')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer flex items-center gap-1.5 ${
              filtroSemaforo === 'rojo'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Urgente (&lt; 30 días)
          </button>
        </div>
      </div>

      {/* Listado de Contratos */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-xs text-slate-500">
          Cargando contratos UOC...
        </div>
      ) : contratosFiltrados.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
          <ClipboardList className="w-10 h-10 text-slate-300 mx-auto" />
          <div>
            <p className="text-sm font-bold text-slate-800">
              {contratos.length === 0
                ? 'Aún no hay contratos cargados'
                : 'Ningún contrato coincide con los filtros aplicados'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {contratos.length === 0
                ? 'Haz clic en "Nuevo Contrato" para registrar tu primer llamado o licitación con seguimiento de vencimientos.'
                : 'Prueba limpiando la búsqueda o seleccionando otro estado del semáforo.'}
            </p>
          </div>
          {contratos.length === 0 && (
            <button
              type="button"
              onClick={handleAbrirNuevo}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Cargar Primer Contrato
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {contratosFiltrados.map((c) => {
            const sem = calcularSemaforo(c.fechaVencimiento);

            return (
              <div
                key={c.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-slate-300 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Info Principal */}
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${sem.badgeClass}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${sem.dotClass}`} />
                        {sem.etiqueta} · {sem.detalleDias}
                      </span>

                      <span className="text-[11px] text-slate-600 font-medium">
                        {[
                          c.rubro,
                          c.tipoLlamado,
                          c.modalidad || '',
                          c.codigoPac ? `PAC: ${c.codigoPac}` : '',
                          c.objetoGasto ? `Obj. ${c.objetoGasto}` : '',
                          c.tipoMonto ? `Monto ${c.tipoMonto}` : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 pt-0.5">
                      <h4 className="text-base font-bold text-slate-900 truncate">
                        {c.proveedor}
                      </h4>
                      <span className="text-xs font-mono font-medium text-slate-500">
                        {c.numeroContrato}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600 pt-0.5">
                      <span className="font-bold text-slate-900">
                        {formatGs(c.montoAdjudicado)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Inicio: <strong className="text-slate-800">{formatFechaDisplay(c.fechaInicio)}</strong>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        Vencimiento: <strong className="text-slate-800">{formatFechaDisplay(c.fechaVencimiento)}</strong>
                      </span>
                      {c.fechaVencimientoGarantia && (
                        <span className="inline-flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                          Garantía F.C.: <strong className="text-slate-800">{formatFechaDisplay(c.fechaVencimientoGarantia)}</strong>
                        </span>
                      )}
                      {c.administradorContrato && (
                        <span className="inline-flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                          Admin.: <strong className="text-slate-800">{c.administradorContrato}</strong>
                        </span>
                      )}
                    </div>

                    {c.tipoMonto === 'Abierto' && (
                      <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 mt-1.5 flex items-start gap-1.5">
                        <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-slate-700">Contrato Abierto:</strong> recordar tope legal de modificación del 20% y vigencia de Garantía de Fiel Cumplimiento +30 días post-contrato.
                        </span>
                      </div>
                    )}

                    {c.observaciones && (
                      <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 mt-1.5">
                        <span className="font-semibold text-slate-700">Obs. / Adendas:</span> {c.observaciones}
                      </p>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleClickWhatsApp(c, sem)}
                      disabled={checkingWaContractId === c.id}
                      className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                      title={
                        !isWhatsAppEnabled
                          ? 'Módulo WhatsApp Institucional no habilitado — Ver opciones de activación'
                          : waSessionConnected === false
                            ? 'Vincular WhatsApp con código QR para enviar alertas'
                            : 'Enviar alerta por WhatsApp'
                      }
                    >
                      {checkingWaContractId === c.id ? (
                        <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin" />
                      ) : (
                        <MessageCircle className="w-3.5 h-3.5 text-slate-500" />
                      )}
                      WhatsApp
                    </button>

                    <button
                      type="button"
                      onClick={() => handleEditarContrato(c)}
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                      Editar
                    </button>

                    {confirmDeleteId === c.id ? (
                      <div className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
                        <button
                          type="button"
                          onClick={() => handleEliminarContrato(c.id)}
                          className="px-2 py-1 rounded-lg bg-white hover:bg-red-50 text-red-700 border border-red-200 text-[11px] font-semibold cursor-pointer"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded-lg text-slate-600 hover:bg-slate-100 text-[11px] font-semibold cursor-pointer"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(c.id)}
                        className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-red-700 hover:border-red-200 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Exportación e Impresión de Informe Mensual */}
      {mostrarInformeMensual && (
        <div className="fixed inset-0 z-[120] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 overflow-y-auto uoc-informe-overlay">
          <style>{`
            @media print {
              @page {
                size: A4 landscape;
                margin: 12mm;
              }
              body * {
                visibility: hidden !important;
              }
              #uoc-informe-mensual-print,
              #uoc-informe-mensual-print * {
                visibility: visible !important;
              }
              #uoc-informe-mensual-print {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                height: auto !important;
                overflow: visible !important;
                padding: 0 !important;
                margin: 0 !important;
                background: #ffffff !important;
                color: #0f172a !important;
                box-shadow: none !important;
              }
              .uoc-no-print {
                display: none !important;
              }
            }
          `}</style>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Barra de Controles del Modal (No se imprime) */}
            <div className="uoc-no-print px-5 py-4 border-b border-slate-200 bg-slate-50 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Informe Mensual de Contratos Vigentes (UOC)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Selecciona el período o visualiza todos los contratos activos para imprimir o guardar en PDF.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5">
                  <button
                    type="button"
                    onClick={() => setInformeModo('mes')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      informeModo === 'mes'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Por Mes / Año
                  </button>
                  <button
                    type="button"
                    onClick={() => setInformeModo('activos')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      informeModo === 'activos'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todos los Activos
                  </button>
                </div>

                {informeModo === 'mes' && (
                  <input
                    type="month"
                    value={informeMesAnio}
                    onChange={(e) => setInformeMesAnio(e.target.value)}
                    className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white outline-none focus:border-slate-400"
                  />
                )}

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir / Guardar PDF
                </button>

                <button
                  type="button"
                  onClick={() => setMostrarInformeMensual(false)}
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 cursor-pointer"
                  title="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Área Imprimible */}
            <div className="overflow-y-auto p-5 md:p-8 bg-white">
              <div id="uoc-informe-mensual-print" className="space-y-6 text-slate-900">
                {/* Encabezado Institucional */}
                <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {perfilInstitucionalInforme.logoUrl && (
                      <img
                        src={perfilInstitucionalInforme.logoUrl}
                        alt={perfilInstitucionalInforme.institucion}
                        className="h-14 w-auto object-contain"
                      />
                    )}
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        República del Paraguay • Gestión de Contrataciones Públicas (Ley N.º 7021/2022)
                      </p>
                      <h1 className="text-base md:text-lg font-extrabold uppercase tracking-tight text-slate-900">
                        {perfilInstitucionalInforme.institucion}
                      </h1>
                      <p className="text-xs font-semibold text-slate-700">
                        {perfilInstitucionalInforme.dependencia}
                      </p>
                      {(perfilInstitucionalInforme.ruc ||
                        perfilInstitucionalInforme.direccion ||
                        perfilInstitucionalInforme.telefono) && (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {[
                            perfilInstitucionalInforme.ruc ? `RUC: ${perfilInstitucionalInforme.ruc}` : '',
                            perfilInstitucionalInforme.direccion,
                            perfilInstitucionalInforme.telefono ? `Tel.: ${perfilInstitucionalInforme.telefono}` : '',
                          ]
                            .filter(Boolean)
                            .join('  •  ')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    <p className="text-xs font-extrabold uppercase text-slate-900">
                      Informe Mensual de Contratos
                    </p>
                    <p className="text-xs font-semibold text-slate-700 mt-0.5">
                      Período:{' '}
                      {informeModo === 'activos'
                        ? 'Todos los contratos activos'
                        : formatMesAnioLabel(informeMesAnio)}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Emisión: {formatFechaDisplay(new Date().toISOString().slice(0, 10))} • {perfilInstitucionalInforme.ciudad}
                    </p>
                  </div>
                </div>

                {/* Tabla del Informe */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 border-y border-slate-300">
                        <th className="py-2 px-2.5 text-left font-bold border border-slate-300">ID PAC</th>
                        <th className="py-2 px-2.5 text-left font-bold border border-slate-300">Denominación / Rubro</th>
                        <th className="py-2 px-2.5 text-left font-bold border border-slate-300">N.º Contrato</th>
                        <th className="py-2 px-2.5 text-right font-bold border border-slate-300">Monto (Gs.)</th>
                        <th className="py-2 px-2.5 text-left font-bold border border-slate-300">Proveedor</th>
                        <th className="py-2 px-2.5 text-left font-bold border border-slate-300">Obj. Gasto</th>
                        <th className="py-2 px-2.5 text-left font-bold border border-slate-300">Modalidad</th>
                        <th className="py-2 px-2.5 text-center font-bold border border-slate-300">Vencimiento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contratosInforme.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="py-8 px-4 text-center text-slate-500 border border-slate-300"
                          >
                            No existen contratos registrados para el criterio seleccionado.
                          </td>
                        </tr>
                      ) : (
                        contratosInforme.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50">
                            <td className="py-2 px-2.5 border border-slate-300 font-mono text-[11px]">
                              {c.codigoPac || '—'}
                            </td>
                            <td className="py-2 px-2.5 border border-slate-300">
                              <span className="font-semibold text-slate-900 block">{c.rubro}</span>
                              {c.tipoMonto && (
                                <span className="text-[10px] text-slate-500">
                                  Monto {c.tipoMonto}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-2.5 border border-slate-300 font-mono text-[11px]">
                              {c.numeroContrato}
                            </td>
                            <td className="py-2 px-2.5 border border-slate-300 text-right font-bold whitespace-nowrap tabular-nums">
                              {formatGs(c.montoAdjudicado)}
                            </td>
                            <td className="py-2 px-2.5 border border-slate-300 font-medium">
                              {c.proveedor}
                            </td>
                            <td className="py-2 px-2.5 border border-slate-300 font-mono text-[11px]">
                              {c.objetoGasto || '—'}
                            </td>
                            <td className="py-2 px-2.5 border border-slate-300">
                              {c.modalidad || c.tipoLlamado || '—'}
                            </td>
                            <td className="py-2 px-2.5 border border-slate-300 text-center whitespace-nowrap">
                              {formatFechaDisplay(c.fechaVencimiento)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-extrabold border-t-2 border-slate-400">
                        <td colSpan={3} className="py-2.5 px-2.5 border border-slate-300 text-right uppercase text-[11px]">
                          Total General ({contratosInforme.length}{' '}
                          {contratosInforme.length === 1 ? 'contrato' : 'contratos'}):
                        </td>
                        <td className="py-2.5 px-2.5 border border-slate-300 text-right whitespace-nowrap tabular-nums">
                          {formatGs(totalMontoInforme)}
                        </td>
                        <td colSpan={4} className="py-2.5 px-2.5 border border-slate-300" />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Bloque de Firmas */}
                <div className="pt-10 grid grid-cols-1 sm:grid-cols-2 gap-10">
                  <div className="text-center space-y-1">
                    <div className="border-t border-slate-700 w-64 mx-auto pt-2 text-xs font-bold text-slate-900">
                      Administrador de Contrato / Área Requirente
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Firma, Sello y Aclaración
                    </p>
                  </div>

                  <div className="text-center space-y-1">
                    <div className="border-t border-slate-700 w-64 mx-auto pt-2 text-xs font-bold text-slate-900">
                      {perfilInstitucionalInforme.responsable || 'Encargado/a de la Unidad Operativa de Contrataciones (UOC)'}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {perfilInstitucionalInforme.dependencia} — {perfilInstitucionalInforme.institucion}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal de Envío Directo por WhatsApp (Habilitado y QR conectado) */}
      {isWhatsAppEnabled && waSendModalData && (
        <WhatsAppSendModal
          isOpen={true}
          onClose={() => setWaSendModalData(null)}
          workspaceId={effectiveWorkspaceId}
          defaultPhone={waSendModalData.defaultPhone}
          defaultMessage={waSendModalData.defaultMessage}
          documentTitle={waSendModalData.documentTitle}
        />
      )}

      {/* Modal de Oferta / Activación de Módulo WhatsApp (Cuando whatsappEnabled es false) */}
      {showWaUpgradeModal && (
        <div
          className="fixed inset-0 z-[130] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowWaUpgradeModal(false)}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-7 text-center shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowWaUpgradeModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-7 h-7 text-amber-400" />
            </div>

            <h3 className="text-lg font-bold text-white mb-2">
              Módulo WhatsApp IA no contratado
            </h3>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-4">
              El módulo de <strong className="text-white">WhatsApp Institucional e IA</strong> no está habilitado para tu cuenta. Actualizá tu plan o solicitá su activación para vincular tu número con código QR y enviar alertas automáticas de vencimientos y legajos.
            </p>

            <div className="bg-slate-800/70 border border-slate-700/80 rounded-2xl p-3.5 text-left space-y-2 mb-5 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Vinculación directa de tu línea institucional por código QR</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Envío directo de alertas UOC y PDFs sin salir de O.L.G.A.</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <a
                href={`https://wa.me/595983440021?text=${encodeURIComponent(
                  `Hola equipo de O.L.G.A., solicito la activación del módulo WhatsApp Institucional e IA para ${institucionNombre}.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/40 inline-flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Solicitar Activación por WhatsApp
              </a>
              <a
                href={`mailto:soporte@olgatech.com.py?subject=${encodeURIComponent(
                  `Activación Módulo WhatsApp Institucional - ${institucionNombre}`
                )}`}
                className="w-full px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors inline-flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" />
                Contactar por Correo (soporte@olgatech.com.py)
              </a>
              <button
                type="button"
                onClick={() => setShowWaUpgradeModal(false)}
                className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
