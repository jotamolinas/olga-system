import React, { useRef, useEffect, useState } from 'react';
import { Pagare, Persona, GlobalConfig, formatCurrencyValue } from '../types';
import { Award, Printer, Download, Sparkles, RefreshCw, Layers, Shield, FileText, CheckCircle } from 'lucide-react';

interface PagarePDFPreviewProps {
  pagare: Pagare | null;
  personas: Persona[];
  config: GlobalConfig;
  onClose: () => void;
  userData?: any;
}


const getMesNombre = (mesIndex: number) => {
  const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  return meses[mesIndex] || '';
};



const EditableField = ({ value, onChange, className, style }: any) => {
  const ref = useRef<HTMLSpanElement>(null);
  
  useEffect(() => {
    if (ref.current && ref.current.innerText !== value) {
      ref.current.innerText = value || '';
    }
  }, [value]);

  return (
    <span 
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={`outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors inline-block ${className || ''}`}
      style={{ minWidth: '20px', ...style }}
      onBlur={(e) => {
        onChange(e.target.innerText);
      }}
    />
  );
};

export const PagarePDFPreview: React.FC<PagarePDFPreviewProps> = ({
  pagare,
  personas,
  config,
  onClose,
  userData
}) => {
  const [pageSize, setPageSize] = useState<'legal' | 'a4'>('legal');
  const [baseCertificadoNro, setBaseCertificadoNro] = useState(pagare?.certificado_firmas_nro || '000406185');
  const [fechaLugarEmision, setFechaLugarEmision] = useState(`${config?.escribania?.localidad || 'Hernandarias'}, ${pagare?.created_at ? new Date(pagare.created_at).getDate() : new Date().getDate()} de ${getMesNombre(pagare?.created_at ? new Date(pagare.created_at).getMonth() : new Date().getMonth()).toLowerCase()} de ${pagare?.created_at ? new Date(pagare.created_at).getFullYear() : new Date().getFullYear()} .-`);
  const [tasaInteres, setTasaInteres] = useState('5');
  const [clausulaPenal, setClausulaPenal] = useState('454');
  const [moraAutomatica, setMoraAutomatica] = useState('424');
  const [dispensaProtesto, setDispensaProtesto] = useState('1349');

  const currentFormattedDateTime = () => {
    return new Date().toLocaleString('es-PY', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCertificadoNroForIndex = (index: number) => {
    if (!baseCertificadoNro) return '';
    const num = parseInt(baseCertificadoNro, 10);
    if (isNaN(num)) return baseCertificadoNro;
    return String(num + index).padStart(baseCertificadoNro.length, '0');
  };

  const initialDeudor = personas.find(p => p.id === pagare?.deudor_id);
  const initialDeudorNombre = initialDeudor ? (initialDeudor.nombre + (initialDeudor.apellido ? ' ' + initialDeudor.apellido : '')) : pagare?.deudor_nombre_raw || '';
  const initialDeudorDocumento = initialDeudor ? initialDeudor.nro_documento : pagare?.deudor_documento_raw || '';
  const initialDeudorDomicilio = initialDeudor ? initialDeudor.domicilio : pagare?.deudor_domicilio_raw || 'No especificado';

  const printAreaRef = useRef<HTMLDivElement>(null);

  const formatCI = (val: string) => {
    const clean = val.replace(/[^\d-]/g, '');
    const parts = clean.split('-');
    let formatted = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (parts.length > 1) {
      formatted += '-' + parts.slice(1).join('');
    }
    return formatted;
  };

  const [acreedorNombreEditable, setAcreedorNombreEditable] = useState(pagare?.acreedor_nombre_raw || '');
  const [acreedorDomicilioEditable, setAcreedorDomicilioEditable] = useState(pagare?.acreedor_domicilio_raw || 'No especificado');
  const [deudorNombreEditable, setDeudorNombreEditable] = useState(initialDeudorNombre);
  const [deudorDocumentoEditable, setDeudorDocumentoEditable] = useState(formatCI(initialDeudorDocumento));
  const [deudorDomicilioEditable, setDeudorDomicilioEditable] = useState(initialDeudorDomicilio);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (pagare) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pagare, onClose]);

  if (!pagare) return null;

  const getMonedaSimbolo = (cod: string) => {
    return config.monedas.find(m => m.codigo === cod)?.simbolo || '$';
  };

  const getMonedaNombre = (cod: string) => {
    return config.monedas.find(m => m.codigo === cod)?.nombre || 'Moneda';
  };

  const getTipoNegociacionLabel = (tipo: string) => {
    switch (tipo) {
      case 'entrega_refuerzo_cuota': return 'Entrega Inicial + Refuerzos + Cuotas';
      case 'cuotas_corridas': return 'Cuotas Corridas';
      case 'cuotas_refuerzos': return 'Cuotas + Refuerzos';
      case 'entrega_cuotas': return 'Entrega + Cuotas';
      default: return tipo;
    }
  };

  const deudor = personas.find(p => p.id === pagare.deudor_id);
  const codeudor1 = personas.find(p => p.id === pagare.codeudor1_id);
  const codeudor2 = personas.find(p => p.id === pagare.codeudor2_id);
  
    const finalAcreedorDocumento = pagare.acreedor_documento_raw || '';
    const acreedorRep = personas.find(p => p.id === personas.find(a => a.id === pagare.acreedor_id)?.representante_id);

        const deudorRep = personas.find(p => p.id === deudor?.representante_id);

  // Utilidades de conversión a letras
  const numberToWords = (num: number): string => {
    if (num === 0) return 'CERO';
    const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const diez_diecinueve = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    const veintis = ['VEINTE', 'VEINTIUN', 'VEINTIDOS', 'VEINTITRES', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISEIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
    const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
    
    function getTriplets(n: number) {
      if (n === 100) return 'CIEN';
      let res = '';
      const c = Math.floor(n / 100);
      const d = Math.floor((n % 100) / 10);
      const u = n % 10;
      
      if (c > 0) {
        if (c === 1) res += 'CIENTO ';
        else res += centenas[c] + ' ';
      }
      
      if (d === 1) {
        res += diez_diecinueve[u] + ' ';
      } else if (d === 2) {
        res += veintis[u] + ' ';
      } else {
        if (d > 0) {
          res += decenas[d] + ' ';
          if (u > 0) res += 'Y ';
        }
        if (u > 0) res += unidades[u] + ' ';
      }
      return res.trim();
    }

    let str = '';
    const millones = Math.floor(num / 1000000);
    const miles = Math.floor((num % 1000000) / 1000);
    const restos = num % 1000;

    if (millones > 0) {
      if (millones === 1) str += 'UN MILLON ';
      else str += getTriplets(millones) + ' MILLONES ';
    }
    if (miles > 0) {
      if (miles === 1) str += 'MIL ';
      else str += getTriplets(miles) + ' MIL ';
    }
    if (restos > 0) {
      str += getTriplets(restos);
    }
    return str.trim();
  };

  

  const handlePrint = () => {
    if (printAreaRef.current) {
      const printContent = printAreaRef.current.innerHTML;
      const win = window.open('', '', 'width=900,height=650');
      if (win) {
        win.document.write('<html><head><title>Impresión Pagaré</title>');
        win.document.write('<script src="https://cdn.tailwindcss.com"></script>');
        win.document.write(`
          <style>
            @media print {
              .no-print { display: none !important; }
              .printing-sheet { 
                page-break-after: auto;
                border: none !important;
                box-shadow: none !important;
                margin: 0 !important;
                min-height: auto !important;
                padding: 0 !important;
              }
              body { 
                padding: 0; 
                margin: 0; 
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              @page { 
                margin: 1cm; 
                size: ${pageSize === 'legal' ? 'legal' : 'A4'}; 
              }
            }
          </style>
        `);
        win.document.write('</head><body class="print:h-auto print:m-0 print:p-0 print:overflow-hidden">');
        
        const plan = (userData?.planActual || userData?.plan || '').toLowerCase();
        const isFree = !plan || plan.includes('gratis') || plan.includes('free') || plan === 'demo';

        if (isFree) {
          win.document.write(`
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999; pointer-events: none; display: flex; justify-content: center; align-items: center; text-align: center; overflow: hidden;">
              <div style="transform: rotate(-45deg); font-size: 4rem; color: rgba(150, 150, 150, 0.15); font-weight: bold; font-family: sans-serif; white-space: nowrap; user-select: none;">
                Generado con O.L.G.A. - Versión Gratuita/Básica
              </div>
            </div>
          `);
        }
        win.document.write(printContent);
        win.document.write('</body></html>');
        win.document.close();
        setTimeout(() => {
          win.print();
          win.close();
        }, 800);
      }
    }
  };

  const getMockHash = () => {
    return '0x' + Array.from({length: 8}, () => Math.floor(Math.random()*16).toString(16)).join('').toUpperCase() + '...' + Array.from({length: 4}, () => Math.floor(Math.random()*16).toString(16)).join('').toUpperCase();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-message" id="pdf-preview-modal">
      <div className="bg-white rounded-[2.5rem] max-w-5xl w-full box-border shadow-2xl overflow-hidden flex flex-col h-[92vh]">
        
        {/* Modal Top Bar Action Controller */}
        <div className="px-8 py-5 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <Award className="w-6 h-6 text-emerald-400" />
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest leading-none">Matriz de Certificación Notarial</h3>
              <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">PREVIEW INSTRUMENTO PÚBLICO - SERIE PJE-{config.anio_serie}-{pagare.correlativo}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 mr-4 bg-slate-800 rounded-xl p-1">
               <span className="text-[10px] uppercase font-bold text-slate-400 ml-2 tracking-wider">Tamaño de Hoja</span>
               <select
                 value={pageSize}
                 onChange={(e) => setPageSize(e.target.value as 'legal' | 'a4')}
                 className="bg-slate-700 text-white text-xs font-bold rounded-lg px-2 py-1 outline-none cursor-pointer"
               >
                 <option value="legal">Oficio (Legal)</option>
                 <option value="a4">A4</option>
               </select>
            </div>
            <button
              onClick={handlePrint}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-700/20"
            >
              <Printer className="w-4 h-4" />
              Imprimir Falla / Documento
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-white/15 hover:bg-white/20 text-white rounded-xl text-[10px] uppercase font-bold tracking-widest transition-all"
            >
              Cerrar Vista
            </button>
          </div>
        </div>

        {/* Printable & Scrollable Workspace Area */}
        <div className="flex-grow overflow-y-auto p-4 md:p-12 bg-slate-200 flex flex-col justify-start items-center">
          
          <div className="mb-4 text-xs text-slate-500 bg-white px-5 py-3 rounded-xl shadow-sm border border-slate-200/60 font-medium text-center max-w-2xl leading-relaxed">
            💡 <strong className="text-slate-700">Impresión por Lotes</strong> <br/>
            Se generó una hoja individual para cada pagaré del cronograma.
          </div>

          <style dangerouslySetInnerHTML={{__html: `
            .printing-sheet { 
               background-color: #ffffff !important;
               border: 1px solid #cbd5e1 !important;
               box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15) !important;
            }
            @media print {
              .no-print { display: none !important; }
              .printing-sheet {
                background-image: none !important;
                background-color: #ffffff !important;
                padding: 0 !important;
                margin: 0 !important;
                border: none !important;
                box-shadow: none !important;
                page-break-after: always;
                break-after: page;
              }
              .printing-sheet:last-child {
                page-break-after: auto;
                break-after: auto;
              }
              @page {
                size: ${pageSize === 'legal' ? 'legal' : 'a4'};
              }
            }
          `}} />
          
          {/* Paper Certificate Sheet Simulation */}
          <div className={`w-full ${pageSize === 'legal' ? 'max-w-[215.9mm]' : 'max-w-[210mm]'} flex flex-col gap-12 print:h-auto print:m-0 print:p-0 print:overflow-hidden`} ref={printAreaRef}>
            {pagare.cronograma.map((item, index) => (
              <div
                key={item.id}
                className={`w-full ${pageSize === 'legal' ? 'min-h-[355.6mm]' : 'min-h-[297mm]'} relative text-slate-900 focus:outline-none transition-all printing-sheet outline-none p-8 md:p-14 mb-12 border-b-8 border-slate-300 print:mb-0 print:border-b-0 print:h-auto print:min-h-0 bg-white shadow-2xl ${index < pagare.cronograma.length - 1 ? 'print:break-after-page' : 'print:break-after-auto'}`}
                style={index < pagare.cronograma.length - 1 ? { pageBreakAfter: 'always', breakAfter: 'page' } : { pageBreakAfter: 'auto', breakAfter: 'auto' }}
              >
                {pagare.status === 'anulado' && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none select-none">
                    <div className="border-[12px] border-red-500/20 rounded-3xl p-8 md:p-12 transform -rotate-45 flex flex-col items-center justify-center">
                      <span className="text-red-500/20 font-black text-6xl md:text-8xl uppercase tracking-[0.2em] leading-none">
                        ANULADO
                      </span>
                      {pagare.anuladoAt && (
                        <span className="text-red-500/30 font-bold text-lg md:text-2xl mt-4 tracking-widest">
                          {new Date(pagare.anuladoAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                )}
               {/* Watermark security sign (Se oculta en planes de pago) */}
                {(!userData?.plan || String(userData?.plan).toLowerCase().includes('gratis') || String(userData?.plan).toLowerCase().includes('free') || String(userData?.plan).toLowerCase() === 'demo') && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 border-none rounded-sm">
                    <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] rotate-[-35deg] font-black text-[6rem] text-slate-800">
                      O.L.G.A. GRATUITO
                    </div>
                  </div>
                )}

                {/* PAGARE A LA ORDEN HEADER */}
                <div className="flex flex-col mb-6 mt-4 relative z-10 break-inside-avoid print:break-inside-avoid font-sans">
                  {userData?.logoUrl || userData?.membreteUrl ? (
                    <img src={userData?.logoUrl || userData?.membreteUrl} alt="Logo" className="w-[120px] h-auto mb-5 self-center object-contain" />
                  ) : (
                    <h2 className="text-center font-bold text-xl mb-5 uppercase tracking-wider">{userData?.razonSocial || userData?.nombre || 'EMPRESA EMISORA'}</h2>
                  )}
                  <h1 className="text-center font-bold text-lg mb-6 uppercase tracking-wider">PAGARE A LA ORDEN</h1>
                  
                  <div className="flex justify-between items-end mb-2">
                    <p className="font-bold text-sm">N° {item.numero_cuota}/{pagare.cronograma.length}</p>
                    <p className="font-bold text-sm">Gs. {formatCurrencyValue(item.monto, pagare.moneda)}.-</p>
                  </div>
                  
                  <p className="font-bold text-sm mb-6 uppercase">
                    VENCIMIENTO: {new Date(item.fecha_pag + 'T12:00:00').toLocaleDateString('es-PY')}
                  </p>
                  
                  <EditableField className="text-sm bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors w-full box-border" value={fechaLugarEmision} onChange={setFechaLugarEmision} />
                </div>

                {/* PAGARE A LA ORDEN BODY */}
                <div 
                  className="text-[13px] leading-relaxed text-slate-900 mb-8 space-y-3 text-justify relative z-10 break-inside-avoid print:break-inside-avoid font-sans outline-none focus:bg-slate-50 p-2 -mx-2 rounded transition-colors cursor-text"
                >
                  <p>
                    El día <span className="uppercase">{numberToWords(new Date(item.fecha_pag + 'T12:00:00').getDate())}</span> de <span className="uppercase">{getMesNombre(new Date(item.fecha_pag + 'T12:00:00').getMonth())}</span> del año <span className="uppercase">{numberToWords(new Date(item.fecha_pag + 'T12:00:00').getFullYear())}</span>, pagaré al 
                    Señor <EditableField className="uppercase bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors" style={{width: Math.max(150, acreedorNombreEditable.length * 8) + "px"}} value={acreedorNombreEditable} onChange={setAcreedorNombreEditable} />, en su domicilio en <EditableField className="uppercase bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors" style={{width: Math.max(200, acreedorDomicilioEditable.length * 8) + "px"}} value={acreedorDomicilioEditable} onChange={setAcreedorDomicilioEditable} />, la suma de GUARANIES <span className="uppercase">{numberToWords(item.monto)}</span> (Gs. {formatCurrencyValue(item.monto, pagare.moneda)}). Si este documento no fuera pagado, devengara un interés del <EditableField className="w-6 text-center outline-none border-b hover:border-slate-300 focus:border-slate-400 bg-transparent transition-colors" value={tasaInteres} onChange={setTasaInteres} />% mensual en concepto de cláusula penal (Art. <EditableField className="w-8 text-center outline-none border-b hover:border-slate-300 focus:border-slate-400 bg-transparent transition-colors" value={clausulaPenal} onChange={setClausulaPenal} /> C.C) desde la mora, que se producirá automáticamente (Art. <EditableField className="w-8 text-center outline-none border-b hover:border-slate-300 focus:border-slate-400 bg-transparent transition-colors" value={moraAutomatica} onChange={setMoraAutomatica} /> C.C) sin necesidad de interpelación judicial o extrajudicial alguna. Este documento lleva la cláusula "sin protesto" y en consecuencia, dispensa al portador de formalizar el protesto por falta de aceptación o de pago, para ejercer la acción de regreso (Art. <EditableField className="w-10 text-center outline-none border-b hover:border-slate-300 focus:border-slate-400 bg-transparent transition-colors" value={dispensaProtesto} onChange={setDispensaProtesto} /> C.C). Las partes constituyen domicilio especial en los lugares fijados más abajo.-
                  </p>
                </div>

                {/* SIGNATURE BLOCK */}
                <div className="pt-8 relative z-10 flex flex-col font-sans break-inside-avoid print:break-inside-avoid">
                  <div className="w-[400px] border-t border-black pt-1">
                    <p className="text-sm flex items-center gap-1">Nombre: <EditableField className="uppercase bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors flex-1" value={deudorNombreEditable} onChange={setDeudorNombreEditable} /></p>
                    <p className="text-sm flex items-center gap-1">Documento: C.I.N° <EditableField className="uppercase bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors flex-1" value={deudorDocumentoEditable} onChange={(v) => setDeudorDocumentoEditable(formatCI(v))} /></p>
                    <p className="text-sm flex items-center gap-1">Domicilio: <EditableField className="uppercase bg-transparent outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 transition-colors flex-1" value={deudorDomicilioEditable} onChange={setDeudorDomicilioEditable} /></p>
                  </div>
                </div>

                {/* CERTIFICACION DE FIRMAS FOOTER */}
                <div className="mt-24 relative z-10 break-inside-avoid print:break-inside-avoid font-sans pb-8">
                  <div className="text-[12px] uppercase flex items-center whitespace-nowrap">
                    LE CORRESPONDE LA HOJA DE CERTIFICACION DE FIRMAS N° 
                    <EditableField className={`w-24 ml-1 bg-transparent outline-none border-b border-transparent ${index === 0 ? 'hover:border-slate-300 focus:border-slate-400 focus:bg-slate-50 cursor-text' : 'cursor-default'} transition-colors`} value={getCertificadoNroForIndex(index)} onChange={(val: string) => { if (index === 0) setBaseCertificadoNro(val); }} />
                    . SERIE PJE-{new Date().getFullYear()}.- CONSTE.
                  </div>
                </div>

                {/* G. PDF Pie footer */}
                {config.pdf.mostrar_pie && (
                  <div className="pt-4 border-t border-slate-200 text-[9px] text-slate-400 flex flex-col sm:flex-row sm:justify-between items-center gap-2 font-mono" style={{ pageBreakBefore: 'avoid' }}>
                    <div className="text-center sm:text-left leading-relaxed">
                      <p className="font-bold uppercase text-slate-500">
                        {config.pdf.contenido_pie || `${config.escribania.nombre} — ${config.escribania.nro_registro}`}
                      </p>
                      <p className="mt-0.5">Certificado emitido digitalmente bajo protocolo de escribanía y timbrado Paraguayo vigente.</p>
                    </div>
                    <div className="text-right whitespace-nowrap bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <p className="text-slate-500 font-bold">Generación: {currentFormattedDateTime()}</p>
                      <p className="font-mono text-[8px] mt-0.5">Hash del Documento: {getMockHash()}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Modal Bottom control bar */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between shrink-0">
          <div className="flex gap-2 items-center text-xs font-bold font-sans text-slate-500">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span>Documento listo para firmar bajo Certificado de Firmas Nº {pagare.certificado_firmas_nro}.</span>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs uppercase tracking-wider shadow-md"
          >
            Aceptar & Cerrar Vista
          </button>
        </div>
      </div>
    </div>
  );
};
