import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Pagare, Persona, formatCurrencyValue } from '../types';
import { X, Clipboard, Check, FileText, Calendar, ShieldCheck, UserCheck, CreditCard, Printer } from 'lucide-react';
import { useWorkspace } from '../hooks/useWorkspace';
import { auth } from '../services/auth';

interface ModalDetallePagareProps {
  isOpen: boolean;
  onClose: () => void;
  pagare: Pagare | null;
  personas?: Persona[];
  onOpenPDFPreview?: (pagare: Pagare) => void;
  userData?: any;
}

export const ModalDetallePagare: React.FC<ModalDetallePagareProps> = ({
  isOpen,
  onClose,
  pagare,
  personas = [],
  onOpenPDFPreview,
  userData
}) => {
  const [copied, setCopied] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const { workspaceId } = useWorkspace(auth?.currentUser, userData);

  // Bloquear el scroll del documento de fondo mientras el modal está abierto y escuchar tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !pagare) return null;

  const acreedor = personas.find(p => p.id === pagare.acreedor_id);
  const deudor = personas.find(p => p.id === pagare.deudor_id);
  const codeudor1 = personas.find(p => p.id === pagare.codeudor1_id);
  const codeudor2 = personas.find(p => p.id === pagare.codeudor2_id);

  const effectiveWorkspaceId = workspaceId || pagare.userId || auth?.currentUser?.uid || 'no-workspace';
  const docId = String(pagare.id || '');
  const correlativo = String(pagare.correlativo || '');
  const ultimos6 = docId.length > 6 ? docId.slice(-6) : docId;
  const soporteReferencia = `Ref. Soporte: ${correlativo} - ${ultimos6}`;

  const handleCopySupportCode = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const textToCopy = `Solicitud Soporte O.L.G.A. | Workspace: ${effectiveWorkspaceId} | Pagaré ID: ${pagare.id} | Correlativo: ${correlativo}`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setShowToast(true);
      setTimeout(() => setCopied(false), 3000);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      console.error('Error al copiar código de soporte:', err);
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-800 text-[#FF3131] flex items-center justify-center shadow-inner">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#FF3131]">Pagaré Notarial</span>
                <span className="text-[10px] font-mono text-slate-400">Nº {correlativo}</span>
              </div>
              <h2 className="text-base font-extrabold text-white">Detalle Completo del Documento</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Cerrar modal (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Valor y Estado */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Monto Total</p>
              <p className="text-2xl font-black text-slate-900 font-mono">
                {pagare.moneda} {formatCurrencyValue(pagare.valor_total || 0, pagare.moneda)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-700 capitalize">
                {pagare.tipo_negociacion?.replace('_', ' ') || 'Cuotas Corridas'}
              </span>
              {pagare.certificado_firmas_nro && (
                <span className="text-[10px] font-mono font-bold text-emerald-700 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Cert. Firmas Nº {pagare.certificado_firmas_nro}
                </span>
              )}
            </div>
          </div>

          {/* Intervinientes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Acreedor */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                <CreditCard className="w-3 h-3 text-slate-500" /> Acreedor
              </p>
              <p className="font-bold text-slate-800 text-sm">{pagare.acreedor_nombre_raw || acreedor?.nombre || 'No asignado'}</p>
              {(pagare.acreedor_documento_raw || acreedor?.nro_documento) && (
                <p className="text-slate-500 text-[11px] mt-0.5">Doc: {pagare.acreedor_documento_raw || acreedor?.nro_documento}</p>
              )}
              {pagare.acreedor_domicilio_raw && (
                <p className="text-slate-400 text-[11px] mt-0.5 truncate">Dom: {pagare.acreedor_domicilio_raw}</p>
              )}
            </div>

            {/* Deudor */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-slate-500" /> Deudor Principal
              </p>
              <p className="font-bold text-slate-800 text-sm">{pagare.deudor_nombre_raw || deudor?.nombre || 'No asignado'}</p>
              {(pagare.deudor_documento_raw || deudor?.nro_documento) && (
                <p className="text-slate-500 text-[11px] mt-0.5">Doc: {pagare.deudor_documento_raw || deudor?.nro_documento}</p>
              )}
              {pagare.deudor_domicilio_raw && (
                <p className="text-slate-400 text-[11px] mt-0.5 truncate">Dom: {pagare.deudor_domicilio_raw}</p>
              )}
            </div>
          </div>

          {/* Codeudores si existen */}
          {(pagare.codeudor1_nombre_raw || codeudor1 || pagare.codeudor2_nombre_raw || codeudor2) && (
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Co-Deudores Solidarios</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(pagare.codeudor1_nombre_raw || codeudor1) && (
                  <div>
                    <p className="font-bold text-slate-800">{pagare.codeudor1_nombre_raw || codeudor1?.nombre}</p>
                    <p className="text-slate-500 text-[11px]">Doc: {pagare.codeudor1_documento_raw || codeudor1?.nro_documento || 'S/D'}</p>
                  </div>
                )}
                {(pagare.codeudor2_nombre_raw || codeudor2) && (
                  <div>
                    <p className="font-bold text-slate-800">{pagare.codeudor2_nombre_raw || codeudor2?.nombre}</p>
                    <p className="text-slate-500 text-[11px]">Doc: {pagare.codeudor2_documento_raw || codeudor2?.nro_documento || 'S/D'}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cronograma de Cuotas */}
          {pagare.cronograma && pagare.cronograma.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Cronograma de Pagos ({pagare.cronograma.length} Cuotas)
                </p>
                <span className="text-[11px] text-slate-500 font-medium">
                  Primer vencimiento: {pagare.fecha_primer_pago || 'No especificado'}
                </span>
              </div>
              <div className="max-h-44 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50">
                {pagare.cronograma.map((c: any, idx: number) => (
                  <div
                    key={c.id || idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100 text-xs"
                  >
                    <span className="font-bold text-slate-700">Cuota {c.numero_cuota || idx + 1}</span>
                    <span className="font-mono text-slate-500">{c.fecha_pag || c.fecha}</span>
                    <span className="font-mono font-bold text-slate-900">
                      {pagare.moneda} {formatCurrencyValue(c.monto, pagare.moneda)}
                    </span>
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                        c.estado === 'cobrado' || c.pagado
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {c.estado === 'cobrado' || c.pagado ? 'Cobrada' : 'Pendiente'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Auditoría / Creador */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Emisión: {pagare.created_at ? new Date(pagare.created_at).toLocaleDateString('es-PY') : 'Reciente'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Responsable:</span>
              <span className="font-bold text-slate-800">{pagare.creator_name || (pagare as any).creatorName || 'Titular'}</span>
              {(pagare.creator_role === 'operador' || (pagare as any).creatorRole === 'operador') && (
                <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Operador
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer: Sección Discreta de Soporte Técnico (Fase 8) y Acciones */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {/* Renderizado de ID de Soporte con botón Copiar One-Click */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400 font-medium">
              {soporteReferencia}
            </span>
            <button
              type="button"
              onClick={handleCopySupportCode}
              className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
              title="Copiar código estructurado para soporte técnico"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-bold text-[10px]">Copiado</span>
                </>
              ) : (
                <>
                  <Clipboard className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[10px]">Copiar</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onOpenPDFPreview && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPDFPreview(pagare);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-200 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Vista Previa Impresión</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Toast / Alerta UI temporal */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-[200] bg-slate-900 text-white border border-slate-700 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-[#FF3131]" />
          <span>Código de soporte copiado</span>
        </div>
      )}
    </div>,
    document.body
  );
};
