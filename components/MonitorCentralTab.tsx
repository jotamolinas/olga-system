import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/auth';
import { Pagare, formatCurrencyValue } from '../types';
import { Search, AlertTriangle, FileText, DollarSign, Calendar, ShieldCheck, ShieldAlert, Shield, Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface UserData {
  id: string;
  nombre?: string;
  razonSocial?: string;
  email?: string;
  phoneNumber?: string;
}

interface EnrichedPagare extends Pagare {
  user?: UserData;
  riesgo: 'Seguro' | 'Sospechoso' | 'Peligro';
  colorRiesgo: string;
}

export const MonitorCentralTab: React.FC = () => {
  const [pagares, setPagares] = useState<EnrichedPagare[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | '7days' | '30days'>('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const usersMap: Record<string, UserData> = {};
        usersSnap.forEach(doc => {
          usersMap[doc.id] = { id: doc.id, ...doc.data() } as UserData;
        });

        const pagaresSnap = await getDocs(collection(db, 'pagares'));
        const pagaresRaw: Pagare[] = [];
        pagaresSnap.forEach(doc => {
          pagaresRaw.push({ id: doc.id, ...doc.data() } as Pagare);
        });

        const userIdCounts: Record<string, number> = {};
        pagaresRaw.forEach(p => {
          if (p.userId) {
            userIdCounts[p.userId] = (userIdCounts[p.userId] || 0) + 1;
          }
        });

        const enriched = pagaresRaw.map(p => {
          const user = p.userId ? usersMap[p.userId] : undefined;
          let riesgo: 'Seguro' | 'Sospechoso' | 'Peligro' = 'Seguro';
          let colorRiesgo = 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';

          const monto = p.valor_total || 0;
          const faltaDocumento = !p.deudor_documento_raw || p.deudor_documento_raw.trim() === '';
          const userCount = p.userId ? userIdCounts[p.userId] : 0;

          if (monto > 50000000 || faltaDocumento) {
            riesgo = 'Peligro';
            colorRiesgo = 'text-red-400 bg-red-400/10 border-red-400/20';
          } else if (userCount > 3) {
            riesgo = 'Sospechoso';
            colorRiesgo = 'text-amber-400 bg-amber-400/10 border-amber-400/20';
          }

          return { ...p, user, riesgo, colorRiesgo };
        });

        // Sort by date desc
        enriched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setPagares(enriched);
      } catch (error) {
        console.error("Error fetching monitor data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredPagares = useMemo(() => {
    let filtered = pagares;

    // Filter by search
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(p => {
        const issuerName = (p.user?.razonSocial || p.user?.nombre || p.acreedor_nombre_raw || '').toLowerCase();
        const deudorDoc = (p.deudor_documento_raw || '').toLowerCase();
        const deudorName = (p.deudor_nombre_raw || '').toLowerCase();
        return issuerName.includes(lowerSearch) || deudorDoc.includes(lowerSearch) || deudorName.includes(lowerSearch);
      });
    }

    // Filter by date
    if (dateFilter !== 'all') {
      const now = new Date().getTime();
      const days = dateFilter === '7days' ? 7 : 30;
      const msThreshold = days * 24 * 60 * 60 * 1000;
      filtered = filtered.filter(p => {
        if (!p.created_at) return false;
        const pDate = new Date(p.created_at).getTime();
        return (now - pDate) <= msThreshold;
      });
    }

    return filtered;
  }, [pagares, searchTerm, dateFilter]);

  // KPIs
  const totalVolume = filteredPagares.reduce((sum, p) => sum + (p.valor_total || 0), 0);
  const totalAlerts = filteredPagares.filter(p => p.riesgo === 'Peligro' || p.riesgo === 'Sospechoso').length;

  // Chart 1: Volume by date
  const chart1Data = useMemo(() => {
    const datesMap: Record<string, number> = {};
    const daysToLookBack = dateFilter === '7days' ? 7 : (dateFilter === '30days' ? 30 : 14); // default 14 for 'all' to not clutter
    
    // Initialize last N days
    for (let i = daysToLookBack - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      datesMap[dateStr] = 0;
    }

    filteredPagares.forEach(p => {
      if (!p.created_at) return;
      const dateStr = p.created_at.split('T')[0];
      if (datesMap[dateStr] !== undefined) {
        datesMap[dateStr]++;
      }
    });

    return Object.keys(datesMap).map(date => {
      const [, month, day] = date.split('-');
      return {
        name: `${day}/${month}`,
        cantidad: datesMap[date]
      };
    });
  }, [filteredPagares, dateFilter]);

  // Chart 2: Risk distribution
  const chart2Data = useMemo(() => {
    let safe = 0;
    let suspect = 0;
    let danger = 0;

    filteredPagares.forEach(p => {
      if (p.riesgo === 'Seguro') safe++;
      else if (p.riesgo === 'Sospechoso') suspect++;
      else if (p.riesgo === 'Peligro') danger++;
    });

    return [
      { name: 'Seguros', value: safe, color: '#34d399' },
      { name: 'Sospechosos', value: suspect, color: '#fbbf24' },
      { name: 'Peligro', value: danger, color: '#f87171' }
    ];
  }, [filteredPagares]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-slate-400 font-mono text-sm">Analizando base de datos central...</p>
      </div>
    );
  }

  return (
    <div className="w-full box-border max-w-7xl mx-auto space-y-6 text-slate-200">
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <h2 className="text-2xl font-bold font-serif text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-500" />
            Monitor Central
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Supervisión global de operaciones y prevención de fraude.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full box-border md:w-auto">
          <div className="relative w-full box-border sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input  
              type="text" 
              placeholder="Buscar emisor o CI/RUC..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full box-border pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>
          <select 
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="w-full box-border sm:w-auto px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="all">Todo el Historial</option>
            <option value="7days">Últimos 7 días</option>
            <option value="30days">Últimos 30 días</option>
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex items-center gap-4 shadow-lg">
          <div className="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Pagarés</p>
            <p className="text-2xl font-black text-white">{filteredPagares.length}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex items-center gap-4 shadow-lg">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Volumen Notariado</p>
            <p className="text-2xl font-black text-white">{formatCurrencyValue(totalVolume)} <span className="text-sm font-medium text-slate-500">PYG</span></p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex items-center gap-4 shadow-lg">
          <div className="w-12 h-12 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Alertas Activas</p>
            <p className="text-2xl font-black text-white">{totalAlerts}</p>
          </div>
        </div>
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-lg">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">Emisión de Pagarés (Días)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart1Data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
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

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-lg">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">Distribución de Riesgo</h3>
          <div className="h-64 flex justify-center items-center">
            {filteredPagares.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chart2Data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {chart2Data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#f1f5f9' }}
                    itemStyle={{ color: '#e2e8f0' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-500">No hay datos suficientes.</p>
            )}
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Seguimiento de Documentos</h3>
          <div className="text-xs text-slate-500 bg-slate-950 px-3 py-1 rounded-full border border-slate-800">
            Mostrando {filteredPagares.length} registros
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full box-border text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/50">
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">Fecha</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">Emisor</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">Deudor</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">Monto (PYG)</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800">Riesgo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredPagares.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 text-sm">
                    No se encontraron documentos con los filtros actuales.
                  </td>
                </tr>
              ) : (
                filteredPagares.map(p => (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 align-middle">
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        {new Date(p.created_at).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="font-bold text-slate-200 text-sm">{p.user?.razonSocial || p.user?.nombre || p.acreedor_nombre_raw || 'Emisor Desconocido'}</div>
                      {(p.user?.email || p.user?.phoneNumber) && (
                        <div className="text-xs text-slate-500 mt-0.5">{p.user?.email || p.user?.phoneNumber}</div>
                      )}
                    </td>
                    <td className="p-4 align-middle">
                      <div className="font-bold text-slate-200 text-sm">{p.deudor_nombre_raw || 'Sin Nombre'}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{p.deudor_documento_raw ? `Doc: ${p.deudor_documento_raw}` : 'Sin Documento'}</div>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="font-mono text-sm text-slate-300">{formatCurrencyValue(p.valor_total)}</div>
                    </td>
                    <td className="p-4 align-middle">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${p.colorRiesgo}`}>
                        {p.riesgo === 'Seguro' && <ShieldCheck className="w-3.5 h-3.5" />}
                        {p.riesgo === 'Sospechoso' && <AlertTriangle className="w-3.5 h-3.5" />}
                        {p.riesgo === 'Peligro' && <ShieldAlert className="w-3.5 h-3.5" />}
                        {p.riesgo}
                      </span>
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
