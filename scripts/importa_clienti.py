"""
Script per importare i clienti da database_export.json a Supabase.
"""
import json
import os
from supabase import create_client, Client

# ============================================================
# CONFIGURAZIONE - MODIFICA QUESTE DUE RIGHE CON LE TUE CHIAVI
# ============================================================
SUPABASE_URL = "https://yporpszebtasalwazirz.supabase.co"
SUPABASE_SERVICE_KEY ="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwb3Jwc3plYnRhc2Fsd2F6aXJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTA1NTU1NSwiZXhwIjoyMTA0NjMxNTU1fQ.gbee17GiO8TUGCEIR4BaBtkbehKMgYQyaaGyaI1lm9s"
# ============================================================

# Percorso del file JSON (nella cartella backups)
BACKUP_PATH = os.path.expanduser(
    "~/Desktop/Tricolab/GESTIONALE/backups/database_export.json"
)

def main():
    # 1. Verifica che il file esista
    if not os.path.exists(BACKUP_PATH):
        print(f"❌ File non trovato: {BACKUP_PATH}")
        return

    # 2. Carica il JSON
    print(f"📂 Carico file: {BACKUP_PATH}")
    with open(BACKUP_PATH, 'r', encoding='utf-8') as f:
        dati = json.load(f)

    clienti_vecchi = dati.get('core_cliente', [])
    print(f"👥 Trovati {len(clienti_vecchi)} clienti nel backup\n")

    # 3. Connetti a Supabase
    print("🔌 Connessione a Supabase...")
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print("✅ Connesso!\n")

    # 4. Trasforma e carica ogni cliente
    importati = 0
    errori = 0

    for c in clienti_vecchi:
        # Mappa i campi del vecchio DB → nuovo DB
        nuovo_cliente = {
            'nome_cognome': c.get('nome_cognome') or 'Senza Nome',
            'cellulare': c.get('cellulare') or '',
            'email': c.get('email') or '',
            'codice_fiscale': c.get('codice_fiscale') or '',
            'partita_iva': c.get('partita_iva') or '',
            'codice_sdi': c.get('codice_sdi') or '',
            'note_anamnesi': c.get('note_anamnesi') or '',
            'indirizzo_residenza': c.get('indirizzo_residenza') or '',
            'cap_residenza': c.get('cap_residenza') or '',
            'citta_residenza': c.get('citta_residenza') or '',
            'provincia_residenza': c.get('provincia_residenza') or '',
            'indirizzo_spedizione': c.get('indirizzo_spedizione') or '',
            'cap_spedizione': c.get('cap_spedizione') or '',
            'citta_spedizione': c.get('citta_spedizione') or '',
            'provincia_spedizione': c.get('provincia_spedizione') or '',
            'privacy_firmata': bool(c.get('privacy_firmata', 0)),
        }

        try:
            supabase.table('clienti').insert(nuovo_cliente).execute()
            importati += 1
            print(f"✅ {importati}. {nuovo_cliente['nome_cognome']}")
        except Exception as e:
            errori += 1
            print(f"❌ Errore su {nuovo_cliente['nome_cognome']}: {e}")

    # 5. Riepilogo
    print(f"\n{'='*50}")
    print(f"🎉 Importati: {importati} clienti")
    print(f"❌ Errori: {errori}")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
