"""Resume upload + retrieval endpoints."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.config import get_settings
from app.schemas.resume import ParsedResume, ResumeDetail, ResumeUploadResponse
from app.services.parser import SUPPORTED_EXTENSIONS, UnsupportedFileType, extract_text
from app.services.storage import store

router = APIRouter()


@router.post("/upload", response_model=ResumeUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_resume(file: UploadFile = File(...)) -> ResumeUploadResponse:
    """Accept a PDF/DOCX/TXT, parse it, store in memory, return an id."""
    settings = get_settings()
    data = await file.read()

    if len(data) > settings.max_upload_bytes:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"File exceeds {settings.max_upload_mb} MB.",
        )

    try:
        text = extract_text(file.filename or "unknown", data)
    except UnsupportedFileType as exc:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            str(exc),
        ) from exc

    if not text.strip():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Could not extract any text from the uploaded file.",
        )

    resume_id = uuid.uuid4().hex
    parsed = ParsedResume(
        resume_id=resume_id,
        filename=file.filename or "resume",
        raw_text=text,
        char_count=len(text),
    )
    store.put_resume(parsed)

    return ResumeUploadResponse(
        resume_id=resume_id,
        filename=parsed.filename,
        char_count=parsed.char_count,
        preview=text[:300],
    )


@router.get("/{resume_id}", response_model=ResumeDetail)
async def get_resume(resume_id: str) -> ResumeDetail:
    parsed = store.get_resume(resume_id)
    if parsed is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resume not found.")
    return ResumeDetail(
        resume_id=parsed.resume_id,
        filename=parsed.filename,
        raw_text=parsed.raw_text,
        char_count=parsed.char_count,
    )


@router.get("/_meta/supported")
async def supported_types() -> dict[str, list[str]]:
    """List supported file extensions — useful for the frontend dropzone."""
    return {"extensions": sorted(SUPPORTED_EXTENSIONS)}
