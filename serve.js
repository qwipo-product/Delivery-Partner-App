// Minimal static server for the replica: node serve.js [port]
const http = require("http");
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, process.argv[3] || ".");
const port = Number(process.argv[2] || process.env.PORT || 5180);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".woff2": "font/woff2", ".json": "application/json" };
http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.normalize(path.join(root, urlPath.endsWith("/") ? urlPath + "index.html" : urlPath));
  if (!file.startsWith(root)) { res.statusCode = 403; return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.statusCode = 404; return res.end("Not found"); }
    res.setHeader("Content-Type", types[path.extname(file).toLowerCase()] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    res.end(data);
  });
}).listen(port, "127.0.0.1", () => console.log(`Qwipo DP replica on http://localhost:${port}`));
