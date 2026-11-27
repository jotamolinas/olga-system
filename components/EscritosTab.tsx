import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, Timestamp, doc, deleteDoc, onSnapshot, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/auth';
import { useWorkspace } from '../hooks/useWorkspace';
import { useTrialStatus } from '../hooks/useTrialStatus';
import { 
  FileText, FilePlus, Loader2, Calendar, Trash2, Settings, MoreVertical, 
  Copy, FolderInput, X, Check, Edit3, Plus, Printer, Save, 
  RotateCcw, Eye, Search, AlertCircle, FileCheck, Sparkles, 
  Paperclip, Send, CheckCheck,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered,
  HelpCircle, ArrowRight, ArrowLeft, Clipboard, Upload, MessageCircle, Download, Minus
} from 'lucide-react';
import { limpiarLatexJuridico, redactarEscritoConIA } from '../services/gemini';
import { User } from 'firebase/auth';
import mammoth from 'mammoth';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Expediente } from '../types';
import { ModalAdministrarCarpetas, Carpeta } from './ModalAdministrarCarpetas';
import { EditorNotarialOficial } from './EditorNotarialOficial';
import { WhatsAppSendModal } from './WhatsAppSendModal';
import { generateDocumentPdfBase64, buildWhatsAppDocumentMessage } from '../services/pdfExport';
import { wrapSignatureBlocksForPrint } from './DocumentoModal';

const EDITOR_FONT_FAMILIES = [
  'Times New Roman',
  'Arial',
  'Georgia',
  'Calibri',
  'Verdana',
  'Courier New',
] as const;

const EDITOR_FONT_SIZES_PT = [10, 11, 12, 13, 14, 16, 18] as const;

const EDITOR_TEXT_COLORS = [
  { hex: '#0f172a', label: 'Negro' },
  { hex: '#475569', label: 'Gris oscuro' },
  { hex: '#dc2626', label: 'Rojo' },
  { hex: '#2563eb', label: 'Azul' },
  { hex: '#1e3a8a', label: 'Azul marino' },
  { hex: '#16a34a', label: 'Verde' },
  { hex: '#ea580c', label: 'Naranja' },
  { hex: '#991b1b', label: 'Bordo' },
] as const;

const EDITOR_LINE_HEIGHTS = [
  { value: '1.0', label: '1.0 (Compacto)' },
  { value: '1.15', label: '1.15 (Estándar)' },
  { value: '1.5', label: '1.5 (Formal)' },
  { value: '2.0', label: '2.0 (Doble)' },
] as const;

type EditorPageMargins = 'normal' | 'estrecho' | 'amplio';

const PAGE_MARGIN_PROFILES: Record<
  EditorPageMargins,
  {
    label: string;
    shortLabel: string;
    topCm: number;
    bottomCm: number;
    leftCm: number;
    rightCm: number;
    cssMargin: string;
  }
> = {
  normal: {
    label: 'Normal (2.5 cm)',
    shortLabel: 'Normal',
    topCm: 2.5,
    bottomCm: 2.5,
    leftCm: 2.5,
    rightCm: 2.5,
    cssMargin: '2.5cm 2.5cm 2.5cm 2.5cm',
  },
  estrecho: {
    label: 'Estrecho (1.27 cm)',
    shortLabel: 'Estrecho',
    topCm: 1.27,
    bottomCm: 1.27,
    leftCm: 1.27,
    rightCm: 1.27,
    cssMargin: '1.27cm 1.27cm 1.27cm 1.27cm',
  },
  amplio: {
    label: 'Amplio (3.0 / 3.5 cm)',
    shortLabel: 'Amplio',
    topCm: 3.0,
    bottomCm: 3.0,
    leftCm: 3.5,
    rightCm: 3.5,
    cssMargin: '3cm 3.5cm 3cm 3.5cm',
  },
};

const resolveEditorFontCss = (family?: string): string => {
  switch (family) {
    case 'Arial':
      return 'Arial, Helvetica, sans-serif';
    case 'Georgia':
      return 'Georgia, "Times New Roman", serif';
    case 'Calibri':
      return 'Calibri, "Segoe UI", Arial, sans-serif';
    case 'Verdana':
      return 'Verdana, Geneva, sans-serif';
    case 'Courier New':
      return '"Courier New", Courier, monospace';
    case 'Times New Roman':
    default:
      return '"Times New Roman", Times, serif';
  }
};

const stripHtmlToPlainText = (raw?: string): string => {
  if (!raw) return '';
  return raw
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;|\u00A0/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

const escapeHtmlText = (raw: string): string =>
  raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const limpiarNodosVaciosFinalesHtml = (rawHtml: string): string => {
  if (!rawHtml || typeof document === 'undefined') return rawHtml || '';
  try {
    const container = document.createElement('div');
    container.innerHTML = rawHtml;

    const hasVisualMedia = (el: Element): boolean =>
      Boolean(el.querySelector('img, table, hr, svg'));

    const isTrailingEmptyNode = (node: ChildNode | null): boolean => {
      if (!node) return false;
      if (node.nodeType === Node.TEXT_NODE) {
        return !(node.nodeValue || '').replace(/[\u00A0\u200B]/g, ' ').trim();
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return true;
      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      if (tag === 'img' || tag === 'table' || tag === 'hr' || tag === 'svg') return false;
      if (el.classList.contains('salto-de-pagina') || el.classList.contains('salto-de-pagina-print')) {
        return true;
      }
      if (hasVisualMedia(el)) return false;
      const text = (el.textContent || '').replace(/[\u00A0\u200B]/g, ' ').trim();
      return text.length === 0;
    };

    while (container.lastChild && isTrailingEmptyNode(container.lastChild)) {
      container.removeChild(container.lastChild);
    }

    const lastEl = container.lastElementChild;
    if (lastEl && !hasVisualMedia(lastEl)) {
      while (lastEl.lastChild) {
        const lastInner = lastEl.lastChild;
        if (lastInner.nodeType === Node.ELEMENT_NODE && (lastInner as Element).tagName.toLowerCase() === 'br') {
          lastEl.removeChild(lastInner);
        } else if (
          lastInner.nodeType === Node.TEXT_NODE &&
          !(lastInner.nodeValue || '').replace(/[\u00A0\u200B]/g, ' ').trim()
        ) {
          lastEl.removeChild(lastInner);
        } else {
          break;
        }
      }
    }

    return container.innerHTML;
  } catch {
    return rawHtml;
  }
};

const limpiarEspaciadoresVisualesHtml = (rawHtml: string): string => {
  if (!rawHtml || typeof document === 'undefined') return rawHtml || '';
  if (!rawHtml.includes('data-olga-page-spacer') && !rawHtml.includes('--olga-spacer-mt')) {
    return rawHtml;
  }
  try {
    const container = document.createElement('div');
    container.innerHTML = rawHtml;
    container.querySelectorAll('[data-olga-page-spacer], [style*="--olga-spacer-mt"]').forEach((node) => {
      const el = node as HTMLElement;
      el.removeAttribute('data-olga-page-spacer');
      el.style.removeProperty('--olga-spacer-mt');
      const remainingStyle = (el.getAttribute('style') || '').trim();
      if (!remainingStyle) {
        el.removeAttribute('style');
      }
    });
    return container.innerHTML;
  } catch {
    return rawHtml;
  }
};

const waitForImagesInList = async (imgs: HTMLImageElement[], timeoutMs = 3500): Promise<void> => {
  if (!imgs || imgs.length === 0) return;
  await Promise.race([
    Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) {
              if (img.naturalWidth > 0 && typeof img.decode === 'function') {
                img.decode().then(() => resolve()).catch(() => resolve());
              } else {
                resolve();
              }
              return;
            }
            const done = () => {
              if (typeof img.decode === 'function') {
                img.decode().then(() => resolve()).catch(() => resolve());
              } else {
                resolve();
              }
            };
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          })
      )
    ),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
};

interface Escrito {
  id: string;
  texto: string;
  fechaCreacion?: Timestamp;
  createdAt?: string;
  tipo: string;
  tipoHoja?: 'blanca' | 'protocolo';
  includeHeader?: boolean;
  fontFamily?: string;
  fontSizePt?: number;
  lineHeight?: string;
  pageMargins?: EditorPageMargins;
  userId: string;
  categoria?: string;
  correlativo?: string | number;
  creator_id?: string;
  createdBy?: string;
  creator_name?: string;
  creator_role?: string;
}

interface EscritosTabProps {
  currentUser: User | null;
  userProfile?: any;
  personas?: any[];
  expedientes?: Expediente[];
  onOpenDocument: (text: string, docId?: string, tipo?: string, categoria?: string, tipoHoja?: 'blanca' | 'protocolo', includeHeader?: boolean) => void;
  esPlanFull?: boolean;
  isSoftBlocked?: boolean;
  canUseWhatsApp?: boolean;
}

// =========================================================================
// UTILIDADES: CONVERSIÓN DE NÚMEROS A LETRAS Y AUTOFILL INTELIGENTE
// =========================================================================

export function numeroALetras(num: number): string {
  if (isNaN(num) || num === null || num === undefined) return '';
  num = Math.floor(Math.abs(num));
  if (num === 0) return 'CERO';

  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const diez_diecinueve = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const veintis = ['VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  function getTriplets(n: number): string {
    if (n === 100) return 'CIEN';
    let res = '';
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (c > 0) {
      if (c === 1 && d === 0 && u === 0) res += 'CIEN ';
      else res += centenas[c] + ' ';
    }

    if (d === 1) {
      res += diez_diecinueve[u] + ' ';
    } else if (d === 2) {
      res += veintis[u] + ' ';
    } else {
      if (d > 0) {
        res += decenas[d] + ' ';
        if (u > 0) res += 'Y ';
      }
      if (u > 0) res += unidades[u] + ' ';
    }
    return res.trim();
  }

  let str = '';
  const milesMillones = Math.floor(num / 1000000000);
  const millones = Math.floor((num % 1000000000) / 1000000);
  const miles = Math.floor((num % 1000000) / 1000);
  const restos = num % 1000;

  if (milesMillones > 0) {
    if (milesMillones === 1) str += 'MIL MILLONES ';
    else str += getTriplets(milesMillones) + ' MIL MILLONES ';
  }

  if (millones > 0) {
    if (millones === 1) str += 'UN MILLÓN ';
    else str += getTriplets(millones) + ' MILLONES ';
  }

  if (miles > 0) {
    if (miles === 1) str += 'MIL ';
    else str += getTriplets(miles) + ' MIL ';
  }

  if (restos > 0) {
    str += getTriplets(restos);
  }

  return str.trim();
}

// Alias de conversión legal de números a letras
export const c9e = numeroALetras;

export function procesarAutofillPlantilla(
  textoPlantilla: string,
  personaActiva?: any | null
): string {
  const now = new Date();
  const dia = String(now.getDate());
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  const mes = meses[now.getMonth()];
  const anio = String(now.getFullYear());

  let texto = textoPlantilla;

  // Inyector de Fechas del sistema
  texto = texto.replace(/\[DIA\]|\{\{DIA\}\}/g, dia);
  texto = texto.replace(/\[MES\]|\{\{MES\}\}/g, mes);
  texto = texto.replace(/\[AÑO\]|\[ANIO\]|\{\{AÑO\}\}|\{\{ANIO\}\}/g, anio);
  texto = texto.replace(/a los _____ días del mes de ____________ del año (?:2026|dos mil veintiséis)/g, `a los ${dia} días del mes de ${mes} del año ${anio}`);
  texto = texto.replace(/a los _____ días del mes de ____________ de 2026/g, `a los ${dia} días del mes de ${mes} del año ${anio}`);

  // Desactivación estricta de pre-carga de usuario (Evitar Datos Pre-cargados / Limpieza de Usuario):
  // Todos los nombres, cédulas y datos personales en la plantilla inicial deben generarse estrictamente
  // como espacios vacíos (_______) para que el asistente pregunte por ellos.
  texto = texto.replace(/\{\{NOMBRE\}\}/g, '_______');
  texto = texto.replace(/\{\{DOCUMENTO\}\}/g, '_______');
  texto = texto.replace(/\{\{NACIONALIDAD\}\}/g, '_______');
  texto = texto.replace(/\{\{ESTADO_CIVIL\}\}/g, '_______');
  texto = texto.replace(/\{\{PROFESION\}\}/g, '_______');
  texto = texto.replace(/\{\{DIRECCION\}\}/g, '_______');

  return texto;
}

export function construirConstitucionSA(
  numSocios: number = 2
): string {
  const now = new Date();
  const dia = String(now.getDate());
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  const mes = meses[now.getMonth()];
  const anio = String(now.getFullYear());

  const partesComparecientes: string[] = [];

  // Bucle dinámico según la cantidad de socios solicitada (N)
  for (let i = 1; i <= numSocios; i++) {
    const isFirst = i === 1;
    const isLast = i === numSocios;
    const prefijo = numSocios === 1 ? '' : (isFirst ? 'por una parte' : (isLast ? 'y por la otra' : 'por otra parte'));

    // Bloque notarial estricto con campos dinámicos únicamente para datos personales
    const bloqueSocio = `Don/Doña _______, de nacionalidad _______, de estado civil _______, con Cédula de Identidad Civil Nº _______, de profesión _______, domiciliado/a en _______`;

    partesComparecientes.push(prefijo ? `${prefijo}, ${bloqueSocio}` : bloqueSocio);
  }

  const parrafoComparecientes = `COMPARECEN: ${partesComparecientes.join('; ')}; personas mayores de edad, hábiles, quienes declaran haber cumplido con las Leyes de carácter personal, y acreditan sus identidades conforme a los documentos mencionados más arriba.-`;

  const lineasSuscripcion: string[] = [];
  for (let i = 1; i <= numSocios; i++) {
    lineasSuscripcion.push(`   ${i}°) El socio Nº ${i} _______ suscribe e integra _______ Acciones ordinarias, totalizando la suma de GUARANÍES _______ (Gs. _______), en efectivo;`);
  }

  const directoresTransitorios: string[] = [
    `   - PRESIDENTE: Don/Doña _______;`,
    `   - VICEPRESIDENTE: Don/Doña _______;`
  ];
  if (numSocios >= 3) {
    for (let s = 3; s <= numSocios; s++) {
      directoresTransitorios.push(`   - DIRECTOR TITULAR: Don/Doña _______;`);
    }
  }
  directoresTransitorios.push(
    `   - SINDICO TITULAR: Don/Doña _______, de nacionalidad _______, de estado civil _______, con Cédula de Identidad Civil Nº _______, domiciliado/a en _______;`,
    `   - SINDICO SUPLENTE: Don/Doña _______, de nacionalidad _______, de estado civil _______, con Cédula de Identidad Civil Nº _______, domiciliado/a en _______.-`
  );

  const firmasSocios = Array.from({ length: numSocios }, () => `_______`).join('.- ');

  return `CONSTITUCION DE LA FIRMA: "_______" SOCIEDAD ANONIMA.- ESCRITURA PUBLICA NUMERO: _______.- En la ciudad de _______, Capital del Departamento de _______, República del Paraguay, a los ${dia} días del mes de ${mes} del Año ${anio}; Ante mí: _______, NOTARIO Y ESCRIBANO PUBLICO, con Registro Nº _______, con asiento en ésta Ciudad Departamental, ${parrafoComparecientes}
Y los comparecientes, DICEN: Que han resuelto constituir una SOCIEDAD ANONIMA la que ajustará su desenvolvimiento a los Estatutos cuyas cláusulas son las siguientes:

TITULO I.- DE LA DENOMINACION, DOMICILIO, DURACION Y OBJETO.-
ARTICULO 1º: DE LA DENOMINACION Y DOMICILIO: Queda constituida una Sociedad Anónima con la denominación de "_______" SOCIEDAD ANONIMA, que se regirá por el presente Estatuto y por las Disposiciones Legales reglamentarias vigentes en el país.-
ARTICULO 2º: La Sociedad constituye domicilio legal en la ciudad de _______, Departamento de _______, República del Paraguay, pudiendo establecer Agencias, Sucursales y cualquier otro tipo de Representación dentro o fuera de la República, las cuales se considerarán domiciliadas en el lugar donde se encuentren, a los efectos del cumplimiento de las obligaciones allí contraídas.-
ARTICULO 3º: DURACION.- La duración de la Sociedad queda fijada en noventa y nueve (99) años, contados a partir de la fecha de inscripción en el Registro Público de Comercio y en el Registro de Personas Jurídicas y Asociaciones, pudiendo ser prorrogado por otro Período.-
ARTICULO 4º: DEL OBJETO: La Sociedad tiene por objeto dedicarse por cuenta propia, de terceros o asociada a terceros, en cualquier punto de la República o del extranjero, a efectuar las siguientes operaciones: a) COMERCIALES: Compra, venta, acopio, importación, exportación, consignación y distribución, ejercicio de representaciones, comisiones y mandatos, intermediaciones, instalación de depósito, almacenes de ramos generales, referentes a los productos originados en la agricultura, forestación, viveros y aserraderos; todos los subproductos y derivados, elaborados, naturales o semielaborados, pudiendo extender hasta las etapas comerciales e industriales de los mismos, tales como las semillas, cereales, oleaginosas, hojas, etc.; la importación y exportación de todo tipo de mercaderías, productos agropecuarios, forestales, industriales, máquinas y elementos mecanizados de todo tipo para su propia explotación o su comercialización, fraccionamiento y distribución. Comprar y vender derechos y acciones, bonos, debentures, obligaciones y otros títulos de renta, dentro y fuera del país, solicitar privilegios a las autoridades nacionales o en el extranjero a fin de proteger o facilitar el cumplimiento de los fines propuestos; constituir nuevas Sociedades subsidiarias, efectuar fusiones o combinaciones de intereses con personas o Sociedades domiciliadas dentro o fuera del país, y constituir consorcios de todo tipo; b) INDUSTRIAS: Mediante la producción, elaboración y transformación en todas sus formas de materias primas, productos, subproductos semielaborados o manufacturados. Propender al desarrollo de la industria en general y al lucro de esta actividad mediante la asociación de capitales, y a la proyección, ampliación, desarrollo, dirección y administración de cualquier negocio lícito, sea civil o comercial; para el cumplimiento de sus fines podrá solicitar a los Poderes Públicos competentes los beneficios acordados por la Ley Nº 60/90 de Inversiones, como así también los beneficios del sector industrial, comercial o de servicios establecidos por las leyes que rigen o rijan en el futuro; c) INMOBILIARIAS: A la compra, venta, permuta o cualquier otra forma de comercialización de inmuebles, urbanos o rurales, arrendamiento, administración, loteamiento, urbanización y colonización de tierras, con sujeción a las leyes que rigen la materia; d) SERVICIOS: Mediante la prestación de toda clase de servicios a empresas particulares o públicas, nacionales o extranjeras, como ser la contratación de personal técnico o administrativo, asesoramiento, estudio de riesgo y seguros, consultoría y eventos en general; e) MAQUILA: Operaciones industriales maquiladoras o submaquiladoras, total o parcialmente, realizar procesos industriales, comerciales o de servicios incorporando mano de obra y otros recursos nacionales, destinados a la transformación de mercancías de procedencia extranjera, importadas temporalmente a dicho efecto para su reexportación posterior, en ejecución de un contrato suscripto con una empresa domiciliada en el extranjero; f) JOINT VENTURE: Mediante la cooperación o unión de empresas en forma transitoria o permanente para aportar tecnología, capital y otros recursos relacionados con el cumplimiento de su objeto societario, o para emprender una actividad económica, industrial, comercial o de investigación para el mejoramiento y el desarrollo de la entidad; g) LEASING: Mediante el contrato de arrendamiento de bienes diversos, como: maquinarias, vehículos, locales comerciales, fábricas, depósitos, establecimientos agrícolas-ganaderos, silvícolas, etc., optando o no por la compra al finalizar el contrato por valor residual para el desarrollo empresarial. Las actividades económicas que constituyen el objeto de la Sociedad, hasta aquí enumeradas no son taxativas, por lo que no excluyen ningún acto o contrato lícito de cualquier naturaleza que no siendo contrario a estos estatutos, sea de interés para la buena marcha, desenvolvimiento y crecimiento de la Sociedad. La Sociedad tendrá plena capacidad jurídica para el cumplimiento de su objeto y para realizar todo tipo de operaciones previstas en el presente contrato y en las leyes que rigen la materia, pudiendo: a) Celebrar contratos de fletamentos, construcción, compraventa de bienes raíces; b) Planificar, organizar, dirigir y controlar las actividades de la Sociedad por medio de los órganos naturales establecidos en la Ley y estos Estatutos; c) Comprar, transferir y/o locar bienes muebles, inmuebles, automotores y maquinarias o equipos para el funcionamiento de la Sociedad, aceptar hipotecas y prendas; d) Constituir, ceder, descontar o transferir toda clase de derechos reales para el cumplimiento de sus fines; e) Contratar préstamos de bancos y otras entidades financieras para su aplicación al funcionamiento de las actividades normales de la entidad; f) Efectuar depósitos en caja de ahorros, cuentas corrientes y otras operaciones bancarias y financieras; g) Ejercer toda clase de acciones judiciales en defensa de los intereses de la Sociedad; y en fin realizar cuantos actos y actividades fueren necesarios para el logro de sus fines y objetivos, siempre dentro del marco legal y estatutario.-

TITULO II.- DEL CAPITAL Y LAS ACCIONES.-
ARTICULO 5º: DEL CAPITAL SOCIAL: De conformidad con las Disposiciones del Artículo 4º de la Ley 388/94, que modifica el Artículo 1.050 del Código Civil, el Capital Social queda fijado en la suma de GUARANÍES _______ (Gs. _______), representado por _______ Acciones ordinarias y nominativas no endosables de un valor nominal de GUARANÍES _______ (Gs. _______) cada una de ellas, las cuales serán individualizadas correlativamente con números arábigos desde el 1 (uno) en adelante. Y cada Acción totalmente integrada da derecho a un (1) voto. Todas las Acciones quedan totalmente suscriptas e integradas por los accionistas en la proporción y forma que se indica más adelante.-
ARTICULO 6º: Las acciones serán ordinarias, nominativas no endosables e indivisibles y contendrán las especificaciones previstas en el Código Civil y las que determinare el Directorio y deberán ser firmadas por el PRESIDENTE DEL DIRECTORIO y por el VICE PRESIDENTE. Cada acción ordinaria dará derecho a un (1) voto.-
ARTICULO 7º: EMISION E INTEGRACION DE ACCIONES.- PREFERENCIAS DE LOS ACCIONISTAS ACTUALES: La emisión de las demás acciones del capital autorizado será dispuesta por la Asamblea Ordinaria, la cual podrá delegar en el Directorio la fijación de las normas para la suscripción e integración de las acciones emitidas y la implementación de las nuevas emisiones, siempre de conformidad a las resoluciones adoptadas por la Asamblea y atendiendo a las necesidades e intereses societarios. Dicha emisión se hará constar en Escritura Pública debiendo procederse a su inscripción en el Registro Público de Comercio. No podrá efectuarse una nueva emisión de acciones sin que la anterior haya sido totalmente suscripta e integrada. En toda nueva emisión de acciones serán preferidas las acciones actuales, en proporción a las que posean al tiempo de la emisión. Corresponderá al Directorio establecer el procedimiento para asegurar este derecho de preferencia. Mientras las acciones no se hallaren totalmente pagadas se otorgarán certificados provisionales nominativos, canjeables una vez que dichas acciones se encuentren totalmente abonadas.-
ARTICULO 8º: TRANSFERENCIA DE ACCIONES.- En caso de que los accionistas deseen transferir sus acciones, deberán ofertarlas en primer término a los otros accionistas de la empresa. El interesado deberá comunicar fehacientemente por nota al Directorio de la Sociedad su intención de vender, con indicación de las acciones afectadas, valor de venta, condiciones de pago y nombre y dirección del eventual adquirente. El Directorio dentro de las 48 horas comunicará por nota a los demás accionistas la oferta realizada y éstos podrán hacer uso del derecho de preferencia dentro de los sesenta (60) días siguientes. Vencido este plazo, dentro de los cinco (5) días siguientes, las acciones que no fueren adquiridas serán distribuidas a prorrata entre los otros accionistas que las solicitaren. Si vencido este último plazo aún quedaren acciones sin ser compradas, el propietario podrá venderlas a la persona que conforme a la nota presentada sea la interesada. Ningún accionista podrá vender sus acciones a una persona distinta a la indicada en su nota dirigida al Directorio de la Sociedad.-
ARTICULO 9º: COTIZACION DE LAS ACCIONES.- La sociedad podrá, en cualquier momento en que lo decida el Directorio, previa conformidad de la Asamblea Extraordinaria, cumpliendo con los requisitos y modalidades establecidas en las disposiciones legales que regulen el mercado de capitales, cotizar sus acciones u otros títulos valores y papeles de comercio, en la Bolsa de Valores y Productos de Asunción, en cuyo caso deberá la misma llevar el agregado de Emisora de Capital Abierto. Asimismo, por Resolución de la Asamblea Extraordinaria, y en la medida en que se reúnan las condiciones para ello, la Sociedad podrá hacer lo propio en los mercados bursátiles del exterior.-

TITULO IV.- OBLIGACIONES O DEBENTURES.-
ARTICULO 10º: DEBENTURES Y OTROS VALORES.- Queda facultado el Directorio, previa Resolución de la Asamblea Extraordinaria a emitir obligaciones u otros títulos valores y papeles de comercio, nominativos o al portador, dentro o fuera del país, sin más limitaciones que las consignadas en el Código Civil y en las leyes especiales, pudiendo realizar cuantas más gestiones y contratos considere y fueren necesarios para el efecto. Los poderes concedidos al Directorio por este artículo, incluyen la facultad de contratar la emisión de las obligaciones en moneda nacional o extranjera, pudiendo realizar las emisiones con garantía real o especial y con todas las demás condiciones que crea convenientes.-

TITULO V.- DIRECCION, ADMINISTRACION Y FISCALIZACION.-
ARTICULO 11º: DIRECCION SOCIAL: Corresponde al Directorio la dirección y administración de la Sociedad. El Directorio estará integrado por un Presidente, un Vice Presidente y Directores Titulares designados por la Asamblea. Los miembros del Directorio durarán dos (2) años en sus funciones, pudiendo ser reelectos sin limitación alguna. Los mismos permanecerán en sus cargos hasta la realización de la Asamblea que designe a sus reemplazantes.-
ARTICULO 12º: SESIONES DEL DIRECTORIO.- El Directorio sesionará válidamente con la presencia de la mayoría de los Miembros Titulares y sus decisiones serán adoptadas por simple mayoría de los presentes. En el supuesto de empate, corresponderá al Presidente el voto decisorio. Las resoluciones tomadas se consignarán al final de cada sesión en el Libro de Actas del Directorio y las actas serán firmadas por todos los presentes.-
ARTICULO 13º: FRECUENCIA DE LAS SESIONES DEL DIRECTORIO.- El Directorio se reunirá regularmente en el domicilio social, convocado por el Presidente, con la frecuencia que la atención de los negocios sociales lo requiera, o cuando lo solicitaren un (1) miembro del Directorio o el Síndico, quienes lo harán por escrito, expresando el motivo de la convocatoria. En este último caso, el Presidente convocará a reunión dentro de un plazo de dos (2) días y no mayor de ocho (8) días a contar desde la fecha de la solicitud, mediante comunicación escrita a través de medios fehacientes o telemáticos y, en caso de urgencia, mediante comunicación telefónica.-
ARTICULO 14º: COMPATIBILIDAD DEL CARGO DE DIRECTOR CON OTRAS FUNCIONES.- Es compatible el cargo de Director con el desempeño de cualquier otra función rentada de la Sociedad, así como también con el de otros cargos privados y públicos no prohibidos por las leyes, ni incompatibles con los fines sociales. El Directorio delegará funciones ejecutivas o trabajos concretos en un comité ejecutivo o en uno o más gerentes o apoderados, cuya designación podrá recaer o no en los integrantes de dicho cuerpo, con distribución de los cargos y funciones de administración, asignando a cada área un representante por cada veinte por ciento (20%) del paquete accionario.-
ARTICULO 15º: REMUNERACION DE LOS DIRECTORES Y EL SINDICO.- Los miembros Titulares y Suplentes en funciones y el Síndico gozarán de una asignación mensual que la Asamblea General Ordinaria de Accionistas fijare anualmente, sin perjuicio de otras remuneraciones adicionales o complementarias que pueden ser establecidas al final de cada ejercicio.-
ARTICULO 16º: FISCALIZACION DE LA SOCIEDAD.- La fiscalización de la Sociedad será ejercida por un Síndico designado en su caso por la Asamblea anualmente, cuyas atribuciones serán las que el Código Civil determine. Asimismo, ésta designará un Síndico Suplente que reemplazará al Titular en caso de ausencia, renuncia, fallecimiento e inhabilidad.-

TITULO VI.- DEL PRESIDENTE.-
ARTICULO 17º: ATRIBUCIONES DEL PRESIDENTE.- El Presidente del Directorio競tendrá las siguientes atribuciones: a) Ejercer la representación legal de la Sociedad en la forma prevista en estos estatutos; b) Convocar al Directorio y las Asambleas y presidir las reuniones de Directorio; c) Cumplir y hacer cumplir estos estatutos y las resoluciones de las Asambleas y del Directorio.-
ARTICULO 18º: SUSTITUCION DEL PRESIDENTE.- En caso de renuncia, ausencia, fallecimiento o cualquier otro impedimento del Presidente, lo reemplazará el Vice-Presidente con las mismas atribuciones y facultades.-

TITULO VII.- DEBERES Y ATRIBUCIONES DEL DIRECTORIO.- USO DE LA FIRMA.-
ARTICULO 19º: FUNCIONES Y FACULTADES DEL DIRECTORIO.- El Directorio tiene amplias facultades para dirigir y administrar la Sociedad, en todo y en cualquier acto y contrato, sea civil, comercial, administrativo, financiero, bancario y/o judicial, que esté dentro del objeto de la Sociedad, directa o indirectamente, o tienda a su cumplimiento, gozando a tal fin de las más amplias facultades legales, incluso las que requieran poder especial, con excepción de las atribuciones personalizadas, las reservas a la Asamblea, a los Accionistas y/o el Síndico. La firma social será ejercida por el Presidente y Vice-Presidente en forma Conjunta o indistintamente. El Directorio establecerá las condiciones y alcances para la contratación de créditos financieros y asunción de garantías hipotecarias y prendarias, en resolución tomada por mayoría de votos presentes. El Directorio, por mayoría absoluta, designará uno o más apoderados, que tendrán el uso de la firma social, con las facultades establecidas en los poderes respectivos, los cuales serán pasados en Escritura Pública e inscriptos en el Registro Público respectivo. Es de competencia del Directorio realizar, entre los que son autorizados, los siguientes actos: a) Administrar y dirigir los negocios sociales; b) Resolver los casos no previstos en los estatutos, dando la intervención al Síndico; c) Disponer la forma de pago de las acciones que se emiten con posterioridad al acto de constitución de la Sociedad; d) Convocar a Asambleas Ordinarias y Extraordinarias; e) Presentar anualmente la memoria del ejercicio, el balance, el inventario y la cuenta de ganancias y pérdidas; f) Nombrar o remover al gerente general, a los gerentes y apoderados y a los demás empleados, y celebrar con los mismos contratos de trabajo individuales o colectivos, fijar sus sueldos y sus deberes y atribuciones; g) Realizar en nombre de la Sociedad cuantas operaciones y gestiones fuesen necesarias, para la obtención del objeto social, estando investido a tal efecto de los más amplios poderes, y para ello podrá adquirir por compra u otra forma legal, bienes muebles, inmuebles y/o semovientes, venderlos, arrendarlos, transferirlos y gravarlos con cualquier clase de garantías, dar y tomar préstamos, garantizarlos o no con derechos reales, dar y tomar avales o fianzas, siempre y cuando no sea en favor de terceros ni en negocios extraños a los intereses de la Sociedad, aceptar, constituir, transferir y extinguir hipotecas, y todo otro derecho real, adquirir o ceder créditos, comprar y vender mercaderías y productos, derechos, títulos y todo tipo de papeles de comercio, negociar todo género de concesiones, dar y recibir depósitos con o sin interés, en moneda nacional y/o extranjera, permutar, dar, recibir en pago cualquier clase de bienes, cobrar, percibir, efectuar pagos y transacciones, aún las que no sean ordinarias de la administración, celebrar contratos de locación y rescindirlos, conferir poderes generales y especiales para todo tipo de representación de la Sociedad, inclusive para aquellos actos enumerados taxativamente en el Capítulo VII, Del Mandato, del Código Civil, y revocarlos, formular denuncias y entablar querellas en nombre de la Sociedad, registrar, adquirir, transferir y rescindir marcas de fábrica y de comercio, patentes, licencias, franquicias y todo otro tipo de concesión de empresas del país o del extranjero, efectuar toda clase de operaciones financieras con toda clase de bancos y demás instituciones financieras, públicas o privadas, del país o del extranjero, pudiendo solicitar y obtener créditos, descuentos, realizar depósitos, operar en cuentas corrientes, girar contra los fondos depositados o en descubierto, con la correspondiente autorización de la entidad bancaria del caso, extraer parcial o totalmente lo depositado en nombre de la Sociedad, librar y aceptar letras de cambio, cheques, vales, giros, cartas de crédito, pagarés y demás documentos de créditos, endosarlos, negociarlos, etc., para todo cual podrá suscribir cuantos instrumentos públicos y privados fueren menester. La enunciación que antecede no es limitativa ni taxativa, sino simplemente enunciativa, pues la Sociedad podrá hacer toda clase de negocios que resuelvan los socios y que sean permitidos por las leyes, que relacionen directa o indirectamente con su objeto.-

TITULO VIII.- DE LAS ASAMBLEAS.-
ARTICULO 20º: ASAMBLEAS ORDINARIAS.- La Asamblea General Ordinaria se reunirá dentro de los cuatro (4) meses siguientes al cierre del ejercicio anual o cuando fuere necesario o conveniente a los intereses sociales. Son atribuciones de las Asambleas Ordinarias: a) La consideración de la memoria anual, balance general, cuentas de ganancias y pérdidas e informe del Síndico; b) Elección de los miembros del Directorio y de los Síndicos y fijación de sus remuneraciones y gratificaciones; c) Constitución de fondos de reserva y distribución de utilidades; d) Cualquier otro punto incluido en el orden del día.-
ARTICULO 21º: ASAMBLEAS EXTRAORDINARIAS.- Las Asambleas Extraordinarias se reunirán cuando el Directorio o el Síndico lo consideren necesario o lo soliciten accionistas que cuando menos representen el veinte por ciento (20%) de capital integrado. En este último caso deberá realizarse la Asamblea dentro de los treinta (30) días de su petición.-
ARTICULO 22º: QUORUM ASAMBLEARIO.- Las Asambleas Ordinarias se considerarán válidamente constituidas con la asistencia de accionistas que representen por lo menos la mitad más una de las acciones con derecho a voto. Las Extraordinarias lo harán con la asistencia de accionistas que representen el sesenta por ciento (60%) de las acciones con derecho a voto. Podrán realizarse la primera y la segunda convocatorias simultáneamente, y en este caso, la Asamblea, en segunda convocatoria, podrá celebrarse el mismo día, una hora después de la fijación para la primera. Las resoluciones adoptadas por la Asamblea, en segunda convocatoria, serán válidas cualquiera sea el número de acciones representadas en ellas, en el caso de las Ordinarias y con los accionistas que representen cuando menos el treinta por ciento (30%) de las acciones con derecho a voto, en el de las Extraordinarias. Las decisiones de las Asambleas se adoptarán por mayoría absoluta, es decir, la mitad más una de las acciones integradas, excepto en los casos previstos en el Código Civil, en el que la mayoría requerida será la establecida en dicho cuerpo legal. Las convocatorias para las Asambleas, tanto ordinarias como extraordinarias, se harán por avisos publicados en un diario de gran circulación por cinco (5) días consecutivos con diez (10) días de anticipación por lo menos o por tres (3) días por lo menos, según se trate de primera o segunda convocatoria.-
ARTICULO 23º: PARTICIPACION EN LAS ASAMBLEAS.- Los accionistas podrán concurrir personalmente o hacerse representar en las Asambleas, por mandatarios socios o extraños, bastando a tal efecto una simple carta poder con firma autenticada o registrada en la Sociedad, dirigida al Presidente.-
ARTICULO 24º: DEPOSITO DE ACCIONES.- Para tomar parte de las deliberaciones de las Asambleas, los accionistas deberán depositar sus acciones en la caja social con tres (3) días hábiles de anticipación por lo menos, o presentar un recibo o certificado expedido por un banco del país o del extranjero que acredite hallarse depositadas en él las acciones. Dicha certificación bancaria deberá adjuntar fotocopia autenticada, en anverso y reverso, de las acciones depositadas. Los accionistas recibirán en cambio un boleto de entrada en el cual constará el número de votos a que tienen derecho.-

TITULO IX.- BALANCE, RESERVA Y DISTRIBUCION DE UTILIDADES.-
ARTICULO 25º: EJERCICIO SOCIAL PREPARACION Y PUBLICIDAD DE ESTADOS CONTABLES.- El ejercicio comienza el 1 de enero y termina el 31 de diciembre de cada año. Cerrando el ejercicio anual, se confeccionará el Inventario, el Balance General y la Cuenta de Ganancias y Pérdidas, conforme a las normas técnicas de la materia, que juntamente con la Memoria del Presidente e Informe del Síndico, deberán ser puestos a disposición de los accionistas en el domicilio social, por lo menos quince (15) días antes de la fecha de la Asamblea.-
ARTICULO 26º: DISTRIBUCION DE UTILIDADES.- Las utilidades líquidas de cada ejercicio, serán distribuidas de la siguiente forma: a) Cinco por ciento (5%) al fondo de reserva legal, hasta alcanzar el veinte por ciento (20%) del capital social suscripto; b) Hasta el diez por ciento (10%) podrá destinarse a gratificaciones o remuneraciones especiales a los empleados y funcionarios de la Sociedad; c) El remanente se distribuirá entre los accionistas en concepto de dividendos, si la Asamblea no resolviese destinar una parte o la totalidad, para crear otras reservas ordinarias o extraordinarias.-
ARTICULO 27º: PAGO DE LOS DIVIDENDOS.- Los dividendos serán abonados en el plazo, forma y condiciones que resuelva la Asamblea o en su caso, conforme lo disponga el Directorio.-

TITULO X.- DE LA LIQUIDACION.-
ARTICULO 28º: FORMALIDADES Y EFECTOS DE LA DISOLUCION.- En caso de disolución de la Sociedad por haber ocurrido uno de los supuestos previstos en el Código Civil, por resolución de la Asamblea Extraordinaria u otra causa, se procederá a su liquidación por el Directorio bajo la vigilancia del Síndico, procediéndose conforme lo resolviere la Asamblea y las disposiciones del Código Civil.-

TITULO XI.- DISPOSICIONES ESPECIALES Y TRANSITORIAS.-
ARTICULO 29º: CAPITAL SOCIAL EMITIDO E INTEGRADO.- Quedan emitidas la totalidad de las Acciones del Capital Social, de la siguiente forma:
${lineasSuscripcion.join('\n')}
totalizando el cien por ciento (100%) del capital emitido y suscripto en este acto de constitución.-
ARTICULO 30º: Queda designado el Primer Directorio de la Sociedad como sigue:
${directoresTransitorios.join('\n')}
ARTICULO 31º: La Escribana autorizante queda autorizada para gestionar la aprobación e inscripción del presente Estatuto y a realizar las gestiones pertinentes para la habilitación de la Sociedad, inclusive con facultad para aceptar las modificaciones exigidas por las autoridades competentes, siempre que no importe mayor responsabilidad a los socios, firmando los instrumentos necesarios al efecto, solicitar inscripciones, etc.-

Bajo tales cláusulas dan por celebrado el presente contrato de Sociedad Anónima, a cuyo fiel cumplimiento se obligan las partes conforme a derecho.-
Leída que fue por el autorizante, se ratifican y firman los comparecientes, por ante mí, de todo lo cual y de haber recibido personalmente sus declaraciones de voluntad, doy fe.- FIRMADOS: ${firmasSocios}.- ANTE MI: _______.- SIGUE EN LA HOJA DE SEGURIDAD ACTUACION NOTARIAL DE LA SERIE _______ Nº: _______ CON...///`;
}

// Modelos y Plantillas Notariales Oficiales
export interface PlantillaNotarial {
  id: string;
  nombre: string;
  categoriaSugerida: string;
  descripcion: string;
  contenido: string;
}

export const PLANTILLAS_NOTARIALES: PlantillaNotarial[] = [
  {
    id: 'hoja_en_blanco',
    nombre: 'Hoja en Blanco',
    categoriaSugerida: 'Sin Categoría',
    descripcion: 'Modo de redacción completamente libre y vacía.',
    contenido: ''
  },
  {
    id: 'constitucion_sa',
    nombre: 'Constitución de S.A.',
    categoriaSugerida: 'Contratos Privados',
    descripcion: 'Estatutos y formalización de Sociedad Anónima (C.C. Paraguayo).',
    contenido: construirConstitucionSA(2)
  },
  {
    id: 'contrato_compraventa',
    nombre: 'Contrato Privado de Compraventa',
    categoriaSugerida: 'Compraventa',
    descripcion: 'Contrato privado de compraventa de bienes y derechos con cláusulas de mora y pactos de reserva.',
    contenido: `CONTRATO PRIVADO DE COMPRAVENTA

Conste por el presente instrumento privado celebrado entre las partes:
Por una parte, don/doña ____________________, de nacionalidad paraguaya, mayor de edad, estado civil __________, con Cédula de Identidad Civil Nº ____________, domiciliado/a en ____________________, en adelante denominado/a EL VENDEDOR; y
Por la otra parte, don/doña ____________________, de nacionalidad paraguaya, mayor de edad, estado civil __________, con Cédula de Identidad Civil Nº ____________, domiciliado/a en ____________________, en adelante denominado/a EL COMPRADOR;

Ambas partes, reconociéndose mutua y suficiente capacidad legal para contratar y obligarse, convienen en celebrar el presente Contrato Privado de Compraventa, el cual se regirá por las siguientes cláusulas y condiciones:

PRIMERA: OBJETO.- EL VENDEDOR declara ser legítimo propietario, libre de todo gravamen, medida cautelar, inhibición o restricción de dominio, del siguiente bien:
____________________________________________________________________________________________________________________.
Por el presente acto, EL VENDEDOR vende, cede y transfiere a favor de EL COMPRADOR todos los derechos de propiedad y posesión sobre el bien individualizado.

SEGUNDA: PRECIO Y FORMA DE PAGO.- El precio justo, real y convenido por la presente compraventa es de GUARANÍES ____________________ (Gs. ____________), suma que EL COMPRADOR abona a EL VENDEDOR de la siguiente manera:
____________________________________________________________________________________________________________________.
EL VENDEDOR declara recibir la suma acordada a su entera satisfacción, sirviendo el presente de suficiente recibo y formal carta de pago.

TERCERA: ENTREGA Y ESTADO DEL BIEN.- En este mismo acto, EL VENDEDOR hace entrega formal y material del bien a EL COMPRADOR, quien declara recibirlo en el estado de conservación en que se encuentra, manifestando su plena conformidad.

CUARTA: EVICCIÓN Y SANEAMIENTO.- EL VENDEDOR se obliga por la evicción y el saneamiento de ley conforme a lo preceptuado en el Código Civil Paraguayo.

QUINTA: JURISDICCIÓN Y COMPETENCIA.- Para todos los efectos legales emergentes del presente contrato, las partes se someten a la jurisdicción y competencia de los Juzgados de Primera Instancia en lo Civil y Comercial de la ciudad de Asunción, República del Paraguay, renunciando expresamente a cualquier otro fuero o jurisdicción que pudiera corresponderles.

En prueba de conformidad y previa lectura, firman dos (2) ejemplares de un mismo tenor y a un solo efecto, en la ciudad de Asunción, a los _____ días del mes de ____________ del año 2026.


____________________________________                  ____________________________________
            EL VENDEDOR                                           EL COMPRADOR`
  },
  {
    id: 'escritura_transferencia',
    nombre: 'Escritura de Transferencia',
    categoriaSugerida: 'Traspasos',
    descripcion: 'Escritura pública notarial protocolizada de transferencia de dominio.',
    contenido: `ESCRITURA NÚMERO ______.- TRANSFERENCIA DE DOMINIO POR ESCRITURA PÚBLICA.-

En la ciudad de Asunción, Capital de la República del Paraguay, a los _____ días del mes de ____________ del año dos mil veintiséis, ante mí, Notario y Escribano Público Titular del Registro Notarial Nº ______, comparecen:
Por una parte, como PARTE TRANSMITENTE: Don/Doña ____________________, de nacionalidad paraguaya, mayor de edad, estado civil __________, titular de la C.I. Nº ____________, domiciliado/a en ____________________; y
Por la otra parte, como PARTE ADQUIRENTE: Don/Doña ____________________, de nacionalidad paraguaya, mayor de edad, estado civil __________, titular de la C.I. Nº ____________, domiciliado/a en ____________________;
personas civilmente capaces a quienes doy fe de conocer por haberme exhibido sus respectivos documentos de identidad, y dicen:

PRIMERA: ANTECEDENTES Y DOMINIO.- La PARTE TRANSMITENTE declara ser legítima propietaria del bien individualizado con Finca / Matrícula Nº __________, Padrón Nº __________, ubicado en el Distrito de ____________________. Dicho bien fue adquirido conforme a la Escritura Pública Nº ______ de fecha ____________, autorizada por el Notario Público ____________________, debidamente inscripta en la Dirección General de los Registros Públicos bajo el Nº ______ al Folio ______ del año ______.

SEGUNDA: TRANSFERENCIA DE DOMINIO.- En virtud del presente acto, la PARTE TRANSMITENTE VENDE Y TRANSFIERE a favor de la PARTE ADQUIRENTE el dominio, posesión y todos los derechos que le competen sobre el bien descrito, libre de todo gravamen e inhibición.

TERCERA: PRECIO DE VENTA.- La presente transferencia se efectúa por el precio total y convenido de GUARANÍES ____________________ (Gs. ____________), que la PARTE TRANSMITENTE declara haber recibido íntegramente en dinero en efectivo antes de este acto, otorgando por este instrumento formal y cancelatorio recibo de pago.

CUARTA: CERTIFICADOS REGISTRALES.- El Notario autorizante deja expresa constancia de haber tenido a la vista el Certificado de Condiciones de Dominio y el Certificado de Anotaciones Personales expedidos por la Dirección General de los Registros Públicos, de los cuales resulta que sobre el bien no pesan gravámenes ni restricciones de dominio, y que la parte transmitente goza de plena libre disposición de sus bienes.

Previa lectura que de todo su contenido les di en alta voz, se ratifican en su tenor y la firman de conformidad ante mí, Notario autorizante que doy fe.`
  },
  {
    id: 'transferencia_automotores',
    nombre: 'Transferencia de Automotores',
    categoriaSugerida: 'Traspasos',
    descripcion: 'Contrato notarial de compraventa y transferencia vehicular con asunción de responsabilidad civil.',
    contenido: `CONTRATO PRIVADO DE COMPRAVENTA Y TRANSFERENCIA DE VEHÍCULO AUTOMOTOR

Entre los suscritos:
Por una parte, don/doña ____________________, de nacionalidad paraguaya, mayor de edad, estado civil __________, titular de la Cédula de Identidad Civil Nº ____________, con domicilio en ____________________, en adelante denominado/a LA PARTE VENDEDORA; y
Por la otra parte, don/doña ____________________, de nacionalidad paraguaya, mayor de edad, estado civil __________, titular de la Cédula de Identidad Civil Nº ____________, con domicilio en ____________________, en adelante denominado/a LA PARTE COMPRADORA;

Ambas partes convienen en formalizar el presente Contrato Privado de Compraventa de Vehículo Automotor bajo los siguientes términos:

PRIMERA: INDIVIDUALIZACIÓN DEL VEHÍCULO.- LA PARTE VENDEDORA declara ser legítima y exclusiva titular del siguiente rodado:
- MARCA: ____________________
- MODELO: ____________________
- AÑO DE FABRICACIÓN: ________
- COLOR: ____________________
- TIPO: ____________________
- NÚMERO DE CHASIS: ________________________
- NÚMERO DE MOTOR: _________________________
- MATRÍCULA / CHAPA Nº: ____________
- CÉDULA DEL AUTOMOTOR Nº: ____________

SEGUNDA: PRECIO Y CANCELACIÓN.- El precio acordado para la compraventa es de GUARANÍES ____________________ (Gs. ____________), abonado íntegramente por LA PARTE COMPRADORA al contado en este acto, otorgando LA PARTE VENDEDORA el más formal y definitivo recibo de pago.

TERCERA: ENTREGA Y RESPONSABILIDAD.- LA PARTE VENDEDORA hace entrega en este acto del rodado en perfecto estado de funcionamiento, junto con sus llaves y documentación pertinente. LA PARTE COMPRADORA asume toda responsabilidad civil, penal, contravencional y tributaria derivada del uso, tenencia y circulación del automotor a partir de la fecha y hora de la firma del presente contrato.

CUARTA: OBLIGACIÓN DE FORMALIZACIÓN NOTARIAL.- Las partes se comprometen a concurrir a la Escribanía Pública designada para la suscripción de la Escritura Pública definitiva de Transferencia de Dominio dentro del plazo de ______ días.

En prueba de conformidad, se suscriben dos (2) ejemplares de idéntico tenor en la ciudad de Asunción, República del Paraguay, a los _____ días del mes de ____________ de 2026.


____________________________________                  ____________________________________
         PARTE VENDEDORA                                       PARTE COMPRADORA`
  },
  {
    id: 'poder_especial',
    nombre: 'Poder Especial',
    categoriaSugerida: 'Contratos Privados',
    descripcion: 'Poder especial amplio y suficiente para trámites judiciales, bancarios y administrativos.',
    contenido: `ESCRITURA NÚMERO ______.- PODER ESPECIAL AMPLIO Y SUFICIENTE.-

En la ciudad de Asunción, Capital de la República del Paraguay, a los _____ días del mes de ____________ del año dos mil veintiséis, ante mí, Notario y Escribano Público Titular del Registro Notarial Nº ______, comparece:
Don/Doña ____________________, de nacionalidad paraguaya, mayor de edad, estado civil __________, titular de la Cédula de Identidad Civil Nº ____________, con domicilio legal en ____________________; persona hábil y con capacidad civil necesaria para este acto, a quien doy fe de conocer, y expresa:

Que por el presente instrumento formal confiere PODER ESPECIAL amplio y suficiente a favor de Don/Doña ____________________, titular de la Cédula de Identidad Civil Nº ____________, domiciliado/a en ____________________, para que en su nombre y representación ejercite las siguientes facultades:

PRIMERO: ÁMBITO JUDICIAL: Para que intervenga en todos los juicios, litigios y trámites judiciales en que el/la poderdante tenga interés, sea en calidad de actor/a, demandado/a o tercerista, ante todos los Juzgados, Tribunales de Apelación y la Corte Suprema de Justicia de la República del Paraguay, con facultades de demandar, reconvenir, oponer excepciones, transigir, apelar y desistir.

SEGUNDO: ÁMBITO ADMINISTRATIVO Y PÚBLICO: Para gestionar, tramitar, formular peticiones y suscribir documentos ante la Dirección Nacional de Ingresos Tributarios (DNIT), Dirección General de los Registros Públicos (DGRP), Municipalidades de la República, Ministerios, Secretarías de Estado y demás entes públicos y descentralizados.

TERCERO: ÁMBITO BANCARIO Y PRIVADO: Para representarlo/a ante entidades bancarias, financieras y cooperativas, solicitar extractos, gestionar créditos y realizar depósitos o extracciones vinculadas a las facultades concedidas.

Leída que le fue la presente escritura, la ratifica en todas sus cláusulas y la firma de conformidad ante mí, Notario autorizante que doy fe.`
  },
  {
    id: 'transferencia_inmuebles',
    nombre: 'Transferencia de Inmuebles',
    categoriaSugerida: 'Compraventa',
    descripcion: 'Borrador de transferencia de inmueble con datos de finca, padrón y dimensiones perimétricas.',
    contenido: `CONTRATO PRIVADO DE COMPRAVENTA Y TRANSFERENCIA DE INMUEBLE

En la ciudad de Asunción, República del Paraguay, a los _____ días del mes de ____________ del año 2026, entre los suscritos:
Por una parte, don/doña ____________________, de nacionalidad paraguaya, mayor de edad, estado civil __________, titular de la C.I. Nº ____________, domiciliado/a en ____________________, en adelante denominado/a LA PARTE VENDEDORA; y
Por la otra parte, don/doña ____________________, de nacionalidad paraguaya, mayor de edad, estado civil __________, titular de la C.I. Nº ____________, domiciliado/a en ____________________, en adelante denominado/a LA PARTE COMPRADORA;

Convienen en celebrar el presente Contrato Privado de Transferencia Inmobiliaria bajo las siguientes cláusulas:

PRIMERA: INDIVIDUALIZACIÓN DEL INMUEBLE.- LA PARTE VENDEDORA declara ser legítima propietaria del bien inmueble individualizado con Finca / Matrícula Nº __________, Padrón Nº __________, Lote Nº ______, Manzana Nº ______, ubicado en el Distrito de ____________________, el cual consta de las siguientes dimensiones y linderos:
- Al Norte mide: ______ metros, lindando con: ____________________.
- Al Sur mide: ______ metros, lindando con: ____________________.
- Al Este mide: ______ metros, lindando con: ____________________.
- Al Oeste mide: ______ metros, lindando con: ____________________.
Superficie Total: ____________ metros cuadrados.

SEGUNDA: PRECIO Y CONDICIONES DE PAGO.- La presente transferencia se concierta por el precio total de GUARANÍES ____________________ (Gs. ____________), que LA PARTE COMPRADORA abona a LA PARTE VENDEDORA en dinero efectivo, otorgando ésta formal carta de pago por dicho monto.

TERCERA: CONDICIONES DE DOMINIO.- LA PARTE VENDEDORA garantiza bajo fe de juramento que el inmueble se encuentra libre de hipotecas, embargos, servidumbres o litigios, y que no pesa sobre su persona inhibición alguna para disponer libremente de sus bienes.

CUARTA: ESCRITURACIÓN PÚBLICA.- Las partes se comprometen a concurrir a la Escribanía Pública que designe LA PARTE COMPRADORA a fin de protocolizar la correspondiente Escritura Pública de Transferencia de Dominio.

En fe de lo acordado, se firman dos ejemplares de un mismo tenor y efecto legal.


____________________________________                  ____________________________________
         PARTE VENDEDORA                                       PARTE COMPRADORA`
  }
];

export interface AbogadoPerfilDatos {
  nombreAbogado: string;
  matriculaCsj: string;
  domicilioProcesal: string;
  telefonoAbogado: string;
  emailAbogado: string;
}

export interface PlantillaAbogadoMeta {
  id: string;
  nombre: string;
  categoriaSugerida: string;
  descripcion: string;
}

export const PLANTILLAS_ABOGADOS_META: PlantillaAbogadoMeta[] = [
  {
    id: 'abg_demanda_ejecutiva',
    nombre: 'Demanda Ejecutiva (Cobro de Pagaré / Título Ejecutivo)',
    categoriaSugerida: 'Demandas y Contestaciones',
    descripcion: 'Juicio ejecutivo paraguayo (Arts. 439, 443 y sgtes. CPC) para cobro de pagarés y títulos ejecutivos.',
  },
  {
    id: 'abg_contestacion_excepciones',
    nombre: 'Contestación de Demanda / Oposición de Excepciones',
    categoriaSugerida: 'Demandas y Contestaciones',
    descripcion: 'Contestación de traslado y oposición de excepciones procesales conforme al CPC Paraguay.',
  },
  {
    id: 'abg_impulso_procesal',
    nombre: 'Escrito de Impulso Procesal / Urgimiento',
    categoriaSugerida: 'Escritos de Impulso',
    descripcion: 'Solicitud de pronto despacho e impulso del trámite procesal en expediente judicial.',
  },
  {
    id: 'abg_reposicion_apelacion',
    nombre: 'Recurso de Reposición y Apelación en Subsidio',
    categoriaSugerida: 'Expedientes',
    descripcion: 'Impugnación de providencia o resolución judicial (Arts. 390, 394 y sgtes. CPC).',
  },
  {
    id: 'abg_carta_poder',
    nombre: 'Carta Poder / Poder Especial Judicial',
    categoriaSugerida: 'Contratos Privados',
    descripcion: 'Mandato especial judicial para representación procesal ante los Juzgados de la República.',
  },
  {
    id: 'abg_intimacion_pago',
    nombre: 'Intimación de Pago / Telegrama Colacionado',
    categoriaSugerida: 'Pagarés',
    descripcion: 'Requerimiento fehaciente de pago bajo apercibimiento de ejecución judicial.',
  },
  {
    id: 'abg_acuerdo_extrajudicial',
    nombre: 'Acuerdo Extrajudicial / Transacción',
    categoriaSugerida: 'Contratos Privados',
    descripcion: 'Convenio transaccional extrajudicial con solicitud de homologación judicial.',
  },
  {
    id: 'hoja_en_blanco',
    nombre: 'Hoja en Blanco',
    categoriaSugerida: 'Expedientes',
    descripcion: 'Modo de redacción libre en hoja judicial.',
  },
];

export interface PlayeroPerfilDatos {
  nombrePlaya: string;
  rucPlaya: string;
  direccionPlaya: string;
  telefonoPlaya: string;
  ciudadPlaya: string;
}

export const PLANTILLAS_PLAYERO_META: PlantillaAbogadoMeta[] = [
  {
    id: 'playero_compraventa_reserva',
    nombre: 'Contrato Privado de Compraventa de Vehículo (Reserva de Dominio)',
    categoriaSugerida: 'Compraventa',
    descripcion: 'Compraventa de automotor con entrega inicial, cuotas y pacto expreso de reserva de dominio (Art. 780 CCP).',
  },
  {
    id: 'playero_acta_entrega',
    nombre: 'Acta de Entrega de Posesión y Responsabilidad Civil/Penal',
    categoriaSugerida: 'Traspasos',
    descripcion: 'Constancia de entrega de rodado y asunción integral de responsabilidad civil, penal y de tránsito.',
  },
  {
    id: 'playero_recibo_sena',
    nombre: 'Recibo de Seña de Trato',
    categoriaSugerida: 'Contratos Privados',
    descripcion: 'Recibo formal de seña de trato con reserva temporal del vehículo y plazo para formalizar la compra.',
  },
  {
    id: 'playero_autorizacion_circulacion',
    nombre: 'Autorización de Circulación Provisoria',
    categoriaSugerida: 'Traspasos',
    descripcion: 'Autorización temporal para circular dentro de la República del Paraguay mientras se tramita la transferencia.',
  },
  {
    id: 'hoja_en_blanco',
    nombre: 'Hoja en Blanco',
    categoriaSugerida: 'Contratos Privados',
    descripcion: 'Modo de redacción libre con membrete comercial de la playa.',
  },
];

export interface SectorPublicoPerfilDatos {
  nombreInstitucion: string;
  rucInstitucion: string;
  direccionInstitucion: string;
  telefonoInstitucion: string;
  ciudadInstitucion: string;
}

export const PLANTILLAS_SECTOR_PUBLICO_BETA_META: PlantillaAbogadoMeta[] = [
  {
    id: 'uoc_pedido_licitacion',
    nombre: 'Pedido de Licitación / Llamado Mínimo Inicial',
    categoriaSugerida: 'Licitaciones',
    descripcion: 'Solicitud formal de inicio de proceso de contratación pública o llamado mínimo inicial ante la UOC.',
  },
  {
    id: 'uoc_adenda_tiempo',
    nombre: 'Solicitud de Adenda de Tiempo (Prórroga de Contrato)',
    categoriaSugerida: 'Adendas',
    descripcion: 'Justificación técnica y solicitud de prórroga de plazo contractual (Ley N.º 7021/2022).',
  },
  {
    id: 'uoc_adenda_monto',
    nombre: 'Solicitud de Adenda de Monto (Ampliación Presupuestaria)',
    categoriaSugerida: 'Adendas',
    descripcion: 'Solicitud de ampliación de monto adjudicado con respaldo presupuestario y CDP.',
  },
  {
    id: 'uoc_nota_remision',
    nombre: 'Nota de Remisión de Legajo / Memo Interno',
    categoriaSugerida: 'Notas y Memos',
    descripcion: 'Memorándum o nota oficial de remisión de legajo, expediente administrativo o antecedentes UOC.',
  },
  {
    id: 'hoja_en_blanco',
    nombre: 'Hoja en Blanco',
    categoriaSugerida: 'Notas y Memos',
    descripcion: 'Modo de redacción libre con membrete institucional oficial.',
  },
];

export interface CampoJudicialMeta {
  label: string;
  placeholder: string;
  help: string;
  multiline?: boolean;
}

export const CAMPOS_META: Record<string, CampoJudicialMeta> = {
  JUZGADO: {
    label: 'Juzgado / Tribunal',
    placeholder: 'Ej: Juzgado de Primera Instancia en lo Civil y Comercial del 1er Turno',
    help: 'Dejar en blanco o escribir \'A sortear\' si es demanda nueva',
  },
  CARATULA: {
    label: 'Carátula del Expediente',
    placeholder: 'Ej: Juan Pérez c/ Carlos Gómez s/ Acción Ejecutiva',
    help: 'Título completo del juicio o referencia de las partes',
  },
  NRO_EXPEDIENTE: {
    label: 'Número de Expediente',
    placeholder: 'Ej: 1245/2026',
    help: 'Dejar en blanco o escribir \'A sortear\' si aún no fue asignado',
  },
  CLIENTE: {
    label: 'Nombre o Razón Social del Cliente',
    placeholder: 'Ej: María Elena Benítez de López',
    help: 'Nombre completo o denominación de tu mandante / representado',
  },
  CI_RUC: {
    label: 'C.I. / RUC del Cliente',
    placeholder: 'Ej: 3.456.789',
    help: 'Cédula de Identidad Civil o RUC del cliente representado',
  },
  DOMICILIO_CLIENTE: {
    label: 'Domicilio Real del Cliente',
    placeholder: 'Ej: Avda. España 1240 c/ Brasil, Asunción',
    help: 'Dirección real declarada por tu cliente en el escrito',
  },
  NOMBRE_DEMANDADO: {
    label: 'Nombre del Demandado',
    placeholder: 'Ej: Roberto Carlos Villalba',
    help: 'Nombre completo tal como figura en el pagaré o C.I.',
  },
  CI_DEMANDADO: {
    label: 'C.I. / RUC del Demandado',
    placeholder: 'Ej: 4.123.456',
    help: 'Número de cédula o RUC del deudor demandado',
  },
  DOMICILIO_DEMANDADO: {
    label: 'Domicilio del Demandado',
    placeholder: 'Ej: Calle Palma 450 casi Alberdi, Asunción',
    help: 'Domicilio donde se diligenciará la intimación y el embargo',
  },
  MONTO_RECLAMADO: {
    label: 'Monto Reclamado (Gs.)',
    placeholder: 'Ej: 15.000.000',
    help: 'Capital en guaraníes; convierte automáticamente a letras',
  },
  MONTO_LETRAS: {
    label: 'Monto en Letras',
    placeholder: 'Ej: Quince millones',
    help: 'Se sugiere automáticamente al ingresar el monto (editable)',
  },
  FECHA_TITULO: {
    label: 'Fecha de Suscripción del Título',
    placeholder: 'Ej: 10 de enero de 2026',
    help: 'Fecha en que el deudor firmó el pagaré o título ejecutivo',
  },
  FECHA_VENCIMIENTO: {
    label: 'Fecha de Vencimiento del Pagaré',
    placeholder: 'Ej: 10 de mayo de 2026',
    help: 'Fecha en que venció el pagaré para calcular la mora',
  },
  EXPOSICION_HECHOS_DEFENSA: {
    label: 'Exposición de Hechos y Defensas',
    placeholder: 'Ej: la obligación fue cancelada parcialmente según recibo N.º 0045',
    help: 'Resume los hechos concretos que fundamentan la contestación o excepción',
    multiline: true,
  },
  FECHA_ULTIMA_ACTUACION: {
    label: 'Fecha de Última Actuación',
    placeholder: 'Ej: 14 de agosto de 2026',
    help: 'Fecha del último escrito o diligencia pendiente de proveimiento',
  },
  FECHA_NOTIFICACION: {
    label: 'Fecha de Notificación',
    placeholder: 'Ej: 18 de octubre de 2026',
    help: 'Día en que se recibió la cédula o notificación electrónica',
  },
  FECHA_RESOLUCION: {
    label: 'Fecha de la Resolución Impugnada',
    placeholder: 'Ej: 15 de octubre de 2026',
    help: 'Fecha de la providencia o A.I. objeto del recurso',
  },
  SINTESIS_RESOLUCION_IMPUGNADA: {
    label: 'Síntesis de la Resolución Impugnada',
    placeholder: 'Ej: el rechazo liminar de la prueba documental ofrecida',
    help: 'Describe brevemente lo dispuesto por el Juzgado que se recurre',
    multiline: true,
  },
  FUNDAMENTO_DEL_AGRAVIO: {
    label: 'Fundamento del Agravio',
    placeholder: 'Ej: vulnera el derecho a la defensa al omitir constancias de fs. 45',
    help: 'Explica el error de hecho o derecho que justifica la revocatoria',
    multiline: true,
  },
  NOMBRE_DEUDOR: {
    label: 'Nombre del Deudor Intimado',
    placeholder: 'Ej: Marcos Antonio Duarte',
    help: 'Nombre completo de la persona o empresa a quien se intima',
  },
  CI_DEUDOR: {
    label: 'C.I. / RUC del Deudor',
    placeholder: 'Ej: 3.987.654',
    help: 'Documento de identidad o RUC del destinatario',
  },
  DOMICILIO_DEUDOR: {
    label: 'Domicilio del Deudor',
    placeholder: 'Ej: Ruta Mcal. Estigarribia Km 9, San Lorenzo',
    help: 'Dirección para entrega del telegrama colacionado o intimación',
  },
  PLAZO_HORAS_DIAS: {
    label: 'Plazo Otorgado',
    placeholder: 'Ej: 48 horas',
    help: 'Término perentorio concedido para regularizar el pago (ej. 48 horas o 5 días)',
  },
  CONCEPTO_DEUDA: {
    label: 'Concepto de la Deuda',
    placeholder: 'Ej: pagaré vencido N.º 01/03 suscripto el 15/02/2026',
    help: 'Detalle del título, factura o contrato que origina el crédito',
  },
  NOMBRE_CONTRAPARTE: {
    label: 'Nombre de la Contraparte',
    placeholder: 'Ej: Silvia Raquel Méndez',
    help: 'Nombre completo de la contraparte co-suscriptora del acuerdo',
  },
  CI_CONTRAPARTE: {
    label: 'C.I. / RUC de la Contraparte',
    placeholder: 'Ej: 2.654.321',
    help: 'Cédula de Identidad Civil o RUC de la otra parte firmante',
  },
  DOMICILIO_CONTRAPARTE: {
    label: 'Domicilio de la Contraparte',
    placeholder: 'Ej: Avda. Aviadores del Chaco 2050, Asunción',
    help: 'Domicilio real o especial constituido por la contraparte',
  },
  CONDICIONES_DE_PAGO: {
    label: 'Condiciones y Forma de Pago',
    placeholder: 'Ej: 6 cuotas mensuales de Gs. 2.500.000 desde el 05/11/2026',
    help: 'Detalla cuotas, fechas de vencimiento y medio de pago pactado',
    multiline: true,
  },
  CLAUSULA_COSTAS: {
    label: 'Cláusula de Costas y Honorarios',
    placeholder: 'Ej: por su orden, asumiendo cada parte los honorarios de su patrocinante',
    help: 'Indica quién soporta las costas judiciales y honorarios del acuerdo',
  },
  NOMBRE_DEL_ABOGADO: {
    label: 'Nombre del Abogado',
    placeholder: 'Ej: Abg. Sofía Martínez',
    help: 'Completa si aún no cargaste tu nombre titular en Configuración',
  },
  MATRICULA_CSJ: {
    label: 'Matrícula CSJ',
    placeholder: 'Ej: 45.120',
    help: 'Número de matrícula otorgada por la Corte Suprema de Justicia',
  },
  DOMICILIO_PROCESAL: {
    label: 'Domicilio Procesal',
    placeholder: 'Ej: Edificio Ayfra, Piso 8, Asunción',
    help: 'Dirección dentro del radio del Juzgado para notificaciones',
  },
  TELEFONO_ABOGADO: {
    label: 'Teléfono del Estudio',
    placeholder: 'Ej: 0981 555 123',
    help: 'Número de contacto profesional para el encabezado y firma',
  },
  EMAIL_ABOGADO: {
    label: 'Correo Electrónico',
    placeholder: 'Ej: estudio@martinezabogados.com.py',
    help: 'Email profesional del estudio jurídico',
  },
  // Campos exclusivos de Playas de Vehículos
  NOMBRE_VENDEDOR_PLAYA: {
    label: 'Nombre de la Playa / Vendedor',
    placeholder: 'Ej: Automotores del Este S.A.',
    help: 'Razón social o nombre comercial de la playa vendedora (se guarda en Configuración)',
  },
  RUC_PLAYA: {
    label: 'RUC / C.I. del Vendedor',
    placeholder: 'Ej: 80045123-4',
    help: 'Número de RUC o Cédula de Identidad de la playa o vendedor',
  },
  DOMICILIO_PLAYA: {
    label: 'Dirección de la Playa',
    placeholder: 'Ej: Avda. Eusebio Ayala Km 4.5, Asunción',
    help: 'Domicilio comercial donde se celebra el acto',
  },
  TELEFONO_PLAYA: {
    label: 'Teléfono / WhatsApp de la Playa',
    placeholder: 'Ej: 0981 450 320',
    help: 'Número de contacto comercial de la playa',
  },
  CIUDAD: {
    label: 'Ciudad',
    placeholder: 'Ej: Asunción',
    help: 'Ciudad donde se firma el documento',
  },
  COMPRADOR: {
    label: 'Nombre del Comprador / Adquirente',
    placeholder: 'Ej: Carlos Alberto Giménez Paredes',
    help: 'Nombre y apellido completo según Cédula de Identidad o Razón Social',
  },
  CI_COMPRADOR: {
    label: 'C.I. / RUC del Comprador',
    placeholder: 'Ej: 4.567.890',
    help: 'Número de Cédula de Identidad Civil o RUC del comprador',
  },
  DOMICILIO_COMPRADOR: {
    label: 'Domicilio del Comprador',
    placeholder: 'Ej: Calle Boquerón 342, San Lorenzo',
    help: 'Dirección particular declarada por el comprador',
  },
  TELEFONO_COMPRADOR: {
    label: 'Teléfono / WhatsApp del Comprador',
    placeholder: 'Ej: 0982 334 556',
    help: 'Número de contacto del comprador',
  },
  MARCA_MODELO: {
    label: 'Marca y Modelo del Vehículo',
    placeholder: 'Ej: Toyota Hilux SRV 4x4',
    help: 'Marca, modelo y versión del automotor objeto del documento',
  },
  ANO: {
    label: 'Año de Fabricación / Modelo',
    placeholder: 'Ej: 2022',
    help: 'Año del vehículo según título o cédula verde',
  },
  COLOR: {
    label: 'Color del Vehículo',
    placeholder: 'Ej: Blanco Perlado',
    help: 'Color principal que figura en la documentación del rodado',
  },
  CHASIS: {
    label: 'Número de Chasis (VIN)',
    placeholder: 'Ej: 8AJKA3CD601234567',
    help: 'Código alfanumérico de chasis completo del vehículo',
  },
  CHAPA: {
    label: 'Número de Chapa / Matrícula',
    placeholder: 'Ej: AABC 123 (o En Trámite)',
    help: 'Chapa actual o indicar "En trámite" si es recién importado',
  },
  PRECIO_TOTAL: {
    label: 'Precio Total del Vehículo (Gs.)',
    placeholder: 'Ej: 120.000.000',
    help: 'Precio total pactado en guaraníes; convierte automáticamente a letras',
  },
  PRECIO_LETRAS: {
    label: 'Precio Total en Letras',
    placeholder: 'Ej: Ciento veinte millones',
    help: 'Se sugiere automáticamente al ingresar el precio total (editable)',
  },
  ENTREGA: {
    label: 'Entrega Inicial (Gs.)',
    placeholder: 'Ej: 40.000.000',
    help: 'Monto abonado al contado en concepto de entrega inicial',
  },
  CANTIDAD_CUOTAS: {
    label: 'Cantidad de Cuotas',
    placeholder: 'Ej: 24',
    help: 'Número total de cuotas mensuales pactadas por el saldo',
  },
  MONTO_CUOTA: {
    label: 'Monto por Cuota (Gs.)',
    placeholder: 'Ej: 3.500.000',
    help: 'Importe de cada cuota mensual',
  },
  FECHA_PRIMERA_CUOTA: {
    label: 'Vencimiento de la 1.ª Cuota',
    placeholder: 'Ej: 10 de diciembre de 2026',
    help: 'Fecha de vencimiento de la primera cuota mensual',
  },
  RESPONSABLE_GASTOS_ESCRITURA: {
    label: 'Responsable de Gastos de Transferencia',
    placeholder: 'Ej: la PARTE COMPRADORA en su totalidad',
    help: 'Indica quién abona los gastos notariales y registrales de escritura pública',
  },
  HORA_ENTREGA: {
    label: 'Hora Exacta de Entrega',
    placeholder: 'Ej: 15:30 horas',
    help: 'Hora precisa desde la cual el adquirente asume toda responsabilidad',
  },
  KILOMETRAJE: {
    label: 'Kilometraje Actual',
    placeholder: 'Ej: 68.400 km',
    help: 'Lectura del odómetro al momento de la entrega',
  },
  ESTADO_ACCESORIOS: {
    label: 'Accesorios y Documentación Entregada',
    placeholder: 'Ej: 2 llaves, auxilio, gato, triángulo y copia de cédula verde',
    help: 'Detalle de llaves, herramientas y documentos entregados con el vehículo',
    multiline: true,
  },
  MONTO_SENA: {
    label: 'Monto de la Seña de Trato (Gs.)',
    placeholder: 'Ej: 5.000.000',
    help: 'Importe recibido como seña de trato en guaraníes',
  },
  MONTO_SENA_LETRAS: {
    label: 'Monto de la Seña en Letras',
    placeholder: 'Ej: Cinco millones',
    help: 'Se sugiere automáticamente al ingresar el monto de la seña (editable)',
  },
  PLAZO_VALIDEZ_SENA: {
    label: 'Plazo de Validez de la Seña',
    placeholder: 'Ej: 5 días hábiles (hasta el 30 de noviembre de 2026)',
    help: 'Término máximo para completar la entrega inicial o firmar el contrato definitivo',
  },
  CONDUCTOR_AUTORIZADO: {
    label: 'Nombre del Conductor Autorizado',
    placeholder: 'Ej: Diego Armando Benítez',
    help: 'Persona habilitada para circular provisoriamente con el vehículo',
  },
  CI_CONDUCTOR: {
    label: 'C.I. del Conductor Autorizado',
    placeholder: 'Ej: 5.112.334',
    help: 'Cédula de Identidad Civil del conductor autorizado',
  },
  DOMICILIO_CONDUCTOR: {
    label: 'Domicilio del Conductor',
    placeholder: 'Ej: Avda. Mariscal López 1890, Fernando de la Mora',
    help: 'Dirección declarada por el conductor autorizado',
  },
  FECHA_VENCIMIENTO_AUTORIZACION: {
    label: 'Vigencia de la Autorización Hasta',
    placeholder: 'Ej: 15 de diciembre de 2026',
    help: 'Fecha límite de validez de la autorización provisoria',
  },
  MOTIVO_AUTORIZACION: {
    label: 'Motivo de la Autorización Provisoria',
    placeholder: 'Ej: tramitación de transferencia definitiva ante Escribanía Pública',
    help: 'Razón por la cual se emite el permiso provisorio de circulación',
  },
  DEPENDENCIA_SOLICITANTE: {
    label: 'Dependencia / Dirección Solicitante',
    placeholder: 'Ej: Dirección de Transporte y Talleres',
    help: 'Área o dirección requirente dentro de la institución pública',
  },
  NRO_MEMO_NOTA: {
    label: 'N.º de Memo / Nota',
    placeholder: 'Ej: MEMO DGAF N.º 142/2026',
    help: 'Numeración oficial interna de la nota o memorándum',
  },
  DESTINATARIO: {
    label: 'Destinatario',
    placeholder: 'Ej: Lic. Carlos Giménez',
    help: 'Autoridad o responsable de la UOC / Dirección General de Administración',
  },
  CARGO_DESTINATARIO: {
    label: 'Cargo del Destinatario',
    placeholder: 'Ej: Director/a de la Unidad Operativa de Contrataciones (UOC)',
    help: 'Cargo oficial de la autoridad destinataria',
  },
  REMITENTE: {
    label: 'Responsable Remitente',
    placeholder: 'Ej: Ing. Laura Benítez',
    help: 'Nombre del funcionario o jefe que suscribe la solicitud',
  },
  CARGO_REMITENTE: {
    label: 'Cargo del Remitente',
    placeholder: 'Ej: Jefa de Departamento de Mantenimiento',
    help: 'Cargo institucional de quien firma la nota',
  },
  OBJETO_CONTRATACION: {
    label: 'Objeto de la Contratación / Rubro',
    placeholder: 'Ej: Servicio de Taller Mecánico y Provisión de Repuestos para Flota Vehicular',
    help: 'Descripción del bien o servicio requerido según PAC / DNCP',
  },
  TIPO_LLAMADO: {
    label: 'Modalidad / Tipo de Llamado',
    placeholder: 'Ej: Llamado Mínimo Inicial / Contratación Directa / Licitación Anual',
    help: 'Procedimiento de contratación conforme a la Ley N.º 7021/2022',
  },
  CODIGO_PAC: {
    label: 'Código PAC / ID DNCP de Referencia',
    placeholder: 'Ej: PAC 2026-018 / ID DNCP 451820',
    help: 'Código del Plan Anual de Contrataciones o ID asignado por la DNCP',
  },
  MONTO_ESTIMADO: {
    label: 'Monto Estimado / Referencial (Gs.)',
    placeholder: 'Ej: 85.000.000',
    help: 'Monto referencial total en guaraníes para el llamado',
  },
  PLAZO_EJECUCION: {
    label: 'Plazo de Ejecución Estimado',
    placeholder: 'Ej: 6 meses o hasta agotar saldo adjudicado',
    help: 'Duración estimada de vigencia del contrato',
  },
  PROVEEDOR: {
    label: 'Proveedor / Empresa Adjudicada',
    placeholder: 'Ej: Kilcopar S.A.',
    help: 'Razón social del proveedor contratado',
  },
  RUC_PROVEEDOR: {
    label: 'RUC del Proveedor',
    placeholder: 'Ej: 80012345-6',
    help: 'Registro Único de Contribuyentes del proveedor',
  },
  NRO_CONTRATO: {
    label: 'N.º de Contrato',
    placeholder: 'Ej: Contrato N.º 12/2026',
    help: 'Número oficial del contrato administrativo vigente',
  },
  ID_DNCP: {
    label: 'ID DNCP',
    placeholder: 'Ej: 451820',
    help: 'Identificador del llamado o contrato en el portal de la DNCP',
  },
  FECHA_VENCIMIENTO_ACTUAL: {
    label: 'Fecha de Vencimiento Actual',
    placeholder: 'Ej: 30 de junio de 2026',
    help: 'Fecha en que expira el plazo vigente del contrato',
  },
  PLAZO_PRORROGA: {
    label: 'Plazo de Prórroga Solicitado',
    placeholder: 'Ej: 90 días corridos (3 meses)',
    help: 'Extensión temporal requerida para concluir las prestaciones',
  },
  NUEVA_FECHA_VENCIMIENTO: {
    label: 'Nueva Fecha de Vencimiento Propuesta',
    placeholder: 'Ej: 28 de septiembre de 2026',
    help: 'Fecha proyectada de finalización tras aprobarse la adenda',
  },
  MONTO_CONTRATO_ORIGINAL: {
    label: 'Monto Original del Contrato (Gs.)',
    placeholder: 'Ej: 150.000.000',
    help: 'Importe adjudicado originalmente en guaraníes',
  },
  MONTO_AMPLIACION: {
    label: 'Monto de Ampliación Solicitado (Gs.)',
    placeholder: 'Ej: 30.000.000',
    help: 'Monto adicional en guaraníes (respetando el tope legal del 20% según Ley 7021/2022)',
  },
  MONTO_AMPLIACION_LETRAS: {
    label: 'Monto de Ampliación en Letras',
    placeholder: 'Ej: Treinta millones',
    help: 'Se sugiere automáticamente al ingresar el monto de ampliación',
  },
  PORCENTAJE_AMPLIACION: {
    label: 'Porcentaje de Ampliación (%)',
    placeholder: 'Ej: 20%',
    help: 'Porcentaje que representa la ampliación respecto al monto original',
  },
  MONTO_TOTAL_ACTUALIZADO: {
    label: 'Monto Total Actualizado (Gs.)',
    placeholder: 'Ej: 180.000.000',
    help: 'Suma del contrato original más la ampliación solicitada',
  },
  NRO_CDP: {
    label: 'N.º de CDP / Rubro Presupuestario',
    placeholder: 'Ej: CDP N.º 340/2026 — Objeto del Gasto 240',
    help: 'Certificado de Disponibilidad Presupuestaria y objeto del gasto',
  },
  JUSTIFICACION_TECNICA: {
    label: 'Justificación Técnica / Necesidad Institucional',
    placeholder: 'Ej: continuidad operativa de reparación de ambulancias y móviles institucionales mientras se sustancia el nuevo llamado anual',
    help: 'Fundamento técnico y operativo que motiva la solicitud o adenda',
    multiline: true,
  },
  DETALLE_LEGAJO: {
    label: 'Detalle de Documentos / Legajo Remitido',
    placeholder: 'Ej: 1) Copia de Contrato N.º 12/2026; 2) Facturas conformadas N.º 001-001-0004521; 3) Acta de recepción definitiva',
    help: 'Listado de documentos adjuntos que integran el legajo',
    multiline: true,
  },
  NRO_EXPEDIENTE_INTERNO: {
    label: 'N.º de Expediente / Mesa de Entrada',
    placeholder: 'Ej: EXP-ME N.º 2026-08914',
    help: 'Número de expediente administrativo o mesa de entrada institucional',
  },
};

export const getCampoMeta = (key: string): CampoJudicialMeta => {
  if (CAMPOS_META[key]) {
    return CAMPOS_META[key];
  }
  const readable = key
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  return {
    label: readable,
    placeholder: `Ej: Ingrese ${readable.toLowerCase()}`,
    help: `Completa este dato para reemplazar [${key}] en el escrito`,
  };
};

export function extraerMarcadoresJudiciales(html: string): string[] {
  if (!html) return [];
  const regex = /\[([A-Z0-9_]+)\]/g;
  const result: string[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const key = match[1].trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }
  const ordenarParMontoLetras = (montoKey: string, letrasKey: string) => {
    const idxLetras = result.indexOf(letrasKey);
    const idxMonto = result.indexOf(montoKey);
    if (idxLetras !== -1 && idxMonto !== -1 && idxLetras < idxMonto) {
      result.splice(idxMonto, 1);
      result.splice(idxLetras, 0, montoKey);
    }
  };
  ordenarParMontoLetras('MONTO_RECLAMADO', 'MONTO_LETRAS');
  ordenarParMontoLetras('PRECIO_TOTAL', 'PRECIO_LETRAS');
  ordenarParMontoLetras('MONTO_SENA', 'MONTO_SENA_LETRAS');
  ordenarParMontoLetras('MONTO_ESTIMADO', 'MONTO_LETRAS');
  ordenarParMontoLetras('MONTO_AMPLIACION', 'MONTO_AMPLIACION_LETRAS');
  return result;
}

export function construirPlantillaJudicial(
  plantillaId: string,
  abogado: AbogadoPerfilDatos
): string {
  const now = new Date();
  const dia = String(now.getDate());
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  const mes = meses[now.getMonth()];
  const anio = String(now.getFullYear());

  const esc = escapeHtmlText;
  const nombreAbg = esc(abogado.nombreAbogado);
  const matricula = esc(abogado.matriculaCsj);
  const domProc = esc(abogado.domicilioProcesal);
  const telAbg = esc(abogado.telefonoAbogado);
  const emailAbg = esc(abogado.emailAbogado);

  const bloqueFirmaAbogado =
    `<p><br></p>` +
    `<p style="text-align: right;"><strong>PROVEER DE CONFORMIDAD Y SERÁ JUSTICIA.</strong></p>` +
    `<p><br></p>` +
    `<p style="text-align: center;">____________________________________________</p>` +
    `<p style="text-align: center;"><strong>${nombreAbg}</strong></p>` +
    `<p style="text-align: center;">Abogado — Matrícula CSJ N.º ${matricula}</p>` +
    `<p style="text-align: center;">Dom. Procesal: ${domProc} | Tel.: ${telAbg} | ${emailAbg}</p>`;

  const bloqueComparecenciaProfesional = `<strong>${nombreAbg}</strong>, Abogado con Matrícula de la Excma. Corte Suprema de Justicia N.º <strong>${matricula}</strong>, constituyendo domicilio procesal en <strong>${domProc}</strong>, teléfono <strong>${telAbg}</strong> y correo electrónico <strong>${emailAbg}</strong>, en nombre y representación de <strong>[CLIENTE]</strong>, con C.I./RUC N.º <strong>[CI_RUC]</strong> y domicilio real en <strong>[DOMICILIO_CLIENTE]</strong>, conforme lo acredito con el testimonio de poder / carta poder que adjunto`;

  switch (plantillaId) {
    case 'abg_demanda_ejecutiva':
      return (
        `<p style="text-align: right;"><strong>OBJETO: PROMOVER JUICIO EJECUTIVO DE COBRO DE GUARANÍES.</strong></p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>SEÑOR JUEZ:</strong></p>` +
        `<p style="text-align: left;"><em>(Juzgado: [JUZGADO] — Autos: "[CARATULA]" - Exp. N.° [NRO_EXPEDIENTE])</em></p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>I. PERSONERÍA</strong></p>` +
        `<p>${bloqueComparecenciaProfesional}, a V.S. respetuosamente me presento y digo:</p>` +
        `<p>Que vengo por el presente escrito a promover formal <strong>DEMANDA EJECUTIVA</strong> contra [NOMBRE_DEMANDADO], con C.I./RUC N.º [CI_DEMANDADO] y domicilio en [DOMICILIO_DEMANDADO], por el cobro de la suma de GUARANÍES [MONTO_LETRAS] (Gs. [MONTO_RECLAMADO]), más intereses pactados y moratorios, gastos y costas del juicio.</p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>II. HECHOS</strong></p>` +
        `<p>1. En fecha [FECHA_TITULO], la parte demandada suscribió a favor de mi mandante <strong>[CLIENTE]</strong> un pagaré a la orden / título ejecutivo por la suma total de Gs. [MONTO_RECLAMADO], con vencimiento el día [FECHA_VENCIMIENTO].</p>` +
        `<p>2. Llegado el vencimiento de la obligación, y pese a los reiterados requerimientos extrajudiciales efectuados, el deudor no ha dado cumplimiento al pago, encontrándose en mora de pleno derecho conforme a lo pactado.</p>` +
        `<p>3. En consecuencia, queda expedita la vía ejecutiva para el cobro compulsivo del crédito líquido y exigible instrumentado en el título original que se acompaña.</p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>III. DERECHO</strong></p>` +
        `<p>Fundo la presente acción en las disposiciones de los artículos 439, 443 inc. f), 448, 450, 452 y concordantes del Código Procesal Civil de la República del Paraguay, así como en los artículos pertinentes del Código Civil Paraguayo respecto a la mora y efectos de los títulos de crédito.</p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>IV. PETITORIO</strong></p>` +
        `<p>Por todo lo expuesto, a V.S. solicito:</p>` +
        `<p>1. Tenerme por presentado en el carácter invocado, por reconocida mi personería y por constituido el domicilio procesal en el lugar indicado.</p>` +
        `<p>2. Tener por promovida la presente Demanda Ejecutiva por cobro de Gs. [MONTO_RECLAMADO], más accesorios legales, disponiendo el desglose del título original y su guarda en la caja de seguridad del Juzgado previa agregación de copia autenticada.</p>` +
        `<p>3. Librar mandamiento de intimación de pago y embargo ejecutivo sobre bienes suficientes del deudor hasta cubrir el capital reclamado más la suma presupuestada provisoriamente por el Juzgado para gastos de justicia.</p>` +
        `<p>4. Oportunamente, previo traslado y citación de remate, dictar Sentencia Definitiva mandando llevar adelante la ejecución hasta hacer íntegro pago a mi mandante del capital, intereses y costas.</p>` +
        bloqueFirmaAbogado
      );

    case 'abg_contestacion_excepciones':
      return (
        `<p style="text-align: right;"><strong>OBJETO: CONTESTAR DEMANDA Y OPONER EXCEPCIONES.</strong></p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>SEÑOR JUEZ:</strong></p>` +
        `<p style="text-align: left;"><em>(Juzgado: [JUZGADO] — Autos: "[CARATULA]" - Exp. N.° [NRO_EXPEDIENTE])</em></p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>I. PERSONERÍA</strong></p>` +
        `<p>${bloqueComparecenciaProfesional}, en los autos caratulados <strong>"[CARATULA]"</strong>, Expediente N.º <strong>[NRO_EXPEDIENTE]</strong>, a V.S. respetuosamente digo:</p>` +
        `<p>Que vengo en tiempo y forma a contestar el traslado de la demanda promovida contra mi mandante y, en su caso, a oponer las excepciones procesales y defensas de fondo que hacen a su legítimo derecho.</p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>II. HECHOS</strong></p>` +
        `<p>1. Niego categóricamente todos y cada uno de los hechos invocados por la parte actora en su escrito inicial que no sean objeto de expreso reconocimiento en la presente contestación.</p>` +
        `<p>2. La pretensión deducida resulta improcedente en razón de que [EXPOSICION_HECHOS_DEFENSA].</p>` +
        `<p>3. Asimismo, se acompaña la prueba documental pertinente que acredita los extremos fácticos alegados por esta parte, reservándose el derecho de ofrecer los demás medios probatorios en la etapa procesal oportuna.</p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>III. DERECHO</strong></p>` +
        `<p>Fundo esta presentación en el artículo 16 de la Constitución Nacional (defensa en juicio), y en los artículos 224, 235, 462, 464 y concordantes del Código Procesal Civil de la República del Paraguay, doctrina y jurisprudencia aplicables al caso.</p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>IV. PETITORIO</strong></p>` +
        `<p>Por tanto, a V.S. solicito:</p>` +
        `<p>1. Reconocer mi personería en el carácter invocado y tener por constituido mi domicilio procesal en el lugar denunciado.</p>` +
        `<p>2. Tener por contestada en tiempo y forma la demanda / citación de remate y por opuestas las excepciones articuladas, con las pruebas documentales agregadas.</p>` +
        `<p>3. Correr traslado a la parte actora por el término de ley.</p>` +
        `<p>4. Oportunamente, dictar resolución haciendo lugar a las excepciones planteadas y rechazando la demanda promovida, con expresa imposición de costas a la contraria.</p>` +
        bloqueFirmaAbogado
      );

    case 'abg_impulso_procesal':
      return (
        `<p style="text-align: right;"><strong>OBJETO: URGIR PRONTO DESPACHO E IMPULSO PROCESAL.</strong></p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>SEÑOR JUEZ:</strong></p>` +
        `<p style="text-align: left;"><em>(Juzgado: [JUZGADO] — Autos: "[CARATULA]" - Exp. N.° [NRO_EXPEDIENTE])</em></p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>I. PERSONERÍA</strong></p>` +
        `<p>${bloqueComparecenciaProfesional}, con intervención ya reconocida en los autos caratulados <strong>"[CARATULA]"</strong>, Expediente N.º <strong>[NRO_EXPEDIENTE]</strong>, que tramitan ante <strong>[JUZGADO]</strong>, a V.S. digo:</p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>II. HECHOS</strong></p>` +
        `<p>1. Que habiéndose cumplido el trámite procesal anterior en fecha [FECHA_ULTIMA_ACTUACION], los presentes autos se encuentran pendientes de providencia o resolución judicial respecto a la petición formulada por esta parte.</p>` +
        `<p>2. Que el transcurso del tiempo sin pronunciamiento genera un perjuicio directo a los derechos e intereses de mi representado/a <strong>[CLIENTE]</strong>, motivo por el cual corresponde instar el inmediato impulso del proceso.</p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>III. DERECHO</strong></p>` +
        `<p>Fundo el presente pedido en el principio de celeridad y economía procesal, el artículo 40 de la Constitución Nacional, y los artículos 15, 107, 162, 172 y concordantes del Código Procesal Civil de la República del Paraguay.</p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>IV. PETITORIO</strong></p>` +
        `<p>Por lo expuesto, a V.S. solicito:</p>` +
        `<p>1. Tener por reiterada la petición pendiente de despacho en estos autos.</p>` +
        `<p>2. Dictar sin más dilación la providencia / resolución correspondiente a fin de dar continuidad al trámite procesal del juicio.</p>` +
        bloqueFirmaAbogado
      );

    case 'abg_reposicion_apelacion':
      return (
        `<p style="text-align: right;"><strong>OBJETO: INTERPONER RECURSO DE REPOSICIÓN Y APELACIÓN EN SUBSIDIO.</strong></p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>SEÑOR JUEZ:</strong></p>` +
        `<p style="text-align: left;"><em>(Juzgado: [JUZGADO] — Autos: "[CARATULA]" - Exp. N.° [NRO_EXPEDIENTE])</em></p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>I. PERSONERÍA</strong></p>` +
        `<p>${bloqueComparecenciaProfesional}, en los autos caratulados <strong>"[CARATULA]"</strong>, Expediente N.º <strong>[NRO_EXPEDIENTE]</strong>, radicados ante <strong>[JUZGADO]</strong>, a V.S. respetuosamente digo:</p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>II. HECHOS</strong></p>` +
        `<p>1. Que en fecha [FECHA_NOTIFICACION], esta parte fue notificada de la providencia / resolución de fecha [FECHA_RESOLUCION] dictada por V.S., por la cual se dispuso [SINTESIS_RESOLUCION_IMPUGNADA].</p>` +
        `<p>2. Que dicha determinación causa gravamen irreparable a mi mandante <strong>[CLIENTE]</strong>, por cuanto [FUNDAMENTO_DEL_AGRAVIO], apartándose de las constancias obrantes en autos y de la normativa procesal aplicable.</p>` +
        `<p>3. En tiempo hábil y forma legal, vengo a interponer Recurso de Reposición contra la citada resolución, llevando implícito el Recurso de Apelación en Subsidio para el caso de que V.S. no haga lugar a la revocatoria solicitada.</p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>III. DERECHO</strong></p>` +
        `<p>Fundo este recurso en los artículos 390, 391, 392, 394, 395 y concordantes del Código Procesal Civil de la República del Paraguay.</p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>IV. PETITORIO</strong></p>` +
        `<p>Por todo lo expuesto, a V.S. solicito:</p>` +
        `<p>1. Tener por interpuesto en tiempo y forma el Recurso de Reposición con Apelación en Subsidio contra la providencia / resolución de fecha [FECHA_RESOLUCION].</p>` +
        `<p>2. Previo traslado de rigor si correspondiere, hacer lugar a la reposición deducida, revocando por contrario imperio la resolución recurrida y disponiendo lo que en derecho corresponda.</p>` +
        `<p>3. En el supuesto improbable de mantenerse la decisión impugnada, conceder el Recurso de Apelación en Subsidio por ante el Excmo. Tribunal de Apelación en lo Civil y Comercial, disponiendo la elevación de los autos.</p>` +
        bloqueFirmaAbogado
      );

    case 'abg_carta_poder':
      return (
        `<p style="text-align: right;"><strong>OBJETO: OTORGAR CARTA PODER / PODER ESPECIAL JUDICIAL.</strong></p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>SEÑOR JUEZ:</strong></p>` +
        `<p style="text-align: left;"><em>(Juzgado: [JUZGADO] — Autos: "[CARATULA]" - Exp. N.° [NRO_EXPEDIENTE])</em></p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>I. PERSONERÍA</strong></p>` +
        `<p>En la ciudad de Asunción, República del Paraguay, a los ${dia} días del mes de ${mes} del año ${anio}, quien suscribe, <strong>[CLIENTE]</strong>, de nacionalidad paraguaya, mayor de edad, titular de la Cédula de Identidad Civil / RUC N.º <strong>[CI_RUC]</strong>, con domicilio real en <strong>[DOMICILIO_CLIENTE]</strong>, comparece ante V.S. a efectos de otorgar formal <strong>CARTA PODER ESPECIAL JUDICIAL</strong> a favor de <strong>${nombreAbg}</strong>, Abogado con Matrícula CSJ N.º <strong>${matricula}</strong>, con domicilio procesal constituido en <strong>${domProc}</strong>, teléfono <strong>${telAbg}</strong> y correo electrónico <strong>${emailAbg}</strong>.</p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>II. HECHOS</strong></p>` +
        `<p>1. El presente mandato se confiere expresamente para que el profesional designado intervenga en nombre y representación del/de la otorgante en los autos caratulados <strong>"[CARATULA]"</strong>, Expediente N.º <strong>[NRO_EXPEDIENTE]</strong>, ante <strong>[JUZGADO]</strong> y demás instancias ordinarias y extraordinarias.</p>` +
        `<p>2. Queda el mandatario ampliamente facultado para presentar escritos, ofrecer y diligenciar pruebas, interponer recursos, asistir a audiencias, solicitar medidas cautelares, percibir importes judiciales previa autorización y realizar cuantos actos procesales resulten necesarios para la defensa de los derechos del mandante.</p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>III. DERECHO</strong></p>` +
        `<p>Se otorga la presente Carta Poder de conformidad con los artículos 61, 62, 63 y concordantes del Código Procesal Civil de la República del Paraguay, y las reglas del mandato establecidas en los artículos 880 y siguientes del Código Civil Paraguayo.</p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>IV. PETITORIO</strong></p>` +
        `<p>Por lo expuesto, a V.S. solicitamos:</p>` +
        `<p>1. Tener por otorgada y aceptada la presente Carta Poder Especial Judicial a favor de <strong>${nombreAbg}</strong>, Matrícula CSJ N.º <strong>${matricula}</strong>.</p>` +
        `<p>2. Reconocer la personería del profesional apoderado y tener por constituido el domicilio procesal indicado a todos los efectos legales.</p>` +
        `<p><br></p>` +
        `<p style="text-align: right;"><strong>PROVEER DE CONFORMIDAD Y SERÁ JUSTICIA.</strong></p>` +
        `<p><br></p>` +
        `<p style="text-align: center;">_______________________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; _______________________________</p>` +
        `<p style="text-align: center;"><strong>[CLIENTE]</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>${nombreAbg}</strong></p>` +
        `<p style="text-align: center;">C.I./RUC: [CI_RUC] &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Abogado — Mat. CSJ N.º ${matricula}</p>`
      );

    case 'abg_intimacion_pago':
      return (
        `<p style="text-align: right;"><strong>OBJETO: FORMULAR INTIMACIÓN DE PAGO BAJO APERCIBIMIENTO DE ACCIÓN JUDICIAL.</strong></p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>SEÑOR JUEZ / DESTINATARIO DE LA INTIMACIÓN:</strong></p>` +
        `<p style="text-align: left;"><em>(Juzgado: [JUZGADO] — Autos: "[CARATULA]" - Exp. N.° [NRO_EXPEDIENTE])</em></p>` +
        `<p style="text-align: left;"><em>Asunción, ${dia} de ${mes} de ${anio}.-</em></p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>I. PERSONERÍA</strong></p>` +
        `<p>${bloqueComparecenciaProfesional}, deja formal constancia del requerimiento fehaciente dirigido al Sr./Sra. [NOMBRE_DEUDOR], con C.I./RUC N.º [CI_DEUDOR] y domicilio en [DOMICILIO_DEUDOR], para su eventual agregación judicial ante V.S.</p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>II. HECHOS</strong></p>` +
        `<p>1. Por instrucciones expresas de mi cliente <strong>[CLIENTE]</strong> (C.I./RUC N.º <strong>[CI_RUC]</strong>), intimo formalmente a usted para que en el plazo perentorio e improrrogable de <strong>[PLAZO_HORAS_DIAS]</strong> a partir de la recepción de la presente comunicación, abone la suma adeudada de GUARANÍES [MONTO_LETRAS] (Gs. [MONTO_RECLAMADO]), correspondiente a [CONCEPTO_DEUDA].</p>` +
        `<p>2. El pago deberá efectuarse en el estudio jurídico sito en <strong>${domProc}</strong>, o mediante transferencia acreditada, coordinando al teléfono <strong>${telAbg}</strong> o correo <strong>${emailAbg}</strong>.</p>` +
        `<p>3. Vencido el plazo otorgado sin verificarse el pago íntegro, se promoverán sin más trámite las acciones judiciales ejecutivas o de cobro que correspondan, con imposición de intereses, gastos y costas a su exclusivo cargo.</p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>III. DERECHO</strong></p>` +
        `<p>Fundo el presente requerimiento en los artículos 424, 475, 715 y concordantes del Código Civil Paraguayo sobre constitución en mora y cumplimiento de las obligaciones, y en los artículos 439 y siguientes del Código Procesal Civil.</p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>IV. PETITORIO</strong></p>` +
        `<p>1. Tener por formulada la presente intimación fehaciente de pago a todos sus efectos legales y probatorios.</p>` +
        `<p>2. En caso de incumplimiento, solicitar oportunamente ante V.S. la agregación del comprobante de remisión como antecedente de la acción judicial pertinente.</p>` +
        bloqueFirmaAbogado
      );

    case 'abg_acuerdo_extrajudicial':
      return (
        `<p style="text-align: right;"><strong>OBJETO: PRESENTAR ACUERDO EXTRAJUDICIAL / TRANSACCIÓN Y SOLICITAR HOMOLOGACIÓN JUDICIAL.</strong></p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>SEÑOR JUEZ:</strong></p>` +
        `<p style="text-align: left;"><em>(Juzgado: [JUZGADO] — Autos: "[CARATULA]" - Exp. N.° [NRO_EXPEDIENTE])</em></p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>I. PERSONERÍA</strong></p>` +
        `<p>${bloqueComparecenciaProfesional}, conjuntamente con la parte co-suscriptora [NOMBRE_CONTRAPARTE], con C.I./RUC N.º [CI_CONTRAPARTE] y domicilio en [DOMICILIO_CONTRAPARTE], en los autos caratulados <strong>"[CARATULA]"</strong>, Expediente N.º <strong>[NRO_EXPEDIENTE]</strong>, a V.S. respetuosamente decimos:</p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>II. HECHOS</strong></p>` +
        `<p>1. Que en la ciudad de Asunción, a los ${dia} días del mes de ${mes} del año ${anio}, las partes han arribado a un <strong>ACUERDO EXTRAJUDICIAL / TRANSACCIÓN</strong> con el objeto de extinguir las obligaciones litigiosas o controvertidas mediante concesiones recíprocas.</p>` +
        `<p>2. <strong>MONTO Y FORMA DE PAGO:</strong> La parte obligada reconoce adeudar y se compromete a abonar a favor de <strong>[CLIENTE]</strong> la suma total y convenida de GUARANÍES [MONTO_LETRAS] (Gs. [MONTO_RECLAMADO]), pagadera de la siguiente manera: [CONDICIONES_DE_PAGO].</p>` +
        `<p>3. <strong>CADUCIDAD DE PLAZOS Y MORA:</strong> La falta de pago puntual de cualquiera de las cuotas pactadas producirá la mora automática y la caducidad de los plazos acordados, habilitando la ejecución inmediata del saldo impago por la vía judicial.</p>` +
        `<p>4. <strong>COSTAS Y HONORARIOS:</strong> Las partes convienen que las costas del acuerdo y honorarios profesionales serán soportados conforme a lo estipulado en la cláusula [CLAUSULA_COSTAS].</p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>III. DERECHO</strong></p>` +
        `<p>Fundo el presente acuerdo en las disposiciones de los artículos 1495, 1496, 1504 y concordantes del Código Civil Paraguayo respecto de la transacción, y en los artículos 170, 171 y concordantes del Código Procesal Civil.</p>` +
        `<p><br></p>` +
        `<p style="text-align: left;"><strong>IV. PETITORIO</strong></p>` +
        `<p>Por todo lo expuesto, a V.S. solicitamos:</p>` +
        `<p>1. Tener por presentado el presente Acuerdo Extrajudicial / Transacción suscripto entre las partes.</p>` +
        `<p>2. Previa ratificación o trámite de rigor, dictar resolución homologando judicialmente el convenio celebrado, otorgándole fuerza de cosa juzgada y título ejecutorio.</p>` +
        bloqueFirmaAbogado
      );

    default:
      return '';
  }
}

export function construirPlantillaPlayero(
  plantillaId: string,
  playero: PlayeroPerfilDatos
): string {
  const now = new Date();
  const dia = String(now.getDate());
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  const mes = meses[now.getMonth()];
  const anio = String(now.getFullYear());

  const esc = escapeHtmlText;
  const nombreVendedor = esc(playero.nombrePlaya);
  const rucVendedor = esc(playero.rucPlaya);
  const domVendedor = esc(playero.direccionPlaya);
  const telVendedor = esc(playero.telefonoPlaya);
  const ciudad = esc(playero.ciudadPlaya);

  const firmaDoble = (labelLeft: string, labelRight: string, docRight: string) =>
    `<p><br></p>` +
    `<p style="text-align: center;">_______________________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; _______________________________</p>` +
    `<p style="text-align: center;"><strong>${labelLeft}</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>${labelRight}</strong></p>` +
    `<p style="text-align: center;">RUC/C.I.: ${rucVendedor} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; C.I./RUC: ${docRight}</p>`;

  switch (plantillaId) {
    case 'playero_compraventa_reserva':
      return (
        `<p style="text-align: center;"><strong>CONTRATO PRIVADO DE COMPRAVENTA DE VEHÍCULO CON RESERVA DE DOMINIO</strong></p>` +
        `<p><br></p>` +
        `<p>En la ciudad de <strong>${ciudad}</strong>, República del Paraguay, a los ${dia} días del mes de ${mes} del año ${anio}, entre <strong>${nombreVendedor}</strong>, con RUC/C.I. N.º <strong>${rucVendedor}</strong>, con domicilio comercial en <strong>${domVendedor}</strong> y teléfono <strong>${telVendedor}</strong>, en adelante denominado <strong>LA PARTE VENDEDORA</strong>, por una parte; y por la otra, el/la Sr./Sra. <strong>[COMPRADOR]</strong>, mayor de edad, titular de la Cédula de Identidad Civil / RUC N.º <strong>[CI_COMPRADOR]</strong>, con domicilio en <strong>[DOMICILIO_COMPRADOR]</strong> y teléfono <strong>[TELEFONO_COMPRADOR]</strong>, en adelante denominado <strong>LA PARTE COMPRADORA</strong>, convienen celebrar el presente Contrato Privado de Compraventa con Reserva de Dominio, sujeto a las siguientes cláusulas:</p>` +
        `<p><br></p>` +
        `<p><strong>PRIMERA — OBJETO:</strong> LA PARTE VENDEDORA vende y entrega la tenencia precaria a LA PARTE COMPRADORA de un vehículo automotor con las siguientes características: Marca y Modelo: <strong>[MARCA_MODELO]</strong>; Año: <strong>[ANO]</strong>; Color: <strong>[COLOR]</strong>; Chasis N.º: <strong>[CHASIS]</strong>; Chapa / Matrícula N.º: <strong>[CHAPA]</strong>, en el estado de uso y conservación en que se encuentra y que LA PARTE COMPRADORA declara conocer y aceptar a su entera satisfacción.</p>` +
        `<p><strong>SEGUNDA — PRECIO Y FINANCIACIÓN:</strong> El precio total de la operación se fija de común acuerdo en la suma de GUARANÍES <strong>[PRECIO_LETRAS]</strong> (<strong>Gs. [PRECIO_TOTAL]</strong>), que LA PARTE COMPRADORA abona de la siguiente manera: a) La suma de <strong>Gs. [ENTREGA]</strong> en concepto de entrega inicial en este acto, sirviendo el presente documento de suficiente recibo; y b) El saldo restante financiado en <strong>[CANTIDAD_CUOTAS]</strong> cuotas mensuales y consecutivas de <strong>Gs. [MONTO_CUOTA]</strong> cada una, venciendo la primera de ellas el día <strong>[FECHA_PRIMERA_CUOTA]</strong>.</p>` +
        `<p><strong>TERCERA — PACTO DE RESERVA DE DOMINIO:</strong> Conforme a lo dispuesto en el artículo 780 y concordantes del Código Civil Paraguayo, LA PARTE VENDEDORA se reserva expresamente la propiedad y titularidad registral del vehículo descripto hasta tanto LA PARTE COMPRADORA abone íntegramente el precio total pactado, cuotas e intereses aplicables. Mientras subsista el saldo impago, LA PARTE COMPRADORA no podrá enajenar, gravar, ceder ni sacar el vehículo del territorio de la República del Paraguay sin autorización previa y por escrito de LA PARTE VENDEDORA.</p>` +
        `<p><strong>CUARTA — RESPONSABILIDAD CIVIL, PENAL Y ADMINISTRATIVA:</strong> A partir del día de la fecha y hora de entrega del automotor, LA PARTE COMPRADORA asume exclusiva e íntegramente toda responsabilidad civil, penal, contravencional y administrativa emergente de la circulación, guarda, accidentes de tránsito, multas o daños a terceros ocasionados con el rodado, liberando totalmente a LA PARTE VENDEDORA.</p>` +
        `<p><strong>QUINTA — MORA Y CADUCIDAD DE PLAZOS:</strong> La falta de pago puntual de cualquiera de las cuotas en su fecha de vencimiento producirá la mora automática de pleno derecho sin necesidad de interpelación judicial o extrajudicial previa, produciéndose la caducidad de todos los plazos y facultando a LA PARTE VENDEDORA a exigir ejecutivamente el saldo total adeudado o resolver el contrato con restitución inmediata del vehículo.</p>` +
        `<p><strong>SEXTA — ESCRITURACIÓN Y JURISDICCIÓN:</strong> Cancelada la totalidad del precio, LA PARTE VENDEDORA otorgará la correspondiente Escritura Pública de Transferencia ante Escribanía Pública, siendo los gastos de transferencia asumidos por <strong>[RESPONSABLE_GASTOS_ESCRITURA]</strong>. Para cualquier divergencia, las partes se someten a la jurisdicción de los Juzgados y Tribunales ordinarios de la ciudad de <strong>${ciudad}</strong>.</p>` +
        `<p><br></p>` +
        `<p>En prueba de conformidad, se firman dos (2) ejemplares de un mismo tenor y a un solo efecto en el lugar y fecha indicados.</p>` +
        firmaDoble(nombreVendedor, '[COMPRADOR]', '[CI_COMPRADOR]')
      );

    case 'playero_acta_entrega':
      return (
        `<p style="text-align: center;"><strong>ACTA DE ENTREGA DE POSESIÓN Y RESPONSABILIDAD CIVIL Y PENAL</strong></p>` +
        `<p><br></p>` +
        `<p>En la ciudad de <strong>${ciudad}</strong>, República del Paraguay, a los ${dia} días del mes de ${mes} del año ${anio}, siendo las <strong>[HORA_ENTREGA]</strong>, comparecen por una parte <strong>${nombreVendedor}</strong>, con RUC/C.I. N.º <strong>${rucVendedor}</strong>, domicilio en <strong>${domVendedor}</strong> y teléfono <strong>${telVendedor}</strong> (en adelante, <strong>LA PLAYA / ENTREGANTE</strong>); y por la otra, el/la Sr./Sra. <strong>[COMPRADOR]</strong>, con C.I./RUC N.º <strong>[CI_COMPRADOR]</strong>, domiciliado/a en <strong>[DOMICILIO_COMPRADOR]</strong> y teléfono <strong>[TELEFONO_COMPRADOR]</strong> (en adelante, <strong>EL ADQUIRENTE / RECEPTOR</strong>), dejando constancia de lo siguiente:</p>` +
        `<p><br></p>` +
        `<p><strong>PRIMERO — ENTREGA DEL AUTOMOTOR:</strong> En este acto, LA PLAYA hace entrega material de la posesión del vehículo Marca y Modelo: <strong>[MARCA_MODELO]</strong>; Año: <strong>[ANO]</strong>; Color: <strong>[COLOR]</strong>; Chasis N.º: <strong>[CHASIS]</strong>; Chapa / Matrícula N.º: <strong>[CHAPA]</strong>; Kilometraje actual: <strong>[KILOMETRAJE]</strong>.</p>` +
        `<p><strong>SEGUNDO — INSPECCIÓN Y ACCESORIOS:</strong> EL RECEPTOR declara haber revisado mecánica y documentalmente el vehículo, recibiéndolo a su entera conformidad conjuntamente con: <strong>[ESTADO_ACCESORIOS]</strong>.</p>` +
        `<p><strong>TERCERO — ASUNCIÓN INTEGRAL DE RESPONSABILIDAD CIVIL, PENAL Y DE TRÁNSITO:</strong> Desde la fecha y hora indicadas en la presente Acta (<strong>${dia} de ${mes} de ${anio} a las [HORA_ENTREGA]</strong>), EL RECEPTOR asume en forma absoluta, exclusiva e irrevocable toda responsabilidad civil, penal, administrativa, tributaria y municipal derivada de la tenencia, uso o conducción del rodado, incluyendo siniestros viales, lesiones, daños materiales a terceros, infracciones de tránsito, multas de Patrulla Caminera o PMT y eventuales hechos punibles, deslindando total y expresamente a LA PLAYA y/o al titular registral de cualquier reclamo presente o futuro.</p>` +
        `<p><strong>CUARTO — PROHIBICIÓN DE SALIDA DEL PAÍS:</strong> Hasta tanto se perfeccione la transferencia registral definitiva a nombre de EL RECEPTOR, queda prohibido trasladar el vehículo fuera del territorio de la República del Paraguay sin autorización escrita de LA PLAYA.</p>` +
        `<p><br></p>` +
        `<p>Leída y ratificada íntegramente la presente Acta, la suscriben las partes en dos ejemplares de igual tenor en fecha y hora ut supra.</p>` +
        firmaDoble(nombreVendedor, '[COMPRADOR]', '[CI_COMPRADOR]')
      );

    case 'playero_recibo_sena':
      return (
        `<p style="text-align: center;"><strong>RECIBO DE SEÑA DE TRATO Y RESERVA DE VEHÍCULO</strong></p>` +
        `<p><br></p>` +
        `<p style="text-align: right;"><em>${ciudad}, ${dia} de ${mes} de ${anio}.-</em></p>` +
        `<p style="text-align: right;"><strong>POR: Gs. [MONTO_SENA]</strong></p>` +
        `<p><br></p>` +
        `<p>Recibimos de el/la Sr./Sra. <strong>[COMPRADOR]</strong>, titular de la Cédula de Identidad Civil / RUC N.º <strong>[CI_COMPRADOR]</strong>, con domicilio en <strong>[DOMICILIO_COMPRADOR]</strong> y teléfono <strong>[TELEFONO_COMPRADOR]</strong>, la suma de GUARANÍES <strong>[MONTO_SENA_LETRAS]</strong> (<strong>Gs. [MONTO_SENA]</strong>), en concepto de <strong>SEÑA DE TRATO</strong> (Art. 724 del Código Civil Paraguayo) por la reserva del vehículo con las siguientes especificaciones:</p>` +
        `<p><br></p>` +
        `<p>• <strong>Marca y Modelo:</strong> [MARCA_MODELO]<br>• <strong>Año:</strong> [ANO] &nbsp;|&nbsp; <strong>Color:</strong> [COLOR]<br>• <strong>Chasis N.º:</strong> [CHASIS] &nbsp;|&nbsp; <strong>Chapa N.º:</strong> [CHAPA]</p>` +
        `<p><br></p>` +
        `<p><strong>CONDICIONES DE LA RESERVA:</strong></p>` +
        `<p>1. El precio total convenido por el rodado asciende a la suma de GUARANÍES <strong>[PRECIO_LETRAS]</strong> (<strong>Gs. [PRECIO_TOTAL]</strong>).</p>` +
        `<p>2. La presente reserva tendrá vigencia por el plazo de <strong>[PLAZO_VALIDEZ_SENA]</strong>, término dentro del cual el/la interesado/a deberá integrar el saldo de entrega inicial y suscribir la documentación definitiva en el local de <strong>${nombreVendedor}</strong> (${domVendedor} — Tel.: ${telVendedor}).</p>` +
        `<p>3. Concretada la compraventa dentro del plazo pactado, el monto entregado en concepto de seña será imputado íntegramente a cuenta del precio total. En caso de desistimiento unilateral o vencimiento del plazo sin integración por causa imputable al/a la interesado/a, quedará sin efecto la reserva perdiendo la seña entregada conforme a derecho.</p>` +
        firmaDoble(nombreVendedor, '[COMPRADOR]', '[CI_COMPRADOR]')
      );

    case 'playero_autorizacion_circulacion':
      return (
        `<p style="text-align: center;"><strong>AUTORIZACIÓN PROVISORIA DE CIRCULACIÓN DE VEHÍCULO</strong></p>` +
        `<p><br></p>` +
        `<p style="text-align: right;"><em>${ciudad}, ${dia} de ${mes} de ${anio}.-</em></p>` +
        `<p><br></p>` +
        `<p>Por medio de la presente, <strong>${nombreVendedor}</strong>, con RUC/C.I. N.º <strong>${rucVendedor}</strong>, con domicilio comercial en <strong>${domVendedor}</strong> y teléfono <strong>${telVendedor}</strong>, <strong>AUTORIZA PROVISORIAMENTE</strong> al/a la Sr./Sra. <strong>[CONDUCTOR_AUTORIZADO]</strong>, mayor de edad, titular de la Cédula de Identidad Civil N.º <strong>[CI_CONDUCTOR]</strong>, con domicilio en <strong>[DOMICILIO_CONDUCTOR]</strong>, a conducir y circular dentro del territorio de la República del Paraguay con el vehículo automotor cuyos datos se detallan:</p>` +
        `<p><br></p>` +
        `<p>• <strong>Marca y Modelo:</strong> [MARCA_MODELO]<br>• <strong>Año:</strong> [ANO] &nbsp;|&nbsp; <strong>Color:</strong> [COLOR]<br>• <strong>Chasis N.º:</strong> [CHASIS] &nbsp;|&nbsp; <strong>Chapa / Matrícula N.º:</strong> [CHAPA]</p>` +
        `<p><br></p>` +
        `<p><strong>VIGENCIA Y MOTIVO:</strong> La presente autorización se expide con carácter estrictamente provisorio con vigencia hasta el día <strong>[FECHA_VENCIMIENTO_AUTORIZACION]</strong>, en razón de encontrarse en curso el trámite de <strong>[MOTIVO_AUTORIZACION]</strong>.</p>` +
        `<p><strong>ALCANCE Y RESPONSABILIDAD:</strong> Durante el período autorizado, <strong>[CONDUCTOR_AUTORIZADO]</strong> asume plena y exclusiva responsabilidad civil, penal y administrativa por cualquier infracción de tránsito, multa o siniestro que pudiera producirse en la conducción del rodado. La presente autorización es personal e intransferible y <strong>NO habilita la salida del vehículo del territorio nacional</strong>.</p>` +
        `<p><br></p>` +
        `<p>Se expide el presente documento para su exhibición ante las autoridades policiales, municipales y de tránsito que así lo requieran.</p>` +
        firmaDoble(nombreVendedor, '[CONDUCTOR_AUTORIZADO]', '[CI_CONDUCTOR]')
      );

    default:
      return '';
  }
}

export function construirPlantillaSectorPublicoBeta(
  plantillaId: string,
  perfil: SectorPublicoPerfilDatos
): string {
  const now = new Date();
  const dia = String(now.getDate());
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  const mes = meses[now.getMonth()];
  const anio = String(now.getFullYear());

  const esc = escapeHtmlText;
  const institucion = esc(perfil.nombreInstitucion);
  const ciudad = esc(perfil.ciudadInstitucion || 'Asunción');

  const bloqueFirmaUoc =
    `<p><br></p>` +
    `<p style="text-align: center;">____________________________________________</p>` +
    `<p style="text-align: center;"><strong>[REMITENTE]</strong></p>` +
    `<p style="text-align: center;">[CARGO_REMITENTE]</p>` +
    `<p style="text-align: center;">[DEPENDENCIA_SOLICITANTE] — ${institucion}</p>`;

  switch (plantillaId) {
    case 'uoc_pedido_licitacion':
      return (
        `<p style="text-align: center;"><strong>SOLICITUD DE INICIO DE PROCESO DE CONTRATACIÓN / LLAMADO MÍNIMO INICIAL</strong></p>` +
        `<p style="text-align: right;"><em>${ciudad}, ${dia} de ${mes} de ${anio}.-</em></p>` +
        `<p style="text-align: right;"><strong>REF.: [NRO_MEMO_NOTA]</strong></p>` +
        `<p><br></p>` +
        `<p><strong>A:</strong> [DESTINATARIO] — [CARGO_DESTINATARIO]</p>` +
        `<p><strong>DE:</strong> [REMITENTE] — [CARGO_REMITENTE] ([DEPENDENCIA_SOLICITANTE])</p>` +
        `<p><strong>OBJETO:</strong> Solicitud de llamado para <strong>[OBJETO_CONTRATACION]</strong></p>` +
        `<p><br></p>` +
        `<p>Por medio de la presente, en cumplimiento de las disposiciones de la <strong>Ley N.º 7021/2022 "De Suministro y Contrataciones Públicas"</strong> y su Decreto Reglamentario, solicito la sustanciación del proceso de contratación bajo la modalidad de <strong>[TIPO_LLAMADO]</strong>, conforme al siguiente detalle técnico y presupuestario:</p>` +
        `<p><br></p>` +
        `<p>• <strong>Institución / Entidad:</strong> ${institucion}<br>` +
        `• <strong>Dependencia Requirente:</strong> [DEPENDENCIA_SOLICITANTE]<br>` +
        `• <strong>Objeto de la Contratación:</strong> [OBJETO_CONTRATACION]<br>` +
        `• <strong>Código PAC / Referencia:</strong> [CODIGO_PAC]<br>` +
        `• <strong>Monto Estimado Referencial:</strong> GUARANÍES <strong>[MONTO_LETRAS]</strong> (<strong>Gs. [MONTO_ESTIMADO]</strong>)<br>` +
        `• <strong>Disponibilidad Presupuestaria:</strong> [NRO_CDP]<br>` +
        `• <strong>Plazo de Ejecución Estimado:</strong> [PLAZO_EJECUCION]</p>` +
        `<p><br></p>` +
        `<p><strong>FUNDAMENTACIÓN DE LA NECESIDAD:</strong></p>` +
        `<p>[JUSTIFICACION_TECNICA]</p>` +
        `<p><br></p>` +
        `<p>Se adjuntan las Especificaciones Técnicas (EETT), los precios referenciales de mercado y la planilla de requerimiento para la prosecución de los trámites pertinentes ante la Unidad Operativa de Contrataciones (UOC).</p>` +
        bloqueFirmaUoc
      );

    case 'uoc_adenda_tiempo':
      return (
        `<p style="text-align: center;"><strong>SOLICITUD DE ADENDA DE TIEMPO (PRÓRROGA DE PLAZO CONTRACTUAL)</strong></p>` +
        `<p style="text-align: right;"><em>${ciudad}, ${dia} de ${mes} de ${anio}.-</em></p>` +
        `<p style="text-align: right;"><strong>REF.: [NRO_MEMO_NOTA]</strong></p>` +
        `<p><br></p>` +
        `<p><strong>A:</strong> [DESTINATARIO] — [CARGO_DESTINATARIO]</p>` +
        `<p><strong>DE:</strong> [REMITENTE] — [CARGO_REMITENTE] ([DEPENDENCIA_SOLICITANTE])</p>` +
        `<p><strong>REFERENCIA:</strong> [NRO_CONTRATO] — ID DNCP N.º <strong>[ID_DNCP]</strong></p>` +
        `<p><br></p>` +
        `<p>Me dirijo a usted con relación al contrato administrativo <strong>[NRO_CONTRATO]</strong> (ID DNCP N.º <strong>[ID_DNCP]</strong>), suscripto con el proveedor <strong>[PROVEEDOR]</strong> (RUC N.º <strong>[RUC_PROVEEDOR]</strong>) para el objeto <strong>[OBJETO_CONTRATACION]</strong>, cuyo vencimiento vigente opera en fecha <strong>[FECHA_VENCIMIENTO_ACTUAL]</strong>.</p>` +
        `<p><br></p>` +
        `<p>Al respecto, conforme a lo previsto en la <strong>Ley N.º 7021/2022</strong> y las cláusulas del Pliego de Bases y Condiciones, solicito formalmente la tramitación de una <strong>ADENDA DE AMPLIACIÓN DE PLAZO (TIEMPO)</strong> sin incremento de monto, de acuerdo con los siguientes parámetros:</p>` +
        `<p><br></p>` +
        `<p>• <strong>Contrato / ID DNCP:</strong> [NRO_CONTRATO] — ID DNCP [ID_DNCP]<br>` +
        `• <strong>Proveedor Adjudicado:</strong> [PROVEEDOR] (RUC: [RUC_PROVEEDOR])<br>` +
        `• <strong>Vencimiento Actual:</strong> [FECHA_VENCIMIENTO_ACTUAL]<br>` +
        `• <strong>Prórroga Solicitada:</strong> [PLAZO_PRORROGA]<br>` +
        `• <strong>Nueva Fecha de Vencimiento Propuesta:</strong> [NUEVA_FECHA_VENCIMIENTO]</p>` +
        `<p><br></p>` +
        `<p><strong>JUSTIFICACIÓN TÉCNICA Y OPERATIVA:</strong></p>` +
        `<p>[JUSTIFICACION_TECNICA]</p>` +
        `<p><br></p>` +
        `<p>Se deja expresa constancia de que la presente prórroga no irroga erogación presupuestaria adicional a la ya adjudicada y permite salvaguardar la continuidad de los servicios institucionales mientras se culminan los procedimientos administrativos correspondientes.</p>` +
        bloqueFirmaUoc
      );

    case 'uoc_adenda_monto':
      return (
        `<p style="text-align: center;"><strong>SOLICITUD DE ADENDA DE MONTO (AMPLIACIÓN PRESUPUESTARIA CONTRACTUAL)</strong></p>` +
        `<p style="text-align: right;"><em>${ciudad}, ${dia} de ${mes} de ${anio}.-</em></p>` +
        `<p style="text-align: right;"><strong>REF.: [NRO_MEMO_NOTA]</strong></p>` +
        `<p><br></p>` +
        `<p><strong>A:</strong> [DESTINATARIO] — [CARGO_DESTINATARIO]</p>` +
        `<p><strong>DE:</strong> [REMITENTE] — [CARGO_REMITENTE] ([DEPENDENCIA_SOLICITANTE])</p>` +
        `<p><strong>REFERENCIA:</strong> Ampliación de Monto — [NRO_CONTRATO] (ID DNCP N.º <strong>[ID_DNCP]</strong>)</p>` +
        `<p><br></p>` +
        `<p>Por la presente, en el marco del contrato <strong>[NRO_CONTRATO]</strong> (ID DNCP N.º <strong>[ID_DNCP]</strong>), adjudicado a la firma <strong>[PROVEEDOR]</strong> (RUC N.º <strong>[RUC_PROVEEDOR]</strong>) para <strong>[OBJETO_CONTRATACION]</strong>, solicito autorización y dictamen para la formalización de una <strong>ADENDA DE AMPLIACIÓN DE MONTO</strong> dentro de los límites establecidos en la <strong>Ley N.º 7021/2022</strong>:</p>` +
        `<p><br></p>` +
        `<p>• <strong>Monto Original Adjudicado:</strong> Gs. [MONTO_CONTRATO_ORIGINAL]<br>` +
        `• <strong>Monto de Ampliación Solicitado:</strong> GUARANÍES <strong>[MONTO_AMPLIACION_LETRAS]</strong> (<strong>Gs. [MONTO_AMPLIACION]</strong>)<br>` +
        `• <strong>Porcentaje de Ampliación:</strong> [PORCENTAJE_AMPLIACION] del contrato original<br>` +
        `• <strong>Monto Total Actualizado:</strong> Gs. [MONTO_TOTAL_ACTUALIZADO]<br>` +
        `• <strong>Respaldo Presupuestario:</strong> [NRO_CDP]</p>` +
        `<p><br></p>` +
        `<p><strong>JUSTIFICACIÓN TÉCNICA Y ECONÓMICA:</strong></p>` +
        `<p>[JUSTIFICACION_TECNICA]</p>` +
        `<p><br></p>` +
        `<p>Los bienes/servicios ampliados mantienen idénticos precios unitarios y condiciones técnicas adjudicadas originalmente en el contrato base. Se solicita remitir a la Dirección de Presupuesto / Asesoría Jurídica y UOC para su formalización ante la DNCP.</p>` +
        bloqueFirmaUoc
      );

    case 'uoc_nota_remision':
      return (
        `<p style="text-align: center;"><strong>NOTA DE REMISIÓN DE LEGAJO / MEMORÁNDUM INTERNO</strong></p>` +
        `<p style="text-align: right;"><em>${ciudad}, ${dia} de ${mes} de ${anio}.-</em></p>` +
        `<p style="text-align: right;"><strong>[NRO_MEMO_NOTA]</strong></p>` +
        `<p><br></p>` +
        `<p><strong>PARA:</strong> [DESTINATARIO] — [CARGO_DESTINATARIO]</p>` +
        `<p><strong>DE:</strong> [REMITENTE] — [CARGO_REMITENTE] ([DEPENDENCIA_SOLICITANTE])</p>` +
        `<p><strong>EXPEDIENTE / MESA DE ENTRADA:</strong> [NRO_EXPEDIENTE_INTERNO]</p>` +
        `<p><strong>ASUNTO:</strong> Remisión de legajo — [NRO_CONTRATO] (ID DNCP N.º [ID_DNCP]) — [PROVEEDOR]</p>` +
        `<p><br></p>` +
        `<p>Tengo el agrado de dirigirme a usted a fin de remitir el legajo administrativo correspondiente al contrato <strong>[NRO_CONTRATO]</strong> (ID DNCP N.º <strong>[ID_DNCP]</strong>), suscripto con <strong>[PROVEEDOR]</strong> (RUC N.º <strong>[RUC_PROVEEDOR]</strong>), referente a <strong>[OBJETO_CONTRATACION]</strong>, con la siguiente documentación respaldatoria:</p>` +
        `<p><br></p>` +
        `<p>[DETALLE_LEGAJO]</p>` +
        `<p><br></p>` +
        `<p><strong>OBSERVACIONES / TRÁMITE SUGERIDO:</strong></p>` +
        `<p>[JUSTIFICACION_TECNICA]</p>` +
        `<p><br></p>` +
        `<p>Sin otro particular, hago propicia la ocasión para saludarle atentamente.</p>` +
        bloqueFirmaUoc
      );

    default:
      return '';
  }
}

const LOCAL_STORAGE_DRAFT_TEXT = 'olga_escritos_redaccion_draft_texto';
const LOCAL_STORAGE_DRAFT_PLANTILLA = 'olga_escritos_redaccion_draft_plantilla';
const LOCAL_STORAGE_DRAFT_TITULO = 'olga_escritos_redaccion_draft_titulo';
const LOCAL_STORAGE_DRAFT_CATEGORIA = 'olga_escritos_redaccion_draft_categoria';
const LOCAL_STORAGE_DRAFT_TIPO_HOJA = 'olga_escritos_redaccion_draft_tipo_hoja';
const LOCAL_STORAGE_DRAFT_INCLUDE_HEADER = 'olga_escritos_redaccion_draft_include_header';
const LOCAL_STORAGE_DRAFT_FONT_FAMILY = 'olga_escritos_redaccion_draft_font_family';
const LOCAL_STORAGE_DRAFT_FONT_SIZE = 'olga_escritos_redaccion_draft_font_size';
const LOCAL_STORAGE_DRAFT_LINE_HEIGHT = 'olga_escritos_redaccion_draft_line_height';
const LOCAL_STORAGE_DRAFT_PAGE_MARGINS = 'olga_escritos_redaccion_draft_page_margins';

export const EscritosTab: React.FC<EscritosTabProps> = ({ currentUser, userProfile, personas, expedientes = [], onOpenDocument, esPlanFull, isSoftBlocked = false, canUseWhatsApp }) => {
  // FASE 2: Identificador maestro del Workspace (Tenant)
  const { workspaceId, workspaceData } = useWorkspace(currentUser, userProfile);
  // Estado de prueba gratuita / billing
  const { pruebaActiva, diasRestantes, isTrialExpired, userData: liveUserData } = useTrialStatus(currentUser);
  const activeUserData = liveUserData || userProfile || workspaceData;

  const planUsuario = String(activeUserData?.planActual || activeUserData?.plan || userProfile?.planActual || userProfile?.plan || '').toLowerCase().trim();
  const isOperador = activeUserData?.rol === 'operador' || activeUserData?.role === 'operador' || userProfile?.rol === 'operador' || userProfile?.role === 'operador';
  const esAdmin = currentUser?.email === 'jotamolinas@gmail.com' || (currentUser as any)?.role === 'SUPERADMIN' || activeUserData?.role === 'SUPERADMIN' || isOperador;
  const isAprobado = String(activeUserData?.estadoPago || userProfile?.estadoPago || '').toUpperCase() === 'APROBADO' || String(activeUserData?.estadoPlataforma || userProfile?.estadoPlataforma || '').toUpperCase() === 'APROBADO';
  const tienePlanActivo = planUsuario.includes('pro') || planUsuario.includes('empresa') || planUsuario.includes('full') || planUsuario.includes('básico') || planUsuario.includes('basico') || isAprobado || esAdmin;

  let suscripcionVencida = false;
  const fechaVencimientoPlan = activeUserData?.fecha_vencimiento_plan || userProfile?.fecha_vencimiento_plan;
  if (tienePlanActivo && fechaVencimientoPlan && !esAdmin) {
    const vDate = new Date(fechaVencimientoPlan);
    const diasParaVencimiento = Math.ceil((vDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (diasParaVencimiento < 0) suscripcionVencida = true;
  }

  // Bloqueado únicamente cuando la sesión trial ha expirado (o plan vencido) y no tiene un plan activo vigente
  const isMenuPlantillasBloqueado = isSoftBlocked || (!tienePlanActivo && (isTrialExpired || !pruebaActiva || diasRestantes <= 0)) || suscripcionVencida;

  const esFull = esPlanFull !== undefined ? esPlanFull : (currentUser?.email === 'jotamolinas@gmail.com' || planUsuario.includes('full'));
  const isWhatsAppEnabled =
    typeof canUseWhatsApp === 'boolean'
      ? canUseWhatsApp
      : Boolean(activeUserData?.whatsappEnabled === true || userProfile?.whatsappEnabled === true);

  const [waModalData, setWaModalData] = useState<{
    isOpen: boolean;
    documentTitle: string;
    defaultMessage: string;
    fileBase64: string;
    fileName: string;
  } | null>(null);

  const [pdfLogoDataUrl, setPdfLogoDataUrl] = useState<string | undefined>(undefined);

  const rawLogoInstitucional: string | undefined =
    workspaceData?.logo_institucional ||
    workspaceData?.logoUrl ||
    activeUserData?.logo_institucional ||
    activeUserData?.logoUrl ||
    userProfile?.logo_institucional ||
    userProfile?.logoUrl ||
    undefined;

  useEffect(() => {
    let cancelled = false;
    if (!rawLogoInstitucional) {
      setPdfLogoDataUrl(undefined);
      return;
    }
    if (/^data:image\/(png|jpe?g);base64,/i.test(rawLogoInstitucional)) {
      setPdfLogoDataUrl(rawLogoInstitucional);
      return;
    }
    if (rawLogoInstitucional.startsWith('data:image/')) {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 200;
          canvas.height = img.naturalHeight || 200;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            setPdfLogoDataUrl(canvas.toDataURL('image/png'));
          }
        } catch {
          if (!cancelled) setPdfLogoDataUrl(undefined);
        }
      };
      img.onerror = () => {
        if (!cancelled) setPdfLogoDataUrl(undefined);
      };
      img.src = rawLogoInstitucional;
    } else {
      setPdfLogoDataUrl(undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [rawLogoInstitucional]);

  const tipoPerfilEscNorm = String(
    workspaceData?.tipoPerfil || activeUserData?.tipoPerfil || userProfile?.tipoPerfil || ''
  )
    .trim()
    .toLowerCase();
  const esAbogadoEsc = tipoPerfilEscNorm === 'abogado';
  const esPlayeroEsc = tipoPerfilEscNorm === 'playero';
  const esSectorPublicoBeta = tipoPerfilEscNorm === 'sector_publico_beta';
  const esRubroNoNotarialEsc =
    esAbogadoEsc ||
    esPlayeroEsc ||
    esSectorPublicoBeta ||
    tipoPerfilEscNorm === 'inmobiliario' ||
    tipoPerfilEscNorm === 'contador';

  const pickRealEscHeader = (...candidates: unknown[]): string => {
    for (const candidate of candidates) {
      const clean = String(candidate || '').trim();
      if (!clean) continue;
      const lower = clean.toLowerCase();
      if (
        lower === '---' ||
        lower === 'sin especificar' ||
        lower === 'sin r.u.c.' ||
        lower === 'mi escribanía' ||
        lower === 'escribanía titular' ||
        lower === 'escribanía pública' ||
        lower === 'estudio jurídico' ||
        lower === 'playa de vehículos'
      ) {
        continue;
      }
      return clean;
    }
    return '';
  };

  const nombreEscHeader = esAbogadoEsc
    ? pickRealEscHeader(
        workspaceData?.razonSocial,
        workspaceData?.nombreInstitucion,
        activeUserData?.razonSocial,
        activeUserData?.nombreInstitucion,
        userProfile?.razonSocial,
        workspaceData?.nombre,
        activeUserData?.nombre,
        userProfile?.nombre
      )
    : esSectorPublicoBeta
      ? (pickRealEscHeader(
          workspaceData?.razonSocial,
          workspaceData?.nombreInstitucion,
          workspaceData?.nombreComercial,
          activeUserData?.razonSocial,
          activeUserData?.nombreInstitucion,
          activeUserData?.nombreComercial,
          userProfile?.razonSocial,
          userProfile?.nombreInstitucion,
          workspaceData?.nombre,
          activeUserData?.nombre,
          userProfile?.nombre
        ) || 'Unidad Operativa de Contratación (UOC)')
      : esPlayeroEsc
      ? (pickRealEscHeader(
          workspaceData?.razonSocial,
          workspaceData?.nombreComercial,
          workspaceData?.nombreInstitucion,
          activeUserData?.razonSocial,
          activeUserData?.nombreComercial,
          activeUserData?.nombreInstitucion,
          userProfile?.razonSocial,
          userProfile?.nombreComercial,
          workspaceData?.nombre,
          activeUserData?.nombre,
          userProfile?.nombre
        ) || 'Playa de Vehículos')
      : (workspaceData?.razonSocial ||
          workspaceData?.nombreInstitucion ||
          activeUserData?.razonSocial ||
          activeUserData?.nombreInstitucion ||
          userProfile?.razonSocial ||
          activeUserData?.nombre ||
          userProfile?.nombre ||
          'Escribanía Pública');
  const rucEscHeader = esRubroNoNotarialEsc
    ? pickRealEscHeader(workspaceData?.ruc, activeUserData?.ruc, userProfile?.ruc)
    : (workspaceData?.ruc || activeUserData?.ruc || userProfile?.ruc || '');
  const registroEscHeader = esAbogadoEsc
    ? pickRealEscHeader(
        workspaceData?.matriculaAbogado,
        activeUserData?.matriculaAbogado,
        userProfile?.matriculaAbogado,
        workspaceData?.matricula,
        activeUserData?.matricula,
        userProfile?.matricula,
        workspaceData?.registroNotarial,
        activeUserData?.registroNotarial,
        userProfile?.registroNotarial
      )
    : esRubroNoNotarialEsc
      ? ''
      : (workspaceData?.registroNotarial ||
          workspaceData?.matricula ||
          activeUserData?.registroNotarial ||
          activeUserData?.matricula ||
          userProfile?.registroNotarial ||
          userProfile?.matricula ||
          '');
  const telefonoEscHeader = esRubroNoNotarialEsc
    ? pickRealEscHeader(workspaceData?.telefono, activeUserData?.telefono, userProfile?.telefono)
    : (workspaceData?.telefono || activeUserData?.telefono || userProfile?.telefono || '');
  const direccionEscHeader = esRubroNoNotarialEsc
    ? pickRealEscHeader(
        workspaceData?.direccion,
        activeUserData?.direccion,
        userProfile?.direccion,
        workspaceData?.ciudad,
        activeUserData?.ciudad,
        userProfile?.ciudad
      )
    : (workspaceData?.direccion || activeUserData?.direccion || userProfile?.direccion || '');

  const buildEscribaniaPdfMeta = () => ({
    nombre: nombreEscHeader,
    ruc: rucEscHeader,
    registro: registroEscHeader,
    telefono: telefonoEscHeader,
    direccion: direccionEscHeader,
    logo: pdfLogoDataUrl,
    esAbogado: esAbogadoEsc,
  });

  const playeroPerfilDatos: PlayeroPerfilDatos = React.useMemo(() => {
    const rawNombre = pickRealEscHeader(
      workspaceData?.razonSocial,
      workspaceData?.nombreComercial,
      workspaceData?.nombreInstitucion,
      activeUserData?.razonSocial,
      activeUserData?.nombreComercial,
      activeUserData?.nombreInstitucion,
      userProfile?.razonSocial,
      userProfile?.nombreComercial,
      workspaceData?.nombre,
      activeUserData?.nombre,
      userProfile?.nombre
    );
    const rawCiudad = pickRealEscHeader(
      workspaceData?.ciudad,
      activeUserData?.ciudad,
      userProfile?.ciudad
    );
    return {
      nombrePlaya: rawNombre || '[NOMBRE_VENDEDOR_PLAYA]',
      rucPlaya: rucEscHeader || '[RUC_PLAYA]',
      direccionPlaya: direccionEscHeader || '[DOMICILIO_PLAYA]',
      telefonoPlaya: telefonoEscHeader || '[TELEFONO_PLAYA]',
      ciudadPlaya: rawCiudad || 'Asunción',
    };
  }, [workspaceData, activeUserData, userProfile, rucEscHeader, direccionEscHeader, telefonoEscHeader]);

  const sectorPublicoPerfilDatos: SectorPublicoPerfilDatos = React.useMemo(() => {
    const rawNombre = pickRealEscHeader(
      workspaceData?.razonSocial,
      workspaceData?.nombreInstitucion,
      workspaceData?.nombreComercial,
      activeUserData?.razonSocial,
      activeUserData?.nombreInstitucion,
      activeUserData?.nombreComercial,
      userProfile?.razonSocial,
      userProfile?.nombreInstitucion,
      workspaceData?.nombre,
      activeUserData?.nombre,
      userProfile?.nombre
    );
    const rawCiudad = pickRealEscHeader(
      workspaceData?.ciudad,
      activeUserData?.ciudad,
      userProfile?.ciudad
    );
    return {
      nombreInstitucion: rawNombre || 'Unidad Operativa de Contratación (UOC)',
      rucInstitucion: rucEscHeader || '',
      direccionInstitucion: direccionEscHeader || '',
      telefonoInstitucion: telefonoEscHeader || '',
      ciudadInstitucion: rawCiudad || 'Asunción',
    };
  }, [workspaceData, activeUserData, userProfile, rucEscHeader, direccionEscHeader, telefonoEscHeader]);

  // Datos reales del perfil del Abogado para autocompletado automático en escritos judiciales
  const abogadoPerfilDatos: AbogadoPerfilDatos = React.useMemo(() => {
    const rawNombre = pickRealEscHeader(
      workspaceData?.nombreTitular,
      activeUserData?.nombreTitular,
      userProfile?.nombreTitular,
      workspaceData?.nombreCompleto,
      activeUserData?.nombreCompleto,
      userProfile?.nombreCompleto,
      workspaceData?.nombre,
      activeUserData?.nombre,
      userProfile?.nombre,
      nombreEscHeader,
      currentUser?.displayName
    );
    const rawMatricula = String(registroEscHeader || '')
      .replace(/^matr[ií]cula\s*(csj)?\s*(n[º°o]\.?\s*)?/i, '')
      .trim();
    const rawDomicilio = pickRealEscHeader(
      workspaceData?.domicilioProcesal,
      activeUserData?.domicilioProcesal,
      userProfile?.domicilioProcesal,
      workspaceData?.domicilio,
      activeUserData?.domicilio,
      userProfile?.domicilio,
      direccionEscHeader
    );
    const rawEmail = pickRealEscHeader(
      workspaceData?.email,
      activeUserData?.email,
      userProfile?.email,
      currentUser?.email
    );
    return {
      nombreAbogado: rawNombre || '[NOMBRE_DEL_ABOGADO]',
      matriculaCsj: rawMatricula || '[MATRICULA_CSJ]',
      domicilioProcesal: rawDomicilio || '[DOMICILIO_PROCESAL]',
      telefonoAbogado: telefonoEscHeader || '[TELEFONO_ABOGADO]',
      emailAbogado: rawEmail || '[EMAIL_ABOGADO]',
    };
  }, [
    workspaceData,
    activeUserData,
    userProfile,
    currentUser?.displayName,
    currentUser?.email,
    nombreEscHeader,
    registroEscHeader,
    direccionEscHeader,
    telefonoEscHeader,
  ]);

  const handleSendDocumentByWhatsApp = (
    rawTitle?: string,
    rawContent?: string,
    overrideIncludeHeader?: boolean,
    overrideFontFamily?: string,
    overrideFontSizePt?: number
  ) => {
    const content = limpiarEspaciadoresVisualesHtml(
      (rawContent || '').replace(/<span id="espacio-activo"[^>]*>(.*?)<\/span>/g, '$1')
    );
    if (!content.trim()) return;
    const cleanTitle = (rawTitle || 'Documento').replace(/\s*\(Guardado Local\)\s*/gi, '').trim();
    const effectiveIncludeHeader =
      overrideIncludeHeader !== undefined ? overrideIncludeHeader : includeHeader;
    const pdf = generateDocumentPdfBase64({
      title: cleanTitle,
      content,
      escribania: buildEscribaniaPdfMeta(),
      includeHeader: effectiveIncludeHeader,
      fontFamily: overrideFontFamily || editorFontFamily,
      fontSizePt: overrideFontSizePt || editorFontSizePt,
    });
    setWaModalData({
      isOpen: true,
      documentTitle: cleanTitle,
      defaultMessage: buildWhatsAppDocumentMessage(cleanTitle, nombreEscHeader),
      fileBase64: pdf.fileBase64,
      fileName: pdf.fileName,
    });
  };

  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);

  const buildMembreteHtml = (): string => {
    const metaItems: string[] = [];
    if (registroEscHeader && registroEscHeader !== '---') {
      metaItems.push(
        esAbogadoEsc
          ? (/matr[ií]cula/i.test(registroEscHeader) ? registroEscHeader : `Matrícula CSJ N.º ${registroEscHeader}`)
          : (/reg/i.test(registroEscHeader) ? registroEscHeader : `Registro N.º ${registroEscHeader}`)
      );
    }
    if (rucEscHeader && rucEscHeader !== '---') {
      metaItems.push(`RUC: ${rucEscHeader}`);
    }
    if (telefonoEscHeader && telefonoEscHeader !== '---') {
      metaItems.push(`Tel.: ${telefonoEscHeader}`);
    }
    if (direccionEscHeader && direccionEscHeader !== '---') {
      metaItems.push(direccionEscHeader);
    }
    const logoMarkup = rawLogoInstitucional
      ? `<img src="${rawLogoInstitucional.replace(/"/g, '&quot;')}" alt="${escapeHtmlText(nombreEscHeader)}" class="olga-doc-membrete-logo" crossorigin="anonymous" />`
      : '';
    const subMarkup = metaItems.length > 0
      ? `<p class="olga-doc-membrete-sub">${escapeHtmlText(metaItems.join('  •  '))}</p>`
      : '';

    return `<div class="olga-doc-membrete">${logoMarkup}<div class="olga-doc-membrete-title">${escapeHtmlText(nombreEscHeader.toUpperCase())}</div>${subMarkup}</div>`;
  };

  const handleDescargarPDF = async (
    rawTitle?: string,
    rawContent?: string,
    overrideIncludeHeader?: boolean,
    overrideFontFamily?: string,
    overrideFontSizePt?: number,
    overrideLineHeight?: string,
    overridePageMargins?: EditorPageMargins
  ) => {
    if (isExportingPDF) return;

    const content = rawContent !== undefined ? rawContent : (editorContentRef.current?.innerHTML || editorText);
    const cleanedSource = limpiarEspaciadoresVisualesHtml(
      desempaquetarContenidoFluido(
        (content || '').replace(/<span id="espacio-activo"[^>]*>(.*?)<\/span>/g, '$1')
      )
    );

    const hasMedia = /<(img|table|hr|svg)\b/i.test(cleanedSource);
    const plainCheck = stripHtmlToPlainText(cleanedSource);
    if (!cleanedSource || (!plainCheck && !hasMedia)) {
      alert('El documento está vacío. Escriba o seleccione una plantilla antes de exportar.');
      return;
    }

    const cleanTitle = (rawTitle || documentTitle || 'Documento')
      .replace(/\s*\(Guardado Local\)\s*/gi, '')
      .trim();
    const safeFileName =
      (cleanTitle || 'Documento')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\s_-]/g, '')
        .trim()
        .replace(/\s+/g, '_') + '.pdf';

    const effectiveIncludeHeader =
      overrideIncludeHeader !== undefined ? overrideIncludeHeader : includeHeader;
    const effectiveFontCss = resolveEditorFontCss(overrideFontFamily || editorFontFamily);
    const effectiveFontSizePt = overrideFontSizePt || editorFontSizePt;
    const effectiveLineHeight = overrideLineHeight || editorLineHeight || '1.5';
    const effectiveMarginKey: EditorPageMargins =
      overridePageMargins && PAGE_MARGIN_PROFILES[overridePageMargins]
        ? overridePageMargins
        : pageMargins;
    const marginCfg = PAGE_MARGIN_PROFILES[effectiveMarginKey] || PAGE_MARGIN_PROFILES.normal;
    const padLeftPx = Math.round(marginCfg.leftCm * 37.81);
    const padRightPx = Math.round(marginCfg.rightCm * 37.81);

    // Limpiar saltos visuales y nodos vacíos finales para evitar página 2 en blanco
    const tempWrap = document.createElement('div');
    tempWrap.innerHTML = cleanedSource;
    tempWrap.querySelectorAll('.salto-de-pagina').forEach((el) => {
      const marker = document.createElement('div');
      marker.className = 'salto-de-pagina-print';
      el.parentNode?.replaceChild(marker, el);
    });
    const bodyHtmlClean = limpiarNodosVaciosFinalesHtml(
      wrapSignatureBlocksForPrint(limpiarNodosVaciosFinalesHtml(tempWrap.innerHTML))
    );

    setIsExportingPDF(true);
    let offscreenHost: HTMLDivElement | null = null;

    try {
      offscreenHost = document.createElement('div');
      offscreenHost.style.position = 'fixed';
      offscreenHost.style.left = '-10000px';
      offscreenHost.style.top = '0';
      offscreenHost.style.width = '794px';
      offscreenHost.style.backgroundColor = '#ffffff';
      offscreenHost.style.color = '#000000';
      offscreenHost.style.zIndex = '-1';
      offscreenHost.style.pointerEvents = 'none';

      offscreenHost.innerHTML = `
        <style>
          .olga-pdf-sheet, .olga-pdf-sheet * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .olga-pdf-sheet {
            width: 794px;
            padding: 0 ${padRightPx}px 0 ${padLeftPx}px;
            background: #ffffff;
            color: #000000;
            font-family: ${effectiveFontCss};
            font-size: ${effectiveFontSizePt}pt;
            line-height: ${effectiveLineHeight};
            overflow-wrap: anywhere;
            word-break: break-word;
          }
          .olga-pdf-sheet p,
          .olga-pdf-sheet div:not(.olga-doc-membrete):not(.olga-doc-membrete-title):not(.salto-de-pagina-print) {
            margin: 0 0 8px 0;
            font-family: ${effectiveFontCss};
            font-size: ${effectiveFontSizePt}pt;
            line-height: ${effectiveLineHeight};
            overflow-wrap: anywhere;
            word-break: break-word;
            white-space: pre-wrap;
          }
          .olga-pdf-sheet p:last-child {
            margin-bottom: 0;
          }
          .olga-pdf-sheet [data-olga-page-spacer="true"] {
            margin-top: 0 !important;
          }
          @media print {
            [data-olga-page-spacer="true"] {
              margin-top: 0 !important;
            }
          }
          .olga-pdf-sheet h1, .olga-pdf-sheet h2, .olga-pdf-sheet h3, .olga-pdf-sheet h4 {
            margin: 0 0 10px 0;
            overflow-wrap: anywhere;
            word-break: break-word;
          }
          .olga-pdf-sheet strong, .olga-pdf-sheet b {
            font-weight: 700;
          }
          .olga-pdf-sheet hr {
            border: none;
            border-top: 1px solid #94a3b8;
            margin: 12px 0;
          }
          .olga-pdf-sheet img {
            max-width: 100% !important;
            height: auto !important;
            display: block;
            margin: 6px 0;
          }
          .olga-pdf-sheet table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: auto;
            margin: 8px 0;
          }
          .olga-pdf-sheet td, .olga-pdf-sheet th {
            border: 1px solid #cbd5e1;
            padding: 6px 8px;
            vertical-align: top;
            white-space: normal !important;
            overflow-wrap: anywhere !important;
            word-break: break-word !important;
          }
          .olga-pdf-sheet ul {
            list-style-type: disc;
            padding-left: 1.5rem;
            margin: 6px 0;
          }
          .olga-pdf-sheet ol {
            list-style-type: decimal;
            padding-left: 1.5rem;
            margin: 6px 0;
          }
          .olga-pdf-sheet li {
            margin-bottom: 4px;
            line-height: ${effectiveLineHeight};
            overflow-wrap: anywhere;
            word-break: break-word;
          }
          .olga-pdf-sheet .signature-block p {
            margin: 0 0 2px 0;
            line-height: ${effectiveLineHeight};
          }
          .olga-pdf-sheet .olga-doc-membrete,
          .olga-pdf-sheet .olga-doc-membrete * {
            white-space: normal !important;
          }
          .olga-pdf-sheet .olga-doc-membrete {
            text-align: center;
            border-bottom: 1px solid #94a3b8;
            padding-bottom: 8px;
            margin: 0 0 14px 0;
          }
          .olga-pdf-sheet .olga-doc-membrete-logo {
            display: block;
            margin: 0 auto 4px auto;
            max-height: 38px;
            width: auto;
            object-fit: contain;
          }
          .olga-pdf-sheet .olga-doc-membrete-title {
            font-family: ${effectiveFontCss};
            font-size: 12pt;
            font-weight: 700;
            letter-spacing: 0.03em;
            color: #0f172a;
            margin: 0 0 2px 0;
            line-height: 1.2;
          }
          .olga-pdf-sheet .olga-doc-membrete-sub {
            font-family: Arial, Helvetica, sans-serif !important;
            font-size: 8.5pt !important;
            line-height: 1.25 !important;
            text-align: center !important;
            white-space: normal !important;
            color: #475569 !important;
            margin: 0 !important;
          }
        </style>
        <div class="olga-pdf-sheet">${effectiveIncludeHeader ? buildMembreteHtml() : ''}${bodyHtmlClean}</div>
      `;

      document.body.appendChild(offscreenHost);
      const sheetEl = offscreenHost.querySelector('.olga-pdf-sheet') as HTMLElement;
      const imgs = Array.from(offscreenHost.querySelectorAll('img'));
      await waitForImagesInList(imgs, 4000);
      await new Promise((r) => setTimeout(r, 80));

      const canvas = await html2canvas(sheetEl, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 794,
      });

      const pageWidthMm = 210;
      const pageHeightMm = 297;
      const marginTopMm = marginCfg.topCm * 10;
      const marginBottomMm = marginCfg.bottomCm * 10;
      const usableHeightMm = Math.max(100, pageHeightMm - marginTopMm - marginBottomMm);
      const pxPerMm = canvas.width / pageWidthMm;
      const maxSliceHeightPx = Math.floor(usableHeightMm * pxPerMm);

      const isCanvasRegionBlank = (
        ctx: CanvasRenderingContext2D,
        yStart: number,
        height: number
      ): boolean => {
        try {
          const data = ctx.getImageData(0, yStart, canvas.width, height).data;
          // Muestreo rápido cada 4 píxeles
          for (let i = 0; i < data.length; i += 16) {
            if (data[i] < 248 || data[i + 1] < 248 || data[i + 2] < 248) {
              return false;
            }
          }
          return true;
        } catch {
          return false;
        }
      };

      const findCleanBreakY = (
        ctx: CanvasRenderingContext2D,
        idealY: number,
        minY: number
      ): number => {
        try {
          const searchWindow = Math.min(90, Math.floor((idealY - minY) * 0.25));
          for (let y = idealY; y > idealY - searchWindow; y -= 2) {
            const row = ctx.getImageData(0, y, canvas.width, 2).data;
            let rowWhite = true;
            for (let i = 0; i < row.length; i += 16) {
              if (row[i] < 246 || row[i + 1] < 246 || row[i + 2] < 246) {
                rowWhite = false;
                break;
              }
            }
            if (rowWhite) return y;
          }
        } catch {
          // Si no se puede leer pixels, usar corte exacto
        }
        return idealY;
      };

      const fullCtx = canvas.getContext('2d');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      let currentY = 0;
      let pageIndex = 0;

      while (currentY < canvas.height) {
        const remainingPx = canvas.height - currentY;
        const targetEnd =
          remainingPx <= maxSliceHeightPx
            ? canvas.height
            : fullCtx
              ? findCleanBreakY(fullCtx, currentY + maxSliceHeightPx, currentY)
              : currentY + maxSliceHeightPx;
        const sliceHeightPx = Math.max(1, targetEnd - currentY);

        if (fullCtx && isCanvasRegionBlank(fullCtx, currentY, sliceHeightPx)) {
          currentY += sliceHeightPx;
          continue;
        }

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHeightPx;
        const sliceCtx = sliceCanvas.getContext('2d');
        if (sliceCtx) {
          sliceCtx.fillStyle = '#ffffff';
          sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          sliceCtx.drawImage(
            canvas,
            0,
            currentY,
            canvas.width,
            sliceHeightPx,
            0,
            0,
            canvas.width,
            sliceHeightPx
          );
        }

        if (pageIndex > 0) {
          pdf.addPage();
        }
        const sliceHeightMm = sliceHeightPx / pxPerMm;
        const sliceImgData = sliceCanvas.toDataURL('image/png');
        pdf.addImage(sliceImgData, 'PNG', 0, marginTopMm, pageWidthMm, sliceHeightMm, undefined, 'FAST');

        pageIndex += 1;
        currentY += sliceHeightPx;
      }

      if (pageIndex === 0) {
        alert('No se detectó contenido visible para exportar a PDF.');
        return;
      }

      pdf.save(safeFileName);
    } catch (err) {
      console.error('Error generando PDF HTML:', err);
      alert('No se pudo generar el PDF. Intente nuevamente.');
    } finally {
      if (offscreenHost && offscreenHost.parentNode) {
        offscreenHost.parentNode.removeChild(offscreenHost);
      }
      setIsExportingPDF(false);
    }
  };

  // Modo de navegación: Redacción activa vs Archivo de Documentos
  const [activeSubTab, setActiveSubTab] = useState<'redaccion' | 'archivo'>('redaccion');

  // Visibilidad condicional del Editor
  const [mostrarEditor, setMostrarEditor] = useState<boolean>(false);

  // Estado del Redactor de Escritos
  const [textoLateral, setTextoLateral] = useState<string>('PARA REGISTROS PÚBLICOS - PROTOCOLO NOTARIAL');
  const [editorText, setEditorText] = useState<string>('');
  const editorTextRef = useRef<string>('');
  editorTextRef.current = editorText;
  const [documentTitle, setDocumentTitle] = useState<string>('Escrito en Blanco');
  const [selectedCategoryForSave, setSelectedCategoryForSave] = useState<string>('Contratos Privados');
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [saveSuccessBanner, setSaveSuccessBanner] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [copiedFeedback, setCopiedFeedback] = useState<boolean>(false);
  const [previewMode, setPreviewMode] = useState<boolean>(false);
  const [editorFontFamily, setEditorFontFamily] = useState<string>('Times New Roman');
  const [editorFontSizePt, setEditorFontSizePt] = useState<number>(12);
  const [editorLineHeight, setEditorLineHeight] = useState<string>('1.5');
  const [pageMargins, setPageMargins] = useState<EditorPageMargins>('normal');
  const [activeTextColor, setActiveTextColor] = useState<string>('#0f172a');
  const [isColorPaletteOpen, setIsColorPaletteOpen] = useState<boolean>(false);
  const savedColorRangeRef = useRef<Range | null>(null);

  // Estados de formato activo en la barra de herramientas del editor (queryCommandState)
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
    justifyFull: false,
    insertUnorderedList: false,
    insertOrderedList: false,
  });

  // Estados del Banner de Redacción con IA
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiAttachments, setAiAttachments] = useState<{ name: string; mimeType: string; data: string; size: number }[]>([]);
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [aiDraftProposal, setAiDraftProposal] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiBannerCollapsed, setAiBannerCollapsed] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docImportInputRef = useRef<HTMLInputElement>(null);
  const editorContentRef = useRef<HTMLDivElement>(null);
  const editorTextareaRef = editorContentRef;
  const membretePreviewRef = useRef<HTMLDivElement>(null);


  // =========================================================================
  // SISTEMA DE PAGINACIÓN VISUAL A4 (GUÍAS DE PANTALLA NO IMPRIMIBLES)
  // =========================================================================
  const [totalPaginasVisuales, setTotalPaginasVisuales] = useState<number>(1);
  const [visualPageBreaks, setVisualPageBreaks] = useState<{ page: number; topPx: number }[]>([]);
  const [isHeaderMenuExpanded, setIsHeaderMenuExpanded] = useState<boolean>(false);
  const debounceTimerRef = useRef<any>(null);

  const ALTURA_HOJA_OFICIO = 1056; // Altura estándar hoja Oficio / Legal (1056px)
  const ALTURA_TEXTO_UTIL = 820;   // Altura de texto útil por carilla (aprox. 22-25 líneas notariales)

  // Desempaquetador de seguridad: si un texto viejo fue fragmentado en divs hoja-notarial-pagina,
  // lo extrae de vuelta a un bloque de texto fluido continuo
  const desempaquetarContenidoFluido = (rawHtml: string): string => {
    if (!rawHtml || !rawHtml.trim()) return '';
    if (!rawHtml.includes('hoja-notarial-pagina')) return rawHtml;

    try {
      const temp = document.createElement('div');
      temp.innerHTML = rawHtml;
      const paginas = Array.from(temp.querySelectorAll('.hoja-notarial-pagina'));
      if (paginas.length > 0) {
        const fragment = document.createDocumentFragment();
        Array.from(temp.childNodes).forEach(node => {
          if ((node as HTMLElement).classList?.contains('hoja-notarial-pagina')) {
            while (node.firstChild) {
              fragment.appendChild(node.firstChild);
            }
          } else {
            fragment.appendChild(node);
          }
        });
        const result = document.createElement('div');
        result.appendChild(fragment);
        return result.innerHTML;
      }
    } catch (e) {
      console.warn('Error desempaquetando páginas:', e);
    }
    return rawHtml;
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    // Preserva párrafos, espacios iniciales/múltiples y tabulaciones
    const cleanHtml = text
      .split(/\r?\n/)
      .map((line) => `<p>${line.length > 0 ? escapeHtmlText(line) : '<br>'}</p>`)
      .join('');
    document.execCommand('insertHTML', false, cleanHtml);
    debouncedVerificarPaginacion();
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();

    try {
      if (fileName.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml(
          { arrayBuffer },
          {
            styleMap: ['u => u'],
            convertImage: mammoth.images.imgElement(async (image) => {
              const base64 = await image.readAsBase64String();
              const contentType = image.contentType || 'image/png';
              return { src: `data:${contentType};base64,${base64}` };
            }),
          }
        );
        let cleanHtml = limpiarNodosVaciosFinalesHtml((result?.value || '').trim());
        if (!cleanHtml) {
          const rawRes = await mammoth.extractRawText({ arrayBuffer });
          const rawText = rawRes?.value || '';
          cleanHtml = rawText
            .split(/\r?\n/)
            .map((line) => `<p>${line.length > 0 ? escapeHtmlText(line) : '<br>'}</p>`)
            .join('');
        }
        if (cleanHtml) {
          setEditorText(cleanHtml);
          if (editorContentRef.current) {
            editorContentRef.current.innerHTML = cleanHtml;
          }
          if (!documentTitle.trim() || documentTitle === 'Escrito en Blanco') {
            setDocumentTitle(file.name.replace(/\.docx$/i, ''));
          }
          debouncedVerificarPaginacion();
        } else {
          alert('El archivo Word (.docx) no contiene texto visible para importar.');
        }
      } else if (fileName.endsWith('.txt')) {
        const content = await file.text();
        if (content) {
          const cleanHtml = content
            .split(/\r?\n/)
            .map((line) => `<p>${line.length > 0 ? escapeHtmlText(line) : '<br>'}</p>`)
            .join('');
          setEditorText(cleanHtml);
          if (editorContentRef.current) {
            editorContentRef.current.innerHTML = cleanHtml;
          }
          if (!documentTitle.trim() || documentTitle === 'Escrito en Blanco') {
            setDocumentTitle(file.name.replace(/\.txt$/i, ''));
          }
          debouncedVerificarPaginacion();
        }
      } else if (fileName.endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n\n';
        }
        const cleanHtml = fullText
          .split(/\r?\n/)
          .filter((line) => line.trim() !== '')
          .map((line) => `<p>${escapeHtmlText(line)}</p>`)
          .join('');
        setEditorText(cleanHtml);
        if (editorContentRef.current) {
          editorContentRef.current.innerHTML = cleanHtml;
        }
        if (!documentTitle.trim() || documentTitle === 'Escrito en Blanco') {
          setDocumentTitle(file.name.replace(/\.pdf$/i, ''));
        }
        debouncedVerificarPaginacion();
      } else {
        alert('Formato no compatible. Selecciona un archivo .docx, .txt o .pdf.');
      }
    } catch (err) {
      console.error('Error al importar documento:', err);
      alert('No se pudo importar el archivo. Verifica que sea un documento .docx, .txt o .pdf válido.');
    } finally {
      if (docImportInputRef.current) {
        docImportInputRef.current.value = '';
      }
    }
  };

  const recalcularPaginacionVisual = (editorEl: HTMLElement) => {
    if (!editorEl) return 1;
    const PAGE_GAP_PX = 28;
    const sheetWidthPx = editorEl.offsetWidth || 850;
    const pxPerCm = sheetWidthPx / 21.0; // Ancho estándar A4 = 21.0 cm
    const pageTotalHeightPx = Math.round(sheetWidthPx * (29.7 / 21.0)); // Relación A4 = 297 / 210
    const activeMargin = PAGE_MARGIN_PROFILES[pageMarginsRef.current] || PAGE_MARGIN_PROFILES.normal;

    const marginTopPx = activeMargin.topCm * pxPerCm;
    const marginBottomPx = activeMargin.bottomCm * pxPerCm;
    const usableSinglePageHeightPx = Math.max(260, pageTotalHeightPx - marginTopPx - marginBottomPx);
    const headerHeightPx =
      includeHeaderRef.current && membretePreviewRef.current
        ? membretePreviewRef.current.offsetHeight
        : 0;

    // Limpiar espaciadores previos antes de recalcular
    editorEl.querySelectorAll('[data-olga-page-spacer], [style*="--olga-spacer-mt"]').forEach((node) => {
      const h = node as HTMLElement;
      h.removeAttribute('data-olga-page-spacer');
      h.style.removeProperty('--olga-spacer-mt');
      if (!(h.getAttribute('style') || '').trim()) {
        h.removeAttribute('style');
      }
    });

    const firstPageBottom = pageTotalHeightPx - headerHeightPx;
    const stride = PAGE_GAP_PX + pageTotalHeightPx;

    const getPageBottomEdge = (page: number) =>
      page === 1
        ? firstPageBottom
        : firstPageBottom + (page - 1) * stride;

    const getPageForY = (yPx: number): number => {
      if (yPx < firstPageBottom) return 1;
      return 2 + Math.floor((yPx - firstPageBottom) / stride);
    };

    const editorRect = editorEl.getBoundingClientRect();

    // Evaluar solo bloques hoja en listas anidadas (excluyente entre padre e hijos)
    const collectListItems = (listEl: HTMLElement): HTMLElement[] => {
      const items: HTMLElement[] = [];
      Array.from(listEl.children).forEach((liNode) => {
        const li = liNode as HTMLElement;
        const tag = li.tagName.toLowerCase();
        if (tag === 'ul' || tag === 'ol') {
          items.push(...collectListItems(li));
          return;
        }
        if (tag !== 'li') {
          items.push(li);
          return;
        }
        const nestedLists = Array.from(li.children).filter((subChild) => {
          const subTag = subChild.tagName.toLowerCase();
          return subTag === 'ul' || subTag === 'ol';
        }) as HTMLElement[];

        if (nestedLists.length > 0) {
          nestedLists.forEach((nested) => {
            items.push(...collectListItems(nested));
          });
        } else {
          items.push(li);
        }
      });
      return items;
    };

    const collectFlowBlocks = (container: Element): HTMLElement[] => {
      const blocks: HTMLElement[] = [];
      Array.from(container.children).forEach((child) => {
        const htmlChild = child as HTMLElement;
        const tag = htmlChild.tagName.toLowerCase();
        if ((tag === 'ul' || tag === 'ol') && htmlChild.children.length > 0) {
          const listRect = htmlChild.getBoundingClientRect();
          const hasNestedList = Boolean(htmlChild.querySelector('ul, ol'));
          if (listRect.height > 40 || hasNestedList) {
            blocks.push(...collectListItems(htmlChild));
            return;
          }
        }
        blocks.push(htmlChild);
      });
      return blocks;
    };

    const flowBlocks = collectFlowBlocks(editorEl);
    for (const el of flowBlocks) {
      const rect = el.getBoundingClientRect();
      if (rect.height === 0 && rect.width === 0) continue;

      const blockTop = rect.top - editorRect.top;
      const blockBottom = rect.bottom - editorRect.top;
      const page = getPageForY(blockTop);

      if (page > 1) {
        const prevPageBottom = getPageBottomEdge(page - 1);
        const prevNextPageStart = prevPageBottom + PAGE_GAP_PX + marginTopPx;
        if (blockTop >= prevPageBottom && blockTop < prevNextPageStart - 1) {
          const pushPx = Math.ceil(prevNextPageStart - blockTop);
          if (pushPx > 0) {
            el.setAttribute('data-olga-page-spacer', 'true');
            el.style.setProperty('--olga-spacer-mt', `${pushPx}px`);
          }
          continue;
        }
      }

      const pageBottom = getPageBottomEdge(page);
      const pageLimit = pageBottom - marginBottomPx;
      const nextPageStart = pageBottom + PAGE_GAP_PX + marginTopPx;

      if (
        (blockTop >= pageBottom && blockTop < nextPageStart - 1) ||
        (blockBottom > pageLimit && rect.height < usableSinglePageHeightPx)
      ) {
        const pushPx = Math.ceil(nextPageStart - blockTop);
        if (pushPx > 0) {
          el.setAttribute('data-olga-page-spacer', 'true');
          el.style.setProperty('--olga-spacer-mt', `${pushPx}px`);
        }
      }
    }

    let contentBottomPx = 0;
    try {
      const hasContent =
        (editorEl.textContent || '').replace(/[\u00A0\u200B]/g, '').trim().length > 0 ||
        Boolean(editorEl.querySelector('img, table, hr, svg'));
      if (hasContent && editorEl.childNodes.length > 0) {
        const updatedEditorRect = editorEl.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(editorEl);
        const contentRect = range.getBoundingClientRect();
        contentBottomPx = Math.max(0, contentRect.bottom - updatedEditorRect.top);
      }
    } catch {
      contentBottomPx = editorEl.scrollHeight;
    }

    let totalPages = 1;
    while (contentBottomPx > getPageBottomEdge(totalPages) + 2 && totalPages < 100) {
      totalPages += 1;
    }

    const breaks: { page: number; topPx: number }[] = [];
    for (let k = 1; k < totalPages; k += 1) {
      breaks.push({ page: k, topPx: Math.round(getPageBottomEdge(k)) });
    }

    editorEl.style.minHeight = `${Math.round(getPageBottomEdge(totalPages))}px`;
    setVisualPageBreaks(breaks);
    setTotalPaginasVisuales(totalPages);
    return totalPages;
  };

  const actualizarNumeracionPaginas = recalcularPaginacionVisual;

  const debouncedVerificarPaginacion = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (editorContentRef.current) {
        recalcularPaginacionVisual(editorContentRef.current);
      }
    }, 120);
  };

  // Inserción limpia de Salto de Página manual tipo Word / Docs
  const handleInsertarSaltoPagina = () => {
    const editor = editorContentRef.current;
    if (!editor) return;

    editor.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    const separator = document.createElement('div');
    separator.className = 'salto-de-pagina';
    separator.setAttribute('contenteditable', 'false');
    separator.setAttribute('data-page-break', 'manual');
    separator.innerHTML = `
      <div class="salto-de-pagina-badge">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-500"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
        <span>--- Salto de Página (Manual) ---</span>
      </div>
    `;

    const nextP = document.createElement('p');
    nextP.innerHTML = '<br>';

    range.deleteContents();
    range.insertNode(nextP);
    range.insertNode(separator);

    const newRange = document.createRange();
    newRange.setStart(nextP, 0);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);

    recalcularPaginacionVisual(editor);
    setEditorText(editor.innerHTML);
    nextP.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Callback ref estable para el contentEditable con desempaquetado de seguridad
  const setEditorRef = React.useCallback((el: HTMLDivElement | null) => {
    (editorContentRef as any).current = el;
    if (el) {
      try {
        document.execCommand('defaultParagraphSeparator', false, 'p');
      } catch (e) {}
      const latestText = editorTextRef.current;
      if (latestText) {
        const limpio = desempaquetarContenidoFluido(latestText);
        if (el.innerHTML !== limpio) {
          el.innerHTML = limpio;
        }
        setTimeout(() => {
          recalcularPaginacionVisual(el);
        }, 50);
      }
    }
  }, []);

  useEffect(() => {
    if (editorContentRef.current && editorText !== undefined) {
      // ABORTO DE SEGURIDAD: Si el editor tiene el foco, React NO debe sobrescribir el DOM
      if (document.activeElement === editorContentRef.current) return;
      
      const limpio = desempaquetarContenidoFluido(editorText);
      if (editorContentRef.current.innerHTML !== limpio) {
        editorContentRef.current.innerHTML = limpio;
        recalcularPaginacionVisual(editorContentRef.current);
      }
    }
  }, [editorText]);

  // Estado de la Lista de Escritos Guardados
  const [escritos, setEscritos] = useState<Escrito[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [searchFilter, setSearchFilter] = useState('');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [movingDoc, setMovingDoc] = useState<Escrito | null>(null);
  const [targetCategory, setTargetCategory] = useState<string>('');
  const [docToDelete, setDocToDelete] = useState<Escrito | null>(null);
  const [docToRename, setDocToRename] = useState<Escrito | null>(null);
  const [newDocName, setNewDocName] = useState<string>('');


  // Fase 8: Trazabilidad UX - Código de Soporte Técnico
  const [copiedSupportId, setCopiedSupportId] = useState<string | null>(null);
  const [supportCopiedToast, setSupportCopiedToast] = useState<string | null>(null);
  const [activeEditingDoc, setActiveEditingDoc] = useState<Escrito | null>(null);
  const [selectedPlantillaId, setSelectedPlantillaId] = useState<string>('');
  const [tipoHoja, setTipoHoja] = useState<'blanca' | 'protocolo'>('blanca');
  const [includeHeader, setIncludeHeader] = useState<boolean>(true);
  const esHojaEnBlanco = tipoHoja === 'blanca';
  const pageMarginsRef = useRef<EditorPageMargins>(pageMargins);
  pageMarginsRef.current = pageMargins;
  const includeHeaderRef = useRef<boolean>(includeHeader);
  includeHeaderRef.current = includeHeader;

  const handleCopiarCodigoSoporte = async (docObj: Escrito) => {
    const effectiveWorkspaceId = workspaceId || docObj.userId || currentUser?.uid || 'no-workspace';
    const correlativo = docObj.correlativo || String(docObj.id || '').slice(0, 4) || 'DOC';
    const textToCopy = `Solicitud Soporte O.L.G.A. | Workspace: ${effectiveWorkspaceId} | Pagaré ID: ${docObj.id} | Correlativo: ${correlativo}`;
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
      setCopiedSupportId(docObj.id);
      setSupportCopiedToast("Código de soporte copiado");
      setTimeout(() => setCopiedSupportId(null), 3000);
      setTimeout(() => setSupportCopiedToast(null), 3000);
    } catch (err) {
      console.error("Error al copiar código de soporte:", err);
    }
  };

  // Estado del Asistente Flotante de Autocompletado (Autofill Wizard)
  const [autofillInput, setAutofillInput] = useState<string>('');
  const [mostrarTooltipAyuda, setMostrarTooltipAyuda] = useState<boolean>(false);
  const autofillInputRef = useRef<HTMLInputElement>(null);

  // Historial de Estados para Deshacer / Retroceder en el Asistente Flotante
  const [historialTextos, setHistorialTextos] = useState<string[]>([]);
  const [skippedJudicialMarkers, setSkippedJudicialMarkers] = useState<string[]>([]);
  const [historialSkipped, setHistorialSkipped] = useState<string[][]>([]);

  // Diccionario de Memoria Global (Context-Awareness y Cálculos Automáticos)
  const [memoria, setMemoria] = useState<{
    denominacion?: string;
    capital?: number;
    capitalTotal?: number;
    capitalFormateado?: string;
    capitalLetras?: string;
    acciones?: number;
    totalAcciones?: number;
    accionesSuscriptas?: number;
    ultimaAccionesSocio?: number;
    valorNominal?: number;
    comparecientes?: string[];
    cedulas?: string[];
    [key: string]: any;
  }>({});

  // Modo de edición: saber si se está editando un documento existente abierto desde la grilla
  const [editandoDocumentoExistente, setEditandoDocumentoExistente] = useState<boolean>(false);

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Carga inicial del borrador local persistido
  useEffect(() => {
    try {
      const savedText = localStorage.getItem(LOCAL_STORAGE_DRAFT_TEXT);
      const savedPlantilla = localStorage.getItem(LOCAL_STORAGE_DRAFT_PLANTILLA);
      const savedTitle = localStorage.getItem(LOCAL_STORAGE_DRAFT_TITULO);
      const savedCat = localStorage.getItem(LOCAL_STORAGE_DRAFT_CATEGORIA);
      const savedTipoHoja = localStorage.getItem(LOCAL_STORAGE_DRAFT_TIPO_HOJA);
      const savedIncludeHeader = localStorage.getItem(LOCAL_STORAGE_DRAFT_INCLUDE_HEADER);
      const savedFontFamily = localStorage.getItem(LOCAL_STORAGE_DRAFT_FONT_FAMILY);
      const savedFontSize = localStorage.getItem(LOCAL_STORAGE_DRAFT_FONT_SIZE);
      const savedLineHeight = localStorage.getItem(LOCAL_STORAGE_DRAFT_LINE_HEIGHT);
      const savedPageMargins = localStorage.getItem(LOCAL_STORAGE_DRAFT_PAGE_MARGINS) as EditorPageMargins | null;

      if (savedPlantilla) {
        setSelectedPlantillaId(savedPlantilla);
      }
      if (savedTipoHoja) {
        setTipoHoja('blanca');
      } else {
        setTipoHoja('blanca');
      }
      if (savedIncludeHeader === 'false') {
        setIncludeHeader(false);
      } else {
        setIncludeHeader(true);
      }
      if (savedFontFamily && (EDITOR_FONT_FAMILIES as readonly string[]).includes(savedFontFamily)) {
        setEditorFontFamily(savedFontFamily);
      }
      if (savedFontSize) {
        const parsedSize = parseInt(savedFontSize, 10);
        if ((EDITOR_FONT_SIZES_PT as readonly number[]).includes(parsedSize)) {
          setEditorFontSizePt(parsedSize);
        }
      }
      if (savedLineHeight && EDITOR_LINE_HEIGHTS.some((lh) => lh.value === savedLineHeight)) {
        setEditorLineHeight(savedLineHeight);
      }
      if (savedPageMargins && PAGE_MARGIN_PROFILES[savedPageMargins]) {
        setPageMargins(savedPageMargins);
      }
      if (savedTitle) {
        setDocumentTitle(savedTitle);
      }
      if (savedCat) {
        setSelectedCategoryForSave(savedCat);
      }
      if (savedText !== null) {
        setEditorText(limpiarEspaciadoresVisualesHtml(savedText));
      } else {
        // Por defecto, Hoja en Blanco
        setEditorText('');
      }
    } catch (e) {
      console.warn('Error leyendo borrador local de redacción:', e);
    }
  }, []);

  // Persistencia local en cada cambio del editor
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(LOCAL_STORAGE_DRAFT_TEXT, limpiarEspaciadoresVisualesHtml(editorText));
        localStorage.setItem(LOCAL_STORAGE_DRAFT_PLANTILLA, selectedPlantillaId);
        localStorage.setItem(LOCAL_STORAGE_DRAFT_TITULO, documentTitle);
        localStorage.setItem(LOCAL_STORAGE_DRAFT_CATEGORIA, selectedCategoryForSave);
        localStorage.setItem(LOCAL_STORAGE_DRAFT_TIPO_HOJA, tipoHoja);
        localStorage.setItem(LOCAL_STORAGE_DRAFT_INCLUDE_HEADER, String(includeHeader));
        localStorage.setItem(LOCAL_STORAGE_DRAFT_FONT_FAMILY, editorFontFamily);
        localStorage.setItem(LOCAL_STORAGE_DRAFT_FONT_SIZE, String(editorFontSizePt));
        localStorage.setItem(LOCAL_STORAGE_DRAFT_LINE_HEIGHT, editorLineHeight);
        localStorage.setItem(LOCAL_STORAGE_DRAFT_PAGE_MARGINS, pageMargins);
      } catch (e) {
        console.warn('Error guardando borrador local:', e);
      }
    }, 400);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [editorText, selectedPlantillaId, documentTitle, selectedCategoryForSave, tipoHoja, includeHeader, editorFontFamily, editorFontSizePt, editorLineHeight, pageMargins]);

  // Sincronización del contentEditable con el estado de React editorText
  useEffect(() => {
    if (editorContentRef.current && editorText !== undefined) {
      if (document.activeElement === editorContentRef.current) return;
      const currentHtml = limpiarEspaciadoresVisualesHtml(editorContentRef.current.innerHTML);
      const currentText = editorContentRef.current.innerText;
      const limpio = desempaquetarContenidoFluido(editorText);
      if (currentHtml !== limpio && currentText !== editorText) {
        if (
          editorText.includes('<p') || 
          editorText.includes('<div') || 
          editorText.includes('<br') || 
          editorText.includes('<b') || 
          editorText.includes('<i') || 
          editorText.includes('<u') ||
          editorText.includes('<span') ||
          editorText.includes('<img') ||
          editorText.includes('<table') ||
          editorText.includes('<h') ||
          editorText.includes('<strong') ||
          editorText.includes('<ul') ||
          editorText.includes('<ol') ||
          editorText.includes('id="espacio-activo"')
        ) {
          editorContentRef.current.innerHTML = limpio;
          recalcularPaginacionVisual(editorContentRef.current);
        } else {
          editorContentRef.current.innerText = editorText;
        }
      }
    }
  }, [editorText]);

  // Consulta de formato activo en la selección del editor (queryCommandState)
  const checkFormatStates = () => {
    try {
      if (!document.hasFocus()) return;
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        justifyLeft: document.queryCommandState('justifyLeft'),
        justifyCenter: document.queryCommandState('justifyCenter'),
        justifyRight: document.queryCommandState('justifyRight'),
        justifyFull: document.queryCommandState('justifyFull'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        insertOrderedList: document.queryCommandState('insertOrderedList'),
      });
    } catch {
      // Silencioso, sin console.warn
    }
  };

  // Sincronizar estado de formato con el evento selectionchange
  useEffect(() => {
    const handleSelectionChange = () => {
      checkFormatStates();
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  // Recalcular guías visuales A4 cuando cambian márgenes, interlineado, fuente, tamaño o membrete
  useEffect(() => {
    if (!mostrarEditor) return;
    const timer = setTimeout(() => {
      if (editorContentRef.current) {
        recalcularPaginacionVisual(editorContentRef.current);
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [mostrarEditor, editorLineHeight, pageMargins, editorFontSizePt, editorFontFamily, includeHeader, previewMode]);

  // Recalcular automáticamente la paginación cuando cambia el ancho del editor o la ventana (ej. pantalla completa)
  useEffect(() => {
    if (!mostrarEditor) return;

    const handleWindowResize = () => {
      debouncedVerificarPaginacion();
    };
    window.addEventListener('resize', handleWindowResize);

    let observer: ResizeObserver | null = null;
    let rafId: number | null = null;

    const attachObserver = (el: HTMLElement) => {
      if (typeof ResizeObserver === 'undefined') return;
      let lastObservedWidth = el.offsetWidth;
      observer = new ResizeObserver(() => {
        const nextWidth = el.offsetWidth;
        if (Math.abs(nextWidth - lastObservedWidth) > 1) {
          lastObservedWidth = nextWidth;
          debouncedVerificarPaginacion();
        }
      });
      observer.observe(el);
    };

    if (editorContentRef.current) {
      attachObserver(editorContentRef.current);
    } else {
      rafId = requestAnimationFrame(() => {
        if (editorContentRef.current) {
          attachObserver(editorContentRef.current);
        }
      });
    }

    return () => {
      window.removeEventListener('resize', handleWindowResize);
      if (observer) {
        observer.disconnect();
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [mostrarEditor]);

  // Ejecutor de comandos de formato de texto enriquecido tipo Word (document.execCommand)
  const executeCommand = (command: string, value: string | undefined = undefined) => {
    try {
      if (editorContentRef.current) {
        editorContentRef.current.focus();
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || !editorContentRef.current.contains(selection.anchorNode)) {
          const range = document.createRange();
          range.selectNodeContents(editorContentRef.current);
          range.collapse(false);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }
      document.execCommand(command, false, value);
      if (editorContentRef.current) {
        setEditorText(editorContentRef.current.innerHTML);
        editorContentRef.current.focus();
      }
      setTimeout(checkFormatStates, 15);
    } catch (e) {
      console.warn('Error ejecutando comando de formato:', command, e);
    }
  };

  const handleApplyTextColor = (colorHex: string) => {
    try {
      const editor = editorContentRef.current;
      if (!editor) return;
      if (previewMode) setPreviewMode(false);
      editor.focus();

      const selection = window.getSelection();
      if (savedColorRangeRef.current && editor.contains(savedColorRangeRef.current.commonAncestorContainer)) {
        selection?.removeAllRanges();
        selection?.addRange(savedColorRangeRef.current);
      } else if (!selection || selection.rangeCount === 0 || !editor.contains(selection.anchorNode)) {
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }

      try {
        document.execCommand('styleWithCSS', false, 'true');
      } catch {
        // Ignorar si no es soportado
      }
      document.execCommand('foreColor', false, colorHex);
      setActiveTextColor(colorHex);
      setIsColorPaletteOpen(false);
      savedColorRangeRef.current = null;
      setEditorText(editor.innerHTML);
      editor.focus();
      setTimeout(checkFormatStates, 15);
    } catch (e) {
      console.warn('Error aplicando color de texto:', e);
    }
  };

  const handleInsertHorizontalRule = () => {
    try {
      const editor = editorContentRef.current;
      if (!editor) return;
      if (previewMode) setPreviewMode(false);
      editor.focus();

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || !editor.contains(selection.anchorNode)) {
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }

      const hrHtml = '<hr style="border: none; border-top: 1px solid #94a3b8; margin: 12px 0;" /><p><br></p>';
      document.execCommand('insertHTML', false, hrHtml);
      setEditorText(editor.innerHTML);
      debouncedVerificarPaginacion();
      editor.focus();
    } catch (e) {
      console.warn('Error insertando línea horizontal:', e);
    }
  };

  const handleAlign = (align: 'left' | 'center' | 'right' | 'justify') => {
    try {
      if (!editorContentRef.current) return;
      if (previewMode) {
        setPreviewMode(false);
      }
      editorContentRef.current.focus();

      const cmdMap = {
        left: 'justifyLeft',
        center: 'justifyCenter',
        right: 'justifyRight',
        justify: 'justifyFull'
      };

      try {
        document.execCommand(cmdMap[align], false, undefined);
      } catch (e) {
        // fallback
      }

      const selection = window.getSelection();
      let blockEl: HTMLElement | null = null;

      if (selection && selection.rangeCount > 0) {
        try {
          const range = selection.getRangeAt(0);
          let node: Node | null = range.commonAncestorContainer;
          while (node && node !== editorContentRef.current) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as HTMLElement;
              const tag = el.tagName.toLowerCase();
              if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote'].includes(tag)) {
                blockEl = el;
                break;
              }
            }
            node = node.parentNode;
          }
        } catch {}
      }

      if (blockEl) {
        blockEl.style.textAlign = align;
      } else {
        editorContentRef.current.style.textAlign = align;
        const children = editorContentRef.current.children;
        if (children.length > 0) {
          for (let i = 0; i < children.length; i++) {
            (children[i] as HTMLElement).style.textAlign = align;
          }
        }
      }

      setEditorText(editorContentRef.current.innerHTML);
      setTimeout(checkFormatStates, 15);
    } catch (e) {
      console.warn('Error alineando texto:', e);
    }
  };

  // Atajo de teclado ESC (Cerrar Editor Notarial y volver al Dashboard principal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mostrarEditor) {
        if (isAiModalOpen || isAdminModalOpen || movingDoc) {
          return;
        }
        setMostrarEditor(false);
        setSelectedPlantillaId('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mostrarEditor, isAiModalOpen, isAdminModalOpen, movingDoc]);

  // =========================================================================
  // MOTOR DE DETECCIÓN DE ESPACIOS EN BLANCO Y ASISTENTE (AUTOFILL WIZARD)
  // =========================================================================

  // Extraer texto plano actual para análisis de variables
  const currentPlainText = React.useMemo(() => {
    return editorText.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
  }, [editorText]);

  // Contar espacios en blanco totales y pendientes
  const blankMatches = React.useMemo(() => {
    if (
      (esPlayeroEsc && selectedPlantillaId.startsWith('playero_')) ||
      (esSectorPublicoBeta && selectedPlantillaId.startsWith('uoc_'))
    ) {
      return [];
    }
    const regex = /_{3,}/g;
    const matches: { index: number; length: number }[] = [];
    let match;
    while ((match = regex.exec(currentPlainText)) !== null) {
      if ((esPlayeroEsc || esSectorPublicoBeta) && match[0].length >= 15) continue;
      matches.push({ index: match.index, length: match[0].length });
    }
    return matches;
  }, [currentPlainText, esPlayeroEsc, esSectorPublicoBeta, selectedPlantillaId]);

  const usaMarcadoresCorchete = esAbogadoEsc || esPlayeroEsc || esSectorPublicoBeta;
  const marcadoresAbogadoPendientes = React.useMemo(() => {
    if (!usaMarcadoresCorchete) return [];
    return extraerMarcadoresJudiciales(editorText).filter(
      (k) => !skippedJudicialMarkers.includes(k)
    );
  }, [usaMarcadoresCorchete, editorText, skippedJudicialMarkers]);

  const isJudicialMarkersActive = usaMarcadoresCorchete && marcadoresAbogadoPendientes.length > 0;
  const totalBlanks = isJudicialMarkersActive ? marcadoresAbogadoPendientes.length : blankMatches.length;

  // =========================================================================
  // SINCRONIZACIÓN CONTEXTUAL DEL ASISTENTE (AUTOFILL WIZARD)
  // Analiza estrictamente las 3 o 4 palabras inmediatamente anteriores
  // al ÚNICO espacio que actualmente tiene el <span id="espacio-activo">,
  // ignorando los demás espacios vacíos del documento.
  // =========================================================================
  const currentBlankContext = React.useMemo<{
    instruccion: string;
    ayuda: string;
    placeholder: string;
    isJudicialMarker?: boolean;
    markerKey?: string;
  } | null>(() => {
    if (totalBlanks === 0) return null;

    if (isJudicialMarkersActive) {
      const markerKey = marcadoresAbogadoPendientes[0];
      const meta = getCampoMeta(markerKey);
      return {
        instruccion: meta.label,
        ayuda: meta.help,
        placeholder: meta.placeholder,
        isJudicialMarker: true,
        markerKey,
      };
    }

    if (esPlayeroEsc || esSectorPublicoBeta) {
      return {
        instruccion: 'Dato complementario',
        ayuda: esSectorPublicoBeta
          ? 'Complete este espacio con el dato requerido para el documento o legajo UOC.'
          : 'Complete este espacio con el dato requerido para el documento comercial.',
        placeholder: 'Ingrese el dato...',
      };
    }

    let textBeforeActive = '';
    let textAfterActive = '';

    if (editorText.includes('id="espacio-activo"')) {
      const idx = editorText.indexOf('id="espacio-activo"');
      const startTag = editorText.lastIndexOf('<span', idx);
      textBeforeActive = startTag !== -1 ? editorText.substring(0, startTag) : editorText.substring(0, idx);

      const closeTag = editorText.indexOf('</span>', idx);
      if (closeTag !== -1) {
        textAfterActive = editorText.substring(closeTag + 7, closeTag + 80);
      }
    } else {
      // Si aún no se ha inyectado el span en el DOM/estado, analizar el primer espacio vacío
      const match = editorText.match(/_{3,}/);
      if (match && match.index !== undefined) {
        textBeforeActive = editorText.substring(0, match.index);
        textAfterActive = editorText.substring(match.index + match[0].length, match.index + match[0].length + 80);
      } else {
        return null;
      }
    }

    // Limpieza estricta de HTML y entidades para extraer texto puro previo
    const plainBefore = textBeforeActive
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/[\r\n\t]+/g, ' ')
      .trim();

    // ESTRICTAMENTE los últimos 30 caracteres justo antes de la etiqueta (ignorando todo lo anterior)
    const textoPrevio = plainBefore.slice(-30).toLowerCase();

    const plainAfter = textAfterActive
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/[\r\n\t]+/g, ' ')
      .trim()
      .toLowerCase();

    // 1. REGLA ESTRICTA DE ESTADO CIVIL:
    // SOLO debe aplicarse si la palabra 'civil' está literalmente pegada al espacio en blanco
    // (ej. 'estado civil: _______', 'estado civil _______', 'civil _______')
    const esEstadoCivilPegado = /(?:estado\s+civil|civil)\s*[:\.]?\s*$/i.test(plainBefore);
    if (esEstadoCivilPegado) {
      return {
        instruccion: 'Insertar Estado Civil',
        ayuda: 'Estado civil legal: SOLTERO/A, CASADO/A, VIUDO/A o DIVORCIADO/A.',
        placeholder: 'Ej. SOLTERO / CASADO'
      };
    }

    // 2. VENTANA DE ANÁLISIS DE CONTEXTO INMEDIATO PREVIO
    // Se analizan los últimos caracteres para priorizar la palabra clave más cercana al espacio _______
    const windowText = plainBefore.slice(-120).toLowerCase();

    // Helper para medir la posición final (último índice) de un patrón en la ventana previa.
    // Cuanto mayor sea lastPos, más cerca se encuentra del espacio en blanco.
    const getLastIndex = (regex: RegExp): number => {
      let last = -1;
      let m: RegExpExecArray | null;
      const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
      const r = new RegExp(regex.source, flags);
      while ((m = r.exec(windowText)) !== null) {
        last = m.index + m[0].length;
      }
      return last;
    };

    interface ContextCandidate {
      pos: number;
      instruccion: string;
      ayuda: string;
      placeholder: string;
    }

    const candidates: ContextCandidate[] = [];

    // CÉDULA DE IDENTIDAD
    // Si el texto previo contiene la palabra 'Cédula', 'CI Nº', etc., se prioriza con su posición exacta
    const posCedula = getLastIndex(/(?:cédula|cedula|c\.i\.|ci\s*n[º°]|c\.i\s*n[º°]|identidad\s+civil\s*n[º°]|identidad\s*n[º°]|documento\s+de\s+identidad)/i);
    if (posCedula !== -1) {
      candidates.push({
        pos: posCedula,
        instruccion: 'Insertar Cédula de Identidad',
        ayuda: 'Número de Cédula de Identidad Civil paraguaya o documento de identidad del otorgante.',
        placeholder: 'Ej. 3.456.789'
      });
    }

    // COMPARECIENTES Y NOMBRES (don/doña, comparece, la otra parte, etc.)
    const posNombre = getLastIndex(/(?:don\/doña|don\b|doña\b|la\s+otra\s+parte|por\s+una\s+parte|comparecen\b|comparece\b|señor\/a|señor\b|señora\b)/i);
    if (posNombre !== -1) {
      if (windowText.includes('comprador')) {
        candidates.push({
          pos: posNombre,
          instruccion: 'Insertar Nombre del Comprador',
          ayuda: 'Nombres y apellidos completos de la parte compradora.',
          placeholder: 'Ej. MARÍA ELENA GONZÁLEZ'
        });
      } else if (windowText.includes('vendedor')) {
        candidates.push({
          pos: posNombre,
          instruccion: 'Insertar Nombre del Vendedor',
          ayuda: 'Nombres y apellidos completos de la parte vendedora.',
          placeholder: 'Ej. JUAN CARLOS PÉREZ GÓMEZ'
        });
      } else {
        candidates.push({
          pos: posNombre,
          instruccion: 'Insertar Nombre',
          ayuda: 'Nombres y apellidos completos según constan en el documento de identidad civil vigente.',
          placeholder: 'Ej. JUAN CARLOS PÉREZ GÓMEZ'
        });
      }
    }

    // SI LA SUSCRIPCIÓN INICIA JUSTO DESPUÉS DEL ESPACIO (ej. "a) _______ suscribe")
    if (plainAfter.startsWith('suscribe') || plainAfter.startsWith('suscriben')) {
      candidates.push({
        pos: windowText.length,
        instruccion: 'Insertar Nombre',
        ayuda: 'Nombres y apellidos completos del socio o compareciente suscriptor.',
        placeholder: 'Ej. JUAN CARLOS PÉREZ GÓMEZ'
      });
    }

    // DOMICILIO (Condición de contexto para domicilio o ciudad)
    const posDomicilio = getLastIndex(/(?:domiciliado\/a\s+en|domiciliado\s+en|domiciliada\s+en|domiciliado\/a|domiciliado\b|domiciliada\b|con\s+domicilio\s+en|domicilio\b|ciudad\s+de)/i);
    if (posDomicilio !== -1) {
      candidates.push({
        pos: posDomicilio,
        instruccion: 'Insertar Domicilio',
        ayuda: 'Dirección o domicilio real de la parte compareciente (calle, número y ciudad).',
        placeholder: 'Ej. CALLE PALMA Nº 452, ASUNCIÓN'
      });
    }

    // PROFESIÓN / OCUPACIÓN
    const posProfesion = getLastIndex(/(?:profesión|profesion|ocupación|ocupacion|de\s+profesión|de\s+profesion)/i);
    if (posProfesion !== -1) {
      candidates.push({
        pos: posProfesion,
        instruccion: 'Insertar Profesión',
        ayuda: 'Profesión, oficio u ocupación principal del compareciente.',
        placeholder: 'Ej. ABOGADO / COMERCIANTE / INGENIERO'
      });
    }

    // NACIONALIDAD
    const posNacionalidad = getLastIndex(/(?:nacionalidad|de\s+nacionalidad)/i);
    if (posNacionalidad !== -1) {
      candidates.push({
        pos: posNacionalidad,
        instruccion: 'Insertar Nacionalidad',
        ayuda: 'Nacionalidad de origen o adquirida del compareciente.',
        placeholder: 'Ej. PARAGUAYA'
      });
    }

    // PRESIDENTE DEL DIRECTORIO
    const posPresidente = getLastIndex(/(?:presidente|presidenta)/i);
    if (posPresidente !== -1) {
      candidates.push({
        pos: posPresidente,
        instruccion: 'Insertar Nombre del Presidente',
        ayuda: 'Nombre del compareciente designado como Presidente del Directorio.',
        placeholder: 'Ej. JUAN CARLOS PÉREZ GÓMEZ'
      });
    }

    // DIRECTOR TITULAR
    const posDirector = getLastIndex(/(?:director\s+titular|directora\s+titular|director\b|directora\b|vicepresidente)/i);
    if (posDirector !== -1) {
      candidates.push({
        pos: posDirector,
        instruccion: 'Insertar Director Titular',
        ayuda: 'Nombre del compareciente designado como Director Titular.',
        placeholder: 'Ej. MARÍA ELENA GONZÁLEZ'
      });
    }

    // SÍNDICO TITULAR
    const posSindico = getLastIndex(/(?:síndico\s+titular|sindico\s+titular|síndico\b|sindico\b)/i);
    if (posSindico !== -1) {
      candidates.push({
        pos: posSindico,
        instruccion: 'Insertar Síndico Titular',
        ayuda: 'Nombre del profesional o persona designada como Síndico Titular.',
        placeholder: 'Ej. LIC. CARLOS BENÍTEZ'
      });
    }

    // ESCRITURA NOTARIAL
    const posEscritura = getLastIndex(/(?:escritura\s+número|escritura\s+nº|escritura\s+n°|escritura\s+pública|escritura\b)/i);
    if (posEscritura !== -1) {
      candidates.push({
        pos: posEscritura,
        instruccion: 'Insertar Número de Escritura',
        ayuda: 'Número de orden correlativo de la escritura pública asignado por el Registro Notarial.',
        placeholder: 'Ej. 42 / Cuarenta y dos'
      });
    }

    // REGISTRO NOTARIAL
    const posRegistro = getLastIndex(/(?:registro\s+notarial|registro\s+nº|registro\s+n°)/i);
    if (posRegistro !== -1) {
      candidates.push({
        pos: posRegistro,
        instruccion: 'Insertar Número de Registro Notarial',
        ayuda: 'Número oficial asignado a la Escribanía / Registro Notarial ante la Corte Suprema de Justicia.',
        placeholder: 'Ej. 748'
      });
    }

    // DENOMINACIÓN SOCIAL
    const posDenominacion = getLastIndex(/(?:denominada|denominación|denominacion|denominará|denominara|razón\s+social|razon\s+social)/i);
    if (posDenominacion !== -1) {
      candidates.push({
        pos: posDenominacion,
        instruccion: 'Insertar Denominación o Razón Social',
        ayuda: 'Nombre de fantasía o denominación social de la Sociedad Anónima (sin incluir S.A.).',
        placeholder: 'Ej. AGRO INDUSTRIAL DEL ESTE'
      });
    }

    // ACCIONES SUSCRIPTAS
    const posSuscribe = getLastIndex(/(?:suscribe\b|suscriben\b)/i);
    if (posSuscribe !== -1 || plainAfter.startsWith('acciones')) {
      candidates.push({
        pos: posSuscribe !== -1 ? posSuscribe : windowText.length,
        instruccion: 'Insertar Cantidad de Acciones Suscriptas',
        ayuda: 'Número de acciones ordinarias que suscribe el compareciente.',
        placeholder: 'Ej. 50 / Cincuenta'
      });
    }

    // CANTIDAD TOTAL DE ACCIONES
    const posAcciones = getLastIndex(/(?:representado\s+por|total\s+de\s+acciones|cantidad\s+de\s+acciones|acciones\s+nominativas|acciones\b)/i);
    if (posAcciones !== -1) {
      candidates.push({
        pos: posAcciones,
        instruccion: 'Insertar Cantidad de Acciones',
        ayuda: 'Cantidad total de acciones emitidas de la sociedad.',
        placeholder: 'Ej. 100 / Cien'
      });
    }

    // VALOR NOMINAL POR ACCIÓN
    const posNominal = getLastIndex(/(?:valor\s+nominal|nominal\b)/i);
    if (posNominal !== -1) {
      candidates.push({
        pos: posNominal,
        instruccion: 'Insertar Valor Nominal por Acción',
        ayuda: 'Valor nominal individual asignado a cada acción en Guaraníes. Puede ingresar el número con puntos separadores de miles.',
        placeholder: 'Ej. 500.000'
      });
    }

    // MONTO SUSCRIPTO EN GUARANÍES
    const posMontoSuscripto = getLastIndex(/(?:representativas\s+de|representativa\s+de)/i);
    if (posMontoSuscripto !== -1) {
      candidates.push({
        pos: posMontoSuscripto,
        instruccion: 'Insertar Monto Suscripto en Guaraníes',
        ayuda: 'Monto en Guaraníes correspondiente a las acciones suscriptas. Puede ingresar el número con puntos separadores de miles.',
        placeholder: 'Ej. 250.000.000'
      });
    }

    // MONTO EN GUARANÍES (CIFRAS)
    const posGs = getLastIndex(/(?:gs\.|gs\b)/i);
    if (posGs !== -1) {
      candidates.push({
        pos: posGs,
        instruccion: 'Insertar Monto en Guaraníes (Cifras)',
        ayuda: 'Monto numérico en Guaraníes. Puede ingresar el número con puntos separadores de miles.',
        placeholder: 'Ej. 50.000.000'
      });
    }

    // MONTO / PRECIO / CAPITAL SOCIAL
    const posMonto = getLastIndex(/(?:guaraníes|guaranies|capital\s+social|suma\s+de|precio\b|monto\b)/i);
    if (posMonto !== -1) {
      const isMonetaryBlock = /^\s*(&nbsp;)?\s*\(\s*Gs\.?\s*_{3,}\s*\)/i.test(textAfterActive);
      candidates.push({
        pos: posMonto,
        instruccion: isMonetaryBlock ? 'Insertar Monto o Capital Social (Bloque Completo)' : 'Insertar Monto o Precio',
        ayuda: isMonetaryBlock
          ? 'Ingrese el monto en números (ej. 50.000.000). El sistema formateará y reemplazará automáticamente el bloque completo por: GUARANÍES CINCUENTA MILLONES (Gs. 50.000.000). Puede ingresar el número con puntos separadores de miles.'
          : 'Monto en Guaraníes. Si escribe números, se formatearán y convertirán automáticamente a letras. Puede ingresar el número con puntos separadores de miles.',
        placeholder: isMonetaryBlock ? 'Ej. 50.000.000' : 'Ej. 50.000.000 / CINCUENTA MILLONES'
      });
    }

    // INMUEBLES - FINCA O MATRÍCULA
    const posFinca = getLastIndex(/(?:finca\b|matrícula\b|matricula\b)/i);
    if (posFinca !== -1) {
      candidates.push({
        pos: posFinca,
        instruccion: 'Insertar Finca o Matrícula',
        ayuda: 'Número de Finca o Matrícula Inmobiliaria registrada ante la DGRP.',
        placeholder: 'Ej. Finca Nº 12.345'
      });
    }

    // INMUEBLES - PADRÓN
    const posPadron = getLastIndex(/(?:padrón\b|padron\b)/i);
    if (posPadron !== -1) {
      candidates.push({
        pos: posPadron,
        instruccion: 'Insertar Número de Padrón',
        ayuda: 'Número de Padrón Catastral del inmueble.',
        placeholder: 'Ej. Padrón Nº 8.910'
      });
    }

    // INMUEBLES - LOTE O MANZANA
    const posLote = getLastIndex(/(?:lote\b|manzana\b)/i);
    if (posLote !== -1) {
      candidates.push({
        pos: posLote,
        instruccion: 'Insertar Lote o Manzana',
        ayuda: 'Individualización de Lote o Manzana conforme al plano catastral.',
        placeholder: 'Ej. Lote 04'
      });
    }

    // INMUEBLES - DISTRITO O LOCALIDAD
    const posDistrito = getLastIndex(/(?:distrito\b|localidad\b)/i);
    if (posDistrito !== -1) {
      candidates.push({
        pos: posDistrito,
        instruccion: 'Insertar Distrito o Localidad',
        ayuda: 'Distrito o jurisdicción municipal donde se encuentra el inmueble.',
        placeholder: 'Ej. Distrito de San Lorenzo'
      });
    }

    // INMUEBLES - LINDEROS
    const posLinderos = getLastIndex(/(?:lindando\b|linderos\b|al\s+norte|al\s+sur|al\s+este|al\s+oeste)/i);
    if (posLinderos !== -1) {
      candidates.push({
        pos: posLinderos,
        instruccion: 'Insertar Lindero del Inmueble',
        ayuda: 'Nombre del propietario colindante o calle.',
        placeholder: 'Ej. Propiedad de Juan González'
      });
    }

    // INMUEBLES - MEDIDA O DIMENSIÓN
    const posMedida = getLastIndex(/(?:metros\b|mide\b)/i);
    if (posMedida !== -1) {
      candidates.push({
        pos: posMedida,
        instruccion: 'Insertar Medida o Dimensión',
        ayuda: 'Dimensión en metros lineales o superficie del terreno.',
        placeholder: 'Ej. 12,50'
      });
    }

    // INMUEBLES - INDIVIDUALIZACIÓN GENERAL
    const posBien = getLastIndex(/(?:siguiente\s+bien|objeto\b|inmueble\b)/i);
    if (posBien !== -1) {
      candidates.push({
        pos: posBien,
        instruccion: 'Insertar Individualización del Bien',
        ayuda: 'Descripción detallada o individualización registral del bien transferido.',
        placeholder: 'Ej. Inmueble individualizado con Finca Nº 12.345, Padrón 8.910...'
      });
    }

    // FECHAS - DÍA DEL OTORGAMIENTO
    const posDia = getLastIndex(/(?:días\b|dias\b|a\s+los\b)/i);
    if (posDia !== -1) {
      candidates.push({
        pos: posDia,
        instruccion: 'Insertar Día del Otorgamiento',
        ayuda: 'Día del mes en que se redacta el instrumento notarial.',
        placeholder: 'Ej. 15 / quince'
      });
    }

    // FECHAS - MES DE CELEBRACIÓN
    const posMes = getLastIndex(/(?:mes\s+de|mes\b)/i);
    if (posMes !== -1) {
      candidates.push({
        pos: posMes,
        instruccion: 'Insertar Mes de Celebración',
        ayuda: 'Nombre del mes correspondiente a la fecha de firma.',
        placeholder: 'Ej. octubre'
      });
    }

    // FECHAS - AÑO DE OTORGAMIENTO
    const posAnio = getLastIndex(/(?:año\s+de|del\s+año|del\s+ano|año\b|ano\b)/i);
    if (posAnio !== -1) {
      candidates.push({
        pos: posAnio,
        instruccion: 'Insertar Año de Otorgamiento',
        ayuda: 'Año de otorgamiento del instrumento notarial.',
        placeholder: 'Ej. 2026 / dos mil veintiséis'
      });
    }

    // CAMPOS DE CIERRE DE ESCRITURA MATRIZ (FIRMADOS, ANTE MÍ, SERIE, NÚMERO DE HOJA)
    const posFirmados = getLastIndex(/(?:firmados\s*[:\.]?|firmado\s*[:\.]?)/i);
    if (posFirmados !== -1) {
      candidates.push({
        pos: posFirmados,
        instruccion: 'Insertar Nombres de los Firmantes',
        ayuda: 'Nombres de los comparecientes que suscriben la escritura.',
        placeholder: 'Ej. JUAN PÉREZ Y MARÍA GÓMEZ'
      });
    }

    const posAnteMi = getLastIndex(/(?:ante\s+mí\s*[:\.]?|ante\s+mi\s*[:\.]?)/i);
    if (posAnteMi !== -1) {
      candidates.push({
        pos: posAnteMi,
        instruccion: 'Insertar Nombre del Escribano',
        ayuda: 'Nombre completo del Notario autorizante.',
        placeholder: 'Ej. ROGELIA ZARZA'
      });
    }

    const posSerie = getLastIndex(/(?:serie\s*["«']?|serie\b)/i);
    if (posSerie !== -1) {
      candidates.push({
        pos: posSerie,
        instruccion: 'Insertar Serie de Hoja de Seguridad',
        ayuda: 'Letras correspondientes a la serie del papel notarial.',
        placeholder: 'Ej. CQ'
      });
    }

    const posNumHoja = getLastIndex(/(?:n[º°o]\s*[:\.]?|número\s*[:\.]?)/i);
    if (posNumHoja !== -1 && windowText.includes('serie')) {
      candidates.push({
        pos: posNumHoja,
        instruccion: 'Insertar Número de Hoja',
        ayuda: 'Numeración oficial de la hoja de seguridad.',
        placeholder: 'Ej. 9488422'
      });
    }

    // SELECCIÓN POR PRIORIDAD DE PROXIMIDAD:
    // Se elige el candidato cuya palabra clave finaliza más cerca del espacio _______
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.pos - a.pos);
      const mejorCandidato = candidates[0];
      return {
        instruccion: mejorCandidato.instruccion,
        ayuda: mejorCandidato.ayuda,
        placeholder: mejorCandidato.placeholder
      };
    }

    // 3. LIMPIEZA DEL TÍTULO GENÉRICO (FALLBACK LIMPIO SIN RUIDO, SIN FECHAS Y SIN CARACTERES EXTRAÑOS)
    // Se limpia cualquier residuo con .replace() para descartar fechas (ej. 2026), saltos y símbolos
    const fragmentoLimpio = plainBefore
      .slice(-40)
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\b(año|ano)?\s*20\d{2}\b/gi, '') // Eliminar residuos de años/fechas como 2026
      .replace(/_{2,}/g, '') // Eliminar guiones bajos
      .replace(/[^\w\sáéíóúüñÁÉÍÓÚÜÑ]/g, ' ') // Eliminar signos extraños
      .replace(/\s+/g, ' ')
      .trim();

    return {
      instruccion: 'Completar campo faltante...',
      ayuda: fragmentoLimpio.length > 3
        ? `Complete el dato requerido para: "${fragmentoLimpio}".`
        : 'Complete el dato notarial correspondiente para continuar con el autocompletado del documento.',
      placeholder: 'Ingrese el dato requerido...'
    };
  }, [editorText, totalBlanks, isJudicialMarkersActive, marcadoresAbogadoPendientes]);

  // Mensaje o instrucción del asistente de autocompletado si hay espacios en blanco activos
  const mensajeAsistente = totalBlanks > 0 && currentBlankContext ? currentBlankContext.instruccion : null;

  const isRedaccionEnBlanco =
    selectedPlantillaId === 'hoja_en_blanco' ||
    (!selectedPlantillaId && esHojaEnBlanco);

  // Condición de Modo Autocompletado Activo:
  // Se oculta la cabecera completa si mensajeAsistente tiene algún valor (modo llenado paso a paso),
  // y solo se restaura cuando termina (mensajeAsistente === null / sin espacios pendientes) o al seleccionar 'Hoja en Blanco'.
  const condicionAutocompletado = Boolean(mensajeAsistente) && !isRedaccionEnBlanco;

  // Lógica inteligente de visibilidad de la barra de herramientas de formato de texto (Negrita, Cursiva, Alineación, Listas)
  // Oculta si el asistente flotante está activo con espacios pendientes.
  // Visible si:
  // 1. Es 'Hoja en Blanco (Redacción Libre)'
  // 2. Se está editando un documento existente (abierto desde la grilla)
  // 3. Se completó el 100% de los espacios en blanco (mensajeAsistente === null o totalBlanks === 0)
  const mostrarBarraHerramientas = 
    isRedaccionEnBlanco ||
    editandoDocumentoExistente ||
    totalBlanks === 0 ||
    !mensajeAsistente;

  // =========================================================================
  // MOTOR DE AUTOCOMPLETADO SILENCIOSO Y CÁLCULOS MATEMÁTICOS (CONTEXT-AWARENESS)
  // =========================================================================
  const intentarResolverEspacioSilencioso = (
    htmlContent: string,
    memoriaActual: Record<string, any>
  ): { resolved: boolean; newHtml: string; newMemoria: Record<string, any> } => {
    let startIndex = -1;
    let matchLength = 0;

    const spanMatch = htmlContent.match(/<span id="espacio-activo"[^>]*>.*?<\/span>/i);
    if (spanMatch && spanMatch.index !== undefined) {
      startIndex = spanMatch.index;
      matchLength = spanMatch[0].length;
    } else {
      const rawMatch = htmlContent.match(/_{3,}/);
      if (rawMatch && rawMatch.index !== undefined) {
        startIndex = rawMatch.index;
        matchLength = rawMatch[0].length;
      }
    }

    if (startIndex === -1) {
      return { resolved: false, newHtml: htmlContent, newMemoria: memoriaActual };
    }

    const textBefore = htmlContent.substring(0, startIndex);
    const textAfter = htmlContent.substring(startIndex + matchLength);

    const regexGsAfter = /^\s*(&nbsp;)?\s*\(\s*Gs\.?\s*_{3,}\s*\)/i;
    const matchGs = textAfter.match(regexGsAfter);

    const plainBefore = textBefore
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/[\r\n\t]+/g, ' ')
      .trim();

    const plainAfter = textAfter
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/[\r\n\t]+/g, ' ')
      .trim()
      .toLowerCase();

    const sanitizedWords = plainBefore
      .replace(/[,;:"'«»“”\(\)]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean);

    const last4Words = sanitizedWords.slice(-4).join(' ').toLowerCase();
    const last2Words = sanitizedWords.slice(-2).join(' ').toLowerCase();
    const lastWord = sanitizedWords.slice(-1).join(' ').toLowerCase();

    // 1. REGLA 1: AUTO-CÁLCULO DE VALOR NOMINAL (MATEMÁTICA AUTOMÁTICA)
    // Cuando el analizador de contexto detecte que el siguiente espacio corresponde al 'Valor nominal'
    // o 'Monto o Capital Social (Bloque Nominal)', el sistema DEBE calcular automáticamente:
    // memoria.capitalTotal / memoria.totalAcciones
    // Luego convertirá el resultado a formato GUARANÍES [LETRAS] (Gs. [NÚMEROS]) y lo inyectará directamente,
    // saltando la pregunta al usuario.
    const isValorNominal =
      last4Words.includes('valor nominal') ||
      last2Words.includes('valor nominal') ||
      lastWord === 'nominal';

    const capTotal = typeof memoriaActual.capitalTotal === 'number' && memoriaActual.capitalTotal > 0
      ? memoriaActual.capitalTotal
      : (typeof memoriaActual.capital === 'number' && memoriaActual.capital > 0 ? memoriaActual.capital : 0);

    const totAcc = typeof memoriaActual.totalAcciones === 'number' && memoriaActual.totalAcciones > 0
      ? memoriaActual.totalAcciones
      : (typeof memoriaActual.acciones === 'number' && memoriaActual.acciones > 0 ? memoriaActual.acciones : 0);

    if (isValorNominal && capTotal > 0 && totAcc > 0) {
      const valorNominal = Math.floor(capTotal / totAcc);
      const letras = numeroALetras(valorNominal);
      const numFormateado = valorNominal.toLocaleString('es-PY');
      const endsWithGuaranies = /(guaraníes|guaranies)\s*$/i.test(plainBefore);

      let textoFinal = '';
      let gsBlockLength = 0;

      if (matchGs) {
        gsBlockLength = matchGs[0].length;
        if (endsWithGuaranies) {
          textoFinal = `${letras} (Gs. ${numFormateado})`;
        } else {
          textoFinal = `GUARANÍES ${letras} (Gs. ${numFormateado})`;
        }
      } else {
        textoFinal = `${numFormateado} (${letras})`;
      }

      const newHtml = textBefore + textoFinal + textAfter.substring(gsBlockLength);
      const newMemoria = { ...memoriaActual, valorNominal, capitalTotal: capTotal, totalAcciones: totAcc };
      return { resolved: true, newHtml, newMemoria };
    }

    // 2. REGLA 2: AUTOCOMPLETADO SILENCIOSO - DENOMINACIÓN SOCIAL
    // Si el espacio requiere el Nombre de la Empresa y ya está en memoria:
    const isDenominacion =
      last4Words.includes('denominará') ||
      last4Words.includes('denominara') ||
      last4Words.includes('denominada') ||
      last4Words.includes('denominación') ||
      last4Words.includes('denominacion') ||
      (last4Words.includes('sociedad') && plainAfter.startsWith('s.a'));

    if (isDenominacion && memoriaActual.denominacion && memoriaActual.denominacion.trim().length > 0) {
      const newHtml = textBefore + memoriaActual.denominacion + textAfter;
      return { resolved: true, newHtml, newMemoria: memoriaActual };
    }

    // 3. REGLA 2: AUTOCOMPLETADO SILENCIOSO - COMPARECIENTES EN SUSCRIPCIÓN
    // Si en la suscripción se pide el nombre del socio (ej. "El socio Nº 1 _______ suscribe"):
    const isSuscripcionCompareciente =
      plainAfter.startsWith('suscribe') ||
      plainAfter.startsWith('suscriben');

    if (
      isSuscripcionCompareciente &&
      Array.isArray(memoriaActual.comparecientes) &&
      memoriaActual.comparecientes.length > 0
    ) {
      // Extraer el número del socio buscando la última mención de "socio" antes del espacio en blanco
      const lastSocioIdx = plainBefore.toLowerCase().lastIndexOf('socio');
      const socioSnippet = lastSocioIdx !== -1 ? plainBefore.substring(lastSocioIdx) : plainBefore;
      const matchSocioNum = socioSnippet.match(/socio\s+(?:n[º°o]\s*)?(\d+)/i) || plainBefore.match(/(\d+)[º°o]?\)\s*el\s+socio/i);
      const incisoMatch = plainBefore.match(/([a-z]|\d+)\)\s*$/i);
      let socioIndex = -1;

      if (matchSocioNum) {
        socioIndex = parseInt(matchSocioNum[1], 10) - 1;
      } else if (incisoMatch) {
        const letra = incisoMatch[1].toLowerCase();
        const alphabet = 'abcdefghijklmnopqrstuvwxyz';
        const foundIdx = alphabet.indexOf(letra);
        if (foundIdx !== -1) {
          socioIndex = foundIdx;
        } else if (/^\d+$/.test(letra)) {
          socioIndex = parseInt(letra, 10) - 1;
        }
      }

      if (socioIndex >= 0 && socioIndex < memoriaActual.comparecientes.length) {
        const nombreSocio = memoriaActual.comparecientes[socioIndex];
        const newHtml = textBefore + nombreSocio + textAfter;
        return { resolved: true, newHtml, newMemoria: memoriaActual };
      }
    }

    // 4. REGLA 2: CÁLCULO AUTOMÁTICO DE MONTO SUSCRIPTO POR SOCIO (ACCIONES * VALOR NOMINAL)
    // Cuando el usuario ingrese la cantidad de acciones que suscribe un socio (ej. 25),
    // el inmediatamente siguiente espacio de 'Monto en Guaraníes' debe ser autocompletado multiplicando 25 * memoria.valorNominal.
    const matchAccionesEnLinea = plainBefore.match(/(\d+[\d\.]*)\s+acciones\s+ordinarias,\s+representativas\s+de\s+(guaraníes|guaranies)?\s*$/i) ||
      plainBefore.match(/(\d+[\d\.]*)\s+acciones.*?representativas\s+de\s+(guaraníes|guaranies)?\s*$/i);

    const cantAccEncontrada = matchAccionesEnLinea
      ? parseInt(matchAccionesEnLinea[1].replace(/\./g, ''), 10)
      : (typeof memoriaActual.ultimaAccionesSocio === 'number' && memoriaActual.ultimaAccionesSocio > 0 ? memoriaActual.ultimaAccionesSocio : null);

    const isMontoSuscripcion = plainBefore.includes('representativas de') || last4Words.includes('representativas de') || last4Words.includes('representativa de');

    if (
      (matchAccionesEnLinea || isMontoSuscripcion) &&
      cantAccEncontrada &&
      typeof memoriaActual.valorNominal === 'number' &&
      memoriaActual.valorNominal > 0
    ) {
      const montoSocio = cantAccEncontrada * memoriaActual.valorNominal;
      const letras = numeroALetras(montoSocio);
      const numForm = montoSocio.toLocaleString('es-PY');
      const endsWithGuaranies = /(guaraníes|guaranies)\s*$/i.test(plainBefore);

      let textoFinal = '';
      let gsBlockLength = 0;
      if (matchGs) {
        gsBlockLength = matchGs[0].length;
        if (endsWithGuaranies) {
          textoFinal = `${letras} (Gs. ${numForm})`;
        } else {
          textoFinal = `GUARANÍES ${letras} (Gs. ${numForm})`;
        }
      } else {
        textoFinal = `${numForm} (${letras})`;
      }

      const newHtml = textBefore + textoFinal + textAfter.substring(gsBlockLength);
      const newMemoria = { ...memoriaActual, ultimaAccionesSocio: undefined };
      return { resolved: true, newHtml, newMemoria };
    }

    // 5. RECICLAJE DE NOMBRES EN DISPOSICIONES TRANSITORIAS (PRIMER DIRECTORIO)
    // En el apartado de Disposiciones Transitorias (donde se designa el primer Directorio),
    // el código debe recuperar automáticamente los nombres de los socios guardados en el estado memoria (memoria.comparecientes)
    // e inyectarlos directamente en el texto como Presidente y Directores Titulares, sin volver a preguntarle al usuario.
    const ultimos35 = plainBefore.slice(-35).toLowerCase();

    const isDesignacionPresidente =
      ultimos35.includes('presidente del directorio') ||
      ultimos35.includes('presidente:') ||
      (ultimos35.includes('presidente') && plainBefore.toLowerCase().includes('transitorias'));

    if (
      isDesignacionPresidente &&
      Array.isArray(memoriaActual.comparecientes) &&
      memoriaActual.comparecientes.length > 0
    ) {
      const nombrePresidente = memoriaActual.comparecientes[0];
      const newHtml = textBefore + nombrePresidente + textAfter;
      return { resolved: true, newHtml, newMemoria: memoriaActual };
    }

    const isDesignacionDirector =
      (ultimos35.includes('director titular') ||
       ultimos35.includes('directores titulares') ||
       (ultimos35.includes('director') && plainBefore.toLowerCase().includes('transitorias'))) &&
      !ultimos35.includes('presidente');

    if (
      isDesignacionDirector &&
      Array.isArray(memoriaActual.comparecientes) &&
      memoriaActual.comparecientes.length > 0
    ) {
      // Si hay más socios, asigna el socio 2 (o sucesivos según la cantidad de directores ya inyectados)
      const matchesDirectores = plainBefore.match(/director titular:\s*don\/doña\s+([^;]+)/gi) || [];
      const indexSocio = 1 + matchesDirectores.length;
      const nombreDirector = memoriaActual.comparecientes[indexSocio] || memoriaActual.comparecientes[1] || memoriaActual.comparecientes[0];
      const newHtml = textBefore + nombreDirector + textAfter;
      return { resolved: true, newHtml, newMemoria: memoriaActual };
    }

    return { resolved: false, newHtml: htmlContent, newMemoria: memoriaActual };
  };

  // =========================================================================
  // FOCO VISUAL, SINCRONIZACIÓN Y AUTO-SCROLL CONTEXTUAL
  // =========================================================================

  // Resaltado visual del espacio en blanco activo con resolución silenciosa previa:
  useEffect(() => {
    if (!mostrarEditor || isRedaccionEnBlanco) return;

    if (isJudicialMarkersActive) {
      const firstKey = marcadoresAbogadoPendientes[0];
      const token = `[${firstKey}]`;
      if (editorText.includes(token) && !editorText.includes('id="espacio-activo"')) {
        const idx = editorText.indexOf(token);
        const textoConMarcadorActivo =
          editorText.slice(0, idx) +
          `<span id="espacio-activo" class="bg-yellow-300/50 animate-pulse rounded px-1">${token}</span>` +
          editorText.slice(idx + token.length);
        setEditorText(textoConMarcadorActivo);
        if (editorContentRef.current) {
          editorContentRef.current.innerHTML = textoConMarcadorActivo;
        }
      }
      return;
    }

    if (esPlayeroEsc || esSectorPublicoBeta) {
      if (blankMatches.length > 0 && !editorText.includes('id="espacio-activo"')) {
        const re = /_{3,}/g;
        let matchBlank: RegExpExecArray | null = null;
        while ((matchBlank = re.exec(editorText)) !== null) {
          if (matchBlank[0].length < 15) break;
        }
        if (matchBlank && matchBlank.index !== undefined) {
          const textoConEspacioActivo =
            editorText.slice(0, matchBlank.index) +
            `<span id="espacio-activo" class="bg-yellow-300/50 animate-pulse rounded px-1">${matchBlank[0]}</span>` +
            editorText.slice(matchBlank.index + matchBlank[0].length);
          setEditorText(textoConEspacioActivo);
          if (editorContentRef.current) {
            editorContentRef.current.innerHTML = textoConEspacioActivo;
          }
        }
      }
      return;
    }

    // Si hay espacios en blanco pendientes, verificar si alguno se puede resolver silenciosamente
    if (/_{3,}/.test(editorText)) {
      const res = intentarResolverEspacioSilencioso(editorText, memoria);
      if (res.resolved) {
        let finalHtml = res.newHtml;
        let finalMem = res.newMemoria;
        let maxIt = 15;
        while (maxIt > 0) {
          maxIt--;
          const nextRes = intentarResolverEspacioSilencioso(finalHtml, finalMem);
          if (nextRes.resolved) {
            finalHtml = nextRes.newHtml;
            finalMem = nextRes.newMemoria;
          } else {
            break;
          }
        }

        if (/_{3,}/.test(finalHtml) && !finalHtml.includes('id="espacio-activo"')) {
          finalHtml = finalHtml.replace(
            /_{3,}/,
            '<span id="espacio-activo" class="bg-yellow-300/50 animate-pulse rounded px-1">$&</span>'
          );
        }

        setEditorText(finalHtml);
        setMemoria(finalMem);
        if (editorContentRef.current) {
          editorContentRef.current.innerHTML = finalHtml;
        }
        return;
      }
    }

    if (/_{3,}/.test(editorText) && !editorText.includes('id="espacio-activo"')) {
      const textoConEspacioActivo = editorText.replace(
        /_{3,}/,
        '<span id="espacio-activo" class="bg-yellow-300/50 animate-pulse rounded px-1">$&</span>'
      );
      setEditorText(textoConEspacioActivo);
      if (editorContentRef.current) {
        editorContentRef.current.innerHTML = textoConEspacioActivo;
      }
    }
  }, [mostrarEditor, isRedaccionEnBlanco, editorText, memoria, isJudicialMarkersActive, marcadoresAbogadoPendientes, esPlayeroEsc, esSectorPublicoBeta, blankMatches.length]);

  // Auto-Scroll Contextual (Acompañamiento Dinámico):
  useEffect(() => {
    if (!mostrarEditor || totalBlanks === 0) return;

    const timer = setTimeout(() => {
      const espacioActivo = document.getElementById('espacio-activo');
      if (espacioActivo) {
        espacioActivo.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [totalBlanks, currentBlankContext?.instruccion, mostrarEditor]);

  // Auto-Focus Directo al Asistente Flotante (Flujo de Teclado Continuo):
  // Ejecuta un .focus() manual sobre autofillInputRef cada vez que el estado mensajeAsistente
  // (o el título/instrucción de la ventanita) cambie, asegurando que el cursor no quede atascado en el contentEditable.
  useEffect(() => {
    if (mostrarEditor && condicionAutocompletado && mensajeAsistente) {
      const focusTimer = setTimeout(() => {
        if (autofillInputRef.current) {
          autofillInputRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(focusTimer);
    }
  }, [mensajeAsistente, currentBlankContext?.instruccion, mostrarEditor, condicionAutocompletado]);

  // =========================================================================
  // HISTORIAL DE ESTADOS Y DESHACER (RETROCEDER) DEL ASISTENTE FLOTANTE
  // =========================================================================
  const handleRetroceder = () => {
    if (historialTextos.length === 0) return;
    const nuevoHistorial = [...historialTextos];
    const textoPrevio = nuevoHistorial.pop();
    setHistorialTextos(nuevoHistorial);

    if (historialSkipped.length > 0) {
      const nuevoSkippedHist = [...historialSkipped];
      const skippedPrevio = nuevoSkippedHist.pop();
      setHistorialSkipped(nuevoSkippedHist);
      if (skippedPrevio !== undefined) {
        setSkippedJudicialMarkers(skippedPrevio);
      }
    }

    if (textoPrevio !== undefined) {
      setEditorText(textoPrevio);
      if (editorContentRef.current) {
        editorContentRef.current.innerHTML = textoPrevio;
      }
      setAutofillInput('');
      setMostrarTooltipAyuda(false);
      setTimeout(() => {
        const espacioActivo = document.getElementById('espacio-activo');
        if (espacioActivo) {
          espacioActivo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        autofillInputRef.current?.focus();
      }, 100);
    }
  };

  const unwrapEspacioActivo = (rawHtml: string): string => {
    if (!rawHtml || !rawHtml.includes('espacio-activo')) return rawHtml;
    try {
      const tmp = document.createElement('div');
      tmp.innerHTML = rawHtml;
      tmp.querySelectorAll('#espacio-activo').forEach((el) => {
        const parent = el.parentNode;
        if (!parent) return;
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
      });
      return tmp.innerHTML;
    } catch {
      return rawHtml.replace(/<span\b[^>]*\bid=["']?espacio-activo["']?[^>]*>([\s\S]*?)<\/span>/gi, '$1');
    }
  };

  const PLAYERO_UPPER_BOLD_KEYS = new Set<string>([
    'COMPRADOR',
    'ADQUIRENTE',
    'RECEPTOR',
    'TITULAR',
    'CLIENTE',
    'CONDUCTOR_AUTORIZADO',
    'NOMBRE_VENDEDOR_PLAYA',
    'CI_COMPRADOR',
    'CI_CONDUCTOR',
    'RUC_PLAYA',
    'MARCA_MODELO',
    'MARCA',
    'MODELO',
    'COLOR',
    'CHASIS',
    'CHAPA',
    'MATRICULA',
    'MOTOR',
    'ANO',
    'MONTO_LETRAS',
    'PRECIO_LETRAS',
    'MONTO_SENA_LETRAS',
    'CIUDAD',
    'DOMICILIO_COMPRADOR',
    'DOMICILIO_CONDUCTOR',
    'DOMICILIO_PLAYA',
  ]);

  const reemplazarMarcadorJudicial = (rawHtml: string, markerKey: string, value: string): string => {
    const escapedKey = markerKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const markerRegex = new RegExp(
      `\\[(?:\\s|<[^>]+>|&nbsp;)*${escapedKey}(?:\\s|<[^>]+>|&nbsp;)*\\]`,
      'g'
    );
    const UOC_UPPER_BOLD_KEYS = new Set<string>([
      'PROVEEDOR',
      'NRO_CONTRATO',
      'ID_DNCP',
      'MONTO_LETRAS',
      'MONTO_AMPLIACION_LETRAS',
    ]);
    const shouldUpperBold =
      (esPlayeroEsc && PLAYERO_UPPER_BOLD_KEYS.has(markerKey)) ||
      (esSectorPublicoBeta && UOC_UPPER_BOLD_KEYS.has(markerKey));
    const formattedHtml = shouldUpperBold
      ? `<strong>${escapeHtmlText(value.toUpperCase())}</strong>`
      : escapeHtmlText(value);
    return rawHtml.replace(markerRegex, formattedHtml);
  };

  const handleOmitirMarcador = () => {
    if (!currentBlankContext?.isJudicialMarker || !currentBlankContext.markerKey) return;
    const markerKey = currentBlankContext.markerKey;
    const container = editorContentRef.current;
    const htmlBase = container ? container.innerHTML : editorText;

    setHistorialTextos((prev) => [...prev, htmlBase]);
    setHistorialSkipped((prev) => [...prev, skippedJudicialMarkers]);

    const nextSkipped = [...skippedJudicialMarkers, markerKey];
    setSkippedJudicialMarkers(nextSkipped);

    let iterHtml = unwrapEspacioActivo(htmlBase);
    const remaining = extraerMarcadoresJudiciales(iterHtml).filter((k) => !nextSkipped.includes(k));
    if (remaining.length > 0) {
      const nextToken = `[${remaining[0]}]`;
      const idx = iterHtml.indexOf(nextToken);
      if (idx !== -1) {
        iterHtml =
          iterHtml.slice(0, idx) +
          `<span id="espacio-activo" class="bg-yellow-300/50 animate-pulse rounded px-1">${nextToken}</span>` +
          iterHtml.slice(idx + nextToken.length);
      }
    }

    if (container) {
      container.innerHTML = iterHtml;
    }
    setEditorText(iterHtml);
    setAutofillInput('');
    setMostrarTooltipAyuda(false);
    debouncedVerificarPaginacion();

    if (remaining.length === 0) {
      setTimeout(() => {
        const bloque = document.getElementById('editor-notarial-activo-bloque');
        bloque?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } else {
      setTimeout(() => {
        autofillInputRef.current?.focus();
      }, 50);
    }
  };

  // =========================================================================
  // INYECCIÓN DE DATOS: MOTOR INTERCEPTOR, SMART REPLACE Y MEMORIA GLOBAL
  // =========================================================================
  const handleAplicarAutofill = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const valorOriginal = autofillInput.trim();
    if (!valorOriginal) return;

    // Guardar copia exacta del texto actual en el historial de estados antes de la inyección
    const container = editorContentRef.current;
    const htmlBase = container ? container.innerHTML : editorText;
    setHistorialTextos(prev => [...prev, htmlBase]);

    // FLUJO DEDICADO PARA MARCADORES JUDICIALES [CAMPO] (SOLO ABOGADOS)
    if (currentBlankContext?.isJudicialMarker && currentBlankContext.markerKey) {
      const markerKey = currentBlankContext.markerKey;
      setHistorialSkipped((prev) => [...prev, skippedJudicialMarkers]);

      let iterHtml = unwrapEspacioActivo(htmlBase);
      iterHtml = reemplazarMarcadorJudicial(iterHtml, markerKey, valorOriginal);

      const nextMarkers = extraerMarcadoresJudiciales(iterHtml).filter(
        (k) => !skippedJudicialMarkers.includes(k)
      );

      if (nextMarkers.length > 0) {
        const nextToken = `[${nextMarkers[0]}]`;
        const idx = iterHtml.indexOf(nextToken);
        if (idx !== -1) {
          iterHtml =
            iterHtml.slice(0, idx) +
            `<span id="espacio-activo" class="bg-yellow-300/50 animate-pulse rounded px-1">${nextToken}</span>` +
            iterHtml.slice(idx + nextToken.length);
        }
      }

      if (container) {
        container.innerHTML = iterHtml;
      }
      setEditorText(iterHtml);
      debouncedVerificarPaginacion();
      setMostrarTooltipAyuda(false);

      let nextSuggestedInput = '';
      const montoALetrasPairs: Record<string, string> = {
        MONTO_RECLAMADO: 'MONTO_LETRAS',
        PRECIO_TOTAL: 'PRECIO_LETRAS',
        MONTO_SENA: 'MONTO_SENA_LETRAS',
        MONTO_ESTIMADO: 'MONTO_LETRAS',
        MONTO_AMPLIACION: 'MONTO_AMPLIACION_LETRAS',
      };
      if (montoALetrasPairs[markerKey] && nextMarkers[0] === montoALetrasPairs[markerKey]) {
        const soloDigitosAbg = valorOriginal.replace(/\./g, '').replace(/,/g, '').replace(/\s+/g, '').trim();
        if (/^\d+$/.test(soloDigitosAbg) && soloDigitosAbg.length > 0) {
          const numAbg = parseInt(soloDigitosAbg, 10);
          if (Number.isFinite(numAbg) && numAbg > 0) {
            nextSuggestedInput = numeroALetras(numAbg);
          }
        }
      }
      setAutofillInput(nextSuggestedInput);

      if (nextMarkers.length === 0) {
        setTimeout(() => {
          const bloque = document.getElementById('editor-notarial-activo-bloque');
          bloque?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      } else {
        setTimeout(() => {
          autofillInputRef.current?.focus();
        }, 50);
      }
      return;
    }

    // 1. MOTOR INTERCEPTOR DE NÚMEROS A LETRAS
    const soloDigitos = valorOriginal.replace(/\./g, '').replace(/,/g, '').replace(/\s+/g, '').trim();
    const esNumeroPuro = /^\d+$/.test(soloDigitos) && soloDigitos.length > 0;

    let textoFinal = '';
    let numVal = 0;
    let letras = '';
    let numFormateado = '';

    if (esNumeroPuro) {
      numVal = parseInt(soloDigitos, 10);
      numFormateado = numVal.toLocaleString('es-PY');
      letras = numeroALetras(numVal);
      // Formato legal notarial requerido: 50.000.000 (CINCUENTA MILLONES)
      textoFinal = `${numFormateado} (${letras})`;
    } else {
      textoFinal = valorOriginal.toUpperCase();
    }

    // 2. ACTUALIZACIÓN DEL DICCIONARIO DE MEMORIA (REGLA 1 & REGLA 2)
    const nuevaMemoria: Record<string, any> = { ...memoria };
    const instruccionActual = currentBlankContext?.instruccion || '';

    if (
      instruccionActual.includes('Denominación') ||
      instruccionActual.includes('Razón Social')
    ) {
      const denomLimpia = valorOriginal.toUpperCase().replace(/\s+S\.?A\.?$/i, '').trim();
      nuevaMemoria.denominacion = denomLimpia;
    } else if (
      (instruccionActual.includes('Monto') || instruccionActual.includes('Capital Social')) &&
      esNumeroPuro
    ) {
      nuevaMemoria.capital = numVal;
      nuevaMemoria.capitalTotal = numVal;
      nuevaMemoria.capitalFormateado = numFormateado;
      nuevaMemoria.capitalLetras = letras;
    } else if (
      instruccionActual.includes('Cantidad de Acciones') &&
      !instruccionActual.includes('Suscriptas') &&
      esNumeroPuro
    ) {
      nuevaMemoria.acciones = numVal;
      nuevaMemoria.totalAcciones = numVal;
    } else if (
      instruccionActual.includes('Cantidad de Acciones Suscriptas') &&
      esNumeroPuro
    ) {
      nuevaMemoria.accionesSuscriptas = numVal;
      nuevaMemoria.ultimaAccionesSocio = numVal;
    } else if (
      (instruccionActual.includes('Compareciente') || instruccionActual.includes('Nombre')) &&
      !instruccionActual.includes('Presidente') &&
      !instruccionActual.includes('Director') &&
      !instruccionActual.includes('Síndico') &&
      !instruccionActual.includes('Escribano') &&
      !instruccionActual.includes('Firmantes')
    ) {
      const socioUpper = valorOriginal.toUpperCase().trim();
      const socios = [...(nuevaMemoria.comparecientes || [])];
      if (!socios.includes(socioUpper)) {
        socios.push(socioUpper);
      }
      nuevaMemoria.comparecientes = socios;
    } else if (
      instruccionActual.includes('Valor Nominal') &&
      esNumeroPuro
    ) {
      nuevaMemoria.valorNominal = numVal;
    }

    // 3. INYECCIÓN LIMPIA CON SMART REPLACE (REGLA 3: Inyección de Bloques Monetarios)
    // Si el asistente pide un monto y el documento tiene el formato GUARANÍES _______ (Gs. _______) o similar,
    // al ingresar un número (ej. 50000000), formatea y reemplaza el bloque completo por
    // GUARANÍES CINCUENTA MILLONES (Gs. 50.000.000), evitando espacios residuales o duplicaciones.

    let startIndex = -1;
    let matchLength = 0;

    const spanMatch = htmlBase.match(/<span id="espacio-activo"[^>]*>.*?<\/span>/i);
    if (spanMatch && spanMatch.index !== undefined) {
      startIndex = spanMatch.index;
      matchLength = spanMatch[0].length;
    } else {
      const rawMatch = htmlBase.match(/_{3,}/);
      if (rawMatch && rawMatch.index !== undefined) {
        startIndex = rawMatch.index;
        matchLength = rawMatch[0].length;
      }
    }

    let nuevoHtml = '';
    if (startIndex !== -1) {
      const textBefore = htmlBase.substring(0, startIndex);
      const textAfter = htmlBase.substring(startIndex + matchLength);

      const regexGs = /^\s*(&nbsp;)?\s*\(\s*Gs\.?\s*_{3,}\s*\)/i;
      const matchGs = textAfter.match(regexGs);

      const plainBefore = textBefore
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/[\r\n\t]+/g, ' ')
        .trim();

      const endsWithGuaranies = /(guaraníes|guaranies)\s*$/i.test(plainBefore);

      if (matchGs && esNumeroPuro) {
        const gsBlockLength = matchGs[0].length;
        const bloqueMonetario = endsWithGuaranies
          ? `${letras} (Gs. ${numFormateado})`
          : `GUARANÍES ${letras} (Gs. ${numFormateado})`;
        nuevoHtml = textBefore + bloqueMonetario + textAfter.substring(gsBlockLength);
      } else {
        nuevoHtml = textBefore + textoFinal + textAfter;
      }
    } else {
      nuevoHtml = htmlBase;
    }

    // 4. BUCLE DE AUTOCOMPLETADO SILENCIOSO Y CÁLCULOS MATEMÁTICOS (REGLAS 2 Y 4)
    // Inyecta automáticamente datos ya presentes en memoria o calcula automáticamente
    // el valor nominal / montos suscriptos sin volver a solicitar datos redundantes.
    let iterHtml = nuevoHtml;
    let iterMemoria = nuevaMemoria;
    if (!esPlayeroEsc && !esSectorPublicoBeta) {
      let continueResolving = true;
      let maxIterations = 20;

      while (continueResolving && maxIterations > 0) {
        maxIterations--;
        const res = intentarResolverEspacioSilencioso(iterHtml, iterMemoria);
        if (res.resolved) {
          iterHtml = res.newHtml;
          iterMemoria = res.newMemoria;
        } else {
          continueResolving = false;
        }
      }
    }

    // 5. RESALTAR EL SIGUIENTE ESPACIO VACÍO PENDIENTE (SI QUEDAN MÁS)
    let hasMoreBlanks = false;
    if (esPlayeroEsc || esSectorPublicoBeta) {
      if (
        !(esPlayeroEsc && selectedPlantillaId.startsWith('playero_')) &&
        !(esSectorPublicoBeta && selectedPlantillaId.startsWith('uoc_'))
      ) {
        const reNext = /_{3,}/g;
        let matchNext: RegExpExecArray | null = null;
        while ((matchNext = reNext.exec(iterHtml)) !== null) {
          if (matchNext[0].length < 15) break;
        }
        if (matchNext && matchNext.index !== undefined) {
          hasMoreBlanks = true;
          iterHtml =
            iterHtml.slice(0, matchNext.index) +
            `<span id="espacio-activo" class="bg-yellow-300/50 animate-pulse rounded px-1">${matchNext[0]}</span>` +
            iterHtml.slice(matchNext.index + matchNext[0].length);
        }
      }
    } else if (/_{3,}/.test(iterHtml)) {
      hasMoreBlanks = true;
      iterHtml = iterHtml.replace(
        /_{3,}/,
        '<span id="espacio-activo" class="bg-yellow-300/50 animate-pulse rounded px-1">$&</span>'
      );
    }

    if (container) {
      container.innerHTML = iterHtml;
    }
    setEditorText(iterHtml);
    setMemoria(iterMemoria);
    setAutofillInput('');
    setMostrarTooltipAyuda(false);

    // Si ya no quedan espacios en blanco, scroll suave al inicio
    if (!hasMoreBlanks) {
      setTimeout(() => {
        const bloque = document.getElementById('editor-notarial-activo-bloque');
        bloque?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } else {
      setTimeout(() => {
        autofillInputRef.current?.focus();
      }, 50);
    }
  };

  // Click outside listener para menú contextual y paleta de colores
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveMenuId(null);
      setIsColorPaletteOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Carpetas configuradas según perfil (Abogado vs. Sector Público Beta vs. Escribano)
  const defaultCarpetas: Carpeta[] = esAbogadoEsc
    ? [
        { id: '1', nombre: 'Expedientes', orden: 1, predeterminada: true },
        { id: '2', nombre: 'Demandas y Contestaciones', orden: 2, predeterminada: true },
        { id: '3', nombre: 'Escritos de Impulso', orden: 3, predeterminada: true },
        { id: '4', nombre: 'Pagarés', orden: 4, predeterminada: true },
        { id: '5', nombre: 'Contratos Privados', orden: 5, predeterminada: true }
      ]
    : esSectorPublicoBeta
      ? [
          { id: '1', nombre: 'Licitaciones', orden: 1, predeterminada: true },
          { id: '2', nombre: 'Contratos', orden: 2, predeterminada: true },
          { id: '3', nombre: 'Adendas', orden: 3, predeterminada: true },
          { id: '4', nombre: 'Notas y Memos', orden: 4, predeterminada: true }
        ]
      : [
          { id: '1', nombre: 'Compraventa', orden: 1, predeterminada: true },
          { id: '2', nombre: 'Pagarés', orden: 2, predeterminada: true },
          { id: '3', nombre: 'Alquiler', orden: 3, predeterminada: true },
          { id: '4', nombre: 'Contratos Privados', orden: 4, predeterminada: true },
          { id: '5', nombre: 'Traspasos', orden: 5, predeterminada: true }
        ];

  useEffect(() => {
    if (esSectorPublicoBeta) {
      setSelectedCategoryForSave((prev) =>
        prev === 'Contratos Privados' ? 'Contratos' : prev
      );
    }
  }, [esSectorPublicoBeta]);

  const userCarpetas: Carpeta[] = React.useMemo(() => {
    const saved = userProfile?.carpetas || workspaceData?.carpetas;
    if (Array.isArray(saved) && saved.length > 0) {
      if (esAbogadoEsc && !saved.some((c: Carpeta) => c.nombre === 'Expedientes')) {
        return [
          { id: 'exp-default', nombre: 'Expedientes', orden: 0, predeterminada: true },
          ...saved,
        ];
      }
      return saved;
    }
    return defaultCarpetas;
  }, [userProfile?.carpetas, workspaceData?.carpetas, esAbogadoEsc, esSectorPublicoBeta]);
  const sortedCarpetas = React.useMemo(() => [...userCarpetas].sort((a, b) => a.orden - b.orden), [userCarpetas]);

  const extractedCategories = React.useMemo(() => 
    Array.from(new Set(escritos.map(e => e.categoria).filter(c => c && c !== 'Sin Categoría' && !sortedCarpetas.some(sc => sc.nombre === c)))) as string[]
  , [escritos, sortedCarpetas]);
  
  const categorias = ['Todos', ...sortedCarpetas.map(c => c.nombre), ...extractedCategories];

  const allCarpetasToAdmin = React.useMemo(() => {
    const combined: Carpeta[] = [...sortedCarpetas];
    let nextOrder = combined.length > 0 ? Math.max(...combined.map(c => c.orden)) + 1 : 1;
    extractedCategories.forEach(catName => {
      combined.push({
        id: `extracted-${catName.toLowerCase().replace(/\s+/g, '-')}`,
        nombre: catName,
        orden: nextOrder++,
        predeterminada: false
      });
    });
    return combined;
  }, [sortedCarpetas, extractedCategories]);

  // FASE 2: Sincronización en tiempo real de Documentos Olga por Workspace
  useEffect(() => {
    // Bloqueo de seguridad: No ejecutar si el ID no está listo
    if (!workspaceId) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'documentos_olga'), where('userId', '==', workspaceId));
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const docsMap = new Map<string, Escrito>();
        querySnapshot.forEach((d) => {
          const data = d.data();
          let categoria = data.categoria || 'Sin Categoría';
          if (!data.categoria && data.tipo) {
            const lowerTipo = data.tipo.toLowerCase();
            if (lowerTipo.includes('contestaci') || lowerTipo.includes('demanda')) categoria = esAbogadoEsc ? 'Demandas y Contestaciones' : 'Expedientes';
            else if (lowerTipo.includes('impulso')) categoria = esAbogadoEsc ? 'Escritos de Impulso' : 'Expedientes';
            else if (lowerTipo.includes('expediente') || lowerTipo.includes('judicial')) categoria = 'Expedientes';
            else if (lowerTipo.includes('compraventa')) categoria = 'Compraventa';
            else if (lowerTipo.includes('pagaré') || lowerTipo.includes('pagare')) categoria = 'Pagarés';
            else if (lowerTipo.includes('alquiler')) categoria = 'Alquiler';
            else if (lowerTipo.includes('contrato privado')) categoria = 'Contratos Privados';
            else if (lowerTipo.includes('traspaso')) categoria = 'Traspasos';
          }
          docsMap.set(d.id, { id: d.id, ...data, categoria } as Escrito);
        });

        // Leer documentos temporales del localStorage SOLO si no existen ya en Firestore
        const tempDocsString = localStorage.getItem('escritos_temporales');
        if (tempDocsString) {
          try {
            const tempDocs = JSON.parse(tempDocsString);
            const remainingTempDocs: any[] = [];
            tempDocs.forEach((tDoc: any, idx: number) => {
              if (tDoc.userId === workspaceId || tDoc.userId === auth?.currentUser?.uid) {
                // Filtro para evitar duplicación visual de escritos ya sincronizados desde Firestore
                const yaExisteEnFirestore = Array.from(docsMap.values()).some(
                  d => d.texto?.trim() === tDoc.texto?.trim() && d.tipo?.replace(' (Guardado Local)', '') === tDoc.tipo?.replace(' (Guardado Local)', '')
                );
                if (!yaExisteEnFirestore) {
                  remainingTempDocs.push(tDoc);
                  let categoria = tDoc.categoria || 'Sin Categoría';
                  if (!tDoc.categoria && tDoc.tipo) {
                    const lowerTipo = tDoc.tipo.toLowerCase();
                    if (lowerTipo.includes('compraventa')) categoria = 'Compraventa';
                    else if (lowerTipo.includes('pagaré') || lowerTipo.includes('pagare')) categoria = 'Pagarés';
                    else if (lowerTipo.includes('alquiler')) categoria = 'Alquiler';
                    else if (lowerTipo.includes('contrato privado')) categoria = 'Contratos Privados';
                    else if (lowerTipo.includes('traspaso')) categoria = 'Traspasos';
                  }
                  docsMap.set(`temp-${idx}`, {
                    id: `temp-${idx}`,
                    texto: tDoc.texto,
                    tipo: `${tDoc.tipo} (Guardado Local)`,
                    tipoHoja: tDoc.tipoHoja,
                    categoria: categoria,
                    userId: tDoc.userId,
                    fechaCreacion: {
                      toMillis: () => new Date(tDoc.fechaCreacion).getTime(),
                      toDate: () => new Date(tDoc.fechaCreacion)
                    } as any
                  });
                }
              }
            });
            // Si algunos ya fueron sincronizados en Firestore, depurar el respaldo local para evitar residuos
            if (remainingTempDocs.length !== tempDocs.length) {
              localStorage.setItem('escritos_temporales', JSON.stringify(remainingTempDocs));
            }
          } catch (e) {
            console.error('Error parsing temp docs', e);
          }
        }

        const docs = Array.from(docsMap.values());
        docs.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.fechaCreacion?.toMillis?.() || 0);
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.fechaCreacion?.toMillis?.() || 0);
          return timeB - timeA;
        });

        setEscritos(docs);
        setLoading(false);
      },
      (err: any) => {
        if (err.code === 'permission-denied') {
          console.warn('Permisos denegados temporalmente al cargar escritos.', err);
          setError('No se pudieron cargar los documentos en este momento.');
        } else {
          console.error('Error fetching escritos:', err);
          setError('Error al sincronizar escritos.');
        }
        setLoading(false);
      }
    );

    return () => unsubscribe(); // Limpieza estricta de memoria
  }, [workspaceId]); // Dependencia única

  const getPersonaActiva = () => {
    try {
      if (personas && Array.isArray(personas) && personas.length > 0) {
        return personas[0];
      }
      const rawDirectorio = localStorage.getItem('olga_directorio_personas');
      if (rawDirectorio) {
        const parsed = JSON.parse(rawDirectorio);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
      }
    } catch (e) {
      console.warn('Error obteniendo persona activa:', e);
    }
    return null;
  };

  const scrollEditorAlInicio = () => {
    try {
      window.scrollTo({ top: 0, behavior: 'auto' });
      const editorBloque = document.getElementById('editor-notarial-activo-bloque');
      let parent: HTMLElement | null = (editorBloque || editorContentRef.current)?.parentElement || null;
      while (parent) {
        const overflowY = window.getComputedStyle(parent).overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) {
          parent.scrollTo({ top: 0, behavior: 'auto' });
        }
        parent = parent.parentElement;
      }
      const mainEl = document.querySelector('main');
      if (mainEl) {
        mainEl.scrollTo({ top: 0, behavior: 'auto' });
      }
      if (editorBloque) {
        editorBloque.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    } catch {
      // Silencioso
    }
  };

  // Manejo del selector de plantillas:
  // Al seleccionar cualquier plantilla (o Hoja en Blanco), se despliega inmediatamente el Editor Activo.
  const handleSelectPlantilla = (plantillaId: string) => {
    if (!plantillaId || isMenuPlantillasBloqueado) return;
    setMostrarEditor(true);
    setEditandoDocumentoExistente(false);
    setSelectedPlantillaId(plantillaId);
    setMemoria({});
    setSkippedJudicialMarkers([]);
    setHistorialTextos([]);
    setHistorialSkipped([]);
    setAutofillInput('');

    let textoParaEditor = '';
    if (esAbogadoEsc) {
      const foundAbg = PLANTILLAS_ABOGADOS_META.find((p) => p.id === plantillaId);
      if (!foundAbg || plantillaId === 'hoja_en_blanco') {
        textoParaEditor = '';
        setTipoHoja('blanca');
        setEditorText('');
        setDocumentTitle('Escrito en Blanco');
        setSelectedCategoryForSave('Expedientes');
      } else {
        setTipoHoja('blanca');
        textoParaEditor = construirPlantillaJudicial(plantillaId, abogadoPerfilDatos);
        setEditorText(textoParaEditor);
        setDocumentTitle(foundAbg.nombre);
        setSelectedCategoryForSave(foundAbg.categoriaSugerida);
      }
    } else if (esPlayeroEsc) {
      const foundPlayero = PLANTILLAS_PLAYERO_META.find((p) => p.id === plantillaId);
      if (!foundPlayero || plantillaId === 'hoja_en_blanco') {
        textoParaEditor = '';
        setTipoHoja('blanca');
        setEditorText('');
        setDocumentTitle('Documento en Blanco');
        setSelectedCategoryForSave('Contratos Privados');
      } else {
        setTipoHoja('blanca');
        textoParaEditor = construirPlantillaPlayero(plantillaId, playeroPerfilDatos);
        setEditorText(textoParaEditor);
        setDocumentTitle(foundPlayero.nombre);
        setSelectedCategoryForSave(foundPlayero.categoriaSugerida);
      }
    } else if (esSectorPublicoBeta) {
      const foundPublico = PLANTILLAS_SECTOR_PUBLICO_BETA_META.find((p) => p.id === plantillaId);
      if (!foundPublico || plantillaId === 'hoja_en_blanco') {
        textoParaEditor = '';
        setTipoHoja('blanca');
        setEditorText('');
        setDocumentTitle('Documento en Blanco');
        setSelectedCategoryForSave('Notas y Memos');
      } else {
        setTipoHoja('blanca');
        textoParaEditor = construirPlantillaSectorPublicoBeta(plantillaId, sectorPublicoPerfilDatos);
        setEditorText(textoParaEditor);
        setDocumentTitle(foundPublico.nombre);
        setSelectedCategoryForSave(foundPublico.categoriaSugerida);
      }
    } else {
      const found = PLANTILLAS_NOTARIALES.find(p => p.id === plantillaId);
      if (!found || plantillaId === 'hoja_en_blanco') {
        // Limpieza total del editor
        textoParaEditor = '';
        setTipoHoja('blanca');
        setEditorText('');
        setDocumentTitle('Escrito en Blanco');
        setSelectedCategoryForSave('Contratos Privados');
      } else if (plantillaId === 'constitucion_sa') {
        setTipoHoja('blanca');
        // Generador Dinámico de Socios (Prompt Inicial):
        // Pregunta al usuario la cantidad de socios que conformarán la S.A.
        let numSocios = 2;
        try {
          const respuestaPrompt = window.prompt('¿Cuántos socios conformarán la S.A.? (Ej. 2, 3, 4)', '2');
          if (respuestaPrompt !== null) {
            const parsed = parseInt(respuestaPrompt.trim(), 10);
            if (!isNaN(parsed) && parsed >= 1) {
              numSocios = parsed;
            }
          }
        } catch (err) {
          console.warn('Error al solicitar cantidad de socios:', err);
        }

        // Reconstruye el texto con N comparecientes sin datos pre-cargados de usuario
        textoParaEditor = construirConstitucionSA(numSocios);
        setEditorText(textoParaEditor);
        setDocumentTitle('Constitución de S.A.');
        setSelectedCategoryForSave('Contratos Privados');
      } else {
        setTipoHoja('blanca');
        // Plantillas limpias con espacios en blanco (_______)
        textoParaEditor = procesarAutofillPlantilla(found.contenido);
        setEditorText(textoParaEditor);
        setDocumentTitle(found.nombre);
        setSelectedCategoryForSave(found.categoriaSugerida);
      }
    }

    if (editorContentRef.current) {
      editorContentRef.current.innerHTML = textoParaEditor;
      requestAnimationFrame(() => {
        if (editorContentRef.current) {
          recalcularPaginacionVisual(editorContentRef.current);
        }
      });
    }

    setTimeout(() => {
      if (editorContentRef.current) {
        if (editorContentRef.current.innerHTML !== textoParaEditor) {
          editorContentRef.current.innerHTML = textoParaEditor;
        }
        requestAnimationFrame(() => {
          if (editorContentRef.current) {
            recalcularPaginacionVisual(editorContentRef.current);
          }
        });
      }
      scrollEditorAlInicio();
      if (plantillaId === 'hoja_en_blanco') {
        editorContentRef.current?.focus({ preventScroll: true });
      } else {
        // En plantillas con autocompletado, enfocar de inmediato el campo del Asistente Flotante
        autofillInputRef.current?.focus({ preventScroll: true });
      }
    }, 100);
  };

  // Botón explícito para '+ Nuevo Escrito' (despliega el editor en hoja limpia)
  const handleNuevoEscrito = () => {
    setSelectedPlantillaId('hoja_en_blanco');
    setTipoHoja('blanca');
    setIncludeHeader(true);
    setEditandoDocumentoExistente(false);
    setActiveEditingDoc(null);
    setEditorText('');
    setDocumentTitle('Escrito en Blanco');
    setPreviewMode(false);
    setMostrarEditor(true);
    setMemoria({});
    setSkippedJudicialMarkers([]);
    setHistorialTextos([]);
    setHistorialSkipped([]);
    setAutofillInput('');
    if (editorContentRef.current) {
      editorContentRef.current.innerHTML = '';
    }
    setTimeout(() => {
      if (editorContentRef.current) {
        editorContentRef.current.innerHTML = '';
      }
      scrollEditorAlInicio();
      editorContentRef.current?.focus({ preventScroll: true });
    }, 100);
  };

  // Botón explícito para limpiar completamente el editor (Hoja en Blanco)
  const handleLimpiarEditor = () => {
    setSelectedPlantillaId('hoja_en_blanco');
    setTipoHoja('blanca');
    setIncludeHeader(true);
    setEditandoDocumentoExistente(false);
    setActiveEditingDoc(null);
    setEditorText('');
    setDocumentTitle('Escrito en Blanco');
    setPreviewMode(false);
    setMemoria({});
    setSkippedJudicialMarkers([]);
    setHistorialTextos([]);
    setHistorialSkipped([]);
    setAutofillInput('');
    if (editorContentRef.current) {
      editorContentRef.current.innerHTML = '';
    }
  };

  // Copiar contenido al portapapeles
  const handleCopiarTexto = () => {
    if (!editorText) return;
    navigator.clipboard.writeText(limpiarEspaciadoresVisualesHtml(editorText));
    setCopiedFeedback(true);
    setTimeout(() => setCopiedFeedback(false), 2500);
  };

  // Guardar escrito en base de datos y localStorage
  const handleGuardarEscrito = async () => {
    if (!editorText.trim()) {
      alert('El documento está vacío. Escriba o seleccione una plantilla antes de guardar.');
      return;
    }

    const user = auth?.currentUser;
    if (!user) {
      alert('Debes iniciar sesión para guardar el escrito.');
      return;
    }

    setIsSavingDraft(true);
    try {
      const tipoDoc = documentTitle.trim() || 'Escrito';
      const cat = selectedCategoryForSave || 'Contratos Privados';

      // Limpiar etiquetas temporales de resaltado y espaciadores visuales antes de persistir
      const textoLimpio = limpiarEspaciadoresVisualesHtml(
        editorText.replace(/<span id="espacio-activo"[^>]*>(.*?)<\/span>/g, '$1')
      );

      if (!workspaceId) {
        console.error("Operación abortada: Workspace no identificado.");
        setIsSavingDraft(false);
        return;
      }

      const creatorName = (currentUser as any)?.nombre || userProfile?.nombre || userProfile?.razonSocial || (currentUser as any)?.displayName || currentUser?.email?.split('@')[0] || (user as any)?.displayName || user?.email?.split('@')[0] || 'Usuario';
      const creatorRole = (currentUser as any)?.role || (currentUser as any)?.rol || userProfile?.rol || userProfile?.role || 'titular';

      const docId = activeEditingDoc?.id;
      const isExistingFirestoreDoc = !!(docId && !docId.startsWith('temp-'));

      const tipoPapelValue = tipoHoja === 'blanca' ? 'blanco' : 'protocolo';
      const modoImpresionValue = tipoHoja === 'blanca' ? 'simple' : 'protocolo';

      if (isExistingFirestoreDoc && docId) {
        // ACTUALIZACIÓN DIRECTA (updateDoc) SOBRE EL DOCUMENTO EXISTENTE
        const docRef = doc(db, 'documentos_olga', docId);
        await updateDoc(docRef, {
          texto: textoLimpio,
          tipo: tipoDoc,
          tipoHoja,
          tipoPapel: tipoPapelValue,
          modoImpresion: modoImpresionValue,
          includeHeader,
          fontFamily: editorFontFamily,
          fontSizePt: editorFontSizePt,
          lineHeight: editorLineHeight,
          pageMargins,
          categoria: cat,
          ultimaModificacion: serverTimestamp(),
          lastModifiedBy: user?.uid,
          lastModifiedByName: creatorName
        });
      } else if (docId && docId.startsWith('temp-')) {
        // Actualización de borrador local
        const tempDocsString = localStorage.getItem('escritos_temporales');
        if (tempDocsString) {
          const tempDocs = JSON.parse(tempDocsString);
          const idx = parseInt(docId.replace('temp-', ''), 10);
          if (!isNaN(idx) && tempDocs[idx]) {
            tempDocs[idx].texto = textoLimpio;
            tempDocs[idx].tipo = tipoDoc;
            tempDocs[idx].tipoHoja = tipoHoja;
            tempDocs[idx].tipoPapel = tipoPapelValue;
            tempDocs[idx].modoImpresion = modoImpresionValue;
            tempDocs[idx].includeHeader = includeHeader;
            tempDocs[idx].fontFamily = editorFontFamily;
            tempDocs[idx].fontSizePt = editorFontSizePt;
            tempDocs[idx].lineHeight = editorLineHeight;
            tempDocs[idx].pageMargins = pageMargins;
            tempDocs[idx].categoria = cat;
            localStorage.setItem('escritos_temporales', JSON.stringify(tempDocs));
          }
        }
      } else {
        // CREACIÓN DE NUEVO DOCUMENTO (addDoc)
        const nuevoDocData = {
          texto: textoLimpio,
          tipo: tipoDoc,
          tipoHoja,
          tipoPapel: tipoPapelValue,
          modoImpresion: modoImpresionValue,
          includeHeader,
          fontFamily: editorFontFamily,
          fontSizePt: editorFontSizePt,
          lineHeight: editorLineHeight,
          pageMargins,
          userId: workspaceId,            // El propietario legal de los datos (Titular)
          creator_id: user?.uid,          // Rastro de auditoría: Quién lo digitó
          createdBy: user?.uid,
          creator_name: creatorName,
          creator_role: creatorRole,
          categoria: cat,
          createdAt: new Date().toISOString(),
          fechaCreacion: serverTimestamp()
        };
        await addDoc(collection(db, 'documentos_olga'), nuevoDocData);
      }

      // 3. Cerrar Editor Post-Guardado y resetear estado de edición activa
      setMostrarEditor(false);
      setSelectedPlantillaId('');
      setActiveEditingDoc(null);
      setEditandoDocumentoExistente(false);

      // 4. Mensaje Verde de Éxito con Toast
      const mensajeFinal = isExistingFirestoreDoc 
        ? `¡"${tipoDoc}" actualizado exitosamente en la carpeta ${cat}!`
        : `¡"${tipoDoc}" guardado exitosamente en la carpeta ${cat}!`;
      setMensajeExito(mensajeFinal);
      setSaveSuccessBanner(mensajeFinal);
      setTimeout(() => {
        setMensajeExito(null);
        setSaveSuccessBanner(null);
      }, 4500);

      // Desplazar suavemente a la cuadrícula de documentos guardados
      const seccionArchivo = document.getElementById('seccion-gestion-documental');
      if (seccionArchivo) {
        seccionArchivo.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (err) {
      console.error('Error al guardar documento:', err);
      // Guardado como respaldo local de emergencia únicamente en caso de fallo de conexión
      try {
        const tipoDoc = documentTitle.trim() || 'Escrito';
        const cat = selectedCategoryForSave || 'Contratos Privados';
        const textoLimpio = limpiarEspaciadoresVisualesHtml(
          editorText.replace(/<span id="espacio-activo"[^>]*>(.*?)<\/span>/g, '$1')
        );
        const rawTemp = localStorage.getItem('escritos_temporales');
        const list = rawTemp ? JSON.parse(rawTemp) : [];
        list.push({
          texto: textoLimpio,
          tipo: tipoDoc,
          tipoHoja,
          includeHeader,
          fontFamily: editorFontFamily,
          fontSizePt: editorFontSizePt,
          userId: user.uid,
          categoria: cat,
          fechaCreacion: new Date().toISOString()
        });
        localStorage.setItem('escritos_temporales', JSON.stringify(list));
      } catch (backupErr) {
        console.warn('Error guardando copia local de emergencia:', backupErr);
      }
      alert('Ocurrió un error al guardar en la nube. Se ha respaldado una copia local.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Motor de Impresión Oficial (Hoja en Blanco A4 - Flujo Continuo Nativo)
  const handleImprimirPDF = () => {
    const rawContent = editorContentRef.current?.innerHTML || editorText;
    const content = limpiarEspaciadoresVisualesHtml(
      rawContent.replace(/<span id="espacio-activo"[^>]*>(.*?)<\/span>/g, '$1')
    );
    const hasMediaRaw = /<(img|table|hr|svg)\b/i.test(content || '');
    if (!content || (!content.trim() && !hasMediaRaw)) {
      alert('El documento está vacío. Escriba o seleccione una plantilla antes de imprimir.');
      return;
    }

    const title = documentTitle.trim() || 'Escrito';

    // 1. Limpieza y Normalización Lossless del árbol DOM (preserva imágenes, tablas, negritas, saltos y bloques)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;

    // Desenvolver cualquier span de campo activo residual conservando su texto
    tempDiv.querySelectorAll('#espacio-activo').forEach((span) => {
      const textNode = document.createTextNode(span.textContent || '');
      span.parentNode?.replaceChild(textNode, span);
    });

    const escapeHtml = (str: string) =>
      str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const BLOCK_TAGS = new Set([
      'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'table', 'blockquote', 'hr', 'section', 'article'
    ]);

    const cleanParagraphs: string[] = [];
    let inlineParts: string[] = [];

    const flushInline = (forceEmpty = false) => {
      const joined = inlineParts.join('');
      inlineParts = [];
      const tmp = document.createElement('div');
      tmp.innerHTML = joined;
      const plain = (tmp.textContent || '').replace(/\u00A0/g, ' ').trim();
      const hasMedia = Boolean(tmp.querySelector('img, svg, table, hr'));
      if (plain.length > 0 || hasMedia) {
        cleanParagraphs.push(`<p>${joined}</p>`);
      } else if (forceEmpty) {
        cleanParagraphs.push('<p><br></p>');
      }
    };

    const hasBlockDescendant = (el: Element): boolean =>
      Array.from(el.children).some(
        (child) =>
          BLOCK_TAGS.has(child.tagName.toLowerCase()) ||
          child.classList.contains('salto-de-pagina') ||
          child.classList.contains('salto-de-pagina-print') ||
          hasBlockDescendant(child)
      );

    const pushInlineText = (text: string, wrapperTag?: { open: string; close: string }) => {
      const lines = text.split('\n');
      lines.forEach((line, idx) => {
        const escaped = escapeHtml(line);
        if (escaped.length > 0) {
          inlineParts.push(wrapperTag ? `${wrapperTag.open}${escaped}${wrapperTag.close}` : escaped);
        }
        if (idx < lines.length - 1) {
          flushInline(true);
        }
      });
    };

    const processInlineWithNewlines = (
      el: Element,
      parentOpen = '',
      parentClose = ''
    ) => {
      const tag = el.tagName.toLowerCase();
      if (tag === 'img') {
        inlineParts.push(el.outerHTML);
        return;
      }
      const htmlEl = el as HTMLElement;
      const styles: string[] = [];
      if (htmlEl.style?.textAlign) styles.push(`text-align: ${htmlEl.style.textAlign}`);
      if (htmlEl.style?.color) styles.push(`color: ${htmlEl.style.color}`);
      else if (tag === 'font' && el.getAttribute('color')) {
        styles.push(`color: ${el.getAttribute('color')}`);
      }
      const styleStr = styles.length > 0 ? ` style="${styles.join('; ')}"` : '';
      const outTag = tag === 'font' ? 'span' : tag;
      const open = `${parentOpen}<${outTag}${styleStr}>`;
      const close = `</${outTag}>${parentClose}`;

      Array.from(el.childNodes).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          pushInlineText(child.nodeValue || '', { open, close });
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const childEl = child as Element;
          const childTag = childEl.tagName.toLowerCase();
          if (childTag === 'br') {
            flushInline(true);
          } else if (childTag === 'img') {
            inlineParts.push(childEl.outerHTML);
          } else {
            processInlineWithNewlines(childEl, open, close);
          }
        }
      });
    };

    const processNodes = (nodeList: NodeListOf<ChildNode> | ChildNode[]) => {
      Array.from(nodeList).forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          pushInlineText(node.nodeValue || '');
          return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const el = node as Element;
        const tag = el.tagName.toLowerCase();

        // Ignorar nodos internos de la insignia visual del salto de página
        if (el.closest('.salto-de-pagina') && !el.classList.contains('salto-de-pagina')) {
          return;
        }

        if (el.classList.contains('salto-de-pagina') || el.classList.contains('salto-de-pagina-print')) {
          flushInline(false);
          cleanParagraphs.push('<div class="salto-de-pagina-print"></div>');
          return;
        }

        if (tag === 'br') {
          flushInline(true);
          return;
        }

        if (tag === 'img') {
          flushInline(false);
          cleanParagraphs.push(el.outerHTML);
          return;
        }

        if (!BLOCK_TAGS.has(tag)) {
          if (hasBlockDescendant(el)) {
            flushInline(false);
            processNodes(el.childNodes);
            flushInline(false);
          } else {
            processInlineWithNewlines(el);
          }
          return;
        }

        flushInline(false);

        if (tag === 'ul' || tag === 'ol' || tag === 'table' || tag === 'blockquote' || tag === 'hr' || /^h[1-6]$/.test(tag)) {
          const hasInnerMedia = Boolean(el.querySelector('img, svg, hr'));
          if (tag !== 'hr' && !(el.textContent || '').trim() && !hasInnerMedia) {
            return;
          }
          cleanParagraphs.push(el.outerHTML);
          return;
        }

        // Contenedor DIV/SECTION/ARTICLE/P con sub-bloques (incluye antiguas .hoja-notarial-pagina)
        if (hasBlockDescendant(el)) {
          processNodes(el.childNodes);
          flushInline(false);
          return;
        }

        // Párrafo o DIV hoja: preservar saltos internos \n, alineación, color, imágenes o <br> si los tuviera
        const textVal = el.textContent || '';
        const hasMediaChild = Boolean(el.querySelector('img, svg, hr'));
        const innerHtml = el.innerHTML.replace(/^[\r\n]+|[\r\n]+$/g, '');
        const htmlEl = el as HTMLElement;
        const blockStyles: string[] = [];
        if (htmlEl.style?.textAlign) blockStyles.push(`text-align: ${htmlEl.style.textAlign}`);
        if (htmlEl.style?.color) blockStyles.push(`color: ${htmlEl.style.color}`);
        const alignStyle = blockStyles.length > 0 ? ` style="${blockStyles.join('; ')}"` : '';

        if (textVal.includes('\n')) {
          processNodes(el.childNodes);
          flushInline(false);
          return;
        }

        if (textVal.replace(/\u00A0/g, ' ').trim().length > 0 || hasMediaChild) {
          cleanParagraphs.push(`<p${alignStyle}>${innerHtml}</p>`);
        } else if (innerHtml === '<br>' || innerHtml === '<br/>' || innerHtml === '' || el.querySelector('br')) {
          cleanParagraphs.push('<p><br></p>');
        }
      });
    };

    processNodes(tempDiv.childNodes);
    flushInline(false);

    if (cleanParagraphs.length === 0) {
      const rawLines = content.split('\n');
      rawLines.forEach(l => {
        const plain = l.replace(/<[^>]*>/g, '').trim();
        if (plain.length > 0) {
          cleanParagraphs.push(`<p>${escapeHtml(plain)}</p>`);
        } else {
          cleanParagraphs.push('<p><br></p>');
        }
      });
    }

    // Recortar nodos vacíos o saltos de página finales para evitar una Página 2 en blanco
    while (cleanParagraphs.length > 0) {
      const tail = cleanParagraphs[cleanParagraphs.length - 1];
      const probe = document.createElement('div');
      probe.innerHTML = tail;
      const hasMediaTail = Boolean(probe.querySelector('img, table, hr, svg'));
      const isBreakTail = Boolean(probe.querySelector('.salto-de-pagina-print, .salto-de-pagina'));
      const plainTail = (probe.textContent || '').replace(/[\u00A0\u200B]/g, ' ').trim();
      if (!hasMediaTail && (isBreakTail || plainTail.length === 0)) {
        cleanParagraphs.pop();
      } else {
        break;
      }
    }

    if (cleanParagraphs.length === 0) {
      alert('El documento no contiene texto ni contenido válido para imprimir.');
      return;
    }

    const bodyHtml = limpiarNodosVaciosFinalesHtml(
      wrapSignatureBlocksForPrint(cleanParagraphs.join(''))
    );
    const mostrarCabeceraImpresion = includeHeader;
    const membreteHtml = mostrarCabeceraImpresion ? buildMembreteHtml() : '';

    const printFontCss = resolveEditorFontCss(editorFontFamily);
    const printFontSize = `${editorFontSizePt}pt`;
    const printLineHeight = editorLineHeight || '1.5';
    const printMarginCss = (PAGE_MARGIN_PROFILES[pageMargins] || PAGE_MARGIN_PROFILES.normal).cssMargin;

    const htmlToPrint = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: ${printMarginCss};
    }

    *, *::before, *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
      background: #ffffff;
      color: #000000;
      font-family: ${printFontCss};
    }

    .salto-de-pagina-print,
    .salto-de-pagina {
      break-after: page !important;
      page-break-after: always !important;
      height: 0 !important;
      line-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      display: block !important;
    }

    .hoja-notarial-pagina {
      position: relative !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
      page-break-after: always !important;
      break-after: page !important;
    }

    .hoja-notarial-pagina:last-child,
    .hoja-notarial-pagina:last-of-type {
      page-break-after: auto !important;
      break-after: auto !important;
    }

    .documento-notarial {
      position: relative;
      width: 100%;
      max-width: 100%;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
      font-family: ${printFontCss};
      font-size: ${printFontSize};
      line-height: ${printLineHeight};
      text-align: justify;
      text-justify: inter-word;
      white-space: pre-wrap !important;
      overflow-wrap: anywhere;
      word-break: break-word;
      tab-size: 4 !important;
      -moz-tab-size: 4 !important;
      color: #000000;
    }

    p {
      margin: 0 0 8px 0 !important;
      padding: 0 !important;
      min-height: 0 !important;
      font-family: ${printFontCss};
      font-size: ${printFontSize};
      line-height: ${printLineHeight} !important;
      text-align: justify;
      text-justify: inter-word;
      white-space: pre-wrap !important;
      overflow-wrap: anywhere;
      word-break: break-word;
      tab-size: 4 !important;
      -moz-tab-size: 4 !important;
      orphans: 3;
      widows: 3;
    }

    .documento-notarial p:last-child {
      margin-bottom: 0 !important;
    }

    p, div, td, th {
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    hr {
      border: none;
      border-top: 1px solid #94a3b8;
      margin: 12px 0;
    }

    img {
      max-width: 100% !important;
      height: auto !important;
      display: block;
      break-inside: avoid;
      page-break-inside: avoid;
      margin: 6px 0;
    }

    table {
      width: 100% !important;
      border-collapse: collapse !important;
      table-layout: auto;
      margin: 8px 0;
    }

    td, th {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      vertical-align: top;
      white-space: normal !important;
      overflow-wrap: anywhere !important;
      word-break: break-word !important;
    }

    h1, h2, h3, h4 {
      break-after: avoid;
      page-break-after: avoid;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    ul, ol {
      margin: 0 0 8px 0;
      padding-left: 1.5rem;
    }

    li {
      margin: 0 !important;
      font-family: ${printFontCss};
      font-size: ${printFontSize};
      line-height: ${printLineHeight} !important;
      text-align: justify;
      white-space: pre-wrap !important;
      overflow-wrap: anywhere;
      word-break: break-word;
      tab-size: 4 !important;
      -moz-tab-size: 4 !important;
      orphans: 3;
      widows: 3;
    }

    .signature-block, .signatures-group {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      white-space: pre-wrap !important;
      tab-size: 4 !important;
      -moz-tab-size: 4 !important;
    }

    .signature-block {
      margin-top: 32px;
    }

    .signature-block p {
      margin: 0 0 2px 0 !important;
      min-height: 0 !important;
      line-height: ${printLineHeight} !important;
      white-space: pre-wrap !important;
      tab-size: 4 !important;
      -moz-tab-size: 4 !important;
    }

    /* Aislamiento de guías exclusivas de pantalla del editor */
    .renglones-container, .texto-lateral-izq, .guia-linea, .watermark, .salto-de-pagina-badge, .olga-page-break-guide {
      display: none !important;
      visibility: hidden !important;
    }

    .olga-doc-membrete,
    .olga-doc-membrete * {
      white-space: normal !important;
    }
    .olga-doc-membrete {
      text-align: center;
      border-bottom: 1px solid #94a3b8;
      padding-bottom: 8px;
      margin: 0 0 14px 0;
    }
    .olga-doc-membrete-logo {
      display: block !important;
      margin: 0 auto 4px auto !important;
      max-height: 38px !important;
      width: auto !important;
      object-fit: contain;
    }
    .olga-doc-membrete-title {
      font-family: ${printFontCss};
      font-size: 12pt;
      font-weight: 700;
      letter-spacing: 0.03em;
      color: #0f172a;
      margin: 0 0 2px 0;
      line-height: 1.2;
    }
    .olga-doc-membrete p,
    .olga-doc-membrete-sub {
      font-family: Arial, Helvetica, sans-serif !important;
      font-size: 8.5pt !important;
      line-height: 1.25 !important;
      min-height: 0 !important;
      text-align: center !important;
      white-space: normal !important;
      color: #475569 !important;
      margin: 0 !important;
    }

    @media print {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        height: auto !important;
        min-height: 0 !important;
        overflow: visible !important;
      }
      .documento-notarial {
        position: relative !important;
        width: 100% !important;
        height: auto !important;
        min-height: 0 !important;
        overflow: visible !important;
        white-space: pre-wrap !important;
        tab-size: 4 !important;
        -moz-tab-size: 4 !important;
      }
      .documento-notarial p,
      .signature-block,
      .signature-block p {
        white-space: pre-wrap !important;
        tab-size: 4 !important;
        -moz-tab-size: 4 !important;
      }
      .olga-doc-membrete,
      .olga-doc-membrete * {
        white-space: normal !important;
      }
      [data-olga-page-spacer="true"] {
        margin-top: 0 !important;
      }
    }
  </style>
</head>
<body>
  <div class="documento-notarial">${membreteHtml}${bodyHtml}</div>
</body>
</html>`;

    const triggerPrintWhenImagesReady = async (targetDoc: Document, printFn: () => void, cleanupFn?: () => void) => {
      try {
        await waitForImagesInList(Array.from(targetDoc.images || []), 3500);
      } catch {
        // Continuar impresión aunque falle decodificación
      }
      setTimeout(() => {
        printFn();
        if (cleanupFn) {
          setTimeout(cleanupFn, 1500);
        }
      }, 120);
    };

    try {
      const win = window.open('', '_blank');
      if (win) {
        win.document.open();
        win.document.write(htmlToPrint);
        win.document.close();
        win.focus();
        void triggerPrintWhenImagesReady(win.document, () => {
          win.focus();
          win.print();
        });
        return;
      }
    } catch (e) {
      console.warn('window.open no disponible, usando fallback con iframe:', e);
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(htmlToPrint);
      doc.close();
      void triggerPrintWhenImagesReady(
        doc,
        () => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        },
        () => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }
      );
    }
  };

  // Manejo de archivos adjuntos para IA
  const handleFileAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setAiError(null);
    Array.from(files).forEach(file => {
      if (file.size > 15 * 1024 * 1024) {
        setAiError(`El archivo "${file.name}" supera el límite permitido de 15 MB.`);
        return;
      }

      const ext = file.name.split('.').pop()?.toLowerCase();
      let detectedMime = file.type || '';
      if (!detectedMime || detectedMime === 'application/octet-stream') {
        if (ext === 'pdf') detectedMime = 'application/pdf';
        else if (ext === 'png') detectedMime = 'image/png';
        else if (ext === 'jpg' || ext === 'jpeg') detectedMime = 'image/jpeg';
        else if (ext === 'webp') detectedMime = 'image/webp';
        else if (ext === 'txt') detectedMime = 'text/plain';
      }

      // Si es un archivo de texto plano, leerlo directamente como texto
      if (ext === 'txt' || detectedMime === 'text/plain') {
        const textReader = new FileReader();
        textReader.onload = () => {
          const content = textReader.result as string;
          setAiPrompt(prev => {
            const prefix = prev ? `${prev}\n\n` : '';
            return `${prefix}[Texto adjunto de ${file.name}]:\n${content.slice(0, 10000)}`;
          });
        };
        textReader.readAsText(file);
        return;
      }

      // Para imágenes y PDFs, leer como DataURL para extraer base64 limpio
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.includes(',') ? result.split(',')[1] : result;
        setAiAttachments(prev => [
          ...prev,
          {
            name: file.name,
            mimeType: detectedMime || 'application/pdf',
            data: base64Data,
            size: file.size
          }
        ]);
      };
      reader.onerror = () => {
        setAiError(`No se pudo leer el archivo "${file.name}".`);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAiAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Generación asistida por IA
  const handleGenerarConIA = async () => {
    if (isSoftBlocked) {
      setAiError('Tu acceso ha expirado. El uso de la IA está bloqueado por vencimiento de suscripción o prueba. Por favor, adquiere o renueva un plan en la sección "Planes y Precios" para continuar.');
      return;
    }

    const planStr = String(userProfile?.planActual || userProfile?.plan || 'trial').toLowerCase();
    const isOperador = userProfile?.rol === 'operador' || userProfile?.role === 'operador';
    const isWhitelisted = currentUser?.email === 'jotamolinas@gmail.com' || isOperador;
    const isApproved = String(userProfile?.estadoPago).toUpperCase() === 'APROBADO' || String(userProfile?.estadoPlataforma).toUpperCase() === 'APROBADO';
    const isPaidPlan = planStr.includes('pro') || planStr.includes('empresa') || planStr.includes('full') || planStr.includes('básico') || planStr.includes('basico') || isApproved || isWhitelisted;

    if (!isPaidPlan && (isTrialExpired || diasRestantes <= 0 || !pruebaActiva)) {
      setAiError('Tu período de prueba gratuita de 5 días ha finalizado. Por favor, adquiere o renueva un plan en la sección "Planes y Precios" para continuar redactando con IA.');
      return;
    }

    if (!aiPrompt.trim() && aiAttachments.length === 0) {
      setAiError('Por favor, ingresa una instrucción o adjunta un archivo para redactar con IA.');
      return;
    }

    setIsGeneratingAI(true);
    setAiError(null);
    try {
      const rawResultado = await redactarEscritoConIA(
        aiPrompt.trim(),
        editorText.trim(),
        aiAttachments.map(att => ({ data: att.data, mimeType: att.mimeType, name: att.name })),
        { esAbogado: esAbogadoEsc }
      );
      const resultado = esAbogadoEsc ? limpiarLatexJuridico(rawResultado) : rawResultado;

      if (!resultado || !resultado.trim()) {
        setAiError('La IA no devolvió contenido para esta solicitud. Por favor, reformula tu instrucción.');
        return;
      }

      // Flujo de Revisión Previa: El texto NO se sobreescribe de inmediato en el documento.
      // Se carga en la caja de previsualización para que el usuario pueda revisarlo y editarlo libremente.
      setAiDraftProposal(resultado);
    } catch (err: any) {
      console.warn('Aviso de generación con IA:', err);
      const displayMsg = err?.message || 'Error al conectar con el servicio de IA.';
      setAiError(displayMsg);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Botón explícito de Inserción / Aprobación
  const handleInsertarEnDocumento = (modo: 'anexar' | 'reemplazar' = 'anexar') => {
    if (!aiDraftProposal) return;

    let nuevoTexto = '';
    if (modo === 'reemplazar' || !editorText.trim()) {
      nuevoTexto = aiDraftProposal.trim();
    } else {
      nuevoTexto = `${editorText.trim()}\n\n${aiDraftProposal.trim()}`;
    }

    setEditorText(nuevoTexto);
    setTipoHoja('blanca');
    // Desplegar el editor y desactivar vista previa
    setMostrarEditor(true);
    setPreviewMode(false);
    if (editorContentRef.current) {
      editorContentRef.current.innerHTML = nuevoTexto;
    }

    // Persistencia local inmediata y segura
    try {
      localStorage.setItem(LOCAL_STORAGE_DRAFT_TEXT, nuevoTexto);
      localStorage.setItem(LOCAL_STORAGE_DRAFT_TIPO_HOJA, 'blanca');
    } catch (err) {
      console.warn('Error guardando en localStorage:', err);
    }

    // Scroll al inicio y enfoque sin salto en el Editor Notarial Activo
    setTimeout(() => {
      if (editorContentRef.current) {
        if (editorContentRef.current.innerHTML !== nuevoTexto) {
          editorContentRef.current.innerHTML = nuevoTexto;
        }
      }
      scrollEditorAlInicio();
      editorContentRef.current?.focus({ preventScroll: true });
    }, 80);

    setSaveSuccessBanner('¡Texto redactado por IA insertado con éxito en el Editor de Escritos!');
    setTimeout(() => setSaveSuccessBanner(null), 4000);

    // Limpieza de propuesta tras inserción aprobada
    setAiDraftProposal(null);
    setAiPrompt('');
    setAiAttachments([]);
    setIsAiModalOpen(false);
  };

  // Cargar documento seleccionado en el Editor de Escritos
  const handleEditarDocumento = (escrito: Escrito) => {
    const docTexto = escrito.texto || '';
    const cleanTitle = escrito.tipo.replace(' (Guardado Local)', '');
    const restoredTipoHoja: 'blanca' | 'protocolo' = 'blanca';
    const restoredIncludeHeader = escrito.includeHeader !== false;
    const restoredFontFamily =
      escrito.fontFamily && (EDITOR_FONT_FAMILIES as readonly string[]).includes(escrito.fontFamily)
        ? escrito.fontFamily
        : 'Times New Roman';
    const restoredFontSizePt =
      typeof escrito.fontSizePt === 'number' &&
      (EDITOR_FONT_SIZES_PT as readonly number[]).includes(escrito.fontSizePt)
        ? escrito.fontSizePt
        : 12;
    const restoredLineHeight =
      escrito.lineHeight && EDITOR_LINE_HEIGHTS.some((lh) => lh.value === escrito.lineHeight)
        ? escrito.lineHeight
        : '1.5';
    const restoredPageMargins: EditorPageMargins =
      escrito.pageMargins && PAGE_MARGIN_PROFILES[escrito.pageMargins]
        ? escrito.pageMargins
        : 'normal';

    setMostrarEditor(true);
    setEditandoDocumentoExistente(true);
    setActiveEditingDoc(escrito);
    setTipoHoja(restoredTipoHoja);
    setIncludeHeader(restoredIncludeHeader);
    setEditorFontFamily(restoredFontFamily);
    setEditorFontSizePt(restoredFontSizePt);
    setEditorLineHeight(restoredLineHeight);
    setPageMargins(restoredPageMargins);
    setSelectedPlantillaId('hoja_en_blanco');
    setEditorText(docTexto);
    setDocumentTitle(cleanTitle);
    setSelectedCategoryForSave(escrito.categoria || 'Contratos Privados');
    setPreviewMode(false);
    setMemoria({});
    setSkippedJudicialMarkers([]);
    setHistorialTextos([]);
    setHistorialSkipped([]);
    setAutofillInput('');

    try {
      localStorage.setItem(LOCAL_STORAGE_DRAFT_TEXT, docTexto);
      localStorage.setItem(LOCAL_STORAGE_DRAFT_TITULO, cleanTitle);
      localStorage.setItem(LOCAL_STORAGE_DRAFT_CATEGORIA, escrito.categoria || 'Contratos Privados');
      localStorage.setItem(LOCAL_STORAGE_DRAFT_TIPO_HOJA, restoredTipoHoja);
      localStorage.setItem(LOCAL_STORAGE_DRAFT_INCLUDE_HEADER, String(restoredIncludeHeader));
      localStorage.setItem(LOCAL_STORAGE_DRAFT_FONT_FAMILY, restoredFontFamily);
      localStorage.setItem(LOCAL_STORAGE_DRAFT_FONT_SIZE, String(restoredFontSizePt));
      localStorage.setItem(LOCAL_STORAGE_DRAFT_LINE_HEIGHT, restoredLineHeight);
      localStorage.setItem(LOCAL_STORAGE_DRAFT_PAGE_MARGINS, restoredPageMargins);
      localStorage.setItem(LOCAL_STORAGE_DRAFT_PLANTILLA, restoredTipoHoja === 'blanca' ? 'hoja_en_blanco' : '');
    } catch (e) {
      console.warn('Error sincronizando borrador local:', e);
    }

    // Inyección forzada garantizada en el nodo contentEditable
    if (editorContentRef.current) {
      editorContentRef.current.innerHTML = docTexto;
      requestAnimationFrame(() => {
        if (editorContentRef.current) {
          recalcularPaginacionVisual(editorContentRef.current);
        }
      });
    }

    // Foco Automático al inicio del documento sin desplazamiento y scroll arriba en barra de tareas
    setTimeout(() => {
      if (editorContentRef.current) {
        editorContentRef.current.innerHTML = docTexto;
        requestAnimationFrame(() => {
          if (editorContentRef.current) {
            recalcularPaginacionVisual(editorContentRef.current);
          }
        });
        scrollEditorAlInicio();
        editorContentRef.current.focus({ preventScroll: true });
        try {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(editorContentRef.current);
          range.collapse(true);
          selection?.removeAllRanges();
          selection?.addRange(range);
        } catch {
          // Focus básico garantizado
        }
      } else {
        scrollEditorAlInicio();
      }
    }, 50);

    setSaveSuccessBanner(`"${cleanTitle}" cargado en el Editor de Escritos.`);
    setTimeout(() => setSaveSuccessBanner(null), 3500);
  };

  // Duplicar documento en Firestore y almacenamiento local
  const handleDuplicarDocumento = async (escrito: Escrito) => {
    try {
      const user = auth?.currentUser;
      const nuevoTipo = `${escrito.tipo} (Copia)`;
      const nuevaCat = escrito.categoria || 'Contratos Privados';

      const docTipoHoja: 'blanca' | 'protocolo' =
        escrito.tipoHoja === 'protocolo' || (escrito as any).tipoPapel === 'protocolo'
          ? 'protocolo'
          : 'blanca';

      if (escrito.id.startsWith('temp-')) {
        const tempDocsString = localStorage.getItem('escritos_temporales');
        const tempDocs = tempDocsString ? JSON.parse(tempDocsString) : [];
        const newTempDoc = {
          texto: escrito.texto,
          tipo: nuevoTipo,
          tipoHoja: docTipoHoja,
          categoria: nuevaCat,
          userId: user?.uid || 'temp',
          fechaCreacion: new Date().toISOString()
        };
        tempDocs.unshift(newTempDoc);
        localStorage.setItem('escritos_temporales', JSON.stringify(tempDocs));
        setEscritos(prev => [
          {
            id: `temp-${Date.now()}`,
            ...newTempDoc,
            fechaCreacion: {
              toMillis: () => Date.now(),
              toDate: () => new Date()
            } as any
          },
          ...prev
        ]);
      } else {
        if (!workspaceId) {
          console.error("Operación abortada: Workspace no identificado.");
          return;
        }
        const creatorName = (currentUser as any)?.nombre || userProfile?.nombre || userProfile?.razonSocial || (currentUser as any)?.displayName || currentUser?.email?.split('@')[0] || (user as any)?.displayName || user?.email?.split('@')[0] || 'Usuario';
        const creatorRole = (currentUser as any)?.role || (currentUser as any)?.rol || userProfile?.rol || userProfile?.role || 'titular';
        const { id, ...dataToCopy } = escrito;
        await addDoc(collection(db, 'documentos_olga'), {
          ...dataToCopy,
          tipoHoja: docTipoHoja,
          userId: workspaceId,            // El propietario legal de los datos (Titular)
          creator_id: user?.uid,          // Rastro de auditoría: Quién lo digitó
          createdBy: user?.uid,
          creator_name: creatorName,
          creator_role: creatorRole,
          tipo: nuevoTipo,
          createdAt: new Date().toISOString(),
          fechaCreacion: serverTimestamp()
        });
      }

      setSaveSuccessBanner(`¡"${nuevoTipo}" duplicado con éxito!`);
      setTimeout(() => setSaveSuccessBanner(null), 3500);
    } catch (err) {
      console.error("Error al duplicar escrito:", err);
      alert("Error al duplicar el escrito.");
    }
  };

  // Eliminar documento permanentemente
  const handleEliminarDocumento = async (escrito: Escrito) => {
    try {
      if (escrito.id.startsWith('temp-')) {
        const tempDocsString = localStorage.getItem('escritos_temporales');
        if (tempDocsString) {
          const tempDocs = JSON.parse(tempDocsString);
          const idx = parseInt(escrito.id.replace('temp-', ''), 10);
          tempDocs.splice(idx, 1);
          localStorage.setItem('escritos_temporales', JSON.stringify(tempDocs));
          setEscritos(prev => prev.filter(item => item.id !== escrito.id));
        }
      } else {
        const docRef = doc(db, 'documentos_olga', escrito.id);
        await deleteDoc(docRef);
      }
      setDocToDelete(null);
      setSaveSuccessBanner(`"${escrito.tipo}" eliminado con éxito.`);
      setTimeout(() => setSaveSuccessBanner(null), 3500);
    } catch (err) {
      console.error("Fallo al borrar:", err);
      alert("No se pudo eliminar el documento.");
    }
  };

  const QUICK_AI_PROMPTS = [
    { label: 'Cláusula Penal y Mora', prompt: 'Redacta una cláusula penal de indemnización por mora automática del 2% mensual para contrato de compraventa o locación.' },
    { label: 'Pacto Comisorio Expreso', prompt: 'Redacta una cláusula de pacto comisorio expreso y resolución de pleno derecho por incumplimiento de pago de cuotas.' },
    { label: 'Rescisión Unilateral', prompt: 'Redacta una cláusula de rescisión unilateral con preaviso de 30 días y liquidación de expensas e impuestos.' },
    { label: 'Jurisdicción Asunción', prompt: 'Redacta una cláusula de jurisdicción y prórroga de competencia expresa ante los Juzgados Ordinarios de Asunción.' },
    { label: 'Poder Especial Bancario', prompt: 'Redacta facultades especiales para cobro de cheques, apertura de cuentas y transferencias bancarias en Paraguay.' }
  ];

  // Filtrado LOCAL sobre el estado de React (regla crítica: prohibido peticiones al escribir)
  const filteredEscritos = escritos.filter(escrito => {
    const matchCategory = activeCategory === 'Todos' || escrito.categoria === activeCategory;
    const queryLower = searchFilter.toLowerCase();
    const matchSearch = !searchFilter.trim() ||
      escrito.tipo.toLowerCase().includes(queryLower) ||
      stripHtmlToPlainText(escrito.texto).toLowerCase().includes(queryLower);
    return matchCategory && matchSearch;
  });

  const cleanText = stripHtmlToPlainText(editorText);
  const wordCount = cleanText ? cleanText.split(/\s+/).filter(Boolean).length : 0;
  const charCount = cleanText.length;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Toast Flotante de Éxito Post-Guardado (Diseño Verde Enterprise) */}
      {mensajeExito && (
        <div className="fixed top-6 right-6 z-50 max-w-md bg-green-50 border border-green-200 text-green-800 px-4 py-3.5 rounded-2xl shadow-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center shrink-0 text-green-700">
              <Check className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <p className="text-xs font-bold text-green-900 leading-tight">Documento guardado con éxito</p>
              <p className="text-[11px] text-green-700 font-medium leading-tight mt-0.5">{mensajeExito}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMensajeExito(null)}
            className="text-green-600 hover:text-green-900 p-1 rounded-lg hover:bg-green-100/60 transition-colors cursor-pointer"
            title="Cerrar notificación"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Banner de confirmación secundario al guardar */}
      {saveSuccessBanner && !mensajeExito && (
        <div className="bg-slate-900 text-white border-l-4 border-[#FF3131] p-4 rounded-2xl flex items-center justify-between text-xs font-bold animate-in fade-in shadow-md">
          <div className="flex items-center gap-2.5">
            <FileCheck className="w-4 h-4 text-[#FF3131]" />
            <span>{saveSuccessBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccessBanner(null)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. MODO DASHBOARD: VISIBLE ÚNICAMENTE CUANDO mostrarEditor ES FALSE        */}
      {/* ========================================================================= */}
      {!mostrarEditor && (
        <>
          {/* Cabecera Minimalista Unificada */}
          <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-700">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-slate-900 font-semibold text-lg tracking-tight">
                  Gestión de Escritos y Documentos
                </h2>
                <p className="text-slate-500 text-xs mt-0.5">
                  Redacción asistida con IA, editor de documentos y archivo organizado.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
              <span className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 tabular-nums whitespace-nowrap shrink-0">
                {escritos.length} en archivo
              </span>

              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('seccion-gestion-documental');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="h-9 px-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <FolderInput className="w-3.5 h-3.5 text-slate-500" />
                <span>Ver Archivo Documental</span>
              </button>
            </div>
          </div>

          {/* Panel Superior Minimalista: Dos Columnas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
            {/* Tarjeta Izquierda: Redacción Asistida con IA */}
            <div className="w-full bg-white rounded-xl p-5 border border-slate-200 flex flex-col justify-between space-y-4 h-full">
              <div className="space-y-3">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Redacción Asistida con IA
                    </h3>
                    <span className="text-[11px] text-slate-500">
                      Borradores y cláusulas adaptadas con respaldo de antecedentes
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Genera contratos, notas, escritos o cláusulas conforme a tus requerimientos y adjunta documentos de referencia.
                </p>

                {aiDraftProposal && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-2 text-xs font-medium text-slate-700">
                    <span className="flex items-center gap-2 truncate tabular-nums">
                      <span className="w-2 h-2 rounded-full bg-slate-900 shrink-0"></span>
                      <span>Borrador listo para revisión ({aiDraftProposal.trim().split(/\s+/).filter(Boolean).length} pal.)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAiModalOpen(true)}
                      className="text-xs font-semibold text-slate-900 underline hover:text-slate-700 shrink-0 cursor-pointer"
                    >
                      Abrir Borrador
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(true)}
                  className="w-full h-10 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-medium text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-slate-600" />
                  <span>Generar Borrador con IA</span>
                </button>
              </div>
            </div>

            {/* Tarjeta Derecha: Plantillas y Tipos de Escrito */}
            <div className="w-full bg-white rounded-xl p-5 border border-slate-200 flex flex-col justify-between space-y-4 h-full">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Plantillas y Tipos de Escrito
                      </h3>
                      <span className="text-[11px] text-slate-500">
                        Selecciona un modelo o comienza en hoja en blanco
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1.5">
                    Modelo base
                  </label>
                  <select
                    value={
                      isMenuPlantillasBloqueado
                        ? ''
                        : (esAbogadoEsc
                            ? PLANTILLAS_ABOGADOS_META
                            : esPlayeroEsc
                              ? PLANTILLAS_PLAYERO_META
                              : esSectorPublicoBeta
                                ? PLANTILLAS_SECTOR_PUBLICO_BETA_META
                                : PLANTILLAS_NOTARIALES
                          ).some((p) => p.id === selectedPlantillaId)
                          ? selectedPlantillaId
                          : ''
                    }
                    disabled={isMenuPlantillasBloqueado}
                    onChange={(e) => {
                      if (isMenuPlantillasBloqueado) return;
                      const val = e.target.value;
                      setSelectedPlantillaId(val);
                      if (val && val.trim() !== '') {
                        setMostrarEditor(true);
                        handleSelectPlantilla(val);
                      }
                    }}
                    className={`w-full box-border border rounded-lg px-3 py-2.5 text-xs font-medium outline-none transition-colors ${
                      isMenuPlantillasBloqueado
                        ? 'bg-red-50/80 border-red-200 text-red-700 cursor-not-allowed'
                        : 'bg-slate-50 border-slate-200 focus:border-slate-400 text-slate-900 cursor-pointer'
                    }`}
                  >
                    <option value="" disabled>
                      {isMenuPlantillasBloqueado
                        ? 'Sesión de prueba expirada — Adquiere un plan para habilitar'
                        : 'Seleccionar plantilla o hoja en blanco...'}
                    </option>
                    {!isMenuPlantillasBloqueado && (
                      esAbogadoEsc ? (
                        <>
                          {PLANTILLAS_ABOGADOS_META.map((plantilla) => (
                            <option key={plantilla.id} value={plantilla.id}>
                              {plantilla.nombre}
                            </option>
                          ))}
                        </>
                      ) : esPlayeroEsc ? (
                        <>
                          {PLANTILLAS_PLAYERO_META.map((plantilla) => (
                            <option key={plantilla.id} value={plantilla.id}>
                              {plantilla.nombre}
                            </option>
                          ))}
                        </>
                      ) : esSectorPublicoBeta ? (
                        <>
                          {PLANTILLAS_SECTOR_PUBLICO_BETA_META.map((plantilla) => (
                            <option key={plantilla.id} value={plantilla.id}>
                              {plantilla.nombre}
                            </option>
                          ))}
                        </>
                      ) : (
                        <>
                          <option value="hoja_en_blanco">Hoja en Blanco (Redacción Libre)</option>
                          {PLANTILLAS_NOTARIALES.filter(p => p.id !== 'hoja_en_blanco').map((plantilla) => (
                            <option key={plantilla.id} value={plantilla.id}>
                              {plantilla.nombre}
                            </option>
                          ))}
                        </>
                      )
                    )}
                  </select>
                </div>

                <p className={`text-[11px] leading-relaxed ${isMenuPlantillasBloqueado ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                  {isMenuPlantillasBloqueado
                    ? 'Sesión de prueba expirada. Adquiere un plan para habilitar el catálogo de plantillas.'
                    : 'Al seleccionar una plantilla u Hoja en Blanco, se abrirá el editor listo para completar y exportar.'}
                </p>
              </div>

              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleNuevoEscrito}
                  className="flex-1 h-10 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nuevo Escrito</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* 2. CUERPO CENTRAL: EDITOR DE ESCRITOS ACTIVO                              */}
      {/* ========================================================================= */}
      {mostrarEditor && (
        <div id="editor-notarial-activo-bloque" className="space-y-4 animate-in fade-in duration-300">
          {/* CABECERA EJECUTIVA LIMPIA EN 3 FILAS */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            {/* FILA 1: Navegación + Título del Editor + Acciones */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setMostrarEditor(false);
                    setSelectedPlantillaId('');
                  }}
                  className="h-9 px-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  title="Volver al archivo documental (ESC)"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Volver</span>
                </button>

                <div className="h-5 w-px bg-slate-200 shrink-0" />

                <div className="flex items-center gap-2 min-w-0">
                  <Edit3 className="w-4 h-4 text-slate-600 shrink-0" />
                  <h2 className="text-sm font-semibold text-slate-900 truncate">
                    {previewMode ? 'Vista Previa de Escrito' : 'Editor de Escritos'}
                  </h2>
                </div>

                {activeEditingDoc && (
                  <div className="hidden lg:flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg text-[11px] text-slate-500">
                    <span className="font-mono tabular-nums">
                      Ref: {activeEditingDoc.correlativo || String(activeEditingDoc.id || '').slice(0, 3)}-{String(activeEditingDoc.id || '').slice(-6)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopiarCodigoSoporte(activeEditingDoc)}
                      className="flex items-center gap-1 text-[10px] font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                      title="Copiar código de soporte"
                    >
                      {copiedSupportId === activeEditingDoc.id ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Clipboard className="w-3 h-3 text-slate-400" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleLimpiarEditor}
                  className="h-9 px-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  title="Limpiar el editor e iniciar hoja en blanco"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Hoja en Blanco</span>
                </button>

                <input
                  type="file"
                  ref={docImportInputRef}
                  accept=".docx,.pdf,.txt"
                  className="hidden"
                  onChange={handleFileImport}
                />
                <button
                  type="button"
                  onClick={() => docImportInputRef.current?.click()}
                  className="h-9 px-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  title="Importar documento (.docx, .pdf, .txt)"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  <span>Importar .docx</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewMode(!previewMode)}
                  className={`h-9 px-3 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                    previewMode
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{previewMode ? 'Editar' : 'Vista Previa'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopiarTexto}
                  disabled={!editorText}
                  className="h-9 px-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  title="Copiar contenido al portapapeles"
                >
                  {copiedFeedback ? (
                    <>
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { void handleDescargarPDF(documentTitle, undefined, includeHeader, editorFontFamily, editorFontSizePt); }}
                  disabled={!editorText.trim() || isExportingPDF}
                  className="h-9 px-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  title="Descargar archivo PDF"
                >
                  {isExportingPDF ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                  ) : (
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span>{isExportingPDF ? 'Generando...' : 'PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleImprimirPDF}
                  disabled={!editorText.trim()}
                  className="h-9 px-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  title="Imprimir documento respetando espacios y formato"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>Imprimir</span>
                </button>

                <button
                  type="button"
                  onClick={handleGuardarEscrito}
                  disabled={isSavingDraft || !editorText.trim()}
                  className="h-9 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  {isSavingDraft ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>{isSavingDraft ? 'Guardando...' : 'Guardar Escrito'}</span>
                </button>

                {isWhatsAppEnabled && (
                  <button
                    type="button"
                    onClick={() => handleSendDocumentByWhatsApp(documentTitle, editorText, includeHeader, editorFontFamily, editorFontSizePt)}
                    disabled={!editorText.trim()}
                    className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    title="Generar PDF y enviar por WhatsApp"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>
                )}
              </div>
            </div>

            {/* FILA 2: Título, Carpeta, Tipo de Hoja y Membrete */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-2 border-t border-slate-100">
              <div className="sm:col-span-5">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Título del Escrito
                </label>
                <input
                  type="text"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  placeholder="Ej. Contrato de Compraventa Inmueble..."
                  className="w-full box-border h-9 bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-lg px-3 text-xs font-medium text-slate-900 outline-none"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Carpeta de Archivo
                </label>
                <select
                  value={selectedCategoryForSave}
                  onChange={(e) => setSelectedCategoryForSave(e.target.value)}
                  className="w-full box-border h-9 bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-lg px-3 text-xs font-medium text-slate-800 outline-none cursor-pointer"
                >
                  {sortedCarpetas.map(c => (
                    <option key={c.id} value={c.nombre}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Formato de Hoja
                </label>
                <select
                  value="blanca"
                  onChange={() => setTipoHoja('blanca')}
                  className="w-full box-border h-9 bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-lg px-2.5 text-xs font-medium text-slate-800 outline-none cursor-pointer"
                  title="Hoja en Blanco (A4)"
                >
                  <option value="blanca">Hoja en Blanco (A4)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={includeHeader}
                  onClick={() => setIncludeHeader((prev) => !prev)}
                  className={`w-full h-9 inline-flex items-center justify-between gap-2 px-3 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    includeHeader
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                  title="Activar o desactivar el membrete en vista previa, impresión, PDF y WhatsApp"
                >
                  <span>Membrete</span>
                  <span
                    className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                      includeHeader ? 'bg-slate-900' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        includeHeader ? 'translate-x-3.5' : 'translate-x-0.5'
                      }`}
                    />
                  </span>
                </button>
              </div>
            </div>

            {/* FILA 3: Barra de Herramientas de Formato, Tipografía y Tamaño */}
            {mostrarBarraHerramientas && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 flex flex-wrap items-center gap-1.5">
                {/* Formato de Texto: Negrita, Cursiva, Subrayado */}
                <div className="flex items-center gap-1 pr-2 border-r border-slate-200">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => executeCommand('bold')}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      activeFormats.bold
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-white hover:text-slate-900'
                    }`}
                    title="Negrita"
                  >
                    <Bold className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => executeCommand('italic')}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      activeFormats.italic
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-white hover:text-slate-900'
                    }`}
                    title="Cursiva"
                  >
                    <Italic className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => executeCommand('underline')}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      activeFormats.underline
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-white hover:text-slate-900'
                    }`}
                    title="Subrayado"
                  >
                    <Underline className="w-4 h-4" />
                  </button>

                  {/* Paleta compacta de Color de Texto */}
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const sel = window.getSelection();
                        if (sel && sel.rangeCount > 0 && editorContentRef.current?.contains(sel.anchorNode)) {
                          savedColorRangeRef.current = sel.getRangeAt(0).cloneRange();
                        }
                      }}
                      onClick={() => setIsColorPaletteOpen((prev) => !prev)}
                      className={`px-2 py-1 rounded-md transition-colors cursor-pointer flex flex-col items-center justify-center ${
                        isColorPaletteOpen
                          ? 'bg-slate-200 text-slate-900'
                          : 'text-slate-700 hover:bg-white hover:text-slate-900'
                      }`}
                      title="Color de texto"
                      aria-label="Color de texto"
                    >
                      <span className="text-xs font-bold leading-none">A</span>
                      <span
                        className="h-[3px] w-3.5 rounded-full mt-0.5 border border-slate-300/60"
                        style={{ backgroundColor: activeTextColor }}
                      />
                    </button>

                    {isColorPaletteOpen && (
                      <div className="absolute left-0 top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-lg shadow-lg p-2 w-[156px]">
                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 px-0.5">
                          Color de texto
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {EDITOR_TEXT_COLORS.map((c) => (
                            <button
                              key={c.hex}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleApplyTextColor(c.hex)}
                              title={c.label}
                              aria-label={c.label}
                              className={`w-7 h-7 rounded-md border transition-transform hover:scale-105 cursor-pointer flex items-center justify-center ${
                                activeTextColor === c.hex
                                  ? 'border-slate-900 ring-1 ring-slate-900'
                                  : 'border-slate-200'
                              }`}
                              style={{ backgroundColor: c.hex }}
                            >
                              {activeTextColor === c.hex && (
                                <Check className="w-3.5 h-3.5 text-white drop-shadow" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tipografía, Tamaño, Interlineado y Márgenes */}
                <div className="flex flex-wrap items-center gap-1.5 px-2 border-r border-slate-200">
                  <select
                    value={editorFontFamily}
                    onChange={(e) => setEditorFontFamily(e.target.value)}
                    className="h-8 bg-white border border-slate-200 focus:border-slate-400 rounded-md px-2 text-xs font-medium text-slate-800 outline-none cursor-pointer"
                    title="Tipo de letra del documento"
                    aria-label="Tipo de letra"
                  >
                    {EDITOR_FONT_FAMILIES.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center bg-white border border-slate-200 rounded-md overflow-hidden">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const idx = EDITOR_FONT_SIZES_PT.indexOf(editorFontSizePt as (typeof EDITOR_FONT_SIZES_PT)[number]);
                        const nextIdx = idx > 0 ? idx - 1 : 0;
                        setEditorFontSizePt(EDITOR_FONT_SIZES_PT[nextIdx]);
                      }}
                      disabled={editorFontSizePt <= EDITOR_FONT_SIZES_PT[0]}
                      className="h-8 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer border-r border-slate-200"
                      title="Disminuir tamaño de letra"
                    >
                      A-
                    </button>
                    <select
                      value={editorFontSizePt}
                      onChange={(e) => setEditorFontSizePt(Number(e.target.value))}
                      className="h-8 bg-white px-2 text-xs font-medium text-slate-800 outline-none cursor-pointer tabular-nums"
                      title="Tamaño de letra en puntos"
                      aria-label="Tamaño de letra"
                    >
                      {EDITOR_FONT_SIZES_PT.map((pt) => (
                        <option key={pt} value={pt}>
                          {pt}pt
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const idx = EDITOR_FONT_SIZES_PT.indexOf(editorFontSizePt as (typeof EDITOR_FONT_SIZES_PT)[number]);
                        const maxIdx = EDITOR_FONT_SIZES_PT.length - 1;
                        const nextIdx = idx >= 0 && idx < maxIdx ? idx + 1 : maxIdx;
                        setEditorFontSizePt(EDITOR_FONT_SIZES_PT[nextIdx]);
                      }}
                      disabled={editorFontSizePt >= EDITOR_FONT_SIZES_PT[EDITOR_FONT_SIZES_PT.length - 1]}
                      className="h-8 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer border-l border-slate-200"
                      title="Aumentar tamaño de letra"
                    >
                      A+
                    </button>
                  </div>

                  <select
                    value={editorLineHeight}
                    onChange={(e) => setEditorLineHeight(e.target.value)}
                    className="h-8 bg-white border border-slate-200 focus:border-slate-400 rounded-md px-2 text-xs font-medium text-slate-800 outline-none cursor-pointer"
                    title="Interlineado del documento"
                    aria-label="Interlineado"
                  >
                    {EDITOR_LINE_HEIGHTS.map((lh) => (
                      <option key={lh.value} value={lh.value}>
                        Interl. {lh.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={pageMargins}
                    onChange={(e) => setPageMargins(e.target.value as EditorPageMargins)}
                    className="h-8 bg-white border border-slate-200 focus:border-slate-400 rounded-md px-2 text-xs font-medium text-slate-800 outline-none cursor-pointer"
                    title="Márgenes de la hoja A4"
                    aria-label="Márgenes de hoja"
                  >
                    {(Object.keys(PAGE_MARGIN_PROFILES) as EditorPageMargins[]).map((key) => (
                      <option key={key} value={key}>
                        Márgenes: {PAGE_MARGIN_PROFILES[key].label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Alineación: Izquierda, Centro, Derecha, Justificar */}
                <div className="flex items-center gap-1 px-2 border-r border-slate-200">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleAlign('left')}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      activeFormats.justifyLeft
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-white hover:text-slate-900'
                    }`}
                    title="Alinear a la izquierda"
                  >
                    <AlignLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleAlign('center')}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      activeFormats.justifyCenter
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-white hover:text-slate-900'
                    }`}
                    title="Centrar"
                  >
                    <AlignCenter className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleAlign('right')}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      activeFormats.justifyRight
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-white hover:text-slate-900'
                    }`}
                    title="Alinear a la derecha"
                  >
                    <AlignRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleAlign('justify')}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      activeFormats.justifyFull
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-white hover:text-slate-900'
                    }`}
                    title="Justificar"
                  >
                    <AlignJustify className="w-4 h-4" />
                  </button>
                </div>

                {/* Listas y Línea Separadora */}
                <div className="flex items-center gap-1 pl-1">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => executeCommand('insertUnorderedList')}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      activeFormats.insertUnorderedList
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-white hover:text-slate-900'
                    }`}
                    title="Lista con viñetas"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => executeCommand('insertOrderedList')}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      activeFormats.insertOrderedList
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-white hover:text-slate-900'
                    }`}
                    title="Lista numerada"
                  >
                    <ListOrdered className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleInsertHorizontalRule}
                    className="p-1.5 rounded-md text-slate-700 hover:bg-white hover:text-slate-900 transition-colors cursor-pointer"
                    title="Insertar línea horizontal separadora"
                    aria-label="Insertar línea horizontal"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                </div>

                <div className="ml-auto hidden sm:flex items-center gap-2 text-[11px] text-slate-500 font-medium tabular-nums pr-1">
                  <span>
                    {totalPaginasVisuales} {totalPaginasVisuales === 1 ? 'pág.' : 'págs.'} · {wordCount} palabras
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* MESA DE TRABAJO Y HOJA DEL DOCUMENTO */}
          <div className="bg-[#e2e8f0] py-8 px-4 sm:px-8 rounded-xl border border-slate-300/70 overflow-x-auto flex flex-col items-center">
            <style>{`
              #editor-notarial-activo,
              .editor-notarial-papel {
                width: 100% !important;
                max-width: 850px !important;
                min-height: 1056px;
                background-color: #ffffff !important;
                box-shadow: none !important;
                border-radius: ${esHojaEnBlanco && includeHeader ? '0 0 4px 4px' : '4px'} !important;
                color: #000000;
                padding-top: ${
                  includeHeader
                    ? '14px'
                    : `${PAGE_MARGIN_PROFILES[pageMargins].topCm}cm`
                } !important;
                padding-bottom: ${PAGE_MARGIN_PROFILES[pageMargins].bottomCm}cm !important;
                padding-left: ${PAGE_MARGIN_PROFILES[pageMargins].leftCm}cm !important;
                padding-right: ${PAGE_MARGIN_PROFILES[pageMargins].rightCm}cm !important;
                font-family: ${resolveEditorFontCss(editorFontFamily)} !important;
                font-size: ${editorFontSizePt}pt !important;
                line-height: ${editorLineHeight} !important;
                text-align: justify;
                text-justify: inter-word !important;
                white-space: pre-wrap !important;
                tab-size: 4 !important;
                -moz-tab-size: 4 !important;
                word-break: break-word !important;
                box-sizing: border-box !important;
                position: relative !important;
                outline: none !important;
              }

              /* Salto de Página Visual Limpio y Discreto */
              .salto-de-pagina,
              .salto-automatico {
                display: block !important;
                width: 100% !important;
                margin-left: 0 !important;
                margin-right: 0 !important;
                margin-top: 24px !important;
                margin-bottom: 24px !important;
                height: 32px !important;
                background-color: #e2e8f0 !important;
                border-radius: 4px !important;
                position: relative !important;
                user-select: none !important;
                cursor: default !important;
                box-shadow: none !important;
                break-after: page !important;
                page-break-after: always !important;
              }

              .salto-de-pagina-badge {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 3px 10px;
                border-radius: 9999px;
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                background-color: #ffffff;
                color: #475569;
                border: 1px solid #cbd5e1;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
              }

              #editor-notarial-activo *,
              .editor-notarial-papel * {
                font-family: inherit;
              }
              #editor-notarial-activo p,
              #editor-notarial-activo div:not(.salto-de-pagina):not(.salto-de-pagina-badge),
              .editor-notarial-papel p,
              .editor-notarial-papel div:not(.salto-de-pagina):not(.salto-de-pagina-badge) {
                margin-top: 0 !important;
                margin-bottom: 4px !important;
                min-height: ${editorLineHeight}em !important;
                text-align: justify;
                text-justify: inter-word !important;
                line-height: ${editorLineHeight} !important;
                white-space: pre-wrap !important;
                overflow-wrap: anywhere !important;
                word-break: break-word !important;
                tab-size: 4 !important;
                -moz-tab-size: 4 !important;
              }
              #editor-notarial-activo [data-olga-page-spacer="true"],
              .editor-notarial-papel [data-olga-page-spacer="true"] {
                margin-top: var(--olga-spacer-mt) !important;
              }
              #editor-notarial-activo hr,
              .editor-notarial-papel hr {
                border: none !important;
                border-top: 1px solid #94a3b8 !important;
                margin: 12px 0 !important;
              }
              #editor-notarial-activo img,
              .editor-notarial-papel img {
                max-width: 100% !important;
                height: auto !important;
                display: block !important;
                margin: 6px 0 !important;
                break-inside: avoid;
              }
              #editor-notarial-activo table,
              .editor-notarial-papel table {
                width: 100% !important;
                border-collapse: collapse !important;
                table-layout: auto !important;
                margin: 8px 0 !important;
              }
              #editor-notarial-activo td,
              #editor-notarial-activo th,
              .editor-notarial-papel td,
              .editor-notarial-papel th {
                border: 1px solid #cbd5e1 !important;
                padding: 6px 8px !important;
                vertical-align: top !important;
                white-space: normal !important;
                overflow-wrap: anywhere !important;
                word-break: break-word !important;
              }
              #editor-notarial-activo strong,
              .editor-notarial-papel strong,
              #editor-notarial-activo b,
              .editor-notarial-papel b {
                font-weight: 700 !important;
              }
              #editor-notarial-activo ul,
              .editor-notarial-papel ul {
                list-style-type: disc !important;
                padding-left: 2rem !important;
                margin-top: 0.5rem !important;
                margin-bottom: 0.5rem !important;
              }
              #editor-notarial-activo ol,
              .editor-notarial-papel ol {
                list-style-type: decimal !important;
                padding-left: 2rem !important;
                margin-top: 0.5rem !important;
                margin-bottom: 0.5rem !important;
              }
              #editor-notarial-activo li,
              .editor-notarial-papel li {
                display: list-item !important;
                margin-bottom: 0.25rem !important;
                line-height: ${editorLineHeight} !important;
                text-align: justify;
                white-space: pre-wrap !important;
                overflow-wrap: anywhere !important;
                word-break: break-word !important;
                tab-size: 4 !important;
                -moz-tab-size: 4 !important;
              }

              /* Reglas estrictas para impresión */
              @media print {
                #editor-notarial-activo,
                .editor-notarial-papel {
                  box-shadow: none !important;
                  border-radius: 0 !important;
                  min-height: 0 !important;
                  height: auto !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  background: transparent !important;
                  color: #000000 !important;
                  white-space: pre-wrap !important;
                  overflow-wrap: anywhere !important;
                  word-break: break-word !important;
                  tab-size: 4 !important;
                  -moz-tab-size: 4 !important;
                }

                .salto-de-pagina,
                .salto-automatico {
                  display: block !important;
                  height: 0 !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  border: none !important;
                  background: transparent !important;
                  break-after: page !important;
                  page-break-after: always !important;
                }

                .salto-de-pagina *,
                .salto-automatico * {
                  display: none !important;
                }

                [data-olga-page-spacer="true"] {
                  margin-top: 0 !important;
                }
              }
            `}</style>
            <div className="relative w-full max-w-[850px] mx-auto shadow-md rounded-[4px] bg-white border border-slate-200/90">
              {esHojaEnBlanco && includeHeader && (
                <div
                  ref={membretePreviewRef}
                  style={{
                    paddingLeft: `${PAGE_MARGIN_PROFILES[pageMargins].leftCm}cm`,
                    paddingRight: `${PAGE_MARGIN_PROFILES[pageMargins].rightCm}cm`,
                  }}
                  className="w-full bg-white pt-4 text-center rounded-t-[4px] select-none print:hidden"
                >
                  <div className="border-b border-[#94a3b8] pb-2">
                    {rawLogoInstitucional && (
                      <img
                        src={rawLogoInstitucional}
                        alt={nombreEscHeader}
                        onLoad={debouncedVerificarPaginacion}
                        style={{ maxHeight: '38px', width: 'auto', margin: '0 auto 4px auto', display: 'block' }}
                        className="object-contain"
                      />
                    )}
                    <div
                      style={{
                        fontFamily: resolveEditorFontCss(editorFontFamily),
                        fontSize: '12pt',
                        fontWeight: 700,
                        lineHeight: 1.2,
                        margin: '0 0 2px 0',
                      }}
                      className="uppercase tracking-[0.03em] text-slate-900"
                    >
                      {nombreEscHeader}
                    </div>
                    {(registroEscHeader && registroEscHeader !== '---') ||
                    (rucEscHeader && rucEscHeader !== '---') ||
                    (telefonoEscHeader && telefonoEscHeader !== '---') ||
                    (direccionEscHeader && direccionEscHeader !== '---') ? (
                      <p
                        style={{
                          fontSize: '8.5pt',
                          color: '#475569',
                          lineHeight: 1.25,
                          margin: 0,
                        }}
                        className="font-sans"
                      >
                        {[
                          registroEscHeader && registroEscHeader !== '---'
                            ? (esAbogadoEsc
                                ? (/matr[ií]cula/i.test(registroEscHeader) ? registroEscHeader : `Matrícula CSJ N.º ${registroEscHeader}`)
                                : (/reg/i.test(registroEscHeader) ? registroEscHeader : `Registro N.º ${registroEscHeader}`))
                            : null,
                          rucEscHeader && rucEscHeader !== '---' ? `RUC: ${rucEscHeader}` : null,
                          telefonoEscHeader && telefonoEscHeader !== '---' ? `Tel.: ${telefonoEscHeader}` : null,
                          direccionEscHeader && direccionEscHeader !== '---' ? direccionEscHeader : null,
                        ]
                          .filter(Boolean)
                          .join('  •  ')}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
              <div className="relative w-full">
                <div
                  ref={setEditorRef}
                  id="editor-notarial-activo"
                  contentEditable={!previewMode}
                  suppressContentEditableWarning={true}
                  onInput={(e) => {
                    setEditorText(limpiarEspaciadoresVisualesHtml(e.currentTarget.innerHTML));
                    debouncedVerificarPaginacion();
                  }}
                  onPaste={handlePaste}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab' && !previewMode) {
                      e.preventDefault();
                      document.execCommand('insertText', false, '\t');
                      if (editorContentRef.current) {
                        setEditorText(editorContentRef.current.innerHTML);
                      }
                      debouncedVerificarPaginacion();
                    }
                  }}
                  onKeyUp={(e) => {
                    checkFormatStates();
                    if (e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Delete') {
                      debouncedVerificarPaginacion();
                    }
                  }}
                  onMouseUp={checkFormatStates}
                  onFocus={() => {
                    checkFormatStates();
                    try {
                      document.execCommand('defaultParagraphSeparator', false, 'p');
                    } catch (err) {}
                  }}
                  className={`w-full max-w-[850px] mx-auto outline-none overflow-visible text-justify text-black selection:bg-slate-200 selection:text-slate-900 transition-all editor-notarial-papel [&_ul]:list-disc [&_ul]:pl-8 [&_ol]:list-decimal [&_ol]:pl-8 [&_li]:list-item ${
                    previewMode ? 'select-text cursor-default' : 'cursor-text'
                  }`}
                />

                {/* Corte físico entre hojas A4 estilo Vista de Impresión (solo pantalla, nunca tapa texto, nunca se imprime ni se guarda) */}
                {visualPageBreaks.length > 0 && (
                  <div
                    aria-hidden="true"
                    className="olga-page-break-guide pointer-events-none select-none print:hidden absolute inset-0 overflow-visible z-10"
                  >
                    {visualPageBreaks.map((breakItem) => (
                      <div
                        key={breakItem.page}
                        style={{
                          top: `${breakItem.topPx}px`,
                          left: '-1px',
                          right: '-1px',
                          height: '28px',
                          backgroundColor: '#e2e8f0',
                          boxShadow:
                            'inset 0 6px 6px -6px rgba(15,23,42,0.18), inset 0 -5px 5px -5px rgba(15,23,42,0.12)',
                        }}
                        className="absolute border-t border-b border-slate-300 flex items-center justify-end pr-3 pointer-events-none select-none"
                      >
                        <span className="text-[10px] font-medium text-slate-500 tracking-wide">
                          Pág. {breakItem.page + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Barra de Acciones al pie de la última hoja */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-end gap-3 print:hidden">
            <button
              type="button"
              onClick={handleGuardarEscrito}
              disabled={isSavingDraft || !editorText.trim()}
              className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              {isSavingDraft ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{isSavingDraft ? 'Guardando...' : 'Guardar Escrito'}</span>
            </button>

            <button
              type="button"
              onClick={handleImprimirPDF}
              disabled={!editorText.trim()}
              className="h-9 px-3.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              title="Imprimir documento respetando espacios y formato"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Imprimir</span>
            </button>

            <button
              type="button"
              onClick={() => {
                void handleDescargarPDF(documentTitle, undefined, includeHeader, editorFontFamily, editorFontSizePt);
              }}
              disabled={!editorText.trim() || isExportingPDF}
              className="h-9 px-3.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              title="Descargar archivo PDF"
            >
              {isExportingPDF ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
              ) : (
                <Download className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>{isExportingPDF ? 'Generando...' : 'PDF'}</span>
            </button>

            <a
              href={
                editorText.trim()
                  ? `https://wa.me/?text=${encodeURIComponent(
                      `Hola, te comparto el documento: ${
                        (documentTitle || 'Documento').replace(/\s*\(Guardado Local\)\s*/gi, '').trim() || 'Documento'
                      }, emitido por ${(nombreEscHeader || '').trim() || 'nuestro estudio'}.`
                    )}`
                  : '#'
              }
              target={editorText.trim() ? '_blank' : undefined}
              rel={editorText.trim() ? 'noopener noreferrer' : undefined}
              aria-disabled={!editorText.trim()}
              onClick={(e) => {
                if (!editorText.trim()) e.preventDefault();
              }}
              className={`h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                !editorText.trim() ? 'opacity-40 pointer-events-none' : 'cursor-pointer'
              }`}
              title="Compartir documento por WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Enviar por WhatsApp</span>
            </a>
          </div>

          {/* Aviso Profesional */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-2.5 text-xs text-slate-600">
            <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              <strong className="text-slate-800">Aviso:</strong> Todo documento generado en este sistema es un borrador editable que requiere revisión y firma profesional antes de su emisión.
            </span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SECCIÓN INFERIOR DE ARCHIVOS Y CARPETAS (DASHBOARD DOCUMENTAL)         */}
      {/* ========================================================================= */}
      {!mostrarEditor && (
        <div id="seccion-gestion-documental" className="space-y-5 pt-4 border-t border-slate-200">
        <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <FolderInput className="w-4 h-4 text-slate-700" />
                <h3 className="text-base font-semibold text-slate-900 tracking-tight">Archivo Documental</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Escritos, contratos, notas y documentos clasificados por carpeta.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button 
                type="button"
                onClick={() => setIsAdminModalOpen(true)}
                className="h-9 px-3 flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-lg transition-colors border border-slate-200 shrink-0 cursor-pointer whitespace-nowrap"
              >
                <Settings className="w-3.5 h-3.5 text-slate-500" />
                <span>Administrar Carpetas</span>
              </button>
              <button
                type="button"
                onClick={handleNuevoEscrito}
                className="h-9 px-3.5 flex items-center gap-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shrink-0 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo Escrito</span>
              </button>
            </div>
          </div>

          {/* Búsqueda y Selector de Carpetas */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-1.5">
              {categorias.map(cat => {
                const count = cat === 'Todos' 
                  ? escritos.length 
                  : escritos.filter(e => e.categoria === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer tabular-nums ${
                      activeCategory === cat
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className={`text-[10px] px-1.5 rounded ${
                      activeCategory === cat ? 'bg-slate-800 text-slate-200' : 'bg-slate-200/80 text-slate-600'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Buscar por título o contenido..."
                className="w-full box-border h-9 pl-9 pr-7 bg-slate-50 border border-slate-200 focus:border-slate-400 rounded-lg text-xs font-medium outline-none text-slate-800 transition-colors"
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Grilla de documentos en la carpeta activa */}
        {loading ? (
          <div className="flex flex-col justify-center items-center h-48 bg-white rounded-xl border border-slate-200 gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-slate-600" />
            <span className="text-xs text-slate-500 font-medium">Cargando archivo documental...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-medium flex items-center justify-center border border-red-200">
            <span>{error}</span>
          </div>
        ) : filteredEscritos.length === 0 ? (
          <div className="text-center bg-white p-12 rounded-xl border border-slate-200 border-dashed">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">
              {searchFilter 
                ? `No se encontraron escritos que coincidan con "${searchFilter}".`
                : activeCategory === 'Todos' 
                  ? 'No hay escritos guardados en el archivo.' 
                  : `No hay escritos guardados en la carpeta "${activeCategory}".`}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Redacta con IA o usa una plantilla arriba y pulsa &quot;Guardar Escrito&quot; para archivarlo.
            </p>
            <button
              type="button"
              onClick={handleNuevoEscrito}
              className="mt-4 h-9 px-4 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Comenzar a Redactar
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredEscritos.map((escrito) => {
              let dateStr = 'Fecha reciente';
              if (escrito.createdAt) {
                dateStr = new Date(escrito.createdAt).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
              } else if (escrito.fechaCreacion && typeof escrito.fechaCreacion.toMillis === 'function') {
                dateStr = new Date(escrito.fechaCreacion.toMillis()).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
              }

              const plainExcerpt = stripHtmlToPlainText(escrito.texto);
              const cardWordCount = plainExcerpt ? plainExcerpt.split(/\s+/).filter(Boolean).length : 0;

              return (
                <div 
                  key={escrito.id} 
                  onClick={() => handleEditarDocumento(escrito)}
                  className={`bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all flex flex-col justify-between p-5 relative group cursor-pointer ${
                    activeMenuId === escrito.id ? 'z-30' : 'z-0 hover:z-10'
                  }`}
                >
                  <div>
                    {/* Cabecera de la Tarjeta con Menú */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-3 overflow-hidden min-w-0">
                        <div className="w-9 h-9 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="flex-1 overflow-hidden min-w-0">
                          <h4
                            className={`font-semibold text-slate-900 text-sm ${esAbogadoEsc ? 'line-clamp-2 break-words leading-snug' : 'truncate'}`}
                            title={escrito.tipo || 'Escrito'}
                          >
                            {escrito.tipo || 'Escrito'}
                          </h4>
                          <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                            <Calendar className="w-3 h-3 shrink-0 text-slate-400" />
                            <span className="truncate">{dateStr}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2 py-0.5 bg-slate-50 text-slate-600 text-[10px] font-medium rounded-md border border-slate-200 shrink-0">
                          {escrito.categoria || 'Sin Categoría'}
                        </span>

                        {/* Menú Desplegable (Tres Puntos) */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === escrito.id ? null : escrito.id);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Opciones del documento"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* Menú Flotante Dropdown de Opciones */}
                          {activeMenuId === escrito.id && (
                            <>
                              <div 
                                className="fixed inset-0 z-40 cursor-default" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(null);
                                }} 
                              />
                              <div 
                                className="absolute right-0 top-9 z-50 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 animate-in fade-in zoom-in-95 duration-150 text-xs font-medium"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                    handleEditarDocumento(escrito);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Abrir en Editor</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                    handleDuplicarDocumento(escrito);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Duplicar</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                    setMovingDoc(escrito);
                                    setTargetCategory(escrito.categoria || 'Sin Categoría');
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                  <FolderInput className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Mover a Carpeta</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                    onOpenDocument(
                                      escrito.texto,
                                      escrito.id,
                                      escrito.tipo,
                                      escrito.categoria,
                                      escrito.tipoHoja === 'protocolo' || (escrito as any).tipoPapel === 'protocolo'
                                        ? 'protocolo'
                                        : 'blanca',
                                      escrito.includeHeader !== false
                                    );
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer border-t border-slate-100"
                                >
                                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Imprimir / Membrete</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                    void handleDescargarPDF(
                                      escrito.tipo,
                                      escrito.texto,
                                      escrito.includeHeader !== false,
                                      escrito.fontFamily,
                                      escrito.fontSizePt,
                                      escrito.lineHeight,
                                      escrito.pageMargins
                                    );
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer border-t border-slate-100"
                                >
                                  <Download className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Exportar PDF</span>
                                </button>

                                {isWhatsAppEnabled && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMenuId(null);
                                      handleSendDocumentByWhatsApp(
                                        escrito.tipo,
                                        escrito.texto,
                                        escrito.includeHeader !== false,
                                        escrito.fontFamily,
                                        escrito.fontSizePt
                                      );
                                    }}
                                    className="w-full px-3 py-1.5 text-left text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 transition-colors cursor-pointer border-t border-slate-100"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Enviar por WhatsApp</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(null);
                                    setDocToDelete(escrito);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer border-t border-slate-100"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                  <span>Eliminar</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Fragmento de Texto Limpio (sin etiquetas HTML) */}
                    <div className="mt-3 mb-2">
                      <p className="text-xs text-slate-500 font-normal leading-relaxed line-clamp-3 select-none">
                        {plainExcerpt || 'Sin contenido textual.'}
                      </p>
                    </div>
                  </div>

                  {/* Pie de Tarjeta con Responsable / Creador */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-[11px] text-slate-500 font-medium shrink-0 tabular-nums">
                        {cardWordCount} palabras
                      </span>
                      <span className="text-slate-300">•</span>
                      <div className="flex items-center gap-1.5 overflow-hidden text-[11px]">
                        <span className="text-slate-400 shrink-0">Responsable:</span>
                        <span className="font-medium text-slate-700 truncate max-w-[110px]" title={escrito.creator_name || 'Titular'}>
                          {escrito.creator_name || 'Titular'}
                        </span>
                        {escrito.creator_role === 'operador' && (
                          <span className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider rounded bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                            Operador
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="text-slate-900 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[11px] shrink-0">
                      <span>Abrir &rarr;</span>
                    </span>
                  </div>

                  {/* Código de Soporte Técnico */}
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                    <span className="font-mono text-slate-400 text-[10px] truncate tabular-nums">
                      Ref: {escrito.correlativo || String(escrito.id || '').slice(0, 3)}-{String(escrito.id || '').slice(-6)}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleCopiarCodigoSoporte(escrito);
                        }}
                        className="flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 transition-colors cursor-pointer"
                        title="Copiar código estructurado para soporte técnico"
                      >
                        {copiedSupportId === escrito.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-700 text-[10px]">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Clipboard className="w-3 h-3" />
                            <span className="text-[10px]">Copiar</span>
                          </>
                        )}
                      </button>
                      {isWhatsAppEnabled && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSendDocumentByWhatsApp(
                              escrito.tipo,
                              escrito.texto,
                              escrito.includeHeader !== false,
                              escrito.fontFamily,
                              escrito.fontSizePt
                            );
                          }}
                          className="flex items-center gap-1 text-[10px] font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 transition-colors cursor-pointer"
                          title="Enviar PDF por WhatsApp"
                        >
                          <MessageCircle className="w-3 h-3 text-emerald-600" />
                          <span className="text-[10px]">WhatsApp</span>
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
    )}

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN */}
      {docToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full box-border max-w-sm overflow-hidden border border-slate-200">
            <div className="p-6 space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-red-50 text-[#FF3131] flex items-center justify-center border border-red-100">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-slate-900">¿Eliminar documento?</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Esta acción eliminará definitivamente el escrito <strong className="text-slate-900">&quot;{docToDelete.tipo}&quot;</strong> del archivo notarial. No se podrá recuperar.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 p-5 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleEliminarDocumento(docToDelete)}
                className="px-4 py-2 text-xs font-bold text-white bg-[#FF3131] hover:bg-red-600 rounded-xl transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-white" />
                <span>Eliminar Definitivamente</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADMINISTRAR CARPETAS */}
      {isAdminModalOpen && currentUser && (
        <ModalAdministrarCarpetas
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          carpetasActuales={allCarpetasToAdmin}
          userId={(userProfile?.rol === 'operador' || userProfile?.role === 'operador') ? (userProfile?.tenant_id || userProfile?.tenantId || currentUser.uid) : currentUser.uid}
        />
      )}

      {/* MODAL RENOMBRAR DOCUMENTO */}
      {docToRename && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full box-border max-w-sm overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Renombrar Documento</h3>
              <button
                type="button"
                onClick={() => setDocToRename(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">
                Nuevo Nombre / Título *
              </label>
              <input
                type="text"
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                placeholder="Ej. Contrato de Alquiler..."
                className="w-full box-border bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl p-3 outline-none focus:border-[#FF3131]"
              />
            </div>
            <div className="flex items-center justify-end gap-2.5 p-5 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={() => setDocToRename(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!newDocName.trim()) return;
                  try {
                    if (docToRename.id.startsWith('temp-')) {
                      const tempDocsString = localStorage.getItem('escritos_temporales');
                      if (tempDocsString) {
                        const tempDocs = JSON.parse(tempDocsString);
                        const idx = parseInt(docToRename.id.replace('temp-', ''), 10);
                        tempDocs[idx].tipo = newDocName.trim();
                        localStorage.setItem('escritos_temporales', JSON.stringify(tempDocs));
                        setEscritos(prev => prev.map(item => item.id === docToRename.id ? { ...item, tipo: newDocName.trim() } : item));
                      }
                    } else {
                      const docRef = doc(db, 'documentos_olga', docToRename.id);
                      await updateDoc(docRef, { tipo: newDocName.trim() });
                    }
                    setDocToRename(null);
                  } catch (err) {
                    console.error("Error al renombrar:", err);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5 text-[#FF3131]" />
                <span>Guardar Nombre</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MOVER DOCUMENTO DE CARPETA */}
      {movingDoc && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full box-border max-w-sm overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Mover Documento</h3>
              <button
                type="button"
                onClick={() => setMovingDoc(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Elige la carpeta destino para <strong className="text-slate-900">{movingDoc.tipo}</strong>:
              </p>
              <select
                value={targetCategory}
                onChange={(e) => setTargetCategory(e.target.value)}
                className="w-full box-border bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl p-3 outline-none"
              >
                {categorias.filter(c => c !== 'Todos').map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2.5 p-5 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={() => setMovingDoc(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (movingDoc.id.startsWith('temp-')) {
                      const tempDocsString = localStorage.getItem('escritos_temporales');
                      if (tempDocsString) {
                        const tempDocs = JSON.parse(tempDocsString);
                        const idx = parseInt(movingDoc.id.replace('temp-', ''), 10);
                        tempDocs[idx].categoria = targetCategory;
                        localStorage.setItem('escritos_temporales', JSON.stringify(tempDocs));
                        setEscritos(prev => prev.map(item => item.id === movingDoc.id ? { ...item, categoria: targetCategory } : item));
                      }
                    } else {
                      const docRef = doc(db, 'documentos_olga', movingDoc.id);
                      await updateDoc(docRef, { categoria: targetCategory });
                    }
                    setMovingDoc(null);
                  } catch (err) {
                    console.error("Error al mover:", err);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5 text-[#FF3131]" />
                <span>Mover Escrito</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL / ENTORNO COMPLETO DE IA (ORÁCULO NOTARIAL) */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-[#FF3131]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-black uppercase tracking-wider text-white">
                      O.L.G.A. IA / ORÁCULO NOTARIAL
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-red-500/20 text-[#FF3131] border border-red-500/30">
                      Asistente Jurídico
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    Redacción asistida con terminología y legislación notarial paraguaya.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Caja de Requerimiento Legal */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  Requerimiento Legal / Instrucción Notarial
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Ejemplo: 'Redactar una cláusula de resolución por incumplimiento con mora automática del 2% mensual para compraventa...', o 'Generar borrador de cesión de derechos sobre inmueble en Asunción...' "
                  rows={4}
                  className="w-full box-border p-3.5 bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-2xl text-xs font-medium text-slate-900 outline-none transition-colors resize-y leading-relaxed shadow-inner"
                />
              </div>

              {/* Sugerencias Rápidas */}
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400">Sugerencias notariales:</span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_AI_PROMPTS.map((qp, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAiPrompt(qp.prompt)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg border border-slate-200 transition-colors text-left cursor-pointer"
                    >
                      {qp.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Adjuntos */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileAttachment}
                multiple
                accept=".pdf,image/*,.doc,.docx,.txt"
                className="hidden"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer"
                    title="Adjuntar títulos, antecedentes o fotos"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                    <span>Adjuntar Archivos</span>
                  </button>

                  {aiAttachments.map((att, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-800 border border-slate-200 rounded-lg text-[10px] font-bold"
                    >
                      <FileText className="w-3 h-3 text-[#FF3131]" />
                      <span className="max-w-[120px] truncate" title={att.name}>{att.name}</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(i)}
                        className="text-slate-400 hover:text-slate-800 p-0.5 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleGenerarConIA}
                  disabled={isGeneratingAI || (!aiPrompt.trim() && aiAttachments.length === 0)}
                  className="flex items-center justify-center gap-2 px-5 py-2 bg-[#FF3131] hover:bg-red-600 disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-red-500/20 active:scale-95 cursor-pointer"
                >
                  {isGeneratingAI ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>{isGeneratingAI ? 'Redactando con IA...' : 'Generar Borrador'}</span>
                </button>
              </div>

              {/* Error si ocurre */}
              {aiError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs font-bold text-red-700 flex items-start justify-between gap-3 animate-in fade-in">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-extrabold text-red-800">Aviso del Asistente:</p>
                      <p className="mt-0.5 text-red-600 font-medium">{aiError}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAiError(null)}
                    className="text-red-400 hover:text-red-700 p-0.5 shrink-0 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Caja de Revisión Previa del Borrador Generado */}
              {aiDraftProposal !== null && (
                <div className="bg-slate-50 border-2 border-slate-300 rounded-3xl p-5 space-y-3 shadow-sm animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FF3131] animate-ping"></span>
                      <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                        Revisión Previa del Borrador Generado
                      </h4>
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                        Borrador Editable
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 font-bold">
                      {aiDraftProposal.trim().split(/\s+/).filter(Boolean).length} palabras
                    </div>
                  </div>

                  <textarea
                    value={aiDraftProposal}
                    onChange={(e) => setAiDraftProposal(e.target.value)}
                    rows={8}
                    className="w-full box-border p-3.5 bg-white border border-slate-200 focus:border-[#FF3131] rounded-2xl text-slate-900 font-mono text-xs leading-relaxed outline-none transition-colors resize-y shadow-inner"
                    placeholder="El borrador generado aparecerá aquí para su libre ajuste..."
                  />

                  {/* Botonera de Inserción */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(aiDraftProposal);
                          setCopiedFeedback(true);
                          setTimeout(() => setCopiedFeedback(false), 2000);
                        }}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copiar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAiDraftProposal(null)}
                        className="px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                        <span>Descartar</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {editorText.trim().length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleInsertarEnDocumento('reemplazar')}
                          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                          title="Reemplaza todo el contenido del editor con este borrador"
                        >
                          <RotateCcw className="w-3 h-3 text-[#FF3131]" />
                          <span>Reemplazar Editor</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleInsertarEnDocumento('anexar')}
                        className="px-5 py-2 bg-[#FF3131] hover:bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-red-500/20 active:scale-95 flex items-center gap-1.5 cursor-pointer"
                        title="Inserta de manera limpia y automática este texto en el Editor Notarial Activo"
                      >
                        <Send className="w-3.5 h-3.5 text-white" />
                        <span>Enviar al Documento</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. ASISTENTE FLOTANTE DE AUTOCOMPLETADO (AUTOFILL WIZARD)                  */}
      {/* ========================================================================= */}
      {mostrarEditor && condicionAutocompletado && currentBlankContext && (
        <aside
          role="region"
          aria-label={currentBlankContext.isJudicialMarker ? 'Asistente de Autocompletado Judicial' : 'Asistente de Autocompletado Notarial'}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[70] bg-white shadow-2xl rounded-3xl border border-slate-200/90 ring-1 ring-slate-100 p-4 sm:p-5 max-w-lg w-[92%] sm:w-[90%] animate-in fade-in slide-in-from-bottom-6 duration-300 transition-all backdrop-blur-sm"
        >
          {/* Cabecera del Wizard: Instrucción y Contador */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF3131] animate-pulse shrink-0"></span>
              <h4 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight truncate">
                {currentBlankContext.instruccion}
              </h4>

              {/* Botón de Ayuda (?) con Tooltip */}
              <div className="relative inline-block shrink-0">
                <button
                  type="button"
                  onMouseEnter={() => setMostrarTooltipAyuda(true)}
                  onMouseLeave={() => setMostrarTooltipAyuda(false)}
                  onClick={() => setMostrarTooltipAyuda(!mostrarTooltipAyuda)}
                  className="text-slate-400 hover:text-slate-700 p-0.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Ver explicación y ejemplos legales"
                  aria-label="Información de ayuda"
                >
                  <HelpCircle className="w-4 h-4 text-slate-400" />
                </button>

                {mostrarTooltipAyuda && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 text-white text-[11px] rounded-2xl shadow-xl z-50 pointer-events-none animate-in fade-in zoom-in-95">
                    <p className="font-extrabold text-[#FF3131] uppercase tracking-wider text-[9px] mb-1">
                      {currentBlankContext.isJudicialMarker
                        ? (esPlayeroEsc
                            ? 'Guía de Llenado Comercial'
                            : esSectorPublicoBeta
                              ? 'Guía de Llenado UOC / Sector Público'
                              : 'Guía de Llenado Judicial')
                        : 'Guía Notarial de Llenado'}
                    </p>
                    <p className="text-slate-200 leading-relaxed font-normal">
                      {currentBlankContext.ayuda}
                    </p>
                    <div className="w-2 h-2 bg-slate-900 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2"></div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Contador de Espacios Pendientes */}
              <div className="px-2.5 py-1 bg-slate-100 rounded-xl text-[10px] font-mono font-black text-slate-600 border border-slate-200">
                {totalBlanks} {totalBlanks === 1 ? 'campo pendiente' : 'campos pendientes'}
              </div>

              {/* Botón Salir / Volver (ESC) */}
              <button
                type="button"
                onClick={() => {
                  setMostrarEditor(false);
                  setSelectedPlantillaId('');
                }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                title="Cerrar editor y volver al dashboard (ESC)"
                aria-label="Cerrar editor"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Formulario de Inserción Rápida con Enter */}
          <form onSubmit={handleAplicarAutofill} className="mt-3 flex items-center gap-2">
            {/* Botón '↩ Retroceder' (Deshacer) */}
            <button
              type="button"
              onClick={handleRetroceder}
              disabled={historialTextos.length === 0}
              className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-35 disabled:hover:bg-slate-100 text-slate-700 rounded-2xl text-xs font-bold transition-all border border-slate-200 flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs active:scale-95"
              title="Retroceder al paso anterior (Deshacer última inserción)"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Retroceder</span>
            </button>

            <input
              ref={autofillInputRef}
              type="text"
              autoFocus={true}
              value={autofillInput}
              onChange={(e) => {
                const val = e.target.value;
                // Formateo de miles con puntos exclusivamente cuando el campo actual es un monto numérico en Gs.
                const isCampoMontoNumerico =
                  currentBlankContext.markerKey === 'MONTO_RECLAMADO' ||
                  (esPlayeroEsc &&
                    (currentBlankContext.markerKey === 'PRECIO_TOTAL' ||
                      currentBlankContext.markerKey === 'ENTREGA' ||
                      currentBlankContext.markerKey === 'MONTO_CUOTA' ||
                      currentBlankContext.markerKey === 'MONTO_SENA')) ||
                  (esSectorPublicoBeta &&
                    (currentBlankContext.markerKey === 'MONTO_ESTIMADO' ||
                      currentBlankContext.markerKey === 'MONTO_CONTRATO_ORIGINAL' ||
                      currentBlankContext.markerKey === 'MONTO_AMPLIACION' ||
                      currentBlankContext.markerKey === 'MONTO_TOTAL_ACTUALIZADO'));
                if (isCampoMontoNumerico) {
                  const soloNums = val.replace(/\./g, '');
                  if (/^\d+$/.test(soloNums)) {
                    const numParsed = parseInt(soloNums, 10);
                    if (!isNaN(numParsed)) {
                      setAutofillInput(numParsed.toLocaleString('es-PY'));
                      return;
                    }
                  }
                }
                setAutofillInput(val);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (autofillInput.trim()) {
                    handleAplicarAutofill();
                  }
                }
              }}
              placeholder={currentBlankContext.placeholder}
              className="flex-1 box-border bg-slate-50 border border-slate-200 focus:border-[#FF3131] focus:bg-white rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none transition-all shadow-inner placeholder:text-slate-400 placeholder:font-normal"
            />

            {currentBlankContext.isJudicialMarker && (
              <button
                type="button"
                onClick={handleOmitirMarcador}
                className="py-2.5 px-2.5 bg-white hover:bg-slate-100 text-slate-600 rounded-2xl text-[11px] font-semibold transition-all border border-slate-200 shrink-0 cursor-pointer"
                title="Omitir este campo y pasar al siguiente"
              >
                Saltar
              </button>
            )}

            <button
              type="submit"
              disabled={!autofillInput.trim()}
              className="py-2.5 px-4 bg-[#FF3131] hover:bg-red-600 disabled:opacity-40 disabled:hover:bg-[#FF3131] text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-red-500/20 active:scale-95 flex items-center gap-1.5 shrink-0 cursor-pointer"
              title="Insertar valor y avanzar al siguiente espacio (Enter)"
            >
              <span>Completar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {currentBlankContext.isJudicialMarker ? (
            <div className="mt-2 space-y-1 px-1">
              <p className="text-[11px] text-slate-600 leading-snug">
                {currentBlankContext.ayuda}
              </p>
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                <span>Presiona <kbd className="font-mono bg-slate-100 text-slate-600 px-1 py-0.5 rounded border border-slate-200">Enter</kbd> para completar y pasar al siguiente</span>
                <span>Campo: <span className="font-mono text-slate-600">[{currentBlankContext.markerKey}]</span></span>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-medium px-1">
              <span>Presiona <kbd className="font-mono bg-slate-100 text-slate-600 px-1 py-0.5 rounded border border-slate-200">Enter</kbd> para insertar y pasar al siguiente</span>
              <span>Espacios: <span className="font-mono text-slate-600">_______</span></span>
            </div>
          )}
        </aside>
      )}

      {supportCopiedToast && (
        <div className="fixed bottom-6 right-6 z-[250] bg-slate-900 text-white border border-slate-700 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-[#FF3131]" />
          <span>{supportCopiedToast}</span>
        </div>
      )}

      {isWhatsAppEnabled && waModalData && (
        <WhatsAppSendModal
          isOpen={waModalData.isOpen}
          onClose={() => setWaModalData(null)}
          workspaceId={workspaceId}
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