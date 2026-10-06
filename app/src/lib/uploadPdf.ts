import { supabase } from './supabase';

/**
 * Salva un PDF su Supabase Storage, con path strutturato.
 * Ritorna il path pubblico (o null se errore).
 *
 * @param bucket        'fatture-pdf' | 'scontrini-pdf' | 'scarichi-pdf'
 * @param client_id     ID del cliente (per la cartella)
 * @param nomeFile      Nome file (senza path)
 * @param blob          Blob del PDF
 * @param anno          Anno (per la cartella, opzionale)
 */
export async function uploadPdfToStorage(
  bucket: string,
  client_id: number,
  nomeFile: string,
  blob: Blob,
  anno?: number,
): Promise<string | null> {
  try {
    const annoDir = anno ?? new Date().getFullYear();
    // Sanitizza nome file (rimuovi spazi, caratteri strani)
    const nomePulito = nomeFile.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${client_id}/${annoDir}/${nomePulito}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, blob, {
        contentType: 'application/pdf',
        upsert: true, // sovrascrive se esiste
      });

    if (error) {
      console.error(`❌ Upload PDF ${bucket}/${path}:`, error.message);
      return null;
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
    return urlData?.publicUrl ?? null;
  } catch (e: any) {
    console.error('❌ uploadPdfToStorage error:', e.message);
    return null;
  }
}

/**
 * Helper: genera blob da jsPDF e carica.
 * jspdf ha doc.output('blob')
 */
export async function uploadJsPdfToStorage(
  bucket: string,
  client_id: number,
  nomeFile: string,
  doc: any, // jsPDF instance
  anno?: number,
): Promise<string | null> {
  try {
    const blob = doc.output('blob');
    return await uploadPdfToStorage(bucket, client_id, nomeFile, blob, anno);
  } catch (e: any) {
    console.error('❌ uploadJsPdfToStorage error:', e.message);
    return null;
  }
}
