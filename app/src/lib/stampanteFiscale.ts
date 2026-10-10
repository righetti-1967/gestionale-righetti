/**
 * Stampante Fiscale — RCH / Epson
 *
 * Modalità:
 * - 'simulazione' → nessun invio reale, log su integrazioni_log con esito='simulato'
 * - 'reale'       → tenta l'invio, log su integrazioni_log con esito='pending_driver'
 *
 * NOTA ARCHITETTURALE:
 * La stampante RT è in rete locale dello studio (es. 192.168.1.x:9100),
 * NON raggiungibile da Vercel/Supabase Edge/FastAPI Railway.
 * Quando attiveremo il driver reale, servirà un bridge locale
 * (es. piccolo agent su Mac dello studio) — per ora logghiamo e basta.
 */
import { supabase } from './supabase';
import type { Scontrino } from './scontrini';
import type { ConfigRCH, ConfigEpson, ProviderFiscale } from './configFiscale';

// ============================================================
// TIPI
// ============================================================

export interface EsitoInvio {
  ok: boolean;
  simulato: boolean;
  messaggio: string;
  logId?: number;
}

interface InviaAStampanteParams {
  scontrino: Scontrino;
  provider: ProviderFiscale;
  config: ConfigRCH | ConfigEpson;
}

// ============================================================
// INVIO A STAMPANTE
// ============================================================

export async function inviaAStampante(
  params: InviaAStampanteParams
): Promise<EsitoInvio> {
  const { scontrino, provider, config } = params;
  const t0 = Date.now();
  const modalita: 'simulazione' | 'reale' =
    config.modalita === 'reale' ? 'reale' : 'simulazione';

  const payload = {
    scontrino_id: scontrino.id,
    numero_scontrino: scontrino.numero_scontrino,
    totale_lordo: scontrino.totale_lordo,
    data_emissione: scontrino.data_emissione,
    ora_emissione: scontrino.ora_emissione,
    righe_count: (scontrino.righe || []).length,
    metodo_pagamento: scontrino.metodo_pagamento,
    provider,
    modello: config.modello || null,
    ip: config.ip || null,
    porta: config.porta || 9100,
  };

  // --- SIMULAZIONE ---
  if (modalita === 'simulazione') {
    const logId = await scriviLog({
      tipo: 'stampa_scontrino',
      provider,
      modalita,
      riferimento_id: String(scontrino.id),
      payload,
      esito: 'simulato',
      durata_ms: Date.now() - t0,
    });
    return {
      ok: true,
      simulato: true,
      messaggio: '🧪 Simulazione: nessun invio reale alla stampante',
      logId,
    };
  }

  // --- REALE ---
  if (!config.ip) {
    const logId = await scriviLog({
      tipo: 'stampa_scontrino',
      provider,
      modalita,
      riferimento_id: String(scontrino.id),
      payload,
      esito: 'errore',
      errore: 'IP stampante non configurato',
      durata_ms: Date.now() - t0,
    });
    return {
      ok: false,
      simulato: false,
      messaggio: '❌ IP stampante non configurato',
      logId,
    };
  }

  const logId = await scriviLog({
    tipo: 'stampa_scontrino',
    provider,
    modalita,
    riferimento_id: String(scontrino.id),
    payload,
    esito: 'pending_driver',
    errore: 'Driver RT reale non ancora collegato (bridge locale da attivare)',
    durata_ms: Date.now() - t0,
  });

  return {
    ok: false,
    simulato: false,
    messaggio:
      '🟢 Modalità reale attiva, ma il driver RT non è ancora collegato. Evento registrato nei log.',
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
      console.warn('Errore scrittura integrazioni_log:', error);
      return undefined;
    }
    return data?.id;
  } catch (err) {
    console.warn('Errore inatteso scrittura integrazioni_log:', err);
    return undefined;
  }
}
