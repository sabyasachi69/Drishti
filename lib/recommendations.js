const { asArray } = require("./db");

function normalize(value) {
  return String(value || "").toLowerCase();
}

function tokenize(value) {
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function toTime(value) {
  const time = value ? new Date(value).getTime() : Number.MAX_SAFE_INTEGER;
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function courseMatchesQuery(course, query) {
  const parts = tokenize(query);
  if (!parts.length) return true;
  const haystack = [
    course.title,
    course.provider,
    course.level,
    course.description,
    ...asArray(course.tags),
    ...asArray(course.skills),
    ...asArray(course.languages)
  ].join(" ").toLowerCase();
  return parts.every((part) => haystack.includes(part));
}

function signalMatches(learnerSignal, courseSignal) {
  if (!learnerSignal) return false;
  const courseTokens = tokenize(courseSignal);
  const learnerTokens = tokenize(learnerSignal);
  if (learnerSignal.length <= 2 || learnerTokens.length === 1) {
    return courseTokens.includes(learnerSignal);
  }
  return courseSignal.includes(learnerSignal) || learnerSignal.includes(courseSignal);
}

function scoreCourse(course, user, progressByCourse = new Map()) {
  const tags = asArray(course.tags);
  const skills = asArray(course.skills);
  const languages = asArray(course.languages);
  const goals = asArray(user.goals);
  const interests = asArray(user.interests);
  const status = progressByCourse.get(course.id)?.status || "";
  const reasons = [];

  let score = Math.round(Number(course.rating || 0) * 10);
  score += Math.min(12, Math.round(Number(course.enrollments || 0) / 250));

  const learnerSignals = [...goals, ...interests].map(normalize);
  const courseSignals = [course.title, course.level, ...tags, ...skills].map(normalize);
  for (const learnerSignal of learnerSignals) {
    if (!learnerSignal) continue;
    const matched = courseSignals.some((signal) => signalMatches(learnerSignal, signal));
    if (matched) {
      score += 16;
      reasons.push(`Matches ${learnerSignal}`);
    }
  }

  if (languages.some((language) => asArray(user.languages).includes(language))) {
    score += 14;
    reasons.push("Available in your language set");
  }

  if (user.offlineFirst && course.offlineReady) {
    score += 12;
    reasons.push("Works offline");
  }

  if (course.level === user.level || course.level === "All Levels") {
    score += 10;
    reasons.push("Right difficulty");
  }

  if (status === "saved" || status === "enrolled") {
    score += 18;
    reasons.push("Already in your learning path");
  }

  if (status === "completed") {
    score -= 1000;
  }

  const uniqueReasons = [...new Set(reasons)].slice(0, 3);
  return {
    ...course,
    score,
    fit: Math.min(99, Math.max(52, score)),
    reasons: uniqueReasons.length ? uniqueReasons : ["Good fit for your current profile"]
  };
}

function buildRecommendations({ user, courses, progress, tasks }) {
  const progressByCourse = new Map(progress.map((item) => [item.courseId, item]));
  const courseRecommendations = courses
    .map((course) => scoreCourse(course, user, progressByCourse))
    .filter((course) => course.score > -100)
    .sort((a, b) => b.score - a.score);

  const upcomingTasks = tasks
    .filter((task) => task.status !== "done")
    .sort((a, b) => toTime(a.dueAt) - toTime(b.dueAt) || Number(b.priority || 0) - Number(a.priority || 0))
    .slice(0, 8);

  const suggestedTasks = [];
  const topCourse = courseRecommendations[0];
  if (topCourse && !progressByCourse.has(topCourse.id)) {
    suggestedTasks.push({
      title: `Start ${topCourse.title}`,
      courseId: topCourse.id,
      reason: topCourse.reasons[0],
      priority: 3
    });
  }

  if (!asArray(user.goals).length) {
    suggestedTasks.push({
      title: "Add two learning goals",
      courseId: null,
      reason: "Recommendations get sharper when goals are saved",
      priority: 2
    });
  }

  const dailyPlan = [
    ...upcomingTasks.slice(0, 3).map((task, index) => ({
      type: "task",
      day: index + 1,
      title: task.title,
      detail: task.description || "Complete this saved task",
      dueAt: task.dueAt,
      action: "Finish task"
    })),
    ...courseRecommendations.slice(0, Math.max(0, 3 - Math.min(3, upcomingTasks.length))).map((course, index) => ({
      type: "course",
      day: upcomingTasks.length + index + 1,
      title: course.title,
      detail: course.description,
      courseId: course.id,
      action: "Enroll or continue"
    }))
  ].slice(0, 3);

  return {
    courseRecommendations,
    recommendations: courseRecommendations,
    upcomingTasks,
    suggestedTasks,
    dailyPlan
  };
}

module.exports = {
  buildRecommendations,
  courseMatchesQuery,
  scoreCourse
};
