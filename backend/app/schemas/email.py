from typing import Optional
from pydantic import BaseModel


class InviaEmailRequest(BaseModel):
    destinatario: str
    oggetto: str
    corpo_html: str
    corpo_testo: Optional[str] = None
    from_name: Optional[str] = None
    google_script_url: Optional[str] = None
    # Parametri opzionali SMTP
    host: Optional[str] = None
    port: int = 587
    secure: bool = False
    username: Optional[str] = None
    password: Optional[str] = None
    from_email: Optional[str] = None


class TestEmailRequest(BaseModel):
    destinatario: str
    google_script_url: Optional[str] = None
    host: Optional[str] = None
    port: int = 587
    secure: bool = False
    username: Optional[str] = None
    password: Optional[str] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = None


class EmailResponse(BaseModel):
    success: bool
    messaggio: str
