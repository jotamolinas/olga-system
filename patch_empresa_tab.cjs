const fs = require('fs');
let code = fs.readFileSync('components/PlanesTab.tsx', 'utf-8');

const targetLoop = `          {plans.map(plan => {
            const isFull = plan.id === 'Full';
            return (
            <div 
              key={plan.id}
              className={\`rounded-3xl p-6 flex flex-col relative transition-all duration-300 hover:-translate-y-2 \${isFull ? 'bg-gradient-to-br from-yellow-600 via-yellow-500 to-yellow-700 border-2 border-yellow-400 shadow-lg shadow-yellow-600/30 text-white' : plan.recommended ? 'bg-gradient-to-b from-blue-900 to-slate-800 border-2 border-blue-500/50 transform md:-translate-y-6 shadow-xl shadow-blue-900/40' : 'bg-slate-800/80 backdrop-blur-sm border border-slate-700'}\`}
            >
              {plan.recommended && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-blue-400 to-blue-600 text-white text-[10px] font-black uppercase tracking-widest py-1.5 px-4 rounded-full shadow-lg flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  Recomendado
                </div>
              )}
              {isFull && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-yellow-900 to-yellow-950 text-yellow-400 text-[10px] font-black uppercase tracking-widest py-1.5 px-4 rounded-full shadow-lg flex items-center gap-1 border border-yellow-600">
                  <Target className="w-3 h-3" />
                  Premium
                </div>
              )}
              
              <h3 className={\`text-xl font-bold mb-2 \${isFull ? 'text-white' : plan.recommended ? 'text-blue-100' : 'text-white'}\`}>{plan.name}</h3>
              
              <div className="flex flex-col gap-2 mb-6 text-sm">
                <div className={\`flex items-center gap-2 p-2 rounded-lg border \${isFull ? 'text-yellow-50 bg-yellow-800/40 border-yellow-600/50' : 'text-slate-300 bg-slate-800/50 border-slate-700/50'}\`}>
                  <Users className={\`w-4 h-4 \${isFull ? 'text-yellow-200' : 'text-slate-400'}\`} />
                  <span><strong>{plan.users}</strong> Usuarios</span>
                </div>
                <div className={\`flex items-center gap-2 p-2 rounded-lg border \${isFull ? 'text-yellow-50 bg-yellow-800/40 border-yellow-600/50' : 'text-slate-300 bg-slate-800/50 border-slate-700/50'}\`}>
                  <Bot className={\`w-4 h-4 \${isFull ? 'text-yellow-200' : 'text-emerald-400'}\`} />
                  <span><strong>{plan.aiLimits}</strong> Consultas IA/mes</span>
                </div>
              </div>
              
              <div className="mb-8 flex-grow">
                {isAnnual ? (
                  <div className="flex flex-col">
                    <span className={\`line-through text-sm font-mono \${isFull ? 'text-yellow-200/80' : 'text-slate-500'}\`}>Gs. {plan.annualBasePrice}</span>
                    <div className="text-3xl font-black text-white font-mono">
                      Gs. {plan.annualDiscountedPrice}
                    </div>
                    <span className={\`text-xs \${isFull ? 'text-yellow-100/80' : plan.recommended ? 'text-blue-300/70' : 'text-slate-400'}\`}>/ año</span>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <span className="text-transparent line-through text-sm font-mono select-none">_</span>
                    <div className="text-3xl font-black text-white font-mono">
                      Gs. {plan.monthlyPrice}
                    </div>
                    <span className={\`text-xs \${isFull ? 'text-yellow-100/80' : plan.recommended ? 'text-blue-300/70' : 'text-slate-400'}\`}>/ mes</span>
                  </div>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-grow">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className={\`flex gap-3 text-sm items-start \${isFull ? 'text-yellow-50' : plan.recommended ? 'text-blue-100' : 'text-slate-300'}\`}>
                    <CheckCircle2 className={\`w-4 h-4 shrink-0 mt-0.5 \${isFull ? 'text-yellow-950' : plan.recommended ? 'text-blue-400' : 'text-emerald-500'}\`} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button 
                onClick={() => onPlanSelect(plan.name, isAnnual ? \`Gs. \${plan.annualDiscountedPrice} / año\` : \`Gs. \${plan.monthlyPrice} / mes\`)}
                className={\`w-full font-bold py-3.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 \${isFull ? 'bg-yellow-900 hover:bg-yellow-950 text-white shadow-md' : plan.recommended ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-700 hover:bg-slate-600 text-white'}\`}
              >
                Seleccionar Plan
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          );})}`;

const replacementLoop = `          {plans.map(plan => {
            const isFull = plan.id === 'Full';
            const isEmpresa = plan.id === 'Empresa';
            return (
            <div 
              key={plan.id}
              className={\`rounded-3xl p-6 flex flex-col relative transition-all duration-300 hover:-translate-y-2 \${isFull ? 'bg-gradient-to-br from-yellow-600 via-yellow-500 to-yellow-700 border-2 border-yellow-400 shadow-lg shadow-yellow-600/30 text-white' : isEmpresa ? 'bg-slate-950 border-2 border-slate-800 text-white shadow-lg shadow-slate-950/40' : plan.recommended ? 'bg-gradient-to-b from-blue-900 to-slate-800 border-2 border-blue-500/50 transform md:-translate-y-6 shadow-xl shadow-blue-900/40' : 'bg-slate-800/80 backdrop-blur-sm border border-slate-700'}\`}
            >
              {plan.recommended && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-blue-400 to-blue-600 text-white text-[10px] font-black uppercase tracking-widest py-1.5 px-4 rounded-full shadow-lg flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  Recomendado
                </div>
              )}
              {isFull && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-yellow-900 to-yellow-950 text-yellow-400 text-[10px] font-black uppercase tracking-widest py-1.5 px-4 rounded-full shadow-lg flex items-center gap-1 border border-yellow-600">
                  <Target className="w-3 h-3" />
                  Premium
                </div>
              )}
              {isEmpresa && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-widest py-1.5 px-4 rounded-full shadow-lg flex items-center gap-1 border border-slate-700">
                  <Building className="w-3 h-3" />
                  Corporativo
                </div>
              )}
              
              <h3 className={\`text-xl font-bold mb-2 \${isFull || isEmpresa ? 'text-white' : plan.recommended ? 'text-blue-100' : 'text-white'}\`}>{plan.name}</h3>
              
              <div className="flex flex-col gap-2 mb-6 text-sm">
                <div className={\`flex items-center gap-2 p-2 rounded-lg border \${isFull ? 'text-yellow-50 bg-yellow-800/40 border-yellow-600/50' : isEmpresa ? 'text-slate-300 bg-slate-900 border-slate-800' : 'text-slate-300 bg-slate-800/50 border-slate-700/50'}\`}>
                  <Users className={\`w-4 h-4 \${isFull ? 'text-yellow-200' : 'text-slate-400'}\`} />
                  <span><strong>{plan.users}</strong> Usuarios</span>
                </div>
                <div className={\`flex items-center gap-2 p-2 rounded-lg border \${isFull ? 'text-yellow-50 bg-yellow-800/40 border-yellow-600/50' : isEmpresa ? 'text-slate-300 bg-slate-900 border-slate-800' : 'text-slate-300 bg-slate-800/50 border-slate-700/50'}\`}>
                  <Bot className={\`w-4 h-4 \${isFull ? 'text-yellow-200' : 'text-emerald-400'}\`} />
                  <span><strong>{plan.aiLimits}</strong> Consultas IA/mes</span>
                </div>
              </div>
              
              <div className="mb-8 flex-grow">
                {isAnnual ? (
                  <div className="flex flex-col">
                    <span className={\`line-through text-sm font-mono \${isFull ? 'text-yellow-200/80' : 'text-slate-500'}\`}>Gs. {plan.annualBasePrice}</span>
                    <div className="text-3xl font-black text-white font-mono">
                      Gs. {plan.annualDiscountedPrice}
                    </div>
                    <span className={\`text-xs \${isFull ? 'text-yellow-100/80' : plan.recommended ? 'text-blue-300/70' : 'text-slate-400'}\`}>/ año</span>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <span className="text-transparent line-through text-sm font-mono select-none">_</span>
                    <div className="text-3xl font-black text-white font-mono">
                      Gs. {plan.monthlyPrice}
                    </div>
                    <span className={\`text-xs \${isFull ? 'text-yellow-100/80' : plan.recommended ? 'text-blue-300/70' : 'text-slate-400'}\`}>/ mes</span>
                  </div>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-grow">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className={\`flex gap-3 text-sm items-start \${isFull ? 'text-yellow-50' : plan.recommended ? 'text-blue-100' : 'text-slate-300'}\`}>
                    <CheckCircle2 className={\`w-4 h-4 shrink-0 mt-0.5 \${isFull ? 'text-yellow-950' : plan.recommended ? 'text-blue-400' : 'text-emerald-500'}\`} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button 
                onClick={() => onPlanSelect(plan.name, isAnnual ? \`Gs. \${plan.annualDiscountedPrice} / año\` : \`Gs. \${plan.monthlyPrice} / mes\`)}
                className={\`w-full font-bold py-3.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 \${isFull ? 'bg-yellow-900 hover:bg-yellow-950 text-white shadow-md' : isEmpresa ? 'bg-slate-800 hover:bg-slate-700 text-white' : plan.recommended ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-700 hover:bg-slate-600 text-white'}\`}
              >
                Seleccionar Plan
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          );})}`;

code = code.replace(targetLoop, replacementLoop);
fs.writeFileSync('components/PlanesTab.tsx', code);
