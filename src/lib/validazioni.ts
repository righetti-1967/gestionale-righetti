/**
 * Funzioni di validazione per Codice Fiscale, Partita IVA, Codice SDI, Email, Cellulare.
 */

// ============================================================
// PAESI
// ============================================================
export interface Paese {
  codice: string;
  nome: string;
  bandiera: string;
  prefisso: string;
  lunghezzaMin: number;
  lunghezzaMax: number;
}

export const PAESI: Paese[] = [
  { codice: 'IT', nome: 'Italia', bandiera: '🇮🇹', prefisso: '+39', lunghezzaMin: 9, lunghezzaMax: 11 },
  { codice: 'CH', nome: 'Svizzera', bandiera: '🇨🇭', prefisso: '+41', lunghezzaMin: 9, lunghezzaMax: 9 },
  { codice: 'SM', nome: 'San Marino', bandiera: '🇸🇲', prefisso: '+378', lunghezzaMin: 6, lunghezzaMax: 10 },
  { codice: 'VA', nome: 'Città del Vaticano', bandiera: '🇻🇦', prefisso: '+379', lunghezzaMin: 6, lunghezzaMax: 10 },
  { codice: 'FR', nome: 'Francia', bandiera: '🇫🇷', prefisso: '+33', lunghezzaMin: 9, lunghezzaMax: 9 },
  { codice: 'DE', nome: 'Germania', bandiera: '🇩🇪', prefisso: '+49', lunghezzaMin: 10, lunghezzaMax: 11 },
  { codice: 'AT', nome: 'Austria', bandiera: '🇦🇹', prefisso: '+43', lunghezzaMin: 10, lunghezzaMax: 13 },
  { codice: 'SI', nome: 'Slovenia', bandiera: '🇸🇮', prefisso: '+386', lunghezzaMin: 8, lunghezzaMax: 8 },
  { codice: 'HR', nome: 'Croazia', bandiera: '🇭🇷', prefisso: '+385', lunghezzaMin: 8, lunghezzaMax: 9 },
  { codice: 'ES', nome: 'Spagna', bandiera: '🇪🇸', prefisso: '+34', lunghezzaMin: 9, lunghezzaMax: 9 },
  { codice: 'GB', nome: 'Regno Unito', bandiera: '🇬🇧', prefisso: '+44', lunghezzaMin: 10, lunghezzaMax: 10 },
  { codice: 'US', nome: 'Stati Uniti', bandiera: '🇺🇸', prefisso: '+1', lunghezzaMin: 10, lunghezzaMax: 10 },
];

export function getPaese(codice: string): Paese {
  return PAESI.find((p) => p.codice === codice) || PAESI[0];
}

// ============================================================
// CODICE FISCALE (16 caratteri)
// ============================================================
// Tabella per i caratteri in POSIZIONE DISPARI (1, 3, 5, ...)
const TABELLA_DISPARI: Record<string, number> = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21,
  K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14,
  U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

// Tabella per i caratteri in POSIZIONE PARI (2, 4, 6, ...)
const TABELLA_PARI: Record<string, number> = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9,
  K: 10, L: 11, M: 12, N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19,
  U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25,
};

const CARATTERI_CONTROLLO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function validaCodiceFiscale(cf: string): boolean {
  const codice = cf.trim().toUpperCase();

  // Lunghezza e formato base
  if (codice.length !== 16) return false;
  if (!/^[A-Z0-9]{16}$/.test(codice)) return false;

  // Verifica struttura: 6 lettere, 2 alfanumerici, 1 lettera, 2 alfanumerici, 1 lettera, 3 alfanumerici, 1 lettera
  const regex = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;
  if (!regex.test(codice)) return false;

  // Calcolo carattere di controllo
  let somma = 0;
  for (let i = 0; i < 15; i++) {
    const carattere = codice[i];
    // i=0 è posizione 1 (dispari) → usa tabella dispari
    // i=1 è posizione 2 (pari) → usa tabella pari
    if (i % 2 === 0) {
      somma += TABELLA_DISPARI[carattere] || 0;
    } else {
      somma += TABELLA_PARI[carattere] || 0;
    }
  }

  const carattereControllo = CARATTERI_CONTROLLO[somma % 26];
  return carattereControllo === codice[15];
}

// ============================================================
// PARTITA IVA
// ============================================================
export function validaPartitaIVA(piva: string): boolean {
  const p = piva.trim().replace(/\s/g, '');
  if (!/^\d{11}$/.test(p)) return false;

  let somma = 0;
  for (let i = 0; i < 11; i++) {
    const cifra = parseInt(p[i], 10);
    if (i % 2 === 0) {
      somma += cifra;
    } else {
      const doppio = cifra * 2;
      somma += doppio > 9 ? doppio - 9 : doppio;
    }
  }
  return somma % 10 === 0;
}

// ============================================================
// CODICE SDI
// ============================================================
export function validaCodiceSDI(sdi: string): boolean {
  return /^[A-Z0-9]{7}$/.test(sdi.trim().toUpperCase());
}

// ============================================================
// EMAIL
// ============================================================
export function validaEmail(email: string): boolean {
  if (!email.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ============================================================
// CELLULARE
// ============================================================
export function validaCellulare(cell: string, codicePaese: string = 'IT'): boolean {
  if (!cell.trim()) return true;
  const paese = getPaese(codicePaese);
  const pulito = cell.replace(/[\s\-().]/g, '');
  if (!/^\d+$/.test(pulito)) return false;
  return pulito.length >= paese.lunghezzaMin && pulito.length <= paese.lunghezzaMax;
}

// ============================================================
// HELPER MESSAGGI
// ============================================================
export function messaggioCodiceFiscale(cf: string): string | null {
  if (!cf.trim()) return null;
  if (cf.trim().length !== 16) return 'Deve avere 16 caratteri';
  if (!validaCodiceFiscale(cf)) return 'Codice fiscale non valido';
  return null;
}

export function messaggioPartitaIVA(piva: string): string | null {
  if (!piva.trim()) return null;
  if (!/^\d+$/.test(piva.trim())) return 'Solo numeri';
  if (piva.trim().length !== 11) return 'Deve avere 11 cifre';
  if (!validaPartitaIVA(piva)) return 'Partita IVA non valida';
  return null;
}

export function messaggioCodiceSDI(sdi: string): string | null {
  if (!sdi.trim()) return null;
  if (sdi.trim().length !== 7) return 'Deve avere 7 caratteri';
  if (!validaCodiceSDI(sdi)) return 'Solo lettere e numeri';
  return null;
}

export function messaggioEmail(email: string): string | null {
  if (!email.trim()) return null;
  if (!validaEmail(email)) return 'Email non valida';
  return null;
}

export function messaggioCellulare(cell: string, codicePaese: string = 'IT'): string | null {
  if (!cell.trim()) return null;
  const paese = getPaese(codicePaese);
  if (!validaCellulare(cell, codicePaese)) {
    return `Numero non valido per ${paese.nome} (${paese.lunghezzaMin}-${paese.lunghezzaMax} cifre)`;
  }
  return null;
}

// ============================================================
// COMPOSIZIONE NUMERO TELEFONO
// ============================================================
export function componiNumeroCompleto(numero: string, codicePaese: string): string {
  const paese = getPaese(codicePaese);
  const pulito = numero.replace(/[\s\-().]/g, '');
  if (!pulito) return '';
  const senzaPrefisso = pulito.replace(/^(\+|00)/, '').replace(new RegExp(`^${paese.prefisso.substring(1)}`), '');
  return `${paese.prefisso}${senzaPrefisso}`;
}

export function scomponiNumero(numeroCompleto: string): { codicePaese: string; numero: string } {
  if (!numeroCompleto) return { codicePaese: 'IT', numero: '' };
  const pulito = numeroCompleto.trim();
  const paesiOrdinati = [...PAESI].sort((a, b) => b.prefisso.length - a.prefisso.length);
  for (const paese of paesiOrdinati) {
    if (pulito.startsWith(paese.prefisso)) {
      return {
        codicePaese: paese.codice,
        numero: pulito.substring(paese.prefisso.length).replace(/\s/g, ''),
      };
    }
  }
  return { codicePaese: 'IT', numero: pulito.replace(/\D/g, '') };
}
