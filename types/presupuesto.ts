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
  ciudad?: string;                 // Ciudad de la sede notarial
  telefono: string;                // Teléfono de contacto
  email: string;                   // Correo electrónico institucional
  ruc: string;                     // RUC de la escribanía / notario
  timbradoNumero: string;          // Nº de Timbrado SET/DNIT
  timbradoVigenciaInicio: string;  // Inicio de Vigencia (YYYY-MM-DD)
  timbradoVigenciaFin: string;     // Fin de Vigencia (YYYY-MM-DD)
  logoUrl?: string | null;         // Logo o insignia notarial
  membreteConfigurado?: boolean;   // Indica si el usuario guardó explícitamente su membrete
}

export const MEMBRETE_DEFAULT: MembreteEscribaniaConfig = {
  nombreNotario: '',
  registroNotarial: '',
  nombreEscribania: '',
  direccion: '',
  ciudad: '',
  telefono: '',
  email: '',
  ruc: '',
  timbradoNumero: '',
  timbradoVigenciaInicio: '',
  timbradoVigenciaFin: '',
  logoUrl: null,
  membreteConfigurado: false,
};

const VALORES_EJEMPLO_LEGACY = new Set([
  'Esc. Sandra Molinas',
  'Sandra Molinas',
  'Reg. Nº 1.292',
  '1292',
  'Reg. 1292',
  'Registro Notarial N° 742 - Asunción',
  'Escribanía Notarial Sandra Molinas & Asociados',
  'Escribanía Pública Molinas & Asociados',
  'Escribanía Molinas',
  'Escribanía Notarial Titular',
  'Escribanía Notarial',
  'Escribanía Pública',
  'Escribanía Titular',
  'Mi Escribanía',
  'Avda. Carlos Antonio López 450 c/ Colón, Asunción',
  'Avda. Carlos Antonio López 450, Asunción',
  'Avda. Carlos Antonio López 450',
  'Asunción, República del Paraguay',
  '+595 21 445 000 / +595 981 123 456',
  '+595 21 445 000',
  '+595 21 000-000',
  '+595 981 123 456',
  'contacto@escribaniamolinas.com.py',
  'notaria@olgatech.com.py',
  '80012345-6',
  '80012345',
  '80098765-4',
  '80098765',
  '16894321',
  '2026-01-01',
  '2026-12-31',
]);

export const limpiarValorEjemplo = (val?: string | null): string => {
  if (!val) return '';
  const trimmed = String(val).trim();
  return VALORES_EJEMPLO_LEGACY.has(trimmed) ? '' : trimmed;
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
      if (!parsed.membreteConfigurado) {
        return MEMBRETE_DEFAULT;
      }
      return {
        ...MEMBRETE_DEFAULT,
        ...parsed,
        nombreNotario: limpiarValorEjemplo(parsed.nombreNotario),
        registroNotarial: limpiarValorEjemplo(parsed.registroNotarial),
        nombreEscribania: limpiarValorEjemplo(parsed.nombreEscribania),
        direccion: limpiarValorEjemplo(parsed.direccion),
        ciudad: limpiarValorEjemplo(parsed.ciudad),
        telefono: limpiarValorEjemplo(parsed.telefono),
        email: limpiarValorEjemplo(parsed.email),
        ruc: limpiarValorEjemplo(parsed.ruc),
        timbradoNumero: limpiarValorEjemplo(parsed.timbradoNumero),
        timbradoVigenciaInicio: limpiarValorEjemplo(parsed.timbradoVigenciaInicio),
        timbradoVigenciaFin: limpiarValorEjemplo(parsed.timbradoVigenciaFin),
        membreteConfigurado: true,
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

export type CategoriaServicioNotarial = 'honorario' | 'gasto';
export type TipoDescuentoHonorarios = 'porcentaje' | 'monto';

export interface ConfigDescuentoHonorarios {
  tipo: TipoDescuentoHonorarios;
  valor: number;
}

/**
 * 3. ESTRUCTURA PARA VENTAS, SERVICIOS Y HONORARIOS PROFESIONALES
 * Servicios arancelarios y gestiones propias de la escribanía con desglose impositivo.
 */
export interface ItemServicioHonorario {
  id: string;
  codigoConcepto?: string;           // Código de referencia (ej: 'HON-ESC', 'CERT-DOM')
  categoriaServicio?: CategoriaServicioNotarial; // 'honorario' (descontable) vs 'gasto' (no descontable)
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
  subtotalHonorariosBruto: number;
  descuentoAplicado: number;
  honorariosNetos: number;
  subtotalGastosMaterialesServicios: number;
  subtotalGastosMaterialesTasas: number;
  iva5: number;
  iva10: number;
  totalIvaLiquidado: number;
  totalGeneralOperacion: number;     // Reembolsos + Servicios Netos (incluye IVA)
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
// CONSTANTES OFICIALES DE REFERENCIA 2026 — ESCRIBANÍA (PARAGUAY)
// ============================================================================

/** Jornal Mínimo 2026 (Decreto P.E. N.º 6225/2026) */
export const JORNAL_MINIMO_2026 = 117077;

/** Ley 1307/87 — Base de cálculo sobre Jornal Mínimo 2026 */
export const LEY_1307_87_VALORES_2026 = {
  gastosAdminCapital: JORNAL_MINIMO_2026 * 5,  // 585.385 Gs. (5 jornales)
  gastosAdminInterior: JORNAL_MINIMO_2026 * 6, // 702.462 Gs. (6 jornales)
  certificacionFirma: JORNAL_MINIMO_2026 * 3,  // 351.231 Gs. (3 jornales)
  tramiteInscripcion: JORNAL_MINIMO_2026 * 2,  // 234.154 Gs. (2 jornales)
} as const;

/** Registro Unificado Nacional (RUN — Ley N.º 7424/2025 y Guía SIJ Oct/2026) */
export const TASA_INSCRIPCION_RUN_ALICUOTA = 0.0085; // 0,85% sobre max(operación, valor fiscal)

/** Materiales Notariales CSJ (Res. CSJ 381/2026) */
export const MATERIALES_NOTARIALES_CSJ_2026 = {
  hojaProtocoloUnitario: 2100,
  hojaProtocoloCuadernillo10: 21000,
  hojaSeguridadUnitario: 3900,
  hojaSeguridadCuadernillo10: 39000,
  libroRegistroFirmas: 70000,
} as const;

/**
 * Clasifica si un ítem de Sección 2 corresponde a Honorarios Profesionales (sujeto a descuento)
 * o a Gastos Administrativos / Materiales / Tasas (nunca descontable).
 */
export const esItemHonorarioProfesional = (item: ItemServicioHonorario): boolean => {
  if (item.categoriaServicio === 'honorario') return true;
  if (item.categoriaServicio === 'gasto') return false;

  const id = String(item.id || '').toLowerCase();
  const cod = String(item.codigoConcepto || '').toUpperCase();
  const desc = String(item.descripcion || '').toLowerCase();

  if (
    id === 'srv-honorarios-prof' ||
    id === 'srv-cert-firmas' ||
    cod === 'HON-PROF' ||
    cod === 'HON-CERT' ||
    cod === 'HON-IA'
  ) {
    return true;
  }

  if (
    id.startsWith('srv-gastos') ||
    id.startsWith('srv-mat-') ||
    id.startsWith('srv-cert-dom') ||
    id.startsWith('srv-cert-anot') ||
    id.startsWith('srv-cert-vig') ||
    id.startsWith('srv-fiscalizacion') ||
    id.startsWith('srv-catastral') ||
    id.startsWith('srv-registro') ||
    id.startsWith('srv-inscripcion') ||
    id.startsWith('srv-gestion') ||
    id.startsWith('srv-ande') ||
    id.startsWith('srv-expedicion') ||
    cod.startsWith('GAST') ||
    cod.startsWith('MAT-') ||
    cod.startsWith('RUN-') ||
    cod.startsWith('SNC') ||
    cod.startsWith('DGRP') ||
    cod.startsWith('INSC') ||
    cod.startsWith('CERT-') ||
    cod.startsWith('GEST') ||
    cod.startsWith('SERV-PUB') ||
    cod.startsWith('EXP-')
  ) {
    return false;
  }

  if (
    desc.includes('gasto') ||
    desc.includes('hoja de protocolo') ||
    desc.includes('hoja de seguridad') ||
    desc.includes('libro de registro') ||
    desc.includes('sellado notarial') ||
    desc.includes('formulario') ||
    desc.includes('fiscalización') ||
    desc.includes('fiscalizacion') ||
    desc.includes('trámite de inscripción') ||
    desc.includes('tramite de inscripcion') ||
    desc.includes('certificado único') ||
    desc.includes('certificado unico') ||
    desc.includes('certificado catastral') ||
    desc.includes('certificado de') ||
    desc.includes('diligenciamiento') ||
    desc.includes('tasa ') ||
    desc.includes('tasas ') ||
    desc.includes('impuesto') ||
    desc.includes('constancia') ||
    desc.includes('expedición') ||
    desc.includes('expedicion')
  ) {
    return false;
  }

  if (desc.includes('honorario') || desc.includes('certificación de firma') || desc.includes('certificacion de firma')) {
    return true;
  }

  return false;
};

/**
 * Calcula el siguiente número correlativo PRES-XXXX a partir de presupuestos guardados.
 */
export const calcularSiguienteNumeroPresupuesto = (
  presupuestos: Array<{ numeroComprobante?: string | null }>
): string => {
  let maxNum = 0;
  if (Array.isArray(presupuestos)) {
    presupuestos.forEach((p) => {
      const raw = String(p?.numeroComprobante || '').trim();
      const match = /^PRES-(\d+)$/i.exec(raw);
      if (match) {
        const parsed = parseInt(match[1], 10);
        if (Number.isFinite(parsed) && parsed > maxNum) {
          maxNum = parsed;
        }
      }
    });
  }
  return `PRES-${String(maxNum + 1).padStart(4, '0')}`;
};

// ============================================================================
// VALORES INICIALES POR DEFECTO PARA ESCRIBANÍA (PARAGUAY 2026)
// ============================================================================

export const ITEMS_TASAS_REEMBOLSO_BASE: ItemTasaReembolso[] = [
  {
    id: 'tasa-jud-venta',
    categoria: 'judicial',
    descripcion: 'Tasas Judiciales de Venta',
    monto: 0,
    tipoIva: 'exenta',
    activo: false,
  },
  {
    id: 'tasa-jud-prenda',
    categoria: 'hipoteca',
    descripcion: 'Tasas Judiciales de Prenda',
    monto: 0,
    tipoIva: 'exenta',
    activo: false,
  },
  {
    id: 'tasa-jud-hipoteca',
    categoria: 'hipoteca',
    descripcion: 'Tasas Judiciales de Hipoteca',
    monto: 0,
    tipoIva: 'exenta',
    activo: false,
  },
  {
    id: 'tasa-imp-asuncion',
    categoria: 'municipal',
    descripcion: 'Tasas Impuesto a la Transferencia (Mun. Asunción)',
    monto: 0,
    tipoIva: 'exenta',
    activo: false,
  },
  {
    id: 'tasa-imp-opaci',
    categoria: 'municipal',
    descripcion: 'Tasas Impuesto a la Transferencia (OPACI)',
    monto: 0,
    tipoIva: 'exenta',
    activo: false,
  },
  {
    id: 'tasa-aut-roggio',
    categoria: 'automotor',
    descripcion: 'Tasas de Registro del Automotor - Roggio',
    monto: 0,
    tipoIva: 'exenta',
    activo: false,
  },
  {
    id: 'tasa-especiales',
    categoria: 'especial',
    descripcion: 'Tasas Especiales',
    monto: 0,
    tipoIva: 'exenta',
    activo: false,
  },
];

export const ITEMS_SERVICIOS_HONORARIOS_BASE: ItemServicioHonorario[] = [
  {
    id: 'srv-honorarios-prof',
    codigoConcepto: 'HON-PROF',
    categoriaServicio: 'honorario',
    descripcion: 'Honorarios Profesionales del Notario Público (Arancel Ley 879/81)',
    cantidad: 1,
    precioUnitario: 0,
    tipoIva: '10',
    montoExento: 0,
    montoIva5: 0,
    montoIva10: 0,
    total: 0,
    activo: false,
  },
  {
    id: 'srv-cert-firmas',
    codigoConcepto: 'HON-CERT',
    categoriaServicio: 'honorario',
    descripcion: 'Certificación de firma (Ley 1307/87 - 3 jornales 2026)',
    cantidad: 1,
    precioUnitario: LEY_1307_87_VALORES_2026.certificacionFirma,
    tipoIva: '10',
    montoExento: 0,
    montoIva5: 0,
    montoIva10: LEY_1307_87_VALORES_2026.certificacionFirma,
    total: LEY_1307_87_VALORES_2026.certificacionFirma,
    activo: false,
  },
  {
    id: 'srv-gastos-adm',
    codigoConcepto: 'GAST-ADM',
    categoriaServicio: 'gasto',
    descripcion: 'Gastos Administrativos',
    cantidad: 1,
    precioUnitario: 0,
    tipoIva: '10',
    montoExento: 0,
    montoIva5: 0,
    montoIva10: 0,
    total: 0,
    activo: false,
  },
  {
    id: 'srv-cert-catastral',
    codigoConcepto: 'CERT-CAT',
    categoriaServicio: 'gasto',
    descripcion: 'Certificado Catastral-Registral',
    cantidad: 1,
    precioUnitario: 0,
    tipoIva: '10',
    montoExento: 0,
    montoIva5: 0,
    montoIva10: 0,
    total: 0,
    activo: false,
  },
  {
    id: 'srv-cert-anotaciones',
    codigoConcepto: 'CERT-ANOT',
    categoriaServicio: 'gasto',
    descripcion: 'Certificado de Anotaciones Personales - Interdicción',
    cantidad: 1,
    precioUnitario: 0,
    tipoIva: '10',
    montoExento: 0,
    montoIva5: 0,
    montoIva10: 0,
    total: 0,
    activo: false,
  },
  {
    id: 'srv-cert-vigencia',
    codigoConcepto: 'CERT-VIG',
    categoriaServicio: 'gasto',
    descripcion: 'Certificado de Vigencia (Poder / Capitulación / SD / AI)',
    cantidad: 1,
    precioUnitario: 0,
    tipoIva: '10',
    montoExento: 0,
    montoIva5: 0,
    montoIva10: 0,
    total: 0,
    activo: false,
  },
  {
    id: 'srv-cert-municipal',
    codigoConcepto: 'CERT-MUN',
    categoriaServicio: 'gasto',
    descripcion: 'Certificado Municipal (Asunción)',
    cantidad: 1,
    precioUnitario: 0,
    tipoIva: '10',
    montoExento: 0,
    montoIva5: 0,
    montoIva10: 0,
    total: 0,
    activo: false,
  },
  {
    id: 'srv-ande-essap',
    codigoConcepto: 'SERV-PUB',
    categoriaServicio: 'gasto',
    descripcion: 'Certificado ANDE / ESSAP (Asunción)',
    cantidad: 1,
    precioUnitario: 0,
    tipoIva: '10',
    montoExento: 0,
    montoIva5: 0,
    montoIva10: 0,
    total: 0,
    activo: false,
  },
  {
    id: 'srv-expedicion-copias',
    codigoConcepto: 'EXP-COP',
    categoriaServicio: 'gasto',
    descripcion: 'Expedición de Copia',
    cantidad: 1,
    precioUnitario: 0,
    tipoIva: '10',
    montoExento: 0,
    montoIva5: 0,
    montoIva10: 0,
    total: 0,
    activo: false,
  },
  {
    id: 'srv-inscripcion-tasa',
    codigoConcepto: 'INSC-REG',
    categoriaServicio: 'gasto',
    descripcion: 'Inscripción',
    cantidad: 1,
    precioUnitario: 0,
    tipoIva: '10',
    montoExento: 0,
    montoIva5: 0,
    montoIva10: 0,
    total: 0,
    activo: false,
  },
];

// ============================================================================
// VALORES INICIALES POR DEFECTO PARA ABOGADOS / ESTUDIOS JURÍDICOS (PARAGUAY)
// ============================================================================

export const ITEMS_TASAS_ABOGADO_BASE: ItemTasaReembolso[] = [
  {
    id: 'tasa-abog-csj',
    categoria: 'judicial',
    descripcion: 'Tasas Judiciales CSJ',
    monto: 0,
    tipoIva: 'exenta',
    activo: false,
  },
  {
    id: 'tasa-abog-notif',
    categoria: 'judicial',
    descripcion: 'Gastos de Notificación y Diligenciamiento',
    monto: 0,
    tipoIva: 'exenta',
    activo: false,
  },
  {
    id: 'tasa-abog-reg',
    categoria: 'especial',
    descripcion: 'Informes / Certificados Registrales y Anotaciones (DGRP)',
    monto: 0,
    tipoIva: 'exenta',
    activo: false,
  },
  {
    id: 'tasa-abog-otro',
    categoria: 'otro',
    descripcion: 'Otras Tasas Judiciales o Gastos Oficiales de Causa',
    monto: 0,
    tipoIva: 'exenta',
    activo: false,
  },
];

export const ITEMS_SERVICIOS_ABOGADO_BASE: ItemServicioHonorario[] = [
  {
    id: 'srv-abog-hon',
    codigoConcepto: 'HON-PROF',
    descripcion: 'Honorarios Profesionales',
    cantidad: 1,
    precioUnitario: 0,
    tipoIva: '10',
    montoExento: 0,
    montoIva5: 0,
    montoIva10: 0,
    total: 0,
    activo: false,
  },
  {
    id: 'srv-abog-patrocinio',
    codigoConcepto: 'PAT-JUD',
    descripcion: 'Patrocinio / Representación Procesal',
    cantidad: 1,
    precioUnitario: 0,
    tipoIva: '10',
    montoExento: 0,
    montoIva5: 0,
    montoIva10: 0,
    total: 0,
    activo: false,
  },
  {
    id: 'srv-abog-escritos',
    codigoConcepto: 'RED-ESC',
    descripcion: 'Redacción de Escritos/Contratos',
    cantidad: 1,
    precioUnitario: 0,
    tipoIva: '10',
    montoExento: 0,
    montoIva5: 0,
    montoIva10: 0,
    total: 0,
    activo: false,
  },
  {
    id: 'srv-abog-consulta',
    codigoConcepto: 'CONS-JUR',
    descripcion: 'Consulta Jurídica y Estudio de Antecedentes',
    cantidad: 1,
    precioUnitario: 0,
    tipoIva: '10',
    montoExento: 0,
    montoIva5: 0,
    montoIva10: 0,
    total: 0,
    activo: false,
  },
  {
    id: 'srv-abog-audiencias',
    codigoConcepto: 'AUD-PROC',
    descripcion: 'Asistencia a Audiencias y Diligencias Judiciales',
    cantidad: 1,
    precioUnitario: 0,
    tipoIva: '10',
    montoExento: 0,
    montoIva5: 0,
    montoIva10: 0,
    total: 0,
    activo: false,
  },
];

export const ENCABEZADO_INICIAL: EncabezadoFacturaPresupuesto = {
  tipoComprobante: 'Presupuesto',
  numeroComprobante: 'PRES-0001',
  timbrado: '',
  fechaEmision: new Date().toISOString().slice(0, 10),
  fechaVencimientoValidez: '',
  condicionVenta: 'Contado',
  clienteNombre: '',
  clienteRucCI: '',
  clienteTelefono: '',
  clienteDireccion: '',
  clienteEmail: '',
  conceptoGeneral: '',
  localidad: 'Asunción',
};

export const ESTADO_INICIAL_PRESUPUESTO_FACTURA: EstadoModuloPresupuestoFactura = {
  encabezado: ENCABEZADO_INICIAL,
  tasasReembolso: ITEMS_TASAS_REEMBOLSO_BASE,
  serviciosHonorarios: ITEMS_SERVICIOS_HONORARIOS_BASE,
  observacionesGenerales: 'Validez del presupuesto: 30 días a partir de la fecha de emisión. Los montos de tasas judiciales y registros quedan sujetos a variaciones arancelarias oficiales.',
};

/**
 * Función utilitaria de cálculo de totales y liquidación de IVA.
 * El parámetro opcional `descuentoHonorarios` aplica EXCLUSIVAMENTE sobre ítems de Honorarios Profesionales.
 */
export function calcularLiquidacionPresupuesto(
  tasas: ItemTasaReembolso[],
  servicios: ItemServicioHonorario[],
  descuentoHonorarios?: ConfigDescuentoHonorarios
): LiquidacionPresupuestoFactura {
  // 1. Reembolsos de tasas activas (nunca reciben descuento)
  const subtotalTasasReembolso = tasas
    .filter((t) => t.activo)
    .reduce((sum, t) => sum + (Number(t.monto) || 0), 0);

  // 2. Separación estricta entre Honorarios Profesionales y Gastos/Materiales
  let honorariosExentas = 0;
  let honorarios5 = 0;
  let honorarios10 = 0;

  let gastosExentas = 0;
  let gastos5 = 0;
  let gastos10 = 0;

  servicios.forEach((item) => {
    if (!item.activo) return;
    const subtotalItem = (Number(item.cantidad) || 1) * (Number(item.precioUnitario) || 0);
    const esHon = esItemHonorarioProfesional(item);

    if (item.tipoIva === 'exenta') {
      if (esHon) honorariosExentas += subtotalItem;
      else gastosExentas += subtotalItem;
    } else if (item.tipoIva === '5') {
      if (esHon) honorarios5 += subtotalItem;
      else gastos5 += subtotalItem;
    } else {
      if (esHon) honorarios10 += subtotalItem;
      else gastos10 += subtotalItem;
    }
  });

  const subtotalHonorariosBruto = honorariosExentas + honorarios5 + honorarios10;
  const subtotalGastosMaterialesServicios = gastosExentas + gastos5 + gastos10;

  let descuentoAplicado = 0;
  if (descuentoHonorarios && Number(descuentoHonorarios.valor) > 0 && subtotalHonorariosBruto > 0) {
    const val = Number(descuentoHonorarios.valor) || 0;
    if (descuentoHonorarios.tipo === 'porcentaje') {
      const pct = Math.min(100, Math.max(0, val));
      descuentoAplicado = Math.round((subtotalHonorariosBruto * pct) / 100);
    } else {
      descuentoAplicado = Math.min(subtotalHonorariosBruto, Math.max(0, Math.round(val)));
    }
  }

  const honorariosNetos = Math.max(0, subtotalHonorariosBruto - descuentoAplicado);

  let honorariosExentasNeto = honorariosExentas;
  let honorarios5Neto = honorarios5;
  let honorarios10Neto = honorarios10;

  if (descuentoAplicado > 0 && subtotalHonorariosBruto > 0) {
    const factorNeto = honorariosNetos / subtotalHonorariosBruto;
    honorariosExentasNeto = Math.round(honorariosExentas * factorNeto);
    honorarios5Neto = Math.round(honorarios5 * factorNeto);
    honorarios10Neto = Math.max(0, honorariosNetos - honorariosExentasNeto - honorarios5Neto);
  }

  const subtotalServiciosExentas = gastosExentas + honorariosExentasNeto;
  const subtotalServicios5 = gastos5 + honorarios5Neto;
  const subtotalServicios10 = gastos10 + honorarios10Neto;

  const totalVentaServicios = honorariosNetos + subtotalGastosMaterialesServicios;
  const subtotalGastosMaterialesTasas = subtotalTasasReembolso + subtotalGastosMaterialesServicios;

  // Cálculo de liquidación de IVA según régimen paraguayo (precio con IVA incluido)
  const iva5 = Math.round(subtotalServicios5 / 21);
  const iva10 = Math.round(subtotalServicios10 / 11);
  const totalIvaLiquidado = iva5 + iva10;
  const totalGeneralOperacion = honorariosNetos + subtotalGastosMaterialesServicios + subtotalTasasReembolso;

  return {
    subtotalTasasReembolso,
    subtotalServiciosExentas,
    subtotalServicios5,
    subtotalServicios10,
    totalVentaServicios,
    subtotalHonorariosBruto,
    descuentoAplicado,
    honorariosNetos,
    subtotalGastosMaterialesServicios,
    subtotalGastosMaterialesTasas,
    iva5,
    iva10,
    totalIvaLiquidado,
    totalGeneralOperacion,
    totalLetras: '', // Calculable mediante convertidor numérico
  };
}

/**
 * Plantilla Personalizada de Tarifas, Honorarios y Tasas Guardada por el Usuario
 */
export interface PlantillaPresupuesto {
  id: string;
  userId: string;
  nombre: string;
  descripcion?: string;
  tasas: ItemTasaReembolso[];
  servicios: ItemServicioHonorario[];
  observaciones?: string;
  montoEstimadoTotal?: number;
  creadoEn?: string;
}
