require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

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

app.use(express.static('public'));

// Главная
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Игра
app.get('/user/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'catclicker.html'));
});

// === АВТОРИЗАЦИЯ (100% ПО ДОКЕ TELEGRAM) ===
app.get('/auth/telegram', (req, res) => {
  const { hash, ...data } = req.query;
  if (!hash || !data.id) {
    return res.status(400).send('Нет данных');
  }

  // Формируем строку: key=value\nkey=value
  const dataCheckArr = Object.keys(data)
    .filter(key => key !== 'hash')
    .sort()
    .map(key => `${key}=${data[key]}`);
  const dataCheckString = dataCheckArr.join('\n');

  // secret_key = SHA256(BOT_TOKEN)
  const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest();

  // hash = HMAC_SHA256(dataCheckString, secret_key)
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (calculatedHash !== hash) {
    console.log('❌ Подпись не совпала:', { expected: calculatedHash, received: hash });
    return res.status(403).send('Неверная подпись');
  }

  const { id, first_name = 'Игрок', username = '' } = data;

  // Сохраняем пользователя
  db.get('SELECT * FROM users WHERE telegram_id = ?', [id], (err, user) => {
    if (!user) {
      db.run('INSERT INTO users (telegram_id, username, first_name) VALUES (?, ?, ?)', [id, username, first_name]);
    }

    // Редирект в бота
    const botLink = `https://t.me/${BOT_USERNAME}?start=play_${id}`;
    res.send(`
      <h2>Привет, ${first_name}!</h2>
      <p>Открываю бота...</p>
      <script>
        localStorage.setItem('tgId', '${id}');
        setTimeout(() => { window.location.href = '${botLink}'; }, 1000);
      </script>
    `);
  });
});

// === API ПРОГРЕССА ===
app.get('/load-progress/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM users WHERE telegram_id = ?', [id], (err, user) => {
    if (err || !user) return res.json({});
    res.json({
      coins: user.coins,
      perClick: user.per_click,
      autoPerSec: user.auto_per_sec,
      clickMulti: user.click_multi,
      autoLevel: user.auto_level,
      clickLevel: user.click_level
    });
  });
});

app.post('/save-progress', express.json(), (req, res) => {
  const { telegramId, coins, perClick, autoPerSec, clickMulti, autoLevel, clickLevel } = req.body;
  if (!telegramId) return res.status(400).send('Нет ID');

  db.run(
    `UPDATE users SET coins = ?, per_click = ?, auto_per_sec = ?, click_multi = ?, auto_level = ?, click_level = ? WHERE telegram_id = ?`,
    [coins, perClick, autoPerSec, clickMulti, autoLevel, clickLevel, telegramId],
    () => res.send('OK')
  );
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен: https://cat-clicker-efr8.onrender.com`);
});
