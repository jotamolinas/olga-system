import { useState, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';

/**
 * Estructura de respuesta unificada y estandarizada para consultas DNIT / Fichero Notarial.
 * Garantiza que `ruc` SIEMPRE incluya el Dígito Verificador en formato "XXXXXXX-X".
 */
export interface DnitResponse {
  /** RUC formateado estrictamente con su Dígito Verificador: "XXXXXXX-X" */
  ruc: string;
  /** Nombre completo de persona física o Razón Social de persona jurídica */
  nombre: string;
  /** Número de documento base limpio (sin puntos ni guiones) */
  documento_numero: string;
  /** Dígito Verificador calculado o verificado ("0" al "9") */
  dv: string;
  /** Campo retrocompatible equivalente a `nombre` */
  nombre_o_razon_social: string;
  /** Tipo de documento inferido */
  tipo_documento: 'RUC' | 'CI';
  /** Domicilio o dirección tributaria si estuviera disponible */
  direccion?: string;
  /** Teléfono de contacto si estuviera disponible */
  telefono?: string;
  /** Correo electrónico si estuviera disponible */
  email?: string;
  /** Origen de los datos obtenidos */
  origen: 'DNIT' | 'FICHERO';
}

/**
 * Calcula el Dígito Verificador (DV) para un RUC / CI de Paraguay según el
 * algoritmo tributario oficial Módulo 11 (Resolución General SET / DNIT).
 *
 * @param numero Número base del documento (RUC o Cédula sin guion ni DV)
 * @param basemax Factor máximo de ponderación (por defecto 11)
 * @returns Dígito verificador resultante (0 al 9)
 */
export function calcularDVParaguay(numero: string, basemax: number = 11): number {
  if (!numero) return 0;

  // Limpiar cualquier caracter que no sea alfanumérico
  const limpio = numero.trim().replace(/[^a-zA-Z0-9]/g, '');
  if (!limpio) return 0;

  // Conversión de caracteres alfabéticos a números según especificación oficial SET/DNIT
  let numeroAl = '';
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio.charAt(i);
    const code = c.charCodeAt(0);
    if (code >= 48 && code <= 57) {
      // '0' al '9'
      numeroAl += c;
    } else if (code >= 65 && code <= 90) {
      // 'A' al 'Z' -> A=65 - 55 = 10, etc.
      numeroAl += (code - 55).toString();
    } else if (code >= 97 && code <= 122) {
      // 'a' al 'z' -> a=97 - 87 = 10, etc.
      numeroAl += (code - 87).toString();
    }
  }

  // Ponderación de derecha a izquierda con factor k (de 2 a basemax)
  let k = 2;
  let total = 0;
  for (let i = numeroAl.length - 1; i >= 0; i--) {
    total += parseInt(numeroAl.charAt(i), 10) * k;
    k++;
    if (k > basemax) {
      k = 2;
    }
  }

  // Regla Módulo 11: si resto > 1 -> 11 - resto; si resto == 0 o resto == 1 -> 0
  const resto = total % 11;
  return resto > 1 ? 11 - resto : 0;
}

/**
 * Formatea un número de documento paraguayo garantizando que devuelva "XXXXXXX-X".
 * Si ya incluye guion y DV lo respeta; si no lo incluye, calcula su DV oficial.
 */
export function formatearRUCConDV(documento: string): string {
  if (!documento) return '';
  const limpio = documento.trim().replace(/\s/g, '');
  if (!limpio) return '';

  if (limpio.includes('-')) {
    const partes = limpio.split('-');
    const base = partes[0].replace(/[^a-zA-Z0-9]/g, '');
    const dv = partes[1].trim() || String(calcularDVParaguay(base));
    return `${base}-${dv}`;
  }

  const base = limpio.replace(/[^a-zA-Z0-9]/g, '');
  if (!base) return '';
  const dv = calcularDVParaguay(base);
  return `${base}-${dv}`;
}

/**
 * Padrón tributario demo para entorno de previsualización / pruebas locales
 * Garantiza datos coherentes e inmediatos si la Cloud Function externa no está conectada.
 */
const PADRON_DEMO_DNIT: Record<
  string,
  { nombre: string; dv: string; direccion?: string; telefono?: string; email?: string }
> = {
  '2173790': {
    nombre: 'JUAN ALBERTO MOLINAS IHARA',
    dv: '0',
    direccion: 'Asunción, Barrio Herrera',
    telefono: '+595 21 600-123',
    email: 'juan.molinas@olga-notarial.com',
  },
  '80012345': {
    nombre: 'CONSTRUCCIONES & ASOCIADOS S.A.',
    dv: '6',
    direccion: 'Avda. Mariscal López 1234, Asunción',
    telefono: '+595 21 600-000',
    email: 'contacto@construcciones.com.py',
  },
  '80098765': {
    nombre: 'AGROGANADERA DEL SUR S.R.L.',
    dv: '4',
    direccion: 'Ruta 1 Km 15, San Lorenzo',
    telefono: '+595 21 580-000',
    email: 'administracion@agrosur.com.py',
  },
  '4455667': {
    nombre: 'MARÍA ELENA GÓMEZ BENÍTEZ',
    dv: '2',
    direccion: 'Itá Enramada, Asunción',
    telefono: '+595 971 998-877',
    email: 'maria.gomez@gmail.com',
  },
};

/**
 * Consulta centralizada a la DNIT / SET con búsqueda prioritaria en el Fichero Notarial Local.
 *
 * REGLA GLOBAL OBLIGATORIA:
 * El objeto retornado garantiza que la propiedad `ruc` siempre incluya el número base,
 * el guion y el Dígito Verificador (`${numBase}-${dv}`).
 *
 * @param rucConODv Cadena con número de documento o RUC (con o sin guion / DV)
 * @returns Promesa con el objeto `DnitResponse` formateado o `null` si no se localiza
 */
export async function consultarRUC(rucConODv: string): Promise<DnitResponse | null> {
  const rucLimpio = (rucConODv || '').replace(/\s/g, '').trim();
  if (!rucLimpio || rucLimpio.length < 3) return null;

  // Descomponer en número base y DV ingresado (si existiera)
  const rucParts = rucLimpio.split('-');
  const numBase = rucParts[0].replace(/[^a-zA-Z0-9]/g, '');
  if (!numBase) return null;

  const dvIngresado = rucParts.length > 1 ? rucParts[1].trim() : '';
  const isRuc = numBase.length >= 7 || numBase.startsWith('800') || rucParts.length > 1;

  // 1. PRIORIDAD ABSOLUTA: Búsqueda en el Fichero Notarial Local (localStorage)
  const keys = ['olga_directorio_personas', 'OLGA_PERSONAS_LIST', 'fichero_personas', 'personas'];
  const docComparar = numBase.toLowerCase();

  for (const k of keys) {
    try {
      const stored = localStorage.getItem(k);
      if (stored) {
        const list = JSON.parse(stored);
        if (Array.isArray(list)) {
          const match = list.find((p: any) => {
            const pDocRaw = (p.nro_documento || '').replace(/[.-]/g, '').trim().toLowerCase();
            const pDocBase = pDocRaw.split('-')[0];
            return pDocBase && (pDocBase === docComparar || pDocRaw === docComparar);
          });

          if (match) {
            // Resolver Dígito Verificador del registro local
            let dvFinal = dvIngresado;
            const pDocRaw = (match.nro_documento || '').trim();
            if (pDocRaw.includes('-')) {
              dvFinal = pDocRaw.split('-')[1].trim();
            } else if (match.dv !== undefined && match.dv !== null && String(match.dv).trim() !== '') {
              dvFinal = String(match.dv).trim();
            } else if (!dvFinal) {
              dvFinal = String(calcularDVParaguay(numBase));
            }

            const nombreCompleto =
              `${match.nombre || ''} ${match.apellido || ''}`.trim() ||
              match.nombre_o_razon_social ||
              match.nombre ||
              'Cliente Registrado';

            const rucFinal = `${numBase}-${dvFinal}`;

            return {
              ruc: rucFinal,
              nombre: nombreCompleto,
              documento_numero: numBase,
              dv: dvFinal,
              nombre_o_razon_social: nombreCompleto,
              tipo_documento: match.tipo_documento || (isRuc ? 'RUC' : 'CI'),
              direccion: match.domicilio || match.direccion || '',
              telefono: match.telefono || '',
              email: match.email || '',
              origen: 'FICHERO',
            };
          }
        }
      }
    } catch {
      // Ignorar errores de lectura de localStorage
    }
  }

  // 2. Consulta Externa Segura vía Firebase Cloud Functions (onCall)
  try {
    const functions = getFunctions();
    const llamarConsultarRUC = httpsCallable(functions, 'consultarRUC');
    const result = await llamarConsultarRUC({ documento_numero: numBase });
    const data = result.data as any;

    if (data && (data.nombre_o_razon_social || data.nombre)) {
      const nombreFinal = (data.nombre_o_razon_social || data.nombre || '').trim();

      // Resolver DV devuelto por el servicio o calcularlo mediante Módulo 11
      let dvFinal = '';
      if (data.dv !== undefined && data.dv !== null && String(data.dv).trim() !== '') {
        dvFinal = String(data.dv).trim();
      } else if (dvIngresado) {
        dvFinal = dvIngresado;
      } else {
        dvFinal = String(calcularDVParaguay(numBase));
      }

      const rucFinal = `${numBase}-${dvFinal}`;

      return {
        ruc: rucFinal,
        nombre: nombreFinal,
        documento_numero: numBase,
        dv: dvFinal,
        nombre_o_razon_social: nombreFinal,
        tipo_documento: 'RUC',
        direccion: data.direccion || data.domicilio || '',
        telefono: data.telefono || '',
        email: data.email || '',
        origen: 'DNIT',
      };
    }
  } catch (error: any) {
    const errorMsg = String(error?.message || '');
    const errorCode = String(error?.code || '');

    // Si el documento no figura en la DNIT (404/not-found) o Cloud Functions no está inicializada en dev
    if (
      errorCode !== 'not-found' &&
      errorCode !== 'functions/not-found' &&
      !errorMsg.includes('404') &&
      !errorMsg.includes('No se encontró')
    ) {
      console.warn('Consulta DNIT Cloud Function no disponible:', errorMsg || error);
    }
  }

  // 3. Fallback inteligente para Padrón Demo / Pruebas Locales (ej. CI/RUC 2173790)
  if (PADRON_DEMO_DNIT[numBase]) {
    const demo = PADRON_DEMO_DNIT[numBase];
    const dvFinal = demo.dv || dvIngresado || String(calcularDVParaguay(numBase));
    const rucFinal = `${numBase}-${dvFinal}`;

    return {
      ruc: rucFinal,
      nombre: demo.nombre,
      documento_numero: numBase,
      dv: dvFinal,
      nombre_o_razon_social: demo.nombre,
      tipo_documento: 'RUC',
      direccion: demo.direccion || '',
      telefono: demo.telefono || '',
      email: demo.email || '',
      origen: 'DNIT',
    };
  }

  // Si no se encuentra en Fichero, DNIT Cloud Function ni Demo Padrón, retornar null
  return null;
}

/**
 * Custom Hook React para consumo simplificado y reactivo de la DNIT en cualquier componente.
 */
export function useDnit() {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consultar = useCallback(async (doc: string): Promise<DnitResponse | null> => {
    setCargando(true);
    setError(null);
    try {
      const res = await consultarRUC(doc);
      if (!res) {
        setError('Documento no localizado en el padrón DNIT ni en el Fichero.');
      }
      return res;
    } catch (err: any) {
      const msg = err?.message || 'Error al conectar con el servicio DNIT.';
      setError(msg);
      return null;
    } finally {
      setCargando(false);
    }
  }, []);

  return {
    consultar,
    cargando,
    error,
  };
}