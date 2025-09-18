const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const { nanoid } = require("nanoid");
const mongoose = require("mongoose");
require("dotenv").config();

const Url = require("./models/Url");

const app = express();

// ---------- Configuration ----------
const PORT = process.env.PORT || 3000;
const DEFAULT_VALIDITY_MIN = 30;
const GENERATED_LENGTH = 6;
const LOG_DIR = path.join(__dirname, "logs");
const LOG_FILE = path.join(LOG_DIR, "requests.log");

// ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// ---------- Logging Middleware ----------
function loggingMiddleware(req, res, next) {
  const start = Date.now();
  const entry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl,
    headers: {
      host: req.get("host"),
      referer: req.get("referer") || null,
      "user-agent": req.get("user-agent") || null,
    },
    body: req.method === "GET" ? null : req.body || null,
    remoteAddress: req.ip || req.connection.remoteAddress || null,
  };

  res.on("finish", () => {
    entry.statusCode = res.statusCode;
    entry.latencyMs = Date.now() - start;
    try {
      fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
    } catch (err) {
      fs.appendFileSync(
        path.join(LOG_DIR, "error.log"),
        JSON.stringify({ time: new Date().toISOString(), err: String(err) }) + "\n"
      );
    }
  });

  next();
}

// ---------- Middleware ----------
app.use(bodyParser.json());
app.use(loggingMiddleware);

// ---------- Helpers ----------
function isValidUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeShortcode(s) {
  return s ? String(s).trim() : "";
}

function generateShortcode() {
  return nanoid(GENERATED_LENGTH);
}

function isShortcodeValidFormat(s) {
  return /^[A-Za-z0-9-_]{4,12}$/.test(s);
}

function getHostPrefix(req) {
  return `${req.protocol}://${req.get("host")}`;
}

function locationFromIp(ip) {
  if (!ip) return "Unknown";
  if (ip.startsWith("127.") || ip === "::1" || ip.startsWith("::ffff:127"))
    return "Localhost";
  if (ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172."))
    return "Private Network";
  return ip;
}

// ---------- API: Create Short URL ----------
app.post("/shorturls", async (req, res) => {
  try {
    const { url, validity, shortcode } = req.body || {};

    if (!url || typeof url !== "string" || !isValidUrl(url)) {
      return res.status(400).json({ error: "Invalid or missing url." });
    }

    let validityMin = DEFAULT_VALIDITY_MIN;
    if (validity !== undefined) {
      if (!Number.isInteger(validity) || validity <= 0) {
        return res.status(400).json({ error: "validity must be a positive integer." });
      }
      validityMin = validity;
    }

    let code = normalizeShortcode(shortcode);
    if (code) {
      if (!isShortcodeValidFormat(code)) {
        return res.status(400).json({ error: "Shortcode invalid format." });
      }
      const exists = await Url.findOne({ shortcode: code });
      if (exists) {
        return res.status(409).json({ error: "Shortcode already exists." });
      }
    } else {
      let attempt = 0;
      do {
        code = generateShortcode();
        attempt++;
      } while ((await Url.findOne({ shortcode: code })) && attempt < 10);
      if (await Url.findOne({ shortcode: code })) {
        return res.status(500).json({ error: "Unable to generate shortcode." });
      }
    }

    const createdAt = new Date();
    const expiryAt = new Date(createdAt.getTime() + validityMin * 60 * 1000);

    const record = await Url.create({
      originalUrl: url,
      shortcode: code,
      createdAt,
      expiryAt,
    });

    const shortLink = `${getHostPrefix(req)}/${code}`;
    return res.status(201).json({ shortLink, expiry: record.expiryAt });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ---------- API: Retrieve Stats ----------
app.get("/shorturls/:code", async (req, res) => {
  const code = normalizeShortcode(req.params.code);
  if (!code) return res.status(400).json({ error: "Shortcode required" });

  const record = await Url.findOne({ shortcode: code });
  if (!record) return res.status(404).json({ error: "Not found" });

  return res.json({
    shortcode: record.shortcode,
    originalUrl: record.originalUrl,
    createdAt: record.createdAt,
    expiryAt: record.expiryAt,
    totalClicks: record.clickCount,
    clicks: record.clicks,
  });
});

// ---------- Redirect Endpoint ----------
app.get("/:code", async (req, res) => {
  const code = normalizeShortcode(req.params.code);
  if (!code) return res.status(400).json({ error: "Shortcode required" });

  const record = await Url.findOne({ shortcode: code });
  if (!record) return res.status(404).json({ error: "Not found" });

  if (new Date(record.expiryAt).getTime() < Date.now()) {
    return res.status(410).json({ error: "Short link expired" });
  }

  const clickInfo = {
    referrer: req.get("referer") || null,
    ip: req.ip || req.connection.remoteAddress || null,
    location: locationFromIp(req.ip || req.connection.remoteAddress || ""),
  };

  record.clicks.push(clickInfo);
  record.clickCount = record.clicks.length;
  await record.save();

  res.redirect(302, record.originalUrl);
});

// ---------- Root Endpoint ----------
app.get("/", (req, res) => {
  res.send(`
    <h2>Welcome to Afford URL Shortener 🚀</h2>
    <p>Use the API endpoints to create and track short URLs:</p>
    <ul>
      <li><strong>POST /shorturls</strong> → Create a short URL</li>
      <li><strong>GET /shorturls/:code</strong> → Retrieve stats</li>
      <li><strong>GET /:code</strong> → Redirect to original URL</li>
    </ul>
  `);
});

// ---------- Fallback ----------
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// ---------- DB + Server Start ----------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    app.listen(PORT, () => {
      fs.appendFileSync(
        path.join(LOG_DIR, "server_start.log"),
        JSON.stringify({ startedAt: new Date().toISOString(), port: PORT }) + "\n"
      );
      console.log(`✅ MongoDB connected!`);
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    fs.appendFileSync(
      path.join(LOG_DIR, "error.log"),
      JSON.stringify({ time: new Date().toISOString(), err: String(err) }) + "\n"
    );
    process.exit(1);
  });
