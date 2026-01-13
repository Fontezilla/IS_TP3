import os
import uvicorn
from fastapi import FastAPI
from api.routes import router

def create_app() -> FastAPI:
    """Cria e configura a aplicação FastAPI."""
    app = FastAPI(
        title="REN CSV Crawler",
        version="1.0.0"
    )

    app.include_router(router, prefix="/api")

    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)