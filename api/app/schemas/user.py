from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict, Field, model_validator
from app.models.models import UserRole

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[int] = None

class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(default=None, min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    phone_number: Optional[str] = Field(default=None, pattern=r"^\+?[1-9]\d{1,14}$")
    role: UserRole

class UserCreate(UserBase):
    password: str = Field(min_length=12, max_length=128)

    @model_validator(mode="after")
    def has_login_identifier(self):
        if not any((self.email, self.username, self.phone_number)):
            raise ValueError("email, username, or phone number is required")
        return self

    @model_validator(mode="after")
    def normalize_role(self):
        if isinstance(self.role, str):
            self.role = UserRole(self.role)
        return self

class UserUpdate(UserBase):
    password: Optional[str] = Field(default=None, min_length=12, max_length=128)

class UserOut(UserBase):
    id: int
    is_verified: bool

    model_config = ConfigDict(from_attributes=True)
