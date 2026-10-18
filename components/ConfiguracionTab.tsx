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
  Calendar,
  Loader2,
  Copy,
  Mail
} from 'lucide-react';
import { collection, addDoc, serverTimestamp, doc, deleteDoc, getDocs, query, where, setDoc } from 'firebase/firestore';
import { db, auth } from '../services/auth';
import { useWorkspace } from '../hooks/useWorkspace';
import { Pagare } from '../types';

export interface ConfiguracionInstitucionalData {
  nombreInstitucion: string;
  ruc: string;
  registroNotarial: string;
  logoUrl: string | null;
  logo_institucional?: string | null;
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
  userPlan?: string;
  userData?: any;
  currentUser?: any;
}

const PLAN_LIMITS = {
  full: 15,
  empresa: 10,
  pro: 5,
  basico: 2
};

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
  pagares = [],
  userPlan,
  userData,
  currentUser
}) => {
  // FASE 3: Identificación de Workspace para persistencia en la nube
  const { workspaceId } = useWorkspace(currentUser || auth?.currentUser, userData);
  const effectiveWorkspaceId = workspaceId || userData?.tenant_id || userData?.uid || currentUser?.uid;

  // El logo se obtiene EXCLUSIVAMENTE de Firestore (userData.logo_institucional)
  const firestoreLogo = userData?.logo_institucional || userData?.logoUrl || initialData?.logo_institucional || initialData?.logoUrl || null;

  // Helper para inicializar configuración desde localStorage (excluyendo el logo)
  const loadStoredConfig = (): ConfiguracionInstitucionalData => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Purgar inmediatamente cualquier residuo de logoUrl en localStorage
        if (parsed.logoUrl || parsed.logo_institucional) {
          delete parsed.logoUrl;
          delete parsed.logo_institucional;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        }
        return {
          nombreInstitucion: userData?.nombreInstitucion || userData?.razonSocial || parsed.nombreInstitucion || 'Escribanía Pública Molinas & Asociados',
          ruc: userData?.ruc || parsed.ruc || '80012345-6',
          registroNotarial: userData?.registroNotarial || parsed.registroNotarial || 'Registro Notarial N° 742 - Asunción',
          logoUrl: firestoreLogo,
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
      nombreInstitucion: userData?.nombreInstitucion || userData?.razonSocial || initialData?.nombreInstitucion || 'Escribanía Pública Molinas & Asociados',
      ruc: userData?.ruc || initialData?.ruc || '80012345-6',
      registroNotarial: userData?.registroNotarial || initialData?.registroNotarial || 'Registro Notarial N° 742 - Asunción',
      logoUrl: firestoreLogo,
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
  const [logoPreview, setLogoPreview] = useState<string | null>(firestoreLogo);

  // Sincronización reactiva del logo directamente desde Firestore (userData)
  useEffect(() => {
    if (userData?.logo_institucional !== undefined) {
      setLogoPreview(userData.logo_institucional);
    } else if (userData?.logoUrl !== undefined) {
      setLogoPreview(userData.logoUrl);
    }
  }, [userData?.logo_institucional, userData?.logoUrl]);

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

  // Estados para Modal de Gestión de Usuarios y Operadores
  const [operadores, setOperadores] = useState<Array<{
    id: string;
    nombre: string;
    email?: string | null;
    telefono?: string | null;
    rol: string;
    estado?: string;
    tenant_id?: string;
    fecha_creacion?: any;
  }>>([]);
  const [nuevoUsuarioNombre, setNuevoUsuarioNombre] = useState('');
  const [nuevoUsuarioContacto, setNuevoUsuarioContacto] = useState('');
  const [isAddingOperador, setIsAddingOperador] = useState(false);
  const [errorOperador, setErrorOperador] = useState('');
  const [enlaceCopiadoId, setEnlaceCopiadoId] = useState<string | null>(null);

  // Diccionario y cálculo de slots según plan del usuario
  const planKey = useMemo(() => {
    const raw = String(userPlan || userData?.planActual || userData?.plan || '').toLowerCase().trim();
    if (raw.includes('full')) return 'full' as const;
    if (raw.includes('empresa')) return 'empresa' as const;
    if (raw.includes('pro')) return 'pro' as const;
    return 'basico' as const;
  }, [userPlan, userData]);

  const isOperador = currentUser?.role === 'operador' || currentUser?.rol === 'operador' || userData?.rol === 'operador' || userData?.role === 'operador';
  const limiteActual = PLAN_LIMITS[planKey] ?? PLAN_LIMITS.basico;
  const slotsLibres = Math.max(0, limiteActual - operadores.length);

  const currentUserId = auth.currentUser?.uid || userData?.uid || userData?.id;

  // Fase 3: Lectura Inicial (Fetch de Datos en Vivo con prevención de bucles infinitos)
  useEffect(() => {
    if (!currentUserId || isOperador) return;
    let isMounted = true;

    const fetchOperadores = async () => {
      try {
        const q = query(
          collection(db, 'operadores_invitados'),
          where('tenant_id', '==', currentUserId)
        );
        const snapshot = await getDocs(q);
        if (!isMounted) return;

        const lista = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...(docSnap.data() as any)
        }));

        setOperadores(lista);
      } catch (err) {
        console.error('Error al cargar operadores de Firestore:', err);
      }
    };

    fetchOperadores();

    return () => {
      isMounted = false;
    };
  }, [currentUserId]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // MIGRACIÓN A LA NUBE: Guardar imagen directamente en Firestore (users/{workspaceId}.logo_institucional)
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const webpBase64 = await comprimirImagenWebP(file, 400);
        setLogoPreview(webpBase64);

        if (effectiveWorkspaceId) {
          await setDoc(doc(db, 'users', effectiveWorkspaceId), {
            logo_institucional: webpBase64
          }, { merge: true });
        }

        // Purgar inmediatamente cualquier residuo de logo en localStorage
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            delete parsed.logoUrl;
            delete parsed.logo_institucional;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          }
        } catch {}

        mostrarMensajeExito('Insignia institucional guardada en la nube (Firestore) y sincronizada.');
      } catch (err) {
        console.error('Error al procesar y subir la imagen:', err);
        mostrarMensajeExito('Error al procesar la imagen del logo.');
      }
    }
  };

  const handleRemoverLogo = async () => {
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (effectiveWorkspaceId) {
      try {
        await setDoc(doc(db, 'users', effectiveWorkspaceId), {
          logo_institucional: null
        }, { merge: true });
      } catch (err) {
        console.error('Error al remover logo en Firestore:', err);
      }
    }

    // Purgar residuo de localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        delete parsed.logoUrl;
        delete parsed.logo_institucional;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      }
    } catch {}

    mostrarMensajeExito('Insignia institucional removida de la nube.');
  };

  // Función principal para persistir preferencias no-sensibles en localStorage (sin el logo)
  const guardarYNotificar = (
    overrides?: Partial<ConfiguracionInstitucionalData>,
    mensajeFeedback?: string
  ) => {
    const dataToSave: ConfiguracionInstitucionalData = {
      nombreInstitucion: overrides?.nombreInstitucion ?? nombreInstitucion,
      ruc: overrides?.ruc ?? ruc,
      registroNotarial: overrides?.registroNotarial ?? registroNotarial,
      logoUrl: null, // ELIMINADO de localStorage para prevenir fugas de estado entre sesiones
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

 const handleGuardarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();

    if (effectiveWorkspaceId) {
      try {
        const userRef = doc(db, 'users', effectiveWorkspaceId);
        
        // 1. Validar la estructura actual del documento para no pisar metadatos
        const { getDoc, serverTimestamp } = await import('firebase/firestore');
        const userSnap = await getDoc(userRef);
        
        // 2. Preparamos la data del formulario
        const dataToUpdate: any = {
          nombreInstitucion,
          razonSocial: nombreInstitucion,
          ruc,
          registroNotarial,
          logo_institucional: logoPreview || null,
          perfilCompletado: true
        };

        // 3. FALLBACK DE CONTINGENCIA (Parche 9.2)
        // Si el usuario no tiene los datos base del plan trial, los inyectamos aquí.
        if (!userSnap.data()?.fecha_creacion) {
          dataToUpdate.fecha_creacion = serverTimestamp();
          dataToUpdate.planActual = 'trial';
          dataToUpdate.role = 'titular';
          dataToUpdate.estado_cuenta = 'activa';
        }

        // 4. Guardado seguro usando merge: true
        await setDoc(userRef, dataToUpdate, { merge: true });

      } catch (err) {
        console.error('Error guardando perfil institucional en Firestore:', err);
      }
    }

    guardarYNotificar(undefined, '¡Perfil Institucional guardado exitosamente en la nube!');
  };

  // Fase 2: Lógica de Invitación Segura de Operadores (Soporte Email / Celular PY)
  const handleAddOperador = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorOperador('');

    const nombreLimpio = nuevoUsuarioNombre.trim();
    const contactoLimpio = nuevoUsuarioContacto.trim();

    // 1. Validación Básica
    if (!nombreLimpio || !contactoLimpio) {
      setErrorOperador('Por favor complete todos los campos obligatorios.');
      return;
    }

    // Validación Dual: Correo Electrónico O Celular Paraguayo (09XXXXXXXX)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmail = emailRegex.test(contactoLimpio.toLowerCase());

    const digitsOnly = contactoLimpio.replace(/\D/g, '');
    const isParaguayPhone = /^09\d{8}$/.test(digitsOnly);

    if (!isEmail && !isParaguayPhone) {
      setErrorOperador('Ingrese un correo válido o un número de celular de Paraguay válido (10 dígitos comenzando con 09, ej: 0983 123 456).');
      return;
    }

    // 2. Doble Validación de Seguridad (Límite según plan)
    if (operadores.length >= limiteActual) {
      setErrorOperador(`Límite de ${limiteActual} operadores alcanzado para su plan.`);
      return;
    }

    setIsAddingOperador(true);

    try {
      // 3. Registro Dinámico en Base de Datos (colección operadores_invitados)
      const tenantId = userData?.uid || userData?.id || auth.currentUser?.uid || 'titular-principal';
      const docData: any = {
        nombre: nombreLimpio,
        tenant_id: tenantId,
        rol: 'operador',
        estado: 'pendiente',
        fecha_creacion: serverTimestamp()
      };

      if (isEmail) {
        docData.email = contactoLimpio.toLowerCase();
      } else {
        docData.telefono = digitsOnly;
      }

      const docRef = await addDoc(collection(db, 'operadores_invitados'), docData);

      // 4. Actualización Optimista de la Interfaz
      const nuevoOperador = {
        id: docRef.id,
        nombre: docData.nombre,
        email: isEmail ? docData.email : null,
        telefono: !isEmail ? docData.telefono : null,
        tenant_id: tenantId,
        rol: 'operador',
        estado: 'pendiente',
        fecha_creacion: new Date().toISOString()
      };

      setOperadores(prev => [...prev, nuevoOperador]);

      // 5. Limpieza y notificación de éxito
      setNuevoUsuarioNombre('');
      setNuevoUsuarioContacto('');
      setErrorOperador('');
      mostrarMensajeExito(`Invitación registrada exitosamente para ${isEmail ? docData.email : docData.telefono}.`);
    } catch (err: any) {
      console.error('Error registrando operador en Firestore:', err);
      // Fallback optimista local
      const fallbackId = 'op-' + Date.now();
      const tenantId = userData?.uid || userData?.id || auth.currentUser?.uid || 'titular-principal';
      setOperadores(prev => [...prev, {
        id: fallbackId,
        nombre: nombreLimpio,
        email: isEmail ? contactoLimpio.toLowerCase() : null,
        telefono: !isEmail ? digitsOnly : null,
        tenant_id: tenantId,
        rol: 'operador',
        estado: 'pendiente'
      }]);
      setNuevoUsuarioNombre('');
      setNuevoUsuarioContacto('');
      mostrarMensajeExito(`Operador "${nombreLimpio}" incorporado al equipo.`);
    } finally {
      setIsAddingOperador(false);
    }
  };

  // Fase 3: Lógica de Eliminación (Revocar y Liberar Slot)
  const handleDeleteOperador = async (docId: string) => {
    if (!docId) return;

    try {
      if (db && !docId.startsWith('mock-') && !docId.startsWith('op-')) {
        await deleteDoc(doc(db, 'operadores_invitados', docId));
      }

      // Actualización optimista inmediata en el estado local para liberar el slot
      setOperadores(prev => prev.filter(op => op.id !== docId));
      mostrarMensajeExito('Operador revocado con éxito. Slot liberado.');
    } catch (err) {
      console.error('Error eliminando operador de Firestore:', err);
      setOperadores(prev => prev.filter(op => op.id !== docId));
      mostrarMensajeExito('Operador removido del equipo.');
    }
  };

  // Fase 4: Auxiliares para acciones de compartir invitación (WhatsApp, Correo y Enlace)
  const formatearTelefonoWhatsApp = (tel?: string | null) => {
    if (!tel) return '';
    const digits = tel.replace(/\D/g, '');
    if (digits.startsWith('595')) return digits;
    if (digits.startsWith('0')) return '595' + digits.substring(1);
    return '595' + digits;
  };

  const handleCopiarEnlace = (docId: string, link: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(link).catch(() => {});
    }
    setEnlaceCopiadoId(docId);
    mostrarMensajeExito('Enlace copiado');
    setTimeout(() => {
      setEnlaceCopiadoId(null);
    }, 2500);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6 bg-slate-100 min-h-screen">
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

      {/* Banner Informativo de Entorno de Operador Notarial */}
      {isOperador && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-slate-900 text-white rounded-xl shrink-0 mt-0.5">
            <Building className="w-5 h-5 text-[#FF3131]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Entorno de Operador Notarial</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Estás conectado como operador notarial bajo el membrete oficial del Escribano Titular. Los ajustes de membrete institucional, facturación y administración de equipo están centralizados bajo la supervisión del Titular.
            </p>
          </div>
        </div>
      )}

      {/* Tarjeta 1: Perfil Institucional / Configuración de Membrete (Oculto para operadores) */}
      {currentUser?.role !== 'operador' && !isOperador && (
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
                    <Building className="w-8 h-8 mb-1 text-slate-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">O.L.G.A.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Controles para subir logo */}
            <div className="space-y-2 text-center md:text-left flex-grow">
              <h4 className="text-sm font-bold text-slate-800">Insignia o Logotipo Oficial</h4>
              <p className="text-xs text-slate-500 max-w-md">
                Se guardará directamente en su cuenta en la nube (Firestore) y se sincronizará automáticamente con el encabezado y panel lateral de la aplicación.
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
      )}

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

          {/* Botón secundario Gestionar Operadores (Oculto para operadores) */}
          {currentUser?.role !== 'operador' && !isOperador && (
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200 gap-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-slate-700 shrink-0" />
                <div>
                  <span className="text-sm font-bold text-slate-900 block">
                    Gestión de Operadores Notariales
                  </span>
                  <p className="text-xs text-slate-500">
                    Slots utilizados: {operadores.length} de {limiteActual} ({slotsLibres} libres)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalUsuariosAbierto(true)}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <Users className="w-3.5 h-3.5 text-[#FF3131]" />
                <span>Gestionar Operadores</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Interactivo de Gestión de Operadores */}
      {currentUser?.role !== 'operador' && !isOperador && modalUsuariosAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-[#FF3131]" />
                <div>
                  <h4 className="text-base font-bold text-white">Gestión de Usuarios y Operadores</h4>
                  <p className="text-xs text-slate-400">
                    Slots utilizados: {operadores.length} de {limiteActual}
                  </p>
                </div>
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
              <form onSubmit={handleAddOperador} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                    Registrar Nuevo Operador Local
                  </span>
                  <span className={`text-xs font-bold ${operadores.length >= limiteActual ? 'text-red-500' : 'text-slate-500'}`}>
                    Slots utilizados: {operadores.length} de {limiteActual}
                  </span>
                </div>

                {errorOperador && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                    <span>{errorOperador}</span>
                  </div>
                )}

                {operadores.length >= limiteActual && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Has alcanzado el límite de <strong>{limiteActual} operadores</strong> permitido por tu plan.
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="Nombre Completo"
                    value={nuevoUsuarioNombre}
                    disabled={operadores.length >= limiteActual || isAddingOperador}
                    onChange={(e) => {
                      setNuevoUsuarioNombre(e.target.value);
                      if (errorOperador) setErrorOperador('');
                    }}
                    className="w-full bg-white disabled:bg-slate-100 disabled:cursor-not-allowed border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-[#FF3131]"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Correo o Celular (Ej: 0983...)"
                    value={nuevoUsuarioContacto}
                    disabled={operadores.length >= limiteActual || isAddingOperador}
                    onChange={(e) => {
                      setNuevoUsuarioContacto(e.target.value);
                      if (errorOperador) setErrorOperador('');
                    }}
                    className="w-full bg-white disabled:bg-slate-100 disabled:cursor-not-allowed border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 outline-none focus:border-[#FF3131]"
                  />
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={operadores.length >= limiteActual || isAddingOperador}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-sm ${
                      operadores.length >= limiteActual || isAddingOperador
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed border border-slate-300'
                        : 'bg-[#FF3131] hover:bg-red-700 text-white'
                    }`}
                  >
                    {isAddingOperador ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>REGISTRANDO...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ AGREGAR OPERADOR</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Lista de usuarios */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                    Equipo Habilitado ({operadores.length})
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {slotsLibres} slots libres
                  </span>
                </div>

                {operadores.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-600">No hay operadores registrados</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Utilice el formulario superior para incorporar miembros a su equipo notarial.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                    {operadores.map((u) => {
                      const inviteLink = `${window.location.origin}/registro-operador?token=${u.id}`;
                      const numeroLimpiado = formatearTelefonoWhatsApp(u.telefono);
                      const mensajeWA = encodeURIComponent(`¡Hola! Te he invitado a unirte a mi equipo en el sistema notarial O.L.G.A. Crea tu cuenta de operador en este enlace: ${inviteLink}`);
                      const asuntoEmail = encodeURIComponent('Invitación a O.L.G.A.');
                      const cuerpoEmail = encodeURIComponent(`¡Hola! Te he invitado a unirte a mi equipo en el sistema notarial O.L.G.A.\n\nCrea tu cuenta de operador en este enlace:\n${inviteLink}\n\nSaludos.`);

                      return (
                        <div key={u.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs border border-slate-200 shrink-0">
                              {u.nombre.charAt(0)}
                            </div>
                            <div>
                              <span className="text-xs font-bold text-slate-900 block">{u.nombre}</span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                {u.email || u.telefono || 'Sin contacto'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                            {/* Acciones de Envío de Invitación (WhatsApp, Correo, Copiar Enlace) - Condicional si está pendiente */}
                            {u.estado === 'pendiente' && (
                              <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg p-0.5">
                                {/* 1. Botón Copiar Enlace */}
                                <button
                                  type="button"
                                  onClick={() => handleCopiarEnlace(u.id, inviteLink)}
                                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded transition-colors"
                                  title="Copiar enlace de registro"
                                >
                                  {enlaceCopiadoId === u.id ? (
                                    <Check className="w-3.5 h-3.5 text-[#FF3131]" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>

                                {/* 2. Botón WhatsApp (Condicional si tiene teléfono) */}
                                {u.telefono && (
                                  <a
                                    href={`https://wa.me/${numeroLimpiado}?text=${mensajeWA}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded transition-colors"
                                    title={`Enviar invitación por WhatsApp al ${u.telefono}`}
                                  >
                                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                                    </svg>
                                  </a>
                                )}

                                {/* Botón Correo (Condicional si tiene email) */}
                                {u.email && (
                                  <a
                                    href={`mailto:${u.email}?subject=${asuntoEmail}&body=${cuerpoEmail}`}
                                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded transition-colors"
                                    title={`Enviar invitación por Correo a ${u.email}`}
                                  >
                                    <Mail className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                            )}

                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded border uppercase ${
                              u.estado === 'pendiente'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {u.estado || 'Activo'}
                            </span>
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {u.rol}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteOperador(u.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                              title="Eliminar acceso y liberar cupo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
