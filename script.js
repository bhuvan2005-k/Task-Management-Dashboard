const STORAGE_KEYS = {
  users: "users",
  currentUser: "currentUser",
  tasks: "tasks",
  theme: "taskflow.theme",
  ui: "taskflow.ui",
};

const ROUTES = {
  login: "index.html",
  signup: "signup.html",
  dashboard: "dashboard.html",
  tasks: "tasks.html",
  profile: "profile.html",
  about: "about.html",
};

const PRIORITY_WEIGHT = {
  high: 3,
  medium: 2,
  low: 1,
};

const PRIORITY_LABELS = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const STATUS_LABELS = {
  pending: "Pending",
  "in-progress": "In Progress",
  completed: "Completed",
};

const TAG_LABELS = {
  work: "Work",
  personal: "Personal",
  urgent: "Urgent",
};

const DEFAULT_UI_STATE = {
  search: "",
  tasks: {
    status: "all",
    priority: "all",
    sortBy: "dueDate",
  },
};

const APP = {
  page: document.body.dataset.page || "",
  users: [],
  tasks: [],
  uiState: DEFAULT_UI_STATE,
  theme: "light",
  currentUser: null,
};

document.addEventListener("DOMContentLoaded", bootstrap);

function bootstrap() {
  loadAppState();
  APP.theme = loadTheme();
  setTheme(APP.theme, false);

  if (!isAuthenticatedPage(APP.page) && APP.currentUser) {
    redirect(ROUTES.dashboard);
    return;
  }

  if (isAuthenticatedPage(APP.page) && !APP.currentUser) {
    redirect(ROUTES.login);
    return;
  }

  wireCommonChrome();

  switch (APP.page) {
    case "login":
      initLoginPage();
      break;
    case "signup":
      initSignupPage();
      break;
    case "dashboard":
      initDashboardPage();
      break;
    case "tasks":
      initTasksPage();
      break;
    case "profile":
      initProfilePage();
      break;
    case "about":
      initAboutPage();
      break;
    default:
      break;
  }
}

function loadAppState() {
  // Load users array
  APP.users = loadJson(STORAGE_KEYS.users, []);
  
  // Load all tasks
  APP.tasks = loadJson(STORAGE_KEYS.tasks, []);
  
  // Load UI state
  APP.uiState = sanitizeUiState(loadJson(STORAGE_KEYS.ui, DEFAULT_UI_STATE));

  // Load current user from localStorage
  const currentUserId = localStorage.getItem(STORAGE_KEYS.currentUser);
  if (currentUserId) {
    APP.currentUser = APP.users.find(user => user.id === currentUserId) || null;
  } else {
    APP.currentUser = null;
  }

  // Clean up invalid session
  if (currentUserId && !APP.currentUser) {
    localStorage.removeItem(STORAGE_KEYS.currentUser);
  }
}

function wireCommonChrome() {
  const themeToggle = document.querySelector("[data-theme-toggle]");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const nextTheme = APP.theme === "dark" ? "light" : "dark";
      setTheme(nextTheme, true);
    });
  }

  document.querySelectorAll("[data-logout]").forEach(button => {
    button.addEventListener("click", handleLogout);
  });

  syncNavState();
  syncUserChrome();
  wireGlobalSearch();
}

function syncNavState() {
  document.querySelectorAll("[data-nav-link]").forEach(link => {
    const isActive = link.dataset.navLink === APP.page;
    link.classList.toggle("active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function syncUserChrome() {
  const headerName = document.querySelector("[data-user-name]");
  const headerEmail = document.querySelector("[data-user-email]");
  const headerAvatar = document.querySelector("[data-user-avatar]");

  if (!APP.currentUser) return;

  if (headerName) headerName.textContent = APP.currentUser.name;
  if (headerEmail) headerEmail.textContent = APP.currentUser.email;
  if (headerAvatar) headerAvatar.textContent = getInitials(APP.currentUser.name);
}

function wireGlobalSearch() {
  const searchInput = document.querySelector("[data-global-search]");
  if (!searchInput) return;

  searchInput.value = APP.uiState.search;
  searchInput.addEventListener("input", event => {
    APP.uiState.search = event.target.value.trim().toLowerCase();
    persistUiState();
    if (APP.page === "dashboard") {
      renderDashboardPage();
    }
    if (APP.page === "tasks") {
      renderTasksPage();
    }
  });
}

function isAuthenticatedPage(page) {
  return ["dashboard", "tasks", "profile", "about"].includes(page);
}

function initLoginPage() {
  const form = document.getElementById("loginForm");
  const errorBox = document.getElementById("loginError");

  form.addEventListener("submit", event => {
    event.preventDefault();

    const email = getInputValue("loginEmail").toLowerCase();
    const password = getInputValue("loginPassword");
    const user = APP.users.find(entry => entry.email.toLowerCase() === email && entry.password === password);

    if (!user) {
      showInlineError(errorBox, "Invalid email or password.");
      return;
    }

    clearInlineError(errorBox);
    saveSession(user.id);
    redirect(ROUTES.dashboard);
  });
}

function initSignupPage() {
  const form = document.getElementById("signupForm");
  const errorBox = document.getElementById("signupError");

  form.addEventListener("submit", event => {
    event.preventDefault();

    const name = getInputValue("signupName");
    const email = getInputValue("signupEmail").toLowerCase();
    const password = getInputValue("signupPassword");

    if (name.length < 2 || password.length < 6) {
      showInlineError(errorBox, "Use a real name and a password with at least 6 characters.");
      return;
    }

    if (APP.users.some(user => user.email.toLowerCase() === email)) {
      showInlineError(errorBox, "An account with this email already exists.");
      return;
    }

    const user = {
      id: generateId(),
      name,
      email,
      password,
      createdAt: new Date().toISOString(),
    };

    APP.users = [user, ...APP.users];
    saveUsers();
    saveSession(user.id);
    clearInlineError(errorBox);
    redirect(ROUTES.dashboard);
  });
}

function initDashboardPage() {
  renderDashboardPage();
  const goToTasksButton = document.querySelector("[data-go-tasks]");
  if (goToTasksButton) {
    goToTasksButton.addEventListener("click", () => redirect(ROUTES.tasks));
  }
}

function renderDashboardPage() {
  const tasks = getCurrentUserTasks();
  const filteredTasks = filterTasks(tasks, APP.uiState.search);
  const recentTasks = sortTasks(filteredTasks, "createdAt").slice(0, 4);

  setText("dashboardTotalTasks", tasks.length);
  setText("dashboardCompletedTasks", tasks.filter(task => task.status === "completed").length);
  setText("dashboardPendingTasks", tasks.filter(task => task.status === "pending").length);
  setText("dashboardProgressLabel", getCompletionLabel(tasks));
  setProgressBar("dashboardProgressBar", getCompletionRate(tasks));

  const list = document.getElementById("recentTasksList");
  const emptyState = document.getElementById("recentTasksEmpty");
  const summary = document.getElementById("recentTasksSummary");

  if (summary) {
    summary.textContent = APP.uiState.search
      ? `Showing ${filteredTasks.length} of ${tasks.length} tasks for "${APP.uiState.search}"`
      : "Last 4 updated tasks";
  }

  if (!list) return;

  list.innerHTML = "";

  if (!recentTasks.length) {
    if (emptyState) emptyState.classList.remove("hidden");
    const emptyTitle = document.getElementById("dashboardEmptyTitle");
    const emptyCopy = document.getElementById("dashboardEmptyCopy");

    if (emptyTitle && emptyCopy) {
      if (APP.uiState.search) {
        emptyTitle.textContent = "No matching tasks";
        emptyCopy.textContent = `No tasks matched "${APP.uiState.search}". Try a different search term.`;
      } else {
        emptyTitle.textContent = "No tasks yet";
        emptyCopy.textContent = "Add a few tasks in the Tasks page to populate this overview.";
      }
    }
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");

  const fragment = document.createDocumentFragment();
  recentTasks.forEach(task => fragment.appendChild(buildTaskPreview(task)));
  list.appendChild(fragment);
}

function initTasksPage() {
  restoreTaskUiControls();
  bindTaskPageEvents();
  renderTasksPage();
}

function bindTaskPageEvents() {
  const form = document.getElementById("taskForm");
  const editorForm = document.getElementById("taskEditorForm");
  const list = document.getElementById("taskList");
  const closeButton = document.getElementById("closeTaskEditor");
  const cancelButton = document.getElementById("cancelTaskEditor");
  const overlay = document.getElementById("taskEditorOverlay");

  if (form) {
    form.addEventListener("submit", handleTaskCreate);
  }

  if (editorForm) {
    editorForm.addEventListener("submit", handleTaskUpdate);
  }

  const filterStatus = document.getElementById("taskStatusFilter");
  const filterPriority = document.getElementById("taskPriorityFilter");
  const sortSelect = document.getElementById("taskSortSelect");
  const taskSearch = document.getElementById("taskSearchInput");

  if (taskSearch) {
    taskSearch.addEventListener("input", event => {
      APP.uiState.search = event.target.value.trim().toLowerCase();
      persistUiState();
      renderTasksPage();
    });
  }

  if (filterStatus) {
    filterStatus.addEventListener("change", event => {
      APP.uiState.tasks.status = event.target.value;
      persistUiState();
      renderTasksPage();
    });
  }

  if (filterPriority) {
    filterPriority.addEventListener("change", event => {
      APP.uiState.tasks.priority = event.target.value;
      persistUiState();
      renderTasksPage();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener("change", event => {
      APP.uiState.tasks.sortBy = event.target.value;
      persistUiState();
      renderTasksPage();
    });
  }

  if (list) {
    list.addEventListener("click", handleTaskListClick);
  }

  if (closeButton) closeButton.addEventListener("click", closeTaskEditor);
  if (cancelButton) cancelButton.addEventListener("click", closeTaskEditor);

  if (overlay) {
    overlay.addEventListener("click", event => {
      if (event.target === overlay) {
        closeTaskEditor();
      }
    });
  }

  window.addEventListener("keydown", event => {
    if (event.key === "Escape") closeTaskEditor();
  });
}

function restoreTaskUiControls() {
  const taskSearch = document.getElementById("taskSearchInput");
  const filterStatus = document.getElementById("taskStatusFilter");
  const filterPriority = document.getElementById("taskPriorityFilter");
  const sortSelect = document.getElementById("taskSortSelect");

  if (taskSearch) taskSearch.value = APP.uiState.search;
  if (filterStatus) filterStatus.value = APP.uiState.tasks.status;
  if (filterPriority) filterPriority.value = APP.uiState.tasks.priority;
  if (sortSelect) sortSelect.value = APP.uiState.tasks.sortBy;
}

function handleTaskCreate(event) {
  event.preventDefault();

  const title = getInputValue("taskTitle");
  const priority = getInputValue("taskPriority") || "medium";
  const status = getInputValue("taskStatus") || "pending";
  const dueDate = getInputValue("taskDueDate");
  const tags = getCheckedValues("taskTag");

  if (!title) {
    return;
  }

  const task = normalizeTask({
    id: generateId(),
    userId: APP.currentUser.id,
    title,
    priority,
    status,
    dueDate,
    tags,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    previousStatus: status === "completed" ? "in-progress" : status,
  });

  const tasks = getCurrentUserTasks();
  saveCurrentUserTasks([task, ...tasks]);
  document.getElementById("taskForm").reset();
  setFormDefaults();
  renderTasksPage();
  showToast("Task added", `${task.title} was created successfully.`, "success");
}

function handleTaskUpdate(event) {
  event.preventDefault();

  const id = getInputValue("taskEditId");
  const title = getInputValue("taskEditTitle");
  if (!id || !title) return;

  const tasks = getCurrentUserTasks();
  const nextTasks = tasks.map(task => {
    if (task.id !== id) return task;

    const updatedStatus = getInputValue("taskEditStatus");
    return normalizeTask({
      ...task,
      userId: APP.currentUser.id,
      title,
      priority: getInputValue("taskEditPriority"),
      status: updatedStatus,
      dueDate: getInputValue("taskEditDueDate"),
      tags: getCheckedValues("taskEditTag"),
      updatedAt: new Date().toISOString(),
      previousStatus: updatedStatus === "completed" ? task.previousStatus || task.status || "in-progress" : updatedStatus,
    });
  });

  saveCurrentUserTasks(nextTasks);
  closeTaskEditor();
  renderTasksPage();
  showToast("Task updated", "Task changes were saved.", "info");
}

function handleTaskListClick(event) {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;

  const card = event.target.closest("[data-task-id]");
  if (!card) return;

  const taskId = card.dataset.taskId;
  const action = actionButton.dataset.action;

  if (action === "edit") {
    openTaskEditor(taskId);
    return;
  }

  if (action === "delete") {
    deleteTask(taskId);
    return;
  }

  if (action === "toggle-complete") {
    toggleTaskComplete(taskId);
  }
}

function renderTasksPage() {
  const tasks = getCurrentUserTasks();
  const filteredTasks = applyTaskFilters(tasks);
  const sortedTasks = sortTasks(filteredTasks, APP.uiState.tasks.sortBy);

  setText("taskCountLabel", `${sortedTasks.length} task${sortedTasks.length === 1 ? "" : "s"}`);
  renderTaskCards(sortedTasks);
  toggleEmptyState(sortedTasks.length === 0);
}

function renderTaskCards(tasks) {
  const list = document.getElementById("taskList");
  if (!list) return;

  list.innerHTML = "";

  if (!tasks.length) {
    return;
  }

  const fragment = document.createDocumentFragment();
  tasks.forEach(task => fragment.appendChild(buildTaskCard(task)));
  list.appendChild(fragment);
}

function buildTaskCard(task) {
  const article = document.createElement("article");
  const overdue = isTaskOverdue(task);
  article.className = `task-card${task.status === "completed" ? " completed" : ""}${overdue ? " task-overdue" : ""}`;
  article.dataset.taskId = task.id;

  article.innerHTML = `
    <div class="task-card-top">
      <div>
        <h3 class="card-title">${escapeHtml(task.title)}</h3>
        <div class="meta-row">
          <span class="badge ${task.priority}">${PRIORITY_LABELS[task.priority] || task.priority}</span>
          <span class="badge ${task.status}">${STATUS_LABELS[task.status] || task.status}</span>
          <span class="task-date">${formatDueDate(task.dueDate)}${overdue ? " • Overdue" : ""}</span>
        </div>
      </div>
      <span class="status-pill">
        <span class="status-dot"></span>
        ${STATUS_LABELS[task.status] || task.status}
      </span>
    </div>
    <div class="tag-row">${renderTaskTags(task.tags)}</div>
    <div class="task-actions">
      <button class="button button-secondary" type="button" data-action="toggle-complete">${task.status === "completed" ? "Reopen" : "Complete"}</button>
      <button class="button button-secondary" type="button" data-action="edit">Edit</button>
      <button class="button button-danger" type="button" data-action="delete">Delete</button>
    </div>
  `;

  return article;
}

function buildTaskPreview(task) {
  const article = document.createElement("article");
  const overdue = isTaskOverdue(task);
  article.className = `recent-item${task.status === "completed" ? " completed" : ""}${overdue ? " overdue" : ""}`;
  article.innerHTML = `
    <div class="preview-row">
      <div>
        <h3 class="preview-title">${escapeHtml(task.title)}</h3>
        <div class="preview-meta">
          <span class="badge ${task.priority}">${PRIORITY_LABELS[task.priority] || task.priority}</span>
          <span class="badge ${task.status}">${STATUS_LABELS[task.status] || task.status}</span>
        </div>
      </div>
      <span class="status-pill">
        <span class="status-dot"></span>
        ${formatDueDate(task.dueDate)}
      </span>
    </div>
    <div class="tag-row">${renderTaskTags(task.tags)}</div>
  `;
  return article;
}

function renderTaskTags(tags) {
  if (!tags || !tags.length) return "";
  return tags.map(tag => `<span class="tag-pill">${TAG_LABELS[tag] || tag}</span>`).join("");
}

function toggleEmptyState(isEmpty) {
  const emptyState = document.getElementById("taskEmptyState") || document.getElementById("recentTasksEmpty");
  const list = document.getElementById("taskList") || document.getElementById("recentTasksList");

  if (emptyState) {
    emptyState.classList.toggle("hidden", !isEmpty);
  }

  if (list) {
    list.classList.toggle("hidden", isEmpty);
  }
}

function openTaskEditor(taskId) {
  const task = getCurrentUserTasks().find(entry => entry.id === taskId);
  if (!task) return;

  setInputValue("taskEditId", task.id);
  setInputValue("taskEditTitle", task.title);
  setInputValue("taskEditPriority", task.priority);
  setInputValue("taskEditStatus", task.status);
  setInputValue("taskEditDueDate", task.dueDate || "");
  syncCheckboxGroup("taskEditTag", task.tags || []);

  const overlay = document.getElementById("taskEditorOverlay");
  if (overlay) {
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
  }

  const titleInput = document.getElementById("taskEditTitle");
  if (titleInput) titleInput.focus();
}

function closeTaskEditor() {
  const overlay = document.getElementById("taskEditorOverlay");
  const form = document.getElementById("taskEditorForm");

  if (overlay) {
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
  }

  if (form) {
    form.reset();
  }
}

function deleteTask(taskId) {
  const tasks = getCurrentUserTasks();
  const task = tasks.find(entry => entry.id === taskId);
  saveCurrentUserTasks(tasks.filter(entry => entry.id !== taskId));
  renderTasksPage();
  if (task) {
    showToast("Task deleted", `${task.title} was removed.`, "danger");
  }
}

function toggleTaskComplete(taskId) {
  const tasks = getCurrentUserTasks();
  const nextTasks = tasks.map(task => {
    if (task.id !== taskId) return task;

    if (task.status === "completed") {
      return normalizeTask({
        ...task,
        status: task.previousStatus || "in-progress",
        updatedAt: new Date().toISOString(),
      });
    }

    return normalizeTask({
      ...task,
      previousStatus: task.status,
      status: "completed",
      updatedAt: new Date().toISOString(),
    });
  });

  saveCurrentUserTasks(nextTasks);
  renderTasksPage();
}

function applyTaskFilters(tasks) {
  return tasks.filter(task => {
    const searchMatch = !APP.uiState.search || matchesSearch(task, APP.uiState.search);
    const statusMatch = APP.uiState.tasks.status === "all" || task.status === APP.uiState.tasks.status;
    const priorityMatch = APP.uiState.tasks.priority === "all" || task.priority === APP.uiState.tasks.priority;
    return searchMatch && statusMatch && priorityMatch;
  });
}

function matchesSearch(task, query) {
  const searchable = [task.title, task.priority, task.status, ...(task.tags || [])].join(" ").toLowerCase();
  return searchable.includes(query);
}

function sortTasks(tasks, sortBy) {
  const sorted = [...tasks];

  sorted.sort((firstTask, secondTask) => {
    if (sortBy === "priority") {
      return PRIORITY_WEIGHT[secondTask.priority] - PRIORITY_WEIGHT[firstTask.priority] || compareDateValues(secondTask.updatedAt, firstTask.updatedAt);
    }

    if (sortBy === "createdAt") {
      return compareDateValues(secondTask.createdAt, firstTask.createdAt);
    }

    return compareOptionalDates(firstTask.dueDate, secondTask.dueDate) || compareDateValues(secondTask.updatedAt, firstTask.updatedAt);
  });

  return sorted;
}

function initProfilePage() {
  renderProfilePage();
  const form = document.getElementById("profileForm");
  if (form) {
    form.addEventListener("submit", handleProfileSave);
  }
}

function renderProfilePage() {
  const user = APP.currentUser;
  if (!user) return;

  setText("profileDisplayName", user.name);
  setText("profileDisplayEmail", user.email);
  setText("profileAvatar", getInitials(user.name));
  setText("profileStatsTotal", getCurrentUserTasks().length);
  setText("profileStatsCompleted", getCurrentUserTasks().filter(task => task.status === "completed").length);
  setInputValue("profileName", user.name);
  setInputValue("profileEmail", user.email);
}

function handleProfileSave(event) {
  event.preventDefault();

  const name = getInputValue("profileName");
  const email = getInputValue("profileEmail").toLowerCase();

  if (!name || !email) return;

  if (APP.users.some(user => user.email.toLowerCase() === email && user.id !== APP.currentUser.id)) {
    showToast("Update blocked", "That email is already in use.", "danger");
    return;
  }

  APP.users = APP.users.map(user => {
    if (user.id !== APP.currentUser.id) return user;
    return { ...user, name, email };
  });

  saveUsers();
  APP.currentUser = APP.users.find(user => user.id === APP.currentUser.id) || APP.currentUser;
  syncUserChrome();
  renderProfilePage();
  showToast("Profile updated", "Your profile changes were saved.", "success");
}

function initAboutPage() {
  // Static content only.
}

function handleLogout() {
  localStorage.removeItem(STORAGE_KEYS.currentUser);
  APP.currentUser = null;
  redirect(ROUTES.login);
}

function setTheme(theme, animate = true) {
  APP.theme = theme;
  localStorage.setItem(STORAGE_KEYS.theme, theme);
  document.documentElement.dataset.theme = theme;

  const label = document.querySelectorAll("[data-theme-label]");
  const icon = document.querySelectorAll("[data-theme-icon]");
  label.forEach(node => {
    node.textContent = theme === "dark" ? "Dark" : "Light";
  });
  icon.forEach(node => {
    node.textContent = theme === "dark" ? "☾" : "☼";
  });

  if (animate) {
    document.documentElement.dataset.themeTransition = "true";
    window.setTimeout(() => {
      delete document.documentElement.dataset.themeTransition;
    }, 220);
  }
}

function loadTheme() {
  const stored = localStorage.getItem(STORAGE_KEYS.theme);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return cloneValue(fallback);
    return JSON.parse(raw);
  } catch {
    return cloneValue(fallback);
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function saveUsers() {
  saveJson(STORAGE_KEYS.users, APP.users);
}

function saveSession(userId) {
  localStorage.setItem(STORAGE_KEYS.currentUser, userId);
  APP.currentUser = APP.users.find(user => user.id === userId) || null;
}

function saveTasks() {
  saveJson(STORAGE_KEYS.tasks, APP.tasks);
}

function saveCurrentUserTasks(tasks) {
  if (!APP.currentUser) return;
  // Update APP.tasks with all tasks, maintaining tasks from other users
  APP.tasks = [
    ...APP.tasks.filter(task => task.userId !== APP.currentUser.id),
    ...tasks
  ];
  saveTasks();
}

function persistUiState() {
  saveJson(STORAGE_KEYS.ui, APP.uiState);
}

function sanitizeUiState(state) {
  const nextState = cloneValue(DEFAULT_UI_STATE);
  if (state && typeof state === "object") {
    nextState.search = typeof state.search === "string" ? state.search.trim().toLowerCase() : "";
    if (state.tasks && typeof state.tasks === "object") {
      nextState.tasks.status = ["all", "pending", "in-progress", "completed"].includes(state.tasks.status) ? state.tasks.status : nextState.tasks.status;
      nextState.tasks.priority = ["all", "high", "medium", "low"].includes(state.tasks.priority) ? state.tasks.priority : nextState.tasks.priority;
      nextState.tasks.sortBy = ["dueDate", "priority", "createdAt"].includes(state.tasks.sortBy) ? state.tasks.sortBy : nextState.tasks.sortBy;
    }
  }
  return nextState;
}

function getCurrentUserTasks() {
  if (!APP.currentUser) return [];
  return APP.tasks
    .filter(task => task.userId === APP.currentUser.id)
    .map(normalizeTask)
    .filter(Boolean);
}

function normalizeTask(task) {
  if (!task || typeof task !== "object") return null;

  const status = ["pending", "in-progress", "completed"].includes(task.status) ? task.status : "pending";
  const priority = ["high", "medium", "low"].includes(task.priority) ? task.priority : "medium";

  return {
    id: task.id || generateId(),
    userId: task.userId || "",
    title: typeof task.title === "string" ? task.title.trim() : "Untitled task",
    priority,
    status,
    dueDate: task.dueDate || "",
    tags: Array.isArray(task.tags) ? task.tags.filter(tag => Object.prototype.hasOwnProperty.call(TAG_LABELS, tag)) : [],
    createdAt: task.createdAt || new Date().toISOString(),
    updatedAt: task.updatedAt || task.createdAt || new Date().toISOString(),
    previousStatus: ["pending", "in-progress", "completed"].includes(task.previousStatus) ? task.previousStatus : status === "completed" ? "in-progress" : status,
  };
}

function filterTasks(tasks, query) {
  return tasks.filter(task => matchesSearch(task, query));
}

function getCompletionRate(tasks) {
  if (!tasks.length) return 0;
  return Math.round((tasks.filter(task => task.status === "completed").length / tasks.length) * 100);
}

function getCompletionLabel(tasks) {
  return `${getCompletionRate(tasks)}% complete`;
}

function setProgressBar(selectorOrId, value) {
  const element = document.getElementById(selectorOrId);
  if (element) {
    element.style.width = `${value}%`;
  }
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = String(value);
  }
}

function setInputValue(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.value = value;
  }
}

function getInputValue(id) {
  const element = document.getElementById(id);
  return element ? element.value.trim() : "";
}

function getCheckedValues(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(input => input.value);
}

function syncCheckboxGroup(name, values) {
  document.querySelectorAll(`input[name="${name}"]`).forEach(input => {
    input.checked = values.includes(input.value);
  });
}

function setFormDefaults() {
  const priority = document.getElementById("taskPriority");
  const status = document.getElementById("taskStatus");
  if (priority) priority.value = "medium";
  if (status) status.value = "pending";
  syncCheckboxGroup("taskTag", ["work"]);
}

function showToast(title, message, tone = "info") {
  const stack = document.querySelector("[data-toast-stack]");
  if (!stack) return;

  const toast = document.createElement("div");
  toast.className = `toast ${tone}`;
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
  stack.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 2600);
}

function showInlineError(target, message) {
  if (!target) return;
  target.textContent = message;
  target.classList.remove("hidden");
}

function clearInlineError(target) {
  if (!target) return;
  target.textContent = "";
  target.classList.add("hidden");
}

function getInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join("") || "U";
}

function generateId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function compareDateValues(firstValue, secondValue) {
  return new Date(firstValue).getTime() - new Date(secondValue).getTime();
}

function compareOptionalDates(firstDate, secondDate) {
  if (firstDate && secondDate) {
    return compareDateValues(firstDate, secondDate);
  }
  if (firstDate) return -1;
  if (secondDate) return 1;
  return 0;
}

function isTaskOverdue(task) {
  if (!task.dueDate || task.status === "completed") return false;
  const dueDate = new Date(`${task.dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDate < today;
}

function formatDueDate(value) {
  if (!value) return "No due date";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function redirect(route) {
  window.location.replace(route);
}
