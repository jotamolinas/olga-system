const fs = require('fs');
let code = fs.readFileSync('components/LandingPage.tsx', 'utf-8');

const target = `            {/* Plan Empresa */}
            <div className="bg-white rounded-3xl p-8 flex flex-col group transition-all duration-300 cursor-pointer shadow-sm hover:bg-purple-900 hover:text-white hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/30 hover:-translate-y-2 border-2 border-purple-500/50 sm:border-transparent">
              <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-white">Plan Empresa</h3>
              <div className="flex flex-col gap-2 mb-6 text-sm">
                <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 group-hover:bg-purple-800 group-hover:border-purple-700 group-hover:text-gray-200">
                  <Users className="w-4 h-4 text-slate-400 group-hover:text-gray-300" />
                  <span><strong className="group-hover:text-white">10</strong> Usuarios</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 group-hover:bg-purple-800 group-hover:border-purple-700 group-hover:text-gray-200">
                  <Bot className="w-4 h-4 text-emerald-500 group-hover:text-emerald-400" />
                  <span><strong className="group-hover:text-white">100</strong> Consultas IA/mes</span>
                </div>
              </div>
              <div className="mb-6 flex-grow">
                {isAnnual ? (
                  <div className="flex flex-col">
                    <span className="text-slate-400 line-through text-sm font-mono group-hover:text-purple-300">Gs. 12.000.000</span>
                    <div className="text-3xl font-black text-slate-900 font-mono group-hover:text-white">Gs. 10.000.000</div>
                    <span className="text-xs text-slate-500 group-hover:text-purple-200">/ año</span>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <span className="text-transparent line-through text-sm font-mono select-none">_</span>
                    <div className="text-3xl font-black text-slate-900 font-mono group-hover:text-white">Gs. 1.000.000</div>
                    <span className="text-xs text-slate-500 group-hover:text-purple-200">/ mes</span>
                  </div>
                )}
              </div>
              <ul className="space-y-3 mb-8 text-sm text-slate-600 font-medium group-hover:text-purple-100">
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> Todo lo del Pro</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> Estatutos y Contratos Corporativos</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> Historial de Auditoría (Logs)</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> Soporte Prioritario</li>
              </ul>
              <button onClick={() => navigate('/consola')} className="w-full box-border py-3 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-xl transition-all active:scale-95 mt-auto group-hover:bg-purple-600 group-hover:text-white group-hover:border-purple-600">
                Seleccionar Plan
              </button>
            </div>`;

const replacement = `            {/* Plan Empresa */}
            <div className="bg-slate-900 text-white rounded-3xl p-8 flex flex-col transition-all duration-300 cursor-pointer shadow-lg shadow-slate-900/20 hover:-translate-y-2 border border-slate-800">
              <h3 className="text-xl font-bold text-white mb-2">Plan Empresa</h3>
              <div className="flex flex-col gap-2 mb-6 text-sm">
                <div className="flex items-center gap-2 text-slate-300 bg-slate-800/50 p-2 rounded-lg border border-slate-700">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span><strong className="text-white">10</strong> Usuarios</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300 bg-slate-800/50 p-2 rounded-lg border border-slate-700">
                  <Bot className="w-4 h-4 text-emerald-400" />
                  <span><strong className="text-white">100</strong> Consultas IA/mes</span>
                </div>
              </div>
              <div className="mb-6 flex-grow">
                {isAnnual ? (
                  <div className="flex flex-col">
                    <span className="text-slate-500 line-through text-sm font-mono">Gs. 12.000.000</span>
                    <div className="text-3xl font-black text-white font-mono">Gs. 10.000.000</div>
                    <span className="text-xs text-slate-400">/ año</span>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <span className="text-transparent line-through text-sm font-mono select-none">_</span>
                    <div className="text-3xl font-black text-white font-mono">Gs. 1.000.000</div>
                    <span className="text-xs text-slate-400">/ mes</span>
                  </div>
                )}
              </div>
              <ul className="space-y-3 mb-8 text-sm text-slate-300 font-medium">
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> Todo lo del Pro</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> Estatutos y Contratos Corporativos</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> Historial de Auditoría (Logs)</li>
                <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> Soporte Prioritario</li>
              </ul>
              <button onClick={() => navigate('/consola')} className="w-full box-border py-3 bg-slate-800 border-2 border-slate-700 text-white font-bold rounded-xl transition-all active:scale-95 mt-auto hover:bg-slate-700">
                Seleccionar Plan
              </button>
            </div>`;

code = code.replace(target, replacement);
fs.writeFileSync('components/LandingPage.tsx', code);
