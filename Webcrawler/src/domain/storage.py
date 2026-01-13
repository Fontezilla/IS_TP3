import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "raw-csv")


if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("Credenciais do Supabase em falta")

_supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def upload_csv(filename: str, csv_bytes: bytes) -> None:
    """Faz upload de CSV para Supabase Storage, ignora se já existir."""
    try:
        response = _supabase.storage.from_(SUPABASE_BUCKET).upload(
            path=filename,
            file=csv_bytes,
            file_options={"content-type": "text/csv"}
        )

        if hasattr(response, "error") and response.error:
            error_msg = str(response.error)
            if "Duplicate" in error_msg or "already exists" in error_msg:
                return
            else:
                raise RuntimeError(f"Erro ao fazer upload do ficheiro {filename}: {response.error}")

    except Exception as e:
        error_msg = str(e)
        if "Duplicate" in error_msg or "already exists" in error_msg or "400" in error_msg:
            return
        else:
            raise