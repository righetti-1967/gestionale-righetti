import { useEffect, useState } from 'react';
import { caricaFatturazione, getFatturazioneSync, FATTURAZIONE_DEFAULT, type ConfigFatturazione } from './fatturazione';

export function useFatturazione(): { config: ConfigFatturazione; loading: boolean } {
  const [config, setConfig] = useState<ConfigFatturazione>(() => getFatturazioneSync());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let annullato = false;
    (async () => {
      const result = await caricaFatturazione();
      if (!annullato) {
        setConfig(result);
        setLoading(false);
      }
    })();
    return () => {
      annullato = true;
    };
  }, []);

  return { config, loading };
}

export { FATTURAZIONE_DEFAULT };
