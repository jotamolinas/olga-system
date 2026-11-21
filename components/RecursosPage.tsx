import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  RECURSO_CATEGORIES,
  RECURSOS_ARTICLES,
  RecursoArticle,
  RecursoCategory,
  getRecursoBySlug,
} from '../data/recursosData';
import { SocialShareBar } from './SocialShareBar';

const DEFAULT_TITLE =
  'OLGA Legal Tech (O.L.G.A.) | Software para Escribanías y Pagarés en Paraguay';
const DEFAULT_DESCRIPTION =
  'OLGA Legal Tech (O.L.G.A.): software para escribanías y empresas en Paraguay. Emite pagarés, imprime fojas CSJ y calcula aranceles Ley 879/81.';
const BASE_URL = 'https://olgatech.com.py';

const setMetaTag = (attrName: 'name' | 'property', attrValue: string, content: string) => {
  const el = document.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (el) {
    el.setAttribute('content', content);
  }
};

const getCategoryBadgeStyle = (category: RecursoCategory): string => {
  switch (category) {
    case 'Escribanías':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'Playas de Vehículos':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'Inmobiliarias y Bienes Raíces':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Abogados':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'Contadores y DNIT':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'Empresas y Sociedades':
      return 'bg-slate-100 text-slate-800 border-slate-300';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

const RecursosNavbar: React.FC = () => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 inset-x-0 bg-white/95 backdrop-blur-md border-b border-slate-200/80 z-50 shadow-xs">
      <nav className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-4 group">
          <div className="flex flex-col items-center justify-center gap-1">
            <svg
              width="44"
              height="25"
              viewBox="0 0 115 65"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="shrink-0 group-hover:scale-105 transition-transform"
            >
              <path
                d="M2 55H21V28H35V55H49V2H63V55H77V13H91V55H113"
                stroke="#FF3131"
                strokeWidth="8"
                strokeLinejoin="miter"
                strokeLinecap="butt"
              />
            </svg>
            <span
              className="font-bold tracking-widest leading-none whitespace-nowrap text-base text-slate-900"
              style={{ fontFamily: '"Courier Prime", monospace' }}
            >
              O.L.G.A
            </span>
          </div>
          <div className="h-9 w-px bg-slate-200 hidden sm:block" />
          <span
            className="font-semibold tracking-[0.06em] leading-tight text-[11px] uppercase hidden sm:block text-slate-500"
            style={{ fontFamily: '"Courier Prime", monospace' }}
          >
            OLGA Legal Tech
            <br />
            Centro de Recursos
          </span>
        </Link>

        <div className="flex items-center gap-4 text-sm font-semibold">
          <Link to="/" className="text-slate-600 hover:text-slate-900 transition-colors hidden md:inline-block">
            Inicio
          </Link>
          <Link to="/recursos" className="text-blue-600 hover:text-blue-700 transition-colors hidden sm:inline-block">
            Guías Legales
          </Link>
          <button
            type="button"
            onClick={() => navigate('/consola')}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center gap-2 cursor-pointer"
          >
            <span>Acceso a Consola</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </nav>
    </header>
  );
};

const RecursosFooter: React.FC = () => (
  <footer className="bg-slate-950 text-white py-12 px-6 mt-auto border-t border-slate-900">
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-slate-400">
      <div>
        <p className="font-semibold text-white">OLGA Legal Tech (O.L.G.A.) — Paraguay</p>
        <p className="text-slate-500 mt-1">
          Guías prácticas para escribanías, playas de vehículos, inmobiliarias, estudios jurídicos, contadores y empresas.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-6 font-semibold">
        <Link to="/" className="hover:text-white transition-colors">
          Portada
        </Link>
        <Link to="/recursos" className="hover:text-white transition-colors">
          Todas las Guías
        </Link>
        <Link to="/privacidad" className="hover:text-white transition-colors">
          Privacidad
        </Link>
        <Link to="/terminos" className="hover:text-white transition-colors">
          Términos
        </Link>
      </div>
    </div>
  </footer>
);

export const RecursosPage: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();

  const [selectedCategory, setSelectedCategory] = useState<'Todas' | RecursoCategory>('Todas');
  const [searchQuery, setSearchQuery] = useState('');

  const article: RecursoArticle | undefined = useMemo(
    () => (slug ? getRecursoBySlug(slug) : undefined),
    [slug]
  );

  // Mantener tema claro institucional coherente con LandingPage
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('force-light');
    document.body.classList.remove('dark');
    document.body.classList.add('force-light');
    document.body.style.backgroundColor = '#ffffff';
    document.body.style.color = '#1e293b';

    return () => {
      document.documentElement.classList.remove('force-light');
      document.body.classList.remove('force-light');
      document.body.style.backgroundColor = '';
      document.body.style.color = '';
    };
  }, []);

  // SEO dinámico por ruta (/recursos y /recursos/:slug)
  useEffect(() => {
    window.scrollTo(0, 0);

    const pageUrl = article ? `${BASE_URL}/recursos/${article.slug}` : `${BASE_URL}/recursos`;
    const pageTitle = article
      ? article.metaTitle
      : 'Guías Legales y Notariales en Paraguay | OLGA Legal Tech (O.L.G.A.)';
    const pageDesc = article
      ? article.metaDescription
      : 'Artículos y guías prácticas de OLGA Legal Tech para escribanos, playas de vehículos, inmobiliarias, abogados, contadores y empresas en Paraguay.';

    document.title = pageTitle;
    setMetaTag('name', 'description', pageDesc);
    setMetaTag('property', 'og:title', pageTitle);
    setMetaTag('property', 'og:description', pageDesc);
    setMetaTag('property', 'og:url', pageUrl);
    setMetaTag('name', 'twitter:title', pageTitle);
    setMetaTag('name', 'twitter:description', pageDesc);
    setMetaTag('name', 'twitter:url', pageUrl);

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      canonical.setAttribute('href', pageUrl);
    }

    const existingLd = document.getElementById('dynamic-recurso-jsonld');
    if (existingLd) {
      existingLd.remove();
    }

    const ldScript = document.createElement('script');
    ldScript.id = 'dynamic-recurso-jsonld';
    ldScript.type = 'application/ld+json';

    const structuredData = article
      ? {
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'Article',
              headline: article.title,
              description: article.metaDescription,
              datePublished: article.publishedAt,
              dateModified: article.publishedAt,
              inLanguage: 'es-PY',
              mainEntityOfPage: pageUrl,
              keywords: article.keywords.join(', '),
              author: {
                '@type': 'Organization',
                name: 'OLGA Legal Tech',
                url: BASE_URL,
              },
              publisher: {
                '@type': 'Organization',
                name: 'OLGA Legal Tech',
                url: BASE_URL,
                logo: {
                  '@type': 'ImageObject',
                  url: `${BASE_URL}/logo-olga.png`,
                },
              },
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${BASE_URL}/` },
                { '@type': 'ListItem', position: 2, name: 'Recursos', item: `${BASE_URL}/recursos` },
                { '@type': 'ListItem', position: 3, name: article.title, item: pageUrl },
              ],
            },
          ],
        }
      : {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: pageTitle,
          description: pageDesc,
          url: pageUrl,
          inLanguage: 'es-PY',
          publisher: {
            '@type': 'Organization',
            name: 'OLGA Legal Tech',
            url: BASE_URL,
          },
        };

    ldScript.text = JSON.stringify(structuredData);
    document.head.appendChild(ldScript);

    return () => {
      document.title = DEFAULT_TITLE;
      setMetaTag('name', 'description', DEFAULT_DESCRIPTION);
      setMetaTag('property', 'og:title', DEFAULT_TITLE);
      setMetaTag('property', 'og:description', DEFAULT_DESCRIPTION);
      setMetaTag('property', 'og:url', `${BASE_URL}/`);
      setMetaTag('name', 'twitter:title', DEFAULT_TITLE);
      setMetaTag('name', 'twitter:description', DEFAULT_DESCRIPTION);
      setMetaTag('name', 'twitter:url', `${BASE_URL}/`);
      if (canonical) {
        canonical.setAttribute('href', `${BASE_URL}/`);
      }
      const scriptToRemove = document.getElementById('dynamic-recurso-jsonld');
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [article]);

  const filteredArticles = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    return RECURSOS_ARTICLES.filter((item) => {
      const matchesCat = selectedCategory === 'Todas' || item.category === selectedCategory;
      if (!matchesCat) return false;
      if (!q) return true;
      const haystack = [
        item?.title || '',
        item?.excerpt || '',
        item?.category || '',
        ...(item?.audiences || []),
        ...(item?.keywords || []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [selectedCategory, searchQuery]);

  const relatedArticles = useMemo(() => {
    if (!article) return [];
    const sameCategory = RECURSOS_ARTICLES.filter(
      (a) => a.slug !== article.slug && a.category === article.category
    );
    const others = RECURSOS_ARTICLES.filter(
      (a) => a.slug !== article.slug && a.category !== article.category
    );
    return [...sameCategory, ...others].slice(0, 3);
  }, [article]);

  // VISTA DE ARTÍCULO INDIVIDUAL (/recursos/:slug)
  if (slug && article) {
    const articleUrl = `${BASE_URL}/recursos/${article.slug}`;

    return (
      <div className="min-h-screen bg-white text-slate-800 flex flex-col font-sans selection:bg-red-500/10 selection:text-red-600">
        <RecursosNavbar />

        <main className="flex-1 py-12 px-6">
          <article className="max-w-3xl mx-auto">
            {/* Breadcrumb */}
            <nav aria-label="Ruta de navegación" className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-6">
              <Link to="/" className="hover:text-slate-900 transition-colors">
                Inicio
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <Link to="/recursos" className="hover:text-slate-900 transition-colors">
                Recursos Legales
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-700 truncate max-w-[240px] sm:max-w-none">
                {article.category}
              </span>
            </nav>

            {/* Encabezado del Artículo */}
            <header className="space-y-4 mb-8">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded-md text-xs font-bold border ${getCategoryBadgeStyle(
                    article.category
                  )}`}
                >
                  {article.category}
                </span>
                {article.audiences.map((aud) => (
                  <span
                    key={aud}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200"
                  >
                    {aud}
                  </span>
                ))}
              </div>

              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight tracking-tight">
                {article.title}
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed">{article.excerpt}</p>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Actualizado: {article.publishedAt}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {article.readTime}
                </span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                  <BookOpen className="w-3.5 h-3.5 text-red-600" />
                  Por OLGA Legal Tech (O.L.G.A.)
                </span>
              </div>
            </header>

            {/* Botones de compartir arriba (LinkedIn, WhatsApp, Facebook, X, Copiar) */}
            <div className="mb-10">
              <SocialShareBar
                url={articleUrl}
                title={article.title}
                label="Comparte esta guía en LinkedIn o con tu equipo:"
              />
            </div>

            {/* Contenido Estructurado */}
            <div className="space-y-8">
              {article.sections.map((section, idx) => (
                <section key={idx} className="space-y-4">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">{section.heading}</h2>
                  {section.paragraphs.map((p, pIdx) => (
                    <p key={pIdx} className="text-slate-700 text-base leading-relaxed">
                      {p}
                    </p>
                  ))}
                  {section.bullets && section.bullets.length > 0 && (
                    <ul className="space-y-2.5 bg-slate-50 border border-slate-200 rounded-2xl p-5">
                      {section.bullets.map((bullet, bIdx) => (
                        <li key={bIdx} className="flex items-start gap-2.5 text-sm text-slate-700 leading-relaxed">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>

            {/* Bloque de Conversión hacia OLGA Legal Tech */}
            <div className="my-12 bg-slate-900 text-white rounded-3xl p-8 shadow-xl border border-slate-800">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/20 text-red-300 border border-red-500/30 rounded-md text-xs font-bold uppercase tracking-wider mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Automatiza con OLGA Legal Tech (O.L.G.A.)</span>
              </div>
              <h3 className="text-2xl font-black tracking-tight mb-3">{article.olgaSolution.title}</h3>
              <p className="text-slate-300 text-sm leading-relaxed mb-6">{article.olgaSolution.description}</p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/consola')}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>{article.olgaSolution.ctaLabel}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <Link
                  to="/#planes"
                  className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all border border-white/15"
                >
                  Ver Planes en Guaraníes
                </Link>
              </div>
            </div>

            {/* Botones de compartir abajo */}
            <div className="mb-12">
              <SocialShareBar
                url={articleUrl}
                title={article.title}
                label="¿Te sirvió esta guía? Publícala en LinkedIn o compártela:"
              />
            </div>

            {/* Artículos Relacionados */}
            <section className="border-t border-slate-200 pt-10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-slate-900">Otras Guías de OLGA Legal Tech</h2>
                <Link
                  to="/recursos"
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <span>Ver todas ({RECURSOS_ARTICLES.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                {relatedArticles.map((rel) => (
                  <Link
                    key={rel.slug}
                    to={`/recursos/${rel.slug}`}
                    className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-blue-300 rounded-2xl p-4 flex flex-col justify-between transition-all hover:shadow-md"
                  >
                    <div>
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border mb-2 ${getCategoryBadgeStyle(
                          rel.category
                        )}`}
                      >
                        {rel.category}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 leading-snug mb-2">{rel.title}</h3>
                    </div>
                    <span className="text-xs font-bold text-blue-600 inline-flex items-center gap-1 mt-2">
                      Leer guía <ArrowRight className="w-3 h-3" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </article>
        </main>

        <RecursosFooter />
      </div>
    );
  }

  // VISTA DE DIRECTORIO / NOTICIAS Y GUÍAS (/recursos o slug no encontrado)
  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col font-sans selection:bg-red-500/10 selection:text-red-600">
      <RecursosNavbar />

      <main className="flex-1 py-14 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a la portada de OLGA Legal Tech</span>
            </Link>
          </div>

          {/* Cabecera del Centro de Recursos */}
          <div className="max-w-3xl mb-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-xs font-bold uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5" />
              <span>Centro de Guías Legales y Notariales • Paraguay</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              Recursos y Guías Prácticas de OLGA Legal Tech
            </h1>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
              Artículos especializados para escribanos, playas de vehículos, inmobiliarias, abogados, contadores y
              empresas en Paraguay. Comparte cualquier guía directamente en LinkedIn o WhatsApp.
            </p>
          </div>

          {slug && !article && (
            <div className="mb-8 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
              No encontramos la guía solicitada, pero aquí tienes todo el directorio actualizado de guías legales de OLGA Legal Tech.
            </div>
          )}

          {/* Buscador + Filtros por Rubro */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 mb-10 space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por tema o rubro (ej: pagaré, Ley 879/81, playas de vehículos, inmobiliaria, RUC, S.R.L.)..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedCategory('Todas')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                  selectedCategory === 'Todas'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Todas ({RECURSOS_ARTICLES.length})
              </button>
              {RECURSO_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Grilla de Artículos */}
          {filteredArticles.length === 0 ? (
            <div className="text-center py-14 bg-slate-50 border border-slate-200 rounded-3xl">
              <p className="text-slate-600 text-sm mb-3">
                No se encontraron guías para &ldquo;{searchQuery}&rdquo;.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('Todas');
                }}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Ver todas las guías
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredArticles.map((item) => {
                const itemUrl = `${BASE_URL}/recursos/${item.slug}`;
                return (
                  <article
                    key={item.slug}
                    className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col justify-between shadow-xs hover:shadow-lg hover:border-slate-300 transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${getCategoryBadgeStyle(
                            item.category
                          )}`}
                        >
                          {item.category}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">{item.readTime}</span>
                      </div>

                      <h2 className="text-lg font-black text-slate-900 leading-snug mb-2.5">
                        <Link to={`/recursos/${item.slug}`} className="hover:text-blue-600 transition-colors">
                          {item.title}
                        </Link>
                      </h2>

                      <p className="text-sm text-slate-600 leading-relaxed mb-4">{item.excerpt}</p>

                      <div className="flex flex-wrap gap-1.5 mb-5">
                        {item.audiences.map((aud) => (
                          <span
                            key={aud}
                            className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold"
                          >
                            {aud}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                      <Link
                        to={`/recursos/${item.slug}`}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                      >
                        <span>Leer guía</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>

                      <SocialShareBar url={itemUrl} title={item.title} compact={true} />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <RecursosFooter />
    </div>
  );
};
