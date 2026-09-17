import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.main import app
from app.models.models import Base, User, UserRole, Provider, Truck, VehicleType, ProviderFleet
from app.core.security import get_password_hash, create_access_token
from tests.conftest import test_engine, TestingSessionLocal


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        provider_user = User(
            username="test_provider",
            email="provider@naql.com",
            phone_number="+201022222222",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.PROVIDER,
        )
        session.add(provider_user)
        await session.flush()

        provider = Provider(user_id=provider_user.id, display_name="Test Logistics")
        session.add(provider)
        await session.flush()

        vt = VehicleType(code="small", label="Small", description="Pickup", emoji="🛻", capacity_kg=500, sort_order=1)
        session.add(vt)
        await session.flush()

        truck = Truck(provider_id=provider.id, vehicle_class="small", capacity="500", plate_number="INIT1", is_active=True)
        session.add(truck)
        await session.commit()

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


def auth_headers(token: str):
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_provider_can_update_availability():
    token = create_access_token(subject=1)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/provider/status", json={"is_available": False}, headers=auth_headers(token))
        assert res.status_code == 200, res.text
        assert res.json()["is_available"] is False


@pytest.mark.asyncio
async def test_provider_can_create_truck():
    token = create_access_token(subject=1)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            "/api/provider/trucks",
            json={"plate_number": "TRUCK1", "vehicle_class": "small", "is_active": True},
            headers=auth_headers(token),
        )
        assert res.status_code == 201, res.text
        data = res.json()
        assert data["plate_number"] == "TRUCK1"
        assert data["vehicle_class"] == "small"


@pytest.mark.asyncio
async def test_provider_can_list_trucks():
    token = create_access_token(subject=1)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/provider/trucks", headers=auth_headers(token))
        assert res.status_code == 200, res.text
        data = res.json()
        assert len(data) >= 1


@pytest.mark.asyncio
async def test_provider_can_update_fleet():
    token = create_access_token(subject=1)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.patch(
            "/api/provider/fleet/1",
            json={"quantity": 5, "is_active": True},
            headers=auth_headers(token),
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["quantity"] == 5
