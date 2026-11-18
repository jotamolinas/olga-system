import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Bell, 
  CheckCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Check, 
  Calendar,
  MessageSquare
} from 'lucide-react';
import { Pagare } from '../types';
import { calcularAlertasNotariales, AlertaNotarial } from './ConfiguracionTab';
import { auth, db } from '../services/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const ALERTAS_LEIDAS_KEY = 'olga_alertas_leidas_ids';

export interface NotificationBellProps {
  pagares?: Pagare[];
  onSelectPagare?: (pagareId: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  pagares = [],
  onSelectPagare
}) => {
  const [dropdownAbierto, setDropdownAbierto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Almacenar IDs de alertas marcadas como leídas desde localStorage
  const [alertasLeidasIds, setAlertasLeidasIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(ALERTAS_LEIDAS_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });

  const [ticketsNotificados, setTicketsNotificados] = useState<any[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'support_tickets'), 
      where('userId', '==', auth.currentUser.uid),
      where('estado', 'in', ['en_proceso', 'resuelto'])
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tickets: any[] = [];
      snapshot.forEach(doc => tickets.push({ id: doc.id, ...doc.data() }));
      setTicketsNotificados(tickets);
    });
    return () => unsubscribe();
  }, []);

  // Pagarés activos: de props o de localStorage
  const pagaresEfectivos = useMemo(() => {
    if (pagares && Array.isArray(pagares) && pagares.length > 0) {
      return pagares;
    }
    try {
      const stored = localStorage.getItem('olga_pagares') || localStorage.getItem('ihara_pagares');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }, [pagares]);

  // Cálculo Dinámico en Tiempo Real de Alertas Notariales
  const alertasNotariales = useMemo(() => {
    return calcularAlertasNotariales(pagaresEfectivos, alertasLeidasIds);
  }, [pagaresEfectivos, alertasLeidasIds]);

  // Cantidad real de incidencias no leídas
  const totalAlertasNoLeidas = useMemo(() => {
    return alertasNotariales.filter(a => !a.leida).length;
  }, [alertasNotariales]);

  const totalAlertas = totalAlertasNoLeidas + ticketsNotificados.length;

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownAbierto(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const marcarTodasComoLeidas = () => {
    const allIds = alertasNotariales.map(a => a.id);
    const updated = Array.from(new Set([...alertasLeidasIds, ...allIds]));
    setAlertasLeidasIds(updated);
    try {
      localStorage.setItem(ALERTAS_LEIDAS_KEY, JSON.stringify(updated));
    } catch {}
  };

  const alternarLeidaAlerta = (alerta: AlertaNotarial) => {
    const id = alerta.id;
    let updated: string[];
    if (alertasLeidasIds.includes(id)) {
      updated = alertasLeidasIds.filter(item => item !== id);
    } else {
      updated = [...alertasLeidasIds, id];
    }
    setAlertasLeidasIds(updated);
    try {
      localStorage.setItem(ALERTAS_LEIDAS_KEY, JSON.stringify(updated));
    } catch {}

    if (onSelectPagare && alerta.pagareId) {
      onSelectPagare(alerta.pagareId);
      setDropdownAbierto(false);
    }
  };

  const restablecerLeidas = () => {
    setAlertasLeidasIds([]);
    try {
      localStorage.removeItem(ALERTAS_LEIDAS_KEY);
    } catch {}
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Botón de la Campana */}
      <button
        type="button"
        onClick={() => setDropdownAbierto(prev => !prev)}
        className="relative p-2 sm:p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white rounded-xl border border-slate-700 transition-all flex items-center justify-center shadow-sm"
        title="Centro de Alertas Notariales (Vencimientos y Cuotas)"
        aria-label="Notificaciones"
      >
        <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
        {totalAlertas > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] sm:min-w-[20px] h-4 sm:h-5 px-1 sm:px-1.5 bg-[#FF3131] text-white text-[9px] sm:text-[10px] font-black rounded-full flex items-center justify-center shadow-md animate-pulse">
            {totalAlertas}
          </span>
        )}
      </button>

      {/* Popover Desplegable Global */}
      {dropdownAbierto && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden animate-scale-in text-slate-900">
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#FF3131]" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Centro de Alertas ({totalAlertas})
              </span>
            </div>
            {totalAlertasNoLeidas > 0 && (
              <button
                type="button"
                onClick={marcarTodasComoLeidas}
                className="text-[10px] text-slate-300 hover:text-white flex items-center gap-1 font-semibold transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5 text-[#FF3131]" />
                <span>Marcar leídas</span>
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {ticketsNotificados.map(ticket => {
              const isResuelto = ticket.estado === 'resuelto';
              return (
                <div 
                  key={ticket.id} 
                  className={`p-4 border-b transition-colors ${
                    isResuelto 
                      ? 'border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50' 
                      : 'border-blue-100 bg-blue-50/60 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                      isResuelto 
                        ? 'text-emerald-700 bg-emerald-100/80 border-emerald-200' 
                        : 'text-blue-700 bg-blue-100/80 border-blue-200'
                    }`}>
                      <MessageSquare className="w-3 h-3"/> {isResuelto ? 'SOPORTE RESUELTO' : 'SOPORTE EN PROCESO'}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 mb-1">
                    Actualización sobre tu consulta
                  </h4>
                  <p className="text-[11px] leading-relaxed text-slate-700">
                    {ticket.respuestaAdmin || (isResuelto ? 'Tu consulta ha sido resuelta.' : 'Hemos recibido tu consulta y nuestro equipo ya está trabajando en ella.')}
                  </p>
                </div>
              );
            })}

            {alertasNotariales.length === 0 && ticketsNotificados.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-xs font-bold text-slate-800">No hay alertas pendientes</p>
                <p className="text-[11px] text-slate-400 max-w-[240px] mx-auto leading-relaxed">
                  Todos los pagarés y cuotas del sistema se encuentran al día y sin vencimientos en los próximos 5 días.
                </p>
              </div>
            ) : (
              alertasNotariales.map((alerta) => (
                <div
                  key={alerta.id}
                  onClick={() => alternarLeidaAlerta(alerta)}
                  className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer text-left ${
                    !alerta.leida 
                      ? (alerta.tipo === 'vencida' ? 'bg-red-50/40' : 'bg-amber-50/30') 
                      : 'opacity-70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-2 py-0.5 text-[9px] font-black uppercase rounded flex items-center gap-1 ${
                          alerta.tipo === 'vencida'
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {alerta.tipo === 'vencida' ? (
                          <>
                            <AlertTriangle className="w-3 h-3 text-red-600" />
                            <span>Cuota Vencida</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 text-amber-700" />
                            <span>Vencimiento Inminente</span>
                          </>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono font-semibold">
                        #{alerta.correlativo}
                      </span>
                    </div>

                    {!alerta.leida ? (
                      <span className="w-2 h-2 rounded-full bg-[#FF3131] shrink-0 mt-1" title="No leída" />
                    ) : (
                      <span title="Leída" className="shrink-0">
                        <Check className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                      </span>
                    )}
                  </div>

                  <span className={`text-xs font-bold block ${!alerta.leida ? 'text-slate-900' : 'text-slate-600'}`}>
                    {alerta.titulo}
                  </span>

                  <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                    {alerta.detalle}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 pt-1 border-t border-slate-100">
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {alerta.fechaVencimiento}
                    </span>
                    <span className="font-bold text-slate-800">
                      {alerta.monto.toLocaleString('es-PY')} {alerta.moneda}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center text-[10px]">
            <span className="text-slate-500 font-semibold">
              {alertasNotariales.length + ticketsNotificados.length} {alertasNotariales.length + ticketsNotificados.length === 1 ? 'incidencia detectada' : 'incidencias detectadas'}
            </span>
            {alertasLeidasIds.length > 0 && (
              <button
                type="button"
                onClick={restablecerLeidas}
                className="text-slate-500 hover:text-slate-800 font-bold uppercase transition-colors"
              >
                Restablecer leídas
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
