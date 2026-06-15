from datetime import date
from typing import Any, Dict, List, Optional

from .auth import CamelModel


# ---------------------------------------------------------------------------
# 1. Comp Summary — totals by period / region / rep
# ---------------------------------------------------------------------------
class CompSummaryRow(CamelModel):
    period:         str            # "2026-01"
    region_name:    str
    rep_name:       str
    total_requests: int
    total_copies:   int


# ---------------------------------------------------------------------------
# 2. Subject Coverage — which subjects have been comped
# ---------------------------------------------------------------------------
class SubjectCoverageRow(CamelModel):
    subject_name:   str
    comp_count:     int            # number of line items
    college_count:  int            # distinct colleges
    copy_count:     int            # total copies


# ---------------------------------------------------------------------------
# 3. College Coverage — which colleges have received comps
# ---------------------------------------------------------------------------
class CollegeCoverageRow(CamelModel):
    college_id:      int
    college_name:    str
    college_type:    str
    region_name:     str
    total_requests:  int
    total_copies:    int
    last_comp_date:  Optional[str]


# ---------------------------------------------------------------------------
# 4. Book-wise Comping — copies per title
# ---------------------------------------------------------------------------
class BookCompingRow(CamelModel):
    book_id:         int
    title:           str
    authors:         str
    subject_area:    Optional[str]
    total_requests:  int
    total_copies:    int
    comp_stock:      int           # current catalog stock


# ---------------------------------------------------------------------------
# 5. Adoption Rate — by rep
# ---------------------------------------------------------------------------
class AdoptionRateRow(CamelModel):
    rep_name:        str
    total_delivered: int
    adopted:         int
    not_adopted:     int
    pending:         int
    adoption_pct:    float         # adopted / (adopted + not_adopted) * 100


# ---------------------------------------------------------------------------
# 6. Pending Follow-ups — requests needing adoption update
# ---------------------------------------------------------------------------
class PendingFollowUpRow(CamelModel):
    request_id:   int
    request_ref:  str
    faculty_name: str
    college_name: str
    rep_name:     str
    delivered_at: Optional[str]
    days_elapsed: int
    status:       str


# ---------------------------------------------------------------------------
# 7. Fulfilment TAT — time from approval through delivery
# ---------------------------------------------------------------------------
class FulfilmentTATRow(CamelModel):
    request_id:                int
    request_ref:               str
    faculty_name:              str
    approved_at:               Optional[str]
    dispatched_at:             Optional[str]
    delivered_at:              Optional[str]
    approval_to_dispatch_days: Optional[int]
    dispatch_to_delivery_days: Optional[int]
    total_fulfil_days:         Optional[int]


class FulfilmentTATSummary(CamelModel):
    avg_approval_to_dispatch: Optional[float]
    avg_dispatch_to_delivery: Optional[float]
    avg_total_days:           Optional[float]
    min_total_days:           Optional[int]
    max_total_days:           Optional[int]


# ---------------------------------------------------------------------------
# 8. Print Run Impact — comp copies vs catalog stock
# ---------------------------------------------------------------------------
class PrintRunImpactRow(CamelModel):
    book_id:         int
    title:           str
    authors:         str
    subject_area:    Optional[str]
    comp_stock:      int
    total_comped:    int
    remaining_stock: int
    utilization_pct: float
