import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Briefcase,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit3,
  FileCheck2,
  FileSearch,
  FileText,
  Filter,
  FolderOpen,
  Gavel,
  Loader2,
  Plus,
  Scale,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  EstadoExpediente,
  Expediente,
  ExpedienteAnalisisIA,
  Persona,
  PlazoProcesal,
  RolParteExpediente,
  TipoJuicioExpediente,
  TipoPlazoProcesal,
} from '../types';
import {
  analyzeExpedientePdf,
  ExpedientePdfAnalysisPayload,
  redactarEscritoJudicialConIA,
} from '../services/gemini';

interface ExpedientesTabProps {
  expedientes: Expediente[];
  personas?: Persona[];
  userData?: any;
  workspaceId?: string;
  esPlanFull?: boolean;
  isSoftBlocked?: boolean;
  onSaveExpediente: (expediente: Expediente) => Promise<void>;
  onDeleteExpediente: (expedienteId: string) => Promise<void>;
  onOpenDocument: (
    text: string,
    docId?: string,
    tipo?: string,
    categoria?: string,
    tipoHoja?: 'blanca' | 'protocolo',
    includeHeader?: boolean
  ) => void;
}

const TIPOS_JUICIO: TipoJuicioExpediente[] = [
  'Ordinario',
  'Ejecutivo',
  'Laboral',
  'Niñez y Adolescencia',
  'Penal',
  'Sucesorio',
  'Otro',
];

const ROLES_PARTE: RolParteExpediente[] = [
  'Demandado',
  'Actor / Demandante',
  'Tercero',
];

const ESTADOS_EXPEDIENTE: EstadoExpediente[] = [
  'En trámite',
  'Pendiente de contestación',
  'Período probatorio',
  'Autos para sentencia',
  'Finalizado',
];

export const getTodayIsoAsuncion = (): string => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Asuncion',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

export const calcDaysUntil = (fechaIso: string): number | null => {
  if (!fechaIso || !/^\d{4}-\d{2}-\d{2}/.test(fechaIso)) return null;
  const cleanTarget = fechaIso.slice(0, 10);
  const todayIso = getTodayIsoAsuncion();
  const [ty, tm, td] = todayIso.split('-').map(Number);
  const [fy, fm, fd] = cleanTarget.split('-').map(Number);
  if (!ty || !tm || !td || !fy || !fm || !fd) return null;
  const todayUtc = Date.UTC(ty, tm - 1, td);
  const targetUtc = Date.UTC(fy, fm - 1, fd);
  return Math.round((targetUtc - todayUtc) / (1000 * 60 * 60 * 24));
};

const addCalendarDaysIso = (days: number): string => {
  const base = getTodayIsoAsuncion();
  const [y, m, d] = base.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + Math.max(1, days)));
  return dt.toISOString().slice(0, 10);
};

const formatDateShort = (isoDate: string): string => {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}/.test(isoDate)) return isoDate || 'Sin fecha';
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

const readFileAsBase64 = (file: File): Promise<{ base64: string; mimeType: string }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      const base64 = commaIdx !== -1 ? result.slice(commaIdx + 1) : result;
      if (!base64) {
        reject(new Error('No se pudo leer el contenido del archivo.'));
        return;
      }
      resolve({
        base64,
        mimeType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
      });
    };
    reader.onerror = () => reject(new Error('Error leyendo el archivo seleccionado.'));
    reader.readAsDataURL(file);
  });

const normalizeTipoJuicio = (raw: string): TipoJuicioExpediente => {
  const lower = String(raw || '').toLowerCase();
  if (lower.includes('ejecutivo')) return 'Ejecutivo';
  if (lower.includes('laboral')) return 'Laboral';
  if (lower.includes('niñez') || lower.includes('ninez') || lower.includes('adolesc')) return 'Niñez y Adolescencia';
  if (lower.includes('penal')) return 'Penal';
  if (lower.includes('sucesor')) return 'Sucesorio';
  if (lower.includes('ordinario')) return 'Ordinario';
  return 'Otro';
};

const normalizeRolParte = (raw: string): RolParteExpediente => {
  const lower = String(raw || '').toLowerCase();
  if (lower.includes('demandad')) return 'Demandado';
  if (lower.includes('tercer')) return 'Tercero';
  return 'Actor / Demandante';
};

export const ExpedientesTab: React.FC<ExpedientesTabProps> = ({
  expedientes,
  personas = [],
  userData,
  workspaceId = '',
  esPlanFull = false,
  isSoftBlocked = false,
  onSaveExpediente,
  onDeleteExpediente,
  onOpenDocument,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEstado, setFilterEstado] = useState<string>('TODOS');
  const [filterTipo, setFilterTipo] = useState<string>('TODOS');
  const [selectedExpId, setSelectedExpId] = useState<string | null>(null);
  const [showUpcomingAll, setShowUpcomingAll] = useState(false);

  // Modal crear/editar expediente
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpediente, setEditingExpediente] = useState<Expediente | null>(null);
  const [caratula, setCaratula] = useState('');
  const [nroExpediente, setNroExpediente] = useState('');
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [juzgado, setJuzgado] = useState('');
  const [tipoJuicio, setTipoJuicio] = useState<TipoJuicioExpediente>('Ordinario');
  const [rolParte, setRolParte] = useState<RolParteExpediente>('Demandado');
  const [estado, setEstado] = useState<EstadoExpediente>('En trámite');
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [notas, setNotas] = useState('');
  const [draftPlazos, setDraftPlazos] = useState<PlazoProcesal[]>([]);
  const [draftAnalisisIA, setDraftAnalisisIA] = useState<ExpedienteAnalisisIA | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Análisis PDF con IA (dentro del modal o directo sobre un expediente abierto)
  const [analyzingTargetId, setAnalyzingTargetId] = useState<string | null>(null); // 'modal' | expediente.id
  const [pendingAnalysisPreview, setPendingAnalysisPreview] = useState<{
    target: 'modal' | string;
    fileName: string;
    result: ExpedientePdfAnalysisPayload;
  } | null>(null);

  // Redacción IA en progreso
  const [draftingKey, setDraftingKey] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Confirmación de borrado en UI (sin window.confirm)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Nuevo plazo rápido dentro de un expediente abierto
  const [addingPlazoForExpId, setAddingPlazoForExpId] = useState<string | null>(null);
  const [newPlazoTitulo, setNewPlazoTitulo] = useState('');
  const [newPlazoFecha, setNewPlazoFecha] = useState(() => addCalendarDaysIso(5));
  const [newPlazoDias, setNewPlazoDias] = useState('5');
  const [newPlazoTipo, setNewPlazoTipo] = useState<TipoPlazoProcesal>('plazo_legal');

  // Toggle análisis IA expandido por expediente
  const [expandedAnalisisIds, setExpandedAnalisisIds] = useState<Record<string, boolean>>({});

  const modalPdfInputRef = useRef<HTMLInputElement>(null);
  const cardPdfInputRef = useRef<HTMLInputElement>(null);
  const [cardPdfTargetExp, setCardPdfTargetExp] = useState<Expediente | null>(null);

  const estudioNombre =
    String(
      userData?.razonSocial ||
        userData?.nombreInstitucion ||
        userData?.nombre ||
        ''
    ).trim() || 'Estudio Jurídico';

  const cardSurfaceCls = esPlanFull
    ? 'bg-[#F4F4F0]/90 dark:bg-[#12141C]/90 border-amber-200/50 dark:border-amber-500/30'
    : 'bg-white dark:bg-[#121824]/95 border-slate-200/80 dark:border-slate-800';

  const showToastSuccess = (msg: string) => {
    setErrorBanner(null);
    setSuccessBanner(msg);
    window.setTimeout(() => {
      setSuccessBanner((prev) => (prev === msg ? null : prev));
    }, 5000);
  };

  // Plazos pendientes ordenados por urgencia
  const upcomingDeadlines = useMemo(() => {
    const items: Array<{
      expediente: Expediente;
      plazo: PlazoProcesal;
      diasRestantes: number | null;
    }> = [];

    expedientes.forEach((exp) => {
      if (exp.estado === 'Finalizado') return;
      (exp.plazos || []).forEach((plazo) => {
        if (plazo.completado) return;
        const dias = calcDaysUntil(plazo.fechaVencimiento);
        items.push({ expediente: exp, plazo, diasRestantes: dias });
      });
    });

    items.sort((a, b) => {
      const da = a.diasRestantes ?? 9999;
      const db = b.diasRestantes ?? 9999;
      return da - db;
    });

    return items;
  }, [expedientes]);

  const urgentCount = useMemo(
    () => upcomingDeadlines.filter((i) => i.diasRestantes !== null && i.diasRestantes <= 3).length,
    [upcomingDeadlines]
  );
  const warningCount = useMemo(
    () =>
      upcomingDeadlines.filter(
        (i) => i.diasRestantes !== null && i.diasRestantes > 3 && i.diasRestantes <= 7
      ).length,
    [upcomingDeadlines]
  );
  const activeCasesCount = useMemo(
    () => expedientes.filter((e) => e.estado !== 'Finalizado').length,
    [expedientes]
  );
  const completedStepsCount = useMemo(
    () =>
      expedientes.reduce(
        (acc, exp) => acc + (exp.plazos || []).filter((p) => p.completado).length,
        0
      ),
    [expedientes]
  );

  const filteredExpedientes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...expedientes]
      .filter((exp) => {
        if (filterEstado !== 'TODOS' && exp.estado !== filterEstado) return false;
        if (filterTipo !== 'TODOS' && exp.tipoJuicio !== filterTipo) return false;
        if (!q) return true;
        return (
          exp.caratula.toLowerCase().includes(q) ||
          exp.nroExpediente.toLowerCase().includes(q) ||
          exp.juzgado.toLowerCase().includes(q) ||
          (exp.clienteNombre || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  }, [expedientes, searchQuery, filterEstado, filterTipo]);

  const openCreateModal = () => {
    setErrorBanner(null);
    setEditingExpediente(null);
    setCaratula('');
    setNroExpediente('');
    setAnio(String(new Date().getFullYear()));
    setJuzgado('');
    setTipoJuicio('Ordinario');
    setRolParte('Demandado');
    setEstado('En trámite');
    setClienteNombre('');
    setClienteId('');
    setNotas('');
    setDraftPlazos([]);
    setDraftAnalisisIA(null);
    setPendingAnalysisPreview(null);
    setModalOpen(true);
  };

  const openEditModal = (exp: Expediente) => {
    setErrorBanner(null);
    setEditingExpediente(exp);
    setCaratula(exp.caratula);
    setNroExpediente(exp.nroExpediente);
    setAnio(exp.anio || String(new Date().getFullYear()));
    setJuzgado(exp.juzgado);
    setTipoJuicio(exp.tipoJuicio);
    setRolParte(exp.rolParte);
    setEstado(exp.estado);
    setClienteNombre(exp.clienteNombre || '');
    setClienteId(exp.clienteId || '');
    setNotas(exp.notas || '');
    setDraftPlazos(exp.plazos ? [...exp.plazos] : []);
    setDraftAnalisisIA(exp.ultimoAnalisisIA || null);
    setPendingAnalysisPreview(null);
    setModalOpen(true);
  };

  const handleAnalyzePdfFile = async (file: File, target: 'modal' | Expediente) => {
    setErrorBanner(null);
    const targetId = target === 'modal' ? 'modal' : target.id;
    setAnalyzingTargetId(targetId);
    try {
      const { base64, mimeType } = await readFileAsBase64(file);
      const result = await analyzeExpedientePdf(base64, mimeType, {
        fileName: file.name,
        rolParteHint: target === 'modal' ? rolParte : target.rolParte,
      });
      setPendingAnalysisPreview({
        target: targetId,
        fileName: file.name,
        result,
      });
    } catch (err: any) {
      setErrorBanner(err?.message || 'No se pudo analizar el documento PDF.');
    } finally {
      setAnalyzingTargetId(null);
    }
  };

  const buildPlazosFromAnalysis = (result: ExpedientePdfAnalysisPayload): PlazoProcesal[] => {
    const generated: PlazoProcesal[] = [];
    const ts = Date.now();
    if (result.plazoPrincipal?.titulo) {
      const days = Math.max(1, Number(result.plazoPrincipal.diasPlazo) || 5);
      generated.push({
        id: `plazo-${ts}-main`,
        titulo: result.plazoPrincipal.titulo,
        diasPlazo: days,
        fechaVencimiento:
          result.plazoPrincipal.fechaVencimiento && /^\d{4}-\d{2}-\d{2}$/.test(result.plazoPrincipal.fechaVencimiento)
            ? result.plazoPrincipal.fechaVencimiento
            : addCalendarDaysIso(days),
        completado: false,
        tipo: 'plazo_legal',
      });
    }
    if (Array.isArray(result.impulsosSugeridos)) {
      result.impulsosSugeridos.forEach((imp, idx) => {
        if (!imp?.titulo) return;
        const days = Math.max(1, Number(imp.diasPlazo) || (idx + 1) * 10);
        generated.push({
          id: `impulso-${ts}-${idx}`,
          titulo: imp.titulo,
          diasPlazo: days,
          fechaVencimiento:
            imp.fechaVencimiento && /^\d{4}-\d{2}-\d{2}$/.test(imp.fechaVencimiento)
              ? imp.fechaVencimiento
              : addCalendarDaysIso(days),
          completado: false,
          tipo: 'impulso',
        });
      });
    }
    return generated;
  };

  const handleConfirmPendingAnalysis = async () => {
    if (!pendingAnalysisPreview) return;
    const { target, fileName, result } = pendingAnalysisPreview;
    const suggestedPlazos = buildPlazosFromAnalysis(result);
    const analisisObj: ExpedienteAnalisisIA = {
      caratula: result.caratula,
      nroExpediente: result.nroExpediente,
      anio: result.anio,
      juzgado: result.juzgado,
      tipoJuicio: normalizeTipoJuicio(result.tipoJuicio),
      rolParteSugerido: normalizeRolParte(result.rolParteSugerido),
      resumenHechos: result.resumenHechos,
      fundamentoCPC: result.fundamentoCPC,
      plazoPrincipal: result.plazoPrincipal,
      impulsosSugeridos: result.impulsosSugeridos,
      analizadoAt: new Date().toISOString(),
      archivoNombre: fileName,
    };

    if (target === 'modal') {
      if (result.caratula && !caratula.trim()) setCaratula(result.caratula);
      if (result.caratula && caratula.trim()) setCaratula(result.caratula);
      if (result.nroExpediente) setNroExpediente(result.nroExpediente);
      if (result.anio) setAnio(result.anio);
      if (result.juzgado) setJuzgado(result.juzgado);
      if (result.tipoJuicio) setTipoJuicio(normalizeTipoJuicio(result.tipoJuicio));
      if (result.rolParteSugerido) setRolParte(normalizeRolParte(result.rolParteSugerido));
      if (normalizeRolParte(result.rolParteSugerido) === 'Demandado') {
        setEstado('Pendiente de contestación');
      }
      setDraftPlazos((prev) => [...prev, ...suggestedPlazos]);
      setDraftAnalisisIA(analisisObj);
      setPendingAnalysisPreview(null);
      showToastSuccess('Análisis IA aplicado al formulario. Revisa los datos y guarda el expediente.');
      return;
    }

    const exp = expedientes.find((e) => e.id === target);
    if (!exp) {
      setPendingAnalysisPreview(null);
      return;
    }

    try {
      const updatedExp: Expediente = {
        ...exp,
        caratula: exp.caratula || result.caratula || exp.caratula,
        nroExpediente: exp.nroExpediente || result.nroExpediente || '',
        anio: exp.anio || result.anio || String(new Date().getFullYear()),
        juzgado: exp.juzgado || result.juzgado || '',
        tipoJuicio: exp.tipoJuicio || normalizeTipoJuicio(result.tipoJuicio),
        plazos: [...(exp.plazos || []), ...suggestedPlazos],
        ultimoAnalisisIA: analisisObj,
        updatedAt: new Date().toISOString(),
      };
      await onSaveExpediente(updatedExp);
      setPendingAnalysisPreview(null);
      setExpandedAnalisisIds((prev) => ({ ...prev, [exp.id]: true }));
      showToastSuccess(`Se cargaron ${suggestedPlazos.length} plazos/impulsos desde "${fileName}".`);
    } catch (err: any) {
      setErrorBanner(err?.message || 'No se pudo guardar el análisis en el expediente.');
    }
  };

  const handleSubmitExpediente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSoftBlocked) {
      setErrorBanner('Tu cuenta está en modo solo lectura. Renueva tu plan para crear o editar expedientes.');
      return;
    }
    if (!caratula.trim()) {
      setErrorBanner('Ingresa la carátula del expediente.');
      return;
    }

    setIsSaving(true);
    setErrorBanner(null);
    try {
      const nowIso = new Date().toISOString();
      const expToSave: Expediente = {
        id: editingExpediente?.id || `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId: editingExpediente?.userId || workspaceId,
        ownedByWorkspace: editingExpediente?.ownedByWorkspace || workspaceId,
        caratula: caratula.trim(),
        nroExpediente: nroExpediente.trim(),
        anio: anio.trim() || String(new Date().getFullYear()),
        juzgado: juzgado.trim(),
        tipoJuicio,
        rolParte,
        estado,
        plazos: draftPlazos,
        ultimoAnalisisIA: draftAnalisisIA,
        notas: notas.trim(),
        clienteNombre: clienteNombre.trim(),
        clienteId: clienteId.trim(),
        createdAt: editingExpediente?.createdAt || nowIso,
        updatedAt: nowIso,
      };
      await onSaveExpediente(expToSave);
      setModalOpen(false);
      setSelectedExpId(expToSave.id);
      showToastSuccess(editingExpediente ? 'Expediente actualizado correctamente.' : 'Expediente registrado correctamente.');
    } catch (err: any) {
      setErrorBanner(err?.message || 'Ocurrió un error al guardar el expediente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePlazoCompletado = async (exp: Expediente, plazoId: string) => {
    if (isSoftBlocked) {
      setErrorBanner('Plan expirado: modo solo lectura activado.');
      return;
    }
    try {
      const updatedPlazos = (exp.plazos || []).map((p) =>
        p.id === plazoId ? { ...p, completado: !p.completado } : p
      );
      await onSaveExpediente({
        ...exp,
        plazos: updatedPlazos,
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      setErrorBanner(err?.message || 'No se pudo actualizar el estado del plazo.');
    }
  };

  const handleAddPlazoInline = async (exp: Expediente) => {
    if (isSoftBlocked) {
      setErrorBanner('Plan expirado: modo solo lectura activado.');
      return;
    }
    if (!newPlazoTitulo.trim() || !newPlazoFecha) {
      setErrorBanner('Completa el título y la fecha de vencimiento del plazo.');
      return;
    }
    try {
      const nuevo: PlazoProcesal = {
        id: `plazo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        titulo: newPlazoTitulo.trim(),
        fechaVencimiento: newPlazoFecha,
        diasPlazo: Math.max(0, Number(newPlazoDias) || 0),
        completado: false,
        tipo: newPlazoTipo,
      };
      await onSaveExpediente({
        ...exp,
        plazos: [...(exp.plazos || []), nuevo],
        updatedAt: new Date().toISOString(),
      });
      setAddingPlazoForExpId(null);
      setNewPlazoTitulo('');
      setNewPlazoDias('5');
      setNewPlazoFecha(addCalendarDaysIso(5));
      showToastSuccess('Plazo procesal agregado al cronograma.');
    } catch (err: any) {
      setErrorBanner(err?.message || 'No se pudo agregar el plazo procesal.');
    }
  };

  const handleDeletePlazoInline = async (exp: Expediente, plazoId: string) => {
    if (isSoftBlocked) return;
    try {
      const updatedPlazos = (exp.plazos || []).filter((p) => p.id !== plazoId);
      await onSaveExpediente({
        ...exp,
        plazos: updatedPlazos,
        updatedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      setErrorBanner(err?.message || 'No se pudo eliminar el plazo.');
    }
  };

  const handleRedactarConIA = async (
    exp: Expediente,
    modo: 'contestacion' | 'impulso',
    plazoObjetivo?: PlazoProcesal
  ) => {
    const key = `${exp.id}-${modo}-${plazoObjetivo?.id || 'general'}`;
    setDraftingKey(key);
    setErrorBanner(null);
    try {
      const draftText = await redactarEscritoJudicialConIA({
        expediente: exp,
        modo,
        plazoObjetivo: plazoObjetivo
          ? { titulo: plazoObjetivo.titulo, fechaVencimiento: plazoObjetivo.fechaVencimiento }
          : undefined,
        estudio: {
          razonSocial: userData?.razonSocial || userData?.nombreInstitucion || estudioNombre,
          nombre: userData?.nombre || estudioNombre,
          matricula: userData?.matricula || userData?.registroNotarial || '',
          ciudad: userData?.ciudad || userData?.localidad || 'Asunción',
        },
      });
      const tituloModal =
        modo === 'contestacion'
          ? `Contestación de Demanda - ${exp.caratula.slice(0, 48)}`
          : `Impulso: ${(plazoObjetivo?.titulo || exp.caratula).slice(0, 48)}`;
      onOpenDocument(draftText, undefined, tituloModal, 'Judicial', 'blanca', true);
    } catch (err: any) {
      setErrorBanner(err?.message || 'No se pudo generar el escrito judicial con IA.');
    } finally {
      setDraftingKey(null);
    }
  };

  const handleConfirmDeleteExpediente = async () => {
    if (!confirmDeleteId) return;
    setIsDeleting(true);
    try {
      await onDeleteExpediente(confirmDeleteId);
      if (selectedExpId === confirmDeleteId) setSelectedExpId(null);
      setConfirmDeleteId(null);
      showToastSuccess('Expediente eliminado.');
    } catch (err: any) {
      setErrorBanner(err?.message || 'No se pudo eliminar el expediente.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getDeadlineBadgeStyle = (dias: number | null, completado: boolean) => {
    if (completado) {
      return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700/60';
    }
    if (dias !== null && dias <= 3) {
      return 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700/70';
    }
    if (dias !== null && dias <= 7) {
      return 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/60';
    }
    return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
  };

  const getDaysLabel = (dias: number | null, completado: boolean) => {
    if (completado) return 'Completado';
    if (dias === null) return 'Sin fecha';
    if (dias < 0) return `Vencido hace ${Math.abs(dias)} d`;
    if (dias === 0) return 'Vence HOY';
    if (dias === 1) return 'Vence MAÑANA';
    return `En ${dias} días`;
  };

  const visibleUpcoming = showUpcomingAll ? upcomingDeadlines : upcomingDeadlines.slice(0, 5);

  return (
    <div className="w-full box-border flex flex-col gap-5 animate-fade-in pb-12">
      {/* Input oculto para analizar PDF directo sobre un expediente */}
      <input
        ref={cardPdfInputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file && cardPdfTargetExp) {
            void handleAnalyzePdfFile(file, cardPdfTargetExp);
          }
        }}
      />

      {/* Cabecera principal */}
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-5 md:p-7 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 text-amber-400 flex items-center justify-center border border-slate-700 shadow-xs shrink-0">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-white text-xl md:text-2xl font-black font-serif leading-tight">
                Gestión de Expedientes y Plazos Procesales
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                CPC Paraguay + IA
              </span>
            </div>
            <p className="text-slate-400 text-xs md:text-sm mt-1.5 max-w-2xl">
              Control de causas judiciales, análisis de demandas/cédulas PDF, vencimientos e impulsos procesales para{' '}
              <span className="text-slate-200 font-semibold">{estudioNombre}</span>.
            </p>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <button
            type="button"
            disabled={isSoftBlocked}
            onClick={() => {
              openCreateModal();
              window.setTimeout(() => modalPdfInputRef.current?.click(), 120);
            }}
            className="flex-1 sm:flex-none px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>Analizar Demanda PDF</span>
          </button>

          <button
            type="button"
            disabled={isSoftBlocked}
            onClick={openCreateModal}
            className="flex-1 sm:flex-none px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Expediente</span>
          </button>
        </div>
      </div>

      {/* Banners de estado */}
      {errorBanner && (
        <div className="rounded-2xl border border-red-300 dark:border-red-700/60 bg-red-50 dark:bg-red-950/50 p-4 flex items-center justify-between gap-3 text-red-800 dark:text-red-200 text-xs font-semibold">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successBanner && (
        <div className="rounded-2xl border border-emerald-300 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-950/40 p-4 flex items-center justify-between gap-3 text-emerald-800 dark:text-emerald-200 text-xs font-semibold">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="p-1 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Previsualización de Análisis PDF cuando se disparó desde una tarjeta */}
      {pendingAnalysisPreview && pendingAnalysisPreview.target !== 'modal' && (
        <div className="rounded-3xl border-2 border-indigo-400 dark:border-indigo-500/60 bg-indigo-50/95 dark:bg-indigo-950/40 p-5 space-y-4 shadow-lg">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-indigo-950 dark:text-indigo-100">
                  Análisis IA listo: {pendingAnalysisPreview.fileName}
                </h3>
                <p className="text-xs text-indigo-800 dark:text-indigo-300 mt-0.5">
                  Confirma para actualizar el expediente y cargar los plazos e impulsos sugeridos.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPendingAnalysisPreview(null)}
              className="p-1.5 rounded-lg text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200/50 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="bg-white/80 dark:bg-slate-900/70 rounded-xl p-3 border border-indigo-200 dark:border-indigo-800/60">
              <p className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px]">Resumen Procesal</p>
              <p className="text-slate-800 dark:text-slate-200 mt-1 leading-relaxed">
                {pendingAnalysisPreview.result.resumenHechos}
              </p>
              {pendingAnalysisPreview.result.fundamentoCPC && (
                <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-2 font-semibold">
                  Base CPC: {pendingAnalysisPreview.result.fundamentoCPC}
                </p>
              )}
            </div>
            <div className="bg-white/80 dark:bg-slate-900/70 rounded-xl p-3 border border-indigo-200 dark:border-indigo-800/60 space-y-2">
              <p className="font-bold text-slate-500 dark:text-slate-400 uppercase text-[10px]">Plazos e Impulsos Detectados</p>
              {pendingAnalysisPreview.result.plazoPrincipal && (
                <div className="flex items-center justify-between gap-2 text-xs bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-lg px-2.5 py-1.5">
                  <span className="font-bold text-red-800 dark:text-red-200">
                    {pendingAnalysisPreview.result.plazoPrincipal.titulo}
                  </span>
                  <span className="font-mono text-[11px] text-red-700 dark:text-red-300 shrink-0">
                    {formatDateShort(pendingAnalysisPreview.result.plazoPrincipal.fechaVencimiento)}
                  </span>
                </div>
              )}
              {(pendingAnalysisPreview.result.impulsosSugeridos || []).map((imp, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5"
                >
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{imp.titulo}</span>
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                    {formatDateShort(imp.fechaVencimiento)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingAnalysisPreview(null)}
              className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmPendingAnalysis()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Check className="w-4 h-4" />
              <span>Confirmar y Cargar al Expediente</span>
            </button>
          </div>
        </div>
      )}

      {/* KPIs de Expedientes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className={`rounded-2xl p-4 md:p-5 border transition-all ${cardSurfaceCls}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Causas Activas
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{activeCasesCount}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {expedientes.length} totales registradas
          </p>
        </div>

        <div className={`rounded-2xl p-4 md:p-5 border transition-all ${cardSurfaceCls}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Críticos (≤ 3 días)
            </span>
            <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className={`text-2xl font-black ${urgentCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
            {urgentCount}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Vencidos o urgentes
          </p>
        </div>

        <div className={`rounded-2xl p-4 md:p-5 border transition-all ${cardSurfaceCls}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Próximos (4–7 días)
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <CalendarClock className="w-4 h-4" />
            </div>
          </div>
          <p className={`text-2xl font-black ${warningCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
            {warningCount}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Seguimiento cercano
          </p>
        </div>

        <div className={`rounded-2xl p-4 md:p-5 border transition-all ${cardSurfaceCls}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Actuaciones Cumplidas
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Gavel className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{completedStepsCount}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Plazos e impulsos cerrados
          </p>
        </div>
      </div>

      {/* Bloque superior: Plazos Próximos a Vencer */}
      {upcomingDeadlines.length > 0 && (
        <div className={`rounded-3xl border p-4 md:p-5 shadow-sm ${cardSurfaceCls}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                urgentCount > 0
                  ? 'bg-red-100 dark:bg-red-950/70 text-red-600 dark:text-red-400'
                  : 'bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400'
              }`}>
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Plazos Próximos a Vencer ({upcomingDeadlines.length})
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Marca un plazo como cumplido o genera el escrito de impulso con IA en un clic.
                </p>
              </div>
            </div>

            {upcomingDeadlines.length > 5 && (
              <button
                type="button"
                onClick={() => setShowUpcomingAll((prev) => !prev)}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                {showUpcomingAll ? 'Ver menos' : `Ver los ${upcomingDeadlines.length}`}
              </button>
            )}
          </div>

          <div className="space-y-2">
            {visibleUpcoming.map(({ expediente, plazo, diasRestantes }) => {
              const isCritical = diasRestantes !== null && diasRestantes <= 3;
              const isWarning = diasRestantes !== null && diasRestantes > 3 && diasRestantes <= 7;
              const rowDraftKey = `${expediente.id}-impulso-${plazo.id}`;
              return (
                <div
                  key={`${expediente.id}-${plazo.id}`}
                  className={`rounded-2xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    isCritical
                      ? 'bg-red-50/70 dark:bg-red-950/30 border-red-200 dark:border-red-800/60'
                      : isWarning
                        ? 'bg-amber-50/70 dark:bg-amber-950/25 border-amber-200 dark:border-amber-800/50'
                        : 'bg-slate-50/80 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => void handleTogglePlazoCompletado(expediente, plazo.id)}
                      className="mt-0.5 w-5 h-5 rounded-md border-2 border-slate-400 dark:border-slate-500 hover:border-emerald-500 flex items-center justify-center shrink-0 transition-colors cursor-pointer bg-white dark:bg-slate-900"
                      title="Marcar plazo como cumplido"
                    >
                      <span className="sr-only">Completar</span>
                    </button>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${getDeadlineBadgeStyle(diasRestantes, plazo.completado)}`}>
                          {getDaysLabel(diasRestantes, plazo.completado)}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {formatDateShort(plazo.fechaVencimiento)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {plazo.tipo === 'impulso' ? 'Impulso' : 'Plazo Legal'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white mt-1 truncate">
                        {plazo.titulo}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSelectedExpId(expediente.id)}
                        className="text-[11px] text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 text-left truncate max-w-full cursor-pointer"
                      >
                        {expediente.caratula} {expediente.nroExpediente ? `• Expte. ${expediente.nroExpediente}/${expediente.anio}` : ''}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      disabled={draftingKey === rowDraftKey}
                      onClick={() => void handleRedactarConIA(expediente, 'impulso', plazo)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {draftingKey === rowDraftKey ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      )}
                      <span>Escrito IA</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Barra de búsqueda y filtros */}
      <div className={`rounded-2xl border p-3.5 flex flex-col md:flex-row items-stretch md:items-center gap-3 ${cardSurfaceCls}`}>
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por carátula, N° de expediente, juzgado o cliente..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-xs md:text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 px-1">
            <Filter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline font-semibold">Filtros:</span>
          </div>
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
          >
            <option value="TODOS">Todos los estados</option>
            {ESTADOS_EXPEDIENTE.map((est) => (
              <option key={est} value={est}>{est}</option>
            ))}
          </select>
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
          >
            <option value="TODOS">Todos los fueros</option>
            {TIPOS_JUICIO.map((tj) => (
              <option key={tj} value={tj}>{tj}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de Expedientes */}
      {filteredExpedientes.length === 0 ? (
        <div className={`rounded-[2rem] border p-8 md:p-14 text-center flex flex-col items-center justify-center gap-4 shadow-sm ${cardSurfaceCls}`}>
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300">
            <FolderOpen className="w-8 h-8" />
          </div>
          <div className="max-w-md space-y-1.5">
            <h3 className="text-lg font-black font-serif text-slate-900 dark:text-white">
              {expedientes.length === 0 ? 'Tu carpeta de expedientes está lista' : 'Sin coincidencias para tu búsqueda'}
            </h3>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {expedientes.length === 0
                ? 'Registra tu primera causa manualmente o sube una Demanda / Cédula en PDF para que O.L.G.A. extraiga la carátula, calcule plazos según el CPC de Paraguay y te ayude a redactar escritos.'
                : 'Prueba limpiando los filtros o cambiando el texto de búsqueda.'}
            </p>
          </div>
          {expedientes.length === 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2.5 mt-1">
              <button
                type="button"
                disabled={isSoftBlocked}
                onClick={() => {
                  openCreateModal();
                  window.setTimeout(() => modalPdfInputRef.current?.click(), 120);
                }}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 transition-colors cursor-pointer shadow-md disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>Subir Demanda PDF con IA</span>
              </button>
              <button
                type="button"
                disabled={isSoftBlocked}
                onClick={openCreateModal}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 transition-colors cursor-pointer shadow-md disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Cargar Manualmente</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredExpedientes.map((exp) => {
            const isOpen = selectedExpId === exp.id;
            const pendingPlazos = (exp.plazos || [])
              .filter((p) => !p.completado)
              .sort((a, b) => (calcDaysUntil(a.fechaVencimiento) ?? 9999) - (calcDaysUntil(b.fechaVencimiento) ?? 9999));
            const nextPlazo = pendingPlazos[0] || null;
            const nextDays = nextPlazo ? calcDaysUntil(nextPlazo.fechaVencimiento) : null;
            const isAnalyzingThis = analyzingTargetId === exp.id;
            const contestacionKey = `${exp.id}-contestacion-general`;
            const impulsoGeneralKey = `${exp.id}-impulso-general`;
            const analisisOpen = Boolean(expandedAnalisisIds[exp.id]);

            return (
              <div
                key={exp.id}
                className={`rounded-3xl border transition-all shadow-sm overflow-hidden ${cardSurfaceCls} ${
                  isOpen ? 'ring-2 ring-blue-500/40' : ''
                }`}
              >
                {/* Cabecera de la tarjeta */}
                <div
                  onClick={() => setSelectedExpId(isOpen ? null : exp.id)}
                  className="p-4 md:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-900 dark:bg-slate-800 text-white border border-slate-700">
                        {exp.tipoJuicio}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        exp.rolParte === 'Demandado'
                          ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
                          : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60'
                      }`}>
                        {exp.rolParte}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        exp.estado === 'Finalizado'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
                          : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}>
                        {exp.estado}
                      </span>
                      {exp.nroExpediente && (
                        <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
                          Expte. N° {exp.nroExpediente}/{exp.anio}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base md:text-lg font-black font-serif text-slate-900 dark:text-white leading-snug">
                      {exp.caratula}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <span>{exp.juzgado || 'Juzgado sin especificar'}</span>
                      {exp.clienteNombre && (
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Cliente: {exp.clienteNombre}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2.5 shrink-0">
                    {nextPlazo ? (
                      <div className={`px-3 py-1.5 rounded-xl border text-left ${getDeadlineBadgeStyle(nextDays, false)}`}>
                        <p className="text-[10px] font-black uppercase tracking-wider">
                          {getDaysLabel(nextDays, false)}
                        </p>
                        <p className="text-[11px] font-semibold truncate max-w-[200px]">
                          {nextPlazo.titulo} ({formatDateShort(nextPlazo.fechaVencimiento)})
                        </p>
                      </div>
                    ) : (
                      <span className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Sin plazos pendientes
                      </span>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(exp);
                        }}
                        className="p-2 rounded-xl text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Editar expediente"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(exp.id);
                        }}
                        className="p-2 rounded-xl text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                        title="Eliminar expediente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <span className="p-2 text-slate-400">
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cuerpo expandido del Expediente */}
                {isOpen && (
                  <div className="border-t border-slate-200 dark:border-slate-800 p-4 md:p-6 space-y-5 bg-slate-50/50 dark:bg-slate-950/40">
                    {/* Botonera de Acciones IA */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        disabled={isSoftBlocked || isAnalyzingThis}
                        onClick={() => {
                          setCardPdfTargetExp(exp);
                          cardPdfInputRef.current?.click();
                        }}
                        className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        {isAnalyzingThis ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <FileSearch className="w-4 h-4" />
                        )}
                        <span>{isAnalyzingThis ? 'Analizando PDF...' : '✨ Analizar Demanda PDF'}</span>
                      </button>

                      <button
                        type="button"
                        disabled={draftingKey === contestacionKey}
                        onClick={() => void handleRedactarConIA(exp, 'contestacion')}
                        className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-slate-950 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        {draftingKey === contestacionKey ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        <span>
                          {draftingKey === contestacionKey
                            ? 'Redactando...'
                            : '✨ Redactar Contestación de Demanda'}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={draftingKey === impulsoGeneralKey}
                        onClick={() => void handleRedactarConIA(exp, 'impulso', nextPlazo || undefined)}
                        className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {draftingKey === impulsoGeneralKey ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <FileText className="w-4 h-4 text-blue-500" />
                        )}
                        <span>
                          {draftingKey === impulsoGeneralKey
                            ? 'Redactando...'
                            : '✨ Redactar Escrito de Impulso'}
                        </span>
                      </button>
                    </div>

                    {/* Último Análisis IA */}
                    {exp.ultimoAnalisisIA && (
                      <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/70 dark:bg-indigo-950/30 p-4">
                        <div
                          onClick={() =>
                            setExpandedAnalisisIds((prev) => ({ ...prev, [exp.id]: !prev[exp.id] }))
                          }
                          className="flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span className="text-xs font-black uppercase tracking-wider text-indigo-950 dark:text-indigo-200">
                              Análisis Jurídico IA Guardado
                            </span>
                            {exp.ultimoAnalisisIA.archivoNombre && (
                              <span className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
                                ({exp.ultimoAnalisisIA.archivoNombre})
                              </span>
                            )}
                          </div>
                          {analisisOpen ? (
                            <ChevronUp className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-indigo-600 dark:text-indigo-300" />
                          )}
                        </div>
                        {analisisOpen && (
                          <div className="mt-3 pt-3 border-t border-indigo-200/70 dark:border-indigo-800/50 space-y-2 text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                            <p>{exp.ultimoAnalisisIA.resumenHechos}</p>
                            {exp.ultimoAnalisisIA.fundamentoCPC && (
                              <p className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300">
                                Fundamento CPC Paraguay: {exp.ultimoAnalisisIA.fundamentoCPC}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cronograma de Plazos e Impulsos */}
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <CalendarClock className="w-4 h-4 text-blue-500" />
                          <span>Cronograma de Plazos Procesales e Impulsos ({(exp.plazos || []).length})</span>
                        </h4>
                        <button
                          type="button"
                          disabled={isSoftBlocked}
                          onClick={() => {
                            setAddingPlazoForExpId(addingPlazoForExpId === exp.id ? null : exp.id);
                            setNewPlazoTitulo('');
                            setNewPlazoFecha(addCalendarDaysIso(5));
                            setNewPlazoDias('5');
                            setNewPlazoTipo('plazo_legal');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Agregar Plazo / Impulso</span>
                        </button>
                      </div>

                      {addingPlazoForExpId === exp.id && (
                        <div className="rounded-2xl border border-blue-200 dark:border-blue-800/60 bg-white dark:bg-slate-900 p-4 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                          <div className="sm:col-span-5">
                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                              Actuación / Título del Plazo
                            </label>
                            <input
                              type="text"
                              value={newPlazoTitulo}
                              onChange={(e) => setNewPlazoTitulo(e.target.value)}
                              placeholder="Ej: Contestar demanda / Ofrecer pruebas"
                              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                              Fecha Vencimiento
                            </label>
                            <input
                              type="date"
                              value={newPlazoFecha}
                              onChange={(e) => setNewPlazoFecha(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                              Tipo
                            </label>
                            <select
                              value={newPlazoTipo}
                              onChange={(e) => setNewPlazoTipo(e.target.value as TipoPlazoProcesal)}
                              className="w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white outline-none"
                            >
                              <option value="plazo_legal">Plazo Legal</option>
                              <option value="impulso">Impulso</option>
                            </select>
                          </div>
                          <div className="sm:col-span-2 flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleAddPlazoInline(exp)}
                              className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={() => setAddingPlazoForExpId(null)}
                              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}

                      {(exp.plazos || []).length === 0 ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic py-2">
                          Aún no hay plazos ni impulsos cargados en este expediente.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {[...(exp.plazos || [])]
                            .sort((a, b) => {
                              if (a.completado !== b.completado) return a.completado ? 1 : -1;
                              return String(a.fechaVencimiento).localeCompare(String(b.fechaVencimiento));
                            })
                            .map((plazo) => {
                              const dias = calcDaysUntil(plazo.fechaVencimiento);
                              const stepDraftKey = `${exp.id}-impulso-${plazo.id}`;
                              return (
                                <div
                                  key={plazo.id}
                                  className={`rounded-2xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                    plazo.completado
                                      ? 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-75'
                                      : 'bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800'
                                  }`}
                                >
                                  <div className="flex items-start gap-3 min-w-0">
                                    <button
                                      type="button"
                                      onClick={() => void handleTogglePlazoCompletado(exp, plazo.id)}
                                      className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                                        plazo.completado
                                          ? 'bg-emerald-600 border-emerald-600 text-white'
                                          : 'border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-900 hover:border-emerald-500'
                                      }`}
                                      title={plazo.completado ? 'Reabrir plazo' : 'Marcar como completado'}
                                    >
                                      {plazo.completado && <Check className="w-3.5 h-3.5" />}
                                    </button>
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${getDeadlineBadgeStyle(dias, plazo.completado)}`}>
                                          {getDaysLabel(dias, plazo.completado)}
                                        </span>
                                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                          {formatDateShort(plazo.fechaVencimiento)}
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                          {plazo.tipo === 'impulso' ? 'Impulso' : 'Plazo Legal'}
                                        </span>
                                      </div>
                                      <p className={`text-xs font-bold mt-1 ${plazo.completado ? 'line-through text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                                        {plazo.titulo}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                    {!plazo.completado && (
                                      <button
                                        type="button"
                                        disabled={draftingKey === stepDraftKey}
                                        onClick={() => void handleRedactarConIA(exp, 'impulso', plazo)}
                                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                      >
                                        {draftingKey === stepDraftKey ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <Sparkles className="w-3 h-3 text-amber-300" />
                                        )}
                                        <span>Redactar Impulso IA</span>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => void handleDeletePlazoInline(exp, plazo.id)}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                                      title="Eliminar plazo"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>

                    {exp.notas && (
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 p-3.5">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                          Notas del Estudio
                        </p>
                        <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line">
                          {exp.notas}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Crear / Editar Expediente con Análisis IA */}
      {modalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <Briefcase className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm md:text-base font-black font-serif">
                  {editingExpediente ? 'Editar Expediente Judicial' : 'Nuevo Expediente Judicial'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmitExpediente(e)} className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Zona de Análisis PDF con IA dentro del modal */}
              <div className="rounded-2xl border border-indigo-200 dark:border-indigo-700/60 bg-indigo-50/70 dark:bg-indigo-950/30 p-4 space-y-3">
                <input
                  ref={modalPdfInputRef}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) {
                      void handleAnalyzePdfFile(file, 'modal');
                    }
                  }}
                />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-indigo-950 dark:text-indigo-100">
                        ✨ Analizar Demanda o Cédula PDF con IA
                      </p>
                      <p className="text-[11px] text-indigo-800/80 dark:text-indigo-300/80">
                        Extrae carátula, juzgado, tipo de juicio y calcula el plazo procesal según el CPC de Paraguay.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={analyzingTargetId === 'modal'}
                    onClick={() => modalPdfInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {analyzingTargetId === 'modal' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Analizando...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Subir PDF / Foto</span>
                      </>
                    )}
                  </button>
                </div>

                {pendingAnalysisPreview && pendingAnalysisPreview.target === 'modal' && (
                  <div className="rounded-xl bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 p-3.5 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                        <FileCheck2 className="w-4 h-4" />
                        Sugerencia IA ({pendingAnalysisPreview.fileName})
                      </span>
                      <button
                        type="button"
                        onClick={() => setPendingAnalysisPreview(null)}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="font-bold text-slate-900 dark:text-white">
                      {pendingAnalysisPreview.result.caratula}
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px]">
                      {pendingAnalysisPreview.result.juzgado} • {pendingAnalysisPreview.result.tipoJuicio} • Rol sugerido: {pendingAnalysisPreview.result.rolParteSugerido}
                    </p>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11px]">
                      {pendingAnalysisPreview.result.resumenHechos}
                    </p>
                    {pendingAnalysisPreview.result.plazoPrincipal && (
                      <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-red-700 dark:text-red-300">
                        Plazo Principal: {pendingAnalysisPreview.result.plazoPrincipal.titulo} — Vence {formatDateShort(pendingAnalysisPreview.result.plazoPrincipal.fechaVencimiento)}
                      </div>
                    )}
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => void handleConfirmPendingAnalysis()}
                        className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirmar y Cargar al Expediente</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Campos del Expediente */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                <div className="sm:col-span-12">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Carátula del Expediente *
                  </label>
                  <input
                    type="text"
                    required
                    value={caratula}
                    onChange={(e) => setCaratula(e.target.value)}
                    placeholder='Ej: "Juan Pérez c/ Empresa X s/ Cobro de Guaraníes"'
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    N° Expediente
                  </label>
                  <input
                    type="text"
                    value={nroExpediente}
                    onChange={(e) => setNroExpediente(e.target.value)}
                    placeholder="Ej: 1245"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Año
                  </label>
                  <input
                    type="text"
                    value={anio}
                    onChange={(e) => setAnio(e.target.value)}
                    placeholder="2026"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Juzgado / Circunscripción
                  </label>
                  <input
                    type="text"
                    value={juzgado}
                    onChange={(e) => setJuzgado(e.target.value)}
                    placeholder="Ej: Juzgado de 1ra. Instancia en lo Civil, 3er Turno"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Tipo de Juicio
                  </label>
                  <select
                    value={tipoJuicio}
                    onChange={(e) => setTipoJuicio(e.target.value as TipoJuicioExpediente)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm text-slate-900 dark:text-white outline-none"
                  >
                    {TIPOS_JUICIO.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Rol de Parte
                  </label>
                  <select
                    value={rolParte}
                    onChange={(e) => setRolParte(e.target.value as RolParteExpediente)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm text-slate-900 dark:text-white outline-none"
                  >
                    {ROLES_PARTE.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Estado
                  </label>
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value as EstadoExpediente)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm text-slate-900 dark:text-white outline-none"
                  >
                    {ESTADOS_EXPEDIENTE.map((est) => (
                      <option key={est} value={est}>{est}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-12">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Cliente / Mandante (opcional)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={clienteNombre}
                      onChange={(e) => {
                        setClienteNombre(e.target.value);
                        setClienteId('');
                      }}
                      placeholder="Nombre completo o Razón Social del cliente"
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500"
                    />
                    {personas.length > 0 && (
                      <select
                        value={clienteId}
                        onChange={(e) => {
                          const pid = e.target.value;
                          setClienteId(pid);
                          const found = personas.find((p) => p.id === pid);
                          if (found) {
                            setClienteNombre(
                              found.nombre_o_razon_social || `${found.nombre} ${found.apellido || ''}`.trim()
                            );
                          }
                        }}
                        className="sm:w-56 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 outline-none"
                      >
                        <option value="">Elegir de Clientes/Partes...</option>
                        {personas.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre_o_razon_social || `${p.nombre} ${p.apellido || ''}`.trim()} ({p.nro_documento})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="sm:col-span-12">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Notas Estratégicas / Observaciones
                  </label>
                  <textarea
                    rows={2}
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Detalles de estrategia procesal, pruebas pendientes o montos..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs md:text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 resize-y"
                  />
                </div>
              </div>

              {/* Resumen de plazos cargados en borrador */}
              {draftPlazos.length > 0 && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3.5 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Plazos e Impulsos en este Expediente ({draftPlazos.length})
                  </p>
                  {draftPlazos.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 text-xs bg-white dark:bg-slate-800 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-700">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{p.titulo}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {formatDateShort(p.fechaVencimiento)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDraftPlazos((prev) => prev.filter((item) => item.id !== p.id))}
                          className="text-slate-400 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-md"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingExpediente ? 'Guardar Cambios' : 'Registrar Expediente'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmación Eliminación */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#121824] border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="w-11 h-11 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Eliminar Expediente
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Esta acción eliminará el expediente y su cronograma de plazos de forma permanente.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => void handleConfirmDeleteExpediente()}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Eliminar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
