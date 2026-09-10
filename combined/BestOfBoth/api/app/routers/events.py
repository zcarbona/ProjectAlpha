import asyncio
import json
from typing import Dict, Set
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from app.core.security import get_current_user
from app.models.models import User

router = APIRouter(tags=["events"])


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, Set[asyncio.Queue]] = {}

    async def connect(self, user_id: int) -> asyncio.Queue:
        queue = asyncio.Queue()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(queue)
        return queue

    def disconnect(self, user_id: int, queue: asyncio.Queue):
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(queue)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def broadcast(self, user_id: int, message: dict):
        if user_id in self.active_connections:
            for queue in self.active_connections[user_id]:
                await queue.put(message)


manager = ConnectionManager()


@router.get("/events/stream")
async def event_stream(request: Request, user: User = Depends(get_current_user)):
    queue = await manager.connect(user.id)

    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                message = await queue.get()
                yield f"data: {json.dumps(message)}\n\n"
        finally:
            manager.disconnect(user.id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )
