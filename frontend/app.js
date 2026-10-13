// T01: 제목 입력·등록·목록 표시
// T02: localStorage(task-flow-v1) 저장·복원. 손상된 저장값은 덮어쓰지 않는다.
// T03: 상태 변경, 제목 수정, 삭제 확인. 모든 변경은 화면 순번이 아닌 id로 처리한다.
// T04: 설명·우선순위·마감일, 제목 검색과 상태·우선순위 필터(AND), 지연 표시.

const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 2000;
const STORAGE_KEY = "task-flow-v1";
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
const DEFAULT_STATUS = "TODO";
const DEFAULT_PRIORITY = "NORMAL";
const SAVE_ERROR_MESSAGE = "저장하지 못했습니다. 브라우저 저장 공간을 확인하세요.";

let tasks = [];
let nextId = 1;
// 저장값이 손상되었거나 localStorage를 읽을 수 없으면 true. 이때는 저장(덮어쓰기)을 하지 않는다.
let storageBlocked = false;
// 수정 중인 할 일의 id. 수정 중이 아니면 null.
let editingId = null;

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const priorityInput = document.getElementById("task-priority");
const dueDateInput = document.getElementById("task-due-date");
const formMessage = document.getElementById("form-message");
const searchInput = document.getElementById("filter-search");
const statusFilter = document.getElementById("filter-status");
const priorityFilter = document.getElementById("filter-priority");
const listMessage = document.getElementById("list-message");
const taskList = document.getElementById("task-list");
const taskCount = document.getElementById("task-count");
const emptyMessage = document.getElementById("empty-message");
const submitButton = form.querySelector("button[type=submit]");

function isValidStatus(status) {
  return STATUSES.some((item) => item.value === status);
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

function isValidTask(task) {
  return (
    task !== null &&
    typeof task === "object" &&
    Number.isInteger(task.id) &&
    task.id > 0 &&
    typeof task.title === "string" &&
    typeof task.created_at === "string" &&
    // 이전 단계에서 저장한 항목에는 아래 필드가 없을 수 있으므로 없는 경우는 허용한다.
    (task.status === undefined || isValidStatus(task.status)) &&
    (task.description === undefined || typeof task.description === "string") &&
    (task.priority === undefined || isValidPriority(task.priority)) &&
    (task.due_date === undefined || task.due_date === null || isValidDate(task.due_date))
  );
}

// 저장된 목록을 읽는다. 값이 없으면 빈 목록, 형식이 잘못되었으면 오류를 던진다.
function loadTasks() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    return [];
  }
  const data = JSON.parse(raw);
  if (!Array.isArray(data) || !data.every(isValidTask)) {
    throw new Error("저장 형식이 올바르지 않습니다.");
  }
  return data.map((task) => ({
    ...task,
    description: task.description ?? "",
    status: task.status ?? DEFAULT_STATUS,
    priority: task.priority ?? DEFAULT_PRIORITY,
    due_date: task.due_date ?? null,
  }));
}

function saveTasks(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// 새 목록을 먼저 저장하고, 성공했을 때만 화면 상태에 반영한다.
function commitTasks(nextTasks, messageElement) {
  try {
    saveTasks(nextTasks);
  } catch (saveError) {
    console.error(saveError);
    messageElement.textContent = SAVE_ERROR_MESSAGE;
    return false;
  }
  tasks = nextTasks;
  messageElement.textContent = "";
  return true;
}

// 저장값을 지키기 위해 등록을 막고 이유를 표시한다.
function blockStorage(message) {
  storageBlocked = true;
  for (const element of [titleInput, priorityInput, dueDateInput, submitButton]) {
    element.disabled = true;
  }
  formMessage.textContent = message;
}

// 공백 제거 후 1~100자인지 검사한다. 문제가 있으면 오류 메시지, 없으면 null을 반환한다.
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

// 제목 검색, 상태, 우선순위 조건을 모두 만족하는 항목만 남긴다.
function getVisibleTasks() {
  const keyword = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;
  const priority = priorityFilter.value;
  return tasks.filter(
    (task) =>
      (keyword === "" || task.title.toLowerCase().includes(keyword)) &&
      (status === "" || task.status === status) &&
      (priority === "" || task.priority === priority)
  );
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
  const visibleTasks = getVisibleTasks();
  const currentEditItem = taskList.querySelector("li.editing");
  taskList.replaceChildren(...visibleTasks.map((task) => createTaskItem(task, today, currentEditItem)));

  const filtered = visibleTasks.length !== tasks.length;
  taskCount.textContent = filtered ? `(${visibleTasks.length}/${tasks.length})` : `(${tasks.length})`;
  emptyMessage.textContent = tasks.length === 0 ? "등록된 할 일이 없습니다." : "조건에 맞는 할 일이 없습니다.";
  emptyMessage.hidden = visibleTasks.length > 0;

  const editItem = taskList.querySelector("li.editing");
  if (editItem && editItem !== currentEditItem) {
    editItem.querySelector(".edit-title").focus();
  }
}

function changeStatus(id, status) {
  if (!findTask(id) || !isValidStatus(status)) {
    renderTasks();
    return;
  }
  const nextTasks = tasks.map((task) => (task.id === id ? { ...task, status } : task));
  commitTasks(nextTasks, listMessage);
  // 저장에 실패하면 선택 상자를 원래 상태로 되돌리기 위해 항상 다시 그린다.
  renderTasks();
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

function saveEdit(id, item) {
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
  if (!findTask(id)) {
    cancelEdit();
    return;
  }
  const nextTasks = tasks.map((task) =>
    task.id === id ? { ...task, title, description, priority, due_date: dueDate } : task
  );
  if (commitTasks(nextTasks, listMessage)) {
    editingId = null;
    renderTasks();
  }
}

function deleteTask(id) {
  const task = findTask(id);
  if (!task) {
    return;
  }
  // 취소하면 아무것도 바꾸지 않는다.
  if (!confirm(`"${task.title}" 할 일을 삭제할까요?`)) {
    return;
  }
  const nextTasks = tasks.filter((item) => item.id !== id);
  if (commitTasks(nextTasks, listMessage)) {
    if (editingId === id) {
      editingId = null;
    }
    renderTasks();
  }
}

function getItemId(element) {
  const item = element.closest("li[data-id]");
  return item ? Number(item.dataset.id) : null;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  if (storageBlocked) {
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

  const task = {
    id: nextId,
    title,
    description: "",
    status: DEFAULT_STATUS,
    priority,
    due_date: dueDate,
    created_at: new Date().toISOString(),
  };
  if (!commitTasks([...tasks, task], formMessage)) {
    return;
  }
  nextId++;

  titleInput.value = "";
  priorityInput.value = DEFAULT_PRIORITY;
  dueDateInput.value = "";
  titleInput.focus();
  renderTasks();
});

taskList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || storageBlocked) {
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
  if (!event.target.matches(".task-status") || storageBlocked) {
    return;
  }
  const id = getItemId(event.target);
  if (id !== null) {
    changeStatus(id, event.target.value);
  }
});

taskList.addEventListener("keydown", (event) => {
  const item = event.target.closest("li.editing");
  if (!item) {
    return;
  }
  // 설명(textarea)에서는 Enter가 줄바꿈이므로 제목 입력칸에서만 Enter로 저장한다.
  if (event.key === "Enter" && !event.isComposing && event.target.matches(".edit-title")) {
    event.preventDefault();
    saveEdit(getItemId(item), item);
  } else if (event.key === "Escape") {
    cancelEdit();
  }
});

// 필터가 바뀌면 수정 중인 항목이 숨겨질 수 있으므로 수정을 취소하고 다시 그린다.
function onFilterChange() {
  editingId = null;
  listMessage.textContent = "";
  renderTasks();
}

searchInput.addEventListener("input", onFilterChange);
statusFilter.addEventListener("change", onFilterChange);
priorityFilter.addEventListener("change", onFilterChange);

try {
  tasks = loadTasks();
  nextId = tasks.reduce((max, task) => Math.max(max, task.id), 0) + 1;
} catch (loadError) {
  console.error(loadError);
  blockStorage(
    `저장된 데이터(${STORAGE_KEY})를 읽을 수 없어 등록을 중지했습니다. ` +
      "기존 저장값은 변경하지 않았습니다."
  );
}

renderTasks();
