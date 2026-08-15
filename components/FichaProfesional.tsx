import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../services/auth';
import { User } from 'firebase/auth';
import { ShieldCheck, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';

interface FichaProfesionalProps {
  currentUser: User;
  userData: any;
  onComplete?: () => void;
}

export const FichaProfesional: React.FC<FichaProfesionalProps> = ({ currentUser, userData, onComplete }) => {
  const isExistingRuc = !!userData?.ruc;
  const isExistingMatricula = !!userData?.matricula;
  const isExistingRegistroNotarial = !!userData?.registroNotarial;

  const [formData, setFormData] = useState({
    razonSocial: userData?.razonSocial || '',
    ruc: userData?.ruc || '',
    tipoPerfil: userData?.tipoPerfil || '',
    matricula: userData?.matricula || '',
    registroNotarial: userData?.registroNotarial || '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === 'tipoPerfil' && value !== 'Escribanía Pública') {
      setFormData({ 
        ...formData, 
        [name]: value,
        matricula: '',
        registroNotarial: ''
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || !user.uid) {
      console.error("ERROR: La sesión de Firebase se perdió. Recarga la página y vuelve a ingresar con tu teléfono.");
      return;
    }





    setLoading(true);
    setError('');
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { ...formData, uid: user.uid, email: currentUser.email || user.email || '', perfilCompletado: true }, { merge: true });

      if (onComplete) {
        onComplete();
      }
    } catch (err: any) {
      console.error('Error al guardar el perfil:', err);
      setError(err.message || 'Ocurrió un error al guardar. Inténtalo de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-fade-in">
      {/* Contenedor principal con Scroll para móviles incluido */}
      <div className="bg-white rounded-[2rem] w-full box-border max-w-2xl shadow-2xl flex flex-col border border-slate-200 max-h-[95vh] overflow-y-auto overflow-x-hidden">
        
        <div className="bg-slate-900 p-8 text-center relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 blur-[80px] rounded-full pointer-events-none"></div>
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
            <ShieldCheck className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white font-serif mb-2 relative z-10">¡Bienvenido a tu Plan!</h2>
          <p className="text-slate-300 relative z-10">
            Antes de comenzar a emitir documentos, debes configurar tu membrete legal.
          </p>
        </div>

        <form onSubmit={handleSave} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-black uppercase text-slate-500">Razón Social / Nombre Legal</label>
              <input 
                type="text"
                name="razonSocial"
                value={formData.razonSocial}
                onChange={handleChange}
                
                placeholder="Ej: Escribanía Molinas"
                className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase text-slate-500">RUC</label>
              <input 
                type="text"
                name="ruc"
                value={formData.ruc}
                onChange={handleChange}
                
                placeholder="Ej: 80012345-6"
                disabled={isExistingRuc}
                className={`w-full border rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors ${
                  isExistingRuc 
                    ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' 
                    : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500'
                }`}
              />
              {isExistingRuc && (
                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 leading-tight">
                  <Lock className="w-3 h-3 shrink-0" /> Dato verificado y bloqueado.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase text-slate-500">Tipo de Perfil</label>
              <select
                name="tipoPerfil"
                value={formData.tipoPerfil}
                onChange={handleChange}
                
                className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors appearance-none"
              >
                <option value="">Selecciona una opción...</option>
                <option value="Escribanía Pública">Escribanía Pública</option>
                <option value="Estudio Contable">Estudio Contable</option>
                <option value="Playa de Vehículos">Playa de Vehículos</option>
                <option value="Inmobiliaria">Inmobiliaria</option>
                <option value="Empresa General">Empresa General</option>
                <option value="Persona Física">Persona Física</option>
              </select>
            </div>

            {formData.tipoPerfil === 'Escribanía Pública' && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase text-slate-500">
                    NRO. DE MATRÍCULA
                  </label>
                  <input 
                    type="text"
                    name="matricula"
                    value={formData.matricula}
                    onChange={handleChange}
                    
                    placeholder="Ej: 1234"
                    disabled={isExistingMatricula}
                    className={`w-full border rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors ${
                      isExistingMatricula 
                        ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' 
                        : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500'
                    }`}
                  />
                  {isExistingMatricula && (
                    <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 leading-tight">
                      <Lock className="w-3 h-3 shrink-0" /> Dato verificado.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase text-slate-500">
                    REGISTRO NOTARIAL
                  </label>
                  <input 
                    type="text"
                    name="registroNotarial"
                    value={formData.registroNotarial}
                    onChange={handleChange}
                    
                    placeholder="Ej: Registro N° 45"
                    disabled={isExistingRegistroNotarial}
                    className={`w-full border rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors ${
                      isExistingRegistroNotarial 
                        ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' 
                        : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500'
                    }`}
                  />
                  {isExistingRegistroNotarial && (
                    <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 leading-tight">
                      <Lock className="w-3 h-3 shrink-0" /> Dato verificado.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200">
            <button
              type="submit"
              disabled={loading}
              className="w-full box-border bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none text-white font-black uppercase tracking-wider py-4 rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Guardar Perfil y Comenzar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};