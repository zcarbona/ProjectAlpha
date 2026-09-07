import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.models.models import Base
from sqlalchemy import select

DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def seed_company_data():
    from app.models.models import Company, VehicleType, City
    async with AsyncSessionLocal() as session:
        existing_company = await session.execute(select(Company))
        if existing_company.scalars().first():
            return

        company = Company(
            name="Naql",
            legal_name="Naql Logistics",
            contact_email="support@naql.com",
            contact_phone="+201000000000",
            address="Cairo, Egypt",
            city="Cairo",
            country="Egypt",
        )
        session.add(company)

        vehicle_types = [
            VehicleType(code="small", label="Small", description="Pickup truck", emoji="🛻", capacity_kg=500, min_price_egp=150, max_price_egp=300, sort_order=1),
            VehicleType(code="medium", label="Medium", description="Van", emoji="🚐", capacity_kg=1500, min_price_egp=300, max_price_egp=500, sort_order=2),
            VehicleType(code="large", label="Large", description="Truck", emoji="🚛", capacity_kg=5000, min_price_egp=500, max_price_egp=1000, sort_order=3),
            VehicleType(code="xl", label="X-Large", description="Big truck", emoji="🚚", capacity_kg=10000, min_price_egp=1000, max_price_egp=2000, sort_order=4),
        ]
        session.add_all(vehicle_types)

        cities = [
            City(name="Cairo", name_ar="القاهرة", latitude=30.0444, longitude=31.2357),
            City(name="Alexandria", name_ar="الإسكندرية", latitude=31.2001, longitude=29.9187),
            City(name="Giza", name_ar="الجيزة", latitude=30.0131, longitude=31.2089),
            City(name="Luxor", name_ar="الأقصر", latitude=25.6872, longitude=32.6396),
            City(name="Aswan", name_ar="أسوان", latitude=24.0889, longitude=32.8998),
            City(name="Port Said", name_ar="بورسعيد", latitude=31.2653, longitude=32.3019),
        ]
        session.add_all(cities)

        await session.commit()
        await seed_mock_data(session)

async def seed_mock_data(session: AsyncSession):
    from app.models.models import User, UserRole, Provider, Truck, Job, JobStatus, Payment
    from app.core.security import get_password_hash

    # Check if mock data already exists
    existing = await session.execute(select(User).where(User.username == "test_customer"))
    if existing.scalars().first():
        return

    # Create users
    customer = User(
        username="test_customer",
        email="customer@naql.com",
        phone_number="+201011111111",
        hashed_password=get_password_hash("password123"),
        role=UserRole.CUSTOMER,
        is_verified=True,
    )

    provider_user = User(
        username="test_provider",
        email="provider@naql.com",
        phone_number="+201022222222",
        hashed_password=get_password_hash("password123"),
        role=UserRole.PROVIDER,
        is_verified=True,
    )
    session.add_all([customer, provider_user])
    await session.flush()

    # Create provider and truck
    provider = Provider(user_id=provider_user.id, display_name="Test Logistics")
    session.add(provider)
    await session.flush()
    
    truck = Truck(provider_id=provider.id, vehicle_class="small", capacity=500, is_active=True)
    session.add(truck)
    await session.flush()

    # Create a job
    job = Job(
        customer_id=customer.id,
        provider_id=provider.id,
        truck_id=truck.id,
        pickup_address="Cairo University",
        dropoff_address="Cairo International Airport",
        requested_min_price=150,
        requested_max_price=300,
        status=JobStatus.AWAITING_PRICE_APPROVAL,
        idempotency_key="mock_job_1",
    )
    session.add(job)
    await session.flush()
    session.add(Payment(job_id=job.id, amount=0, status="not_started"))
    
    await session.commit()
