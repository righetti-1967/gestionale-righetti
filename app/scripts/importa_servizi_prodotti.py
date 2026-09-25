"""
Script per importare servizi e prodotti da database_export.json a Supabase.
"""
import json
import os
from supabase import create_client, Client

SUPABASE_URL = "https://yporpszebtasalwazirz.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwb3Jwc3plYnRhc2Fsd2F6aXJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTA1NTU1NSwiZXhwIjoyMTA0NjMxNTU1fQ.gbee17GiO8TUGCEIR4BaBtkbehKMgYQyaaGyaI1lm9s"

BACKUP_PATH = os.path.expanduser(
    "~/Desktop/Tricolab/GESTIONALE/backups/database_export.json"
)


def main():
    print("🚀 Avvio script importazione servizi e prodotti...")

    if not os.path.exists(BACKUP_PATH):
        print(f"❌ File non trovato: {BACKUP_PATH}")
        return

    with open(BACKUP_PATH, "r", encoding="utf-8") as f:
        dati = json.load(f)

    servizi_vecchi = dati.get("core_servizio", [])
    prodotti_vecchi = dati.get("core_prodotto", [])

    print(f"🛠️  Trovati {len(servizi_vecchi)} servizi")
    print(f"📦 Trovati {len(prodotti_vecchi)} prodotti\n")

    print("🔌 Connessione a Supabase...")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print("✅ Connesso!\n")

    # ============ SERVIZI ============
    print("=" * 50)
    print("IMPORT SERVIZI")
    print("=" * 50)
    importati_servizi = 0
    for s in servizi_vecchi:
        record = {
            "nome": s.get("nome") or "",
            "prezzo_lordo": float(s.get("prezzo_lordo") or 0),
            "durata_minuti": int(s.get("durata_minuti") or 0),
        }
        try:
            supabase.table("servizi").insert(record).execute()
            importati_servizi += 1
            print(f"✅ {importati_servizi}. {record['nome']} (€ {record['prezzo_lordo']})")
        except Exception as e:
            print(f"❌ Errore su {record['nome']}: {e}")

    # ============ PRODOTTI ============
    print("\n" + "=" * 50)
    print("IMPORT PRODOTTI")
    print("=" * 50)
    importati_prodotti = 0
    for p in prodotti_vecchi:
        record = {
            "nome": p.get("nome") or "",
            "prezzo_lordo": float(p.get("prezzo_lordo") or 0),
            "giacenza": int(p.get("giacenza") or 0),
            "scorta_minima": int(p.get("scorta_minima") or 0),
            "codice_fornitore": p.get("codice_fornitore") or "",
            "nome_originale_fornitore": p.get("nome_originale_fornitore") or "",
            "nome_customan": p.get("nome_customan") or "",
            "prezzo_acquisto_lordo": float(p.get("prezzo_acquisto_lordo") or 0),
            "quantita_riordino": int(p.get("quantita_riordino") or 1),
        }
        try:
            supabase.table("prodotti").insert(record).execute()
            importati_prodotti += 1
            print(f"✅ {importati_prodotti}. {record['nome']} (€ {record['prezzo_lordo']})")
        except Exception as e:
            print(f"❌ Errore su {record['nome']}: {e}")

    print(f"\n{'='*50}")
    print(f"🎉 Servizi importati: {importati_servizi}")
    print(f"🎉 Prodotti importati: {importati_prodotti}")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
