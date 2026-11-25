import React, { useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../services/auth';
import { LifeBuoy, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { User } from 'firebase/auth';
import { notifySuperAdminWhatsApp } from '../services/adminAlerts';

interface SoporteClienteTabProps {
  currentUser: User | null;
  userData: any;
  esPlanFull?: boolean;
}

export const SoporteClienteTab: React.FC<SoporteClienteTabProps> = ({ currentUser, userData, esPlanFull = false }) => {
  const [asunto, setAsunto] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asunto.trim() || !mensaje.trim() || !currentUser) return;
    setIsSubmitting(true);
    setError('');

    try {
      await addDoc(collection(db, 'support_tickets'), {
        userId: currentUser.uid,
        uid: currentUser.uid,
        userEmail: currentUser.email || '',
        email: currentUser.email || '',
        id_usuario: currentUser.uid,
        nombre_usuario: userData?.nombreCompleto || userData?.nombre || currentUser.displayName || 'Usuario Desconocido',
        telefono: userData?.telefono || currentUser.phoneNumber || '',
        asunto: asunto.trim(),
        mensaje: mensaje.trim(),
        estado: 'pendiente',
        leidoPorUsuario: false,
        fecha_creacion: Date.now()
      });
      notifySuperAdminWhatsApp({
        type: 'support',
        userName:
          userData?.nombreCompleto ||
          userData?.nombre ||
          currentUser.displayName ||
          currentUser.email ||
          'Usuario Desconocido',
        userEmail: currentUser.email || '',
        userPhone: userData?.telefono || currentUser.phoneNumber || '',
        details: `${asunto.trim()}: ${mensaje.trim()}`,
      });
      setIsSuccess(true);
      setAsunto('');
      setMensaje('');
      setTimeout(() => setIsSuccess(false), 5000);
    } catch (err: any) {
      console.error('Error al enviar consulta:', err);
      setError('Hubo un error al enviar tu consulta. Por favor, intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full box-border max-w-3xl mx-auto mt-6 space-y-5 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 shrink-0">
            <LifeBuoy className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-slate-900 tracking-tight truncate">
              Buzón de Consultas
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Comunícate directamente con el administrador para resolver dudas, reportar problemas o solicitar asistencia técnica.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 w-full box-border">

      {isSuccess ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center animate-fade-in">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-emerald-800 mb-2">¡Consulta enviada!</h3>
          <p className="text-emerald-600 text-sm">
            Tu consulta fue enviada exitosamente. El administrador la revisará y te contactará pronto.
          </p>
          <button 
            onClick={() => setIsSuccess(false)}
            className="mt-6 h-9 px-4 bg-emerald-100 text-emerald-800 text-xs font-medium rounded-lg hover:bg-emerald-200 transition-colors cursor-pointer"
          >
            Enviar otra consulta
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2 text-slate-600">
              Asunto / Motivo de la consulta
            </label>
            <input 
              type="text"
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              placeholder="Ej: Consulta sobre timbrado, duda legal sobre pagaré, etc."
              required
              className="w-full box-border px-3.5 py-2.5 rounded-lg text-sm text-slate-800 bg-white border border-slate-200 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2 text-slate-600">
              Mensaje detallado
            </label>
            <textarea
              rows={5}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Describe detalladamente tu situación o requerimiento..."
              required
              className="w-full box-border px-3.5 py-2.5 rounded-lg text-sm text-slate-800 bg-white border border-slate-200 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none transition-colors resize-none"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto bg-slate-900 text-white hover:bg-slate-800 h-10 px-5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-white" />
                  Enviar consulta
                </>
              )}
            </button>
          </div>
        </form>
      )}
      </div>
    </div>
  );
};
