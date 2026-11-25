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
  Car,
  Building2,
  Calculator,
  ArrowLeft,
  ChevronRight,
} from 'lucide-react';

interface FichaProfesionalProps {
  currentUser: User;
  userData: any;
  onComplete?: () => void;
}

type TipoPerfilProfesional =
  | 'escribania'
  | 'abogado'
  | 'playero'
  | 'inmobiliario'
  | 'contador';

interface RubroCardConfig {
  id: TipoPerfilProfesional;
  titulo: string;
  descripcion: string;
  icon: React.ComponentType<{ className?: string }>;
}

const RUBROS_ONBOARDING: RubroCardConfig[] = [
  {
    id: 'escribania',
    titulo: 'Escribanía / Notaría',
    descripcion: 'Protocolo, presupuestos RUN, pagarés y escritos notariales.',
    icon: Stamp,
  },
  {
    id: 'abogado',
    titulo: 'Abogado / Estudio Jurídico',
    descripcion: 'Expedientes, plazos CPC, secretaría WhatsApp y escritos judiciales.',
    icon: Scale,
  },
  {
    id: 'playero',
    titulo: 'Playa de Vehículos',
    descripcion: 'Pagarés, contratos privados, fichero DNIT y seguimiento comercial.',
    icon: Car,
  },
  {
    id: 'inmobiliario',
    titulo: 'Inmobiliaria / Broker',
    descripcion: 'Contratos de locación, boletos, fichero de clientes y gestión.',
    icon: Building2,
  },
  {
    id: 'contador',
    titulo: 'Estudio Contable',
    descripcion: 'Actas, estatutos, notas DNIT/IPS y gestión de clientes.',
    icon: Calculator,
  },
];

const resolveInitialTipoPerfil = (rawTipo: unknown): TipoPerfilProfesional => {
  const normalized = String(rawTipo || '').trim().toLowerCase();
  if (normalized === 'abogado') return 'abogado';
  if (normalized === 'playero') return 'playero';
  if (normalized === 'inmobiliario') return 'inmobiliario';
  if (normalized === 'contador') return 'contador';
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

  const [paso, setPaso] = useState<1 | 2>(1);
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
    nombreTitular: userData?.nombreTitular || '',
    ruc: userData?.ruc || '',
    matricula: userData?.matricula || '',
    registroNotarial: userData?.registroNotarial || '',
    matriculaAbogado: userData?.matriculaAbogado || userData?.matricula || '',
    direccion: userData?.direccion || '',
    ciudad: userData?.ciudad || userData?.circunscripcion || '',
    telefono:
      currentUser?.phoneNumber ||
      userData?.telefono ||
      userData?.phoneNumber ||
      '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const rubroSeleccionado =
    RUBROS_ONBOARDING.find((r) => r.id === tipoPerfil) || RUBROS_ONBOARDING[0];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectTipoPerfil = (nextTipo: TipoPerfilProfesional) => {
    setTipoPerfil(nextTipo);
    setError('');
    setPaso(2);
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
          : tipoPerfil === 'escribania'
            ? 'Por favor ingresa el nombre de tu Escribanía o Razón Social.'
            : 'Por favor ingresa tu nombre comercial o Razón Social.'
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
      } else if (tipoPerfil === 'escribania') {
        dataToUpdate.matricula = formData.matricula.trim();
        dataToUpdate.registroNotarial = formData.registroNotarial.trim();
        dataToUpdate.escribania = cleanNombrePrincipal;
      } else {
        // Rubros comerciales/profesionales nuevos: solo datos comerciales públicos
        const cleanTitular = formData.nombreTitular.trim();
        const cleanDireccion = formData.direccion.trim();
        const cleanCiudad = formData.ciudad.trim();
        if (cleanTitular) {
          dataToUpdate.nombreTitular = cleanTitular;
        }
        if (cleanDireccion) {
          dataToUpdate.direccion = cleanDireccion;
        }
        if (cleanCiudad) {
          dataToUpdate.ciudad = cleanCiudad;
        }
        dataToUpdate.matricula = '';
        dataToUpdate.registroNotarial = '';
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

  const commercialFieldMeta = (() => {
    if (tipoPerfil === 'playero') {
      return {
        nombreLabel: 'Nombre de la Playa / Razón Social *',
        nombrePlaceholder: 'Ej: Automotores del Este S.A.',
        titularPlaceholder: 'Ej: Carlos Gómez',
      };
    }
    if (tipoPerfil === 'inmobiliario') {
      return {
        nombreLabel: 'Nombre de la Inmobiliaria / Broker *',
        nombrePlaceholder: 'Ej: Inmobiliaria Horizonte',
        titularPlaceholder: 'Ej: María López',
      };
    }
    return {
      nombreLabel: 'Nombre del Estudio Contable / Razón Social *',
      nombrePlaceholder: 'Ej: Estudio Contable Ramírez & Asociados',
      titularPlaceholder: 'Ej: Lic. Roberto Ramírez',
    };
  })();

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
            {paso === 1
              ? 'Elegí tu rubro para adaptar tus herramientas y membrete profesional.'
              : 'Completa tus datos públicos para configurar tu espacio de trabajo.'}
          </p>
        </div>

        {paso === 1 ? (
          <div className="p-6 md:p-8 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">Elegí tu rubro</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Seleccioná la opción que mejor describe tu actividad.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg shrink-0">
                Paso 1 de 2
              </span>
            </div>

            <div className="space-y-2.5">
              {RUBROS_ONBOARDING.map((rubro) => {
                const IconComponent = rubro.icon;
                return (
                  <button
                    key={rubro.id}
                    type="button"
                    onClick={() => handleSelectTipoPerfil(rubro.id)}
                    className="w-full text-left bg-white border border-slate-200 hover:border-slate-900 rounded-xl p-4 cursor-pointer transition flex items-center gap-3.5 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-slate-900 text-slate-700 group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900">{rubro.titulo}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug italic">
                        {rubro.descripcion}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 shrink-0 transition-colors" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-6 md:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setPaso(1);
                  setError('');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver a elegir rubro</span>
              </button>

              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg">
                <rubroSeleccionado.icon className="w-3.5 h-3.5 text-slate-600" />
                <span>{rubroSeleccionado.titulo}</span>
              </span>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

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
            ) : tipoPerfil === 'abogado' ? (
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
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-black uppercase text-slate-500">
                    {commercialFieldMeta.nombreLabel}
                  </label>
                  <input
                    type="text"
                    name="razonSocial"
                    value={formData.razonSocial}
                    onChange={handleChange}
                    required
                    placeholder={commercialFieldMeta.nombrePlaceholder}
                    className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-slate-900 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase text-slate-500">
                    Titular / Responsable <span className="text-slate-400 font-semibold">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    name="nombreTitular"
                    value={formData.nombreTitular}
                    onChange={handleChange}
                    placeholder={commercialFieldMeta.titularPlaceholder}
                    className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-slate-900 transition-colors"
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
                    placeholder="Ej: 80012345-6"
                    disabled={isExistingRuc}
                    className={`w-full border rounded-xl px-4 py-3 text-sm font-bold outline-none transition-colors ${
                      isExistingRuc
                        ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-slate-900'
                    }`}
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
                    className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-slate-900 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase text-slate-500">
                    Ciudad
                  </label>
                  <input
                    type="text"
                    name="ciudad"
                    value={formData.ciudad}
                    onChange={handleChange}
                    placeholder="Ej: Asunción, Ciudad del Este, Encarnación..."
                    className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-slate-900 transition-colors"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-black uppercase text-slate-500">
                    Dirección comercial <span className="text-slate-400 font-semibold">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    name="direccion"
                    value={formData.direccion}
                    onChange={handleChange}
                    placeholder="Ej: Avda. Mariscal López 1240"
                    className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-slate-900 transition-colors"
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
                    : tipoPerfil === 'escribania'
                      ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
                      : 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/20'
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
        )}
      </div>
    </div>
  );
};