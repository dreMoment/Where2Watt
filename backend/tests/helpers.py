"""Shared fakes for tests that stub httpx clients and Motor cursors."""

from unittest.mock import Mock

from schemas import RATING_FIELDS


class MockAsyncClientContext:
    """Stands in for `httpx.AsyncClient(...)` used as an async context manager."""

    def __init__(self, client):
        self.client = client

    async def __aenter__(self):
        return self.client

    async def __aexit__(self, exc_type, exc, tb):
        return False


class FindCursor:
    """Minimal Motor cursor: supports `.sort()` chaining and `await .to_list()`."""

    def __init__(self, items):
        self.items = items

    def sort(self, *_args, **_kwargs):
        return self

    async def to_list(self, _length=None, **_kwargs):
        return self.items


def rating_totals_aggregate(totals: dict[str, int], ratings_count: int = 1) -> Mock:
    """Fake `segment_ratings.aggregate` returning one grouped row of per-field rating totals."""
    row = {"ratings_count": ratings_count, **{f"{field}_total": totals.get(field, 0) for field in RATING_FIELDS}}
    return Mock(return_value=FindCursor([row]))
