import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import xlsx from 'xlsx';

/* ================================
   CARGAR CONFIG
================================ */
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const excelPath = config.excel_path || "LISTA.xlsx";

/* ================================
   FUNC: CARGA EL EXCEL
================================ */
function cargarReglas() {
    console.log("======================================");
    console.log("📘 Leyendo Excel:", excelPath);
    console.log("======================================");

    const wb = xlsx.readFile(excelPath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { defval: "" });

    rows.forEach((r, i) => {
        console.log(`Fila ${i + 2}: Origen="${r.Grupo_Origen}" → Destino="${r.Grupo_Destino}" | R1="${r.Restriccion_1}" R2="${r.Restriccion_2}" R3="${r.Restriccion_3}"`);
    });

    console.log("======================================");

    return rows;
}

let reglas = cargarReglas();

/* ================================
   INICIAR WHATSAPP
================================ */
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', qr => {
    console.log("📱 ESCANEA ESTE QR");
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log("✅ WhatsApp conectado y listo.");
});

/* ================================
   MANEJAR MENSAJES
================================ */
client.on('message', async msg => {
    const chat = await msg.getChat();

    if (!chat.isGroup) return; // ignorar mensajes privados

    const origen = chat.name.trim();
    const texto = msg.body.trim();

    console.log("\n\n======================================");
    console.log("📥 MENSAJE RECIBIDO");
    console.log("Grupo:", origen);
    console.log("Texto:", texto);
    console.log("======================================");

    /* 1. Buscar la regla */
    const regla = reglas.find(r => (r.Grupo_Origen || "").trim().toUpperCase() === origen.toUpperCase());

    if (!regla) {
        console.log("❌ No existe regla para este grupo → No reenviar");
        return;
    }

    console.log("🔎 REGLA APLICADA:");
    console.log(" - Destino:", regla.Grupo_Destino);
    console.log(" - R1:", regla.Restriccion_1);
    console.log(" - R2:", regla.Restriccion_2);
    console.log(" - R3:", regla.Restriccion_3);

    /* 2. Validar restricciones */
    let cumpleR1 = true, cumpleR2 = true, cumpleR3 = true;

    if (regla.Restriccion_1) {
        cumpleR1 = texto.toUpperCase().includes(regla.Restriccion_1.toUpperCase());
        console.log(`   ▶ R1 (${regla.Restriccion_1}): ${cumpleR1 ? "✔ CUMPLE" : "❌ NO CUMPLE"}`);
    }
    if (regla.Restriccion_2) {
        cumpleR2 = texto.toUpperCase().includes(regla.Restriccion_2.toUpperCase());
        console.log(`   ▶ R2 (${regla.Restriccion_2}): ${cumpleR2 ? "✔ CUMPLE" : "❌ NO CUMPLE"}`);
    }
    if (regla.Restriccion_3) {
        cumpleR3 = texto.toUpperCase().includes(regla.Restriccion_3.toUpperCase());
        console.log(`   ▶ R3 (${regla.Restriccion_3}): ${cumpleR3 ? "✔ CUMPLE" : "❌ NO CUMPLE"}`);
    }

    /* 3. Decisión final */
    if (!(cumpleR1 && cumpleR2 && cumpleR3)) {
        console.log("❌ MENSAJE NO REENVIADO → FALLA RESTRICCIONES");
        return;
    }

    console.log("✔ TODAS LAS RESTRICCIONES SE CUMPLEN");
    console.log("✔ Se intentará reenviar al grupo destino");

    /* 4. Buscar grupo destino */
    const chats = await client.getChats();
    const destino = chats.find(c =>
        c.isGroup && c.name.trim().toUpperCase() === regla.Grupo_Destino.trim().toUpperCase()
    );

    if (!destino) {
        console.log("❌ NO SE ENCONTRÓ EL GRUPO DESTINO EN TU WHATSAPP");
        return;
    }

    /* 5. Reenviar */
    await destino.sendMessage(`📩 Reenviado desde *${origen}*\n\n${texto}`);
    console.log("✅ REENVÍO EXITOSO");
    console.log("======================================\n\n");
});

client.initialize();
