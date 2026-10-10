/**
 * DynamicFavicon — aggiorna la favicon del tab browser in base al logo dello studio.
 *
 * Comportamento:
 * - Utente Righetti con logo caricato → sua favicon
 * - Altri utenti con logo → loro favicon
 * - Utenti senza logo → /favicon.svg neutro ("GS" blu)
 */
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getLogoUrl, initLogoPath } from '../lib/logo';

const NEUTRAL_ICON = '/favicon.svg';

function applyFavicon(url: string) {
  // Aggiungi cache-buster
  const urlWithCache = url.includes('?')
    ? `${url}&v=${Date.now()}`
    : `${url}?v=${Date.now()}`;

  const setLink = (rel: string, href: string) => {
    const existing = document.querySelectorAll(`link[rel='${rel}']`);
    if (existing.length === 0) {
      const link = document.createElement('link');
      link.rel = rel;
      link.href = href;
      document.head.appendChild(link);
      return;
    }
    existing.forEach((el, i) => {
      const link = el as HTMLLinkElement;
      if (i === 0) {
        link.href = href;
        if (rel === 'icon') link.type = 'image/png';
      } else {
        link.remove();
      }
    });
  };

  setLink('icon', urlWithCache);
  setLink('apple-touch-icon', urlWithCache);
}

export default function DynamicFavicon() {
  useEffect(() => {
    async function update() {
      try {
        // 1. Init path logo (Righetti vs altri)
        await initLogoPath();

        // 2. Ottieni user email per getLogoUrl
        const { data: { user } } = await supabase.auth.getUser();

        // 3. Leggi URL logo (dinamico o neutro)
        const logo = getLogoUrl(true, user?.email);

        // 4. Applica
        applyFavicon(logo || NEUTRAL_ICON);
      } catch (e) {
        console.warn('DynamicFavicon fallback:', e);
        applyFavicon(NEUTRAL_ICON);
      }
    }

    update();

    // Ascolta cambi logo aziendali (es. upload nuovo logo)
    const handler = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const logo = getLogoUrl(true, user?.email);
        applyFavicon(logo || NEUTRAL_ICON);
      } catch {
        applyFavicon(NEUTRAL_ICON);
      }
    };
    window.addEventListener('datiAziendali-aggiornati', handler);

    return () => {
      window.removeEventListener('datiAziendali-aggiornati', handler);
    };
  }, []);

  return null;
}
