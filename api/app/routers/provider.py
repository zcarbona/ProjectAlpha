from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user, require_role, _client_ip
from app.models.models import User, UserRole, Provider, Truck, ProviderFleet, AuditEvent, VehicleType, Job
from app.schemas.provider import TruckCreate, TruckUpdate, TruckOut, FleetItemOut, FleetUpdate
router = APIRouter()


@router.post("/provider/location")
async def update_location(lat: float, lon: float, user: User = Depends(require_role(UserRole.PROVIDER)), db: AsyncSession = Depends(get_db)):
    if not (-90 <= lat <= 90):
        raise HTTPException(status_code=400, detail="Latitude must be between -90 and 90")
    if not (-180 <= lon <= 180):
        raise HTTPException(status_code=400, detail="Longitude must be between -180 and 180")

    provider = (await db.execute(select(Provider).where(Provider.user_id == user.id))).scalars().first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    job = (await db.execute(select(Job).where(Job.provider_id == provider.id, Job.status == "in_progress"))).scalars().first()
    if job:
        from app.routers.events import manager
        await manager.broadcast(job.customer_id, {"type": "location_update", "job_id": job.id, "lat": lat, "lon": lon})

    return {"status": "ok"}


#provider see his trucks
@router.get("/provider/trucks", response_model=list[TruckOut])
async def list_trucks(request: Request, user: User = Depends(require_role(UserRole.PROVIDER)), db: AsyncSession = Depends(get_db)):
    provider = (await db.execute(select(Provider).where(Provider.user_id == user.id))).scalars().first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    trucks = (await db.execute(select(Truck).where(Truck.provider_id == provider.id).order_by(Truck.id))).scalars().all()
    db.add(AuditEvent(actor=str(user.id), action="list_trucks", record_type="Truck", record_id=None, ip_address=_client_ip(request), user_agent=request.headers.get("user-agent")))
    await db.commit()
    return trucks

#provider add trucks
@router.post("/provider/trucks", response_model=TruckOut, status_code=status.HTTP_201_CREATED)
async def create_truck(payload: TruckCreate, request: Request, user: User = Depends(require_role(UserRole.PROVIDER)), db: AsyncSession = Depends(get_db)):
    provider = (await db.execute(select(Provider).where(Provider.user_id == user.id))).scalars().first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    vt = (await db.execute(select(VehicleType).where(VehicleType.code == payload.vehicle_class.lower()))).scalars().first()
    if not vt:
        raise HTTPException(status_code=400, detail="Invalid vehicle class")

    existing = (await db.execute(select(Truck).where(Truck.plate_number == payload.plate_number))).scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Truck with this plate number already exists")

    truck = Truck(
        provider_id=provider.id,
        plate_number=payload.plate_number,
        vehicle_class=vt.code,
        capacity=str(vt.capacity_kg),
        is_active=payload.is_active
    )
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
    db.add(AuditEvent(actor=str(user.id), action="update_truck", record_type="Truck", record_id=truck.id, ip_address=_client_ip(request), user_agent=request.headers.get("user-agent")))
    await db.commit()
    await db.refresh(truck)
    return truck

#delete truck
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

#provider see his fleet
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


@router.get("/providers", response_model=list[dict])
async def list_providers(vehicle_class: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Provider)
        .join(Truck, Provider.id == Truck.provider_id)
        .where(Truck.vehicle_class == vehicle_class, Provider.is_active.is_(True), Truck.is_active.is_(True))
        .distinct()
    )
    providers = result.scalars().all()
    return [{"id": p.id, "display_name": p.display_name} for p in providers]
