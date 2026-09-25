/**
 * Gestione del logo aziendale su Supabase Storage.
 * - Bucket: "azienda"
 * - Path: "logo.png"
 * - Fallback: /logo.png (pubblico)
 *
 * La funzione `uploadLogo` rimuove automaticamente lo sfondo bianco
 * dal PNG prima di caricarlo su Supabase.
 */
import { supabase } from './supabase';

const BUCKET = 'azienda';
const LOGO_DEFAULT = '/logo.png';
const RIGHETTI_EMAIL = 'righetti@righetti.club';

// Path del logo corrente (cache).
// - Righetti: 'logo.png' (fisso)
// - Altri utenti loggati: '{user_id}/logo.png'
// - Non loggato: 'logo.png' (fallback)
let _logoPathCache: string = 'logo.png';

/**
 * Ritorna il path corretto per l'utente corrente.
 * Deve essere chiamato al login/logout per aggiornare la cache.
 */
function calcolaLogoPath(user: { id: string; email?: string | null } | null): string {
  if (!user) return 'logo.png';
  if (user.email?.toLowerCase().trim() === RIGHETTI_EMAIL) return 'logo.png';
  return `${user.id}/logo.png`;
}

/**
 * Inizializza il path del logo per l'utente loggato.
 * Chiamalo dopo il login (SIGNED_IN) o all'avvio con sessione attiva.
 */
export async function initLogoPath(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    _logoPathCache = calcolaLogoPath(user);
  } catch {
    _logoPathCache = 'logo.png';
  }
}

/**
 * Reset del path (al logout).
 */
export function resetLogoPath(): void {
  _logoPathCache = 'logo.png';
}

/**
 * Ritorna il path corrente del logo (per debug/test).
 */
export function getCurrentLogoPath(): string {
  return _logoPathCache;
}

/**
 * Restituisce l'URL pubblico del logo aziendale.
 */
export function getLogoUrl(cacheBuster = false): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(_logoPathCache);
  if (!data?.publicUrl) return LOGO_DEFAULT;
  const baseUrl = data.publicUrl;
  void cacheBuster;
  return `${baseUrl}?v=${Date.now()}`;
}

/**
 * Verifica se esiste un logo custom caricato.
 */
export async function esisteLogoCustom(): Promise<boolean> {
  try {
    // Estrai cartella e nome file dal path corrente
    const parts = _logoPathCache.split('/');
    const fileName = parts.pop() || 'logo.png';
    const folder = parts.join('/');

    const { data, error } = await supabase.storage.from(BUCKET).list(folder, {
      search: fileName,
    });
    if (error) return false;
    return (data || []).some((f) => f.name === fileName);
  } catch {
    return false;
  }
}

/**
 * Rimuove lo sfondo bianco da un PNG usando canvas.
 * I pixel con R>240, G>240, B>240 diventano trasparenti.
 */
async function rimuoviSfondoBianco(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(file); // fallback: restituisci il file originale
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Converti i pixel bianchi in trasparenti
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // Se è un pixel visibile (alpha > 0) e quasi bianco
          if (a > 0 && r > 240 && g > 240 && b > 240) {
            data[i + 3] = 0; // alpha = 0 (trasparente)
          }
        }

        ctx.putImageData(imageData, 0, 0);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) {
              resolve(file); // fallback
              return;
            }
            const nuovoFile = new File([blob], 'logo.png', { type: 'image/png' });
            resolve(nuovoFile);
          },
          'image/png',
          1.0
        );
      } catch (err) {
        URL.revokeObjectURL(url);
        resolve(file); // fallback: usa l'originale
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Impossibile leggere l\'immagine.'));
    };

    img.src = url;
  });
}

/**
 * Carica un nuovo logo (sovrascrive quello esistente).
 * Rimuove automaticamente lo sfondo bianco.
 */
export async function uploadLogo(file: File): Promise<{ url: string | null; error: string | null }> {
  // Validazione: solo PNG
  if (file.type !== 'image/png') {
    return { url: null, error: 'Il logo deve essere un file PNG.' };
  }
  // Validazione: max 5 MB
  if (file.size > 5 * 1024 * 1024) {
    return { url: null, error: 'Il file supera i 5 MB.' };
  }

  try {
    // 1. Processa il PNG: rimuovi sfondo bianco
    const fileProcessato = await rimuoviSfondoBianco(file);

    // 2. Carica su Supabase (nel path corretto per l'utente)
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(_logoPathCache, fileProcessato, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/png',
      });

    if (error) throw error;

    return { url: getLogoUrl(true), error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Errore durante il caricamento.';
    return { url: null, error: msg };
  }
}

/**
 * Rimuove il logo custom (torna al default /logo.png).
 */
export async function rimuoviLogo(): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([_logoPathCache]);
    if (error) throw error;
    return { error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Errore durante la rimozione.';
    return { error: msg };
  }
}

/**
 * Restituisce il logo come base64 (per i PDF).
 * Prova prima il logo custom su Supabase, poi fallback su /logo.png.
 */
export async function caricaLogoBase64(): Promise<string | null> {
  // Prova prima il logo custom
  try {
    const customUrl = getLogoUrl();
    const res = await fetch(customUrl);
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0) {
        return await blobToBase64(blob);
      }
    }
  } catch {
    // ignora, prova il default
  }

  // Fallback: /logo.png pubblico
  try {
    const res = await fetch(LOGO_DEFAULT);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await blobToBase64(blob);
  } catch {
    return null;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Errore lettura blob'));
    reader.readAsDataURL(blob);
  });
}
