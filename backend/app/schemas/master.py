from datetime import datetime
from math import ceil
from typing import Generic, List, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator
from pydantic.alias_generators import to_camel

from .auth import CamelModel

# ---------------------------------------------------------------------------
# Generic paginated response
# ---------------------------------------------------------------------------

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )
    items:     List[T]
    total:     int
    page:      int
    page_size: int
    pages:     int

    @classmethod
    def build(cls, items: List[T], total: int, page: int, page_size: int):
        return cls(
            items     = items,
            total     = total,
            page      = page,
            page_size = page_size,
            pages     = max(1, ceil(total / page_size)),
        )


# ---------------------------------------------------------------------------
# Duplicate check
# ---------------------------------------------------------------------------

class DuplicateMatch(CamelModel):
    id:         int
    name:       str
    detail:     Optional[str] = None   # e.g. city, college name
    similarity: float


class DuplicateCheckResponse(CamelModel):
    has_duplicates: bool
    matches:        List[DuplicateMatch]


# ---------------------------------------------------------------------------
# Brief / nested schemas (embedded in list responses to avoid N+1)
# ---------------------------------------------------------------------------

class RegionBrief(CamelModel):
    region_id:   int
    region_name: str


class CollegeBrief(CamelModel):
    college_id:   int
    college_name: str


class DeptBrief(CamelModel):
    dept_id:   int
    dept_name: str


class AuthorBrief(CamelModel):
    author_id:    int
    author_name:  str
    author_order: int = 1


# =============================================================================
# REGION
# =============================================================================

class RegionCreate(CamelModel):
    region_name:       str
    districts_covered: Optional[str] = None


class RegionUpdate(CamelModel):
    region_name:       Optional[str] = None
    districts_covered: Optional[str] = None
    is_active:         Optional[bool] = None


class RegionResponse(CamelModel):
    region_id:         int
    region_name:       str
    districts_covered: Optional[str]
    is_active:         bool
    created_at:        datetime


# =============================================================================
# USER  (admin-only management)
# =============================================================================

class UserCreate(CamelModel):
    full_name: str
    email:     str
    password:  str
    role:      str
    region_id: Optional[int] = None
    phone:     Optional[str] = None

    @field_validator("role")
    @classmethod
    def valid_role(cls, v: str) -> str:
        allowed = {"rep", "manager", "ceo", "back_office", "admin"}
        if v not in allowed:
            raise ValueError(f"Role must be one of: {', '.join(sorted(allowed))}")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


# class UserUpdate(CamelModel):
#     full_name: Optional[str]  = None
#     role:      Optional[str]  = None
#     region_id: Optional[int]  = None
#     phone:     Optional[str]  = None
#     is_active: Optional[bool] = None

class UserUpdate(CamelModel):
    full_name: Optional[str]  = None
    role:      Optional[str]  = None
    region_id: Optional[int]  = None
    phone:     Optional[str]  = None
    is_active: Optional[bool] = None
    password:  Optional[str]  = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if v is None:
            return v
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v
    
class UserResponse(CamelModel):
    user_id:   int
    full_name: str
    email:     str
    role:      str
    region_id: Optional[int]
    region:    Optional[RegionBrief] = None
    phone:     Optional[str]
    is_active: bool
    created_at: datetime


# =============================================================================
# COLLEGE
# =============================================================================

class CollegeCreate(CamelModel):
    college_name:          str
    college_type:          str
    region_id:             int
    affiliated_university: Optional[str] = None
    address_street:        Optional[str] = None
    address_city:          Optional[str] = None
    address_district:      Optional[str] = None
    address_state:         str = "Tamil Nadu"
    address_pin:           Optional[str] = None
    phone:                 Optional[str] = None
    email:                 Optional[str] = None

    @field_validator("college_type")
    @classmethod
    def valid_type(cls, v: str) -> str:
        allowed = {"Engineering", "Arts&Science", "Other"}
        if v not in allowed:
            raise ValueError(f"college_type must be one of: {', '.join(sorted(allowed))}")
        return v


class CollegeUpdate(CamelModel):
    college_name:          Optional[str]  = None
    college_type:          Optional[str]  = None
    region_id:             Optional[int]  = None
    affiliated_university: Optional[str]  = None
    address_street:        Optional[str]  = None
    address_city:          Optional[str]  = None
    address_district:      Optional[str]  = None
    address_state:         Optional[str]  = None
    address_pin:           Optional[str]  = None
    phone:                 Optional[str]  = None
    email:                 Optional[str]  = None
    is_active:             Optional[bool] = None


class CollegeResponse(CamelModel):
    college_id:            int
    college_name:          str
    college_type:          str
    region_id:             int
    region:                Optional[RegionBrief] = None
    affiliated_university: Optional[str]
    address_street:        Optional[str]
    address_city:          Optional[str]
    address_district:      Optional[str]
    address_state:         str
    address_pin:           Optional[str]
    phone:                 Optional[str]
    email:                 Optional[str]
    data_quality_flag:     str
    is_active:             bool
    created_at:            datetime


# =============================================================================
# DEPARTMENT
# =============================================================================

class DepartmentCreate(CamelModel):
    college_id: int
    dept_name:  str


class DepartmentUpdate(CamelModel):
    dept_name: Optional[str]  = None
    is_active: Optional[bool] = None


class DepartmentResponse(CamelModel):
    dept_id:   int
    dept_name: str
    college_id: int
    college:   Optional[CollegeBrief] = None
    is_active: bool
    created_at: datetime


# =============================================================================
# FACULTY
# =============================================================================

class FacultyCreate(CamelModel):
    faculty_name:   str
    college_id:     int
    dept_id:        int
    designation:    Optional[str] = None
    phone_personal: Optional[str] = None
    phone_work:     Optional[str] = None
    phone_whatsapp: Optional[str] = None
    email:          Optional[str] = None
    alt_address:    Optional[str] = None

    @field_validator("designation")
    @classmethod
    def valid_designation(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        allowed = {"Professor", "Asst. Professor", "HOD", "Principal", "Other"}
        if v not in allowed:
            raise ValueError(f"designation must be one of: {', '.join(sorted(allowed))}")
        return v


class FacultyUpdate(CamelModel):
    faculty_name:   Optional[str]  = None
    college_id:     Optional[int]  = None
    dept_id:        Optional[int]  = None
    designation:    Optional[str]  = None
    phone_personal: Optional[str]  = None
    phone_work:     Optional[str]  = None
    phone_whatsapp: Optional[str]  = None
    email:          Optional[str]  = None
    alt_address:    Optional[str]  = None
    is_active:      Optional[bool] = None


class FacultyResponse(CamelModel):
    faculty_id:        int
    faculty_name:      str
    college_id:        int
    college:           Optional[CollegeBrief] = None
    dept_id:           int
    department:        Optional[DeptBrief] = None
    designation:       Optional[str]
    phone_personal:    Optional[str]
    phone_work:        Optional[str]
    phone_whatsapp:    Optional[str]
    email:             Optional[str]
    alt_address:       Optional[str]
    data_quality_flag: str
    is_active:         bool
    created_at:        datetime


# =============================================================================
# AUTHOR
# =============================================================================

class AuthorCreate(CamelModel):
    author_name: str
    email:       Optional[str] = None
    phone:       Optional[str] = None
    bio:         Optional[str] = None


class AuthorUpdate(CamelModel):
    author_name: Optional[str]  = None
    email:       Optional[str]  = None
    phone:       Optional[str]  = None
    bio:         Optional[str]  = None
    is_active:   Optional[bool] = None


class AuthorResponse(CamelModel):
    author_id:   int
    author_name: str
    email:       Optional[str]
    phone:       Optional[str]
    bio:         Optional[str]
    is_active:   bool
    created_at:  datetime


# =============================================================================
# BOOK
# =============================================================================

class BookAuthorAssign(CamelModel):
    author_id:    int
    author_order: int = 1


class BookCreate(CamelModel):
    title:        str
    isbn:         Optional[str] = None
    edition:      Optional[str] = None
    subject_area: Optional[str] = None
    discipline:   Optional[str] = None
    mrp:          int
    format:       str = "Physical"
    comp_stock:   int = 0
    authors:      List[BookAuthorAssign] = []

    @field_validator("mrp", "comp_stock")
    @classmethod
    def non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Must be a non-negative integer")
        return v

    @field_validator("format")
    @classmethod
    def valid_format(cls, v: str) -> str:
        if v not in {"Physical", "Digital", "Both"}:
            raise ValueError("format must be Physical, Digital, or Both")
        return v


class BookUpdate(CamelModel):
    title:        Optional[str]  = None
    isbn:         Optional[str]  = None
    edition:      Optional[str]  = None
    subject_area: Optional[str]  = None
    discipline:   Optional[str]  = None
    mrp:          Optional[int]  = None
    format:       Optional[str]  = None
    comp_stock:   Optional[int]  = None
    is_active:    Optional[bool] = None
    authors:      Optional[List[BookAuthorAssign]] = None


class BookResponse(CamelModel):
    book_id:      int
    isbn:         Optional[str]
    title:        str
    edition:      Optional[str]
    subject_area: Optional[str]
    discipline:   Optional[str]
    mrp:          int
    format:       str
    comp_stock:   int
    is_active:    bool
    created_at:   datetime
    authors:      List[AuthorBrief] = []
