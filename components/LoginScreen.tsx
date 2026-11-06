import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db, emailSignIn, emailSignUp, resetPassword, logout } from '../services/auth';
import { Sparkles, ArrowRight, ShieldCheck, Mail, Key, AlertTriangle, Phone, RotateCcw, CheckCircle2, X } from 'lucide-react';

interface LoginScreenProps {
  onLogin: () => void;
  sessionRevokedAlert?: string | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, sessionRevokedAlert }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'register');
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [trialExpiredToast, setTrialExpiredToast] = useState<string | null>(null);
  
  // Estado para autenticación por Correo
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Estado para autenticación por Teléfono (Phone Auth)
  const [phoneNumber, setPhoneNumber] = useState('+595 ');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  // Limpiar instancia de RecaptchaVerifier al desmontar el componente
  useEffect(() => {
    return () => {
      if ((window as any).recaptchaVerifier) {
        try {
          (window as any).recaptchaVerifier.clear();
        } catch (e) {
          console.warn('Error clearing recaptchaVerifier:', e);
        }
        (window as any).recaptchaVerifier = null;
      }
    };
  }, []);

  // Manejo de input telefónico preconfigurado con +595 (Paraguay)
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    if (!rawVal.startsWith('+595')) {
      const rest = rawVal.replace(/^\+?595\s*/, '');
      setPhoneNumber('+595 ' + rest);
    } else {
      setPhoneNumber(rawVal);
    }
  };

  // Validación Estricta de Período de Prueba (5 días) para cuentas Trial
  const validateTrialExpiration = async (userData: any, userId: string): Promise<boolean> => {
    const userEmail = (userData?.email || auth.currentUser?.email || '').toLowerCase().trim();
    const userRole = String(userData?.role || userData?.rol || '').toLowerCase().trim();
    const isApprovedAccount = String(userData?.estadoPlataforma || '').toUpperCase() === 'APROBADO' || String(userData?.estadoPago || '').toUpperCase() === 'APROBADO';
    const isGavanah = userEmail.includes('gavanah') || String(userData?.nombre || '').toLowerCase().includes('gavanah');
    if (userEmail === 'jotamolinas@gmail.com' || userRole === 'admin' || userRole === 'superadmin' || userRole === 'operador' || isApprovedAccount || isGavanah) {
      return false;
    }

    const plan = String(userData?.planActual || userData?.plan || '').toLowerCase().trim();
    if (plan !== 'trial') {
      return false;
    }

    const now = new Date();
    let expDate: Date | null = null;

    // 1. Obtener fecha_expiracion si existe
    const rawExp = userData?.fecha_expiracion;
    if (rawExp) {
      if (typeof rawExp.toDate === 'function') {
        expDate = rawExp.toDate();
      } else if (typeof rawExp.toMillis === 'function') {
        expDate = new Date(rawExp.toMillis());
      } else if (typeof rawExp.seconds === 'number') {
        expDate = new Date(rawExp.seconds * 1000);
      } else {
        expDate = new Date(rawExp);
      }
    }

    // 2. Fallback de Seguridad:
    // Si un usuario antiguo en trial no tiene el campo fecha_expiracion, calcúlalo dinámicamente basándote en su fecha_creacion + 5 días para evaluarlo en el momento.
    if (!expDate || isNaN(expDate.getTime())) {
      const rawCreation = userData?.fecha_creacion || userData?.fechaCreacion || userData?.created_at || userData?.createdAt;
      if (rawCreation) {
        let creationDate: Date | null = null;
        if (typeof rawCreation.toDate === 'function') {
          creationDate = rawCreation.toDate();
        } else if (typeof rawCreation.toMillis === 'function') {
          creationDate = new Date(rawCreation.toMillis());
        } else if (typeof rawCreation.seconds === 'number') {
          creationDate = new Date(rawCreation.seconds * 1000);
        } else {
          creationDate = new Date(rawCreation);
        }
        if (creationDate && !isNaN(creationDate.getTime())) {
          expDate = new Date(creationDate.getTime() + 5 * 24 * 60 * 60 * 1000);
        }
      }
    }

    const yaExpiradoPorFecha = expDate ? now.getTime() > expDate.getTime() : false;
    const yaExpiradoPorEstado = userData?.estado_cuenta === 'expirada';

    if (yaExpiradoPorFecha || yaExpiradoPorEstado) {
      console.warn(`[Trial Auth] Usuario ${userId} con período trial de 5 días expirado.`);

      // Actualizar automáticamente su campo estado_cuenta a "expirada" en Firestore
      try {
        await setDoc(doc(db, 'users', userId), { estado_cuenta: 'expirada' }, { merge: true });
      } catch (err) {
        console.error('Error al actualizar estado_cuenta a expirada en Firestore:', err);
      }

      // Cerrar la sesión (signOut)
      try {
        await logout();
      } catch {
        await auth.signOut().catch(console.error);
      }

      // Mostrar alerta o Toast rojo
      const mensajeExpirado = 'Tu período de prueba de 5 días ha finalizado. Por favor, contacta a soporte para activar tu suscripción.';
      setTrialExpiredToast(mensajeExpirado);
      setError(mensajeExpirado);

      return true; // Expirado: DETÉN la redirección
    }

    return false;
  };

  // Submit autenticación por Correo
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();
    if (!cleanEmail || !cleanPassword) return;
    
    try {
      setLoading(true);
      setError('');
      
      setTrialExpiredToast(null);
      let authUser: any = null;
      if (isLogin) {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('olga_auth_flow', 'login');
        }
        const res = await emailSignIn(cleanEmail, cleanPassword);
        authUser = res?.user || auth.currentUser;
      } else {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('olga_auth_flow', 'register');
        }
        const res = await emailSignUp(cleanEmail, cleanPassword);
        authUser = res?.user || auth.currentUser;
      }

      if (authUser) {
        const userRef = doc(db, 'users', authUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const isExpired = await validateTrialExpiration(userSnap.data(), authUser.uid);
          if (isExpired) {
            return; // DETÉN la redirección
          }
        }
      }

      onLogin();
      if (cleanEmail === 'jotamolinas@gmail.com') {
        navigate('/consola/admin');
      } else {
        navigate('/consola');
      }
    } catch (err: any) {
      console.error('Error email auth:', err);
      let errorMessage = err.message || 'Error de autenticación';
      if (err.code === 'auth/invalid-credential' || err.message?.includes('invalid-credential')) {
        errorMessage = isLogin 
          ? 'Credenciales inválidas. Verifica tu correo y contraseña. Si aún no te has registrado, haz clic en "Registrarse".'
          : 'No se pudo crear la cuenta con estas credenciales. Si ya existe, por favor inicia sesión.';
      } else if (err.code === 'auth/user-not-found') {
        errorMessage = 'No se encontró una cuenta con este correo. Por favor regístrate primero.';
      } else if (err.code === 'auth/wrong-password') {
        errorMessage = 'Contraseña incorrecta. Puedes restablecerla abajo.';
      } else if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'Este correo ya está registrado. Por favor inicia sesión.';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'Demasiados intentos fallidos. Por seguridad, el acceso temporal está bloqueado. Por favor, espera unos minutos o usa Recuperar Contraseña.';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Restablecer contraseña
  const handleResetPassword = async () => {
    if (!email) {
      setSuccessMessage('');
      setError('Por favor, ingresa tu correo electrónico para restablecer la contraseña.');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      setSuccessMessage('');
      await resetPassword(email);
      setSuccessMessage('Te hemos enviado un correo para restablecer tu contraseña. Revisa tu bandeja de entrada o spam.');
    } catch (err: any) {
      console.error('Error reset password:', err);
      setSuccessMessage('');
      setError(err.message || 'Error al enviar el correo de restablecimiento.');
    } finally {
      setLoading(false);
    }
  };

  // Configuración de RecaptchaVerifier invisible
  const setupRecaptcha = () => {
    if ((window as any).recaptchaVerifier) {
      try {
        (window as any).recaptchaVerifier.clear();
      } catch (e) {
        console.warn('Error clearing recaptchaVerifier:', e);
      }
      (window as any).recaptchaVerifier = null;
    }

    const appVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA resuelto automáticamente
      },
      'expired-callback': () => {
        setError('La verificación reCAPTCHA ha expirado. Por favor, intenta de nuevo.');
      }
    });

    (window as any).recaptchaVerifier = appVerifier;
    return appVerifier;
  };

  // Enviar código SMS a teléfono
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phoneNumber.replace(/[\s-]/g, '').trim();
    if (!cleanPhone || cleanPhone === '+595' || cleanPhone.length < 9) {
      setError('Número incorrecto. Ingresa un número telefónico válido (ej. +595 981 123456).');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const appVerifier = setupRecaptcha();
      const result = await signInWithPhoneNumber(auth, cleanPhone, appVerifier);
      setConfirmationResult(result);
      setOtpSent(true);
    } catch (err: any) {
      console.error('Error signInWithPhoneNumber:', err);
      let msg = 'Error al enviar el código SMS.';
      if (err.code === 'auth/invalid-phone-number') {
        msg = 'Número incorrecto o formato internacional inválido.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Demasiados intentos. Por favor, espera unos minutos antes de reintentar.';
      } else if (err.code === 'auth/quota-exceeded') {
        msg = 'Cuota de SMS superada. Intenta más tarde.';
      } else if (err.code === 'auth/captcha-check-failed') {
        msg = 'Falló la verificación de seguridad reCAPTCHA. Intenta nuevamente.';
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Confirmar código OTP recibido
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = otpCode.replace(/\s+/g, '').trim();
    if (!cleanCode || cleanCode.length < 6) {
      setError('Código inválido. Ingresa los 6 dígitos recibidos por SMS.');
      return;
    }

    if (!confirmationResult) {
      setError('No hay ninguna verificación activa. Por favor, solicita un nuevo código.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('olga_auth_flow', isLogin ? 'login' : 'register');
      }

      setTrialExpiredToast(null);
      const res = await confirmationResult.confirm(cleanCode);
      const authUser = res?.user || auth.currentUser;
      if (authUser) {
        const userRef = doc(db, 'users', authUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const isExpired = await validateTrialExpiration(userSnap.data(), authUser.uid);
          if (isExpired) {
            return; // DETÉN la redirección
          }
        }
      }
      onLogin();
      if (auth.currentUser?.email === 'jotamolinas@gmail.com') {
        navigate('/consola/admin');
      } else {
        navigate('/consola');
      }
    } catch (err: any) {
      console.error('Error confirmando OTP:', err);
      let msg = 'Código inválido o expirado. Verifica el mensaje e intenta nuevamente.';
      if (err.code === 'auth/invalid-verification-code') {
        msg = 'Código inválido. Revisa los 6 dígitos que te llegaron por SMS.';
      } else if (err.code === 'auth/code-expired') {
        msg = 'El código ha expirado. Solicita un nuevo SMS.';
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Inicio de sesión con Google
  const handleGoogleSignIn = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      setLoading(true);
      setError('');
      setSuccessMessage('');

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('olga_auth_flow', 'google');
        }

        // Consultar o registrar usuario en Firestore para identificar rol
        const userRef = doc(db, 'users', result.user.uid);
        const userSnap = await getDoc(userRef);

        let userRole = 'titular';
        let userData: any = null;
        if (!userSnap.exists()) {
          const now = new Date();
          const fechaExpiracion = Timestamp.fromDate(new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000));
          const newUserDoc = {
            uid: result.user.uid,
            email: result.user.email || '',
            nombre: result.user.displayName || '',
            fecha_creacion: serverTimestamp(),
            fecha_expiracion: fechaExpiracion,
            planActual: 'trial',
            role: 'titular',
            rol: 'titular',
            estado_cuenta: 'activa',
            consultasUsadas: 0,
            escritosUsados: 0,
            usoIA: 0
          };
          await setDoc(userRef, newUserDoc);
          userData = newUserDoc;
        } else {
          userData = userSnap.data();
          userRole = userData?.role || userData?.rol || 'titular';
        }

        const user = result.user;

        // Forzar Redirección de Super Admin (Fallback Seguro):
        if (user.email === 'jotamolinas@gmail.com') {
          onLogin();
          navigate('/consola/admin');
          return;
        }

        // Redirección si se detecta rol de superadmin
        const normalizedRole = String(userRole || '').toUpperCase();
        if (normalizedRole === 'SUPERADMIN' || normalizedRole === 'ADMIN') {
          onLogin();
          navigate('/consola/admin');
          return;
        }

        // Validación Estricta de Período de Prueba antes de redirección a /consola
        const isExpired = await validateTrialExpiration(userData, user.uid);
        if (isExpired) {
          return; // DETÉN la redirección
        }

        onLogin();
        // Redirección estricta para usuarios normales
        navigate('/consola');
      }
    } catch (err: any) {
      const errCode = err?.code;
      if (errCode === 'auth/popup-closed-by-user' || errCode === 'auth/cancelled-popup-request') {
        // Interrupción voluntaria del popup por parte del usuario o cierre de ventana.
        // No constituye un error de sistema ni debe registrarse con console.error.
        console.warn('Inicio de sesión con Google cancelado o ventana cerrada por el usuario.');
        setError('');
      } else if (errCode === 'auth/popup-blocked') {
        console.warn('Ventana emergente de Google bloqueada por el navegador.');
        setError('La ventana emergente de Google fue bloqueada por el navegador. Por favor, habilita popups para continuar.');
      } else if (errCode === 'auth/unauthorized-domain') {
        console.error('Dominio no autorizado en Firebase Auth:', err);
        setError('El dominio actual no está autorizado en Firebase Authentication. Agrégalo en la consola de Firebase.');
      } else {
        console.error('Error Google sign in:', err);
        setError(err?.message || 'Error al iniciar sesión con Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4 font-sans">
      <div className="bg-[#121214] max-w-md w-full box-border rounded-[2rem] p-8 md:p-10 shadow-2xl flex flex-col items-center text-center border border-white/10 relative max-h-[95vh] overflow-y-auto overflow-x-hidden">
        {/* Toast / Alerta Roja Flotante de Período de Prueba Expirado */}
        {trialExpiredToast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] max-w-lg w-[92%] animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="bg-red-950/95 border-2 border-[#FF3131] text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 text-[#FF3131] flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-red-100 leading-snug">{trialExpiredToast}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setTrialExpiredToast(null)}
                className="text-red-300 hover:text-white p-1 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Glow decorativo sutil */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Contenedor DOM para reCAPTCHA invisible de Firebase Phone Auth */}
        <div id="recaptcha-container"></div>

        {/* Icono O.L.G.A. */}
        <div className="w-20 h-20 bg-slate-800/80 rounded-3xl flex items-center justify-center mb-6 rotate-3 shadow-inner relative z-10 border border-white/10 backdrop-blur-sm">
          <Sparkles className="w-10 h-10 text-[#FF3131] drop-shadow-md" />
        </div>
        
        <h1 className="text-3xl font-black text-white tracking-tight font-serif mb-2 relative z-10">O.L.G.A.</h1>
        <p className="text-slate-400 font-medium mb-6 text-sm relative z-10 tracking-wide">
          {isLogin ? 'Acceso Seguro al Sistema' : 'Registro de Nueva Cuenta'}
        </p>

        {/* Selector de Modo: Iniciar Sesión o Registrarse */}
        <div className="w-full box-border grid grid-cols-2 p-1 bg-slate-900/80 rounded-xl mb-4 border border-slate-800 relative z-10 shadow-inner">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(''); setSuccessMessage(''); }}
            className={`py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              isLogin 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Iniciar Sesión</span>
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(''); setSuccessMessage(''); }}
            className={`py-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              !isLogin 
                ? 'bg-[#FF3131] text-white shadow-md' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Registrarse</span>
          </button>
        </div>

        {/* Toggle Pestañas: Correo electrónico vs Teléfono */}
        <div className="w-full box-border grid grid-cols-2 p-1 bg-slate-900/60 rounded-xl mb-6 border border-slate-800/80 relative z-10">
          <button
            type="button"
            onClick={() => { setAuthMethod('email'); setError(''); setSuccessMessage(''); setOtpSent(false); }}
            className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
              authMethod === 'email'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Correo electrónico</span>
          </button>
          <button
            type="button"
            onClick={() => { setAuthMethod('phone'); setError(''); setSuccessMessage(''); }}
            className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
              authMethod === 'phone'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Teléfono</span>
          </button>
        </div>

        {/* Alerta de sesión revocada */}
        {sessionRevokedAlert && (
          <div className="w-full box-border bg-red-950/80 text-red-200 text-xs font-bold p-4 rounded-xl mb-6 border border-red-500/70 relative z-10 flex items-center gap-3 text-left shadow-xl animate-fade-in">
            <AlertTriangle className="w-5 h-5 text-[#FF3131] shrink-0" />
            <div className="flex-1">
              <span className="block font-black text-red-100">{sessionRevokedAlert}</span>
              <span className="block text-[10px] text-red-300 font-normal mt-0.5">
                Por motivos de seguridad, solo se permite una sesión activa simultánea por cuenta.
              </span>
            </div>
          </div>
        )}

        {/* Mensaje de confirmación de éxito */}
        {successMessage && (
          <div className="w-full box-border bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 text-xs font-semibold p-4 rounded-xl mb-6 relative z-10 text-left flex items-start gap-2.5 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Mensaje de error o confirmación */}
        {error && (
          error.includes('Te hemos enviado un correo') ? (
            <div className="w-full box-border bg-emerald-500/10 border border-emerald-500/50 text-emerald-400 text-xs font-semibold p-4 rounded-xl mb-6 relative z-10 text-left flex items-start gap-2.5 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="w-full box-border bg-red-950/80 text-red-200 text-xs font-bold p-4 rounded-xl mb-6 border border-red-500/70 relative z-10 flex items-center gap-3 text-left shadow-xl animate-fade-in">
              <AlertTriangle className="w-5 h-5 text-[#FF3131] shrink-0" />
              <div className="flex-1">
                <span>{error}</span>
              </div>
            </div>
          )
        )}

        {/* Vista A: Autenticación por Correo Electrónico */}
        {authMethod === 'email' && (
          <form onSubmit={handleEmailSubmit} className="w-full box-border relative z-10 flex flex-col gap-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo electrónico"
                className="w-full box-border bg-slate-900/50 border border-slate-700 text-white font-medium py-4 pl-12 pr-4 rounded-xl outline-none focus:border-[#FF3131] focus:ring-1 focus:ring-[#FF3131] transition-all placeholder:text-slate-500"
                required
              />
            </div>
            
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                className="w-full box-border bg-slate-900/50 border border-slate-700 text-white font-medium py-4 pl-12 pr-4 rounded-xl outline-none focus:border-[#FF3131] focus:ring-1 focus:ring-[#FF3131] transition-all placeholder:text-slate-500"
                required
                minLength={6}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full box-border bg-[#FF3131] hover:bg-red-600 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed tracking-wide mt-2 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isLogin ? 'Iniciar Sesión' : 'Registrarse'}</span>
                  <ArrowRight className="w-5 h-5 opacity-90" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Vista B: Autenticación por Teléfono (Phone Auth) */}
        {authMethod === 'phone' && (
          <>
            {!otpSent ? (
              /* Paso 1: Ingreso de Número Telefónico */
              <form onSubmit={handleSendOtp} className="w-full box-border relative z-10 flex flex-col gap-4">
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="tel"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    placeholder="+595 981 123456"
                    className="w-full box-border bg-slate-900/50 border border-slate-700 text-white font-mono font-medium py-4 pl-12 pr-4 rounded-xl outline-none focus:border-[#FF3131] focus:ring-1 focus:ring-[#FF3131] transition-all placeholder:text-slate-500 tracking-wide"
                    required
                  />
                </div>
                
                <p className="text-[11px] text-slate-400 text-left -mt-2">
                  Te enviaremos un código SMS de 6 dígitos para verificar tu cuenta en O.L.G.A.
                </p>
                
                <button
                  type="submit"
                  disabled={loading || phoneNumber.replace(/[\s-]/g, '').length < 9}
                  className="w-full box-border bg-[#FF3131] hover:bg-red-600 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed tracking-wide mt-2 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Enviar Código SMS</span>
                      <ArrowRight className="w-5 h-5 opacity-90" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Paso 2: Verificación de Código OTP */
              <form onSubmit={handleVerifyOtp} className="w-full box-border relative z-10 flex flex-col gap-4">
                <div className="p-3 bg-slate-900/80 border border-slate-700/80 rounded-xl text-left flex items-center justify-between">
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Código enviado a</span>
                    <span className="text-xs font-mono font-bold text-white truncate block">{phoneNumber}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setOtpSent(false); setOtpCode(''); setError(''); }}
                    className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Cambiar número</span>
                  </button>
                </div>

                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="Código de 6 dígitos"
                    className="w-full box-border bg-slate-900/50 border border-slate-700 text-white font-mono font-bold text-lg py-4 pl-12 pr-4 rounded-xl outline-none focus:border-[#FF3131] focus:ring-1 focus:ring-[#FF3131] transition-all placeholder:text-slate-500 tracking-widest text-center"
                    required
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length < 6}
                  className="w-full box-border bg-[#FF3131] hover:bg-red-600 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed tracking-wide mt-2 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Verificar Código</span>
                      <ArrowRight className="w-5 h-5 opacity-90" />
                    </>
                  )}
                </button>
              </form>
            )}
          </>
        )}

        {/* Divisor Visual 'O' */}
        <div className="w-full flex items-center my-4 relative z-10">
          <div className="flex-grow border-t border-slate-700/60"></div>
          <span className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-widest">O</span>
          <div className="flex-grow border-t border-slate-700/60"></div>
        </div>

        {/* Botón de Google de ancho completo */}
        <button
          type="button"
          onClick={(e) => handleGoogleSignIn(e)}
          disabled={loading}
          className="w-full bg-white/5 border border-white/10 text-white hover:bg-white/10 h-10 rounded-lg flex items-center justify-center gap-3 transition-colors cursor-pointer text-xs font-semibold relative z-10 disabled:opacity-50"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continuar con Google</span>
        </button>

        {/* Links de pie de formulario */}
        <div className="flex flex-col gap-3 mt-6 w-full box-border relative z-10">
          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            {isLogin ? '¿No tienes cuenta? Regístrate aquí' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>

          {isLogin && authMethod === 'email' && (
            <button
              type="button"
              onClick={handleResetPassword}
              disabled={loading}
              className="text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer"
            >
              ¿Olvidaste tu contraseña? Restablécela aquí
            </button>
          )}
        </div>

        <div className="w-full box-border flex items-center justify-center gap-2 mt-8 text-[11px] font-bold text-slate-500 relative z-10 uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          <span>Acceso Protegido y Cifrado</span>
        </div>
      </div>
    </div>
  );
};
