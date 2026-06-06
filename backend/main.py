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
    from utils.security import hash_password
    from models import User

    async with AsyncSessionLocal() as db:
        # Always upsert demo account so credentials always work
        result = await db.execute(select(User).where(User.email == "demo@accountingsuite.com"))
        demo = result.scalar_one_or_none()
        if demo:
            demo.hashed_password = hash_password("demo1234")
            await db.commit()
            print("[STARTUP] Demo password refreshed", flush=True)
        else:
            demo = User(
                email="demo@accountingsuite.com",
                full_name="Demo User",
                hashed_password=hash_password("demo1234"),
                is_active=True,
                is_admin=True,
            )
            db.add(demo)
            await db.commit()
            await db.refresh(demo)
            print("[STARTUP] Demo user created", flush=True)

        # Seed sample data if demo account has none
        doc_count = (await db.execute(
            text("SELECT COUNT(*) FROM documents WHERE owner_id = :uid").bindparams(uid=demo.id)
        )).scalar()
        if doc_count == 0:
            print("[STARTUP] No documents for demo user — seeding sample data", flush=True)
            from seed import seed
            await seed()
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
    import bcrypt as _bcrypt
    try:
        _h = _bcrypt.hashpw(b"test", _bcrypt.gensalt())
        _ok = _bcrypt.checkpw(b"test", _h)
    except Exception as e:
        _ok = f"ERROR: {e}"
    return {"status": "ok", "version": "1.0.0", "bcrypt_ok": _ok}


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
