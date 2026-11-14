import React, { useState, useEffect } from 'react';
import { collection, getDocs, setDoc, doc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../services/auth';
import escribanosData from '../escribanos.json';
import { 
  ShieldAlert, Search, Filter, Building2, MapPin, Award, UserCheck, 
  PlusCircle, CheckCircle2, Lock, RefreshCw, Send, Mail, Users, 
  Database, LayoutDashboard, ArrowUpRight, Check, X 
} from 'lucide-react';

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
  operadorAsignado?: string;
  updatedAt?: any;
}

// Función auxiliar para mapear localidad a Departamento en Paraguay
function getDepartamento(localidad: string): string {
  const loc = (localidad || '').toLowerCase();
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

export const AdminProspeccionDashboard: React.FC = () => {
  const currentUser = auth.currentUser;
  const isSuperAdmin = currentUser?.email === 'jotamolinas@gmail.com';

  const [activeTab, setActiveTab] = useState<'csj' | 'crm'>('csj');

  // Estados Pestaña 1: Padrón CSJ
  const [notarios, setNotarios] = useState<NotarioCSJ[]>([]);
  const [loadingCSJ, setLoadingCSJ] = useState<boolean>(true);
  const [busquedaCSJ, setBusquedaCSJ] = useState<string>('');
  const [circunscripcionFiltro, setCircunscripcionFiltro] = useState<string>('TODAS');
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});
  const [mensajeNotifCSJ, setMensajeNotifCSJ] = useState<string | null>(null);

  // Estados Pestaña 2: Embudo CRM
  const [prospectos, setProspectos] = useState<Prospecto[]>([]);
  const [loadingCRM, setLoadingCRM] = useState<boolean>(true);
  const [syncingCRM, setSyncingCRM] = useState<boolean>(false);
  const [filtroDeptoCRM, setFiltroDeptoCRM] = useState<string>('TODOS');
  const [filtroEstadoCRM, setFiltroEstadoCRM] = useState<string>('TODOS');
  const [busquedaCRM, setBusquedaCRM] = useState<string>('');
  const [mensajeSyncCRM, setMensajeSyncCRM] = useState<string | null>(null);

  // 1. REGLA DE SEGURIDAD ABSOLUTA (Super Admin)
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
              El Panel Maestro de Prospección Legal-Tech O.L.G.A. requiere credenciales de Super Administrador.
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

  // 3. CONEXIÓN A FIRESTORE (Tiempo real para ambas colecciones)
  useEffect(() => {
    // Sincronizar Padrón CSJ
    const unsubCSJ = onSnapshot(
      collection(db, 'padron_oficial_csj'),
      (snapshot) => {
        const lista: NotarioCSJ[] = [];
        snapshot.forEach((docSnap) => {
          lista.push({ id: docSnap.id, ...docSnap.data() } as NotarioCSJ);
        });
        setNotarios(lista);
        setLoadingCSJ(false);
      },
      (error) => {
        console.error('Error al cargar padron_oficial_csj:', error);
        setLoadingCSJ(false);
      }
    );

    // Sincronizar Embudo CRM
    const unsubCRM = onSnapshot(
      collection(db, 'prospectos_crm'),
      (snapshot) => {
        const lista: Prospecto[] = [];
        snapshot.forEach((docSnap) => {
          lista.push({ id: docSnap.id, ...docSnap.data() } as Prospecto);
        });
        setProspectos(lista);
        setLoadingCRM(false);
      },
      (error) => {
        console.error('Error al cargar prospectos_crm:', error);
        setLoadingCRM(false);
      }
    );

    return () => {
      unsubCSJ();
      unsubCRM();
    };
  }, []);

  // Acción Pestaña 1: Añadir a CRM desde Padrón CSJ (con operador juanmolinas@olgatech.com.py)
  const handleAddToCRM = async (notario: NotarioCSJ) => {
    try {
      const prospectoId = `prospecto_csj_${notario.numero_registro || notario.id}`;
      const apellidoNombre = notario.nombre_completo || '';
      const nombreEscribania = `Escribanía ${apellidoNombre.split(',')[0] || 'Notarial'}`;
      const depto = getDepartamento(notario.localidad || notario.circunscripcion);

      const prospectoData = {
        nombre_completo: notario.nombre_completo,
        numero_registro: String(notario.numero_registro || ''),
        localidad: notario.localidad || 'Asunción',
        departamento: depto,
        escribania: nombreEscribania,
        cedula_identidad: notario.cedula_identidad || '',
        telefono: notario.telefono || '595981000000',
        email: notario.email || `contacto@${nombreEscribania.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.py`,
        estado: 'pendiente',
        operadorAsignado: 'juanmolinas@olgatech.com.py',
        origen: 'padron_csj_oficial',
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'prospectos_crm', prospectoId), prospectoData, { merge: true });

      setAddedIds(prev => ({ ...prev, [notario.id]: true }));
      setMensajeNotifCSJ(`¡Escribanía ${nombreEscribania} (Reg. ${notario.numero_registro}) añadida al CRM! (Operador: juanmolinas@olgatech.com.py)`);
      setTimeout(() => setMensajeNotifCSJ(null), 4000);
    } catch (error) {
      console.error('Error al añadir al CRM:', error);
      setMensajeNotifCSJ('Error al guardar en prospectos_crm.');
    }
  };

  // Acción Pestaña 2: Sincronizar JSON masivo al CRM
  const handleSyncProspects = async () => {
    try {
      setSyncingCRM(true);
      setMensajeSyncCRM('Sincronizando escribanías a Firestore...');
      
      let count = 0;
      const registros = (escribanosData as any[]).slice(0, 120);

      for (const item of registros) {
        const docId = `prospecto_json_${item.numero_registro || item.id}`;
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
          telefono: item.telefono || '595981000000',
          email: item.email || `contacto@${nombreEscribania.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.py`,
          estado: 'pendiente',
          operadorAsignado: 'juanmolinas@olgatech.com.py',
          origen: 'json_masivo',
          updatedAt: serverTimestamp(),
        };

        await setDoc(doc(db, 'prospectos_crm', docId), prospectoData, { merge: true });
        count++;
      }

      setMensajeSyncCRM(`¡Sincronización masiva exitosa! Se cargaron ${count} escribanías.`);
      setTimeout(() => setMensajeSyncCRM(null), 5000);
    } catch (error) {
      console.error('Error en sincronización masiva:', error);
      setMensajeSyncCRM('Hubo un error al sincronizar los prospectos.');
    } finally {
      setSyncingCRM(false);
    }
  };

  // WhatsApp con operador juanmolinas@olgatech.com.py
  const handleWhatsApp = async (p: Prospecto) => {
    try {
      await updateDoc(doc(db, 'prospectos_crm', p.id), {
        estado: 'contactado',
        operadorAsignado: 'juanmolinas@olgatech.com.py',
        updatedAt: serverTimestamp()
      });

      const nombreLimpio = p.nombre_completo.split(',')[0].trim();
      const mensaje = `Estimado/a Escribano/a ${nombreLimpio}, le escribo de parte de Juan Molinas (juanmolinas@olgatech.com.py) del equipo de O.L.G.A. (Software Legal-Tech Notarial). Desarrollamos una plataforma bajo la Ley 879/81 que automatiza presupuestos, hojas milimétricas (Lienzo Notarial) y pagarés con IA. Queremos ofrecerle 5 días de acceso gratuito y una demo de 15 minutos para su escribanía en ${p.localidad}. ¿Le comparto el acceso?`;
      
      const tel = p.telefono || '595981000000';
      const url = `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`;
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error al actualizar estado WhatsApp:', error);
    }
  };

  // Email con operador juanmolinas@olgatech.com.py
  const handleEmail = async (p: Prospecto) => {
    try {
      await updateDoc(doc(db, 'prospectos_crm', p.id), {
        estado: 'contactado',
        operadorAsignado: 'juanmolinas@olgatech.com.py',
        updatedAt: serverTimestamp()
      });

      const asunto = `Propuesta de Alianza Legal-Tech e Informatización Notarial - ${p.escribania}`;
      const cuerpo = `Estimado/a Escribano/a ${p.nombre_completo},\n\nLe escribo de parte de Juan Molinas (juanmolinas@olgatech.com.py) del equipo de O.L.G.A. (Organización, Legalización, Gestión y Administración), software especializado para escribanías en Paraguay conforme a la Ley 879/81.\n\nNuestra solución automatiza el Lienzo Notarial (hojas milimétricas de protocolo con simetría doble faz), cálculo de impuestos/tasas, control de pagarés y presupuestos notariales con IA.\n\nNos gustaría ofrecerle 5 días de acceso corporativo gratuito y una demostración personalizada de 15 minutos.\n\nQuedamos a su entera disposición.\n\nAtentamente,\nJuan Molinas\njuanmolinas@olgatech.com.py\nO.L.G.A. Tech - Paraguay`;

      const mailtoUrl = `mailto:${p.email || ''}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
      window.open(mailtoUrl, '_blank');
    } catch (error) {
      console.error('Error al actualizar estado Email:', error);
    }
  };

  // Filtros Pestaña 1
  const circunscripcionesUnicas = ['TODAS', ...Array.from(new Set(notarios.map(n => n.circunscripcion).filter(Boolean)))];
  const notariosFiltrados = notarios.filter(n => {
    const matchCirc = circunscripcionFiltro === 'TODAS' || n.circunscripcion === circunscripcionFiltro;
    const matchBusq = 
      n.nombre_completo?.toLowerCase().includes(busquedaCSJ.toLowerCase()) ||
      n.numero_registro?.toLowerCase().includes(busquedaCSJ.toLowerCase()) ||
      n.localidad?.toLowerCase().includes(busquedaCSJ.toLowerCase());
    return matchCirc && matchBusq;
  });

  // Filtros Pestaña 2
  const departamentosUnicos = ['TODOS', 'Capital', 'Central', 'Alto Paraná', 'Itapúa', 'Caaguazú', 'Guairá', 'Concepción', 'Cordillera', 'Amambay'];
  const prospectosFiltrados = prospectos.filter(p => {
    const matchDepto = filtroDeptoCRM === 'TODOS' || p.departamento === filtroDeptoCRM;
    const matchEstado = filtroEstadoCRM === 'TODOS' || p.estado === filtroEstadoCRM;
    const matchBusq = 
      p.nombre_completo.toLowerCase().includes(busquedaCRM.toLowerCase()) ||
      p.escribania.toLowerCase().includes(busquedaCRM.toLowerCase()) ||
      p.numero_registro.toLowerCase().includes(busquedaCRM.toLowerCase()) ||
      p.localidad.toLowerCase().includes(busquedaCRM.toLowerCase());
    return matchDepto && matchEstado && matchBusq;
  });

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in">
      {/* Cabecera Institucional Master */}
      <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white rounded-[2.5rem] p-6 md:p-10 shadow-2xl border border-indigo-500/30 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30">
            <UserCheck className="w-4 h-4 text-indigo-400" /> Super Admin Maestro: jotamolinas@gmail.com
          </div>
          <h1 className="text-2xl md:text-4xl font-black font-serif tracking-tight">
            Panel Maestro de Prospección - O.L.G.A. Paraguay
          </h1>
          <p className="text-slate-300 text-sm max-w-2xl">
            Centro de control unificado. Padrón oficial CSJ (1,300+ registros) y Embudo CRM Comercial operado por <span className="font-bold text-indigo-300">juanmolinas@olgatech.com.py</span>.
          </p>
        </div>

        {/* Métricas rápidas */}
        <div className="flex items-center gap-4">
          <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 block">Padrón CSJ</span>
            <span className="text-2xl font-black text-white">{notarios.length}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300 block">Prospectos CRM</span>
            <span className="text-2xl font-black text-white">{prospectos.length}</span>
          </div>
        </div>
      </div>

      {/* Navegación por Pestañas (Tabs) */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
        <button
          onClick={() => setActiveTab('csj')}
          className={`px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2.5 transition-all ${
            activeTab === 'csj'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Database className="w-4 h-4" /> 1. Padrón Oficial CSJ ({notarios.length})
        </button>

        <button
          onClick={() => setActiveTab('crm')}
          className={`px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2.5 transition-all ${
            activeTab === 'crm'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4" /> 2. Embudo CRM Activo ({prospectos.length})
        </button>
      </div>

      {/* ========================================================================== */}
      {/* VISTA 1: PADRÓN OFICIAL CSJ                                                */}
      {/* ========================================================================== */}
      {activeTab === 'csj' && (
        <div className="space-y-6 animate-fade-in">
          {mensajeNotifCSJ && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold flex items-center gap-3 shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{mensajeNotifCSJ}</span>
            </div>
          )}

          <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
            <div className="relative w-full lg:w-96">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nombre, notario o N° de registro..."
                value={busquedaCSJ}
                onChange={(e) => setBusquedaCSJ(e.target.value)}
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

          {loadingCSJ ? (
            <div className="text-center py-16 bg-white rounded-[2rem] border border-slate-100">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-slate-400 font-bold text-sm">Cargando padrón oficial CSJ...</p>
            </div>
          ) : notariosFiltrados.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-[2rem] border border-slate-100">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-700">No se encontraron registros</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {notariosFiltrados.map((n) => {
                const isAdded = addedIds[n.id];
                const apellidoNombre = n.nombre_completo || '';
                const nombreEscribania = `Escribanía ${apellidoNombre.split(',')[0] || 'Notarial'}`;

                return (
                  <div key={n.id} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-5 relative overflow-hidden group">
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
                        <p className="text-xs font-bold text-slate-500 mt-1">
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

                    <div className="pt-3 border-t border-slate-100 relative z-10">
                      <button
                        onClick={() => handleAddToCRM(n)}
                        className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all transform active:scale-95 ${
                          isAdded ? 'bg-emerald-600 text-white shadow-emerald-900/20' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/20'
                        }`}
                      >
                        {isAdded ? <><CheckCircle2 className="w-4 h-4" /> Añadido al CRM</> : <><PlusCircle className="w-4 h-4" /> Añadir a CRM</>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================== */}
      {/* VISTA 2: EMBUDO CRM ACTIVO                                                 */}
      {/* ========================================================================== */}
      {activeTab === 'crm' && (
        <div className="space-y-6 animate-fade-in">
          {mensajeSyncCRM && (
            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-sm font-bold flex items-center gap-3 shadow-sm">
              <ShieldAlert className="w-5 h-5 text-indigo-600 shrink-0" />
              <span>{mensajeSyncCRM}</span>
            </div>
          )}

          <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-4">
            <div className="relative w-full lg:w-96">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar prospectos CRM..."
                value={busquedaCRM}
                onChange={(e) => setBusquedaCRM(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-2xl">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-bold text-slate-500">Depto:</span>
                <select
                  value={filtroDeptoCRM}
                  onChange={(e) => setFiltroDeptoCRM(e.target.value)}
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
                  value={filtroEstadoCRM}
                  onChange={(e) => setFiltroEstadoCRM(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="TODOS">Todos</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="contactado">Contactado</option>
                </select>
              </div>

              <button
                onClick={handleSyncProspects}
                disabled={syncingCRM}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingCRM ? 'animate-spin' : ''}`} />
                {syncingCRM ? 'Sincronizando...' : 'Cargar Base Masiva'}
              </button>
            </div>
          </div>

          {loadingCRM ? (
            <div className="text-center py-16 bg-white rounded-[2rem] border border-slate-100">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-slate-400 font-bold text-sm">Cargando embudo CRM...</p>
            </div>
          ) : prospectosFiltrados.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-[2rem] border border-slate-100">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-700">No hay prospectos en el CRM</h3>
              <p className="text-slate-400 text-sm mt-1">Añade registros desde el Padrón CSJ o carga la base masiva.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {prospectosFiltrados.map((p) => {
                const isContactado = p.estado === 'contactado';
                return (
                  <div key={p.id} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full blur-2xl -z-0 group-hover:bg-indigo-100/50 transition-colors"></div>

                    <div className="space-y-3 relative z-10">
                      <div className="flex items-start justify-between gap-2">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black shrink-0 shadow-inner">
                          <Building2 className="w-6 h-6" />
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isContactado ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {isContactado ? 'Contactado' : 'Pendiente'}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[9px] font-black bg-slate-100 text-slate-600">
                            Reg. N° {p.numero_registro}
                          </span>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-bold font-serif text-base text-slate-800 leading-snug">
                          {p.escribania}
                        </h3>
                        <p className="text-xs font-bold text-slate-500 mt-1">
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

                      <div className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                        Operador: {p.operadorAsignado || 'juanmolinas@olgatech.com.py'}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 relative z-10">
                      <button
                        onClick={() => handleWhatsApp(p)}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-900/20 transition-all transform active:scale-95"
                      >
                        <Send className="w-3.5 h-3.5" /> WhatsApp
                      </button>

                      <button
                        onClick={() => handleEmail(p)}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-900/20 transition-all transform active:scale-95"
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
      )}
    </div>
  );
};
export default AdminProspeccionDashboard;
