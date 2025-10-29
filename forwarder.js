// === FORWARDER BOT - Versión Replit (ligera) ===
// Compatible con puppeteer-core y sin dependencias gráficas del sistema
// Mantiene conexión con Excel y reglas definidas previamente

const { Client, LocalAuth } = require('whatsapp-web.js');
const puppeteer = require('puppeteer-core');
const express = require('express');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// === CONFIGURACIÓN EXPRESS ===
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('✅ WhatsApp Forwarder Bot activo.'));
app.listen(PORT, () => console.log(`🌐 Web server listening on ${PORT}`));

// === CONFIGURACIÓN DE ARCHIVOS ===
const configPath = path.join(__dirname, 'config.json');
const excelPath = path.join(__dirname, 'LISTA.xlsx');

// Verifica que existan los archivos
if (!fs.existsSync(configPath)) {
  console.error('❌ ERROR: No se encontró config.json');
  process.exit(1);
}
if (!fs.existsSync(excelPath)) {
  console.error('❌ ERROR: No se encontró LISTA.xlsx');
  process.exit(1);
}

// === CARGA DE CONFIGURACIÓN Y DATOS EXCEL ===
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const workbook = xlsx.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

console.log(`📋 Se cargaron ${data.length} filas desde ${sh
