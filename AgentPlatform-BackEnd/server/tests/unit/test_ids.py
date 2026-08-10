from app.core.ids import create_id


def test_id_carries_its_prefix():
    assert create_id("agent").startswith("agent_")


def test_ids_are_unique():
    assert len({create_id("run") for _ in range(1000)}) == 1000
