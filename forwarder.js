import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import xlsx from "xlsx";
import fs from "fs";
import path from "path";

const __dirname = path.resolve();

// Load config
const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

// Read Excel
function loadRules() {
    const workbook = xlsx.readFile(config.excelFile);
    const sheet = workbook.Sheets[config.sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);

    return rows.map(row => ({
        origen: String(row.Grupo_Origen || "").trim(),
        destino: String(row.Grupo_Destino || "").trim(),
        r1: String(row.Restriccion_1 || "").trim(),
        r2: String(row.Restriccion_2 || "").trim(),
        r3: String(row.Restriccion_3 || "").trim()
    }));
}

let RULES = loadRules();

// Watch for Excel Updates every 60 sec
setInterval(() => {
    RULES = loadRules();
}, 60000);

// Start WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth({ clientId: config.sessionName }),
    puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    }
});

client.on("qr", qr => {
    console.clear();
    console.log("📱 Escanea el QR para iniciar sesión:");
    qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
    console.log("✅ Bot iniciado y listo para reenviar mensajes.");
});

function matchesRestrictions(msg, rule) {
    const txt = msg.toLowerCase();

    // Restricción_1 -> Parcial (basta con que contenga una palabra)
    let ok1 = true;
    if (rule.r1) {
        const words = rule.r1.toLowerCase().split(" ");
        ok1 = words.some(w => txt.includes(w));
    }

    // Restricción_2 -> Completa (debe contener todo)
    let ok2 = true;
    if (rule.r2) {
        ok2 = txt.includes(rule.r2.toLowerCase());
    }

    // Restricción_3 -> Completa (debe contener todo)
    let ok3 = true;
    if (rule.r3) {
        ok3 = txt.includes(rule.r3.toLowerCase());
    }

    return ok1 && ok2 && ok3;
}

client.on("message", async msg => {
    try {
        const chat = await msg.getChat();
        if (!chat.isGroup) return;

        const groupName = chat.name.trim();

        for (const rule of RULES) {
            if (rule.origen === groupName) {
                const content = msg.body;

                if (!content) return;

                if (matchesRestrictions(content, rule)) {
                    const targetGroup = await findGroup(rule.destino);
                    if (targetGroup) {
                        await client.sendMessage(targetGroup.id._serialized, content);
                        console.log(`➡️ Reenviado de "${rule.origen}" → "${rule.destino}"`);
                    }
                }
            }
        }
    } catch (err) {
        console.log("⚠️ Error procesando mensaje:", err.message);
    }
});

async function findGroup(name) {
    const chats = await client.getChats();
    return chats.find(c => c.isGroup && c.name.trim() === name.trim());
}

client.initialize();
