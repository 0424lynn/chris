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
  ts:     { type: Number, required: true }
});
const Feedback = mongoose.model('Feedback', FeedbackSchema, 'feedback');

const AnnouncementSchema = new mongoose.Schema({
  lines: { type: [String], default: [] },
  updatedAt: { type: Date, default: Date.now }
});
const Announcement = mongoose.model('Announcement', AnnouncementSchema, 'announcement');

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

// ── API: Feedback / Suggestions (MongoDB) ────────────────────────────────────
app.get('/api/feedback', async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const items = await Feedback.find().sort({ ts: -1 }).lean();
    res.json(items.map(i => ({ id: i._id, text: i.text, author: i.author, ts: i.ts })));
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

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5500;
app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
