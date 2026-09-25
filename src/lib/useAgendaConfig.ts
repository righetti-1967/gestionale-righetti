import { useEffect, useState } from 'react';
import {
  caricaAgendaConfig,
  getAgendaConfigSync,
  AGENDA_DEFAULT,
  type ConfigAgenda,
} from './agenda-config';

export function useAgendaConfig(): { config: ConfigAgenda; loading: boolean } {
  const [config, setConfig] = useState<ConfigAgenda>(() => getAgendaConfigSync());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let annullato = false;
    (async () => {
      const result = await caricaAgendaConfig();
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

export { AGENDA_DEFAULT };
