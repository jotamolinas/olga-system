const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'components', 'EditorNotarialOficial.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Ensure RotateCcw is imported from lucide-react
if (!code.includes('RotateCcw')) {
  code = code.replace(
    /import\s*\{\s*([\s\S]*?)\}\s*from\s*'lucide-react';/,
    (match, p1) => `import {\n  RotateCcw,${p1}} from 'lucide-react';`
  );
  console.log('Added RotateCcw to lucide-react imports');
}

// 2. Clear initial states for Hoja 1, 2, 3 to empty string ""
// Hoja 1
code = code.replace("const [firmasT1, setFirmasT1] = useState<string>('TITULAR.-');", "const [firmasT1, setFirmasT1] = useState<string>('');");
code = code.replace("const [firmasT2, setFirmasT2] = useState<string>('1.292.-');", "const [firmasT2, setFirmasT2] = useState<string>('');");
code = code.replace("const [firmasT3, setFirmasT3] = useState<string>('ITAKYRY.-');", "const [firmasT3, setFirmasT3] = useState<string>('');");
code = code.replace("const [tramoPrimero1, setTramoPrimero1] = useState<string>('CONTRATO PRIVADO DE');", "const [tramoPrimero1, setTramoPrimero1] = useState<string>('');");
code = code.replace("const [tramoPrimero2, setTramoPrimero2] = useState<string>('VENTA DE VEHICULO AUTOMOTOR');", "const [tramoPrimero2, setTramoPrimero2] = useState<string>('');");
code = code.replace("const [tramoPrimero3, setTramoPrimero3] = useState<string>('y ratificado en todas sus partes ante mi presencia');", "const [tramoPrimero3, setTramoPrimero3] = useState<string>('');");
code = code.replace("const [incisoANombre, setIncisoANombre] = useState<string>('JUAN CARLOS PÉREZ GÓMEZ');", "const [incisoANombre, setIncisoANombre] = useState<string>('');");
code = code.replace("const [incisoADoc, setIncisoADoc] = useState<string>('1.234.567');", "const [incisoADoc, setIncisoADoc] = useState<string>('');");
code = code.replace("const [incisoADom, setIncisoADom] = useState<string>('ASUNCIÓN');", "const [incisoADom, setIncisoADom] = useState<string>('');");
code = code.replace("const [incisoBNombre, setIncisoBNombre] = useState<string>('MARÍA ELENA GONZÁLEZ DE PÉREZ');", "const [incisoBNombre, setIncisoBNombre] = useState<string>('');");
code = code.replace("const [incisoBDoc, setIncisoBDoc] = useState<string>('2.345.678');", "const [incisoBDoc, setIncisoBDoc] = useState<string>('');");
code = code.replace("const [incisoBDom, setIncisoBDom] = useState<string>('ASUNCIÓN');", "const [incisoBDom, setIncisoBDom] = useState<string>('');");
code = code.replace("const [incisoCNombre, setIncisoCNombre] = useState<string>('****************************************');", "const [incisoCNombre, setIncisoCNombre] = useState<string>('');");
code = code.replace("const [incisoCDoc, setIncisoCDoc] = useState<string>('****************');", "const [incisoCDoc, setIncisoCDoc] = useState<string>('');");
code = code.replace("const [incisoCDom, setIncisoCDom] = useState<string>('****************************************');", "const [incisoCDom, setIncisoCDom] = useState<string>('');");
code = code.replace("const [incisoDNombre, setIncisoDNombre] = useState<string>('****************************************');", "const [incisoDNombre, setIncisoDNombre] = useState<string>('');");
code = code.replace("const [incisoDDoc, setIncisoDDoc] = useState<string>('****************');", "const [incisoDDoc, setIncisoDDoc] = useState<string>('');");
code = code.replace("const [incisoDDom, setIncisoDDom] = useState<string>('****************************************');", "const [incisoDDom, setIncisoDDom] = useState<string>('');");
code = code.replace("const [folio1, setFolio1] = useState<string>('45');", "const [folio1, setFolio1] = useState<string>('');");
code = code.replace("const [folio2, setFolio2] = useState<string>('46');", "const [folio2, setFolio2] = useState<string>('');");
code = code.replace("const [tomoLibro, setTomoLibro] = useState<string>('46-TOMO II');", "const [tomoLibro, setTomoLibro] = useState<string>('');");
code = code.replace("const [horaCert, setHoraCert] = useState<string>('16:55');", "const [horaCert, setHoraCert] = useState<string>('');");
code = code.replace("const [diaCert, setDiaCert] = useState<string>('08');", "const [diaCert, setDiaCert] = useState<string>('');");
code = code.replace("const [mesCert, setMesCert] = useState<string>('OCTUBRE');", "const [mesCert, setMesCert] = useState<string>('');");
code = code.replace("const [anioCert, setAnioCert] = useState<string>('DOS MIL VEINTISÉIS.-');", "const [anioCert, setAnioCert] = useState<string>('');");

// Hoja 2
code = code.replace("const [matrizNro, setMatrizNro] = useState<string>('49.-----------------');", "const [matrizNro, setMatrizNro] = useState<string>('');");
code = code.replace("const [folioConcuerda, setFolioConcuerda] = useState<string>('137 y siguiente');", "const [folioConcuerda, setFolioConcuerda] = useState<string>('');");
code = code.replace("const [divisionConcuerda, setDivisionConcuerda] = useState<string>('CIVIL');", "const [divisionConcuerda, setDivisionConcuerda] = useState<string>('');");
code = code.replace("const [seccionConcuerda, setSeccionConcuerda] = useState<string>('B');", "const [seccionConcuerda, setSeccionConcuerda] = useState<string>('');");
code = code.replace("const [registroConcuerda, setRegistroConcuerda] = useState<string>('1.292');", "const [registroConcuerda, setRegistroConcuerda] = useState<string>('');");
code = code.replace("const [asientoConcuerda, setAsientoConcuerda] = useState<string>('ITAKYRY');", "const [asientoConcuerda, setAsientoConcuerda] = useState<string>('');");
code = code.replace("const [autorizanteConcuerda, setAutorizanteConcuerda] = useState<string>('RICARDO GABRIEL MARTINEZ VARELA');", "const [autorizanteConcuerda, setAutorizanteConcuerda] = useState<string>('');");
code = code.replace("const [caracterConcuerda, setCaracterConcuerda] = useState<string>('TITULAR');", "const [caracterConcuerda, setCaracterConcuerda] = useState<string>('');");
code = code.replace("const [copiaConcuerda, setCopiaConcuerda] = useState<string>('PRIMERA');", "const [copiaConcuerda, setCopiaConcuerda] = useState<string>('');");
code = code.replace("const [destinatarioConcuerda, setDestinatarioConcuerda] = useState<string>('WHILHEM OSVALDO...');", "const [destinatarioConcuerda, setDestinatarioConcuerda] = useState<string>('');");
code = code.replace("const [lineaAdicionalConcuerda, setLineaAdicionalConcuerda] = useState<string>('-----------------------------------------------------');", "const [lineaAdicionalConcuerda, setLineaAdicionalConcuerda] = useState<string>('');");
code = code.replace("const [diaLetrasConcuerda, setDiaLetrasConcuerda] = useState<string>('VEINTITRES');", "const [diaLetrasConcuerda, setDiaLetrasConcuerda] = useState<string>('');");
code = code.replace("const [mesConcuerda, setMesConcuerda] = useState<string>('MAYO');", "const [mesConcuerda, setMesConcuerda] = useState<string>('');");
code = code.replace("const [anioLetrasConcuerda, setAnioLetrasConcuerda] = useState<string>('DOS MIL VEINTICINCO.-');", "const [anioLetrasConcuerda, setAnioLetrasConcuerda] = useState<string>('');");

// Hoja 3
code = code.replace("const [nombreNotarioLeg, setNombreNotarioLeg] = useState<string>('MARCELA MIRTA GÓMEZ NAVARRO');", "const [nombreNotarioLeg, setNombreNotarioLeg] = useState<string>('');");
code = code.replace("const [escrituraNroLeg, setEscrituraNroLeg] = useState<string>('SEIS (6).-');", "const [escrituraNroLeg, setEscrituraNroLeg] = useState<string>('');");
code = code.replace("const [fechaEscrituraLeg, setFechaEscrituraLeg] = useState<string>('15 de febrero del 2022.-');", "const [fechaEscrituraLeg, setFechaEscrituraLeg] = useState<string>('');");
code = code.replace("const [hojaSeguridadNroLeg, setHojaSeguridadNroLeg] = useState<string>('000019301.-');", "const [hojaSeguridadNroLeg, setHojaSeguridadNroLeg] = useState<string>('');");
code = code.replace("const [diaLeg, setDiaLeg] = useState<string>('00');", "const [diaLeg, setDiaLeg] = useState<string>('');");
code = code.replace("const [mesLeg, setMesLeg] = useState<string>('abril');", "const [mesLeg, setMesLeg] = useState<string>('');");
code = code.replace("const [anioLeg, setAnioLeg] = useState<string>('2022');", "const [anioLeg, setAnioLeg] = useState<string>('');");

console.log('States reset to empty string.');

// 3. Add handleLimpiarCampos function before handlePrint or handleGuardarConfiguracion
const limpiarFn = `
  // Función para vaciar los campos de la hoja activa
  const handleLimpiarCampos = () => {
    if (tipoDocumento === 'Certificación de Firmas') {
      setFirmasT1('');
      setFirmasT2('');
      setFirmasT3('');
      setTramoPrimero1('');
      setTramoPrimero2('');
      setTramoPrimero3('');
      setIncisoANombre('');
      setIncisoADoc('');
      setIncisoADom('');
      setIncisoBNombre('');
      setIncisoBDoc('');
      setIncisoBDom('');
      setIncisoCNombre('');
      setIncisoCDoc('');
      setIncisoCDom('');
      setIncisoDNombre('');
      setIncisoDDoc('');
      setIncisoDDom('');
      setFolio1('');
      setFolio2('');
      setTomoLibro('');
      setHoraCert('');
      setDiaCert('');
      setMesCert('');
      setAnioCert('');
    } else if (tipoDocumento === 'Concuerda') {
      setMatrizNro('');
      setFolioConcuerda('');
      setDivisionConcuerda('');
      setSeccionConcuerda('');
      setRegistroConcuerda('');
      setAsientoConcuerda('');
      setAutorizanteConcuerda('');
      setCaracterConcuerda('');
      setCopiaConcuerda('');
      setDestinatarioConcuerda('');
      setLineaAdicionalConcuerda('');
      setCierreConcuerda('');
      setDiaLetrasConcuerda('');
      setMesConcuerda('');
      setAnioLetrasConcuerda('');
    } else if (tipoDocumento === 'Legalización') {
      setNombreNotarioLeg('');
      setLineaAdicionalLeg('');
      setEscrituraNroLeg('');
      setFechaEscrituraLeg('');
      setHojaSeguridadNroLeg('');
      setDiaLeg('');
      setMesLeg('');
      setAnioLeg('');
    } else if (tipoDocumento === 'Sellado Notarial - Protocolo') {
      setProtocoloPaginas(['']);
    }
  };
`;

if (!code.includes('handleLimpiarCampos')) {
  code = code.replace(
    'const handleGuardarConfiguracion = () => {',
    limpiarFn + '\n  const handleGuardarConfiguracion = () => {'
  );
  console.log('Added handleLimpiarCampos function.');
}

// 4. In handlePrint, support filling optional comparecientes with asterisks if rellenoGuiones is active
const oldConvertInputs = `    // Convertir todos los inputs a spans transfiriendo exactamente su id, style, className y contenido
    clone.querySelectorAll('input').forEach((inp) => {
      const span = document.createElement('span');
      span.textContent = inp.value || '\\u00A0';
      if (inp.id) span.id = inp.id;
      span.className = inp.className;
      const inlineStyle = inp.getAttribute('style');
      if (inlineStyle) span.setAttribute('style', inlineStyle);
      inp.parentNode?.replaceChild(span, inp);
    });`;

const newConvertInputs = `    // Convertir todos los inputs a spans transfiriendo exactamente su id, style, className y contenido
    clone.querySelectorAll('input').forEach((inp) => {
      const span = document.createElement('span');
      let valorTexto = inp.value;
      if (!valorTexto || valorTexto.trim() === '') {
        if (rellenoGuiones) {
          if (inp.id === 'compareciente-nombre-2' || inp.id === 'compareciente-nombre-3' || inp.id === 'compareciente-nombre-4') {
            valorTexto = '****************************************';
          } else if (inp.id === 'compareciente-cedula-2' || inp.id === 'compareciente-cedula-3' || inp.id === 'compareciente-cedula-4') {
            valorTexto = '****************';
          } else if (inp.id === 'compareciente-ciudad-2' || inp.id === 'compareciente-ciudad-3' || inp.id === 'compareciente-ciudad-4') {
            valorTexto = '****************************************';
          } else if (inp.id === 'linea-adicional-concuerda') {
            valorTexto = '-----------------------------------------------------';
          } else {
            valorTexto = '\\u00A0';
          }
        } else {
          valorTexto = '\\u00A0';
        }
      }
      span.textContent = valorTexto;
      if (inp.id) span.id = inp.id;
      span.className = inp.className;
      const inlineStyle = inp.getAttribute('style');
      if (inlineStyle) span.setAttribute('style', inlineStyle);
      inp.parentNode?.replaceChild(span, inp);
    });`;

if (code.includes(oldConvertInputs)) {
  code = code.replace(oldConvertInputs, newConvertInputs);
  console.log('Updated input-to-span conversion with rellenoGuiones logic.');
} else {
  console.log('Trying normalized replacement for input-to-span conversion...');
  const normCode = code.replace(/\r\n/g, '\n');
  const normOld = oldConvertInputs.replace(/\r\n/g, '\n');
  if (normCode.includes(normOld)) {
    const isCRLF = code.includes('\r\n');
    const updatedNorm = normCode.replace(normOld, newConvertInputs.replace(/\r\n/g, '\n'));
    code = isCRLF ? updatedNorm.replace(/\n/g, '\r\n') : updatedNorm;
    console.log('Replaced input-to-span conversion via normalization.');
  } else {
    console.warn('Could not find oldConvertInputs block!');
  }
}

// 5. Add "Limpiar Campos" button in the toolbar
const btnLimpiarJSX = `            {/* Botón Limpiar Campos */}
            <button
              type="button"
              onClick={handleLimpiarCampos}
              title={\`Limpiar todos los campos de "\${tipoDocumento}"\`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-slate-700 bg-slate-800 text-slate-300 hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/10 shadow-sm active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar Campos</span>
            </button>
`;

if (!code.includes('handleLimpiarCampos}')) {
  const targetToolbar = `{/* Botón Guardar Configuración */}`;
  if (code.includes(targetToolbar)) {
    code = code.replace(targetToolbar, btnLimpiarJSX + '\n            ' + targetToolbar);
    console.log('Added Limpiar Campos button in toolbar.');
  } else {
    console.warn('Could not find targetToolbar!');
  }
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('apply_empty_fields.cjs finished part 1.');
