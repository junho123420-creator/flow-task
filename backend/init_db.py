# T10: tasks 테이블을 만든다. 실행: python -m backend.init_db
# 이미 있는 테이블은 건드리지 않는다(삭제·초기화하지 않음).
from sqlalchemy import inspect

from backend.database import Base, engine
from backend import models  # noqa: F401  테이블 정의를 Base에 등록하기 위해 불러온다.


def main() -> None:
    before = set(inspect(engine).get_table_names())
    Base.metadata.create_all(engine)
    after = set(inspect(engine).get_table_names())

    print(f"DB: {engine.url.render_as_string(hide_password=True)}")
    for table in Base.metadata.sorted_tables:
        state = "이미 있음(변경 안 함)" if table.name in before else "생성함"
        print(f"- {table.name}: {state}")
    if not set(Base.metadata.tables) <= after:
        raise SystemExit("테이블 생성을 확인하지 못했습니다.")


if __name__ == "__main__":
    main()
