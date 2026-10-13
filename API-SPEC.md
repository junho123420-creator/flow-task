# Task Flow API 명세

PRD.md의 요구사항을 API로 옮긴 계약이다. 구현 순서는 PLAN.md(T05~T07)를 따른다.

## 공통
- 기본 경로: `/api`
- 요청·응답 형식: JSON (`Content-Type: application/json`), 문자 인코딩 UTF-8
- 인증: 없음 (로그인 없는 단일 사용자 앱)
- 개발 실행 주소: `http://127.0.0.1:8000`
- 자동 문서: `/docs` (Swagger UI)

## 데이터: Task

| 필드 | 타입 | 규칙 | 기본값 |
|---|---|---|---|
| `id` | integer | 서버가 발급하는 고유 번호. 1부터 증가하며 삭제된 번호는 재사용하지 않는다. | 서버 발급 |
| `title` | string | 앞뒤 공백 제거 후 1~100자 | 필수 |
| `description` | string | 0~2000자 | `""` |
| `status` | string | `TODO`, `DOING`, `DONE` 중 하나 | `TODO` |
| `priority` | string | `HIGH`, `NORMAL`, `LOW` 중 하나 | `NORMAL` |
| `due_date` | string \| null | `YYYY-MM-DD` 형식의 실제 날짜. 미지정은 `null` | `null` |
| `created_at` | string | 서버가 기록하는 생성 시각. ISO 8601 UTC (예: `2026-10-13T05:30:00Z`) | 서버 기록 |

- 글자 수는 유니코드 문자(code point) 기준이다.
- 지연 여부는 저장하지 않는다. 사용자의 로컬 날짜가 필요하므로 프런트엔드가 `due_date`와 `status`로 계산한다(F09).
- 문자열은 그대로 저장·반환한다. HTML로 표시하지 않는 것은 프런트엔드의 책임이다.

```json
{
  "id": 1,
  "title": "보고서 작성",
  "description": "",
  "status": "TODO",
  "priority": "HIGH",
  "due_date": "2026-10-20",
  "created_at": "2026-10-13T05:30:00Z"
}
```

## 엔드포인트 요약

| 메서드 | 경로 | 설명 | 성공 | 작업 |
|---|---|---|---|---|
| GET | `/api/health` | 서버 상태 확인 | 200 | T05 |
| GET | `/api/tasks` | 목록 조회(필터) | 200 | T06, 필터는 T07 |
| POST | `/api/tasks` | 등록 | 201 | T06 |
| PATCH | `/api/tasks/{id}` | 일부 수정 | 200 | T07 |
| DELETE | `/api/tasks/{id}` | 삭제 | 204 | T07 |

## GET /api/health
서버가 요청을 받을 수 있는지 확인한다.

응답 `200`
```json
{"status": "ok"}
```

## GET /api/tasks
할 일 목록을 `id` 오름차순(등록순)으로 반환한다. 조건이 여러 개면 모두 만족하는 항목만 반환한다(AND, F08).

| 쿼리 | 설명 |
|---|---|
| `q` | 제목에 포함된 글자(대소문자 무시, 앞뒤 공백 제거). 비어 있으면 조건 없음 |
| `status` | `TODO`, `DOING`, `DONE` 중 하나 |
| `priority` | `HIGH`, `NORMAL`, `LOW` 중 하나 |

예: `GET /api/tasks?q=보고서&status=TODO&priority=HIGH`

응답 `200`: Task 배열. 없으면 `[]`.
오류 `422`: `status` 또는 `priority` 값이 허용 목록에 없음.

## POST /api/tasks
할 일을 등록한다. `title`만 필수이고 나머지는 생략하면 기본값을 쓴다.

요청
```json
{"title": "보고서 작성", "priority": "HIGH", "due_date": "2026-10-20"}
```

응답 `201`: 생성된 Task.
오류 `422`: 필드 규칙 위반(빈 제목, 101자 제목, 2001자 설명, 잘못된 상태·우선순위·날짜, 알 수 없는 필드 등).

## PATCH /api/tasks/{id}
보낸 필드만 수정한다. **보내지 않은 필드는 그대로 유지한다.**

- 수정 가능: `title`, `description`, `status`, `priority`, `due_date`
- `due_date: null`을 보내면 마감일을 지운다. (필드를 생략하는 것과 다르다)
- `title`, `description`, `status`, `priority`에는 `null`을 보낼 수 없다.
- `id`, `created_at`은 수정할 수 없다(보내면 422).

요청 예: 상태만 변경
```json
{"status": "DONE"}
```

응답 `200`: 수정된 Task 전체.
오류 `404`: 해당 `id`가 없음. `422`: 필드 규칙 위반.

## DELETE /api/tasks/{id}
할 일을 삭제한다. 삭제 확인(F05)은 프런트엔드에서 처리한다.

응답 `204`: 본문 없음.
오류 `404`: 해당 `id`가 없음.

## 오류 형식
FastAPI 기본 형식을 따른다.

`404`
```json
{"detail": "Task not found"}
```

`422`: `detail` 배열에 위반한 위치(`loc`)와 이유(`msg`)를 담는다.
```json
{"detail": [{"type": "string_too_short", "loc": ["body", "title"], "msg": "String should have at least 1 character", "input": ""}]}
```

## 저장 방식에 따른 차이
- 메모리 단계(T06~T08): API를 재시작하면 데이터와 `id` 번호가 초기화된다.
- DB 단계(T11~): API를 재시작해도 데이터가 유지된다.
- 단계가 바뀌어도 이 명세(요청·응답 형식)는 바뀌지 않는다.
