import React, { useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../services/auth';
import { LifeBuoy, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { User } from 'firebase/auth';

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
        id_usuario: currentUser.uid,
        nombre_usuario: userData?.nombreCompleto || currentUser.displayName || 'Usuario Desconocido',
        email: currentUser.email || '',
        telefono: userData?.telefono || currentUser.phoneNumber || '',
        asunto: asunto.trim(),
        mensaje: mensaje.trim(),
        estado: 'pendiente',
        fecha_creacion: Date.now()
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
    <div className={`rounded-3xl p-6 md:p-8 animate-fade-in w-full box-border max-w-3xl mx-auto mt-8 transition-all ${
      esPlanFull
        ? 'bg-[#F4F4F0]/80 dark:bg-[#12141C]/80 backdrop-blur-xl border border-amber-200/40 dark:border-amber-500/30 rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.06)]'
        : 'bg-slate-900 text-white shadow-xl border border-slate-800'
    }`}>
      <div className={`flex items-center gap-4 mb-8 pb-6 border-b ${
        esPlanFull ? 'border-amber-100' : 'border-slate-800'
      }`}>
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
          esPlanFull
            ? 'bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 text-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
            : 'bg-slate-800 border border-slate-700 text-slate-300'
        }`}>
          <LifeBuoy className={`w-7 h-7 ${esPlanFull ? 'text-amber-600' : 'text-slate-300'}`} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className={`text-xl font-bold font-serif ${esPlanFull ? 'text-slate-900' : 'text-white'}`}>
              Buzón de Consultas
            </h2>
            <span className={`font-bold text-[10px] px-2.5 py-0.5 rounded-full ${
              esPlanFull
                ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 shadow-[0_2px_10px_rgba(245,158,11,0.3)]'
                : 'bg-red-600 text-white'
            }`}>
              O.L.G.A.
            </span>
          </div>
          <p className={`text-sm mt-1 ${esPlanFull ? 'text-slate-500' : 'text-slate-400'}`}>
            Comunícate directamente con el administrador para resolver dudas, reportar problemas o solicitar asistencia técnica.
          </p>
        </div>
      </div>

      {isSuccess ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center animate-fade-in">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-emerald-800 mb-2">¡Consulta enviada!</h3>
          <p className="text-emerald-600 text-sm">
            Tu consulta fue enviada exitosamente. El administrador la revisará y te contactará pronto.
          </p>
          <button 
            onClick={() => setIsSuccess(false)}
            className="mt-6 px-6 py-2.5 bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-emerald-200 transition-colors cursor-pointer"
          >
            Enviar otra consulta
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-bold">
              {error}
            </div>
          )}

          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${
              esPlanFull ? 'text-slate-600' : 'text-slate-300'
            }`}>
              Asunto / Motivo de la Consulta
            </label>
            <input 
              type="text"
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              placeholder="Ej: Consulta sobre timbrado, duda legal sobre pagaré, etc."
              required
              className={`w-full box-border px-4 py-3 rounded-xl text-sm font-semibold transition-colors focus:outline-none ${
                esPlanFull
                  ? 'bg-slate-50 border border-slate-200 text-slate-800 focus:border-amber-400'
                  : 'bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:border-slate-500'
              }`}
            />
          </div>

          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${
              esPlanFull ? 'text-slate-600' : 'text-slate-300'
            }`}>
              Mensaje Detallado
            </label>
            <textarea
              rows={5}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Describe detalladamente tu situación o requerimiento..."
              required
              className={`w-full box-border px-4 py-3 rounded-xl text-sm font-semibold transition-colors resize-none focus:outline-none ${
                esPlanFull
                  ? 'bg-slate-50 border border-slate-200 text-slate-800 focus:border-amber-400'
                  : 'bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:border-slate-500'
              }`}
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full sm:w-auto px-8 py-3.5 font-semibold text-sm uppercase tracking-wider rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer ${
                esPlanFull
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-[0_4px_15px_rgba(245,158,11,0.35)] hover:shadow-[0_6px_22px_rgba(245,158,11,0.55)] border border-amber-400/30'
                  : 'bg-red-600 hover:bg-red-700 text-white shadow-md'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 text-white" />
                  Enviar Consulta
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
