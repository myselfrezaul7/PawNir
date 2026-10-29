const state = { mode: "all", language: document.documentElement.lang || "en" };
const taka = (value) => `৳${new Intl.NumberFormat("en-BD").format(value)}`;
let vets = [];
let selectedVet = null;
let pets = [];
let activeDialog = null;
let dialogTrigger = null;
let lockedScrollY = 0;
const copy = {
  en: { "nav.find": "Find a vet", "nav.how": "How it works", "nav.vets": "For vets", "nav.care": "My care", "nav.signin": "Sign in", "nav.bookings": "Bookings", "nav.profile": "Profile" },
  bn: { "nav.find": "ভেট খুঁজুন", "nav.how": "যেভাবে কাজ করে", "nav.vets": "ভেটদের জন্য", "nav.care": "আমার যত্ন", "nav.signin": "সাইন ইন", "nav.bookings": "বুকিং", "nav.profile": "প্রোফাইল" }
};

function dialogFocusable(dialog) {
  return dialog.querySelector("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])");
}
function openDialog(dialog, trigger) {
  if (!dialog || dialog.open) return;
  activeDialog = dialog; dialogTrigger = trigger || document.activeElement;
  dialog.setAttribute("aria-modal", "true"); lockedScrollY = window.scrollY;
  document.body.style.top = `-${lockedScrollY}px`; document.body.classList.add("dialog-open");
  dialog.showModal(); requestAnimationFrame(() => dialog.classList.add("is-visible"));
  const first = dialogFocusable(dialog); if (first) first.focus();
}
function closeDialog(dialog) {
  if (!dialog || !dialog.open) return;
  dialog.classList.remove("is-visible");
  window.setTimeout(() => {
    if (dialog.open) dialog.close();
    if (activeDialog === dialog) {
      document.body.classList.remove("dialog-open"); document.body.style.top = "";
      window.scrollTo(0, lockedScrollY); if (dialogTrigger && document.contains(dialogTrigger)) dialogTrigger.focus();
      activeDialog = null; dialogTrigger = null;
    }
  }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180);
}
function wireDialog(dialog) {
  dialog.addEventListener("click", (event) => { if (event.target === dialog) closeDialog(dialog); });
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); closeDialog(dialog); });
  dialog.querySelectorAll("[data-close-auth],[data-close-dashboard],.dialog-close").forEach((button) => button.addEventListener("click", (event) => { event.preventDefault(); closeDialog(dialog); }));
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusables = [...dialog.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])")];
    const index = focusables.indexOf(document.activeElement);
    if (event.shiftKey && index <= 0) { event.preventDefault(); focusables[focusables.length - 1].focus(); }
    if (!event.shiftKey && index === focusables.length - 1) { event.preventDefault(); focusables[0].focus(); }
  });
}
function setTheme(theme) {
  document.documentElement.dataset.theme = theme; localStorage.setItem("pawnir-theme", theme);
  const toggle = document.getElementById("theme-toggle"); const dark = theme === "dark";
  toggle.setAttribute("aria-pressed", String(dark)); toggle.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
}
function applyLanguage(language) {
  state.language = language; document.documentElement.lang = language;
  document.querySelectorAll("[data-i18n]").forEach((element) => { if (copy[language][element.dataset.i18n]) element.textContent = copy[language][element.dataset.i18n]; });
  document.getElementById("language-toggle").textContent = language === "bn" ? "English" : "বাংলা";
}
function setLoading(loading) {
  const grid = document.getElementById("vet-grid");
  if (loading) grid.innerHTML = Array.from({ length: 4 }, () => '<article class="vet-card skeleton-card" aria-hidden="true"><div class="skeleton skeleton-head"></div><div class="skeleton-body"><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line"></div></div></article>').join("");
}
async function loadVets() {
  setLoading(true);
  const params = new URLSearchParams({ q: document.getElementById("search-input").value.trim(), specialty: document.getElementById("specialty-filter").value, city: document.getElementById("city-filter").value, mode: state.mode });
  try {
    const response = await fetch(`/api/vets?${params}`); if (!response.ok) throw new Error("Unable to load veterinarians.");
    vets = await response.json(); renderVets();
  } catch (error) {
    document.getElementById("vet-grid").innerHTML = `<div class="inline-state error-state" role="alert">${error.message} <button class="btn btn-small btn-outline" id="retry-vets">Try again</button></div>`;
    document.getElementById("retry-vets").addEventListener("click", loadVets);
  }
}
let selectedFoster = null;
let selectedAdoption = null;
let lostRefreshTimer = null;
let lostReportSignature = "";
  function reportCard(report) {
    const label = report.type === "lost" ? "Lost" : "Found";
    return `<article class="lost-report-card"><div class="lost-report-top"><span class="report-pill ${report.type}">${label}</span><span>${new Date(report.createdAt).toLocaleDateString("en-BD", { day: "numeric", month: "short" })}</span></div><h3>${report.title}</h3><p>${report.description}</p><div class="lost-report-meta"><span>⌖ ${report.area}, ${report.city}</span><span>${report.species}</span></div></article>`;
  }
  async function loadLostReports() {
    const area = document.getElementById("lost-area-input").value.trim();
    const type = document.getElementById("lost-type-filter").value;
    const grid = document.getElementById("lost-report-grid");
    if (!grid.querySelector(".lost-report-card")) grid.innerHTML = '<p class="inline-state">Loading nearby reports…</p>';
    try {
      const response = await fetch(`/api/lost-found?area=${encodeURIComponent(area)}&type=${encodeURIComponent(type)}`);
      if (!response.ok) throw new Error("Unable to load nearby reports.");
      const result = await response.json();
      const reports = Array.isArray(result) ? result : result.reports;
      const signature = reports.map((report) => `${report.id}:${report.updatedAt || report.createdAt}:${report.status}`).join("|");
      const changed = signature !== lostReportSignature;
      lostReportSignature = signature;
      if (changed || !grid.querySelector(".lost-report-card")) {
        grid.innerHTML = reports.length ? reports.map(reportCard).join("") : '<p class="inline-state">No open reports in this area yet. You can be the first to alert nearby animal lovers.</p>';
      }
      const liveStatus = document.getElementById("lost-live-status");
      if (liveStatus) liveStatus.innerHTML = `<span class="live-pulse" aria-hidden="true"></span><strong>${changed ? "Live feed updated" : "Live nearby feed"}</strong><span>Updated ${new Date().toLocaleTimeString("en-BD", { hour: "numeric", minute: "2-digit" })}</span>`;
    } catch (error) {
      grid.innerHTML = `<p class="inline-state error-state" role="alert">${error.message}</p>`;
    }
  }
    function fosterCard(foster) {
      const rating = foster.rating ? `★ ${foster.rating} (${foster.reviewCount})` : "No reviews yet";
      return `<article class="foster-card"><div class="foster-card-top"><span class="foster-mark">⌂</span><span class="verified-badge"><span class="icon icon-check" aria-hidden="true"></span> Registered</span></div><h3>${foster.name}</h3><p>${foster.description}</p><div class="foster-meta"><span>⌖ ${foster.area}, ${foster.city}</span><span>${rating}</span></div><small>${foster.capacity} · ${foster.species.join(" · ")}</small><div class="foster-actions"><a class="btn btn-small btn-outline" href="${foster.mapUrl}" target="_blank" rel="noopener noreferrer">Open map ↗</a><button class="btn btn-small btn-dark foster-request-button" data-foster="${foster.id}" data-name="${foster.name}" type="button">Request care</button><button class="foster-review-link" data-foster="${foster.id}" data-name="${foster.name}" type="button">Review</button></div></article>`;
    }
    async function loadFosters() {
      const city = document.getElementById("foster-city-filter").value;
      const response = await fetch(`/api/fosters?city=${encodeURIComponent(city)}`);
      const fosters = await response.json();
      document.getElementById("foster-grid").innerHTML = fosters.length ? fosters.map(fosterCard).join("") : '<p class="inline-state">No registered foster care matches this filter.</p>';
      document.querySelectorAll(".foster-request-button").forEach((button) => button.addEventListener("click", (event) => {
        selectedFoster = { id: button.dataset.foster, name: button.dataset.name };
        if (!localStorage.getItem("pawnir_token")) { document.getElementById("auth-status").textContent = "Sign in first to request foster care."; openDialog(document.getElementById("auth-dialog"), event.currentTarget); return; }
        document.getElementById("foster-request-title").textContent = `Request care from ${selectedFoster.name}`;
        openDialog(document.getElementById("foster-request-dialog"), event.currentTarget);
      }));
      document.querySelectorAll(".foster-review-link").forEach((button) => button.addEventListener("click", (event) => {
        selectedFoster = { id: button.dataset.foster, name: button.dataset.name };
        if (!localStorage.getItem("pawnir_token")) { document.getElementById("auth-status").textContent = "Sign in first to review foster care."; openDialog(document.getElementById("auth-dialog"), event.currentTarget); return; }
        document.getElementById("foster-review-title").textContent = `Review ${selectedFoster.name}`;
        openDialog(document.getElementById("foster-review-dialog"), event.currentTarget);
      }));
    }
    function donorCard(donor) {
      return `<article class="donor-card"><div class="donor-card-top"><span class="donor-mark">+</span><span class="verified-badge">${donor.verified ? "Verified" : "Pending"}</span></div><h3>${donor.species === "cat" ? "Cat" : "Dog"} donor · ${donor.bloodType}</h3><p>Available near ${donor.area}, ${donor.city}</p><small>Consent given · Vet suitability check required</small><button class="btn btn-small btn-dark donor-request-button" data-donor="${donor.id}" type="button">Request connection</button></article>`;
    }
    async function loadDonors() {
      const params = new URLSearchParams({ area: document.getElementById("donor-area-input").value.trim(), species: document.getElementById("donor-species-filter").value, bloodType: document.getElementById("donor-blood-filter").value });
      const response = await fetch(`/api/donors?${params}`);
      const donors = await response.json();
      const grid = document.getElementById("donor-grid");
      grid.innerHTML = donors.length ? donors.map(donorCard).join("") : '<p class="inline-state">No verified available donors match this search yet.</p>';
      grid.querySelectorAll(".donor-request-button").forEach((button) => button.addEventListener("click", async () => {
        if (!localStorage.getItem("pawnir_token")) { document.getElementById("auth-status").textContent = "Sign in first to request a donor connection."; openDialog(document.getElementById("auth-dialog"), button); return; }
        const reason = window.prompt("Briefly describe the urgent need. A vet must confirm suitability.");
        if (!reason) return;
        const response = await fetch(`/api/donors/${encodeURIComponent(button.dataset.donor)}/requests`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("pawnir_token") }, body: JSON.stringify({ reason }) });
        const result = await response.json();
        button.textContent = response.ok ? "Request sent" : (result.error || "Try again");
        button.disabled = response.ok;
      }));
    }
    async function loadAdoptions() {
      const response = await fetch("/api/adoptions");
      const listings = await response.json();
      document.getElementById("adoption-grid").innerHTML = listings.length ? listings.map((listing) => `<article class="adoption-card"><span class="adoption-mark">♡</span><h3>${listing.name}</h3><p>${listing.species} · ${listing.area}</p><p>${listing.description}</p><button class="btn btn-small btn-dark adoption-apply-button" data-listing="${listing.id}" data-name="${listing.name}" type="button">Apply safely</button></article>`).join("") : '<p class="inline-state">No verified adoption listings are open right now.</p>';
      document.querySelectorAll(".adoption-apply-button").forEach((button) => button.addEventListener("click", (event) => {
        selectedAdoption = { id: button.dataset.listing, name: button.dataset.name };
        if (!localStorage.getItem("pawnir_token")) { document.getElementById("auth-status").textContent = "Sign in first to apply for adoption."; openDialog(document.getElementById("auth-dialog"), event.currentTarget); return; }
        document.getElementById("adoption-form-title").textContent = `Apply to adopt ${selectedAdoption.name}`;
        openDialog(document.getElementById("adoption-dialog"), event.currentTarget);
      }));
    }
function card(vet, index) {
  const modeLabel = vet.modes.includes("online") ? "Video & clinic" : "In-clinic";
  return `<article class="vet-card reveal revealed" style="--stagger:${Math.min(index, 7) * 45}ms">
    <div class="vet-card-head ${vet.tone}"><span class="vet-avatar">${vet.initials}</span><span class="verified-badge"><span class="icon icon-check" aria-hidden="true"></span> Verified</span></div>
    <div class="vet-card-body"><div class="vet-name-row"><div><h3>${vet.name}</h3><p>${vet.specialty}</p></div><span class="rating">★ ${vet.rating}</span></div>
      <p class="clinic-line"><span class="icon icon-pin" aria-hidden="true"></span> ${vet.clinic} · ${vet.city}</p>
      <div class="vet-meta"><span><span class="icon icon-clock" aria-hidden="true"></span> ${vet.available}</span><span>${modeLabel}</span><span>${vet.languages?.join(" · ") || "Bangla · English"}</span></div>
      <div class="vet-card-foot"><span class="fee">${taka(vet.fee)} <small>/ visit</small></span><button class="btn btn-small btn-dark book-button" data-vet="${vet.name}" type="button">Book a slot</button></div>
    </div></article>`;
}
function renderVets() {
  const grid = document.getElementById("vet-grid"); grid.innerHTML = vets.length ? vets.map(card).join("") : '<div class="inline-state">No vets match those filters yet. Try another city or care type.</div>';
  document.getElementById("empty-state").hidden = vets.length > 0;
  grid.querySelectorAll(".vet-card").forEach((vetCard) => vetCard.addEventListener("click", (event) => {
    if (event.target.closest(".book-button")) return;
    openVetProfile(vetCard.querySelector(".book-button").dataset.vet, vetCard);
  }));
  grid.querySelectorAll(".book-button").forEach((button) => button.addEventListener("click", (event) => { event.stopPropagation(); openBooking(button.dataset.vet, event.currentTarget); }));
}
function selectVet(name) {
  selectedVet = vets.find((item) => item.name === name) || null;
  const bar = document.getElementById("mobile-booking-bar");
  if (selectedVet) {
    document.getElementById("mobile-booking-name").textContent = selectedVet.name;
    bar.hidden = false;
  } else bar.hidden = true;
}
function openVetProfile(name, trigger) {
  selectVet(name);
  if (!selectedVet) return;
  document.getElementById("vet-profile-content").innerHTML = `<div class="profile-avatar ${selectedVet.tone}">${selectedVet.initials}</div><p class="eyebrow">Verified veterinarian</p><h2>${selectedVet.name}</h2><p class="profile-specialty">${selectedVet.specialty}</p><div class="profile-rating">★ ${selectedVet.rating} <span>(${selectedVet.reviews} reviews)</span></div><div class="profile-facts"><span><strong>${selectedVet.available}</strong><small>Next availability</small></span><span><strong>${taka(selectedVet.fee)}</strong><small>Per visit</small></span><span><strong>${selectedVet.city}</strong><small>${selectedVet.clinic}</small></span></div><p class="profile-note">Available for ${selectedVet.modes.includes("online") ? "video consultation" : "in-clinic visits"} in ${selectedVet.languages?.join(" and ") || "Bangla and English"}.</p>`;
  openDialog(document.getElementById("vet-profile-dialog"), trigger);
}
async function loadPets() {
  const token = localStorage.getItem("pawnir_token"); if (!token) return [];
  const response = await fetch("/api/pets", { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) throw new Error("Unable to load pet profiles.");
  pets = await response.json();
  document.getElementById("booking-pet").innerHTML = pets.length ? pets.map((pet) => `<option value="${pet.id}">${pet.name} · ${pet.species}</option>`).join("") : '<option value="">Add a pet in My care first</option>';
  return pets;
}
async function loadAvailability() {
  if (!selectedVet) return;
  const date = document.getElementById("booking-date").value;
  if (!date) return;
  const mode = document.getElementById("booking-mode").value.startsWith("Video") ? "online" : "clinic";
  const response = await fetch(`/api/vets/${encodeURIComponent(selectedVet.id)}/availability?date=${encodeURIComponent(date)}&mode=${mode}`);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to load availability.");
  const select = document.getElementById("booking-time");
  select.innerHTML = result.slots.length ? result.slots.map((slot) => `<option>${slot}</option>`).join("") : '<option value="">No slots available</option>';
  select.disabled = result.slots.length === 0;
  document.getElementById("booking-status").textContent = result.slots.length ? "" : "No available slots for this date and consultation type.";
}
async function loadDashboard() {
  const token = localStorage.getItem("pawnir_token");
  if (!token) { document.getElementById("dashboard-bookings").textContent = "Sign in to see your visits."; return; }
  const headers = { Authorization: `Bearer ${token}` };
  const [bookings, petList, prescriptions, profile] = await Promise.all(["/api/bookings", "/api/pets", "/api/prescriptions", "/api/auth/me"].map((path) => fetch(path, { headers }).then((response) => response.json())));
  if (profile.user) {
    document.getElementById("profile-name").value = profile.user.name || "";
    document.getElementById("profile-area").value = profile.user.area || "";
    document.getElementById("profile-bio").value = profile.user.bio || "";
  }
  document.getElementById("dashboard-bookings").innerHTML = bookings.length ? bookings.slice(0, 4).map((booking) => `<div class="dashboard-item"><strong>${booking.vetName}</strong><span>${booking.date} · ${booking.time}</span><small>${booking.petName || "Pet"} · ${booking.status}</small></div>`).join("") : "No bookings yet.";
  document.getElementById("dashboard-pets").innerHTML = petList.length ? petList.map((pet) => `<div class="dashboard-item"><strong>${pet.name}</strong><span>${pet.species}${pet.breed ? ` · ${pet.breed}` : ""}</span></div>`).join("") : "Add your first pet below.";
  document.getElementById("dashboard-prescriptions").innerHTML = prescriptions.length ? prescriptions.slice(0, 4).map((item) => `<div class="dashboard-item"><strong>${item.items[0]?.medicine || "Prescription"}</strong><span>${new Date(item.issuedAt).toLocaleDateString()}</span></div>`).join("") : "No prescriptions yet.";
}
function updateBookingStep(step) {
  document.querySelectorAll(".booking-step-panel").forEach((panel) => panel.classList.toggle("is-current", Number(panel.dataset.step) === step));
  document.querySelectorAll(".booking-steps li").forEach((item, index) => item.classList.toggle("is-current", index + 1 === step));
  const next = document.querySelector(`[data-step="${step}"] .step-next`); if (next) next.focus();
}
function refreshBookingSummary() {
  const pet = pets.find((item) => item.id === document.getElementById("booking-pet").value);
  document.getElementById("booking-summary").innerHTML = `<strong>${selectedVet?.name || "Veterinarian"}</strong><span>${document.getElementById("booking-date").value || "Choose a date"} · ${document.getElementById("booking-time").value}</span><span>${pet?.name || "Choose a pet"} · ${document.getElementById("booking-mode").value}</span>`;
}
function openBooking(name, trigger) {
  selectVet(name); if (!selectedVet) return;
  document.getElementById("booking-title").textContent = `Book with ${selectedVet.name}`;
  document.getElementById("booking-vet-detail").textContent = `${selectedVet.specialty} · ${selectedVet.city} · from ${taka(selectedVet.fee)} per visit`;
  document.getElementById("booking-date").min = new Date().toISOString().slice(0, 10);
  document.getElementById("booking-status").textContent = ""; updateBookingStep(1);
  loadPets().catch((error) => { document.getElementById("booking-status").textContent = error.message; });
  document.getElementById("booking-date").value = "";
  document.getElementById("booking-time").innerHTML = '<option value="">Choose a date first</option>';
  document.getElementById("booking-time").disabled = true;
  openDialog(document.getElementById("booking-dialog"), trigger);
}
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && activeDialog) { event.preventDefault(); closeDialog(activeDialog); } });

document.addEventListener("DOMContentLoaded", () => {
  const googleToken = new URLSearchParams(window.location.hash.slice(1)).get("google_token");
  const authError = new URLSearchParams(window.location.search).get("auth_error");
  if (googleToken) {
    localStorage.setItem("pawnir_token", googleToken);
    window.history.replaceState({}, "", window.location.pathname);
  }
  if (authError) {
    const status = document.getElementById("auth-status");
    if (status) status.textContent = "Google sign-in could not be completed. Please try again.";
  }
  document.querySelectorAll(".booking-dialog").forEach(wireDialog);
  wireDialog(document.getElementById("vet-profile-dialog"));
  document.querySelectorAll(".hero-copy, .hero-art, .search-panel, .directory, .how-it-works, .vet-banner").forEach((element) => element.classList.add("reveal"));
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("revealed"); observer.unobserve(entry.target); } }), { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
  const stepsTrack = document.querySelector(".steps");
  const stepCards = [...document.querySelectorAll("[data-step-card]")];
  const stepDots = [...document.querySelectorAll("[data-step-dot]")];
  let activeStep = 0;
  let syncingSteps = false;
  const showStep = (index, scroll = true) => {
    activeStep = (index + stepCards.length) % stepCards.length;
    stepCards.forEach((card, cardIndex) => card.classList.toggle("is-active", cardIndex === activeStep));
    stepDots.forEach((dot, dotIndex) => { dot.classList.toggle("is-active", dotIndex === activeStep); dot.setAttribute("aria-current", dotIndex === activeStep ? "step" : "false"); });
    if (scroll && window.matchMedia("(max-width: 640px)").matches) {
      syncingSteps = true;
      stepsTrack.scrollTo({ left: Math.max(0, stepCards[activeStep].offsetLeft - (stepsTrack.clientWidth - stepCards[activeStep].offsetWidth) / 2), behavior: "smooth" });
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
    stepCards.forEach((card, index) => { if (Math.abs(card.offsetLeft + card.offsetWidth / 2 - center) < Math.abs(stepCards[nearest].offsetLeft + stepCards[nearest].offsetWidth / 2 - center)) nearest = index; });
    if (nearest !== activeStep) showStep(nearest, false);
  }, { passive: true });
  loadVets();
  ["search-button", "specialty-filter", "city-filter"].forEach((id) => document.getElementById(id).addEventListener(id === "search-button" ? "click" : "change", loadVets));
  document.getElementById("search-input").addEventListener("input", () => { clearTimeout(window.pawnirSearchTimer); window.pawnirSearchTimer = setTimeout(loadVets, 180); });
  document.getElementById("clear-filters").addEventListener("click", () => { document.getElementById("search-input").value = ""; document.getElementById("specialty-filter").value = "all"; document.getElementById("city-filter").value = "all"; state.mode = "all"; loadVets(); });
  document.querySelectorAll(".chip").forEach((chip) => chip.addEventListener("click", () => {
    if (chip.dataset.city) {
      document.getElementById("city-filter").value = chip.dataset.city;
      document.querySelectorAll(".chip").forEach((item) => item.classList.toggle("active", item === chip));
    } else {
      state.mode = chip.dataset.mode;
      document.querySelectorAll(".chip").forEach((item) => item.classList.toggle("active", item === chip));
    }
    loadVets();
  }));
  document.querySelectorAll("[data-open-auth]").forEach((button) => button.addEventListener("click", (event) => openDialog(document.getElementById("auth-dialog"), event.currentTarget)));
  document.querySelectorAll("[data-open-dashboard]").forEach((button) => button.addEventListener("click", async (event) => { if (!localStorage.getItem("pawnir_token")) { openDialog(document.getElementById("auth-dialog"), event.currentTarget); return; } openDialog(document.getElementById("dashboard-dialog"), event.currentTarget); await loadDashboard(); }));
  setTheme(document.documentElement.dataset.theme || "light");
  document.getElementById("theme-toggle").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  document.getElementById("language-toggle").addEventListener("click", () => applyLanguage(state.language === "bn" ? "en" : "bn"));
  document.getElementById("report-lost-button").addEventListener("click", (event) => {
    if (!localStorage.getItem("pawnir_token")) {
      document.getElementById("auth-status").textContent = "Sign in first to publish a nearby animal alert.";
      openDialog(document.getElementById("auth-dialog"), event.currentTarget);
      return;
    }
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
      description: document.getElementById("report-description").value
    };
    const response = await fetch("/api/lost-found", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("pawnir_token") }, body: JSON.stringify(payload) });
    const result = await response.json();
    status.textContent = response.ok ? `Alert published. ${result.notifiedCount} nearby members notified.` : (result.error || "Unable to publish alert.");
    status.classList.toggle("is-success", response.ok);
    if (response.ok) { document.getElementById("lost-report-form").reset(); await loadLostReports(); window.setTimeout(() => closeDialog(document.getElementById("lost-report-dialog")), 800); }
  });
  document.getElementById("lost-type-filter").addEventListener("change", loadLostReports);
  document.getElementById("lost-area-input").addEventListener("input", () => { clearTimeout(window.pawnirLostTimer); window.pawnirLostTimer = setTimeout(loadLostReports, 220); });
  document.getElementById("nearby-alert-button").addEventListener("click", async (event) => {
    const token = localStorage.getItem("pawnir_token");
    const area = document.getElementById("lost-area-input").value.trim();
    if (!token) { document.getElementById("auth-status").textContent = "Sign in first to receive nearby animal alerts."; openDialog(document.getElementById("auth-dialog"), event.currentTarget); return; }
    if (!area) { document.getElementById("lost-area-input").focus(); return; }
    const response = await fetch("/api/lost-found/subscribe", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ area, city: document.getElementById("report-city")?.value || "Bangladesh" }) });
    const result = await response.json();
    event.currentTarget.textContent = response.ok ? "Alerts enabled" : (result.error || "Try again");
  });
  document.getElementById("register-donor-button").addEventListener("click", (event) => {
    if (!localStorage.getItem("pawnir_token")) { document.getElementById("auth-status").textContent = "Sign in first to register an animal donor."; openDialog(document.getElementById("auth-dialog"), event.currentTarget); return; }
    openDialog(document.getElementById("donor-dialog"), event.currentTarget);
  });
  document.getElementById("donor-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const response = await fetch("/api/donors", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("pawnir_token") }, body: JSON.stringify({ species: document.getElementById("donor-species").value, area: document.getElementById("donor-area").value, city: document.getElementById("donor-city").value, bloodType: document.getElementById("donor-blood-type").value, consent: document.getElementById("donor-consent").checked, eligibilityAcknowledged: document.getElementById("donor-eligible").checked }) });
    const result = await response.json();
    document.getElementById("donor-status").textContent = response.ok ? "Submitted. A PawNir operator must verify this donor before requests appear." : (result.error || "Unable to register donor.");
    if (response.ok) { await loadDonors(); window.setTimeout(() => closeDialog(document.getElementById("donor-dialog")), 900); }
  });
  ["donor-species-filter", "donor-blood-filter"].forEach((id) => document.getElementById(id).addEventListener("change", loadDonors));
  document.getElementById("donor-area-input").addEventListener("input", () => { clearTimeout(window.pawnirDonorTimer); window.pawnirDonorTimer = setTimeout(loadDonors, 220); });
  document.getElementById("adoption-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const response = await fetch("/api/adoptions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("pawnir_token") }, body: JSON.stringify({ listingId: selectedAdoption.id, housing: document.getElementById("adopt-housing").value, experience: document.getElementById("adopt-experience").value, household: document.getElementById("adopt-household").value, vetPlan: document.getElementById("adopt-vet-plan").value }) });
    const result = await response.json();
    document.getElementById("adoption-status").textContent = response.ok ? "Application submitted for screening." : (result.error || "Unable to submit application.");
    if (response.ok) { const link = document.getElementById("adoption-pdf-link"); link.hidden = false; link.href = `/api/adoptions/${encodeURIComponent(result.applicationId)}/pdf`; link.download = `pawnir-adoption-${result.applicationId}.pdf`; }
  });
  document.getElementById("foster-city-filter").addEventListener("change", loadFosters);
  document.getElementById("foster-request-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const response = await fetch(`/api/fosters/${encodeURIComponent(selectedFoster.id)}/requests`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("pawnir_token") }, body: JSON.stringify({ reason: document.getElementById("foster-request-reason").value }) });
    const result = await response.json();
    const status = document.getElementById("foster-request-status");
    status.textContent = response.ok ? "Request sent. A registered foster team can now review it." : (result.error || "Unable to send request.");
    status.classList.toggle("is-success", response.ok);
    if (response.ok) window.setTimeout(() => closeDialog(document.getElementById("foster-request-dialog")), 800);
  });
  document.getElementById("foster-review-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const response = await fetch(`/api/fosters/${encodeURIComponent(selectedFoster.id)}/reviews`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("pawnir_token") }, body: JSON.stringify({ rating: Number(document.getElementById("foster-review-rating").value), comment: document.getElementById("foster-review-comment").value }) });
    const result = await response.json();
    document.getElementById("foster-review-status").textContent = response.ok ? "Review published." : (result.error || "Unable to submit review.");
    if (response.ok) { await loadFosters(); window.setTimeout(() => closeDialog(document.getElementById("foster-review-dialog")), 800); }
  });
  document.getElementById("profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const response = await fetch("/api/auth/me", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("pawnir_token") }, body: JSON.stringify({ name: document.getElementById("profile-name").value, area: document.getElementById("profile-area").value, bio: document.getElementById("profile-bio").value }) });
    const result = await response.json();
    document.getElementById("profile-status").textContent = response.ok ? "Profile saved." : (result.error || "Unable to save profile.");
  });
  document.getElementById("profile-book-button").addEventListener("click", (event) => { closeDialog(document.getElementById("vet-profile-dialog")); openBooking(selectedVet.name, event.currentTarget); });
  document.getElementById("mobile-book-button").addEventListener("click", (event) => openBooking(selectedVet?.name, event.currentTarget));
  document.getElementById("booking-date").addEventListener("change", () => loadAvailability().catch((error) => { document.getElementById("booking-status").textContent = error.message; }));
  document.getElementById("booking-mode").addEventListener("change", () => loadAvailability().catch((error) => { document.getElementById("booking-status").textContent = error.message; }));
  loadLostReports();
  const refreshLostFeed = () => {
    if (!document.hidden) loadLostReports();
  };
  lostRefreshTimer = window.setInterval(refreshLostFeed, 12000);
  document.addEventListener("visibilitychange", refreshLostFeed);
  loadFosters();
  loadDonors();
  loadAdoptions();
  document.querySelectorAll(".step-next").forEach((button) => button.addEventListener("click", () => {
    const current = Number(button.closest(".booking-step-panel").dataset.step);
    if (current === 2 && !document.getElementById("booking-date").value) { document.getElementById("booking-status").textContent = "Choose a date to continue."; return; }
    if (current === 3 && !document.getElementById("booking-pet").value) { document.getElementById("booking-status").textContent = "Choose a pet to continue."; return; }
    if (current < 4) { if (current === 3) refreshBookingSummary(); updateBookingStep(current + 1); }
  }));
  document.querySelectorAll(".step-back").forEach((button) => button.addEventListener("click", () => updateBookingStep(Number(button.closest(".booking-step-panel").dataset.step) - 1)));
  document.getElementById("booking-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const token = localStorage.getItem("pawnir_token");
    if (!token) { closeDialog(document.getElementById("booking-dialog")); document.getElementById("auth-status").textContent = "Sign in first, then return to book your consultation."; openDialog(document.getElementById("auth-dialog")); return; }
    if (!pets.length) { document.getElementById("booking-status").textContent = "Add a pet profile in My care before booking."; return; }
    if (!document.getElementById("booking-time").value) { document.getElementById("booking-status").textContent = "Choose an available time before requesting."; return; }
    const submit = document.getElementById("booking-submit"); submit.disabled = true; submit.textContent = "Requesting…";
    const response = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ vetId: selectedVet.id, petId: document.getElementById("booking-pet").value, date: document.getElementById("booking-date").value, time: document.getElementById("booking-time").value, mode: document.getElementById("booking-mode").value.startsWith("Video") ? "online" : "clinic" }) });
    const result = await response.json(); submit.disabled = false; submit.innerHTML = 'Request appointment <span aria-hidden="true">→</span>';
    document.getElementById("booking-status").textContent = response.ok ? `Booking request created for ${result.date} at ${result.time}.` : (result.error || "Unable to create booking.");
    if (response.ok) { document.getElementById("booking-status").classList.add("is-success"); await loadDashboard(); window.setTimeout(() => closeDialog(document.getElementById("booking-dialog")), 700); }
  });
  document.getElementById("pet-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const token = localStorage.getItem("pawnir_token");
    const response = await fetch("/api/pets", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: document.getElementById("pet-name").value, species: document.getElementById("pet-species").value }) });
    const result = await response.json(); document.getElementById("pet-status").textContent = response.ok ? `${result.name} added to your care space.` : result.error;
    if (response.ok) { event.target.reset(); await loadPets(); await loadDashboard(); }
  });
  document.getElementById("auth-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const payload = { email: document.getElementById("auth-email").value, password: document.getElementById("auth-password").value, name: document.getElementById("auth-name").value };
    let response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (response.status === 401) response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json(); if (!response.ok) { document.getElementById("auth-status").textContent = result.error || "Unable to sign in."; return; }
    localStorage.setItem("pawnir_token", result.token); closeDialog(document.getElementById("auth-dialog")); await loadPets();
  });
});
