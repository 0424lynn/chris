const express    = require('express');
const path       = require('path');
const session    = require('express-session');
const bcrypt     = require('bcryptjs');
const mongoose   = require('mongoose');
const cloudinary = require('cloudinary').v2;
const multer     = require('multer');
require('dotenv').config();

// ── Cloudinary + Multer ────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── MongoDB ────────────────────────────────────────────────────────────────────
const ModelData = mongoose.model(
  'ModelData',
  new mongoose.Schema({ _id: String, data: Object }, { strict: false }),
  'modeldata'
);

const FeedbackSchema = new mongoose.Schema({
  text:   { type: String, required: true },
  author: { type: String, required: true },
  ts:     { type: Number, required: true },
  read:   { type: Boolean, default: false }
});
const Feedback = mongoose.model('Feedback', FeedbackSchema, 'feedback');

const AnnouncementSchema = new mongoose.Schema({
  lines: { type: [String], default: [] },
  updatedAt: { type: Date, default: Date.now }
});
const Announcement = mongoose.model('Announcement', AnnouncementSchema, 'announcement');

// Ticker: stores array of announcements in a single doc
const TickerSchema = new mongoose.Schema({
  items: { type: Array, default: [] },
  updatedAt: { type: Date, default: Date.now }
}, { strict: false });
const Ticker = mongoose.model('Ticker', TickerSchema, 'ticker');

const ModelMap = mongoose.model(
  'ModelMap',
  new mongoose.Schema({ _id: String, map: Object }, { strict: false }),
  'modelmap'
);

const ModelRegistry = mongoose.model(
  'ModelRegistry',
  new mongoose.Schema({ _id: String, entries: Array }, { strict: false }),
  'modelregistry'
);

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB error:', err.message));
} else {
  console.warn('MONGODB_URI not set — modeldata API will fall back to files');
}

const app = express();
app.set('trust proxy', 1); // Render 反向代理

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,                                       // JS 无法读取 cookie
    secure: process.env.NODE_ENV === 'production',        // Railway 上强制 HTTPS
    sameSite: 'lax',
    maxAge: 3600000                                       // 1 小时
  }
}));

// ── Auth Gate ─────────────────────────────────────────────────────────────────
// 只有这几个文件不需要登录就能访问
const PUBLIC = new Set(['/', '/index.html', '/style.css', '/script.js']);

app.use((req, res, next) => {
  if (PUBLIC.has(req.path))          return next();  // 登录页相关
  if (req.path.startsWith('/api/'))  return next();  // API 路由自己处理
  if (req.session?.user)             return next();  // 已登录

  // 静态资源（视频、图片、CSS、JS 等）不需要登录即可访问
  const staticExts = /\.(mp4|webm|mov|mp3|jpg|jpeg|png|gif|svg|webp|ico|css|js|pdf|woff|woff2|ttf)$/i;
  if (staticExts.test(req.path))     return next();

  // 未登录：HTML 跳转，其他资源返回 401
  if (req.accepts('html')) return res.redirect('/');
  return res.status(401).json({ error: 'Unauthorized' });
});

// ── API: Login ────────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('Login attempt:', username);

  if (!username || !password)
    return res.status(400).json({ error: 'Missing credentials' });

  console.log('ADMIN_HASH present:', !!process.env.ADMIN_HASH);
  console.log('SUPER_ADMIN_HASH present:', !!process.env.SUPER_ADMIN_HASH);

  try {
    if (username === 'admin') {
      if (process.env.SUPER_ADMIN_HASH) {
        const isSuperAdmin = await bcrypt.compare(password, process.env.SUPER_ADMIN_HASH);
        if (isSuperAdmin) {
          req.session.user = { username, role: 'superAdmin' };
          return req.session.save(err => {
            if (err) { console.error('session save error:', err); return res.status(500).json({ error: 'session error' }); }
            console.log('Logged in as superAdmin');
            return res.json({ role: 'superAdmin' });
          });
        }
      }
      if (process.env.ADMIN_HASH) {
        const isAdmin = await bcrypt.compare(password, process.env.ADMIN_HASH);
        if (isAdmin) {
          req.session.user = { username, role: 'normalAdmin' };
          return req.session.save(err => {
            if (err) { console.error('session save error:', err); return res.status(500).json({ error: 'session error' }); }
            console.log('Logged in as normalAdmin');
            return res.json({ role: 'normalAdmin' });
          });
        }
      }
    }

    if (username === 'tech' && process.env.USER_HASH) {
      const isUser = await bcrypt.compare(password, process.env.USER_HASH);
      if (isUser) {
        req.session.user = { username, role: 'user' };
        return req.session.save(err => {
          if (err) { console.error('session save error:', err); return res.status(500).json({ error: 'session error' }); }
          console.log('Logged in as user');
          return res.json({ role: 'user' });
        });
      }
    }
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
});

// ── API: Logout ───────────────────────────────────────────────────────────────
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ── API: Current user (供前端检查登录状态) ────────────────────────────────────
app.get('/api/me', (req, res) => {
  if (req.session?.user) return res.json(req.session.user);
  res.status(401).json({ error: 'Not logged in' });
});

// ── API: Announcement (MongoDB 永久存儲) ──────────────────────────────────────
app.get('/api/announcement', async (req, res) => {
  try {
    const doc = await Announcement.findOne().sort({ updatedAt: -1 }).lean();
    res.json({ lines: doc?.lines || [] });
  } catch (e) {
    res.json({ lines: [] });
  }
});

app.post('/api/announcement', async (req, res) => {
  const role = req.session?.user?.role;
  if (role !== 'superAdmin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { lines } = req.body;
  if (!Array.isArray(lines)) return res.status(400).json({ error: 'Invalid data' });
  try {
    // 用 upsert：有就更新，沒有就新建
    await Announcement.findOneAndUpdate(
      {},
      { lines, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── API: Ticker ───────────────────────────────────────────────────────────────
// GET /api/ticker?family=MSFmodelData  → returns items matching family (or global)
app.get('/api/ticker', async (req, res) => {
  try {
    const doc = await Ticker.findOne().lean();
    const items = doc?.items || [];
    const family = req.query.family || '';
    // Filter: item.targets empty = global; otherwise must include requested family
    const filtered = items.filter(it => {
      if (!it.enabled) return false;
      if (!it.targets || it.targets.length === 0) return true;
      return family && it.targets.includes(family);
    });
    res.json({ items: filtered });
  } catch (e) {
    res.json({ items: [] });
  }
});

// GET /api/ticker/all  → returns all items (for admin)
app.get('/api/ticker/all', async (req, res) => {
  if (req.session?.user?.role !== 'superAdmin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const doc = await Ticker.findOne().lean();
    res.json({ items: doc?.items || [] });
  } catch (e) {
    res.json({ items: [] });
  }
});

// POST /api/ticker  → save all items
app.post('/api/ticker', async (req, res) => {
  if (req.session?.user?.role !== 'superAdmin') return res.status(403).json({ error: 'Forbidden' });
  const { items } = req.body;
  try {
    await Ticker.findOneAndUpdate({}, { items: items || [], updatedAt: new Date() }, { upsert: true, new: true });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── API: Feedback / Suggestions (MongoDB) ────────────────────────────────────
app.get('/api/feedback/unread-count', async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const count = await Feedback.countDocuments({ read: false });
    res.json({ count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/feedback/mark-all-read', async (req, res) => {
  const role = req.session?.user?.role;
  if (role !== 'superAdmin' && role !== 'normalAdmin')
    return res.status(403).json({ error: 'Forbidden' });
  try {
    await Feedback.updateMany({ read: false }, { read: true });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/feedback', async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const items = await Feedback.find().sort({ ts: -1 }).lean();
    res.json(items.map(i => ({ id: i._id, text: i.text, author: i.author, ts: i.ts, read: i.read })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/feedback', async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Empty text' });
  try {
    const item = await Feedback.create({
      text:   text.trim().slice(0, 1000),
      author: req.session.user.username,
      ts:     Date.now()
    });
    res.json({ id: item._id, text: item.text, author: item.author, ts: item.ts });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/feedback/:id', async (req, res) => {
  const role = req.session?.user?.role;
  if (role !== 'superAdmin' && role !== 'normalAdmin')
    return res.status(403).json({ error: 'Forbidden' });
  try {
    await Feedback.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── In-memory cache for model data ────────────────────────────────────────────
const _mdCache   = new Map(); // fileKey → { data, ts }
const _CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function cachedModelData(key) {
  const hit = _mdCache.get(key);
  if (hit && Date.now() - hit.ts < _CACHE_TTL) return hit.data;
  const doc = await ModelData.findById(key);
  if (doc) _mdCache.set(key, { data: doc.data, ts: Date.now() });
  return doc?.data || null;
}
function invalidateCache(key) { _mdCache.delete(key); }
function invalidateAllCache()  { _mdCache.clear(); }

// ── API: Admin — Content Manager ──────────────────────────────────────────────
function superAdminOnly(req, res, next) {
  if (req.session?.user?.role !== 'superAdmin')
    return res.status(403).json({ error: 'Forbidden' });
  next();
}

// ── API: Upload image to Cloudinary ──────────────────────────────────────────
app.post('/api/upload-image', superAdminOnly, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!process.env.CLOUDINARY_CLOUD_NAME)
    return res.status(500).json({ error: 'Cloudinary not configured — add CLOUDINARY_* env vars' });
  try {
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: 'atosa-products', resource_type: 'image', quality: 'auto', fetch_format: 'auto' },
        (err, r) => err ? reject(err) : resolve(r)
      ).end(req.file.buffer);
    });
    res.json({ url: result.secure_url });
  } catch (e) {
    res.status(500).json({ error: 'Upload failed: ' + e.message });
  }
});

// ── API: Model Map (model code → family key) ──────────────────────────────────
app.get('/api/modelmap', async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const doc = await ModelMap.findById('modelmap');
    res.json(doc?.map || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/modelmap', superAdminOnly, async (req, res) => {
  const { map } = req.body;
  if (!map || typeof map !== 'object') return res.status(400).json({ error: 'Invalid map' });
  try {
    await ModelMap.findByIdAndUpdate('modelmap', { map }, { upsert: true, new: true });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── API: Create new model family ──────────────────────────────────────────────
app.post('/api/admin/family', superAdminOnly, async (req, res) => {
  const { key, data } = req.body;
  if (!key || !data) return res.status(400).json({ error: 'Missing key or data' });
  try {
    const existing = await ModelData.findById(key);
    if (existing) return res.status(409).json({ error: 'Family key already exists' });
    await ModelData.create({ _id: key, data });
    invalidateAllCache();
    _titlesCacheTs = 0;
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// List all families with counts
app.get('/api/admin/families', superAdminOnly, async (req, res) => {
  try {
    const docs = await ModelData.find({}, { _id: 1, 'data.models': 1, 'data.common': 1 });
    const list = docs.map(doc => ({
      key:        doc._id,
      modelCount: Object.keys(doc.data?.models  || {}).length,
      issueCount: Object.keys(doc.data?.common?.issues || {}).length
    })).sort((a, b) => a.key.localeCompare(b.key));
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get full family data
app.get('/api/admin/family/:key', superAdminOnly, async (req, res) => {
  try {
    const doc = await ModelData.findById(req.params.key);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc.data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Save full family data
app.put('/api/admin/family/:key', superAdminOnly, async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: 'Missing data' });
    await ModelData.findByIdAndUpdate(
      req.params.key, { data }, { upsert: true, new: true }
    );
    invalidateCache(req.params.key); // flush cache so changes are live immediately
    _titlesCacheTs = 0; // also invalidate titles cache
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Delete entire family + clean up model map
app.delete('/api/admin/family/:key', superAdminOnly, async (req, res) => {
  const key = req.params.key;
  try {
    await ModelData.findByIdAndDelete(key);
    invalidateCache(key);
    _titlesCacheTs = 0;
    // Remove all model-map entries that point to this family key
    const mapDoc = await ModelMap.findById('modelmap');
    if (mapDoc?.map) {
      const newMap = Object.fromEntries(
        Object.entries(mapDoc.map).filter(([, v]) => v !== key)
      );
      await ModelMap.findByIdAndUpdate('modelmap', { map: newMap }, { upsert: true });
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── API: Model Registry ───────────────────────────────────────────────────────
// GET — returns all registered model entries
app.get('/api/admin/model-registry', superAdminOnly, async (req, res) => {
  try {
    const doc = await ModelRegistry.findById('registry');
    res.json(doc?.entries || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /seed — merges hardcoded master list into DB, skipping codes already present
app.post('/api/admin/model-registry/seed', superAdminOnly, async (req, res) => {
  try {
    const master = require('./modelRegistrySeed.json');
    const doc = await ModelRegistry.findById('registry');
    const existing = new Set((doc?.entries || []).map(e => e.code));
    const toAdd = master.filter(e => !existing.has(e.code));
    const merged = [...(doc?.entries || []), ...toAdd];
    await ModelRegistry.findByIdAndUpdate('registry', { entries: merged }, { upsert: true });
    res.json({ ok: true, added: toAdd.length, total: merged.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── API: All model codes (every key in every family's models object) ──────────
app.get('/api/all-model-codes', async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const docs = await ModelData.find({}, { 'data.models': 1 });
    const codes = new Set();
    docs.forEach(doc => {
      Object.keys(doc.data?.models || {}).forEach(code => codes.add(code));
    });
    res.json([...codes]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── API: Model Data (from MongoDB, cached) ────────────────────────────────────
app.get('/api/modeldata/:fileKey', async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const data = await cachedModelData(req.params.fileKey);
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json(data);
  } catch (e) {
    // Fallback to local file if MongoDB unavailable
    const fs = require('fs');
    try {
      const data = JSON.parse(fs.readFileSync(
        path.join(__dirname, req.params.fileKey + '.json'), 'utf8'
      ));
      res.json(data);
    } catch { res.status(500).json({ error: 'Data not available' }); }
  }
});

// ── API: Product Titles (cached via modelData cache) ─────────────────────────
let _titlesCache = null;
let _titlesCacheTs = 0;

app.get('/api/product-titles', async (req, res) => {
  // Use cached titles if fresh
  if (_titlesCache && Date.now() - _titlesCacheTs < _CACHE_TTL) {
    return res.json(_titlesCache);
  }
  const titleMap = {};
  try {
    const docs = await ModelData.find({}, { 'data.models': 1 });
    docs.forEach(doc => {
      const models = doc.data?.models || {};
      Object.entries(models).forEach(([code, info]) => {
        if (info.title && !info.title.includes('<span')) {
          titleMap[code] = info.title.trim();
        }
      });
    });
    _titlesCache   = titleMap;
    _titlesCacheTs = Date.now();
  } catch {
    // Fallback to files
    const fs = require('fs');
    try {
      const files = fs.readdirSync(__dirname).filter(f => f.endsWith('modelData.json'));
      files.forEach(file => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
          Object.entries(data.models || {}).forEach(([code, info]) => {
            if (info.title && !info.title.includes('<span')) titleMap[code] = info.title.trim();
          });
        } catch (e) {}
      });
    } catch (e) {}
  }
  res.json(titleMap);
});

// ── API: Embedded App URLs (admin only, URLs never exposed to frontend JS) ────
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'atosa_admin_2024';
const APP_REGISTRY = {
  techmap:      { label: '🚀 Tech Map',               url: process.env.APP_TECHMAP      || `https://tech-map.onrender.com/?embed=true&admin_token=${ADMIN_TOKEN}` },
  dataanalysis: { label: '📊 Data Analysis',           url: process.env.APP_DATAANALYSIS || `https://after-sales-service-report.streamlit.app/?embed=true&admin_token=${ADMIN_TOKEN}` },
  issuetracker: { label: '🧩 Product Issue Tracker',   url: process.env.APP_ISSUETRACKER || `https://product-issue-tracker.onrender.com/?tab=list&embed=true&admin_token=${ADMIN_TOKEN}` },
  techbonus:    { label: '🧰 In-House Tech Center',     url: process.env.APP_TECHBONUS    || `https://tech-bonus.onrender.com/?embed=true&admin_token=${ADMIN_TOKEN}` },
};

app.get('/api/app-url/:name', (req, res) => {
  const role = req.session?.user?.role;
  if (role !== 'superAdmin' && role !== 'normalAdmin')
    return res.status(403).json({ error: 'Forbidden' });
  const app = APP_REGISTRY[req.params.name];
  if (!app) return res.status(404).json({ error: 'Unknown app' });
  res.json({ url: app.url, label: app.label });
});

// ── Keep-alive pings (prevent Render free services from sleeping) ──────────
const PING_TARGETS = [
  process.env.APP_TECHMAP      ? process.env.APP_TECHMAP.split('?')[0]      : 'https://tech-map.onrender.com',
  process.env.APP_ISSUETRACKER ? process.env.APP_ISSUETRACKER.split('?')[0] : 'https://product-issue-tracker.onrender.com',
  process.env.APP_DATAANALYSIS ? process.env.APP_DATAANALYSIS.split('?')[0] : null,
  process.env.APP_TECHBONUS    ? process.env.APP_TECHBONUS.split('?')[0]    : 'https://tech-bonus.onrender.com',
].filter(Boolean);

setInterval(() => {
  PING_TARGETS.forEach(url => {
    const mod = url.startsWith('https') ? require('https') : require('http');
    mod.get(url, res => {
      res.resume(); // discard response body
    }).on('error', () => {}); // silently ignore errors
  });
}, 5 * 60 * 1000); // every 5 minutes
// ─────────────────────────────────────────────────────────────────────────────

// ── Static Files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname)));

// ── Gemini AI Chat ─────────────────────────────────────────────────────────────
const Groq = require('groq-sdk');
const groqClient = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

const AI_SYSTEM_PROMPT = `You are an expert HVAC and commercial refrigeration technician assistant for ATOSA equipment.
Help service technicians diagnose and repair issues with ATOSA commercial kitchen equipment including refrigerators,
freezers, prep tables, and other units. Provide clear, practical troubleshooting steps.
If asked about a specific error code or symptom, give step-by-step diagnostic procedures.
Keep answers concise and actionable. Respond in the same language the technician uses.`;

app.post('/api/ai-chat', async (req, res) => {
  if (!groqClient) return res.status(503).json({ error: 'AI not configured' });
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Invalid messages' });
  try {
    const completion = await groqClient.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        ...messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
      ],
      max_tokens: 1024
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch (e) {
    console.error('Groq error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GitHub Auto Backup ─────────────────────────────────────────────────────────
const GITHUB_TOKEN = process.env.GITHUB_BACKUP_TOKEN;
const GITHUB_REPO  = process.env.GITHUB_BACKUP_REPO || '0424lynn/atosa-backups';

async function backupToGitHub(silent = false) {
  if (!GITHUB_TOKEN) return { ok: false, error: 'GITHUB_BACKUP_TOKEN not set' };
  try {
    const docs = await ModelData.find({}).lean();
    const backup = {};
    for (const doc of docs) backup[doc._id] = doc.data;
    const json    = JSON.stringify(backup, null, 2);
    const content = Buffer.from(json).toString('base64');
    const today   = new Date().toISOString().slice(0, 10);
    const headers = {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept':        'application/vnd.github.v3+json',
      'Content-Type':  'application/json',
      'User-Agent':    'atosa-backup-bot'
    };

    // Write two files: latest.json (always overwrite) + backups/YYYY-MM-DD.json
    const files = [
      'latest.json',
      `backups/backup-${today}.json`
    ];

    for (const filepath of files) {
      const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filepath}`;
      // Get existing SHA if file exists
      let sha = null;
      const check = await fetch(apiUrl, { headers });
      if (check.ok) { const d = await check.json(); sha = d.sha; }

      const body = { message: `Auto backup ${new Date().toISOString()}`, content, ...(sha ? { sha } : {}) };
      const res  = await fetch(apiUrl, { method: 'PUT', headers, body: JSON.stringify(body) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
    }

    // Clean up backup files older than 30 days
    try {
      const listUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/backups`;
      const listRes = await fetch(listUrl, { headers });
      if (listRes.ok) {
        const files = await listRes.json();
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);
        for (const file of files) {
          // filename format: backup-YYYY-MM-DD.json
          const match = file.name.match(/backup-(\d{4}-\d{2}-\d{2})\.json/);
          if (match && new Date(match[1]) < cutoff) {
            await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/backups/${file.name}`, {
              method: 'DELETE',
              headers,
              body: JSON.stringify({ message: `Remove old backup ${file.name}`, sha: file.sha })
            });
            if (!silent) console.log(`[Backup] Deleted old backup: ${file.name}`);
          }
        }
      }
    } catch (cleanErr) {
      console.warn('[Backup] Cleanup warning:', cleanErr.message);
    }

    if (!silent) console.log(`[Backup] GitHub backup OK — ${today}`);
    return { ok: true, date: today };
  } catch (e) {
    console.error('[Backup] GitHub backup failed:', e.message);
    return { ok: false, error: e.message };
  }
}

// Manual backup endpoint
app.post('/api/admin/backup-github', superAdminOnly, async (req, res) => {
  const result = await backupToGitHub();
  res.json(result);
});

// List available backups from GitHub
app.get('/api/admin/backup-list', superAdminOnly, async (req, res) => {
  if (!GITHUB_TOKEN) return res.json({ ok: false, error: 'GITHUB_BACKUP_TOKEN not set' });
  try {
    const headers = { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'atosa-backup-bot' };
    const listRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/backups`, { headers });
    const files = listRes.ok ? await listRes.json() : [];
    const list = Array.isArray(files)
      ? files
          .filter(f => f.name.match(/backup-\d{4}-\d{2}-\d{2}\.json/))
          .map(f => ({ name: f.name, date: f.name.replace('backup-','').replace('.json',''), path: f.path }))
          .sort((a, b) => b.date.localeCompare(a.date))
      : [];
    // Always add latest.json at top
    list.unshift({ name: 'latest.json', date: 'Latest', path: 'latest.json' });
    res.json({ ok: true, list });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// Restore from a GitHub backup file
app.post('/api/admin/restore-github', superAdminOnly, async (req, res) => {
  if (!GITHUB_TOKEN) return res.json({ ok: false, error: 'GITHUB_BACKUP_TOKEN not set' });
  const { path: filePath } = req.body;
  if (!filePath) return res.json({ ok: false, error: 'No file path provided' });
  try {
    const headers = { 'Authorization': `Bearer ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'atosa-backup-bot' };
    const fileRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`, { headers });
    if (!fileRes.ok) return res.json({ ok: false, error: 'File not found' });
    const fileData = await fileRes.json();
    const json = Buffer.from(fileData.content, 'base64').toString('utf8');
    const backup = JSON.parse(json);

    // Restore all families into MongoDB
    let count = 0;
    for (const [key, data] of Object.entries(backup)) {
      await ModelData.findByIdAndUpdate(key, { _id: key, data }, { upsert: true, new: true });
      count++;
    }
    invalidateCache();
    res.json({ ok: true, restored: count, from: filePath });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// Auto backup every 24 hours
setInterval(() => backupToGitHub(true), 24 * 60 * 60 * 1000);
// Also run once on startup (after 10s delay to let DB connect)
setTimeout(() => backupToGitHub(true), 10000);

// ── Excel Import / Export ──────────────────────────────────────────────────────
const XLSX = require('xlsx');

// helper: cell style shortcuts
function hdrStyle() {
  return { font: { name: 'Arial', bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F3864' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } };
}
function reqStyle() {
  return { font: { name: 'Arial' }, fill: { fgColor: { rgb: 'FFFF00' } }, alignment: { wrapText: true, vertical: 'top' } };
}
function normStyle(shade) {
  return { font: { name: 'Arial' }, fill: { fgColor: { rgb: shade ? 'F5F5F5' : 'FFFFFF' } }, alignment: { wrapText: true, vertical: 'top' } };
}
function groupStyle() {
  return { font: { name: 'Arial', bold: true }, fill: { fgColor: { rgb: 'DAEEF3' } }, alignment: { wrapText: true, vertical: 'top' } };
}
function modelGroupStyle() {
  return { font: { name: 'Arial', bold: true }, fill: { fgColor: { rgb: 'FCE4D6' } }, alignment: { wrapText: true, vertical: 'top' } };
}

function applyStyle(ws, cellAddr, style) {
  if (!ws[cellAddr]) ws[cellAddr] = { t: 's', v: '' };
  ws[cellAddr].s = style;
}

// ── Download Template (dynamic, generated from DB) ────────────────────────────
app.get('/api/admin/download-template', superAdminOnly, async (req, res) => {
  try {
    const familyKey = req.query.family || null;
    const query = familyKey ? { _id: familyKey } : {};
    const docs = await ModelData.find(query).lean();
    if (!docs.length) return res.status(404).json({ error: 'No data found' });

    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Instructions ─────────────────────────────────────────────────
    const instrData = [
      ['ATOSA Model Data Template — 使用说明'],
      [''],
      ['【说明 / Instructions】'],
      ['本模板用于导入/导出产品数据到 ATOSA 售后系统。', 'This template is used to import/export product data into the ATOSA after-sales system.'],
      [''],
      ['【Sheet 说明】'],
      ['Sheet', '用途 / Purpose'],
      ['Models 型号列表', '填写产品系列Key和所有型号ID / Family key and all model IDs'],
      ['Issues 问题列表', '所有型号共用的问题和解决方案 / Common issues shared by all models'],
      ['型号专属问题 Model-Specific', '某个型号特有的额外内容 / Extra content for individual models only'],
      ['文档资料 Documents', '每个型号对应的PDF/规格书链接 / PDF and spec sheet links per model'],
      [''],
      ['【Section 取值说明】'],
      ['Section 值', '对应系统位置'],
      ['overview', 'Quick Guide (Overview) — 快速概览'],
      ['customer', 'Customer Guidance — 客户指引'],
      ['technician', 'Technician Analysis — 技术分析'],
      ['quick', 'Quick Guide Steps — 快速步骤'],
      ['tech', 'Technician Steps — 技术步骤'],
      ['nonW', 'Non-Warranty Steps — 非保修步骤'],
      [''],
      ['【Sub-steps 格式说明】'],
      ['空行分隔（两次回车）= 新的一条bullet', 'Blank line (double Enter) = new bullet point'],
      ['单次回车 = 同一条内换行', 'Single Enter = new line within same bullet'],
      [''],
      ['【颜色说明 / Color Guide】'],
      ['黄色底 = 必填项', 'Yellow fill = required field'],
      ['无色 = 选填项', 'No fill = optional field'],
    ];
    const wsInstr = XLSX.utils.aoa_to_sheet(instrData);
    wsInstr['!cols'] = [{ wch: 45 }, { wch: 55 }];
    XLSX.utils.book_append_sheet(wb, wsInstr, '说明 Instructions');

    // ── Sheet 2: Models ───────────────────────────────────────────────────────
    const modelsAoa = [['Family Key', 'Model ID', 'Model Title', 'Notes']];
    for (const doc of docs) {
      const fk = doc._id;
      const models = doc.data?.models || {};
      const modelIds = Object.keys(models);
      if (modelIds.length === 0) {
        modelsAoa.push([fk, '', '', '']);
      } else {
        for (const mid of modelIds) {
          modelsAoa.push([fk, mid, models[mid]?.title || mid, '']);
        }
      }
    }
    const wsModels = XLSX.utils.aoa_to_sheet(modelsAoa);
    wsModels['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 35 }, { wch: 25 }];
    wsModels['!freeze'] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, wsModels, 'Models 型号列表');

    // ── Sheet 3: Common Issues ────────────────────────────────────────────────
    const issuesHdr = ['Issue Key', 'Issue Label', 'Section', 'Item #', 'Item Text', 'Red Note / Code', 'Sub-steps', 'Video Path', 'Link Label', 'Link URL'];
    const issuesAoa = [issuesHdr];

    for (const doc of docs) {
      const issues = doc.data?.common?.issues || {};
      for (const [issueKey, issueVal] of Object.entries(issues)) {
        const label = issueVal.label || issueKey;
        const sections = [
          ['overview',    issueVal.overview   || []],
          ['customer',    issueVal.customer   || []],
          ['technician',  issueVal.technician || []],
          ['quick',       issueVal.quick?.steps   || []],
          ['tech',        issueVal.tech?.steps    || []],
          ['nonW',        issueVal.nonW?.steps    || []],
        ];
        for (const [secName, items] of sections) {
          items.forEach((item, idx) => {
            const text = typeof item === 'string' ? item : (item.text || '');
            const red  = item.red  || '';
            const steps = Array.isArray(item.steps)
              ? item.steps.map(s => typeof s === 'string' ? s : (s.text || '')).join('\n\n')
              : '';
            const video    = item.video || '';
            const linkLbl  = item.link?.label || (Array.isArray(item.links) && item.links[0]?.label) || '';
            const linkUrl  = item.link?.url   || (Array.isArray(item.links) && item.links[0]?.url)   || '';
            issuesAoa.push([issueKey, label, secName, idx + 1, text, red, steps, video, linkLbl, linkUrl]);
          });
        }
      }
    }
    const wsIssues = XLSX.utils.aoa_to_sheet(issuesAoa);
    wsIssues['!cols'] = [{ wch: 22 }, { wch: 25 }, { wch: 14 }, { wch: 7 }, { wch: 50 }, { wch: 38 }, { wch: 55 }, { wch: 25 }, { wch: 20 }, { wch: 38 }];
    wsIssues['!freeze'] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, wsIssues, 'Issues 问题列表');

    // ── Sheet 4: Model-Specific ───────────────────────────────────────────────
    const specHdr = ['Model ID', 'Issue Key', 'Section', 'Item #', 'Item Text', 'Red Note / Code', 'Sub-steps', 'Video Path', 'Link Label', 'Link URL'];
    const specAoa = [specHdr];

    for (const doc of docs) {
      const models = doc.data?.models || {};
      const commonIssueKeys = Object.keys(doc.data?.common?.issues || {});
      for (const [mid, mVal] of Object.entries(models)) {
        for (const issueKey of commonIssueKeys) {
          const extra = mVal[issueKey];
          if (!extra || typeof extra !== 'object') continue;
          const sections = [
            ['overview',   extra.overview   || []],
            ['customer',   extra.customer   || []],
            ['technician', extra.technician || []],
            ['quick',      extra.quick?.steps  || []],
            ['tech',       extra.tech?.steps   || []],
            ['nonW',       extra.nonW?.steps   || []],
          ];
          for (const [secName, items] of sections) {
            items.forEach((item, idx) => {
              const text  = typeof item === 'string' ? item : (item.text || '');
              const red   = item.red  || '';
              const steps = Array.isArray(item.steps)
                ? item.steps.map(s => typeof s === 'string' ? s : (s.text || '')).join('\n\n')
                : '';
              const video   = item.video || '';
              const linkLbl = item.link?.label || '';
              const linkUrl = item.link?.url   || '';
              specAoa.push([mid, issueKey, secName, idx + 1, text, red, steps, video, linkLbl, linkUrl]);
            });
          }
        }
      }
    }
    const wsSpec = XLSX.utils.aoa_to_sheet(specAoa);
    wsSpec['!cols'] = [{ wch: 18 }, { wch: 25 }, { wch: 14 }, { wch: 7 }, { wch: 50 }, { wch: 38 }, { wch: 55 }, { wch: 25 }, { wch: 20 }, { wch: 38 }];
    wsSpec['!freeze'] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, wsSpec, '型号专属问题 Model-Specific');

    // ── Sheet 5: Documents ────────────────────────────────────────────────────
    const docsHdr = ['Model ID', 'Document Title', 'Document URL', 'Notes'];
    const docsAoa = [docsHdr];
    for (const doc of docs) {
      const models = doc.data?.models || {};
      for (const [mid, mVal] of Object.entries(models)) {
        const documents = mVal.documents || [];
        for (const d of documents) {
          docsAoa.push([mid, d.title || '', d.url || '', '']);
        }
      }
    }
    const wsDocs = XLSX.utils.aoa_to_sheet(docsAoa);
    wsDocs['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 65 }, { wch: 25 }];
    wsDocs['!freeze'] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, wsDocs, '文档资料 Documents');

    // ── Output ────────────────────────────────────────────────────────────────
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = familyKey
      ? `ATOSA-${familyKey}-${new Date().toISOString().slice(0,10)}.xlsx`
      : `ATOSA-AllData-${new Date().toISOString().slice(0,10)}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (e) {
    console.error('Template gen error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/import-excel', superAdminOnly, upload.single('file'), async (req, res) => {
  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });

    // ── Read Models sheet ──────────────────────────────────────────────────────
    const modelsSheet = wb.Sheets['Models 型号列表'];
    if (!modelsSheet) return res.status(400).json({ error: 'Missing sheet: Models 型号列表' });
    const modelsRows = XLSX.utils.sheet_to_json(modelsSheet, { defval: '' });

    // Group model IDs by family key
    const familyModels = {}; // { familyKey: [modelId, ...] }
    for (const row of modelsRows) {
      const fk = String(row['Family Key'] || '').trim();
      const mid = String(row['Model ID'] || '').trim();
      if (!fk || !mid) continue;
      if (!familyModels[fk]) familyModels[fk] = [];
      familyModels[fk].push(mid);
    }

    // ── Read Common Issues sheet ───────────────────────────────────────────────
    const issuesSheet = wb.Sheets['Issues 问题列表'];
    if (!issuesSheet) return res.status(400).json({ error: 'Missing sheet: Issues 问题列表' });
    const issuesRows = XLSX.utils.sheet_to_json(issuesSheet, { defval: '' });

    // Build common issues: { issueKey: { label, section: [ { text, red, steps, video, link } ] } }
    const commonIssues = {};
    for (const row of issuesRows) {
      const key     = String(row['Issue Key']       || '').trim();
      const label   = String(row['Issue Label']     || '').trim();
      const section = String(row['Section']         || '').trim();
      const text    = String(row['Item Text']       || '').trim();
      const red     = String(row['Red Note / Code'] || '').trim();
      const stepsRaw= String(row['Sub-steps']       || '').trim();
      const video   = String(row['Video Path']      || '').trim();
      const linkLbl = String(row['Link Label']      || '').trim();
      const linkUrl = String(row['Link URL']        || '').trim();
      if (!key || !section || !text) continue;

      if (!commonIssues[key]) commonIssues[key] = { label: label || key };
      else if (label) commonIssues[key].label = label;

      // Build item
      const item = { text };
      if (red)   item.red = red;
      if (video) item.video = video;
      if (linkLbl && linkUrl) item.link = { label: linkLbl, url: linkUrl };
      if (stepsRaw) {
        item.steps = stepsRaw.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
      }

      // Map section name to data key
      const sectionKey = section === 'quick' ? 'quick'
                       : section === 'tech'  ? 'tech'
                       : section === 'nonW'  ? 'nonW'
                       : section; // overview / customer / technician

      if (['quick','tech','nonW'].includes(sectionKey)) {
        if (!commonIssues[key][sectionKey]) commonIssues[key][sectionKey] = { steps: [] };
        commonIssues[key][sectionKey].steps.push(item);
      } else {
        if (!commonIssues[key][sectionKey]) commonIssues[key][sectionKey] = [];
        commonIssues[key][sectionKey].push(item);
      }
    }

    // ── Read Model-Specific sheet ──────────────────────────────────────────────
    const specificSheet = wb.Sheets['型号专属问题 Model-Specific'];
    const modelExtras = {}; // { modelId: { issueKey: { section: [...] } } }
    if (specificSheet) {
      const specRows = XLSX.utils.sheet_to_json(specificSheet, { defval: '' });
      for (const row of specRows) {
        const modelId  = String(row['Model ID']         || '').trim();
        const issueKey = String(row['Issue Key']        || '').trim();
        const section  = String(row['Section']          || '').trim();
        const text     = String(row['Item Text']        || '').trim();
        const red      = String(row['Red Note / Code']  || '').trim();
        const stepsRaw = String(row['Sub-steps']        || '').trim();
        const video    = String(row['Video Path']       || '').trim();
        const linkLbl  = String(row['Link Label']       || '').trim();
        const linkUrl  = String(row['Link URL']         || '').trim();
        if (!modelId || !issueKey || !section || !text) continue;

        if (!modelExtras[modelId]) modelExtras[modelId] = {};
        if (!modelExtras[modelId][issueKey]) modelExtras[modelId][issueKey] = {};

        const item = { text };
        if (red)   item.red = red;
        if (video) item.video = video;
        if (linkLbl && linkUrl) item.link = { label: linkLbl, url: linkUrl };
        if (stepsRaw) {
          item.steps = stepsRaw.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
        }

        const sk = ['quick','tech','nonW'].includes(section) ? section : section;
        if (['quick','tech','nonW'].includes(sk)) {
          if (!modelExtras[modelId][issueKey][sk]) modelExtras[modelId][issueKey][sk] = { steps: [] };
          modelExtras[modelId][issueKey][sk].steps.push(item);
        } else {
          if (!modelExtras[modelId][issueKey][sk]) modelExtras[modelId][issueKey][sk] = [];
          modelExtras[modelId][issueKey][sk].push(item);
        }
      }
    }

    // ── Read Documents sheet ───────────────────────────────────────────────────
    const docsSheet = wb.Sheets['文档资料 Documents'];
    const modelDocs = {}; // { modelId: [ { title, url } ] }
    if (docsSheet) {
      const docRows = XLSX.utils.sheet_to_json(docsSheet, { defval: '' });
      for (const row of docRows) {
        const modelId = String(row['Model ID']        || '').trim();
        const title   = String(row['Document Title'] || '').trim();
        const url     = String(row['Document URL']   || '').trim();
        if (!modelId || !title || !url) continue;
        if (!modelDocs[modelId]) modelDocs[modelId] = [];
        modelDocs[modelId].push({ title, url });
      }
    }

    // ── Build & upsert each family ─────────────────────────────────────────────
    const results = [];
    for (const [familyKey, modelIds] of Object.entries(familyModels)) {
      // Build models object
      const models = {};
      for (const mid of modelIds) {
        models[mid] = {
          title: mid,
          issues: Object.keys(commonIssues),
          ...(modelExtras[mid] || {}),
          ...(modelDocs[mid] ? { documents: modelDocs[mid] } : {})
        };
      }

      const data = { common: { issues: commonIssues }, models };
      await ModelData.findByIdAndUpdate(familyKey, { _id: familyKey, data }, { upsert: true, new: true });
      invalidateCache(familyKey);
      results.push(familyKey);
    }

    res.json({ success: true, imported: results });
  } catch (e) {
    console.error('Import error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5500;
app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
