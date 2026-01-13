from datetime import datetime
from typing import Dict, List

from infra.tracker import get_last_slot, save_slot

from domain.crawler import run_crawler_get_all
from domain.csv_writer import write_csv_for_slot
from domain.storage import upload_csv


def run(now: datetime | None = None) -> Dict:
    """Executa o crawler e processa apenas os slots ainda não salvos."""
    if now is None:
        now = datetime.utcnow()

    last_slot = get_last_slot(now)

    all_slots = run_crawler_get_all()

    executed_slots: List[str] = []

    for real_slot, data in all_slots:
        if last_slot and real_slot <= last_slot:
            continue

        csv_bytes = write_csv_for_slot(real_slot, data)
        filename = f"{real_slot.strftime('%Y-%m-%d_%H%M')}.csv"

        upload_csv(filename, csv_bytes)
        save_slot(real_slot)

        executed_slots.append(real_slot.isoformat())

    return {
        "now": now.isoformat(),
        "last_slot": last_slot.isoformat() if last_slot else None,
        "executed_count": len(executed_slots),
        "executed_slots": executed_slots,
    }