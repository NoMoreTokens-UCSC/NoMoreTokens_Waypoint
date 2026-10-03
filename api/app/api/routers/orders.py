"""Orders router — store managers place orders; dispatchers manage them."""
from __future__ import annotations

import datetime as dt
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.api.deps import CurrentUser, DbDep, require_role
from app.core import clock
from app.models.audit import AuditLog
from app.models.deferral import Deferral
from app.models.issue import Issue
from app.models.order import Order, OrderLine
from app.models.receipt import Receipt
from app.schemas.order import (
    DeferralHistoryOut,
    IssueCreate,
    OrderCreate,
    OrderOut,
    ReceiptCreate,
)
from app.services.audit import log_action
from app.services.state_machine import transition_order

router = APIRouter(prefix="/orders", tags=["orders"])


def _generate_reference(db: Session, delivery_date: dt.date) -> str:
    count = (
        db.query(func.count(Order.id))
        .filter(Order.delivery_date == delivery_date)
        .scalar()
        or 0
    )
    return f"ORD-{delivery_date.strftime('%Y%m%d')}-{count + 1:04d}"


# ---------------------------------------------------------------------------
# Store manager: create orders for own outlet
# ---------------------------------------------------------------------------


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(
    body: OrderCreate,
    db: DbDep,
    current_user: CurrentUser,
    _: None = require_role("STORE_MANAGER", "DISPATCHER"),
):
    # Store managers can only place orders for their own outlet
    if current_user.role == "STORE_MANAGER" and body.outlet_id != current_user.outlet_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "You can only place orders for your own outlet."},
        )

    past_cutoff = clock.is_past_cutoff()
    order = Order(
        reference=_generate_reference(db, body.delivery_date),
        outlet_id=body.outlet_id,
        brand=body.brand,
        temperature_class=body.temperature_class,
        delivery_date=body.delivery_date,
        status="PLACED",
        total_weight=body.total_weight,
        total_volume=body.total_volume,
        total_cases=body.total_cases,
        priority=body.priority,
        placed_at=clock.now(),
        cutoff_missed=past_cutoff,
        placed_by_user_id=current_user.id,
        notes=body.notes,
    )
    db.add(order)
    db.flush()

    for line in body.lines:
        db.add(OrderLine(order_id=order.id, **line.model_dump()))

    log_action(db, "CREATE_ORDER", "Order", order.id, actor_user_id=current_user.id,
               after={"reference": order.reference, "status": order.status})
    db.commit()
    db.refresh(order)
    return order


@router.get("", response_model=list[OrderOut])
def list_orders(
    db: DbDep,
    current_user: CurrentUser,
    date: Optional[dt.date] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    outlet_id: Optional[str] = Query(None),
):
    q = db.query(Order).options(selectinload(Order.lines))

    # RBAC scoping
    if current_user.role == "STORE_MANAGER":
        q = q.filter(Order.outlet_id == current_user.outlet_id)
    elif outlet_id:
        q = q.filter(Order.outlet_id == outlet_id)

    if date:
        q = q.filter(Order.delivery_date == date)
    if status_filter:
        q = q.filter(Order.status == status_filter)

    return q.order_by(Order.placed_at.desc()).all()


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: DbDep, current_user: CurrentUser):
    order = db.get(Order, order_id, options=[selectinload(Order.lines)])
    if not order:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Order not found."})
    # RBAC
    if current_user.role == "STORE_MANAGER" and order.outlet_id != current_user.outlet_id:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Not your outlet."})
    return order


# ---------------------------------------------------------------------------
# Dispatcher: close intake (CONFIRMED -> QUEUED at cutoff)
# ---------------------------------------------------------------------------


@router.post("/close", status_code=status.HTTP_200_OK)
def close_intake(
    db: DbDep,
    current_user: CurrentUser,
    _: None = require_role("DISPATCHER"),
    date: Optional[dt.date] = Query(None),
):
    target_date = date or clock.delivery_date()
    orders = (
        db.query(Order)
        .filter(Order.delivery_date == target_date, Order.status == "CONFIRMED")
        .all()
    )
    for order in orders:
        before = {"status": order.status}
        transition_order(order, "QUEUED")
        log_action(db, "CLOSE_INTAKE", "Order", order.id, actor_user_id=current_user.id,
                   before=before, after={"status": order.status})
    db.commit()
    return {"closed": len(orders), "delivery_date": str(target_date)}


# ---------------------------------------------------------------------------
# Store manager: receipt and issues
# ---------------------------------------------------------------------------


@router.post("/{order_id}/receipt", status_code=status.HTTP_201_CREATED)
def confirm_receipt(
    order_id: int,
    body: ReceiptCreate,
    db: DbDep,
    current_user: CurrentUser,
    _: None = require_role("STORE_MANAGER"),
):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Order not found."})
    if order.outlet_id != current_user.outlet_id:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Not your outlet."})

    receipt = Receipt(order_id=order.id, confirmed_by=current_user.id, status=body.status)
    db.add(receipt)
    log_action(db, "CONFIRM_RECEIPT", "Order", order.id, actor_user_id=current_user.id,
               after={"receipt_status": body.status})
    db.commit()
    return {"ok": True}


@router.post("/{order_id}/issues", status_code=status.HTTP_201_CREATED)
def report_issue(
    order_id: int,
    body: IssueCreate,
    db: DbDep,
    current_user: CurrentUser,
    _: None = require_role("STORE_MANAGER"),
):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Order not found."})
    if order.outlet_id != current_user.outlet_id:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Not your outlet."})

    issue = Issue(order_id=order.id, reported_by=current_user.id, type=body.type, description=body.description)
    db.add(issue)
    log_action(db, "REPORT_ISSUE", "Order", order.id, actor_user_id=current_user.id,
               after={"type": body.type})
    db.commit()
    return {"ok": True}
