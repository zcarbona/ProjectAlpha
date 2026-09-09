from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, model_validator

class Place(BaseModel):
    place_id: str | None = Field(default=None, max_length=128)
    address: str = Field(min_length=1, max_length=1000)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)

class JobCreate(BaseModel):
    vehicle_class: str = Field(min_length=1, max_length=50)
    pickup: Place
    dropoff: Place
    idempotency_key: str = Field(min_length=16, max_length=128)
    provider_id: int

    @model_validator(mode="after")
    def validate_locations(self):
        if self.pickup.address == self.dropoff.address:
            raise ValueError("pickup and drop-off must differ")
        return self

class PriceDecision(BaseModel):
    decision: Literal["approved", "rejected"]
    approved_amount: float | None = Field(default=None, gt=0)
    note: str | None = Field(default=None, max_length=1000)
    idempotency_key: str = Field(min_length=16, max_length=128)

    @model_validator(mode="after")
    def amount_for_approval(self):
        if self.decision == "approved" and self.approved_amount is None:
            raise ValueError("approved amount is required")
        return self

class JobOut(BaseModel):
    id: int
    truck_id: int
    vehicle_class: str
    truck_plate: str | None
    provider_id: int
    provider_name: str
    status: str
    payment_status: str
    approved_price: float | None
    lock_expires_at: datetime | None = None
    pickup_address: str | None = None
    dropoff_address: str | None = None

class JobAccept(BaseModel):
    truck_id: int = Field(gt=0)

class ProviderStatusUpdate(BaseModel):
    is_available: bool


