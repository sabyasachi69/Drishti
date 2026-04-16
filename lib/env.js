const fs = require("fs");
const path = require("path");

let loaded = false;

function cleanValue(value) {
  const trimmed = String(value || "").trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadLocalEnv(root = path.resolve(__dirname, "..")) {
  if (loaded || process.env.VERCEL) return;
  loaded = true;

  for (const filename of [".env.local", ".env"]) {
    const filePath = path.join(root, filename);
    if (!fs.existsSync(filePath)) continue;

    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;

      const key = trimmed.slice(0, separator).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      if (process.env[key] !== undefined) continue;

      process.env[key] = cleanValue(trimmed.slice(separator + 1));
    }
  }
}

module.exports = {
  loadLocalEnv
};
