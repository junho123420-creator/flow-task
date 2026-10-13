// T01: 제목 입력·등록·목록 표시
// T02: localStorage 저장·복원 (T08에서 API로 교체)
// T03: 상태 변경, 제목 수정, 삭제 확인. 모든 변경은 화면 순번이 아닌 id로 처리한다.
// T04: 설명·우선순위·마감일, 제목 검색과 상태·우선순위 필터(AND), 지연 표시.
// T08: 저장을 API 호출로 교체. 서버 응답이 성공했을 때만 화면에 반영한다.
//      이전 localStorage(task-flow-v1) 데이터는 옮기지 않고 그대로 둔다(PRD: 자동 이전 없음).

const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 2000;
const SEARCH_DELAY_MS = 300;
// 서버가 꺼져 있어도 연결이 바로 거절되지 않고 기다리는 경우가 있다(예: Windows 브라우저 → WSL).
// 이 시간 안에 응답이 없으면 실패로 처리한다.
const REQUEST_TIMEOUT_MS = 5000;
// 개발 중(http.server 5500)에는 API 서버(8000)를 직접 호출하고, Nginx 배포에서는 같은 주소의 /api를 사용한다.
const API_BASE = location.port === "5500" ? `http://${location.hostname}:8000/api` : "/api";
const STATUSES = [
  { value: "TODO", label: "할 일" },
  { value: "DOING", label: "진행 중" },
  { value: "DONE", label: "완료" },
];
const PRIORITIES = [
  { value: "HIGH", label: "높음" },
  { value: "NORMAL", label: "보통" },
  { value: "LOW", label: "낮음" },
];
const DEFAULT_PRIORITY = "NORMAL";
const FIELD_LABELS = {
  title: "제목",
  description: "설명",
  status: "상태",
  priority: "우선순위",
  due_date: "마감일",
};

// 서버가 돌려준 현재 필터 결과
let tasks = [];
// 수정 중인 할 일의 id. 수정 중이 아니면 null.
let editingId = null;
// 처음 목록을 불러오지 못하면 true. 이때는 등록을 막는다.
let connectionLost = false;
// 저장 요청이 진행 중이면 true. 중복 클릭으로 같은 요청이 두 번 가지 않도록 막는다.
let busy = false;
// 목록 요청 번호. 늦게 도착한 이전 응답이 최신 결과를 덮어쓰지 않도록 한다.
let latestLoad = 0;
let searchTimer = null;

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const priorityInput = document.getElementById("task-priority");
const dueDateInput = document.getElementById("task-due-date");
const formMessage = document.getElementById("form-message");
const searchInput = document.getElementById("filter-search");
const statusFilter = document.getElementById("filter-status");
const priorityFilter = document.getElementById("filter-priority");
const listMessage = document.getElementById("list-message");
const retryButton = document.getElementById("retry-button");
const loadingMessage = document.getElementById("loading-message");
const taskList = document.getElementById("task-list");
const taskCount = document.getElementById("task-count");
const emptyMessage = document.getElementById("empty-message");
const submitButton = form.querySelector("button[type=submit]");

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// API를 호출하고 JSON을 돌려준다. 연결 실패·시간 초과는 status 0, 그 외 실패는 HTTP 상태 코드로 ApiError를 던진다.
async function request(method, path, body) {
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let response;
  let data;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
    // 본문이 JSON이 아니면 null로 두되, 읽는 도중 시간이 초과되면 실패로 처리한다.
    data =
      response.status === 204
        ? null
        : await response.json().catch((error) => {
            if (signal.aborted) {
              throw error;
            }
            return null;
          });
  } catch (networkError) {
    console.error(networkError);
    if (signal.aborted) {
      throw new ApiError(0, "서버가 응답하지 않습니다. API 서버가 실행 중인지 확인하세요.");
    }
    throw new ApiError(0, "서버에 연결할 수 없습니다. API 서버가 실행 중인지 확인하세요.");
  }

  if (response.status === 204) {
    return null;
  }
  if (!response.ok) {
    throw new ApiError(response.status, describeError(response.status, data));
  }
  return data;
}

function describeError(status, data) {
  if (status === 404) {
    return "이미 삭제되었거나 없는 할 일입니다. 목록을 새로 불러왔습니다.";
  }
  if (status === 422 && Array.isArray(data?.detail)) {
    const fields = data.detail.map((item) => FIELD_LABELS[item.loc?.at(-1)] ?? item.loc?.at(-1));
    return `입력값이 올바르지 않습니다: ${[...new Set(fields)].join(", ")}`;
  }
  return `요청을 처리하지 못했습니다. (HTTP ${status})`;
}

function isValidPriority(priority) {
  return PRIORITIES.some((item) => item.value === priority);
}

function labelOf(list, value) {
  return list.find((item) => item.value === value).label;
}

function textLength(text) {
  return Array.from(text).length;
}

// YYYY-MM-DD 형식이면서 실제로 있는 날짜인지 확인한다. (예: 2026-02-30은 거절)
function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

// 로컬 달력 기준 오늘 날짜를 YYYY-MM-DD로 만든다. (toISOString은 UTC라 사용하지 않는다)
function todayString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function isOverdue(task, today) {
  return task.due_date !== null && task.due_date < today && task.status !== "DONE";
}

// 공백 제거 후 1~100자인지 검사한다. 문제가 있으면 오류 메시지, 없으면 null을 반환한다.
// 서버도 같은 규칙으로 검사하지만, 요청 전에 바로 안내하기 위해 화면에서도 검사한다.
function validateTitle(title) {
  const length = textLength(title);
  if (length === 0) {
    return "제목을 입력하세요.";
  }
  if (length > TITLE_MAX_LENGTH) {
    return `제목은 ${TITLE_MAX_LENGTH}자 이하로 입력하세요. (현재 ${length}자)`;
  }
  return null;
}

function validateDescription(description) {
  const length = textLength(description);
  if (length > DESCRIPTION_MAX_LENGTH) {
    return `설명은 ${DESCRIPTION_MAX_LENGTH}자 이하로 입력하세요. (현재 ${length}자)`;
  }
  return null;
}

// 빈 값은 null(마감일 없음)로 바꾼다. 형식이 잘못되면 오류 메시지를 반환한다.
function parseDueDate(value) {
  if (value === "") {
    return { dueDate: null, error: null };
  }
  if (!isValidDate(value)) {
    return { dueDate: null, error: "마감일은 YYYY-MM-DD 형식의 올바른 날짜로 입력하세요." };
  }
  return { dueDate: value, error: null };
}

function findTask(id) {
  return tasks.find((task) => task.id === id);
}

function isFiltered() {
  return searchInput.value.trim() !== "" || statusFilter.value !== "" || priorityFilter.value !== "";
}

// 화면의 필터 값을 GET /api/tasks 쿼리로 만든다. 빈 조건은 보내지 않는다.
function filterQuery() {
  const params = new URLSearchParams();
  const keyword = searchInput.value.trim();
  if (keyword !== "") {
    params.set("q", keyword);
  }
  if (statusFilter.value !== "") {
    params.set("status", statusFilter.value);
  }
  if (priorityFilter.value !== "") {
    params.set("priority", priorityFilter.value);
  }
  const query = params.toString();
  return query === "" ? "" : `?${query}`;
}

function setFormEnabled(enabled) {
  for (const element of [titleInput, priorityInput, dueDateInput, submitButton]) {
    element.disabled = !enabled;
  }
}

function showListError(message, canRetry) {
  listMessage.textContent = message;
  retryButton.hidden = !canRetry;
}

function clearListError() {
  listMessage.textContent = "";
  retryButton.hidden = true;
}

// 서버에서 현재 필터에 맞는 목록을 불러온다. 성공하면 true.
async function loadTasks() {
  const loadId = ++latestLoad;
  loadingMessage.hidden = false;
  try {
    const data = await request("GET", `/tasks${filterQuery()}`);
    if (loadId !== latestLoad) {
      return false;
    }
    tasks = data;
    if (connectionLost) {
      connectionLost = false;
      setFormEnabled(true);
      formMessage.textContent = "";
    }
    clearListError();
    renderTasks();
    return true;
  } catch (error) {
    if (loadId !== latestLoad) {
      return false;
    }
    showListError(`목록을 불러오지 못했습니다. ${error.message}`, true);
    return false;
  } finally {
    if (loadId === latestLoad) {
      loadingMessage.hidden = true;
    }
  }
}

function createButton(label, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = action;
  button.textContent = label;
  return button;
}

function createSelect(options, value, className, label) {
  const select = document.createElement("select");
  select.className = className;
  select.setAttribute("aria-label", label);
  for (const item of options) {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    select.appendChild(option);
  }
  select.value = value;
  return select;
}

function createBadge(text, className) {
  const badge = document.createElement("span");
  badge.className = `badge ${className}`;
  badge.textContent = text;
  return badge;
}

function createEditForm(task) {
  const item = document.createElement("li");
  item.dataset.id = String(task.id);
  item.className = "task-item editing";

  const title = document.createElement("input");
  title.type = "text";
  title.className = "edit-title";
  title.setAttribute("aria-label", "제목 수정");
  title.value = task.title;

  const description = document.createElement("textarea");
  description.className = "edit-description";
  description.setAttribute("aria-label", "설명 수정");
  description.placeholder = `설명 (선택, ${DESCRIPTION_MAX_LENGTH}자 이하)`;
  description.rows = 3;
  description.value = task.description;

  const dueDate = document.createElement("input");
  dueDate.type = "date";
  dueDate.className = "edit-due-date";
  dueDate.setAttribute("aria-label", "마감일 수정");
  dueDate.value = task.due_date ?? "";

  const row = document.createElement("div");
  row.className = "edit-row";
  row.append(
    createSelect(PRIORITIES, task.priority, "edit-priority", "우선순위 수정"),
    dueDate,
    createButton("저장", "save"),
    createButton("취소", "cancel")
  );

  item.append(title, description, row);
  return item;
}

function createTaskItem(task, today, currentEditItem) {
  if (task.id === editingId) {
    // 다른 항목 때문에 다시 그릴 때 입력 중인 내용이 사라지지 않도록 기존 수정 폼을 재사용한다.
    if (currentEditItem && Number(currentEditItem.dataset.id) === editingId) {
      return currentEditItem;
    }
    return createEditForm(task);
  }

  const item = document.createElement("li");
  item.dataset.id = String(task.id);
  item.className = `task-item status-${task.status.toLowerCase()}`;
  const overdue = isOverdue(task, today);
  if (overdue) {
    item.className += " overdue";
  }

  const title = document.createElement("span");
  title.className = "task-title";
  // 사용자 입력은 HTML로 해석하지 않도록 textContent로 넣는다.
  title.textContent = task.title;

  const meta = document.createElement("div");
  meta.className = "task-meta";
  meta.append(createBadge(labelOf(PRIORITIES, task.priority), `priority-${task.priority.toLowerCase()}`));
  if (task.due_date !== null) {
    meta.append(createBadge(`마감 ${task.due_date}`, "due-date"));
  }
  if (overdue) {
    meta.append(createBadge("지연", "overdue-badge"));
  }

  const main = document.createElement("div");
  main.className = "task-main";
  main.append(title, meta);
  if (task.description !== "") {
    const description = document.createElement("p");
    description.className = "task-description";
    description.textContent = task.description;
    main.append(description);
  }

  item.append(
    createSelect(STATUSES, task.status, "task-status", "상태"),
    main,
    createButton("수정", "edit"),
    createButton("삭제", "delete")
  );
  return item;
}

function renderTasks() {
  const today = todayString();
  const currentEditItem = taskList.querySelector("li.editing");
  if (editingId !== null && !findTask(editingId)) {
    editingId = null;
  }
  taskList.replaceChildren(...tasks.map((task) => createTaskItem(task, today, currentEditItem)));

  const filtered = isFiltered();
  taskCount.textContent = filtered ? `(검색 결과 ${tasks.length})` : `(${tasks.length})`;
  emptyMessage.textContent = filtered ? "조건에 맞는 할 일이 없습니다." : "등록된 할 일이 없습니다.";
  emptyMessage.hidden = tasks.length > 0;

  const editItem = taskList.querySelector("li.editing");
  if (editItem && editItem !== currentEditItem) {
    editItem.querySelector(".edit-title").focus();
  }
}

// 저장 요청을 하나씩 실행한다. 실패하면 오류를 표시하고 false를 돌려준다.
// 404면 다른 곳에서 바뀐 것이므로 목록을 다시 불러온다.
async function mutate(action, messageElement) {
  if (busy) {
    return false;
  }
  busy = true;
  submitButton.disabled = true;
  try {
    await action();
    messageElement.textContent = "";
    return true;
  } catch (error) {
    messageElement.textContent = error.message;
    if (error.status === 404) {
      editingId = null;
      await loadTasks();
      messageElement.textContent = error.message;
    }
    return false;
  } finally {
    busy = false;
    submitButton.disabled = connectionLost;
  }
}

async function changeStatus(id, status) {
  const ok = await mutate(() => request("PATCH", `/tasks/${id}`, { status }), listMessage);
  if (ok) {
    await loadTasks();
  } else {
    // 실패하면 선택 상자를 원래 상태로 되돌린다.
    renderTasks();
  }
}

function startEdit(id) {
  if (!findTask(id)) {
    return;
  }
  editingId = id;
  listMessage.textContent = "";
  renderTasks();
}

function cancelEdit() {
  editingId = null;
  listMessage.textContent = "";
  renderTasks();
}

async function saveEdit(id, item) {
  const title = item.querySelector(".edit-title").value.trim();
  const description = item.querySelector(".edit-description").value;
  const priority = item.querySelector(".edit-priority").value;
  const { dueDate, error: dueDateError } = parseDueDate(item.querySelector(".edit-due-date").value);

  const error =
    validateTitle(title) ??
    validateDescription(description) ??
    (isValidPriority(priority) ? null : "우선순위를 선택하세요.") ??
    dueDateError;
  if (error) {
    listMessage.textContent = error;
    return;
  }
  const body = { title, description, priority, due_date: dueDate };
  if (await mutate(() => request("PATCH", `/tasks/${id}`, body), listMessage)) {
    editingId = null;
    await loadTasks();
  }
}

async function deleteTask(id) {
  const task = findTask(id);
  if (!task || busy) {
    return;
  }
  // 취소하면 아무것도 바꾸지 않는다.
  if (!confirm(`"${task.title}" 할 일을 삭제할까요?`)) {
    return;
  }
  if (await mutate(() => request("DELETE", `/tasks/${id}`), listMessage)) {
    await loadTasks();
  }
}

function getItemId(element) {
  const item = element.closest("li[data-id]");
  return item ? Number(item.dataset.id) : null;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (connectionLost || busy) {
    return;
  }

  const title = titleInput.value.trim();
  const priority = priorityInput.value;
  const { dueDate, error: dueDateError } = parseDueDate(dueDateInput.value);
  const error =
    validateTitle(title) ?? (isValidPriority(priority) ? null : "우선순위를 선택하세요.") ?? dueDateError;
  if (error) {
    formMessage.textContent = error;
    titleInput.focus();
    return;
  }

  const body = { title, priority, due_date: dueDate };
  if (!(await mutate(() => request("POST", "/tasks", body), formMessage))) {
    return;
  }

  titleInput.value = "";
  priorityInput.value = DEFAULT_PRIORITY;
  dueDateInput.value = "";
  titleInput.focus();
  await loadTasks();
});

taskList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || busy) {
    return;
  }
  const id = getItemId(button);
  if (id === null) {
    return;
  }

  switch (button.dataset.action) {
    case "edit":
      startEdit(id);
      break;
    case "cancel":
      cancelEdit();
      break;
    case "save":
      saveEdit(id, button.closest("li"));
      break;
    case "delete":
      deleteTask(id);
      break;
  }
});

taskList.addEventListener("change", (event) => {
  if (!event.target.matches(".task-status")) {
    return;
  }
  const id = getItemId(event.target);
  if (id === null) {
    return;
  }
  if (busy) {
    renderTasks();
    return;
  }
  changeStatus(id, event.target.value);
});

taskList.addEventListener("keydown", (event) => {
  const item = event.target.closest("li.editing");
  if (!item) {
    return;
  }
  // 설명(textarea)에서는 Enter가 줄바꿈이므로 제목 입력칸에서만 Enter로 저장한다.
  if (event.key === "Enter" && !event.isComposing && event.target.matches(".edit-title")) {
    event.preventDefault();
    if (!busy) {
      saveEdit(getItemId(item), item);
    }
  } else if (event.key === "Escape") {
    cancelEdit();
  }
});

// 필터가 바뀌면 수정 중인 항목이 숨겨질 수 있으므로 수정을 취소하고 서버에서 다시 불러온다.
function onFilterChange() {
  clearTimeout(searchTimer);
  editingId = null;
  clearListError();
  loadTasks();
}

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(onFilterChange, SEARCH_DELAY_MS);
});
statusFilter.addEventListener("change", onFilterChange);
priorityFilter.addEventListener("change", onFilterChange);

retryButton.addEventListener("click", () => {
  loadTasks();
});

async function start() {
  renderTasks();
  if (!(await loadTasks())) {
    // 처음부터 서버에 연결할 수 없으면 등록을 막고, 다시 시도에 성공하면 풀어 준다.
    connectionLost = true;
    setFormEnabled(false);
    formMessage.textContent = "서버에 연결되면 등록할 수 있습니다.";
  }
}

start();
