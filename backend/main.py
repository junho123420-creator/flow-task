# T05: API 서버 상태 확인(/api/health)
from fastapi import FastAPI

app = FastAPI(title="Task Flow API")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
