import { useEffect, useRef } from 'react';
import {
  OPERATORI,
  calcolaOraFine,
  type Appuntamento,
  type MotivoCancellazione,
} from '../lib/appuntamenti';
import type { Cliente } from '../lib/clienti';

const MOTIVO_LABEL: Record<MotivoCancellazione, string> = {
  rebooking: 'Disdetta con Rebooking',
  disdetta: 'Disdetta',
  definitiva: 'Cancellazione Definitiva',
  spostamento: 'Spostato',
};

function statoLabel(app: Appuntamento): { label: string; cssClass: string } {
  if (app.stato === 'cancellato') {
    const m = app.motivo_cancellazione;
    if (m === 'rebooking') return { label: '🔄 Rebooking', cssClass: 'stato-rebooking' };
    if (m === 'disdetta') return { label: '🟡 Disdetta', cssClass: 'stato-disdetta' };
    if (m === 'definitiva') return { label: '🔴 Cancellato', cssClass: 'stato-definitiva' };
    if (m === 'spostamento') return { label: '🔵 Spostato', cssClass: 'stato-spostamento' };
    return { label: '✕ Cancellato', cssClass: 'stato-definitiva' };
  }
  if (app.stato === 'completato') return { label: '✓ Completato', cssClass: 'stato-completato' };
  if (app.stato === 'confermato') return { label: '✓ Confermato', cssClass: 'stato-confermato' };
  if (app.stato === 'pending') return { label: '⏳ Da confermare', cssClass: 'stato-pending' };
  if (app.stato === 'prenotato') return { label: '📌 Prenotato', cssClass: 'stato-prenotato' };
  return { label: app.stato || '—', cssClass: 'stato-prenotato' };
}

function tipoLabel(tipo: string): string {
  switch (tipo) {
    case 'percorso': return '🎯 Percorso';
    case 'checkup_nuovo': return '🆕 Nuovo';
    case 'seduta': return '💆 Seduta';
    case 'consulenza': return '💼 Consulenza';
    case 'trattamento': return '💆 Trattamento';
    case 'generico': return '📌 Generico';
    case 'blocco': return '🚫 Blocco';
    default: return tipo;
  }
}

function formatData(data: string): string {
  if (!data) return '—';
  try {
    return new Date(data + 'T00:00:00').toLocaleDateString('it-IT', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return data;
  }
}

interface AnteprimaStampaAppuntamentiProps {
  cliente: Cliente;
  appuntamenti: Appuntamento[];
  ragioneSociale?: string;
  autoPrint?: boolean;
  onClose: () => void;
}

export function AnteprimaStampaAppuntamenti({
  cliente,
  appuntamenti,
  ragioneSociale = 'Gestionale Righetti 1967',
  autoPrint = false,
  onClose,
}: AnteprimaStampaAppuntamentiProps) {
  const printedRef = useRef(false);

  const ordinati = [...appuntamenti].sort((a, b) => {
    const dc = (b.data || '').localeCompare(a.data || '');
    if (dc !== 0) return dc;
    return (b.ora_inizio || '').localeCompare(a.ora_inizio || '');
  });

  useEffect(() => {
    if (autoPrint && !printedRef.current) {
      printedRef.current = true;
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [autoPrint]);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const totale = ordinati.length;
  const oggi = new Date().toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="anteprima-overlay" onClick={onClose}>
      <div className="anteprima-container" onClick={(e) => e.stopPropagation()}>
        <div className="anteprima-toolbar no-print">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-apple-darkgray">
              👁️ Anteprima appuntamenti — {cliente.nome_cognome}
            </span>
            <span className="text-xs text-apple-gray">({totale} totali)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-apple-blue text-white rounded-apple font-medium text-sm hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              🖨️ Stampa
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-apple-gray transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="foglio-a4">
          <div className="foglio-header">
            <div>
              <h1 className="foglio-titolo">{ragioneSociale}</h1>
              <p className="foglio-sottotitolo">Storico appuntamenti cliente</p>
            </div>
            <div className="foglio-meta">
              <p><strong>Stampato il:</strong> {oggi}</p>
              <p><strong>Totale:</strong> {totale} appuntamenti</p>
            </div>
          </div>

          <div className="foglio-cliente">
            <p className="foglio-cliente-nome">👤 {cliente.nome_cognome}</p>
            <div className="foglio-cliente-contatti">
              {cliente.cellulare && <span>📞 {cliente.cellulare}</span>}
              {cliente.email && <span>✉️ {cliente.email}</span>}
            </div>
          </div>

          {totale === 0 ? (
            <p className="foglio-vuoto">Nessun appuntamento registrato per questo cliente.</p>
          ) : (
            <table className="foglio-tabella">
              <thead>
                <tr>
                  <th style={{ width: '90px' }}>Data</th>
                  <th style={{ width: '70px' }}>Ora</th>
                  <th style={{ width: '90px' }}>Operatore</th>
                  <th>Titolo</th>
                  <th style={{ width: '100px' }}>Tipo</th>
                  <th style={{ width: '130px' }}>Stato</th>
                </tr>
              </thead>
              <tbody>
                {ordinati.map((app) => {
                  const stato = statoLabel(app);
                  const oraInizio = (app.ora_inizio || '').slice(0, 5) || '—';
                  const oraFine = calcolaOraFine(oraInizio, app.durata_minuti || 30);
                  const opLabel =
                    (app.operatore && OPERATORI[app.operatore]?.label) ||
                    app.operatore ||
                    '—';
                  return (
                    <tr key={app.id}>
                      <td className="foglio-data">{formatData(app.data)}</td>
                      <td className="foglio-ora">{oraInizio}–{oraFine}</td>
                      <td>{opLabel}</td>
                      <td className="foglio-titolo-cell">
                        {app.titolo || '—'}
                        {app.note && (
                          <span className="foglio-note">
                            {' '}— {app.note.length > 80 ? app.note.slice(0, 80) + '…' : app.note}
                          </span>
                        )}
                      </td>
                      <td className="foglio-tipo">{tipoLabel(app.tipo)}</td>
                      <td>
                        <span className={`foglio-badge ${stato.cssClass}`}>{stato.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="foglio-footer">
            <p>Documento generato automaticamente da {ragioneSociale} — {oggi}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
