# API 요청·응답 형식과 입력 검증. 규칙은 API-SPEC.md를 따른다.
import re
from datetime import date
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, StringConstraints

Status = Literal["TODO", "DOING", "DONE"]
Priority = Literal["HIGH", "NORMAL", "LOW"]

# 앞뒤 공백을 제거한 뒤 1~100자 (Python 문자열 길이는 유니코드 문자 기준)
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Description = Annotated[str, StringConstraints(max_length=2000)]

DATE_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2}")


def check_due_date(value: str | None) -> str | None:
    if value is None:
        return None
    # fromisoformat은 20261020 같은 형식도 받으므로 YYYY-MM-DD 모양을 먼저 확인한다.
    if not DATE_PATTERN.fullmatch(value):
        raise ValueError("due_date must be YYYY-MM-DD")
    try:
        date.fromisoformat(value)
    except ValueError:
        raise ValueError("due_date must be a real date") from None
    return value


DueDate = Annotated[str | None, AfterValidator(check_due_date)]


class TaskCreate(BaseModel):
    # 정의하지 않은 필드(id, created_at 등)가 오면 422로 거절한다.
    model_config = ConfigDict(extra="forbid")

    title: Title
    description: Description = ""
    status: Status = "TODO"
    priority: Priority = "NORMAL"
    due_date: DueDate = None


class Task(BaseModel):
    id: int
    title: str
    description: str
    status: Status
    priority: Priority
    due_date: str | None
    created_at: str
