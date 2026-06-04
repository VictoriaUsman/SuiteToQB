from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
from database import init_db
from config import get_settings
from routers import auth, documents, transactions, quickbooks, reports, search

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    os.makedirs(settings.upload_dir, exist_ok=True)
    yield


app = FastAPI(
    title="AccountingSuite API",
    description="AI-powered financial document extraction and QuickBooks integration",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
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
