import csv
import io
import logging
import re
import requests

from app.services.supabase_client import get_supabase

logger = logging.getLogger(__name__)


def sync_google_sheets(sheet_url: str, user_id: str | None = None) -> dict:
    """Scarica il foglio Google in formato CSV e sincronizza la tabella clienti."""
    match = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", sheet_url)
    if not match:
        raise ValueError("URL Google Sheet non valido. Assicurati che contenga '/spreadsheets/d/...'")
    sheet_id = match.group(1)

    export_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?tqx=out:csv"
    headers = {"User-Agent": "Mozilla/5.0"}
    
    resp = requests.get(export_url, headers=headers, timeout=20)
    if resp.status_code != 200:
        raise ValueError(f"Impossibile scaricare il foglio (status {resp.status_code}). Verifica che sia condiviso pubblicamente.")

    reader = csv.reader(io.StringIO(resp.text))
    rows = list(reader)
    if not rows:
        return {"nuovi": 0, "aggiornati": 0, "saltati": 0, "totale": 0}

    # Cerca indici colonne
    headers_row = [str(h).strip().upper() for h in rows[0]]
    idx_nome = next((i for i, h in enumerate(headers_row) if "NOME" in h or "CLIENTE" in h), None)
    idx_cell = next((i for i, h in enumerate(headers_row) if any(k in h for k in ["CELL", "TEL", "TELEFONO"])), None)
    idx_email = next((i for i, h in enumerate(headers_row) if any(k in h for k in ["EMAIL", "MAIL"])), None)
    idx_note = next((i for i, h in enumerate(headers_row) if "NOTE" in h or "ANAMNESI" in h), None)

    if idx_nome is None:
        raise ValueError(f"Colonna 'NOME E COGNOME' non trovata. Colonne presenti: {headers_row}")

    nuovi = 0
    aggiornati = 0
    saltati = 0
    totale = 0

    supabase = get_supabase()

    for row in rows[1:]:
        totale += 1
        if idx_nome >= len(row):
            saltati += 1
            continue

        nome_val = row[idx_nome].strip()
        if not nome_val or nome_val.lower() == "nan":
            saltati += 1
            continue

        cell_val = row[idx_cell].strip().replace(".0", "") if idx_cell is not None and idx_cell < len(row) else ""
        if cell_val.lower() == "nan": cell_val = ""

        email_val = row[idx_email].strip() if idx_email is not None and idx_email < len(row) else ""
        if email_val.lower() == "nan": email_val = ""

        note_val = row[idx_note].strip() if idx_note is not None and idx_note < len(row) else ""
        if note_val.lower() == "nan": note_val = ""

        try:
            # Cerca cliente esistente per nome_cognome (e user_id se fornito)
            q = supabase.table("clienti").select("id").eq("nome_cognome", nome_val)
            if user_id:
                q = q.eq("user_id", user_id)
            res = q.execute()

            if res.data and len(res.data) > 0:
                cliente_id = res.data[0]["id"]
                update_payload = {}
                if cell_val: update_payload["cellulare"] = cell_val
                if email_val: update_payload["email"] = email_val
                if note_val: update_payload["note_anamnesi"] = note_val

                if update_payload:
                    up_q = supabase.table("clienti").update(update_payload).eq("id", cliente_id)
                    if user_id:
                        up_q = up_q.eq("user_id", user_id)
                    up_q.execute()
                aggiornati += 1
            else:
                insert_payload = {
                    "nome_cognome": nome_val,
                    "cellulare": cell_val or None,
                    "email": email_val or None,
                    "note_anamnesi": note_val or None,
                }
                if user_id:
                    insert_payload["user_id"] = user_id
                supabase.table("clienti").insert(insert_payload).execute()
                nuovi += 1

        except Exception as e:
            logger.error("Errore sync riga %s: %s", nome_val, e)
            saltati += 1

    logger.info("Sync completata: %d nuovi, %d aggiornati, %d saltati su %d", nuovi, aggiornati, saltati, totale)
    return {
        "nuovi": nuovi,
        "aggiornati": aggiornati,
        "saltati": saltati,
        "totale": totale,
    }
