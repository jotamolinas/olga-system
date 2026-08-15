import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../services/auth';
import { CheckCircle, XCircle, FileText, Loader2, AlertCircle, ExternalLink } from 'lucide-react';

interface PendingRequest {
  id: string;
  phoneNumber?: string;
  razonSocial?: string;
  nombre?: string;
  planDeseado?: string;
  urlComprobante?: string;
  estadoPlataforma?: string;
  planSolicitado?: string;
}

export const AdminPagos: React.FC<{ isAdmin?: boolean }> = ({ isAdmin = false }) => {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (!auth?.currentUser?.uid) return;
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    if (!auth.currentUser || !auth.currentUser.uid) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'users'));
      const querySnapshot = await getDocs(q);
      const docs: PendingRequest[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.estadoPago === 'PAGO_PENDIENTE_VERIFICACION' || data.estadoPlataforma === 'PAGO_PENDIENTE_VERIFICACION') {
          docs.push({ id: doc.id, ...data });
        }
      });
      setRequests(docs);
    } catch (error: any) {
      if (error.code === 'permission-denied') {
        console.warn('Permisos denegados temporalmente al cargar solicitudes. Reintentar más tarde.', error);
      } else {
        console.error('Error fetching pending requests:', error);
        showToast('Error al cargar solicitudes', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

    const aprobarPlanCliente = async (userId: string, planSolicitado: string = 'Pro') => {
    if (!auth.currentUser || !auth.currentUser.uid) return;
    
    if (!isAdmin) {
      showToast('No tienes permisos de administrador para realizar esta acción', 'error');
      return;
    }

    setActionLoading(userId);
    try {
      let maxUsuarios = 5;
      let limiteIA = 50;
      let exactPlan = 'pro';
      
      const planLower = planSolicitado.toLowerCase();
      
      if (planLower.includes('básico') || planLower.includes('basico')) {
        maxUsuarios = 2;
        limiteIA = 50;
        exactPlan = 'basico';
      } else if (planLower.includes('pro')) {
        maxUsuarios = 5;
        limiteIA = 50;
        exactPlan = 'pro';
      } else if (planLower.includes('empresa')) {
        maxUsuarios = 10;
        limiteIA = 100;
        exactPlan = 'empresa';
      } else if (planLower.includes('full')) {
        maxUsuarios = 15;
        limiteIA = 300;
        exactPlan = 'full';
      }

      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        estadoPago: 'ACTIVO',
        estadoPlataforma: 'Aprobado',
        plan: exactPlan,
        maxUsuarios: maxUsuarios,
        limiteIA: limiteIA,
        usoIA: 0,
        consultasUsadas: 0,
        escritosUsados: 0,
      });

      setRequests(prev => prev.filter(req => req.id !== userId));
      showToast('Pago aprobado exitosamente', 'success');
    } catch (error) {
      console.error('Error approving plan:', error);
      showToast('Error al aprobar el plan', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const rechazarPlanCliente = async (userId: string) => {
    if (!auth.currentUser || !auth.currentUser.uid) return;
    setActionLoading(userId);
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        estadoPlataforma: 'Rechazado',
      });
      setRequests(prev => prev.filter(req => req.id !== userId));
      showToast('Comprobante rechazado', 'success');
    } catch (error) {
      console.error('Error rejecting plan:', error);
      showToast('Error al rechazar', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p className="text-xs font-bold uppercase tracking-widest">Cargando Solicitudes...</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full box-border animate-fade-in relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-xl shadow-xl flex items-center gap-3 z-50 text-white font-bold text-sm tracking-wide ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      <div>
        <h2 className="text-2xl font-bold font-serif text-slate-800 flex items-center gap-2.5">
          <FileText className="w-6 h-6 text-[#FF3131]" />
          Gestión de Cobros y Aprobaciones
        </h2>
        <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">
          Centro de Control Administrativo
        </p>
      </div>

      <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full box-border text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/50 bg-slate-950/50">
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Plan</th>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Comprobante</th>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest">Estado</th>
                <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 text-sm">
                    No hay solicitudes pendientes de aprobación.
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4">
                      <p className="text-sm font-bold text-white">
                        {req.razonSocial || req.nombre || req.phoneNumber || 'Usuario Sin Nombre'}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono mt-1">{req.id}</p>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {req.planSolicitado || req.planDeseado || 'Plan Pro'}
                      </span>
                    </td>
                    <td className="p-4">
                      {req.urlComprobante ? (
                        <a 
                          href={req.urlComprobante} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Ver Recibo
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500">Sin archivo</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        Pendiente
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => aprobarPlanCliente(req.id, req.planSolicitado || req.planDeseado || 'Pro')}
                        disabled={actionLoading === req.id}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
                      >
                        {actionLoading === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        Aprobar
                      </button>
                      <button
                        onClick={() => rechazarPlanCliente(req.id)}
                        disabled={actionLoading === req.id}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-red-500/10 text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                        Rechazar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
