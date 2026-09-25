import { useState } from 'react';
import type { ScaricoConCliente } from '../lib/scarichi';
import { eliminaScarico } from '../lib/scarichi';
import { creaMovimento } from '../lib/magazzino';
import {
  AnteprimaPdf,
  IntestazionePdf,
  BandaBluPdf,
  FooterPdf,
} from './AnteprimaPdf';

interface DettaglioDdtProps {
  scarico: ScaricoConCliente;
  onClose: () => void;
  onFirma: () => void;
  onInvia: (canale: 'email' | 'whatsapp') => void;
  onScaricaPdf: (tipo: 'cliente' | 'commercialista') => void;
  onEliminato?: () => void;
}

export function DettaglioDdt({
  scarico,
  onClose,
  onFirma,
  onInvia,
  onScaricaPdf,
  onEliminato,
}: DettaglioDdtProps) {
  const [anteprima, setAnteprima] = useState<'cliente' | 'commercialista' | null>(null);
  const [showConfermaElimina, setShowConfermaElimina] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  function formatEuro(importo: number): string {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(importo);
  }

  function formatData(data: string | null): string {
    if (!data) return '—';
    try {
      return new Date(data).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  }

  function formatDataOra(data: string | null): string {
    if (!data) return '—';
    try {
      return new Date(data).toLocaleString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  }

  async function handleEliminaDdt() {
    try {
      setEliminando(true);
      setErrore(null);

      const dataOggi = new Date().toISOString().split('T')[0];
      for (const riga of scarico.righe || []) {
        if (riga.tipo === 'prodotto' && riga.prodotto_id) {
          try {
            await creaMovimento({
              prodotto_id: riga.prodotto_id,
              tipo: 'carico',
              quantita: riga.quantita,
              motivo: `Storno annullamento DDT-${scarico.numero_ddt}`,
              note: `Ripristino scorte per DDT eliminato`,
              data_movimento: dataOggi,
            });
          } catch (errMag) {
            console.error('Errore ripristino magazzino:', errMag);
          }
        }
      }

      await eliminaScarico(scarico.id);

      if (onEliminato) {
        onEliminato();
      } else {
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrore(msg || "Errore nell'eliminazione del DDT");
      setEliminando(false);
    }
  }

  const anno = new Date(scarico.data_seduta).getFullYear();
  const numeroFormattato = `DDT-${String(scarico.numero_ddt).padStart(3, '0')}-${anno}`;

  // Calcolo totale imponibile escludendo gli extra
  const totaleNettoPercorso = (scarico.righe || [])
    .filter((r) => !r.nome.includes('(EXTRA Percorso)'))
    .reduce((sum, r) => sum + r.quantita * r.netto_iva_scontato, 0);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-apple shadow-apple-lg max-w-2xl w-full my-8 p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-apple bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-2xl">
                📋
              </div>
              <div>
                <h2 className="text-xl font-bold text-apple-darkgray">
                  {numeroFormattato}
                </h2>
                <p className="text-xs text-apple-gray">
                  {scarico.cliente?.nome_cognome || '—'} • ID {scarico.id}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-apple-gray transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-gray-50 rounded-apple p-3">
              <p className="text-xs text-apple-gray mb-1">📅 Data seduta</p>
              <p className="text-sm font-semibold text-apple-darkgray">
                {formatData(scarico.data_seduta)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-apple p-3">
              <p className="text-xs text-apple-gray mb-1">📄 Rif. Fattura madre</p>
              <p className="text-sm font-semibold text-apple-darkgray">
                ID {scarico.fattura_madre_id}
              </p>
            </div>
          </div>

          <div className="mb-6">
            {scarico.firmato ? (
              <div className="bg-green-50 border border-green-200 rounded-apple p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-green-700 uppercase">
                      ✓ Firmato dal cliente
                    </p>
                    {scarico.data_firma && (
                      <p className="text-xs text-apple-gray mt-0.5">
                        il {formatDataOra(scarico.data_firma)}
                      </p>
                    )}
                  </div>
                </div>
                {scarico.firma_immagine && (
                  <div className="mt-3 bg-white rounded-apple p-3 border border-green-100">
                    <img
                      src={scarico.firma_immagine}
                      alt="Firma cliente"
                      className="max-w-full h-auto"
                      style={{ maxHeight: '80px' }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-apple p-3">
                <p className="text-xs font-semibold text-amber-700 uppercase">
                  ⏳ Non firmato
                </p>
                <p className="text-xs text-apple-gray mt-0.5">
                  Il cliente non ha ancora firmato questo DDT
                </p>
              </div>
            )}
          </div>

          <div className="mb-6">
            <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-3">
              🛠️📦 Voci Consegnate ({scarico.righe?.length || 0})
            </h3>
            <div className="bg-gray-50 rounded-apple overflow-hidden">
              {scarico.righe && scarico.righe.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {scarico.righe.map((r, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5">
                      <p className="text-sm text-apple-darkgray">
                        {r.tipo === 'servizio' ? '🛠️' : '📦'} {r.nome}
                      </p>
                      <span className="text-sm font-semibold text-apple-darkgray shrink-0 ml-2">
                        × {r.quantita}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-6 text-center text-xs text-apple-gray">
                  (nessuna voce)
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-gray-50 rounded-apple p-3">
              <p className="text-xs text-apple-gray mb-1">Totale lordo (rif.)</p>
              <p className="text-sm font-bold text-apple-darkgray">
                {formatEuro(Number(scarico.totale_lordo_scontato || 0))}
              </p>
            </div>
            <div className="bg-gray-50 rounded-apple p-3">
              <p className="text-xs text-apple-gray mb-1">Totale imponibile di competenza</p>
              <p className="text-sm font-bold text-apple-blue">
                {formatEuro(Number(totaleNettoPercorso))}
              </p>
            </div>
          </div>

          {scarico.note && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-apple-gray uppercase tracking-wide mb-2">
                📝 Note
              </h3>
              <p className="text-xs text-apple-gray italic bg-gray-50 rounded-apple p-3 whitespace-pre-wrap">
                {scarico.note}
              </p>
            </div>
          )}

          {errore && (
            <div className="bg-red-50 border border-red-200 rounded-apple p-3 text-red-700 text-sm mb-4">
              ❌ {errore}
            </div>
          )}

          <div className="pt-6 border-t border-gray-200/60 flex flex-wrap gap-2">
            <button
              onClick={() => setAnteprima('cliente')}
              className="flex-1 min-w-[130px] px-4 py-2.5 bg-apple-darkgray text-white rounded-apple font-medium text-sm hover:bg-gray-800 transition-colors"
            >
              👁️ Anteprima Cliente
            </button>
            <button
              onClick={() => setAnteprima('commercialista')}
              className="flex-1 min-w-[150px] px-4 py-2.5 bg-amber-600 text-white rounded-apple font-medium text-sm hover:bg-amber-700 transition-colors"
            >
              👁️ Anteprima Comm.
            </button>
            {!scarico.firmato && (
              <button
                onClick={onFirma}
                className="flex-1 min-w-[110px] px-4 py-2.5 bg-purple-600 text-white rounded-apple font-medium text-sm hover:bg-purple-700 transition-colors"
              >
                ✍️ Firma
              </button>
            )}
            <button
              onClick={() => onInvia('email')}
              className="flex-1 min-w-[110px] px-4 py-2.5 rounded-apple font-medium text-sm transition-colors bg-blue-50 text-apple-blue hover:bg-blue-100"
            >
              📧 Email
            </button>
            <button
              onClick={() => onInvia('whatsapp')}
              className="flex-1 min-w-[110px] px-4 py-2.5 rounded-apple font-medium text-sm transition-colors bg-green-50 text-green-700 hover:bg-green-100"
            >
              💬 WhatsApp
            </button>
            <button
              onClick={() => onScaricaPdf('cliente')}
              className="flex-1 min-w-[110px] px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors"
            >
              📄 PDF
            </button>
            <button
              onClick={() => setShowConfermaElimina(true)}
              className="px-4 py-2.5 bg-red-50 text-red-600 rounded-apple font-medium text-sm hover:bg-red-100 transition-colors"
              title="Annulla ed elimina questo DDT"
            >
              🗑️ Elimina DDT
            </button>
          </div>
        </div>
      </div>

      {showConfermaElimina && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[70]"
          onClick={() => setShowConfermaElimina(false)}
        >
          <div
            className="bg-white rounded-apple shadow-apple-lg max-w-sm w-full p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center text-2xl">
              ⚠️
            </div>
            <h2 className="text-lg font-bold text-apple-darkgray mb-2">
              Annullare questo DDT?
            </h2>
            <p className="text-xs text-apple-gray mb-4 leading-relaxed">
              Le voci scaricate torneranno <strong>automaticamente disponibili nel Percorso</strong> e le scorte di magazzino verranno ricaricate.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfermaElimina(false)}
                disabled={eliminando}
                className="flex-1 px-4 py-2.5 bg-gray-100 text-apple-darkgray rounded-apple font-medium text-sm hover:bg-gray-200 transition-colors"
              >
                No, mantieni
              </button>
              <button
                onClick={handleEliminaDdt}
                disabled={eliminando}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-apple font-medium text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {eliminando ? 'Annullamento...' : 'Sì, elimina DDT'}
              </button>
            </div>
          </div>
        </div>
      )}

      {anteprima === 'cliente' && (
        <AnteprimaPdf
          titolo="Anteprima DDT Cliente"
          sottotitolo={`${numeroFormattato} - ${scarico.cliente?.nome_cognome || ''}`}
          onScarica={() => {
            setAnteprima(null);
            onScaricaPdf('cliente');
          }}
          labelScarica="📄 Scarica PDF Cliente"
          onClose={() => setAnteprima(null)}
        >
          <ContenutoAnteprima scarico={scarico} tipo="cliente" formatEuro={formatEuro} formatData={formatData} />
        </AnteprimaPdf>
      )}

      {anteprima === 'commercialista' && (
        <AnteprimaPdf
          titolo="Anteprima Documento di Competenza"
          sottotitolo={`${numeroFormattato} - ${scarico.cliente?.nome_cognome || ''}`}
          onScarica={() => {
            setAnteprima(null);
            onScaricaPdf('commercialista');
          }}
          labelScarica="📊 Scarica PDF Documento di Competenza"
          coloreScarica="amber"
          onClose={() => setAnteprima(null)}
        >
          <ContenutoAnteprima scarico={scarico} tipo="commercialista" formatEuro={formatEuro} formatData={formatData} />
        </AnteprimaPdf>
      )}
    </>
  );
}

function ContenutoAnteprima({
  scarico,
  tipo,
  formatEuro,
  formatData,
}: {
  scarico: ScaricoConCliente;
  tipo: 'cliente' | 'commercialista';
  formatEuro: (n: number) => string;
  formatData: (d: string | null) => string;
}) {
  const mostraPrezzi = tipo === 'commercialista';
  const anno = new Date(scarico.data_seduta).getFullYear();
  const numeroFormattato = `DDT-${String(scarico.numero_ddt).padStart(3, '0')}-${anno}`;

  // Se commercialista, esclude le righe EXTRA dal documento e dal totale
  const righeDaMostrare = mostraPrezzi
    ? (scarico.righe || []).filter((r) => !r.nome.includes('(EXTRA Percorso)'))
    : (scarico.righe || []);

  const totaleNetto = righeDaMostrare.reduce(
    (sum, r) => sum + r.quantita * r.netto_iva_scontato,
    0
  );

  return (
    <>
      <IntestazionePdf />
      <BandaBluPdf
        testo={
          mostraPrezzi
            ? `DOCUMENTO DI COMPETENZA | ${numeroFormattato}`
            : `SEDUTA IN STUDIO | ${numeroFormattato}`
        }
        anno={anno}
      />

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase mb-1">DATI DDT</p>
          <p className="text-sm">Data seduta: {formatData(scarico.data_seduta)}</p>
          <p className="text-sm">Rif. Fattura madre ID {scarico.fattura_madre_id}</p>
        </div>
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase mb-1">CLIENTE</p>
          <p className="text-sm font-bold">{scarico.cliente?.nome_cognome || '—'}</p>
          {scarico.cliente?.indirizzo_residenza && (
            <p className="text-sm">
              {scarico.cliente.indirizzo_residenza}
              {scarico.cliente.cap_residenza && `, ${scarico.cliente.cap_residenza}`}
              {scarico.cliente.citta_residenza && ` ${scarico.cliente.citta_residenza}`}
            </p>
          )}
          {scarico.cliente?.codice_fiscale && (
            <p className="text-sm">C.F.: {scarico.cliente.codice_fiscale.toUpperCase()}</p>
          )}
          {scarico.cliente?.partita_iva && (
            <p className="text-sm">P.IVA: {scarico.cliente.partita_iva}</p>
          )}
        </div>
      </div>

      <p className="text-xs font-bold text-gray-500 uppercase mb-2">VOCI</p>
      <table className="w-full mb-6 text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left px-2 py-2 font-semibold text-gray-700">Descrizione</th>
            <th className="text-center px-2 py-2 font-semibold text-gray-700 w-16">Qta</th>
            {mostraPrezzi && (
              <>
                <th className="text-right px-2 py-2 font-semibold text-gray-700 w-24">Netto IVA</th>
                <th className="text-right px-2 py-2 font-semibold text-gray-700 w-24">Totale</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {righeDaMostrare.length > 0 ? (
            righeDaMostrare.map((r, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="px-2 py-2">{r.nome}</td>
                <td className="text-center px-2 py-2">{r.quantita}</td>
                {mostraPrezzi && (
                  <>
                    <td className="text-right px-2 py-2">{formatEuro(r.netto_iva_scontato)}</td>
                    <td className="text-right px-2 py-2 font-semibold">
                      {formatEuro(r.quantita * r.netto_iva_scontato)}
                    </td>
                  </>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={mostraPrezzi ? 4 : 2}
                className="px-2 py-4 text-center text-gray-400 italic"
              >
                (nessuna voce)
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {mostraPrezzi && (
        <div className="flex justify-end mb-6">
          <div className="flex gap-8 items-center border-t-2 border-gray-300 pt-2 px-2">
            <p className="font-bold text-sm">Tot. Imponibile</p>
            <p className="font-bold text-lg">{formatEuro(totaleNetto)}</p>
          </div>
        </div>
      )}

      {tipo === 'cliente' && scarico.firmato && scarico.firma_immagine && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="font-bold text-sm mb-3">Firma del cliente per ricevuta</p>
          <img src={scarico.firma_immagine} alt="Firma cliente" className="h-16 mb-2" />
          <p className="text-xs italic text-gray-600">
            Il/La sottoscritto/a dichiara di aver ricevuto quanto sopra specificato.
          </p>
          {scarico.data_firma && (
            <p className="text-xs italic text-gray-600">
              Firmato digitalmente il {formatData(scarico.data_firma)}
            </p>
          )}
        </div>
      )}

      {tipo === 'commercialista' && scarico.note && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs font-bold text-gray-500 uppercase mb-1">NOTE</p>
          <p className="text-xs text-gray-700 whitespace-pre-wrap">{scarico.note}</p>
        </div>
      )}

      <FooterPdf />
    </>
  );
}
