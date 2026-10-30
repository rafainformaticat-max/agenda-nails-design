const colors = [
  { name: "Rosa delicado", hex: "#e8a7b8", category: "Clássico" },
  { name: "Vinho elegante", hex: "#8d344d", category: "Intenso" },
  { name: "Nude rosado", hex: "#d8b5a9", category: "Nude" },
  { name: "Lavanda", hex: "#b6a4d5", category: "Suave" },
  { name: "Vermelho cereja", hex: "#c8324d", category: "Clássico" },
  { name: "Verde sálvia", hex: "#a9b9a1", category: "Natural" },
  { name: "Pêssego", hex: "#efb89d", category: "Suave" },
  { name: "Chocolate", hex: "#765144", category: "Intenso" }
];
const $ = (selector) => document.querySelector(selector);
let clients = [];
let appointments = [];

document.addEventListener("DOMContentLoaded", () => {
  $("#today").textContent = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date());
  renderColors();
  setupNavigation();
  setupForms();
  loadData();
});

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
  return data;
}

async function loadData() {
  try {
    [clients, appointments] = await Promise.all([api("/api/clients"), api("/api/appointments")]);
    renderClients(); renderAppointments(); updateStats();
  } catch (error) {
    showMessage($("#appointment-message"), error.message);
  }
}

function setupNavigation() {
  document.querySelectorAll(".nav-link").forEach((button) => {
    button.addEventListener("click", () => showPage(button.dataset.page));
  });
  $("#new-appointment-button").addEventListener("click", () => {
    $("#appointment-form-panel").scrollIntoView({ behavior: "smooth" });
  });
}

function showPage(pageName) {
  document.querySelectorAll(".nav-link").forEach((button) => button.classList.toggle("active", button.dataset.page === pageName));
  document.querySelectorAll(".page").forEach((page) => page.classList.toggle("active", page.id === `page-${pageName}`));
  $("#page-title").textContent = ({ agenda: "Agenda", clientes: "Clientes", cores: "Cores" })[pageName];
}

function setupForms() {
  $("#client-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const client = await api("/api/clients", {
        method: "POST",
        body: JSON.stringify({ name: $("#client-name").value, phone: $("#client-phone").value, email: $("#client-email").value })
      });
      clients.push(client); event.target.reset(); renderClients(); updateStats();
      showMessage($("#client-message"), "Cliente cadastrada com sucesso.");
    } catch (error) { showMessage($("#client-message"), error.message); }
  });

  $("#appointment-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const appointment = await api("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          clientId: $("#appointment-client").value, service: $("#appointment-service").value,
          date: $("#appointment-date").value, time: $("#appointment-time").value
        })
      });
      appointments.push(appointment); event.target.reset(); renderAppointments(); updateStats();
      showMessage($("#appointment-message"), "Agendamento salvo com sucesso.");
    } catch (error) { showMessage($("#appointment-message"), error.message); }
  });
  $("#client-search").addEventListener("input", renderClients);
  $("#appointment-date-filter").addEventListener("input", renderAppointments);
}

function renderClients() {
  const select = $("#appointment-client");
  const selectedValue = select.value;
  select.innerHTML = '<option value="">Selecione uma cliente</option>';
  clients.forEach((client) => {
    const option = document.createElement("option");
    option.value = client.id; option.textContent = client.name; select.appendChild(option);
  });
  select.value = selectedValue;
  const query = ($("#client-search")?.value || "").toLowerCase();
  const filtered = clients.filter((client) => `${client.name} ${client.phone} ${client.email}`.toLowerCase().includes(query));
  const list = $("#clients-list");
  if (!filtered.length) { list.innerHTML = '<p class="empty-state">Nenhuma cliente cadastrada ainda.</p>'; return; }
  list.innerHTML = filtered.map((client) => `
    <article class="client-item"><div class="item-main"><strong>${escapeHTML(client.name)}</strong>
    <span>${escapeHTML(client.phone)}${client.email ? ` · ${escapeHTML(client.email)}` : ""}</span></div><span aria-hidden="true">♡</span></article>
  `).join("");
}

function renderAppointments() {
  const filterDate = $("#appointment-date-filter").value;
  const list = $("#appointments-list");
  const visible = [...appointments].filter((item) => !filterDate || item.date === filterDate)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  if (!visible.length) { list.innerHTML = '<p class="empty-state">Não há agendamentos para exibir.</p>'; return; }
  list.innerHTML = visible.map((item) => {
    const client = clients.find((entry) => entry.id === item.clientId);
    const date = new Date(`${item.date}T00:00:00`).toLocaleDateString("pt-BR");
    return `<article class="appointment-item"><div class="item-main"><strong>${escapeHTML(client?.name || "Cliente")}</strong>
      <span>${escapeHTML(item.service)} · ${date}</span></div><div class="item-meta"><strong>${escapeHTML(item.time)}</strong>
      <div>${escapeHTML(item.status)}</div>${item.status !== "Cancelado" ? `<button class="cancel-button" data-cancel="${escapeHTML(item.id)}">Cancelar</button>` : ""}</div></article>`;
  }).join("");
  list.querySelectorAll("[data-cancel]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const updated = await api(`/api/appointments/${encodeURIComponent(button.dataset.cancel)}/cancel`, { method: "PATCH" });
        appointments = appointments.map((item) => item.id === updated.id ? updated : item);
        renderAppointments(); updateStats();
      } catch (error) { showMessage($("#appointment-message"), error.message); }
    });
  });
}

function updateStats() {
  const activeAppointments = appointments.filter((item) => item.status !== "Cancelado");
  $("#appointment-count").textContent = activeAppointments.length;
  $("#client-count").textContent = clients.length;
  const now = new Date();
  const upcoming = [...activeAppointments]
    .filter((item) => new Date(`${item.date}T${item.time}:00`) >= now)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0];
  $("#next-time").textContent = upcoming ? upcoming.time : "—";
}

function renderColors() {
  $("#color-grid").innerHTML = colors.map((color) => `<article class="color-card">
    <div class="color-swatch" style="background:${color.hex}"></div><h3>${escapeHTML(color.name)}</h3>
    <p>${escapeHTML(color.category)} · ${escapeHTML(color.hex)}</p></article>`).join("");
}

function showMessage(element, text) {
  element.textContent = text;
  window.setTimeout(() => { if (element.textContent === text) element.textContent = ""; }, 4000);
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}