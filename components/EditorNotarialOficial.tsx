import React, { useState, useEffect, useRef } from 'react';
import { 
  Printer, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Stamp,
  Sliders,
  Sparkles
} from 'lucide-react';

export type TipoDocumentoNotarial = 'Concuerda' | 'Certificación de Firmas' | 'Legalización' | 'Sellado Notarial - Protocolo';

interface EditorNotarialOficialProps {
  onVolver?: () => void;
}

export const EditorNotarialOficial: React.FC<EditorNotarialOficialProps> = ({ onVolver }) => {
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumentoNotarial>('Concuerda');
  const [mostrarGuia, setMostrarGuia] = useState<boolean>(true);
  const [rellenoGuiones, setRellenoGuiones] = useState<boolean>(true);

  // Calibrador fino de impresora (Offset X e Y en mm) guardado en localStorage por tipoDocumento
  const [offsetX, setOffsetX] = useState<number>(() => {
    const saved = localStorage.getItem(`olga_print_offset_x_${tipoDocumento}`);
    return saved ? parseFloat(saved) : 0;
  });
  const [offsetY, setOffsetY] = useState<number>(() => {
    const saved = localStorage.getItem(`olga_print_offset_y_${tipoDocumento}`);
    return saved ? parseFloat(saved) : 0;
  });

  useEffect(() => {
    localStorage.setItem(`olga_print_offset_x_${tipoDocumento}`, offsetX.toString());
  }, [offsetX, tipoDocumento]);

  useEffect(() => {
    localStorage.setItem(`olga_print_offset_y_${tipoDocumento}`, offsetY.toString());
  }, [offsetY, tipoDocumento]);

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
  const [matrizNro, setMatrizNro] = useState<string>('79.-----------------');
  const [folioConcuerda, setFolioConcuerda] = useState<string>('493 Y SGTES.');
  const [ divisionConcuerda, setDivisionConcuerda] = useState<string>('COMERCIAL');
  const [seccionConcuerda, setSeccionConcuerda] = useState<string>('A');
  const [registroConcuerda, setRegistroConcuerda] = useState<string>('1.292');
  const [asientoConcuerda, setAsientoConcuerda] = useState<string>('ITAKYRY');
  const [autorizanteConcuerda, setAutorizanteConcuerda] = useState<string>('RICARDO GABRIEL MARTINEZ VARELA');
  const [caracterConcuerda, setCaracterConcuerda] = useState<string>('TITULAR');
  const [copiaConcuerda, setCopiaConcuerda] = useState<string>('PRIMERA');
  const [destinatarioConcuerda, setDestinatarioConcuerda] = useState<string>('ADEMIR LUIZ COLOSSI.-');
  const [cierreConcuerda, setCierreConcuerda] = useState<string>('*****************');
  const [diaLetrasConcuerda, setDiaLetrasConcuerda] = useState<string>('ONCE');
  const [mesConcuerda, setMesConcuerda] = useState<string>('MAYO');
  const [anioLetrasConcuerda, setAnioLetrasConcuerda] = useState<string>('DOS MIL VEINTISÉIS.-');

  // PLANTILLA 3: Legalización
  const [nombreNotarioLeg, setNombreNotarioLeg] = useState<string>('RICARDO GABRIEL MARTINEZ VARELA');
  const [lineaAdicionalLeg, setLineaAdicionalLeg] = useState<string>('--------------------------------------------------------------------------------');
  const [escrituraNroLeg, setEscrituraNroLeg] = useState<string>('79');
  const [fechaEscrituraLeg, setFechaEscrituraLeg] = useState<string>('10 de Mayo de 2026');
  const [hojaSeguridadNroLeg, setHojaSeguridadNroLeg] = useState<string>('PJD-2022 Nº 4.589.123');
  const [diaLeg, setDiaLeg] = useState<string>('15');
  const [mesLeg, setMesLeg] = useState<string>('Mayo');
  const [anioLeg, setAnioLeg] = useState<string>('2026');

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

  const handlePrint = () => {
    const lienzoEl = document.getElementById('lienzo-notarial');
    if (!lienzoEl) {
      window.print();
      return;
    }

    const clone = lienzoEl.cloneNode(true) as HTMLElement;
    clone.style.transform = 'none';

    // 1. Mostrar texto espejo y ocultar textareas UI
    clone.querySelectorAll('textarea').forEach((ta) => ta.remove());
    clone.querySelectorAll('.print\\:block, [class*="print:block"]').forEach((mirror) => {
      mirror.classList.remove('hidden');
      (mirror as HTMLElement).style.display = 'block';
    });

    // 2. Limpiar completamente los elementos de UI y lomos viejos del DOM clonado
    clone.querySelectorAll('.texto-vertical-sello, .lomo-impresion, .guia-impresion, .renglones-container').forEach(el => el.remove());

    // 3. Limpiar páginas vacías de React
    const paginas = clone.querySelectorAll('.hoja-notarial');
    paginas.forEach((pag) => {
      const divEspejo = pag.querySelector('.print\\:block') || pag.querySelector('[class*="print:block"]');
      const textoEspejo = divEspejo && divEspejo.textContent ? divEspejo.textContent.trim() : '';
      if (textoEspejo === '') {
        pag.remove();
      }
    });

    const contenidoHtml = clone.innerHTML;
    const titulo = `Documento Notarial - ${tipoDocumento}`;

    // 4. Inyectar el Lomo Vertical solo si es el Protocolo (Página 1)
    const lomoHtml = tipoDocumento === 'Sellado Notarial - Protocolo' 
      ? `<div class="texto-vertical-unico"><span>${protocoloTextoVertical}</span></div>` 
      : '';

    const htmlImpresion = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${titulo}</title>
  <style>
    /* 1. MÁRGENES FIJOS ESTILO WORD/DOCS */
    @page {
      size: 216mm 330mm portrait;
      margin-top: 55mm !important;
      margin-bottom: 25mm !important;
    }
    @page :left {
      margin-left: 15mm !important;
      margin-right: 45mm !important;
    }
    @page :right {
      margin-left: 45mm !important;
      margin-right: 15mm !important;
    }

    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* 2. CONTENEDOR MAESTRO */
    .print-container {
      position: relative !important;
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    /* 3. TEXTO VERTICAL COMO DIV EN LA PAGINA 1 */
    /* Como el contenedor empieza a los 45mm (margen de página), le restamos 30mm para que quede a 15mm físicos del borde */
    .texto-vertical-unico {
      position: absolute !important;
      top: 0 !important; 
      left: -30mm !important; 
      width: 15mm !important;
      height: 250mm !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      writing-mode: vertical-rl !important;
      transform: rotate(180deg) !important;
      z-index: 100 !important;
      color: #000000 !important;
      font-family: sans-serif !important;
      font-size: 9px !important;
      font-weight: 900 !important;
      letter-spacing: 2px !important;
      text-transform: uppercase !important;
    }

    /* 4. FLUJO LIBRE Y NORMAL PARA EL CONTRATO */
    /* Aplastamos las cajas de React para que el texto fluya como agua */
    .hoja-notarial, .hoja-notarial > div.z-20 {
      position: static !important;
      width: 100% !important;
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      margin: 0 !important;
      padding: 0 !important; /* Los márgenes los pone el @page */
      border: none !important;
      box-shadow: none !important;
      overflow: visible !important;
      page-break-after: auto !important;
      break-after: auto !important;
    }

    /* 5. FORMATO DE TEXTO */
    .print\\:block, [class*="print:block"] {
      font-family: "Times New Roman", Times, serif !important;
      font-size: 15px !important;
      line-height: 10.2mm !important;
      text-align: justify !important;
      white-space: pre-wrap !important;
      width: 100% !important;
      color: #000000 !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    /* Ocultar UI */
    .print\\:hidden { display: none !important; }
  </style>
</head>
<body>
  <div class="print-container">
    ${lomoHtml}
    ${contenidoHtml}
  </div>
  <script>
    window.onload = () => {
      window.focus();
      setTimeout(() => { window.print(); }, 300);
    };
  </script>
</body>
</html>`;

    try {
      const ventanaImpresion = window.open('', '_blank');
      if (ventanaImpresion) {
        ventanaImpresion.document.open();
        ventanaImpresion.document.write(htmlImpresion);
        ventanaImpresion.document.close();
        return;
      }
    } catch (e) {
      console.warn('Fallback a impresión directa.', e);
    }
    window.print();
  };

  const guionesSeguridad = '------------------------------------------------------------------------';

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
              <span>Gemelo Digital Notarial</span>
              <span className="px-2.5 py-0.5 bg-[#FF3131] text-white text-[9px] font-black uppercase tracking-widest rounded-lg">
                O.L.G.A.
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              Plantillas oficiales de la Corte Suprema de Justicia generadas puramente en HTML/CSS milimétrico.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto relative z-10">
          {/* Selector de Tipo de Documento */}
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
            <label htmlFor="tipo-doc-select" className="text-xs font-bold text-slate-400">
              Plantilla:
            </label>
            <select
              id="tipo-doc-select"
              value={tipoDocumento}
              onChange={(e) => setTipoDocumento(e.target.value as TipoDocumentoNotarial)}
              className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
            >
              <option value="Sellado Notarial - Protocolo" className="bg-slate-900 text-white">0. Sellado Notarial - Protocolo</option>
              <option value="Certificación de Firmas" className="bg-slate-900 text-white">1. Certificación de Firmas</option>
              <option value="Concuerda" className="bg-slate-900 text-white">2. Concuerda (Hoja de Seguridad)</option>
              <option value="Legalización" className="bg-slate-900 text-white">3. Legalización Notarial</option>
            </select>
          </div>

          {/* Botón Guía Visual */}
          <button
            type="button"
            onClick={() => setMostrarGuia(!mostrarGuia)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
              mostrarGuia 
                ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 hover:bg-blue-600/30' 
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            {mostrarGuia ? <Eye className="w-4 h-4 text-blue-400" /> : <EyeOff className="w-4 h-4" />}
            <span>{mostrarGuia ? 'Guía Visible' : 'Guía Oculta'}</span>
          </button>

          {/* Botón Imprimir Hoja */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 bg-[#FF3131] hover:bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-red-600/20 transition-all hover:scale-105 active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Hoja</span>
          </button>
        </div>
      </header>

      {/* Calibrador Fino de Impresora y Switch de Seguridad (No imprimible) */}
      <div className="bg-slate-800/90 border-y border-slate-700/80 px-6 py-3 text-xs text-slate-300 print:hidden flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-amber-400 font-bold">
            <Sliders className="w-4 h-4" />
            <span>Calibrador Impresora:</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700">
            <span>Offset X:</span>
            <button onClick={() => setOffsetX(offsetX - 1)} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-white font-bold">-1mm</button>
            <span className="w-8 text-center font-mono font-bold text-amber-300">{offsetX}mm</span>
            <button onClick={() => setOffsetX(offsetX + 1)} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-white font-bold">+1mm</button>
          </div>
          <div className="flex items-center gap-1 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700">
            <span>Offset Y:</span>
            <button onClick={() => setOffsetY(offsetY - 1)} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-white font-bold">-1mm</button>
            <span className="w-8 text-center font-mono font-bold text-amber-300">{offsetY}mm</span>
            <button onClick={() => setOffsetY(offsetY + 1)} className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-white font-bold">+1mm</button>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
            <div className="flex items-center gap-2 ml-4 border-l border-slate-700 pl-4">
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
      </div>

      {/* Contenedor del Lienzo Digital (Oficio / Legal: 216mm x 330mm) */}
      <div className="flex-1 flex items-start justify-center p-4 md:p-8 overflow-auto bg-slate-950">
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
          {/* MARCO EXTERIOR GUÍA (Solo visible en pantalla si mostrarGuia es true y no es Protocolo) */}
          {tipoDocumento !== 'Sellado Notarial - Protocolo' && (
            <div className={`absolute inset-4 border border-dashed border-slate-300 pointer-events-none transition-opacity duration-300 ${mostrarGuia ? 'opacity-100' : 'opacity-0'} guia-impresion`}></div>
          )}

          {/* ========================================================================= */}
          {/* PLANTILLA 1: CERTIFICACIÓN DE FIRMAS                                     */}
          {/* ========================================================================= */}
          {tipoDocumento === 'Certificación de Firmas' && (
            <div className="flex flex-col h-full justify-between relative">
              {/* CABECERA GUÍA Y ESTRUCTURAL */}
              <div>
                <div className={`flex items-start justify-between border-b-2 border-black pb-4 mb-6 transition-opacity duration-300 ${mostrarGuia ? 'opacity-100' : 'opacity-0'} guia-impresion`}>
                  <div>
                    <h2 className="font-black text-base uppercase tracking-wider">CORTE SUPREMA DE JUSTICIA</h2>
                    <p className="text-xs font-bold text-slate-700">REPÚBLICA DEL PARAGUAY</p>
                    <p className="text-xs font-bold mt-1 text-[#FF3131]">CERTIFICACIÓN DE FIRMAS (Art. 152 - Ley 879) (Hoja Anexa)</p>
                  </div>
                  <div className="border border-black p-2 text-center w-24 h-24 flex flex-col items-center justify-center bg-slate-50">
                    <span className="text-[10px] font-mono font-bold">QR PJE</span>
                    <span className="text-[8px] text-slate-500">SEC-2026</span>
                  </div>
                </div>

                {/* TEXTOS Y CAMPOS DEL CUERPO */}
                <div className="space-y-4 text-justify font-sans text-[12.5px]">
                  {/* Línea 1 y 2 de presentación */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span>En mi carácter de Escribano Público</span>
                    <input 
                      type="text" 
                      value={firmasT1} 
                      onChange={(e) => setFirmasT1(e.target.value)}
                      className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black focus:outline-none focus:border-red-500 w-36 input-impresion"
                      placeholder="TITULAR.-"
                    />
                    <span>del Registro Notarial Nº</span>
                    <input 
                      type="text" 
                      value={firmasT2} 
                      onChange={(e) => setFirmasT2(e.target.value)}
                      className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black focus:outline-none focus:border-red-500 w-28 input-impresion"
                      placeholder="1.292.-"
                    />
                    <span>con asiento en</span>
                    <input 
                      type="text" 
                      value={firmasT3} 
                      onChange={(e) => setFirmasT3(e.target.value)}
                      className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black focus:outline-none focus:border-red-500 w-40 input-impresion"
                      placeholder="ITAKYRY.-"
                    />
                  </div>
                  <div>
                    y en uso de las atribuciones que me acuerda la legislación vigente:
                  </div>

                  <div className="text-center font-serif font-black text-lg tracking-widest my-4">
                    C E R T I F I C O
                  </div>

                  {/* DESBORDE INTELIGENTE EN 3 TRAMOS PARA EL PUNTO PRIMERO */}
                  <div className="space-y-2 bg-slate-50/80 p-3 rounded-xl border border-slate-200 guia-impresion">
                    <p className="text-[11px] font-bold text-slate-500">Configuración Desborde Inteligente Punto PRIMERO:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-600 block">Tramo 1 (Máx ~24 car.):</label>
                        <input type="text" value={tramoPrimero1} onChange={(e) => setTramoPrimero1(e.target.value)} className="w-full text-xs border border-slate-300 rounded px-2 py-1 bg-white font-mono" />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-600 block">Tramo 2 (Máx ~38 car.):</label>
                        <input type="text" value={tramoPrimero2} onChange={(e) => setTramoPrimero2(e.target.value)} className="w-full text-xs border border-slate-300 rounded px-2 py-1 bg-white font-mono" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[10px] text-slate-600 block">Tramo 3 (Excedente / Línea media):</label>
                        <input type="text" value={tramoPrimero3} onChange={(e) => setTramoPrimero3(e.target.value)} className="w-full text-xs border border-slate-300 rounded px-2 py-1 bg-white font-mono" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 pt-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold">PRIMERO:</span>
                      <span>Que las firmas que obran en el documento anexo inserto en</span>
                      <input type="text" value={tramoPrimero1} readOnly className="border-b border-dotted border-slate-400 px-1 font-mono font-bold text-black w-64 bg-transparent input-impresion" />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input type="text" value={tramoPrimero2} readOnly className="border-b border-dotted border-slate-400 px-1 font-mono font-bold text-black w-72 bg-transparent input-impresion" />
                      <span>han sido puestas en mi presencia por:</span>
                    </div>
                    {tramoPrimero3 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <input type="text" value={tramoPrimero3} readOnly className="border-b border-dotted border-slate-400 px-1 font-mono font-bold text-black w-full bg-transparent input-impresion" />
                      </div>
                    )}
                  </div>

                  {/* INCISOS a), b), c), d) CON AUTORRELLENADO DE SEGURIDAD */}
                  <div className="space-y-3 pt-2">
                    {/* Inciso a */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">a)</span>
                        <input type="text" value={incisoANombre} onChange={(e) => setIncisoANombre(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black flex-1 min-w-[200px] input-impresion" placeholder="Nombre completo" />
                        <span>documento</span>
                        <input type="text" value={incisoADoc} onChange={(e) => setIncisoADoc(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-40 input-impresion" placeholder="C.I. / RUC" />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pl-5">
                        <span>con domicilio en</span>
                        <input type="text" value={incisoADom} onChange={(e) => setIncisoADom(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black flex-1 input-impresion" placeholder="Domicilio exacto" />
                      </div>
                    </div>

                    {/* Inciso b */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">b)</span>
                        {incisoBNombre || !rellenoGuiones ? (
                          <input type="text" value={incisoBNombre} onChange={(e) => setIncisoBNombre(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black flex-1 min-w-[200px] input-impresion" placeholder="Nombre completo (opcional)" />
                        ) : (
                          <span className="font-mono text-slate-500 tracking-widest">{guionesSeguridad}</span>
                        )}
                        <span>documento</span>
                        {incisoBDoc || !rellenoGuiones ? (
                          <input type="text" value={incisoBDoc} onChange={(e) => setIncisoBDoc(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-40 input-impresion" placeholder="C.I. / RUC" />
                        ) : (
                          <span className="font-mono text-slate-500 tracking-widest">--------------------</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pl-5">
                        <span>con domicilio en</span>
                        {incisoBDom || !rellenoGuiones ? (
                          <input type="text" value={incisoBDom} onChange={(e) => setIncisoBDom(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black flex-1 input-impresion" placeholder="Domicilio exacto" />
                        ) : (
                          <span className="font-mono text-slate-500 tracking-widest">{guionesSeguridad}</span>
                        )}
                      </div>
                    </div>

                    {/* Inciso c */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">c)</span>
                        {incisoCNombre || !rellenoGuiones ? (
                          <input type="text" value={incisoCNombre} onChange={(e) => setIncisoCNombre(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black flex-1 min-w-[200px] input-impresion" placeholder="Nombre completo (opcional)" />
                        ) : (
                          <span className="font-mono text-slate-500 tracking-widest">{guionesSeguridad}</span>
                        )}
                        <span>documento</span>
                        {incisoCDoc || !rellenoGuiones ? (
                          <input type="text" value={incisoCDoc} onChange={(e) => setIncisoCDoc(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-40 input-impresion" placeholder="C.I. / RUC" />
                        ) : (
                          <span className="font-mono text-slate-500 tracking-widest">--------------------</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pl-5">
                        <span>con domicilio en</span>
                        {incisoCDom || !rellenoGuiones ? (
                          <input type="text" value={incisoCDom} onChange={(e) => setIncisoCDom(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black flex-1 input-impresion" placeholder="Domicilio exacto" />
                        ) : (
                          <span className="font-mono text-slate-500 tracking-widest">{guionesSeguridad}</span>
                        )}
                      </div>
                    </div>

                    {/* Inciso d */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">d)</span>
                        {incisoDNombre || !rellenoGuiones ? (
                          <input type="text" value={incisoDNombre} onChange={(e) => setIncisoDNombre(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black flex-1 min-w-[200px] input-impresion" placeholder="Nombre completo (opcional)" />
                        ) : (
                          <span className="font-mono text-slate-500 tracking-widest">{guionesSeguridad}</span>
                        )}
                        <span>documento</span>
                        {incisoDDoc || !rellenoGuiones ? (
                          <input type="text" value={incisoDDoc} onChange={(e) => setIncisoDDoc(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-40 input-impresion" placeholder="C.I. / RUC" />
                        ) : (
                          <span className="font-mono text-slate-500 tracking-widest">--------------------</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pl-5">
                        <span>con domicilio en</span>
                        {incisoDDom || !rellenoGuiones ? (
                          <input type="text" value={incisoDDom} onChange={(e) => setIncisoDDom(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black flex-1 input-impresion" placeholder="Domicilio exacto" />
                        ) : (
                          <span className="font-mono text-slate-500 tracking-widest">{guionesSeguridad}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Punto SEGUNDO */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-2">
                    <span className="font-bold">SEGUNDO:</span>
                    <span>Que las firmas de las mencionadas personas fueron registradas en el libro correspondiente en el folio</span>
                    <input type="text" value={folio1} onChange={(e) => setFolio1(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-16 input-impresion" />
                    <span>,</span>
                    <input type="text" value={folio2} onChange={(e) => setFolio2(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-16 input-impresion" />
                    <span>,</span>
                    <input type="text" value={tomoLibro} onChange={(e) => setTomoLibro(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-28 input-impresion" />
                    <span>, en donde se halla consignado el motivo de la certificación.</span>
                  </div>

                  {/* Punto TERCERO */}
                  <div>
                    <span className="font-bold">TERCERO:</span> Que la presente actuación no autentica la veracidad de los términos del contrato, ni juzga su forma, ni su contenido.
                  </div>

                  {/* Punto CUARTO */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-2">
                    <span className="font-bold">CUARTO:</span>
                    <span>Que esta certificación la efectúo a requerimiento de las personas nombradas en el punto Primero, siendo las</span>
                    <input type="text" value={horaCert} onChange={(e) => setHoraCert(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-20 input-impresion" />
                    <span>horas del día</span>
                    <input type="text" value={diaCert} onChange={(e) => setDiaCert(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-12 input-impresion" />
                    <span>de</span>
                    <input type="text" value={mesCert} onChange={(e) => setMesCert(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-24 input-impresion" />
                    <span>del año</span>
                    <input type="text" value={anioCert} onChange={(e) => setAnioCert(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-20 input-impresion" />
                    <span>.-</span>
                  </div>
                </div>
              </div>

              {/* PIE DE FIRMA Y SELLO */}
              <div className="pt-16 pb-8 text-center flex flex-col items-center">
                <div className="w-64 border-b border-black mb-2"></div>
                <p className="font-bold text-xs uppercase">Firma y Sello del Notario</p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PLANTILLA 2: CONCUERDA (HOJA DE SEGURIDAD)                               */}
          {/* ========================================================================= */}
          {tipoDocumento === 'Concuerda' && (
            <div className="flex flex-col h-full justify-between relative">
              {/* CABECERA GUÍA */}
              <div>
                <div className={`flex items-start justify-between border-b-2 border-black pb-4 mb-8 transition-opacity duration-300 ${mostrarGuia ? 'opacity-100' : 'opacity-0'} guia-impresion`}>
                  <div>
                    <h2 className="font-black text-base uppercase tracking-wider">CORTE SUPREMA DE JUSTICIA</h2>
                    <p className="text-xs font-bold text-slate-700">REPÚBLICA DEL PARAGUAY</p>
                    <p className="text-xs font-bold mt-1 text-[#FF3131]">HOJA DE SEGURIDAD - ACTUACIÓN NOTARIAL (Serie PJD-2026)</p>
                  </div>
                  <div className="border border-black p-2 text-center w-24 h-24 flex flex-col items-center justify-center bg-slate-50">
                    <span className="text-[10px] font-mono font-bold">QR PJE</span>
                    <span className="text-[8px] text-slate-500">SEC-2026</span>
                  </div>
                </div>

                {/* CUERPO LÍNEA POR LÍNEA */}
                <div className="space-y-4 font-sans text-[13.5px] text-justify pt-12">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>...///... C O N C U E R D A fielmente con su escritura matriz Nº</span>
                    <input type="text" value={matrizNro} onChange={(e) => setMatrizNro(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-48 input-impresion" />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span>folio</span>
                    <input type="text" value={folioConcuerda} onChange={(e) => setFolioConcuerda(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-36 input-impresion" />
                    <span>del Protocolo de la División</span>
                    <input type="text" value={divisionConcuerda} onChange={(e) => setDivisionConcuerda(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-40 input-impresion" />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span>Sección “</span>
                    <input type="text" value={seccionConcuerda} onChange={(e) => setSeccionConcuerda(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-16 text-center input-impresion" />
                    <span>” del Registro Notarial Nº</span>
                    <input type="text" value={registroConcuerda} onChange={(e) => setRegistroConcuerda(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-28 input-impresion" />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span>con asiento en</span>
                    <input type="text" value={asientoConcuerda} onChange={(e) => setAsientoConcuerda(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-44 input-impresion" />
                    <span>y autorizada por</span>
                    <input type="text" value={autorizanteConcuerda} onChange={(e) => setAutorizanteConcuerda(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black flex-1 input-impresion" />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span>en el carácter de</span>
                    <input type="text" value={caracterConcuerda} onChange={(e) => setCaracterConcuerda(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-36 input-impresion" />
                    <span>de dicho Registro, expido esta</span>
                    <input type="text" value={copiaConcuerda} onChange={(e) => setCopiaConcuerda(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-32 input-impresion" />
                    <span>copia para</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input type="text" value={destinatarioConcuerda} onChange={(e) => setDestinatarioConcuerda(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-72 input-impresion" />
                    <input type="text" value={cierreConcuerda} onChange={(e) => setCierreConcuerda(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-44 input-impresion" />
                    <span>a los</span>
                    <input type="text" value={diaLetrasConcuerda} onChange={(e) => setDiaLetrasConcuerda(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-28 input-impresion" />
                    <span>días del mes</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span>de</span>
                    <input type="text" value={mesConcuerda} onChange={(e) => setMesConcuerda(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-32 input-impresion" />
                    <span>del año.</span>
                    <input type="text" value={anioLetrasConcuerda} onChange={(e) => setAnioLetrasConcuerda(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-56 input-impresion" />
                  </div>
                </div>
              </div>

              {/* PIE DE FIRMA Y SELLO */}
              <div className="pt-24 pb-12 text-center flex flex-col items-center">
                <div className="w-64 border-b border-black mb-2"></div>
                <p className="font-bold text-xs uppercase">Firma y Sello del Notario</p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PLANTILLA 3: LEGALIZACIÓN                                                */}
          {/* ========================================================================= */}
          {tipoDocumento === 'Legalización' && (
            <div className="flex flex-col h-full justify-between relative">
              {/* CABECERA GUÍA */}
              <div>
                <div className={`flex items-start justify-between border-b-2 border-black pb-4 mb-8 transition-opacity duration-300 ${mostrarGuia ? 'opacity-100' : 'opacity-0'} guia-impresion`}>
                  <div>
                    <h2 className="font-black text-base uppercase tracking-wider">CORTE SUPREMA DE JUSTICIA</h2>
                    <p className="text-xs font-bold text-slate-700">REPÚBLICA DEL PARAGUAY</p>
                    <p className="text-xs font-bold mt-1 text-[#FF3131]">LEGALIZACIÓN - ACTUACIÓN NOTARIAL (Serie PJH-2022)</p>
                  </div>
                  <div className="border border-black p-2 text-center w-24 h-24 flex flex-col items-center justify-center bg-slate-50">
                    <span className="text-[10px] font-mono font-bold">QR PJE</span>
                    <span className="text-[8px] text-slate-500">SEC-2022</span>
                  </div>
                </div>

                {/* CUERPO LÍNEA POR LÍNEA */}
                <div className="space-y-6 font-sans text-[13.5px] text-justify pt-12">
                  <div>
                    La CORTE SUPREMA DE JUSTICIA, legaliza la firma y sello del/la Notario/a
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input type="text" value={nombreNotarioLeg} onChange={(e) => setNombreNotarioLeg(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black flex-1 input-impresion" />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input type="text" value={lineaAdicionalLeg} onChange={(e) => setLineaAdicionalLeg(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black flex-1 input-impresion" />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span>obrante en el testimonio de la escritura Nº</span>
                    <input type="text" value={escrituraNroLeg} onChange={(e) => setEscrituraNroLeg(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-24 input-impresion" />
                    <span>de fecha</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input type="text" value={fechaEscrituraLeg} onChange={(e) => setFechaEscrituraLeg(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-56 input-impresion" />
                    <span>con hoja de seguridad Nº</span>
                    <input type="text" value={hojaSeguridadNroLeg} onChange={(e) => setHojaSeguridadNroLeg(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black flex-1 input-impresion" />
                  </div>

                  <div>
                    La presente Legalización se realiza sobre un documento de uso notarial expedido a nombre del/la Notario/a solicitante.
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-4">
                    <span>Asunción,</span>
                    <input type="text" value={diaLeg} onChange={(e) => setDiaLeg(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-16 input-impresion" />
                    <span>de</span>
                    <input type="text" value={mesLeg} onChange={(e) => setMesLeg(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-28 input-impresion" />
                    <span>de</span>
                    <input type="text" value={anioLeg} onChange={(e) => setAnioLeg(e.target.value)} className="border-b border-dotted border-slate-400 px-2 py-0.5 font-mono font-bold text-black w-20 input-impresion" />
                  </div>
                </div>
              </div>

              {/* PIE DE FIRMA Y SELLO */}
              <div className="pt-24 pb-12 text-center flex flex-col items-center">
                <div className="w-64 border-b border-black mb-2"></div>
                <p className="font-bold text-xs uppercase">Firma y Sello del Secretario General</p>
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
                        className={`absolute inset-0 z-20 print:!static print:!p-0 print:!h-auto print:!overflow-visible ${isAnverso ? 'pagina-anverso' : 'pagina-reverso'}`}
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
                          className="w-full h-full bg-transparent text-black font-serif font-bold text-justify outline-none border-none resize-none print:hidden selection:bg-red-100 overflow-hidden"
                          style={{ lineHeight: '10.2mm', fontSize: '15px' }}
                        />
                        {/* ESPEJO PARA IMPRESIÓN */}
                        <div 
                          className="hidden print:block w-full text-black font-serif font-bold text-justify whitespace-pre-wrap print:!h-auto print:!overflow-visible"
                          style={{ lineHeight: '10.2mm', fontSize: '15px' }}
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
