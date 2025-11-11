import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qr from "qrcode-terminal";
import fs from "fs";
import xlsx from "xlsx";
import path from "path";

const __dirname = path.resolve();

const CONFIG = JSON.parse(fs.readFileSync("./config.json", "utf8"));

function loadExcel() {
    const workbook = xlsx.readFile(CONFIG.excelPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return xlsx.utils.sheet_to_json(sheet);
}

function logEvent(text) {
    fs.appendFileSync(CONFIG.logFile, `[${new Date().toISOString()}] ${text}\n`);
}

function extractTicketInfo(message) {
    return message.body;
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--no-first-run",
            "--no-zygote"
        ]
    }
});

client.on("qr", (qrCode) => {
    console.clear();
    console.log("📱 Escanea el siguiente QR para iniciar sesión:\n");
    qr.generate(qrCode, { small: true });
});

client.on("ready", () => {
    console.log("✅ BOT Listo y conectado!");
    logEvent("Bot iniciado");
});

client.on("message", async (message) => {
    const list = loadExcel();
    const userMessage = extractTicketInfo(message);

    const originGroup = message.from.includes("@g.us") ? message.from : null;
    if (!originGroup) return;

    const match = list.find(row =>
        row.Grupo_Origen?.trim().toLowerCase() === message.from?.trim().toLowerCase()
    );

    if (!match) return;

    const restrictions = [
        match.Restriccion_1,
        match.Restriccion_2,
        match.Restriccion_3
    ].filter(Boolean);

    const allRestrictionsMatch = restrictions.every(r =>
        CONFIG.forwarding.partialRestrictionMatch
            ? userMessage.toLowerCase().includes(r.toLowerCase())
            : userMessage.toLowerCase().includes(r.toLowerCase())
    );

    if (!allRestrictionsMatch) return;

    const destinationGroup = match.Grupo_Destino;
    if (!destinationGroup) return;

    const chats = await client.getChats();
    const target = chats.find(c => c.name.trim().toLowerCase() === destinationGroup.trim().toLowerCase());

    if (!target) {
        logEvent(`❌ No se encontró el grupo destino: ${destinationGroup}`);
        return;
    }

    await client.sendMessage(target.id._serialized, userMessage);
    logEvent(`✅ Reenviado de "${match.Grupo_Origen}" a "${match.Grupo_Destino}"`);
});

client.initialize();
