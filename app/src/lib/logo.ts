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
const FILE_PATH = 'logo.png';
const LOGO_DEFAULT = '/logo.png';

/**
 * Restituisce l'URL pubblico del logo aziendale.
 */
export function getLogoUrl(cacheBuster = false): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(FILE_PATH);
  if (!data?.publicUrl) return LOGO_DEFAULT;
  const baseUrl = data.publicUrl;
  // SEMPRE cache-buster per evitare che il browser mostri la versione vecchia
  // (il parametro cacheBuster è mantenuto per compatibilità, ma ora è sempre attivo)
  void cacheBuster;
  return `${baseUrl}?v=${Date.now()}`;
}

/**
 * Verifica se esiste un logo custom caricato.
 */
export async function esisteLogoCustom(): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).list('', {
      search: FILE_PATH,
    });
    if (error) return false;
    return (data || []).some((f) => f.name === FILE_PATH);
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

    // 2. Carica su Supabase
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(FILE_PATH, fileProcessato, {
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
    const { error } = await supabase.storage.from(BUCKET).remove([FILE_PATH]);
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
