import React, { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { jsPDF } from 'jspdf';
import {
  Calculator,
  Car,
  Check,
  Download,
  FileText,
  History,
  MessageCircle,
  RotateCcw,
  Save,
  Search,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import { auth, db } from '../services/auth';
import { useWorkspace } from '../hooks/useWorkspace';
import { Persona } from '../types';
import { WhatsAppSendModal } from './WhatsAppSendModal';

export type MonedaCotizador = 'PYG' | 'USD';

export interface CotizacionPlayeroRecord {
  id: string;
  userId: string;
  workspaceId?: string;
  numeroCotizacion: string;
  correlativo: number;
  fecha: string;
  createdAt?: any;
  moneda: MonedaCotizador;
  vehiculo: {
    marca: string;
    modelo: string;
    anio: string;
    color: string;
    chasisChapa: string;
  };
  cliente: {
    personaId?: string;
    nombre: string;
    telefono: string;
  };
  financiacion: {
    precioVehiculo: number;
    entregaInicial: number;
    vehiculoACuenta: number;
    vehiculoACuentaDetalle?: string;
    saldoAFinanciar: number;
    cantidadCuotas: number;
    montoPorCuota: number;
    cantidadRefuerzos: number;
    montoRefuerzo: number;
    totalRefuerzos: number;
    saldoEnCuotas: number;
    gastosTransferencia: number;
  };
  notas?: string;
}

interface CotizadorPlayeroProps {
  currentUser: User | null;
  userData?: any;
  customBranding?: any;
  personas?: Persona[];
  logoInstitucional?: string | null;
  canUseWhatsApp?: boolean;
}

const formatMoney = (value: number, moneda: MonedaCotizador): string => {
  const safe = Number.isFinite(value) ? value : 0;
  if (moneda === 'USD') {
    return `US$ ${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe)}`;
  }
  return `Gs. ${new Intl.NumberFormat('es-PY', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(safe))}`;
};

const parseMoneyInput = (raw: string, moneda: MonedaCotizador): number => {
  if (!raw || !raw.trim()) return 0;
  if (moneda === 'PYG') {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return 0;
    const parsed = parseInt(digits, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const cleaned = raw.replace(/[^0-9.,]/g, '').replace(/,/g, '.');
  const firstDot = cleaned.indexOf('.');
  const normalized =
    firstDot === -1
      ? cleaned
      : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatInputValue = (raw: string, moneda: MonedaCotizador): string => {
  if (!raw) return '';
  if (moneda === 'PYG') {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    const num = parseInt(digits, 10);
    return Number.isFinite(num) ? num.toLocaleString('es-PY') : '';
  }
  const cleaned = raw.replace(/[^0-9.,]/g, '').replace(/,/g, '.');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
};

const formatFechaDisplay = (isoDate: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate || '');
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return new Date().toLocaleDateString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const sanitizeFileSlug = (text: string): string =>
  (text || 'Cliente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'Cliente';

export const CotizadorPlayero: React.FC<CotizadorPlayeroProps> = ({
  currentUser,
  userData,
  customBranding,
  personas = [],
  logoInstitucional,
  canUseWhatsApp = false,
}) => {
  const { workspaceId, workspaceData } = useWorkspace(currentUser, userData);
  const authUid = auth?.currentUser?.uid || currentUser?.uid || '';
  const effectiveWorkspaceId = workspaceId || userData?.tenant_id || authUid;

  // Datos comerciales de la Playa para el PDF
  const playaBranding = useMemo(() => {
    const src = { ...(userData || {}), ...(workspaceData || {}) };
    const pick = (...vals: unknown[]): string => {
      for (const v of vals) {
        const s = String(v || '').trim();
        if (!s || s === '---' || s === 'Mi Escribanía') continue;
        return s;
      }
      return '';
    };
    const nombre =
      pick(
        customBranding?.nombreInstitucion,
        src.nombreComercial,
        src.razonSocial,
        src.nombreInstitucion,
        src.nombre
      ) || 'Playa de Vehículos';
    const ruc = pick(customBranding?.ruc, src.ruc);
    const telefono = pick(customBranding?.telefono, src.telefono, src.whatsapp, src.phoneNumber);
    const direccionBase = pick(customBranding?.direccion, src.direccion, src.domicilio);
    const ciudad = pick(customBranding?.ciudad, src.ciudad);
    const direccion = [direccionBase, ciudad].filter(Boolean).join(' — ');
    const email = pick(customBranding?.email, src.email, src.correo, currentUser?.email);
    const logo =
      logoInstitucional ||
      customBranding?.logoUrl ||
      src.logo_institucional ||
      src.logoUrl ||
      null;
    return { nombre, ruc, telefono, direccion, email, logo };
  }, [userData, workspaceData, customBranding, currentUser?.email, logoInstitucional]);

  // Estado del formulario: Vehículo
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [anio, setAnio] = useState('');
  const [color, setColor] = useState('');
  const [chasisChapa, setChasisChapa] = useState('');

  // Estado del formulario: Cliente
  const [selectedPersonaId, setSelectedPersonaId] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');

  // Estado del formulario: Financiación
  const [moneda, setMoneda] = useState<MonedaCotizador>('PYG');
  const [precioInput, setPrecioInput] = useState('');
  const [entregaInput, setEntregaInput] = useState('');
  const [vehiculoCuentaInput, setVehiculoCuentaInput] = useState('');
  const [vehiculoCuentaDetalle, setVehiculoCuentaDetalle] = useState('');
  const [cantidadCuotasInput, setCantidadCuotasInput] = useState('24');
  const [cantidadRefuerzosInput, setCantidadRefuerzosInput] = useState('');
  const [montoRefuerzoInput, setMontoRefuerzoInput] = useState('');
  const [gastosTransferenciaInput, setGastosTransferenciaInput] = useState('');
  const [notas, setNotas] = useState('');

  // Historial & UI
  const [cotizaciones, setCotizaciones] = useState<CotizacionPlayeroRecord[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(true);
  const [busquedaHistorial, setBusquedaHistorial] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [cotizacionActivaNro, setCotizacionActivaNro] = useState<string | null>(null);
  const [incluirMembrete, setIncluirMembrete] = useState<boolean>(true);
  const [maxCorrelativoPersistido, setMaxCorrelativoPersistido] = useState<number>(0);
  const [waModalData, setWaModalData] = useState<{
    isOpen: boolean;
    documentTitle: string;
    defaultMessage: string;
    fileBase64: string;
    fileName: string;
  } | null>(null);

  // Suscripción en tiempo real a cotizaciones_playero del usuario autenticado
  useEffect(() => {
    if (!authUid) {
      setLoadingHistorial(false);
      return;
    }

    const storageKey = `olga_playero_max_cot_${authUid}`;
    let storedMax = 0;
    try {
      const rawStored = localStorage.getItem(storageKey);
      const parsedStored = rawStored ? parseInt(rawStored, 10) : 0;
      if (Number.isFinite(parsedStored) && parsedStored > 0) {
        storedMax = parsedStored;
        setMaxCorrelativoPersistido((prev) => Math.max(prev, parsedStored));
      }
    } catch {
      // Ignorar restricciones de storage
    }

    const q = query(
      collection(db, 'cotizaciones_playero'),
      where('userId', '==', authUid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: CotizacionPlayeroRecord[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<CotizacionPlayeroRecord, 'id'>),
        }));
        rows.sort((a, b) => {
          const corrDiff = (Number(b.correlativo) || 0) - (Number(a.correlativo) || 0);
          if (corrDiff !== 0) return corrDiff;
          return String(b.fecha || '').localeCompare(String(a.fecha || ''));
        });

        const maxInSnap = rows.reduce((max, item) => {
          const fromField = Number(item.correlativo) || 0;
          const fromCode = parseInt(String(item.numeroCotizacion || '').replace(/\D/g, ''), 10) || 0;
          return Math.max(max, fromField, fromCode);
        }, 0);

        setMaxCorrelativoPersistido((prev) => {
          const nextMax = Math.max(prev, storedMax, maxInSnap);
          try {
            if (nextMax > 0) localStorage.setItem(storageKey, String(nextMax));
          } catch {
            // Ignorar restricciones de storage
          }
          return nextMax;
        });

        setCotizaciones(rows);
        setLoadingHistorial(false);
      },
      (err) => {
        console.error('Error cargando historial de cotizaciones:', err);
        setLoadingHistorial(false);
      }
    );
    return () => unsub();
  }, [authUid]);

  // Cálculos automáticos en tiempo real
  const calculos = useMemo(() => {
    const precioVehiculo = parseMoneyInput(precioInput, moneda);
    const entregaInicial = parseMoneyInput(entregaInput, moneda);
    const vehiculoACuenta = parseMoneyInput(vehiculoCuentaInput, moneda);
    const saldoAFinanciar = Math.max(0, precioVehiculo - entregaInicial - vehiculoACuenta);

    const cantidadRefuerzos = Math.max(0, parseInt(cantidadRefuerzosInput.replace(/\D/g, ''), 10) || 0);
    const montoRefuerzo = parseMoneyInput(montoRefuerzoInput, moneda);
    const totalRefuerzos = cantidadRefuerzos * montoRefuerzo;

    const saldoEnCuotas = Math.max(0, saldoAFinanciar - totalRefuerzos);
    const cantidadCuotas = Math.max(0, parseInt(cantidadCuotasInput.replace(/\D/g, ''), 10) || 0);

    const rawCuota = cantidadCuotas > 0 ? saldoEnCuotas / cantidadCuotas : 0;
    const montoPorCuota =
      moneda === 'PYG' ? Math.round(rawCuota) : Math.round(rawCuota * 100) / 100;

    const gastosTransferencia = parseMoneyInput(gastosTransferenciaInput, moneda);

    return {
      precioVehiculo,
      entregaInicial,
      vehiculoACuenta,
      saldoAFinanciar,
      cantidadRefuerzos,
      montoRefuerzo,
      totalRefuerzos,
      saldoEnCuotas,
      cantidadCuotas,
      montoPorCuota,
      gastosTransferencia,
    };
  }, [
    precioInput,
    entregaInput,
    vehiculoCuentaInput,
    cantidadRefuerzosInput,
    montoRefuerzoInput,
    cantidadCuotasInput,
    gastosTransferenciaInput,
    moneda,
  ]);

  const nextCorrelativo = useMemo(() => {
    const maxInList = cotizaciones.reduce((max, item) => {
      const fromField = Number(item.correlativo) || 0;
      const fromCode = parseInt(String(item.numeroCotizacion || '').replace(/\D/g, ''), 10) || 0;
      return Math.max(max, fromField, fromCode);
    }, 0);
    return Math.max(maxInList, maxCorrelativoPersistido) + 1;
  }, [cotizaciones, maxCorrelativoPersistido]);

  const formatCorrelativo = (num: number): string =>
    `COT-${String(num).padStart(4, '0')}`;

  const handleSelectPersona = (personaId: string) => {
    setSelectedPersonaId(personaId);
    if (!personaId) return;
    const found = personas.find((p) => p.id === personaId);
    if (found) {
      const fullName =
        found.nombre_o_razon_social ||
        [found.nombre, found.apellido].filter(Boolean).join(' ').trim();
      setClienteNombre(fullName);
      setClienteTelefono(found.telefono || '');
    }
  };

  const handleCurrencyChange = (nextMoneda: MonedaCotizador) => {
    if (nextMoneda === moneda) return;
    setMoneda(nextMoneda);
    setPrecioInput((prev) => (prev ? formatInputValue(String(parseMoneyInput(prev, moneda)), nextMoneda) : ''));
    setEntregaInput((prev) => (prev ? formatInputValue(String(parseMoneyInput(prev, moneda)), nextMoneda) : ''));
    setVehiculoCuentaInput((prev) => (prev ? formatInputValue(String(parseMoneyInput(prev, moneda)), nextMoneda) : ''));
    setMontoRefuerzoInput((prev) => (prev ? formatInputValue(String(parseMoneyInput(prev, moneda)), nextMoneda) : ''));
    setGastosTransferenciaInput((prev) => (prev ? formatInputValue(String(parseMoneyInput(prev, moneda)), nextMoneda) : ''));
  };

  const limpiarFormulario = () => {
    setMarca('');
    setModelo('');
    setAnio('');
    setColor('');
    setChasisChapa('');
    setSelectedPersonaId('');
    setClienteNombre('');
    setClienteTelefono('');
    setMoneda('PYG');
    setPrecioInput('');
    setEntregaInput('');
    setVehiculoCuentaInput('');
    setVehiculoCuentaDetalle('');
    setCantidadCuotasInput('');
    setCantidadRefuerzosInput('');
    setMontoRefuerzoInput('');
    setGastosTransferenciaInput('');
    setNotas('');
    setIncluirMembrete(true);
    setCotizacionActivaNro(null);
    setErrorMsg('');
  };

  const buildCurrentCotizacionPayload = (numeroCotizacion: string, correlativo: number) => ({
    userId: authUid,
    workspaceId: effectiveWorkspaceId,
    numeroCotizacion,
    correlativo,
    fecha: new Date().toISOString(),
    moneda,
    vehiculo: {
      marca: marca.trim(),
      modelo: modelo.trim(),
      anio: anio.trim(),
      color: color.trim(),
      chasisChapa: chasisChapa.trim(),
    },
    cliente: {
      personaId: selectedPersonaId || '',
      nombre: clienteNombre.trim(),
      telefono: clienteTelefono.trim(),
    },
    financiacion: {
      ...calculos,
      vehiculoACuentaDetalle: vehiculoCuentaDetalle.trim(),
    },
    notas: notas.trim(),
  });

  const handleGuardarCotizacion = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!authUid) {
      setErrorMsg('No se detectó una sesión activa. Vuelve a iniciar sesión.');
      return;
    }
    if (calculos.precioVehiculo <= 0) {
      setErrorMsg('Ingresa el Precio del Vehículo para guardar la cotización.');
      return;
    }

    setGuardando(true);
    try {
      const correlativo = nextCorrelativo;
      const numeroCotizacion = formatCorrelativo(correlativo);
      const payload = buildCurrentCotizacionPayload(numeroCotizacion, correlativo);

      await addDoc(collection(db, 'cotizaciones_playero'), {
        ...payload,
        createdAt: serverTimestamp(),
      });

      setMaxCorrelativoPersistido((prev) => {
        const nextMax = Math.max(prev, correlativo);
        try {
          if (authUid) localStorage.setItem(`olga_playero_max_cot_${authUid}`, String(nextMax));
        } catch {
          // Ignorar restricciones de storage
        }
        return nextMax;
      });

      limpiarFormulario();
      setSuccessMsg(`Cotización ${numeroCotizacion} guardada. Formulario listo para una nueva.`);
      setTimeout(() => setSuccessMsg(''), 4500);
    } catch (err: any) {
      console.error('Error guardando cotización en Firestore:', err);
      setErrorMsg(err?.message || 'No se pudo guardar la cotización.');
    } finally {
      setGuardando(false);
    }
  };

  const handleCargarDesdeHistorial = (item: CotizacionPlayeroRecord) => {
    setMoneda(item.moneda || 'PYG');
    setMarca(item.vehiculo?.marca || '');
    setModelo(item.vehiculo?.modelo || '');
    setAnio(item.vehiculo?.anio || '');
    setColor(item.vehiculo?.color || '');
    setChasisChapa(item.vehiculo?.chasisChapa || '');
    setSelectedPersonaId(item.cliente?.personaId || '');
    setClienteNombre(item.cliente?.nombre || '');
    setClienteTelefono(item.cliente?.telefono || '');

    const mon = item.moneda || 'PYG';
    const fin = item.financiacion;
    setPrecioInput(fin?.precioVehiculo ? formatInputValue(String(fin.precioVehiculo), mon) : '');
    setEntregaInput(fin?.entregaInicial ? formatInputValue(String(fin.entregaInicial), mon) : '');
    setVehiculoCuentaInput(
      fin?.vehiculoACuenta ? formatInputValue(String(fin.vehiculoACuenta), mon) : ''
    );
    setVehiculoCuentaDetalle(fin?.vehiculoACuentaDetalle || '');
    setCantidadCuotasInput(String(fin?.cantidadCuotas || 24));
    setCantidadRefuerzosInput(fin?.cantidadRefuerzos ? String(fin.cantidadRefuerzos) : '');
    setMontoRefuerzoInput(
      fin?.montoRefuerzo ? formatInputValue(String(fin.montoRefuerzo), mon) : ''
    );
    setGastosTransferenciaInput(
      fin?.gastosTransferencia ? formatInputValue(String(fin.gastosTransferencia), mon) : ''
    );
    setNotas(item.notas || '');
    setCotizacionActivaNro(item.numeroCotizacion);
    setSuccessMsg(`Cotización ${item.numeroCotizacion} cargada en el editor.`);
    setTimeout(() => setSuccessMsg(''), 3000);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEliminarCotizacion = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'cotizaciones_playero', id));
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('Error al eliminar cotización:', err);
      setErrorMsg('No se pudo eliminar la cotización.');
    }
  };

  const buildCotizacionPdf = (
    record: Omit<CotizacionPlayeroRecord, 'id'>,
    conMembrete: boolean = incluirMembrete
  ) => {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 16;
    const maxWidth = pageWidth - margin * 2;
    let y = conMembrete ? margin : 24;

    const ensureSpace = (needed: number) => {
      if (y + needed > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
    };

    if (conMembrete) {
      // Membrete comercial de la playa
      const rawLogo = playaBranding.logo;
      if (rawLogo && /^data:image\/(png|jpe?g);base64,/i.test(rawLogo)) {
        try {
          const props = pdf.getImageProperties(rawLogo);
          const ratio = props.width && props.height ? props.width / props.height : 1;
          const drawH = 13;
          const drawW = Math.min(28, drawH * ratio);
          const fmt = /image\/png/i.test(rawLogo) ? 'PNG' : 'JPEG';
          pdf.addImage(rawLogo, fmt, (pageWidth - drawW) / 2, y - 2, drawW, drawH);
          y += drawH + 2;
        } catch {
          // Ignorar logo incompatible
        }
      }

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(15, 23, 42);
      pdf.text(playaBranding.nombre.toUpperCase(), pageWidth / 2, y, { align: 'center' });
      y += 5;

      const headerSubParts: string[] = [];
      if (playaBranding.ruc) headerSubParts.push(`RUC: ${playaBranding.ruc}`);
      if (playaBranding.telefono) headerSubParts.push(`Tel.: ${playaBranding.telefono}`);
      if (headerSubParts.length > 0) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);
        pdf.setTextColor(71, 85, 105);
        pdf.text(headerSubParts.join('  •  '), pageWidth / 2, y, { align: 'center' });
        y += 4.2;
      }

      if (playaBranding.direccion) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139);
        pdf.text(playaBranding.direccion, pageWidth / 2, y, { align: 'center' });
        y += 4.2;
      }

      y += 1.5;
      pdf.setDrawColor(15, 23, 42);
      pdf.setLineWidth(0.5);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 7;
    }

    // Título y número de cotización
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    pdf.text('COTIZACIÓN DE VEHÍCULO Y PLAN DE FINANCIACIÓN', margin, y);
    pdf.setFontSize(10);
    pdf.text(record.numeroCotizacion, pageWidth - margin, y, { align: 'right' });
    y += 4.8;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Fecha de emisión: ${formatFechaDisplay(record.fecha)}`, margin, y);
    pdf.text(
      `Moneda: ${record.moneda === 'USD' ? 'Dólares Americanos (US$)' : 'Guaraníes (Gs.)'}`,
      pageWidth - margin,
      y,
      { align: 'right' }
    );
    y += 6;

    // Bloques Cliente & Vehículo
    const colGap = 5;
    const halfW = (maxWidth - colGap) / 2;
    const clientLines = [
      `Cliente: ${record.cliente.nombre || 'A confirmar'}`,
      `Teléfono / WhatsApp: ${record.cliente.telefono || 'No especificado'}`,
    ];
    const vehDesc = [record.vehiculo.marca, record.vehiculo.modelo, record.vehiculo.anio]
      .filter(Boolean)
      .join(' ');
    const vehLines = [
      `Vehículo: ${vehDesc || 'A confirmar'}`,
      `Color: ${record.vehiculo.color || 'A confirmar'}`,
      `Chasis / Chapa: ${record.vehiculo.chasisChapa || 'A confirmar'}`,
    ];

    const boxH = 26;
    ensureSpace(boxH + 6);
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(203, 213, 225);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(margin, y, halfW, boxH, 1.5, 1.5, 'FD');
    pdf.roundedRect(margin + halfW + colGap, y, halfW, boxH, 1.5, 1.5, 'FD');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(15, 23, 42);
    pdf.text('DATOS DEL CLIENTE', margin + 4, y + 5.5);
    pdf.text('DATOS DEL VEHÍCULO', margin + halfW + colGap + 4, y + 5.5);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(51, 65, 85);
    let cy = y + 11;
    clientLines.forEach((line) => {
      const wrapped = pdf.splitTextToSize(line, halfW - 8);
      pdf.text(wrapped[0] || '', margin + 4, cy);
      cy += 4.8;
    });

    let vy = y + 11;
    vehLines.forEach((line) => {
      const wrapped = pdf.splitTextToSize(line, halfW - 8);
      pdf.text(wrapped[0] || '', margin + halfW + colGap + 4, vy);
      vy += 4.6;
    });

    y += boxH + 7;

    // Cuadro del Plan de Financiación
    ensureSpace(16);
    pdf.setFillColor(15, 23, 42);
    pdf.rect(margin, y, maxWidth, 7.5, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(255, 255, 255);
    pdf.text('DETALLE DEL PLAN DE FINANCIACIÓN', margin + 4, y + 5);
    pdf.text('IMPORTE', pageWidth - margin - 4, y + 5, { align: 'right' });
    y += 7.5;

    const mon = record.moneda || 'PYG';
    const fin = record.financiacion;
    const rows: Array<{ label: string; value: string; bold?: boolean }> = [
      { label: 'Precio del Vehículo', value: formatMoney(fin.precioVehiculo, mon), bold: true },
      { label: 'Entrega Inicial', value: `- ${formatMoney(fin.entregaInicial, mon)}` },
    ];

    if (fin.vehiculoACuenta > 0) {
      const detalle = fin.vehiculoACuentaDetalle ? ` (${fin.vehiculoACuentaDetalle})` : '';
      rows.push({
        label: `Vehículo Recibido a Cuenta${detalle}`,
        value: `- ${formatMoney(fin.vehiculoACuenta, mon)}`,
      });
    }

    rows.push({
      label: 'Saldo a Financiar',
      value: formatMoney(fin.saldoAFinanciar, mon),
      bold: true,
    });

    if (fin.cantidadRefuerzos > 0 && fin.montoRefuerzo > 0) {
      rows.push({
        label: `Refuerzos (${fin.cantidadRefuerzos} x ${formatMoney(fin.montoRefuerzo, mon)})`,
        value: `- ${formatMoney(fin.totalRefuerzos, mon)}`,
      });
      rows.push({
        label: 'Saldo Financiado en Cuotas',
        value: formatMoney(fin.saldoEnCuotas, mon),
        bold: true,
      });
    }

    rows.push({
      label: `Plan de Cuotas (${fin.cantidadCuotas} cuotas mensuales)`,
      value: `${fin.cantidadCuotas} x ${formatMoney(fin.montoPorCuota, mon)}`,
      bold: true,
    });

    if (fin.gastosTransferencia > 0) {
      rows.push({
        label: 'Gastos de Transferencia / Escribanía (Estimado)',
        value: formatMoney(fin.gastosTransferencia, mon),
      });
    }

    rows.forEach((row, idx) => {
      ensureSpace(8);
      if (idx % 2 === 1) {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(margin, y, maxWidth, 7.2, 'F');
      }
      pdf.setFont('helvetica', row.bold ? 'bold' : 'normal');
      pdf.setFontSize(8.8);
      pdf.setTextColor(row.bold ? 15 : 51, row.bold ? 23 : 65, row.bold ? 42 : 85);
      pdf.text(row.label, margin + 4, y + 4.9);
      pdf.text(row.value, pageWidth - margin - 4, y + 4.9, { align: 'right' });

      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.2);
      pdf.line(margin, y + 7.2, pageWidth - margin, y + 7.2);
      y += 7.2;
    });

    y += 6;

    // Caja destacada de cuota mensual
    ensureSpace(22);
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(0.45);
    pdf.roundedRect(margin, y, maxWidth, 18, 2, 2, 'FD');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(71, 85, 105);
    pdf.text('CUOTA MENSUAL ESTIMADA', margin + 5, y + 6.5);
    pdf.setFontSize(13);
    pdf.setTextColor(15, 23, 42);
    pdf.text(
      `${fin.cantidadCuotas} cuotas de ${formatMoney(fin.montoPorCuota, mon)}`,
      margin + 5,
      y + 13
    );

    if (fin.totalRefuerzos > 0) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(51, 65, 85);
      pdf.text(
        `+ ${fin.cantidadRefuerzos} refuerzo(s) de ${formatMoney(fin.montoRefuerzo, mon)}`,
        pageWidth - margin - 5,
        y + 12.5,
        { align: 'right' }
      );
    }

    y += 24;

    if (record.notas && record.notas.trim()) {
      ensureSpace(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(15, 23, 42);
      pdf.text('OBSERVACIONES:', margin, y);
      y += 4.5;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(71, 85, 105);
      const noteLines = pdf.splitTextToSize(record.notas.trim(), maxWidth);
      noteLines.forEach((line: string) => {
        ensureSpace(4.5);
        pdf.text(line, margin, y);
        y += 4.3;
      });
      y += 4;
    }

    ensureSpace(14);
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text(
      conMembrete
        ? `Cotización referencial emitida por ${playaBranding.nombre}. Sujeta a disponibilidad de unidad y verificación crediticia.`
        : 'Cotización referencial. Sujeta a disponibilidad de unidad y verificación crediticia.',
      pageWidth / 2,
      pageHeight - 14,
      { align: 'center' }
    );

    const fileName = `Cotizacion_${record.numeroCotizacion}_${sanitizeFileSlug(
      record.cliente.nombre || record.vehiculo.modelo || 'Cliente'
    )}.pdf`;

    const dataUri = pdf.output('datauristring');
    const fileBase64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;

    return { pdf, fileName, fileBase64 };
  };

  const handleExportarPdfActual = () => {
    setErrorMsg('');
    if (calculos.precioVehiculo <= 0) {
      setErrorMsg('Ingresa al menos el Precio del Vehículo para generar el PDF.');
      return;
    }
    const nro = cotizacionActivaNro || formatCorrelativo(nextCorrelativo);
    const corr = cotizacionActivaNro
      ? parseInt(cotizacionActivaNro.replace(/\D/g, ''), 10) || nextCorrelativo
      : nextCorrelativo;
    const record = buildCurrentCotizacionPayload(nro, corr);
    const { pdf, fileName } = buildCotizacionPdf(record);
    pdf.save(fileName);
  };

  const handleEnviarWhatsAppActual = () => {
    setErrorMsg('');
    if (calculos.precioVehiculo <= 0) {
      setErrorMsg('Ingresa al menos el Precio del Vehículo para enviar la cotización.');
      return;
    }
    const nro = cotizacionActivaNro || formatCorrelativo(nextCorrelativo);
    const corr = cotizacionActivaNro
      ? parseInt(cotizacionActivaNro.replace(/\D/g, ''), 10) || nextCorrelativo
      : nextCorrelativo;
    const record = buildCurrentCotizacionPayload(nro, corr);
    const { fileBase64, fileName } = buildCotizacionPdf(record);
    const vehDesc = [record.vehiculo.marca, record.vehiculo.modelo, record.vehiculo.anio]
      .filter(Boolean)
      .join(' ');
    const defaultMessage = `Estimado/a ${
      record.cliente.nombre || 'cliente'
    },\n\nLe enviamos adjunta su cotización ${nro}${
      vehDesc ? ` para el vehículo ${vehDesc}` : ''
    }.\n• Precio: ${formatMoney(record.financiacion.precioVehiculo, record.moneda)}\n• Entrega inicial: ${formatMoney(
      record.financiacion.entregaInicial,
      record.moneda
    )}\n• Plan: ${record.financiacion.cantidadCuotas} cuotas de ${formatMoney(
      record.financiacion.montoPorCuota,
      record.moneda
    )}\n\nAtentamente,\n${playaBranding.nombre}`;

    setWaModalData({
      isOpen: true,
      documentTitle: `Cotización ${nro}`,
      defaultMessage,
      fileBase64,
      fileName,
    });
  };

  const handleReimprimirPdfHistorial = (item: CotizacionPlayeroRecord) => {
    const { pdf, fileName } = buildCotizacionPdf(item);
    pdf.save(fileName);
  };

  const historialFiltrado = useMemo(() => {
    const term = busquedaHistorial.trim().toLowerCase();
    if (!term) return cotizaciones;
    return cotizaciones.filter((c) => {
      const hay = [
        c.numeroCotizacion,
        c.cliente?.nombre,
        c.cliente?.telefono,
        c.vehiculo?.marca,
        c.vehiculo?.modelo,
        c.vehiculo?.anio,
        c.vehiculo?.chasisChapa,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(term);
    });
  }, [cotizaciones, busquedaHistorial]);

  return (
    <div className="space-y-5 w-full max-w-6xl mx-auto p-0 md:p-6 min-h-screen">
      {/* Cabecera minimalista unificada */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 shrink-0">
            <Calculator className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-slate-900 tracking-tight truncate">
              Cotizador / Financiación Automotor
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              Simulación en tiempo real en Gs. o USD, guardado en la nube y exportación PDF lista para WhatsApp.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg">
            {cotizacionActivaNro || formatCorrelativo(nextCorrelativo)}
          </span>
          <button
            type="button"
            onClick={limpiarFormulario}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Limpiar todos los campos del formulario"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpiar</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-xs font-semibold flex items-center justify-between gap-2">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg('')} className="p-1 hover:bg-red-100 rounded-lg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-xs font-semibold flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            {successMsg}
          </span>
          <button type="button" onClick={() => setSuccessMsg('')} className="p-1 hover:bg-emerald-100 rounded-lg cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Grid Principal: Formulario a la izquierda + Resumen / Acciones a la derecha */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-7 space-y-5">
          {/* Tarjeta 1: Datos del Vehículo */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                <Car className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Datos del Vehículo</h3>
                <p className="text-[11px] text-slate-500">Campos opcionales según los datos disponibles de la unidad.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Marca
                </label>
                <input
                  type="text"
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                  placeholder="Ej: Toyota"
                  className="w-full box-border bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Modelo
                </label>
                <input
                  type="text"
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                  placeholder="Ej: Hilux SRV 4x4"
                  className="w-full box-border bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Año
                </label>
                <input
                  type="text"
                  value={anio}
                  onChange={(e) => setAnio(e.target.value)}
                  placeholder="Ej: 2022"
                  className="w-full box-border bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Color
                </label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="Ej: Blanco Perla"
                  className="w-full box-border bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 outline-none transition-colors"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Chasis / N.° de Chapa
                </label>
                <input
                  type="text"
                  value={chasisChapa}
                  onChange={(e) => setChasisChapa(e.target.value)}
                  placeholder="Ej: Chasis 8AJHA... / Chapa AAAA 123"
                  className="w-full box-border bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 outline-none transition-colors font-mono"
                />
              </div>
            </div>
          </div>

          {/* Tarjeta 2: Datos del Cliente */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                <UserIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Datos del Cliente</h3>
                <p className="text-[11px] text-slate-500">Selecciona desde el Fichero de Personas o ingresa manualmente.</p>
              </div>
            </div>

            {personas.length > 0 && (
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Selector Rápido (Fichero de Personas — Opcional)
                </label>
                <select
                  value={selectedPersonaId}
                  onChange={(e) => handleSelectPersona(e.target.value)}
                  className="w-full box-border bg-slate-50 border border-slate-200 focus:border-slate-900 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 outline-none cursor-pointer"
                >
                  <option value="">-- Seleccionar cliente registrado o cargar abajo --</option>
                  {personas.map((p) => {
                    const labelName =
                      p.nombre_o_razon_social ||
                      [p.nombre, p.apellido].filter(Boolean).join(' ').trim();
                    const docStr = p.nro_documento || p.documento_numero || '';
                    return (
                      <option key={p.id} value={p.id}>
                        {labelName}
                        {docStr ? ` (${docStr})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Nombre del Cliente
                </label>
                <input
                  type="text"
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  placeholder="Ej: Marcos Benítez"
                  className="w-full box-border bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Teléfono / WhatsApp
                </label>
                <input
                  type="text"
                  value={clienteTelefono}
                  onChange={(e) => setClienteTelefono(e.target.value)}
                  placeholder="Ej: 0981 123 456"
                  className="w-full box-border bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Tarjeta 3: Parámetros del Plan de Financiación */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Plan de Financiación</h3>
                <p className="text-[11px] text-slate-500">Cálculo automático en tiempo real.</p>
              </div>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => handleCurrencyChange('PYG')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                    moneda === 'PYG'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Gs. (Guaraníes)
                </button>
                <button
                  type="button"
                  onClick={() => handleCurrencyChange('USD')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                    moneda === 'USD'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  USD (Dólares)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Precio del Vehículo ({moneda === 'PYG' ? 'Gs.' : 'US$'}) *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={precioInput}
                  onChange={(e) => setPrecioInput(formatInputValue(e.target.value, moneda))}
                  placeholder={moneda === 'PYG' ? 'Ej: 120.000.000' : 'Ej: 18500'}
                  className="w-full box-border bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white rounded-lg px-3 py-2 text-xs font-bold text-slate-900 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Entrega Inicial ({moneda === 'PYG' ? 'Gs.' : 'US$'})
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={entregaInput}
                  onChange={(e) => setEntregaInput(formatInputValue(e.target.value, moneda))}
                  placeholder={moneda === 'PYG' ? 'Ej: 30.000.000' : 'Ej: 5000'}
                  className="w-full box-border bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white rounded-lg px-3 py-2 text-xs font-bold text-slate-900 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Recibe Vehículo a Cuenta (Opcional)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={vehiculoCuentaInput}
                  onChange={(e) => setVehiculoCuentaInput(formatInputValue(e.target.value, moneda))}
                  placeholder={moneda === 'PYG' ? 'Ej: 25.000.000' : 'Ej: 3500'}
                  className="w-full box-border bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white rounded-lg px-3 py-2 text-xs font-bold text-slate-900 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Detalle Vehículo a Cuenta (Opcional)
                </label>
                <input
                  type="text"
                  value={vehiculoCuentaDetalle}
                  onChange={(e) => setVehiculoCuentaDetalle(e.target.value)}
                  placeholder="Ej: Kia Rio 2018"
                  className="w-full box-border bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Cantidad de Cuotas
                  </label>
                  <div className="flex items-center gap-1">
                    {[12, 18, 24, 36, 48].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setCantidadCuotasInput(String(n))}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border cursor-pointer transition-colors ${
                          cantidadCuotasInput === String(n)
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cantidadCuotasInput}
                  onChange={(e) => setCantidadCuotasInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ej: 24"
                  className="w-full box-border bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white rounded-lg px-3 py-2 text-xs font-bold text-slate-900 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Cantidad de Refuerzos (Opcional)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cantidadRefuerzosInput}
                  onChange={(e) => setCantidadRefuerzosInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ej: 2"
                  className="w-full box-border bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white rounded-lg px-3 py-2 text-xs font-bold text-slate-900 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Monto por Refuerzo (Opcional)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={montoRefuerzoInput}
                  onChange={(e) => setMontoRefuerzoInput(formatInputValue(e.target.value, moneda))}
                  placeholder={moneda === 'PYG' ? 'Ej: 5.000.000' : 'Ej: 1000'}
                  className="w-full box-border bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white rounded-lg px-3 py-2 text-xs font-bold text-slate-900 outline-none font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Gastos de Transferencia / Escribanía (Opcional)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={gastosTransferenciaInput}
                  onChange={(e) => setGastosTransferenciaInput(formatInputValue(e.target.value, moneda))}
                  placeholder={moneda === 'PYG' ? 'Ej: 3.500.000' : 'Ej: 500'}
                  className="w-full box-border bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white rounded-lg px-3 py-2 text-xs font-bold text-slate-900 outline-none font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Notas / Condiciones Adicionales (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Ej: Incluye verificación física y gestión de transferencia ante escribanía."
                  className="w-full box-border bg-slate-50 border border-slate-200 focus:border-slate-900 focus:bg-white rounded-lg px-3 py-2 text-xs font-medium text-slate-900 outline-none resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Columna derecha: Resumen calculado en tiempo real + Acciones */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-20">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Resumen del Plan</h3>
                <p className="text-[11px] text-slate-500">{playaBranding.nombre}</p>
              </div>
              <span className="text-[11px] font-mono font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                {moneda}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-slate-700">
                <span>Precio del Vehículo</span>
                <span className="font-mono font-semibold text-slate-900">
                  {formatMoney(calculos.precioVehiculo, moneda)}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>(-) Entrega Inicial</span>
                <span className="font-mono">
                  {formatMoney(calculos.entregaInicial, moneda)}
                </span>
              </div>

              {calculos.vehiculoACuenta > 0 && (
                <div className="flex items-center justify-between text-slate-600">
                  <span className="truncate pr-2">
                    (-) Vehículo a Cuenta{vehiculoCuentaDetalle ? ` (${vehiculoCuentaDetalle})` : ''}
                  </span>
                  <span className="font-mono shrink-0">
                    {formatMoney(calculos.vehiculoACuenta, moneda)}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="font-semibold text-slate-900">Saldo a Financiar</span>
                <span className="font-mono font-bold text-sm text-slate-900">
                  {formatMoney(calculos.saldoAFinanciar, moneda)}
                </span>
              </div>

              {calculos.totalRefuerzos > 0 && (
                <>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>
                      (-) Refuerzos ({calculos.cantidadRefuerzos} x {formatMoney(calculos.montoRefuerzo, moneda)})
                    </span>
                    <span className="font-mono">{formatMoney(calculos.totalRefuerzos, moneda)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700 font-medium">
                    <span>Saldo Financiado en Cuotas</span>
                    <span className="font-mono">{formatMoney(calculos.saldoEnCuotas, moneda)}</span>
                  </div>
                </>
              )}

              {calculos.gastosTransferencia > 0 && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-600">
                  <span>Gastos de Transferencia / Escribanía</span>
                  <span className="font-mono font-medium text-slate-800">
                    {formatMoney(calculos.gastosTransferencia, moneda)}
                  </span>
                </div>
              )}
            </div>

            {/* Resultado de Cuotas */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Monto por Cuota ({calculos.cantidadCuotas} cuotas)
              </p>
              <p className="text-2xl font-bold text-slate-900 font-mono tracking-tight">
                {formatMoney(calculos.montoPorCuota, moneda)}
              </p>
              {calculos.totalRefuerzos > 0 && (
                <p className="text-[11px] text-slate-600">
                  + {calculos.cantidadRefuerzos} refuerzo(s) de{' '}
                  <span className="font-semibold font-mono">
                    {formatMoney(calculos.montoRefuerzo, moneda)}
                  </span>
                </p>
              )}
            </div>

            {/* Switch visible de Membrete (mismo estilo que Gestión de Escritos) */}
            <button
              type="button"
              role="switch"
              aria-checked={incluirMembrete}
              onClick={() => setIncluirMembrete((prev) => !prev)}
              className={`w-full h-10 inline-flex items-center justify-between gap-2 px-3.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer select-none ${
                incluirMembrete
                  ? 'bg-slate-50 border-slate-300 text-slate-900'
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
              title="Activar o desactivar el membrete comercial en el PDF exportado"
            >
              <span>{incluirMembrete ? 'Membrete: ACTIVO' : 'Membrete: OCULTO'}</span>
              <span
                className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                  incluirMembrete ? 'bg-slate-900' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    incluirMembrete ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`}
                />
              </span>
            </button>

            {/* Botones de Acción */}
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                disabled={guardando}
                onClick={handleGuardarCotizacion}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>{guardando ? 'Guardando...' : 'Guardar Cotización'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportarPdfActual}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-900 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Exportar PDF</span>
              </button>

              {canUseWhatsApp && (
                <button
                  type="button"
                  onClick={handleEnviarWhatsAppActual}
                  className="w-full py-2.5 px-4 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-800 hover:text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>Enviar PDF por WhatsApp</span>
                </button>
              )}

              <button
                type="button"
                onClick={limpiarFormulario}
                className="w-full py-2 px-4 bg-transparent hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Historial de Cotizaciones Guardadas */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Historial de Cotizaciones ({cotizaciones.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                Visualiza, carga o reimprime cotizaciones anteriores guardadas en la nube.
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busquedaHistorial}
              onChange={(e) => setBusquedaHistorial(e.target.value)}
              placeholder="Buscar cliente, vehículo o COT-..."
              className="w-full box-border bg-slate-50 border border-slate-200 focus:border-slate-900 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none"
            />
          </div>
        </div>

        {loadingHistorial ? (
          <div className="py-8 text-center text-xs text-slate-500">
            Cargando cotizaciones...
          </div>
        ) : historialFiltrado.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
            {cotizaciones.length === 0
              ? 'Todavía no guardaste ninguna cotización. Completa el formulario superior y haz clic en "Guardar Cotización".'
              : 'No se encontraron cotizaciones con ese criterio de búsqueda.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {historialFiltrado.map((item) => {
              const vehDesc = [item.vehiculo?.marca, item.vehiculo?.modelo, item.vehiculo?.anio]
                .filter(Boolean)
                .join(' ');
              return (
                <div
                  key={item.id}
                  className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-mono font-bold text-slate-900 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                        {item.numeroCotizacion}
                      </span>
                      <span className="text-xs font-semibold text-slate-900 truncate">
                        {item.cliente?.nombre || 'Cliente sin especificar'}
                      </span>
                      {vehDesc && (
                        <span className="text-xs text-slate-500 truncate">• {vehDesc}</span>
                      )}
                      <span className="text-[11px] text-slate-400">
                        {formatFechaDisplay(item.fecha)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-mono">
                      Precio: {formatMoney(item.financiacion?.precioVehiculo || 0, item.moneda || 'PYG')}
                      {' · '}
                      Entrega: {formatMoney(item.financiacion?.entregaInicial || 0, item.moneda || 'PYG')}
                      {' · '}
                      <span className="font-semibold text-slate-900">
                        {item.financiacion?.cantidadCuotas || 0} cuotas de{' '}
                        {formatMoney(item.financiacion?.montoPorCuota || 0, item.moneda || 'PYG')}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCargarDesdeHistorial(item)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Cargar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReimprimirPdfHistorial(item)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>

                    {confirmDeleteId === item.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEliminarCotizacion(item.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold cursor-pointer"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-[11px] cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(item.id)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 cursor-pointer transition-colors"
                        title="Eliminar cotización"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {canUseWhatsApp && waModalData && (
        <WhatsAppSendModal
          isOpen={waModalData.isOpen}
          onClose={() => setWaModalData(null)}
          workspaceId={effectiveWorkspaceId}
          documentTitle={waModalData.documentTitle}
          defaultMessage={waModalData.defaultMessage}
          fileBase64={waModalData.fileBase64}
          fileName={waModalData.fileName}
          mimetype="application/pdf"
        />
      )}
    </div>
  );
};
