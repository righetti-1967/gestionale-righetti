import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { inviaEmailConConfig } from '../lib/api';
import { NoteClienteSezione } from './NoteClienteSezione';

interface ClientePortal {
  client_id: number;
  nome_cognome: string;
  email: string | null;
  cellulare: string | null;
  has_settings: boolean;
  show_appointments: boolean;
  show_documents: boolean;
  show_percorsi: boolean;
  show_scheda_tricologica: boolean;
  show_cura_domiciliare: boolean;
  show_privacy_pdf: boolean;
  show_note: boolean;
  is_blocked: boolean;
  blocked_reason: string | null;
  account_created: boolean;
  account_email: string | null;
  pending_invite_token: string | null;
  pending_invite_expires_at: string | null;
  last_invite_token: string | null;
  last_invite_used_at: string | null;
}

const APP_CLIENTE_URL = 'https://cliente.righetti.club';

export function AppClienteTab() {
  const [clienti, setClienti] = useState<ClientePortal[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [ricerca, setRicerca] = useState('');
  const [filtroStato, setFiltroStato] = useState<'tutti' | 'attivi' | 'non_attivi' | 'bloccati'>('tutti');
  const [clienteSelezionato, setClienteSelezionato] = useState<ClientePortal | null>(null);

  async function carica() {
    setLoading(true);
    setErrore(null);
    const { data, error } = await supabase.rpc('admin_list_clients_with_portal_status');
    if (error) {
      setErrore(error.message);
    } else {
      setClienti((data as ClientePortal[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    carica();
  }, []);

  const clientiFiltrati = useMemo(() => {
    const q = ricerca.toLowerCase().trim();
    return clienti.filter((c) => {
      if (q && !c.nome_cognome.toLowerCase().includes(q) && !(c.email ?? '').toLowerCase().includes(q)) {
        return false;
      }
      if (filtroStato === 'attivi' && !c.account_created) return false;
      if (filtroStato === 'non_attivi' && c.account_created) return false;
      if (filtroStato === 'bloccati' && !c.is_blocked) return false;
      return true;
    });
  }, [clienti, ricerca, filtroStato]);

  const stats = useMemo(() => {
    return {
      totale: clienti.length,
      attivi: clienti.filter((c) => c.account_created && !c.is_blocked).length,
      nonAttivi: clienti.filter((c) => !c.account_created).length,
      bloccati: clienti.filter((c) => c.is_blocked).length,
    };
  }, [clienti]);

  return (
    <div className="space-y-4">
      {/* Header + statistiche */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">App Cliente</h2>
          <p className="text-sm text-gray-500">
            Gestisci visibilità, inviti e blocchi dell'area riservata.
          </p>
        </div>
        <button
          onClick={carica}
          className="w-full sm:w-auto px-4 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          🔄 Aggiorna
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Totale"
          value={stats.totale}
          active={filtroStato === 'tutti'}
          onClick={() => setFiltroStato('tutti')}
        />
        <StatCard
          label="Attivi"
          value={stats.attivi}
          color="green"
          active={filtroStato === 'attivi'}
          onClick={() => setFiltroStato('attivi')}
        />
        <StatCard
          label="Non attivi"
          value={stats.nonAttivi}
          color="gray"
          active={filtroStato === 'non_attivi'}
          onClick={() => setFiltroStato('non_attivi')}
        />
        <StatCard
          label="Bloccati"
          value={stats.bloccati}
          color="red"
          active={filtroStato === 'bloccati'}
          onClick={() => setFiltroStato('bloccati')}
        />
      </div>

      {/* Filtri */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="Cerca cliente..."
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
          className="w-full sm:flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filtroStato}
          onChange={(e) => setFiltroStato(e.target.value as any)}
          className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-200 rounded-lg"
        >
          <option value="tutti">Tutti</option>
          <option value="attivi">Solo attivi</option>
          <option value="non_attivi">Solo non attivi</option>
          <option value="bloccati">Solo bloccati</option>
        </select>
      </div>

      {/* Errore */}
      {errore && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Errore: {errore}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="text-center py-10 text-gray-400 text-sm">Caricamento…</div>
      ) : clientiFiltrati.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          {clienti.length === 0 ? 'Nessun cliente trovato.' : 'Nessun cliente corrisponde ai filtri.'}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left hidden md:table-cell">Email</th>
                <th className="px-3 py-2 text-center">Stato App</th>
                <th className="px-3 py-2 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {clientiFiltrati.map((c) => (
                <tr key={c.client_id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-900">{c.nome_cognome}</td>
                  <td className="px-3 py-2 text-gray-500 hidden md:table-cell">{c.email || '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <StatusBadge cliente={c} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setClienteSelezionato(c)}
                      className="px-3 py-1 text-xs bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100"
                    >
                      Gestisci
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modale dettaglio */}
      {clienteSelezionato && (
        <ClientePortalModal
          cliente={clienteSelezionato}
          onClose={() => setClienteSelezionato(null)}
          onAggiornato={() => {
            carica();
            setClienteSelezionato(null);
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color = 'blue',
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  color?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    gray: 'text-gray-500',
    red: 'text-red-600',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left bg-white rounded-lg border px-3 py-2 transition-all ${
        active
          ? 'border-blue-500 ring-2 ring-blue-100 shadow-sm'
          : 'border-gray-100 hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      <div className="text-xs text-gray-500 uppercase">{label}</div>
      <div className={`text-xl font-semibold ${colorMap[color]}`}>{value}</div>
    </button>
  );
}

function StatusBadge({ cliente }: { cliente: ClientePortal }) {
  if (cliente.is_blocked) {
    return <span className="inline-block px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-medium">🔴 Bloccato</span>;
  }
  if (cliente.account_created) {
    return <span className="inline-block px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">🟢 Attivo</span>;
  }
  if (cliente.pending_invite_token) {
    return <span className="inline-block px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 text-xs font-medium">🟡 Invitato</span>;
  }
  return <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">⚪ Non attivo</span>;
}

// ============================================
// MODALE DETTAGLIO CLIENTE
// ============================================
function ClientePortalModal({
  cliente,
  onClose,
  onAggiornato,
}: {
  cliente: ClientePortal;
  onClose: () => void;
  onAggiornato: () => void;
}) {
  const [showAppointments, setShowAppointments] = useState(cliente.show_appointments);
  const [showDocuments, setShowDocuments] = useState(cliente.show_documents);
  const [showPercorsi, setShowPercorsi] = useState(cliente.show_percorsi);
  const [showScheda, setShowScheda] = useState(cliente.show_scheda_tricologica);
  const [showCura, setShowCura] = useState(cliente.show_cura_domiciliare);
  const [showPrivacyPdf, setShowPrivacyPdf] = useState(cliente.show_privacy_pdf);
  const [showNote, setShowNote] = useState(cliente.show_note);
  const [isBlocked, setIsBlocked] = useState(cliente.is_blocked);
  const [blockedReason, setBlockedReason] = useState(cliente.blocked_reason || '');
  const [saving, setSaving] = useState(false);
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [invitoGenerato, setInvitoGenerato] = useState<string | null>(null);
  const [inviandoEmail, setInviandoEmail] = useState(false);
  const [emailInviata, setEmailInviata] = useState(false);

  async function salvaVisibilita() {
    setSaving(true);
    setErrore(null);
    setMessaggio(null);
    const { error } = await supabase.rpc('admin_upsert_portal_settings', {
      client_id_input: cliente.client_id,
      show_appointments_input: showAppointments,
      show_documents_input: showDocuments,
      show_percorsi_input: showPercorsi,
      show_scheda_tricologica_input: showScheda,
      show_cura_domiciliare_input: showCura,
      show_privacy_pdf_input: showPrivacyPdf,
      show_note_input: showNote,
    });
    setSaving(false);
    if (error) setErrore(error.message);
    else setMessaggio('Visibilità salvata ✅');
  }

  async function salvaBlocco() {
    if (isBlocked && blockedReason.trim().length < 5) {
      setErrore('Inserisci un motivo per il blocco (min 5 caratteri)');
      return;
    }
    setSaving(true);
    setErrore(null);
    setMessaggio(null);
    const { error } = await supabase.rpc('admin_toggle_portal_block', {
      client_id_input: cliente.client_id,
      blocked_input: isBlocked,
      reason_input: blockedReason,
    });
    setSaving(false);
    if (error) setErrore(error.message);
    else setMessaggio(isBlocked ? 'Accesso bloccato 🔒' : 'Accesso sbloccato 🔓');
  }

  async function generaInvito() {
    setSaving(true);
    setErrore(null);
    setMessaggio(null);
    setEmailInviata(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setErrore('Sessione scaduta. Ricarica la pagina.');
        setSaving(false);
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-invite-link`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ client_id: cliente.client_id }),
        }
      );

      const json = await res.json();
      setSaving(false);

      if (!res.ok || !json.success) {
        setErrore(json.error || 'Errore generazione link');
        return;
      }

      setInvitoGenerato(json.action_link);
    } catch (e: any) {
      setSaving(false);
      setErrore(e.message || 'Errore di rete');
    }
  }

  async function inviaEmailInvito() {
    if (!invitoGenerato || !cliente.email) {
      setErrore('Nessun link o email cliente');
      return;
    }
    setInviandoEmail(true);
    setErrore(null);
    setEmailInviata(false);

    const nomeCliente = cliente.nome_cognome.split(' ')[0] || cliente.nome_cognome;
    const corpoHtml = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <h2 style="font-size:22px;font-weight:600;color:#111827;margin:0 0 12px;text-align:center;letter-spacing:-0.02em;">
          Ciao ${nomeCliente},
        </h2>
        <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 28px;text-align:center;">
          sei stato invitato ad accedere alla tua <strong>Area Riservata</strong>.<br>
          Clicca il pulsante qui sotto per iniziare.
        </p>
        <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
          <tr>
            <td align="center" style="background:#FF9500;border-radius:12px;">
              <a href="${invitoGenerato}" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif;border-radius:12px;">
                Accedi all'Area Riservata
              </a>
            </td>
          </tr>
        </table>
        <p style="font-size:13px;color:#9ca3af;margin:32px 0 0;text-align:center;line-height:1.6;">
          Se il pulsante non funziona, copia questo link:<br>
          <a href="${invitoGenerato}" style="color:#FF9500;word-break:break-all;font-size:12px;">${invitoGenerato}</a>
        </p>
        <p style="font-size:12px;color:#9ca3af;margin:16px 0 0;text-align:center;">
          Il link è valido per 7 giorni.
        </p>
      </div>
    `;

    try {
      const res = await inviaEmailConConfig({
        destinatario: cliente.email,
        oggetto: 'Accedi alla tua Area Riservata',
        corpo_html: corpoHtml,
      });
      if (res.success) {
        setEmailInviata(true);
        setMessaggio('Email inviata ✅');
      } else {
        setErrore(res.messaggio || 'Errore invio email');
      }
    } catch (e: any) {
      setErrore(e.message || 'Errore invio email');
    } finally {
      setInviandoEmail(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">{cliente.nome_cognome}</h3>
            <p className="text-xs text-gray-500">{cliente.email || 'Nessuna email'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Stato account */}
          <section>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Stato account</h4>
            <div className="flex items-center gap-2 text-sm">
              <StatusBadge cliente={cliente} />
              {cliente.account_email && (
                <span className="text-gray-500">Account: {cliente.account_email}</span>
              )}
            </div>
          </section>

          {/* Visibilità moduli */}
          <section>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Visibilità moduli</h4>
            <div className="space-y-2">
              <Toggle label="📅 Appuntamenti (passati e futuri)" checked={showAppointments} onChange={setShowAppointments} />
              <Toggle label="📄 Documenti (fatture, DDT, scontrini)" checked={showDocuments} onChange={setShowDocuments} />
              <Toggle label="💼 Percorsi attivi (senza residui)" checked={showPercorsi} onChange={setShowPercorsi} />
              <Toggle label="📋 Scheda tricologica" checked={showScheda} onChange={setShowScheda} />
              <Toggle label="🏠 Cura domiciliare" checked={showCura} onChange={setShowCura} />
              <Toggle label="📋 Privacy firmata (PDF 2 pagine)" checked={showPrivacyPdf} onChange={setShowPrivacyPdf} />
              <Toggle label="📝 Note studio" checked={showNote} onChange={setShowNote} />
            </div>
            <button
              onClick={salvaVisibilita}
              disabled={saving}
              className="mt-3 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Salvo…' : 'Salva visibilità'}
            </button>
          </section>

          {/* Blocco */}
          <section>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Blocco accesso</h4>
            <Toggle label="🔒 Blocca accesso all'app" checked={isBlocked} onChange={setIsBlocked} />
            {isBlocked && (
              <textarea
                value={blockedReason}
                onChange={(e) => setBlockedReason(e.target.value)}
                placeholder="Motivo del blocco (visibile internamente)"
                className="mt-2 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                rows={2}
              />
            )}
            <button
              onClick={salvaBlocco}
              disabled={saving}
              className={`mt-3 px-4 py-2 text-sm rounded-lg disabled:opacity-50 ${
                isBlocked ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {saving ? 'Salvo…' : isBlocked ? 'Applica blocco' : 'Sblocca accesso'}
            </button>
          </section>

          {/* Invito */}
          <section>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Link di invito</h4>
            <p className="text-xs text-gray-500 mb-2">
              Genera un link monouso (valido 7 giorni) da inviare al cliente via email o WhatsApp.
            </p>
            {cliente.pending_invite_token && !invitoGenerato && (
              <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                Invito pendente creato {cliente.pending_invite_expires_at ? new Date(cliente.pending_invite_expires_at).toLocaleDateString('it-IT') : ''}
              </div>
            )}
            <button
              onClick={generaInvito}
              disabled={saving}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Genero…' : '🔗 Genera nuovo link invito'}
            </button>

            {invitoGenerato && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-xs font-medium text-green-900 mb-1">Link generato:</div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={invitoGenerato}
                    className="flex-1 px-2 py-1 text-xs bg-white border border-green-200 rounded"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(invitoGenerato)}
                    className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Copia
                  </button>
                </div>
                <div className="mt-3 flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={inviaEmailInvito}
                    disabled={inviandoEmail || !cliente.email}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-xl hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {inviandoEmail ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Invio…
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Invia via email
                      </>
                    )}
                  </button>
                  <a
                    href={`https://wa.me/${cliente.cellulare ? cliente.cellulare.replace(/[^0-9]/g, '') : ''}?text=${encodeURIComponent('Ciao! Ecco il link per accedere alla tua Area Riservata: ' + invitoGenerato)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-500 rounded-xl hover:bg-green-600 active:scale-95 transition-all shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                    WhatsApp
                  </a>
                </div>
                {emailInviata && (
                  <div className="mt-2 text-xs text-green-700 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Email inviata con successo
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Feedback */}
          {errore && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{errore}</div>
          )}
          {messaggio && (
            <div className="p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">{messaggio}</div>
          )}

          {/* Note per il cliente */}
          <NoteClienteSezione clientId={cliente.client_id} />
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
            Chiudi
          </button>
          <button
            onClick={onAggiornato}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Applica e chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer py-1">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-blue-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </label>
  );
}
