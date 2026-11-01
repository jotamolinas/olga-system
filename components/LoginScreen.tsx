import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { auth, emailSignIn, emailSignUp, resetPassword } from '../services/auth';
import { Sparkles, ArrowRight, ShieldCheck, Mail, Key, AlertTriangle, Phone, RotateCcw, CheckCircle2 } from 'lucide-react';

interface LoginScreenProps {
  onLogin: () => void;
  sessionRevokedAlert?: string | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, sessionRevokedAlert }) => {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'register');
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
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

  // Submit autenticación por Correo
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();
    if (!cleanEmail || !cleanPassword) return;
    
    try {
      setLoading(true);
      setError('');
      
      if (isLogin) {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('olga_auth_flow', 'login');
        }
        await emailSignIn(cleanEmail, cleanPassword);
      } else {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('olga_auth_flow', 'register');
        }
        await emailSignUp(cleanEmail, cleanPassword);
      }
      onLogin();
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
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'La contraseña debe tener al menos 6 caracteres.';
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

      await confirmationResult.confirm(cleanCode);
      onLogin();
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

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4 font-sans">
      <div className="bg-[#121214] max-w-md w-full box-border rounded-[2rem] p-8 md:p-10 shadow-2xl flex flex-col items-center text-center border border-white/10 relative max-h-[95vh] overflow-y-auto overflow-x-hidden">
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
            <div className="w-full box-border bg-red-950/40 text-red-300 text-xs font-semibold p-4 rounded-xl mb-6 border border-red-800/50 relative z-10 text-left">
              {error}
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
