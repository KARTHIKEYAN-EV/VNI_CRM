from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import field_validator

from .auth import CamelModel
from .master import AuthorBrief, CollegeBrief, DeptBrief


# ---------------------------------------------------------------------------
# Brief / nested
# ---------------------------------------------------------------------------

class CourseBrief(CamelModel):
    course_id:   int
    course_name: str
    course_type: str


class SubjectBrief(CamelModel):
    subject_id:   int
    subject_name: str
    semester_year: Optional[str] = None


class SyllabusBookEntry(CamelModel):
    id:         int
    book_id:    int
    book_title: str
    book_role:  str          # Prescribed | Reference
    authors:    List[AuthorBrief] = []


# ---------------------------------------------------------------------------
# Unit breakdown — stored as JSONB, edited as structured list
# ---------------------------------------------------------------------------

class SyllabusUnit(CamelModel):
    unit_number: int
    title:       Optional[str] = None
    topics:      str           # free text — comma-separated or paragraph


# =============================================================================
# COURSE
# =============================================================================

class CourseCreate(CamelModel):
    dept_id:               int
    college_id:            int
    course_name:           str
    course_type:           str = "UG"
    duration_years:        int = 3
    affiliated_university: Optional[str] = None

    @field_validator("course_type")
    @classmethod
    def valid_type(cls, v: str) -> str:
        if v not in {"UG", "PG", "Diploma"}:
            raise ValueError("course_type must be UG, PG, or Diploma")
        return v

    @field_validator("duration_years")
    @classmethod
    def positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("duration_years must be at least 1")
        return v


class CourseUpdate(CamelModel):
    course_name:           Optional[str] = None
    course_type:           Optional[str] = None
    duration_years:        Optional[int] = None
    affiliated_university: Optional[str] = None
    is_active:             Optional[bool] = None


class CourseResponse(CamelModel):
    course_id:             int
    course_name:           str
    course_type:           str
    duration_years:        int
    dept_id:               int
    college_id:            int
    department:            Optional[DeptBrief]    = None
    college:               Optional[CollegeBrief] = None
    affiliated_university: Optional[str]
    is_active:             bool
    created_at:            datetime
    subject_count:         int = 0          # computed


# =============================================================================
# SUBJECT
# =============================================================================

class SubjectCreate(CamelModel):
    course_id:    int
    subject_name: str
    subject_code: Optional[str] = None
    semester_year: Optional[str] = None    # e.g. "Semester 3", "Year 2"
    subject_type: str = "Core"

    @field_validator("subject_type")
    @classmethod
    def valid_type(cls, v: str) -> str:
        if v not in {"Core", "Elective", "Lab"}:
            raise ValueError("subject_type must be Core, Elective, or Lab")
        return v


class SubjectUpdate(CamelModel):
    subject_name:  Optional[str]  = None
    subject_code:  Optional[str]  = None
    semester_year: Optional[str]  = None
    subject_type:  Optional[str]  = None
    is_active:     Optional[bool] = None


class SubjectResponse(CamelModel):
    subject_id:    int
    subject_name:  str
    subject_code:  Optional[str]
    semester_year: Optional[str]
    subject_type:  str
    course_id:     int
    course:        Optional[CourseBrief] = None
    is_active:     bool
    created_at:    datetime
    syllabus_count: int = 0     # computed


# =============================================================================
# SYLLABUS
# =============================================================================

class SyllabusCreate(CamelModel):
    subject_id:         int
    university:         str
    regulation_year:    str               # e.g. "2021 Regulation"
    unit_breakdown:     Optional[List[SyllabusUnit]] = None
    last_verified_date: Optional[date]   = None
    source_notes:       Optional[str]    = None


class SyllabusUpdate(CamelModel):
    university:         Optional[str]              = None
    regulation_year:    Optional[str]              = None
    unit_breakdown:     Optional[List[SyllabusUnit]] = None
    last_verified_date: Optional[date]             = None
    source_notes:       Optional[str]              = None
    is_active:          Optional[bool]             = None


class SyllabusResponse(CamelModel):
    syllabus_id:        int
    subject_id:         int
    subject:            Optional[SubjectBrief] = None
    university:         str
    regulation_year:    str
    unit_breakdown:     Optional[List[Dict[str, Any]]] = None
    last_verified_date: Optional[date]
    source_notes:       Optional[str]
    is_active:          bool
    created_at:         datetime
    books:              List[SyllabusBookEntry] = []


# =============================================================================
# SYLLABUS BOOK ASSIGNMENT
# =============================================================================

class SyllabusBookAssign(CamelModel):
    book_id:   int
    book_role: str = "Prescribed"

    @field_validator("book_role")
    @classmethod
    def valid_role(cls, v: str) -> str:
        if v not in {"Prescribed", "Reference"}:
            raise ValueError("book_role must be Prescribed or Reference")
        return v


# =============================================================================
# FACULTY SUBJECT ASSIGNMENT
# =============================================================================

class FacultySubjectAssign(CamelModel):
    faculty_id:    int
    subject_id:    int
    academic_year: Optional[str] = None    # e.g. "2025-26"


class FacultySubjectResponse(CamelModel):
    id:            int
    faculty_id:    int
    faculty_name:  Optional[str] = None
    subject_id:    int
    subject_name:  Optional[str] = None
    academic_year: Optional[str]
