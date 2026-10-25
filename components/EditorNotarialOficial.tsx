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
  fontSizeGlobal: '15px',
  fontFamilyGlobal: 'Arial, Helvetica, sans-serif',
  interlineadoGlobal: 10.2,
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
        fontSizeGlobal: parsed.fontSizeGlobal || '15px',
        fontFamilyGlobal: parsed.fontFamilyGlobal || 'Arial, Helvetica, sans-serif',
        interlineadoGlobal: typeof parsed.interlineadoGlobal === 'number' ? parsed.interlineadoGlobal : 10.2,
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
}

export const EditorNotarialOficial: React.FC<EditorNotarialOficialProps> = ({ onVolver }) => {
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumentoNotarial>('Concuerda');
  const [mostrarGuia, setMostrarGuia] = useState<boolean>(true);
  const [rellenoGuiones, setRellenoGuiones] = useState<boolean>(true);

  // Carga inicial independiente para la plantilla activa por defecto ('Concuerda')
  const initialConfig = cargarConfiguracionHoja('Concuerda');
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
  const [tramoPrimero1, setTramoPrimero1] = useState<string>('contrato privado de compraventa de fecha 10/05/2026');
  const [tramoPrimero2, setTramoPrimero2] = useState<string>('suscrito entre las partes comparecientes');
  const [tramoPrimero3, setTramoPrimero3] = useState<string>('y ratificado en todas sus partes ante mi presencia');

  // Incisos a, b, c, d
  const [incisoANombre, setIncisoANombre] = useState<string>('JUAN CARLOS PÉREZ GÓMEZ');
  const [incisoADoc, setIncisoADoc] = useState<string>('C.I. Nº 1.234.567');
  const [incisoADom, setIncisoADom] = useState<string>('Avda. Paraguay c/ Mcal. Estigarribia');

  const [incisoBNombre, setIncisoBNombre] = useState<string>('');
  const [incisoBDoc, setIncisoBDoc] = useState<string>('');
  const [incisoBDom, setIncisoBDom] = useState<string>('');

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
  const [mesCert, setMesCert] = useState<string>('Mayo');
  const [anioCert, setAnioCert] = useState<string>('2026');

  // PLANTILLA 2: Concuerda
  const [matrizNro, setMatrizNro] = useState<string>('');
  const [folioConcuerda, setFolioConcuerda] = useState<string>('');
  const [divisionConcuerda, setDivisionConcuerda] = useState<string>('');
  const [seccionConcuerda, setSeccionConcuerda] = useState<string>('');
  const [registroConcuerda, setRegistroConcuerda] = useState<string>('');
  const [asientoConcuerda, setAsientoConcuerda] = useState<string>('');
  const [autorizanteConcuerda, setAutorizanteConcuerda] = useState<string>('');
  const [caracterConcuerda, setCaracterConcuerda] = useState<string>('');
  const [copiaConcuerda, setCopiaConcuerda] = useState<string>('');
  const [destinatarioConcuerda, setDestinatarioConcuerda] = useState<string>('');
  const [lineaAdicionalConcuerda, setLineaAdicionalConcuerda] = useState<string>('');
  const [cierreConcuerda, setCierreConcuerda] = useState<string>('');
  const [diaLetrasConcuerda, setDiaLetrasConcuerda] = useState<string>('');
  const [mesConcuerda, setMesConcuerda] = useState<string>('');
  const [anioLetrasConcuerda, setAnioLetrasConcuerda] = useState<string>('');

  // PLANTILLA 3: Legalización
  const [nombreNotarioLeg, setNombreNotarioLeg] = useState<string>('');
  const [lineaAdicionalLeg, setLineaAdicionalLeg] = useState<string>('');
  const [escrituraNroLeg, setEscrituraNroLeg] = useState<string>('');
  const [fechaEscrituraLeg, setFechaEscrituraLeg] = useState<string>('');
  const [hojaSeguridadNroLeg, setHojaSeguridadNroLeg] = useState<string>('');
  const [diaLeg, setDiaLeg] = useState<string>('');
  const [mesLeg, setMesLeg] = useState<string>('');
  const [anioLeg, setAnioLeg] = useState<string>('');

  // PLANTILLA 0: Protocolo
  const [protocoloTextoVertical, setProtocoloTextoVertical] = useState<string>('PARA REGISTROS PÚBLICOS CIVIL Y COMERCIAL - PROTOCOLO NOTARIAL');
  const [protocoloPaginas, setProtocoloPaginas] = useState<string[]>(['']);
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
       CONFIGURACIÓN DE PÁGINA Y ESCALADO (92% PARA EVITAR HOJAS EN BLANCO)
       ========================================================================== */
    @page { 
      margin: 0 !important; 
      size: 216mm 330mm portrait; 
    }
    
    html, body { 
      margin: 0 !important; 
      padding: 0 !important; 
      background: #ffffff !important; 
      -webkit-print-color-adjust: exact; 
      print-color-adjust: exact; 
      zoom: ${tipoDocumento === 'Sellado Notarial - Protocolo' ? '0.92' : '1.0'} !important; 
    }
    
    * { 
      box-sizing: border-box !important; 
    }

    #lienzo-notarial {
      box-shadow: none !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    /* HOJAS NOTARIALES (Oficio / Legal: 216mm x 330mm) */
    .hoja-notarial {
      width: 216mm !important;
      height: 330mm !important;
      max-height: 330mm !important;
      position: relative !important;
      overflow: hidden !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-after: always !important;
      break-after: page !important;
      margin: 0 !important;
      padding: 0 !important;
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
    .plantilla-unica-hoja {
      width: 216mm !important;
      height: 330mm !important;
      max-height: 330mm !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      background: #ffffff !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
      margin: 0 auto !important;
      box-shadow: none !important;
    }

    /* SIMETRÍA DOBLE FAZ NOTARIAL */
    .pagina-anverso > div.z-20 {
      padding: 55mm 15mm 25mm 45mm !important;
      box-sizing: border-box !important;
    }

    .pagina-reverso > div.z-20 {
      padding: 55mm 45mm 25mm 15mm !important;
      box-sizing: border-box !important;
    }

    /* CAJA FIJA LOMO (Texto vertical anclado a 15mm) */
    .caja-fija-lomo {
      position: absolute !important;
      left: 15mm !important;
      bottom: 25mm !important;
      width: 250mm !important;
      height: 15mm !important;
      display: flex !important;
      align-items: center !important;
      justify-content: flex-start !important;
      transform-origin: bottom left !important;
      transform: rotate(-90deg) !important;
      z-index: 9999 !important;
      pointer-events: none !important;
    }

    .caja-fija-lomo span {
      white-space: nowrap !important;
      text-transform: uppercase !important;
      color: #000000 !important;
      font-size: 9px !important;
      font-weight: 900 !important;
      letter-spacing: 2px !important;
      font-family: "Times New Roman", Times, serif !important;
    }

    /* TIPOGRAFÍA NOTARIAL DE ALTA PRECISIÓN (10.2mm de interlineado) */
    .print\\:block, [class*="print:block"] {
      font-family: "Times New Roman", Times, serif !important;
      font-size: 15px !important;
      line-height: 10.2mm !important;
      text-align: justify !important;
      text-justify: inter-word !important;
      white-space: pre-wrap !important;
      color: #000000 !important;
      display: block !important;
      margin: 0 !important;
      padding: 0 !important;
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
    <div className="min-h-screen bg-slate-900/95 text-slate-100 flex flex-col font-sans">
      {/* Estilos de Paginación Estricta de 25 líneas con Simetría Doble Faz (Anverso/Reverso) */}
      <style>{`
        .pagina-anverso { padding-left: 45mm; padding-right: 15mm; }
        .pagina-reverso { padding-left: 15mm; padding-right: 45mm; }
        .lomo-impresion, .texto-vertical-sello { position: absolute !important; left: 15mm !important; top: 55mm !important; bottom: 25mm !important; width: 15mm !important; height: 250mm !important; display: flex !important; align-items: center !important; justify-content: center !important; writing-mode: vertical-rl !important; transform: rotate(180deg) !important; z-index: 100 !important; pointer-events: none !important; }
        @media print {
          @page {
            size: 216mm 330mm portrait;
            margin-top: 55mm !important;
            margin-bottom: 25mm !important;
          }
          @page :left {
            margin-left: 15mm !important;
            margin-right: 45mm !important; /* Lomo en páginas pares/reverso */
          }
          @page :right {
            margin-left: 45mm !important; /* Lomo en páginas impares/anverso */
            margin-right: 15mm !important;
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

          body * { visibility: hidden !important; }
          #lienzo-notarial, #lienzo-notarial * { visibility: visible !important; }

          /* Punto de referencia relativo: El contenedor maestro permite anclar el texto vertical */
          #lienzo-notarial,
          .documento-notarial,
          .contenedor-maestro-impresion,
          .hoja-notarial,
          .pagina-anverso,
          .pagina-reverso {
            position: relative !important;
          }

          /* Controlar el Sello Vertical Exclusivamente desde CSS con FIXED */
          .texto-vertical-sello,
          .lomo-impresion {
            /* Usar FIXED garantiza anclaje exacto al borde físico de la hoja, ignorando si el contenedor padre es auto */
            position: fixed !important;
            top: 55mm !important;
            left: 15mm !important;
            height: 250mm !important;
            width: 15mm !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            writing-mode: vertical-rl !important;
            transform: rotate(180deg) !important;
            z-index: 100 !important;
            color: #64748b !important;
            font-family: sans-serif !important;
            font-size: 9px !important;
            font-weight: 900 !important;
            letter-spacing: 2px !important;
            text-transform: uppercase !important;
            pointer-events: none !important;
            margin: 0 !important;
            padding: 0 !important;
            float: none !important;
          }

          /* Asegurar renderizado único: Solo visible en la primera página */
          .hoja-notarial:not(:first-child) .texto-vertical-sello,
          .hoja-notarial:not(:first-child) .lomo-impresion,
          .pagina-reverso .texto-vertical-sello,
          .pagina-reverso .lomo-impresion {
            display: none !important;
            visibility: hidden !important;
          }

          /* Cero Alturas Fijas en Impresión: Contenedores fluidos para flujo vertical nativo (sin afectar el texto vertical) */
          #lienzo-notarial,
          .print-container,
          .documento-notarial,
          .contenedor-maestro-impresion,
          .pagina-notarial,
          .pagina-anverso,
          .pagina-reverso,
          .hoja-notarial,
          div[style*="height"]:not(.texto-vertical-sello):not(.lomo-impresion):not(.texto-vertical-contenido),
          div[style*="min-height"]:not(.texto-vertical-sello):not(.lomo-impresion):not(.texto-vertical-contenido) {
            position: relative !important;
            top: auto !important;
            left: auto !important;
            right: auto !important;
            bottom: auto !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #000000 !important;
            transform: none !important;
          }

          .pagina-anverso div:not(.texto-vertical-sello):not(.lomo-impresion):not(.texto-vertical-contenido),
          .pagina-reverso div:not(.texto-vertical-sello):not(.lomo-impresion):not(.texto-vertical-contenido),
          .hoja-notarial div:not(.texto-vertical-sello):not(.lomo-impresion):not(.texto-vertical-contenido) {
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }

          /* Anular gaps y márgenes del contenedor en impresión */
          .print-container {
            display: block !important;
            gap: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
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

          /* Párrafos Fluidos: evitar cortes a mitad de renglón sin forzar saltos rígidos */
          p,
          .linea-renglon,
          .renglon-impresion,
          .linea-texto,
          li,
          div.renglon,
          [class*="linea-"],
          [class*="renglon-"] {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: auto !important;
            break-after: auto !important;
          }

          textarea {
            display: none !important;
          }
          .print\\:hidden, [class*="print:hidden"] {
            display: none !important;
          }
          .print\\:block, [class*="print:block"] {
            display: block !important;
          }

          .renglones-container,
          .texto-lateral-izq,
          .guia-impresion {
            display: none !important;
            visibility: hidden !important;
          }
          .guia-linea {
            border-bottom-color: transparent !important;
          }
          .input-impresion {
            border: none !important;
            background: transparent !important;
            color: #000000 !important;
            font-weight: bold !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
        }

        .pagina-notarial {
          position: relative;
          width: 216mm;
          min-height: 330mm;
          background: #ffffff;
          overflow: hidden;
          box-sizing: border-box;
        }
        /* ANVERSO (Impar): Margen izquierdo ancho (45mm), derecho angosto (20mm) */
        .pagina-notarial.anverso .contenido-pagina {
          position: absolute;
          top: 18mm;
          bottom: 25mm;
          left: 45mm;
          right: 20mm;
          line-height: 10.2mm; /* 25 renglones exactos */
        }
        /* REVERSO (Par): Margen izquierdo angosto (20mm), derecho ancho (45mm) */
        .pagina-notarial.reverso .contenido-pagina {
          position: absolute;
          top: 18mm;
          bottom: 25mm;
          left: 20mm;
          right: 45mm;
          line-height: 10.2mm;
        }
        .renglones-container {
          position: absolute;
          top: 18mm;
          bottom: 25mm;
          left: 15mm;
          right: 15mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          pointer-events: none;
        }
        .linea-renglon {
          display: flex;
          align-items: center;
          width: 100%;
          height: 10.2mm;
        }
        .nro-renglon {
          font-family: monospace;
          font-size: 11px;
          color: #94a3b8;
          width: 24px;
          text-align: right;
          padding-right: 8px;
        }
        .guia-linea {
          flex: 1;
          border-bottom: 1px dotted #cbd5e1;
          height: 0;
        }
        .texto-lateral-izq {
          position: absolute;
          left: 15mm;
          top: 50%;
          writing-mode: vertical-rl;
          transform: translateY(-50%) rotate(180deg);
          text-align: center;
          height: 60%;
          font-family: sans-serif;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 2px;
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
      <div className="bg-slate-800/80 border-y border-slate-700/80 px-6 py-2.5 text-xs text-slate-300 print:hidden flex flex-wrap items-center justify-between gap-4">
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

      {/* Contenedor del Lienzo Digital (Oficio / Legal: 216mm x 330mm) */}
      <div className="flex-1 flex flex-col items-center justify-start p-4 md:p-8 overflow-auto bg-slate-950">
        {/* Barra Unificada de Control Notarial (Calibración, Tipografía, Espaciado, Guía, Guardar e Imprimir) */}
        <div className="mb-4 bg-slate-900 border border-slate-700/80 rounded-2xl p-3 md:px-5 md:py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-200 shadow-xl print:hidden w-full max-w-7xl">
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
            width: tipoDocumento === 'Sellado Notarial - Protocolo' ? 'auto' : '216mm',
            minHeight: '330mm',
            transform: `translate(${offsetX}mm, ${offsetY}mm)`,
            transition: 'transform 0.1s ease-out'
          }}
          className={`${tipoDocumento === 'Sellado Notarial - Protocolo' ? 'relative flex flex-col items-center p-0' : 'bg-white text-black shadow-2xl relative p-12 flex flex-col justify-between'} box-border font-serif text-[13px] leading-relaxed selection:bg-red-100`}
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
            <div className="contenedor-hoja relative h-full w-full">
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

                /* Coordenadas absolutas milimétricas para Certificación de Firmas (216mm x 330mm) */
                .pos-cert-firmas-t1 { top: 79.2mm !important; left: 88.0mm !important; width: 85.0mm !important; height: 6mm !important; }
                .pos-cert-firmas-t2 { top: 90.5mm !important; left: 66.0mm !important; width: 33.0mm !important; height: 6mm !important; }
                .pos-cert-firmas-t3 { top: 90.5mm !important; left: 130.0mm !important; width: 56.0mm !important; height: 6mm !important; }

                .pos-cert-tramo1 { top: 124.2mm !important; left: 147.0mm !important; width: 39.0mm !important; height: 6mm !important; }
                .pos-cert-tramo2 { top: 135.2mm !important; left: 25.0mm !important; width: 75.0mm !important; height: 6mm !important; }

                .pos-cert-inciso-a-nom { top: 145.8mm !important; left: 32.0mm !important; width: 95.0mm !important; height: 6mm !important; }
                .pos-cert-inciso-a-doc { top: 145.8mm !important; left: 150.0mm !important; width: 36.0mm !important; height: 6mm !important; }
                .pos-cert-inciso-a-dom { top: 156.8mm !important; left: 58.0mm !important; width: 128.0mm !important; height: 6mm !important; }

                .pos-cert-inciso-b-nom { top: 166.8mm !important; left: 32.0mm !important; width: 95.0mm !important; height: 6mm !important; }
                .pos-cert-inciso-b-doc { top: 166.8mm !important; left: 150.0mm !important; width: 36.0mm !important; height: 6mm !important; }
                .pos-cert-inciso-b-dom { top: 177.3mm !important; left: 58.0mm !important; width: 128.0mm !important; height: 6mm !important; }

                .pos-cert-inciso-c-nom { top: 187.5mm !important; left: 32.0mm !important; width: 95.0mm !important; height: 6mm !important; }
                .pos-cert-inciso-c-doc { top: 187.5mm !important; left: 150.0mm !important; width: 36.0mm !important; height: 6mm !important; }
                .pos-cert-inciso-c-dom { top: 198.0mm !important; left: 58.0mm !important; width: 128.0mm !important; height: 6mm !important; }

                .pos-cert-inciso-d-nom { top: 208.0mm !important; left: 32.0mm !important; width: 95.0mm !important; height: 6mm !important; }
                .pos-cert-inciso-d-doc { top: 208.0mm !important; left: 150.0mm !important; width: 36.0mm !important; height: 6mm !important; }
                .pos-cert-inciso-d-dom { top: 218.5mm !important; left: 58.0mm !important; width: 128.0mm !important; height: 6mm !important; }

                .pos-cert-folio1 { top: 235.0mm !important; left: 81.0mm !important; width: 14.0mm !important; height: 6mm !important; }
                .pos-cert-folio2 { top: 235.0mm !important; left: 99.0mm !important; width: 14.0mm !important; height: 6mm !important; }
                .pos-cert-tomo   { top: 235.0mm !important; left: 118.0mm !important; width: 22.0mm !important; height: 6mm !important; }

                .pos-cert-hora   { top: 272.5mm !important; left: 77.0mm !important; width: 18.0mm !important; height: 6mm !important; }
                .pos-cert-dia    { top: 272.5mm !important; left: 121.0mm !important; width: 13.0mm !important; height: 6mm !important; }
                .pos-cert-mes    { top: 272.5mm !important; left: 142.0mm !important; width: 44.0mm !important; height: 6mm !important; }
                .pos-cert-anio   { top: 283.0mm !important; left: 25.0mm !important; width: 16.0mm !important; height: 6mm !important; }

                @media print {
                  @page { size: 216mm 330mm; margin: 0; }
                  body, html { margin: 0 !important; padding: 0 !important; }
                  
                  /* Forzar al contenedor a mantener su marco de referencia */
                  .contenedor-hoja {
                    position: relative !important;
                    width: 216mm !important;
                    height: 330mm !important;
                    display: block !important;
                    margin: 0 !important;
                    padding: 0 !important;
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
                {/* Renglón 1: Escribano carácter */}
                <input 
                  type="text" 
                  value={firmasT1} 
                  onChange={(e) => setFirmasT1(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="TITULAR.-" 
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-firmas-t1" 
                />

                {/* Renglón 2: Registro Notarial y Asiento */}
                <input 
                  type="text" 
                  value={firmasT2} 
                  onChange={(e) => setFirmasT2(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="1.292.-" 
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold text-center focus:outline-none input-impresion pos-cert-firmas-t2" 
                />
                <input 
                  type="text" 
                  value={firmasT3} 
                  onChange={(e) => setFirmasT3(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="ITAKYRY.-" 
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-firmas-t3" 
                />

                {/* PRIMERO: Tramo 1 y Tramo 2 */}
                <input 
                  type="text" 
                  value={tramoPrimero1} 
                  onChange={(e) => setTramoPrimero1(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="documento anexo" 
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-tramo1" 
                />
                <input 
                  type="text" 
                  value={tramoPrimero2} 
                  onChange={(e) => setTramoPrimero2(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="suscrito entre las partes..." 
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-tramo2" 
                />

                {/* INCISO A */}
                <input 
                  type="text" 
                  value={incisoANombre} 
                  onChange={(e) => setIncisoANombre(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="Nombre completo" 
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-inciso-a-nom" 
                />
                <input 
                  type="text" 
                  value={incisoADoc} 
                  onChange={(e) => setIncisoADoc(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="C.I. / RUC" 
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold text-center focus:outline-none input-impresion pos-cert-inciso-a-doc" 
                />
                <input 
                  type="text" 
                  value={incisoADom} 
                  onChange={(e) => setIncisoADom(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="Domicilio exacto" 
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-inciso-a-dom" 
                />

                {/* INCISO B */}
                <input 
                  type="text" 
                  value={incisoBNombre} 
                  onChange={(e) => setIncisoBNombre(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "----------------------------------------" : "Nombre completo (opcional)"} 
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-inciso-b-nom" 
                />
                <input 
                  type="text" 
                  value={incisoBDoc} 
                  onChange={(e) => setIncisoBDoc(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "----------------" : "C.I. / RUC"} 
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold text-center focus:outline-none input-impresion pos-cert-inciso-b-doc" 
                />
                <input 
                  type="text" 
                  value={incisoBDom} 
                  onChange={(e) => setIncisoBDom(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "----------------------------------------" : "Domicilio exacto"} 
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-inciso-b-dom" 
                />

                {/* INCISO C */}
                <input 
                  type="text" 
                  value={incisoCNombre} 
                  onChange={(e) => setIncisoCNombre(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "----------------------------------------" : "Nombre completo (opcional)"} 
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-inciso-c-nom" 
                />
                <input 
                  type="text" 
                  value={incisoCDoc} 
                  onChange={(e) => setIncisoCDoc(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "----------------" : "C.I. / RUC"} 
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold text-center focus:outline-none input-impresion pos-cert-inciso-c-doc" 
                />
                <input 
                  type="text" 
                  value={incisoCDom} 
                  onChange={(e) => setIncisoCDom(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "----------------------------------------" : "Domicilio exacto"} 
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-inciso-c-dom" 
                />

                {/* INCISO D */}
                <input 
                  type="text" 
                  value={incisoDNombre} 
                  onChange={(e) => setIncisoDNombre(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "----------------------------------------" : "Nombre completo (opcional)"} 
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-inciso-d-nom" 
                />
                <input 
                  type="text" 
                  value={incisoDDoc} 
                  onChange={(e) => setIncisoDDoc(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "----------------" : "C.I. / RUC"} 
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold text-center focus:outline-none input-impresion pos-cert-inciso-d-doc" 
                />
                <input 
                  type="text" 
                  value={incisoDDom} 
                  onChange={(e) => setIncisoDDom(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "----------------------------------------" : "Domicilio exacto"} 
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-cert-inciso-d-dom" 
                />

                {/* SEGUNDO: Folios y Tomo */}
                <input 
                  type="text" 
                  value={folio1} 
                  onChange={(e) => setFolio1(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="45" 
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold text-center focus:outline-none input-impresion pos-cert-folio1" 
                />
                <input 
                  type="text" 
                  value={folio2} 
                  onChange={(e) => setFolio2(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="46" 
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold text-center focus:outline-none input-impresion pos-cert-folio2" 
                />
                <input 
                  type="text" 
                  value={tomoLibro} 
                  onChange={(e) => setTomoLibro(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="Tomo III" 
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold text-center focus:outline-none input-impresion pos-cert-tomo" 
                />

                {/* CUARTO: Hora, Día, Mes, Año */}
                <input 
                  type="text" 
                  value={horaCert} 
                  onChange={(e) => setHoraCert(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="10:30" 
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold text-center focus:outline-none input-impresion pos-cert-hora" 
                />
                <input 
                  type="text" 
                  value={diaCert} 
                  onChange={(e) => setDiaCert(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="12" 
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold text-center focus:outline-none input-impresion pos-cert-dia" 
                />
                <input 
                  type="text" 
                  value={mesCert} 
                  onChange={(e) => setMesCert(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="Mayo" 
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold text-center focus:outline-none input-impresion pos-cert-mes" 
                />
                <input 
                  type="text" 
                  value={anioCert} 
                  onChange={(e) => setAnioCert(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="2026" 
                  className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold text-center focus:outline-none input-impresion pos-cert-anio" 
                />
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PLANTILLA 2: CONCUERDA (COORDENADAS MATEMÁTICAS EXACTAS DEL WORD)        */}
          {/* ========================================================================= */}
          {tipoDocumento === 'Concuerda' && (
            <div className="contenedor-hoja relative h-full w-full">
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

                /* Coordenadas absolutas milimétricas para los campos de Concuerda */
                .pos-matriz { top: 84.2mm !important; left: 140.5mm !important; width: 44.5mm !important; height: 6mm !important; }
                .pos-folio { top: 95.2mm !important; left: 36.8mm !important; width: 55.0mm !important; height: 6mm !important; }
                .pos-division { top: 95.2mm !important; left: 142.6mm !important; width: 44.5mm !important; height: 6mm !important; }
                .pos-seccion { top: 105.2mm !important; left: 47.3mm !important; width: 8.5mm !important; height: 6mm !important; }
                .pos-registro { top: 106.0mm !important; left: 108.7mm !important; width: 74.1mm !important; height: 6mm !important; }
                .pos-asiento { top: 115.5mm !important; left: 55.8mm !important; width: 127.0mm !important; height: 6mm !important; }
                .pos-autorizante { top: 126.2mm !important; left: 57.9mm !important; width: 124.9mm !important; height: 6mm !important; }
                .pos-caracter { top: 137.2mm !important; left: 60.0mm !important; width: 86.8mm !important; height: 6mm !important; }
                .pos-copia { top: 147.2mm !important; left: 49.5mm !important; width: 46.6mm !important; height: 6mm !important; }
                .pos-destinatario { top: 147.2mm !important; left: 121.4mm !important; width: 80.4mm !important; height: 6mm !important; }
                .pos-linea-adicional { top: 158.2mm !important; left: 30.0mm !important; width: 58.0mm !important; height: 6mm !important; }
                .pos-dia { top: 158.2mm !important; left: 100.2mm !important; width: 59.2mm !important; height: 6mm !important; }
                .pos-mes { top: 168.7mm !important; left: 34.5mm !important; width: 27.5mm !important; height: 6mm !important; }
                .pos-anio { top: 168.7mm !important; left: 81.2mm !important; width: 101.5mm !important; height: 6mm !important; }

                @media print {
                  @page { size: 216mm 330mm; margin: 0; }
                  body, html { margin: 0 !important; padding: 0 !important; }
                  
                  /* Forzar al contenedor a mantener su marco de referencia */
                  .contenedor-hoja {
                    position: relative !important;
                    width: 216mm !important;
                    height: 330mm !important;
                    display: block !important;
                    margin: 0 !important;
                    padding: 0 !important;
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
                 <div className="absolute text-slate-400 text-sm font-normal tracking-widest" style={{ top: '84.2mm', left: '35mm' }}>...///... C U E R D A</div>
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '84.2mm', left: '80mm' }}>fielmente con su escritura matriz Nº</div>
                 
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '95.2mm', left: '25mm' }}>folio</div>
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '95.2mm', left: '95mm' }}>del Protocolo de la División</div>
                 
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '105.2mm', left: '30mm' }}>Sección “</div>
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '105.2mm', left: '60mm' }}>” del Registro Notarial Nº</div>
                 
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '115.5mm', left: '30mm' }}>con asiento en</div>
                 
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '126.2mm', left: '30mm' }}>y autorizada por</div>
                 
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '137.2mm', left: '30mm' }}>en el carácter de</div>
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '137.2mm', left: '150mm' }}>de dicho Registro,</div>
                 
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '147.2mm', left: '30mm' }}>expido esta</div>
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '147.2mm', left: '100mm' }}>copia para</div>
                 
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '158.2mm', left: '90mm' }}>a los</div>
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '158.2mm', left: '165mm' }}>días del mes</div>
                 
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '168.7mm', left: '25mm' }}>de</div>
                 <div className="absolute text-slate-400 text-sm font-normal" style={{ top: '168.7mm', left: '65mm' }}>del año.</div>
              </div>

              {/* CAPA DE DATOS */}
              <div 
                className="capa-datos-concuerda absolute inset-0 z-10" 
                style={{ fontSize: fontSizeGlobal, fontFamily: fontFamilyGlobal }}
              >
                 
                 <input type="text" value={matrizNro} onChange={(e) => setMatrizNro(e.target.value)} onKeyDown={handleEnterKey} 
                 placeholder="Matriz" 
                 className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-matriz" />
                 
                 <input type="text" value={folioConcuerda} onChange={(e) => setFolioConcuerda(e.target.value)} onKeyDown={handleEnterKey} 
                 placeholder="Folio" 
                 className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold text-center focus:outline-none input-impresion pos-folio" />
                 
                 <input type="text" value={divisionConcuerda} onChange={(e) => setDivisionConcuerda(e.target.value)} onKeyDown={handleEnterKey} 
                 placeholder="División" 
                 className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-division" />
                 
                 <input type="text" value={seccionConcuerda} onChange={(e) => setSeccionConcuerda(e.target.value)} onKeyDown={handleEnterKey} 
                 placeholder="Secc." 
                 className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold text-center focus:outline-none input-impresion pos-seccion" />
                 
                 <input type="text" value={registroConcuerda} onChange={(e) => setRegistroConcuerda(e.target.value)} onKeyDown={handleEnterKey} 
                 placeholder="Registro" 
                 className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-registro" />
                 
                 <input type="text" value={asientoConcuerda} onChange={(e) => setAsientoConcuerda(e.target.value)} onKeyDown={handleEnterKey} 
                 placeholder="Asiento" 
                 className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-asiento" />
                 
                 <input type="text" value={autorizanteConcuerda} onChange={(e) => setAutorizanteConcuerda(e.target.value)} onKeyDown={handleEnterKey} 
                 placeholder="Autorizada por" 
                 className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-autorizante" />
                 
                 <input type="text" value={caracterConcuerda} onChange={(e) => setCaracterConcuerda(e.target.value)} onKeyDown={handleEnterKey} 
                 placeholder="Carácter" 
                 className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold text-center focus:outline-none input-impresion pos-caracter" />
                 
                 <input type="text" value={copiaConcuerda} onChange={(e) => setCopiaConcuerda(e.target.value)} onKeyDown={handleEnterKey} 
                 placeholder="Copia" 
                 className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold text-center focus:outline-none input-impresion pos-copia" />
                 
                 <input type="text" value={destinatarioConcuerda} onChange={(e) => setDestinatarioConcuerda(e.target.value)} onKeyDown={handleEnterKey} 
                 placeholder="Destinatario" 
                 maxLength={35}
                 className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-destinatario" />
                 
                 {/* LÍNEA ADICIONAL CORREGIDA (Misma altura que VEINTITRES, ancho limitado) */}
                 <input type="text" value={lineaAdicionalConcuerda} onChange={(e) => setLineaAdicionalConcuerda(e.target.value)} onKeyDown={handleEnterKey} 
                 placeholder="-----------------------" 
                 maxLength={35}
                 className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-linea-adicional" />

                 <input type="text" value={diaLetrasConcuerda} onChange={(e) => setDiaLetrasConcuerda(e.target.value)} onKeyDown={handleEnterKey} 
                 placeholder="Día" 
                 className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold text-center focus:outline-none input-impresion pos-dia" />
                 
                 <input type="text" value={mesConcuerda} onChange={(e) => setMesConcuerda(e.target.value)} onKeyDown={handleEnterKey} 
                 placeholder="Mes" 
                 className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold text-center focus:outline-none input-impresion pos-mes" />
                 
                 <input type="text" value={anioLetrasConcuerda} onChange={(e) => setAnioLetrasConcuerda(e.target.value)} onKeyDown={handleEnterKey} 
                 placeholder="Año" 
                 className="absolute bg-transparent border-b border-dotted border-slate-400 print:border-transparent text-black font-bold focus:outline-none input-impresion pos-anio" />

              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PLANTILLA 3: LEGALIZACIÓN                                                */}
          {/* ========================================================================= */}
          {tipoDocumento === 'Legalización' && (
            <div className="relative h-full w-full">
              {/* CABECERA GUÍA Y ESTRUCTURAL */}
              <div>
                <div className={`flex items-start justify-between border-b-2 border-black pb-4 mb-[4mm] transition-opacity duration-300 ${mostrarGuia ? 'opacity-100' : 'opacity-0'} guia-impresion print:opacity-0 print:border-none print:border-transparent`}>
                  <div>
                    <h2 className="font-black text-base uppercase tracking-wider whitespace-nowrap print:text-transparent">CORTE SUPREMA DE JUSTICIA</h2>
                    <p className="text-xs font-bold text-slate-700 whitespace-nowrap print:text-transparent">REPÚBLICA DEL PARAGUAY</p>
                    <p className="text-xs font-bold mt-1 text-[#FF3131] whitespace-nowrap print:text-transparent">LEGALIZACIÓN - ACTUACIÓN NOTARIAL (Serie PJH-2022)</p>
                  </div>
                  <div className="border border-black p-2 text-center w-24 h-24 flex flex-col items-center justify-center bg-slate-50 shrink-0 print:opacity-0 print:border-none print:border-transparent">
                    <span className="text-[10px] font-mono font-bold whitespace-nowrap print:text-transparent">QR PJE</span>
                    <span className="text-[8px] text-slate-500 whitespace-nowrap print:text-transparent">SEC-2022</span>
                  </div>
                </div>

                {/* TEXTOS Y CAMPOS DEL CUERPO (Renglones Rígidos y Líneas Elásticas) */}
                <div className="ajuste-horizontal-datos ajuste-interlineado-datos space-y-[9mm] text-justify font-sans text-[13px] pt-8">
                  {/* Renglón 1: Declaración de la Corte */}
                  <div className="flex items-end w-full">
                    <span className="whitespace-nowrap font-medium print:text-transparent">La CORTE SUPREMA DE JUSTICIA, legaliza la firma y</span>
                  </div>

                  {/* Renglón 2: Notario */}
                  <div className="flex items-end w-full gap-2">
                    <span className="whitespace-nowrap print:text-transparent">sello del/la Notario/a</span>
                    <input 
                      type="text" 
                      value={nombreNotarioLeg} 
                      onChange={(e) => setNombreNotarioLeg(e.target.value)} 
                      onKeyDown={handleEnterKey}
                      className="border-b border-dotted border-slate-400 print:border-none print:border-transparent px-2 py-0.5 font-mono font-bold text-black flex-1 min-w-0 input-impresion" 
                      placeholder="RICARDO GABRIEL MARTINEZ VARELA"
                    />
                  </div>

                  {/* Renglón 3: Línea Adicional de Seguridad */}
                  <div className="flex items-end w-full">
                    <input 
                      type="text" 
                      value={lineaAdicionalLeg} 
                      onChange={(e) => setLineaAdicionalLeg(e.target.value)} 
                      onKeyDown={handleEnterKey}
                      className="border-b border-dotted border-slate-400 print:border-none print:border-transparent px-2 py-0.5 font-mono font-bold text-black flex-1 min-w-0 input-impresion" 
                      placeholder="--------------------------------------------------------------------------------"
                    />
                  </div>

                  {/* Renglón 4: Escritura y Fecha */}
                  <div className="flex items-end w-full gap-2">
                    <span className="whitespace-nowrap print:text-transparent">obrante en el testimonio de la escritura Nº</span>
                    <input 
                      type="text" 
                      value={escrituraNroLeg} 
                      onChange={(e) => setEscrituraNroLeg(e.target.value)} 
                      onKeyDown={handleEnterKey}
                      className="border-b border-dotted border-slate-400 print:border-none print:border-transparent px-2 py-0.5 font-mono font-bold text-black flex-1 min-w-0 text-center input-impresion" 
                      placeholder="79"
                    />
                    <span className="whitespace-nowrap print:text-transparent">de fecha.</span>
                  </div>

                  {/* Renglón 5: Fecha Escritura y Hoja de Seguridad */}
                  <div className="flex items-end w-full gap-2">
                    <input 
                      type="text" 
                      value={fechaEscrituraLeg} 
                      onChange={(e) => setFechaEscrituraLeg(e.target.value)} 
                      onKeyDown={handleEnterKey}
                      className="border-b border-dotted border-slate-400 print:border-none print:border-transparent px-2 py-0.5 font-mono font-bold text-black w-[30%] text-center input-impresion" 
                      placeholder="10 de Mayo de 2026"
                    />
                    <span className="whitespace-nowrap print:text-transparent">con hoja de seguridad Nº</span>
                    <input 
                      type="text" 
                      value={hojaSeguridadNroLeg} 
                      onChange={(e) => setHojaSeguridadNroLeg(e.target.value)} 
                      onKeyDown={handleEnterKey}
                      className="border-b border-dotted border-slate-400 print:border-none print:border-transparent px-2 py-0.5 font-mono font-bold text-black flex-1 min-w-0 input-impresion" 
                      placeholder="PJD-2022 Nº 4.589.123"
                    />
                  </div>

                  {/* Renglón 6: Cláusula de Validez Parte 1 */}
                  <div className="flex items-end w-full">
                    <span className="whitespace-nowrap print:text-transparent">La presente Legalización se realiza sobre un documento de uso notarial expedido a</span>
                  </div>

                  {/* Renglón 7: Cláusula de Validez Parte 2 */}
                  <div className="flex items-end w-full">
                    <span className="whitespace-nowrap print:text-transparent">nombre del/la Notario/a solicitante.</span>
                  </div>

                  {/* Renglón 8: Lugar y Fecha de Legalización */}
                  <div className="flex items-end w-full gap-2 pt-2">
                    <span className="whitespace-nowrap print:text-transparent">Asunción,</span>
                    <input 
                      type="text" 
                      value={diaLeg} 
                      onChange={(e) => setDiaLeg(e.target.value)} 
                      onKeyDown={handleEnterKey}
                      className="border-b border-dotted border-slate-400 print:border-none print:border-transparent px-2 py-0.5 font-mono font-bold text-black w-16 text-center input-impresion" 
                      placeholder="15"
                    />
                    <span className="whitespace-nowrap print:text-transparent">de</span>
                    <input 
                      type="text" 
                      value={mesLeg} 
                      onChange={(e) => setMesLeg(e.target.value)} 
                      onKeyDown={handleEnterKey}
                      className="border-b border-dotted border-slate-400 print:border-none print:border-transparent px-2 py-0.5 font-mono font-bold text-black w-32 text-center input-impresion" 
                      placeholder="Mayo"
                    />
                    <span className="whitespace-nowrap print:text-transparent">de</span>
                    <input 
                      type="text" 
                      value={anioLeg} 
                      onChange={(e) => setAnioLeg(e.target.value)} 
                      onKeyDown={handleEnterKey}
                      className="border-b border-dotted border-slate-400 print:border-none print:border-transparent px-2 py-0.5 font-mono font-bold text-black flex-1 min-w-0 text-center input-impresion" 
                      placeholder="2026"
                    />
                    <span className="whitespace-nowrap print:text-transparent">.-</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* ========================================================================= */}
          {/* PLANTILLA 0: SELLADO NOTARIAL - PROTOCOLO (25 RENGLONES Y TEXTO VERTICAL)   */}
          {/* ========================================================================= */}
          {tipoDocumento === 'Sellado Notarial - Protocolo' && (
            <div className="flex flex-col gap-12 print:gap-0 print:py-0 print:bg-white items-center bg-slate-900 py-12">
              {protocoloPaginas
                .filter((textoPagina, i) => i === 0 || (textoPagina && textoPagina.trim() !== ''))
                .map((textoPagina, index, arr) => {
                  const isAnverso = index % 2 === 0;
                  const esUltima = index === arr.length - 1;

                  return (
                    <div 
                      key={index} 
                      className={`hoja-notarial pagina-virtual relative bg-white text-black shrink-0 print:shadow-none print:m-0 print:!h-auto print:!min-h-0 print:!max-h-none print:!overflow-visible shadow-2xl ${isAnverso ? 'pagina-anverso' : 'pagina-reverso'}`}
                      style={{ width: '216mm', height: '330mm', pageBreakAfter: esUltima ? 'avoid' : 'always' }}
                    >
                      {/* CAPA 0: GRILLA (Invisible al imprimir) */}
                      <div 
                        className={`absolute inset-0 flex flex-col pointer-events-none z-0 print:hidden ${mostrarGuia ? 'opacity-100' : 'opacity-0'} ${isAnverso ? 'pagina-anverso' : 'pagina-reverso'}`}
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingTop: '55mm', paddingBottom: '25mm' }}
                      >
                        {Array.from({ length: 25 }, (_, i) => (
                          <div key={i} className="relative w-full h-[10.2mm] border-b border-dashed border-slate-300">
                            <span className={`absolute bottom-0 text-[10px] font-mono text-slate-400 ${isAnverso ? '-left-6' : '-right-6'}`}>{i + 1}</span>
                          </div>
                        ))}
                      </div>

                      {/* CAPA 1: TEXTO VERTICAL (Lomo, ÚNICAMENTE en la Primera Página) */}
                      {index === 0 && (
                        <div 
                          className="texto-vertical-sello lomo-impresion pointer-events-none z-10 print:visible"
                          style={{ position: 'absolute', left: '15mm', top: '55mm', bottom: '25mm', width: '15mm', height: '250mm', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <span
                            className="texto-vertical-contenido text-[10px] font-bold tracking-[2px] whitespace-nowrap text-slate-400 print:text-black"
                            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                          >
                            {protocoloTextoVertical}
                          </span>
                        </div>
                      )}

                      {/* CAPA 2: EDITOR (y espejo de impresión) */}
                      <div 
                        className={`ajuste-horizontal-datos absolute inset-0 z-20 print:!static print:!p-0 print:!h-auto print:!overflow-visible ${isAnverso ? 'pagina-anverso' : 'pagina-reverso'}`}
                        style={{ 
                          position: 'absolute', 
                          top: 0, 
                          left: 0, 
                          right: 0, 
                          bottom: 0, 
                          paddingTop: '55mm', 
                          paddingBottom: '25mm' 
                        }}
                      >
                        <textarea
                          ref={(el) => { textareasRefs.current[index] = el; }}
                          value={textoPagina}
                          onChange={(e) => handleTextareaChange(index, e)}
                          onKeyDown={(e) => handleKeyDown(index, e)}
                          placeholder={`Redacte aquí la ${isAnverso ? 'cara frontal (Anverso)' : 'cara trasera (Reverso)'}...`}
                          className="w-full h-full bg-transparent text-black font-bold text-justify outline-none border-none resize-none print:hidden selection:bg-red-100 overflow-hidden"
                          style={{ lineHeight: `${interlineadoGlobal}mm`, fontSize: fontSizeGlobal, fontFamily: fontFamilyGlobal }}
                        />
                        {/* ESPEJO PARA IMPRESIÓN */}
                        <div 
                          className="hidden print:block w-full text-black font-bold text-justify whitespace-pre-wrap print:!h-auto print:!overflow-visible"
                          style={{ lineHeight: `${interlineadoGlobal}mm`, fontSize: fontSizeGlobal, fontFamily: fontFamilyGlobal }}
                        >
                          {textoPagina}
                        </div>
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
