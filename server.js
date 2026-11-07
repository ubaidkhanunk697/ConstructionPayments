const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 5500;
const BASE_DIR = path.resolve(__dirname);

const MIME_TYPES = {
  ".html": "text/html; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".js": "application/javascript; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf"
};

const server = http.createServer((req, res) => {
  // Normalize URL path and remove query parameters/hashes
  let reqPath = decodeURI(req.url.split("?")[0].split("#")[0]);

  // Default root to dashboard.html
  if (reqPath === "/" || reqPath === "") {
    reqPath = "/dashboard.html";
  }

  // Prevent directory traversal attacks
  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, "");
  let filePath = path.join(BASE_DIR, safePath);

  // If path is a directory, look for dashboard.html or index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    const dashboardHtml = path.join(filePath, "dashboard.html");
    const indexHtml = path.join(filePath, "index.html");
    if (fs.existsSync(dashboardHtml)) {
      filePath = dashboardHtml;
    } else if (fs.existsSync(indexHtml)) {
      filePath = indexHtml;
    }
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/html; charset=UTF-8" });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>404 Not Found</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h2>404 - File Not Found</h2>
          <p>The requested URL <code>${reqPath}</code> was not found.</p>
          <a href="/dashboard.html" style="color: #2563EB;">Go to Dashboard</a>
        </body>
        </html>
      `);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache"
    });

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`====================================================`);
  console.log(`Local Development Server running successfully!`);
  console.log(`URL (Loopback IP):  http://127.0.0.1:${PORT}/`);
  console.log(`URL (Localhost):    http://localhost:${PORT}/`);
  console.log(`Dashboard:          http://127.0.0.1:${PORT}/dashboard.html`);
  console.log(`Login:              http://127.0.0.1:${PORT}/login.html`);
  console.log(`====================================================`);
});

// Also bind port 3000 fallback to prevent ERR_CONNECTION_REFUSED if Supabase redirects to default localhost:3000
if (PORT !== 3000) {
  const fallbackServer = http.createServer((req, res) => {
    server.emit("request", req, res);
  });
  fallbackServer.on("error", () => {
    // Port 3000 occupied or unavailable, ignore
  });
  fallbackServer.listen(3000, "0.0.0.0", () => {
    console.log(`OAuth fallback listener active on http://localhost:3000/`);
  });
}
