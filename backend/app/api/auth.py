"""Auth endpoints — login / logout / me."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response, status
from pydantic import BaseModel

from app.services.auth import (
    COOKIE_NAME,
    check_credentials,
    cookie_max_age_seconds,
    make_token,
    verify_token,
)

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class MeResponse(BaseModel):
    authenticated: bool
    username: str | None = None


@router.post("/login")
async def login(req: LoginRequest, response: Response) -> dict:
    if not check_credentials(req.username, req.password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "用户名或密码错误")
    token = make_token(req.username)
    # httponly so JS can't read it; samesite=lax is fine since we share the
    # browser origin for the dev/prod setup. secure=False for localhost.
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=cookie_max_age_seconds(),
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
    )
    return {"authenticated": True, "username": req.username}


@router.post("/logout")
async def logout(response: Response) -> dict:
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"authenticated": False}


@router.get("/me", response_model=MeResponse)
async def me(request: Request) -> MeResponse:
    token = request.cookies.get(COOKIE_NAME)
    if verify_token(token):
        from app.config import get_settings
        return MeResponse(authenticated=True, username=get_settings().auth_username)
    return MeResponse(authenticated=False)
