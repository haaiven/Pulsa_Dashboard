import datetime
from pydantic import BaseModel, Field
from typing import Optional


class ProviderBase(BaseModel):
    code: str
    name: str
    active: bool = True


class ProviderCreate(ProviderBase):
    pass


class ProviderOut(ProviderBase):
    id: int
    model_config = {"from_attributes": True}


class AggregatorBase(BaseModel):
    code: str
    name: str
    active: bool = True


class AggregatorCreate(AggregatorBase):
    pass


class AggregatorOut(AggregatorBase):
    id: int
    model_config = {"from_attributes": True}


class SwitchPlatformBase(BaseModel):
    code: str
    name: str
    location: str = ""
    active: bool = True


class SwitchPlatformCreate(SwitchPlatformBase):
    pass


class SwitchPlatformOut(SwitchPlatformBase):
    id: int
    model_config = {"from_attributes": True}


class AgentBase(BaseModel):
    code: str
    name: str
    active: bool = True


class AgentCreate(AgentBase):
    pass


class AgentOut(AgentBase):
    id: int
    model_config = {"from_attributes": True}


class ChannelBase(BaseModel):
    agent_id: int
    code: str
    name: str
    active: bool = True


class ChannelCreate(ChannelBase):
    pass


class ChannelOut(ChannelBase):
    id: int
    model_config = {"from_attributes": True}


class ProductBase(BaseModel):
    provider_id: int
    category: str = ""
    code: str
    name: str
    nominal: float = 0
    active: bool = True


class ProductCreate(ProductBase):
    pass


class ProductOut(ProductBase):
    id: int
    model_config = {"from_attributes": True}


class RouteBase(BaseModel):
    provider_id: int
    aggregator_id: int
    switch_platform_id: int
    agent_id: int
    channel_id: int
    product_id: int
    priority: int = 0
    active: bool = True


class RouteCreate(RouteBase):
    pass


class RouteOut(RouteBase):
    id: int
    model_config = {"from_attributes": True}


class ReconPairBase(BaseModel):
    pair_code: str
    pair_name: str
    category: str
    product: str = "pulsa"
    source_a: str
    source_b: str
    active: bool = True


class ReconPairCreate(ReconPairBase):
    pass


class ReconPairUpdate(BaseModel):
    pair_code: Optional[str] = None
    pair_name: Optional[str] = None
    category: Optional[str] = None
    product: Optional[str] = None
    source_a: Optional[str] = None
    source_b: Optional[str] = None
    active: Optional[bool] = None


class ReconPairOut(ReconPairBase):
    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
    model_config = {"from_attributes": True}


class ExpectedFileBase(BaseModel):
    recon_pair_id: int
    file_type: str
    source: str
    expected_filename_pattern: str
    required: bool = True
    active: bool = True


class ExpectedFileCreate(ExpectedFileBase):
    pass


class ExpectedFileUpdate(BaseModel):
    recon_pair_id: Optional[int] = None
    file_type: Optional[str] = None
    source: Optional[str] = None
    expected_filename_pattern: Optional[str] = None
    required: Optional[bool] = None
    active: Optional[bool] = None


class ExpectedFileOut(ExpectedFileBase):
    id: int
    pair_code: Optional[str] = None
    pair_name: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    model_config = {"from_attributes": True}


class FileReceiptOut(BaseModel):
    id: int
    expected_file_id: Optional[int] = None
    recon_pair_id: Optional[int] = None
    import_batch_id: Optional[int] = None
    file_name: str
    file_kind: str
    source: Optional[str] = None
    file_date: datetime.date
    status: str
    matched_pattern: Optional[str] = None
    created_at: datetime.datetime
    model_config = {"from_attributes": True}


class MonitoringExpectedFileOut(BaseModel):
    id: int
    file_type: str
    source: str
    expected_filename_pattern: str
    required: bool
    active: bool
    status: str
    received_file_name: Optional[str] = None
    received_at: Optional[datetime.datetime] = None


class MonitoringPairOut(BaseModel):
    pair_id: int
    pair_code: str
    pair_name: str
    category: str
    product: str
    source_a: str
    source_b: str
    status: str
    progress: float
    expected_count: int
    received_count: int
    missing_count: int
    files: list[MonitoringExpectedFileOut]


class MonitoringGroupOut(BaseModel):
    category: str
    active_pairs: int
    ready_pairs: int
    pairs: list[MonitoringPairOut]


class FileMonitoringOut(BaseModel):
    summary: dict
    groups: list[MonitoringGroupOut]


class DailySummaryOut(BaseModel):
    id: int
    trx_date: datetime.date
    route_id: int
    total_transaction: int
    success_transaction: int
    pending_transaction: int
    failed_transaction: int
    gross_amount: float
    settlement_amount: float
    difference_amount: float
    model_config = {"from_attributes": True}


class ImportBatchOut(BaseModel):
    id: int
    batch_no: str
    upload_date: datetime.date
    file_name: Optional[str] = None
    sheet_name: Optional[str] = None
    records: int
    status: str
    created_at: datetime.datetime
    model_config = {"from_attributes": True}


class ReconResultOut(BaseModel):
    id: int
    daily_summary_id: int
    recon_type: Optional[str] = None
    description: Optional[str] = None
    system_value: float
    external_value: float
    difference: float
    status: Optional[str] = None
    model_config = {"from_attributes": True}


class ExceptionDetailOut(BaseModel):
    id: int
    daily_summary_id: int
    exception_type: Optional[str] = None
    reference_number: Optional[str] = None
    product_code: Optional[str] = None
    amount: float
    reason: Optional[str] = None
    created_at: datetime.datetime
    model_config = {"from_attributes": True}


class DashboardOverviewOut(BaseModel):
    total_transaction: int
    success_transaction: int
    pending_transaction: int
    failed_transaction: int
    gross_amount: float
    settlement_amount: float
    difference_amount: float
    match_rate: float
    mismatch_rate: float


class DashboardDailyOut(BaseModel):
    trx_date: datetime.date
    total_transaction: int
    success_transaction: int
    pending_transaction: int
    failed_transaction: int
    gross_amount: float
    settlement_amount: float
    difference_amount: float


class DashboardWeeklyOut(BaseModel):
    week: str
    total_transaction: int
    success_transaction: int
    pending_transaction: int
    failed_transaction: int
    gross_amount: float
    settlement_amount: float
    difference_amount: float


class DashboardMonthlyOut(BaseModel):
    month: str
    total_transaction: int
    success_transaction: int
    pending_transaction: int
    failed_transaction: int
    gross_amount: float
    settlement_amount: float
    difference_amount: float


class DashboardTrendOut(BaseModel):
    label: str
    total: int
    success: int
    pending: int
    failed: int


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = "viewer"


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    role: str
    active: bool
    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str
    password: str
