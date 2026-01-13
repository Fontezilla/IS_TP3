import csv
import io
from datetime import datetime
from typing import Dict

FONTES_PERMITIDAS = {
    "Eólica",
    "Solar",
    "Consumo",
    "Consumo + Armazenamento"
}


def write_csv_for_slot(slot: datetime, data: Dict[str, int]) -> bytes:
    """Gera CSV com dados de energia de um slot específico."""
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["hora", "tipo_energia", "MW"])

    hora = slot.strftime("%H:%M")

    for tipo_energia, valor in data.items():
        if tipo_energia in FONTES_PERMITIDAS:
            writer.writerow([
                hora,
                tipo_energia,
                valor
            ])

    return output.getvalue().encode("utf-8")
