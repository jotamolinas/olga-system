import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Banknote,
  Printer,
  Plus,
  Trash2,
  Save,
  Check,
  RefreshCw,
  FileText,
  User,
  Building,
  CreditCard,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Calculator,
  ArrowLeft,
  Settings,
  Edit3,
  X,
  Mail,
  Phone,
  MapPin,
  Clock,
  Search,
  Sparkles,
  Loader2,
  UserCheck,
  Users,
  ChevronDown,
} from 'lucide-react';
import {
  EncabezadoFacturaPresupuesto,
  ItemTasaReembolso,
  ItemServicioHonorario,
  TipoComprobante,
  CondicionVenta,
  TipoIvaNotarial,
  CategoriaTasaReembolso,
  MembreteEscribaniaConfig,
  ENCABEZADO_INICIAL,
  ITEMS_TASAS_REEMBOLSO_BASE,
  ITEMS_SERVICIOS_HONORARIOS_BASE,
  calcularLiquidacionPresupuesto,
  cargarMembreteUsuario,
  guardarMembreteUsuario,
  MEMBRETE_DEFAULT,
} from '../types/presupuesto';
import { Persona, TipoPersona } from '../types';
import { consultarRUC, formatearRUCConDV, calcularDVParaguay } from '../services/dnitService';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/auth';

const STORAGE_KEY_PERSONAS = 'olga_directorio_personas';

interface ModuloPresupuestosProps {
  onVolver?: () => void;
  userId?: string;
  userProfile?: any;
  onIrAConfiguracion?: () => void;
  escribaniaNombre?: string;
  registroNotarial?: string;
  rucEscribania?: string;
  direccionEscribania?: string;
  telefonoEscribania?: string;
  esPlanFull?: boolean;
}

export const ModuloPresupuestos: React.FC<ModuloPresupuestosProps> = ({
  onVolver,
  userId,
  userProfile,
  onIrAConfiguracion,
  escribaniaNombre = 'Escribanía Notarial Titular',
  registroNotarial = 'Reg. Nº 1.292',
  rucEscribania = '80012345-6',
  direccionEscribania = 'Asunción, República del Paraguay',
  telefonoEscribania = '+595 21 000-000',
  esPlanFull,
}) => {
  const planUsuario = String(userProfile?.planActual || userProfile?.plan || '').toLowerCase().trim();
  const esFull = esPlanFull !== undefined ? esPlanFull : planUsuario.includes('full');

  // Estado dinámico del Membrete Institucional (Multi-usuario)
  const [membrete, setMembrete] = useState<MembreteEscribaniaConfig>(() => {
    const cargado = cargarMembreteUsuario(userId);
    return {
      ...cargado,
      nombreNotario: cargado.nombreNotario || userProfile?.nombreTitular || escribaniaNombre || MEMBRETE_DEFAULT.nombreNotario,
      registroNotarial: cargado.registroNotarial || userProfile?.registroNotarial || registroNotarial || MEMBRETE_DEFAULT.registroNotarial,
      ruc: cargado.ruc || userProfile?.ruc || rucEscribania || MEMBRETE_DEFAULT.ruc,
      direccion: cargado.direccion || userProfile?.direccion || direccionEscribania || MEMBRETE_DEFAULT.direccion,
      telefono: cargado.telefono || userProfile?.telefono || telefonoEscribania || MEMBRETE_DEFAULT.telefono,
      email: cargado.email || userProfile?.email || MEMBRETE_DEFAULT.email,
      timbradoNumero: cargado.timbradoNumero || userProfile?.timbradoNumero || MEMBRETE_DEFAULT.timbradoNumero,
      timbradoVigenciaInicio: cargado.timbradoVigenciaInicio || userProfile?.timbradoVigenciaInicio || MEMBRETE_DEFAULT.timbradoVigenciaInicio,
      timbradoVigenciaFin: cargado.timbradoVigenciaFin || userProfile?.timbradoVigenciaFin || MEMBRETE_DEFAULT.timbradoVigenciaFin,
    };
  });

  // Modal para edición rápida de membrete dentro del módulo de facturación
  const [modalMembreteAbierto, setModalMembreteAbierto] = useState(false);
  // Estados para el Modal de Previsualización e Impresión Notarial Oficial (A4 / Oficio)
  const [modalImpresionAbierto, setModalImpresionAbierto] = useState(false);
  const [formatoPapel, setFormatoPapel] = useState<'a4' | 'oficio'>('a4');
  const [membreteDraft, setMembreteDraft] = useState<MembreteEscribaniaConfig>(membrete);

  // Sincronización reactiva del membrete ante cambios en configuración o cambio de usuario
  useEffect(() => {
    const cargado = cargarMembreteUsuario(userId);
    setMembrete(cargado);
    setMembreteDraft(cargado);

    const handleActualizacion = (e: any) => {
      const configNueva = e.detail?.config || cargarMembreteUsuario(userId);
      setMembrete(configNueva);
      setMembreteDraft(configNueva);
    };

    window.addEventListener('olga_escribania_updated', handleActualizacion);
    return () => {
      window.removeEventListener('olga_escribania_updated', handleActualizacion);
    };
  }, [userId]);

  // Estado de encabezado
  const [encabezado, setEncabezado] = useState<EncabezadoFacturaPresupuesto>(() => {
    try {
      const guardado = localStorage.getItem('olga_presupuesto_encabezado');
      if (guardado) return JSON.parse(guardado);
    } catch (e) {
      console.warn('Error leyendo encabezado guardado:', e);
    }
    return {
      ...ENCABEZADO_INICIAL,
      timbrado: membrete.timbradoNumero || ENCABEZADO_INICIAL.timbrado,
      fechaVencimientoValidez: membrete.timbradoVigenciaFin || ENCABEZADO_INICIAL.fechaVencimientoValidez,
    };
  });

  // Estado de Tasas y Reembolsos
  const [tasas, setTasas] = useState<ItemTasaReembolso[]>(() => {
    try {
      const guardado = localStorage.getItem('olga_presupuesto_tasas');
      if (guardado) return JSON.parse(guardado);
    } catch (e) {
      console.warn('Error leyendo tasas guardadas:', e);
    }
    return ITEMS_TASAS_REEMBOLSO_BASE;
  });

  // Estado de Servicios y Honorarios
  const [servicios, setServicios] = useState<ItemServicioHonorario[]>(() => {
    try {
      const guardado = localStorage.getItem('olga_presupuesto_servicios');
      if (guardado) return JSON.parse(guardado);
    } catch (e) {
      console.warn('Error leyendo servicios guardados:', e);
    }
    return ITEMS_SERVICIOS_HONORARIOS_BASE;
  });

  // Observaciones y condiciones de pago
  const [observaciones, setObservaciones] = useState<string>(() => {
    try {
      const guardado = localStorage.getItem('olga_presupuesto_observaciones');
      if (guardado) return guardado;
    } catch {}
    return 'Validez del presupuesto: 30 días a partir de la fecha de emisión. Los importes correspondientes a Tasas Judiciales, Aranceles de Registro e Impuestos Municipales se basan en las liquidaciones oficiales y están sujetos a variaciones tributarias.';
  });

  const [guardadoExito, setGuardadoExito] = useState(false);
  const [guardandoFirestore, setGuardandoFirestore] = useState(false);
  const [pestañaActiva, setPestañaActiva] = useState<'todo' | 'tasas' | 'servicios' | 'resumen'>('todo');

  // Estados para Fichero Notarial y Servicio DNIT (Parte 2)
  const [cargandoDnit, setCargandoDnit] = useState(false);
  const [feedbackDnit, setFeedbackDnit] = useState<{ tipo: 'success' | 'warning' | 'info'; mensaje: string } | null>(null);
  const [origenCliente, setOrigenCliente] = useState<'MANUAL' | 'DNIT' | 'FICHERO'>('MANUAL');
  const [clienteAutoguardado, setClienteAutoguardado] = useState(false);
  const [mostrarSugerenciasFichero, setMostrarSugerenciasFichero] = useState(false);
  const [ficheroPersonas, setFicheroPersonas] = useState<Persona[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PERSONAS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  // Preferencia de visualización: Fondo Blanco Notarial o Modo Oscuro (administrado desde Configuraciones)
  const [modoFondoBlanco, setModoFondoBlanco] = useState<boolean>(() => {
    try {
      const storedTheme = localStorage.getItem('olga_theme');
      if (storedTheme) return storedTheme !== 'dark';
      const guardado = localStorage.getItem('olga_facturacion_fondo_blanco');
      if (guardado !== null) return JSON.parse(guardado);
    } catch {}
    return true; // Por defecto Fondo Notarial Blanco
  });

  const refBuscadorCliente = useRef<HTMLDivElement>(null);

  // Sincronización reactiva con la sección de Configuraciones
  useEffect(() => {
    const handleThemeChange = (e: any) => {
      if (e.detail?.modoFondoBlanco !== undefined) {
        setModoFondoBlanco(e.detail.modoFondoBlanco);
      }
    };
    window.addEventListener('olga_theme_changed', handleThemeChange);
    return () => window.removeEventListener('olga_theme_changed', handleThemeChange);
  }, []);

  // Carga y sincronización reactiva del Fichero de Personas
  useEffect(() => {
    const sincronizarPersonas = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_PERSONAS);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) setFicheroPersonas(parsed);
        }
      } catch {}
    };

    window.addEventListener('olga_persona_guardada', sincronizarPersonas);
    return () => {
      window.removeEventListener('olga_persona_guardada', sincronizarPersonas);
    };
  }, []);

  // Cerrar lista de sugerencias al hacer clic fuera del buscador
  useEffect(() => {
    const handleClickFuera = (e: MouseEvent) => {
      if (refBuscadorCliente.current && !refBuscadorCliente.current.contains(e.target as Node)) {
        setMostrarSugerenciasFichero(false);
      }
    };
    document.addEventListener('mousedown', handleClickFuera);
    return () => {
      document.removeEventListener('mousedown', handleClickFuera);
    };
  }, []);

  // Filtrado reactivo de clientes guardados en el Fichero
  const personasSugeridas = useMemo(() => {
    const term = (encabezado.clienteNombre || '').trim().toLowerCase();
    const docTerm = (encabezado.clienteRucCI || '').replace(/[.-]/g, '').toLowerCase().trim();
    if (!term && !docTerm) return ficheroPersonas.slice(0, 8);

    return ficheroPersonas
      .filter((p) => {
        const nom = (p.nombre || '').toLowerCase();
        const ape = (p.apellido || '').toLowerCase();
        const completo = `${nom} ${ape}`.trim();
        const doc = (p.nro_documento || '').replace(/[.-]/g, '').toLowerCase();
        return completo.includes(term) || (docTerm && doc.includes(docTerm));
      })
      .slice(0, 8);
  }, [ficheroPersonas, encabezado.clienteNombre, encabezado.clienteRucCI]);

  // Función de Autoguardado Inteligente y Silencioso en el Fichero de Personas
  const autoguardarClienteSilencioso = (datosClienteDirecto?: {
    nombre?: string;
    doc?: string;
    direccion?: string;
    telefono?: string;
    origen?: 'DNIT' | 'FICHERO' | 'MANUAL';
  }) => {
    const nombre = (datosClienteDirecto?.nombre || encabezado.clienteNombre || '').trim();
    const doc = (datosClienteDirecto?.doc || encabezado.clienteRucCI || '').trim();
    if (!nombre || !doc) return false;

    try {
      const stored = localStorage.getItem(STORAGE_KEY_PERSONAS);
      let lista: Persona[] = [];
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) lista = parsed;
        } catch {}
      }

      const docComparar = doc.replace(/[.-]/g, '').toLowerCase();
      const indice = lista.findIndex(
        (p) => (p.nro_documento || '').replace(/[.-]/g, '').toLowerCase() === docComparar
      );

      // Evaluación dinámica según normativa tributaria paraguaya:
      // Se limpian todos los caracteres no numéricos (puntos, guiones, espacios) antes de evaluar
      const ruc = doc;
      const rucLimpio = ruc.replace(/\D/g, '');
      const tipoPersonaResuelto: TipoPersona = rucLimpio.startsWith('800') ? 'jurídica' : 'física';
      const esJuridica = tipoPersonaResuelto === 'jurídica';

      let personaActualizada: Persona;
      if (indice >= 0) {
        personaActualizada = {
          ...lista[indice],
          tipo_persona: tipoPersonaResuelto,
          nombre: nombre,
          domicilio: datosClienteDirecto?.direccion || encabezado.clienteDireccion || lista[indice].domicilio || '',
          telefono: datosClienteDirecto?.telefono || encabezado.clienteTelefono || lista[indice].telefono || '',
          email: encabezado.clienteEmail || lista[indice].email || '',
        };
        lista[indice] = personaActualizada;
      } else {
        let nombreFisica = nombre;
        let apellidoFisica: string | undefined = undefined;

        if (!esJuridica) {
          const partes = nombre.split(/\s+/);
          if (partes.length >= 2) {
            const mid = Math.ceil(partes.length / 2);
            nombreFisica = partes.slice(0, mid).join(' ');
            apellidoFisica = partes.slice(mid).join(' ');
          }
        }

        personaActualizada = {
          id: `per-not-${Date.now()}`,
          tipo_persona: tipoPersonaResuelto,
          nombre: esJuridica ? nombre : nombreFisica,
          apellido: apellidoFisica,
          tipo_documento: doc.includes('-') ? 'RUC' : 'CI',
          nro_documento: doc,
          telefono: datosClienteDirecto?.telefono || encabezado.clienteTelefono || '',
          email: encabezado.clienteEmail || '',
          domicilio: datosClienteDirecto?.direccion || encabezado.clienteDireccion || '',
          representante_id: undefined,
          representanteLegal: tipoPersonaResuelto === 'física' ? 'No aplica' : 'Sin Asignar',
          responsable: null,
          origen: (datosClienteDirecto?.origen || origenCliente) === 'DNIT' ? 'DNIT' : 'MANUAL',
          fechaCreacion: new Date().toISOString(),
          userId: userId || 'default',
          notas_notariales: `Vinculado automáticamente desde ${encabezado.tipoComprobante} Nº ${encabezado.numeroComprobante} - Concepto: ${encabezado.conceptoGeneral || 'Servicios Notariales'} (${encabezado.fechaEmision})`,
        };
        lista.unshift(personaActualizada);
      }

      localStorage.setItem(STORAGE_KEY_PERSONAS, JSON.stringify(lista));
      setFicheroPersonas(lista);
      setClienteAutoguardado(true);
      setTimeout(() => setClienteAutoguardado(false), 3000);

      window.dispatchEvent(
        new CustomEvent('olga_persona_guardada', {
          detail: personaActualizada,
        })
      );
      return true;
    } catch (e) {
      console.warn('Error en autoguardado de cliente:', e);
      return false;
    }
  };

  // Selección rápida de cliente desde el Fichero Local
  const handleSeleccionarPersonaFichero = (persona: Persona) => {
    const nombreCompleto =
      persona.tipo_persona === 'física' && persona.apellido
        ? `${persona.nombre} ${persona.apellido}`.trim()
        : persona.nombre;

    setEncabezado((prev) => ({
      ...prev,
      clienteNombre: nombreCompleto,
      clienteRucCI: persona.nro_documento || prev.clienteRucCI,
      clienteDireccion: persona.domicilio || prev.clienteDireccion,
      clienteTelefono: persona.telefono || prev.clienteTelefono,
      clienteEmail: persona.email || prev.clienteEmail,
    }));
    setOrigenCliente('FICHERO');
    setMostrarSugerenciasFichero(false);
    setFeedbackDnit({
      tipo: 'success',
      mensaje: `Cliente cargado desde el Fichero Notarial: ${nombreCompleto}`,
    });
    setTimeout(() => setFeedbackDnit(null), 3500);
  };

  // Consulta directa al servicio DNIT para autocompletar Razón Social y Dirección
  const handleConsultarDNIT = async () => {
    const doc = (encabezado.clienteRucCI || '').trim();
    if (!doc || doc.length < 4) {
      setFeedbackDnit({
        tipo: 'warning',
        mensaje: 'Ingrese un RUC o Cédula válido (mínimo 4 caracteres) para consultar ante el DNIT / SET.',
      });
      setTimeout(() => setFeedbackDnit(null), 4000);
      return;
    }

    setCargandoDnit(true);
    setFeedbackDnit(null);
    try {
      const res = await consultarRUC(doc);
      if (res && res.nombre_o_razon_social) {
        setEncabezado((prev) => ({
          ...prev,
          clienteNombre: res.nombre_o_razon_social,
          clienteRucCI: res.dv ? `${res.documento_numero}-${res.dv}` : res.documento_numero,
          clienteDireccion: res.direccion || prev.clienteDireccion,
          clienteTelefono: res.telefono || prev.clienteTelefono,
        }));
        setOrigenCliente(res.origen === 'FICHERO' ? 'FICHERO' : 'DNIT');
        setFeedbackDnit({
          tipo: 'success',
          mensaje: `Contribuyente verificado (${res.origen === 'FICHERO' ? 'Fichero Local' : 'Padrón Oficial DNIT / SET'}): ${res.nombre_o_razon_social}`,
        });
        setTimeout(() => setFeedbackDnit(null), 4500);

        // Autoguardado silencioso instantáneo en el Fichero de Personas
        const docFormateado = res.dv ? `${res.documento_numero}-${res.dv}` : res.documento_numero;
        autoguardarClienteSilencioso({
          nombre: res.nombre_o_razon_social,
          doc: docFormateado,
          direccion: res.direccion,
          telefono: res.telefono,
          origen: res.origen === 'FICHERO' ? 'FICHERO' : 'DNIT',
        });
      } else {
        const docFormateado = formatearRUCConDV(doc);
        if (docFormateado) {
          setEncabezado(prev => ({ ...prev, clienteRucCI: docFormateado }));
        }
        setFeedbackDnit({
          tipo: 'warning',
          mensaje: docFormateado 
            ? `Dígito verificador asignado: ${docFormateado}. No figura en el padrón DNIT, complete datos.` 
            : 'Documento no localizado en el padrón de contribuyentes de la DNIT. Puede ingresar los datos manualmente.',
        });
        setTimeout(() => setFeedbackDnit(null), 4000);
      }
    } catch (err) {
      console.warn('Consulta DNIT no completada:', err);
      const docFormateado = formatearRUCConDV(doc);
      if (docFormateado) {
        setEncabezado(prev => ({ ...prev, clienteRucCI: docFormateado }));
      }
      setFeedbackDnit({
        tipo: 'warning',
        mensaje: 'No fue posible conectar con el servicio DNIT. Complete los datos manualmente.',
      });
      setTimeout(() => setFeedbackDnit(null), 3500);
    } finally {
      setCargandoDnit(false);
    }
  };

  // Liquidación tributaria en tiempo real
  const liquidacion = calcularLiquidacionPresupuesto(tasas, servicios);

  // Manejadores de Encabezado
  const handleActualizarEncabezado = (campo: keyof EncabezadoFacturaPresupuesto, valor: any) => {
    setEncabezado((prev) => ({ ...prev, [campo]: valor }));
  };

  // Manejadores de Tasas
  const handleToggleTasa = (id: string) => {
    setTasas((prev) =>
      prev.map((t) => (t.id === id ? { ...t, activo: !t.activo } : t))
    );
  };

  const handleEditarTasa = (id: string, campo: keyof ItemTasaReembolso, valor: any) => {
    setTasas((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [campo]: valor } : t))
    );
  };

  const handleAgregarTasa = () => {
    const nuevoId = `tasa-dinamica-${Date.now()}`;
    const nuevaTasa: ItemTasaReembolso = {
      id: nuevoId,
      categoria: 'otro',
      descripcion: 'Nueva tasa o arancel judicial/administrativo',
      monto: 0,
      tipoIva: 'exenta',
      activo: true,
      numeroComprobantePago: '',
      observacion: '',
    };
    setTasas((prev) => [...prev, nuevaTasa]);
  };

  const handleEliminarTasa = (id: string) => {
    setTasas((prev) => prev.filter((t) => t.id !== id));
  };

  // Manejadores de Servicios
  const handleToggleServicio = (id: string) => {
    setServicios((prev) =>
      prev.map((s) => (s.id === id ? { ...s, activo: !s.activo } : s))
    );
  };

  const handleEditarServicio = (id: string, campo: keyof ItemServicioHonorario, valor: any) => {
    setServicios((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const actualizado = { ...s, [campo]: valor };
        const cantidad = Number(campo === 'cantidad' ? valor : actualizado.cantidad) || 1;
        const precioUnitario = Number(campo === 'precioUnitario' ? valor : actualizado.precioUnitario) || 0;
        const total = cantidad * precioUnitario;
        const tipoIva = campo === 'tipoIva' ? valor : actualizado.tipoIva;

        return {
          ...actualizado,
          cantidad,
          precioUnitario,
          total,
          montoExento: tipoIva === 'exenta' ? total : 0,
          montoIva5: tipoIva === '5' ? total : 0,
          montoIva10: tipoIva === '10' ? total : 0,
        };
      })
    );
  };

  const handleAgregarServicio = () => {
    const nuevoId = `srv-dinamico-${Date.now()}`;
    const nuevoServicio: ItemServicioHonorario = {
      id: nuevoId,
      codigoConcepto: 'SERV-EXTRA',
      descripcion: 'Nuevo concepto de servicio o diligencia notarial',
      cantidad: 1,
      precioUnitario: 0,
      tipoIva: '10',
      montoExento: 0,
      montoIva5: 0,
      montoIva10: 0,
      total: 0,
      activo: true,
      esPersonalizado: true,
    };
    setServicios((prev) => [...prev, nuevoServicio]);
  };

  const handleEliminarServicio = (id: string) => {
    setServicios((prev) => prev.filter((s) => s.id !== id));
  };

  // Guardar presupuesto de forma estructurada en Firestore y respaldo local
  const handleGuardarPresupuesto = async () => {
    setGuardandoFirestore(true);
    try {
      // 1. Respaldo local de contingencia
      localStorage.setItem('olga_presupuesto_encabezado', JSON.stringify(encabezado));
      localStorage.setItem('olga_presupuesto_tasas', JSON.stringify(tasas));
      localStorage.setItem('olga_presupuesto_servicios', JSON.stringify(servicios));
      localStorage.setItem('olga_presupuesto_observaciones', observaciones);
      autoguardarClienteSilencioso();

      // 2. Persistencia en la colección 'presupuestos' de Firestore
      const docPayload = {
        userId: userId || 'default',
        tipoComprobante: encabezado.tipoComprobante,
        numeroComprobante: encabezado.numeroComprobante,
        timbrado: encabezado.timbrado,
        fechaEmision: encabezado.fechaEmision,
        fechaVencimientoValidez: encabezado.fechaVencimientoValidez,
        condicionVenta: encabezado.condicionVenta,
        clienteNombre: encabezado.clienteNombre,
        clienteRucCI: encabezado.clienteRucCI,
        clienteTelefono: encabezado.clienteTelefono,
        clienteDireccion: encabezado.clienteDireccion,
        clienteEmail: encabezado.clienteEmail || '',
        conceptoGeneral: encabezado.conceptoGeneral,
        localidad: encabezado.localidad || 'Asunción',
        tasas: tasas.map((t) => ({
          id: t.id,
          categoria: t.categoria,
          descripcion: t.descripcion,
          monto: Number(t.monto) || 0,
          tipoIva: t.tipoIva,
          activo: Boolean(t.activo),
          numeroComprobantePago: t.numeroComprobantePago || '',
        })),
        servicios: servicios.map((s) => ({
          id: s.id,
          descripcion: s.descripcion,
          cantidad: Number(s.cantidad) || 1,
          precioUnitario: Number(s.precioUnitario) || 0,
          tipoIva: s.tipoIva,
          total: Number(s.total) || 0,
          activo: Boolean(s.activo),
        })),
        observaciones,
        liquidacion: {
          subtotalTasasReembolso: liquidacion.subtotalTasasReembolso,
          totalVentaServicios: liquidacion.totalVentaServicios,
          iva5: liquidacion.iva5,
          iva10: liquidacion.iva10,
          totalIvaLiquidado: liquidacion.totalIvaLiquidado,
          totalGeneralOperacion: liquidacion.totalGeneralOperacion,
        },
        membrete: {
          nombreNotario: membrete.nombreNotario,
          registroNotarial: membrete.registroNotarial,
          nombreEscribania: membrete.nombreEscribania || '',
          direccion: membrete.direccion,
          telefono: membrete.telefono,
          email: membrete.email,
          ruc: membrete.ruc,
          timbradoNumero: membrete.timbradoNumero,
          timbradoVigenciaInicio: membrete.timbradoVigenciaInicio,
          timbradoVigenciaFin: membrete.timbradoVigenciaFin,
        },
        montoTotal: liquidacion.totalGeneralOperacion,
        estado: 'emitido',
        creadoEn: serverTimestamp(),
      };

      await addDoc(collection(db, 'presupuestos'), docPayload);

      setGuardadoExito(true);
      setTimeout(() => setGuardadoExito(false), 3000);
    } catch (e) {
      console.error('Error al guardar presupuesto en Firestore:', e);
      setGuardadoExito(true);
      setTimeout(() => setGuardadoExito(false), 3000);
    } finally {
      setGuardandoFirestore(false);
    }
  };

  // Restaurar valores por defecto
  const handleRestaurarDefecto = () => {
    if (window.confirm('¿Desea restablecer todos los campos a los valores iniciales por defecto?')) {
      setEncabezado({
        ...ENCABEZADO_INICIAL,
        timbrado: membrete.timbradoNumero || ENCABEZADO_INICIAL.timbrado,
        fechaVencimientoValidez: membrete.timbradoVigenciaFin || ENCABEZADO_INICIAL.fechaVencimientoValidez,
      });
      setTasas(ITEMS_TASAS_REEMBOLSO_BASE);
      setServicios(ITEMS_SERVICIOS_HONORARIOS_BASE);
      setObservaciones(
        'Validez del presupuesto: 30 días a partir de la fecha de emisión. Los importes correspondientes a Tasas Judiciales, Aranceles de Registro e Impuestos Municipales se basan en las liquidaciones oficiales y están sujetos a variaciones tributarias.'
      );
    }
  };

  // Guardar cambios rápidos del membrete institucional
  const handleGuardarMembrete = () => {
    guardarMembreteUsuario(membreteDraft, userId);
    setMembrete(membreteDraft);
    // Sincronizar número de timbrado en el encabezado si aún es el mismo o estaba vacío
    if (!encabezado.timbrado || encabezado.timbrado === membrete.timbradoNumero) {
      setEncabezado(prev => ({
        ...prev,
        timbrado: membreteDraft.timbradoNumero,
        fechaVencimientoValidez: membreteDraft.timbradoVigenciaFin || prev.fechaVencimientoValidez,
      }));
    }
    setModalMembreteAbierto(false);
  };

    // Abre el Modal Oficial de Previsualización e Impresión Notarial
  const handleImprimir = () => {
    autoguardarClienteSilencioso();
    setModalImpresionAbierto(true);
  };

  // Motor de Impresión Notarial Directo (Genera una ventana limpia calibrada a 1 página exacta en A4 u Oficio)
  const handleImprimirPresupuestoDirecto = (formato: 'a4' | 'oficio' = formatoPapel) => {
    autoguardarClienteSilencioso();
    
    const tasasActivas = tasas.filter(t => t.activo);
    const serviciosActivos = servicios.filter(s => s.activo);

    const pageSizeCss = formato === 'a4' ? '210mm 297mm' : '216mm 330mm';
    const numPresupuesto = encabezado.numeroComprobante || 'PRES-0001';
    const fechaEmision = encabezado.fechaEmision || new Date().toISOString().slice(0, 10);
    const clienteNombre = encabezado.clienteNombre || 'Consumidor Final';
    const clienteRuc = encabezado.clienteRucCI || 'Sin Especificar';
    const clienteTel = encabezado.clienteTelefono || '-';
    const clienteDir = encabezado.clienteDireccion || '-';
    const concepto = encabezado.conceptoGeneral || 'Servicios y Gestiones Notariales';

    const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Presupuesto Notarial ${numPresupuesto} - ${clienteNombre}</title>
  <style>
    @page {
      size: ${pageSizeCss} portrait;
      margin: 8mm 12mm 8mm 12mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 9pt;
      line-height: 1.3;
    }
    .hoja-impresion {
      width: 100%;
      max-width: ${formato === 'a4' ? '190mm' : '196mm'};
      margin: 0 auto;
      padding: 2mm 0;
    }
    .header-box {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .notaria-title {
      font-size: 14pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f172a;
      margin: 0 0 2px 0;
      font-family: Georgia, "Times New Roman", serif;
    }
    .notaria-sub {
      font-size: 8pt;
      color: #475569;
      margin: 1px 0;
      line-height: 1.25;
    }
    .presupuesto-badge {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 6px 12px;
      text-align: right;
      min-width: 160px;
    }
    .presupuesto-badge h2 {
      margin: 0 0 4px 0;
      font-size: 11pt;
      font-weight: 900;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .presupuesto-badge p {
      margin: 1px 0;
      font-size: 8pt;
      color: #334155;
    }
    .cliente-card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 8px 12px;
      margin-bottom: 10px;
      background: #f8fafc;
      display: grid;
      grid-template-columns: 2fr 1.2fr;
      gap: 5px 16px;
      font-size: 8.5pt;
    }
    .cliente-card .full-row {
      grid-column: 1 / -1;
    }
    .cliente-card strong {
      color: #0f172a;
      text-transform: uppercase;
      font-size: 7.5pt;
      letter-spacing: 0.3px;
    }
    .seccion-title {
      font-size: 8.5pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f172a;
      background: #e2e8f0;
      padding: 3.5px 8px;
      border-radius: 4px;
      margin: 8px 0 5px 0;
      display: flex;
      justify-content: space-between;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6px;
      font-size: 8.5pt;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      text-align: left;
      padding: 3.5px 6px;
      border-bottom: 1px solid #cbd5e1;
      font-size: 7.5pt;
      text-transform: uppercase;
    }
    td {
      padding: 3.5px 6px;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .subtotal-row {
      font-weight: 700;
      background: #f8fafc;
      border-top: 1px solid #cbd5e1;
    }
    .liquidacion-box {
      border: 1.5px solid #0f172a;
      border-radius: 8px;
      padding: 7px 12px;
      margin-top: 8px;
      margin-bottom: 8px;
      display: grid;
      grid-template-columns: 1fr 1.3fr;
      gap: 12px;
      background: #ffffff;
    }
    .liquidacion-iva {
      font-size: 7.5pt;
      color: #475569;
      border-right: 1px dashed #cbd5e1;
      padding-right: 12px;
    }
    .liquidacion-totales {
      text-align: right;
    }
    .total-general {
      font-size: 13pt;
      font-weight: 900;
      color: #0f172a;
      margin-top: 4px;
      padding-top: 4px;
      border-top: 1px solid #e2e8f0;
    }
    .observaciones-box {
      font-size: 7.5pt;
      color: #64748b;
      line-height: 1.25;
      margin-bottom: 12px;
      border-left: 2px solid #cbd5e1;
      padding-left: 8px;
    }
    .firmas-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-top: 22px;
      text-align: center;
    }
    .linea-firma {
      border-top: 1px solid #0f172a;
      padding-top: 4px;
      font-size: 8pt;
      font-weight: 700;
      color: #0f172a;
    }
    .cargo-firma {
      font-size: 7pt;
      color: #64748b;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="hoja-impresion">
    <div class="header-box">
      <div>
        <h1 class="notaria-title">${membrete.nombreNotario || 'Escribanía Notarial'}</h1>
        <p class="notaria-sub"><strong>${membrete.registroNotarial || 'Registro Notarial'}</strong> • ${membrete.nombreEscribania || 'Escribanía Pública'}</p>
        <p class="notaria-sub">${membrete.direccion || 'Asunción, República del Paraguay'}</p>
        <p class="notaria-sub">Tel: ${membrete.telefono || '+595 21 000-000'} | R.U.C.: ${membrete.ruc || '80012345-6'} | Timbrado: ${membrete.timbradoNumero || '16894321'}</p>
      </div>
      <div class="presupuesto-badge">
        <h2>${encabezado.tipoComprobante || 'PRESUPUESTO'}</h2>
        <p><strong>Nº:</strong> <span class="mono">${numPresupuesto}</span></p>
        <p><strong>Fecha Emisión:</strong> ${fechaEmision}</p>
        <p><strong>Condición:</strong> ${encabezado.condicionVenta || 'Contado'}</p>
        <p><strong>Validez:</strong> 30 días</p>
      </div>
    </div>

    <div class="cliente-card">
      <div>
        <strong>Cliente / Razón Social:</strong><br>
        <span style="font-weight: 700; font-size: 9.5pt;">${clienteNombre}</span>
      </div>
      <div>
        <strong>R.U.C. / C.I. Nº:</strong><br>
        <span class="mono" style="font-weight: 700;">${clienteRuc}</span>
      </div>
      <div>
        <strong>Domicilio / Sede:</strong><br>
        <span>${clienteDir}</span>
      </div>
      <div>
        <strong>Teléfono:</strong><br>
        <span>${clienteTel}</span>
      </div>
      <div class="full-row" style="border-top: 1px dashed #e2e8f0; padding-top: 4px;">
        <strong>Acto / Concepto Notarial:</strong>
        <span style="font-weight: 600; color: #0f172a; margin-left: 4px;">${concepto}</span>
      </div>
    </div>

    <div class="seccion-title">
      <span>I. Tasas Judiciales, Aranceles de Registro e Impuestos (Reembolsos Oficiales)</span>
      <span>Subtotal: Gs. ${liquidacion.subtotalTasasReembolso.toLocaleString('es-PY')}</span>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 65%;">Concepto / Arancel Oficial</th>
          <th style="width: 15%; text-align: center;">Nº Comprobante</th>
          <th style="width: 20%; text-align: right;">Importe (PYG)</th>
        </tr>
      </thead>
      <tbody>
        ${tasasActivas.length > 0 ? tasasActivas.map(t => `
          <tr>
            <td>${t.descripcion}</td>
            <td class="text-center mono" style="font-size: 8pt; color: #64748b;">${t.numeroComprobantePago || '-'}</td>
            <td class="text-right mono font-bold">Gs. ${Number(t.monto).toLocaleString('es-PY')}</td>
          </tr>
        `).join('') : `
          <tr>
            <td colspan="3" style="text-align: center; color: #94a3b8; font-style: italic; padding: 6px;">Sin tasas judiciales o registrales adicionales asignadas a este presupuesto.</td>
          </tr>
        `}
        <tr class="subtotal-row">
          <td colspan="2">TOTAL TASAS Y REEMBOLSOS OFICIALES (EXENTAS DE IVA)</td>
          <td class="text-right mono">Gs. ${liquidacion.subtotalTasasReembolso.toLocaleString('es-PY')}</td>
        </tr>
      </tbody>
    </table>

    <div class="seccion-title">
      <span>II. Servicios Notariales, Honorarios Profesionales y Gestiones</span>
      <span>Subtotal: Gs. ${liquidacion.totalVentaServicios.toLocaleString('es-PY')}</span>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 55%;">Descripción del Servicio / Honorario</th>
          <th style="width: 10%; text-align: center;">Cant.</th>
          <th style="width: 15%; text-align: right;">Precio Unit.</th>
          <th style="width: 5%; text-align: center;">IVA</th>
          <th style="width: 15%; text-align: right;">Subtotal (PYG)</th>
        </tr>
      </thead>
      <tbody>
        ${serviciosActivos.length > 0 ? serviciosActivos.map(s => `
          <tr>
            <td>${s.descripcion}</td>
            <td class="text-center mono">${s.cantidad}</td>
            <td class="text-right mono">Gs. ${Number(s.precioUnitario).toLocaleString('es-PY')}</td>
            <td class="text-center mono" style="font-size: 7.5pt;">${s.tipoIva === 'exenta' ? 'Ex.' : s.tipoIva + '%'}</td>
            <td class="text-right mono font-bold">Gs. ${Number(s.total).toLocaleString('es-PY')}</td>
          </tr>
        `).join('') : `
          <tr>
            <td colspan="5" style="text-align: center; color: #94a3b8; font-style: italic; padding: 6px;">Sin honorarios de servicios cargados.</td>
          </tr>
        `}
        <tr class="subtotal-row">
          <td colspan="4">TOTAL SERVICIOS Y HONORARIOS PROFESIONALES (IVA INCLUIDO)</td>
          <td class="text-right mono">Gs. ${liquidacion.totalVentaServicios.toLocaleString('es-PY')}</td>
        </tr>
      </tbody>
    </table>

    <div class="liquidacion-box">
      <div class="liquidacion-iva">
        <strong style="text-transform: uppercase; color: #334155; font-size: 7.5pt;">Liquidación del Impuesto al Valor Agregado (IVA):</strong><br>
        <div style="margin-top: 3px; display: grid; grid-template-columns: 1fr 1fr; gap: 2px;">
          <span>Gravadas Exentas:</span><span class="mono text-right">Gs. ${liquidacion.subtotalServiciosExentas.toLocaleString('es-PY')}</span>
          <span>Gravadas 5%:</span><span class="mono text-right">Gs. ${liquidacion.subtotalServicios5.toLocaleString('es-PY')}</span>
          <span>Gravadas 10%:</span><span class="mono text-right">Gs. ${liquidacion.subtotalServicios10.toLocaleString('es-PY')}</span>
          <span>Liquidación IVA 5%:</span><span class="mono text-right">Gs. ${liquidacion.iva5.toLocaleString('es-PY')}</span>
          <span>Liquidación IVA 10%:</span><span class="mono text-right">Gs. ${liquidacion.iva10.toLocaleString('es-PY')}</span>
          <span style="font-weight: 700; color: #0f172a;">TOTAL IVA LIQUIDADO:</span><span class="mono text-right" style="font-weight: 700; color: #0f172a;">Gs. ${liquidacion.totalIvaLiquidado.toLocaleString('es-PY')}</span>
        </div>
      </div>
      <div class="liquidacion-totales">
        <div style="font-size: 8pt; color: #475569; display: flex; justify-content: space-between;">
          <span>Subtotal Tasas y Reembolsos:</span>
          <span class="mono font-bold">Gs. ${liquidacion.subtotalTasasReembolso.toLocaleString('es-PY')}</span>
        </div>
        <div style="font-size: 8pt; color: #475569; display: flex; justify-content: space-between; margin-top: 2px;">
          <span>Subtotal Servicios y Honorarios:</span>
          <span class="mono font-bold">Gs. ${liquidacion.totalVentaServicios.toLocaleString('es-PY')}</span>
        </div>
        <div class="total-general" style="display: flex; justify-content: space-between; align-items: baseline;">
          <span style="font-size: 9.5pt; text-transform: uppercase; letter-spacing: 0.5px;">TOTAL GENERAL A PAGAR:</span>
          <span class="mono" style="font-size: 13pt; color: #0f172a;">Gs. ${liquidacion.totalGeneralOperacion.toLocaleString('es-PY')}</span>
        </div>
      </div>
    </div>

    <div class="observaciones-box">
      <strong>Observaciones Generales:</strong> ${observaciones}
    </div>

    <div class="firmas-grid">
      <div>
        <div class="linea-firma">Firma y Aclaración del Cliente / Aceptación</div>
        <div class="cargo-firma">C.I. / R.U.C.: ${clienteRuc}</div>
      </div>
      <div>
        <div class="linea-firma">${membrete.nombreNotario || 'Notario Público Titular'}</div>
        <div class="cargo-firma">${membrete.registroNotarial || 'Escribanía Notarial'} • Sello Oficial</div>
      </div>
    </div>
  </div>
</body>
</html>`;

    try {
      const win = window.open('', '_blank');
      if (win) {
        win.document.open();
        win.document.write(htmlContent);
        win.document.close();
        win.focus();
        setTimeout(() => {
          win.print();
        }, 350);
        return;
      }
    } catch (e) {
      console.warn('window.open no disponible, usando fallback con iframe:', e);
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 350);
    }
  };

  return (
    <div className="w-full space-y-6 font-sans transition-colors duration-200 print:space-y-4 print:p-0 print:m-0 print:bg-white print:text-black" id="modulo-presupuestos-root">
      {/* Cabecera Principal del Módulo (oculta al imprimir) */}
      <header className={`${
        esFull 
          ? 'bg-[#F4F4F0]/80 dark:bg-[#12141C]/80 backdrop-blur-xl border border-amber-200/40 dark:border-amber-500/30 rounded-3xl p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.06)]' 
          : 'bg-slate-900 border border-slate-800 shadow-xl'
      } rounded-3xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative overflow-hidden print:hidden`}>
        {esFull && (
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/10 blur-[100px] rounded-full pointer-events-none"></div>
        )}

        <div className="relative z-10 flex items-center gap-4">
          {onVolver && (
            <button
              onClick={onVolver}
              type="button"
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors border flex items-center gap-2 cursor-pointer shadow-xs ${
                esFull 
                  ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver</span>
            </button>
          )}

          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
            esFull 
              ? 'bg-amber-50 text-amber-600 border border-amber-200/70' 
              : 'bg-slate-800 text-slate-300 border border-slate-700/80'
          }`}>
            <Banknote className="w-6 h-6" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className={`${
                esFull ? 'text-slate-900' : 'text-white'
              } font-serif font-bold text-2xl tracking-tight`}>
                Presupuestos y Facturación Notarial
              </h1>
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full shadow-xs ${
                esFull 
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold' 
                  : 'bg-red-600 text-white font-bold'
              }`}>
                O.L.G.A.
              </span>
            </div>
            <p className={`${
              esFull ? 'text-slate-500' : 'text-slate-400'
            } text-sm mt-1 font-medium`}>
              Gestión modular de reembolsos de tasas judiciales, aranceles registrales y honorarios de escribanía.
            </p>
          </div>
        </div>

        {/* Botones de Acción Global */}
        <div className="flex flex-wrap items-center gap-2.5 relative z-10 print:hidden">
          <button
            type="button"
            onClick={handleRestaurarDefecto}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 cursor-pointer ${
              esFull 
                ? 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="Restablecer valores"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Restablecer</span>
          </button>

          <button
            type="button"
            onClick={handleGuardarPresupuesto}
            disabled={guardandoFirestore}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 cursor-pointer shadow-[0_4px_14px_rgba(0,0,0,0.1)] disabled:opacity-60 ${
              guardadoExito
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/30'
                : esFull
                  ? 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-amber-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title="Guardar en base de datos Firestore y respaldo local"
          >
            {guardandoFirestore ? (
              <Loader2 className={`w-4 h-4 animate-spin ${esFull ? 'text-amber-300' : 'text-slate-200'}`} />
            ) : guardadoExito ? (
              <Check className="w-4 h-4 text-white" />
            ) : (
              <Save className={`w-4 h-4 ${esFull ? 'text-amber-400' : 'text-slate-300'}`} />
            )}
            <span>{guardandoFirestore ? 'Guardando en BD...' : guardadoExito ? '¡Presupuesto Guardado!' : 'Guardar Presupuesto'}</span>
          </button>

          <button
            type="button"
            onClick={handleImprimir}
            className={`px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider font-semibold transition-all duration-200 flex items-center gap-2 cursor-pointer ${
              esFull 
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-[0_4px_15px_rgba(245,158,11,0.35)] hover:shadow-[0_6px_22px_rgba(245,158,11,0.55)]' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 shadow-md'
            }`}
          >
            <Printer className="w-4 h-4 text-white" />
            <span>IMPRIMIR PRESUPUESTO</span>
          </button>
        </div>
      </header>

      {/* Barra de Filtros y Totales Sticky (oculta al imprimir) */}
      <div className="sticky top-2 z-20 px-6 py-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-lg flex items-center justify-between gap-4 flex-wrap transition-all print:hidden">
        <div className="flex items-center gap-2">
          {(['todo', 'tasas', 'servicios', 'resumen'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setPestañaActiva(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer ${
                pestañaActiva === tab
                  ? 'bg-amber-50 text-amber-900 border border-amber-300/80 shadow-[0_2px_12px_rgba(245,158,11,0.15)] font-semibold'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200/80 shadow-xs font-medium'
              }`}
            >
              {tab === 'todo' && 'Vista Completa'}
              {tab === 'tasas' && `1. Tasas y Reembolsos (${tasas.filter((t) => t.activo).length})`}
              {tab === 'servicios' && `2. Servicios y Honorarios (${servicios.filter((s) => s.activo).length})`}
              {tab === 'resumen' && '3. Liquidación Final'}
            </button>
          ))}
        </div>

        {/* Totales rápidos en la barra */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-slate-500 hidden sm:block">
            Tasas: <strong className="text-slate-800">Gs. {liquidacion.subtotalTasasReembolso.toLocaleString('es-PY')}</strong>
          </div>
          <div className="text-slate-500 hidden sm:block">
            Servicios: <strong className="text-slate-800">Gs. {liquidacion.totalVentaServicios.toLocaleString('es-PY')}</strong>
          </div>
          <div className="bg-amber-50 border border-amber-300/70 px-3 py-1 rounded-xl text-amber-900 font-bold shadow-xs">
            Total: Gs. {liquidacion.totalGeneralOperacion.toLocaleString('es-PY')}
          </div>
        </div>
      </div>

      {/* Contenido Modular con Scroll Único Fluido */}
      <div className="space-y-6 md:space-y-8 print:p-0 print:m-0 print:space-y-4">
        {/* Banner de Membrete Notarial Dinámico (Configuración Multi-usuario) */}
        <div className={`border rounded-2xl p-5 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative overflow-hidden transition-colors dark:bg-[#121824]/90 dark:backdrop-blur-xl dark:border dark:border-slate-800/80 dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] dark:rounded-2xl print:border print:border-slate-800 print:shadow-none print:p-4 print:bg-white print:text-black print:rounded-xl ${
          modoFondoBlanco
            ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50'
            : 'bg-[#121824]/90 backdrop-blur-xl border-slate-800/80 text-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.4)]'
        }`}>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 shadow-inner text-amber-500 print:hidden">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className={`text-base font-bold tracking-tight ${modoFondoBlanco ? 'text-slate-900' : 'text-white'}`}>
                  {membrete.nombreNotario}
                </h3>
                <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-mono font-bold print:border-slate-400 print:text-black">
                  {membrete.registroNotarial}
                </span>
                <span className={`text-xs font-mono ${modoFondoBlanco ? 'text-slate-600' : 'text-slate-400'}`}>
                  RUC: <strong className={modoFondoBlanco ? 'text-slate-900' : 'text-slate-200'}>{membrete.ruc}</strong>
                </span>
              </div>
              <p className={`text-xs mt-1 font-medium ${modoFondoBlanco ? 'text-slate-600' : 'text-slate-300'}`}>
                {membrete.nombreEscribania}
              </p>
              <div className={`flex items-center gap-4 text-[11px] mt-1.5 flex-wrap ${modoFondoBlanco ? 'text-slate-500' : 'text-slate-400'}`}>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  {membrete.direccion}
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  {membrete.telefono}
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3 text-slate-400" />
                  {membrete.email}
                </span>
              </div>
              <div className={`mt-2 text-[10px] font-mono flex items-center gap-2 ${modoFondoBlanco ? 'text-slate-500' : 'text-slate-400'}`}>
                <span className={`px-2 py-0.5 rounded border ${modoFondoBlanco ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800 text-slate-300 border-slate-700'} print:border-slate-400 print:text-black`}>
                  Timbrado Nº: {membrete.timbradoNumero}
                </span>
                <span>
                  Vigencia: {membrete.timbradoVigenciaInicio} al {membrete.timbradoVigenciaFin}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-center shrink-0 print:hidden">
            <button
              type="button"
              onClick={() => {
                setMembreteDraft(membrete);
                setModalMembreteAbierto(true);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer shadow-sm ${
                modoFondoBlanco
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 border-slate-700'
              }`}
              title="Ajustar o completar datos del membrete para esta sesión"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar Membrete</span>
            </button>
            {onIrAConfiguracion && (
              <button
                type="button"
                onClick={onIrAConfiguracion}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                  modoFondoBlanco
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border-slate-300'
                    : 'bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white border-slate-700/80'
                }`}
                title="Ir a Configuración Global de Escribanía"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ajustes</span>
              </button>
            )}
          </div>
        </div>

        {/* ================================================================= */}
        {/* ================================================================= */}
        {/* SECCIÓN 1: ENCABEZADO Y DATOS FISCALES / DEL CLIENTE (PARTE 2)    */}
        {/* ================================================================= */}
        <section
          className={`rounded-2xl p-5 md:p-6 shadow-xl space-y-5 border transition-colors dark:bg-[#121824]/90 dark:backdrop-blur-xl dark:border dark:border-slate-800/80 dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] dark:rounded-2xl print:rounded-none print:border print:border-slate-300 print:shadow-none print:p-4 print:bg-white print:text-black ${
            modoFondoBlanco
              ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/60'
              : 'bg-[#121824]/90 backdrop-blur-xl border-slate-800/80 text-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.4)]'
          }`}
        >
          <div className={`flex items-center justify-between border-b pb-3 flex-wrap gap-3 ${modoFondoBlanco ? 'border-slate-200' : 'border-slate-800'} print:border-slate-300`}>
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 print:hidden">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className={`text-sm md:text-base font-bold uppercase tracking-wider ${modoFondoBlanco ? 'text-slate-900' : 'text-white'} print:text-black`}>
                  Datos del Comprobante y del Cliente
                </h2>
                <p className={`text-[11px] ${modoFondoBlanco ? 'text-slate-500' : 'text-slate-400'} print:hidden`}>
                  Búsqueda en Fichero Notarial, consulta al padrón DNIT y vinculación automática al comprobante.
                </p>
              </div>

              {/* Indicadores de procedencia y autoguardado */}
              <div className="flex items-center gap-1.5 ml-1 print:hidden">
                {origenCliente === 'FICHERO' && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[10px] font-bold flex items-center gap-1">
                    <Users className="w-3 h-3 text-blue-500" />
                    <span>Fichero Notarial</span>
                  </span>
                )}
                {origenCliente === 'DNIT' && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span>DNIT Verificado</span>
                  </span>
                )}
                {clienteAutoguardado && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-1 shadow-sm animate-pulse">
                    <Check className="w-3 h-3" />
                    <span>Vinculado al Fichero</span>
                  </span>
                )}
              </div>
            </div>

            {/* Selector de Tipo de Comprobante */}
            <div className={`flex items-center gap-1.5 p-1 rounded-xl border ${modoFondoBlanco ? 'bg-slate-100 border-slate-300' : 'bg-slate-900 border-slate-800'} print:border-none print:bg-transparent`}>
              <span className="hidden print:inline-block font-black text-sm uppercase text-black font-mono">
                {encabezado.tipoComprobante}: {encabezado.numeroComprobante}
              </span>
              {(['Presupuesto', 'Factura'] as TipoComprobante[]).map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => handleActualizarEncabezado('tipoComprobante', tipo)}
                  className={`px-3 py-1 text-xs font-black rounded-lg uppercase tracking-wider transition-colors cursor-pointer print:hidden ${
                    encabezado.tipoComprobante === tipo
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : modoFondoBlanco
                      ? 'text-slate-600 hover:text-slate-900'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tipo}
                </button>
              ))}
            </div>
          </div>

          {/* Banner de retroalimentación DNIT o Fichero */}
          {feedbackDnit && (
            <div
              className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs animate-fade-in print:hidden ${
                feedbackDnit.tipo === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : feedbackDnit.tipo === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                  : 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {feedbackDnit.tipo === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                )}
                <span className="font-medium">{feedbackDnit.mensaje}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackDnit(null)}
                className="p-1 hover:bg-black/10 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Grilla de campos del comprobante */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs print:grid-cols-4 print:gap-2">
            {/* Nº Comprobante */}
            <div>
              <label className={`block font-bold mb-1 ${modoFondoBlanco ? 'text-slate-700' : 'text-slate-400'} print:text-slate-700 print:text-[10px]`}>
                Nº Comprobante
              </label>
              <input
                type="text"
                value={encabezado.numeroComprobante}
                onChange={(e) => handleActualizarEncabezado('numeroComprobante', e.target.value)}
                className={`w-full rounded-xl px-3 py-2 font-mono font-bold focus:outline-none transition-colors print:border-none print:p-0 print:bg-transparent print:text-black print:shadow-none print:text-xs ${
                  modoFondoBlanco
                    ? 'bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-amber-600'
                    : 'bg-slate-900 border border-slate-700/80 text-white focus:border-amber-500'
                }`}
              />
            </div>

            {/* Timbrado SET / DNIT */}
            <div>
              <label className={`block font-bold mb-1 ${modoFondoBlanco ? 'text-slate-700' : 'text-slate-400'} print:text-slate-700 print:text-[10px]`}>
                Timbrado SET / DNIT
              </label>
              <input
                type="text"
                value={encabezado.timbrado}
                onChange={(e) => handleActualizarEncabezado('timbrado', e.target.value)}
                className={`w-full rounded-xl px-3 py-2 font-mono font-bold focus:outline-none transition-colors print:border-none print:p-0 print:bg-transparent print:text-black print:shadow-none print:text-xs ${
                  modoFondoBlanco
                    ? 'bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-amber-600'
                    : 'bg-slate-900 border border-slate-700/80 text-white focus:border-amber-500'
                }`}
              />
            </div>

            {/* Fecha de Emisión */}
            <div>
              <label className={`block font-bold mb-1 ${modoFondoBlanco ? 'text-slate-700' : 'text-slate-400'} print:text-slate-700 print:text-[10px]`}>
                Fecha Emisión
              </label>
              <input
                type="date"
                value={encabezado.fechaEmision}
                onChange={(e) => handleActualizarEncabezado('fechaEmision', e.target.value)}
                className={`w-full rounded-xl px-3 py-2 font-medium focus:outline-none cursor-pointer transition-colors print:border-none print:p-0 print:bg-transparent print:text-black print:shadow-none print:text-xs ${
                  modoFondoBlanco
                    ? 'bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-amber-600'
                    : 'bg-slate-900 border border-slate-700/80 text-white focus:border-amber-500'
                }`}
              />
            </div>

            {/* Condición de Venta */}
            <div>
              <label className={`block font-bold mb-1 ${modoFondoBlanco ? 'text-slate-700' : 'text-slate-400'} print:text-slate-700 print:text-[10px]`}>
                Condición de Venta
              </label>
              <select
                value={encabezado.condicionVenta}
                onChange={(e) => handleActualizarEncabezado('condicionVenta', e.target.value as CondicionVenta)}
                className={`w-full rounded-xl px-3 py-2 font-bold focus:outline-none cursor-pointer transition-colors print:border-none print:p-0 print:bg-transparent print:text-black print:shadow-none print:appearance-none print:text-xs ${
                  modoFondoBlanco
                    ? 'bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-amber-600'
                    : 'bg-slate-900 border border-slate-700/80 text-white focus:border-amber-500'
                }`}
              >
                <option value="Contado">Contado</option>
                <option value="Crédito">Crédito</option>
              </select>
            </div>

            {/* Nombre / Razón Social del Cliente (con Autocompletado del Fichero) */}
            <div className="lg:col-span-2 relative print:col-span-2" ref={refBuscadorCliente}>
              <div className="flex items-center justify-between mb-1">
                <label className={`font-bold flex items-center gap-1.5 ${modoFondoBlanco ? 'text-slate-700' : 'text-slate-400'} print:text-slate-700 print:text-[10px]`}>
                  <span>Nombre / Razón Social del Cliente *</span>
                </label>
                <span className={`text-[10px] ${modoFondoBlanco ? 'text-slate-500' : 'text-slate-400'} print:hidden`}>
                  {ficheroPersonas.length} en Fichero
                </span>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={encabezado.clienteNombre}
                  onFocus={() => setMostrarSugerenciasFichero(true)}
                  onChange={(e) => {
                    handleActualizarEncabezado('clienteNombre', e.target.value);
                    setMostrarSugerenciasFichero(true);
                  }}
                  placeholder="Escriba o busque en el Fichero (Ej: JUAN CARLOS PÉREZ GÓMEZ)"
                  className={`w-full rounded-xl pl-3 pr-10 py-2 font-bold focus:outline-none transition-colors print:border-none print:p-0 print:bg-transparent print:text-black print:shadow-none print:text-xs ${
                    modoFondoBlanco
                      ? 'bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-amber-600'
                      : 'bg-slate-900 border border-slate-700/80 text-white placeholder:text-slate-500 focus:border-amber-500'
                  }`}
                />

                <button
                  type="button"
                  onClick={() => setMostrarSugerenciasFichero((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-amber-500 transition-colors cursor-pointer print:hidden"
                  title="Ver clientes del Fichero Notarial"
                >
                  <Users className="w-4 h-4" />
                </button>
              </div>

              {/* Menú desplegable de sugerencias del Fichero Notarial */}
              {mostrarSugerenciasFichero && personasSugeridas.length > 0 && (
                <div
                  className={`absolute left-0 right-0 top-full mt-1.5 rounded-2xl border shadow-2xl z-30 max-h-60 overflow-y-auto divide-y transition-all print:hidden ${
                    modoFondoBlanco
                      ? 'bg-white border-slate-200 divide-slate-100 text-slate-900 shadow-slate-300/60'
                      : 'bg-slate-900 border-slate-700 divide-slate-800 text-slate-100 shadow-black/80'
                  }`}
                >
                  <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${modoFondoBlanco ? 'bg-slate-50 text-slate-500' : 'bg-slate-950 text-slate-400'}`}>
                    Clientes en Fichero Notarial (clic para seleccionar)
                  </div>
                  {personasSugeridas.map((persona) => {
                    const nombreMostrar =
                      persona.tipo_persona === 'física' && persona.apellido
                        ? `${persona.nombre} ${persona.apellido}`.trim()
                        : persona.nombre;
                    return (
                      <button
                        key={persona.id}
                        type="button"
                        onClick={() => handleSeleccionarPersonaFichero(persona)}
                        className={`w-full text-left px-3.5 py-2.5 transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                          modoFondoBlanco
                            ? 'hover:bg-amber-50/80 text-slate-800'
                            : 'hover:bg-slate-800/80 text-slate-200'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs truncate">{nombreMostrar}</div>
                          <div className={`text-[10px] truncate ${modoFondoBlanco ? 'text-slate-500' : 'text-slate-400'}`}>
                            {persona.domicilio || 'Sin dirección registrada'}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-[11px] text-amber-600 dark:text-amber-400">
                            {persona.nro_documento}
                          </div>
                          <span
                            className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-semibold ${
                              persona.origen === 'DNIT'
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : 'bg-slate-500/10 text-slate-500'
                            }`}
                          >
                            {persona.origen || 'Manual'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RUC o C.I. del Cliente con Integración DNIT */}
            <div>
              <label className={`block font-bold mb-1 ${modoFondoBlanco ? 'text-slate-700' : 'text-slate-400'} print:text-slate-700 print:text-[10px]`}>
                RUC o C.I. del Cliente *
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={encabezado.clienteRucCI}
                  onChange={(e) => {
                    handleActualizarEncabezado('clienteRucCI', e.target.value);
                    setOrigenCliente('MANUAL');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleConsultarDNIT();
                    }
                  }}
                  placeholder="Ej: 1234567-8"
                  className={`w-full rounded-xl px-3 py-2 font-mono font-bold focus:outline-none transition-colors print:border-none print:p-0 print:bg-transparent print:text-black print:shadow-none print:text-xs ${
                    modoFondoBlanco
                      ? 'bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-amber-600'
                      : 'bg-slate-900 border border-slate-700/80 text-white focus:border-amber-500'
                  }`}
                />

                <button
                  type="button"
                  onClick={handleConsultarDNIT}
                  disabled={cargandoDnit}
                  className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0 cursor-pointer disabled:opacity-50 print:hidden"
                  title="Consultar padrón SET / DNIT para autocompletar nombre y dirección"
                >
                  {cargandoDnit ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                  )}
                  <span className="hidden sm:inline">{cargandoDnit ? '...' : 'DNIT'}</span>
                </button>
              </div>
            </div>

            {/* Teléfono / Móvil */}
            <div>
              <label className={`block font-bold mb-1 ${modoFondoBlanco ? 'text-slate-700' : 'text-slate-400'} print:text-slate-700 print:text-[10px]`}>
                Teléfono / Móvil
              </label>
              <input
                type="text"
                value={encabezado.clienteTelefono}
                onChange={(e) => handleActualizarEncabezado('clienteTelefono', e.target.value)}
                placeholder="Ej: +595 981 123456"
                className={`w-full rounded-xl px-3 py-2 focus:outline-none transition-colors print:border-none print:p-0 print:bg-transparent print:text-black print:shadow-none print:text-xs ${
                  modoFondoBlanco
                    ? 'bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-amber-600'
                    : 'bg-slate-900 border border-slate-700/80 text-white focus:border-amber-500'
                }`}
              />
            </div>

            {/* Dirección del Cliente */}
            <div className="lg:col-span-2 print:col-span-2">
              <label className={`block font-bold mb-1 ${modoFondoBlanco ? 'text-slate-700' : 'text-slate-400'} print:text-slate-700 print:text-[10px]`}>
                Dirección / Domicilio del Cliente
              </label>
              <input
                type="text"
                value={encabezado.clienteDireccion}
                onChange={(e) => handleActualizarEncabezado('clienteDireccion', e.target.value)}
                placeholder="Ej: Avda. Mcal. López c/ San Martín, Asunción"
                className={`w-full rounded-xl px-3 py-2 focus:outline-none transition-colors print:border-none print:p-0 print:bg-transparent print:text-black print:shadow-none print:text-xs ${
                  modoFondoBlanco
                    ? 'bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-amber-600'
                    : 'bg-slate-900 border border-slate-700/80 text-white focus:border-amber-500'
                }`}
              />
            </div>

            {/* Correo Electrónico del Cliente */}
            <div>
              <label className={`block font-bold mb-1 ${modoFondoBlanco ? 'text-slate-700' : 'text-slate-400'} print:text-slate-700 print:text-[10px]`}>
                Correo Electrónico (Opcional)
              </label>
              <input
                type="email"
                value={encabezado.clienteEmail || ''}
                onChange={(e) => handleActualizarEncabezado('clienteEmail', e.target.value)}
                placeholder="cliente@ejemplo.com.py"
                className={`w-full rounded-xl px-3 py-2 focus:outline-none transition-colors print:border-none print:p-0 print:bg-transparent print:text-black print:shadow-none print:text-xs ${
                  modoFondoBlanco
                    ? 'bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-amber-600'
                    : 'bg-slate-900 border border-slate-700/80 text-white focus:border-amber-500'
                }`}
              />
            </div>

            {/* Concepto General del Acto Notarial */}
            <div className="lg:col-span-1 print:col-span-1">
              <label className={`block font-bold mb-1 ${modoFondoBlanco ? 'text-slate-700' : 'text-slate-400'} print:text-slate-700 print:text-[10px]`}>
                Concepto General del Acto
              </label>
              <input
                type="text"
                value={encabezado.conceptoGeneral}
                onChange={(e) => handleActualizarEncabezado('conceptoGeneral', e.target.value)}
                placeholder="Ej: Escritura de Compraventa e Hipoteca"
                className={`w-full rounded-xl px-3 py-2 focus:outline-none transition-colors print:border-none print:p-0 print:bg-transparent print:text-black print:shadow-none print:text-xs ${
                  modoFondoBlanco
                    ? 'bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-amber-600'
                    : 'bg-slate-900 border border-slate-700/80 text-white focus:border-amber-500'
                }`}
              />
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* ================================================================= */}
        {/* SECCIÓN 2: REEMBOLSO DE IMPUESTOS Y TASAS                         */}
        {/* ================================================================= */}
        <section className={`rounded-2xl p-5 md:p-6 shadow-xl space-y-4 border transition-colors dark:bg-[#121824]/90 dark:backdrop-blur-xl dark:border dark:border-slate-800/80 dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] dark:rounded-2xl print:rounded-none print:border print:border-slate-300 print:shadow-none print:p-4 print:bg-white print:text-black ${
          pestañaActiva !== 'todo' && pestañaActiva !== 'tasas' ? 'hidden print:block' : 'block'
        } ${
          modoFondoBlanco
            ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/60'
            : 'bg-[#121824]/90 backdrop-blur-xl border-slate-800/80 text-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.4)]'
        }`}>
          <div className={`flex items-center justify-between border-b pb-3 flex-wrap gap-2 ${modoFondoBlanco ? 'border-slate-200' : 'border-slate-800'} print:border-slate-300`}>
            <div>
              <h2 className={`text-sm md:text-base font-bold uppercase tracking-wider flex items-center gap-2 ${modoFondoBlanco ? 'text-slate-900' : 'text-white'} print:text-black`}>
                <CreditCard className="w-5 h-5 text-emerald-500 print:hidden" />
                <span>1. Reembolso de Impuestos y Tasas Oficiales</span>
              </h2>
              <p className={`text-xs mt-0.5 ${modoFondoBlanco ? 'text-slate-500' : 'text-slate-400'} print:hidden`}>
                Aranceles no computables / exentos pagados ante la CSJ, Registros Públicos y Municipios.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAgregarTasa}
              className="px-3.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer print:hidden"
            >
              <Plus className="w-4 h-4" />
              <span>+ Agregar Tasa</span>
            </button>
          </div>

          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-xs text-left print:border-collapse print:text-black">
              <thead>
                <tr className={`border-b uppercase tracking-wider text-[10px] print:border-slate-300 print:text-slate-800 ${modoFondoBlanco ? 'border-slate-200 text-slate-500 bg-slate-50' : 'border-slate-800 text-slate-400'}`}>
                  <th className="py-2.5 px-3 w-12 text-center print:hidden">Activo</th>
                  <th className="py-2.5 px-3">Descripción de la Tasa / Arancel</th>
                  <th className="py-2.5 px-3 w-36">Categoría</th>
                  <th className="py-2.5 px-3 w-44">Nº Comprobante</th>
                  <th className="py-2.5 px-3 w-40 text-right">Monto (Gs.)</th>
                  <th className="py-2.5 px-3 w-12 text-center print:hidden">Acción</th>
                </tr>
              </thead>
              <tbody className={`divide-y print:divide-slate-200 ${modoFondoBlanco ? 'divide-slate-200' : 'divide-slate-800/60'}`}>
                {tasas.map((tasa) => (
                  <tr
                    key={tasa.id}
                    className={`transition-colors print:border-b print:border-slate-200 ${
                      !tasa.activo ? 'print:hidden' : ''
                    } ${
                      tasa.activo 
                        ? (modoFondoBlanco ? 'bg-white hover:bg-slate-50' : 'bg-slate-900/40 hover:bg-slate-900/80')
                        : (modoFondoBlanco ? 'opacity-40 bg-slate-100/50' : 'opacity-40 bg-slate-950/40')
                    }`}
                  >
                    <td className="py-2 px-3 text-center print:hidden">
                      <input
                        type="checkbox"
                        checked={tasa.activo}
                        onChange={() => handleToggleTasa(tasa.id)}
                        className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={tasa.descripcion}
                        onChange={(e) => handleEditarTasa(tasa.id, 'descripcion', e.target.value)}
                        disabled={!tasa.activo}
                        className={`w-full bg-transparent border-b border-transparent focus:outline-none font-medium py-1 print:border-none print:p-0 print:text-black ${
                          modoFondoBlanco ? 'text-slate-900 focus:border-emerald-600' : 'text-white focus:border-emerald-500'
                        }`}
                      />
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={tasa.categoria}
                        onChange={(e) => handleEditarTasa(tasa.id, 'categoria', e.target.value as CategoriaTasaReembolso)}
                        disabled={!tasa.activo}
                        className={`w-full rounded-lg px-2 py-1 text-xs focus:outline-none print:border-none print:p-0 print:bg-transparent print:text-black print:appearance-none ${
                          modoFondoBlanco 
                            ? 'bg-slate-50 border border-slate-300 text-slate-800 focus:border-emerald-600' 
                            : 'bg-slate-900 border border-slate-700/80 text-slate-300 focus:border-emerald-500'
                        }`}
                      >
                        <option value="judicial">Judicial (CSJ)</option>
                        <option value="hipoteca">Hipoteca (DGRP)</option>
                        <option value="municipal">Municipal</option>
                        <option value="especial">Especial / Apostilla</option>
                        <option value="automotor">Automotores</option>
                        <option value="otro">Otro Arancel</option>
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={tasa.numeroComprobantePago || ''}
                        onChange={(e) => handleEditarTasa(tasa.id, 'numeroComprobantePago', e.target.value)}
                        disabled={!tasa.activo}
                        placeholder="Nº Liquidación"
                        className={`w-full rounded-lg px-2 py-1 font-mono text-xs focus:outline-none print:border-none print:p-0 print:bg-transparent print:text-black ${
                          modoFondoBlanco 
                            ? 'bg-slate-50 border border-slate-200 text-slate-700 focus:border-emerald-600' 
                            : 'bg-slate-900/80 border border-slate-800 text-slate-300 focus:border-emerald-500'
                        }`}
                      />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        value={tasa.monto}
                        onChange={(e) => handleEditarTasa(tasa.id, 'monto', Number(e.target.value) || 0)}
                        disabled={!tasa.activo}
                        className={`w-full rounded-lg px-2.5 py-1 text-right font-mono font-bold text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none print:border-none print:p-0 print:bg-transparent print:text-black ${
                          modoFondoBlanco
                            ? 'bg-slate-50 border border-slate-300 text-emerald-700 focus:border-emerald-600'
                            : 'bg-slate-900 border border-slate-700/80 text-emerald-400 focus:border-emerald-500'
                        }`}
                      />
                    </td>
                    <td className="py-2 px-3 text-center print:hidden">
                      <button
                        type="button"
                        onClick={() => handleEliminarTasa(tasa.id)}
                        className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors cursor-pointer"
                        title="Eliminar tasa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={`p-3 rounded-xl flex items-center justify-between text-xs font-bold border print:border print:border-slate-300 print:bg-slate-50 print:text-black print:rounded-lg ${
            modoFondoBlanco 
              ? 'bg-slate-50 border-slate-200 text-slate-700' 
              : 'bg-slate-900 border-slate-800 text-slate-400'
          }`}>
            <span>
              Subtotal de Reembolsos Oficiales ({tasas.filter((t) => t.activo).length} ítems):
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono text-sm print:text-black print:font-bold">
              Gs. {liquidacion.subtotalTasasReembolso.toLocaleString('es-PY')}
            </span>
          </div>
        </section>

        {/* ================================================================= */}
        {/* ================================================================= */}
        {/* SECCIÓN 3: SERVICIOS Y HONORARIOS NOTARIALES                      */}
        {/* ================================================================= */}
        <section className={`rounded-2xl p-5 md:p-6 shadow-xl space-y-4 border transition-colors dark:bg-[#121824]/90 dark:backdrop-blur-xl dark:border dark:border-slate-800/80 dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] dark:rounded-2xl print:rounded-none print:border print:border-slate-300 print:shadow-none print:p-4 print:bg-white print:text-black ${
          pestañaActiva !== 'todo' && pestañaActiva !== 'servicios' ? 'hidden print:block' : 'block'
        } ${
          modoFondoBlanco
            ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/60'
            : 'bg-[#121824]/90 backdrop-blur-xl border-slate-800/80 text-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.4)]'
        }`}>
          <div className={`flex items-center justify-between border-b pb-3 flex-wrap gap-2 ${modoFondoBlanco ? 'border-slate-200' : 'border-slate-800'} print:border-slate-300`}>
            <div>
              <h2 className={`text-sm md:text-base font-bold uppercase tracking-wider flex items-center gap-2 ${modoFondoBlanco ? 'text-slate-900' : 'text-white'} print:text-black`}>
                <FileText className="w-5 h-5 text-amber-500 print:hidden" />
                <span>2. Ventas y Servicios Notariales (Honorarios y Gestiones)</span>
              </h2>
              <p className={`text-xs mt-0.5 ${modoFondoBlanco ? 'text-slate-500' : 'text-slate-400'} print:hidden`}>
                Honorarios arancelarios y servicios propios gravados por IVA (10% / 5% / Exenta).
              </p>
            </div>

            <button
              type="button"
              onClick={handleAgregarServicio}
              className="px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer print:hidden"
            >
              <Plus className="w-4 h-4" />
              <span>+ Agregar Servicio</span>
            </button>
          </div>

          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-xs text-left print:border-collapse print:text-black">
              <thead>
                <tr className={`border-b uppercase tracking-wider text-[10px] print:border-slate-300 print:text-slate-800 ${modoFondoBlanco ? 'border-slate-200 text-slate-500 bg-slate-50' : 'border-slate-800 text-slate-400'}`}>
                  <th className="py-2.5 px-3 w-12 text-center print:hidden">Activo</th>
                  <th className="py-2.5 px-3">Descripción del Concepto / Diligencia</th>
                  <th className="py-2.5 px-3 w-20 text-center">Cant.</th>
                  <th className="py-2.5 px-3 w-36 text-right">Unitario (Gs.)</th>
                  <th className="py-2.5 px-3 w-28 text-center">Tipo IVA</th>
                  <th className="py-2.5 px-3 w-36 text-right">Total (Gs.)</th>
                  <th className="py-2.5 px-3 w-12 text-center print:hidden">Acción</th>
                </tr>
              </thead>
              <tbody className={`divide-y print:divide-slate-200 ${modoFondoBlanco ? 'divide-slate-200' : 'divide-slate-800/60'}`}>
                {servicios.map((srv) => (
                  <tr
                    key={srv.id}
                    className={`transition-colors print:border-b print:border-slate-200 ${
                      !srv.activo ? 'print:hidden' : ''
                    } ${
                      srv.activo 
                        ? (modoFondoBlanco ? 'bg-white hover:bg-slate-50' : 'bg-slate-900/40 hover:bg-slate-900/80')
                        : (modoFondoBlanco ? 'opacity-40 bg-slate-100/50' : 'opacity-40 bg-slate-950/40')
                    }`}
                  >
                    <td className="py-2 px-3 text-center print:hidden">
                      <input
                        type="checkbox"
                        checked={srv.activo}
                        onChange={() => handleToggleServicio(srv.id)}
                        className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={srv.descripcion}
                        onChange={(e) => handleEditarServicio(srv.id, 'descripcion', e.target.value)}
                        disabled={!srv.activo}
                        className={`w-full bg-transparent border-b border-transparent focus:outline-none font-medium py-1 print:border-none print:p-0 print:text-black ${
                          modoFondoBlanco ? 'text-slate-900 focus:border-amber-600' : 'text-white focus:border-amber-500'
                        }`}
                      />
                    </td>
                    <td className="py-2 px-3 text-center">
                      <input
                        type="number"
                        min="1"
                        value={srv.cantidad}
                        onChange={(e) => handleEditarServicio(srv.id, 'cantidad', Number(e.target.value) || 1)}
                        disabled={!srv.activo}
                        className={`w-16 rounded-lg px-2 py-1 text-center font-mono text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:outline-none mx-auto print:border-none print:p-0 print:bg-transparent print:text-black ${
                          modoFondoBlanco 
                            ? 'bg-slate-50 border border-slate-300 text-slate-900 focus:border-amber-600' 
                            : 'bg-slate-900 border border-slate-700/80 text-white focus:border-amber-500'
                        }`}
                      />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        value={srv.precioUnitario}
                        onChange={(e) => handleEditarServicio(srv.id, 'precioUnitario', Number(e.target.value) || 0)}
                        disabled={!srv.activo}
                        className={`w-full rounded-lg px-2.5 py-1 text-right font-mono font-bold text-xs focus:outline-none print:border-none print:p-0 print:bg-transparent print:text-black ${
                          modoFondoBlanco
                            ? 'bg-slate-50 border border-slate-300 text-amber-700 focus:border-amber-600'
                            : 'bg-slate-900 border border-slate-700/80 text-amber-300 focus:border-amber-500'
                        }`}
                      />
                    </td>
                    <td className="py-2 px-3 text-center">
                      <select
                        value={srv.tipoIva}
                        onChange={(e) => handleEditarServicio(srv.id, 'tipoIva', e.target.value as TipoIvaNotarial)}
                        disabled={!srv.activo}
                        className={`rounded-lg px-2 py-1 text-xs focus:outline-none print:border-none print:p-0 print:bg-transparent print:text-black print:appearance-none ${
                          modoFondoBlanco 
                            ? 'bg-slate-50 border border-slate-300 text-slate-800 focus:border-amber-600' 
                            : 'bg-slate-900 border border-slate-700/80 text-slate-300 focus:border-amber-500'
                        }`}
                      >
                        <option value="10">IVA 10%</option>
                        <option value="5">IVA 5%</option>
                        <option value="exenta">Exenta</option>
                      </select>
                    </td>
                    <td className={`py-2 px-3 text-right font-mono font-bold text-xs print:text-black ${modoFondoBlanco ? 'text-slate-900' : 'text-white'}`}>
                      Gs. {Number(srv.total).toLocaleString('es-PY')}
                    </td>
                    <td className="py-2 px-3 text-center print:hidden">
                      <button
                        type="button"
                        onClick={() => handleEliminarServicio(srv.id)}
                        className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors cursor-pointer"
                        title="Eliminar servicio"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={`p-3 rounded-xl flex items-center justify-between text-xs font-bold border print:border print:border-slate-300 print:bg-slate-50 print:text-black print:rounded-lg ${
            modoFondoBlanco 
              ? 'bg-slate-50 border-slate-200 text-slate-700' 
              : 'bg-slate-900 border-slate-800 text-slate-400'
          }`}>
            <span>
              Subtotal Ventas / Honorarios ({servicios.filter((s) => s.activo).length} activos):
            </span>
            <span className="text-amber-600 dark:text-amber-400 font-mono text-sm print:text-black print:font-bold">
              Gs. {liquidacion.totalVentaServicios.toLocaleString('es-PY')}
            </span>
          </div>
        </section>

        {/* ================================================================= */}
        {/* SECCIÓN 4: OBSERVACIONES Y LIQUIDACIÓN TRIBUTARIA RESUMEN          */}
        {/* ================================================================= */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:grid-cols-3 print:gap-4">
          {/* Columna Izquierda: Observaciones y Validez */}
          <div className={`lg:col-span-2 rounded-2xl p-5 md:p-6 shadow-xl space-y-3 border transition-colors dark:bg-[#121824]/90 dark:backdrop-blur-xl dark:border dark:border-slate-800/80 dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] dark:rounded-2xl print:col-span-2 print:rounded-none print:border print:border-slate-300 print:shadow-none print:p-4 print:bg-white print:text-black ${
            modoFondoBlanco
              ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/60'
              : 'bg-[#121824]/90 backdrop-blur-xl border-slate-800/80 text-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.4)]'
          }`}>
            <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${modoFondoBlanco ? 'text-slate-800' : 'text-slate-300'} print:text-black`}>
              <AlertCircle className="w-4 h-4 text-amber-500 print:hidden" />
              <span>Condiciones Generales y Cláusulas del Presupuesto</span>
            </h3>
            <textarea
              rows={4}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className={`w-full rounded-xl p-3 text-xs focus:outline-none resize-none leading-relaxed transition-colors print:border-none print:p-0 print:bg-transparent print:text-black print:shadow-none print:resize-none ${
                modoFondoBlanco
                  ? 'bg-slate-50 border border-slate-300 text-slate-800 focus:bg-white focus:border-amber-600'
                  : 'bg-slate-900 border border-slate-700/80 text-slate-300 focus:border-amber-500'
              }`}
              placeholder="Indique las condiciones de pago, cuentas bancarias para transferencias (SIPAP) y advertencias arancelarias..."
            />
            <p className="text-[10px] text-slate-500 print:hidden">
              * Este texto se incluirá al pie del comprobante impreso entregado al cliente.
            </p>
          </div>

          {/* Columna Derecha: Tarjeta de Liquidación de Totales */}
          <div className={`rounded-2xl p-5 md:p-6 shadow-2xl flex flex-col justify-between space-y-4 border-2 transition-colors print:col-span-1 print:rounded-none print:border print:border-slate-400 print:shadow-none print:p-4 print:bg-white print:text-black ${
            modoFondoBlanco
              ? 'bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white border-amber-500/40 text-slate-900'
              : 'bg-gradient-to-br from-slate-950 to-slate-900 border-amber-500/30 text-white'
          }`}>
            <div>
              <div className={`flex items-center justify-between border-b pb-2 mb-3 ${modoFondoBlanco ? 'border-amber-500/20' : 'border-slate-800'} print:border-slate-300`}>
                <span className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5 print:text-black">
                  <Calculator className="w-4 h-4 print:hidden" />
                  Liquidación Notarial
                </span>
                <span className={`text-[10px] font-mono ${modoFondoBlanco ? 'text-slate-600' : 'text-slate-400'} print:text-black font-bold`}>{encabezado.condicionVenta}</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className={`flex justify-between ${modoFondoBlanco ? 'text-slate-700' : 'text-slate-300'} print:text-black`}>
                  <span>Reembolso Tasas (Exentas):</span>
                  <span className={`font-mono font-bold ${modoFondoBlanco ? 'text-slate-900' : 'text-white'} print:text-black`}>
                    Gs. {liquidacion.subtotalTasasReembolso.toLocaleString('es-PY')}
                  </span>
                </div>

                <div className={`flex justify-between ${modoFondoBlanco ? 'text-slate-700' : 'text-slate-300'} print:text-black`}>
                  <span>Honorarios Gravados:</span>
                  <span className={`font-mono font-bold ${modoFondoBlanco ? 'text-slate-900' : 'text-white'} print:text-black`}>
                    Gs. {liquidacion.totalVentaServicios.toLocaleString('es-PY')}
                  </span>
                </div>

                <div className={`flex justify-between text-[11px] pt-1 border-t ${
                  modoFondoBlanco ? 'text-slate-600 border-slate-200' : 'text-slate-400 border-slate-800/80'
                } print:border-slate-200 print:text-black`}>
                  <span>Liquidación IVA 10%:</span>
                  <span className={`font-mono ${modoFondoBlanco ? 'text-slate-800 font-semibold' : 'text-slate-300'} print:text-black font-semibold`}>
                    Gs. {liquidacion.iva10.toLocaleString('es-PY')}
                  </span>
                </div>

                {liquidacion.iva5 > 0 && (
                  <div className={`flex justify-between text-[11px] ${modoFondoBlanco ? 'text-slate-600' : 'text-slate-400'} print:text-black`}>
                    <span>Liquidación IVA 5%:</span>
                    <span className={`font-mono ${modoFondoBlanco ? 'text-slate-800 font-semibold' : 'text-slate-300'} print:text-black font-semibold`}>
                      Gs. {liquidacion.iva5.toLocaleString('es-PY')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Gran Total */}
            <div className={`pt-3 border-t ${modoFondoBlanco ? 'border-amber-500/30' : 'border-amber-500/20'} print:border-slate-300`}>
              <span className={`text-[10px] uppercase font-black tracking-widest block mb-0.5 ${
                modoFondoBlanco ? 'text-slate-600' : 'text-slate-400'
              } print:text-slate-700`}>
                Total General de la Operación
              </span>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono tracking-tight print:text-black">
                Gs. {liquidacion.totalGeneralOperacion.toLocaleString('es-PY')}
              </div>
            </div>
          </div>
        </section>

        {/* Bloque de Firmas Notariales Oficiales (Exclusivo para Impresión Física) */}
        <div className="hidden print:grid grid-cols-2 gap-12 pt-16 pb-6 text-center text-xs text-black">
          <div className="border-t border-slate-900 pt-2 mx-8">
            <p className="font-bold uppercase tracking-wider">{membrete.nombreNotario}</p>
            <p className="text-[10px] text-slate-700">Notario y Escribano Público - {membrete.registroNotarial}</p>
            <p className="text-[9px] text-slate-500 font-mono">Firma y Sello Notarial</p>
          </div>
          <div className="border-t border-slate-900 pt-2 mx-8">
            <p className="font-bold uppercase tracking-wider">{encabezado.clienteNombre || 'Firma del Cliente / Aceptante'}</p>
            <p className="text-[10px] text-slate-700">RUC/CI: {encabezado.clienteRucCI || '........................'}</p>
            <p className="text-[9px] text-slate-500 font-mono">Conforme / Aceptación del Presupuesto</p>
          </div>
        </div>
      </div>

      {/* Modal de Configuración Rápida de Membrete Notarial */}
      {modalMembreteAbierto && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl shadow-2xl p-6 md:p-8 space-y-6 text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Membrete Institucional del Escribano</h3>
                  <p className="text-xs text-slate-400">Configuración particular para presupuestos y facturación</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalMembreteAbierto(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="md:col-span-2">
                <label className="block text-slate-300 font-bold mb-1">Nombre y Apellido del Notario / Escribano Público *</label>
                <input
                  type="text"
                  value={membreteDraft.nombreNotario}
                  onChange={(e) => setMembreteDraft(prev => ({ ...prev, nombreNotario: e.target.value }))}
                  placeholder="Ej. Esc. Sandra Molinas"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-bold focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Número de Registro Notarial *</label>
                <input
                  type="text"
                  value={membreteDraft.registroNotarial}
                  onChange={(e) => setMembreteDraft(prev => ({ ...prev, registroNotarial: e.target.value }))}
                  placeholder="Ej. Reg. Nº 1.292"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">RUC de la Escribanía *</label>
                <input
                  type="text"
                  value={membreteDraft.ruc}
                  onChange={(e) => setMembreteDraft(prev => ({ ...prev, ruc: e.target.value }))}
                  placeholder="Ej. 80012345-6"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-300 font-bold mb-1">Firma / Nombre de la Escribanía</label>
                <input
                  type="text"
                  value={membreteDraft.nombreEscribania || ''}
                  onChange={(e) => setMembreteDraft(prev => ({ ...prev, nombreEscribania: e.target.value }))}
                  placeholder="Ej. Escribanía Sandra Molinas & Asociados"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-300 font-bold mb-1">Dirección Comercial *</label>
                <input
                  type="text"
                  value={membreteDraft.direccion}
                  onChange={(e) => setMembreteDraft(prev => ({ ...prev, direccion: e.target.value }))}
                  placeholder="Ej. Avda. Carlos Antonio López 450, Asunción"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Teléfono de Contacto *</label>
                <input
                  type="text"
                  value={membreteDraft.telefono}
                  onChange={(e) => setMembreteDraft(prev => ({ ...prev, telefono: e.target.value }))}
                  placeholder="Ej. +595 21 445 000"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Correo Electrónico *</label>
                <input
                  type="email"
                  value={membreteDraft.email}
                  onChange={(e) => setMembreteDraft(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Ej. contacto@escribaniamolinas.com.py"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Nº de Timbrado Oficial *</label>
                <input
                  type="text"
                  value={membreteDraft.timbradoNumero}
                  onChange={(e) => setMembreteDraft(prev => ({ ...prev, timbradoNumero: e.target.value }))}
                  placeholder="Ej. 16894321"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Inicio Vigencia</label>
                  <input
                    type="date"
                    value={membreteDraft.timbradoVigenciaInicio}
                    onChange={(e) => setMembreteDraft(prev => ({ ...prev, timbradoVigenciaInicio: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-white focus:border-amber-500 focus:outline-none cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Fin Vigencia</label>
                  <input
                    type="date"
                    value={membreteDraft.timbradoVigenciaFin}
                    onChange={(e) => setMembreteDraft(prev => ({ ...prev, timbradoVigenciaFin: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-white focus:border-amber-500 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 gap-3">
              <span className="text-[11px] text-slate-400">
                Se guardará de forma exclusiva en su perfil ({userId || 'usuario actual'}).
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalMembreteAbierto(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGuardarMembrete}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
                >
                  Guardar Membrete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL OFICIAL DE PREVISUALIZACIÓN E IMPRESIÓN NOTARIAL (A4 / OFICIO 1 PÁG) */}
      {/* ========================================================================= */}
      {modalImpresionAbierto && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-start p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          {/* BARRA SUPERIOR DE ACCIONES Y FORMATO */}
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-5 flex flex-wrap items-center justify-between gap-4 shadow-2xl sticky top-2 z-30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm tracking-tight">Previsualización de Presupuesto Notarial</h3>
                <p className="text-slate-400 text-xs">Formato oficial calibrado para encajar perfectamente en 1 sola página</p>
              </div>
            </div>

            {/* Selector de Papel y Acciones */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setFormatoPapel('a4')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    formatoPapel === 'a4'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  A4 (210 × 297 mm)
                </button>
                <button
                  type="button"
                  onClick={() => setFormatoPapel('oficio')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    formatoPapel === 'oficio'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Oficio (216 × 330 mm)
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleImprimirPresupuestoDirecto(formatoPapel)}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-emerald-950/40 cursor-pointer active:scale-95"
              >
                <Printer className="w-4 h-4 text-white" />
                <span>IMPRIMIR AHORA</span>
              </button>

              <button
                type="button"
                onClick={() => setModalImpresionAbierto(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title="Cerrar previsualización"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* SIMULACIÓN DE LA HOJA IMPRESA EN PAPEL BLANCO NOTARIAL */}
          <div className="w-full flex justify-center pb-12">
            <div
              id="hoja-presupuesto-impresion"
              style={{
                width: formatoPapel === 'a4' ? '210mm' : '216mm',
                minHeight: formatoPapel === 'a4' ? '297mm' : '330mm',
                boxSizing: 'border-box',
              }}
              className="bg-white text-slate-900 rounded-lg shadow-2xl p-8 sm:p-10 border border-slate-200 font-sans flex flex-col justify-between"
            >
              <div>
                {/* CABECERA NOTARIAL */}
                <div className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-start gap-4">
                  <div>
                    <h2 className="text-xl font-serif font-black uppercase tracking-wide text-slate-900">
                      {membrete.nombreNotario || 'Escribanía Notarial'}
                    </h2>
                    <p className="text-xs text-slate-600 font-bold mt-0.5">
                      {membrete.registroNotarial || 'Registro Notarial'} • {membrete.nombreEscribania || 'Escribanía Pública'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {membrete.direccion || 'Asunción, República del Paraguay'}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Tel: {membrete.telefono || '+595 21 000-000'} | R.U.C.: {membrete.ruc || '80012345-6'} | Timbrado: {membrete.timbradoNumero || '16894321'}
                    </p>
                  </div>
                  <div style={{ backgroundColor: "#f8fafc", borderColor: "#cbd5e1" }} className="border rounded-xl p-3 text-right min-w-[170px] shrink-0">
                    <span className="text-xs font-black text-slate-900 uppercase tracking-widest block">
                      {encabezado.tipoComprobante || 'PRESUPUESTO'}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-800 block mt-0.5">
                      Nº {encabezado.numeroComprobante || 'PRES-0001'}
                    </span>
                    <span className="text-[10px] text-slate-600 block mt-1">
                      Emisión: {encabezado.fechaEmision || new Date().toISOString().slice(0, 10)}
                    </span>
                    <span className="text-[10px] text-slate-600 block">
                      Condición: {encabezado.condicionVenta || 'Contado'}
                    </span>
                  </div>
                </div>

                {/* TARJETA DE DATOS DEL CLIENTE */}
                <div style={{ backgroundColor: "#f8fafc", borderColor: "#cbd5e1" }} className="border rounded-xl p-3 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider block">Cliente / Razón Social</span>
                    <strong className="text-slate-900 font-bold text-sm">{encabezado.clienteNombre || 'Consumidor Final'}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider block">R.U.C. / C.I.</span>
                    <strong className="text-slate-900 font-mono font-bold">{encabezado.clienteRucCI || 'Sin Especificar'}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider block">Domicilio</span>
                    <span className="text-slate-700">{encabezado.clienteDireccion || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider block">Contacto / Teléfono</span>
                    <span className="text-slate-700">{encabezado.clienteTelefono || '-'}</span>
                  </div>
                  <div className="sm:col-span-2 pt-1.5 border-t border-slate-200">
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider block">Acto o Trámite Notarial</span>
                    <span className="text-slate-900 font-semibold">{encabezado.conceptoGeneral || 'Servicios y Gestiones Notariales'}</span>
                  </div>
                </div>

                {/* TABLA 1: TASAS Y REEMBOLSOS */}
                <div className="mb-3">
                  <div style={{ backgroundColor: "#f1f5f9", borderColor: "#cbd5e1" }} className="px-3 py-1.5 rounded-lg flex justify-between items-center text-xs font-black uppercase text-slate-900 tracking-wide mb-1 border">
                    <span>I. Tasas Judiciales, Registros e Impuestos (Reembolsos Oficiales)</span>
                    <span className="font-mono text-emerald-800">Subtotal: Gs. {liquidacion.subtotalTasasReembolso.toLocaleString('es-PY')}</span>
                  </div>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-300 text-[10px] text-slate-500 font-bold uppercase">
                        <th className="py-1 px-2 text-left">Concepto Oficial</th>
                        <th className="py-1 px-2 text-center w-28">Nº Boleta</th>
                        <th className="py-1 px-2 text-right w-32">Monto (PYG)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasas.filter(t => t.activo).length > 0 ? (
                        tasas.filter(t => t.activo).map(t => (
                          <tr key={t.id} className="border-b border-slate-100">
                            <td className="py-1 px-2 text-slate-800">{t.descripcion}</td>
                            <td className="py-1 px-2 text-center text-slate-500 font-mono text-[10px]">{t.numeroComprobantePago || '-'}</td>
                            <td className="py-1 px-2 text-right font-mono font-bold text-slate-900">Gs. {Number(t.monto).toLocaleString('es-PY')}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="py-2 text-center text-slate-400 italic text-[11px]">Sin tasas judiciales cargadas en este presupuesto.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* TABLA 2: SERVICIOS Y HONORARIOS */}
                <div className="mb-3">
                  <div style={{ backgroundColor: "#f1f5f9", borderColor: "#cbd5e1" }} className="px-3 py-1.5 rounded-lg flex justify-between items-center text-xs font-black uppercase text-slate-900 tracking-wide mb-1 border">
                    <span>II. Servicios Notariales, Honorarios y Gestiones</span>
                    <span className="font-mono text-amber-800">Subtotal: Gs. {liquidacion.totalVentaServicios.toLocaleString('es-PY')}</span>
                  </div>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-300 text-[10px] text-slate-500 font-bold uppercase">
                        <th className="py-1 px-2 text-left">Descripción del Servicio</th>
                        <th className="py-1 px-2 text-center w-16">Cant.</th>
                        <th className="py-1 px-2 text-right w-24">Precio Unit.</th>
                        <th className="py-1 px-2 text-center w-14">IVA</th>
                        <th className="py-1 px-2 text-right w-28">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {servicios.filter(s => s.activo).length > 0 ? (
                        servicios.filter(s => s.activo).map(s => (
                          <tr key={s.id} className="border-b border-slate-100">
                            <td className="py-1 px-2 text-slate-800">{s.descripcion}</td>
                            <td className="py-1 px-2 text-center font-mono">{s.cantidad}</td>
                            <td className="py-1 px-2 text-right font-mono">Gs. {Number(s.precioUnitario).toLocaleString('es-PY')}</td>
                            <td className="py-1 px-2 text-center font-mono text-[10px]">{s.tipoIva === 'exenta' ? 'Ex.' : s.tipoIva + '%'}</td>
                            <td className="py-1 px-2 text-right font-mono font-bold text-slate-900">Gs. {Number(s.total).toLocaleString('es-PY')}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-2 text-center text-slate-400 italic text-[11px]">Sin honorarios de servicios cargados.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* CUADRO DE LIQUIDACIÓN Y TOTALES */}
                <div style={{ backgroundColor: "#ffffff", borderColor: "#0f172a" }} className="border-2 rounded-xl p-3 mb-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="text-[10px] text-slate-600 sm:border-r border-slate-200 pr-2">
                    <span className="font-black uppercase tracking-wider text-slate-800 block mb-1">Liquidación Tributaria (IVA):</span>
                    <div className="grid grid-cols-2 gap-1 font-mono">
                      <span>Exentas:</span><span className="text-right">Gs. {liquidacion.subtotalServiciosExentas.toLocaleString('es-PY')}</span>
                      <span>Gravadas 5%:</span><span className="text-right">Gs. {liquidacion.subtotalServicios5.toLocaleString('es-PY')}</span>
                      <span>Gravadas 10%:</span><span className="text-right">Gs. {liquidacion.subtotalServicios10.toLocaleString('es-PY')}</span>
                      <span className="font-bold text-slate-900">Total IVA Liq.:</span>
                      <span className="text-right font-bold text-slate-900">Gs. {liquidacion.totalIvaLiquidado.toLocaleString('es-PY')}</span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between text-right">
                    <div className="space-y-0.5 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal Tasas:</span>
                        <span className="font-mono font-semibold">Gs. {liquidacion.subtotalTasasReembolso.toLocaleString('es-PY')}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal Honorarios:</span>
                        <span className="font-mono font-semibold">Gs. {liquidacion.totalVentaServicios.toLocaleString('es-PY')}</span>
                      </div>
                    </div>
                    <div className="pt-1.5 border-t border-slate-200 mt-2 flex justify-between items-baseline">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-900">Total a Pagar:</span>
                      <span className="text-lg font-mono font-black text-slate-950">Gs. {liquidacion.totalGeneralOperacion.toLocaleString('es-PY')}</span>
                    </div>
                  </div>
                </div>

                {/* OBSERVACIONES */}
                <div className="border-l-2 border-slate-300 pl-2.5 text-[10px] text-slate-500 mb-6">
                  <strong className="text-slate-700">Observaciones:</strong> {observaciones}
                </div>
              </div>

              {/* SECCIÓN DE FIRMAS */}
              <div className="grid grid-cols-2 gap-8 text-center pt-8 border-t border-slate-200">
                <div>
                  <div className="border-t border-slate-800 pt-1.5 text-xs font-bold text-slate-800">
                    Firma y Aclaración del Cliente
                  </div>
                  <span className="text-[10px] text-slate-500 block">C.I. / R.U.C.: {encabezado.clienteRucCI || 'Sin Especificar'}</span>
                </div>
                <div>
                  <div className="border-t border-slate-800 pt-1.5 text-xs font-bold text-slate-800">
                    {membrete.nombreNotario || 'Notario Público Titular'}
                  </div>
                  <span className="text-[10px] text-slate-500 block">{membrete.registroNotarial || 'Escribanía Notarial'} • Sello</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
