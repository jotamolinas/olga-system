import { Persona, Pagare, TipoPersona, TipoDocumento } from '../types';
import { formatearRUCConDV } from './dnitService';
import { buscarPersonaDuplicada, extraerDocBase, sonMismaPersona } from './personaDedup';

export const PERSONAS_STORAGE_KEY = 'olga_directorio_personas';
export const PAGARES_STORAGE_KEY = 'olga_pagares';

/**
 * Normaliza un documento quitando puntos, espacios y guiones para comparaciones precisas.
 */
export function normalizarDoc(docStr?: string): string {
  if (!docStr) return '';
  return docStr.replace(/[^\w]/g, '').trim().toUpperCase();
}

/**
 * Obtiene la lista actual de personas guardadas en localStorage.
 */
export function getPersonasFromStorage(): Persona[] {
  try {
    const raw = localStorage.getItem(PERSONAS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Error leyendo personas desde localStorage:', err);
  }
  return [];
}

/**
 * Guarda la lista de personas en localStorage y emite evento global de sincronización.
 */
export function savePersonasToStorage(personas: Persona[]): void {
  try {
    localStorage.setItem(PERSONAS_STORAGE_KEY, JSON.stringify(personas));
    // Notificar a otras pestañas/componentes suscritos
    window.dispatchEvent(new CustomEvent('olga_personas_updated', { detail: personas }));
  } catch (err) {
    console.error('Error guardando personas en localStorage:', err);
  }
}

/**
 * Obtiene la lista actual de pagarés guardados en localStorage.
 */
export function getPagaresFromStorage(): Pagare[] {
  try {
    const raw = localStorage.getItem(PAGARES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Error leyendo pagarés desde localStorage:', err);
  }
  return [];
}

/**
 * Guarda la lista de pagarés en localStorage y emite evento global de sincronización.
 */
export function savePagaresToStorage(pagares: Pagare[]): void {
  try {
    localStorage.setItem(PAGARES_STORAGE_KEY, JSON.stringify(pagares));
    window.dispatchEvent(new CustomEvent('olga_pagares_updated', { detail: pagares }));
  } catch (err) {
    console.error('Error guardando pagarés en localStorage:', err);
  }
}

/**
 * Revisa si existe una persona por ID, documento (CI o RUC con/sin DV) o por identidad de nombre.
 */
export function findPersonaPorDocOId(
  personas: Persona[],
  id?: string,
  docStr?: string,
  nombreStr?: string
): Persona | undefined {
  if (!Array.isArray(personas) || personas.length === 0) return undefined;

  if (id) {
    const porId = personas.find(p => p.id === id);
    if (porId) return porId;
  }

  return buscarPersonaDuplicada(
    {
      nro_documento: docStr,
      nombre: nombreStr
    },
    personas
  );
}

export interface FirmanteInput {
  nombre: string;
  documento: string;
  domicilio?: string;
  origen?: 'MANUAL' | 'DNIT';
  rol: 'acreedor' | 'deudor' | 'codeudor';
}

/**
 * Auto-registra o encuentra una persona a partir de los datos ingresados en el formulario del pagaré.
 * Retorna la persona (existente o recién creada).
 */
export function sincronizarOAutoRegistrarPersona(
  firmante: FirmanteInput,
  personasActuales: Persona[],
  onPersonaCreada?: (nuevaPersona: Persona) => void
): { persona: Persona; esNueva: boolean } {
  const docLimpio = (firmante.documento || '').trim();
  const nombreLimpio = (firmante.nombre || '').trim();

  // Buscar coincidencia por documento normalizado, base o nombre
  const existente = findPersonaPorDocOId(personasActuales, undefined, docLimpio, nombreLimpio);
  if (existente) {
    // Si ya existe pero no tenía domicilio y ahora lo tenemos, actualizar no destructivamente
    if (firmante.domicilio && !existente.domicilio) {
      existente.domicilio = firmante.domicilio.trim();
      savePersonasToStorage(personasActuales);
    }
    return { persona: existente, esNueva: false };
  }

  // Determinar si es persona jurídica o física según normativa paraguaya:
  // En Paraguay, las personas jurídicas poseen RUC que inicia con el prefijo '800'
  const rucLimpio = docLimpio.replace(/\D/g, '');
  const tieneGuion = docLimpio.includes('-');
  const esJuridica = rucLimpio.startsWith('800') || /(S\.?A\.?|S\.?R\.?L\.?|S\.?A\.?E\.?C\.?A\.?|EMPRESA|GRUPO|CONSTRUCTORA|IMPORTADORA)/i.test(nombreLimpio);
  const tipoPersona: TipoPersona = esJuridica ? 'jurídica' : 'física';
  const tipoDocumento: TipoDocumento = (tieneGuion || esJuridica) ? 'RUC' : 'CI';

  // Si es persona física, intentar separar nombre y apellido
  let nombreParte = nombreLimpio;
  let apellidoParte: string | undefined = undefined;

  if (tipoPersona === 'física') {
    const partes = nombreLimpio.split(/\s+/);
    if (partes.length > 2) {
      nombreParte = partes.slice(0, 2).join(' ');
      apellidoParte = partes.slice(2).join(' ');
    } else if (partes.length === 2) {
      nombreParte = partes[0];
      apellidoParte = partes[1];
    }
  }

  const docConDv = formatearRUCConDV(docLimpio) || docLimpio;

  const nuevaPersona: Persona = {
    id: `p-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    tipo_persona: tipoPersona,
    nombre: nombreParte,
    apellido: apellidoParte,
    tipo_documento: tipoDocumento,
    nro_documento: docConDv,
    domicilio: (firmante.domicilio || '').trim(),
    telefono: '',
    email: '',
    representante_id: undefined,
    representanteLegal: tipoPersona === 'física' ? 'No aplica' : 'Sin Asignar',
    responsable: null,
    origen: firmante.origen || (tipoDocumento === 'RUC' ? 'DNIT' : 'MANUAL'),
    notas_notariales: `Auto-registrado desde Gestión de Pagarés (${firmante.rol.toUpperCase()}) el ${new Date().toLocaleDateString('es-PY')}.`
  };

  // Verificación estricta final de unicidad registral
  const duplicadoFinal = buscarPersonaDuplicada(nuevaPersona, personasActuales);
  if (duplicadoFinal) {
    return { persona: duplicadoFinal, esNueva: false };
  }

  personasActuales.push(nuevaPersona);
  savePersonasToStorage(personasActuales);

  if (onPersonaCreada) {
    onPersonaCreada(nuevaPersona);
  }

  return { persona: nuevaPersona, esNueva: true };
}

export interface SincronizacionResultado {
  agregadas: Persona[];
  yaExistentes: Persona[];
  nombresSincronizados: string[];
  mensaje: string;
  pagareActualizado?: Pagare;
}

/**
 * Formatea nombres en una lista legible en español: 'Ana María y Josefina' o 'A, B y C'.
 */
function formatearListaNombres(nombres: string[]): string {
  const unicos = Array.from(new Set(nombres.filter(Boolean)));
  if (unicos.length === 0) return 'Firmantes';
  if (unicos.length === 1) return unicos[0];
  if (unicos.length === 2) return `${unicos[0]} y ${unicos[1]}`;
  return `${unicos.slice(0, -1).join(', ')} y ${unicos[unicos.length - 1]}`;
}

/**
 * Sincroniza retroactivamente los firmantes de un pagaré específico:
 * Revisa Acreedor, Deudor Principal y Codeudores.
 * Si no existen en el Fichero de Personas (localStorage), los auto-registra.
 * Vincula sus IDs en el pagaré para el Expediente 360°.
 */
export function sincronizarFirmantesDePagare(
  pagare: Pagare,
  personasActuales: Persona[],
  onPersonaCreada?: (nuevaPersona: Persona) => void
): SincronizacionResultado {
  const agregadas: Persona[] = [];
  const yaExistentes: Persona[] = [];
  const nombresSincronizados: string[] = [];

  let acreedorIdFinal = pagare.acreedor_id;
  let deudorIdFinal = pagare.deudor_id;

  // 1. Acreedor
  const acreedorDoc = (pagare.acreedor_documento_raw || '').trim();
  const acreedorNombre = (pagare.acreedor_nombre_raw || '').trim();
  if (acreedorDoc || acreedorNombre) {
    const res = sincronizarOAutoRegistrarPersona(
      {
        nombre: acreedorNombre || 'Acreedor Registrado',
        documento: acreedorDoc || `DOC-ACR-${pagare.correlativo}`,
        domicilio: pagare.acreedor_domicilio_raw,
        origen: pagare.acreedor_origen || 'MANUAL',
        rol: 'acreedor'
      },
      personasActuales,
      onPersonaCreada
    );
    acreedorIdFinal = res.persona.id;
    const nombreCompleto = `${res.persona.nombre} ${res.persona.apellido || ''}`.trim();
    nombresSincronizados.push(nombreCompleto);
    if (res.esNueva) {
      agregadas.push(res.persona);
    } else {
      yaExistentes.push(res.persona);
    }
  }

  // 2. Deudor Principal
  const deudorDoc = (pagare.deudor_documento_raw || '').trim();
  const deudorNombre = (pagare.deudor_nombre_raw || '').trim();
  if (deudorDoc || deudorNombre) {
    const res = sincronizarOAutoRegistrarPersona(
      {
        nombre: deudorNombre || 'Deudor Principal',
        documento: deudorDoc || `DOC-DEU-${pagare.correlativo}`,
        domicilio: pagare.deudor_domicilio_raw,
        origen: pagare.deudor_origen || 'MANUAL',
        rol: 'deudor'
      },
      personasActuales,
      onPersonaCreada
    );
    deudorIdFinal = res.persona.id;
    const nombreCompleto = `${res.persona.nombre} ${res.persona.apellido || ''}`.trim();
    nombresSincronizados.push(nombreCompleto);
    if (res.esNueva) {
      agregadas.push(res.persona);
    } else {
      yaExistentes.push(res.persona);
    }
  }

  // 3. Codeudores (por ID o por datos directos)
  const codeudoresInfo = [
    { id: pagare.codeudor1_id, nombre: pagare.codeudor1_nombre_raw, doc: pagare.codeudor1_documento_raw, dom: pagare.codeudor1_domicilio_raw, orig: pagare.codeudor1_origen, tag: 'Codeudor 1' },
    { id: pagare.codeudor2_id, nombre: pagare.codeudor2_nombre_raw, doc: pagare.codeudor2_documento_raw, dom: pagare.codeudor2_domicilio_raw, orig: pagare.codeudor2_origen, tag: 'Codeudor 2' }
  ];

  codeudoresInfo.forEach(c => {
    if (c.id) {
      const cPersona = personasActuales.find(p => p.id === c.id);
      if (cPersona) {
        const nombreCompleto = `${cPersona.nombre} ${cPersona.apellido || ''}`.trim();
        nombresSincronizados.push(nombreCompleto);
        yaExistentes.push(cPersona);
      }
    } else if (c.doc?.trim() || c.nombre?.trim()) {
      const res = sincronizarOAutoRegistrarPersona(
        {
          nombre: c.nombre?.trim() || c.tag,
          documento: c.doc?.trim() || `DOC-COD-${pagare.correlativo}-${Date.now().toString().slice(-4)}`,
          domicilio: c.dom?.trim(),
          origen: c.orig || 'MANUAL',
          rol: 'codeudor'
        },
        personasActuales,
        onPersonaCreada
      );
      const nombreCompleto = `${res.persona.nombre} ${res.persona.apellido || ''}`.trim();
      nombresSincronizados.push(nombreCompleto);
      if (res.esNueva) {
        agregadas.push(res.persona);
      } else {
        yaExistentes.push(res.persona);
      }
    }
  });

  const pagareActualizado: Pagare = {
    ...pagare,
    acreedor_id: acreedorIdFinal,
    deudor_id: deudorIdFinal
  };

  let mensaje = '';
  if (agregadas.length > 0) {
    const nombresAgregadas = agregadas.map(p => `${p.nombre} ${p.apellido || ''}`.trim());
    const textoNombres = formatearListaNombres(nombresAgregadas);
    mensaje = agregadas.length === 1 
      ? `¡Firmante ${textoNombres} sincronizado(a) con el Fichero con éxito!`
      : `¡Firmantes ${textoNombres} sincronizados con el Fichero con éxito!`;
  } else if (nombresSincronizados.length > 0) {
    const textoNombres = formatearListaNombres(nombresSincronizados);
    mensaje = `¡Firmantes ${textoNombres} ya se encontraban registrados en el Fichero y vinculados al Expediente 360°!`;
  } else {
    mensaje = 'No se encontraron firmantes con datos suficientes para sincronizar.';
  }

  return {
    agregadas,
    yaExistentes,
    nombresSincronizados,
    mensaje,
    pagareActualizado
  };
}

/**
 * Sincroniza los firmantes ingresados en el formulario de redacción del pagaré.
 */
export function sincronizarFirmantesDeFormulario(
  inputs: {
    acreedorNombre: string;
    acreedorDoc: string;
    acreedorDomicilio?: string;
    acreedorOrigen?: 'MANUAL' | 'DNIT';
    deudorNombre: string;
    deudorDoc: string;
    deudorDomicilio?: string;
    deudorOrigen?: 'MANUAL' | 'DNIT';
    codeudor1Id?: string;
    codeudor1Nombre?: string;
    codeudor1Doc?: string;
    codeudor1Domicilio?: string;
    codeudor1Origen?: 'MANUAL' | 'DNIT';
    codeudor2Id?: string;
    codeudor2Nombre?: string;
    codeudor2Doc?: string;
    codeudor2Domicilio?: string;
    codeudor2Origen?: 'MANUAL' | 'DNIT';
  },
  personasActuales: Persona[],
  onPersonaCreada?: (nuevaPersona: Persona) => void
): SincronizacionResultado & { acreedorPersona?: Persona; deudorPersona?: Persona; codeudor1Persona?: Persona; codeudor2Persona?: Persona } {
  const agregadas: Persona[] = [];
  const yaExistentes: Persona[] = [];
  const nombresSincronizados: string[] = [];

  let acreedorPersona: Persona | undefined;
  let deudorPersona: Persona | undefined;
  let codeudor1Persona: Persona | undefined;
  let codeudor2Persona: Persona | undefined;

  // 1. Acreedor
  const acreedorDoc = inputs.acreedorDoc.trim();
  const acreedorNombre = inputs.acreedorNombre.trim();
  if (acreedorDoc || acreedorNombre) {
    const res = sincronizarOAutoRegistrarPersona(
      {
        nombre: acreedorNombre || 'Acreedor Formulario',
        documento: acreedorDoc || `DOC-ACR-${Date.now().toString().slice(-6)}`,
        domicilio: inputs.acreedorDomicilio,
        origen: inputs.acreedorOrigen || 'MANUAL',
        rol: 'acreedor'
      },
      personasActuales,
      onPersonaCreada
    );
    acreedorPersona = res.persona;
    const nombreCompleto = `${res.persona.nombre} ${res.persona.apellido || ''}`.trim();
    nombresSincronizados.push(nombreCompleto);
    if (res.esNueva) {
      agregadas.push(res.persona);
    } else {
      yaExistentes.push(res.persona);
    }
  }

  // 2. Deudor
  const deudorDoc = inputs.deudorDoc.trim();
  const deudorNombre = inputs.deudorNombre.trim();
  if (deudorDoc || deudorNombre) {
    const res = sincronizarOAutoRegistrarPersona(
      {
        nombre: deudorNombre || 'Deudor Principal',
        documento: deudorDoc || `DOC-DEU-${Date.now().toString().slice(-6)}`,
        domicilio: inputs.deudorDomicilio,
        origen: inputs.deudorOrigen || 'MANUAL',
        rol: 'deudor'
      },
      personasActuales,
      onPersonaCreada
    );
    deudorPersona = res.persona;
    const nombreCompleto = `${res.persona.nombre} ${res.persona.apellido || ''}`.trim();
    nombresSincronizados.push(nombreCompleto);
    if (res.esNueva) {
      agregadas.push(res.persona);
    } else {
      yaExistentes.push(res.persona);
    }
  }

  // 3. Codeudor 1
  if (inputs.codeudor1Id) {
    const c1 = personasActuales.find(p => p.id === inputs.codeudor1Id);
    if (c1) {
      codeudor1Persona = c1;
      const nombreCompleto = `${c1.nombre} ${c1.apellido || ''}`.trim();
      nombresSincronizados.push(nombreCompleto);
      yaExistentes.push(c1);
    }
  } else if ((inputs.codeudor1Doc && inputs.codeudor1Doc.trim()) || (inputs.codeudor1Nombre && inputs.codeudor1Nombre.trim())) {
    const res = sincronizarOAutoRegistrarPersona(
      {
        nombre: inputs.codeudor1Nombre?.trim() || 'Co-Deudor 1',
        documento: inputs.codeudor1Doc?.trim() || `DOC-COD1-${Date.now().toString().slice(-6)}`,
        domicilio: inputs.codeudor1Domicilio?.trim(),
        origen: inputs.codeudor1Origen || 'MANUAL',
        rol: 'codeudor'
      },
      personasActuales,
      onPersonaCreada
    );
    codeudor1Persona = res.persona;
    const nombreCompleto = `${res.persona.nombre} ${res.persona.apellido || ''}`.trim();
    nombresSincronizados.push(nombreCompleto);
    if (res.esNueva) agregadas.push(res.persona);
    else yaExistentes.push(res.persona);
  }

  // 4. Codeudor 2
  if (inputs.codeudor2Id) {
    const c2 = personasActuales.find(p => p.id === inputs.codeudor2Id);
    if (c2) {
      codeudor2Persona = c2;
      const nombreCompleto = `${c2.nombre} ${c2.apellido || ''}`.trim();
      nombresSincronizados.push(nombreCompleto);
      yaExistentes.push(c2);
    }
  } else if ((inputs.codeudor2Doc && inputs.codeudor2Doc.trim()) || (inputs.codeudor2Nombre && inputs.codeudor2Nombre.trim())) {
    const res = sincronizarOAutoRegistrarPersona(
      {
        nombre: inputs.codeudor2Nombre?.trim() || 'Co-Deudor 2',
        documento: inputs.codeudor2Doc?.trim() || `DOC-COD2-${Date.now().toString().slice(-6)}`,
        domicilio: inputs.codeudor2Domicilio?.trim(),
        origen: inputs.codeudor2Origen || 'MANUAL',
        rol: 'codeudor'
      },
      personasActuales,
      onPersonaCreada
    );
    codeudor2Persona = res.persona;
    const nombreCompleto = `${res.persona.nombre} ${res.persona.apellido || ''}`.trim();
    nombresSincronizados.push(nombreCompleto);
    if (res.esNueva) agregadas.push(res.persona);
    else yaExistentes.push(res.persona);
  }

  let mensaje = '';
  if (agregadas.length > 0) {
    const nombresAgregadas = agregadas.map(p => `${p.nombre} ${p.apellido || ''}`.trim());
    const textoNombres = formatearListaNombres(nombresAgregadas);
    mensaje = agregadas.length === 1 
      ? `¡Firmante ${textoNombres} sincronizado(a) con el Fichero con éxito!`
      : `¡Firmantes ${textoNombres} sincronizados con el Fichero con éxito!`;
  } else if (nombresSincronizados.length > 0) {
    const textoNombres = formatearListaNombres(nombresSincronizados);
    mensaje = `¡Firmantes ${textoNombres} verificados y enlazados al Expediente 360° con éxito!`;
  } else {
    mensaje = 'Ingrese al menos un documento o nombre de firmante para sincronizar.';
  }

  return {
    agregadas,
    yaExistentes,
    nombresSincronizados,
    mensaje,
    acreedorPersona,
    deudorPersona
  };
}

/**
 * Revisa todos los pagarés existentes y auto-registra cualquier firmante pendiente en el Fichero.
 */
export function sincronizarRetroactivoTodosLosPagares(
  pagares: Pagare[],
  personasActuales: Persona[],
  onPersonaCreada?: (nuevaPersona: Persona) => void
): SincronizacionResultado {
  const todasAgregadas: Persona[] = [];
  const todasExistentes: Persona[] = [];
  const todosNombres: string[] = [];

  for (const pag of pagares) {
    const res = sincronizarFirmantesDePagare(pag, personasActuales, onPersonaCreada);
    todasAgregadas.push(...res.agregadas);
    todasExistentes.push(...res.yaExistentes);
    todosNombres.push(...res.nombresSincronizados);
  }

  let mensaje = '';
  if (todasAgregadas.length > 0) {
    const nombresAgregadas = todasAgregadas.map(p => `${p.nombre} ${p.apellido || ''}`.trim());
    const textoNombres = formatearListaNombres(nombresAgregadas);
    mensaje = `¡Firmantes ${textoNombres} sincronizados con el Fichero con éxito!`;
  } else {
    mensaje = '¡Todos los firmantes de los pagarés ya están sincronizados en el Fichero de Clientes!';
  }

  return {
    agregadas: todasAgregadas,
    yaExistentes: todasExistentes,
    nombresSincronizados: todosNombres,
    mensaje
  };
}
