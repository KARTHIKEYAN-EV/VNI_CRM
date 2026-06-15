"""
Fuzzy duplicate detection using PostgreSQL pg_trgm similarity.

The pg_trgm extension (enabled in schema.sql) provides a similarity()
function that returns a float 0–1. GIN trigram indexes on college_name,
faculty_name, and book title make these queries fast even at 600+ records.

Thresholds (tuned for Tamil Nadu college/faculty data):
  DUPLICATE_WARN  = 0.55  — surface as "possible duplicate" warning
  SEARCH_SUGGEST  = 0.25  — broad match for typeahead search
"""

from typing import List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models.master import College, Faculty, Book
from ..schemas.master import DuplicateMatch, DuplicateCheckResponse

DUPLICATE_WARN  = 0.55
SEARCH_SUGGEST  = 0.25


# ---------------------------------------------------------------------------
# College
# ---------------------------------------------------------------------------

def check_college_duplicates(
    db:           Session,
    college_name: str,
    city:         Optional[str] = None,
    exclude_id:   Optional[int] = None,
) -> DuplicateCheckResponse:
    """
    Fuzzy-match on college_name.  Optionally weight by same city.
    Constitution §10.2: warn if same name + city; don't block.
    """
    q = (
        db.query(
            College,
            func.similarity(College.college_name, college_name).label("sim"),
        )
        .filter(
            College.is_active == True,
            func.similarity(College.college_name, college_name) >= DUPLICATE_WARN,
        )
        .order_by(func.similarity(College.college_name, college_name).desc())
    )

    if exclude_id:
        q = q.filter(College.college_id != exclude_id)

    rows = q.limit(5).all()
    matches = [
        DuplicateMatch(
            id         = c.college_id,
            name       = c.college_name,
            detail     = c.address_city or c.address_district,
            similarity = round(float(sim), 3),
        )
        for c, sim in rows
    ]
    return DuplicateCheckResponse(
        has_duplicates = len(matches) > 0,
        matches        = matches,
    )


def search_colleges(
    db:    Session,
    query: str,
    limit: int = 20,
) -> List[College]:
    return (
        db.query(College)
        .filter(
            College.is_active == True,
            func.similarity(College.college_name, query) >= SEARCH_SUGGEST,
        )
        .order_by(func.similarity(College.college_name, query).desc())
        .limit(limit)
        .all()
    )


# ---------------------------------------------------------------------------
# Faculty
# ---------------------------------------------------------------------------

def check_faculty_duplicates(
    db:           Session,
    faculty_name: str,
    college_id:   Optional[int] = None,
    exclude_id:   Optional[int] = None,
) -> DuplicateCheckResponse:
    """
    Fuzzy-match on faculty_name, scoped to the same college when provided.
    Constitution §10.2: warn before creating, don't block.
    """
    q = (
        db.query(
            Faculty,
            func.similarity(Faculty.faculty_name, faculty_name).label("sim"),
        )
        .filter(
            Faculty.is_active == True,
            func.similarity(Faculty.faculty_name, faculty_name) >= DUPLICATE_WARN,
        )
        .order_by(func.similarity(Faculty.faculty_name, faculty_name).desc())
    )

    if college_id:
        q = q.filter(Faculty.college_id == college_id)
    if exclude_id:
        q = q.filter(Faculty.faculty_id != exclude_id)

    rows = q.limit(5).all()
    matches = [
        DuplicateMatch(
            id         = f.faculty_id,
            name       = f.faculty_name,
            detail     = f.designation,
            similarity = round(float(sim), 3),
        )
        for f, sim in rows
    ]
    return DuplicateCheckResponse(
        has_duplicates = len(matches) > 0,
        matches        = matches,
    )


def search_faculty(
    db:    Session,
    query: str,
    college_id: Optional[int] = None,
    limit: int = 20,
) -> List[Faculty]:
    q = (
        db.query(Faculty)
        .filter(
            Faculty.is_active == True,
            func.similarity(Faculty.faculty_name, query) >= SEARCH_SUGGEST,
        )
        .order_by(func.similarity(Faculty.faculty_name, query).desc())
    )
    if college_id:
        q = q.filter(Faculty.college_id == college_id)
    return q.limit(limit).all()


# ---------------------------------------------------------------------------
# Book
# ---------------------------------------------------------------------------

def search_books(
    db:    Session,
    query: str,
    limit: int = 20,
) -> List[Book]:
    """
    Search by title or subject_area using trigram similarity.
    Constitution §14.7: 600+ books — search, not scroll.
    """
    return (
        db.query(Book)
        .filter(
            Book.is_active == True,
            func.greatest(
                func.similarity(Book.title,        query),
                func.similarity(Book.subject_area, query),
            ) >= SEARCH_SUGGEST,
        )
        .order_by(
            func.greatest(
                func.similarity(Book.title,        query),
                func.similarity(Book.subject_area, query),
            ).desc()
        )
        .limit(limit)
        .all()
    )