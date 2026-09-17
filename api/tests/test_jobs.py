import pytest
import pytest_asyncio
import uuid
import asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from app.main import app
from app.models.models import Base, User, UserRole, Provider, Truck, Job, JobStatus, VehicleType
from app.core.security import get_password_hash, create_access_token
from tests.conftest import test_engine, TestingSessionLocal


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


def auth_headers(token: str):
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_create_job_unauthorized():
    payload = {
        "vehicle_class": "small",
        "pickup": {"address": "Pickup", "city": "Cairo"},
        "dropoff": {"address": "Dropoff", "city": "Cairo"},
        "idempotency_key": str(uuid.uuid4()),
        "provider_id": 1,
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/jobs", json=payload)
        assert res.status_code == 401


@pytest.mark.asyncio
async def test_customer_can_create_job():
    async with TestingSessionLocal() as session:
        customer = User(
            id=1,
            username="test_customer",
            email="customer@naql.com",
            phone_number="+201011111111",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.CUSTOMER,
        )
        session.add(customer)
        await session.commit()

    token = create_access_token(subject=1)
    payload = {
        "vehicle_class": "small",
        "pickup": {"address": "Pickup Address", "city": "Cairo"},
        "dropoff": {"address": "Dropoff Address", "city": "Cairo"},
        "idempotency_key": str(uuid.uuid4()),
        "provider_id": 1,
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/jobs", json=payload, headers=auth_headers(token))
        assert res.status_code == 201, res.text
        data = res.json()
        assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_provider_can_accept_and_complete_job():
    async with TestingSessionLocal() as session:
        customer = User(
            username="job_customer",
            email="jobcust@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.CUSTOMER,
        )
        provider_user = User(
            username="job_provider",
            email="jobprov@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.PROVIDER,
        )
        session.add_all([customer, provider_user])
        await session.flush()

        provider = Provider(user_id=provider_user.id, display_name="Job Provider")
        session.add(provider)
        await session.flush()

        vt = VehicleType(code="small", label="Small", description="Pickup", emoji="🛻", capacity_kg=500, sort_order=1)
        session.add(vt)
        await session.flush()

        truck = Truck(provider_id=provider.id, vehicle_class="small", capacity="500", plate_number="XYZ789", is_active=True)
        session.add(truck)
        await session.flush()

        job = Job(
            customer_id=customer.id,
            provider_id=provider.id,
            truck_id=truck.id,
            vehicle_class="small",
            booking_mode="provider_selection",
            pickup_address="Pickup",
            dropoff_address="Dropoff",
            idempotency_key="job_test_1",
            status=JobStatus.PENDING,
        )
        session.add(job)
        await session.commit()
        job_id = job.id
        truck_id = truck.id

    customer_token = create_access_token(subject=customer.id)
    provider_token = create_access_token(subject=provider_user.id)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        accept_res = await client.post(
            f"/api/jobs/{job_id}/accept",
            json={"truck_id": truck_id},
            headers=auth_headers(provider_token),
        )
        assert accept_res.status_code == 200, accept_res.text
        assert accept_res.json()["status"] == "accepted"

        start_res = await client.post(
            f"/api/provider/jobs/{job_id}/start",
            headers=auth_headers(provider_token),
        )
        assert start_res.status_code == 200, start_res.text
        assert start_res.json()["status"] == "in_progress"

        complete_res = await client.post(
            f"/api/provider/jobs/{job_id}/complete",
            headers=auth_headers(provider_token),
        )
        assert complete_res.status_code == 200, complete_res.text
        assert complete_res.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_provider_can_decline_job():
    async with TestingSessionLocal() as session:
        customer = User(
            username="decline_customer",
            email="declcust@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.CUSTOMER,
        )
        provider_user = User(
            username="decline_provider",
            email="declprov@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.PROVIDER,
        )
        session.add_all([customer, provider_user])
        await session.flush()

        provider = Provider(user_id=provider_user.id, display_name="Decline Provider")
        session.add(provider)
        await session.flush()

        job = Job(
            customer_id=customer.id,
            vehicle_class="small",
            booking_mode="provider_selection",
            provider_id=provider.id,
            pickup_address="Pickup",
            dropoff_address="Dropoff",
            idempotency_key="decline_test_1",
            status=JobStatus.PENDING,
        )
        session.add(job)
        await session.commit()
        job_id = job.id

    provider_token = create_access_token(subject=provider_user.id)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            f"/api/jobs/{job_id}/decline",
            headers=auth_headers(provider_token),
        )
        assert res.status_code == 200, res.text


@pytest.mark.asyncio
async def test_one_provider_multiple_trucks_cannot_accept_multiple_jobs():
    async with TestingSessionLocal() as session:
        customer = User(
            username="multi_customer",
            email="multicust@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.CUSTOMER,
        )
        provider_user = User(
            username="multi_provider",
            email="multiprov@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.PROVIDER,
        )
        session.add_all([customer, provider_user])
        await session.flush()

        provider = Provider(user_id=provider_user.id, display_name="Multi Truck Provider")
        session.add(provider)
        await session.flush()

        vt = VehicleType(code="small", label="Small", description="Pickup", emoji="🛻", capacity_kg=500, sort_order=1)
        session.add(vt)
        await session.flush()

        truck1 = Truck(provider_id=provider.id, vehicle_class="small", capacity="500", plate_number="T1", is_active=True)
        truck2 = Truck(provider_id=provider.id, vehicle_class="small", capacity="500", plate_number="T2", is_active=True)
        session.add_all([truck1, truck2])
        await session.flush()

        job1 = Job(
            customer_id=customer.id,
            vehicle_class="small",
            booking_mode="request",
            pickup_address="Pickup1",
            dropoff_address="Dropoff1",
            idempotency_key="multi_job_1",
            status=JobStatus.PENDING,
        )
        job2 = Job(
            customer_id=customer.id,
            vehicle_class="small",
            booking_mode="request",
            pickup_address="Pickup2",
            dropoff_address="Dropoff2",
            idempotency_key="multi_job_2",
            status=JobStatus.PENDING,
        )
        session.add_all([job1, job2])
        await session.commit()
        job1_id = job1.id
        job2_id = job2.id
        truck1_id = truck1.id
        truck2_id = truck2.id

    provider_token = create_access_token(subject=provider_user.id)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        accept_res1 = await client.post(
            f"/api/jobs/{job1_id}/accept",
            json={"truck_id": truck1_id},
            headers=auth_headers(provider_token),
        )
        assert accept_res1.status_code == 200, accept_res1.text
        assert accept_res1.json()["status"] == "accepted"

        start_res = await client.post(
            f"/api/provider/jobs/{job1_id}/start",
            headers=auth_headers(provider_token),
        )
        assert start_res.status_code == 200, start_res.text
        assert start_res.json()["status"] == "in_progress"

        accept_res2 = await client.post(
            f"/api/jobs/{job2_id}/accept",
            json={"truck_id": truck2_id},
            headers=auth_headers(provider_token),
        )
        assert accept_res2.status_code == 409, accept_res2.text

        complete_res = await client.post(
            f"/api/provider/jobs/{job1_id}/complete",
            headers=auth_headers(provider_token),
        )
        assert complete_res.status_code == 200, complete_res.text

        accept_res3 = await client.post(
            f"/api/jobs/{job2_id}/accept",
            json={"truck_id": truck2_id},
            headers=auth_headers(provider_token),
        )
        assert accept_res3.status_code == 200, accept_res3.text


@pytest.mark.asyncio
async def test_two_concurrent_acceptances_only_one_succeeds():
    async with TestingSessionLocal() as session:
        customer = User(
            username="concurrent_customer",
            email="concust@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.CUSTOMER,
        )
        provider_user = User(
            username="concurrent_provider",
            email="conprov@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.PROVIDER,
        )
        session.add_all([customer, provider_user])
        await session.flush()

        provider = Provider(user_id=provider_user.id, display_name="Concurrent Provider")
        session.add(provider)
        await session.flush()

        vt = VehicleType(code="small", label="Small", description="Pickup", emoji="🛻", capacity_kg=500, sort_order=1)
        session.add(vt)
        await session.flush()

        truck1 = Truck(provider_id=provider.id, vehicle_class="small", capacity="500", plate_number="C1", is_active=True)
        truck2 = Truck(provider_id=provider.id, vehicle_class="small", capacity="500", plate_number="C2", is_active=True)
        session.add_all([truck1, truck2])
        await session.flush()

        job1 = Job(
            customer_id=customer.id,
            vehicle_class="small",
            booking_mode="request",
            pickup_address="Pickup1",
            dropoff_address="Dropoff1",
            idempotency_key="concurrent_job_1",
            status=JobStatus.PENDING,
        )
        job2 = Job(
            customer_id=customer.id,
            vehicle_class="small",
            booking_mode="request",
            pickup_address="Pickup2",
            dropoff_address="Dropoff2",
            idempotency_key="concurrent_job_2",
            status=JobStatus.PENDING,
        )
        session.add_all([job1, job2])
        await session.commit()
        job1_id = job1.id
        job2_id = job2.id
        truck1_id = truck1.id
        truck2_id = truck2.id

    provider_token = create_access_token(subject=provider_user.id)
    transport = ASGITransport(app=app)

    async def accept_job1():
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.post(
                f"/api/jobs/{job1_id}/accept",
                json={"truck_id": truck1_id},
                headers=auth_headers(provider_token),
            )

    async def accept_job2():
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.post(
                f"/api/jobs/{job2_id}/accept",
                json={"truck_id": truck2_id},
                headers=auth_headers(provider_token),
            )

    res1, res2 = await asyncio.gather(accept_job1(), accept_job2())
    statuses = sorted([res1.status_code, res2.status_code])
    assert statuses == [200, 409]


@pytest.mark.asyncio
async def test_one_provider_decline_leaves_job_pending():
    async with TestingSessionLocal() as session:
        customer = User(
            username="decline1_customer",
            email="decline1cust@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.CUSTOMER,
        )
        provider_a = User(
            username="decline1_provider_a",
            email="decline1prov_a@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.PROVIDER,
        )
        provider_b = User(
            username="decline1_provider_b",
            email="decline1prov_b@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.PROVIDER,
        )
        session.add_all([customer, provider_a, provider_b])
        await session.flush()

        p_a = Provider(user_id=provider_a.id, display_name="Decliner A")
        p_b = Provider(user_id=provider_b.id, display_name="Decliner B")
        session.add_all([p_a, p_b])
        await session.flush()

        vt = VehicleType(code="small", label="Small", description="Pickup", emoji="🛻", capacity_kg=500, sort_order=1)
        session.add(vt)
        await session.flush()

        t_a = Truck(provider_id=p_a.id, vehicle_class="small", capacity="500", plate_number="DA1", is_active=True)
        t_b = Truck(provider_id=p_b.id, vehicle_class="small", capacity="500", plate_number="DB1", is_active=True)
        session.add_all([t_a, t_b])
        await session.flush()

        job = Job(
            customer_id=customer.id,
            vehicle_class="small",
            booking_mode="request",
            pickup_address="Pickup",
            dropoff_address="Dropoff",
            idempotency_key="decline1_test",
            status=JobStatus.PENDING,
        )
        session.add(job)
        await session.commit()
        job_id = job.id

    token_a = create_access_token(subject=provider_a.id)
    token_b = create_access_token(subject=provider_b.id)
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res_a = await client.post(
            f"/api/jobs/{job_id}/decline",
            headers=auth_headers(token_a),
        )
        assert res_a.status_code == 200, res_a.text

        requests_b = await client.get(
            "/api/provider/requests",
            headers=auth_headers(token_b),
        )
        assert requests_b.status_code == 200
        assert any(j["id"] == job_id for j in requests_b.json()), "Job should still be available to B"

        requests_a = await client.get(
            "/api/provider/requests",
            headers=auth_headers(token_a),
        )
        assert requests_a.status_code == 200
        assert not any(j["id"] == job_id for j in requests_a.json()), "Job should not be visible to A after decline"


@pytest.mark.asyncio
async def test_two_providers_decline_leaves_job_pending():
    async with TestingSessionLocal() as session:
        customer = User(
            username="decline2_customer",
            email="decline2cust@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.CUSTOMER,
        )
        provider_a = User(
            username="decline2_provider_a",
            email="decline2prov_a@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.PROVIDER,
        )
        provider_b = User(
            username="decline2_provider_b",
            email="decline2prov_b@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.PROVIDER,
        )
        provider_c = User(
            username="decline2_provider_c",
            email="decline2prov_c@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.PROVIDER,
        )
        session.add_all([customer, provider_a, provider_b, provider_c])
        await session.flush()

        p_a = Provider(user_id=provider_a.id, display_name="Decliner2 A")
        p_b = Provider(user_id=provider_b.id, display_name="Decliner2 B")
        p_c = Provider(user_id=provider_c.id, display_name="Decliner2 C")
        session.add_all([p_a, p_b, p_c])
        await session.flush()

        vt = VehicleType(code="small", label="Small", description="Pickup", emoji="🛻", capacity_kg=500, sort_order=1)
        session.add(vt)
        await session.flush()

        for p in [p_a, p_b, p_c]:
            t = Truck(provider_id=p.id, vehicle_class="small", capacity="500", plate_number=f"D2{p.id}", is_active=True)
            session.add(t)
        await session.flush()

        job = Job(
            customer_id=customer.id,
            vehicle_class="small",
            booking_mode="request",
            pickup_address="Pickup",
            dropoff_address="Dropoff",
            idempotency_key="decline2_test",
            status=JobStatus.PENDING,
        )
        session.add(job)
        await session.commit()
        job_id = job.id

    token_a = create_access_token(subject=provider_a.id)
    token_b = create_access_token(subject=provider_b.id)
    token_c = create_access_token(subject=provider_c.id)
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for token in [token_a, token_b]:
            res = await client.post(
                f"/api/jobs/{job_id}/decline",
                headers=auth_headers(token),
            )
            assert res.status_code == 200, res.text

        job_res = await client.get(f"/api/jobs/{job_id}", headers=auth_headers(token_a))
        assert job_res.status_code == 404

        requests_c = await client.get(
            "/api/provider/requests",
            headers=auth_headers(token_c),
        )
        assert requests_c.status_code == 200
        assert any(j["id"] == job_id for j in requests_c.json()), "Job should still be available to C"


@pytest.mark.asyncio
async def test_all_providers_decline_transitions_to_declined():
    async with TestingSessionLocal() as session:
        customer = User(
            username="decline3_customer",
            email="decline3cust@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.CUSTOMER,
        )
        provider_a = User(
            username="decline3_provider_a",
            email="decline3prov_a@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.PROVIDER,
        )
        provider_b = User(
            username="decline3_provider_b",
            email="decline3prov_b@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.PROVIDER,
        )
        provider_c = User(
            username="decline3_provider_c",
            email="decline3prov_c@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.PROVIDER,
        )
        session.add_all([customer, provider_a, provider_b, provider_c])
        await session.flush()

        p_a = Provider(user_id=provider_a.id, display_name="Decliner3 A")
        p_b = Provider(user_id=provider_b.id, display_name="Decliner3 B")
        p_c = Provider(user_id=provider_c.id, display_name="Decliner3 C")
        session.add_all([p_a, p_b, p_c])
        await session.flush()

        vt = VehicleType(code="small", label="Small", description="Pickup", emoji="🛻", capacity_kg=500, sort_order=1)
        session.add(vt)
        await session.flush()

        for p in [p_a, p_b, p_c]:
            t = Truck(provider_id=p.id, vehicle_class="small", capacity="500", plate_number=f"D3{p.id}", is_active=True)
            session.add(t)
        await session.flush()

        job = Job(
            customer_id=customer.id,
            vehicle_class="small",
            booking_mode="request",
            pickup_address="Pickup",
            dropoff_address="Dropoff",
            idempotency_key="decline3_test",
            status=JobStatus.PENDING,
        )
        session.add(job)
        await session.commit()
        job_id = job.id

    token_a = create_access_token(subject=provider_a.id)
    token_b = create_access_token(subject=provider_b.id)
    token_c = create_access_token(subject=provider_c.id)
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for token in [token_a, token_b, token_c]:
            res = await client.post(
                f"/api/jobs/{job_id}/decline",
                headers=auth_headers(token),
            )
            assert res.status_code == 200, res.text

        customer_token = create_access_token(subject=customer.id)
        jobs_res = await client.get("/api/jobs", headers=auth_headers(customer_token))
        assert jobs_res.status_code == 200
        job_data = next(j for j in jobs_res.json() if j["id"] == job_id)
        assert job_data["status"] == "declined"


@pytest.mark.asyncio
async def test_declined_provider_no_longer_sees_job():
    async with TestingSessionLocal() as session:
        customer = User(
            username="decline4_customer",
            email="decline4cust@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.CUSTOMER,
        )
        provider_a = User(
            username="decline4_provider_a",
            email="decline4prov_a@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.PROVIDER,
        )
        session.add_all([customer, provider_a])
        await session.flush()

        p_a = Provider(user_id=provider_a.id, display_name="Decliner4 A")
        session.add(p_a)
        await session.flush()

        vt = VehicleType(code="small", label="Small", description="Pickup", emoji="🛻", capacity_kg=500, sort_order=1)
        session.add(vt)
        await session.flush()

        t_a = Truck(provider_id=p_a.id, vehicle_class="small", capacity="500", plate_number="D4A", is_active=True)
        session.add(t_a)
        await session.flush()

        job = Job(
            customer_id=customer.id,
            vehicle_class="small",
            booking_mode="request",
            pickup_address="Pickup",
            dropoff_address="Dropoff",
            idempotency_key="decline4_test",
            status=JobStatus.PENDING,
        )
        session.add(job)
        await session.commit()
        job_id = job.id

    token_a = create_access_token(subject=provider_a.id)
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(
            f"/api/jobs/{job_id}/decline",
            headers=auth_headers(token_a),
        )
        assert res.status_code == 200, res.text

        requests_a = await client.get(
            "/api/provider/requests",
            headers=auth_headers(token_a),
        )
        assert requests_a.status_code == 200
        assert not any(j["id"] == job_id for j in requests_a.json()), "Declined provider should not see the job"


@pytest.mark.asyncio
async def test_busy_provider_not_counted_as_eligible():
    async with TestingSessionLocal() as session:
        customer = User(
            username="busy_customer",
            email="busycust@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.CUSTOMER,
        )
        provider_a = User(
            username="busy_provider_a",
            email="busyprov_a@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.PROVIDER,
        )
        provider_b = User(
            username="busy_provider_b",
            email="busyprov_b@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.PROVIDER,
        )
        session.add_all([customer, provider_a, provider_b])
        await session.flush()

        p_a = Provider(user_id=provider_a.id, display_name="Busy A")
        p_b = Provider(user_id=provider_b.id, display_name="Available B")
        session.add_all([p_a, p_b])
        await session.flush()

        vt = VehicleType(code="small", label="Small", description="Pickup", emoji="🛻", capacity_kg=500, sort_order=1)
        session.add(vt)
        await session.flush()

        t_a = Truck(provider_id=p_a.id, vehicle_class="small", capacity="500", plate_number="BA1", is_active=True)
        t_b = Truck(provider_id=p_b.id, vehicle_class="small", capacity="500", plate_number="BB1", is_active=True)
        session.add_all([t_a, t_b])
        await session.flush()

        existing_job = Job(
            customer_id=customer.id,
            provider_id=p_a.id,
            vehicle_class="small",
            booking_mode="request",
            pickup_address="Pickup",
            dropoff_address="Dropoff",
            idempotency_key="busy_existing",
            status=JobStatus.IN_PROGRESS,
        )
        job = Job(
            customer_id=customer.id,
            vehicle_class="small",
            booking_mode="request",
            pickup_address="Pickup",
            dropoff_address="Dropoff",
            idempotency_key="busy_test",
            status=JobStatus.PENDING,
        )
        session.add_all([existing_job, job])
        await session.commit()
        job_id = job.id

    token_a = create_access_token(subject=provider_a.id)
    token_b = create_access_token(subject=provider_b.id)
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        requests_a = await client.get(
            "/api/provider/requests",
            headers=auth_headers(token_a),
        )
        assert requests_a.status_code == 200
        assert not any(j["id"] == job_id for j in requests_a.json()), "Busy provider should not see job"

        requests_b = await client.get(
            "/api/provider/requests",
            headers=auth_headers(token_b),
        )
        assert requests_b.status_code == 200
        assert any(j["id"] == job_id for j in requests_b.json()), "Available provider should see job"


@pytest.mark.asyncio
async def test_concurrent_final_declines_result_in_declined():
    async with TestingSessionLocal() as session:
        customer = User(
            username="conc_decline_customer",
            email="concdeclcust@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.CUSTOMER,
        )
        provider_a = User(
            username="conc_decline_provider_a",
            email="concdeclprov_a@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.PROVIDER,
        )
        provider_b = User(
            username="conc_decline_provider_b",
            email="concdeclprov_b@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.PROVIDER,
        )
        provider_c = User(
            username="conc_decline_provider_c",
            email="concdeclprov_c@naql.com",
            hashed_password=get_password_hash("SecurePass123!"),
            role=UserRole.PROVIDER,
        )
        session.add_all([customer, provider_a, provider_b, provider_c])
        await session.flush()

        p_a = Provider(user_id=provider_a.id, display_name="Conc A")
        p_b = Provider(user_id=provider_b.id, display_name="Conc B")
        p_c = Provider(user_id=provider_c.id, display_name="Conc C")
        session.add_all([p_a, p_b, p_c])
        await session.flush()

        vt = VehicleType(code="small", label="Small", description="Pickup", emoji="🛻", capacity_kg=500, sort_order=1)
        session.add(vt)
        await session.flush()

        for p in [p_a, p_b, p_c]:
            t = Truck(provider_id=p.id, vehicle_class="small", capacity="500", plate_number=f"CD{p.id}", is_active=True)
            session.add(t)
        await session.flush()

        job = Job(
            customer_id=customer.id,
            vehicle_class="small",
            booking_mode="request",
            pickup_address="Pickup",
            dropoff_address="Dropoff",
            idempotency_key="conc_decline_test",
            status=JobStatus.PENDING,
        )
        session.add(job)
        await session.commit()
        job_id = job.id

    token_a = create_access_token(subject=provider_a.id)
    token_b = create_access_token(subject=provider_b.id)
    token_c = create_access_token(subject=provider_c.id)
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res_a = await client.post(
            f"/api/jobs/{job_id}/decline",
            headers=auth_headers(token_a),
        )
        assert res_a.status_code == 200, res_a.text

    async def decline_b():
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.post(
                f"/api/jobs/{job_id}/decline",
                headers=auth_headers(token_b),
            )

    async def decline_c():
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.post(
                f"/api/jobs/{job_id}/decline",
                headers=auth_headers(token_c),
            )

    res_b, res_c = await asyncio.gather(decline_b(), decline_c())
    assert res_b.status_code == 200, res_b.text
    assert res_c.status_code == 200, res_c.text

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        customer_token = create_access_token(subject=customer.id)
        jobs_res = await client.get("/api/jobs", headers=auth_headers(customer_token))
        assert jobs_res.status_code == 200
        job_data = next((j for j in jobs_res.json() if j["id"] == job_id), None)
        assert job_data is not None
        assert job_data["status"] == "declined"
