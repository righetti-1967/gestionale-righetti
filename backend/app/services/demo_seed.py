"""Auto-seeding dati DEMO per utenti in modalità prova.
Completamente separato dalla logica Righetti.
"""
import logging
import random
from datetime import datetime, timedelta, timezone

from app.services.supabase_client import get_supabase

logger = logging.getLogger(__name__)


def _rnd(a, b, dec=0):
    v = random.uniform(a, b)
    return round(v, dec) if dec else int(v)


def _popola_dati_aziendali(supabase, user_id: str):
    """Crea un record dati_aziendali vuoto/demo."""
    try:
        supabase.table("impostazioni").upsert({
            "chiave": f"user_{user_id}_demo",
            "valore": "true",
        }, on_conflict="chiave").execute()
    except Exception as e:
        logger.warning(f"impostazioni: {e}")
    return 1


def _popola_clienti(supabase, user_id: str):
    """Crea 3 clienti demo."""
    clienti = [
        {
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
    """Crea 4 servizi demo."""
    servizi = [
        {"nome": "Check-Up Tricologico Gratuito", "prezzo_lordo": 0, "durata_minuti": 60, "is_checkup_iniziale": True},
        {"nome": "Seduta Percorso Base", "prezzo_lordo": 80, "durata_minuti": 60, "is_checkup_iniziale": False},
        {"nome": "Seduta Percorso Avanzato", "prezzo_lordo": 120, "durata_minuti": 90, "is_checkup_iniziale": False},
        {"nome": "Controllo Trimestrale", "prezzo_lordo": 60, "durata_minuti": 30, "is_checkup_iniziale": False},
    ]
    ids = []
    for s in servizi:
        res = supabase.table("servizi").insert(s).execute()
        if res.data:
            ids.append(res.data[0]["id"])
    logger.info(f"Seed servizi: {ids}")
    return ids


def _popola_prodotti(supabase, user_id: str):
    """Crea 5 prodotti demo."""
    prodotti = [
        {"nome": "Minoxidil 5% Soluzione Topica", "prezzo_lordo": 28.50, "giacenza": 12, "scorta_minima": 3},
        {"nome": "Integratore Biotina + Zinco", "prezzo_lordo": 22.00, "giacenza": 20, "scorta_minima": 5},
        {"nome": "Shampoo Tricologico Delicato", "prezzo_lordo": 18.90, "giacenza": 15, "scorta_minima": 4},
        {"nome": "Lozione Fortificante 100ml", "prezzo_lordo": 42.00, "giacenza": 8, "scorta_minima": 3},
        {"nome": "Siero Antiforfora 50ml", "prezzo_lordo": 32.50, "giacenza": 10, "scorta_minima": 3},
    ]
    ids = []
    for p in prodotti:
        res = supabase.table("prodotti").insert(p).execute()
        if res.data:
            ids.append(res.data[0]["id"])
    logger.info(f"Seed prodotti: {ids}")
    return ids


def _popola_percorsi(supabase, cliente_ids: list, servizio_ids: list):
    """Crea 2 percorsi attivi."""
    oggi = datetime.now(timezone.utc).date()

    percorsi = [
        {
            "cliente_id": cliente_ids[0],
            "nome": "Percorso Anticaduta 6 mesi",
            "data_inizio": (oggi - timedelta(days=30)).isoformat(),
            "data_fine": (oggi + timedelta(days=150)).isoformat(),
            "righe": [
                {"tipo": "servizio", "servizio_id": servizio_ids[1], "nome": "Seduta Percorso Base", "quantita": 6, "prezzo_scontato_lordo": 70.0},
                {"tipo": "prodotto", "prodotto_id": None, "nome": "Minoxidil 5%", "quantita": 3, "prezzo_scontato_lordo": 25.0},
            ],
            "totale_listino": 570.0,
            "totale_finale": 495.0,
            "terminato": False,
            "bloccato": False,
        },
        {
            "cliente_id": cliente_ids[1],
            "nome": "Percorso Rinforzante 3 mesi",
            "data_inizio": (oggi - timedelta(days=15)).isoformat(),
            "data_fine": (oggi + timedelta(days=75)).isoformat(),
            "righe": [
                {"tipo": "servizio", "servizio_id": servizio_ids[1], "nome": "Seduta Percorso Base", "quantita": 3, "prezzo_scontato_lordo": 70.0},
                {"tipo": "prodotto", "prodotto_id": None, "nome": "Shampoo Tricologico", "quantita": 2, "prezzo_scontato_lordo": 16.0},
            ],
            "totale_listino": 272.0,
            "totale_finale": 242.0,
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


def _popola_appuntamenti(supabase, cliente_ids: list, servizio_ids: list, percorso_ids: list):
    """Crea 4 appuntamenti (2 passati, 2 futuri)."""
    oggi = datetime.now(timezone.utc).date()

    appuntamenti = [
        {
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
        "clienti": 0,
        "servizi": 0,
        "prodotti": 0,
        "percorsi": 0,
        "appuntamenti": 0,
        "errori": [],
    }

    try:
        cliente_ids = _popola_clienti(supabase, user_id)
        risultato["clienti"] = len(cliente_ids)

        servizio_ids = _popola_servizi(supabase, user_id)
        risultato["servizi"] = len(servizio_ids)

        prodotto_ids = _popola_prodotti(supabase, user_id)
        risultato["prodotti"] = len(prodotto_ids)

        if cliente_ids and servizio_ids:
            percorso_ids = _popola_percorsi(supabase, cliente_ids, servizio_ids)
            risultato["percorsi"] = len(percorso_ids)

            if percorso_ids:
                app_ids = _popola_appuntamenti(supabase, cliente_ids, servizio_ids, percorso_ids)
                risultato["appuntamenti"] = len(app_ids)

    except Exception as e:
        logger.exception("Errore durante popolamento demo")
        risultato["errori"].append(str(e))

    return risultato
