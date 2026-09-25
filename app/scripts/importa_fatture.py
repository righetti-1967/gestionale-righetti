"""
Script per importare le fatture da database_export.json a Supabase.
"""
import json
import os
from supabase import create_client, Client

SUPABASE_URL = "https://yporpszebtasalwazirz.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InSUPABASE_SERVICE_KEY = "RIMOSSA"

BACKUP_PATH = os.path.expanduser(
    "~/Desktop/Tricolab/GESTIONALE/backups/database_export.json"
)


def main():
    print("🚀 Avvio script importazione fatture...")

    if not os.path.exists(BACKUP_PATH):
        print(f"❌ File non trovato: {BACKUP_PATH}")
        return

    print(f"📂 Carico file: {BACKUP_PATH}")
    with open(BACKUP_PATH, "r", encoding="utf-8") as f:
        dati = json.load(f)

    percorsi = dati.get("core_percorso", [])
    righe_percorso = dati.get("core_rigapercorso", [])

    print(f"📄 Trovate {len(percorsi)} fatture nel backup")
    print(f"📋 Trovate {len(righe_percorso)} righe fattura\n")

    print("🔌 Connessione a Supabase...")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print("✅ Connesso!\n")

    righe_per_id = {}
    for r in righe_percorso:
        pid = r.get("percorso_id")
        if pid:
            righe_per_id.setdefault(pid, []).append(r)

    importate = 0
    errori = 0

    for p in percorsi:
        righe = []
        for r in righe_per_id.get(p["id"], []):
            righe.append({
                "tipo": "servizio" if r.get("servizio_id") else "prodotto",
                "servizio_id": r.get("servizio_id"),
                "prodotto_id": r.get("prodotto_id"),
                "quantita": r.get("quantita", 1),
                "prezzo_unitario_lordo": float(r.get("prezzo_unitario_lordo", 0)),
            })

        record = {
            "numero_fattura": p.get("numero_fattura") or "",
            "cliente_id": p.get("cliente_id"),
            "data_inizio": p.get("data_inizio") or None,
            "data_fine": p.get("data_fine") or None,
            "data_incasso": p.get("data_incasso") or None,
            "data_firma": p.get("data_firma") or None,
            "lordo_ivato": float(p.get("lordo_ivato") or 0),
            "netto_imponibile": float(p.get("netto_imponibile") or 0),
            "iva_importo": float(p.get("iva_importo") or 0),
            "righe": righe,
            "dicitura_legale": p.get("dicitura_legale") or "",
            "note_interne": p.get("note_interne") or "",
            "inviato_sdi": bool(p.get("inviato_sdi", 0)),
            "firmato": bool(p.get("firmato", 0)),
            "firma_immagine": p.get("firma_immagine") or None,
            "pacchetto_scelto_id": p.get("pacchetto_scelto_id"),
        }

        try:
            supabase.table("fatture").insert(record).execute()
            importate += 1
            print(f"✅ {importate}. Fattura {record['numero_fattura']} (cliente {record['cliente_id']}) - € {record['lordo_ivato']}")
        except Exception as e:
            errori += 1
            print(f"❌ Errore su {record['numero_fattura']}: {e}")

    print(f"\n{'='*50}")
    print(f"🎉 Importate: {importate} fatture")
    print(f"❌ Errori: {errori}")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
