import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app


@pytest.fixture(autouse=True)
def _reset_settings_cache():
    """Settings are lru_cached; clear between tests so env overrides take effect."""
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def client() -> TestClient:
    # raise_server_exceptions=False so the 500 handler's envelope is asserted as
    # a response rather than re-raised into the test.
    return TestClient(create_app(), raise_server_exceptions=False)
