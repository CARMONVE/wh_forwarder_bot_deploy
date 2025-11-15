import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import xlsx from 'xlsx';

// =========================================
// NORMALIZADOR
// =========================================
function normalizar(texto) {
    return String(texto || "")
        .replace(/\s+/g, " ")        // compacta espacios
        .replace(/\s*:\s*/g, ":")    // estandariza "COORDINADOR : X" → "COORDINADOR:X"
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

        const r1 = normalizar(r.Restriccion_1);
        const r2 = normalizar(r.Restriccion_2);
        const r3 = normalizar(r.Restriccion_3);

        console.log("\n--------------------------------------");
        console.log(`🔎 PROBANDO REGLA FILA ${i + 2}`);
        console.log(`Destino: ${r.Grupo_Destino}`);
        console.log(`R1=${r.Restriccion_1} | R2=${r.Restriccion_2} | R3=${r.Restriccion_3}`);

        // 🔥 INCLUDES MEJORADO (sin importar espacios después de :)
        const cleanTexto = texto.replace(/:\s*/g, ":");
        const cleanR1 = r1.replace(/:\s*/g, ":");
        const cleanR2 = r2.replace(/:\s*/g, ":");
        const cleanR3 = r3.replace(/:\s*/g, ":");

        let cumple1 = r1 ? cleanTexto.includes(cleanR1) : true;
        let cumple2 = r2 ? cleanTexto.includes(cleanR2) : true;
        let cumple3 = r3 ? cleanTexto.includes(cleanR3) : true;

        console.log(` ▶ R1: ${cumple1 ? "✔ CUMPLE" : "❌ NO"} (${r.Restriccion_1})`);
        console.log(` ▶ R2: ${cumple2 ? "✔ CUMPLE" : "❌ NO"} (${r.Restriccion_2})`);
        console.log(` ▶ R3: ${cumple3 ? "✔ CUMPLE" : "❌ NO"} (${r.Restriccion_3})`);

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

            await destino.sendMessage(msg.body);
            console.log("✅ REENVÍO EXITOSO");
            return;
        }

        console.log("❌ Esta regla no cumplió todas las restricciones.");
    }

    console.log("❌ NINGUNA REGLA CUMPLIÓ LAS RESTRICCIONES");
});

client.initialize();
