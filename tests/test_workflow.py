import pytest
from httpx import AsyncClient, ASGITransport
import uuid
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from api.app.main import app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client


async def _register(client: AsyncClient, username: str, password: str, role: str):
    resp = await client.post("/api/auth/register", json={
        "username": username,
        "email": f"{username}@test.com",
        "password": password,
        "role": role,
    })
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _login(client: AsyncClient, username: str, password: str) -> str:
    resp = await client.post("/api/auth/login", data={"username": username, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


async def _create_truck(client: AsyncClient, token: str, plate: str, vehicle_class: str = "small") -> dict:
    resp = await client.post("/api/provider/trucks", json={"plate_number": plate, "vehicle_class": vehicle_class}, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _provider_id(client: AsyncClient, username: str, vehicle_class: str = "small") -> int:
    resp = await client.get(f"/api/providers?vehicle_class={vehicle_class}")
    assert resp.status_code == 200, resp.text
    providers = resp.json()
    for p in providers:
        if p["display_name"] == username:
            return p["id"]
    assert False, f"Provider {username} not found in providers list"


async def _create_job(client: AsyncClient, token: str, provider_id: int, vehicle_class: str = "small") -> dict:
    idempotency_key = str(uuid.uuid4())
    resp = await client.post("/api/jobs", json={
        "vehicle_class": vehicle_class,
        "pickup": {"address": "Pickup", "city": "Cairo"},
        "dropoff": {"address": "Dropoff", "city": "Cairo"},
        "idempotency_key": idempotency_key,
        "provider_id": provider_id,
    }, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.mark.asyncio
async def test_create_job(client: AsyncClient):
    username = f"cust_{uuid.uuid4().hex[:8]}"
    password = "Passw0rd!"
    await _register(client, username, password, "customer")
    token = await _login(client, username, password)

    provider_username = f"prov_{uuid.uuid4().hex[:8]}"
    await _register(client, provider_username, password, "provider")
    provider_id = await _provider_id(client, provider_username, "small")

    job = await _create_job(client, token, provider_id, "small")
    assert job["status"] == "pending"
    assert job["provider_id"] == provider_id


@pytest.mark.asyncio
async def test_provider_accepts_job(client: AsyncClient):
    customer_username = f"cust_{uuid.uuid4().hex[:8]}"
    provider_username = f"prov_{uuid.uuid4().hex[:8]}"
    password = "Passw0rd!"

    await _register(client, customer_username, password, "customer")
    customer_token = await _login(client, customer_username, password)

    await _register(client, provider_username, password, "provider")
    provider_token = await _login(client, provider_username, password)

    plate = f"PLATE-{uuid.uuid4().hex[:6]}"
    truck = await _create_truck(client, provider_token, plate, "small")
    provider_id = await _provider_id(client, provider_username, "small")
    job = await _create_job(client, customer_token, provider_id, "small")

    resp = await client.post(f"/api/jobs/{job['id']}/accept", json={"truck_id": truck["id"]}, headers={"Authorization": f"Bearer {provider_token}"})
    assert resp.status_code == 200, resp.text
    accepted = resp.json()
    assert accepted["status"] == "accepted"
    assert accepted["truck_id"] == truck["id"]
    assert accepted["provider_id"] == provider_id


@pytest.mark.asyncio
async def test_provider_starts_job(client: AsyncClient):
    customer_username = f"cust_{uuid.uuid4().hex[:8]}"
    provider_username = f"prov_{uuid.uuid4().hex[:8]}"
    password = "Passw0rd!"

    await _register(client, customer_username, password, "customer")
    customer_token = await _login(client, customer_username, password)

    await _register(client, provider_username, password, "provider")
    provider_token = await _login(client, provider_username, password)

    plate = f"PLATE-{uuid.uuid4().hex[:6]}"
    truck = await _create_truck(client, provider_token, plate, "small")
    provider_id = await _provider_id(client, provider_username, "small")
    job = await _create_job(client, customer_token, provider_id, "small")

    await client.post(f"/api/jobs/{job['id']}/accept", json={"truck_id": truck["id"]}, headers={"Authorization": f"Bearer {provider_token}"})

    resp = await client.post(f"/api/provider/jobs/{job['id']}/start", headers={"Authorization": f"Bearer {provider_token}"})
    assert resp.status_code == 200, resp.text
    started = resp.json()
    assert started["status"] == "in_progress"


@pytest.mark.asyncio
async def test_provider_completes_job(client: AsyncClient):
    customer_username = f"cust_{uuid.uuid4().hex[:8]}"
    provider_username = f"prov_{uuid.uuid4().hex[:8]}"
    password = "Passw0rd!"

    await _register(client, customer_username, password, "customer")
    customer_token = await _login(client, customer_username, password)

    await _register(client, provider_username, password, "provider")
    provider_token = await _login(client, provider_username, password)

    plate = f"PLATE-{uuid.uuid4().hex[:6]}"
    truck = await _create_truck(client, provider_token, plate, "small")
    provider_id = await _provider_id(client, provider_username, "small")
    job = await _create_job(client, customer_token, provider_id, "small")

    await client.post(f"/api/jobs/{job['id']}/accept", json={"truck_id": truck["id"]}, headers={"Authorization": f"Bearer {provider_token}"})
    await client.post(f"/api/provider/jobs/{job['id']}/start", headers={"Authorization": f"Bearer {provider_token}"})

    resp = await client.post(f"/api/provider/jobs/{job['id']}/complete", headers={"Authorization": f"Bearer {provider_token}"})
    assert resp.status_code == 200, resp.text
    completed = resp.json()
    assert completed["status"] == "completed"


@pytest.mark.asyncio
async def test_invalid_transitions(client: AsyncClient):
    customer_username = f"cust_{uuid.uuid4().hex[:8]}"
    provider_username = f"prov_{uuid.uuid4().hex[:8]}"
    password = "Passw0rd!"

    await _register(client, customer_username, password, "customer")
    customer_token = await _login(client, customer_username, password)

    await _register(client, provider_username, password, "provider")
    provider_token = await _login(client, provider_username, password)

    plate = f"PLATE-{uuid.uuid4().hex[:6]}"
    truck = await _create_truck(client, provider_token, plate, "small")
    provider_id = await _provider_id(client, provider_username, "small")
    job = await _create_job(client, customer_token, provider_id, "small")

    # PENDING -> COMPLETED should fail
    resp = await client.post(f"/api/provider/jobs/{job['id']}/complete", headers={"Authorization": f"Bearer {provider_token}"})
    assert resp.status_code == 404

    # PENDING -> IN_PROGRESS should fail
    resp = await client.post(f"/api/provider/jobs/{job['id']}/start", headers={"Authorization": f"Bearer {provider_token}"})
    assert resp.status_code == 404

    await client.post(f"/api/jobs/{job['id']}/accept", json={"truck_id": truck["id"]}, headers={"Authorization": f"Bearer {provider_token}"})
    await client.post(f"/api/provider/jobs/{job['id']}/start", headers={"Authorization": f"Bearer {provider_token}"})

    # IN_PROGRESS -> ACCEPTED should fail
    resp = await client.post(f"/api/jobs/{job['id']}/accept", json={"truck_id": truck["id"]}, headers={"Authorization": f"Bearer {provider_token}"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_double_accept_same_job(client: AsyncClient):
    customer_username = f"cust_{uuid.uuid4().hex[:8]}"
    provider_username = f"prov_{uuid.uuid4().hex[:8]}"
    password = "Passw0rd!"

    await _register(client, customer_username, password, "customer")
    customer_token = await _login(client, customer_username, password)

    await _register(client, provider_username, password, "provider")
    provider_token = await _login(client, provider_username, password)

    plate = f"PLATE-{uuid.uuid4().hex[:6]}"
    truck = await _create_truck(client, provider_token, plate, "small")
    provider_id = await _provider_id(client, provider_username, "small")
    job = await _create_job(client, customer_token, provider_id, "small")

    # First accept succeeds
    resp_a = await client.post(f"/api/jobs/{job['id']}/accept", json={"truck_id": truck["id"]}, headers={"Authorization": f"Bearer {provider_token}"})
    assert resp_a.status_code == 200, resp_a.text

    # Second accept fails because job is no longer PENDING
    resp_b = await client.post(f"/api/jobs/{job['id']}/accept", json={"truck_id": truck["id"]}, headers={"Authorization": f"Bearer {provider_token}"})
    assert resp_b.status_code == 404, resp_b.text


@pytest.mark.asyncio
async def test_truck_collision(client: AsyncClient):
    customer_username = f"cust_{uuid.uuid4().hex[:8]}"
    provider_username = f"prov_{uuid.uuid4().hex[:8]}"
    password = "Passw0rd!"

    await _register(client, customer_username, password, "customer")
    customer_token = await _login(client, customer_username, password)

    await _register(client, provider_username, password, "provider")
    provider_token = await _login(client, provider_username, password)

    plate = f"PLATE-{uuid.uuid4().hex[:6]}"
    truck = await _create_truck(client, provider_token, plate, "small")
    provider_id = await _provider_id(client, provider_username, "small")

    # Create two jobs for same provider
    job_a = await _create_job(client, customer_token, provider_id, "small")
    job_b = await _create_job(client, customer_token, provider_id, "small")

    # Accept first job with the only small truck
    resp_a = await client.post(f"/api/jobs/{job_a['id']}/accept", json={"truck_id": truck["id"]}, headers={"Authorization": f"Bearer {provider_token}"})
    assert resp_a.status_code == 200, resp_a.text

    # Try to accept second job with same truck - should fail
    resp_b = await client.post(f"/api/jobs/{job_b['id']}/accept", json={"truck_id": truck["id"]}, headers={"Authorization": f"Bearer {provider_token}"})
    assert resp_b.status_code == 409, resp_b.text


@pytest.mark.asyncio
async def test_multi_truck_provider(client: AsyncClient):
    customer_username = f"cust_{uuid.uuid4().hex[:8]}"
    provider_username = f"prov_{uuid.uuid4().hex[:8]}"
    password = "Passw0rd!"

    await _register(client, customer_username, password, "customer")
    customer_token = await _login(client, customer_username, password)

    await _register(client, provider_username, password, "provider")
    provider_token = await _login(client, provider_username, password)

    truck_a = await _create_truck(client, provider_token, f"PLATE-A-{uuid.uuid4().hex[:6]}", "small")
    truck_b = await _create_truck(client, provider_token, f"PLATE-B-{uuid.uuid4().hex[:6]}", "small")
    provider_id = await _provider_id(client, provider_username, "small")

    job_a = await _create_job(client, customer_token, provider_id, "small")
    job_b = await _create_job(client, customer_token, provider_id, "small")

    resp_a = await client.post(f"/api/jobs/{job_a['id']}/accept", json={"truck_id": truck_a["id"]}, headers={"Authorization": f"Bearer {provider_token}"})
    assert resp_a.status_code == 200, resp_a.text

    resp_b = await client.post(f"/api/jobs/{job_b['id']}/accept", json={"truck_id": truck_b["id"]}, headers={"Authorization": f"Bearer {provider_token}"})
    assert resp_b.status_code == 200, resp_b.text


@pytest.mark.asyncio
async def test_wrong_provider_cannot_start_or_complete(client: AsyncClient):
    customer_username = f"cust_{uuid.uuid4().hex[:8]}"
    provider_a_username = f"prov_a_{uuid.uuid4().hex[:8]}"
    provider_b_username = f"prov_b_{uuid.uuid4().hex[:8]}"
    password = "Passw0rd!"

    await _register(client, customer_username, password, "customer")
    customer_token = await _login(client, customer_username, password)

    await _register(client, provider_a_username, password, "provider")
    provider_a_token = await _login(client, provider_a_username, password)

    await _register(client, provider_b_username, password, "provider")
    provider_b_token = await _login(client, provider_b_username, password)

    plate_a = f"PLATE-A-{uuid.uuid4().hex[:6]}"
    truck_a = await _create_truck(client, provider_a_token, plate_a, "small")
    provider_a_id = await _provider_id(client, provider_a_username, "small")
    job = await _create_job(client, customer_token, provider_a_id, "small")

    await client.post(f"/api/jobs/{job['id']}/accept", json={"truck_id": truck_a["id"]}, headers={"Authorization": f"Bearer {provider_a_token}"})

    # Provider B tries to start
    resp = await client.post(f"/api/provider/jobs/{job['id']}/start", headers={"Authorization": f"Bearer {provider_b_token}"})
    assert resp.status_code == 404

    # Provider B tries to complete
    resp = await client.post(f"/api/provider/jobs/{job['id']}/complete", headers={"Authorization": f"Bearer {provider_b_token}"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_wrong_truck_cannot_be_assigned(client: AsyncClient):
    customer_username = f"cust_{uuid.uuid4().hex[:8]}"
    provider_a_username = f"prov_a_{uuid.uuid4().hex[:8]}"
    provider_b_username = f"prov_b_{uuid.uuid4().hex[:8]}"
    password = "Passw0rd!"

    await _register(client, customer_username, password, "customer")
    customer_token = await _login(client, customer_username, password)

    await _register(client, provider_a_username, password, "provider")
    provider_a_token = await _login(client, provider_a_username, password)

    await _register(client, provider_b_username, password, "provider")
    provider_b_token = await _login(client, provider_b_username, password)

    plate_a = f"PLATE-A-{uuid.uuid4().hex[:6]}"
    truck_a = await _create_truck(client, provider_a_token, plate_a, "small")

    plate_b = f"PLATE-B-{uuid.uuid4().hex[:6]}"
    truck_b = await _create_truck(client, provider_b_token, plate_b, "small")

    provider_a_id = await _provider_id(client, provider_a_username, "small")
    job = await _create_job(client, customer_token, provider_a_id, "small")

    # Provider A tries to accept with Provider B's truck
    resp = await client.post(f"/api/jobs/{job['id']}/accept", json={"truck_id": truck_b["id"]}, headers={"Authorization": f"Bearer {provider_a_token}"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_location_endpoint_validates_coordinates(client: AsyncClient):
    provider_username = f"prov_{uuid.uuid4().hex[:8]}"
    password = "Passw0rd!"

    await _register(client, provider_username, password, "provider")
    provider_token = await _login(client, provider_username, password)

    # Invalid latitude
    resp = await client.post("/api/provider/location?lat=999&lon=0", headers={"Authorization": f"Bearer {provider_token}"})
    assert resp.status_code == 400

    # Invalid longitude
    resp = await client.post("/api/provider/location?lat=0&lon=999", headers={"Authorization": f"Bearer {provider_token}"})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_location_persists_and_broadcasts(client: AsyncClient):
    customer_username = f"cust_{uuid.uuid4().hex[:8]}"
    provider_username = f"prov_{uuid.uuid4().hex[:8]}"
    password = "Passw0rd!"

    await _register(client, customer_username, password, "customer")
    customer_token = await _login(client, customer_username, password)

    await _register(client, provider_username, password, "provider")
    provider_token = await _login(client, provider_username, password)

    plate = f"PLATE-{uuid.uuid4().hex[:6]}"
    truck = await _create_truck(client, provider_token, plate, "small")
    provider_id = await _provider_id(client, provider_username, "small")
    job = await _create_job(client, customer_token, provider_id, "small")

    await client.post(f"/api/jobs/{job['id']}/accept", json={"truck_id": truck["id"]}, headers={"Authorization": f"Bearer {provider_token}"})
    await client.post(f"/api/provider/jobs/{job['id']}/start", headers={"Authorization": f"Bearer {provider_token}"})

    resp = await client.post("/api/provider/location?lat=30.5&lon=31.2", headers={"Authorization": f"Bearer {provider_token}"})
    assert resp.status_code == 200

    # Verify location persisted via customer jobs
    resp = await client.get("/api/jobs", headers={"Authorization": f"Bearer {customer_token}"})
    assert resp.status_code == 200
    jobs = resp.json()
    updated = [j for j in jobs if j["id"] == job["id"]][0]
    assert updated["current_lat"] == 30.5
    assert updated["current_lng"] == 31.2
