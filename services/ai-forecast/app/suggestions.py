"""Buy suggestions: the store and the approval rule.

The forecast maths stays in ``forecast.py`` and is unchanged. This module only
holds what a suggestion *is* and the one state change a person may make to it:
the system proposes a draft, a buyer approves it. Nothing here decides the
numbers.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from typing import Protocol

DRAFT = "draft"
APPROVED = "approved"


class SuggestionError(Exception):
    """Raised when a suggestion may not be changed the way asked."""


@dataclass(frozen=True)
class Suggestion:
    """A proposed purchase. It starts a draft and only a person promotes it."""

    id: str
    units: int
    forecast_units: float
    on_hand: float
    safety: float
    pack: int
    status: str
    created_at: str
    approved_by: str | None = None
    approved_at: str | None = None


def new_suggestion(
    units: int,
    forecast_units: float,
    on_hand: float,
    safety: float,
    pack: int,
    at: str | None = None,
) -> Suggestion:
    """Build a draft suggestion. The units come from the caller's forecast maths."""
    return Suggestion(
        id=str(uuid.uuid4()),
        units=units,
        forecast_units=forecast_units,
        on_hand=on_hand,
        safety=safety,
        pack=pack,
        status=DRAFT,
        created_at=at or datetime.now(timezone.utc).isoformat(),
    )


def approve(suggestion: Suggestion, approved_by: str, at: str | None = None) -> Suggestion:
    """Promote a draft to approved. Only a draft can be approved, and a person must be named."""
    if suggestion.status != DRAFT:
        raise SuggestionError(f"only a draft can be approved, this one is {suggestion.status}")
    if not approved_by:
        raise SuggestionError("an approver must be named")
    return replace(
        suggestion,
        status=APPROVED,
        approved_by=approved_by,
        approved_at=at or datetime.now(timezone.utc).isoformat(),
    )


class SuggestionStore(Protocol):
    """A thin store for suggestions. The in-memory store is the default."""

    def add(self, suggestion: Suggestion) -> Suggestion: ...

    def get(self, suggestion_id: str) -> Suggestion | None: ...

    def list(self, status: str | None = None) -> list[Suggestion]: ...

    def replace(self, suggestion: Suggestion) -> Suggestion: ...


class InMemorySuggestionStore:
    """Suggestions held in a dict, newest first on read."""

    def __init__(self) -> None:
        self._by_id: dict[str, Suggestion] = {}

    def add(self, suggestion: Suggestion) -> Suggestion:
        self._by_id[suggestion.id] = suggestion
        return suggestion

    def get(self, suggestion_id: str) -> Suggestion | None:
        return self._by_id.get(suggestion_id)

    def list(self, status: str | None = None) -> list[Suggestion]:
        rows = [s for s in self._by_id.values() if status is None or s.status == status]
        return sorted(rows, key=lambda s: s.created_at, reverse=True)

    def replace(self, suggestion: Suggestion) -> Suggestion:
        if suggestion.id not in self._by_id:
            raise SuggestionError(f"unknown suggestion {suggestion.id}")
        self._by_id[suggestion.id] = suggestion
        return suggestion
