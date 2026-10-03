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
from app.models.plan import Plan, Stop, StopOrder, Trip
from app.models.receipt import Receipt
from app.models.reference import Outlet
from app.schemas.order import (
    DeferralHistoryOut,
    IssueCreate,
    OrderCreate,
    OrderOut,
    OrderUpdate,
    ReceiptCreate,
)
from app.schemas.plan import StopOut
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

    outlet = db.query(Outlet).filter(Outlet.outlet_id == body.outlet_id).first()
    brand = body.brand or (outlet.brand if outlet else "Fresh")
    delivery_date = body.delivery_date or clock.delivery_date()
    # A Fresh outlet orders at most one dry and one chilled order per delivery day;
    # a second one of the same type must edit the existing order instead.
    if brand == "Fresh":
        existing = (
            db.query(Order)
            .filter(
                Order.outlet_id == body.outlet_id,
                Order.delivery_date == delivery_date,
                Order.brand == "Fresh",
                Order.temperature_class == body.temperature_class,
                Order.status != "CANCELLED",
            )
            .first()
        )
        if existing:
            kind = "chilled" if body.temperature_class == "CHILLED" else "dry"
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "DUPLICATE_ORDER",
                    "message": f"A {kind} order already exists for {delivery_date:%d %B}; edit it instead.",
                    "order_id": existing.id,
                },
            )
    total_cases = body.total_cases if body.total_cases > 0 else (body.cases or 0)
    total_weight = (
        body.total_weight
        if (body.total_weight is not None and body.total_weight > 0)
        else round(total_cases * 12.0, 2)
    )
    total_volume = (
        body.total_volume
        if (body.total_volume is not None and body.total_volume > 0)
        else round(total_cases * 0.04, 3)
    )

    past_cutoff = clock.is_past_cutoff()
    order = Order(
        reference=_generate_reference(db, delivery_date),
        outlet_id=body.outlet_id,
        brand=brand,
        temperature_class=body.temperature_class,
        delivery_date=delivery_date,
        status="PLACED",
        total_weight=total_weight,
        total_volume=total_volume,
        total_cases=total_cases,
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


@router.get("/stops", response_model=list[StopOut])
def list_order_stops(
    db: DbDep,
    current_user: CurrentUser,
    outlet_id: Optional[str] = Query(None),
    date: Optional[dt.date] = Query(None),
):
    """Returns delivery stops for the store manager's outlet (or scoped by query param for dispatchers)."""
    target_outlet = current_user.outlet_id if current_user.role == "STORE_MANAGER" else (outlet_id or current_user.outlet_id)
    target_date = date or clock.delivery_date()

    q = (
        db.query(Stop)
        .join(Trip, Stop.trip_id == Trip.id)
        .join(Plan, Trip.plan_id == Plan.id)
        .options(
            selectinload(Stop.outlet_rel),
            selectinload(Stop.trip_rel),
            selectinload(Stop.delivery_events),
            selectinload(Stop.stop_orders).selectinload(StopOrder.order_rel),
        )
    )

    if target_outlet:
        q = q.filter(Stop.outlet_id == target_outlet)

    if target_date:
        q = q.filter(Plan.delivery_date == target_date)

    stops = q.order_by(Stop.id.desc()).all()
    if not stops and target_outlet:
        stops = (
            db.query(Stop)
            .options(
                selectinload(Stop.outlet_rel),
                selectinload(Stop.trip_rel),
                selectinload(Stop.delivery_events),
                selectinload(Stop.stop_orders).selectinload(StopOrder.order_rel),
            )
            .filter(Stop.outlet_id == target_outlet)
            .order_by(Stop.id.desc())
            .limit(10)
            .all()
        )
    return stops


@router.get("/intake-status")
def get_intake_status(db: DbDep, current_user: CurrentUser):
    """Return whether cutoff is passed and whether a plan has been published for tomorrow's delivery."""
    past_cutoff = clock.is_past_cutoff()
    delivery_date = clock.delivery_date()
    published_plan = (
        db.query(Plan)
        .filter(Plan.delivery_date == delivery_date, Plan.status == "PUBLISHED")
        .first()
    )
    unclosed_count = (
        db.query(Order)
        .filter(Order.delivery_date == delivery_date, Order.status.in_(["PLACED", "CONFIRMED"]))
        .count()
    )
    total_count = db.query(Order).filter(Order.delivery_date == delivery_date).count()
    intake_closed_log = (
        db.query(AuditLog)
        .filter(AuditLog.action == "CLOSE_INTAKE", AuditLog.entity_type == "Intake")
        .first()
    )
    is_closed = past_cutoff or (intake_closed_log is not None) or (total_count > 0 and unclosed_count == 0) or published_plan is not None
    return {
        "cutoff_closed": is_closed,
        "published": published_plan is not None,
        "delivery_date": str(delivery_date),
        "now": clock.now().isoformat(),
    }


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
        .filter(Order.delivery_date == target_date, Order.status.in_(["PLACED", "CONFIRMED"]))
        .all()
    )
    for order in orders:
        before = {"status": order.status}
        if order.status == "PLACED":
            transition_order(order, "CONFIRMED")
        transition_order(order, "QUEUED")
        log_action(db, "CLOSE_INTAKE", "Order", order.id, actor_user_id=current_user.id,
                   before=before, after={"status": order.status})
    log_action(db, "CLOSE_INTAKE", "Intake", 0, actor_user_id=current_user.id,
               after={"closed": len(orders), "delivery_date": str(target_date)})
    db.commit()
    return {"closed": len(orders), "delivery_date": str(target_date)}


@router.get("", response_model=list[OrderOut])
def list_orders(
    db: DbDep,
    current_user: CurrentUser,
    date: Optional[dt.date] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    outlet_id: Optional[str] = Query(None),
):
    q = db.query(Order).options(
        selectinload(Order.lines),
        selectinload(Order.outlet_rel),
        selectinload(Order.receipts),
        selectinload(Order.issues),
        selectinload(Order.delivery_events),
        selectinload(Order.stop_orders).selectinload(StopOrder.stop_rel).selectinload(Stop.trip_rel),
    )

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
    order = db.get(
        Order,
        order_id,
        options=[
            selectinload(Order.lines),
            selectinload(Order.outlet_rel),
            selectinload(Order.receipts),
            selectinload(Order.issues),
            selectinload(Order.delivery_events),
            selectinload(Order.stop_orders).selectinload(StopOrder.stop_rel).selectinload(Stop.trip_rel),
        ],
    )
    if not order:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Order not found."})
    # RBAC
    if current_user.role == "STORE_MANAGER" and order.outlet_id != current_user.outlet_id:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Not your outlet."})
    return order


@router.patch("/{order_id}", response_model=OrderOut)
def update_order(
    order_id: int,
    body: OrderUpdate,
    db: DbDep,
    current_user: CurrentUser,
    _: None = require_role("STORE_MANAGER", "DISPATCHER"),
):
    order = db.get(
        Order,
        order_id,
        options=[
            selectinload(Order.lines),
            selectinload(Order.outlet_rel),
            selectinload(Order.receipts),
            selectinload(Order.issues),
            selectinload(Order.delivery_events),
            selectinload(Order.stop_orders).selectinload(StopOrder.stop_rel).selectinload(Stop.trip_rel),
        ],
    )
    if not order:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Order not found."})
    if current_user.role == "STORE_MANAGER":
        if order.outlet_id != current_user.outlet_id:
            raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Not your outlet."})
        if order.status not in ("PLACED", "CONFIRMED", "QUEUED", "PLANNED"):
            raise HTTPException(
                status_code=400,
                detail={"code": "INVALID_STATE", "message": f"Cannot modify order in {order.status} state."},
            )
        published = db.query(Plan).filter(Plan.delivery_date == order.delivery_date, Plan.status == "PUBLISHED").first()
        if published and order.status in ("PLANNED", "LOADED", "IN_TRANSIT", "DELIVERED"):
            raise HTTPException(
                status_code=400,
                detail={"code": "PLAN_PUBLISHED", "message": "Cannot modify order once plan is published."},
            )

    before = {"total_cases": order.total_cases, "total_weight": order.total_weight, "total_volume": order.total_volume}
    new_cases = body.cases if body.cases is not None else body.total_cases
    if new_cases is not None:
        order.total_cases = new_cases
        order.total_weight = (
            body.total_weight
            if (body.total_weight is not None and body.total_weight > 0)
            else round(new_cases * 12.0, 2)
        )
        order.total_volume = (
            body.total_volume
            if (body.total_volume is not None and body.total_volume > 0)
            else round(new_cases * 0.04, 3)
        )
    if body.notes is not None:
        order.notes = body.notes

    log_action(db, "UPDATE_ORDER", "Order", order.id, actor_user_id=current_user.id,
               before=before, after={"total_cases": order.total_cases, "total_weight": order.total_weight})
    db.commit()
    db.refresh(order)
    return order


@router.post("/{order_id}/cancel", response_model=OrderOut)
def cancel_order(
    order_id: int,
    db: DbDep,
    current_user: CurrentUser,
    _: None = require_role("STORE_MANAGER", "DISPATCHER"),
):
    order = db.get(
        Order,
        order_id,
        options=[
            selectinload(Order.lines),
            selectinload(Order.outlet_rel),
            selectinload(Order.receipts),
            selectinload(Order.issues),
            selectinload(Order.delivery_events),
            selectinload(Order.stop_orders).selectinload(StopOrder.stop_rel).selectinload(Stop.trip_rel),
        ],
    )
    if not order:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Order not found."})
    if current_user.role == "STORE_MANAGER":
        if order.outlet_id != current_user.outlet_id:
            raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Not your outlet."})
        if order.status in ("LOADED", "IN_TRANSIT", "DELIVERED", "PARTIAL", "FAILED", "CANCELLED"):
            raise HTTPException(
                status_code=400,
                detail={"code": "INVALID_STATE", "message": f"Cannot cancel order in {order.status} state."},
            )

    before = {"status": order.status}
    transition_order(order, "CANCELLED")
    # Clean up stop orders
    db.query(StopOrder).filter(StopOrder.order_id == order.id).delete()

    log_action(db, "CANCEL_ORDER", "Order", order.id, actor_user_id=current_user.id,
               before=before, after={"status": order.status})
    db.commit()
    db.refresh(order)
    return order


# ---------------------------------------------------------------------------
# Dispatcher: confirm order & close intake (PLACED/CONFIRMED -> QUEUED at cutoff)
# ---------------------------------------------------------------------------


@router.post("/{order_id}/confirm", status_code=status.HTTP_200_OK)
def confirm_order(
    order_id: int,
    db: DbDep,
    current_user: CurrentUser,
    _: None = require_role("DISPATCHER"),
):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Order not found."})
    before = {"status": order.status}
    transition_order(order, "CONFIRMED")
    log_action(db, "CONFIRM_ORDER", "Order", order.id, actor_user_id=current_user.id,
               before=before, after={"status": order.status})
    db.commit()
    return {"ok": True, "status": order.status}


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

    outcome = (body.outcome or "").upper()
    receipt_status = body.status
    if outcome == "FULL":
        receipt_status = "FULL"
    elif outcome == "SHORT":
        receipt_status = "PARTIAL"
    elif outcome == "DAMAGED":
        receipt_status = "DISPUTED"
    elif not receipt_status:
        receipt_status = "FULL"

    receipt = Receipt(order_id=order.id, confirmed_by=current_user.id, status=receipt_status)
    db.add(receipt)

    if outcome in ("SHORT", "DAMAGED") or receipt_status in ("PARTIAL", "DISPUTED"):
        import json
        issue_type = "SHORT" if (outcome == "SHORT" or receipt_status == "PARTIAL") else "DAMAGED"
        desc_json = json.dumps({
            "received": body.received_qty if body.received_qty is not None else order.total_cases,
            "affected": body.affected_qty or 0,
            "notes": body.notes or "",
        })
        issue = Issue(
            order_id=order.id,
            reported_by=current_user.id,
            type=issue_type,
            description=desc_json,
        )
        db.add(issue)

    if receipt_status == "PARTIAL":
        if order.status in ("LOADED", "IN_TRANSIT", "DELIVERED"):
            order.status = "PARTIAL"
    elif receipt_status == "FULL":
        if order.status in ("LOADED", "IN_TRANSIT"):
            order.status = "DELIVERED"

    log_action(db, "CONFIRM_RECEIPT", "Order", order.id, actor_user_id=current_user.id,
               after={"receipt_status": receipt_status, "outcome": outcome})
    db.commit()
    return {"ok": True, "receipt_status": receipt_status}


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
