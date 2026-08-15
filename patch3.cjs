const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

const target = `          if (plan.includes('empresa')) {
            return (
              <div className="mt-4 bg-yellow-900/30 rounded-2xl p-4 border border-yellow-500 text-center relative overflow-hidden shadow-lg shrink-0">
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-yellow-500/20 blur-xl rounded-full"></div>
                <Target className="w-6 h-6 text-yellow-400 mx-auto mb-2 relative z-10" />
                <h4 className="text-yellow-400 font-bold text-xs mb-1 relative z-10">Sube a Plan Full</h4>
                <p className="text-yellow-200/70 text-[9px] mb-3 leading-relaxed relative z-10">
                  Desbloquea todos los beneficios exclusivos
                </p>
                <button
                  onClick={() => {
                    setActiveTab('planes');
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full box-border bg-yellow-500 text-black text-[10px] font-bold py-2 rounded-xl transition-colors shadow-sm relative z-10 tracking-widest uppercase"
                >
                  Ver Planes
                </button>
              </div>
            );
          }`;

code = code.replace(target, `          if (plan.includes('empresa')) {
            return null;
          }`);

fs.writeFileSync('App.tsx', code);
