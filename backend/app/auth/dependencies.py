from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from .jwt_handler import decode_access_token

security = HTTPBearer()


# ---------------------------------------------------------------------------
# Core: resolve current user from Bearer token
# ---------------------------------------------------------------------------

def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token — missing subject claim",
        )

    user = (
        db.query(User)
        .filter(User.user_id == int(user_id), User.is_active == True)
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated",
        )

    return user


# ---------------------------------------------------------------------------
# Role guard factory
# ---------------------------------------------------------------------------

def require_roles(*roles: str):
    """
    Returns a FastAPI dependency that enforces the current user has one of
    the given roles.  Raises 403 otherwise.

    Usage:
        @router.get("/ceo-only")
        def endpoint(user = Depends(require_roles("ceo", "admin"))):
            ...
    """
    def _check(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied. Required: {', '.join(roles)}. "
                    f"Your role: {current_user.role}"
                ),
            )
        return current_user
    return _check


# ---------------------------------------------------------------------------
# Pre-built annotated dependencies for common role sets
# (use these directly in route signatures for clean, readable code)
# ---------------------------------------------------------------------------

# Any authenticated user
CurrentUser = Annotated[User, Depends(get_current_user)]

# Admin only
RequireAdmin = Annotated[User, Depends(require_roles("admin"))]

# CEO approval actions (admin can also act in place of CEO for system tasks)
RequireCEO = Annotated[User, Depends(require_roles("ceo", "admin"))]

# Anyone who can create / manage comp requests
RequireRep = Annotated[User, Depends(require_roles("rep", "manager", "ceo", "admin"))]

# Fulfilment team
RequireBackOffice = Annotated[User, Depends(require_roles("back_office", "admin"))]

# Read access to reports (managers see own region; CEO/admin see all; back_office limited — filtered in service layer)
RequireReports = Annotated[User, Depends(require_roles("manager", "ceo", "admin", "back_office"))]
