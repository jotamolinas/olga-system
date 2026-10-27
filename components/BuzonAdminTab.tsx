import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/auth';
import { Mail, CheckCircle2, Circle, Clock, MessageSquare } from 'lucide-react';

interface Ticket {
  id: string;
  id_usuario: string;
  nombre_usuario: string;
  email?: string;
  telefono?: string;
  asunto: string;
  mensaje: string;
  estado: 'pendiente' | 'leido' | 'resuelto';
  fecha_creacion: number;
}

interface BuzonAdminTabProps {
  esPlanFull?: boolean;
}

export const BuzonAdminTab: React.FC<BuzonAdminTabProps> = ({ esPlanFull = false }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'support_tickets'), orderBy('fecha_creacion', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ticketsData: Ticket[] = [];
      snapshot.forEach((docSnap) => {
        ticketsData.push({ id: docSnap.id, ...docSnap.data() } as Ticket);
      });
      setTickets(ticketsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching support tickets:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateStatus = async (ticketId: string, newStatus: 'leido' | 'resuelto') => {
    try {
      await updateDoc(doc(db, 'support_tickets', ticketId), {
        estado: newStatus
      });
    } catch (error) {
      console.error("Error updating ticket status:", error);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="w-full box-border max-w-7xl mx-auto mt-8 space-y-6">
      <div className={`p-6 rounded-3xl flex items-center justify-between gap-4 transition-all ${
        esPlanFull 
          ? 'bg-white border border-amber-200/80 shadow-[0_8px_30px_-4px_rgba(251,191,36,0.12)]' 
          : 'bg-slate-900 text-white shadow-xl border border-slate-800'
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            esPlanFull 
              ? 'bg-amber-50 border border-amber-200/70 text-amber-600 shadow-xs' 
              : 'bg-slate-800 border border-slate-700 text-slate-300'
          }`}>
            <Mail className={`w-6 h-6 ${esPlanFull ? 'text-amber-600' : 'text-slate-300'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className={`font-serif font-bold text-2xl tracking-tight ${esPlanFull ? 'text-slate-900' : 'text-white'}`}>
                Buzón de Consultas Notariales
              </h2>
              <span className={`font-bold text-[10px] px-2.5 py-0.5 rounded-full ${
                esPlanFull 
                  ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 shadow-xs' 
                  : 'bg-red-600 text-white'
              }`}>
                O.L.G.A.
              </span>
            </div>
            <p className={`text-sm mt-1 ${esPlanFull ? 'text-slate-500' : 'text-slate-400'}`}>
              Gestión de mensajes y solicitudes de soporte de los usuarios del sistema.
            </p>
          </div>
        </div>
      </div>

      <div className={`rounded-3xl overflow-hidden transition-all ${
        esPlanFull
          ? 'bg-white border border-amber-200/80 shadow-[0_8px_30px_-4px_rgba(251,191,36,0.12)]'
          : 'bg-slate-900 border border-slate-800 shadow-xl text-white'
      }`}>
        {tickets.length === 0 ? (
          <div className={`p-12 text-center flex flex-col items-center ${
            esPlanFull ? 'text-slate-500' : 'text-slate-400'
          }`}>
            <MessageSquare className={`w-12 h-12 mb-4 ${
              esPlanFull ? 'text-slate-300' : 'text-slate-600'
            }`} />
            <p>No hay consultas en el buzón actualmente.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full box-border text-left border-collapse">
              <thead>
                <tr className={`${
                  esPlanFull 
                    ? 'bg-slate-50 border-b border-slate-200' 
                    : 'bg-slate-800/80 border-b border-slate-800'
                }`}>
                  <th className={`p-4 text-xs font-bold uppercase tracking-wider ${
                    esPlanFull ? 'text-slate-500' : 'text-slate-400'
                  }`}>Fecha</th>
                  <th className={`p-4 text-xs font-bold uppercase tracking-wider ${
                    esPlanFull ? 'text-slate-500' : 'text-slate-400'
                  }`}>Cliente</th>
                  <th className={`p-4 text-xs font-bold uppercase tracking-wider ${
                    esPlanFull ? 'text-slate-500' : 'text-slate-400'
                  }`}>Consulta</th>
                  <th className={`p-4 text-xs font-bold uppercase tracking-wider ${
                    esPlanFull ? 'text-slate-500' : 'text-slate-400'
                  }`}>Estado</th>
                  <th className={`p-4 text-xs font-bold uppercase tracking-wider text-right ${
                    esPlanFull ? 'text-slate-500' : 'text-slate-400'
                  }`}>Acciones</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${
                esPlanFull ? 'divide-slate-100' : 'divide-slate-800'
              }`}>
                {tickets.map((ticket) => (
                  <tr 
                    key={ticket.id} 
                    className={`transition-colors ${
                      esPlanFull
                        ? `hover:bg-slate-50 ${ticket.estado === 'pendiente' ? 'bg-amber-50/20' : ''}`
                        : `hover:bg-slate-800/50 ${ticket.estado === 'pendiente' ? 'bg-slate-800/40' : ''}`
                    }`}
                  >
                    <td className="p-4 align-top">
                      <span className={`text-xs font-mono ${
                        esPlanFull ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        {formatDate(ticket.fecha_creacion)}
                      </span>
                    </td>
                    <td className="p-4 align-top">
                      <div className={`font-bold text-sm ${
                        esPlanFull ? 'text-slate-800' : 'text-white'
                      }`}>
                        {ticket.nombre_usuario}
                      </div>
                      {ticket.email && (
                        <div className={`text-xs mt-1 ${
                          esPlanFull ? 'text-slate-500' : 'text-slate-400'
                        }`}>
                          {ticket.email}
                        </div>
                      )}
                      {ticket.telefono && (
                        <div className={`text-xs mt-0.5 ${
                          esPlanFull ? 'text-slate-500' : 'text-slate-400'
                        }`}>
                          {ticket.telefono}
                        </div>
                      )}
                    </td>
                    <td className="p-4 align-top max-w-md">
                      <div className={`font-bold text-sm mb-1 ${
                        esPlanFull ? 'text-slate-800' : 'text-white'
                      }`}>
                        {ticket.asunto}
                      </div>
                      <div className={`text-sm whitespace-pre-wrap ${
                        esPlanFull ? 'text-slate-600' : 'text-slate-300'
                      }`}>
                        {ticket.mensaje}
                      </div>
                    </td>
                    <td className="p-4 align-top">
                      {ticket.estado === 'pendiente' && (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          esPlanFull 
                            ? 'bg-amber-100 text-amber-700 border border-amber-300/60' 
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}>
                          <Clock className="w-3 h-3" /> Pendiente
                        </span>
                      )}
                      {ticket.estado === 'leido' && (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          esPlanFull 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-blue-950/80 text-blue-300 border border-blue-800'
                        }`}>
                          <Circle className="w-3 h-3" /> Leído
                        </span>
                      )}
                      {ticket.estado === 'resuelto' && (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          esPlanFull 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                        }`}>
                          <CheckCircle2 className="w-3 h-3" /> Resuelto
                        </span>
                      )}
                    </td>
                    <td className="p-4 align-top text-right flex flex-col items-end gap-2">
                      {ticket.telefono ? (
                        <button
                          onClick={() => window.open(`https://wa.me/${ticket.telefono.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hola! Recibimos tu consulta en O.L.G.A. sobre: *' + ticket.asunto + '*...')}`, '_blank')}
                          className="px-3 py-1.5 bg-green-500 text-white hover:bg-green-600 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          Responder
                        </button>
                      ) : ticket.email ? (
                        <button
                          onClick={() => { window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${ticket.email}&su=${encodeURIComponent('Respuesta a tu consulta en O.L.G.A: ' + ticket.asunto)}`, '_blank'); }}
                          className="px-3 py-1.5 bg-blue-500 text-white hover:bg-blue-600 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          Enviar Correo
                        </button>
                      ) : null}
                      <div className="space-x-2">
                        {ticket.estado === 'pendiente' && (
                          <button
                            onClick={() => handleUpdateStatus(ticket.id, 'leido')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors inline-block cursor-pointer ${
                              esPlanFull 
                                ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' 
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                            }`}
                          >
                            Marcar Leído
                          </button>
                        )}
                        {ticket.estado !== 'resuelto' && (
                          <button
                            onClick={() => handleUpdateStatus(ticket.id, 'resuelto')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors inline-block cursor-pointer ${
                              esPlanFull 
                                ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
                                : 'bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900 border border-emerald-800'
                            }`}
                          >
                            Resolver
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
