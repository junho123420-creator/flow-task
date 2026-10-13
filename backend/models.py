# T10: tasks 테이블 정의. 필드 규칙은 API-SPEC.md의 Task를 따른다.
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class TaskRow(Base):
    __tablename__ = "tasks"
    __table_args__ = {"mysql_charset": "utf8mb4", "mysql_engine": "InnoDB"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(2000), nullable=False, default="")
    status: Mapped[str] = mapped_column(
        Enum("TODO", "DOING", "DONE", name="task_status"), nullable=False, default="TODO"
    )
    priority: Mapped[str] = mapped_column(
        Enum("HIGH", "NORMAL", "LOW", name="task_priority"), nullable=False, default="NORMAL"
    )
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # UTC 시각을 시간대 없이 저장한다. API 응답에서 ISO 8601(Z)로 바꾼다.
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
