// Supabase Qoşulması
const SUPABASE_URL = "BURAYA_SUPABASE_URL_YAZ"; 
const SUPABASE_ANON_KEY = "BURAYA_SUPABASE_ANON_KEY_YAZ";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentAuthMode = 'login'; // login, register, forgot

document.addEventListener("DOMContentLoaded", async () => {
    // Sessiyanı yoxla (Remember Me məntiqi ilə)
    const { data: { session } } = await _supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        showAppScreen();
    } else {
        showAuthScreen();
    }
});

// Auth rejimlərini idarə etmək (Giriş / Qeydiyyat / Şifrə bərpası)
function switchAuthMode(mode) {
    currentAuthMode = mode;
    const nameFields = document.getElementById("nameFields");
    const rememberMeContainer = document.getElementById("rememberMeContainer");
    const submitBtn = document.getElementById("authSubmitBtn");
    const subtitle = document.getElementById("authSubtitle");
    const switchText = document.getElementById("authSwitchText");
    const socialSection = document.getElementById("socialLoginSection");

    if (mode === 'register') {
        nameFields.classList.remove('hidden');
        rememberMeContainer.classList.add('hidden');
        submitBtn.innerText = "Qeydiyyatdan Keç";
        subtitle.innerText = "Yeni hesab yaradın";
        switchText.innerHTML = `Hesabınız var? <button type="button" onclick="switchAuthMode('login')" class="text-indigo-600 font-bold hover:underline">Daxil ol</button>`;
        socialSection.classList.add('hidden');
    } else if (mode === 'login') {
        nameFields.classList.add('hidden');
        rememberMeContainer.classList.remove('hidden');
        submitBtn.innerText = "Daxil Ol";
        subtitle.innerText = "Biznesinizi buludda idarə edin";
        switchText.innerHTML = `Hesabınız yoxdur? <button type="button" onclick="switchAuthMode('register')" class="text-indigo-600 font-bold hover:underline">Qeydiyyatdan keç</button>`;
        socialSection.classList.remove('hidden');
    } else if (mode === 'forgot') {
        nameFields.classList.add('hidden');
        rememberMeContainer.classList.add('hidden');
        submitBtn.innerText = "Şifrəni Bərpa Et Linki Göndər";
        subtitle.innerText = "E-poçtunuza sıfırlama linki göndəriləcək";
        switchText.innerHTML = `<button type="button" onclick="switchAuthMode('login')" class="text-indigo-600 font-bold hover:underline">Girişə qayıt</button>`;
        socialSection.classList.add('hidden');
    }
}

// Form submit edildikdə
async function handleAuthSubmit(e) {
    e.preventDefault();
    const email = document.getElementById("authEmail").value;
    const password = document.getElementById("authPassword").value;

    if (currentAuthMode === 'login') {
        const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
        if (error) {
            showToast("Xəta: " + error.message);
        } else {
            currentUser = data.user;
            showAppScreen();
            showToast("Uğurla daxil olundu!");
        }
    } else if (currentAuthMode === 'register') {
        const name = document.getElementById("regName").value;
        const surname = document.getElementById("regSurname").value;
        const { data, error } = await _supabase.auth.signUp({
            email,
            password,
            options: { data: { first_name: name, last_name: surname } }
        });
        if (error) {
            showToast("Xəta: " + error.message);
        } else {
            showToast("Qeydiyyat tamamlandı! E-poçtunuzu yoxlayın.");
            switchAuthMode('login');
        }
    } else if (currentAuthMode === 'forgot') {
        const { error } = await _supabase.auth.resetPasswordForEmail(email);
        if (error) {
            showToast("Xəta: " + error.message);
        } else {
            showToast("Sıfırlama linki e-poçtunuza göndərildi!");
            switchAuthMode('login');
        }
    }
}

// Google ilə giriş
async function socialLogin(provider) {
    const { error } = await _supabase.auth.signInWithOAuth({ provider });
    if (error) showToast("Sosial giriş xətası: " + error.message);
}

// Çıxış etmək
async function handleLogout() {
    await _supabase.auth.signOut();
    currentUser = null;
    showAuthScreen();
    showToast("Hesabdan çıxıldı.");
}

// Şifrəni yeniləmək (Ayarlar bölməsindən)
async function updateUserPassword() {
    const newPassword = document.getElementById("newPasswordInput").value;
    if (!newPassword) return showToast("Yeni şifrə daxil edin!");
    const { error } = await _supabase.auth.updateUser({ password: newPassword });
    if (error) {
        showToast("Xəta: " + error.message);
    } else {
        showToast("Şifrəniz uğurla dəyişdirildi!");
        document.getElementById("newPasswordInput").value = "";
    }
}

function showAuthScreen() {
    document.getElementById("authScreen").classList.remove("hidden");
    document.getElementById("appScreen").classList.add("hidden");
}

function showAppScreen() {
    document.getElementById("authScreen").classList.add("hidden");
    document.getElementById("appScreen").classList.remove("hidden");
    if (currentUser) {
        document.getElementById("userContactInfo").innerText = currentUser.email;
    }
}

// Tab dəyişmə funksiyası
function switchTab(tabName) {
    ['dashboard', 'orders', 'expenses', 'settings'].forEach(t => {
        const content = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}Content`);
        const btn = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}Btn`);
        if (t === tabName) {
            content.classList.remove('hidden');
            btn.className = "flex-1 py-1.5 text-[10px] font-bold rounded-xl bg-white text-indigo-600 shadow-sm transition-all cursor-pointer text-center";
        } else {
            content.classList.add('hidden');
            btn.className = "flex-1 py-1.5 text-[10px] font-bold text-slate-400 rounded-xl transition-all cursor-pointer text-center";
        }
    });
}

function showToast(text) {
    const toast = document.getElementById("toastNotification");
    toast.innerText = text;
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 3000);
}

function openCustomsModal() {
    const modal = document.getElementById("trackerModal");
    modal.classList.toggle("hidden");
}
