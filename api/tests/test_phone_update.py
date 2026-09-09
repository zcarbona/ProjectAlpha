import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy import select

os.environ["SECRET_KEY"] = "supersecretkeyformtestingphoneupdates123456"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"

from app.main import app
from app.core.database import get_db
from app.models.models import Base, User, UserRole
from app.core.security import get_password_hash, create_access_token

test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)

async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session

app.dependency_overrides[get_db] = override_get_db

@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with TestingSessionLocal() as session:
        # Seed customer (id 10)
        c_user = User(
            id=10,
            username="customer_user",
            email="customer@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.CUSTOMER,
            phone_number=None,
        )
        # Seed provider (id 20)
        p_user = User(
            id=20,
            username="provider_user",
            email="provider@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.PROVIDER,
            phone_number=None,
        )
        # Seed another user (id 30) with an existing phone number
        other_user = User(
            id=30,
            username="other_user",
            email="other@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.CUSTOMER,
            phone_number="+2010111111111",
        )
        session.add_all([c_user, p_user, other_user])
        await session.commit()
        
    yield
    
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.mark.asyncio
async def test_customer_updates_own_phone():
    token = create_access_token(subject=10)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.patch(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            json={"phone_number": "+2010123456789"},
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["id"] == 10
        assert data["phone_number"] == "+2010123456789"
        assert data["email"] == "customer@naql.com"
        assert data["username"] == "customer_user"

    # Verify directly in database
    async with TestingSessionLocal() as session:
        user = (await session.execute(select(User).where(User.id == 10))).scalars().first()
        assert user.phone_number == "+2010123456789"

@pytest.mark.asyncio
async def test_provider_updates_own_phone():
    token = create_access_token(subject=20)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.patch(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            json={"phone_number": "+2010987654321"},
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["id"] == 20
        assert data["phone_number"] == "+2010987654321"
        assert data["role"] == "provider"

    async with TestingSessionLocal() as session:
        user = (await session.execute(select(User).where(User.id == 20))).scalars().first()
        assert user.phone_number == "+2010987654321"

@pytest.mark.asyncio
async def test_update_existing_phone_number():
    # User 10 adds phone then replaces it
    token = create_access_token(subject=10)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res1 = await client.patch(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            json={"phone_number": "+2010123456789"},
        )
        assert res1.status_code == 200
        
        res2 = await client.patch(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            json={"phone_number": "+2010555555555"},
        )
        assert res2.status_code == 200
        assert res2.json()["phone_number"] == "+2010555555555"

    async with TestingSessionLocal() as session:
        user = (await session.execute(select(User).where(User.id == 10))).scalars().first()
        assert user.phone_number == "+2010555555555"

@pytest.mark.asyncio
async def test_attempt_to_specify_another_user_id_rejected():
    # Request containing user_id must be rejected (422) by schema
    token = create_access_token(subject=10)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.patch(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            json={"user_id": 30, "phone_number": "+201000000000"},
        )
        assert res.status_code == 422

    # Verify user 30 was not altered
    async with TestingSessionLocal() as session:
        user30 = (await session.execute(select(User).where(User.id == 30))).scalars().first()
        assert user30.phone_number == "+2010111111111"

@pytest.mark.asyncio
async def test_attempt_to_escalate_role_rejected():
    token = create_access_token(subject=10)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.patch(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            json={"role": "admin"},
        )
        assert res.status_code == 422

    async with TestingSessionLocal() as session:
        user10 = (await session.execute(select(User).where(User.id == 10))).scalars().first()
        assert user10.role == UserRole.CUSTOMER

@pytest.mark.asyncio
async def test_no_jwt_returns_401():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.patch(
            "/api/auth/me",
            json={"phone_number": "+2010123456789"},
        )
        assert res.status_code == 401

@pytest.mark.asyncio
async def test_invalid_jwt_returns_401():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.patch(
            "/api/auth/me",
            headers={"Authorization": "Bearer invalid.fake.token"},
            json={"phone_number": "+2010123456789"},
        )
        assert res.status_code == 401

@pytest.mark.asyncio
async def test_duplicate_phone_number_returns_409():
    # User 30 already has +2010111111111. User 10 tries to claim it.
    token = create_access_token(subject=10)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.patch(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            json={"phone_number": "+2010111111111"},
        )
        assert res.status_code == 409
        assert "already in use" in res.text

@pytest.mark.asyncio
async def test_partial_update_preserves_other_fields():
    token = create_access_token(subject=10)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.patch(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            json={"phone_number": "+2010777777777"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["username"] == "customer_user"
        assert data["email"] == "customer@naql.com"

    async with TestingSessionLocal() as session:
        user = (await session.execute(select(User).where(User.id == 10))).scalars().first()
        assert user.username == "customer_user"
        assert user.email == "customer@naql.com"
        assert user.phone_number == "+2010777777777"

@pytest.mark.asyncio
async def test_invalid_phone_regex_rejected():
    token = create_access_token(subject=10)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Letters
        res1 = await client.patch(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            json={"phone_number": "invalid_phone"},
        )
        assert res1.status_code == 422

        # Missing leading digit
        res2 = await client.patch(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            json={"phone_number": "+0123456"},
        )
        assert res2.status_code == 422

@pytest.mark.asyncio
async def test_password_update_independent_and_hashed():
    from app.core.security import verify_password
    token = create_access_token(subject=10)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # First set a phone number
        await client.patch(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            json={"phone_number": "+2010123456789"},
        )

        # Update password only
        res = await client.patch(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            json={"password": "NewStrongPassword123!"},
        )
        assert res.status_code == 200

    # Verify password was hashed and phone number unchanged
    async with TestingSessionLocal() as session:
        user = (await session.execute(select(User).where(User.id == 10))).scalars().first()
        assert user.phone_number == "+2010123456789"
        assert verify_password("NewStrongPassword123!", user.hashed_password)
        assert not verify_password("SecurePass123!", user.hashed_password)

