import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.container import reset_container
from app.main import create_app


@pytest.fixture(autouse=True)
def _reset_state():
    """Settings and container providers are lru_cached; clear both between tests
    so env overrides take effect and no agent survives into the next test."""
    get_settings.cache_clear()
    reset_container()
    yield
    get_settings.cache_clear()
    reset_container()


@pytest.fixture
def client() -> TestClient:
    # raise_server_exceptions=False so the 500 handler's envelope is asserted as
    # a response rather than re-raised into the test.
    return TestClient(create_app(), raise_server_exceptions=False)
