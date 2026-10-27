const fs = require('fs');

function replaceInFile(filePath, targets) {
  if (!fs.existsSync(filePath)) {
    console.error(`File does not exist: ${filePath}`);
    return false;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  for (const { search, replace, name } of targets) {
    if (content.includes(search)) {
      content = content.replace(search, replace);
      console.log(`[SUCCESS] Replaced ${name} in ${filePath}`);
      modified = true;
    } else {
      console.warn(`[WARNING] Search string not found for ${name} in ${filePath}`);
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[SAVED] Saved changes to ${filePath}`);
    return true;
  }
  return false;
}

// 1. PagaresTab.tsx
replaceInFile('components/PagaresTab.tsx', [
  {
    name: 'PagaresTab Header',
    search: `      {/* Cabecera Principal Unificada */}
      <div className="bg-slate-900 text-white p-6 md:p-8 rounded-[2.5rem] shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 text-[#FF3131] flex items-center justify-center shrink-0 border border-white/10">
              <Banknote className="w-5 h-5 text-[#FF3131]" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2 font-serif">
                <span>Gestión de Pagarés</span>
                <span className="px-2.5 py-0.5 bg-[#FF3131] text-white text-[9px] font-black uppercase tracking-widest rounded-lg">
                  O.L.G.A.
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                Panel principal para la gestión, redacción y control de pagarés oficiales para la {config.escribania.nombre}.
              </p>
            </div>
          </div>
        </div>

        {/* Resumen de Estado y Acceso Directo */}
        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto relative z-10">
          <div className="px-3 py-2 bg-slate-800/80 border border-slate-700/60 rounded-2xl text-[11px] font-bold text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#FF3131]"></span>
            <span>{pagares.length} Pagarés Registrados</span>
          </div>
        </div>
      </div>`,
    replace: `      {/* Cabecera Principal Unificada */}
      <div className="bg-white border border-amber-200/70 rounded-3xl p-6 shadow-[0_8px_30px_-4px_rgba(251,191,36,0.12)] flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 flex items-center justify-center text-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.15)] shrink-0">
              <Banknote className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-slate-900 font-serif font-bold text-2xl tracking-tight flex items-center gap-2">
                <span>Gestión de Pagarés</span>
                <span className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-bold text-[10px] px-2.5 py-0.5 rounded-full shadow-[0_2px_10px_rgba(245,158,11,0.3)]">
                  O.L.G.A.
                </span>
              </h2>
              <p className="text-slate-500 text-sm mt-1 font-medium">
                Panel principal para la gestión, redacción y control de pagarés oficiales para la {config.escribania.nombre}.
              </p>
            </div>
          </div>
        </div>

        {/* Resumen de Estado y Acceso Directo */}
        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto relative z-10">
          <div className="bg-amber-50/80 text-amber-900 border border-amber-300/60 rounded-xl px-3.5 py-1.5 text-xs font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>{pagares.length} Pagarés Registrados</span>
          </div>
        </div>
      </div>`
  },
  {
    name: 'PagaresTab Tabs and Redactar Button',
    search: `      {/* Tab selection inside Pagares panel */}
      <div className="flex flex-col lg:flex-row justify-between items-center bg-white p-2 sm:p-3 rounded-3xl border border-slate-100 shadow-sm gap-2">
        <div className="flex flex-wrap justify-center gap-3 w-full box-border lg:w-auto bg-slate-50 p-1 rounded-2xl">
          <button
            onClick={() => { setPanelView('list'); setEditingPagareId(null); }}
            className={\`flex-1 lg:flex-none px-3 sm:px-6 py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all \${panelView === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}\`}
          >
            Activos ({pagares.filter(p => p.status !== 'anulado').length})
          </button>
          <button
            onClick={() => { setPanelView('list_anulados'); setEditingPagareId(null); }}
            className={\`flex-1 lg:flex-none px-3 sm:px-6 py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all \${panelView === 'list_anulados' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}\`}
          >
            Eliminados ({pagares.filter(p => p.status === 'anulado').length})
          </button>
          <button
            onClick={() => {
              handleClearForm();
            }}
            className={\`flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-6 py-2.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all \${panelView === 'create' ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-[0_4px_14px_rgba(249,115,22,0.3)] hover:shadow-[0_6px_20px_rgba(249,115,22,0.5)]' : 'bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white border border-orange-200/60 shadow-xs'}\`}
          >
            <Plus className="w-4 h-4" /> Redactar Nuevo
          </button>
        </div>`,
    replace: `      {/* Tab selection inside Pagares panel */}
      <div className="flex flex-col lg:flex-row justify-between items-center bg-white p-2 sm:p-3 rounded-3xl border border-slate-200/80 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] gap-2">
        <div className="flex flex-wrap justify-center gap-2 w-full box-border lg:w-auto bg-slate-50 p-1.5 rounded-2xl border border-slate-200/60">
          <button
            onClick={() => { setPanelView('list'); setEditingPagareId(null); }}
            className={\`flex-1 lg:flex-none px-3.5 sm:px-6 py-2 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all \${panelView === 'list' ? 'bg-amber-50 text-amber-900 border border-amber-300/80 shadow-[0_2px_12px_rgba(245,158,11,0.15)] font-semibold' : 'text-slate-500 hover:text-slate-800'}\`}
          >
            Activos ({pagares.filter(p => p.status !== 'anulado').length})
          </button>
          <button
            onClick={() => { setPanelView('list_anulados'); setEditingPagareId(null); }}
            className={\`flex-1 lg:flex-none px-3.5 sm:px-6 py-2 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all \${panelView === 'list_anulados' ? 'bg-amber-50 text-amber-900 border border-amber-300/80 shadow-[0_2px_12px_rgba(245,158,11,0.15)] font-semibold' : 'text-slate-500 hover:text-slate-800'}\`}
          >
            Eliminados ({pagares.filter(p => p.status === 'anulado').length})
          </button>
          <button
            onClick={() => {
              handleClearForm();
            }}
            className="flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-4 sm:px-6 py-2 rounded-xl text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-[0_4px_15px_rgba(245,158,11,0.35)] hover:shadow-[0_6px_22px_rgba(245,158,11,0.55)] border border-amber-400/30 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Redactar Nuevo
          </button>
        </div>`
  }
]);

// 2. EscritosTab.tsx
replaceInFile('components/EscritosTab.tsx', [
  {
    name: 'EscritosTab Header',
    search: `          {/* Cabecera Principal Unificada */}
          <div className="bg-slate-900 text-white p-6 md:p-8 rounded-[2.5rem] shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/10 blur-[100px] rounded-full pointer-events-none"></div>
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 text-[#FF3131] flex items-center justify-center shrink-0 border border-white/10">
                <FileText className="w-5 h-5 text-[#FF3131]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-white tracking-tight font-serif">Gestión de Escritos y Notaría</h2>
                  <span className="px-2.5 py-0.5 bg-[#FF3131] text-white text-[9px] font-black uppercase tracking-widest rounded-lg">
                    O.L.G.A.
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 font-medium">
                  Entorno ergonómico unificado: Redacción asistida con IA, Editor Notarial Activo y Gestión Documental.
                </p>
              </div>
            </div>

            {/* Resumen de Estado y Acceso Directo a Drive */}
            <div className="flex flex-wrap items-center gap-3 self-start md:self-auto relative z-10">
              <div className="px-3 py-2 bg-slate-800/80 border border-slate-700/60 rounded-2xl text-[11px] font-bold text-slate-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#FF3131]"></span>
                <span>{escritos.length} Documentos en Archivo</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('seccion-gestion-documental');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer border border-slate-700"
              >
                <FolderInput className="w-3.5 h-3.5 text-[#FF3131]" />
                <span>Ver Archivo Documental ↓</span>
              </button>
            </div>
          </div>`,
    replace: `          {/* Cabecera Principal Unificada */}
          <div className="bg-white border border-amber-200/70 rounded-3xl p-6 shadow-[0_8px_30px_-4px_rgba(251,191,36,0.12)] flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/10 blur-[100px] rounded-full pointer-events-none"></div>
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 flex items-center justify-center text-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.15)] shrink-0">
                <FileText className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-slate-900 font-serif font-bold text-2xl tracking-tight">Gestión de Escritos y Notaría</h2>
                  <span className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-bold text-[10px] px-2.5 py-0.5 rounded-full shadow-[0_2px_10px_rgba(245,158,11,0.3)]">
                    O.L.G.A.
                  </span>
                </div>
                <p className="text-slate-500 text-sm mt-1 font-medium">
                  Entorno ergonómico unificado: Redacción asistida con IA, Editor Notarial Activo y Gestión Documental.
                </p>
              </div>
            </div>

            {/* Resumen de Estado y Acceso Directo a Drive */}
            <div className="flex flex-wrap items-center gap-3 self-start md:self-auto relative z-10">
              <div className="bg-amber-50/80 text-amber-900 border border-amber-300/60 rounded-xl px-3.5 py-1.5 text-xs font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>{escritos.length} Documentos en Archivo</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('seccion-gestion-documental');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer border border-slate-200/80 hover:border-amber-300"
              >
                <FolderInput className="w-3.5 h-3.5 text-amber-600" />
                <span>Ver Archivo Documental ↓</span>
              </button>
            </div>
          </div>`
  },
  {
    name: 'EscritosTab IA Button and Nuevo Escrito Button',
    search: `                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(true)}
                  className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group cursor-pointer border border-slate-800 active:scale-[0.99]"
                >
                  <Sparkles className="w-4 h-4 text-[#FF3131] group-hover:scale-110 transition-transform" />
                  <span>GENERAR BORRADOR CON IA</span>
                </button>`,
    replace: `                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(true)}
                  className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 rounded-xl shadow-[0_4px_14px_rgba(0,0,0,0.1)] font-semibold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 group cursor-pointer active:scale-[0.99]"
                >
                  <Sparkles className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span>GENERAR BORRADOR CON IA</span>
                </button>`
  },
  {
    name: 'EscritosTab Nuevo Escrito Button',
    search: `            <button
              type="button"
              onClick={handleNuevoEscrito}
              className="flex-1 py-3.5 px-4 bg-[#FF3131] hover:bg-red-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-red-500/20 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>+ Nuevo Escrito</span>
            </button>`,
    replace: `            <button
              type="button"
              onClick={handleNuevoEscrito}
              className="flex-1 py-3.5 px-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl text-xs uppercase tracking-wider transition-all duration-200 shadow-[0_4px_15px_rgba(245,158,11,0.35)] hover:shadow-[0_6px_22px_rgba(245,158,11,0.55)] border border-amber-400/30 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>+ Nuevo Escrito</span>
            </button>`
  }
]);

// 3. EditorNotarialOficial.tsx
replaceInFile('components/EditorNotarialOficial.tsx', [
  {
    name: 'EditorNotarialOficial Header',
    search: `      {/* Cabecera Principal Unificada */}
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
      </header>`,
    replace: `      {/* Cabecera Principal Unificada */}
      <header className="bg-white border border-amber-200/70 rounded-3xl p-6 shadow-[0_8px_30px_-4px_rgba(251,191,36,0.12)] m-4 md:m-6 flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative overflow-hidden print:hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="relative z-10 flex items-center gap-3">
          {onVolver && (
            <button
              onClick={onVolver}
              type="button"
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors border border-slate-200 shadow-xs cursor-pointer"
            >
              ← Volver
            </button>
          )}
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 flex items-center justify-center text-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.15)] shrink-0">
            <Stamp className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-slate-900 font-serif font-bold text-2xl tracking-tight flex items-center gap-2">
              <span>Sección Notarial</span>
              <span className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-bold text-[10px] px-2.5 py-0.5 rounded-full shadow-[0_2px_10px_rgba(245,158,11,0.3)]">
                O.L.G.A.
              </span>
            </h1>
            <p className="text-slate-500 text-sm mt-1 font-medium">
              Plantillas oficiales de la Corte Suprema de Justicia generadas puramente en HTML/CSS milimétrico.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto relative z-10">
          {/* Selector de Tipo de Documento */}
          <div className="flex items-center gap-2 bg-amber-50/80 px-3.5 py-2 rounded-xl border border-amber-300/60">
            <label htmlFor="tipo-doc-select" className="text-xs font-bold text-amber-900">
              Plantilla:
            </label>
            <select
              id="tipo-doc-select"
              value={tipoDocumento}
              onChange={(e) => handleCambiarTipoDocumento(e.target.value as TipoDocumentoNotarial)}
              className="bg-transparent text-xs font-semibold text-slate-900 focus:outline-none cursor-pointer"
            >
              <option value="Sellado Notarial - Protocolo">0. Sellado Notarial - Protocolo</option>
              <option value="Certificación de Firmas">1. Certificación de Firmas</option>
              <option value="Concuerda">2. Concuerda (Hoja de Seguridad)</option>
              <option value="Legalización">3. Legalización Notarial</option>
            </select>
          </div>
        </div>
      </header>`
  },
  {
    name: 'EditorNotarialOficial Imprimir Hoja Button',
    search: `            {/* Botón Imprimir Hoja */}
            <button
              id="btn-imprimir-hoja"
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-1.5 bg-[#FF3131] hover:bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-red-600/20 transition-all hover:scale-105 active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Hoja</span>
            </button>`,
    replace: `            {/* Botón Imprimir Hoja */}
            <button
              id="btn-imprimir-hoja"
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl text-xs uppercase tracking-wider shadow-[0_4px_15px_rgba(245,158,11,0.35)] hover:shadow-[0_6px_22px_rgba(245,158,11,0.55)] transition-all duration-200 border border-amber-400/30 cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Hoja</span>
            </button>`
  }
]);

// 4. ModuloPresupuestos.tsx
replaceInFile('components/ModuloPresupuestos.tsx', [
  {
    name: 'ModuloPresupuestos Header & Buttons',
    search: `      {/* Cabecera Principal del Módulo (oculta al imprimir) */}
      <header className={\`p-6 md:p-8 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative overflow-hidden transition-colors dark:bg-[#121824]/90 dark:backdrop-blur-xl dark:border-slate-800/80 dark:text-slate-100 print:hidden \${
        modoFondoBlanco
          ? 'bg-white border-slate-200 text-slate-900'
          : 'bg-[#121824]/90 backdrop-blur-xl border-slate-800/80 text-slate-100'
      }\`}>
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="relative z-10 flex items-center gap-4">
          {onVolver && (
            <button
              onClick={onVolver}
              type="button"
              className={\`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors border flex items-center gap-2 cursor-pointer \${
                modoFondoBlanco
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }\`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver</span>
            </button>
          )}
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20 shadow-inner">
            <Banknote className="w-6 h-6 text-amber-500" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className={\`text-xl md:text-2xl font-black tracking-tight font-serif dark:text-slate-100 \${modoFondoBlanco ? 'text-slate-900' : 'text-slate-100'}\`}>
                Presupuestos y Facturación Notarial
              </h1>
              <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-700 dark:bg-gradient-to-r dark:from-amber-500 dark:via-yellow-400 dark:to-amber-600 dark:text-slate-950 dark:font-bold dark:shadow-[0_0_20px_rgba(245,158,11,0.35)] border border-amber-500/30 text-[9px] font-black uppercase tracking-widest rounded-lg">
                Ley 879
              </span>
            </div>
            <p className={\`text-xs mt-1 font-medium dark:text-slate-400 \${modoFondoBlanco ? 'text-slate-500' : 'text-slate-400'}\`}>
              Gestión modular de reembolsos de tasas judiciales, aranceles registrales y honorarios de escribanía.
            </p>
          </div>
        </div>

        {/* Botones de Acción Global */}
        <div className="flex flex-wrap items-center gap-2.5 relative z-10 print:hidden">
          <button
            type="button"
            onClick={handleRestaurarDefecto}
            className={\`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer \${
              modoFondoBlanco
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700'
            }\`}
            title="Restablecer valores"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Restablecer</span>
          </button>

          <button
            type="button"
            onClick={handleGuardarPresupuesto}
            disabled={guardandoFirestore}
            className={\`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-60 \${
              guardadoExito
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/30'
                : modoFondoBlanco
                ? 'bg-slate-800 hover:bg-slate-900 text-white border-slate-700'
                : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-600'
            }\`}
            title="Guardar en base de datos Firestore y respaldo local"
          >
            {guardandoFirestore ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
            ) : guardadoExito ? (
              <Check className="w-4 h-4 text-white" />
            ) : (
              <Save className="w-4 h-4 text-emerald-400" />
            )}
            <span>{guardandoFirestore ? 'Guardando en BD...' : guardadoExito ? '¡Presupuesto Guardado!' : 'Guardar Presupuesto'}</span>
          </button>

          <button
            type="button"
            onClick={handleImprimir}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-950" />
            <span>Imprimir {encabezado.tipoComprobante}</span>
          </button>
        </div>
      </header>`,
    replace: `      {/* Cabecera Principal del Módulo (oculta al imprimir) */}
      <header className="bg-white border-b border-amber-200/70 p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative overflow-hidden shadow-[0_8px_30px_-4px_rgba(251,191,36,0.12)] print:hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="relative z-10 flex items-center gap-4">
          {onVolver && (
            <button
              onClick={onVolver}
              type="button"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors border flex items-center gap-2 cursor-pointer bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver</span>
            </button>
          )}
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 flex items-center justify-center text-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.15)] shrink-0">
            <Banknote className="w-6 h-6 text-amber-600" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-slate-900 font-serif font-bold text-2xl tracking-tight">
                Presupuestos y Facturación Notarial
              </h1>
              <span className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-bold text-[10px] px-2.5 py-0.5 rounded-full shadow-[0_2px_10px_rgba(245,158,11,0.3)]">
                Ley 879
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-1 font-medium">
              Gestión modular de reembolsos de tasas judiciales, aranceles registrales y honorarios de escribanía.
            </p>
          </div>
        </div>

        {/* Botones de Acción Global */}
        <div className="flex flex-wrap items-center gap-2.5 relative z-10 print:hidden">
          <button
            type="button"
            onClick={handleRestaurarDefecto}
            className="px-3 py-2 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 cursor-pointer bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
            title="Restablecer valores"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Restablecer</span>
          </button>

          <button
            type="button"
            onClick={handleGuardarPresupuesto}
            disabled={guardandoFirestore}
            className={\`px-4 py-2 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 cursor-pointer shadow-[0_4px_14px_rgba(0,0,0,0.1)] disabled:opacity-60 \${
              guardadoExito
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/30'
                : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-amber-500/30'
            }\`}
            title="Guardar en base de datos Firestore y respaldo local"
          >
            {guardandoFirestore ? (
              <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
            ) : guardadoExito ? (
              <Check className="w-4 h-4 text-white" />
            ) : (
              <Save className="w-4 h-4 text-amber-400" />
            )}
            <span>{guardandoFirestore ? 'Guardando en BD...' : guardadoExito ? '¡Presupuesto Guardado!' : 'Guardar Presupuesto'}</span>
          </button>

          <button
            type="button"
            onClick={handleImprimir}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold text-xs uppercase tracking-wider transition-all duration-200 shadow-[0_4px_15px_rgba(245,158,11,0.35)] hover:shadow-[0_6px_22px_rgba(245,158,11,0.55)] border border-amber-400/30 flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-white" />
            <span>Imprimir {encabezado.tipoComprobante}</span>
          </button>
        </div>
      </header>`
  },
  {
    name: 'ModuloPresupuestos Filter Tabs',
    search: `      {/* Barra de Filtros y Subsecciones (oculta al imprimir) */}
      <div className={\`px-6 py-3 border-b flex items-center justify-between gap-4 flex-wrap transition-colors print:hidden \${
        modoFondoBlanco
          ? 'bg-white border-slate-200 text-slate-800'
          : 'bg-slate-950/60 border-slate-800 text-slate-200'
      }\`}>
        <div className="flex items-center gap-2">
          {(['todo', 'tasas', 'servicios', 'resumen'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setPestañaActiva(tab)}
              className={\`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer \${
                pestañaActiva === tab
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                  : modoFondoBlanco
                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }\`}
            >
              {tab === 'todo' && 'Vista Completa'}
              {tab === 'tasas' && \`1. Tasas y Reembolsos (\${tasas.filter((t) => t.activo).length})\`}
              {tab === 'servicios' && \`2. Servicios y Honorarios (\${servicios.filter((s) => s.activo).length})\`}
              {tab === 'resumen' && '3. Liquidación Final'}
            </button>
          ))}
        </div>
        {/* Totales rápidos en la barra */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className={\`\${modoFondoBlanco ? 'text-slate-500' : 'text-slate-400'} hidden sm:block\`}>
            Tasas: <strong className={modoFondoBlanco ? 'text-slate-800' : 'text-slate-200'}>Gs. {liquidacion.subtotalTasasReembolso.toLocaleString('es-PY')}</strong>
          </div>
          <div className={\`\${modoFondoBlanco ? 'text-slate-500' : 'text-slate-400'} hidden sm:block\`}>
            Servicios: <strong className={modoFondoBlanco ? 'text-slate-800' : 'text-slate-200'}>Gs. {liquidacion.totalVentaServicios.toLocaleString('es-PY')}</strong>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-xl text-amber-600 dark:text-amber-400 font-bold">
            Total: Gs. {liquidacion.totalGeneralOperacion.toLocaleString('es-PY')}
          </div>
        </div>
      </div>`,
    replace: `      {/* Barra de Filtros y Subsecciones (oculta al imprimir) */}
      <div className="px-6 py-3 border-b border-slate-200/80 bg-slate-50/80 flex items-center justify-between gap-4 flex-wrap transition-colors print:hidden">
        <div className="flex items-center gap-2">
          {(['todo', 'tasas', 'servicios', 'resumen'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setPestañaActiva(tab)}
              className={\`px-3.5 py-1.5 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer \${
                pestañaActiva === tab
                  ? 'bg-amber-50 text-amber-900 border border-amber-300/80 shadow-[0_2px_12px_rgba(245,158,11,0.15)] font-semibold'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200/80 shadow-xs font-medium'
              }\`}
            >
              {tab === 'todo' && 'Vista Completa'}
              {tab === 'tasas' && \`1. Tasas y Reembolsos (\${tasas.filter((t) => t.activo).length})\`}
              {tab === 'servicios' && \`2. Servicios y Honorarios (\${servicios.filter((s) => s.activo).length})\`}
              {tab === 'resumen' && '3. Liquidación Final'}
            </button>
          ))}
        </div>
        {/* Totales rápidos en la barra */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-slate-500 hidden sm:block">
            Tasas: <strong className="text-slate-800">Gs. {liquidacion.subtotalTasasReembolso.toLocaleString('es-PY')}</strong>
          </div>
          <div className="text-slate-500 hidden sm:block">
            Servicios: <strong className="text-slate-800">Gs. {liquidacion.totalVentaServicios.toLocaleString('es-PY')}</strong>
          </div>
          <div className="bg-amber-50 border border-amber-300/70 px-3 py-1 rounded-xl text-amber-900 font-bold shadow-xs">
            Total: Gs. {liquidacion.totalGeneralOperacion.toLocaleString('es-PY')}
          </div>
        </div>
      </div>`
  }
]);

// 5. ConfiguracionTab.tsx
replaceInFile('components/ConfiguracionTab.tsx', [
  {
    name: 'ConfiguracionTab Header',
    search: `      {/* Cabecera Principal Estilo Enterprise con Campana Interactiva */}
      <div className="bg-slate-900 dark:bg-[#121824]/90 dark:backdrop-blur-xl dark:border dark:border-slate-800/80 dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] dark:rounded-2xl text-white p-6 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700 text-[#FF3131] shrink-0">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold font-serif tracking-tight text-white dark:text-slate-100">Configuración del Sistema</h2>
            <p className="text-slate-300 dark:text-slate-400 text-xs mt-0.5">
              Parámetros institucionales, sincronización en tiempo real y directivas de seguridad.
            </p>
          </div>
        </div>
        {/* Panel de Acciones Superiores */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          <span className="px-3 py-1.5 bg-slate-800 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold">
            {pagaresEfectivos.length} Pagarés Monitoreados
          </span>
        </div>
      </div>`,
    replace: `      {/* Cabecera Principal Estilo Enterprise con Campana Interactiva */}
      <div className="bg-white border border-amber-200/70 rounded-3xl p-6 shadow-[0_8px_30px_-4px_rgba(251,191,36,0.12)] flex flex-col md:flex-row md:items-center md:justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 flex items-center justify-center text-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.15)] shrink-0">
            <Settings className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-slate-900 font-serif font-bold text-2xl tracking-tight">Configuración del Sistema</h2>
              <span className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-bold text-[10px] px-2.5 py-0.5 rounded-full shadow-[0_2px_10px_rgba(245,158,11,0.3)]">
                O.L.G.A.
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-1 font-medium">
              Parámetros institucionales, sincronización en tiempo real y directivas de seguridad.
            </p>
          </div>
        </div>
        {/* Panel de Acciones Superiores */}
        <div className="relative z-10 flex items-center gap-3 self-end md:self-auto">
          <span className="bg-amber-50/80 text-amber-900 border border-amber-300/60 rounded-xl px-3.5 py-1.5 text-xs font-semibold">
            {pagaresEfectivos.length} Pagarés Monitoreados
          </span>
        </div>
      </div>`
  },
  {
    name: 'ConfiguracionTab Subir Logo Button',
    search: `                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5 text-[#FF3131]" />
                  <span>Subir Logo</span>
                </button>`,
    replace: `                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 rounded-xl shadow-[0_4px_14px_rgba(0,0,0,0.1)] font-semibold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span>Subir Logo</span>
                </button>`
  }
]);

// 6. SoporteClienteTab.tsx
replaceInFile('components/SoporteClienteTab.tsx', [
  {
    name: 'SoporteClienteTab Enviar Consulta Button',
    search: `            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Enviar Consulta
                </>
              )}
            </button>`,
    replace: `            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold text-sm uppercase tracking-wider rounded-xl shadow-[0_4px_15px_rgba(245,158,11,0.35)] hover:shadow-[0_6px_22px_rgba(245,158,11,0.55)] transition-all duration-200 border border-amber-400/30 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 text-white" />
                  Enviar Consulta
                </>
              )}
            </button>`
  }
]);

// 7. App.tsx (Chat Header and Chat Send Button)
replaceInFile('App.tsx', [
  {
    name: 'App.tsx Chat Header',
    search: `                <div className="bg-white p-4 md:p-8 md:rounded-[2.5rem] border-0 md:border md:border-slate-100 shadow-none md:shadow-md flex-grow md:h-[78vh] flex flex-col space-y-4 md:space-y-6 animate-message" id="chat-assistant-container">
                  <div className="border-b border-slate-50 pb-4 shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <h2 className="text-2xl font-bold font-serif text-slate-800 flex items-center gap-2.5">
                          {esPlanFull ? <Sparkles className="w-6 h-6 text-[#FF3131]" /> : <MessageSquare className="w-6 h-6 text-[#FF3131]" />}
                          {esPlanFull ? 'El Oráculo de O.L.G.A.' : 'O.L.G.A. - Asistente Jurídico y Tributario'}
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                          {esPlanFull 
                            ? 'Supervisión, auditoría y análisis documental avanzado. Usa los chips para atajos rápidos.' 
                            : 'Pregunte libremente a O.L.G.A. sobre legislación, redacción contractual o simulaciones.'}
                        </p>
                      </div>`,
    replace: `                <div className="bg-white p-4 md:p-8 md:rounded-[2.5rem] border-0 md:border md:border-slate-200/80 shadow-none md:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] flex-grow md:h-[78vh] flex flex-col space-y-4 md:space-y-6 animate-message" id="chat-assistant-container">
                  <div className="border-b border-slate-100 pb-4 shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 flex items-center justify-center text-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.15)] shrink-0">
                          {esPlanFull ? <Sparkles className="w-6 h-6 text-amber-600" /> : <MessageSquare className="w-6 h-6 text-amber-600" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-slate-900 font-serif font-bold text-2xl tracking-tight">
                              {esPlanFull ? 'El Oráculo de O.L.G.A.' : 'O.L.G.A. - Asistente Jurídico y Tributario'}
                            </h2>
                            <span className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-bold text-[10px] px-2.5 py-0.5 rounded-full shadow-[0_2px_10px_rgba(245,158,11,0.3)]">
                              O.L.G.A.
                            </span>
                          </div>
                          <p className="text-slate-500 text-sm mt-1 font-medium">
                            {esPlanFull 
                              ? 'Supervisión, auditoría y análisis documental avanzado. Usa los chips para atajos rápidos.' 
                              : 'Pregunte libremente a O.L.G.A. sobre legislación, redacción contractual o simulaciones.'}
                          </p>
                        </div>
                      </div>`
  },
  {
    name: 'App.tsx Chat Send Button',
    search: `                        <button
                          onClick={() => handleSendChatMessage()}
                          className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-slate-900 text-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.1)] hover:bg-[#FF3131] hover:scale-105 transition-all"
                        >
                          <Send className="w-4 h-4 ml-0.5" />
                        </button>`,
    replace: `                        <button
                          onClick={() => handleSendChatMessage()}
                          className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl shadow-[0_4px_15px_rgba(245,158,11,0.35)] hover:shadow-[0_6px_22px_rgba(245,158,11,0.55)] transition-all duration-200 border border-amber-400/30 cursor-pointer"
                        >
                          <Send className="w-4 h-4 ml-0.5 text-white" />
                        </button>`
  }
]);

console.log('Script execution complete.');
