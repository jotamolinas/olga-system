import React, { useState } from 'react';
import { 
  Printer, 
  Eye, 
  EyeOff, 
  FileText, 
  ShieldCheck, 
  Stamp, 
  HelpCircle,
  FileCheck2,
  Calendar,
  User,
  Hash,
  Sparkles
} from 'lucide-react';

export type TipoDocumentoNotarial = 'Concuerda' | 'Certificación de Firmas' | 'Legalización';

interface EditorNotarialOficialProps {
  onVolver?: () => void;
}

export const EditorNotarialOficial: React.FC<EditorNotarialOficialProps> = ({ onVolver }) => {
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumentoNotarial>('Concuerda');
  const [mostrarGuia, setMostrarGuia] = useState<boolean>(true);

  // Campos de texto para la zona media/inferior (respetando la cabecera vacía del papel oficial)
  const [folio, setFolio] = useState<string>('01');
  const [fecha, setFecha] = useState<string>(new Date().toLocaleDateString('es-PY', { day: '2-digit', month: 'long', year: 'numeric' }));
  const [nroActuacion, setNroActuacion] = useState<string>('24/2026');
  const [compareciente, setCompareciente] = useState<string>('JUAN CARLOS PÉREZ GÓMEZ');
  const [documentoId, setDocumentoId] = useState<string>('CI N° 1.234.567');
  const [cuerpoTexto, setCuerpoTexto] = useState<string>(
    'CONCUERDA fielmente con su original que he tenido a la vista y al cual me remito en caso necesario. En fe de ello, a petición de parte interesada, firmo y sello la presente en la ciudad de Asunción, República del Paraguay.'
  );
  const [notarioFirma, setNotarioFirma] = useState<string>('Abg. y Notario Público Titular');

  // Mapeo estricto de imágenes de fondo según el tipo de documento notarial
  const fondoMap: Record<TipoDocumentoNotarial, string> = {
    'Concuerda': '/hoja-de-seguridad.jpeg',
    'Certificación de Firmas': '/certificacion-de-firma.jpeg',
    'Legalización': '/actuacion-notarial.jpeg'
  };

  const imagenSeleccionada = fondoMap[tipoDocumento];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-900/95 text-slate-100 flex flex-col font-sans">
      {/* Reglas de impresión CSS estrictas para hoja Legal / Oficio sin márgenes parásitos */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #lienzo-notarial, #lienzo-notarial * { visibility: visible; }
          #lienzo-notarial { 
            position: absolute; 
            left: 0; 
            top: 0; 
            margin: 0; 
            padding: 0; 
            width: 216mm !important;
            height: 330mm !important;
            box-shadow: none !important;
            background: transparent !important;
          }
          @page { size: legal; margin: 0; }
        }
      `}</style>

      {/* Barra de control superior (No imprimible) */}
      <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-50 shadow-md print:hidden">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onVolver && (
              <button
                onClick={onVolver}
                type="button"
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors"
              >
                ← Volver
              </button>
            )}
            <div className="p-2 bg-slate-800 rounded-xl text-[#FF3131] border border-slate-700">
              <Stamp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white flex items-center gap-2">
                Lienzo Notarial de Alta Precisión
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-950 text-red-400 border border-red-800">
                  Corte Suprema
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Alineación milimétrica sobre Hojas de Seguridad físicas. Cabecera preimpresa intacta.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* 1. Selector de Tipo de Documento */}
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
              <label htmlFor="tipo-doc-select" className="text-xs font-bold text-slate-400">
                Tipo:
              </label>
              <select
                id="tipo-doc-select"
                value={tipoDocumento}
                onChange={(e) => setTipoDocumento(e.target.value as TipoDocumentoNotarial)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
              >
                <option value="Concuerda" className="bg-slate-900 text-white">Concuerda (Hoja de Seguridad)</option>
                <option value="Certificación de Firmas" className="bg-slate-900 text-white">Certificación de Firmas</option>
                <option value="Legalización" className="bg-slate-900 text-white">Legalización (Actuación Notarial)</option>
              </select>
            </div>

            {/* 2. Botón Ocultar/Ver Guía de Fondo */}
            <button
              type="button"
              onClick={() => setMostrarGuia(!mostrarGuia)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                mostrarGuia 
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 hover:bg-blue-600/30' 
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title="Alternar visibilidad del membrete de guía de fondo"
            >
              {mostrarGuia ? <Eye className="w-4 h-4 text-blue-400" /> : <EyeOff className="w-4 h-4" />}
              <span>{mostrarGuia ? 'Guía Visible' : 'Guía Oculta'}</span>
            </button>

            {/* 3. Botón Imprimir Hoja */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2 bg-[#FF3131] hover:bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-red-600/20 transition-all hover:scale-105 active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Hoja</span>
            </button>
          </div>
        </div>
      </header>

      {/* Franja informativa de resguardo físico */}
      <div className="bg-slate-800/60 border-b border-slate-800 px-4 py-2 text-center text-[11px] text-slate-400 print:hidden flex items-center justify-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span>
          <strong>Atención Notarial:</strong> Coloque la hoja matriz de seguridad en la bandeja de su impresora. La imagen guía no se imprimirá (`print:hidden`).
        </span>
      </div>

      {/* Área de Visualización y Lienzo Milimétrico */}
      <main className="flex-grow p-4 sm:p-8 overflow-auto flex justify-center items-start bg-slate-950/80">
        
        {/* EL LIENZO (CANVAS) */}
        <div 
          id="lienzo-notarial" 
          className="relative w-[216mm] h-[330mm] bg-white mx-auto shadow-2xl overflow-hidden print:w-auto print:h-auto print:shadow-none bg-transparent"
        >
          {/* CAPA 0 (GUÍA VISUAL): Imagen de fondo de la Hoja de Seguridad */}
          {mostrarGuia && (
            <img 
              src={imagenSeleccionada} 
              className="absolute inset-0 w-full h-full object-contain opacity-40 pointer-events-none print:hidden z-0" 
              alt="Fondo Notarial" 
            />
          )}

          {/* CAPA 1: TEXTOS INTERACTIVOS (Foreground) */}
          {/* REGLA DE ORO: La zona de cabecera superior (0mm a ~110mm) queda vacía para preservar el membrete físico */}
          <div className="absolute inset-0 z-10 font-mono text-sm text-black print:text-black">
            
            {/* Folio / Registro (Zona Media Superior: ~115mm) */}
            <div 
              className="absolute flex items-center gap-2"
              style={{ top: '115mm', left: '30mm' }}
            >
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider print:text-black">
                FOLIO N°:
              </span>
              <input
                type="text"
                value={folio}
                onChange={(e) => setFolio(e.target.value)}
                placeholder="00"
                className="w-16 bg-transparent border-b border-blue-200/50 outline-none print:border-none resize-none font-bold text-sm text-black"
              />
            </div>

            {/* Nro de Actuación / Serie */}
            <div 
              className="absolute flex items-center gap-2"
              style={{ top: '115mm', right: '30mm' }}
            >
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider print:text-black">
                ACTA / N°:
              </span>
              <input
                type="text"
                value={nroActuacion}
                onChange={(e) => setNroActuacion(e.target.value)}
                placeholder="00/2026"
                className="w-24 bg-transparent border-b border-blue-200/50 outline-none print:border-none resize-none font-bold text-sm text-black text-right"
              />
            </div>

            {/* Fecha y Lugar (Zona Media: ~125mm) */}
            <div 
              className="absolute flex items-center gap-2"
              style={{ top: '125mm', left: '30mm', right: '30mm' }}
            >
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider print:text-black">
                EN LA CIUDAD DE ASUNCIÓN, A LOS:
              </span>
              <input
                type="text"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                placeholder="Fecha notarial oficial..."
                className="flex-grow bg-transparent border-b border-blue-200/50 outline-none print:border-none resize-none font-bold text-sm text-black"
              />
            </div>

            {/* Compareciente e Identificación (Zona Media: ~135mm) */}
            <div 
              className="absolute flex items-center gap-2"
              style={{ top: '135mm', left: '30mm', right: '30mm' }}
            >
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider print:text-black">
                COMPARECE / REQUIRIENTE:
              </span>
              <input
                type="text"
                value={compareciente}
                onChange={(e) => setCompareciente(e.target.value)}
                placeholder="Nombre y Apellido..."
                className="flex-grow bg-transparent border-b border-blue-200/50 outline-none print:border-none resize-none font-bold text-sm text-black uppercase"
              />
              <input
                type="text"
                value={documentoId}
                onChange={(e) => setDocumentoId(e.target.value)}
                placeholder="CI / RUC..."
                className="w-40 bg-transparent border-b border-blue-200/50 outline-none print:border-none resize-none font-bold text-sm text-black text-right"
              />
            </div>

            {/* Cuerpo del Testimonio / Certificación / Concuerda (Zona Media-Inferior: ~150mm a 230mm) */}
            <div 
              className="absolute"
              style={{ top: '150mm', left: '30mm', right: '30mm' }}
            >
              <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 print:text-black">
                TEXTO DEL INSTRUMENTO ({tipoDocumento.toUpperCase()}):
              </span>
              <textarea
                value={cuerpoTexto}
                onChange={(e) => setCuerpoTexto(e.target.value)}
                rows={8}
                className="w-full bg-transparent border-b border-blue-200/50 outline-none print:border-none resize-none text-justify leading-relaxed text-sm text-black font-mono"
                placeholder="Escriba aquí el dictamen, transcripción o certificación notarial que se imprimirá exactamente en el cuerpo de la hoja..."
              />
            </div>

            {/* Firma y Sello del Escribano Autorizante (Zona Inferior: ~260mm) */}
            <div 
              className="absolute flex flex-col items-center justify-center text-center"
              style={{ top: '260mm', right: '30mm', width: '70mm' }}
            >
              <div className="w-full border-t border-slate-400 print:border-black pt-2">
                <input
                  type="text"
                  value={notarioFirma}
                  onChange={(e) => setNotarioFirma(e.target.value)}
                  className="w-full text-center bg-transparent border-b border-blue-200/50 outline-none print:border-none resize-none font-bold text-xs text-black"
                />
                <span className="text-[10px] text-slate-500 print:text-black block mt-0.5">
                  Firma y Sello Notarial
                </span>
              </div>
            </div>

          </div>
        </div>

      </main>
    </div>
  );
};

export default EditorNotarialOficial;
