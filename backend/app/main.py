from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.routes import portfolio, community, investor, investment, ai, auth, reports, lifecycle, operator
from app.routes.calculations import router as calculations_router
from app.routes.documents import router as documents_router
from app.routes.notifications import router as notifications_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Import here to avoid circular imports at module level
    from app.db.session import engine
    from app.db.base import Base
    import app.db.models  # noqa: F401 – registers all models
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Living Well Communities Platform",
    version="0.2.0",
    description=(
        "Enterprise-scale platform for GP/LP development, "
        "community operations, and investor relations."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["portfolio"])
app.include_router(community.router, prefix="/api/community", tags=["community"])
app.include_router(investor.router, prefix="/api/investor", tags=["investor"])
app.include_router(investment.router, prefix="/api/investment", tags=["investment"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(calculations_router, prefix="/api/calculations", tags=["Calculations"])
app.include_router(lifecycle.router, prefix="/api/lifecycle", tags=["lifecycle"])
app.include_router(operator.router, prefix="/api/operator", tags=["operator"])
app.include_router(documents_router, prefix="/api/documents", tags=["documents"])
app.include_router(notifications_router, prefix="/api/notifications", tags=["notifications"])

# Serve uploaded files statically
_uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
_uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")


@app.get("/healthz", tags=["ops"])
def health_check():
    return {"status": "ok"}
