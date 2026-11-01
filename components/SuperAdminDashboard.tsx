import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/auth';
import { SuperAdminOnboarding } from './SuperAdminOnboarding';
import { 
  KeyRound, CheckCircle, XCircle, AlertTriangle, Users, FileText, 
  Activity, ExternalLink, ShieldCheck, ShieldAlert, Shield, 
  Search, DollarSign, Mail, Phone, Clock, Sparkles, Crown,
  Building, Zap, CheckCircle2, UserCheck, ShieldQuestion
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area
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
  const [adminSubTab, setAdminSubTab] = useState<'metricas' | 'onboarding'>('metricas');
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
    <div className="min-h-full bg-[#09090b] text-gray-200 -m-4 md:-m-8 p-4 md:p-8 animate-fade-in w-auto">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <Activity className="w-6 h-6 text-blue-400" />
              Monitor Central
            </h1>
            <p className="text-xs text-gray-400 mt-1">Super Admin • Métricas, emisión y auditoría en tiempo real.</p>
          </div>

          {/* Switcher de Subpestañas Superadmin */}
          <div className="inline-flex items-center bg-[#121214] border border-white/5 rounded-xl p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setAdminSubTab('metricas')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                adminSubTab === 'metricas'
                  ? 'bg-white/10 text-white shadow-xs'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              Métricas
            </button>
            <button
              type="button"
              onClick={() => setAdminSubTab('onboarding')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                adminSubTab === 'onboarding'
                  ? 'bg-white/10 text-white shadow-xs'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              Onboarding SIFEN
            </button>
          </div>
        </div>

        {adminSubTab === 'onboarding' ? (
          <SuperAdminOnboarding />
        ) : (
          <>
            {/* 1. Top KPIs (Grid de 4) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Usuarios Totales */}
              <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">Usuarios Totales</span>
                  <div className="p-1.5 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <Users className="w-4 h-4 text-blue-400" />
                  </div>
                </div>
                <div>
                  {loading ? (
                    <div className="h-8 w-20 bg-zinc-800/60 rounded animate-pulse"></div>
                  ) : (
                    <p className="text-3xl font-light text-white mt-1">{metrics.totalUsers}</p>
                  )}
                </div>
              </div>

              {/* Card 2: Pagarés Emitidos */}
              <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">Pagarés Emitidos</span>
                  <div className="p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <FileText className="w-4 h-4 text-emerald-400" />
                  </div>
                </div>
                <div>
                  {loading ? (
                    <div className="h-8 w-20 bg-zinc-800/60 rounded animate-pulse"></div>
                  ) : (
                    <p className="text-3xl font-light text-white mt-1">{metrics.totalPagares}</p>
                  )}
                </div>
              </div>

              {/* Card 3: Consultas IA */}
              <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">Consultas IA</span>
                  <div className="p-1.5 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <Activity className="w-4 h-4 text-purple-400" />
                  </div>
                </div>
                <div>
                  {loading ? (
                    <div className="h-8 w-20 bg-zinc-800/60 rounded animate-pulse"></div>
                  ) : (
                    <p className="text-3xl font-light text-white mt-1">{metrics.aiQueries}</p>
                  )}
                </div>
              </div>

              {/* Card 4: Pagos Pendientes */}
              <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">Pagos Pendientes</span>
                  <div className="p-1.5 bg-orange-500/10 rounded-lg border border-orange-500/20">
                    <AlertTriangle className="w-4 h-4 text-orange-400" />
                  </div>
                </div>
                <div>
                  {loadingPayments ? (
                    <div className="h-8 w-20 bg-zinc-800/60 rounded animate-pulse"></div>
                  ) : (
                    <p className={`text-3xl font-light mt-1 ${pendingPayments.length > 0 ? 'text-orange-400' : 'text-white'}`}>
                      {pendingPayments.length}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Gráficos (Grid de 2) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              {/* Emisión de Pagarés */}
              <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-4 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-blue-400" /> Emisión de Pagarés (Últimos 6 Meses)
                  </span>
                </div>
                <div className="h-60 bg-transparent">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid stroke="#27272a" vertical={false} strokeOpacity={0.4} />
                      <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip 
                        cursor={{ fill: '#27272a', opacity: 0.3 }}
                        contentStyle={{ backgroundColor: '#18181b', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '12px', color: '#f4f4f5', fontSize: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}
                      />
                      <Bar dataKey="cantidad" fill="#3b82f6" barSize={18} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Volumen Notariado */}
              <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-4 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Volumen Notariado (Gs)
                  </span>
                </div>
                <div className="h-60 bg-transparent">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={lineData} margin={{ top: 5, right: 5, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="volumenGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#27272a" vertical={false} strokeOpacity={0.4} />
                      <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#71717a" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#18181b', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '12px', color: '#f4f4f5', fontSize: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}
                        formatter={(value: number) => [`Gs ${value.toLocaleString('es-PY')}`, 'Volumen']}
                      />
                      <Area type="monotone" dataKey="volumen" stroke="#10b981" strokeWidth={2} fill="url(#volumenGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* 3. División de Listas (Izquierda y Derecha) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
              {/* Columna Izquierda: Usuarios Activos */}
              <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-4 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-blue-400" /> Usuarios Activos & Registrados
                  </span>
                  <span className="text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-full font-mono">
                    {registeredUsers.length} total
                  </span>
                </div>

                <div className="max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 pr-1">
                  {loadingUsers ? (
                    <div className="p-8 flex justify-center items-center">
                      <div className="w-6 h-6 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                    </div>
                  ) : registeredUsers.length === 0 ? (
                    <div className="py-8 text-center text-xs text-gray-500">
                      No hay usuarios registrados aún.
                    </div>
                  ) : (
                    registeredUsers.map((user) => {
                      const inicial = (user.nombre || user.razonSocial || user.email || 'U').charAt(0).toUpperCase();
                      const nombreDisplay = user.razonSocial || user.nombre || user.email;
                      const subInfo = user.email || user.telefono || '';
                      const isActivo = user.estadoSuscripcion === 'activo';
                      const isPrueba = user.estadoSuscripcion === 'prueba';
                      const isPendiente = user.estadoSuscripcion === 'pendiente';

                      return (
                        <div key={user.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] px-2 rounded-lg transition-colors">
                          <div className="flex items-center gap-3 min-w-0 mr-3">
                            <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-medium text-gray-300 shrink-0">
                              {inicial}
                            </div>
                            <div className="min-w-0 truncate">
                              <p className="text-sm text-gray-200 font-medium truncate">{nombreDisplay}</p>
                              <p className="text-xs text-gray-500 truncate">{subInfo}</p>
                            </div>
                          </div>
                          <div className="shrink-0">
                            {isActivo ? (
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full font-medium border border-emerald-500/20">
                                Activo
                              </span>
                            ) : isPrueba ? (
                              <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded-full font-medium border border-cyan-500/20">
                                Prueba ({user.diasRestantes ?? 5}d)
                              </span>
                            ) : isPendiente ? (
                              <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-1 rounded-full font-medium border border-amber-500/20">
                                Pendiente
                              </span>
                            ) : (
                              <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-1 rounded-full font-medium border border-red-500/20">
                                Vencido
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Columna Derecha: Emisión de Pagarés */}
              <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-4 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" /> Emisión Reciente de Pagarés
                  </span>
                  <span className="text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-full font-mono">
                    {pagaresGlobal.length} docs
                  </span>
                </div>

                <div className="max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 pr-1">
                  {loading ? (
                    <div className="p-8 flex justify-center items-center">
                      <div className="w-6 h-6 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                    </div>
                  ) : pagaresGlobal.length === 0 ? (
                    <div className="py-8 text-center text-xs text-gray-500">
                      No hay pagarés registrados aún.
                    </div>
                  ) : (
                    pagaresGlobal.map((pagare) => {
                      const emisor = pagare.empresa || pagare.acreedor_nombre || pagare.userEmail || 'Emisor';
                      const fecha = pagare.fecha_emision || 'Fecha no registrada';
                      const montoFormatted = typeof pagare.monto === 'number' 
                        ? `Gs. ${pagare.monto.toLocaleString('es-PY')}` 
                        : pagare.monto;

                      return (
                        <div 
                          key={pagare.id} 
                          onClick={() => handleAuditoria(pagare)}
                          className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] px-2 rounded-lg transition-colors cursor-pointer group"
                          title="Click para auditar detalle"
                        >
                          <div className="min-w-0 mr-3">
                            <p className="text-sm text-gray-200 font-medium truncate group-hover:text-emerald-400 transition-colors">
                              {emisor}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                              <span>{fecha}</span>
                              {pagare.deudor_nombre && (
                                <>
                                  <span>•</span>
                                  <span className="truncate max-w-[140px] text-gray-400">{pagare.deudor_nombre}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="text-sm font-medium text-white font-mono">
                              {montoFormatted}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* 4. Comprobantes Pendientes de Aprobación */}
            {pendingPayments.length > 0 && (
              <div className="bg-[#121214] border border-white/5 rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] mt-6">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-4 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-orange-400" /> Comprobantes Pendientes de Aprobación ({pendingPayments.length})
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full box-border text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                        <th className="py-3 px-4">Cliente</th>
                        <th className="py-3 px-4">Fecha</th>
                        <th className="py-3 px-4">Plan Solicitado</th>
                        <th className="py-3 px-4 text-center">Comprobante</th>
                        <th className="py-3 px-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {pendingPayments.map((cliente) => (
                        <tr key={cliente.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-medium text-white text-sm">{cliente.nombreCliente}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{cliente.email}</p>
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-400">
                            {formatDate(cliente.fechaSolicitud)}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {cliente.planSolicitado}
                            </span>
                            <span className="block text-[11px] text-gray-500 mt-0.5">{cliente.modalidadPago} (Gs. {cliente.montoAPagar.toLocaleString('es-PY')})</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {cliente.urlComprobante ? (
                              <button 
                                onClick={() => setReciboSeleccionado(cliente.urlComprobante)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-blue-400 font-medium text-xs rounded-xl transition-colors border border-white/10"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Ver
                              </button>
                            ) : (
                              <span className="text-xs text-gray-500 italic">Sin archivo</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <button
                              onClick={() => handleAprobar(cliente.id, cliente.planSolicitado || '')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white font-medium text-xs rounded-xl transition-all border border-emerald-500/20"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Aprobar
                            </button>
                            <button
                              onClick={() => handleRechazar(cliente.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white font-medium text-xs rounded-xl transition-all border border-rose-500/20"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Rechazar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* Modal Recibo */}
        {reciboSeleccionado && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="relative max-w-4xl max-h-screen overflow-hidden flex flex-col items-center justify-center bg-[#121214] border border-white/10 rounded-2xl p-4">
              <button
                onClick={() => setReciboSeleccionado(null)}
                className="absolute top-4 right-4 bg-zinc-900/80 hover:bg-zinc-800 text-white p-2 rounded-full transition-colors z-10 border border-white/10"
                aria-label="Cerrar modal"
              >
                <XCircle className="w-5 h-5" />
              </button>
              <img 
                src={reciboSeleccionado} 
                alt="Comprobante de Pago" 
                className="max-w-full box-border max-h-[85vh] object-contain rounded-xl shadow-2xl" 
              />
            </div>
          </div>
        )}

        {/* Modal Auditoría */}
        {auditoriaSeleccionada && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#121214] border border-white/10 rounded-2xl w-full box-border max-w-2xl overflow-hidden shadow-2xl flex flex-col">
              <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#09090b]/50">
                <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                  {renderRiesgoIcon(auditoriaSeleccionada.reporte.riesgo)}
                  Reporte de Auditoría IA
                </h2>
                <button
                  onClick={() => setAuditoriaSeleccionada(null)}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[70vh] space-y-5">
                <div className="bg-[#09090b] p-4 rounded-xl border border-white/5">
                  <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-3">Nivel de Riesgo Detectado</h3>
                  <div className="flex items-center gap-4">
                    {renderRiesgoBadge(auditoriaSeleccionada.reporte.riesgo)}
                    {auditoriaSeleccionada.reporte.riesgo === 'Normal' ? (
                      <p className="text-xs text-gray-400">El documento cumple con los parámetros habituales de la plataforma. No se detectaron anomalías estructurales.</p>
                    ) : (
                      <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
                        {auditoriaSeleccionada.reporte.razones.map((razon, i) => (
                          <li key={i} className={auditoriaSeleccionada.reporte.riesgo === 'Critico' ? 'text-red-400 font-medium' : 'text-yellow-400 font-medium'}>{razon}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#09090b] p-4 rounded-xl border border-white/5">
                    <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Datos del Emisor</h3>
                    <p className="text-sm font-semibold text-gray-200">{auditoriaSeleccionada.pagare.acreedor_nombre || 'N/A'}</p>
                    <p className="text-xs text-gray-500">{auditoriaSeleccionada.pagare.userEmail}</p>
                  </div>
                  <div className="bg-[#09090b] p-4 rounded-xl border border-white/5">
                    <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Datos del Deudor</h3>
                    <p className="text-sm font-semibold text-gray-200">{auditoriaSeleccionada.pagare.deudor_nombre || 'N/A'}</p>
                    <p className="text-xs font-mono text-gray-500">CI/RUC: {auditoriaSeleccionada.pagare.deudor_cedula || 'N/A'}</p>
                  </div>
                </div>

                <div className="bg-[#09090b] p-4 rounded-xl border border-white/5 grid grid-cols-3 gap-4">
                  <div>
                    <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Monto</h3>
                    <p className="text-sm font-mono font-semibold text-white">
                      {typeof auditoriaSeleccionada.pagare.monto === 'number' ? `Gs. ${auditoriaSeleccionada.pagare.monto.toLocaleString('es-PY')}` : auditoriaSeleccionada.pagare.monto}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Emisión</h3>
                    <p className="text-sm text-gray-300">{auditoriaSeleccionada.pagare.fecha_emision || 'N/A'}</p>
                  </div>
                  <div>
                    <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Vencimiento</h3>
                    <p className="text-sm text-gray-300">{auditoriaSeleccionada.pagare.fecha_vencimiento || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-white/5 bg-[#09090b]/50 flex justify-end gap-3">
                <button
                  onClick={() => setAuditoriaSeleccionada(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cerrar Reporte
                </button>
                {(auditoriaSeleccionada.reporte.riesgo === 'Sospechoso' || auditoriaSeleccionada.reporte.riesgo === 'Critico') && (
                  <button
                    onClick={() => {
                      alert('Usuario bloqueado por prevención de fraude.');
                      setAuditoriaSeleccionada(null);
                    }}
                    className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-red-900/20"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    Bloquear Usuario (Posible Fraude)
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
