/**
 * Ricerca di vie italiane tramite Photon (Komoot) + Nominatim (OSM).
 * Entrambi gratuiti e senza API key.
 *
 * Strategia:
 * 1. Photon (ricerca fuzzy, più tollerante) → primo tentativo
 * 2. Nominatim (ricerca esatta) → se Photon non trova nulla
 * 3. Rimuovere prefissi ("Via", "Viale", ecc.) per migliorare il match
 */

export interface ViaSuggerita {
  display_name: string;
  via: string;
  civico: string;
  citta: string;
  cap: string;
  provincia: string;
  lat: string;
  lon: string;
}

// Prefissi stradali italiani comuni (rimossi per la ricerca)
const PREFISSI = [
  'via ',
  'viale ',
  'v.le ',
  'piazza ',
  'p.zza ',
  'p.za ',
  'corso ',
  'c.so ',
  'vicolo ',
  'v.co ',
  'largo ',
  'l.go ',
  'strada ',
  'str. ',
  'stradone ',
  'lungomare ',
  'traversa ',
  'tr. ',
  'salita ',
  'discesa ',
  'borgo ',
  'contrada ',
  'località ',
  'loc. ',
];

function rimuoviPrefisso(query: string): string {
  const q = query.trim().toLowerCase();
  for (const prefisso of PREFISSI) {
    if (q.startsWith(prefisso)) {
      return query.trim().substring(prefisso.length);
    }
  }
  return query.trim();
}

// ============================================================
// PHOTON (Komoot)
// ============================================================
interface PhotonFeature {
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    town?: string;
    village?: string;
    postcode?: string;
    state?: string;
    country?: string;
    osm_value?: string;
  };
  geometry: {
    coordinates: [number, number]; // [lon, lat]
  };
}

async function cercaConPhoton(
  query: string,
  citta: string,
  provincia?: string
): Promise<ViaSuggerita[]> {
  const queryCompleta = [query, citta, provincia, 'Italia'].filter(Boolean).join(' ');

  const url = new URL('https://photon.komoot.io/api/');
  url.searchParams.set('q', queryCompleta);
  url.searchParams.set('limit', '8');
  url.searchParams.set('lang', 'it');
  // Filtro bounding box Italia (approssimativo)
  url.searchParams.set('bbox', '6.6,35.5,18.5,47.1');

  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];

    const data = await res.json();
    const features: PhotonFeature[] = data.features || [];

    return features
      .filter((f) => {
        const p = f.properties;
        // Escludiamo se non è una via (vogliamo solo street, house, square, ecc.)
        const tipiValidi = [
          'street', 'house', 'square', 'district', 'suburb', 'neighbourhood', 'city',
        ];
        return !p.osm_value || tipiValidi.includes(p.osm_value);
      })
      .map((f) => {
        const p = f.properties;
        const via = p.street || p.name || '';
        const civico = p.housenumber || '';
        const cittaRisposta = p.city || p.town || p.village || '';
        const cap = p.postcode || '';

        return {
          display_name: [via, civico, cittaRisposta].filter(Boolean).join(', '),
          via,
          civico,
          citta: cittaRisposta,
          cap,
          provincia: '',
          lat: String(f.geometry.coordinates[1]),
          lon: String(f.geometry.coordinates[0]),
        };
      })
      .filter((v) => v.via); // Scartiamo quelli senza via
  } catch (err) {
    console.error('⚠️ Errore Photon:', err);
    return [];
  }
}

// ============================================================
// NOMINATIM (OSM)
// ============================================================
interface NominatimResponse {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    road?: string;
    house_number?: string;
    pedestrian?: string;
    footway?: string;
    path?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    postcode?: string;
    county?: string;
    state?: string;
  };
}

async function cercaConNominatim(
  query: string,
  citta: string,
  provincia?: string
): Promise<ViaSuggerita[]> {
  const queryCompleta = [query, citta, provincia, 'Italia'].filter(Boolean).join(', ');

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', queryCompleta);
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '8');
  url.searchParams.set('countrycodes', 'it');

  try {
    const res = await fetch(url.toString(), {
      headers: { 'Accept-Language': 'it' },
    });
    if (!res.ok) return [];

    const data: NominatimResponse[] = await res.json();

    return data.map((item) => {
      const via =
        item.address.road ||
        item.address.pedestrian ||
        item.address.footway ||
        item.address.path ||
        '';
      const civico = item.address.house_number || '';
      const cittaRisposta =
        item.address.city ||
        item.address.town ||
        item.address.village ||
        item.address.municipality ||
        '';
      const cap = item.address.postcode || '';
      const prov = item.address.county || '';

      return {
        display_name: item.display_name,
        via,
        civico,
        citta: cittaRisposta,
        cap,
        provincia: prov,
        lat: item.lat,
        lon: item.lon,
      };
    });
  } catch (err) {
    console.error('⚠️ Errore Nominatim:', err);
    return [];
  }
}

// ============================================================
// FUNZIONE PRINCIPALE
// ============================================================
export async function cercaVia(
  query: string,
  citta: string,
  provincia?: string
): Promise<ViaSuggerita[]> {
  const q = query.trim();
  if (q.length < 3 || !citta.trim()) return [];

  const tuttiRisultati: ViaSuggerita[] = [];
  const seen = new Set<string>();

  // Helper per aggiungere senza duplicati
  function aggiungi(lista: ViaSuggerita[]) {
    for (const v of lista) {
      const chiave = `${v.via}|${v.civico}|${v.citta}`.toLowerCase();
      if (!seen.has(chiave) && v.via) {
        seen.add(chiave);
        tuttiRisultati.push(v);
      }
    }
  }

  // 1° tentativo: Photon con query originale
  aggiungi(await cercaConPhoton(q, citta, provincia));

  // 2° tentativo: Photon con query senza prefisso ("Via Maffezzini" → "Maffezzini")
  const senzaPrefisso = rimuoviPrefisso(q);
  if (senzaPrefisso !== q && senzaPrefisso.length >= 3) {
    aggiungi(await cercaConPhoton(senzaPrefisso, citta, provincia));
  }

  // 3° tentativo: se ancora niente, prova con Nominatim
  if (tuttiRisultati.length < 3) {
    aggiungi(await cercaConNominatim(q, citta, provincia));

    if (senzaPrefisso !== q && senzaPrefisso.length >= 3) {
      aggiungi(await cercaConNominatim(senzaPrefisso, citta, provincia));
    }
  }

  return tuttiRisultati.slice(0, 10);
}
