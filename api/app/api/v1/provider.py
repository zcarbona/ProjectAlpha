from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user, require_role, _client_ip
from app.models.models import User, UserRole, Provider, Truck, ProviderFleet, AuditEvent, VehicleType

router = APIRouter(tags=["provider"])

class TruckCreate(BaseModel):
    plate_number: str = Field(min_length=1, max_length=20)
    vehicle_class: str = Field(min_length=1, max_length=50)
    capacity: str = Field(min_length=1, max_length=50)
    is_active: bool = True
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    current_lat: float | None = Field(default=None, ge=-90, le=90)
    current_lng: float | None = Field(default=None, ge=-180, le=180)
    driver_user_id: int | None = None

class TruckUpdate(BaseModel):
    plate_number: str | None = Field(default=None, min_length=1, max_length=20)
    vehicle_class: str | None = Field(default=None, min_length=1, max_length=50)
    capacity: str | None = Field(default=None, min_length=1, max_length=50)
    is_active: bool | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    current_lat: float | None = Field(default=None, ge=-90, le=90)
    current_lng: float | None = Field(default=None, ge=-180, le=180)
    driver_user_id: int | None = None

class TruckOut(BaseModel):
    id: int
    plate_number: str | None
    vehicle_class: str
    capacity: str
    is_active: bool
    latitude: float | None = None
    longitude: float | None = None
    current_lat: float | None = None
    current_lng: float | None = None
    driver_user_id: int | None = None
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

@router.get("/provider/trucks", response_model=list[TruckOut])
async def list_trucks(request: Request, user: User = Depends(require_role(UserRole.PROVIDER)), db: AsyncSession = Depends(get_db)):
    provider = (await db.execute(select(Provider).where(Provider.user_id == user.id))).scalars().first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    trucks = (await db.execute(select(Truck).where(Truck.provider_id == provider.id).order_by(Truck.id))).scalars().all()
    db.add(AuditEvent(actor=str(user.id), action="list_trucks", record_type="Truck", record_id=None, ip_address=_client_ip(request), user_agent=request.headers.get("user-agent")))
    await db.commit()
    return trucks

@router.post("/provider/trucks", response_model=TruckOut, status_code=status.HTTP_201_CREATED)
async def create_truck(payload: TruckCreate, request: Request, user: User = Depends(require_role(UserRole.PROVIDER)), db: AsyncSession = Depends(get_db)):
    provider = (await db.execute(select(Provider).where(Provider.user_id == user.id))).scalars().first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    existing = (await db.execute(select(Truck).where(Truck.plate_number == payload.plate_number))).scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Truck with this plate number already exists")
    truck = Truck(provider_id=provider.id, plate_number=payload.plate_number, vehicle_class=payload.vehicle_class, capacity=payload.capacity, is_active=payload.is_active, latitude=payload.latitude, longitude=payload.longitude, current_lat=payload.current_lat, current_lng=payload.current_lng, driver_user_id=payload.driver_user_id)
    db.add(truck)
    db.add(AuditEvent(actor=str(user.id), action="create_truck", record_type="Truck", record_id=None, ip_address=_client_ip(request), user_agent=request.headers.get("user-agent")))
    await db.commit()
    await db.refresh(truck)
    return truck

@router.patch("/provider/trucks/{truck_id}", response_model=TruckOut)
async def update_truck(truck_id: int, payload: TruckUpdate, request: Request, user: User = Depends(require_role(UserRole.PROVIDER)), db: AsyncSession = Depends(get_db)):
    provider = (await db.execute(select(Provider).where(Provider.user_id == user.id))).scalars().first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    truck = (await db.execute(select(Truck).where(Truck.id == truck_id, Truck.provider_id == provider.id))).scalars().first()
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found")
    if payload.plate_number is not None:
        truck.plate_number = payload.plate_number
    if payload.vehicle_class is not None:
        truck.vehicle_class = payload.vehicle_class
    if payload.capacity is not None:
        truck.capacity = payload.capacity
    if payload.is_active is not None:
        truck.is_active = payload.is_active
    if payload.latitude is not None:
        truck.latitude = payload.latitude
    if payload.longitude is not None:
        truck.longitude = payload.longitude
    if payload.current_lat is not None:
        truck.current_lat = payload.current_lat
    if payload.current_lng is not None:
        truck.current_lng = payload.current_lng
    if payload.driver_user_id is not None:
        truck.driver_user_id = payload.driver_user_id
    db.add(AuditEvent(actor=str(user.id), action="update_truck", record_type="Truck", record_id=truck.id, ip_address=_client_ip(request), user_agent=request.headers.get("user-agent")))
    await db.commit()
    await db.refresh(truck)
    return truck

@router.delete("/provider/trucks/{truck_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_truck(truck_id: int, request: Request, user: User = Depends(require_role(UserRole.PROVIDER)), db: AsyncSession = Depends(get_db)):
    provider = (await db.execute(select(Provider).where(Provider.user_id == user.id))).scalars().first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    truck = (await db.execute(select(Truck).where(Truck.id == truck_id, Truck.provider_id == provider.id))).scalars().first()
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found")
    await db.delete(truck)
    db.add(AuditEvent(actor=str(user.id), action="delete_truck", record_type="Truck", record_id=truck_id, ip_address=_client_ip(request), user_agent=request.headers.get("user-agent")))
    await db.commit()
    return None

@router.get("/provider/fleet", response_model=list[FleetItemOut])
async def list_fleet(request: Request, user: User = Depends(require_role(UserRole.PROVIDER)), db: AsyncSession = Depends(get_db)):
    provider = (await db.execute(select(Provider).where(Provider.user_id == user.id))).scalars().first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    result = await db.execute(
        select(ProviderFleet, VehicleType)
        .join(VehicleType, ProviderFleet.vehicle_type_id == VehicleType.id)
        .where(ProviderFleet.provider_id == provider.id)
        .order_by(VehicleType.sort_order)
    )
    rows = result.all()
    output = []
    for fleet, vt in rows:
        output.append(FleetItemOut(
            id=fleet.id,
            vehicle_type_id=vt.id,
            code=vt.code,
            label=vt.label,
            emoji=vt.emoji,
            quantity=fleet.quantity,
            is_active=fleet.is_active,
        ))
    db.add(AuditEvent(actor=str(user.id), action="list_fleet", record_type="ProviderFleet", record_id=None, ip_address=_client_ip(request), user_agent=request.headers.get("user-agent")))
    await db.commit()
    return output

@router.patch("/provider/fleet/{vehicle_type_id}", response_model=FleetItemOut)
async def update_fleet(vehicle_type_id: int, payload: FleetUpdate, request: Request, user: User = Depends(require_role(UserRole.PROVIDER)), db: AsyncSession = Depends(get_db)):
    provider = (await db.execute(select(Provider).where(Provider.user_id == user.id))).scalars().first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    fleet = (await db.execute(select(ProviderFleet).where(ProviderFleet.provider_id == provider.id, ProviderFleet.vehicle_type_id == vehicle_type_id))).scalars().first()
    if not fleet:
        vt = (await db.execute(select(VehicleType).where(VehicleType.id == vehicle_type_id))).scalars().first()
        if not vt:
            raise HTTPException(status_code=404, detail="Vehicle type not found")
        fleet = ProviderFleet(provider_id=provider.id, vehicle_type_id=vehicle_type_id, quantity=payload.quantity, is_active=payload.is_active)
        db.add(fleet)
    else:
        fleet.quantity = payload.quantity
        fleet.is_active = payload.is_active
    db.add(AuditEvent(actor=str(user.id), action="update_fleet", record_type="ProviderFleet", record_id=fleet.id, ip_address=_client_ip(request), user_agent=request.headers.get("user-agent")))
    await db.commit()
    await db.refresh(fleet)
    vt = (await db.execute(select(VehicleType).where(VehicleType.id == fleet.vehicle_type_id))).scalars().first()
    return FleetItemOut(
        id=fleet.id,
        vehicle_type_id=vt.id,
        code=vt.code,
        label=vt.label,
        emoji=vt.emoji,
        quantity=fleet.quantity,
        is_active=fleet.is_active,
    )
