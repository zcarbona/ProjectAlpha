import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum, Float, Text
from sqlalchemy.orm import relationship, DeclarativeBase

class Base(DeclarativeBase):
    pass

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    CUSTOMER = "customer"
    PROVIDER = "provider"

class JobStatus(str, enum.Enum):
    AWAITING_PRICE_APPROVAL = "awaiting_provider_price_approval"
    AWAITING_PAYMENT = "awaiting_payment"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    COMPLETED = "completed"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=True)
    email = Column(String(100), unique=True, index=True, nullable=True)
    phone_number = Column(String(20), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    is_verified = Column(Boolean, default=False)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    provider_profile = relationship("Provider", back_populates="user", uselist=False)
    jobs_as_customer = relationship("Job", back_populates="customer")

class Provider(Base):
    __tablename__ = "providers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    display_name = Column(String(100), nullable=False)
    contact_details = Column(Text, nullable=True)
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    user = relationship("User", back_populates="provider_profile")
    trucks = relationship("Truck", back_populates="provider")
    fleet = relationship("ProviderFleet", back_populates="provider")

class ProviderFleet(Base):
    __tablename__ = "provider_fleet"

    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(Integer, ForeignKey("providers.id"))
    vehicle_type_id = Column(Integer, ForeignKey("vehicle_types.id"))
    quantity = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    provider = relationship("Provider", back_populates="fleet")
    vehicle_type = relationship("VehicleType")

class Truck(Base):
    __tablename__ = "trucks"

    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(Integer, ForeignKey("providers.id"))
    plate_number = Column(String(20), unique=True, index=True)
    vehicle_class = Column(String(50))  # e.g., Small, Medium, Large, XL
    capacity = Column(String(50))
    is_active = Column(Boolean, default=True)

    provider = relationship("Provider", back_populates="trucks")
    locks = relationship("TruckLock", back_populates="truck")

class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"))
    provider_id = Column(Integer, ForeignKey("providers.id"))
    truck_id = Column(Integer, ForeignKey("trucks.id"))
    
    pickup_address = Column(Text)
    pickup_place_id = Column(String(100))
    pickup_lat = Column(Float)
    pickup_lng = Column(Float)
    
    dropoff_address = Column(Text)
    dropoff_place_id = Column(String(100))
    dropoff_lat = Column(Float)
    dropoff_lng = Column(Float)
    
    requested_min_price = Column(Float)
    requested_max_price = Column(Float)
    approved_price = Column(Float, nullable=True)
    
    status = Column(Enum(JobStatus), default=JobStatus.AWAITING_PRICE_APPROVAL)
    payment_status = Column(String(20), default="not_started") # not_started, pending, paid, failed
    
    scheduled_at = Column(DateTime, nullable=True)
    idempotency_key = Column(String(128), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("User", back_populates="jobs_as_customer")
    truck = relationship("Truck")
    provider = relationship("Provider")
    truck_lock = relationship("TruckLock", back_populates="job", uselist=False)

class TruckLock(Base):
    __tablename__ = "truck_locks"

    id = Column(Integer, primary_key=True, index=True)
    truck_id = Column(Integer, ForeignKey("trucks.id"))
    job_id = Column(Integer, ForeignKey("jobs.id"), unique=True)
    expires_at = Column(DateTime)
    is_active = Column(Boolean, default=True)

    truck = relationship("Truck", back_populates="locks")
    job = relationship("Job", back_populates="truck_lock")

class PriceApproval(Base):
    __tablename__ = "price_approvals"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"))
    provider_user_id = Column(Integer, ForeignKey("users.id"))
    decision = Column(String(20))  # e.g., approved, rejected
    approved_amount = Column(Float, nullable=True)
    note = Column(Text, nullable=True)
    idempotency_key = Column(String(128), unique=True, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    job = relationship("Job")
    provider_user = relationship("User")

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"))
    amount = Column(Float)
    currency = Column(String(10), default="EGP")
    status = Column(String(20), default="not_started")  # not_started, pending, paid, failed, refunded
    stripe_payment_intent_id = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    job = relationship("Job")

class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True, index=True)
    actor = Column(String(100))
    action = Column(String(100))
    record_type = Column(String(50))
    record_id = Column(Integer, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(255), nullable=True)


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    legal_name = Column(String(150), nullable=True)
    commercial_registration = Column(String(50), unique=True, nullable=True)
    tax_number = Column(String(50), unique=True, nullable=True)
    contact_email = Column(String(100), nullable=True)
    contact_phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(50), nullable=True)
    country = Column(String(50), nullable=True, default="Egypt")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class VehicleType(Base):
    __tablename__ = "vehicle_types"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, nullable=False)
    label = Column(String(50), nullable=False)
    description = Column(String(100), nullable=True)
    emoji = Column(String(10), nullable=True)
    capacity_kg = Column(Integer, nullable=True)
    max_price_egp = Column(Integer, nullable=True)
    min_price_egp = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)


class City(Base):
    __tablename__ = "cities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    name_ar = Column(String(100), nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)
