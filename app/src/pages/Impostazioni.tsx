const RIGHETTI_SCRIPT = 'https://script.google.com/macros/s/AKfycbyYHBGLaBIePHpB3f19xJ1W6tpsHQYlpCT_M2XPSDS96UZcEKJ7NXMjYd40XJTNGmJd/exec';
import {
  useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import {
  syncGoogleSheets,
  inviaEmailTest,
  type SheetsSyncResponse,
  getAdminUtenti,
  prorogaDemoUtente,
  sbloccaUtenteReale,
  popolaDemoUtente,
  type AdminUtenteLicenza,
} from '../lib/api';
import { invalidaCacheDatiAziendali, caricaDatiAziendali, salvaDatiAziendali } from '../lib/datiAziendali';
import { useAuth } from '../lib/auth';
import { getLogoUrl, uploadLogo, rimuoviLogo, esisteLogoCustom } from '../lib/logo';
import { caricaFatturazione, salvaFatturazione, FATTURAZIONE_DEFAULT, type ConfigFatturazione } from '../lib/fatturazione';
import {
  caricaAgendaConfig,
  salvaAgendaConfig,
  invalidaCacheAgendaConfig,
  AGENDA_DEFAULT,
  generaIdCategoria,
  generaIdOperatore,
  type ConfigAgenda,
  type CategoriaServizio,
  type OperatoreConfig,
  type Fascia,
} from '../lib/agenda-config';
import { aggiornaCostantiAgenda } from '../lib/appuntamenti';
import { getServizi, type Servizio } from '../lib/servizi';
import { caricaPrivacy, salvaPrivacy, invalidaCachePrivacy, PRIVACY_DEFAULT, INFORMATIVA_DEFAULT, type ConfigPrivacy } from '../lib/privacy';
import { caricaAspetto, salvaAspetto, invalidaCacheAspetto, ASPETTO_DEFAULT, type ConfigAspetto } from '../lib/aspetto';
import { SicurezzaTab } from '../components/SicurezzaTab';
import { ModaleConfigFiscale } from '../components/ModaleConfigFiscale';
import { TestiTemplateTab } from '../components/TestiTemplateTab';
import { AutomazioniTab } from '../components/AutomazioniTab';
import { AppClienteTab } from '../components/AppClienteTab';
import type { RegimeFiscale } from '../lib/configFiscale';

// ============ TIPI ============
interface Sede {
  indirizzo: string;
  cap: string;
  citta: string;
  provincia: string;
}

interface DatiAziendali {
  ragioneSociale: string;
  partitaIva: string;
  codiceFiscale: string;
  sedeLegale: Sede;
  sedeOperativaUgualeLegale: boolean;
  sedeOperativa: Sede;
  email: string;
  pec: string;
  telefono: string;
  sitoWeb: string;
  iban: string;
  codiceSdi: string;
  regimeFiscale: 'ordinario' | 'forfettario';
}

const SEDE_VUOTA: Sede = { indirizzo: '', cap: '', citta: '', provincia: '' };

const AZIENDA_DEFAULT: DatiAziendali = {
  ragioneSociale: 'Righetti Since 1967',
  partitaIva: '',
  codiceFiscale: '',
  sedeLegale: { ...SEDE_VUOTA },
  sedeOperativaUgualeLegale: true,
  sedeOperativa: { ...SEDE_VUOTA },
  email: '',
  pec: '',
  telefono: '',
  sitoWeb: '',
  iban: '',
  codiceSdi: '',
  regimeFiscale: 'ordinario',
};

function normalizzaDati(raw: unknown): DatiAziendali {
  if (!raw || typeof raw !== 'object') return { ...AZIENDA_DEFAULT };
  const r = raw as Record<string, unknown>;

  const sedeLegale: Sede = {
    indirizzo: (r.sedeLegale as Sede | undefined)?.indirizzo ?? (r.indirizzo as string) ?? '',
    cap: (r.sedeLegale as Sede | undefined)?.cap ?? (r.cap as string) ?? '',
    citta: (r.sedeLegale as Sede | undefined)?.citta ?? (r.citta as string) ?? '',
    provincia: (r.sedeLegale as Sede | undefined)?.provincia ?? (r.provincia as string) ?? '',
  };

  return {
    ragioneSociale: (r.ragioneSociale as string) ?? AZIENDA_DEFAULT.ragioneSociale,
    partitaIva: (r.partitaIva as string) ?? '',
    codiceFiscale: (r.codiceFiscale as string) ?? '',
    sedeLegale,
    sedeOperativaUgualeLegale: (r.sedeOperativaUgualeLegale as boolean) ?? true,
    sedeOperativa: (r.sedeOperativa as Sede) ?? { ...SEDE_VUOTA },
    email: (r.email as string) ?? '',
    pec: (r.pec as string) ?? '',
    telefono: (r.telefono as string) ?? '',
    sitoWeb: (r.sitoWeb as string) ?? '',
    iban: (r.iban as string) ?? '',
    codiceSdi: (r.codiceSdi as string) ?? '',
    regimeFiscale: (r.regimeFiscale as DatiAziendali['regimeFiscale']) ?? 'ordinario',
  };
}

type TabId = 'profilo' | 'azienda' | 'fatturazione' | 'agenda' | 'privacy' | 'aspetto' | 'google_sheets' | 'comunicazioni' | 'promemoria' | 'testi_template' | 'automazioni' | 'sicurezza' | 'licenze' | 'app_cliente';

const BASE_TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'profilo', label: 'Profilo', icon: '👤' },
  { id: 'azienda', label: 'Azienda', icon: '🏢' },
  { id: 'fatturazione', label: 'Fatturazione', icon: '🧾' },
  { id: 'agenda', label: 'Agenda', icon: '📅' },
  { id: 'privacy', label: 'Privacy', icon: '🔒' },
  { id: 'aspetto', label: 'Aspetto', icon: '🎨' },
  { id: 'google_sheets', label: 'Google Sheets', icon: '🔄' },
  { id: 'comunicazioni', label: 'Comunicazioni', icon: '💬' },
  { id: 'promemoria', label: 'Promemoria', icon: '⏰' },
  { id: 'testi_template', label: 'Testi Messaggi', icon: '📝' },
  { id: 'automazioni', label: 'Automazioni', icon: '🔔' },
  { id: 'sicurezza', label: 'Sicurezza', icon: '🔐' },
  { id: 'app_cliente', label: 'App Cliente', icon: '📱' },
];

const ADMIN_EMAIL = 'righetti@righetti.club';

// ============ COMPONENTI HELPER ============
function Card({ children, title, subtitle }: { children: ReactNode; title?: string; subtitle?: string }) {
  return (
    <div className="bg-white rounded-apple shadow-apple p-5 sm:p-6">
      {title && (
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-apple-darkgray">{title}</h2>
          {subtitle && <p className="text-xs text-apple-gray mt-0.5">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

function Campo({
  label, value, onChange, type = 'text', placeholder, disabled, help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  help?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-apple-darkgray mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 rounded-apple bg-gray-50 border border-gray-200 text-sm text-apple-darkgray placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-apple-blue/40 focus:border-apple-blue transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      />
      {help && <p className="text-[11px] text-apple-gray mt-0.5">{help}</p>}
    </div>
  );
}

function Toggle({
  label, description, checked, onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-apple-darkgray">{label}</p>
        {description && <p className="text-xs text-apple-gray mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-12 h-7 rounded-full transition-colors duration-200 ${checked ? 'bg-green-500' : 'bg-gray-300'}`}
        role="switch"
        aria-checked={checked}
      >
        <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

function FormSede({
  sede, onChange, disabled,
}: {
  sede: Sede;
  onChange: (s: Sede) => void;
  disabled?: boolean;
}) {
  function set<K extends keyof Sede>(k: K, v: Sede[K]) {
    onChange({ ...sede, [k]: v });
  }
  return (
    <div className="space-y-3">
      <Campo
        label="Indirizzo"
        value={sede.indirizzo}
        onChange={(v) => set('indirizzo', v)}
        placeholder="Via Roma 1"
        disabled={disabled}
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Campo label="CAP" value={sede.cap} onChange={(v) => set('cap', v)} placeholder="20100" disabled={disabled} />
        <Campo label="Città" value={sede.citta} onChange={(v) => set('citta', v)} placeholder="Milano" disabled={disabled} />
        <Campo label="Provincia" value={sede.provincia} onChange={(v) => set('provincia', v)} placeholder="MI" disabled={disabled} />
      </div>
    </div>
  );
}


// ============================================================
// TAB GOOGLE SHEETS (Con Auto-Sync giornaliero alle 08:00)
// ============================================================
function TabGoogleSheets({ registraSalva }: { registraSalva: (fn: () => void, s: boolean) => void }) {
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  const [urlOriginale, setUrlOriginale] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [sincronizzando, setSincronizzando] = useState(false);
  const [ultimoSyncAt, setUltimoSyncAt] = useState<Date | null>(() => {
    const salvato = localStorage.getItem('gestionale_sheets_last_sync');
    return salvato ? new Date(salvato) : null;
  });
  const [messaggio, setMessaggio] = useState<{ tipo: 'ok' | 'errore'; testo: string } | null>(null);
  const [risultatoSync, setRisultatoSync] = useState<SheetsSyncResponse | null>(null);

  // Carica URL salvato da Supabase
  useEffect(() => {
    async function caricaConfig() {
      if (!user?.id) return;
      try {
        const { data, error } = await supabase
          .from('impostazioni')
          .select('valore')
          .eq('user_id', user.id)
          .eq('chiave', 'google_sheet_url')
          .maybeSingle();

        if (error) console.warn('Errore lettura sheet_url:', error);
        else if (data?.valore) {
          setUrl(data.valore);
          setUrlOriginale(data.valore);
        }
      } catch (err) {
        console.warn('Errore:', err);
      }
    }
    caricaConfig();
  }, [user?.id]);

  // Funzione di sincronizzazione (usabile sia a mano che dal timer)
  const eseguiSync = useCallback(async (silenzioso = false) => {
    const targetUrl = urlOriginale || url;
    if (!targetUrl.trim()) return;

    if (!silenzioso) {
      setSincronizzando(true);
      setMessaggio(null);
    }

    try {
      const res = await syncGoogleSheets(targetUrl.trim(), user?.id);
      setRisultatoSync(res);
      const adesso = new Date();
      setUltimoSyncAt(adesso);
      localStorage.setItem('gestionale_sheets_last_sync', adesso.toISOString());
      if (!silenzioso) {
        setMessaggio({ tipo: 'ok', testo: res.messaggio || 'Sincronizzazione completata con successo!' });
      }
    } catch (e: any) {
      if (!silenzioso) {
        setMessaggio({ tipo: 'errore', testo: e.message || 'Errore durante la sincronizzazione' });
      }
    } finally {
      if (!silenzioso) setSincronizzando(false);
    }
  }, [url, urlOriginale]);

  // Salvataggio URL
  async function handleSalva() {
    if (!user?.id || !url.trim()) return;
    setSalvando(true);
    setMessaggio(null);
    try {
      const { error } = await supabase
        .from('impostazioni')
        .upsert(
          {
            user_id: user.id,
            chiave: 'google_sheet_url',
            valore: url.trim(),
                      },
          { onConflict: 'user_id,chiave' }
        );

      if (error) throw error;
      setUrlOriginale(url.trim());
      setMessaggio({ tipo: 'ok', testo: 'URL Google Sheet salvato con successo!' });
    } catch (e: any) {
      setMessaggio({ tipo: 'errore', testo: e.message || 'Errore salvataggio URL' });
    } finally {
      setSalvando(false);
    }
  }

  useEffect(() => {
    if (url.trim() !== urlOriginale) {
      registraSalva(handleSalva, salvando);
    }
  }, [url, urlOriginale, salvando]);

  return (
    <div className="space-y-6">
      {/* Banner Sincronizzazione Automatica Attiva */}
      {urlOriginale && (
        <div className="p-4 rounded-apple bg-green-50/70 border border-green-200 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <div>
              <p className="text-xs font-bold text-green-900">
                Sincronizzazione automatica attiva (ogni giorno alle 08:00)
              </p>
              <p className="text-[11px] text-green-700">
                {ultimoSyncAt
                  ? `Ultimo controllo: ${ultimoSyncAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`
                  : 'In attesa del prossimo ciclo automatico...'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => eseguiSync(false)}
            disabled={sincronizzando}
            className="px-4 py-2 rounded-apple bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors shadow-apple flex items-center gap-1.5"
          >
            {sincronizzando ? (
              <>
                <span className="animate-spin">⏳</span> Sincronizzazione in corso...
              </>
            ) : (
              <>
                <span>🔄</span> Sincronizza ora (Manuale)
              </>
            )}
          </button>
        </div>
      )}

      {/* Card Configurazione Foglio */}
      <div className="bg-white rounded-apple shadow-apple p-6">
        <h3 className="text-base font-bold text-apple-darkgray mb-1">
          Foglio Google per Anagrafica Clienti
        </h3>
        <p className="text-xs text-apple-gray mb-4">
          Inserisci il link del Google Sheet condiviso. I clienti aggiunti o modificati nel foglio verranno importati in automatico nel Gestionale.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">
              URL del Foglio Google
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="flex-1 px-4 py-2.5 bg-apple-lightgray/60 border border-transparent rounded-apple text-sm text-apple-darkgray focus:bg-white focus:border-apple-blue focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={handleSalva}
                disabled={salvando || !url.trim() || url === urlOriginale}
                className="px-5 py-2.5 rounded-apple bg-apple-blue text-white text-xs font-semibold hover:bg-blue-600 disabled:opacity-40 transition-colors shadow-apple"
              >
                {salvando ? 'Salvataggio...' : 'Salva URL'}
              </button>
            </div>
          </div>

          <div className="p-4 rounded-apple bg-blue-50/50 border border-blue-100 text-xs text-apple-gray leading-relaxed space-y-1">
            <p className="font-semibold text-apple-darkgray">ℹ️ Come funziona l'integrazione:</p>
            <p>• Il foglio deve avere l'accesso impostato su <strong>"Chiunque abbia il link può visualizzare"</strong>.</p>
            <p>• Rileva in automatico i nuovi clienti e aggiorna numeri di cellulare, email e anagrafiche già esistenti.</p>
            <p>• Se sei fuori sede e aggiungi un cliente nel foglio da telefono, entro il giorno dopo alle 08:00 lo trovi già sincronizzato. In alternativa, premi 🔄 Sincronizza ora.</p>
          </div>
        </div>

        {/* Feedback Messaggi */}
        {messaggio && (
          <div
            className={`mt-4 p-3.5 rounded-apple text-xs font-medium flex items-center gap-2 ${
              messaggio.tipo === 'ok'
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            <span>{messaggio.tipo === 'ok' ? '✅' : '⚠️'}</span>
            <span>{messaggio.testo}</span>
          </div>
        )}

        {/* Risultato Contatori */}
        {risultatoSync && (
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-apple bg-green-50 border border-green-200 text-center">
              <p className="text-xl font-bold text-green-700">{risultatoSync.nuovi}</p>
              <p className="text-[10px] font-semibold text-green-800 uppercase tracking-wider mt-0.5">Nuovi Clienti</p>
            </div>
            <div className="p-3 rounded-apple bg-blue-50 border border-blue-200 text-center">
              <p className="text-xl font-bold text-apple-blue">{risultatoSync.aggiornati}</p>
              <p className="text-[10px] font-semibold text-blue-800 uppercase tracking-wider mt-0.5">Aggiornati</p>
            </div>
            <div className="p-3 rounded-apple bg-gray-50 border border-gray-200 text-center">
              <p className="text-xl font-bold text-apple-gray">{risultatoSync.saltati}</p>
              <p className="text-[10px] font-semibold text-apple-gray uppercase tracking-wider mt-0.5">Invariati / Saltati</p>
            </div>
            <div className="p-3 rounded-apple bg-purple-50 border border-purple-200 text-center">
              <p className="text-xl font-bold text-purple-700">{risultatoSync.totale}</p>
              <p className="text-[10px] font-semibold text-purple-800 uppercase tracking-wider mt-0.5">Totale Righe</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ============================================================
// TAB COMUNICAZIONI (WhatsApp & Email)
// ============================================================
function TabComunicazioni({ registraSalva }: { registraSalva: (fn: () => void, s: boolean) => void }) {
  const { user } = useAuth();
  
  // WhatsApp State
  const [waToken, setWaToken] = useState('');
  const [testEmailDestinatario, setTestEmailDestinatario] = useState(user?.email || '');
  const [inviandoTestEmail, setInviandoTestEmail] = useState(false);
  const [esitoTestEmail, setEsitoTestEmail] = useState<{ tipo: 'ok' | 'errore'; testo: string } | null>(null);

  async function handleTestEmail() {
    if (!emailConfig.host || !emailConfig.username || !emailConfig.password) {
      alert('Compila prima Host, Username e Password dell\'email.');
      return;
    }
    if (!testEmailDestinatario.trim()) {
      alert('Inserisci l\'indirizzo email a cui inviare il test.');
      return;
    }

    setInviandoTestEmail(true);
    setEsitoTestEmail(null);
    try {
      const res = await inviaEmailTest({
        google_script_url: emailConfig.googleScriptUrl?.trim() || 'https://script.google.com/macros/s/AKfycbyYHBGLaBIePHpB3f19xJ1W6tpsHQYlpCT_M2XPSDS96UZcEKJ7NXMjYd40XJTNGmJd/exec',
        host: emailConfig.host?.trim() || undefined,
        port: parseInt(emailConfig.port, 10) || 587,
        secure: emailConfig.secure,
        username: emailConfig.username?.trim() || undefined,
        password: emailConfig.password?.trim() || undefined,
        from_name: emailConfig.fromName?.trim() || 'Studio Righetti Since 1967',
        destinatario: testEmailDestinatario.trim(),
      });
      setEsitoTestEmail({ tipo: 'ok', testo: res.messaggio });
    } catch (err: any) {
      setEsitoTestEmail({ tipo: 'errore', testo: err.message || 'Errore durante l\'invio del test' });
    } finally {
      setInviandoTestEmail(false);
    }
  }
  const [waSenderPhone, setWaSenderPhone] = useState('');
  const [waOriginale, setWaOriginale] = useState({ token: '', phone: '' });

  // Email State
  const [emailConfig, setEmailConfig] = useState({
    provider: 'google_relay', // google_relay | smtp
    googleScriptUrl: '',
    host: '',
    port: '587',
    secure: false,
    username: '',
    password: '',
    fromEmail: '',
    fromName: '',
  });
  const [emailOriginale, setEmailOriginale] = useState({ ...emailConfig });

  const [salvando, setSalvando] = useState(false);
  const [messaggio, setMessaggio] = useState<{ tipo: 'ok' | 'errore'; testo: string } | null>(null);

  // Caricamento impostazioni da Supabase (per user_id)
  useEffect(() => {
    async function carica() {
      if (!user?.id) return;
      try {
        const { data: dataWa } = await supabase
          .from('impostazioni')
          .select('valore')
          .eq('user_id', user.id)
          .eq('chiave', 'config_whatsapp')
          .maybeSingle();

        if (dataWa?.valore) {
          const val = typeof dataWa.valore === 'string' ? JSON.parse(dataWa.valore) : dataWa.valore;
          setWaToken(val.token || '');
          setWaSenderPhone(val.phone || '');
          setWaOriginale({ token: val.token || '', phone: val.phone || '' });
        }

        const isRighetti = user.email?.toLowerCase().trim() === 'righetti@righetti.club';
        const { data: dataEmail } = await supabase
          .from('impostazioni')
          .select('valore')
          .eq('user_id', user.id)
          .eq('chiave', 'config_email')
          .maybeSingle();

        if (dataEmail?.valore) {
          const val = typeof dataEmail.valore === 'string' ? JSON.parse(dataEmail.valore) : dataEmail.valore;
          setEmailConfig((prev) => ({ ...prev, ...val }));
          setEmailOriginale((prev) => ({ ...prev, ...val }));
        } else if (isRighetti) {
          // Solo per Righetti preimposta il relay ufficiale
          setEmailConfig((prev) => ({ ...prev, googleScriptUrl: RIGHETTI_SCRIPT }));
          setEmailOriginale((prev) => ({ ...prev, googleScriptUrl: RIGHETTI_SCRIPT }));
        }
      } catch (err) {
        console.warn('Errore caricamento comunicazioni:', err);
      }
    }
    carica();
  }, [user?.id]);

  async function handleSalvaTutto() {
    if (!user?.id) return;
    setSalvando(true);
    setMessaggio(null);
    try {
      // 1. Salva WhatsApp
      const payloadWa = { token: waToken.trim(), phone: waSenderPhone.trim() };
      await supabase.from('impostazioni').upsert({
        user_id: user.id,
        chiave: 'config_whatsapp',
        valore: payloadWa,
      }, { onConflict: 'user_id,chiave' });

      // 2. Salva Email
      await supabase.from('impostazioni').upsert({
        user_id: user.id,
        chiave: 'config_email',
        valore: emailConfig,
      }, { onConflict: 'user_id,chiave' });

      setWaOriginale(payloadWa);
      setEmailOriginale({ ...emailConfig });
      setMessaggio({ tipo: 'ok', testo: 'Impostazioni WhatsApp ed Email salvate con successo!' });
    } catch (e: any) {
      setMessaggio({ tipo: 'errore', testo: e.message || 'Errore nel salvataggio' });
    } finally {
      setSalvando(false);
    }
  }

  // Registra il pulsante globale "Salva modifiche" in alto a destra
  useEffect(() => {
    registraSalva(handleSalvaTutto, salvando);
  }, [waToken, waSenderPhone, emailConfig, salvando]);

  return (
    <div className="space-y-6">
      {messaggio && (
        <div className={`p-4 rounded-apple text-xs font-semibold flex items-center gap-2 ${
          messaggio.tipo === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <span>{messaggio.tipo === 'ok' ? '✅' : '⚠️'}</span>
          <span>{messaggio.testo}</span>
        </div>
      )}

      {/* CARD WHATSAPP (Whatsender) */}
      <div className="bg-white rounded-apple shadow-apple p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">💬</span>
            <div>
              <h3 className="text-base font-bold text-apple-darkgray">WhatsApp (Whatsender)</h3>
              <p className="text-xs text-apple-gray">Configura l\'istanza Whatsender per l\'invio automatico di messaggi e promemoria</p>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
            waOriginale.token ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            {waOriginale.token ? '● Connesso' : '○ Non configurato'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">
              Whatsender API Token / Instance ID *
            </label>
            <input
              type="password"
              value={waToken}
              onChange={(e) => setWaToken(e.target.value)}
              placeholder="Incolla il token Whatsender..."
              className="w-full px-4 py-2.5 bg-apple-lightgray/60 border border-transparent rounded-apple text-sm text-apple-darkgray focus:bg-white focus:border-apple-blue focus:outline-none transition-all font-mono"
            />
            <p className="text-[10px] text-apple-gray mt-1">Generato dalla tua dashboard Whatsender</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">
              Numero WhatsApp Mittente (Opzionale)
            </label>
            <input
              type="text"
              value={waSenderPhone}
              onChange={(e) => setWaSenderPhone(e.target.value)}
              placeholder="Es. +39 340 1234567"
              className="w-full px-4 py-2.5 bg-apple-lightgray/60 border border-transparent rounded-apple text-sm text-apple-darkgray focus:bg-white focus:border-apple-blue focus:outline-none transition-all"
            />
            <p className="text-[10px] text-apple-gray mt-1">Numero associato all\'istanza Whatsender</p>
          </div>
        </div>
      </div>

      {/* CARD EMAIL PROVIDER */}
      <div className="bg-white rounded-apple shadow-apple p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">✉️</span>
            <div>
              <h3 className="text-base font-bold text-apple-darkgray">Provider Email (Google Workspace Relay)</h3>
              <p className="text-xs text-apple-gray">Invio sicuro tramite Google Apps Script su HTTPS (porta 443) dal tuo account Gmail / Google Workspace</p>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
            (emailConfig.googleScriptUrl || emailConfig.host) ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            {(emailConfig.googleScriptUrl || emailConfig.host) ? '● Connesso' : '○ Non configurato'}
          </span>
        </div>

        <div className="mt-4 p-4 rounded-apple bg-blue-50/40 border border-blue-100">
          <label className="block text-xs font-semibold text-apple-darkgray mb-1">
            Google Webhook Relay URL
          </label>
          <input
            type="text"
            value={emailConfig.googleScriptUrl || ''}
            onChange={(e) => setEmailConfig({ ...emailConfig, googleScriptUrl: e.target.value })}
            className="w-full px-3.5 py-2 bg-white border border-blue-200 rounded-apple text-xs text-apple-darkgray font-mono focus:outline-none focus:border-apple-blue"
          />
          <p className="text-[10px] text-apple-gray mt-1">
            Le email partiranno direttamente dal tuo indirizzo Google Workspace ufficiale senza limiti di porte.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-apple-gray mb-1.5">Host SMTP</label>
            <input
              type="text"
              value={emailConfig.host}
              onChange={(e) => setEmailConfig({ ...emailConfig, host: e.target.value })}
              placeholder="Es. smtp.gmail.com o mail.tuodominio.it"
              className="w-full px-4 py-2.5 bg-apple-lightgray/60 border border-transparent rounded-apple text-sm text-apple-darkgray focus:bg-white focus:border-apple-blue focus:outline-none transition-all font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">Porta SMTP</label>
            <input
              type="text"
              value={emailConfig.port}
              onChange={(e) => setEmailConfig({ ...emailConfig, port: e.target.value })}
              placeholder="587 / 465"
              className="w-full px-4 py-2.5 bg-apple-lightgray/60 border border-transparent rounded-apple text-sm text-apple-darkgray focus:bg-white focus:border-apple-blue focus:outline-none transition-all font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">Username / Email Accesso</label>
            <input
              type="text"
              value={emailConfig.username}
              onChange={(e) => setEmailConfig({ ...emailConfig, username: e.target.value })}
              placeholder="es. info@tuodominio.it"
              className="w-full px-4 py-2.5 bg-apple-lightgray/60 border border-transparent rounded-apple text-sm text-apple-darkgray focus:bg-white focus:border-apple-blue focus:outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">Password / API Key</label>
            <input
              type="password"
              value={emailConfig.password}
              onChange={(e) => setEmailConfig({ ...emailConfig, password: e.target.value })}
              placeholder="••••••••••••"
              className="w-full px-4 py-2.5 bg-apple-lightgray/60 border border-transparent rounded-apple text-sm text-apple-darkgray focus:bg-white focus:border-apple-blue focus:outline-none transition-all font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">Nome Mittente Visibile</label>
            <input
              type="text"
              value={emailConfig.fromName}
              onChange={(e) => setEmailConfig({ ...emailConfig, fromName: e.target.value })}
              placeholder="Es. Nome del tuo Studio"
              className="w-full px-4 py-2.5 bg-apple-lightgray/60 border border-transparent rounded-apple text-sm text-apple-darkgray focus:bg-white focus:border-apple-blue focus:outline-none transition-all"
            />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-apple-darkgray cursor-pointer">
            <input
              type="checkbox"
              checked={emailConfig.secure}
              onChange={(e) => setEmailConfig({ ...emailConfig, secure: e.target.checked })}
              className="w-4 h-4 accent-apple-blue rounded"
            />
            Usa connessione SSL/TLS diretta (porta 465)
          </label>
        </div>

        {/* Box Test Connessione Email */}
        <div className="mt-5 p-4 rounded-apple bg-gray-50 border border-gray-200/80">
          <p className="text-xs font-bold text-apple-darkgray mb-1">
            🧪 Test di Connessione e Invio Email
          </p>
          <p className="text-[11px] text-apple-gray mb-3">
            Invia un\'email di prova per verificare che Google Workspace accetti la tua password per le app.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={testEmailDestinatario}
              onChange={(e) => setTestEmailDestinatario(e.target.value)}
              placeholder="Inserisci email di prova..."
              className="flex-1 px-3.5 py-2 bg-white border border-gray-200 rounded-apple text-xs text-apple-darkgray focus:outline-none focus:border-apple-blue"
            />
            <button
              type="button"
              onClick={handleTestEmail}
              disabled={inviandoTestEmail}
              className="px-4 py-2 bg-apple-blue text-white rounded-apple text-xs font-semibold hover:bg-blue-600 disabled:opacity-50 transition-colors shadow-apple shrink-0"
            >
              {inviandoTestEmail ? '⏳ Invio in corso...' : '✉️ Invia Email di Test'}
            </button>
          </div>

          {esitoTestEmail && (
            <div className={`mt-3 p-3 rounded-apple text-xs font-medium flex items-center gap-2 ${
              esitoTestEmail.tipo === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              <span>{esitoTestEmail.tipo === 'ok' ? '✅' : '❌'}</span>
              <span>{esitoTestEmail.testo}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TAB PROMEMORIA & AUTOMAZIONI (Struttura Pronta)
// ============================================================
function TabPromemoria({ registraSalva }: { registraSalva: (fn: () => void, s: boolean) => void }) {
  const { user } = useAuth();
  const [config, setConfig] = useState({
    attivo: true,
    canale: 'whatsapp', // whatsapp | email | entrambi
    oreAnticipo: '24',
    messaggioStandard: 'Gentile {cliente}, le ricordiamo il suo appuntamento per il giorno {data} alle ore {ora}. A presto!',
    // Automazione specifica Nuovo Cliente Check-Up
    attivoCheckup: true,
    oreAnticipoCheckup: '48',
    messaggioCheckup: 'Gentile {cliente}, le ricordiamo la sua prima visita: "Righetti Check-Up Gratuito" per il giorno {data} ore {ora}. La aspettiamo presso il nostro studio!',
  });
  const [salvando, setSalvando] = useState(false);
  const [messaggio, setMessaggio] = useState<{ tipo: 'ok' | 'errore'; testo: string } | null>(null);

  useEffect(() => {
    async function carica() {
      if (!user?.id) return;
      try {
        const { data } = await supabase
          .from('impostazioni')
          .select('valore')
          .eq('user_id', user.id)
          .eq('chiave', 'config_promemoria')
          .maybeSingle();

        if (data?.valore) {
          const val = typeof data.valore === 'string' ? JSON.parse(data.valore) : data.valore;
          setConfig((prev) => ({ ...prev, ...val }));
        }
      } catch (err) {
        console.warn('Errore promemoria:', err);
      }
    }
    carica();
  }, [user?.id]);

  async function handleSalva() {
    if (!user?.id) return;
    setSalvando(true);
    try {
      await supabase.from('impostazioni').upsert({
        user_id: user.id,
        chiave: 'config_promemoria',
        valore: config,
      }, { onConflict: 'user_id,chiave' });
      setMessaggio({ tipo: 'ok', testo: 'Regole promemoria salvate con successo!' });
    } catch (e: any) {
      setMessaggio({ tipo: 'errore', testo: e.message || 'Errore salvataggio' });
    } finally {
      setSalvando(false);
    }
  }

  useEffect(() => {
    registraSalva(handleSalva, salvando);
  }, [config, salvando]);

  return (
    <div className="space-y-6">
      {messaggio && (
        <div className={`p-4 rounded-apple text-xs font-semibold ${
          messaggio.tipo === 'ok' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {messaggio.testo}
        </div>
      )}

      {/* Regola Generale Agenda */}
      <div className="bg-white rounded-apple shadow-apple p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-apple-darkgray">Promemoria Appuntamenti Standard</h3>
            <p className="text-xs text-apple-gray">Invia un messaggio di promemoria automatico prima dell\'appuntamento</p>
          </div>
          <input
            type="checkbox"
            checked={config.attivo}
            onChange={(e) => setConfig({ ...config, attivo: e.target.checked })}
            className="w-5 h-5 accent-apple-blue rounded"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">Canale di Invio</label>
            <select
              value={config.canale}
              onChange={(e) => setConfig({ ...config, canale: e.target.value })}
              className="w-full px-4 py-2.5 bg-apple-lightgray/60 border border-transparent rounded-apple text-sm text-apple-darkgray focus:bg-white focus:border-apple-blue focus:outline-none transition-all"
            >
              <option value="whatsapp">Solo WhatsApp</option>
              <option value="email">Solo Email</option>
              <option value="entrambi">WhatsApp + Email</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-apple-gray mb-1.5">Anticipo di Invio</label>
            <select
              value={config.oreAnticipo}
              onChange={(e) => setConfig({ ...config, oreAnticipo: e.target.value })}
              className="w-full px-4 py-2.5 bg-apple-lightgray/60 border border-transparent rounded-apple text-sm text-apple-darkgray focus:bg-white focus:border-apple-blue focus:outline-none transition-all"
            >
              <option value="24">24 ore prima (1 giorno)</option>
              <option value="48">48 ore prima (2 giorni)</option>
              <option value="72">72 ore prima (3 giorni)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-apple-gray mb-1.5">Testo del Messaggio</label>
          <textarea
            value={config.messaggioStandard}
            onChange={(e) => setConfig({ ...config, messaggioStandard: e.target.value })}
            rows={3}
            className="w-full px-4 py-2.5 bg-apple-lightgray/60 border border-transparent rounded-apple text-sm text-apple-darkgray focus:bg-white focus:border-apple-blue focus:outline-none transition-all font-mono text-xs leading-relaxed"
          />
          <p className="text-[10px] text-apple-gray mt-1">Variabili disponibili: {'{cliente}'}, {'{data}'}, {'{ora}'}, {'{servizio}'}</p>
        </div>
      </div>

      {/* Regola Specifica: Check-Up Gratuito Nuovo Cliente */}
      <div className="bg-white rounded-apple shadow-apple p-6 border-l-4 border-apple-blue">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-apple-darkgray">Check-Up Gratuito (Nuovo Cliente)</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-apple-blue">Dedicato</span>
            </div>
            <p className="text-xs text-apple-gray">Automazione specifica per i nuovi clienti con prima visita Check-Up</p>
          </div>
          <input
            type="checkbox"
            checked={config.attivoCheckup}
            onChange={(e) => setConfig({ ...config, attivoCheckup: e.target.checked })}
            className="w-5 h-5 accent-apple-blue rounded"
          />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-apple-gray mb-1.5">Anticipo di Invio Dedicato</label>
          <select
            value={config.oreAnticipoCheckup}
            onChange={(e) => setConfig({ ...config, oreAnticipoCheckup: e.target.value })}
            className="w-full sm:w-64 px-4 py-2.5 bg-apple-lightgray/60 border border-transparent rounded-apple text-sm text-apple-darkgray focus:bg-white focus:border-apple-blue focus:outline-none transition-all"
          >
            <option value="24">24 ore prima</option>
            <option value="48">48 ore prima</option>
            <option value="72">72 ore prima</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-apple-gray mb-1.5">Testo Dedicato Prima Visita</label>
          <textarea
            value={config.messaggioCheckup}
            onChange={(e) => setConfig({ ...config, messaggioCheckup: e.target.value })}
            rows={3}
            className="w-full px-4 py-2.5 bg-apple-lightgray/60 border border-transparent rounded-apple text-sm text-apple-darkgray focus:bg-white focus:border-apple-blue focus:outline-none transition-all font-mono text-xs leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
}

// ============ PAGINA PRINCIPALE ============
export function Impostazioni() {
  const { user } = useAuth();
  const isAdmin = user?.email?.toLowerCase().trim() === ADMIN_EMAIL;
  const tabs = isAdmin
    ? [...BASE_TABS, { id: 'licenze' as TabId, label: 'Licenze', icon: '👑' }]
    : BASE_TABS;
  const [tabAttiva, setTabAttiva] = useState<TabId>('azienda');
  const [salvaCorrente, setSalvaCorrente] = useState<(() => void) | null>(null);
  const [salvandoCorrente, setSalvandoCorrente] = useState(false);

  useEffect(() => {
    setSalvaCorrente(null);
    setSalvandoCorrente(false);
  }, [tabAttiva]);

  const registraSalva = useCallback((salvaFn: () => void, salvando: boolean) => {
    setSalvaCorrente(() => salvaFn);
    setSalvandoCorrente(salvando);
  }, []);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold text-apple-darkgray tracking-tight">
            Impostazioni
          </h1>
          <p className="text-xs text-apple-gray mt-0.5">
            Gestisci il tuo profilo e i dati dell'azienda
          </p>
        </div>
        {salvaCorrente && (
          <button
            onClick={salvaCorrente}
            disabled={salvandoCorrente}
            className="shrink-0 px-5 py-2 rounded-apple bg-apple-blue text-white text-sm font-medium hover:bg-apple-blue/90 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-apple"
          >
            {salvandoCorrente ? 'Salvataggio…' : 'Salva modifiche'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-6 sm:flex sm:flex-wrap">
        {tabs.map((tab) => {
          const attiva = tabAttiva === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setTabAttiva(tab.id)}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-apple text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                attiva
                  ? 'bg-apple-blue text-white shadow-apple'
                  : 'bg-white text-apple-darkgray hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <span className="text-base leading-none">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {tabAttiva === 'azienda' && <TabAzienda registraSalva={registraSalva} />}
        {tabAttiva === 'profilo' && <TabProfilo />}
        {tabAttiva === 'fatturazione' && <TabFatturazione registraSalva={registraSalva} />}
        {tabAttiva === 'agenda' && <TabAgenda registraSalva={registraSalva} />}
        {tabAttiva === 'privacy' && <TabPrivacy registraSalva={registraSalva} />}
        {tabAttiva === 'aspetto' && <TabAspetto registraSalva={registraSalva} />}
        {tabAttiva === 'google_sheets' && <TabGoogleSheets registraSalva={registraSalva} />}
        {tabAttiva === 'comunicazioni' && <TabComunicazioni registraSalva={registraSalva} />}
        {tabAttiva === 'promemoria' && <TabPromemoria registraSalva={registraSalva} />}
        {tabAttiva === 'testi_template' && <TestiTemplateTab />}
        {tabAttiva === 'automazioni' && <AutomazioniTab />}
        {tabAttiva === 'sicurezza' && <SicurezzaTab />}
        {tabAttiva === 'app_cliente' && <AppClienteTab />}
        {tabAttiva === 'licenze' && isAdmin && <TabLicenze adminEmail={user?.email || ''} />}
      </div>
    </div>
  );
}

// ============ TAB AZIENDA ============
function TabAzienda({ registraSalva }: { registraSalva?: (fn: () => void, salvando: boolean) => void }) {
  const [dati, setDati] = useState<DatiAziendali>(AZIENDA_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [messaggio, setMessaggio] = useState<{ tipo: 'ok' | 'errore'; testo: string } | null>(null);

  useEffect(() => {
    async function carica() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Non autenticato');

        const { data, error } = await supabase
          .from('impostazioni')
          .select('valore')
          .eq('user_id', user.id)
          .eq('chiave', 'dati_aziendali')
          .maybeSingle();

        if (error) throw error;
        setDati(normalizzaDati(data?.valore));
      } catch (err) {
        console.error('Errore caricamento dati aziendali:', err);
        setMessaggio({ tipo: 'errore', testo: 'Errore nel caricamento dei dati.' });
      } finally {
        setLoading(false);
      }
    }
    carica();
  }, []);

  const salva = useCallback(async () => {
    setSalvando(true);
    setMessaggio(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non autenticato');

      const { error } = await supabase
        .from('impostazioni')
        .upsert(
          {
            user_id: user.id,
            chiave: 'dati_aziendali',
            valore: dati,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,chiave' }
        );

      if (error) throw error;
      invalidaCacheDatiAziendali();
      setMessaggio({ tipo: 'ok', testo: 'Dati salvati correttamente.' });
      setTimeout(() => setMessaggio(null), 3000);
    } catch (err) {
      console.error('Errore salvataggio:', err);
      setMessaggio({ tipo: 'errore', testo: 'Errore nel salvataggio. Riprova.' });
    } finally {
      setSalvando(false);
    }
  }, [dati]);

  useEffect(() => {
    if (registraSalva) {
      registraSalva(salva, salvando);
    }
  }, [salva, salvando, registraSalva]);

  function aggiorna<K extends keyof DatiAziendali>(campo: K, valore: DatiAziendali[K]) {
    setDati((d) => ({ ...d, [campo]: valore }));
  }

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12 gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-apple-blue border-t-transparent animate-spin" />
          <p className="text-sm text-apple-gray">Caricamento…</p>
        </div>
      </Card>
    );
  }

  const sedeOperativaEffettiva = dati.sedeOperativaUgualeLegale ? dati.sedeLegale : dati.sedeOperativa;

  return (
    <>
      {messaggio && (
        <div className={`px-4 py-3 rounded-apple text-sm flex items-center gap-2 ${messaggio.tipo === 'ok' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
          <span>{messaggio.tipo === 'ok' ? '✅' : '⚠️'}</span>
          {messaggio.testo}
        </div>
      )}

      <Card title="Dati Aziendali" subtitle="Queste informazioni compariranno su fatture, DDT e documenti.">
        <div className="space-y-4">
          <Campo
            label="Ragione sociale"
            value={dati.ragioneSociale}
            onChange={(v) => aggiorna('ragioneSociale', v)}
            placeholder="Es. Righetti Since 1967 S.r.l."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo label="Partita IVA" value={dati.partitaIva} onChange={(v) => aggiorna('partitaIva', v)} placeholder="IT12345678901" />
            <Campo label="Codice Fiscale" value={dati.codiceFiscale} onChange={(v) => aggiorna('codiceFiscale', v)} placeholder="RSSLCU80A01H501Z" />
          </div>
        </div>
      </Card>

      <Card title="Logo aziendale" subtitle="Carica il logo che apparirà su fatture, DDT, ordini e report.">
        <LogoUploader />
      </Card>

      <Card title="Sede Legale" subtitle="Obbligatoria: compare su fatture e documenti fiscali.">
        <FormSede sede={dati.sedeLegale} onChange={(s) => aggiorna('sedeLegale', s)} />
      </Card>

      <Card title="Sede Operativa" subtitle="Dove svolgi effettivamente l'attività. Compare su DDT e documenti interni.">
        <Toggle
          label="Uguale alla sede legale"
          description="Attiva se l'azienda opera nello stesso indirizzo della sede legale."
          checked={dati.sedeOperativaUgualeLegale}
          onChange={(v) => aggiorna('sedeOperativaUgualeLegale', v)}
        />

        <div className="mt-3">
          {dati.sedeOperativaUgualeLegale ? (
            <div className="px-4 py-3 rounded-apple bg-gray-50 border border-dashed border-gray-200 text-sm text-apple-gray">
              ℹ️ La sede operativa coincide con la <strong>sede legale</strong>.
              {dati.sedeLegale.indirizzo && (
                <span className="block mt-1 text-apple-darkgray">
                  {dati.sedeLegale.indirizzo}, {dati.sedeLegale.cap} {dati.sedeLegale.citta} ({dati.sedeLegale.provincia})
                </span>
              )}
            </div>
          ) : (
            <FormSede sede={dati.sedeOperativa} onChange={(s) => aggiorna('sedeOperativa', s)} />
          )}
        </div>
      </Card>

      <Card title="Contatti">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo label="Email" type="email" value={dati.email} onChange={(v) => aggiorna('email', v)} placeholder="info@azienda.it" />
            <Campo label="PEC" type="email" value={dati.pec} onChange={(v) => aggiorna('pec', v)} placeholder="azienda@pec.it" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo label="Telefono" value={dati.telefono} onChange={(v) => aggiorna('telefono', v)} placeholder="+39 333 1234567" />
            <Campo label="Sito web" value={dati.sitoWeb} onChange={(v) => aggiorna('sitoWeb', v)} placeholder="https://azienda.it" />
          </div>
        </div>
      </Card>

      <Card title="Dati Fiscali">
        <div className="space-y-4">
          <Campo label="IBAN" value={dati.iban} onChange={(v) => aggiorna('iban', v)} placeholder="IT60X0542811101000000123456" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo label="Codice SDI" value={dati.codiceSdi} onChange={(v) => aggiorna('codiceSdi', v)} placeholder="0000000" help="Per fatturazione elettronica" />
            <div>
              <label className="block text-xs font-medium text-apple-darkgray mb-1">Regime fiscale</label>
              <select
                value={dati.regimeFiscale}
                onChange={(e) => aggiorna('regimeFiscale', e.target.value as DatiAziendali['regimeFiscale'])}
                className="w-full px-3 py-2 rounded-apple bg-gray-50 border border-gray-200 text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/40 focus:border-apple-blue transition-all"
              >
                <option value="ordinario">Ordinario</option>
                <option value="forfettario">Forfettario</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={salva}
            disabled={salvando}
            className="px-5 py-2 rounded-apple bg-apple-blue text-white text-sm font-medium hover:bg-apple-blue/90 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-apple"
          >
            {salvando ? 'Salvataggio…' : 'Salva modifiche'}
          </button>
        </div>
      </Card>

      <p className="text-[11px] text-apple-gray text-center">
        Sede operativa effettiva: {sedeOperativaEffettiva.indirizzo || '—'} {sedeOperativaEffettiva.citta || ''}
      </p>
    </>
  );
}

// ============ TAB FATTURAZIONE ============
function TabFatturazione({ registraSalva }: { registraSalva?: (fn: () => void, salvando: boolean) => void }) {
  const [config, setConfig] = useState<ConfigFatturazione>(FATTURAZIONE_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [messaggio, setMessaggio] = useState<{ tipo: 'ok' | 'errore'; testo: string } | null>(null);
  const [regimeDocumenti, setRegimeDocumenti] = useState<'fatture' | 'scontrini'>('fatture');
  const [cassaModalita, setCassaModalita] = useState<'digitale' | 'fisico'>('digitale');
  const [cassaGestioneGiornaliera, setCassaGestioneGiornaliera] = useState<boolean>(false);
  const [cassaFondoIniziale, setCassaFondoIniziale] = useState<number>(0);

  // Config fiscale modale
  const [showModaleConfig, setShowModaleConfig] = useState(false);
  const [regimeModale, setRegimeModale] = useState<RegimeFiscale>('fatture');

  useEffect(() => {
    async function carica() {
      try {
        const [c, d] = await Promise.all([
          caricaFatturazione(),
          caricaDatiAziendali(),
        ]);
        setConfig(c);
        setRegimeDocumenti(d.regimeDocumenti || 'fatture');
        setCassaModalita(d.cassaModalita || 'digitale');
        setCassaGestioneGiornaliera(d.cassaGestioneGiornaliera || false);
        setCassaFondoIniziale(d.cassaFondoIniziale || 0);
      } catch (err) {
        console.error('Errore caricamento fatturazione:', err);
        setMessaggio({ tipo: 'errore', testo: 'Errore nel caricamento.' });
      } finally {
        setLoading(false);
      }
    }
    carica();
  }, []);

  const salva = useCallback(async () => {
    setSalvando(true);
    setMessaggio(null);
    try {
      await salvaFatturazione(config);

      // Salva anche il regime documenti nei dati aziendali
      const datiAttuali = await caricaDatiAziendali();
      await salvaDatiAziendali({
        ...datiAttuali,
        regimeDocumenti,
        cassaModalita,
        cassaGestioneGiornaliera,
        cassaFondoIniziale,
      });
      invalidaCacheDatiAziendali();

      setMessaggio({ tipo: 'ok', testo: 'Configurazione salvata.' });
      setTimeout(() => setMessaggio(null), 3000);
    } catch (err) {
      console.error('Errore salvataggio fatturazione:', err);
      setMessaggio({ tipo: 'errore', testo: 'Errore nel salvataggio. Riprova.' });
    } finally {
      setSalvando(false);
    }
  }, [config, regimeDocumenti, cassaModalita, cassaGestioneGiornaliera, cassaFondoIniziale]);

  useEffect(() => {
    if (registraSalva) {
      registraSalva(salva, salvando);
    }
  }, [salva, salvando, registraSalva]);

  function aggiorna<K extends keyof ConfigFatturazione>(campo: K, valore: ConfigFatturazione[K]) {
    setConfig((c) => ({ ...c, [campo]: valore }));
  }

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12 gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-apple-blue border-t-transparent animate-spin" />
          <p className="text-sm text-apple-gray">Caricamento…</p>
        </div>
      </Card>
    );
  }

  return (
    <>
      {messaggio && (
        <div
          className={`px-4 py-3 rounded-apple text-sm flex items-center gap-2 ${
            messaggio.tipo === 'ok'
              ? 'bg-green-50 text-green-700 border border-green-100'
              : 'bg-red-50 text-red-600 border border-red-100'
          }`}
        >
          <span>{messaggio.tipo === 'ok' ? '✅' : '⚠️'}</span>
          {messaggio.testo}
        </div>
      )}

      <Card
        title="📋 Regime Documenti"
        subtitle="Scegli cosa emetti: fatture/DDT oppure scontrini (Cassa Fiscale)."
      >
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              setRegimeDocumenti('fatture');
              setRegimeModale('fatture');
              setShowModaleConfig(true);
            }}
            className={`w-full text-left px-4 py-3 rounded-apple border-2 transition-all ${
              regimeDocumenti === 'fatture'
                ? 'bg-blue-50 border-apple-blue shadow-sm'
                : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-apple-darkgray">
                  📄 Regime Fatture
                </p>
                <p className="text-xs text-apple-gray mt-0.5">
                  Emetti Fatture e DDT dai Percorsi. Cassa Fiscale nascosta.
                </p>
              </div>
              {regimeDocumenti === 'fatture' && (
                <span className="text-apple-blue text-xl shrink-0">✓</span>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setRegimeDocumenti('scontrini');
              setRegimeModale('scontrini_digitale');
              setShowModaleConfig(true);
            }}
            className={`w-full text-left px-4 py-3 rounded-apple border-2 transition-all ${
              regimeDocumenti === 'scontrini'
                ? 'bg-amber-50 border-amber-500 shadow-sm'
                : 'bg-white border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-apple-darkgray">
                  🧾 Regime Scontrini
                </p>
                <p className="text-xs text-apple-gray mt-0.5">
                  Emetti scontrini fiscali dai Percorsi. Fatture e DDT nascosti.
                </p>
              </div>
              {regimeDocumenti === 'scontrini' && (
                <span className="text-amber-500 text-xl shrink-0">✓</span>
              )}
            </div>
          </button>

          <div className="p-3 rounded-apple bg-gray-50 border border-gray-200 text-xs text-apple-gray">
            ⚠️ <strong>Attenzione:</strong> cambiando regime, la <strong>Sidebar</strong> si aggiornerà automaticamente.
            Le fatture/scontrini già emessi resteranno visibili nei rispettivi archivi.
          </div>
        </div>
      </Card>

      {regimeDocumenti === 'scontrini' && (
        <Card
          title="🧾 Modalità Cassa"
          subtitle="Come emetti gli scontrini: digitale (cloud) o fisico (RT RCH/Epson)."
        >
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                setCassaModalita('digitale');
                setRegimeModale('scontrini_digitale');
                setShowModaleConfig(true);
              }}
              className={`w-full text-left px-4 py-3 rounded-apple border-2 transition-all ${
                cassaModalita === 'digitale'
                  ? 'bg-blue-50 border-apple-blue shadow-sm'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-apple-darkgray">
                    📱 Scontrino Digitale (Cloud)
                  </p>
                  <p className="text-xs text-apple-gray mt-0.5">
                    Nessun hardware. PDF via email/WhatsApp. Chiusura giornaliera opzionale.
                  </p>
                </div>
                {cassaModalita === 'digitale' && (
                  <span className="text-apple-blue text-xl shrink-0">✓</span>
                )}
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setCassaModalita('fisico');
                setCassaGestioneGiornaliera(true);
                setRegimeModale('scontrini_fisico');
                setShowModaleConfig(true);
              }}
              className={`w-full text-left px-4 py-3 rounded-apple border-2 transition-all ${
                cassaModalita === 'fisico'
                  ? 'bg-amber-50 border-amber-500 shadow-sm'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-apple-darkgray">
                    🖨️ Scontrino Fisico (RT RCH/Epson)
                  </p>
                  <p className="text-xs text-apple-gray mt-0.5">
                    Richiede stampante fiscale in rete. Apertura/chiusura giornaliera obbligatoria.
                  </p>
                </div>
                {cassaModalita === 'fisico' && (
                  <span className="text-amber-500 text-xl shrink-0">✓</span>
                )}
              </div>
            </button>

            {cassaModalita === 'fisico' && (
              <div className="mt-3 space-y-3 p-3 rounded-apple bg-amber-50/60 border border-amber-200">
                <div className="flex items-start justify-between gap-4 py-1">
                  <div className="flex-1">
                    <p className="text-xs font-bold text-apple-darkgray">
                      Apertura/Chiusura giornaliera
                    </p>
                    <p className="text-[11px] text-apple-gray mt-0.5">
                      Obbligatoria per RT fiscale. Traccia incassi attesi vs reali.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCassaGestioneGiornaliera(!cassaGestioneGiornaliera)}
                    className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${
                      cassaGestioneGiornaliera ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${
                        cassaGestioneGiornaliera ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-apple-darkgray mb-1">
                    Fondo cassa iniziale (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cassaFondoIniziale}
                    onChange={(e) => setCassaFondoIniziale(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400"
                  />
                  <p className="text-[10px] text-apple-gray mt-1">
                    Importo in cassa all'apertura del turno (contanti per resto).
                  </p>
                </div>
              </div>
            )}

            <div className="p-3 rounded-apple bg-gray-50 border border-gray-200 text-xs text-apple-gray">
              💡 <strong>Nota:</strong> le impostazioni della Cassa vengono applicate alla prossima
              emissione. Le configurazioni hardware (IP stampante, ecc.) verranno richieste in un
              secondo momento.
            </div>
          </div>
        </Card>
      )}
      <Card
        title="Studio Commercialista"
        subtitle="Recapiti del commercialista per l'invio automatico dei report DDT e delle fatture."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-apple-darkgray mb-1">
              Email Commercialista *
            </label>
            <input
              type="email"
              value={config.emailCommercialista || ''}
              onChange={(e) => aggiorna('emailCommercialista', e.target.value)}
              placeholder="es. commercialista@studiorossi.it"
              className="w-full px-3 py-2 rounded-apple bg-gray-50 border border-gray-200 text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/40 focus:border-apple-blue transition-all"
            />
            <p className="text-[11px] text-apple-gray mt-1">
              A questo indirizzo verranno spediti i report mensili DDT e riepiloghi contabili.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-apple-darkgray mb-1">
              Nome Studio o Dottore Commercialista
            </label>
            <input
              type="text"
              value={config.nomeCommercialista || ''}
              onChange={(e) => aggiorna('nomeCommercialista', e.target.value)}
              placeholder="es. Studio Dott. Rossi"
              className="w-full px-3 py-2 rounded-apple bg-gray-50 border border-gray-200 text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/40 focus:border-apple-blue transition-all"
            />
          </div>
        </div>
      </Card>

      <Card
        title="Metodo di pagamento"
        subtitle="Verrà pre-selezionato quando marchi una fattura come pagata."
      >
        <div>
          <label className="block text-xs font-medium text-apple-darkgray mb-1">
            Metodo pagamento predefinito
          </label>
          <select
            value={config.metodoPagamentoDefault}
            onChange={(e) =>
              aggiorna('metodoPagamentoDefault', e.target.value as ConfigFatturazione['metodoPagamentoDefault'])
            }
            className="w-full px-3 py-2 rounded-apple bg-gray-50 border border-gray-200 text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/40 focus:border-apple-blue transition-all"
          >
            <option value="">— Nessun default —</option>
            <option value="Bonifico">🏦 Bonifico</option>
            <option value="Carta">💳 Carta</option>
            <option value="Bancomat">💳 Bancomat</option>
            <option value="Contanti">💵 Contanti</option>
            <option value="Non richiesto">🚫 Non richiesto</option>
          </select>
          <p className="text-[11px] text-apple-gray mt-1">
            Usa <strong>Non richiesto</strong> per registrare fatture a importo 0,00 (es. Check-up gratuiti, omaggi).
          </p>
        </div>
      </Card>

      <Card
        title="Numerazione"
        subtitle="Prefissi e numerazione automatica delle fatture e proforma."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo
              label="Prefisso fattura"
              value={config.prefissoFattura}
              onChange={(v) => aggiorna('prefissoFattura', v)}
              placeholder="es. FT-"
              help="Comparirà prima del numero fattura"
            />
            <Campo
              label="Prefisso proforma"
              value={config.prefissoProforma}
              onChange={(v) => aggiorna('prefissoProforma', v)}
              placeholder="es. PR-"
              help="Comparirà prima del numero proforma"
            />
          </div>

          <Toggle
            label="Numerazione automatica"
            description="Se attivo, il sistema calcola in automatico il prossimo numero progressivo."
            checked={config.numerazioneAutomatica}
            onChange={(v) => aggiorna('numerazioneAutomatica', v)}
          />
        </div>
      </Card>

      <Card
        title="Valori predefiniti"
        subtitle="IVA e scadenza applicati di default alle nuove fatture."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-apple-darkgray mb-1">
              IVA predefinita (%)
            </label>
            <select
              value={config.ivaDefault}
              onChange={(e) => aggiorna('ivaDefault', Number(e.target.value))}
              className="w-full px-3 py-2 rounded-apple bg-gray-50 border border-gray-200 text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/40 focus:border-apple-blue transition-all"
            >
              <option value={22}>22%</option>
              <option value={10}>10%</option>
              <option value={4}>4%</option>
              <option value={0}>0% (esente / non imponibile)</option>
            </select>
          </div>
          <Campo
            label="Giorni di scadenza"
            type="number"
            value={String(config.giorniScadenza)}
            onChange={(v) => aggiorna('giorniScadenza', Number(v) || 0)}
            placeholder="30"
            help="Giorni per il calcolo automatico della data scadenza"
          />
        </div>
      </Card>

      <div className="flex justify-end">
        <button
          onClick={salva}
          disabled={salvando}
          className="px-5 py-2 rounded-apple bg-apple-blue text-white text-sm font-medium hover:bg-apple-blue/90 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-apple"
        >
          {salvando ? 'Salvataggio…' : 'Salva modifiche'}
        </button>
      </div>

      {/* Modale Config Fiscale */}
      {showModaleConfig && (
        <ModaleConfigFiscale
          regime={regimeModale}
          onClose={() => setShowModaleConfig(false)}
          onSaved={() => setShowModaleConfig(false)}
        />
      )}
    </>
  );
}

// ============ TAB PROFILO ============
const COLORI_AVATAR = [
  { value: '#007AFF', label: 'Blu' },
  { value: '#34C759', label: 'Verde' },
  { value: '#FF9500', label: 'Arancio' },
  { value: '#FF3B30', label: 'Rosso' },
  { value: '#AF52DE', label: 'Viola' },
  { value: '#5856D6', label: 'Indaco' },
  { value: '#FF2D55', label: 'Rosa' },
  { value: '#000000', label: 'Nero' },
];

function TabProfilo() {
  const { user, cambiaPassword, esciDaTutti } = useAuth();
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const [caricandoFoto, setCaricandoFoto] = useState(false);
  const [modificaAttiva, setModificaAttiva] = useState(false);
  const [modificaNome, setModificaNome] = useState('');
  const [coloreAvatar, setColoreAvatar] = useState('#007AFF');
  const [salvandoProfilo, setSalvandoProfilo] = useState(false);
  const [messaggioProfilo, setMessaggioProfilo] = useState<{ tipo: 'ok' | 'errore'; testo: string } | null>(null);

  const [attuale, setAttuale] = useState('');
  const [nuova, setNuova] = useState('');
  const [conferma, setConferma] = useState('');
  const [mostraPwd, setMostraPwd] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [messaggio, setMessaggio] = useState<{ tipo: 'ok' | 'errore'; testo: string } | null>(null);

  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? 'Utente';
  const avatarColor = (user?.user_metadata?.avatar_color as string | undefined) ?? '#007AFF';
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const iniziale = fullName.trim().charAt(0).toUpperCase() || (user?.email?.charAt(0).toUpperCase() ?? '?');

  async function handleUploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setMessaggioProfilo({ tipo: 'errore', testo: 'Foto troppo grande (max 2 MB)' });
      return;
    }
    if (!file.type.startsWith('image/')) {
      setMessaggioProfilo({ tipo: 'errore', testo: "Il file deve essere un'immagine JPG o PNG" });
      return;
    }

    setCaricandoFoto(true);
    setMessaggioProfilo(null);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const pathStorage = `avatar-${user?.id || 'user'}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(pathStorage, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(pathStorage);
      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });
      if (updateError) throw updateError;

      setMessaggioProfilo({ tipo: 'ok', testo: 'Foto profilo aggiornata!' });
      setTimeout(() => setMessaggioProfilo(null), 3000);
    } catch (err: any) {
      setMessaggioProfilo({ tipo: 'errore', testo: err.message || 'Errore caricamento foto' });
    } finally {
      setCaricandoFoto(false);
      if (inputFotoRef.current) inputFotoRef.current.value = '';
    }
  }

  async function handleRimuoviAvatar() {
    if (!confirm('Rimuovere la foto profilo?')) return;
    try {
      const { error } = await supabase.auth.updateUser({ data: { avatar_url: null } });
      if (error) throw error;
      setMessaggioProfilo({ tipo: 'ok', testo: 'Foto rimossa.' });
      setTimeout(() => setMessaggioProfilo(null), 3000);
    } catch (err: any) {
      setMessaggioProfilo({ tipo: 'errore', testo: err.message || 'Errore rimozione foto' });
    }
  }

  async function handleSalvaProfilo() {
    if (!modificaNome.trim()) return;
    setSalvandoProfilo(true);
    setMessaggioProfilo(null);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: modificaNome.trim(),
          avatar_color: coloreAvatar,
        },
      });
      if (error) throw error;
      setMessaggioProfilo({ tipo: 'ok', testo: 'Profilo salvato correttamente!' });
      setTimeout(() => {
        setModificaAttiva(false);
        setMessaggioProfilo(null);
      }, 1500);
    } catch (err: any) {
      setMessaggioProfilo({ tipo: 'errore', testo: err.message || 'Errore salvataggio profilo' });
    } finally {
      setSalvandoProfilo(false);
    }
  }

  async function handleCambiaPassword() {
    setMessaggio(null);
    if (!attuale || !nuova || !conferma) {
      setMessaggio({ tipo: 'errore', testo: 'Compila tutti i campi.' });
      return;
    }
    if (nuova !== conferma) {
      setMessaggio({ tipo: 'errore', testo: 'Le nuove password non coincidono.' });
      return;
    }
    if (nuova.length < 8) {
      setMessaggio({ tipo: 'errore', testo: 'La nuova password deve avere almeno 8 caratteri.' });
      return;
    }
    if (nuova === attuale) {
      setMessaggio({ tipo: 'errore', testo: 'La nuova password deve essere diversa da quella attuale.' });
      return;
    }

    setSalvando(true);
    const { error } = await cambiaPassword(attuale, nuova);
    setSalvando(false);

    if (error) {
      setMessaggio({ tipo: 'errore', testo: error });
      return;
    }

    setAttuale('');
    setNuova('');
    setConferma('');
    setMessaggio({ tipo: 'ok', testo: 'Password aggiornata correttamente.' });
    setTimeout(() => setMessaggio(null), 4000);
  }

  async function handleEsciDaTutti() {
    if (!confirm('Vuoi uscire da TUTTI i dispositivi? Dovrai rifare il login ovunque.')) return;
    await esciDaTutti();
  }

  const ultimoAccesso = user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <>
      {messaggio && (
        <div
          className={`px-4 py-3 rounded-apple text-sm flex items-center gap-2 ${
            messaggio.tipo === 'ok'
              ? 'bg-green-50 text-green-700 border border-green-100'
              : 'bg-red-50 text-red-600 border border-red-100'
          }`}
        >
          <span>{messaggio.tipo === 'ok' ? '✅' : '⚠️'}</span>
          {messaggio.testo}
        </div>
      )}

      {/* CARD 1: ACCOUNT CON AVATAR E FOTO PROFILO */}
      <Card title="Account & Profilo" subtitle="Personalizza la tua foto profilo, l'avatar Apple e il nome visualizzato">
        <div className="space-y-4">
          <div className="flex items-center gap-4 px-4 py-3 rounded-apple bg-apple-lightgray/60 flex-wrap">
            <div className="relative shrink-0 group">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="w-16 h-16 rounded-full object-cover shadow-apple border-2 border-white"
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-full text-white flex items-center justify-center text-2xl font-bold shadow-apple"
                  style={{ background: avatarColor }}
                >
                  {iniziale}
                </div>
              )}
              <button
                type="button"
                onClick={() => inputFotoRef.current?.click()}
                disabled={caricandoFoto}
                className="absolute inset-0 rounded-full bg-black/40 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center font-medium"
                title="Cambia foto"
              >
                {caricandoFoto ? '⏳' : '📷'}
              </button>
              <input
                ref={inputFotoRef}
                type="file"
                accept="image/*"
                onChange={handleUploadAvatar}
                className="hidden"
              />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-apple-darkgray truncate">
                {fullName}
              </p>
              <p className="text-xs text-apple-gray truncate">{user?.email ?? ''}</p>
              <p className="text-[11px] text-apple-blue font-semibold mt-0.5">
                {user?.email === 'righetti@righetti.club' ? '👑 Amministratore / Titolare' : 'Operatore Studio'}
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => inputFotoRef.current?.click()}
                disabled={caricandoFoto}
                className="px-3.5 py-1.5 rounded-apple bg-white border border-gray-200 text-xs font-semibold text-apple-darkgray hover:bg-apple-lightgray transition-colors disabled:opacity-50 shadow-sm"
              >
                {caricandoFoto ? '⏳ Caricamento...' : '📷 Foto'}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleRimuoviAvatar}
                  className="px-3 py-1.5 rounded-apple bg-white border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                  title="Rimuovi foto profilo"
                >
                  🗑️ Rimuovi
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setModificaNome(fullName);
                  setColoreAvatar(avatarColor);
                  setModificaAttiva(!modificaAttiva);
                }}
                className="px-3.5 py-1.5 rounded-apple bg-white border border-gray-200 text-xs font-semibold text-apple-darkgray hover:bg-apple-lightgray transition-colors shadow-sm"
              >
                ✏️ Modifica
              </button>
            </div>
          </div>

          {/* Form modifica nome + colore avatar Apple */}
          {modificaAttiva && (
            <div className="px-4 py-3.5 rounded-apple bg-blue-50/60 border border-blue-100 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-apple-darkgray mb-1">
                  Nome e Cognome visualizzato
                </label>
                <input
                  type="text"
                  value={modificaNome}
                  onChange={(e) => setModificaNome(e.target.value)}
                  placeholder="Es. Luca Righetti"
                  className="w-full px-3 py-2 rounded-apple bg-white border border-gray-200 text-sm text-apple-darkgray focus:outline-none focus:border-apple-blue transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-apple-darkgray mb-1.5">
                  Colore Avatar (stile Apple)
                </label>
                <div className="flex gap-2 flex-wrap">
                  {COLORI_AVATAR.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColoreAvatar(c.value)}
                      className={`w-7 h-7 rounded-full transition-all ${
                        coloreAvatar === c.value ? 'ring-2 ring-offset-2 ring-apple-blue scale-110' : 'hover:scale-105'
                      }`}
                      style={{ background: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setModificaAttiva(false)}
                  className="px-3.5 py-1.5 rounded-apple bg-white border border-gray-200 text-xs font-medium text-apple-darkgray hover:bg-apple-lightgray transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleSalvaProfilo}
                  disabled={salvandoProfilo || !modificaNome.trim()}
                  className="px-4 py-1.5 rounded-apple bg-apple-blue text-white text-xs font-semibold shadow-apple hover:bg-blue-600 disabled:opacity-50 transition-colors"
                >
                  {salvandoProfilo ? 'Salvataggio...' : '💾 Salva'}
                </button>
              </div>
            </div>
          )}

          {messaggioProfilo && (
            <div
              className={`px-4 py-2.5 rounded-apple text-xs font-medium flex items-center gap-2 ${
                messaggioProfilo.tipo === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'
              }`}
            >
              <span>{messaggioProfilo.tipo === 'ok' ? '✅' : '⚠️'}</span>
              <span>{messaggioProfilo.testo}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-apple bg-gray-50 border border-gray-200/60 text-xs">
              <span className="text-apple-gray block text-[10px] uppercase font-semibold">Account creato il</span>
              <span className="text-apple-darkgray font-medium mt-0.5 block">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('it-IT') : '—'}
              </span>
            </div>
            <div className="p-3 rounded-apple bg-gray-50 border border-gray-200/60 text-xs">
              <span className="text-apple-gray block text-[10px] uppercase font-semibold">ID Utente</span>
              <span className="text-apple-gray font-mono text-[10px] truncate block mt-0.5">
                {user?.id ?? '—'}
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Cambia password" subtitle="Scegli una password sicura (almeno 8 caratteri).">
        <div className="space-y-3">
          <Campo
            label="Password attuale"
            type={mostraPwd ? 'text' : 'password'}
            value={attuale}
            onChange={setAttuale}
            placeholder="••••••••"
          />
          <Campo
            label="Nuova password"
            type={mostraPwd ? 'text' : 'password'}
            value={nuova}
            onChange={setNuova}
            placeholder="Minimo 8 caratteri"
          />
          <Campo
            label="Conferma nuova password"
            type={mostraPwd ? 'text' : 'password'}
            value={conferma}
            onChange={setConferma}
            placeholder="Ripeti la nuova password"
          />
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setMostraPwd((v) => !v)}
              className="text-xs text-apple-blue hover:text-blue-700 font-medium"
            >
              {mostraPwd ? '🙈 Nascondi password' : '👁️ Mostra password'}
            </button>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={handleCambiaPassword}
            disabled={salvando}
            className="px-5 py-2 rounded-apple bg-apple-blue text-white text-sm font-medium hover:bg-apple-blue/90 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-apple"
          >
            {salvando ? 'Aggiornamento…' : 'Cambia password'}
          </button>
        </div>
      </Card>

      <Card title="Sicurezza" subtitle="Gestisci le sessioni attive sui tuoi dispositivi.">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-apple-darkgray">Esci da tutti i dispositivi</p>
            <p className="text-xs text-apple-gray mt-0.5">
              Verranno chiuse tutte le sessioni attive su qualsiasi dispositivo. Dovrai
              effettuare di nuovo il login.
            </p>
          </div>
          <button
            onClick={handleEsciDaTutti}
            className="shrink-0 px-4 py-2 rounded-apple bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition-colors"
          >
            Esci ovunque
          </button>
        </div>
      </Card>
    </>
  );
}

// ============ TAB PRIVACY ============
function TabPrivacy({ registraSalva }: { registraSalva?: (fn: () => void, salvando: boolean) => void }) {
  const [config, setConfig] = useState<ConfigPrivacy>(PRIVACY_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [messaggio, setMessaggio] = useState<{ tipo: 'ok' | 'errore'; testo: string } | null>(null);

  useEffect(() => {
    async function carica() {
      try {
        const c = await caricaPrivacy();
        setConfig(c);
      } catch (err) {
        console.error('Errore caricamento privacy:', err);
        setMessaggio({ tipo: 'errore', testo: 'Errore nel caricamento.' });
      } finally {
        setLoading(false);
      }
    }
    carica();
  }, []);

  const salva = useCallback(async () => {
    setSalvando(true);
    setMessaggio(null);
    try {
      await salvaPrivacy(config);
      invalidaCachePrivacy();
      setMessaggio({ tipo: 'ok', testo: 'Configurazione privacy salvata.' });
      setTimeout(() => setMessaggio(null), 3000);
    } catch (err) {
      console.error('Errore salvataggio privacy:', err);
      setMessaggio({ tipo: 'errore', testo: 'Errore nel salvataggio. Riprova.' });
    } finally {
      setSalvando(false);
    }
  }, [config]);

  useEffect(() => {
    if (registraSalva) {
      registraSalva(salva, salvando);
    }
  }, [salva, salvando, registraSalva]);

  function aggiorna<K extends keyof ConfigPrivacy>(campo: K, valore: ConfigPrivacy[K]) {
    setConfig((c) => ({ ...c, [campo]: valore }));
  }

  function ripristinaTestoDefault() {
    if (confirm('Vuoi ripristinare il testo informativa di default? Le modifiche non salvate andranno perse.')) {
      aggiorna('testoInformativa', INFORMATIVA_DEFAULT);
    }
  }

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12 gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-apple-blue border-t-transparent animate-spin" />
          <p className="text-sm text-apple-gray">Caricamento…</p>
        </div>
      </Card>
    );
  }

  return (
    <>
      {messaggio && (
        <div
          className={`px-4 py-3 rounded-apple text-sm flex items-center gap-2 ${
            messaggio.tipo === 'ok'
              ? 'bg-green-50 text-green-700 border border-green-100'
              : 'bg-red-50 text-red-600 border border-red-100'
          }`}
        >
          <span>{messaggio.tipo === 'ok' ? '✅' : '⚠️'}</span>
          {messaggio.testo}
        </div>
      )}

      <Card
        title="Informativa privacy"
        subtitle="Testo che i clienti leggono e firmano sull'iPad. Il punto 7 (Titolare) si compila automaticamente con i dati aziendali."
      >
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium text-apple-darkgray">
              Testo dell'informativa (GDPR)
            </label>
            <button
              type="button"
              onClick={ripristinaTestoDefault}
              className="text-xs text-apple-blue hover:text-blue-700 font-medium"
            >
              ↩️ Ripristina default
            </button>
          </div>
          <textarea
            value={config.testoInformativa}
            onChange={(e) => aggiorna('testoInformativa', e.target.value)}
            rows={20}
            className="w-full px-3 py-2 rounded-apple bg-gray-50 border border-gray-200 text-apple-darkgray text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-apple-blue/40 focus:border-apple-blue transition-all resize-y"
          />
          <p className="text-[11px] text-apple-gray mt-1">
            {config.testoInformativa.length} caratteri
          </p>
        </div>
      </Card>

      <Card
        title="Firma digitale"
        subtitle="Gestisci la raccolta firme dei clienti per il consenso privacy."
      >
        <div className="space-y-1">
          <Toggle
            label="Richiedi firma privacy ai nuovi clienti"
            description="Se attivo, ogni nuovo cliente deve firmare l'informativa GDPR."
            checked={config.richiediFirma}
            onChange={(v) => aggiorna('richiediFirma', v)}
          />
          <Toggle
            label="Conserva il PDF firmato"
            description="Salva una copia del PDF firmato nello storage dell'azienda."
            checked={config.conservaPdfFirmato}
            onChange={(v) => aggiorna('conservaPdfFirmato', v)}
          />
        </div>
      </Card>

      <Card
        title="Conservazione dati"
        subtitle="Per quanto tempo conservare i dati dei clienti (GDPR + fiscale)."
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-apple-darkgray mb-1">
              Giorni di conservazione
            </label>
            <select
              value={config.giorniConservazione}
              onChange={(e) => aggiorna('giorniConservazione', Number(e.target.value))}
              className="w-full px-3 py-2 rounded-apple bg-gray-50 border border-gray-200 text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/40 focus:border-apple-blue transition-all"
            >
              <option value={365}>1 anno (365 giorni)</option>
              <option value={730}>2 anni (730 giorni)</option>
              <option value={1825}>5 anni (1825 giorni)</option>
              <option value={3650}>10 anni (3650 giorni) — consigliato fiscale</option>
            </select>
          </div>

          <Toggle
            label="Avvisa prima della scadenza"
            description="Ricevi un avviso quando i dati di un cliente stanno per essere cancellati."
            checked={config.avvisaScadenza}
            onChange={(v) => aggiorna('avvisaScadenza', v)}
          />
        </div>
      </Card>

      <div className="flex justify-end">
        <button
          onClick={salva}
          disabled={salvando}
          className="px-5 py-2 rounded-apple bg-apple-blue text-white text-sm font-medium hover:bg-apple-blue/90 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-apple"
        >
          {salvando ? 'Salvataggio…' : 'Salva modifiche'}
        </button>
      </div>

          </>
  );
}

// ============ TAB ASPETTO ============
function TabAspetto({ registraSalva }: { registraSalva?: (fn: () => void, salvando: boolean) => void }) {
  const [config, setConfig] = useState<ConfigAspetto>(ASPETTO_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [messaggio, setMessaggio] = useState<{ tipo: 'ok' | 'errore'; testo: string } | null>(null);

  useEffect(() => {
    async function carica() {
      try {
        const c = await caricaAspetto();
        setConfig(c);
      } catch (err) {
        console.error('Errore caricamento aspetto:', err);
        setMessaggio({ tipo: 'errore', testo: 'Errore nel caricamento.' });
      } finally {
        setLoading(false);
      }
    }
    carica();
  }, []);

  const salva = useCallback(async () => {
    setSalvando(true);
    setMessaggio(null);
    try {
      await salvaAspetto(config);
      invalidaCacheAspetto();
      setMessaggio({ tipo: 'ok', testo: 'Preferenze salvate.' });
      setTimeout(() => setMessaggio(null), 3000);
    } catch (err) {
      console.error('Errore salvataggio aspetto:', err);
      setMessaggio({ tipo: 'errore', testo: 'Errore nel salvataggio. Riprova.' });
    } finally {
      setSalvando(false);
    }
  }, [config]);

  useEffect(() => {
    if (registraSalva) {
      registraSalva(salva, salvando);
    }
  }, [salva, salvando, registraSalva]);

  function aggiorna<K extends keyof ConfigAspetto>(campo: K, valore: ConfigAspetto[K]) {
    setConfig((c) => ({ ...c, [campo]: valore }));
  }

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12 gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-apple-blue border-t-transparent animate-spin" />
          <p className="text-sm text-apple-gray">Caricamento…</p>
        </div>
      </Card>
    );
  }

  return (
    <>
      {messaggio && (
        <div
          className={`px-4 py-3 rounded-apple text-sm flex items-center gap-2 ${
            messaggio.tipo === 'ok'
              ? 'bg-green-50 text-green-700 border border-green-100'
              : 'bg-red-50 text-red-600 border border-red-100'
          }`}
        >
          <span>{messaggio.tipo === 'ok' ? '✅' : '⚠️'}</span>
          {messaggio.testo}
        </div>
      )}

      <Card title="Aspetto" subtitle="Tema, lingua e valuta dell'applicazione.">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-apple-darkgray mb-1">Tema</label>
            <select
              value={config.tema}
              onChange={(e) => aggiorna('tema', e.target.value as ConfigAspetto['tema'])}
              className="w-full px-3 py-2 rounded-apple bg-gray-50 border border-gray-200 text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/40 focus:border-apple-blue transition-all"
            >
              <option value="auto">🌗 Auto (segue il sistema)</option>
              <option value="chiaro">☀️ Chiaro</option>
              <option value="scuro">🌙 Scuro</option>
            </select>
            <p className="text-[11px] text-apple-gray mt-1">
              ⚠️ Il tema scuro è in preparazione. Per ora l'app usa sempre il tema chiaro.
            </p>
          </div>

        </div>
      </Card>

      <div className="flex justify-end">
        <button
          onClick={salva}
          disabled={salvando}
          className="px-5 py-2 rounded-apple bg-apple-blue text-white text-sm font-medium hover:bg-apple-blue/90 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-apple"
        >
          {salvando ? 'Salvataggio…' : 'Salva preferenze'}
        </button>
      </div>
    </>
  );
}

// ============ TAB AGENDA ============
const GIORNI_SETTIMANA: { value: number; label: string; breve: string }[] = [
  { value: 1, label: 'Lunedì', breve: 'Lun' },
  { value: 2, label: 'Martedì', breve: 'Mar' },
  { value: 3, label: 'Mercoledì', breve: 'Mer' },
  { value: 4, label: 'Giovedì', breve: 'Gio' },
  { value: 5, label: 'Venerdì', breve: 'Ven' },
  { value: 6, label: 'Sabato', breve: 'Sab' },
  { value: 0, label: 'Domenica', breve: 'Dom' },
];

const COLORI_DISPONIBILI = [
  { id: 'blue', bg: 'bg-blue-500', label: 'Blu' },
  { id: 'green', bg: 'bg-green-500', label: 'Verde' },
  { id: 'orange', bg: 'bg-orange-500', label: 'Arancione' },
  { id: 'purple', bg: 'bg-purple-500', label: 'Viola' },
  { id: 'pink', bg: 'bg-pink-500', label: 'Rosa' },
  { id: 'yellow', bg: 'bg-yellow-500', label: 'Giallo' },
  { id: 'red', bg: 'bg-red-500', label: 'Rosso' },
  { id: 'gray', bg: 'bg-gray-500', label: 'Grigio' },
];

function TabAgenda({ registraSalva }: { registraSalva?: (fn: () => void, salvando: boolean) => void }) {
  const [config, setConfig] = useState<ConfigAgenda>(AGENDA_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [messaggio, setMessaggio] = useState<{ tipo: 'ok' | 'errore'; testo: string } | null>(null);
  const [servizi, setServizi] = useState<Servizio[]>([]);
  const [serviziLoading, setServiziLoading] = useState(true);
  const [nuovaCategoriaNome, setNuovaCategoriaNome] = useState('');

  const [nuovoOpNome, setNuovoOpNome] = useState('');
  const [nuovoOpRuolo, setNuovoOpRuolo] = useState('');
  const [nuovoOpColore, setNuovoOpColore] = useState('blue');

  // Modale orari giorno
  const [giornoModale, setGiornoModale] = useState<number | null>(null);
  const [fasceModale, setFasceModale] = useState<Fascia[]>([]);
  const [apertoModale, setApertoModale] = useState(false);

  useEffect(() => {
    async function carica() {
      try {
        const c = await caricaAgendaConfig();
        setConfig(c);
      } catch (err) {
        console.error('Errore caricamento agenda config:', err);
        setMessaggio({ tipo: 'errore', testo: 'Errore nel caricamento.' });
      } finally {
        setLoading(false);
      }
    }
    carica();
  }, []);

  useEffect(() => {
    async function caricaServizi() {
      try {
        const s = await getServizi();
        setServizi(s);
      } catch (err) {
        console.error('Errore caricamento servizi:', err);
      } finally {
        setServiziLoading(false);
      }
    }
    caricaServizi();
  }, []);

  const salva = useCallback(async () => {
    setSalvando(true);
    setMessaggio(null);
    try {
      await salvaAgendaConfig(config);
      invalidaCacheAgendaConfig();
      aggiornaCostantiAgenda(config);
      setMessaggio({ tipo: 'ok', testo: 'Configurazione agenda salvata.' });
      setTimeout(() => setMessaggio(null), 3000);
    } catch (err) {
      console.error('Errore salvataggio agenda:', err);
      setMessaggio({ tipo: 'errore', testo: 'Errore nel salvataggio. Riprova.' });
    } finally {
      setSalvando(false);
    }
  }, [config]);

  useEffect(() => {
    if (registraSalva) {
      registraSalva(salva, salvando);
    }
  }, [salva, salvando, registraSalva]);

  function aggiorna<K extends keyof ConfigAgenda>(campo: K, valore: ConfigAgenda[K]) {
    setConfig((c) => ({ ...c, [campo]: valore }));
  }

  function toggleGiorno(giorno: number) {
    setConfig((c) => {
      const set = new Set(c.giorniLavorativi);
      if (set.has(giorno)) set.delete(giorno);
      else set.add(giorno);
      return { ...c, giorniLavorativi: Array.from(set).sort() };
    });
  }

  // === Orari per giorno (fasce multiple) ===
  function getFasceGiorno(giorno: number): Fascia[] {
    const orari = config.orariGiorni?.[giorno];
    if (orari) return orari.fasce;
    // Fallback: se manca, usa orari globali + giorni lavorativi
    if (config.giorniLavorativi.includes(giorno)) {
      return [{ inizio: config.oraApertura, fine: config.oraChiusura }];
    }
    return [];
  }

  function isGiornoAperto(giorno: number): boolean {
    const orari = config.orariGiorni?.[giorno];
    if (orari) return orari.aperto;
    return config.giorniLavorativi.includes(giorno);
  }

  function toggleGiornoAperto(giorno: number) {
    setConfig((c) => {
      const nuovi = { ...(c.orariGiorni || {}) };
      const attuale = nuovi[giorno] || {
        aperto: c.giorniLavorativi.includes(giorno),
        fasce: c.giorniLavorativi.includes(giorno)
          ? [{ inizio: c.oraApertura, fine: c.oraChiusura }]
          : [],
      };
      if (attuale.aperto) {
        nuovi[giorno] = { aperto: false, fasce: [] };
      } else {
        nuovi[giorno] = {
          aperto: true,
          fasce: attuale.fasce.length > 0 ? attuale.fasce : [{ inizio: c.oraApertura, fine: c.oraChiusura }],
        };
      }
      // Sincronizza giorniLavorativi per backward compat
      const giorni = Object.entries(nuovi)
        .filter(([_, o]) => o.aperto)
        .map(([g]) => Number(g))
        .sort();
      return { ...c, orariGiorni: nuovi, giorniLavorativi: giorni };
    });
  }

  function cambiaFascia(giorno: number, indice: number, campo: 'inizio' | 'fine', valore: string) {
    setConfig((c) => {
      const nuovi = { ...(c.orariGiorni || {}) };
      const attuale = nuovi[giorno] || {
        aperto: c.giorniLavorativi.includes(giorno),
        fasce: [{ inizio: c.oraApertura, fine: c.oraChiusura }],
      };
      const fasce = [...attuale.fasce];
      fasce[indice] = { ...fasce[indice], [campo]: valore };
      nuovi[giorno] = { ...attuale, fasce };
      return { ...c, orariGiorni: nuovi };
    });
  }

  function aggiungiFascia(giorno: number) {
    setConfig((c) => {
      const nuovi = { ...(c.orariGiorni || {}) };
      const attuale = nuovi[giorno] || {
        aperto: c.giorniLavorativi.includes(giorno),
        fasce: [{ inizio: c.oraApertura, fine: c.oraChiusura }],
      };
      const ultima = attuale.fasce[attuale.fasce.length - 1];
      const nuovaFascia = ultima
        ? { inizio: ultima.fine, fine: ultima.fine }
        : { inizio: c.oraApertura, fine: c.oraChiusura };
      nuovi[giorno] = {
        aperto: true,
        fasce: [...attuale.fasce, nuovaFascia],
      };
      // Sincronizza giorniLavorativi
      const giorni = Object.entries(nuovi)
        .filter(([_, o]) => o.aperto)
        .map(([g]) => Number(g))
        .sort();
      return { ...c, orariGiorni: nuovi, giorniLavorativi: giorni };
    });
  }

  function rimuoviFascia(giorno: number, indice: number) {
    setConfig((c) => {
      const nuovi = { ...(c.orariGiorni || {}) };
      const attuale = nuovi[giorno];
      if (!attuale) return c;
      const fasce = attuale.fasce.filter((_, i) => i !== indice);
      if (fasce.length === 0) {
        nuovi[giorno] = { aperto: false, fasce: [] };
      } else {
        nuovi[giorno] = { ...attuale, fasce };
      }
      const giorni = Object.entries(nuovi)
        .filter(([_, o]) => o.aperto)
        .map(([g]) => Number(g))
        .sort();
      return { ...c, orariGiorni: nuovi, giorniLavorativi: giorni };
    });
  }

  // === Modale orari giorno ===
  function apriModaleGiorno(giorno: number) {
    const orari = config.orariGiorni?.[giorno];
    const aperto = orari?.aperto ?? config.giorniLavorativi.includes(giorno);
    const fasce = orari?.fasce && orari.fasce.length > 0
      ? orari.fasce
      : aperto
        ? [{ inizio: config.oraApertura, fine: config.oraChiusura }]
        : [];
    setFasceModale(fasce);
    setApertoModale(aperto);
    setGiornoModale(giorno);
  }

  function chiudiModaleGiorno() {
    setGiornoModale(null);
    setFasceModale([]);
    setApertoModale(false);
  }

  function salvaModaleGiorno() {
    if (giornoModale === null) return;
    // Valida: se aperto, deve avere almeno una fascia valida
    if (apertoModale && fasceModale.length === 0) {
      alert('Aggiungi almeno una fascia oraria per aprire il giorno.');
      return;
    }
    // Valida: inizio < fine per ogni fascia
    for (const f of fasceModale) {
      if (f.inizio >= f.fine) {
        alert(`Fascia non valida: ${f.inizio} → ${f.fine}. L'orario di fine deve essere dopo quello di inizio.`);
        return;
      }
    }
    setConfig((c) => {
      const nuovi = { ...(c.orariGiorni || {}) };
      nuovi[giornoModale] = {
        aperto: apertoModale,
        fasce: apertoModale ? fasceModale : [],
      };
      const giorni = Object.entries(nuovi)
        .filter(([_, o]) => o.aperto)
        .map(([g]) => Number(g))
        .sort();
      return { ...c, orariGiorni: nuovi, giorniLavorativi: giorni };
    });
    chiudiModaleGiorno();
  }

  function aggiungiFasciaModale() {
    const ultima = fasceModale[fasceModale.length - 1];
    const nuova = ultima
      ? { inizio: ultima.fine, fine: ultima.fine }
      : { inizio: config.oraApertura, fine: config.oraChiusura };
    setFasceModale((f) => [...f, nuova]);
  }

  function rimuoviFasciaModale(indice: number) {
    setFasceModale((f) => f.filter((_, i) => i !== indice));
  }

  function cambiaFasciaModale(indice: number, campo: 'inizio' | 'fine', valore: string) {
    setFasceModale((f) =>
      f.map((fascia, i) => (i === indice ? { ...fascia, [campo]: valore } : fascia))
    );
  }

  function riepilogoGiorno(giorno: number): string {
    const orari = config.orariGiorni?.[giorno];
    const aperto = orari?.aperto ?? config.giorniLavorativi.includes(giorno);
    if (!aperto) return 'Chiuso';
    const fasce = orari?.fasce && orari.fasce.length > 0
      ? orari.fasce
      : [{ inizio: config.oraApertura, fine: config.oraChiusura }];
    if (fasce.length === 1) {
      return `${fasce[0].inizio}-${fasce[0].fine}`;
    }
    if (fasce.length <= 2) {
      return fasce.map((f) => `${f.inizio}-${f.fine}`).join(' · ');
    }
    return `${fasce[0].inizio}-${fasce[0].fine} · +${fasce.length - 1}`;
  }

  function toggleOperatore(opId: string) {
    setConfig((c) => {
      const set = new Set(c.operatoriVisibili);
      if (set.has(opId)) {
        if (set.size <= 1) return c;
        set.delete(opId);
      } else {
        set.add(opId);
      }
      return { ...c, operatoriVisibili: Array.from(set) };
    });
  }

  function aggiungiOperatore() {
    const nome = nuovoOpNome.trim();
    if (!nome) return;
    const nuovo: OperatoreConfig = {
      id: generaIdOperatore(nome),
      label: nome,
      ruolo: nuovoOpRuolo.trim() || 'Operatore',
      colore: nuovoOpColore,
    };
    setConfig((c) => ({
      ...c,
      operatori: [...(c.operatori || []), nuovo],
      operatoriVisibili: [...c.operatoriVisibili, nuovo.id],
    }));
    setNuovoOpNome('');
    setNuovoOpRuolo('');
    setNuovoOpColore('blue');
  }

  function rimuoviOperatore(id: string) {
    if (config.operatori.length <= 1) {
      alert('Non puoi eliminare tutti gli operatori. Deve essercene almeno uno.');
      return;
    }
    if (!confirm('Rimuovere questo operatore dall’elenco?')) return;
    setConfig((c) => ({
      ...c,
      operatori: c.operatori.filter((o) => o.id !== id),
      operatoriVisibili: c.operatoriVisibili.filter((oId) => oId !== id),
    }));
  }

  function cambiaColoreOperatore(id: string, colore: string) {
    setConfig((c) => ({
      ...c,
      operatori: c.operatori.map((o) => (o.id === id ? { ...o, colore } : o)),
    }));
  }

  function cambiaLabelOperatore(id: string, label: string) {
    setConfig((c) => ({
      ...c,
      operatori: c.operatori.map((o) => (o.id === id ? { ...o, label } : o)),
    }));
  }

  function cambiaRuoloOperatore(id: string, ruolo: string) {
    setConfig((c) => ({
      ...c,
      operatori: c.operatori.map((o) => (o.id === id ? { ...o, ruolo } : o)),
    }));
  }

  function aggiungiCategoria() {
    const nome = nuovaCategoriaNome.trim();
    if (!nome) return;
    const nuova: CategoriaServizio = {
      id: generaIdCategoria(),
      nome,
      colore: 'blue',
    };
    aggiorna('categorie', [...config.categorie, nuova]);
    setNuovaCategoriaNome('');
  }

  function rimuoviCategoria(id: string) {
    if (!confirm('Rimuovere questa categoria? I servizi assegnati torneranno al colore di default.')) return;
    const nuoveCategorie = config.categorie.filter((c) => c.id !== id);
    const nuovoMapping: Record<string, string> = {};
    for (const [servId, catId] of Object.entries(config.servizioCategoria)) {
      if (catId !== id) nuovoMapping[servId] = catId;
    }
    setConfig((c) => ({ ...c, categorie: nuoveCategorie, servizioCategoria: nuovoMapping }));
  }

  function cambiaColoreCategoria(id: string, colore: string) {
    aggiorna(
      'categorie',
      config.categorie.map((c) => (c.id === id ? { ...c, colore } : c))
    );
  }

  function cambiaNomeCategoria(id: string, nome: string) {
    aggiorna(
      'categorie',
      config.categorie.map((c) => (c.id === id ? { ...c, nome } : c))
    );
  }

  function assegnaServizio(servizioId: number, categoriaId: string) {
    setConfig((c) => {
      const nuovo = { ...c.servizioCategoria };
      if (categoriaId === '') {
        delete nuovo[String(servizioId)];
      } else {
        nuovo[String(servizioId)] = categoriaId;
      }
      return { ...c, servizioCategoria: nuovo };
    });
  }

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12 gap-3">
          <div className="w-6 h-6 rounded-full border-2 border-apple-blue border-t-transparent animate-spin" />
          <p className="text-sm text-apple-gray">Caricamento…</p>
        </div>
      </Card>
    );
  }

  const operatoriList = config.operatori || [];

  return (
    <>
      {messaggio && (
        <div
          className={`px-4 py-3 rounded-apple text-sm flex items-center gap-2 ${
            messaggio.tipo === 'ok'
              ? 'bg-green-50 text-green-700 border border-green-100'
              : 'bg-red-50 text-red-600 border border-red-100'
          }`}
        >
          <span>{messaggio.tipo === 'ok' ? '✅' : '⚠️'}</span>
          {messaggio.testo}
        </div>
      )}

      <Card title="Orari di apertura" subtitle="Definisci la fascia oraria mostrata in agenda.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-apple-darkgray mb-1">Ora apertura</label>
            <input
              type="time"
              value={config.oraApertura}
              onChange={(e) => aggiorna('oraApertura', e.target.value)}
              className="w-full px-3 py-2 rounded-apple bg-gray-50 border border-gray-200 text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/40 focus:border-apple-blue transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-apple-darkgray mb-1">Ora chiusura</label>
            <input
              type="time"
              value={config.oraChiusura}
              onChange={(e) => aggiorna('oraChiusura', e.target.value)}
              className="w-full px-3 py-2 rounded-apple bg-gray-50 border border-gray-200 text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/40 focus:border-apple-blue transition-all"
            />
          </div>
        </div>
      </Card>

      <Card
        title="Orari per giorno"
        subtitle="Clicca un giorno per configurare le fasce orarie (es. mattina + pomeriggio)."
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {GIORNI_SETTIMANA.map((g) => {
            const aperto = isGiornoAperto(g.value);
            const riepilogo = riepilogoGiorno(g.value);
            return (
              <button
                key={g.value}
                type="button"
                onClick={() => apriModaleGiorno(g.value)}
                className={`text-left p-3 rounded-apple border-2 transition-all hover:shadow-apple ${
                  aperto
                    ? 'bg-blue-50 border-blue-300 hover:border-blue-500 hover:bg-blue-100'
                    : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className={`text-xs font-bold ${aperto ? 'text-apple-blue' : 'text-apple-gray'}`}>
                  {g.label}
                </p>
                <p className={`text-[10px] mt-1 truncate ${aperto ? 'text-apple-blue font-semibold' : 'text-apple-gray italic'}`}>
                  {riepilogo}
                </p>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Modale orari giorno */}
      {giornoModale !== null && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[90]"
          onClick={chiudiModaleGiorno}
        >
          <div
            className="bg-white rounded-apple shadow-apple-lg max-w-sm w-full p-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-apple-darkgray">
                {GIORNI_SETTIMANA.find((g) => g.value === giornoModale)?.label}
              </h3>
              <button
                type="button"
                onClick={chiudiModaleGiorno}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-apple-gray text-xs flex items-center justify-center transition-colors"
                aria-label="Chiudi"
              >
                ✕
              </button>
            </div>

            {/* Toggle aperto */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-apple mb-4">
              <button
                type="button"
                onClick={() => setApertoModale((a) => !a)}
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                  apertoModale
                    ? 'bg-apple-blue border-apple-blue text-white'
                    : 'bg-white border-gray-300'
                }`}
                aria-label={apertoModale ? 'Chiudi giorno' : 'Apri giorno'}
              >
                {apertoModale && <span className="text-[10px] font-bold">✓</span>}
              </button>
              <button
                type="button"
                onClick={() => setApertoModale((a) => !a)}
                className="flex-1 text-left"
              >
                <p className="text-sm font-semibold text-apple-darkgray">
                  {apertoModale ? 'Aperto' : 'Chiuso'}
                </p>
              </button>
            </div>

            {/* Fasce */}
            {apertoModale && (
              <div className="space-y-3 mb-4">
                <p className="text-xs font-semibold text-apple-gray uppercase tracking-wide">
                  Fasce orarie
                </p>
                {fasceModale.length === 0 && (
                  <p className="text-xs text-apple-gray italic text-center py-3">
                    Nessuna fascia. Aggiungine una qui sotto.
                  </p>
                )}
                {fasceModale.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="time"
                      value={f.inizio}
                      onChange={(e) => cambiaFasciaModale(i, 'inizio', e.target.value)}
                      className="flex-1 min-w-0 px-2.5 py-2 rounded-apple bg-gray-50 border border-gray-200 text-xs text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
                    />
                    <span className="text-apple-gray text-xs shrink-0">→</span>
                    <input
                      type="time"
                      value={f.fine}
                      onChange={(e) => cambiaFasciaModale(i, 'fine', e.target.value)}
                      className="flex-1 min-w-0 px-2.5 py-2 rounded-apple bg-gray-50 border border-gray-200 text-xs text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
                    />
                    <button
                      type="button"
                      onClick={() => rimuoviFasciaModale(i)}
                      className="shrink-0 w-7 h-7 rounded-apple flex items-center justify-center text-apple-gray hover:text-red-500 hover:bg-red-50 transition-colors text-xs"
                      title="Rimuovi fascia"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={aggiungiFasciaModale}
                  className="w-full px-3 py-2 rounded-apple bg-blue-50 hover:bg-blue-100 text-apple-blue text-xs font-semibold transition-colors"
                >
                  + Aggiungi fascia
                </button>
              </div>
            )}

            {/* Azioni */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={chiudiModaleGiorno}
                className="flex-1 px-4 py-2.5 rounded-apple bg-gray-100 text-apple-darkgray text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={salvaModaleGiorno}
                className="flex-1 px-4 py-2.5 rounded-apple bg-apple-blue text-white text-sm font-semibold hover:bg-blue-600 transition-colors shadow-apple"
              >
                Salva
              </button>
            </div>
          </div>
        </div>
      )}

      <Card title="Granularità griglia" subtitle="Dimensione degli slot orari in agenda.">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {([10, 15, 20, 30] as const).map((m) => {
            const attivo = config.granularitaMinuti === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => aggiorna('granularitaMinuti', m)}
                className={`px-3.5 py-2 rounded-apple text-xs font-medium transition-all ${
                  attivo
                    ? 'bg-apple-blue text-white shadow-apple'
                    : 'bg-gray-100 text-apple-darkgray hover:bg-gray-200'
                }`}
              >
                {m} min
              </button>
            );
          })}
        </div>
      </Card>

      <Card
        title="Operatori dell'Agenda"
        subtitle="Aggiungi operatori, personalizza colori e ruoli e scegli quali colonne mostrare in agenda."
      >
        <div className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-apple border border-gray-200 space-y-3">
            <p className="text-xs font-semibold text-apple-darkgray">+ Aggiungi Nuovo Operatore</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={nuovoOpNome}
                onChange={(e) => setNuovoOpNome(e.target.value)}
                placeholder="Nome e cognome (es. Marco Rossi)"
                className="px-3 py-1.5 rounded-apple bg-white border border-gray-200 text-xs text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/40"
              />
              <input
                type="text"
                value={nuovoOpRuolo}
                onChange={(e) => setNuovoOpRuolo(e.target.value)}
                placeholder="Ruolo (es. Consulente, Tecnico...)"
                className="px-3 py-1.5 rounded-apple bg-white border border-gray-200 text-xs text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/40"
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-apple-gray">Colore:</span>
                {COLORI_DISPONIBILI.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setNuovoOpColore(c.id)}
                    className={`w-5 h-5 rounded-full ${c.bg} ${
                      nuovoOpColore === c.id ? 'ring-2 ring-offset-2 ring-apple-blue' : ''
                    }`}
                    title={c.label}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={aggiungiOperatore}
                disabled={!nuovoOpNome.trim()}
                className="w-full sm:w-auto px-4 py-1.5 bg-apple-blue text-white rounded-apple text-xs font-medium hover:bg-apple-blue/90 disabled:opacity-50 transition-all shadow-apple whitespace-nowrap"
              >
                + Aggiungi
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {operatoriList.map((op) => {
              const visibile = config.operatoriVisibili.includes(op.id);
              return (
                <div
                  key={op.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-apple border transition-all gap-3 ${
                    visibile ? 'bg-white border-gray-200' : 'bg-gray-50/70 border-gray-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex gap-1">
                      {COLORI_DISPONIBILI.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => cambiaColoreOperatore(op.id, c.id)}
                          className={`w-5 h-5 rounded-full ${c.bg} ${
                            op.colore === c.id ? 'ring-2 ring-offset-2 ring-apple-darkgray' : ''
                          }`}
                          title={c.label}
                        />
                      ))}
                    </div>
                    <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={op.label}
                        onChange={(e) => cambiaLabelOperatore(op.id, e.target.value)}
                        className="bg-transparent text-sm font-semibold text-apple-darkgray border-b border-transparent hover:border-gray-300 focus:border-apple-blue focus:outline-none"
                      />
                      <input
                        type="text"
                        value={op.ruolo}
                        onChange={(e) => cambiaRuoloOperatore(op.id, e.target.value)}
                        placeholder="Ruolo"
                        className="bg-transparent text-xs text-apple-gray border-b border-transparent hover:border-gray-300 focus:border-apple-blue focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => toggleOperatore(op.id)}
                      className={`px-3 py-1 rounded-apple text-xs font-medium transition-colors ${
                        visibile
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      {visibile ? '👁️ Visibile' : '🙈 Nascosto'}
                    </button>
                    {operatoriList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => rimuoviOperatore(op.id)}
                        className="w-7 h-7 rounded-apple flex items-center justify-center text-apple-gray hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Elimina operatore"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <Card
        title="Colori tipi appuntamento"
        subtitle="Colore dei blocchi in agenda quando il servizio non ha una categoria assegnata."
      >
        <div className="space-y-3">
          {([
            { id: 'percorso', label: '🛤️ Percorso' },
            { id: 'checkup_nuovo', label: '🆕 Check-up' },
            { id: 'seduta', label: '💺 Seduta in Studio' },
            { id: 'generico', label: '📌 Generico' },
          ] as const).map((t) => {
            const coloreAttuale = config.coloriTipi[t.id];
            return (
              <div key={t.id} className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-apple-darkgray">{t.label}</p>
                <select
                  value={coloreAttuale}
                  onChange={(e) =>
                    aggiorna('coloriTipi', { ...config.coloriTipi, [t.id]: e.target.value })
                  }
                  className="px-3 py-1.5 rounded-apple bg-gray-50 border border-gray-200 text-xs text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/40 focus:border-apple-blue transition-all"
                >
                  {COLORI_DISPONIBILI.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </Card>

      <Card
        title="Categorie servizi"
        subtitle="Raggruppa i servizi in categorie e assegna un colore a ciascuna. Il colore apparirà in agenda."
      >
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={nuovaCategoriaNome}
            onChange={(e) => setNuovaCategoriaNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') aggiungiCategoria();
            }}
            placeholder="Es. Stilistico, Tecnico, Consulenze…"
            className="flex-1 px-3 py-2 rounded-apple bg-gray-50 border border-gray-200 text-sm text-apple-darkgray placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-apple-blue/40 focus:border-apple-blue transition-all"
          />
          <button
            type="button"
            onClick={aggiungiCategoria}
            disabled={!nuovaCategoriaNome.trim()}
            className="px-4 py-2 rounded-apple bg-apple-blue text-white text-sm font-medium hover:bg-apple-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-apple"
          >
            + Aggiungi
          </button>
        </div>

        {config.categorie.length === 0 ? (
          <p className="text-sm text-apple-gray text-center py-6">
            Nessuna categoria creata. Aggiungine una qui sopra.
          </p>
        ) : (
          <div className="space-y-2">
            {config.categorie.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center gap-3 px-3 py-2 rounded-apple bg-gray-50 border border-gray-200"
              >
                <input
                  type="text"
                  value={cat.nome}
                  onChange={(e) => cambiaNomeCategoria(cat.id, e.target.value)}
                  className="flex-1 bg-transparent text-sm font-medium text-apple-darkgray focus:outline-none"
                />
                <div className="flex gap-1">
                  {COLORI_DISPONIBILI.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => cambiaColoreCategoria(cat.id, c.id)}
                      className={`w-6 h-6 rounded-full ${c.bg} ${
                        cat.colore === c.id ? 'ring-2 ring-offset-2 ring-apple-darkgray' : ''
                      }`}
                      title={c.label}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => rimuoviCategoria(cat.id)}
                  className="shrink-0 w-7 h-7 rounded-apple flex items-center justify-center text-apple-gray hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Rimuovi categoria"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Assegnazione servizi"
        subtitle="Assegna ogni servizio a una categoria. Il colore della categoria sarà usato in agenda."
      >
        {serviziLoading ? (
          <div className="flex items-center justify-center py-8 gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-apple-blue border-t-transparent animate-spin" />
            <p className="text-sm text-apple-gray">Caricamento servizi…</p>
          </div>
        ) : config.categorie.length === 0 ? (
          <p className="text-sm text-apple-gray text-center py-6">
            Crea prima almeno una categoria qui sopra.
          </p>
        ) : servizi.length === 0 ? (
          <p className="text-sm text-apple-gray text-center py-6">
            Nessun servizio trovato.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {servizi.map((s) => {
              const catId = config.servizioCategoria[String(s.id)] || '';
              const cat = config.categorie.find((c) => c.id === catId);
              const coloreDot =
                COLORI_DISPONIBILI.find((c) => c.id === cat?.colore)?.bg || 'bg-gray-300';
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 px-3 py-1.5 rounded-apple hover:bg-gray-50 transition-colors"
                >
                  <div className={`w-3 h-3 rounded-full ${coloreDot} shrink-0`} />
                  <p className="flex-1 text-sm text-apple-darkgray truncate">{s.nome}</p>
                  <select
                    value={catId}
                    onChange={(e) => assegnaServizio(s.id, e.target.value)}
                    className="px-2.5 py-1 rounded-apple bg-gray-50 border border-gray-200 text-xs text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/40 transition-all"
                  >
                    <option value="">— Nessuna categoria —</option>
                    {config.categorie.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <button
          onClick={salva}
          disabled={salvando}
          className="px-5 py-2 rounded-apple bg-apple-blue text-white text-sm font-medium hover:bg-apple-blue/90 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-apple"
        >
          {salvando ? 'Salvataggio…' : 'Salva configurazione'}
        </button>
      </div>
    </>
  );
}

// ============ COMPONENTE LOGO UPLOADER ============
function LogoUploader() {
  const { user } = useAuth();
  const isRighetti = user?.email?.toLowerCase().trim() === 'righetti@righetti.club';
  const [url, setUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [logoCustom, setLogoCustom] = useState(false);

  useEffect(() => {
    (async () => {
      const esiste = await esisteLogoCustom();
      setLogoCustom(esiste);
      setUrl(esiste ? getLogoUrl(true, user?.email) : (isRighetti ? '/logo.png' : ''));
      setLoading(false);
    })();
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrore(null);
    setUploading(true);

    const { url: newUrl, error } = await uploadLogo(file);

    if (error) {
      setErrore(error);
    } else if (newUrl) {
      setUrl(newUrl);
      setLogoCustom(true);
    }
    setUploading(false);

    e.target.value = '';
  }

  async function handleRimuovi() {
    if (!confirm('Rimuovere il logo personalizzato? Verrà ripristinato il logo di default.')) return;
    setErrore(null);
    setUploading(true);

    const { error } = await rimuoviLogo();

    if (error) {
      setErrore(error);
    } else {
      setUrl(isRighetti ? '/logo.png' : '');
      setLogoCustom(false);
    }
    setUploading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 gap-3">
        <div className="w-5 h-5 rounded-full border-2 border-apple-blue border-t-transparent animate-spin" />
        <p className="text-sm text-apple-gray">Caricamento…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-28 h-28 rounded-apple bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
          {(logoCustom || isRighetti) ? (
            <img
              src={logoCustom ? url : (isRighetti ? '/logo.png' : '')}
              alt="Logo aziendale"
              className="max-w-full max-h-full object-contain mix-blend-multiply"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl text-apple-gray/40 font-bold">
              🏢
            </div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-apple-darkgray mb-1">
            {logoCustom ? 'Logo personalizzato' : (isRighetti ? 'Logo Righetti Since 1967' : 'Nessun logo caricato')}
          </p>
          <p className="text-xs text-apple-gray mb-3">
            Formato PNG, max 5 MB. Consigliato: sfondo trasparente, almeno 300px di larghezza.
          </p>
          <div className="flex gap-2 flex-wrap">
            <label
              className={`px-4 py-2 rounded-apple text-sm font-medium transition-colors cursor-pointer ${
                uploading
                  ? 'bg-gray-100 text-apple-gray cursor-not-allowed'
                  : 'bg-apple-blue text-white hover:bg-apple-blue/90'
              }`}
            >
              {uploading ? 'Caricamento…' : '📤 Carica logo'}
              <input
                type="file"
                accept="image/png"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
            {logoCustom && (
              <button
                type="button"
                onClick={handleRimuovi}
                disabled={uploading}
                className="px-4 py-2 rounded-apple text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                🗑️ Rimuovi
              </button>
            )}
          </div>
        </div>
      </div>

      {errore && (
        <div className="px-4 py-3 rounded-apple text-sm flex items-center gap-2 bg-red-50 text-red-600 border border-red-100">
          <span>⚠️</span>
          {errore}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TAB LICENZE & DEMO (SOLO ADMIN RIGHETTI)
// ============================================================================
function TabLicenze({ adminEmail }: { adminEmail: string }) {
  const [utenti, setUtenti] = useState<AdminUtenteLicenza[]>([]);
  const [loading, setLoading] = useState(true);
  const [azioneInCorso, setAzioneInCorso] = useState<string | null>(null);
  const [messaggio, setMessaggio] = useState<{ tipo: 'ok' | 'err'; testo: string } | null>(null);
  const [filtro, setFiltro] = useState<'tutti' | 'demo' | 'reale'>('tutti');

  async function carica() {
    setLoading(true);
    try {
      const lista = await getAdminUtenti(adminEmail);
      setUtenti(lista);
    } catch (e: any) {
      setMessaggio({ tipo: 'err', testo: e.message || 'Errore caricamento utenti' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carica();
  }, [adminEmail]);

  async function handleProroga(userId: string, giorni: number) {
    setAzioneInCorso(userId);
    setMessaggio(null);
    try {
      await prorogaDemoUtente(adminEmail, { userId, giorni });
      setMessaggio({ tipo: 'ok', testo: `Demo prorogata di ${giorni} giorni!` });
      await carica();
    } catch (e: any) {
      setMessaggio({ tipo: 'err', testo: e.message || 'Errore proroga' });
    } finally {
      setAzioneInCorso(null);
    }
  }

  async function handleSbloccaReale(u: AdminUtenteLicenza) {
    const conferma = window.confirm(
      `ATTENZIONE: Stai per attivare la licenza REALE a vita per:\n${u.email} (${u.azienda || 'Studio'})\n\nTutti i suoi dati di prova demo (clienti, prodotti, fatture, appuntamenti) verranno AZZERATI.\n\nConfermi?`
    );
    if (!conferma) return;

    setAzioneInCorso(u.id);
    setMessaggio(null);
    try {
      await sbloccaUtenteReale(adminEmail, { userId: u.id, azzeraDatiDemo: true });
      setMessaggio({ tipo: 'ok', testo: `Licenza reale attivata e dati azzerati per ${u.email}!` });
      await carica();
    } catch (e: any) {
      setMessaggio({ tipo: 'err', testo: e.message || 'Errore attivazione' });
    } finally {
      setAzioneInCorso(null);
    }
  }

  async function handlePopolaDemo(u: AdminUtenteLicenza) {
    const conferma = window.confirm(
      `Popolare l'utente ${u.email} con dati demo?\n\nVerranno creati: logo, 3 clienti, 4 servizi, 5 prodotti, 2 percorsi, 4 appuntamenti.\n\nI dati esistenti dell'utente verranno CANCELLATI.`
    );
    if (!conferma) return;

    setAzioneInCorso(u.id);
    setMessaggio(null);
    try {
      const res = await popolaDemoUtente(adminEmail, u.id);
      const r = res.riepilogo;
      setMessaggio({
        tipo: 'ok',
        testo: `Popolato! ${r.clienti} clienti, ${r.servizi} servizi, ${r.prodotti} prodotti, ${r.percorsi} percorsi, ${r.appuntamenti} appuntamenti.`,
      });
      await carica();
    } catch (e: any) {
      setMessaggio({ tipo: 'err', testo: e.message || 'Errore popolamento' });
    } finally {
      setAzioneInCorso(null);
    }
  }

  const utentiFiltrati = utenti.filter((u) => {
    if (filtro === 'demo') return u.ruolo === 'demo';
    if (filtro === 'reale') return u.ruolo === 'reale' || u.ruolo === 'admin';
    return true;
  });

  return (
    <div className="space-y-4">
      <Card
        title="👑 Gestione Licenze & Utenti DEMO"
        subtitle="Pannello riservato all'amministratore. Monitora utenti in prova, proroga scadenze, popola dati demo, attiva licenze reali."
      >
        {/* Notifica */}
        {messaggio && (
          <div className={`mb-4 px-4 py-3 rounded-apple text-sm flex items-center justify-between ${
            messaggio.tipo === 'ok'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            <span>{messaggio.tipo === 'ok' ? '✅' : '⚠️'} {messaggio.testo}</span>
            <button onClick={() => setMessaggio(null)} className="ml-2 font-bold opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Filtri */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {(['tutti', 'demo', 'reale'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-apple text-xs font-medium transition-colors ${
                filtro === f
                  ? 'bg-apple-blue text-white shadow-apple'
                  : 'bg-gray-100 text-apple-darkgray hover:bg-gray-200'
              }`}
            >
              {f === 'tutti' ? `Tutti (${utenti.length})` : f === 'demo' ? `Demo (${utenti.filter((x) => x.ruolo === 'demo').length})` : `Reali (${utenti.filter((x) => x.ruolo !== 'demo').length})`}
            </button>
          ))}
          <button
            onClick={carica}
            disabled={loading}
            className="ml-auto px-3 py-1.5 rounded-apple bg-gray-100 text-apple-darkgray text-xs font-medium hover:bg-gray-200 transition-colors flex items-center gap-1.5"
          >
            🔄 Aggiorna
          </button>
        </div>

        {/* Lista utenti */}
        {loading ? (
          <div className="py-12 text-center text-apple-gray text-sm">
            <span className="text-2xl animate-spin inline-block mb-2">⏳</span>
            <p>Caricamento utenti...</p>
          </div>
        ) : utentiFiltrati.length === 0 ? (
          <div className="py-10 text-center text-apple-gray text-sm">
            Nessun utente trovato con questo filtro.
          </div>
        ) : (
          <div className="space-y-3">
            {utentiFiltrati.map((u) => {
              const busy = azioneInCorso === u.id;
              return (
                <div
                  key={u.id}
                  className={`p-4 rounded-apple border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                    u.is_admin
                      ? 'bg-purple-50/40 border-purple-200/60'
                      : u.ruolo === 'reale'
                      ? 'bg-green-50/30 border-green-200/60'
                      : u.is_scaduto
                      ? 'bg-red-50/30 border-red-200/60'
                      : 'bg-white border-gray-200/80'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-apple-darkgray truncate">{u.email}</span>
                      {u.is_admin ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                          👑 Admin
                        </span>
                      ) : u.ruolo === 'reale' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 border border-green-200">
                          ✅ Licenza Reale
                        </span>
                      ) : u.is_scaduto ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200">
                          🔒 Demo Scaduta
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-apple-blue border border-blue-200">
                          ⏳ Demo: {u.giorni_rimasti} {u.giorni_rimasti === 1 ? 'giorno' : 'giorni'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-apple-gray flex-wrap">
                      {u.azienda && <span>🏢 <strong>{u.azienda}</strong></span>}
                      {u.full_name && u.full_name !== u.azienda && <span>👤 {u.full_name}</span>}
                      {u.demo_scadenza && u.ruolo === 'demo' && (
                        <span>📅 {new Date(u.demo_scadenza).toLocaleDateString('it-IT')}</span>
                      )}
                    </div>
                  </div>

                  {!u.is_admin && (
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      {u.ruolo === 'demo' && (
                        <>
                          <button
                            onClick={() => handleProroga(u.id, 7)}
                            disabled={busy}
                            className="px-2.5 py-1.5 rounded-apple bg-gray-100 text-apple-darkgray hover:bg-gray-200 text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            +7 gg
                          </button>
                          <button
                            onClick={() => handleProroga(u.id, 15)}
                            disabled={busy}
                            className="px-2.5 py-1.5 rounded-apple bg-blue-50 text-apple-blue hover:bg-blue-100 text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            +15 gg
                          </button>
                          <button
                            onClick={() => handlePopolaDemo(u)}
                            disabled={busy}
                            className="px-2.5 py-1.5 rounded-apple bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            🧪 Popola DEMO
                          </button>
                        </>
                      )}

                      {u.ruolo !== 'reale' ? (
                        <button
                          onClick={() => handleSbloccaReale(u)}
                          disabled={busy}
                          className="px-3.5 py-1.5 rounded-apple bg-green-600 text-white hover:bg-green-700 text-xs font-semibold transition-colors shadow-apple disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <span>🔓</span> Attiva Reale (Reset)
                        </button>
                      ) : (
                        <span className="text-xs text-apple-gray italic">Licenza attiva</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

