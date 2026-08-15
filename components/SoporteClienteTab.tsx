import React, { useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../services/auth';
import { LifeBuoy, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { User } from 'firebase/auth';

interface SoporteClienteTabProps {
  currentUser: User | null;
  userData: any;
}

export const SoporteClienteTab: React.FC<SoporteClienteTabProps> = ({ currentUser, userData }) => {
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
    <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm animate-fade-in w-full box-border max-w-3xl mx-auto mt-8">
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-100">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
          <LifeBuoy className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-serif text-slate-800">Buzón de Consultas</h2>
          <p className="text-sm text-slate-500 mt-1">
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
            className="mt-6 px-6 py-2.5 bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-emerald-200 transition-colors"
          >
            Enviar otra consulta
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Asunto
            </label>
            <input 
              type="text"
              placeholder="Ej. Problema con mi plan, Duda sobre un pagaré..."
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              className="w-full box-border bg-slate-50 border border-slate-200 text-slate-800 text-sm p-4 rounded-2xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Mensaje Detallado
            </label>
            <textarea
              placeholder="Describe detalladamente tu consulta o problema..."
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              className="w-full box-border bg-slate-50 border border-slate-200 text-slate-800 text-sm p-4 rounded-2xl outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all min-h-[160px] resize-y"
              required
              disabled={isSubmitting}
            ></textarea>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !asunto.trim() || !mensaje.trim()}
              className="px-8 py-4 bg-[#FF3131] text-white text-sm font-bold uppercase tracking-widest rounded-2xl hover:bg-red-600 transition-all shadow-lg shadow-red-500/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
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
