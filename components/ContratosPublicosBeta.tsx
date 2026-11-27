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
  FileSpreadsheet,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { auth, db } from '../services/auth';
import { useWorkspace } from '../hooks/useWorkspace';
import { Persona } from '../types';

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
  createdAt?: any;
  updatedAt?: any;
}

interface ContratosPublicosBetaProps {
  currentUser: User | null;
  userData?: any;
  workspaceId?: string;
  personas?: Persona[];
  onNavigateEscritos?: () => void;
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
      detalleDias: 'Fecha de vencimiento no definida',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
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
      detalleDias: `${dias} días restantes`,
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      dotClass: 'bg-emerald-500',
    };
  }

  if (dias >= 30) {
    return {
      estado: 'amarillo',
      diasRestantes: dias,
      etiqueta: 'Iniciar Adenda / Nuevo Llamado',
      detalleDias: `${dias} días restantes`,
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      dotClass: 'bg-amber-500',
    };
  }

  const detalle =
    dias < 0
      ? `Vencido hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}`
      : dias === 0
        ? 'Vence hoy'
        : `${dias} ${dias === 1 ? 'día restante' : 'días restantes'}`;

  return {
    estado: 'rojo',
    diasRestantes: dias,
    etiqueta: 'Urgente',
    detalleDias: detalle,
    badgeClass: 'bg-red-50 text-red-800 border-red-200',
    dotClass: 'bg-red-500',
  };
};

export const ContratosPublicosBeta: React.FC<ContratosPublicosBetaProps> = ({
  currentUser,
  userData,
  workspaceId: workspaceIdProp,
  personas = [],
  onNavigateEscritos,
}) => {
  const { workspaceId: hookWorkspaceId, workspaceData } = useWorkspace(currentUser, userData);
  const authUid = auth?.currentUser?.uid || currentUser?.uid || '';
  const effectiveWorkspaceId = workspaceIdProp || hookWorkspaceId || userData?.tenant_id || authUid;

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

  const [guardando, setGuardando] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Filtros
  const [busqueda, setBusqueda] = useState<string>('');
  const [filtroSemaforo, setFiltroSemaforo] = useState<'todos' | SemaforoEstado>('todos');

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
        c.observaciones.toLowerCase().includes(qNorm)
      );
    });
  }, [contratos, busqueda, filtroSemaforo]);

  const buildWhatsAppAlertHref = (c: ContratoPublicoRecord, sem: SemaforoInfo): string => {
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
      `Tipo de Llamado: ${c.tipoLlamado}`,
      `N.º Contrato / ID DNCP: ${c.numeroContrato}`,
      `Monto Adjudicado: ${formatGs(c.montoAdjudicado)}`,
      `Vencimiento: ${formatFechaDisplay(c.fechaVencimiento)}`,
      `Estado: ${estadoTexto}`,
      c.observaciones ? `Obs./Adendas: ${c.observaciones}` : '',
    ].filter(Boolean);

    return `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
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
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                Sector Público • Beta
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Control de contratos adjudicados, llamados mínimos, adendas y semáforo de vencimientos para{' '}
              <span className="font-semibold text-slate-700">{institucionNombre}</span>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {onNavigateEscritos && (
            <button
              type="button"
              onClick={() => onNavigateEscritos()}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-600" />
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
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
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
            <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
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
            placeholder="Buscar por proveedor, contrato, ID DNCP o rubro..."
            className="w-full box-border pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 bg-slate-50 focus:bg-white focus:border-slate-400 outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setFiltroSemaforo('todos')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
              filtroSemaforo === 'todos'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Todos ({contratos.length})
          </button>
          <button
            type="button"
            onClick={() => setFiltroSemaforo('verde')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
              filtroSemaforo === 'verde'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${filtroSemaforo === 'verde' ? 'bg-white' : 'bg-emerald-500'}`} />
            &gt; 60 días
          </button>
          <button
            type="button"
            onClick={() => setFiltroSemaforo('amarillo')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
              filtroSemaforo === 'amarillo'
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${filtroSemaforo === 'amarillo' ? 'bg-white' : 'bg-amber-500'}`} />
            30–60 días
          </button>
          <button
            type="button"
            onClick={() => setFiltroSemaforo('rojo')}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
              filtroSemaforo === 'rojo'
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${filtroSemaforo === 'rojo' ? 'bg-white' : 'bg-red-500'}`} />
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
            const waHref = buildWhatsAppAlertHref(c, sem);

            return (
              <div
                key={c.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-slate-300 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Info Principal */}
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${sem.badgeClass}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${sem.dotClass}`} />
                        {sem.etiqueta} • {sem.detalleDias}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-200">
                        {c.rubro}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-semibold border border-blue-200">
                        {c.tipoLlamado}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 pt-0.5">
                      <h4 className="text-base font-bold text-slate-900 truncate">
                        {c.proveedor}
                      </h4>
                      <span className="text-xs font-mono font-semibold text-slate-600">
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
                    </div>

                    {c.observaciones && (
                      <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 mt-1.5">
                        <span className="font-semibold text-slate-700">Obs. / Adendas:</span> {c.observaciones}
                      </p>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5 shadow-xs"
                      title="Abrir alerta pre-cargada en WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Enviar Alerta WhatsApp
                    </a>

                    <button
                      type="button"
                      onClick={() => handleEditarContrato(c)}
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Editar
                    </button>

                    {confirmDeleteId === c.id ? (
                      <div className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-2 py-1">
                        <button
                          type="button"
                          onClick={() => handleEliminarContrato(c.id)}
                          className="px-2 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold cursor-pointer"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded-lg text-slate-600 hover:bg-slate-200 text-[11px] font-semibold cursor-pointer"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(c.id)}
                        className="px-3 py-2 rounded-xl border border-red-200 bg-red-50/70 hover:bg-red-100 text-red-700 text-xs font-semibold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
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
    </div>
  );
};
