"""Auto-seeding dati DEMO per utenti in modalità prova.
Completamente separato dalla logica Righetti.
Cancella prima tutti i dati dell'utente, poi popola.
"""
import logging
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.services.supabase_client import get_supabase

logger = logging.getLogger(__name__)

DEMO_LOGO_PATH = Path(__file__).parent.parent / "assets" / "demo_logo.png"
BUCKET_AZIENDA = "azienda"


def _rnd(a, b, dec=0):
    v = random.uniform(a, b)
    return round(v, dec) if dec else int(v)


def _cancella_dati_utente(supabase, user_id: str):
    """Cancella tutti i dati dell'utente (in ordine FK-safe)."""
    tabelle = [
        "sessioni_firma_fattura",
        "sessioni_firma_ddt",
        "sessioni_firma",
        "righe_ordine_fornitore",
        "ordini_fornitore",
        "movimenti_magazzino",
        "scarichi_seduta",
        "percorsi",
        "fatture",
        "appuntamenti",
        "prodotti_cliente",  # se esiste
        "prodotti",
        "servizi",
        "fornitori",
        "clienti",
        "impostazioni",
    ]
    for tab in tabelle:
        try:
            supabase.table(tab).delete().eq("user_id", user_id).execute()
        except Exception as e:
            logger.warning(f"Cancellazione {tab}: {e}")


def _carica_logo_demo(supabase, user_id: str):
    """Carica il logo demo in azienda/{user_id}/logo.png."""
    if not DEMO_LOGO_PATH.exists():
        logger.warning(f"Logo demo non trovato: {DEMO_LOGO_PATH}")
        return False

    try:
        with open(DEMO_LOGO_PATH, "rb") as fh:
            content = fh.read()

        path = f"{user_id}/logo.png"
        supabase.storage.from_(BUCKET_AZIENDA).upload(
            path, content, {"content-type": "image/png", "upsert": "true"}
        )
        logger.info(f"Logo demo caricato: {path}")
        return True
    except Exception as e:
        logger.warning(f"Errore upload logo demo: {e}")
        return False


def _popola_clienti(supabase, user_id: str):
    clienti = [
        {
            "user_id": user_id,
            "nome_cognome": "Mario Rossi",
            "cellulare": "+39 333 1234567",
            "email": "mario.rossi@example.com",
            "codice_fiscale": "RSSMRA84E12H501Z",
            "citta_residenza": "Milano",
            "cap_residenza": "20100",
            "provincia_residenza": "MI",
            "note_anamnesi": "Norwood III Vertex. Familiarità paterna per AGA.",
            "data_nascita": "1984-05-12",
            "privacy_firmata": True,
        },
        {
            "user_id": user_id,
            "nome_cognome": "Laura Bianchi",
            "cellulare": "+39 347 7654321",
            "email": "laura.bianchi@example.com",
            "codice_fiscale": "BNCLRA90C22F205X",
            "citta_residenza": "Roma",
            "cap_residenza": "00100",
            "provincia_residenza": "RM",
            "note_anamnesi": "Ludwig I. Diradamento diffuso frontale.",
            "data_nascita": "1990-03-22",
            "privacy_firmata": True,
        },
        {
            "user_id": user_id,
            "nome_cognome": "Giuseppe Verdi",
            "cellulare": "+39 335 5551234",
            "email": "giuseppe.verdi@example.com",
            "codice_fiscale": "VRDGPP75A01F205Y",
            "citta_residenza": "Torino",
            "cap_residenza": "10100",
            "provincia_residenza": "TO",
            "note_anamnesi": "Controllo annuale. Quadro nella norma.",
            "data_nascita": "1975-01-01",
            "privacy_firmata": False,
        },
    ]
    ids = []
    for c in clienti:
        res = supabase.table("clienti").insert(c).execute()
        if res.data:
            ids.append(res.data[0]["id"])
    logger.info(f"Seed clienti: {ids}")
    return ids


def _popola_servizi(supabase, user_id: str):
    servizi = [
        {"user_id": user_id, "nome": "Check-Up Tricologico Gratuito", "prezzo_lordo": 0, "durata_minuti": 60, "is_checkup_iniziale": True},
        {"user_id": user_id, "nome": "Seduta Percorso Base", "prezzo_lordo": 80, "durata_minuti": 60, "is_checkup_iniziale": False},
        {"user_id": user_id, "nome": "Seduta Percorso Avanzato", "prezzo_lordo": 120, "durata_minuti": 90, "is_checkup_iniziale": False},
        {"user_id": user_id, "nome": "Controllo Trimestrale", "prezzo_lordo": 60, "durata_minuti": 30, "is_checkup_iniziale": False},
    ]
    ids = []
    for s in servizi:
        res = supabase.table("servizi").insert(s).execute()
        if res.data:
            ids.append(res.data[0]["id"])
    logger.info(f"Seed servizi: {ids}")
    return ids


def _popola_prodotti(supabase, user_id: str):
    prodotti = [
        {"user_id": user_id, "nome": "Minoxidil 5% Soluzione Topica", "prezzo_lordo": 28.50, "giacenza": 12, "scorta_minima": 3},
        {"user_id": user_id, "nome": "Integratore Biotina + Zinco", "prezzo_lordo": 22.00, "giacenza": 20, "scorta_minima": 5},
        {"user_id": user_id, "nome": "Shampoo Tricologico Delicato", "prezzo_lordo": 18.90, "giacenza": 15, "scorta_minima": 4},
        {"user_id": user_id, "nome": "Lozione Fortificante 100ml", "prezzo_lordo": 42.00, "giacenza": 8, "scorta_minima": 3},
        {"user_id": user_id, "nome": "Siero Antiforfora 50ml", "prezzo_lordo": 32.50, "giacenza": 10, "scorta_minima": 3},
    ]
    ids = []
    for p in prodotti:
        res = supabase.table("prodotti").insert(p).execute()
        if res.data:
            ids.append(res.data[0]["id"])
    logger.info(f"Seed prodotti: {ids}")
    return ids


def _popola_impostazioni(supabase, user_id: str):
    """Config agenda, aspetto, fatturazione, privacy, dati_aziendali (default)."""
    now_iso = datetime.now(timezone.utc).isoformat()

    impostazioni = [
        {
            "user_id": user_id,
            "chiave": "dati_aziendali",
            "valore": {
                "ragioneSociale": "Studio Demo Tricologico",
                "sedeLegale": {"indirizzo": "Via Roma 1", "cap": "20100", "citta": "Milano", "provincia": "MI"},
                "sedeOperativa": {"indirizzo": "Via Roma 1", "cap": "20100", "citta": "Milano", "provincia": "MI"},
                "sedeOperativaUgualeLegale": True,
                "partitaIva": "",
                "codiceFiscale": "",
                "codiceSdi": "",
                "telefono": "",
                "email": "",
                "pec": "",
                "iban": "",
                "sitoWeb": "",
                "regimeFiscale": "ordinario",
            },
            "updated_at": now_iso,
        },
    ]

    for imp in impostazioni:
        try:
            supabase.table("impostazioni").upsert(
                imp, on_conflict="user_id,chiave"
            ).execute()
        except Exception as e:
            logger.warning(f"Errore impostazione {imp['chiave']}: {e}")

    logger.info("Seed impostazioni completato")
    return len(impostazioni)


def _popola_percorsi(supabase, user_id: str, cliente_ids: list, servizio_ids: list):
    oggi = datetime.now(timezone.utc).date()

    percorsi = [
        {
            "user_id": user_id,
            "cliente_id": cliente_ids[0],
            "nome": "Percorso Anticaduta 6 mesi",
            "data_inizio": (oggi - timedelta(days=30)).isoformat(),
            "data_fine": (oggi + timedelta(days=150)).isoformat(),
            "righe": [
                {"tipo": "servizio", "servizio_id": servizio_ids[1], "nome": "Seduta Percorso Base", "quantita": 6, "prezzo_scontato_lordo": 70.0},
            ],
            "totale_listino": 480.0,
            "totale_finale": 420.0,
            "terminato": False,
            "bloccato": False,
        },
        {
            "user_id": user_id,
            "cliente_id": cliente_ids[1],
            "nome": "Percorso Rinforzante 3 mesi",
            "data_inizio": (oggi - timedelta(days=15)).isoformat(),
            "data_fine": (oggi + timedelta(days=75)).isoformat(),
            "righe": [
                {"tipo": "servizio", "servizio_id": servizio_ids[1], "nome": "Seduta Percorso Base", "quantita": 3, "prezzo_scontato_lordo": 70.0},
            ],
            "totale_listino": 240.0,
            "totale_finale": 210.0,
            "terminato": False,
            "bloccato": False,
        },
    ]

    ids = []
    for p in percorsi:
        res = supabase.table("percorsi").insert(p).execute()
        if res.data:
            ids.append(res.data[0]["id"])
    logger.info(f"Seed percorsi: {ids}")
    return ids


def _popola_appuntamenti(supabase, user_id: str, cliente_ids: list, servizio_ids: list, percorso_ids: list):
    oggi = datetime.now(timezone.utc).date()

    appuntamenti = [
        {
            "user_id": user_id,
            "cliente_id": cliente_ids[0],
            "percorso_id": percorso_ids[0],
            "operatore": "luca",
            "data": (oggi - timedelta(days=15)).isoformat(),
            "ora_inizio": "10:00:00",
            "durata_minuti": 60,
            "titolo": "Seduta percorso",
            "tipo": "percorso",
            "colore": "blue",
            "stato": "completato",
            "servizio_id": servizio_ids[1],
        },
        {
            "user_id": user_id,
            "cliente_id": cliente_ids[1],
            "percorso_id": percorso_ids[1],
            "operatore": "lorenzo",
            "data": (oggi - timedelta(days=7)).isoformat(),
            "ora_inizio": "15:30:00",
            "durata_minuti": 60,
            "titolo": "Seduta percorso",
            "tipo": "percorso",
            "colore": "blue",
            "stato": "completato",
            "servizio_id": servizio_ids[1],
        },
        {
            "user_id": user_id,
            "cliente_id": cliente_ids[0],
            "percorso_id": percorso_ids[0],
            "operatore": "luca",
            "data": (oggi + timedelta(days=3)).isoformat(),
            "ora_inizio": "11:00:00",
            "durata_minuti": 60,
            "titolo": "Seduta percorso",
            "tipo": "percorso",
            "colore": "blue",
            "stato": "confermato",
            "servizio_id": servizio_ids[1],
        },
        {
            "user_id": user_id,
            "cliente_id": cliente_ids[2],
            "percorso_id": None,
            "operatore": "luca",
            "data": (oggi + timedelta(days=7)).isoformat(),
            "ora_inizio": "09:00:00",
            "durata_minuti": 60,
            "titolo": "Check-up iniziale",
            "tipo": "checkup_nuovo",
            "colore": "green",
            "stato": "confermato",
            "servizio_id": servizio_ids[0],
        },
    ]

    ids = []
    for a in appuntamenti:
        res = supabase.table("appuntamenti").insert(a).execute()
        if res.data:
            ids.append(res.data[0]["id"])
    logger.info(f"Seed appuntamenti: {ids}")
    return ids


def popola_demo_utente(user_id: str) -> dict:
    """Popola un utente DEMO con dati di esempio."""
    supabase = get_supabase()
    risultato = {
        "logo": False,
        "clienti": 0,
        "servizi": 0,
        "prodotti": 0,
        "percorsi": 0,
        "appuntamenti": 0,
        "impostazioni": 0,
        "errori": [],
    }

    try:
        # 0. Cancella dati vecchi
        _cancella_dati_utente(supabase, user_id)

        # 1. Logo demo
        risultato["logo"] = _carica_logo_demo(supabase, user_id)

        # 2. Clienti
        cliente_ids = _popola_clienti(supabase, user_id)
        risultato["clienti"] = len(cliente_ids)

        # 3. Servizi
        servizio_ids = _popola_servizi(supabase, user_id)
        risultato["servizi"] = len(servizio_ids)

        # 4. Prodotti
        prodotto_ids = _popola_prodotti(supabase, user_id)
        risultato["prodotti"] = len(prodotto_ids)

        # 5. Impostazioni (dati aziendali)
        risultato["impostazioni"] = _popola_impostazioni(supabase, user_id)

        # 6. Percorsi + Appuntamenti
        if cliente_ids and servizio_ids:
            percorso_ids = _popola_percorsi(supabase, user_id, cliente_ids, servizio_ids)
            risultato["percorsi"] = len(percorso_ids)

            if percorso_ids:
                app_ids = _popola_appuntamenti(supabase, user_id, cliente_ids, servizio_ids, percorso_ids)
                risultato["appuntamenti"] = len(app_ids)

    except Exception as e:
        logger.exception("Errore durante popolamento demo")
        risultato["errori"].append(str(e))

    return risultato
