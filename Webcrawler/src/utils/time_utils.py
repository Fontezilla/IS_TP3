from datetime import datetime, timedelta
from typing import List, Optional

INTERVAL_MINUTES = 15


def floor_to_interval(dt: datetime) -> datetime:
    """Arredonda datetime para o intervalo de 15 minutos anterior."""
    minute = (dt.minute // INTERVAL_MINUTES) * INTERVAL_MINUTES
    return dt.replace(minute=minute, second=0, microsecond=0)

def generate_time_slots(
    last_slot: Optional[datetime],
    now: datetime
) -> List[datetime]:
    """Gera lista de slots de 15 minutos entre o último slot e agora."""
    current_slot = floor_to_interval(now)

    if last_slot is None:
        return [current_slot]

    slots: List[datetime] = []
    next_slot = last_slot + timedelta(minutes=INTERVAL_MINUTES)

    while next_slot <= current_slot:
        slots.append(next_slot)
        next_slot += timedelta(minutes=INTERVAL_MINUTES)

    return slots