import time
from collections import defaultdict, deque
from collections.abc import Callable
from threading import Lock

from fastapi import HTTPException, Request, status


class SlidingWindowRateLimiter:
    """Pembatas laju request sederhana berbasis memori per alamat IP klien."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, key: str, max_requests: int, window_seconds: int) -> None:
        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            q = self._hits[key]
            while q and q[0] <= cutoff:
                q.popleft()
            if len(q) >= max_requests:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=(
                        "Terlalu banyak permintaan dari alamat Anda. "
                        "Silakan coba lagi sebentar lagi."
                    ),
                )
            q.append(now)


_limiter = SlidingWindowRateLimiter()


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first_ip = forwarded.split(",")[0].strip()
        if first_ip:
            return first_ip
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def rate_limit(
    max_requests: int, window_seconds: int, key_prefix: str
) -> Callable[[Request], None]:
    """Dependency FastAPI untuk membatasi frekuensi request pada endpoint sensitif."""

    def _dependency(request: Request) -> None:
        client_ip = get_client_ip(request)
        _limiter.check(f"{key_prefix}:{client_ip}", max_requests, window_seconds)

    return _dependency
