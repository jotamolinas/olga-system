import React, { useRef, useEffect, useState } from 'react';
import { Pagare, Persona, GlobalConfig, formatCurrencyValue } from '../types';
import { Award, Printer, Download, Sparkles, RefreshCw, Layers, Shield, FileText, CheckCircle, Clipboard, Check, Save } from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import { useTrialStatus } from '../hooks/useTrialStatus';
import { auth, db } from '../services/auth';
import { doc, updateDoc, setDoc } from 'firebase/firestore';

interface PagarePDFPreviewProps {
  pagare: Pagare | null;
  personas: Persona[];
  config: GlobalConfig;
  onClose: () => void;
  userData?: any;
  onUpdatePagare?: (pagare: Pagare) => void;
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

const EditableField = ({ value, onChange, className, style, placeholder, disabled }: any) => {
  const valStr = String(value ?? '');
  return (
    <>
      <input
        type="text"
        value={valStr}
        size={Math.max(valStr.length || 1, 3)}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors print:hidden ${className || ''}`}
        style={style}
      />
      <span className={`hidden print:inline ${className || ''}`} style={style}>
        {valStr}
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

  let mirroredText = masterText;

  // Reemplazo dinámico de la cláusula de vencimiento: "El día ... del año ..., pagaré"
  mirroredText = mirroredText.replace(
    /^\s*El día\s+[^,]+,\s*pagaré/i,
    `El día ${diaLetrasK} de ${mesNombreK} del año ${anioLetrasK}, pagaré`
  );

  // Reemplazo dinámico del monto en letras y números si fuera diferente
  mirroredText = mirroredText.replace(
    /la suma de\s+[^(]+\([^)]+\)/i,
    `la suma de ${monInfo.nombreMayus} ${montoLetrasK} (${montoSimboloK})`
  );

  return mirroredText;
};

interface NotarialCiudadInputProps {
  value: string;
  onChangeCiudad: (newCiudad: string) => void;
}

export const NotarialCiudadInput: React.FC<NotarialCiudadInputProps> = ({ value, onChangeCiudad }) => {
  const [localText, setLocalText] = useState(value);

  useEffect(() => {
    setLocalText(value);
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
      type="text"
      value={localText}
      onChange={handleChange}
      placeholder=""
      className="bg-transparent outline-none border-b border-slate-300 print:border-none hover:border-slate-400 focus:border-slate-500 transition-colors text-sm font-sans text-slate-900 py-0.5 px-0.5 print:p-0 min-w-[90px] print:min-w-0"
      style={{ width: localText ? `${Math.max(localText.length + 1, 8)}ch` : '110px' }}
    />
  );
};

interface NotarialTextareaProps {
  value: string;
  onCommit: (val: string) => void;
  onImmediateChange?: (val: string) => void;
  isMaster: boolean;
  onReset?: () => void;
}

export const NotarialTextarea: React.FC<NotarialTextareaProps> = ({
  value,
  onCommit,
  onImmediateChange,
  isMaster,
  onReset
}) => {
  const [localText, setLocalText] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const debounceTimerRef = useRef<any>(null);

  useEffect(() => {
    setLocalText(value);
  }, [value]);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [localText]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    setLocalText(nextVal);
    if (onImmediateChange) {
      onImmediateChange(nextVal);
    }
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      onCommit(nextVal);
    }, 150);
  };

  const handleBlur = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    onCommit(localText);
  };

  return (
    <div className="print:hidden">
      <textarea
        ref={textareaRef}
        value={localText}
        onChange={handleChange}
        onBlur={handleBlur}
        rows={5}
        className="w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-400/50 rounded p-1 text-[13px] leading-relaxed text-slate-900 text-justify font-sans resize-none overflow-hidden border border-transparent hover:border-slate-200 focus:border-blue-300 transition-colors cursor-text"
        placeholder="Ingrese aquí su texto o comience a escribir aquí..."
      />
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="text-[10px] text-blue-600 hover:text-blue-800 underline font-medium mt-0.5 cursor-pointer block text-right"
        >
          {isMaster ? 'Restablecer todas las cuotas al texto generado' : 'Restablecer texto generado'}
        </button>
      )}
    </div>
  );
};

export const PagarePDFPreview: React.FC<PagarePDFPreviewProps> = ({
  pagare,
  personas,
  config,
  onClose,
  userData,
  onUpdatePagare
}) => {
  const [pageSize, setPageSize] = useState<'legal' | 'a4'>('legal');
  const [baseCertificadoNro, setBaseCertificadoNro] = useState(pagare?.certificado_firmas_nro || '000406185');

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
      if (text) {
        initialMap[it.id] = text;
        initialMap[`idx_${idx}`] = text;
      }
    });

    // Si la cuota 0 tiene texto personalizado guardado, asegurar que las siguientes cuotas lo reflejen por efecto espejo
    const cuota0Id = cronograma[0]?.id;
    const cuota0Text = cuota0Id ? initialMap[cuota0Id] : null;
    if (cuota0Text && cronograma.length > 1) {
      for (let i = 1; i < cronograma.length; i++) {
        const cuotaK = cronograma[i];
        if (!initialMap[cuotaK.id]) {
          const mirrored = generateMirroredText(cuota0Text, cuotaK, pagare?.moneda);
          initialMap[cuotaK.id] = mirrored;
          initialMap[`idx_${i}`] = mirrored;
        }
      }
    }

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

  const handleGuardarPagare = async (andClose = false) => {
    if (!pagare) return;
    setIsSaving(true);
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
        fechaLugarEmision: fullFechaLugarEmision,
        clausulaPenal,
        moraAutomatica,
        dispensaProtesto,
        cronograma: updatedCronograma
      } as any;

      // 1. Guardar en Firestore con setDoc y merge: true
      const effectiveWorkspaceId = workspaceId || pagare.userId || auth?.currentUser?.uid;
      if (effectiveWorkspaceId) {
        try {
          const docRef = doc(db, 'pagares', pagare.id);
          const clean = JSON.parse(JSON.stringify(updatedPagare));
          await setDoc(docRef, { ...clean, userId: effectiveWorkspaceId }, { merge: true });
        } catch (dbErr) {
          console.warn('Error al actualizar en Firestore:', dbErr);
        }
      }

      // 2. Notificar al componente padre para actualizar estado React inmediatamente
      if (onUpdatePagare) {
        onUpdatePagare(updatedPagare);
      }

      // 3. Persistir en localStorage
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

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      if (andClose) {
        onClose();
      }
    } catch (err) {
      console.error('Error al guardar pagaré:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCerrarVista = async () => {
    // Guardar cambios pendientes y cerrar vista
    await handleGuardarPagare(true);
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
    if (!baseCertificadoNro) return '';
    const num = parseInt(baseCertificadoNro, 10);
    if (isNaN(num)) return baseCertificadoNro;
    return String(num + index).padStart(baseCertificadoNro.length, '0');
  };

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

  const printAreaRef = useRef<HTMLDivElement>(null);

  const rawAcreedorDom = sanitizeNotarialText(pagare?.acreedor_domicilio_raw || '');
  const [acreedorNombreEditable, setAcreedorNombreEditable] = useState(sanitizeNotarialText(pagare?.acreedor_nombre_raw || ''));
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
        onClose();
      }
    };
    if (pagare) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pagare, onClose]);

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

  const getTextoPagare = (item: any, index?: number): string => {
    if (!item) return '';
    const idx = index !== undefined ? index : (pagare?.cronograma ? pagare.cronograma.findIndex(c => c.id === item.id) : 0);

    // 1. Textos en memoria del estado React
    if (customTextos[item.id] !== undefined && customTextos[item.id]) {
      return customTextos[item.id];
    }
    if (idx >= 0 && customTextos[`idx_${idx}`] !== undefined && customTextos[`idx_${idx}`]) {
      return customTextos[`idx_${idx}`];
    }

    // 2. Textos en referencias de escritura inmediata
    if (customTextosRef.current && customTextosRef.current[item.id]) {
      return customTextosRef.current[item.id];
    }
    if (idx >= 0 && customTextosRef.current && customTextosRef.current[`idx_${idx}`]) {
      return customTextosRef.current[`idx_${idx}`];
    }

    // 3. Texto guardado directamente en el ítem de la cuota
    const saved = item.texto_personalizado || item.textoPersonalizado || item.textoCuerpo || item.contenido;
    if (saved && typeof saved === 'string' && saved.trim()) {
      return saved;
    }

    // 4. Textos guardados en el array o mapa de textosCuotas del pagaré
    const savedTextosCuotas = (pagare as any)?.textosCuotas;
    if (savedTextosCuotas) {
      if (Array.isArray(savedTextosCuotas) && idx >= 0 && savedTextosCuotas[idx]) {
        return savedTextosCuotas[idx];
      }
      if (typeof savedTextosCuotas === 'object') {
        const byId = savedTextosCuotas[item.id] || savedTextosCuotas[idx] || savedTextosCuotas[`cuota_${idx}`];
        if (byId && typeof byId === 'string' && byId.trim()) {
          return byId;
        }
      }
    }

    // 5. Si es una cuota posterior (idx > 0) y la cuota 0 tiene texto personalizado, aplicar efecto espejo
    if (idx > 0 && pagare?.cronograma?.[0]) {
      const cuota0 = pagare.cronograma[0];
      const cuota0Text = 
        customTextos[cuota0.id] || 
        customTextosRef.current?.[cuota0.id] || 
        customTextos['idx_0'] || 
        customTextosRef.current?.['idx_0'] || 
        cuota0.texto_personalizado || 
        cuota0.textoPersonalizado || 
        (Array.isArray(savedTextosCuotas) ? savedTextosCuotas[0] : null);
      if (cuota0Text && typeof cuota0Text === 'string' && cuota0Text.trim()) {
        const mirrored = generateMirroredText(cuota0Text, item, pagare?.moneda);
        return mirrored;
      }
    }
    
    // 6. Generador de plantilla base con inyección de porcentaje dinámico
    const diaLetras = numberToWords(new Date(item.fecha_pag + 'T12:00:00').getDate()).trim().toUpperCase();
    const mesNombre = getMesNombre(new Date(item.fecha_pag + 'T12:00:00').getMonth()).trim().toUpperCase();
    const anioLetras = numberToWords(new Date(item.fecha_pag + 'T12:00:00').getFullYear()).trim().toUpperCase();
    const acreedorLimpio = sanitizeNotarialText(acreedorNombreEditable).toUpperCase();
    const domLimpio = sanitizeNotarialText(acreedorDomicilioEditable);
    const tieneDomicilio = domLimpio && domLimpio.toUpperCase() !== 'NO ESPECIFICADO';
    const domAcreedor = tieneDomicilio ? `, en su domicilio en ${domLimpio.toUpperCase()}` : '';
    const monInfo = getMonedaInfo(pagare?.moneda);
    const montoLetras = numberToWords(item.monto).trim().toUpperCase();
    const montoSimbolo = `${monInfo.simbolo} ${formatCurrencyValue(item.monto, pagare?.moneda || 'PYG').trim()}`;
    
    let rawTasa = (tasaInteresRef.current || tasaInteres || (pagare as any)?.interesPersonalizado || (pagare as any)?.tasaInteres || (pagare as any)?.tasa_interes || '').trim();
    if (rawTasa.endsWith('%')) {
      rawTasa = rawTasa.slice(0, -1).trim();
    }
    const tasa = rawTasa || '_____';

    const cPenal = (clausulaPenal || '').trim() || '454';
    const mMora = (moraAutomatica || '').trim() || '424';
    const dProtesto = (dispensaProtesto || '').trim() || '1349';

    return `El día ${diaLetras} de ${mesNombre} del año ${anioLetras}, pagaré al Señor ${acreedorLimpio}${domAcreedor}, la suma de ${monInfo.nombreMayus} ${montoLetras} (${montoSimbolo}). Si este documento no fuera pagado, devengara un interés del ${tasa}% mensual en concepto de cláusula penal (Art. ${cPenal} C.C) desde la mora, que se producirá automáticamente (Art. ${mMora} C.C) sin necesidad de interpelación judicial o extrajudicial alguna. Este documento lleva la cláusula "sin protesto" y en consecuencia, dispensa al portador de formalizar el protesto por falta de aceptación o de pago, para ejercer la acción de regreso (Art. ${dProtesto} C.C). Las partes constituyen domicilio especial en los lugares fijados más abajo.-`;
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

    const lineaFecha = cleanCiudad.trim() 
      ? `${cleanCiudad.trim()}, ${fechaEmisionSoloTexto}` 
      : `________, ${fechaEmisionSoloTexto}`;

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
      flex-wrap: wrap;
      gap: 16px;
    }
    .signature-card {
      width: 340px;
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
      font-size: 12px;
      text-transform: uppercase;
      white-space: nowrap;
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
      const cuotaText = mergedCustomTextos[item.id] || getTextoPagare(item, index);
      const certNro = getCertificadoNroForIndex(index).trim();

      html += `
  <div class="sheet">
    <div class="title">PAGARE A LA ORDEN</div>
    
    <div class="header-row">
      <div>N° ${item.numero_cuota}/${pagare.cronograma.length}</div>
      <div>${monInfo.simbolo} ${formatCurrencyValue(item.monto, pagare.moneda)}.-</div>
    </div>

    <div class="vencimiento">
      VENCIMIENTO: ${new Date(item.fecha_pag + 'T12:00:00').toLocaleDateString('es-PY')}
    </div>

    <div class="date-line">
      ${lineaFecha}
    </div>

    <div class="body-text">
      ${cuotaText}
    </div>

    <div class="signatures-block">
      <div class="signature-card">
        <div class="signature-label">Deudor Principal</div>
        <div>Nombre: <span style="text-transform: uppercase;">${sanitizeNotarialText(deudorNombreEditable)}</span></div>
        <div>Documento: C.I.N° <span style="text-transform: uppercase;">${formatDocClean(deudorDocumentoEditable)}</span></div>
        <div>Domicilio: <span style="text-transform: uppercase;">${sanitizeNotarialText(deudorDomicilioEditable)}</span></div>
      </div>

      ${(codeudor1NombreEditable || codeudor1DocumentoEditable) ? `
      <div class="signature-card">
        <div class="signature-label">Co-Deudor Solidario 1</div>
        <div>Nombre: <span style="text-transform: uppercase;">${sanitizeNotarialText(codeudor1NombreEditable)}</span></div>
        <div>Documento: C.I.N° <span style="text-transform: uppercase;">${formatDocClean(codeudor1DocumentoEditable)}</span></div>
        <div>Domicilio: <span style="text-transform: uppercase;">${sanitizeNotarialText(codeudor1DomicilioEditable)}</span></div>
      </div>` : ''}

      ${(codeudor2NombreEditable || codeudor2DocumentoEditable) ? `
      <div class="signature-card">
        <div class="signature-label">Co-Deudor Solidario 2</div>
        <div>Nombre: <span style="text-transform: uppercase;">${sanitizeNotarialText(codeudor2NombreEditable)}</span></div>
        <div>Documento: C.I.N° <span style="text-transform: uppercase;">${formatDocClean(codeudor2DocumentoEditable)}</span></div>
        <div>Domicilio: <span style="text-transform: uppercase;">${sanitizeNotarialText(codeudor2DomicilioEditable)}</span></div>
      </div>` : ''}
    </div>

    <div class="cert-footer">
      LE CORRESPONDE LA HOJA DE CERTIFICACION DE FIRMAS N° ${certNro}. SERIE PJE-${new Date().getFullYear()}.- CONSTE.
    </div>

    ${config.pdf.mostrar_pie ? `
    <div class="doc-footer">
      <div>
        <strong style="text-transform: uppercase; color: #64748b;">${config.pdf.contenido_pie || `${config.escribania.nombre} — ${config.escribania.nro_registro}`}</strong><br/>
        <span>Certificado emitido digitalmente bajo protocolo de escribanía y timbrado Paraguayo vigente.</span>
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
              <h3 className="text-sm font-black uppercase tracking-widest leading-none">Matriz de Certificación Notarial</h3>
              <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">PREVIEW INSTRUMENTO PÚBLICO - SERIE PJE-{config.anio_serie}-{pagare.correlativo}</p>
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
            <button
              onClick={() => handleGuardarPagare(true)}
              disabled={isSaving}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-700/20 cursor-pointer disabled:opacity-50"
              title="Guardar todos los cambios y cerrar vista previa"
            >
              <Check className="w-4 h-4" />
              <span>Aceptar & Cerrar Vista</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-700/20 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir Documento
            </button>
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
                  
                  <div className="flex items-baseline text-sm mb-4 print:mb-3 font-sans">
                    <div className="print:hidden">
                      <NotarialCiudadInput
                        value={ciudadEmision}
                        onChangeCiudad={(newVal) => {
                          setCiudadEmision(newVal);
                          ciudadEmisionRef.current = newVal;
                        }}
                      />
                    </div>
                    <span className="hidden print:inline font-sans text-sm text-slate-900">
                      {ciudadEmision.trim() ? `${ciudadEmision.trim()}, ` : ''}
                    </span>
                    <span className="text-slate-900 text-sm font-sans whitespace-nowrap">
                      {ciudadEmision.trim() ? fechaEmisionTexto.replace(/^,\s*/, '') : fechaEmisionTexto}
                    </span>
                  </div>
                </div>

                {/* PAGARE A LA ORDEN BODY */}
                <div className="mb-6 relative z-10 break-inside-avoid print:break-inside-avoid font-sans">
                  {/* Vista Interactiva (Pantalla): Textarea editable ultra-fluido con debounce y efecto espejo */}
                  <NotarialTextarea
                    key={`pagare-text-${item.id}`}
                    value={getTextoPagare(item, index)}
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

                  {/* Vista de Impresión Notarial: Formato texto puro con justificado milimétrico */}
                  <p className="hidden print:block text-[13px] leading-relaxed text-slate-900 text-justify font-sans whitespace-pre-wrap">
                    {getTextoPagare(item, index)}
                  </p>
                </div>

                {/* SIGNATURE BLOCK - Documentos formateados sin puntos */}
                <div className="pt-6 print:pt-4 relative z-10 flex flex-wrap gap-6 print:gap-4 font-sans break-inside-avoid print:break-inside-avoid">
                  {/* Deudor Principal */}
                  <div className="w-[340px] border-t border-black pt-1">
                    <p className="text-[11px] font-black uppercase text-slate-500 mb-0.5">Deudor Principal</p>
                    <p className="text-sm flex items-center gap-1">Nombre: <EditableField className="uppercase bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors flex-1" value={deudorNombreEditable} onChange={(val: string) => setDeudorNombreEditable(sanitizeNotarialText(val))} /></p>
                    <p className="text-sm flex items-center gap-1">Documento: C.I.N° <EditableField className="uppercase bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors flex-1" value={formatDocClean(deudorDocumentoEditable)} onChange={(val: string) => setDeudorDocumentoEditable(formatDocClean(val))} /></p>
                    <p className="text-sm flex items-center gap-1">Domicilio: <EditableField className="uppercase bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors flex-1" value={deudorDomicilioEditable} onChange={(val: string) => setDeudorDomicilioEditable(sanitizeNotarialText(val))} /></p>
                  </div>

                  {/* Co-deudor 1 (si existe) */}
                  {(codeudor1NombreEditable || codeudor1DocumentoEditable) && (
                    <div className="w-[340px] border-t border-black pt-1">
                      <p className="text-[11px] font-black uppercase text-slate-500 mb-0.5">Co-Deudor Solidario 1</p>
                      <p className="text-sm flex items-center gap-1">Nombre: <EditableField className="uppercase bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors flex-1" value={codeudor1NombreEditable} onChange={(val: string) => setCodeudor1NombreEditable(sanitizeNotarialText(val))} /></p>
                      <p className="text-sm flex items-center gap-1">Documento: C.I.N° <EditableField className="uppercase bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors flex-1" value={formatDocClean(codeudor1DocumentoEditable)} onChange={(val: string) => setCodeudor1DocumentoEditable(formatDocClean(val))} /></p>
                      <p className="text-sm flex items-center gap-1">Domicilio: <EditableField className="uppercase bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors flex-1" value={codeudor1DomicilioEditable} onChange={(val: string) => setCodeudor1DomicilioEditable(sanitizeNotarialText(val))} /></p>
                    </div>
                  )}

                  {/* Co-deudor 2 (si existe) */}
                  {(codeudor2NombreEditable || codeudor2DocumentoEditable) && (
                    <div className="w-[340px] border-t border-black pt-1">
                      <p className="text-[11px] font-black uppercase text-slate-500 mb-0.5">Co-Deudor Solidario 2</p>
                      <p className="text-sm flex items-center gap-1">Nombre: <EditableField className="uppercase bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors flex-1" value={codeudor2NombreEditable} onChange={(val: string) => setCodeudor2NombreEditable(sanitizeNotarialText(val))} /></p>
                      <p className="text-sm flex items-center gap-1">Documento: C.I.N° <EditableField className="uppercase bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors flex-1" value={formatDocClean(codeudor2DocumentoEditable)} onChange={(val: string) => setCodeudor2DocumentoEditable(formatDocClean(val))} /></p>
                      <p className="text-sm flex items-center gap-1">Domicilio: <EditableField className="uppercase bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors flex-1" value={codeudor2DomicilioEditable} onChange={(val: string) => setCodeudor2DomicilioEditable(sanitizeNotarialText(val))} /></p>
                    </div>
                  )}
                </div>

                {/* CERTIFICACION DE FIRMAS FOOTER - Márgenes calibrados para Hoja Verde Oficial */}
                <div className="mt-8 md:mt-10 print:mt-6 relative z-10 break-inside-avoid print:break-inside-avoid font-sans pb-4 print:pb-2">
                  <div className="text-[12px] uppercase whitespace-nowrap">
                    LE CORRESPONDE LA HOJA DE CERTIFICACION DE FIRMAS N° <EditableField className={`bg-transparent outline-none border-b border-transparent ${index === 0 ? 'hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 cursor-text' : 'cursor-default'} transition-colors`} value={getCertificadoNroForIndex(index).trim()} onChange={(val: string) => { if (index === 0) setBaseCertificadoNro(val.trim()); }} />. SERIE PJE-{new Date().getFullYear()}.- CONSTE.
                  </div>
                </div>

                {/* G. PDF Pie footer */}
                {config.pdf.mostrar_pie && (
                  <div className="pt-4 border-t border-slate-200 text-[9px] text-slate-400 flex flex-col sm:flex-row sm:justify-between items-center gap-2 font-mono" style={{ pageBreakBefore: 'avoid' }}>
                    <div className="text-center sm:text-left leading-relaxed">
                      <p className="font-bold uppercase text-slate-500">
                        {config.pdf.contenido_pie || `${config.escribania.nombre} — ${config.escribania.nro_registro}`}
                      </p>
                      <p className="mt-0.5">Certificado emitido digitalmente bajo protocolo de escribanía y timbrado Paraguayo vigente.</p>
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
      </div>
    </div>
  );
};
