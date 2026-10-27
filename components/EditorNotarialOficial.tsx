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

export const TEXTO_EJEMPLO_PROTOCOLO = 'ESCRITURA PÚBLICA (EJEMPLO): Haga clic aquí para comenzar a redactar...';
export const TEXTO_EJEMPLO_LOMO = 'PARA REGISTROS PÚBLICOS CIVIL Y COMERCIAL - PROTOCOLO NOTARIAL';

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

export const EditorNotarialOficial: React.FC<EditorNotarialOficialProps> = ({ hojaInicial }) => {
  const tipoInicial = resolverTipoDocumentoInicial(hojaInicial);
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumentoNotarial>(tipoInicial);
  const [mostrarGuia, setMostrarGuia] = useState<boolean>(true);

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
  const [tramoPrimero1, setTramoPrimero1] = useState<string>('CONTRATO PRIVADO DE');
  const [tramoPrimero2, setTramoPrimero2] = useState<string>('VENTA DE VEHICULO AUTOMOTOR');
  const [tramoPrimero3, setTramoPrimero3] = useState<string>('y ratificado en todas sus partes ante mi presencia');

  // Incisos a, b, c, d
  const [incisoANombre, setIncisoANombre] = useState<string>('JUAN CARLOS PÉREZ GÓMEZ');
  const [incisoADoc, setIncisoADoc] = useState<string>('1.234.567');
  const [incisoADom, setIncisoADom] = useState<string>('ASUNCIÓN');

  const [incisoBNombre, setIncisoBNombre] = useState<string>('MARÍA ELENA GONZÁLEZ DE PÉREZ');
  const [incisoBDoc, setIncisoBDoc] = useState<string>('2.345.678');
  const [incisoBDom, setIncisoBDom] = useState<string>('ASUNCIÓN');

  const [incisoCNombre, setIncisoCNombre] = useState<string>('****************************************');
  const [incisoCDoc, setIncisoCDoc] = useState<string>('****************');
  const [incisoCDom, setIncisoCDom] = useState<string>('****************************************');

  const [incisoDNombre, setIncisoDNombre] = useState<string>('****************************************');
  const [incisoDDoc, setIncisoDDoc] = useState<string>('****************');
  const [incisoDDom, setIncisoDDom] = useState<string>('****************************************');

  // Segundo, Cuarto
  const [folio1, setFolio1] = useState<string>('45');
  const [folio2, setFolio2] = useState<string>('46');
  const [tomoLibro, setTomoLibro] = useState<string>('46-TOMO II');
  const [horaCert, setHoraCert] = useState<string>('16:55');
  const [diaCert, setDiaCert] = useState<string>('08');
  const [mesCert, setMesCert] = useState<string>('OCTUBRE');
  const [anioCert, setAnioCert] = useState<string>('DOS MIL VEINTISÉIS.-');

  // PLANTILLA 2: Concuerda
  const [matrizNro, setMatrizNro] = useState<string>('49.-----------------');
  const [folioConcuerda, setFolioConcuerda] = useState<string>('137 y siguiente');
  const [divisionConcuerda, setDivisionConcuerda] = useState<string>('CIVIL');
  const [seccionConcuerda, setSeccionConcuerda] = useState<string>('B');
  const [registroConcuerda, setRegistroConcuerda] = useState<string>('1.292');
  const [asientoConcuerda, setAsientoConcuerda] = useState<string>('ITAKYRY');
  const [autorizanteConcuerda, setAutorizanteConcuerda] = useState<string>('RICARDO GABRIEL MARTINEZ VARELA');
  const [caracterConcuerda, setCaracterConcuerda] = useState<string>('TITULAR');
  const [copiaConcuerda, setCopiaConcuerda] = useState<string>('PRIMERA');
  const [destinatarioConcuerda, setDestinatarioConcuerda] = useState<string>('WHILHEM OSVALDO...');
  const [lineaAdicionalConcuerda, setLineaAdicionalConcuerda] = useState<string>('-----------------------------------------------------');
  const [cierreConcuerda, setCierreConcuerda] = useState<string>('');
  const [diaLetrasConcuerda, setDiaLetrasConcuerda] = useState<string>('VEINTITRES');
  const [mesConcuerda, setMesConcuerda] = useState<string>('MAYO');
  const [anioLetrasConcuerda, setAnioLetrasConcuerda] = useState<string>('DOS MIL VEINTICINCO.-');

  // PLANTILLA 3: Legalización
  const [nombreNotarioLeg, setNombreNotarioLeg] = useState<string>('MARCELA MIRTA GÓMEZ NAVARRO');
  const [lineaAdicionalLeg, setLineaAdicionalLeg] = useState<string>('');
  const [escrituraNroLeg, setEscrituraNroLeg] = useState<string>('SEIS (6).-');
  const [fechaEscrituraLeg, setFechaEscrituraLeg] = useState<string>('15 de febrero del 2022.-');
  const [hojaSeguridadNroLeg, setHojaSeguridadNroLeg] = useState<string>('000019301.-');
  const [diaLeg, setDiaLeg] = useState<string>('00');
  const [mesLeg, setMesLeg] = useState<string>('abril');
  const [anioLeg, setAnioLeg] = useState<string>('2022');

  // PLANTILLA 0: Protocolo
  const [protocoloTextoVertical, setProtocoloTextoVertical] = useState<string>('');
  const [mostrarEjemploLomo, setMostrarEjemploLomo] = useState<boolean>(true);
  const [protocoloPaginas, setProtocoloPaginas] = useState<string[]>([
    TEXTO_EJEMPLO_PROTOCOLO
  ]);
  const textareasRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  const limpiarTextoEjemplo = (index: number) => {
    if (protocoloPaginas[index] === TEXTO_EJEMPLO_PROTOCOLO) {
      const nuevasPaginas = [...protocoloPaginas];
      nuevasPaginas[index] = '';
      setProtocoloPaginas(nuevasPaginas);
    }
  };

  const handleTextareaChange = (index: number, e: React.ChangeEvent<HTMLTextAreaElement>) => {
    let texto = e.target.value;
    if (texto.includes(TEXTO_EJEMPLO_PROTOCOLO)) {
      texto = texto.replace(TEXTO_EJEMPLO_PROTOCOLO, '');
    }
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
        const textoParaImprimir = (!mostrarEjemploLomo && protocoloTextoVertical.trim()) ? protocoloTextoVertical : '';

        if (!textoParaImprimir) {
          if (lomo) lomo.remove();
        } else {
          if (!lomo) {
            lomo = document.createElement('div');
            pagina1.insertBefore(lomo, pagina1.firstChild);
          } else if (pagina1.firstChild !== lomo) {
            pagina1.insertBefore(lomo, pagina1.firstChild);
          }

          lomo.className = 'caja-fija-lomo';
          lomo.removeAttribute('style');
          lomo.innerHTML = `<span>${textoParaImprimir}</span>`;
        }
      }
    }

    // Para plantillas de una sola hoja (Certificación, Concuerda, Legalización)
    if (tipoDocumento !== 'Sellado Notarial - Protocolo') {
      clone.classList.add('plantilla-unica-hoja');
      clone.classList.remove('shadow-2xl');
      clone.style.width = '215.9mm';
      clone.style.height = '355.6mm';
      clone.style.maxHeight = '355.6mm';
      clone.style.overflow = 'hidden';
      clone.style.boxSizing = 'border-box';
      clone.style.margin = '0 auto';
    }

    // Convertir todos los inputs a spans transfiriendo exactamente su id, style, className y contenido
    clone.querySelectorAll('input').forEach((inp) => {
      const span = document.createElement('span');
      span.textContent = inp.value || '\u00A0';
      if (inp.id) span.id = inp.id;
      span.className = inp.className;
      const inlineStyle = inp.getAttribute('style');
      if (inlineStyle) span.setAttribute('style', inlineStyle);
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
      position: absolute !important;
      white-space: nowrap !important;
      display: block !important;
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
    <div id="contenedor-principal-notarial" className="min-h-screen bg-white text-slate-900 flex flex-col font-sans print:min-h-0 print:bg-white print:block print:m-0 print:p-0">
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



      {/* Contenedor del Lienzo Digital (Oficio / Legal: 215.9mm x 355.6mm) */}
      <div id="envoltorio-lienzo-notarial" className="flex-1 flex flex-col items-center justify-start p-4 md:p-8 overflow-auto bg-slate-100 border-t border-slate-200 print:p-0 print:m-0 print:block print:bg-white">
        {/* Barra Unificada de Control Notarial (Calibración, Tipografía, Espaciado, Guía, Guardar e Imprimir) */}
        <div className="barra-controles-notarial mb-4 bg-slate-200/80 border border-slate-300/90 rounded-2xl p-3 md:px-5 md:py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-800 shadow-sm print:hidden w-full max-w-7xl">
          {/* Bloque Izquierdo: Calibración, Tipografía y Espaciados */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Calibrador de Impresora (Offset X / Y) */}
            <div className="flex items-center gap-1.5 bg-white/90 px-2.5 py-1 rounded-xl border border-slate-300 shadow-xs">
              <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1" title="Calibrador milimétrico de impresora">
                <Sliders className="w-3.5 h-3.5 text-amber-600" />
                Offset:
              </span>
              <div className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 font-semibold">X:</span>
                <button 
                  type="button"
                  onClick={() => setOffsetX(offsetX - 1)} 
                  title="Restar 1mm horizontal"
                  className="px-1.5 py-0.5 hover:bg-slate-200 rounded text-slate-700 font-bold hover:text-slate-900 transition-colors"
                >
                  -
                </button>
                <span className="w-7 text-center font-mono text-[11px] text-amber-700 font-bold">{offsetX}mm</span>
                <button 
                  type="button"
                  onClick={() => setOffsetX(offsetX + 1)} 
                  title="Sumar 1mm horizontal"
                  className="px-1.5 py-0.5 hover:bg-slate-200 rounded text-slate-700 font-bold hover:text-slate-900 transition-colors"
                >
                  +
                </button>
              </div>
              <div className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 font-semibold">Y:</span>
                <button 
                  type="button"
                  onClick={() => setOffsetY(offsetY - 1)} 
                  title="Restar 1mm vertical"
                  className="px-1.5 py-0.5 hover:bg-slate-200 rounded text-slate-700 font-bold hover:text-slate-900 transition-colors"
                >
                  -
                </button>
                <span className="w-7 text-center font-mono text-[11px] text-amber-700 font-bold">{offsetY}mm</span>
                <button 
                  type="button"
                  onClick={() => setOffsetY(offsetY + 1)} 
                  title="Sumar 1mm vertical"
                  className="px-1.5 py-0.5 hover:bg-slate-200 rounded text-slate-700 font-bold hover:text-slate-900 transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Separador */}
            <div className="h-4 w-px bg-slate-300 hidden lg:block"></div>

            {/* Tipografía (Fuente, Tamaño, A-/A+) */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                <Type className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden sm:inline">Fuente</span>
              </span>
              <select
                value={fontFamilyGlobal}
                onChange={(e) => setFontFamilyGlobal(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-800 font-medium focus:outline-none focus:border-amber-500 cursor-pointer shadow-xs"
              >
                <option value="Arial, Helvetica, sans-serif">Arial</option>
                <option value='"Times New Roman", Times, serif'>Times New Roman</option>
                <option value='"Courier New", Courier, monospace'>Courier New</option>
                <option value="Georgia, serif">Georgia</option>
              </select>

              <select
                value={fontSizeGlobal}
                onChange={(e) => setFontSizeGlobal(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-800 font-bold focus:outline-none focus:border-amber-500 cursor-pointer shadow-xs"
              >
                <option value="12px">12 px</option>
                <option value="13px">13 px</option>
                <option value="14px">14 px</option>
                <option value="15px">15 px</option>
                <option value="16px">16 px</option>
                <option value="18px">18 px</option>
                <option value="20px">20 px</option>
              </select>

              <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-300 shadow-xs">
                <button
                  type="button"
                  onClick={() => {
                    const sizes = ['12px', '13px', '14px', '15px', '16px', '18px', '20px'];
                    const idx = sizes.indexOf(fontSizeGlobal);
                    if (idx > 0) setFontSizeGlobal(sizes[idx - 1]);
                  }}
                  title="Reducir tamaño (A-)"
                  className="px-1.5 py-0.5 hover:bg-slate-100 rounded text-slate-700 font-bold transition-colors"
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
                  className="px-1.5 py-0.5 hover:bg-slate-100 rounded text-slate-700 font-bold transition-colors"
                >
                  A+
                </button>
              </div>
            </div>

            {/* Separador */}
            <div className="h-4 w-px bg-slate-300 hidden lg:block"></div>

            {/* Espaciado vertical (Interlineado) */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-700 font-bold text-[11px] flex items-center gap-1" title="Espaciado vertical / Interlineado">
                <MoveVertical className="w-3.5 h-3.5 text-sky-600" />
                Líneas:
              </span>
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-300 shadow-xs">
                <button
                  type="button"
                  onClick={() => setInterlineadoGlobal((prev) => Math.max(6.0, Number((prev - 0.2).toFixed(1))))}
                  title="Reducir interlineado (-0.2mm)"
                  className="px-1.5 py-0.5 hover:bg-slate-100 rounded text-slate-700 font-bold transition-colors"
                >
                  -
                </button>
                <span className="w-12 text-center font-mono text-[11px] text-sky-700 font-bold">
                  {interlineadoGlobal}mm
                </span>
                <button
                  type="button"
                  onClick={() => setInterlineadoGlobal((prev) => Math.min(16.0, Number((prev + 0.2).toFixed(1))))}
                  title="Aumentar interlineado (+0.2mm)"
                  className="px-1.5 py-0.5 hover:bg-slate-100 rounded text-slate-700 font-bold transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Margen horizontal (Indentación In/Out) */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-700 font-bold text-[11px] flex items-center gap-1" title="Margen horizontal / Sangría In-Out">
                <MoveHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                Margen H:
              </span>
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-300 shadow-xs">
                <button
                  type="button"
                  onClick={() => setMargenHorizontal((prev) => Math.max(-25, prev - 1))}
                  title="Desplazar a la izquierda (-1mm)"
                  className="px-1.5 py-0.5 hover:bg-slate-100 rounded text-slate-700 font-bold transition-colors"
                >
                  ◄
                </button>
                <span className="w-11 text-center font-mono text-[11px] text-emerald-700 font-bold">
                  {margenHorizontal > 0 ? `+${margenHorizontal}` : margenHorizontal}mm
                </span>
                <button
                  type="button"
                  onClick={() => setMargenHorizontal((prev) => Math.min(25, prev + 1))}
                  title="Desplazar a la derecha (+1mm)"
                  className="px-1.5 py-0.5 hover:bg-slate-100 rounded text-slate-700 font-bold transition-colors"
                >
                  ►
                </button>
              </div>
              {margenHorizontal !== 0 && (
                <button
                  type="button"
                  onClick={() => setMargenHorizontal(0)}
                  title="Restablecer margen a 0mm"
                  className="text-[10px] text-slate-500 hover:text-amber-600 underline ml-0.5"
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-xs ${
                mostrarGuia 
                  ? 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100' 
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {mostrarGuia ? <Eye className="w-3.5 h-3.5 text-blue-600" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
              <span>{mostrarGuia ? 'Guía Visible' : 'Guía Oculta'}</span>
            </button>

            {/* Botón Guardar Configuración */}
            <button
              type="button"
              onClick={handleGuardarConfiguracion}
              title={`Guardar tipografía, calibración y márgenes para "${tipoDocumento}"`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-xs ${
                guardadoFeedback
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-white hover:bg-amber-50 text-amber-700 border-amber-300 hover:border-amber-400'
              }`}
            >
              {guardadoFeedback ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>¡Guardado!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 text-amber-600" />
                  <span>Guardar Config.</span>
                </>
              )}
            </button>

            {/* Botón Imprimir Hoja (En su posición original) */}
            <button
              id="btn-imprimir-hoja"
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-1.5 bg-[#FF3131] hover:bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-red-600/20 transition-all hover:scale-105 active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Hoja</span>
            </button>

            {/* Campo Registros Públicos Civil y Comercial (Lomo) - Hacia la derecha */}
            {tipoDocumento === 'Sellado Notarial - Protocolo' && (
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-300 shadow-xs">
                <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
                  Registros Públicos Civil y Comercial:
                </span>
                <input
                  id="input-lomo-registro"
                  type="text"
                  value={protocoloTextoVertical}
                  onChange={(e) => {
                    setMostrarEjemploLomo(false);
                    setProtocoloTextoVertical(e.target.value);
                  }}
                  onClick={() => setMostrarEjemploLomo(false)}
                  onFocus={() => setMostrarEjemploLomo(false)}
                  placeholder="Escriba aquí el texto..."
                  className="bg-slate-50 border border-slate-300 text-slate-800 text-xs px-2.5 py-0.5 rounded-lg w-52 sm:w-64 outline-none focus:border-[#FF3131] font-medium"
                  title="Texto vertical del lomo para Registros Públicos Civil y Comercial"
                />
              </div>
            )}
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
            <div
              id="contenedor-hoja-1"
              className="contenedor-hoja relative w-[215.9mm] h-[355.6mm] overflow-hidden bg-white"
              style={{ width: '215.9mm', height: '355.6mm', position: 'relative', overflow: 'hidden', background: 'white' }}
            >
              {/* ESTILOS FORZADOS Y CLASES DE POSICIONAMIENTO PARA CERTIFICACIÓN DE FIRMAS */}
              <style>{`
                /* Contenedor padre de la Hoja 1 (Pantalla e Impresión) */
                #contenedor-hoja-1,
                .contenedor-hoja {
                  position: relative !important;
                  width: 215.9mm !important;
                  height: 355.6mm !important;
                  overflow: hidden !important;
                  background: white !important;
                  margin: 0mm !important;
                  padding: 0mm !important;
                }

                /* Reglas estrictas para todos los campos hijos de Certificación de Firmas */
                .capa-datos-certificacion input,
                .capa-datos-certificacion .campo-hoja-1 {
                  position: absolute !important;
                  white-space: nowrap !important;
                  margin: 0mm !important;
                  padding: 0mm !important;
                  background: transparent;
                  font-family: ${fontFamilyGlobal} !important;
                  font-weight: bold !important;
                  line-height: 1 !important;
                }

                .capa-datos-certificacion .campo-hoja-1:hover {
                  background-color: rgba(254, 243, 199, 0.35);
                  border-bottom-color: #64748b;
                }

                .capa-datos-certificacion .campo-hoja-1:focus {
                  background-color: rgba(254, 243, 199, 0.55);
                  border-bottom-color: #FF3131;
                  outline: none;
                }

                /* Coordenadas absolutas milimétricas para Certificación de Firmas (215.9mm x 355.6mm) */
                .pos-cert-firmas-t1, #titular-notaria-cf { top: 74.0mm !important; left: 99.2mm !important; font-size: 12pt !important; font-weight: bold !important; }
                .pos-cert-firmas-t2, #registro-notaria-cf { top: 86.0mm !important; left: 69.6mm !important; font-size: 12pt !important; font-weight: bold !important; }
                .pos-cert-firmas-t3, #ciudad-registro-cf { top: 86.0mm !important; left: 137.3mm !important; font-size: 12pt !important; font-weight: bold !important; }

                .pos-cert-tramo1, #tipo-contrato-cf { top: 124.0mm !important; left: 160.6mm !important; font-size: 8pt !important; font-weight: bold !important; }
                .pos-cert-tramo2, #objeto-acto-cf { top: 134.5mm !important; left: 31.5mm !important; font-size: 8pt !important; font-weight: bold !important; }

                .pos-cert-inciso-a-nom, #compareciente-nombre-1 { top: 146.0mm !important; left: 37.8mm !important; font-size: 12pt !important; font-weight: bold !important; }
                .pos-cert-inciso-a-doc, #compareciente-cedula-1 { top: 146.0mm !important; left: 154.3mm !important; font-size: 12pt !important; font-weight: bold !important; }
                .pos-cert-inciso-a-dom, #compareciente-ciudad-1 { top: 157.0mm !important; left: 63.2mm !important; font-size: 12pt !important; font-weight: bold !important; }

                .pos-cert-inciso-b-nom, #compareciente-nombre-2 { top: 169.0mm !important; left: 37.8mm !important; font-size: 12pt !important; font-weight: bold !important; }
                .pos-cert-inciso-b-doc, #compareciente-cedula-2 { top: 169.0mm !important; left: 155.3mm !important; font-size: 12pt !important; font-weight: bold !important; }
                .pos-cert-inciso-b-dom, #compareciente-ciudad-2 { top: 180.0mm !important; left: 63.2mm !important; font-size: 12pt !important; font-weight: bold !important; }

                .pos-cert-inciso-c-nom, #compareciente-nombre-3 { top: 192.0mm !important; left: 37.8mm !important; font-size: 12pt !important; font-weight: bold !important; }
                .pos-cert-inciso-c-doc, #compareciente-cedula-3 { top: 192.0mm !important; left: 155.3mm !important; font-size: 12pt !important; font-weight: bold !important; }
                .pos-cert-inciso-c-dom, #compareciente-ciudad-3 { top: 203.0mm !important; left: 63.2mm !important; font-size: 12pt !important; font-weight: bold !important; }

                .pos-cert-inciso-d-nom, #compareciente-nombre-4 { top: 215.5mm !important; left: 37.8mm !important; font-size: 12pt !important; font-weight: bold !important; }
                .pos-cert-inciso-d-doc, #compareciente-cedula-4 { top: 215.5mm !important; left: 154.3mm !important; font-size: 12pt !important; font-weight: bold !important; }
                .pos-cert-inciso-d-dom, #compareciente-ciudad-4 { top: 225.0mm !important; left: 63.2mm !important; font-size: 12pt !important; font-weight: bold !important; }

                .pos-cert-tomo, #libro-tomo-cf { top: 248.0mm !important; left: 80.2mm !important; font-size: 8pt !important; font-weight: bold !important; }

                .pos-cert-hora, #hora-certificacion { top: 314.5mm !important; left: 79.4mm !important; font-size: 12pt !important; font-weight: bold !important; }
                .pos-cert-dia, #dia-certificacion   { top: 314.5mm !important; left: 119.8mm !important; font-size: 12pt !important; font-weight: bold !important; }
                .pos-cert-mes, #mes-certificacion   { top: 314.5mm !important; left: 143.1mm !important; font-size: 12pt !important; font-weight: bold !important; }
                .pos-cert-anio, #anio-letras-cierre { top: 321.5mm !important; left: 60.6mm !important; font-size: 12pt !important; font-weight: bold !important; }

                @media print {
                  @page { size: 215.9mm 355.6mm; margin: 0mm !important; }
                  body, html { margin: 0mm !important; padding: 0mm !important; }
                  
                  /* Forzar al contenedor a mantener su marco de referencia */
                  #contenedor-hoja-1,
                  .contenedor-hoja {
                    position: relative !important;
                    width: 215.9mm !important;
                    height: 355.6mm !important;
                    overflow: hidden !important;
                    background: white !important;
                    display: block !important;
                    margin: 0mm !important;
                    padding: 0mm !important;
                  }
                  
                  /* Evitar que el CSS base convierta los inputs absolutos en estáticos */
                  .input-impresion {
                    position: absolute !important;
                    white-space: nowrap !important;
                    border: none !important;
                    background: transparent !important;
                    color: black !important;
                    box-shadow: none !important;
                    margin: 0mm !important;
                    padding: 0mm !important;
                    font-family: ${fontFamilyGlobal} !important;
                  }
                }
              `}</style>

              {/* CAPA DE GUÍA VISUAL (Solo visible en pantalla, sincronizada al milímetro con los 22 inputs) */}
              <div className={`absolute inset-0 pointer-events-none z-0 print:hidden transition-opacity duration-300 ${mostrarGuia ? 'opacity-100' : 'opacity-0'} guia-impresion`}>
                {/* Cabecera preimpresa */}
                <div className="absolute flex items-start justify-between border-b-2 border-slate-300 pb-3" style={{ top: '18mm', left: '25mm', right: '25mm' }}>
                  <div>
                    <h2 className="font-black text-sm uppercase tracking-wider text-slate-500">CORTE SUPREMA DE JUSTICIA</h2>
                    <p className="text-[11px] font-bold text-slate-400">REPÚBLICA DEL PARAGUAY</p>
                    <p className="text-[10px] font-bold mt-0.5 text-red-400">CERTIFICACIÓN DE FIRMAS (Art. 152 - Ley 879) (Hoja de Seguridad)</p>
                  </div>
                  <div className="border border-dashed border-slate-300 p-1.5 text-center w-20 h-16 flex flex-col items-center justify-center bg-slate-50/60 shrink-0">
                    <span className="text-[9px] font-mono font-bold text-slate-400">SELLO / QR</span>
                    <span className="text-[8px] text-slate-400">PREIMPRESO</span>
                  </div>
                </div>

                {/* Cabecera Notario: sincronizada con top: 74.0mm y top: 86.0mm */}
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '74.5mm', left: '25.0mm' }}>En mi carácter de Escribano Público</div>
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '74.5mm', left: '176.0mm' }}>del</div>

                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '86.5mm', left: '25.0mm' }}>Registro Notarial Nº</div>
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '86.5mm', left: '104.5mm' }}>con asiento en</div>

                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '98.0mm', left: '25.0mm' }}>y en uso de las atribuciones que me acuerda la legislación vigente:</div>

                <div className="absolute text-slate-400 text-[12pt] font-black tracking-[0.35em] text-center" style={{ top: '110.5mm', left: '25.0mm', width: '165.0mm' }}>CERTIFICO</div>

                {/* Punto PRIMERO: sincronizado con top: 124.0mm y top: 134.5mm */}
                <div className="absolute text-slate-400 text-[10pt] font-normal whitespace-nowrap" style={{ top: '124.0mm', left: '25.0mm' }}>
                  <span className="font-bold text-slate-500">PRIMERO:</span> Que las firmas que obran en el documento anexo inserto en
                </div>
                <div className="absolute text-slate-400 text-[9.5pt] font-normal whitespace-nowrap" style={{ top: '134.5mm', left: '148.0mm' }}>han sido puestas en mi presencia por:</div>

                {/* Inciso a: sincronizado con top: 146.0mm y top: 157.0mm */}
                <div className="absolute text-slate-400 text-[10.5pt] font-bold whitespace-nowrap" style={{ top: '146.5mm', left: '25.0mm' }}>a)</div>
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '146.5mm', left: '133.5mm' }}>documento</div>
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '157.5mm', left: '25.0mm' }}>con domicilio en</div>

                {/* Inciso b: sincronizado con top: 169.0mm y top: 180.0mm */}
                <div className="absolute text-slate-400 text-[10.5pt] font-bold whitespace-nowrap" style={{ top: '169.5mm', left: '25.0mm' }}>b)</div>
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '169.5mm', left: '133.5mm' }}>documento</div>
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '180.5mm', left: '25.0mm' }}>con domicilio en</div>

                {/* Inciso c: sincronizado con top: 192.0mm y top: 203.0mm */}
                <div className="absolute text-slate-400 text-[10.5pt] font-bold whitespace-nowrap" style={{ top: '192.5mm', left: '25.0mm' }}>c)</div>
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '192.5mm', left: '133.5mm' }}>documento</div>
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '203.5mm', left: '25.0mm' }}>con domicilio en</div>

                {/* Inciso d: sincronizado con top: 215.5mm y top: 225.0mm */}
                <div className="absolute text-slate-400 text-[10.5pt] font-bold whitespace-nowrap" style={{ top: '216.0mm', left: '25.0mm' }}>d)</div>
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '216.0mm', left: '133.5mm' }}>documento</div>
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '225.5mm', left: '25.0mm' }}>con domicilio en</div>

                {/* Punto SEGUNDO: sincronizado con top: 248.0mm, left: 80.2mm */}
                <div className="absolute text-slate-400 text-[10pt] font-normal whitespace-nowrap" style={{ top: '238.5mm', left: '25.0mm' }}>
                  <span className="font-bold text-slate-500">SEGUNDO:</span> Que las firmas de las mencionadas personas fueron registradas en el libro correspondiente
                </div>
                <div className="absolute text-slate-400 text-[10pt] font-normal whitespace-nowrap" style={{ top: '248.0mm', left: '25.0mm' }}>bajo el folio / libro Nº</div>
                <div className="absolute text-slate-400 text-[10pt] font-normal whitespace-nowrap" style={{ top: '248.0mm', left: '136.5mm' }}>, en donde se halla consignado el motivo de la certificación.</div>

                {/* Punto TERCERO */}
                <div className="absolute text-slate-400 text-[10pt] font-normal" style={{ top: '268.0mm', left: '25.0mm', right: '25.0mm' }}>
                  <span className="font-bold text-slate-500">TERCERO:</span> Que la presente actuación no autentica la veracidad de los términos del contrato, ni juzga su forma, ni su contenido.
                </div>

                {/* Punto CUARTO: sincronizado con top: 314.5mm y top: 321.5mm */}
                <div className="absolute text-slate-400 text-[10pt] font-normal" style={{ top: '303.0mm', left: '25.0mm', right: '25.0mm' }}>
                  <span className="font-bold text-slate-500">CUARTO:</span> Que esta certificación la efectúo a requerimiento de las personas nombradas en el punto Primero,
                </div>
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '315.0mm', left: '25.0mm' }}>siendo las</div>
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '315.0mm', left: '98.5mm' }}>horas del día</div>
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '315.0mm', left: '134.5mm' }}>de</div>
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '322.0mm', left: '25.0mm' }}>del año</div>

                {/* Pie de firma y sello */}
                <div className="absolute text-center flex flex-col items-center" style={{ top: '338.0mm', left: '58.0mm', width: '100.0mm' }}>
                  <div className="w-60 border-b border-dotted border-slate-300 mb-1"></div>
                  <p className="font-bold text-[9px] uppercase tracking-wider text-slate-400">Firma y Sello del Notario</p>
                </div>
              </div>

              {/* CAPA DE DATOS (Interacción y posicionamiento milimétrico estricto) */}
              <div 
                className="capa-datos-certificacion absolute inset-0 z-10" 
                style={{ position: 'absolute', top: '0mm', left: '0mm', width: '215.9mm', height: '355.6mm', fontFamily: fontFamilyGlobal }}
              >
                {/* Cabecera: TITULAR, Registro, Ciudad Registro */}
                <input 
                  id="titular-notaria-cf"
                  type="text" 
                  value={firmasT1} 
                  onChange={(e) => setFirmasT1(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="TITULAR.-" 
                  style={{ position: 'absolute', top: '74.0mm', left: '99.2mm', width: '75mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-1 pos-cert-firmas-t1" 
                />
                <input 
                  id="registro-notaria-cf"
                  type="text" 
                  value={firmasT2} 
                  onChange={(e) => setFirmasT2(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="1.292.-" 
                  style={{ position: 'absolute', top: '86.0mm', left: '69.6mm', width: '33mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-1 pos-cert-firmas-t2" 
                />
                <input 
                  id="ciudad-registro-cf"
                  type="text" 
                  value={firmasT3} 
                  onChange={(e) => setFirmasT3(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="ITAKYRY.-" 
                  style={{ position: 'absolute', top: '86.0mm', left: '137.3mm', width: '50mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-1 pos-cert-firmas-t3" 
                />

                {/* Acto: Tipo de Acto y Objeto del Acto */}
                <input 
                  id="tipo-contrato-cf"
                  type="text" 
                  value={tramoPrimero1} 
                  onChange={(e) => setTramoPrimero1(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="CONTRATO PRIVADO DE" 
                  style={{ position: 'absolute', top: '124.0mm', left: '160.6mm', width: '48mm', height: '5.5mm', fontSize: '8pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-1 pos-cert-tramo1" 
                />
                <input 
                  id="objeto-acto-cf"
                  type="text" 
                  value={tramoPrimero2} 
                  onChange={(e) => setTramoPrimero2(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="VENTA DE VEHICULO..." 
                  style={{ position: 'absolute', top: '134.5mm', left: '31.5mm', width: '114mm', height: '5.5mm', fontSize: '8pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-1 pos-cert-tramo2" 
                />

                {/* Compareciente 1 (INCISO A): Nombre, Cédula, Ciudad */}
                <input 
                  id="compareciente-nombre-1"
                  type="text" 
                  value={incisoANombre} 
                  onChange={(e) => setIncisoANombre(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="Nombre completo" 
                  style={{ position: 'absolute', top: '146.0mm', left: '37.8mm', width: '94mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-1 pos-cert-inciso-a-nom" 
                />
                <input 
                  id="compareciente-cedula-1"
                  type="text" 
                  value={incisoADoc} 
                  onChange={(e) => setIncisoADoc(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="C.I. / RUC" 
                  style={{ position: 'absolute', top: '146.0mm', left: '154.3mm', width: '36mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-1 pos-cert-inciso-a-doc" 
                />
                <input 
                  id="compareciente-ciudad-1"
                  type="text" 
                  value={incisoADom} 
                  onChange={(e) => setIncisoADom(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="Ciudad / Domicilio" 
                  style={{ position: 'absolute', top: '157.0mm', left: '63.2mm', width: '124mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-1 pos-cert-inciso-a-dom" 
                />

                {/* Compareciente 2 (INCISO B): Nombre, Cédula, Ciudad */}
                <input 
                  id="compareciente-nombre-2"
                  type="text" 
                  value={incisoBNombre} 
                  onChange={(e) => setIncisoBNombre(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="Nombre completo (opcional)" 
                  style={{ position: 'absolute', top: '169.0mm', left: '37.8mm', width: '94mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-1 pos-cert-inciso-b-nom" 
                />
                <input 
                  id="compareciente-cedula-2"
                  type="text" 
                  value={incisoBDoc} 
                  onChange={(e) => setIncisoBDoc(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="C.I. / RUC" 
                  style={{ position: 'absolute', top: '169.0mm', left: '155.3mm', width: '36mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-1 pos-cert-inciso-b-doc" 
                />
                <input 
                  id="compareciente-ciudad-2"
                  type="text" 
                  value={incisoBDom} 
                  onChange={(e) => setIncisoBDom(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="Ciudad / Domicilio" 
                  style={{ position: 'absolute', top: '180.0mm', left: '63.2mm', width: '124mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-1 pos-cert-inciso-b-dom" 
                />

                {/* Compareciente 3 (INCISO C): Nombre, Cédula, Ciudad */}
                <input 
                  id="compareciente-nombre-3"
                  type="text" 
                  value={incisoCNombre} 
                  onChange={(e) => setIncisoCNombre(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="****************************************" 
                  style={{ position: 'absolute', top: '192.0mm', left: '37.8mm', width: '94mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-1 pos-cert-inciso-c-nom" 
                />
                <input 
                  id="compareciente-cedula-3"
                  type="text" 
                  value={incisoCDoc} 
                  onChange={(e) => setIncisoCDoc(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="****************" 
                  style={{ position: 'absolute', top: '192.0mm', left: '155.3mm', width: '36mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-1 pos-cert-inciso-c-doc" 
                />
                <input 
                  id="compareciente-ciudad-3"
                  type="text" 
                  value={incisoCDom} 
                  onChange={(e) => setIncisoCDom(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="****************************************" 
                  style={{ position: 'absolute', top: '203.0mm', left: '63.2mm', width: '124mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-1 pos-cert-inciso-c-dom" 
                />

                {/* Compareciente 4 (INCISO D): Nombre, Cédula, Ciudad */}
                <input 
                  id="compareciente-nombre-4"
                  type="text" 
                  value={incisoDNombre} 
                  onChange={(e) => setIncisoDNombre(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="****************************************" 
                  style={{ position: 'absolute', top: '215.5mm', left: '37.8mm', width: '94mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-1 pos-cert-inciso-d-nom" 
                />
                <input 
                  id="compareciente-cedula-4"
                  type="text" 
                  value={incisoDDoc} 
                  onChange={(e) => setIncisoDDoc(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="****************" 
                  style={{ position: 'absolute', top: '215.5mm', left: '154.3mm', width: '36mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-1 pos-cert-inciso-d-doc" 
                />
                <input 
                  id="compareciente-ciudad-4"
                  type="text" 
                  value={incisoDDom} 
                  onChange={(e) => setIncisoDDom(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="****************************************" 
                  style={{ position: 'absolute', top: '225.0mm', left: '63.2mm', width: '124mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-1 pos-cert-inciso-d-dom" 
                />

                {/* SEGUNDO: Libro/Tomo */}
                <input 
                  id="libro-tomo-cf"
                  type="text" 
                  value={tomoLibro} 
                  onChange={(e) => setTomoLibro(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="46-TOMO II" 
                  style={{ position: 'absolute', top: '248.0mm', left: '80.2mm', width: '55mm', height: '5.5mm', fontSize: '8pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-1 pos-cert-tomo" 
                />

                {/* Cierre/Fechas: Hora, Día, Mes, Año */}
                <input 
                  id="hora-certificacion"
                  type="text" 
                  value={horaCert} 
                  onChange={(e) => setHoraCert(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="16:55" 
                  style={{ position: 'absolute', top: '314.5mm', left: '79.4mm', width: '18mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-1 pos-cert-hora" 
                />
                <input 
                  id="dia-certificacion"
                  type="text" 
                  value={diaCert} 
                  onChange={(e) => setDiaCert(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="08" 
                  style={{ position: 'absolute', top: '314.5mm', left: '119.8mm', width: '13mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-1 pos-cert-dia" 
                />
                <input 
                  id="mes-certificacion"
                  type="text" 
                  value={mesCert} 
                  onChange={(e) => setMesCert(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="OCTUBRE" 
                  style={{ position: 'absolute', top: '314.5mm', left: '143.1mm', width: '44mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-1 pos-cert-mes" 
                />
                <input 
                  id="anio-letras-cierre"
                  type="text" 
                  value={anioCert} 
                  onChange={(e) => setAnioCert(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="DOS MIL VEINTISÉIS.-" 
                  style={{ position: 'absolute', top: '321.5mm', left: '60.6mm', width: '80mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-1 pos-cert-anio" 
                />
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PLANTILLA 2: CONCUERDA (COORDENADAS MATEMÁTICAS EXACTAS DEL WORD)        */}
          {/* ========================================================================= */}
          {tipoDocumento === 'Concuerda' && (
            <div
              id="contenedor-hoja-2"
              className="contenedor-hoja relative w-[215.9mm] h-[355.6mm] overflow-hidden bg-white"
              style={{ width: '215.9mm', height: '355.6mm', position: 'relative', overflow: 'hidden', background: 'white' }}
            >
              {/* ESTILOS FORZADOS Y CLASES DE POSICIONAMIENTO PARA CONCUERDA */}
              <style>{`
                /* Contenedor padre de la Hoja 2 (Pantalla e Impresión) */
                #contenedor-hoja-2,
                .contenedor-hoja {
                  position: relative !important;
                  width: 215.9mm !important;
                  height: 355.6mm !important;
                  overflow: hidden !important;
                  background: white !important;
                  margin: 0mm !important;
                  padding: 0mm !important;
                }

                /* Reglas estrictas para todos los campos hijos de Concuerda */
                #contenedor-hoja-2 .capa-datos-concuerda input,
                #contenedor-hoja-2 .capa-datos-concuerda .campo-hoja-2 {
                  position: absolute !important;
                  white-space: nowrap !important;
                  margin: 0mm !important;
                  padding: 0mm !important;
                  background: transparent;
                  font-family: Arial, Helvetica, sans-serif !important;
                  font-weight: bold !important;
                  line-height: 1 !important;
                }

                #contenedor-hoja-2 .capa-datos-concuerda .campo-hoja-2:hover {
                  background-color: rgba(254, 243, 199, 0.35);
                  border-bottom-color: #64748b;
                }

                #contenedor-hoja-2 .capa-datos-concuerda .campo-hoja-2:focus {
                  background-color: rgba(254, 243, 199, 0.55);
                  border-bottom-color: #FF3131;
                  outline: none;
                }

                /* Coordenadas absolutas milimétricas para los campos de Concuerda (215.9mm x 355.6mm) */
                #contenedor-hoja-2 .pos-matriz, #contenedor-hoja-2 #escritura-nro-concuerda, .pos-matriz, #escritura-nro-concuerda { top: 84.2mm !important; left: 140.5mm !important; font-size: 12pt !important; font-weight: bold !important; font-family: Arial, Helvetica, sans-serif !important; }
                #contenedor-hoja-2 .pos-folio, #contenedor-hoja-2 #fojas-concuerda, .pos-folio, #fojas-concuerda { top: 95.2mm !important; left: 36.8mm !important; font-size: 12pt !important; font-weight: bold !important; font-family: Arial, Helvetica, sans-serif !important; }
                #contenedor-hoja-2 .pos-division, #contenedor-hoja-2 #division-concuerda, .pos-division, #division-concuerda { top: 95.2mm !important; left: 142.6mm !important; font-size: 12pt !important; font-weight: bold !important; font-family: Arial, Helvetica, sans-serif !important; }
                #contenedor-hoja-2 .pos-seccion, #contenedor-hoja-2 #seccion-concuerda, .pos-seccion, #seccion-concuerda { top: 105.2mm !important; left: 47.3mm !important; font-size: 12pt !important; font-weight: bold !important; font-family: Arial, Helvetica, sans-serif !important; }
                #contenedor-hoja-2 .pos-registro, #contenedor-hoja-2 #registro-concuerda, .pos-registro, #registro-concuerda { top: 106.0mm !important; left: 108.7mm !important; font-size: 12pt !important; font-weight: bold !important; font-family: Arial, Helvetica, sans-serif !important; }
                #contenedor-hoja-2 .pos-asiento, #contenedor-hoja-2 #ciudad-concuerda, .pos-asiento, #ciudad-concuerda { top: 115.5mm !important; left: 78.0mm !important; font-size: 12pt !important; font-weight: bold !important; font-family: Arial, Helvetica, sans-serif !important; }
                #contenedor-hoja-2 .pos-autorizante, #contenedor-hoja-2 #notario-nombre-concuerda, .pos-autorizante, #notario-nombre-concuerda { top: 126.2mm !important; left: 57.9mm !important; font-size: 12pt !important; font-weight: bold !important; font-family: Arial, Helvetica, sans-serif !important; }
                #contenedor-hoja-2 .pos-caracter, #contenedor-hoja-2 #notario-caracter-concuerda, .pos-caracter, #notario-caracter-concuerda { top: 137.2mm !important; left: 90.0mm !important; font-size: 12pt !important; font-weight: bold !important; font-family: Arial, Helvetica, sans-serif !important; }
                #contenedor-hoja-2 .pos-copia, #contenedor-hoja-2 #copia-concuerda, .pos-copia, #copia-concuerda { top: 147.2mm !important; left: 59.0mm !important; font-size: 12pt !important; font-weight: bold !important; font-family: Arial, Helvetica, sans-serif !important; }
                #contenedor-hoja-2 .pos-destinatario, #contenedor-hoja-2 #destinatario-concuerda, .pos-destinatario, #destinatario-concuerda { top: 147.2mm !important; left: 121.4mm !important; font-size: 11.5pt !important; font-weight: bold !important; font-family: Arial, Helvetica, sans-serif !important; }
                #contenedor-hoja-2 .pos-linea-adicional, #contenedor-hoja-2 #linea-adicional-concuerda, .pos-linea-adicional, #linea-adicional-concuerda { top: 158.2mm !important; left: 26.2mm !important; font-size: 8pt !important; font-weight: bold !important; font-family: Arial, Helvetica, sans-serif !important; }
                #contenedor-hoja-2 .pos-dia, #contenedor-hoja-2 #dia-concuerda, .pos-dia, #dia-concuerda { top: 158.2mm !important; left: 100.3mm !important; font-size: 12pt !important; font-weight: bold !important; font-family: Arial, Helvetica, sans-serif !important; }
                #contenedor-hoja-2 .pos-mes, #contenedor-hoja-2 #mes-concuerda, .pos-mes, #mes-concuerda { top: 168.7mm !important; left: 34.6mm !important; font-size: 12pt !important; font-weight: bold !important; font-family: Arial, Helvetica, sans-serif !important; }
                #contenedor-hoja-2 .pos-anio, #contenedor-hoja-2 #anio-concuerda, .pos-anio, #anio-concuerda { top: 168.7mm !important; left: 81.2mm !important; font-size: 12pt !important; font-weight: bold !important; font-family: Arial, Helvetica, sans-serif !important; }

                @media print {
                  @page { size: 215.9mm 355.6mm; margin: 0mm !important; }
                  body, html { margin: 0mm !important; padding: 0mm !important; }
                  
                  /* Forzar al contenedor a mantener su marco de referencia */
                  #contenedor-hoja-2,
                  .contenedor-hoja {
                    position: relative !important;
                    width: 215.9mm !important;
                    height: 355.6mm !important;
                    overflow: hidden !important;
                    background: white !important;
                    display: block !important;
                    margin: 0mm !important;
                    padding: 0mm !important;
                  }
                  
                  /* Evitar que el CSS base convierta los inputs absolutos en estáticos */
                  .input-impresion {
                    position: absolute !important;
                    white-space: nowrap !important;
                    border: none !important;
                    background: transparent !important;
                    color: black !important;
                    box-shadow: none !important;
                    margin: 0mm !important;
                    padding: 0mm !important;
                    font-family: Arial, Helvetica, sans-serif !important;
                  }
                }
              `}</style>
              
              {/* CAPA DE GUÍA VISUAL (Solo visible en pantalla, sincronizada con los 14 campos de Concuerda) */}
              <div className={`absolute inset-0 pointer-events-none z-0 print:hidden transition-opacity duration-300 ${mostrarGuia ? 'opacity-100' : 'opacity-0'} guia-impresion`}>
                {/* Cabecera preimpresa Hoja de Seguridad */}
                <div className="absolute flex items-start justify-between border-b-2 border-slate-300 pb-3" style={{ top: '18mm', left: '26.2mm', right: '25mm' }}>
                  <div>
                    <h2 className="font-black text-sm uppercase tracking-wider text-slate-500">CORTE SUPREMA DE JUSTICIA</h2>
                    <p className="text-[11px] font-bold text-slate-400">REPÚBLICA DEL PARAGUAY</p>
                    <p className="text-[10px] font-bold mt-0.5 text-red-400">HOJA DE SEGURIDAD NOTARIAL - CONCUERDA</p>
                  </div>
                  <div className="border border-dashed border-slate-300 p-1.5 text-center w-20 h-16 flex flex-col items-center justify-center bg-slate-50/60 shrink-0">
                    <span className="text-[9px] font-mono font-bold text-slate-400">SELLO / QR</span>
                    <span className="text-[8px] text-slate-400">PREIMPRESO</span>
                  </div>
                </div>

                {/* Renglón 1 (top: 84.2mm) */}
                <div className="absolute text-slate-400 text-[10.5pt] font-normal tracking-widest whitespace-nowrap" style={{ top: '84.5mm', left: '26.2mm' }}>...///... C U E R D A</div>
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '84.5mm', left: '80.0mm' }}>fielmente con su escritura matriz Nº</div>
                 
                {/* Renglón 2 (top: 95.2mm) */}
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '95.5mm', left: '26.2mm' }}>folio</div>
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '95.5mm', left: '93.0mm' }}>del Protocolo de la División</div>
                 
                {/* Renglón 3 (top: 105.2mm / 106.0mm) */}
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '105.5mm', left: '26.2mm' }}>Sección “</div>
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '106.2mm', left: '60.5mm' }}>” del Registro Notarial Nº</div>
                 
                {/* Renglón 4 (top: 115.5mm) */}
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '115.8mm', left: '26.2mm' }}>con asiento en</div>
                 
                {/* Renglón 5 (top: 126.2mm) */}
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '126.5mm', left: '26.2mm' }}>y autorizada por</div>
                 
                {/* Renglón 6 (top: 137.2mm) */}
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '137.5mm', left: '26.2mm' }}>en el carácter de</div>
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '137.5mm', left: '148.0mm' }}>de dicho Registro,</div>
                 
                {/* Renglón 7 (top: 147.2mm) */}
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '147.5mm', left: '26.2mm' }}>expido esta</div>
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '147.5mm', left: '99.0mm' }}>copia para</div>
                 
                {/* Renglón 8 (top: 158.2mm) */}
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '158.5mm', left: '89.0mm' }}>a los</div>
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '158.5mm', left: '160.5mm' }}>días del mes</div>
                 
                {/* Renglón 9 (top: 168.7mm) */}
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '169.0mm', left: '26.2mm' }}>de</div>
                <div className="absolute text-slate-400 text-[10.5pt] font-normal whitespace-nowrap" style={{ top: '169.0mm', left: '68.0mm' }}>del año</div>

                {/* Pie de firma y sello */}
                <div className="absolute text-center flex flex-col items-center" style={{ top: '215.0mm', left: '58.0mm', width: '100.0mm' }}>
                  <div className="w-60 border-b border-dotted border-slate-300 mb-1"></div>
                  <p className="font-bold text-[9px] uppercase tracking-wider text-slate-400">Firma y Sello del Notario</p>
                </div>
              </div>

              {/* CAPA DE DATOS (Interacción y posicionamiento milimétrico estricto) */}
              <div 
                className="capa-datos-concuerda absolute inset-0 z-10" 
                style={{ position: 'absolute', top: '0mm', left: '0mm', width: '215.9mm', height: '355.6mm', fontFamily: 'Arial, Helvetica, sans-serif' }}
              >
                 {/* N° Escritura */}
                 <input
                   id="escritura-nro-concuerda"
                   type="text"
                   value={matrizNro}
                   onChange={(e) => setMatrizNro(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="49.-----------------"
                   style={{ position: 'absolute', top: '84.2mm', left: '140.5mm', width: '50mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-2 pos-matriz"
                 />
                 
                 {/* Fojas, Sección (CIVIL), Serie/Letra (B) */}
                 <input
                   id="fojas-concuerda"
                   type="text"
                   value={folioConcuerda}
                   onChange={(e) => setFolioConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="137 y siguiente"
                   style={{ position: 'absolute', top: '95.2mm', left: '36.8mm', width: '54mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-2 pos-folio"
                 />
                 
                 <input
                   id="division-concuerda"
                   type="text"
                   value={divisionConcuerda}
                   onChange={(e) => setDivisionConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="CIVIL"
                   style={{ position: 'absolute', top: '95.2mm', left: '142.6mm', width: '44.5mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-2 pos-division"
                 />
                 
                 <input
                   id="seccion-concuerda"
                   type="text"
                   value={seccionConcuerda}
                   onChange={(e) => setSeccionConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="B"
                   style={{ position: 'absolute', top: '105.2mm', left: '47.3mm', width: '12mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-2 pos-seccion"
                 />
                 
                 {/* N° Registro y Ciudad */}
                 <input
                   id="registro-concuerda"
                   type="text"
                   value={registroConcuerda}
                   onChange={(e) => setRegistroConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="1.292"
                   style={{ position: 'absolute', top: '106.0mm', left: '108.7mm', width: '74mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-2 pos-registro"
                 />
                 
                 <input
                   id="ciudad-concuerda"
                   type="text"
                   value={asientoConcuerda}
                   onChange={(e) => setAsientoConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="ITAKYRY"
                   style={{ position: 'absolute', top: '115.5mm', left: '78.0mm', width: '105mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-2 pos-asiento"
                 />
                 
                 {/* Nombre Escribano y Cargo */}
                 <input
                   id="notario-nombre-concuerda"
                   type="text"
                   value={autorizanteConcuerda}
                   onChange={(e) => setAutorizanteConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="RICARDO GABRIEL MARTINEZ VARELA"
                   style={{ position: 'absolute', top: '126.2mm', left: '57.9mm', width: '125mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-2 pos-autorizante"
                 />
                 
                 <input
                   id="notario-caracter-concuerda"
                   type="text"
                   value={caracterConcuerda}
                   onChange={(e) => setCaracterConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="TITULAR"
                   style={{ position: 'absolute', top: '137.2mm', left: '90.0mm', width: '56mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-2 pos-caracter"
                 />
                 
                 {/* Copia y A favor de */}
                 <input
                   id="copia-concuerda"
                   type="text"
                   value={copiaConcuerda}
                   onChange={(e) => setCopiaConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="PRIMERA"
                   style={{ position: 'absolute', top: '147.2mm', left: '59.0mm', width: '38mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-2 pos-copia"
                 />
                 
                 <input
                   id="destinatario-concuerda"
                   type="text"
                   value={destinatarioConcuerda}
                   onChange={(e) => setDestinatarioConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="WHILHEM OSVALDO..."
                   style={{ position: 'absolute', top: '147.2mm', left: '121.4mm', width: '72mm', height: '6mm', fontSize: '11.5pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-2 pos-destinatario"
                 />
                 
                 {/* Línea de guiones de relleno izquierdo */}
                 <input
                   id="linea-adicional-concuerda"
                   type="text"
                   value={lineaAdicionalConcuerda}
                   onChange={(e) => setLineaAdicionalConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="-----------------------------------------------------"
                   style={{ position: 'absolute', top: '158.2mm', left: '26.2mm', width: '61mm', height: '5.5mm', fontSize: '8pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-2 pos-linea-adicional"
                 />

                 {/* Día, Mes, Año de expedición */}
                 <input
                   id="dia-concuerda"
                   type="text"
                   value={diaLetrasConcuerda}
                   onChange={(e) => setDiaLetrasConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="VEINTITRES"
                   style={{ position: 'absolute', top: '158.2mm', left: '100.3mm', width: '58mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-2 pos-dia"
                 />
                 
                 <input
                   id="mes-concuerda"
                   type="text"
                   value={mesConcuerda}
                   onChange={(e) => setMesConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="MAYO"
                   style={{ position: 'absolute', top: '168.7mm', left: '34.6mm', width: '32mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-2 pos-mes"
                 />
                 
                 <input
                   id="anio-concuerda"
                   type="text"
                   value={anioLetrasConcuerda}
                   onChange={(e) => setAnioLetrasConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="DOS MIL VEINTICINCO.-"
                   style={{ position: 'absolute', top: '168.7mm', left: '81.2mm', width: '101.5mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="absolute whitespace-nowrap bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black font-bold focus:outline-none input-impresion campo-hoja-2 pos-anio"
                 />

              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PLANTILLA 3: LEGALIZACIÓN (HOJA 3 - COORDENADAS ABSOLUTAS EN MILÍMETROS) */}
          {/* ========================================================================= */}
          {tipoDocumento === 'Legalización' && (
            <div
              id="contenedor-hoja-3"
              className="contenedor-hoja relative w-[215.9mm] h-[355.6mm] overflow-hidden bg-white"
              style={{ width: '215.9mm', height: '355.6mm', position: 'relative', overflow: 'hidden', background: 'white' }}
            >
              <style>{`
                #contenedor-hoja-3, .contenedor-hoja {
                  position: relative !important;
                  width: 215.9mm !important;
                  height: 355.6mm !important;
                  max-height: 355.6mm !important;
                  overflow: hidden !important;
                  background: white !important;
                  box-sizing: border-box !important;
                  margin: 0mm !important;
                  padding: 0mm !important;
                }

                .capa-datos-legalizacion {
                  position: absolute !important;
                  top: 0mm !important;
                  left: 0mm !important;
                  width: 215.9mm !important;
                  height: 355.6mm !important;
                  margin: 0mm !important;
                  padding: 0mm !important;
                }

                #contenedor-hoja-3 .capa-datos-legalizacion input,
                #contenedor-hoja-3 .capa-datos-legalizacion .campo-hoja-3,
                #contenedor-hoja-3 .capa-datos-legalizacion .input-impresion {
                  position: absolute !important;
                  white-space: nowrap !important;
                  background: transparent;
                  font-family: "Times New Roman", Times, serif !important;
                  font-size: 11pt !important;
                  line-height: 1 !important;
                  margin: 0mm !important;
                  padding: 0mm !important;
                }

                #contenedor-hoja-3 .capa-datos-legalizacion .campo-hoja-3:hover {
                  background-color: rgba(254, 243, 199, 0.35);
                  border-bottom-color: #64748b;
                }

                #contenedor-hoja-3 .capa-datos-legalizacion .campo-hoja-3:focus {
                  background-color: rgba(254, 243, 199, 0.55);
                  border-bottom-color: #FF3131;
                  outline: none;
                }

                #contenedor-hoja-3 #notaria-titular, #contenedor-hoja-3 .pos-leg-notaria, #notaria-titular, .pos-leg-notaria { position: absolute !important; top: 97.5mm !important; left: 108.0mm !important; width: 92.0mm; height: 5.5mm; font-size: 11pt !important; font-weight: bold !important; font-style: italic !important; font-family: "Times New Roman", Times, serif !important; white-space: nowrap !important; }
                #contenedor-hoja-3 #numero-registro, #contenedor-hoja-3 .pos-leg-registro, #numero-registro, .pos-leg-registro { position: absolute !important; top: 111.0mm !important; left: 141.0mm !important; width: 58.0mm; height: 5.5mm; font-size: 11pt !important; font-weight: normal !important; font-style: normal !important; font-family: "Times New Roman", Times, serif !important; white-space: nowrap !important; }
                #contenedor-hoja-3 #fecha-emision-leg, #contenedor-hoja-3 .pos-leg-fecha-doc, #fecha-emision-leg, .pos-leg-fecha-doc { position: absolute !important; top: 124.5mm !important; left: 47.0mm !important; width: 40.0mm; height: 5.5mm; font-size: 11pt !important; font-weight: normal !important; font-style: normal !important; font-family: "Times New Roman", Times, serif !important; white-space: nowrap !important; }
                #contenedor-hoja-3 #control-hoja-leg, #contenedor-hoja-3 .pos-leg-control, #control-hoja-leg, .pos-leg-control { position: absolute !important; top: 124.5mm !important; left: 102.0mm !important; width: 55.0mm; height: 5.5mm; font-size: 11pt !important; font-weight: normal !important; font-style: normal !important; font-family: "Times New Roman", Times, serif !important; white-space: nowrap !important; }
                #contenedor-hoja-3 #dia-legalizacion, #contenedor-hoja-3 .pos-leg-dia, #dia-legalizacion, .pos-leg-dia { position: absolute !important; top: 150.0mm !important; left: 127.0mm !important; width: 12.0mm; height: 5.5mm; font-size: 11pt !important; font-weight: normal !important; font-style: normal !important; font-family: "Times New Roman", Times, serif !important; white-space: nowrap !important; }
                #contenedor-hoja-3 #mes-anio-legalizacion, #contenedor-hoja-3 .pos-leg-mes, #mes-anio-legalizacion, .pos-leg-mes { position: absolute !important; top: 150.0mm !important; left: 156.0mm !important; width: 26.0mm; height: 5.5mm; font-size: 11pt !important; font-weight: normal !important; font-style: normal !important; font-family: "Times New Roman", Times, serif !important; white-space: nowrap !important; }
                #contenedor-hoja-3 #anio-legalizacion, #contenedor-hoja-3 .pos-leg-anio, #anio-legalizacion, .pos-leg-anio { position: absolute !important; top: 150.0mm !important; left: 195.0mm !important; width: 16.0mm; height: 5.5mm; font-size: 11pt !important; font-weight: normal !important; font-style: normal !important; font-family: "Times New Roman", Times, serif !important; white-space: nowrap !important; }

                @media print {
                  @page { size: 215.9mm 355.6mm; margin: 0mm !important; }
                  body, html {
                    width: 215.9mm !important;
                    height: 355.6mm !important;
                    margin: 0mm !important;
                    padding: 0mm !important;
                    overflow: hidden !important;
                  }

                  #contenedor-hoja-3, .contenedor-hoja {
                    position: relative !important;
                    width: 215.9mm !important;
                    height: 355.6mm !important;
                    max-height: 355.6mm !important;
                    overflow: hidden !important;
                    background: white !important;
                    display: block !important;
                    margin: 0mm !important;
                    padding: 0mm !important;
                  }

                  .capa-datos-legalizacion {
                    position: absolute !important;
                    top: 0mm !important;
                    left: 0mm !important;
                    width: 215.9mm !important;
                    height: 355.6mm !important;
                  }

                  #contenedor-hoja-3 .capa-datos-legalizacion input,
                  #contenedor-hoja-3 .capa-datos-legalizacion .campo-hoja-3,
                  #contenedor-hoja-3 .capa-datos-legalizacion .input-impresion {
                    position: absolute !important;
                    white-space: nowrap !important;
                    border: none !important;
                    background: transparent !important;
                    color: black !important;
                    box-shadow: none !important;
                    font-family: "Times New Roman", Times, serif !important;
                    font-size: 11pt !important;
                    line-height: 1 !important;
                    margin: 0mm !important;
                    padding: 0mm !important;
                  }
                }
              `}</style>
              {/* CABECERA GUÍA Y ESTRUCTURAL (Sincronizada al milímetro con los 7 campos de Legalización) */}
              <div className={`absolute inset-0 pointer-events-none z-0 print:hidden transition-opacity duration-300 ${mostrarGuia ? 'opacity-100' : 'opacity-0'} guia-impresion`}>
                <div className="absolute flex items-start justify-between border-b-2 border-slate-300 pb-3" style={{ top: '18mm', left: '25mm', right: '25mm' }}>
                  <div>
                    <h2 className="font-black text-sm uppercase tracking-wider text-slate-500 whitespace-nowrap">CORTE SUPREMA DE JUSTICIA</h2>
                    <p className="text-[11px] font-bold text-slate-400 whitespace-nowrap">REPÚBLICA DEL PARAGUAY</p>
                    <p className="text-[10px] font-bold mt-0.5 text-red-400 whitespace-nowrap">LEGALIZACIÓN - ACTUACIÓN NOTARIAL (Serie PJH-2022)</p>
                  </div>
                  <div className="border border-dashed border-slate-300 p-1.5 text-center w-20 h-16 flex flex-col items-center justify-center bg-slate-50/60 shrink-0">
                    <span className="text-[9px] font-mono font-bold text-slate-400 whitespace-nowrap">QR PJE</span>
                    <span className="text-[8px] text-slate-400 whitespace-nowrap">SEC-2022</span>
                  </div>
                </div>

                <div className="absolute text-slate-400 text-[10.5pt] whitespace-nowrap" style={{ top: '86.0mm', left: '25.0mm' }}>La CORTE SUPREMA DE JUSTICIA, legaliza la firma y</div>
                <div className="absolute text-slate-400 text-[10.5pt] whitespace-nowrap" style={{ top: '97.8mm', left: '25.0mm' }}>sello del/la Notario/a y Escribano/a Público/a:</div>
                <div className="absolute text-slate-400 text-[10.5pt] whitespace-nowrap" style={{ top: '111.3mm', left: '25.0mm' }}>Titular del Registro Notarial Número:</div>
                <div className="absolute text-slate-400 text-[10.5pt] whitespace-nowrap" style={{ top: '124.8mm', left: '25.0mm' }}>de fecha</div>
                <div className="absolute text-slate-400 text-[10.5pt] whitespace-nowrap" style={{ top: '124.8mm', left: '88.5mm' }}>Control Nº</div>
                <div className="absolute text-slate-400 text-[10pt]" style={{ top: '137.5mm', left: '25.0mm', right: '25.0mm' }}>La presente Legalización se realiza sobre un documento de uso notarial expedido a nombre del/la Notario/a solicitante.</div>
                <div className="absolute text-slate-400 text-[10.5pt] whitespace-nowrap" style={{ top: '150.3mm', left: '95.0mm' }}>Asunción, a los</div>
                <div className="absolute text-slate-400 text-[10.5pt] whitespace-nowrap" style={{ top: '150.3mm', left: '141.0mm' }}>días de</div>
                <div className="absolute text-slate-400 text-[10.5pt] whitespace-nowrap" style={{ top: '150.3mm', left: '184.0mm' }}>de</div>

                {/* Pie de firma y sello */}
                <div className="absolute text-center flex flex-col items-center" style={{ top: '205.0mm', left: '58.0mm', width: '100.0mm' }}>
                  <div className="w-60 border-b border-dotted border-slate-300 mb-1"></div>
                  <p className="font-bold text-[9px] uppercase tracking-wider text-slate-400">Firma y Sello de Legalización</p>
                </div>
              </div>

              {/* CAPA DE DATOS EN COORDENADAS FÍSICAS EXACTAS (mm) */}
              <div
                className="capa-datos-legalizacion absolute inset-0 z-10"
                style={{ position: 'absolute', top: '0mm', left: '0mm', width: '215.9mm', height: '355.6mm', fontSize: '11pt', fontFamily: '"Times New Roman", Times, serif' }}
              >
                {/* Notario: Nombre y Registro */}
                <input 
                  id="notaria-titular"
                  type="text" 
                  value={nombreNotarioLeg} 
                  onChange={(e) => setNombreNotarioLeg(e.target.value)} 
                  onKeyDown={handleEnterKey}
                  style={{ position: 'absolute', top: '97.5mm', left: '108.0mm', width: '92mm', height: '5.5mm', fontSize: '11pt', fontWeight: 'bold', fontStyle: 'italic', fontFamily: '"Times New Roman", Times, serif', whiteSpace: 'nowrap' }}
                  className="pos-leg-notaria campo-hoja-3 absolute bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent font-bold italic text-black focus:outline-none input-impresion whitespace-nowrap" 
                  placeholder="MARCELA MIRTA GÓMEZ NAVARRO"
                />
                <input 
                  id="numero-registro"
                  type="text" 
                  value={escrituraNroLeg} 
                  onChange={(e) => setEscrituraNroLeg(e.target.value)} 
                  onKeyDown={handleEnterKey}
                  style={{ position: 'absolute', top: '111.0mm', left: '141.0mm', width: '58mm', height: '5.5mm', fontSize: '11pt', fontWeight: 'normal', fontStyle: 'normal', fontFamily: '"Times New Roman", Times, serif', whiteSpace: 'nowrap' }}
                  className="pos-leg-registro campo-hoja-3 absolute bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black focus:outline-none input-impresion whitespace-nowrap" 
                  placeholder="SEIS (6).-"
                />

                {/* Documento Base: Fecha doc y Control */}
                <input 
                  id="fecha-emision-leg"
                  type="text" 
                  value={fechaEscrituraLeg} 
                  onChange={(e) => setFechaEscrituraLeg(e.target.value)} 
                  onKeyDown={handleEnterKey}
                  style={{ position: 'absolute', top: '124.5mm', left: '47.0mm', width: '40mm', height: '5.5mm', fontSize: '11pt', fontWeight: 'normal', fontStyle: 'normal', fontFamily: '"Times New Roman", Times, serif', whiteSpace: 'nowrap' }}
                  className="pos-leg-fecha-doc campo-hoja-3 absolute bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black focus:outline-none input-impresion whitespace-nowrap" 
                  placeholder="15 de febrero del 2022.-"
                />
                <input 
                  id="control-hoja-leg"
                  type="text" 
                  value={hojaSeguridadNroLeg} 
                  onChange={(e) => setHojaSeguridadNroLeg(e.target.value)} 
                  onKeyDown={handleEnterKey}
                  style={{ position: 'absolute', top: '124.5mm', left: '102.0mm', width: '55mm', height: '5.5mm', fontSize: '11pt', fontWeight: 'normal', fontStyle: 'normal', fontFamily: '"Times New Roman", Times, serif', whiteSpace: 'nowrap' }}
                  className="pos-leg-control campo-hoja-3 absolute bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black focus:outline-none input-impresion whitespace-nowrap" 
                  placeholder="000019301.-"
                />

                {/* Fecha Legalización: Día, Mes, Año */}
                <input 
                  id="dia-legalizacion"
                  type="text" 
                  value={diaLeg} 
                  onChange={(e) => setDiaLeg(e.target.value)} 
                  onKeyDown={handleEnterKey}
                  style={{ position: 'absolute', top: '150.0mm', left: '127.0mm', width: '12mm', height: '5.5mm', fontSize: '11pt', fontWeight: 'normal', fontStyle: 'normal', fontFamily: '"Times New Roman", Times, serif', whiteSpace: 'nowrap' }}
                  className="pos-leg-dia campo-hoja-3 absolute bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black focus:outline-none input-impresion whitespace-nowrap" 
                  placeholder="00"
                />
                <input 
                  id="mes-anio-legalizacion"
                  type="text" 
                  value={mesLeg} 
                  onChange={(e) => setMesLeg(e.target.value)} 
                  onKeyDown={handleEnterKey}
                  style={{ position: 'absolute', top: '150.0mm', left: '156.0mm', width: '26mm', height: '5.5mm', fontSize: '11pt', fontWeight: 'normal', fontStyle: 'normal', fontFamily: '"Times New Roman", Times, serif', whiteSpace: 'nowrap' }}
                  className="pos-leg-mes campo-hoja-3 absolute bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black focus:outline-none input-impresion whitespace-nowrap" 
                  placeholder="abril"
                />
                <input 
                  id="anio-legalizacion"
                  type="text" 
                  value={anioLeg} 
                  onChange={(e) => setAnioLeg(e.target.value)} 
                  onKeyDown={handleEnterKey}
                  style={{ position: 'absolute', top: '150.0mm', left: '195.0mm', width: '16mm', height: '5.5mm', fontSize: '11pt', fontWeight: 'normal', fontStyle: 'normal', fontFamily: '"Times New Roman", Times, serif', whiteSpace: 'nowrap' }}
                  className="pos-leg-anio campo-hoja-3 absolute bg-transparent border-b border-dotted border-slate-300 hover:border-slate-500 focus:border-[#FF3131] transition-colors print:border-transparent text-black focus:outline-none input-impresion whitespace-nowrap" 
                  placeholder="2022"
                />
              </div>
            </div>
          )}
          {/* ========================================================================= */}
          {/* PLANTILLA 0: SELLADO NOTARIAL - PROTOCOLO (25 RENGLONES Y TEXTO VERTICAL)   */}
          {/* ========================================================================= */}
          {tipoDocumento === 'Sellado Notarial - Protocolo' && (
            <div id="contenedor-paginas-protocolo" className="flex flex-col gap-12 print:gap-0 print:py-0 print:m-0 print:p-0 print:bg-white items-center bg-slate-100 py-8">
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
                          onClick={() => {
                            setMostrarEjemploLomo(false);
                            const inputLomo = document.getElementById('input-lomo-registro');
                            if (inputLomo) inputLomo.focus();
                          }}
                          className={`texto-vertical-sello lomo-impresion z-10 print:visible ${
                            mostrarEjemploLomo ? 'cursor-pointer hover:opacity-80' : 'pointer-events-none'
                          }`}
                          title={mostrarEjemploLomo ? 'Haga clic para borrar el ejemplo y escribir texto de registro' : ''}
                          style={{ position: 'absolute', left: '15mm', top: '42.55mm', width: '12mm', height: '211.75mm', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          {(protocoloTextoVertical.trim() !== '' || mostrarEjemploLomo) && (
                            <span
                              className={`texto-vertical-contenido text-[7pt] tracking-[0.5mm] whitespace-nowrap ${
                                !protocoloTextoVertical.trim() && mostrarEjemploLomo
                                  ? 'text-slate-400 italic font-normal print:hidden'
                                  : 'text-slate-700 font-bold print:text-black'
                              }`}
                              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', display: 'inline-block' }}
                            >
                              {protocoloTextoVertical.trim() !== '' ? protocoloTextoVertical : TEXTO_EJEMPLO_LOMO}
                            </span>
                          )}
                        </div>
                      )}

                      {/* CAPA 2: EDITOR EN PANTALLA */}
                      <textarea
                        ref={(el) => { textareasRefs.current[index] = el; }}
                        value={textoPagina}
                        onChange={(e) => handleTextareaChange(index, e)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onClick={() => limpiarTextoEjemplo(index)}
                        onFocus={() => limpiarTextoEjemplo(index)}
                        placeholder={`Redacte aquí la ${isAnverso ? 'cara frontal (Anverso)' : 'cara trasera (Reverso)'}...`}
                        className={`absolute z-20 bg-transparent outline-none border-none resize-none print:hidden selection:bg-red-100 overflow-hidden cursor-text ${
                          textoPagina === TEXTO_EJEMPLO_PROTOCOLO
                            ? 'text-slate-400 italic font-normal'
                            : 'text-black font-bold text-justify'
                        }`}
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
                        {textoPagina === TEXTO_EJEMPLO_PROTOCOLO ? '' : textoPagina}
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
