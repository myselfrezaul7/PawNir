const state = {
  mode: "all",
  language: localStorage.getItem("pawnir-lang") || document.documentElement.lang || "en",
  authMode: "login",
  user: null,
  googleEnabled: false,
  pending2faToken: null,
  challengeToken: null
};

const taka = (value) => `৳${new Intl.NumberFormat("en-BD").format(value)}`;
let vets = [];
let selectedVet = null;
let pets = [];
let activeDialog = null;
let dialogTrigger = null;
let lockedScrollY = 0;
let selectedFoster = null;
let selectedAdoption = null;
let selectedDonor = null;
let selectedSightingReport = null;
let lostSpeciesFilter = "";
let cachedFosters = [];
let activeMapFosterId = null;
let lostRefreshTimer = null;
let lostReportSignature = "";
let compressedReportPhoto = null;
let toastTimer = null;

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showToast(message, durationMs = 3400) {
  const toast = document.getElementById("app-toast");
  if (!toast || !message) return;
  toast.textContent = message;
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add("is-shown"));
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-shown");
    window.setTimeout(() => { toast.hidden = true; }, 220);
  }, durationMs);
}

const copy = {
  en: {
    "nav.home": "Home",
    "nav.lost": "Lost & found",
    "nav.lostShort": "Alerts",
    "nav.donors": "Blood donors",
    "nav.donorsShort": "Donors",
    "nav.adopt": "Adopt",
    "nav.adoptShort": "Adopt",
    "nav.foster": "Fosters",
    "nav.find": "Find a vet",
    "nav.how": "How it works",
    "nav.vets": "For vets",
    "nav.care": "My care",
    "nav.signin": "Sign in",
    "nav.bookings": "Bookings",
    "nav.profile": "Account",
    "hero.eyebrow": "Help for animals, close to home",
    "hero.title": "When animals need help,<br /><em>your area shows up.</em>",
    "hero.subtitle": "PawNir connects animal lovers with nearby lost-pet alerts, adoption, blood donors, communities, and trusted veterinary care across Bangladesh.",
    "hero.cta": "See what PawNir does",
    "hero.vetLink": "Find a veterinarian",
    "hero.trust": "<strong>10,000+</strong> pet parents<br />already trust PawNir",
    "hero.badge1Title": "Verified network",
    "hero.badge1Sub": "Community checked",
    "hero.badge2Sub": "Loved by pet parents",
    "mission.eyebrow": "One home for animal help",
    "mission.title": "Not another group post.<br /><em>Nearby help that reaches the right people.</em>",
    "mission.badge": "Built for Bangladesh",
    "mission.exampleLabel": "A simple example",
    "mission.exampleTitle": "Your cat is missing from Dhanmondi 10.",
    "mission.exampleText": "Instead of posting across unrelated groups, PawNir can notify opted-in animal lovers around that area: <strong>“Lost pet near you.”</strong> The alert stays local, useful, and privacy-conscious.",
    "mission.exampleNote": "Approximate area only · Contact shared with consent",
    "mission.alertTitle": "Lost pet near you",
    "mission.alertSub": "Cat reported near Dhanmondi 10",
    "mission.alertMeta": "89 PawNir members in this area notified",
    "mission.safety": "<strong>Our safety promise:</strong> PawNir does not allow buying or selling live animals. We are building with verification, moderation, consent, and animal welfare at the center.",
    "service.lostTitle": "Lost & found alerts",
    "service.lostDesc": "Reach animal lovers around the right area.",
    "service.adoptTitle": "Safe adoption",
    "service.adoptDesc": "Adopt or rehome with screening and follow-up.",
    "service.bloodTitle": "Blood donor network",
    "service.bloodDesc": "Find registered donors near your pet.",
    "service.circleTitle": "Local circles",
    "service.circleDesc": "Connect with animal lovers in your area.",
    "service.vetTitle": "Emergency vet care",
    "service.vetDesc": "Find urgent veterinary support when needed.",
    "service.fosterTitle": "Foster & shelters",
    "service.fosterDesc": "Discover registered local care and safe foster support.",
    "service.shopTitle": "Accessories & transport",
    "service.shopDesc": "Shop pet essentials or arrange animal transport through PetBhai.",
    "lost.eyebrow": "Help that reaches nearby",
    "lost.title": "Lost & found around you",
    "lost.reportBtn": "Report an animal",
    "lost.alertBtn": "Get alerts here",
    "donor.eyebrow": "Help in urgent moments",
    "donor.title": "Animal blood donor network",
    "donor.registerBtn": "Register a donor",
    "donor.disclaimer": "PawNir connects consented donors; a veterinarian must confirm blood compatibility and medical suitability.",
    "adopt.eyebrow": "A safer next home",
    "adopt.title": "Adopt responsibly",
    "foster.eyebrow": "Registered local care",
    "foster.title": "Find a foster or shelter",
    "vet.eyebrow": "A better care experience is coming",
    "vet.title": "Paid vet consultations,<br /><em>made for PawNir.</em>",
    "vet.desc": "We are preparing trusted paid consultations, online appointments, and follow-up care inside PawNir. Until it is ready, find local vet information through our trusted animal-care partner.",
    "vet.btn": "Find a local vet on Catwaala",
    "vet.artTitle": "Paid vet care",
    "vet.artSub": "Coming soon to PawNir",
    "how.eyebrow": "Simple from start to finish",
    "how.title": "Care in three easy steps",
    "how.step1Title": "Find nearby support",
    "how.step1Desc": "Search verified blood donors, adoption listings, fosters, or local veterinary partners by area.",
    "how.step2Title": "Connect with consent",
    "how.step2Desc": "Send screened adoption, foster, or donor requests without exposing private phone numbers publicly.",
    "how.step3Title": "Keep every pet safe",
    "how.step3Desc": "Manage your pet profiles, nearby lost-pet alerts, and care records in one trusted space.",
    "banner.eyebrow": "For veterinary professionals",
    "banner.title": "Make more time for<br /><em>what matters most.</em>",
    "banner.desc": "Grow your practice, simplify your day, and give every patient a better care journey.",
    "banner.btn": "Join PawNir"
  },
  bn: {
    "nav.home": "হোম",
    "nav.lost": "হারানো ও পাওয়া",
    "nav.lostShort": "অ্যালার্ট",
    "nav.donors": "রক্তদাতা",
    "nav.donorsShort": "রক্তদাতা",
    "nav.adopt": "দত্তক",
    "nav.adoptShort": "দত্তক",
    "nav.foster": "ফস্টার কেয়ার",
    "nav.find": "ভেট খুঁজুন",
    "nav.how": "যেভাবে কাজ করে",
    "nav.vets": "ভেটদের জন্য",
    "nav.care": "আমার যত্ন",
    "nav.signin": "সাইন ইন",
    "nav.bookings": "বুকিং",
    "nav.profile": "অ্যাকাউন্ট",
    "hero.eyebrow": "প্রাণীদের জন্য সহায়তা, আপনার এলাকাতেই",
    "hero.title": "প্রাণীদের যখন সাহায্য প্রয়োজন,<br /><em>আপনার এলাকা পাশে দাঁড়ায়।</em>",
    "hero.subtitle": "PawNir সারা বাংলাদেশে হারানো প্রাণীর অ্যালার্ট, নিরাপদ দত্তক, রক্তদাতা নেটওয়ার্ক, ফস্টার কেয়ার এবং বিশ্বস্ত ভেটেরিনারি সেবাকে একত্রিত করে।",
    "hero.cta": "PawNir কী করে দেখুন",
    "hero.vetLink": "ভেটেরিনারিয়ান খুঁজুন",
    "hero.trust": "<strong>১০,০০০+</strong> পেট প্যারেন্ট<br />ইতিমধ্যে PawNir-এ আস্থা রাখেন",
    "hero.badge1Title": "যাচাইকৃত নেটওয়ার্ক",
    "hero.badge1Sub": "কমিউনিটি সুরক্ষিত",
    "hero.badge2Sub": "পেট প্যারেন্টদের প্রিয়",
    "mission.eyebrow": "প্রাণী সহায়তার এক ঠিকানা",
    "mission.title": "অগোছালো গ্রুপ পোস্ট নয়।<br /><em>সঠিক মানুষের কাছে দ্রুত এলাকার খবর।</em>",
    "mission.badge": "বাংলাদেশের জন্য তৈরি",
    "mission.exampleLabel": "একটি সহজ উদাহরণ",
    "mission.exampleTitle": "ধানমন্ডি ১০ থেকে আপনার বিড়ালটি হারিয়ে গেছে।",
    "mission.exampleText": "অসংখ্য গ্রুপে পোস্ট না করে, PawNir সেই এলাকার নিবন্ধিত প্রাণীপ্রেমীদের সাথে সাথে জানাতে পারে: <strong>“আপনার কাছেই একটি পোষা প্রাণী হারিয়েছে।”</strong>",
    "mission.exampleNote": "শুধুমাত্র আনুমানিক এলাকা · সম্মতিতেই যোগাযোগের তথ্য",
    "mission.alertTitle": "আপনার কাছেই হারানো প্রাণী",
    "mission.alertSub": "ধানমন্ডি ১০ এর কাছে বিড়াল রিপোর্ট করা হয়েছে",
    "mission.alertMeta": "এই এলাকার ৮৯ জন PawNir সদস্যকে জানানো হয়েছে",
    "mission.safety": "<strong>আমাদের নিরাপত্তা প্রতিশ্রুতি:</strong> PawNir-এ জীবন্ত প্রাণী কেনা-বেচা সম্পূর্ণ নিষিদ্ধ। যাচাইকরণ, সম্মতি এবং প্রাণী কল্যাণই আমাদের মূল ভিত্তি।",
    "service.lostTitle": "হারানো ও পাওয়া অ্যালার্ট",
    "service.lostDesc": "সঠিক এলাকার প্রাণীপ্রেমীদের কাছে দ্রুত বার্তা পৌঁছান।",
    "service.adoptTitle": "নিরাপদ দত্তক",
    "service.adoptDesc": "যাচাই ও ফলো-আপের মাধ্যমে নিরাপদ দত্তক নিন।",
    "service.bloodTitle": "রক্তদাতা নেটওয়ার্ক",
    "service.bloodDesc": "আপনার পোষা প্রাণীর কাছে নিবন্ধিত রক্তদাতা খুঁজুন।",
    "service.circleTitle": "লোকাল সার্কেল",
    "service.circleDesc": "আপনার এলাকার প্রাণীপ্রেমীদের সাথে যুক্ত হোন।",
    "service.vetTitle": "জরুরি ভেট সেবা",
    "service.vetDesc": "প্রয়োজনে দ্রুত ভেটেরিনারি সহায়তা খুঁজুন।",
    "service.fosterTitle": "ফস্টার ও শেল্টার",
    "service.fosterDesc": "নিবন্ধিত ফস্টার এবং নিরাপদ আশ্রয় কেন্দ্র খুঁজুন।",
    "service.shopTitle": "পেট শপ ও পরিবহন",
    "service.shopDesc": "PetBhai-এর মাধ্যমে প্রয়োজনীয় সামগ্রী ও পরিবহন সেবা নিন।",
    "lost.eyebrow": "কাছাকাছি মানুষের সহায়তা",
    "lost.title": "আপনার আশেপাশে হারানো ও পাওয়া",
    "lost.reportBtn": "রিপোর্ট করুন",
    "lost.alertBtn": "এই এলাকার অ্যালার্ট পান",
    "donor.eyebrow": "জরুরি মুহূর্তে সহায়তা",
    "donor.title": "প্রাণী রক্তদাতা নেটওয়ার্ক",
    "donor.registerBtn": "রক্তদাতা নিবন্ধন",
    "donor.disclaimer": "PawNir সম্মতিপ্রাপ্ত দাতাদের যুক্ত করে; রক্ত দেওয়ার আগে অবশ্যই ভেটেরিনারিয়ানের পরামর্শ ও পরীক্ষা আবশ্যক।",
    "adopt.eyebrow": "একটি নিরাপদ নতুন ঘর",
    "adopt.title": "দায়িত্বশীলভাবে দত্তক নিন",
    "foster.eyebrow": "নিবন্ধিত স্থানীয় সেবা",
    "foster.title": "ফস্টার বা শেল্টার খুঁজুন",
    "vet.eyebrow": "আরও উন্নত সেবা আসছে",
    "vet.title": "পেইড ভেট কনসালটেশন,<br /><em>PawNir-এর ভেতরেই।</em>",
    "vet.desc": "আমরা PawNir-এ সরাসরি ভেট অ্যাপয়েন্টমেন্ট ও অনলাইন পরামর্শ সেবা চালু করছি। তার আগ পর্যন্ত আমাদের পার্টনার Catwaala-তে স্থানীয় ভেট খুঁজুন।",
    "vet.btn": "Catwaala-তে স্থানীয় ভেট খুঁজুন",
    "vet.artTitle": "পেইড ভেট সেবা",
    "vet.artSub": "শীঘ্রই আসছে PawNir-এ",
    "how.eyebrow": "শুরু থেকে শেষ পর্যন্ত সহজ",
    "how.title": "সহজ তিন ধাপে সেবা",
    "how.step1Title": "কাছের সহায়তা খুঁজুন",
    "how.step1Desc": "এলাকা অনুযায়ী রক্তদাতা, দত্তক, ফস্টার বা স্থানীয় ভেট খুঁজুন।",
    "how.step2Title": "সম্মতির সাথে যোগাযোগ",
    "how.step2Desc": "ব্যক্তিগত নম্বর প্রকাশ না করেই নিরাপদে অনুরোধ পাঠান।",
    "how.step3Title": "প্রতিটি প্রাণী থাকুক নিরাপদ",
    "how.step3Desc": "পোষা প্রাণীর প্রোফাইল ও অ্যালার্ট এক জায়গাতেই রাখুন।",
    "banner.eyebrow": "ভেটেরিনারি পেশাজীবীদের জন্য",
    "banner.title": "যত্নের জন্য রাখুন<br /><em>আরও বেশি সময়।</em>",
    "banner.desc": "আপনার চেম্বার ও রোগীদের সেবা আরও সহজ করতে PawNir-এ যুক্ত হোন।",
    "banner.btn": "PawNir-এ যোগ দিন"
  }
};

function dialogFocusable(dialog) {
  return dialog.querySelector("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])");
}
function openDialog(dialog, trigger) {
  if (!dialog || dialog.open) return;
  if (activeDialog && activeDialog !== dialog) {
    activeDialog.classList.remove("is-visible");
    if (activeDialog.open) activeDialog.close();
  }
  activeDialog = dialog;
  dialogTrigger = trigger || document.activeElement;
  dialog.setAttribute("aria-modal", "true");
  if (!document.body.classList.contains("dialog-open")) {
    lockedScrollY = window.scrollY;
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.classList.add("dialog-open");
  }
  dialog.showModal();
  requestAnimationFrame(() => dialog.classList.add("is-visible"));
  const first = dialogFocusable(dialog);
  if (first) first.focus();
}
function closeDialog(dialog) {
  if (!dialog || !dialog.open) return;
  dialog.classList.remove("is-visible");
  window.setTimeout(() => {
    if (dialog.open) dialog.close();
    if (activeDialog === dialog) {
      document.body.classList.remove("dialog-open");
      document.body.style.top = "";
      window.scrollTo(0, lockedScrollY);
      if (dialogTrigger && document.contains(dialogTrigger)) dialogTrigger.focus();
      activeDialog = null;
      dialogTrigger = null;
    }
  }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180);
}
function wireDialog(dialog) {
  if (!dialog) return;
  dialog.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(dialog); });
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); closeDialog(dialog); });
  dialog.querySelectorAll("[data-close-auth],[data-close-dashboard],[data-close-profile],.dialog-close").forEach((button) =>
    button.addEventListener("click", (event) => { event.preventDefault(); closeDialog(dialog); })
  );
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusables = [...dialog.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])")].filter((el) => !el.closest("[hidden]"));
    if (!focusables.length) return;
    const index = focusables.indexOf(document.activeElement);
    if (event.shiftKey && index <= 0) { event.preventDefault(); focusables[focusables.length - 1].focus(); }
    if (!event.shiftKey && index === focusables.length - 1) { event.preventDefault(); focusables[0].focus(); }
  });
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("pawnir-theme", theme);
  const toggle = document.getElementById("theme-toggle");
  const dark = theme === "dark";
  toggle.setAttribute("aria-pressed", String(dark));
  toggle.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
}

function applyLanguage(language) {
  const lang = copy[language] ? language : "en";
  state.language = lang;
  document.documentElement.lang = lang;
  localStorage.setItem("pawnir-lang", lang);
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (key === "nav.signin" && state.user) return;
    if (key === "nav.profile" && state.user) return;
    if (copy[lang][key]) element.textContent = copy[lang][key];
  });
  document.querySelectorAll("[data-i18n-html]").forEach((element) => {
    const key = element.dataset.i18nHtml;
    if (copy[lang][key]) element.innerHTML = copy[lang][key];
  });
  document.getElementById("language-toggle").textContent = lang === "bn" ? "English" : "বাংলা";
}

function updateAuthUI() {
  const navBtn = document.getElementById("auth-nav-button");
  const navAvatar = document.getElementById("auth-nav-avatar");
  const navLabel = document.getElementById("auth-nav-label");
  const mobileLabel = document.getElementById("mobile-account-label");
  const userBar = document.getElementById("dashboard-user-bar");

  if (state.user) {
    const displayName = state.user.name || state.user.email?.split("@")[0] || "Account";
    const firstName = displayName.split(/\s+/)[0];
    const initial = displayName.charAt(0).toUpperCase();
    if (navAvatar) {
      navAvatar.textContent = initial;
      navAvatar.hidden = false;
    }
    if (navLabel) navLabel.textContent = firstName;
    if (mobileLabel) mobileLabel.textContent = firstName;
    if (navBtn) {
      navBtn.removeAttribute("data-open-auth");
      navBtn.setAttribute("data-open-dashboard", "true");
    }
    if (userBar) {
      userBar.hidden = false;
      document.getElementById("dashboard-user-initials").textContent = initial;
      document.getElementById("dashboard-user-name").textContent = displayName;
      document.getElementById("dashboard-user-email").textContent = state.user.email || "";
    }
  } else {
    if (navAvatar) navAvatar.hidden = true;
    if (navLabel) navLabel.textContent = copy[state.language]["nav.signin"] || "Sign in";
    if (mobileLabel) mobileLabel.textContent = copy[state.language]["nav.profile"] || "Account";
    if (navBtn) {
      navBtn.removeAttribute("data-open-dashboard");
      navBtn.setAttribute("data-open-auth", "true");
    }
    if (userBar) userBar.hidden = true;
  }
}

function setAuthMode(mode) {
  state.authMode = mode === "register" ? "register" : "login";
  document.querySelectorAll("[data-auth-mode]").forEach((tab) => {
    const active = tab.dataset.authMode === state.authMode;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  const title = document.getElementById("auth-dialog-title");
  const nameInput = document.getElementById("auth-name");
  const submitBtn = document.getElementById("auth-submit-btn");
  if (state.authMode === "register") {
    if (title) title.textContent = "Create your PawNir account";
    if (nameInput) nameInput.required = true;
    if (submitBtn) submitBtn.innerHTML = 'Continue to 2FA check <span aria-hidden="true">→</span>';
  } else {
    if (title) title.textContent = "Sign in to your care space";
    if (nameInput) nameInput.required = false;
    if (submitBtn) submitBtn.innerHTML = 'Continue to verification <span aria-hidden="true">→</span>';
  }
}

function showAuthStep(step, challenge = null) {
  const credStep = document.getElementById("auth-step-credentials");
  const twoFaForm = document.getElementById("auth-2fa-form");
  const status = document.getElementById("auth-status");
  if (step === "2fa") {
    credStep.hidden = true;
    twoFaForm.hidden = false;
    if (challenge) {
      state.challengeToken = challenge.challengeToken;
      document.getElementById("auth-2fa-question").textContent = challenge.question;
    }
    const answerInput = document.getElementById("auth-2fa-answer");
    answerInput.value = "";
    status.textContent = "Step 2 of 2: Enter the result of the calculation above.";
    window.setTimeout(() => answerInput.focus(), 60);
  } else {
    credStep.hidden = false;
    twoFaForm.hidden = true;
    state.pending2faToken = null;
    status.textContent = "Protected by 2-step math verification.";
  }
}

async function refreshMathChallenge() {
  try {
    const response = await fetch("/api/auth/challenge");
    if (!response.ok) return;
    const challenge = await response.json();
    state.challengeToken = challenge.challengeToken;
    document.getElementById("auth-2fa-question").textContent = challenge.question;
    const answerInput = document.getElementById("auth-2fa-answer");
    answerInput.value = "";
    answerInput.focus();
  } catch (err) {
    // ignore
  }
}

async function syncSession() {
  const token = localStorage.getItem("pawnir_token");
  if (!token) {
    state.user = null;
    updateAuthUI();
    return null;
  }
  try {
    const response = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      localStorage.removeItem("pawnir_token");
      state.user = null;
      updateAuthUI();
      return null;
    }
    const data = await response.json();
    if (!data.user) {
      localStorage.removeItem("pawnir_token");
      state.user = null;
      updateAuthUI();
      return null;
    }
    state.user = data.user;
    updateAuthUI();
    loadNotifications();
    return state.user;
  } catch (err) {
    return null;
  }
}

async function loadAuthConfig() {
  try {
    const response = await fetch("/api/auth/config");
    if (!response.ok) return;
    const cfg = await response.json();
    state.googleEnabled = Boolean(cfg.googleEnabled);
  } catch (err) {
    // ignore
  }
}

async function loadNotifications() {
  const token = localStorage.getItem("pawnir_token");
  const badge = document.getElementById("notifications-badge");
  const list = document.getElementById("notifications-list");
  if (!token) {
    if (badge) badge.hidden = true;
    if (list) list.innerHTML = '<p class="inline-state">Sign in and subscribe to an area to receive nearby lost-pet alerts.</p>';
    return;
  }
  try {
    const response = await fetch("/api/notifications", { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return;
    const items = await response.json();
    const unread = items.filter((item) => !item.read).length;
    if (badge) {
      badge.textContent = unread > 99 ? "99+" : String(unread);
      badge.hidden = unread === 0;
    }
    if (list) {
      list.innerHTML = items.length
        ? items.map((item) => `<article class="notification-item ${item.read ? "" : "is-unread"}"><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message)}</p></div><small>${new Date(item.createdAt).toLocaleDateString("en-BD", { day: "numeric", month: "short" })}</small></article>`).join("")
        : '<p class="inline-state">No nearby alerts yet. Subscribe to your area in Lost &amp; Found to get notified.</p>';
    }
  } catch (err) {
    // ignore
  }
}

function reportCard(report, own = false) {
  const label = report.type === "lost" ? "Lost" : "Found";
  const typeClass = report.type === "found" ? "found" : "lost";
  const photo = report.photoData
    ? `<img class="lost-report-photo" src="${escapeHtml(report.photoData)}" alt="${escapeHtml(label)} ${escapeHtml(report.species)} photo" loading="lazy" />`
    : "";
  const status = report.status === "resolved"
    ? '<span class="report-status resolved">Reunited ✓</span>'
    : '<span class="report-status">Open</span>';
  const mapSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${report.area}, ${report.city}, Bangladesh`)}`;
  const sightings = Array.isArray(report.sightings) ? report.sightings : [];
  const sightingsHtml = sightings.length
    ? `<div class="sighting-box"><div class="sighting-box-title"><span>📍 ${sightings.length} Community Sighting${sightings.length === 1 ? "" : "s"}</span></div>${sightings.slice(0, 2).map((s) => `<div class="sighting-item"><strong>${escapeHtml(s.location)}</strong> — ${escapeHtml(s.note)}<small>By ${escapeHtml(s.reporterName || "Community member")} · ${new Date(s.createdAt).toLocaleDateString("en-BD", { day: "numeric", month: "short" })}</small></div>`).join("")}</div>`
    : "";
  const sightingBtn = report.status === "open"
    ? `<button class="btn btn-small btn-outline sighting-report-button" data-report-id="${escapeHtml(report.id)}" data-report-title="${escapeHtml(report.title)}" type="button">📍 I spotted this pet</button>`
    : "";
  const resolveBtn = own && report.status === "open"
    ? `<button class="btn btn-small btn-dark resolve-report-button" data-report-id="${escapeHtml(report.id)}" type="button">Mark reunited ✓</button>`
    : "";
  return `<article class="lost-report-card">${photo}<div class="lost-report-top"><span class="report-pill ${typeClass}">${label}</span><span>${new Date(report.createdAt).toLocaleDateString("en-BD", { day: "numeric", month: "short" })}</span></div><h3>${escapeHtml(report.title)}</h3><p>${escapeHtml(report.description)}</p><div class="lost-report-meta"><a href="${escapeHtml(mapSearchUrl)}" target="_blank" rel="noopener noreferrer" title="View area on Google Maps">⌖ ${escapeHtml(report.area)}, ${escapeHtml(report.city)} ↗</a><span>${escapeHtml(report.species)}</span>${status}</div>${sightingsHtml}<div class="report-card-actions">${sightingBtn}${resolveBtn}</div></article>`;
}

function compressAndReadPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return reject(new Error("Only JPG, PNG, or WebP photos are allowed."));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read the selected photo."));
    reader.onload = () => {
      const dataUrl = reader.result;
      if (file.size <= 900 * 1024) {
        return resolve(dataUrl);
      }
      const img = new Image();
      img.onerror = () => reject(new Error("Unable to process image."));
      img.onload = () => {
        const maxDim = 1280;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", 0.84);
        resolve(compressed);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function wireSightingButtons(container) {
  container.querySelectorAll(".sighting-report-button").forEach((button) =>
    button.addEventListener("click", (event) => {
      selectedSightingReport = { id: button.dataset.reportId, title: button.dataset.reportTitle };
      if (!localStorage.getItem("pawnir_token")) {
        showAuthStep("credentials");
        document.getElementById("auth-status").textContent = "Sign in first to share a sighting tip.";
        openDialog(document.getElementById("auth-dialog"), event.currentTarget);
        return;
      }
      document.getElementById("sighting-dialog-title").textContent = `Share sighting for: ${selectedSightingReport.title}`;
      document.getElementById("sighting-status").textContent = "";
      openDialog(document.getElementById("sighting-dialog"), event.currentTarget);
    })
  );
}

async function loadLostReports() {
  const area = document.getElementById("lost-area-input").value.trim();
  const type = document.getElementById("lost-type-filter").value;
  const grid = document.getElementById("lost-report-grid");
  if (!grid.querySelector(".lost-report-card")) grid.innerHTML = '<p class="inline-state">Loading nearby reports…</p>';
  try {
    const token = localStorage.getItem("pawnir_token");
    const headers = token ? { Authorization: "Bearer " + token } : {};
    const params = new URLSearchParams({ area, type, species: lostSpeciesFilter });
    const response = await fetch(`/api/lost-found?${params}`, { headers });
    if (!response.ok) throw new Error("Unable to load nearby reports.");
    const result = await response.json();
    const reports = Array.isArray(result) ? result : result.reports;
    const mine = Array.isArray(result) ? [] : result.mine || [];
    const signature = `${lostSpeciesFilter}|${area}|${type}|` + reports.map((report) => `${report.id}:${report.updatedAt || report.createdAt}:${report.status}:${(report.sightings || []).length}`).join("|");
    const changed = signature !== lostReportSignature;
    lostReportSignature = signature;
    if (changed || !grid.querySelector(".lost-report-card")) {
      grid.innerHTML = reports.length
        ? reports.map((r) => reportCard(r, false)).join("")
        : '<p class="inline-state">No open reports match this filter right now. Try clearing filters or report an animal above.</p>';
      wireSightingButtons(grid);
    }
    const mineWrap = document.getElementById("my-lost-reports");
    const mineList = document.getElementById("my-lost-report-list");
    if (mineWrap && mineList) {
      if (token && mine.length > 0) {
        mineWrap.hidden = false;
        mineList.innerHTML = mine.slice(0, 5).map((report) => reportCard(report, true)).join("");
        wireSightingButtons(mineList);
        mineList.querySelectorAll(".resolve-report-button").forEach((button) =>
          button.addEventListener("click", async () => {
            button.disabled = true;
            const res = await fetch(`/api/lost-found/${encodeURIComponent(button.dataset.reportId)}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
              body: JSON.stringify({ status: "resolved" })
            });
            if (!res.ok) {
              button.disabled = false;
              return;
            }
            showToast("Marked as safely reunited!");
            lostReportSignature = "";
            await loadLostReports();
          })
        );
      } else {
        mineWrap.hidden = true;
        mineList.innerHTML = "";
      }
    }
    const liveStatus = document.getElementById("lost-live-status");
    if (liveStatus) {
      liveStatus.innerHTML = `<span class="live-pulse" aria-hidden="true"></span><strong>${changed ? "Live feed updated" : "Live nearby feed"}</strong><span>${reports.length} open report${reports.length === 1 ? "" : "s"} · Updated ${new Date().toLocaleTimeString("en-BD", { hour: "numeric", minute: "2-digit" })}</span>`;
    }
  } catch (error) {
    grid.innerHTML = `<p class="inline-state error-state" role="alert">${escapeHtml(error.message)}</p>`;
  }
}

function selectFosterOnMap(foster, scrollIntoMap = false) {
  if (!foster) return;
  activeMapFosterId = foster.id;
  const iframe = document.getElementById("foster-google-map");
  if (iframe && foster.embedMapUrl && iframe.dataset.currentSrc !== foster.embedMapUrl) {
    iframe.src = foster.embedMapUrl;
    iframe.dataset.currentSrc = foster.embedMapUrl;
  }
  const activeCard = document.getElementById("foster-map-active-card");
  if (activeCard) {
    const ratingText = foster.rating ? `★ ${foster.rating} (${foster.reviewCount} reviews)` : "New community foster";
    activeCard.innerHTML = `
      <span class="verified-badge"><span class="icon icon-check" aria-hidden="true"></span> ${escapeHtml(foster.city)} · ${escapeHtml(foster.area)}</span>
      <h3>${escapeHtml(foster.name)}</h3>
      <p>${escapeHtml(foster.description)}</p>
      <small><strong>${escapeHtml(ratingText)}</strong> · ${escapeHtml(foster.capacity)}</small>
    `;
  }
  const dirLink = document.getElementById("foster-map-directions-link");
  if (dirLink && foster.mapUrl) {
    dirLink.href = foster.mapUrl;
  }
  const reviewBtn = document.getElementById("foster-map-review-btn");
  if (reviewBtn) {
    reviewBtn.onclick = (event) => openFosterReviews(foster.id, foster.name, event.currentTarget);
  }
  document.querySelectorAll(".map-pin-chip").forEach((chip) => {
    chip.classList.toggle("is-active", chip.dataset.fosterId === foster.id);
  });
  document.querySelectorAll(".foster-card").forEach((card) => {
    card.classList.toggle("is-map-selected", card.dataset.fosterCardId === foster.id);
  });
  if (scrollIntoMap) {
    document.getElementById("foster-map-explorer")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function fosterCard(foster) {
  const ratingBadge = foster.rating
    ? `<span class="foster-rating-pill">★ ${escapeHtml(foster.rating)} (${escapeHtml(foster.reviewCount)})</span>`
    : `<span class="foster-rating-pill">New · Be first to review</span>`;
  const speciesList = Array.isArray(foster.species) ? foster.species.map(escapeHtml).join(" · ") : "";
  const topReview = Array.isArray(foster.recentReviews) && foster.recentReviews[0]
    ? `<div class="foster-review-snippet">“${escapeHtml(foster.recentReviews[0].comment.slice(0, 110))}${foster.recentReviews[0].comment.length > 110 ? "…" : ""}”<small>— ${escapeHtml(foster.recentReviews[0].userName || "Pet Parent")} (${"★".repeat(foster.recentReviews[0].rating)})</small></div>`
    : "";
  const selectedClass = foster.id === activeMapFosterId ? "is-map-selected" : "";
  return `<article class="foster-card ${selectedClass}" data-foster-card-id="${escapeHtml(foster.id)}"><div class="foster-card-top"><span class="foster-mark">⌂</span>${ratingBadge}</div><h3>${escapeHtml(foster.name)}</h3><p>${escapeHtml(foster.description)}</p><div class="foster-meta"><span>⌖ ${escapeHtml(foster.area)}, ${escapeHtml(foster.city)}</span><span class="verified-badge"><span class="icon icon-check" aria-hidden="true"></span> Verified</span></div><small>${escapeHtml(foster.capacity)} · ${speciesList}</small>${topReview}<div class="foster-actions"><button class="btn btn-small btn-outline foster-focus-map-btn" data-foster="${escapeHtml(foster.id)}" type="button">📍 Show on Map</button><button class="btn btn-small btn-outline foster-review-link" data-foster="${escapeHtml(foster.id)}" data-name="${escapeHtml(foster.name)}" type="button">★ Reviews (${escapeHtml(foster.reviewCount || 0)})</button><button class="btn btn-small btn-dark foster-request-button" data-foster="${escapeHtml(foster.id)}" data-name="${escapeHtml(foster.name)}" type="button">Request care</button></div></article>`;
}

function updateStarPickerUI(ratingVal) {
  const rating = Math.min(5, Math.max(1, Number(ratingVal) || 5));
  const input = document.getElementById("foster-review-rating");
  if (input) input.value = String(rating);
  const labels = {
    5: "5 / 5 · Excellent",
    4: "4 / 5 · Very Good",
    3: "3 / 5 · Good",
    2: "2 / 5 · Fair",
    1: "1 / 5 · Needs Improvement"
  };
  const labelEl = document.getElementById("star-rating-label");
  if (labelEl) labelEl.textContent = labels[rating] || "5 / 5 · Excellent";
  document.querySelectorAll("#star-rating-picker .star-btn").forEach((btn) => {
    const starVal = Number(btn.dataset.starValue);
    const lit = starVal <= rating;
    btn.classList.toggle("is-Lit", lit);
    btn.setAttribute("aria-checked", String(starVal === rating));
  });
}

async function openFosterReviews(fosterId, fosterName, trigger) {
  selectedFoster = { id: fosterId, name: fosterName };
  document.getElementById("foster-review-title").textContent = `${fosterName} · Community Reviews`;
  document.getElementById("foster-review-status").textContent = "";
  updateStarPickerUI(5);
  openDialog(document.getElementById("foster-review-dialog"), trigger);
  await refreshFosterReviewSheet(fosterId);
}

async function refreshFosterReviewSheet(fosterId) {
  try {
    const response = await fetch(`/api/fosters/${encodeURIComponent(fosterId)}`);
    if (!response.ok) return;
    const data = await response.json();
    const avgEl = document.getElementById("review-avg-number");
    const starsEl = document.getElementById("review-avg-stars");
    const countEl = document.getElementById("review-total-count");
    const barsEl = document.getElementById("review-summary-bars");
    const listEl = document.getElementById("foster-reviews-list");

    const total = Number(data.reviewCount || 0);
    const avg = data.rating ? Number(data.rating).toFixed(1) : "—";
    if (avgEl) avgEl.textContent = avg;
    if (starsEl) {
      const rounded = data.rating ? Math.round(Number(data.rating)) : 5;
      starsEl.textContent = "★".repeat(rounded) + "☆".repeat(Math.max(0, 5 - rounded));
    }
    if (countEl) countEl.textContent = `${total} verified review${total === 1 ? "" : "s"}`;

    const breakdown = data.ratingBreakdown || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    if (barsEl) {
      barsEl.innerHTML = [5, 4, 3, 2, 1].map((star) => {
        const count = Number(breakdown[star] || 0);
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return `<div class="review-bar-row"><span>${star} ★</span><div class="review-bar-track"><div class="review-bar-fill" style="width:${pct}%"></div></div><span>${count}</span></div>`;
      }).join("");
    }

    const reviews = Array.isArray(data.reviews) ? data.reviews : [];
    if (listEl) {
      listEl.innerHTML = reviews.length
        ? reviews.map((rev) => `
          <article class="review-item">
            <div class="review-item-top">
              <div class="review-author-wrap">
                <strong>${escapeHtml(rev.userName || "Pet Parent")}</strong>
                <span class="review-badge">✓ ${escapeHtml(rev.badge || "Verified Member")}</span>
              </div>
              <span class="review-stars-inline" aria-label="${escapeHtml(rev.rating)} out of 5 stars">${"★".repeat(rev.rating)}${"☆".repeat(Math.max(0, 5 - rev.rating))}</span>
            </div>
            <p>${escapeHtml(rev.comment)}</p>
            <div class="review-item-footer">
              <small>${new Date(rev.createdAt).toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric" })}</small>
              <button class="helpful-btn" data-helpful-review="${escapeHtml(rev.id)}" type="button">👍 Helpful (${Number(rev.helpfulCount || 0)})</button>
            </div>
          </article>
        `).join("")
        : '<p class="inline-state">No community reviews yet. Share your experience below!</p>';

      listEl.querySelectorAll("[data-helpful-review]").forEach((btn) =>
        btn.addEventListener("click", async (event) => {
          const token = localStorage.getItem("pawnir_token");
          if (!token) {
            showAuthStep("credentials");
            document.getElementById("auth-status").textContent = "Sign in to mark reviews as helpful.";
            openDialog(document.getElementById("auth-dialog"), event.currentTarget);
            return;
          }
          btn.disabled = true;
          const res = await fetch(`/api/fosters/${encodeURIComponent(fosterId)}/reviews/${encodeURIComponent(btn.dataset.helpfulReview)}/helpful`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const out = await res.json();
            btn.textContent = `👍 Helpful (${out.helpfulCount})`;
            btn.classList.toggle("is-voted", out.voted);
          }
          btn.disabled = false;
        })
      );
    }
  } catch (err) {
    // ignore
  }
}

async function loadFosters() {
  const city = document.getElementById("foster-city-filter").value;
  const response = await fetch(`/api/fosters?city=${encodeURIComponent(city)}`);
  const fosters = await response.json();
  cachedFosters = Array.isArray(fosters) ? fosters : [];

  const pinsWrap = document.getElementById("foster-map-pins");
  if (pinsWrap) {
    pinsWrap.innerHTML = cachedFosters.map((f) =>
      `<button class="map-pin-chip ${f.id === activeMapFosterId ? "is-active" : ""}" data-foster-id="${escapeHtml(f.id)}" type="button">📍 ${escapeHtml(f.name)} (${escapeHtml(f.area)})</button>`
    ).join("");
    pinsWrap.querySelectorAll(".map-pin-chip").forEach((chip) =>
      chip.addEventListener("click", () => {
        const target = cachedFosters.find((item) => item.id === chip.dataset.fosterId);
        if (target) selectFosterOnMap(target, false);
      })
    );
  }

  document.getElementById("foster-grid").innerHTML = cachedFosters.length
    ? cachedFosters.map(fosterCard).join("")
    : '<p class="inline-state">No registered foster care matches this filter.</p>';

  if (cachedFosters.length) {
    const current = cachedFosters.find((f) => f.id === activeMapFosterId) || cachedFosters[0];
    selectFosterOnMap(current, false);
  }

  document.querySelectorAll(".foster-focus-map-btn").forEach((button) =>
    button.addEventListener("click", () => {
      const target = cachedFosters.find((item) => item.id === button.dataset.foster);
      if (target) selectFosterOnMap(target, true);
    })
  );

  document.querySelectorAll(".foster-request-button").forEach((button) =>
    button.addEventListener("click", (event) => {
      selectedFoster = { id: button.dataset.foster, name: button.dataset.name };
      if (!localStorage.getItem("pawnir_token")) {
        showAuthStep("credentials");
        document.getElementById("auth-status").textContent = "Sign in first to request foster care.";
        openDialog(document.getElementById("auth-dialog"), event.currentTarget);
        return;
      }
      document.getElementById("foster-request-title").textContent = `Request care from ${selectedFoster.name}`;
      document.getElementById("foster-request-status").textContent = "";
      openDialog(document.getElementById("foster-request-dialog"), event.currentTarget);
    })
  );

  document.querySelectorAll(".foster-review-link").forEach((button) =>
    button.addEventListener("click", (event) => {
      openFosterReviews(button.dataset.foster, button.dataset.name, event.currentTarget);
    })
  );
}

function donorCard(donor) {
  const speciesLabel = donor.species === "cat" ? "Cat" : "Dog";
  const petTitle = donor.petName ? `${escapeHtml(donor.petName)} (${speciesLabel})` : `${speciesLabel} donor`;
  const weightPill = donor.weightKg ? `<span class="donor-meta-pill">⚖ ${escapeHtml(donor.weightKg)} kg</span>` : "";
  const vaxPill = donor.vaccinated !== false ? `<span class="donor-meta-pill is-vax">✓ Vaccinated</span>` : "";
  const badgeLabel = donor.badge || "Verified Donor";
  return `<article class="donor-card"><div class="donor-card-header"><span class="blood-type-pill">🩸 ${escapeHtml(donor.bloodType)}</span><span class="verified-badge"><span class="icon icon-check" aria-hidden="true"></span> ${escapeHtml(badgeLabel)}</span></div><h3>${petTitle}</h3><p>Available near <strong>${escapeHtml(donor.area)}, ${escapeHtml(donor.city)}</strong></p><div class="donor-meta-pills">${weightPill}${vaxPill}<span class="donor-meta-pill">${speciesLabel}</span></div><small>Owner consented · Vet cross-match required before transfusion</small><button class="btn btn-small btn-dark donor-request-button" data-donor="${escapeHtml(donor.id)}" data-label="Request ${escapeHtml(donor.bloodType)} blood from ${petTitle} (${escapeHtml(donor.area)})" type="button">Request emergency blood</button></article>`;
}

function renderMyDonorPanel(myDonors, incomingRequests) {
  const panel = document.getElementById("my-donor-panel");
  const list = document.getElementById("my-donor-list");
  if (!panel || !list) return;
  const token = localStorage.getItem("pawnir_token");
  if (!token || (!myDonors.length && !incomingRequests.length)) {
    panel.hidden = true;
    list.innerHTML = "";
    return;
  }
  panel.hidden = false;
  const donorCardsHtml = myDonors.map((d) => `
    <div class="donor-owner-card">
      <div class="donor-owner-top">
        <strong>${escapeHtml(d.petName || (d.species === "cat" ? "Cat" : "Dog"))} · ${escapeHtml(d.bloodType)}</strong>
        <button class="donor-avail-toggle ${d.available ? "is-on" : ""}" data-toggle-donor="${escapeHtml(d.id)}" data-avail="${d.available ? "1" : "0"}" type="button">
          ${d.available ? "● Available" : "○ Paused"}
        </button>
      </div>
      <small>⌖ ${escapeHtml(d.area)}, ${escapeHtml(d.city)}${d.weightKg ? ` · ${escapeHtml(d.weightKg)} kg` : ""}</small>
    </div>
  `).join("");

  const openRequests = incomingRequests.filter((r) => r.status === "open");
  const reqHtml = openRequests.map((r) => `
    <div class="donor-req-banner">
      <strong>🚨 Urgent Blood Request (${escapeHtml(r.clinic || "Nearby Clinic")})</strong>
      <p style="margin:0;font-size:12px">${escapeHtml(r.reason)}${r.contactPhone ? ` · Contact: <strong>${escapeHtml(r.contactPhone)}</strong>` : ""}</p>
      <div class="donor-req-actions">
        <button class="btn btn-small btn-green" data-respond-req="${escapeHtml(r.id)}" data-status="accepted" type="button">Accept &amp; Connect</button>
        <button class="btn btn-small btn-outline" data-respond-req="${escapeHtml(r.id)}" data-status="declined" type="button">Unavailable right now</button>
      </div>
    </div>
  `).join("");

  list.innerHTML = donorCardsHtml + reqHtml;

  list.querySelectorAll("[data-toggle-donor]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const nextAvail = btn.dataset.avail !== "1";
      btn.disabled = true;
      const res = await fetch(`/api/donors/${encodeURIComponent(btn.dataset.toggleDonor)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ available: nextAvail })
      });
      if (res.ok) {
        showToast(nextAvail ? "Donor marked as available!" : "Donor availability paused.");
        await loadDonors();
      } else {
        btn.disabled = false;
      }
    })
  );

  list.querySelectorAll("[data-respond-req]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      const res = await fetch(`/api/donor-requests/${encodeURIComponent(btn.dataset.respondReq)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: btn.dataset.status })
      });
      if (res.ok) {
        showToast(btn.dataset.status === "accepted" ? "Accepted! Requester has been notified." : "Request updated.");
        await loadDonors();
      } else {
        btn.disabled = false;
      }
    })
  );
}

async function loadDonors() {
  const params = new URLSearchParams({
    area: document.getElementById("donor-area-input").value.trim(),
    species: document.getElementById("donor-species-filter").value,
    bloodType: document.getElementById("donor-blood-filter").value,
    includeMine: "1"
  });
  const token = localStorage.getItem("pawnir_token");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(`/api/donors?${params}`, { headers });
  const payload = await response.json();
  const donors = Array.isArray(payload) ? payload : (payload.donors || []);
  const myDonors = Array.isArray(payload) ? [] : (payload.myDonors || []);
  const incomingRequests = Array.isArray(payload) ? [] : (payload.incomingRequests || []);

  renderMyDonorPanel(myDonors, incomingRequests);

  const grid = document.getElementById("donor-grid");
  grid.innerHTML = donors.length
    ? donors.map(donorCard).join("")
    : '<p class="inline-state">No verified available donors match this filter. Try clearing the blood type or area filter, or register your pet above.</p>';
  grid.querySelectorAll(".donor-request-button").forEach((button) =>
    button.addEventListener("click", (event) => {
      selectedDonor = { id: button.dataset.donor, label: button.dataset.label, button };
      if (!localStorage.getItem("pawnir_token")) {
        showAuthStep("credentials");
        document.getElementById("auth-status").textContent = "Sign in first to request an emergency blood donor connection.";
        openDialog(document.getElementById("auth-dialog"), event.currentTarget);
        return;
      }
      document.getElementById("donor-request-title").textContent = selectedDonor.label || "Request donor connection";
      document.getElementById("donor-request-status").textContent = "";
      openDialog(document.getElementById("donor-request-dialog"), event.currentTarget);
    })
  );
}

async function loadAdoptions() {
  const response = await fetch("/api/adoptions");
  const listings = await response.json();
  document.getElementById("adoption-grid").innerHTML = listings.length
    ? listings.map((listing) => `<article class="adoption-card"><span class="adoption-mark">♡</span><h3>${escapeHtml(listing.name)}</h3><p>${escapeHtml(listing.species)} · ${escapeHtml(listing.area)}</p><p>${escapeHtml(listing.description)}</p><button class="btn btn-small btn-dark adoption-apply-button" data-listing="${escapeHtml(listing.id)}" data-name="${escapeHtml(listing.name)}" type="button">Apply safely</button></article>`).join("")
    : '<p class="inline-state">No verified adoption listings are open right now.</p>';
  document.querySelectorAll(".adoption-apply-button").forEach((button) =>
    button.addEventListener("click", (event) => {
      selectedAdoption = { id: button.dataset.listing, name: button.dataset.name };
      if (!localStorage.getItem("pawnir_token")) {
        showAuthStep("credentials");
        document.getElementById("auth-status").textContent = "Sign in first to apply for adoption.";
        openDialog(document.getElementById("auth-dialog"), event.currentTarget);
        return;
      }
      document.getElementById("adoption-form-title").textContent = `Apply to adopt ${selectedAdoption.name}`;
      document.getElementById("adoption-status").textContent = "";
      document.getElementById("adoption-pdf-link").hidden = true;
      openDialog(document.getElementById("adoption-dialog"), event.currentTarget);
    })
  );
}

async function loadPets() {
  const token = localStorage.getItem("pawnir_token");
  if (!token) return [];
  const response = await fetch("/api/pets", { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Unable to load pet profiles.");
  pets = await response.json();
  const select = document.getElementById("booking-pet");
  if (select) {
    select.innerHTML = pets.length
      ? pets.map((pet) => `<option value="${escapeHtml(pet.id)}">${escapeHtml(pet.name)} · ${escapeHtml(pet.species)}</option>`).join("")
      : '<option value="">Add a pet in My care first</option>';
  }
  return pets;
}

async function loadDashboard() {
  const token = localStorage.getItem("pawnir_token");
  if (!token) {
    document.getElementById("dashboard-bookings").textContent = "Sign in to see your visits.";
    return;
  }
  const headers = { Authorization: `Bearer ${token}` };
  const [bookings, petList, prescriptions, profile, fosterRequests] = await Promise.all(
    ["/api/bookings", "/api/pets", "/api/prescriptions", "/api/auth/me", "/api/foster-requests"].map((path) =>
      fetch(path, { headers }).then((res) => (res.ok ? res.json() : []))
    )
  );
  if (profile && profile.user) {
    state.user = profile.user;
    updateAuthUI();
    document.getElementById("profile-name").value = profile.user.name || "";
    document.getElementById("profile-area").value = profile.user.area || "";
    document.getElementById("profile-bio").value = profile.user.bio || "";
  }
  document.getElementById("dashboard-pets").innerHTML = Array.isArray(petList) && petList.length
    ? petList.map((pet) => `<div class="dashboard-item"><strong>${escapeHtml(pet.name)}</strong><span>${escapeHtml(pet.species)}${pet.breed ? ` · ${escapeHtml(pet.breed)}` : ""}</span></div>`).join("")
    : "Add your first pet below.";

  const fosterEl = document.getElementById("dashboard-foster-requests");
  if (fosterEl) {
    fosterEl.innerHTML = Array.isArray(fosterRequests) && fosterRequests.length
      ? fosterRequests.slice(0, 4).map((req) => `<div class="dashboard-item"><strong>Foster request</strong><span>${escapeHtml(req.reason.slice(0, 60))}</span><small>Status: ${escapeHtml(req.status)}</small></div>`).join("")
      : "No foster requests yet.";
  }

  const bookingItems = Array.isArray(bookings) ? bookings : [];
  const rxItems = Array.isArray(prescriptions) ? prescriptions : [];
  if (bookingItems.length || rxItems.length) {
    document.getElementById("dashboard-bookings").innerHTML = [
      ...bookingItems.slice(0, 3).map((booking) => `<div class="dashboard-item"><strong>${escapeHtml(booking.vetName)}</strong><span>${escapeHtml(booking.date)} · ${escapeHtml(booking.time)}</span><small>${escapeHtml(booking.petName || "Pet")} · ${escapeHtml(booking.status)}</small></div>`),
      ...rxItems.slice(0, 2).map((item) => `<div class="dashboard-item"><strong>Rx: ${escapeHtml(item.items?.[0]?.medicine || "Prescription")}</strong><span>${new Date(item.issuedAt).toLocaleDateString("en-BD")}</span></div>`)
    ].join("");
  } else {
    document.getElementById("dashboard-bookings").textContent = "No visits or prescriptions yet.";
  }
}

function connectRealtimeStream() {
  if (typeof window.EventSource !== "function") return;
  try {
    const source = new EventSource("/api/stream");
    source.addEventListener("lost_found_update", () => {
      loadLostReports();
      if (localStorage.getItem("pawnir_token")) loadNotifications();
    });
  } catch (err) {
    // fallback polling already active
  }
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && activeDialog) {
    event.preventDefault();
    closeDialog(activeDialog);
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  document.querySelectorAll(".booking-dialog").forEach(wireDialog);
  wireDialog(document.getElementById("vet-profile-dialog"));

  setTheme(document.documentElement.dataset.theme || "light");
  applyLanguage(state.language);

  await loadAuthConfig();

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const googleToken = hashParams.get("google_token");
  const googlePending = hashParams.get("google_pending");
  const authError = new URLSearchParams(window.location.search).get("auth_error");

  if (googleToken) {
    localStorage.setItem("pawnir_token", googleToken);
    window.history.replaceState({}, "", window.location.pathname);
    await syncSession();
    showToast("Signed in with Google!");
  } else if (googlePending) {
    state.pending2faToken = googlePending;
    window.history.replaceState({}, "", window.location.pathname);
    showAuthStep("2fa");
    await refreshMathChallenge();
    openDialog(document.getElementById("auth-dialog"));
  } else {
    await syncSession();
  }

  if (authError) {
    window.history.replaceState({}, "", window.location.pathname);
    showAuthStep("credentials");
    const status = document.getElementById("auth-status");
    if (status) {
      status.textContent = authError === "google_not_configured"
        ? "Google Sign-In requires GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET in .env. Please use email sign-in below."
        : "Google sign-in could not be completed. Please try again or use email.";
    }
    openDialog(document.getElementById("auth-dialog"));
  }

  document.querySelectorAll(".hero-copy, .hero-art, .mission-section, .lost-found-section, .donor-section, .adoption-section, .foster-section, .vet-coming-soon, .how-it-works, .vet-banner").forEach((element) => element.classList.add("reveal"));
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("revealed");
      observer.unobserve(entry.target);
    }
  }), { threshold: 0.08 });
  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));

  // Dynamic View Routing (Home vs Dedicated Fosters, Alerts, Donors)
  function updateViewFromHash() {
    const rawHash = (window.location.hash || "").replace(/^#/, "");
    const dedicatedViews = ["foster-care", "lost-found", "blood-donors", "adoption", "find-care"];
    const view = dedicatedViews.includes(rawHash) ? rawHash : "home";
    document.body.dataset.view = view;

    // Desktop header active nav styling
    document.querySelectorAll(".main-nav a").forEach((link) => {
      const href = (link.getAttribute("href") || "").replace(/^#/, "");
      link.classList.toggle("is-active", href === view);
    });

    // Mobile bottom navigation active tab
    document.querySelectorAll(".mobile-nav [data-mobile-tab]").forEach((item) => {
      const tab = item.dataset.mobileTab;
      const isTarget = (view === "home" && tab === "home") || (tab === view);
      item.classList.toggle("is-active", isTarget);
    });

    // Scroll smoothly to top on view change
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  window.addEventListener("hashchange", updateViewFromHash);
  updateViewFromHash();

  // Homepage Foster Teaser "Add Foster" trigger
  document.getElementById("home-add-foster-btn")?.addEventListener("click", (event) => {
    if (!localStorage.getItem("pawnir_token")) {
      showAuthStep("credentials");
      document.getElementById("auth-status").textContent = "Sign in first to list a local foster or shelter on Google Maps.";
      openDialog(document.getElementById("auth-dialog"), event.currentTarget);
      return;
    }
    document.getElementById("add-foster-status").textContent = "";
    openDialog(document.getElementById("add-foster-dialog"), event.currentTarget);
  });

  // How it works carousel
  const stepsTrack = document.querySelector(".steps");
  const stepCards = [...document.querySelectorAll("[data-step-card]")];
  const stepDots = [...document.querySelectorAll("[data-step-dot]")];
  let activeStep = 0;
  let syncingSteps = false;
  const showStep = (index, scroll = true) => {
    activeStep = (index + stepCards.length) % stepCards.length;
    stepCards.forEach((card, cardIndex) => card.classList.toggle("is-active", cardIndex === activeStep));
    stepDots.forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === activeStep);
      dot.setAttribute("aria-current", dotIndex === activeStep ? "step" : "false");
    });
    if (scroll && window.matchMedia("(max-width: 640px)").matches) {
      syncingSteps = true;
      stepsTrack.scrollTo({
        left: Math.max(0, stepCards[activeStep].offsetLeft - (stepsTrack.clientWidth - stepCards[activeStep].offsetWidth) / 2),
        behavior: "smooth"
      });
      window.setTimeout(() => { syncingSteps = false; }, 450);
    }
  };
  document.querySelector("[data-step-prev]")?.addEventListener("click", () => showStep(activeStep - 1));
  document.querySelector("[data-step-next]")?.addEventListener("click", () => showStep(activeStep + 1));
  stepDots.forEach((dot) => dot.addEventListener("click", () => showStep(Number(dot.dataset.stepDot))));
  stepsTrack?.addEventListener("scroll", () => {
    if (!window.matchMedia("(max-width: 640px)").matches || syncingSteps) return;
    const center = stepsTrack.scrollLeft + stepsTrack.clientWidth / 2;
    let nearest = 0;
    stepCards.forEach((card, index) => {
      if (Math.abs(card.offsetLeft + card.offsetWidth / 2 - center) < Math.abs(stepCards[nearest].offsetLeft + stepCards[nearest].offsetWidth / 2 - center)) nearest = index;
    });
    if (nearest !== activeStep) showStep(nearest, false);
  }, { passive: true });

  // Auth & Account triggers
  const openAccountOrAuth = async (trigger) => {
    if (localStorage.getItem("pawnir_token")) {
      openDialog(document.getElementById("dashboard-dialog"), trigger);
      await loadDashboard();
    } else {
      showAuthStep("credentials");
      openDialog(document.getElementById("auth-dialog"), trigger);
    }
  };

  document.querySelectorAll("[data-open-auth]").forEach((button) =>
    button.addEventListener("click", (event) => openAccountOrAuth(event.currentTarget))
  );
  document.querySelectorAll("[data-open-dashboard],[data-open-account]").forEach((button) =>
    button.addEventListener("click", (event) => openAccountOrAuth(event.currentTarget))
  );

  // Auth mode tabs & password visibility
  document.querySelectorAll("[data-auth-mode]").forEach((tab) =>
    tab.addEventListener("click", () => setAuthMode(tab.dataset.authMode))
  );
  document.getElementById("toggle-password-btn")?.addEventListener("click", (event) => {
    const pwd = document.getElementById("auth-password");
    const showing = pwd.type === "text";
    pwd.type = showing ? "password" : "text";
    event.currentTarget.textContent = showing ? "Show" : "Hide";
  });

  // Google Sign-In button check
  document.getElementById("google-signin-link")?.addEventListener("click", (event) => {
    if (!state.googleEnabled) {
      event.preventDefault();
      document.getElementById("auth-status").textContent = "Google Sign-In is ready to activate once GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET are added to .env. Please sign in with email below.";
    }
  });

  // 2FA Controls
  document.getElementById("auth-2fa-refresh")?.addEventListener("click", refreshMathChallenge);
  document.getElementById("auth-2fa-back")?.addEventListener("click", () => showAuthStep("credentials"));

  document.getElementById("auth-2fa-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.getElementById("auth-status");
    const submitBtn = document.getElementById("auth-2fa-submit");
    const answer = document.getElementById("auth-2fa-answer").value.trim();
    if (!state.pending2faToken || !state.challengeToken) {
      showAuthStep("credentials");
      return;
    }
    submitBtn.disabled = true;
    const response = await fetch("/api/auth/verify-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pendingToken: state.pending2faToken,
        challengeToken: state.challengeToken,
        answer
      })
    });
    const result = await response.json();
    submitBtn.disabled = false;
    if (!response.ok) {
      status.textContent = result.error || "Incorrect answer. Please try again.";
      if (result.challenge) {
        state.challengeToken = result.challenge.challengeToken;
        document.getElementById("auth-2fa-question").textContent = result.challenge.question;
        document.getElementById("auth-2fa-answer").value = "";
        document.getElementById("auth-2fa-answer").focus();
      }
      return;
    }
    localStorage.setItem("pawnir_token", result.token);
    state.user = result.user;
    state.pending2faToken = null;
    updateAuthUI();
    closeDialog(document.getElementById("auth-dialog"));
    showAuthStep("credentials");
    showToast(`Welcome, ${result.user?.name || "Pet parent"}!`);
    await Promise.all([loadPets(), loadLostReports(), loadDonors(), loadNotifications()]);
  });

  // Sign Out
  document.getElementById("signout-button")?.addEventListener("click", () => {
    localStorage.removeItem("pawnir_token");
    state.user = null;
    pets = [];
    updateAuthUI();
    loadNotifications();
    loadLostReports();
    loadDonors();
    closeDialog(document.getElementById("dashboard-dialog"));
    showToast("Signed out safely.");
  });

  // Notifications dialog
  document.getElementById("notifications-button")?.addEventListener("click", async (event) => {
    await loadNotifications();
    openDialog(document.getElementById("notifications-dialog"), event.currentTarget);
  });
  document.getElementById("mark-notifications-read")?.addEventListener("click", async () => {
    const token = localStorage.getItem("pawnir_token");
    if (!token) return;
    await fetch("/api/notifications/read", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    await loadNotifications();
    showToast("All alerts marked as read.");
  });

  document.getElementById("theme-toggle").addEventListener("click", () =>
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark")
  );
  document.getElementById("language-toggle").addEventListener("click", () =>
    applyLanguage(state.language === "bn" ? "en" : "bn")
  );

  // Lost & Found species filter pills
  document.querySelectorAll("#lost-species-pills [data-lost-species]").forEach((pill) =>
    pill.addEventListener("click", () => {
      lostSpeciesFilter = pill.dataset.lostSpecies || "";
      document.querySelectorAll("#lost-species-pills [data-lost-species]").forEach((btn) =>
        btn.classList.toggle("is-active", btn === pill)
      );
      loadLostReports();
    })
  );

  // Sighting form submission
  document.getElementById("sighting-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selectedSightingReport) return;
    const status = document.getElementById("sighting-status");
    const submitBtn = document.getElementById("sighting-submit-btn");
    submitBtn.disabled = true;
    const response = await fetch(`/api/lost-found/${encodeURIComponent(selectedSightingReport.id)}/sightings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("pawnir_token") },
      body: JSON.stringify({
        location: document.getElementById("sighting-location").value.trim(),
        note: document.getElementById("sighting-note").value.trim(),
        contact: document.getElementById("sighting-contact").value.trim()
      })
    });
    const result = await response.json();
    submitBtn.disabled = false;
    status.textContent = response.ok
      ? "Sighting shared! The pet owner has been notified."
      : (result.error || "Unable to post sighting.");
    status.classList.toggle("is-success", response.ok);
    if (response.ok) {
      document.getElementById("sighting-form").reset();
      lostReportSignature = "";
      await loadLostReports();
      showToast("Sighting tip sent to owner!");
      window.setTimeout(() => closeDialog(document.getElementById("sighting-dialog")), 650);
    }
  });

  // Lost & Found report photo preview + compression
  const photoInput = document.getElementById("report-photo");
  const previewWrap = document.getElementById("report-photo-preview-wrap");
  const previewImg = document.getElementById("report-photo-preview");
  photoInput?.addEventListener("change", async () => {
    const file = photoInput.files?.[0];
    const status = document.getElementById("lost-report-status");
    if (!file) {
      compressedReportPhoto = null;
      previewWrap.hidden = true;
      return;
    }
    try {
      compressedReportPhoto = await compressAndReadPhoto(file);
      previewImg.src = compressedReportPhoto;
      previewWrap.hidden = false;
      status.textContent = "";
    } catch (error) {
      compressedReportPhoto = null;
      previewWrap.hidden = true;
      status.textContent = error.message;
    }
  });
  document.getElementById("report-photo-clear")?.addEventListener("click", () => {
    photoInput.value = "";
    compressedReportPhoto = null;
    previewWrap.hidden = true;
  });

  document.getElementById("report-lost-button").addEventListener("click", (event) => {
    if (!localStorage.getItem("pawnir_token")) {
      showAuthStep("credentials");
      document.getElementById("auth-status").textContent = "Sign in first to publish a nearby animal alert.";
      openDialog(document.getElementById("auth-dialog"), event.currentTarget);
      return;
    }
    document.getElementById("lost-report-status").textContent = "";
    openDialog(document.getElementById("lost-report-dialog"), event.currentTarget);
  });

  document.getElementById("lost-report-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.getElementById("lost-report-status");
    const payload = {
      type: document.querySelector("input[name='report-type']:checked").value,
      species: document.getElementById("report-species").value,
      area: document.getElementById("report-area").value,
      city: document.getElementById("report-city").value,
      title: document.getElementById("report-title").value,
      description: document.getElementById("report-description").value,
      photoData: compressedReportPhoto
    };
    const response = await fetch("/api/lost-found", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("pawnir_token") },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    status.textContent = response.ok
      ? `Alert published. ${result.notifiedCount} nearby members notified.`
      : (result.error || "Unable to publish alert.");
    status.classList.toggle("is-success", response.ok);
    if (response.ok) {
      document.getElementById("lost-report-form").reset();
      compressedReportPhoto = null;
      previewWrap.hidden = true;
      lostReportSignature = "";
      await loadLostReports();
      showToast("Nearby alert published!");
      window.setTimeout(() => closeDialog(document.getElementById("lost-report-dialog")), 700);
    }
  });

  document.getElementById("lost-type-filter").addEventListener("change", loadLostReports);
  document.getElementById("lost-area-input").addEventListener("input", () => {
    clearTimeout(window.pawnirLostTimer);
    window.pawnirLostTimer = setTimeout(loadLostReports, 220);
  });

  document.getElementById("nearby-alert-button").addEventListener("click", async (event) => {
    const token = localStorage.getItem("pawnir_token");
    const area = document.getElementById("lost-area-input").value.trim();
    if (!token) {
      showAuthStep("credentials");
      document.getElementById("auth-status").textContent = "Sign in first to receive nearby animal alerts.";
      openDialog(document.getElementById("auth-dialog"), event.currentTarget);
      return;
    }
    if (!area) {
      document.getElementById("lost-area-input").focus();
      showToast("Enter your area name first (e.g. Dhanmondi 10).");
      return;
    }
    const response = await fetch("/api/lost-found/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ area, city: document.getElementById("report-city")?.value || "Dhaka" })
    });
    const result = await response.json();
    event.currentTarget.textContent = response.ok ? "Alerts enabled ✓" : (result.error || "Try again");
    if (response.ok) showToast(`Subscribed to alerts near ${area}`);
  });

  // Donors & Donor Request sheet
  document.getElementById("register-donor-button").addEventListener("click", (event) => {
    if (!localStorage.getItem("pawnir_token")) {
      showAuthStep("credentials");
      document.getElementById("auth-status").textContent = "Sign in first to register an animal donor.";
      openDialog(document.getElementById("auth-dialog"), event.currentTarget);
      return;
    }
    document.getElementById("donor-status").textContent = "";
    openDialog(document.getElementById("donor-dialog"), event.currentTarget);
  });

  document.getElementById("donor-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const response = await fetch("/api/donors", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("pawnir_token") },
      body: JSON.stringify({
        petName: document.getElementById("donor-pet-name")?.value.trim() || "",
        species: document.getElementById("donor-species").value,
        weightKg: document.getElementById("donor-weight")?.value || null,
        vaccinated: document.getElementById("donor-vaccinated")?.value !== "false",
        area: document.getElementById("donor-area").value.trim(),
        city: document.getElementById("donor-city").value,
        bloodType: document.getElementById("donor-blood-type").value,
        consent: document.getElementById("donor-consent").checked,
        eligibilityAcknowledged: document.getElementById("donor-eligible").checked
      })
    });
    const result = await response.json();
    const status = document.getElementById("donor-status");
    status.textContent = response.ok
      ? "Registered & live in the verified donor network!"
      : (result.error || "Unable to register donor.");
    status.classList.toggle("is-success", response.ok);
    if (response.ok) {
      document.getElementById("donor-form").reset();
      await loadDonors();
      showToast("Donor registered and active!");
      window.setTimeout(() => closeDialog(document.getElementById("donor-dialog")), 700);
    }
  });

  document.getElementById("donor-request-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selectedDonor) return;
    const status = document.getElementById("donor-request-status");
    const submitBtn = document.getElementById("donor-request-submit");
    submitBtn.disabled = true;
    const response = await fetch(`/api/donors/${encodeURIComponent(selectedDonor.id)}/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("pawnir_token") },
      body: JSON.stringify({
        clinic: document.getElementById("donor-request-clinic")?.value.trim() || "",
        contactPhone: document.getElementById("donor-request-phone")?.value.trim() || "",
        reason: document.getElementById("donor-request-reason").value.trim()
      })
    });
    const result = await response.json();
    submitBtn.disabled = false;
    status.textContent = response.ok
      ? "Urgent request sent! The donor owner has been notified immediately."
      : (result.error || "Unable to send request.");
    status.classList.toggle("is-success", response.ok);
    if (response.ok) {
      if (selectedDonor.button) {
        selectedDonor.button.textContent = "Request sent ✓";
        selectedDonor.button.disabled = true;
      }
      document.getElementById("donor-request-form").reset();
      showToast("Urgent blood request sent!");
      window.setTimeout(() => closeDialog(document.getElementById("donor-request-dialog")), 750);
    }
  });

  ["donor-species-filter", "donor-blood-filter"].forEach((id) =>
    document.getElementById(id).addEventListener("change", loadDonors)
  );
  document.getElementById("donor-area-input").addEventListener("input", () => {
    clearTimeout(window.pawnirDonorTimer);
    window.pawnirDonorTimer = setTimeout(loadDonors, 220);
  });

  // Adoptions
  document.getElementById("adoption-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const response = await fetch("/api/adoptions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("pawnir_token") },
      body: JSON.stringify({
        listingId: selectedAdoption.id,
        housing: document.getElementById("adopt-housing").value,
        experience: document.getElementById("adopt-experience").value,
        household: document.getElementById("adopt-household").value,
        vetPlan: document.getElementById("adopt-vet-plan").value
      })
    });
    const result = await response.json();
    document.getElementById("adoption-status").textContent = response.ok
      ? "Application submitted for screening."
      : (result.error || "Unable to submit application.");
    if (response.ok) {
      const link = document.getElementById("adoption-pdf-link");
      link.hidden = false;
      link.href = `/api/adoptions/${encodeURIComponent(result.applicationId)}/pdf`;
      link.download = `pawnir-adoption-${result.applicationId}.pdf`;
      showToast("Adoption application submitted!");
    }
  });

  // Fosters, Google Maps Foster Registration & Real Review System
  document.getElementById("foster-city-filter").addEventListener("change", loadFosters);

  document.getElementById("add-foster-button")?.addEventListener("click", (event) => {
    if (!localStorage.getItem("pawnir_token")) {
      showAuthStep("credentials");
      document.getElementById("auth-status").textContent = "Sign in first to list a local foster or shelter on Google Maps.";
      openDialog(document.getElementById("auth-dialog"), event.currentTarget);
      return;
    }
    document.getElementById("add-foster-status").textContent = "";
    openDialog(document.getElementById("add-foster-dialog"), event.currentTarget);
  });

  document.getElementById("add-foster-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.getElementById("add-foster-status");
    const submitBtn = document.getElementById("add-foster-submit");
    submitBtn.disabled = true;
    const response = await fetch("/api/fosters", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("pawnir_token") },
      body: JSON.stringify({
        name: document.getElementById("new-foster-name").value.trim(),
        city: document.getElementById("new-foster-city").value,
        area: document.getElementById("new-foster-area").value.trim(),
        mapQuery: document.getElementById("new-foster-map-query").value.trim(),
        capacity: document.getElementById("new-foster-capacity").value.trim(),
        phone: document.getElementById("new-foster-phone").value.trim(),
        species: document.getElementById("new-foster-species").value,
        description: document.getElementById("new-foster-description").value.trim()
      })
    });
    const result = await response.json();
    submitBtn.disabled = false;
    status.textContent = response.ok
      ? "Foster home added & pinned on Google Maps!"
      : (result.error || "Unable to add foster care.");
    status.classList.toggle("is-success", response.ok);
    if (response.ok) {
      document.getElementById("add-foster-form").reset();
      activeMapFosterId = result.id;
      await loadFosters();
      showToast("Foster care added to Google Maps explorer!");
      window.setTimeout(() => closeDialog(document.getElementById("add-foster-dialog")), 700);
    }
  });

  document.getElementById("foster-request-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const response = await fetch(`/api/fosters/${encodeURIComponent(selectedFoster.id)}/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("pawnir_token") },
      body: JSON.stringify({ reason: document.getElementById("foster-request-reason").value })
    });
    const result = await response.json();
    const status = document.getElementById("foster-request-status");
    status.textContent = response.ok
      ? "Request sent. A registered foster team can now review it."
      : (result.error || "Unable to send request.");
    status.classList.toggle("is-success", response.ok);
    if (response.ok) {
      document.getElementById("foster-request-form").reset();
      showToast("Foster care request sent!");
      window.setTimeout(() => closeDialog(document.getElementById("foster-request-dialog")), 750);
    }
  });

  // Interactive 5-Star Picker
  document.querySelectorAll("#star-rating-picker .star-btn").forEach((btn) => {
    btn.addEventListener("click", () => updateStarPickerUI(Number(btn.dataset.starValue)));
    btn.addEventListener("mouseenter", () => updateStarPickerUI(Number(btn.dataset.starValue)));
  });

  document.getElementById("foster-review-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selectedFoster) return;
    const token = localStorage.getItem("pawnir_token");
    if (!token) {
      showAuthStep("credentials");
      document.getElementById("auth-status").textContent = "Sign in first to publish a verified community review.";
      openDialog(document.getElementById("auth-dialog"), event.submitter);
      return;
    }
    const submitBtn = document.getElementById("foster-review-submit");
    const status = document.getElementById("foster-review-status");
    submitBtn.disabled = true;
    const response = await fetch(`/api/fosters/${encodeURIComponent(selectedFoster.id)}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({
        rating: Number(document.getElementById("foster-review-rating").value),
        comment: document.getElementById("foster-review-comment").value.trim()
      })
    });
    const result = await response.json();
    submitBtn.disabled = false;
    status.textContent = response.ok
      ? (result.updated ? "Your review has been updated!" : "Thank you! Your review is now live.")
      : (result.error || "Unable to submit review.");
    status.classList.toggle("is-success", response.ok);
    if (response.ok) {
      document.getElementById("foster-review-comment").value = "";
      await Promise.all([refreshFosterReviewSheet(selectedFoster.id), loadFosters()]);
      showToast("Community review published!");
    }
  });

  // Profile & Pets
  document.getElementById("profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const response = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("pawnir_token") },
      body: JSON.stringify({
        name: document.getElementById("profile-name").value,
        area: document.getElementById("profile-area").value,
        bio: document.getElementById("profile-bio").value
      })
    });
    const result = await response.json();
    document.getElementById("profile-status").textContent = response.ok
      ? "Profile saved."
      : (result.error || "Unable to save profile.");
    if (response.ok && result.user) {
      state.user = result.user;
      updateAuthUI();
      showToast("Profile updated!");
    }
  });

  document.getElementById("pet-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = localStorage.getItem("pawnir_token");
    const response = await fetch("/api/pets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: document.getElementById("pet-name").value,
        species: document.getElementById("pet-species").value
      })
    });
    const result = await response.json();
    document.getElementById("pet-status").textContent = response.ok
      ? `${result.name} added to your care space.`
      : result.error;
    if (response.ok) {
      event.target.reset();
      await loadPets();
      await loadDashboard();
      showToast(`${result.name} added!`);
    }
  });

  // Step 1 Auth Form -> Step 2 Math 2FA Verification
  document.getElementById("auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.getElementById("auth-status");
    const submitBtn = document.getElementById("auth-submit-btn");
    const payload = {
      email: document.getElementById("auth-email").value.trim(),
      password: document.getElementById("auth-password").value,
      name: document.getElementById("auth-name").value.trim(),
      require2fa: true
    };
    submitBtn.disabled = true;
    let response;
    if (state.authMode === "register") {
      response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } else {
      response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (response.status === 401 && payload.name) {
        response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }
    }
    const result = await response.json();
    submitBtn.disabled = false;
    if (!response.ok) {
      status.textContent = result.error || "Invalid email or password. New here? Switch to 'Create account'.";
      return;
    }
    if (result.requires2fa && result.pendingToken) {
      state.pending2faToken = result.pendingToken;
      showAuthStep("2fa", result.challenge);
      return;
    }
    if (result.token) {
      localStorage.setItem("pawnir_token", result.token);
      await syncSession();
      closeDialog(document.getElementById("auth-dialog"));
      await loadPets();
      showToast("Signed in!");
    }
  });

  // Initial Data Load & Real-time Updates
  loadLostReports();
  const refreshLostFeed = () => {
    if (!document.hidden) loadLostReports();
  };
  lostRefreshTimer = window.setInterval(refreshLostFeed, 12000);
  document.addEventListener("visibilitychange", refreshLostFeed);
  connectRealtimeStream();
  loadFosters();
  loadDonors();
  loadAdoptions();
});
