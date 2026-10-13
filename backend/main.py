# T05: API 서버 상태 확인(/api/health)
# T06: 메모리 기반 /api/tasks GET·POST. API를 재시작하면 데이터와 id가 초기화된다.
# T07: PATCH·DELETE /api/tasks/{id}, 목록 필터(q·status·priority, AND).
# T08: 개발용 프런트엔드(5500 포트)에서 호출할 수 있도록 CORS 허용.
from datetime import datetime, timezone
from threading import Lock

from fastapi import FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware

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

# 메모리 저장소. id 순서(등록순)로 보관한다.
tasks: list[Task] = []
next_id = 1
# 동시에 들어온 요청이 목록과 id를 함께 바꾸지 않도록 막는다.
tasks_lock = Lock()


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def find_index(task_id: int) -> int:
    for index, task in enumerate(tasks):
        if task.id == task_id:
            return index
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/tasks")
def list_tasks(
    q: str | None = None,
    # 쿼리 이름은 status지만, fastapi.status 모듈과 겹치지 않도록 변수 이름은 따로 둔다.
    status_filter: Status | None = Query(default=None, alias="status"),
    priority: Priority | None = None,
) -> list[Task]:
    keyword = (q or "").strip().lower()
    with tasks_lock:
        return [
            task
            for task in tasks
            if (keyword == "" or keyword in task.title.lower())
            and (status_filter is None or task.status == status_filter)
            and (priority is None or task.priority == priority)
        ]


@app.post("/api/tasks", status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate) -> Task:
    global next_id
    with tasks_lock:
        task = Task(id=next_id, created_at=utc_now(), **payload.model_dump())
        tasks.append(task)
        next_id += 1
    return task


@app.patch("/api/tasks/{task_id}")
def update_task(task_id: int, payload: TaskUpdate) -> Task:
    changes = payload.model_dump(exclude_unset=True)
    with tasks_lock:
        index = find_index(task_id)
        task = tasks[index].model_copy(update=changes)
        tasks[index] = task
    return task


@app.delete("/api/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int) -> Response:
    with tasks_lock:
        del tasks[find_index(task_id)]
    return Response(status_code=status.HTTP_204_NO_CONTENT)
