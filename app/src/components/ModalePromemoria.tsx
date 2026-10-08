import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ModaleTestoPromemoria } from './ModaleTestoPromemoria';
import { getTestoTemplate } from '../lib/testiTemplate';
import { caricaConfigPromemoria, inviaEmailPromemoria, marcaPromemoriaInviato, type ConfigPromemoria } from '../lib/promemoria';
import { caricaDatiAziendali } from '../lib/datiAziendali';

interface AppuntamentoProm {
  id: number;
  cliente_id: number | null;
  cliente_nome: string | null;
  cliente_email: string | null;
  cliente_cellulare: string | null;
  data: string;
  ora_inizio: string;
  durata_minuti: number | null;
  operatore: string | null;
  tipo: string | null;
  titolo: string | null;
  reminder_email_at: string | null;
  reminder_email_inviato: boolean;
  reminder_whatsapp_at: string | null;
  reminder_whatsapp_inviato: boolean;
  ore_anticipo: number;
  stato_invio: 'inviato' | 'da_inviare' | 'in_ritardo' | 'troppo_presto';
}

type FiltroStato = 'tutti' | 'da_inviare' | 'inviato' | 'in_ritardo';

interface Props {
  lunedi: string; // YYYY-MM-DD
  sabato: string; // YYYY-MM-DD
  onClose: () => void;
}

export function ModalePromemoria({ lunedi, sabato, onClose }: Props) {
  const [appuntamenti, setAppuntamenti] = useState<AppuntamentoProm[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<ConfigPromemoria | null>(null);
  const [nomeAzienda, setNomeAzienda] = useState<string>('');
  const [testoWhatsapp, setTestoWhatsapp] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('promemoria_testo_whatsapp') || '';
    }
    return '';
  });
  const [testoEmailCustom, setTestoEmailCustom] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('promemoria_testo_email') || '';
    }
    return '';
  });
  const [modaleTestoAperto, setModaleTestoAperto] = useState<'email' | 'whatsapp' | null>(null);
  const [templateEmailDefault, setTemplateEmailDefault] = useState<string>('');
  const [templateEmailCheckupDefault, setTemplateEmailCheckupDefault] = useState<string>('');
  const [selezionati, setSelezionati] = useState<Set<number>>(new Set());
  const [filtro, setFiltro] = useState<FiltroStato>('tutti');
  const [inviando, setInviando] = useState(false);
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const templateWhatsappInizializzatoRef = useState({ current: false })[0];

  async function carica() {
    setLoading(true);
    setErrore(null);
    try {
      const [resApp, cfg, datiAz] = await Promise.all([
        supabase.rpc('get_appuntamenti_settimana', {
          lunedi_input: lunedi,
          sabato_input: sabato,
        }),
        caricaConfigPromemoria(),
        caricaDatiAziendali(),
      ]);
      if (resApp.error) throw resApp.error;
      setAppuntamenti((resApp.data ?? []) as AppuntamentoProm[]);
      setConfig(cfg);
      setNomeAzienda(datiAz?.ragioneSociale || '');
    } catch (e: any) {
      setErrore(e.message || 'Errore caricamento');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carica();
    // Carica i template email da Testi Messaggi
    Promise.all([
      getTestoTemplate('email_promemoria'),
      getTestoTemplate('email_promemoria_checkup'),
    ]).then(([t1, t2]) => {
      setTemplateEmailDefault(t1?.corpo || '');
      setTemplateEmailCheckupDefault(t2?.corpo || '');
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lunedi, sabato]);

  // Precompila il testo del promemoria dal template (una sola volta)
  useEffect(() => {
    if (!templateWhatsappInizializzatoRef.current && appuntamenti.length > 0 && config) {
      const primo = appuntamenti[0];
      const template = primo.tipo === 'checkup_nuovo' && config.attivoCheckup
        ? config.messaggioCheckup
        : config.messaggioStandard;
      // Solo se non c'è già un override in sessionStorage
      const salvato = sessionStorage.getItem('promemoria_testo_whatsapp');
      if (!salvato) setTestoWhatsapp(template || '');
      templateWhatsappInizializzatoRef.current = true;
    }
  }, [appuntamenti, config, templateWhatsappInizializzatoRef]);

  const listaFiltrata = useMemo(() => {
    if (filtro === 'tutti') return appuntamenti;
    return appuntamenti.filter((a) => a.stato_invio === filtro);
  }, [appuntamenti, filtro]);

  const selezionabili = useMemo(
    () => listaFiltrata.filter((a) => a.stato_invio !== 'inviato'),
    [listaFiltrata]
  );

  const conteggi = useMemo(() => {
    return {
      totale: appuntamenti.length,
      da_inviare: appuntamenti.filter((a) => a.stato_invio === 'da_inviare').length,
      in_ritardo: appuntamenti.filter((a) => a.stato_invio === 'in_ritardo').length,
      inviato: appuntamenti.filter((a) => a.stato_invio === 'inviato').length,
    };
  }, [appuntamenti]);

  function toggleSelezionato(id: number) {
    setSelezionati((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTutti() {
    if (selezionati.size === selezionabili.length && selezionabili.length > 0) {
      setSelezionati(new Set());
    } else {
      setSelezionati(new Set(selezionabili.map((a) => a.id)));
    }
  }

  function getAppuntamentoDaRpc(a: AppuntamentoProm) {
    // Ricostruisce l'oggetto AppuntamentoConCliente atteso da inviaEmailPromemoria
    return {
      id: a.id,
      data: a.data,
      ora_inizio: a.ora_inizio,
      tipo: a.tipo,
      titolo: a.titolo,
      operatore: a.operatore,
      durata_minuti: a.durata_minuti,
      cliente: {
        id: a.cliente_id,
        nome_cognome: a.cliente_nome,
        email: a.cliente_email,
        cellulare: a.cliente_cellulare,
      },
    } as any;
  }

  async function inviaEmail(ids: number[]): Promise<{ ok: number; errori: string[] }> {
    if (!config) return { ok: 0, errori: [] };
    let ok = 0;
    const errori: string[] = [];
    for (const id of ids) {
      const a = appuntamenti.find((x) => x.id === id);
      if (!a) continue;
      if (!a.cliente_email) {
        errori.push(`${a.cliente_nome}: email mancante`);
        continue;
      }
      try {
        await inviaEmailPromemoria(getAppuntamentoDaRpc(a), config, nomeAzienda, testoEmailCustom || undefined);
        await supabase
          .from('appuntamenti')
          .update({
            reminder_email_at: new Date().toISOString(),
            reminder_email_inviato: true,
          })
          .eq('id', id);
        ok++;
      } catch (e: any) {
        console.error('[promemoria email] errore:', e);
        errori.push(`${a.cliente_nome}: ${e.message || e}`);
      }
    }
    return { ok, errori };
  }

  async function inviaWhatsapp(ids: number[]): Promise<{ ok: number; errori: string[] }> {
    let ok = 0;
    const errori: string[] = [];
    for (const id of ids) {
      const a = appuntamenti.find((x) => x.id === id);
      if (!a || !a.cliente_cellulare) {
        if (a) errori.push(`${a.cliente_nome}: cellulare mancante`);
        continue;
      }
      // Genera testo promemoria
      const { generaTestoPromemoria } = await import('../lib/promemoria');
      const testo = testoWhatsapp && testoWhatsapp.trim()
        ? generaTestoPromemoria(getAppuntamentoDaRpc(a), config!, nomeAzienda, testoWhatsapp)
        : generaTestoPromemoria(getAppuntamentoDaRpc(a), config!, nomeAzienda);
      const numeroPulito = a.cliente_cellulare.replace(/[^0-9]/g, '');
      const url = `https://wa.me/${numeroPulito}?text=${encodeURIComponent(testo)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      // Marca come inviato (l'utente confermerà manualmente su WhatsApp)
      await supabase
        .from('appuntamenti')
        .update({
          reminder_whatsapp_at: new Date().toISOString(),
          reminder_whatsapp_inviato: true,
        })
        .eq('id', id);
      ok++;
    }
    return { ok, errori };
  }

  async function handleInvia(canale: 'email' | 'whatsapp' | 'entrambi') {
    if (!config) return;
    if (selezionati.size === 0) {
      setErrore('Nessun appuntamento selezionato');
      return;
    }
    setInviando(true);
    setErrore(null);
    setMessaggio(null);

    const ids = Array.from(selezionati);
    try {
      let risultati: { ok: number; errori: string[] } = { ok: 0, errori: [] };
      if (canale === 'email') {
        risultati = await inviaEmail(ids);
      } else if (canale === 'whatsapp') {
        risultati = await inviaWhatsapp(ids);
      } else {
        const r1 = await inviaEmail(ids);
        const r2 = await inviaWhatsapp(ids);
        risultati = { ok: r1.ok + r2.ok, errori: [...r1.errori, ...r2.errori] };
      }

      if (risultati.ok > 0) {
        setMessaggio(`✅ Inviati ${risultati.ok} promemoria`);
      } else {
        setMessaggio(null);
      }
      if (risultati.errori.length > 0) {
        setErrore('⚠️ ' + risultati.errori.join(' | '));
      } else {
        setErrore(null);
      }

      setSelezionati(new Set());
      // Reset degli override dopo invio riuscito
      if (risultati.ok > 0) {
        sessionStorage.removeItem('promemoria_testo_email');
        sessionStorage.removeItem('promemoria_testo_whatsapp');
        setTestoEmailCustom('');
        // Ripristina WhatsApp al template
        if (config) setTestoWhatsapp(config.messaggioStandard || '');
      }
      carica();
    } finally {
      setInviando(false);
    }
  }

  function formatDataShort(iso: string): string {
    try {
      const d = new Date(iso + 'T00:00:00');
      return d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
    } catch {
      return iso;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              🔔 Promemoria Appuntamenti
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Settimana dal {formatDataShort(lunedi)} al {formatDataShort(sabato)}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {/* Filtri + stats */}
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
          {(['tutti', 'da_inviare', 'in_ritardo', 'inviato'] as FiltroStato[]).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                filtro === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f === 'tutti' ? `Tutti (${conteggi.totale})` :
               f === 'da_inviare' ? `Da inviare (${conteggi.da_inviare})` :
               f === 'in_ritardo' ? `In ritardo (${conteggi.in_ritardo})` :
               `Inviati (${conteggi.inviato})`}
            </button>
          ))}
        </div>

        {/* Pulsanti modifica testi (Apple style) */}
        <div className="px-5 py-3 bg-gray-50/60 border-b border-gray-100 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setModaleTestoAperto('email')}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-white border border-gray-200 rounded-xl hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
          >
            <span>📧</span>
            <span>Testo Email</span>
            {testoEmailCustom && testoEmailCustom !== (config?.messaggioStandard || '') && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setModaleTestoAperto('whatsapp')}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-white border border-gray-200 rounded-xl hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
          >
            <span>💬</span>
            <span>Testo WhatsApp</span>
            {testoWhatsapp && testoWhatsapp !== (config?.messaggioStandard || '') && testoWhatsapp !== (config?.messaggioCheckup || '') && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            )}
          </button>
          {testoEmailCustom && (
            <button
              type="button"
              onClick={() => {
                setTestoEmailCustom('');
                sessionStorage.removeItem('promemoria_testo_email');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-[10px] text-blue-600 hover:underline"
            >
              ↺ Email default
            </button>
          )}
          {testoWhatsapp && testoWhatsapp !== (config?.messaggioStandard || '') && testoWhatsapp !== (config?.messaggioCheckup || '') && (
            <button
              type="button"
              onClick={() => {
                if (config) {
                  setTestoWhatsapp(config.messaggioStandard || '');
                  sessionStorage.removeItem('promemoria_testo_whatsapp');
                }
              }}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-[10px] text-blue-600 hover:underline"
            >
              ↺ WhatsApp default
            </button>
          )}
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Caricamento…</div>
          ) : listaFiltrata.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              Nessun appuntamento in questa categoria
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {/* Header seleziona tutti */}
              {selezionabili.length > 0 && (
                <div className="px-5 py-2 bg-gray-50 flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={selezionati.size === selezionabili.length && selezionabili.length > 0}
                    onChange={toggleTutti}
                    className="w-4 h-4"
                  />
                  <span className="font-medium text-gray-600">
                    Seleziona tutti ({selezionabili.length} da inviare)
                  </span>
                </div>
              )}

              {listaFiltrata.map((a) => (
                <RigaPromemoria
                  key={a.id}
                  app={a}
                  selezionato={selezionati.has(a.id)}
                  onToggle={() => toggleSelezionato(a.id)}
                  formatDataShort={formatDataShort}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer: azioni */}
        <div className="px-5 py-4 border-t border-gray-100 flex flex-wrap items-center gap-2 justify-between">
          <div className="text-xs text-gray-600">
            {selezionati.size > 0 && (
              <span className="font-medium">{selezionati.size} selezionati</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Chiudi
            </button>
            <button
              onClick={() => handleInvia('email')}
              disabled={inviando || selezionati.size === 0}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {inviando ? '…' : '📧 Email'}
            </button>
            <button
              onClick={() => handleInvia('whatsapp')}
              disabled={inviando || selezionati.size === 0}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {inviando ? '…' : '💬 WhatsApp'}
            </button>
            <button
              onClick={() => handleInvia('entrambi')}
              disabled={inviando || selezionati.size === 0}
              className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-black disabled:opacity-50"
            >
              {inviando ? '…' : '📧💬 Entrambi'}
            </button>
          </div>
        </div>

        {/* Feedback */}
        {(messaggio || errore) && (
          <div className="px-5 py-2 border-t border-gray-100">
            {messaggio && <div className="text-xs text-green-700">{messaggio}</div>}
            {errore && <div className="text-xs text-red-700 mt-1">{errore}</div>}
          </div>
        )}
      </div>

      {modaleTestoAperto === 'email' && (() => {
        // Determina il template corretto in base al primo appuntamento selezionato
        const primo = Array.from(selezionati)
          .map(id => appuntamenti.find(a => a.id === id))
          .filter(Boolean)[0] as any;
        const isCheckup = primo?.tipo === 'checkup_nuovo';
        const templateBase = isCheckup ? templateEmailCheckupDefault : templateEmailDefault;
        return (
          <ModaleTestoPromemoria
            tipo="email"
            valoreIniziale={testoEmailCustom || templateBase || ''}
            onSave={(nuovo) => {
              setTestoEmailCustom(nuovo);
              sessionStorage.setItem('promemoria_testo_email', nuovo);
            }}
            onClose={() => setModaleTestoAperto(null)}
          />
        );
      })()}
      {modaleTestoAperto === 'whatsapp' && (
        <ModaleTestoPromemoria
          tipo="whatsapp"
          valoreIniziale={testoWhatsapp || config?.messaggioStandard || ''}
          onSave={(nuovo) => {
            setTestoWhatsapp(nuovo);
            sessionStorage.setItem('promemoria_testo_whatsapp', nuovo);
          }}
          onClose={() => setModaleTestoAperto(null)}
        />
      )}
    </div>
  );
}

function RigaPromemoria({
  app,
  selezionato,
  onToggle,
  formatDataShort,
}: {
  app: AppuntamentoProm;
  selezionato: boolean;
  onToggle: () => void;
  formatDataShort: (iso: string) => string;
}) {
  const troppoPresto = app.stato_invio === 'troppo_presto';

  return (
    <div
      className={`px-5 py-3 flex items-start gap-3 ${
        selezionato ? 'bg-blue-50/50' : troppoPresto ? 'opacity-70' : ''
      }`}
    >
      <input
        type="checkbox"
        checked={selezionato}
        onChange={onToggle}
        className="w-4 h-4 mt-1 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold text-sm text-gray-900">{app.cliente_nome || 'Cliente'}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {formatDataShort(app.data)} · {app.ora_inizio.slice(0, 5)} · {app.operatore || '—'}
            </div>
            {app.titolo && (
              <div className="text-xs text-gray-600 mt-0.5 truncate">{app.titolo}</div>
            )}
          </div>
          {/* Badge stato per canale */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            {troppoPresto && (
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-gray-100 text-gray-500 border-gray-200 whitespace-nowrap">
                ⚪ Troppo presto
              </span>
            )}
            {!troppoPresto && (
              <>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                  app.reminder_email_inviato
                    ? 'bg-green-100 text-green-700 border-green-200'
                    : 'bg-orange-50 text-orange-700 border-orange-200'
                }`}>
                  📧 {app.reminder_email_inviato ? 'Inviata' : 'Da inviare'}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                  app.reminder_whatsapp_inviato
                    ? 'bg-green-100 text-green-700 border-green-200'
                    : 'bg-orange-50 text-orange-700 border-orange-200'
                }`}>
                  💬 {app.reminder_whatsapp_inviato ? 'Inviato' : 'Da inviare'}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px]">
          {app.cliente_email && (
            <span className={app.reminder_email_inviato ? 'text-green-600 font-medium' : 'text-gray-500'}>
              📧 {app.cliente_email}
              {app.reminder_email_inviato && ' ✓'}
            </span>
          )}
          {app.cliente_cellulare && (
            <span className={app.reminder_whatsapp_inviato ? 'text-green-600 font-medium' : 'text-gray-500'}>
              💬 {app.cliente_cellulare}
              {app.reminder_whatsapp_inviato && ' ✓'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
