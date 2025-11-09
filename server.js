require('dotenv').config();
const express = require('express');
const CryptoJS = require('crypto-js');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');

const app = express();
const BOT_TOKEN = process.env.BOT_TOKEN;
const BOT_USERNAME = process.env.BOT_USERNAME;
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN || !BOT_USERNAME) {
  console.error('BOT_TOKEN или BOT_USERNAME не заданы!');
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

const loginTokens = new Map();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Главная
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Игра
app.get('/user/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'catclicker.html'));
});

// === АВТОРИЗАЦИЯ ЧЕРЕЗ ВИДЖЕТ ===
app.get('/auth/telegram', (req, res) => {
  const { hash, ...data } = req.query;
  if (!hash || !data.id) return res.status(400).send('Нет данных');

  const dataCheckString = Object.keys(data).sort().map(k => `${k}=${data[k]}`).join('\n');
  const secret = CryptoJS.HmacSHA256(dataCheckString, BOT_TOKEN);
  if (hash !== secret.toString(CryptoJS.enc.Hex)) {
    return res.status(403).send('Неверная подпись');
  }

  const { id, first_name = 'Игрок', username = '' } = data;

  // Сохраняем пользователя
  db.get('SELECT * FROM users WHERE telegram_id = ?', [id], (err, user) => {
    if (!user) {
      db.run('INSERT INTO users (telegram_id, username, first_name) VALUES (?, ?, ?)', [id, username, first_name]);
    }

    // === РЕДИРЕКТ В БОТА С СООБЩЕНИЕМ ===
    const botLink = `https://t.me/${BOT_USERNAME}?start=welcome_${id}`;
    res.send(`
      <h2>Привет, ${first_name}!</h2>
      <p>Ты вошёл! Сейчас откроется бот...</p>
      <script>
        localStorage.setItem('tgId', '${id}');
        setTimeout(() => { window.location.href = '${botLink}'; }, 1500);
      </script>
    `);
  });
});

// === ОДНОРАЗОВАЯ ССЫЛКА ===
app.get('/start', (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).send('Нет ID');

  const token = crypto.randomBytes(16).toString('hex');
  loginTokens.set(token, { id, expires: Date.now() + 5 * 60 * 1000 });

  const loginUrl = `https://cat-clicker-efr8.onrender.com/login/${token}`;
  res.send(`
    <p>Твоя ссылка (5 минут):</p>
    <p><a href="${loginUrl}">${loginUrl}</a></p>
  `);
});

app.get('/login/:token', (req, res) => {
  const { token } = req.params;
  const entry = loginTokens.get(token);
  if (!entry || Date.now() > entry.expires) {
    loginTokens.delete(token);
    return res.status(410).send('Ссылка устарела');
  }
  loginTokens.delete(token);
  const { id } = entry;

  // Редирект в бота
  const botLink = `https://t.me/${BOT_USERNAME}?start=game_${id}`;
  res.redirect(botLink);
});

// === API ПРОГРЕССА ===
app.get('/load-progress/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM users WHERE telegram_id = ?', [id], (err, user) => {
    if (err || !user) return res.json({});
    const { coins, per_click, auto_per_sec, click_multi, auto_level, click_level } = user;
    res.json({ coins, perClick: per_click, autoPerSec: auto_per_sec, clickMulti: click_multi, autoLevel: auto_level, clickLevel: click_level });
  });
});

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер на порту ${PORT}`);
});
