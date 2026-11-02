// ---------- Supabase ----------
const SUPABASE_URL = "https://tfeljeyagcvoahsocfpu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZWxqZXlhZ2N2b2Foc29jZnB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMTYyNTIsImV4cCI6MjEwODc5MjI1Mn0.29bfb_jAIeF0K1aL7OqqK14FpCOdoQQdEK06brME7fs";
const pickStore = () => localStorage.getItem("bal_remember") === "0" ? sessionStorage : localStorage;
const authStorage = {
  getItem: k => localStorage.getItem(k) ?? sessionStorage.getItem(k),
  setItem: (k, v) => { const s = pickStore(); (s === localStorage ? sessionStorage : localStorage).removeItem(k); s.setItem(k, v); },
  removeItem: k => { localStorage.removeItem(k); sessionStorage.removeItem(k); }
};
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storage: authStorage } });
const BASE_URL = location.origin + location.pathname.replace(/[^/]*$/, "");
const LIMIT_USD = 300, LOW_STOCK = 10;

let currentUser = null, currentAuthMode = "login", pendingAvatar;
let orders = [], expenses = [], recipients = [];

const $ = id => document.getElementById(id);
const fmt = n => Number(n || 0).toFixed(2) + " ₼";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = id => parseFloat($(id).value) || 0;
const sameMonth = (d, off = 0) => { const a = new Date(d), n = new Date(); n.setMonth(n.getMonth() - off); return a.getMonth() === n.getMonth() && a.getFullYear() === n.getFullYear(); };
const orderNo = o => "#ORD-" + String(o.seq).padStart(4, "0");

// Ayarlar (valyuta, paket) — istifadəçi hesabında saxlanılır
const S = () => ({ usd: 1.7, eur: 1.85, cny: 0.24, pkgCost: 0.15, pkgStock: 50, ...(currentUser?.user_metadata?.settings || {}) });
const rate = c => c === "AZN" ? 1 : (S()[c.toLowerCase()] || 0);
const profitOf = o => Number(o.sell_price) - Number(o.cost_price) - Number(o.cargo_fee) * rate(o.cargo_currency);
const debtOf = o => Number(o.sell_price) - Number(o.paid_amount);

async function saveSettings(obj) {
  const { data, error } = await _supabase.auth.updateUser({ data: { settings: obj } });
  if (error) { showToast("Xəta: " + error.message); return false; }
  currentUser = data.user; return true;
}

// ---------- Başlanğıc ----------
document.addEventListener("DOMContentLoaded", async () => {
  switchAuthMode("login"); switchTab("dashboard"); calculateProfit();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  _supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session) {
      currentUser = session.user; showAppScreen(); switchTab("settings"); showToast("Yeni şifrənizi daxil edin.");
    } else if (event === "SIGNED_OUT") { currentUser = null; showAuthScreen(); }
  });
  const { data: { session } } = await _supabase.auth.getSession();
  if (session) { currentUser = session.user; showAppScreen(); } else showAuthScreen();
});

// ---------- Auth ----------
function switchAuthMode(mode) {
  currentAuthMode = mode;
  const reg = mode === "register", forgot = mode === "forgot";
  $("nameFields").classList.toggle("hidden", !reg);
  $("rememberMeContainer").classList.toggle("hidden", mode !== "login");
  $("socialLoginSection").classList.toggle("hidden", mode !== "login");
  $("passwordField").classList.toggle("hidden", forgot);
  $("authPassword").required = !forgot;
  $("authSubmitBtn").innerText = reg ? "Qeydiyyatdan Keç" : forgot ? "Sıfırlama Linki Göndər" : "Daxil Ol";
  $("authSubtitle").innerText = reg ? "Yeni hesab yaradın" : forgot ? "E-poçtunuza sıfırlama linki göndəriləcək" : "Biznesinizi buludda idarə edin";
  const link = (m, t) => `<button type="button" onclick="switchAuthMode('${m}')" class="text-indigo-600 font-bold hover:underline">${t}</button>`;
  $("authSwitchText").innerHTML = mode === "login" ? `Hesabınız yoxdur? ${link("register", "Qeydiyyatdan keç")}` : reg ? `Hesabınız var? ${link("login", "Daxil ol")}` : link("login", "Girişə qayıt");
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = $("authEmail").value.trim(), password = $("authPassword").value, btn = $("authSubmitBtn");
  btn.disabled = true;
  try {
    if (currentAuthMode === "login") {
      localStorage.setItem("bal_remember", $("rememberMeCheck").checked ? "1" : "0");
      const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
      if (error) return showToast("Xəta: " + error.message);
      currentUser = data.user; showAppScreen(); showToast("Uğurla daxil olundu!");
    } else if (currentAuthMode === "register") {
      const { error } = await _supabase.auth.signUp({ email, password, options: { emailRedirectTo: BASE_URL, data: { first_name: $("regName").value.trim(), last_name: $("regSurname").value.trim() } } });
      if (error) return showToast("Xəta: " + error.message);
      showToast("Qeydiyyat tamamlandı! E-poçtunuzu yoxlayın."); switchAuthMode("login");
    } else {
      const { error } = await _supabase.auth.resetPasswordForEmail(email, { redirectTo: BASE_URL });
      if (error) return showToast("Xəta: " + error.message);
      showToast("Sıfırlama linki e-poçtunuza göndərildi!"); switchAuthMode("login");
    }
  } finally { btn.disabled = false; }
}

async function socialLogin(provider) {
  localStorage.setItem("bal_remember", "1");
  const { error } = await _supabase.auth.signInWithOAuth({ provider, options: { redirectTo: BASE_URL } });
  if (error) showToast("Sosial giriş xətası: " + error.message);
}

async function handleLogout() {
  await _supabase.auth.signOut();
  currentUser = null; orders = []; expenses = []; recipients = [];
  showAuthScreen(); showToast("Hesabdan çıxıldı.");
}

async function updateUserPassword() {
  const p = $("newPasswordInput").value;
  if (p.length < 6) return showToast("Şifrə ən azı 6 simvol olmalıdır!");
  const { error } = await _supabase.auth.updateUser({ password: p });
  if (error) return showToast("Xəta: " + error.message);
  showToast("Şifrəniz uğurla dəyişdirildi!"); $("newPasswordInput").value = "";
}

// ---------- Ekranlar ----------
function showAuthScreen() { $("authScreen").classList.remove("hidden"); $("appScreen").classList.add("hidden"); }
function showAppScreen() {
  $("authScreen").classList.add("hidden"); $("appScreen").classList.remove("hidden");
  renderHeader(); fillSettings(); loadData();
}

function userAvatar() { const m = currentUser?.user_metadata || {}; return m.avatar_url || m.picture || ""; }
function renderHeader() {
  const m = currentUser?.user_metadata || {};
  const full = [m.first_name, m.last_name].filter(Boolean).join(" ") || m.full_name || m.name || (currentUser?.email || "").split("@")[0];
  $("userGreeting").innerText = full; $("userCompanyInfo").innerText = m.company || ""; $("userContactInfo").innerText = currentUser?.email || "";
  $("appUserInitial").innerText = (full[0] || "?").toUpperCase();
  const av = userAvatar();
  $("appUserAvatarImg").classList.toggle("hidden", !av); $("appUserInitial").classList.toggle("hidden", !!av);
  if (av) $("appUserAvatarImg").src = av;
}

const TAB_ON = "flex-1 py-1.5 text-[10px] font-bold rounded-xl bg-white text-indigo-600 shadow-sm transition-all cursor-pointer text-center";
const TAB_OFF = "flex-1 py-1.5 text-[10px] font-bold text-slate-400 rounded-xl transition-all cursor-pointer text-center";
function switchTab(tab) {
  ["dashboard", "orders", "expenses", "settings"].forEach(t => {
    const N = t[0].toUpperCase() + t.slice(1);
    $(`tab${N}Content`).classList.toggle("hidden", t !== tab);
    $(`tab${N}Btn`).className = t === tab ? TAB_ON : TAB_OFF;
  });
}
function showToast(text) {
  const t = $("toastNotification"); $("toastText").innerText = text; t.classList.remove("hidden");
  clearTimeout(showToast._t); showToast._t = setTimeout(() => t.classList.add("hidden"), 3000);
}

// ---------- Məlumat ----------
async function loadData() {
  const q = t => _supabase.from(t).select("*").order("created_at", { ascending: false });
  const [o, x, r] = await Promise.all([q("orders"), q("expenses"), q("recipients")]);
  const err = o.error || x.error || r.error;
  if (err) showToast("Məlumat yüklənmədi: " + err.message);
  orders = o.data || []; expenses = x.data || []; recipients = r.data || [];
  renderAll();
}

function renderAll() {
  const mo = orders.filter(o => sameMonth(o.created_at)), po = orders.filter(o => sameMonth(o.created_at, 1));
  const turn = mo.reduce((s, o) => s + Number(o.sell_price), 0), prev = po.reduce((s, o) => s + Number(o.sell_price), 0);
  const totProfit = orders.reduce((s, o) => s + profitOf(o), 0), totExp = expenses.reduce((s, x) => s + Number(x.amount), 0);
  const net = totProfit - totExp, pct = prev ? Math.round((turn - prev) / prev * 100) : (turn ? 100 : 0);
  $("statTotalTurnover").innerText = fmt(turn);
  $("statTurnoverBadge").innerText = `${pct >= 0 ? "+" : ""}${pct}% keçən aya nisbətən`;
  $("statTurnoverBadge").className = "text-[10px] font-bold " + (pct >= 0 ? "text-emerald-500" : "text-rose-400");
  $("statNetProfit").innerText = fmt(net);
  $("statNetProfit").className = "text-base font-black " + (net < 0 ? "text-rose-400" : "text-indigo-400");
  $("statTotalCost").innerText = fmt(orders.reduce((s, o) => s + Number(o.cost_price), 0));
  $("statTotalDebt").innerText = fmt(orders.reduce((s, o) => s + debtOf(o), 0));
  $("statTotalExpenses").innerText = fmt(totExp);
  const stock = S().pkgStock;
  $("packageWarningBanner").classList.toggle("hidden", stock > LOW_STOCK);
  $("warningPackageCount").innerText = stock;
  if (!$("editOrderId").value) $("nextIdPreview").innerText = "#ORD-" + String(Math.max(0, ...orders.map(o => o.seq)) + 1).padStart(4, "0");
  fillRecipientSelects(); updateOrdersUI(); renderExpenses(); renderRecipientsSettings();
}

function fillRecipientSelects() {
  const opts = recipients.map(r => `<option value="${r.id}">${esc(r.name)} (${esc(r.fin)})</option>`).join("");
  const a = $("recipientSelect"), b = $("filterRecipient"), va = a.value, vb = b.value;
  a.innerHTML = `<option value="">— seçilməyib —</option>` + opts;
  b.innerHTML = `<option value="">Gömrük Şəxsi</option>` + opts;
  a.value = va; b.value = vb;
}

// ---------- Sifarişlər ----------
function calculateProfit() {
  const p = num("sellPrice") - num("costPrice") - num("cargoFee") * rate($("cargoCurrency").value);
  $("liveDebt").innerText = (num("sellPrice") - num("paidAmount")).toFixed(2) + " AZN";
  $("liveProfit").innerText = p.toFixed(2) + " AZN";
  $("liveProfit").className = "font-bold " + (p < 0 ? "text-rose-600" : "text-emerald-700");
}

async function saveOrder(e) {
  e.preventDefault();
  const phone = $("customerPhone").value.trim();
  if (!/^\d{9}$/.test(phone)) return showToast("Nömrə 9 rəqəm olmalıdır (məs: 501234567)!");
  if (num("costPrice") <= 0) return showToast("Maya qiyməti mütləq daxil edilməlidir!");
  const row = {
    product_name: $("productName").value.trim(), store_platform: $("storePlatform").value.trim(), product_note: $("productNote").value.trim(),
    customer_name: $("customerName").value.trim(), customer_phone: phone, recipient_id: $("recipientSelect").value || null,
    status: $("orderStatus").value, sell_price: num("sellPrice"), paid_amount: num("paidAmount"), cost_price: num("costPrice"),
    cargo_fee: num("cargoFee"), cargo_currency: $("cargoCurrency").value
  };
  const id = $("editOrderId").value;
  let error;
  if (id) ({ error } = await _supabase.from("orders").update(row).eq("id", id));
  else {
    const r = await _supabase.from("orders").insert(row).select().single();
    error = r.error;
    if (!error) { // hər yeni sifariş üçün paket xərci avtomatik yazılır
      const x = await _supabase.from("expenses").insert({ category: "📦 Qablaşdırma", title: `Paket · ${orderNo(r.data)}`, amount: S().pkgCost });
      if (x.error) showToast("Paket xərci yazılmadı: " + x.error.message);
    }
  }
  if (error) return showToast("Xəta: " + error.message);
  if (!id) await saveSettings({ ...S(), pkgStock: Math.max(0, S().pkgStock - 1) }); // hər yeni sifariş 1 paket işlədir
  showToast(id ? "Sifariş yeniləndi!" : "Sifariş əlavə olundu!");
  resetOrderForm(); loadData(); fillSettings();
}

function editOrder(id) {
  const o = orders.find(x => x.id === id); if (!o) return;
  $("editOrderId").value = o.id;
  const set = { productName: o.product_name, storePlatform: o.store_platform, productNote: o.product_note, customerName: o.customer_name, customerPhone: o.customer_phone,
    recipientSelect: o.recipient_id || "", orderStatus: o.status, sellPrice: o.sell_price, paidAmount: o.paid_amount, costPrice: o.cost_price, cargoFee: o.cargo_fee, cargoCurrency: o.cargo_currency };
  Object.entries(set).forEach(([k, v]) => $(k).value = v ?? "");
  $("formTitleText").innerText = "✏️ Sifarişi redaktə et"; $("nextIdPreview").innerText = orderNo(o);
  $("submitOrderBtn").innerText = "Dəyişiklikləri Saxla"; $("cancelEditBtn").classList.remove("hidden");
  calculateProfit(); switchTab("dashboard"); window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetOrderForm() {
  $("orderForm").reset(); $("editOrderId").value = "";
  $("formTitleText").innerText = "➕ Yeni Sifariş"; $("submitOrderBtn").innerText = "Sifarişi Yadda Saxla";
  $("cancelEditBtn").classList.add("hidden"); calculateProfit(); renderAll();
}

function resetFilters() { ["searchInput", "filterStatus", "filterRecipient", "filterDate"].forEach(i => $(i).value = ""); updateOrdersUI(); }

const STATUS_CLR = { "Sifariş gözləyir": "bg-amber-100 text-amber-700", "Sifariş olundu / Yolda": "bg-sky-100 text-sky-700", "Anbarda": "bg-violet-100 text-violet-700", "Təhvil verildi": "bg-emerald-100 text-emerald-700" };
function updateOrdersUI() {
  const q = $("searchInput").value.trim().toLowerCase(), st = $("filterStatus").value, rc = $("filterRecipient").value, dt = $("filterDate").value;
  const list = orders.filter(o =>
    (!q || [o.customer_name, o.customer_phone, o.product_name].some(v => String(v || "").toLowerCase().includes(q))) &&
    (!st || o.status === st) && (!rc || o.recipient_id === rc) &&
    (!dt || new Date(o.created_at).toLocaleDateString("sv") === dt));
  $("ordersCountBadge").innerText = list.length;
  $("ordersTotalSumBadge").innerText = list.reduce((s, o) => s + Number(o.sell_price), 0).toFixed(0) + " ₼";
  $("ordersList").innerHTML = list.length ? list.map(o => {
    const r = recipients.find(x => x.id === o.recipient_id), d = debtOf(o), p = profitOf(o);
    return `<div class="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 space-y-1">
      <div class="flex justify-between items-start gap-2">
        <div class="min-w-0">
          <div class="text-[10px] font-mono font-bold text-indigo-600">${orderNo(o)} · ${new Date(o.created_at).toLocaleDateString("az")}</div>
          <div class="text-xs font-bold truncate">${esc(o.product_name)}${o.store_platform ? " · " + esc(o.store_platform) : ""}</div>
          ${o.product_note ? `<div class="text-[10px] text-slate-500">${esc(o.product_note)}</div>` : ""}
          <div class="text-[10px] text-slate-600">${esc(o.customer_name)} · +994 ${esc(o.customer_phone)}</div>
          ${r ? `<div class="text-[10px] text-slate-500">🛃 ${esc(r.name)} ${esc(r.fin)}</div>` : ""}
        </div>
        <div class="flex gap-1 shrink-0">
          <button type="button" data-edit="${o.id}" class="px-2 py-1 bg-indigo-50 rounded-lg text-xs cursor-pointer">✏️</button>
          <button type="button" data-del-order="${o.id}" class="px-2 py-1 bg-rose-50 rounded-lg text-xs cursor-pointer">🗑️</button>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-1.5 text-[10px]">
        <span class="px-2 py-0.5 rounded-lg font-bold ${STATUS_CLR[o.status] || "bg-slate-100"}">${esc(o.status)}</span>
        <span class="font-bold">${fmt(o.sell_price)}</span>
        <span class="${d > 0 ? "text-rose-600" : "text-emerald-600"} font-bold">borc ${fmt(d)}</span>
        <span class="${p < 0 ? "text-rose-600" : "text-emerald-700"} font-bold">mənfəət ${fmt(p)}</span>
      </div></div>`;
  }).join("") : `<p class="text-xs text-slate-400 text-center py-4">Sifariş tapılmadı.</p>`;
}

// ---------- Xərclər ----------
function renderExpenses() {
  $("expensesTotalBadge").innerText = "Cəmi: " + expenses.reduce((s, x) => s + Number(x.amount), 0).toFixed(2) + " ₼";
  $("expensesFullListContainer").innerHTML = expenses.length ? expenses.map(x => `
    <div class="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2">
      <div class="min-w-0"><div class="text-xs font-bold truncate">${esc(x.title)}</div>
        <div class="text-[10px] text-slate-500">${esc(x.category)} · ${fmt(x.amount)} · ${new Date(x.created_at).toLocaleDateString("az")}</div></div>
      <button type="button" data-del-exp="${x.id}" class="px-2 py-1 bg-rose-50 rounded-lg text-xs cursor-pointer">🗑️</button>
    </div>`).join("") : `<p class="text-xs text-slate-400 text-center py-4">Hələ xərc yoxdur.</p>`;
}

async function addExpense() {
  const category = $("expenseCategory").value, amount = parseFloat($("expenseAmount").value), title = $("expenseTitle").value.trim() || category;
  if (isNaN(amount) || amount <= 0) return showToast("Məbləği daxil edin!");
  const { error } = await _supabase.from("expenses").insert({ category, title, amount });
  if (error) return showToast("Xəta: " + error.message);
  $("expenseAmount").value = ""; $("expenseTitle").value = ""; showToast("Xərc qeydə alındı!"); loadData();
}

async function addPackageExpensePrompt() {
  const n = 50, cost = Math.round(n * S().pkgCost * 100) / 100;
  if (!confirm(`${n} ədəd paket alınsın? Xərc: ${fmt(cost)}`)) return;
  const { error } = await _supabase.from("expenses").insert({ category: "📦 Qablaşdırma", title: `${n} ədəd paket`, amount: cost });
  if (error) return showToast("Xəta: " + error.message);
  await saveSettings({ ...S(), pkgStock: S().pkgStock + n });
  showToast(`${n} paket əlavə olundu.`); fillSettings(); loadData();
}

// ---------- Gömrük ----------
function usedUsd(rid) {
  return orders.filter(o => o.recipient_id === rid && sameMonth(o.created_at)).reduce((s, o) => s + Number(o.cost_price), 0) / (S().usd || 1);
}

function openCustomsModal() {
  const m = $("trackerModal"); m.classList.toggle("hidden");
  if (m.classList.contains("hidden")) return;
  $("recipientsList").innerHTML = recipients.length ? recipients.map(r => {
    const u = usedUsd(r.id), p = Math.min(100, u / LIMIT_USD * 100), left = LIMIT_USD - u;
    const clr = u >= LIMIT_USD ? "bg-rose-500" : p >= 80 ? "bg-amber-500" : "bg-emerald-500";
    return `<div class="bg-slate-800 border border-slate-700 rounded-2xl px-3 py-2.5 space-y-1.5">
      <div class="flex justify-between text-xs"><span class="font-bold text-slate-100">${esc(r.name)} <span class="font-mono text-indigo-400">${esc(r.fin)}</span></span>
        <span class="font-bold ${left < 0 ? "text-rose-400" : "text-slate-300"}">$${u.toFixed(2)} / $${LIMIT_USD}</span></div>
      <div class="h-2 bg-slate-700 rounded-full overflow-hidden"><div class="${clr} h-full" style="width:${p}%"></div></div>
      <div class="text-[10px] text-slate-400">${left >= 0 ? `Qalan limit: $${left.toFixed(2)}` : `Limit $${(-left).toFixed(2)} aşılıb!`}</div></div>`;
  }).join("") : `<p class="text-xs text-slate-400">Əvvəlcə Ayarlar bölməsindən gömrük şəxsi əlavə edin.</p>`;
}

function renderRecipientsSettings() {
  $("settingsRecipientsList").innerHTML = recipients.map(r => `
    <div class="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
      <span class="font-bold">${esc(r.name)} <span class="font-mono text-indigo-600">${esc(r.fin)}</span></span>
      <button type="button" data-del-rec="${r.id}" class="text-rose-500 font-bold cursor-pointer">✕</button></div>`).join("");
}

async function addRecipientFromSettings() {
  const name = $("settingsNewRecipientName").value.trim(), fin = $("settingsNewRecipientFin").value.trim().toUpperCase();
  if (!name || !/^[A-Z0-9]{7}$/.test(fin)) return showToast("Ad və 7 simvolluq FİN kodu daxil edin!");
  const { error } = await _supabase.from("recipients").insert({ name, fin });
  if (error) return showToast("Xəta: " + error.message);
  $("settingsNewRecipientName").value = ""; $("settingsNewRecipientFin").value = ""; showToast("Əlavə olundu!"); loadData();
}

// ---------- Ayarlar ----------
function fillSettings() {
  const m = currentUser?.user_metadata || {}, s = S();
  $("settingsName").value = m.first_name || ""; $("settingsSurname").value = m.last_name || "";
  $("settingsCompanyName").value = m.company || ""; $("settingsEmail").value = currentUser?.email || "";
  $("usdRate").value = s.usd; $("eurRate").value = s.eur; $("cnyRate").value = s.cny;
  $("settingsPackageCost").value = s.pkgCost; $("settingsPackageStock").value = s.pkgStock;
  showAvatarPreview(userAvatar());
}
function showAvatarPreview(src) {
  $("settingsAvatarPreview").classList.toggle("hidden", !src); $("settingsAvatarPlaceholder").classList.toggle("hidden", !!src);
  $("removeAvatarBtn").classList.toggle("hidden", !src); if (src) $("settingsAvatarPreview").src = src;
}
function previewSettingsAvatar(e) {
  const f = e.target.files[0]; if (!f) return;
  const img = new Image(); img.onload = () => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const s = Math.min(img.width, img.height); c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 128, 128);
    pendingAvatar = c.toDataURL("image/jpeg", 0.8); showAvatarPreview(pendingAvatar); URL.revokeObjectURL(img.src);
  }; img.src = URL.createObjectURL(f);
}
function removeAvatar() { pendingAvatar = ""; showAvatarPreview(""); }

async function saveProfileSettings() {
  const upd = { first_name: $("settingsName").value.trim(), last_name: $("settingsSurname").value.trim(), company: $("settingsCompanyName").value.trim() };
  if (pendingAvatar !== undefined) { upd.avatar_url = pendingAvatar; upd.picture = pendingAvatar; }
  const email = $("settingsEmail").value.trim(), payload = { data: upd };
  if (email && email !== currentUser.email) payload.email = email;
  const { data, error } = await _supabase.auth.updateUser(payload);
  if (error) return showToast("Xəta: " + error.message);
  currentUser = data.user; pendingAvatar = undefined; renderHeader();
  showToast(payload.email ? "Saxlanıldı. Yeni e-poçtu təsdiqləyin." : "Profil yadda saxlanıldı!");
}

async function savePackageStock() {
  const ok = await saveSettings({ usd: num("usdRate"), eur: num("eurRate"), cny: num("cnyRate"), pkgCost: num("settingsPackageCost"), pkgStock: parseInt($("settingsPackageStock").value, 10) || 0 });
  if (ok) { showToast("Ayarlar saxlanıldı!"); renderAll(); calculateProfit(); }
}

// ---------- Excel / Backup ----------
function exportToCSV() {
  if (typeof XLSX === "undefined") return showToast("Excel kitabxanası yüklənmədi.");
  const dt = x => new Date(x.created_at).toLocaleDateString("az");
  const ords = orders.map(o => { const r = recipients.find(x => x.id === o.recipient_id) || {}; return {
    "№": orderNo(o), "Tarix": dt(o), "Məhsul": o.product_name, "Mağaza": o.store_platform, "Qeyd/Ölçü/Rəng": o.product_note, "Müştəri": o.customer_name,
    "Nömrə": "+994" + o.customer_phone, "Gömrük şəxsi": r.name, "FİN": r.fin, "Status": o.status, "Satış (₼)": +o.sell_price, "Alınan (₼)": +o.paid_amount,
    "Maya (₼)": +o.cost_price, "Kargo": +o.cargo_fee, "Valyuta": o.cargo_currency, "Qalıq borc (₼)": debtOf(o), "Mənfəət (₼)": +profitOf(o).toFixed(2) }; });
  const exps = expenses.map(x => ({ "Tarix": dt(x), "Kateqoriya": x.category, "Açıqlama": x.title, "Məbləğ (₼)": +x.amount }));
  if (!ords.length && !exps.length) return showToast("Export üçün məlumat yoxdur.");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ords), "Sifarişlər");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exps), "Xərclər");
  XLSX.writeFile(wb, `balansist-hesabat-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function exportBackupData() {
  const blob = new Blob([JSON.stringify({ version: 1, orders, expenses, recipients, settings: S() }, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `balansist-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(a.href);
}

async function importBackupData(e) {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try {
    const b = JSON.parse(await f.text());
    if (!confirm("Backup-dakı məlumatlar mövcud məlumatlara ƏLAVƏ olunacaq. Davam edək?")) return;
    const map = {}, strip = ({ id, user_id, seq, ...x }) => x;
    for (const r of b.recipients || []) {
      const { data, error } = await _supabase.from("recipients").insert({ name: r.name, fin: r.fin }).select().single();
      if (error) throw error; map[r.id] = data.id;
    }
    if (b.orders?.length) { const { error } = await _supabase.from("orders").insert(b.orders.map(o => ({ ...strip(o), recipient_id: map[o.recipient_id] || null }))); if (error) throw error; }
    if (b.expenses?.length) { const { error } = await _supabase.from("expenses").insert(b.expenses.map(strip)); if (error) throw error; }
    if (b.settings) await saveSettings({ ...S(), ...b.settings });
    showToast("Backup bərpa olundu!"); fillSettings(); loadData();
  } catch (err) { showToast("Bərpa xətası: " + (err.message || err)); }
}

// ---------- Düymələr (event delegation) ----------
document.addEventListener("click", async e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.edit) return editOrder(b.dataset.edit);
  const map = { delOrder: "orders", delExp: "expenses", delRec: "recipients" };
  const key = Object.keys(map).find(k => b.dataset[k]); if (!key) return;
  if (!confirm("Silinsin?")) return;
  const { error } = await _supabase.from(map[key]).delete().eq("id", b.dataset[key]);
  if (error) return showToast("Xəta: " + error.message);
  showToast("Silindi."); loadData();
});
