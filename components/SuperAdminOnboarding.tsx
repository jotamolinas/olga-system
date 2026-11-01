import React, { useState, useRef } from 'react';
import { 
  ShieldCheck, ShieldAlert, KeyRound, Building2, 
  FileKey, UploadCloud, CheckCircle2, AlertCircle, 
  Loader2, Eye, EyeOff, FileCheck, RefreshCw, Server,
  ChevronDown, ChevronUp
} from 'lucide-react';

interface FormState {
  ruc: string;
  razonSocial: string;
  csc: string;
  idCsc: string;
  claveCertificado: string;
  llaveMaestra: string;
  ambiente: 'test' | 'prod';
  // Campos adicionales opcionales
  nombreFantasia?: string;
  timbradoNumero?: string;
  timbradoFecha?: string;
  establecimiento?: string;
  puntoExpedicion?: string;
  direccion?: string;
  telefono?: string;
  correo?: string;
}

interface NotificationState {
  type: 'success' | 'error';
  title: string;
  message: string;
  details?: any;
}

export const SuperAdminOnboarding: React.FC = () => {
  const [formState, setFormState] = useState<FormState>({
    ruc: '',
    razonSocial: '',
    csc: '',
    idCsc: '0001',
    claveCertificado: '',
    llaveMaestra: '',
    ambiente: 'test',
    establecimiento: '001',
    puntoExpedicion: '001'
  });

  const [archivoCertificado, setArchivoCertificado] = useState<File | null>(null);
  const [mostrarClaveCertificado, setMostrarClaveCertificado] = useState(false);
  const [mostrarLlaveMaestra, setMostrarLlaveMaestra] = useState(false);
  const [mostrarCamposAvanzados, setMostrarCamposAvanzados] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<NotificationState | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith('.p12') && !file.name.toLowerCase().endsWith('.pfx')) {
        setNotification({
          type: 'error',
          title: 'Formato de archivo inválido',
          message: 'El certificado debe ser un archivo digital con extensión .p12 o .pfx.'
        });
        return;
      }
      setArchivoCertificado(file);
      setNotification(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!file.name.toLowerCase().endsWith('.p12') && !file.name.toLowerCase().endsWith('.pfx')) {
        setNotification({
          type: 'error',
          title: 'Formato de archivo inválido',
          message: 'El certificado debe ser un archivo digital con extensión .p12 o .pfx.'
        });
        return;
      }
      setArchivoCertificado(file);
      setNotification(null);
    }
  };

  const resetFormulario = (mantenerLlaveMaestra = true) => {
    setFormState(prev => ({
      ruc: '',
      razonSocial: '',
      csc: '',
      idCsc: '0001',
      claveCertificado: '',
      llaveMaestra: mantenerLlaveMaestra ? prev.llaveMaestra : '',
      ambiente: 'test',
      establecimiento: '001',
      puntoExpedicion: '001',
      timbradoNumero: '',
      timbradoFecha: '',
      direccion: '',
      telefono: '',
      correo: ''
    }));
    setArchivoCertificado(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);

    // Validaciones obligatorias
    if (!formState.ruc.trim()) {
      setNotification({
        type: 'error',
        title: 'Campo Requerido',
        message: 'Por favor, ingrese el RUC del emisor (ej: 80001234-5).'
      });
      return;
    }

    if (!formState.razonSocial.trim()) {
      setNotification({
        type: 'error',
        title: 'Campo Requerido',
        message: 'Por favor, ingrese la Razón Social del contribuyente.'
      });
      return;
    }

    if (!formState.csc.trim()) {
      setNotification({
        type: 'error',
        title: 'Campo Requerido',
        message: 'Por favor, ingrese el Código de Seguridad del Contribuyente (CSC).'
      });
      return;
    }

    if (!formState.idCsc.trim()) {
      setNotification({
        type: 'error',
        title: 'Campo Requerido',
        message: 'Por favor, ingrese el Identificador de CSC (ej: 0001).'
      });
      return;
    }

    if (!formState.claveCertificado.trim()) {
      setNotification({
        type: 'error',
        title: 'Campo Requerido',
        message: 'Por favor, ingrese la contraseña del certificado digital (.p12).'
      });
      return;
    }

    if (!formState.llaveMaestra.trim()) {
      setNotification({
        type: 'error',
        title: 'Campo Requerido',
        message: 'Por favor, ingrese la Llave Maestra (SUPERADMIN_API_KEY).'
      });
      return;
    }

    if (!archivoCertificado) {
      setNotification({
        type: 'error',
        title: 'Archivo Requerido',
        message: 'Debe adjuntar el archivo del certificado digital (.p12).'
      });
      return;
    }

    setLoading(true);

    try {
      const payload = new FormData();
      payload.append('ruc', formState.ruc.trim());
      payload.append('razonSocial', formState.razonSocial.trim());
      payload.append('csc', formState.csc.trim());
      payload.append('idCsc', formState.idCsc.trim());
      payload.append('claveCertificado', formState.claveCertificado.trim());
      payload.append('ambiente', formState.ambiente);

      if (formState.establecimiento?.trim()) payload.append('establecimiento', formState.establecimiento.trim());
      if (formState.puntoExpedicion?.trim()) payload.append('puntoExpedicion', formState.puntoExpedicion.trim());
      if (formState.timbradoNumero?.trim()) payload.append('timbradoNumero', formState.timbradoNumero.trim());
      if (formState.timbradoFecha?.trim()) payload.append('timbradoFecha', formState.timbradoFecha.trim());
      if (formState.direccion?.trim()) payload.append('direccion', formState.direccion.trim());
      if (formState.telefono?.trim()) payload.append('telefono', formState.telefono.trim());
      if (formState.correo?.trim()) payload.append('correo', formState.correo.trim());

      payload.append('certificado', archivoCertificado);

      const endpoint = 'https://olga-sifen-api-933976114072.us-central1.run.app/api/admin/onboarding';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'x-superadmin-api-key': formState.llaveMaestra.trim()
        },
        body: payload
      });

      const responseData = await response.json();

      if (response.ok && responseData.success) {
        setNotification({
          type: 'success',
          title: '¡Inquilino Registrado Exitosamente!',
          message: responseData.mensaje || `La empresa ${responseData.inquilino?.razonSocial || formState.razonSocial} fue configurada correctamente en el ecosistema SaaS.`,
          details: responseData.inquilino
        });
        resetFormulario(true);
      } else {
        setNotification({
          type: 'error',
          title: 'Error de Onboarding',
          message: responseData.mensaje || responseData.error || `Error del servidor (${response.status}): ${response.statusText}`
        });
      }
    } catch (err: any) {
      console.error('Error al enviar onboarding a Cloud Run:', err);
      setNotification({
        type: 'error',
        title: 'Error de Conexión',
        message: err.message || 'No fue posible conectar con el microservicio SIFEN Cloud Run. Verifique su conexión y vuelva a intentarlo.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 md:p-6 animate-fade-in w-full box-border max-w-4xl mx-auto text-slate-200">
      {/* Header Compacto */}
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            Superadmin · SIFEN
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            Onboarding de Inquilinos SaaS
          </h1>
          <p className="text-slate-400 text-xs font-normal mt-0.5">
            Alta de empresas emisoras, guardado seguro de certificados .p12 y sincronización Firestore.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[#0B1120] border border-gray-800 rounded-lg px-3 py-1.5 self-start sm:self-auto text-xs text-slate-400">
          <Server className="w-3.5 h-3.5 text-emerald-400" />
          <span>API: <strong className="text-slate-200">olga-sifen-api</strong></span>
        </div>
      </div>

      {/* Notificaciones Visuales */}
      {notification && (
        <div className={`mb-5 p-4 rounded-xl border transition-all animate-fade-in text-xs ${
          notification.type === 'success' 
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200 shadow-sm' 
            : 'bg-rose-950/40 border-rose-500/40 text-rose-200 shadow-sm'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`p-1.5 rounded-lg mt-0.5 shrink-0 ${
              notification.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
            }`}>
              {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white text-sm">{notification.title}</h3>
              <p className="mt-0.5 opacity-90">{notification.message}</p>
              
              {notification.details && (
                <div className="mt-2.5 p-2.5 bg-black/40 rounded-lg border border-white/5 font-mono text-[11px] text-slate-300 grid grid-cols-2 gap-2">
                  <p><span className="text-slate-500">RUC:</span> <strong className="text-white">{notification.details.ruc}</strong></p>
                  <p><span className="text-slate-500">Razón Social:</span> <strong className="text-white">{notification.details.razonSocial}</strong></p>
                  <p className="col-span-2 truncate"><span className="text-slate-500">Storage:</span> <span className="text-emerald-400">{notification.details.rutaCertificadoStorage}</span></p>
                </div>
              )}
            </div>
            <button 
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-white font-semibold px-2 py-0.5 shrink-0"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Formulario Compacto - Bento Box 2 Columnas */}
      <form onSubmit={handleSubmit} className="bg-[#0B1120] border border-gray-800 rounded-xl p-4 md:p-5 shadow-sm space-y-4">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Fila 1: RUC y Razón Social */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              RUC del Emisor <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              name="ruc"
              value={formState.ruc}
              onChange={handleInputChange}
              placeholder="Ej: 80001234-5"
              required
              className="w-full h-10 py-2 px-3 text-sm bg-slate-950 border border-gray-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Razón Social <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              name="razonSocial"
              value={formState.razonSocial}
              onChange={handleInputChange}
              placeholder="Ej: MI EMPRESA S.A."
              required
              className="w-full h-10 py-2 px-3 text-sm bg-slate-950 border border-gray-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors uppercase"
            />
          </div>

          {/* Fila 2: CSC e ID CSC + Ambiente */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Código de Seguridad (CSC) <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              name="csc"
              value={formState.csc}
              onChange={handleInputChange}
              placeholder="Código provisto por la SET"
              required
              className="w-full h-10 py-2 px-3 text-sm bg-slate-950 border border-gray-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                ID CSC <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                name="idCsc"
                value={formState.idCsc}
                onChange={handleInputChange}
                placeholder="0001"
                required
                className="w-full h-10 py-2 px-3 text-sm bg-slate-950 border border-gray-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors font-mono text-center"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Ambiente
              </label>
              <select
                name="ambiente"
                value={formState.ambiente}
                onChange={handleInputChange}
                className="w-full h-10 py-2 px-2 text-sm bg-slate-950 border border-gray-800 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors font-semibold"
              >
                <option value="test">🧪 Test</option>
                <option value="prod">🚀 Prod</option>
              </select>
            </div>
          </div>

          {/* Fila 3: Contraseña del Certificado y Llave Maestra */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Contraseña del Certificado (.p12) <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type={mostrarClaveCertificado ? 'text' : 'password'}
                name="claveCertificado"
                value={formState.claveCertificado}
                onChange={handleInputChange}
                placeholder="Clave para abrir el .p12"
                required
                className="w-full h-10 py-2 px-3 text-sm bg-slate-950 border border-gray-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setMostrarClaveCertificado(!mostrarClaveCertificado)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                title={mostrarClaveCertificado ? 'Ocultar' : 'Mostrar'}
              >
                {mostrarClaveCertificado ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Llave Maestra (Superadmin API Key) <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type={mostrarLlaveMaestra ? 'text' : 'password'}
                name="llaveMaestra"
                value={formState.llaveMaestra}
                onChange={handleInputChange}
                placeholder="Clave SUPERADMIN_API_KEY"
                required
                className="w-full h-10 py-2 px-3 text-sm bg-slate-950 border border-gray-800 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setMostrarLlaveMaestra(!mostrarLlaveMaestra)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
                title={mostrarLlaveMaestra ? 'Ocultar' : 'Mostrar'}
              >
                {mostrarLlaveMaestra ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Fila 4 (Ancho completo): Archivo de Certificado PKCS#12 */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Archivo de Certificado (.p12 / .pfx) <span className="text-rose-400">*</span>
            </label>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed rounded-lg p-3 text-center cursor-pointer transition-all ${
                archivoCertificado
                  ? 'border-emerald-500/50 bg-emerald-950/20 text-emerald-200'
                  : 'border-gray-800 bg-slate-950/60 text-slate-400 hover:border-gray-700'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".p12,.pfx,application/x-pkcs12"
                className="hidden"
              />

              {archivoCertificado ? (
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div className="text-left truncate">
                      <p className="font-semibold text-xs text-white truncate">{archivoCertificado.name}</p>
                      <p className="text-[10px] text-emerald-400">{(archivoCertificado.size / 1024).toFixed(1)} KB · Certificado cargado</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 hover:text-white font-medium underline shrink-0 ml-2">Cambiar</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 py-1">
                  <UploadCloud className="w-5 h-5 text-slate-500" />
                  <span className="text-xs font-medium text-slate-300">Arrastre aquí su archivo .p12 o haga clic para seleccionar</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Campos Opcionales Desplegables */}
        <div className="pt-1 border-t border-gray-800/60">
          <button
            type="button"
            onClick={() => setMostrarCamposAvanzados(!mostrarCamposAvanzados)}
            className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            {mostrarCamposAvanzados ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{mostrarCamposAvanzados ? 'Ocultar campos opcionales de timbrado' : 'Configurar campos opcionales (Timbrado, Establecimiento, Dirección)'}</span>
          </button>
        </div>

        {mostrarCamposAvanzados && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1 text-xs animate-fade-in">
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1">Establecimiento</label>
              <input
                type="text"
                name="establecimiento"
                value={formState.establecimiento}
                onChange={handleInputChange}
                className="w-full h-9 py-1.5 px-3 text-xs bg-slate-950 border border-gray-800 rounded-lg text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1">Punto Expedición</label>
              <input
                type="text"
                name="puntoExpedicion"
                value={formState.puntoExpedicion}
                onChange={handleInputChange}
                className="w-full h-9 py-1.5 px-3 text-xs bg-slate-950 border border-gray-800 rounded-lg text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1">Nº Timbrado</label>
              <input
                type="text"
                name="timbradoNumero"
                value={formState.timbradoNumero || ''}
                onChange={handleInputChange}
                placeholder="12345678"
                className="w-full h-9 py-1.5 px-3 text-xs bg-slate-950 border border-gray-800 rounded-lg text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1">Fecha Timbrado</label>
              <input
                type="date"
                name="timbradoFecha"
                value={formState.timbradoFecha || ''}
                onChange={handleInputChange}
                className="w-full h-9 py-1.5 px-3 text-xs bg-slate-950 border border-gray-800 rounded-lg text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1">Dirección</label>
              <input
                type="text"
                name="direccion"
                value={formState.direccion || ''}
                onChange={handleInputChange}
                placeholder="Av. Principal 123"
                className="w-full h-9 py-1.5 px-3 text-xs bg-slate-950 border border-gray-800 rounded-lg text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-400 uppercase mb-1">Correo Notificaciones</label>
              <input
                type="email"
                name="correo"
                value={formState.correo || ''}
                onChange={handleInputChange}
                placeholder="empresa@correo.com"
                className="w-full h-9 py-1.5 px-3 text-xs bg-slate-950 border border-gray-800 rounded-lg text-white"
              />
            </div>
          </div>
        )}

        {/* Fila de Acciones */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-800/80">
          <button
            type="button"
            onClick={() => resetFormulario(true)}
            disabled={loading}
            className="h-10 px-4 rounded-lg border border-gray-800 text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Limpiar
          </button>

          <button
            type="submit"
            disabled={loading}
            className="h-10 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Registrando...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Registrar Inquilino SIFEN</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SuperAdminOnboarding;
