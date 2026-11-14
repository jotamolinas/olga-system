import React, { useState, useEffect } from 'react';
import { collection, getDocs, setDoc, doc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/auth';
import escribanosData from '../escribanos.json';
import { Building2, MapPin, Phone, Mail, CheckCircle2, Clock, RefreshCw, Search, Filter, ExternalLink, Send, ShieldCheck, Award } from 'lucide-react';

interface Prospecto {
  id: string;
  nombre_completo: string;
  numero_registro: string;
  localidad: string;
  departamento: string;
  escribania: string;
  cedula_identidad: string;
  telefono?: string;
  email?: string;
  estado: 'pendiente' | 'contactado';
  updatedAt?: any;
}

// Función auxiliar para mapear localidad a Departamento en Paraguay
function getDepartamento(localidad: string): string {
  const loc = localidad.toLowerCase();
  if (loc.includes('asunción') || loc.includes('asuncion')) return 'Capital';
  if (
    loc.includes('luque') ||
    loc.includes('san lorenzo') ||
    loc.includes('fernando de la mora') ||
    loc.includes('lambaré') ||
    loc.includes('capiatá') ||
    loc.includes('ñemby') ||
    loc.includes('mariano roque alonso') ||
    loc.includes('limpio') ||
    loc.includes('villeta') ||
    loc.includes('itauguá') ||
    loc.includes('areguá') ||
    loc.includes('san antonio') ||
    loc.includes('ypané') ||
    loc.includes('nemby')
  ) return 'Central';
  if (
    loc.includes('ciudad del este') ||
    loc.includes('presidente franco') ||
    loc.includes('hernandarias') ||
    loc.includes('minga guazú') ||
    loc.includes('santa rita') ||
    loc.includes('naranjal') ||
    loc.includes('iruña') ||
    loc.includes('mbaracayú') ||
    loc.includes('mallorquín') ||
    loc.includes('tavapy')
  ) return 'Alto Paraná';
  if (
    loc.includes('encarnación') ||
    loc.includes('obligado') ||
    loc.includes('capitán miranda') ||
    loc.includes('san rafael') ||
    loc.includes('carlos antonio lópez')
  ) return 'Itapúa';
  if (
    loc.includes('coronel oviedo') ||
    loc.includes('caaguazú') ||
    loc.includes('estigarribia') ||
    loc.includes('frutos') ||
    loc.includes('toledo')
  ) return 'Caaguazú';
  if (loc.includes('villarrica')) return 'Guairá';
  if (loc.includes('concepción') || loc.includes('horqueta') || loc.includes('yby ya')) return 'Concepción';
  if (loc.includes('eusebio ayala')) return 'Cordillera';
  if (loc.includes('pedro juan') || loc.includes('zanja pytá')) return 'Amambay';
  if (loc.includes('loma plata')) return 'Boquerón';
  if (loc.includes('abai')) return 'Caazapá';
  if (loc.includes('la paloma')) return 'Canindeyú';
  return 'Interior / Otro';
}

export const ProspeccionCRM: React.FC = () => {
  const [prospectos, setProspectos] = useState<Prospecto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [filtroDepartamento, setFiltroDepartamento] = useState<string>('TODOS');
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [busqueda, setBusqueda] = useState<string>('');
  const [mensajeSync, setMensajeSync] = useState<string | null>(null);

  // Cargar prospectos desde Firestore en tiempo real
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'prospectos_crm'),
      (snapshot) => {
        const lista: Prospecto[] = [];
        snapshot.forEach((docSnap) => {
          lista.push({ id: docSnap.id, ...docSnap.data() } as Prospecto);
        });
        setProspectos(lista);
        setLoading(false);
      },
      (error) => {
        console.error('Error al cargar prospectos CRM:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Sincronizar/Cargar los 85+ registros de escribanos.json a Firestore
  const handleSyncProspects = async () => {
    try {
      setSyncing(true);
      setMensajeSync('Sincronizando escribanías a Firestore...');
      
      let count = 0;
      // Tomamos hasta 100 registros del JSON
      const registros = (escribanosData as any[]).slice(0, 100);

      for (const item of registros) {
        const docId = `prospecto_${item.numero_registro || item.id}`;
        const apellidoNombre = item.nombre_completo || '';
        const nombreEscribania = `Escribanía ${apellidoNombre.split(',')[0] || 'Notarial'}`;
        const depto = getDepartamento(item.localidad || '');

        const prospectoData = {
          nombre_completo: item.nombre_completo,
          numero_registro: String(item.numero_registro || ''),
          localidad: item.localidad || 'Asunción',
          departamento: depto,
          escribania: nombreEscribania,
          cedula_identidad: item.cedula_identidad || '',
          telefono: item.telefono || '595981000000', // Teléfono por defecto para pruebas de WA
          email: item.email || `contacto@${nombreEscribania.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.py`,
          estado: 'pendiente',
          updatedAt: serverTimestamp(),
        };

        await setDoc(doc(db, 'prospectos_crm', docId), prospectoData, { merge: true });
        count++;
      }

      setMensajeSync(`¡Sincronización exitosa! Se cargaron ${count} escribanías a Firestore.`);
      setTimeout(() => setMensajeSync(null), 5000);
    } catch (error) {
      console.error('Error en sincronización:', error);
      setMensajeSync('Hubo un error al sincronizar los prospectos.');
    } finally {
      setSyncing(false);
    }
  };

  // Marcar como contactado y abrir WhatsApp
  const handleWhatsApp = async (p: Prospecto) => {
    try {
      // Actualizar estado en Firestore
      await updateDoc(doc(db, 'prospectos_crm', p.id), {
        estado: 'contactado',
        updatedAt: serverTimestamp()
      });

      const nombreLimpio = p.nombre_completo.split(',')[0].trim();
      const mensaje = `Estimado/a Escribano/a ${nombreLimpio}, le escribo del equipo de O.L.G.A. (Software Legal-Tech Notarial). Desarrollamos una plataforma bajo la Ley 879/81 que automatiza presupuestos, hojas milimétricas (Lienzo Notarial) y pagarés con IA. Queremos ofrecerle 5 días de acceso gratuito y una demo de 15 minutos para su escribanía en ${p.localidad}. ¿Le comparto el acceso?`;
      
      const tel = p.telefono || '595981000000';
      const url = `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`;
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error al actualizar estado a contactado:', error);
    }
  };

  // Marcar como contactado y abrir Email
  const handleEmail = async (p: Prospecto) => {
    try {
      await updateDoc(doc(db, 'prospectos_crm', p.id), {
        estado: 'contactado',
        updatedAt: serverTimestamp()
      });

      const asunto = `Propuesta de Alianza Legal-Tech e Informatización Notarial - ${p.escribania}`;
      const cuerpo = `Estimado/a Escribano/a ${p.nombre_completo},\n\nLe escribo del equipo de O.L.G.A. (Organización, Legalización, Gestión y Administración), software especializado para escribanías en Paraguay conforme a la Ley 879/81.\n\nNuestra solución automatiza el Lienzo Notarial (hojas milimétricas de protocolo con simetría doble faz), cálculo de impuestos/tasas, control de pagarés y presupuestos notariales con IA.\n\nNos gustaría ofrecerle 5 días de acceso corporativo gratuito y una demostración personalizada de 15 minutos.\n\nQuedamos a su entera disposición.\n\nAtentamente,\nEquipo Comercial O.L.G.A. Tech\nParaguay`;

      const mailtoUrl = `mailto:${p.email || ''}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
      window.open(mailtoUrl, '_blank');
    } catch (error) {
      console.error('Error al actualizar estado por email:', error);
    }
  };

  // Filtrado de prospectos
  const prospectosFiltrados = prospectos.filter(p => {
    const matchDepto = filtroDepartamento === 'TODOS' || p.departamento === filtroDepartamento;
    const matchEstado = filtroEstado === 'TODOS' || p.estado === filtroEstado;
    const matchBusqueda = 
      p.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.escribania.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.numero_registro.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.localidad.toLowerCase().includes(busqueda.toLowerCase());
    return matchDepto && matchEstado && matchBusqueda;
  });

  const departamentosUnicos = ['TODOS', 'Capital', 'Central', 'Alto Paraná', 'Itapúa', 'Caaguazú', 'Guairá', 'Concepción', 'Cordillera', 'Amambay'];

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in">
      {/* Encabezado Principal */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-[2.5rem] p-6 md:p-10 shadow-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30">
            <Award className="w-4 h-4 text-indigo-400" /> Módulo CRM Comercial O.L.G.A.
          </div>
          <h1 className="text-2xl md:text-4xl font-black font-serif tracking-tight">
            Prospección de Escribanías - Paraguay
          </h1>
          <p className="text-slate-400 text-sm max-w-xl">
            Gestión de leads notariales con integración directa a Firestore para campañas de expansión Ley 879/81 y Lienzo Notarial.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <button
            onClick={handleSyncProspects}
            disabled={syncing}
            className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Cargar 85+ Escribanías (JSON)'}
          </button>
        </div>
      </div>

      {mensajeSync && (
        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-sm font-bold flex items-center gap-3 animate-fade-in shadow-sm">
          <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
          <span>{mensajeSync}</span>
        </div>
      )}

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="relative w-full lg:w-96">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por escribanía, notario o ciudad..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-2xl">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-500">Depto:</span>
            <select
              value={filtroDepartamento}
              onChange={(e) => setFiltroDepartamento(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              {departamentosUnicos.map((depto) => (
                <option key={depto} value={depto}>{depto}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-2xl">
            <span className="text-xs font-bold text-slate-500">Estado:</span>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="TODOS">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="contactado">Contactado</option>
            </select>
          </div>

          <div className="px-4 py-2.5 bg-slate-100 rounded-2xl text-xs font-black text-slate-600">
            Total: {prospectosFiltrados.length}
          </div>
        </div>
      </div>

      {/* Listado de Prospectos (Tarjetas / Tabla Moderna) */}
      {loading ? (
        <div className="text-center py-16 bg-white rounded-[2rem] border border-slate-100">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-slate-400 font-bold text-sm">Cargando prospectos desde Firestore...</p>
        </div>
      ) : prospectosFiltrados.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-[2rem] border border-slate-100">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-700">No se encontraron prospectos</h3>
          <p className="text-slate-400 text-sm mt-1">Haz clic en "Cargar 85+ Escribanías (JSON)" para poblar la base de datos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {prospectosFiltrados.map((p) => {
            const isContactado = p.estado === 'contactado';
            return (
              <div
                key={p.id}
                className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-5 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full blur-2xl -z-0 group-hover:bg-indigo-100/50 transition-colors"></div>

                <div className="space-y-3 relative z-10">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black shrink-0 shadow-inner">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        isContactado 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {isContactado ? 'Contactado' : 'Pendiente'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase bg-slate-100 text-slate-600">
                        Reg. N° {p.numero_registro}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold font-serif text-lg text-slate-800 leading-snug">
                      {p.escribania}
                    </h3>
                    <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-indigo-500" />
                      {p.nombre_completo}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-50 text-xs text-slate-500 font-medium">
                    <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                    <span className="truncate">{p.localidad}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-700 shrink-0">
                      {p.departamento}
                    </span>
                  </div>
                </div>

                {/* Botones de Acción Rápida */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 relative z-10">
                  <button
                    onClick={() => handleWhatsApp(p)}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm shadow-emerald-900/20 transition-all transform active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" /> WhatsApp
                  </button>

                  <button
                    onClick={() => handleEmail(p)}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm shadow-indigo-900/20 transition-all transform active:scale-95"
                  >
                    <Mail className="w-3.5 h-3.5" /> Email
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default ProspeccionCRM;
