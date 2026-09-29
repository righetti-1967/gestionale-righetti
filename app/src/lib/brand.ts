import { getDatiAziendaliSync } from './datiAziendali';
import { getLogoUrl } from './logo';

const RIGHETTI_EMAIL = 'righetti@righetti.club';
const LOGO_RIGHETTI_URL = 'https://yporpszebtasalwazirz.supabase.co/storage/v1/object/public/azienda/logo.png';

export interface BrandInfo {
  isRighetti: boolean;
  nomeBrand: string;
  logoUrl: string | null;
  footerEmail: string;
  footerDoc: string;
  firmaConsegnaDevice: string;
}

export function getBrandInfo(userEmail?: string | null): BrandInfo {
  const isRighetti = userEmail?.toLowerCase().trim() === RIGHETTI_EMAIL;
  const datiAz = getDatiAziendaliSync();

  if (isRighetti) {
    return {
      isRighetti: true,
      nomeBrand: 'Righetti Since 1967',
      logoUrl: LOGO_RIGHETTI_URL,
      footerEmail: 'Documento generato automaticamente dal Gestionale Righetti.',
      footerDoc: 'Documento generato dal Gestionale Righetti Since 1967',
      firmaConsegnaDevice: "Consegna l'iPad a Righetti Since 1967.",
    };
  }

  // Utente DEMO o altro studio/salone
  const nomeNeutro = datiAz?.ragioneSociale?.trim() || 'Gestionale';
  // getLogoUrl() restituisce il logo personalizzato o il fallback
  const logoUtente = getLogoUrl();

  return {
    isRighetti: false,
    nomeBrand: nomeNeutro,
    logoUrl: logoUtente,
    footerEmail: `Documento generato automaticamente da ${nomeNeutro}.`,
    footerDoc: `Documento generato da ${nomeNeutro}`,
    firmaConsegnaDevice: `Consegna il dispositivo allo staff di ${nomeNeutro}.`,
  };
}
