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

  // If file doesn't exist, check for matching .html file (e.g. /login -> /login.html)
  if (!fs.existsSync(filePath) && fs.existsSync(filePath + ".html")) {
    filePath = filePath + ".html";
  }

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

// Fallback listener on port 3000: If Supabase redirects to localhost:3000 default Site URL,
// instantly bounce the browser and OAuth access token to the live Vercel production server!
if (PORT !== 3000) {
  const fallbackServer = http.createServer((req, res) => {
    const bounceHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Redirecting to Live Server...</title>
</head>
<body style="font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0F172A; color: #F8FAFC;">
  <div style="text-align: center; padding: 2.5rem; background: #1E293B; border-radius: 14px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-width: 480px; border: 1px solid #334155;">
    <h3 style="margin-top: 0; color: #38BDF8; font-size: 1.25rem;">Connecting to Live Production Server...</h3>
    <p style="color: #94A3B8; font-size: 0.95rem; line-height: 1.5;">Forwarding your verified Google authentication session to <br><strong style="color: #F8FAFC;">https://nawazconstructions.vercel.app</strong></p>
    <div style="margin-top: 1.5rem;">
      <a id="prod-link" href="https://nawazconstructions.vercel.app/dashboard.html" style="color: #38BDF8; text-decoration: underline; font-size: 0.9rem;">Click here if not redirected automatically</a>
    </div>
  </div>
  <script>
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const targetUrl = 'https://nawazconstructions.vercel.app/dashboard.html' + search + hash;
    const link = document.getElementById('prod-link');
    if (link) link.href = targetUrl;
    window.location.replace(targetUrl);
  </script>
</body>
</html>`;
    res.writeHead(200, { "Content-Type": "text/html; charset=UTF-8" });
    res.end(bounceHtml);
  });
  fallbackServer.on("error", () => {
    // Port 3000 occupied or unavailable, ignore
  });
  fallbackServer.listen(3000, "0.0.0.0", () => {
    console.log(`OAuth fallback auto-bounce to Vercel active on http://localhost:3000/`);
  });
}
