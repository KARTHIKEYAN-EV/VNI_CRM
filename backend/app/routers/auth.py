from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..auth.dependencies import CurrentUser
from ..auth.jwt_handler import create_access_token, hash_password, verify_password
from ..config import get_settings
from ..database import get_db
from ..models import User
from ..schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    TokenResponse,
    UserProfile,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])
settings = get_settings()


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
):
    """
    Authenticate with email + password.
    Returns a JWT and the user profile.
    Token embeds role so downstream routes don't need a DB lookup for RBAC checks.
    """
    user = (
        db.query(User)
        .filter(
            User.email == payload.email.lower().strip(),
            User.is_active == True,
        )
        .first()
    )

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    expires_delta = timedelta(minutes=settings.jwt_expire_minutes)
    access_token  = create_access_token(
        data={"sub": str(user.user_id), "role": user.role},
        expires_delta=expires_delta,
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=int(expires_delta.total_seconds()),
        user=UserProfile.model_validate(user),
    )


@router.get("/me", response_model=UserProfile)
def get_me(current_user: CurrentUser):
    """Return the currently authenticated user's profile."""
    return current_user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: ChangePasswordRequest,
    current_user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
):
    """Change password for the currently authenticated user."""
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    current_user.password_hash = hash_password(payload.new_password)
    current_user.updated_by    = current_user.user_id
    db.commit()
