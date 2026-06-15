from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from ..auth.dependencies import RequireAdmin
from ..database import get_db
from ..models.master import Author, Book, BookAuthor, College, Department, Faculty
from ..utils.csv_utils import make_csv_response

router = APIRouter(prefix="/export", tags=["CSV Export"])


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d")


# ---------------------------------------------------------------------------
# Authors
# ---------------------------------------------------------------------------

@router.get("/authors")
def export_authors(
    current_user: RequireAdmin,
    db: Annotated[Session, Depends(get_db)],
):
    authors = (
        db.query(Author)
        .filter(Author.is_active == True)
        .order_by(Author.author_name)
        .all()
    )
    headers = ["author_id", "author_name", "email", "phone", "bio"]
    rows = [
        [a.author_id, a.author_name, a.email or "", a.phone or "", a.bio or ""]
        for a in authors
    ]
    return make_csv_response(rows, headers, f"vni_authors_{_now()}.csv")


# ---------------------------------------------------------------------------
# Books
# ---------------------------------------------------------------------------

@router.get("/books")
def export_books(
    current_user: RequireAdmin,
    db: Annotated[Session, Depends(get_db)],
):
    books = (
        db.query(Book)
        .options(joinedload(Book.book_authors).joinedload(BookAuthor.author))
        .filter(Book.is_active == True)
        .order_by(Book.title)
        .all()
    )
    headers = [
        "book_id", "title", "isbn", "edition", "subject_area",
        "discipline", "mrp", "format", "comp_stock", "author_names",
    ]
    rows = []
    for b in books:
        authors_str = ";".join(
            ba.author.author_name
            for ba in sorted(b.book_authors, key=lambda x: x.author_order)
            if ba.author
        )
        rows.append([
            b.book_id, b.title, b.isbn or "", b.edition or "",
            b.subject_area or "", b.discipline or "",
            b.mrp, b.format, b.comp_stock, authors_str,
        ])
    return make_csv_response(rows, headers, f"vni_books_{_now()}.csv")


# ---------------------------------------------------------------------------
# Departments
# ---------------------------------------------------------------------------

@router.get("/departments")
def export_departments(
    current_user: RequireAdmin,
    db: Annotated[Session, Depends(get_db)],
    college_id: Optional[int] = Query(None),
):
    q = (
        db.query(Department)
        .options(joinedload(Department.college))
        .filter(Department.is_active == True)
    )
    if college_id:
        q = q.filter(Department.college_id == college_id)
    depts = q.order_by(Department.dept_name).all()
    headers = ["dept_id", "dept_name", "college_name"]
    rows = [
        [d.dept_id, d.dept_name, d.college.college_name if d.college else ""]
        for d in depts
    ]
    return make_csv_response(rows, headers, f"vni_departments_{_now()}.csv")


# ---------------------------------------------------------------------------
# Colleges
# ---------------------------------------------------------------------------

@router.get("/colleges")
def export_colleges(
    current_user: RequireAdmin,
    db: Annotated[Session, Depends(get_db)],
    region_id: Optional[int] = Query(None),
):
    q = (
        db.query(College)
        .options(joinedload(College.region))
        .filter(College.is_active == True)
    )
    if region_id:
        q = q.filter(College.region_id == region_id)
    colleges = q.order_by(College.college_name).all()

    headers = [
        "college_id", "college_name", "college_type", "region_name",
        "affiliated_university", "address_city", "address_district",
        "address_state", "address_pin", "phone", "email", "data_quality_flag",
    ]
    rows = [
        [
            c.college_id, c.college_name, c.college_type,
            c.region.region_name if c.region else "",
            c.affiliated_university or "", c.address_city or "",
            c.address_district or "", c.address_state,
            c.address_pin or "", c.phone or "", c.email or "",
            c.data_quality_flag,
        ]
        for c in colleges
    ]
    return make_csv_response(rows, headers, f"vni_colleges_{_now()}.csv")


# ---------------------------------------------------------------------------
# Faculty
# ---------------------------------------------------------------------------

@router.get("/faculty")
def export_faculty(
    current_user: RequireAdmin,
    db: Annotated[Session, Depends(get_db)],
    college_id: Optional[int] = Query(None),
):
    q = (
        db.query(Faculty)
        .options(joinedload(Faculty.college), joinedload(Faculty.department))
        .filter(Faculty.is_active == True)
    )
    if college_id:
        q = q.filter(Faculty.college_id == college_id)
    faculty = q.order_by(Faculty.faculty_name).all()

    headers = [
        "faculty_id", "faculty_name", "college_name", "dept_name",
        "designation", "phone_personal", "phone_whatsapp",
        "email", "alt_address", "data_quality_flag",
    ]
    rows = [
        [
            f.faculty_id, f.faculty_name,
            f.college.college_name if f.college else "",
            f.department.dept_name if f.department else "",
            f.designation or "", f.phone_personal or "",
            f.phone_whatsapp or "", f.email or "",
            f.alt_address or "", f.data_quality_flag,
        ]
        for f in faculty
    ]
    return make_csv_response(rows, headers, f"vni_faculty_{_now()}.csv")
