import csv
import os
from datetime import datetime

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import User

logger = structlog.get_logger()

EXPORT_DIR = os.environ.get("EXPORT_DIR", "/app/exports")
CSV_PATH = os.path.join(EXPORT_DIR, "users.csv")
XLSX_PATH = os.path.join(EXPORT_DIR, "users.xlsx")
LAST_UPDATED_PATH = os.path.join(EXPORT_DIR, ".last_updated")

CSV_FIELDS = [
    "id",
    "username",
    "email",
    "phone_number",
    "hashed_password",
    "role",
    "is_verified",
    "current_lat",
    "current_lng",
    "created_at",
    "updated_at",
]


def _role_repr(value):
    if value is None:
        return ""
    if hasattr(value, "value"):
        return str(value.value)
    return str(value)


def _build_rows():
    """Fetch all users and return list of dicts for export."""
    result = None  # set by caller
    return result


def _write_csv(rows) -> None:
    os.makedirs(EXPORT_DIR, exist_ok=True)
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(CSV_FIELDS)
        for r in rows:
            writer.writerow(
                [
                    r.id,
                    r.username,
                    r.email,
                    r.phone_number,
                    r.hashed_password,
                    _role_repr(r.role),
                    int(r.is_verified) if r.is_verified is not None else "",
                    r.current_lat if r.current_lat is not None else "",
                    r.current_lng if r.current_lng is not None else "",
                    r.created_at,
                    r.updated_at,
                ]
            )


def _write_xlsx(rows) -> None:
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment
    except ImportError:
        logger.warning("xlsx_export_skipped", reason="openpyxl not installed")
        return

    os.makedirs(EXPORT_DIR, exist_ok=True)
    wb = Workbook()
    ws = wb.active
    ws.title = "Users"

    # Header styling
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="E53935", end_color="E53935", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center")

    for col_idx, field in enumerate(CSV_FIELDS, start=1):
        cell = ws.cell(row=1, column=col_idx, value=field)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align

    # Data rows
    for row_idx, r in enumerate(rows, start=2):
        values = [
            r.id,
            r.username or "",
            r.email or "",
            r.phone_number or "",
            r.hashed_password or "",
            _role_repr(r.role),
            int(r.is_verified) if r.is_verified is not None else "",
            r.current_lat if r.current_lat is not None else "",
            r.current_lng if r.current_lng is not None else "",
            str(r.created_at) if r.created_at else "",
            str(r.updated_at) if r.updated_at else "",
        ]
        for col_idx, val in enumerate(values, start=1):
            ws.cell(row=row_idx, column=col_idx, value=val)

    # Auto-fit column widths
    for col in ws.columns:
        max_len = 0
        col_letter = col[0].column_letter
        for cell in col:
            if cell.value is not None:
                max_len = max(max_len, len(str(cell.value)))
        ws.column_dimensions[col_letter].width = min(max_len + 4, 40)

    # Freeze header row
    ws.freeze_panes = "A2"

    wb.save(XLSX_PATH)
    logger.info("user_xlsx_exported", count=len(rows), path=XLSX_PATH)


def _write_both(rows) -> None:
    _write_csv(rows)
    _write_xlsx(rows)
    with open(LAST_UPDATED_PATH, "w", encoding="utf-8") as fh:
        fh.write(datetime.utcnow().isoformat() + "\n")


async def export_users(db: AsyncSession) -> None:
    """Best-effort: dump all users to CSV and XLSX for easy inspection.

    Failures are logged and swallowed so they never break auth flows.
    """
    try:
        result = await db.execute(select(User))
        rows = result.scalars().all()
        _write_both(rows)
        logger.info("users_exported", count=len(rows), csv_path=CSV_PATH, xlsx_path=XLSX_PATH)
    except Exception as exc:  # noqa: BLE001
        logger.warning("users_export_failed", error=str(exc))


# Backwards-compatible alias
export_users_csv = export_users