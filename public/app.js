const state = {
  profile: null,
  platforms: [],
  courses: [],
  filteredCourses: null,
  recommendations: [],
  forums: [],
  groups: [],
  resources: [],
  offlinePacks: [],
  analytics: null,
  leaderboard: [],
  studyPlan: [],
  selectedForumId: "forum-math"
};

const routes = {
  dashboard: "Dashboard",
  discover: "Discover",
  forums: "Peer Forum",
  groups: "Study Groups",
  library: "Offline Library",
  analytics: "Analytics",
  contact: "Contact"
};

const appView = document.querySelector("#appView");
const pageTitle = document.querySelector("#pageTitle");
const profileCard = document.querySelector("#profileCard");
const statusStrip = document.querySelector("#statusStrip");

document.addEventListener("DOMContentLoaded", init);

function init() {
  bindEvents();
  loadBootstrap();
}

function bindEvents() {
  window.addEventListener("hashchange", renderRoute);

  document.querySelector("#quickPlanButton").addEventListener("click", async () => {
    await loadRecommendations();
    location.hash = "#discover";
    showNotice("Your AI-ranked study plan is ready.", "success");
  });

  document.querySelector("#syncButton").addEventListener("click", async () => {
    await loadBootstrap(true);
    showNotice("Platform APIs synced with the latest local backend data.", "success");
  });

  document.addEventListener("click", handleClick);
  document.addEventListener("submit", handleSubmit);
}

async function loadBootstrap(showLoading = false) {
  if (showLoading) setStatusLoading("Syncing DRISHTI data...");
  try {
    const data = await api("/api/bootstrap?learnerId=learner-odisha");
    Object.assign(state, data);
    state.filteredCourses = null;
    state.selectedForumId = state.forums[0]?.id || state.selectedForumId;
    renderChrome();
    renderRoute();
  } catch (error) {
    appView.innerHTML = `<div class="notice">${escapeHtml(error.message)}</div>`;
  }
}

async function loadRecommendations(query = "") {
  const data = await api(`/api/recommendations?learnerId=${state.profile.id}&query=${encodeURIComponent(query)}`);
  state.recommendations = data.recommendations;
  state.studyPlan = data.studyPlan;
  renderChrome();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "DRISHTI backend request failed");
  }
  return payload;
}

function renderChrome() {
  renderProfile();
  renderStatusStrip();
  setActiveNav();
}

function renderProfile() {
  if (!state.profile) return;
  profileCard.innerHTML = `
    <h2>${escapeHtml(state.profile.name)}</h2>
    <p>${escapeHtml(state.profile.grade)} - ${escapeHtml(state.profile.district)}</p>
    <p>${escapeHtml(state.profile.languages.join(", "))}</p>
    <div class="profile-metrics">
      <span>${state.analytics?.totals?.xp || state.profile.xp}<small>XP earned</small></span>
      <span>${state.profile.streak}<small>day streak</small></span>
    </div>
  `;
}

function renderStatusStrip() {
  const totals = state.analytics?.totals || {};
  const synced = state.platforms.filter((platform) => platform.status === "synced").length;
  statusStrip.innerHTML = `
    <div><b>${totals.completedCourses || 0}</b><span>Courses completed</span></div>
    <div><b>${state.offlinePacks.length}</b><span>Offline packs ready</span></div>
    <div><b>${synced}/${state.platforms.length}</b><span>Platform APIs synced</span></div>
    <div><b>${totals.studyGroups || 0}</b><span>Active study groups</span></div>
  `;
}

function renderRoute() {
  const route = currentRoute();
  pageTitle.textContent = routes[route] || "Dashboard";
  setActiveNav();

  if (!state.profile) {
    appView.innerHTML = `<div class="panel">Loading...</div>`;
    return;
  }

  if (route === "discover") return renderDiscover();
  if (route === "forums") return renderForums();
  if (route === "groups") return renderGroups();
  if (route === "library") return renderLibrary();
  if (route === "analytics") return renderAnalytics();
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
    link.classList.toggle("active", link.dataset.route === route);
  });
}

function renderDashboard() {
  const topRecommendations = state.recommendations.slice(0, 3);
  appView.innerHTML = `
    <div class="view-grid">
      <div>
        <section class="panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Unified learning path</p>
              <h2>Start where your profile points.</h2>
            </div>
            <button class="button small" data-action="refresh-plan" type="button">Refresh plan</button>
          </div>
          <div class="course-grid" id="dashboardCourses"></div>
        </section>

        <section class="panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Personalization engine</p>
              <h2>Tune your learner profile.</h2>
            </div>
          </div>
          ${profileForm()}
        </section>
      </div>

      <div>
        <section class="panel brand-panel">
          <img src="/assets/drishti-logo.png" alt="DRISHTI vision of opportunities" />
          <div>
            <p class="eyebrow">Vision of opportunities</p>
            <h2>Peer teaching with intelligent access.</h2>
          </div>
        </section>

        <section class="panel">
          <p class="eyebrow">Three-week sprint</p>
          <h2>Your study plan</h2>
          <div class="plan-list">
            ${state.studyPlan.map(planItemTemplate).join("")}
          </div>
        </section>

        <section class="panel">
          <p class="eyebrow">Peer motivation</p>
          <h2>Leaderboard</h2>
          <div class="leaderboard">
            ${state.leaderboard.slice(0, 5).map(leaderboardTemplate).join("")}
          </div>
        </section>
      </div>
    </div>
  `;
  renderCourseCards("#dashboardCourses", topRecommendations);
}

function renderDiscover() {
  const courses = state.filteredCourses || state.recommendations;
  appView.innerHTML = `
    <section class="panel">
      <div class="section-heading">
        <div>
          <p class="eyebrow">API resource layer</p>
          <h2>Search across connected platforms.</h2>
        </div>
      </div>
      <form class="filter-bar" id="courseFilterForm">
        <input name="query" type="search" placeholder="Search AI, math, science, peer teaching" />
        <select name="level" aria-label="Level">
          <option value="">Any level</option>
          <option>Beginner</option>
          <option>Intermediate</option>
          <option>All Levels</option>
        </select>
        <select name="language" aria-label="Language">
          <option value="">Any language</option>
          <option>English</option>
          <option>Odia</option>
          <option>Hindi</option>
        </select>
        <select name="mode" aria-label="Mode">
          <option value="">Any mode</option>
          <option value="offline">Offline ready</option>
        </select>
        <button class="button" type="submit">Apply</button>
      </form>
      <div class="course-grid" id="discoverCourses"></div>
    </section>
  `;
  renderCourseCards("#discoverCourses", courses);
}

function renderForums() {
  const selectedForum = state.forums.find((forum) => forum.id === state.selectedForumId) || state.forums[0];
  appView.innerHTML = `
    <div class="forum-layout">
      <section class="panel">
        <p class="eyebrow">Subject-specific forums</p>
        <h2>Ask, explain, and support peers.</h2>
        <p class="muted">Each post creates a learning event so collaboration counts toward progress.</p>
        <div class="tag-row">
          ${state.forums.map((forum) => `
            <button class="ghost small" data-forum-select="${escapeHtml(forum.id)}" type="button">${escapeHtml(forum.subject)}</button>
          `).join("")}
        </div>
        <form id="forumPostForm" class="panel" style="margin-top: 1rem;">
          <input type="hidden" name="forumId" value="${escapeHtml(selectedForum?.id || "")}" />
          <div class="field">
            <label for="forumText">New question or explanation</label>
            <textarea id="forumText" name="text" placeholder="Share a doubt, explanation, or peer teaching prompt"></textarea>
          </div>
          <div class="form-actions">
            <button class="button" type="submit">Post to forum</button>
          </div>
        </form>
      </section>

      <section class="panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">${escapeHtml(selectedForum?.members || 0)} members</p>
            <h2>${escapeHtml(selectedForum?.subject || "Forum")}</h2>
          </div>
        </div>
        <p class="muted">${escapeHtml(selectedForum?.description || "")}</p>
        <div class="forum-list">
          ${(selectedForum?.posts || []).map(postTemplate).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderGroups() {
  appView.innerHTML = `
    <div class="group-layout">
      <section class="panel">
        <p class="eyebrow">Collaborative study groups</p>
        <h2>Form circles around goals.</h2>
        <p class="muted">Shared documents, group progress, and mentor support make peer teaching concrete.</p>
        <form id="groupForm" class="form-grid">
          <div class="field">
            <label for="groupName">Group name</label>
            <input id="groupName" name="name" placeholder="Example: Biology Sprint" required />
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
        ${state.groups.map(groupTemplate).join("")}
      </section>
    </div>
  `;
}

function renderLibrary() {
  const offlineCourses = state.courses.filter((course) => course.offlineReady);
  appView.innerHTML = `
    <div class="library-layout">
      <section class="panel">
        <p class="eyebrow">Multilingual and offline access</p>
        <h2>Prepare learning packs for low connectivity.</h2>
        <p class="muted">The backend records every pack, expiry, selected language, and saved resource event.</p>
        <form id="offlinePackForm" class="form-grid">
          <div class="field">
            <label for="courseId">Course</label>
            <select id="courseId" name="courseId">
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
          <p class="eyebrow">Ready packs</p>
          <h2>Download queue</h2>
          <div class="resource-list">
            ${state.offlinePacks.length ? state.offlinePacks.map(packTemplate).join("") : `<div class="notice">No packs yet. Build one from an offline-ready course.</div>`}
          </div>
        </div>
        <div class="panel">
          <p class="eyebrow">Resource cache</p>
          <h2>Offline resources</h2>
          <div class="resource-list">
            ${state.resources.map(resourceTemplate).join("")}
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderAnalytics() {
  const analytics = state.analytics;
  const maxXp = Math.max(1, ...analytics.daily.map((day) => day.xp));
  appView.innerHTML = `
    <div class="analytics-layout">
      <section>
        <div class="metric-grid">
          ${metricTemplate("Total XP", analytics.totals.xp)}
          ${metricTemplate("Completed", analytics.totals.completedCourses)}
          ${metricTemplate("Forum posts", analytics.totals.forumPosts)}
          ${metricTemplate("Resources", analytics.totals.savedResources)}
        </div>
        <div class="panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Learning analytics</p>
              <h2>Weekly activity</h2>
            </div>
            <button class="button small" data-action="refresh-analytics" type="button">Refresh</button>
          </div>
          <div class="chart">
            ${analytics.daily.map((day) => `
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
          <p class="eyebrow">Achievements</p>
          <h2>Badges unlocked</h2>
          <div class="tag-row">
            ${analytics.badges.length ? analytics.badges.map((badge) => `<span class="pill gold">${escapeHtml(badge)}</span>`).join("") : `<span class="tag">No badges yet</span>`}
          </div>
        </div>
        <div class="panel">
          <p class="eyebrow">Next best action</p>
          <h2>${escapeHtml(analytics.nextBestAction.title)}</h2>
          <p class="muted">${escapeHtml(analytics.nextBestAction.description)}</p>
          <div class="card-actions">
            <button class="button small complete" data-course-id="${escapeHtml(analytics.nextBestAction.id)}" type="button">Mark complete</button>
            <button class="ghost small offline" data-course-id="${escapeHtml(analytics.nextBestAction.id)}" type="button">Save offline</button>
          </div>
        </div>
        <div class="panel">
          <p class="eyebrow">District momentum</p>
          <h2>Leaderboard</h2>
          <div class="leaderboard">
            ${state.leaderboard.map(leaderboardTemplate).join("")}
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderContact() {
  appView.innerHTML = `
    <div class="view-grid">
      <section class="contact-panel panel">
        <p class="eyebrow">Pilot, investor, educator, partner</p>
        <h2>Start a DRISHTI conversation.</h2>
        <p class="muted">Messages are stored by the backend with interest type and organization context.</p>
        <form id="contactForm" class="form-grid">
          <div class="field">
            <label for="contactName">Name</label>
            <input id="contactName" name="name" required />
          </div>
          <div class="field">
            <label for="contactEmail">Email</label>
            <input id="contactEmail" name="email" type="email" required />
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
      <section>
        <div class="panel">
          <p class="eyebrow">Backend capabilities</p>
          <h2>What is live in this demo</h2>
          <div class="timeline-list">
            <div class="timeline-item"><strong>Recommendations</strong><span class="muted">Scores courses by goals, interests, level, language, social proof, and offline needs.</span></div>
            <div class="timeline-item"><strong>Collaboration</strong><span class="muted">Forums and groups create persisted activity and XP events.</span></div>
            <div class="timeline-item"><strong>Access</strong><span class="muted">Offline packs capture course, language, resources, and expiry.</span></div>
            <div class="timeline-item"><strong>Analytics</strong><span class="muted">Progress, badges, leaderboard, and weekly XP are computed from events.</span></div>
          </div>
        </div>
      </section>
    </div>
  `;
}

function profileForm() {
  return `
    <form id="profileForm" class="form-grid">
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
        <label for="profileGoals">Goals</label>
        <input id="profileGoals" name="goals" value="${escapeHtml(state.profile.goals.join(", "))}" />
      </div>
      <div class="field full-row">
        <label for="profileInterests">Interests</label>
        <input id="profileInterests" name="interests" value="${escapeHtml(state.profile.interests.join(", "))}" />
      </div>
      <div class="field full-row">
        <label>
          <input name="offlineFirst" type="checkbox" ${state.profile.offlineFirst ? "checked" : ""} />
          Prioritize offline-ready learning
        </label>
      </div>
      <div class="field full-row">
        <button class="button" type="submit">Save profile and rerank</button>
      </div>
    </form>
  `;
}

function renderCourseCards(selector, courses) {
  const container = document.querySelector(selector);
  if (!container) return;
  container.innerHTML = "";

  if (!courses.length) {
    container.innerHTML = `<div class="notice">No courses matched this search. Try a wider filter.</div>`;
    return;
  }

  courses.forEach((course) => container.appendChild(courseCard(course)));
}

function courseCard(course) {
  const template = document.querySelector("#courseCardTemplate");
  const node = template.content.firstElementChild.cloneNode(true);
  node.querySelector(".provider").textContent = course.provider;
  node.querySelector("h3").textContent = course.title;
  node.querySelector(".description").textContent = course.description;
  node.querySelector(".fit-pill").textContent = course.fit ? `${course.fit}% fit` : `${course.rating} rating`;
  node.querySelector(".tags").innerHTML = course.tags.slice(0, 3).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
  node.querySelector(".course-meta").textContent = `${course.level} - ${course.durationHours}h - ${course.language.join(", ")}${course.offlineReady ? " - Offline ready" : ""}`;
  node.querySelector(".complete").dataset.courseId = course.id;
  node.querySelector(".offline").dataset.courseId = course.id;
  if (!course.offlineReady) {
    node.querySelector(".offline").textContent = "Save notes";
  }
  return node;
}

function planItemTemplate(item) {
  return `
    <div class="plan-item">
      <strong>Week ${item.week}: ${escapeHtml(item.title)}</strong>
      <span class="muted">${escapeHtml(item.task)} - ${escapeHtml(item.peerAction)} - ${item.expectedXp} XP</span>
    </div>
  `;
}

function leaderboardTemplate(item, index) {
  return `
    <div class="leaderboard-item">
      <strong>${index + 1}. ${escapeHtml(item.name)}</strong>
      <span class="muted">${escapeHtml(item.district)} - ${item.xp} XP - ${item.streak} day streak</span>
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
        <span class="tag">${new Date(post.createdAt).toLocaleDateString()}</span>
      </div>
      ${post.replies.map((reply) => `<div class="reply">${escapeHtml(reply.author)}: ${escapeHtml(reply.text)}</div>`).join("")}
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
      <p class="muted">Ready until ${new Date(pack.expiresAt).toLocaleDateString()} - ${pack.resourceIds.length} resource links</p>
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
  const refreshPlan = event.target.closest("[data-action='refresh-plan']");
  if (refreshPlan) {
    await loadRecommendations();
    renderRoute();
    showNotice("Recommendations refreshed from your learner profile.", "success");
    return;
  }

  const refreshAnalytics = event.target.closest("[data-action='refresh-analytics']");
  if (refreshAnalytics) {
    const data = await api(`/api/analytics?learnerId=${state.profile.id}`);
    state.analytics = data.analytics;
    state.leaderboard = data.leaderboard;
    renderChrome();
    renderRoute();
    showNotice("Analytics refreshed.", "success");
    return;
  }

  const completeButton = event.target.closest(".complete[data-course-id]");
  if (completeButton) {
    const courseId = completeButton.dataset.courseId;
    const data = await api("/api/learning-events", {
      method: "POST",
      body: JSON.stringify({
        learnerId: state.profile.id,
        type: "course_completed",
        courseId,
        xp: 180
      })
    });
    state.analytics = data.analytics;
    state.leaderboard = data.leaderboard;
    renderChrome();
    renderRoute();
    showNotice("Course progress saved and analytics updated.", "success");
    return;
  }

  const offlineButton = event.target.closest(".offline[data-course-id]");
  if (offlineButton) {
    const courseId = offlineButton.dataset.courseId;
    const data = await api("/api/offline-packs", {
      method: "POST",
      body: JSON.stringify({
        learnerId: state.profile.id,
        courseId,
        resourceIds: state.resources.filter((resource) => resource.offlineReady).slice(0, 2).map((resource) => resource.id),
        language: state.profile.languages[0]
      })
    });
    state.offlinePacks = data.offlinePacks;
    state.analytics = data.analytics;
    renderChrome();
    renderRoute();
    showNotice("Offline pack created.", "success");
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
    showNotice("Like saved.", "success");
    return;
  }

  const joinButton = event.target.closest("[data-join-group]");
  if (joinButton) {
    const data = await api(`/api/groups/${joinButton.dataset.joinGroup}/join`, {
      method: "POST",
      body: JSON.stringify({ learnerId: state.profile.id })
    });
    state.groups = data.groups;
    state.analytics = data.analytics;
    renderChrome();
    renderGroups();
    showNotice("Study group joined.", "success");
    return;
  }

  const downloadButton = event.target.closest("[data-download-pack]");
  if (downloadButton) {
    downloadPack(downloadButton.dataset.downloadPack);
  }
}

async function handleSubmit(event) {
  if (event.target.id === "courseFilterForm") {
    event.preventDefault();
    const form = new FormData(event.target);
    const params = new URLSearchParams(form);
    const data = await api(`/api/courses?${params.toString()}`);
    state.filteredCourses = data.courses;
    renderDiscover();
    showNotice("Course filters applied.", "success");
    return;
  }

  if (event.target.id === "profileForm") {
    event.preventDefault();
    const form = new FormData(event.target);
    const data = await api("/api/profile", {
      method: "POST",
      body: JSON.stringify({
        learnerId: state.profile.id,
        level: form.get("level"),
        pace: form.get("pace"),
        goals: csvList(form.get("goals")),
        interests: csvList(form.get("interests")),
        offlineFirst: form.get("offlineFirst") === "on"
      })
    });
    state.profile = data.profile;
    state.analytics = data.analytics;
    await loadRecommendations();
    renderChrome();
    renderRoute();
    showNotice("Profile saved and recommendations reranked.", "success");
    return;
  }

  if (event.target.id === "forumPostForm") {
    event.preventDefault();
    const form = new FormData(event.target);
    const forumId = form.get("forumId");
    const data = await api(`/api/forums/${forumId}/posts`, {
      method: "POST",
      body: JSON.stringify({
        learnerId: state.profile.id,
        text: form.get("text")
      })
    });
    state.forums = state.forums.map((forum) => forum.id === data.forum.id ? data.forum : forum);
    state.analytics = data.analytics;
    renderChrome();
    renderForums();
    showNotice("Forum post published and XP logged.", "success");
    return;
  }

  if (event.target.id === "groupForm") {
    event.preventDefault();
    const form = new FormData(event.target);
    const data = await api("/api/groups", {
      method: "POST",
      body: JSON.stringify({
        learnerId: state.profile.id,
        name: form.get("name"),
        subject: form.get("subject"),
        meeting: form.get("meeting"),
        capacity: Number(form.get("capacity"))
      })
    });
    state.groups = data.groups;
    state.analytics = data.analytics;
    renderChrome();
    renderGroups();
    showNotice("Study group created.", "success");
    return;
  }

  if (event.target.id === "offlinePackForm") {
    event.preventDefault();
    const form = new FormData(event.target);
    const data = await api("/api/offline-packs", {
      method: "POST",
      body: JSON.stringify({
        learnerId: state.profile.id,
        courseId: form.get("courseId"),
        language: form.get("language"),
        resourceIds: state.resources.filter((resource) => resource.offlineReady).map((resource) => resource.id)
      })
    });
    state.offlinePacks = data.offlinePacks;
    state.analytics = data.analytics;
    renderChrome();
    renderLibrary();
    showNotice("Offline pack added to the download queue.", "success");
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

function csvList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
