// ---------- Supabase ----------
const SUPABASE_URL = "https://tfeljeyagcvoahsocfpu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZWxqZXlhZ2N2b2Foc29jZnB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMTYyNTIsImV4cCI6MjEwODc5MjI1Mn0.29bfb_jAIeF0K1aL7OqqK14FpCOdoQQdEK06brME7fs";

// "Məni xatırla": işarəli deyilsə sessiya yalnız brauzer bağlanana qədər saxlanır
const pickStore = () => localStorage.getItem("bal_remember") === "0" ? sessionStorage : localStorage;
const authStorage = {
  getItem: k => localStorage.getItem(k) ?? sessionStorage.getItem(k),
  setItem: (k, v) => { const s = pickStore(); (s === localStorage ? sessionStorage : localStorage).removeItem(k); s.setItem(k, v); },
  removeItem: k => { localStorage.removeItem(k); sessionStorage.removeItem(k); }
};
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storage: authStorage } });

// Redirect ünvanı (GitHub Pages alt-qovluğunda da işləyir)
const BASE_URL = location.origin + location.pathname.replace(/[^/]*$/, "");

let currentUser = null;
let currentAuthMode = "login";
let orders = [];
let expenses = [];

const $ = id => document.getElementById(id);
const fmt = n => Number(n || 0).toFixed(2) + " ₼";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- Başlanğıc ----------
document.addEventListener("DOMContentLoaded", async () => {
  switchAuthMode("login");
  switchTab("dashboard");
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

  _supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session) {
      currentUser = session.user;
      showAppScreen();
      switchTab("settings");
      showToast("Yeni şifrənizi daxil edin.");
    } else if (event === "SIGNED_OUT") {
      currentUser = null;
      showAuthScreen();
    }
  });

  const { data: { session } } = await _supabase.auth.getSession();
  if (session) { currentUser = session.user; showAppScreen(); } else { showAuthScreen(); }
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
  $("authSwitchText").innerHTML = mode === "login" ? `Hesabınız yoxdur? ${link("register", "Qeydiyyatdan keç")}`
    : reg ? `Hesabınız var? ${link("login", "Daxil ol")}` : link("login", "Girişə qayıt");
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;
  const btn = $("authSubmitBtn"); btn.disabled = true;
  try {
    if (currentAuthMode === "login") {
      localStorage.setItem("bal_remember", $("rememberMeCheck").checked ? "1" : "0");
      const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
      if (error) return showToast("Xəta: " + error.message);
      currentUser = data.user; showAppScreen(); showToast("Uğurla daxil olundu!");
    } else if (currentAuthMode === "register") {
      const { error } = await _supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: BASE_URL, data: { first_name: $("regName").value.trim(), last_name: $("regSurname").value.trim() } }
      });
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
  currentUser = null; orders = []; expenses = [];
  showAuthScreen(); showToast("Hesabdan çıxıldı.");
}

async function updateUserPassword() {
  const p = $("newPasswordInput").value;
  if (p.length < 6) return showToast("Şifrə ən azı 6 simvol olmalıdır!");
  const { error } = await _supabase.auth.updateUser({ password: p });
  if (error) return showToast("Xəta: " + error.message);
  showToast("Şifrəniz uğurla dəyişdirildi!"); $("newPasswordInput").value = "";
}

async function updateCompany() {
  const company = $("companyInput").value.trim();
  const { data, error } = await _supabase.auth.updateUser({ data: { company } });
  if (error) return showToast("Xəta: " + error.message);
  currentUser = data.user; renderHeader(); showToast("Yadda saxlanıldı!");
}

// ---------- Ekranlar ----------
function showAuthScreen() {
  $("authScreen").classList.remove("hidden");
  $("appScreen").classList.add("hidden");
}

function showAppScreen() {
  $("authScreen").classList.add("hidden");
  $("appScreen").classList.remove("hidden");
  renderHeader();
  loadData();
}

function renderHeader() {
  const m = currentUser?.user_metadata || {};
  const full = [m.first_name, m.last_name].filter(Boolean).join(" ") || m.full_name || m.name || (currentUser?.email || "").split("@")[0];
  $("userGreeting").innerText = full;
  $("userCompanyInfo").innerText = m.company || "";
  $("userContactInfo").innerText = currentUser?.email || "";
  $("appUserInitial").innerText = (full[0] || "?").toUpperCase();
  const img = $("appUserAvatarImg");
  if (m.avatar_url || m.picture) { img.src = m.avatar_url || m.picture; img.classList.remove("hidden"); $("appUserInitial").classList.add("hidden"); }
  else { img.classList.add("hidden"); $("appUserInitial").classList.remove("hidden"); }
  $("companyInput").value = m.company || "";
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
  const t = $("toastNotification");
  t.innerText = text; t.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.add("hidden"), 3000);
}

function openCustomsModal() { $("trackerModal").classList.toggle("hidden"); }

// ---------- Məlumat ----------
async function loadData() {
  const [o, x] = await Promise.all([
    _supabase.from("orders").select("*").order("created_at", { ascending: false }),
    _supabase.from("expenses").select("*").order("created_at", { ascending: false })
  ]);
  if (o.error || x.error) showToast("Məlumat yüklənmədi: " + (o.error || x.error).message);
  orders = o.data || []; expenses = x.data || [];
  renderAll();
}

const orderNo = o => "#ORD-" + String(o.seq).padStart(4, "0");
const sameMonth = d => { const a = new Date(d), n = new Date(); return a.getMonth() === n.getMonth() && a.getFullYear() === n.getFullYear(); };

function renderAll() {
  const mo = orders.filter(o => sameMonth(o.created_at));
  const me = expenses.filter(x => sameMonth(x.created_at));
  const turnover = mo.reduce((s, o) => s + Number(o.amount), 0);
  const profit = mo.reduce((s, o) => s + Number(o.amount) - Number(o.cost), 0) - me.reduce((s, x) => s + Number(x.amount), 0);
  $("statTotalTurnover").innerText = fmt(turnover);
  $("statNetProfit").innerText = fmt(profit);
  $("statNetProfit").className = "text-base font-black " + (profit < 0 ? "text-rose-400" : "text-indigo-400");
  if (!$("editOrderId").value) $("nextIdPreview").innerText = "#ORD-" + String(Math.max(0, ...orders.map(o => o.seq)) + 1).padStart(4, "0");

  $("ordersList").innerHTML = orders.length ? orders.map(o => `
    <div class="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2">
      <div class="min-w-0">
        <div class="text-[10px] font-mono font-bold text-indigo-600">${orderNo(o)}</div>
        <div class="text-xs font-bold truncate">${esc(o.product_name)} · ${esc(o.customer_name)}</div>
        <div class="text-[10px] text-slate-500">${fmt(o.amount)} · mənfəət ${fmt(o.amount - o.cost)}</div>
      </div>
      <div class="flex gap-1 shrink-0">
        <button type="button" data-edit="${o.id}" class="px-2 py-1 bg-indigo-50 rounded-lg text-xs cursor-pointer">✏️</button>
        <button type="button" data-del-order="${o.id}" class="px-2 py-1 bg-rose-50 rounded-lg text-xs cursor-pointer">🗑️</button>
      </div>
    </div>`).join("") : `<p class="text-xs text-slate-400 text-center py-4">Hələ sifariş yoxdur.</p>`;

  $("expensesFullListContainer").innerHTML = expenses.length ? expenses.map(x => `
    <div class="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2">
      <div class="min-w-0">
        <div class="text-xs font-bold truncate">${esc(x.title)}</div>
        <div class="text-[10px] text-slate-500">${fmt(x.amount)} · ${new Date(x.created_at).toLocaleDateString("az")}</div>
      </div>
      <button type="button" data-del-exp="${x.id}" class="px-2 py-1 bg-rose-50 rounded-lg text-xs cursor-pointer">🗑️</button>
    </div>`).join("") : `<p class="text-xs text-slate-400 text-center py-4">Hələ xərc yoxdur.</p>`;
}

// ---------- Sifarişlər ----------
async function saveOrder(e) {
  e.preventDefault();
  const row = {
    product_name: $("productName").value.trim(),
    customer_name: $("customerName").value.trim(),
    amount: parseFloat($("orderAmount").value),
    cost: parseFloat($("orderCost").value)
  };
  if (!row.product_name || !row.customer_name || isNaN(row.amount) || isNaN(row.cost)) return showToast("Bütün xanaları doldurun!");
  const id = $("editOrderId").value;
  const { error } = id ? await _supabase.from("orders").update(row).eq("id", id) : await _supabase.from("orders").insert(row);
  if (error) return showToast("Xəta: " + error.message);
  showToast(id ? "Sifariş yeniləndi!" : "Sifariş əlavə olundu!");
  resetOrderForm(); loadData();
}

function editOrder(id) {
  const o = orders.find(x => x.id === id); if (!o) return;
  $("editOrderId").value = o.id;
  $("productName").value = o.product_name; $("customerName").value = o.customer_name;
  $("orderAmount").value = o.amount; $("orderCost").value = o.cost;
  $("formTitleText").innerText = "✏️ Sifarişi redaktə et";
  $("nextIdPreview").innerText = orderNo(o);
  $("cancelEditBtn").classList.remove("hidden");
  switchTab("dashboard");
}

function resetOrderForm() {
  $("orderForm").reset(); $("editOrderId").value = "";
  $("formTitleText").innerText = "➕ Yeni Sifariş";
  $("cancelEditBtn").classList.add("hidden");
  renderAll();
}

// ---------- Xərclər ----------
async function saveExpense(e) {
  e.preventDefault();
  const row = { title: $("expenseTitle").value.trim(), amount: parseFloat($("expenseAmount").value) };
  if (!row.title || isNaN(row.amount)) return showToast("Bütün xanaları doldurun!");
  const { error } = await _supabase.from("expenses").insert(row);
  if (error) return showToast("Xəta: " + error.message);
  e.target.reset(); showToast("Xərc əlavə olundu!"); loadData();
}

// Silmə və redaktə düymələri (event delegation)
document.addEventListener("click", async e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.edit) return editOrder(b.dataset.edit);
  const table = b.dataset.delOrder ? "orders" : b.dataset.delExp ? "expenses" : null;
  if (!table || !confirm("Silinsin?")) return;
  const { error } = await _supabase.from(table).delete().eq("id", b.dataset.delOrder || b.dataset.delExp);
  if (error) return showToast("Xəta: " + error.message);
  showToast("Silindi."); loadData();
});
