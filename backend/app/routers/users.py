from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from ..auth.dependencies import CurrentUser, RequireAdmin, require_roles
from ..auth.jwt_handler import hash_password
from ..database import get_db
from ..models import Region, User
from ..schemas.master import (
    PaginatedResponse,
    RegionBrief,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from ..utils.pagination import Pagination

router = APIRouter(prefix="/users", tags=["Users"])


def _to_response(user: User) -> UserResponse:
    data = UserResponse.model_validate(user)
    if user.region:
        data.region = RegionBrief.model_validate(user.region)
    return data


@router.get("", response_model=PaginatedResponse[UserResponse])
def list_users(
    current_user: Annotated[User, Depends(require_roles("admin", "ceo", "manager"))],
    db:           Annotated[Session, Depends(get_db)],
    pagination:   Annotated[Pagination, Depends()],
    role:         Optional[str]  = Query(None),
    region_id:    Optional[int]  = Query(None),
    is_active:    Optional[bool] = Query(True),
    search:       Optional[str]  = Query(None),
):
    q = db.query(User).options(joinedload(User.region))
    if is_active is not None:
        q = q.filter(User.is_active == is_active)
    if role:
        q = q.filter(User.role == role)
    if region_id:
        q = q.filter(User.region_id == region_id)
    if search:
        q = q.filter(User.full_name.ilike(f"%{search}%"))

    total = q.count()
    users = q.order_by(User.full_name).offset(pagination.offset).limit(pagination.page_size).all()
    return PaginatedResponse.build(
        items     = [_to_response(u) for u in users],
        total     = total,
        page      = pagination.page,
        page_size = pagination.page_size,
    )


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload:      UserCreate,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    if db.query(User).filter(User.email == payload.email.lower().strip()).first():
        raise HTTPException(status_code=409, detail="A user with this email already exists")

    if payload.region_id:
        if not db.query(Region).filter(Region.region_id == payload.region_id,
                                        Region.is_active == True).first():
            raise HTTPException(status_code=404, detail="Region not found")

    user = User(
        full_name     = payload.full_name,
        email         = payload.email.lower().strip(),
        password_hash = hash_password(payload.password),
        role          = payload.role,
        region_id     = payload.region_id,
        phone         = payload.phone,
        created_by    = current_user.user_id,
        updated_by    = current_user.user_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _to_response(user)


@router.get("/me", response_model=UserResponse)
def get_own_profile(
    current_user: CurrentUser,
    db:           Annotated[Session, Depends(get_db)],
):
    """Any authenticated user can fetch their own full profile."""
    user = db.query(User).options(joinedload(User.region)).filter(
        User.user_id == current_user.user_id
    ).first()
    return _to_response(user)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id:      int,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    user = db.query(User).options(joinedload(User.region)).filter(
        User.user_id == user_id
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _to_response(user)


# @router.put("/{user_id}", response_model=UserResponse)
# def update_user(
#     user_id:      int,
#     payload:      UserUpdate,
#     current_user: RequireAdmin,
#     db:           Annotated[Session, Depends(get_db)],
# ):
#     user = db.query(User).filter(User.user_id == user_id).first()
#     if not user:
#         raise HTTPException(status_code=404, detail="User not found")

#     for field, value in payload.model_dump(exclude_none=True).items():
#         setattr(user, field, value)
#     user.updated_by = current_user.user_id
#     db.commit()
#     db.refresh(user)
#     return _to_response(user)

@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: UserUpdate,
    current_user: RequireAdmin,
    db: Annotated[Session, Depends(get_db)],
):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    data = payload.model_dump(exclude_none=True)

    # Handle password separately
    password = data.pop("password", None)
    if password:
        user.password_hash = hash_password(password)
        
    # Update remaining fields
    for field, value in data.items():
        setattr(user, field, value)

    user.updated_by = current_user.user_id

    db.commit()
    db.refresh(user)

    return _to_response(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_user(
    user_id:      int,
    current_user: RequireAdmin,
    db:           Annotated[Session, Depends(get_db)],
):
    if user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active  = False
    user.updated_by = current_user.user_id
    db.commit()
