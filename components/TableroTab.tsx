import React, { useMemo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../services/auth';
import { Pagare, Persona, GlobalConfig, formatCurrencyValue } from '../types';
import { FileText, Users, Clock, DollarSign, Activity, ShieldCheck, ChevronRight, X, PieChartIcon, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PagaresTab } from './PagaresTab';
import { PersonasTab } from './PersonasTab';

interface TableroTabProps {
  pagares: Pagare[];
  personas: Persona[];
  config: GlobalConfig;
  onSelectPagareForPreview?: (pagare: Pagare) => void;
  onOpenDocument?: (text: string) => void;
  onAddPagare: (pagare: Pagare) => void;
  onUpdatePagare?: (pagare: Pagare) => void;
  onDeletePagare: (id: string) => void;
  onAddPersona: (persona: Persona) => boolean;
  onUpdatePersona: (persona: Persona) => void;
  onDeletePersona: (id: string) => void;
  isAdmin: boolean;
  userData?: any;
}

const CountUp: React.FC<{ end: number; duration?: number; isCurrency?: boolean }> = ({ end, duration = 1500, isCurrency = false }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress); // easeOutExpo
      setCount(Math.floor(easeProgress * end));
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };
    requestAnimationFrame(animate);
  }, [end, duration]);

  return <span>{isCurrency ? formatCurrencyValue(count, 'PYG') : count}</span>;
};

const OverlayDetails: React.FC<{
  title: string;
  icon: React.ReactNode;
  onClose: () => void;
  items: any[];
  type: 'pagares' | 'personas' | 'escritos';
  onOpenDocument?: (text: string) => void;
  onSelectPagare?: (id: string) => void;
  onSelectPersona?: (id: string) => void;
}> = ({ title, icon, onClose, items, type, onOpenDocument, onSelectPagare, onSelectPersona }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Prevent closing if a higher z-index modal is open (like Editor de Pagaré)
        const hasHigherModal = document.querySelector('.z-\\[60\\], .z-\\[100\\]');
        if (!hasHigherModal) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const portalNode = document.getElementById('main-content-viewport');
  if (!portalNode) return null;

  return createPortal(
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 md:p-8 animate-fade-in bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full box-border max-w-4xl max-h-full flex flex-col overflow-hidden animate-slide-up border border-slate-100 relative">
        <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-slate-700">
               {icon}
             </div>
             <div>
               <h3 className="text-xl font-bold font-serif text-slate-800">{title}</h3>
               <p className="text-xs font-black uppercase tracking-widest text-slate-400 mt-1">{items.length} Registros</p>
             </div>
          </div>
          <button onClick={onClose} className="p-3 bg-white hover:bg-slate-100 text-slate-500 rounded-2xl transition-colors shadow-sm">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 md:p-8 overflow-y-auto flex-grow bg-slate-50">
           {items.length === 0 ? (
             <div className="text-center py-12">
               <p className="text-slate-400 font-bold">No hay registros para mostrar.</p>
             </div>
           ) : (
             <div className="space-y-3">
               {items.map((item, idx) => (
                 <div 
                   key={idx} 
                   className={`bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between hover:shadow-md transition-all cursor-pointer hover:-translate-y-0.5 hover:bg-slate-50`}
                   onClick={() => {
                     if (type === 'escritos' && onOpenDocument && item.texto) {
                       onOpenDocument(item.texto);
                     } else if (type === 'pagares' && onSelectPagare && item.id) {
                       onSelectPagare(item.id);
                     } else if (type === 'personas' && onSelectPersona && item.id) {
                       onSelectPersona(item.id);
                     }
                   }}
                 >
                   {type === 'pagares' ? (
                     <>
                       <div>
                         <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                           <FileText className="w-4 h-4 text-blue-400" />
                           Pagaré Correlativo: {(item as Pagare).correlativo || `#${(item as Pagare).id?.slice(0,6)}`}
                         </p>
                         <p className="text-xs text-slate-500 mt-1.5 ml-6">Fecha de pago: {(item as Pagare).fecha_primer_pago || 'No definida'}</p>
                       </div>
                       <div className="text-right">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Total ({(item as Pagare).moneda})</p>
                         <p className="text-sm font-bold text-emerald-600 mt-0.5">{formatCurrencyValue((item as Pagare).valor_total || 0, (item as Pagare).moneda)}</p>
                       </div>
                     </>
                   ) : type === 'escritos' ? (
                     <>
                       <div className="flex-1 min-w-0 pr-4">
                         <p className="text-sm font-bold text-slate-800 flex items-center gap-2 truncate">
                           <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                           {item.tipo || 'Escrito'}
                         </p>
                         <p className="text-xs text-slate-500 mt-1 ml-6">
                           {item.createdAt ? new Date(item.createdAt).toLocaleDateString('es-PY') : (item.fechaCreacion?.toMillis ? new Date(item.fechaCreacion.toMillis()).toLocaleDateString('es-PY') : 'Fecha desconocida')}
                         </p>
                         <p className="text-xs text-slate-500 mt-1.5 ml-6 italic line-clamp-2">
                           {item.texto ? `"${item.texto.substring(0, 150)}..."` : 'Sin contenido de texto extraído'}
                         </p>
                       </div>
                       <div className="text-right shrink-0">
                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3 py-1.5 bg-slate-100 rounded-xl inline-block">Guardado</p>
                       </div>
                     </>
                   ) : (
                     <>
                        <div>
                         <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                           <Users className="w-4 h-4 text-emerald-400" />
                           {(item as Persona).nombre} {(item as Persona).apellido || ''}
                         </p>
                         <p className="text-xs text-slate-500 mt-1.5 ml-6">{(item as Persona).tipo_documento}: {(item as Persona).nro_documento}</p>
                       </div>
                       <div className="text-right">
                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-3 py-1.5 bg-slate-100 rounded-xl inline-block">{(item as Persona).tipo_persona}</p>
                       </div>
                     </>
                   )}
                 </div>
               ))}
             </div>
           )}
        </div>
      </div>
    </div>,
    portalNode
  );
};

export const TableroTab: React.FC<TableroTabProps> = ({ 
  pagares, 
  personas, 
  config, 
  onSelectPagareForPreview, 
  onOpenDocument,
  onAddPagare,
  onUpdatePagare,
  onDeletePagare,
  onAddPersona,
  onUpdatePersona,
  onDeletePersona,
  isAdmin,
  userData
}) => {
  const [escritos, setEscritos] = useState<any[]>([]);
  const [activeOverlay, setActiveOverlay] = useState<'pagares' | 'personas' | 'escritos' | 'valor' | 'vencimientos' | null>(null);

  const [isPagareEditorOpen, setIsPagareEditorOpen] = useState(false);
  const [editingPagareId, setEditingPagareId] = useState<string | null>(null);
  
  const [isPersonasEditorOpen, setIsPersonasEditorOpen] = useState(false);
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isPagareEditorOpen) {
          setIsPagareEditorOpen(false);
          setEditingPagareId(null);
        } else if (isPersonasEditorOpen) {
          setIsPersonasEditorOpen(false);
          setEditingPersonaId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPagareEditorOpen, isPersonasEditorOpen]);

  useEffect(() => {
    const fetchEscritos = async () => {
      try {
        if (!auth.currentUser) return;
        const isAdmin = auth.currentUser.email === 'jotamolinas@gmail.com';
        const q = isAdmin 
          ? query(collection(db, 'documentos_olga'))
          : query(collection(db, 'documentos_olga'), where('userId', '==', auth.currentUser.uid));
        const querySnapshot = await getDocs(q);
        const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        docs.sort((a: any, b: any) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : (a.fechaCreacion?.toMillis?.() || 0);
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : (b.fechaCreacion?.toMillis?.() || 0);
          return bTime - aTime;
        });
        setEscritos(docs);
      } catch (err) {
        console.error("Error fetching documentos_olga", err);
      }
    };
    fetchEscritos();
  }, []);

  const { totalPagares, pagaresAnulados, personasActivas, totalValorNotariado } = useMemo(() => {
    const totalPagares = pagares.length;
    const pagaresAnulados = pagares.filter(p => p.status === 'anulado').length;
    
    // Contamos personas que están envueltas en al menos un pagaré como deudores o acreedores
    const personasActivas = personas.length;

    // Registros pendientes: Pagarés donde falte vincular el acreedor o el deudor
    // Total valor notariado
    const totalValorNotariado = pagares.reduce((sum, p) => p.status !== 'anulado' ? sum + p.valor_total : sum, 0);

    return { totalPagares, pagaresAnulados, personasActivas, totalValorNotariado };
  }, [pagares, personas]);

  const pagaresProximosAVencer = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date();
    targetDate.setDate(today.getDate() + 7);
    targetDate.setHours(23, 59, 59, 999);

    return pagares.filter(p => {
      if (p.estado === 'Cobrado') return false;

      // Usamos el cronograma si está disponible
      if (p.cronograma && p.cronograma.length > 0) {
        return p.cronograma.some(c => {
          if ((c as any).estado === 'cobrado' || (c as any).pagado === true) return false;
          if (!c.fecha_pag) return false;
          const d = new Date(c.fecha_pag + "T12:00:00");
          return d >= today && d <= targetDate;
        });
      } else if (p.fecha_primer_pago) {
        const d = new Date(p.fecha_primer_pago + "T12:00:00");
        return d >= today && d <= targetDate;
      }
      return false;
    });
  }, [pagares]);

  const chartData = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const recentPagares = pagares.filter(p => {
      if (!p.created_at) return true; // Fallback
      const createdAt = new Date(p.created_at);
      return createdAt >= thirtyDaysAgo;
    });

    const stateCount = {
      Pendiente: 0,
      Cobrado: 0,
      Vencido: 0,
      Anulado: 0
    };

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    recentPagares.forEach(pag => {
      if (pag.status === 'anulado' || pag.estado === 'Anulado') {
        stateCount.Anulado += (pag.cronograma?.length || 1);
        return;
      }

      if (pag.cronograma && pag.cronograma.length > 0) {
        pag.cronograma.forEach((cuota) => {
          // Compatibility with any 'estado' or 'pagado' field in cuota, 
          // or if the whole pagare is 'cobrado', we assume all its cuotas are paid.
          if ((cuota as any).estado === 'cobrado' || (cuota as any).pagado === true) {
            stateCount.Cobrado++;
          } else {
            const rawDate = (cuota as any).fecha_vencimiento || (cuota as any).fecha || cuota.fecha_pag;
            const cDate = new Date(rawDate);
            if (typeof rawDate === 'string') {
               const parts = rawDate.split('-');
               if (parts.length === 3) {
                 cDate.setFullYear(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
               }
            }
            cDate.setHours(0, 0, 0, 0);

            if (cDate.getTime() < hoy.getTime()) {
              stateCount.Vencido++;
            } else {
              stateCount.Pendiente++;
            }
          }
        });
      } else {
        // Pago Único
        if (pag.status === 'cobrado' || pag.estado === 'Cobrado') {
          stateCount.Cobrado++;
        } else {
          let rawDate = (pag as any).fecha_vencimiento || (pag as any).fecha || pag.fecha_primer_pago;
          const cDate = new Date(rawDate || new Date());
          if (typeof rawDate === 'string') {
             const parts = rawDate.split('-');
             if (parts.length === 3) {
               cDate.setFullYear(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
             }
          }
          cDate.setHours(0, 0, 0, 0);

          if (cDate.getTime() < hoy.getTime()) {
            stateCount.Vencido++;
          } else {
            stateCount.Pendiente++;
          }
        }
      }
    });

    return [
      { name: 'Pendiente', value: stateCount.Pendiente, color: '#3b82f6' }, // Blue
      { name: 'Cobrado', value: stateCount.Cobrado, color: '#10b981' }, // Emerald
      { name: 'Vencido', value: stateCount.Vencido, color: '#ef4444' }, // Red
      { name: 'Anulado', value: stateCount.Anulado, color: '#94a3b8' } // Slate
    ];
  }, [pagares]);

  return (
    <div className="w-full box-border flex flex-col gap-8 w-full animate-fade-in pb-12">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="relative z-10 text-center md:text-left w-full box-border">
          <h2 className="text-white text-xl md:text-2xl font-black font-serif flex items-center justify-center md:justify-start gap-3">
            <Activity className="w-6 h-6 text-blue-400" />
            Tablero Principal
          </h2>
          <p className="text-slate-400 text-xs md:text-sm mt-1 max-w-sm mx-auto md:mx-0">
            Resumen de actividad y volumen notariado de {config.escribania.nombre}.
          </p>
        </div>
      </div>

      {pagaresProximosAVencer.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-[2rem] p-6 shadow-sm flex items-start md:items-center gap-4 animate-fade-in relative overflow-hidden">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-amber-800 font-bold text-lg">Próximos Vencimientos</h3>
            <p className="text-amber-700/80 text-sm mt-0.5">
              Hay <span className="font-black text-amber-600">{pagaresProximosAVencer.length} pagaré(s)</span> con fecha de vencimiento en los próximos 7 días.
            </p>
          </div>
          <button 
            onClick={() => setActiveOverlay('vencimientos')} 
            className="hidden md:flex bg-white text-amber-700 border border-amber-200 hover:bg-amber-100 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest items-center gap-2 transition-colors"
          >
            Ver Detalles <ChevronRight className="w-3 h-3" />
          </button>
          
          <button 
            onClick={() => setActiveOverlay('vencimientos')} 
            className="md:hidden absolute inset-0 w-full box-border h-full opacity-0"
          >
            Ver Detalles
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="group relative bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex flex-col gap-4 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
          <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center shadow-inner transition-transform duration-300 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Total Pagarés</p>
            <p className="text-3xl font-black text-slate-800 flex items-baseline gap-2">
              <CountUp end={totalPagares} />
              {pagaresAnulados > 0 && <span className="text-sm font-bold text-slate-400">({pagaresAnulados} ANULADOS)</span>}
            </p>
          </div>
          <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <button onClick={() => setActiveOverlay('pagares')} className="bg-white text-slate-900 border border-slate-200 shadow-xl px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300 hover:bg-slate-50">
              Ver Detalles <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="group relative bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex flex-col gap-4 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center shadow-inner transition-transform duration-300 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Personas Activas</p>
            <p className="text-3xl font-black text-slate-800"><CountUp end={personasActivas} /></p>
          </div>
          <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <button onClick={() => setActiveOverlay('personas')} className="bg-white text-slate-900 border border-slate-200 shadow-xl px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300 hover:bg-slate-50">
              Ver Detalles <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="group relative bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex flex-col gap-4 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
          <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center shadow-inner transition-transform duration-300 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Escritos Guardados</p>
            <p className="text-3xl font-black text-slate-800"><CountUp end={escritos.length} /></p>
          </div>
          <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <button onClick={() => setActiveOverlay('escritos')} className="bg-white text-slate-900 border border-slate-200 shadow-xl px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300 hover:bg-slate-50">              Ver Detalles <ChevronRight className="w-3 h-3" />            </button>
          </div>
        </div>

        <div className="group relative bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex flex-col gap-4 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center shadow-inner transition-transform duration-300 group-hover:scale-110 group-hover:bg-indigo-500 group-hover:text-white">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Total Valor Notariado</p>
            <p className="text-3xl font-black text-slate-800">
              Gs. <CountUp end={totalValorNotariado} isCurrency={true} />
            </p>
          </div>
          <div className="absolute inset-0 bg-slate-900/5 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <button onClick={() => setActiveOverlay('valor')} className="bg-white text-slate-900 border border-slate-200 shadow-xl px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300 hover:bg-slate-50">
              Ver Detalles <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Resumen de Estado de Pagarés (30 días) */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 md:p-8 flex flex-col md:flex-row gap-8">
        <div className="flex flex-col flex-1 gap-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <PieChartIcon className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">Estado de Pagarés</h3>
          </div>
          <p className="text-slate-500 text-sm leading-relaxed max-w-md">
            Distribución de los pagarés registrados en los últimos 30 días según su estado operativo (Pendiente, Cobrado, Vencido, Anulado).
          </p>
          
          <div className="mt-4 flex flex-col gap-3">
            {chartData.map(entry => (
              <div key={entry.name} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-sm font-bold text-slate-700 flex-1">{entry.name}</span>
                <span className="text-sm font-black text-slate-900">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex-1 h-[300px] w-full box-border min-w-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      
      {/* Últimos Registros */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-xl font-bold font-serif text-slate-800">Gestión de Escritos (O.L.G.A.)</h3>
        </div>
        <div className="p-6 md:p-8">
          <div className="space-y-4">
            {escritos.slice(0, 10).map((escrito, idx) => {
              const previewText = escrito.texto ? escrito.texto.substring(0, 80) + '...' : '';
              let dateStr = 'Fecha desconocida';
              if (escrito.createdAt) {
                 dateStr = new Date(escrito.createdAt).toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
              } else if (escrito.fechaCreacion && typeof escrito.fechaCreacion.toMillis === 'function') {
                 dateStr = new Date(escrito.fechaCreacion.toMillis()).toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
              }
              
              return (
                <div 
                  key={escrito.id || idx}
                  className="p-4 rounded-2xl border bg-white border-slate-100 shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-blue-50 text-blue-600">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800">
                        {escrito.tipo || 'Documento Generado'}
                      </h4>
                      <div className="text-xs text-slate-500 mt-1 max-w-[200px] md:max-w-md truncate">
                        {previewText}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between md:flex-col md:items-end gap-1">
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {dateStr}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                      Guardado
                    </span>
                  </div>
                </div>
              );
            })}
            {escritos.length === 0 && (
              <div className="text-center py-8 text-slate-400 font-bold text-sm">
                Aún no hay documentos generados por O.L.G.A.
              </div>
            )}
          </div>
        </div>
      </div>

      {activeOverlay === 'pagares' && (
        <OverlayDetails 
          title="Listado de Pagarés"
          icon={<FileText className="w-6 h-6" />}
          onClose={() => setActiveOverlay(null)}
          items={pagares}
          type="pagares"
          onSelectPagare={(id) => {
            setEditingPagareId(id);
            setIsPagareEditorOpen(true);
          }}
        />
      )}

      {activeOverlay === 'personas' && (
        <OverlayDetails 
          title="Personas Registradas"
          icon={<Users className="w-6 h-6" />}
          onClose={() => setActiveOverlay(null)}
          items={personas}
          type="personas"
          onSelectPersona={(id) => {
            setEditingPersonaId(id);
            setIsPersonasEditorOpen(true);
          }}
        />
      )}

      {activeOverlay === 'escritos' && (
        <OverlayDetails 
          title="Escritos Guardados"
          icon={<Clock className="w-6 h-6" />}
          onClose={() => setActiveOverlay(null)}
          items={escritos}
          type="escritos"
          onOpenDocument={onOpenDocument}
        />
      )}
      {activeOverlay === 'valor' && (
        <OverlayDetails 
          title="Pagarés por Valor Notariado"
          icon={<DollarSign className="w-6 h-6" />}
          onClose={() => setActiveOverlay(null)}
          items={[...pagares].filter(p => p.status !== 'anulado').sort((a, b) => b.valor_total - a.valor_total)}
          type="pagares"
          onSelectPagare={(id) => {
            setEditingPagareId(id);
            setIsPagareEditorOpen(true);
          }}
        />
      )}
      {activeOverlay === 'vencimientos' && (
        <OverlayDetails 
          title="Próximos Vencimientos (7 días)"
          icon={<AlertTriangle className="w-6 h-6" />}
          onClose={() => setActiveOverlay(null)}
          items={pagaresProximosAVencer}
          type="pagares"
          onSelectPagare={(id) => {
            setEditingPagareId(id);
            setIsPagareEditorOpen(true);
          }}
        />
      )}

      {isPagareEditorOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm animate-fade-in flex flex-col">
          <div className="flex-1 bg-slate-50 overflow-y-auto">
            <div className="max-w-7xl mx-auto p-4 md:p-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold font-serif text-slate-800">Editor de Pagaré</h2>
                <button 
                  onClick={() => { setIsPagareEditorOpen(false); setEditingPagareId(null); }}
                  className="p-2 bg-white rounded-xl shadow-sm text-slate-500 hover:text-slate-800 border border-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <PagaresTab
                pagares={pagares}
                personas={personas}
                config={config}
                onAddPagare={onAddPagare}
                onUpdatePagare={onUpdatePagare}
                onDeletePagare={onDeletePagare}
                onAddPersona={onAddPersona}
                onSelectPagareForPreview={onSelectPagareForPreview!}
                isAdmin={isAdmin}
                userData={userData}
                initialPanelView="create"
                initialEditingId={editingPagareId}
                onClose={() => { setIsPagareEditorOpen(false); setEditingPagareId(null); }}
              />
            </div>
          </div>
        </div>
      )}

      {isPersonasEditorOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm animate-fade-in flex flex-col">
          <div className="flex-1 bg-slate-50 overflow-y-auto">
            <div className="max-w-7xl mx-auto p-4 md:p-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold font-serif text-slate-800">Fichero de Personas</h2>
                <button 
                  onClick={() => { setIsPersonasEditorOpen(false); setEditingPersonaId(null); }}
                  className="p-2 bg-white rounded-xl shadow-sm text-slate-500 hover:text-slate-800 border border-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <PersonasTab
                personas={personas}
                onAddPersona={onAddPersona}
                onUpdatePersona={onUpdatePersona}
                onDeletePersona={onDeletePersona}
                isAdmin={isAdmin}
                initialEditingId={editingPersonaId}
                onClose={() => { setIsPersonasEditorOpen(false); setEditingPersonaId(null); }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
