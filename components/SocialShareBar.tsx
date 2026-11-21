import React, { useState } from 'react';
import { Share2, Link2, Check, MessageCircle } from 'lucide-react';

interface SocialShareBarProps {
  url: string;
  title: string;
  compact?: boolean;
  label?: string;
}

export const SocialShareBar: React.FC<SocialShareBarProps> = ({
  url,
  title,
  compact = false,
  label = 'Compartir guía en redes:',
}) => {
  const [copied, setCopied] = useState(false);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const whatsappText = encodeURIComponent(`${title} — OLGA Legal Tech (O.L.G.A.): ${url}`);

  const linkedinHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  const twitterHref = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`;
  const whatsappHref = `https://wa.me/?text=${whatsappText}`;

  const handleCopyLink = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      setCopied(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <a
          href={linkedinHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Compartir "${title}" en LinkedIn`}
          title="Compartir en LinkedIn"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0A66C2]/10 hover:bg-[#0A66C2] text-[#0A66C2] hover:text-white text-[11px] font-bold transition-colors border border-[#0A66C2]/20"
        >
          <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
          </svg>
          <span>LinkedIn</span>
        </a>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Compartir "${title}" por WhatsApp`}
          title="Compartir por WhatsApp"
          className="inline-flex items-center justify-center p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white transition-colors border border-emerald-200"
        >
          <MessageCircle className="w-3.5 h-3.5" />
        </a>
        <button
          type="button"
          onClick={() => handleCopyLink()}
          aria-label={`Copiar enlace de "${title}"`}
          title="Copiar enlace"
          className="inline-flex items-center justify-center p-1.5 rounded-lg bg-slate-100 hover:bg-slate-900 text-slate-700 hover:text-white transition-colors border border-slate-200 cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Link2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
        <Share2 className="w-4 h-4 text-slate-500 shrink-0" />
        <span>{label}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={linkedinHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A66C2] hover:bg-[#004182] text-white text-xs font-bold transition-colors shadow-2xs"
        >
          <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
          </svg>
          <span>LinkedIn</span>
        </a>

        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-2xs"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          <span>WhatsApp</span>
        </a>

        <a
          href={facebookHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1877F2] hover:bg-[#0d65d9] text-white text-xs font-bold transition-colors shadow-2xs"
        >
          <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2a10 10 0 1 0 0 20v-7h-2.5v-3H12V9.5a3.5 3.5 0 0 1 3.5-3.5h2.5v3H16c-.55 0-1 .45-1 1v2h3.5l-.5 3H15v7a10 10 0 0 0-3-18z" />
          </svg>
          <span>Facebook</span>
        </a>

        <a
          href={twitterHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors shadow-2xs"
        >
          <span>X / Post</span>
        </a>

        <button
          type="button"
          onClick={() => handleCopyLink()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700">¡Enlace copiado!</span>
            </>
          ) : (
            <>
              <Link2 className="w-3.5 h-3.5 text-slate-600" />
              <span>Copiar enlace</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
