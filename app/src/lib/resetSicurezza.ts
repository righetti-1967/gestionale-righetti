/**
 * Reset Password Gestionale via email
 *
 * Flusso:
 * 1. Utente clicca "Password dimenticata?"
 * 2. Sistema genera codice a 6 cifre, lo salva in `impostazioni` (chiave: reset_sicurezza)
 * 3. Sistema invia codice all'email account
 * 4. Utente inserisce codice
 * 5. Se corretto + non scaduto → password gestionale azzerata
 * 6. Utente imposta nuova password
 */
import { supabase } from './supabase';
import { inviaEmailConConfig } from './api';
import { rimuoviPassword } from './sicurezza';
import { caricaDatiAziendali } from './datiAziendali';
import { getTestoTemplate, renderTemplate } from './testiTemplate';

const VALIDITA_MINUTI = 10;

// ============================================================
// GENERA CODICE
// ============================================================

function generaCodice(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ============================================================
// INVIA CODICE RESET
// ============================================================

export async function inviaCodiceReset(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) {
    throw new Error('Utente non autenticato o email mancante');
  }

  const codice = generaCodice();
  const expiresAt = new Date(Date.now() + VALIDITA_MINUTI * 60 * 1000).toISOString();

  // Salva il codice in `impostazioni`
  const { error } = await supabase
    .from('impostazioni')
    .upsert(
      {
        user_id: user.id,
        chiave: 'reset_sicurezza',
        valore: {
          codice,
          expires_at: expiresAt,
          usato: false,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,chiave' }
    );

  if (error) {
    console.error('❌ Errore salvataggio codice reset:', error);
    throw error;
  }

  // Invia email con codice
  const azienda = await caricaDatiAziendali();

  // Leggi template personalizzato
  const template = await getTestoTemplate('email_reset_password');
  const variabili = {
    email: user.email,
    codice,
    azienda: azienda.ragioneSociale || '',
  };
  const oggetto = renderTemplate(template.oggetto || 'Reset password', variabili);
  const corpoHtml = renderTemplate(template.corpo, variabili);

  await inviaEmailConConfig({
    destinatario: user.email,
    oggetto,
    corpo_html: corpoHtml,
  });
}

// ============================================================
// VERIFICA CODICE
// ============================================================

export async function verificaCodiceReset(codiceInserito: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('impostazioni')
    .select('valore')
    .eq('user_id', user.id)
    .eq('chiave', 'reset_sicurezza')
    .maybeSingle();

  if (error || !data?.valore) {
    throw new Error('Nessun codice di reset attivo. Richiedine uno nuovo.');
  }

  const valore = data.valore as {
    codice: string;
    expires_at: string;
    usato: boolean;
  };

  if (valore.usato) {
    throw new Error('Codice già utilizzato. Richiedine uno nuovo.');
  }

  if (new Date(valore.expires_at).getTime() < Date.now()) {
    throw new Error('Codice scaduto. Richiedine uno nuovo.');
  }

  if (valore.codice !== codiceInserito.trim()) {
    throw new Error('Codice non corretto');
  }

  // Marca codice come usato
  await supabase
    .from('impostazioni')
    .update({
      valore: { ...valore, usato: true },
    })
    .eq('user_id', user.id)
    .eq('chiave', 'reset_sicurezza');
}

// ============================================================
// RESET PASSWORD GESTIONALE
// ============================================================

export async function resetPasswordGestionale(codiceInserito: string): Promise<void> {
  // 1. Verifica codice
  await verificaCodiceReset(codiceInserito);

  // 2. Rimuovi password gestionale
  await rimuoviPassword();

  // 3. Pulisci codice usato
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from('impostazioni')
      .delete()
      .eq('user_id', user.id)
      .eq('chiave', 'reset_sicurezza');
  }
}
