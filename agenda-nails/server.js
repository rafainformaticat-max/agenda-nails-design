const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, "data");
const clientsFile = path.join(dataDir, "clients.json");
const appointmentsFile = path.join(dataDir, "appointments.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function ensureFile(file, initialData) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(initialData, null, 2));
  }
}

function readData(file) {
  ensureFile(file, []);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeData(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

ensureFile(clientsFile, []);
ensureFile(appointmentsFile, []);

app.get("/api/clients", (req, res) => {
  res.json(readData(clientsFile));
});

app.post("/api/clients", (req, res) => {
  const { name, phone, email } = req.body || {};
  if (!name?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: "Nome e telefone são obrigatórios." });
  }

  const clients = readData(clientsFile);
  const client = {
    id: crypto.randomUUID(),
    name: name.trim(),
    phone: phone.trim(),
    email: email?.trim() || "",
    createdAt: new Date().toISOString()
  };

  clients.push(client);
  writeData(clientsFile, clients);
  res.status(201).json(client);
});

app.get("/api/appointments", (req, res) => {
  res.json(readData(appointmentsFile));
});

app.post("/api/appointments", (req, res) => {
  const { clientId, service, date, time } = req.body || {};
  if (!clientId || !service?.trim() || !date || !time) {
    return res.status(400).json({
      error: "Cliente, serviço, data e horário são obrigatórios."
    });
  }

  const clients = readData(clientsFile);
  if (!clients.some((client) => client.id === clientId)) {
    return res.status(400).json({ error: "A cliente selecionada não existe." });
  }

  const appointments = readData(appointmentsFile);
  const slotTaken = appointments.some(
    (item) => item.date === date && item.time === time && item.status !== "Cancelado"
  );

  if (slotTaken) {
    return res.status(409).json({ error: "Esse horário já está ocupado." });
  }

  const appointment = {
    id: crypto.randomUUID(),
    clientId,
    service: service.trim(),
    date,
    time,
    status: "Confirmado",
    createdAt: new Date().toISOString()
  };

  appointments.push(appointment);
  writeData(appointmentsFile, appointments);
  res.status(201).json(appointment);
});

app.patch("/api/appointments/:id/cancel", (req, res) => {
  const appointments = readData(appointmentsFile);
  const appointment = appointments.find((item) => item.id === req.params.id);

  if (!appointment) {
    return res.status(404).json({ error: "Agendamento não encontrado." });
  }

  appointment.status = "Cancelado";
  writeData(appointmentsFile, appointments);
  res.json(appointment);
});

app.listen(PORT, () => {
  console.log(`Agenda Nails disponível em http://localhost:${PORT}`);
});