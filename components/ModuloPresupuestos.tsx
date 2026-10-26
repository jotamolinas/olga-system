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
import { consultarRUC, formatearRUCConDV } from '../services/dnitService';
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
}) => {
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

    const rucFormateado = formatearRUCConDV(persona.nro_documento || '');

    setEncabezado((prev) => ({
      ...prev,
      clienteNombre: nombreCompleto,
      clienteRucCI: rucFormateado || persona.nro_documento || prev.clienteRucCI,
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
    if (!doc || doc.length < 3) {
      setFeedbackDnit({
        tipo: 'warning',
        mensaje: 'Ingrese un RUC o Cédula válido (mínimo 3 caracteres) para consultar ante el DNIT / SET.',
      });
      setTimeout(() => setFeedbackDnit(null), 4000);
      return;
    }

    setCargandoDnit(true);
    setFeedbackDnit(null);
    try {
      const res = await consultarRUC(doc);
      if (res && (res.nombre_o_razon_social || res.nombre)) {
        const nombreFinal = res.nombre || res.nombre_o_razon_social;
        const rucFinal = res.ruc || (res.dv ? `${res.documento_numero}-${res.dv}` : res.documento_numero);

        setEncabezado((prev) => ({
          ...prev,
          clienteNombre: nombreFinal,
          clienteRucCI: rucFinal,
          clienteDireccion: res.direccion || prev.clienteDireccion,
          clienteTelefono: res.telefono || prev.clienteTelefono,
        }));
        setOrigenCliente(res.origen === 'FICHERO' ? 'FICHERO' : 'DNIT');
        setFeedbackDnit({
          tipo: 'success',
          mensaje: `Contribuyente verificado (${res.origen === 'FICHERO' ? 'Fichero Local' : 'Padrón Oficial DNIT / SET'}): ${nombreFinal} [${rucFinal}]`,
        });
        setTimeout(() => setFeedbackDnit(null), 4500);

        // Autoguardado silencioso instantáneo en el Fichero de Personas
        autoguardarClienteSilencioso({
          nombre: nombreFinal,
          doc: rucFinal,
          direccion: res.direccion,
          telefono: res.telefono,
          origen: res.origen === 'FICHERO' ? 'FICHERO' : 'DNIT',
        });
      } else {
        setFeedbackDnit({
          tipo: 'warning',
          mensaje: 'Documento no localizado en el padrón de contribuyentes de la DNIT. Puede ingresar los datos manualmente.',
        });
        setTimeout(() => setFeedbackDnit(null), 4000);
      }
    } catch (err) {
      console.warn('Consulta DNIT no completada:', err);
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

  // Función de Impresión Oficial Nativa (ejecuta window.print con estilos de Tailwind)
  const handleImprimir = () => {
    autoguardarClienteSilencioso();
    window.print();
  };

  return (
    <div className={`min-h-full flex flex-col font-sans rounded-3xl overflow-hidden border shadow-2xl transition-colors duration-200 print:border-none print:shadow-none print:p-0 print:m-0 print:bg-white print:text-black print:rounded-none ${
      modoFondoBlanco 
        ? 'bg-slate-100 text-slate-800 border-slate-300' 
        : 'bg-slate-900 text-slate-100 border-slate-800'
    }`}>
      {/* Cabecera Principal del Módulo (oculta al imprimir) */}
      <header className={`p-6 md:p-8 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative overflow-hidden transition-colors print:hidden ${
        modoFondoBlanco
          ? 'bg-white border-slate-200 text-slate-900'
          : 'bg-slate-950 border-slate-800 text-white'
      }`}>
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 blur-[100px] rounded-full pointer-events-none"></div>

        <div className="relative z-10 flex items-center gap-4">
          {onVolver && (
            <button
              onClick={onVolver}
              type="button"
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors border flex items-center gap-2 cursor-pointer ${
                modoFondoBlanco
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver</span>
            </button>
          )}

          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20 shadow-inner">
            <Banknote className="w-6 h-6 text-amber-500" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className={`text-xl md:text-2xl font-black tracking-tight font-serif ${modoFondoBlanco ? 'text-slate-900' : 'text-white'}`}>
                Presupuestos y Facturación Notarial
              </h1>
              <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-700 border border-amber-500/30 text-[9px] font-black uppercase tracking-widest rounded-lg">
                Ley 879
              </span>
            </div>
            <p className={`text-xs mt-1 font-medium ${modoFondoBlanco ? 'text-slate-500' : 'text-slate-400'}`}>
              Gestión modular de reembolsos de tasas judiciales, aranceles registrales y honorarios de escribanía.
            </p>
          </div>
        </div>

        {/* Botones de Acción Global */}
        <div className="flex flex-wrap items-center gap-2.5 relative z-10 print:hidden">
          <button
            type="button"
            onClick={handleRestaurarDefecto}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
              modoFondoBlanco
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700'
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
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-60 ${
              guardadoExito
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/30'
                : modoFondoBlanco
                ? 'bg-slate-800 hover:bg-slate-900 text-white border-slate-700'
                : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-600'
            }`}
            title="Guardar en base de datos Firestore y respaldo local"
          >
            {guardandoFirestore ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
            ) : guardadoExito ? (
              <Check className="w-4 h-4 text-white" />
            ) : (
              <Save className="w-4 h-4 text-emerald-400" />
            )}
            <span>{guardandoFirestore ? 'Guardando en BD...' : guardadoExito ? '¡Presupuesto Guardado!' : 'Guardar Presupuesto'}</span>
          </button>

          <button
            type="button"
            onClick={handleImprimir}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-950" />
            <span>Imprimir {encabezado.tipoComprobante}</span>
          </button>
        </div>
      </header>

      {/* Barra de Filtros y Subsecciones (oculta al imprimir) */}
      <div className={`px-6 py-3 border-b flex items-center justify-between gap-4 flex-wrap transition-colors print:hidden ${
        modoFondoBlanco
          ? 'bg-white border-slate-200 text-slate-800'
          : 'bg-slate-950/60 border-slate-800 text-slate-200'
      }`}>
        <div className="flex items-center gap-2">
          {(['todo', 'tasas', 'servicios', 'resumen'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setPestañaActiva(tab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                pestañaActiva === tab
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                  : modoFondoBlanco
                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
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
          <div className={`${modoFondoBlanco ? 'text-slate-500' : 'text-slate-400'} hidden sm:block`}>
            Tasas: <strong className={modoFondoBlanco ? 'text-slate-800' : 'text-slate-200'}>Gs. {liquidacion.subtotalTasasReembolso.toLocaleString('es-PY')}</strong>
          </div>
          <div className={`${modoFondoBlanco ? 'text-slate-500' : 'text-slate-400'} hidden sm:block`}>
            Servicios: <strong className={modoFondoBlanco ? 'text-slate-800' : 'text-slate-200'}>Gs. {liquidacion.totalVentaServicios.toLocaleString('es-PY')}</strong>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-xl text-amber-600 dark:text-amber-400 font-bold">
            Total: Gs. {liquidacion.totalGeneralOperacion.toLocaleString('es-PY')}
          </div>
        </div>
      </div>

      {/* Contenido Modular con Scroll Limpio */}
      <div className="p-6 md:p-8 space-y-8 overflow-y-auto max-h-[calc(100vh-220px)] print:p-0 print:m-0 print:space-y-4 print:overflow-visible print:max-h-none">
        {/* Banner de Membrete Notarial Dinámico (Configuración Multi-usuario) */}
        <div className={`border rounded-2xl p-5 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative overflow-hidden transition-colors print:border print:border-slate-800 print:shadow-none print:p-4 print:bg-white print:text-black print:rounded-xl ${
          modoFondoBlanco
            ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/50'
            : 'bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-slate-800 text-slate-100'
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
          className={`rounded-2xl p-5 md:p-6 shadow-xl space-y-5 border transition-colors print:rounded-none print:border print:border-slate-300 print:shadow-none print:p-4 print:bg-white print:text-black ${
            modoFondoBlanco
              ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/60'
              : 'bg-slate-950/80 border-slate-800/90 text-white shadow-xl'
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
        <section className={`rounded-2xl p-5 md:p-6 shadow-xl space-y-4 border transition-colors print:rounded-none print:border print:border-slate-300 print:shadow-none print:p-4 print:bg-white print:text-black ${
          pestañaActiva !== 'todo' && pestañaActiva !== 'tasas' ? 'hidden print:block' : 'block'
        } ${
          modoFondoBlanco
            ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/60'
            : 'bg-slate-950/80 border-slate-800/90 text-white shadow-xl'
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
                        className={`w-full rounded-lg px-2.5 py-1 text-right font-mono font-bold text-xs focus:outline-none print:border-none print:p-0 print:bg-transparent print:text-black ${
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
        <section className={`rounded-2xl p-5 md:p-6 shadow-xl space-y-4 border transition-colors print:rounded-none print:border print:border-slate-300 print:shadow-none print:p-4 print:bg-white print:text-black ${
          pestañaActiva !== 'todo' && pestañaActiva !== 'servicios' ? 'hidden print:block' : 'block'
        } ${
          modoFondoBlanco
            ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/60'
            : 'bg-slate-950/80 border-slate-800/90 text-white shadow-xl'
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
                        className={`w-16 rounded-lg px-2 py-1 text-center font-mono text-xs focus:outline-none mx-auto print:border-none print:p-0 print:bg-transparent print:text-black ${
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
          <div className={`lg:col-span-2 rounded-2xl p-5 md:p-6 shadow-xl space-y-3 border transition-colors print:col-span-2 print:rounded-none print:border print:border-slate-300 print:shadow-none print:p-4 print:bg-white print:text-black ${
            modoFondoBlanco
              ? 'bg-white border-slate-200 text-slate-900 shadow-slate-200/60'
              : 'bg-slate-950/80 border-slate-800/90 text-white shadow-xl'
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
    </div>
  );
};
