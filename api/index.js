const { handleApi } = require("../lib/api");

module.exports = async function handler(req, res) {
  const host = req.headers.host || "localhost";
  const incoming = new URL(req.url || "/", `https://${host}`);
  const pathParam = incoming.searchParams.get("path") || "";
  incoming.searchParams.delete("path");

  const normalizedPath = pathParam
    ? `/api/${pathParam}`.replace(/\/+/g, "/")
    : incoming.pathname.replace(/^\/api\/index(?:\.js)?/, "/api");

  const routedUrl = new URL(normalizedPath, `https://${host}`);
  for (const [key, value] of incoming.searchParams.entries()) {
    routedUrl.searchParams.append(key, value);
  }

  await handleApi(req, res, routedUrl);
};
