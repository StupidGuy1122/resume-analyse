"""resume-analyse FastAPI app entry point."""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import analysis, auth, health, interview_session, resume
from app.config import get_settings
from app.services.auth import COOKIE_NAME, verify_token

settings = get_settings()

app = FastAPI(
    title="resume-analyse API",
    version="0.2.0",
    description="Intelligent resume analysis powered by local LLM (Ollama).",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,            # cookies cross-origin
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Auth gate — applied via middleware so it covers every API route uniformly.
# ---------------------------------------------------------------------------

# Paths that don't need auth.
_PUBLIC_PREFIXES = (
    "/health",
    "/api/auth/",
    "/docs",
    "/openapi.json",
    "/redoc",
)


@app.middleware("http")
async def auth_gate(request: Request, call_next):
    path = request.url.path
    # OPTIONS for CORS preflight
    if request.method == "OPTIONS":
        return await call_next(request)
    # Public paths — no auth needed
    if path == "/" or any(path.startswith(p) for p in _PUBLIC_PREFIXES):
        return await call_next(request)
    # Everything else under /api requires a valid session cookie
    if path.startswith("/api/"):
        token = request.cookies.get(COOKIE_NAME)
        if not verify_token(token):
            return JSONResponse(
                status_code=401,
                content={"detail": "未登录或会话已过期"},
            )
    return await call_next(request)


app.include_router(health.router)
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(resume.router, prefix="/api/resume", tags=["resume"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])
app.include_router(interview_session.router, prefix="/api/interview-session", tags=["interview"])


@app.get("/", tags=["meta"])
def root() -> dict[str, str]:
    return {"service": "resume-analyse API", "docs": "/docs"}
