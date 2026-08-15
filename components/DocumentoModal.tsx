import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Save, Edit3, CheckCircle } from 'lucide-react';
import { db, auth } from '../services/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

import { useTrialStatus } from '../hooks/useTrialStatus';
import ReactMarkdown from 'react-markdown';
import { ModalGuardarDocumento } from './ModalGuardarDocumento';

interface DocumentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText: string;
  userData: any;
  currentUser: any;
  config?: any;
  olgaDocsCount: number;
}

export const DocumentoModal: React.FC<DocumentoModalProps> = ({
  isOpen,
  onClose,
  initialText,
  userData,
  currentUser,
  config,
  olgaDocsCount
}) => {
  const [text, setText] = useState(initialText);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { diasRestantes, pruebaActiva } = useTrialStatus(currentUser);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const isFree = userData?.plan === 'ninguno' || !userData?.plan;
  const isTrialAgotado = isFree && (!pruebaActiva || diasRestantes <= 0 || olgaDocsCount >= 5);
  const [temporalWarning, setTemporalWarning] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);
  const isSavingRef = useRef(false);

  useEffect(() => {
    setText(initialText);
  }, [initialText]);

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
          body { font-family: 'Inter', sans-serif; background: white; color: black; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .prose { max-width: none !important; }
          @media print {
            body { padding: 0; margin: 0; }
            @page { margin: 1cm; size: A4; }
            p, div, blockquote { orphans: 3; widows: 3; }
            table, tr, td { page-break-inside: avoid; break-inside: avoid; }
          }
        `);
        win.document.write('</style></head><body class="print:h-auto print:m-0 print:p-0 print:overflow-hidden">');
        
        const plan = (userData?.planActual || userData?.plan || '').toLowerCase();
        const isFree = !plan || plan.includes('gratis') || plan.includes('free') || plan === 'demo';

        if (isFree) {
          win.document.write(`
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999; pointer-events: none; display: flex; justify-content: center; align-items: center; text-align: center; overflow: hidden;">
              <div style="transform: rotate(-45deg); font-size: 4rem; color: rgba(150, 150, 150, 0.15); font-weight: bold; font-family: sans-serif; white-space: nowrap; user-select: none;">
                Generado con O.L.G.A. - Versión Gratuita/Básica
              </div>
            </div>
          `);
        }

        // Wrap content in a container that formats nicely on A4
        win.document.write('<div class="w-full max-w-[210mm] mx-auto bg-white print:h-auto print:m-0 print:p-0 print:overflow-hidden break-inside-avoid">');
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

    if (isTrialAgotado) {
      console.error("Plan Gratuito Agotado. Has alcanzado el límite de 5 escritos o 5 días. Adquiere un plan para continuar.");
      return;
    }

    setShowSaveModal(true);
  };

  const confirmSave = async (categoria: string) => {
    setShowSaveModal(false);
    if (!auth.currentUser || !auth.currentUser.uid) return;
    
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      console.log("Guardando con UID:", auth.currentUser.uid);
      const datosDelDocumento = {
        texto: text,
        tipo: 'Escrito Generado',
        userId: auth.currentUser.uid,
        categoria: categoria
      };
      await addDoc(collection(db, 'documentos_olga'), { ...datosDelDocumento, createdAt: new Date().toISOString() });
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
            {isTrialAgotado ? (
              <div className="text-[10px] font-bold text-red-500 bg-red-50 px-3 py-2 rounded-xl border border-red-100 flex items-center gap-2">
                Plan Gratuito Agotado. Has alcanzado el límite de 5 escritos o 5 días. Adquiere un plan para continuar.
              </div>
            ) : (
              <button
                onClick={handleSave}
                disabled={isSaving || isTrialAgotado || isSavingRef.current || olgaDocsCount >= 5}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {isSaving || isSavingRef.current ? 'Guardando...' : (olgaDocsCount >= 5 && isFree ? 'Límite del Plan Alcanzado' : 'Guardar')}
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
        <div className="flex-grow overflow-y-auto p-8 md:p-12 print:overflow-visible print:p-0">
          <div ref={printAreaRef} className="print-content-wrapper">
            {/* Membrete Oficial */}
            <div className="mb-12 border-b-2 border-slate-800 pb-6 text-center print:border-black">
              {userData?.logoUrl ? (
                <img src={userData.logoUrl} alt="Membrete Oficial" className="h-20 w-auto mx-auto mb-6 object-contain" />
              ) : (
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold uppercase tracking-wider text-slate-800">{userData?.razonSocial || 'EMPRESA EMISORA'}</h2>
                  {userData?.ruc && <p className="text-sm text-slate-500 mt-1">RUC: {userData.ruc}</p>}
                </div>
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
        />
      )}
    </div>
  );
};
