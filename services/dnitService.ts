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
  const dv = rucParts.length > 1 ? rucParts[1] : '';

  // 1. Buscar primero en el Fichero local (localStorage)
  const keys = ['OLGA_PERSONAS_LIST', 'fichero_personas', 'personas'];
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
            const nombreCompleto = `${match.nombre || ''} ${match.apellido || ''}`.trim();
            return {
              documento_numero: match.nro_documento || rucLimpio,
              dv: dv || '0',
              nombre_o_razon_social: nombreCompleto,
              tipo_documento: match.tipo_documento || (isRuc ? 'RUC' : 'CI'),
              direccion: match.domicilio || '',
              telefono: match.telefono || '',
              origen: 'FICHERO'
            };
          }
        }
      }
    } catch {
      // Ignorar error de parseo y continuar
    }
  }

  // 2. Si no está en el Fichero local, no forzar nombres ficticios o mocks.
  // Retorna null para permitir ingreso 100% libre sin alterar lo escrito por el usuario.
  return null;
}