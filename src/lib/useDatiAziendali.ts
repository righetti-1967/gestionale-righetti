import { useEffect, useState } from 'react';
import { caricaDatiAziendali, getDatiAziendaliSync } from './datiAziendali';
import { DATI_AZIENDALI_DEFAULT, type DatiAziendali } from './studio';

/**
 * Hook React per leggere i dati aziendali da Supabase (con cache).
 * Restituisce i dati correnti (o i default finché non sono pronti).
 */
export function useDatiAziendali(): { dati: DatiAziendali; loading: boolean } {
  const [dati, setDati] = useState<DatiAziendali>(() => getDatiAziendaliSync());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let annullato = false;
    (async () => {
      const result = await caricaDatiAziendali();
      if (!annullato) {
        setDati(result);
        setLoading(false);
      }
    })();
    return () => {
      annullato = true;
    };
  }, []);

  return { dati, loading };
}

export { DATI_AZIENDALI_DEFAULT };
