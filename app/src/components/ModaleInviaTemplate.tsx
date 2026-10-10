/**
 * ModaleInviaTemplate — invia un template manuale a un cliente
 * Chiavi supportate: post_seduta | auguri | riattiva
 */
import { useEffect, useState } from 'react';
import { getTestoTemplate, renderTemplate, type ChiaveTesto } from '../lib/testiTemplate';
import { inviaEmailConConfig } from '../lib/api';
import { inviaWhatsAppSmart } from '../lib/whatsapp';
import { useDatiAziendali } from '../lib/useDatiAziendali';
import type { Cliente } from '../lib/clienti';

interface ModaleInviaTemplateProps {
  chiave: ChiaveTesto;
  cliente: Cliente;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
  onError?: (msg: string) => void;
}

const TITOLI: Record<string, { icon: string; label: string }> = {
  whatsapp_post_seduta: { icon: '📸', label: 'Post-seduta' },
  whatsapp_compleanno: { icon: '🎂', label: 'Auguri compleanno' },
  whatsapp_riattivazione: { icon: '💤', label: 'Riattivazione' },
  email_post_seduta: { icon: '📸', label: 'Post-seduta' },
  email_compleanno: { icon: '🎂', label: 'Auguri compleanno' },
  email_riattivazione: { icon: '💤', label: 'Riattivazione' },
};

// Mappa: chiave base → chiave email / whatsapp
function chiaviDaBase(base: 'post_seduta' | 'compleanno' | 'riattivazione'): {
  email: ChiaveTesto;
  whatsapp: ChiaveTesto;
} {
  return {
    email: `email_${base}` as ChiaveTesto,
    whatsapp: `whatsapp_${base}` as ChiaveTesto,
  };
}

export function ModaleInviaTemplate({
  chiave,
  cliente,
  onClose,
  onSuccess,
  onError,
}: ModaleInviaTemplateProps) {
  const { dati: azienda } = useDatiAziendali();
  const [canale, setCanale] = useState<'whatsapp' | 'email'>('whatsapp');
  const [testoEmail, setTestoEmail] = useState<string>('');
  const [oggettoEmail, setOggettoEmail] = useState<string>('');
  const [testoWhatsApp, setTestoWhatsApp] = useState<string>('');
  const [caricando, setCaricando] = useState(true);
  const [inviando, setInviando] = useState(false);

  // Derivo base da chiave (post_seduta | auguri | riattiva)
  const base = chiave.replace(/^(email|whatsapp)_/, '') as 'post_seduta' | 'compleanno' | 'riattivazione';
  const chiavi = chiaviDaBase(base);

  const info = TITOLI[chiave] || { icon: '📤', label: 'Invia' };

  const nome = cliente.nome_cognome.split(' ')[0] || '';
  const cognome = cliente.nome_cognome.split(' ').slice(1).join(' ') || '';
  const variabili = {
    cliente: cliente.nome_cognome,
    nome,
    cognome,
    azienda: azienda.ragioneSociale || 'Studio',
    data: new Date().toLocaleDateString('it-IT'),
    data_estesa: (() => { try { const d = new Date(); const s = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); } catch { return ''; } })(),
  };

  useEffect(() => {
    let annullato = false;
    async function carica() {
      try {
        setCaricando(true);
        const [tmplEmail, tmplWA] = await Promise.all([
          getTestoTemplate(chiavi.email),
          getTestoTemplate(chiavi.whatsapp),
        ]);
        if (annullato) return;
        setOggettoEmail(renderTemplate(tmplEmail.oggetto || info.label, variabili));
        setTestoEmail(renderTemplate(tmplEmail.corpo, variabili));
        setTestoWhatsApp(renderTemplate(tmplWA.corpo, variabili));
      } catch (err) {
        console.error('Errore caricamento template:', err);
        if (!annullato) {
          setTestoEmail('Errore caricamento template.');
          setTestoWhatsApp('Errore caricamento template.');
        }
      } finally {
        if (!annullato) setCaricando(false);
      }
    }
    carica();
    return () => {
      annullato = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiave, cliente.id]);

  async function handleInvia() {
    setInviando(true);
    try {
      if (canale === 'whatsapp') {
        const tel = cliente.cellulare || '';
        const numPulito = tel.replace(/\D/g, '');
        if (!numPulito) {
          onError?.(`Nessun cellulare per ${cliente.nome_cognome}`);
          setInviando(false);
          return;
        }
        try {
          const res = await inviaWhatsAppSmart({
            cellulare: numPulito,
            messaggio: testoWhatsApp,
          });
          const msg = res.metodo === 'whatsender'
            ? `✅ WhatsApp inviato a ${cliente.nome_cognome}`
            : `💬 WhatsApp aperto per ${cliente.nome_cognome}`;
          onSuccess?.(msg);
          onClose();
        } catch (err: any) {
          onError?.(err?.message || 'Errore invio WhatsApp');
        } finally {
          setInviando(false);
        }
        return;
      }

      // Email
      if (!cliente.email || !cliente.email.trim()) {
        onError?.(`Nessuna email per ${cliente.nome_cognome}`);
        setInviando(false);
        return;
      }

      await inviaEmailConConfig({
        destinatario: cliente.email.trim(),
        oggetto: oggettoEmail,
        corpo_html: testoEmail,
      });
      onSuccess?.(`Email inviata a ${cliente.email}`);
      onClose();
    } catch (err: any) {
      console.error('Errore invio:', err);
      onError?.(err?.message || 'Errore durante l\'invio');
    } finally {
      setInviando(false);
    }
  }

  const puoInviare =
    canale === 'email'
      ? !!cliente.email?.trim() && testoEmail.trim().length > 0
      : testoWhatsApp.trim().length > 0;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[90]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-apple shadow-apple-lg max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-apple bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-lg shrink-0">
              {info.icon}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-apple-darkgray truncate">
                {info.label}
              </h3>
              <p className="text-xs text-apple-gray truncate">
                a {cliente.nome_cognome}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-apple-gray transition-colors shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Corpo scrollabile */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Canale */}
          <div>
            <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-2">
              Canale
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCanale('whatsapp')}
                disabled={!cliente.cellulare}
                className={`px-3 py-2.5 rounded-apple text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  canale === 'whatsapp'
                    ? 'bg-green-500 text-white shadow-apple'
                    : 'bg-gray-100 text-apple-darkgray hover:bg-gray-200'
                }`}
              >
                💬 WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setCanale('email')}
                disabled={!cliente.email}
                className={`px-3 py-2.5 rounded-apple text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  canale === 'email'
                    ? 'bg-apple-blue text-white shadow-apple'
                    : 'bg-gray-100 text-apple-darkgray hover:bg-gray-200'
                }`}
              >
                📧 Email
              </button>
            </div>
            {!cliente.cellulare && (
              <p className="text-[10px] text-amber-600 mt-1.5">
                ⚠️ Cellulare non configurato
              </p>
            )}
            {!cliente.email && (
              <p className="text-[10px] text-amber-600 mt-1.5">
                ⚠️ Email non configurata
              </p>
            )}
          </div>

          {/* Anteprima */}
          {caricando ? (
            <div className="bg-gray-50 rounded-apple p-4 text-center text-xs text-apple-gray">
              Caricamento anteprima...
            </div>
          ) : (
            <>
              {canale === 'email' && (
                <div>
                  <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-1.5">
                    Oggetto
                  </label>
                  <input
                    type="text"
                    value={oggettoEmail}
                    onChange={(e) => setOggettoEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-1.5">
                  Anteprima messaggio
                </label>
                <textarea
                  value={canale === 'email' ? testoEmail : testoWhatsApp}
                  onChange={(e) =>
                    canale === 'email'
                      ? setTestoEmail(e.target.value)
                      : setTestoWhatsApp(e.target.value)
                  }
                  rows={8}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-apple text-xs text-apple-darkgray font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-apple-blue/30 resize-none"
                />
                <p className="text-[10px] text-apple-gray mt-1">
                  Puoi modificare il testo prima dell'invio
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row gap-2 px-5 py-4 border-t border-gray-200/60 bg-gray-50/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={inviando}
            className="flex-1 px-4 py-3 sm:py-2.5 rounded-apple bg-gray-100 text-apple-darkgray text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleInvia}
            disabled={inviando || !puoInviare || caricando}
            className={`flex-1 px-4 py-3 sm:py-2.5 rounded-apple text-white text-sm font-semibold transition-colors shadow-apple disabled:opacity-50 disabled:cursor-not-allowed ${
              canale === 'whatsapp'
                ? 'bg-green-500 hover:bg-green-600'
                : 'bg-apple-blue hover:bg-blue-600'
            }`}
          >
            {inviando ? '⏳ Invio...' : canale === 'whatsapp' ? '📤 Invia WhatsApp' : '📧 Invia Email'}
          </button>
        </div>
      </div>
    </div>
  );
}
