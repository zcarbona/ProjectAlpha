from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user, require_role, _client_ip
from app.models.models import Company, VehicleType, City, User, UserRole, AuditEvent, Job

router = APIRouter(tags=["company"])


@router.get("/company")
async def get_company(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Company).where(Company.is_active.is_(True)).limit(1))
    company = result.scalars().first()
    if not company:
        return {
            "name": "Naql",
            "legal_name": "Naql Logistics",
            "country": "Egypt",
            "city": "Cairo",
            "contact_email": "support@naql.com",
            "contact_phone": "+201000000000",
        }
    return {
        "name": company.name,
        "legal_name": company.legal_name,
        "country": company.country,
        "city": company.city,
        "contact_email": company.contact_email,
        "contact_phone": company.contact_phone,
    }


@router.get("/vehicle-types")
async def get_vehicle_types(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(VehicleType).where(VehicleType.is_active.is_(True)).order_by(VehicleType.sort_order))
    types = result.scalars().all()
    return [
        {
            "id": t.id,
            "code": t.code,
            "label": t.label,
            "description": t.description,
            "emoji": t.emoji,
            "capacity": f"Up to {t.capacity_kg:,} kg" if t.capacity_kg else None,
            "priceRange": f"{t.min_price_egp}–{t.max_price_egp}" if t.min_price_egp and t.max_price_egp else None,
        }
        for t in types
    ]


@router.get("/cities")
async def get_cities(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(City).where(City.is_active.is_(True)).order_by(City.name))
    cities = result.scalars().all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "nameAr": c.name_ar,
            "latitude": c.latitude,
            "longitude": c.longitude,
        }
        for c in cities
    ]


@router.get("/admin/stats")
async def get_admin_stats(request: Request, user: User = Depends(require_role(UserRole.ADMIN)), db: AsyncSession = Depends(get_db)):
    users_count = (await db.execute(select(User.id))).scalars().all()
    jobs_count = (await db.execute(select(Job.id))).scalars().all()
    active_jobs = [j for j in jobs_count if j is not None]

    db.add(AuditEvent(actor=str(user.id), action="view_admin_stats", record_type="Admin", record_id=None, ip_address=_client_ip(request), user_agent=request.headers.get("user-agent")))
    await db.commit()

    return {
        "activeUsers": len(users_count),
        "requestsToday": len(active_jobs),
        "revenueEGP": sum(getattr(j, "approved_price", 0) or 0 for j in active_jobs) if active_jobs else 0,
        "driverAcceptanceRate": "87%",
    }


@router.get("/admin/requests")
async def get_admin_requests(request: Request, user: User = Depends(require_role(UserRole.ADMIN)), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Job).order_by(Job.created_at.desc()).limit(50))
    jobs = result.scalars().all()
    
    # Pre-fetch customers to avoid N+1 queries and null pointer issues
    customer_ids = [j.customer_id for j in jobs]
    customers = {}
    if customer_ids:
        customer_results = await db.execute(select(User).where(User.id.in_(customer_ids)))
        for c in customer_results.scalars().all():
            customers[c.id] = c.username or "Customer"
    
    output = [
        {
            "id": f"#{j.id}",
            "customer": customers.get(j.customer_id, "Customer"),
            "from": j.pickup_address or "Unknown",
            "to": j.dropoff_address or "Unknown",
            "status": j.status.value,
            "amount": j.approved_price or j.requested_max_price or 0,
        }
        for j in jobs
    ]

    db.add(AuditEvent(actor=str(user.id), action="view_admin_requests", record_type="Admin", record_id=None, ip_address=_client_ip(request), user_agent=request.headers.get("user-agent")))
    await db.commit()

    return output


@router.get("/admin/drivers")
async def get_admin_drivers(request: Request, user: User = Depends(require_role(UserRole.ADMIN)), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.role == "provider"))
    providers = result.scalars().all()
    output = [
        {
            "name": p.username or "Driver",
            "trips": 0,
            "rating": 4.5,
            "status": "online",
            "earnings": "0",
        }
        for p in providers
    ]

    db.add(AuditEvent(actor=str(user.id), action="view_admin_drivers", record_type="Admin", record_id=None, ip_address=_client_ip(request), user_agent=request.headers.get("user-agent")))
    await db.commit()

    return output