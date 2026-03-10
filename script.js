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
  // ——— 三个按钮：Tech Map / Data Analysis / Daily Follow-up ———
  const TECH_MAP_URL       = "https://tech-map.streamlit.app/";
  const DATA_ANALYSIS_URL  = "https://after-sales-service-report.streamlit.app/?guest=1&debug=1#可视化";
  const DAILY_FOLLOW_URL   = "https://daily-follow-up.streamlit.app/";   // ← 新增
  const ISSUE_TRACKER_URL  = "https://issue-tracker.streamlit.app/?tab=list"; // ← 新增
  const TECH_BONUS_URL = "https://tech-bonus.streamlit.app/"; // ← 新增

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
    <a class="btn" href="${TECH_MAP_URL}"      target="_blank" rel="noopener noreferrer">🚀 TECH MAP</a>
    <a class="btn" href="${DATA_ANALYSIS_URL}" target="_blank" rel="noopener noreferrer">📊 Data Analysis</a>
    <a class="btn" href="${DAILY_FOLLOW_URL}"  target="_blank" rel="noopener noreferrer">🗓 Daily Follow-up</a>  <!-- ← 新增按钮 -->
    <a class="btn" href="${ISSUE_TRACKER_URL}" target="_blank" rel="noopener noreferrer">🧩 Product issue-tracker</a>
    <a class="btn" href="${TECH_BONUS_URL}" target="_blank" rel="noopener noreferrer">🧰 In-House Tech Center Login</a>
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

  // 登录表单
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value;
      const btn = loginForm.querySelector("button[type=submit]");

      // 显示加载状态
      btn.disabled = true;
      btn.textContent = "Logging in...";

      try {
        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password })
        });

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

 // 产品列表
    const products = [
    "MSF8302GR", "MSF8308GR", "MSF17GR-NTCV", "MSF3610GR", "MSF3615GR",
      "MSF8301GR",  
      "MSF8303GR", "MSF8304GR", 
      "MSF8305GR",  "MSF8306GR", 
      "MSF8307GR", 
      "test","MBF15FSGR",
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
"MBB23GGR",
"MBB23GR",
"MBB48GGR",
"MBB48GR",
"MBB59GGR",
"MBB59GR",
"MBB69GGR",
"MBB69GR",
"MBB90GGR",
"MBB90GR",
"MBC24GR",
"MBC36GR",
"MBC50GR",
"MBC65GR",
"MBC80GR",
"MBC95GR",
"MKC23GR",
"MKC58GR",
"MKC68GR",
"MKC90GR",
"SBB48GGR",
"SBB48GR",
"SBB48SGGR",
"SBB59GGR",
"SBB59GR",
"SBB69GGR",
"SBB69GR",
"SBB69SGGR",
"SBB90GGR",
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
// **📌 渲染产品列表**
function renderProductList() {
  const productList = document.getElementById("productList");

  // **防止 productList 为空**
  if (!productList) {
    console.error("❌ `productList` 未找到，检查 HTML 里是否有 `<ul id='productList'></ul>`");
    return;
  }

  productList.innerHTML = ""; // 清空列表

  products.forEach((product) => {
    const li = document.createElement("li");
    const a = document.createElement("a");

    // All models now served by the single product.html template
    a.href = `product.html?model=${product}`;
    a.textContent = product;
    a.target = "_blank"; // 在新标签页打开

    li.appendChild(a);
    li.style.display = "none"; // **默认隐藏所有产品**
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

//序列号检查
function checkSerialNumber() {
  console.log("🔍 Running checkSerialNumber() from script.js...");

  let inputSerial = document.getElementById("serialInput").value.trim();
  console.log(`🔍 Step 1: Raw inputSerial: '${inputSerial}'`);
  const feedback = document.getElementById("serialFeedback");

  // Clear previous feedback
  feedback.innerHTML = "";

  // 新增的总长度检查
  const expectedLength = 18;
  if (inputSerial.length > expectedLength) {
    feedback.innerHTML = `<span style='color: red;'>❌ Serial number is too long. Expected ${expectedLength} characters, but found ${inputSerial.length}.</span><br>`;
  } else if (inputSerial.length < expectedLength) {
    feedback.innerHTML += `<span style='color: red;'>❌ Serial number is too short. Expected ${expectedLength} characters, but found ${inputSerial.length}.</span><br>`;
  }

  if (!inputSerial) {
    feedback.innerHTML += `<span style='color: red;'>❌ Please enter a serial number.</span>`;
    console.warn("⚠️ No serial number entered.");
    return;
  }

  let formattedResult = "";
  let isCorrect = true;
  let exceededPart = "";
  let extraChars = "";

  // ✅ **解析 Product Model (7 位)**
  let productModel = inputSerial.substring(0, 7);
  let rest = inputSerial.substring(7);

  let aIndex = rest.indexOf("A");
  if (aIndex === -1) {
    feedback.innerHTML += `<span style='color: red;'>❌ Invalid Serial Number: Model Number- Too Short) ❌ Or missing "A".</span>`;
    return;
  }

  let beforeA = rest.substring(0, aIndex);
  if (beforeA.length > 0) {
    exceededPart = "Product Model";
    extraChars = beforeA;
  }
  rest = rest.substring(aIndex);

  // ✅ **解析 Customer Code**
  let match = rest.match(/^A([A-Z]{0,2})([A-Z]*)/);
  let customerCode = match ? "A" + match[1] : "";
  let extraCustomer = match ? match[2] : "";
  
  // 客户编码要求：如果没有AUS或CAJ，直接报错；如果客户编码长度大于3，报错
  if (!/^(AUS|CAJ)$/.test(customerCode)) {
    feedback.innerHTML += `<span style='color: red;'>❌ Invalid Customer Code: Must include 'AUS' no more than 3 characters long.</span>`;
    return;
  }
  if (customerCode.length > 3) {
    feedback.innerHTML += `<span style='color: red;'>❌ Invalid Customer Code: Must include 'AUS' no more than 3 characters long.</span>`;
    return;
  }

  rest = rest.substring(customerCode.length + extraCustomer.length);

  // ✅ **解析 Configuration**
  match = rest.match(/^([0-9]*)([^CTNOP]*)/);
  let configuration = match ? match[1] : "";
  let extraConfiguration = match ? match[2] : "";

  if (configuration.length > 1) {
    extraConfiguration = configuration.substring(1) + extraConfiguration;
    configuration = configuration.substring(0, 1);
  }

  rest = rest.substring(configuration.length + extraConfiguration.length);

  // ✅ **解析 Production Location**
  let productionLocation = "";
  let extraLocation = "";

  // 只取第一个字母作为生产地字符（T 或 C）
  if (/^[TC]$/.test(rest[0])) {
    productionLocation = rest[0]; // 取第一个字符作为生产地
    rest = rest.substring(1); // 移除生产地字符
  } else {
    productionLocation = ""; // 如果没有 T 或 C，生产地为空
  }

  // ✅ **解析 Production Date**
  let productionDate = rest.substring(0, 3); // 生产日期的前三个字符
  let extraDate = "";

  if (productionDate.length > 3) {
    extraDate = productionDate.substring(3); // 处理超出的部分
    productionDate = productionDate.substring(0, 3);
    exceededPart = "Production Date";
  }
  rest = rest.substring(3);

  // ✅ **解析 Daily Production Count**
  let dailyProductionCount = rest.substring(0, 3);
  let extraCount = "";

  if (dailyProductionCount.length > 3) {
    extraCount = dailyProductionCount.substring(3); // 处理超出的部分
    dailyProductionCount = dailyProductionCount.substring(0, 3);
    exceededPart = "Daily Production Count";
  }

  if (/[^0-9]/.test(dailyProductionCount)) {
    exceededPart = "Daily Production Count";
    extraCount += dailyProductionCount.replace(/[0-9]/g, "");
  }

  let parts = [
    { name: "Product Model", value: productModel, extra: extraChars },
    { name: "Customer Code", value: customerCode, extra: extraCustomer },
    { name: "Configuration", value: configuration, extra: extraConfiguration },
    { name: "Production Location", value: productionLocation, extra: extraLocation },
    { name: "Production Date", value: productionDate, extra: extraDate },
    { name: "Daily Production Count", value: dailyProductionCount, extra: extraCount }
  ];

  parts.forEach((part) => {
    let displayPart = "";
    let errorMessage = "";
    let correctPart = part.value;
    let extraPart = part.extra || "";

    if (extraPart.length > 0) {
      displayPart = `<span style='color: green;'>${correctPart}</span>
                   <span style='color: red; background: yellow;'>${extraPart}</span>`;
      errorMessage = `<small style="color:red;">(${part.name} - Too Long) ❌ Must be exactly ${correctPart.length} characters.</small>`;
      isCorrect = false;
    } else if (!correctPart || correctPart.includes("_")) {
      displayPart = `<span style='color: red; font-weight: bold;'>${correctPart.padEnd(correctPart.length, "_")}</span>`;
      errorMessage = `<small style="color:red;">(${part.name} - Too Short) ❌ Must be exactly ${correctPart.length} characters.</small>`;
      isCorrect = false;
    } else {
      displayPart = `<span style='color: green; font-weight: bold;'>${correctPart}</span>`;
      errorMessage = `<small style="color:green;">(${part.name}) ✅</small>`;
    }

    formattedResult += displayPart + " " + errorMessage + "<br>";
  });

  feedback.innerHTML += `Checked Serial Number:<br>${formattedResult}`;
  feedback.innerHTML += isCorrect
    ? "<br><span style='color: green; font-size: 18px;'>✅ Serial number is correct.</span>"
    : "<br><span style='color: red; font-size: 18px;'>❌ Serial number contains errors.</span>";

  console.log("✅ Serial number check completed.");
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

// (登录逻辑已移至上方 DOMContentLoaded 块)

// **📌 关闭公告栏**
function closeAnnouncement() {
  const announcementBar = document.getElementById("announcementBar");
  if (announcementBar) {
    announcementBar.style.display = "none";
  }
}

// **📌 初始化**
document.addEventListener("DOMContentLoaded", function () {
  renderProductList();
});
