import os
import json
import time
import logging
from typing import Any, Optional
from redis.asyncio import Redis

logger = logging.getLogger(__name__)
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

redis_client: Optional[Redis] = None
_in_memory_store: dict[str, tuple[str, float]] = {}


async def get_redis() -> Redis:
    global redis_client
    if redis_client is None:
        redis_client = Redis.from_url(REDIS_URL, decode_responses=True)
    return redis_client


PENDING_REGISTRATION_TTL_SECONDS = 15 * 60
PENDING_REGISTRATION_PREFIX = "registration:"


async def store_pending_registration(email: str, data: dict[str, Any], otp_hash: str) -> None:
    payload = {
        "registration": data,
        "otp_hash": otp_hash,
    }
    payload_json = json.dumps(payload)
    key = f"{PENDING_REGISTRATION_PREFIX}{email}"
    try:
        client = await get_redis()
        await client.setex(
            key,
            PENDING_REGISTRATION_TTL_SECONDS,
            payload_json,
        )
    except Exception as e:
        logger.warning("Redis unavailable, using in-memory fallback: %s", e)
        _in_memory_store[key] = (payload_json, time.time() + PENDING_REGISTRATION_TTL_SECONDS)


async def get_pending_registration(email: str) -> Optional[dict[str, Any]]:
    key = f"{PENDING_REGISTRATION_PREFIX}{email}"
    try:
        client = await get_redis()
        raw = await client.get(key)
        if raw:
            return json.loads(raw)
    except Exception as e:
        logger.warning("Redis unavailable, using in-memory fallback: %s", e)

    if key in _in_memory_store:
        val, exp = _in_memory_store[key]
        if time.time() < exp:
            return json.loads(val)
        else:
            del _in_memory_store[key]
    return None


async def delete_pending_registration(email: str) -> None:
    key = f"{PENDING_REGISTRATION_PREFIX}{email}"
    try:
        client = await get_redis()
        await client.delete(key)
    except Exception:
        pass
    _in_memory_store.pop(key, None)
