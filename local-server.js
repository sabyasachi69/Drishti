const http = require("http");
const fs = require("fs");
const path = require("path");
const { handleApi, sendError } = require("./lib/api");

const PORT = Number(process.env.PORT || 4323);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");

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

function serveStatic(req, res, url) {
  let filePath;
  if (url.pathname === "/" || url.pathname === "/index.html") {
    filePath = path.join(PUBLIC_DIR, "index.html");
  } else if (url.pathname === "/app" || url.pathname === "/app/") {
    filePath = path.join(PUBLIC_DIR, "app.html");
  } else {
    filePath = path.join(PUBLIC_DIR, url.pathname);
  }

  const resolved = path.resolve(filePath);
  const publicRoot = path.resolve(PUBLIC_DIR);
  if (resolved !== publicRoot && !resolved.startsWith(`${publicRoot}${path.sep}`)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
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
  handleApi
};
