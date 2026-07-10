import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Provider, Aggregator, SwitchPlatform, Agent, Channel, Product, Route, ReconPair, ExpectedFile
from app.schemas.schemas import (
    ProviderCreate, ProviderOut, AggregatorCreate, AggregatorOut,
    SwitchPlatformCreate, SwitchPlatformOut, AgentCreate, AgentOut,
    ChannelCreate, ChannelOut, ProductCreate, ProductOut,
    RouteCreate, RouteOut, ReconPairCreate, ReconPairOut, ReconPairUpdate,
    ExpectedFileCreate, ExpectedFileOut, ExpectedFileUpdate, FileMonitoringOut,
)
from app.services.file_monitoring import get_file_monitoring

router = APIRouter(tags=["master"])


def list_all(model, db: Session):
    return db.query(model).all()


def create_item(model, schema_item, db: Session):
    item = model(**schema_item.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def expected_file_payload(item: ExpectedFile):
    return {
        "id": item.id,
        "recon_pair_id": item.recon_pair_id,
        "file_type": item.file_type,
        "source": item.source,
        "expected_filename_pattern": item.expected_filename_pattern,
        "required": item.required,
        "active": item.active,
        "pair_code": item.recon_pair.pair_code if item.recon_pair else None,
        "pair_name": item.recon_pair.pair_name if item.recon_pair else None,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def apply_updates(item, data):
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)


@router.get("/providers", response_model=list[ProviderOut])
def get_providers(db: Session = Depends(get_db)):
    return list_all(Provider, db)


@router.post("/providers", response_model=ProviderOut)
def create_provider(data: ProviderCreate, db: Session = Depends(get_db)):
    return create_item(Provider, data, db)


@router.get("/aggregators", response_model=list[AggregatorOut])
def get_aggregators(db: Session = Depends(get_db)):
    return list_all(Aggregator, db)


@router.post("/aggregators", response_model=AggregatorOut)
def create_aggregator(data: AggregatorCreate, db: Session = Depends(get_db)):
    return create_item(Aggregator, data, db)


@router.get("/switch-platforms", response_model=list[SwitchPlatformOut])
def get_switch_platforms(db: Session = Depends(get_db)):
    return list_all(SwitchPlatform, db)


@router.post("/switch-platforms", response_model=SwitchPlatformOut)
def create_switch_platform(data: SwitchPlatformCreate, db: Session = Depends(get_db)):
    return create_item(SwitchPlatform, data, db)


@router.get("/agents", response_model=list[AgentOut])
def get_agents(db: Session = Depends(get_db)):
    return list_all(Agent, db)


@router.post("/agents", response_model=AgentOut)
def create_agent(data: AgentCreate, db: Session = Depends(get_db)):
    return create_item(Agent, data, db)


@router.get("/channels", response_model=list[ChannelOut])
def get_channels(db: Session = Depends(get_db)):
    return list_all(Channel, db)


@router.post("/channels", response_model=ChannelOut)
def create_channel(data: ChannelCreate, db: Session = Depends(get_db)):
    return create_item(Channel, data, db)


@router.get("/products", response_model=list[ProductOut])
def get_products(db: Session = Depends(get_db)):
    return list_all(Product, db)


@router.post("/products", response_model=ProductOut)
def create_product(data: ProductCreate, db: Session = Depends(get_db)):
    return create_item(Product, data, db)


@router.get("/routes", response_model=list[RouteOut])
def get_routes(db: Session = Depends(get_db)):
    return list_all(Route, db)


@router.post("/routes", response_model=RouteOut)
def create_route(data: RouteCreate, db: Session = Depends(get_db)):
    return create_item(Route, data, db)


@router.get("/recon-pairs", response_model=list[ReconPairOut])
def get_recon_pairs(db: Session = Depends(get_db)):
    return db.query(ReconPair).order_by(ReconPair.category, ReconPair.pair_name).all()


@router.post("/recon-pairs", response_model=ReconPairOut)
def create_recon_pair(data: ReconPairCreate, db: Session = Depends(get_db)):
    if db.query(ReconPair).filter(ReconPair.pair_code == data.pair_code).first():
        raise HTTPException(400, "Pair code already exists")
    pair = ReconPair(**data.model_dump())
    db.add(pair)
    db.commit()
    db.refresh(pair)
    return pair


@router.get("/recon-pairs/{pair_id}", response_model=ReconPairOut)
def get_recon_pair(pair_id: int, db: Session = Depends(get_db)):
    pair = db.query(ReconPair).filter(ReconPair.id == pair_id).first()
    if not pair:
        raise HTTPException(404, "Recon pair not found")
    return pair


@router.put("/recon-pairs/{pair_id}", response_model=ReconPairOut)
def update_recon_pair(pair_id: int, data: ReconPairUpdate, db: Session = Depends(get_db)):
    pair = db.query(ReconPair).filter(ReconPair.id == pair_id).first()
    if not pair:
        raise HTTPException(404, "Recon pair not found")
    if data.pair_code and data.pair_code != pair.pair_code:
        exists = db.query(ReconPair).filter(ReconPair.pair_code == data.pair_code).first()
        if exists:
            raise HTTPException(400, "Pair code already exists")
    apply_updates(pair, data)
    db.commit()
    db.refresh(pair)
    return pair


@router.delete("/recon-pairs/{pair_id}")
def delete_recon_pair(pair_id: int, db: Session = Depends(get_db)):
    pair = db.query(ReconPair).filter(ReconPair.id == pair_id).first()
    if not pair:
        raise HTTPException(404, "Recon pair not found")
    db.delete(pair)
    db.commit()
    return {"ok": True}


@router.patch("/recon-pairs/{pair_id}/active", response_model=ReconPairOut)
def toggle_recon_pair(pair_id: int, active: bool, db: Session = Depends(get_db)):
    pair = db.query(ReconPair).filter(ReconPair.id == pair_id).first()
    if not pair:
        raise HTTPException(404, "Recon pair not found")
    pair.active = active
    db.commit()
    db.refresh(pair)
    return pair


@router.get("/expected-files", response_model=list[ExpectedFileOut])
def get_expected_files(recon_pair_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(ExpectedFile).join(ReconPair)
    if recon_pair_id:
        q = q.filter(ExpectedFile.recon_pair_id == recon_pair_id)
    return [expected_file_payload(item) for item in q.order_by(ReconPair.pair_code, ExpectedFile.file_type, ExpectedFile.source).all()]


@router.post("/expected-files", response_model=ExpectedFileOut)
def create_expected_file(data: ExpectedFileCreate, db: Session = Depends(get_db)):
    pair = db.query(ReconPair).filter(ReconPair.id == data.recon_pair_id).first()
    if not pair:
        raise HTTPException(400, "Recon pair not found")
    item = ExpectedFile(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return expected_file_payload(item)


@router.get("/expected-files/{expected_file_id}", response_model=ExpectedFileOut)
def get_expected_file(expected_file_id: int, db: Session = Depends(get_db)):
    item = db.query(ExpectedFile).filter(ExpectedFile.id == expected_file_id).first()
    if not item:
        raise HTTPException(404, "Expected file not found")
    return expected_file_payload(item)


@router.put("/expected-files/{expected_file_id}", response_model=ExpectedFileOut)
def update_expected_file(expected_file_id: int, data: ExpectedFileUpdate, db: Session = Depends(get_db)):
    item = db.query(ExpectedFile).filter(ExpectedFile.id == expected_file_id).first()
    if not item:
        raise HTTPException(404, "Expected file not found")
    if data.recon_pair_id and not db.query(ReconPair).filter(ReconPair.id == data.recon_pair_id).first():
        raise HTTPException(400, "Recon pair not found")
    apply_updates(item, data)
    db.commit()
    db.refresh(item)
    return expected_file_payload(item)


@router.delete("/expected-files/{expected_file_id}")
def delete_expected_file(expected_file_id: int, db: Session = Depends(get_db)):
    item = db.query(ExpectedFile).filter(ExpectedFile.id == expected_file_id).first()
    if not item:
        raise HTTPException(404, "Expected file not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


@router.patch("/expected-files/{expected_file_id}/active", response_model=ExpectedFileOut)
def toggle_expected_file(expected_file_id: int, active: bool, db: Session = Depends(get_db)):
    item = db.query(ExpectedFile).filter(ExpectedFile.id == expected_file_id).first()
    if not item:
        raise HTTPException(404, "Expected file not found")
    item.active = active
    db.commit()
    db.refresh(item)
    return expected_file_payload(item)


@router.get("/recon-pairs/{pair_id}/expected-files", response_model=list[ExpectedFileOut])
def get_expected_files_for_pair(pair_id: int, db: Session = Depends(get_db)):
    return get_expected_files(recon_pair_id=pair_id, db=db)


@router.get("/file-monitoring", response_model=FileMonitoringOut)
def file_monitoring(
    settlement_date: datetime.date | None = None,
    category: str | None = None,
    pair_id: int | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
):
    return get_file_monitoring(db, category=category, pair_id=pair_id, status=status, file_date=settlement_date)
