from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.security import get_current_user, require_role, _client_ip
from app.models.models import User, UserRole, Provider, Truck, Job, TruckLock, JobStatus, PriceApproval, Payment, AuditEvent
from app.schemas.jobs import JobCreate, JobOut, PriceDecision

router = APIRouter(tags=["jobs"])
LOCK_MINUTES = 15

def to_output(job: Job) -> JobOut:
    return JobOut(
        id=job.id,
        truck_id=job.truck_id,
        vehicle_class=job.truck.vehicle_class if job.truck else "",
        truck_plate=job.truck.plate_number if job.truck else None,
        provider_id=job.provider_id,
        provider_name=job.provider.display_name if job.provider else "",
        status=job.status.value,
        payment_status=job.payment_status,
        requested_min_price=job.requested_min_price,
        requested_max_price=job.requested_max_price,
        approved_price=job.approved_price,
        lock_expires_at=job.truck_lock.expires_at if job.truck_lock and job.truck_lock.is_active else None,
        pickup_address=job.pickup_address,
        dropoff_address=job.dropoff_address,
    )

@router.get("/trucks")
async def trucks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Truck).where(Truck.is_active.is_(True)))
    return [{"id": truck.id, "vehicle_class": truck.vehicle_class, "capacity": truck.capacity} for truck in result.scalars()]

@router.post("/jobs", response_model=JobOut, status_code=status.HTTP_201_CREATED)
async def create_job(payload: JobCreate, request: Request, user: User = Depends(require_role(UserRole.CUSTOMER)), db: AsyncSession = Depends(get_db)):
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Verified email or phone is required before requesting a truck")
    existing = (await db.execute(select(Job).options(selectinload(Job.truck_lock)).where(Job.customer_id == user.id, Job.idempotency_key == payload.idempotency_key))).scalars().first()
    if existing:
        return to_output(existing)
    now = datetime.utcnow()
    # Query for available trucks excluding those with active, unexpired locks
    locked_truck_ids = select(TruckLock.truck_id).where(TruckLock.is_active.is_(True), TruckLock.expires_at > now)
    truck = (await db.execute(
        select(Truck)
        .where(
            Truck.vehicle_class == payload.vehicle_class,
            Truck.is_active.is_(True),
            Truck.id.not_in(locked_truck_ids)
        )
        .limit(1)
    )).scalars().first()

    if not truck:
        raise HTTPException(status_code=404, detail="No trucks available")

    truck = (await db.execute(select(Truck).where(Truck.id == truck.id, Truck.is_active.is_(True)).with_for_update())).scalars().first()
    if not truck:
        raise HTTPException(status_code=404, detail="No available truck for the selected vehicle class")
    active = (await db.execute(select(TruckLock).where(TruckLock.truck_id == truck.id, TruckLock.is_active.is_(True), TruckLock.expires_at > now))).scalars().first()
    if active:
        raise HTTPException(status_code=409, detail="Truck is temporarily reserved")
    provider = (await db.execute(select(Provider).where(Provider.id == truck.provider_id, Provider.is_active.is_(True)))).scalars().first()
    if not provider:
        raise HTTPException(status_code=404, detail="Truck provider is unavailable")
    job = Job(customer_id=user.id, provider_id=truck.provider_id, truck_id=truck.id,
              pickup_address=payload.pickup.address, pickup_place_id=payload.pickup.place_id, pickup_lat=payload.pickup.lat, pickup_lng=payload.pickup.lng,
              dropoff_address=payload.dropoff.address, dropoff_place_id=payload.dropoff.place_id, dropoff_lat=payload.dropoff.lat, dropoff_lng=payload.dropoff.lng,
              requested_min_price=payload.requested_min_price, requested_max_price=payload.requested_max_price,
              idempotency_key=payload.idempotency_key)
    db.add(job); await db.flush()
    lock = TruckLock(truck_id=truck.id, job_id=job.id, expires_at=now + timedelta(minutes=LOCK_MINUTES), is_active=True)
    db.add(lock); db.add(Payment(job_id=job.id, amount=0, status="not_started"))
    db.add(AuditEvent(actor=str(user.id), action="create_job_lock", record_type="Job", record_id=job.id, ip_address=_client_ip(request), user_agent=request.headers.get("user-agent")))
    await db.commit(); await db.refresh(job); await db.refresh(lock)
    job.truck = truck
    job.provider = provider
    job.truck_lock = lock
    return to_output(job)

@router.get("/jobs", response_model=list[JobOut])
async def customer_jobs(user: User = Depends(require_role(UserRole.CUSTOMER)), db: AsyncSession = Depends(get_db)):
    jobs = (await db.execute(select(Job).options(selectinload(Job.truck_lock), selectinload(Job.truck), selectinload(Job.provider)).where(Job.customer_id == user.id))).scalars().all()
    return [to_output(job) for job in jobs]

@router.post("/jobs/{job_id}/cancel", response_model=JobOut)
async def cancel_job(job_id: int, request: Request, user: User = Depends(require_role(UserRole.CUSTOMER)), db: AsyncSession = Depends(get_db)):
    job = (await db.execute(select(Job).options(selectinload(Job.truck_lock)).where(Job.id == job_id, Job.customer_id == user.id))).scalars().first()
    if not job or job.status not in (JobStatus.AWAITING_PRICE_APPROVAL, JobStatus.AWAITING_PAYMENT):
        raise HTTPException(status_code=404, detail="Cancellable job not found")
    job.status = JobStatus.CANCELLED
    if job.truck_lock: job.truck_lock.is_active = False
    db.add(AuditEvent(actor=str(user.id), action="cancel_job", record_type="Job", record_id=job.id, ip_address=_client_ip(request), user_agent=request.headers.get("user-agent")))
    await db.commit(); return to_output(job)

@router.get("/provider/jobs", response_model=list[JobOut])
async def provider_jobs(user: User = Depends(require_role(UserRole.PROVIDER)), db: AsyncSession = Depends(get_db)):
    jobs = (await db.execute(select(Job).options(selectinload(Job.truck_lock), selectinload(Job.truck), selectinload(Job.provider)).join(Truck).join(Provider).where(Provider.user_id == user.id))).scalars().all()
    return [to_output(job) for job in jobs]

@router.post("/provider/jobs/{job_id}/price-approval", response_model=JobOut)
async def price_approval(job_id: int, payload: PriceDecision, request: Request, user: User = Depends(require_role(UserRole.PROVIDER)), db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(select(PriceApproval).where(PriceApproval.provider_user_id == user.id, PriceApproval.idempotency_key == payload.idempotency_key))).scalars().first()
    if existing:
        job = (await db.execute(select(Job).options(selectinload(Job.truck_lock)).where(Job.id == existing.job_id))).scalars().one()
        return to_output(job)
    job = (await db.execute(select(Job).options(selectinload(Job.truck_lock)).join(Truck).join(Provider).where(Job.id == job_id, Provider.user_id == user.id).with_for_update())).scalars().first()
    if not job or job.status != JobStatus.AWAITING_PRICE_APPROVAL:
        raise HTTPException(status_code=404, detail="Reviewable job not found")
    if payload.decision == "approved" and not (job.requested_min_price <= payload.approved_amount <= job.requested_max_price):
        raise HTTPException(status_code=422, detail="Approved amount must be within the requested range")
    approved = payload.decision == "approved"
    job.status = JobStatus.AWAITING_PAYMENT if approved else JobStatus.REJECTED
    job.approved_price = payload.approved_amount if approved else None
    if not approved and job.truck_lock: job.truck_lock.is_active = False
    db.add(PriceApproval(job_id=job.id, provider_user_id=user.id, decision=payload.decision, approved_amount=payload.approved_amount, note=payload.note, idempotency_key=payload.idempotency_key))
    db.add(AuditEvent(actor=str(user.id), action="price_" + payload.decision, record_type="Job", record_id=job.id, ip_address=_client_ip(request), user_agent=request.headers.get("user-agent")))
    await db.commit(); return to_output(job)
