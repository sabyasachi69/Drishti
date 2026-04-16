const state = {
  authMode: "login",
  authUser: null,
  profile: null,
  courses: [],
  filteredCourses: null,
  recommendations: [],
  tasks: [],
  upcomingTasks: [],
  suggestedTasks: [],
  forums: [],
  groups: [],
  resources: [],
  offlinePacks: [],
  analytics: null,
  leaderboard: [],
  studyPlan: [],
  selectedForumId: null,
  setupError: ""
};

const routes = {
  dashboard: "Dashboard",
  courses: "Courses",
  tasks: "Tasks",
  forums: "Peer Forum",
  groups: "Study Groups",
  library: "Offline Library",
  analytics: "Analytics",
  profile: "Profile",
  contact: "Contact"
};

const appView = document.querySelector("#appView");
const pageTitle = document.querySelector("#pageTitle");
const profileCard = document.querySelector("#profileCard");
const statusStrip = document.querySelector("#statusStrip");
const refreshButton = document.querySelector("#refreshButton");
const logoutButton = document.querySelector("#logoutButton");
const quickPlanButton = document.querySelector("#quickPlanButton");

document.addEventListener("DOMContentLoaded", init);

function init() {
  bindEvents();
  loadSession();
}

function bindEvents() {
  window.addEventListener("hashchange", renderRoute);

  quickPlanButton.addEventListener("click", () => runAction(async () => {
    if (!state.profile) {
      renderAuth();
      return;
    }
    await loadRecommendations();
    location.hash = "#dashboard";
    renderRoute();
    showNotice("Recommendations refreshed from your saved profile, tasks, and course progress.", "success");
  }));

  refreshButton.addEventListener("click", () => runAction(async () => {
    if (!state.profile) {
      await loadSession();
      return;
    }
    await loadBootstrap(true);
    showNotice("Workspace refreshed from the database.", "success");
  }));

  logoutButton.addEventListener("click", () => runAction(async () => {
    await api("/api/auth/logout", { method: "POST", body: "{}" });
    resetWorkspace();
    renderAuth();
  }));

  document.addEventListener("click", (event) => runAction(() => handleClick(event)));
  document.addEventListener("submit", (event) => runAction(() => handleSubmit(event)));
}

async function loadSession() {
  setStatusLoading("Checking your DRISHTI session...");
  try {
    const data = await api("/api/auth/me");
    state.authUser = data.user;
    await loadBootstrap();
  } catch (error) {
    resetWorkspace();
    if (error.code === "SETUP_REQUIRED") {
      renderSetup(error.message);
      return;
    }
    if (error.status === 401) {
      renderAuth();
      return;
    }
    renderSetup(error.message || "DRISHTI could not start.");
  }
}

async function loadBootstrap(showLoading = false) {
  if (showLoading) setStatusLoading("Loading saved workspace...");
  const data = await api("/api/bootstrap");
  Object.assign(state, data);
  state.authUser = data.profile;
  state.filteredCourses = null;
  state.selectedForumId = state.selectedForumId || state.forums[0]?.id || null;
  renderChrome();
  renderRoute();
}

async function loadRecommendations() {
  const data = await api("/api/recommendations");
  state.recommendations = data.recommendations || [];
  state.upcomingTasks = data.upcomingTasks || [];
  state.suggestedTasks = data.suggestedTasks || [];
  state.studyPlan = data.studyPlan || [];
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "DRISHTI backend request failed");
    error.status = response.status;
    error.code = payload.code;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function runAction(action) {
  try {
    await action();
  } catch (error) {
    handleApiError(error);
  }
}

function handleApiError(error) {
  if (error.code === "SETUP_REQUIRED") {
    renderSetup(error.message);
    return;
  }
  if (error.status === 401) {
    resetWorkspace();
    renderAuth();
    showNotice("Please sign in again.", "notice");
    return;
  }
  showNotice(error.message || "Something went wrong.", "notice");
}

function resetWorkspace() {
  Object.assign(state, {
    authUser: null,
    profile: null,
    courses: [],
    filteredCourses: null,
    recommendations: [],
    tasks: [],
    upcomingTasks: [],
    suggestedTasks: [],
    forums: [],
    groups: [],
    resources: [],
    offlinePacks: [],
    analytics: null,
    leaderboard: [],
    studyPlan: [],
    selectedForumId: null
  });
}

function renderChrome() {
  renderProfile();
  renderStatusStrip();
  setActiveNav();
  logoutButton.hidden = !state.profile;
}

function renderProfile() {
  if (!state.profile) {
    profileCard.innerHTML = `
      <h2>Welcome</h2>
      <p>Sign in or create an account to use DRISHTI.</p>
    `;
    return;
  }

  profileCard.innerHTML = `
    <h2>${escapeHtml(state.profile.name)}</h2>
    <p>${escapeHtml(state.profile.grade || "Learner")} - ${escapeHtml(state.profile.district || "No district saved")}</p>
    <p>${escapeHtml(state.profile.languages.join(", ") || "English")}</p>
    <div class="profile-metrics">
      <span>${state.analytics?.totals?.xp || 0}<small>XP earned</small></span>
      <span>${state.profile.streak || 0}<small>day streak</small></span>
    </div>
  `;
}

function renderStatusStrip() {
  const totals = state.analytics?.totals || {};
  statusStrip.innerHTML = `
    <div><b>${totals.pendingTasks || 0}</b><span>Pending tasks</span></div>
    <div><b>${totals.completedCourses || 0}</b><span>Courses completed</span></div>
    <div><b>${state.offlinePacks.length || 0}</b><span>Offline packs</span></div>
    <div><b>${totals.studyGroups || 0}</b><span>Study groups</span></div>
  `;
}

function renderAuth() {
  pageTitle.textContent = state.authMode === "login" ? "Sign in" : "Create account";
  logoutButton.hidden = true;
  setActiveNav();
  profileCard.innerHTML = `
    <h2>DRISHTI Account</h2>
    <p>Your learning data is saved only after you sign in.</p>
  `;
  statusStrip.innerHTML = `
    <div><b>1</b><span>Account</span></div>
    <div><b>2</b><span>Profile</span></div>
    <div><b>3</b><span>Tasks</span></div>
    <div><b>4</b><span>Recommendations</span></div>
  `;
  appView.innerHTML = authTemplate();
}

function renderSetup(message) {
  state.setupError = message;
  pageTitle.textContent = "Database setup";
  logoutButton.hidden = true;
  profileCard.innerHTML = `
    <h2>Setup needed</h2>
    <p>DRISHTI is refusing to fake user data.</p>
  `;
  statusStrip.innerHTML = `
    <div><b>DB</b><span>Postgres required</span></div>
    <div><b>Auth</b><span>Session table required</span></div>
    <div><b>Data</b><span>Migrations required</span></div>
    <div><b>Live</b><span>No demo fallback</span></div>
  `;
  appView.innerHTML = `
    <section class="panel setup-panel">
      <p class="eyebrow">Real backend required</p>
      <h2>${escapeHtml(message || "Connect a Postgres database to continue.")}</h2>
      <p class="muted">DRISHTI now stores accounts, sessions, tasks, course progress, forums, groups, and messages in Postgres. Without a database URL, the app will not pretend to work.</p>
      <div class="setup-steps">
        <div><strong>1. Add Postgres</strong><span class="muted">Create a Neon Postgres database from Vercel Marketplace or use your own Postgres instance.</span></div>
        <div><strong>2. Set DATABASE_URL</strong><span class="muted">Add the pooled connection string to Vercel and to local .env.local.</span></div>
        <div><strong>3. Run migration</strong><span class="muted">Run npm run db:migrate to create the tables and starter catalog.</span></div>
      </div>
    </section>
  `;
}

function renderRoute() {
  if (!state.profile) {
    if (state.setupError) renderSetup(state.setupError);
    else renderAuth();
    return;
  }

  const route = currentRoute();
  pageTitle.textContent = routes[route] || "Dashboard";
  setActiveNav();

  if (route === "courses") return renderCourses();
  if (route === "tasks") return renderTasks();
  if (route === "forums") return renderForums();
  if (route === "groups") return renderGroups();
  if (route === "library") return renderLibrary();
  if (route === "analytics") return renderAnalytics();
  if (route === "profile") return renderProfilePage();
  if (route === "contact") return renderContact();
  renderDashboard();
}

function currentRoute() {
  const route = (location.hash || "#dashboard").replace("#", "");
  return routes[route] ? route : "dashboard";
}

function setActiveNav() {
  const route = currentRoute();
  document.querySelectorAll(".app-nav a").forEach((link) => {
    link.classList.toggle("active", state.profile && link.dataset.route === route);
  });
}

function authTemplate() {
  const isRegister = state.authMode === "register";
  return `
    <section class="auth-layout">
      <div class="auth-panel panel">
        <p class="eyebrow">${isRegister ? "New account" : "Welcome back"}</p>
        <h2>${isRegister ? "Create your learner workspace." : "Continue your saved learning path."}</h2>
        <form id="authForm" class="form-grid">
          <input type="hidden" name="mode" value="${state.authMode}" />
          ${isRegister ? `
            <div class="field full-row">
              <label for="authName">Name</label>
              <input id="authName" name="name" autocomplete="name" required />
            </div>
          ` : ""}
          <div class="field full-row">
            <label for="authEmail">Email</label>
            <input id="authEmail" name="email" type="email" autocomplete="email" required />
          </div>
          <div class="field full-row">
            <label for="authPassword">Password</label>
            <input id="authPassword" name="password" type="password" autocomplete="${isRegister ? "new-password" : "current-password"}" minlength="8" required />
          </div>
          ${isRegister ? registerProfileFields() : ""}
          <div class="field full-row">
            <button class="button" type="submit">${isRegister ? "Create account" : "Sign in"}</button>
          </div>
        </form>
        <div class="auth-switch">
          <button class="ghost small" data-auth-mode="${isRegister ? "login" : "register"}" type="button">
            ${isRegister ? "I already have an account" : "Create a new account"}
          </button>
        </div>
      </div>
      <div class="panel">
        <p class="eyebrow">Stored for real</p>
        <h2>No temporary learner profile.</h2>
        <p class="muted">Your account creates database rows for the user, session, first task, progress, and future recommendations.</p>
      </div>
    </section>
  `;
}

function registerProfileFields() {
  return `
    <div class="field">
      <label for="authGrade">Grade or role</label>
      <input id="authGrade" name="grade" placeholder="Class 11, Teacher, Mentor" />
    </div>
    <div class="field">
      <label for="authDistrict">District</label>
      <input id="authDistrict" name="district" placeholder="Cuttack" />
    </div>
    <div class="field">
      <label for="authLevel">Level</label>
      <select id="authLevel" name="level">
        <option>Beginner</option>
        <option>Intermediate</option>
        <option>All Levels</option>
      </select>
    </div>
    <div class="field">
      <label for="authPace">Pace</label>
      <select id="authPace" name="pace">
        <option>Gentle</option>
        <option selected>Balanced</option>
        <option>Fast</option>
      </select>
    </div>
    <div class="field full-row">
      <label for="authLanguages">Languages</label>
      <input id="authLanguages" name="languages" placeholder="English, Hindi, Odia" />
    </div>
    <div class="field full-row">
      <label for="authGoals">Goals</label>
      <input id="authGoals" name="goals" placeholder="AI, Mathematics, Peer Teaching" />
    </div>
    <div class="field full-row">
      <label for="authInterests">Interests</label>
      <input id="authInterests" name="interests" placeholder="Projects, Exam Prep, Career" />
    </div>
    <div class="field full-row checkbox-field">
      <label>
        <input name="offlineFirst" type="checkbox" />
        Prioritize offline-ready learning
      </label>
    </div>
  `;
}

function renderDashboard() {
  const topRecommendations = state.recommendations.slice(0, 3);
  appView.innerHTML = `
    <div class="view-grid">
      <div>
        <section class="panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Upcoming tasks</p>
              <h2>Do the next useful thing.</h2>
            </div>
            <a class="ghost small" href="#tasks">Manage tasks</a>
          </div>
          <div class="task-list">
            ${state.upcomingTasks.length ? state.upcomingTasks.slice(0, 4).map(taskTemplate).join("") : emptyState("No pending tasks. Add one or enroll in a course.")}
          </div>
        </section>

        <section class="panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Course recommendations</p>
              <h2>Based on saved profile and progress.</h2>
            </div>
            <a class="ghost small" href="#courses">View catalog</a>
          </div>
          <div class="course-grid">
            ${topRecommendations.length ? topRecommendations.map(courseCard).join("") : emptyState("No courses found. Run the migration to seed the catalog.")}
          </div>
        </section>
      </div>

      <div>
        <section class="panel brand-panel">
          <img src="/assets/drishti-logo.png" alt="DRISHTI vision of opportunities" />
          <div>
            <p class="eyebrow">Vision of opportunities</p>
            <h2>Learning records that stay with the learner.</h2>
          </div>
        </section>

        <section class="panel">
          <p class="eyebrow">Suggested tasks</p>
          <h2>Recommended next steps</h2>
          <div class="suggestion-list">
            ${state.suggestedTasks.length ? state.suggestedTasks.map(suggestedTaskTemplate).join("") : emptyState("No extra suggestions right now.")}
          </div>
        </section>

        <section class="panel">
          <p class="eyebrow">Daily plan</p>
          <h2>Three focused moves</h2>
          <div class="plan-list">
            ${state.studyPlan.length ? state.studyPlan.map(planItemTemplate).join("") : emptyState("Your plan appears after tasks or courses are available.")}
          </div>
        </section>
      </div>
    </div>
  `;
}

function renderCourses() {
  const courses = state.filteredCourses || state.courses;
  appView.innerHTML = `
    <section class="panel">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Course catalog</p>
          <h2>Find a path and save progress.</h2>
        </div>
      </div>
      <form class="filter-bar" id="courseFilterForm">
        <input name="query" type="search" placeholder="Search AI, math, science, teaching" />
        <select name="level" aria-label="Level">
          <option value="">Any level</option>
          <option>Beginner</option>
          <option>Intermediate</option>
          <option>All Levels</option>
        </select>
        <select name="language" aria-label="Language">
          <option value="">Any language</option>
          <option>English</option>
          <option>Hindi</option>
          <option>Odia</option>
        </select>
        <select name="mode" aria-label="Mode">
          <option value="">Any mode</option>
          <option value="offline">Offline ready</option>
        </select>
        <button class="button" type="submit">Apply</button>
      </form>
      <div class="course-grid">
        ${courses.length ? courses.map(courseCard).join("") : emptyState("No courses matched this search.")}
      </div>
    </section>
  `;
}

function renderTasks() {
  const pending = state.tasks.filter((task) => task.status !== "done");
  const done = state.tasks.filter((task) => task.status === "done");
  appView.innerHTML = `
    <div class="view-grid">
      <section class="panel">
        <p class="eyebrow">Your tasks</p>
        <h2>Save real work with due dates.</h2>
        <form id="taskForm" class="form-grid">
          <div class="field full-row">
            <label for="taskTitle">Task</label>
            <input id="taskTitle" name="title" placeholder="Finish algebra practice set" required />
          </div>
          <div class="field full-row">
            <label for="taskDescription">Notes</label>
            <textarea id="taskDescription" name="description" placeholder="What does done look like?"></textarea>
          </div>
          <div class="field">
            <label for="taskDue">Due date</label>
            <input id="taskDue" name="dueAt" type="datetime-local" />
          </div>
          <div class="field">
            <label for="taskPriority">Priority</label>
            <select id="taskPriority" name="priority">
              <option value="1">Normal</option>
              <option value="2">High</option>
              <option value="3">Urgent</option>
            </select>
          </div>
          <div class="field full-row">
            <button class="button" type="submit">Add task</button>
          </div>
        </form>
      </section>
      <section>
        <div class="panel">
          <p class="eyebrow">Pending</p>
          <h2>Upcoming</h2>
          <div class="task-list">${pending.length ? pending.map(taskTemplate).join("") : emptyState("No pending tasks.")}</div>
        </div>
        <div class="panel">
          <p class="eyebrow">Completed</p>
          <h2>Finished work</h2>
          <div class="task-list">${done.length ? done.slice(0, 8).map(taskTemplate).join("") : emptyState("No completed tasks yet.")}</div>
        </div>
      </section>
    </div>
  `;
}

function renderForums() {
  const selectedForum = state.forums.find((forum) => forum.id === state.selectedForumId) || state.forums[0];
  appView.innerHTML = `
    <div class="forum-layout">
      <section class="panel">
        <p class="eyebrow">Peer forum</p>
        <h2>Ask, explain, and support peers.</h2>
        <p class="muted">Posts are stored in the database and count toward learning activity.</p>
        <div class="tag-row">
          ${state.forums.map((forum) => `
            <button class="ghost small" data-forum-select="${escapeHtml(forum.id)}" type="button">${escapeHtml(forum.subject)}</button>
          `).join("")}
        </div>
        <form id="forumPostForm" class="composer">
          <input type="hidden" name="forumId" value="${escapeHtml(selectedForum?.id || "")}" />
          <div class="field">
            <label for="forumText">New question or explanation</label>
            <textarea id="forumText" name="text" placeholder="Share a doubt, explanation, or peer teaching prompt" required></textarea>
          </div>
          <div class="form-actions">
            <button class="button" type="submit">Post to forum</button>
          </div>
        </form>
      </section>

      <section class="panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">${escapeHtml(selectedForum?.members || 0)} contributors</p>
            <h2>${escapeHtml(selectedForum?.subject || "Forum")}</h2>
          </div>
        </div>
        <p class="muted">${escapeHtml(selectedForum?.description || "")}</p>
        <div class="forum-list">
          ${(selectedForum?.posts || []).length ? selectedForum.posts.map(postTemplate).join("") : emptyState("No posts yet. Start the first thread.")}
        </div>
      </section>
    </div>
  `;
}

function renderGroups() {
  appView.innerHTML = `
    <div class="group-layout">
      <section class="panel">
        <p class="eyebrow">Study groups</p>
        <h2>Build a circle around a goal.</h2>
        <form id="groupForm" class="form-grid">
          <div class="field">
            <label for="groupName">Group name</label>
            <input id="groupName" name="name" placeholder="Biology Sprint" required />
          </div>
          <div class="field">
            <label for="groupSubject">Subject</label>
            <input id="groupSubject" name="subject" placeholder="Science" required />
          </div>
          <div class="field">
            <label for="groupMeeting">Meeting time</label>
            <input id="groupMeeting" name="meeting" placeholder="Fri 6:00 PM" />
          </div>
          <div class="field">
            <label for="groupCapacity">Seats</label>
            <input id="groupCapacity" name="capacity" type="number" min="2" max="40" value="10" />
          </div>
          <div class="field full-row">
            <button class="button" type="submit">Create group</button>
          </div>
        </form>
      </section>

      <section class="group-list">
        ${state.groups.length ? state.groups.map(groupTemplate).join("") : emptyState("No study groups yet.")}
      </section>
    </div>
  `;
}

function renderLibrary() {
  const offlineCourses = state.courses.filter((course) => course.offlineReady);
  appView.innerHTML = `
    <div class="library-layout">
      <section class="panel">
        <p class="eyebrow">Offline packs</p>
        <h2>Prepare a manifest for low connectivity.</h2>
        <form id="offlinePackForm" class="form-grid">
          <div class="field">
            <label for="courseId">Course</label>
            <select id="courseId" name="courseId" required>
              ${offlineCourses.map((course) => `<option value="${escapeHtml(course.id)}">${escapeHtml(course.title)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="packLanguage">Language</label>
            <select id="packLanguage" name="language">
              ${state.profile.languages.map((language) => `<option>${escapeHtml(language)}</option>`).join("")}
            </select>
          </div>
          <div class="field full-row">
            <button class="button" type="submit">Build offline pack</button>
          </div>
        </form>
      </section>

      <section>
        <div class="panel">
          <p class="eyebrow">Saved packs</p>
          <h2>Download manifests</h2>
          <div class="resource-list">
            ${state.offlinePacks.length ? state.offlinePacks.map(packTemplate).join("") : emptyState("No offline packs yet.")}
          </div>
        </div>
        <div class="panel">
          <p class="eyebrow">Resources</p>
          <h2>Available offline resources</h2>
          <div class="resource-list">
            ${state.resources.length ? state.resources.map(resourceTemplate).join("") : emptyState("No resources found.")}
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderAnalytics() {
  const analytics = state.analytics;
  const maxXp = Math.max(1, ...(analytics?.daily || []).map((day) => day.xp));
  appView.innerHTML = `
    <div class="analytics-layout">
      <section>
        <div class="metric-grid">
          ${metricTemplate("Total XP", analytics?.totals?.xp || 0)}
          ${metricTemplate("Completed tasks", analytics?.totals?.completedTasks || 0)}
          ${metricTemplate("Completed courses", analytics?.totals?.completedCourses || 0)}
          ${metricTemplate("Forum posts", analytics?.totals?.forumPosts || 0)}
        </div>
        <div class="panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Learning activity</p>
              <h2>Weekly XP</h2>
            </div>
            <button class="button small" data-action="refresh-analytics" type="button">Refresh</button>
          </div>
          <div class="chart">
            ${(analytics?.daily || []).map((day) => `
              <div class="bar">
                <span>${day.xp} XP</span>
                <div class="bar-fill" style="height:${Math.max(8, Math.round((day.xp / maxXp) * 145))}px"></div>
                <span>${escapeHtml(day.day)}</span>
              </div>
            `).join("")}
          </div>
        </div>
      </section>

      <section>
        <div class="panel">
          <p class="eyebrow">Badges</p>
          <h2>Unlocked from activity</h2>
          <div class="tag-row">
            ${(analytics?.badges || []).length ? analytics.badges.map((badge) => `<span class="pill gold">${escapeHtml(badge)}</span>`).join("") : `<span class="tag">No badges yet</span>`}
          </div>
        </div>
        <div class="panel">
          <p class="eyebrow">Next best action</p>
          ${analytics?.nextBestAction ? `
            <h2>${escapeHtml(analytics.nextBestAction.title)}</h2>
            <p class="muted">${escapeHtml(analytics.nextBestAction.description)}</p>
            <div class="card-actions">
              <button class="button small" data-course-enroll="${escapeHtml(analytics.nextBestAction.id)}" type="button">Enroll</button>
              <button class="ghost small complete" data-course-id="${escapeHtml(analytics.nextBestAction.id)}" type="button">Mark complete</button>
            </div>
          ` : emptyState("Complete your profile to get a next action.")}
        </div>
        <div class="panel">
          <p class="eyebrow">Learner momentum</p>
          <h2>Leaderboard</h2>
          <div class="leaderboard">
            ${state.leaderboard.length ? state.leaderboard.map(leaderboardTemplate).join("") : emptyState("No learner activity yet.")}
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderProfilePage() {
  appView.innerHTML = `
    <section class="panel">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Learner profile</p>
          <h2>Keep recommendations grounded.</h2>
        </div>
      </div>
      ${profileForm()}
    </section>
  `;
}

function renderContact() {
  appView.innerHTML = `
    <div class="view-grid">
      <section class="contact-panel panel">
        <p class="eyebrow">Contact</p>
        <h2>Send a real database-backed message.</h2>
        <form id="contactForm" class="form-grid">
          <div class="field">
            <label for="contactName">Name</label>
            <input id="contactName" name="name" value="${escapeHtml(state.profile.name || "")}" required />
          </div>
          <div class="field">
            <label for="contactEmail">Email</label>
            <input id="contactEmail" name="email" type="email" value="${escapeHtml(state.profile.email || "")}" required />
          </div>
          <div class="field">
            <label for="organization">Organization</label>
            <input id="organization" name="organization" placeholder="School, NGO, college, company" />
          </div>
          <div class="field">
            <label for="interest">Interest</label>
            <select id="interest" name="interest">
              <option>Pilot Program</option>
              <option>Education Partnership</option>
              <option>Investor Demo</option>
              <option>Technical Collaboration</option>
            </select>
          </div>
          <div class="field full-row">
            <label for="message">Message</label>
            <textarea id="message" name="message" required placeholder="Tell us what you want to build with DRISHTI."></textarea>
          </div>
          <div class="field full-row">
            <button class="button" type="submit">Send message</button>
          </div>
        </form>
      </section>
      <section class="panel">
        <p class="eyebrow">Stored fields</p>
        <h2>Contacts table</h2>
        <p class="muted">Messages include account id when signed in, name, email, organization, interest, message, and created timestamp.</p>
      </section>
    </div>
  `;
}

function profileForm() {
  return `
    <form id="profileForm" class="form-grid">
      <div class="field">
        <label for="profileName">Name</label>
        <input id="profileName" name="name" value="${escapeHtml(state.profile.name || "")}" />
      </div>
      <div class="field">
        <label for="profileGrade">Grade or role</label>
        <input id="profileGrade" name="grade" value="${escapeHtml(state.profile.grade || "")}" />
      </div>
      <div class="field">
        <label for="profileDistrict">District</label>
        <input id="profileDistrict" name="district" value="${escapeHtml(state.profile.district || "")}" />
      </div>
      <div class="field">
        <label for="profileLevel">Level</label>
        <select id="profileLevel" name="level">
          ${["Beginner", "Intermediate", "All Levels"].map((level) => `<option ${state.profile.level === level ? "selected" : ""}>${level}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label for="profilePace">Pace</label>
        <select id="profilePace" name="pace">
          ${["Gentle", "Balanced", "Fast"].map((pace) => `<option ${state.profile.pace === pace ? "selected" : ""}>${pace}</option>`).join("")}
        </select>
      </div>
      <div class="field full-row">
        <label for="profileLanguages">Languages</label>
        <input id="profileLanguages" name="languages" value="${escapeHtml(state.profile.languages.join(", "))}" />
      </div>
      <div class="field full-row">
        <label for="profileGoals">Goals</label>
        <input id="profileGoals" name="goals" value="${escapeHtml(state.profile.goals.join(", "))}" />
      </div>
      <div class="field full-row">
        <label for="profileInterests">Interests</label>
        <input id="profileInterests" name="interests" value="${escapeHtml(state.profile.interests.join(", "))}" />
      </div>
      <div class="field full-row checkbox-field">
        <label>
          <input name="offlineFirst" type="checkbox" ${state.profile.offlineFirst ? "checked" : ""} />
          Prioritize offline-ready learning
        </label>
      </div>
      <div class="field full-row">
        <button class="button" type="submit">Save profile</button>
      </div>
    </form>
  `;
}

function courseCard(course) {
  const completed = course.progressStatus === "completed";
  const status = course.progressStatus ? course.progressStatus.replace("_", " ") : "not enrolled";
  return `
    <article class="course-card ${completed ? "completed" : ""}">
      <div class="course-top">
        <div>
          <p class="eyebrow">${escapeHtml(course.provider)}</p>
          <h3>${escapeHtml(course.title)}</h3>
        </div>
        <span class="fit-pill">${course.fit ? `${course.fit}% fit` : escapeHtml(status)}</span>
      </div>
      <p class="muted description">${escapeHtml(course.description)}</p>
      <div class="tag-row">${course.tags.slice(0, 3).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
      <div class="course-meta">${escapeHtml(course.level)} - ${course.durationHours}h - ${escapeHtml(course.languages.join(", "))}${course.offlineReady ? " - Offline ready" : ""}</div>
      ${course.reasons ? `<p class="muted reason-line">${escapeHtml(course.reasons.join(" / "))}</p>` : ""}
      <div class="card-actions">
        ${completed ? `<span class="pill gold">Completed</span>` : `<button class="button small" data-course-enroll="${escapeHtml(course.id)}" type="button">${course.progressStatus ? "Continue" : "Enroll"}</button>`}
        ${completed ? "" : `<button class="ghost small complete" data-course-id="${escapeHtml(course.id)}" type="button">Mark complete</button>`}
        ${course.offlineReady ? `<button class="ghost small offline" data-course-id="${escapeHtml(course.id)}" type="button">Save offline</button>` : ""}
      </div>
    </article>
  `;
}

function taskTemplate(task) {
  const done = task.status === "done";
  return `
    <article class="task-card ${done ? "completed" : ""}">
      <div>
        <p class="eyebrow">${escapeHtml(task.source)}${task.dueAt ? ` - Due ${formatDate(task.dueAt)}` : ""}</p>
        <h3>${escapeHtml(task.title)}</h3>
        ${task.description ? `<p class="muted">${escapeHtml(task.description)}</p>` : ""}
      </div>
      <div class="card-actions">
        ${done ? `<span class="pill gold">Done</span>` : `<button class="button small" data-complete-task="${escapeHtml(task.id)}" type="button">Complete</button>`}
      </div>
    </article>
  `;
}

function suggestedTaskTemplate(task, index) {
  return `
    <article class="task-card">
      <div>
        <p class="eyebrow">Recommendation</p>
        <h3>${escapeHtml(task.title)}</h3>
        <p class="muted">${escapeHtml(task.reason || "Useful next step")}</p>
      </div>
      <div class="card-actions">
        <button class="ghost small" data-add-suggested="${index}" type="button">Add to tasks</button>
      </div>
    </article>
  `;
}

function planItemTemplate(item) {
  return `
    <div class="plan-item">
      <strong>Day ${item.day}: ${escapeHtml(item.title)}</strong>
      <span class="muted">${escapeHtml(item.detail || item.action || "")}</span>
    </div>
  `;
}

function leaderboardTemplate(item, index) {
  return `
    <div class="leaderboard-item">
      <strong>${index + 1}. ${escapeHtml(item.name)}</strong>
      <span class="muted">${escapeHtml(item.district || "No district")} - ${item.xp} XP - ${item.completedCourses} courses</span>
    </div>
  `;
}

function postTemplate(post) {
  return `
    <article class="forum-post">
      <p class="eyebrow">${escapeHtml(post.author)} - ${escapeHtml(post.role)}</p>
      <h3>${escapeHtml(post.text)}</h3>
      <div class="tag-row">
        <span class="pill">${post.likes} likes</span>
        <span class="tag">${formatDate(post.createdAt)}</span>
      </div>
      <div class="card-actions">
        <button class="ghost small" data-like-post="${escapeHtml(post.id)}" type="button">Like</button>
      </div>
    </article>
  `;
}

function groupTemplate(group) {
  const joined = group.members.includes(state.profile.id);
  return `
    <article class="group-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">${escapeHtml(group.subject)}</p>
          <h3>${escapeHtml(group.name)}</h3>
        </div>
        <span class="pill ${joined ? "gold" : ""}">${group.members.length}/${group.capacity}</span>
      </div>
      <p class="muted">Mentor: ${escapeHtml(group.mentor)} - ${escapeHtml(group.meeting)}</p>
      <div class="progress-track"><div class="progress-bar" style="width:${Number(group.progress || 0)}%"></div></div>
      <div class="tag-row">
        ${group.tasks.slice(0, 3).map((task) => `<span class="tag">${escapeHtml(task)}</span>`).join("")}
      </div>
      <div class="card-actions">
        <button class="${joined ? "ghost" : "button"} small" data-join-group="${escapeHtml(group.id)}" type="button">${joined ? "Joined" : "Join group"}</button>
      </div>
    </article>
  `;
}

function packTemplate(pack) {
  const course = state.courses.find((item) => item.id === pack.courseId);
  return `
    <article class="resource-card">
      <p class="eyebrow">${escapeHtml(pack.language)} pack</p>
      <h3>${escapeHtml(course?.title || "Offline pack")}</h3>
      <p class="muted">Ready until ${formatDate(pack.expiresAt)} - ${pack.resourceIds.length} resource links</p>
      <div class="card-actions">
        <button class="button small" data-download-pack="${escapeHtml(pack.id)}" type="button">Download manifest</button>
      </div>
    </article>
  `;
}

function resourceTemplate(resource) {
  return `
    <article class="resource-card">
      <p class="eyebrow">${escapeHtml(resource.type)} - ${escapeHtml(resource.language)}</p>
      <h3>${escapeHtml(resource.title)}</h3>
      <p class="muted">${resource.sizeMb} MB - ${resource.tags.map(escapeHtml).join(", ")}</p>
    </article>
  `;
}

function metricTemplate(label, value) {
  return `
    <div class="metric-card">
      <strong>${value}</strong>
      <span class="muted">${escapeHtml(label)}</span>
    </div>
  `;
}

async function handleClick(event) {
  const authModeButton = event.target.closest("[data-auth-mode]");
  if (authModeButton) {
    state.authMode = authModeButton.dataset.authMode;
    renderAuth();
    return;
  }

  const refreshAnalytics = event.target.closest("[data-action='refresh-analytics']");
  if (refreshAnalytics) {
    const data = await api("/api/analytics");
    state.analytics = data.analytics;
    state.leaderboard = data.leaderboard;
    renderChrome();
    renderRoute();
    showNotice("Analytics refreshed.", "success");
    return;
  }

  const completeTask = event.target.closest("[data-complete-task]");
  if (completeTask) {
    Object.assign(state, await api(`/api/tasks/${completeTask.dataset.completeTask}/complete`, { method: "POST", body: "{}" }));
    renderChrome();
    renderRoute();
    showNotice("Task completed and XP saved.", "success");
    return;
  }

  const addSuggested = event.target.closest("[data-add-suggested]");
  if (addSuggested) {
    const suggested = state.suggestedTasks[Number(addSuggested.dataset.addSuggested)];
    if (!suggested) return;
    Object.assign(state, await api("/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        title: suggested.title,
        description: suggested.reason,
        courseId: suggested.courseId,
        priority: suggested.priority || 2,
        source: "recommendation"
      })
    }));
    renderChrome();
    renderRoute();
    showNotice("Suggested task added.", "success");
    return;
  }

  const enrollButton = event.target.closest("[data-course-enroll]");
  if (enrollButton) {
    Object.assign(state, await api(`/api/courses/${enrollButton.dataset.courseEnroll}/enroll`, {
      method: "POST",
      body: JSON.stringify({ status: "enrolled" })
    }));
    renderChrome();
    renderRoute();
    showNotice("Course saved to your learning path.", "success");
    return;
  }

  const completeButton = event.target.closest(".complete[data-course-id]");
  if (completeButton) {
    Object.assign(state, await api("/api/learning-events", {
      method: "POST",
      body: JSON.stringify({
        type: "course_completed",
        courseId: completeButton.dataset.courseId,
        xp: 180
      })
    }));
    renderChrome();
    renderRoute();
    showNotice("Course completion saved.", "success");
    return;
  }

  const offlineButton = event.target.closest(".offline[data-course-id]");
  if (offlineButton) {
    Object.assign(state, await api("/api/offline-packs", {
      method: "POST",
      body: JSON.stringify({
        courseId: offlineButton.dataset.courseId,
        resourceIds: state.resources.filter((resource) => resource.offlineReady).map((resource) => resource.id),
        language: state.profile.languages[0] || "English"
      })
    }));
    renderChrome();
    renderRoute();
    showNotice("Offline pack saved.", "success");
    return;
  }

  const forumButton = event.target.closest("[data-forum-select]");
  if (forumButton) {
    state.selectedForumId = forumButton.dataset.forumSelect;
    renderForums();
    return;
  }

  const likeButton = event.target.closest("[data-like-post]");
  if (likeButton) {
    const data = await api(`/api/posts/${likeButton.dataset.likePost}/react`, { method: "POST", body: "{}" });
    for (const forum of state.forums) {
      const post = forum.posts.find((item) => item.id === data.post.id);
      if (post) post.likes = data.post.likes;
    }
    renderForums();
    return;
  }

  const joinButton = event.target.closest("[data-join-group]");
  if (joinButton) {
    Object.assign(state, await api(`/api/groups/${joinButton.dataset.joinGroup}/join`, {
      method: "POST",
      body: "{}"
    }));
    renderChrome();
    renderGroups();
    showNotice("Study group membership saved.", "success");
    return;
  }

  const downloadButton = event.target.closest("[data-download-pack]");
  if (downloadButton) {
    downloadPack(downloadButton.dataset.downloadPack);
  }
}

async function handleSubmit(event) {
  if (event.target.id === "authForm") {
    event.preventDefault();
    const form = new FormData(event.target);
    const mode = form.get("mode");
    const payload = Object.fromEntries(form.entries());
    payload.languages = csvList(form.get("languages"));
    payload.goals = csvList(form.get("goals"));
    payload.interests = csvList(form.get("interests"));
    payload.offlineFirst = form.get("offlineFirst") === "on";
    await api(`/api/auth/${mode === "register" ? "register" : "login"}`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    await loadBootstrap();
    showNotice(mode === "register" ? "Account created." : "Signed in.", "success");
    return;
  }

  if (event.target.id === "courseFilterForm") {
    event.preventDefault();
    const form = new FormData(event.target);
    const data = await api(`/api/courses?${new URLSearchParams(form).toString()}`);
    state.filteredCourses = data.courses;
    renderCourses();
    return;
  }

  if (event.target.id === "profileForm") {
    event.preventDefault();
    const form = new FormData(event.target);
    const data = await api("/api/profile", {
      method: "POST",
      body: JSON.stringify({
        name: form.get("name"),
        grade: form.get("grade"),
        district: form.get("district"),
        level: form.get("level"),
        pace: form.get("pace"),
        languages: csvList(form.get("languages")),
        goals: csvList(form.get("goals")),
        interests: csvList(form.get("interests")),
        offlineFirst: form.get("offlineFirst") === "on"
      })
    });
    state.profile = data.profile;
    state.analytics = data.analytics;
    state.recommendations = data.recommendations || state.recommendations;
    state.studyPlan = data.studyPlan || state.studyPlan;
    await loadBootstrap();
    showNotice("Profile saved and recommendations recalculated.", "success");
    return;
  }

  if (event.target.id === "taskForm") {
    event.preventDefault();
    const form = new FormData(event.target);
    const dueAt = form.get("dueAt") ? new Date(form.get("dueAt")).toISOString() : null;
    Object.assign(state, await api("/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        title: form.get("title"),
        description: form.get("description"),
        dueAt,
        priority: Number(form.get("priority")),
        source: "user"
      })
    }));
    renderChrome();
    renderTasks();
    showNotice("Task saved.", "success");
    return;
  }

  if (event.target.id === "forumPostForm") {
    event.preventDefault();
    const form = new FormData(event.target);
    Object.assign(state, await api(`/api/forums/${form.get("forumId")}/posts`, {
      method: "POST",
      body: JSON.stringify({ text: form.get("text") })
    }));
    renderChrome();
    renderForums();
    showNotice("Forum post saved.", "success");
    return;
  }

  if (event.target.id === "groupForm") {
    event.preventDefault();
    const form = new FormData(event.target);
    Object.assign(state, await api("/api/groups", {
      method: "POST",
      body: JSON.stringify({
        name: form.get("name"),
        subject: form.get("subject"),
        meeting: form.get("meeting"),
        capacity: Number(form.get("capacity"))
      })
    }));
    renderChrome();
    renderGroups();
    showNotice("Study group created.", "success");
    return;
  }

  if (event.target.id === "offlinePackForm") {
    event.preventDefault();
    const form = new FormData(event.target);
    Object.assign(state, await api("/api/offline-packs", {
      method: "POST",
      body: JSON.stringify({
        courseId: form.get("courseId"),
        language: form.get("language"),
        resourceIds: state.resources.filter((resource) => resource.offlineReady).map((resource) => resource.id)
      })
    }));
    renderChrome();
    renderLibrary();
    showNotice("Offline pack added.", "success");
    return;
  }

  if (event.target.id === "contactForm") {
    event.preventDefault();
    const form = new FormData(event.target);
    const data = await api("/api/contact", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    event.target.reset();
    showNotice(data.nextStep, "success");
  }
}

function downloadPack(packId) {
  const pack = state.offlinePacks.find((item) => item.id === packId);
  if (!pack) return;
  const course = state.courses.find((item) => item.id === pack.courseId);
  const resources = state.resources.filter((resource) => pack.resourceIds.includes(resource.id));
  const manifest = {
    product: "DRISHTI Offline Pack",
    learner: state.profile.name,
    generatedAt: new Date().toISOString(),
    course,
    resources,
    pack
  };
  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${pack.id}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showNotice("Manifest downloaded.", "success");
}

function showNotice(message, type = "notice") {
  const box = document.createElement("div");
  box.className = `notice ${type === "success" ? "success" : ""}`;
  box.textContent = message;
  appView.prepend(box);
  setTimeout(() => box.remove(), 4200);
}

function setStatusLoading(message) {
  statusStrip.innerHTML = `<div>${escapeHtml(message)}</div>`;
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function csvList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "No due date";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
