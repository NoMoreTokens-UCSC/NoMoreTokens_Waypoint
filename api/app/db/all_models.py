# Import all models here so Alembic's env.py can discover them via Base.metadata
from app.db.base import Base  # noqa: F401
from app.models.reference import Depot, Outlet, Vehicle, CalendarDay, VehicleWeeklyFuel  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.order import Order, OrderLine  # noqa: F401
from app.models.plan import Plan, Trip, Stop, StopOrder  # noqa: F401
from app.models.deferral import Deferral  # noqa: F401
from app.models.loading import LoadCheck  # noqa: F401
from app.models.delivery import DeliveryEvent  # noqa: F401
from app.models.receipt import Receipt  # noqa: F401
from app.models.issue import Issue  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.audit import AuditLog  # noqa: F401
