from typing import Optional
from pydantic import BaseModel


class SheetSyncRequest(BaseModel):
    sheet_url: str
    user_id: Optional[str] = None


class SheetsSyncResponse(BaseModel):
    success: bool = True
    nuovi: int
    aggiornati: int
    saltati: int
    totale: int
    messaggio: str
