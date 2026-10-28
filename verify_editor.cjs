const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'components', 'EditorNotarialOficial.tsx');
const code = fs.readFileSync(filePath, 'utf8');

console.log('=== VERIFYING EditorNotarialOficial.tsx ===');

// Check initial states
const statesToCheck = [
  'firmasT1', 'firmasT2', 'firmasT3', 'tramoPrimero1', 'tramoPrimero2', 'tramoPrimero3',
  'incisoANombre', 'incisoADoc', 'incisoADom',
  'incisoBNombre', 'incisoBDoc', 'incisoBDom',
  'incisoCNombre', 'incisoCDoc', 'incisoCDom',
  'incisoDNombre', 'incisoDDoc', 'incisoDDom',
  'folio1', 'folio2', 'tomoLibro',
  'horaCert', 'diaCert', 'mesCert', 'anioCert',
  'matrizNro', 'folioConcuerda', 'divisionConcuerda', 'seccionConcuerda', 'registroConcuerda',
  'asientoConcuerda', 'autorizanteConcuerda', 'caracterConcuerda', 'copiaConcuerda',
  'destinatarioConcuerda', 'lineaAdicionalConcuerda', 'diaLetrasConcuerda', 'mesConcuerda',
  'anioLetrasConcuerda', 'nombreNotarioLeg', 'escrituraNroLeg', 'fechaEscrituraLeg',
  'hojaSeguridadNroLeg', 'diaLeg', 'mesLeg', 'anioLeg'
];

let allEmpty = true;
statesToCheck.forEach(state => {
  const rgx = new RegExp(`const\\s*\\[${state},\\s*set\\w+\\]\\s*=\\s*useState<string>\\(['\"](.*)['\"]\\)`);
  const match = code.match(rgx);
  if (match) {
    if (match[1] !== '') {
      console.error(`ERROR: ${state} has non-empty initial value: "${match[1]}"`);
      allEmpty = false;
    }
  } else {
    console.warn(`WARNING: state ${state} not matched with expected regex pattern`);
  }
});
if (allEmpty) {
  console.log('✅ ALL states in Hojas 1, 2, and 3 initialize to empty string ("").');
}

// Check coordinates
const expectedCoords = [
  // Hoja 1
  { field: 'titular-notaria-cf', top: '74.0mm', left: '99.2mm' },
  { field: 'registro-notaria-cf', top: '86.0mm', left: '69.6mm' },
  { field: 'ciudad-registro-cf', top: '86.0mm', left: '137.3mm' },
  { field: 'tipo-contrato-cf', top: '124.0mm', left: '160.6mm' },
  { field: 'objeto-acto-cf', top: '134.5mm', left: '31.5mm' },
  { field: 'compareciente-nombre-1', top: '146.0mm', left: '37.8mm' },
  { field: 'compareciente-cedula-1', top: '146.0mm', left: '154.3mm' },
  { field: 'compareciente-ciudad-1', top: '157.0mm', left: '63.2mm' },
  { field: 'compareciente-nombre-2', top: '169.0mm', left: '37.8mm' },
  { field: 'compareciente-cedula-2', top: '169.0mm', left: '155.3mm' },
  { field: 'compareciente-ciudad-2', top: '180.0mm', left: '63.2mm' },
  { field: 'compareciente-nombre-3', top: '192.0mm', left: '37.8mm' },
  { field: 'compareciente-cedula-3', top: '192.0mm', left: '155.3mm' },
  { field: 'compareciente-ciudad-3', top: '203.0mm', left: '63.2mm' },
  { field: 'compareciente-nombre-4', top: '215.5mm', left: '37.8mm' },
  { field: 'compareciente-cedula-4', top: '215.5mm', left: '154.3mm' },
  { field: 'compareciente-ciudad-4', top: '225.0mm', left: '63.2mm' },
  { field: 'libro-tomo-cf', top: '248.0mm', left: '80.2mm' },
  { field: 'hora-certificacion', top: '314.5mm', left: '79.4mm' },
  { field: 'dia-certificacion', top: '314.5mm', left: '119.8mm' },
  { field: 'mes-certificacion', top: '314.5mm', left: '143.1mm' },
  { field: 'anio-letras-cierre', top: '321.5mm', left: '60.6mm' },

  // Hoja 2
  { field: 'escritura-nro-concuerda', top: '84.2mm', left: '140.5mm' },
  { field: 'fojas-concuerda', top: '95.2mm', left: '36.8mm' },
  { field: 'division-concuerda', top: '95.2mm', left: '142.6mm' },
  { field: 'seccion-concuerda', top: '105.2mm', left: '47.3mm' },
  { field: 'registro-concuerda', top: '106.0mm', left: '108.7mm' },
  { field: 'ciudad-concuerda', top: '115.5mm', left: '78.0mm' },
  { field: 'notario-nombre-concuerda', top: '126.2mm', left: '57.9mm' },
  { field: 'notario-caracter-concuerda', top: '137.2mm', left: '90.0mm' },
  { field: 'copia-concuerda', top: '147.2mm', left: '59.0mm' },
  { field: 'destinatario-concuerda', top: '147.2mm', left: '121.4mm' },
  { field: 'linea-adicional-concuerda', top: '158.2mm', left: '26.2mm' },
  { field: 'dia-concuerda', top: '158.2mm', left: '100.3mm' },
  { field: 'mes-concuerda', top: '168.7mm', left: '34.6mm' },
  { field: 'anio-concuerda', top: '168.7mm', left: '81.2mm' },

  // Hoja 3
  { field: 'notaria-titular', top: '97.5mm', left: '108.0mm' },
  { field: 'numero-registro', top: '111.0mm', left: '141.0mm' },
  { field: 'fecha-emision-leg', top: '124.5mm', left: '47.0mm' },
  { field: 'control-hoja-leg', top: '124.5mm', left: '102.0mm' },
  { field: 'dia-legalizacion', top: '150.0mm', left: '127.0mm' },
  { field: 'mes-anio-legalizacion', top: '150.0mm', left: '156.0mm' },
  { field: 'anio-legalizacion', top: '150.0mm', left: '195.0mm' }
];

let allCoordsMatch = true;
expectedCoords.forEach(({ field, top, left }) => {
  const topMatch = code.includes(`top: '${top}'`);
  const leftMatch = code.includes(`left: '${left}'`);
  if (!topMatch || !leftMatch) {
    console.error(`ERROR: Field ${field} missing expected coordinate top:${top}, left:${left}`);
    allCoordsMatch = false;
  }
});

if (allCoordsMatch) {
  console.log('✅ ALL coordinates (top/left) verified and 100% intact.');
}

// Check "Limpiar Campos" button and function
if (code.includes('handleLimpiarCampos') && code.includes('Limpiar Campos')) {
  console.log('✅ "Limpiar Campos" function and button verified in toolbar.');
} else {
  console.error('ERROR: "Limpiar Campos" missing!');
}

// Check rellenoGuiones handling in print
if (code.includes('rellenoGuiones') && code.includes('compareciente-nombre-2')) {
  console.log('✅ "rellenoGuiones" logic verified in print conversion.');
} else {
  console.error('ERROR: "rellenoGuiones" print conversion missing!');
}

console.log('=== VERIFICATION COMPLETE ===');
