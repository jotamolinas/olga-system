import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { emailSignIn } from '../services/auth';
import { ShieldAlert, Loader2 } from 'lucide-react';

export const AdminLoginRoute: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [email, setEmail] = useState('jotamolinas@gmail.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [auth]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (currentUser && (
    currentUser.email === 'jotamolinas@gmail.com' ||
    [
      "sjqCJTQ1lNMRIMk31VRwz9Rwhud2", 
      "SDzZ9vL9y4cGQc4sHatRI2QugBr2",
      "SDzZ9vL9y4cGQc4sHatRl2QugBr2",
      "SDzZ9yL9y4cGQc4sHatRI2QugBr2",
      "SDzZ9yL9y4cGQc4sHatRl2QugBr2",
      "5DzZ9vL9y4cGQc4sHatRI2QugBr2",
      "SDz29yL9y4cG0c4sHatRl20ugRc2"
    ].includes(currentUser.uid)
  )) {
    return <Navigate to="/consola/admin" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor complete ambos campos.');
      return;
    }
    setAuthLoading(true);
    setError('');
    
    try {
      await emailSignIn(email, password);
      // Wait for auth state change to trigger redirect
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('El método de Correo/Contraseña no está habilitado. Habilítelo en Firebase o use Google.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Credenciales incorrectas o usuario no registrado.');
      } else {
        setError('Error: ' + err.message);
      }
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
     <div className="bg-white rounded-3xl w-full box-border max-w-sm shadow-2xl p-6 md:p-8 border border-slate-100 flex flex-col items-center max-h-[95vh] overflow-y-auto">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-[#FF3131] mb-6">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-black uppercase text-slate-800 tracking-wider text-center">
          Super Admin
        </h3>
        <p className="text-sm text-slate-500 text-center mt-2 mb-8">
          Acceso exclusivo para el sistema O.L.G.A.
        </p>
        
        <form className="w-full box-border space-y-4" onSubmit={handleLogin}>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Email</label>
            <input 
              type="email"
              placeholder="ejemplo@email.com"
              className="w-full box-border bg-slate-50 border border-slate-200 text-slate-800 text-sm p-3 rounded-2xl outline-none focus:border-[#FF3131] focus:ring-1 focus:ring-[#FF3131] transition-all"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Contraseña</label>
            <input 
              type="password"
              placeholder="••••••••"
              className="w-full box-border bg-slate-50 border border-slate-200 text-slate-800 text-sm p-3 rounded-2xl outline-none focus:border-[#FF3131] focus:ring-1 focus:ring-[#FF3131] transition-all"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              required
            />
          </div>
          
          {error && (
            <p className="text-red-500 text-xs font-medium text-center">{error}</p>
          )}

          <div className="flex justify-center mt-2">
            <button
              type="button"
              onClick={async () => {
                if (!email) {
                  setError('Por favor, ingresa tu email para restablecer la contraseña.');
                  return;
                }
                setAuthLoading(true);
                setError('');
                try {
                  const { resetPassword } = await import('../services/auth');
                  await resetPassword(email);
                  setError('Se ha enviado un enlace de recuperación a tu correo.');
                } catch (err: any) {
                  console.error(err);
                  setError(err.message || 'Error al enviar el correo de recuperación.');
                } finally {
                  setAuthLoading(false);
                }
              }}
              disabled={authLoading}
              className="text-xs text-[#FF3131] hover:text-red-700 transition-colors bg-transparent border-none p-0 cursor-pointer"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <button
            type="submit"
            disabled={authLoading}
            className="w-full box-border py-4 mt-4 bg-[#FF3131] text-white text-sm font-bold uppercase tracking-widest rounded-2xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30 flex items-center justify-center disabled:opacity-50"
          >
            {authLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ingresar con Contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
};
