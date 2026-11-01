import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { confirmPasswordReset, applyActionCode, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../services/auth';
import { CheckCircle2, AlertCircle, Lock, ArrowLeft, Loader2 } from 'lucide-react';

export const AuthActionHandler: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const mode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');

  // Estados para resetPassword
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [targetEmail, setTargetEmail] = useState<string | null>(null);

  // Estados de control
  const [loading, setLoading] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

  const handleFirebaseError = (err: any) => {
    let msg = 'Ocurrió un error al procesar la solicitud.';
    if (err.code === 'auth/expired-action-code') {
      msg = 'El enlace ha expirado. Por favor, solicita uno nuevo desde la pantalla de login.';
    } else if (err.code === 'auth/invalid-action-code') {
      msg = 'El enlace no es válido o ya fue utilizado anteriormente.';
    } else if (err.code === 'auth/user-disabled') {
      msg = 'La cuenta de usuario asociada ha sido inhabilitada.';
    } else if (err.code === 'auth/user-not-found') {
      msg = 'No se encontró la cuenta de usuario asociada a este enlace.';
    } else if (err.code === 'auth/weak-password') {
      msg = 'La contraseña debe contener al menos 6 caracteres.';
    } else if (err.message) {
      msg = err.message;
    }
    setError(msg);
  };

  // Captura de parámetros y ejecución de acciones
  useEffect(() => {
    if (!oobCode) {
      setError('El enlace de acción no es válido o carece del código de verificación.');
      return;
    }

    if (mode === 'resetPassword') {
      setVerifyingCode(true);
      verifyPasswordResetCode(auth, oobCode)
        .then((email) => {
          setTargetEmail(email);
          setError('');
        })
        .catch((err: any) => {
          console.error('Error verificando oobCode:', err);
          handleFirebaseError(err);
        })
        .finally(() => {
          setVerifyingCode(false);
        });
    } else if (mode === 'verifyEmail') {
      setLoading(true);
      applyActionCode(auth, oobCode)
        .then(() => {
          setSuccessMessage('Correo verificado exitosamente.');
          setError('');
        })
        .catch((err: any) => {
          console.error('Error aplicando verifyEmail:', err);
          handleFirebaseError(err);
        })
        .finally(() => {
          setLoading(false);
        });
    } else if (mode === 'recoverEmail') {
      setSuccessMessage('Restablecimiento de correo procesado.');
    } else {
      setError('Acción de autenticación no reconocida.');
    }
  }, [mode, oobCode]);

  // Manejador del formulario de restablecimiento
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode) {
      setError('Código de restablecimiento no disponible.');
      return;
    }

    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden. Por favor, revísalas.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await confirmPasswordReset(auth, oobCode, newPassword);
      setSuccessMessage('Tu contraseña ha sido restablecida exitosamente.');
    } catch (err: any) {
      console.error('Error restableciendo contraseña:', err);
      handleFirebaseError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#09090b] p-4">
      <div className="w-full max-w-md bg-[#121214] border border-white/5 rounded-2xl p-8 shadow-2xl">
        {/* Logo de O.L.G.A. en la parte superior central */}
        <div className="flex flex-col items-center justify-center mb-6">
          <img 
            src="/logo-olga.png?v=3" 
            alt="Logo O.L.G.A." 
            className="h-10 w-auto object-contain mb-2 opacity-90"
            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
          />
          <h1 className="text-2xl font-black text-white tracking-tight font-serif">O.L.G.A.</h1>
          <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Gestión Notarial</p>
        </div>

        {/* Estado de carga verificando el código */}
        {verifyingCode && (
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-gray-400">Verificando enlace...</p>
          </div>
        )}

        {/* Manejo de Errores */}
        {error && !verifyingCode && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/30 border border-red-500/20 text-left">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-300 uppercase tracking-wider">Error de Enlace</p>
                <p className="text-red-400 text-sm mt-2">{error}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/consola')}
              className="mt-4 w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-gray-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver al Login</span>
            </button>
          </div>
        )}

        {/* Mensaje de Éxito */}
        {successMessage && !verifyingCode && (
          <div className="flex flex-col items-center text-center py-4 animate-fade-in">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mb-4 text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{successMessage}</h3>
            <p className="text-xs text-gray-400 mb-6 max-w-xs">
              {mode === 'resetPassword' 
                ? 'Ya puedes iniciar sesión con tu nueva contraseña.' 
                : 'Tu correo ha sido confirmado y tu cuenta está activa.'}
            </p>
            <button
              onClick={() => navigate('/consola')}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-blue-600/20 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Volver al Login</span>
            </button>
          </div>
        )}

        {/* Formulario de resetPassword */}
        {mode === 'resetPassword' && !successMessage && !error && !verifyingCode && (
          <form onSubmit={handleResetPasswordSubmit} className="flex flex-col gap-4 text-left">
            <div className="text-center mb-2">
              <h2 className="text-lg font-bold text-white">Restablecer Contraseña</h2>
              {targetEmail && (
                <p className="text-xs text-gray-400 mt-1">
                  Cuenta: <span className="text-blue-400 font-medium">{targetEmail}</span>
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-400">Nueva Contraseña</label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Ingresa tu nueva contraseña"
                className="bg-[#09090b] border border-gray-800 text-white focus:border-blue-500 h-10 px-3 rounded-lg w-full outline-none transition-colors placeholder:text-gray-600 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-400">Confirmar Contraseña</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirma tu nueva contraseña"
                className="bg-[#09090b] border border-gray-800 text-white focus:border-blue-500 h-10 px-3 rounded-lg w-full outline-none transition-colors placeholder:text-gray-600 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full h-10 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm rounded-lg transition-all shadow-md shadow-blue-600/20 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Cargando...</span>
                </>
              ) : (
                <span>Guardar Nueva Contraseña</span>
              )}
            </button>
          </form>
        )}

        {/* Footer info sutil */}
        <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-center gap-2 text-[10px] text-gray-600 uppercase font-mono tracking-wider">
          <Lock className="w-3 h-3" />
          <span>Acceso Protegido y Cifrado</span>
        </div>
      </div>
    </div>
  );
};
