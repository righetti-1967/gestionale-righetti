import { useEffect, useMemo, useState } from 'react';
import {
  calcolaTotaliGiorno,
  getChiusuraGiornaliera,
  salvaChiusuraCassa,
  dataOggi,
  type ChiusuraCassa,
} from '../lib/scontrini';
import { formatEuro } from '../lib/fatture';
import { useDatiAziendali } from '../lib/useDatiAziendali';
import { Toast, type ToastTipo } from './Toast';

interface ChiusuraCassaTabProps {
  onChiusuraSalvata?: () => void;
}

export function ChiusuraCassaTab({ onChiusuraSalvata }: ChiusuraCassaTabProps) {
  const { dati: azienda } = useDatiAziendali();
  const [data, setData] = useState(dataOggi());
  const [fondoIniziale, setFondoIniziale] = useState<number>(azienda.cassaFondoIniziale || 0);
  const [contantiContati, setContantiContati] = useState<number | ''>('');
  const [note, setNote] = useState('');

  const [totali, setTotali] = useState<{
    contanti: number;
    carta: number;
    bancomat: number;
    bonifico: number;
    altro: number;
    totale: number;
    numeroScontrini: number;
  } | null>(null);

  const [chiusuraEsistente, setChiusuraEsistente] = useState<ChiusuraCassa | null>(null);
  const [caricando, setCaricando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState<{ message: string; tipo: ToastTipo } | null>(null);

  // Carica fondo iniziale da azienda appena disponibile
  useEffect(() => {
    if (azienda.cassaFondoIniziale) {
      setFondoIniziale(azienda.cassaFondoIniziale);
    }
  }, [azienda.cassaFondoIniziale]);

  // Ricarica dati quando cambia data
  useEffect(() => {
    let annullato = false;
    async function carica() {
      try {
        setCaricando(true);
        const [t, ch] = await Promise.all([
          calcolaTotaliGiorno(data),
          getChiusuraGiornaliera(data),
        ]);
        if (annullato) return;
        setTotali(t);
        setChiusuraEsistente(ch);
        if (ch) {
          setFondoIniziale(Number(ch.fondo_cassa_iniziale) || 0);
          setContantiContati(Number(ch.contanti_contati) || '');
          setNote(ch.note || '');
        } else {
          setContantiContati('');
          setNote('');
        }
      } catch (err: any) {
        if (!annullato) {
          setToast({
            message: '❌ ' + (err?.message || 'Errore caricamento'),
            tipo: 'error',
          });
        }
      } finally {
        if (!annullato) setCaricando(false);
      }
    }
    carica();
    return () => {
      annullato = true;
    };
  }, [data]);

  // Contanti attesi + differenza
  const contantiAttesi = useMemo(() => {
    if (!totali) return 0;
    return Number((totali.contanti + fondoIniziale).toFixed(2));
  }, [totali, fondoIniziale]);

  const contantiContatiNum = typeof contantiContati === 'number' ? contantiContati : 0;
  const differenza = useMemo(() => {
    if (contantiContati === '') return 0;
    return Number((contantiContatiNum - contantiAttesi).toFixed(2));
  }, [contantiContatiNum, contantiAttesi, contantiContati]);

  function coloreDifferenza(): string {
    if (contantiContati === '') return 'text-apple-gray';
    const abs = Math.abs(differenza);
    if (abs < 0.01) return 'text-green-600';
    if (abs <= 5) return 'text-amber-600';
    return 'text-red-600';
  }

  function messaggioDifferenza(): string {
    if (contantiContati === '') return 'In attesa del conteggio contanti';
    const abs = Math.abs(differenza);
    if (abs < 0.01) return '✅ Cassa quadra';
    if (differenza > 0) return `➕ Eccedenza di ${formatEuro(differenza)}`;
    return `➖ Ammanco di ${formatEuro(Math.abs(differenza))}`;
  }

  async function handleSalva() {
    try {
      setSalvando(true);
      const ch = await salvaChiusuraCassa({
        data,
        fondoIniziale,
        contantiContati: contantiContati === '' ? undefined : contantiContatiNum,
        note: note.trim() || null,
      });
      setChiusuraEsistente(ch);
      setToast({ message: '✅ Chiusura cassa salvata', tipo: 'success' });
      onChiusuraSalvata?.();
    } catch (err: any) {
      setToast({
        message: '❌ ' + (err?.message || 'Errore salvataggio'),
        tipo: 'error',
      });
    } finally {
      setSalvando(false);
    }
  }

  function handleStampaZ() {
    // Genera HTML di stampa in nuova finestra
    const dataIt = new Date(data).toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Chiusura Cassa ${data}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; padding: 20px; max-width: 400px; margin: 0 auto; }
          .center { text-align: center; }
          .row { display: flex; justify-content: space-between; margin: 3px 0; }
          .line { border-top: 1px dashed #000; margin: 8px 0; }
          .bold { font-weight: bold; }
          .big { font-size: 14px; }
          .small { font-size: 10px; }
          .differenza-ok { color: green; }
          .differenza-warn { color: orange; }
          .differenza-err { color: red; }
          @media print {
            body { padding: 5mm; max-width: 80mm; }
          }
        </style>
      </head>
      <body>
        <div class="center bold big">${azienda.ragioneSociale || 'Studio'}</div>
        ${azienda.partitaIva ? `<div class="center small">P.IVA ${azienda.partitaIva}</div>` : ''}
        <div class="center small">${azienda.sedeOperativa?.indirizzo || azienda.sedeLegale?.indirizzo || ''}</div>
        <div class="center small">${azienda.sedeOperativa?.cap || azienda.sedeLegale?.cap || ''} ${azienda.sedeOperativa?.citta || azienda.sedeLegale?.citta || ''}</div>
        <div class="line"></div>
        <div class="center bold">CHIUSURA CASSA GIORNALIERA</div>
        <div class="center small">${dataIt}</div>
        <div class="line"></div>

        <div class="bold">INCASSI DEL GIORNO</div>
        <div class="row"><span>💵 Contanti</span><span>${formatEuro(totali?.contanti || 0)}</span></div>
        <div class="row"><span>💳 Carta</span><span>${formatEuro(totali?.carta || 0)}</span></div>
        <div class="row"><span>📱 Bancomat</span><span>${formatEuro(totali?.bancomat || 0)}</span></div>
        <div class="row"><span>🏦 Bonifico</span><span>${formatEuro(totali?.bonifico || 0)}</span></div>
        <div class="row"><span>➕ Altro</span><span>${formatEuro(totali?.altro || 0)}</span></div>
        <div class="line"></div>
        <div class="row bold"><span>TOTALE INCASSI</span><span>${formatEuro(totali?.totale || 0)}</span></div>
        <div class="row small"><span>N. scontrini emessi</span><span>${totali?.numeroScontrini || 0}</span></div>

        <div class="line"></div>
        <div class="bold">CASSA CONTANTI</div>
        <div class="row"><span>Fondo cassa iniziale</span><span>${formatEuro(fondoIniziale)}</span></div>
        <div class="row"><span>Incassi contanti</span><span>${formatEuro(totali?.contanti || 0)}</span></div>
        <div class="row bold"><span>Contanti attesi</span><span>${formatEuro(contantiAttesi)}</span></div>
        ${contantiContati !== '' ? `
          <div class="row"><span>Contanti contati</span><span>${formatEuro(contantiContatiNum)}</span></div>
          <div class="row bold ${Math.abs(differenza) < 0.01 ? 'differenza-ok' : Math.abs(differenza) <= 5 ? 'differenza-warn' : 'differenza-err'}">
            <span>Differenza</span><span>${differenza >= 0 ? '+' : ''}${formatEuro(differenza)}</span>
          </div>
        ` : ''}

        ${note ? `
          <div class="line"></div>
          <div class="bold small">NOTE</div>
          <div class="small">${note}</div>
        ` : ''}

        <div class="line"></div>
        <div class="center small">
          ${new Date().toLocaleString('it-IT')}
        </div>
        <div class="center small bold">CHIUSURA Z</div>
      </body>
      </html>
    `;

    const win = window.open('', '_blank', 'width=500,height=800');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
      }, 500);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header con data + stato */}
      <div className="bg-white rounded-apple shadow-apple p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-1.5">
              📅 Data chiusura
            </label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full sm:w-64 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-apple text-sm font-semibold text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
            />
          </div>
          {chiusuraEsistente && (
            <div className="shrink-0 px-4 py-2 bg-green-50 border border-green-200 rounded-apple text-xs">
              <p className="font-bold text-green-700">✅ Chiusura già effettuata</p>
              <p className="text-green-600 text-[10px] mt-0.5">
                {chiusuraEsistente.chiusa_at
                  ? new Date(chiusuraEsistente.chiusa_at).toLocaleString('it-IT')
                  : ''}
              </p>
            </div>
          )}
        </div>
      </div>

      {caricando ? (
        <div className="bg-white rounded-apple shadow-apple p-12 text-center text-apple-gray text-sm">
          Caricamento...
        </div>
      ) : (
        <>
          {/* Riepilogo incassi */}
          <div className="bg-white rounded-apple shadow-apple p-4 sm:p-6">
            <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
              💰 Incassi del giorno
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <CardIncasso
                icon="💵"
                label="Contanti"
                importo={totali?.contanti || 0}
                colore="green"
              />
              <CardIncasso
                icon="💳"
                label="Carta"
                importo={totali?.carta || 0}
                colore="blue"
              />
              <CardIncasso
                icon="📱"
                label="Bancomat"
                importo={totali?.bancomat || 0}
                colore="blue"
              />
              <CardIncasso
                icon="🏦"
                label="Bonifico"
                importo={totali?.bonifico || 0}
                colore="purple"
              />
              <CardIncasso
                icon="➕"
                label="Altro"
                importo={totali?.altro || 0}
                colore="gray"
              />
              <CardIncasso
                icon="📊"
                label="Totale"
                importo={totali?.totale || 0}
                colore="dark"
                evidenzia
              />
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between text-sm">
              <span className="text-apple-gray">N. scontrini emessi:</span>
              <span className="font-bold text-apple-darkgray">
                {totali?.numeroScontrini || 0}
              </span>
            </div>
          </div>

          {/* Cassa contanti */}
          <div className="bg-white rounded-apple shadow-apple p-4 sm:p-6">
            <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
              🧮 Cassa Contanti
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm text-apple-darkgray">
                  Fondo cassa iniziale
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={fondoIniziale}
                  onChange={(e) => setFondoIniziale(parseFloat(e.target.value) || 0)}
                  className="w-32 px-3 py-2 bg-gray-50 border border-gray-200 rounded-apple text-sm text-right font-semibold focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
                <span className="text-sm text-apple-gray">+ Incassi contanti</span>
                <span className="text-sm font-semibold text-apple-darkgray">
                  {formatEuro(totali?.contanti || 0)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 bg-blue-50 -mx-4 px-4 py-2 rounded">
                <span className="text-sm font-bold text-apple-blue">
                  = Contanti attesi
                </span>
                <span className="text-base font-bold text-apple-blue">
                  {formatEuro(contantiAttesi)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <label className="text-sm text-apple-darkgray">
                  Contanti contati (in cassa)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="—"
                  value={contantiContati}
                  onChange={(e) =>
                    setContantiContati(
                      e.target.value === '' ? '' : parseFloat(e.target.value) || 0
                    )
                  }
                  className="w-32 px-3 py-2 bg-gray-50 border border-gray-200 rounded-apple text-sm text-right font-semibold focus:outline-none focus:ring-2 focus:ring-apple-blue/30"
                />
              </div>

              <div className={`flex items-center justify-between gap-3 -mx-4 px-4 py-2 rounded ${differenza === 0 && contantiContati !== '' ? 'bg-green-50' : 'bg-gray-50'}`}>
                <span className={`text-sm font-bold ${coloreDifferenza()}`}>
                  {messaggioDifferenza()}
                </span>
                {contantiContati !== '' && (
                  <span className={`text-base font-bold ${coloreDifferenza()}`}>
                    {differenza >= 0 ? '+' : ''}
                    {formatEuro(differenza)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Note */}
          <div className="bg-white rounded-apple shadow-apple p-4 sm:p-6">
            <label className="block text-xs font-semibold text-apple-gray uppercase tracking-wide mb-2">
              📝 Note chiusura (opzionali)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Eventuali annotazioni sulla chiusura..."
              rows={2}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-apple text-sm text-apple-darkgray focus:outline-none focus:ring-2 focus:ring-apple-blue/30 resize-none"
            />
          </div>

          {/* Azioni */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSalva}
              disabled={salvando}
              className="flex-1 px-4 py-3 bg-apple-blue text-white rounded-apple font-bold text-sm hover:bg-blue-600 transition-colors shadow-apple disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {salvando
                ? '⏳ Salvataggio...'
                : chiusuraEsistente
                ? '🔄 Aggiorna chiusura'
                : '💾 Salva chiusura cassa'}
            </button>
            <button
              onClick={handleStampaZ}
              className="flex-1 px-4 py-3 bg-apple-darkgray text-white rounded-apple font-bold text-sm hover:bg-gray-700 transition-colors shadow-apple"
            >
              🖨️ Stampa Chiusura Z
            </button>
          </div>
        </>
      )}

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

// ============================================================
// CARD INCASSO
// ============================================================

function CardIncasso({
  icon,
  label,
  importo,
  colore,
  evidenzia,
}: {
  icon: string;
  label: string;
  importo: number;
  colore: 'green' | 'blue' | 'purple' | 'gray' | 'dark';
  evidenzia?: boolean;
}) {
  const colori = {
    green: 'bg-green-50 border-green-200 text-green-700',
    blue: 'bg-blue-50 border-blue-200 text-apple-blue',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    gray: 'bg-gray-50 border-gray-200 text-apple-gray',
    dark: 'bg-apple-darkgray border-apple-darkgray text-white',
  };

  return (
    <div className={`rounded-apple border p-3 ${colori[colore]} ${evidenzia ? 'shadow-apple' : ''}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">
        {icon} {label}
      </p>
      <p className={`text-lg font-bold mt-1 ${evidenzia ? 'text-xl' : ''}`}>
        {formatEuro(importo)}
      </p>
    </div>
  );
}
