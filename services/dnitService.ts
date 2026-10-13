import { getFunctions, httpsCallable } from 'firebase/functions';

export interface DnitResponse {
  documento_numero: string;
  dv: string;
  nombre_o_razon_social: string;
  tipo_documento: "RUC" | "CI";
  direccion?: string;
  telefono?: string;
  origen: "DNIT" | "FICHERO";
}

export async function consultarRUC(rucConDv: string): Promise<DnitResponse | null> {
  const rucLimpio = rucConDv.replace(/\s/g, "").trim();
  if (!rucLimpio || rucLimpio.length < 4) return null;

  const rucParts = rucLimpio.split('-');
  const isRuc = rucLimpio.length >= 7 || rucParts.length > 1;
  const numRuc = rucParts[0];

  // 1. Búsqueda local (Fichero) para respuesta instantánea
  const keys = ['olga_directorio_personas', 'OLGA_PERSONAS_LIST', 'fichero_personas', 'personas'];
  const docComparar = rucLimpio.replace(/[.-]/g, '').toLowerCase();

  for (const k of keys) {
    try {
      const stored = localStorage.getItem(k);
      if (stored) {
        const list = JSON.parse(stored);
        if (Array.isArray(list)) {
          const match = list.find((p: any) => {
            const pDoc = (p.nro_documento || '').replace(/[.-]/g, '').toLowerCase();
            return pDoc && pDoc === docComparar;
          });
          if (match) {
            return {
              documento_numero: match.nro_documento || rucLimpio,
              dv: rucParts.length > 1 ? rucParts[1] : '0',
              nombre_o_razon_social: `${match.nombre || ''} ${match.apellido || ''}`.trim(),
              tipo_documento: match.tipo_documento || (isRuc ? 'RUC' : 'CI'),
              direccion: match.domicilio || '',
              telefono: match.telefono || '',
              origen: 'FICHERO'
            };
          }
        }
      }
    } catch {
      // Ignorar errores del storage
    }
  }

  // 2. Consulta Externa Segura vía Firebase Cloud Functions (onCall)
  try {
    // Inicializamos las funciones de Firebase en la aplicación
    const functions = getFunctions();
    
    // Hacemos referencia a tu función exacta alojada en Google Cloud
    const llamarConsultarRUC = httpsCallable(functions, 'consultarRUC');
    
    // Ejecutamos la función pasando la variable 'documento_numero' como lo exige tu backend
    const result = await llamarConsultarRUC({ documento_numero: numRuc });
    const data = result.data as any;

    if (data && data.nombre_o_razon_social) {
      return {
        documento_numero: numRuc,
        dv: data.dv || (rucParts.length > 1 ? rucParts[1] : '0'),
        nombre_o_razon_social: data.nombre_o_razon_social,
        tipo_documento: 'RUC',
        origen: 'DNIT'
      };
    }
    
    return null;
  } catch (error: any) {
    const errorMsg = String(error?.message || '');
    const errorCode = String(error?.code || '');

    // Si el documento no figura en el padrón de contribuyentes de la DNIT (404 / not-found),
    // es un flujo previsto y normal (ej. persona física con CI sin RUC, o documento aún no registrado).
    // Retornamos null limpiamente para permitir el ingreso libre de datos sin disparar errores críticos.
    if (
      errorCode === 'not-found' ||
      errorCode === 'functions/not-found' ||
      errorMsg.includes('404') ||
      errorMsg.includes('No se encontró') ||
      errorMsg.includes('not found') ||
      errorMsg.includes('no encontrado')
    ) {
      return null;
    }

    // Para eventualidades de red no críticas
    console.warn('Consulta DNIT no completada:', errorMsg || error);
    return null;
  }
}