from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from contextlib import asynccontextmanager
from pathlib import Path
import os
from database import init_db
from config import get_settings
from routers import auth, documents, transactions, quickbooks, reports, search

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    os.makedirs(settings.upload_dir, exist_ok=True)
    from sqlalchemy import select, text
    from database import AsyncSessionLocal
    from utils.security import hash_password, verify_password
    async with AsyncSessionLocal() as db:
        result = await db.execute(text("SELECT COUNT(*) FROM users"))
        if result.scalar() == 0:
            from seed import seed
            await seed()
    # Ensure demo password is always valid (guards against bcrypt version issues)
    from models import User
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == "demo@accountingsuite.com"))
        demo = result.scalar_one_or_none()
        if demo and not verify_password("demo1234", demo.hashed_password):
            demo.hashed_password = hash_password("demo1234")
            await db.commit()
    yield


app = FastAPI(
    title="AccountingSuite API",
    description="AI-powered financial document extraction and QuickBooks integration",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(transactions.router)
app.include_router(quickbooks.router)
app.include_router(reports.router)
app.include_router(search.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


# SPA fallback — serve index.html for any non-API route
_frontend_dist = Path(__file__).parent / "frontend_dist"
_index_html = _frontend_dist / "index.html"

if _frontend_dist.exists():
    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=str(_frontend_dist / "assets")), name="assets")

    @app.exception_handler(404)
    async def spa_fallback(request: Request, exc):
        if request.url.path.startswith("/api"):
            return JSONResponse({"detail": str(exc.detail)}, status_code=404)
        return FileResponse(str(_index_html))


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", settings.app_port))
    uvicorn.run("main:app", host=settings.app_host, port=port, reload=False)
