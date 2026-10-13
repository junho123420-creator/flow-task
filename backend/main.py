# T05: API 서버 상태 확인(/api/health)
# T06: 메모리 기반 /api/tasks GET·POST. API를 재시작하면 데이터와 id가 초기화된다.
from datetime import datetime, timezone
from threading import Lock

from fastapi import FastAPI, status

from backend.schemas import Task, TaskCreate

app = FastAPI(title="Task Flow API")

# 메모리 저장소. id 순서(등록순)로 보관한다.
tasks: list[Task] = []
next_id = 1
# 동시에 들어온 등록 요청이 같은 id를 받지 않도록 막는다.
tasks_lock = Lock()


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/tasks")
def list_tasks() -> list[Task]:
    with tasks_lock:
        return list(tasks)


@app.post("/api/tasks", status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate) -> Task:
    global next_id
    with tasks_lock:
        task = Task(id=next_id, created_at=utc_now(), **payload.model_dump())
        tasks.append(task)
        next_id += 1
    return task
