const fs = require("fs");
const path = require("path");
const { closeDatabase, jsonParam, query } = require("../lib/db");
const { loadLocalEnv } = require("../lib/env");

loadLocalEnv(path.resolve(__dirname, ".."));

const schemaPath = path.join(__dirname, "..", "db", "schema.sql");

const courses = [
  {
    id: "course-peer-teaching-foundations",
    title: "Peer Teaching Foundations",
    provider: "DRISHTI Starter Catalog",
    level: "All Levels",
    languages: ["English", "Hindi", "Odia"],
    durationHours: 6,
    offlineReady: true,
    rating: 4.7,
    enrollments: 0,
    tags: ["Peer Teaching", "Communication", "Collaboration"],
    skills: ["Explaining", "Question Design", "Feedback"],
    description: "A practical path for turning one learned concept into a clear peer explanation.",
    url: ""
  },
  {
    id: "course-ai-project-readiness",
    title: "AI Project Readiness",
    provider: "DRISHTI Starter Catalog",
    level: "Beginner",
    languages: ["English", "Hindi"],
    durationHours: 8,
    offlineReady: false,
    rating: 4.6,
    enrollments: 0,
    tags: ["AI", "Projects", "Problem Solving"],
    skills: ["Prompting", "Model Thinking", "Ethics"],
    description: "A structured plan for students preparing to build explainable AI project ideas.",
    url: ""
  },
  {
    id: "course-math-bridge",
    title: "Mathematics Bridge",
    provider: "DRISHTI Starter Catalog",
    level: "Intermediate",
    languages: ["English", "Hindi", "Odia"],
    durationHours: 14,
    offlineReady: true,
    rating: 4.8,
    enrollments: 0,
    tags: ["Mathematics", "Exam Prep", "Foundations"],
    skills: ["Algebra", "Functions", "Practice Planning"],
    description: "A focused bridge for repairing weak algebra and function concepts before harder topics.",
    url: ""
  },
  {
    id: "course-science-offline",
    title: "Science Offline Study Pack",
    provider: "DRISHTI Starter Catalog",
    level: "Beginner",
    languages: ["Hindi", "Odia"],
    durationHours: 10,
    offlineReady: true,
    rating: 4.5,
    enrollments: 0,
    tags: ["Science", "Offline Learning", "Foundations"],
    skills: ["Experiment Notes", "Concept Recall", "Diagrams"],
    description: "Low-bandwidth study planning for motion, energy, cells, and home experiment notes.",
    url: ""
  },
  {
    id: "course-career-ready",
    title: "Career Ready Skills Lab",
    provider: "DRISHTI Starter Catalog",
    level: "All Levels",
    languages: ["English", "Hindi", "Odia"],
    durationHours: 9,
    offlineReady: true,
    rating: 4.6,
    enrollments: 0,
    tags: ["Career", "Communication", "Portfolio"],
    skills: ["Resume Basics", "Interview Practice", "Teamwork"],
    description: "Convert learning progress into portfolio notes, mock interviews, and peer-reviewed evidence.",
    url: ""
  }
];

const resources = [
  {
    id: "resource-goal-map",
    title: "Learning Goal Map",
    type: "Template",
    language: "English",
    sizeMb: 0.2,
    tags: ["Planning", "Goals"],
    offlineReady: true,
    url: ""
  },
  {
    id: "resource-peer-rubric",
    title: "Peer Teaching Feedback Rubric",
    type: "Template",
    language: "Hindi",
    sizeMb: 0.3,
    tags: ["Peer Teaching", "Feedback"],
    offlineReady: true,
    url: ""
  },
  {
    id: "resource-offline-notes",
    title: "Offline Study Notes Checklist",
    type: "Checklist",
    language: "Odia",
    sizeMb: 0.2,
    tags: ["Offline Learning", "Study Plan"],
    offlineReady: true,
    url: ""
  }
];

const forums = [
  {
    id: "forum-learning-help",
    subject: "Learning Help",
    description: "Ask doubts, explain concepts, and turn confusion into peer teaching moments."
  },
  {
    id: "forum-projects",
    subject: "Projects",
    description: "Discuss student projects, evidence, datasets, presentations, and build plans."
  },
  {
    id: "forum-career",
    subject: "Career Skills",
    description: "Practice portfolio notes, interviews, communication, and next-step planning."
  }
];

const groups = [
  {
    name: "Peer Teaching Circle",
    subject: "Peer Teaching",
    mentor: "Peer-led",
    meeting: "Sat 5:00 PM",
    capacity: 18,
    progress: 0,
    tasks: ["Choose one concept", "Teach it to one peer", "Collect feedback"],
    docs: ["Peer teaching rubric", "Shared notes"]
  },
  {
    name: "Math Bridge Sprint",
    subject: "Mathematics",
    mentor: "Peer-led",
    meeting: "Sun 6:00 PM",
    capacity: 20,
    progress: 0,
    tasks: ["Finish algebra repair", "Solve five function questions", "Review peer notes"],
    docs: ["Practice tracker", "Formula checklist"]
  }
];

function splitSqlStatements(sql) {
  return sql
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function migrate() {
  const schema = fs.readFileSync(schemaPath, "utf8");
  for (const statement of splitSqlStatements(schema)) {
    await query(statement);
  }

  for (const course of courses) {
    await query(
      `INSERT INTO courses (
        id, title, provider, level, languages, duration_hours, offline_ready,
        rating, enrollments, tags, skills, description, url
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        provider = EXCLUDED.provider,
        level = EXCLUDED.level,
        languages = EXCLUDED.languages,
        duration_hours = EXCLUDED.duration_hours,
        offline_ready = EXCLUDED.offline_ready,
        rating = EXCLUDED.rating,
        tags = EXCLUDED.tags,
        skills = EXCLUDED.skills,
        description = EXCLUDED.description,
        url = EXCLUDED.url,
        updated_at = NOW()`,
      [
        course.id,
        course.title,
        course.provider,
        course.level,
        jsonParam(course.languages),
        course.durationHours,
        course.offlineReady,
        course.rating,
        course.enrollments,
        jsonParam(course.tags),
        jsonParam(course.skills),
        course.description,
        course.url
      ]
    );
  }

  for (const resource of resources) {
    await query(
      `INSERT INTO resources (id, title, type, language, size_mb, tags, offline_ready, url)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        type = EXCLUDED.type,
        language = EXCLUDED.language,
        size_mb = EXCLUDED.size_mb,
        tags = EXCLUDED.tags,
        offline_ready = EXCLUDED.offline_ready,
        url = EXCLUDED.url`,
      [
        resource.id,
        resource.title,
        resource.type,
        resource.language,
        resource.sizeMb,
        jsonParam(resource.tags),
        resource.offlineReady,
        resource.url
      ]
    );
  }

  for (const forum of forums) {
    await query(
      `INSERT INTO forums (id, subject, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET
        subject = EXCLUDED.subject,
        description = EXCLUDED.description`,
      [forum.id, forum.subject, forum.description]
    );
  }

  for (const group of groups) {
    await query(
      `INSERT INTO study_groups (name, subject, mentor, meeting, capacity, progress, tasks, docs)
       SELECT $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb
       WHERE NOT EXISTS (
        SELECT 1 FROM study_groups WHERE name = $1 AND subject = $2
       )`,
      [
        group.name,
        group.subject,
        group.mentor,
        group.meeting,
        group.capacity,
        group.progress,
        jsonParam(group.tasks),
        jsonParam(group.docs)
      ]
    );
  }

  console.log("DRISHTI database schema and starter catalog are ready.");
}

migrate()
  .then(() => closeDatabase())
  .catch(async (error) => {
    await closeDatabase().catch(() => {});
    console.error(error.message || error);
    process.exit(1);
  });
