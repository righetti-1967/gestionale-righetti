import { useEffect, useState } from 'react';
import { caricaPrivacy, getPrivacySync, PRIVACY_DEFAULT, type ConfigPrivacy } from './privacy';

export function usePrivacy(): { config: ConfigPrivacy; loading: boolean } {
  const [config, setConfig] = useState<ConfigPrivacy>(() => getPrivacySync());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let annullato = false;
    (async () => {
      const result = await caricaPrivacy();
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

export { PRIVACY_DEFAULT };
