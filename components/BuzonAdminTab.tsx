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

export const BuzonAdminTab: React.FC = () => {
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
    <div className="w-full box-border max-w-7xl mx-auto mt-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white shrink-0">
          <Mail className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold font-serif text-slate-800">Buzón de Consultas</h2>
          <p className="text-xs text-slate-500 mt-1">
            Gestión de mensajes y solicitudes de soporte de los usuarios.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        {tickets.length === 0 ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center">
            <MessageSquare className="w-12 h-12 text-slate-300 mb-4" />
            <p>No hay consultas en el buzón actualmente.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full box-border text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Consulta</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className={`hover:bg-slate-50 transition-colors ${ticket.estado === 'pendiente' ? 'bg-blue-50/30' : ''}`}>
                    <td className="p-4 align-top">
                      <span className="text-xs text-slate-500 font-mono">{formatDate(ticket.fecha_creacion)}</span>
                    </td>
                    <td className="p-4 align-top">
                      <div className="font-bold text-slate-800 text-sm">{ticket.nombre_usuario}</div>
                      {ticket.email && <div className="text-xs text-slate-500 mt-1">{ticket.email}</div>}
                      {ticket.telefono && <div className="text-xs text-slate-500 mt-0.5">{ticket.telefono}</div>}
                    </td>
                    <td className="p-4 align-top max-w-md">
                      <div className="font-bold text-slate-800 text-sm mb-1">{ticket.asunto}</div>
                      <div className="text-sm text-slate-600 whitespace-pre-wrap">{ticket.mensaje}</div>
                    </td>
                    <td className="p-4 align-top">
                      {ticket.estado === 'pendiente' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 uppercase tracking-wider">
                          <Clock className="w-3 h-3" /> Pendiente
                        </span>
                      )}
                      {ticket.estado === 'leido' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wider">
                          <Circle className="w-3 h-3" /> Leído
                        </span>
                      )}
                      {ticket.estado === 'resuelto' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase tracking-wider">
                          <CheckCircle2 className="w-3 h-3" /> Resuelto
                        </span>
                      )}
                    </td>
                    <td className="p-4 align-top text-right flex flex-col items-end gap-2">
                      {ticket.telefono ? (
                        <button
                          onClick={() => window.open(`https://wa.me/${ticket.telefono.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hola! Recibimos tu consulta en O.L.G.A. sobre: *' + ticket.asunto + '*...')}`, '_blank')}
                          className="px-3 py-1.5 bg-green-500 text-white hover:bg-green-600 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          Responder
                        </button>
                      ) : ticket.email ? (
                        <button
                          onClick={() => { window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${ticket.email}&su=${encodeURIComponent('Respuesta a tu consulta en O.L.G.A: ' + ticket.asunto)}`, '_blank'); }}
                          className="px-3 py-1.5 bg-blue-500 text-white hover:bg-blue-600 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          Enviar Correo
                        </button>
                      ) : null}
                      <div className="space-x-2">
                        {ticket.estado === 'pendiente' && (
                          <button
                            onClick={() => handleUpdateStatus(ticket.id, 'leido')}
                            className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-bold rounded-lg transition-colors inline-block"
                          >
                            Marcar Leído
                          </button>
                        )}
                        {ticket.estado !== 'resuelto' && (
                          <button
                            onClick={() => handleUpdateStatus(ticket.id, 'resuelto')}
                            className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-xs font-bold rounded-lg transition-colors inline-block"
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
