const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'components', 'EditorNotarialOficial.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Fix the Control Nº guide position from 88.5mm to 84.0mm
const oldControlGuide = `<div className="absolute text-slate-400 text-[10.5pt] whitespace-nowrap" style={{ top: '124.8mm', left: '88.5mm' }}>Control Nº</div>`;
const newControlGuide = `<div className="absolute text-slate-400 text-[10.5pt] whitespace-nowrap" style={{ top: '124.8mm', left: '84.0mm' }}>Control Nº</div>`;

if (!code.includes(oldControlGuide)) {
  console.log('oldControlGuide not found as exact match, looking with regex...');
  const rgx = /style=\{\{\s*top:\s*'124\.8mm',\s*left:\s*'88\.5mm'\s*\}\}>Control Nº<\/div>/;
  if (rgx.test(code)) {
    code = code.replace(rgx, "style={{ top: '124.8mm', left: '84.0mm' }}>Control Nº</div>");
    console.log('Replaced Control Nº guide position via regex.');
  } else {
    console.warn('Could not match Control Nº guide!');
  }
} else {
  code = code.replace(oldControlGuide, newControlGuide);
  console.log('Replaced Control Nº guide position.');
}

// 2. In handlePrint, ensure single-page templates remove flex alignment classes and are rigidly displayed
const oldHandlePrintBlock = `    // Para plantillas de una sola hoja (Certificación, Concuerda, Legalización)
    if (tipoDocumento !== 'Sellado Notarial - Protocolo') {
      clone.classList.add('plantilla-unica-hoja');
      clone.classList.remove('shadow-2xl');
      clone.style.width = '215.9mm';
      clone.style.height = '355.6mm';
      clone.style.maxHeight = '355.6mm';
      clone.style.overflow = 'hidden';
      clone.style.boxSizing = 'border-box';
      clone.style.margin = '0 auto';
    }`;

const newHandlePrintBlock = `    // Para plantillas de una sola hoja (Certificación, Concuerda, Legalización)
    if (tipoDocumento !== 'Sellado Notarial - Protocolo') {
      clone.classList.add('plantilla-unica-hoja');
      clone.classList.remove('shadow-2xl', 'flex', 'flex-col', 'justify-between');
      clone.style.display = 'block';
      clone.style.width = '215.9mm';
      clone.style.height = '355.6mm';
      clone.style.maxHeight = '355.6mm';
      clone.style.overflow = 'hidden';
      clone.style.boxSizing = 'border-box';
      clone.style.margin = '0';
      clone.style.padding = '0';
      clone.style.border = 'none';
    }`;

if (code.includes(oldHandlePrintBlock)) {
  code = code.replace(oldHandlePrintBlock, newHandlePrintBlock);
  console.log('Updated single-page setup in handlePrint.');
} else {
  console.log('Looking for single-page setup in handlePrint with normalized line endings...');
  const normCode = code.replace(/\r\n/g, '\n');
  const normOld = oldHandlePrintBlock.replace(/\r\n/g, '\n');
  if (normCode.includes(normOld)) {
    const isCRLF = code.includes('\r\n');
    const repl = newHandlePrintBlock.replace(/\r\n/g, '\n');
    const updatedNorm = normCode.replace(normOld, repl);
    code = isCRLF ? updatedNorm.replace(/\n/g, '\r\n') : updatedNorm;
    console.log('Replaced handlePrint single-page setup via normalization.');
  } else {
    console.warn('Could not match handlePrint single page block!');
  }
}

// 3. Ensure htmlImpresion style contains explicit CSS for #contenedor-hoja-3 and all 7 fields
const printHoja3Styles = `
    /* ==========================================================================
       HOJA 3: LEGALIZACIÓN - COORDENADAS MILIMÉTRICAS ESTRICTAS
       ========================================================================== */
    #contenedor-hoja-3 {
      position: absolute !important;
      top: 0mm !important;
      left: 0mm !important;
      width: 215.9mm !important;
      height: 355.6mm !important;
      max-height: 355.6mm !important;
      overflow: hidden !important;
      background: #ffffff !important;
      margin: 0mm !important;
      padding: 0mm !important;
      box-sizing: border-box !important;
    }

    #contenedor-hoja-3 .capa-datos-legalizacion {
      position: absolute !important;
      top: 0mm !important;
      left: 0mm !important;
      width: 215.9mm !important;
      height: 355.6mm !important;
      margin: 0mm !important;
      padding: 0mm !important;
    }

    #contenedor-hoja-3 span,
    #contenedor-hoja-3 input,
    #contenedor-hoja-3 .campo-hoja-3,
    #contenedor-hoja-3 .input-impresion {
      position: absolute !important;
      white-space: nowrap !important;
      border: none !important;
      outline: none !important;
      background: transparent !important;
      color: #000000 !important;
      box-shadow: none !important;
      font-family: "Times New Roman", Times, serif !important;
      font-size: 11pt !important;
      line-height: 1 !important;
      margin: 0mm !important;
      padding: 0mm !important;
      box-sizing: border-box !important;
    }

    #contenedor-hoja-3 #notaria-titular,
    #contenedor-hoja-3 .pos-leg-notaria {
      top: 97.5mm !important;
      left: 108.0mm !important;
      width: 92.0mm !important;
      height: 5.5mm !important;
      font-weight: bold !important;
      font-style: italic !important;
      font-family: "Times New Roman", Times, serif !important;
    }

    #contenedor-hoja-3 #numero-registro,
    #contenedor-hoja-3 .pos-leg-registro {
      top: 111.0mm !important;
      left: 141.0mm !important;
      width: 58.0mm !important;
      height: 5.5mm !important;
      font-weight: normal !important;
      font-style: normal !important;
      font-family: "Times New Roman", Times, serif !important;
    }

    #contenedor-hoja-3 #fecha-emision-leg,
    #contenedor-hoja-3 .pos-leg-fecha-doc {
      top: 124.5mm !important;
      left: 47.0mm !important;
      width: 40.0mm !important;
      height: 5.5mm !important;
      font-weight: normal !important;
      font-style: normal !important;
      font-family: "Times New Roman", Times, serif !important;
    }

    #contenedor-hoja-3 #control-hoja-leg,
    #contenedor-hoja-3 .pos-leg-control {
      top: 124.5mm !important;
      left: 102.0mm !important;
      width: 55.0mm !important;
      height: 5.5mm !important;
      font-weight: normal !important;
      font-style: normal !important;
      font-family: "Times New Roman", Times, serif !important;
    }

    #contenedor-hoja-3 #dia-legalizacion,
    #contenedor-hoja-3 .pos-leg-dia {
      top: 150.0mm !important;
      left: 127.0mm !important;
      width: 12.0mm !important;
      height: 5.5mm !important;
      font-weight: normal !important;
      font-style: normal !important;
      font-family: "Times New Roman", Times, serif !important;
    }

    #contenedor-hoja-3 #mes-anio-legalizacion,
    #contenedor-hoja-3 .pos-leg-mes {
      top: 150.0mm !important;
      left: 156.0mm !important;
      width: 26.0mm !important;
      height: 5.5mm !important;
      font-weight: normal !important;
      font-style: normal !important;
      font-family: "Times New Roman", Times, serif !important;
    }

    #contenedor-hoja-3 #anio-legalizacion,
    #contenedor-hoja-3 .pos-leg-anio {
      top: 150.0mm !important;
      left: 195.0mm !important;
      width: 16.0mm !important;
      height: 5.5mm !important;
      font-weight: normal !important;
      font-style: normal !important;
      font-family: "Times New Roman", Times, serif !important;
    }
`;

const anchorPrintStyle = '    /* CAMPOS DE FORMULARIO CONVERTIDOS A SPAN */';
if (code.includes(anchorPrintStyle)) {
  code = code.replace(anchorPrintStyle, printHoja3Styles + '\n' + anchorPrintStyle);
  console.log('Injected print styles for Hoja 3 into htmlImpresion.');
} else {
  const normCode = code.replace(/\r\n/g, '\n');
  const normAnchor = anchorPrintStyle.replace(/\r\n/g, '\n');
  if (normCode.includes(normAnchor)) {
    const isCRLF = code.includes('\r\n');
    const updatedNorm = normCode.replace(normAnchor, printHoja3Styles.replace(/\r\n/g, '\n') + '\n' + normAnchor);
    code = isCRLF ? updatedNorm.replace(/\n/g, '\r\n') : updatedNorm;
    console.log('Injected print styles via normalization.');
  } else {
    console.warn('Could not find anchorPrintStyle in code!');
  }
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Update script finished successfully.');
