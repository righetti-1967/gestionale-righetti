/**
 * Fatturazione Elettronica — FPT / ADE Diretto (SDI)
 *
 * Modalità:
 * - 'simulazione' → nessun invio reale, log su integrazioni_log con esito='simulato'
 * - 'reale'       → tenta l'invio, log su integrazioni_log con esito='pending_driver'
 *
 * NOTA ARCHITETTURALE:
 * L'invio reale richiede un backend che firmi e trasmetta l'XML allo SDI.
 * FPT → API REST (backend FastAPI Railway)
 * ADE Diretto → generazione XML + PEC o portale ADE
 *
 * Per ora l'invio reale scrive solo il log con esito='pending_driver'.
 * Il flag `fatture.inviato_sdi` NON viene settato finché il driver reale
 * non sarà effettivamente collegato (evita falsi positivi).
 */
import { supabase } from './supabase';
import type { FatturaConCliente } from './fatture';
import type { ConfigFPT, ConfigAdeDiretto, ProviderFiscale } from './configFiscale';

// ============================================================
// TIPI
// ============================================================

export interface EsitoInvioFattura {
  ok: boolean;
  simulato: boolean;
  messaggio: string;
  logId?: number;
}

interface InviaFatturaParams {
  fattura: FatturaConCliente;
  provider: ProviderFiscale;   // 'fpt' | 'ade_diretto'
  config: ConfigFPT | ConfigAdeDiretto;
}

// ============================================================
// INVIO FATTURA AL PROVIDER (FPT / ADE)
// ============================================================

export async function inviaFatturaAlProvider(
  params: InviaFatturaParams
): Promise<EsitoInvioFattura> {
  const { fattura, provider, config } = params;
  const t0 = Date.now();

  if (provider !== 'fpt' && provider !== 'ade_diretto') {
    return {
      ok: false,
      simulato: false,
      messaggio: '❌ Provider non valido per fatturazione elettronica',
    };
  }

  const modalita: 'simulazione' | 'reale' =
    (config as any).modalita === 'reale' ? 'reale' : 'simulazione';

  const tipo = provider === 'fpt' ? 'fattura_fpt' : 'fattura_ade';

  const payload = {
    fattura_id: fattura.id,
    numero_fattura: fattura.numero_fattura,
    anno: fattura.anno,
    cliente_id: fattura.cliente_id,
    cliente_nome: fattura.cliente?.nome_cognome || null,
    netto_imponibile: fattura.netto_imponibile,
    iva_importo: fattura.iva_importo,
    lordo_ivato: fattura.lordo_ivato,
    data_inizio: fattura.data_inizio,
    data_fine: fattura.data_fine,
    righe_count: (fattura.righe || []).length,
    provider,
    // metadata provider (no segreti)
    ambiente: (config as ConfigFPT).ambiente || null,
    codice_sdi: (config as ConfigAdeDiretto).codice_sdi || null,
    pec_presente: !!(config as ConfigAdeDiretto).pec,
    regime_fiscale: (config as ConfigAdeDiretto).regime_fiscale || null,
  };

  // --- SIMULAZIONE ---
  if (modalita === 'simulazione') {
    const logId = await scriviLog({
      tipo,
      provider,
      modalita,
      riferimento_id: String(fattura.id),
      payload,
      esito: 'simulato',
      durata_ms: Date.now() - t0,
    });
    return {
      ok: true,
      simulato: true,
      messaggio: `🧪 Simulazione: fattura ${fattura.numero_fattura} non inviata realmente a ${provider === 'fpt' ? 'FPT' : 'SDI'}`,
      logId,
    };
  }

  // --- REALE (stub) ---
  const logId = await scriviLog({
    tipo,
    provider,
    modalita,
    riferimento_id: String(fattura.id),
    payload,
    esito: 'pending_driver',
    errore: `Driver ${provider === 'fpt' ? 'FPT' : 'SDI'} non ancora collegato`,
    durata_ms: Date.now() - t0,
  });

  return {
    ok: false,
    simulato: false,
    messaggio: `🟢 Modalità reale attiva, ma il driver ${provider === 'fpt' ? 'FPT' : 'SDI'} non è ancora collegato. Evento registrato nei log.`,
    logId,
  };
}

// ============================================================
// LOG SU integrazioni_log
// ============================================================

async function scriviLog(riga: {
  tipo: string;
  provider: string | null;
  modalita: string;
  riferimento_id: string | null;
  payload: Record<string, any>;
  esito: string;
  errore?: string;
  durata_ms?: number;
}): Promise<number | undefined> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('integrazioni_log')
      .insert({
        user_id: user?.id ?? null,
        user_email: user?.email ?? null,
        tipo: riga.tipo,
        provider: riga.provider,
        modalita: riga.modalita,
        riferimento_id: riga.riferimento_id,
        payload: riga.payload,
        esito: riga.esito,
        errore: riga.errore ?? null,
        durata_ms: riga.durata_ms ?? null,
      })
      .select('id')
      .single();

    if (error) {
      console.warn('Errore scrittura integrazioni_log (fatturazione):', error);
      return undefined;
    }
    return data?.id;
  } catch (err) {
    console.warn('Errore inatteso scrittura integrazioni_log (fatturazione):', err);
    return undefined;
  }
}
