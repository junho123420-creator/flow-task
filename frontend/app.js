// T01: 제목 입력·등록·목록 표시
// T02: localStorage(task-flow-v1) 저장·복원. 손상된 저장값은 덮어쓰지 않는다.

const TITLE_MAX_LENGTH = 100;
const STORAGE_KEY = "task-flow-v1";

let tasks = [];
let nextId = 1;
// 저장값이 손상되었거나 localStorage를 읽을 수 없으면 true. 이때는 저장(덮어쓰기)을 하지 않는다.
let storageBlocked = false;

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const formMessage = document.getElementById("form-message");
const taskList = document.getElementById("task-list");
const taskCount = document.getElementById("task-count");
const emptyMessage = document.getElementById("empty-message");
const submitButton = form.querySelector("button[type=submit]");

function isValidTask(task) {
  return (
    task !== null &&
    typeof task === "object" &&
    Number.isInteger(task.id) &&
    task.id > 0 &&
    typeof task.title === "string" &&
    typeof task.created_at === "string"
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
  return data;
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
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

function renderTasks() {
  taskList.replaceChildren();

  for (const task of tasks) {
    const item = document.createElement("li");
    item.dataset.id = String(task.id);
    // 사용자 입력은 HTML로 해석하지 않도록 textContent로 넣는다.
    item.textContent = task.title;
    taskList.appendChild(item);
  }

  taskCount.textContent = `(${tasks.length})`;
  emptyMessage.hidden = tasks.length > 0;
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
    created_at: new Date().toISOString(),
  };
  tasks.push(task);
  try {
    saveTasks();
  } catch (saveError) {
    // 저장에 실패하면 화면과 저장값이 달라지지 않도록 방금 추가한 항목을 되돌린다.
    tasks.pop();
    formMessage.textContent = "저장하지 못했습니다. 브라우저 저장 공간을 확인하세요.";
    console.error(saveError);
    return;
  }
  nextId++;

  formMessage.textContent = "";
  titleInput.value = "";
  titleInput.focus();
  renderTasks();
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
