from sqlalchemy.orm import Session
from ..models.parameter import AppConfig


def get_config(db: Session, key: str, default: str = None) -> str:
    cfg = db.query(AppConfig).filter(AppConfig.config_key == key).first()
    return cfg.config_value if cfg else default


def get_config_int(db: Session, key: str, default: int = 0) -> int:
    try:
        return int(get_config(db, key, str(default)))
    except (TypeError, ValueError):
        return default
