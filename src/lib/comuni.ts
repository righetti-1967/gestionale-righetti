import comuniData from '../data/comuni.json';

export interface Comune {
  nome: string;
  codice: string;
  zona: string;
  regione: string;
  provincia: string; // sigla es. "SO"
  sigla: string;     // sigla provincia (duplicata per chiarezza)
  codiceCatastale: string;
  cap: string[];
  popolazione: number;
}

// Normalizza il JSON per un accesso più veloce
interface ComuneRaw {
  nome: string;
  codice: string;
  zona: string;
  regione: string;
  provincia: string;
  sigla: string;
  codiceCatastale: string;
  cap: string[];
  popolazione: number;
}

const comuni: Comune[] = (comuniData as unknown as ComuneRaw[]).map((c) => ({
  nome: c.nome,
  codice: c.codice,
  zona: c.zona,
  regione: c.regione,
  provincia: c.provincia,
  sigla: c.sigla,
  codiceCatastale: c.codiceCatastale,
  cap: c.cap,
  popolazione: c.popolazione,
}));

/**
 * Cerca un comune per nome (case-insensitive).
 * Ritorna fino a 10 risultati ordinati per popolazione (i più grandi prima).
 */
export function cercaComune(query: string): Comune[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  return comuni
    .filter((c) => c.nome.toLowerCase().startsWith(q))
    .sort((a, b) => b.popolazione - a.popolazione)
    .slice(0, 10);
}

/**
 * Trova un comune esatto per nome.
 */
export function trovaComune(nome: string): Comune | null {
  const n = nome.trim().toLowerCase();
  return comuni.find((c) => c.nome.toLowerCase() === n) || null;
}
