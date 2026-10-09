import { supabase } from './supabase';

/**
 * Elimina (soft-delete) una notifica push inviata a un cliente.
 * La notifica sparisce dalla lista admin ma resta nel DB (audit).
 */
export async function eliminaNotifica(id: string, motivo?: string): Promise<void> {
  const { error } = await supabase.rpc('admin_elimina_notifica', {
    notifica_id_input: id,
    motivo_input: motivo?.trim() || null,
  });
  if (error) throw new Error(error.message);
}
