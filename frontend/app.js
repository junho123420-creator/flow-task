// T01: 제목 입력·등록·목록 표시만 구현한다. 데이터는 메모리에만 있어 새로고침하면 사라진다.

const TITLE_MAX_LENGTH = 100;

const tasks = [];
let nextId = 1;

const form = document.getElementById("task-form");
const titleInput = document.getElementById("task-title");
const formMessage = document.getElementById("form-message");
const taskList = document.getElementById("task-list");
const taskCount = document.getElementById("task-count");
const emptyMessage = document.getElementById("empty-message");

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

  const title = titleInput.value.trim();
  const error = validateTitle(title);
  if (error) {
    formMessage.textContent = error;
    titleInput.focus();
    return;
  }

  tasks.push({
    id: nextId++,
    title,
    created_at: new Date().toISOString(),
  });

  formMessage.textContent = "";
  titleInput.value = "";
  titleInput.focus();
  renderTasks();
});

renderTasks();
