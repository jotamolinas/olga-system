import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  User, 
  Building, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  AlertCircle, 
  Phone, 
  Mail, 
  MapPin, 
  X, 
  ShieldCheck, 
  UserCheck,
  Filter,
  Eye,
  FileText,
  DollarSign,
  TrendingDown,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FolderOpen,
  Save,
  Calendar,
  ExternalLink
} from 'lucide-react';
import { Persona, TipoPersona, TipoDocumento, Pagare } from '../types';

interface PersonasTabProps {
  personas?: Persona[];
  pagares?: Pagare[];
  onAddPersona?: (persona: Persona) => boolean | void;
  onUpdatePersona?: (persona: Persona) => void;
  onDeletePersona?: (id: string) => void;
  isAdmin?: boolean;
  currentUser?: any;
  initialEditingId?: string | null;
  onClose?: () => void;
}

const STORAGE_KEY = 'olga_directorio_personas';
const PAGARES_STORAGE_KEY = 'olga_pagares';

export const PersonasTab: React.FC<PersonasTabProps> = ({
  personas = [],
  pagares = [],
  onAddPersona,
  onUpdatePersona,
  onDeletePersona,
  isAdmin = false,
  currentUser,
  initialEditingId = null,
  onClose
}) => {
  // 1. Estado de Personas con persistencia en localStorage y respaldo inicial en memoria
  const [listaPersonas, setListaPersonas] = useState<Persona[]>(() => {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      if (guardado) {
        const parsed = JSON.parse(guardado);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Error leyendo directorio desde localStorage:', err);
    }

    if (personas && personas.length > 0) return personas;

    return [
      {
        id: 'p-1',
        tipo_persona: 'física',
        nombre: 'Juan Carlos',
        apellido: 'Pérez Gómez',
        tipo_documento: 'CI',
        nro_documento: '1.234.567',
        telefono: '+595 981 123456',
        email: 'juan.perez@email.com',
        domicilio: 'Avda. Mariscal López 1250, Asunción',
        origen: 'MANUAL',
        notas_notariales: 'Cliente compareciente habitual. Ha firmado pagarés de garantías sin antecedentes de mora bancaria.'
      },
      {
        id: 'p-2',
        tipo_persona: 'física',
        nombre: 'María Elena',
        apellido: 'González Benítez',
        tipo_documento: 'CI',
        nro_documento: '2.345.678',
        telefono: '+595 971 654321',
        email: 'maria.gonzalez@email.com',
        domicilio: 'Palma 850 c/ Montevideo, Asunción',
        origen: 'MANUAL',
        notas_notariales: 'Acreedora con cuenta corriente verificada. Presentó solvencia patrimonial para constitución de fideicomiso.'
      },
      {
        id: 'p-3',
        tipo_persona: 'jurídica',
        nombre: 'Agroganadera del Este S.A.',
        tipo_documento: 'RUC',
        nro_documento: '80012345-6',
        telefono: '+595 21 445566',
        email: 'contacto@agroganadera.com.py',
        domicilio: 'Ruta 2 Km 14, San Lorenzo',
        representante_id: 'p-1',
        origen: 'DNIT',
        notas_notariales: 'Sociedad anónima inscripta en Registro Público de Comercio. Poder general de administración vigente protocolizado.'
      }
    ];
  });

  // Pagarés del sistema para el Expediente 360° (de props o localStorage)
  const pagaresEfectivos = useMemo<Pagare[]>(() => {
    if (pagares && Array.isArray(pagares) && pagares.length > 0) {
      return pagares;
    }
    try {
      const stored = localStorage.getItem(PAGARES_STORAGE_KEY) || localStorage.getItem('ihara_pagares');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}

    // Pagarés muestra vinculados a las personas iniciales
    return [
      {
        id: 'pag-demo-1',
        correlativo: 1045,
        certificado_firmas_nro: '900123847',
        tipo_negociacion: 'cuotas_corridas',
        moneda: 'PYG',
        valor_total: 12000000,
        frecuencia_id: 'mensual',
        fecha_primer_pago: '2026-05-15',
        entrega_inicial: 0,
        fecha_entrega_inicial: '',
        concepto_entrega_inicial: '',
        acreedor_id: 'p-2',
        acreedor_nombre_raw: 'María Elena González Benítez',
        acreedor_documento_raw: '2.345.678',
        acreedor_domicilio_raw: 'Palma 850 c/ Montevideo, Asunción',
        acreedor_origen: 'MANUAL',
        deudor_id: 'p-1',
        deudor_nombre_raw: 'Juan Carlos Pérez Gómez',
        deudor_documento_raw: '1.234.567',
        deudor_domicilio_raw: 'Avda. Mariscal López 1250, Asunción',
        deudor_origen: 'MANUAL',
        estado: 'Pendiente',
        created_at: '2026-04-10T10:00:00.000Z',
        creator_role: 'admin',
        cronograma: [
          { id: 'c1', pagare_id: 'pag-demo-1', tipo: 'cuota', fecha_pag: '2026-05-15', monto: 4000000, numero_cuota: '1', pagado: true, estado: 'cobrado' },
          { id: 'c2', pagare_id: 'pag-demo-1', tipo: 'cuota', fecha_pag: '2026-06-15', monto: 4000000, numero_cuota: '2', pagado: true, estado: 'cobrado' },
          { id: 'c3', pagare_id: 'pag-demo-1', tipo: 'cuota', fecha_pag: '2026-07-15', monto: 4000000, numero_cuota: '3', pagado: false, estado: 'pendiente' }
        ]
      },
      {
        id: 'pag-demo-2',
        correlativo: 1046,
        certificado_firmas_nro: '900123848',
        tipo_negociacion: 'cuotas_corridas',
        moneda: 'PYG',
        valor_total: 45000000,
        frecuencia_id: 'mensual',
        fecha_primer_pago: '2026-08-10',
        entrega_inicial: 5000000,
        fecha_entrega_inicial: '2026-07-10',
        concepto_entrega_inicial: 'Seña de trato y conformación de firmas notariales',
        acreedor_id: 'p-2',
        acreedor_nombre_raw: 'María Elena González Benítez',
        acreedor_documento_raw: '2.345.678',
        acreedor_domicilio_raw: 'Palma 850 c/ Montevideo, Asunción',
        acreedor_origen: 'MANUAL',
        deudor_id: 'p-3',
        deudor_nombre_raw: 'Agroganadera del Este S.A.',
        deudor_documento_raw: '80012345-6',
        deudor_domicilio_raw: 'Ruta 2 Km 14, San Lorenzo',
        deudor_origen: 'DNIT',
        estado: 'Pendiente',
        created_at: '2026-07-05T14:30:00.000Z',
        creator_role: 'admin',
        cronograma: [
          { id: 'c4', pagare_id: 'pag-demo-2', tipo: 'cuota', fecha_pag: '2026-08-10', monto: 15000000, numero_cuota: '1', pagado: true, estado: 'cobrado' },
          { id: 'c5', pagare_id: 'pag-demo-2', tipo: 'cuota', fecha_pag: '2026-09-10', monto: 15000000, numero_cuota: '2', pagado: false, estado: 'pendiente' },
          { id: 'c6', pagare_id: 'pag-demo-2', tipo: 'cuota', fecha_pag: '2026-10-10', monto: 15000000, numero_cuota: '3', pagado: false, estado: 'pendiente' }
        ]
      }
    ];
  }, [pagares]);

  // Helper para persistir lista en localStorage
  const guardarListaPersistente = (nuevaLista: Persona[]) => {
    setListaPersonas(nuevaLista);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nuevaLista));
    } catch (err) {
      console.error('Error persistiendo personas en localStorage:', err);
    }
  };

  // 2. Estados del Formulario de Registro / Edición
  const [editingId, setEditingId] = useState<string | null>(initialEditingId);
  const [tipoPersona, setTipoPersona] = useState<TipoPersona>('física');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [nroDocumento, setNroDocumento] = useState('');
  const [representanteId, setRepresentanteId] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 3. Estados de Buscador y Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'física' | 'jurídica'>('todos');

  // 4. Estados del Expediente 360°
  const [clienteExpediente, setClienteExpediente] = useState<Persona | null>(null);
  const [notasNotarialesTexto, setNotasNotarialesTexto] = useState('');
  const [feedbackNotas, setFeedbackNotas] = useState('');

  // Personas físicas disponibles para Representante Legal
  const personasFisicas = useMemo(() => {
    return listaPersonas.filter(p => p.tipo_persona === 'física');
  }, [listaPersonas]);

  // Al seleccionar cliente para expediente, cargar sus notas
  useEffect(() => {
    if (clienteExpediente) {
      setNotasNotarialesTexto(clienteExpediente.notas_notariales || '');
      setFeedbackNotas('');
    }
  }, [clienteExpediente]);

  // Sincronizar si se recibe initialEditingId externo
  useEffect(() => {
    if (initialEditingId) {
      const encontrada = listaPersonas.find(p => p.id === initialEditingId);
      if (encontrada) {
        handleEditPersona(encontrada);
      }
    }
  }, [initialEditingId, listaPersonas]);

  // Sincronización continua de listaPersonas con props recibidas
  useEffect(() => {
    if (personas && personas.length > 0) {
      setListaPersonas(personas);
    }
  }, [personas]);

  // Sincronización con eventos globales de almacenamiento
  useEffect(() => {
    const handlePersonasEvent = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setListaPersonas(e.detail);
      }
    };
    window.addEventListener('olga_personas_updated', handlePersonasEvent);
    return () => {
      window.removeEventListener('olga_personas_updated', handlePersonasEvent);
    };
  }, []);

  const resetFormulario = () => {
    setEditingId(null);
    setTipoPersona('física');
    setNombre('');
    setApellido('');
    setNroDocumento('');
    setRepresentanteId('');
    setTelefono('');
    setEmail('');
    setDomicilio('');
    setErrorMsg('');
  };

  // Iniciar edición de una persona
  const handleEditPersona = (persona: Persona) => {
    setEditingId(persona.id);
    setTipoPersona(persona.tipo_persona);
    setNombre(persona.nombre || '');
    setApellido(persona.apellido || '');
    setNroDocumento(persona.nro_documento || '');
    setRepresentanteId(persona.representante_id || '');
    setTelefono(persona.telefono || '');
    setEmail(persona.email || '');
    setDomicilio(persona.domicilio || '');
    setErrorMsg('');
    setSuccessMsg('');
    
    const formElement = document.getElementById('formulario-persona');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Abrir Expediente 360° de un cliente
  const handleAbrirExpediente = (persona: Persona) => {
    setClienteExpediente(persona);
  };

  // Guardar notas notariales del expediente en localStorage
  const handleGuardarNotasExpediente = () => {
    if (!clienteExpediente) return;

    const personaActualizada: Persona = {
      ...clienteExpediente,
      notas_notariales: notasNotarialesTexto.trim()
    };

    const nuevaLista = listaPersonas.map(p => 
      p.id === clienteExpediente.id ? personaActualizada : p
    );

    guardarListaPersistente(nuevaLista);
    setClienteExpediente(personaActualizada);

    if (onUpdatePersona) {
      onUpdatePersona(personaActualizada);
    }

    setFeedbackNotas('Notas notariales archivadas en el expediente del cliente.');
    setTimeout(() => setFeedbackNotas(''), 3500);
  };

  // Eliminar persona del estado local y localStorage
  const handleDeletePersona = (id: string) => {
    const personaEliminar = listaPersonas.find(p => p.id === id);
    const esRepresentante = listaPersonas.some(p => p.representante_id === id);
    
    if (esRepresentante) {
      const confirmar = window.confirm(
        'Esta persona física figura como Representante Legal de una entidad jurídica registrada. ¿Deseas eliminarla igualmente?'
      );
      if (!confirmar) return;
    }

    const nuevaLista = listaPersonas.filter(p => p.id !== id);
    guardarListaPersistente(nuevaLista);

    if (onDeletePersona) {
      onDeletePersona(id);
    }
    if (editingId === id) {
      resetFormulario();
    }
    if (clienteExpediente?.id === id) {
      setClienteExpediente(null);
    }

    setSuccessMsg(`Registro ${personaEliminar ? `"${personaEliminar.nombre}"` : ''} eliminado exitosamente.`);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  // Guardar persona (Crear o Actualizar)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Validación Básica
    if (!nombre.trim()) {
      setErrorMsg(tipoPersona === 'física' ? 'El Nombre es obligatorio.' : 'La Razón Social es obligatoria.');
      return;
    }

    if (tipoPersona === 'física' && !apellido.trim()) {
      setErrorMsg('El Apellido es obligatorio para personas físicas.');
      return;
    }

    if (!nroDocumento.trim()) {
      setErrorMsg('El número de documento (C.I. o R.U.C.) es obligatorio.');
      return;
    }

    // Validar duplicado de documento
    const docClean = nroDocumento.trim().toLowerCase();
    const duplicado = listaPersonas.find(
      p => p.nro_documento.trim().toLowerCase() === docClean && p.id !== editingId
    );
    if (duplicado) {
      setErrorMsg(`Error: El número de documento "${nroDocumento.trim()}" ya está registrado a nombre de "${duplicado.nombre}".`);
      return;
    }

    // Validar representante legal para personas jurídicas
    if (tipoPersona === 'jurídica' && !representanteId) {
      setErrorMsg('Es obligatorio designar un Representante Legal (Persona Física) para toda Persona Jurídica.');
      return;
    }

    const registroFinal: Persona = {
      id: editingId || `p-${Date.now()}`,
      tipo_persona: tipoPersona,
      nombre: nombre.trim(),
      apellido: tipoPersona === 'física' ? apellido.trim() : undefined,
      tipo_documento: tipoPersona === 'física' ? 'CI' : 'RUC',
      nro_documento: nroDocumento.trim(),
      telefono: telefono.trim(),
      email: email.trim(),
      domicilio: domicilio.trim(),
      representante_id: tipoPersona === 'jurídica' ? representanteId : undefined,
      origen: tipoPersona === 'jurídica' ? 'DNIT' : 'MANUAL',
      notas_notariales: editingId ? listaPersonas.find(p => p.id === editingId)?.notas_notariales : undefined
    };

    let nuevaLista: Persona[];
    if (editingId) {
      nuevaLista = listaPersonas.map(p => p.id === editingId ? registroFinal : p);
      if (onUpdatePersona) onUpdatePersona(registroFinal);
      setSuccessMsg(`Datos de "${registroFinal.nombre}" actualizados exitosamente.`);
    } else {
      nuevaLista = [registroFinal, ...listaPersonas];
      if (onAddPersona) onAddPersona(registroFinal);
      setSuccessMsg(`Persona "${registroFinal.nombre}" registrada en el fichero.`);
    }

    guardarListaPersistente(nuevaLista);
    resetFormulario();
    setTimeout(() => setSuccessMsg(''), 4000);

    if (onClose && editingId) {
      onClose();
    }
  };

  // 5. Filtrado en tiempo real con .filter()
  const listaFiltrada = useMemo(() => {
    return listaPersonas.filter(p => {
      if (filtroTipo !== 'todos' && p.tipo_persona !== filtroTipo) {
        return false;
      }

      const term = searchTerm.trim().toLowerCase();
      if (!term) return true;

      const nombreMatch = (p.nombre || '').toLowerCase().includes(term);
      const apellidoMatch = (p.apellido || '').toLowerCase().includes(term);
      const docMatch = (p.nro_documento || '').toLowerCase().includes(term);
      const emailMatch = (p.email || '').toLowerCase().includes(term);

      return nombreMatch || apellidoMatch || docMatch || emailMatch;
    });
  }, [listaPersonas, searchTerm, filtroTipo]);

  const conteoFisicas = useMemo(() => listaPersonas.filter(p => p.tipo_persona === 'física').length, [listaPersonas]);
  const conteoJuridicas = useMemo(() => listaPersonas.filter(p => p.tipo_persona === 'jurídica').length, [listaPersonas]);

  // 6. Lógica de Expediente 360° para el cliente seleccionado
  const instrumentosVinculados = useMemo(() => {
    if (!clienteExpediente) return [];
    const id = clienteExpediente.id;
    const docLimpio = clienteExpediente.nro_documento.replace(/[^\d]/g, '');
    const nombreCompleto = `${clienteExpediente.nombre} ${clienteExpediente.apellido || ''}`.trim().toLowerCase();

    return pagaresEfectivos.filter(p => {
      if (p.status === 'anulado' || p.estado === 'Anulado') return false;

      const docAcreedor = (p.acreedor_documento_raw || '').replace(/[^\d]/g, '');
      const docDeudor = (p.deudor_documento_raw || '').replace(/[^\d]/g, '');

      const esDeudor = p.deudor_id === id || 
        (docLimpio && docDeudor === docLimpio) ||
        (p.deudor_nombre_raw && p.deudor_nombre_raw.toLowerCase().includes(clienteExpediente.nombre.toLowerCase()));

      const esAcreedor = p.acreedor_id === id ||
        (docLimpio && docAcreedor === docLimpio) ||
        (p.acreedor_nombre_raw && p.acreedor_nombre_raw.toLowerCase().includes(clienteExpediente.nombre.toLowerCase()));

      const esCodeudor = p.codeudor1_id === id || p.codeudor2_id === id;

      return esDeudor || esAcreedor || esCodeudor;
    });
  }, [clienteExpediente, pagaresEfectivos]);

  // Resumen Financiero del Cliente 360°
  const resumenFinanciero = useMemo(() => {
    if (!clienteExpediente) return { totalDeudas: 0, totalPagado: 0, saldoPendiente: 0, totalAcreencias: 0 };
    
    let totalDeudas = 0;
    let totalPagado = 0;
    let totalAcreencias = 0;

    const id = clienteExpediente.id;
    const docLimpio = clienteExpediente.nro_documento.replace(/[^\d]/g, '');

    instrumentosVinculados.forEach(p => {
      const docDeudor = (p.deudor_documento_raw || '').replace(/[^\d]/g, '');
      const esDeudor = p.deudor_id === id || (docLimpio && docDeudor === docLimpio) || 
        (p.deudor_nombre_raw && p.deudor_nombre_raw.toLowerCase().includes(clienteExpediente.nombre.toLowerCase()));

      const docAcreedor = (p.acreedor_documento_raw || '').replace(/[^\d]/g, '');
      const esAcreedor = p.acreedor_id === id || (docLimpio && docAcreedor === docLimpio) ||
        (p.acreedor_nombre_raw && p.acreedor_nombre_raw.toLowerCase().includes(clienteExpediente.nombre.toLowerCase()));

      if (esDeudor) {
        totalDeudas += (p.valor_total || 0);
        if (p.cronograma && Array.isArray(p.cronograma)) {
          p.cronograma.forEach(cuota => {
            if (cuota.pagado || cuota.estado === 'cobrado') {
              totalPagado += (cuota.monto || 0);
            }
          });
        }
      }

      if (esAcreedor) {
        totalAcreencias += (p.valor_total || 0);
      }
    });

    const saldoPendiente = Math.max(0, totalDeudas - totalPagado);
    return { totalDeudas, totalPagado, saldoPendiente, totalAcreencias };
  }, [clienteExpediente, instrumentosVinculados]);

  // Buscar representante legal del cliente del expediente si es jurídica
  const representanteDelExpediente = useMemo(() => {
    if (!clienteExpediente || clienteExpediente.tipo_persona !== 'jurídica' || !clienteExpediente.representante_id) {
      return null;
    }
    return listaPersonas.find(p => p.id === clienteExpediente.representante_id);
  }, [clienteExpediente, listaPersonas]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 bg-slate-50 min-h-screen">
      {/* Cabecera Notarial Enterprise */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700 text-[#FF3131] shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold font-serif tracking-tight text-white">Directorio de Personas & Expedientes 360°</h2>
            <p className="text-slate-300 text-xs mt-0.5">
              Fichero unificado con consulta de historial crediticio, resumen de obligaciones y notas notariales.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-slate-800 text-slate-300 border border-slate-700 rounded-full text-xs font-semibold">
            {listaPersonas.length} {listaPersonas.length === 1 ? 'Cliente Registrado' : 'Clientes Registrados'}
          </span>
        </div>
      </div>

      {/* Cartel Reglamentario Notarial */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl flex items-start gap-3 shadow-sm">
        <ShieldCheck className="w-5 h-5 text-[#FF3131] shrink-0 mt-0.5" />
        <div className="text-xs text-slate-600 leading-relaxed">
          <strong className="text-slate-900 block mb-0.5">Aviso Notarial de Resguardo y Validación:</strong>
          La identificación de comparecientes y representantes legales incorporados en este directorio constituye un borrador de datos preparatorios. Requiere la certificación de identidad, verificación de personería y sello del <strong>Escribano Titular</strong> para poseer validez legal administrativa.
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Formulario de Registro / Edición */}
        <div id="formulario-persona" className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-fit space-y-5">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              {editingId ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}
            </h3>
            {editingId && (
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-slate-100 text-slate-700 border border-slate-300">
                Edición Activa
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Selector de Tipo de Persona */}
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1.5 tracking-wider">
                Tipo de Persona *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTipoPersona('física');
                    setErrorMsg('');
                  }}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                    tipoPersona === 'física'
                      ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Física</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTipoPersona('jurídica');
                    setErrorMsg('');
                  }}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                    tipoPersona === 'jurídica'
                      ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>Jurídica</span>
                </button>
              </div>
            </div>

            {/* Campos condicionales */}
            {tipoPersona === 'física' ? (
              <>
                {/* Nombre y Apellido para Física */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1 tracking-wider">
                      Nombre(s) *
                    </label>
                    <input
                      type="text"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Ej. Juan Carlos"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl p-2.5 text-xs font-bold text-slate-900 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1 tracking-wider">
                      Apellido(s) *
                    </label>
                    <input
                      type="text"
                      value={apellido}
                      onChange={(e) => setApellido(e.target.value)}
                      placeholder="Ej. Pérez Gómez"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl p-2.5 text-xs font-bold text-slate-900 outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* C.I. */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1 tracking-wider">
                    Cédula de Identidad (C.I.) *
                  </label>
                  <input
                    type="text"
                    value={nroDocumento}
                    onChange={(e) => setNroDocumento(e.target.value)}
                    placeholder="Ej. 1.234.567"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl p-2.5 text-xs font-bold text-slate-900 outline-none transition-colors font-mono"
                  />
                </div>
              </>
            ) : (
              <>
                {/* Razón Social */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1 tracking-wider">
                    Razón Social *
                  </label>
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. Agroganadera del Este S.A."
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl p-2.5 text-xs font-bold text-slate-900 outline-none transition-colors"
                  />
                </div>

                {/* R.U.C. */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1 tracking-wider">
                    R.U.C. *
                  </label>
                  <input
                    type="text"
                    value={nroDocumento}
                    onChange={(e) => setNroDocumento(e.target.value)}
                    placeholder="Ej. 80012345-6"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl p-2.5 text-xs font-bold text-slate-900 outline-none transition-colors font-mono"
                  />
                </div>

                {/* Selector de Representante Legal */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-slate-700" />
                    <label className="block text-[11px] font-bold uppercase text-slate-700 tracking-wider">
                      Representante Legal (Persona Física) *
                    </label>
                  </div>
                  <select
                    value={representanteId}
                    onChange={(e) => setRepresentanteId(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-[#FF3131] rounded-xl p-2.5 text-xs font-bold text-slate-900 outline-none transition-colors"
                  >
                    <option value="">-- Seleccionar Persona Física Firmante --</option>
                    {personasFisicas.map(pf => (
                      <option key={pf.id} value={pf.id}>
                        {pf.nombre} {pf.apellido || ''} (C.I. {pf.nro_documento})
                      </option>
                    ))}
                  </select>
                  {personasFisicas.length === 0 ? (
                    <p className="text-[10px] text-red-600 font-semibold leading-normal pt-0.5">
                      Aviso: Registra primero una Persona Física para poder asignarla como Representante Legal.
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-500 leading-normal">
                      Exigencia notarial: toda persona jurídica compareciente requiere apoderado firmante físico.
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Teléfono y Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1 tracking-wider">
                  Teléfono
                </label>
                <input
                  type="text"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="+595 981 ..."
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl p-2.5 text-xs text-slate-900 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1 tracking-wider">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@..."
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl p-2.5 text-xs text-slate-900 outline-none transition-colors"
                />
              </div>
            </div>

            {/* Domicilio */}
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1 tracking-wider">
                Domicilio / Dirección Notarial
              </label>
              <textarea
                value={domicilio}
                onChange={(e) => setDomicilio(e.target.value)}
                rows={2}
                placeholder="Dirección real, legal o comercial..."
                className="w-full bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl p-2.5 text-xs text-slate-900 outline-none resize-none transition-colors"
              />
            </div>

            {/* Validación y Alertas Visuales */}
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs font-bold text-red-700 animate-pulse">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3 bg-slate-100 border border-slate-300 rounded-xl flex items-center gap-2 text-xs font-bold text-slate-900">
                <Check className="w-4 h-4 text-[#FF3131] shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Botones de Acción */}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 py-3 bg-[#FF3131] hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm transition-colors flex items-center justify-center gap-1.5"
              >
                {editingId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{editingId ? 'Guardar Cambios' : 'Registrar Persona'}</span>
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetFormulario}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Directorio Enterprise con Buscador y Filtros */}
        <div className="xl:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Directorio Enterprise ({listaFiltrada.length})
              </h3>
              <p className="text-[11px] text-slate-500">Haz clic en cualquier cliente para ver su Expediente 360°</p>
            </div>
            
            {/* Buscador Local Reactivo */}
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                placeholder="Buscar por nombre, CI, RUC..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-900 outline-none transition-colors"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filtros Rápidos por Categoría */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <button
              type="button"
              onClick={() => setFiltroTipo('todos')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                filtroTipo === 'todos' 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({listaPersonas.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltroTipo('física')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                filtroTipo === 'física' 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Físicas ({conteoFisicas})
            </button>
            <button
              type="button"
              onClick={() => setFiltroTipo('jurídica')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                filtroTipo === 'jurídica' 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Jurídicas ({conteoJuridicas})
            </button>
          </div>

          {/* Tabla de Directorio Enterprise */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  <th className="py-3 px-3">Cliente / Interviniente</th>
                  <th className="py-3 px-3">Tipo / Documento</th>
                  <th className="py-3 px-3">Contacto</th>
                  <th className="py-3 px-3">Representante Legal</th>
                  <th className="py-3 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {listaFiltrada.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="font-bold text-sm text-slate-600">No se encontraron registros coincidentes.</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {searchTerm ? 'Intenta modificar el término de búsqueda o limpiar filtros.' : 'Registra el primer cliente con el formulario.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  listaFiltrada.map((p) => {
                    const repLegal = p.tipo_persona === 'jurídica' && p.representante_id
                      ? listaPersonas.find(rep => rep.id === p.representante_id)
                      : null;

                    const nombreCompleto = p.tipo_persona === 'física' 
                      ? `${p.nombre} ${p.apellido || ''}`.trim() 
                      : p.nombre;

                    return (
                      <tr 
                        key={p.id} 
                        onClick={() => handleAbrirExpediente(p)}
                        className={`hover:bg-slate-100/70 transition-colors cursor-pointer group ${editingId === p.id ? 'bg-red-50/40' : ''}`}
                        title="Haz clic para abrir el Expediente 360°"
                      >
                        {/* Nombre / Interviniente */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200 group-hover:border-[#FF3131] transition-colors">
                              {p.tipo_persona === 'física' ? (
                                <User className="w-4 h-4" />
                              ) : (
                                <Building className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 leading-tight group-hover:text-[#FF3131] transition-colors">
                                  {nombreCompleto}
                                </span>
                              </div>
                              {p.domicilio && (
                                <span className="text-[10px] text-slate-500 truncate max-w-[180px] block" title={p.domicilio}>
                                  {p.domicilio}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Tipo y Documento */}
                        <td className="py-3 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider mb-0.5 ${
                            p.tipo_persona === 'física' 
                              ? 'bg-slate-100 text-slate-800 border border-slate-200' 
                              : 'bg-slate-800 text-white'
                          }`}>
                            {p.tipo_persona}
                          </span>
                          <span className="text-slate-800 font-mono font-bold block text-[11px]">
                            {p.tipo_documento}: {p.nro_documento}
                          </span>
                        </td>

                        {/* Contacto */}
                        <td className="py-3 px-3 text-[11px] text-slate-600">
                          {p.telefono && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{p.telefono}</span>
                            </div>
                          )}
                          {p.email && (
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[150px]" title={p.email}>{p.email}</span>
                            </div>
                          )}
                          {!p.telefono && !p.email && (
                            <span className="text-slate-400 italic text-[10px]">Sin contacto</span>
                          )}
                        </td>

                        {/* Representante Legal */}
                        <td className="py-3 px-3 text-xs">
                          {p.tipo_persona === 'jurídica' ? (
                            repLegal ? (
                              <div>
                                <span className="font-bold text-slate-900 block leading-tight">
                                  {repLegal.nombre} {repLegal.apellido || ''}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  CI: {repLegal.nro_documento}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded inline-block">
                                Sin Asignar
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">No aplica (Física)</span>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleAbrirExpediente(p)}
                              className="px-2.5 py-1.5 text-xs font-bold rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1"
                              title="Ver Expediente 360°"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#FF3131]" />
                              <span className="hidden sm:inline">360°</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditPersona(p)}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Editar registro"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePersona(p.id)}
                              className="p-1.5 text-slate-400 hover:text-[#FF3131] hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar registro"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ================= MODAL EXPEDIENTE 360° DEL CLIENTE ================= */}
      {clienteExpediente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-in">
            
            {/* Cabecera del Modal Expediente */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 rounded-xl text-[#FF3131] border border-slate-700">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold font-serif text-white">Expediente Notarial 360°</h3>
                    <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded bg-[#FF3131] text-white">
                      Legajo #{clienteExpediente.id.replace('p-', '')}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs">
                    Auditoría de obligaciones, contratos notariales y antecedentes
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setClienteExpediente(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                title="Cerrar Expediente"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido con Scroll del Expediente */}
            <div className="p-6 space-y-6 overflow-y-auto flex-grow bg-slate-50/50">
              
              {/* 1. Cabecera de Identificación del Cliente */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-800 border border-slate-200 flex items-center justify-center shrink-0">
                      {clienteExpediente.tipo_persona === 'física' ? (
                        <User className="w-7 h-7 text-slate-700" />
                      ) : (
                        <Building className="w-7 h-7 text-[#FF3131]" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-black text-slate-900">
                          {clienteExpediente.tipo_persona === 'física' 
                            ? `${clienteExpediente.nombre} ${clienteExpediente.apellido || ''}`.trim()
                            : clienteExpediente.nombre}
                        </h4>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          clienteExpediente.tipo_persona === 'física' 
                            ? 'bg-slate-100 text-slate-800 border border-slate-200' 
                            : 'bg-slate-900 text-white'
                        }`}>
                          Persona {clienteExpediente.tipo_persona}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono font-bold mt-0.5">
                        {clienteExpediente.tipo_documento}: {clienteExpediente.nro_documento}
                      </p>
                    </div>
                  </div>

                  {clienteExpediente.tipo_persona === 'jurídica' && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">
                        Representante Legal Autorizado
                      </span>
                      {representanteDelExpediente ? (
                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          <UserCheck className="w-4 h-4 text-[#FF3131]" />
                          <span>{representanteDelExpediente.nombre} {representanteDelExpediente.apellido || ''}</span>
                          <span className="text-slate-500 font-mono text-[10px]">
                            (CI: {representanteDelExpediente.nro_documento})
                          </span>
                        </div>
                      ) : (
                        <span className="text-red-600 font-semibold text-[11px]">
                          Sin representante legal asignado
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{clienteExpediente.telefono || 'Sin teléfono registrado'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">{clienteExpediente.email || 'Sin correo registrado'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">{clienteExpediente.domicilio || 'Sin domicilio registrado'}</span>
                  </div>
                </div>
              </div>

              {/* 2. Resumen Financiero del Cliente */}
              <div>
                <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider mb-2.5">
                  Resumen Financiero Notarial
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Total Deudas */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-[10px] font-black uppercase tracking-wider">Total Obligaciones / Deuda</span>
                      <DollarSign className="w-4 h-4 text-slate-400" />
                    </div>
                    <p className="text-lg font-black text-slate-900">
                      {resumenFinanciero.totalDeudas.toLocaleString('es-PY')} <span className="text-xs font-semibold text-slate-500">Gs.</span>
                    </p>
                    <p className="text-[10px] text-slate-400">Pagarés donde figura como Deudor Principal</p>
                  </div>

                  {/* Cuotas Pagadas */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-[10px] font-black uppercase tracking-wider">Cuotas Amortizadas</span>
                      <CheckCircle2 className="w-4 h-4 text-slate-700" />
                    </div>
                    <p className="text-lg font-black text-slate-800">
                      {resumenFinanciero.totalPagado.toLocaleString('es-PY')} <span className="text-xs font-semibold text-slate-500">Gs.</span>
                    </p>
                    <p className="text-[10px] text-slate-400">Total recaudado / liquidado en término</p>
                  </div>

                  {/* Saldo Pendiente */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-[10px] font-black uppercase tracking-wider">Saldo Pendiente de Cobro</span>
                      <TrendingDown className="w-4 h-4 text-[#FF3131]" />
                    </div>
                    <p className="text-lg font-black text-[#FF3131]">
                      {resumenFinanciero.saldoPendiente.toLocaleString('es-PY')} <span className="text-xs font-semibold text-slate-500">Gs.</span>
                    </p>
                    <p className="text-[10px] text-slate-400">Capital pendiente de vencimiento o cobro</p>
                  </div>
                </div>
              </div>

              {/* 3. Historial de Pagarés e Instrumentos */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#FF3131]" />
                    <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                      Historial de Pagarés e Instrumentos Vinculados ({instrumentosVinculados.length})
                    </h4>
                  </div>
                </div>

                {instrumentosVinculados.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-1">
                    <FileText className="w-6 h-6 mx-auto text-slate-300" />
                    <p className="font-bold text-slate-700">No registra pagarés vigentes</p>
                    <p className="text-[11px] text-slate-400">Este cliente aún no ha sido vinculado como acreedor, deudor o codeudor en ningún instrumento.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          <th className="py-2.5 px-3">Instrumento</th>
                          <th className="py-2.5 px-3">Rol del Cliente</th>
                          <th className="py-2.5 px-3">Contraparte</th>
                          <th className="py-2.5 px-3">Monto Total</th>
                          <th className="py-2.5 px-3">Estado</th>
                          <th className="py-2.5 px-3">Cronograma</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {instrumentosVinculados.map(pag => {
                          const docLimpio = clienteExpediente.nro_documento.replace(/[^\d]/g, '');
                          const docDeudor = (pag.deudor_documento_raw || '').replace(/[^\d]/g, '');
                          const docAcreedor = (pag.acreedor_documento_raw || '').replace(/[^\d]/g, '');

                          const esDeudor = pag.deudor_id === clienteExpediente.id || 
                            (docLimpio && docDeudor === docLimpio) ||
                            (pag.deudor_nombre_raw && pag.deudor_nombre_raw.toLowerCase().includes(clienteExpediente.nombre.toLowerCase()));

                          const esAcreedor = pag.acreedor_id === clienteExpediente.id ||
                            (docLimpio && docAcreedor === docLimpio) ||
                            (pag.acreedor_nombre_raw && pag.acreedor_nombre_raw.toLowerCase().includes(clienteExpediente.nombre.toLowerCase()));

                          const rol = esDeudor ? 'Deudor Principal' : esAcreedor ? 'Acreedor' : 'Co-Deudor';
                          const contraparte = esDeudor ? pag.acreedor_nombre_raw : pag.deudor_nombre_raw;

                          const cuotasPagas = pag.cronograma ? pag.cronograma.filter(c => c.pagado || c.estado === 'cobrado').length : 0;
                          const totalCuotas = pag.cronograma ? pag.cronograma.length : 0;

                          return (
                            <tr key={pag.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-3">
                                <span className="font-bold text-slate-900 block font-mono">
                                  Pagaré #{pag.correlativo}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {pag.certificado_firmas_nro ? `Cert. ${pag.certificado_firmas_nro}` : 'Sin cert.'}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                  esDeudor 
                                    ? 'bg-red-50 text-red-700 border border-red-200' 
                                    : 'bg-slate-100 text-slate-800 border border-slate-200'
                                }`}>
                                  {rol}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-slate-700 font-semibold truncate max-w-[160px]" title={contraparte}>
                                {contraparte || 'Sin especificar'}
                              </td>
                              <td className="py-3 px-3 font-bold text-slate-900">
                                {pag.valor_total?.toLocaleString('es-PY')} {pag.moneda || 'PYG'}
                              </td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                                  {pag.estado || 'Pendiente'}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <span className="text-[11px] font-bold text-slate-700 font-mono">
                                  {cuotasPagas}/{totalCuotas} cuotas
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 4. Notas Notariales / Observaciones (Guardable en localStorage) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-700" />
                    <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                      Notas Notariales & Observaciones del Titular
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Guardado persistente en almacenamiento local
                  </span>
                </div>

                <textarea
                  rows={3}
                  value={notasNotarialesTexto}
                  onChange={(e) => setNotasNotarialesTexto(e.target.value)}
                  placeholder="Registra antecedentes notariales, cumplimiento de obligaciones, poderes presentados o cualquier observación relevante para la Escribanía..."
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#FF3131] rounded-xl p-3 text-xs text-slate-900 outline-none resize-none transition-colors"
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                  {feedbackNotas ? (
                    <span className="text-xs font-bold text-slate-900 bg-slate-100 border border-slate-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-[#FF3131]" />
                      <span>{feedbackNotas}</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">
                      Estas observaciones son estrictamente de uso interno para la Notaría.
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleGuardarNotasExpediente}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5 text-[#FF3131]" />
                    <span>Guardar Notas</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Footer del Modal */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-semibold hidden sm:inline">
                Expediente vinculado a {clienteExpediente.nombre}
              </span>
              <button
                type="button"
                onClick={() => setClienteExpediente(null)}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#FF3131] hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm text-center"
              >
                Cerrar Expediente
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
