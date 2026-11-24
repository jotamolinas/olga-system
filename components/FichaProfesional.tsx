import React, { useState } from 'react';
import { doc, setDoc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, auth } from '../services/auth';
import { User } from 'firebase/auth';
import {
  ShieldCheck,
  Lock,
  AlertCircle,
  CheckCircle2,
  Stamp,
  Scale,
} from 'lucide-react';

interface FichaProfesionalProps {
  currentUser: User;
  userData: any;
  onComplete?: () => void;
}

type TipoPerfilProfesional = 'escribania' | 'abogado';

const resolveInitialTipoPerfil = (rawTipo: unknown): TipoPerfilProfesional => {
  const normalized = String(rawTipo || '').trim().toLowerCase();
  if (normalized === 'abogado') return 'abogado';
  return 'escribania';
};

export const FichaProfesional: React.FC<FichaProfesionalProps> = ({
  currentUser,
  userData,
  onComplete,
}) => {
  const isExistingRuc = !!userData?.ruc;
  const isExistingMatricula = !!userData?.matricula;
  const isExistingRegistroNotarial = !!userData?.registroNotarial;

  const [tipoPerfil, setTipoPerfil] = useState<TipoPerfilProfesional>(() =>
    resolveInitialTipoPerfil(userData?.tipoPerfil)
  );

  const [formData, setFormData] = useState({
    razonSocial:
      userData?.razonSocial ||
      (userData?.nombreInstitucion && userData.nombreInstitucion !== 'Mi Escribanía'
        ? userData.nombreInstitucion
        : '') ||
      '',
    ruc: userData?.ruc || '',
    matricula: userData?.matricula || '',
    registroNotarial: userData?.registroNotarial || '',
    matriculaAbogado: userData?.matriculaAbogado || userData?.matricula || '',
    ciudad: userData?.ciudad || userData?.circunscripcion || '',
    telefono:
      currentUser?.phoneNumber ||
      userData?.telefono ||
      userData?.phoneNumber ||
      '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectTipoPerfil = (nextTipo: TipoPerfilProfesional) => {
    setTipoPerfil(nextTipo);
    setError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || !user.uid) {
      setError('La sesión se perdió. Recarga la página e ingresa nuevamente.');
      return;
    }

    const cleanNombrePrincipal = formData.razonSocial.trim();
    if (!cleanNombrePrincipal) {
      setError(
        tipoPerfil === 'abogado'
          ? 'Por favor ingresa tu nombre completo o el nombre de tu Estudio Jurídico.'
          : 'Por favor ingresa el nombre de tu Escribanía o Razón Social.'
      );
      return;
    }

    if (tipoPerfil === 'abogado' && !formData.matriculaAbogado.trim()) {
      setError('Por favor ingresa tu Nro. de Matrícula CSJ de Abogado.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const existingData = userSnap.exists() ? userSnap.data() : (userData || {});

      const cleanTelefono =
        formData.telefono.trim() ||
        currentUser.phoneNumber ||
        existingData.telefono ||
        userData?.telefono ||
        '';

      const dataToUpdate: Record<string, any> = {
        uid: user.uid,
        email: currentUser.email || user.email || existingData.email || '',
        telefono: cleanTelefono,
        phoneNumber:
          currentUser.phoneNumber ||
          existingData.phoneNumber ||
          userData?.phoneNumber ||
          cleanTelefono,
        tipoPerfil,
        nombre: cleanNombrePrincipal,
        razonSocial: cleanNombrePrincipal,
        nombreInstitucion: cleanNombrePrincipal,
        ruc: formData.ruc.trim(),
        perfilCompletado: true,
      };

      if (tipoPerfil === 'abogado') {
        const cleanMatCsj = formData.matriculaAbogado.trim();
        const cleanCiudad = formData.ciudad.trim();
        dataToUpdate.matriculaAbogado = cleanMatCsj;
        dataToUpdate.matricula = cleanMatCsj;
        dataToUpdate.ciudad = cleanCiudad;
        dataToUpdate.circunscripcion = cleanCiudad;
        dataToUpdate.registroNotarial = '';
      } else {
        dataToUpdate.matricula = formData.matricula.trim();
        dataToUpdate.registroNotarial = formData.registroNotarial.trim();
        dataToUpdate.escribania = cleanNombrePrincipal;
      }

      if (!existingData.fecha_creacion) {
        dataToUpdate.fecha_creacion = serverTimestamp();
      }
      if (!existingData.fecha_expiracion && !existingData.fecha_vencimiento_plan) {
        dataToUpdate.fecha_expiracion = Timestamp.fromDate(
          new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
        );
        dataToUpdate.planActual =
          existingData.planActual || userData?.planActual || 'trial';
        dataToUpdate.estado_cuenta =
          existingData.estado_cuenta || userData?.estado_cuenta || 'activa';
      }

      await setDoc(userRef, dataToUpdate, { merge: true });

      if (onComplete) {
        onComplete();
      }
    } catch (err: any) {
      console.error('Error al guardar el perfil:', err);
      setError(err.message || 'Ocurrió un error al guardar. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-[2rem] w-full box-border max-w-2xl shadow-2xl flex flex-col border border-slate-200 max-h-[95vh] overflow-y-auto overflow-x-hidden">
        <div className="bg-slate-900 p-7 md:p-8 text-center relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 blur-[80px] rounded-full pointer-events-none" />
          <div className="w-14 h-14 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3 border border-blue-500/30">
            <ShieldCheck className="w-7 h-7 text-blue-400" />
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white font-serif mb-1.5 relative z-10">
            ¡Bienvenido a O.L.G.A.!
          </h2>
          <p className="text-slate-300 text-sm relative z-10">
            Selecciona tu perfil profesional para adaptar tus herramientas y membrete legal.
          </p>
        </div>

        <form onSubmit={handleSave} className="p-6 md:p-8 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Selector visual de 2 tarjetas */}
          <div className="space-y-2">
            <span className="block text-xs font-black uppercase tracking-wider text-slate-500">
              Tipo de Perfil Profesional
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <button
                type="button"
                onClick={() => handleSelectTipoPerfil('escribania')}
                className={`text-left p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
                  tipoPerfil === 'escribania'
                    ? 'border-blue-600 bg-blue-50/70 shadow-md shadow-blue-600/10'
                    : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    tipoPerfil === 'escribania'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  <Stamp className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-slate-900">
                      Escribanía / Notaría
                    </p>
                    {tipoPerfil === 'escribania' && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Protocolo notarial, hojas de seguridad CSJ, pagarés y escritos.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectTipoPerfil('abogado')}
                className={`text-left p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
                  tipoPerfil === 'abogado'
                    ? 'border-indigo-600 bg-indigo-50/70 shadow-md shadow-indigo-600/10'
                    : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    tipoPerfil === 'abogado'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  <Scale className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-slate-900">
                      Abogado / Estudio Jurídico
                    </p>
                    {tipoPerfil === 'abogado' && (
                      <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Expedientes, plazos procesales, escritos judiciales y clientes.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {tipoPerfil === 'escribania' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-black uppercase text-slate-500">
                  Nombre de Escribanía / Razón Social *
                </label>
                <input
                  type="text"
                  name="razonSocial"
                  value={formData.razonSocial}
                  onChange={handleChange}
                  required
                  placeholder="Ej: Escribanía Molinas"
                  className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-500">
                  RUC
                </label>
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
                <label className="text-xs font-black uppercase text-slate-500">
                  Nro. de Matrícula
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

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-black uppercase text-slate-500">
                  Registro Notarial
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
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-black uppercase text-slate-500">
                  Nombre completo o Estudio Jurídico *
                </label>
                <input
                  type="text"
                  name="razonSocial"
                  value={formData.razonSocial}
                  onChange={handleChange}
                  required
                  placeholder="Ej: Abg. Juan Pérez / Estudio Jurídico Pérez & Asociados"
                  className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-500">
                  Matrícula CSJ de Abogado *
                </label>
                <input
                  type="text"
                  name="matriculaAbogado"
                  value={formData.matriculaAbogado}
                  onChange={handleChange}
                  required
                  placeholder="Ej: Mat. CSJ N° 14.520"
                  className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-500">
                  Ciudad / Circunscripción Judicial
                </label>
                <input
                  type="text"
                  name="ciudad"
                  value={formData.ciudad}
                  onChange={handleChange}
                  placeholder="Ej: Asunción / Capital, Alto Paraná, Central..."
                  className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-500">
                  Teléfono de contacto
                </label>
                <input
                  type="text"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  placeholder="Ej: +595 981 123 456"
                  className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-500">
                  RUC <span className="text-slate-400 font-semibold">(Opcional)</span>
                </label>
                <input
                  type="text"
                  name="ruc"
                  value={formData.ruc}
                  onChange={handleChange}
                  placeholder="Ej: 1234567-8"
                  disabled={isExistingRuc}
                  className={`w-full border rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors ${
                    isExistingRuc
                      ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-500'
                  }`}
                />
              </div>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-slate-200">
            <button
              type="submit"
              disabled={loading}
              className={`w-full box-border disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none text-white font-black uppercase tracking-wider py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                tipoPerfil === 'abogado'
                  ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
              }`}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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