import pytest
from httpx import AsyncClient, ASGITransport
import uuid

@pytest.mark.asyncio
async def test_create_job_unauthorized(client: AsyncClient):
    payload = {
        "vehicle_class": "pickup",
        "pickup": {
            "place_id": "1",
            "address": "Pickup Address",
            "lat": 0.0,
            "lng": 0.0
        },
        "dropoff": {
            "place_id": "2",
            "address": "Dropoff Address",
            "lat": 0.0,
            "lng": 0.0
        },
        "requested_min_price": 10.0,
        "requested_max_price": 20.0,
        "idempotency_key": str(uuid.uuid4())
    }
    response = await client.post("/api/jobs", json=payload)
    assert response.status_code == 401
