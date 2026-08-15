import React, { useState, useEffect } from 'react';
import { doc, setDoc, deleteField } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/auth';
import { Save, CheckCircle2, ShieldCheck, Building, User as UserIcon, AlertCircle, Image as ImageIcon, Upload } from 'lucide-react';

interface ConfiguracionCuentaTabProps {
  currentUser: any;
  userProfile: any;
  onProfileUpdate?: () => void;
}

export const ConfiguracionCuentaTab: React.FC<ConfiguracionCuentaTabProps> = ({ currentUser, userProfile, onProfileUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const [formData, setFormData] = useState({
    razonSocial: '',
    ruc: '',
    tipoPerfil: 'Empresa General',
    registroNotarial: '',
    matricula: '',
    nombreTitular: '',
    sello: '',
    membrete: '',
    logoUrl: '',
    planActual: 'Sin Plan',
    usuariosEquipo: [] as string[]
  });

  const [nuevoUsuarioEmail, setNuevoUsuarioEmail] = useState('');

  const planLimits: Record<string, number> = {
    'Básico': 1,
    'Profesional': 3,
    'Corporativo': 5
  };

  useEffect(() => {
    if (userProfile) {
      setFormData(prev => ({
        ...prev,
        ...userProfile,
        planActual: userProfile.planActual || userProfile.plan || 'Sin Plan'
      }));
    }
  }, [userProfile]);

  const isEscribania = formData.tipoPerfil === 'Escribanía Pública';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.uid) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Por favor selecciona un archivo de imagen válido.');
      return;
    }

    setIsUploadingLogo(true);
    setErrorMsg('');

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setErrorMsg('Error al procesar la imagen.');
        setIsUploadingLogo(false);
        return;
      }
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          setErrorMsg('Error al generar la imagen optimizada.');
          setIsUploadingLogo(false);
          return;
        }

        try {
          const storageRef = ref(storage, `logos_usuarios/${currentUser.uid}_logo.webp`);
          await uploadBytes(storageRef, blob);
          const downloadUrl = await getDownloadURL(storageRef);

          setFormData(prev => ({ ...prev, logoUrl: downloadUrl }));
          setIsUploadingLogo(false);
        } catch (error) {
          console.error("Error uploading image:", error);
          setErrorMsg('Error al subir la imagen al servidor.');
          setIsUploadingLogo(false);
        }
      }, 'image/webp', 0.8);
    };
    img.onerror = () => {
      setErrorMsg('Error al leer la imagen.');
      setIsUploadingLogo(false);
    };
    img.src = URL.createObjectURL(file);
  };

  const handleAgregarUsuario = () => {
    if (!nuevoUsuarioEmail.trim()) return;
    const limit = planLimitValue || 1;
    if ((formData.usuariosEquipo?.length || 0) >= limit) return;
    
    setFormData(prev => ({
      ...prev,
      usuariosEquipo: [...(prev.usuariosEquipo || []), nuevoUsuarioEmail.trim()]
    }));
    setNuevoUsuarioEmail('');
  };

  const handleEliminarUsuario = (emailToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      usuariosEquipo: (prev.usuariosEquipo || []).filter(email => email !== emailToRemove)
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.uid) return;

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const dataToSave = { ...formData };
      
      // Limpieza de campo antiguo (logoBase64) por límites de Firestore (1MB)
      delete (dataToSave as any).logoBase64;
      
      await setDoc(userRef, { ...dataToSave, logoBase64: deleteField() }, { merge: true });
      
      setSuccessMsg('Configuración guardada correctamente.');
      if (onProfileUpdate) onProfileUpdate();
      
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      console.error('Error al guardar:', err);
      setErrorMsg(err.message || 'Error al guardar la configuración.');
    } finally {
      setLoading(false);
    }
  };

  const plan = userProfile?.planActual?.toLowerCase() || formData.planActual?.toLowerCase() || '';
  const tieneAccesoEquipo = plan.includes('empresa') || plan.includes('full') || plan.includes('pro') || plan.includes('corporativo') || plan.includes('profesional');
  
  const planLimitValue = (plan.includes('empresa') || plan.includes('corporativo') || plan.includes('full')) ? 10 :
                         (plan.includes('pro') || plan.includes('profesional')) ? 3 : 1;

return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-slate-900 p-6 md:p-8 flex items-center gap-4 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none"></div>
        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/10 shrink-0 relative z-10">
          <ShieldCheck className="w-6 h-6 text-blue-400" />
        </div>
        <div className="relative z-10">
          <h2 className="text-xl md:text-2xl font-black font-serif tracking-tight">Configuración de Cuenta</h2>
          <p className="text-sm text-slate-400 mt-1">
            Administra los datos de tu membrete, logo y facturación.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="p-6 md:p-8 space-y-6">
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl text-sm font-bold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {errorMsg}
          </div>
        )}
        
        {successMsg && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl text-sm font-bold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            {successMsg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-black uppercase text-slate-800 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-600" />
                Membrete / Logo de Encabezado
              </label>
              <p className="text-xs text-slate-500 font-medium">Sube una imagen para utilizar como logo o membrete en tus documentos generados. Recomendamos imágenes con fondo transparente (PNG).</p>
              
              <div className="pt-2">
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-blue-100 text-blue-700 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors shadow-sm">
                  <Upload className="w-4 h-4" />
                  Subir Logo o Membrete
                  <input  
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageUpload}
                    className="hidden" 
                  />
                </label>
              </div>
            </div>
            
            <div className="w-full box-border md:w-48 h-32 bg-white rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
              {isUploadingLogo ? (
                <div className="text-center p-4 flex flex-col items-center">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Subiendo...</span>
                </div>
              ) : formData.logoUrl || (formData as any).logoBase64 ? (
                <img src={formData.logoUrl || (formData as any).logoBase64} alt="Preview Logo" className="max-w-full box-border max-h-full object-contain p-2" />
              ) : (
                <div className="text-center text-slate-400 p-4">
                  <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-20" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Sin Logo</span>
                </div>
              )}
            </div>
          </div>

          {isEscribania ? (
            <>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-black uppercase text-slate-500 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5" /> Nombre del Titular
                </label>
                <input 
                  type="text"
                  name="nombreTitular"
                  value={formData.nombreTitular}
                  onChange={handleChange}
                  placeholder="Ej: Escribano Juan Pérez"
                  className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-500">Número de Registro Notarial</label>
                <input 
                  type="text"
                  name="registroNotarial"
                  value={formData.registroNotarial}
                  onChange={handleChange}
                  placeholder="Ej: Registro N° 45"
                  className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-500">Matrícula</label>
                <input 
                  type="text"
                  name="matricula"
                  value={formData.matricula}
                  onChange={handleChange}
                  placeholder="Ej: 1234"
                  className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-black uppercase text-slate-500">Sello / Membrete Notarial</label>
                <textarea
                  name="sello"
                  value={formData.sello}
                  onChange={handleChange}
                  placeholder="Ej: Escribanía Pública, Registro N° 45, Asunción - Paraguay"
                  rows={3}
                  className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors resize-none"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-black uppercase text-slate-500 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5" /> Razón Social
                </label>
                <input 
                  type="text"
                  name="razonSocial"
                  value={formData.razonSocial}
                  onChange={handleChange}
                  placeholder="Ej: Empresa S.A."
                  className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-black uppercase text-slate-500">RUC</label>
                <input 
                  type="text"
                  name="ruc"
                  value={formData.ruc}
                  onChange={handleChange}
                  placeholder="Ej: 80012345-6"
                  className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-black uppercase text-slate-500">Membrete / Datos de Facturación</label>
                <textarea
                  name="membrete"
                  value={formData.membrete}
                  onChange={handleChange}
                  placeholder="Ej: Av. Principal 123, Tel: 021-123456"
                  rows={3}
                  className="w-full box-border bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors resize-none"
                />
              </div>
            </>
          )}
        </div>

        <div className="pt-8 border-t border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-blue-600" />
            Gestión de Equipo
          </h3>
          
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-6">
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase text-slate-500">Plan Actual</label>
              <input 
                type="text"
                name="planActual"
                value={formData.planActual || 'Sin Plan'}
                readOnly
                className="w-full box-border bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-600 outline-none cursor-not-allowed"
              />
            </div>

            {tieneAccesoEquipo ? (
              <div className="space-y-4">
                <label className="text-xs font-black uppercase text-slate-500">Usuarios del Equipo ({formData.usuariosEquipo?.length || 0} / {planLimitValue || 1})</label>
                
                <div className="flex flex-col sm:flex-row w-full box-border gap-2">
                  <input 
                    type="email"
                    value={nuevoUsuarioEmail}
                    onChange={(e) => setNuevoUsuarioEmail(e.target.value)}
                    placeholder="nuevo@usuario.com"
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 transition-colors"
                    disabled={(formData.usuariosEquipo?.length || 0) >= (planLimitValue || 1)}
                  />
                  <button
                    type="button"
                    onClick={handleAgregarUsuario}
                    disabled={(formData.usuariosEquipo?.length || 0) >= (planLimitValue || 1) || !nuevoUsuarioEmail.trim()}
                    className="w-full sm:w-auto mt-2 sm:mt-0 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    Agregar Usuario
                  </button>
                </div>

                {(formData.usuariosEquipo?.length || 0) >= (planLimitValue || 1) && (
                  <p className="text-sm font-bold text-red-500">
                    Límite de usuarios alcanzado para este plan.
                  </p>
                )}

                {formData.usuariosEquipo && formData.usuariosEquipo.length > 0 && (
                  <div className="space-y-2">
                    {formData.usuariosEquipo.map((email, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3">
                        <span className="text-sm font-medium text-slate-700">{email}</span>
                        <button
                          type="button"
                          onClick={() => handleEliminarUsuario(email)}
                          className="text-red-500 hover:text-red-700 transition-colors text-xs font-bold px-2 py-1 bg-red-50 rounded-lg"
                        >
                          Eliminar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-blue-50/50 border border-blue-200 text-blue-700 p-4 rounded-xl text-sm font-medium flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-blue-500" />
                Adquiere un plan Básico, Profesional o Corporativo para comenzar a invitar a tu equipo de trabajo.
              </div>
            )}
          </div>
        </div>

        <div className="pt-6 mt-6 border-t border-slate-100 w-full flex justify-center">
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto justify-center bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-wider py-3 px-8 rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
