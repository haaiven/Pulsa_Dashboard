import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


class Provider(Base):
    __tablename__ = "providers"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    active = Column(Boolean, default=True)
    routes = relationship("Route", back_populates="provider")


class Aggregator(Base):
    __tablename__ = "aggregators"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    active = Column(Boolean, default=True)
    routes = relationship("Route", back_populates="aggregator")


class SwitchPlatform(Base):
    __tablename__ = "switch_platforms"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    location = Column(String(100), default="")
    active = Column(Boolean, default=True)
    routes = relationship("Route", back_populates="switch_platform")


class Agent(Base):
    __tablename__ = "agents"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    active = Column(Boolean, default=True)
    routes = relationship("Route", back_populates="agent")
    channels = relationship("Channel", back_populates="agent")


class Channel(Base):
    __tablename__ = "channels"
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    active = Column(Boolean, default=True)
    agent = relationship("Agent", back_populates="channels")
    routes = relationship("Route", back_populates="channel")


class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(Integer, ForeignKey("providers.id"), nullable=False)
    category = Column(String(50), default="")
    code = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    nominal = Column(Float, default=0)
    active = Column(Boolean, default=True)
    provider = relationship("Provider")
    routes = relationship("Route", back_populates="product")


class Route(Base):
    __tablename__ = "routes"
    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(Integer, ForeignKey("providers.id"), nullable=False)
    aggregator_id = Column(Integer, ForeignKey("aggregators.id"), nullable=False)
    switch_platform_id = Column(Integer, ForeignKey("switch_platforms.id"), nullable=False)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    channel_id = Column(Integer, ForeignKey("channels.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    priority = Column(Integer, default=0)
    active = Column(Boolean, default=True)
    provider = relationship("Provider", back_populates="routes")
    aggregator = relationship("Aggregator", back_populates="routes")
    switch_platform = relationship("SwitchPlatform", back_populates="routes")
    agent = relationship("Agent", back_populates="routes")
    channel = relationship("Channel", back_populates="routes")
    product = relationship("Product", back_populates="routes")
    daily_summaries = relationship("DailySummary", back_populates="route")


class ImportBatch(Base):
    __tablename__ = "import_batches"
    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(50), unique=True, nullable=False)
    upload_date = Column(Date, default=datetime.date.today)
    file_name = Column(String(255))
    sheet_name = Column(String(100))
    records = Column(Integer, default=0)
    status = Column(String(20), default="UPLOADED")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class SummaryRow(Base):
    __tablename__ = "summary_rows"
    id = Column(Integer, primary_key=True, index=True)
    trx_date = Column(Date, nullable=False, index=True)
    row_order = Column(Integer, nullable=False)
    no = Column(String(20), default="")
    description = Column(Text, default="")
    unit = Column(String(20), default="")
    bas_value = Column(Float, nullable=True)
    dana_value = Column(Float, nullable=True)
    is_section = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class DailySummary(Base):
    __tablename__ = "daily_summaries"
    id = Column(Integer, primary_key=True, index=True)
    trx_date = Column(Date, nullable=False)
    route_id = Column(Integer, ForeignKey("routes.id"), nullable=False)
    total_transaction = Column(Integer, default=0)
    success_transaction = Column(Integer, default=0)
    pending_transaction = Column(Integer, default=0)
    failed_transaction = Column(Integer, default=0)
    gross_amount = Column(Float, default=0)
    settlement_amount = Column(Float, default=0)
    difference_amount = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    route = relationship("Route", back_populates="daily_summaries")
    recon_results = relationship("ReconResult", back_populates="daily_summary")
    exception_details = relationship("ExceptionDetail", back_populates="daily_summary")


class ReconResult(Base):
    __tablename__ = "recon_results"
    id = Column(Integer, primary_key=True, index=True)
    daily_summary_id = Column(Integer, ForeignKey("daily_summaries.id"), nullable=False)
    recon_type = Column(String(50))
    description = Column(Text)
    system_value = Column(Float, default=0)
    external_value = Column(Float, default=0)
    difference = Column(Float, default=0)
    status = Column(String(20))
    daily_summary = relationship("DailySummary", back_populates="recon_results")


class ExceptionDetail(Base):
    __tablename__ = "exception_details"
    id = Column(Integer, primary_key=True, index=True)
    daily_summary_id = Column(Integer, ForeignKey("daily_summaries.id"), nullable=False)
    exception_type = Column(String(100))
    reference_number = Column(String(100))
    product_code = Column(String(50))
    amount = Column(Float, default=0)
    reason = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    daily_summary = relationship("DailySummary", back_populates="exception_details")


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="viewer")
    active = Column(Boolean, default=True)
