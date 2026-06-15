import csv
import io
from typing import Any

from fastapi.responses import StreamingResponse


def make_csv_response(rows: list[list[Any]], headers: list[str], filename: str) -> StreamingResponse:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(headers)
    writer.writerows(rows)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def parse_csv_upload(contents: bytes) -> tuple[list[str], list[dict]]:
    """
    Parse uploaded CSV bytes.
    Returns (headers, rows) where rows is a list of dicts keyed by header name.
    Raises ValueError with a user-readable message on format problems.
    """
    try:
        text = contents.decode("utf-8-sig")  # strips BOM from Excel exports
    except UnicodeDecodeError:
        raise ValueError("File must be UTF-8 encoded. Save your Excel file as CSV UTF-8.")

    reader = csv.DictReader(io.StringIO(text))
    headers = list(reader.fieldnames or [])
    rows = list(reader)

    if not rows:
        raise ValueError("CSV file is empty or contains only headers.")

    return headers, rows
