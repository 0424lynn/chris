/* === 左侧问题大类高亮 · 行内样式版（仅追加，不修改现有代码） === */
(function () {
  const SEL = '.problem-box ul li a';                 // 左栏问题大类链接
  // Use model param so each product keeps its own highlight memory
  const _m  = new URLSearchParams(location.search).get('model') || location.pathname;
  const KEY = 'issueHL_' + _m;

  // 清除所有高亮
  function clearAll(links) {
    links.forEach(x => {
      x.style.background = '';
      x.style.color = '';
      x.style.fontWeight = '';
      x.style.boxShadow = '';
      x.style.borderRadius = '';
    });
  }

  // 给某个项染色并记忆
  function highlight(a) {
    const links = document.querySelectorAll(SEL);
    if (!links.length || !a) return;
    clearAll(links);
    a.style.background = '#e0e0e0';
    a.style.color = '#000';
    a.style.fontWeight = '600';
    a.style.boxShadow = 'inset 3px 0 0 #0ea5e9'; // 左侧色条（可删）
    a.style.borderRadius = '8px';
    try { localStorage.setItem(KEY, (a.textContent || '').trim().toLowerCase()); } catch {}
  }

  // 进入页面时恢复：先找本地记忆，其次找 hash 对应，其次第一个
  function restore() {
    const links = document.querySelectorAll(SEL);
    if (!links.length) return;
    const saved = (localStorage.getItem(KEY) || '').toLowerCase();
    let target = [...links].find(a => (a.textContent || '').trim().toLowerCase() === saved);

    if (!target && location.hash) {
      target = [...links].find(a => a.getAttribute('href') === location.hash);
    }
    if (!target) target = links[0];
    highlight(target);
  }

  // 用事件委托捕获点击（点到整行也能命中）
  document.addEventListener('click', function (e) {
    const a = e.target && e.target.closest && e.target.closest(SEL);
    if (!a) return;
    highlight(a);
  }, true);

  // DOM 就绪恢复一次
  document.addEventListener('DOMContentLoaded', restore);

  // 如果左侧菜单会被重绘，观察到变化后再恢复一次
  const mo = new MutationObserver(() => restore());
  try { mo.observe(document.querySelector('.problem-box') || document.body, { childList: true, subtree: true }); } catch {}
})();

/* === Admin 专用侧栏（仅 admin/4321 可见；仅 dashboard.html 生效） === */
(function () {
  const DASH_MATCH = /\/dashboard\.html\b/i;
  // ——— App viewer URLs (actual URLs stored server-side only) ———
  const V = name => `/viewer.html?app=${name}`;

  if (!DASH_MATCH.test(location.pathname)) return;
  const userRole = (localStorage.getItem("userRole") || "").trim();
  if (userRole !== "superAdmin") return;

  if (document.getElementById("adminSidebar")) return;

  const css = `
  #adminSidebar {
    position: fixed; left: 0; top: 0; bottom: 0; width: 260px;
    background: #0f172a; color: #e5e7eb; box-shadow: 2px 0 12px rgba(0,0,0,.2);
    z-index: 9999; transform: translateX(-270px); transition: transform .25s ease;
    display: flex; flex-direction: column; padding: 16px 14px;
  }
  #adminSidebar.open { transform: translateX(0); }
  #adminSidebar h3 { margin: 0 0 12px 0; font-size: 18px; font-weight: 700; letter-spacing:.5px; }
  #adminSidebar p.hint { margin: 0 0 12px 0; font-size: 12px; color:#9ca3af; }
  #adminSidebar .btn {
    display:block; width:100%; margin:8px 0; padding:12px 14px; border-radius:10px;
    border:1px solid rgba(255,255,255,.12); background:#111827; color:#e5e7eb;
    text-decoration:none; font-weight:600; text-align:center;
    transition: transform .05s ease, background .2s ease, border-color .2s ease;
  }
  #adminSidebar .btn:hover { background:#0b1220; border-color: rgba(255,255,255,.24); }
  #adminSidebar .btn:active { transform: translateY(1px); }
  #adminSidebar .spacer { flex: 1; }
  #adminSidebar .foot { font-size:11px; color:#9ca3af; opacity:.9; padding-top:8px; border-top:1px solid rgba(255,255,255,.08); }
  #adminSidebarToggle {
    position: fixed; left:12px; top:12px; z-index:10000; background:#0f172a; color:#e5e7eb;
    border:1px solid rgba(255,255,255,.12); padding:8px 12px; border-radius:10px; cursor:pointer;
    font-weight:700; letter-spacing:.3px; box-shadow:0 2px 12px rgba(0,0,0,.15);
  }
  #adminSidebarToggle:hover { background:#0b1220; }
  @media (max-width: 640px){ #adminSidebar { width:86vw; transform: translateX(-90vw); } }
  `;
  const style = document.createElement("style");
  style.id = "adminSidebarStyle";
  style.textContent = css;
  document.head.appendChild(style);

  const side = document.createElement("aside");
  side.id = "adminSidebar";
  side.innerHTML = `
    <h3>ADMIN PANEL</h3>
    <p class="hint">仅 admin/4321 可见</p>
    <a class="btn" href="${V('techmap')}">🚀 TECH MAP</a>
    <a class="btn" href="${V('dataanalysis')}">📊 Data Analysis</a>
    <a class="btn" href="${V('issuetracker')}">🧩 Product Issue Tracker</a>
    <a class="btn" href="${V('techbonus')}">🧰 In-House Tech Center</a>
    <div class="spacer"></div>
    <div class="foot">Secure · SuperAdmin</div>
  `;
  document.body.appendChild(side);

  const toggle = document.createElement("button");
  toggle.id = "adminSidebarToggle";
  toggle.type = "button";
  toggle.textContent = "☰ Admin";
  toggle.title = "Open Admin Sidebar";
  document.body.appendChild(toggle);

  const open = () => side.classList.add("open");
  const close = () => side.classList.remove("open");
  const toggleOpen = () => side.classList.toggle("open");
  toggle.addEventListener("click", (e) => { e.preventDefault(); toggleOpen(); });
  document.addEventListener("click", (e) => {
    if (!side.classList.contains("open")) return;
    const withinSide = e.target.closest && e.target.closest("#adminSidebar");
    const withinBtn  = e.target.closest && e.target.closest("#adminSidebarToggle");
    if (!withinSide && !withinBtn) close();
  });
  setTimeout(open, 150);
})();


// ── 登录 / 登出（服务器端 session 验证）────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function () {

  // 登录按钮
  const loginBtn = document.getElementById("loginBtn");
  if (loginBtn) {
    // 支持 Enter 键登录
    document.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !loginBtn.disabled) loginBtn.click();
    });

    loginBtn.addEventListener("click", async function () {
      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value;
      const btn = loginBtn;

      // 显示加载状态
      btn.disabled = true;
      btn.textContent = "Logging in...";

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000); // 15秒超时

        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
          signal: controller.signal
        });
        clearTimeout(timer);

        if (res.ok) {
          const { role } = await res.json();
          localStorage.setItem("userRole", role);
          window.location.href = "dashboard.html";
        } else {
          const data = await res.json().catch(() => ({}));
          alert("Username or password is incorrect. Please try again!\n" + (data.error || ""));
          btn.disabled = false;
          btn.textContent = "Login";
        }
      } catch (err) {
        alert("Network error — server may be waking up, please try again in 30 seconds.");
        btn.disabled = false;
        btn.textContent = "Login";
      }
    });
  }

  // 退出登录
  const logoutButton = document.getElementById("logout");
  if (logoutButton) {
    logoutButton.addEventListener("click", async function () {
      await fetch("/api/logout", { method: "POST" });
      localStorage.removeItem("userRole");
      window.location.href = "index.html";
    });
  }
});

 // 产品列表（fallback — overwritten at runtime by /api/modelmap）
    let products = [
    "MSF8302GR", "MSF8308GR", "MSF17GR-NTCV", "MSF3610GR", "MSF3615GR",
      "MSF8301GR",  
      "MSF8303GR", "MSF8304GR", 
      "MSF8305GR",  "MSF8306GR", 
      "MSF8307GR", 
      "MBF15FSGR",
"MBF15RSGR",
"MBF8001GR",
"MBF8002GR",
"MBF8003GR",
"MBF8004GR",
"MBF8005GR",
"MBF8006GR",
"MBF8007GR",
"MBF8008GR",
"MBF8010GR",
"MBF8011GR",
"MBF8129GR",
"MBF8501GR",
"MBF8502GR",
"MBF8503GR",
"MBF8504GR",
"MBF8505GR",
"MBF8506GR",
"MBF8507GR",
"MBF8508GR",
"MBF8519GR",
"MBF8520GR",
"MBF8531GR",
"MBF8532GR",
"MCF8701GR",
"MCF8703ES",
"MCF8703GR",
"MCF8704GR",
"MCF8705GR",
"MCF8707GR",
"MCF8708GR",
"MCF8709GR",
"MCF8720GR",
"MCF8721ES",
"MCF8721GR",
"MCF8722GR",
"MCF8723GR",
"MCF8724GR",
"MCF8725GR",
"MCF8726GR",
"MCF8727GR",
"MCF8728GR",
"MCF8729GR",
"MCF8732GR",
"MCF8733GR",
"MGF24FGR",
"MGF24RGR",
"MGF36FGR",
"MGF36RGR",
"MGF44GR",
"MGF67GR",
"MGF8401GR",
"MGF8402GR",
"MGF8403GR",
"MGF8404GR",
"MGF8405GR",
"MGF8406GR",
"MGF8407GR",
"MGF8408GR",
"MGF8409GR",
"MGF8410GR",
"MGF8412GR",
"MGF8413GR",
"MGF8414GR",
"MGF8415GR",
"MGF8420GR",
"MGF8423GR",
"MGF8428GR",
"MGF8448GR",
"MGF8450GR",
"MGF8451GR",
"MGF8452GR",
"MGF8453GR",
"MGF8454GR",
"MPF8201GR",
"MPF8202GR",
"MPF8203GR",
"RDCS-60",
"RDCS-48",
"RDCS-35",
"YR140-AP-161",
"YR280-AP-161",
"HD350-AP-161",
"YR450-AP-161",
"YR450S-AP-161",
"YR800-AP-261",
"ATFS-40",
"ATFS-50",
"ATFS-35ES",
"ATFS-75",
"ATRC-24",
"ATRC-36",
"ATRC-48",
"ATCB-24",
"ATCB-36",
"ATCB-48",
"ATHC-9ES",
"ATHC-18ES",
"ACHP-2",
"ACHP-4",
"ACHP-6",
"ATTG-24",
"ATTG-36",
"ATTG-48",
"ATCM-36",
"ATSB-36",
"ATMG-24",
"ATMG-36",
"ATMG-48",
"ATSP-18-1",
"ATSP-18-2",
"AGR-10B",
"AGR-24G",
"AGR-2B24GL",
"AGR-2B24GR",
"AGR-36G",
"AGR-4B",
"AGR-4B12GL",
"AGR-4B12GR",
"AGR-4B36GR",
"AGR-6B",
"AGR-6B24GR",
"AGR-8B",
"AWC1012",
"AWC1010",
"AWC0810",
"AWC0808",
"AWC0608",
"AWC0606",

    ];
// **📌 产品名称映射（从 API 载入）**
let productTitleMap = {};

// **📌 渲染产品列表**
function renderProductList() {
  const productList = document.getElementById("productList");

  if (!productList) {
    console.error("❌ `productList` 未找到，检查 HTML 里是否有 `<ul id='productList'></ul>`");
    return;
  }

  productList.innerHTML = "";

  products.forEach((product) => {
    const li = document.createElement("li");
    const a = document.createElement("a");

    a.href = `product.html?model=${product}`;
    a.target = "_blank";

    const title = productTitleMap[product];
    if (title) {
      // 顯示：型號 + 產品全名（型號加粗，名稱用小字灰色）
      a.innerHTML = `<strong>${product}</strong><br><span style="font-size:12px;color:#666;">${title.replace(/^[^—–-]*[—–-]\s*/, '')}</span>`;
      li.style.width = "220px";
    } else {
      a.textContent = product;
    }

    li.appendChild(a);
    li.style.display = "none";
    li.dataset.model = product.toUpperCase();
    li.dataset.title = (title || "").toUpperCase();
    productList.appendChild(li);
  });

  console.log("✅ `renderProductList()` 执行成功，产品数量:", products.length);
}

// **📌 搜索功能**
function searchProduct() {
  const input = document.getElementById("searchInput");

  if (!input) {
    console.error("❌ `searchInput` 未找到，检查 HTML 里是否有 `<input id='searchInput'>`");
    return;
  }

  const filter = input.value.toUpperCase();
  const listItems = document.querySelectorAll("#productList li");

  let matchFound = false;
  listItems.forEach((item) => {
    const text = item.textContent || item.innerText;
    if (text.toUpperCase().includes(filter) && filter.length > 0) {
      item.style.display = "list-item";
      matchFound = true;
    } else {
      item.style.display = "none"; // **输入为空时隐藏**
    }
  });

  if (!matchFound && filter.length > 0) {
    console.warn(`⚠️ 没有找到匹配的产品型号: "${filter}"`);
  }
}

// **📌 序列號生産日期解碼**
const _YEAR_SEQ = "ABCDEFGHIJKLMNPQRSTUVWXYZ"; // 跳過 O
const _YEAR_MAP = {};
(function() {
  let idx = 0;
  for (const ch of _YEAR_SEQ) {
    if (ch !== 'O') _YEAR_MAP[ch] = 2011 + idx++;
  }
})();
const _MONTH_MAP = { '1':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'A':10,'B':11,'C':12 };
const _DAY_SEQ = "ABCDEFGHJKMNPQRSTUVWXYZ"; // 跳過 I、L、O
const _DAY_MAP = { '1':1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9 };
(function() {
  let idx = 0;
  for (const ch of _DAY_SEQ) _DAY_MAP[ch] = 10 + idx++;
})();

function decodeProductionDate(code3) {
  if (!code3 || code3.length < 3) return null;
  const y = _YEAR_MAP[code3[0].toUpperCase()];
  const m = _MONTH_MAP[code3[1].toUpperCase()];
  const d = _DAY_MAP[code3[2].toUpperCase()];
  if (!y || !m || !d) return null;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[m-1]} ${d}, ${y}`;
}

// **📌 序列號 — 段落表格行**
function _serialRow(label, value, ok, hint) {
  const color = ok ? '#4ade80' : '#f87171';
  const bg    = ok ? 'rgba(6,78,59,0.35)' : 'rgba(127,29,29,0.35)';
  return `<tr style="background:${bg};">
    <td style="padding:5px 10px 5px 6px;color:#94a3b8;white-space:nowrap;font-size:12px;width:140px;">${label}</td>
    <td style="padding:5px 8px;font-weight:700;font-family:monospace;font-size:14px;color:${color};">${value || '—'}</td>
    <td style="padding:5px 6px;font-size:12px;color:${color};">${hint}</td>
  </tr>`;
}

// **📌 序列號驗證（固定位置拆分）**
function checkSerialNumber() {
  const raw = (document.getElementById('serialInput').value || '').trim().replace(/\s+/g, '').toUpperCase();
  const feedback = document.getElementById('serialFeedback');
  feedback.innerHTML = '';

  if (!raw) {
    feedback.innerHTML = `<span style='color:#f87171'>❌ Please enter a serial number.</span>`;
    return;
  }

  // 固定段落定義：型號(7) + 客戶碼(3) + 配置(1) + 產地(1) + 日期(3) + 批次(3) = 18
  const SEGS = [
    { key: 'model',    label: 'Product Model',      len: 7 },
    { key: 'customer', label: 'Customer Code',       len: 3 },
    { key: 'config',   label: 'Configuration',       len: 1 },
    { key: 'location', label: 'Production Location', len: 1 },
    { key: 'date',     label: 'Production Date',     len: 3 },
    { key: 'count',    label: 'Daily Batch',         len: 3 },
  ];
  const TOTAL = 18;
  const KNOWN_CUSTOMERS = ['AUS', 'CAJ'];
  const VALID_LOCATIONS  = ['C', 'T'];

  // 按長度陣列拆分字串
  function splitAt(s, lens) {
    const out = {}; let pos = 0;
    SEGS.forEach((seg, i) => { out[seg.key] = s.substring(pos, pos + lens[i]); pos += lens[i]; });
    return out;
  }

  // 打分：越高 = 越合法
  function scoreP(p) {
    let s = 0;
    if (KNOWN_CUSTOMERS.includes(p.customer)) s += 10;
    else if (p.customer.length >= 2 && KNOWN_CUSTOMERS.some(c => c.startsWith(p.customer.slice(0,2)))) s += 3;
    if (VALID_LOCATIONS.includes(p.location)) s += 10;
    if (/^\d$/.test(p.config))  s += 5;
    if (/^\d{3}$/.test(p.count)) s += 5;
    if (p.date.length === 3) {
      if (_YEAR_MAP[p.date[0]])  s += 3;
      if (_MONTH_MAP[p.date[1]]) s += 3;
      if (_DAY_MAP[p.date[2]])   s += 3;
    }
    return s;
  }

  const MODEL_SUFFIXES = ['GR', 'ES']; // 產品列表尾綴，不屬於序列號

  // 如果長度超出，嘗試去除型號尾綴
  let strippedSuffix = '';
  let rawClean = raw;
  if (raw.length > TOTAL) {
    for (const sfx of MODEL_SUFFIXES) {
      if (raw.length === TOTAL + sfx.length && raw.substring(7, 7 + sfx.length) === sfx) {
        rawClean = raw.slice(0, 7) + raw.slice(7 + sfx.length);
        strippedSuffix = sfx;
        break;
      }
    }
  }

  const normalLens = SEGS.map(s => s.len);
  let parsed, missingSegIdx = -1;

  if (rawClean.length === TOTAL) {
    parsed = splitAt(rawClean, normalLens);
  } else if (rawClean.length === TOTAL - 1) {
    // 嘗試每個段少一個字符，取最高分
    let best = -1;
    SEGS.forEach((seg, i) => {
      if (normalLens[i] === 0) return;
      const lens = [...normalLens]; lens[i] -= 1;
      const p = splitAt(rawClean, lens);
      const sc = scoreP(p);
      if (sc > best) { best = sc; parsed = p; missingSegIdx = i; }
    });
  } else {
    parsed = splitAt(rawClean, normalLens);
  }

  const lenOk = rawClean.length === TOTAL;
  let html = '';

  // 尾綴提示 + 一鍵修復
  if (strippedSuffix) {
    html += `<div style="margin-bottom:10px;padding:8px 12px;background:rgba(120,53,15,0.40);border:1px solid rgba(245,158,11,0.50);border-radius:8px;font-size:13px;color:#fcd34d;">
      ⚠️ Model suffix "<strong>${strippedSuffix}</strong>" is not part of the serial number (product code only).
      <button onclick="document.getElementById('serialInput').value='${rawClean}';checkSerialNumber();"
        style="margin-left:8px;padding:3px 10px;border:1px solid rgba(245,158,11,0.60);border-radius:6px;background:rgba(120,53,15,0.50);color:#fcd34d;cursor:pointer;font-size:12px;font-weight:600;">
        Remove "${strippedSuffix}" and re-check</button>
    </div>`;
  }

  html += `<div style="margin-bottom:8px;font-size:13px;color:#cbd5e1;">
    Length: <strong style="color:${lenOk ? '#4ade80' : '#f87171'}">${rawClean.length} / ${TOTAL}</strong>
    ${rawClean.length < TOTAL ? `<span style="color:#f87171"> — ${TOTAL - rawClean.length} char(s) missing</span>` : ''}
    ${rawClean.length > TOTAL ? `<span style="color:#f87171"> — ${rawClean.length - TOTAL} extra char(s)</span>` : ''}
  </div>`;

  // 缺字提示（17位時）
  if (missingSegIdx >= 0) {
    const s = SEGS[missingSegIdx];
    const posStart = normalLens.slice(0, missingSegIdx).reduce((a,v) => a+v, 0) + 1;
    const posEnd   = posStart + s.len - 1;
    html += `<div style="margin-bottom:10px;padding:8px 12px;background:rgba(120,53,15,0.40);border:1px solid rgba(245,158,11,0.50);border-radius:8px;font-size:13px;color:#fcd34d;">
      ⚠️ Likely missing 1 character in <strong>${s.label}</strong> (position ${posStart}${posEnd > posStart ? '–'+posEnd : ''})
    </div>`;
  }

  html += `<table style="border-collapse:collapse;width:100%;margin-bottom:10px;">`;

  let allOk = lenOk;

  // ── Product Model ──
  const model = parsed.model || '';
  const modelOk = model.length === 7;
  html += _serialRow('Product Model', model, modelOk, modelOk ? '✅' : `❌ Need 7 chars, got ${model.length}`);
  if (!modelOk) allOk = false;

  // ── Customer Code ──
  const cust = parsed.customer || '';
  const custOk = KNOWN_CUSTOMERS.includes(cust);
  let custHint = '✅';
  if (!custOk) {
    allOk = false;
    if (cust.length < 3) {
      const guess = KNOWN_CUSTOMERS.find(c => c.startsWith(cust));
      custHint = guess
        ? `❌ Incomplete — try adding "<strong>${guess.slice(cust.length)}</strong>" → <strong>${guess}</strong>`
        : `❌ Incomplete (${cust.length}/3) — known codes: AUS, CAJ`;
    } else {
      const guess = KNOWN_CUSTOMERS.find(c => c.slice(0,2) === cust.slice(0,2));
      custHint = guess
        ? `❌ Did you mean <strong>${guess}</strong>?`
        : `❌ Unknown "${cust}" — known: AUS, CAJ`;
    }
  }
  html += _serialRow('Customer Code', cust || '—', custOk, custHint);

  // ── Configuration ──
  const cfg = parsed.config || '';
  const cfgOk = cfg === '1';
  let cfgHint = '✅';
  if (!cfgOk) {
    allOk = false;
    cfgHint = `❌ Should be <strong>1</strong> — try replacing "${cfg || '—'}" with 1`;
  }
  html += _serialRow('Configuration', cfg || '—', cfgOk, cfgHint);

  // ── Production Location ──
  const loc = parsed.location || '';
  const locOk = VALID_LOCATIONS.includes(loc);
  let locHint = loc === 'C' ? '✅ China' : loc === 'T' ? '✅ Taiwan' : '';
  if (!locOk) {
    allOk = false;
    locHint = loc ? `❌ "${loc}" invalid — only C (China) or T (Taiwan)` : `❌ Missing — should be C or T`;
  }
  html += _serialRow('Production Location', loc || '—', locOk, locHint);

  // ── Production Date ──
  const dateStr  = parsed.date || '';
  const prodDate = decodeProductionDate(dateStr);
  const dateOk   = !!prodDate;
  let dateHint   = dateOk ? `✅ ${prodDate}` : '';
  if (!dateOk) {
    allOk = false;
    if (dateStr.length === 3) {
      const yErr = _YEAR_MAP[dateStr[0]]  ? '' : `year letter "${dateStr[0]}" invalid; `;
      const mErr = _MONTH_MAP[dateStr[1]] ? '' : `month "${dateStr[1]}" invalid; `;
      const dErr = _DAY_MAP[dateStr[2]]   ? '' : `day "${dateStr[2]}" invalid`;
      dateHint = `❌ ${(yErr + mErr + dErr).replace(/;\s*$/, '')}`;
    } else {
      dateHint = `❌ Expected 3 chars, got ${dateStr.length}`;
    }
  }
  html += _serialRow('Production Date', dateStr || '—', dateOk, dateHint);

  // ── Daily Batch ──
  const cnt   = parsed.count || '';
  const cntOk = /^\d{3}$/.test(cnt);
  html += _serialRow('Daily Batch', cnt || '—', cntOk, cntOk ? '✅' : `❌ Expected 3 digits, got "${cnt}"`);
  if (!cntOk) allOk = false;

  html += `</table>`;

  // ── 一鍵修復按鈕 ──
  if (!locOk && loc && raw.length === TOTAL) {
    const tryC = raw.slice(0,11) + 'C' + raw.slice(12);
    const tryT = raw.slice(0,11) + 'T' + raw.slice(12);
    html += `<div style="margin:6px 0;font-size:13px;color:#94a3b8;">Location fix:
      <button onclick="document.getElementById('serialInput').value='${tryC}';checkSerialNumber();"
        style="margin:2px 4px;padding:3px 10px;border:1px solid rgba(59,130,246,0.50);border-radius:6px;background:rgba(37,99,235,0.20);color:#60a5fa;cursor:pointer;font-size:12px;font-weight:600;">Try C (China)</button>
      <button onclick="document.getElementById('serialInput').value='${tryT}';checkSerialNumber();"
        style="margin:2px 4px;padding:3px 10px;border:1px solid rgba(74,222,128,0.40);border-radius:6px;background:rgba(6,78,59,0.30);color:#4ade80;cursor:pointer;font-size:12px;font-weight:600;">Try T (Taiwan)</button>
    </div>`;
  }
  if (!custOk && raw.length === TOTAL) {
    const btns = KNOWN_CUSTOMERS.map(c => {
      const fixed = raw.slice(0,7) + c + raw.slice(10);
      return `<button onclick="document.getElementById('serialInput').value='${fixed}';checkSerialNumber();"
        style="margin:2px 4px;padding:3px 10px;border:1px solid rgba(148,163,184,0.30);border-radius:6px;background:rgba(30,41,59,0.60);color:#cbd5e1;cursor:pointer;font-size:12px;font-weight:600;">Try ${c}</button>`;
    }).join('');
    html += `<div style="margin:6px 0;font-size:13px;color:#94a3b8;">Try customer code: ${btns}</div>`;
  }

  if (allOk) {
    html += `<div style="margin-top:8px;font-size:15px;color:#4ade80;font-weight:700;">✅ Serial number is valid.</div>`;
    const matchedProduct = products.find(p => p.toUpperCase().startsWith(model));
    if (matchedProduct) {
      const titleShort = (productTitleMap[matchedProduct] || '').replace(/^[^—–-]*[—–-]\s*/, '');
      html += `<a href="product.html?model=${matchedProduct}" target="_blank"
        style="display:inline-block;margin-top:8px;padding:7px 16px;background:linear-gradient(135deg,#2563eb,#7c3aed);color:white;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;box-shadow:0 2px 10px rgba(37,99,235,0.35);">
        🔗 View ${matchedProduct}${titleShort ? ' — ' + titleShort : ''}</a>`;
      addToRecentHistory(matchedProduct);
    }
  } else {
    html += `<div style="margin-top:8px;font-size:15px;color:#f87171;font-weight:700;">❌ Serial number has errors — see details above.</div>`;
  }

  feedback.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", function () {
  console.log("✅ script.js loaded and waiting for button click...");
  
  // 初始化产品列表
  renderProductList();
  
  // 添加序列号检查按钮事件监听
  const checkSerialBtn = document.getElementById("checkSerialBtn");
  if (checkSerialBtn) {
    checkSerialBtn.addEventListener("click", checkSerialNumber);
  }
  
  // (logout 处理已移至上方 DOMContentLoaded 块)
});
// === 只保留侧栏 TECH MAP：把页面主体里的 Tech Map 入口隐藏，但不动 #adminSidebar 里的 ===
(function () {
  const kill = (el) => { try { el.remove(); } catch { if (el) el.style.display = "none"; } };

  function hideAll() {
    // 只在页面主体里处理，避免影响 Admin 侧栏
    const area = document.querySelector('.container') || document.body;

    // 先按选择器清理（限定在 area 内）
    ['#mapButton', '#techMapLink', '#mapSection', '.tech-map', '.btn-techmap', '.map-btn'].forEach(sel => {
      area.querySelectorAll(sel).forEach(kill);
    });

    // 兜底：把纯文本为“Tech Map/TECH MAP”的按钮/链接也干掉，但跳过侧栏
    area.querySelectorAll('a,button').forEach(el => {
      if (el.closest('#adminSidebar')) return; // ← 关键：跳过侧栏
      const t = (el.textContent || '').trim().toLowerCase();
      if (t === 'tech map' || t === 'techmap') kill(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideAll);
  } else {
    hideAll();
  }
})();


// **📌 分類 Tab 前缀映射**
const categoryPrefixes = {
  all: [],
  refrigeration: ["MSF", "MPF", "MBF", "MCF", "MGF", "MMF"],
  cooking: ["AGR", "ATTG", "ATMG", "ATFS", "ATCB", "ATRC", "ATCM", "ACHP", "ATSP", "ATHC", "ATSB"],
  ice: ["YR", "HD350"],
  walkin: ["AWC"],
  display: ["RDCS"],
};

let activeCategory = "all";

function filterByCategory(cat, btn) {
  activeCategory = cat;
  // 更新 tab 樣式
  document.querySelectorAll(".cat-tab").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
  // 清空搜索框，重新應用篩選
  const input = document.getElementById("searchInput");
  if (input) input.value = "";
  applyFilters("");
}

function applyFilters(filterUpper) {
  const prefixes = categoryPrefixes[activeCategory] || [];

  // 關鍵字搜索匹配的額外前缀
  const matchedPrefixes = [];
  if (filterUpper.length > 0) {
    keywordMap.forEach(({ keywords, prefixes: kPrefixes }) => {
      if (keywords.some(kw => kw.toUpperCase().includes(filterUpper) || filterUpper.includes(kw.toUpperCase()))) {
        matchedPrefixes.push(...kPrefixes);
      }
    });
  }

  const listItems = document.querySelectorAll("#productList li");
  let matchFound = false;
  listItems.forEach((item) => {
    const modelCode = (item.dataset.model || "").toUpperCase();
    const titleText = (item.dataset.title || "").toUpperCase();

    // 分類篩選
    const inCategory = activeCategory === "all" || prefixes.some(p => modelCode.startsWith(p.toUpperCase()));
    if (!inCategory) { item.style.display = "none"; return; }

    // 搜索篩選
    if (filterUpper.length === 0) {
      item.style.display = "list-item";
      matchFound = true;
      return;
    }
    const byCode = modelCode.includes(filterUpper) || titleText.includes(filterUpper);
    const byKeyword = matchedPrefixes.some(p => modelCode.startsWith(p.toUpperCase()));
    if (byCode || byKeyword) {
      item.style.display = "list-item";
      matchFound = true;
    } else {
      item.style.display = "none";
    }
  });

  if (!matchFound && filterUpper.length > 0) {
    console.warn(`⚠️ 没有找到匹配的产品: "${filterUpper}"`);
  }
}

// **📌 关键字 → 型号前缀映射**
const keywordMap = [
  { keywords: ["sandwich prep", "sandwich", "mega top salad", "mega top"], prefixes: ["MSF"] },
  { keywords: ["pizza prep", "pizza"], prefixes: ["MPF"] },
  { keywords: ["undercounter", "under counter", "worktop", "work top", "chef base"], prefixes: ["MGF"] },
  { keywords: ["walk-in cooler", "walk in cooler", "walkin"], prefixes: ["AWC"] },
  { keywords: ["ice maker", "ice machine"], prefixes: ["YR"] },
  { keywords: ["ice dispenser"], prefixes: ["HD350"] },
  { keywords: ["display case", "refrigerated display"], prefixes: ["RDCS"] },
  { keywords: ["gas range"], prefixes: ["AGR"] },
  { keywords: ["thermostatic griddle"], prefixes: ["ATTG"] },
  { keywords: ["manual griddle"], prefixes: ["ATMG"] },
  { keywords: ["griddle"], prefixes: ["ATTG", "ATMG"] },
  { keywords: ["deep fryer", "fryer"], prefixes: ["ATFS"] },
  { keywords: ["char rock broiler", "char rock", "char broiler"], prefixes: ["ATCB"] },
  { keywords: ["radiant broiler"], prefixes: ["ATRC"] },
  { keywords: ["cheesemelter"], prefixes: ["ATCM"] },
  { keywords: ["hot plate"], prefixes: ["ACHP"] },
  { keywords: ["holding cabinet", "warming cabinet"], prefixes: ["ATHC"] },
  { keywords: ["stock pot stove", "stock pot"], prefixes: ["ATSP"] },
  { keywords: ["glass door", "merchandiser"], prefixes: ["MCF"] },
  { keywords: ["reach-in", "reach in", "top mount", "bottom mount"], prefixes: ["MBF"] },
];

// **📌 搜索功能**
function searchProduct() {
  const input = document.getElementById("searchInput");
  if (!input) return;
  const filter = input.value.trim();
  applyFilters(filter.toUpperCase());
}

// (登录逻辑已移至上方 DOMContentLoaded 块)

// **📌 关闭公告栏**
function closeAnnouncement() {
  const announcementBar = document.getElementById("announcementBar");
  if (announcementBar) announcementBar.style.display = "none";
}

// **📌 公告動態管理**
async function loadAnnouncement() {
  try {
    const res = await fetch('/api/announcement');
    if (!res.ok) return;
    const { lines } = await res.json();
    const el = document.getElementById('announcementContent');
    if (!el) return;
    if (!lines || lines.length === 0) {
      el.innerHTML = '<em style="color:#aaa;">No announcements.</em>';
      return;
    }
    el.innerHTML = lines.map((l, i) => `${i + 1}. ${l}`).join('<br>');
  } catch (e) {}
}

function toggleAnnouncementEdit() {
  const editArea = document.getElementById('announcementEditArea');
  const content = document.getElementById('announcementContent');
  const textarea = document.getElementById('announcementEdit');
  if (!editArea || !content || !textarea) return;

  const isEditing = editArea.style.display !== 'none';
  if (isEditing) {
    editArea.style.display = 'none';
    content.style.display = '';
  } else {
    // 把當前公告文字填入 textarea（每行一條）
    const lines = content.innerText.replace(/^\d+\.\s*/gm, '').split('\n').filter(Boolean);
    textarea.value = lines.join('\n');
    editArea.style.display = '';
    content.style.display = 'none';
    textarea.focus();
  }
}

async function saveAnnouncement() {
  const textarea = document.getElementById('announcementEdit');
  if (!textarea) return;
  const lines = textarea.value.split('\n').map(l => l.trim()).filter(Boolean);
  try {
    const res = await fetch('/api/announcement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines })
    });
    if (res.ok) {
      await loadAnnouncement();
      toggleAnnouncementEdit();
    } else {
      alert('Save failed: ' + res.status);
    }
  } catch (e) {
    alert('Error saving announcement');
  }
}

// **📌 最近瀏覽紀錄**
const RECENT_KEY = 'atosa_recent_viewed';
const RECENT_MAX = 8;

function getRecentHistory() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; }
}

function addToRecentHistory(model) {
  let list = getRecentHistory().filter(m => m !== model);
  list.unshift(model);
  if (list.length > RECENT_MAX) list = list.slice(0, RECENT_MAX);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

function clearRecentHistory() {
  localStorage.removeItem(RECENT_KEY);
  renderRecentHistory();
}

function renderRecentHistory() {
  const container = document.getElementById('recentHistory');
  const tagsEl = document.getElementById('recentTags');
  if (!container || !tagsEl) return;
  const list = getRecentHistory();
  if (list.length === 0) { container.style.display = 'none'; return; }
  container.style.display = 'block';
  tagsEl.innerHTML = list.map(model => {
    const title = productTitleMap[model];
    const label = title ? title.replace(/^[^—–-]*[—–-]\s*/, '') : model;
    return `<a class="recent-tag" href="product.html?model=${model}" target="_blank" title="${label}">${model}</a>`;
  }).join('');
}

// **📌 暗色模式**
(function () {
  const DARK_KEY = 'atosa_dark_mode';
  const apply = (dark) => {
    document.body.classList.toggle('dark-mode', dark);
    const btn = document.getElementById('darkModeToggle');
    if (btn) btn.textContent = dark ? '☀️' : '🌙';
  };

  // 初始應用（先套用，再等 DOMContentLoaded）
  const saved = localStorage.getItem(DARK_KEY);
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved !== null ? saved === '1' : prefersDark;

  if (isDark) document.body.classList.add('dark-mode');

  document.addEventListener('DOMContentLoaded', () => {
    apply(document.body.classList.contains('dark-mode'));
    const btn = document.getElementById('darkModeToggle');
    if (btn) {
      btn.addEventListener('click', () => {
        const nowDark = !document.body.classList.contains('dark-mode');
        apply(nowDark);
        localStorage.setItem(DARK_KEY, nowDark ? '1' : '0');
      });
    }
  });
})();

// **📌 初始化**
document.addEventListener("DOMContentLoaded", async function () {
  try {
    // Load product titles (code → display name)
    const res = await fetch('/api/product-titles');
    if (res.ok) productTitleMap = await res.json();
  } catch (e) {}

  try {
    // Merge all DB model codes into static list — append any code not already present.
    // Uses /api/all-model-codes (scans every family's models object) so newly added
    // models appear even if they were never added to the modelmap explicitly.
    const [mmRes, amcRes] = await Promise.all([
      fetch('/api/modelmap'),
      fetch('/api/all-model-codes')
    ]);
    const extra = new Set();
    if (mmRes.ok)  Object.keys(await mmRes.json()).forEach(k => extra.add(k));
    if (amcRes.ok) (await amcRes.json()).forEach(k => extra.add(k));
    const existing = new Set(products);
    const newOnes  = [...extra].filter(k => !existing.has(k));
    if (newOnes.length > 0) products = [...products, ...newOnes];
  } catch (e) {}

  renderProductList();
  applyFilters("");
  renderRecentHistory();

  // 載入公告
  await loadAnnouncement();

  // 若是管理員，顯示編輯按鈕
  try {
    const meRes = await fetch('/api/me');
    if (meRes.ok) {
      const { role } = await meRes.json();
      if (role === 'superAdmin') {
        const editBtn = document.getElementById('annEditBtn');
        if (editBtn) editBtn.style.display = 'inline';
        const adminBtn = document.getElementById('adminBtn');
        if (adminBtn) adminBtn.style.display = 'inline-block';
      }
    }
  } catch (e) {}

  // 若在 product 頁面，記錄當前型號
  const urlParams = new URLSearchParams(window.location.search);
  const model = urlParams.get('model');
  if (model) addToRecentHistory(model.toUpperCase());
});
