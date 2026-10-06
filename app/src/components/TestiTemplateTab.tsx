import { useEffect, useMemo, useRef, useState } from 'react';
import { useDraft } from '../lib/useDraft';
import {
  type ChiaveTesto,
  type TestoTemplate,
  DEFAULT_TESTI,
  VARIABILI_PER_CHIAVE,
  ETICHETTE_CHIAVI,
  getTuttiTestiTemplate,
  salvaTestoTemplate,
  ripristinaTestoTemplate,
} from '../lib/testiTemplate';
import { Toast, type ToastTipo } from './Toast';
import { Button } from './Button';

type Gruppo = 'email' | 'whatsapp' | 'pdf';

export function TestiTemplateTab() {
  const [testi, setTesti] = useState<Record<ChiaveTesto, TestoTemplate> | null>(null);
  const [chiaveAttiva, setChiaveAttiva] = useState<ChiaveTesto>('email_privacy');
  const [gruppoAttivo, setGruppoAttivo] = useState<Gruppo>('email');

  // Stato editor
  const [oggetto, setOggetto] = useState('');
  const [corpo, setCorpo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState<{ message: string; tipo: ToastTipo } | null>(null);

  // Carica tutti i testi
  useEffect(() => {
    async function carica() {
      try {
        const tutti = await getTuttiTestiTemplate();
        setTesti(tutti);
      } catch (err: any) {
        setToast({
          message: '❌ ' + (err?.message || 'Errore caricamento'),
          tipo: 'error',
        });
      }
    }
    carica();
  }, []);

  // Quando cambia chiave attiva, aggiorna editor
  useEffect(() => {
    if (!testi) return;
    const t = testi[chiaveAttiva];
    setOggetto(t.oggetto || '');
    setCorpo(t.corpo || '');
  }, [chiaveAttiva, testi]);

  const chiaviDelGruppo = useMemo(() => {
    return (Object.keys(ETICHETTE_CHIAVI) as ChiaveTesto[]).filter(
      (k) => ETICHETTE_CHIAVI[k].gruppo === gruppoAttivo
    );
  }, [gruppoAttivo]);

  const variabiliDisponibili = VARIABILI_PER_CHIAVE[chiaveAttiva] || [];

  const oggettoVisibile = chiaveAttiva.startsWith('email_');
  const testoModificato = testi
    ? oggetto !== (testi[chiaveAttiva].oggetto || '') ||
      corpo !== (testi[chiaveAttiva].corpo || '')
    : false;

  async function handleSalva() {
    try {
      setSalvando(true);
      await salvaTestoTemplate(
        chiaveAttiva,
        oggettoVisibile && oggetto.trim() ? oggetto.trim() : null,
        corpo
      );

      setTesti((prev) =>
        prev
          ? {
              ...prev,
              [chiaveAttiva]: {
                ...prev[chiaveAttiva],
                oggetto: oggettoVisibile ? oggetto : null,
                corpo,
              },
            }
          : prev
      );

      await eliminaTestoDraft();
      setToast({ message: '✅ Testo salvato', tipo: 'success' });
    } catch (err: any) {
      setToast({
        message: '❌ ' + (err?.message || 'Errore salvataggio'),
        tipo: 'error',
      });
    } finally {
      setSalvando(false);
    }
  }

  async function handleRipristina() {
    if (!confirm('Ripristinare il testo di default? Le modifiche andranno perse.')) return;
    try {
      setSalvando(true);
      await ripristinaTestoTemplate(chiaveAttiva);

      const def = DEFAULT_TESTI[chiaveAttiva];
      setOggetto(def.oggetto || '');
      setCorpo(def.corpo);

      setTesti((prev) =>
        prev ? { ...prev, [chiaveAttiva]: { ...def } } : prev
      );

      setToast({ message: '🔄 Testo ripristinato al default', tipo: 'success' });
    } catch (err: any) {
      setToast({
        message: '❌ ' + (err?.message || 'Errore ripristino'),
        tipo: 'error',
      });
    } finally {
      setSalvando(false);
    }
  }

  function inserisciVariabile(v: string) {
    const token = `{${v}}`;
    const textarea = document.getElementById('corpo-editor') as HTMLTextAreaElement | null;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const nuovo =
        corpo.substring(0, start) + token + corpo.substring(end);
      setCorpo(nuovo);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + token.length, start + token.length);
      }, 0);
    } else {
      setCorpo((prev) => prev + ' ' + token);
    }
  }

  if (!testi) {
    return (
      <div className="bg-white rounded-apple shadow-apple p-8 sm:p-12 text-center text-apple-gray text-sm">
        Caricamento testi...
      </div>
    );
  }

  // === DRAFT TESTO (useDraft per chiave) ===
  const chiaveDraftTesto = `testo_${chiaveAttiva}_draft`;
  interface TestoDraft {
    oggetto: string;
    corpo: string;
  }
  const TESTO_DRAFT_DEFAULT: TestoDraft = { oggetto: '', corpo: '' };
  const {
    state: testoDraft,
    setState: setTestoDraft,
    eliminaDraft: eliminaTestoDraft,
    loading: testoDraftLoading,
  } = useDraft<TestoDraft>(chiaveDraftTesto, TESTO_DRAFT_DEFAULT);

  useEffect(() => {
    if (testoDraftLoading) return;
    setTestoDraft({ oggetto, corpo });
  }, [oggetto, corpo, testoDraftLoading]);

  const draftCaricatoRef = useRef(false);
  useEffect(() => {
    if (draftCaricatoRef.current || testoDraftLoading) return;
    if (testoDraft.oggetto || testoDraft.corpo) {
      setOggetto(testoDraft.oggetto);
      setCorpo(testoDraft.corpo);
    }
    draftCaricatoRef.current = true;
  }, [testoDraftLoading, testoDraft]);

  useEffect(() => {
    draftCaricatoRef.current = false;
  }, [chiaveAttiva]);

  return (
    <div className="space-y-4">
      {/* Card intro */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-apple p-3 sm:p-4 shadow-apple">
        <div className="flex items-start gap-2 sm:gap-3">
          <span className="text-xl sm:text-2xl shrink-0">📝</span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-apple-darkgray">
              Testi Messaggi
            </h3>
            <p className="text-xs text-apple-gray mt-1 leading-relaxed">
              Personalizza i testi di email e WhatsApp. Usa le variabili{' '}
              <code className="bg-white px-1 rounded text-[10px]">{'{nome}'}</code>,{' '}
              <code className="bg-white px-1 rounded text-[10px]">{'{azienda}'}</code> ecc.
              per inserire dati dinamici.
            </p>
          </div>
        </div>
      </div>

      {/* Gruppi */}
      <div className="flex flex-wrap gap-2">
        {([
          { id: 'email', label: '📧 Email', count: Object.values(ETICHETTE_CHIAVI).filter((v) => v.gruppo === 'email').length },
          { id: 'whatsapp', label: '💬 WhatsApp', count: Object.values(ETICHETTE_CHIAVI).filter((v) => v.gruppo === 'whatsapp').length },
        ] as const).map((g) => (
          <button
            key={g.id}
            onClick={() => {
              setGruppoAttivo(g.id);
              const primoDelGruppo = (Object.keys(ETICHETTE_CHIAVI) as ChiaveTesto[]).find(
                (k) => ETICHETTE_CHIAVI[k].gruppo === g.id
              );
              if (primoDelGruppo) setChiaveAttiva(primoDelGruppo);
            }}
            className={`px-3 sm:px-4 py-2 rounded-apple text-xs sm:text-sm font-semibold transition-all ${
              gruppoAttivo === g.id
                ? 'bg-apple-blue text-white shadow-apple'
                : 'bg-white text-apple-darkgray border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {g.label} ({g.count})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sidebar chiavi del gruppo (mobile: grid 2 col tutti visibili, desktop: colonna) */}
        <div className="lg:col-span-1 bg-white rounded-apple shadow-apple p-2 lg:p-0 lg:bg-transparent lg:shadow-none grid grid-cols-2 lg:flex lg:flex-col gap-1.5">
          {chiaviDelGruppo.map((k) => {
            const attivo = chiaveAttiva === k;
            const personalizzato = testi[k].corpo !== DEFAULT_TESTI[k].corpo;
            return (
              <button
                key={k}
                onClick={() => setChiaveAttiva(k)}
                className={`w-full text-left px-2.5 py-2 lg:px-3 lg:py-2.5 rounded-apple text-[11px] lg:text-xs font-medium transition-all flex items-center gap-1.5 lg:gap-2 ${
                  attivo
                    ? 'bg-apple-blue text-white shadow-apple'
                    : 'bg-gray-50 lg:bg-white text-apple-darkgray hover:bg-gray-100 lg:hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <span className="shrink-0">{ETICHETTE_CHIAVI[k].icona}</span>
                <span className="flex-1 leading-tight">{ETICHETTE_CHIAVI[k].label}</span>
                {personalizzato && !attivo && (
                  <span className="shrink-0 w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-amber-500" title="Personalizzato" />
                )}
              </button>
            );
          })}
        </div>

        {/* Editor */}
        <div className="lg:col-span-3 bg-white rounded-apple shadow-apple p-4 sm:p-6 space-y-4">
          <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
            <h3 className="text-sm sm:text-base font-bold text-apple-darkgray">
              {ETICHETTE_CHIAVI[chiaveAttiva].icona} {ETICHETTE_CHIAVI[chiaveAttiva].label}
            </h3>
            {testi[chiaveAttiva].corpo !== DEFAULT_TESTI[chiaveAttiva].corpo && (
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                Personalizzato
              </span>
            )}
          </div>

          {/* Oggetto (solo email) */}
          {oggettoVisibile && (
            <div>
              <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-1.5">
                Oggetto email
              </label>
              <input
                type="text"
                value={oggetto}
                onChange={(e) => setOggetto(e.target.value)}
                placeholder="Oggetto dell'email..."
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
              />
            </div>
          )}

          {/* Variabili */}
          <div>
            <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-2">
              Variabili disponibili (clicca per inserire)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {variabiliDisponibili.map((v: string) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => inserisciVariabile(v)}
                  className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-apple-blue rounded-apple text-[11px] font-mono font-semibold transition-colors"
                >
                  {`{${v}}`}
                </button>
              ))}
            </div>
          </div>

          {/* Corpo */}
          <div>
            <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-1.5">
              Corpo del messaggio
            </label>
            <textarea
              id="corpo-editor"
              value={corpo}
              onChange={(e) => setCorpo(e.target.value)}
              rows={14}
              className="w-full px-3.5 py-3 bg-gray-50 border border-gray-200 rounded-apple text-xs text-apple-darkgray font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-apple-blue/30 resize-y"
            />
            <p className="text-[10px] text-apple-gray mt-1">
              {corpo.length} caratteri
            </p>
          </div>

          {/* Azioni */}
          <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-2 border-t border-gray-100">
            <Button
              variant="secondary"
              size="md"
              onClick={handleRipristina}
              disabled={salvando}
            >
              🔄 Ripristina default
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSalva}
              disabled={salvando || !testoModificato}
            >
              {salvando ? '⏳ Salvataggio...' : '💾 Salva testo'}
            </Button>
          </div>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          tipo={toast.tipo}
          onComplete={() => setToast(null)}
        />
      )}
    </div>
  );
}
