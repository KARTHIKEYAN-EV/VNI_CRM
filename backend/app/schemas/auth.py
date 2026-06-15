from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """
    Base schema for all API request/response models.
    - Inputs  accept both camelCase (alias) and snake_case (field name).
    - Outputs always emit camelCase (aliases).
    This keeps the DB/backend in snake_case while the frontend receives camelCase.
    FastAPI + Pydantic handle the translation automatically.
    """
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,   # allow snake_case input too
        from_attributes=True,    # ORM mode — read from SQLAlchemy models
    )


# ---------------------------------------------------------------------------
# Auth schemas
# ---------------------------------------------------------------------------

class LoginRequest(CamelModel):
    email:    str
    password: str


class UserProfile(CamelModel):
    user_id:   int
    full_name: str
    email:     str
    role:      str
    region_id: Optional[int]
    is_active: bool


class TokenResponse(CamelModel):
    access_token: str
    token_type:   str = "bearer"
    expires_in:   int           # seconds
    user:         UserProfile


class ChangePasswordRequest(CamelModel):
    current_password: str
    new_password:     str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v
