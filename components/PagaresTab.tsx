import { db } from '../services/auth';
import { doc, updateDoc } from 'firebase/firestore';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Pagare, Persona, FrecuenciaConfig, MonedaConfig, GlobalConfig, TipoNegociacion, PaymentScheduleItem, TipoCronogramaItem, formatCurrencyValue, TipoDocumento } from '../types';
import { Plus, Trash2, Calendar, DollarSign, Users, FileText, CheckCircle, AlertTriangle, Search, ShieldCheck, ScanLine, Loader2 } from 'lucide-react';
import { NumericFormat } from 'react-number-format';
import { analyzePagareImage } from '../services/gemini';

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
  initialPanelView = 'list',
  initialEditingId = null,
  onClose
}) => {
  // Navigation tabs for Pagares tab list vs creation form
  const [panelView, setPanelView] = useState<'list' | 'list_anulados' | 'create'>(initialPanelView);
  const [formError, setFormError] = useState<string | null>(null);
  const [pagareToAnular, setPagareToAnular] = useState<any>(null); // We use any because Pagare type is somewhat complex or missing in scope

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

  // Selected Personas
  const [acreedorNombreRaw, setAcreedorNombreRaw] = useState('');
  const [acreedorDocumentoRaw, setAcreedorDocumentoRaw] = useState('');
  const [acreedorDomicilioRaw, setAcreedorDomicilioRaw] = useState('');
  const [deudorNombreRaw, setDeudorNombreRaw] = useState('');
  const [deudorDocumentoRaw, setDeudorDocumentoRaw] = useState('');
  const [deudorDomicilioRaw, setDeudorDomicilioRaw] = useState('');

  const [deudorId, setDeudorId] = useState('');
  const [codeudor1Id, setCodeudor1Id] = useState('');
  const [codeudor2Id, setCodeudor2Id] = useState('');

  // Refuerzos states: raw arrays used before generating schedule unificado
  // Reinforcement items: { monto: number, fecha: string }
  const [refuerzosRaw, setRefuerzosRaw] = useState<{ id: string; monto: number | string; fecha: string }[]>([
    { id: 'r-init', monto: '', fecha: getOneMonthLaterDateString() }
  ]);

  // Integrated unified schedule array
  const [cronograma, setCronograma] = useState<PaymentScheduleItem[]>([]);

  // quick add persona logic
  const [showQuickAddPersonaModal, setShowQuickAddPersonaModal] = useState(false);
  const [quickPersonaTargetField, setQuickPersonaTargetField] = useState<'deudor' | 'codeudor1' | 'codeudor2' | null>(null);
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
        if (parsed.acreedorNombreRaw) setAcreedorNombreRaw(parsed.acreedorNombreRaw);
        if (parsed.acreedorDocumentoRaw) setAcreedorDocumentoRaw(parsed.acreedorDocumentoRaw);
        if (parsed.acreedorDomicilioRaw) setAcreedorDomicilioRaw(parsed.acreedorDomicilioRaw);
        if (parsed.deudorNombreRaw) setDeudorNombreRaw(parsed.deudorNombreRaw);
        if (parsed.deudorDocumentoRaw) setDeudorDocumentoRaw(parsed.deudorDocumentoRaw);
        if (parsed.deudorDomicilioRaw) setDeudorDomicilioRaw(parsed.deudorDomicilioRaw);
        if (parsed.deudorId) setDeudorId(parsed.deudorId);
        if (parsed.codeudor1Id) setCodeudor1Id(parsed.codeudor1Id);
        if (parsed.codeudor2Id) setCodeudor2Id(parsed.codeudor2Id);
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
      acreedorNombreRaw,
      acreedorDocumentoRaw,
      acreedorDomicilioRaw,
      deudorNombreRaw,
      deudorDocumentoRaw,
      deudorDomicilioRaw,
      deudorId,
      codeudor1Id,
      codeudor2Id,
      refuerzosRaw,
      cronograma
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [
    hasLoadedDraft, panelView,
    tipoNegociacion, moneda, certificadoFirmasNro, valorTotalStr,
    frecuenciaId, fechaPrimerPago, entregaInicialStr, fechaEntregaInicial,
    conceptoEntregaInicial, duracionMeses, acreedorNombreRaw, acreedorDocumentoRaw,
    acreedorDomicilioRaw, deudorNombreRaw, deudorDocumentoRaw, deudorDomicilioRaw,
    deudorId, codeudor1Id, codeudor2Id, refuerzosRaw, cronograma
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
    const daysInterval = freqObj ? freqObj.intervalo_dias : 30;

    let baseCronograma: PaymentScheduleItem[] = [];

    // Let's deduce schedule based on negotiation type:
    // A. "entrega_refuerzo_cuota"
    // B. "cuotas_corridas"
    // C. "cuotas_refuerzos"
    // D. "entrega_cuotas"

    let firstPaymentDate = new Date(fechaPrimerPago + "T12:00:00");
    if (isNaN(firstPaymentDate.getTime())) {
      firstPaymentDate = new Date(); // fallback to today if invalid
    }

    const parsedDuracion = Number(duracionMeses) || 12;
    let defaultInstallmentCount = parsedDuracion;
    if (freqObj) {
      if (freqObj.intervalo_dias === 30) {
        defaultInstallmentCount = parsedDuracion;
      } else if (freqObj.intervalo_dias === 15) {
        defaultInstallmentCount = parsedDuracion * 2;
      } else if (freqObj.intervalo_dias === 7) {
        defaultInstallmentCount = Math.round((parsedDuracion * 30.4166) / 7);
      } else if (freqObj.intervalo_dias === 180) {
        defaultInstallmentCount = Math.max(1, Math.round(parsedDuracion / 6));
      } else if (freqObj.intervalo_dias === 365) {
        defaultInstallmentCount = Math.max(1, Math.round(parsedDuracion / 12));
      } else {
        defaultInstallmentCount = Math.max(1, Math.round((parsedDuracion * 30.4166) / freqObj.intervalo_dias));
      }
    }

    const calculateItemDate = (baseDate, index) => {
      const d = new Date(baseDate);
      if (freqObj?.intervalo_dias === 30) {
        d.setMonth(baseDate.getMonth() + index);
      } else if (freqObj?.intervalo_dias === 180) {
        d.setMonth(baseDate.getMonth() + (index * 6));
      } else if (freqObj?.intervalo_dias === 365) {
        d.setFullYear(baseDate.getFullYear() + index);
      } else {
        d.setDate(baseDate.getDate() + (index * daysInterval));
      }
      return d;
    };

    if (tipoNegociacion === 'cuotas_corridas' || tipoNegociacion === 'entrega_cuotas') {
      // STRAIGHT INSTALLMENTS ONLY
      const installmentVal = Number((remainingAmount / defaultInstallmentCount).toFixed(2));

      for (let i = 0; i < defaultInstallmentCount; i++) {
        const itemDate = calculateItemDate(firstPaymentDate, i);
        
        let actualMonto = installmentVal;
        // Make sure last installment covers rounding differences
        if (i === defaultInstallmentCount - 1) {
          actualMonto = remainingAmount - (installmentVal * (defaultInstallmentCount - 1));
        }

        // Fix float precision issues (e.g. 165.000000000002)
        actualMonto = Number(parseFloat(actualMonto.toString()).toFixed(2));

        baseCronograma.push({
          id: `sch-draft-${Date.now()}-${i}`,
          pagare_id: 'draft',
          tipo: 'cuota',
          fecha_pag: itemDate.toISOString().split('T')[0],
          monto: Math.max(0, actualMonto),
          numero_cuota: '' // will be determined by sorting/numbering helper
        });
      }
    } else {
      // WITH REINFORCEMENTS
      // R1 is mandatory. Let's merge reinforcements and calculate remainder for installments
      const totalRefuerzosMonto = refuerzosRaw.reduce((sum, r) => sum + (Number(r.monto) || 0), 0);
      const remainingForCuotas = remainingAmount - totalRefuerzosMonto;

      // Map reinforcements as draft items
      refuerzosRaw.forEach((ref, idx) => {
        baseCronograma.push({
          id: `sch-draft-ref-${idx}-${Date.now()}`,
          pagare_id: 'draft',
          tipo: 'refuerzo',
          fecha_pag: ref.fecha,
          monto: Number(ref.monto) || 0,
          numero_cuota: `R${idx + 1}`
        });
      });

      const cuotaMonto = Math.max(0, Number((remainingForCuotas / defaultInstallmentCount).toFixed(2)));

      for (let i = 0; i < defaultInstallmentCount; i++) {
        const itemDate = calculateItemDate(firstPaymentDate, i);

        let actualMonto = cuotaMonto;
        if (i === defaultInstallmentCount - 1) {
          actualMonto = Math.max(0, remainingForCuotas - (cuotaMonto * (defaultInstallmentCount - 1)));
        }

        // Fix float precision issues
        actualMonto = Number(parseFloat(actualMonto.toString()).toFixed(2));

        baseCronograma.push({
          id: `sch-draft-cuota-${i}-${Date.now()}`,
          pagare_id: 'draft',
          tipo: 'cuota',
          fecha_pag: itemDate.toISOString().split('T')[0],
          monto: actualMonto,
          numero_cuota: '' // Re-assigned afterwards
        });
      }
    }

    // Always sort and assign correct numbering identifiers
    const normalized = resequenceSchedule(baseCronograma);
    setCronograma(normalized);
  };

  const resequenceSchedule = (arr: PaymentScheduleItem[]): PaymentScheduleItem[] => {
    // Sort chronologically
    const sorted = [...arr].sort((a, b) => new Date(a.fecha_pag).getTime() - new Date(b.fecha_pag).getTime());

    let cuotaCounter = 1;
    let refuerzoCounter = 1;

    return sorted.map(item => {
      if (item.tipo === 'cuota') {
        const num = `${cuotaCounter}`;
        cuotaCounter++;
        return { ...item, numero_cuota: num };
      } else {
        const num = `R${refuerzoCounter}`;
        refuerzoCounter++;
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
    const useDecimals = moneda !== 'PYG' && moneda !== 'BRL';
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
      fecha: getOneMonthLaterDateString()
    };
    setRefuerzosRaw([...refuerzosRaw, newRef]);
  };

  const handleRemoveRawRefuerzo = (idToDel: string) => {
    if (refuerzosRaw.length <= 1) {
      console.error('Se requiere por lo menos un refuerzo obligatorio R1.');
      return;
    }
    setRefuerzosRaw(refuerzosRaw.filter(r => r.id !== idToDel));
  };

  const handleRawRefuerzoChange = (id: string, field: 'monto' | 'fecha', val: any) => {
    setRefuerzosRaw(refuerzosRaw.map(r => {
      if (r.id === id) {
        return { ...r, [field]: field === 'monto' ? (val === '' || val === undefined ? '' : parseFloat(val) || 0) : val };
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
    setRefuerzosRaw([{ id: `r-init-${Date.now()}`, monto: '', fecha: getOneMonthLaterDateString() }]);
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
    setAcreedorDocumentoRaw(formatCI(pag.acreedor_documento_raw || ''));
    setAcreedorDomicilioRaw(pag.acreedor_domicilio_raw || '');
    
    setDeudorNombreRaw(pag.deudor_nombre_raw || '');
    setDeudorDocumentoRaw(formatCI(pag.deudor_documento_raw || ''));
    setDeudorDomicilioRaw(pag.deudor_domicilio_raw || '');
    setDeudorId(pag.deudor_id || '');
    
    setCodeudor1Id(pag.codeudor1_id || '');
    setCodeudor2Id(pag.codeudor2_id || '');
    
    setCronograma(pag.cronograma || []);
    setDuracionMeses(pag.cronograma.length);
    setPanelView('create');
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
      acreedor_nombre_raw: acreedorNombreRaw.trim(),
      acreedor_documento_raw: acreedorDocumentoRaw.trim(),
      acreedor_domicilio_raw: acreedorDomicilioRaw.trim(),
      deudor_id: deudorId || undefined,
      deudor_nombre_raw: deudorNombreRaw.trim(),
      deudor_documento_raw: deudorDocumentoRaw.trim(),
      deudor_domicilio_raw: deudorDomicilioRaw.trim(),
      codeudor1_id: codeudor1Id || undefined,
      codeudor2_id: codeudor2Id || undefined,
      cronograma: cronograma.map(item => ({ ...item, pagare_id: existingPagare ? item.pagare_id || existingPagare.id : 'pag-' + Date.now() })),
      created_at: existingPagare?.created_at || new Date().toISOString(),
      creator_role: existingPagare?.creator_role || (isAdmin ? 'admin' : 'usuario')
    };

    if (editingPagareId && onUpdatePagare) {
      onUpdatePagare(finalPagare);
    } else {
      onAddPagare(finalPagare);
    }
    
    setEditingPagareId(null);
    
    // Clear the form
    setCertificadoFirmasNro('');
    setValorTotalStr('1500000');
    setAcreedorNombreRaw('');
    setAcreedorDocumentoRaw('');
    setAcreedorDomicilioRaw('');
    setDeudorNombreRaw('');
    setDeudorDocumentoRaw('');
    setDeudorDomicilioRaw('');
    setDeudorId('');
    setCodeudor1Id('');
    setCodeudor2Id('');

    // Remove the autosave draft
    localStorage.removeItem(DRAFT_KEY);

    // Switch view and open preview
    if (onClose) {
      onClose();
    } else {
      setPanelView('list');
    }
    onSelectPagareForPreview(finalPagare);
  };

  // Quick Persona Create popup handlers
  const openQuickAddPersona = (roleTarget: 'deudor' | 'codeudor1' | 'codeudor2') => {
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

    // Set value to target selector
    if (quickPersonaTargetField === 'deudor') setDeudorId(newQuick.id);
    else if (quickPersonaTargetField === 'codeudor1') setCodeudor1Id(newQuick.id);
    else if (quickPersonaTargetField === 'codeudor2') setCodeudor2Id(newQuick.id);

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
    <div className="space-y-4 md:space-y-8 animate-message" id="pagares-tab-panel">
      {/* HUD Tracker Hub */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="relative z-10 text-center md:text-left">
          <h2 className="text-white text-xl md:text-2xl font-black font-serif flex items-center justify-center md:justify-start gap-3">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
            Central de Documentos PJE
          </h2>
          <p className="text-slate-400 text-xs md:text-sm mt-1 max-w-sm">
            Panel principal para la gestión y redacción de pagarés oficiales para la {config.escribania.nombre}.
          </p>
        </div>
        <div className="flex items-center gap-4 relative z-10 w-full box-border md:w-auto">
          <div className="flex-1 md:flex-none bg-slate-800/80 border border-slate-700/50 rounded-3xl p-4 flex items-center justify-between md:justify-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div className="text-right md:text-left pr-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pagarés</p>
              <p className="text-2xl font-black text-white leading-none">{pagares.length}</p>
            </div>
          </div>
          <div className="flex-1 md:flex-none bg-slate-800/80 border border-slate-700/50 rounded-3xl p-4 flex items-center justify-between md:justify-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div className="text-right md:text-left pr-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Personas</p>
              <p className="text-2xl font-black text-white leading-none">{personas.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab selection inside Pagares panel */}
      <div className="flex flex-col lg:flex-row justify-between items-center bg-white p-2 sm:p-3 rounded-3xl border border-slate-100 shadow-sm gap-2">
        <div className="flex flex-wrap justify-center gap-3 w-full box-border lg:w-auto bg-slate-50 p-1 rounded-2xl">
          <button
            onClick={() => { setPanelView('list'); setEditingPagareId(null); }}
            className={`flex-1 lg:flex-none px-3 sm:px-6 py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${panelView === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Activos ({pagares.filter(p => p.status !== 'anulado').length})
          </button>
          <button
            onClick={() => { setPanelView('list_anulados'); setEditingPagareId(null); }}
            className={`flex-1 lg:flex-none px-3 sm:px-6 py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${panelView === 'list_anulados' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Anulados ({pagares.filter(p => p.status === 'anulado').length})
          </button>
          <button
            onClick={() => {
              handleClearForm();
            }}
            className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-6 py-2.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all shadow-sm ${panelView === 'create' ? 'bg-[#FF3131] text-white' : 'bg-red-50 text-[#FF3131] hover:bg-[#FF3131] hover:text-white border border-red-100'}`}
          >
            <Plus className="w-4 h-4" /> Redactar Nuevo
          </button>
        </div>
        {isAdmin && (
          <div className="flex w-full box-border lg:w-auto justify-end items-center px-1">
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
              className="flex w-full box-border lg:w-auto justify-center items-center gap-2 bg-[#FF3131] hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-sm transition-all disabled:opacity-50"
              title="Sube una foto o PDF de un Pagaré físico para autocompletar este formulario"
            >
              {isScanning ? <Loader2 className="w-4 h-4 animate-spin"/> : <ScanLine className="w-4 h-4" />}
              Escanear Autofill IA
            </button>
          </div>
        )}
      </div>

      {panelView === 'list' || panelView === 'list_anulados' ? (
        /* LIST VIEW OF CREATED PROMISSORY NOTES */
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-md">
          <div className="pb-6 border-b border-slate-50 mb-6">
            <h2 className="text-2xl font-bold font-serif text-slate-800">Caja Registradora de Pagarés</h2>
            <p className="text-sm text-slate-500 mt-1">
              Documentos generados y autorizados administrativamente. Haga clic sobre cualquiera para abrir la Certificación de Firmas e Impresión Oficial.
            </p>
          </div>

          {pagares.length === 0 ? (
            <div className="py-24 text-center bg-slate-50 border border-dashed rounded-3xl border-slate-200">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="font-bold text-slate-600 text-base">No hay pagarés activos registrados.</p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(panelView === 'list' ? pagares.filter(p => p.status !== 'anulado') : pagares.filter(p => p.status === 'anulado')).map((pag) => {
                const acreedor = personas.find(p => p.id === pag.acreedor_id);
                const deudor = personas.find(p => p.id === pag.deudor_id);
                let badgeStatus: 'vencido' | 'proximo' | 'al_dia' | 'pagado' | null = null;
                let nextDueDate: Date | null = null;

                if (pag.cronograma && pag.cronograma.length > 0) {
                  const today = new Date();
                  today.setHours(0,0,0,0);
                  
                  const pendingCuotas = pag.cronograma.filter(c => c.estado !== 'cobrado' && !c.pagado);
                  
                  if (pendingCuotas.length === 0) {
                    badgeStatus = 'pagado';
                  } else {
                    let hasVencido = false;
                    let hasProximo = false;
                    
                    pendingCuotas.sort((a, b) => new Date(a.fecha_pag).getTime() - new Date(b.fecha_pag).getTime());
                    
                    const nextC = pendingCuotas[0];
                    const cDate = new Date(nextC.fecha_pag);
                    const parts = nextC.fecha_pag.split('-');
                    if (parts.length === 3) {
                      cDate.setFullYear(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    }
                    cDate.setHours(0,0,0,0);
                    nextDueDate = cDate;

                    for (const c of pendingCuotas) {
                      const cDateLoop = new Date(c.fecha_pag);
                      const partsL = c.fecha_pag.split('-');
                      if (partsL.length === 3) {
                        cDateLoop.setFullYear(parseInt(partsL[0]), parseInt(partsL[1]) - 1, parseInt(partsL[2]));
                      }
                      cDateLoop.setHours(0,0,0,0);
                      const diffDays = Math.ceil((cDateLoop.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      
                      if (diffDays < 0) {
                        hasVencido = true;
                      } else if (diffDays <= 5) {
                        hasProximo = true;
                      }
                    }

                    if (hasVencido) badgeStatus = 'vencido';
                    else if (hasProximo) badgeStatus = 'proximo';
                    else badgeStatus = 'al_dia';
                  }
                }

                return (
                  <div
                    key={pag.id}
                    onClick={() => onSelectPagareForPreview(pag)}
                    className={`p-6 rounded-3xl border transition-all cursor-pointer group shadow-sm hover:shadow-xl relative flex flex-col justify-between ${
                      badgeStatus === 'vencido' 
                        ? 'bg-red-50 border-red-400 hover:border-red-500' 
                        : badgeStatus === 'proximo'
                          ? 'bg-amber-50 border-amber-400 hover:border-amber-500'
                          : (badgeStatus === 'al_dia' || badgeStatus === 'pagado')
                            ? 'bg-emerald-50 border-emerald-400 hover:border-emerald-500'
                            : 'bg-slate-50 border-slate-200/50 hover:border-[#FF3131]'
                    }`}
                  >
                    {badgeStatus === 'vencido' && (
                      <div className="absolute -top-3 -right-3 bg-red-600 text-white text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg border border-white flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="w-3 h-3" />
                        Vencido
                      </div>
                    )}
                    {badgeStatus === 'proximo' && (
                      <div className="absolute -top-3 -right-3 bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg border border-white flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Próximo
                      </div>
                    )}
                    {badgeStatus === 'al_dia' && (
                      <div className="absolute -top-3 -right-3 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg border border-white flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Al Día
                      </div>
                    )}
                    {badgeStatus === 'pagado' && (
                      <div className="absolute -top-3 -right-3 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full shadow-lg border border-white flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Pagado
                      </div>
                    )}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#FF3131]">
                          Nro. Correlativo: {pag.correlativo}
                        </span>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const pendingIndex = pag.cronograma?.findIndex((c: any) => c.estado !== 'cobrado' && c.pagado !== true) ?? -1;
                            if (pendingIndex !== -1 && pag.cronograma) {
                              return (
                                <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-md border border-indigo-200 tracking-widest uppercase">
                                  Cuota Vigente: {pag.cronograma[pendingIndex].numero_cuota} de {pag.cronograma.length}
                                </span>
                              );
                            }
                            return null;
                          })()}
                          <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-white text-slate-600 border border-slate-200">
                            {getTipoNegociacionLabel(pag.tipo_negociacion)}
                          </span>
                        </div>
                      </div>

                      <h3 className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight group-hover:text-[#FF3131] transition-colors">
                        {getMonedaSimbolo(pag.moneda)} {formatCurrencyValue(pag.valor_total || (pag as any).monto || 0, pag.moneda)}
                      </h3>

                      <div className="grid grid-cols-2 gap-4 mt-6 text-xs text-slate-600">
                        <div>
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Acreedor</p>
                          <p className="font-bold text-slate-800 truncate">{pag.acreedor_nombre_raw || acreedor?.nombre || (pag as any).nombreAcreedor || "Buscando datos..."}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Deudor Principal</p>
                          <p className="font-bold text-slate-800 truncate">{pag.deudor_nombre_raw || deudor?.nombre || (pag as any).nombreDeudor || "Buscando datos..."}</p>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-200/40 text-xs text-slate-500 space-y-1">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <p className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>Emisión: {new Date(pag.created_at).toLocaleDateString()}</span>
                          </p>
                          {nextDueDate && (
                            <p className="flex items-center gap-2 text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Próximo Venc: {nextDueDate.toLocaleDateString()}</span>
                            </p>
                          )}
                        </div>
                        {(userData?.tipoPerfil === 'Escribanía Pública' || pag.certificado_firmas_nro) && (
                          <p className="flex items-center gap-2">
                            <ShieldCheck className={pag.certificado_firmas_nro ? "w-3.5 h-3.5 text-green-600" : "w-3.5 h-3.5 text-[#FF3131]"} />
                            <span className={`font-black px-2.5 py-1 rounded-md text-[10px] tracking-widest uppercase border ${pag.certificado_firmas_nro ? 'text-green-700 bg-green-50 border-green-200' : 'text-[#FF3131] bg-red-50 border-red-100'}`}>
                              Cert. Firmas: {pag.certificado_firmas_nro ? `N° ${pag.certificado_firmas_nro}` : "NO REGISTRADO"}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 border-t border-slate-200/40 pt-4">
                      {pag.cronograma && pag.cronograma.length > 0 && (
                        <details className="group/details text-xs" onClick={(e) => e.stopPropagation()}>
                          <summary className="cursor-pointer font-bold text-slate-500 hover:text-slate-700 flex items-center justify-between outline-none bg-slate-100 px-3 py-2 rounded-lg transition-colors">
                            <span>Ver Cronograma ({pag.cronograma.length} cuotas)</span>
                            <span className="transition group-open/details:rotate-180">▼</span>
                          </summary>
                          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                            {pag.cronograma.map((c, i) => {
                              const cDate = new Date(c.fecha_pag);
                              const parts = c.fecha_pag.split('-');
                              if (parts.length === 3) {
                                cDate.setFullYear(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                              }
                              cDate.setHours(0,0,0,0);
                              const today = new Date();
                              today.setHours(0,0,0,0);
                              const diffDays = Math.ceil((cDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                              
                              let statusLabel = 'Pendiente';
                              let statusColor = 'bg-slate-100 text-slate-600 border-slate-200';
                              
                              if (c.estado === 'cobrado' || c.pagado) {
                                statusLabel = 'Pagada';
                                statusColor = 'bg-emerald-100 text-emerald-700 border-emerald-200';
                              } else if (diffDays < 0) {
                                statusLabel = 'Vencida';
                                statusColor = 'bg-red-100 text-red-700 border-red-200';
                              }

                              return (
                                <div 
                                  key={c.id || i} 
                                  className="flex items-center justify-between p-2 rounded-lg bg-white shadow-sm border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      const docRef = doc(db, 'pagares', pag.id);
                                      const newCronograma = [...pag.cronograma];
                                      const isCurrentlyPaid = c.estado === 'cobrado' || c.pagado;
                                      
                                      newCronograma[i] = { 
                                        ...newCronograma[i], 
                                        estado: isCurrentlyPaid ? 'pendiente' : 'cobrado',
                                        pagado: !isCurrentlyPaid,
                                        fecha_cobro: isCurrentlyPaid ? null : new Date().toISOString()
                                      };
                                      
                                      const allPaid = newCronograma.every((ci: any) => ci.estado === 'cobrado' || ci.pagado === true);
                                      const updates: any = { 
                                        cronograma: newCronograma,
                                        status: allPaid ? 'cobrado' : 'pendiente',
                                        estado: allPaid ? 'Cobrado' : 'Pendiente'
                                      };
                                      
                                      if (allPaid) {
                                        updates.cobradoAt = new Date().toISOString();
                                      } else if (pag.status === 'cobrado' || pag.estado === 'Cobrado') {
                                        updates.cobradoAt = null;
                                      }

                                      await updateDoc(docRef, updates);
                                    } catch (error) {
                                      console.error("Fallo al actualizar cuota:", error);
                                    }
                                  }}
                                >
                                  <div className="flex flex-col pointer-events-none">
                                    <span className="font-black text-[10px] text-slate-400">Cuota {c.numero_cuota}</span>
                                    <span className="font-bold text-slate-700">{cDate.toLocaleDateString()}</span>
                                  </div>
                                  <div className="flex flex-col items-end pointer-events-none">
                                    <span className="font-bold text-slate-800">{getMonedaSimbolo(pag.moneda)} {formatCurrencyValue(c.monto, pag.moneda)}</span>
                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border mt-0.5 ${statusColor}`}>
                                      {statusLabel}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      )}
                    </div>

                    <div className="mt-4 flex flex-col sm:flex-row items-center sm:justify-end gap-3">
                      <div className="flex flex-wrap justify-center gap-2 items-center">
                        {(pag.status !== 'anulado' && pag.estado !== 'Anulado') && (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditPagare(pag);
                              }}
                              className="text-blue-500 hover:text-blue-600 text-[10px] sm:text-xs text-center font-black uppercase tracking-wider bg-blue-50 px-2 py-1.5 rounded-full"
                            >
                              Editar
                            </button>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setPagareToAnular(pag);
                          }}
                          className="text-red-600 hover:text-red-800 font-bold flex items-center gap-1 text-[10px] sm:text-xs text-center px-2 py-1.5 bg-red-50 rounded-md border border-red-200 transition-colors"
                        >
                          🚫 ANULAR DIRECTO
                        </button>
                        {(pag.status !== 'cobrado' && pag.estado !== 'Cobrado') && (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              try {
                                const docRef = doc(db, 'pagares', pag.id);
                                if (pag.cronograma && pag.cronograma.length > 0) {
                                  const pendingIndex = pag.cronograma.findIndex((c: any) => c.estado !== 'cobrado' && c.pagado !== true);
                                  if (pendingIndex !== -1) {
                                    const newCronograma = [...pag.cronograma];
                                    newCronograma[pendingIndex] = { ...newCronograma[pendingIndex], estado: 'cobrado', pagado: true, fecha_cobro: new Date().toISOString() };
                                    const allPaid = newCronograma.every((c: any) => c.estado === 'cobrado' || c.pagado === true);
                                    const updates: any = { cronograma: newCronograma, status: allPaid ? 'cobrado' : 'pendiente', estado: allPaid ? 'Cobrado' : 'Pendiente' };
                                    if (allPaid) {
                                      updates.cobradoAt = new Date().toISOString();
                                    } else {
                                      updates.cobradoAt = null;
                                    }
                                    await updateDoc(docRef, updates);
                                    console.log(`Cuota ${newCronograma[pendingIndex].numero_cuota} de ${pag.id} cobrada exitosamente.`);
                                  } else {
                                    await updateDoc(docRef, { status: 'cobrado', estado: 'Cobrado', cobradoAt: new Date().toISOString() });
                                    console.log(`Documento ${pag.id} cobrado exitosamente.`);
                                  }
                                } else {
                                  await updateDoc(docRef, { status: 'cobrado', estado: 'Cobrado', cobradoAt: new Date().toISOString() });
                                  console.log(`Documento ${pag.id} cobrado exitosamente.`);
                                }
                              } catch (error) {
                                console.error("Fallo al cobrar en Firebase:", error);
                              }
                            }}
                            className="text-emerald-600 hover:text-emerald-800 font-bold flex items-center gap-1 text-[10px] sm:text-xs text-center px-2 py-1.5 bg-emerald-50 rounded-md border border-emerald-200 transition-colors"
                          >
                            {pag.cronograma && pag.cronograma.length > 0 ? (
                              (() => {
                                const pendingIndex = pag.cronograma.findIndex((c: any) => c.estado !== 'cobrado' && c.pagado !== true);
                                if (pendingIndex !== -1) {
                                  return `✔ COBRAR CUOTA ${pag.cronograma[pendingIndex].numero_cuota}`;
                                }
                                return `✔ MARCAR COBRADO`;
                              })()
                            ) : (
                              '✔ MARCAR COBRADO'
                            )}
                          </button>
                        )}
                        </div>
                        )}
                        <span className="text-[10px] sm:text-[11px] font-black text-[#FF3131] uppercase tracking-wider group-hover:underline px-2 py-1.5">
                          Ver Documento &rarr;
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* CREATE / FORM VIEW FOR PROMISSORY NOTE */
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* Main settings panel */}
          <div className="xl:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-md space-y-8">
            <div className="pb-4 border-b border-slate-50">
              <h2 className="text-2xl font-bold font-serif text-slate-800">Formulario de Redacción del Pagaré</h2>
              <p className="text-xs text-slate-500 mt-1">Especifique condiciones iniciales, asigne partes firmantes y configure el cronograma financiero.</p>
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
                              onChange={(e) => {
                                const monthsFromStart = parseInt(e.target.value);
                                if (!isNaN(monthsFromStart)) {
                                  const d = new Date(fechaPrimerPago);
                                  const freqObj = activeFrecuencias.find(f => f.id === frecuenciaId) || activeFrecuencias[0];
                                  const daysInterval = freqObj ? freqObj.intervalo_dias : 30;
                                  d.setDate(d.getDate() + (monthsFromStart * daysInterval));
                                  handleRawRefuerzoChange(ref.id, 'fecha', d.toISOString().split('T')[0]);
                                }
                              }}
                              value=""
                            >
                              <option value="" disabled>Ubicar en Mes...</option>
                              <option value={0}>Mes 1 (Mismo mes que 1ra cuota)</option>
                              {Array.from({length: Math.max(0, (Number(duracionMeses) || 12) - 1)}).map((_, i) => (
                                <option key={i + 1} value={i + 1}>Mes {i + 2}</option>
                              ))}
                            </select>
                            <input  autoComplete="nope"
                              type="date"
                              value={ref.fecha}
                              onChange={(e) => handleRawRefuerzoChange(ref.id, 'fecha', e.target.value)}
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
              <h3 className="text-xs font-black uppercase text-[#FF3131] tracking-[0.2em] mb-4">4. Identificación de Firmantes</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Acreedor */}
                <div className="p-4 border border-slate-100 rounded-2xl relative space-y-3">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-black uppercase text-slate-400 tracking-wider">Acreedor / Beneficiario *</label>
                  </div>
                  <input  autoComplete="nope"
                    type="text"
                    placeholder="Nombre Completo / Razón Social"
                    value={acreedorNombreRaw}
                    onChange={(e) => setAcreedorNombreRaw(e.target.value)}
                    className={`w-full bg-slate-50 border focus:border-[#FF3131] rounded-xl px-3 py-2 text-xs font-bold outline-none ${formError && !acreedorNombreRaw.trim() ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                  />
                  <input  autoComplete="nope"
                    type="text"
                    placeholder="Documento (CI / RUC)"
                    value={acreedorDocumentoRaw}
                    onChange={(e) => setAcreedorDocumentoRaw(formatCI(e.target.value))}
                    className={`w-full bg-slate-50 border focus:border-[#FF3131] rounded-xl px-3 py-2 text-xs font-bold outline-none ${formError && !acreedorDocumentoRaw.trim() ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                  />
                  <input  autoComplete="nope"
                    type="text"
                    placeholder="Domicilio / Dirección (Opcional)"
                    value={acreedorDomicilioRaw}
                    onChange={(e) => setAcreedorDomicilioRaw(e.target.value)}
                    className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  />
                </div>

                {/* Deudor */}
                <div className="p-4 border border-slate-100 rounded-2xl relative space-y-3">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-black uppercase text-slate-400 tracking-wider">Deudor Principal *</label>
                  </div>
                  <input  autoComplete="nope"
                    type="text"
                    placeholder="Nombre Completo / Razón Social"
                    value={deudorNombreRaw}
                    onChange={(e) => setDeudorNombreRaw(e.target.value)}
                    className={`w-full bg-slate-50 border focus:border-[#FF3131] rounded-xl px-3 py-2 text-xs font-bold outline-none ${formError && !deudorNombreRaw.trim() ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                  />
                  <input  autoComplete="nope"
                    type="text"
                    placeholder="Documento (CI / RUC)"
                    value={deudorDocumentoRaw}
                    onChange={(e) => setDeudorDocumentoRaw(formatCI(e.target.value))}
                    className={`w-full bg-slate-50 border focus:border-[#FF3131] rounded-xl px-3 py-2 text-xs font-bold outline-none ${formError && !deudorDocumentoRaw.trim() ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                  />
                  <input  autoComplete="nope"
                    type="text"
                    placeholder="Domicilio / Dirección (Opcional)"
                    value={deudorDomicilioRaw}
                    onChange={(e) => setDeudorDomicilioRaw(e.target.value)}
                    className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  />
                </div>

                {/* Co-deudor 1 */}
                <div className="p-4 border border-slate-100 rounded-2xl relative space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-black uppercase text-slate-400 tracking-wider">Co-Deudor Solidario 1 (Opcional)</label>
                    <button
                      type="button"
                      onClick={() => openQuickAddPersona('codeudor1')}
                      className="text-[9px] font-black uppercase text-[#FF3131] hover:underline"
                    >
                      [+] Rápido
                    </button>
                  </div>
                  <select
                    value={codeudor1Id}
                    onChange={(e) => setCodeudor1Id(e.target.value)}
                    className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  >
                    <option value="">-- Ninguno (Opcional) --</option>
                    {personas.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} {p.apellido || ''} ({p.tipo_documento}: {p.nro_documento})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Co-deudor 2 */}
                <div className="p-4 border border-slate-100 rounded-2xl relative space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-black uppercase text-slate-400 tracking-wider">Co-Deudor Solidario 2 (Opcional)</label>
                    <button
                      type="button"
                      onClick={() => openQuickAddPersona('codeudor2')}
                      className="text-[9px] font-black uppercase text-[#FF3131] hover:underline"
                    >
                      [+] Rápido
                    </button>
                  </div>
                  <select
                    value={codeudor2Id}
                    onChange={(e) => setCodeudor2Id(e.target.value)}
                    className="w-full box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3 py-2 text-xs font-bold outline-none"
                  >
                    <option value="">-- Ninguno (Opcional) --</option>
                    {personas.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} {p.apellido || ''} ({p.tipo_documento}: {p.nro_documento})
                      </option>
                    ))}
                  </select>
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
                    <span className={`text-sm font-black ${totalMontoCuotasYRefuerzos !== totalFinanciar ? 'text-red-500' : 'text-emerald-600'}`}>
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
                {totalMontoCuotasYRefuerzos !== totalFinanciar ? (
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
                
                {tipoNegociacion.includes('entrega') && (
                  <div className="flex justify-between items-center pt-4">
                    <span className="text-slate-400">Entrega Inicial:</span>
                    <span className="font-mono font-bold">{getMonedaSimbolo(moneda)} {formatCurrencyValue(deliveryMonto, moneda)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-4">
                  <span className="text-slate-400">Total Cronograma (Amortiz.):</span>
                  <span className="font-mono font-bold">{getMonedaSimbolo(moneda)} {formatCurrencyValue(totalMontoCuotasYRefuerzos, moneda)}</span>
                </div>

                <div className="flex justify-between items-center pt-4 font-extrabold text-14 border-t border-slate-800">
                  <span className="text-slate-300">Suma consolidada total:</span>
                  <span className="font-mono text-base text-white">{getMonedaSimbolo(moneda)} {formatCurrencyValue(sumaTotalCalculada, moneda)}</span>
                </div>

                <div className="flex justify-between items-center pt-4 font-black">
                  <span className="text-[#FF3131]">Valor Declarado Pagaré:</span>
                  <span className="font-mono text-base text-red-400">{getMonedaSimbolo(moneda)} {formatCurrencyValue(declaredTotalVal, moneda)}</span>
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
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-1">Número único</label>
                  <input  autoComplete="nope"
                    type="text"
                    value={quickNroDoc}
                    onChange={(e) => setQuickNroDoc(formatCI(e.target.value))}
                    placeholder="Ej. 1234567"
                    className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none"
                  />
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
              <h3 className="text-xl font-bold text-red-500">¿Estás seguro de anular este pagaré?</h3>
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
                      console.log('Documento anulado exitosamente en Firebase.');
                      setPagareToAnular(null);
                    } catch (error) {
                      console.error("Fallo al anular en Firebase:", error);
                    }
                  }}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors shadow-lg shadow-red-500/20"
                >
                  Sí, anular y borrar todo
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

