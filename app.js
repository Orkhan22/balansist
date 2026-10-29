// --- SUPABASE BAĞLANTISI ---
const SUPABASE_URL = https://tfeljeyagcvoahsocfpu.supabase.co/rest/v1/;
const SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZWxqZXlhZ2N2b2Foc29jZnB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMTYyNTIsImV4cCI6MjEwODc5MjI1Mn0.29bfb_jAIeF0K1aL7OqqK14FpCOdoQQdEK06brME7fs;
const _supabase = (typeof supabase !== 'undefined' && SUPABASE_URL !== https://tfeljeyagcvoahsocfpu.supabase.co/rest/v1/) 
    ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
    : null;

let currentUser = JSON.parse(localStorage.getItem('cib_currentUser')) || null;

let recipients = [];
let orders = [];
let expenses = [];
let packageStock = localStorage.getItem('cib_packageStock') !== null ? parseInt(localStorage.getItem('cib_packageStock')) : 50;

let tempPhone = "";
let demoSmsCode = "1234";

function showToast(text) {
    let toast = document.getElementById('toastNotification');
    if(!toast) return;
    document.getElementById('toastText').innerText = text;
    toast.classList.remove('hidden');
    setTimeout(() => { toast.classList.add('hidden'); }, 2500);
}

// --- SUPABASE-DƏN MƏLUMATLARI ÇƏKMƏK (LOAD) ---
async function loadDataFromSupabase() {
    if (!_supabase) {
        // Əgər Supabase qoşulmayıbsa localStorage-dən oxu
        loadLocalFallback();
        return;
    }

    try {
        // Gömrük şəxsləri
        let { data: recData, error: recErr } = await _supabase.from('recipients').select('*');
        if(!recErr && recData) recipients = recData;

        // Sifarişlər
        let { data: ordData, error: ordErr } = await _supabase.from('orders').select('*');
        if(!ordErr && ordData) {
            orders = ordData.map(o => ({
                id: o.id,
                productName: o.product_name,
                productNote: o.product_note,
                storePlatform: o.store_platform,
                customer: o.customer,
                phone: o.phone,
                recipient: o.recipient,
                orderStatus: o.order_status,
                sell: o.sell,
                paid: o.paid,
                debt: o.debt,
                profit: o.profit,
                itemUSD: o.item_usd,
                cost: o.cost,
                cargoInput: o.cargo_input,
                cargoCurrency: o.cargo_currency,
                date: o.date
            }));
        }

        // Xərclər
        let { data: expData, error: expErr } = await _supabase.from('expenses').select('*');
        if(!expErr && expData) expenses = expData;

    } catch (err) {
        console.log("Supabase yükləmə xətası, yerli yaddaşa keçilir:", err);
        loadLocalFallback();
    }
    
    updateAll();
}

function loadLocalFallback() {
    recipients = JSON.parse(localStorage.getItem('cib_recipients')) || [
        { name: "Orxan", fin: "1ABC234" },
        { name: "Elşən", fin: "2XYZ789" },
        { name: "Aysel", fin: "3LMN456" }
    ];
    orders = JSON.parse(localStorage.getItem('cib_orders')) || [];
    expenses = JSON.parse(localStorage.getItem('cib_expenses')) || [];
}

// --- MƏLUMATLARI SUPABASE-Ə YAZMAQ (SAVE) ---
async function saveData() {
    // Həmçinin localStorage-də ehtiyat kimi saxlayırıq
    localStorage.setItem('cib_recipients', JSON.stringify(recipients));
    localStorage.setItem('cib_orders', JSON.stringify(orders));
    localStorage.setItem('cib_expenses', JSON.stringify(expenses));
    localStorage.setItem('cib_packageStock', packageStock);

    let pkgCostEl = document.getElementById('settingsPackageCost');
    if(pkgCostEl) {
        localStorage.setItem('cib_unitPackageCost', pkgCostEl.value);
    }
    let usdEl = document.getElementById('usdRate');
    if(usdEl) {
        localStorage.setItem('cib_usdRate', usdEl.value);
        localStorage.setItem('cib_eurRate', document.getElementById('eurRate').value);
        localStorage.setItem('cib_cnyRate', document.getElementById('cnyRate').value);
    }
}

async function syncOrderToSupabase(order) {
    if(!_supabase) return;
    await _supabase.from('orders').upsert({
        id: order.id,
        product_name: order.productName,
        product_note: order.productNote,
        store_platform: order.storePlatform,
        customer: order.customer,
        phone: order.phone,
        recipient: order.recipient,
        order_status: order.orderStatus,
        sell: order.sell,
        paid: order.paid,
        debt: order.debt,
        profit: order.profit,
        item_usd: order.itemUSD,
        cost: order.cost,
        cargo_input: order.cargoInput,
        cargo_currency: order.cargoCurrency,
        date: order.date
    });
}

async function deleteOrderFromSupabase(id) {
    if(!_supabase) return;
    await _supabase.from('orders').delete().eq('id', id);
}

async function syncExpenseToSupabase(expense) {
    if(!_supabase) return;
    await _supabase.from('expenses').upsert({
        id: expense.id,
        category: expense.category,
        title: expense.title,
        amount: expense.amount
    });
}

async function deleteExpenseFromSupabase(id) {
    if(!_supabase) return;
    await _supabase.from('expenses').delete().eq('id', id);
}

async function syncRecipientToSupabase(rec) {
    if(!_supabase) return;
    await _supabase.from('recipients').upsert({
        name: rec.name,
        fin: rec.fin
    });
}

async function deleteRecipientFromSupabase(name) {
    if(!_supabase) return;
    await _supabase.from('recipients').delete().eq('name', name);
}

// --- TƏTBİQİN İDARƏEDİCİ FUNKSİYALARI ---
function switchTab(tab) {
    const dashBtn = document.getElementById('tabDashboardBtn');
    const ordersBtn = document.getElementById('tabOrdersBtn');
    const expensesBtn = document.getElementById('tabExpensesBtn');
    const settingsBtn = document.getElementById('tabSettingsBtn');

    const dashContent = document.getElementById('tabDashboardContent');
    const ordersContent = document.getElementById('tabOrdersContent');
    const expensesContent = document.getElementById('tabExpensesContent');
    const settingsContent = document.getElementById('tabSettingsContent');

    if(!dashBtn) return;

    dashBtn.className = "flex-1 py-2 text-[10px] font-bold rounded-xl text-slate-600 transition-all cursor-pointer";
    ordersBtn.className = "flex-1 py-2 text-[10px] font-bold text-slate-600 rounded-xl transition-all cursor-pointer";
    expensesBtn.className = "flex-1 py-2 text-[10px] font-bold text-slate-600 rounded-xl transition-all cursor-pointer";
    settingsBtn.className = "flex-1 py-2 text-[10px] font-bold text-slate-600 rounded-xl transition-all cursor-pointer";

    dashContent.classList.add('hidden');
    ordersContent.classList.add('hidden');
    expensesContent.classList.add('hidden');
    settingsContent.classList.add('hidden');

    if(tab === 'dashboard') {
        dashBtn.className = "flex-1 py-2 text-[10px] font-bold rounded-xl bg-white text-indigo-600 shadow-sm transition-all cursor-pointer";
        dashContent.classList.remove('hidden');
    } else if(tab === 'orders') {
        ordersBtn.className = "flex-1 py-2 text-[10px] font-bold rounded-xl bg-white text-indigo-600 shadow-sm transition-all cursor-pointer";
        ordersContent.classList.remove('hidden');
        updateOrdersUI();
    } else if(tab === 'expenses') {
        expensesBtn.className = "flex-1 py-2 text-[10px] font-bold rounded-xl bg-white text-indigo-600 shadow-sm transition-all cursor-pointer";
        expensesContent.classList.remove('hidden');
        updateExpensesUI();
    } else if(tab === 'settings') {
        settingsBtn.className = "flex-1 py-2 text-[10px] font-bold rounded-xl bg-white text-indigo-600 shadow-sm transition-all cursor-pointer";
        settingsContent.classList.remove('hidden');
        loadSettingsData();
    }
}

function previewSettingsAvatar(event) {
    let reader = new FileReader();
    reader.onload = function(){
        let avatarData = reader.result;
        if(currentUser) {
            currentUser.avatar = avatarData;
            localStorage.setItem('cib_currentUser', JSON.stringify(currentUser));
            updateHeaderAvatar();
            loadSettingsAvatarUI();
        }
    }
    if(event.target.files[0]) reader.readAsDataURL(event.target.files[0]);
}

function removeAvatar() {
    if(currentUser) {
        currentUser.avatar = "";
        localStorage.setItem('cib_currentUser', JSON.stringify(currentUser));
        updateHeaderAvatar();
        loadSettingsAvatarUI();
        showToast("Profil şəkli silindi!");
    }
}

function updateHeaderAvatar() {
    if(!currentUser) return;
    let imgEl = document.getElementById('appUserAvatarImg');
    let initialEl = document.getElementById('appUserInitial');

    if(currentUser.avatar) {
        if(imgEl) { imgEl.src = currentUser.avatar; imgEl.classList.remove('hidden'); }
        if(initialEl) { initialEl.classList.add('hidden'); }
    } else {
        if(imgEl) { imgEl.src = ""; imgEl.classList.add('hidden'); }
        if(initialEl) { initialEl.innerText = (currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "O"); initialEl.classList.remove('hidden'); }
    }
}

function loadSettingsAvatarUI() {
    if(!currentUser) return;
    let preview = document.getElementById('settingsAvatarPreview');
    let placeholder = document.getElementById('settingsAvatarPlaceholder');
    let removeBtn = document.getElementById('removeAvatarBtn');

    if(currentUser.avatar) {
        if(preview) { preview.src = currentUser.avatar; preview.classList.remove('hidden'); }
        if(placeholder) placeholder.classList.add('hidden');
        if(removeBtn) removeBtn.classList.remove('hidden');
    } else {
        if(preview) { preview.src = ""; preview.classList.add('hidden'); }
        if(placeholder) placeholder.classList.remove('hidden');
        if(removeBtn) removeBtn.classList.add('hidden');
    }
}

function sendSMSCode() {
    let phoneInputEl = document.getElementById('inputPhone');
    if(!phoneInputEl) return;
    
    let phoneInput = phoneInputEl.value.trim();
    let phoneRegex = /^\d{9}$/;
    
    if(!phoneRegex.test(phoneInput)) {
        alert("Mobil nömrə yalnız rəqəmlərdən ibarət olmalı və tam 9 rəqəm olmalıdır! (Məs: xx xxx xx xx)");
        return;
    }
    
    tempPhone = "+994 " + phoneInput;
    document.getElementById('phoneLoginForm').classList.add('hidden');
    document.getElementById('smsVerifyForm').classList.remove('hidden');
    showToast("Təsdiq kodu nömrənizə göndərildi!");
}

function verifySMSCode() {
    let codeInput = document.getElementById('inputSmsCode').value.trim();
    if(codeInput === demoSmsCode) {
        let userObj = {
            name: "Orxan",
            surname: "Cəfərli",
            companyName: "Stockchafarli",
            phone: tempPhone,
            avatar: ""
        };
        localStorage.setItem('cib_currentUser', JSON.stringify(userObj));
        currentUser = userObj;
        checkAuth();
        showToast("Uğurla daxil olundu!");
    } else {
        alert("Yanlış təsdiq kodu! (Demo üçün: 1234 yazın)");
    }
}

function backToPhoneInput() {
    document.getElementById('smsVerifyForm').classList.add('hidden');
    document.getElementById('phoneLoginForm').classList.remove('hidden');
}

function handleLogout() {
    localStorage.removeItem('cib_currentUser');
    currentUser = null;
    checkAuth();
}

function checkAuth() {
    const authScreen = document.getElementById('authScreen');
    const appScreen = document.getElementById('appScreen');
    if(!authScreen) return;

    if (currentUser) {
        authScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        
        let greetingEl = document.getElementById('userGreeting');
        if(greetingEl) greetingEl.innerText = (currentUser.name || "") + " " + (currentUser.surname || "");
        
        let compEl = document.getElementById('userCompanyInfo');
        if(compEl) {
            if(currentUser.companyName) {
                compEl.innerText = currentUser.companyName;
                compEl.classList.remove('hidden');
            } else {
                compEl.classList.add('hidden');
            }
        }
        
        let contactEl = document.getElementById('userContactInfo');
        if(contactEl) contactEl.innerText = currentUser.phone || "";
        
        updateHeaderAvatar();
        loadSavedRates();
        loadDataFromSupabase();
    } else {
        authScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
    }
}

function loadSettingsData() {
    if(currentUser) {
        document.getElementById('settingsName').value = currentUser.name || '';
        document.getElementById('settingsSurname').value = currentUser.surname || '';
        document.getElementById('settingsCompanyName').value = currentUser.companyName || '';
        document.getElementById('settingsPhone').value = (currentUser.phone || '').replace('+994 ', '').trim();
    }
    let pkgCostEl = document.getElementById('settingsPackageCost');
    if(pkgCostEl && localStorage.getItem('cib_unitPackageCost')) {
        pkgCostEl.value = localStorage.getItem('cib_unitPackageCost');
    }
    let pkgStockEl = document.getElementById('settingsPackageStock');
    if(pkgStockEl) pkgStockEl.value = packageStock;
    
    loadSettingsAvatarUI();
    updateSettingsRecipientsList();
}

function saveProfileSettings() {
    let nameVal = document.getElementById('settingsName').value.trim();
    let surnameVal = document.getElementById('settingsSurname').value.trim();
    let nameRegex = /^[A-Za-zƏəİiÖöÜüĞğŞşÇç\s]+$/;

    if(!nameRegex.test(nameVal) || !nameRegex.test(surnameVal)) {
        alert("Ad və Soyad sahəsində yalnız hərflər istifadə oluna bilər!");
        return;
    }

    let phoneClean = document.getElementById('settingsPhone').value.trim();
    let phoneRegex = /^\d{9}$/;
    if(!phoneRegex.test(phoneClean)) {
        alert("Telefon nömrəsi yalnız rəqəmlərdən ibarət olmalı və tam 9 rəqəm olmalıdır!");
        return;
    }

    currentUser.name = nameVal;
    currentUser.surname = surnameVal;
    currentUser.companyName = document.getElementById('settingsCompanyName').value.trim();
    currentUser.phone = "+994 " + phoneClean;

    localStorage.setItem('cib_currentUser', JSON.stringify(currentUser));
    checkAuth();
    showToast("Profil məlumatları yeniləndi!");
}

function savePackageStock() {
    packageStock = parseInt(document.getElementById('settingsPackageStock').value) || 0;
    localStorage.setItem('cib_packageStock', packageStock);
    let pkgCost = document.getElementById('settingsPackageCost').value;
    localStorage.setItem('cib_unitPackageCost', pkgCost);
    showToast("Paket ehtiyatı yeniləndi!");
    updateAll();
}

function loadSavedRates() {
    let pkgCost = localStorage.getItem('cib_unitPackageCost') || "0.15";
    let pkgCostEl = document.getElementById('settingsPackageCost');
    if(pkgCostEl) pkgCostEl.value = pkgCost;
    
    let usdEl = document.getElementById('usdRate');
    if(localStorage.getItem('cib_usdRate') && usdEl) {
        usdEl.value = localStorage.getItem('cib_usdRate');
        document.getElementById('eurRate').value = localStorage.getItem('cib_eurRate');
        document.getElementById('cnyRate').value = localStorage.getItem('cib_cnyRate');
    }
}

function openCustomsModal() {
    document.getElementById('trackerModal').classList.toggle('hidden');
    updateAll();
}

function getRates() {
    return {
        USD: document.getElementById('usdRate') ? (parseFloat(document.getElementById('usdRate').value) || 1.70) : 1.70,
        EUR: document.getElementById('eurRate') ? (parseFloat(document.getElementById('eurRate').value) || 1.85) : 1.85,
        CNY: document.getElementById('cnyRate') ? (parseFloat(document.getElementById('cnyRate').value) || 0.24) : 0.24,
        AZN: 1.0
    };
}

function updateRecipientSelect() {
    const select = document.getElementById('recipientSelect');
    const filterSelect = document.getElementById('filterRecipient');
    if(!select) return;
    
    let currentSelected = select.value;
    let currentFilter = filterSelect ? filterSelect.value : '';

    select.innerHTML = '';
    if(filterSelect) filterSelect.innerHTML = '<option value="">Gömrük Şəxsi</option>';

    recipients.forEach(r => {
        let fullName = `${r.name} (${r.fin})`;
        select.innerHTML += `<option value="${r.name}">${fullName}</option>`;
        if(filterSelect) filterSelect.innerHTML += `<option value="${r.name}">${r.name}</option>`;
    });

    if(currentSelected) select.value = currentSelected;
    if(currentFilter && filterSelect) filterSelect.value = currentFilter;
}

async function addRecipientFromSettings() {
    let nameInput = document.getElementById('settingsNewRecipientName');
    let finInput = document.getElementById('settingsNewRecipientFin');
    
    let name = nameInput.value.trim();
    let fin = finInput.value.trim().toUpperCase();

    if(!name) { alert("Zəhmət olmasa adı daxil edin!"); return; }
    if(!fin) { alert("Zəhmət olmasa FİN kodu daxil edin!"); return; }

    let newRec = { name, fin };
    recipients.push(newRec);
    await syncRecipientToSupabase(newRec);

    nameInput.value = '';
    finInput.value = '';
    saveData();
    updateAll();
    updateSettingsRecipientsList();
    showToast("Yeni gömrük şəxsi əlavə olundu!");
}

async function removeRecipient(name) {
    if(recipients.length <= 1) { alert("Ən azı 1 gömrük adamı qalmalıdır!"); return; }
    recipients = recipients.filter(r => r.name !== name);
    await deleteRecipientFromSupabase(name);
    saveData();
    updateAll();
    updateSettingsRecipientsList();
}

function updateSettingsRecipientsList() {
    let container = document.getElementById('settingsRecipientsList');
    if(!container) return;
    container.innerHTML = '';
    recipients.forEach(r => {
        container.innerHTML += `
            <div class="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium">
                <div>
                    <div class="font-bold text-slate-800">👤 ${r.name}</div>
                    <div class="text-[10px] text-indigo-600 font-mono">FİN: ${r.fin}</div>
                </div>
                <button onclick="removeRecipient('${r.name}')" class="text-rose-600 font-bold hover:underline cursor-pointer">Sil</button>
            </div>
        `;
    });
}

function updateRecipientsUI() {
    const container = document.getElementById('recipientsList');
    if(!container) return;
    container.innerHTML = '';
    
    let now = new Date();
    let currentYearMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

    recipients.forEach(r => {
        let recipientOrders = orders.filter(o => o.recipient === r.name && o.date && o.date.startsWith(currentYearMonth) && o.orderStatus !== 'Sifariş gözləyir');
        let usedUSD = recipientOrders.reduce((sum, o) => sum + (o.itemUSD || 0), 0);
        let countOrders = recipientOrders.length;
        let remainingUSD = 300 - usedUSD;
        let isCritical = remainingUSD < 50;

        container.innerHTML += `
            <div class="bg-slate-800 p-3 rounded-xl border ${isCritical ? 'border-rose-500/50' : 'border-slate-700'} space-y-1">
                <div class="flex justify-between items-center text-sm font-bold">
                    <span>👤 ${r.name} <span class="text-[10px] text-indigo-400 font-mono">(${r.fin})</span></span>
                    <span class="${isCritical ? 'text-rose-400' : 'text-emerald-400'} text-xs">$${remainingUSD.toFixed(1)} qaldı</span>
                </div>
                <div class="text-[10px] text-slate-400 flex justify-between">
                    <span>Bağlamalar: ${countOrders} ədəd</span>
                    <span>İstifadə: $${usedUSD.toFixed(1)} / $300</span>
                </div>
            </div>
        `;
    });
}

function getCargoAZN() {
    const rates = getRates();
    let cargoInput = parseFloat(document.getElementById('cargoFee').value) || 0;
    let currency = document.getElementById('cargoCurrency').value;
    return cargoInput * rates[currency];
}

function calculateProfit() {
    let sell = parseFloat(document.getElementById('sellPrice').value) || 0;
    let paid = parseFloat(document.getElementById('paidAmount').value) || 0;
    let cost = parseFloat(document.getElementById('costPrice').value) || 0;
    let cargoAZN = getCargoAZN();
    let unitPackage = parseFloat(localStorage.getItem('cib_unitPackageCost')) || 0.15;
    let status = document.getElementById('orderStatus').value;

    let debt = sell - paid;
    let profit = (status === 'Sifariş gözləyir') ? (sell - cost) : (sell - cost - cargoAZN - unitPackage);

    document.getElementById('liveDebt').innerText = debt.toFixed(2) + " AZN";
    let profitEl = document.getElementById('liveProfit');
    profitEl.innerText = profit.toFixed(2) + " AZN";
    profitEl.className = profit >= 0 ? "text-sm font-bold text-emerald-700" : "text-sm font-bold text-rose-600";
}

async function addExpense() {
    let category = document.getElementById('expenseCategory').value;
    let title = document.getElementById('expenseTitle').value.trim();
    let amount = parseFloat(document.getElementById('expenseAmount').value) || 0;
    if(!title || amount <= 0) { alert("Xərc adını və məbləğ daxil edin!"); return; }

    let newExp = { id: Date.now(), category, title, amount };
    expenses.unshift(newExp);
    await syncExpenseToSupabase(newExp);

    document.getElementById('expenseTitle').value = '';
    document.getElementById('expenseAmount').value = '';
    saveData();
    updateAll();
    showToast("Xərc qeydə alındı!");
}

async function addPackageExpensePrompt() {
    let cost = (parseFloat(localStorage.getItem('cib_unitPackageCost')) || 0.15) * 50;
    let newExp = { id: Date.now(), category: "📦 Qablaşdırma", title: "Paket ehtiyatının yenilənməsi (50 ədəd)", amount: cost };
    expenses.unshift(newExp);
    await syncExpenseToSupabase(newExp);

    packageStock += 50;
    saveData();
    updateAll();
    showToast("Paket xərci qeydə alındı və ehtiyat artırıldı!");
}

async function deleteExpense(id) {
    expenses = expenses.filter(e => e.id !== id);
    await deleteExpenseFromSupabase(id);
    saveData();
    updateAll();
    showToast("Xərc silindi!");
}

function updateExpensesUI() {
    const container = document.getElementById('expensesFullListContainer');
    if(!container) return;
    
    let totalExp = expenses.reduce((sum, e) => sum + e.amount, 0);
    document.getElementById('expensesTotalBadge').innerText = "Cəmi: " + totalExp.toFixed(2) + " ₼";

    if(expenses.length === 0) {
        container.innerHTML = '<p class="text-slate-400 italic">Hələ xərc yoxdur.</p>';
        return;
    }
    container.innerHTML = '';
    expenses.forEach(e => {
        container.innerHTML += `
            <div class="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div>
                    <div class="font-bold text-slate-800">${e.title}</div>
                    <div class="text-[10px] text-indigo-600 font-semibold">${e.category}</div>
                </div>
                <div class="flex items-center gap-2">
                    <span class="font-bold text-amber-600">${e.amount.toFixed(2)} ₼</span>
                    <button onclick="deleteExpense(${e.id})" class="text-rose-500 font-bold hover:underline cursor-pointer">&times;</button>
                </div>
            </div>
        `;
    });
}

async function saveOrder(event) {
    event.preventDefault();
    
    let phoneInput = document.getElementById('customerPhone').value.trim();
    let phoneRegex = /^\d{9}$/;
    if(!phoneRegex.test(phoneInput)) {
        alert("Müştəri nömrəsi yalnız rəqəmlərdən ibarət olmalı və tam 9 rəqəm olmalıdır! (Məs: 501234567)");
        return;
    }
    let phone = "+994 " + phoneInput;

    const rates = getRates();
    let editId = document.getElementById('editOrderId').value;
    let productName = document.getElementById('productName').value;
    let productNote = document.getElementById('productNote').value.trim();
    let storePlatform = document.getElementById('storePlatform').value.trim();
    let customer = document.getElementById('customerName').value;
    let recipient = document.getElementById('recipientSelect').value;
    let orderStatus = document.getElementById('orderStatus').value;

    let sell = parseFloat(document.getElementById('sellPrice').value) || 0;
    let paid = parseFloat(document.getElementById('paidAmount').value) || 0;
    let cost = parseFloat(document.getElementById('costPrice').value) || 0;
    let cargoInput = parseFloat(document.getElementById('cargoFee').value) || 0;
    let cargoCurrency = document.getElementById('cargoCurrency').value;

    let cargoAZN = getCargoAZN();
    let profit = (orderStatus === 'Sifariş gözləyir') ? (sell - cost) : (sell - cost - cargoAZN - (parseFloat(localStorage.getItem('cib_unitPackageCost')) || 0.15));
    let debt = sell - paid;
    let itemUSD = (orderStatus === 'Sifariş gözləyir') ? 0 : ((cost + cargoAZN) / rates.USD);

    let now = new Date();
    let dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

    let targetOrder;
    if (editId) {
        let index = orders.findIndex(o => o.id === editId);
        if (index !== -1) {
            let oldStatus = orders[index].orderStatus;
            if(oldStatus === 'Sifariş gözləyir' && orderStatus !== 'Sifariş gözləyir') {
                packageStock = Math.max(0, packageStock - 1);
            }
            orders[index] = { ...orders[index], productName, productNote, storePlatform, customer, phone, recipient, orderStatus, sell, paid, debt, profit, itemUSD, cost, cargoInput, cargoCurrency };
            targetOrder = orders[index];
        }
        showToast("Sifariş yeniləndi!");
        resetOrderForm();
    } else {
        let id = '#ORD-' + String(orders.length + 1).padStart(4, '0');
        if(orderStatus !== 'Sifariş gözləyir') {
            packageStock = Math.max(0, packageStock - 1);
        }
        targetOrder = { id, productName, productNote, storePlatform, customer, phone, recipient, orderStatus, sell, paid, debt, profit, itemUSD, cost, cargoInput, cargoCurrency, date: dateStr };
        orders.unshift(targetOrder);
        showToast("Sifariş yadda saxlanıldı!");
        document.getElementById('orderForm').reset();
    }

    await syncOrderToSupabase(targetOrder);
    saveData();
    updateAll();
    document.getElementById('liveProfit').innerText = "0.00 AZN";
    document.getElementById('liveDebt').innerText = "0.00 AZN";
}

function editOrder(id) {
    let o = orders.find(x => x.id === id);
    if(!o) return;

    switchTab('dashboard');
    document.getElementById('editOrderId').value = o.id;
    document.getElementById('productName').value = o.productName;
    document.getElementById('productNote').value = o.productNote || '';
    document.getElementById('storePlatform').value = o.storePlatform || '';
    document.getElementById('customerName').value = o.customer;
    document.getElementById('customerPhone').value = (o.phone || '').replace('+994 ', '').trim();
    document.getElementById('recipientSelect').value = o.recipient;
    document.getElementById('orderStatus').value = o.orderStatus || 'Sifariş gözləyir';
    document.getElementById('sellPrice').value = o.sell;
    document.getElementById('paidAmount').value = o.paid;
    document.getElementById('costPrice').value = o.cost || 0;
    document.getElementById('cargoFee').value = o.cargoInput;
    document.getElementById('cargoCurrency').value = o.cargoCurrency;

    document.getElementById('formTitleText').innerText = "✏️ Düzəliş Et (" + o.id + ")";
    document.getElementById('submitOrderBtn').innerText = "Dəyişikliyi Saxla";
    document.getElementById('cancelEditBtn').classList.remove('hidden');
    calculateProfit();
}

async function deleteOrder(id) {
    if(confirm("Bu sifarişi silmək istədiyinizə əminsinizmi?")) {
        let o = orders.find(x => x.id === id);
        if(o && o.orderStatus !== 'Sifariş gözləyir') {
            packageStock += 1;
        }
        orders = orders.filter(x => x.id !== id);
        await deleteOrderFromSupabase(id);
        saveData();
        updateAll();
        showToast("Sifariş silindi!");
    }
}

function resetOrderForm() {
    let form = document.getElementById('orderForm');
    if(form) form.reset();
    document.getElementById('editOrderId').value = '';
    document.getElementById('formTitleText').innerText = "➕ Yeni Sifariş";
    document.getElementById('submitOrderBtn').innerText = "Sifarişi Yadda Saxla";
    document.getElementById('cancelEditBtn').classList.add('hidden');
    updateNextIdPreview();
    document.getElementById('liveProfit').innerText = "0.00 AZN";
    document.getElementById('liveDebt').innerText = "0.00 AZN";
}

function updateStatistics() {
    let now = new Date();
    let currentYM = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    
    let prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    let prevYM = prevDate.getFullYear() + '-' + String(prevDate.getMonth() + 1).padStart(2, '0');

    let currentTurnover = 0;
    let currentGrossProfit = 0;
    let prevTurnover = 0;
    let prevGrossProfit = 0;

    let totalCost = orders.reduce((sum, o) => sum + (o.cost || 0), 0);
    let totalDebt = orders.reduce((sum, o) => sum + o.debt, 0);
    let totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    orders.forEach(o => {
        if(o.orderStatus !== 'Sifariş gözləyir') {
            if(o.date && o.date.startsWith(currentYM)) {
                currentTurnover += o.sell;
                currentGrossProfit += o.profit;
            } else if(o.date && o.date.startsWith(prevYM)) {
                prevTurnover += o.sell;
                prevGrossProfit += o.profit;
            }
        }
    });

    let netProfit = orders.reduce((sum, o) => sum + (o.orderStatus !== 'Sifariş gözləyir' ? o.profit : 0), 0) - totalExpenses;

    let elTurnover = document.getElementById('statTotalTurnover');
    let elNetProfit = document.getElementById('statNetProfit');
    let elTotalCost = document.getElementById('statTotalCost');
    let elTotalDebt = document.getElementById('statTotalDebt');
    let elTotalExpenses = document.getElementById('statTotalExpenses');

    if(elTurnover) elTurnover.innerText = currentTurnover.toFixed(2) + " ₼";
    if(elNetProfit) elNetProfit.innerText = netProfit.toFixed(2) + " ₼";
    if(elTotalCost) elTotalCost.innerText = totalCost.toFixed(2) + " ₼";
    if(elTotalDebt) elTotalDebt.innerText = totalDebt.toFixed(2) + " ₼";
    if(elTotalExpenses) elTotalExpenses.innerText = totalExpenses.toFixed(2) + " ₼";

    let turnoverDiff = prevTurnover === 0 ? (currentTurnover > 0 ? 100 : 0) : ((currentTurnover - prevTurnover) / prevTurnover) * 100;
    let tBadge = document.getElementById('statTurnoverBadge');
    if(tBadge) {
        tBadge.innerText = (turnoverDiff >= 0 ? "+" : "") + turnoverDiff.toFixed(1) + "% keçən aya nisbətən";
        tBadge.className = turnoverDiff >= 0 ? "text-[10px] text-emerald-600 font-bold" : "text-[10px] text-rose-600 font-bold";
    }

    let countBadge = document.getElementById('ordersCountBadge');
    let sumBadge = document.getElementById('ordersTotalSumBadge');
    let profitBadge = document.getElementById('ordersNetProfitBadge');

    if(countBadge) countBadge.innerText = orders.length;
    if(sumBadge) sumBadge.innerText = currentTurnover.toFixed(2) + " ₼";
    if(profitBadge) profitBadge.innerText = netProfit.toFixed(2) + " ₼";

    let warningBanner = document.getElementById('packageWarningBanner');
    if(warningBanner) {
        if(packageStock <= 10) {
            document.getElementById('warningPackageCount').innerText = packageStock;
            warningBanner.classList.remove('hidden');
        } else {
            warningBanner.classList.add('hidden');
        }
    }
}

function updateOrdersUI() {
    const container = document.getElementById('ordersList');
    if(!container) return;

    let filterStatus = document.getElementById('filterStatus').value;
    let filterRecipient = document.getElementById('filterRecipient').value;
    let filterDate = document.getElementById('filterDate').value;
    let searchQuery = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toLowerCase().trim() : "";

    let filtered = orders.filter(o => {
        let matchStatus = filterStatus ? (o.orderStatus || 'Sifariş gözləyir') === filterStatus : true;
        let matchRec = filterRecipient ? o.recipient === filterRecipient : true;
        let matchDate = filterDate ? o.date === filterDate : true;
        
        let matchSearch = true;
        if(searchQuery) {
            let custName = (o.customer || "").toLowerCase();
            let custPhone = (o.phone || "").toLowerCase();
            let prodName = (o.productName || "").toLowerCase();
            matchSearch = custName.includes(searchQuery) || custPhone.includes(searchQuery) || prodName.includes(searchQuery);
        }

        return matchStatus && matchRec && matchDate && matchSearch;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-slate-400 italic">Sifariş tapılmadı.</p>';
        return;
    }

    container.innerHTML = '';
    filtered.forEach(o => {
        let statusVal = o.orderStatus || 'Sifariş gözləyir';
        let statusColor = statusVal === 'Təhvil verildi' ? 'bg-emerald-50 text-emerald-700' : (statusVal === 'Anbarda' ? 'bg-indigo-50 text-indigo-700' : (statusVal === 'Sifariş olundu / Yolda' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'));
        
        let cleanPhoneDigits = (o.phone || '').replace(/\D/g, '');
        let waText = encodeURIComponent(`${o.customer} xanım, zəhmət olmasa sifarişiniz etdiyiniz məhsulun qalıq ödənişini (${o.debt.toFixed(2)} AZN) edəsiniz.Təşəkkür edirik!`);
        let debtBadge = o.debt > 0 
            ? `<a href="https://wa.me/${cleanPhoneDigits}?text=${waText}" target="_blank" class="text-[9px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded font-bold hover:bg-rose-100 cursor-pointer" title="WhatsApp ilə borc xatırlat">💬 Borc: ${o.debt.toFixed(2)} ₼</a>` 
            : `<span class="text-[9px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-bold">Ödənilib</span>`;
        
        let noteHtml = o.productNote ? `<div class="text-[10px] text-slate-500 italic">📌 ${o.productNote}</div>` : '';
        let storeHtml = o.storePlatform ? `<span class="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-medium">🏪 ${o.storePlatform}</span>` : '';

        let recObj = recipients.find(r => r.name === o.recipient);
        let recFinStr = recObj ? ` (${recObj.fin})` : '';

        container.innerHTML += `
            <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 flex justify-between items-center">
                <div class="space-y-1">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">${o.id}</span>
                        <span class="font-bold text-slate-800">${o.productName}</span>
                        <span class="text-[9px] ${statusColor} px-1.5 py-0.5 rounded font-bold">${statusVal}</span>
                        ${debtBadge}
                        ${storeHtml}
                    </div>
                    ${noteHtml}
                    <div class="text-[11px] text-slate-500">${o.customer} (${o.phone}) • <span class="text-[10px] text-slate-400">${o.date || ''}</span></div>
                    <div class="text-[10px] text-indigo-600 font-medium">Alan: ${o.recipient} <span class="text-[9px] text-slate-400 font-mono">${recFinStr}</span></div>
                </div>
                <div class="flex items-center gap-2">
                    <div class="text-right">
                        <span class="font-bold text-emerald-600 text-sm">+${o.profit.toFixed(2)} ₼</span>
                        <div class="text-[10px] text-slate-400">Satış: ${o.sell} ₼</div>
                    </div>
                    <button onclick="editOrder('${o.id}')" class="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold hover:bg-indigo-100 cursor-pointer" title="Düzəliş et">✏️</button>
                    <button onclick="deleteOrder('${o.id}')" class="px-2 py-1 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-bold hover:bg-rose-100 cursor-pointer" title="Sil">🗑️</button>
                </div>
            </div>
        `;
    });
}

function resetFilters() {
    let statusEl = document.getElementById('filterStatus');
    let recEl = document.getElementById('filterRecipient');
    let dateEl = document.getElementById('filterDate');
    let searchEl = document.getElementById('searchInput');
    if(statusEl) statusEl.value = '';
    if(recEl) recEl.value = '';
    if(dateEl) dateEl.value = '';
    if(searchEl) searchEl.value = '';
    updateOrdersUI();
}

function exportBackupData() {
    let backupObj = {
        currentUser,
        recipients,
        orders,
        expenses,
        packageStock,
        version: "1.0",
        date: new Date().toISOString()
    };
    let blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = 'Balansist_Backup_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("Ehtiyat nüsxə uğurla endirildi!");
}

function importBackupData(event) {
    let file = event.target.files[0];
    if(!file) return;
    let reader = new FileReader();
    reader.onload = async function(e) {
        try {
            let data = JSON.parse(e.target.result);
            if(data.orders && data.expenses) {
                orders = data.orders;
                expenses = data.expenses;
                recipients = data.recipients || recipients;
                packageStock = data.packageStock !== undefined ? data.packageStock : packageStock;
                if(data.currentUser) {
                    currentUser = data.currentUser;
                    localStorage.setItem('cib_currentUser', JSON.stringify(currentUser));
                }
                saveData();
                checkAuth();
                showToast("Məlumatlar uğurla bərpa olundu!");
            } else {
                alert("Fayl formatı düzgün deyil!");
            }
        } catch(err) {
            alert("JSON faylını oxuyarkən xəta baş verdi!");
        }
    };
    reader.readAsText(file);
}

function exportToCSV() {
    if(orders.length === 0 && expenses.length === 0) { 
        alert("İxrac ediləcək məlumat yoxdur!"); 
        return; 
    }

    let totalTurnover = 0;
    let totalPaid = 0;
    let totalDebt = 0;
    let totalProfit = 0;
    let totalCostAll = orders.reduce((sum, o) => sum + (o.cost || 0), 0);
    let totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    let ordersRows = "";
    orders.forEach(o => {
        let activeSell = o.orderStatus !== 'Sifariş gözləyir' ? o.sell : 0;
        let activeProfit = o.orderStatus !== 'Sifariş gözləyir' ? o.profit : 0;
        totalTurnover += activeSell;
        totalPaid += o.paid || 0;
        totalDebt += o.debt || 0;
        totalProfit += activeProfit;

        let recObj = recipients.find(r => r.name === o.recipient);
        let recFinStr = recObj ? ` (${recObj.fin})` : '';

        ordersRows += `
            <tr>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${o.id}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${o.date || ''}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;">${o.orderStatus || 'Sifariş gözləyir'}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${o.storePlatform || ''}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${o.productName} ${o.productNote ? '('+o.productNote+')' : ''}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${o.customer} (${o.phone})</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${o.recipient}${recFinStr}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">${o.sell} ₼</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">${o.paid} ₼</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; color: #b91c1c;">${o.debt} ₼</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; color: #15803d; font-weight: bold;">+${o.profit.toFixed(2)} ₼</td>
            </tr>
        `;
    });

    let expensesRows = "";
    expenses.forEach(e => {
        expensesRows += `
            <tr>
                <td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold; color: #4338ca;">${e.category}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px;">${e.title}</td>
                <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; color: #b45309; font-weight: bold;">${e.amount.toFixed(2)} ₼</td>
            </tr>
        `;
    });

    let finalNetProfit = totalProfit - totalExpenses;

    let excelContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
        <meta charset="UTF-8">
        <!--[if gte mso 9]>
        <xml>
            <x:ExcelWorkbook>
                <x:ExcelWorksheets>
                    <x:ExcelWorksheet>
                        <x:Name>Balansist Hesabat</x:Name>
                        <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
                    </x:ExcelWorksheet>
                </x:ExcelWorksheets>
            </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
            body { font-family: Arial, sans-serif; color: #1e293b; }
            .title { font-size: 18px; font-weight: bold; color: #4f46e5; margin-bottom: 5px; }
            .subtitle { font-size: 12px; color: #64748b; margin-bottom: 15px; }
            th { background-color: #4f46e5; color: #ffffff; font-weight: bold; text-align: left; padding: 8px; border: 1px solid #3730a3; }
            td { padding: 6px; font-size: 11px; }
            .section-header { font-size: 14px; font-weight: bold; color: #1e293b; margin-top: 20px; margin-bottom: 8px; background-color: #e2e8f0; padding: 6px; }
        </style>
    </head>
    <body>
        <table>
            <tr><td colspan="4" class="title">BALANSİST - RƏSMİ BİZNES HESABATI</td></tr>
            <tr><td colspan="4" class="subtitle">İstifadəçi: ${currentUser ? currentUser.name + ' ' + currentUser.surname : 'Orxan Cəfərli'} | Şirkət: ${currentUser && currentUser.companyName ? currentUser.companyName : 'Stockchafarli'} | Tarix: ${new Date().toLocaleDateString('az-AZ')}</td></tr>
        </table>

        <div class="section-header">1. SİFARİŞLƏR VƏ SATIŞLAR</div>
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Tarix</th>
                    <th>Status</th>
                    <th>Mağaza / Platforma</th>
                    <th>Məhsul və Detal</th>
                    <th>Müştəri</th>
                    <th>Alan</th>
                    <th>Satış</th>
                    <th>Beh</th>
                    <th>Borc</th>
                    <th>Mənfəət</th>
                </tr>
            </thead>
            <tbody>
                ${ordersRows}
            </tbody>
        </table>

        <div class="section-header">2. BİZNES XƏRCLƏRİ</div>
        <table>
            <thead>
                <tr>
                    <th>Kateqoriya</th>
                    <th>Xərcin Adı</th>
                    <th>Məbləğ</th>
                </tr>
            </thead>
            <tbody>
                ${expensesRows}
            </tbody>
        </table>

        <div class="section-header">3. YEKUN MALİYYƏ XÜLASƏSİ</div>
        <table style="width: 400px; border-collapse: collapse;">
            <tr><td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;">Ümumi Dövriyyə:</td><td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">${totalTurnover.toFixed(2)} ₼</td></tr>
            <tr><td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;">Ümumi Maya:</td><td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">${totalCostAll.toFixed(2)} ₼</td></tr>
            <tr><td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;">Ümumi Xərclər:</td><td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">${totalExpenses.toFixed(2)} ₼</td></tr>
            <tr><td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold;">Qalıq Borc:</td><td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; color: #b91c1c;">${totalDebt.toFixed(2)} ₼</td></tr>
            <tr><td style="border: 1px solid #cbd5e1; padding: 6px; font-weight: bold; background-color: #0f172a; color: #4ade80;">XALİS MƏNFƏƏT:</td><td style="border: 1px solid #cbd5e1; padding: 6px; text-align: right; font-weight: bold; background-color: #0f172a; color: #4ade80;">${finalNetProfit.toFixed(2)} ₼</td></tr>
        </table>
    </body>
    </html>
    `;

    let blob = new Blob(['\ufeff' + excelContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = 'Balansist_Hesabat.xls';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    showToast("Excel hesabat blankı uğurla endirildi!");
}

function updateNextIdPreview() {
    let previewEl = document.getElementById('nextIdPreview');
    if(previewEl && !document.getElementById('editOrderId').value) {
        previewEl.innerText = '#ORD-' + String(orders.length + 1).padStart(4, '0');
    }
}

function updateAll() {
    updateRecipientSelect();
    updateRecipientsUI();
    updateExpensesUI();
    let ordersContent = document.getElementById('tabOrdersContent');
    if(ordersContent && !ordersContent.classList.contains('hidden')) {
        updateOrdersUI();
    }
    updateStatistics();
    updateNextIdPreview();
}

checkAuth();
