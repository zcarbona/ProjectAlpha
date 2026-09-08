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
    # Safely access attributes that might not be loaded
    truck = job.truck if hasattr(job, 'truck') else None
    provider = job.provider if hasattr(job, 'provider') else None
    lock = job.truck_lock if hasattr(job, 'truck_lock') else None
    
    return JobOut(
        id=job.id,
        truck_id=job.truck_id or 0,
        vehicle_class=job.vehicle_class,
        truck_plate=truck.plate_number if truck else None,
        provider_id=job.provider_id or 0,
        provider_name=provider.display_name if provider else "",
        status=job.status.value,
        payment_status=job.payment_status,
        requested_min_price=job.requested_min_price,
        requested_max_price=job.requested_max_price,
        approved_price=job.approved_price,
        lock_expires_at=lock.expires_at if lock and lock.is_active else None,
        pickup_address=job.pickup_address or "",
        dropoff_address=job.dropoff_address or "",
    )

@router.get("/trucks")
async def trucks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Truck).where(Truck.is_active.is_(True)))
    return [{"id": truck.id, "vehicle_class": truck.vehicle_class, "capacity": truck.capacity} for truck in result.scalars()]

from app.models.models import User, UserRole, Provider, Truck, Job, TruckLock, JobStatus, Payment, AuditEvent, BookingMode, JobDecline
from sqlalchemy import select, update, not_

# ... (rest of the file content)

@router.get("/provider/requests", response_model=list[JobOut])
async def get_available_requests(user: User = Depends(require_role(UserRole.PROVIDER)), db: AsyncSession = Depends(get_db)):
    provider = (await db.execute(select(Provider).where(Provider.user_id == user.id))).scalars().first()
    if not provider:
        raise HTTPException(status_code=403, detail="Provider not found")
        
    declined_ids = select(JobDecline.job_id).where(JobDecline.provider_id == provider.id)
    jobs = (await db.execute(
        select(Job)
        .options(selectinload(Job.truck), selectinload(Job.provider), selectinload(Job.truck_lock))
        .where(
            Job.status == JobStatus.PENDING,
            not_(Job.id.in_(declined_ids)),
            (
                (Job.booking_mode == BookingMode.REQUEST) |
                ((Job.booking_mode == BookingMode.PROVIDER_SELECTION) & (Job.provider_id == provider.id))
            )
        )
    )).scalars().all()
    return [to_output(job) for job in jobs]

@router.post("/jobs/{job_id}/decline")
async def decline_job(job_id: int, user: User = Depends(require_role(UserRole.PROVIDER)), db: AsyncSession = Depends(get_db)):
    provider = (await db.execute(select(Provider).where(Provider.user_id == user.id))).scalars().first()
    if not provider:
        raise HTTPException(status_code=403, detail="Provider not found")
    db.add(JobDecline(job_id=job_id, provider_id=provider.id))
    await db.commit()
    return {"success": True}


@router.post("/jobs", response_model=JobOut, status_code=status.HTTP_201_CREATED)
async def create_job(payload: JobCreate, request: Request, user: User = Depends(require_role(UserRole.CUSTOMER)), db: AsyncSession = Depends(get_db)):
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Verified email or phone is required before requesting a truck")
    existing = (await db.execute(select(Job).options(selectinload(Job.truck_lock)).where(Job.customer_id == user.id, Job.idempotency_key == payload.idempotency_key))).scalars().first()
    if existing:
        return to_output(existing)
    
    # New flow: create job as PENDING
    job = Job(
        customer_id=user.id,
        booking_mode=payload.booking_mode,
        vehicle_class=payload.vehicle_class,
        provider_id=payload.provider_id if payload.booking_mode == BookingMode.PROVIDER_SELECTION else None,
        pickup_address=payload.pickup.address,
        dropoff_address=payload.dropoff.address,
        requested_min_price=payload.requested_min_price,
        requested_max_price=payload.requested_max_price,
        idempotency_key=payload.idempotency_key,
        status=JobStatus.PENDING
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    # Eagerly load relationships before to_output
    job = (await db.execute(select(Job).options(selectinload(Job.truck), selectinload(Job.provider)).where(Job.id == job.id))).scalars().one()
    return to_output(job)

@router.post("/jobs/{job_id}/accept", response_model=JobOut)
async def accept_job(job_id: int, request: Request, user: User = Depends(require_role(UserRole.PROVIDER)), db: AsyncSession = Depends(get_db)):
    # 1. Get provider
    provider = (await db.execute(select(Provider).options(selectinload(Provider.trucks)).where(Provider.user_id == user.id, Provider.is_active.is_(True), Provider.is_available.is_(True)))).scalars().first()
    if not provider:
        raise HTTPException(status_code=403, detail="Provider not found, inactive, or busy")
    
    # 2. Get job
    job = (await db.execute(select(Job).where(Job.id == job_id, Job.status == JobStatus.PENDING))).scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or not pending")

    # 3. Check vehicle support
    if not any(t.vehicle_class == job.vehicle_class for t in provider.trucks if t.is_active):
        raise HTTPException(status_code=403, detail="Provider does not support this vehicle")

    # 4. Atomic update: try to claim job if it's still PENDING
    from sqlalchemy import update
    result = await db.execute(
        update(Job)
        .where(Job.id == job_id, Job.status == JobStatus.PENDING)
        .values(provider_id=provider.id, status=JobStatus.ACCEPTED)
    )
    
    if result.rowcount == 0:
        raise HTTPException(status_code=409, detail="This request is no longer available.")
    
    # 5. Mark provider as unavailable (as per requirement 29)
    provider.is_available = False
    db.add(provider)
    await db.commit()
    
    # 6. Reload job to return
    job = (await db.execute(select(Job).options(selectinload(Job.truck), selectinload(Job.provider)).where(Job.id == job_id))).scalars().first()
    db.add(AuditEvent(actor=str(user.id), action="accept_job", record_type="Job", record_id=job.id, ip_address=_client_ip(request), user_agent=request.headers.get("user-agent")))
    await db.commit()
    return to_output(job)

@router.get("/jobs", response_model=list[JobOut])
async def customer_jobs(user: User = Depends(require_role(UserRole.CUSTOMER)), db: AsyncSession = Depends(get_db)):
    jobs = (await db.execute(select(Job).options(selectinload(Job.truck_lock), selectinload(Job.truck), selectinload(Job.provider)).where(Job.customer_id == user.id))).scalars().all()
    return [to_output(job) for job in jobs]

@router.post("/jobs/{job_id}/cancel", response_model=JobOut)
async def cancel_job(job_id: int, request: Request, user: User = Depends(require_role(UserRole.CUSTOMER)), db: AsyncSession = Depends(get_db)):
    job = (await db.execute(select(Job).options(selectinload(Job.truck_lock)).where(Job.id == job_id, Job.customer_id == user.id))).scalars().first()
    # PENDING jobs can also be cancelled
    if not job or job.status not in (JobStatus.PENDING, JobStatus.AWAITING_PRICE_APPROVAL, JobStatus.AWAITING_PAYMENT):
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
