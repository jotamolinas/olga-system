import { Persona } from '../types';

/**
 * Módulo de Deduplicación y Unicidad Registral Notarial (O.L.G.A.)
 * Especializado en la normativa de identificación paraguaya (C.I., RUC con Dígito Verificador y Personas Jurídicas).
 */

/**
 * Extrae el número base del documento (sin puntos, espacios ni Dígito Verificador después del guion).
 * En Paraguay:
 * - C.I. Física: '1.234.567' -> '1234567'
 * - RUC Físico: '1234567-8' -> '1234567'
 * - RUC Jurídico: '80.012.345-6' -> '80012345'
 */
export function extraerDocBase(doc?: string): string {
  if (!doc) return '';
  const str = String(doc).trim();
  // Quitar puntos, comas y espacios
  const sinPuntos = str.replace(/[.\s,]/g, '');
  // Separar el número base antes del guion del DV
  const base = sinPuntos.split('-')[0].trim().toLowerCase();
  // Quitar cualquier carácter no alfanumérico residual
  return base.replace(/[^a-z0-9]/g, '');
}

/**
 * Normaliza el documento completo quitando puntos y espacios superfluos.
 */
export function normalizarDocCompleto(doc?: string): string {
  if (!doc) return '';
  return String(doc)
    .replace(/[.\s]/g, '')
    .trim()
    .toUpperCase();
}

/**
 * Normaliza nombres y apellidos para comparación fonética/literal:
 * remueve acentos/diacríticos, pasa a minúsculas y colapsa espacios.
 */
export function normalizarNombre(nombre?: string, apellido?: string): string {
  const comp = `${nombre || ''} ${apellido || ''}`.trim().toLowerCase();
  return comp
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Determina si dos registros corresponden a la misma persona física o jurídica
 * según los criterios notariales de identidad paraguaya.
 */
export function sonMismaPersona(p1: Partial<Persona>, p2: Partial<Persona>): boolean {
  if (!p1 || !p2) return false;

  // 1. Mismo ID exacto
  if (p1.id && p2.id && p1.id === p2.id) {
    return true;
  }

  const base1 = extraerDocBase(p1.nro_documento);
  const base2 = extraerDocBase(p2.nro_documento);

  // 2. Coincidencia por número base de documento (C.I. vs RUC base)
  // Requiere al menos 3 caracteres para evitar falsos positivos con cadenas cortas o vacías
  if (base1 && base2 && base1.length >= 3 && base1 === base2) {
    return true;
  }

  // 3. Coincidencia por documento completo normalizado (incluyendo DV)
  const norm1 = normalizarDocCompleto(p1.nro_documento);
  const norm2 = normalizarDocCompleto(p2.nro_documento);
  if (norm1 && norm2 && norm1.length >= 3 && norm1 === norm2) {
    return true;
  }

  // 4. Coincidencia por Nombre y Apellido idénticos
  const nom1 = normalizarNombre(p1.nombre, p1.apellido);
  const nom2 = normalizarNombre(p2.nombre, p2.apellido);

  // Si ambos tienen nombre completo idéntico (mínimo 5 caracteres y 2 palabras)
  if (nom1 && nom2 && nom1.length >= 5 && nom1 === nom2) {
    // Si los documentos también son compatibles o uno de los dos no tenía documento formal
    if (!base1 || !base2 || base1 === base2) {
      return true;
    }
  }

  return false;
}

/**
 * Busca si ya existe una persona en la lista que coincida con los datos dados.
 * Excluye opcionalmente un ID (para operaciones de edición del mismo registro).
 */
export function buscarPersonaDuplicada(
  persona: Partial<Persona>,
  lista: Persona[],
  excluirId?: string | null
): Persona | undefined {
  if (!persona || !Array.isArray(lista) || lista.length === 0) return undefined;

  return lista.find((p) => {
    if (excluirId && p.id === excluirId) return false;
    return sonMismaPersona(persona, p);
  });
}

/**
 * Fusiona de forma no destructiva dos registros que corresponden a la misma persona,
 * conservando el número de documento más completo (con DV), teléfonos, domicilios,
 * correos y unificando las notas notariales del expediente.
 */
export function fusionarPersonas(pPrincipal: Persona, pSecundaria: Persona): Persona {
  // Preferir el documento que tenga Dígito Verificador oficial (-)
  const doc1 = pPrincipal.nro_documento || '';
  const doc2 = pSecundaria.nro_documento || '';
  let docElegido = doc1;
  if (!doc1.includes('-') && doc2.includes('-')) {
    docElegido = doc2;
  } else if (!doc1 && doc2) {
    docElegido = doc2;
  }

  // Preferir tipo de documento RUC si hay guion
  const tipoDocElegido = docElegido.includes('-') ? 'RUC' : (pPrincipal.tipo_documento || pSecundaria.tipo_documento || 'CI');

  // Unificar notas notariales
  const notas1 = (pPrincipal.notas_notariales || '').trim();
  const notas2 = (pSecundaria.notas_notariales || '').trim();
  let notasUnificadas = notas1;
  if (notas2 && !notas1.includes(notas2)) {
    notasUnificadas = notas1 ? `${notas1}\n---\n${notas2}` : notas2;
  }

  return {
    ...pPrincipal,
    nro_documento: docElegido,
    tipo_documento: tipoDocElegido,
    apellido: pPrincipal.apellido || pSecundaria.apellido,
    domicilio: pPrincipal.domicilio?.trim() || pSecundaria.domicilio?.trim() || '',
    telefono: pPrincipal.telefono?.trim() || pSecundaria.telefono?.trim() || '',
    email: pPrincipal.email?.trim() || pSecundaria.email?.trim() || '',
    representante_id: pPrincipal.representante_id || pSecundaria.representante_id,
    representanteLegal: pPrincipal.representanteLegal || pSecundaria.representanteLegal,
    notas_notariales: notasUnificadas,
    origen: pPrincipal.origen === 'DNIT' || pSecundaria.origen === 'DNIT' ? 'DNIT' : (pPrincipal.origen || pSecundaria.origen || 'MANUAL')
  };
}

/**
 * Detecta todos los grupos de registros duplicados en una lista.
 */
export function detectarGruposDuplicados(lista: Persona[]): { principal: Persona; duplicados: Persona[] }[] {
  if (!Array.isArray(lista) || lista.length <= 1) return [];

  const visitados = new Set<string>();
  const grupos: { principal: Persona; duplicados: Persona[] }[] = [];

  for (let i = 0; i < lista.length; i++) {
    const actual = lista[i];
    if (!actual || !actual.id || visitados.has(actual.id)) continue;

    visitados.add(actual.id);
    const duplicados: Persona[] = [];

    for (let j = i + 1; j < lista.length; j++) {
      const candidato = lista[j];
      if (!candidato || !candidato.id || visitados.has(candidato.id)) continue;

      if (sonMismaPersona(actual, candidato)) {
        visitados.add(candidato.id);
        duplicados.push(candidato);
      }
    }

    if (duplicados.length > 0) {
      grupos.push({ principal: actual, duplicados });
    }
  }

  return grupos;
}

/**
 * Depura una lista completa de personas, fusionando duplicados
 * y devolviendo la lista limpia junto con los IDs eliminados.
 */
export function depurarDuplicadosLista(lista: Persona[]): {
  listaLimpia: Persona[];
  duplicadosEliminados: number;
  idsEliminados: string[];
} {
  if (!Array.isArray(lista) || lista.length <= 1) {
    return { listaLimpia: lista || [], duplicadosEliminados: 0, idsEliminados: [] };
  }

  const listaLimpia: Persona[] = [];
  const idsEliminados: string[] = [];

  for (const item of lista) {
    if (!item) continue;
    const existenteIndex = listaLimpia.findIndex((p) => sonMismaPersona(item, p));

    if (existenteIndex >= 0) {
      // Fusionar en el registro existente
      const existente = listaLimpia[existenteIndex];
      const fusionado = fusionarPersonas(existente, item);
      listaLimpia[existenteIndex] = fusionado;
      if (item.id && item.id !== existente.id) {
        idsEliminados.push(item.id);
      }
    } else {
      listaLimpia.push(item);
    }
  }

  return {
    listaLimpia,
    duplicadosEliminados: idsEliminados.length,
    idsEliminados
  };
}
