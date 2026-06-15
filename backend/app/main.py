from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import (
    auth, regions, users, colleges, departments,
    faculty, authors, books, courses, subjects, syllabi,
    comp_requests, tokens, new_request_tokens, admin, reports,
    imports, exports,
)

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"
app.include_router(auth.router,          prefix=PREFIX)
app.include_router(regions.router,       prefix=PREFIX)
app.include_router(users.router,         prefix=PREFIX)
app.include_router(colleges.router,      prefix=PREFIX)
app.include_router(departments.router,   prefix=PREFIX)
app.include_router(faculty.router,       prefix=PREFIX)
app.include_router(authors.router,       prefix=PREFIX)
app.include_router(books.router,         prefix=PREFIX)
app.include_router(courses.router,       prefix=PREFIX)
app.include_router(subjects.router,      prefix=PREFIX)
app.include_router(syllabi.router,       prefix=PREFIX)
app.include_router(comp_requests.router, prefix=PREFIX)
app.include_router(tokens.router,        prefix=PREFIX)
app.include_router(tokens.public_router,             prefix=PREFIX)
app.include_router(new_request_tokens.router,        prefix=PREFIX)
app.include_router(new_request_tokens.public_router, prefix=PREFIX)
app.include_router(admin.router,         prefix=PREFIX)
app.include_router(reports.router,       prefix=PREFIX)
app.include_router(imports.router,       prefix=PREFIX)
app.include_router(exports.router,       prefix=PREFIX)

@app.get("/api/health", tags=["Health"])
def health_check():
    return {"status": "ok", "version": settings.app_version}
