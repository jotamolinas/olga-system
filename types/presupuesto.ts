// ============================================================================
// MÓDULO NOTARIAL O.L.G.A. - PRESUPUESTOS Y FACTURACIÓN (PARTE 1)
// Definiciones de Tipos, Interfaces y Estados Base React
// ============================================================================

export type CondicionVenta = 'Contado' | 'Crédito';
export type TipoComprobante = 'Presupuesto' | 'Factura';
export type TipoIvaNotarial = 'exenta' | '5' | '10';

export type CategoriaTasaReembolso = 
  | 'judicial' 
  | 'hipoteca' 
  | 'municipal' 
  | 'especial' 
  | 'automotor' 
  | 'otro';

/**
 * 1. DATOS DEL ENCABEZADO
 * Contiene la información fiscal, identificación del cliente y concepto de la operación notarial.
 */
export interface EncabezadoFacturaPresupuesto {
  tipoComprobante: TipoComprobante;
  numeroComprobante: string;         // Ej: "001-001-0000452" o "PRES-2026-0089"
  timbrado: string;                  // Timbrado fiscal SET/DNIT (Ej: "16894321")
  fechaEmision: string;              // Formato YYYY-MM-DD
  fechaVencimientoValidez: string;   // Vencimiento de timbrado o validez de presupuesto
  condicionVenta: CondicionVenta;
  clienteNombre: string;             // Razón social o nombres y apellidos completos
  clienteRucCI: string;              // Cédula o RUC con dígito verificador
  clienteTelefono: string;
  clienteDireccion: string;
  clienteEmail?: string;
  conceptoGeneral: string;           // Ej: "Escritura de Transferencia de Inmueble e Hipoteca"
  localidad: string;                 // Ej: "Asunción", "Ciudad del Este"
}

/**
 * 1.1 CONFIGURACIÓN DINÁMICA DE MEMBRETE INSTITUCIONAL (MULTI-USUARIO)
 * Permite que cada escribano/notario configure de forma independiente sus datos institucionales.
 */
export interface MembreteEscribaniaConfig {
  nombreNotario: string;           // Nombre y Apellido del Notario / Escribano Público
  registroNotarial: string;        // Número de Registro Notarial (Ej. Reg. Nº 1.292)
  nombreEscribania?: string;       // Nombre de la escribanía o firma (Ej. Escribanía Molinas & Asociados)
  direccion: string;               // Dirección comercial / sede
  telefono: string;                // Teléfono de contacto
  email: string;                   // Correo electrónico institucional
  ruc: string;                     // RUC de la escribanía / notario
  timbradoNumero: string;          // Nº de Timbrado SET/DNIT
  timbradoVigenciaInicio: string;  // Inicio de Vigencia (YYYY-MM-DD)
  timbradoVigenciaFin: string;     // Fin de Vigencia (YYYY-MM-DD)
  logoUrl?: string | null;         // Logo o insignia notarial
}

export const MEMBRETE_DEFAULT: MembreteEscribaniaConfig = {
  nombreNotario: 'Esc. Sandra Molinas',
  registroNotarial: 'Reg. Nº 1.292',
  nombreEscribania: 'Escribanía Notarial Sandra Molinas & Asociados',
  direccion: 'Avda. Carlos Antonio López 450 c/ Colón, Asunción',
  telefono: '+595 21 445 000 / +595 981 123 456',
  email: 'contacto@escribaniamolinas.com.py',
  ruc: '80012345-6',
  timbradoNumero: '16894321',
  timbradoVigenciaInicio: '2026-01-01',
  timbradoVigenciaFin: '2026-12-31',
  logoUrl: null,
};

export const getMembreteStorageKey = (userId?: string | null): string => {
  if (userId && String(userId).trim().length > 0) {
    return `olga_escribania_membrete_${String(userId).trim()}`;
  }
  return 'olga_escribania_membrete_default';
};

export const cargarMembreteUsuario = (userId?: string | null): MembreteEscribaniaConfig => {
  try {
    const key = getMembreteStorageKey(userId);
    const data = localStorage.getItem(key);
    if (data) {
      const parsed = JSON.parse(data);
      return { ...MEMBRETE_DEFAULT, ...parsed };
    }

    // Fallback retrocompatible al perfil institucional anterior si existía
    const fallbackInstitucional = localStorage.getItem('olga_configuracion_institucional');
    if (fallbackInstitucional) {
      const parsed = JSON.parse(fallbackInstitucional);
      return {
        ...MEMBRETE_DEFAULT,
        nombreNotario: parsed.nombreTitular || parsed.nombreInstitucion || MEMBRETE_DEFAULT.nombreNotario,
        registroNotarial: parsed.registroNotarial || MEMBRETE_DEFAULT.registroNotarial,
        ruc: parsed.ruc || MEMBRETE_DEFAULT.ruc,
        direccion: parsed.direccion || MEMBRETE_DEFAULT.direccion,
        telefono: parsed.telefono || MEMBRETE_DEFAULT.telefono,
        email: parsed.email || MEMBRETE_DEFAULT.email,
        timbradoNumero: parsed.timbradoNumero || MEMBRETE_DEFAULT.timbradoNumero,
        timbradoVigenciaInicio: parsed.timbradoVigenciaInicio || MEMBRETE_DEFAULT.timbradoVigenciaInicio,
        timbradoVigenciaFin: parsed.timbradoVigenciaFin || MEMBRETE_DEFAULT.timbradoVigenciaFin,
      };
    }
  } catch (err) {
    console.warn('Error al cargar membrete de escribanía:', err);
  }
  return MEMBRETE_DEFAULT;
};

export const guardarMembreteUsuario = (
  config: MembreteEscribaniaConfig,
  userId?: string | null
): void => {
  try {
    const key = getMembreteStorageKey(userId);
    localStorage.setItem(key, JSON.stringify(config));
    // Sincronización reactiva inmediata entre pestañas/vistas
    window.dispatchEvent(
      new CustomEvent('olga_escribania_updated', {
        detail: { userId: userId || 'default', config },
      })
    );
  } catch (err) {
    console.error('Error al guardar membrete de escribanía:', err);
  }
};

/**
 * 2. ESTRUCTURA PARA REEMBOLSO DE IMPUESTOS Y TASAS
 * Desembolsos oficiales efectuados por el notario por cuenta y orden del cliente.
 * Suelen ser no computables para IVA o exentos según la normativa notarial paraguaya.
 */
export interface ItemTasaReembolso {
  id: string;
  categoria: CategoriaTasaReembolso;
  descripcion: string;
  monto: number;
  tipoIva: TipoIvaNotarial;
  activo: boolean;                   // Permite incluir/excluir en el cálculo y visualización
  numeroComprobantePago?: string;    // Nro de recibo o boleta de pago judicial/municipal
  observacion?: string;
}

/**
 * 3. ESTRUCTURA PARA VENTAS, SERVICIOS Y HONORARIOS PROFESIONALES
 * Servicios arancelarios y gestiones propias de la escribanía con desglose impositivo.
 */
export interface ItemServicioHonorario {
  id: string;
  codigoConcepto?: string;           // Código de referencia (ej: 'HON-ESC', 'CERT-DOM')
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  tipoIva: TipoIvaNotarial;
  montoExento: number;
  montoIva5: number;
  montoIva10: number;
  total: number;
  activo: boolean;                   // Habilitar o deshabilitar cada ítem individualmente
  esPersonalizado?: boolean;         // true si es un renglón dinámico agregado por el usuario
}

/**
 * 4. RESUMEN DE TOTALES Y LIQUIDACIÓN TRIBUTARIA
 */
export interface LiquidacionPresupuestoFactura {
  subtotalTasasReembolso: number;
  subtotalServiciosExentas: number;
  subtotalServicios5: number;
  subtotalServicios10: number;
  totalVentaServicios: number;
  iva5: number;
  iva10: number;
  totalIvaLiquidado: number;
  totalGeneralOperacion: number;     // Reembolsos + Servicios + Impuestos
  totalLetras: string;
}

/**
 * 5. ESTADO GLOBAL COMPLETO DEL MÓDULO
 */
export interface EstadoModuloPresupuestoFactura {
  encabezado: EncabezadoFacturaPresupuesto;
  tasasReembolso: ItemTasaReembolso[];
  serviciosHonorarios: ItemServicioHonorario[];
  observacionesGenerales: string;
}

// ============================================================================
// VALORES INICIALES POR DEFECTO PARA ESCRIBANÍA (PARAGUAY)
// ============================================================================

export const ITEMS_TASAS_REEMBOLSO_BASE: ItemTasaReembolso[] = [
  {
    id: 'tasa-jud-1',
    categoria: 'judicial',
    descripcion: 'Tasas Judiciales (Corte Suprema de Justicia - DGRP)',
    monto: 185000,
    tipoIva: 'exenta',
    activo: true,
  },
  {
    id: 'tasa-hip-1',
    categoria: 'hipoteca',
    descripcion: 'Arancel de Inscripción de Hipoteca / Garantía Real',
    monto: 320000,
    tipoIva: 'exenta',
    activo: true,
  },
  {
    id: 'tasa-mun-1',
    categoria: 'municipal',
    descripcion: 'Impuesto de Fraccionamiento / Transferencia Municipal',
    monto: 150000,
    tipoIva: 'exenta',
    activo: true,
  },
  {
    id: 'tasa-esp-1',
    categoria: 'especial',
    descripcion: 'Tasas Especiales / Legalización Notarial y Apostilla',
    monto: 95000,
    tipoIva: 'exenta',
    activo: false,
  },
  {
    id: 'tasa-aut-1',
    categoria: 'automotor',
    descripcion: 'Tasa Registro Automotores y Cédula del Automotor',
    monto: 240000,
    tipoIva: 'exenta',
    activo: false,
  },
];

export const ITEMS_SERVICIOS_HONORARIOS_BASE: ItemServicioHonorario[] = [
  {
    id: 'srv-gastos-adm',
    codigoConcepto: 'GAST-ADM',
    descripcion: 'Gastos administrativos de secretaría y papelería notarial',
    cantidad: 1,
    precioUnitario: 150000,
    tipoIva: '10',
    montoExento: 0,
    montoIva5: 0,
    montoIva10: 150000,
    total: 150000,
    activo: true,
  },
  {
    id: 'srv-cert-dominio',
    codigoConcepto: 'CERT-DOM',
    descripcion: 'Certificado de Condiciones de Dominio (DGRP)',
    cantidad: 1,
    precioUnitario: 120000,
    tipoIva: '10',
    montoExento: 0,
    montoIva5: 0,
    montoIva10: 120000,
    total: 120000,
    activo: true,
  },
  {
    id: 'srv-cert-anotaciones',
    codigoConcepto: 'CERT-ANOT',
    descripcion: 'Certificado de Anotaciones Personales / No Interdicción',
    cantidad: 1,
    precioUnitario: 120000,
    tipoIva: '10',
    montoExento: 0,
    montoIva5: 0,
    montoIva10: 120000,
    total: 120000,
    activo: true,
  },
  {
    id: 'srv-cert-vigencia',
    codigoConcepto: 'CERT-VIG',
    descripcion: 'Certificado de Vigencia de Poder / Personería Jurídica',
    cantidad: 1,
    precioUnitario: 90000,
    tipoIva: '10',
    montoExento: 0,
    montoIva5: 0,
    montoIva10: 90000,
    total: 90000,
    activo: false,
  },
  {
    id: 'srv-expedicion-copias',
    codigoConcepto: 'EXP-COP',
    descripcion: 'Expedición de Primer y Segundo Testimonio Notarial',
    cantidad: 1,
    precioUnitario: 180000,
    tipoIva: '10',
    montoExento: 0,
    montoIva5: 0,
    montoIva10: 180000,
    total: 180000,
    activo: true,
  },
  {
    id: 'srv-gestion-municipal',
    codigoConcepto: 'GEST-MUN',
    descripcion: 'Gestión de Impuesto Inmobiliario y Catastro Municipal',
    cantidad: 1,
    precioUnitario: 100000,
    tipoIva: '10',
    montoExento: 0,
    montoIva5: 0,
    montoIva10: 100000,
    total: 100000,
    activo: true,
  },
  {
    id: 'srv-ande-essap',
    codigoConcepto: 'SERV-PUB',
    descripcion: 'Constancia de no adeudar servicios (ANDE / ESSAP / COPACO)',
    cantidad: 1,
    precioUnitario: 60000,
    tipoIva: '10',
    montoExento: 0,
    montoIva5: 0,
    montoIva10: 60000,
    total: 60000,
    activo: false,
  },
  {
    id: 'srv-catastral',
    codigoConcepto: 'SNC-CAT',
    descripcion: 'Certificado Catastral del Servicio Nacional de Catastro (SNC)',
    cantidad: 1,
    precioUnitario: 140000,
    tipoIva: '10',
    montoExento: 0,
    montoIva5: 0,
    montoIva10: 140000,
    total: 140000,
    activo: true,
  },
  {
    id: 'srv-registro-publico',
    codigoConcepto: 'DGRP-REG',
    descripcion: 'Diligenciamiento e ingreso ante la Dirección General de Registros Públicos',
    cantidad: 1,
    precioUnitario: 200000,
    tipoIva: '10',
    montoExento: 0,
    montoIva5: 0,
    montoIva10: 200000,
    total: 200000,
    activo: true,
  },
  {
    id: 'srv-inscripcion-tasa',
    codigoConcepto: 'INSC-REG',
    descripcion: 'Trámite de Retiro e Inscripción Definitiva con Matrícula',
    cantidad: 1,
    precioUnitario: 150000,
    tipoIva: '10',
    montoExento: 0,
    montoIva5: 0,
    montoIva10: 150000,
    total: 150000,
    activo: true,
  },
  {
    id: 'srv-honorarios-prof',
    codigoConcepto: 'HON-PROF',
    descripcion: 'Honorarios Profesionales del Notario Público (Arancel Notarial)',
    cantidad: 1,
    precioUnitario: 2500000,
    tipoIva: '10',
    montoExento: 0,
    montoIva5: 0,
    montoIva10: 2500000,
    total: 2500000,
    activo: true,
  },
];

export const ENCABEZADO_INICIAL: EncabezadoFacturaPresupuesto = {
  tipoComprobante: 'Presupuesto',
  numeroComprobante: 'PRES-2026-0001',
  timbrado: '17283940',
  fechaEmision: '2026-10-25',
  fechaVencimientoValidez: '2026-11-25',
  condicionVenta: 'Contado',
  clienteNombre: 'JUAN CARLOS PÉREZ GÓMEZ',
  clienteRucCI: '1234567-8',
  clienteTelefono: '+595 981 123456',
  clienteDireccion: 'Avda. Mcal. López c/ San Martín, Asunción',
  clienteEmail: 'cliente@ejemplo.com.py',
  conceptoGeneral: 'Presupuesto de Gastos y Honorarios para Escritura de Transferencia Inmobiliaria',
  localidad: 'Asunción',
};

export const ESTADO_INICIAL_PRESUPUESTO_FACTURA: EstadoModuloPresupuestoFactura = {
  encabezado: ENCABEZADO_INICIAL,
  tasasReembolso: ITEMS_TASAS_REEMBOLSO_BASE,
  serviciosHonorarios: ITEMS_SERVICIOS_HONORARIOS_BASE,
  observacionesGenerales: 'Validez del presupuesto: 30 días a partir de la fecha de emisión. Los montos de tasas judiciales y registros quedan sujetos a variaciones arancelarias oficiales.',
};

/**
 * Función utilitaria de cálculo de totales y liquidación de IVA
 */
export function calcularLiquidacionPresupuesto(
  tasas: ItemTasaReembolso[],
  servicios: ItemServicioHonorario[]
): LiquidacionPresupuestoFactura {
  // 1. Reembolsos de tasas activas
  const subtotalTasasReembolso = tasas
    .filter((t) => t.activo)
    .reduce((sum, t) => sum + (Number(t.monto) || 0), 0);

  // 2. Servicios y Honorarios activos
  let subtotalServiciosExentas = 0;
  let subtotalServicios5 = 0;
  let subtotalServicios10 = 0;

  servicios.forEach((item) => {
    if (!item.activo) return;
    const subtotalItem = (Number(item.cantidad) || 1) * (Number(item.precioUnitario) || 0);
    if (item.tipoIva === 'exenta') {
      subtotalServiciosExentas += subtotalItem;
    } else if (item.tipoIva === '5') {
      subtotalServicios5 += subtotalItem;
    } else {
      subtotalServicios10 += subtotalItem;
    }
  });

  const totalVentaServicios = subtotalServiciosExentas + subtotalServicios5 + subtotalServicios10;
  
  // Cálculo de liquidación de IVA según régimen paraguayo (precio con IVA incluido)
  const iva5 = Math.round(subtotalServicios5 / 21);
  const iva10 = Math.round(subtotalServicios10 / 11);
  const totalIvaLiquidado = iva5 + iva10;
  const totalGeneralOperacion = subtotalTasasReembolso + totalVentaServicios;

  return {
    subtotalTasasReembolso,
    subtotalServiciosExentas,
    subtotalServicios5,
    subtotalServicios10,
    totalVentaServicios,
    iva5,
    iva10,
    totalIvaLiquidado,
    totalGeneralOperacion,
    totalLetras: '', // Calculable mediante convertidor numérico
  };
}
