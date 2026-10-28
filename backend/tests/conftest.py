import asyncio

import pytest
from fastapi.testclient import TestClient

from app.core.database import engine
from app.main import app


@pytest.fixture(autouse=True)
def clean_engine():
    asyncio.run(engine.dispose())
    yield
    asyncio.run(engine.dispose())


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
