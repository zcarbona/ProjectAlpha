from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import Provider, Truck, Job, JobStatus, JobDecline

ACTIVE_JOB_STATUSES = [JobStatus.ACCEPTED, JobStatus.IN_PROGRESS]


async def get_provider_active_job(provider_id: int, db: AsyncSession):
    result = await db.execute(
        select(Job).where(
            Job.provider_id == provider_id,
            Job.status.in_(ACTIVE_JOB_STATUSES)
        )
    )
    return result.scalars().first()


async def is_provider_busy(provider_id: int, db: AsyncSession) -> bool:
    return await get_provider_active_job(provider_id, db) is not None


async def get_eligible_providers_for_job(job: Job, db: AsyncSession):
    occupied = (
        select(1)
        .where(
            Job.truck_id == Truck.id,
            Job.status.in_(ACTIVE_JOB_STATUSES),
        )
        .exists()
    )

    available_truck_exists = (
        select(Truck.id)
        .where(
            Truck.provider_id == Provider.id,
            Truck.is_active.is_(True),
            Truck.vehicle_class == job.vehicle_class,
            ~occupied,
        )
        .exists()
    )

    providers_query = (
        select(Provider)
        .where(
            Provider.is_active.is_(True),
            available_truck_exists,
        )
        .distinct()
    )
    providers = (await db.execute(providers_query)).scalars().all()

    if not providers:
        return []

    declined_provider_ids = await get_declined_provider_ids(job.id, db)
    return [p for p in providers if p.id not in declined_provider_ids]


async def get_declined_provider_ids(job_id: int, db: AsyncSession) -> set[int]:
    result = await db.execute(
        select(JobDecline.provider_id).where(JobDecline.job_id == job_id)
    )
    return set(result.scalars().all())


async def is_provider_eligible_for_job(provider_id: int, job_id: int, db: AsyncSession) -> bool:
    job = (await db.execute(select(Job).where(Job.id == job_id))).scalars().first()
    if not job or job.status != JobStatus.PENDING:
        return False

    provider = (await db.execute(select(Provider).where(Provider.id == provider_id))).scalars().first()
    if not provider or not provider.is_active:
        return False

    occupied = (
        select(1)
        .where(
            Job.truck_id == Truck.id,
            Job.status.in_(ACTIVE_JOB_STATUSES),
        )
        .exists()
    )

    has_available_truck = (
        select(Truck.id)
        .where(
            Truck.provider_id == provider_id,
            Truck.is_active.is_(True),
            Truck.vehicle_class == job.vehicle_class,
            ~occupied,
        )
        .exists()
    )

    result = await db.execute(has_available_truck)
    if not result.scalar():
        return False

    has_declined = (
        select(JobDecline.id)
        .where(
            JobDecline.job_id == job_id,
            JobDecline.provider_id == provider_id
        )
        .exists()
    )

    result = await db.execute(has_declined)
    return not result.scalar()
