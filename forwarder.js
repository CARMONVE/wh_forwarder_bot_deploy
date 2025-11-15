import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import xlsx from 'xlsx';

// =========================================
// LIMPIA Y NORMALIZA TEXTO
// Ignora: espacios, tabs, saltos y may/min
// =========================================
function normalizar(texto) {
    return String(texto || "")
        .replace(/\s+/g, " ")      // reduce espacios/tabs múltiples a 1
        .trim()
        .toUpperCase();
}

// =========================================
// CARGAR CONFIG
// =========================================
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const excelPath = config.excel_path || "LISTA.xlsx";

// =========================================
// CARGAR EXCEL COMPLETO
// =========================================
function cargarReglas() {
    console.log("======================================");
    console.log("📘 CARGANDO EXCEL:", excelPath);
    console.log("======================================");

    const wb = xlsx.readFile(excelPath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { defval: "" });

    rows.forEach((r, i) => {
        console.log(
            `Fila ${i + 2}: Origen="${r.Grupo_Origen}" → Destino="${r.Grupo_Destino}" | `
          + `R1="${r.Restriccion_1}" R2="${r.Restriccion_2}" R3="${r.Restriccion_3}"`
        );
    });

    console.log("--------------------------------------");
    return rows;
}

let reglas = cargarReglas();

// =========================================
// INICIAR WHATSAPP
// =========================================
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', qr => {
    console.log("📱 ESCANEA ESTE QR:");
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log("✅ WhatsApp conectado y listo.");
});

// =========================================
// MANEJO DE MENSAJES
// =========================================
client.on('message', async msg => {
    const chat = await msg.getChat();
    if (!chat.isGroup) return;

    const origen = normalizar(chat.name);
    const texto  = normalizar(msg.body);

    console.log("\n======================================");
    console.log("📥 MENSAJE RECIBIDO");
    console.log("Grupo:", chat.name);
    console.log("Texto (normalizado):", texto);
    console.log("======================================");

    // FILTRAR TODAS LAS REGLAS DEL MISMO GRUPO
    const reglasGrupo = reglas.filter(r => 
        normalizar(r.Grupo_Origen) === origen
    );

    if (reglasGrupo.length === 0) {
        console.log("❌ No hay reglas para este grupo.");
        return;
    }

    console.log(`🔎 Se encontraron ${reglasGrupo.length} reglas para este grupo.`);

    // PROBAR CADA REGLA UNA POR UNA
    for (let i = 0; i < reglasGrupo.length; i++) {
        const r = reglasGrupo[i];

        console.log("\n--------------------------------------");
        console.log(`🔎 PROBANDO REGLA FILA ${i + 2}`);
        console.log(`Destino: ${r.Grupo_Destino}`);
        console.log(`R1=${r.Restriccion_1} | R2=${r.Restriccion_2} | R3=${r.Restriccion_3}`);

        let cumple1 = true, cumple2 = true, cumple3 = true;

        if (r.Restriccion_1)
            cumple1 = texto.includes(normalizar(r.Restriccion_1));
        if (r.Restriccion_2)
            cumple2 = texto.includes(normalizar(r.Restriccion_2));
        if (r.Restriccion_3)
            cumple3 = texto.includes(normalizar(r.Restriccion_3));

        console.log(` ▶ R1: ${cumple1 ? "✔ CUMPLE" : "❌ NO"} (${r.Restriccion_1})`);
        console.log(` ▶ R2: ${cumple2 ? "✔ CUMPLE" : "❌ NO"} (${r.Restriccion_2})`);
        console.log(` ▶ R3: ${cumple3 ? "✔ CUMPLE" : "❌ NO"} (${r.Restriccion_3})`);

        // SI ESTA REGLA CUMPLE TODO → REENVIAR Y SALIR
        if (cumple1 && cumple2 && cumple3) {
            console.log("✔ ESTA REGLA CUMPLE TODO → REENVIAR");

            const chats = await client.getChats();
            const destino = chats.find(c =>
                c.isGroup && normalizar(c.name) === normalizar(r.Grupo_Destino)
            );

            if (!destino) {
                console.log(`❌ GRUPO DESTINO "${r.Grupo_Destino}" NO ENCONTRADO`);
                return;
            }

            await destino.sendMessage(`📩 Reenviado desde *${chat.name}*\n\n${msg.body}`);
            console.log("✅ REENVÍO EXITOSO");
            return; // terminamos aquí
        }

        console.log("❌ Esta regla no cumplió todas las restricciones.");
    }

    // SI LLEGAMOS AQUÍ → ninguna regla cumplió
    console.log("❌ NINGUNA DE LAS REGLAS DE ESTE GRUPO CUMPLIÓ LAS RESTRICCIONES");
});

client.initialize();
