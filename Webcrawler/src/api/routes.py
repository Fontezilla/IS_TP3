from fastapi import APIRouter, Response, status
from domain.tracker import run as run_tracker

router = APIRouter()


@router.get("/")
def health():
    """Endpoint de health check."""
    return {"status": "UP"}


@router.post("/run")
def run():
    """Executa o crawler e processa novos slots."""
    try:
        result = run_tracker()
        return result

    except ValueError as e:
        return Response(
            content=str(e),
            status_code=status.HTTP_400_BAD_REQUEST
        )

    except Exception as e:
        return Response(
            content=str(e),
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
