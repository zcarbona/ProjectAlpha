from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict, Field, model_validator
from app.models.models import UserRole


class TruckCreate(BaseModel):
    plate_number: str = Field(min_length=1, max_length=20)
    vehicle_class: str = Field(min_length=1, max_length=50)
    is_active: bool = True


class TruckUpdate(BaseModel):
    plate_number: str | None = Field(default=None, min_length=1, max_length=20)
    vehicle_class: str | None = Field(default=None, min_length=1, max_length=50)
    capacity: str | None = Field(default=None, min_length=1, max_length=50)
    is_active: bool | None = None


class TruckOut(BaseModel):
    id: int
    plate_number: str | None
    vehicle_class: str
    capacity: str
    is_active: bool
    is_available: bool
    model_config = ConfigDict(from_attributes=True)


class FleetItemOut(BaseModel):
    id: int
    vehicle_type_id: int
    code: str
    label: str
    emoji: str
    quantity: int
    is_active: bool
    model_config = ConfigDict(from_attributes=True)


class FleetUpdate(BaseModel):
    quantity: int = Field(ge=0)
    is_active: bool = True
