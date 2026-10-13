// T01: 제목 입력·등록·목록 표시
// T02: localStorage(task-flow-v1) 저장·복원. 손상된 저장값은 덮어쓰지 않는다.
// T03: 상태 변경, 제목 수정, 삭제 확인. 모든 변경은 화면 순번이 아닌 id로 처리한다.

const TITLE_MAX_LENGTH = 100;
const STORAGE_KEY = "task-flow-v1";
const STATUSES = [
  { value: "TODO", label: "할 일" },
  { value: "DOING", label: "진행 중" },
  { value: "DONE", label: "완료" },
];
const DEFAULT_STATUS = "TODO";
const SAVE_ERROR_MESSAGE = "저장하지 못했습니다. 브라우저 저장 공간을 확인하세요.";

let tasks = [];
let nextId = 1;
// 저장값이 손상되었거나 localStorage를 읽을 수 없으면 true. 이때는 저장(덮어쓰기)을 하지 않는다.
let storageBlocked = false;
// 제목을 수정 중인 할 일의 id. 수정 중이 아니면 null.
let editingId = null;

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const formMessage = document.getElementById("form-message");
const listMessage = document.getElementById("list-message");
const taskList = document.getElementById("task-list");
const taskCount = document.getElementById("task-count");
const emptyMessage = document.getElementById("empty-message");
const submitButton = form.querySelector("button[type=submit]");

function isValidStatus(status) {
  return STATUSES.some((item) => item.value === status);
}

function isValidTask(task) {
  return (
    task !== null &&
    typeof task === "object" &&
    Number.isInteger(task.id) &&
    task.id > 0 &&
    typeof task.title === "string" &&
    typeof task.created_at === "string" &&
    // T02에서 저장한 항목에는 status가 없으므로 없는 경우는 허용한다.
    (task.status === undefined || isValidStatus(task.status))
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
  return data.map((task) => ({ ...task, status: task.status ?? DEFAULT_STATUS }));
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
  titleInput.disabled = true;
  submitButton.disabled = true;
  formMessage.textContent = message;
}

// 공백 제거 후 1~100자인지 검사한다. 문제가 있으면 오류 메시지, 없으면 null을 반환한다.
function validateTitle(title) {
  const length = Array.from(title).length;
  if (length === 0) {
    return "제목을 입력하세요.";
  }
  if (length > TITLE_MAX_LENGTH) {
    return `제목은 ${TITLE_MAX_LENGTH}자 이하로 입력하세요. (현재 ${length}자)`;
  }
  return null;
}

function findTask(id) {
  return tasks.find((task) => task.id === id);
}

function createButton(label, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = action;
  button.textContent = label;
  return button;
}

function createStatusSelect(task) {
  const select = document.createElement("select");
  select.className = "task-status";
  select.setAttribute("aria-label", "상태");
  for (const status of STATUSES) {
    const option = document.createElement("option");
    option.value = status.value;
    option.textContent = status.label;
    select.appendChild(option);
  }
  select.value = task.status;
  return select;
}

function createTaskItem(task) {
  const item = document.createElement("li");
  item.dataset.id = String(task.id);
  item.className = `task-item status-${task.status.toLowerCase()}`;

  if (task.id === editingId) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "edit-title";
    input.setAttribute("aria-label", "제목 수정");
    input.value = task.title;
    item.append(input, createButton("저장", "save"), createButton("취소", "cancel"));
    return item;
  }

  const title = document.createElement("span");
  title.className = "task-title";
  // 사용자 입력은 HTML로 해석하지 않도록 textContent로 넣는다.
  title.textContent = task.title;
  item.append(
    createStatusSelect(task),
    title,
    createButton("수정", "edit"),
    createButton("삭제", "delete")
  );
  return item;
}

function renderTasks() {
  taskList.replaceChildren(...tasks.map(createTaskItem));
  taskCount.textContent = `(${tasks.length})`;
  emptyMessage.hidden = tasks.length > 0;

  const editInput = taskList.querySelector(".edit-title");
  if (editInput) {
    editInput.focus();
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

function saveEdit(id, rawTitle) {
  const title = rawTitle.trim();
  const error = validateTitle(title);
  if (error) {
    listMessage.textContent = error;
    return;
  }
  if (!findTask(id)) {
    cancelEdit();
    return;
  }
  const nextTasks = tasks.map((task) => (task.id === id ? { ...task, title } : task));
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
  const error = validateTitle(title);
  if (error) {
    formMessage.textContent = error;
    titleInput.focus();
    return;
  }

  const task = {
    id: nextId,
    title,
    status: DEFAULT_STATUS,
    created_at: new Date().toISOString(),
  };
  if (!commitTasks([...tasks, task], formMessage)) {
    return;
  }
  nextId++;

  titleInput.value = "";
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
      saveEdit(id, button.closest("li").querySelector(".edit-title").value);
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
  if (!event.target.matches(".edit-title")) {
    return;
  }
  if (event.key === "Enter" && !event.isComposing) {
    event.preventDefault();
    saveEdit(getItemId(event.target), event.target.value);
  } else if (event.key === "Escape") {
    cancelEdit();
  }
});

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
