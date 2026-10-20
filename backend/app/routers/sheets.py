import logging
from fastapi import APIRouter, HTTPException

from app.schemas.sheets import SheetSyncRequest, SheetsSyncResponse
from app.services.sheets_sync import sync_google_sheets

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sheets", tags=["sheets"])


@router.post("/sync", response_model=SheetsSyncResponse)
async def sync_sheets_endpoint(req: SheetSyncRequest):
    try:
        res = sync_google_sheets(req.sheet_url, req.user_id)
        msg = f"Sincronizzazione completata: {res['nuovi']} nuovi clienti, {res['aggiornati']} aggiornati."
        return SheetsSyncResponse(
            success=True,
            nuovi=res["nuovi"],
            aggiornati=res["aggiornati"],
            saltati=res["saltati"],
            totale=res["totale"],
            messaggio=msg,
        )
    except Exception as e:
        logger.error("Errore sync sheets endpoint: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
