import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/auth';
import { 
  CheckCircle, XCircle, AlertTriangle, Users, FileText, 
  Activity, ExternalLink, ShieldCheck, ShieldAlert, Shield, 
  Search, DollarSign
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts';

interface PendingPayment {
  id: string;
  userId: string;
  email: string;
  nombreCliente?: string;
  montoAPagar: number;
  modalidadPago: string;
  urlComprobante: string;
  fechaSolicitud: any;
  planSolicitado: string;
}

interface PagareGlobal {
  id: string;
  userId: string;
  empresa?: string;
  acreedor_nombre: string;
  acreedor_documento?: string;
  deudor_nombre: string;
  deudor_cedula: string;
  monto: string | number;
  fecha_vencimiento: string;
  fecha_emision: string;
  created_at: any;
  userEmail?: string;
}

interface Metrics {
  totalUsers: number;
  activeUsers: number;
  totalPagares: number;
  aiQueries: number;
  alerts: number;
}

export const SuperAdminDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics>({ totalUsers: 0, activeUsers: 0, totalPagares: 0, aiQueries: 0, alerts: 0 });
  const [loading, setLoading] = useState(true);
  
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [reciboSeleccionado, setReciboSeleccionado] = useState<string | null>(null);

  const [pagaresGlobal, setPagaresGlobal] = useState<PagareGlobal[]>([]);
  const [auditoriaSeleccionada, setAuditoriaSeleccionada] = useState<{pagare: PagareGlobal, reporte: {riesgo: string, razones: string[]}} | null>(null);

  const [chartData, setChartData] = useState<{name: string, cantidad: number}[]>([]);
  const [lineData, setLineData] = useState<{name: string, volumen: number}[]>([]);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        let tUsers = 0;
        let aUsers = 0;
        let aiQ = 0;
        const userMap: Record<string, any> = {};
        const pend: PendingPayment[] = [];

        usersSnap.forEach(doc => {
          const data = doc.data();
          tUsers++;
          if (data.plan && data.plan !== 'Demo') aUsers++;
          if (data.aiConsultationsCount) aiQ += data.aiConsultationsCount;
          userMap[doc.id] = data;

          const estadoPago = String(data.estadoPago || '').toUpperCase();
          if (estadoPago === 'PAGO_PENDIENTE_VERIFICACION' || estadoPago === 'PENDIENTE') {
            pend.push({
              id: doc.id,
              userId: doc.id,
              email: data.email || data.correo || data.phoneNumber || data.telefono || doc.id || 'Desconocido',
              nombreCliente: data.nombre || data.razonSocial || data.nombreCompleto || data.displayName || 'Cliente sin nombre registrado',
              montoAPagar: data.montoAPagar || 0,
              modalidadPago: data.modalidadPago || 'Desconocido',
              urlComprobante: data.urlComprobante || '',
              fechaSolicitud: data.fechaSolicitud,
              planSolicitado: data.planSolicitado || 'Plan desconocido',
            });
          }
        });

        const pagaresSnap = await getDocs(collection(db, 'pagares'));
        let tPagares = pagaresSnap.size;
        const pgs: PagareGlobal[] = [];
        const mesCounts: Record<string, number> = {};
        const mesVolumen: Record<string, number> = {};

        const safeFormatDate = (timestamp: any) => {
          if (!timestamp) return 'Fecha no registrada';
          if (timestamp.toDate) {
            const d = timestamp.toDate();
            const pad = (n: number) => n.toString().padStart(2, '0');
            return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
          }
          if (typeof timestamp === 'string' || typeof timestamp === 'number') {
            const d = new Date(timestamp);
            if (!isNaN(d.getTime())) {
              const pad = (n: number) => n.toString().padStart(2, '0');
              return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
            }
          }
          return 'Fecha no registrada';
        };

        pagaresSnap.forEach(doc => {
          const rawData = doc.data();
          
          let rawMonto = rawData.valor_total || rawData.monto || 0;
          if (typeof rawMonto === 'string') {
            rawMonto = parseFloat(rawMonto.replace(/[^\d.-]/g, '')) || 0;
          }

          const fechaRaw = rawData.created_at;

          const uid = rawData.userId || rawData.creator_id || '';
          const mappedUser = uid ? userMap[uid] : null;
          let displayEmail = 'Desconocido';
          if (mappedUser) {
            displayEmail = mappedUser.razonSocial || mappedUser.email || `ID: ${uid}`;
          } else if (uid) {
            displayEmail = `ID: ${uid}`;
          }

          const mappedPagare: PagareGlobal = {
            id: doc.id,
            userId: uid,
            userEmail: displayEmail,
            empresa: rawData.acreedor_nombre_raw || 'Empresa Desconocida',
            acreedor_nombre: rawData.acreedor_nombre_raw || 'Emisor Desconocido',
            acreedor_documento: rawData.acreedor_documento_raw || '',
            deudor_nombre: rawData.deudor_nombre_raw || 'Deudor Desconocido',
            deudor_cedula: rawData.deudor_documento_raw || '',
            monto: rawMonto,
            fecha_vencimiento: rawData.fechaVencimiento || rawData.fecha_vencimiento || '',
            fecha_emision: safeFormatDate(fechaRaw),
            created_at: fechaRaw || null
          };

          pgs.push(mappedPagare);

          if (mappedPagare.created_at) {
            const d = mappedPagare.created_at.toDate ? mappedPagare.created_at.toDate() : new Date(mappedPagare.created_at);
            if (!isNaN(d.getTime())) {
              const mes = d.toLocaleString('es-ES', { month: 'short' }).toUpperCase();
              mesCounts[mes] = (mesCounts[mes] || 0) + 1;
              const monto = typeof mappedPagare.monto === 'number' ? mappedPagare.monto : 0;
              mesVolumen[mes] = (mesVolumen[mes] || 0) + monto;
            }
          }
        });

        setMetrics({
          totalUsers: tUsers,
          activeUsers: aUsers,
          totalPagares: tPagares,
          aiQueries: aiQ,
          alerts: pend.length
        });

        const parseDateSort = (val: any) => {
          if (!val) return 0;
          if (val.toDate) return val.toDate().getTime();
          if (typeof val === 'string') {
            const parts = val.split('/');
            if (parts.length === 3) {
              return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00Z`).getTime();
            }
            const d = new Date(val);
            if (!isNaN(d.getTime())) return d.getTime();
          }
          if (typeof val === 'number') return val;
          return 0;
        };

        setPendingPayments(pend.sort((a, b) => (b.fechaSolicitud?.toDate?.()?.getTime() || 0) - (a.fechaSolicitud?.toDate?.()?.getTime() || 0)));
        setPagaresGlobal(pgs.sort((a, b) => parseDateSort(b.created_at) - parseDateSort(a.created_at)));

        const meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        const currentMonth = new Date().getMonth();
        const last6Months = [];
        for (let i = 5; i >= 0; i--) {
          let m = currentMonth - i;
          if (m < 0) m += 12;
          last6Months.push(meses[m]);
        }

        setChartData(last6Months.map(m => ({ name: m, cantidad: mesCounts[m] || 0 })));
        setLineData(last6Months.map(m => ({ name: m, volumen: mesVolumen[m] || 0 })));

        setLoading(false);
        setLoadingPayments(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
        setLoadingPayments(false);
      }
    };

    fetchAllData();
  }, []);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Fecha no disponible';
    if (timestamp.toDate) {
      const d = timestamp.toDate();
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    return 'Fecha inválida';
  };

  const handleAprobar = async (userId: string, planSolicitado: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        planActual: planSolicitado,
        estadoPago: 'APROBADO',
        fechaAprobacion: new Date().toISOString()
      });
      setPendingPayments(prev => prev.filter(p => p.userId !== userId));
      alert('Operación exitosa');
    } catch (err) {
      console.error(err);
      alert('Error al aprobar');
    }
  };

  const handleRechazar = async (userId: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        estadoPago: 'RECHAZADO'
      });
      setPendingPayments(prev => prev.filter(p => p.userId !== userId));
      alert('Operación exitosa');
    } catch (err) {
      console.error(err);
      alert('Error al rechazar');
    }
  };

  const evaluarRiesgo = (pagare: PagareGlobal) => {
    let riesgo: 'Normal' | 'Sospechoso' | 'Critico' = 'Normal';
    let razones: string[] = [];

    const montoStr = String(pagare.monto || '0').replace(/[^\d.-]/g, '');
    const monto = parseFloat(montoStr);

    if (monto > 50000000) {
      riesgo = 'Sospechoso';
      razones.push('Monto inusualmente alto (> 50.000.000 Gs).');
    }

    if (pagare.fecha_vencimiento && pagare.fecha_emision) {
      const v = new Date(pagare.fecha_vencimiento);
      const e = new Date(pagare.fecha_emision);
      if (v < e) {
        riesgo = 'Critico';
        razones.push('Fecha de vencimiento es anterior a la fecha de emisión.');
      }
    }

    if (!pagare.deudor_cedula || pagare.deudor_cedula.trim() === '') {
      riesgo = 'Critico';
      razones.push('Falta C.I. o RUC del deudor.');
    }

    return { riesgo, razones };
  };

  const handleAuditoria = (pagare: PagareGlobal) => {
    const reporte = evaluarRiesgo(pagare);
    setAuditoriaSeleccionada({ pagare, reporte });
  };

  const renderRiesgoIcon = (riesgo: string) => {
    if (riesgo === 'Critico') return <ShieldAlert className="w-5 h-5 text-red-500" />;
    if (riesgo === 'Sospechoso') return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    return <ShieldCheck className="w-5 h-5 text-emerald-500" />;
  };

  const renderRiesgoBadge = (riesgo: string) => {
    if (riesgo === 'Critico') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20"><ShieldAlert className="w-3 h-3"/> CRÍTICO</span>;
    if (riesgo === 'Sospechoso') return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"><AlertTriangle className="w-3 h-3"/> SOSPECHOSO</span>;
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><ShieldCheck className="w-3 h-3"/> NORMAL</span>;
  };

  return (
    <div className="p-4 md:p-8 animate-fade-in w-full box-border max-w-7xl mx-auto text-slate-200">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
          <Activity className="w-8 h-8 text-blue-500" />
          Panel de Control - SuperAdmin
        </h1>
        <p className="text-slate-400 mt-2 font-medium">Vista global del sistema, métricas, aprobaciones y auditoría en tiempo real.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col relative overflow-hidden group hover:border-blue-500/30 transition-colors">
          <div className="absolute -top-6 -right-6 p-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110">
            <Users className="w-32 h-32 text-blue-400" />
          </div>
          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className="p-2.5 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Usuarios Totales</h2>
          </div>
          <div className="mt-auto relative z-10">
            {loading ? <div className="h-10 w-24 bg-slate-800 rounded animate-pulse"></div> : <p className="text-4xl font-black text-white tracking-tight">{metrics.totalUsers}</p>}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
          <div className="absolute -top-6 -right-6 p-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110">
            <FileText className="w-32 h-32 text-emerald-400" />
          </div>
          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className="p-2.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pagarés Emitidos</h2>
          </div>
          <div className="mt-auto relative z-10">
            {loading ? <div className="h-10 w-24 bg-slate-800 rounded animate-pulse"></div> : <p className="text-4xl font-black text-white tracking-tight">{metrics.totalPagares}</p>}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col relative overflow-hidden group hover:border-purple-500/30 transition-colors">
          <div className="absolute -top-6 -right-6 p-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110">
            <Activity className="w-32 h-32 text-purple-400" />
          </div>
          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className="p-2.5 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <Activity className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Consultas IA</h2>
          </div>
          <div className="mt-auto relative z-10">
            {loading ? <div className="h-10 w-24 bg-slate-800 rounded animate-pulse"></div> : <p className="text-4xl font-black text-white tracking-tight">{metrics.aiQueries}</p>}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col relative overflow-hidden group hover:border-orange-500/30 transition-colors">
          <div className="absolute -top-6 -right-6 p-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110">
            <AlertTriangle className="w-32 h-32 text-orange-400" />
          </div>
          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className="p-2.5 bg-orange-500/10 rounded-lg border border-orange-500/20">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
            </div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pagos Pendientes</h2>
          </div>
          <div className="mt-auto relative z-10">
            {loadingPayments ? (
              <div className="h-10 w-24 bg-slate-800 rounded animate-pulse"></div>
            ) : (
              <p className={`text-4xl font-black tracking-tight ${pendingPayments.length > 0 ? 'text-orange-500' : 'text-white'}`}>{pendingPayments.length}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2"><FileText className="w-4 h-4"/> Emisión de Pagarés (Últimos 6 Meses)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip 
                  cursor={{ fill: '#1e293b' }}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#f1f5f9' }}
                />
                <Bar dataKey="cantidad" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2"><DollarSign className="w-4 h-4"/> Volumen Notariado (Gs)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#475569" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#f1f5f9' }}
                  formatter={(value: number) => [`Gs ${value.toLocaleString('es-PY')}`, 'Volumen']}
                />
                <Line type="monotone" dataKey="volumen" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            Comprobantes Pendientes de Aprobación
          </h2>
          <p className="text-sm text-slate-400 mt-1">Revisa y aprueba los pagos de los usuarios para activar sus planes.</p>
        </div>
        <div className="overflow-x-auto">
          {loadingPayments ? (
            <div className="p-12 flex justify-center">
              <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
            </div>
          ) : pendingPayments.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-500/50" />
              </div>
              <p className="text-slate-400 font-medium">No hay comprobantes pendientes</p>
              <p className="text-sm text-slate-500 mt-1">Todos los pagos han sido procesados.</p>
            </div>
          ) : (
            <table className="w-full box-border text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/50 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400 font-black">
                  <th className="p-4 pl-6">Cliente</th>
                  <th className="p-4">Fecha</th>
                  <th className="p-4">Plan Solicitado</th>
                  <th className="p-4 text-center">Comprobante</th>
                  <th className="p-4 pr-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {pendingPayments.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold shrink-0">
                          {(cliente.nombreCliente || cliente.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-white text-base">{cliente.nombreCliente}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{cliente.email}</p>
                          <p className="text-[10px] text-slate-600 font-mono mt-0.5">ID: {cliente.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-300">
                      {formatDate(cliente.fechaSolicitud)}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 w-fit">
                          {cliente.planSolicitado}
                        </span>
                        <span className="text-xs text-slate-500 mt-1 font-medium">{cliente.modalidadPago} (Gs. {cliente.montoAPagar.toLocaleString('es-PY')})</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      {cliente.urlComprobante ? (
                        <button 
                          onClick={() => setReciboSeleccionado(cliente.urlComprobante)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold text-xs rounded-xl transition-colors border border-slate-700 hover:border-slate-600"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Ver Recibo
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500 italic">Sin archivo</span>
                      )}
                    </td>
                    <td className="p-4 pr-6 text-right space-x-2">
                      <button
                        onClick={() => handleAprobar(cliente.id, cliente.planSolicitado || '')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white font-bold text-xs rounded-xl transition-all border border-emerald-500/20 hover:border-emerald-500"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Aprobar
                      </button>
                      <button
                        onClick={() => handleRechazar(cliente.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white font-bold text-xs rounded-xl transition-all border border-rose-500/20 hover:border-rose-500"
                      >
                        <XCircle className="w-4 h-4" />
                        Rechazar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="mt-6 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden mb-6">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-500" />
              Monitor Global de Pagarés
            </h2>
            <p className="text-sm text-slate-400 mt-1">Auditoría centralizada con IA de todos los documentos emitidos en la plataforma.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
             <div className="p-12 flex justify-center">
               <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
             </div>
          ) : pagaresGlobal.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-blue-500/50" />
              </div>
              <p className="text-slate-400 font-medium">No hay pagarés registrados</p>
            </div>
          ) : (
            <table className="w-full box-border text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/50 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400 font-black">
                  <th className="p-4 pl-6">Fecha</th>
                  <th className="p-4">CREADO POR</th>
                  <th className="p-4">Emisor (Usuario)</th>
                  <th className="p-4">Deudor</th>
                  <th className="p-4 text-right">Monto</th>
                  <th className="p-4 text-center">Auditoría IA</th>
                  <th className="p-4 pr-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {pagaresGlobal.map((pagare) => {
                  const riesgo = evaluarRiesgo(pagare).riesgo;
                  return (
                    <tr key={pagare.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 pl-6 text-xs text-slate-400 whitespace-nowrap">
                        {pagare.fecha_emision}
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-slate-200 text-sm truncate max-w-[120px] sm:max-w-[150px]">{pagare.userEmail || 'Email no registrado'}</p>
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-slate-200 text-sm truncate max-w-[120px] sm:max-w-[150px]">{pagare.acreedor_nombre || 'Sin nombre'}</p>
                        <p className="text-xs text-slate-500 truncate max-w-[120px] sm:max-w-[150px]">{pagare.userEmail}</p>
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-slate-200 text-sm truncate max-w-[120px] sm:max-w-[150px]">{pagare.deudor_nombre || 'Sin nombre'}</p>
                        <p className="text-xs text-slate-500 font-mono truncate max-w-[120px] sm:max-w-[150px]">{pagare.deudor_cedula || 'Sin documento'}</p>
                      </td>
                      <td className="p-4 text-right font-mono text-sm text-slate-300">
                        {typeof pagare.monto === 'number' ? `Gs. ${pagare.monto.toLocaleString('es-PY')}` : pagare.monto}
                      </td>
                      <td className="p-4 text-center">
                        {renderRiesgoBadge(riesgo)}
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <button
                          onClick={() => handleAuditoria(pagare)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-blue-400 font-bold text-xs rounded-xl transition-colors border border-slate-700 hover:border-blue-500/50"
                        >
                          <Search className="w-4 h-4" />
                          Auditar Detalle
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {reciboSeleccionado && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-screen overflow-hidden flex flex-col items-center justify-center">
            <button
              onClick={() => setReciboSeleccionado(null)}
              className="absolute top-4 right-4 bg-slate-900/80 hover:bg-slate-900 text-white p-2 rounded-full transition-colors z-10 border border-slate-700"
              aria-label="Cerrar modal"
            >
              <XCircle className="w-6 h-6" />
            </button>
            <img 
              src={reciboSeleccionado} 
              alt="Comprobante de Pago" 
              className="max-w-full box-border max-h-[90vh] object-contain rounded-lg shadow-2xl" 
            />
          </div>
        </div>
      )}

      {auditoriaSeleccionada && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full box-border max-w-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <h2 className="text-xl font-black text-white flex items-center gap-3">
                {renderRiesgoIcon(auditoriaSeleccionada.reporte.riesgo)}
                Reporte de Auditoría IA
              </h2>
              <button
                onClick={() => setAuditoriaSeleccionada(null)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Nivel de Riesgo Detectado</h3>
                <div className="flex items-center gap-4">
                  {renderRiesgoBadge(auditoriaSeleccionada.reporte.riesgo)}
                  {auditoriaSeleccionada.reporte.riesgo === 'Normal' ? (
                    <p className="text-sm text-slate-400">El documento cumple con los parámetros habituales de la plataforma. No se detectaron anomalías estructurales.</p>
                  ) : (
                    <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
                      {auditoriaSeleccionada.reporte.razones.map((razon, i) => (
                        <li key={i} className={auditoriaSeleccionada.reporte.riesgo === 'Critico' ? 'text-red-400 font-medium' : 'text-yellow-400 font-medium'}>{razon}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Datos del Emisor</h3>
                  <p className="text-sm font-bold text-slate-200">{auditoriaSeleccionada.pagare.acreedor_nombre || 'N/A'}</p>
                  <p className="text-xs text-slate-400">{auditoriaSeleccionada.pagare.userEmail}</p>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Datos del Deudor</h3>
                  <p className="text-sm font-bold text-slate-200">{auditoriaSeleccionada.pagare.deudor_nombre || 'N/A'}</p>
                  <p className="text-xs font-mono text-slate-400">CI/RUC: {auditoriaSeleccionada.pagare.deudor_cedula || 'N/A'}</p>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 grid grid-cols-3 gap-4">
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Monto</h3>
                  <p className="text-sm font-mono font-bold text-slate-200">
                    {typeof auditoriaSeleccionada.pagare.monto === 'number' ? `Gs. ${auditoriaSeleccionada.pagare.monto.toLocaleString('es-PY')}` : auditoriaSeleccionada.pagare.monto}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Emisión</h3>
                  <p className="text-sm text-slate-300">{auditoriaSeleccionada.pagare.fecha_emision || 'N/A'}</p>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Vencimiento</h3>
                  <p className="text-sm text-slate-300">{auditoriaSeleccionada.pagare.fecha_vencimiento || 'N/A'}</p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-3">
              <button
                onClick={() => setAuditoriaSeleccionada(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cerrar Reporte
              </button>
              {(auditoriaSeleccionada.reporte.riesgo === 'Sospechoso' || auditoriaSeleccionada.reporte.riesgo === 'Critico') && (
                <button
                  onClick={() => {
                    alert('Usuario bloqueado por prevención de fraude.');
                    setAuditoriaSeleccionada(null);
                  }}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-red-900/20"
                >
                  <ShieldAlert className="w-5 h-5" />
                  Bloquear Usuario (Posible Fraude)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
