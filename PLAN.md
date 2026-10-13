# Task Flow PLAN
## 작업 원칙
한 번에 아래 작업 하나만 구현한다. 실제 확인 전에는 완료로 표시하지 않는다.
상태는 [ ] 미완료, [x] 확인 완료로 관리하고 확인 결과를 각 항목 아래 기록한다.
## 2장: 브라우저 앱
- [x] T01: frontend/index.html, styles.css, app.js 생성. 제목 입력·등록·목록만 구현한다.
  확인: 두 항목 등록, 빈 제목 거절. 이 단계에서 새로고침하면 사라져도 정상이다.
  - 변경 파일: frontend/index.html, frontend/styles.css, frontend/app.js (신규)
  - 실행 명령: python3 -m http.server 5500 --bind 127.0.0.1 --directory frontend
  - 확인 결과(2026-10-13): 브라우저에서 두 항목 등록, 빈 제목 거절, 새로고침 시 초기화 확인.
    정적 파일 3개 HTTP 200. Node DOM 대역 테스트 8건 통과(공백만 거절, 101자 거절, 100자 허용, HTML 입력 글자 표시 포함).
  - 남은 오류: 없음. (별도: AGENTS.md의 PostgreSQL 표기를 MariaDB로 수정하여 PRD와 일치시킴)
- [x] T02: localStorage(task-flow-v1) 저장·복원.
  확인: 새로고침 후 유지. 손상된 저장값을 자동 덮어쓰지 않는다.
  - 변경 파일: frontend/app.js (저장·복원, 손상 시 등록 중지, 저장 실패 시 항목 되돌림)
  - 실행 명령: python3 -m http.server 5500 --bind 127.0.0.1 --directory frontend
  - 확인 결과(2026-10-13): 브라우저에서 두 항목 등록 후 새로고침해도 유지됨.
    콘솔에서 task-flow-v1을 "{broken"으로 바꾸고 새로고침하니 입력·등록 버튼 비활성화와 안내 문구가 표시됨.
    getItem 결과가 '{broken' 그대로여서 덮어쓰지 않음을 확인. removeItem 후 정상 복귀.
    Node 대역 테스트: T02 9건, T01 회귀 8건 통과.
  - 남은 오류: 없음. 한계: 여러 탭을 동시에 열고 등록하면 오래된 탭의 목록이 다른 탭에서 추가한 항목을 덮어쓸 수 있음(범위 외).
- [x] T03: 상태 변경, 수정, 삭제 확인.
  확인: 삭제 취소 시 유지. 다른 항목이 수정되지 않는다.
  - 변경 파일: frontend/app.js (상태·제목 수정·삭제, id 기준 처리, 저장 성공 시에만 반영), frontend/index.html (list-message), frontend/styles.css
  - 범위: 수정은 제목만. 설명은 T04에서 추가. status 없는 T02 저장값은 TODO로 표시하고 저장값은 자동 변경하지 않음.
  - 실행 명령: python3 -m http.server 5500 --bind 127.0.0.1 --directory frontend
  - 확인 결과(2026-10-13): 브라우저에서 A·B·C 등록 후 B만 상태 변경, C 제목 수정 시 다른 항목 유지,
    A 삭제 취소 시 유지, 삭제 확인 시 A만 삭제, 새로고침 후 상태·제목 유지 확인.
    Node DOM 대역 테스트: T03 23건, T01·T02 회귀 10건 통과. 정적 파일 3개 HTTP 200.
  - 남은 오류: 없음. (npm 미설치로 jsdom 대신 자체 DOM 대역 사용)
- [x] T04: 설명·우선순위·마감일·검색·필터·지연 표시.
  확인: 필터 중 수정·삭제, 어제 마감 TODO의 지연 표시.
  - 변경 파일: frontend/index.html (등록 폼 우선순위·마감일, 필터), frontend/app.js, frontend/styles.css
  - 내용: 설명(≤2000자, 기본 "")은 수정 모드에서 입력. 우선순위 기본 NORMAL. 마감일 YYYY-MM-DD 또는 null(없는 날짜 거절).
    제목 검색·상태·우선순위 AND 필터, 개수 (표시/전체). 로컬 날짜 기준 마감일 < 오늘이고 DONE이 아니면 지연.
    이전 단계 저장값은 기본값으로 표시하고 저장값은 자동 변경하지 않음. 잘못된 필드 값은 손상으로 보고 등록 중지.
  - 실행 명령: python3 -m http.server 5500 --bind 127.0.0.1 --directory frontend
  - 확인 결과(2026-10-13): 브라우저에서 어제 마감 TODO 지연 표시와 완료 시 해제, 필터 중 수정·삭제 시 해당 항목만 변경,
    삭제 취소 시 유지, 새로고침 후 설명·우선순위·마감일·지연 유지 확인.
    Node DOM 대역 테스트: T04 36건, T03 23건, T01·T02 회귀 10건 통과. 정적 파일 3개 HTTP 200.
  - 남은 오류: 없음.
## 3장: API
- [x] T05: API-SPEC.md 작성, FastAPI /api/health 구현.
  확인: curl로 200과 status=ok.
  - 변경 파일: API-SPEC.md, backend/__init__.py, backend/main.py, backend/requirements.txt(fastapi 0.143.0, uvicorn 0.54.0), .gitignore(.venv, __pycache__, .env)
  - 준비: python3 -m venv .venv && .venv/bin/python -m pip install -r backend/requirements.txt (Python 3.14.4)
  - 실행 명령: .venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
  - 확인 결과(2026-10-13): curl -i http://127.0.0.1:8000/api/health → HTTP/1.1 200 OK, {"status":"ok"}.
    /docs 200, OpenAPI 경로는 /api/health 하나, /api/tasks는 아직 404(T06 범위).
  - 남은 오류: 없음.
- [x] T06: 메모리 기반 /api/tasks GET과 POST.
  확인: /docs에서 등록 후 조회. 입력 위반은 422.
  - 변경 파일: backend/schemas.py (신규, 요청·응답 형식과 검증), backend/main.py (메모리 저장소, GET·POST, 등록 시 Lock)
  - 실행 명령: python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
  - 확인 결과(2026-10-13): /docs에서 POST {"title":"보고서 작성","priority":"HIGH"} → 201(id 1, 기본값 채움),
    GET → 200 목록에 해당 항목, POST {"title":""} → 422(loc body.title, string_too_short).
    HTTP 테스트(8001 포트) 35건 통과: 기본값·공백 제거·경계값(100자, 2000자, 이모지, 윤년), 422 23종(빈/공백/101자 제목,
    잘못된 status·priority·날짜, id·created_at·모르는 필드, JSON 오류), 거절 시 미저장, 동시 50건 id 중복 없음.
    서버 종료 후 재시작 시 목록 [] 및 id 1부터 시작 확인.
  - 남은 오류: 없음. 참고: 필터(q·status·priority)는 T07 범위.
- [ ] T07: PATCH·DELETE와 필터 구현.
  확인: 미전달 필드 유지, 없는 ID 404, 삭제 204.
- [ ] T08: 프런트엔드 저장 처리를 API 호출로 교체.
  확인: 화면과 curl 목록이 같음. API 중지 시 오류 표시.
## 4장: DB
- [ ] T09: MariaDB 전용 사용자·DB와 .env 준비. 접속 확인.
- [ ] T10: backend/database.py, models.py, init_db.py 생성.
  확인: python -m backend.init_db 실행 후 tasks 테이블 확인.
- [ ] T11: API 메모리 저장을 DB로 교체.
  확인: 등록한 행을 SQL로 조회. API 재시작 후 데이터 유지.
## 5장: 서버 분리
- [ ] T12: DB 서버 구성 후 App 서버에서 SELECT 1 확인.
- [ ] T13: App 서버 코드·가상환경·환경변수·systemd 구성.
  확인: App에서 /api/health 응답.
- [ ] T14: Web 서버 Nginx와 정적 파일·/api 프록시 구성.
  확인: Web 주소로 등록, DB 저장, App 재시작 후 유지.
## 실행 기준
T01~T04: python3 -m http.server 5500 --bind 127.0.0.1 --directory frontend
T05~T11: 가상환경에서 python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
실제 존재하는 파일을 확인한 뒤 명령을 실행한다.
## 기록
각 작업에 변경 파일, 실행 명령, 실제 확인 결과, 남은 오류를 기록한다.
정상 동작을 확인한 작업 단위로 Git 커밋한다.