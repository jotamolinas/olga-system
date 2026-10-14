import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../services/auth';
import { 
  Lock, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Eye, 
  EyeOff, 
  ArrowRight,
  Phone,
  ShieldX
} from 'lucide-react';

interface InvitacionData {
  id: string;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
  rol: string;
  estado: string;
  tenant_id: string;
}

export const RegistroOperador: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [cargandoInvitacion, setCargandoInvitacion] = useState(true);
  const [errorInvitacion, setErrorInvitacion] = useState<string | null>(null);
  const [invitacion, setInvitacion] = useState<InvitacionData | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarConfirmPassword, setMostrarConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registroExitoso, setRegistroExitoso] = useState(false);

  // 1. Validación de la Invitación (Firebase Firestore)
  useEffect(() => {
    let isMounted = true;

    const validarTokenInvitacion = async () => {
      if (!token) {
        if (isMounted) {
          setErrorInvitacion('Token de invitación no proporcionado en la URL.');
          setCargandoInvitacion(false);
        }
        return;
      }

      try {
        const docRef = doc(db, 'operadores_invitados', token);
        const docSnap = await getDoc(docRef);

        if (!isMounted) return;

        if (!docSnap.exists()) {
          setErrorInvitacion('Invitación inválida, expirada o ya utilizada.');
          setCargandoInvitacion(false);
          return;
        }

        const data = docSnap.data();
        if (data.estado !== 'pendiente') {
          setErrorInvitacion('Invitación inválida, expirada o ya utilizada.');
          setCargandoInvitacion(false);
          return;
        }

        const datosInvitacion: InvitacionData = {
          id: docSnap.id,
          nombre: data.nombre || 'Operador Notarial',
          email: data.email || null,
          telefono: data.telefono || null,
          rol: data.rol || 'operador',
          estado: data.estado,
          tenant_id: data.tenant_id || ''
        };

        setInvitacion(datosInvitacion);
        if (datosInvitacion.email) {
          setEmail(datosInvitacion.email);
        }
        setCargandoInvitacion(false);
      } catch (err: any) {
        console.error('Error al validar la invitación en Firestore:', err);
        if (isMounted) {
          setErrorInvitacion('No se pudo validar la invitación. Por favor verifique su conexión o contacte al titular.');
          setCargandoInvitacion(false);
        }
      }
    };

    validarTokenInvitacion();

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Manejo del formulario de creación de credenciales
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const emailLimpio = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailLimpio || !emailRegex.test(emailLimpio)) {
      setFormError('Por favor ingrese un correo electrónico válido para su cuenta.');
      return;
    }

    if (password.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres por seguridad.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Las contraseñas no coinciden. Por favor verifíquelas.');
      return;
    }

    if (!invitacion || !token) {
      setFormError('No se encontró una invitación activa para completar este registro.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Crear usuario en Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, emailLimpio, password);
      const user = userCredential.user;

      // 2. Actualizar estado de la invitación en operadores_invitados
      const inviteRef = doc(db, 'operadores_invitados', token);
      await updateDoc(inviteRef, {
        estado: 'activo',
        uid: user.uid,
        email: emailLimpio,
        fecha_registro: serverTimestamp()
      }).catch(err => console.warn('Advertencia actualizando invitación:', err));

      const localSessionId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('appSessionId', localSessionId);

      // 3. Crear el perfil del usuario en la colección users
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        email: emailLimpio,
        nombre: invitacion.nombre,
        rol: 'operador',
        role: 'operador',
        tenant_id: invitacion.tenant_id,
        tenantId: invitacion.tenant_id,
        planActual: 'Operador Notarial',
        estado: 'activo',
        perfilCompletado: true,
        activeSessionId: localSessionId,
        telefono: invitacion.telefono || null,
        fecha_creacion: serverTimestamp(),
        diasRestantes: 365,
        invitacionId: token
      }, { merge: true });

      setRegistroExitoso(true);
    } catch (err: any) {
      console.error('Error al registrar cuenta de operador:', err);
      if (err.code === 'auth/email-already-in-use') {
        setFormError('Este correo electrónico ya se encuentra registrado. Ingrese con sus credenciales o use otro correo.');
      } else if (err.code === 'auth/weak-password') {
        setFormError('La contraseña seleccionada es muy débil. Elija una más segura.');
      } else {
        setFormError(err.message || 'Error al crear la cuenta. Por favor intente nuevamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between py-8 px-4 sm:px-6">
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-full max-w-md">
          {/* Tarjeta Principal Estilo Google Workspace */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 sm:p-8">
            {/* Logo Oficial Central */}
            <img 
              src="/logo-olga.png" 
              alt="O.L.G.A. Notarial" 
              className="h-16 w-auto mx-auto mb-6 object-contain" 
            />

            {/* Caso 1: Cargando Invitación */}
            {cargandoInvitacion && (
              <div className="text-center py-6 space-y-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-800">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-900" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Validando invitación...</h2>
                  <p className="text-xs text-slate-600 mt-1">
                    Verificando credenciales autorizadas por el Escribano Titular.
                  </p>
                </div>
              </div>
            )}

            {/* Caso 2: Error o Invitación Inválida */}
            {!cargandoInvitacion && errorInvitacion && (
              <div className="text-center space-y-5 py-2">
                <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mx-auto text-red-600">
                  <ShieldX className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Acceso no disponible</h2>
                  <p className="text-xs text-slate-600 mt-1">
                    Verificación de invitación fallida
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs font-medium leading-relaxed">
                  {errorInvitacion}
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Si cree que esto es un error, por favor contacte al Escribano Titular para solicitar un nuevo enlace de registro.
                </p>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium transition-colors shadow-sm"
                  >
                    Volver al Inicio
                  </button>
                </div>
              </div>
            )}

            {/* Caso 3: Registro Exitoso */}
            {!cargandoInvitacion && !errorInvitacion && registroExitoso && (
              <div className="text-center space-y-5 py-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-900">
                  <CheckCircle2 className="w-6 h-6 text-slate-900" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">¡Cuenta activada con éxito!</h2>
                  <p className="text-xs text-slate-600 mt-1">
                    Bienvenido al equipo de trabajo notarial
                  </p>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-left">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Operador Vinculado
                  </div>
                  <div className="text-sm font-bold text-slate-900">{invitacion?.nombre}</div>
                  <div className="text-xs text-slate-600 font-mono">{email}</div>
                  <div className="pt-2 text-[11px] text-slate-500">
                    Rol: <span className="font-semibold text-slate-800">Operador Notarial</span> • Escribanía Titular
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Su cuenta ya está habilitada para ingresar a la plataforma y redactar conforme a las directivas del Escribano Titular.
                </p>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/consola')}
                    className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <span>Ingresar a la Consola Notarial</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Caso 4: Formulario de Registro de Contraseña */}
            {!cargandoInvitacion && !errorInvitacion && !registroExitoso && invitacion && (
              <div>
                {/* Encabezado del Formulario */}
                <div className="text-center mb-6">
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                    Registro de Operador Notarial
                  </h1>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Has sido invitado a unirte al sistema notarial por el Escribano Titular.
                  </p>
                </div>

                {/* Resumen del Operador Invitado */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 mb-5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Nombre:</span>
                    <span className="font-semibold text-slate-900">{invitacion.nombre}</span>
                  </div>
                  {invitacion.email ? (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Correo asignado:</span>
                      <span className="font-mono font-medium text-slate-800">{invitacion.email}</span>
                    </div>
                  ) : null}
                  {invitacion.telefono ? (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Teléfono:</span>
                      <span className="font-mono font-medium text-slate-800 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {invitacion.telefono}
                      </span>
                    </div>
                  ) : null}
                </div>

                {/* Formulario */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  {formError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Campo Correo Electrónico */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Correo Electrónico
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        disabled={!!invitacion.email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nombre@notaria.com"
                        className="w-full bg-white disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  {/* Campo Contraseña */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Contraseña de Acceso
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={mostrarPassword ? 'text' : 'password'}
                        required
                        value={password}
                        minLength={6}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-10 py-2.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarPassword(!mostrarPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {mostrarPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Campo Confirmar Contraseña */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Confirmar Contraseña
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={mostrarConfirmPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        minLength={6}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repita la contraseña"
                        className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-10 py-2.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarConfirmPassword(!mostrarConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {mostrarConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-colors shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Creando cuenta...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Completar Registro</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Aviso Institucional Notarial adaptado al fondo claro */}
          <p className="mt-6 text-center text-xs text-slate-500 leading-relaxed px-2">
            Herramienta de redacción y asistencia. Todo documento que genera la plataforma es un borrador avanzado que requiere la revisión, autorización y sello del Escribano Titular para poseer validez legal administrativa.
          </p>
        </div>
      </div>

      {/* Pie de Página Minimalista */}
      <footer className="text-center text-xs text-slate-400 mt-8">
        © {new Date().getFullYear()} O.L.G.A. Notarial • Sistema de Gestión y Emisión Documental
      </footer>
    </div>
  );
};
