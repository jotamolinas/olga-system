import React from 'react';
import { Star, ExternalLink, Quote, ShieldCheck } from 'lucide-react';

export const Testimonials: React.FC = () => {
  const reviews = [
    {
      name: 'Escribanía Pérez & Asoc.',
      location: 'Asunción, Paraguay',
      text: 'La calibración milimétrica en las fojas de seguridad de la CSJ nos ha ahorrado horas de trabajo y cero desperdicio de papel oficial. Indispensable para nuestra escribanía.',
      rating: 5,
      role: 'Titular de Escribanía'
    },
    {
      name: 'Estudio Jurídico González & Cía.',
      location: 'Ciudad del Este, Paraguay',
      text: 'La emisión de pagarés a la orden con rigor ejecutivo y el cálculo de presupuestos bajo la Ley 879/81 superaron todas nuestras expectativas. 100% recomendado.',
      rating: 5,
      role: 'Abogado Socio Director'
    },
    {
      name: 'Inmobiliaria del Este S.A.',
      location: 'Encarnación, Paraguay',
      text: 'Gestionamos contratos y financiación de cuotas de lotes con una seguridad jurídica impecable. El fichero de personas con validación de RUC es excelente.',
      rating: 5,
      role: 'Gerente Administrativo'
    }
  ];

  return (
    <section className="py-24 bg-slate-50/80 border-b border-slate-200 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-amber-50 text-amber-800 text-xs font-bold uppercase tracking-wider rounded-full border border-amber-200 shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            <span>Opiniones Verificadas en Google</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Confianza Comprobada en Escribanías y Empresas
          </h2>
          <p className="text-slate-600 text-base">
            Descubre por qué los profesionales del derecho y la administración en Paraguay eligen O.L.G.A. todos los días.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {reviews.map((item, index) => (
            <article 
              key={index}
              className="bg-white border border-slate-200/90 p-8 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative group"
            >
              <div className="absolute top-6 right-6 text-slate-200 group-hover:text-amber-100 transition-colors">
                <Quote className="w-10 h-10" />
              </div>

              <div className="space-y-4 relative z-10">
                {/* Stars */}
                <div className="flex items-center gap-1">
                  {[...Array(item.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-amber-500 fill-amber-400" />
                  ))}
                </div>

                {/* Review Text */}
                <p className="text-slate-700 text-sm leading-relaxed font-sans">
                  &ldquo;{item.text}&rdquo;
                </p>
              </div>

              {/* Author Footer */}
              <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between relative z-10">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{item.name}</h3>
                  <div className="text-xs text-slate-500">{item.role} • <span className="text-slate-400">{item.location}</span></div>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Google Reviews CTA Banner */}
        <div className="max-w-2xl mx-auto bg-white border border-slate-200 p-8 rounded-3xl shadow-sm text-center space-y-4">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-5 h-5 text-amber-500 fill-amber-400" />
            ))}
            <span className="font-bold text-slate-900 ml-2 text-sm">4.9 / 5.0 (24 Opiniones)</span>
          </div>

          <h3 className="text-xl font-black text-slate-900">
            ¿Ya utilizas O.L.G.A. en tu escribanía o negocio?
          </h3>
          <p className="text-slate-600 text-sm max-w-lg mx-auto">
            Tu opinión nos ayuda a seguir mejorando el estándar Legal-Tech en Paraguay. Déjanos tu valoración en Google.
          </p>

          <div className="pt-2">
            <a 
              href="https://g.page/r/CWl9WpnL0PfFECE/review"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md shadow-blue-600/20 transition-all active:scale-98 cursor-pointer"
            >
              <span>Califícanos en Google</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

      </div>
    </section>
  );
};
