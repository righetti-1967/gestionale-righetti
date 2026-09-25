"""Backend FastAPI Gestionale Righetti 1967."""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import licenze

logging.basicConfig(level=settings.log_level)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Gestionale Righetti 1967 API",
    version="0.1.0",
    description="Backend per gestione licenze DEMO, invio email/WhatsApp e sync con TricoAI",
)

app.include_router(licenze.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "gestionale-backend"}


@app.get("/")
async def root():
    return {
        "service": "Gestionale Righetti 1967",
        "docs": "/docs",
        "health": "/health",
    }
