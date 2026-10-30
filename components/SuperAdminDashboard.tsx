import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/auth';
import { 
  CheckCircle, XCircle, AlertTriangle, Users, FileText, 
  Activity, ExternalLink, ShieldCheck, ShieldAlert, Shield, 
  Search, DollarSign, Mail, Phone, Clock, Sparkles, Crown,
  Building, Zap, CheckCircle2, UserCheck, ShieldQuestion
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts';

export interface RegisteredUser {
  id: string;
  email: string;
  telefono: string;
  nombre: string;
  razonSocial: string;
  plan: string;
  estadoSuscripcion: 'activo' | 'prueba' | 'pendiente' | 'vencido';
  estadoPago: string;
  modalidadPago: string;
  montoAPagar: number;
  timestamp: number;
  fechaFormateada: string;
  diasRestantes?: number;
  isRecent: boolean;
  raw: any;
}

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

  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userFilter, setUserFilter] = useState<'todos' | 'activos' | 'prueba' | 'pendientes'>('todos');
  const [userSearchTerm, setUserSearchTerm] = useState('');

  const getUserTimestamp = (u: any): number => {
    if (!u) return 0;
    const candidates = [
      u.createdAt,
      u.created_at,
      u.fechaCreacion,
      u.fecha_creacion,
      u.fechaRegistro,
      u.fecha_registro,
      u.fechaSolicitud,
      u.fecha_solicitud,
      u.fecha_inicio_plan,
      u.fechaAprobacion,
      u.timestamp,
      u.updatedAt,
      u.updated_at
    ];

    for (const c of candidates) {
      if (!c) continue;
      if (typeof c?.toDate === 'function') {
        const ms = c.toDate().getTime();
        if (!isNaN(ms) && ms > 0) return ms;
      }
      if (typeof c === 'number' && !isNaN(c)) {
        if (c > 1000000000000) return c;
        if (c > 100000000) return c * 1000;
      }
      if (typeof c === 'string') {
        const ms = Date.parse(c);
        if (!isNaN(ms) && ms > 0) return ms;
      }
    }
    return 0;
  };

  const formatUserDate = (timestamp: number) => {
    if (!timestamp || timestamp === 0) return 'Reciente / No registrada';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return 'Fecha inválida';
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  useEffect(() => {
    let unsubscribeUsers: (() => void) | null = null;
    let isMounted = true;

    // 1. Sincronización en TIEMPO REAL de Usuarios (Con Plan, En Prueba y Pendientes)
    try {
      const usersCol = collection(db, 'users');
      unsubscribeUsers = onSnapshot(usersCol, (usersSnap) => {
        if (!isMounted) return;

        const usersList: RegisteredUser[] = [];
        const pend: PendingPayment[] = [];
        let tUsers = 0;
        let aUsers = 0;
        let aiQ = 0;

        usersSnap.forEach((docSnap) => {
          const data = docSnap.data();
          const docId = docSnap.id;
          tUsers++;

          if (data.aiConsultationsCount) aiQ += data.aiConsultationsCount;

          const planStr = String(data.planActual || data.plan || data.planSolicitado || '').toLowerCase();
          const estadoPago = String(data.estadoPago || '').toUpperCase();
          const estadoPlataforma = String(data.estadoPlataforma || '').toUpperCase();

          const isPending = estadoPago === 'PAGO_PENDIENTE_VERIFICACION' || estadoPago === 'PENDIENTE';
          if (isPending) {
            pend.push({
              id: docId,
              userId: docId,
              email: data.email || data.correo || data.phoneNumber || data.telefono || docId || 'Desconocido',
              nombreCliente: data.nombre || data.razonSocial || data.nombreCompleto || data.displayName || 'Cliente sin nombre registrado',
              montoAPagar: data.montoAPagar || 0,
              modalidadPago: data.modalidadPago || 'Desconocido',
              urlComprobante: data.urlComprobante || '',
              fechaSolicitud: data.fechaSolicitud,
              planSolicitado: data.planSolicitado || 'Plan desconocido',
            });
          }

          const isPaidPlan = planStr.includes('pro') || planStr.includes('empresa') || planStr.includes('full') || planStr.includes('basico') || planStr.includes('básico') || estadoPago === 'APROBADO' || estadoPago === 'ACTIVO' || estadoPlataforma === 'APROBADO';
          if (isPaidPlan) aUsers++;

          const timestamp = getUserTimestamp(data);

          let estadoSuscripcion: 'activo' | 'prueba' | 'pendiente' | 'vencido' = 'prueba';
          let diasRestantes = 5;

          if (isPending) {
            estadoSuscripcion = 'pendiente';
          } else if (isPaidPlan) {
            estadoSuscripcion = 'activo';
          } else {
            // Período de prueba de 5 días
            if (timestamp > 0) {
              const diffMs = Date.now() - timestamp;
              const daysPassed = diffMs / (1000 * 60 * 60 * 24);
              diasRestantes = Math.max(0, Math.ceil(5 - daysPassed));
              if (daysPassed > 5 || diasRestantes <= 0) {
                estadoSuscripcion = 'vencido';
              } else {
                estadoSuscripcion = 'prueba';
              }
            } else {
              estadoSuscripcion = 'prueba';
              diasRestantes = 5;
            }
          }

          const isRecent = timestamp > 0 && (Date.now() - timestamp) < (24 * 60 * 60 * 1000);

          usersList.push({
            id: docId,
            email: data.email || data.correo || '',
            telefono: data.phoneNumber || data.telefono || data.celular || data.phone || '',
            nombre: data.nombre || data.razonSocial || data.nombreCompleto || data.displayName || 'Usuario Registrado',
            razonSocial: data.razonSocial || data.escribania?.nombre || '',
            plan: data.planActual || data.plan || (estadoSuscripcion === 'activo' ? 'Plan Activo' : 'Prueba Gratuita'),
            estadoSuscripcion,
            estadoPago: data.estadoPago || data.estadoPlataforma || (estadoSuscripcion === 'activo' ? 'APROBADO' : 'PRUEBA'),
            modalidadPago: data.modalidadPago || (data.tipoPlan ? `Plan ${data.tipoPlan}` : ''),
            montoAPagar: data.montoAPagar || 0,
            timestamp,
            fechaFormateada: formatUserDate(timestamp),
            diasRestantes,
            isRecent,
            raw: data
          });
        });

        // REGLA CRÍTICA: Orden estricto de arriba para abajo de más nuevo a más viejo siempre.
        // Los nuevos usuarios que ingresen se posicionan automáticamente en el top del contenedor.
        usersList.sort((a, b) => b.timestamp - a.timestamp);

        setRegisteredUsers(usersList);
        setPendingPayments(pend.sort((a, b) => (b.fechaSolicitud?.toDate?.()?.getTime() || 0) - (a.fechaSolicitud?.toDate?.()?.getTime() || 0)));
        setLoadingUsers(false);
        setLoadingPayments(false);

        setMetrics(prev => ({
          ...prev,
          totalUsers: tUsers,
          activeUsers: aUsers,
          aiQueries: aiQ,
          alerts: pend.length
        }));
      }, (err) => {
        console.error("Error en snapshot en tiempo real de usuarios:", err);
        setLoadingUsers(false);
      });
    } catch (err) {
      console.error("Error inicializando listener de usuarios:", err);
      setLoadingUsers(false);
    }

    // 2. Carga de Pagarés Globales para métricas y gráficos
    const fetchPagaresData = async () => {
      try {
        const pagaresSnap = await getDocs(collection(db, 'pagares'));
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

          const mappedPagare: PagareGlobal = {
            id: doc.id,
            userId: uid,
            userEmail: rawData.creatorEmail || rawData.userEmail || `ID: ${uid}`,
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

        setPagaresGlobal(pgs.sort((a, b) => parseDateSort(b.created_at) - parseDateSort(a.created_at)));
        setMetrics(prev => ({ ...prev, totalPagares: pagaresSnap.size }));

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
      } catch (err) {
        console.error("Error al obtener pagarés globales:", err);
        setLoading(false);
      }
    };

    fetchPagaresData();

    return () => {
      isMounted = false;
      if (unsubscribeUsers) unsubscribeUsers();
    };
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
      
      // 1. Calculamos la fecha actual y la fecha de vencimiento (+30 días)
      const fechaActual = new Date();
      const fechaVencimiento = new Date();
      fechaVencimiento.setDate(fechaActual.getDate() + 30);

      // 2. Ejecutamos la actualización inyectando la matemática de los planes
      await updateDoc(userRef, {
        planActual: planSolicitado,
        estadoPago: 'APROBADO',
        estado_cuenta: 'activa', // Garantiza que la cuenta se desbloquee
        fecha_inicio_plan: fechaActual.toISOString(), // Fecha nativa, sin errores
        fecha_vencimiento_plan: fechaVencimiento.toISOString(), // Bloqueo exacto en 30 días
        fechaAprobacion: fechaActual.toISOString() // Rastro de auditoría
      });

      // 3. Limpiamos la UI y avisamos al SuperAdmin
      setPendingPayments(prev => prev.filter(p => p.userId !== userId));
      alert(`¡Suscripción aprobada!\nEl plan "${planSolicitado}" vencerá automáticamente el ${fechaVencimiento.toLocaleDateString('es-ES')}.`);
    } catch (err) {
      console.error(err);
      alert('Error al aprobar la suscripción.');
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

      {/* ============================================================== */}
      {/* CONTENEDOR: USUARIOS INSCRIPTOS CON PLAN Y EN PRUEBA (EN VIVO) */}
      {/* ============================================================== */}
      <div className="mt-6 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
                  Directorio de Usuarios Registrados y en Prueba
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    En Vivo
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-1 font-medium">
                  Monitoreo de suscripciones activas, cuentas en prueba y nuevos registros. Los usuarios más nuevos se incorporan siempre arriba de forma automática.
                </p>
              </div>
            </div>
          </div>

          {/* Buscador + Filtros por Píldoras */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                placeholder="Buscar por email, teléfono o nombre..."
                className="w-full sm:w-64 pl-9 pr-3 py-1.5 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            
            <div className="flex items-center gap-1 p-1 bg-slate-800/80 rounded-xl border border-slate-700 text-xs shrink-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => setUserFilter('todos')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  userFilter === 'todos' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Todos ({registeredUsers.length})
              </button>
              <button
                type="button"
                onClick={() => setUserFilter('activos')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  userFilter === 'activos' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                Con Plan ({registeredUsers.filter(u => u.estadoSuscripcion === 'activo').length})
              </button>
              <button
                type="button"
                onClick={() => setUserFilter('prueba')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  userFilter === 'prueba' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                En Prueba ({registeredUsers.filter(u => u.estadoSuscripcion === 'prueba').length})
              </button>
              {registeredUsers.some(u => u.estadoSuscripcion === 'pendiente') && (
                <button
                  type="button"
                  onClick={() => setUserFilter('pendientes')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    userFilter === 'pendientes' ? 'bg-orange-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Pendientes ({registeredUsers.filter(u => u.estadoSuscripcion === 'pendiente').length})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabla en Tiempo Real */}
        <div className="overflow-x-auto">
          {loadingUsers ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
              <p className="text-xs text-slate-400">Sincronizando usuarios con Firestore...</p>
            </div>
          ) : registeredUsers.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-slate-300 font-bold">No hay usuarios registrados</p>
              <p className="text-xs text-slate-500 mt-1">Los nuevos usuarios que se registren aparecerán aquí automáticamente.</p>
            </div>
          ) : (
            <table className="w-full box-border text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/50 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400 font-black">
                  <th className="p-4 pl-6">Usuario / Escribanía</th>
                  <th className="p-4">Contacto Suscrito (Mail / Teléfono)</th>
                  <th className="p-4">Plan Asignado</th>
                  <th className="p-4">Estado Suscripción</th>
                  <th className="p-4 pr-6 text-right">Fecha Ingreso (Más nuevo a viejo)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {registeredUsers
                  .filter((u) => {
                    if (userFilter === 'activos' && u.estadoSuscripcion !== 'activo') return false;
                    if (userFilter === 'prueba' && u.estadoSuscripcion !== 'prueba') return false;
                    if (userFilter === 'pendientes' && u.estadoSuscripcion !== 'pendiente') return false;
                    if (userSearchTerm.trim() !== '') {
                      const term = userSearchTerm.toLowerCase();
                      const matchName = (u.nombre || '').toLowerCase().includes(term);
                      const matchEmail = (u.email || '').toLowerCase().includes(term);
                      const matchTel = (u.telefono || '').toLowerCase().includes(term);
                      const matchPlan = (u.plan || '').toLowerCase().includes(term);
                      const matchId = (u.id || '').toLowerCase().includes(term);
                      return matchName || matchEmail || matchTel || matchPlan || matchId;
                    }
                    return true;
                  })
                  .map((user, idx) => {
                    const p = (user.plan || '').toLowerCase();
                    const isFull = p.includes('full');
                    const isEmpresa = p.includes('empresa');
                    const isPro = p.includes('pro');
                    const isBasico = p.includes('basico') || p.includes('básico');

                    return (
                      <tr 
                        key={user.id} 
                        className={`hover:bg-slate-800/40 transition-colors ${
                          user.isRecent ? 'bg-blue-500/[0.03]' : ''
                        }`}
                      >
                        {/* 1. Usuario / Escribanía */}
                        <td className="p-4 pl-6">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border ${
                              user.estadoSuscripcion === 'activo'
                                ? isFull
                                  ? 'bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 text-slate-950 border-amber-400/40 shadow-xs'
                                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : user.estadoSuscripcion === 'prueba'
                                  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                                  : user.estadoSuscripcion === 'pendiente'
                                    ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            }`}>
                              {(user.nombre || user.email || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-white text-sm truncate max-w-[220px]">
                                {user.nombre}
                              </p>
                              {user.razonSocial && user.razonSocial !== user.nombre && (
                                <p className="text-xs text-slate-400 truncate max-w-[220px]">
                                  {user.razonSocial}
                                </p>
                              )}
                              <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-[220px]">
                                ID: {user.id}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* 2. Contacto Suscrito (Mail / Teléfono) */}
                        <td className="p-4">
                          <div className="space-y-1">
                            {user.email ? (
                              <div className="flex items-center gap-1.5 text-xs text-slate-100 font-medium">
                                <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                <span className="truncate max-w-[260px] select-all font-mono" title={user.email}>
                                  {user.email}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 italic">
                                <Mail className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                                <span>Sin email registrado</span>
                              </div>
                            )}

                            {user.telefono ? (
                              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono font-bold">
                                <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span className="truncate select-all" title={user.telefono}>
                                  {user.telefono}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 italic">
                                <Phone className="w-3 h-3 text-slate-600 shrink-0" />
                                <span>Sin teléfono</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 3. Plan Asignado */}
                        <td className="p-4">
                          <div className="flex flex-col gap-1 items-start">
                            {isFull ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 shadow-[0_2px_8px_rgba(245,158,11,0.25)]">
                                <Crown className="w-3 h-3 text-slate-950" /> PLAN FULL
                              </span>
                            ) : isEmpresa ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-800 text-white border border-slate-700 shadow-sm">
                                <Building className="w-3 h-3 text-slate-300" /> PLAN EMPRESA
                              </span>
                            ) : isPro ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                <Zap className="w-3 h-3 text-blue-400" /> PLAN PRO
                              </span>
                            ) : isBasico ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> PLAN BÁSICO
                              </span>
                            ) : user.estadoSuscripcion === 'prueba' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                <Clock className="w-3 h-3 text-cyan-400" /> PRUEBA ({user.diasRestantes ?? 5}D)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                                {user.plan || 'Sin Plan'}
                              </span>
                            )}

                            {user.modalidadPago && user.modalidadPago !== 'Desconocido' && (
                              <span className="text-[11px] text-slate-400 font-medium">
                                {user.modalidadPago}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. Estado Suscripción */}
                        <td className="p-4">
                          {user.estadoSuscripcion === 'activo' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Con Plan Activo
                            </span>
                          )}
                          {user.estadoSuscripcion === 'prueba' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                              En Prueba Activa
                            </span>
                          )}
                          {user.estadoSuscripcion === 'pendiente' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                              Pendiente Verificación
                            </span>
                          )}
                          {user.estadoSuscripcion === 'vencido' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                              Prueba Vencida
                            </span>
                          )}
                        </td>

                        {/* 5. Fecha de Registro (Ordenado más nuevo a viejo) */}
                        <td className="p-4 pr-6 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {user.isRecent && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-blue-500 text-white shadow-xs">
                                <Sparkles className="w-2.5 h-2.5" /> Nuevo
                              </span>
                            )}
                            <span className="text-xs text-slate-300 font-mono">
                              {user.fechaFormateada}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
