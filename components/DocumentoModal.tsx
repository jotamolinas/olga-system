import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Save, Edit3, CheckCircle } from 'lucide-react';
import { db, auth } from '../services/auth';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

import { useTrialStatus } from '../hooks/useTrialStatus';
import { useWorkspace } from '../hooks/useWorkspace';
import ReactMarkdown from 'react-markdown';
import { ModalGuardarDocumento } from './ModalGuardarDocumento';
import { formatDocClean } from './PagarePDFPreview';

interface DocumentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText: string;
  documentId?: string;
  tipo?: string;
  categoria?: string;
  userData: any;
  currentUser: any;
  config?: any;
  olgaDocsCount: number;
}

export const DocumentoModal: React.FC<DocumentoModalProps> = ({
  isOpen,
  onClose,
  initialText,
  documentId,
  tipo,
  categoria,
  userData,
  currentUser,
  config,
  olgaDocsCount
}) => {
  const [text, setText] = useState(initialText);
  const [currentDocId, setCurrentDocId] = useState<string | undefined>(documentId);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { diasRestantes, pruebaActiva, isTrialExpired } = useTrialStatus(currentUser);
  const { workspaceId } = useWorkspace(currentUser || auth.currentUser, userData);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const plan = (userData?.planActual || userData?.plan || '').toLowerCase();
  const isAprobado = String(userData?.estadoPago).toUpperCase() === 'APROBADO' || String(userData?.estadoPlataforma).toUpperCase() === 'APROBADO';
  const hasPaidPlan = plan.includes('pro') || plan.includes('empresa') || plan.includes('full') || plan.includes('básico') || plan.includes('basico') || isAprobado;
  const isFree = !hasPaidPlan && (userData?.plan === 'ninguno' || !userData?.plan || plan.includes('trial') || plan.includes('prueba'));
  const isTrialAgotado = isFree && (!pruebaActiva || diasRestantes <= 0 || olgaDocsCount >= 5);
  const [temporalWarning, setTemporalWarning] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);
  const isSavingRef = useRef(false);

  useEffect(() => {
    setText(initialText);
    setCurrentDocId(documentId);
  }, [initialText, documentId]);

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
  const isWatermarkRequired = !isWhitelisted && !isPaid;

  const handlePrint = () => {
    const printContent = printAreaRef.current?.innerHTML;
    if (printContent) {
      const win = window.open('', '', 'height=800,width=1024');
      if (win) {
        win.document.write('<html><head><title>Impresión Oficial</title>');
        win.document.write('<script src="https://cdn.tailwindcss.com?plugins=typography"></script>');
        win.document.write('<style>');
        win.document.write(`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;0,900&family=Inter:wght@400;500;700;900&display=swap');
          body { font-family: 'Inter', sans-serif; background: white; color: black; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
          .prose { max-width: none !important; }
          @media print {
            body { padding: 0; margin: 0; }
            @page { margin: 0; size: legal portrait; }
            .print-content-wrapper {
              padding-top: 4.5cm !important;
              padding-left: 1.5cm !important;
              padding-right: 1.5cm !important;
              padding-bottom: 1.5cm !important;
              box-sizing: border-box !important;
              margin: 0 auto !important;
              width: 100% !important;
              max-width: 215.9mm !important;
            }
            p, div, blockquote { orphans: 3; widows: 3; }
            table, tr, td { page-break-inside: avoid; break-inside: avoid; }
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
        win.document.write('</style></head><body class="print:h-auto print:m-0 print:p-0 print:overflow-hidden">');
        
        if (isWatermarkRequired) {
          win.document.write(`
            <div class="watermark">
              VERSIÓN DE PRUEBA - SÓLO PARA USO NO COMERCIAL
            </div>
          `);
        }

        // Wrap content in a container that formats nicely on Legal/Oficio
        win.document.write('<div class="w-full max-w-[215.9mm] mx-auto bg-white print-content-wrapper print:h-auto print:m-0 print:overflow-hidden break-inside-avoid">');
        win.document.write(printContent);
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
          ultimaModificacion: serverTimestamp(),
          lastModifiedBy: auth.currentUser.uid,
          lastModifiedByName: creatorName
        });
      } else {
        // CREACIÓN DE NUEVO DOCUMENTO (addDoc)
        const datosDelDocumento = {
          texto: text,
          tipo: tipo || 'Escrito Generado',
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
    } catch (error) {
      console.error('Error guardando documento:', error);
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
        <div className="flex items-center justify-between p-6 border-b border-slate-100 print:hidden">
          <h2 className="text-xl font-bold text-slate-800">Escrito Oficial</h2>
          <div className="flex items-center gap-3">
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
              paddingTop: '4.5cm',
              paddingLeft: '1.5cm',
              paddingRight: '1.5cm',
              paddingBottom: '1.5cm',
              boxSizing: 'border-box'
            }}
          >
            {/* Encabezado Protocolar Notarial - Sin logotipos */}
            <div className="mb-8 border-b-2 border-slate-800 pb-4 text-center print:border-black">
              <h2 className="text-xl md:text-2xl font-serif font-bold uppercase tracking-wider text-slate-900">
                {userData?.razonSocial || userData?.nombre || 'ESCRIBANÍA PÚBLICA'}
              </h2>
              {userData?.ruc && (
                <p className="text-xs md:text-sm font-mono text-slate-600 mt-1">
                  RUC: {formatDocClean(userData.ruc)}
                </p>
              )}
            </div>

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
    </div>
  );
};
