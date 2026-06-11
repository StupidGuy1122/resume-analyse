"""resume-analyse FastAPI app entry point."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import analysis, health, resume
from app.config import get_settings

settings = get_settings()

app = FastAPI(
    title="resume-analyse API",
    version="0.1.0",
    description="Intelligent resume analysis powered by local LLM (Ollama).",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(resume.router, prefix="/api/resume", tags=["resume"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])


@app.get("/", tags=["meta"])
def root() -> dict[str, str]:
    return {"service": "resume-analyse API", "docs": "/docs"}
