const http = require("node:http");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");

const root = __dirname;
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function loadLocalEnv() {
  try {
    const contents = require("node:fs").readFileSync(
      path.join(root, ".env"),
      "utf8",
    );
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

loadLocalEnv();

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const port = Number(process.env.PORT || 3000);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 8_192) throw new Error("Request body too large");
  }
  return JSON.parse(body);
}

function cleanField(value, limit) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function sendToTelegram(payload) {
  return new Promise((resolve, reject) => {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const config = [
      `url = ${JSON.stringify(url)}`,
      'request = "POST"',
      'header = "Content-Type: application/json"',
      `data = ${JSON.stringify(JSON.stringify(payload))}`,
      "max-time = 15",
      "",
    ].join("\n");
    const curl = spawn("curl", ["--silent", "--show-error", "--config", "-"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    curl.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
    });
    curl.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk;
    });
    curl.once("error", reject);
    curl.once("close", (code) => {
      if (code !== 0)
        return reject(new Error(stderr.trim() || "Telegram request failed."));
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error("Telegram returned an invalid response."));
      }
    });
    curl.stdin.end(config);
  });
}

async function deliverMessage(request, response) {
  if (!botToken || !chatId) {
    return sendJson(response, 503, { error: "Messaging is not configured." });
  }

  let payload;
  try {
    payload = await readJson(request);
  } catch {
    return sendJson(response, 400, { error: "Invalid message." });
  }

  const type = payload?.type;
  const name = cleanField(payload?.name, 100);
  const message = cleanField(payload?.message, 2_500);
  if (
    !name ||
    !["rsvp", "wish"].includes(type) ||
    (type === "wish" && !message)
  ) {
    return sendJson(response, 400, {
      error: "Please provide your name and message.",
    });
  }

  const text = [
    `Ism: ${name}`,
    `Xabar: ${message || "Kelishimni tasdiqlayman."}`,
  ].join("\n");

  try {
    const result = await sendToTelegram({ chat_id: chatId, text });
    if (!result.ok) {
      console.error(
        "Telegram sendMessage failed:",
        result.error_code,
        result.description,
      );
      return sendJson(response, 502, {
        error: result.description || "Telegram could not deliver the message.",
      });
    }
    return sendJson(response, 200, { ok: true });
  } catch (error) {
    console.error("Telegram request failed:", error.message);
    return sendJson(response, 502, {
      error: "Could not connect to Telegram. Please retry in a moment.",
    });
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(
    request.url,
    `http://${request.headers.host || "localhost"}`,
  );
  if (url.pathname === "/api/messages") {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      return sendJson(response, 405, { error: "Method not allowed." });
    }
    return deliverMessage(request, response);
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(
      url.pathname === "/" ? "/index.html" : url.pathname,
    );
  } catch {
    response.writeHead(400).end();
    return;
  }
  if (pathname.split("/").some((part) => part.startsWith("."))) {
    response.writeHead(404).end();
    return;
  }

  const filePath = path.resolve(root, `.${pathname}`);
  if (!filePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(404).end();
    return;
  }

  try {
    const contents = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type":
        mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : contents);
  } catch (error) {
    response.writeHead(error.code === "ENOENT" ? 404 : 500).end();
  }
});

server.listen(port, () => {
  console.log(`Invitation server is running at http://localhost:${port}`);
});
