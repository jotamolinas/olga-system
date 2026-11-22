import React, { useRef, useEffect, useState } from 'react';
import { Pagare, Persona, GlobalConfig, formatCurrencyValue } from '../types';
import { Award, Printer, Download, Sparkles, RefreshCw, Layers, Shield, FileText, CheckCircle, Clipboard, Check, Save, AlertCircle, X, MessageCircle } from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import { useTrialStatus } from '../hooks/useTrialStatus';
import { auth, db } from '../services/auth';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { WhatsAppSendModal } from './WhatsAppSendModal';
import { generatePagarePdfBase64 } from '../services/pdfExport';

interface PagarePDFPreviewProps {
  pagare: Pagare | null;
  personas: Persona[];
  config: GlobalConfig;
  onClose: () => void;
  userData?: any;
  onUpdatePagare?: (pagare: Pagare) => void;
  canUseWhatsApp?: boolean;
}

export const getMonedaInfo = (monedaCode: string = 'PYG') => {
  const code = (monedaCode || 'PYG').toUpperCase();
  if (code === 'USD') {
    return {
      nombreMayus: 'DÓLARES AMERICANOS',
      simbolo: 'US$'
    };
  }
  if (code === 'BRL') {
    return {
      nombreMayus: 'REALES',
      simbolo: 'R$'
    };
  }
  return {
    nombreMayus: 'GUARANIES',
    simbolo: 'Gs.'
  };
};

const getMesNombre = (mesIndex: number) => {
  const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  return meses[mesIndex] || '';
};

/**
 * Función notarial estricta para formato limpio de Documentos de Identidad (Cédulas y RUC).
 * - Elimina por completo los puntos de separación de miles en los números enteros (ej. '1.234.567' -> '1234567').
 * - Mantiene de forma limpia y estructurada los RUCs con su número base seguido de un guion y su dígito verificador (ej. '80012345-6' o '80.012.345-6' -> '80012345-6'), sin puntos intermedios en ninguna parte.
 */
export const formatDocClean = (doc: string | number | null | undefined): string => {
  if (doc === null || doc === undefined) return '';
  const str = String(doc).trim();
  if (!str) return '';
  
  // Si contiene guion (estructura de RUC con dígito verificador)
  if (str.includes('-')) {
    const parts = str.split('-');
    const base = parts[0].replace(/[^0-9]/g, '');
    const dv = parts.slice(1).join('').replace(/[^0-9a-zA-Z]/g, '');
    return dv ? `${base}-${dv}` : base;
  }
  
  // Para cédula de identidad: elimina todos los puntos de miles
  return str.replace(/\./g, '').trim();
};

const EditableField = ({ value, onChange, onBlur, className, style, placeholder, disabled }: any) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [localValue, setLocalValue] = useState(() => String(value ?? ''));

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocalValue(String(value ?? ''));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalValue(raw);
    onChange(raw);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        size={Math.max(localValue.length || 1, 3)}
        onChange={handleChange}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={`bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors print:hidden ${className || ''}`}
        style={style}
      />
      <span className={`hidden print:inline ${className || ''}`} style={style}>
        {localValue}
      </span>
    </>
  );
};

export const sanitizeNotarialText = (text: string | null | undefined): string => {
  return (text || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
};

export const numberToWords = (num: number): string => {
  if (num === null || num === undefined || isNaN(num)) return 'CERO';
  const absNum = Math.abs(num);
  const enterocero = Math.floor(absNum);
  const centavos = Math.round((absNum - enterocero) * 100);

  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const diez_diecinueve = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const veintis = ['VEINTE', 'VEINTIUN', 'VEINTIDOS', 'VEINTITRES', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISEIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  function getTriplets(n: number) {
    const intN = Math.floor(n);
    if (intN === 0) return '';
    if (intN === 100) return 'CIEN';
    let res = '';
    const c = Math.floor(intN / 100);
    const d = Math.floor((intN % 100) / 10);
    const u = intN % 10;

    if (c > 0 && c < centenas.length) {
      if (c === 1 && (intN % 100) === 0) res += 'CIEN ';
      else res += centenas[c] + ' ';
    }

    if (d === 1) {
      res += (diez_diecinueve[u] || '') + ' ';
    } else if (d === 2) {
      if (u === 0) res += 'VEINTE ';
      else res += (veintis[u] || '') + ' ';
    } else {
      if (d > 0 && d < decenas.length) {
        res += decenas[d] + ' ';
        if (u > 0) res += 'Y ';
      }
      if (u > 0 && u < unidades.length) {
        res += unidades[u] + ' ';
      }
    }
    return res.trim();
  }

  let str = '';
  if (enterocero === 0) {
    str = 'CERO';
  } else {
    const millones = Math.floor(enterocero / 1000000);
    const miles = Math.floor((enterocero % 1000000) / 1000);
    const restos = enterocero % 1000;

    if (millones > 0) {
      if (millones === 1) str += 'UN MILLON ';
      else str += getTriplets(millones) + ' MILLONES ';
    }
    if (miles > 0) {
      if (miles === 1) str += 'MIL ';
      else str += getTriplets(miles) + ' MIL ';
    }
    if (restos > 0) {
      str += getTriplets(restos);
    }
    str = str.trim();
  }

  if (centavos > 0) {
    const centavosStr = String(centavos).padStart(2, '0');
    str += ` CON ${centavosStr}/100`;
  }

  return str.trim();
};

export const generateMirroredText = (
  masterText: string,
  targetCuota: any,
  monedaCode: string = 'PYG'
): string => {
  if (!masterText) return '';
  const monInfo = getMonedaInfo(monedaCode);
  const diaLetrasK = numberToWords(new Date(targetCuota.fecha_pag + 'T12:00:00').getDate()).trim().toUpperCase();
  const mesNombreK = getMesNombre(new Date(targetCuota.fecha_pag + 'T12:00:00').getMonth()).trim().toUpperCase();
  const anioLetrasK = numberToWords(new Date(targetCuota.fecha_pag + 'T12:00:00').getFullYear()).trim().toUpperCase();
  const montoLetrasK = numberToWords(targetCuota.monto).trim().toUpperCase();
  const montoSimboloK = `${monInfo.simbolo} ${formatCurrencyValue(targetCuota.monto, monedaCode || 'PYG').trim()}`;

  const fechaFmtK = `${diaLetrasK} de ${mesNombreK} del año ${anioLetrasK}`;
  const montoFmtK = `${monInfo.nombreMayus} ${montoLetrasK} (${montoSimboloK})`;

  let mirroredText = masterText.replace(/<\/?b>/g, '');

  // Reemplazo dinámico de la cláusula de vencimiento
  mirroredText = mirroredText.replace(
    /El día\s+[^,]+,\s*pagaremos/i,
    `El día ${fechaFmtK}, pagaremos`
  );

  // Reemplazo dinámico del monto en letras y números
  mirroredText = mirroredText.replace(
    /la suma de:\s+[^.]+(?=\. QUEDA)/i,
    `la suma de: ${montoFmtK}`
  );

  return mirroredText && mirroredText.trim() ? mirroredText : masterText.replace(/<\/?b>/g, '');
};

interface NotarialCiudadInputProps {
  value: string;
  onChangeCiudad: (newCiudad: string) => void;
}

export const NotarialCiudadInput: React.FC<NotarialCiudadInputProps> = ({ value, onChangeCiudad }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [localText, setLocalText] = useState(value);

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocalText(value);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalText(val);
    onChangeCiudad(val);
    try {
      if (typeof window !== 'undefined' && val.trim()) {
        localStorage.setItem('olga_ultima_ciudad_pagare', val.trim());
      }
    } catch {}
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={localText}
      onChange={handleChange}
      placeholder="CIUDAD"
      className="bg-transparent outline-none border-b border-slate-300 hover:border-slate-400 focus:border-slate-500 text-sm font-sans text-slate-900 uppercase print:hidden px-1"
      style={{ width: localText ? `${Math.max(localText.length + 1, 6)}ch` : '90px' }}
    />
  );
};

interface NotarialTextareaProps {
  value: string;
  htmlValue: string;
  onCommit: (val: string) => void;
  onImmediateChange?: (val: string) => void;
  isMaster: boolean;
  onReset?: () => void;
}

export const NotarialTextarea: React.FC<NotarialTextareaProps> = ({
  value,
  htmlValue,
  onCommit,
  onImmediateChange,
  isMaster,
  onReset
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isEditingRef = useRef(false);
  const lastValueRef = useRef(value);

  useEffect(() => {
    if (containerRef.current && !isEditingRef.current && document.activeElement !== containerRef.current) {
      containerRef.current.innerHTML = htmlValue;
    }
    lastValueRef.current = value;
  }, [value, htmlValue]);

  const handleInput = () => {
    if (containerRef.current) {
      const text = containerRef.current.innerText || containerRef.current.textContent || '';
      if (onImmediateChange) {
        onImmediateChange(text);
      }
    }
  };

  const handleBlur = () => {
    isEditingRef.current = false;
    if (containerRef.current) {
      const text = containerRef.current.innerText || containerRef.current.textContent || '';
      onCommit(text);
    }
  };

  const handleFocus = () => {
    isEditingRef.current = true;
  };

  return (
    <div className="print:hidden">
      <div className="group relative">
        <div
          ref={containerRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onBlur={handleBlur}
          onFocus={handleFocus}
          className="text-[13px] leading-relaxed text-slate-900 text-justify font-sans whitespace-pre-wrap outline-none p-1 rounded hover:bg-slate-50/80 focus:bg-slate-50 focus:ring-1 focus:ring-blue-400 border border-transparent focus:border-blue-300 transition-colors cursor-text"
          title="Haga clic para editar el texto directamente"
        />
        <div className="flex justify-between items-center mt-1">
          <span className="text-[10px] text-slate-400 italic">
            * Edición directa habilitada. El cursor se mantiene en su posición al escribir.
          </span>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="text-[10px] text-blue-600 hover:text-blue-800 underline font-medium cursor-pointer"
            >
              {isMaster ? 'Restablecer todas las cuotas al texto generado' : 'Restablecer texto generado'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


export function mostrarToastNotarial(mensaje: string, tipo: 'success' | 'error' = 'success') {
  if (typeof document === 'undefined') return;

  const toastId = 'olga-notarial-bg-toast';
  const existingToast = document.getElementById(toastId);
  if (existingToast) {
    existingToast.remove();
  }

  const toastContainer = document.createElement('div');
  toastContainer.id = toastId;
  toastContainer.className = `fixed bottom-6 right-6 z-[99999] max-w-md px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold backdrop-blur-md transition-all duration-300 transform translate-y-0 opacity-100 ${
    tipo === 'success'
      ? 'bg-slate-900/95 text-white border border-emerald-500/40 shadow-emerald-500/10'
      : 'bg-red-950/95 text-red-100 border border-red-500/50 shadow-red-500/20'
  }`;

  const iconSvg = tipo === 'success'
    ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><polyline points="20 6 9 17 4 12"/></svg>'
    : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>';

  toastContainer.innerHTML = `
    ${iconSvg}
    <div class="flex flex-col">
      <span class="tracking-wide">${mensaje}</span>
      <span class="text-[10px] font-normal ${tipo === 'success' ? 'text-slate-400' : 'text-red-300/80'}">Matriz de Certificación Notarial</span>
    </div>
    <button type="button" class="ml-3 text-slate-400 hover:text-white transition-colors cursor-pointer" onclick="this.parentElement.remove()">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
  `;

  document.body.appendChild(toastContainer);

  const duracion = tipo === 'success' ? 3500 : 7000;
  setTimeout(() => {
    if (toastContainer.parentNode) {
      toastContainer.style.opacity = '0';
      toastContainer.style.transform = 'translateY(10px)';
      setTimeout(() => {
        if (toastContainer.parentNode) {
          toastContainer.parentNode.removeChild(toastContainer);
        }
      }, 300);
    }
  }, duracion);
}

export const PagarePDFPreview: React.FC<PagarePDFPreviewProps> = ({
  pagare,
  personas,
  config,
  onClose,
  userData,
  onUpdatePagare,
  canUseWhatsApp,
}) => {
  const isWhatsAppEnabled =
    typeof canUseWhatsApp === 'boolean'
      ? canUseWhatsApp
      : auth?.currentUser?.email === 'jotamolinas@gmail.com' || Boolean(userData?.whatsappEnabled);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const esNotaria = String(userData?.tipoPerfil || config?.escribania?.nombre || '').toLowerCase().includes('escriban') || String(userData?.tipoPerfil || '').toLowerCase().includes('notar');
  const [pageSize, setPageSize] = useState<'legal' | 'a4'>('legal');
  const [baseCertificadoNro, setBaseCertificadoNro] = useState(() => {
    if (pagare?.certificado_firmas_nro) return pagare.certificado_firmas_nro;
    try {
      const saved = localStorage.getItem('olga_ultimo_certificado_firmas');
      if (saved) return saved;
    } catch {}
    return '';
  });

  useEffect(() => {
    try {
      if (baseCertificadoNro && baseCertificadoNro.trim()) {
        localStorage.setItem('olga_ultimo_certificado_firmas', baseCertificadoNro.trim());
      }
    } catch {}
  }, [baseCertificadoNro]);

  // Ciudad de emisión dinámica: extrae de userData o config, sin texto por defecto hardcodeado (elimina 'Hernandarias')
  const configCiudad = sanitizeNotarialText(
    userData?.ciudad ||
    config?.escribania?.ciudad ||
    (config?.escribania?.localidad && !config.escribania.localidad.toLowerCase().includes('hernandarias') ? config.escribania.localidad : '') ||
    ''
  );

  const getInitialCiudad = (): string => {
    const directCiudad = 
      (pagare as any)?.ciudadEmision || 
      (pagare as any)?.ciudad || 
      (pagare as any)?.ciudad_emision;
    if (directCiudad && typeof directCiudad === 'string') {
      const sanitized = sanitizeNotarialText(directCiudad);
      if (sanitized && !sanitized.toLowerCase().includes('hernandarias')) {
        return sanitized;
      }
    }
    const cuota0Ciudad = 
      (pagare?.cronograma?.[0] as any)?.ciudadEmision ||
      (pagare?.cronograma?.[0] as any)?.ciudad ||
      (pagare?.cronograma?.[0] as any)?.ciudad_emision;
    if (cuota0Ciudad && typeof cuota0Ciudad === 'string') {
      const sanitized = sanitizeNotarialText(cuota0Ciudad);
      if (sanitized && !sanitized.toLowerCase().includes('hernandarias')) {
        return sanitized;
      }
    }
    if (pagare?.fechaLugarEmision) {
      const parts = pagare.fechaLugarEmision.split(',');
      if (parts.length > 1) {
        const candidate = sanitizeNotarialText(parts[0]);
        if (candidate && !candidate.toLowerCase().includes('hernandarias') && !candidate.includes('_____')) {
          return candidate;
        }
      }
    }
    if (configCiudad && !configCiudad.toLowerCase().includes('hernandarias')) {
      return configCiudad;
    }
    try {
      if (typeof window !== 'undefined') {
        const savedLast = localStorage.getItem('olga_ultima_ciudad_pagare');
        if (savedLast && !savedLast.toLowerCase().includes('hernandarias')) {
          return sanitizeNotarialText(savedLast);
        }
      }
    } catch {}
    return '';
  };

  const [ciudadEmision, setCiudadEmision] = useState<string>(getInitialCiudad);
  const ciudadEmisionRef = useRef<string>(getInitialCiudad());

  const fechaEmisionDate = pagare?.created_at ? new Date(pagare.created_at) : new Date();
  const fechaEmisionSoloTexto = `${fechaEmisionDate.getDate()} de ${getMesNombre(fechaEmisionDate.getMonth()).toLowerCase().trim()} de ${fechaEmisionDate.getFullYear()}.-`;
  const fechaEmisionTexto = `, ${fechaEmisionSoloTexto}`;

  const getInitialTasa = (): string => {
    // 1. Campo directo en pagaré
    const directInteres = (pagare as any)?.interesPersonalizado || (pagare as any)?.tasaInteres || (pagare as any)?.tasa_interes;
    if (directInteres && String(directInteres).trim() && String(directInteres).trim() !== '_____') {
      const clean = String(directInteres).replace(/%+$/, '').trim();
      if (clean) return clean;
    }
    // 2. Campo directo en cuota 0
    const cuota1 = pagare?.cronograma?.[0] as any;
    const cuota1Interes = cuota1?.interesPersonalizado || cuota1?.tasaInteres || cuota1?.tasa_interes;
    if (cuota1Interes && String(cuota1Interes).trim() && String(cuota1Interes).trim() !== '_____') {
      const clean = String(cuota1Interes).replace(/%+$/, '').trim();
      if (clean) return clean;
    }
    // 3. Extracción por patrón regex en texto guardado de cuota 0 o pagaré
    const cuota1Text = 
      (pagare as any)?.textosCuotas?.[0] || 
      cuota1?.texto_personalizado || 
      cuota1?.textoPersonalizado || 
      cuota1?.textoCuerpo || 
      cuota1?.contenido || 
      (pagare as any)?.texto_personalizado || 
      (pagare as any)?.textoPersonalizado || 
      (pagare as any)?.textoCuerpo || 
      (pagare as any)?.contenido;
    if (cuota1Text) {
      const match = cuota1Text.match(/un interés del\s+([^\s%]+)\s*%/i);
      if (match && match[1] && match[1] !== '_____') {
        return match[1].trim();
      }
    }
    return '_____';
  };

  const [tasaInteres, setTasaInteres] = useState<string>(getInitialTasa);
  const tasaInteresRef = useRef<string>(getInitialTasa());
  const [clausulaPenal, setClausulaPenal] = useState((pagare as any)?.clausulaPenal || '454');
  const [moraAutomatica, setMoraAutomatica] = useState((pagare as any)?.moraAutomatica || '424');
  const [dispensaProtesto, setDispensaProtesto] = useState((pagare as any)?.dispensaProtesto || '1349');
  const { workspaceId } = useWorkspace(auth?.currentUser, userData);
  const [copiedSupport, setCopiedSupport] = useState(false);
  const [supportToast, setSupportToast] = useState(false);

  const initialDeudor = personas.find(p => p.id === pagare?.deudor_id);
  const initialDeudorNombre = sanitizeNotarialText(pagare?.deudor_nombre_raw || (initialDeudor ? (initialDeudor.nombre + (initialDeudor.apellido ? ' ' + initialDeudor.apellido : '')) : ''));
  const initialDeudorDocumento = formatDocClean(pagare?.deudor_documento_raw || (initialDeudor ? initialDeudor.nro_documento : '')).trim();
  const rawDeudorDom = sanitizeNotarialText(pagare?.deudor_domicilio_raw || (initialDeudor ? initialDeudor.domicilio : ''));
  const initialDeudorDomicilio = (rawDeudorDom && rawDeudorDom.toUpperCase() !== 'NO ESPECIFICADO') ? rawDeudorDom : '';

  const initialCodeudor1 = personas.find(p => p.id === pagare?.codeudor1_id);
  const initialCodeudor1Nombre = sanitizeNotarialText(pagare?.codeudor1_nombre_raw || (initialCodeudor1 ? (initialCodeudor1.nombre + (initialCodeudor1.apellido ? ' ' + initialCodeudor1.apellido : '')) : ''));
  const initialCodeudor1Documento = formatDocClean(pagare?.codeudor1_documento_raw || (initialCodeudor1 ? initialCodeudor1.nro_documento : '')).trim();
  const rawCodeudor1Dom = sanitizeNotarialText(pagare?.codeudor1_domicilio_raw || (initialCodeudor1 ? initialCodeudor1.domicilio : ''));
  const initialCodeudor1Domicilio = (rawCodeudor1Dom && rawCodeudor1Dom.toUpperCase() !== 'NO ESPECIFICADO') ? rawCodeudor1Dom : '';

  const initialCodeudor2 = personas.find(p => p.id === pagare?.codeudor2_id);
  const initialCodeudor2Nombre = sanitizeNotarialText(pagare?.codeudor2_nombre_raw || (initialCodeudor2 ? (initialCodeudor2.nombre + (initialCodeudor2.apellido ? ' ' + initialCodeudor2.apellido : '')) : ''));
  const initialCodeudor2Documento = formatDocClean(pagare?.codeudor2_documento_raw || (initialCodeudor2 ? initialCodeudor2.nro_documento : '')).trim();
  const rawCodeudor2Dom = sanitizeNotarialText(pagare?.codeudor2_domicilio_raw || (initialCodeudor2 ? initialCodeudor2.domicilio : ''));
  const initialCodeudor2Domicilio = (rawCodeudor2Dom && rawCodeudor2Dom.toUpperCase() !== 'NO ESPECIFICADO') ? rawCodeudor2Dom : '';

  const rawAcreedorDom = sanitizeNotarialText(pagare?.acreedor_domicilio_raw || '');
  const [acreedorNombreEditable, setAcreedorNombreEditable] = useState(sanitizeNotarialText(pagare?.acreedor_nombre_raw || ''));
  const [acreedorDocumentoEditable, setAcreedorDocumentoEditable] = useState(
    formatDocClean(pagare?.acreedor_documento_raw || personas.find(p => p.id === pagare?.acreedor_id)?.nro_documento || '')
  );
  const [acreedorDomicilioEditable, setAcreedorDomicilioEditable] = useState(
    (rawAcreedorDom && rawAcreedorDom.toUpperCase() !== 'NO ESPECIFICADO') ? rawAcreedorDom : ''
  );
  const [deudorNombreEditable, setDeudorNombreEditable] = useState(initialDeudorNombre);
  const [deudorDocumentoEditable, setDeudorDocumentoEditable] = useState(formatDocClean(initialDeudorDocumento));
  const [deudorDomicilioEditable, setDeudorDomicilioEditable] = useState(initialDeudorDomicilio);

  const [codeudor1NombreEditable, setCodeudor1NombreEditable] = useState(initialCodeudor1Nombre);
  const [codeudor1DocumentoEditable, setCodeudor1DocumentoEditable] = useState(formatDocClean(initialCodeudor1Documento));
  const [codeudor1DomicilioEditable, setCodeudor1DomicilioEditable] = useState(initialCodeudor1Domicilio);

  const [codeudor2NombreEditable, setCodeudor2NombreEditable] = useState(initialCodeudor2Nombre);
  const [codeudor2DocumentoEditable, setCodeudor2DocumentoEditable] = useState(formatDocClean(initialCodeudor2Documento));
  const [codeudor2DomicilioEditable, setCodeudor2DomicilioEditable] = useState(initialCodeudor2Domicilio);

  const generateDefaultText = (item: any): string => {
    const diaLetras = numberToWords(new Date(item.fecha_pag + 'T12:00:00').getDate()).trim().toUpperCase();
    const mesNombre = getMesNombre(new Date(item.fecha_pag + 'T12:00:00').getMonth()).trim().toUpperCase();
    const anioLetras = numberToWords(new Date(item.fecha_pag + 'T12:00:00').getFullYear()).trim().toUpperCase();
    
    const rawAcNombre = (typeof acreedorNombreEditable !== 'undefined' ? acreedorNombreEditable : null) || pagare?.acreedor_nombre_raw || personas.find(p => p.id === pagare?.acreedor_id)?.nombre || '';
    const acreedorLimpio = sanitizeNotarialText(rawAcNombre).toUpperCase();

    const rawAcDoc = (typeof acreedorDocumentoEditable !== 'undefined' ? acreedorDocumentoEditable : null) || pagare?.acreedor_documento_raw || personas.find(p => p.id === pagare?.acreedor_id)?.nro_documento || '';
    const acreedorDocLimpio = formatDocClean(rawAcDoc).trim();

    const monInfo = getMonedaInfo(pagare?.moneda);
    const montoLetras = numberToWords(item.monto).trim().toUpperCase();
    const montoSimbolo = `${monInfo.simbolo} ${formatCurrencyValue(item.monto, pagare?.moneda || 'PYG').trim()}`;
    
    const rawCiudad = (typeof ciudadEmisionRef !== 'undefined' ? ciudadEmisionRef.current : null) || (typeof ciudadEmision !== 'undefined' ? ciudadEmision : null) || (pagare as any)?.ciudad_emision || (pagare as any)?.ciudadEmision || (pagare as any)?.ciudad || userData?.ciudad || config?.escribania?.ciudad || 'ASUNCIÓN';
    const ciudadStr = sanitizeNotarialText(rawCiudad).toUpperCase();

    const rawDepto = (pagare as any)?.departamento_emision || (pagare as any)?.departamentoEmision || userData?.departamento || (config?.escribania as any)?.departamento || 'CAPITAL';
    const deptoStr = sanitizeNotarialText(rawDepto).toUpperCase();

    const fechaFmt = `${diaLetras} de ${mesNombre} del año ${anioLetras}`;
    const acreedorFmt = `${acreedorLimpio}`;
    const acreedorDocFmt = `${acreedorDocLimpio}`;
    const montoFmt = `${monInfo.nombreMayus} ${montoLetras} (${montoSimbolo})`;

    return `El día ${fechaFmt}, pagaremos a ${acreedorFmt}, con Cédula de Identidad Civil N°${acreedorDocFmt}, la suma de: ${montoFmt}. QUEDA EXPRESAMENTE CONVENIDO QUE LA FALTA DE PAGO DEL PRESENTE PAGARÉ (CUOTA) PRODUCIRÁ LA CADUCIDAD DE LOS PLAZOS DE LOS DEMÁS PAGARÉS (CUOTAS). SI POR CUALQUIER CIRCUNSTANCIA NO FUERE ABONADO ESTE DOCUMENTO A SU VENCIMIENTO, DEVENGARÁ DURANTE EL TIEMPO DE LA MORA LA TASA MÁXIMA DE INTERÉS ESTABLECIDA POR EL BANCO CENTRAL DEL PARAGUAY ART. 475 C.C., POR SIMPLE RETARDO, SIN QUE ESTO IMPLIQUE ESPERA NI PRORROGA EN EL PLAZO DE LA OBLIGACIÓN, EL VENCIMIENTO ESTABLECERÁ LA MORA. PARA TODOS LOS EFECTOS JUDICIALES Y EXTRAJUDICIALES A QUE DÉ LUGAR ESTA OBLIGACIÓN CONSTITUIMOS EL DOMICILIO QUE MÁS ABAJO SE INDICA. ESTE PAGARÉ SE REGIRÁ A TODOS LOS EFECTOS POR LAS LEYES DE PARAGUAY. SERÁN COMPETENTES PARA ENTENDER EN LOS JUICIOS A QUE DÉ LUGAR ESTA OBLIGACIÓN, LOS TRIBUNALES COMPETENTES DE <strong>${ciudadStr}, ${deptoStr}, PARAGUAY.-</strong>`;
  };

  // Inicialización de textos personalizados desde todas las propiedades alias posibles y textosCuotas
  const getInitialCustomMap = (): { [id: string]: string } => {
    const initialMap: { [id: string]: string } = {};
    const cronograma = pagare?.cronograma || [];
    const savedTextosCuotas = (pagare as any)?.textosCuotas;

    cronograma.forEach((it: any, idx: number) => {
      let text = it.texto_personalizado || it.textoPersonalizado || it.textoCuerpo || it.contenido;
      if (!text && savedTextosCuotas) {
        if (Array.isArray(savedTextosCuotas)) {
          text = savedTextosCuotas[idx];
        } else if (typeof savedTextosCuotas === 'object') {
          text = savedTextosCuotas[it.id] || savedTextosCuotas[idx] || savedTextosCuotas[`cuota_${idx}`];
        }
      }
      if (text && typeof text === 'string' && text.trim()) {
        const clean = text.replace(/<\/?b>/g, '');
        initialMap[it.id] = clean;
        initialMap[`idx_${idx}`] = clean;
      }
    });

    const cuota0Id = cronograma[0]?.id;
    const cuota0Text = cuota0Id ? (initialMap[cuota0Id] || generateDefaultText(cronograma[0])) : null;

    cronograma.forEach((cuotaK: any, i: number) => {
      if (!initialMap[cuotaK.id] || !initialMap[cuotaK.id].trim()) {
        if (i === 0) {
          initialMap[cuotaK.id] = generateDefaultText(cuotaK);
          initialMap[`idx_${0}`] = initialMap[cuotaK.id];
        } else {
          const mirrored = generateMirroredText(cuota0Text || generateDefaultText(cronograma[0]), cuotaK, pagare?.moneda);
          initialMap[cuotaK.id] = mirrored;
          initialMap[`idx_${i}`] = mirrored;
        }
      }
    });

    return initialMap;
  };

  const [customTextos, setCustomTextos] = useState<{ [id: string]: string }>(getInitialCustomMap);
  const customTextosRef = useRef<{ [id: string]: string }>(getInitialCustomMap());
  const masterTextRef = useRef<string>(
    pagare?.cronograma?.[0]
      ? (customTextosRef.current[pagare.cronograma[0].id] || (pagare.cronograma[0] as any).texto_personalizado || (pagare.cronograma[0] as any).textoPersonalizado || (Array.isArray((pagare as any)?.textosCuotas) ? (pagare as any).textosCuotas[0] : '') || '')
      : ''
  );

  // Mantener sincronizado si cambia el id del pagare o sus datos guardados
  useEffect(() => {
    const initCiudad = getInitialCiudad();
    setCiudadEmision(initCiudad);
    ciudadEmisionRef.current = initCiudad;

    const initTasa = getInitialTasa();
    setTasaInteres(initTasa);
    tasaInteresRef.current = initTasa;

    const initMap = getInitialCustomMap();
    setCustomTextos(initMap);
    customTextosRef.current = initMap;
    if (pagare?.cronograma?.[0]) {
      const cuota0Id = pagare.cronograma[0].id;
      masterTextRef.current = 
        initMap[cuota0Id] || 
        initMap['idx_0'] || 
        (pagare.cronograma[0] as any).texto_personalizado || 
        (pagare.cronograma[0] as any).textoPersonalizado || 
        (Array.isArray((pagare as any)?.textosCuotas) ? (pagare as any).textosCuotas[0] : '') || 
        '';
    }
  }, [pagare?.id, (pagare as any)?.ciudadEmision, (pagare as any)?.interesPersonalizado, (pagare as any)?.created_at]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleGuardarPagare = async (andClose = false) => {
    if (!pagare) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const cleanCiudad = sanitizeNotarialText(ciudadEmisionRef.current ?? ciudadEmision);
      const fullFechaLugarEmision = cleanCiudad.trim() 
        ? `${cleanCiudad}${fechaEmisionTexto}` 
        : fechaEmisionTexto.replace(/^,\s*/, '');

      // Respaldo prioritario e inmediato en localStorage
      if (cleanCiudad.trim()) {
        try {
          localStorage.setItem('olga_ultima_ciudad_pagare', cleanCiudad.trim());
        } catch {}
      }

      // Extraer posible tasa de interés editada en el cuerpo del pagaré maestro
      const cuota0 = pagare.cronograma?.[0];
      const cuota0Id = cuota0?.id;
      const textoMaestro = 
        masterTextRef.current || 
        customTextosRef.current[cuota0Id] || 
        customTextos[cuota0Id] || 
        customTextosRef.current['idx_0'] || 
        customTextos['idx_0'] || 
        (cuota0 as any)?.texto_personalizado || 
        (cuota0 as any)?.textoPersonalizado || 
        (Array.isArray((pagare as any)?.textosCuotas) ? (pagare as any).textosCuotas[0] : null) ||
        getTextoPagare(cuota0, 0);

      const matchTasa = (textoMaestro || '').match(/un interés del\s+([^\s%]+)\s*%/i);
      let tasaInteresDetectada = matchTasa && matchTasa[1] && matchTasa[1] !== '_____' 
        ? matchTasa[1].trim() 
        : (tasaInteresRef.current || tasaInteres || (pagare as any)?.interesPersonalizado || (pagare as any)?.tasaInteres || '_____');
      if (tasaInteresDetectada.endsWith('%')) {
        tasaInteresDetectada = tasaInteresDetectada.slice(0, -1).trim();
      }

      // Aplicar sincronizadamente el efecto espejo a todas las cuotas 1..N
      const mergedCustomTextos: { [id: string]: string } = {
        ...customTextos,
        ...customTextosRef.current,
        [cuota0Id]: textoMaestro,
        'idx_0': textoMaestro
      };

      const textosCuotasArray: string[] = [textoMaestro];

      if (pagare.cronograma && pagare.cronograma.length > 1) {
        for (let i = 1; i < pagare.cronograma.length; i++) {
          const itemK = pagare.cronograma[i];
          const mirrored = generateMirroredText(textoMaestro, itemK, pagare.moneda);
          mergedCustomTextos[itemK.id] = mirrored;
          mergedCustomTextos[`idx_${i}`] = mirrored;
          customTextosRef.current[itemK.id] = mirrored;
          customTextosRef.current[`idx_${i}`] = mirrored;
          textosCuotasArray.push(mirrored);
        }
      }

      setCustomTextos(mergedCustomTextos);
      setTasaInteres(tasaInteresDetectada);
      tasaInteresRef.current = tasaInteresDetectada;
      setCiudadEmision(cleanCiudad);
      ciudadEmisionRef.current = cleanCiudad;

      const updatedCronograma = (pagare.cronograma || []).map((item, idx) => {
        const customText = idx === 0 
          ? textoMaestro 
          : (mergedCustomTextos[item.id] || textosCuotasArray[idx] || getTextoPagare(item, idx));
        return {
          ...item,
          ciudad: cleanCiudad,
          ciudadEmision: cleanCiudad,
          ciudad_emision: cleanCiudad,
          tasaInteres: tasaInteresDetectada,
          tasa_interes: tasaInteresDetectada,
          interesPersonalizado: tasaInteresDetectada,
          texto_personalizado: customText,
          textoPersonalizado: customText,
          textoCuerpo: customText,
          contenido: customText
        };
      });

      const updatedPagare: Pagare = {
        ...pagare,
        ciudad: cleanCiudad,
        ciudad_emision: cleanCiudad,
        ciudadEmision: cleanCiudad,
        tasaInteres: tasaInteresDetectada,
        tasa_interes: tasaInteresDetectada,
        interesPersonalizado: tasaInteresDetectada,
        textosCuotas: textosCuotasArray,
        texto_personalizado: textoMaestro,
        textoPersonalizado: textoMaestro,
        textoCuerpo: textoMaestro,
        contenido: textoMaestro,
        acreedor_nombre_raw: sanitizeNotarialText(acreedorNombreEditable),
        acreedor_documento_raw: formatDocClean(acreedorDocumentoEditable),
        acreedor_domicilio_raw: sanitizeNotarialText(acreedorDomicilioEditable),
        deudor_nombre_raw: sanitizeNotarialText(deudorNombreEditable),
        deudor_documento_raw: formatDocClean(deudorDocumentoEditable),
        deudor_domicilio_raw: sanitizeNotarialText(deudorDomicilioEditable),
        codeudor1_nombre_raw: sanitizeNotarialText(codeudor1NombreEditable),
        codeudor1_documento_raw: formatDocClean(codeudor1DocumentoEditable),
        codeudor1_domicilio_raw: sanitizeNotarialText(codeudor1DomicilioEditable),
        codeudor2_nombre_raw: sanitizeNotarialText(codeudor2NombreEditable),
        codeudor2_documento_raw: formatDocClean(codeudor2DocumentoEditable),
        codeudor2_domicilio_raw: sanitizeNotarialText(codeudor2DomicilioEditable),
        certificado_firmas_nro: baseCertificadoNro,
        fechaLugarEmision: encabezadoCiudadFechaEditable.toUpperCase(),
        clausulaPenal,
        moraAutomatica,
        dispensaProtesto,
        cronograma: updatedCronograma
      } as any;

      // 1. Respaldo prioritario en localStorage
      try {
        const stored = localStorage.getItem('olga_pagares');
        if (stored) {
          const list = JSON.parse(stored);
          const nextList = list.map((p: any) => p.id === updatedPagare.id ? updatedPagare : p);
          localStorage.setItem('olga_pagares', JSON.stringify(nextList));
        }
        const storedIhara = localStorage.getItem('ihara_pagares');
        if (storedIhara) {
          const list = JSON.parse(storedIhara);
          const nextList = list.map((p: any) => p.id === updatedPagare.id ? updatedPagare : p);
          localStorage.setItem('ihara_pagares', JSON.stringify(nextList));
        }
      } catch (err) {
        console.warn('Error local storage update:', err);
      }

      // 2. Notificar al componente padre para actualizar estado React inmediatamente
      if (onUpdatePagare) {
        onUpdatePagare(updatedPagare);
      }

      // Cierre Inmediato de la interfaz (0ms de latencia percibida)
      if (andClose) {
        onClose();
      }

      // 3. Guardar en Firestore en segundo plano (Escritura asíncrona segura / Fire-and-forget)
      (async () => {
        try {
          const effectiveWorkspaceId = workspaceId || pagare.userId || auth?.currentUser?.uid;
          if (effectiveWorkspaceId) {
            const docRef = doc(db, 'pagares', pagare.id);
            const clean = JSON.parse(JSON.stringify(updatedPagare));
            const firestorePromise = setDoc(docRef, { ...clean, userId: effectiveWorkspaceId }, { merge: true });
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Tiempo de espera agotado al conectar con el servidor')), 15000)
            );
            await Promise.race([firestorePromise, timeoutPromise]);
          }

          mostrarToastNotarial('Guardado en segundo plano exitoso', 'success');
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        } catch (bgErr: any) {
          console.error('Error al guardar documento notarial en segundo plano:', bgErr);
          const errMsg = bgErr?.message || 'Error de sincronización con el servidor.';
          mostrarToastNotarial(`Error de sincronización: ${errMsg}`, 'error');
          setSaveError(errMsg);
          setTimeout(() => setSaveError(null), 6000);
        } finally {
          setIsSaving(false);
        }
      })();
    } catch (err: any) {
      console.error('Error en proceso local de guardado:', err);
      const errMsg = err?.message || 'Error al procesar el guardado local.';
      setSaveError(errMsg);
      mostrarToastNotarial(`Error al guardar: ${errMsg}`, 'error');
      setIsSaving(false);
      if (andClose) {
        onClose();
      }
    }
  };

  const handleCerrarVista = () => {
    // Guardar cambios en segundo plano y cerrar inmediatamente
    handleGuardarPagare(true);
  };

  const handleCopiarCodigoSoporte = async () => {
    if (!pagare) return;
    const effectiveWorkspaceId = workspaceId || pagare.userId || auth?.currentUser?.uid || 'no-workspace';
    const textToCopy = `Solicitud Soporte O.L.G.A. | Workspace: ${effectiveWorkspaceId} | Pagaré ID: ${pagare.id} | Correlativo: ${pagare.correlativo}`;
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
      setCopiedSupport(true);
      setSupportToast(true);
      setTimeout(() => setCopiedSupport(false), 3000);
      setTimeout(() => setSupportToast(false), 3000);
    } catch (err) {
      console.error("Error al copiar código de soporte:", err);
    }
  };

  const currentFormattedDateTime = () => {
    return new Date().toLocaleString('es-PY', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCertificadoNroForIndex = (index: number) => {
    return baseCertificadoNro || '';
  };

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Optimización de Rendimiento: Renderizado Progresivo y Asíncrono del Cronograma
  // Evita congelar el DOM montando 60+ hojas al mismo tiempo en el hilo principal
  const INITIAL_BATCH_SIZE = 3;
  const BATCH_INCREMENT = 8;
  const totalHojas = pagare?.cronograma?.length || 0;
  const [hojasRenderizadas, setHojasRenderizadas] = useState<number>(() =>
    Math.min(INITIAL_BATCH_SIZE, totalHojas || 1)
  );

  useEffect(() => {
    setHojasRenderizadas(Math.min(INITIAL_BATCH_SIZE, totalHojas || 1));
  }, [pagare?.id, totalHojas]);

  useEffect(() => {
    if (hojasRenderizadas < totalHojas) {
      const timer = setTimeout(() => {
        setHojasRenderizadas(prev => Math.min(prev + BATCH_INCREMENT, totalHojas));
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [hojasRenderizadas, totalHojas]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Cierre instantáneo y guardado en segundo plano sin bloquear
        handleGuardarPagare(true);
      }
    };
    if (pagare) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pagare]);

  if (!pagare) return null;

  const getMonedaSimbolo = (cod: string) => {
    return config.monedas.find(m => m.codigo === cod)?.simbolo || '$';
  };

  const getMonedaNombre = (cod: string) => {
    return config.monedas.find(m => m.codigo === cod)?.nombre || 'Moneda';
  };

  const getTipoNegociacionLabel = (tipo: string) => {
    switch (tipo) {
      case 'entrega_refuerzo_cuota': return 'Entrega Inicial + Refuerzos + Cuotas';
      case 'cuotas_corridas': return 'Cuotas Corridas';
      case 'cuotas_refuerzos': return 'Cuotas + Refuerzos';
      case 'entrega_cuotas': return 'Entrega + Cuotas';
      default: return tipo;
    }
  };

  const deudor = personas.find(p => p.id === pagare.deudor_id);
  const codeudor1 = personas.find(p => p.id === pagare.codeudor1_id);
  const codeudor2 = personas.find(p => p.id === pagare.codeudor2_id);
  
    const finalAcreedorDocumento = pagare.acreedor_documento_raw || '';
    const acreedorRep = personas.find(p => p.id === personas.find(a => a.id === pagare.acreedor_id)?.representante_id);

        const deudorRep = personas.find(p => p.id === deudor?.representante_id);



  const getRichHtmlForText = (plainText: string, item: any, isPrint: boolean = false): string => {
    if (!plainText) return '';
    let text = plainText.replace(/<\/?b>/g, '');

    const diaLetras = numberToWords(new Date(item.fecha_pag + 'T12:00:00').getDate()).trim().toUpperCase();
    const mesNombre = getMesNombre(new Date(item.fecha_pag + 'T12:00:00').getMonth()).trim().toUpperCase();
    const anioLetras = numberToWords(new Date(item.fecha_pag + 'T12:00:00').getFullYear()).trim().toUpperCase();
    const acreedorLimpio = sanitizeNotarialText(acreedorNombreEditable).toUpperCase();
    const acreedorDocLimpio = formatDocClean(acreedorDocumentoEditable).trim();
    const monInfo = getMonedaInfo(pagare?.moneda);
    const montoLetras = numberToWords(item.monto).trim().toUpperCase();
    const montoSimbolo = `${monInfo.simbolo} ${formatCurrencyValue(item.monto, pagare?.moneda || 'PYG').trim()}`;
    const ciudadStr = sanitizeNotarialText(ciudadEmisionRef.current ?? ciudadEmision).toUpperCase() || 'ASUNCIÓN, PARAGUAY';

    const fechaFmt = `${diaLetras} de ${mesNombre} del año ${anioLetras}`;
    const acreedorFmt = `${acreedorLimpio}`;
    const acreedorDocFmt = `${acreedorDocLimpio}`;
    const montoFmt = `${monInfo.nombreMayus} ${montoLetras} (${montoSimbolo})`;
    const ciudadFmt = `${ciudadStr}`;

    const boldOpen = isPrint ? '<strong style="font-weight: 700; color: #0f172a;">' : '<span class="font-bold text-slate-900">';
    const boldClose = isPrint ? '</strong>' : '</span>';

    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (fechaFmt) text = text.replace(new RegExp(escapeRegExp(fechaFmt), 'g'), `${boldOpen}${fechaFmt}${boldClose}`);
    if (acreedorFmt) text = text.replace(new RegExp(escapeRegExp(acreedorFmt), 'g'), `${boldOpen}${acreedorFmt}${boldClose}`);
    if (acreedorDocFmt) text = text.replace(new RegExp(escapeRegExp(acreedorDocFmt), 'g'), `${boldOpen}${acreedorDocFmt}${boldClose}`);
    if (montoFmt) text = text.replace(new RegExp(escapeRegExp(montoFmt), 'g'), `${boldOpen}${montoFmt}${boldClose}`);
    if (ciudadFmt) text = text.replace(new RegExp(escapeRegExp(ciudadFmt), 'g'), `${boldOpen}${ciudadFmt}${boldClose}`);

    return text;
  };

  const getTextoPagare = (item: any, index?: number): string => {
    if (!item) return '';
    const idx = index !== undefined ? index : (pagare?.cronograma ? pagare.cronograma.findIndex(c => c.id === item.id) : 0);

    if (customTextos[item.id] !== undefined && customTextos[item.id]) {
      return customTextos[item.id].replace(/<\/?b>/g, '');
    }
    if (idx >= 0 && customTextos[`idx_${idx}`] !== undefined && customTextos[`idx_${idx}`]) {
      return customTextos[`idx_${idx}`].replace(/<\/?b>/g, '');
    }
    if (customTextosRef.current && customTextosRef.current[item.id]) {
      return customTextosRef.current[item.id].replace(/<\/?b>/g, '');
    }
    if (idx >= 0 && customTextosRef.current && customTextosRef.current[`idx_${idx}`]) {
      return customTextosRef.current[`idx_${idx}`].replace(/<\/?b>/g, '');
    }

    const saved = item.texto_personalizado || item.textoPersonalizado || item.textoCuerpo || item.contenido;
    if (saved && typeof saved === 'string' && saved.trim()) {
      return saved.replace(/<\/?b>/g, '');
    }

    const savedTextosCuotas = (pagare as any)?.textosCuotas;
    if (savedTextosCuotas) {
      if (Array.isArray(savedTextosCuotas) && idx >= 0 && savedTextosCuotas[idx]) {
        return String(savedTextosCuotas[idx]).replace(/<\/?b>/g, '');
      }
      if (typeof savedTextosCuotas === 'object') {
        const byId = savedTextosCuotas[item.id] || savedTextosCuotas[idx] || savedTextosCuotas[`cuota_${idx}`];
        if (byId && typeof byId === 'string' && byId.trim()) {
          return byId.replace(/<\/?b>/g, '');
        }
      }
    }

    if (idx > 0 && pagare?.cronograma?.[0]) {
      const cuota0 = pagare.cronograma[0];
      const cuota0Text = 
        customTextos[cuota0.id] || 
        customTextosRef.current?.[cuota0.id] || 
        customTextos['idx_0'] || 
        customTextosRef.current?.['idx_0'] || 
        cuota0.texto_personalizado || 
        cuota0.textoPersonalizado || 
        generateDefaultText(cuota0);
      if (cuota0Text && typeof cuota0Text === 'string' && cuota0Text.trim()) {
        const mirrored = generateMirroredText(cuota0Text, item, pagare?.moneda);
        return mirrored.replace(/<\/?b>/g, '');
      }
    }

    return generateDefaultText(item);
  };

  // Captura inmediata al tipear para sincronía 100% libre de retrasos
  const handleImmediateCustomTextChange = (index: number, item: any, newText: string) => {
    customTextosRef.current[item.id] = newText;
    customTextosRef.current[`idx_${index}`] = newText;
    if (index === 0) {
      masterTextRef.current = newText;
      const matchTasa = newText.match(/un interés del\s+([^\s%]+)\s*%/i);
      if (matchTasa && matchTasa[1] && matchTasa[1] !== '_____') {
        const cleanRate = matchTasa[1].replace(/%+$/, '').trim();
        tasaInteresRef.current = cleanRate;
      }
    }
  };

  // Efecto Espejo: Edición manual en Pagaré N° 1 como Maestro replica en los demás (2/N a N/N)
  const handleCustomTextChange = (index: number, item: any, newText: string) => {
    customTextosRef.current[item.id] = newText;
    customTextosRef.current[`idx_${index}`] = newText;
    if (index === 0) {
      masterTextRef.current = newText;
      const nextCustomTextos: { [id: string]: string } = {
        ...customTextos,
        [item.id]: newText,
        'idx_0': newText
      };

      const matchTasa = newText.match(/un interés del\s+([^\s%]+)\s*%/i);
      if (matchTasa && matchTasa[1] && matchTasa[1] !== '_____') {
        const cleanRate = matchTasa[1].replace(/%+$/, '').trim();
        setTasaInteres(cleanRate);
        tasaInteresRef.current = cleanRate;
      }

      const cronograma = pagare?.cronograma || [];
      for (let i = 1; i < cronograma.length; i++) {
        const cuotaK = cronograma[i];
        const mirrored = generateMirroredText(newText, cuotaK, pagare?.moneda);
        nextCustomTextos[cuotaK.id] = mirrored;
        nextCustomTextos[`idx_${i}`] = mirrored;
        customTextosRef.current[cuotaK.id] = mirrored;
        customTextosRef.current[`idx_${i}`] = mirrored;
      }

      setCustomTextos(nextCustomTextos);
    } else {
      setCustomTextos(prev => ({ 
        ...prev, 
        [item.id]: newText,
        [`idx_${index}`]: newText 
      }));
    }
  };

  const { diasRestantes, pruebaActiva, isTrialExpired } = useTrialStatus(auth?.currentUser);
  const plan = String(userData?.planActual || userData?.plan || '').toLowerCase();
  const isOperador = userData?.rol === 'operador' || userData?.role === 'operador';
  const isWhitelisted = auth?.currentUser?.email === 'jotamolinas@gmail.com' || isOperador;
  const isApproved = String(userData?.estadoPago).toUpperCase() === 'APROBADO' || String(userData?.estadoPlataforma).toUpperCase() === 'APROBADO';
  const isPaid = plan.includes('pro') || plan.includes('empresa') || plan.includes('full') || plan.includes('básico') || plan.includes('basico') || isApproved;
  const isWatermarkRequired = false;

  const ciudadFija = (pagare.ciudad_emision || pagare.ciudadEmision || userData?.ciudad || config?.escribania?.ciudad || 'ASUNCIÓN').trim().toUpperCase();
  const departamentoFijo = ((pagare as any).departamento_emision || (pagare as any).departamentoEmision || userData?.departamento || (config?.escribania as any)?.departamento || 'CAPITAL').trim().toUpperCase();
  const [encabezadoCiudadFechaEditable, setEncabezadoCiudadFechaEditable] = useState<string>(() => {
    return pagare?.fechaLugarEmision 
      ? pagare.fechaLugarEmision.toUpperCase() 
      : `${ciudadFija}, ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}.-`.toUpperCase();
  });

  const executePrint = () => {
    if (!pagare) return;

    let cleanCiudad = sanitizeNotarialText(ciudadEmisionRef.current ?? ciudadEmision);
    if (!cleanCiudad) {
      cleanCiudad = sanitizeNotarialText(
        (pagare as any)?.ciudadEmision ||
        (pagare as any)?.ciudad ||
        (pagare as any)?.ciudad_emision ||
        configCiudad ||
        (typeof window !== 'undefined' ? localStorage.getItem('olga_ultima_ciudad_pagare') : '') ||
        ''
      );
    }

    const cuota0 = pagare.cronograma?.[0];
    const cuota0Id = cuota0?.id;
    const textoMaestro = 
      masterTextRef.current || 
      customTextosRef.current[cuota0Id] || 
      customTextos[cuota0Id] || 
      customTextosRef.current['idx_0'] || 
      customTextos['idx_0'] || 
      (cuota0 as any)?.texto_personalizado || 
      (cuota0 as any)?.textoPersonalizado || 
      (Array.isArray((pagare as any)?.textosCuotas) ? (pagare as any).textosCuotas[0] : null) ||
      getTextoPagare(cuota0, 0);

    const mergedCustomTextos: { [id: string]: string } = {
      ...customTextos,
      ...customTextosRef.current,
      [cuota0Id]: textoMaestro,
      'idx_0': textoMaestro
    };

    if (pagare.cronograma && pagare.cronograma.length > 1) {
      for (let i = 1; i < pagare.cronograma.length; i++) {
        const itemK = pagare.cronograma[i];
        if (!mergedCustomTextos[itemK.id]) {
          const fromArray = Array.isArray((pagare as any)?.textosCuotas) ? (pagare as any).textosCuotas[i] : null;
          mergedCustomTextos[itemK.id] = fromArray || generateMirroredText(textoMaestro, itemK, pagare.moneda);
        }
      }
    }

    const win = window.open('', '', 'width=900,height=650');
    if (!win) return;

    const lineaFecha = encabezadoCiudadFechaEditable;

    const monInfo = getMonedaInfo(pagare.moneda);

    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Impresión Pagaré Oficial - Serie PJE-${config.anio_serie || new Date().getFullYear()}-${pagare.correlativo}</title>
  <style>
    @page { 
      size: ${pageSize === 'legal' ? '216mm 330mm portrait' : 'A4 portrait'}; 
      margin-top: 4.5cm !important; 
      margin-bottom: 1.5cm !important; 
      margin-left: 1.5cm !important; 
      margin-right: 1.5cm !important; 
    }
    *, *::before, *::after {
      box-sizing: border-box !important;
    }
    html, body { 
      padding: 0 !important; 
      margin: 0 !important; 
      background: #ffffff !important;
      color: #000000 !important;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .sheet {
      page-break-after: always;
      break-after: page;
      box-sizing: border-box;
      width: 100%;
      background: #ffffff;
      color: #0f172a;
    }
    .sheet:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .title {
      text-align: center;
      font-weight: 800;
      font-size: 16px;
      margin-bottom: 14px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-weight: 700;
      font-size: 14px;
      margin-bottom: 8px;
    }
    .vencimiento {
      font-weight: 700;
      font-size: 14px;
      margin-bottom: 12px;
      text-transform: uppercase;
    }
    .date-line {
      font-size: 14px;
      margin-bottom: 14px;
      font-weight: 400;
    }
    .body-text {
      font-size: 13px;
      line-height: 1.62;
      text-align: justify;
      margin-bottom: 24px;
      white-space: pre-wrap;
    }
    .signatures-block {
      padding-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .signature-card {
      width: 100%;
      max-width: 340px;
      border-top: 1px solid #000000;
      padding-top: 4px;
      font-size: 14px;
      line-height: 1.4;
    }
    .signature-label {
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 2px;
    }
    .cert-footer {
      margin-top: 24px;
      font-size: 14px;
      font-weight: bold !important;
      text-transform: uppercase;
      white-space: normal;
    }
    .doc-footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 9px;
      color: #94a3b8;
      font-family: monospace;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>`;

    pagare.cronograma.forEach((item, index) => {
      const rawText = mergedCustomTextos[item.id] || getTextoPagare(item, index);
      const cuotaText = getRichHtmlForText(rawText, item, true);
      const certNro = getCertificadoNroForIndex(index).trim();

      html += `
  <div class="sheet">
    <div class="title">${esNotaria ? 'PAGARE A LA ORDEN' : 'INSTRUMENTO PRIVADO - PAGARÉ'}</div>
    
    <div class="header-row">
      <div>N° ${item.numero_cuota}/${pagare.cronograma.length}</div>
      <div>${monInfo.simbolo} ${formatCurrencyValue(item.monto, pagare.moneda)}.-</div>
    </div>

    <div class="vencimiento">
      VENCIMIENTO: ${new Date(item.fecha_pag + 'T12:00:00').toLocaleDateString('es-PY')}
    </div>

    <div class="date-line" style="text-transform: uppercase;">
      ${encabezadoCiudadFechaEditable.toUpperCase()}
    </div>

    <div class="body-text">
      ${cuotaText}
    </div>

    <div class="signatures-block">
      <div class="signature-card" style="margin-bottom: 2rem;">
        <div class="signature-label">Deudor Principal</div>
        <div>Nombre: <span style="text-transform: uppercase;">${sanitizeNotarialText(deudorNombreEditable)}</span></div>
        <div>Documento: C.I.N° <span style="text-transform: uppercase;">${formatDocClean(deudorDocumentoEditable)}</span></div>
        <div>Domicilio: <span style="text-transform: uppercase;">${sanitizeNotarialText(deudorDomicilioEditable)}</span></div>
      </div>

      ${(codeudor1NombreEditable || codeudor1DocumentoEditable) ? `
      <div class="signature-card" style="margin-bottom: 3.5rem;">
        <div class="signature-label">Co-Deudor Solidario 1</div>
        <div>Nombre: <span style="text-transform: uppercase;">${sanitizeNotarialText(codeudor1NombreEditable)}</span></div>
        <div>Documento: C.I.N° <span style="text-transform: uppercase;">${formatDocClean(codeudor1DocumentoEditable)}</span></div>
        <div>Domicilio: <span style="text-transform: uppercase;">${sanitizeNotarialText(codeudor1DomicilioEditable)}</span></div>
      </div>` : ''}

      ${(codeudor2NombreEditable || codeudor2DocumentoEditable) ? `
      <div class="signature-card" style="margin-bottom: 2rem;">
        <div class="signature-label">Co-Deudor Solidario 2</div>
        <div>Nombre: <span style="text-transform: uppercase;">${sanitizeNotarialText(codeudor2NombreEditable)}</span></div>
        <div>Documento: C.I.N° <span style="text-transform: uppercase;">${formatDocClean(codeudor2DocumentoEditable)}</span></div>
        <div>Domicilio: <span style="text-transform: uppercase;">${sanitizeNotarialText(codeudor2DomicilioEditable)}</span></div>
      </div>` : ''}
    </div>

    ${esNotaria ? `
    <div class="cert-footer">
      LAS FIRMAS QUE ANTECEDEN HAN SIDO PUESTAS EN MI PRESENCIA Y SE HALLAN CERTIFICADAS EN LA HOJA DE CERTIFICACION DE FIRMAS N° ${pagare.certificado_firmas_nro || '__________'} QUE SIGUE ANEXA. CONSTE.-
    </div>` : ''}

    ${config.pdf.mostrar_pie ? `
    <div class="doc-footer">
      <div>
        <strong style="text-transform: uppercase; color: #64748b;">${config.pdf.contenido_pie || `${config.escribania.nombre} — ${config.escribania.nro_registro}`}</strong><br/>
        <span>${esNotaria ? 'Certificado emitido digitalmente bajo protocolo de escribanía y timbrado vigente.' : 'Documento emitido digitalmente bajo términos comerciales vigentes.'}</span>
      </div>
      <div style="text-align: right;">
        <span>Generación: ${currentFormattedDateTime()}</span><br/>
        <span>Hash: ${getMockHash()}</span>
      </div>
    </div>` : ''}
  </div>`;
    });

    html += `
</body>
</html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 400);
  };

  const handlePrint = () => {
    if (hojasRenderizadas < totalHojas) {
      setHojasRenderizadas(totalHojas);
      setTimeout(() => {
        executePrint();
      }, 150);
      return;
    }
    executePrint();
  };
   
  const getMockHash = () => {
    return '0x' + Array.from({length: 8}, () => Math.floor(Math.random()*16).toString(16)).join('').toUpperCase() + '...' + Array.from({length: 4}, () => Math.floor(Math.random()*16).toString(16)).join('').toUpperCase();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-message" id="pdf-preview-modal">
      <div className="bg-white rounded-[2.5rem] max-w-5xl w-full box-border shadow-2xl overflow-hidden flex flex-col h-[92vh]">
        
        {/* Modal Top Bar Action Controller */}
        <div className="px-8 py-5 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <Award className="w-6 h-6 text-emerald-400" />
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest leading-none">
                {esNotaria ? 'MATRIZ DE CERTIFICACIÓN NOTARIAL' : 'INSTRUMENTO PRIVADO - PAGARÉ'}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">
                {esNotaria ? 'PREVIEW INSTRUMENTO PÚBLICO' : 'DOCUMENTO COMERCIAL'} - SERIE PJE-{config.anio_serie}-{pagare.correlativo}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 mr-4 bg-slate-800 rounded-xl p-1">
               <span className="text-[10px] uppercase font-bold text-slate-400 ml-2 tracking-wider">Tamaño de Hoja</span>
               <select
                 value={pageSize}
                 onChange={(e) => setPageSize(e.target.value as 'legal' | 'a4')}
                 className="bg-slate-700 text-white text-xs font-bold rounded-lg px-2 py-1 outline-none cursor-pointer"
               >
                 <option value="legal">Oficio (Legal)</option>
                 <option value="a4">A4</option>
               </select>
            </div>
            <button
              onClick={() => handleGuardarPagare(false)}
              disabled={isSaving}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-700/20 cursor-pointer disabled:opacity-50"
              title="Guardar ediciones manuales en Firebase y sistema local"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>¡Guardado!</span>
                </>
              ) : isSaving ? (
                <span>Guardando...</span>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Guardar Pagaré</span>
                </>
              )}
            </button>
            {saveError && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-xl text-xs font-semibold animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span className="truncate max-w-[200px]" title={saveError}>{saveError}</span>
              </div>
            )}
            <button
              onClick={() => handleGuardarPagare(true)}
              disabled={isSaving}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-700/20 cursor-pointer disabled:opacity-50"
              title="Guardar todos los cambios y cerrar vista previa"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Guardando...' : 'Aceptar & Cerrar Vista'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-700/20 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir Documento
            </button>
            {isWhatsAppEnabled && (
              <button
                type="button"
                onClick={() => setShowWhatsAppModal(true)}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-700/20 cursor-pointer whitespace-nowrap"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Enviar por WhatsApp</span>
              </button>
            )}
            <button
              onClick={handleCerrarVista}
              className="px-3.5 py-2.5 bg-white/15 hover:bg-white/20 text-white rounded-xl text-[10px] uppercase font-bold tracking-widest transition-all cursor-pointer"
            >
              Cerrar Vista
            </button>
          </div>
        </div>

        {/* Printable & Scrollable Workspace Area */}
        <div className="flex-grow overflow-y-auto p-4 md:p-12 bg-slate-200 flex flex-col justify-start items-center">
          
          <div className="mb-4 text-xs text-slate-500 bg-white px-5 py-3 rounded-xl shadow-sm border border-slate-200/60 font-medium text-center max-w-2xl leading-relaxed">
            💡 <strong className="text-slate-700">Impresión por Lotes</strong> <br/>
            Se generó una hoja individual para cada pagaré del cronograma.
          </div>

          <style dangerouslySetInnerHTML={{__html: `
            .printing-sheet { 
               background-color: #ffffff !important;
               border: 1px solid #cbd5e1 !important;
               box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15) !important;
               box-sizing: border-box !important;
               padding-top: 4.5cm !important;
               padding-left: 1.5cm !important;
               padding-right: 1.5cm !important;
               padding-bottom: 1.5cm !important;
            }
            @media print {
              .no-print { display: none !important; }
              .printing-sheet {
                background-image: none !important;
                background-color: #ffffff !important;
                padding: 0 !important;
                margin: 0 !important;
                border: none !important;
                box-shadow: none !important;
                page-break-after: always;
                break-after: page;
                box-sizing: border-box !important;
              }
              .printing-sheet:last-child {
                page-break-after: auto;
                break-after: auto;
              }
              @page {
                size: ${pageSize === 'legal' ? 'legal' : 'A4'};
                margin-top: 4.5cm !important;
                margin-bottom: 1.5cm !important;
                margin-left: 1.5cm !important;
                margin-right: 1.5cm !important;
              }
            }
          `}} />
          
          {/* Paper Certificate Sheet Simulation */}
          <div className={`w-full ${pageSize === 'legal' ? 'max-w-[215.9mm]' : 'max-w-[210mm]'} flex flex-col gap-12 print:gap-0 print:h-auto print:m-0 print:p-0 print:overflow-hidden`} ref={printAreaRef}>
            {pagare.cronograma.slice(0, hojasRenderizadas).map((item, index) => (
              <div
                key={item.id}
                className={`w-full ${pageSize === 'legal' ? 'min-h-[355.6mm]' : 'min-h-[297mm]'} relative text-slate-900 focus:outline-none transition-all printing-sheet outline-none mb-12 border-b-8 border-slate-300 print:mb-0 print:border-b-0 print:h-auto print:min-h-0 bg-white shadow-2xl ${index < pagare.cronograma.length - 1 ? 'print:break-after-page' : 'print:break-after-auto'}`}
                style={{
                  paddingTop: '4.5cm',
                  paddingLeft: '1.5cm',
                  paddingRight: '1.5cm',
                  paddingBottom: '1.5cm',
                  boxSizing: 'border-box',
                  ...(index < pagare.cronograma.length - 1 ? { pageBreakAfter: 'always', breakAfter: 'page' } : { pageBreakAfter: 'auto', breakAfter: 'auto' })
                }}
              >
                {pagare.status === 'anulado' && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none select-none">
                    <div className="border-[12px] border-red-500/20 rounded-3xl p-8 md:p-12 transform -rotate-45 flex flex-col items-center justify-center">
                      <span className="text-red-500/20 font-black text-6xl md:text-8xl uppercase tracking-[0.2em] leading-none">
                        ANULADO
                      </span>
                      {pagare.anuladoAt && (
                        <span className="text-red-500/30 font-bold text-lg md:text-2xl mt-4 tracking-widest">
                          {new Date(pagare.anuladoAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {/* PAGARE A LA ORDEN HEADER - Primer elemento formal estricto */}
                <div className="flex flex-col mb-4 mt-2 print:mb-3 print:mt-0 relative z-10 break-inside-avoid print:break-inside-avoid font-sans">
                  <h1 className="text-center font-extrabold text-base md:text-lg mb-4 print:mb-3 uppercase tracking-wider text-slate-900">
                    PAGARE A LA ORDEN
                  </h1>
                  
                  <div className="flex justify-between items-end mb-2">
                    <p className="font-bold text-sm">N° {item.numero_cuota}/{pagare.cronograma.length}</p>
                    <p className="font-bold text-sm">{getMonedaInfo(pagare.moneda).simbolo} {formatCurrencyValue(item.monto, pagare.moneda)}.-</p>
                  </div>
                  
                  <p className="font-bold text-sm mb-4 print:mb-3 uppercase">
                    VENCIMIENTO: {new Date(item.fecha_pag + 'T12:00:00').toLocaleDateString('es-PY')}
                  </p>
                  
                  <div className="flex items-baseline text-sm mb-4 print:mb-3 font-sans uppercase">
                   <EditableField
                     className="text-sm font-bold uppercase mt-4 mb-6 w-full"
                     style={{ textTransform: 'uppercase' }}
                     value={encabezadoCiudadFechaEditable}
                     onChange={(val: string) => setEncabezadoCiudadFechaEditable(val)}
                     onBlur={() => setEncabezadoCiudadFechaEditable(prev => prev.toUpperCase())}
                   />
                  </div>
                </div>

                {/* PAGARE A LA ORDEN BODY */}
                <div className="mb-6 relative z-10 break-inside-avoid print:break-inside-avoid font-sans">
                  {/* Vista Interactiva (Pantalla): Textarea editable ultra-fluido con debounce y efecto espejo */}
                  <NotarialTextarea
                    key={`pagare-text-${item.id}`}
                    value={getTextoPagare(item, index)}
                    htmlValue={getRichHtmlForText(getTextoPagare(item, index), item, false)}
                    isMaster={index === 0}
                    onImmediateChange={(val) => handleImmediateCustomTextChange(index, item, val)}
                    onCommit={(newText) => handleCustomTextChange(index, item, newText)}
                    onReset={customTextos[item.id] !== undefined ? () => {
                      setCustomTextos(prev => {
                        const next = { ...prev };
                        if (index === 0) {
                          return {};
                        }
                        delete next[item.id];
                        delete next[`idx_${index}`];
                        return next;
                      });
                    } : undefined}
                  />

                  {/* Vista de Impresión Notarial: Formato texto con campos dinámicos en negrita */}
                  <div className="hidden print:block text-[13px] leading-relaxed text-slate-900 text-justify font-sans whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: getRichHtmlForText(getTextoPagare(item, index), item, true) }} />
                </div>

                {/* SIGNATURE BLOCK - Documentos formateados sin puntos */}
                <div className="pt-6 print:pt-4 relative z-10 flex flex-col space-y-6 print:space-y-4 font-sans break-inside-avoid print:break-inside-avoid">
                  {/* Deudor Principal */}
                  <div className="w-full max-w-[340px] border-t border-black pt-1 mb-8">
                    <p className="text-[11px] font-black uppercase text-slate-500 mb-0.5">Deudor Principal</p>
                    <p className="text-sm flex items-center gap-1">Nombre: <EditableField className="uppercase bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors flex-1" value={deudorNombreEditable} onChange={(val: string) => setDeudorNombreEditable(val)} onBlur={() => setDeudorNombreEditable(prev => sanitizeNotarialText(prev))} /></p>
                    <p className="text-sm flex items-center gap-1">Documento: C.I.N° <EditableField className="uppercase bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors flex-1" value={deudorDocumentoEditable} onChange={(val: string) => setDeudorDocumentoEditable(val)} onBlur={() => setDeudorDocumentoEditable(prev => formatDocClean(prev))} /></p>
                    <p className="text-sm flex items-center gap-1">Domicilio: <EditableField className="uppercase bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors flex-1" value={deudorDomicilioEditable} onChange={(val: string) => setDeudorDomicilioEditable(val)} onBlur={() => setDeudorDomicilioEditable(prev => sanitizeNotarialText(prev))} /></p>
                  </div>

                  {/* Co-deudor 1 (si existe) */}
                  {(codeudor1NombreEditable || codeudor1DocumentoEditable) && (
                    <div className="w-full max-w-[340px] border-t border-black pt-1 mb-14">
                      <p className="text-[11px] font-black uppercase text-slate-500 mb-0.5">Co-Deudor Solidario 1</p>
                      <p className="text-sm flex items-center gap-1">Nombre: <EditableField className="uppercase bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors flex-1" value={codeudor1NombreEditable} onChange={(val: string) => setCodeudor1NombreEditable(val)} onBlur={() => setCodeudor1NombreEditable(prev => sanitizeNotarialText(prev))} /></p>
                      <p className="text-sm flex items-center gap-1">Documento: C.I.N° <EditableField className="uppercase bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors flex-1" value={codeudor1DocumentoEditable} onChange={(val: string) => setCodeudor1DocumentoEditable(val)} onBlur={() => setCodeudor1DocumentoEditable(prev => formatDocClean(prev))} /></p>
                      <p className="text-sm flex items-center gap-1">Domicilio: <EditableField className="uppercase bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors flex-1" value={codeudor1DomicilioEditable} onChange={(val: string) => setCodeudor1DomicilioEditable(val)} onBlur={() => setCodeudor1DomicilioEditable(prev => sanitizeNotarialText(prev))} /></p>
                    </div>
                  )}

                  {/* Co-deudor 2 (si existe) */}
                  {(codeudor2NombreEditable || codeudor2DocumentoEditable) && (
                    <div className="w-full max-w-[340px] border-t border-black pt-1 mb-8">
                      <p className="text-[11px] font-black uppercase text-slate-500 mb-0.5">Co-Deudor Solidario 2</p>
                      <p className="text-sm flex items-center gap-1">Nombre: <EditableField className="uppercase bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors flex-1" value={codeudor2NombreEditable} onChange={(val: string) => setCodeudor2NombreEditable(val)} onBlur={() => setCodeudor2NombreEditable(prev => sanitizeNotarialText(prev))} /></p>
                      <p className="text-sm flex items-center gap-1">Documento: C.I.N° <EditableField className="uppercase bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors flex-1" value={codeudor2DocumentoEditable} onChange={(val: string) => setCodeudor2DocumentoEditable(val)} onBlur={() => setCodeudor2DocumentoEditable(prev => formatDocClean(prev))} /></p>
                      <p className="text-sm flex items-center gap-1">Domicilio: <EditableField className="uppercase bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors flex-1" value={codeudor2DomicilioEditable} onChange={(val: string) => setCodeudor2DomicilioEditable(val)} onBlur={() => setCodeudor2DomicilioEditable(prev => sanitizeNotarialText(prev))} /></p>
                    </div>
                  )}
                </div>

                {/* CERTIFICACION DE FIRMAS FOOTER - Márgenes calibrados para Hoja Verde Oficial */}
                {esNotaria && (
                  <div className="mt-8 md:mt-10 print:mt-6 relative z-10 break-inside-avoid print:break-inside-avoid font-sans pb-4 print:pb-2">
                    <div className="text-sm font-black uppercase">
                      LAS FIRMAS QUE ANTECEDEN HAN SIDO PUESTAS EN MI PRESENCIA Y SE HALLAN CERTIFICADAS EN LA HOJA DE CERTIFICACION DE FIRMAS N° {pagare.certificado_firmas_nro || '__________'} QUE SIGUE ANEXA. CONSTE.-
                    </div>
                  </div>
                )}

                {/* G. PDF Pie footer */}
                {config.pdf.mostrar_pie && (
                  <div className="pt-4 border-t border-slate-200 text-[9px] text-slate-400 flex flex-col sm:flex-row sm:justify-between items-center gap-2 font-mono" style={{ pageBreakBefore: 'avoid' }}>
                    <div className="text-center sm:text-left leading-relaxed">
                      <p className="font-bold uppercase text-slate-500">
                        {config.pdf.contenido_pie || `${config.escribania.nombre} — ${config.escribania.nro_registro}`}
                      </p>
                      <p className="mt-0.5">
                        {esNotaria ? 'Certificado emitido digitalmente bajo protocolo de escribanía y timbrado vigente.' : 'Documento emitido digitalmente bajo términos comerciales vigentes.'}
                      </p>
                    </div>
                    <div className="text-right whitespace-nowrap bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <p className="text-slate-500 font-bold">Generación: {currentFormattedDateTime()}</p>
                      <p className="font-mono text-[8px] mt-0.5">Hash del Documento: {getMockHash()}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {hojasRenderizadas < totalHojas && (
              <div className="w-full max-w-sm mx-auto my-6 p-4 bg-white/95 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center gap-3 text-slate-600 text-xs font-semibold no-print">
                <div className="w-4 h-4 border-2 border-slate-300 border-t-[#FF3131] rounded-full animate-spin" />
                <span>Cargando hojas en segundo plano ({hojasRenderizadas} de {totalHojas})...</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom control bar */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0 no-print">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
            <div className="flex gap-2 items-center text-xs font-bold font-sans text-slate-500">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              <span>Documento listo para firmar bajo Certificado de Firmas Nº {pagare.certificado_firmas_nro}.</span>
            </div>

            {/* Referencia de Soporte Técnico (Fase 8) */}
            <div className="flex items-center gap-2 pl-0 sm:pl-3 sm:border-l sm:border-slate-200">
              <span className="text-[11px] font-mono text-slate-400">
                Ref. Soporte: {pagare.correlativo} - {String(pagare.id || '').slice(-6)}
              </span>
              <button
                type="button"
                onClick={handleCopiarCodigoSoporte}
                className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-100 px-2 py-1 rounded-lg border border-slate-200/80 transition-colors cursor-pointer"
                title="Copiar código estructurado para soporte técnico"
              >
                {copiedSupport ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-bold text-[10px]">Copiado</span>
                  </>
                ) : (
                  <>
                    <Clipboard className="w-3.5 h-3.5" />
                    <span className="text-[10px]">Copiar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <button
            onClick={() => handleGuardarPagare(true)}
            disabled={isSaving}
            className="w-full md:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs uppercase tracking-wider shadow-md transition-colors cursor-pointer disabled:opacity-50"
          >
            {isSaving ? 'Guardando...' : 'Aceptar & Cerrar Vista'}
          </button>
        </div>

        {supportToast && (
          <div className="fixed bottom-6 right-6 z-[250] bg-slate-900 text-white border border-slate-700 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-bottom-2">
            <Check className="w-4 h-4 text-[#FF3131]" />
            <span>Código de soporte copiado</span>
          </div>
        )}

        {saveError && (
          <div className="fixed bottom-6 right-6 z-[250] bg-red-950/95 text-red-200 border border-red-500/40 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold animate-in fade-in slide-in-from-bottom-2 backdrop-blur-md">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <div className="flex flex-col">
              <span className="font-black uppercase tracking-wider text-red-300">Error al guardar</span>
              <span className="text-red-200/90 font-normal">{saveError}</span>
            </div>
            <button
              onClick={() => setSaveError(null)}
              className="ml-2 text-red-400 hover:text-white transition-colors cursor-pointer"
              title="Cerrar alerta"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {isWhatsAppEnabled && showWhatsAppModal && pagare && (() => {
        const acreedorPersona = personas.find((p) => p.id === pagare.acreedor_id);
        const deudorPersona = personas.find((p) => p.id === pagare.deudor_id);
        const nombreAcreedorWa =
          sanitizeNotarialText(
            acreedorNombreEditable ||
              pagare.acreedor_nombre_raw ||
              (acreedorPersona ? `${acreedorPersona.nombre || ''} ${acreedorPersona.apellido || ''}`.trim() : '')
          ) || 'Acreedor / Beneficiario';
        const nombreDeudorWa =
          sanitizeNotarialText(
            deudorNombreEditable ||
              pagare.deudor_nombre_raw ||
              (deudorPersona ? `${deudorPersona.nombre || ''} ${deudorPersona.apellido || ''}`.trim() : '')
          ) || 'Cliente';
        const telefonoDeudorWa = deudorPersona?.telefono || '';
        const montoValor = Number(pagare.valor_total || (pagare as any).monto || 0);
        const monSimbolo = getMonedaInfo(pagare.moneda).simbolo;
        const montoFormateado = `${formatCurrencyValue(montoValor, pagare.moneda || 'PYG')} ${monSimbolo}`;
        const rawFechaVenc =
          pagare.cronograma?.find((c: any) => c.estado !== 'cobrado' && c.pagado !== true)?.fecha_pag ||
          pagare.cronograma?.[0]?.fecha_pag ||
          pagare.fecha_primer_pago ||
          '';
        const fechaParts = String(rawFechaVenc).split('-');
        const fechaVencFmt =
          fechaParts.length === 3 ? `${fechaParts[2]}/${fechaParts[1]}/${fechaParts[0]}` : rawFechaVenc || 'A confirmar';
        const escribaniaNombreWa =
          userData?.razonSocial || userData?.nombreEscribania || config?.escribania?.nombre || 'Escribanía Titular';
        const correlativoStr = String(pagare.correlativo || 'S/N').padStart(4, '0');

        const totalCuotas = pagare.cronograma?.length || 1;
        const nextPendingIdx = pagare.cronograma?.findIndex((c: any) => c.estado !== 'cobrado' && c.pagado !== true) ?? -1;
        const cuotaPlazo =
          totalCuotas > 1
            ? nextPendingIdx >= 0
              ? `Cuota ${pagare.cronograma[nextPendingIdx].numero_cuota} de ${totalCuotas}`
              : `${totalCuotas} cuotas`
            : 'Pago único';

        const pdfPagare = generatePagarePdfBase64({
          numero: correlativoStr,
          certificadoFirmasNro: baseCertificadoNro || pagare.certificado_firmas_nro,
          escribania: {
            nombre: escribaniaNombreWa,
            ruc: userData?.ruc || '',
            registro: userData?.registroNotarial || config?.escribania?.nro_registro || '',
            telefono: userData?.telefono || config?.escribania?.telefono || '',
            direccion: userData?.direccion || config?.escribania?.direccion || '',
          },
          acreedorNombre: nombreAcreedorWa,
          acreedorDocumento: acreedorDocumentoEditable || pagare.acreedor_documento_raw || acreedorPersona?.nro_documento,
          acreedorDomicilio: acreedorDomicilioEditable || pagare.acreedor_domicilio_raw || acreedorPersona?.domicilio,
          deudorNombre: nombreDeudorWa,
          deudorDocumento: deudorDocumentoEditable || pagare.deudor_documento_raw || deudorPersona?.nro_documento,
          deudorDomicilio: deudorDomicilioEditable || pagare.deudor_domicilio_raw || deudorPersona?.domicilio,
          codeudor1Nombre: codeudor1NombreEditable,
          codeudor1Documento: codeudor1DocumentoEditable,
          codeudor2Nombre: codeudor2NombreEditable,
          codeudor2Documento: codeudor2DocumentoEditable,
          montoValor,
          moneda: pagare.moneda || 'PYG',
          cuotaPlazo,
          fechaEmision: pagare.created_at,
          fechaVencimiento: rawFechaVenc,
          lugarPago:
            ciudadEmision ||
            userData?.ciudad ||
            config?.escribania?.ciudad ||
            config?.escribania?.direccion ||
            'Asunción, Paraguay',
          tasaInteres,
          cuerpoTexto:
            pagare.texto_personalizado ||
            pagare.textoPersonalizado ||
            pagare.textoCuerpo ||
            pagare.contenido,
        });

        const defaultMsg = [
          `Estimado/a ${nombreDeudorWa},`,
          '',
          `Le remitimos adjunto en PDF su Pagaré Notarial Nº ${correlativoStr}:`,
          '',
          `• Deudor: ${nombreDeudorWa}`,
          `• Monto: ${montoFormateado}`,
          `• Fecha de vencimiento: ${fechaVencFmt}`,
          `• Escribanía: ${escribaniaNombreWa}`,
          '',
          'Quedamos a su disposición ante cualquier consulta.',
        ].join('\n');

        return (
          <WhatsAppSendModal
            isOpen={showWhatsAppModal}
            onClose={() => setShowWhatsAppModal(false)}
            workspaceId={workspaceId || pagare.userId || auth?.currentUser?.uid || ''}
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
