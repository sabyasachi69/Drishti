const {
  AuthError,
  buildSessionCookie,
  clearSessionCookie,
  createSession,
  destroySession,
  getSessionUser,
  hashPassword,
  normalizeEmail,
  publicUser,
  requireUser,
  validatePassword,
  verifyPassword
} = require("./auth");
const { SetupError, asArray, hasDatabaseConfig, jsonParam, query } = require("./db");
const { buildRecommendations, courseMatchesQuery } = require("./recommendations");

function sendJson(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(body);
}

function sendError(res, status, message, code = "REQUEST_FAILED") {
  sendJson(res, status, { error: message, code });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function iso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function mapCourse(row) {
  const languages = asArray(row.languages);
  return {
    id: row.id,
    title: row.title,
    provider: row.provider,
    level: row.level,
    languages,
    language: languages,
    durationHours: Number(row.duration_hours || 0),
    offlineReady: Boolean(row.offline_ready),
    rating: Number(row.rating || 0),
    enrollments: Number(row.enrollments || 0),
    tags: asArray(row.tags),
    skills: asArray(row.skills),
    description: row.description || "",
    url: row.url || "",
    progressStatus: row.progress_status || null,
    progress: Number(row.progress || 0),
    completedAt: iso(row.completed_at)
  };
}

function mapProgress(row) {
  return {
    courseId: row.course_id,
    status: row.status,
    progress: Number(row.progress || 0),
    completedAt: iso(row.completed_at),
    updatedAt: iso(row.updated_at)
  };
}

function mapTask(row) {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    courseId: row.course_id || null,
    title: row.title,
    description: row.description || "",
    dueAt: iso(row.due_at),
    status: row.status,
    priority: Number(row.priority || 1),
    source: row.source,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  };
}

function mapResource(row) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    language: row.language,
    sizeMb: Number(row.size_mb || 0),
    tags: asArray(row.tags),
    offlineReady: Boolean(row.offline_ready),
    url: row.url || ""
  };
}

function mapPack(row) {
  return {
    id: String(row.id),
    courseId: row.course_id,
    resourceIds: asArray(row.resource_ids),
    language: row.language,
    expiresAt: iso(row.expires_at),
    createdAt: iso(row.created_at)
  };
}

function mapEvent(row) {
  return {
    id: String(row.id),
    type: row.type,
    courseId: row.course_id || null,
    resourceId: row.resource_id || null,
    forumId: row.forum_id || null,
    groupId: row.group_id ? String(row.group_id) : null,
    taskId: row.task_id ? String(row.task_id) : null,
    xp: Number(row.xp || 0),
    createdAt: iso(row.created_at)
  };
}

function mapForums(forumRows, postRows) {
  const postsByForum = new Map();
  for (const row of postRows) {
    const post = {
      id: String(row.id),
      userId: String(row.user_id),
      author: row.author_name,
      role: row.author_role,
      text: row.text,
      likes: Number(row.likes || 0),
      replies: [],
      createdAt: iso(row.created_at)
    };
    const posts = postsByForum.get(row.forum_id) || [];
    posts.push(post);
    postsByForum.set(row.forum_id, posts);
  }

  return forumRows.map((forum) => {
    const posts = postsByForum.get(forum.id) || [];
    return {
      id: forum.id,
      subject: forum.subject,
      description: forum.description,
      members: Number(forum.members || 0),
      posts
    };
  });
}

function mapGroups(groupRows, membershipRows) {
  const membersByGroup = new Map();
  for (const row of membershipRows) {
    const key = String(row.group_id);
    const members = membersByGroup.get(key) || [];
    members.push(String(row.user_id));
    membersByGroup.set(key, members);
  }

  return groupRows.map((group) => {
    const id = String(group.id);
    return {
      id,
      name: group.name,
      subject: group.subject,
      mentor: group.mentor,
      meeting: group.meeting,
      capacity: Number(group.capacity || 0),
      progress: Number(group.progress || 0),
      docs: asArray(group.docs),
      tasks: asArray(group.tasks),
      members: membersByGroup.get(id) || [],
      createdAt: iso(group.created_at)
    };
  });
}

function todayKey(offsetDays = 0) {
  const date = new Date(Date.now() - offsetDays * 86400000);
  return date.toISOString().slice(0, 10);
}

function computeStreak(events) {
  const activeDays = new Set(events.map((event) => String(event.createdAt || "").slice(0, 10)));
  let streak = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    const key = todayKey(offset);
    if (activeDays.has(key)) {
      streak += 1;
      continue;
    }
    if (offset === 0) continue;
    break;
  }
  return streak;
}

function computeAnalytics({ user, events, progress, tasks, groups, packs, forums, nextBestAction }) {
  const completedCourses = progress.filter((item) => item.status === "completed").length;
  const completedTasks = tasks.filter((task) => task.status === "done").length;
  const pendingTasks = tasks.filter((task) => task.status !== "done").length;
  const forumPosts = forums.reduce((count, forum) => {
    return count + forum.posts.filter((post) => post.userId === user.id).length;
  }, 0);
  const xp = events.reduce((sum, event) => sum + Number(event.xp || 0), 0);
  const streak = computeStreak(events);
  const activeGroups = groups.filter((group) => group.members.includes(user.id)).length;
  const maxDate = 7;

  const daily = Array.from({ length: maxDate }, (_, index) => {
    const offset = maxDate - index - 1;
    const date = new Date(Date.now() - offset * 86400000);
    const key = date.toISOString().slice(0, 10);
    const dayXp = events
      .filter((event) => String(event.createdAt || "").startsWith(key))
      .reduce((sum, event) => sum + Number(event.xp || 0), 0);
    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      xp: dayXp
    };
  });

  const badges = [
    completedCourses > 0 ? "Course Finisher" : null,
    completedTasks > 2 ? "Task Closer" : null,
    forumPosts > 0 ? "Peer Voice" : null,
    packs.length > 0 ? "Offline Ready" : null,
    activeGroups > 0 ? "Study Circle" : null,
    streak >= 3 ? "Learning Streak" : null
  ].filter(Boolean);

  return {
    streak,
    totals: {
      xp,
      completedCourses,
      completedTasks,
      pendingTasks,
      savedResources: packs.length,
      forumPosts,
      studyGroups: activeGroups
    },
    daily,
    badges,
    nextBestAction
  };
}

async function getLeaderboard() {
  const { rows } = await query(
    `SELECT
        u.id,
        u.name,
        u.district,
        COALESCE(SUM(e.xp), 0)::int AS xp,
        COUNT(DISTINCT CASE WHEN cp.status = 'completed' THEN cp.course_id END)::int AS completed_courses
       FROM users u
       LEFT JOIN learning_events e ON e.user_id = u.id
       LEFT JOIN course_progress cp ON cp.user_id = u.id
      GROUP BY u.id, u.name, u.district
      ORDER BY xp DESC, completed_courses DESC, u.created_at ASC
      LIMIT 10`
  );

  return rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    district: row.district,
    xp: Number(row.xp || 0),
    completedCourses: Number(row.completed_courses || 0)
  }));
}

async function loadWorkspace(user) {
  const [
    courseRows,
    progressRows,
    taskRows,
    forumRows,
    postRows,
    groupRows,
    membershipRows,
    resourceRows,
    packRows,
    eventRows,
    leaderboard
  ] = await Promise.all([
    query(
      `SELECT c.*, cp.status AS progress_status, cp.progress, cp.completed_at
         FROM courses c
         LEFT JOIN course_progress cp ON cp.course_id = c.id AND cp.user_id = $1
        ORDER BY c.created_at ASC`,
      [user.id]
    ),
    query("SELECT * FROM course_progress WHERE user_id = $1 ORDER BY updated_at DESC", [user.id]),
    query("SELECT * FROM tasks WHERE user_id = $1 ORDER BY status ASC, due_at ASC NULLS LAST, created_at DESC", [user.id]),
    query(
      `SELECT f.*, COUNT(DISTINCT fp.user_id)::int AS members
         FROM forums f
         LEFT JOIN forum_posts fp ON fp.forum_id = f.id
        GROUP BY f.id
        ORDER BY f.created_at ASC`
    ),
    query(
      `SELECT fp.*, u.name AS author_name, u.role AS author_role
         FROM forum_posts fp
         JOIN users u ON u.id = fp.user_id
        ORDER BY fp.created_at DESC
        LIMIT 120`
    ),
    query("SELECT * FROM study_groups ORDER BY created_at DESC"),
    query("SELECT * FROM group_memberships"),
    query("SELECT * FROM resources ORDER BY created_at ASC"),
    query("SELECT * FROM offline_packs WHERE user_id = $1 ORDER BY created_at DESC", [user.id]),
    query("SELECT * FROM learning_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 500", [user.id]),
    getLeaderboard()
  ]);

  const courses = courseRows.rows.map(mapCourse);
  const progress = progressRows.rows.map(mapProgress);
  const tasks = taskRows.rows.map(mapTask);
  const forums = mapForums(forumRows.rows, postRows.rows);
  const groups = mapGroups(groupRows.rows, membershipRows.rows);
  const resources = resourceRows.rows.map(mapResource);
  const offlinePacks = packRows.rows.map(mapPack);
  const events = eventRows.rows.map(mapEvent);
  const recommendations = buildRecommendations({ user, courses, progress, tasks });
  const analytics = computeAnalytics({
    user,
    events,
    progress,
    tasks,
    groups,
    packs: offlinePacks,
    forums,
    nextBestAction: recommendations.courseRecommendations[0] || null
  });

  return {
    profile: {
      ...user,
      xp: analytics.totals.xp,
      streak: analytics.streak
    },
    platforms: [],
    courses,
    courseProgress: progress,
    tasks,
    recommendations: recommendations.courseRecommendations.slice(0, 6),
    upcomingTasks: recommendations.upcomingTasks,
    suggestedTasks: recommendations.suggestedTasks,
    studyPlan: recommendations.dailyPlan,
    forums,
    groups,
    resources,
    offlinePacks,
    analytics,
    leaderboard
  };
}

async function handleRegister(req, res) {
  const body = await readBody(req);
  const email = normalizeEmail(body.email);
  const passwordProblem = validatePassword(body.password);
  const name = String(body.name || "").trim();

  if (!name) return sendError(res, 400, "Name is required", "VALIDATION_ERROR");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return sendError(res, 400, "A valid email is required", "VALIDATION_ERROR");
  }
  if (passwordProblem) return sendError(res, 400, passwordProblem, "VALIDATION_ERROR");

  const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rows.length) {
    return sendError(res, 409, "An account with this email already exists", "EMAIL_EXISTS");
  }

  const languages = asArray(body.languages).length ? asArray(body.languages) : ["English"];
  const goals = asArray(body.goals);
  const interests = asArray(body.interests);
  const { rows } = await query(
    `INSERT INTO users (
      name, email, password_hash, role, grade, district, level,
      languages, goals, interests, pace, offline_first
    )
    VALUES ($1, $2, $3, 'Student', $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11)
    RETURNING *`,
    [
      name,
      email,
      hashPassword(body.password),
      String(body.grade || "").trim(),
      String(body.district || "").trim(),
      String(body.level || "Beginner").trim(),
      jsonParam(languages),
      jsonParam(goals),
      jsonParam(interests),
      String(body.pace || "Balanced").trim(),
      Boolean(body.offlineFirst)
    ]
  );

  const user = publicUser(rows[0]);
  await query(
    `INSERT INTO tasks (user_id, title, description, due_at, priority, source)
     VALUES (
      $1,
      'Set your DRISHTI learning goals',
      'Add goals, interests, and language preferences so recommendations can work from your real profile.',
      NOW() + INTERVAL '1 day',
      3,
      'system'
     )`,
    [user.id]
  );

  const session = await createSession(user.id, req);
  sendJson(res, 201, { user }, { "Set-Cookie": buildSessionCookie(session.token, session.expiresAt) });
}

async function handleLogin(req, res) {
  const body = await readBody(req);
  const email = normalizeEmail(body.email);
  const { rows } = await query("SELECT * FROM users WHERE email = $1", [email]);
  const row = rows[0];
  if (!row || !verifyPassword(body.password, row.password_hash)) {
    return sendError(res, 401, "Email or password is incorrect", "INVALID_CREDENTIALS");
  }

  const user = publicUser(row);
  const session = await createSession(user.id, req);
  sendJson(res, 200, { user }, { "Set-Cookie": buildSessionCookie(session.token, session.expiresAt) });
}

async function handleProfile(req, res, user) {
  const body = await readBody(req);
  const allowedLevel = String(body.level || user.level || "Beginner").trim();
  const languages = asArray(body.languages).length ? asArray(body.languages) : user.languages;
  const goals = asArray(body.goals);
  const interests = asArray(body.interests);

  const { rows } = await query(
    `UPDATE users SET
      name = COALESCE(NULLIF($2, ''), name),
      grade = COALESCE($3, grade),
      district = COALESCE($4, district),
      level = COALESCE(NULLIF($5, ''), level),
      languages = $6::jsonb,
      goals = $7::jsonb,
      interests = $8::jsonb,
      pace = COALESCE(NULLIF($9, ''), pace),
      offline_first = $10,
      updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      user.id,
      String(body.name || "").trim(),
      body.grade ?? user.grade,
      body.district ?? user.district,
      allowedLevel,
      jsonParam(languages),
      jsonParam(goals),
      jsonParam(interests),
      String(body.pace || user.pace || "Balanced").trim(),
      Boolean(body.offlineFirst)
    ]
  );

  const updatedUser = publicUser(rows[0]);
  const workspace = await loadWorkspace(updatedUser);
  sendJson(res, 200, { profile: workspace.profile, analytics: workspace.analytics, recommendations: workspace.recommendations, studyPlan: workspace.studyPlan });
}

async function handleCourses(req, res, url, user) {
  const queryText = url.searchParams.get("query") || "";
  const level = url.searchParams.get("level") || "";
  const language = url.searchParams.get("language") || "";
  const mode = url.searchParams.get("mode") || "";
  const workspace = await loadWorkspace(user);
  let courses = workspace.courses.filter((course) => courseMatchesQuery(course, queryText));
  if (level) courses = courses.filter((course) => course.level === level || course.level === "All Levels");
  if (language) courses = courses.filter((course) => asArray(course.languages).includes(language));
  if (mode === "offline") courses = courses.filter((course) => course.offlineReady);
  sendJson(res, 200, { courses });
}

async function handleCourseEnroll(req, res, user, courseId) {
  const body = await readBody(req);
  const status = ["saved", "enrolled", "in_progress"].includes(body.status) ? body.status : "enrolled";
  const course = await query("SELECT * FROM courses WHERE id = $1", [courseId]);
  if (!course.rows.length) return sendError(res, 404, "Course not found", "NOT_FOUND");

  const existing = await query("SELECT status FROM course_progress WHERE user_id = $1 AND course_id = $2", [user.id, courseId]);
  await query(
    `INSERT INTO course_progress (user_id, course_id, status, progress)
     VALUES ($1, $2, $3, 0)
     ON CONFLICT (user_id, course_id) DO UPDATE SET
       status = CASE
        WHEN course_progress.status = 'completed' THEN 'completed'
        ELSE EXCLUDED.status
       END,
       updated_at = NOW()`,
    [user.id, courseId, status]
  );

  if (!existing.rows.length) {
    await query("UPDATE courses SET enrollments = enrollments + 1, updated_at = NOW() WHERE id = $1", [courseId]);
    await query(
      `INSERT INTO tasks (user_id, course_id, title, description, due_at, priority, source)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '2 days', 2, 'course')`,
      [
        user.id,
        courseId,
        `Start ${course.rows[0].title}`,
        "Open the course, study the first section, and write one note you can explain to a peer."
      ]
    );
    await query(
      `INSERT INTO learning_events (user_id, type, course_id, xp)
       VALUES ($1, 'course_enrolled', $2, 20)`,
      [user.id, courseId]
    );
  }

  sendJson(res, 200, await loadWorkspace(user));
}

async function handleLearningEvent(req, res, user) {
  const body = await readBody(req);
  const type = String(body.type || "activity").trim();
  const courseId = body.courseId || null;
  const taskId = body.taskId || null;
  const xp = Number(body.xp || (type === "course_completed" ? 180 : 25));

  if (type === "course_completed") {
    if (!courseId) return sendError(res, 400, "courseId is required", "VALIDATION_ERROR");
    const course = await query("SELECT id FROM courses WHERE id = $1", [courseId]);
    if (!course.rows.length) return sendError(res, 404, "Course not found", "NOT_FOUND");
    await query(
      `INSERT INTO course_progress (user_id, course_id, status, progress, completed_at)
       VALUES ($1, $2, 'completed', 100, NOW())
       ON CONFLICT (user_id, course_id) DO UPDATE SET
        status = 'completed',
        progress = 100,
        completed_at = COALESCE(course_progress.completed_at, NOW()),
        updated_at = NOW()`,
      [user.id, courseId]
    );
    await query(
      `UPDATE tasks
          SET status = 'done', updated_at = NOW()
        WHERE user_id = $1 AND course_id = $2 AND status <> 'done'`,
      [user.id, courseId]
    );
  }

  if (taskId) {
    await query(
      `UPDATE tasks
          SET status = 'done', updated_at = NOW()
        WHERE id = $1 AND user_id = $2`,
      [taskId, user.id]
    );
  }

  await query(
    `INSERT INTO learning_events (user_id, type, course_id, task_id, xp, meta)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [user.id, type, courseId, taskId, xp, JSON.stringify(body.meta || {})]
  );

  sendJson(res, 201, await loadWorkspace(user));
}

async function handleCreateTask(req, res, user) {
  const body = await readBody(req);
  const title = String(body.title || "").trim();
  if (!title) return sendError(res, 400, "Task title is required", "VALIDATION_ERROR");

  await query(
    `INSERT INTO tasks (user_id, course_id, title, description, due_at, priority, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      user.id,
      body.courseId || null,
      title,
      String(body.description || "").trim(),
      body.dueAt || null,
      Number(body.priority || 1),
      String(body.source || "user").trim()
    ]
  );

  sendJson(res, 201, await loadWorkspace(user));
}

async function handleCompleteTask(req, res, user, taskId) {
  const updated = await query(
    `UPDATE tasks
        SET status = 'done', updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *`,
    [taskId, user.id]
  );
  if (!updated.rows.length) return sendError(res, 404, "Task not found", "NOT_FOUND");

  await query(
    `INSERT INTO learning_events (user_id, type, task_id, xp)
     VALUES ($1, 'task_completed', $2, 35)`,
    [user.id, taskId]
  );

  sendJson(res, 200, await loadWorkspace(user));
}

async function handleForumPost(req, res, user, forumId) {
  const body = await readBody(req);
  const text = String(body.text || "").trim();
  if (!text) return sendError(res, 400, "Post text is required", "VALIDATION_ERROR");

  const forum = await query("SELECT id FROM forums WHERE id = $1", [forumId]);
  if (!forum.rows.length) return sendError(res, 404, "Forum not found", "NOT_FOUND");

  await query(
    `INSERT INTO forum_posts (forum_id, user_id, text)
     VALUES ($1, $2, $3)`,
    [forumId, user.id, text]
  );
  await query(
    `INSERT INTO learning_events (user_id, type, forum_id, xp)
     VALUES ($1, 'forum_post', $2, 40)`,
    [user.id, forumId]
  );

  sendJson(res, 201, await loadWorkspace(user));
}

async function handleReactPost(req, res, postId) {
  const updated = await query(
    `UPDATE forum_posts SET likes = likes + 1 WHERE id = $1 RETURNING *`,
    [postId]
  );
  if (!updated.rows.length) return sendError(res, 404, "Post not found", "NOT_FOUND");
  sendJson(res, 200, { post: { id: String(updated.rows[0].id), likes: Number(updated.rows[0].likes || 0) } });
}

async function handleCreateGroup(req, res, user) {
  const body = await readBody(req);
  const name = String(body.name || "").trim();
  const subject = String(body.subject || "").trim();
  if (!name || !subject) return sendError(res, 400, "Group name and subject are required", "VALIDATION_ERROR");

  const { rows } = await query(
    `INSERT INTO study_groups (name, subject, mentor, meeting, capacity, tasks, docs, created_by)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
     RETURNING id`,
    [
      name,
      subject,
      String(body.mentor || "Peer-led").trim(),
      String(body.meeting || "Flexible").trim(),
      Number(body.capacity || 10),
      jsonParam(["Set group goal", "Share first resource", "Run one peer teaching session"]),
      jsonParam(["Shared notes"]),
      user.id
    ]
  );

  await query("INSERT INTO group_memberships (group_id, user_id) VALUES ($1, $2)", [rows[0].id, user.id]);
  await query(
    `INSERT INTO learning_events (user_id, type, group_id, xp)
     VALUES ($1, 'group_joined', $2, 50)`,
    [user.id, rows[0].id]
  );

  sendJson(res, 201, await loadWorkspace(user));
}

async function handleJoinGroup(req, res, user, groupId) {
  const group = await query("SELECT id, capacity FROM study_groups WHERE id = $1", [groupId]);
  if (!group.rows.length) return sendError(res, 404, "Group not found", "NOT_FOUND");

  const members = await query("SELECT user_id FROM group_memberships WHERE group_id = $1", [groupId]);
  const alreadyJoined = members.rows.some((row) => String(row.user_id) === user.id);
  if (!alreadyJoined && members.rows.length >= Number(group.rows[0].capacity || 0)) {
    return sendError(res, 409, "Group is full", "GROUP_FULL");
  }

  if (!alreadyJoined) {
    await query("INSERT INTO group_memberships (group_id, user_id) VALUES ($1, $2)", [groupId, user.id]);
    await query(
      `INSERT INTO learning_events (user_id, type, group_id, xp)
       VALUES ($1, 'group_joined', $2, 50)`,
      [user.id, groupId]
    );
  }

  sendJson(res, 200, await loadWorkspace(user));
}

async function handleOfflinePack(req, res, user) {
  const body = await readBody(req);
  const courseId = body.courseId;
  const course = await query("SELECT id FROM courses WHERE id = $1", [courseId]);
  if (!course.rows.length) return sendError(res, 404, "Course not found", "NOT_FOUND");

  const resourceIds = asArray(body.resourceIds);
  await query(
    `INSERT INTO offline_packs (user_id, course_id, resource_ids, language, expires_at)
     VALUES ($1, $2, $3::jsonb, $4, NOW() + INTERVAL '30 days')`,
    [user.id, courseId, jsonParam(resourceIds), String(body.language || user.languages[0] || "English")]
  );
  await query(
    `INSERT INTO learning_events (user_id, type, course_id, xp)
     VALUES ($1, 'offline_pack_created', $2, 35)`,
    [user.id, courseId]
  );

  sendJson(res, 201, await loadWorkspace(user));
}

async function handleContact(req, res) {
  const body = await readBody(req);
  const user = await getSessionUser(req).catch(() => null);
  const name = String(body.name || user?.name || "").trim();
  const email = normalizeEmail(body.email || user?.email || "");
  const message = String(body.message || "").trim();

  if (!name || !email || !message) {
    return sendError(res, 400, "Name, email, and message are required", "VALIDATION_ERROR");
  }

  await query(
    `INSERT INTO contacts (user_id, name, email, organization, interest, message)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      user?.id || null,
      name,
      email,
      String(body.organization || "").trim(),
      String(body.interest || "Partnership").trim(),
      message
    ]
  );

  sendJson(res, 201, {
    nextStep: "Message saved. The DRISHTI team can review it from the database."
  });
}

async function handleApi(req, res, url) {
  const method = req.method || "GET";
  const parts = url.pathname.split("/").filter(Boolean);

  try {
    if (method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        platform: "DRISHTI",
        databaseConfigured: hasDatabaseConfig(),
        timestamp: new Date().toISOString()
      });
    }

    if (method === "POST" && url.pathname === "/api/auth/register") return await handleRegister(req, res);
    if (method === "POST" && url.pathname === "/api/auth/login") return await handleLogin(req, res);
    if (method === "POST" && url.pathname === "/api/auth/logout") {
      await destroySession(req);
      return sendJson(res, 200, { ok: true }, { "Set-Cookie": clearSessionCookie() });
    }
    if (method === "GET" && url.pathname === "/api/auth/me") {
      const user = await getSessionUser(req);
      if (!user) return sendError(res, 401, "Not signed in", "AUTH_REQUIRED");
      return sendJson(res, 200, { user });
    }
    if (method === "POST" && url.pathname === "/api/contact") return await handleContact(req, res);

    const user = await requireUser(req);

    if (method === "GET" && url.pathname === "/api/bootstrap") return sendJson(res, 200, await loadWorkspace(user));
    if (method === "GET" && url.pathname === "/api/courses") return await handleCourses(req, res, url, user);
    if (method === "POST" && parts[0] === "api" && parts[1] === "courses" && parts[3] === "enroll") {
      return await handleCourseEnroll(req, res, user, parts[2]);
    }
    if (method === "POST" && url.pathname === "/api/profile") return await handleProfile(req, res, user);
    if (method === "GET" && url.pathname === "/api/recommendations") {
      const workspace = await loadWorkspace(user);
      return sendJson(res, 200, {
        recommendations: workspace.recommendations,
        upcomingTasks: workspace.upcomingTasks,
        suggestedTasks: workspace.suggestedTasks,
        studyPlan: workspace.studyPlan
      });
    }
    if (method === "GET" && url.pathname === "/api/tasks") {
      const workspace = await loadWorkspace(user);
      return sendJson(res, 200, { tasks: workspace.tasks, upcomingTasks: workspace.upcomingTasks });
    }
    if (method === "POST" && url.pathname === "/api/tasks") return await handleCreateTask(req, res, user);
    if (method === "POST" && parts[0] === "api" && parts[1] === "tasks" && parts[3] === "complete") {
      return await handleCompleteTask(req, res, user, parts[2]);
    }
    if (method === "GET" && url.pathname === "/api/forums") {
      const workspace = await loadWorkspace(user);
      return sendJson(res, 200, { forums: workspace.forums });
    }
    if (method === "POST" && parts[0] === "api" && parts[1] === "forums" && parts[3] === "posts") {
      return await handleForumPost(req, res, user, parts[2]);
    }
    if (method === "POST" && parts[0] === "api" && parts[1] === "posts" && parts[3] === "react") {
      return await handleReactPost(req, res, parts[2]);
    }
    if (method === "GET" && url.pathname === "/api/groups") {
      const workspace = await loadWorkspace(user);
      return sendJson(res, 200, { groups: workspace.groups });
    }
    if (method === "POST" && url.pathname === "/api/groups") return await handleCreateGroup(req, res, user);
    if (method === "POST" && parts[0] === "api" && parts[1] === "groups" && parts[3] === "join") {
      return await handleJoinGroup(req, res, user, parts[2]);
    }
    if (method === "GET" && url.pathname === "/api/offline-packs") {
      const workspace = await loadWorkspace(user);
      return sendJson(res, 200, { offlinePacks: workspace.offlinePacks, resources: workspace.resources });
    }
    if (method === "POST" && url.pathname === "/api/offline-packs") return await handleOfflinePack(req, res, user);
    if (method === "POST" && url.pathname === "/api/learning-events") return await handleLearningEvent(req, res, user);
    if (method === "GET" && url.pathname === "/api/analytics") {
      const workspace = await loadWorkspace(user);
      return sendJson(res, 200, { analytics: workspace.analytics, leaderboard: workspace.leaderboard });
    }
    if (method === "GET" && url.pathname === "/api/leaderboard") {
      return sendJson(res, 200, { leaderboard: await getLeaderboard() });
    }

    return sendError(res, 404, "API route not found", "NOT_FOUND");
  } catch (error) {
    if (
      error instanceof SetupError ||
      error.name === "SetupError" ||
      error.code === "SETUP_REQUIRED" ||
      String(error.message || "").includes("DATABASE_URL")
    ) {
      return sendError(res, 503, error.message, "SETUP_REQUIRED");
    }
    if (error instanceof AuthError || error.code === "AUTH_REQUIRED") {
      return sendError(res, 401, error.message, "AUTH_REQUIRED");
    }
    if (error.message === "Invalid JSON body" || error.message === "Request body is too large") {
      return sendError(res, 400, error.message, "VALIDATION_ERROR");
    }
    console.error(error);
    return sendError(res, error.status || 500, error.message || "Unexpected server error");
  }
}

module.exports = {
  handleApi,
  readBody,
  sendError,
  sendJson
};
