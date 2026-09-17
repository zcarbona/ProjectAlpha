from datetime import datetime, timedelta


from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, update, not_, or_,and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user, require_role, _client_ip
from app.models.models import (
    User,
    UserRole,
    Provider,
    Truck,
    Job,
    TruckLock,
    JobStatus,
    PriceApproval,
    Payment,
    AuditEvent,
    BookingMode,
    JobDecline,
)
from app.schemas.jobs import (
    JobCreate,
    JobOut,
    PriceDecision,
    JobAccept,
    ProviderStatusUpdate,
)
from app.routers.events import manager
from app.services.job_eligibility import (
    get_eligible_providers_for_job,
    get_declined_provider_ids,
)

import logging


router = APIRouter(tags=["jobs"])

LOCK_MINUTES = 15

logger = logging.getLogger(__name__)


def to_output(job: Job) -> JobOut:
    truck = job.truck if hasattr(job, "truck") else None
    provider = job.provider if hasattr(job, "provider") else None
    lock = job.truck_lock if hasattr(job, "truck_lock") else None

    return JobOut(
        id=job.id,
        truck_id=job.truck_id,
        vehicle_class=job.vehicle_class,
        truck_plate=truck.plate_number if truck else None,
        provider_id=job.provider_id,
        provider_name=provider.display_name if provider else "",
        status=job.status.value,
        payment_status=job.payment_status,
        approved_price=job.approved_price,
        requested_min_price=job.requested_min_price,
        requested_max_price=job.requested_max_price,
        lock_expires_at=(
            lock.expires_at
            if lock and lock.is_active
            else None
        ),
        pickup_address=job.pickup_address or "",
        pickup_city=job.pickup_city or "",
        dropoff_address=job.dropoff_address or "",
        dropoff_city=job.dropoff_city or "",
    )


# ============================================================
# PUBLIC TRUCKS
# ============================================================

@router.get("/trucks")
async def trucks(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Truck).where(
            Truck.is_active.is_(True)
        )
    )

    return [
        {
            "id": truck.id,
            "vehicle_class": truck.vehicle_class,
            "capacity": truck.capacity,
        }
        for truck in result.scalars()
    ]


# ============================================================
# PROVIDER - START JOB
# ============================================================

@router.post(
    "/provider/jobs/{job_id}/start",
    response_model=JobOut,
)
async def start_job(
    job_id: int,
    request: Request,
    user: User = Depends(
        require_role(UserRole.PROVIDER)
    ),
    db: AsyncSession = Depends(get_db),
):
    user_id = user.id

    provider = (
        await db.execute(
            select(Provider).where(
                Provider.user_id == user_id
            )
        )
    ).scalars().first()

    if not provider:
        logger.info(
            "start_job 403: provider_not_found user_id=%s",
            user_id,
        )
        raise HTTPException(
            status_code=403,
            detail="Provider not found",
        )

    if not provider.is_active:
        logger.info(
            "start_job 403: provider_inactive provider_id=%s",
            provider.id,
        )
        raise HTTPException(
            status_code=403,
            detail="Provider is inactive",
        )

    job = (
        await db.execute(
            select(Job)
            .options(
                selectinload(Job.truck),
                selectinload(Job.provider),
                selectinload(Job.truck_lock),
            )
            .join(Provider)
            .where(
                Job.id == job_id,
                Provider.user_id == user_id,
                Job.status == JobStatus.ACCEPTED,
            )
        )
    ).scalars().first()

    if not job:
        logger.info(
            "start_job 404: active_job_not_found job_id=%s",
            job_id,
        )
        raise HTTPException(
            status_code=404,
            detail="Active job not found",
        )

    if not job.truck_id:
        logger.info(
            "start_job 404: no_truck_assigned job_id=%s",
            job_id,
        )
        raise HTTPException(
            status_code=404,
            detail="No truck assigned to this job",
        )

    assigned_truck = job.truck

    if not assigned_truck:
        raise HTTPException(
            status_code=404,
            detail="Assigned truck not found",
        )

    if assigned_truck.provider_id != provider.id:
        logger.info(
            "start_job 403: wrong_truck_provider "
            "job_id=%s truck_provider_id=%s "
            "attempt_provider_id=%s",
            job_id,
            assigned_truck.provider_id,
            provider.id,
        )
        raise HTTPException(
            status_code=403,
            detail="Truck does not belong to provider",
        )

    if not assigned_truck.is_active:
        logger.info(
            "start_job 403: truck_inactive "
            "job_id=%s truck_id=%s",
            job_id,
            assigned_truck.id,
        )
        raise HTTPException(
            status_code=403,
            detail="Assigned truck is inactive",
        )

    job.status = JobStatus.IN_PROGRESS
    # Mark the assigned truck as occupied.
    await db.execute(
        update(Truck)
        .where(Truck.id == job.truck_id)
        .values(is_available=False)
    )

    db.add(
        AuditEvent(
            actor=str(user_id),
            action="start_trip",
            record_type="Job",
            record_id=job.id,
            ip_address=_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
    )

    await db.commit()

    await manager.broadcast(
        job.customer_id,
        {
            "type": "trip_started",
            "job_id": job.id,
        },
    )

    job = (
        await db.execute(
            select(Job)
            .options(
                selectinload(Job.truck),
                selectinload(Job.provider),
                selectinload(Job.truck_lock),
            )
            .where(Job.id == job_id)
        )
    ).scalars().first()

    return to_output(job)


# ============================================================
# PROVIDER - COMPLETE JOB
# ============================================================

@router.post(
    "/provider/jobs/{job_id}/complete",
    response_model=JobOut,
)
async def complete_job(
    job_id: int,
    request: Request,
    user: User = Depends(
        require_role(UserRole.PROVIDER)
    ),
    db: AsyncSession = Depends(get_db),
):
    user_id = user.id

    job = (
        await db.execute(
            select(Job)
            .options(
                selectinload(Job.truck),
                selectinload(Job.provider),
                selectinload(Job.truck_lock),
            )
            .join(Provider)
            .where(
                Job.id == job_id,
                Provider.user_id == user_id,
                Job.status == JobStatus.IN_PROGRESS,
            )
        )
    ).scalars().first()

    if not job:
        raise HTTPException(
            status_code=404,
            detail="In-progress job not found",
        )

    job.status = JobStatus.COMPLETED

    if job.truck_lock:
        await db.execute(
            update(Truck)
            .where(Truck.id == job.truck_lock.truck_id)
            .values(is_available=True)
        )

    if job.truck_lock:
        job.truck_lock.is_active = False
        db.add(job.truck_lock)

    if job.provider:
        job.provider.is_available = True
        db.add(job.provider)
    else:
        prov = (await db.execute(select(Provider).where(Provider.user_id == user_id))).scalars().first()
        if prov:
            prov.is_available = True
            db.add(prov)

    db.add(
        AuditEvent(
            actor=str(user_id),
            action="complete_trip",
            record_type="Job",
            record_id=job.id,
            ip_address=_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
    )

    await db.commit()

    await manager.broadcast(
        job.customer_id,
        {
            "type": "trip_completed",
            "job_id": job.id,
        },
    )

    if job.provider:
        await manager.broadcast(
            job.provider.user_id,
            {
                "type": "trip_completed",
                "job_id": job.id,
            },
        )

    job = (
        await db.execute(
            select(Job)
            .options(
                selectinload(Job.truck),
                selectinload(Job.provider),
                selectinload(Job.truck_lock),
            )
            .where(Job.id == job_id)
        )
    ).scalars().first()

    return to_output(job)


# ============================================================
# PROVIDER - AVAILABILITY STATUS
# ============================================================

@router.post(
    "/provider/status",
    response_model=dict,
)
async def update_provider_status(
    payload: ProviderStatusUpdate,
    user: User = Depends(
        require_role(UserRole.PROVIDER)
    ),
    db: AsyncSession = Depends(get_db),
):
    user_id = user.id

    provider = (
        await db.execute(
            select(Provider).where(
                Provider.user_id == user_id
            )
        )
    ).scalars().first()

    if not provider:
        raise HTTPException(
            status_code=404,
            detail="Provider not found",
        )

    provider.is_available = payload.is_available

    db.add(provider)

    await db.commit()

    return {
        "is_available": provider.is_available
    }


# ============================================================
# PROVIDER - AVAILABLE REQUESTS
# ============================================================

@router.get(
    "/provider/requests",
    response_model=list[JobOut],
)
async def get_available_requests(
    user: User = Depends(
        require_role(UserRole.PROVIDER)
    ),
    db: AsyncSession = Depends(get_db),
):
    user_id = user.id

    provider = (
        await db.execute(
            select(Provider).where(
                Provider.user_id == user_id
            )
        )
    ).scalars().first()

    if not provider or not provider.is_active:
        raise HTTPException(
            status_code=403,
            detail="Provider not found",
        )

    if not provider.is_available:
        return []

    busy = (
        await db.execute(
            select(Job.id).where(
                Job.provider_id == provider.id,
                Job.status.in_([JobStatus.ACCEPTED, JobStatus.IN_PROGRESS]),
            ).limit(1)
        )
    ).scalar_one_or_none()
    if busy is not None:
        return []

    declined_ids = select(
        JobDecline.job_id
    ).where(
        JobDecline.provider_id == provider.id
    )

    occupied = (
        select(1)
        .where(
            Job.truck_id == Truck.id,
            Job.status.in_(
                [
                    JobStatus.ACCEPTED,
                    JobStatus.IN_PROGRESS,
                ]
            ),
        )
        .exists()
    )

    has_available_truck = (
        select(Truck.id)
        .where(
            Truck.provider_id == provider.id,
            Truck.is_active.is_(True),
            Truck.vehicle_class == Job.vehicle_class,
            ~occupied,
        )
        .exists()
    )

    jobs = (
        await db.execute(
            select(Job)
            .options(
                selectinload(Job.truck),
                selectinload(Job.provider),
                selectinload(Job.truck_lock),
            )
            .where(
                Job.status == JobStatus.PENDING,
                Job.id.notin_(declined_ids),
                has_available_truck,
                or_(
                    and_(
                        Job.booking_mode == BookingMode.PROVIDER_SELECTION,
                        Job.provider_id == provider.id,
                    ),
                    and_(
                        Job.booking_mode == BookingMode.REQUEST,
                        Job.provider_id.is_(None),
                    ),
                ),
            )
        )
    ).scalars().all()

    return [
        to_output(job)
        for job in jobs
    ]


# ============================================================
# PROVIDER - DECLINE JOB
# ============================================================

@router.post(
    "/jobs/{job_id}/decline"
)
async def decline_job(
    job_id: int,
    request: Request,
    user: User = Depends(
        require_role(UserRole.PROVIDER)
    ),
    db: AsyncSession = Depends(get_db),
):
    # Capture primitive value before any rollback.
    # Prevents MissingGreenlet caused by accessing
    # user.id after rollback/expiration.
    user_id = user.id

    try:
        provider = (
            await db.execute(
                select(Provider).where(
                    Provider.user_id == user_id
                )
            )
        ).scalars().first()

        if not provider:
            raise HTTPException(
                status_code=403,
                detail="Provider not found",
            )

        job = (
            await db.execute(
                select(Job)
                .where(Job.id == job_id)
                .with_for_update()
            )
        ).scalars().first()

        if not job:
            raise HTTPException(
                status_code=404,
                detail="Job not found",
            )

        if job.status != JobStatus.PENDING:
            raise HTTPException(
                status_code=409,
                detail="Job is no longer pending",
            )

        existing = (
            await db.execute(
                select(JobDecline).where(
                    JobDecline.job_id == job_id,
                    JobDecline.provider_id == provider.id,
                )
            )
        ).scalars().first()

        if existing:
            raise HTTPException(
                status_code=409,
                detail="Already declined",
            )

        db.add(
            JobDecline(
                job_id=job_id,
                provider_id=provider.id,
            )
        )

        await db.flush()

        eligible = await get_eligible_providers_for_job(
            job,
            db,
        )

        declined_provider_ids = (
            await get_declined_provider_ids(
                job_id,
                db,
            )
        )

        remaining = [
            provider_item
            for provider_item in eligible
            if provider_item.id
            not in declined_provider_ids
        ]

        all_providers_declined = not remaining

        if all_providers_declined:
            job.status = JobStatus.DECLINED

            db.add(
                AuditEvent(
                    actor=str(user_id),
                    action="job_declined",
                    record_type="Job",
                    record_id=job.id,
                    ip_address=_client_ip(request),
                    user_agent=request.headers.get(
                        "user-agent"
                    ),
                )
            )

        await db.commit()

    except HTTPException:
        await db.rollback()
        raise

    except Exception:
        await db.rollback()

        logger.exception(
            "decline_job failed job_id=%s user_id=%s",
            job_id,
            user_id,
        )

        raise

    if all_providers_declined:
        await manager.broadcast(
            job.customer_id,
            {
                "type": "job_status_changed",
                "job_id": job.id,
                "status": "declined",
            },
        )

    return {
        "success": True,
        "status": (
            "declined"
            if all_providers_declined
            else "pending"
        ),
    }


# ============================================================
# CUSTOMER - CREATE JOB(Quick Booking)/(Select Provider)
# ============================================================
# CUSTOMER can create a job in two ways:
# 1. Quick Booking: The system automatically send requst to all providers.
# 2. Select Provider: The customer selects a specific provider to send the request to.
@router.post(
    "/jobs/selective",
    response_model=JobOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_job_selective(
    payload: JobCreate,
    request: Request,
    user: User = Depends(
        require_role(UserRole.CUSTOMER)
    ),
    db: AsyncSession = Depends(get_db),
):
    user_id = user.id

    existing = (
        await db.execute(
            select(Job)
            .options(
                selectinload(Job.truck),
                selectinload(Job.provider),
                selectinload(Job.truck_lock),
            )
            .where(
                Job.customer_id == user_id,
                Job.idempotency_key
                == payload.idempotency_key,
            )
        )
    ).scalars().first()

    if existing:
        return to_output(existing)

    if payload.provider_id is None:
        raise HTTPException(
            status_code=422,
            detail="provider_id is required for selective booking",
        )

    job = Job(
        customer_id=user_id,

        booking_mode=BookingMode.PROVIDER_SELECTION,

        vehicle_class=payload.vehicle_class,

        # The job is broadcast to providers.
        # Provider/truck are assigned only when
        # a provider accepts it.
        provider_id=payload.provider_id,
        #truck_id=None,

        pickup_address=payload.pickup.address,
        pickup_city=payload.pickup.city,
        pickup_place_id=payload.pickup.place_id,
        pickup_lat=payload.pickup.lat,
        pickup_lng=payload.pickup.lng,

        dropoff_address=payload.dropoff.address,
        dropoff_city=payload.dropoff.city,
        dropoff_place_id=payload.dropoff.place_id,
        dropoff_lat=payload.dropoff.lat,
        dropoff_lng=payload.dropoff.lng,

        requested_min_price=payload.requested_min_price,
        requested_max_price=payload.requested_max_price,

        idempotency_key=payload.idempotency_key,

        status=JobStatus.PENDING,
    )

    db.add(job)

    await db.commit()

    await db.refresh(job)

    job = (
        await db.execute(
            select(Job)
            .options(
                selectinload(Job.truck),
                selectinload(Job.provider),
                selectinload(Job.truck_lock),
            )
            .where(Job.id == job.id)
        )
    ).scalars().one()

    return to_output(job)

# ============================================================
# CUSTOMER - CREATE JOB
# ============================================================
# send request to all providers, like uber you you request a truck.
@router.post(
    "/jobs/quick_request",
    response_model=JobOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_quick_job(
    payload: JobCreate,
    request: Request,
    user: User = Depends(
        require_role(UserRole.CUSTOMER)
    ),
    db: AsyncSession = Depends(get_db),
):
    user_id = user.id

    existing = (
        await db.execute(
            select(Job)
            .options(
                selectinload(Job.truck),
                selectinload(Job.provider),
                selectinload(Job.truck_lock),
            )
            .where(
                Job.customer_id == user_id,
                Job.idempotency_key
                == payload.idempotency_key,
            )
        )
    ).scalars().first()

    if existing:
        return to_output(existing)

    job = Job(
        customer_id=user_id,

        booking_mode=BookingMode.REQUEST,

        vehicle_class=payload.vehicle_class,

        # The job is broadcast to providers.
        # Provider/truck are assigned only when
        # a provider accepts it.
        provider_id=None,
        #truck_id=None,

        pickup_address=payload.pickup.address,
        pickup_city=payload.pickup.city,
        pickup_place_id=payload.pickup.place_id,
        pickup_lat=payload.pickup.lat,
        pickup_lng=payload.pickup.lng,

        dropoff_address=payload.dropoff.address,
        dropoff_city=payload.dropoff.city,
        dropoff_place_id=payload.dropoff.place_id,
        dropoff_lat=payload.dropoff.lat,
        dropoff_lng=payload.dropoff.lng,

        requested_min_price=payload.requested_min_price,
        requested_max_price=payload.requested_max_price,

        idempotency_key=payload.idempotency_key,

        status=JobStatus.PENDING,
    )

    db.add(job)

    await db.commit()

    await db.refresh(job)

    job = (
        await db.execute(
            select(Job)
            .options(
                selectinload(Job.truck),
                selectinload(Job.provider),
                selectinload(Job.truck_lock),
            )
            .where(Job.id == job.id),
        )
    ).scalars().one()

    return to_output(job)


@router.post(
    "/jobs",
    response_model=JobOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_job_unified(
    payload: JobCreate,
    request: Request,
    user: User = Depends(
        require_role(UserRole.CUSTOMER)
    ),
    db: AsyncSession = Depends(get_db),
):
    if payload.provider_id is not None:
        return await create_job_selective(payload=payload, request=request, user=user, db=db)
    return await create_quick_job(payload=payload, request=request, user=user, db=db)



# ============================================================
# PROVIDER - ACCEPT JOB
# ============================================================

@router.post(
    "/jobs/{job_id}/accept",
    response_model=JobOut,
)
async def accept_job(
    job_id: int,
    payload: JobAccept,
    request: Request,
    user: User = Depends(
        require_role(UserRole.PROVIDER)
    ),
    db: AsyncSession = Depends(get_db),
):
    # IMPORTANT:
    # Capture primitive ID before any DB rollback.
    # SQLAlchemy can expire ORM objects after rollback.
    user_id = user.id

    try:
        # ----------------------------------------------------
        # 1. LOCK THE JOB FIRST
        # ----------------------------------------------------
        #
        # This prevents two providers from accepting
        # the same pending job simultaneously.
        #
        job = (
            await db.execute(
                select(Job)
                .where(Job.id == job_id)
                .with_for_update()
            )
        ).scalars().first()

        if not job:
            raise HTTPException(
                status_code=404,
                detail="Job not found",
            )

        if job.status != JobStatus.PENDING:
            raise HTTPException(
                status_code=409,
                detail="This request is no longer available.",
            )

        # ----------------------------------------------------
        # 2. GET PROVIDER
        # ----------------------------------------------------

        provider = (
            await db.execute(
                select(Provider).where(
                    Provider.user_id == user_id
                ).with_for_update()
            )
        ).scalars().first()

        if not provider:
            raise HTTPException(
                status_code=403,
                detail="Provider not found",
            )

        if not provider.is_active:
            raise HTTPException(
                status_code=403,
                detail="Provider is inactive",
            )

        if not provider.is_available:
            raise HTTPException(
                status_code=409,
                detail="Provider is busy",
            )

        provider_busy = (
            await db.execute(
                select(Job.id)
                .where(
                    Job.provider_id == provider.id,
                    Job.status.in_([JobStatus.ACCEPTED, JobStatus.IN_PROGRESS]),
                    Job.id != job_id,
                )
                .limit(1)
            )
        ).scalar_one_or_none()

        if provider_busy is not None:
            raise HTTPException(
                status_code=409,
                detail="Provider already has an active job",
            )

        if job.booking_mode == BookingMode.PROVIDER_SELECTION:
            if job.provider_id != provider.id:
                raise HTTPException(
                    status_code=403,
                    detail=(
                        "This request is not assigned "
                        "to your provider account"
                    ),
                )

        # ----------------------------------------------------
        # 3. PROVIDER MUST NOT HAVE DECLINED THIS JOB
        # ----------------------------------------------------

        provider_decline = (
            await db.execute(
                select(JobDecline).where(
                    JobDecline.job_id == job_id,
                    JobDecline.provider_id == provider.id,
                )
            )
        ).scalars().first()

        if provider_decline:
            raise HTTPException(
                status_code=409,
                detail="Provider has already declined this job",
            )

        # ----------------------------------------------------
        # 4. LOCK THE SELECTED TRUCK
        # ----------------------------------------------------

        truck = (
            await db.execute(
                select(Truck)
                .where(
                    Truck.id == payload.truck_id,
                    Truck.provider_id == provider.id,
                    Truck.is_active.is_(True),
                )
                .with_for_update()
            )
        ).scalars().first()

        if not truck:
            raise HTTPException(
                status_code=403,
                detail="Invalid truck assignment",
            )

        # ----------------------------------------------------
        # 5. VERIFY VEHICLE TYPE
        # ----------------------------------------------------

        if truck.vehicle_class != job.vehicle_class:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Selected truck does not support "
                    "this vehicle"
                ),
            )

        # ----------------------------------------------------
        # 6. CHECK WHETHER THIS TRUCK IS ALREADY BUSY
        # ----------------------------------------------------
        #
        # A provider CAN have multiple active jobs.
        #
        # A TRUCK cannot have multiple active jobs.
        #

        truck_occupied = (
            await db.execute(
                select(Job.id)
                .where(
                    Job.truck_id == truck.id,
                    Job.status.in_(
                        [
                            JobStatus.ACCEPTED,
                            JobStatus.IN_PROGRESS,
                        ]
                    ),
                    Job.id != job_id,
                )
                .limit(1)
            )
        ).scalar_one_or_none()

        if truck_occupied is not None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Selected truck is already assigned "
                    "to an active job."
                ),
            )

        # ----------------------------------------------------
        # 7. ASSIGN PROVIDER + TRUCK
        # ----------------------------------------------------

        result = await db.execute(
            update(Job)
            .where(
                Job.id == job_id,
                Job.status == JobStatus.PENDING,
            )
            .values(
                provider_id=provider.id,
                truck_id=truck.id,
                status=JobStatus.ACCEPTED,
            )
        )

        if result.rowcount != 1:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This request is no longer available."
                ),
            )

        prov_update = await db.execute(
            update(Provider)
            .where(
                Provider.id == provider.id,
                Provider.is_available.is_(True),
            )
            .values(is_available=False)
        )

        if prov_update.rowcount != 1:
            raise HTTPException(
                status_code=409,
                detail="Provider already has an active job",
            )

        provider.is_available = False

        # ----------------------------------------------------
        # 8. CREATE TRUCK LOCK
        # ----------------------------------------------------

        db.add(
            TruckLock(
                truck_id=truck.id,
                job_id=job.id,
                expires_at=(
                    datetime.utcnow()
                    + timedelta(minutes=LOCK_MINUTES)
                ),
                is_active=True,
            )
        )

        # ----------------------------------------------------
        # 9. AUDIT EVENT
        # ----------------------------------------------------

        db.add(
            AuditEvent(
                actor=str(user_id),
                action="accept_job",
                record_type="Job",
                record_id=job.id,
                ip_address=_client_ip(request),
                user_agent=request.headers.get(
                    "user-agent"
                ),
            )
        )

        # ----------------------------------------------------
        # 10. COMMIT EVERYTHING ATOMICALLY
        # ----------------------------------------------------

        await db.commit()

    except HTTPException:
        await db.rollback()
        raise

    except Exception:
        await db.rollback()

        # IMPORTANT:
        # Do NOT use user.id here.
        # Use the primitive user_id captured before rollback.
        logger.exception(
            "accept_job failed job_id=%s user_id=%s",
            job_id,
            user_id,
        )

        raise

    # --------------------------------------------------------
    # 11. RELOAD COMPLETE JOB
    # --------------------------------------------------------

    job = (
        await db.execute(
            select(Job)
            .options(
                selectinload(Job.truck),
                selectinload(Job.provider),
                selectinload(Job.truck_lock),
            )
            .where(Job.id == job_id)
        )
    ).scalars().first()

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Accepted job could not be reloaded",
        )

    # --------------------------------------------------------
    # 12. NOTIFY CUSTOMER
    # --------------------------------------------------------

    await manager.broadcast(
        job.customer_id,
        {
            "type": "job_accepted",
            "job_id": job.id,
            "provider_id": job.provider_id,
            "truck_id": job.truck_id,
            "status": job.status.value,
        },
    )

    return to_output(job)


# ============================================================
# CUSTOMER - GET JOBS
# ============================================================

@router.get(
    "/jobs",
    response_model=list[JobOut],
)
async def customer_jobs(
    user: User = Depends(
        require_role(UserRole.CUSTOMER)
    ),
    db: AsyncSession = Depends(get_db),
):
    user_id = user.id

    jobs = (
        await db.execute(
            select(Job)
            .options(
                selectinload(Job.truck_lock),
                selectinload(Job.truck),
                selectinload(Job.provider),
            )
            .where(
                Job.customer_id == user_id
            )
        )
    ).scalars().all()

    return [
        to_output(job)
        for job in jobs
    ]


# ============================================================
# CUSTOMER - CANCEL JOB
# ============================================================

@router.post(
    "/jobs/{job_id}/cancel",
    response_model=JobOut,
)
async def cancel_job(
    job_id: int,
    request: Request,
    user: User = Depends(
        require_role(UserRole.CUSTOMER)
    ),
    db: AsyncSession = Depends(get_db),
):
    user_id = user.id

    job = (
        await db.execute(
            select(Job)
            .options(
                selectinload(Job.truck_lock),
                selectinload(Job.truck),
                selectinload(Job.provider),
            )
            .where(
                Job.id == job_id,
                Job.customer_id == user_id,
            )
        )
    ).scalars().first()

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Cancellable job not found",
        )

    if job.status not in (
        JobStatus.PENDING,
        JobStatus.AWAITING_PRICE_APPROVAL,
        JobStatus.AWAITING_PAYMENT,
        JobStatus.ACCEPTED,
    ):
        raise HTTPException(
            status_code=404,
            detail="Cancellable job not found",
        )

    job.status = JobStatus.CANCELLED

    if job.truck_lock:
        job.truck_lock.is_active = False
        db.add(job.truck_lock)

    db.add(
        AuditEvent(
            actor=str(user_id),
            action="cancel_job",
            record_type="Job",
            record_id=job.id,
            ip_address=_client_ip(request),
            user_agent=request.headers.get(
                "user-agent"
            ),
        )
    )

    await db.commit()

    await manager.broadcast(
        job.customer_id,
        {
            "type": "job_status_changed",
            "job_id": job.id,
            "status": "cancelled",
        },
    )

    return to_output(job)


# ============================================================
# PROVIDER - GET ASSIGNED JOBS
# ============================================================

@router.get(
    "/provider/jobs",
    response_model=list[JobOut],
)
async def provider_jobs(
    user: User = Depends(
        require_role(UserRole.PROVIDER)
    ),
    db: AsyncSession = Depends(get_db),
):
    user_id = user.id

    jobs = (
        await db.execute(
            select(Job)
            .options(
                selectinload(Job.truck_lock),
                selectinload(Job.truck),
                selectinload(Job.provider),
            )
            .join(Truck)
            .join(Provider)
            .where(
                Provider.user_id == user_id
            )
        )
    ).scalars().all()

    return [
        to_output(job)
        for job in jobs
    ]


# ============================================================
# PROVIDER - PRICE APPROVAL
# ============================================================

@router.post(
    "/provider/jobs/{job_id}/price-approval",
    response_model=JobOut,
)
async def price_approval(
    job_id: int,
    payload: PriceDecision,
    request: Request,
    user: User = Depends(
        require_role(UserRole.PROVIDER)
    ),
    db: AsyncSession = Depends(get_db),
):
    user_id = user.id

    # --------------------------------------------------------
    # IDEMPOTENCY
    # --------------------------------------------------------

    existing = (
        await db.execute(
            select(PriceApproval).where(
                PriceApproval.provider_user_id
                == user_id,
                PriceApproval.idempotency_key
                == payload.idempotency_key,
            )
        )
    ).scalars().first()

    if existing:
        job = (
            await db.execute(
                select(Job)
                .options(
                    selectinload(Job.truck),
                    selectinload(Job.provider),
                    selectinload(Job.truck_lock),
                )
                .where(
                    Job.id == existing.job_id
                )
            )
        ).scalars().one()

        return to_output(job)

    # --------------------------------------------------------
    # LOCK JOB
    # --------------------------------------------------------

    job = (
        await db.execute(
            select(Job)
            .options(
                selectinload(Job.truck),
                selectinload(Job.provider),
                selectinload(Job.truck_lock),
            )
            .join(Truck)
            .join(Provider)
            .where(
                Job.id == job_id,
                Provider.user_id == user_id,
            )
            .with_for_update()
        )
    ).scalars().first()

    if not job:
        raise HTTPException(
            status_code=404,
            detail="Reviewable job not found",
        )

    if job.status != JobStatus.AWAITING_PRICE_APPROVAL:
        raise HTTPException(
            status_code=404,
            detail="Reviewable job not found",
        )

    approved = (
        payload.decision == "approved"
    )

    if approved:
        job.status = JobStatus.AWAITING_PAYMENT
        job.approved_price = (
            payload.approved_amount
        )
    else:
        job.status = JobStatus.REJECTED
        job.approved_price = None

        if job.truck_lock:
            job.truck_lock.is_active = False
            db.add(job.truck_lock)

    db.add(
        PriceApproval(
            job_id=job.id,
            provider_user_id=user_id,
            decision=payload.decision,
            approved_amount=(
                payload.approved_amount
                if approved
                else None
            ),
            note=payload.note,
            idempotency_key=payload.idempotency_key,
        )
    )

    db.add(
        AuditEvent(
            actor=str(user_id),
            action="price_" + payload.decision,
            record_type="Job",
            record_id=job.id,
            ip_address=_client_ip(request),
            user_agent=request.headers.get(
                "user-agent"
            ),
        )
    )

    await db.commit()

    # Reload so relationships are available safely.
    job = (
        await db.execute(
            select(Job)
            .options(
                selectinload(Job.truck),
                selectinload(Job.provider),
                selectinload(Job.truck_lock),
            )
            .where(Job.id == job_id)
        )
    ).scalars().first()

    return to_output(job)