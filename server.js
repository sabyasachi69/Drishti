const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 4323);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = process.env.VERCEL ? "/tmp" : path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "drishti-db.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

let db = loadDatabase();

function loadDatabase() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(DATA_FILE)) {
    const seeded = seedDatabase();
    saveDatabase(seeded);
    return seeded;
  }

  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    const backup = `${DATA_FILE}.broken-${Date.now()}`;
    fs.copyFileSync(DATA_FILE, backup);
    const seeded = seedDatabase();
    saveDatabase(seeded);
    return seeded;
  }
}

function saveDatabase(nextDb = db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(nextDb, null, 2));
}

function seedDatabase() {
  const now = new Date();
  const daysAgo = (days) => new Date(now.getTime() - days * 86400000).toISOString();

  return {
    learners: [
      {
        id: "learner-odisha",
        name: "Aarav Mishra",
        role: "Student",
        grade: "Class 11",
        district: "Cuttack",
        level: "Intermediate",
        languages: ["English", "Odia", "Hindi"],
        goals: ["AI", "Mathematics", "Peer Teaching"],
        interests: ["AI", "Data Science", "Exam Prep", "Communication"],
        pace: "Balanced",
        offlineFirst: true,
        streak: 8,
        xp: 1240,
        joinedAt: daysAgo(42)
      },
      {
        id: "learner-rural",
        name: "Mitali Nayak",
        role: "Student",
        grade: "Class 10",
        district: "Koraput",
        level: "Beginner",
        languages: ["Odia", "Hindi"],
        goals: ["Science", "Peer Teaching"],
        interests: ["Science", "Foundations", "Offline Learning"],
        pace: "Gentle",
        offlineFirst: true,
        streak: 12,
        xp: 1515,
        joinedAt: daysAgo(66)
      }
    ],
    teachers: [
      {
        id: "teacher-sen",
        name: "Priya Sen",
        subject: "Mathematics",
        languages: ["English", "Odia"],
        district: "Bhubaneswar",
        rating: 4.9
      },
      {
        id: "teacher-dash",
        name: "Rakesh Dash",
        subject: "Computer Science",
        languages: ["English", "Hindi", "Odia"],
        district: "Sambalpur",
        rating: 4.7
      }
    ],
    platforms: [
      { id: "khan", name: "Khan Academy", status: "synced", resources: 1284 },
      { id: "edx", name: "edX", status: "synced", resources: 348 },
      { id: "coursera", name: "Coursera", status: "synced", resources: 512 },
      { id: "ncert", name: "NCERT Digital Library", status: "synced", resources: 902 }
    ],
    courses: [
      {
        id: "course-ai-basics",
        title: "AI Foundations for Student Projects",
        provider: "Khan Academy",
        level: "Beginner",
        language: ["English", "Hindi"],
        durationHours: 8,
        offlineReady: true,
        rating: 4.8,
        enrollments: 2300,
        tags: ["AI", "Problem Solving", "Projects"],
        skills: ["Prompting", "Classification", "Ethics"],
        description: "Build a practical foundation in AI concepts through project-first lessons and peer challenges.",
        units: ["AI vocabulary", "Model thinking", "Build a mini classifier", "Peer teaching challenge"]
      },
      {
        id: "course-math-bridge",
        title: "Mathematics Bridge: Algebra to Calculus",
        provider: "edX",
        level: "Intermediate",
        language: ["English", "Odia"],
        durationHours: 18,
        offlineReady: true,
        rating: 4.7,
        enrollments: 1780,
        tags: ["Mathematics", "Exam Prep", "Foundations"],
        skills: ["Algebra", "Functions", "Calculus Readiness"],
        description: "A structured bridge course that turns scattered math videos into a guided weekly study plan.",
        units: ["Algebra repair", "Functions", "Graph reading", "Calculus entry test"]
      },
      {
        id: "course-peer-teaching",
        title: "Peer Teaching Studio",
        provider: "DRISHTI Original",
        level: "All Levels",
        language: ["English", "Odia", "Hindi"],
        durationHours: 6,
        offlineReady: false,
        rating: 4.9,
        enrollments: 920,
        tags: ["Peer Teaching", "Communication", "Collaboration"],
        skills: ["Explaining", "Feedback", "Group Facilitation"],
        description: "Practice turning what you know into simple explanations, discussion prompts, and study circles.",
        units: ["Teach-back method", "Question design", "Feedback loops", "Run a study circle"]
      },
      {
        id: "course-science-offline",
        title: "Science Offline Pack: Motion, Energy, Life",
        provider: "NCERT Digital Library",
        level: "Beginner",
        language: ["Odia", "Hindi"],
        durationHours: 12,
        offlineReady: true,
        rating: 4.6,
        enrollments: 3100,
        tags: ["Science", "Offline Learning", "Foundations"],
        skills: ["Physics Basics", "Biology Basics", "Experiment Notes"],
        description: "Low-bandwidth science modules with summaries, diagrams, and peer discussion prompts.",
        units: ["Motion", "Energy", "Cells", "Home experiments"]
      },
      {
        id: "course-data-story",
        title: "Data Storytelling for Smart Odisha",
        provider: "Coursera",
        level: "Intermediate",
        language: ["English"],
        durationHours: 10,
        offlineReady: false,
        rating: 4.5,
        enrollments: 840,
        tags: ["Data Science", "Communication", "Projects"],
        skills: ["Charts", "Evidence", "Presentation"],
        description: "Learn to explain data insights clearly through dashboards, stories, and team presentations.",
        units: ["Data questions", "Chart selection", "Insight writing", "Final pitch"]
      },
      {
        id: "course-career-ready",
        title: "Career Ready Skills Lab",
        provider: "DRISHTI Original",
        level: "All Levels",
        language: ["English", "Hindi", "Odia"],
        durationHours: 9,
        offlineReady: true,
        rating: 4.7,
        enrollments: 1640,
        tags: ["Career", "Communication", "Peer Teaching"],
        skills: ["Resume Basics", "Interview Practice", "Teamwork"],
        description: "A guided skill lab that turns learning progress into employability-ready evidence.",
        units: ["Skill map", "Portfolio notes", "Mock interview", "Peer review"]
      }
    ],
    resources: [
      {
        id: "resource-algebra-cheatsheet",
        title: "Algebra Recovery Sheet",
        type: "PDF",
        language: "Odia",
        sizeMb: 1.2,
        tags: ["Mathematics", "Offline Learning"],
        offlineReady: true
      },
      {
        id: "resource-ai-cards",
        title: "AI Concept Flashcards",
        type: "Cards",
        language: "English",
        sizeMb: 0.8,
        tags: ["AI", "Exam Prep"],
        offlineReady: true
      },
      {
        id: "resource-peer-rubric",
        title: "Peer Teaching Feedback Rubric",
        type: "Template",
        language: "Hindi",
        sizeMb: 0.4,
        tags: ["Peer Teaching", "Collaboration"],
        offlineReady: true
      }
    ],
    forums: [
      {
        id: "forum-math",
        subject: "Mathematics",
        description: "Ask for help, explain shortcuts, and build exam-ready confidence.",
        members: 184,
        posts: [
          {
            id: "post-1",
            author: "Mitali Nayak",
            role: "Student",
            text: "Can someone explain why completing the square works for quadratics?",
            likes: 18,
            replies: [
              {
                id: "reply-1",
                author: "Priya Sen",
                text: "Think of it as making a rectangle into a perfect square, then balancing the missing area.",
                createdAt: daysAgo(2)
              }
            ],
            createdAt: daysAgo(3)
          }
        ]
      },
      {
        id: "forum-ai",
        subject: "AI and Projects",
        description: "Build hackathon ideas, discuss AI ethics, and review student prototypes.",
        members: 96,
        posts: [
          {
            id: "post-2",
            author: "Aarav Mishra",
            role: "Student",
            text: "I want to make course recommendations explainable. What factors should be visible to learners?",
            likes: 24,
            replies: [],
            createdAt: daysAgo(1)
          }
        ]
      }
    ],
    groups: [
      {
        id: "group-ai-builders",
        name: "AI Builders Circle",
        subject: "AI",
        mentor: "Rakesh Dash",
        meeting: "Tue 7:00 PM",
        capacity: 12,
        members: ["learner-odisha"],
        progress: 64,
        docs: ["Project idea sheet", "Model glossary"],
        tasks: ["Pick a dataset", "Explain one model to a peer", "Ship demo notes"]
      },
      {
        id: "group-math-sprint",
        name: "Math Bridge Sprint",
        subject: "Mathematics",
        mentor: "Priya Sen",
        meeting: "Sat 5:00 PM",
        capacity: 18,
        members: ["learner-rural"],
        progress: 42,
        docs: ["Algebra repair sheet", "Weekly quiz tracker"],
        tasks: ["Complete functions quiz", "Teach one solved problem", "Review peer notes"]
      }
    ],
    offlinePacks: [
      {
        id: "pack-1",
        learnerId: "learner-odisha",
        courseId: "course-math-bridge",
        resourceIds: ["resource-algebra-cheatsheet"],
        language: "Odia",
        createdAt: daysAgo(6),
        expiresAt: new Date(now.getTime() + 24 * 86400000).toISOString()
      }
    ],
    events: [
      { id: "event-1", learnerId: "learner-odisha", type: "course_completed", courseId: "course-peer-teaching", xp: 220, createdAt: daysAgo(6) },
      { id: "event-2", learnerId: "learner-odisha", type: "forum_post", forumId: "forum-ai", xp: 40, createdAt: daysAgo(4) },
      { id: "event-3", learnerId: "learner-odisha", type: "resource_saved", resourceId: "resource-algebra-cheatsheet", xp: 35, createdAt: daysAgo(2) },
      { id: "event-4", learnerId: "learner-rural", type: "course_completed", courseId: "course-science-offline", xp: 260, createdAt: daysAgo(5) },
      { id: "event-5", learnerId: "learner-rural", type: "group_joined", groupId: "group-math-sprint", xp: 50, createdAt: daysAgo(3) }
    ],
    contacts: []
  };
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
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

function getLearner(id = "learner-odisha") {
  return db.learners.find((learner) => learner.id === id) || db.learners[0];
}

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function courseMatchesQuery(course, query) {
  if (!query) return true;
  const haystack = [
    course.title,
    course.provider,
    course.level,
    course.description,
    course.tags.join(" "),
    course.skills.join(" ")
  ].join(" ").toLowerCase();
  return tokenize(query).every((part) => haystack.includes(part));
}

function scoreCourse(course, learner) {
  const learnerSignals = new Set([
    ...learner.goals,
    ...learner.interests,
    learner.level,
    learner.grade
  ].map((item) => String(item).toLowerCase()));

  const courseSignals = [
    course.level,
    ...course.tags,
    ...course.skills,
    course.title
  ].map((item) => String(item).toLowerCase());

  let score = Math.round(course.rating * 12) + Math.min(30, Math.floor(course.enrollments / 120));
  const reasons = [];

  for (const signal of courseSignals) {
    for (const learnerSignal of learnerSignals) {
      if (signal.includes(learnerSignal) || learnerSignal.includes(signal)) {
        score += 18;
        reasons.push(`Matches ${titleCase(learnerSignal)}`);
      }
    }
  }

  if (course.language.some((language) => learner.languages.includes(language))) {
    score += 16;
    reasons.push("Available in your language set");
  }

  if (learner.offlineFirst && course.offlineReady) {
    score += 14;
    reasons.push("Works offline");
  }

  if (course.level === learner.level || course.level === "All Levels") {
    score += 12;
    reasons.push("Right difficulty");
  }

  const uniqueReasons = [...new Set(reasons)].slice(0, 3);
  return {
    ...course,
    score,
    fit: Math.min(99, Math.max(58, score)),
    reasons: uniqueReasons.length ? uniqueReasons : ["Strong learner outcomes", "Popular with peer groups"]
  };
}

function getRecommendations(learner, query = "") {
  return db.courses
    .filter((course) => courseMatchesQuery(course, query))
    .map((course) => scoreCourse(course, learner))
    .sort((a, b) => b.score - a.score);
}

function buildStudyPlan(learner) {
  const top = getRecommendations(learner).slice(0, 3);
  return top.map((course, index) => ({
    week: index + 1,
    courseId: course.id,
    title: course.title,
    focus: course.tags[0],
    task: course.units[index] || course.units[0],
    peerAction: index === 0 ? "Explain one concept in a forum" : "Review a study group note",
    expectedXp: 120 + index * 35
  }));
}

function computeAnalytics(learnerId) {
  const learner = getLearner(learnerId);
  const learnerEvents = db.events.filter((event) => event.learnerId === learner.id);
  const totalEventXp = learnerEvents.reduce((sum, event) => sum + Number(event.xp || 0), 0);
  const completedCourseIds = new Set(learnerEvents.filter((event) => event.type === "course_completed").map((event) => event.courseId));
  const groupIds = new Set(learnerEvents.filter((event) => event.type === "group_joined").map((event) => event.groupId));
  const savedResources = learnerEvents.filter((event) => event.type === "resource_saved").length + db.offlinePacks.filter((pack) => pack.learnerId === learner.id).length;
  const forumPosts = learnerEvents.filter((event) => event.type === "forum_post").length;
  const skillMap = {};

  for (const courseId of completedCourseIds) {
    const course = db.courses.find((item) => item.id === courseId);
    if (!course) continue;
    for (const skill of course.skills) skillMap[skill] = (skillMap[skill] || 0) + 1;
  }

  const daily = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.now() - (6 - index) * 86400000);
    const isoDay = date.toISOString().slice(0, 10);
    const xp = learnerEvents
      .filter((event) => String(event.createdAt || "").startsWith(isoDay))
      .reduce((sum, event) => sum + Number(event.xp || 0), 0);
    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      xp
    };
  });

  const badges = [
    completedCourseIds.size >= 1 ? "Course Finisher" : null,
    forumPosts >= 1 ? "Peer Voice" : null,
    savedResources >= 2 ? "Offline Ready" : null,
    groupIds.size >= 1 ? "Study Circle" : null,
    learner.streak >= 7 ? "Weekly Streak" : null
  ].filter(Boolean);

  return {
    learner,
    totals: {
      xp: learner.xp + totalEventXp,
      completedCourses: completedCourseIds.size,
      savedResources,
      forumPosts,
      studyGroups: db.groups.filter((group) => group.members.includes(learner.id)).length
    },
    daily,
    skills: Object.entries(skillMap).map(([skill, count]) => ({ skill, count })),
    badges,
    nextBestAction: getRecommendations(learner)[0]
  };
}

function getLeaderboard() {
  return db.learners
    .map((learner) => {
      const xp = learner.xp + db.events
        .filter((event) => event.learnerId === learner.id)
        .reduce((sum, event) => sum + Number(event.xp || 0), 0);
      return {
        id: learner.id,
        name: learner.name,
        district: learner.district,
        xp,
        streak: learner.streak
      };
    })
    .sort((a, b) => b.xp - a.xp);
}

function titleCase(value) {
  return String(value || "")
    .split(" ")
    .map((word) => word ? word[0].toUpperCase() + word.slice(1) : "")
    .join(" ");
}

function publicProfile(learner) {
  return {
    id: learner.id,
    name: learner.name,
    role: learner.role,
    grade: learner.grade,
    district: learner.district,
    level: learner.level,
    languages: learner.languages,
    goals: learner.goals,
    interests: learner.interests,
    pace: learner.pace,
    offlineFirst: learner.offlineFirst,
    streak: learner.streak,
    xp: learner.xp
  };
}

async function handleApi(req, res, url) {
  const method = req.method || "GET";
  const parts = url.pathname.split("/").filter(Boolean);

  if (method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, platform: "DRISHTI", timestamp: new Date().toISOString() });
  }

  if (method === "GET" && url.pathname === "/api/bootstrap") {
    const learner = getLearner(url.searchParams.get("learnerId") || undefined);
    return sendJson(res, 200, {
      profile: publicProfile(learner),
      platforms: db.platforms,
      courses: db.courses,
      recommendations: getRecommendations(learner).slice(0, 4),
      forums: db.forums,
      groups: db.groups,
      resources: db.resources,
      offlinePacks: db.offlinePacks.filter((pack) => pack.learnerId === learner.id),
      analytics: computeAnalytics(learner.id),
      leaderboard: getLeaderboard(),
      studyPlan: buildStudyPlan(learner)
    });
  }

  if (method === "GET" && url.pathname === "/api/courses") {
    const query = url.searchParams.get("query") || "";
    const level = url.searchParams.get("level") || "";
    const language = url.searchParams.get("language") || "";
    const mode = url.searchParams.get("mode") || "";
    let courses = db.courses.filter((course) => courseMatchesQuery(course, query));
    if (level) courses = courses.filter((course) => course.level === level || course.level === "All Levels");
    if (language) courses = courses.filter((course) => course.language.includes(language));
    if (mode === "offline") courses = courses.filter((course) => course.offlineReady);
    return sendJson(res, 200, { courses });
  }

  if (method === "GET" && url.pathname === "/api/recommendations") {
    const learner = getLearner(url.searchParams.get("learnerId") || undefined);
    const query = url.searchParams.get("query") || "";
    return sendJson(res, 200, {
      learner: publicProfile(learner),
      recommendations: getRecommendations(learner, query).slice(0, 6),
      studyPlan: buildStudyPlan(learner)
    });
  }

  if (method === "POST" && url.pathname === "/api/profile") {
    const body = await readBody(req);
    const learner = getLearner(body.learnerId);
    const allowed = ["name", "grade", "district", "level", "languages", "goals", "interests", "pace", "offlineFirst"];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, key)) learner[key] = body[key];
    }
    saveDatabase();
    return sendJson(res, 200, { profile: publicProfile(learner), analytics: computeAnalytics(learner.id) });
  }

  if (method === "GET" && url.pathname === "/api/forums") {
    return sendJson(res, 200, { forums: db.forums });
  }

  if (method === "POST" && parts[0] === "api" && parts[1] === "forums" && parts[3] === "posts") {
    const forum = db.forums.find((item) => item.id === parts[2]);
    if (!forum) return sendError(res, 404, "Forum not found");
    const body = await readBody(req);
    const learner = getLearner(body.learnerId);
    const text = String(body.text || "").trim();
    if (!text) return sendError(res, 400, "Post text is required");

    const post = {
      id: `post-${crypto.randomUUID()}`,
      author: learner.name,
      role: learner.role,
      text,
      likes: 0,
      replies: [],
      createdAt: new Date().toISOString()
    };
    forum.posts.unshift(post);
    db.events.push({
      id: `event-${crypto.randomUUID()}`,
      learnerId: learner.id,
      type: "forum_post",
      forumId: forum.id,
      xp: 40,
      createdAt: new Date().toISOString()
    });
    saveDatabase();
    return sendJson(res, 201, { forum, post, analytics: computeAnalytics(learner.id) });
  }

  if (method === "POST" && parts[0] === "api" && parts[1] === "posts" && parts[3] === "react") {
    const postId = parts[2];
    const post = db.forums.flatMap((forum) => forum.posts).find((item) => item.id === postId);
    if (!post) return sendError(res, 404, "Post not found");
    post.likes += 1;
    saveDatabase();
    return sendJson(res, 200, { post });
  }

  if (method === "GET" && url.pathname === "/api/groups") {
    return sendJson(res, 200, { groups: db.groups });
  }

  if (method === "POST" && url.pathname === "/api/groups") {
    const body = await readBody(req);
    const learner = getLearner(body.learnerId);
    const name = String(body.name || "").trim();
    const subject = String(body.subject || "").trim();
    if (!name || !subject) return sendError(res, 400, "Group name and subject are required");
    const group = {
      id: `group-${crypto.randomUUID()}`,
      name,
      subject,
      mentor: body.mentor || "Peer-led",
      meeting: body.meeting || "Flexible",
      capacity: Number(body.capacity || 10),
      members: [learner.id],
      progress: 0,
      docs: ["Shared notes"],
      tasks: ["Set group goal", "Share first resource", "Run peer teaching session"]
    };
    db.groups.unshift(group);
    db.events.push({
      id: `event-${crypto.randomUUID()}`,
      learnerId: learner.id,
      type: "group_joined",
      groupId: group.id,
      xp: 50,
      createdAt: new Date().toISOString()
    });
    saveDatabase();
    return sendJson(res, 201, { group, groups: db.groups, analytics: computeAnalytics(learner.id) });
  }

  if (method === "POST" && parts[0] === "api" && parts[1] === "groups" && parts[3] === "join") {
    const body = await readBody(req);
    const learner = getLearner(body.learnerId);
    const group = db.groups.find((item) => item.id === parts[2]);
    if (!group) return sendError(res, 404, "Group not found");
    if (!group.members.includes(learner.id)) {
      if (group.members.length >= group.capacity) return sendError(res, 409, "Group is full");
      group.members.push(learner.id);
      db.events.push({
        id: `event-${crypto.randomUUID()}`,
        learnerId: learner.id,
        type: "group_joined",
        groupId: group.id,
        xp: 50,
        createdAt: new Date().toISOString()
      });
      saveDatabase();
    }
    return sendJson(res, 200, { group, groups: db.groups, analytics: computeAnalytics(learner.id) });
  }

  if (method === "GET" && url.pathname === "/api/offline-packs") {
    const learner = getLearner(url.searchParams.get("learnerId") || undefined);
    return sendJson(res, 200, {
      offlinePacks: db.offlinePacks.filter((pack) => pack.learnerId === learner.id),
      resources: db.resources.filter((resource) => resource.offlineReady)
    });
  }

  if (method === "POST" && url.pathname === "/api/offline-packs") {
    const body = await readBody(req);
    const learner = getLearner(body.learnerId);
    const course = db.courses.find((item) => item.id === body.courseId);
    if (!course) return sendError(res, 404, "Course not found");
    const pack = {
      id: `pack-${crypto.randomUUID()}`,
      learnerId: learner.id,
      courseId: course.id,
      resourceIds: Array.isArray(body.resourceIds) ? body.resourceIds : [],
      language: body.language || learner.languages[0] || "English",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString()
    };
    db.offlinePacks.unshift(pack);
    db.events.push({
      id: `event-${crypto.randomUUID()}`,
      learnerId: learner.id,
      type: "resource_saved",
      courseId: course.id,
      xp: 35,
      createdAt: new Date().toISOString()
    });
    saveDatabase();
    return sendJson(res, 201, {
      pack,
      offlinePacks: db.offlinePacks.filter((item) => item.learnerId === learner.id),
      analytics: computeAnalytics(learner.id)
    });
  }

  if (method === "POST" && url.pathname === "/api/learning-events") {
    const body = await readBody(req);
    const learner = getLearner(body.learnerId);
    const type = String(body.type || "activity");
    const xp = Number(body.xp || (type === "course_completed" ? 180 : 25));
    const event = {
      id: `event-${crypto.randomUUID()}`,
      learnerId: learner.id,
      type,
      courseId: body.courseId,
      resourceId: body.resourceId,
      forumId: body.forumId,
      groupId: body.groupId,
      xp,
      meta: body.meta || {},
      createdAt: new Date().toISOString()
    };
    db.events.push(event);
    learner.streak = Math.max(learner.streak || 1, 1);
    saveDatabase();
    return sendJson(res, 201, { event, analytics: computeAnalytics(learner.id), leaderboard: getLeaderboard() });
  }

  if (method === "GET" && url.pathname === "/api/analytics") {
    const learner = getLearner(url.searchParams.get("learnerId") || undefined);
    return sendJson(res, 200, { analytics: computeAnalytics(learner.id), leaderboard: getLeaderboard() });
  }

  if (method === "GET" && url.pathname === "/api/leaderboard") {
    return sendJson(res, 200, { leaderboard: getLeaderboard() });
  }

  if (method === "POST" && url.pathname === "/api/contact") {
    const body = await readBody(req);
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const message = String(body.message || "").trim();
    if (!name || !email || !message) return sendError(res, 400, "Name, email, and message are required");
    const contact = {
      id: `contact-${crypto.randomUUID()}`,
      name,
      email,
      organization: body.organization || "",
      interest: body.interest || "Partnership",
      message,
      createdAt: new Date().toISOString()
    };
    db.contacts.unshift(contact);
    saveDatabase();
    return sendJson(res, 201, {
      contact,
      nextStep: "A DRISHTI team member will follow up with a product demo and pilot checklist."
    });
  }

  return sendError(res, 404, "API route not found");
}

function serveStatic(req, res, url) {
  let filePath;
  if (url.pathname === "/" || url.pathname === "/index.html") {
    filePath = path.join(ROOT, "DRISHTI_website.html");
  } else if (url.pathname === "/app" || url.pathname === "/app/") {
    filePath = path.join(PUBLIC_DIR, "app.html");
  } else if (url.pathname.startsWith("/public/")) {
    filePath = path.join(ROOT, url.pathname);
  } else {
    filePath = path.join(PUBLIC_DIR, url.pathname);
  }

  const resolved = path.resolve(filePath);
  const allowedRoots = [path.resolve(ROOT), path.resolve(PUBLIC_DIR)];
  const isAllowed = allowedRoots.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`));
  if (!isAllowed) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(resolved, (statError, stat) => {
    if (statError || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(resolved).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=3600"
    });
    fs.createReadStream(resolved).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    serveStatic(req, res, url);
  } catch (error) {
    sendError(res, 500, error.message || "Unexpected server error");
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`DRISHTI is running at http://localhost:${PORT}`);
  });
}

module.exports = {
  handleApi,
  loadDatabase,
  seedDatabase
};
