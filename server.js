require('dotenv').config();
const express = require('express');
const CryptoJS = require('crypto-js');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;  // Render требует process.env.PORT

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN не задан!');
  process.exit(1);
}

const db = new sqlite3.Database('catclicker.db');
db.run(`CREATE TABLE IF NOT EXISTS users (
  telegram_id INTEGER PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  coins REAL DEFAULT 0,
  per_click INTEGER DEFAULT 1,
  auto_per_sec INTEGER DEFAULT 0,
  click_multi REAL DEFAULT 1,
  auto_level INTEGER DEFAULT 0,
  click_level INTEGER DEFAULT 0
)`);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/user/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'catclicker.html'));
});

// Остальные роуты (auth, save, load) — оставь как есть

// КЛЮЧЕВАЯ СТРОКА:
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
