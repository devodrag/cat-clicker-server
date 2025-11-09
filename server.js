require('dotenv').config();
const express = require('express');
const CryptoJS = require('crypto-js');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN) {
  console.error('BOT_TOKEN не задан! Добавь в .env');
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

// Проверка подписи Telegram
function verifyTelegramAuth(data, hash) {
  const dataCheckString = Object.keys(data).sort().map(k => `${k}=${data[k]}`).join('\n');
  const secret = CryptoJS.HmacSHA256(dataCheckString, BOT_TOKEN);
  return hash === secret.toString(CryptoJS.enc.Hex);
}

// Авторизация
app.get('/auth/telegram', (req, res) => {
  const { hash } = req.query;
  if (!hash) return res.status(400).send('Нет hash');

  const data = {};
  Object.keys(req.query).forEach(k => {
    if (k !== 'hash') data[k] = req.query[k];
  });

  if (!verifyTelegramAuth(data, hash)) {
    return res.status(403).send('Неверная подпись');
  }

  const { id, username = '', first_name = 'Игрок' } = data;

  db.get('SELECT * FROM users WHERE telegram_id = ?', [id], (err, user) => {
    if (err) return res.status(500).send('Ошибка БД');
    if (!user) {
      db.run('INSERT INTO users (telegram_id, username, first_name) VALUES (?, ?, ?)', [id, username, first_name]);
    }
    const userLink = `/user/${id}`;
    res.send(`
      <h1>Привет, ${first_name}!</h1>
      <p><a href="${userLink}">Играть в Котик Кликер</a></p>
      <script>localStorage.setItem('tgId', '${id}');</script>
    `);
  });
});

// API: загрузка
app.get('/load-progress/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM users WHERE telegram_id = ?', [id], (err, user) => {
    if (err || !user) return res.json({});
    const { coins, per_click, auto_per_sec, click_multi, auto_level, click_level } = user;
    res.json({ coins, perClick: per_click, autoPerSec: auto_per_sec, clickMulti: click_multi, autoLevel: auto_level, clickLevel: click_level });
  });
});

// API: сохранение
app.post('/save-progress', (req, res) => {
  const { telegramId, coins, perClick, autoPerSec, clickMulti, autoLevel, clickLevel } = req.body;
  if (!telegramId) return res.status(400).send('Нет ID');

  db.run(
    `UPDATE users SET coins = ?, per_click = ?, auto_per_sec = ?, click_multi = ?, auto_level = ?, click_level = ? WHERE telegram_id = ?`,
    [coins, perClick, autoPerSec, clickMulti, autoLevel, clickLevel, telegramId],
    (err) => {
      if (err) return res.status(500).send('Ошибка');
      res.send('OK');
    }
  );
});

// Страница пользователя
app.get('/user/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'catclicker.html'));
});

// Главная
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});
