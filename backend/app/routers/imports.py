from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..auth.dependencies import RequireAdmin
from ..database import get_db
from ..models.master import Author, Book, BookAuthor, College, Department, Faculty, Region
from ..utils.csv_utils import parse_csv_upload

router = APIRouter(prefix="/import", tags=["CSV Import"])

MAX_IMPORT_ROWS = 1000


# ---------------------------------------------------------------------------
# Authors
# ---------------------------------------------------------------------------

@router.post("/authors")
async def import_authors(
    current_user: RequireAdmin,
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
):
    """
    Expected CSV columns:
        author_name (required), email, phone, bio
    """
    contents = await file.read()
    try:
        _, rows = parse_csv_upload(contents)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if len(rows) > MAX_IMPORT_ROWS:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_IMPORT_ROWS} rows per import.")

    REQUIRED = {"author_name"}
    errors = []
    to_insert = []

    for i, row in enumerate(rows, start=2):
        missing = REQUIRED - {k for k, v in row.items() if v and v.strip()}
        if missing:
            errors.append({"row": i, "error": f"Missing required field(s): {', '.join(missing)}"})
            continue

        name = row["author_name"].strip()

        exists = (
            db.query(Author)
            .filter(Author.author_name == name, Author.is_active == True)
            .first()
        )
        if exists:
            errors.append({"row": i, "error": f"Author '{name}' already exists (id={exists.author_id}). Skipped."})
            continue

        to_insert.append(Author(
            author_name = name,
            email       = row.get("email", "").strip() or None,
            phone       = row.get("phone", "").strip() or None,
            bio         = row.get("bio", "").strip() or None,
            created_by  = current_user.user_id,
            updated_by  = current_user.user_id,
        ))

    if to_insert:
        db.add_all(to_insert)
        db.commit()

    return {"imported": len(to_insert), "skipped": len(errors), "errors": errors}


# ---------------------------------------------------------------------------
# Books
# ---------------------------------------------------------------------------

@router.post("/books")
async def import_books(
    current_user: RequireAdmin,
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
):
    """
    Expected CSV columns:
        title (required), isbn, edition, subject_area, discipline,
        mrp (required, integer), format (Physical/Digital/Both),
        comp_stock (integer), author_names (semicolon-separated author names)

    author_names example: "Rajan S;Priya M"
    Authors must already exist. Unmatched names are warned but do not block the row.
    """
    contents = await file.read()
    try:
        _, rows = parse_csv_upload(contents)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if len(rows) > MAX_IMPORT_ROWS:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_IMPORT_ROWS} rows per import.")

    REQUIRED = {"title", "mrp"}
    VALID_FORMATS = {"Physical", "Digital", "Both"}
    errors = []
    to_insert = []

    for i, row in enumerate(rows, start=2):
        missing = REQUIRED - {k for k, v in row.items() if v and v.strip()}
        if missing:
            errors.append({"row": i, "error": f"Missing: {', '.join(missing)}"})
            continue

        try:
            mrp = int(row["mrp"].strip())
            if mrp < 0:
                raise ValueError()
        except ValueError:
            errors.append({"row": i, "error": f"mrp must be a non-negative integer, got '{row['mrp']}'"})
            continue

        fmt = row.get("format", "").strip() or "Physical"
        if fmt not in VALID_FORMATS:
            errors.append({"row": i, "error": f"format must be Physical/Digital/Both, got '{fmt}'"})
            continue

        comp_stock = 0
        raw_stock = row.get("comp_stock", "").strip()
        if raw_stock:
            try:
                comp_stock = int(raw_stock)
            except ValueError:
                errors.append({"row": i, "error": "comp_stock must be an integer"})
                continue

        isbn = row.get("isbn", "").strip() or None
        if isbn:
            existing = db.query(Book).filter(Book.isbn == isbn).first()
            if existing:
                errors.append({"row": i, "error": f"ISBN {isbn} already exists (book_id={existing.book_id}). Skipped."})
                continue

        to_insert.append({
            "book": Book(
                title        = row["title"].strip(),
                isbn         = isbn,
                edition      = row.get("edition", "").strip() or None,
                subject_area = row.get("subject_area", "").strip() or None,
                discipline   = row.get("discipline", "").strip() or None,
                mrp          = mrp,
                format       = fmt,
                comp_stock   = comp_stock,
                created_by   = current_user.user_id,
                updated_by   = current_user.user_id,
            ),
            "author_names": [
                n.strip()
                for n in row.get("author_names", "").split(";")
                if n.strip()
            ],
        })

    imported = 0
    for item in to_insert:
        book = item["book"]
        db.add(book)
        db.flush()

        for order, name in enumerate(item["author_names"], start=1):
            author = (
                db.query(Author)
                .filter(Author.author_name.ilike(name), Author.is_active == True)
                .first()
            )
            if author:
                db.add(BookAuthor(
                    book_id      = book.book_id,
                    author_id    = author.author_id,
                    author_order = order,
                ))
        imported += 1

    db.commit()

    return {"imported": imported, "skipped": len(errors), "errors": errors}


# ---------------------------------------------------------------------------
# Colleges
# ---------------------------------------------------------------------------

@router.post("/colleges")
async def import_colleges(
    current_user: RequireAdmin,
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
):
    """
    Expected CSV columns:
        college_name (required), college_type (required: Engineering/Arts&Science/Other),
        region_name (required — matched to existing active region, case-insensitive),
        affiliated_university, address_city, address_district,
        address_state, address_pin, phone, email

    Imported records are created as VERIFIED (admin import = trusted data).
    """
    contents = await file.read()
    try:
        _, rows = parse_csv_upload(contents)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if len(rows) > MAX_IMPORT_ROWS:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_IMPORT_ROWS} rows per import.")

    all_regions = db.query(Region).filter(Region.is_active == True).all()
    region_map = {r.region_name.lower(): r.region_id for r in all_regions}

    REQUIRED = {"college_name", "college_type", "region_name"}
    VALID_TYPES = {"Engineering", "Arts&Science", "Other"}
    errors = []
    to_insert = []

    for i, row in enumerate(rows, start=2):
        missing = REQUIRED - {k for k, v in row.items() if v and v.strip()}
        if missing:
            errors.append({"row": i, "error": f"Missing: {', '.join(missing)}"})
            continue

        college_type = row["college_type"].strip()
        if college_type not in VALID_TYPES:
            errors.append({"row": i, "error": "college_type must be Engineering/Arts&Science/Other"})
            continue

        region_id = region_map.get(row["region_name"].strip().lower())
        if not region_id:
            errors.append({"row": i, "error": f"Region '{row['region_name']}' not found. Create it first."})
            continue

        to_insert.append(College(
            college_name          = row["college_name"].strip(),
            college_type          = college_type,
            region_id             = region_id,
            affiliated_university = row.get("affiliated_university", "").strip() or None,
            address_city          = row.get("address_city", "").strip() or None,
            address_district      = row.get("address_district", "").strip() or None,
            address_state         = row.get("address_state", "").strip() or "Tamil Nadu",
            address_pin           = row.get("address_pin", "").strip() or None,
            phone                 = row.get("phone", "").strip() or None,
            email                 = row.get("email", "").strip() or None,
            data_quality_flag     = "VERIFIED",
            created_by            = current_user.user_id,
            updated_by            = current_user.user_id,
        ))

    if to_insert:
        db.add_all(to_insert)
        db.commit()

    return {"imported": len(to_insert), "skipped": len(errors), "errors": errors}


# ---------------------------------------------------------------------------
# Departments
# ---------------------------------------------------------------------------

@router.post("/departments")
async def import_departments(
    current_user: RequireAdmin,
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
):
    """
    Expected CSV columns:
        college_name (required — matched to existing active college, case-insensitive),
        dept_name (required)

    Skips rows where the department already exists in that college.
    """
    contents = await file.read()
    try:
        _, rows = parse_csv_upload(contents)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if len(rows) > MAX_IMPORT_ROWS:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_IMPORT_ROWS} rows per import.")

    all_colleges = db.query(College).filter(College.is_active == True).all()
    college_map = {c.college_name.lower(): c for c in all_colleges}

    all_depts = db.query(Department).filter(Department.is_active == True).all()
    existing_set = {(d.college_id, d.dept_name.lower()) for d in all_depts}

    REQUIRED = {"college_name", "dept_name"}
    errors = []
    to_insert = []

    for i, row in enumerate(rows, start=2):
        missing = REQUIRED - {k for k, v in row.items() if v and v.strip()}
        if missing:
            errors.append({"row": i, "error": f"Missing: {', '.join(missing)}"})
            continue

        college = college_map.get(row["college_name"].strip().lower())
        if not college:
            errors.append({"row": i, "error": f"College '{row['college_name']}' not found."})
            continue

        dept_name = row["dept_name"].strip()
        if (college.college_id, dept_name.lower()) in existing_set:
            errors.append({"row": i, "error": f"Dept '{dept_name}' already exists in '{college.college_name}'. Skipped."})
            continue

        to_insert.append(Department(
            dept_name  = dept_name,
            college_id = college.college_id,
            created_by = current_user.user_id,
            updated_by = current_user.user_id,
        ))
        existing_set.add((college.college_id, dept_name.lower()))

    if to_insert:
        db.add_all(to_insert)
        db.commit()

    return {"imported": len(to_insert), "skipped": len(errors), "errors": errors}


# ---------------------------------------------------------------------------
# Faculty
# ---------------------------------------------------------------------------

@router.post("/faculty")
async def import_faculty(
    current_user: RequireAdmin,
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
):
    """
    Expected CSV columns:
        faculty_name (required), college_name (required — matched to existing, case-insensitive),
        dept_name (required — matched within the college, case-insensitive),
        designation, phone_personal, phone_whatsapp, email, alt_address

    Imported as VERIFIED. college_name and dept_name must match existing active records.
    """
    contents = await file.read()
    try:
        _, rows = parse_csv_upload(contents)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if len(rows) > MAX_IMPORT_ROWS:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_IMPORT_ROWS} rows per import.")

    all_colleges = db.query(College).filter(College.is_active == True).all()
    college_map = {c.college_name.lower(): c for c in all_colleges}

    all_depts = db.query(Department).filter(Department.is_active == True).all()
    dept_map = {(d.college_id, d.dept_name.lower()): d.dept_id for d in all_depts}

    REQUIRED = {"faculty_name", "college_name", "dept_name"}
    VALID_DESIGNATIONS = {"Professor", "Asst. Professor", "HOD", "Principal", "Other"}
    errors = []
    to_insert = []

    for i, row in enumerate(rows, start=2):
        missing = REQUIRED - {k for k, v in row.items() if v and v.strip()}
        if missing:
            errors.append({"row": i, "error": f"Missing: {', '.join(missing)}"})
            continue

        college = college_map.get(row["college_name"].strip().lower())
        if not college:
            errors.append({"row": i, "error": f"College '{row['college_name']}' not found."})
            continue

        dept_id = dept_map.get((college.college_id, row["dept_name"].strip().lower()))
        if not dept_id:
            errors.append({"row": i, "error": f"Dept '{row['dept_name']}' not found in '{college.college_name}'."})
            continue

        designation = row.get("designation", "").strip() or None
        if designation and designation not in VALID_DESIGNATIONS:
            errors.append({"row": i, "error": f"designation must be one of: {', '.join(VALID_DESIGNATIONS)}"})
            continue

        to_insert.append(Faculty(
            faculty_name      = row["faculty_name"].strip(),
            college_id        = college.college_id,
            dept_id           = dept_id,
            designation       = designation,
            phone_personal    = row.get("phone_personal", "").strip() or None,
            phone_whatsapp    = row.get("phone_whatsapp", "").strip() or None,
            email             = row.get("email", "").strip() or None,
            alt_address       = row.get("alt_address", "").strip() or None,
            data_quality_flag = "VERIFIED",
            created_by        = current_user.user_id,
            updated_by        = current_user.user_id,
        ))

    if to_insert:
        db.add_all(to_insert)
        db.commit()

    return {"imported": len(to_insert), "skipped": len(errors), "errors": errors}
