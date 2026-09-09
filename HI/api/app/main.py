from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import seed_company_data, init_db
from app.api.v1.auth import router as auth_router
from app.api.v1.jobs import router as jobs_router
from app.api.v1.company import router as company_router
from app.api.v1.provider import router as provider_router
from app.api.v1.events import router as events_router
from contextlib import asynccontextmanager
import structlog

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ]
)
logger = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing application - running database initialization")
    await init_db()
    await seed_company_data()
    yield
    logger.info("Shutting down application")

app = FastAPI(
    title="Naql API",
    description="Backend API for the Naql logistics marketplace.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8080", "http://frontend:80"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")
app.include_router(company_router, prefix="/api")
app.include_router(provider_router, prefix="/api")
app.include_router(events_router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "Welcome to Naql API", "status": "running"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}
