import os
from datetime import datetime, date, time, timedelta
from typing import Optional

from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Credenciais do Supabase em falta")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

SCHEMA = "webcrawler"
TABLE = "crawler_tracker"


def _delete_all_rows() -> None:
    """Remove todas as linhas da tabela tracker."""
    (
        supabase
        .schema(SCHEMA)
        .table(TABLE)
        .delete()
        .not_.is_("data", "null")
        .execute()
    )


def get_last_slot(now: datetime) -> Optional[datetime]:
    """Obtém o último slot processado, com reset automático à mudança de dia."""
    response = (
        supabase
        .schema(SCHEMA)
        .table(TABLE)
        .select("*")
        .order("updated_at", desc=True)
        .limit(1)
        .execute()
    )

    if not response.data:
        return None

    row = response.data[0]
    stored_date = date.fromisoformat(row["data"])
    slot_time = time.fromisoformat(row["ultimo_slot"])

    last_slot = datetime.combine(stored_date, slot_time)

    if stored_date < now.date():
        _delete_all_rows()
        return None

    return last_slot


def save_slot(slot: datetime) -> None:
    """Guarda o slot processado no tracker."""
    payload = {
        "data": slot.date().isoformat(),
        "ultimo_slot": slot.strftime("%H:%M:%S"),
        "updated_at": datetime.utcnow().isoformat()
    }

    _delete_all_rows()

    (
        supabase
        .schema(SCHEMA)
        .table(TABLE)
        .insert(payload)
        .execute()
    )
