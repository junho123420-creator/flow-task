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
- [x] T07: PATCH·DELETE와 필터 구현.
  확인: 미전달 필드 유지, 없는 ID 404, 삭제 204.
  - 변경 파일: backend/schemas.py (TaskUpdate: 부분 수정, due_date 외 null 거절), backend/main.py (PATCH·DELETE, GET 필터 q·status·priority)
  - 실행 명령: .venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001 (테스트용 포트)
  - 확인 결과(2026-10-13): HTTP 테스트 43건 통과.
    PATCH {"status":"DOING"} → 200, 다른 필드·created_at 그대로. due_date null로 마감일 삭제. 빈 본문은 변경 없음.
    없는 id PATCH·DELETE → 404 {"detail":"Task not found"}. DELETE → 204 본문 없음, 이후 같은 id 404, id 재사용 안 함.
    PATCH 422 14종(title·description·status·priority null, 규칙 위반, id·created_at·모르는 필드, JSON 오류), 422 후 항목 그대로.
    필터: q(대소문자·앞뒤 공백 무시), status, priority AND 조합, 잘못된 필터값 422.
    T06 회귀 35건, 재시작 초기화 2건 통과.
  - 남은 오류: 없음.
- [x] T08: 프런트엔드 저장 처리를 API 호출로 교체.
  확인: 화면과 curl 목록이 같음. API 중지 시 오류 표시.
  - 변경 파일: frontend/app.js (localStorage → API 호출, 서버 필터, 오류 처리, 요청 제한 시간 5초),
    frontend/index.html·styles.css (다시 시도 버튼, 불러오는 중 표시), backend/main.py (CORS: 127.0.0.1:5500, localhost:5500만 허용)
  - 결정: API 주소는 5500 포트면 http://<호스트>:8000/api, 그 외는 /api(T14 Nginx 대비).
    필터는 서버(GET ?q=&status=&priority=, 검색 0.3초 디바운스, 늦게 온 응답 무시).
    실패 시 화면은 바꾸지 않고 오류 표시, 첫 연결 실패 시 등록 중지 + 다시 시도. 404면 목록 새로 불러옴.
    이전 localStorage(task-flow-v1) 데이터는 읽거나 지우지 않음(자동 이전 없음).
  - 실행 명령: python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
              python3 -m http.server 5500 --bind 127.0.0.1 --directory frontend
  - 확인 결과(2026-10-13): 브라우저에서 3건 등록·상태 변경 후 화면과 /api/tasks 응답 일치.
    API 중지 후 오류 문구·다시 시도 표시, 등록 비활성화, API 재시작 후 다시 시도로 복구.
    CORS: 5500 출처 preflight 200, 다른 출처 400. 연동 테스트 25건(실제 API 8001 + DOM 대역), 시간 초과 4건, T06 35건·T07 43건 회귀 통과.
  - 발견·수정한 오류: Windows 브라우저 → WSL API가 꺼져 있을 때 연결이 거절되지 않고 대기하여 "불러오는 중"에서 멈춤.
    fetch에 5초 제한 시간(AbortSignal.timeout)을 추가해 "서버가 응답하지 않습니다"로 표시하도록 수정.
  - 남은 오류: 없음.
## 4장: DB
- [x] T09: MariaDB 전용 사용자·DB와 .env 준비. 접속 확인.
  - 변경 파일: .env.example (신규, 가짜 비밀번호만). .env는 로컬에만 두고 Git 제외(.gitignore, 권한 600).
  - 환경: MariaDB 11.8.6 (Ubuntu 26.04, WSL2), 127.0.0.1:3306에서만 수신.
  - DB 준비(사용자가 sudo mariadb에서 실행, 수업 방식):
    CREATE USER task_flow_app@localhost; CREATE DATABASE task_flow;
    GRANT ALL PRIVILEGES ON task_flow.* TO task_flow_app@localhost IDENTIFIED BY '<비밀번호>';
  - 확인 명령: .env 값을 읽어 MYSQL_PWD로 전달(화면·명령줄에 비밀번호 미노출) 후
    mariadb -h 127.0.0.1 -P 3306 -u task_flow_app task_flow -e "SELECT 1; SELECT CURRENT_USER(); SHOW GRANTS;"
  - 확인 결과(2026-10-13): SELECT 1 → 1, CURRENT_USER task_flow_app@localhost, DATABASE task_flow.
    문자셋 utf8mb4(utf8mb4_uca1400_ai_ci), 임시 테이블로 '한글😀' 저장·조회(3자) 확인.
    권한은 task_flow.*만. mysql.user 조회 거절(ERROR 1142), 볼 수 있는 DB는 information_schema·task_flow뿐.
    잘못된 비밀번호 거절(ERROR 1045). 테이블은 아직 없음(T10 범위).
  - 남은 오류: 없음. 참고: 학습용 단순 비밀번호이므로 T12 별도 DB 서버에서는 강한 비밀번호 사용.
    클라이언트의 "--ssl-verify-server-cert is disabled" 경고는 로컬 접속에서 나오는 안내로 동작과 무관.
- [x] T10: backend/database.py, models.py, init_db.py 생성.
  확인: python -m backend.init_db 실행 후 tasks 테이블 확인.
  - 변경 파일: backend/database.py (.env 읽기, 엔진·세션, 설정 누락 시 안내), backend/models.py (TaskRow → tasks),
    backend/init_db.py (create_all, 기존 테이블은 변경 안 함), backend/requirements.txt (SQLAlchemy 2.1.4, PyMySQL 1.2.3, python-dotenv 1.2.4)
  - 실행 명령: .venv/bin/python -m backend.init_db
  - 확인 결과(2026-10-13): 1회차 "tasks: 생성함", 2회차 "tasks: 이미 있음(변경 안 함)". 접속 URL 출력 시 비밀번호 *** 처리.
    SHOW CREATE TABLE: id INT AUTO_INCREMENT PK, title VARCHAR(100), description VARCHAR(2000), status ENUM(TODO,DOING,DONE),
    priority ENUM(HIGH,NORMAL,LOW), due_date DATE NULL, created_at DATETIME, InnoDB, utf8mb4.
    ORM 저장·조회(이모지 포함 100자, 2028-02-29) 후 롤백, 101자·잘못된 status는 DB에서 거절(STRICT_TRANS_TABLES).
    테스트 롤백으로 증가한 AUTO_INCREMENT를 빈 테이블 확인 후 1로 되돌림. 현재 행 0건.
  - 남은 오류: 없음.
- [x] T11: API 메모리 저장을 DB로 교체.
  확인: 등록한 행을 SQL로 조회. API 재시작 후 데이터 유지.
  - 변경 파일: backend/main.py (요청마다 DB 세션, TaskRow ↔ Task 변환, Lock 제거, DB 연결 불가 시 503),
    API-SPEC.md (503 Database unavailable, id는 DB 발급). 프런트엔드는 API 계약이 같아 변경 없음.
  - 검색: 기본 정렬 규칙(ai_ci)은 악센트도 무시하므로 LOWER(title) + utf8mb4_bin 비교로 메모리 단계와 같게 "대소문자만 무시".
    검색어의 %, _는 글자로 취급(autoescape).
  - 실행 명령: python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload (테스트는 8001·8003 포트)
  - 확인 결과(2026-10-13): API 테스트 34건 통과(POST·PATCH·DELETE·422·404·필터·동시 30건).
    SQL(mariadb CLI)로 등록한 행 조회: id 1 '보고서 작성' TODO NORMAL 등 40행 확인.
    API 프로세스를 종료 후 새로 실행 → 같은 id 목록·수정 내용 유지, 새 등록 id 이어서 발급.
    잘못된 DB 포트로 실행 시 /api/tasks 503 {"detail":"Database unavailable"}(접속 정보 노출 없음), /api/health 200.
    프런트 연동 테스트 24건 통과(메모리 단계 전제인 "재시작 후 빈 목록" 1건은 DB 단계에서 데이터가 유지되므로 예상된 차이).
    테스트 전 tasks 0행·다음 id 1 → 테스트 후 테스트 행 삭제·AUTO_INCREMENT 1로 원상 복구.
    사용자 확인: 화면에서 등록한 3건과 상태 변경(DOING, DONE)이 sudo mariadb의 SELECT로 조회됨.
  - 남은 오류: 없음.
  - 추가 변경(PLAN 외, 사용자 요청): ngrok(포트 하나만 공개)으로 외부 접속하기 위해 backend/main.py에
    StaticFiles로 frontend/ 제공을 추가. 8000 포트 하나로 화면과 API를 함께 사용, 기존 5500 방식도 유지.
    확인: 8000 / → index.html 200, /api/·/docs 정상, ngrok 주소 / 200, /.env·/../.env·/backend/main.py는 404.
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