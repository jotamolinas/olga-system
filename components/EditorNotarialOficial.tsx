import React, { useState, useEffect, useRef } from 'react';
import { 
  Printer, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Stamp,
  Sliders,
  Sparkles,
  Type,
  MoveVertical,
  MoveHorizontal,
  Save,
  Check
} from 'lucide-react';
export type TipoDocumentoNotarial = 
  | 'Concuerda' 
  | 'Certificación de Firmas' 
  | 'Legalización' 
  | 'Sellado Notarial - Protocolo';

export interface ConfiguracionHojaNotarial {
  offsetX: number;
  offsetY: number;
  fontSizeGlobal: string;
  fontFamilyGlobal: string;
  interlineadoGlobal: number;
  margenHorizontal: number;
}

export const CONFIG_POR_DEFECTO: ConfiguracionHojaNotarial = {
  offsetX: 0,
  offsetY: 0,
  fontSizeGlobal: '12pt',
  fontFamilyGlobal: 'Arial, Helvetica, sans-serif',
  interlineadoGlobal: 8.47,
  margenHorizontal: 0,
};

export const getConfigKey = (tipo: TipoDocumentoNotarial): string => {
  switch (tipo) {
    case 'Sellado Notarial - Protocolo':
      return 'olga_config_protocolo';
    case 'Certificación de Firmas':
      return 'olga_config_certificacion';
    case 'Concuerda':
      return 'olga_config_concuerda';
    case 'Legalización':
      return 'olga_config_legalizacion';
    default:
      return 'olga_config_general';
  }
};

export const cargarConfiguracionHoja = (tipo: TipoDocumentoNotarial): ConfiguracionHojaNotarial => {
  try {
    const raw = localStorage.getItem(getConfigKey(tipo));
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        offsetX: typeof parsed.offsetX === 'number' ? parsed.offsetX : 0,
        offsetY: typeof parsed.offsetY === 'number' ? parsed.offsetY : 0,
        fontSizeGlobal: parsed.fontSizeGlobal || '12pt',
        fontFamilyGlobal: parsed.fontFamilyGlobal || 'Arial, Helvetica, sans-serif',
        interlineadoGlobal: typeof parsed.interlineadoGlobal === 'number' ? parsed.interlineadoGlobal : 8.47,
        margenHorizontal: typeof parsed.margenHorizontal === 'number' ? parsed.margenHorizontal : 0,
      };
    }
    // Retrocompatibilidad con offsets previos si existen
    const legacyX = localStorage.getItem(`olga_print_offset_x_${tipo}`);
    const legacyY = localStorage.getItem(`olga_print_offset_y_${tipo}`);
    return {
      ...CONFIG_POR_DEFECTO,
      offsetX: legacyX ? parseFloat(legacyX) : 0,
      offsetY: legacyY ? parseFloat(legacyY) : 0,
    };
  } catch (e) {
    console.error('Error cargando configuración notarial:', e);
    return { ...CONFIG_POR_DEFECTO };
  }
};

interface EditorNotarialOficialProps {
  onVolver?: () => void;
  hojaInicial?: 'hoja-0' | 'hoja-1' | 'hoja-2' | 'hoja-3';
}

const resolverTipoDocumentoInicial = (hojaInicial?: string): TipoDocumentoNotarial => {
  const ruta = hojaInicial || (typeof window !== 'undefined' ? window.location.pathname : '');
  if (ruta.includes('hoja-0')) return 'Sellado Notarial - Protocolo';
  if (ruta.includes('hoja-1')) return 'Certificación de Firmas';
  if (ruta.includes('hoja-2')) return 'Concuerda';
  if (ruta.includes('hoja-3')) return 'Legalización';
  return 'Sellado Notarial - Protocolo';
};

export const EditorNotarialOficial: React.FC<EditorNotarialOficialProps> = ({ onVolver, hojaInicial }) => {
  const tipoInicial = resolverTipoDocumentoInicial(hojaInicial);
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumentoNotarial>(tipoInicial);
  const [mostrarGuia, setMostrarGuia] = useState<boolean>(true);
  const [rellenoGuiones, setRellenoGuiones] = useState<boolean>(true);

  // Carga inicial independiente para la plantilla activa por defecto
  const initialConfig = cargarConfiguracionHoja(tipoInicial);
  const [offsetX, setOffsetX] = useState<number>(initialConfig.offsetX);
  const [offsetY, setOffsetY] = useState<number>(initialConfig.offsetY);
  const [fontSizeGlobal, setFontSizeGlobal] = useState<string>(initialConfig.fontSizeGlobal);
  const [fontFamilyGlobal, setFontFamilyGlobal] = useState<string>(initialConfig.fontFamilyGlobal);
  const [interlineadoGlobal, setInterlineadoGlobal] = useState<number>(initialConfig.interlineadoGlobal);
  const [margenHorizontal, setMargenHorizontal] = useState<number>(initialConfig.margenHorizontal);
  const [guardadoFeedback, setGuardadoFeedback] = useState<boolean>(false);

  // Función para guardar en localStorage de forma aislada e independiente según el tipo de hoja
  const guardarConfiguracionActual = (
    tipoDestino: TipoDocumentoNotarial = tipoDocumento,
    valoresSobrescritos?: Partial<ConfiguracionHojaNotarial>
  ) => {
    const configToSave: ConfiguracionHojaNotarial = {
      offsetX: valoresSobrescritos?.offsetX !== undefined ? valoresSobrescritos.offsetX : offsetX,
      offsetY: valoresSobrescritos?.offsetY !== undefined ? valoresSobrescritos.offsetY : offsetY,
      fontSizeGlobal: valoresSobrescritos?.fontSizeGlobal !== undefined ? valoresSobrescritos.fontSizeGlobal : fontSizeGlobal,
      fontFamilyGlobal: valoresSobrescritos?.fontFamilyGlobal !== undefined ? valoresSobrescritos.fontFamilyGlobal : fontFamilyGlobal,
      interlineadoGlobal: valoresSobrescritos?.interlineadoGlobal !== undefined ? valoresSobrescritos.interlineadoGlobal : interlineadoGlobal,
      margenHorizontal: valoresSobrescritos?.margenHorizontal !== undefined ? valoresSobrescritos.margenHorizontal : margenHorizontal,
    };
    try {
      localStorage.setItem(getConfigKey(tipoDestino), JSON.stringify(configToSave));
      // Guardar también retrocompatibilidad
      localStorage.setItem(`olga_print_offset_x_${tipoDestino}`, configToSave.offsetX.toString());
      localStorage.setItem(`olga_print_offset_y_${tipoDestino}`, configToSave.offsetY.toString());
    } catch (e) {
      console.error('Error guardando configuración notarial:', e);
    }
  };

  // Cambio de plantilla con persistencia automática de la anterior y carga de la nueva
  const handleCambiarTipoDocumento = (nuevoTipo: TipoDocumentoNotarial) => {
    if (nuevoTipo === tipoDocumento) return;

    // 1. Guardar la configuración actual de la plantilla saliente
    guardarConfiguracionActual(tipoDocumento);

    // 2. Cargar la configuración independiente de la nueva plantilla entrante
    const configEntrante = cargarConfiguracionHoja(nuevoTipo);
    setOffsetX(configEntrante.offsetX);
    setOffsetY(configEntrante.offsetY);
    setFontSizeGlobal(configEntrante.fontSizeGlobal);
    setFontFamilyGlobal(configEntrante.fontFamilyGlobal);
    setInterlineadoGlobal(configEntrante.interlineadoGlobal);
    setMargenHorizontal(configEntrante.margenHorizontal);

    // 3. Cambiar el tipo de documento activo
    setTipoDocumento(nuevoTipo);
  };

  // Guardar configuración manual con feedback visual en el botón
  const handleGuardarConfiguracion = () => {
    guardarConfiguracionActual(tipoDocumento);
    setGuardadoFeedback(true);
    setTimeout(() => {
      setGuardadoFeedback(false);
    }, 2000);
  };

  // PLANTILLA 1: Certificación de Firmas (Art. 152 Ley 879)
  const [firmasT1, setFirmasT1] = useState<string>('TITULAR.-');
  const [firmasT2, setFirmasT2] = useState<string>('1.292.-');
  const [firmasT3, setFirmasT3] = useState<string>('ITAKYRY.-');
  
  // Desborde inteligente Punto Primero (Tramo 1, 2, 3)
  const [tramoPrimero1, setTramoPrimero1] = useState<string>('CONTRATO PRIVADO');
  const [tramoPrimero2, setTramoPrimero2] = useState<string>('DE COMPRAVENTA DE VEHÍCULO AUTOMOTOR');
  const [tramoPrimero3, setTramoPrimero3] = useState<string>('y ratificado en todas sus partes ante mi presencia');

  // Incisos a, b, c, d
  const [incisoANombre, setIncisoANombre] = useState<string>('JUAN CARLOS PÉREZ GÓMEZ');
  const [incisoADoc, setIncisoADoc] = useState<string>('1.234.567');
  const [incisoADom, setIncisoADom] = useState<string>('ASUNCIÓN');

  const [incisoBNombre, setIncisoBNombre] = useState<string>('MARÍA ELENA GONZÁLEZ DE PÉREZ');
  const [incisoBDoc, setIncisoBDoc] = useState<string>('2.345.678');
  const [incisoBDom, setIncisoBDom] = useState<string>('ASUNCIÓN');

  const [incisoCNombre, setIncisoCNombre] = useState<string>('');
  const [incisoCDoc, setIncisoCDoc] = useState<string>('');
  const [incisoCDom, setIncisoCDom] = useState<string>('');

  const [incisoDNombre, setIncisoDNombre] = useState<string>('');
  const [incisoDDoc, setIncisoDDoc] = useState<string>('');
  const [incisoDDom, setIncisoDDom] = useState<string>('');

  // Segundo, Cuarto
  const [folio1, setFolio1] = useState<string>('45');
  const [folio2, setFolio2] = useState<string>('46');
  const [tomoLibro, setTomoLibro] = useState<string>('Tomo III');
  const [horaCert, setHoraCert] = useState<string>('10:30');
  const [diaCert, setDiaCert] = useState<string>('12');
  const [mesCert, setMesCert] = useState<string>('MAYO');
  const [anioCert, setAnioCert] = useState<string>('DOS MIL VEINTISÉIS');

  // PLANTILLA 2: Concuerda
  const [matrizNro, setMatrizNro] = useState<string>('79');
  const [folioConcuerda, setFolioConcuerda] = useState<string>('145 Y VTO.');
  const [divisionConcuerda, setDivisionConcuerda] = useState<string>('CIVIL');
  const [seccionConcuerda, setSeccionConcuerda] = useState<string>('B');
  const [registroConcuerda, setRegistroConcuerda] = useState<string>('1.292');
  const [asientoConcuerda, setAsientoConcuerda] = useState<string>('ASUNCIÓN');
  const [autorizanteConcuerda, setAutorizanteConcuerda] = useState<string>('RICARDO GABRIEL MARTÍNEZ VARELA');
  const [caracterConcuerda, setCaracterConcuerda] = useState<string>('TITULAR');
  const [copiaConcuerda, setCopiaConcuerda] = useState<string>('PRIMERA');
  const [destinatarioConcuerda, setDestinatarioConcuerda] = useState<string>('LA PARTE INTERESADA');
  const [lineaAdicionalConcuerda, setLineaAdicionalConcuerda] = useState<string>('');
  const [cierreConcuerda, setCierreConcuerda] = useState<string>('');
  const [diaLetrasConcuerda, setDiaLetrasConcuerda] = useState<string>('QUINCE');
  const [mesConcuerda, setMesConcuerda] = useState<string>('MAYO');
  const [anioLetrasConcuerda, setAnioLetrasConcuerda] = useState<string>('DOS MIL VEINTISÉIS');

  // PLANTILLA 3: Legalización
  const [nombreNotarioLeg, setNombreNotarioLeg] = useState<string>('RICARDO GABRIEL MARTÍNEZ VARELA');
  const [lineaAdicionalLeg, setLineaAdicionalLeg] = useState<string>('');
  const [escrituraNroLeg, setEscrituraNroLeg] = useState<string>('1.292 - ESCRITURA Nº 79');
  const [fechaEscrituraLeg, setFechaEscrituraLeg] = useState<string>('10 DE MAYO DE 2026');
  const [hojaSeguridadNroLeg, setHojaSeguridadNroLeg] = useState<string>('PJD-2026 Nº 4.589.123');
  const [diaLeg, setDiaLeg] = useState<string>('15');
  const [mesLeg, setMesLeg] = useState<string>('MAYO');
  const [anioLeg, setAnioLeg] = useState<string>('2026');

  // PLANTILLA 0: Protocolo
  const [protocoloTextoVertical, setProtocoloTextoVertical] = useState<string>('PARA REGISTROS PÚBLICOS CIVIL Y COMERCIAL - PROTOCOLO NOTARIAL');
  const [protocoloPaginas, setProtocoloPaginas] = useState<string[]>([
    'ESCRITURA PÚBLICA NÚMERO SETENTA Y NUEVE (79).- En la Ciudad de Asunción, Capital de la República del Paraguay, a los diez días del mes de mayo del año dos mil veintiséis, ante mí: RICARDO GABRIEL MARTÍNEZ VARELA, Notario y Escribano Público Titular del Registro Notarial Número Mil Doscientos Noventa y Dos (1.292), comparecen...'
  ]);
  const textareasRefs = useRef<(HTMLTextAreaElement | null)[]>([]);


  const handleTextareaChange = (index: number, e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const texto = e.target.value;
    const nuevasPaginas = [...protocoloPaginas];
    
    // Límite de seguridad: Cuántos caracteres entran aproximadamente en 25 renglones
    // Ajustable según el tamaño de fuente. 1800 es un buen promedio para oficios.
    const MAX_CARACTERES_POR_PAGINA = 1800; 
    const MAX_LINEAS_ENTER = 25;

    const lineas = texto.split('\n');

    // CONDICIÓN 1: Si hay más de 25 Enters forzados
    if (lineas.length > MAX_LINEAS_ENTER) {
      nuevasPaginas[index] = lineas.slice(0, MAX_LINEAS_ENTER).join('\n');
      const sobrante = lineas.slice(MAX_LINEAS_ENTER).join('\n');
      
      const sobranteLimpio = sobrante.trim();
      if (sobranteLimpio.length > 0) {
        if (nuevasPaginas.length <= index + 1) {
          nuevasPaginas.push(sobranteLimpio);
        } else {
          nuevasPaginas[index + 1] = sobranteLimpio + (nuevasPaginas[index + 1] ? '\n' + nuevasPaginas[index + 1] : '');
        }
      }
      
      const resultado = nuevasPaginas.filter((p, i) => (p && p.trim() !== '') || i === 0);
      setProtocoloPaginas(resultado.length > 0 ? resultado : ['']);
      setTimeout(() => {
        textareasRefs.current[index + 1]?.focus();
        textareasRefs.current[index + 1]?.setSelectionRange(0, 0);
      }, 50);
    } 
    // CONDICIÓN 2: Si el texto es muy largo pero no tiene Enters (párrafos bloque)
    else if (texto.length > MAX_CARACTERES_POR_PAGINA) {
      let puntoDeCorte = texto.lastIndexOf(' ', MAX_CARACTERES_POR_PAGINA);
      if (puntoDeCorte === -1) puntoDeCorte = MAX_CARACTERES_POR_PAGINA; // Fallback

      const textoActual = texto.substring(0, puntoDeCorte);
      const sobrante = texto.substring(puntoDeCorte).trimStart();

      nuevasPaginas[index] = textoActual;

      const sobranteLimpio = sobrante.trim();
      if (sobranteLimpio.length > 0) {
        if (nuevasPaginas.length <= index + 1) {
          nuevasPaginas.push(sobranteLimpio);
        } else {
          nuevasPaginas[index + 1] = sobranteLimpio + (nuevasPaginas[index + 1] ? ' ' + nuevasPaginas[index + 1] : '');
        }
      }

      const resultado = nuevasPaginas.filter((p, i) => i === 0 || (p && p.trim() !== ''));
      setProtocoloPaginas(resultado.length > 0 ? resultado : ['']);
      setTimeout(() => {
        textareasRefs.current[index + 1]?.focus();
        textareasRefs.current[index + 1]?.setSelectionRange(0, 0);
      }, 50);
    } 
    // Si no excede nada, guarda el texto normal y elimina páginas vacías sobrantes o intermedias
    else {
      nuevasPaginas[index] = texto;
      const resultado = nuevasPaginas.filter((p, i) => i === 0 || (p && p.trim() !== ''));
      setProtocoloPaginas(resultado.length > 0 ? resultado : ['']);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Backspace') {
      const ta = e.currentTarget;
      if (ta.selectionStart === 0 && ta.selectionEnd === 0 && index > 0) {
        e.preventDefault();
        const nuevasPaginas = [...protocoloPaginas];
        const textoActual = nuevasPaginas[index] || '';
        const textoAnterior = nuevasPaginas[index - 1] || '';

        // Toma el texto de la página actual, súmalo al final de la página anterior
        nuevasPaginas[index - 1] = textoAnterior + textoActual;
        // Elimina la página actual del array (splice)
        nuevasPaginas.splice(index, 1);
        // Actualiza el estado
        setProtocoloPaginas([...nuevasPaginas]);

        setTimeout(() => {
          const prevTa = textareasRefs.current[index - 1];
          if (prevTa) {
            prevTa.focus();
            prevTa.setSelectionRange(textoAnterior.length, textoAnterior.length);
          }
        }, 50);
      }
    }
  };

  const imprimirConIframe = (html: string) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();
      iframe.contentWindow?.focus();
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (iframe.parentNode) {
            document.body.removeChild(iframe);
          }
        }, 1500);
      }, 500);
    } else {
      window.print();
    }
  };

  const handlePrint = () => {
    const lienzoEl = document.getElementById('lienzo-notarial');
    if (!lienzoEl) { window.print(); return; }

    const clone = lienzoEl.cloneNode(true) as HTMLElement;
    clone.style.transform = 'none';

    // 1. Mostrar texto espejo y ocultar UI interactiva
    clone.querySelectorAll('textarea').forEach((ta) => ta.remove());
    clone.querySelectorAll('.print\\:block, [class*="print:block"]').forEach((mirror) => {
      mirror.classList.remove('hidden');
      (mirror as HTMLElement).style.display = 'block';
    });
    clone.querySelectorAll('.guia-impresion, .print\\:hidden, .renglones-container').forEach((el) => el.remove());

    // 2. Limpieza de estilos inline inyectados por React en .z-20
    clone.querySelectorAll('.z-20').forEach((el) => {
      const hEl = el as HTMLElement;
      hEl.style.padding = '';
      hEl.style.margin = '';
      hEl.style.width = '';
      hEl.style.height = '';
      hEl.style.position = '';
      hEl.style.paddingTop = '';
      hEl.style.paddingBottom = '';
      hEl.style.paddingLeft = '';
      hEl.style.paddingRight = '';
      hEl.style.top = '';
      hEl.style.bottom = '';
      hEl.style.left = '';
      hEl.style.right = '';
      hEl.classList.remove('print:!p-0', 'print:!static', 'print:!h-auto', 'print:!overflow-visible');
    });

    // 3. Limpieza del DOM clonado y Aislamiento de Hojas
    const paginas = Array.from(clone.querySelectorAll('.hoja-notarial'));
    const paginasValidas: HTMLElement[] = [];

    paginas.forEach((pag) => {
      const divEspejo = pag.querySelector('.print\\:block') || pag.querySelector('[class*="print:block"]');
      if (!divEspejo || (divEspejo.textContent || '').trim() === '') {
        pag.remove();
      } else {
        paginasValidas.push(pag as HTMLElement);
      }
    });

    // Aislamiento del Lomo:
    if (paginasValidas.length > 0) {
      // Eliminar lomos en hojas posteriores (index > 0)
      paginasValidas.forEach((pag, idx) => {
        if (idx > 0) {
          pag.querySelectorAll('.texto-vertical-sello, .lomo-impresion, .nuevo-lomo-grid, .caja-fija-lomo').forEach((el) => el.remove());
        }
      });

      // En la primera hoja (index === 0)
      if (tipoDocumento === 'Sellado Notarial - Protocolo') {
        const pagina1 = paginasValidas[0];
        let lomo = pagina1.querySelector('.caja-fija-lomo, .nuevo-lomo-grid, .texto-vertical-sello, .lomo-impresion') as HTMLElement;

        if (!lomo) {
          lomo = document.createElement('div');
          pagina1.insertBefore(lomo, pagina1.firstChild);
        } else if (pagina1.firstChild !== lomo) {
          pagina1.insertBefore(lomo, pagina1.firstChild);
        }

        lomo.className = 'caja-fija-lomo';
        lomo.removeAttribute('style');
        lomo.innerHTML = `<span>${protocoloTextoVertical}</span>`;
      }
    }

    // Para plantillas de una sola hoja (Certificación, Concuerda, Legalización)
    if (tipoDocumento !== 'Sellado Notarial - Protocolo') {
      clone.classList.add('plantilla-unica-hoja');
      clone.classList.remove('shadow-2xl');
      clone.style.width = '216mm';
      clone.style.height = '330mm';
      clone.style.maxHeight = '330mm';
      clone.style.overflow = 'hidden';
      clone.style.boxSizing = 'border-box';
      clone.style.margin = '0 auto';
    }

    // Convertir todos los inputs a spans transfiriendo exactamente su className y contenido
    clone.querySelectorAll('input').forEach((inp) => {
      const span = document.createElement('span');
      span.textContent = inp.value || '\u00A0';
      span.className = inp.className;
      inp.parentNode?.replaceChild(span, inp);
    });

    // Capturar todos los estilos y links de Tailwind presentes en el documento principal
    const estilosTailwind = Array.from(
      document.head.querySelectorAll('style, link[rel="stylesheet"]')
    ).map((node) => node.outerHTML).join('\n');

    const titulo = `Documento Notarial - ${tipoDocumento}`;

    const htmlImpresion = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${titulo}</title>
  ${estilosTailwind}
  <style>
    /* ==========================================================================
       CONFIGURACIÓN DE PÁGINA FÍSICA ESTRICTA (OFICIO PARAGUAYO: 215.9mm x 355.6mm)
       ========================================================================== */
    @page { 
      size: 215.9mm 355.6mm; 
      margin: 0mm !important; 
    }
    
    html, body { 
      width: 215.9mm !important;
      height: 355.6mm !important;
      margin: 0mm !important; 
      padding: 0mm !important; 
      background: #ffffff !important; 
      -webkit-print-color-adjust: exact; 
      print-color-adjust: exact; 
      zoom: 1 !important; 
    }
    
    * { 
      box-sizing: border-box !important; 
    }

    #lienzo-notarial {
      width: 215.9mm !important;
      min-height: 355.6mm !important;
      margin: 0mm !important;
      padding: 0mm !important;
      box-shadow: none !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    /* HOJAS NOTARIALES (Oficio / Legal: 215.9mm x 355.6mm) */
    .hoja-notarial {
      width: 215.9mm !important;
      height: 355.6mm !important;
      max-height: 355.6mm !important;
      position: relative !important;
      overflow: hidden !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-after: always !important;
      break-after: page !important;
      margin: 0mm !important;
      padding: 0mm !important;
      display: block !important;
      box-sizing: border-box !important;
      background: #ffffff !important;
      border: none !important;
      box-shadow: none !important;
    }

    .hoja-notarial:last-child {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }

    /* PLANTILLAS DE UNA SOLA HOJA (Certificación, Concuerda, Legalización) */
    .plantilla-unica-hoja, .contenedor-hoja {
      width: 215.9mm !important;
      height: 355.6mm !important;
      max-height: 355.6mm !important;
      position: relative !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      background: #ffffff !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
      margin: 0mm !important;
      padding: 0mm !important;
      box-shadow: none !important;
    }

    /* CUERPO DE TEXTO DE PROTOCOLO (HOJA 0 - 25 RENGLONES EXACTOS A 8.47mm) */
    #notarial-cuerpo-texto,
    .notarial-cuerpo-texto {
      position: absolute !important;
      top: 42.55mm !important;
      left: 30.0mm !important;
      width: 155.9mm !important;
      height: 211.75mm !important;
      line-height: 8.47mm !important;
      margin: 0mm !important;
      padding: 0mm !important;
      display: block !important;
      box-sizing: border-box !important;
    }

    /* CAJA FIJA LOMO (Texto vertical de abajo hacia arriba anclado a 15mm) */
    .caja-fija-lomo {
      position: absolute !important;
      left: 15mm !important;
      top: 42.55mm !important;
      width: 12mm !important;
      height: 211.75mm !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      transform: none !important;
      z-index: 9999 !important;
      pointer-events: none !important;
    }

    .caja-fija-lomo span {
      writing-mode: vertical-rl !important;
      transform: rotate(180deg) !important;
      white-space: nowrap !important;
      text-transform: uppercase !important;
      color: #000000 !important;
      font-size: 7pt !important;
      font-weight: 900 !important;
      letter-spacing: 0.5mm !important;
      font-family: "Times New Roman", Times, serif !important;
    }

    /* TIPOGRAFÍA NOTARIAL DE ALTA PRECISIÓN (8.47mm de interlineado) */
    .print\\:block, [class*="print:block"] {
      font-family: "Times New Roman", Times, serif !important;
      font-size: 12pt !important;
      line-height: 8.47mm !important;
      text-align: justify !important;
      text-justify: inter-word !important;
      white-space: pre-wrap !important;
      color: #000000 !important;
      display: block !important;
      margin: 0mm !important;
      padding: 0mm !important;
    }

    /* CAMPOS DE FORMULARIO CONVERTIDOS A SPAN */
    .input-impresion {
      display: inline-block !important;
    }

    /* OCULTAR ELEMENTOS NO IMPRIMIBLES */
    .guia-impresion, .print\\:hidden, textarea, .renglones-container { 
      display: none !important; 
    }
  </style>
</head>
<body>
  ${clone.outerHTML}
  <script>
    window.onload = () => {
      window.focus();
      setTimeout(() => { window.print(); }, 250);
    };
  </script>
</body>
</html>`;

    try {
      const win = window.open('', '_blank');
      if (win) {
        win.document.open();
        win.document.write(htmlImpresion);
        win.document.close();
        win.focus();
        setTimeout(() => {
          try {
            win.print();
          } catch (e) {
            console.warn('Fallback a iframe tras error en popup:', e);
            imprimirConIframe(htmlImpresion);
          }
        }, 300);
        return;
      }
    } catch (e) {
      console.warn('Popup bloqueado, utilizando iframe oculto:', e);
    }

    imprimirConIframe(htmlImpresion);
  };

  const guionesSeguridad = '------------------------------------------------------------------------';

  // Función para saltar al siguiente input o al botón de imprimir al presionar Enter
  const handleEnterKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const container = document.getElementById('lienzo-notarial');
      if (!container) return;
      
      const inputs = Array.from(container.querySelectorAll('input.input-impresion:not([readOnly])')) as HTMLInputElement[];
      const index = inputs.indexOf(e.currentTarget);
      
      if (index > -1) {
        if (index < inputs.length - 1) {
          // Si hay más inputs, salta al siguiente
          inputs[index + 1].focus();
        } else {
          // Si es el último input, salta al botón de imprimir
          const btnImprimir = document.getElementById('btn-imprimir-hoja');
          if (btnImprimir) {
            btnImprimir.focus();
          }
        }
      }
    }
  };

  return (
    <div id="contenedor-principal-notarial" className="min-h-screen bg-slate-900/95 text-slate-100 flex flex-col font-sans print:min-h-0 print:bg-white print:block print:m-0 print:p-0">
      {/* Estilos de Paginación Estricta de 25 líneas con Simetría Doble Faz (Anverso/Reverso) */}
      <style>{`
        .lomo-impresion, .texto-vertical-sello {
          position: absolute !important;
          left: 15mm !important;
          top: 42.55mm !important;
          width: 12mm !important;
          height: 211.75mm !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          writing-mode: horizontal-tb !important;
          transform: none !important;
          z-index: 100 !important;
          pointer-events: none !important;
        }
        .texto-vertical-contenido {
          writing-mode: vertical-rl !important;
          transform: rotate(180deg) !important;
          display: inline-block !important;
          white-space: nowrap !important;
        }
        #notarial-cuerpo-texto, .notarial-cuerpo-texto {
          position: absolute !important;
          top: 42.55mm !important;
          left: 30.0mm !important;
          width: 155.9mm !important;
          height: 211.75mm !important;
          line-height: 8.47mm !important;
          margin: 0mm !important;
          padding: 0mm !important;
          box-sizing: border-box !important;
        }
        @media print {
          @page {
            size: 215.9mm 355.6mm;
            margin: 0mm !important;
          }

          html, body {
            width: 215.9mm !important;
            height: 355.6mm !important;
            margin: 0mm !important;
            padding: 0mm !important;
            background: #ffffff !important;
            zoom: 1 !important;
          }

          /* Box Sizing Estricto */
          *, *::before, *::after,
          #lienzo-notarial,
          .print-container,
          .documento-notarial,
          .contenedor-maestro-impresion,
          .pagina-notarial,
          .pagina-anverso,
          .pagina-reverso,
          .hoja-notarial {
            box-sizing: border-box !important;
          }

          /* Ocultar absolutamente la interfaz fuera del lienzo para que (0,0) coincida con el borde físico de la hoja */
          header,
          .opciones-auxiliares-notarial,
          .barra-controles-notarial,
          .print\\:hidden,
          [class*="print:hidden"],
          textarea,
          .renglones-container,
          .texto-lateral-izq,
          .guia-impresion {
            display: none !important;
            visibility: hidden !important;
          }

          #contenedor-principal-notarial,
          #envoltorio-lienzo-notarial,
          #lienzo-notarial,
          #contenedor-paginas-protocolo {
            display: block !important;
            position: relative !important;
            top: 0mm !important;
            left: 0mm !important;
            width: 215.9mm !important;
            min-height: 355.6mm !important;
            margin: 0mm !important;
            padding: 0mm !important;
            background: #ffffff !important;
            box-shadow: none !important;
            transform: none !important;
          }

          .hoja-notarial,
          .contenedor-hoja {
            display: block !important;
            position: relative !important;
            top: 0mm !important;
            left: 0mm !important;
            width: 215.9mm !important;
            height: 355.6mm !important;
            min-height: 355.6mm !important;
            max-height: 355.6mm !important;
            margin: 0mm !important;
            padding: 0mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-shadow: none !important;
            transform: none !important;
            overflow: hidden !important;
          }

          /* Hoja 0: Cuerpo de Texto de Protocolo (25 renglones exactos) */
          #notarial-cuerpo-texto,
          .notarial-cuerpo-texto {
            display: block !important;
            visibility: visible !important;
            position: absolute !important;
            top: 42.55mm !important;
            left: 30.0mm !important;
            width: 155.9mm !important;
            height: 211.75mm !important;
            line-height: 8.47mm !important;
            margin: 0mm !important;
            padding: 0mm !important;
            color: #000000 !important;
          }

          /* Controlar el Sello Vertical Exclusivamente desde CSS (Lectura de abajo hacia arriba) */
          .texto-vertical-sello,
          .lomo-impresion {
            position: absolute !important;
            top: 42.55mm !important;
            left: 15mm !important;
            height: 211.75mm !important;
            width: 12mm !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            writing-mode: horizontal-tb !important;
            transform: none !important;
            z-index: 100 !important;
            color: #64748b !important;
            font-family: sans-serif !important;
            font-size: 7pt !important;
            font-weight: 900 !important;
            letter-spacing: 0.5mm !important;
            text-transform: uppercase !important;
            pointer-events: none !important;
            margin: 0mm !important;
            padding: 0mm !important;
            float: none !important;
          }
          .texto-vertical-contenido {
            writing-mode: vertical-rl !important;
            transform: rotate(180deg) !important;
            display: inline-block !important;
            white-space: nowrap !important;
          }

          /* Asegurar renderizado único: Solo visible en la primera página */
          .hoja-notarial:not(:first-child) .texto-vertical-sello,
          .hoja-notarial:not(:first-child) .lomo-impresion,
          .pagina-reverso .texto-vertical-sello,
          .pagina-reverso .lomo-impresion {
            display: none !important;
            visibility: hidden !important;
          }

          /* Evitar que contenedores vacíos o elementos ocultos generen páginas de relleno */
          .pagina-anverso:empty, .pagina-reverso:empty, .hoja-notarial:empty {
            display: none !important;
          }

          /* Salto limpio entre carillas: a las páginas no finales sí, a la última no */
          .pagina-anverso:not(:last-child),
          .pagina-reverso:not(:last-child),
          .hoja-notarial:not(:last-child) {
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .pagina-anverso:last-child,
          .pagina-reverso:last-child,
          .hoja-notarial:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          .print\\:block, [class*="print:block"] {
            display: block !important;
          }

          .guia-linea {
            border-bottom-color: transparent !important;
          }
          .input-impresion {
            position: absolute !important;
            border: none !important;
            background: transparent !important;
            color: #000000 !important;
            font-weight: bold !important;
            box-shadow: none !important;
            padding: 0mm !important;
            margin: 0mm !important;
          }
        }

        .pagina-notarial {
          position: relative;
          width: 215.9mm;
          min-height: 355.6mm;
          background: #ffffff;
          overflow: hidden;
          box-sizing: border-box;
        }
        /* ANVERSO (Impar) */
        .pagina-notarial.anverso .contenido-pagina {
          position: absolute;
          top: 42.55mm;
          left: 30.0mm;
          width: 155.9mm;
          line-height: 8.47mm; /* 25 renglones exactos */
        }
        /* REVERSO (Par) */
        .pagina-notarial.reverso .contenido-pagina {
          position: absolute;
          top: 42.55mm;
          left: 25.0mm;
          width: 155.9mm;
          line-height: 8.47mm;
        }
        .renglones-container {
          position: absolute;
          top: 42.55mm;
          left: 30.0mm;
          width: 155.9mm;
          height: 211.75mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          pointer-events: none;
        }
        .linea-renglon {
          display: flex;
          align-items: center;
          width: 100%;
          height: 8.47mm;
        }
        .nro-renglon {
          font-family: monospace;
          font-size: 8pt;
          color: #94a3b8;
          width: 6mm;
          text-align: right;
          padding-right: 2mm;
        }
        .guia-linea {
          flex: 1;
          border-bottom: 1px dotted #cbd5e1;
          height: 0;
        }
        .texto-lateral-izq {
          position: absolute;
          left: 15mm;
          top: 42.55mm;
          writing-mode: vertical-rl;
          transform: rotate(180deg);
          text-align: center;
          height: 211.75mm;
          font-family: sans-serif;
          font-size: 7pt;
          font-weight: 900;
          letter-spacing: 0.5mm;
          color: #64748b;
          text-transform: uppercase;
          pointer-events: none;
        }
      `}</style>

      {/* Cabecera Principal Unificada */}
      <header className="bg-slate-900 text-white p-6 md:p-8 rounded-[2.5rem] shadow-xl border border-slate-800 m-4 md:m-6 flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative overflow-hidden print:hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="relative z-10 flex items-center gap-3">
          {onVolver && (
            <button
              onClick={onVolver}
              type="button"
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors border border-slate-700"
            >
              ← Volver
            </button>
          )}
          <div className="w-10 h-10 rounded-2xl bg-white/10 text-[#FF3131] flex items-center justify-center shrink-0 border border-white/10">
            <Stamp className="w-5 h-5 text-[#FF3131]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2 font-serif">
              <span>Sección Notarial</span>
              <span className="px-2.5 py-0.5 bg-[#FF3131] text-white text-[9px] font-black uppercase tracking-widest rounded-lg">
                O.L.G.A.
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              Plantillas oficiales de la Corte Suprema de Justicia generadas puramente en HTML/CSS milimétrico.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto relative z-10">
          {/* Selector de Tipo de Documento */}
          <div className="flex items-center gap-2 bg-slate-800 px-3.5 py-2 rounded-xl border border-slate-700">
            <label htmlFor="tipo-doc-select" className="text-xs font-bold text-slate-400">
              Plantilla:
            </label>
            <select
              id="tipo-doc-select"
              value={tipoDocumento}
              onChange={(e) => handleCambiarTipoDocumento(e.target.value as TipoDocumentoNotarial)}
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
            >
              <option value="Sellado Notarial - Protocolo" className="bg-slate-900 text-white">0. Sellado Notarial - Protocolo</option>
              <option value="Certificación de Firmas" className="bg-slate-900 text-white">1. Certificación de Firmas</option>
              <option value="Concuerda" className="bg-slate-900 text-white">2. Concuerda (Hoja de Seguridad)</option>
              <option value="Legalización" className="bg-slate-900 text-white">3. Legalización Notarial</option>
            </select>
          </div>
        </div>
      </header>

      {/* Opciones Auxiliares de Formato (No imprimible) */}
      <div className="opciones-auxiliares-notarial bg-slate-800/80 border-y border-slate-700/80 px-6 py-2.5 text-xs text-slate-300 print:hidden flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-200">
          <input 
            type="checkbox" 
            checked={rellenoGuiones} 
            onChange={(e) => setRellenoGuiones(e.target.checked)}
            className="w-4 h-4 accent-[#FF3131] rounded cursor-pointer"
          />
          <span>Autorrellenar líneas vacías con guiones (----)</span>
        </label>
        {tipoDocumento === 'Sellado Notarial - Protocolo' && (
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold text-[10px]">Texto Lomo:</span>
            <input
              type="text"
              value={protocoloTextoVertical}
              onChange={(e) => setProtocoloTextoVertical(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white text-[10px] px-2 py-1 rounded w-64 outline-none focus:border-[#FF3131]"
            />
          </div>
        )}
      </div>

      {/* Contenedor del Lienzo Digital (Oficio / Legal: 215.9mm x 355.6mm) */}
      <div id="envoltorio-lienzo-notarial" className="flex-1 flex flex-col items-center justify-start p-4 md:p-8 overflow-auto bg-slate-950 print:p-0 print:m-0 print:block print:bg-white">
        {/* Barra Unificada de Control Notarial (Calibración, Tipografía, Espaciado, Guía, Guardar e Imprimir) */}
        <div className="barra-controles-notarial mb-4 bg-slate-900 border border-slate-700/80 rounded-2xl p-3 md:px-5 md:py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-200 shadow-xl print:hidden w-full max-w-7xl">
          {/* Bloque Izquierdo: Calibración, Tipografía y Espaciados */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Calibrador de Impresora (Offset X / Y) */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-700/70">
              <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1" title="Calibrador milimétrico de impresora">
                <Sliders className="w-3.5 h-3.5" />
                Offset:
              </span>
              <div className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded-lg border border-slate-700">
                <span className="text-[10px] text-slate-400">X:</span>
                <button 
                  type="button"
                  onClick={() => setOffsetX(offsetX - 1)} 
                  title="Restar 1mm horizontal"
                  className="px-1.5 py-0.5 hover:bg-slate-700 rounded text-slate-300 font-bold hover:text-white"
                >
                  -
                </button>
                <span className="w-7 text-center font-mono text-[11px] text-amber-300 font-bold">{offsetX}mm</span>
                <button 
                  type="button"
                  onClick={() => setOffsetX(offsetX + 1)} 
                  title="Sumar 1mm horizontal"
                  className="px-1.5 py-0.5 hover:bg-slate-700 rounded text-slate-300 font-bold hover:text-white"
                >
                  +
                </button>
              </div>
              <div className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded-lg border border-slate-700">
                <span className="text-[10px] text-slate-400">Y:</span>
                <button 
                  type="button"
                  onClick={() => setOffsetY(offsetY - 1)} 
                  title="Restar 1mm vertical"
                  className="px-1.5 py-0.5 hover:bg-slate-700 rounded text-slate-300 font-bold hover:text-white"
                >
                  -
                </button>
                <span className="w-7 text-center font-mono text-[11px] text-amber-300 font-bold">{offsetY}mm</span>
                <button 
                  type="button"
                  onClick={() => setOffsetY(offsetY + 1)} 
                  title="Sumar 1mm vertical"
                  className="px-1.5 py-0.5 hover:bg-slate-700 rounded text-slate-300 font-bold hover:text-white"
                >
                  +
                </button>
              </div>
            </div>

            {/* Separador */}
            <div className="h-4 w-px bg-slate-700 hidden lg:block"></div>

            {/* Tipografía (Fuente, Tamaño, A-/A+) */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                <Type className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Fuente</span>
              </span>
              <select
                value={fontFamilyGlobal}
                onChange={(e) => setFontFamilyGlobal(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-medium focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="Arial, Helvetica, sans-serif">Arial</option>
                <option value='"Times New Roman", Times, serif'>Times New Roman</option>
                <option value='"Courier New", Courier, monospace'>Courier New</option>
                <option value="Georgia, serif">Georgia</option>
              </select>

              <select
                value={fontSizeGlobal}
                onChange={(e) => setFontSizeGlobal(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="12px">12 px</option>
                <option value="13px">13 px</option>
                <option value="14px">14 px</option>
                <option value="15px">15 px</option>
                <option value="16px">16 px</option>
                <option value="18px">18 px</option>
                <option value="20px">20 px</option>
              </select>

              <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    const sizes = ['12px', '13px', '14px', '15px', '16px', '18px', '20px'];
                    const idx = sizes.indexOf(fontSizeGlobal);
                    if (idx > 0) setFontSizeGlobal(sizes[idx - 1]);
                  }}
                  title="Reducir tamaño (A-)"
                  className="px-1.5 py-0.5 hover:bg-slate-700 rounded text-slate-300 font-bold hover:text-white transition-colors"
                >
                  A-
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const sizes = ['12px', '13px', '14px', '15px', '16px', '18px', '20px'];
                    const idx = sizes.indexOf(fontSizeGlobal);
                    if (idx !== -1 && idx < sizes.length - 1) setFontSizeGlobal(sizes[idx + 1]);
                  }}
                  title="Aumentar tamaño (A+)"
                  className="px-1.5 py-0.5 hover:bg-slate-700 rounded text-slate-300 font-bold hover:text-white transition-colors"
                >
                  A+
                </button>
              </div>
            </div>

            {/* Separador */}
            <div className="h-4 w-px bg-slate-700 hidden lg:block"></div>

            {/* Espaciado vertical (Interlineado) */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-bold text-[11px] flex items-center gap-1" title="Espaciado vertical / Interlineado">
                <MoveVertical className="w-3.5 h-3.5 text-sky-400" />
                Líneas:
              </span>
              <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                <button
                  type="button"
                  onClick={() => setInterlineadoGlobal((prev) => Math.max(8.0, Number((prev - 0.2).toFixed(1))))}
                  title="Reducir interlineado (-0.2mm)"
                  className="px-1.5 py-0.5 hover:bg-slate-700 rounded text-slate-300 font-bold hover:text-white transition-colors"
                >
                  -
                </button>
                <span className="w-12 text-center font-mono text-[11px] text-sky-300 font-bold">
                  {interlineadoGlobal.toFixed(1)}mm
                </span>
                <button
                  type="button"
                  onClick={() => setInterlineadoGlobal((prev) => Math.min(16.0, Number((prev + 0.2).toFixed(1))))}
                  title="Aumentar interlineado (+0.2mm)"
                  className="px-1.5 py-0.5 hover:bg-slate-700 rounded text-slate-300 font-bold hover:text-white transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Margen horizontal (Indentación In/Out) */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-bold text-[11px] flex items-center gap-1" title="Margen horizontal / Sangría In-Out">
                <MoveHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                Margen H:
              </span>
              <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                <button
                  type="button"
                  onClick={() => setMargenHorizontal((prev) => Math.max(-25, prev - 1))}
                  title="Desplazar a la izquierda (-1mm)"
                  className="px-1.5 py-0.5 hover:bg-slate-700 rounded text-slate-300 font-bold hover:text-white transition-colors"
                >
                  ◄
                </button>
                <span className="w-11 text-center font-mono text-[11px] text-emerald-300 font-bold">
                  {margenHorizontal > 0 ? `+${margenHorizontal}` : margenHorizontal}mm
                </span>
                <button
                  type="button"
                  onClick={() => setMargenHorizontal((prev) => Math.min(25, prev + 1))}
                  title="Desplazar a la derecha (+1mm)"
                  className="px-1.5 py-0.5 hover:bg-slate-700 rounded text-slate-300 font-bold hover:text-white transition-colors"
                >
                  ►
                </button>
              </div>
              {margenHorizontal !== 0 && (
                <button
                  type="button"
                  onClick={() => setMargenHorizontal(0)}
                  title="Restablecer margen a 0mm"
                  className="text-[10px] text-slate-400 hover:text-amber-400 underline ml-0.5"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Bloque Derecho: Acciones (Guía, Guardar e Imprimir) */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Botón Guía Visual */}
            <button
              type="button"
              onClick={() => setMostrarGuia(!mostrarGuia)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                mostrarGuia 
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 hover:bg-blue-600/30' 
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              {mostrarGuia ? <Eye className="w-3.5 h-3.5 text-blue-400" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>{mostrarGuia ? 'Guía Visible' : 'Guía Oculta'}</span>
            </button>

            {/* Botón Guardar Configuración */}
            <button
              type="button"
              onClick={handleGuardarConfiguracion}
              title={`Guardar tipografía, calibración y márgenes para "${tipoDocumento}"`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm ${
                guardadoFeedback
                  ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/60 shadow-emerald-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-amber-500/40 hover:border-amber-400 hover:text-amber-300'
              }`}
            >
              {guardadoFeedback ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>¡Guardado!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 text-amber-400" />
                  <span>Guardar Config.</span>
                </>
              )}
            </button>

            {/* Botón Imprimir Hoja */}
            <button
              id="btn-imprimir-hoja"
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-1.5 bg-[#FF3131] hover:bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-red-600/20 transition-all hover:scale-105 active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Hoja</span>
            </button>
          </div>
        </div>

        <div 
          id="lienzo-notarial"
          style={{
            width: '215.9mm',
            minHeight: '355.6mm',
            transform: `translate(${offsetX}mm, ${offsetY}mm)`,
            transition: 'transform 0.1s ease-out'
          }}
          className={`${tipoDocumento === 'Sellado Notarial - Protocolo' ? 'relative flex flex-col items-center p-0' : 'bg-white text-black shadow-2xl relative p-0 flex flex-col justify-between'} box-border font-serif text-[12pt] leading-relaxed selection:bg-red-100`}
        >
          {/* ESTILOS TIPOGRÁFICOS Y DE CALIBRACIÓN GLOBALES PARA LAS 4 PLANTILLAS */}
          <style>{`
            .input-impresion,
            #lienzo-notarial input,
            #lienzo-notarial textarea,
            #lienzo-notarial .print\\:block {
              font-family: ${fontFamilyGlobal} !important;
              font-size: ${fontSizeGlobal} !important;
            }

            /* Ajuste dinámico de interlineado (Espaciado Vertical) */
            #lienzo-notarial textarea,
            #lienzo-notarial .print\\:block,
            #notarial-cuerpo-texto,
            .notarial-cuerpo-texto,
            .linea-renglon,
            .contenido-pagina,
            .ajuste-interlineado-datos {
              line-height: ${interlineadoGlobal}mm !important;
            }

            /* Ajuste dinámico de margen horizontal (Indentación In/Out) */
            .ajuste-horizontal-datos,
            .capa-datos-concuerda,
            .capa-datos-certificacion {
              transform: translateX(${margenHorizontal}mm) !important;
            }

            @media print {
              .input-impresion,
              #lienzo-notarial input,
              #lienzo-notarial textarea,
              #lienzo-notarial .print\\:block,
              .print\\:block {
                font-family: ${fontFamilyGlobal} !important;
                font-size: ${fontSizeGlobal} !important;
              }

              #lienzo-notarial textarea,
              #lienzo-notarial .print\\:block,
              #notarial-cuerpo-texto,
              .notarial-cuerpo-texto,
              .linea-renglon,
              .contenido-pagina,
              .ajuste-interlineado-datos {
                line-height: ${interlineadoGlobal}mm !important;
              }

              .ajuste-horizontal-datos,
              .capa-datos-concuerda,
              .capa-datos-certificacion {
                transform: translateX(${margenHorizontal}mm) !important;
              }
            }
          `}</style>
          {/* MARCO EXTERIOR GUÍA (Solo visible en pantalla si mostrarGuia es true y no es Protocolo) */}
          {tipoDocumento !== 'Sellado Notarial - Protocolo' && (
            <div className={`absolute inset-4 border border-dashed border-slate-300 pointer-events-none transition-opacity duration-300 ${mostrarGuia ? 'opacity-100' : 'opacity-0'} guia-impresion`}></div>
          )}

          {/* ========================================================================= */}
          {/* PLANTILLA 1: CERTIFICACIÓN DE FIRMAS (COORDENADAS VML EXACTAS AL MILÍMETRO) */}
          {/* ========================================================================= */}
          {tipoDocumento === 'Certificación de Firmas' && (
            <div className="contenedor-hoja relative w-[215.9mm] h-[355.6mm]" style={{ width: '215.9mm', height: '355.6mm' }}>
              {/* ESTILOS FORZADOS Y CLASES DE POSICIONAMIENTO PARA CERTIFICACIÓN DE FIRMAS */}
              <style>{`
                /* Tipografía dinámica para los campos de Certificación de Firmas */
                .capa-datos-certificacion input,
                .capa-datos-certificacion span,
                .pos-cert-firmas-t1, .pos-cert-firmas-t2, .pos-cert-firmas-t3,
                .pos-cert-tramo1, .pos-cert-tramo2,
                .pos-cert-inciso-a-nom, .pos-cert-inciso-a-doc, .pos-cert-inciso-a-dom,
                .pos-cert-inciso-b-nom, .pos-cert-inciso-b-doc, .pos-cert-inciso-b-dom,
                .pos-cert-inciso-c-nom, .pos-cert-inciso-c-doc, .pos-cert-inciso-c-dom,
                .pos-cert-inciso-d-nom, .pos-cert-inciso-d-doc, .pos-cert-inciso-d-dom,
                .pos-cert-folio1, .pos-cert-folio2, .pos-cert-tomo,
                .pos-cert-hora, .pos-cert-dia, .pos-cert-mes, .pos-cert-anio {
                  font-size: ${fontSizeGlobal} !important;
                  font-family: ${fontFamilyGlobal} !important;
                }

                /* Coordenadas absolutas milimétricas para Certificación de Firmas (215.9mm x 355.6mm) */
                .pos-cert-firmas-t1, #titular-notaria-cf { top: 40mm; left: 100mm; width: 75.0mm; height: 6mm; }
                .pos-cert-firmas-t2, #registro-notaria-cf { top: 46mm; left: 68mm; width: 33.0mm; height: 6mm; }
                .pos-cert-firmas-t3, #ciudad-registro-cf { top: 46mm; left: 136mm; width: 50.0mm; height: 6mm; }

                .pos-cert-tramo1, #tipo-contrato-cf { top: 64mm; left: 160mm; width: 35.0mm; height: 6mm; }
                .pos-cert-tramo2, #objeto-acto-cf { top: 70mm; left: 30mm; width: 155.0mm; height: 6mm; }

                .pos-cert-inciso-a-nom, #compareciente-nombre-1 { top: 75mm; left: 36mm; width: 95.0mm; height: 6mm; }
                .pos-cert-inciso-a-doc, #compareciente-cedula-1 { top: 75mm; left: 153mm; width: 36.0mm; height: 6mm; }
                .pos-cert-inciso-a-dom, #compareciente-ciudad-1 { top: 81mm; left: 62mm; width: 124.0mm; height: 6mm; }

                .pos-cert-inciso-b-nom, #compareciente-nombre-2 { top: 88mm; left: 36mm; width: 95.0mm; height: 6mm; }
                .pos-cert-inciso-b-doc, #compareciente-cedula-2 { top: 88mm; left: 153mm; width: 36.0mm; height: 6mm; }
                .pos-cert-inciso-b-dom, #compareciente-ciudad-2 { top: 94mm; left: 62mm; width: 124.0mm; height: 6mm; }

                .pos-cert-inciso-c-nom { top: 101mm; left: 36mm; width: 95.0mm; height: 6mm; }
                .pos-cert-inciso-c-doc { top: 101mm; left: 153mm; width: 36.0mm; height: 6mm; }
                .pos-cert-inciso-c-dom { top: 107mm; left: 62mm; width: 124.0mm; height: 6mm; }

                .pos-cert-inciso-d-nom { top: 114mm; left: 36mm; width: 95.0mm; height: 6mm; }
                .pos-cert-inciso-d-doc { top: 114mm; left: 153mm; width: 36.0mm; height: 6mm; }
                .pos-cert-inciso-d-dom { top: 120mm; left: 62mm; width: 124.0mm; height: 6mm; }

                .pos-cert-folio1 { top: 128mm; left: 81mm; width: 14.0mm; height: 6mm; }
                .pos-cert-folio2 { top: 128mm; left: 99mm; width: 14.0mm; height: 6mm; }
                .pos-cert-tomo   { top: 128mm; left: 118mm; width: 22.0mm; height: 6mm; }

                .pos-cert-anio, #anio-letras-cierre { top: 136mm; left: 64mm; width: 60.0mm; height: 6mm; }
                .pos-cert-hora, #hora-certificacion { top: 142.5mm; left: 83mm; width: 18.0mm; height: 6mm; }
                .pos-cert-dia, #dia-certificacion   { top: 142.5mm; left: 123mm; width: 13.0mm; height: 6mm; }
                .pos-cert-mes, #mes-certificacion   { top: 142.5mm; left: 146mm; width: 44.0mm; height: 6mm; }

                @media print {
                  @page { size: 215.9mm 355.6mm; margin: 0mm !important; }
                  body, html { margin: 0mm !important; padding: 0mm !important; }
                  
                  /* Forzar al contenedor a mantener su marco de referencia */
                  .contenedor-hoja {
                    position: relative !important;
                    width: 215.9mm !important;
                    height: 355.6mm !important;
                    display: block !important;
                    margin: 0mm !important;
                    padding: 0mm !important;
                  }
                  
                  /* Evitar que el CSS base convierta los inputs absolutos en estáticos */
                  .input-impresion {
                    position: absolute !important;
                    border: none !important;
                    background: transparent !important;
                    color: black !important;
                    box-shadow: none !important;
                    font-size: ${fontSizeGlobal} !important;
                    font-family: ${fontFamilyGlobal} !important;
                  }
                }
              `}</style>

              {/* CAPA DE GUÍA VISUAL (Solo visible en pantalla, no se imprime en hoja oficial) */}
              <div className={`absolute inset-0 pointer-events-none z-0 print:hidden transition-opacity duration-300 ${mostrarGuia ? 'opacity-100' : 'opacity-0'}`}>
                {/* Cabecera preimpresa */}
                <div className="absolute flex items-start justify-between border-b-2 border-black pb-2" style={{ top: '15mm', left: '20mm', right: '20mm' }}>
                  <div>
                    <h2 className="font-black text-sm uppercase tracking-wider text-slate-700">CORTE SUPREMA DE JUSTICIA</h2>
                    <p className="text-[11px] font-bold text-slate-600">REPÚBLICA DEL PARAGUAY</p>
                    <p className="text-[10px] font-bold mt-0.5 text-[#FF3131]">CERTIFICACIÓN DE FIRMAS (Art. 152 - Ley 879) (Hoja Anexa)</p>
                  </div>
                  <div className="border border-slate-400 p-1.5 text-center w-20 h-16 flex flex-col items-center justify-center bg-slate-50 shrink-0">
                    <span className="text-[9px] font-mono font-bold text-slate-600">QR PJE</span>
                    <span className="text-[8px] text-slate-500">SERIE-2026</span>
                  </div>
                </div>

                {/* Textos guía preimpresos del cuerpo */}
                <div className="absolute text-slate-400 text-[12.5px] font-normal" style={{ top: '82.0mm', left: '25.0mm' }}>En mi carácter de Escribano Público</div>
                <div className="absolute text-slate-400 text-[12.5px] font-normal" style={{ top: '82.0mm', left: '175.0mm' }}>del</div>

                <div className="absolute text-slate-400 text-[12.5px] font-normal" style={{ top: '93.5mm', left: '25.0mm' }}>Registro Notarial Nº</div>
                <div className="absolute text-slate-400 text-[12.5px] font-normal" style={{ top: '93.5mm', left: '101.0mm' }}>con asiento en</div>

                <div className="absolute text-slate-400 text-[12.5px] font-normal" style={{ top: '104.0mm', left: '25.0mm' }}>y en uso de las atribuciones que me acuerda la legislación vigente:</div>

                <div className="absolute text-slate-400 text-[14px] font-black tracking-widest text-center" style={{ top: '114.5mm', left: '25.0mm', width: '161.0mm' }}>C E R T I F I C O</div>

                <div className="absolute text-slate-400 text-[12.5px] font-normal" style={{ top: '127.0mm', left: '25.0mm' }}>
                  <span className="font-bold text-slate-500">PRIMERO:</span> Que las firmas que obran en el documento anexo inserto en
                </div>
                <div className="absolute text-slate-400 text-[12.5px] font-normal" style={{ top: '138.0mm', left: '102.0mm' }}>han sido puestas en mi presencia por:</div>

                {/* Inciso a */}
                <div className="absolute text-slate-400 text-[12.5px] font-bold" style={{ top: '148.5mm', left: '25.0mm' }}>a)</div>
                <div className="absolute text-slate-400 text-[12.5px] font-normal" style={{ top: '148.5mm', left: '128.0mm' }}>documento</div>
                <div className="absolute text-slate-400 text-[12.5px] font-normal" style={{ top: '159.5mm', left: '25.0mm' }}>con domicilio en</div>

                {/* Inciso b */}
                <div className="absolute text-slate-400 text-[12.5px] font-bold" style={{ top: '169.5mm', left: '25.0mm' }}>b)</div>
                <div className="absolute text-slate-400 text-[12.5px] font-normal" style={{ top: '169.5mm', left: '128.0mm' }}>documento</div>
                <div className="absolute text-slate-400 text-[12.5px] font-normal" style={{ top: '180.0mm', left: '25.0mm' }}>con domicilio en</div>

                {/* Inciso c */}
                <div className="absolute text-slate-400 text-[12.5px] font-bold" style={{ top: '190.2mm', left: '25.0mm' }}>c)</div>
                <div className="absolute text-slate-400 text-[12.5px] font-normal" style={{ top: '190.2mm', left: '128.0mm' }}>documento</div>
                <div className="absolute text-slate-400 text-[12.5px] font-normal" style={{ top: '200.7mm', left: '25.0mm' }}>con domicilio en</div>

                {/* Inciso d */}
                <div className="absolute text-slate-400 text-[12.5px] font-bold" style={{ top: '210.7mm', left: '25.0mm' }}>d)</div>
                <div className="absolute text-slate-400 text-[12.5px] font-normal" style={{ top: '210.7mm', left: '128.0mm' }}>documento</div>
                <div className="absolute text-slate-400 text-[12.5px] font-normal" style={{ top: '221.2mm', left: '25.0mm' }}>con domicilio en</div>

                {/* Punto SEGUNDO */}
                <div className="absolute text-slate-400 text-[12.5px] font-normal" style={{ top: '232.0mm', left: '25.0mm' }}>
                  <span className="font-bold text-slate-500">SEGUNDO:</span> Que las firmas de las mencionadas personas fueron registradas en el libro correspondiente
                </div>
                <div className="absolute text-slate-400 text-[12.5px] font-normal" style={{ top: '237.5mm', left: '25.0mm' }}>en el folio</div>
                <div className="absolute text-slate-400 text-[12.5px] font-normal" style={{ top: '237.5mm', left: '96.0mm' }}>,</div>
                <div className="absolute text-slate-400 text-[12.5px] font-normal" style={{ top: '237.5mm', left: '114.5mm' }}>,</div>
                <div className="absolute text-slate-400 text-[12.5px] font-normal" style={{ top: '237.5mm', left: '141.0mm' }}>, en donde se halla consignado el motivo de la certificación.</div>

                {/* Punto TERCERO */}
                <div className="absolute text-slate-400 text-[12.5px] font-normal" style={{ top: '250.0mm', left: '25.0mm', right: '25.0mm' }}>
                  <span className="font-bold text-slate-500">TERCERO:</span> Que la presente actuación no autentica la veracidad de los términos del contrato, ni juzga su forma, ni su contenido.
                </div>

                {/* Punto CUARTO */}
                <div className="absolute text-slate-400 text-[12.5px] font-normal" style={{ top: '264.0mm', left: '25.0mm', right: '25.0mm' }}>
                  <span className="font-bold text-slate-500">CUARTO:</span> Que esta certificación la efectúo a requerimiento de las personas nombradas en el punto Primero, siendo las
                </div>
                <div className="absolute text-slate-400 text-[12.5px] font-normal" style={{ top: '275.0mm', left: '96.0mm' }}>horas del día</div>
                <div className="absolute text-slate-400 text-[12.5px] font-normal" style={{ top: '275.0mm', left: '135.0mm' }}>de</div>
                <div className="absolute text-slate-400 text-[12.5px] font-normal" style={{ top: '285.5mm', left: '42.0mm' }}>del año.</div>
                <div className="absolute text-slate-400 text-[12.5px] font-normal" style={{ top: '285.5mm', left: '184.0mm' }}>.-</div>

                {/* Pie de firma y sello */}
                <div className="absolute text-center flex flex-col items-center" style={{ top: '302.0mm', left: '58.0mm', width: '100.0mm' }}>
                  <div className="w-60 border-b border-slate-300 mb-1"></div>
                  <p className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Firma y Sello del Notario</p>
                </div>
              </div>

              {/* CAPA DE DATOS (Interacción y posicionamiento milimétrico estricto) */}
              <div 
                className="capa-datos-certificacion absolute inset-0 z-10" 
                style={{ fontSize: fontSizeGlobal, fontFamily: fontFamilyGlobal }}
              >
                {/* Cabecera: TITULAR, Registro, Ciudad Registro */}
                <input 
                  id="titular-notaria-cf"
                  type="text" 
                  value={firmasT1} 
                  onChange={(e) => setFirmasT1(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="TITULAR.-" 
                  style={{ top: '40mm', left: '100mm', width: '75mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-firmas-t1" 
                />
                <input 
                  id="registro-notaria-cf"
                  type="text" 
                  value={firmasT2} 
                  onChange={(e) => setFirmasT2(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="1.292.-" 
                  style={{ top: '46mm', left: '68mm', width: '33mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-firmas-t2" 
                />
                <input 
                  id="ciudad-registro-cf"
                  type="text" 
                  value={firmasT3} 
                  onChange={(e) => setFirmasT3(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="ITAKYRY.-" 
                  style={{ top: '46mm', left: '136mm', width: '50mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-firmas-t3" 
                />

                {/* Acto: Tipo de contrato y Objeto del acto */}
                <input 
                  id="tipo-contrato-cf"
                  type="text" 
                  value={tramoPrimero1} 
                  onChange={(e) => setTramoPrimero1(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="CONTRATO PRIVADO" 
                  style={{ top: '64mm', left: '160mm', width: '48mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-tramo1" 
                />
                <input 
                  id="objeto-acto-cf"
                  type="text" 
                  value={tramoPrimero2} 
                  onChange={(e) => setTramoPrimero2(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="DE COMPRAVENTA..." 
                  style={{ top: '70mm', left: '30mm', width: '155mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-tramo2" 
                />

                {/* Compareciente 1 (INCISO A): Nombre, Cédula, Ciudad */}
                <input 
                  id="compareciente-nombre-1"
                  type="text" 
                  value={incisoANombre} 
                  onChange={(e) => setIncisoANombre(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="Nombre completo" 
                  style={{ top: '75mm', left: '36mm', width: '95mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-inciso-a-nom" 
                />
                <input 
                  id="compareciente-cedula-1"
                  type="text" 
                  value={incisoADoc} 
                  onChange={(e) => setIncisoADoc(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="C.I. / RUC" 
                  style={{ top: '75mm', left: '153mm', width: '36mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-inciso-a-doc" 
                />
                <input 
                  id="compareciente-ciudad-1"
                  type="text" 
                  value={incisoADom} 
                  onChange={(e) => setIncisoADom(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="Ciudad / Domicilio" 
                  style={{ top: '81mm', left: '62mm', width: '124mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-inciso-a-dom" 
                />

                {/* Compareciente 2 (INCISO B): Nombre, Cédula, Ciudad */}
                <input 
                  id="compareciente-nombre-2"
                  type="text" 
                  value={incisoBNombre} 
                  onChange={(e) => setIncisoBNombre(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "----------------------------------------" : "Nombre completo (opcional)"} 
                  style={{ top: '88mm', left: '36mm', width: '95mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-inciso-b-nom" 
                />
                <input 
                  id="compareciente-cedula-2"
                  type="text" 
                  value={incisoBDoc} 
                  onChange={(e) => setIncisoBDoc(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "----------------" : "C.I. / RUC"} 
                  style={{ top: '88mm', left: '153mm', width: '36mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-inciso-b-doc" 
                />
                <input 
                  id="compareciente-ciudad-2"
                  type="text" 
                  value={incisoBDom} 
                  onChange={(e) => setIncisoBDom(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "----------------------------------------" : "Ciudad / Domicilio"} 
                  style={{ top: '94mm', left: '62mm', width: '124mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-inciso-b-dom" 
                />

                {/* INCISO C */}
                <input 
                  id="compareciente-nombre-3"
                  type="text" 
                  value={incisoCNombre} 
                  onChange={(e) => setIncisoCNombre(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "----------------------------------------" : "Nombre completo (opcional)"} 
                  style={{ top: '101mm', left: '36mm', width: '95mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-inciso-c-nom" 
                />
                <input 
                  id="compareciente-cedula-3"
                  type="text" 
                  value={incisoCDoc} 
                  onChange={(e) => setIncisoCDoc(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "----------------" : "C.I. / RUC"} 
                  style={{ top: '101mm', left: '153mm', width: '36mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold text-center focus:outline-none input-impresion pos-cert-inciso-c-doc" 
                />
                <input 
                  id="compareciente-ciudad-3"
                  type="text" 
                  value={incisoCDom} 
                  onChange={(e) => setIncisoCDom(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "----------------------------------------" : "Domicilio exacto"} 
                  style={{ top: '107mm', left: '62mm', width: '124mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-inciso-c-dom" 
                />

                {/* INCISO D */}
                <input 
                  id="compareciente-nombre-4"
                  type="text" 
                  value={incisoDNombre} 
                  onChange={(e) => setIncisoDNombre(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "----------------------------------------" : "Nombre completo (opcional)"} 
                  style={{ top: '114mm', left: '36mm', width: '95mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-inciso-d-nom" 
                />
                <input 
                  id="compareciente-cedula-4"
                  type="text" 
                  value={incisoDDoc} 
                  onChange={(e) => setIncisoDDoc(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "----------------" : "C.I. / RUC"} 
                  style={{ top: '114mm', left: '153mm', width: '36mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold text-center focus:outline-none input-impresion pos-cert-inciso-d-doc" 
                />
                <input 
                  id="compareciente-ciudad-4"
                  type="text" 
                  value={incisoDDom} 
                  onChange={(e) => setIncisoDDom(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "----------------------------------------" : "Domicilio exacto"} 
                  style={{ top: '120mm', left: '62mm', width: '124mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-inciso-d-dom" 
                />

                {/* SEGUNDO: Folios y Tomo */}
                <input 
                  id="folio-1-cf"
                  type="text" 
                  value={folio1} 
                  onChange={(e) => setFolio1(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="45" 
                  style={{ top: '128mm', left: '81mm', width: '14mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold text-center focus:outline-none input-impresion pos-cert-folio1" 
                />
                <input 
                  id="folio-2-cf"
                  type="text" 
                  value={folio2} 
                  onChange={(e) => setFolio2(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="46" 
                  style={{ top: '128mm', left: '99mm', width: '14mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold text-center focus:outline-none input-impresion pos-cert-folio2" 
                />
                <input 
                  id="tomo-libro-cf"
                  type="text" 
                  value={tomoLibro} 
                  onChange={(e) => setTomoLibro(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="Tomo III" 
                  style={{ top: '128mm', left: '118mm', width: '22mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold text-center focus:outline-none input-impresion pos-cert-tomo" 
                />

                {/* Cierre/Fechas: Año en letras, Hora, Día, Mes */}
                <input 
                  id="anio-letras-cierre"
                  type="text" 
                  value={anioCert} 
                  onChange={(e) => setAnioCert(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="DOS MIL VEINTISÉIS" 
                  style={{ top: '136mm', left: '64mm', width: '60mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-anio" 
                />
                <input 
                  id="hora-certificacion"
                  type="text" 
                  value={horaCert} 
                  onChange={(e) => setHoraCert(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="10:30" 
                  style={{ top: '142.5mm', left: '83mm', width: '18mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-hora" 
                />
                <input 
                  id="dia-certificacion"
                  type="text" 
                  value={diaCert} 
                  onChange={(e) => setDiaCert(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="12" 
                  style={{ top: '142.5mm', left: '123mm', width: '13mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-dia" 
                />
                <input 
                  id="mes-certificacion"
                  type="text" 
                  value={mesCert} 
                  onChange={(e) => setMesCert(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="MAYO" 
                  style={{ top: '142.5mm', left: '146mm', width: '44mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-mes" 
                />
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PLANTILLA 2: CONCUERDA (COORDENADAS MATEMÁTICAS EXACTAS DEL WORD)        */}
          {/* ========================================================================= */}
          {tipoDocumento === 'Concuerda' && (
            <div className="contenedor-hoja relative w-[215.9mm] h-[355.6mm]" style={{ width: '215.9mm', height: '355.6mm' }}>
              {/* ESTILOS FORZADOS Y CLASES DE POSICIONAMIENTO PARA CONCUERDA */}
              <style>{`
                /* Tipografía dinámica para los campos de Concuerda */
                .capa-datos-concuerda input,
                .capa-datos-concuerda span,
                .pos-matriz, .pos-folio, .pos-division, .pos-seccion,
                .pos-registro, .pos-asiento, .pos-autorizante, .pos-caracter,
                .pos-copia, .pos-destinatario, .pos-linea-adicional,
                .pos-dia, .pos-mes, .pos-anio {
                  font-size: ${fontSizeGlobal} !important;
                  font-family: ${fontFamilyGlobal} !important;
                }

                /* Coordenadas absolutas milimétricas para los campos de Concuerda (215.9mm x 355.6mm) */
                .pos-matriz, #escritura-nro-concuerda { top: 100mm; left: 142mm; width: 44.0mm; height: 6mm; }
                .pos-folio, #fojas-concuerda { top: 112mm; left: 45mm; width: 50.0mm; height: 6mm; }
                .pos-division, #division-concuerda { top: 112mm; left: 144mm; width: 44.0mm; height: 6mm; }
                .pos-seccion, #seccion-concuerda { top: 124mm; left: 55mm; width: 12.0mm; height: 6mm; }
                .pos-registro, #registro-concuerda { top: 125mm; left: 112mm; width: 70.0mm; height: 6mm; }
                .pos-asiento, #ciudad-concuerda { top: 136mm; left: 68mm; width: 115.0mm; height: 6mm; }
                .pos-autorizante, #notario-nombre-concuerda { top: 148mm; left: 68mm; width: 115.0mm; height: 6mm; }
                .pos-caracter, #notario-caracter-concuerda { top: 160mm; left: 72mm; width: 75.0mm; height: 6mm; }
                .pos-copia, #copia-concuerda { top: 172mm; left: 60mm; width: 45.0mm; height: 6mm; }
                .pos-destinatario, #destinatario-concuerda { top: 172mm; left: 125mm; width: 65.0mm; height: 6mm; }
                .pos-linea-adicional, #linea-adicional-concuerda { top: 184mm; left: 30mm; width: 58.0mm; height: 6mm; }
                .pos-dia, #dia-concuerda { top: 184mm; left: 105mm; width: 55.0mm; height: 6mm; }
                .pos-mes, #mes-concuerda { top: 196mm; left: 45mm; width: 35.0mm; height: 6mm; }
                .pos-anio, #anio-concuerda { top: 196mm; left: 88mm; width: 95.0mm; height: 6mm; }

                @media print {
                  @page { size: 215.9mm 355.6mm; margin: 0mm !important; }
                  body, html { margin: 0mm !important; padding: 0mm !important; }
                  
                  /* Forzar al contenedor a mantener su marco de referencia */
                  .contenedor-hoja {
                    position: relative !important;
                    width: 215.9mm !important;
                    height: 355.6mm !important;
                    display: block !important;
                    margin: 0mm !important;
                    padding: 0mm !important;
                  }
                  
                  /* Evitar que el CSS base convierta los inputs absolutos en estáticos */
                  .input-impresion {
                    position: absolute !important;
                    border: none !important;
                    background: transparent !important;
                    color: black !important;
                    box-shadow: none !important;
                    font-size: ${fontSizeGlobal} !important;
                    font-family: ${fontFamilyGlobal} !important;
                  }
                }
              `}</style>
              
              {/* CAPA DE GUÍA VISUAL */}
              <div className={`absolute inset-0 pointer-events-none z-0 print:hidden transition-opacity duration-300 ${mostrarGuia ? 'opacity-100' : 'opacity-0'}`}>
                 <div className="absolute text-slate-400 text-sm font-normal tracking-widest" style={{ top: '100mm', left: '35mm' }}>...///... C U E R D A</div>
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '100mm', left: '80mm' }}>fielmente con su escritura matriz Nº</div>
                 
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '112mm', left: '25mm' }}>folio</div>
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '112mm', left: '95mm' }}>del Protocolo de la División</div>
                 
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '124mm', left: '30mm' }}>Sección “</div>
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '125mm', left: '68mm' }}>” del Registro Notarial Nº</div>
                 
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '136mm', left: '30mm' }}>con asiento en</div>
                 
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '148mm', left: '30mm' }}>y autorizada por</div>
                 
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '160mm', left: '30mm' }}>en el carácter de</div>
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '160mm', left: '150mm' }}>de dicho Registro,</div>
                 
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '172mm', left: '30mm' }}>expido esta</div>
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '172mm', left: '105mm' }}>copia para</div>
                 
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '184mm', left: '90mm' }}>a los</div>
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '184mm', left: '165mm' }}>días del mes</div>
                 
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '196mm', left: '25mm' }}>de</div>
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '196mm', left: '72mm' }}>del año.</div>
              </div>

              {/* CAPA DE DATOS */}
              <div 
                className="capa-datos-concuerda absolute inset-0 z-10" 
                style={{ fontSize: fontSizeGlobal, fontFamily: fontFamilyGlobal }}
              >
                 {/* Escritura: N° */}
                 <input
                   id="escritura-nro-concuerda"
                   type="text"
                   value={matrizNro}
                   onChange={(e) => setMatrizNro(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="Matriz"
                   style={{ top: '100mm', left: '142mm', width: '44mm', height: '6mm' }}
                   className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-matriz"
                 />
                 
                 {/* Fojas y Sección: Fojas, CIVIL, Letra B */}
                 <input
                   id="fojas-concuerda"
                   type="text"
                   value={folioConcuerda}
                   onChange={(e) => setFolioConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="Fojas"
                   style={{ top: '112mm', left: '45mm', width: '50mm', height: '6mm' }}
                   className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-folio"
                 />
                 
                 <input
                   id="division-concuerda"
                   type="text"
                   value={divisionConcuerda}
                   onChange={(e) => setDivisionConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="CIVIL"
                   style={{ top: '112mm', left: '144mm', width: '44mm', height: '6mm' }}
                   className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-division"
                 />
                 
                 <input
                   id="seccion-concuerda"
                   type="text"
                   value={seccionConcuerda}
                   onChange={(e) => setSeccionConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="B"
                   style={{ top: '124mm', left: '55mm', width: '12mm', height: '6mm' }}
                   className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-seccion"
                 />
                 
                 {/* Registro: N° 1.292, Ciudad */}
                 <input
                   id="registro-concuerda"
                   type="text"
                   value={registroConcuerda}
                   onChange={(e) => setRegistroConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="1.292"
                   style={{ top: '125mm', left: '112mm', width: '70mm', height: '6mm' }}
                   className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-registro"
                 />
                 
                 <input
                   id="ciudad-concuerda"
                   type="text"
                   value={asientoConcuerda}
                   onChange={(e) => setAsientoConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="Ciudad"
                   style={{ top: '136mm', left: '68mm', width: '115mm', height: '6mm' }}
                   className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-asiento"
                 />
                 
                 {/* Notario: Nombre, TITULAR */}
                 <input
                   id="notario-nombre-concuerda"
                   type="text"
                   value={autorizanteConcuerda}
                   onChange={(e) => setAutorizanteConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="Nombre del Notario"
                   style={{ top: '148mm', left: '68mm', width: '115mm', height: '6mm' }}
                   className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-autorizante"
                 />
                 
                 <input
                   id="notario-caracter-concuerda"
                   type="text"
                   value={caracterConcuerda}
                   onChange={(e) => setCaracterConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="TITULAR"
                   style={{ top: '160mm', left: '72mm', width: '75mm', height: '6mm' }}
                   className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-caracter"
                 />
                 
                 {/* Expedición: Copia PRIMERA, Para */}
                 <input
                   id="copia-concuerda"
                   type="text"
                   value={copiaConcuerda}
                   onChange={(e) => setCopiaConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="PRIMERA"
                   style={{ top: '172mm', left: '60mm', width: '45mm', height: '6mm' }}
                   className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-copia"
                 />
                 
                 <input
                   id="destinatario-concuerda"
                   type="text"
                   value={destinatarioConcuerda}
                   onChange={(e) => setDestinatarioConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="Para"
                   maxLength={35}
                   style={{ top: '172mm', left: '125mm', width: '65mm', height: '6mm' }}
                   className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-destinatario"
                 />
                 
                 <input
                   id="linea-adicional-concuerda"
                   type="text"
                   value={lineaAdicionalConcuerda}
                   onChange={(e) => setLineaAdicionalConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="-----------------------"
                   maxLength={35}
                   style={{ top: '184mm', left: '30mm', width: '58mm', height: '6mm' }}
                   className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-linea-adicional"
                 />

                 {/* Fecha: Día, Mes, Año */}
                 <input
                   id="dia-concuerda"
                   type="text"
                   value={diaLetrasConcuerda}
                   onChange={(e) => setDiaLetrasConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="Día"
                   style={{ top: '184mm', left: '105mm', width: '55mm', height: '6mm' }}
                   className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-dia"
                 />
                 
                 <input
                   id="mes-concuerda"
                   type="text"
                   value={mesConcuerda}
                   onChange={(e) => setMesConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="Mes"
                   style={{ top: '196mm', left: '45mm', width: '35mm', height: '6mm' }}
                   className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-mes"
                 />
                 
                 <input
                   id="anio-concuerda"
                   type="text"
                   value={anioLetrasConcuerda}
                   onChange={(e) => setAnioLetrasConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="Año"
                   style={{ top: '196mm', left: '88mm', width: '95mm', height: '6mm' }}
                   className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-anio"
                 />

              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PLANTILLA 3: LEGALIZACIÓN (HOJA 3 - COORDENADAS ABSOLUTAS EN MILÍMETROS) */}
          {/* ========================================================================= */}
          {tipoDocumento === 'Legalización' && (
            <div className="contenedor-hoja relative w-[215.9mm] h-[355.6mm]" style={{ width: '215.9mm', height: '355.6mm' }}>
              <style>{`
                .capa-datos-legalizacion input {
                  font-size: ${fontSizeGlobal} !important;
                  font-family: ${fontFamilyGlobal} !important;
                }

                #notaria-titular { top: 85mm; left: 85mm; width: 95.0mm; height: 6mm; }
                #numero-registro { top: 95mm; left: 75mm; width: 105.0mm; height: 6mm; }
                #fecha-emision-leg { top: 105mm; left: 45mm; width: 65.0mm; height: 6mm; }
                #control-hoja-leg { top: 105mm; left: 120mm; width: 60.0mm; height: 6mm; }
                #dia-legalizacion { top: 135mm; left: 100mm; width: 20.0mm; height: 6mm; }
                #mes-anio-legalizacion { top: 135mm; left: 125mm; width: 32.0mm; height: 6mm; }
                #anio-legalizacion { top: 135mm; left: 160mm; width: 25.0mm; height: 6mm; }

                @media print {
                  @page { size: 215.9mm 355.6mm; margin: 0mm !important; }
                  body, html { margin: 0mm !important; padding: 0mm !important; }

                  .contenedor-hoja {
                    position: relative !important;
                    width: 215.9mm !important;
                    height: 355.6mm !important;
                    display: block !important;
                    margin: 0mm !important;
                    padding: 0mm !important;
                  }

                  .input-impresion {
                    position: absolute !important;
                    border: none !important;
                    background: transparent !important;
                    color: black !important;
                    box-shadow: none !important;
                    font-size: ${fontSizeGlobal} !important;
                    font-family: ${fontFamilyGlobal} !important;
                  }
                }
              `}</style>
              {/* CABECERA GUÍA Y ESTRUCTURAL */}
              <div className={`absolute inset-0 pointer-events-none z-0 print:hidden transition-opacity duration-300 ${mostrarGuia ? 'opacity-100' : 'opacity-0'} guia-impresion`}>
                <div className="absolute flex items-start justify-between border-b-2 border-black pb-2" style={{ top: '15mm', left: '20mm', right: '20mm' }}>
                  <div>
                    <h2 className="font-black text-base uppercase tracking-wider whitespace-nowrap">CORTE SUPREMA DE JUSTICIA</h2>
                    <p className="text-xs font-bold text-slate-700 whitespace-nowrap">REPÚBLICA DEL PARAGUAY</p>
                    <p className="text-xs font-bold mt-1 text-[#FF3131] whitespace-nowrap">LEGALIZACIÓN - ACTUACIÓN NOTARIAL (Serie PJH-2022)</p>
                  </div>
                  <div className="border border-black p-2 text-center w-20 h-16 flex flex-col items-center justify-center bg-slate-50 shrink-0">
                    <span className="text-[10px] font-mono font-bold whitespace-nowrap">QR PJE</span>
                    <span className="text-[8px] text-slate-500 whitespace-nowrap">SEC-2022</span>
                  </div>
                </div>
                <div className="absolute text-slate-400 text-[10pt]" style={{ top: '76mm', left: '45mm' }}>La CORTE SUPREMA DE JUSTICIA, legaliza la firma y</div>
                <div className="absolute text-slate-400 text-[10pt]" style={{ top: '85mm', left: '45mm' }}>sello del/la Notario/a</div>
                <div className="absolute text-slate-400 text-[10pt]" style={{ top: '95mm', left: '45mm' }}>Registro Nº</div>
                <div className="absolute text-slate-400 text-[10pt]" style={{ top: '105mm', left: '95mm' }}>Control Nº</div>
                <div className="absolute text-slate-400 text-[10pt]" style={{ top: '120mm', left: '45mm' }}>La presente Legalización se realiza sobre un documento de uso notarial expedido a nombre del/la Notario/a solicitante.</div>
                <div className="absolute text-slate-400 text-[10pt]" style={{ top: '135mm', left: '45mm' }}>Asunción, a los</div>
              </div>

              {/* CAPA DE DATOS EN COORDENADAS FÍSICAS EXACTAS (mm) */}
              <div
                className="capa-datos-legalizacion absolute inset-0 z-10"
                style={{ fontSize: fontSizeGlobal, fontFamily: fontFamilyGlobal }}
              >
                {/* Notario: Nombre y Registro */}
                <input 
                  id="notaria-titular"
                  type="text" 
                  value={nombreNotarioLeg} 
                  onChange={(e) => setNombreNotarioLeg(e.target.value)} 
                  onKeyDown={handleEnterKey}
                  style={{ top: '85mm', left: '85mm', width: '95mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent font-bold text-black focus:outline-none input-impresion" 
                  placeholder="RICARDO GABRIEL MARTÍNEZ VARELA"
                />
                <input 
                  id="numero-registro"
                  type="text" 
                  value={escrituraNroLeg} 
                  onChange={(e) => setEscrituraNroLeg(e.target.value)} 
                  onKeyDown={handleEnterKey}
                  style={{ top: '95mm', left: '75mm', width: '105mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent font-bold text-black focus:outline-none input-impresion" 
                  placeholder="1.292 - ESCRITURA Nº 79"
                />

                {/* Documento Base: Fecha doc y Control */}
                <input 
                  id="fecha-emision-leg"
                  type="text" 
                  value={fechaEscrituraLeg} 
                  onChange={(e) => setFechaEscrituraLeg(e.target.value)} 
                  onKeyDown={handleEnterKey}
                  style={{ top: '105mm', left: '45mm', width: '65mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent font-bold text-black focus:outline-none input-impresion" 
                  placeholder="10 DE MAYO DE 2026"
                />
                <input 
                  id="control-hoja-leg"
                  type="text" 
                  value={hojaSeguridadNroLeg} 
                  onChange={(e) => setHojaSeguridadNroLeg(e.target.value)} 
                  onKeyDown={handleEnterKey}
                  style={{ top: '105mm', left: '120mm', width: '60mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent font-bold text-black focus:outline-none input-impresion" 
                  placeholder="PJD-2026 Nº 4.589.123"
                />

                {/* Fecha Legalización: Día, Mes, Año */}
                <input 
                  id="dia-legalizacion"
                  type="text" 
                  value={diaLeg} 
                  onChange={(e) => setDiaLeg(e.target.value)} 
                  onKeyDown={handleEnterKey}
                  style={{ top: '135mm', left: '100mm', width: '20mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent font-bold text-black focus:outline-none input-impresion" 
                  placeholder="15"
                />
                <input 
                  id="mes-anio-legalizacion"
                  type="text" 
                  value={mesLeg} 
                  onChange={(e) => setMesLeg(e.target.value)} 
                  onKeyDown={handleEnterKey}
                  style={{ top: '135mm', left: '125mm', width: '32mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent font-bold text-black focus:outline-none input-impresion" 
                  placeholder="MAYO"
                />
                <input 
                  id="anio-legalizacion"
                  type="text" 
                  value={anioLeg} 
                  onChange={(e) => setAnioLeg(e.target.value)} 
                  onKeyDown={handleEnterKey}
                  style={{ top: '135mm', left: '160mm', width: '25mm', height: '6mm' }}
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent font-bold text-black focus:outline-none input-impresion" 
                  placeholder="2026"
                />
              </div>
            </div>
          )}
          {/* ========================================================================= */}
          {/* PLANTILLA 0: SELLADO NOTARIAL - PROTOCOLO (25 RENGLONES Y TEXTO VERTICAL)   */}
          {/* ========================================================================= */}
          {tipoDocumento === 'Sellado Notarial - Protocolo' && (
            <div id="contenedor-paginas-protocolo" className="flex flex-col gap-12 print:gap-0 print:py-0 print:m-0 print:p-0 print:bg-white items-center bg-slate-900 py-12">
              {protocoloPaginas
                .filter((textoPagina, i) => i === 0 || (textoPagina && textoPagina.trim() !== ''))
                .map((textoPagina, index, arr) => {
                  const isAnverso = index % 2 === 0;
                  const esUltima = index === arr.length - 1;

                  return (
                    <div 
                      key={index} 
                      className={`hoja-notarial pagina-virtual relative bg-white text-black shrink-0 print:shadow-none print:m-0 print:p-0 shadow-2xl ${isAnverso ? 'pagina-anverso' : 'pagina-reverso'}`}
                      style={{ width: '215.9mm', height: '355.6mm', pageBreakAfter: esUltima ? 'avoid' : 'always' }}
                    >
                      {/* CAPA 0: GRILLA DE 25 RENGLONES EXACTOS A 8.47mm (Invisible al imprimir) */}
                      <div 
                        className={` absolute flex flex-col pointer-events-none z-0 print:hidden ${mostrarGuia ? 'opacity-100' : 'opacity-0'}`}
                        style={{
                          position: 'absolute',
                          top: '42.55mm',
                          left: isAnverso ? '30.0mm' : '25.0mm',
                          width: '155.9mm',
                          height: '211.75mm',
                        }}
                      >
                        {Array.from({ length: 25 }, (_, i) => (
                          <div key={i} className="relative w-full border-b border-dashed border-slate-300" style={{ height: '8.47mm' }}>
                            <span className={`absolute bottom-0 text-[8pt] font-mono text-slate-400 ${isAnverso ? '-left-6' : '-right-6'}`}>{i + 1}</span>
                          </div>
                        ))}
                      </div>

                      {/* CAPA 1: TEXTO VERTICAL (Lomo, ÚNICAMENTE en la Primera Página, de abajo hacia arriba) */}
                      {index === 0 && (
                        <div 
                          className="texto-vertical-sello lomo-impresion pointer-events-none z-10 print:visible"
                          style={{ position: 'absolute', left: '15mm', top: '42.55mm', width: '12mm', height: '211.75mm', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <span
                            className="texto-vertical-contenido text-[7pt] font-bold tracking-[0.5mm] whitespace-nowrap text-slate-400 print:text-black"
                            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', display: 'inline-block' }}
                          >
                            {protocoloTextoVertical}
                          </span>
                        </div>
                      )}

                      {/* CAPA 2: EDITOR EN PANTALLA */}
                      <textarea
                        ref={(el) => { textareasRefs.current[index] = el; }}
                        value={textoPagina}
                        onChange={(e) => handleTextareaChange(index, e)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        placeholder={`Redacte aquí la ${isAnverso ? 'cara frontal (Anverso)' : 'cara trasera (Reverso)'}...`}
                        className="absolute z-20 bg-transparent text-black font-bold text-justify outline-none border-none resize-none print:hidden selection:bg-red-100 overflow-hidden"
                        style={{
                          position: 'absolute',
                          top: '42.55mm',
                          left: isAnverso ? '30.0mm' : '25.0mm',
                          width: '155.9mm',
                          height: '211.75mm',
                          lineHeight: `${interlineadoGlobal}mm`,
                          fontSize: fontSizeGlobal,
                          fontFamily: fontFamilyGlobal,
                          margin: '0mm',
                          padding: '0mm',
                        }}
                      />

                      {/* CAPA 3: CUERPO DE TEXTO OFICIAL CALIBRADO PARA IMPRESIÓN (25 RENGLONES A 8.47mm) */}
                      <div 
                        id={index === 0 ? 'notarial-cuerpo-texto' : `notarial-cuerpo-texto-${index}`}
                        className="notarial-cuerpo-texto hidden print:block text-black font-bold text-justify whitespace-pre-wrap"
                        style={{
                          position: 'absolute',
                          top: '42.55mm',
                          left: isAnverso ? '30.0mm' : '25.0mm',
                          width: '155.9mm',
                          height: '211.75mm',
                          lineHeight: `${interlineadoGlobal}mm`,
                          fontSize: fontSizeGlobal,
                          fontFamily: fontFamilyGlobal,
                          margin: '0mm',
                          padding: '0mm',
                        }}
                      >
                        {textoPagina}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}


        </div>
      </div>
    </div>
  );
};
