from pydantic import BaseModel, EmailStr
from app.db.models import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None
    role: UserRole = UserRole.INVESTOR


class UserOut(BaseModel):
    user_id: int
    email: EmailStr
    full_name: str | None
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefreshRequest(BaseModel):
    refresh_token: str
