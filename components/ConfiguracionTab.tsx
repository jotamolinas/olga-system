import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Settings, 
  Building, 
  Bell, 
  Shield, 
  Upload, 
  Users, 
  Check, 
  X, 
  Trash2, 
  Image as ImageIcon, 
  Plus, 
  Lock, 
  AlertCircle,
  CheckCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { Pagare } from '../types';

export interface ConfiguracionInstitucionalData {
  nombreInstitucion: string;
  ruc: string;
  registroNotarial: string;
  logoUrl: string | null;
  notificacionesVencimiento: boolean;
  multasMoraAutomatica: boolean;
  numeracionCorrelativa: boolean;
  autenticacion2FA: boolean;
}

export interface AlertaNotarial {
  id: string;
  tipo: 'vencida' | 'inminente';
  titulo: string;
  detalle: string;
  pagareId: string;
  correlativo: number;
  deudor: string;
  cuotaNro: string;
  monto: number;
  moneda: string;
  fechaVencimiento: string;
  diasDiferencia: number;
  leida: boolean;
}

interface ConfiguracionTabProps {
  onConfigUpdate?: (config: ConfiguracionInstitucionalData) => void;
  initialData?: Partial<ConfiguracionInstitucionalData>;
  pagares?: Pagare[];
}

const STORAGE_KEY = 'olga_configuracion_institucional';
const ALERTAS_LEIDAS_KEY = 'olga_alertas_leidas_ids';

/**
 * Función pura para calcular alertas dinámicas a partir de los pagarés reales
 */
export function calcularAlertasNotariales(
  listaPagares: Pagare[],
  leidasIds: string[] = []
): AlertaNotarial[] {
  if (!listaPagares || !Array.isArray(listaPagares)) return [];

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const alertas: AlertaNotarial[] = [];

  for (const pag of listaPagares) {
    // Excluir pagarés dados de baja o anulados
    if (pag.status === 'anulado' || pag.estado === 'Anulado') continue;
    if (!pag.cronograma || !Array.isArray(pag.cronograma)) continue;

    for (const item of pag.cronograma) {
      // Omitir cuotas ya cobradas o marcadas como pagadas
      const estaCobrada = Boolean(item.pagado || item.estado === 'cobrado');
      if (estaCobrada) continue;

      if (!item.fecha_pag) continue;
      const partesFecha = item.fecha_pag.split('-');
      if (partesFecha.length !== 3) continue;

      const fechaCuota = new Date(
        parseInt(partesFecha[0], 10),
        parseInt(partesFecha[1], 10) - 1,
        parseInt(partesFecha[2], 10)
      );
      fechaCuota.setHours(0, 0, 0, 0);

      const diffMs = fechaCuota.getTime() - hoy.getTime();
      const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

      const alertId = `alerta-${pag.id}-${item.id || item.numero_cuota || item.fecha_pag}`;
      const isLeida = leidasIds.includes(alertId);

      const deudor = pag.deudor_nombre_raw || 'Deudor sin registrar';
      const cuotaNro = item.numero_cuota || '1';
      const correlativo = pag.correlativo || 0;
      const montoFormateado = item.monto ? item.monto.toLocaleString('es-PY') : '0';
      const moneda = pag.moneda || 'PYG';

      // 1. Cuota Vencida: fecha de pago ya pasó y no está pagada (diffDias < 0)
      if (diffDias < 0) {
        const diasAtraso = Math.abs(diffDias);
        alertas.push({
          id: alertId,
          tipo: 'vencida',
          titulo: `Cuota ${cuotaNro} Vencida (Pagaré #${correlativo})`,
          detalle: `Deudor: ${deudor}. Venció el ${item.fecha_pag} (${diasAtraso} ${diasAtraso === 1 ? 'día' : 'días'} de atraso). Monto: ${montoFormateado} ${moneda}.`,
          pagareId: pag.id,
          correlativo,
          deudor,
          cuotaNro,
          monto: item.monto || 0,
          moneda,
          fechaVencimiento: item.fecha_pag,
          diasDiferencia: diffDias,
          leida: isLeida
        });
      } 
      // 2. Vencimiento Inminente: cuota que vence en los próximos 5 días (0 <= diffDias <= 5)
      else if (diffDias >= 0 && diffDias <= 5) {
        const plazo = diffDias === 0 ? 'vence hoy' : `vence en ${diffDias} ${diffDias === 1 ? 'día' : 'días'}`;
        alertas.push({
          id: alertId,
          tipo: 'inminente',
          titulo: `Vencimiento Inminente - Cuota ${cuotaNro} (Pagaré #${correlativo})`,
          detalle: `Deudor: ${deudor}. ${plazo} (${item.fecha_pag}). Monto: ${montoFormateado} ${moneda}.`,
          pagareId: pag.id,
          correlativo,
          deudor,
          cuotaNro,
          monto: item.monto || 0,
          moneda,
          fechaVencimiento: item.fecha_pag,
          diasDiferencia: diffDias,
          leida: isLeida
        });
      }
    }
  }

  // Ordenar: primero las vencidas por mayor atraso, luego las inminentes más próximas
  alertas.sort((a, b) => a.diasDiferencia - b.diasDiferencia);

  return alertas;
}

/**
 * Comprime una imagen a formato WebP utilizando un <canvas> oculto.
 * Reduce las dimensiones a un ancho máximo de 400px (manteniendo el aspect ratio original).
 * REGLA CRÍTICA DE FORMATO: Convierte estrictamente usando canvas.toDataURL('image/webp', 0.8).
 * Previene el QuotaExceededError en localStorage garantizando soporte para transparencias.
 */
export const comprimirImagenWebP = (file: File, maxWidth = 400): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Error al cargar la imagen'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo inicializar el contexto 2D del canvas'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        try {
          const webpData = canvas.toDataURL('image/webp', 0.8);
          resolve(webpData);
        } catch (err) {
          reject(err);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const ConfiguracionTab: React.FC<ConfiguracionTabProps> = ({ 
  onConfigUpdate,
  initialData,
  pagares = []
}) => {
  // Helper para inicializar configuración desde localStorage
  const loadStoredConfig = (): ConfiguracionInstitucionalData => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          nombreInstitucion: parsed.nombreInstitucion || 'Escribanía Pública Molinas & Asociados',
          ruc: parsed.ruc || '80012345-6',
          registroNotarial: parsed.registroNotarial || 'Registro Notarial N° 742 - Asunción',
          logoUrl: parsed.logoUrl || null,
          notificacionesVencimiento: parsed.notificacionesVencimiento ?? true,
          multasMoraAutomatica: parsed.multasMoraAutomatica ?? true,
          numeracionCorrelativa: parsed.numeracionCorrelativa ?? true,
          autenticacion2FA: parsed.autenticacion2FA ?? false
        };
      }
    } catch (e) {
      console.warn('Error leyendo configuración de localStorage:', e);
    }

    return {
      nombreInstitucion: initialData?.nombreInstitucion || 'Escribanía Pública Molinas & Asociados',
      ruc: initialData?.ruc || '80012345-6',
      registroNotarial: initialData?.registroNotarial || 'Registro Notarial N° 742 - Asunción',
      logoUrl: initialData?.logoUrl || null,
      notificacionesVencimiento: initialData?.notificacionesVencimiento ?? true,
      multasMoraAutomatica: initialData?.multasMoraAutomatica ?? true,
      numeracionCorrelativa: initialData?.numeracionCorrelativa ?? true,
      autenticacion2FA: initialData?.autenticacion2FA ?? false
    };
  };

  const initialValues = loadStoredConfig();

  // Estados Perfil Institucional
  const [nombreInstitucion, setNombreInstitucion] = useState(initialValues.nombreInstitucion);
  const [ruc, setRuc] = useState(initialValues.ruc);
  const [registroNotarial, setRegistroNotarial] = useState(initialValues.registroNotarial);
  const [logoPreview, setLogoPreview] = useState<string | null>(initialValues.logoUrl);

  // Estados Preferencias y Notificaciones (Toggles)
  const [notificacionesVencimiento, setNotificacionesVencimiento] = useState(initialValues.notificacionesVencimiento);
  const [multasMoraAutomatica, setMultasMoraAutomatica] = useState(initialValues.multasMoraAutomatica);
  const [numeracionCorrelativa, setNumeracionCorrelativa] = useState(initialValues.numeracionCorrelativa);

  // Estados Seguridad y Accesos
  const [autenticacion2FA, setAutenticacion2FA] = useState(initialValues.autenticacion2FA);
  const [modalUsuariosAbierto, setModalUsuariosAbierto] = useState(false);

  // Pagarés activos: de props o de localStorage si prop está vacío
  const pagaresEfectivos = useMemo(() => {
    if (pagares && Array.isArray(pagares) && pagares.length > 0) {
      return pagares;
    }
    try {
      const stored = localStorage.getItem('olga_pagares') || localStorage.getItem('ihara_pagares');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }, [pagares]);

  // Mensaje flotante de confirmación de éxito
  const [mensajeExito, setMensajeExito] = useState('');
  const timeoutMensajeRef = useRef<number | null>(null);

  // Lista local simulada para Gestionar Usuarios (100% en memoria)
  const [usuariosSimulados, setUsuariosSimulados] = useState([
    { id: '1', nombre: 'Esc. Titular Jota Molinas', email: 'titular@escribania.com.py', rol: 'Escribano Titular', estado: 'Activo' },
    { id: '2', nombre: 'Dra. Olga Ihara Feltes', email: 'olga.ihara.feltes@gmail.com', rol: 'Abogada Adjunta', estado: 'Activo' },
    { id: '3', nombre: 'Secretaría de Protocolo', email: 'protocolo@escribania.com.py', rol: 'Oficial de Notaría', estado: 'Activo' }
  ]);
  const [nuevoUsuarioNombre, setNuevoUsuarioNombre] = useState('');
  const [nuevoUsuarioEmail, setNuevoUsuarioEmail] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manejo de carga de logo comprimido a formato WebP (Previene QuotaExceededError)
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const webpBase64 = await comprimirImagenWebP(file, 400);
        setLogoPreview(webpBase64);
        guardarYNotificar({ logoUrl: webpBase64 }, 'Logo institucional optimizado (WebP) y sincronizado.');
      } catch (err) {
        console.error('Error al procesar y comprimir la imagen:', err);
        mostrarMensajeExito('Error al procesar la imagen del logo.');
      }
    }
  };

  const handleRemoverLogo = () => {
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    guardarYNotificar({ logoUrl: null }, 'Logo institucional removido.');
  };

  // Función principal para persistir en localStorage y propagar globalmente
  const guardarYNotificar = (
    overrides?: Partial<ConfiguracionInstitucionalData>,
    mensajeFeedback?: string
  ) => {
    const dataToSave: ConfiguracionInstitucionalData = {
      nombreInstitucion: overrides?.nombreInstitucion ?? nombreInstitucion,
      ruc: overrides?.ruc ?? ruc,
      registroNotarial: overrides?.registroNotarial ?? registroNotarial,
      logoUrl: overrides?.logoUrl !== undefined ? overrides.logoUrl : logoPreview,
      notificacionesVencimiento: overrides?.notificacionesVencimiento ?? notificacionesVencimiento,
      multasMoraAutomatica: overrides?.multasMoraAutomatica ?? multasMoraAutomatica,
      numeracionCorrelativa: overrides?.numeracionCorrelativa ?? numeracionCorrelativa,
      autenticacion2FA: overrides?.autenticacion2FA ?? autenticacion2FA
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
      window.dispatchEvent(new CustomEvent('olga_config_updated', { detail: dataToSave }));
    } catch (err) {
      console.error('Error guardando en localStorage:', err);
    }

    if (onConfigUpdate) {
      onConfigUpdate(dataToSave);
    }

    mostrarMensajeExito(mensajeFeedback || '¡Cambios guardados exitosamente!');
  };

  const mostrarMensajeExito = (texto: string) => {
    setMensajeExito(texto);
    if (timeoutMensajeRef.current) {
      window.clearTimeout(timeoutMensajeRef.current);
    }
    timeoutMensajeRef.current = window.setTimeout(() => {
      setMensajeExito('');
    }, 4000);
  };

  const handleGuardarPerfil = (e: React.FormEvent) => {
    e.preventDefault();
    guardarYNotificar(undefined, '¡Perfil Institucional guardado exitosamente!');
  };


  // Gestión de usuarios simulada
  const handleAgregarUsuario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoUsuarioNombre.trim() || !nuevoUsuarioEmail.trim()) return;
    const nuevo = {
      id: String(Date.now()),
      nombre: nuevoUsuarioNombre.trim(),
      email: nuevoUsuarioEmail.trim(),
      rol: 'Operador de Notaría',
      estado: 'Activo'
    };
    setUsuariosSimulados([...usuariosSimulados, nuevo]);
    setNuevoUsuarioNombre('');
    setNuevoUsuarioEmail('');
    mostrarMensajeExito(`Operador "${nuevo.nombre}" incorporado al equipo.`);
  };

  const handleEliminarUsuario = (id: string) => {
    setUsuariosSimulados(usuariosSimulados.filter(u => u.id !== id));
    mostrarMensajeExito('Operador removido del equipo local.');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6 bg-slate-50 min-h-screen">
      {/* Cabecera Principal Estilo Enterprise con Campana Interactiva */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700 text-[#FF3131] shrink-0">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold font-serif tracking-tight text-white">Configuración del Sistema</h2>
            <p className="text-slate-300 text-xs mt-0.5">
              Parámetros institucionales, sincronización en tiempo real y directivas de seguridad.
            </p>
          </div>
        </div>

        {/* Panel de Acciones Superiores */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          <span className="px-3 py-1.5 bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold">
            {pagaresEfectivos.length} Pagarés Monitoreados
          </span>
        </div>
      </div>

      {/* Cartel de Advertencia Notarial Reglamentaria */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl flex items-start gap-3 shadow-sm">
        <AlertCircle className="w-5 h-5 text-[#FF3131] shrink-0 mt-0.5" />
        <div className="text-xs text-slate-600 leading-relaxed">
          <strong className="text-slate-900 block mb-0.5">Aviso Notarial de Resguardo y Validación:</strong>
          Todo documento, pagaré o instrumento generado por la plataforma constituye un borrador técnico avanzado. Su validez legal y administrativa plena requiere la revisión, autorización y sello protocolar del <strong>Escribano Titular</strong>.
        </div>
      </div>

      {/* Banner / Mensaje Flotante de Éxito de Persistencia */}
      {mensajeExito && (
        <div className="p-4 bg-slate-900 text-white border border-slate-700 rounded-xl flex items-center justify-between text-xs font-bold shadow-xl animate-fade-in">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-full bg-[#FF3131] flex items-center justify-center text-white shrink-0">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
            <span className="tracking-wide">{mensajeExito}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setMensajeExito('')} 
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tarjeta 1: Perfil Institucional */}
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 rounded-xl text-slate-900">
              <Building className="w-5 h-5 text-[#FF3131]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Perfil Institucional</h3>
              <p className="text-xs text-slate-500">Datos públicos, membrete protocolar e identidad visual para todo el sistema</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleGuardarPerfil} className="space-y-6">
          <div className="flex flex-col md:flex-row items-center gap-6 p-5 bg-slate-50 rounded-2xl border border-slate-200">
            {/* Círculo grande placeholder para el logo */}
            <div className="relative group shrink-0">
              <div className="w-28 h-28 rounded-full border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden shadow-inner">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo Notaría" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                    <ImageIcon className="w-8 h-8 mb-1 text-slate-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Logo Notaría</span>
                  </div>
                )}
              </div>
            </div>

            {/* Controles para subir logo */}
            <div className="space-y-2 text-center md:text-left flex-grow">
              <h4 className="text-sm font-bold text-slate-800">Insignia o Logotipo Oficial</h4>
              <p className="text-xs text-slate-500 max-w-md">
                Se guardará en localStorage y se sincronizará automáticamente con el encabezado y panel lateral de la aplicación.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1 justify-center md:justify-start">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleLogoUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5 text-[#FF3131]" />
                  <span>Subir Logo</span>
                </button>
                {logoPreview && (
                  <button
                    type="button"
                    onClick={handleRemoverLogo}
                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    <span>Quitar</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Campos de texto limpios */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-xs font-bold uppercase text-slate-600 tracking-wider mb-1.5">
                Nombre de la Escribanía / Empresa *
              </label>
              <input
                type="text"
                value={nombreInstitucion}
                onChange={(e) => setNombreInstitucion(e.target.value)}
                placeholder="Ej. Escribanía Pública López"
                className="w-full bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none transition-colors"
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs font-bold uppercase text-slate-600 tracking-wider mb-1.5">
                RUC *
              </label>
              <input
                type="text"
                value={ruc}
                onChange={(e) => setRuc(e.target.value)}
                placeholder="Ej. 80012345-6"
                className="w-full bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none transition-colors font-mono"
              />
            </div>

            <div className="md:col-span-1">
              <label className="block text-xs font-bold uppercase text-slate-600 tracking-wider mb-1.5">
                N° de Registro Notarial *
              </label>
              <input
                type="text"
                value={registroNotarial}
                onChange={(e) => setRegistroNotarial(e.target.value)}
                placeholder="Ej. Registro N° 120"
                className="w-full bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none transition-colors"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#FF3131] hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-md flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Guardar Perfil Institucional</span>
            </button>
          </div>
        </form>
      </div>

      {/* Tarjeta 2: Preferencias y Notificaciones */}
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
          <div className="p-2.5 bg-slate-100 rounded-xl text-slate-900">
            <Bell className="w-5 h-5 text-[#FF3131]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Preferencias y Notificaciones</h3>
            <p className="text-xs text-slate-500">Automatizaciones operativas y alertas del flujo notarial</p>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {/* Toggle 1 */}
          <div className="py-4 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-sm font-bold text-slate-800 block">
                Activar notificaciones de vencimientos
              </span>
              <p className="text-xs text-slate-500">
                Emite recordatorios preventivos y alertas en la campana 5 días antes de la caducidad de cuotas.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notificacionesVencimiento}
              onClick={() => {
                const nuevo = !notificacionesVencimiento;
                setNotificacionesVencimiento(nuevo);
                guardarYNotificar({ notificacionesVencimiento: nuevo }, nuevo ? 'Notificaciones de vencimiento activadas.' : 'Notificaciones de vencimiento desactivadas.');
              }}
              className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                notificacionesVencimiento ? 'bg-[#FF3131]' : 'bg-slate-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  notificacionesVencimiento ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Toggle 2 */}
          <div className="py-4 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-sm font-bold text-slate-800 block">
                Aplicar multas por mora automáticamente
              </span>
              <p className="text-xs text-slate-500">
                Calcula recargos compensatorios y punitorios reglamentarios al sobrepasar el plazo perentorio fijado.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={multasMoraAutomatica}
              onClick={() => {
                const nuevo = !multasMoraAutomatica;
                setMultasMoraAutomatica(nuevo);
                guardarYNotificar({ multasMoraAutomatica: nuevo }, nuevo ? 'Multas por mora automáticas habilitadas.' : 'Multas por mora automáticas pausadas.');
              }}
              className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                multasMoraAutomatica ? 'bg-[#FF3131]' : 'bg-slate-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  multasMoraAutomatica ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Toggle 3 */}
          <div className="py-4 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-sm font-bold text-slate-800 block">
                Numeración correlativa automática
              </span>
              <p className="text-xs text-slate-500">
                Garantiza correlatividad estricta sin omisiones ni duplicaciones en el registro de pagarés creados.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={numeracionCorrelativa}
              onClick={() => {
                const nuevo = !numeracionCorrelativa;
                setNumeracionCorrelativa(nuevo);
                guardarYNotificar({ numeracionCorrelativa: nuevo }, nuevo ? 'Numeración correlativa secuencial forzada.' : 'Numeración correlativa manual permitida.');
              }}
              className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                numeracionCorrelativa ? 'bg-[#FF3131]' : 'bg-slate-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  numeracionCorrelativa ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Tarjeta 3: Seguridad y Accesos */}
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
          <div className="p-2.5 bg-slate-100 rounded-xl text-slate-900">
            <Shield className="w-5 h-5 text-[#FF3131]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Seguridad y Accesos</h3>
            <p className="text-xs text-slate-500">Blindaje de credenciales y autorización de operadores notariados</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Toggle 2FA */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-slate-700 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">
                    Autenticación en 2 pasos (2FA)
                  </span>
                  <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-slate-200 text-slate-800">
                    Recomendado
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Exige confirmación por token o código OTP antes de emitir o certificar pagarés con valor cambiario.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autenticacion2FA}
              onClick={() => {
                const nuevo = !autenticacion2FA;
                setAutenticacion2FA(nuevo);
                guardarYNotificar({ autenticacion2FA: nuevo }, nuevo ? 'Autenticación 2FA activada para todos los operadores.' : 'Autenticación 2FA deshabilitada.');
              }}
              className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                autenticacion2FA ? 'bg-[#FF3131]' : 'bg-slate-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  autenticacion2FA ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Botón secundario Gestionar Usuarios */}
          <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 gap-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-slate-700 shrink-0" />
              <div>
                <span className="text-sm font-bold text-slate-900 block">
                  Control de Operadores Notariales
                </span>
                <p className="text-xs text-slate-500">
                  {usuariosSimulados.length} miembros autorizados para la confección y control de minutas.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setModalUsuariosAbierto(true)}
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <Users className="w-3.5 h-3.5 text-[#FF3131]" />
              <span>Gestionar Usuarios</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Interactivo de Gestión de Usuarios (100% en memoria) */}
      {modalUsuariosAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-[#FF3131]" />
                <h4 className="text-base font-bold text-white">Gestión de Usuarios y Operadores</h4>
              </div>
              <button
                type="button"
                onClick={() => setModalUsuariosAbierto(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Formulario para agregar usuario */}
              <form onSubmit={handleAgregarUsuario} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  Registrar Nuevo Operador Local
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Nombre Completo"
                    value={nuevoUsuarioNombre}
                    onChange={(e) => setNuevoUsuarioNombre(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-[#FF3131]"
                  />
                  <input
                    type="email"
                    required
                    placeholder="Correo Electrónico"
                    value={nuevoUsuarioEmail}
                    onChange={(e) => setNuevoUsuarioEmail(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-[#FF3131]"
                  />
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#FF3131] hover:bg-red-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Operador</span>
                  </button>
                </div>
              </form>

              {/* Lista de usuarios */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  Equipo Habilitado ({usuariosSimulados.length})
                </span>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {usuariosSimulados.map((u) => (
                    <div key={u.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs border border-slate-200">
                          {u.nombre.charAt(0)}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">{u.nombre}</span>
                          <span className="text-[11px] text-slate-500 font-mono">{u.email}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {u.rol}
                        </span>
                        {usuariosSimulados.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleEliminarUsuario(u.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                            title="Eliminar acceso"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setModalUsuariosAbierto(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Cerrar Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
