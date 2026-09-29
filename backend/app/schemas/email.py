from typing import Optional
from pydantic import BaseModel


class TestEmailRequest(BaseModel):
    google_script_url: Optional[str] = None
    host: Optional[str] = None
    port: int = 587
    secure: bool = False
    username: Optional[str] = None
    password: Optional[str] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = None
    destinatario: str


class EmailResponse(BaseModel):
    success: bool
    messaggio: str
