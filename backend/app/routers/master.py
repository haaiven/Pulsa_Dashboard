from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Provider, Aggregator, SwitchPlatform, Agent, Channel, Product, Route
from app.schemas.schemas import (
    ProviderCreate, ProviderOut, AggregatorCreate, AggregatorOut,
    SwitchPlatformCreate, SwitchPlatformOut, AgentCreate, AgentOut,
    ChannelCreate, ChannelOut, ProductCreate, ProductOut,
    RouteCreate, RouteOut,
)

router = APIRouter(tags=["master"])


def list_all(model, db: Session):
    return db.query(model).all()


def create_item(model, schema_item, db: Session):
    item = model(**schema_item.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


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
