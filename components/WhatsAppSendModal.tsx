import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Send,
  MessageCircle,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Phone,
} from 'lucide-react';
import { auth } from '../services/auth';

export interface WhatsAppSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  defaultPhone?: string;
  defaultMessage?: string;
  documentTitle: string;
  fileBase64?: string;
  fileName?: string;
  mimetype?: string;
}

const normalizeParaguayPhone = (raw?: string): string => {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('595')) return digits;
  if (digits.startsWith('0') && digits.length >= 9) return `595${digits.slice(1)}`;
  return digits;
};

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const user = auth?.currentUser;
    if (user) {
      const token = await user.getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch {
    // Continuar en desarrollo si no hay token
  }
  return headers;
};

export const WhatsAppSendModal: React.FC<WhatsAppSendModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  defaultPhone = '',
  defaultMessage = '',
  documentTitle,
  fileBase64,
  fileName,
  mimetype = 'application/pdf',
}) => {
  const [phone, setPhone] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [attachedFile, setAttachedFile] = useState<{
    base64: string;
    fileName: string;
    mimetype: string;
  } | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPhone(normalizeParaguayPhone(defaultPhone));
    setMessage(defaultMessage || '');
    if (fileBase64 && fileBase64.trim().length > 0) {
      setAttachedFile({
        base64: fileBase64,
        fileName: fileName || 'documento.pdf',
        mimetype: mimetype || 'application/pdf',
      });
    } else {
      setAttachedFile(null);
    }
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [isOpen, defaultPhone, defaultMessage, fileBase64, fileName, mimetype]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSending) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSending, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const effectiveWorkspaceId = String(workspaceId || '').trim();
    if (!effectiveWorkspaceId) {
      setErrorMsg('No se pudo identificar el espacio de trabajo (workspaceId).');
      return;
    }

    const cleanPhone = normalizeParaguayPhone(phone.trim());
    if (!cleanPhone || cleanPhone.length < 7 || cleanPhone.length > 20) {
      setErrorMsg('Ingresa un número de destino válido con código de país (ej. 595981123456).');
      return;
    }

    const trimmedMessage = message.trim();
    const hasAttachment = Boolean(attachedFile && attachedFile.base64.trim().length > 0);
    if (!hasAttachment && !trimmedMessage) {
      setErrorMsg('Escribe un mensaje antes de enviar.');
      return;
    }

    setIsSending(true);
    try {
      const headers = await getAuthHeaders();
      const endpoint = hasAttachment ? '/api/whatsapp/send-document' : '/api/whatsapp/send';

      const payload = hasAttachment && attachedFile
        ? {
            workspaceId: effectiveWorkspaceId,
            phone: cleanPhone,
            fileBase64: attachedFile.base64,
            fileName: attachedFile.fileName || 'documento.pdf',
            mimetype: attachedFile.mimetype || 'application/pdf',
            caption: trimmedMessage,
          }
        : {
            workspaceId: effectiveWorkspaceId,
            phone: cleanPhone,
            message: trimmedMessage,
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo enviar por WhatsApp.');
      }

      setSuccessMsg(`Enviado correctamente por WhatsApp a ${cleanPhone}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al enviar el mensaje por WhatsApp.';
      setErrorMsg(msg);
    } finally {
      setIsSending(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in print:hidden"
      onClick={() => {
        if (!isSending) onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#121824] text-slate-900 dark:text-slate-100 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-emerald-400">
                Envío directo por WhatsApp
              </p>
              <h3 className="text-sm font-bold text-white truncate">
                {documentTitle || 'Documento Notarial'}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!isSending) onClose();
            }}
            disabled={isSending}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label
              htmlFor="wa-modal-phone"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Número de destino (con código de país)
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="wa-modal-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="595981123456"
                disabled={isSending}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F17] text-sm font-mono tabular-nums text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-colors disabled:opacity-60"
                required
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Ej: 595981123456 (si ingresas 0981..., se normaliza automáticamente a 595).
            </p>
          </div>

          {attachedFile && (
            <div className="p-2.5 px-3 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-between gap-2 text-xs text-emerald-900 dark:text-emerald-200">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-semibold truncate">
                  📎 Archivo adjunto listo: {attachedFile.fileName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAttachedFile(null)}
                disabled={isSending}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                title="Quitar archivo adjunto y enviar solo texto"
              >
                <X className="w-3.5 h-3.5" />
                <span>Quitar</span>
              </button>
            </div>
          )}

          <div>
            <label
              htmlFor="wa-modal-message"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Mensaje
            </label>
            <textarea
              id="wa-modal-message"
              rows={7}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isSending}
              placeholder="Escribe el mensaje a enviar..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F17] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-colors resize-y leading-relaxed disabled:opacity-60"
              required={!attachedFile}
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 flex items-start gap-2.5 text-xs text-red-800 dark:text-red-200">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/15 flex items-center gap-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={isSending}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enviando...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Enviar ahora por WhatsApp</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
