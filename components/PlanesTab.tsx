import React, { useState } from 'react';
import { Target, CheckCircle2, Users, Bot, ArrowRight } from 'lucide-react';

interface PlanesTabProps {
  onPlanSelect: (planName: string, planPrice: string) => void;
  activePlan?: string;
}

export const PlanesTab: React.FC<PlanesTabProps> = ({ onPlanSelect, activePlan }) => {
  const [isAnnual, setIsAnnual] = useState(false);

  const plans = [
    {
      id: 'Básico',
      name: 'Plan Básico',
      users: 2,
      aiLimits: 20,
      monthlyPrice: '250.000',
      annualBasePrice: '3.000.000',
      annualDiscountedPrice: '2.500.000',
      features: ['Asistente O.L.G.A. Básico', 'Generación de Pagarés', 'Exportación de PDF (Marca de Agua)', 'Soporte Estándar'],
      recommended: false,
    },
    {
      id: 'Pro',
      name: 'Plan Pro',
      users: 5,
      aiLimits: 50,
      monthlyPrice: '575.000',
      annualBasePrice: '6.900.000',
      annualDiscountedPrice: '5.750.000',
      features: ['Todo lo del Básico', 'Gestión de Escritos Libre', 'Plantillas Legales Simples', 'Exportación Limpia (Sin Marca)'],
      recommended: true,
    },
    {
      id: 'Empresa',
      name: 'Plan Empresa',
      users: 10,
      aiLimits: 100,
      monthlyPrice: '1.000.000',
      annualBasePrice: '12.000.000',
      annualDiscountedPrice: '10.000.000',
      features: ['Todo lo del Pro', 'Estatutos y Contratos Corporativos', 'Historial de Auditoría (Logs)', 'Soporte Prioritario'],
      recommended: false,
    },
    {
      id: 'Full',
      name: 'Plan Full',
      users: 15,
      aiLimits: 300,
      monthlyPrice: '1.350.000',
      annualBasePrice: '16.200.000',
      annualDiscountedPrice: '13.500.000',
      features: ['Todo lo de Empresa', 'El Oráculo Legal', 'Módulo Perfil SEPRELAD', 'Procesamiento Masivo y Traducción'],
      recommended: false,
    }
  ];

  return (
    <div className="w-full box-border flex flex-col gap-8 md:gap-12 animate-fade-in pb-12">
      <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden mt-4">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/20 blur-[100px] rounded-full pointer-events-none"></div>
        
        <div className="text-center mb-10 relative z-10 flex flex-col items-center">
          <h2 className="text-2xl md:text-3xl font-black text-white font-serif mb-4">
            Planes de Suscripción O.L.G.A.
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto mb-8">
            Elige el plan ideal para tu estudio o empresa y lleva la gestión notarial al siguiente nivel.
          </p>

          {/* Toggle Mensual/Anual */}
          <div className="bg-slate-800 p-1.5 rounded-full inline-flex items-center gap-2 mb-4 border border-slate-700">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all ${!isAnnual ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Mensual
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${isAnnual ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Anual <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${isAnnual ? 'bg-white/20 text-white' : 'bg-blue-500/20 text-blue-400'}`}>Descuento</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10 mx-auto">
          {plans.map(plan => {
            const isFull = plan.id === 'Full';
            const isEmpresa = plan.id === 'Empresa';
            return (
            <div 
              key={plan.id}
              className={`rounded-3xl p-6 flex flex-col relative transition-all duration-300 hover:-translate-y-2 ${isFull ? 'bg-gradient-to-br from-yellow-600 via-yellow-500 to-yellow-700 border-2 border-yellow-400 shadow-lg shadow-yellow-600/30 text-white' : isEmpresa ? 'bg-slate-950 border-2 border-slate-800 text-white shadow-lg shadow-slate-950/40' : plan.recommended ? 'bg-gradient-to-b from-blue-900 to-slate-800 border-2 border-blue-500/50 transform md:-translate-y-6 shadow-xl shadow-blue-900/40' : 'bg-slate-800/80 backdrop-blur-sm border border-slate-700'}`}
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
              
              <h3 className={`text-xl font-bold mb-2 ${isFull || isEmpresa ? 'text-white' : plan.recommended ? 'text-blue-100' : 'text-white'}`}>{plan.name}</h3>
              
              <div className="flex flex-col gap-2 mb-6 text-sm">
                <div className={`flex items-center gap-2 p-2 rounded-lg border ${isFull ? 'text-yellow-50 bg-yellow-800/40 border-yellow-600/50' : isEmpresa ? 'text-slate-300 bg-slate-900 border-slate-800' : 'text-slate-300 bg-slate-800/50 border-slate-700/50'}`}>
                  <Users className={`w-4 h-4 ${isFull ? 'text-yellow-200' : 'text-slate-400'}`} />
                  <span><strong>{plan.users}</strong> Usuarios</span>
                </div>
                <div className={`flex items-center gap-2 p-2 rounded-lg border ${isFull ? 'text-yellow-50 bg-yellow-800/40 border-yellow-600/50' : isEmpresa ? 'text-slate-300 bg-slate-900 border-slate-800' : 'text-slate-300 bg-slate-800/50 border-slate-700/50'}`}>
                  <Bot className={`w-4 h-4 ${isFull ? 'text-yellow-200' : 'text-emerald-400'}`} />
                  <span><strong>{plan.aiLimits}</strong> Consultas IA/mes</span>
                </div>
              </div>
              
              <div className="mb-8 flex-grow">
                {isAnnual ? (
                  <div className="flex flex-col">
                    <span className={`line-through text-sm font-mono ${isFull ? 'text-yellow-200/80' : 'text-slate-500'}`}>Gs. {plan.annualBasePrice}</span>
                    <div className="text-3xl font-black text-white font-mono">
                      Gs. {plan.annualDiscountedPrice}
                    </div>
                    <span className={`text-xs ${isFull ? 'text-yellow-100/80' : plan.recommended ? 'text-blue-300/70' : 'text-slate-400'}`}>/ año</span>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <span className="text-transparent line-through text-sm font-mono select-none">_</span>
                    <div className="text-3xl font-black text-white font-mono">
                      Gs. {plan.monthlyPrice}
                    </div>
                    <span className={`text-xs ${isFull ? 'text-yellow-100/80' : plan.recommended ? 'text-blue-300/70' : 'text-slate-400'}`}>/ mes</span>
                  </div>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-grow">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className={`flex gap-3 text-sm items-start ${isFull ? 'text-yellow-50' : plan.recommended ? 'text-blue-100' : 'text-slate-300'}`}>
                    <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${isFull ? 'text-yellow-950' : plan.recommended ? 'text-blue-400' : 'text-emerald-500'}`} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button 
                onClick={() => onPlanSelect(plan.name, isAnnual ? `Gs. ${plan.annualDiscountedPrice} / año` : `Gs. ${plan.monthlyPrice} / mes`)}
                className={`w-full font-bold py-3.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${isFull ? 'bg-yellow-900 hover:bg-yellow-950 text-white shadow-md' : isEmpresa ? 'bg-slate-800 hover:bg-slate-700 text-white' : plan.recommended ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30' : 'bg-slate-700 hover:bg-slate-600 text-white'}`}
              >
                Seleccionar Plan
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          );})}
        </div>
      </div>
    </div>
  );
};
