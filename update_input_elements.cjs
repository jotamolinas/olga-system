const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'components', 'EditorNotarialOficial.tsx');
let code = fs.readFileSync(filePath, 'utf8');

const baseInputClasses = 'absolute whitespace-nowrap bg-amber-50/40 hover:bg-amber-100/50 focus:bg-white border-b border-dashed border-slate-400 focus:border-amber-500 outline-none px-0.5 transition-colors placeholder:text-slate-400/70 placeholder:font-normal placeholder:italic print:bg-transparent print:border-none print:placeholder-transparent print:p-0 print:shadow-none input-impresion';

// ==========================================
// HOJA 1 INPUTS
// ==========================================

// 1. titular-notaria-cf
code = code.replace(
  /id="titular-notaria-cf"[\s\S]*?\/>/,
  `id="titular-notaria-cf"
                  type="text" 
                  value={firmasT1} 
                  onChange={(e) => setFirmasT1(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="TITULAR / ADSCRIPTO" 
                  style={{ position: 'absolute', top: '74.0mm', left: '99.2mm', width: '75mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-bold campo-hoja-1 pos-cert-firmas-t1" 
                />`
);

// 2. registro-notaria-cf
code = code.replace(
  /id="registro-notaria-cf"[\s\S]*?\/>/,
  `id="registro-notaria-cf"
                  type="text" 
                  value={firmasT2} 
                  onChange={(e) => setFirmasT2(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="N° Registro" 
                  style={{ position: 'absolute', top: '86.0mm', left: '69.6mm', width: '33mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-bold campo-hoja-1 pos-cert-firmas-t2" 
                />`
);

// 3. ciudad-registro-cf
code = code.replace(
  /id="ciudad-registro-cf"[\s\S]*?\/>/,
  `id="ciudad-registro-cf"
                  type="text" 
                  value={firmasT3} 
                  onChange={(e) => setFirmasT3(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="Ciudad / Asiento" 
                  style={{ position: 'absolute', top: '86.0mm', left: '137.3mm', width: '50mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-bold campo-hoja-1 pos-cert-firmas-t3" 
                />`
);

// 4. tipo-contrato-cf
code = code.replace(
  /id="tipo-contrato-cf"[\s\S]*?\/>/,
  `id="tipo-contrato-cf"
                  type="text" 
                  value={tramoPrimero1} 
                  onChange={(e) => setTramoPrimero1(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="Tipo de contrato" 
                  style={{ position: 'absolute', top: '124.0mm', left: '160.6mm', width: '48mm', height: '5.5mm', fontSize: '8pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-bold campo-hoja-1 pos-cert-tramo1" 
                />`
);

// 5. objeto-acto-cf
code = code.replace(
  /id="objeto-acto-cf"[\s\S]*?\/>/,
  `id="objeto-acto-cf"
                  type="text" 
                  value={tramoPrimero2} 
                  onChange={(e) => setTramoPrimero2(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="Objeto del acto / contrato" 
                  style={{ position: 'absolute', top: '134.5mm', left: '31.5mm', width: '114mm', height: '5.5mm', fontSize: '8pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-bold campo-hoja-1 pos-cert-tramo2" 
                />`
);

// 6. compareciente-nombre-1
code = code.replace(
  /id="compareciente-nombre-1"[\s\S]*?\/>/,
  `id="compareciente-nombre-1"
                  type="text" 
                  value={incisoANombre} 
                  onChange={(e) => setIncisoANombre(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="Nombre completo compareciente 1" 
                  style={{ position: 'absolute', top: '146.0mm', left: '37.8mm', width: '94mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-bold campo-hoja-1 pos-cert-inciso-a-nom" 
                />`
);

// 7. compareciente-cedula-1
code = code.replace(
  /id="compareciente-cedula-1"[\s\S]*?\/>/,
  `id="compareciente-cedula-1"
                  type="text" 
                  value={incisoADoc} 
                  onChange={(e) => setIncisoADoc(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="C.I. / RUC" 
                  style={{ position: 'absolute', top: '146.0mm', left: '154.3mm', width: '36mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-bold campo-hoja-1 pos-cert-inciso-a-doc" 
                />`
);

// 8. compareciente-ciudad-1
code = code.replace(
  /id="compareciente-ciudad-1"[\s\S]*?\/>/,
  `id="compareciente-ciudad-1"
                  type="text" 
                  value={incisoADom} 
                  onChange={(e) => setIncisoADom(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="Ciudad / Domicilio" 
                  style={{ position: 'absolute', top: '157.0mm', left: '63.2mm', width: '124mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-bold campo-hoja-1 pos-cert-inciso-a-dom" 
                />`
);

// 9. compareciente-nombre-2
code = code.replace(
  /id="compareciente-nombre-2"[\s\S]*?\/>/,
  `id="compareciente-nombre-2"
                  type="text" 
                  value={incisoBNombre} 
                  onChange={(e) => setIncisoBNombre(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "****************************************" : "Nombre completo (opcional)"} 
                  style={{ position: 'absolute', top: '169.0mm', left: '37.8mm', width: '94mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-bold campo-hoja-1 pos-cert-inciso-b-nom" 
                />`
);

// 10. compareciente-cedula-2
code = code.replace(
  /id="compareciente-cedula-2"[\s\S]*?\/>/,
  `id="compareciente-cedula-2"
                  type="text" 
                  value={incisoBDoc} 
                  onChange={(e) => setIncisoBDoc(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "****************" : "C.I. / RUC (opcional)"} 
                  style={{ position: 'absolute', top: '169.0mm', left: '155.3mm', width: '36mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-bold campo-hoja-1 pos-cert-inciso-b-doc" 
                />`
);

// 11. compareciente-ciudad-2
code = code.replace(
  /id="compareciente-ciudad-2"[\s\S]*?\/>/,
  `id="compareciente-ciudad-2"
                  type="text" 
                  value={incisoBDom} 
                  onChange={(e) => setIncisoBDom(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "****************************************" : "Ciudad / Domicilio (opcional)"} 
                  style={{ position: 'absolute', top: '180.0mm', left: '63.2mm', width: '124mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-bold campo-hoja-1 pos-cert-inciso-b-dom" 
                />`
);

// 12. compareciente-nombre-3
code = code.replace(
  /id="compareciente-nombre-3"[\s\S]*?\/>/,
  `id="compareciente-nombre-3"
                  type="text" 
                  value={incisoCNombre} 
                  onChange={(e) => setIncisoCNombre(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "****************************************" : "Nombre completo (opcional)"} 
                  style={{ position: 'absolute', top: '192.0mm', left: '37.8mm', width: '94mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-bold campo-hoja-1 pos-cert-inciso-c-nom" 
                />`
);

// 13. compareciente-cedula-3
code = code.replace(
  /id="compareciente-cedula-3"[\s\S]*?\/>/,
  `id="compareciente-cedula-3"
                  type="text" 
                  value={incisoCDoc} 
                  onChange={(e) => setIncisoCDoc(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "****************" : "C.I. / RUC (opcional)"} 
                  style={{ position: 'absolute', top: '192.0mm', left: '155.3mm', width: '36mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-bold campo-hoja-1 pos-cert-inciso-c-doc" 
                />`
);

// 14. compareciente-ciudad-3
code = code.replace(
  /id="compareciente-ciudad-3"[\s\S]*?\/>/,
  `id="compareciente-ciudad-3"
                  type="text" 
                  value={incisoCDom} 
                  onChange={(e) => setIncisoCDom(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "****************************************" : "Ciudad / Domicilio (opcional)"} 
                  style={{ position: 'absolute', top: '203.0mm', left: '63.2mm', width: '124mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-bold campo-hoja-1 pos-cert-inciso-c-dom" 
                />`
);

// 15. compareciente-nombre-4
code = code.replace(
  /id="compareciente-nombre-4"[\s\S]*?\/>/,
  `id="compareciente-nombre-4"
                  type="text" 
                  value={incisoDNombre} 
                  onChange={(e) => setIncisoDNombre(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "****************************************" : "Nombre completo (opcional)"} 
                  style={{ position: 'absolute', top: '215.5mm', left: '37.8mm', width: '94mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-bold campo-hoja-1 pos-cert-inciso-d-nom" 
                />`
);

// 16. compareciente-cedula-4
code = code.replace(
  /id="compareciente-cedula-4"[\s\S]*?\/>/,
  `id="compareciente-cedula-4"
                  type="text" 
                  value={incisoDDoc} 
                  onChange={(e) => setIncisoDDoc(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "****************" : "C.I. / RUC (opcional)"} 
                  style={{ position: 'absolute', top: '215.5mm', left: '154.3mm', width: '36mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-bold campo-hoja-1 pos-cert-inciso-d-doc" 
                />`
);

// 17. compareciente-ciudad-4
code = code.replace(
  /id="compareciente-ciudad-4"[\s\S]*?\/>/,
  `id="compareciente-ciudad-4"
                  type="text" 
                  value={incisoDDom} 
                  onChange={(e) => setIncisoDDom(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder={rellenoGuiones ? "****************************************" : "Ciudad / Domicilio (opcional)"} 
                  style={{ position: 'absolute', top: '225.0mm', left: '63.2mm', width: '124mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-bold campo-hoja-1 pos-cert-inciso-d-dom" 
                />`
);

// 18. libro-tomo-cf
code = code.replace(
  /id="libro-tomo-cf"[\s\S]*?\/>/,
  `id="libro-tomo-cf"
                  type="text" 
                  value={tomoLibro} 
                  onChange={(e) => setTomoLibro(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="Libro / Tomo" 
                  style={{ position: 'absolute', top: '248.0mm', left: '80.2mm', width: '55mm', height: '5.5mm', fontSize: '8pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-bold campo-hoja-1 pos-cert-tomo" 
                />`
);

// 19. hora-certificacion
code = code.replace(
  /id="hora-certificacion"[\s\S]*?\/>/,
  `id="hora-certificacion"
                  type="text" 
                  value={horaCert} 
                  onChange={(e) => setHoraCert(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="Hora" 
                  style={{ position: 'absolute', top: '314.5mm', left: '79.4mm', width: '18mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-bold campo-hoja-1 pos-cert-hora" 
                />`
);

// 20. dia-certificacion
code = code.replace(
  /id="dia-certificacion"[\s\S]*?\/>/,
  `id="dia-certificacion"
                  type="text" 
                  value={diaCert} 
                  onChange={(e) => setDiaCert(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="Día" 
                  style={{ position: 'absolute', top: '314.5mm', left: '119.8mm', width: '13mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-bold campo-hoja-1 pos-cert-dia" 
                />`
);

// 21. mes-certificacion
code = code.replace(
  /id="mes-certificacion"[\s\S]*?\/>/,
  `id="mes-certificacion"
                  type="text" 
                  value={mesCert} 
                  onChange={(e) => setMesCert(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="Mes" 
                  style={{ position: 'absolute', top: '314.5mm', left: '143.1mm', width: '44mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-bold campo-hoja-1 pos-cert-mes" 
                />`
);

// 22. anio-letras-cierre
code = code.replace(
  /id="anio-letras-cierre"[\s\S]*?\/>/,
  `id="anio-letras-cierre"
                  type="text" 
                  value={anioCert} 
                  onChange={(e) => setAnioCert(e.target.value)} 
                  onKeyDown={handleEnterKey} 
                  placeholder="Año en letras (ej. DOS MIL VEINTISÉIS.-)" 
                  style={{ position: 'absolute', top: '321.5mm', left: '60.6mm', width: '80mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-bold campo-hoja-1 pos-cert-anio" 
                />`
);

// ==========================================
// HOJA 2 INPUTS
// ==========================================

// 1. escritura-nro-concuerda
code = code.replace(
  /id="escritura-nro-concuerda"[\s\S]*?\/>/,
  `id="escritura-nro-concuerda"
                   type="text"
                   value={matrizNro}
                   onChange={(e) => setMatrizNro(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="N° Escritura"
                   style={{ position: 'absolute', top: '84.2mm', left: '140.5mm', width: '50mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="${baseInputClasses} text-black font-bold campo-hoja-2 pos-matriz"
                 />`
);

// 2. fojas-concuerda
code = code.replace(
  /id="fojas-concuerda"[\s\S]*?\/>/,
  `id="fojas-concuerda"
                   type="text"
                   value={folioConcuerda}
                   onChange={(e) => setFolioConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="Fojas"
                   style={{ position: 'absolute', top: '95.2mm', left: '36.8mm', width: '54mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="${baseInputClasses} text-black font-bold campo-hoja-2 pos-folio"
                 />`
);

// 3. division-concuerda
code = code.replace(
  /id="division-concuerda"[\s\S]*?\/>/,
  `id="division-concuerda"
                   type="text"
                   value={divisionConcuerda}
                   onChange={(e) => setDivisionConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="Sección (CIVIL)"
                   style={{ position: 'absolute', top: '95.2mm', left: '142.6mm', width: '44.5mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="${baseInputClasses} text-black font-bold campo-hoja-2 pos-division"
                 />`
);

// 4. seccion-concuerda
code = code.replace(
  /id="seccion-concuerda"[\s\S]*?\/>/,
  `id="seccion-concuerda"
                   type="text"
                   value={seccionConcuerda}
                   onChange={(e) => setSeccionConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="Serie (B)"
                   style={{ position: 'absolute', top: '105.2mm', left: '47.3mm', width: '12mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="${baseInputClasses} text-black font-bold campo-hoja-2 pos-seccion"
                 />`
);

// 5. registro-concuerda
code = code.replace(
  /id="registro-concuerda"[\s\S]*?\/>/,
  `id="registro-concuerda"
                   type="text"
                   value={registroConcuerda}
                   onChange={(e) => setRegistroConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="N° Registro"
                   style={{ position: 'absolute', top: '106.0mm', left: '108.7mm', width: '74mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="${baseInputClasses} text-black font-bold campo-hoja-2 pos-registro"
                 />`
);

// 6. ciudad-concuerda
code = code.replace(
  /id="ciudad-concuerda"[\s\S]*?\/>/,
  `id="ciudad-concuerda"
                   type="text"
                   value={asientoConcuerda}
                   onChange={(e) => setAsientoConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="Ciudad / Asiento"
                   style={{ position: 'absolute', top: '115.5mm', left: '78.0mm', width: '105mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="${baseInputClasses} text-black font-bold campo-hoja-2 pos-asiento"
                 />`
);

// 7. notario-nombre-concuerda
code = code.replace(
  /id="notario-nombre-concuerda"[\s\S]*?\/>/,
  `id="notario-nombre-concuerda"
                   type="text"
                   value={autorizanteConcuerda}
                   onChange={(e) => setAutorizanteConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="Nombre del Escribano Autorizante"
                   style={{ position: 'absolute', top: '126.2mm', left: '57.9mm', width: '125mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="${baseInputClasses} text-black font-bold campo-hoja-2 pos-autorizante"
                 />`
);

// 8. notario-caracter-concuerda
code = code.replace(
  /id="notario-caracter-concuerda"[\s\S]*?\/>/,
  `id="notario-caracter-concuerda"
                   type="text"
                   value={caracterConcuerda}
                   onChange={(e) => setCaracterConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="Carácter (TITULAR / ADSCRIPTO)"
                   style={{ position: 'absolute', top: '137.2mm', left: '90.0mm', width: '56mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="${baseInputClasses} text-black font-bold campo-hoja-2 pos-caracter"
                 />`
);

// 9. copia-concuerda
code = code.replace(
  /id="copia-concuerda"[\s\S]*?\/>/,
  `id="copia-concuerda"
                   type="text"
                   value={copiaConcuerda}
                   onChange={(e) => setCopiaConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="Copia (PRIMERA / SEGUNDA)"
                   style={{ position: 'absolute', top: '147.2mm', left: '59.0mm', width: '38mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="${baseInputClasses} text-black font-bold campo-hoja-2 pos-copia"
                 />`
);

// 10. destinatario-concuerda
code = code.replace(
  /id="destinatario-concuerda"[\s\S]*?\/>/,
  `id="destinatario-concuerda"
                   type="text"
                   value={destinatarioConcuerda}
                   onChange={(e) => setDestinatarioConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="A favor de (Titular / Destinatario)"
                   style={{ position: 'absolute', top: '147.2mm', left: '121.4mm', width: '72mm', height: '6mm', fontSize: '11.5pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="${baseInputClasses} text-black font-bold campo-hoja-2 pos-destinatario"
                 />`
);

// 11. linea-adicional-concuerda
code = code.replace(
  /id="linea-adicional-concuerda"[\s\S]*?\/>/,
  `id="linea-adicional-concuerda"
                   type="text"
                   value={lineaAdicionalConcuerda}
                   onChange={(e) => setLineaAdicionalConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="Guiones de seguridad (-----------------)"
                   style={{ position: 'absolute', top: '158.2mm', left: '26.2mm', width: '61mm', height: '5.5mm', fontSize: '8pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="${baseInputClasses} text-black font-bold campo-hoja-2 pos-linea-adicional"
                 />`
);

// 12. dia-concuerda
code = code.replace(
  /id="dia-concuerda"[\s\S]*?\/>/,
  `id="dia-concuerda"
                   type="text"
                   value={diaLetrasConcuerda}
                   onChange={(e) => setDiaLetrasConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="Día en letras"
                   style={{ position: 'absolute', top: '158.2mm', left: '100.3mm', width: '58mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="${baseInputClasses} text-black font-bold campo-hoja-2 pos-dia"
                 />`
);

// 13. mes-concuerda
code = code.replace(
  /id="mes-concuerda"[\s\S]*?\/>/,
  `id="mes-concuerda"
                   type="text"
                   value={mesConcuerda}
                   onChange={(e) => setMesConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="Mes"
                   style={{ position: 'absolute', top: '168.7mm', left: '34.6mm', width: '32mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="${baseInputClasses} text-black font-bold campo-hoja-2 pos-mes"
                 />`
);

// 14. anio-concuerda
code = code.replace(
  /id="anio-concuerda"[\s\S]*?\/>/,
  `id="anio-concuerda"
                   type="text"
                   value={anioLetrasConcuerda}
                   onChange={(e) => setAnioLetrasConcuerda(e.target.value)}
                   onKeyDown={handleEnterKey}
                   placeholder="Año en letras (ej. DOS MIL VEINTICINCO.-)"
                   style={{ position: 'absolute', top: '168.7mm', left: '81.2mm', width: '101.5mm', height: '6mm', fontSize: '12pt', fontWeight: 'bold', fontFamily: 'Arial, Helvetica, sans-serif', whiteSpace: 'nowrap' }}
                   className="${baseInputClasses} text-black font-bold campo-hoja-2 pos-anio"
                 />`
);

// ==========================================
// HOJA 3 INPUTS
// ==========================================

// 1. notaria-titular
code = code.replace(
  /id="notaria-titular"[\s\S]*?\/>/,
  `id="notaria-titular"
                  type="text" 
                  value={nombreNotarioLeg} 
                  onChange={(e) => setNombreNotarioLeg(e.target.value)} 
                  onKeyDown={handleEnterKey}
                  placeholder="Nombre del/la Notario/a"
                  style={{ position: 'absolute', top: '97.5mm', left: '108.0mm', width: '92mm', height: '5.5mm', fontSize: '11pt', fontWeight: 'bold', fontStyle: 'italic', fontFamily: '"Times New Roman", Times, serif', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-bold italic campo-hoja-3 pos-leg-notaria" 
                />`
);

// 2. numero-registro
code = code.replace(
  /id="numero-registro"[\s\S]*?\/>/,
  `id="numero-registro"
                  type="text" 
                  value={escrituraNroLeg} 
                  onChange={(e) => setEscrituraNroLeg(e.target.value)} 
                  onKeyDown={handleEnterKey}
                  placeholder="N° Registro (ej. SEIS (6).-)"
                  style={{ position: 'absolute', top: '111.0mm', left: '141.0mm', width: '58mm', height: '5.5mm', fontSize: '11pt', fontWeight: 'normal', fontStyle: 'normal', fontFamily: '"Times New Roman", Times, serif', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-normal campo-hoja-3 pos-leg-registro" 
                />`
);

// 3. fecha-emision-leg
code = code.replace(
  /id="fecha-emision-leg"[\s\S]*?\/>/,
  `id="fecha-emision-leg"
                  type="text" 
                  value={fechaEscrituraLeg} 
                  onChange={(e) => setFechaEscrituraLeg(e.target.value)} 
                  onKeyDown={handleEnterKey}
                  placeholder="Fecha doc (ej. 15 de febrero del 2022.-)"
                  style={{ position: 'absolute', top: '124.5mm', left: '47.0mm', width: '40mm', height: '5.5mm', fontSize: '11pt', fontWeight: 'normal', fontStyle: 'normal', fontFamily: '"Times New Roman", Times, serif', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-normal campo-hoja-3 pos-leg-fecha-doc" 
                />`
);

// 4. control-hoja-leg
code = code.replace(
  /id="control-hoja-leg"[\s\S]*?\/>/,
  `id="control-hoja-leg"
                  type="text" 
                  value={hojaSeguridadNroLeg} 
                  onChange={(e) => setHojaSeguridadNroLeg(e.target.value)} 
                  onKeyDown={handleEnterKey}
                  placeholder="N° Control (ej. 000019301.-)"
                  style={{ position: 'absolute', top: '124.5mm', left: '102.0mm', width: '55mm', height: '5.5mm', fontSize: '11pt', fontWeight: 'normal', fontStyle: 'normal', fontFamily: '"Times New Roman", Times, serif', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-normal campo-hoja-3 pos-leg-control" 
                />`
);

// 5. dia-legalizacion
code = code.replace(
  /id="dia-legalizacion"[\s\S]*?\/>/,
  `id="dia-legalizacion"
                  type="text" 
                  value={diaLeg} 
                  onChange={(e) => setDiaLeg(e.target.value)} 
                  onKeyDown={handleEnterKey}
                  placeholder="Día"
                  style={{ position: 'absolute', top: '150.0mm', left: '127.0mm', width: '12mm', height: '5.5mm', fontSize: '11pt', fontWeight: 'normal', fontStyle: 'normal', fontFamily: '"Times New Roman", Times, serif', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-normal campo-hoja-3 pos-leg-dia" 
                />`
);

// 6. mes-anio-legalizacion
code = code.replace(
  /id="mes-anio-legalizacion"[\s\S]*?\/>/,
  `id="mes-anio-legalizacion"
                  type="text" 
                  value={mesLeg} 
                  onChange={(e) => setMesLeg(e.target.value)} 
                  onKeyDown={handleEnterKey}
                  placeholder="Mes"
                  style={{ position: 'absolute', top: '150.0mm', left: '156.0mm', width: '26mm', height: '5.5mm', fontSize: '11pt', fontWeight: 'normal', fontStyle: 'normal', fontFamily: '"Times New Roman", Times, serif', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-normal campo-hoja-3 pos-leg-mes" 
                />`
);

// 7. anio-legalizacion
code = code.replace(
  /id="anio-legalizacion"[\s\S]*?\/>/,
  `id="anio-legalizacion"
                  type="text" 
                  value={anioLeg} 
                  onChange={(e) => setAnioLeg(e.target.value)} 
                  onKeyDown={handleEnterKey}
                  placeholder="Año"
                  style={{ position: 'absolute', top: '150.0mm', left: '195.0mm', width: '16mm', height: '5.5mm', fontSize: '11pt', fontWeight: 'normal', fontStyle: 'normal', fontFamily: '"Times New Roman", Times, serif', whiteSpace: 'nowrap' }}
                  className="${baseInputClasses} text-black font-normal campo-hoja-3 pos-leg-anio" 
                />`
);

fs.writeFileSync(filePath, code, 'utf8');
console.log('update_input_elements.cjs executed successfully.');
