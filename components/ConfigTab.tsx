import React, { useState, useEffect } from 'react';
import { GlobalConfig, EscribaniaConfig, MonedaConfig, FrecuenciaConfig, PDFConfig } from '../types';
import { Save, RefreshCw, KeyRound, DollarSign, CalendarDays, ClipboardList, Check, Info, Sparkles, Sun, Moon } from 'lucide-react';

interface ConfigTabProps {
  config: GlobalConfig;
  onUpdateConfig: (newConfig: GlobalConfig) => void;
  isAdmin: boolean;
}

export const ConfigTab: React.FC<ConfigTabProps> = ({ config, onUpdateConfig, isAdmin }) => {
  // Local mutable states
  const [escribania, setEscribania] = useState<EscribaniaConfig>({ ...config.escribania });
  const [monedas, setMonedas] = useState<MonedaConfig[]>([...config.monedas]);
  const [frecuencias, setFrecuencias] = useState<FrecuenciaConfig[]>([...config.frecuencias]);
  const [anioSerie, setAnioSerie] = useState<number>(config.anio_serie);
  const [pdf, setPdf] = useState<PDFConfig>({ ...config.pdf });

  const [message, setMessage] = useState('');

  // Estado del Tema Visual Global (Fondo Blanco vs Modo Oscuro)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('olga_theme') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const syncExternalTheme = (e: any) => {
      if (e?.detail?.isDark !== undefined) {
        setIsDarkMode(Boolean(e.detail.isDark));
      } else {
        try {
          setIsDarkMode(localStorage.getItem('olga_theme') === 'dark');
        } catch {}
      }
    };
    window.addEventListener('olga_theme_changed', syncExternalTheme);
    window.addEventListener('storage', syncExternalTheme);
    return () => {
      window.removeEventListener('olga_theme_changed', syncExternalTheme);
      window.removeEventListener('storage', syncExternalTheme);
    };
  }, []);

  const handleToggleTema = (dark: boolean) => {
    setIsDarkMode(dark);
    try {
      localStorage.setItem('olga_theme', dark ? 'dark' : 'light');
      localStorage.setItem('olga_facturacion_fondo_blanco', JSON.stringify(!dark));
      if (dark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      window.dispatchEvent(
        new CustomEvent('olga_theme_changed', {
          detail: { isDark: dark, modoFondoBlanco: !dark },
        })
      );
    } catch {}
  };

  const handleSaveAll = () => {
    if (!isAdmin) {
      console.error('Error: Un usuario con Rol Normal no tiene privilegios para actualizar los parámetros de configuración global.');
      return;
    }

    onUpdateConfig({
      escribania,
      monedas,
      frecuencias,
      anio_serie: anioSerie,
      pdf
    });

    setMessage('Configuración global guardada correctamente en el sistema.');
    setTimeout(() => setMessage(''), 4000);
  };

  // Currency active toggle or edit properties
  const handleToggleMonedaObj = (codigo: string) => {
    const updated = monedas.map(m => {
      if (m.codigo === codigo) {
        return { ...m, activa: !m.activa };
      }
      return m;
    });
    setMonedas(updated);
  };

  const handleUpdateMonedaOrder = (codigo: string, newOrder: number) => {
    const updated = monedas.map(m => {
      if (m.codigo === codigo) {
        return { ...m, orden: newOrder };
      }
      return m;
    });
    setMonedas(updated.sort((a,b) => a.orden - b.orden));
  };

  // Payment Frequency Active toggle
  const handleToggleFrecuenciaObj = (id: string) => {
    const updated = frecuencias.map(f => {
      if (f.id === id) {
        return { ...f, activa: !f.activa };
      }
      return f;
    });
    setFrecuencias(updated);
  };

  const handleUpdateFrecuenciaDays = (id: string, days: number) => {
    const updated = frecuencias.map(f => {
      if (f.id === id) {
        return { ...f, intervalo_dias: days };
      }
      return f;
    });
    setFrecuencias(updated);
  };

  return (
    <div className="space-y-8 animate-message dark:bg-[#0B0F17]" id="config-tab-panel">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white dark:bg-[#121824]/90 dark:backdrop-blur-xl dark:border dark:border-slate-800/80 dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] dark:rounded-2xl p-6 rounded-[2rem] border border-slate-100 shadow-sm gap-4">
        <div>
          <h2 className="text-3xl font-bold font-serif tracking-tight text-slate-800 dark:text-slate-100">Panel de Administración Global</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Parámetros jurídicos, institucionales y financieros para la escribanía y la emisión automatizada de documentos.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Botón de alternar Tema Visual (Modo Dark) */}
          <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-[#0B0F17] px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {isDarkMode ? 'Modo Oscuro' : 'Fondo Blanco'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isDarkMode}
              onClick={() => handleToggleTema(!isDarkMode)}
              className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none items-center ${
                isDarkMode ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'bg-slate-300'
              }`}
              title={isDarkMode ? 'Cambiar a Fondo Blanco' : 'Cambiar a Modo Oscuro'}
            >
              <span
                className={`pointer-events-none flex items-center justify-center h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  isDarkMode ? 'translate-x-6 text-slate-900' : 'translate-x-0 text-amber-600'
                }`}
              >
                {isDarkMode ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
              </span>
            </button>
          </div>

          {!isAdmin && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-full text-xs font-bold leading-none w-fit">
              <Info className="w-4 h-4" />
              <span>SOLO LECTURA (Acceso Restringido a Admin)</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Section A: Datos de la escribanía */}
        <div className="bg-white dark:bg-[#121824]/90 dark:backdrop-blur-xl dark:border dark:border-slate-800/80 dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] dark:rounded-2xl p-8 rounded-[2rem] border border-slate-100 shadow-md space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-50 dark:border-slate-800 pb-4">
            <ClipboardList className="w-5 h-5 text-[#FF3131]" />
            <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">1. Datos Institucionales de la Escribanía</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 mb-1.5">Nombre de la Escribanía / Consorzio</label>
              <input 
                type="text"
                disabled={!isAdmin}
                value={escribania.nombre}
                onChange={(e) => setEscribania({ ...escribania, nombre: e.target.value })}
                className="w-full box-border bg-slate-50 dark:bg-[#0B0F17] dark:text-slate-100 dark:border-slate-700/80 disabled:opacity-60 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="block text-xs font-black uppercase text-slate-400 mb-1.5">Matrícula Registro</label>
                <input 
                  type="text"
                  disabled={!isAdmin}
                  value={escribania.nro_registro}
                  onChange={(e) => setEscribania({ ...escribania, nro_registro: e.target.value })}
                  className="w-full box-border bg-slate-50 dark:bg-[#0B0F17] dark:text-slate-100 dark:border-slate-700/80 disabled:opacity-60 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-black uppercase text-slate-400 mb-1.5">Teléfono de Contacto</label>
                <input 
                  type="text"
                  disabled={!isAdmin}
                  value={escribania.telefono}
                  onChange={(e) => setEscribania({ ...escribania, telefono: e.target.value })}
                  className="w-full box-border bg-slate-50 dark:bg-[#0B0F17] dark:text-slate-100 dark:border-slate-700/80 disabled:opacity-60 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-400 mb-1.5">Dirección / Despacho Notarial</label>
              <input 
                type="text"
                disabled={!isAdmin}
                value={escribania.direccion}
                onChange={(e) => setEscribania({ ...escribania, direccion: e.target.value })}
                className="w-full box-border bg-slate-50 dark:bg-[#0B0F17] dark:text-slate-100 dark:border-slate-700/80 disabled:opacity-60 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-black uppercase text-slate-400 mb-1.5">Localidad / País</label>
                <input 
                  type="text"
                  disabled={!isAdmin}
                  value={escribania.localidad}
                  onChange={(e) => setEscribania({ ...escribania, localidad: e.target.value })}
                  className="w-full box-border bg-slate-50 dark:bg-[#0B0F17] dark:text-slate-100 dark:border-slate-700/80 disabled:opacity-60 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase text-slate-400 mb-1.5">Correo Electrónico de Contacto</label>
                <input 
                  type="email"
                  disabled={!isAdmin}
                  value={escribania.email}
                  onChange={(e) => setEscribania({ ...escribania, email: e.target.value })}
                  className="w-full box-border bg-slate-50 dark:bg-[#0B0F17] dark:text-slate-100 dark:border-slate-700/80 disabled:opacity-60 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-400 mb-1.5">Sitio Web (Opcional)</label>
              <input 
                type="text"
                disabled={!isAdmin}
                value={escribania.sitio_web}
                onChange={(e) => setEscribania({ ...escribania, sitio_web: e.target.value })}
                className="w-full box-border bg-slate-50 dark:bg-[#0B0F17] dark:text-slate-100 dark:border-slate-700/80 disabled:opacity-60 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold outline-none"
                placeholder="Ej. https://escribaniamoderna.com"
              />
            </div>
          </div>
        </div>

        {/* Section B: Configuración de Monedas */}
        <div className="bg-white dark:bg-[#121824]/90 dark:backdrop-blur-xl dark:border dark:border-slate-800/80 dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] dark:rounded-2xl p-8 rounded-[2rem] border border-slate-100 shadow-md space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-50 dark:border-slate-800 pb-4">
            <DollarSign className="w-5 h-5 text-[#FF3131]" />
            <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">2. Divisas y Gestor de Moneda</h3>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-slate-400 font-medium">Habilite/Desactive monedas líquidas o configure el orden de visualización de los desplegables.</p>
            
            <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-x-auto text-xs">
              <table className="w-full box-border border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#0B0F17] border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-black text-slate-400">
                    <th className="py-3 px-4 text-left">Código / Símbolo</th>
                    <th className="py-3 px-4 text-left">Moneda</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Prioridad / Orden</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {monedas.map((m) => (
                    <tr key={m.codigo} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-100">
                        {m.codigo} ({m.simbolo})
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300">{m.nombre}</td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => handleToggleMonedaObj(m.codigo)}
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${m.activa ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' : 'bg-red-50 text-red-500 border border-red-100 dark:bg-red-950/60 dark:text-red-400 dark:border-red-900'}`}
                        >
                          {m.activa ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <input 
                          type="number"
                          disabled={!isAdmin}
                          min={1}
                          max={10}
                          value={m.orden}
                          onChange={(e) => handleUpdateMonedaOrder(m.codigo, parseInt(e.target.value) || 1)}
                          className="w-14 bg-slate-100 dark:bg-[#0B0F17] dark:text-slate-100 border border-slate-200 dark:border-slate-700 py-1.5 px-2 font-mono font-bold text-center rounded-xl outline-none"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Section C: Prefijo Serie de certificación de firmas */}
        <div className="bg-white dark:bg-[#121824]/90 dark:backdrop-blur-xl dark:border dark:border-slate-800/80 dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] dark:rounded-2xl p-8 rounded-[2rem] border border-slate-100 shadow-md space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-50 dark:border-slate-800 pb-4">
            <KeyRound className="w-5 h-5 text-[#FF3131]" />
            <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">3. Serie de Certificación Correlativo</h3>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-slate-400 font-medium">Defina el año de vigencia que servirá como prefijo fiscal de los pagarés notarizados.</p>
            
            <div className="grid grid-cols-2 gap-4 items-center bg-slate-50 dark:bg-[#0B0F17] p-6 rounded-3xl border border-transparent dark:border-slate-800">
              <div>
                <label className="block text-xs font-black uppercase text-slate-400 mb-1">Año de Serie Vigente</label>
                <input 
                  type="number"
                  disabled={!isAdmin}
                  value={anioSerie}
                  onChange={(e) => setAnioSerie(parseInt(e.target.value) || 2026)}
                  className="w-full box-border bg-white dark:bg-[#121824] dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm font-bold tracking-tight outline-none"
                />
              </div>
              <div className="text-xs bg-slate-900 text-slate-300 p-4 rounded-2xl">
                <p className="text-[10px] font-black uppercase text-[#FF3131] mb-1">Formateador Prefijo:</p>
                <p className="font-mono text-base font-black text-white">SERIE PJE-{anioSerie}-</p>
                <p className="text-[9px] opacity-70 mt-1 leading-normal">El sistema correlacionará automáticamente sobre este formato de serie.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Section D: Frecuencias Obligatorias */}
        <div className="bg-white dark:bg-[#121824]/90 dark:backdrop-blur-xl dark:border dark:border-slate-800/80 dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] dark:rounded-2xl p-8 rounded-[2rem] border border-slate-100 shadow-md space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-50 dark:border-slate-800 pb-4">
            <CalendarDays className="w-5 h-5 text-[#FF3131]" />
            <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">4. Tabla Frecuencias del Sistema</h3>
          </div>

          <div className="space-y-4">
            <div className="text-[11px] text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 rounded-2xl p-4 border border-amber-100 dark:border-amber-800/60 font-bold leading-normal">
              Regla de Control: Prerrequisito preestablecido. Al no poder crearse frecuencias customizadas por usuario común de forma descriteriada, modifique el intervalo de vencimientos habilitados aquí.
            </div>

            <div className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-x-auto text-xs">
              <table className="w-full box-border border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#0B0F17] border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-black text-slate-400">
                    <th className="py-3 px-4 text-left">Frecuencia</th>
                    <th className="py-3 px-4 text-center">Intervalo (Días)</th>
                    <th className="py-3 px-4 text-right">Disponibilidad en Formulario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {frecuencias.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 dark:text-slate-100">{f.nombre}</span>
                          <span className="text-[10px] text-slate-400">{f.descripcion}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input 
                          type="number"
                          disabled={!isAdmin}
                          value={f.intervalo_dias}
                          onChange={(e) => handleUpdateFrecuenciaDays(f.id, parseInt(e.target.value) || 30)}
                          className="w-16 bg-slate-100 dark:bg-[#0B0F17] dark:text-slate-100 disabled:opacity-60 border border-slate-200 dark:border-slate-700 py-1.5 px-2 font-mono font-bold text-center rounded-xl outline-none"
                        />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          disabled={!isAdmin}
                          onClick={() => handleToggleFrecuenciaObj(f.id)}
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${f.activa ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' : 'bg-red-50 text-red-500 border border-red-100 dark:bg-red-950/60 dark:text-red-400 dark:border-red-900'}`}
                        >
                          {f.activa ? 'Habilitada' : 'Apagada'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Section E: Pie de página del PDF */}
        <div className="bg-white dark:bg-[#121824]/90 dark:backdrop-blur-xl dark:border dark:border-slate-800/80 dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] dark:rounded-2xl p-8 rounded-[2rem] border border-slate-100 shadow-md space-y-6 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-4">
            <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">5. Pie de Página de las Plantillas de Pagaré (PDF)</h3>
            
            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-600 dark:text-slate-300">
              <input 
                type="checkbox"
                disabled={!isAdmin}
                checked={pdf.mostrar_pie}
                onChange={(e) => setPdf({ ...pdf, mostrar_pie: e.target.checked })}
                className="rounded text-[#FF3131] focus:ring-none"
              />
              Mostrar Pie de Página en Impresión
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 mb-1.5">Contenido Notarial de Pie de Página (Edición Libre)</label>
              <textarea
                disabled={!isAdmin || !pdf.mostrar_pie}
                value={pdf.contenido_pie}
                onChange={(e) => setPdf({ ...pdf, contenido_pie: e.target.value })}
                placeholder="Si se deja vacío, completará automáticamente con los datos oficiales de la Escribanía y la marca de fecha de generación..."
                rows={3}
                className="w-full box-border bg-slate-50 dark:bg-[#0B0F17] dark:text-slate-100 disabled:opacity-50 border border-slate-200 dark:border-slate-700/80 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 outline-none resize-none focus:border-[#FF3131]"
              />
              <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                Nota: La marca temporal, hora exacta y hash del documento se imprimen de forma automática para otorgar autenticidad al pagaré.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Save action button */}
      {isAdmin && (
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center bg-white dark:bg-[#121824]/90 dark:backdrop-blur-xl dark:border dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] dark:rounded-2xl p-6 rounded-[2rem] border border-slate-100 shadow-xl">
          <div className="flex items-center gap-2 text-green-700 text-xs font-bold font-sans">
            <Sparkles className="w-5 h-5 text-green-500 animate-pulse" />
            <span>Todos los datos están preparados para la firma notarial.</span>
          </div>
          
          <button
            type="button"
            onClick={handleSaveAll}
            className="px-8 py-4 bg-[#FF3131] hover:bg-red-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-red-500/20 active:scale-95 transition-all"
          >
            <Save className="w-4 h-4" />
            Guardar Parámetros de Configuración
          </button>
        </div>
      )}

      {message && (
        <div className="bg-green-50 text-green-700 px-6 py-4 rounded-2xl border border-green-100 text-xs font-black uppercase tracking-wide text-center">
          {message}
        </div>
      )}

    </div>
  );
};
