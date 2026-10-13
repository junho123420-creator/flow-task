# T05: API 서버 상태 확인(/api/health)
# T06: /api/tasks GET·POST
# T07: PATCH·DELETE /api/tasks/{id}, 목록 필터(q·status·priority, AND).
# T08: 개발용 프런트엔드(5500 포트)에서 호출할 수 있도록 CORS 허용.
# T11: 메모리 저장을 MariaDB(tasks 테이블)로 교체. API를 재시작해도 데이터가 유지된다.
# 추가: frontend/ 정적 파일도 제공해 8000 포트(또는 ngrok 주소) 하나로 화면과 API를 함께 사용할 수 있게 한다.
from collections.abc import Iterator
from datetime import date, datetime, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend.models import TaskRow
from backend.schemas import Priority, Status, Task, TaskCreate, TaskUpdate

app = FastAPI(title="Task Flow API")

# 개발 중에는 프런트엔드(python -m http.server 5500)와 API(8000)의 포트가 달라 CORS 허용이 필요하다.
# Nginx로 같은 주소에서 제공하는 배포 단계(T14)에서는 사용되지 않는다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"],
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(OperationalError)
def database_unavailable(request: Request, exc: OperationalError) -> JSONResponse:
    # DB 서버가 꺼져 있거나 접속 정보가 틀린 경우. 상세 내용(접속 정보)은 응답에 넣지 않는다.
    return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content={"detail": "Database unavailable"})


def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session


def to_task(row: TaskRow) -> Task:
    return Task(
        id=row.id,
        title=row.title,
        description=row.description,
        status=row.status,
        priority=row.priority,
        due_date=row.due_date.isoformat() if row.due_date else None,
        created_at=row.created_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
    )


def to_date(value: str | None) -> date | None:
    return date.fromisoformat(value) if value is not None else None


def get_row(db: Session, task_id: int) -> TaskRow:
    row = db.get(TaskRow, task_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return row


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/tasks")
def list_tasks(
    q: str | None = None,
    # 쿼리 이름은 status지만, fastapi.status 모듈과 겹치지 않도록 변수 이름은 따로 둔다.
    status_filter: Status | None = Query(default=None, alias="status"),
    priority: Priority | None = None,
    db: Session = Depends(get_db),
) -> list[Task]:
    query = select(TaskRow).order_by(TaskRow.id)
    keyword = (q or "").strip().lower()
    if keyword:
        # 기본 정렬 규칙(ai_ci)은 악센트까지 무시하므로, 소문자로 바꾼 뒤 이진 비교해 대소문자만 무시한다.
        # autoescape: 검색어의 %, _를 와일드카드가 아닌 글자로 취급한다.
        query = query.where(func.lower(TaskRow.title).collate("utf8mb4_bin").contains(keyword, autoescape=True))
    if status_filter is not None:
        query = query.where(TaskRow.status == status_filter)
    if priority is not None:
        query = query.where(TaskRow.priority == priority)
    return [to_task(row) for row in db.scalars(query)]


@app.post("/api/tasks", status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)) -> Task:
    data = payload.model_dump()
    row = TaskRow(
        **{**data, "due_date": to_date(data["due_date"])},
        # DATETIME은 초 단위로 저장하므로 마이크로초는 버린다.
        created_at=datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return to_task(row)


@app.patch("/api/tasks/{task_id}")
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)) -> Task:
    row = get_row(db, task_id)
    for name, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, name, to_date(value) if name == "due_date" else value)
    db.commit()
    db.refresh(row)
    return to_task(row)


@app.delete("/api/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: Session = Depends(get_db)) -> Response:
    db.delete(get_row(db, task_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# 화면 파일(index.html, app.js, styles.css). /api 경로와 /docs가 먼저 등록되어 있으므로 그 외 경로만 여기서 처리한다.
# 반드시 맨 마지막에 등록해야 API 경로를 가리지 않는다.
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
