"""
Router Spese e Scadenze.
CRUD spese + generazione automatica scadenze ricorrenti.
"""
import logging
import xmltodict
import zipfile
import io
from datetime import date, datetime, timedelta
from dateutil.relativedelta import relativedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from pydantic import BaseModel, Field

from app.services.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/spese", tags=["spese"])

# ============================================================================
# SCHEMI
# ============================================================================

class SpesaBase(BaseModel):
    data: str  # YYYY-MM-DD
    descrizione: str
    importo: float
    importo_ivato: bool = True
    imponibile: Optional[float] = None
    iva: Optional[float] = None
    categoria: Optional[str] = None
    fornitore_id: Optional[int] = None
    tipo: str = "una_tantum"  # 'una_tantum' | 'ricorrente'
    ricorrenza: Optional[str] = None  # 'mensile' | 'trimestrale' | 'semestrale' | 'annuale'
    data_scadenza: Optional[str] = None
    pagata: bool = False
    data_pagamento: Optional[str] = None
    metodo_pagamento: Optional[str] = None
    note: Optional[str] = None
    ricorrenza_attiva: bool = False
    giorno_scadenza: Optional[int] = None
    mesi_anticipo: Optional[int] = 12


class SpesaCreate(SpesaBase):
    user_id: str  # UUID utente Supabase


class SpesaUpdate(BaseModel):
    data: Optional[str] = None
    descrizione: Optional[str] = None
    importo: Optional[float] = None
    importo_ivato: Optional[bool] = None
    imponibile: Optional[float] = None
    iva: Optional[float] = None
    categoria: Optional[str] = None
    fornitore_id: Optional[int] = None
    tipo: Optional[str] = None
    ricorrenza: Optional[str] = None
    data_scadenza: Optional[str] = None
    pagata: Optional[bool] = None
    data_pagamento: Optional[str] = None
    metodo_pagamento: Optional[str] = None
    note: Optional[str] = None
    ricorrenza_attiva: Optional[bool] = None
    giorno_scadenza: Optional[int] = None
    mesi_anticipo: Optional[int] = 12


# ============================================================================
# HELPER: calcola date future per ricorrenze
# ============================================================================

def _calcola_data_scadenza(data_base: date, giorno_scadenza: int | None, mesi_avanti: int) -> date:
    """Calcola la data di scadenza N mesi dopo data_base, al giorno specificato."""
    d = data_base + relativedelta(months=mesi_avanti)
    if giorno_scadenza:
        # Imposta il giorno (con clamp per mesi più corti, es. 31 → 28/29 feb)
        ultimo_giorno = (d.replace(day=1) + relativedelta(months=1, days=-1)).day
        giorno_effettivo = min(giorno_scadenza, ultimo_giorno)
        d = d.replace(day=giorno_effettivo)
    return d


def _calcola_step_giorni(ricorrenza: str) -> int:
    """Ritorna quanti giorni avanzare per ogni ricorrenza."""
    return {
        "settimanale": 7,
        "quindicinale": 15,
        "mensile": 30,  # approssimato, meglio usare mesi
        "bimestrale": 60,
        "trimestrale": 90,
        "semestrale": 180,
        "annuale": 365,
    }.get(ricorrenza, 30)


def _calcola_step_mesi(ricorrenza: str) -> int:
    """Ritorna quanti mesi avanzare per ogni ricorrenza (per generazione scadenze)."""
    return {
        "mensile": 1,
        "bimestrale": 2,
        "trimestrale": 3,
        "semestrale": 6,
        "annuale": 12,
    }.get(ricorrenza, 1)


# ============================================================================
# ENDPOINT
# ============================================================================

@router.get("")
async def lista_spese(
    user_id: str = Query(..., description="UUID utente"),
    da: Optional[str] = Query(None, description="Data inizio (YYYY-MM-DD)"),
    a: Optional[str] = Query(None, description="Data fine (YYYY-MM-DD)"),
    pagata: Optional[bool] = Query(None),
    categoria: Optional[str] = Query(None),
    solo_scadenze: bool = Query(False, description="Solo scadenze non pagate"),
):
    """Lista spese con filtri."""
    try:
        sb = get_supabase()
        q = sb.table("spese").select("*").eq("user_id", user_id)

        if da:
            q = q.gte("data", da)
        if a:
            q = q.lte("data", a)
        if pagata is not None:
            q = q.eq("pagata", pagata)
        if categoria:
            q = q.eq("categoria", categoria)
        if solo_scadenze:
            q = q.eq("pagata", False).not_.is_("data_scadenza", "null")

        q = q.order("data", desc=True).order("data_scadenza", desc=False)
        res = q.execute()
        return {"success": True, "spese": res.data or []}
    except Exception as e:
        logger.exception("Errore lista spese")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def crea_spesa(spesa: SpesaCreate):
    """Crea una nuova spesa. Se ricorrente, genera le scadenze future."""
    try:
        sb = get_supabase()

        # 1. Inserisci la spesa principale
        spesa_dict = spesa.model_dump(exclude_none=False)
        res = sb.table("spese").insert(spesa_dict).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Errore inserimento")

        spesa_creata = res.data[0]

        # 2. Se ricorrente e attiva, genera le scadenze future (12 mesi)
        scadenze_generate = 0
        if (
            spesa.tipo == "ricorrente"
            and spesa.ricorrenza_attiva
            and spesa.ricorrenza
            and spesa.data_scadenza
        ):
            step_mesi = _calcola_step_mesi(spesa.ricorrenza)
            data_base = datetime.strptime(spesa.data_scadenza, "%Y-%m-%d").date()
            mesi_totali = spesa.mesi_anticipo or 12
            n_mesi = mesi_totali // step_mesi

            for i in range(1, n_mesi + 1):
                data_futura = _calcola_data_scadenza(data_base, spesa.giorno_scadenza, i * step_mesi)
                scadenza_dict = {
                    "user_id": spesa.user_id,
                    "data": data_futura.isoformat(),
                    "descrizione": f"{spesa.descrizione} ({data_futura.strftime('%m/%Y')})",
                    "importo": spesa.importo,
                    "categoria": spesa.categoria,
                    "fornitore_id": spesa.fornitore_id,
                    "tipo": "ricorrente",
                    "ricorrenza": spesa.ricorrenza,
                    "data_scadenza": data_futura.isoformat(),
                    "pagata": False,
                    "note": f"Generata automaticamente da ricorrenza (spesa #{spesa_creata['id']})",
                    "ricorrenza_attiva": False,  # Le figlie non generano altre
                    "giorno_scadenza": spesa.giorno_scadenza,
                }
                sb.table("spese").insert(scadenza_dict).execute()
                scadenze_generate += 1

        return {
            "success": True,
            "spesa": spesa_creata,
            "scadenze_generate": scadenze_generate,
        }
    except Exception as e:
        logger.exception("Errore creazione spesa")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{spesa_id}")
async def aggiorna_spesa(spesa_id: int, spesa: SpesaUpdate):
    """Aggiorna una spesa esistente. Se ricorrente, rigenera le scadenze future."""
    try:
        sb = get_supabase()
        update_dict = {k: v for k, v in spesa.model_dump().items() if v is not None}
        if not update_dict:
            raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")

        # 1. Aggiorna il record principale
        res = sb.table("spese").update(update_dict).eq("id", spesa_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Spesa non trovata")

        spesa_aggiornata = res.data[0]

        # 2. Se ricorrente → rigenera scadenze figlie (non pagate)
        tipo = update_dict.get("tipo", spesa_aggiornata.get("tipo"))
        ricorrenza = update_dict.get("ricorrenza", spesa_aggiornata.get("ricorrenza"))
        data_scadenza = update_dict.get("data_scadenza", spesa_aggiornata.get("data_scadenza"))
        giorno_scadenza = update_dict.get("giorno_scadenza", spesa_aggiornata.get("giorno_scadenza"))
        mesi_anticipo = update_dict.get("mesi_anticipo", spesa_aggiornata.get("mesi_anticipo")) or 12
        user_id = spesa_aggiornata.get("user_id")
        importo = update_dict.get("importo", spesa_aggiornata.get("importo"))
        categoria = update_dict.get("categoria", spesa_aggiornata.get("categoria"))
        descrizione = update_dict.get("descrizione", spesa_aggiornata.get("descrizione"))

        scadenze_generate = 0
        if tipo == "ricorrente" and ricorrenza and data_scadenza and user_id:
            # 2a. Elimina scadenze figlie NON pagate collegate a questa spesa madre
            sb.table("spese").delete() \
                .eq("user_id", user_id) \
                .eq("pagata", False) \
                .like("note", f"Generata automaticamente da ricorrenza (spesa #{spesa_id})%") \
                .execute()

            # 2b. Genera nuove scadenze
            step_mesi = _calcola_step_mesi(ricorrenza)
            try:
                data_base = datetime.strptime(str(data_scadenza), "%Y-%m-%d").date()
            except Exception:
                data_base = None

            if data_base and step_mesi > 0:
                n_scadenze = mesi_anticipo // step_mesi

                for i in range(1, n_scadenze + 1):
                    data_futura = _calcola_data_scadenza(data_base, giorno_scadenza, i * step_mesi)
                    scadenza_dict = {
                        "user_id": user_id,
                        "data": data_futura.isoformat(),
                        "descrizione": f"{descrizione} ({data_futura.strftime('%m/%Y')})",
                        "importo": importo,
                        "categoria": categoria,
                        "fornitore_id": spesa_aggiornata.get("fornitore_id"),
                        "tipo": "ricorrente",
                        "ricorrenza": ricorrenza,
                        "data_scadenza": data_futura.isoformat(),
                        "pagata": False,
                        "note": f"Generata automaticamente da ricorrenza (spesa #{spesa_id})",
                        "ricorrenza_attiva": False,
                        "giorno_scadenza": giorno_scadenza,
                    }
                    sb.table("spese").insert(scadenza_dict).execute()
                    scadenze_generate += 1

        return {
            "success": True,
            "spesa": spesa_aggiornata,
            "scadenze_generate": scadenze_generate,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Errore aggiornamento spesa")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{spesa_id}")
async def elimina_spesa(spesa_id: int):
    """Elimina una spesa."""
    try:
        sb = get_supabase()
        res = sb.table("spese").delete().eq("id", spesa_id).execute()
        return {"success": True, "eliminata": bool(res.data)}
    except Exception as e:
        logger.exception("Errore eliminazione spesa")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/kpi")
async def kpi_spese(
    user_id: str = Query(...),
    mese: Optional[str] = Query(None, description="YYYY-MM (default: mese corrente)"),
):
    """KPI spese: totale mese, scadenze prossime 30gg, pagate/non pagate."""
    try:
        sb = get_supabase()
        oggi = date.today()
        if mese:
            inizio_mese = datetime.strptime(f"{mese}-01", "%Y-%m-%d").date()
        else:
            inizio_mese = oggi.replace(day=1)
        fine_mese = inizio_mese + relativedelta(months=1, days=-1)

        # Totale spese mese
        res_mese = sb.table("spese").select("importo").eq("user_id", user_id).gte("data", inizio_mese.isoformat()).lte("data", fine_mese.isoformat()).execute()
        totale_mese = sum(float(s.get("importo") or 0) for s in (res_mese.data or []))

        # Scadenze prossimi 7 giorni (non pagate)
        tra_7 = oggi + timedelta(days=7)
        res_scadenze_7 = sb.table("spese").select("importo").eq("user_id", user_id).eq("pagata", False).not_.is_("data_scadenza", "null").gte("data_scadenza", oggi.isoformat()).lte("data_scadenza", tra_7.isoformat()).execute()
        totale_scadenze_7gg = sum(float(s.get("importo") or 0) for s in (res_scadenze_7.data or []))
        n_scadenze_7gg = len(res_scadenze_7.data or [])

        # Scadenze prossimi 30 giorni (non pagate)
        tra_30 = oggi + timedelta(days=30)
        res_scadenze = sb.table("spese").select("importo").eq("user_id", user_id).eq("pagata", False).not_.is_("data_scadenza", "null").gte("data_scadenza", oggi.isoformat()).lte("data_scadenza", tra_30.isoformat()).execute()
        totale_scadenze_30gg = sum(float(s.get("importo") or 0) for s in (res_scadenze.data or []))
        n_scadenze_30gg = len(res_scadenze.data or [])

        # Pagate/non pagate nel mese
        res_mese_full = sb.table("spese").select("pagata, importo").eq("user_id", user_id).gte("data", inizio_mese.isoformat()).lte("data", fine_mese.isoformat()).execute()
        pagate = [s for s in (res_mese_full.data or []) if s.get("pagata")]
        non_pagate = [s for s in (res_mese_full.data or []) if not s.get("pagata")]

        return {
            "success": True,
            "mese": inizio_mese.strftime("%Y-%m"),
            "totale_mese": round(totale_mese, 2),
            "scadenze_prossimi_7gg": {
                "totale": round(totale_scadenze_7gg, 2),
                "numero": n_scadenze_7gg,
            },
            "scadenze_prossimi_30gg": {
                "totale": round(totale_scadenze_30gg, 2),
                "numero": n_scadenze_30gg,
            },
            "pagate": {
                "numero": len(pagate),
                "totale": round(sum(float(s.get("importo") or 0) for s in pagate), 2),
            },
            "non_pagate": {
                "numero": len(non_pagate),
                "totale": round(sum(float(s.get("importo") or 0) for s in non_pagate), 2),
            },
        }
    except Exception as e:
        logger.exception("Errore KPI spese")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# CATEGORIE
# ============================================================================

class CategoriaCreate(BaseModel):
    user_id: str
    nome: str

@router.get("/categorie")
async def lista_categorie(user_id: str = Query(...)):
    try:
        sb = get_supabase()
        res = sb.table("categorie_spese").select("id, nome").eq("user_id", user_id).order("nome").execute()
        return {"success": True, "categorie": res.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/categorie")
async def crea_categoria(cat: CategoriaCreate):
    try:
        sb = get_supabase()
        res = sb.table("categorie_spese").insert({"user_id": cat.user_id, "nome": cat.nome.strip()}).execute()
        return {"success": True, "categoria": res.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# RIEPILOGO IVA (Debito - Credito)
# ============================================================================

@router.get("/iva-riepilogo")
async def riepilogo_iva(
    user_id: str = Query(...),
    anno: int = Query(...),
    periodicita: str = Query("mensile", description="mensile | trimestrale"),
):
    """Calcola IVA a debito (fatture emesse) vs IVA a credito (spese) per periodo."""
    try:
        sb = get_supabase()

        # 1. Fatture emesse (IVA a debito)
        fatture = sb.table("fatture").select("data_inizio, iva_importo").eq("user_id", user_id).gte("data_inizio", f"{anno}-01-01").lte("data_inizio", f"{anno}-12-31").execute()

        # 1b. Scontrini (IVA a debito, solo se presenti)
        try:
            scontrini = sb.table("scontrini").select("data_emissione, iva_importo").eq("user_id", user_id).gte("data_emissione", f"{anno}-01-01").lte("data_emissione", f"{anno}-12-31").execute()
        except Exception:
            scontrini = type("obj", (), {"data": []})()

        # 2. Spese (IVA a credito)
        spese = sb.table("spese").select("data, iva").eq("user_id", user_id).gte("data", f"{anno}-01-01").lte("data", f"{anno}-12-31").execute()

        # 3. Aggrega per periodo
        periodi: dict[str, dict] = {}

        def chiave_periodo(data_str: str) -> str:
            from datetime import datetime as dt
            d = dt.strptime(data_str, "%Y-%m-%d")
            if periodicita == "annuale":
                return f"{anno}"
            elif periodicita == "trimestrale":
                trimestre = (d.month - 1) // 3 + 1
                return f"T{trimestre} {anno}"
            else:
                return f"{d.month:02d}/{anno}"

        for f in (fatture.data or []):
            data_rif = f.get("data_inizio") or f.get("data_fine")
            if data_rif:
                k = chiave_periodo(data_rif)
                periodi.setdefault(k, {"iva_debito": 0.0, "iva_credito": 0.0, "iva_ordini": 0.0})
                periodi[k]["iva_debito"] += float(f.get("iva_importo") or 0)

        for s in (scontrini.data or []):
            if s.get("data_emissione") and s.get("iva_importo") is not None:
                k = chiave_periodo(s["data_emissione"])
                periodi.setdefault(k, {"iva_debito": 0.0, "iva_credito": 0.0, "iva_ordini": 0.0})
                periodi[k]["iva_debito"] += float(s.get("iva_importo") or 0)

        for s in (spese.data or []):
            k = chiave_periodo(s["data"])
            periodi.setdefault(k, {"iva_debito": 0.0, "iva_credito": 0.0, "iva_ordini": 0.0})
            periodi[k]["iva_credito"] += float(s.get("iva") or 0)

        # 3. Ordini fornitori (IVA informativa, non nel saldo)
        try:
            ordini = sb.table("ordini_fornitore").select("data_ordine, totale_iva").eq("user_id", user_id).gte("data_ordine", f"{anno}-01-01").lte("data_ordine", f"{anno}-12-31").execute()
        except Exception:
            ordini = type("obj", (), {"data": []})()

        for o in (ordini.data or []):
            if o.get("data_ordine") and o.get("totale_iva") is not None:
                k = chiave_periodo(o["data_ordine"])
                periodi.setdefault(k, {"iva_debito": 0.0, "iva_credito": 0.0, "iva_ordini": 0.0})
                periodi[k]["iva_ordini"] = periodi[k].get("iva_ordini", 0.0) + float(o.get("totale_iva") or 0)

        # 4. Aggiungi saldo
        result = []
        for k in sorted(periodi.keys()):
            v = periodi[k]
            saldo = round(v["iva_debito"] - v["iva_credito"], 2)
            result.append({
                "periodo": k,
                "iva_debito": round(v["iva_debito"], 2),
                "iva_credito": round(v["iva_credito"], 2),
                "iva_ordini": round(v.get("iva_ordini", 0.0), 2),
                "saldo": saldo,
                "da_versare": saldo > 0,
            })

        return {
            "success": True,
            "anno": anno,
            "periodicita": periodicita,
            "periodi": result,
        }
    except Exception as e:
        logger.exception("Errore riepilogo IVA")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# IMPORT FATTURE DI ACQUISTO DA XML (FatturaPA)
# ============================================================================

def _estrai_dati_fatturapa(xml_dict: dict) -> dict | None:
    """Estrae i dati chiave da un XML FatturaPA (fattura di acquisto).
    Ritorna None se non è una fattura valida."""
    try:
        # La struttura FatturaPA ha radice "p:FatturaElettronica" o "FatturaElettronica"
        root = xml_dict.get("p:FatturaElettronica") or xml_dict.get("FatturaElettronica")
        if not root:
            return None

        header = root.get("FatturaElettronicaHeader", {})
        body = root.get("FatturaElettronicaBody", {})
        
        # Se body è una lista, prendi il primo (fatture multiple nello stesso file sono rare)
        if isinstance(body, list):
            body = body[0] if body else {}

        # Dati cedente/prestatore (fornitore)
        cedente = header.get("CedentePrestatore", {})
        dati_anagrafici_ced = cedente.get("DatiAnagrafici", {})
        anagrafica_ced = dati_anagrafici_ced.get("Anagrafica", {})
        id_fiscale_iva_ced = dati_anagrafici_ced.get("IdFiscaleIVA", {})
        
        # Fornitore: denominazione o nome+cognome
        denominazione = anagrafica_ced.get("Denominazione")
        if not denominazione:
            nome = anagrafica_ced.get("Nome", "")
            cognome = anagrafica_ced.get("Cognome", "")
            denominazione = f"{nome} {cognome}".strip() or "Fornitore sconosciuto"
        
        partita_iva = id_fiscale_iva_ced.get("IdCodice", "")

        # Dati documento
        dati_generali = body.get("DatiGenerali", {}).get("DatiGeneraliDocumento", {})
        tipo_doc = dati_generali.get("TipoDocumento", "TD01")
        numero = dati_generali.get("Numero", "")
        data_str = dati_generali.get("Data", "")  # YYYY-MM-DD
        importo_totale = float(dati_generali.get("ImportoTotaleDocumento", 0) or 0)

        # Se è una nota di credito (TD04) o simile, salta (per ora)
        if tipo_doc in ("TD04", "TD05"):
            return None

        # Calcola imponibile e IVA dalle righe
        totale_imponibile = 0.0
        totale_iva = 0.0
        riepiloghi = body.get("DatiBeniServizi", {}).get("DatiRiepilogo", [])
        if isinstance(riepiloghi, dict):
            riepiloghi = [riepiloghi]
        for r in riepiloghi:
            totale_imponibile += float(r.get("ImponibileImporto", 0) or 0)
            totale_iva += float(r.get("Imposta", 0) or 0)

        # Se l'importo totale è 0, usa imponibile + iva
        if importo_totale == 0:
            importo_totale = totale_imponibile + totale_iva

        # Scadenza pagamento (se presente)
        data_scadenza = None
        pagamenti = body.get("DatiPagamento", [])
        if isinstance(pagamenti, dict):
            pagamenti = [pagamenti]
        for p in pagamenti:
            dettagli = p.get("DettaglioPagamento", [])
            if isinstance(dettagli, dict):
                dettagli = [dettagli]
            for d in dettagli:
                if d.get("DataScadenzaPagamento"):
                    data_scadenza = d["DataScadenzaPagamento"]
                    break
            if data_scadenza:
                break

        return {
            "fornitore_denominazione": denominazione,
            "fornitore_partita_iva": partita_iva,
            "numero_fattura": numero,
            "data": data_str,
            "importo_totale": round(importo_totale, 2),
            "imponibile": round(totale_imponibile, 2),
            "iva": round(totale_iva, 2),
            "data_scadenza": data_scadenza,
            "tipo_documento": tipo_doc,
        }
    except Exception as e:
        logger.error("Errore parsing FatturaPA: %s", e)
        return None


@router.post("/import-xml")
async def import_xml_fatture(
    file: UploadFile = File(...),
    user_id: str = Query(...),
):
    """Importa fatture di acquisto da file XML (FatturaPA) o ZIP contenente XML.
    Crea record in `fatture_acquisto` e `spese` collegate."""
    try:
        sb = get_supabase()
        
        # Leggi il file
        content = await file.read()
        filename = file.filename or ""
        xml_files: list[tuple[str, bytes]] = []

        # Se è uno ZIP, estrai tutti gli XML
        if filename.lower().endswith('.zip'):
            try:
                with zipfile.ZipFile(io.BytesIO(content)) as z:
                    for name in z.namelist():
                        if not name.lower().endswith('.xml'):
                            continue
                        # Salta i file di sistema macOS
                        if name.startswith('__MACOSX/') or '/._' in name or name.startswith('._'):
                            continue
                        xml_files.append((name, z.read(name)))
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Errore lettura ZIP: {e}")
        elif filename.lower().endswith('.xml'):
            xml_files.append((filename, content))
        else:
            raise HTTPException(status_code=400, detail="File deve essere .xml o .zip")

        if not xml_files:
            raise HTTPException(status_code=400, detail="Nessun file XML trovato")

        importati = 0
        saltati = 0
        errori = []

        for fname, xml_bytes in xml_files:
            try:
                xml_dict = xmltodict.parse(xml_bytes)
                dati = _estrai_dati_fatturapa(xml_dict)
                if not dati:
                    saltati += 1
                    continue

                # Cerca fornitore per P.IVA, se non esiste lo crea
                fornitore_id = None
                if dati["fornitore_partita_iva"]:
                    res_f = sb.table("fornitori").select("id").eq("user_id", user_id).eq("partita_iva", dati["fornitore_partita_iva"]).execute()
                    if res_f.data and len(res_f.data) > 0:
                        fornitore_id = res_f.data[0]["id"]
                    else:
                        # Crea fornitore
                        res_new = sb.table("fornitori").insert({
                            "user_id": user_id,
                            "ragione_sociale": dati["fornitore_denominazione"],
                            "partita_iva": dati["fornitore_partita_iva"],
                        }).execute()
                        if res_new.data:
                            fornitore_id = res_new.data[0]["id"]

                # Verifica se la fattura esiste già (per numero + fornitore + data)
                res_esistente = sb.table("fatture_acquisto").select("id").eq("user_id", user_id).eq("numero_fattura", dati["numero_fattura"]).eq("data", dati["data"]).execute()
                if res_esistente.data and len(res_esistente.data) > 0:
                    saltati += 1
                    continue

                # Inserisci fattura di acquisto
                res_fatt = sb.table("fatture_acquisto").insert({
                    "user_id": user_id,
                    "fornitore_id": fornitore_id,
                    "numero_fattura": dati["numero_fattura"],
                    "data": dati["data"],
                    "data_scadenza": dati["data_scadenza"],
                    "imponibile": dati["imponibile"],
                    "iva": dati["iva"],
                    "totale": dati["importo_totale"],
                    "pagata": False,
                    "note": f"Importata da {fname}",
                }).execute()

                if res_fatt.data:
                    fatt_id = res_fatt.data[0]["id"]
                    # Crea spesa collegata
                    sb.table("spese").insert({
                        "user_id": user_id,
                        "data": dati["data"],
                        "descrizione": f"Fattura {dati['numero_fattura']} - {dati['fornitore_denominazione']}",
                        "importo": dati["importo_totale"],
                        "importo_ivato": True,
                        "imponibile": dati["imponibile"],
                        "iva": dati["iva"],
                        "categoria": "Fornitori",
                        "fornitore_id": fornitore_id,
                        "tipo": "una_tantum",
                        "data_scadenza": dati["data_scadenza"],
                        "pagata": False,
                        "fattura_acquisto_id": fatt_id,
                        "note": f"Importata da XML: {fname}",
                    }).execute()
                    importati += 1

            except Exception as e:
                errori.append(f"{fname}: {e}")
                logger.error("Errore import %s: %s", fname, e)

        return {
            "success": True,
            "file_totali": len(xml_files),
            "importati": importati,
            "saltati": saltati,
            "errori": errori[:10],  # max 10 errori mostrati
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Errore import XML")
        raise HTTPException(status_code=500, detail=str(e))
