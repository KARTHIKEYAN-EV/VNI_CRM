from sqlalchemy import (
    Column, Date, ForeignKey, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy import DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from .base import AuditMixin, Base


# =============================================================================
# M_REGION
# =============================================================================

class Region(AuditMixin, Base):
    __tablename__ = "m_region"

    region_id         = Column(Integer, primary_key=True)
    region_name       = Column(String(100), nullable=False)
    districts_covered = Column(Text)

    # Relationships
    colleges = relationship("College", back_populates="region")
    users    = relationship("User",    back_populates="region")


# =============================================================================
# M_USER
# =============================================================================

class User(AuditMixin, Base):
    __tablename__ = "m_user"

    user_id       = Column(Integer,     primary_key=True)
    full_name     = Column(String(150), nullable=False)
    email         = Column(String(150), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    role          = Column(String(20),  nullable=False)
    region_id     = Column(Integer,     ForeignKey("m_region.region_id"), nullable=True)
    reports_to    = Column(Integer,     ForeignKey("m_user.user_id"),     nullable=True)
    phone         = Column(String(20))

    # Relationships
    region        = relationship("Region", back_populates="users")
    manager       = relationship("User",   remote_side="User.user_id",
                                 foreign_keys=[reports_to], uselist=False)
    # Comp requests where this user is the rep
    comp_requests_as_rep = relationship(
        "CompRequest", back_populates="rep",
        foreign_keys="CompRequest.rep_id",
    )
    # Comp requests this user (CEO) has approved
    comp_requests_approved = relationship(
        "CompRequest", back_populates="approver",
        foreign_keys="CompRequest.approved_by",
    )


# =============================================================================
# M_COLLEGE
# =============================================================================

class College(AuditMixin, Base):
    __tablename__ = "m_college"

    college_id            = Column(Integer,     primary_key=True)
    college_name          = Column(String(200), nullable=False)
    college_type          = Column(String(30),  nullable=False)
    region_id             = Column(Integer,     ForeignKey("m_region.region_id"), nullable=False)
    affiliated_university = Column(String(200))
    address_street        = Column(Text)
    address_city          = Column(String(100))
    address_district      = Column(String(100))
    address_state         = Column(String(100), nullable=False, default="Tamil Nadu")
    address_pin           = Column(String(10))
    phone                 = Column(String(20))
    email                 = Column(String(150))
    data_quality_flag     = Column(String(20),  nullable=False, default="VERIFIED")

    # Relationships
    region      = relationship("Region",     back_populates="colleges")
    departments = relationship("Department", back_populates="college")
    faculty     = relationship("Faculty",    back_populates="college")
    courses     = relationship("Course",     back_populates="college")


# =============================================================================
# M_DEPARTMENT
# =============================================================================

class Department(AuditMixin, Base):
    __tablename__ = "m_department"

    dept_id    = Column(Integer,     primary_key=True)
    college_id = Column(Integer,     ForeignKey("m_college.college_id"), nullable=False)
    dept_name  = Column(String(150), nullable=False)

    # Relationships
    college  = relationship("College",  back_populates="departments")
    faculty  = relationship("Faculty",  back_populates="department")
    courses  = relationship("Course",   back_populates="department")


# =============================================================================
# M_FACULTY
# =============================================================================

class Faculty(AuditMixin, Base):
    __tablename__ = "m_faculty"

    faculty_id        = Column(Integer,     primary_key=True)
    faculty_name      = Column(String(150), nullable=False)
    college_id        = Column(Integer,     ForeignKey("m_college.college_id"), nullable=False)
    dept_id           = Column(Integer,     ForeignKey("m_department.dept_id"), nullable=False)
    designation       = Column(String(50))
    phone_personal    = Column(String(20))
    phone_work        = Column(String(20))
    phone_whatsapp    = Column(String(20))
    email             = Column(String(150))
    alt_address       = Column(Text)
    data_quality_flag = Column(String(20), nullable=False, default="VERIFIED")

    # Relationships
    college         = relationship("College",    back_populates="faculty")
    department      = relationship("Department", back_populates="faculty")
    comp_requests   = relationship("CompRequest",    back_populates="faculty")
    subjects_taught = relationship("FacultySubject", back_populates="faculty")
    form_tokens         = relationship("FacultyFormToken",  back_populates="faculty")
    new_request_tokens  = relationship("NewRequestToken",   back_populates="faculty")


# =============================================================================
# M_AUTHOR
# =============================================================================

class Author(AuditMixin, Base):
    __tablename__ = "m_author"

    author_id   = Column(Integer,     primary_key=True)
    author_name = Column(String(150), nullable=False)
    email       = Column(String(150))
    phone       = Column(String(20))
    bio         = Column(Text)

    # Relationships
    book_authors = relationship("BookAuthor", back_populates="author")


# =============================================================================
# M_BOOK
# =============================================================================

class Book(AuditMixin, Base):
    __tablename__ = "m_book"

    book_id      = Column(Integer,     primary_key=True)
    isbn         = Column(String(20),  unique=True)
    title        = Column(String(300), nullable=False)
    edition      = Column(String(20))
    subject_area = Column(String(100))
    discipline   = Column(String(100))
    mrp          = Column(Integer,     nullable=False)
    format       = Column(String(20),  nullable=False, default="Physical")
    comp_stock   = Column(Integer,     nullable=False, default=0)

    # Relationships
    book_authors    = relationship("BookAuthor",       back_populates="book")
    comp_line_items = relationship("CompRequestBook",  back_populates="book")
    syllabus_books  = relationship("SyllabusBook",     back_populates="book")


# =============================================================================
# M_BOOK_AUTHOR — junction
# =============================================================================

class BookAuthor(Base):
    __tablename__ = "m_book_author"

    id           = Column(Integer, primary_key=True)
    book_id      = Column(Integer, ForeignKey("m_book.book_id"),     nullable=False)
    author_id    = Column(Integer, ForeignKey("m_author.author_id"), nullable=False)
    author_order = Column(Integer, nullable=False, default=1)

    __table_args__ = (UniqueConstraint("book_id", "author_id"),)

    # Relationships
    book   = relationship("Book",   back_populates="book_authors")
    author = relationship("Author", back_populates="book_authors")


# =============================================================================
# M_COURSE
# =============================================================================

class Course(AuditMixin, Base):
    __tablename__ = "m_course"

    course_id             = Column(Integer,     primary_key=True)
    dept_id               = Column(Integer,     ForeignKey("m_department.dept_id"),  nullable=False)
    college_id            = Column(Integer,     ForeignKey("m_college.college_id"),  nullable=False)
    course_name           = Column(String(100), nullable=False)
    course_type           = Column(String(20),  nullable=False)
    duration_years        = Column(Integer,     nullable=False)
    affiliated_university = Column(String(200))  # overrides college default if set

    # Relationships
    department = relationship("Department", back_populates="courses")
    college    = relationship("College",    back_populates="courses")
    subjects   = relationship("Subject",    back_populates="course")


# =============================================================================
# M_SUBJECT
# =============================================================================

class Subject(AuditMixin, Base):
    __tablename__ = "m_subject"

    subject_id    = Column(Integer,     primary_key=True)
    course_id     = Column(Integer,     ForeignKey("m_course.course_id"), nullable=False)
    subject_name  = Column(String(200), nullable=False)
    subject_code  = Column(String(30))
    semester_year = Column(String(20))
    subject_type  = Column(String(20),  nullable=False, default="Core")

    # Relationships
    course           = relationship("Course",    back_populates="subjects")
    syllabi          = relationship("Syllabus",  back_populates="subject")
    faculty_subjects = relationship("FacultySubject", back_populates="subject")
    comp_line_items  = relationship("CompRequestBook", back_populates="subject")


# =============================================================================
# M_SYLLABUS
# =============================================================================

class Syllabus(AuditMixin, Base):
    __tablename__ = "m_syllabus"

    syllabus_id        = Column(Integer,     primary_key=True)
    subject_id         = Column(Integer,     ForeignKey("m_subject.subject_id"), nullable=False)
    university         = Column(String(200), nullable=False)
    regulation_year    = Column(String(20),  nullable=False)
    unit_breakdown     = Column(JSONB)        # {unit1: [...], unit2: [...], ...}
    last_verified_date = Column(Date)
    source_notes       = Column(Text)

    __table_args__ = (UniqueConstraint("subject_id", "university", "regulation_year"),)

    # Relationships
    subject        = relationship("Subject",      back_populates="syllabi")
    syllabus_books = relationship("SyllabusBook", back_populates="syllabus")


# =============================================================================
# M_SYLLABUS_BOOK — junction
# =============================================================================

class SyllabusBook(Base):
    __tablename__ = "m_syllabus_book"

    id          = Column(Integer, primary_key=True)
    syllabus_id = Column(Integer, ForeignKey("m_syllabus.syllabus_id"), nullable=False)
    book_id     = Column(Integer, ForeignKey("m_book.book_id"),         nullable=False)
    book_role   = Column(String(20), nullable=False, default="Prescribed")

    __table_args__ = (UniqueConstraint("syllabus_id", "book_id"),)

    # Relationships
    syllabus = relationship("Syllabus", back_populates="syllabus_books")
    book     = relationship("Book",     back_populates="syllabus_books")


# =============================================================================
# M_FACULTY_SUBJECT — junction
# =============================================================================

class FacultySubject(Base):
    __tablename__ = "m_faculty_subject"

    id            = Column(Integer, primary_key=True)
    faculty_id    = Column(Integer, ForeignKey("m_faculty.faculty_id"),  nullable=False)
    subject_id    = Column(Integer, ForeignKey("m_subject.subject_id"),  nullable=False)
    academic_year = Column(String(10))  # e.g. "2025-26"

    __table_args__ = (UniqueConstraint("faculty_id", "subject_id", "academic_year"),)

    # Relationships
    faculty = relationship("Faculty", back_populates="subjects_taught")
    subject = relationship("Subject", back_populates="faculty_subjects")
