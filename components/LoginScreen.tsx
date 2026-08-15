import React, { useState } from 'react';
import { emailSignIn, emailSignUp, resetPassword } from '../services/auth';
import { Sparkles, ArrowRight, ShieldCheck, Mail, Key } from 'lucide-react';

interface LoginScreenProps {
  onLogin: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    try {
      setLoading(true);
      setError('');
      
      if (isLogin) {
        await emailSignIn(email, password);
      } else {
        await emailSignUp(email, password);
      }
      onLogin();
    } catch (err: any) {
      console.error(err);
      let errorMessage = err.message || 'Error de autenticación';
      if (err.code === 'auth/invalid-credential') {
        errorMessage = 'Credenciales inválidas. Verifica tu correo y contraseña.';
      } else if (err.code === 'auth/user-not-found') {
        errorMessage = 'No se encontró una cuenta con este correo.';
      } else if (err.code === 'auth/wrong-password') {
        errorMessage = 'Contraseña incorrecta.';
      } else if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'Este correo ya está registrado.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'La contraseña debe tener al menos 6 caracteres.';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Por favor, ingresa tu correo electrónico arriba para restablecer la contraseña.');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      await resetPassword(email);
      setError('Te hemos enviado un correo para restablecer tu contraseña. Revisa tu bandeja de entrada o spam.');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al enviar el correo de restablecimiento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
      <div className="bg-slate-800 max-w-md w-full box-border rounded-[2rem] p-8 md:p-10 shadow-2xl shadow-blue-900/10 flex flex-col items-center text-center border border-slate-700 relative max-h-[95vh] overflow-y-auto overflow-x-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-slate-700/30 rounded-full blur-3xl pointer-events-none"></div>

        <div className="w-20 h-20 bg-slate-700/50 rounded-3xl flex items-center justify-center mb-6 rotate-3 shadow-inner relative z-10 border border-slate-600/50 backdrop-blur-sm">
          <Sparkles className="w-10 h-10 text-[#FF3131] drop-shadow-md" />
        </div>
        
        <h1 className="text-3xl font-black text-white tracking-tight font-serif mb-2 relative z-10">O.L.G.A.</h1>
        <p className="text-slate-400 font-medium mb-8 text-sm relative z-10 tracking-wide">
          {isLogin ? 'Acceso Seguro al Sistema' : 'Registro de Nueva Cuenta'}
        </p>
        
        {error && (
          <div className="w-full box-border bg-slate-900/50 text-slate-300 text-xs font-bold p-4 rounded-xl mb-6 border border-slate-700 relative z-10">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full box-border relative z-10 flex flex-col gap-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Correo electrónico"
              className="w-full box-border bg-slate-900/50 border border-slate-600 text-white font-medium py-4 pl-12 pr-4 rounded-xl outline-none focus:border-[#FF3131] focus:ring-1 focus:ring-[#FF3131] transition-all placeholder:text-slate-500"
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
              className="w-full box-border bg-slate-900/50 border border-slate-600 text-white font-medium py-4 pl-12 pr-4 rounded-xl outline-none focus:border-[#FF3131] focus:ring-1 focus:ring-[#FF3131] transition-all placeholder:text-slate-500"
              required
              minLength={6}
            />
          </div>
          
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full box-border bg-[#FF3131] hover:bg-red-600 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed tracking-wide mt-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {isLogin ? 'Iniciar Sesión' : 'Registrarse'}
                <ArrowRight className="w-5 h-5 opacity-90" />
              </>
            )}
          </button>
        </form>

        <div className="flex flex-col gap-3 mt-6 w-full box-border relative z-10">
          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            {isLogin ? '¿No tienes cuenta? Regístrate aquí' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>

          {isLogin && (
            <button
              type="button"
              onClick={handleResetPassword}
              disabled={loading}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
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
