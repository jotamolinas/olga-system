import React, { useState, useEffect } from 'react';
import { collection, getDocs, setDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/auth';
import { ShieldAlert, Search, Filter, Building2, MapPin, Award, UserCheck, PlusCircle, CheckCircle2, Lock } from 'lucide-react';

interface NotarioCSJ {
  id: string;
  nombre_completo: string;
  numero_registro: string;
  circunscripcion: string;
  localidad: string;
  cedula_identidad?: string;
  telefono?: string;
  email?: string;
  estado_matricula?: string;
}

export const DirectorioNotariosCSJ: React.FC = () => {
  const currentUser = auth.currentUser;
  const isSuperAdmin = currentUser?.email === 'jotamolinas@gmail.com';

  const [notarios, setNotarios] = useState<NotarioCSJ[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busqueda, setBusqueda] = useState<string>('');
  const [circunscripcionFiltro, setCircunscripcionFiltro] = useState<string>('TODAS');
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});
  const [mensajeNotif, setMensajeNotif] = useState<string | null>(null);

  // 1. REGLA DE SEGURIDAD: Si no es jotamolinas@gmail.com, mostrar tarjeta de acceso restringido
  if (!isSuperAdmin) {
    return (
      <div className="w-full max-w-2xl mx-auto py-20 px-4 animate-fade-in">
        <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl text-center space-y-6">
          <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black font-serif text-slate-800">Acceso Restringido</h2>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              El Padrón Oficial de la Corte Suprema de Justicia (CSJ) y el Directorio Notarial están reservados exclusivamente para el Super Administrador autorizado.
            </p>
          </div>
          <div className="pt-2">
            <span className="inline-block px-4 py-2 bg-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-wider">
              Usuario actual: {currentUser?.email || 'No autenticado'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 2. CONEXIÓN A FIRESTORE: onSnapshot en tiempo real a 'padron_oficial_csj'
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'padron_oficial_csj'),
      (snapshot) => {
        const lista: NotarioCSJ[] = [];
        snapshot.forEach((docSnap) => {
          lista.push({ id: docSnap.id, ...docSnap.data() } as NotarioCSJ);
        });
        setNotarios(lista);
        setLoading(false);
      },
      (error) => {
        console.error('Error al conectar con padron_oficial_csj:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // 5. ACCIÓN CRM: Añadir a prospectos_crm con operador juanmolinas@olgatech.com.py
  const handleAddToCRM = async (notario: NotarioCSJ) => {
    try {
      const prospectoId = `prospecto_csj_${notario.numero_registro || notario.id}`;
      const apellidoNombre = notario.nombre_completo || '';
      const nombreEscribania = `Escribanía ${apellidoNombre.split(',')[0] || 'Notarial'}`;

      const prospectoData = {
        nombre_completo: notario.nombre_completo,
        numero_registro: String(notario.numero_registro || ''),
        localidad: notario.localidad || notario.circunscripcion || 'Asunción',
        departamento: notario.circunscripcion || 'Capital',
        escribania: nombreEscribania,
        cedula_identidad: notario.cedula_identidad || '',
        telefono: notario.telefono || '595981000000',
        email: notario.email || `contacto@${nombreEscribania.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.py`,
        estado: 'pendiente',
        operadorAsignado: 'juanmolinas@olgatech.com.py', // Variable interna solicitada
        origen: 'padron_csj_oficial',
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'prospectos_crm', prospectoId), prospectoData, { merge: true });

      setAddedIds(prev => ({ ...prev, [notario.id]: true }));
      setMensajeNotif(`¡Escribanía ${nombreEscribania} (Reg. ${notario.numero_registro}) añadida al CRM! (Operador: juanmolinas@olgatech.com.py)`);
      setTimeout(() => setMensajeNotif(null), 4000);
    } catch (error) {
      console.error('Error al añadir al CRM:', error);
      setMensajeNotif('Error al guardar en prospectos_crm.');
    }
  };

  // 3. FILTROS Y BÚSQUEDA
  const circunscripcionesUnicas = ['TODAS', ...Array.from(new Set(notarios.map(n => n.circunscripcion).filter(Boolean)))];

  const notariosFiltrados = notarios.filter(n => {
    const matchCircunscripcion = circunscripcionFiltro === 'TODAS' || n.circunscripcion === circunscripcionFiltro;
    const matchBusqueda = 
      n.nombre_completo?.toLowerCase().includes(busqueda.toLowerCase()) ||
      n.numero_registro?.toLowerCase().includes(busqueda.toLowerCase()) ||
      n.localidad?.toLowerCase().includes(busqueda.toLowerCase());
    return matchCircunscripcion && matchBusqueda;
  });

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in">
      {/* Cabecera */}
      <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white rounded-[2.5rem] p-6 md:p-10 shadow-2xl border border-indigo-500/20 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
            <UserCheck className="w-4 h-4 text-emerald-400" /> Super Admin Autorizado (jotamolinas@gmail.com)
          </div>
          <h1 className="text-2xl md:text-4xl font-black font-serif tracking-tight">
            Directorio Notarial Oficial - CSJ Paraguay
          </h1>
          <p className="text-slate-300 text-sm max-w-xl">
            Padrón oficial de más de 1,300 registros notariales de la Corte Suprema de Justicia. Operador de salida configurado: <span className="font-bold text-indigo-300">juanmolinas@olgatech.com.py</span>
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 text-center">
          <span className="text-xs font-black uppercase tracking-widest text-indigo-300 block">Registros CSJ</span>
          <span className="text-3xl font-black text-white">{notarios.length}</span>
        </div>
      </div>

      {mensajeNotif && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold flex items-center gap-3 animate-fade-in shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{mensajeNotif}</span>
        </div>
      )}

      {/* Filtros y Búsqueda */}
      <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="relative w-full lg:w-96">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, notario o N° de registro..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-2xl">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-500">Circunscripción:</span>
            <select
              value={circunscripcionFiltro}
              onChange={(e) => setCircunscripcionFiltro(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer max-w-[200px] truncate"
            >
              {circunscripcionesUnicas.map((circ) => (
                <option key={circ} value={circ}>{circ}</option>
              ))}
            </select>
          </div>

          <div className="px-4 py-2.5 bg-slate-100 rounded-2xl text-xs font-black text-slate-600">
            Mostrando: {notariosFiltrados.length}
          </div>
        </div>
      </div>

      {/* Cuadrícula de Tarjetas */}
      {loading ? (
        <div className="text-center py-16 bg-white rounded-[2rem] border border-slate-100">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-slate-400 font-bold text-sm">Cargando padrón oficial de la CSJ en tiempo real...</p>
        </div>
      ) : notariosFiltrados.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-[2rem] border border-slate-100">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-700">No se encontraron notarios en el padrón CSJ</h3>
          <p className="text-slate-400 text-sm mt-1">Verifica los términos de búsqueda o filtros seleccionados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notariosFiltrados.map((n) => {
            const isAdded = addedIds[n.id];
            const apellidoNombre = n.nombre_completo || '';
            const nombreEscribania = `Escribanía ${apellidoNombre.split(',')[0] || 'Notarial'}`;

            return (
              <div
                key={n.id}
                className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-5 relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/40 rounded-full blur-2xl -z-0 group-hover:bg-indigo-100/40 transition-colors"></div>

                <div className="space-y-3 relative z-10">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black shrink-0 shadow-inner">
                      <Award className="w-6 h-6" />
                    </div>
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                      Reg. N° {n.numero_registro || 'S/N'}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold font-serif text-base text-slate-800 leading-snug">
                      {nombreEscribania}
                    </h3>
                    <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1.5">
                      {n.nombre_completo}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-50 text-xs text-slate-500 font-medium">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                      <span className="truncate">Localidad: {n.localidad || 'Asunción'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span className="truncate">Circunscripción: {n.circunscripcion || 'Capital'}</span>
                    </div>
                  </div>
                </div>

                {/* Botón Añadir a CRM */}
                <div className="pt-3 border-t border-slate-100 relative z-10">
                  <button
                    onClick={() => handleAddToCRM(n)}
                    className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all transform active:scale-95 ${
                      isAdded
                        ? 'bg-emerald-600 text-white shadow-emerald-900/20'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/20'
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" /> Añadido al CRM
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-4 h-4" /> Añadir a CRM
                      </>
                    )}
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
export default DirectorioNotariosCSJ;
