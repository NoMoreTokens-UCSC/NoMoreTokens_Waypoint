"""Audit log service — writes every transition and plan decision."""
from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.audit import AuditLog


def log_action(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: str | int,
    actor_user_id: Optional[int] = None,
    before: Optional[dict[str, Any]] = None,
    after: Optional[dict[str, Any]] = None,
) -> None:
    entry = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id),
        before_json=before,
        after_json=after,
    )
    db.add(entry)
    # Flush so the entry is persisted within the same transaction
    db.flush()
