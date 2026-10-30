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
let adoptionSpeciesFilter = "";
let pendingReviewFoster = null;
let pendingAdoptionAction = null;
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
    "nav.features": "Features",
    "nav.screens": "Screens",
    "nav.comingsoon": "Coming soon",
    "nav.playcta": "Get it on Google Play",
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
    "adopt.title": "Adopt or rehome responsibly",
    "adopt.btnList": "+ List a pet for adoption",
    "adopt.filterAll": "All animals",
    "adopt.filterCats": "🐱 Cats",
    "adopt.filterDogs": "🐶 Dogs",
    "adopt.filterBirds": "🦜 Birds",
    "adopt.filterRabbits": "🐰 Rabbits",
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
    "nav.lost": "হারানো প্রাণী",
    "nav.lostShort": "অ্যালার্ট",
    "nav.donors": "রক্তদাতা",
    "nav.donorsShort": "রক্তদাতা",
    "nav.adopt": "দত্তক",
    "nav.adoptShort": "দত্তক",
    "nav.foster": "ফস্টার কেয়ার",
    "nav.find": "জরুরি ভেট",
    "nav.how": "যেভাবে কাজ করে",
    "nav.features": "ফিচারসমূহ",
    "nav.screens": "স্ক্রিনশট",
    "nav.comingsoon": "শীঘ্রই আসছে",
    "nav.playcta": "গুগল প্লে স্টোরে পান",
    "nav.vets": "ভেটদের জন্য",
    "nav.care": "আমার যত্ন",
    "nav.signin": "সাইন ইন",
    "nav.bookings": "বুকিং",
    "nav.profile": "অ্যাকাউন্ট",
    "hero.eyebrow": "কাছের মানুষ, বিপন্ন প্রাণের পাশে",
    "hero.title": "প্রাণীদের যখন সাহায্য প্রয়োজন,<br /><em>আপনার এলাকা পাশে দাঁড়ায়।</em>",
    "hero.subtitle": "PawNir সারা বাংলাদেশে হারানো প্রাণীর দ্রুত অ্যালার্ট, দায়িত্বশীল দত্তক ও পুনর্বাসন, জরুরি রক্তদাতা নেটওয়ার্ক, ফস্টার কেয়ার এবং বিশ্বস্ত ভেটেরিনারি সেবাকে এক মায়ার ঠিকানায় যুক্ত করেছে।",
    "hero.cta": "PawNir কীভাবে সাহায্য করে",
    "hero.vetLink": "নিকটস্থ ভেটেরিনারিয়ান",
    "hero.trust": "<strong>১০,০০০+</strong> সচেতন পেট প্যারেন্ট<br />ইতিমধ্যে PawNir-এ আস্থা রাখেন",
    "hero.badge1Title": "যাচাইকৃত নেটওয়ার্ক",
    "hero.badge1Sub": "কমিউনিটি দ্বারা সুরক্ষিত",
    "hero.badge2Sub": "পেট প্যারেন্টদের প্রথম পছন্দ",
    "mission.eyebrow": "প্রাণী সুরক্ষায় এক প্ল্যাটফর্ম",
    "mission.title": "অগোছালো সোশ্যাল পোস্ট নয়।<br /><em>সঠিক এলাকার মানুষের কাছে সরাসরি বার্তা।</em>",
    "mission.badge": "বাংলাদেশের প্রাণীদের জন্য",
    "mission.exampleLabel": "একটি বাস্তব উদাহরণ",
    "mission.exampleTitle": "ধানমন্ডি ১০ থেকে আপনার বিড়ালটি হারিয়ে গেছে।",
    "mission.exampleText": "অসংখ্য অসংলগ্ন গ্রুপে পোস্ট না করে, PawNir ওই এলাকার নিবন্ধিত প্রাণীপ্রেমীদের ফোনে সাথে সাথে সতর্কবার্তা পাঠায়: <strong>“আপনার এলাকায় একটি পোষা প্রাণী হারিয়েছে।”</strong> সম্পূর্ণ স্থানীয়, নিরাপদ ও কার্যকর।",
    "mission.exampleNote": "শুধুমাত্র আনুমানিক এলাকা · উভয়পক্ষের সম্মতিতে যোগাযোগ",
    "mission.alertTitle": "আপনার কাছেই হারানো প্রাণী",
    "mission.alertSub": "ধানমন্ডি ১০ এর কাছে বিড়াল রিপোর্ট করা হয়েছে",
    "mission.alertMeta": "এই এলাকার ৮৯ জন প্রাণীপ্রেমীকে সতর্ক করা হয়েছে",
    "mission.safety": "<strong>নিরাপত্তা ও নৈতিকতার অঙ্গীকার:</strong> PawNir-এ জীবন্ত প্রাণী কেনা-বেচা আইনত ও নীতিগতভাবে সম্পূর্ণ নিষিদ্ধ। যাচাইকরণ, সম্মতি এবং প্রাণী কল্যাণই আমাদের একমাত্র লক্ষ্য।",
    "service.lostTitle": "হারানো ও প্রাপ্তি অ্যালার্ট",
    "service.lostDesc": "আপনার এলাকার মানবিক মানুষদের কাছে দ্রুত সন্ধানবার্তা।",
    "service.adoptTitle": "নিরাপদ দত্তক ও পুনর্বাসন",
    "service.adoptDesc": "যাচাই ও নিয়মিত ফলো-আপের মাধ্যমে প্রাণীকে দিন সুরক্ষিত নতুন পরিবার।",
    "service.bloodTitle": "জরুরি রক্তদাতা নেটওয়ার্ক",
    "service.bloodDesc": "সংকটাপন্ন মুহূর্তে পোষা প্রাণীর রক্তের গ্রুপ অনুযায়ী কাছের রক্তদাতা।",
    "service.circleTitle": "স্থানীয় অ্যানিমেল সার্কেল",
    "service.circleDesc": "আপনার এলাকার প্রাণীপ্রেমীদের সাথে সরাসরি যুক্ত হোন।",
    "service.vetTitle": "জরুরি ভেট সেবা",
    "service.vetDesc": "প্রয়োজনের মুহূর্তে সঠিক ভেটেরিনারি পরামর্শ ও সহায়তা।",
    "service.fosterTitle": "ফস্টার ও আশ্রয়কেন্দ্র",
    "service.fosterDesc": "গুগল ম্যাপসে নিবন্ধিত নিরাপদ ফস্টার হোম ও শেল্টার।",
    "service.shopTitle": "সামগ্রী ও জরুরি পরিবহন",
    "service.shopDesc": "PetBhai-এর মাধ্যমে প্রয়োজনীয় খাবার ও প্রাণী পরিবহনের সহায়তা।",
    "lost.eyebrow": "কাছাকাছি মানুষের ভালোবাসা",
    "lost.title": "আপনার আশেপাশে হারানো ও পাওয়া প্রাণী",
    "lost.reportBtn": "হারানো প্রাণীর রিপোর্ট করুন",
    "lost.alertBtn": "আমার এলাকায় অ্যালার্ট চালু করুন",
    "donor.eyebrow": "জরুরি সংকট মুহূর্তে",
    "donor.title": "প্রাণী রক্তদাতা নেটওয়ার্ক",
    "donor.registerBtn": "রক্তদাতা হিসেবে যুক্ত হোন",
    "donor.disclaimer": "PawNir সম্মতিপ্রাপ্ত দাতাদের তালিকাভুক্ত করে; রক্ত সঞ্চালনের আগে অবশ্যই রেজিস্টার্ড ভেটেরিনারিয়ানের ক্রস-ম্যাচ ও স্বাস্থ্য পরীক্ষা আবশ্যক।",
    "adopt.eyebrow": "একটি নিরাপদ ও মায়ার ঠিকানা",
    "adopt.title": "ভালোবাসায় দত্তক নিন বা পুনর্বাসন করুন",
    "adopt.btnList": "+ দত্তকের জন্য যুক্ত করুন",
    "adopt.filterAll": "সকল প্রাণী",
    "adopt.filterCats": "🐱 বিড়াল",
    "adopt.filterDogs": "🐶 কুকুর",
    "adopt.filterBirds": "🦜 পাখি",
    "adopt.filterRabbits": "🐰 খরগোশ",
    "foster.eyebrow": "যাচাইকৃত স্থানীয় যত্ন",
    "foster.title": "ফস্টার বা নিরাপদ আশ্রয়কেন্দ্র খুঁজুন",
    "vet.eyebrow": "বিশেষজ্ঞ চিকিৎসকের যত্ন",
    "vet.title": "অনলাইন ভেট কনসালটেশন,<br /><em>PawNir-এর ভেতরেই।</em>",
    "vet.desc": "আমরা অভিজ্ঞ ভেটেরিনারিয়ানদের সমন্বয়ে সরাসরি অ্যাপয়েন্টমেন্ট ও ডিজিটাল প্রেসক্রিপশন সেবা প্রস্তুত করছি। ততক্ষণ আমাদের পার্টনার Catwaala-তে স্থানীয় ভেটদের তথ্য দেখতে পারেন।",
    "vet.btn": "Catwaala-তে স্থানীয় ভেট খুঁজুন",
    "vet.artTitle": "ভেট কনসালটেশন",
    "vet.artSub": "শীঘ্রই আসছে PawNir-এ",
    "how.eyebrow": "সহজ ও কার্যকর",
    "how.title": "সহজ তিন ধাপে সুরক্ষা",
    "how.step1Title": "কাছের সহায়তা খুঁজুন",
    "how.step1Desc": "এলাকা অনুযায়ী রক্তদাতা, দত্তকের প্রাণী, ফস্টার বা ভেট সেন্টার খুঁজুন।",
    "how.step2Title": "নিরাপদ যোগাযোগ",
    "how.step2Desc": "ব্যক্তিগত গোপনীয়তা বজায় রেখে প্ল্যাটফর্মের মাধ্যমে যোগাযোগ করুন।",
    "how.step3Title": "প্রতিটি প্রাণীর সুরক্ষা",
    "how.step3Desc": "ডিজিটাল পেট পাসপোর্ট, ভ্যাকসিন হিস্ট্রি ও এলাকার সতর্কবার্তা একসাথে।",
    "banner.eyebrow": "ভেটেরিনারি চিকিৎসকদের জন্য",
    "banner.title": "সেবার জন্য থাকুক<br /><em>আরও বেশি সময়।</em>",
    "banner.desc": "আপনার চেম্বার ও রোগীদের সেবা আরও ডিজিটাল করতে PawNir নেটওয়ার্কে যুক্ত হোন।",
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
    const homeCountLost = document.getElementById("home-count-lost");
    if (homeCountLost) {
      homeCountLost.textContent = `${reports.length} open alert${reports.length === 1 ? "" : "s"} ↗`;
    }
    if (reports.length > 0) {
      const topReport = reports[0];
      const snapArea = document.getElementById("snapshot-lost-area");
      const snapTitle = document.getElementById("snapshot-lost-title");
      const snapDesc = document.getElementById("snapshot-lost-desc");
      if (snapArea) snapArea.textContent = `⌖ ${topReport.area || "Dhaka"}`;
      if (snapTitle) snapTitle.textContent = topReport.title || "Nearby pet alert";
      if (snapDesc) snapDesc.textContent = (topReport.description || "").slice(0, 115) + ((topReport.description || "").length > 115 ? "…" : "");
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
  const ratingText = foster.rating ? `★ ${foster.rating} (${foster.reviewCount} reviews)` : "New community foster";
  const activeTitle = document.getElementById("foster-map-active-title");
  if (activeTitle) activeTitle.textContent = foster.name;
  const activeMeta = document.getElementById("foster-map-active-meta");
  if (activeMeta) activeMeta.textContent = `⌖ ${foster.area}, ${foster.city} · ★ ${foster.rating || "5.0"} (${foster.reviewCount || 0} reviews)`;
  const activeDesc = document.getElementById("foster-map-active-desc");
  if (activeDesc) activeDesc.textContent = foster.description;

  const dirLink = document.getElementById("foster-map-directions-link") || document.getElementById("foster-map-external-link");
  if (dirLink && (foster.mapUrl || foster.embedMapUrl)) {
    dirLink.href = foster.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(foster.name + " " + foster.area + " Bangladesh")}`;
  }
  const reviewBtn = document.getElementById("foster-map-review-btn") || document.getElementById("foster-map-reviews-btn");
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
    const homeCountFosters = document.getElementById("home-count-fosters");
    if (homeCountFosters) {
      homeCountFosters.textContent = `${cachedFosters.length} on Google Maps ↗`;
    }
    const topFoster = [...cachedFosters].sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0))[0] || cachedFosters[0];
    const snapRating = document.getElementById("snapshot-foster-rating");
    const snapTitle = document.getElementById("snapshot-foster-title");
    const snapDesc = document.getElementById("snapshot-foster-desc");
    if (snapRating) snapRating.textContent = `★ ${topFoster.rating || "5.0"} · ${topFoster.area}`;
    if (snapTitle) snapTitle.textContent = topFoster.name;
    if (snapDesc) snapDesc.textContent = (topFoster.description || "").slice(0, 115) + ((topFoster.description || "").length > 115 ? "…" : "");
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

  const homeCountDonors = document.getElementById("home-count-donors");
  if (homeCountDonors) {
    homeCountDonors.textContent = `${donors.length} verified donor${donors.length === 1 ? "" : "s"} ↗`;
  }
  if (donors.length > 0) {
    const topDonor = donors[0];
    const speciesLabel = topDonor.species === "cat" ? "Cat" : "Dog";
    const snapBlood = document.getElementById("snapshot-donor-blood");
    const snapTitle = document.getElementById("snapshot-donor-title");
    const snapDesc = document.getElementById("snapshot-donor-desc");
    if (snapBlood) snapBlood.textContent = `🩸 ${topDonor.bloodType} · ${topDonor.area}`;
    if (snapTitle) snapTitle.textContent = `${topDonor.petName || speciesLabel} (${speciesLabel} donor)`;
    if (snapDesc) snapDesc.textContent = `Consented & vaccinated ${speciesLabel.toLowerCase()} donor ready near ${topDonor.area}, ${topDonor.city}.`;
  }

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
  const areaInput = document.getElementById("adoption-area-input");
  const area = areaInput ? areaInput.value.trim() : "";
  const params = new URLSearchParams();
  if (adoptionSpeciesFilter) params.set("species", adoptionSpeciesFilter);
  if (area) params.set("area", area);
  params.set("includeMine", "1");

  const token = localStorage.getItem("pawnir_token");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  try {
    const response = await fetch(`/api/adoptions?${params.toString()}`, { headers });
    const data = await response.json();
    const listings = Array.isArray(data) ? data : (Array.isArray(data.listings) ? data.listings : []);

    const homeCountAdopt = document.getElementById("home-count-adopt");
    if (homeCountAdopt) {
      homeCountAdopt.textContent = `${listings.length} pet${listings.length === 1 ? "" : "s"} ready ↗`;
    }

    const liveCountEl = document.getElementById("adoption-live-count");
    if (liveCountEl) {
      liveCountEl.innerHTML = `<span class="live-pulse"></span> ${listings.length} verified pet${listings.length === 1 ? "" : "s"} ready`;
    }

    const grid = document.getElementById("adoption-grid");
    if (!grid) return;

    if (!listings.length) {
      grid.innerHTML = `
        <div class="adoption-empty-card">
          <div class="empty-icon">🐾</div>
          <h4>No pets found matching this filter</h4>
          <p>Try clearing your species or location filter, or be the first to list a rescue pet needing a loving home.</p>
          <div class="empty-actions">
            <button class="btn btn-small btn-outline" id="adoption-reset-filters-btn" type="button">Reset all filters</button>
            <button class="btn btn-small btn-primary" id="adoption-empty-list-btn" type="button">+ List a pet for adoption</button>
          </div>
        </div>
      `;
      document.getElementById("adoption-reset-filters-btn")?.addEventListener("click", () => {
        adoptionSpeciesFilter = "";
        if (areaInput) areaInput.value = "";
        document.querySelectorAll("#adoption-species-pills [data-adoption-species]").forEach((p) => {
          p.classList.toggle("active", !p.dataset.adoptionSpecies);
        });
        const select = document.getElementById("adoption-species-filter");
        if (select) select.value = "";
        loadAdoptions();
      });
      document.getElementById("adoption-empty-list-btn")?.addEventListener("click", () => {
        document.getElementById("list-adoption-button")?.click();
      });
      return;
    }

    grid.innerHTML = listings.map((listing) => {
      const isOwner = Boolean(listing.isOwner || (state.user && listing.ownerId === state.user.id));
      const speciesEmoji = listing.species === "cat" ? "🐱" : listing.species === "dog" ? "🐶" : listing.species === "bird" ? "🦜" : listing.species === "rabbit" ? "🐰" : "🐾";
      const speciesLabel = listing.species ? listing.species.charAt(0).toUpperCase() + listing.species.slice(1) : "Rescue";
      const statusPill = listing.status === "adopted"
        ? '<span class="sleek-status-pill pill-adopted">✓ Rehomed</span>'
        : (isOwner ? '<span class="sleek-status-pill pill-owner">Your Listing</span>' : '<span class="sleek-status-pill pill-open">Open for Adoption</span>');
      const vaxBadge = listing.vaccinated !== false ? '<span class="sleek-tag tag-vax">💉 Vaccinated</span>' : '';
      const neuteredBadge = listing.neutered ? '<span class="sleek-tag tag-neutered">✂ Neutered</span>' : '';
      const indoorBadge = listing.indoorOnly ? '<span class="sleek-tag tag-indoor">🏠 Indoor Only</span>' : '';

      return `
        <article class="adoption-card ${isOwner ? 'is-my-listing' : ''}">
          <div class="sleek-card-header">
            <span class="sleek-species-chip">
              <span class="chip-emoji" aria-hidden="true">${speciesEmoji}</span>
              <span>${escapeHtml(speciesLabel)}</span>
            </span>
            ${statusPill}
          </div>
          <h3>${escapeHtml(listing.name)}</h3>
          <div class="sleek-meta-row">
            <span>⌖ ${escapeHtml(listing.area || "Dhaka")}</span>
            <span class="sleek-meta-dot" aria-hidden="true">•</span>
            <span>🎂 ${escapeHtml(listing.age || "Young")}</span>
            ${listing.gender ? `<span class="sleek-meta-dot" aria-hidden="true">•</span><span>${escapeHtml(listing.gender)}</span>` : ""}
            ${listing.breed ? `<span class="sleek-meta-dot" aria-hidden="true">•</span><span>${escapeHtml(listing.breed)}</span>` : ""}
          </div>
          <p class="sleek-card-bio">${escapeHtml(listing.description || "")}</p>
          <div class="sleek-tags-row">
            ${vaxBadge}
            ${neuteredBadge}
            ${indoorBadge}
          </div>
          <div class="adoption-card-actions">
            ${isOwner
              ? `<button class="btn btn-small btn-outline manage-my-adopt-btn" type="button">Manage in Profile ↗</button>`
              : `<button class="btn btn-small btn-primary adoption-apply-button" data-listing="${escapeHtml(listing.id)}" data-name="${escapeHtml(listing.name)}" type="button">Apply to adopt ♡</button>`
            }
          </div>
        </article>
      `;
    }).join("");

    grid.querySelectorAll(".adoption-apply-button").forEach((button) =>
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

    grid.querySelectorAll(".manage-my-adopt-btn").forEach((button) =>
      button.addEventListener("click", (event) => {
        openDialog(document.getElementById("dashboard-dialog"), event.currentTarget);
        const activityTab = document.querySelector('[data-dash-tab="activity"]');
        if (activityTab) activityTab.click();
      })
    );
  } catch (err) {
    // network error fallback
  }
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
  if (!token) return;
  const headers = { Authorization: `Bearer ${token}` };

  const [bookings, petList, prescriptions, profile, fosterRequests, adoptionsData, lostData] = await Promise.all([
    fetch("/api/bookings", { headers }).then((res) => (res.ok ? res.json() : [])),
    fetch("/api/pets", { headers }).then((res) => (res.ok ? res.json() : [])),
    fetch("/api/prescriptions", { headers }).then((res) => (res.ok ? res.json() : [])),
    fetch("/api/auth/me", { headers }).then((res) => (res.ok ? res.json() : null)),
    fetch("/api/foster-requests", { headers }).then((res) => (res.ok ? res.json() : [])),
    fetch("/api/adoptions?includeMine=1", { headers }).then((res) => (res.ok ? res.json() : [])),
    fetch("/api/lost-found", { headers }).then((res) => (res.ok ? res.json() : []))
  ]);

  if (profile && profile.user) {
    state.user = profile.user;
    updateAuthUI();
    const initials = (state.user.name || "P").charAt(0).toUpperCase();
    const initialsEl = document.getElementById("dashboard-user-initials");
    if (initialsEl) initialsEl.textContent = initials;
    const nameEl = document.getElementById("dashboard-user-name");
    if (nameEl) nameEl.textContent = state.user.name || "Pet Parent";
    const emailEl = document.getElementById("dashboard-user-email");
    if (emailEl) emailEl.textContent = state.user.email || "";
    const areaChip = document.getElementById("dashboard-user-area-chip");
    if (areaChip) areaChip.textContent = `⌖ ${state.user.area || "Dhaka"}`;

    const profName = document.getElementById("profile-name");
    if (profName) profName.value = state.user.name || "";
    const profArea = document.getElementById("profile-area");
    if (profArea) profArea.value = state.user.area || "";
    const profBio = document.getElementById("profile-bio");
    if (profBio) profBio.value = state.user.bio || "";
  }

  // 1. Pet Passports Grid
  const petsGrid = document.getElementById("dashboard-pets");
  if (petsGrid) {
    if (Array.isArray(petList) && petList.length) {
      pets = petList;
      petsGrid.innerHTML = petList.map((pet) => {
        const icon = pet.species === "cat" ? "🐱" : pet.species === "dog" ? "🐶" : pet.species === "bird" ? "🦜" : pet.species === "rabbit" ? "🐰" : "🐾";
        return `
          <div class="pet-passport-card">
            <div class="passport-icon">${icon}</div>
            <div class="passport-info">
              <strong>${escapeHtml(pet.name)}</strong>
              <p>${escapeHtml(pet.species.toUpperCase())}${pet.breed ? ` · ${escapeHtml(pet.breed)}` : ""}${pet.age ? ` · ${escapeHtml(pet.age)}` : ""}</p>
              <div class="passport-tags">
                <span class="passport-tag">Verified Digital Passport</span>
                <span class="passport-tag tag-green">✓ Active Care</span>
              </div>
            </div>
          </div>
        `;
      }).join("");
    } else {
      petsGrid.innerHTML = '<p class="inline-state">No pet passports registered yet. Click <strong>+ Register pet</strong> to add your first companion.</p>';
    }
  }

  // 2. User's Adoption Listings
  const myAdoptionsEl = document.getElementById("dashboard-my-adoptions");
  if (myAdoptionsEl) {
    const rawList = Array.isArray(adoptionsData) ? adoptionsData : (Array.isArray(adoptionsData.myListings) ? adoptionsData.myListings : []);
    const myListings = rawList.filter((item) => item.isOwner || (state.user && item.ownerId === state.user.id));
    if (myListings.length) {
      myAdoptionsEl.innerHTML = myListings.map((item) => `
        <div class="dashboard-item">
          <div>
            <strong>${escapeHtml(item.name)} (${escapeHtml(item.species)})</strong>
            <span>${escapeHtml(item.area || "Dhaka")} · Status: <strong class="${item.status === "adopted" ? "text-green" : ""}">${escapeHtml(item.status || "open")}</strong></span>
          </div>
          ${item.status !== "adopted"
            ? `<button class="btn btn-small btn-primary mark-rehomed-btn" data-rehome-id="${escapeHtml(item.id)}" type="button">Mark Rehomed ✓</button>`
            : `<small class="status-pill-rehomed">Rehomed successfully ✓</small>`
          }
        </div>
      `).join("");

      myAdoptionsEl.querySelectorAll(".mark-rehomed-btn").forEach((btn) => {
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          const patchRes = await fetch(`/api/adoptions/listings/${encodeURIComponent(btn.dataset.rehomeId)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status: "adopted" })
          });
          if (patchRes.ok) {
            showToast("Marked as safely rehomed! 🎉");
            await Promise.all([loadDashboard(), loadAdoptions()]);
          } else {
            showToast("Unable to update listing status.");
            btn.disabled = false;
          }
        });
      });
    } else {
      myAdoptionsEl.innerHTML = '<p class="inline-state">No adoption listings published yet. Rehome a rescue directly from the adoption portal.</p>';
    }
  }

  // 3. User's Lost & Found Alerts
  const myLostEl = document.getElementById("dashboard-my-lost");
  if (myLostEl) {
    const myLost = (Array.isArray(lostData) ? lostData : []).filter((item) => state.user && (item.userId === state.user.id || item.reportedBy === state.user.name));
    if (myLost.length) {
      myLostEl.innerHTML = myLost.map((item) => `
        <div class="dashboard-item">
          <div>
            <strong>${escapeHtml(item.title || item.species)}</strong>
            <span>${escapeHtml(item.area || item.city)} · Status: <strong>${escapeHtml(item.status || "active")}</strong></span>
          </div>
          <span class="profile-area-pill">${escapeHtml(item.type === "lost" ? "Lost Pet" : "Found Pet")}</span>
        </div>
      `).join("");
    } else {
      myLostEl.innerHTML = '<p class="inline-state">No active lost or found alerts posted by you.</p>';
    }
  }

  // 4. Foster Care Requests
  const fosterEl = document.getElementById("dashboard-foster-requests");
  if (fosterEl) {
    fosterEl.innerHTML = Array.isArray(fosterRequests) && fosterRequests.length
      ? fosterRequests.slice(0, 4).map((req) => `<div class="dashboard-item"><strong>Foster inquiry</strong><span>${escapeHtml(req.reason ? req.reason.slice(0, 60) : "")}</span><small>Status: ${escapeHtml(req.status || "pending")}</small></div>`).join("")
      : '<p class="inline-state">No foster requests yet.</p>';
  }

  // 5. Clinic Visits & Prescriptions
  const bookingItems = Array.isArray(bookings) ? bookings : [];
  const rxItems = Array.isArray(prescriptions) ? prescriptions : [];
  const bookingsEl = document.getElementById("dashboard-bookings");
  if (bookingsEl) {
    if (bookingItems.length || rxItems.length) {
      bookingsEl.innerHTML = [
        ...bookingItems.slice(0, 3).map((booking) => `<div class="dashboard-item"><strong>${escapeHtml(booking.vetName || "Vet")}</strong><span>${escapeHtml(booking.date || "")} · ${escapeHtml(booking.time || "")}</span><small>${escapeHtml(booking.petName || "Pet")} · ${escapeHtml(booking.status || "confirmed")}</small></div>`),
        ...rxItems.slice(0, 2).map((item) => `<div class="dashboard-item"><strong>Rx: ${escapeHtml(item.items?.[0]?.medicine || "Prescription")}</strong><span>${new Date(item.issuedAt).toLocaleDateString("en-BD")}</span></div>`)
      ].join("");
    } else {
      bookingsEl.innerHTML = '<p class="inline-state">No clinic visits or prescriptions recorded yet.</p>';
    }
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
  if (event.key === "Escape") {
    const menuDrawer = document.getElementById("menu-drawer");
    if (menuDrawer?.classList.contains("is-open")) {
      event.preventDefault();
      menuDrawer.classList.remove("is-open");
      menuDrawer.setAttribute("aria-hidden", "true");
      document.getElementById("menu-toggle-btn")?.classList.remove("is-active");
      document.getElementById("menu-toggle-btn")?.setAttribute("aria-expanded", "false");
      const backdrop = document.getElementById("menu-drawer-backdrop");
      if (backdrop) {
        backdrop.classList.remove("is-open");
        setTimeout(() => { backdrop.hidden = true; }, 280);
      }
      return;
    }
    if (activeDialog) {
      event.preventDefault();
      closeDialog(activeDialog);
    }
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  document.querySelectorAll(".booking-dialog").forEach(wireDialog);

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
    await Promise.all([loadPets(), loadLostReports(), loadDonors(), loadNotifications(), loadAdoptions()]);
    if (pendingReviewFoster) {
      const foster = pendingReviewFoster;
      pendingReviewFoster = null;
      openFosterReviews(foster.id, foster.name);
      showToast(`Welcome! You can now review ${foster.name}.`);
    } else if (pendingAdoptionAction === "list") {
      pendingAdoptionAction = null;
      openDialog(document.getElementById("list-adoption-dialog"));
    } else {
      showToast("Signed in with Google!");
    }
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

  document.querySelectorAll(".hero-copy, .hero-art, .mission-section, .lost-found-section, .donor-section, .adoption-section, .foster-section, .vet-coming-soon, .how-it-works, .mobile-app-showcase, .vet-banner").forEach((element) => element.classList.add("reveal"));
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
    if (rawHash === "mobile-app") {
      document.body.dataset.view = "home";
      document.getElementById("mobile-app")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (rawHash === "download-app") {
      document.body.dataset.view = "home";
      document.getElementById("download-app")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (rawHash === "how-it-works") {
      document.body.dataset.view = "home";
      document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (["privacy", "terms", "guidelines"].includes(rawHash)) {
      document.body.dataset.view = "home";
      showPolicyTab(rawHash);
      openDialog(document.getElementById("policy-dialog"));
      return;
    }
    const dedicatedViews = ["foster-care", "lost-found", "blood-donors", "adoption", "find-care"];
    const view = dedicatedViews.includes(rawHash) ? rawHash : "home";
    document.body.dataset.view = view;

    // Desktop top-bar navigation link active styling
    document.querySelectorAll(".site-nav-links .site-nav-link").forEach((link) => {
      const href = (link.getAttribute("href") || "").replace(/^#/, "");
      link.classList.toggle("is-active", href === rawHash);
    });

    // Desktop header active nav styling
    document.querySelectorAll(".main-nav a").forEach((link) => {
      const href = (link.getAttribute("href") || "").replace(/^#/, "");
      const isHomeLink = href === "main" || href === "home";
      link.classList.toggle("is-active", (view === "home" && isHomeLink) || href === view);
    });

    // Drawer active nav styling
    document.querySelectorAll(".drawer-nav [data-drawer-link]").forEach((link) => {
      const target = link.dataset.drawerLink;
      const isHome = target === "home" && (view === "home");
      link.classList.toggle("is-active", isHome || target === view);
    });

    // Scroll smoothly to top on view change
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ── Top-Right 3-Bar Slide-Out Drawer Controls ──
  const menuToggleBtn = document.getElementById("menu-toggle-btn");
  const menuDrawer = document.getElementById("menu-drawer");
  const menuBackdrop = document.getElementById("menu-drawer-backdrop");
  const drawerCloseBtn = document.getElementById("drawer-close-btn");

  function openMenuDrawer() {
    if (!menuDrawer) return;
    menuDrawer.classList.add("is-open");
    menuDrawer.setAttribute("aria-hidden", "false");
    menuToggleBtn?.classList.add("is-active");
    menuToggleBtn?.setAttribute("aria-expanded", "true");
    if (menuBackdrop) {
      menuBackdrop.hidden = false;
      requestAnimationFrame(() => menuBackdrop.classList.add("is-open"));
    }
  }

  function closeMenuDrawer() {
    if (!menuDrawer) return;
    menuDrawer.classList.remove("is-open");
    menuDrawer.setAttribute("aria-hidden", "true");
    menuToggleBtn?.classList.remove("is-active");
    menuToggleBtn?.setAttribute("aria-expanded", "false");
    if (menuBackdrop) {
      menuBackdrop.classList.remove("is-open");
      setTimeout(() => {
        if (!menuDrawer.classList.contains("is-open")) {
          menuBackdrop.hidden = true;
        }
      }, 280);
    }
  }

  menuToggleBtn?.addEventListener("click", () => {
    const isOpen = menuDrawer?.classList.contains("is-open");
    if (isOpen) {
      closeMenuDrawer();
    } else {
      openMenuDrawer();
    }
  });

  drawerCloseBtn?.addEventListener("click", closeMenuDrawer);
  menuBackdrop?.addEventListener("click", closeMenuDrawer);

  // Close drawer when clicking any link inside the drawer
  menuDrawer?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      closeMenuDrawer();
    });
  });

  // Wire drawer care button
  menuDrawer?.querySelector("[data-open-dashboard]")?.addEventListener("click", (e) => {
    closeMenuDrawer();
    if (!localStorage.getItem("pawnir_token")) {
      showAuthStep("credentials");
      openDialog(document.getElementById("auth-dialog"), e.currentTarget);
      return;
    }
    openDialog(document.getElementById("dashboard-dialog"), e.currentTarget);
  });

  window.addEventListener("hashchange", updateViewFromHash);
  updateViewFromHash();

  // Homepage Snapshot quick-action triggers
  document.getElementById("home-report-lost-btn")?.addEventListener("click", (event) => {
    if (!localStorage.getItem("pawnir_token")) {
      showAuthStep("credentials");
      document.getElementById("auth-status").textContent = "Sign in first to report a lost or found animal.";
      openDialog(document.getElementById("auth-dialog"), event.currentTarget);
      return;
    }
    document.getElementById("lost-report-status").textContent = "";
    openDialog(document.getElementById("lost-report-dialog"), event.currentTarget);
  });

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
    await Promise.all([loadPets(), loadLostReports(), loadDonors(), loadNotifications(), loadAdoptions()]);
    if (pendingReviewFoster) {
      const foster = pendingReviewFoster;
      pendingReviewFoster = null;
      openFosterReviews(foster.id, foster.name);
      showToast(`Welcome! You can now review ${foster.name}.`);
    } else if (pendingAdoptionAction === "list") {
      pendingAdoptionAction = null;
      openDialog(document.getElementById("list-adoption-dialog"));
    } else {
      showToast(`Welcome, ${result.user?.name || "Pet parent"}!`);
    }
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
  document.getElementById("list-adoption-button")?.addEventListener("click", (event) => {
    if (!localStorage.getItem("pawnir_token")) {
      pendingAdoptionAction = "list";
      showAuthStep("credentials");
      document.getElementById("auth-status").textContent = "Sign in first to list an animal for adoption.";
      openDialog(document.getElementById("auth-dialog"), event.currentTarget);
      return;
    }
    const statusEl = document.getElementById("list-adoption-status");
    if (statusEl) statusEl.textContent = "";
    openDialog(document.getElementById("list-adoption-dialog"), event.currentTarget);
  });

  document.querySelectorAll("[data-close-adoption-form]").forEach((btn) => {
    btn.addEventListener("click", () => closeDialog(document.getElementById("list-adoption-dialog")));
  });

  document.querySelectorAll("#adoption-species-pills [data-adoption-species]").forEach((pill) => {
    pill.addEventListener("click", () => {
      adoptionSpeciesFilter = pill.dataset.adoptionSpecies || "";
      document.querySelectorAll("#adoption-species-pills [data-adoption-species]").forEach((p) => {
        p.classList.toggle("active", p === pill);
      });
      const select = document.getElementById("adoption-species-filter");
      if (select) select.value = adoptionSpeciesFilter;
      loadAdoptions();
    });
  });

  document.getElementById("adoption-species-filter")?.addEventListener("change", (e) => {
    adoptionSpeciesFilter = e.target.value;
    document.querySelectorAll("#adoption-species-pills [data-adoption-species]").forEach((p) => {
      p.classList.toggle("active", p.dataset.adoptionSpecies === adoptionSpeciesFilter);
    });
    loadAdoptions();
  });

  document.getElementById("adoption-area-input")?.addEventListener("input", () => {
    clearTimeout(window.pawnirAdoptTimer);
    window.pawnirAdoptTimer = setTimeout(loadAdoptions, 250);
  });

  document.getElementById("list-adoption-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = localStorage.getItem("pawnir_token");
    if (!token) {
      pendingAdoptionAction = "list";
      showAuthStep("credentials");
      document.getElementById("auth-status").textContent = "Sign in first to list an animal for adoption.";
      openDialog(document.getElementById("auth-dialog"), event.currentTarget);
      return;
    }
    const statusEl = document.getElementById("list-adoption-status");
    const submitBtn = document.getElementById("adopt-submit-button");
    if (submitBtn) submitBtn.disabled = true;

    const payload = {
      name: document.getElementById("adopt-pet-name").value.trim(),
      species: document.getElementById("adopt-pet-species").value,
      breed: document.getElementById("adopt-pet-breed")?.value.trim() || "",
      age: document.getElementById("adopt-pet-age").value.trim(),
      gender: document.getElementById("adopt-pet-gender")?.value || "Unknown",
      area: document.getElementById("adopt-pet-area").value.trim(),
      vaccinated: document.getElementById("adopt-pet-vaccinated")?.checked !== false,
      neutered: document.getElementById("adopt-pet-neutered")?.checked === true,
      indoorOnly: document.getElementById("adopt-pet-indoor")?.checked !== false,
      description: document.getElementById("adopt-pet-desc").value.trim()
    };

    const response = await fetch("/api/adoptions/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (submitBtn) submitBtn.disabled = false;

    if (!response.ok) {
      if (statusEl) statusEl.textContent = result.error || "Unable to publish listing.";
      return;
    }

    if (statusEl) statusEl.textContent = "Adoption listing published successfully!";
    showToast(`${result.name || "Pet"} listed for free adoption! ♡`);
    document.getElementById("list-adoption-form").reset();
    window.setTimeout(() => closeDialog(document.getElementById("list-adoption-dialog")), 600);
    await Promise.all([loadAdoptions(), loadDashboard()]);
  });

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
      pendingReviewFoster = { id: selectedFoster.id, name: selectedFoster.name };
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
        name: document.getElementById("pet-name").value.trim(),
        species: document.getElementById("pet-species").value,
        breed: document.getElementById("pet-breed")?.value.trim() || "",
        age: document.getElementById("pet-age")?.value.trim() || ""
      })
    });
    const result = await response.json();
    const statusEl = document.getElementById("pet-status");
    if (statusEl) statusEl.textContent = response.ok ? `${result.name} added to your care space.` : result.error;
    if (response.ok) {
      event.target.reset();
      event.target.hidden = true;
      await Promise.all([loadPets(), loadDashboard()]);
      showToast(`${result.name} added to Pet Passports!`);
    }
  });

  // Toggle pet registration form
  document.getElementById("toggle-add-pet-btn")?.addEventListener("click", () => {
    const pf = document.getElementById("pet-form");
    if (pf) {
      pf.hidden = !pf.hidden;
      if (!pf.hidden) document.getElementById("pet-name")?.focus();
    }
  });
  document.getElementById("cancel-add-pet-btn")?.addEventListener("click", () => {
    const pf = document.getElementById("pet-form");
    if (pf) pf.hidden = true;
  });

  // Modern Dashboard Tabs
  document.querySelectorAll("[data-dash-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.dashTab;
      document.querySelectorAll("[data-dash-tab]").forEach((t) => {
        const isTarget = t === tab;
        t.classList.toggle("is-active", isTarget);
        t.setAttribute("aria-selected", String(isTarget));
      });
      document.querySelectorAll(".dash-panel").forEach((panel) => {
        panel.classList.toggle("is-active", panel.id === `dash-panel-${target}`);
      });
    });
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
      await Promise.all([loadPets(), loadLostReports(), loadDonors(), loadNotifications(), loadAdoptions()]);
      if (pendingReviewFoster) {
        const foster = pendingReviewFoster;
        pendingReviewFoster = null;
        openFosterReviews(foster.id, foster.name);
        showToast(`Welcome! You can now review ${foster.name}.`);
      } else if (pendingAdoptionAction === "list") {
        pendingAdoptionAction = null;
        openDialog(document.getElementById("list-adoption-dialog"));
      } else {
        showToast("Signed in!");
      }
    }
  });

  // ── Automated & Swipeable Smartphone Showcase Carousel ──
  const screensTrack = document.getElementById("phone-screens-track");
  const sliderDots = document.querySelectorAll("#phone-slider-dots .slider-dot");
  const phoneFrame = document.getElementById("phone-frame-container");
  const totalSlides = 4;
  let currentSlide = 0;
  let autoSlideTimer = null;

  function goToSlide(index) {
    currentSlide = (index + totalSlides) % totalSlides;
    if (screensTrack) {
      screensTrack.style.transform = `translateX(-${currentSlide * 100}%)`;
    }
    sliderDots.forEach((dot, idx) => {
      dot.classList.toggle("is-active", idx === currentSlide);
      dot.setAttribute("aria-selected", String(idx === currentSlide));
    });
  }

  function startAutoSlide() {
    stopAutoSlide();
    autoSlideTimer = setInterval(() => {
      goToSlide(currentSlide + 1);
    }, 3200);
  }

  function stopAutoSlide() {
    if (autoSlideTimer) {
      clearInterval(autoSlideTimer);
      autoSlideTimer = null;
    }
  }

  // Click on indicator dot
  sliderDots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const idx = parseInt(dot.dataset.slideIndex, 10);
      if (!isNaN(idx)) {
        goToSlide(idx);
        startAutoSlide();
      }
    });
  });

  // Touch Swipe Gesture Support
  if (phoneFrame) {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    phoneFrame.addEventListener("touchstart", (e) => {
      stopAutoSlide();
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    phoneFrame.addEventListener("touchend", (e) => {
      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;
      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 35) {
        if (diffX < 0) {
          goToSlide(currentSlide + 1);
        } else {
          goToSlide(currentSlide - 1);
        }
      }
      startAutoSlide();
    }, { passive: true });

    // Pause on mouse hover (desktop)
    phoneFrame.addEventListener("mouseenter", stopAutoSlide);
    phoneFrame.addEventListener("mouseleave", startAutoSlide);
  }

  // Start initial auto-cycle
  startAutoSlide();

  // App Store & Google Play Download & PWA Install Handlers
  let deferredInstallPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
  });

  document.getElementById("btn-google-play")?.addEventListener("click", () => {
    showToast("Google Play release coming soon! Tap 'Web App (PWA)' to install directly on your Android phone.");
  });

  document.getElementById("btn-app-store")?.addEventListener("click", () => {
    showToast("iOS App is in TestFlight Beta! On Safari, tap Share ↗ → 'Add to Home Screen' to install right now.");
  });

  document.getElementById("btn-pwa-install")?.addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice.outcome === "accepted") {
        showToast("PawNir is installing to your home screen!");
      }
      deferredInstallPrompt = null;
    } else {
      showToast("To install PawNir: on Chrome tap menu ⋮ → 'Install App'; on iPhone Safari tap Share ↗ → 'Add to Home Screen'.");
    }
  });

  // Legal Policies & Community Guidelines modal
  function showPolicyTab(tabKey) {
    const policyTabs = document.querySelectorAll("[data-policy-tab]");
    const policyArticles = document.querySelectorAll(".policy-article");
    policyTabs.forEach((t) => {
      const isTarget = t.dataset.policyTab === tabKey;
      t.classList.toggle("is-active", isTarget);
      t.setAttribute("aria-selected", String(isTarget));
    });
    policyArticles.forEach((article) => {
      article.classList.toggle("is-active", article.id === `policy-panel-${tabKey}`);
    });
  }

  document.querySelectorAll("[data-policy-tab]").forEach((tab) => {
    tab.addEventListener("click", () => showPolicyTab(tab.dataset.policyTab));
  });

  document.querySelectorAll("[data-policy]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      const policyKey = btn.dataset.policy || "privacy";
      showPolicyTab(policyKey);
      openDialog(document.getElementById("policy-dialog"), event.currentTarget);
    });
  });

  document.querySelectorAll("[data-close-policy]").forEach((btn) => {
    btn.addEventListener("click", () => closeDialog(document.getElementById("policy-dialog")));
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
