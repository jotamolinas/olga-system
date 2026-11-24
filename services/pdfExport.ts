import { jsPDF } from 'jspdf';
import { limpiarLatexJuridico } from './gemini';

export interface EscribaniaPdfMetadata {
  nombre?: string;
  ruc?: string;
  registro?: string;
  telefono?: string;
  direccion?: string;
  email?: string;
  timbrado?: string;
  logo?: string;
  esAbogado?: boolean;
  omitDefaultName?: boolean;
}

export interface GeneratedDocumentPdf {
  fileBase64: string;
  fileName: string;
  cleanTitle: string;
}

const decodeHtmlEntities = (input: string): string => {
  return input
    .replace(/(?:&nbsp;|&#160;)+/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/(?:&#39;|&apos;)/gi, "'")
    .replace(/&aacute;/g, 'á')
    .replace(/&eacute;/g, 'é')
    .replace(/&iacute;/g, 'í')
    .replace(/&oacute;/g, 'ó')
    .replace(/&uacute;/g, 'ú')
    .replace(/&ntilde;/g, 'ñ')
    .replace(/&Aacute;/g, 'Á')
    .replace(/&Eacute;/g, 'É')
    .replace(/&Iacute;/g, 'Í')
    .replace(/&Oacute;/g, 'Ó')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&Ntilde;/g, 'Ñ');
};

export const cleanDocumentContentForPdf = (rawText: string, esAbogado = false): string => {
  if (!rawText) return '';

  const withBreaks = rawText
    .replace(/\r\n/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ');

  const withoutTags = decodeHtmlEntities(withBreaks).replace(/<[^>]+>/g, '');

  const cleaned = withoutTags
    .replace(/```[\w-]*\n?/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/(^|[^\w*])\*([^*\n]+)\*(?=[^\w*]|$)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();

  return esAbogado ? limpiarLatexJuridico(cleaned) : cleaned;
};

export const sanitizePdfFileName = (rawTitle?: string): string => {
  const base = (rawTitle || 'Documento_Notarial')
    .replace(/\s*\(Guardado Local\)\s*/gi, '')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

  const safeTitle = base || 'Documento_Notarial';
  return safeTitle.toLowerCase().endsWith('.pdf') ? safeTitle : `${safeTitle}.pdf`;
};

export const downloadPdfFromBase64 = (fileBase64: string, fileName: string): void => {
  const byteCharacters = atob(fileBase64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = sanitizePdfFileName(fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const buildWhatsAppDocumentMessage = (
  titulo: string,
  nombreEscribania?: string,
  fecha?: string
): string => {
  const cleanTitle = (titulo || 'Documento Notarial').replace(/\s*\(Guardado Local\)\s*/gi, '').trim();
  const escribania = (nombreEscribania || 'Escribanía Pública').trim();
  const fechaStr =
    fecha ||
    new Date().toLocaleDateString('es-PY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  return `Estimado/a,\n\nLe remitimos adjunto el documento: ${cleanTitle}.\n\nEmitido por: ${escribania}\nFecha: ${fechaStr}`;
};

const normalizeTitleForComparison = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const generateDocumentPdfBase64 = ({
  title,
  content,
  escribania,
  includeHeader = true,
}: {
  title?: string;
  content: string;
  escribania?: EscribaniaPdfMetadata;
  includeHeader?: boolean;
}): GeneratedDocumentPdf => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 16;
  const sideMargin = 20;
  const maxWidth = pageWidth - sideMargin * 2; // 170mm
  const bottomLimit = pageHeight - margin; // 281mm

  let cursorY = margin;

  const ensureSpace = (neededHeight: number) => {
    if (cursorY + neededHeight > bottomLimit) {
      doc.addPage();
      cursorY = margin;
    }
  };

  // 1. Encabezado de Escribanía / Estudio Jurídico (solo si includeHeader === true)
  const nombreEsc = (escribania?.nombre || (escribania?.esAbogado ? '' : 'Escribanía Pública')).trim();
  const rawLogo = escribania?.logo?.trim();
  const hasSupportedLogo = Boolean(
    rawLogo && /^data:image\/(png|jpe?g);base64,/i.test(rawLogo)
  );
  const subDetails: string[] = [];
  if (escribania?.registro && escribania.registro !== '---') {
    const regVal = escribania.registro.trim();
    if (escribania.esAbogado) {
      subDetails.push(/matr[ií]cula/i.test(regVal) ? regVal : `Matrícula CSJ N.º ${regVal}`);
    } else {
      subDetails.push(/reg/i.test(regVal) ? regVal : `Registro N.º ${regVal}`);
    }
  }
  if (escribania?.ruc && escribania.ruc !== '---') {
    subDetails.push(`RUC: ${escribania.ruc}`);
  }
  if (escribania?.telefono && escribania.telefono !== '---') {
    subDetails.push(`Tel.: ${escribania.telefono}`);
  }
  const hasDireccion = Boolean(escribania?.direccion && escribania.direccion !== '---');

  if (includeHeader && (nombreEsc || hasSupportedLogo || subDetails.length > 0 || hasDireccion)) {
    if (hasSupportedLogo && rawLogo) {
      try {
        const imgProps = doc.getImageProperties(rawLogo);
        const maxLogoH = 14;
        const maxLogoW = 28;
        const ratio = imgProps.width && imgProps.height ? imgProps.width / imgProps.height : 1;
        let drawH = maxLogoH;
        let drawW = drawH * ratio;
        if (drawW > maxLogoW) {
          drawW = maxLogoW;
          drawH = drawW / ratio;
        }
        ensureSpace(drawH + 4);
        const fmt = /image\/png/i.test(rawLogo) ? 'PNG' : 'JPEG';
        doc.addImage(rawLogo, fmt, (pageWidth - drawW) / 2, cursorY - 4, drawW, drawH);
        cursorY += drawH + 1;
      } catch {
        // Ignorar logo incompatible para no interrumpir la exportación
      }
    }

    if (nombreEsc) {
      doc.setFont('times', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(20, 24, 33);
      const headerLines = doc.splitTextToSize(nombreEsc.toUpperCase(), maxWidth);
      headerLines.forEach((line: string) => {
        ensureSpace(6);
        doc.text(line, pageWidth / 2, cursorY, { align: 'center' });
        cursorY += 5.5;
      });
    }

    if (subDetails.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(90, 98, 112);
      const subLines = doc.splitTextToSize(subDetails.join('  •  '), maxWidth);
      subLines.forEach((line: string) => {
        ensureSpace(4.5);
        doc.text(line, pageWidth / 2, cursorY, { align: 'center' });
        cursorY += 4.2;
      });
    }

    if (hasDireccion && escribania?.direccion) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(110, 118, 130);
      const dirLines = doc.splitTextToSize(escribania.direccion.trim(), maxWidth);
      dirLines.forEach((line: string) => {
        ensureSpace(4);
        doc.text(line, pageWidth / 2, cursorY, { align: 'center' });
        cursorY += 3.8;
      });
    }

    cursorY += 1.5;
    doc.setDrawColor(180, 186, 196);
    doc.setLineWidth(0.35);
    doc.line(sideMargin, cursorY, pageWidth - sideMargin, cursorY);
    cursorY += 5.5;
  }

  // 2. Título del Documento (evitando duplicarlo si el cuerpo ya inicia con el mismo título)
  const isAbogadoPdf = Boolean(escribania?.esAbogado);
  const rawTitleClean = (title || 'Documento Notarial')
    .replace(/\s*\(Guardado Local\)\s*/gi, '')
    .trim();
  const cleanTitle = isAbogadoPdf ? limpiarLatexJuridico(rawTitleClean) : rawTitleClean;
  const cleanBody = cleanDocumentContentForPdf(content, isAbogadoPdf);

  const firstNonEmptyLine = (cleanBody.split('\n').find((l) => l.trim().length > 0) || '').trim();
  const normalizedTitle = normalizeTitleForComparison(cleanTitle);
  const normalizedFirstLine = normalizeTitleForComparison(firstNonEmptyLine);
  const bodyAlreadyStartsWithTitle = Boolean(
    normalizedTitle &&
    normalizedFirstLine &&
    (normalizedFirstLine === normalizedTitle ||
      (normalizedTitle.length >= 8 && normalizedFirstLine.startsWith(normalizedTitle)) ||
      (normalizedFirstLine.length >= 8 && normalizedTitle.startsWith(normalizedFirstLine)))
  );

  if (cleanTitle && !bodyAlreadyStartsWithTitle) {
    doc.setFont('times', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(15, 23, 42);
    const titleLines = doc.splitTextToSize(cleanTitle.toUpperCase(), maxWidth);
    titleLines.forEach((line: string) => {
      ensureSpace(6);
      doc.text(line, pageWidth / 2, cursorY, { align: 'center' });
      cursorY += 5.5;
    });
    cursorY += 3;
  }

  // 3. Cuerpo del Documento con paginación automática y protección del bloque de cierre/firma
  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(25, 29, 36);

  const lineHeight = 4.9;
  const paragraphs = cleanBody ? cleanBody.split('\n') : [''];
  let signatureCaptionRemaining = 0;
  let closingProtected = false;

  const estimateClosingBlockHeight = (startIdx: number): number => {
    let totalH = 0;
    let remainingSigCaptions = 0;
    for (let j = startIdx; j < paragraphs.length; j++) {
      const t = paragraphs[j].trim();
      if (!t) {
        remainingSigCaptions = 0;
        totalH += lineHeight * 0.6;
      } else if (/^_{6,}$/.test(t)) {
        totalH += 9 + lineHeight;
        remainingSigCaptions = 4;
      } else {
        const lines = doc.splitTextToSize(t, maxWidth) as string[];
        totalH += lines.length * lineHeight;
        if (remainingSigCaptions > 0) {
          remainingSigCaptions -= 1;
          totalH += 0.4;
        } else {
          totalH += 1.3;
        }
      }
    }
    return totalH + 4;
  };

  paragraphs.forEach((paragraph, idx) => {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      signatureCaptionRemaining = 0;
      cursorY += lineHeight * 0.6;
      if (cursorY > bottomLimit) {
        doc.addPage();
        cursorY = margin;
      }
      return;
    }

    if (
      !closingProtected &&
      paragraphs.length - idx <= 12 &&
      (/(?:PROVEER\s+DE\s+CONFORMIDAD|SER[ÁA]\s+JUSTICIA|ES\s+JUSTICIA)/i.test(trimmed))
    ) {
      closingProtected = true;
      const blockHeight = estimateClosingBlockHeight(idx);
      if (blockHeight < bottomLimit - margin) {
        ensureSpace(blockHeight);
      }
    }

    if (/^_{6,}$/.test(trimmed)) {
      if (!closingProtected) {
        ensureSpace(26);
      }
      cursorY += 8;
      doc.text(trimmed, sideMargin, cursorY);
      cursorY += lineHeight;
      signatureCaptionRemaining = 4;
      return;
    }

    const wrappedLines: string[] = doc.splitTextToSize(trimmed, maxWidth);
    wrappedLines.forEach((line) => {
      ensureSpace(lineHeight);
      doc.text(line, sideMargin, cursorY);
      cursorY += lineHeight;
    });

    if (signatureCaptionRemaining > 0) {
      signatureCaptionRemaining -= 1;
      cursorY += 0.4;
    } else {
      cursorY += 1.3;
    }
  });

  const dataUri = doc.output('datauristring');
  const fileBase64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;

  return {
    fileBase64,
    fileName: sanitizePdfFileName(cleanTitle),
    cleanTitle,
  };
};

// ============================================================================
// GENERADORES PDF DEDICADOS PARA PAGARÉS Y PRESUPUESTOS (WHATSAPP + DESCARGA)
// ============================================================================

export interface PagarePdfInput {
  numero: string;
  certificadoFirmasNro?: string;
  escribania?: EscribaniaPdfMetadata;
  acreedorNombre: string;
  acreedorDocumento?: string;
  acreedorDomicilio?: string;
  deudorNombre: string;
  deudorDocumento?: string;
  deudorDomicilio?: string;
  codeudor1Nombre?: string;
  codeudor1Documento?: string;
  codeudor2Nombre?: string;
  codeudor2Documento?: string;
  montoValor: number;
  moneda?: string;
  cuotaPlazo?: string;
  fechaEmision?: string;
  fechaVencimiento?: string;
  lugarPago?: string;
  tasaInteres?: string;
  cuerpoTexto?: string;
}

export interface PresupuestoPdfTasaItem {
  descripcion: string;
  monto: number;
  numeroComprobantePago?: string;
}

export interface PresupuestoPdfServicioItem {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  total: number;
  tipoIva?: string;
}

export interface PresupuestoPdfInput {
  tipoComprobante?: string;
  numeroComprobante?: string;
  fechaEmision?: string;
  validez?: string;
  condicionVenta?: string;
  conceptoGeneral?: string;
  escribania?: EscribaniaPdfMetadata;
  clienteNombre: string;
  clienteDocumento?: string;
  clienteTelefono?: string;
  clienteDireccion?: string;
  tasas: PresupuestoPdfTasaItem[];
  servicios: PresupuestoPdfServicioItem[];
  subtotalTasas: number;
  subtotalServicios: number;
  totalIva?: number;
  totalGeneral: number;
  totalLetras?: string;
  notas?: string;
}

const buildSafeUnderscoreFileName = (rawName: string, fallback: string): string => {
  const cleaned = (rawName || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 72);

  const finalBase = cleaned || fallback;
  return finalBase.toLowerCase().endsWith('.pdf') ? finalBase : `${finalBase}.pdf`;
};

const formatDateEsPy = (raw?: string): string => {
  if (!raw || !raw.trim()) {
    return new Date().toLocaleDateString('es-PY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
  const trimmed = raw.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }
  return trimmed;
};

const formatMontoPdf = (valor: number, moneda: string = 'PYG'): string => {
  const safe = Number.isFinite(valor) ? valor : 0;
  const code = (moneda || 'PYG').toUpperCase();
  if (code === 'PYG' || code === 'GS') {
    return `${new Intl.NumberFormat('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(safe))} Gs.`;
  }
  if (code === 'USD') {
    return `US$ ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safe)}`;
  }
  if (code === 'BRL') {
    return `R$ ${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(safe)}`;
  }
  return `${code} ${new Intl.NumberFormat('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(safe)}`;
};

const getMonedaNombreMayus = (moneda: string = 'PYG'): string => {
  const code = (moneda || 'PYG').toUpperCase();
  if (code === 'USD') return 'DÓLARES AMERICANOS';
  if (code === 'BRL') return 'REALES BRASILEÑOS';
  return 'GUARANÍES';
};

const numeroALetrasPdf = (num: number): string => {
  if (!Number.isFinite(num) || num <= 0) return 'CERO';
  const entero = Math.floor(Math.abs(num));
  const centavos = Math.round((Math.abs(num) - entero) * 100);

  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const diezDiecinueve = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const veintis = ['VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  const getTriplet = (n: number): string => {
    const intN = Math.floor(n);
    if (intN === 0) return '';
    if (intN === 100) return 'CIEN';
    let res = '';
    const c = Math.floor(intN / 100);
    const d = Math.floor((intN % 100) / 10);
    const u = intN % 10;

    if (c > 0 && c < centenas.length) {
      res += c === 1 && intN % 100 === 0 ? 'CIEN ' : `${centenas[c]} `;
    }
    if (d === 1) {
      res += `${diezDiecinueve[u] || ''} `;
    } else if (d === 2) {
      res += u === 0 ? 'VEINTE ' : `${veintis[u] || ''} `;
    } else {
      if (d > 0 && d < decenas.length) {
        res += `${decenas[d]} `;
        if (u > 0) res += 'Y ';
      }
      if (u > 0 && u < unidades.length) {
        res += `${unidades[u]} `;
      }
    }
    return res.trim();
  };

  let str = '';
  const millones = Math.floor(entero / 1_000_000);
  const miles = Math.floor((entero % 1_000_000) / 1000);
  const resto = entero % 1000;

  if (millones > 0) {
    str += millones === 1 ? 'UN MILLÓN ' : `${getTriplet(millones)} MILLONES `;
  }
  if (miles > 0) {
    str += miles === 1 ? 'MIL ' : `${getTriplet(miles)} MIL `;
  }
  if (resto > 0) {
    str += getTriplet(resto);
  }

  str = str.trim() || 'CERO';
  if (centavos > 0) {
    str += ` CON ${String(centavos).padStart(2, '0')}/100`;
  }
  return str;
};

const renderEscribaniaHeader = (
  doc: jsPDF,
  escribania: EscribaniaPdfMetadata | undefined,
  margin: number,
  maxWidth: number,
  pageWidth: number,
  startY: number
): number => {
  let cursorY = startY;
  const rawNombre = (escribania?.nombre || '').trim();
  const nombreEsc = rawNombre
    ? rawNombre
    : escribania?.omitDefaultName
      ? ''
      : escribania?.esAbogado
        ? 'Estudio Jurídico'
        : 'Escribanía Pública';

  let drewAnything = false;

  if (nombreEsc) {
    drewAnything = true;
    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    const nameLines = doc.splitTextToSize(nombreEsc.toUpperCase(), maxWidth);
    nameLines.forEach((line: string) => {
      doc.text(line, pageWidth / 2, cursorY, { align: 'center' });
      cursorY += 5.5;
    });
  }

  const subParts: string[] = [];
  if (escribania?.registro && escribania.registro !== '---') {
    const regVal = escribania.registro.trim();
    if (escribania.esAbogado) {
      subParts.push(/matr[ií]cula/i.test(regVal) ? regVal : `Matrícula CSJ N.º ${regVal}`);
    } else {
      subParts.push(/reg/i.test(regVal) ? regVal : `Registro N.º ${regVal}`);
    }
  }
  if (escribania?.ruc && escribania.ruc !== '---') {
    subParts.push(`RUC: ${escribania.ruc}`);
  }
  if (escribania?.telefono && escribania.telefono !== '---') {
    subParts.push(`Tel.: ${escribania.telefono}`);
  }
  if (escribania?.timbrado && escribania.timbrado !== '---') {
    subParts.push(`Timbrado: ${escribania.timbrado}`);
  }

  if (subParts.length > 0) {
    drewAnything = true;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const subLines = doc.splitTextToSize(subParts.join('  •  '), maxWidth);
    subLines.forEach((line: string) => {
      doc.text(line, pageWidth / 2, cursorY, { align: 'center' });
      cursorY += 4.2;
    });
  }

  if (escribania?.direccion && escribania.direccion !== '---') {
    drewAnything = true;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const dirLines = doc.splitTextToSize(escribania.direccion.trim(), maxWidth);
    dirLines.forEach((line: string) => {
      doc.text(line, pageWidth / 2, cursorY, { align: 'center' });
      cursorY += 3.8;
    });
  }

  if (escribania?.email && escribania.email !== '---') {
    drewAnything = true;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const emailLines = doc.splitTextToSize(escribania.email.trim(), maxWidth);
    emailLines.forEach((line: string) => {
      doc.text(line, pageWidth / 2, cursorY, { align: 'center' });
      cursorY += 3.8;
    });
  }

  if (!drewAnything) {
    return cursorY;
  }

  cursorY += 2;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  return cursorY + 7;
};

export const generatePagarePdfBase64 = (input: PagarePdfInput): GeneratedDocumentPdf => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const maxWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - margin;

  let cursorY = renderEscribaniaHeader(doc, input.escribania, margin, maxWidth, pageWidth, margin);

  const ensureSpace = (needed: number) => {
    if (cursorY + needed > bottomLimit) {
      doc.addPage();
      cursorY = margin;
    }
  };

  const numeroClean = (input.numero || 'S/N').trim();
  const cleanTitle = `Pagaré Notarial Nº ${numeroClean}`;

  // Título principal
  doc.setFont('times', 'bold');
  doc.setFontSize(14.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`PAGARÉ NOTARIAL Nº ${numeroClean}`, pageWidth / 2, cursorY, { align: 'center' });
  cursorY += 5.5;

  if (input.certificadoFirmasNro && input.certificadoFirmasNro.trim()) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Certificado de Autenticación de Firmas N.º ${input.certificadoFirmasNro.trim()}`,
      pageWidth / 2,
      cursorY,
      { align: 'center' }
    );
    cursorY += 5;
  }

  cursorY += 2;

  // Recuadro resumen financiero y vencimiento
  const moneda = (input.moneda || 'PYG').toUpperCase();
  const montoFormateado = formatMontoPdf(input.montoValor, moneda);
  const montoLetras = `${getMonedaNombreMayus(moneda)} ${numeroALetrasPdf(input.montoValor)}`;
  const fechaEmisionFmt = formatDateEsPy(input.fechaEmision);
  const fechaVencFmt = input.fechaVencimiento ? formatDateEsPy(input.fechaVencimiento) : 'A la vista / Según cronograma';
  const cuotaPlazo = (input.cuotaPlazo || 'Pago único / Cronograma pactado').trim();
  const lugarPago = (input.lugarPago || input.escribania?.direccion || 'Asunción, Paraguay').trim();

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, cursorY, maxWidth, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('POR EL IMPORTE DE:', margin + 5, cursorY + 6);
  doc.text('VENCIMIENTO:', margin + 92, cursorY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(montoFormateado, margin + 5, cursorY + 12.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(fechaVencFmt, margin + 92, cursorY + 12.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Emisión: ${fechaEmisionFmt}`, margin + 5, cursorY + 19.5);
  doc.text(`Cuota / Plazo: ${cuotaPlazo}`, margin + 92, cursorY + 19.5);

  cursorY += 30;

  // Monto en letras
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('MONTO EN LETRAS:', margin, cursorY);
  cursorY += 4.5;

  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  const letrasWrapped = doc.splitTextToSize(`${montoLetras} (${montoFormateado}).-`, maxWidth);
  letrasWrapped.forEach((line: string) => {
    ensureSpace(5);
    doc.text(line, margin, cursorY);
    cursorY += 4.8;
  });
  cursorY += 3;

  // Bloque de Partes (Acreedor y Deudor)
  const renderPartyBlock = (label: string, nombre: string, documento?: string, domicilio?: string) => {
    ensureSpace(20);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);

    const linesInfo: string[] = [
      `Nombre / Razón Social: ${nombre || 'No especificado'}`,
      `C.I. / RUC: ${documento && documento.trim() ? documento.trim() : 'No especificado'}`,
    ];
    if (domicilio && domicilio.trim()) {
      linesInfo.push(`Domicilio: ${domicilio.trim()}`);
    }

    const wrappedAll: string[] = [];
    linesInfo.forEach((item) => {
      const split = doc.splitTextToSize(item, maxWidth - 8);
      wrappedAll.push(...split);
    });

    const boxHeight = 9 + wrappedAll.length * 4.5;
    ensureSpace(boxHeight + 4);
    doc.roundedRect(margin, cursorY, maxWidth, boxHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(label, margin + 4, cursorY + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    let innerY = cursorY + 10.5;
    wrappedAll.forEach((line) => {
      doc.text(line, margin + 4, innerY);
      innerY += 4.5;
    });

    cursorY += boxHeight + 4;
  };

  renderPartyBlock(
    'ACREEDOR / BENEFICIARIO',
    input.acreedorNombre,
    input.acreedorDocumento,
    input.acreedorDomicilio
  );
  renderPartyBlock(
    'DEUDOR PRINCIPAL',
    input.deudorNombre,
    input.deudorDocumento,
    input.deudorDomicilio
  );

  if (input.codeudor1Nombre && input.codeudor1Nombre.trim()) {
    renderPartyBlock('CODEUDOR SOLIDARIO 1', input.codeudor1Nombre, input.codeudor1Documento);
  }
  if (input.codeudor2Nombre && input.codeudor2Nombre.trim()) {
    renderPartyBlock('CODEUDOR SOLIDARIO 2', input.codeudor2Nombre, input.codeudor2Documento);
  }

  // Lugar de pago y condiciones
  ensureSpace(14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('LUGAR DE PAGO Y CONDICIONES:', margin, cursorY);
  cursorY += 4.8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  const lugarLines = doc.splitTextToSize(`Lugar de pago: ${lugarPago}`, maxWidth);
  lugarLines.forEach((line: string) => {
    ensureSpace(5);
    doc.text(line, margin, cursorY);
    cursorY += 4.5;
  });

  if (input.tasaInteres && input.tasaInteres.trim() && input.tasaInteres.trim() !== '_____') {
    ensureSpace(5);
    doc.text(`Tasa de interés pactada: ${input.tasaInteres.trim()}%`, margin, cursorY);
    cursorY += 4.5;
  }

  cursorY += 3;

  // Texto obligacional / cuerpo del pagaré
  const defaultBody = `El día ${fechaVencFmt}, pagaré/pagaremos incondicionalmente a la orden de ${(input.acreedorNombre || 'EL ACREEDOR').toUpperCase()}${input.acreedorDocumento ? `, con documento N.º ${input.acreedorDocumento}` : ''}, la suma de ${montoLetras} (${montoFormateado}), en concepto de obligación líquida y exigible en ${lugarPago}. La falta de pago a su vencimiento producirá la mora automática de pleno derecho sin necesidad de interpelación judicial o extrajudicial, devengando los intereses legales/moratorios correspondientes y habilitando la acción ejecutiva conforme a las leyes de la República del Paraguay.`;

  const cuerpoLimpio = input.cuerpoTexto && input.cuerpoTexto.trim()
    ? cleanDocumentContentForPdf(input.cuerpoTexto)
    : defaultBody;

  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(25, 29, 36);
  const bodyLines = doc.splitTextToSize(cuerpoLimpio, maxWidth);
  bodyLines.forEach((line: string) => {
    ensureSpace(5.2);
    doc.text(line, margin, cursorY);
    cursorY += 5;
  });

  // Espacio para firmas
  ensureSpace(36);
  cursorY += 14;

  const colWidth = 72;
  const leftX = margin + 4;
  const rightX = pageWidth - margin - colWidth - 4;

  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.35);
  doc.line(leftX, cursorY, leftX + colWidth, cursorY);
  doc.line(rightX, cursorY, rightX + colWidth, cursorY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text((input.deudorNombre || 'FIRMA DEL DEUDOR').slice(0, 38), leftX + colWidth / 2, cursorY + 5, {
    align: 'center',
  });
  doc.text('FIRMA Y SELLO NOTARIAL', rightX + colWidth / 2, cursorY + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `C.I./RUC: ${input.deudorDocumento || '....................'}`,
    leftX + colWidth / 2,
    cursorY + 9.5,
    { align: 'center' }
  );
  doc.text(
    (input.escribania?.nombre || 'Escribanía Pública').slice(0, 38),
    rightX + colWidth / 2,
    cursorY + 9.5,
    { align: 'center' }
  );

  const dataUri = doc.output('datauristring');
  const fileBase64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;

  return {
    fileBase64,
    fileName: buildSafeUnderscoreFileName(`Pagare_N_${numeroClean}`, 'Pagare_Notarial'),
    cleanTitle,
  };
};

export const generatePresupuestoPdfBase64 = (input: PresupuestoPdfInput): GeneratedDocumentPdf => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const maxWidth = pageWidth - margin * 2; // 178mm
  const bottomLimit = pageHeight - margin;

  let cursorY = renderEscribaniaHeader(
    doc,
    { ...(input.escribania || {}), omitDefaultName: true },
    margin,
    maxWidth,
    pageWidth,
    margin
  );

  const ensureSpace = (needed: number) => {
    if (cursorY + needed > bottomLimit) {
      doc.addPage();
      cursorY = margin;
    }
  };

  const isLawyer = Boolean(input.escribania?.esAbogado);
  const tipoLabel = (input.tipoComprobante || 'Presupuesto').trim();
  const numComp = (input.numeroComprobante || '').trim();
  const cleanTitle = isLawyer
    ? `Presupuesto de Honorarios y Gastos Jurídicos${numComp ? ` (${numComp})` : ''}`
    : `Presupuesto de Honorarios y Gastos Notariales${numComp ? ` (${numComp})` : ''}`;

  // Título oficial
  doc.setFont('times', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    isLawyer
      ? 'PRESUPUESTO DE HONORARIOS Y GASTOS JURÍDICOS'
      : 'PRESUPUESTO DE HONORARIOS Y GASTOS NOTARIALES',
    pageWidth / 2,
    cursorY,
    { align: 'center' }
  );
  cursorY += 5;

  const metaParts: string[] = [];
  metaParts.push(`Tipo: ${tipoLabel}`);
  if (numComp) metaParts.push(`N.º ${numComp}`);
  metaParts.push(`Emisión: ${formatDateEsPy(input.fechaEmision)}`);
  if (input.validez) metaParts.push(`Validez: ${formatDateEsPy(input.validez)}`);
  if (input.condicionVenta) metaParts.push(`Condición: ${input.condicionVenta}`);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(metaParts.join('  •  '), pageWidth / 2, cursorY, { align: 'center' });
  cursorY += 6;

  // Recuadro Datos del Cliente
  const clienteNombre = (input.clienteNombre || 'Consumidor Final / Cliente').trim();
  const clienteLines: string[] = [
    `Cliente / Solicitante: ${clienteNombre}`,
    `C.I. / RUC: ${input.clienteDocumento?.trim() || 'A confirmar'}${input.clienteTelefono?.trim() ? `   •   Tel.: ${input.clienteTelefono.trim()}` : ''}`,
  ];
  if (input.clienteDireccion?.trim()) {
    clienteLines.push(`Domicilio: ${input.clienteDireccion.trim()}`);
  }
  if (input.conceptoGeneral?.trim()) {
    clienteLines.push(
      `${isLawyer ? 'Causa / Concepto Jurídico' : 'Operación / Trámite'}: ${input.conceptoGeneral.trim()}`
    );
  }

  const wrappedClientLines: string[] = [];
  clienteLines.forEach((line) => {
    wrappedClientLines.push(...doc.splitTextToSize(line, maxWidth - 8));
  });

  const clientBoxH = 9 + wrappedClientLines.length * 4.4;
  ensureSpace(clientBoxH + 4);
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, cursorY, maxWidth, clientBoxH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('DATOS DEL CLIENTE Y OPERACIÓN', margin + 4, cursorY + 5.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(51, 65, 85);
  let cY = cursorY + 10;
  wrappedClientLines.forEach((line) => {
    doc.text(line, margin + 4, cY);
    cY += 4.4;
  });
  cursorY += clientBoxH + 6;

  // Tabla de conceptos e importes
  const colConceptoX = margin + 3;
  const colCantX = margin + 114;
  const colUnitX = margin + 142;
  const colTotalX = margin + maxWidth - 3;

  const drawTableHeader = () => {
    ensureSpace(10);
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, cursorY, maxWidth, 7.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('CONCEPTO / DESCRIPCIÓN', colConceptoX, cursorY + 5);
    doc.text('CANT.', colCantX, cursorY + 5, { align: 'right' });
    doc.text('UNITARIO', colUnitX, cursorY + 5, { align: 'right' });
    doc.text('IMPORTE (Gs.)', colTotalX, cursorY + 5, { align: 'right' });
    cursorY += 7.5;
  };

  const drawSectionTitle = (sectionLabel: string) => {
    ensureSpace(8);
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, cursorY, maxWidth, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(sectionLabel, colConceptoX, cursorY + 4.5);
    cursorY += 6.5;
  };

  const drawRow = (desc: string, cant: string, unit: string, totalStr: string, index: number) => {
    const descLines = doc.splitTextToSize(desc || 'Concepto notarial', 96);
    const rowH = Math.max(6.8, descLines.length * 4.2 + 2.6);
    if (cursorY + rowH > bottomLimit) {
      doc.addPage();
      cursorY = margin;
      drawTableHeader();
    }

    if (index % 2 === 1) {
      doc.setFillColor(250, 251, 253);
      doc.rect(margin, cursorY, maxWidth, rowH, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    let lineY = cursorY + 4.4;
    descLines.forEach((l: string) => {
      doc.text(l, colConceptoX, lineY);
      lineY += 4.1;
    });

    doc.text(cant, colCantX, cursorY + 4.4, { align: 'right' });
    doc.text(unit, colUnitX, cursorY + 4.4, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(totalStr, colTotalX, cursorY + 4.4, { align: 'right' });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, cursorY + rowH, margin + maxWidth, cursorY + rowH);
    cursorY += rowH;
  };

  drawTableHeader();

  if (input.tasas.length > 0) {
    drawSectionTitle('1. TASAS OFICIALES, IMPUESTOS Y GASTOS DE GESTIÓN (REEMBOLSOS)');
    input.tasas.forEach((t, idx) => {
      const label = t.numeroComprobantePago
        ? `${t.descripcion} (Comp.: ${t.numeroComprobantePago})`
        : t.descripcion;
      const montoStr = new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(
        Math.round(Number(t.monto) || 0)
      );
      drawRow(label, '1', 'Exenta', montoStr, idx);
    });
  }

  if (input.servicios.length > 0) {
    drawSectionTitle(
      isLawyer
        ? '2. HONORARIOS PROFESIONALES Y SERVICIOS JURÍDICOS'
        : '2. HONORARIOS PROFESIONALES Y SERVICIOS NOTARIALES'
    );
    input.servicios.forEach((s, idx) => {
      const cantNum = Number(s.cantidad) || 1;
      const unitNum = Number(s.precioUnitario) || 0;
      const totNum = Number(s.total ?? cantNum * unitNum) || 0;
      const ivaTag = s.tipoIva && s.tipoIva !== 'exenta' ? ` (IVA ${s.tipoIva}%)` : '';
      drawRow(
        `${s.descripcion}${ivaTag}`,
        String(cantNum),
        new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(Math.round(unitNum)),
        new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(Math.round(totNum)),
        idx
      );
    });
  }

  if (input.tasas.length === 0 && input.servicios.length === 0) {
    drawRow(
      isLawyer
        ? 'Servicios jurídicos y gestiones procesales según detalle acordado'
        : 'Servicios y gestiones notariales según detalle acordado',
      '1',
      '-',
      formatMontoPdf(input.totalGeneral, 'PYG'),
      0
    );
  }

  cursorY += 5;

  // Bloque de totales
  const totalBoxH = input.totalIva && input.totalIva > 0 ? 31 : 25;
  ensureSpace(totalBoxH + 14);
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, cursorY, maxWidth, totalBoxH, 1.5, 1.5, 'FD');

  let totY = cursorY + 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal Tasas y Reembolsos:', margin + 5, totY);
  doc.text(formatMontoPdf(input.subtotalTasas, 'PYG'), colTotalX, totY, { align: 'right' });

  totY += 5.2;
  doc.text('Subtotal Honorarios y Servicios:', margin + 5, totY);
  doc.text(formatMontoPdf(input.subtotalServicios, 'PYG'), colTotalX, totY, { align: 'right' });

  if (input.totalIva && input.totalIva > 0) {
    totY += 5.2;
    doc.text('Total IVA Incluido / Liquidado:', margin + 5, totY);
    doc.text(formatMontoPdf(input.totalIva, 'PYG'), colTotalX, totY, { align: 'right' });
  }

  totY += 2.5;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin + 4, totY, margin + maxWidth - 4, totY);

  totY += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL GENERAL PRESUPUESTADO:', margin + 5, totY);
  doc.text(formatMontoPdf(input.totalGeneral, 'PYG'), colTotalX, totY, { align: 'right' });

  cursorY += totalBoxH + 5;

  const letrasText =
    input.totalLetras && input.totalLetras.trim()
      ? input.totalLetras.trim()
      : `${numeroALetrasPdf(input.totalGeneral)} GUARANÍES`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const letrasWrapped = doc.splitTextToSize(`SON: ${letrasText.toUpperCase()}.-`, maxWidth);
  letrasWrapped.forEach((line: string) => {
    ensureSpace(4.8);
    doc.text(line, margin, cursorY);
    cursorY += 4.5;
  });

  // Validez y Notas
  if (input.notas && input.notas.trim()) {
    cursorY += 4;
    ensureSpace(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(15, 23, 42);
    doc.text('OBSERVACIONES Y VALIDEZ:', margin, cursorY);
    cursorY += 4.4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(71, 85, 105);
    const noteLines = doc.splitTextToSize(cleanDocumentContentForPdf(input.notas), maxWidth);
    noteLines.forEach((line: string) => {
      ensureSpace(4.2);
      doc.text(line, margin, cursorY);
      cursorY += 4.1;
    });
  }

  const dataUri = doc.output('datauristring');
  const fileBase64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;

  const fileBase = numComp
    ? `Presupuesto_${numComp}_${clienteNombre}`
    : `Presupuesto_${clienteNombre}`;

  return {
    fileBase64,
    fileName: buildSafeUnderscoreFileName(
      fileBase,
      isLawyer ? 'Presupuesto_Juridico' : 'Presupuesto_Notarial'
    ),
    cleanTitle,
  };
};

