import { db, auth } from '../services/auth';
import { doc, updateDoc } from 'firebase/firestore';
import React, { useState, useEffect, useRef, startTransition } from 'react';
import { useWorkspace } from '../hooks/useWorkspace';
import { createPortal } from 'react-dom';
import { Pagare, Persona, FrecuenciaConfig, MonedaConfig, GlobalConfig, TipoNegociacion, PaymentScheduleItem, TipoCronogramaItem, formatCurrencyValue, TipoDocumento } from '../types';
import { Plus, Trash2, Calendar, DollarSign, Users, FileText, Banknote, CheckCircle, AlertTriangle, Search, ShieldCheck, ScanLine, Loader2, UserCheck, Clipboard, Check, Lock, MoreVertical, Printer, XCircle } from 'lucide-react';
import { NumericFormat } from 'react-number-format';
import { analyzePagareImage } from '../services/gemini';
import { consultarRUC } from '../services/dnitService';
import { useTrialStatus } from '../hooks/useTrialStatus';
import { 
  sincronizarFirmantesDePagare, 
  sincronizarFirmantesDeFormulario, 
  sincronizarRetroactivoTodosLosPagares, 
  savePagaresToStorage 
} from '../services/personaSync';
import { ModalDetallePagare } from './ModalDetallePagare';

interface PagaresTabProps {
  pagares: Pagare[];
  personas: Persona[];
  config: GlobalConfig;
  onAddPagare: (pagare: Pagare) => void;
  onUpdatePagare?: (pagare: Pagare) => void;
  onDeletePagare: (id: string) => void;
  onAddPersona: (persona: Persona) => boolean;
  onSelectPagareForPreview: (pagare: Pagare) => void;
  isAdmin: boolean;
  userData?: any;
  isSoftBlocked?: boolean;
  initialPanelView?: 'list' | 'list_anulados' | 'create';
  initialEditingId?: string | null;
  onClose?: () => void;
}

export const PagaresTab: React.FC<PagaresTabProps> = ({
  pagares,
  personas,
  config,
  onAddPagare,
  onUpdatePagare,
  onDeletePagare,
  onAddPersona,
  onSelectPagareForPreview,
  isAdmin,
  userData,
  isSoftBlocked = false,
  initialPanelView = 'list',
  initialEditingId = null,
  onClose
}) => {
  // FASE 3: Asignación de Propiedad al Workspace
  const { workspaceId } = useWorkspace(auth?.currentUser, userData);

  // Guardián Blando de Recursos - Restricción de consultas a la API del DNIT
  const { diasRestantes, pruebaActiva, isTrialExpired, userData: liveUserData } = useTrialStatus(auth?.currentUser);
  const activeUserData = liveUserData || userData;
  const rawPlan = String(activeUserData?.planActual || activeUserData?.plan || '').toLowerCase();
  const isOperador = activeUserData?.rol === 'operador' || activeUserData?.role === 'operador';
  const esAdmin = isAdmin || auth?.currentUser?.email === 'jotamolinas@gmail.com' || isOperador;
  const isAprobado = String(activeUserData?.estadoPago).toUpperCase() === 'APROBADO' || String(activeUserData?.estadoPlataforma).toUpperCase() === 'APROBADO';
  const tienePlanPago = rawPlan.includes('pro') || rawPlan.includes('empresa') || rawPlan.includes('full') || rawPlan.includes('básico') || rawPlan.includes('basico') || isAprobado || esAdmin;
  const accesoBloqueadoPorTrial = !tienePlanPago && (isTrialExpired || !pruebaActiva || diasRestantes <= 0);

  let suscripcionVencida = false;
  const fechaVencimientoPlan = activeUserData?.fecha_vencimiento_plan;
  if (tienePlanPago && fechaVencimientoPlan && !esAdmin) {
    const vDate = new Date(fechaVencimientoPlan);
    const diasParaVencimiento = Math.ceil((vDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (diasParaVencimiento < 0) suscripcionVencida = true;
  }

  const isDnitBlocked = isSoftBlocked || (accesoBloqueadoPorTrial && !tienePlanPago) || suscripcionVencida;

  // Transición no bloqueante para abrir previsualización de pagarés sin congelar la UI
  const handleAbrirPagare = (pagare: Pagare) => {
    startTransition(() => {
      onSelectPagareForPreview(pagare);
    });
  };

  // Navigation tabs for Pagares tab list vs creation form
  const [panelView, setPanelView] = useState<'list' | 'list_anulados' | 'create'>(initialPanelView);
  const [formError, setFormError] = useState<string | null>(null);
  const [pagareToAnular, setPagareToAnular] = useState<any>(null); // We use any because Pagare type is somewhat complex or missing in scope
  
  // Doble Validación de Cobro Notarial
  const [cuotaParaCobrar, setCuotaParaCobrar] = useState<{ pagare: Pagare; index: number; cuotaNum: string; monto: number } | null>(null);
  const [isCobrandoCuota, setIsCobrandoCuota] = useState<boolean>(false);

  // Sincronización Automática con Fichero de Personas
  const [syncAlertBanner, setSyncAlertBanner] = useState<{ tipo: 'success' | 'info'; texto: string } | null>(null);
  const [isSyncingRetroactivo, setIsSyncingRetroactivo] = useState(false);

  // Fase 8: Trazabilidad UX - Código de Soporte Técnico
  const [copiedSupportId, setCopiedSupportId] = useState<string | null>(null);
  const [supportCopiedToast, setSupportCopiedToast] = useState<string | null>(null);
  const [selectedPagareForDetail, setSelectedPagareForDetail] = useState<Pagare | null>(null);

  // Menú de 3 puntitos para acciones secundarias de tarjetas (estilo Google Drive)
  const [activePagareMenuId, setActivePagareMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!activePagareMenuId) return;
    const handleOutsideClick = () => setActivePagareMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [activePagareMenuId]);

  const handleCopiarCodigoSoporte = async (pag: Pagare) => {
    const effectiveWorkspaceId = workspaceId || pag.userId || auth?.currentUser?.uid || 'no-workspace';
    const textToCopy = `Solicitud Soporte O.L.G.A. | Workspace: ${effectiveWorkspaceId} | Pagaré ID: ${pag.id} | Correlativo: ${pag.correlativo}`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopiedSupportId(pag.id);
      setSupportCopiedToast("Código de soporte copiado");
      setTimeout(() => setCopiedSupportId(null), 3000);
      setTimeout(() => setSupportCopiedToast(null), 3000);
    } catch (err) {
      console.error("Error al copiar código de soporte:", err);
    }
  };

  // Auto-cierre de banner de confirmación
  useEffect(() => {
    if (syncAlertBanner) {
      const timer = setTimeout(() => {
        setSyncAlertBanner(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [syncAlertBanner]);

  // Detección Retroactiva al cargar el componente (regla: deps [] para evitar fugas de memoria)
  useEffect(() => {
    if (pagares && pagares.length > 0 && personas && personas.length > 0) {
      const res = sincronizarRetroactivoTodosLosPagares(pagares, personas, (nueva) => {
        onAddPersona(nueva);
      });
      if (res.agregadas.length > 0) {
        setSyncAlertBanner({
          tipo: 'success',
          texto: res.mensaje
        });
      }
    }
  }, []);

  // Form main states
  const [tipoNegociacion, setTipoNegociacion] = useState<TipoNegociacion>('cuotas_corridas');
  const [moneda, setMoneda] = useState(config.monedas.find(m => m.activa)?.codigo || 'PYG');
  const [certificadoFirmasNro, setCertificadoFirmasNro] = useState('');
  const [valorTotalStr, setValorTotalStr] = useState('');
  const [frecuenciaId, setFrecuenciaId] = useState('mensual');
  const [editingPagareId, setEditingPagareId] = useState<string | null>(initialEditingId);


  // Priming Dates
  const getTodayDateString = () => new Date().toISOString().split('T')[0];
  const getOneMonthLaterDateString = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  };

  const calculateDatePlusMonths = (baseDateStr: string, monthsToAdd: number): string => {
    const parts = (baseDateStr || '').split('-').map(Number);
    let year: number;
    let month: number;
    let day: number;

    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      year = parts[0];
      month = parts[1] - 1;
      day = parts[2];
    } else {
      const fallback = new Date();
      year = fallback.getFullYear();
      month = fallback.getMonth();
      day = fallback.getDate();
    }

    const totalMonths = month + monthsToAdd;
    const targetYear = year + Math.floor(totalMonths / 12);
    const targetMonth = ((totalMonths % 12) + 12) % 12;
    const maxDaysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const clampedDay = Math.min(day, maxDaysInTargetMonth);

    return `${String(targetYear).padStart(4, '0')}-${String(targetMonth + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
  };

  useEffect(() => {
    if (initialEditingId && pagares) {
      const pag = pagares.find(p => p.id === initialEditingId);
      if (pag) {
        handleEditPagare(pag);
      }
    }
  }, [initialEditingId, pagares]);

  const [fechaPrimerPago, setFechaPrimerPago] = useState(getOneMonthLaterDateString());

  // Entrega inicial states
  const [entregaInicialStr, setEntregaInicialStr] = useState('');
  const [fechaEntregaInicial, setFechaEntregaInicial] = useState(getTodayDateString());
  const [conceptoEntregaInicial, setConceptoEntregaInicial] = useState('Entrega de seña de trato y conformación de firmas.');

  const [duracionMeses, setDuracionMeses] = useState<number | string>('');

  // Selected Personas (100% de edición libre)
  const [acreedorId, setAcreedorId] = useState('');
  const [acreedorNombreRaw, setAcreedorNombreRaw] = useState('');
  const [acreedorDocumentoRaw, setAcreedorDocumentoRaw] = useState('');
  const [acreedorDomicilioRaw, setAcreedorDomicilioRaw] = useState('');
  const [acreedorOrigen, setAcreedorOrigen] = useState<'MANUAL' | 'DNIT'>('MANUAL');
  const [loadingAcreedorDnit, setLoadingAcreedorDnit] = useState(false);
  const [feedbackAcreedorDnit, setFeedbackAcreedorDnit] = useState<string | null>(null);

  const [deudorNombreRaw, setDeudorNombreRaw] = useState('');
  const [deudorDocumentoRaw, setDeudorDocumentoRaw] = useState('');
  const [deudorDomicilioRaw, setDeudorDomicilioRaw] = useState('');
  const [deudorOrigen, setDeudorOrigen] = useState<'MANUAL' | 'DNIT'>('MANUAL');
  const [loadingDeudorDnit, setLoadingDeudorDnit] = useState(false);
  const [feedbackDeudorDnit, setFeedbackDeudorDnit] = useState<string | null>(null);

  const [deudorId, setDeudorId] = useState('');

  // Co-Deudor 1
  const [codeudor1Id, setCodeudor1Id] = useState('');
  const [codeudor1NombreRaw, setCodeudor1NombreRaw] = useState('');
  const [codeudor1DocumentoRaw, setCodeudor1DocumentoRaw] = useState('');
  const [codeudor1DomicilioRaw, setCodeudor1DomicilioRaw] = useState('');
  const [codeudor1Origen, setCodeudor1Origen] = useState<'MANUAL' | 'DNIT'>('MANUAL');
  const [loadingCodeudor1Dnit, setLoadingCodeudor1Dnit] = useState(false);
  const [feedbackCodeudor1Dnit, setFeedbackCodeudor1Dnit] = useState<string | null>(null);

  // Co-Deudor 2
  const [codeudor2Id, setCodeudor2Id] = useState('');
  const [codeudor2NombreRaw, setCodeudor2NombreRaw] = useState('');
  const [codeudor2DocumentoRaw, setCodeudor2DocumentoRaw] = useState('');
  const [codeudor2DomicilioRaw, setCodeudor2DomicilioRaw] = useState('');
  const [codeudor2Origen, setCodeudor2Origen] = useState<'MANUAL' | 'DNIT'>('MANUAL');
  const [loadingCodeudor2Dnit, setLoadingCodeudor2Dnit] = useState(false);
  const [feedbackCodeudor2Dnit, setFeedbackCodeudor2Dnit] = useState<string | null>(null);

  // Consultas DNIT voluntarias (solo disparadas por clic explícito del usuario)
  const handleConsultarAcreedorDnit = async (rucInput?: string) => {
    if (isDnitBlocked) {
      setFeedbackAcreedorDnit("⚠️ Consulta bloqueada: Requiere un plan activo o periodo de prueba vigente para utilizar la conexión con el DNIT.");
      setTimeout(() => setFeedbackAcreedorDnit(null), 5000);
      return;
    }
    const ruc = (rucInput !== undefined ? rucInput : acreedorDocumentoRaw).trim();
    if (!ruc || ruc.length < 4) {
      setFeedbackAcreedorDnit('Ingrese un número de documento para consultar.');
      setTimeout(() => setFeedbackAcreedorDnit(null), 3000);
      return;
    }
    setLoadingAcreedorDnit(true);
    setFeedbackAcreedorDnit(null);
    try {
      const res = await consultarRUC(ruc);
      if (res && res.nombre_o_razon_social) {
        setAcreedorNombreRaw(res.nombre_o_razon_social.trim());
        if (res.direccion) setAcreedorDomicilioRaw(res.direccion.trim());
        setAcreedorOrigen(res.origen === 'FICHERO' ? 'MANUAL' : 'DNIT');
        setFeedbackAcreedorDnit(`Datos obtenidos de ${res.origen === 'FICHERO' ? 'Fichero' : 'DNIT'}`);
        setTimeout(() => setFeedbackAcreedorDnit(null), 4000);
      } else {
        setFeedbackAcreedorDnit('No encontrado en DNIT. Puede completar los datos manualmente.');
        setTimeout(() => setFeedbackAcreedorDnit(null), 3500);
      }
    } catch (err) {
      console.warn('Consulta DNIT Acreedor no completada:', err);
      setFeedbackAcreedorDnit('No encontrado en DNIT. Ingrese los datos manualmente.');
      setTimeout(() => setFeedbackAcreedorDnit(null), 3500);
    } finally {
      setLoadingAcreedorDnit(false);
    }
  };

  const handleConsultarDeudorDnit = async (rucInput?: string) => {
    if (isDnitBlocked) {
      setFeedbackDeudorDnit("⚠️ Consulta bloqueada: Requiere un plan activo o periodo de prueba vigente para utilizar la conexión con el DNIT.");
      setTimeout(() => setFeedbackDeudorDnit(null), 5000);
      return;
    }
    const ruc = (rucInput !== undefined ? rucInput : deudorDocumentoRaw).trim();
    if (!ruc || ruc.length < 4) {
      setFeedbackDeudorDnit('Ingrese un número de documento para consultar.');
      setTimeout(() => setFeedbackDeudorDnit(null), 3000);
      return;
    }
    setLoadingDeudorDnit(true);
    setFeedbackDeudorDnit(null);
    try {
      const res = await consultarRUC(ruc);
      if (res && res.nombre_o_razon_social) {
        setDeudorNombreRaw(res.nombre_o_razon_social.trim());
        if (res.direccion) setDeudorDomicilioRaw(res.direccion.trim());
        setDeudorOrigen(res.origen === 'FICHERO' ? 'MANUAL' : 'DNIT');
        setFeedbackDeudorDnit(`Datos obtenidos de ${res.origen === 'FICHERO' ? 'Fichero' : 'DNIT'}`);
        setTimeout(() => setFeedbackDeudorDnit(null), 4000);
      } else {
        setFeedbackDeudorDnit('No encontrado en DNIT. Puede completar los datos manualmente.');
        setTimeout(() => setFeedbackDeudorDnit(null), 3500);
      }
    } catch (err) {
      console.warn('Consulta DNIT Deudor no completada:', err);
      setFeedbackDeudorDnit('No encontrado en DNIT. Ingrese los datos manualmente.');
      setTimeout(() => setFeedbackDeudorDnit(null), 3500);
    } finally {
      setLoadingDeudorDnit(false);
    }
  };

  const handleConsultarCodeudor1Dnit = async () => {
    if (isDnitBlocked) {
      setFeedbackCodeudor1Dnit("⚠️ Consulta bloqueada: Requiere un plan activo o periodo de prueba vigente para utilizar la conexión con el DNIT.");
      setTimeout(() => setFeedbackCodeudor1Dnit(null), 5000);
      return;
    }
    const ruc = codeudor1DocumentoRaw.trim();
    if (!ruc || ruc.length < 4) {
      setFeedbackCodeudor1Dnit('Ingrese un número de documento para consultar.');
      setTimeout(() => setFeedbackCodeudor1Dnit(null), 3000);
      return;
    }
    setLoadingCodeudor1Dnit(true);
    setFeedbackCodeudor1Dnit(null);
    try {
      const res = await consultarRUC(ruc);
      if (res && res.nombre_o_razon_social) {
        setCodeudor1NombreRaw(res.nombre_o_razon_social.trim());
        if (res.direccion) setCodeudor1DomicilioRaw(res.direccion.trim());
        setCodeudor1Origen(res.origen === 'FICHERO' ? 'MANUAL' : 'DNIT');
        setFeedbackCodeudor1Dnit(`Datos obtenidos de ${res.origen === 'FICHERO' ? 'Fichero' : 'DNIT'}`);
        setTimeout(() => setFeedbackCodeudor1Dnit(null), 4000);
      } else {
        setFeedbackCodeudor1Dnit('No encontrado en DNIT. Puede completar los datos manualmente.');
        setTimeout(() => setFeedbackCodeudor1Dnit(null), 3500);
      }
    } catch (err) {
      console.warn('Consulta DNIT Codeudor 1 no completada:', err);
      setFeedbackCodeudor1Dnit('No encontrado en DNIT. Ingrese los datos manualmente.');
      setTimeout(() => setFeedbackCodeudor1Dnit(null), 3500);
    } finally {
      setLoadingCodeudor1Dnit(false);
    }
  };

  const handleConsultarCodeudor2Dnit = async () => {
    if (isDnitBlocked) {
      setFeedbackCodeudor2Dnit("⚠️ Consulta bloqueada: Requiere un plan activo o periodo de prueba vigente para utilizar la conexión con el DNIT.");
      setTimeout(() => setFeedbackCodeudor2Dnit(null), 5000);
      return;
    }
    const ruc = codeudor2DocumentoRaw.trim();
    if (!ruc || ruc.length < 4) {
      setFeedbackCodeudor2Dnit('Ingrese un número de documento para consultar.');
      setTimeout(() => setFeedbackCodeudor2Dnit(null), 3000);
      return;
    }
    setLoadingCodeudor2Dnit(true);
    setFeedbackCodeudor2Dnit(null);
    try {
      const res = await consultarRUC(ruc);
      if (res && res.nombre_o_razon_social) {
        setCodeudor2NombreRaw(res.nombre_o_razon_social.trim());
        if (res.direccion) setCodeudor2DomicilioRaw(res.direccion.trim());
        setCodeudor2Origen(res.origen === 'FICHERO' ? 'MANUAL' : 'DNIT');
        setFeedbackCodeudor2Dnit(`Datos obtenidos de ${res.origen === 'FICHERO' ? 'Fichero' : 'DNIT'}`);
        setTimeout(() => setFeedbackCodeudor2Dnit(null), 4000);
      } else {
        setFeedbackCodeudor2Dnit('No encontrado en DNIT. Puede completar los datos manualmente.');
        setTimeout(() => setFeedbackCodeudor2Dnit(null), 3500);
      }
    } catch (err) {
      console.warn('Consulta DNIT Codeudor 2 no completada:', err);
      setFeedbackCodeudor2Dnit('No encontrado en DNIT. Ingrese los datos manualmente.');
      setTimeout(() => setFeedbackCodeudor2Dnit(null), 3500);
    } finally {
      setLoadingCodeudor2Dnit(false);
    }
  };

  const handleSelectAcreedor = (pId: string) => {
    setAcreedorId(pId);
    if (!pId) return;
    const persona = personas.find(p => p.id === pId);
    if (persona) {
      setAcreedorNombreRaw(`${persona.nombre} ${persona.apellido || ''}`.trim());
      setAcreedorDocumentoRaw(persona.nro_documento || '');
      setAcreedorDomicilioRaw(persona.domicilio || '');
      setAcreedorOrigen('MANUAL');
    }
  };

  const handleSelectDeudor = (pId: string) => {
    setDeudorId(pId);
    if (!pId) return;
    const persona = personas.find(p => p.id === pId);
    if (persona) {
      setDeudorNombreRaw(`${persona.nombre} ${persona.apellido || ''}`.trim());
      setDeudorDocumentoRaw(persona.nro_documento || '');
      setDeudorDomicilioRaw(persona.domicilio || '');
      setDeudorOrigen('MANUAL');
    }
  };

  const handleSelectCodeudor1 = (pId: string) => {
    setCodeudor1Id(pId);
    if (!pId) return;
    const persona = personas.find(p => p.id === pId);
    if (persona) {
      setCodeudor1NombreRaw(`${persona.nombre} ${persona.apellido || ''}`.trim());
      setCodeudor1DocumentoRaw(persona.nro_documento || '');
      setCodeudor1DomicilioRaw(persona.domicilio || '');
    }
  };

  const handleSelectCodeudor2 = (pId: string) => {
    setCodeudor2Id(pId);
    if (!pId) return;
    const persona = personas.find(p => p.id === pId);
    if (persona) {
      setCodeudor2NombreRaw(`${persona.nombre} ${persona.apellido || ''}`.trim());
      setCodeudor2DocumentoRaw(persona.nro_documento || '');
      setCodeudor2DomicilioRaw(persona.domicilio || '');
    }
  };

  // Refuerzos states: raw arrays used before generating schedule unificado
  // Reinforcement items: { monto: number, fecha: string, fecha_pag?: string, mes_ubicacion?: number | string }
  const [refuerzosRaw, setRefuerzosRaw] = useState<{ id: string; monto: number | string; fecha: string; fecha_pag?: string; mes_ubicacion?: number | string }[]>([
    { id: 'r-init', monto: '', fecha: getOneMonthLaterDateString(), fecha_pag: getOneMonthLaterDateString(), mes_ubicacion: '' }
  ]);
  const setRefuerzos = setRefuerzosRaw;

  // Integrated unified schedule array
  const [cronograma, setCronograma] = useState<PaymentScheduleItem[]>([]);

  // quick add persona logic
  const [showQuickAddPersonaModal, setShowQuickAddPersonaModal] = useState(false);
  const [quickPersonaTargetField, setQuickPersonaTargetField] = useState<'acreedor' | 'deudor' | 'codeudor1' | 'codeudor2' | null>(null);
  const [quickTipoPersona, setQuickTipoPersona] = useState<'física' | 'jurídica'>('física');
  const [quickNombre, setQuickNombre] = useState('');
  const [quickApellido, setQuickApellido] = useState('');
  const [quickNroDoc, setQuickNroDoc] = useState('');
  const [quickTipoDoc, setQuickTipoDoc] = useState<'CI' | 'RUC'>('CI');
  const [quickTel, setQuickTel] = useState('');
  const [quickMail, setQuickMail] = useState('');
  const [quickDom, setQuickDom] = useState('');
  const [quickRepId, setQuickRepId] = useState('');
  const [quickError, setQuickError] = useState('');
  const [loadingQuickDnit, setLoadingQuickDnit] = useState(false);
  const [feedbackQuickDnit, setFeedbackQuickDnit] = useState<string | null>(null);

  const handleConsultarQuickDnit = async () => {
    if (isDnitBlocked) {
      setFeedbackQuickDnit("⚠️ Consulta bloqueada: Requiere un plan activo o periodo de prueba vigente para utilizar la conexión con el DNIT.");
      setTimeout(() => setFeedbackQuickDnit(null), 5000);
      return;
    }
    const ruc = quickNroDoc.trim();
    if (!ruc || ruc.length < 4) {
      setFeedbackQuickDnit('Ingrese un número de documento para consultar.');
      setTimeout(() => setFeedbackQuickDnit(null), 3000);
      return;
    }
    setLoadingQuickDnit(true);
    setFeedbackQuickDnit(null);
    try {
      const res = await consultarRUC(ruc);
      if (res && res.nombre_o_razon_social) {
        if (quickTipoPersona === 'física') {
          const raw = res.nombre_o_razon_social.trim();
          const parts = raw.split(/\s+/);
          if (parts.length >= 2) {
            const mid = Math.ceil(parts.length / 2);
            setQuickNombre(parts.slice(0, mid).join(' '));
            setQuickApellido(parts.slice(mid).join(' '));
          } else {
            setQuickNombre(raw);
          }
        } else {
          setQuickNombre(res.nombre_o_razon_social);
        }
        if (res.direccion) setQuickDom(res.direccion);
        if (res.telefono) setQuickTel(res.telefono);
        setFeedbackQuickDnit(`Datos obtenidos de ${res.origen === 'FICHERO' ? 'Fichero' : 'DNIT'}`);
        setTimeout(() => setFeedbackQuickDnit(null), 4000);
      } else {
        setFeedbackQuickDnit('No encontrado en DNIT. Complete manualmente.');
        setTimeout(() => setFeedbackQuickDnit(null), 3500);
      }
    } catch {
      setFeedbackQuickDnit('No encontrado en DNIT.');
      setTimeout(() => setFeedbackQuickDnit(null), 3500);
    } finally {
      setLoadingQuickDnit(false);
    }
  };

  // Handle escape to close quick add persona modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showQuickAddPersonaModal) {
        setShowQuickAddPersonaModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showQuickAddPersonaModal]);

  // --- AUTOSAVE LOGIC ---
  const DRAFT_KEY = 'pagare_draft_v2';
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.tipoNegociacion) setTipoNegociacion(parsed.tipoNegociacion);
        if (parsed.moneda) setMoneda(parsed.moneda);
        if (parsed.certificadoFirmasNro) setCertificadoFirmasNro(parsed.certificadoFirmasNro);
        if (parsed.fechaPrimerPago) setFechaPrimerPago(parsed.fechaPrimerPago);
        if (parsed.entregaInicialStr) setEntregaInicialStr(parsed.entregaInicialStr);
        if (parsed.fechaEntregaInicial) setFechaEntregaInicial(parsed.fechaEntregaInicial);
        if (parsed.conceptoEntregaInicial) setConceptoEntregaInicial(parsed.conceptoEntregaInicial);
        if (parsed.duracionMeses) setDuracionMeses(parsed.duracionMeses);
        if (parsed.acreedorId) setAcreedorId(parsed.acreedorId);
        if (parsed.acreedorNombreRaw) setAcreedorNombreRaw(parsed.acreedorNombreRaw);
        if (parsed.acreedorDocumentoRaw) setAcreedorDocumentoRaw(parsed.acreedorDocumentoRaw);
        if (parsed.acreedorDomicilioRaw) setAcreedorDomicilioRaw(parsed.acreedorDomicilioRaw);
        if (parsed.deudorNombreRaw) setDeudorNombreRaw(parsed.deudorNombreRaw);
        if (parsed.deudorDocumentoRaw) setDeudorDocumentoRaw(parsed.deudorDocumentoRaw);
        if (parsed.deudorDomicilioRaw) setDeudorDomicilioRaw(parsed.deudorDomicilioRaw);
        if (parsed.deudorId) setDeudorId(parsed.deudorId);
        if (parsed.codeudor1Id) setCodeudor1Id(parsed.codeudor1Id);
        if (parsed.codeudor1NombreRaw) setCodeudor1NombreRaw(parsed.codeudor1NombreRaw);
        if (parsed.codeudor1DocumentoRaw) setCodeudor1DocumentoRaw(parsed.codeudor1DocumentoRaw);
        if (parsed.codeudor1DomicilioRaw) setCodeudor1DomicilioRaw(parsed.codeudor1DomicilioRaw);
        if (parsed.codeudor2Id) setCodeudor2Id(parsed.codeudor2Id);
        if (parsed.codeudor2NombreRaw) setCodeudor2NombreRaw(parsed.codeudor2NombreRaw);
        if (parsed.codeudor2DocumentoRaw) setCodeudor2DocumentoRaw(parsed.codeudor2DocumentoRaw);
        if (parsed.codeudor2DomicilioRaw) setCodeudor2DomicilioRaw(parsed.codeudor2DomicilioRaw);
        if (parsed.refuerzosRaw) setRefuerzosRaw(parsed.refuerzosRaw);
        if (parsed.cronograma && parsed.cronograma.length > 0) {
          setCronograma(parsed.cronograma);
          skipAutoGenerateRef.current = true;
        }
      } catch (e) {
        console.error("Error parsing form draft", e);
      }
    }
    setHasLoadedDraft(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedDraft || panelView !== 'create') return;

    const draft = {
      tipoNegociacion,
      moneda,
      certificadoFirmasNro,
      fechaPrimerPago,
      entregaInicialStr,
      fechaEntregaInicial,
      conceptoEntregaInicial,
      duracionMeses,
      acreedorId,
      acreedorNombreRaw,
      acreedorDocumentoRaw,
      acreedorDomicilioRaw,
      deudorNombreRaw,
      deudorDocumentoRaw,
      deudorDomicilioRaw,
      deudorId,
      codeudor1Id,
      codeudor1NombreRaw,
      codeudor1DocumentoRaw,
      codeudor1DomicilioRaw,
      codeudor2Id,
      codeudor2NombreRaw,
      codeudor2DocumentoRaw,
      codeudor2DomicilioRaw,
      refuerzosRaw,
      cronograma
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [
    hasLoadedDraft, panelView,
    tipoNegociacion, moneda, certificadoFirmasNro, valorTotalStr,
    frecuenciaId, fechaPrimerPago, entregaInicialStr, fechaEntregaInicial,
    conceptoEntregaInicial, duracionMeses, acreedorId, acreedorNombreRaw, acreedorDocumentoRaw,
    acreedorDomicilioRaw, deudorNombreRaw, deudorDocumentoRaw, deudorDomicilioRaw,
    deudorId, codeudor1Id, codeudor1NombreRaw, codeudor1DocumentoRaw, codeudor1DomicilioRaw,
    codeudor2Id, codeudor2NombreRaw, codeudor2DocumentoRaw, codeudor2DomicilioRaw,
    refuerzosRaw, cronograma
  ]);

  // Active items based on config rules
  const activeFrecuencias = config.frecuencias.filter(f => f.activa);
  const activeMonedas = config.monedas.filter(m => m.activa);

  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const skipAutoGenerateRef = useRef(false);

  const handleScanImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = (event.target?.result as string).split(',')[1];
        try {
          const data = await analyzePagareImage(base64Data, file.type);
          if (data) {
            if (data.valorTotal) setValorTotalStr(data.valorTotal.replace(/\D/g, ''));
            if (data.moneda && ['PYG', 'USD'].includes(data.moneda)) setMoneda(data.moneda);
            if (data.numeroCertificadoFirmas) setCertificadoFirmasNro(data.numeroCertificadoFirmas);
            
            if (data.acreedorBeneficiario) {
              if (data.acreedorBeneficiario.nombre) setAcreedorNombreRaw(data.acreedorBeneficiario.nombre);
              if (data.acreedorBeneficiario.documento) setAcreedorDocumentoRaw(data.acreedorBeneficiario.documento);
            }
            
            if (data.deudorPrincipal) {
              if (data.deudorPrincipal.nombre) setDeudorNombreRaw(data.deudorPrincipal.nombre);
              if (data.deudorPrincipal.documento) setDeudorDocumentoRaw(data.deudorPrincipal.documento);
              if (data.deudorPrincipal.domicilio) setDeudorDomicilioRaw(data.deudorPrincipal.domicilio);
            }

            if (data.fechaPrimerPago && !isNaN(new Date(data.fechaPrimerPago).getTime())) {
              setFechaPrimerPago(data.fechaPrimerPago);
            }
            if (data.entregaInicial) setEntregaInicialStr(data.entregaInicial.replace(/\D/g, ''));
            if (data.recomendaciones) console.error("O.L.G.A. analizó la imagen y nota lo siguiente: " + data.recomendaciones);
          } else {
            console.error('No se pudo extraer información del archivo.');
          }
        } catch (apiError: any) {
          console.error('Error de API al analizar el archivo: ' + apiError.message);
        }
        setIsScanning(false);
        setPanelView('create');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsScanning(false);
    }
  };

  const getMonedaSimbolo = (cod: string) => {
    return config.monedas.find(m => m.codigo === cod)?.simbolo || '$';
  };

  const formatCI = (val: string) => {
    // Keep only digits and dashes
    const clean = val.replace(/[^\d-]/g, '');
    const parts = clean.split('-');
    // Format the first part with dots
    let formatted = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    // Reattach the dash and the rest
    if (parts.length > 1) {
      formatted += '-' + parts.slice(1).join('');
    }
    return formatted;
  };

  // Autogenerate initial draft schedule when parameters change or on demand
  const handleAutoGenerateSchedule = () => {
    const totalVal = parseFloat(valorTotalStr) || 0;
    let downPayment = tipoNegociacion.includes('entrega') ? (parseFloat(entregaInicialStr) || 0) : 0;
    
    if (downPayment > totalVal) {
      downPayment = totalVal;
      setEntregaInicialStr(totalVal.toString());
    }

    const remainingAmount = totalVal - downPayment;

    const freqObj = activeFrecuencias.find(f => f.id === frecuenciaId) || activeFrecuencias[0];

    let baseCronograma: PaymentScheduleItem[] = [];

    // Cantidad Exacta de Cuotas: El bucle que genera las filas de la tabla debe iterar exactamente tantas veces como indique el campo 'Cantidad de Cuotas'
    const parsedCuotas = typeof duracionMeses === 'number'
      ? duracionMeses
      : parseInt(String(duracionMeses || '').trim(), 10);
    const defaultInstallmentCount = (!isNaN(parsedCuotas) && parsedCuotas > 0) ? parsedCuotas : 12;

    // Desglose de fecha base de primer pago
    let baseYear: number;
    let baseMonth: number; // 0-indexed
    let baseDay: number;

    if (fechaPrimerPago && /^\d{4}-\d{2}-\d{2}$/.test(fechaPrimerPago)) {
      const parts = fechaPrimerPago.split('-').map(Number);
      baseYear = parts[0];
      baseMonth = parts[1] - 1;
      baseDay = parts[2];
    } else {
      const fallback = new Date();
      baseYear = fallback.getFullYear();
      baseMonth = fallback.getMonth();
      baseDay = fallback.getDate();
    }

    const formatParts = (y: number, m: number, d: number) => {
      return `${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    };

    const addMonthsToDate = (year: number, month: number, day: number, monthsToAdd: number): string => {
      const totalMonths = month + monthsToAdd;
      const targetYear = year + Math.floor(totalMonths / 12);
      const targetMonth = ((totalMonths % 12) + 12) % 12;
      const maxDaysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
      const clampedDay = Math.min(day, maxDaysInTargetMonth);
      return formatParts(targetYear, targetMonth, clampedDay);
    };

    const addDaysToDate = (year: number, month: number, day: number, daysToAdd: number): string => {
      const d = new Date(year, month, day + daysToAdd, 12, 0, 0);
      return formatParts(d.getFullYear(), d.getMonth(), d.getDate());
    };

    // Cálculo de Intervalos por Frecuencia:
    // - Si es Mensual: sumar 1 mes a cada cuota subsiguiente
    // - Si es Semestral (Pagos cada 180 días / 6 meses): la primera cuota usa la fecha de inicio del primer pago, y cada cuota siguiente debe sumar exactamente 6 meses (o 180 días) a la fecha de la cuota anterior
    // - Si es Anual: sumar 12 meses (1 año) a cada cuota siguiente
    const calculateItemDateStr = (index: number): string => {
      if (index === 0) {
        return formatParts(baseYear, baseMonth, baseDay);
      }

      const isMensual = frecuenciaId === 'mensual' || freqObj?.intervalo_dias === 30;
      const isSemestral = frecuenciaId === 'semestral' || freqObj?.intervalo_dias === 180;
      const isAnual = frecuenciaId === 'anual' || freqObj?.intervalo_dias === 365;
      const isQuincenal = frecuenciaId === 'quincenal' || freqObj?.intervalo_dias === 15;
      const isSemanal = frecuenciaId === 'semanal' || freqObj?.intervalo_dias === 7;

      if (isMensual) {
        return addMonthsToDate(baseYear, baseMonth, baseDay, index);
      } else if (isSemestral) {
        return addMonthsToDate(baseYear, baseMonth, baseDay, index * 6);
      } else if (isAnual) {
        return addMonthsToDate(baseYear, baseMonth, baseDay, index * 12);
      } else if (isQuincenal) {
        return addDaysToDate(baseYear, baseMonth, baseDay, index * 15);
      } else if (isSemanal) {
        return addDaysToDate(baseYear, baseMonth, baseDay, index * 7);
      } else {
        const days = freqObj?.intervalo_dias || 30;
        return addDaysToDate(baseYear, baseMonth, baseDay, index * days);
      }
    };

    // Distribución del Monto:
    // El valor total declarado debe dividirse equitativamente entre la cantidad de cuotas generadas,
    // asegurando que la validación crítica de montos cuadre perfectamente sin diferencias de redondeo.
    const useDecimals = moneda !== 'PYG';
    const decScale = useDecimals ? 2 : 0;
    const factor = Math.pow(10, decScale);

    if (tipoNegociacion === 'cuotas_corridas' || tipoNegociacion === 'entrega_cuotas') {
      const baseInstallment = Math.round((remainingAmount / defaultInstallmentCount) * factor) / factor;
      let sumAssigned = 0;

      for (let i = 0; i < defaultInstallmentCount; i++) {
        const itemDateStr = calculateItemDateStr(i);
        
        let actualMonto = baseInstallment;
        if (i === defaultInstallmentCount - 1) {
          actualMonto = Math.round((remainingAmount - sumAssigned) * factor) / factor;
        } else {
          sumAssigned += baseInstallment;
        }

        actualMonto = Math.round(actualMonto * factor) / factor;

        baseCronograma.push({
          id: `sch-draft-${Date.now()}-${i}`,
          pagare_id: 'draft',
          tipo: 'cuota',
          fecha_pag: itemDateStr,
          monto: Math.max(0, actualMonto),
          numero_cuota: ''
        });
      }
    } else {
      // Con Refuerzos Especiales (R1 es obligatorio)
      const totalRefuerzosMonto = refuerzosRaw.reduce((sum, r) => {
        const val = (r as any).monto !== undefined && (r as any).monto !== null && (r as any).monto !== ''
          ? (r as any).monto
          : ((r as any).importe !== undefined ? (r as any).importe : ((r as any).valor || 0));
        return sum + (Number(val) || 0);
      }, 0);
      const remainingForCuotas = remainingAmount - totalRefuerzosMonto;

      refuerzosRaw.forEach((ref, idx) => {
        const rawMonto = (ref as any).monto !== undefined && (ref as any).monto !== null && (ref as any).monto !== ''
          ? (ref as any).monto
          : ((ref as any).importe !== undefined ? (ref as any).importe : ((ref as any).valor || 0));
        baseCronograma.push({
          id: ref.id || `sch-draft-ref-${idx}-${Date.now()}`,
          pagare_id: 'draft',
          tipo: 'refuerzo',
          fecha_pag: ref.fecha_pag || ref.fecha,
          monto: Number(rawMonto) || 0,
          numero_cuota: `R${idx + 1}`
        });
      });

      const baseCuotaMonto = defaultInstallmentCount > 0
        ? Math.round((remainingForCuotas / defaultInstallmentCount) * factor) / factor
        : 0;
      let sumCuotasAssigned = 0;

      for (let i = 0; i < defaultInstallmentCount; i++) {
        const itemDateStr = calculateItemDateStr(i);

        let actualMonto = baseCuotaMonto;
        if (i === defaultInstallmentCount - 1) {
          actualMonto = Math.round((remainingForCuotas - sumCuotasAssigned) * factor) / factor;
        } else {
          sumCuotasAssigned += baseCuotaMonto;
        }

        actualMonto = Math.round(actualMonto * factor) / factor;

        baseCronograma.push({
          id: `sch-draft-cuota-${i}-${Date.now()}`,
          pagare_id: 'draft',
          tipo: 'cuota',
          fecha_pag: itemDateStr,
          monto: Math.max(0, actualMonto),
          numero_cuota: ''
        });
      }
    }

    // Ordenar cronológicamente y asignar numeración normalizada
    const normalized = resequenceSchedule(baseCronograma);
    setCronograma(normalized);
  };

  const resequenceSchedule = (arr: PaymentScheduleItem[]): PaymentScheduleItem[] => {
    // Ordenar cronológicamente
    const sorted = [...arr].sort((a, b) => new Date(a.fecha_pag).getTime() - new Date(b.fecha_pag).getTime());

    let cuotaCounter = 1;

    return sorted.map(item => {
      if (item.tipo === 'cuota') {
        const num = `${cuotaCounter}`;
        cuotaCounter++;
        return { ...item, numero_cuota: num };
      } else {
        // Mantener el nombre original del refuerzo (Ej. R1, R2) extraído de su ID temporal
        let num = 'R';
        if (item.numero_cuota.startsWith('R')) {
           num = item.numero_cuota;
        } else {
           const match = item.id.match(/-ref-(\d+)-/);
           num = match ? `R${parseInt(match[1]) + 1}` : 'R';
        }
        return { ...item, numero_cuota: num };
      }
    });
  };

  // Helper arrays for down payment + cuotas + refuerzos calculations
  const totalMontoCuotasYRefuerzos = cronograma.reduce((sum, item) => sum + item.monto, 0);
  const deliveryMonto = tipoNegociacion.includes('entrega') ? (parseFloat(entregaInicialStr) || 0) : 0;
  const sumaTotalCalculada = deliveryMonto + totalMontoCuotasYRefuerzos;
  const declaredTotalVal = parseFloat(valorTotalStr) || 0;
  const totalFinanciar = declaredTotalVal - deliveryMonto;

  // Desglose detallado para Validación Crítica del Crédito
  const cuotasNormalesList = cronograma.filter(item => item.tipo === 'cuota');
  const cantidadCuotasNormales = cuotasNormalesList.length;
  const sumaTotalCuotasNormales = cuotasNormalesList.reduce((sum, item) => sum + (Number(item.monto) || 0), 0);

  const refuerzosList = cronograma.filter(item => item.tipo === 'refuerzo');
  const cantidadRefuerzos = refuerzosList.length > 0 
    ? refuerzosList.length 
    : (tipoNegociacion.includes('refuerzo') ? refuerzosRaw.length : 0);
  const sumaTotalRefuerzos = refuerzosList.length > 0
    ? refuerzosList.reduce((sum, r) => sum + (Number(r.monto) || 0), 0)
    : refuerzosRaw.reduce((sum, r) => sum + (Number(r.monto) || 0), 0);

  const isValidationMatch = Math.abs(sumaTotalCalculada - declaredTotalVal) < 1; // permit minor float variance

  // Smart recalculate keeping dates and just balancing the cuota montos
  const handleSmartRecalculate = () => {
    const totalVal = parseFloat(valorTotalStr) || 0;
    const downPayment = tipoNegociacion.includes('entrega') ? (parseFloat(entregaInicialStr) || 0) : 0;
    
    const totalRefuerzosMonto = cronograma.filter(c => c.tipo === 'refuerzo').reduce((acc, c) => acc + c.monto, 0);
    const remainingForCuotas = totalVal - downPayment - totalRefuerzosMonto;

    if (remainingForCuotas < 0) {
      console.error('La validación falló: La entrega inicial sumada a los refuerzos excede el valor total declarado del pagaré.');
      return;
    }

    const cuotasIdxs = cronograma.map((c, i) => c.tipo === 'cuota' ? i : -1).filter(i => i !== -1);
    
    if (cuotasIdxs.length === 0) {
      // Si no hay cuotas, simplemente recrear todo el cronograma
      handleAutoGenerateSchedule();
      return;
    }

    const unroundedInstallment = remainingForCuotas / cuotasIdxs.length;
    const useDecimals = moneda !== 'PYG';
    const decScale = useDecimals ? 2 : 0;
    
    const factor = Math.pow(10, decScale);
    let installmentVal = Math.round(unroundedInstallment * factor) / factor;
    
    const newCronograma = [...cronograma];
    
    let sumAssigned = 0;
    for (let i = 0; i < cuotasIdxs.length - 1; i++) {
        newCronograma[cuotasIdxs[i]] = {
            ...newCronograma[cuotasIdxs[i]],
            monto: Math.max(0, installmentVal)
        };
        sumAssigned += installmentVal;
    }
    
    const lastCuotaIdx = cuotasIdxs[cuotasIdxs.length - 1];
    let lastMonto = remainingForCuotas - sumAssigned;
    lastMonto = Math.round(lastMonto * factor) / factor;
    
    newCronograma[lastCuotaIdx] = {
        ...newCronograma[lastCuotaIdx],
        monto: Math.max(0, lastMonto)
    };
    
    setCronograma(newCronograma);
  };

  // Initial trigger for schedule drafting
  useEffect(() => {
    if (skipAutoGenerateRef.current) {
      skipAutoGenerateRef.current = false;
      return;
    }
    handleAutoGenerateSchedule();
  }, [tipoNegociacion, valorTotalStr, frecuenciaId, fechaPrimerPago, entregaInicialStr, refuerzosRaw, duracionMeses]);

  // Handle single cell edit in CRUD table
  const handleEditScheduleCell = (itemId: string, field: 'fecha_pag' | 'monto', value: any) => {
    const updated = cronograma.map(item => {
      if (item.id === itemId) {
        if (field === 'monto') {
          return { ...item, monto: parseFloat(value) || 0 };
        }
        return { ...item, [field]: value };
      }
      return item;
    });
    setCronograma(resequenceSchedule(updated));
  };

  // Delete row from schedule (Cannot delete R1 for refuerzos type)
  const handleDeleteScheduleItem = (id: string, numero: string) => {
    if (numero === 'R1' && (tipoNegociacion === 'entrega_refuerzo_cuota' || tipoNegociacion === 'cuotas_refuerzos')) {
      console.error('Error de regla de negocio: El primer refuerzo "R1" es obligatorio y no puede eliminarse.');
      return;
    }
    const filtered = cronograma.filter(item => item.id !== id);
    setCronograma(resequenceSchedule(filtered));
  };

  // Raw Refuerzo adder (syncs back to trigger schedule refresh)
  const handleAddRawRefuerzo = () => {
    const newId = `ref-raw-${Date.now()}`;
    const newRef = {
      id: newId,
      monto: '',
      fecha: getOneMonthLaterDateString(),
      fecha_pag: getOneMonthLaterDateString(),
      mes_ubicacion: ''
    };
    setRefuerzosRaw(prev => [...prev, newRef]);
  };

  const handleRemoveRawRefuerzo = (idToDel: string) => {
    if (refuerzosRaw.length <= 1) {
      console.error('Se requiere por lo menos un refuerzo obligatorio R1.');
      return;
    }
    setRefuerzosRaw(prev => prev.filter(r => r.id !== idToDel));
  };

  const handleRawRefuerzoChange = (id: string, field: 'monto' | 'fecha', val: any) => {
    setRefuerzosRaw(prev => prev.map(r => {
      if (r.id === id) {
        if (field === 'monto') {
          return { ...r, monto: (val === '' || val === undefined ? '' : parseFloat(val) || 0) };
        } else {
          return { ...r, fecha: val, fecha_pag: val };
        }
      }
      return r;
    }));
  };

  // Save the full promissory note
  
  const handleClearForm = () => {
    setTipoNegociacion('cuotas_corridas');
    setMoneda('PYG');
    setCertificadoFirmasNro('');
    setValorTotalStr('');
    setFrecuenciaId('mensual');
    setFechaPrimerPago('');
    setEntregaInicialStr('');
    setFechaEntregaInicial('');
    setConceptoEntregaInicial('');
    setAcreedorId('');
    setAcreedorNombreRaw('');
    setAcreedorDocumentoRaw('');
    setAcreedorDomicilioRaw('');
    setDeudorNombreRaw('');
    setDeudorDocumentoRaw('');
    setDeudorDomicilioRaw('');
    setDeudorId('');
    setCodeudor1Id('');
    setCodeudor2Id('');
    setDuracionMeses('');
    setRefuerzosRaw([{ id: `r-init-${Date.now()}`, monto: '', fecha: getOneMonthLaterDateString(), fecha_pag: getOneMonthLaterDateString(), mes_ubicacion: '' }]);
    setCronograma([]);
    localStorage.removeItem(DRAFT_KEY);
    setEditingPagareId(null);
    setPanelView('create');
  };

  function handleEditPagare(pag: Pagare) {
    setEditingPagareId(pag.id);
    setTipoNegociacion(pag.tipo_negociacion);
    setMoneda(pag.moneda);
    setCertificadoFirmasNro(pag.certificado_firmas_nro || '');
    setValorTotalStr(pag.valor_total.toString());
    setFrecuenciaId(pag.frecuencia_id || 'mensual');
    setFechaPrimerPago(pag.fecha_primer_pago || '');
    setEntregaInicialStr(pag.entrega_inicial?.toString() || '');
    setFechaEntregaInicial(pag.fecha_entrega_inicial || '');
    setConceptoEntregaInicial(pag.concepto_entrega_inicial || '');
    
    setAcreedorNombreRaw(pag.acreedor_nombre_raw || '');
    setAcreedorDocumentoRaw(pag.acreedor_documento_raw || '');
    setAcreedorDomicilioRaw(pag.acreedor_domicilio_raw || '');
    setAcreedorOrigen(pag.acreedor_origen || 'MANUAL');
    setAcreedorId(pag.acreedor_id || '');
    if (pag.acreedor_id && !pag.acreedor_nombre_raw) {
      const pAcr = personas.find(p => p.id === pag.acreedor_id);
      if (pAcr) {
        setAcreedorNombreRaw(`${pAcr.nombre} ${pAcr.apellido || ''}`.trim());
        setAcreedorDocumentoRaw(pAcr.nro_documento || '');
        setAcreedorDomicilioRaw(pAcr.domicilio || '');
      }
    }
    
    setDeudorNombreRaw(pag.deudor_nombre_raw || '');
    setDeudorDocumentoRaw(pag.deudor_documento_raw || '');
    setDeudorDomicilioRaw(pag.deudor_domicilio_raw || '');
    setDeudorOrigen(pag.deudor_origen || 'MANUAL');
    setDeudorId(pag.deudor_id || '');
    if (pag.deudor_id && !pag.deudor_nombre_raw) {
      const pDeu = personas.find(p => p.id === pag.deudor_id);
      if (pDeu) {
        setDeudorNombreRaw(`${pDeu.nombre} ${pDeu.apellido || ''}`.trim());
        setDeudorDocumentoRaw(pDeu.nro_documento || '');
        setDeudorDomicilioRaw(pDeu.domicilio || '');
      }
    }
    
    setCodeudor1Id(pag.codeudor1_id || '');
    setCodeudor1NombreRaw(pag.codeudor1_nombre_raw || '');
    setCodeudor1DocumentoRaw(pag.codeudor1_documento_raw || '');
    setCodeudor1DomicilioRaw(pag.codeudor1_domicilio_raw || '');
    setCodeudor1Origen(pag.codeudor1_origen || 'MANUAL');
    if (pag.codeudor1_id && !pag.codeudor1_nombre_raw) {
      const p1 = personas.find(p => p.id === pag.codeudor1_id);
      if (p1) {
        setCodeudor1NombreRaw(`${p1.nombre} ${p1.apellido || ''}`.trim());
        setCodeudor1DocumentoRaw(p1.nro_documento || '');
        setCodeudor1DomicilioRaw(p1.domicilio || '');
      }
    }
    
    setCodeudor2Id(pag.codeudor2_id || '');
    setCodeudor2NombreRaw(pag.codeudor2_nombre_raw || '');
    setCodeudor2DocumentoRaw(pag.codeudor2_documento_raw || '');
    setCodeudor2DomicilioRaw(pag.codeudor2_domicilio_raw || '');
    setCodeudor2Origen(pag.codeudor2_origen || 'MANUAL');
    if (pag.codeudor2_id && !pag.codeudor2_nombre_raw) {
      const p2 = personas.find(p => p.id === pag.codeudor2_id);
      if (p2) {
        setCodeudor2NombreRaw(`${p2.nombre} ${p2.apellido || ''}`.trim());
        setCodeudor2DocumentoRaw(p2.nro_documento || '');
        setCodeudor2DomicilioRaw(p2.domicilio || '');
      }
    }
    
    // Hidratar cronograma normalizando los campos de importe (monto / importe / valor)
    const rawCronograma = pag.cronograma || [];
    const cronogramaLoaded = rawCronograma.map((item, idx) => {
      const montoNum = (item as any).monto !== undefined && (item as any).monto !== null && (item as any).monto !== ''
        ? Number((item as any).monto)
        : ((item as any).importe !== undefined && (item as any).importe !== null
          ? Number((item as any).importe)
          : (Number((item as any).valor) || 0));
      return {
        ...item,
        id: item.id || `sch-loaded-${idx}-${Date.now()}`,
        monto: montoNum
      };
    });

    // Hidratar refuerzosRaw para la sección de gestión de refuerzos
    const refuerzosEnCronograma = cronogramaLoaded.filter(item => item.tipo === 'refuerzo');
    if (refuerzosEnCronograma.length > 0) {
      const refuerzosHydrated = refuerzosEnCronograma.map((ref, idx) => {
        const montoVal = (ref as any).monto !== undefined && (ref as any).monto !== null && (ref as any).monto !== ''
          ? (ref as any).monto
          : ((ref as any).importe !== undefined ? (ref as any).importe : ((ref as any).valor || ''));
        return {
          id: ref.id || `r-loaded-${idx}-${Date.now()}`,
          monto: montoVal,
          fecha: ref.fecha_pag || (ref as any).fecha || '',
          fecha_pag: ref.fecha_pag || (ref as any).fecha || '',
          mes_ubicacion: (ref as any).mes_ubicacion !== undefined && (ref as any).mes_ubicacion !== null ? (ref as any).mes_ubicacion : ''
        };
      });
      setRefuerzosRaw(refuerzosHydrated);
    } else if ((pag as any).refuerzosRaw && Array.isArray((pag as any).refuerzosRaw) && (pag as any).refuerzosRaw.length > 0) {
      setRefuerzosRaw((pag as any).refuerzosRaw);
    } else if ((pag as any).refuerzos && Array.isArray((pag as any).refuerzos) && (pag as any).refuerzos.length > 0) {
      setRefuerzosRaw((pag as any).refuerzos);
    }

    const cuotasCount = cronogramaLoaded.filter(c => c.tipo === 'cuota').length;
    setDuracionMeses(cuotasCount > 0 ? cuotasCount : (cronogramaLoaded.length || 12));

    setCronograma(cronogramaLoaded);
    skipAutoGenerateRef.current = true;
    setPanelView('create');
  };

  // Sincronizar firmantes actuales del formulario con el Fichero de Clientes
  const handleSincronizarFirmantesFormulario = () => {
    const res = sincronizarFirmantesDeFormulario(
      {
        acreedorNombre: acreedorNombreRaw,
        acreedorDoc: acreedorDocumentoRaw,
        acreedorDomicilio: acreedorDomicilioRaw,
        acreedorOrigen,
        deudorNombre: deudorNombreRaw,
        deudorDoc: deudorDocumentoRaw,
        deudorDomicilio: deudorDomicilioRaw,
        deudorOrigen,
        codeudor1Id,
        codeudor1Nombre: codeudor1NombreRaw,
        codeudor1Doc: codeudor1DocumentoRaw,
        codeudor1Domicilio: codeudor1DomicilioRaw,
        codeudor1Origen,
        codeudor2Id,
        codeudor2Nombre: codeudor2NombreRaw,
        codeudor2Doc: codeudor2DocumentoRaw,
        codeudor2Domicilio: codeudor2DomicilioRaw,
        codeudor2Origen
      },
      personas,
      (nueva) => {
        onAddPersona(nueva);
      }
    );

    if (res.acreedorPersona) {
      setAcreedorId(res.acreedorPersona.id);
    }
    if (res.deudorPersona) {
      setDeudorId(res.deudorPersona.id);
    }
    if (res.codeudor1Persona) {
      setCodeudor1Id(res.codeudor1Persona.id);
    }
    if (res.codeudor2Persona) {
      setCodeudor2Id(res.codeudor2Persona.id);
    }

    setSyncAlertBanner({
      tipo: 'success',
      texto: res.mensaje
    });
  };

  // Sincronizar firmantes de un pagaré existente en la lista
  const handleSincronizarFirmantesDePagare = (pag: Pagare) => {
    const res = sincronizarFirmantesDePagare(
      pag,
      personas,
      (nueva) => {
        onAddPersona(nueva);
      }
    );

    if (res.pagareActualizado) {
      if (onUpdatePagare) {
        onUpdatePagare(res.pagareActualizado);
      }
      const pagaresActuales = [...pagares];
      const idx = pagaresActuales.findIndex(p => p.id === res.pagareActualizado!.id);
      if (idx >= 0) {
        pagaresActuales[idx] = res.pagareActualizado;
      } else {
        pagaresActuales.push(res.pagareActualizado);
      }
      savePagaresToStorage(pagaresActuales);
    }

    setSyncAlertBanner({
      tipo: 'success',
      texto: res.mensaje
    });
  };

  // Detección Retroactiva de todos los pagarés
  const handleSincronizarTodosRetroactivo = () => {
    setIsSyncingRetroactivo(true);
    try {
      const res = sincronizarRetroactivoTodosLosPagares(
        pagares,
        personas,
        (nueva) => {
          onAddPersona(nueva);
        }
      );
      setSyncAlertBanner({
        tipo: 'success',
        texto: res.mensaje
      });
    } finally {
      setTimeout(() => setIsSyncingRetroactivo(false), 500);
    }
  };

  const handleCreateNewPagare = () => {
    setFormError(null);
    if (!acreedorNombreRaw.trim()) {
      setFormError('Por favor, ingresa el Nombre del Acreedor.');
      return;
    }
    if (!acreedorDocumentoRaw.trim()) {
      setFormError('Por favor, ingresa el Documento del Acreedor.');
      return;
    }
    if (!deudorNombreRaw.trim()) {
      setFormError('Por favor, ingresa el Nombre del Deudor Principal.');
      return;
    }
    if (!deudorDocumentoRaw.trim()) {
      setFormError('Por favor, ingresa el Documento del Deudor Principal.');
      return;
    }
    if (userData?.tipoPerfil === 'Escribanía Pública') {
      if (certificadoFirmasNro && !/^\d+$/.test(certificadoFirmasNro)) {
        setFormError('El Certificado de Firmas debe contener solo números.');
        return;
      }
    }
    if (!isValidationMatch) {
      setFormError('No se puede generar: La suma del cronograma de pagos no coincide con el valor total declarado.');
      return;
    }

    const nroPaj = pagares.length > 0 ? Math.max(...pagares.map(p => p.correlativo)) + 1 : 101;

    // Sincronización y Auto-registro Inteligente de Firmantes con Fichero
    const syncRes = sincronizarFirmantesDeFormulario(
      {
        acreedorNombre: acreedorNombreRaw,
        acreedorDoc: acreedorDocumentoRaw,
        acreedorDomicilio: acreedorDomicilioRaw,
        acreedorOrigen,
        deudorNombre: deudorNombreRaw,
        deudorDoc: deudorDocumentoRaw,
        deudorDomicilio: deudorDomicilioRaw,
        deudorOrigen,
        codeudor1Id,
        codeudor1Nombre: codeudor1NombreRaw,
        codeudor1Doc: codeudor1DocumentoRaw,
        codeudor1Domicilio: codeudor1DomicilioRaw,
        codeudor1Origen,
        codeudor2Id,
        codeudor2Nombre: codeudor2NombreRaw,
        codeudor2Doc: codeudor2DocumentoRaw,
        codeudor2Domicilio: codeudor2DomicilioRaw,
        codeudor2Origen
      },
      personas,
      (nueva) => {
        onAddPersona(nueva);
      }
    );

    const deudorIdFinal = syncRes.deudorPersona?.id || deudorId || undefined;
    const acreedorIdFinal = syncRes.acreedorPersona?.id || acreedorId || undefined;
    const codeudor1IdFinal = syncRes.codeudor1Persona?.id || codeudor1Id || undefined;
    const codeudor2IdFinal = syncRes.codeudor2Persona?.id || codeudor2Id || undefined;

    const existingPagare = editingPagareId ? pagares.find(p => p.id === editingPagareId) : null;
    const finalPagare: Pagare = {
      ...(existingPagare || {}),
      id: editingPagareId || 'pag-' + Date.now(),
      correlativo: nroPaj,
      certificado_firmas_nro: userData?.tipoPerfil === 'Escribanía Pública' ? certificadoFirmasNro : undefined,
      tipo_negociacion: tipoNegociacion,
      moneda,
      valor_total: declaredTotalVal,
      frecuencia_id: frecuenciaId,
      fecha_primer_pago: fechaPrimerPago,
      entrega_inicial: deliveryMonto,
      fecha_entrega_inicial: tipoNegociacion.includes('entrega') ? fechaEntregaInicial : '',
      concepto_entrega_inicial: tipoNegociacion.includes('entrega') ? conceptoEntregaInicial : '',
      acreedor_id: acreedorIdFinal,
      acreedor_nombre_raw: acreedorNombreRaw.trim(),
      acreedor_documento_raw: acreedorDocumentoRaw.trim(),
      acreedor_domicilio_raw: acreedorDomicilioRaw.trim(),
      acreedor_origen: acreedorOrigen,
      deudor_id: deudorIdFinal,
      deudor_nombre_raw: deudorNombreRaw.trim(),
      deudor_documento_raw: deudorDocumentoRaw.trim(),
      deudor_domicilio_raw: deudorDomicilioRaw.trim(),
      deudor_origen: deudorOrigen,
      codeudor1_id: codeudor1IdFinal,
      codeudor1_nombre_raw: codeudor1NombreRaw.trim(),
      codeudor1_documento_raw: codeudor1DocumentoRaw.trim(),
      codeudor1_domicilio_raw: codeudor1DomicilioRaw.trim(),
      codeudor1_origen: codeudor1Origen,
      codeudor2_id: codeudor2IdFinal,
      codeudor2_nombre_raw: codeudor2NombreRaw.trim(),
      codeudor2_documento_raw: codeudor2DocumentoRaw.trim(),
      codeudor2_domicilio_raw: codeudor2DomicilioRaw.trim(),
      cronograma: cronograma.map(item => ({ 
        ...item, 
        monto: (item as any).monto !== undefined && (item as any).monto !== null && (item as any).monto !== ''
          ? Number((item as any).monto)
          : ((item as any).importe !== undefined ? Number((item as any).importe) : (Number((item as any).valor) || 0)),
        pagare_id: existingPagare ? item.pagare_id || existingPagare.id : 'pag-' + Date.now() 
      })),
      created_at: existingPagare?.created_at || new Date().toISOString(),
      creator_role: existingPagare?.creator_role || (auth?.currentUser as any)?.role || (auth?.currentUser as any)?.rol || (isAdmin ? 'admin' : 'titular'),
      creator_name: existingPagare?.creator_name || (auth?.currentUser as any)?.displayName || (auth?.currentUser as any)?.nombre || auth?.currentUser?.email?.split('@')[0] || 'Usuario',
      refuerzosRaw: refuerzosRaw,
      userId: workspaceId || existingPagare?.userId || auth?.currentUser?.uid || '',
      creator_id: existingPagare?.creator_id || auth?.currentUser?.uid,
      createdBy: existingPagare?.createdBy || auth?.currentUser?.uid
    } as any;

    if (editingPagareId && onUpdatePagare) {
      onUpdatePagare(finalPagare);
    } else {
      onAddPagare(finalPagare);
    }

    // Persistir pagaré en localStorage para lectura inmediata del Expediente 360°
    const pagaresActuales = [...pagares];
    const idxExist = pagaresActuales.findIndex(p => p.id === finalPagare.id);
    if (idxExist >= 0) {
      pagaresActuales[idxExist] = finalPagare;
    } else {
      pagaresActuales.push(finalPagare);
    }
    savePagaresToStorage(pagaresActuales);

    // Aviso de éxito de sincronización
    setSyncAlertBanner({
      tipo: 'success',
      texto: syncRes.mensaje
    });
    
    setEditingPagareId(null);
    
    // Clear the form
    setCertificadoFirmasNro('');
    setValorTotalStr('1500000');
    setAcreedorId('');
    setAcreedorNombreRaw('');
    setAcreedorDocumentoRaw('');
    setAcreedorDomicilioRaw('');
    setDeudorNombreRaw('');
    setDeudorDocumentoRaw('');
    setDeudorDomicilioRaw('');
    setDeudorId('');
    setCodeudor1Id('');
    setCodeudor1NombreRaw('');
    setCodeudor1DocumentoRaw('');
    setCodeudor1DomicilioRaw('');
    setCodeudor1Origen('MANUAL');
    setFeedbackCodeudor1Dnit(null);
    setCodeudor2Id('');
    setCodeudor2NombreRaw('');
    setCodeudor2DocumentoRaw('');
    setCodeudor2DomicilioRaw('');
    setCodeudor2Origen('MANUAL');
    setFeedbackCodeudor2Dnit(null);
    setAcreedorOrigen('MANUAL');
    setDeudorOrigen('MANUAL');
    setFeedbackAcreedorDnit(null);
    setFeedbackDeudorDnit(null);

    // Remove the autosave draft
    localStorage.removeItem(DRAFT_KEY);

    // Switch view and open preview
    if (onClose) {
      onClose();
    } else {
      setPanelView('list');
    }
    handleAbrirPagare(finalPagare);
  };

  // Quick Persona Create popup handlers
  const openQuickAddPersona = (roleTarget: 'acreedor' | 'deudor' | 'codeudor1' | 'codeudor2') => {
    setQuickPersonaTargetField(roleTarget);
    setQuickNombre('');
    setQuickApellido('');
    setQuickNroDoc('');
    setQuickTel('');
    setQuickMail('');
    setQuickDom('');
    setQuickRepId('');
    setQuickError('');
    setShowQuickAddPersonaModal(true);
  };

  const submitQuickPersona = () => {
    if (!quickNombre.trim()) {
      setQuickError('El nombre o razón social es obligatorio.');
      return;
    }
    if (quickTipoPersona === 'física' && !quickApellido.trim()) {
      setQuickError('El apellido es obligatorio para personas físicas.');
      return;
    }
    if (!quickNroDoc.trim()) {
      setQuickError('El número de documento es obligatorio.');
      return;
    }
    if (quickTipoPersona === 'jurídica' && !quickRepId) {
      setQuickError('Debe definir un representante para personas jurídicas.');
      return;
    }

    const newQuick: Persona = {
      id: 'p-' + Date.now(),
      tipo_persona: quickTipoPersona,
      nombre: quickNombre.trim(),
      apellido: quickTipoPersona === 'física' ? quickApellido.trim() : undefined,
      tipo_documento: quickTipoDoc,
      nro_documento: quickNroDoc.trim(),
      telefono: quickTel.trim(),
      email: quickMail.trim(),
      domicilio: quickDom.trim(),
      representante_id: quickTipoPersona === 'jurídica' ? quickRepId : undefined,
    };

    const added = onAddPersona(newQuick);
    if (!added) {
      setQuickError('Ya existe una persona en el sistema con ese número de documento.');
      return;
    }

    // Set value to target selector and inputs
    const nombreCompleto = `${newQuick.nombre} ${newQuick.apellido || ''}`.trim();
    if (quickPersonaTargetField === 'acreedor') {
      setAcreedorId(newQuick.id);
      setAcreedorNombreRaw(nombreCompleto);
      setAcreedorDocumentoRaw(newQuick.nro_documento);
      setAcreedorDomicilioRaw(newQuick.domicilio || '');
      setAcreedorOrigen('MANUAL');
    } else if (quickPersonaTargetField === 'deudor') {
      setDeudorId(newQuick.id);
      setDeudorNombreRaw(nombreCompleto);
      setDeudorDocumentoRaw(newQuick.nro_documento);
      setDeudorDomicilioRaw(newQuick.domicilio || '');
      setDeudorOrigen('MANUAL');
    } else if (quickPersonaTargetField === 'codeudor1') {
      setCodeudor1Id(newQuick.id);
      setCodeudor1NombreRaw(nombreCompleto);
      setCodeudor1DocumentoRaw(newQuick.nro_documento);
      setCodeudor1DomicilioRaw(newQuick.domicilio || '');
      setCodeudor1Origen('MANUAL');
    } else if (quickPersonaTargetField === 'codeudor2') {
      setCodeudor2Id(newQuick.id);
      setCodeudor2NombreRaw(nombreCompleto);
      setCodeudor2DocumentoRaw(newQuick.nro_documento);
      setCodeudor2DomicilioRaw(newQuick.domicilio || '');
      setCodeudor2Origen('MANUAL');
    }

    setShowQuickAddPersonaModal(false);
  };

  const getPersonaLabel = (pId: string) => {
    const person = personas.find(p => p.id === pId);
    if (!person) return 'Desconocido';
    return `${person.nombre} ${person.apellido || ''} (${person.tipo_documento}: ${person.nro_documento})`;
  };

  const getFrecuenciaNombre = (fId: string) => {
    return config.frecuencias.find(f => f.id === fId)?.nombre || fId;
  };

  const getTipoNegociacionLabel = (t: TipoNegociacion) => {
    switch (t) {
      case 'entrega_refuerzo_cuota': return 'Entrega Inicial + Refuerzos + Cuotas';
      case 'cuotas_corridas': return 'Cuotas Corridas';
      case 'cuotas_refuerzos': return 'Cuotas + Refuerzos';
      case 'entrega_cuotas': return 'Entrega Inicial + Cuotas';
    }
  };

  return (
    <div className="space-y-4 md:space-y-8 animate-message dark:bg-[#0B0F17]" id="pagares-tab-panel">
      {/* Cabecera Principal Unificada */}
      <div className={`${
        esFull 
          ? 'bg-[#F4F4F0]/80 dark:bg-[#12141C]/80 backdrop-blur-xl border border-amber-200/40 dark:border-amber-500/30 rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.06)]' 
          : 'bg-slate-900 text-white shadow-xl border border-slate-800 rounded-[2.5rem] p-6 md:p-8'
      } flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative overflow-hidden transition-all`}>
        {esFull && (
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/10 blur-[100px] rounded-full pointer-events-none"></div>
        )}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
              esFull 
                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border-amber-300/60' 
                : 'bg-white/10 text-[#FF3131] border-white/10'
            }`}>
              <Banknote className={`w-5 h-5 ${esFull ? 'text-amber-600 dark:text-amber-400' : 'text-[#FF3131]'}`} />
            </div>
            <div>
              <h2 className={`text-xl font-black tracking-tight flex items-center gap-2 font-serif ${
                esFull ? 'text-slate-900 dark:text-slate-100' : 'text-white'
              }`}>
                <span>Gestión de Pagarés</span>
                <span className={`px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-lg ${
                  esFull 
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold' 
                    : 'bg-[#FF3131] text-white'
                }`}>
                  O.L.G.A.
                </span>
              </h2>
              <p className={`text-xs mt-0.5 font-medium ${
                esFull ? 'text-slate-600 dark:text-slate-400' : 'text-slate-400'
              }`}>
                Panel principal para la gestión, redacción y control de pagarés oficiales para la {config.escribania.nombre}.
              </p>
            </div>
          </div>
        </div>

        {/* Resumen de Estado y Acceso Directo */}
        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto relative z-10">
          <div className={`px-3 py-2 rounded-2xl text-[11px] font-bold flex items-center gap-2 border ${
            esFull 
              ? 'bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 border-amber-200/60' 
              : 'bg-slate-800/80 border-slate-700/60 text-slate-300'
          }`}>
            <span className={`w-2 h-2 rounded-full ${esFull ? 'bg-amber-500' : 'bg-[#FF3131]'}`}></span>
            <span>{pagares.length} Pagarés Registrados</span>
          </div>
        </div>
      </div>

      {/* Sincronización Alerta Verde / Notificación Empresarial */}
      {syncAlertBanner && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 p-4 rounded-3xl flex items-start justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-200">Sincronización con Fichero de Clientes</h4>
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 mt-0.5">{syncAlertBanner.texto}</p>
            </div>
          </div>
          <button
            onClick={() => setSyncAlertBanner(null)}
            className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 font-bold text-xs p-1 rounded-lg"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tab selection inside Pagares panel */}
      <div className={`flex flex-col lg:flex-row justify-between items-center ${
        esFull 
          ? 'bg-[#F4F4F0]/80 dark:bg-[#12141C]/80 backdrop-blur-xl border border-amber-200/40 dark:border-amber-500/30 rounded-3xl p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.06)]' 
          : 'bg-white dark:bg-[#121824]/90 dark:backdrop-blur-xl dark:border dark:border-slate-800/80 dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] dark:rounded-2xl p-2 sm:p-3 rounded-3xl border border-slate-100 shadow-sm'
      } gap-2`}>
        <div className="flex flex-wrap justify-center gap-3 w-full box-border lg:w-auto bg-slate-50 dark:bg-[#0B0F17] p-1 rounded-2xl">
          <button
            onClick={() => { setPanelView('list'); setEditingPagareId(null); }}
            className={`flex-1 lg:flex-none px-3 sm:px-6 py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${panelView === 'list' ? 'bg-white dark:bg-[#121824] text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            Activos ({pagares.filter(p => p.status !== 'anulado').length})
          </button>
          <button
            onClick={() => { setPanelView('list_anulados'); setEditingPagareId(null); }}
            className={`flex-1 lg:flex-none px-3 sm:px-6 py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${panelView === 'list_anulados' ? 'bg-white dark:bg-[#121824] text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            Eliminados ({pagares.filter(p => p.status === 'anulado').length})
          </button>
          <button
            onClick={() => {
              handleClearForm();
            }}
            className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-6 py-2.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all shadow-sm ${panelView === 'create' ? 'bg-[#FF3131] text-white' : 'bg-red-50 dark:bg-red-950/40 text-[#FF3131] hover:bg-[#FF3131] hover:text-white border border-red-100 dark:border-red-900/50'}`}
          >
            <Plus className="w-4 h-4" /> Redactar Nuevo
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full box-border lg:w-auto justify-end px-1">
          <button
            type="button"
            onClick={handleSincronizarTodosRetroactivo}
            disabled={isSyncingRetroactivo}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 shadow-sm disabled:opacity-50"
            title="Detección retroactiva: Revisa todos los pagarés y auto-registra a los firmantes no fichados en el Fichero de Clientes"
          >
            {isSyncingRetroactivo ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF3131]" /> : <UserCheck className="w-3.5 h-3.5 text-[#FF3131]" />}
            <span>Sincronizar Firmantes con Fichero</span>
          </button>
          {isAdmin && (
            <div className="flex items-center">
              <input  autoComplete="nope" 
                type="file" 
                accept="image/*,application/pdf" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleScanImage} 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
                className="flex items-center gap-2 bg-[#FF3131] hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-sm transition-all disabled:opacity-50"
                title="Sube una foto o PDF de un Pagaré físico para autocompletar este formulario"
              >
                {isScanning ? <Loader2 className="w-4 h-4 animate-spin"/> : <ScanLine className="w-4 h-4" />}
                Escanear Autofill IA
              </button>
            </div>
          )}
        </div>
      </div>

      {panelView === 'list' || panelView === 'list_anulados' ? (() => {
        /* Función auxiliar de clasificación y pesaje por estado de pagaré */
        const getPagareStatusDetails = (pag: Pagare) => {
          let badgeStatus: 'vencido' | 'proximo' | 'al_dia' | 'pagado' | 'anulado' | null = null;
          let nextDueDate: Date | null = null;
          let diasDiferencia: number | null = null;
          let cuotasPendientesCount = 0;
          let totalCuotasCount = pag.cronograma?.length || 0;

          if (pag.status === 'anulado' || (pag as any).estado === 'Anulado') {
            return {
              badgeStatus: 'anulado' as const,
              nextDueDate: null,
              diasDiferencia: null,
              cuotasPendientesCount: 0,
              totalCuotasCount,
              weight: 5
            };
          }

          if (pag.cronograma && pag.cronograma.length > 0) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const pendingCuotas = pag.cronograma.filter((c: any) => c.estado !== 'cobrado' && !c.pagado);
            cuotasPendientesCount = pendingCuotas.length;

            if (pendingCuotas.length === 0) {
              badgeStatus = 'pagado';
            } else {
              let hasVencido = false;
              let hasProximo = false;
              let minDiff = 999999;

              const sortedPending = [...pendingCuotas].sort((a: any, b: any) => new Date(a.fecha_pag).getTime() - new Date(b.fecha_pag).getTime());

              const nextC = sortedPending[0];
              const cDate = new Date(nextC.fecha_pag);
              const parts = nextC.fecha_pag.split('-');
              if (parts.length === 3) {
                cDate.setFullYear(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
              }
              cDate.setHours(0, 0, 0, 0);
              nextDueDate = cDate;

              for (const c of sortedPending) {
                const cDateLoop = new Date(c.fecha_pag);
                const partsL = c.fecha_pag.split('-');
                if (partsL.length === 3) {
                  cDateLoop.setFullYear(parseInt(partsL[0]), parseInt(partsL[1]) - 1, parseInt(partsL[2]));
                }
                cDateLoop.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((cDateLoop.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                if (diffDays < minDiff) {
                  minDiff = diffDays;
                }

                if (diffDays < 0) {
                  hasVencido = true;
                } else if (diffDays <= 5) {
                  hasProximo = true;
                }
              }

              diasDiferencia = minDiff;

              if (hasVencido) badgeStatus = 'vencido';
              else if (hasProximo) badgeStatus = 'proximo';
              else badgeStatus = 'al_dia';
            }
          } else if (pag.status === 'cobrado' || (pag as any).estado === 'Cobrado') {
            badgeStatus = 'pagado';
          } else {
            badgeStatus = 'al_dia';
          }

          // Prioridad de ordenamiento:
          // 1°: Vencidos (rojos) -> 1
          // 2°: Próximos a vencer (amarillos) -> 2
          // 3°: Al día (verdes) -> 3
          // 4°: Pagados (esmeralda oscuro) -> 4
          // 5°: Anulados / Otros -> 5
          let weight = 5;
          if (badgeStatus === 'vencido') weight = 1;
          else if (badgeStatus === 'proximo') weight = 2;
          else if (badgeStatus === 'al_dia') weight = 3;
          else if (badgeStatus === 'pagado') weight = 4;
          else if (badgeStatus === 'anulado') weight = 5;

          return { badgeStatus, nextDueDate, diasDiferencia, cuotasPendientesCount, totalCuotasCount, weight };
        };

        const basePagares = panelView === 'list' 
          ? pagares.filter(p => p.status !== 'anulado') 
          : pagares.filter(p => p.status === 'anulado');

        // Ordenamiento por prioridad de estado
        const pagaresOrdenados = [...basePagares].sort((a, b) => {
          const statusA = getPagareStatusDetails(a);
          const statusB = getPagareStatusDetails(b);
          if (statusA.weight !== statusB.weight) {
            return statusA.weight - statusB.weight;
          }
          if (statusA.nextDueDate && statusB.nextDueDate) {
            return statusA.nextDueDate.getTime() - statusB.nextDueDate.getTime();
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        const countVencidos = basePagares.filter(p => getPagareStatusDetails(p).badgeStatus === 'vencido').length;
        const countProximos = basePagares.filter(p => getPagareStatusDetails(p).badgeStatus === 'proximo').length;
        const countAlDia = basePagares.filter(p => getPagareStatusDetails(p).badgeStatus === 'al_dia').length;
        const countPagados = basePagares.filter(p => getPagareStatusDetails(p).badgeStatus === 'pagado').length;

        return (
          /* LIST VIEW OF CREATED PROMISSORY NOTES */
          <div className="bg-white dark:bg-[#121824]/90 dark:backdrop-blur-xl dark:border dark:border-slate-800/80 dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] dark:rounded-2xl p-6 sm:p-8 rounded-[2.5rem] border border-slate-100 shadow-md">
            <div className="pb-6 border-b border-slate-100 dark:border-slate-800/80 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold font-serif text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span>Caja Registradora de Pagarés</span>
                  {panelView === 'list_anulados' && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-sans font-bold">
                      Papelera / Eliminados
                    </span>
                  )}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Documentos autorizados ordenados por urgencia de cobro. Haga clic para abrir la Certificación de Firmas e Impresión Oficial.
                </p>
              </div>

              {/* Indicadores resumidos de estado */}
              {basePagares.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                  {countVencidos > 0 && (
                    <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 border border-red-200 flex items-center gap-1.5 shadow-2xs animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{countVencidos} Vencido{countVencidos > 1 ? 's' : ''}</span>
                    </span>
                  )}
                  {countProximos > 0 && (
                    <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1.5 shadow-2xs">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{countProximos} Próximo{countProximos > 1 ? 's' : ''}</span>
                    </span>
                  )}
                  {countAlDia > 0 && (
                    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>{countAlDia} Al Día</span>
                    </span>
                  )}
                  {countPagados > 0 && (
                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1.5 shadow-2xs">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{countPagados} Pagado{countPagados > 1 ? 's' : ''}</span>
                    </span>
                  )}
                  <span className="px-3 py-1 rounded-full bg-slate-50 text-slate-500 border border-slate-200">
                    Total: {basePagares.length}
                  </span>
                </div>
              )}
            </div>

            {pagaresOrdenados.length === 0 ? (
              <div className="py-24 text-center bg-slate-50 border border-dashed rounded-3xl border-slate-200">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="font-bold text-slate-600 text-base">No hay pagarés registrados en esta vista.</p>
                <p className="text-xs text-slate-400 mt-1">Cree un nuevo pagaré y proceda a configurar su cronograma.</p>
                <button
                  onClick={() => {
                    handleClearForm();
                  }}
                  className="mt-6 px-6 py-3 bg-[#FF3131] hover:bg-red-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all"
                >
                  Comenzar Redacción
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {pagaresOrdenados.map((pag) => {
                  const acreedor = personas.find(p => p.id === pag.acreedor_id);
                  const deudor = personas.find(p => p.id === pag.deudor_id);
                  const { badgeStatus, nextDueDate } = getPagareStatusDetails(pag);

                  let dateStr = 'Fecha reciente';
                  if (pag.created_at) {
                    try {
                      dateStr = new Date(pag.created_at).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' });
                    } catch {
                      dateStr = String(pag.created_at).slice(0, 10);
                    }
                  }

                  const nombreAcreedor = pag.acreedor_nombre_raw || acreedor?.nombre || (pag as any).nombreAcreedor || 'Sin especificar';
                  const nombreDeudor = pag.deudor_nombre_raw || deudor?.nombre || (pag as any).nombreDeudor || 'Sin especificar';

                  return (
                    <div
                      key={pag.id}
                      onClick={() => setSelectedPagareForDetail(pag)}
                      className={`rounded-3xl border shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between p-5 md:p-6 relative group cursor-pointer dark:bg-[#0B0F17]/90 dark:backdrop-blur-xl dark:border-slate-800/80 dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] dark:rounded-2xl ${
                        badgeStatus === 'vencido' 
                          ? 'bg-red-50/60 border-red-300 hover:border-red-500 hover:bg-red-50 dark:border-red-900/70' 
                          : badgeStatus === 'proximo' 
                            ? 'bg-amber-50/60 border-amber-300 hover:border-amber-500 hover:bg-amber-50 dark:border-amber-900/70' 
                            : badgeStatus === 'al_dia' || badgeStatus === 'pagado'
                              ? 'bg-emerald-50/60 border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50 dark:border-emerald-900/70'
                              : 'bg-slate-50/60 border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                      } ${activePagareMenuId === pag.id ? 'z-30' : 'z-0 hover:z-10'}`}
                    >
                      <div>
                        {/* 1. CABECERA DE LA TARJETA (Idéntica a Escritos) */}
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-center gap-3 overflow-hidden min-w-0">
                            <div className="w-10 h-10 bg-slate-900 dark:bg-slate-800 text-[#FF3131] rounded-2xl flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                              <FileText className="w-5 h-5 text-[#FF3131]" />
                            </div>
                            <div className="flex-1 overflow-hidden min-w-0">
                              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate" title={`Pagaré Nº ${pag.correlativo || 'S/N'}`}>
                                Pagaré Nº {pag.correlativo || 'S/N'}
                              </h4>
                              <p className="text-[10px] text-slate-400 dark:text-slate-400 font-medium flex items-center gap-1 mt-0.5 truncate">
                                <Calendar className="w-3 h-3 shrink-0 text-slate-400" />
                                <span className="truncate">{dateStr}</span>
                              </p>
                            </div>
                          </div>

                          {/* Pill de Estado + Menú Kebab */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {badgeStatus === 'vencido' && (
                              <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded-lg border bg-red-50 text-red-600 border-red-200 shrink-0">
                                Vencido
                              </span>
                            )}
                            {badgeStatus === 'proximo' && (
                              <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded-lg border bg-amber-50 text-amber-600 border-amber-200 shrink-0">
                                Próximo
                              </span>
                            )}
                            {badgeStatus === 'al_dia' && (
                              <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded-lg border bg-emerald-50 text-emerald-600 border-emerald-200 shrink-0">
                                Al Día
                              </span>
                            )}
                            {badgeStatus === 'pagado' && (
                              <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded-lg border bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0">
                                Pagado
                              </span>
                            )}
                            {badgeStatus === 'anulado' && (
                              <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded-lg border bg-slate-50 text-slate-500 border-slate-200 shrink-0">
                                Eliminado
                              </span>
                            )}

                            {/* Menú Desplegable (Tres Puntos) */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActivePagareMenuId(activePagareMenuId === pag.id ? null : pag.id);
                                }}
                                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Opciones del pagaré"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {/* Dropdown flotante */}
                              {activePagareMenuId === pag.id && (
                                <>
                                  <div 
                                    className="fixed inset-0 z-40 cursor-default" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActivePagareMenuId(null);
                                    }} 
                                  />
                                  <div 
                                    className="absolute right-0 top-9 z-50 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 animate-in fade-in zoom-in-95 duration-150 text-xs font-bold"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActivePagareMenuId(null);
                                        handleAbrirPagare(pag);
                                      }}
                                      className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center gap-2 transition-colors cursor-pointer"
                                    >
                                      <Printer className="w-3.5 h-3.5 text-slate-400" />
                                      <span>Imprimir / Notarial</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActivePagareMenuId(null);
                                        handleSincronizarFirmantesDePagare(pag);
                                      }}
                                      className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-slate-50 hover:text-emerald-700 flex items-center gap-2 transition-colors cursor-pointer"
                                    >
                                      <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                                      <span>Sincronizar con Fichero</span>
                                    </button>

                                    {(pag.status !== 'anulado' && pag.estado !== 'Anulado') && (
                                      <>
                                        <div className="my-1 border-t border-slate-100" />
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActivePagareMenuId(null);
                                            setPagareToAnular(pag);
                                          }}
                                          className="w-full px-3.5 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer"
                                        >
                                          <XCircle className="w-3.5 h-3.5 text-red-500" />
                                          <span>🚫 Eliminar Pagaré</span>
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 2. CUERPO DE LA TARJETA (Minimalista) */}
                        <div className="mt-3 mb-3">
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="text-lg md:text-xl font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight group-hover:text-[#FF3131] transition-colors flex items-baseline gap-1">
                              <span className="text-xs font-bold text-slate-400">{getMonedaSimbolo(pag.moneda)}</span>
                              <span>{formatCurrencyValue(pag.valor_total || (pag as any).monto || 0, pag.moneda)}</span>
                            </div>
                            {(() => {
                              const pendingIndex = pag.cronograma?.findIndex((c: any) => c.estado !== 'cobrado' && c.pagado !== true) ?? -1;
                              if (pendingIndex !== -1 && pag.cronograma) {
                                return (
                                  <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800 px-2 py-0.5 rounded-lg shrink-0">
                                    Cuota {pag.cronograma[pendingIndex].numero_cuota}/{pag.cronograma.length}
                                  </span>
                                );
                              }
                              if (nextDueDate) {
                                return (
                                  <span className="text-[10px] font-medium text-slate-400 shrink-0">
                                    Vence: {nextDueDate.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' })}
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>

                        {/* Partes Compactas: Acreedor y Deudor */}
                        <div className="space-y-1.5 bg-slate-50/80 dark:bg-[#121824]/90 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                          <div className="overflow-hidden">
                            <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold leading-none mb-0.5">Acreedor</p>
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate" title={nombreAcreedor}>
                              {nombreAcreedor}
                            </p>
                          </div>
                          <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-800 overflow-hidden">
                            <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold leading-none mb-0.5">Deudor Principal</p>
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate" title={nombreDeudor}>
                              {nombreDeudor}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 3. PIE DE LA TARJETA Y ACCIONES */}
                      <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3 mt-4 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                        {/* A la izquierda: Botón de EDITAR */}
                        {(pag.status !== 'anulado' && pag.estado !== 'Anulado') ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditPagare(pag);
                            }}
                            className="text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg font-bold transition-colors cursor-pointer"
                            title="Editar datos del pagaré"
                          >
                            EDITAR
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400">Eliminado</span>
                        )}

                        {/* A la derecha: Botón de COBRAR CUOTA */}
                        {(pag.status !== 'anulado' && pag.estado !== 'Anulado' && pag.status !== 'cobrado' && pag.estado !== 'Cobrado') ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (pag.cronograma && pag.cronograma.length > 0) {
                                const pendingIndex = pag.cronograma.findIndex((c: any) => c.estado !== 'cobrado' && c.pagado !== true);
                                if (pendingIndex !== -1) {
                                  setCuotaParaCobrar({
                                    pagare: pag,
                                    index: pendingIndex,
                                    cuotaNum: String(pag.cronograma[pendingIndex].numero_cuota),
                                    monto: pag.cronograma[pendingIndex].monto
                                  });
                                } else {
                                  setCuotaParaCobrar({
                                    pagare: pag,
                                    index: -1,
                                    cuotaNum: 'TOTALIDAD',
                                    monto: pag.valor_total || (pag as any).monto || 0
                                  });
                                }
                              } else {
                                setCuotaParaCobrar({
                                  pagare: pag,
                                  index: -1,
                                  cuotaNum: 'TOTALIDAD',
                                  monto: pag.valor_total || (pag as any).monto || 0
                                });
                              }
                            }}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                            title="Registrar cobro notarial con doble confirmación"
                          >
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>
                              {pag.cronograma && pag.cronograma.length > 0 ? (
                                (() => {
                                  const pendingIndex = pag.cronograma.findIndex((c: any) => c.estado !== 'cobrado' && c.pagado !== true);
                                  if (pendingIndex !== -1) {
                                    return `COBRAR CUOTA ${pag.cronograma[pendingIndex].numero_cuota}`;
                                  }
                                  return 'MARCAR COBRADO';
                                })()
                              ) : (
                                'MARCAR COBRADO'
                              )}
                            </span>
                          </button>
                        ) : (
                          (pag.status === 'cobrado' || pag.estado === 'Cobrado') ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Cobrado Total</span>
                            </span>
                          ) : null
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
          )}
        </div>
      );
    })() : (
        /* CREATE / FORM VIEW FOR PROMISSORY NOTE */
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* Main settings panel */}
          <div className="xl:col-span-2 bg-white dark:bg-[#121824]/90 dark:backdrop-blur-xl dark:border dark:border-slate-800/80 dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] dark:rounded-2xl p-8 rounded-[2.5rem] border border-slate-100 shadow-md space-y-8">
            <div className="pb-4 border-b border-slate-50 dark:border-slate-800">
              <h2 className="text-2xl font-bold font-serif text-slate-800 dark:text-slate-100">Formulario de Redacción del Pagaré</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Especifique condiciones iniciales, asigne partes firmantes y configure el cronograma financiero.</p>
            </div>

            {/* 1. Datos Generales */}
            <section className="space-y-4">
              <h3 className="text-xs font-black uppercase text-[#FF3131] tracking-[0.2em] mb-4">1. Estipulaciones Financieras</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Tipo Negociacion */}
                <div>
                  <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-1.5">Tipo de Negociación</label>
                  <select
                    value={tipoNegociacion}
                    onChange={(e) => {
                      setTipoNegociacion(e.target.value as TipoNegociacion);
                      setCronograma([]);
                    }}
                    className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3 py-2.5 text-sm font-bold tracking-tight outline-none"
                  >
                    <option value="cuotas_corridas">Cuotas Corridas (Solo cuotas)</option>
                    <option value="entrega_refuerzo_cuota">Entrega Inicial + Refuerzos + Cuotas</option>
                    <option value="cuotas_refuerzos">Cuotas + Refuerzos (Sin entrega)</option>
                    <option value="entrega_cuotas">Entrega Inicial + Cuotas (Sin refuerzos)</option>
                  </select>
                </div>

                {/* Moneda */}
                <div>
                  <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-1.5">Moneda del Crédito</label>
                  <select
                    value={moneda}
                    onChange={(e) => setMoneda(e.target.value)}
                    className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3 py-2.5 text-sm font-bold tracking-tight outline-none"
                  >
                    {activeMonedas.map((m) => (
                      <option key={m.codigo} value={m.codigo}>
                        {m.nombre} ({m.simbolo})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Valor Total */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-1.5">Valor Total Declarado del Pagaré</label>
                  <div className="relative">
                    <span className="absolute left-4 top-2.5 text-xs font-black text-slate-400">{getMonedaSimbolo(moneda)}</span>
                    <NumericFormat
                      value={valorTotalStr}
                      onValueChange={(values) => setValorTotalStr(values.value || '')}
                      thousandSeparator={moneda === 'PYG' || moneda === 'BRL' ? '.' : ','}
                      decimalSeparator={moneda === 'PYG' || moneda === 'BRL' ? ',' : '.'}
                      decimalScale={moneda === 'PYG' ? 0 : 2}
                      fixedDecimalScale={moneda !== 'PYG'}
                      placeholder="0"
                      className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl pl-12 pr-4 py-2.5 text-sm font-extrabold outline-none"
                    />
                  </div>
                </div>

                {/* Certificado de firmas N° */}
                {userData?.tipoPerfil === 'Escribanía Pública' && (
                  <div>
                    <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-1.5">Nº de Certificado de Firmas</label>
                    <input  autoComplete="nope"
                      type="text"
                      maxLength={9}
                      placeholder="Ej. 123456789"
                      value={certificadoFirmasNro}
                      onChange={(e) => setCertificadoFirmasNro(e.target.value.replace(/\D/g, ''))}
                      className={`w-full bg-slate-50 border rounded-xl px-4 py-2.5 text-sm font-mono font-bold tracking-widest outline-none ${editingPagareId && !certificadoFirmasNro ? 'border-red-500 border-2 focus:border-red-500 focus:ring-1 focus:ring-red-500' : 'border-slate-200 focus:border-[#FF3131]'}`}
                    />
                    {editingPagareId && !certificadoFirmasNro && (
                      <p className="text-red-500 text-xs mt-1">* Dato requerido para el registro</p>
                    )}
                  </div>
                )}

                {/* Frecuencia de pagos */}
                <div>
                  <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-1.5">Frecuencia de Pagos</label>
                  <select
                    value={frecuenciaId}
                    onChange={(e) => setFrecuenciaId(e.target.value)}
                    className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3 py-2.5 text-sm font-medium outline-none"
                  >
                    {activeFrecuencias.map(f => (
                      <option key={f.id} value={f.id}>{f.nombre} ({f.descripcion})</option>
                    ))}
                  </select>
                </div>

                {/* Fecha primer pago */}
                <div>
                  <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-1.5">Vencimiento del Primer Pago</label>
                  <input  autoComplete="nope"
                    type="date"
                    value={fechaPrimerPago}
                    onChange={(e) => setFechaPrimerPago(e.target.value)}
                    className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-4 py-2.5 text-sm font-medium outline-none"
                  />
                </div>

               {/* Duración en Pagos/Meses (Campo Libre) */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-1.5">Cantidad de Cuotas / Pagos (Duración)</label>
                  <input  autoComplete="nope"
                    type="number"
                    min="1"
                    value={duracionMeses || ''}
                    onChange={(e) => {
                      if (e.target.value === '') {
                        setDuracionMeses('');
                      } else {
                        const val = parseInt(e.target.value);
                        setDuracionMeses(isNaN(val) || val < 1 ? '' : val);
                      }
                    }}
                    className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-4 py-2.5 text-sm font-extrabold text-slate-700 outline-none"
                    placeholder="Ej. 1, 5, 12, 24..."
                  />
                  <p className="text-[10px] text-slate-400 mt-1 font-medium">Escriba el número total de pagos o cuotas a generar en el cronograma.</p>
                </div>

              </div>
            </section>

            {/* 2. y 3. Entrega Inicial y Refuerzos */}
            {(tipoNegociacion.includes('entrega') || tipoNegociacion === 'entrega_refuerzo_cuota' || tipoNegociacion === 'cuotas_refuerzos') && (
              <section className="bg-slate-50/70 p-6 rounded-3xl border border-slate-100 space-y-8 animate-message">
                
                {tipoNegociacion.includes('entrega') && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase text-[#FF3131] tracking-[0.2em]">2. Estipulación de Entrega Inicial Mismo Acto</h3>
                      
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-1.5">Monto Entregado</label>
                        <div className="relative">
                          <span className="absolute left-4 top-2.5 text-xs font-black text-slate-400">{getMonedaSimbolo(moneda)}</span>
                          <NumericFormat
                            value={entregaInicialStr}
                            onValueChange={(values) => setEntregaInicialStr(values.value || '')}
                            thousandSeparator={moneda === 'PYG' || moneda === 'BRL' ? '.' : ','}
                            decimalSeparator={moneda === 'PYG' || moneda === 'BRL' ? ',' : '.'}
                            decimalScale={moneda === 'PYG' ? 0 : 2}
                            fixedDecimalScale={moneda !== 'PYG'}
                            className="w-full box-border bg-white border border-slate-200 focus:border-[#FF3131] rounded-xl pl-12 pr-4 py-2 text-sm font-extrabold outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-1.5">Fecha de Entrega</label>
                        <input  autoComplete="nope"
                          type="date"
                          value={fechaEntregaInicial}
                          onChange={(e) => setFechaEntregaInicial(e.target.value)}
                          className="w-full box-border bg-white border border-slate-200 focus:border-[#FF3131] rounded-xl px-4 py-2 text-sm font-medium outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase text-slate-400 tracking-wider mb-1.5">Concepto de Entrega Inicial (Texto Libre)</label>
                      <textarea
                        value={conceptoEntregaInicial}
                        onChange={(e) => setConceptoEntregaInicial(e.target.value)}
                        rows={2}
                        className="w-full box-border bg-white border border-slate-200 focus:border-[#FF3131] rounded-xl px-4 py-2 text-xs font-bold text-slate-600 outline-none resize-none"
                      />
                    </div>
                  </div>
                )}

                {(tipoNegociacion === 'entrega_refuerzo_cuota' || tipoNegociacion === 'cuotas_refuerzos') && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase text-[#FF3131] tracking-[0.2em]">3. Gestión de Refuerzos Especiales (Especializados)</h3>
                      <button
                        type="button"
                        onClick={handleAddRawRefuerzo}
                        className="px-3 py-1.5 bg-[#FF3131] hover:bg-red-600 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        [+] Agregar Refuerzo
                      </button>
                    </div>

                    <div className="space-y-3">
                      {refuerzosRaw.map((ref, idx) => (
                        <div key={ref.id} className="grid grid-cols-1 md:grid-cols-[45%_35%_20%] gap-4 bg-white p-3 rounded-2xl border border-slate-200/60 relative items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">
                              {idx === 0 ? 'R1 (Mandatorio)' : `R${idx + 1}`}
                            </span>
                            <div className="relative flex-grow">
                              <span className="absolute left-3 top-2 text-[11px] font-bold text-slate-400">{getMonedaSimbolo(moneda)}</span>
                              <NumericFormat
                                value={ref.monto}
                                onValueChange={(values) => handleRawRefuerzoChange(ref.id, 'monto', values.value)}
                                thousandSeparator={moneda === 'PYG' || moneda === 'BRL' ? '.' : ','}
                                decimalSeparator={moneda === 'PYG' || moneda === 'BRL' ? ',' : '.'}
                                decimalScale={moneda === 'PYG' ? 0 : 2}
                                fixedDecimalScale={moneda !== 'PYG'}
                                className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl pl-9 pr-2 py-1 text-xs font-extrabold outline-none"
                              />
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <select
                              className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-2 py-1 text-xs outline-none"
                              value={ref.mes_ubicacion !== undefined && ref.mes_ubicacion !== null && ref.mes_ubicacion !== '' ? ref.mes_ubicacion : ''}
                              onChange={(e) => {
                                const mes = parseInt(e.target.value);
                                if (!isNaN(mes)) {
                                  // Tomar la fecha base del crédito (fechaPrimerPago / primer vencimiento o fallback a 1 mes desde hoy)
                                  const baseDate = fechaPrimerPago || getOneMonthLaterDateString();
                                  const monthsToAdd = Math.max(0, mes - 1);
                                  const nuevaFechaCalculada = calculateDatePlusMonths(baseDate, monthsToAdd);

                                  setRefuerzos(prev => prev.map(r => 
                                    r.id === ref.id 
                                      ? { ...r, mes_ubicacion: mes, fecha: nuevaFechaCalculada, fecha_pag: nuevaFechaCalculada } 
                                      : r
                                  ));
                                }
                              }}
                            >
                              <option value="" disabled>Ubicar en Mes...</option>
                              <option value={1}>Mes 1 (Mismo mes que 1ra cuota)</option>
                              {Array.from({ length: Math.max(0, (Number(duracionMeses) || 12) - 1) }).map((_, i) => (
                                <option key={i + 2} value={i + 2}>Mes {i + 2}</option>
                              ))}
                            </select>
                            <input  autoComplete="nope"
                              type="date"
                              value={ref.fecha_pag || ref.fecha || ''}
                              onChange={(e) => {
                                const nuevaFecha = e.target.value;
                                setRefuerzos(prev => prev.map(r => 
                                  r.id === ref.id 
                                    ? { ...r, fecha: nuevaFecha, fecha_pag: nuevaFecha } 
                                    : r
                                ));
                              }}
                              className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-2 py-1 text-xs outline-none"
                            />
                          </div>
                          <div className="text-right">
                            {idx > 0 ? (
                              <button
                                type="button"
                                onClick={() => handleRemoveRawRefuerzo(ref.id)}
                                className="p-1 px-3.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-bold text-[10px] uppercase tracking-wider text-center"
                              >
                                Eliminar Refuerzo
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-bold italic pr-2">Fila Obligatoria</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* 4. Personas Involucradas */}
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-xs font-black uppercase text-[#FF3131] tracking-[0.2em]">4. Identificación de Firmantes</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Acreedor, Deudor Principal y Garantes Solidarios vinculados al Fichero de Clientes.</p>
                </div>
                <button
                  type="button"
                  onClick={handleSincronizarFirmantesFormulario}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm self-start sm:self-auto border border-slate-700"
                  title="Comprueba y auto-registra a los firmantes en el Fichero de Personas para habilitar su Expediente 360°"
                >
                  <UserCheck className="w-3.5 h-3.5 text-[#FF3131]" />
                  <span>Sincronizar Firmantes con Fichero</span>
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Acreedor */}
                <div className="p-4 border border-slate-200 rounded-2xl relative space-y-3 bg-white shadow-sm">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-black uppercase text-slate-500 tracking-wider">Acreedor / Beneficiario *</label>
                    <div className="flex items-center gap-2">
                      {acreedorOrigen === 'DNIT' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-300">
                          Origen: DNIT
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => openQuickAddPersona('acreedor')}
                        className="text-[9px] font-black uppercase text-[#FF3131] hover:underline"
                        title="Crear ficha rápida de persona"
                      >
                        [+] Rápido
                      </button>
                    </div>
                  </div>
                  <select
                    value={acreedorId}
                    onChange={(e) => handleSelectAcreedor(e.target.value)}
                    className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3 py-2 text-xs font-bold outline-none text-slate-700"
                  >
                    <option value="">-- Cargar desde Fichero de Clientes (Opcional) --</option>
                    {personas.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} {p.apellido || ''} ({p.tipo_documento}: {p.nro_documento})
                      </option>
                    ))}
                  </select>
                  <input autoComplete="nope"
                    type="text"
                    placeholder="Nombre Completo / Razón Social"
                    value={acreedorNombreRaw}
                    onChange={(e) => {
                      setAcreedorNombreRaw(e.target.value);
                      setAcreedorOrigen('MANUAL');
                      setAcreedorId('');
                    }}
                    className={`w-full bg-slate-50 border focus:border-[#FF3131] rounded-xl px-3 py-2 text-xs font-bold outline-none ${formError && !acreedorNombreRaw.trim() ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                  />
                  <div className="relative">
                    <input autoComplete="nope"
                      type="text"
                      placeholder="Documento (CI / RUC)"
                      value={acreedorDocumentoRaw}
                      onChange={(e) => {
                        setAcreedorDocumentoRaw(e.target.value);
                        setAcreedorOrigen('MANUAL');
                        setAcreedorId('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleConsultarAcreedorDnit();
                        }
                      }}
                      className={`w-full bg-slate-50 border focus:border-[#FF3131] rounded-xl px-3 py-2 pr-20 text-xs font-bold outline-none ${formError && !acreedorDocumentoRaw.trim() ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                    />
                    <button
                      type="button"
                      disabled={loadingAcreedorDnit}
                      onClick={() => handleConsultarAcreedorDnit()}
                      className={`absolute right-1.5 top-1.5 px-2.5 py-1 ${
                        isDnitBlocked 
                          ? 'bg-slate-400 text-slate-100 hover:bg-slate-500 cursor-pointer' 
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      } disabled:bg-slate-400 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors shadow-xs`}
                      title={isDnitBlocked ? "⚠️ Consulta bloqueada: Requiere un plan activo o periodo de prueba vigente para utilizar la conexión con el DNIT." : "Consultar RUC en DNIT (Acción voluntaria)"}
                    >
                      {loadingAcreedorDnit ? (
                        <Loader2 className="w-3 h-3 animate-spin text-white" />
                      ) : isDnitBlocked ? (
                        <Lock className="w-3 h-3 text-white/90" />
                      ) : (
                        <Search className="w-3 h-3 text-white" />
                      )}
                      <span>DNIT</span>
                    </button>
                  </div>
                  {loadingAcreedorDnit && (
                    <div className="p-1.5 bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1.5 text-[11px] font-bold text-slate-800 animate-pulse">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF3131]" />
                      <span>Consultando registro DNIT...</span>
                    </div>
                  )}
                  {feedbackAcreedorDnit && !loadingAcreedorDnit && (
                    <p className={`text-[11px] font-bold px-2 py-1.5 rounded-lg border leading-tight ${
                      feedbackAcreedorDnit.includes('⚠️') 
                        ? 'bg-amber-50 text-amber-900 border-amber-200 shadow-xs' 
                        : 'text-slate-700 bg-slate-100 border-slate-200'
                    }`}>
                      {feedbackAcreedorDnit}
                    </p>
                  )}
                  <input autoComplete="nope"
                    type="text"
                    placeholder="Domicilio / Dirección (Opcional)"
                    value={acreedorDomicilioRaw}
                    onChange={(e) => setAcreedorDomicilioRaw(e.target.value)}
                    className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  />
                </div>

                {/* Deudor */}
                <div className="p-4 border border-slate-200 rounded-2xl relative space-y-3 bg-white shadow-sm">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-black uppercase text-slate-500 tracking-wider">Deudor Principal *</label>
                    <div className="flex items-center gap-2">
                      {deudorOrigen === 'DNIT' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-300">
                          Origen: DNIT
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => openQuickAddPersona('deudor')}
                        className="text-[9px] font-black uppercase text-[#FF3131] hover:underline"
                        title="Crear ficha rápida de persona"
                      >
                        [+] Rápido
                      </button>
                    </div>
                  </div>
                  <select
                    value={deudorId}
                    onChange={(e) => handleSelectDeudor(e.target.value)}
                    className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3 py-2 text-xs font-bold outline-none text-slate-700"
                  >
                    <option value="">-- Cargar desde Fichero de Clientes (Opcional) --</option>
                    {personas.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} {p.apellido || ''} ({p.tipo_documento}: {p.nro_documento})
                      </option>
                    ))}
                  </select>
                  <input autoComplete="nope"
                    type="text"
                    placeholder="Nombre Completo / Razón Social"
                    value={deudorNombreRaw}
                    onChange={(e) => {
                      setDeudorNombreRaw(e.target.value);
                      setDeudorOrigen('MANUAL');
                      setDeudorId('');
                    }}
                    className={`w-full bg-slate-50 border focus:border-[#FF3131] rounded-xl px-3 py-2 text-xs font-bold outline-none ${formError && !deudorNombreRaw.trim() ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                  />
                  <div className="relative">
                    <input autoComplete="nope"
                      type="text"
                      placeholder="Documento (CI / RUC)"
                      value={deudorDocumentoRaw}
                      onChange={(e) => {
                        setDeudorDocumentoRaw(e.target.value);
                        setDeudorOrigen('MANUAL');
                        setDeudorId('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleConsultarDeudorDnit();
                        }
                      }}
                      className={`w-full bg-slate-50 border focus:border-[#FF3131] rounded-xl px-3 py-2 pr-20 text-xs font-bold outline-none ${formError && !deudorDocumentoRaw.trim() ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                    />
                    <button
                      type="button"
                      disabled={loadingDeudorDnit}
                      onClick={() => handleConsultarDeudorDnit()}
                      className={`absolute right-1.5 top-1.5 px-2.5 py-1 ${
                        isDnitBlocked 
                          ? 'bg-slate-400 text-slate-100 hover:bg-slate-500 cursor-pointer' 
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      } disabled:bg-slate-400 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors shadow-xs`}
                      title={isDnitBlocked ? "⚠️ Consulta bloqueada: Requiere un plan activo o periodo de prueba vigente para utilizar la conexión con el DNIT." : "Consultar RUC en DNIT (Acción voluntaria)"}
                    >
                      {loadingDeudorDnit ? (
                        <Loader2 className="w-3 h-3 animate-spin text-white" />
                      ) : isDnitBlocked ? (
                        <Lock className="w-3 h-3 text-white/90" />
                      ) : (
                        <Search className="w-3 h-3 text-white" />
                      )}
                      <span>DNIT</span>
                    </button>
                  </div>
                  {loadingDeudorDnit && (
                    <div className="p-1.5 bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1.5 text-[11px] font-bold text-slate-800 animate-pulse">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF3131]" />
                      <span>Consultando registro DNIT...</span>
                    </div>
                  )}
                  {feedbackDeudorDnit && !loadingDeudorDnit && (
                    <p className={`text-[11px] font-bold px-2 py-1.5 rounded-lg border leading-tight ${
                      feedbackDeudorDnit.includes('⚠️') 
                        ? 'bg-amber-50 text-amber-900 border-amber-200 shadow-xs' 
                        : 'text-slate-700 bg-slate-100 border-slate-200'
                    }`}>
                      {feedbackDeudorDnit}
                    </p>
                  )}
                  <input autoComplete="nope"
                    type="text"
                    placeholder="Domicilio / Dirección (Opcional)"
                    value={deudorDomicilioRaw}
                    onChange={(e) => setDeudorDomicilioRaw(e.target.value)}
                    className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  />
                </div>

                {/* Co-deudor 1 */}
                <div className="p-4 border border-slate-200 rounded-2xl relative space-y-3 bg-white shadow-sm">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-black uppercase text-slate-500 tracking-wider">Co-Deudor Solidario 1 (Opcional)</label>
                    <div className="flex items-center gap-2">
                      {codeudor1Origen === 'DNIT' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-300">
                          Origen: DNIT
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => openQuickAddPersona('codeudor1')}
                        className="text-[9px] font-black uppercase text-[#FF3131] hover:underline"
                        title="Crear ficha rápida de persona"
                      >
                        [+] Rápido
                      </button>
                    </div>
                  </div>
                  <select
                    value={codeudor1Id}
                    onChange={(e) => handleSelectCodeudor1(e.target.value)}
                    className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3 py-2 text-xs font-bold outline-none text-slate-700"
                  >
                    <option value="">-- Cargar desde Fichero de Clientes (Opcional) --</option>
                    {personas.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} {p.apellido || ''} ({p.tipo_documento}: {p.nro_documento})
                      </option>
                    ))}
                  </select>
                  <input autoComplete="nope"
                    type="text"
                    placeholder="Nombre Completo / Razón Social"
                    value={codeudor1NombreRaw}
                    onChange={(e) => {
                      setCodeudor1NombreRaw(e.target.value);
                      setCodeudor1Origen('MANUAL');
                      setCodeudor1Id('');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  />
                  <div className="relative">
                    <input autoComplete="nope"
                      type="text"
                      placeholder="Documento (CI / RUC)"
                      value={codeudor1DocumentoRaw}
                      onChange={(e) => {
                        setCodeudor1DocumentoRaw(e.target.value);
                        setCodeudor1Origen('MANUAL');
                        setCodeudor1Id('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleConsultarCodeudor1Dnit();
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3 py-2 pr-20 text-xs font-bold outline-none"
                    />
                    <button
                      type="button"
                      disabled={loadingCodeudor1Dnit}
                      onClick={() => handleConsultarCodeudor1Dnit()}
                      className={`absolute right-1.5 top-1.5 px-2.5 py-1 ${
                        isDnitBlocked 
                          ? 'bg-slate-400 text-slate-100 hover:bg-slate-500 cursor-pointer' 
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      } disabled:bg-slate-400 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors shadow-xs`}
                      title={isDnitBlocked ? "⚠️ Consulta bloqueada: Requiere un plan activo o periodo de prueba vigente para utilizar la conexión con el DNIT." : "Consultar RUC en DNIT (Acción voluntaria)"}
                    >
                      {loadingCodeudor1Dnit ? (
                        <Loader2 className="w-3 h-3 animate-spin text-white" />
                      ) : isDnitBlocked ? (
                        <Lock className="w-3 h-3 text-white/90" />
                      ) : (
                        <Search className="w-3 h-3 text-white" />
                      )}
                      <span>DNIT</span>
                    </button>
                  </div>
                  {loadingCodeudor1Dnit && (
                    <div className="p-1.5 bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1.5 text-[11px] font-bold text-slate-800 animate-pulse">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF3131]" />
                      <span>Consultando registro DNIT...</span>
                    </div>
                  )}
                  {feedbackCodeudor1Dnit && !loadingCodeudor1Dnit && (
                    <p className={`text-[11px] font-bold px-2 py-1.5 rounded-lg border leading-tight ${
                      feedbackCodeudor1Dnit.includes('⚠️') 
                        ? 'bg-amber-50 text-amber-900 border-amber-200 shadow-xs' 
                        : 'text-slate-700 bg-slate-100 border-slate-200'
                    }`}>
                      {feedbackCodeudor1Dnit}
                    </p>
                  )}
                  <input autoComplete="nope"
                    type="text"
                    placeholder="Domicilio / Dirección (Opcional)"
                    value={codeudor1DomicilioRaw}
                    onChange={(e) => setCodeudor1DomicilioRaw(e.target.value)}
                    className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  />
                </div>

                {/* Co-deudor 2 */}
                <div className="p-4 border border-slate-200 rounded-2xl relative space-y-3 bg-white shadow-sm">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-black uppercase text-slate-500 tracking-wider">Co-Deudor Solidario 2 (Opcional)</label>
                    <div className="flex items-center gap-2">
                      {codeudor2Origen === 'DNIT' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-300">
                          Origen: DNIT
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => openQuickAddPersona('codeudor2')}
                        className="text-[9px] font-black uppercase text-[#FF3131] hover:underline"
                        title="Crear ficha rápida de persona"
                      >
                        [+] Rápido
                      </button>
                    </div>
                  </div>
                  <select
                    value={codeudor2Id}
                    onChange={(e) => handleSelectCodeudor2(e.target.value)}
                    className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3 py-2 text-xs font-bold outline-none text-slate-700"
                  >
                    <option value="">-- Cargar desde Fichero de Clientes (Opcional) --</option>
                    {personas.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} {p.apellido || ''} ({p.tipo_documento}: {p.nro_documento})
                      </option>
                    ))}
                  </select>
                  <input autoComplete="nope"
                    type="text"
                    placeholder="Nombre Completo / Razón Social"
                    value={codeudor2NombreRaw}
                    onChange={(e) => {
                      setCodeudor2NombreRaw(e.target.value);
                      setCodeudor2Origen('MANUAL');
                      setCodeudor2Id('');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  />
                  <div className="relative">
                    <input autoComplete="nope"
                      type="text"
                      placeholder="Documento (CI / RUC)"
                      value={codeudor2DocumentoRaw}
                      onChange={(e) => {
                        setCodeudor2DocumentoRaw(e.target.value);
                        setCodeudor2Origen('MANUAL');
                        setCodeudor2Id('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleConsultarCodeudor2Dnit();
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3 py-2 pr-20 text-xs font-bold outline-none"
                    />
                    <button
                      type="button"
                      disabled={loadingCodeudor2Dnit}
                      onClick={() => handleConsultarCodeudor2Dnit()}
                      className={`absolute right-1.5 top-1.5 px-2.5 py-1 ${
                        isDnitBlocked 
                          ? 'bg-slate-400 text-slate-100 hover:bg-slate-500 cursor-pointer' 
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      } disabled:bg-slate-400 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors shadow-xs`}
                      title={isDnitBlocked ? "⚠️ Consulta bloqueada: Requiere un plan activo o periodo de prueba vigente para utilizar la conexión con el DNIT." : "Consultar RUC en DNIT (Acción voluntaria)"}
                    >
                      {loadingCodeudor2Dnit ? (
                        <Loader2 className="w-3 h-3 animate-spin text-white" />
                      ) : isDnitBlocked ? (
                        <Lock className="w-3 h-3 text-white/90" />
                      ) : (
                        <Search className="w-3 h-3 text-white" />
                      )}
                      <span>DNIT</span>
                    </button>
                  </div>
                  {loadingCodeudor2Dnit && (
                    <div className="p-1.5 bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1.5 text-[11px] font-bold text-slate-800 animate-pulse">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF3131]" />
                      <span>Consultando registro DNIT...</span>
                    </div>
                  )}
                  {feedbackCodeudor2Dnit && !loadingCodeudor2Dnit && (
                    <p className={`text-[11px] font-bold px-2 py-1.5 rounded-lg border leading-tight ${
                      feedbackCodeudor2Dnit.includes('⚠️') 
                        ? 'bg-amber-50 text-amber-900 border-amber-200 shadow-xs' 
                        : 'text-slate-700 bg-slate-100 border-slate-200'
                    }`}>
                      {feedbackCodeudor2Dnit}
                    </p>
                  )}
                  <input autoComplete="nope"
                    type="text"
                    placeholder="Domicilio / Dirección (Opcional)"
                    value={codeudor2DomicilioRaw}
                    onChange={(e) => setCodeudor2DomicilioRaw(e.target.value)}
                    className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  />
                </div>

              </div>
            </section>

            {/* 5. Tabla CRUD Unificada de Cronograma */}
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-slate-100 pt-6">
                <div>
                  <h3 className="text-xs font-black uppercase text-[#FF3131] tracking-[0.2em]">5. Cronograma de Pagos Unificado (Cuotas e Hitos)</h3>
                  <p className="text-[10px] text-slate-400 font-medium leading-none mt-1">Sincroniza y re-calcula las amortizaciones mensuales correspondientes.</p>
                </div>
              </div>

              {/* Table CRUD (Fase 2: Edición Manual) */}
              <div className="border border-slate-100 rounded-3xl overflow-x-auto bg-white shadow-inner">
                <table className="w-full box-border text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      <th className="py-3.5 px-4 w-28">Vencimiento</th>
                      <th className="py-3.5 px-4 w-32">Concepto / ID Cuota</th>
                      <th className="py-3.5 px-4">Fecha de Pago (Modificable)</th>
                      <th className="py-3.5 px-4 w-64">Importe Modificable ({getMonedaSimbolo(moneda)})</th>
                      <th className="py-3.5 px-4 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs">
                    {cronograma.map((item) => {
                      // Fase 2: Muestra el número de cuota en formato 1/15
                      const isCuota = item.tipo === 'cuota';
                      const numText = isCuota ? `${item.numero_cuota}/${cronograma.filter(c => c.tipo === 'cuota').length}` : `${item.numero_cuota}`;
                      const idText = item.numero_cuota.startsWith('R') ? `Refuerzo ${numText}` : `Cuota ${numText}`;
                      
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/40 transition-colors">
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${item.tipo === 'cuota' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                              {item.tipo}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-700">
                            {idText}
                          </td>
                          <td className="py-3 px-4">
                            <input  autoComplete="nope"
                              type="date"
                              value={item.fecha_pag}
                              onChange={(e) => handleEditScheduleCell(item.id, 'fecha_pag', e.target.value)}
                              className="bg-transparent hover:bg-slate-100 focus:bg-white border-0 border-b border-dashed border-slate-200 outline-none px-2 py-1 font-medium w-full box-border text-xs text-slate-800 focus:border-[#FF3131]"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className="relative">
                              <span className="absolute left-1.5 top-1.5 text-slate-400 font-bold">{getMonedaSimbolo(moneda)}</span>
                              <NumericFormat
                                value={item.monto}
                                onValueChange={(values) => handleEditScheduleCell(item.id, 'monto', values.value)}
                                thousandSeparator={moneda === 'PYG' || moneda === 'BRL' ? '.' : ','}
                                decimalSeparator={moneda === 'PYG' || moneda === 'BRL' ? ',' : '.'}
                                decimalScale={moneda === 'PYG' ? 0 : 2}
                                fixedDecimalScale={moneda !== 'PYG'}
                                className="bg-transparent hover:bg-slate-100 focus:bg-white border-0 border-b border-dashed border-slate-200 outline-none pl-7 pr-2 py-1 font-extrabold text-xs text-slate-800 focus:border-[#FF3131] w-full box-border"
                              />
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteScheduleItem(item.id, item.numero_cuota)}
                              className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Recálculo de Totales (Fase 2) */}
              <div className="flex flex-col sm:flex-row items-center justify-between mt-4 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Control Financiero:</span>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Suma de Cuotas Editadas</span>
                    <span className={`text-sm font-black ${Math.abs(totalMontoCuotasYRefuerzos - totalFinanciar) > 0.01 ? 'text-red-500' : 'text-emerald-600'}`}>
                      {getMonedaSimbolo(moneda)} {formatCurrencyValue(totalMontoCuotasYRefuerzos, moneda)}
                    </span>
                  </div>
                  <span className="text-slate-300 font-black text-lg">/</span>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Total Original a Financiar</span>
                    <span className="text-sm font-black text-slate-800">
                      {getMonedaSimbolo(moneda)} {formatCurrencyValue(totalFinanciar, moneda)}
                    </span>
                  </div>
                </div>
                {Math.abs(totalMontoCuotasYRefuerzos - totalFinanciar) > 0.01 ? (
                  <div className="text-[10px] font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 flex items-center gap-2 mt-3 sm:mt-0">
                    ⚠️ Hay una diferencia de {getMonedaSimbolo(moneda)} {formatCurrencyValue(Math.abs(totalFinanciar - totalMontoCuotasYRefuerzos), moneda)}
                  </div>
                ) : (
                  <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 flex items-center gap-2 mt-3 sm:mt-0">
                    <CheckCircle className="w-3 h-3" />
                     Suma Coincide
                  </div>
                )}
              </div>

              {/* Autoregenerate schedule link */}
              <div className="text-right mt-4">
                <button
                  type="button"
                  onClick={handleSmartRecalculate}
                  className="text-[11px] font-black uppercase text-[#FF3131] hover:underline"
                >
                  [ Re-ajustar montos automáticamente ]
                </button>
              </div>
            </section>
          </div>
          {/* Validation & Actions sidebar */}
          <div className="xl:col-span-1 space-y-8">
            
            {/* Real-time financial checker */}
            <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden flex flex-col space-y-6">
              <div className="absolute right-0 top-0 w-32 h-32 bg-slate-800 rounded-full blur-3xl opacity-50"></div>
              
              <h3 className="text-sm font-black uppercase text-[#FF3131] tracking-widest relative z-10">Validación Crítica del Crédito</h3>

              <div className="divide-y divide-slate-800 text-xs font-medium relative z-10 space-y-4">
                {/* 1. ENTREGA INICIAL */}
                {tipoNegociacion.includes('entrega') && (
                  <div className="flex justify-between items-center pt-4">
                    <span className="text-slate-400">Entrega Inicial (Mismo Acto):</span>
                    <span className="font-mono font-bold text-white">{getMonedaSimbolo(moneda)} {formatCurrencyValue(deliveryMonto, moneda)}</span>
                  </div>
                )}

                {/* 2. CUOTAS NORMALES */}
                <div className="flex justify-between items-center pt-4">
                  <span className="text-slate-400">Total Cuotas Normales ({cantidadCuotasNormales} pagos):</span>
                  <span className="font-mono font-bold text-amber-400">{getMonedaSimbolo(moneda)} {formatCurrencyValue(sumaTotalCuotasNormales, moneda)}</span>
                </div>

                {/* 3. REFUERZOS */}
                {cantidadRefuerzos > 0 && (
                  <div className="flex justify-between items-center pt-4">
                    <span className="text-slate-400">Total Refuerzos ({cantidadRefuerzos} pagos):</span>
                    <span className="font-mono font-bold text-amber-400">{getMonedaSimbolo(moneda)} {formatCurrencyValue(sumaTotalRefuerzos, moneda)}</span>
                  </div>
                )}

                {/* 4. SUMA CONSOLIDADA */}
                <div className="flex justify-between items-center pt-4 font-extrabold text-[14px] border-t border-slate-800">
                  <span className="text-slate-300">Suma Consolidada (Entrega + Cuotas + Refuerzos):</span>
                  <span className="font-mono text-base text-white">{getMonedaSimbolo(moneda)} {formatCurrencyValue(sumaTotalCalculada, moneda)}</span>
                </div>

                {/* 5. VALOR DECLARADO PAGARÉ */}
                <div className="flex justify-between items-center pt-4 font-black">
                  <span className="text-[#FF3131]">Valor Declarado Pagaré:</span>
                  <span className="font-mono text-base text-[#FF3131]">{getMonedaSimbolo(moneda)} {formatCurrencyValue(declaredTotalVal, moneda)}</span>
                </div>
              </div>

              {/* Checklist validator status */}
              <div className={`p-4 rounded-2xl relative z-10 border ${isValidationMatch ? 'bg-green-950/40 border-green-800 text-green-300' : 'bg-red-950/40 border-red-900 text-red-300'}`}>
                {isValidationMatch ? (
                  <div className="flex items-center gap-2.5">
                    <CheckCircle className="w-5 h-5 shrink-0 text-green-400" />
                    <div>
                      <p className="font-bold text-xs">Cuentas Correctas ✅</p>
                      <p className="text-[10px] opacity-70 mt-0.5">La suma teórica coincide perfectamente con la amortización.</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5 animate-bounce" />
                    <div>
                      <p className="font-bold text-xs">Error de Cuadre 🚨</p>
                      <p className="text-[10px] opacity-70 mt-1 leading-relaxed">
                        Fórmula: entrega_inicial + ∑(vencimientos) = valor_total. <br />
                        Diferencia detectada de {getMonedaSimbolo(moneda)} {formatCurrencyValue(declaredTotalVal - sumaTotalCalculada, moneda)}. Edite las cuotas.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Error messages from validation */}
              {formError && (
                <div className="bg-red-50 text-red-600 border border-red-200 p-4 rounded-xl text-xs font-bold animate-pulse">
                  <AlertTriangle className="w-4 h-4 inline-block mr-2 -mt-0.5" />
                  {formError}
                </div>
              )}

              {/* Botón generar pagaré */}
              <button
                type="button"
                onClick={handleCreateNewPagare}
                className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-center transition-all bg-[#FF3131] text-white hover:bg-red-600 active:scale-95 shadow-lg shadow-red-500/20`}
              >
                {editingPagareId ? 'Actualizar Pagaré' : 'Generar & Validar Pagaré'}
              </button>
            </div>

            {/* Quick Helper guidelines */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm text-xs font-medium space-y-3">
              <h4 className="font-black uppercase tracking-wider text-slate-800">Marco Legal de Garantías</h4>
              <p className="text-slate-500 leading-normal">
                Todas las firmas son recopiladas bajo las solemnidades del Certificado de Firmas del Notario de la Escribanía Pública.
              </p>
              <ul className="space-y-1 text-slate-400 bullet">
                <li>• No puede haber duplicidad de cédula</li>
                <li>• Representantes deben firmar por sociedades jurídicas</li>
                <li>• Cronogramas son legalmente vinculantes</li>
              </ul>
            </div>

          </div>

        </div>
      )}

      {/* QUICK ADD PERSONA MODAL */}
      {showQuickAddPersonaModal && createPortal(
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-md w-full box-border shadow-2xl border border-slate-100 space-y-6">
            <div className="border-b border-slate-50 pb-3">
              <h3 className="text-base font-extrabold text-slate-800 uppercase tracking-widest">
                Crear Persona para {quickPersonaTargetField?.toUpperCase()}
              </h3>
              <p className="text-xs text-slate-400 mt-1">Registre los datos correspondientes en la base de datos unificada.</p>
            </div>

            <div className="space-y-4">
              {/* Tipo Persona */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Clasificación</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setQuickTipoPersona('física'); setQuickTipoDoc('CI'); }}
                    className={`py-1.5 text-xs font-bold rounded-xl border ${quickTipoPersona === 'física' ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                  >
                    Física
                  </button>
                  <button
                    type="button"
                    onClick={() => { setQuickTipoPersona('jurídica'); setQuickTipoDoc('RUC'); }}
                    className={`py-1.5 text-xs font-bold rounded-xl border ${quickTipoPersona === 'jurídica' ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                  >
                    Jurídica
                  </button>
                </div>
              </div>

              {/* Nombre completo */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">
                  {quickTipoPersona === 'física' ? 'Nombre(s)' : 'Razón Social'}
                </label>
                <input  autoComplete="nope"
                  type="text"
                  value={quickNombre}
                  onChange={(e) => setQuickNombre(e.target.value)}
                  placeholder="Ej. Juan José o Constructora S.A."
                  className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none"
                />
              </div>

              {quickTipoPersona === 'física' && (
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Apellido(s)</label>
                  <input  autoComplete="nope"
                    type="text"
                    value={quickApellido}
                    onChange={(e) => setQuickApellido(e.target.value)}
                    placeholder="Ej. Benítez Silva"
                    className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none"
                  />
                </div>
              )}

              {/* Documento */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Doc</label>
                  <select
                    value={quickTipoDoc}
                    onChange={(e) => setQuickTipoDoc(e.target.value as TipoDocumento)}
                    className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl px-1.5 py-2 text-xs font-bold outline-none"
                  >
                    <option value="CI">C.I.</option>
                    <option value="RUC">R.U.C.</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Número único (CI / RUC)</label>
                  <div className="relative">
                    <input  autoComplete="nope"
                      type="text"
                      value={quickNroDoc}
                      onChange={(e) => setQuickNroDoc(formatCI(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleConsultarQuickDnit();
                        }
                      }}
                      placeholder="Ej. 1234567 o 80012345-6"
                      className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 pr-20 text-xs font-medium outline-none"
                    />
                    <button
                      type="button"
                      disabled={loadingQuickDnit}
                      onClick={() => handleConsultarQuickDnit()}
                      className={`absolute right-1.5 top-1 px-2.5 py-1 ${
                        isDnitBlocked 
                          ? 'bg-slate-400 text-slate-100 hover:bg-slate-500 cursor-pointer' 
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      } disabled:bg-slate-400 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors shadow-xs`}
                      title={isDnitBlocked ? "⚠️ Consulta bloqueada: Requiere un plan activo o periodo de prueba vigente para utilizar la conexión con el DNIT." : "Consultar documento en DNIT"}
                    >
                      {loadingQuickDnit ? (
                        <Loader2 className="w-3 h-3 animate-spin text-white" />
                      ) : isDnitBlocked ? (
                        <Lock className="w-3 h-3 text-white/90" />
                      ) : (
                        <Search className="w-3 h-3 text-white" />
                      )}
                      <span>DNIT</span>
                    </button>
                  </div>
                  {loadingQuickDnit && (
                    <div className="mt-1 p-1 bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1 text-[10px] font-bold text-slate-800 animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin text-[#FF3131]" />
                      <span>Consultando registro DNIT...</span>
                    </div>
                  )}
                  {feedbackQuickDnit && !loadingQuickDnit && (
                    <p className={`mt-1 text-[10px] font-bold px-2 py-1 rounded-lg border leading-tight ${
                      feedbackQuickDnit.includes('⚠️') 
                        ? 'bg-amber-50 text-amber-900 border-amber-200' 
                        : 'text-slate-700 bg-slate-100 border-slate-200'
                    }`}>
                      {feedbackQuickDnit}
                    </p>
                  )}
                </div>
              </div>

              {/* Representante legal (juridica quick) */}
              {quickTipoPersona === 'jurídica' && (
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Representante Legal (Física)</label>
                  <select
                    value={quickRepId}
                    onChange={(e) => setQuickRepId(e.target.value)}
                    className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none"
                  >
                    <option value="">-- Seleccionar --</option>
                    {personas.filter(p => p.tipo_persona === 'física').map(p => (
                      <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>
                    ))}
                  </select>
                </div>
              )}

              {quickError && (
                <p className="text-[11px] font-bold text-red-500 bg-red-50 p-2 rounded-xl border border-red-100">{quickError}</p>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t border-slate-50">
              <button
                type="button"
                onClick={() => setShowQuickAddPersonaModal(false)}
                className="px-4 py-2 bg-slate-100 font-bold rounded-xl text-[10px] uppercase tracking-wider text-slate-500"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={submitQuickPersona}
                className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl text-[10px] uppercase tracking-wider"
              >
                Insertar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {pagareToAnular && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-gray-900 border border-red-500 rounded-xl p-6 max-w-md w-full shadow-2xl relative">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-red-500">¿Estás seguro de eliminar este pagaré?</h3>
              <p className="text-sm text-gray-300">
                Esta acción eliminará por completo todas las cuotas del cronograma y el registro financiero asociado. Esta operación es irreversible.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full mt-6">
                <button
                  type="button"
                  onClick={() => setPagareToAnular(null)}
                  className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg transition-colors border border-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const docRef = doc(db, 'pagares', pagareToAnular.id);
                      await updateDoc(docRef, { status: 'anulado', anuladoAt: new Date().toISOString() });
                      console.log('Documento eliminado exitosamente en Firebase.');
                      setPagareToAnular(null);
                    } catch (error) {
                      console.error("Fallo al eliminar en Firebase:", error);
                    }
                  }}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors shadow-lg shadow-red-500/20"
                >
                  Sí, eliminar y borrar todo
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Doble Validación de Cobro Notarial */}
      {cuotaParaCobrar && createPortal(
        <div 
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => { if (!isCobrandoCuota) setCuotaParaCobrar(null); }}
        >
          <div 
            className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center text-emerald-600 shadow-inner">
                <ShieldCheck className="w-8 h-8 text-emerald-600" />
              </div>
              
              <h3 className="text-xl font-bold font-serif text-slate-800">
                Confirmar Cobro Notarial
              </h3>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 w-full text-left space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Pagaré Correlativo:</span>
                  <span className="font-mono font-bold text-slate-700">N° {cuotaParaCobrar.pagare.correlativo}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Cuota a Cobrar:</span>
                  <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    {cuotaParaCobrar.cuotaNum === 'TOTALIDAD' ? 'Pago Total' : `Cuota N° ${cuotaParaCobrar.cuotaNum}`}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-sm">
                  <span className="font-bold text-slate-700">Importe a Percibir:</span>
                  <span className="font-mono font-black text-emerald-700 text-base">
                    {getMonedaSimbolo(cuotaParaCobrar.pagare.moneda)} {formatCurrencyValue(cuotaParaCobrar.monto, cuotaParaCobrar.pagare.moneda)}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                ¿Confirma la recepción del pago por la <strong className="text-slate-700">{cuotaParaCobrar.cuotaNum === 'TOTALIDAD' ? 'totalidad del pagaré' : `Cuota ${cuotaParaCobrar.cuotaNum}`}</strong> correspondiente a <strong className="text-slate-800 font-mono">{getMonedaSimbolo(cuotaParaCobrar.pagare.moneda)} {formatCurrencyValue(cuotaParaCobrar.monto, cuotaParaCobrar.pagare.moneda)}</strong>? Esta acción actualizará formalmente el cronograma y el estado del documento.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full pt-2">
              <button
                type="button"
                disabled={isCobrandoCuota}
                onClick={() => setCuotaParaCobrar(null)}
                className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors border border-slate-200 text-xs sm:text-sm cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isCobrandoCuota}
                onClick={async () => {
                  try {
                    setIsCobrandoCuota(true);
                    const { pagare, index } = cuotaParaCobrar;
                    const docRef = doc(db, 'pagares', pagare.id);

                    if (pagare.cronograma && pagare.cronograma.length > 0 && index !== -1) {
                      const newCronograma = [...pagare.cronograma];
                      newCronograma[index] = {
                        ...newCronograma[index],
                        estado: 'cobrado',
                        pagado: true,
                        fecha_cobro: new Date().toISOString()
                      };
                      const allPaid = newCronograma.every((c: any) => c.estado === 'cobrado' || c.pagado === true);
                      const updates: any = {
                        cronograma: newCronograma,
                        status: allPaid ? 'cobrado' : 'pendiente',
                        estado: allPaid ? 'Cobrado' : 'Pendiente'
                      };
                      if (allPaid) {
                        updates.cobradoAt = new Date().toISOString();
                      } else {
                        updates.cobradoAt = null;
                      }
                      await updateDoc(docRef, updates);
                      console.log(`Cuota ${newCronograma[index].numero_cuota} de ${pagare.id} cobrada exitosamente.`);
                    } else {
                      await updateDoc(docRef, {
                        status: 'cobrado',
                        estado: 'Cobrado',
                        cobradoAt: new Date().toISOString()
                      });
                      console.log(`Documento ${pagare.id} cobrado en su totalidad exitosamente.`);
                    }

                    setCuotaParaCobrar(null);
                  } catch (error) {
                    console.error("Fallo al registrar cobro en Firebase:", error);
                  } finally {
                    setIsCobrandoCuota(false);
                  }
                }}
                className="flex-1 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20 text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isCobrandoCuota ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Registrando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirmar Pago</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {supportCopiedToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white border border-slate-700 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-[#FF3131]" />
          <span>{supportCopiedToast}</span>
        </div>
      )}

      {selectedPagareForDetail && (
        <ModalDetallePagare
          isOpen={!!selectedPagareForDetail}
          onClose={() => setSelectedPagareForDetail(null)}
          pagare={selectedPagareForDetail}
          personas={personas}
          onOpenPDFPreview={(p) => handleAbrirPagare(p)}
          userData={userData}
        />
      )}

    </div>
  );
};

