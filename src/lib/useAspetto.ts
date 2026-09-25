import { useEffect, useState } from 'react';
import { caricaAspetto, getAspettoSync, ASPETTO_DEFAULT, type ConfigAspetto } from './aspetto';

export function useAspetto(): { config: ConfigAspetto; loading: boolean } {
  const [config, setConfig] = useState<ConfigAspetto>(() => getAspettoSync());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let annullato = false;
    (async () => {
      const result = await caricaAspetto();
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

export { ASPETTO_DEFAULT };
