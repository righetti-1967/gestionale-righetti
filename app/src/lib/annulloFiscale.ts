/**
 * Annullo fiscale documenti (fatture + scontrini)
 *
 * Concetto: quando un documento viene annullato in gestionale, DEVE essere
 * comunicato ai sistemi fiscali esterni:
 * - Fatture → NOTA DI CREDITO a ADE (SDI) o FPT
 * - Scontrini fisici → comando annullo a RT (RCH/Epson)
 * - Scontrini digitali → invio annullo corrispettivi (ADE o FPT)
 *
 * Modalità (config provider):
 * - 'simulazione' → solo log in integrazioni_log, esito='simulato'
 * - 'reale' → tenta invio, driver non ancora collegato → esito='pending_driver'
 */
import { supabase } from './supabase';
import {
  getConfigFiscale,
  isModalitaReale,
  type ProviderFiscale,
  type RegimeFiscale,
  type ConfigFPT,
  type ConfigAdeDiretto,
  type ConfigRCH,
  type ConfigEpson,
} from './configFiscale';

export type TipoAnnullo = 'fattura' | 'scontrino_fisico' | 'scontrino_digitale';

export interface EsitoAnnulloFiscale {
  ok: boolean;
  simulato: boolean;
  esito: 'simulato' | 'pending_driver' | 'ok' | 'errore';
  messaggio: string;
  provider: ProviderFiscale | null;
  notaCreditoRif?: string;
  logId?: number;
}

interface ParametriAnnullo {
  tipo: TipoAnnullo;
  documentoId: number;
  numeroDocumento: string;
  motivo: string;
  userEmail?: string;
  clienteId?: number | null;
  importoLordo?: number | null;
}

export async function annullaFiscalmente(params: ParametriAnnullo): Promise<EsitoAnnulloFiscale> {
  const { tipo, documentoId, numeroDocumento, motivo, clienteId, importoLordo } = params;

  const regime: RegimeFiscale =
    tipo === 'fattura' ? 'fatture'
    : tipo === 'scontrino_fisico' ? 'scontrini_fisico'
    : 'scontrini_digitale';

  let provider: ProviderFiscale | null = null;
  let modalita: 'simulazione' | 'reale' = 'simulazione';
  let configProvider: Record<string, any> = {};

  try {
    const cfg = await getConfigFiscale(regime);
    if (cfg) {
      provider = cfg.provider;
      modalita = isModalitaReale(cfg.config) ? 'reale' : 'simulazione';
      configProvider = cfg.config || {};
    }
  } catch (err) {
    console.warn('⚠️ Errore lettura config fiscale:', err);
  }

  if (!provider) {
    return {
      ok: false,
      simulato: false,
      esito: 'errore',
      messaggio: '⚠️ Provider fiscale non configurato. Vai in Impostazioni → Fiscale prima di annullare.',
      provider: null,
    };
  }

  const payload = {
    tipo_documento: tipo,
    documento_id: documentoId,
    numero_documento: numeroDocumento,
    motivo,
    cliente_id: clienteId ?? null,
    importo_lordo: importoLordo ?? null,
    provider,
    modalita,
    ambiente: (configProvider as ConfigFPT).ambiente || null,
    codice_sdi: (configProvider as ConfigAdeDiretto).codice_sdi || null,
    modello: (configProvider as ConfigRCH).modello || (configProvider as ConfigEpson).modello || null,
  };

  const tipoLog = tipo === 'fattura' ? 'nota_credito'
    : tipo === 'scontrino_fisico' ? 'annullo_scontrino_rt'
    : 'annullo_corrispettivi';

  if (modalita === 'simulazione') {
    const logId = await scriviLog({
      tipo: tipoLog,
      provider,
      modalita,
      riferimento_id: String(documentoId),
      payload,
      esito: 'simulato',
    });
    return {
      ok: true,
      simulato: true,
      esito: 'simulato',
      provider,
      messaggio: `🧪 Simulazione: annullo ${numeroDocumento} registrato ma NON trasmesso a ${labelProvider(provider)}.`,
      logId,
    };
  }

  // MODALITÀ REALE (stub)
  const logId = await scriviLog({
    tipo: tipoLog,
    provider,
    modalita,
    riferimento_id: String(documentoId),
    payload,
    esito: 'pending_driver',
    errore: `Driver ${labelProvider(provider)} non ancora collegato`,
  });

  return {
    ok: false,
    simulato: false,
    esito: 'pending_driver',
    provider,
    messaggio: `🟢 Modalità reale attiva, ma il driver ${labelProvider(provider)} non è ancora collegato. Evento registrato nei log.`,
    logId,
  };
}

async function scriviLog(riga: {
  tipo: string;
  provider: string;
  modalita: string;
  riferimento_id: string;
  payload: Record<string, any>;
  esito: string;
  errore?: string;
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
      })
      .select('id')
      .single();

    if (error) {
      console.warn('Errore scrittura integrazioni_log (annullo):', error);
      return undefined;
    }
    return data?.id;
  } catch (err) {
    console.warn('Errore inatteso scrittura integrazioni_log (annullo):', err);
    return undefined;
  }
}

function labelProvider(p: ProviderFiscale | null): string {
  if (!p) return 'provider';
  switch (p) {
    case 'fpt': return 'FPT';
    case 'ade_diretto': return 'ADE/SDI';
    case 'rch': return 'RCH';
    case 'epson': return 'Epson';
    default: return p;
  }
}
