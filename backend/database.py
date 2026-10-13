# T10: MariaDB 연결 설정. 접속 정보는 프로젝트 루트의 .env(또는 환경변수)에서 읽는다.
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import URL, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# 이미 설정된 환경변수(예: systemd)는 덮어쓰지 않는다.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

REQUIRED_SETTINGS = ("DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD")


def read_settings() -> dict[str, str]:
    missing = [name for name in REQUIRED_SETTINGS if not os.environ.get(name)]
    if missing:
        raise RuntimeError(f"DB 설정이 없습니다: {', '.join(missing)} (.env.example 참고)")
    return {name: os.environ[name] for name in REQUIRED_SETTINGS}


def build_url() -> URL:
    settings = read_settings()
    # URL.create는 비밀번호의 특수문자를 알아서 처리하고, 출력할 때 비밀번호를 ***로 가린다.
    return URL.create(
        "mysql+pymysql",
        username=settings["DB_USER"],
        password=settings["DB_PASSWORD"],
        host=settings["DB_HOST"],
        port=int(settings["DB_PORT"]),
        database=settings["DB_NAME"],
        query={"charset": "utf8mb4"},
    )


# pool_pre_ping: 오래 쉬어 끊긴 연결을 사용 전에 확인하고 다시 연결한다.
engine = create_engine(build_url(), pool_pre_ping=True, pool_recycle=3600)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass
