const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const source = path.join(root, "DRISHTI_website.html");
const target = path.join(root, "public", "index.html");

fs.copyFileSync(source, target);
console.log("Prepared public/index.html for Vercel.");
