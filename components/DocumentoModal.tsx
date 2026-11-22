import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Save, Edit3, CheckCircle, AlertCircle, MessageCircle, Download } from 'lucide-react';
import { db, auth } from '../services/auth';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

import { useTrialStatus } from '../hooks/useTrialStatus';
import { useWorkspace } from '../hooks/useWorkspace';
import ReactMarkdown from 'react-markdown';
import { ModalGuardarDocumento } from './ModalGuardarDocumento';
import { formatDocClean } from './PagarePDFPreview';
import { WhatsAppSendModal } from './WhatsAppSendModal';
import { generateDocumentPdfBase64, buildWhatsAppDocumentMessage, downloadPdfFromBase64 } from '../services/pdfExport';

interface DocumentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText: string;
  documentId?: string;
  tipo?: string;
  categoria?: string;
  tipoHoja?: 'blanca' | 'protocolo';
  initialIncludeHeader?: boolean;
  userData: any;
  currentUser: any;
  config?: any;
  olgaDocsCount: number;
  canUseWhatsApp?: boolean;
}

export const limpiarTextoParaEscrito = (texto: string): string => {
  if (!texto) return '';

  return texto
    // 1. Reemplazar <br> y cierres de bloque HTML por saltos de línea antes de limpiar etiquetas
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    // 2. Reemplazar secuencias de &nbsp; / &#160; por un único espacio y eliminar HTML residual
    .replace(/(?:&nbsp;|&#160;)+/gi, ' ')
    .replace(/<[^>]+>/g, '')
    // 3. Limpiar sintaxis Markdown (**negrita**, *cursiva*, encabezados ###, bloques ```) preservando líneas de firma ___
    .replace(/```[\w-]*\n?/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/(^|[^\w*])\*([^*\n]+)\*(?=[^\w*]|$)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    // 4. Colapsar múltiples espacios horizontales consecutivos y limitar saltos de línea a máximo 2
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const wrapSignatureBlocksForPrint = (html: string): string => {
  if (!html || typeof document === 'undefined') return html;

  const container = document.createElement('div');
  container.innerHTML = html;

  const isClauseStart = (txt: string) =>
    /^(CLÁUSULA|PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA|SEXTA|SÉPTIMA|OCTAVA|NOVENA|DÉCIMA|ARTÍCULO|CAPÍTULO|\d+\.)/i.test(txt);

  const hasBlockChildren = (el: Element): boolean =>
    Boolean(el.querySelector(':scope > p, :scope > div, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > ul, :scope > ol, :scope > table, :scope > blockquote, :scope > hr, :scope > section, :scope > article'));

  const isSignatureCaption = (el: Element | null): boolean => {
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    if (tag !== 'p' && tag !== 'div') return false;
    if (hasBlockChildren(el)) return false;
    const text = (el.textContent || '').trim();
    return text.length > 0 && text.length <= 240 && !isClauseStart(text);
  };

  const processParent = (parentEl: Element) => {
    const nodes = Array.from(parentEl.children);
    const createdBlocks: HTMLElement[] = [];

    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (!el.parentElement) continue;
      if (el.classList.contains('signature-block') || el.classList.contains('signatures-group')) continue;

      const tag = el.tagName.toLowerCase();

      if ((tag === 'div' || tag === 'section' || tag === 'article' || el.classList.contains('prose')) && hasBlockChildren(el)) {
        processParent(el);
        continue;
      }

      const text = (el.textContent || '').trim();

      if (tag === 'hr') {
        const next = nodes[i + 1] || null;
        if (isSignatureCaption(next) && !/_{4,}/.test((next?.textContent || '').trim())) {
          const wrapper = document.createElement('div');
          wrapper.className = 'signature-block';
          parentEl.insertBefore(wrapper, el);
          wrapper.appendChild(el);
          let absorbed = 0;
          let cursorIdx = i + 1;
          while (absorbed < 4 && cursorIdx < nodes.length) {
            const candidate = nodes[cursorIdx];
            const candText = (candidate?.textContent || '').trim();
            if (!isSignatureCaption(candidate) || /_{4,}/.test(candText)) break;
            wrapper.appendChild(candidate);
            absorbed++;
            cursorIdx++;
          }
          createdBlocks.push(wrapper);
          i = cursorIdx - 1;
        }
        continue;
      }

      if (tag === 'p' || tag === 'div') {
        const hasUnderscoreLine = /_{4,}/.test(text);
        if (!hasUnderscoreLine) continue;

        const textWithoutUnderscores = text.replace(/_/g, '').trim();
        if (textWithoutUnderscores.length === 0) {
          const next = nodes[i + 1] || null;
          if (isSignatureCaption(next) && !/_{4,}/.test((next?.textContent || '').trim())) {
            const wrapper = document.createElement('div');
            wrapper.className = 'signature-block';
            parentEl.insertBefore(wrapper, el);
            wrapper.appendChild(el);
            let absorbed = 0;
            let cursorIdx = i + 1;
            while (absorbed < 4 && cursorIdx < nodes.length) {
              const candidate = nodes[cursorIdx];
              const candText = (candidate?.textContent || '').trim();
              if (!isSignatureCaption(candidate) || /_{4,}/.test(candText)) break;
              wrapper.appendChild(candidate);
              absorbed++;
              cursorIdx++;
            }
            createdBlocks.push(wrapper);
            i = cursorIdx - 1;
          }
        } else if (text.length <= 260 && !isClauseStart(text)) {
          const wrapper = document.createElement('div');
          wrapper.className = 'signature-block';
          parentEl.insertBefore(wrapper, el);
          wrapper.appendChild(el);
          createdBlocks.push(wrapper);
        }
      }
    }

    // Agrupar bloques de firma consecutivos al final (hasta 3 firmas) para mantenerlos juntos si caben en la hoja
    if (createdBlocks.length >= 2 && createdBlocks.length <= 3) {
      const first = createdBlocks[0];
      const allContiguous = createdBlocks.every((blk, idx) =>
        idx === 0 ? true : createdBlocks[idx - 1].nextElementSibling === blk
      );
      if (allContiguous && first.parentElement) {
        const group = document.createElement('div');
        group.className = 'signatures-group';
        first.parentElement.insertBefore(group, first);
        createdBlocks.forEach((blk) => group.appendChild(blk));
      }
    }
  };

  processParent(container);
  return container.innerHTML;
};

export const DocumentoModal: React.FC<DocumentoModalProps> = ({
  isOpen,
  onClose,
  initialText,
  documentId,
  tipo,
  categoria,
  tipoHoja,
  initialIncludeHeader = true,
  userData,
  currentUser,
  config,
  olgaDocsCount,
  canUseWhatsApp
}) => {
  const [text, setText] = useState(() => limpiarTextoParaEscrito(initialText));
  const [currentDocId, setCurrentDocId] = useState<string | undefined>(documentId);
  const [paperMode, setPaperMode] = useState<'blanca' | 'protocolo'>(() =>
    tipoHoja === 'protocolo' ? 'protocolo' : 'blanca'
  );
  const [includeHeader, setIncludeHeader] = useState<boolean>(initialIncludeHeader ?? true);
  const [pdfLogoDataUrl, setPdfLogoDataUrl] = useState<string | undefined>(undefined);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { diasRestantes, pruebaActiva, isTrialExpired, isSoftBlocked } = useTrialStatus(currentUser);
  const { workspaceId, workspaceData } = useWorkspace(currentUser || auth.currentUser, userData);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [waModalData, setWaModalData] = useState<{
    isOpen: boolean;
    documentTitle: string;
    defaultMessage: string;
    fileBase64: string;
    fileName: string;
  } | null>(null);
  const plan = (userData?.planActual || userData?.plan || '').toLowerCase();
  const isAprobado = String(userData?.estadoPago).toUpperCase() === 'APROBADO' || String(userData?.estadoPlataforma).toUpperCase() === 'APROBADO';
  const hasPaidPlan = plan.includes('pro') || plan.includes('empresa') || plan.includes('full') || plan.includes('básico') || plan.includes('basico') || isAprobado;
  const isFree = !hasPaidPlan && (userData?.plan === 'ninguno' || !userData?.plan || plan.includes('trial') || plan.includes('prueba'));
  const isTrialAgotado = isFree && (!pruebaActiva || diasRestantes <= 0 || olgaDocsCount >= 5);
  const isWhatsAppEnabled =
    typeof canUseWhatsApp === 'boolean'
      ? canUseWhatsApp
      : userData?.whatsappEnabled === true;
  const [temporalWarning, setTemporalWarning] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);
  const isSavingRef = useRef(false);

  const rawLogoInstitucional: string | undefined =
    workspaceData?.logo_institucional ||
    workspaceData?.logoUrl ||
    userData?.logo_institucional ||
    userData?.logoUrl ||
    undefined;

  useEffect(() => {
    setText(limpiarTextoParaEscrito(initialText));
    setCurrentDocId(documentId);
    setPaperMode(tipoHoja === 'protocolo' ? 'protocolo' : 'blanca');
    setIncludeHeader(initialIncludeHeader ?? true);
  }, [isOpen, initialText, documentId, tipoHoja, initialIncludeHeader]);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isOperador = userData?.rol === 'operador' || userData?.role === 'operador';
  const isWhitelisted = currentUser?.email === 'jotamolinas@gmail.com' || isOperador;
  const isPaid = hasPaidPlan;
  const isWatermarkRequired = !isWhitelisted && isSoftBlocked;

  const isHojaBlanca = paperMode !== 'protocolo';
  const nombreEscribaniaHeader =
    workspaceData?.razonSocial ||
    workspaceData?.nombreInstitucion ||
    userData?.razonSocial ||
    userData?.nombreInstitucion ||
    config?.escribania?.nombre ||
    userData?.nombre ||
    'Escribanía Pública';
  const rucHeader = workspaceData?.ruc || userData?.ruc || '';
  const registroHeader =
    workspaceData?.registroNotarial ||
    workspaceData?.matricula ||
    userData?.registroNotarial ||
    userData?.matricula ||
    config?.escribania?.nro_registro ||
    '';
  const telefonoHeader =
    workspaceData?.telefono || userData?.telefono || config?.escribania?.telefono || '';
  const direccionHeader =
    workspaceData?.direccion || userData?.direccion || config?.escribania?.direccion || '';

  const buildEscribaniaPdfMeta = () => ({
    nombre: nombreEscribaniaHeader,
    ruc: rucHeader,
    registro: registroHeader,
    telefono: telefonoHeader,
    direccion: direccionHeader,
    logo: pdfLogoDataUrl,
  });

  const handleDownloadPdf = () => {
    if (!text.trim()) return;
    const docTitle = (tipo || 'Documento Notarial').replace(/\s*\(Guardado Local\)\s*/gi, '').trim();
    const pdf = generateDocumentPdfBase64({
      title: docTitle,
      content: text,
      escribania: buildEscribaniaPdfMeta(),
      includeHeader,
    });
    downloadPdfFromBase64(pdf.fileBase64, pdf.fileName);
  };

  const handleOpenWhatsApp = () => {
    if (!text.trim()) return;
    const docTitle = (tipo || 'Documento Notarial').replace(/\s*\(Guardado Local\)\s*/gi, '').trim();
    const pdf = generateDocumentPdfBase64({
      title: docTitle,
      content: text,
      escribania: buildEscribaniaPdfMeta(),
      includeHeader,
    });
    setWaModalData({
      isOpen: true,
      documentTitle: docTitle,
      defaultMessage: buildWhatsAppDocumentMessage(docTitle, nombreEscribaniaHeader),
      fileBase64: pdf.fileBase64,
      fileName: pdf.fileName,
    });
  };

  const handlePrint = () => {
    const printContent = printAreaRef.current?.innerHTML;
    if (printContent) {
      const win = window.open('', '', 'height=800,width=1024');
      if (win) {
        const preparedPrintContent = wrapSignatureBlocksForPrint(printContent);

        win.document.write('<html><head><title>Impresión Oficial</title>');
        win.document.write('<script src="https://cdn.tailwindcss.com?plugins=typography"></script>');
        win.document.write('<style>');
        if (isHojaBlanca) {
          win.document.write(`
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;0,900&family=Inter:wght@400;500;700;900&display=swap');
            @page {
              size: A4 portrait;
              margin: 2.5cm 2.5cm 2.5cm 3cm;
            }
            html, body {
              font-family: 'Inter', sans-serif;
              background: white;
              color: black;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              margin: 0;
              padding: 0;
              height: auto;
              overflow: visible;
            }
            .prose { max-width: none !important; }
            .prose p, .prose li, .prose blockquote {
              orphans: 3;
              widows: 3;
              text-align: justify;
              line-height: 1.55;
            }
            .prose h1, .prose h2, .prose h3, .prose h4 {
              break-after: avoid;
              page-break-after: avoid;
            }
            .text-center, .text-center p, .text-center h2 {
              text-align: center !important;
            }
            .signature-block, .signatures-group {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
            .signature-block {
              margin-top: 40px;
            }
            .signature-block hr {
              width: 260px;
              max-width: 100%;
              border: none;
              border-top: 1px solid #000;
              margin: 24px 0 6px 0;
            }
            .signature-block p {
              margin: 0 0 2px 0 !important;
              text-align: left !important;
              line-height: 1.45 !important;
            }
            @media print {
              html, body {
                padding: 0 !important;
                margin: 0 !important;
                height: auto !important;
                overflow: visible !important;
              }
              .print-content-wrapper {
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
                max-width: none !important;
                box-shadow: none !important;
                border: none !important;
                height: auto !important;
                overflow: visible !important;
                box-sizing: border-box !important;
              }
              p, li, div, blockquote {
                orphans: 3;
                widows: 3;
              }
              table, tr, td { page-break-inside: avoid; break-inside: avoid; }
              .salto-de-pagina, .salto-de-pagina-print { break-after: page !important; page-break-after: always !important; height: 0 !important; margin: 0 !important; padding: 0 !important; display: block !important; }
              .salto-de-pagina * { display: none !important; }
              ${isWatermarkRequired ? `
              .watermark {
                display: block !important;
                position: fixed !important;
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) rotate(-45deg) !important;
                font-size: 80px !important;
                color: rgba(255, 0, 0, 0.15) !important;
                font-weight: bold !important;
                text-transform: uppercase !important;
                z-index: 9999 !important;
                pointer-events: none !important;
                text-align: center !important;
                width: 100% !important;
                line-height: 1.2 !important;
              }
              ` : ''}
            }
          `);
        } else {
          win.document.write(`
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;0,900&family=Inter:wght@400;500;700;900&display=swap');
            @page {
              size: 216mm 330mm portrait;
              margin: 4.5cm 1.5cm 1.5cm 1.5cm;
            }
            html, body {
              font-family: 'Inter', sans-serif;
              background: white;
              color: black;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              margin: 0;
              padding: 0;
              height: auto;
              overflow: visible;
            }
            .prose { max-width: none !important; }
            .prose p, .prose li, .prose blockquote {
              orphans: 3;
              widows: 3;
              text-align: justify;
              line-height: 1.55;
            }
            .prose h1, .prose h2, .prose h3, .prose h4 {
              break-after: avoid;
              page-break-after: avoid;
            }
            .text-center, .text-center p, .text-center h2 {
              text-align: center !important;
            }
            .signature-block, .signatures-group {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
            .signature-block {
              margin-top: 24px;
            }
            .signature-block hr {
              width: 260px;
              max-width: 100%;
              border: none;
              border-top: 1px solid #000;
              margin: 24px 0 6px 0;
            }
            .signature-block p {
              margin: 0 !important;
              text-align: left !important;
              line-height: 1.45 !important;
            }
            .hoja-notarial-pagina {
              position: relative !important;
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
              break-after: page !important;
              page-break-after: always !important;
            }
            .hoja-notarial-pagina:last-child,
            .hoja-notarial-pagina:last-of-type {
              break-after: auto !important;
              page-break-after: auto !important;
            }
            @media print {
              html, body {
                padding: 0 !important;
                margin: 0 !important;
                height: auto !important;
                overflow: visible !important;
              }
              .print-content-wrapper {
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
                max-width: none !important;
                box-shadow: none !important;
                border: none !important;
                height: auto !important;
                overflow: visible !important;
                box-sizing: border-box !important;
              }
              p, li, div, blockquote {
                orphans: 3;
                widows: 3;
              }
              table, tr, td { page-break-inside: avoid; break-inside: avoid; }
              .salto-de-pagina, .salto-de-pagina-print { break-after: page !important; page-break-after: always !important; height: 0 !important; margin: 0 !important; padding: 0 !important; display: block !important; }
              .salto-de-pagina * { display: none !important; }
              ${isWatermarkRequired ? `
              .watermark {
                display: block !important;
                position: fixed !important;
                top: 50% !important;
                left: 50% !important;
                transform: translate(-50%, -50%) rotate(-45deg) !important;
                font-size: 80px !important;
                color: rgba(255, 0, 0, 0.15) !important;
                font-weight: bold !important;
                text-transform: uppercase !important;
                z-index: 9999 !important;
                pointer-events: none !important;
                text-align: center !important;
                width: 100% !important;
                line-height: 1.2 !important;
              }
              ` : ''}
            }
          `);
        }
        win.document.write('</style></head><body class="print:h-auto print:m-0 print:p-0 print:overflow-visible">');
        
        if (isWatermarkRequired) {
          win.document.write(`
            <div class="watermark">
              VERSIÓN DE PRUEBA - SÓLO PARA USO NO COMERCIAL
            </div>
          `);
        }

        win.document.write('<div class="w-full bg-white print-content-wrapper print:h-auto print:m-0 print:p-0 print:overflow-visible">');
        win.document.write(preparedPrintContent);
        win.document.write('</div></body></html>');
        win.document.close();
        win.focus();
        setTimeout(() => {
          win.print();
          win.close();
        }, 1500);
      }
    }
  };

  const handleSave = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (isSavingRef.current) return;
    
    if (!auth.currentUser || !auth.currentUser.uid) return;

    if (!currentDocId && isTrialAgotado) {
      console.error("Plan Gratuito Agotado. Has alcanzado el límite de 5 escritos o 5 días. Adquiere un plan para continuar.");
      return;
    }

    // Si existe un ID previo, actualizar directamente sobre ese documento (updateDoc) sin crear duplicado
    if (currentDocId && !currentDocId.startsWith('temp-')) {
      await confirmSave(categoria || 'Sin Categoría');
      return;
    }

    setShowSaveModal(true);
  };

  const confirmSave = async (categoriaSeleccionada: string) => {
    setShowSaveModal(false);
    if (!auth.currentUser || !auth.currentUser.uid) return;
    
    isSavingRef.current = true;
    setIsSaving(true);
    setSaveError(null);
    try {
      if (!workspaceId) {
        console.error("Operación abortada: Workspace no identificado.");
        return;
      }
      console.log("Guardando con Workspace ID:", workspaceId);
      const user = (currentUser || auth.currentUser) as any;
      const creatorName = user?.nombre || userData?.nombre || userData?.razonSocial || user?.displayName || user?.email?.split('@')[0] || 'Usuario';
      const creatorRole = user?.role || user?.rol || userData?.role || userData?.rol || 'titular';

      if (currentDocId && !currentDocId.startsWith('temp-')) {
        // ACTUALIZACIÓN DIRECTA (updateDoc) DEL DOCUMENTO EXISTENTE
        const docRef = doc(db, 'documentos_olga', currentDocId);
        await updateDoc(docRef, {
          texto: text,
          categoria: categoriaSeleccionada || categoria || 'Sin Categoría',
          tipoHoja: paperMode,
          tipoPapel: paperMode === 'blanca' ? 'blanco' : 'protocolo',
          modoImpresion: paperMode === 'blanca' ? 'simple' : 'protocolo',
          includeHeader,
          ultimaModificacion: serverTimestamp(),
          lastModifiedBy: auth.currentUser.uid,
          lastModifiedByName: creatorName
        });
      } else {
        // CREACIÓN DE NUEVO DOCUMENTO (addDoc)
        const datosDelDocumento = {
          texto: text,
          tipo: tipo || 'Escrito Generado',
          tipoHoja: paperMode,
          tipoPapel: paperMode === 'blanca' ? 'blanco' : 'protocolo',
          modoImpresion: paperMode === 'blanca' ? 'simple' : 'protocolo',
          includeHeader,
          userId: workspaceId,            // El propietario legal de los datos (Titular)
          creator_id: auth.currentUser.uid, // Rastro de auditoría: Quién lo digitó
          createdBy: auth.currentUser.uid,
          creator_name: creatorName,
          creator_role: creatorRole,
          categoria: categoriaSeleccionada || categoria || 'Sin Categoría',
          createdAt: new Date().toISOString(),
          fechaCreacion: serverTimestamp()
        };
        const newRef = await addDoc(collection(db, 'documentos_olga'), datosDelDocumento);
        setCurrentDocId(newRef.id);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      console.error('Error guardando documento:', error);
      setSaveError(error?.message || 'Error al guardar el documento. Por favor, intente nuevamente.');
      setTimeout(() => setSaveError(null), 5000);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const razonSocial = userData?.razonSocial || config?.escribania?.nombre || 'Membrete Oficial';
  const ruc = userData?.ruc || '---';
  const matricula = userData?.matricula || config?.escribania?.nro_registro || '---';
  const registroNotarial = userData?.registroNotarial || '---';
  const isEscribania = userData?.tipoPerfil === 'Escribanía Pública' || !userData?.tipoPerfil;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 print:p-0 print:bg-white print:backdrop-blur-none print:absolute print:inset-0">
      <div className="bg-white rounded-3xl shadow-2xl w-full box-border max-w-4xl max-h-[90vh] flex flex-col overflow-hidden print:shadow-none print:w-full print:max-w-none print:max-h-none print:h-auto print:rounded-none">
        
        {/* Header - Not visible in print */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-6 border-b border-slate-100 print:hidden">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold text-slate-800">Escrito Oficial</h2>
            <select
              value={paperMode}
              onChange={(e) => setPaperMode(e.target.value as 'blanca' | 'protocolo')}
              className="px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl border border-slate-200 outline-none cursor-pointer transition-colors"
              title="Seleccionar modo de papel para vista previa e impresión"
            >
              <option value="blanca">Hoja en Blanco (Impresión Simple)</option>
              <option value="protocolo">Hoja de Protocolo Notarial (Oficio)</option>
            </select>
            <button
              type="button"
              role="switch"
              aria-checked={includeHeader}
              onClick={() => setIncludeHeader((prev) => !prev)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                includeHeader
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
              }`}
              title={
                paperMode === 'protocolo'
                  ? 'Aplica a Exportar PDF y Enviar por WhatsApp (el papel protocolo oficial conserva sus márgenes preimpresos)'
                  : 'Activar o desactivar el membrete institucional en vista previa, impresión, PDF y WhatsApp'
              }
            >
              <span
                className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                  includeHeader ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    includeHeader ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`}
                />
              </span>
              <span>Incluir cabecera / membrete</span>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {temporalWarning && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg max-w-[200px] text-center leading-tight">
                Documento generado en modo temporal. Adquiere un plan para guardar tus escritos permanentemente.
              </span>
            )}
            {saveSuccess && (
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg">
                <CheckCircle className="w-4 h-4" /> Guardado
              </span>
            )}
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-colors ${
                isEditing 
                  ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {isEditing ? <><CheckCircle className="w-4 h-4" /> Vista Previa</> : <><Edit3 className="w-4 h-4" /> Editar</>}
            </button>
            {isTrialAgotado && !currentDocId ? (
              <div className="text-[10px] font-bold text-red-500 bg-red-50 px-3 py-2 rounded-xl border border-red-100 flex items-center gap-2">
                Plan Gratuito Agotado. Has alcanzado el límite de 5 escritos o 5 días. Adquiere un plan para continuar.
              </div>
            ) : (
              <button
                onClick={handleSave}
                disabled={isSaving || isSavingRef.current || (!currentDocId && (isTrialAgotado || (olgaDocsCount >= 5 && isFree)))}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {isSaving || isSavingRef.current ? 'Guardando...' : (!currentDocId && olgaDocsCount >= 5 && isFree ? 'Límite del Plan Alcanzado' : 'Guardar')}
              </button>
            )}
            {isWhatsAppEnabled && (
              <button
                type="button"
                onClick={handleOpenWhatsApp}
                disabled={!text.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                title="Generar PDF y enviar por WhatsApp"
              >
                <MessageCircle className="w-4 h-4" /> Enviar por WhatsApp
              </button>
            )}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={!text.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-sm font-bold rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Descargar archivo PDF A4"
            >
              <Download className="w-4 h-4" /> Exportar PDF
            </button>
            <button
              onClick={handlePrint}
              disabled={isEditing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer className="w-4 h-4" /> Imprimir / PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-grow overflow-y-auto p-4 md:p-8 bg-slate-100 flex justify-center print:overflow-visible print:p-0 print:bg-white">
          <div 
            ref={printAreaRef} 
            className="print-content-wrapper w-full max-w-[215.9mm] bg-white shadow-xl border border-slate-200"
            style={{
              paddingTop: isHojaBlanca ? '2.5cm' : '4.5cm',
              paddingLeft: isHojaBlanca ? '3cm' : '1.5cm',
              paddingRight: isHojaBlanca ? '2.5cm' : '1.5cm',
              paddingBottom: isHojaBlanca ? '2.5cm' : '1.5cm',
              boxSizing: 'border-box'
            }}
          >
            {/* Encabezado Institucional (visible únicamente cuando includeHeader === true y Hoja en Blanco) */}
            {includeHeader && isHojaBlanca && (
              <div className="mb-8 border-b-2 border-slate-800 pb-4 text-center print:border-black">
                {rawLogoInstitucional && (
                  <img
                    src={rawLogoInstitucional}
                    alt={nombreEscribaniaHeader}
                    className="mx-auto mb-2.5 max-h-14 max-w-[140px] object-contain"
                  />
                )}
                <h2 className="text-xl md:text-2xl font-serif font-bold uppercase tracking-wider text-slate-900">
                  {nombreEscribaniaHeader}
                </h2>
                {(registroHeader && registroHeader !== '---') || (rucHeader && rucHeader !== '---') || telefonoHeader ? (
                  <p className="text-xs font-mono text-slate-600 mt-1">
                    {[
                      registroHeader && registroHeader !== '---'
                        ? (/reg/i.test(registroHeader) ? registroHeader : `Registro N.º ${registroHeader}`)
                        : null,
                      rucHeader && rucHeader !== '---' ? `RUC: ${formatDocClean(rucHeader)}` : null,
                      telefonoHeader ? `Tel.: ${telefonoHeader}` : null,
                    ]
                      .filter(Boolean)
                      .join('  •  ')}
                  </p>
                ) : null}
                {direccionHeader && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {direccionHeader}
                  </p>
                )}
              </div>
            )}

            {/* Document Body */}
            {isEditing ? (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full box-border min-h-[500px] p-6 text-base font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-blue-500 transition-colors resize-y print:hidden"
                placeholder="Escribe el contenido del documento aquí..."
              />
            ) : (
              <div className="prose prose-slate max-w-none print:prose-black">
                <ReactMarkdown>{text}</ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>

      {showSaveModal && (
        <ModalGuardarDocumento
          onClose={() => setShowSaveModal(false)}
          onConfirm={confirmSave}
          userCarpetas={userData?.carpetas}
          workspaceId={workspaceId}
        />
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
