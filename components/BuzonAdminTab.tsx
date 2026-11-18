import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/auth';
import { Mail, CheckCircle2, Circle, Clock, MessageSquare, Trash2 } from 'lucide-react';

interface Ticket {
  id: string;
  id_usuario: string;
  nombre_usuario: string;
  email?: string;
  telefono?: string;
  asunto: string;
  mensaje: string;
  estado: 'pendiente' | 'leido' | 'resuelto' | 'en_proceso';
  fecha_creacion: number;
  respuestaAdmin?: string;
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

  const handleMarcarEnProceso = async (ticketId: string) => {
    try {
      await updateDoc(doc(db, 'support_tickets', ticketId), { 
        estado: 'en_proceso',
        respuestaAdmin: 'Hemos recibido tu consulta y nuestro equipo ya está trabajando en ella. Nos pondremos en contacto contigo a la brevedad.',
        leidoPorUsuario: false,
        fechaActualizacion: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error al poner en proceso:", err);
    }
  };

  const handleResolverTicket = async (ticketId: string) => {
    try {
      await updateDoc(doc(db, 'support_tickets', ticketId), { 
        estado: 'resuelto',
        respuestaAdmin: 'Tu consulta ha sido atendida y marcada como resuelta por nuestro equipo de soporte. Pronto nos contactaremos por correo. Gracias.',
        leidoPorUsuario: false,
        fechaActualizacion: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error al resolver ticket:", err);
    }
  };

  const handleEliminarTicket = async (ticketId: string) => {
    // Actualización optimista inmediata del estado local sin dialogos confirm bloqueantes de iframe
    setTickets(prev => prev.filter(t => t.id !== ticketId));
    try {
      await deleteDoc(doc(db, 'support_tickets', ticketId));
      await deleteDoc(doc(db, 'consultas_soporte', ticketId)).catch(() => {});
    } catch (err) {
      console.error("Error al eliminar ticket:", err);
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'Fecha no disponible';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Fecha inválida';
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
      <div className="p-6 rounded-3xl flex items-center justify-between gap-4 transition-all bg-slate-900 text-white shadow-xl border border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-slate-800 border border-slate-700 text-slate-300">
            <Mail className="w-6 h-6 text-slate-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif font-bold text-2xl tracking-tight text-white">
                Buzón de Consultas Notariales
              </h2>
              <span className="font-bold text-[10px] px-2.5 py-0.5 rounded-full bg-red-600 text-white">
                O.L.G.A.
              </span>
            </div>
            <p className="text-sm mt-1 text-slate-400">
              Gestión de mensajes y solicitudes de soporte de los usuarios del sistema.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl overflow-hidden transition-all bg-slate-900 border border-slate-800 shadow-xl text-white">
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
                <tr className="bg-slate-800/80 border-b border-slate-800 text-slate-400">
                  <th className="p-4 text-xs font-bold uppercase tracking-wider">Fecha</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider">Cliente</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider">Consulta</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider">Estado</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {tickets.map((ticket) => (
                  <tr 
                    key={ticket.id} 
                    className={`transition-colors hover:bg-slate-800/50 ${ticket.estado === 'pendiente' ? 'bg-slate-800/40' : ''}`}
                  >
                    <td className="p-4 align-top">
                      <span className="text-xs font-mono text-slate-300">
                        {formatDate(ticket.fecha_creacion)}
                      </span>
                    </td>
                    <td className="p-4 align-top">
                      <div className="font-bold text-sm text-white">
                        {ticket.nombre_usuario}
                      </div>
                      {ticket.email && (
                        <div className="text-xs mt-1 text-slate-300">
                          {ticket.email}
                        </div>
                      )}
                      {ticket.telefono && (
                        <div className="text-xs mt-0.5 text-slate-400">
                          {ticket.telefono}
                        </div>
                      )}
                    </td>
                    <td className="p-4 align-top max-w-md">
                      <div className="font-bold text-sm mb-1 text-white">
                        {ticket.asunto}
                      </div>
                      <div className="text-sm whitespace-pre-wrap text-slate-200">
                        {ticket.mensaje}
                      </div>
                    </td>
                    <td className="p-4 align-top">
                      {ticket.estado === 'pendiente' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-200 border border-slate-700">
                          <Clock className="w-3 h-3" /> Pendiente
                        </span>
                      )}
                      {ticket.estado === 'en_proceso' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-950/80 text-blue-300 border border-blue-800">
                          <Clock className="w-3 h-3" /> En Proceso
                        </span>
                      )}
                      {ticket.estado === 'leido' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-950/80 text-blue-300 border border-blue-800">
                          <Circle className="w-3 h-3" /> Leído
                        </span>
                      )}
                      {ticket.estado === 'resuelto' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> Resuelto
                        </span>
                      )}
                    </td>
                    <td className="p-4 align-top text-right flex flex-col items-end gap-2">
                      {ticket.telefono && (
                        <button
                          onClick={() => window.open(`https://wa.me/${ticket.telefono.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hola ' + (ticket.nombre_usuario || 'Escribano') + '! Te contactamos desde Soporte Oficial O.L.G.A. (soporte@olgatech.com.py / WhatsApp +595 983 440021) respecto a tu consulta: *' + ticket.asunto + '*.\n\nEstamos a tu disposición para ayudarte.')}`, '_blank')}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                          title="Responder por WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> WhatsApp S.O.S.
                        </button>
                      )}
                      {ticket.email && (
                        <button
                          onClick={() => { window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${ticket.email}&su=${encodeURIComponent('Respuesta de Soporte O.L.G.A. a tu consulta: ' + ticket.asunto)}&body=${encodeURIComponent('Estimado/a ' + (ticket.nombre_usuario || 'Escribano/a') + ',\n\nHemos revisado su consulta en el buzón de O.L.G.A. Notarial.\n\nRespuesta de Soporte:\n' + (ticket.respuestaAdmin || 'Estamos analizando su inquietud y nos pondremos en contacto.') + '\n\nContáctenos directamente en:\n• Correo: soporte@olgatech.com.py\n• WhatsApp: +595 983 440021\n\nAtentamente,\nEquipo de Soporte O.L.G.A.')}`, '_blank'); }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                          title="Enviar Correo Corporativo"
                        >
                          <Mail className="w-3.5 h-3.5" /> Enviar Correo S.O.S.
                        </button>
                      )}
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        {ticket.estado !== 'en_proceso' && ticket.estado !== 'resuelto' ? (
                          <button
                            onClick={() => handleMarcarEnProceso(ticket.id)}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer"
                          >
                            En Proceso
                          </button>
                        ) : null}
                        {ticket.estado !== 'resuelto' ? (
                          <button
                            onClick={() => handleResolverTicket(ticket.id)}
                            className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer"
                          >
                            Resolver
                          </button>
                        ) : (
                          <span className="text-xs font-bold text-emerald-400 px-2 py-1">Resuelto</span>
                        )}
                        <button
                          onClick={() => handleEliminarTicket(ticket.id)}
                          className="bg-red-600/20 hover:bg-red-600/40 text-red-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center gap-1 cursor-pointer"
                          title="Eliminar ticket"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Eliminar
                        </button>
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
