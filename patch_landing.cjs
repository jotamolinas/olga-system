const fs = require('fs');
let code = fs.readFileSync('components/LandingPage.tsx', 'utf-8');

const target = `            {/* Plan Full */}
            <div className="bg-white rounded-3xl p-8 flex flex-col group transition-all duration-300 cursor-pointer shadow-sm hover:bg-yellow-900 hover:text-white hover:border-yellow-500 hover:shadow-lg hover:shadow-yellow-500/30 hover:-translate-y-2 border-2 border-yellow-500/50 sm:border-transparent">
              <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-white">Plan Full</h3>
              <div className="flex flex-col gap-2 mb-6 text-sm">
                <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 group-hover:bg-yellow-800 group-hover:border-yellow-700 group-hover:text-gray-200">
                  <Users className="w-4 h-4 text-slate-400 group-hover:text-gray-300" />
                  <span><strong className="group-hover:text-white">15</strong> Usuarios</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 group-hover:bg-yellow-800 group-hover:border-yellow-700 group-hover:text-gray-200">
                  <Bot className="w-4 h-4 text-emerald-500 group-hover:text-emerald-400" />
                  <span><strong className="group-hover:text-white">300</strong> Consultas IA/mes</span>
                </div>
              </div>
              <div className="mb-6 flex-grow">
                {isAnnual ? (
                  <div className="flex flex-col">
                    <span className="text-slate-400 line-through text-sm font-mono group-hover:text-yellow-300">Gs. 16.200.000</span>
                    <div className="text-3xl font-black text-slate-900 font-mono group-hover:text-white">Gs. 13.500.000</div>
                    <span className="text-xs text-slate-500 group-hover:text-yellow-200">/ año</span>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <span className="text-transparent line-through text-sm font-mono select-none">_</span>
                    <div className="text-3xl font-black text-slate-900 font-mono group-hover:text-white">Gs. 1.350.000</div>
                    <span className="text-xs text-slate-500 group-hover:text-yellow-200">/ mes</span>
                  </div>
                )}
              </div>
              <ul className="space-y-3 mb-8 text-sm text-slate-600 font-medium group-hover:text-yellow-100">
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> Todo lo de Empresa</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> El Oráculo Legal</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> Módulo Perfil SEPRELAD</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> Procesamiento Masivo y Traducción</li>
              </ul>
              <button onClick={() => navigate('/consola')} className="w-full box-border py-3 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-xl transition-all active:scale-95 mt-auto group-hover:bg-yellow-500 group-hover:text-black group-hover:font-bold group-hover:border-yellow-500">
                Seleccionar Plan
              </button>
            </div>`;

const replacement = `            {/* Plan Full */}
            <div className="bg-gradient-to-br from-yellow-600 via-yellow-500 to-yellow-700 text-white rounded-3xl p-8 flex flex-col group transition-all duration-300 cursor-pointer shadow-lg shadow-yellow-600/30 hover:-translate-y-2 border border-yellow-400">
              <h3 className="text-xl font-bold text-white mb-2">Plan Full</h3>
              <div className="flex flex-col gap-2 mb-6 text-sm">
                <div className="flex items-center gap-2 text-yellow-50 bg-yellow-800/40 p-2 rounded-lg border border-yellow-600/50">
                  <Users className="w-4 h-4 text-yellow-200" />
                  <span><strong className="text-white">15</strong> Usuarios</span>
                </div>
                <div className="flex items-center gap-2 text-yellow-50 bg-yellow-800/40 p-2 rounded-lg border border-yellow-600/50">
                  <Bot className="w-4 h-4 text-yellow-200" />
                  <span><strong className="text-white">300</strong> Consultas IA/mes</span>
                </div>
              </div>
              <div className="mb-6 flex-grow">
                {isAnnual ? (
                  <div className="flex flex-col">
                    <span className="text-yellow-200/80 line-through text-sm font-mono">Gs. 16.200.000</span>
                    <div className="text-3xl font-black text-white font-mono">Gs. 13.500.000</div>
                    <span className="text-xs text-yellow-100/80">/ año</span>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <span className="text-transparent line-through text-sm font-mono select-none">_</span>
                    <div className="text-3xl font-black text-white font-mono">Gs. 1.350.000</div>
                    <span className="text-xs text-yellow-100/80">/ mes</span>
                  </div>
                )}
              </div>
              <ul className="space-y-3 mb-8 text-sm text-yellow-50 font-medium">
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-yellow-950 shrink-0 mt-0.5" /> Todo lo de Empresa</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-yellow-950 shrink-0 mt-0.5" /> El Oráculo Legal</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-yellow-950 shrink-0 mt-0.5" /> Módulo Perfil SEPRELAD</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-yellow-950 shrink-0 mt-0.5" /> Procesamiento Masivo y Traducción</li>
              </ul>
              <button onClick={() => navigate('/consola')} className="w-full box-border py-3 bg-yellow-900 border-2 border-yellow-900 text-yellow-50 hover:text-white font-bold rounded-xl transition-all active:scale-95 mt-auto hover:bg-yellow-950 hover:border-yellow-950 shadow-md">
                Seleccionar Plan
              </button>
            </div>`;

code = code.replace(target, replacement);
fs.writeFileSync('components/LandingPage.tsx', code);
