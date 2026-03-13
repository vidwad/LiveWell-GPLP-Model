from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.routes import portfolio, community, investor, investment, ai, auth, reports


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


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")


@app.get("/healthz", tags=["ops"])
def health_check():
    return {"status": "ok"}
