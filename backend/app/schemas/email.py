from typing import Optional
from pydantic import BaseModel, EmailStr


class TestEmailRequest(BaseModel):
    host: str
    port: int = 587
    secure: bool = False
    username: str
    password: str
    from_email: Optional[str] = None
    from_name: Optional[str] = None
    destinatario: str


class EmailResponse(BaseModel):
    success: bool
    messaggio: str
