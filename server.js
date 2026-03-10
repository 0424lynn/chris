const express  = require('express');
const path     = require('path');
const session  = require('express-session');
const bcrypt   = require('bcrypt');
require('dotenv').config();

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

    if (username === 'user' && process.env.USER_HASH) {
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

// ── Static Files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname)));

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5500;
app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
