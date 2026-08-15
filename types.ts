export type TipoPersona = 'física' | 'jurídica';
export type TipoDocumento = 'CI' | 'RUC';
export type TipoNegociacion = 'entrega_refuerzo_cuota' | 'cuotas_corridas' | 'cuotas_refuerzos' | 'entrega_cuotas';
export type TipoCronogramaItem = 'cuota' | 'refuerzo';

export interface Persona {
  id: string;
  tipo_persona: TipoPersona;
  nombre: string;
  apellido?: string; // Solo personas físicas
  tipo_documento: TipoDocumento;
  nro_documento: string; // Debe ser único en el sistema
  telefono: string;
  email: string;
  domicilio: string;
  representante_id?: string; // ID de otra persona (física) que actúa como representante legal
  userId?: string;
}

export interface PaymentScheduleItem {
  id: string;
  pagare_id: string;
  tipo: TipoCronogramaItem;
  fecha_pag: string; // YYYY-MM-DD
  monto: number;
  numero_cuota: string; // e.g. "1", "2", "R1", "R2"
  estado?: 'cobrado' | 'pendiente';
  pagado?: boolean;
  fecha_cobro?: string;
}

export interface Pagare {
  status?: string;
  anuladoAt?: string;
  id: string;
  correlativo: number; // Auto Incremental
  certificado_firmas_nro: string; // 9 digitos
  tipo_negociacion: TipoNegociacion;
  moneda: string; // Código de moneda p.ej. PYG, USD
  valor_total: number;
  frecuencia_id: string;
  fecha_primer_pago: string; // YYYY-MM-DD

  // Entrega inicial (solo si tipo_negociacion incluye entrega)
  entrega_inicial: number;
  fecha_entrega_inicial: string; // YYYY-MM-DD
  concepto_entrega_inicial: string;

  // Personas involucradas
  acreedor_id?: string;
  acreedor_nombre_raw?: string;
  acreedor_documento_raw?: string;
  acreedor_domicilio_raw?: string;
  
  deudor_id?: string;
  deudor_nombre_raw?: string;
  deudor_documento_raw?: string;
  deudor_domicilio_raw?: string;

  codeudor1_id?: string;
  codeudor2_id?: string;

  // Cronograma de pagos
  cronograma: PaymentScheduleItem[];

  // Estado
  estado?: 'Pendiente' | 'Cobrado' | 'Vencido' | 'Anulado';

  // Metadatos
  created_at: string;
  userId?: string;
  creator_role: 'admin' | 'usuario';
}

export interface KnowledgeDoc {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  content: string;
  storageUrl?: string; // Firebase storage download URL
  userId?: string;
}

export interface EscribaniaConfig {
  nombre: string;
  nro_registro: string; // Matrícula o identificador oficial
  direccion: string;
  localidad: string;
  telefono: string;
  email: string;
  sitio_web?: string;
  logoUrl?: string; // Opcional, data URI o link
}

export interface MonedaConfig {
  codigo: string; // p.ej. PYG
  nombre: string; // Guaraníes
  simbolo: string; // Gs.
  activa: boolean;
  orden: number;
}

export interface FrecuenciaConfig {
  id: string;
  nombre: string; // Mensual, Semanal, etc.
  intervalo_dias: number; // 30, 7, etc.
  descripcion: string; // Ayuda contextual
  activa: boolean;
  orden: number;
}

export interface PDFConfig {
  mostrar_pie: boolean;
  contenido_pie: string;
}

export interface GlobalConfig {
  escribania: EscribaniaConfig;
  monedas: MonedaConfig[];
  frecuencias: FrecuenciaConfig[];
  anio_serie: number;
  pdf: PDFConfig;
}

export function formatCurrencyValue(value: number | string | undefined | null, moneda: string = 'PYG'): string {
  if (value === undefined || value === null) return '0';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '0';

  if (moneda === 'PYG') {
    return new Intl.NumberFormat('es-PY', { minimumFractionDigits: 0 }).format(numValue);
  } else if (moneda === 'BRL') {
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numValue);
  } else {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numValue);
  }
}
