from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.security import get_current_user, require_role, _client_ip
from app.models.models import User, UserRole, Provider, Truck, Job, TruckLock, JobStatus, PriceApproval, Payment, AuditEvent, BookingMode, JobDecline
from app.schemas.jobs import JobCreate, JobOut, PriceDecision, JobAccept
from app.api.v1.events import manager
import logging

router = APIRouter(tags=["jobs"])
LOCK_MINUTES = 15
logger = logging.getLogger(__name__)

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

@router.post("/provider/jobs/{job_id}/start", response_model=JobOut)
async def start_job(job_id: int, request: Request, user: User = Depends(require_role(UserRole.PROVIDER)), db: AsyncSession = Depends(get_db)):
    # 1. Get job
    job = (await db.execute(
        select(Job)
        .options(selectinload(Job.provider))
        .join(Provider)
        .where(Job.id == job_id, Provider.user_id == user.id, Job.status == JobStatus.ACCEPTED)
    )).scalars().first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Active job not found")
        
    # 2. Update status
    job.status = JobStatus.IN_PROGRESS
    db.add(AuditEvent(actor=str(user.id), action="start_trip", record_type="Job", record_id=job.id, ip_address=_client_ip(request), user_agent=request.headers.get("user-agent")))
    await db.commit()
    await manager.broadcast(job.customer_id, {"type": "trip_started", "job_id": job.id})
    return to_output(job)

@router.post("/provider/jobs/{job_id}/complete", response_model=JobOut)
async def complete_job(job_id: int, request: Request, user: User = Depends(require_role(UserRole.PROVIDER)), db: AsyncSession = Depends(get_db)):
    # 1. Get job with relationships
    job = (await db.execute(
        select(Job)
        .options(selectinload(Job.provider), selectinload(Job.truck_lock))
        .join(Provider)
        .where(Job.id == job_id, Provider.user_id == user.id, Job.status == JobStatus.IN_PROGRESS)
    )).scalars().first()
    
    if not job:
        raise HTTPException(status_code=404, detail="In-progress job not found")
        
    # 2. Update status and reset resources
    job.status = JobStatus.COMPLETED
    
    # Reset provider availability
    provider = job.provider
    provider.is_available = True
    db.add(provider)
    
    # Release truck lock
    if job.truck_lock:
        job.truck_lock.is_active = False
        db.add(job.truck_lock)
        
    db.add(AuditEvent(actor=str(user.id), action="complete_trip", record_type="Job", record_id=job.id, ip_address=_client_ip(request), user_agent=request.headers.get("user-agent")))
    await db.commit()
    await manager.broadcast(job.customer_id, {"type": "trip_completed", "job_id": job.id})
    await manager.broadcast(job.provider.user_id, {"type": "trip_completed", "job_id": job.id})
    return to_output(job)

@router.post("/provider/status", response_model=dict)
async def update_provider_status(is_available: bool, user: User = Depends(require_role(UserRole.PROVIDER)), db: AsyncSession = Depends(get_db)):
    provider = (await db.execute(select(Provider).where(Provider.user_id == user.id))).scalars().first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    provider.is_available = is_available
    db.add(provider)
    await db.commit()
    return {"is_available": provider.is_available}

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
            (Job.booking_mode == BookingMode.PROVIDER_SELECTION) & (Job.provider_id == provider.id)
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
    existing = (await db.execute(select(Job).options(selectinload(Job.truck_lock)).where(Job.customer_id == user.id, Job.idempotency_key == payload.idempotency_key))).scalars().first()
    if existing:
        return to_output(existing)
    
    # Enforce PROVIDER_SELECTION mode
    job = Job(
        customer_id=user.id,
        booking_mode=BookingMode.PROVIDER_SELECTION,
        vehicle_class=payload.vehicle_class,
        provider_id=payload.provider_id,
        pickup_address=payload.pickup.address,
        dropoff_address=payload.dropoff.address,
        idempotency_key=payload.idempotency_key,
        status=JobStatus.PENDING
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    # Eagerly load relationships before to_output
    job = (await db.execute(select(Job).options(selectinload(Job.truck), selectinload(Job.provider), selectinload(Job.truck_lock)).where(Job.id == job.id))).scalars().one()
    return to_output(job)

@router.post("/jobs/{job_id}/accept", response_model=JobOut)
async def accept_job(job_id: int, payload: JobAccept, request: Request, user: User = Depends(require_role(UserRole.PROVIDER)), db: AsyncSession = Depends(get_db)):
    # 1. Get provider profile
    provider = (await db.execute(select(Provider).where(Provider.user_id == user.id))).scalars().first()
    if not provider:
        logger.info("accept_job 403: provider_not_found user_id=%s", user.id)
        raise HTTPException(status_code=403, detail="Provider not found")

    if not provider.is_active:
        logger.info("accept_job 403: provider_inactive provider_id=%s", provider.id)
        raise HTTPException(status_code=403, detail="Provider is inactive")

    if not provider.is_available:
        logger.info("accept_job 403: provider_unavailable provider_id=%s", provider.id)
        raise HTTPException(status_code=403, detail="Provider is busy")

    # 2. Get selected truck and validate ownership/activity/class
    truck = (await db.execute(
        select(Truck).where(
            Truck.id == payload.truck_id,
            Truck.provider_id == provider.id,
            Truck.is_active.is_(True),
        )
    )).scalars().first()
    if not truck:
        logger.info("accept_job 403: invalid_truck provider_id=%s truck_id=%s", provider.id, payload.truck_id)
        raise HTTPException(status_code=403, detail="Invalid truck assignment")

    # 3. Get job
    job = (await db.execute(select(Job).where(Job.id == job_id))).scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != JobStatus.PENDING:
        logger.info("accept_job 409: job_not_pending job_id=%s status=%s", job_id, job.status)
        raise HTTPException(status_code=409, detail="This request is no longer available.")

    # 4. Check provider ownership for provider-selection mode
    if job.booking_mode == BookingMode.PROVIDER_SELECTION and job.provider_id != provider.id:
        logger.info("accept_job 403: wrong_provider job_id=%s assigned_provider_id=%s attempt_provider_id=%s", job_id, job.provider_id, provider.id)
        raise HTTPException(status_code=403, detail="Job is assigned to another provider")

    # 5. Check vehicle support
    if truck.vehicle_class != job.vehicle_class:
        logger.info("accept_job 403: truck_class_mismatch provider_id=%s job_id=%s truck_class=%s job_class=%s", provider.id, job_id, truck.vehicle_class, job.vehicle_class)
        raise HTTPException(status_code=403, detail="Selected truck does not support this vehicle")

    # 6. Atomic claim with truck assignment
    from sqlalchemy import update
    result = await db.execute(
        update(Job)
        .where(Job.id == job_id, Job.status == JobStatus.PENDING)
        .values(provider_id=provider.id, truck_id=truck.id, status=JobStatus.ACCEPTED)
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=409, detail="This request is no longer available.")

    # 7. Mark provider unavailable
    provider.is_available = False
    db.add(provider)
    db.add(AuditEvent(actor=str(user.id), action="accept_job", record_type="Job", record_id=job.id, ip_address=_client_ip(request), user_agent=request.headers.get("user-agent")))
    await db.commit()

    # 8. Reload and return
    job = (await db.execute(
        select(Job)
        .options(selectinload(Job.truck), selectinload(Job.provider), selectinload(Job.truck_lock))
        .where(Job.id == job_id)
    )).scalars().first()
    return to_output(job)

@router.get("/jobs", response_model=list[JobOut])
async def customer_jobs(user: User = Depends(require_role(UserRole.CUSTOMER)), db: AsyncSession = Depends(get_db)):
    jobs = (await db.execute(select(Job).options(selectinload(Job.truck_lock), selectinload(Job.truck), selectinload(Job.provider)).where(Job.customer_id == user.id))).scalars().all()
    return [to_output(job) for job in jobs]

@router.post("/jobs/{job_id}/cancel", response_model=JobOut)
async def cancel_job(job_id: int, request: Request, user: User = Depends(require_role(UserRole.CUSTOMER)), db: AsyncSession = Depends(get_db)):
    job = (await db.execute(select(Job).options(selectinload(Job.truck_lock), selectinload(Job.provider)).where(Job.id == job_id, Job.customer_id == user.id))).scalars().first()
    # PENDING jobs can also be cancelled
    if not job or job.status not in (JobStatus.PENDING, JobStatus.AWAITING_PRICE_APPROVAL, JobStatus.AWAITING_PAYMENT, JobStatus.ACCEPTED):
        raise HTTPException(status_code=404, detail="Cancellable job not found")
    
    if job.status == JobStatus.ACCEPTED and job.provider:
        job.provider.is_available = True
        db.add(job.provider)
        
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
    
    approved = payload.decision == "approved"
    job.status = JobStatus.AWAITING_PAYMENT if approved else JobStatus.REJECTED
    job.approved_price = payload.approved_amount if approved else None
    if not approved and job.truck_lock: job.truck_lock.is_active = False
    db.add(PriceApproval(job_id=job.id, provider_user_id=user.id, decision=payload.decision, approved_amount=payload.approved_amount, note=payload.note, idempotency_key=payload.idempotency_key))
    db.add(AuditEvent(actor=str(user.id), action="price_" + payload.decision, record_type="Job", record_id=job.id, ip_address=_client_ip(request), user_agent=request.headers.get("user-agent")))
    await db.commit(); return to_output(job)
