from fastapi import Query


class Pagination:
    """
    FastAPI dependency for offset-based pagination.
    Use with Depends(Pagination) in route signatures.

    GET /colleges?page=2&pageSize=20
    """

    def __init__(
        self,
        page:      int = Query(1,  ge=1,        description="Page number (1-based)"),
        page_size: int = Query(20, ge=1, le=100, description="Items per page (max 100)"),
    ):
        self.page      = page
        self.page_size = page_size
        self.offset    = (page - 1) * page_size
