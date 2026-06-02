const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TMDB_API_KEY = process.env.TMDB_API_KEY;

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

// ---- 📊 LIVE MONITOR STORE ----
const MAX_LOGS = 100;
const liveLog = [];
const sseClients = [];

function addLog(entry) {
    liveLog.unshift({ ...entry, time: new Date().toISOString() });
    if (liveLog.length > MAX_LOGS) liveLog.pop();
    const data = JSON.stringify(entry);
    sseClients.forEach(res => res.write(`data: ${data}\n\n`));
}

// ---- LIVE MONITOR HTML PAGE ----
app.get('/live', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CHUCKY MOVIE ZONE — Live Monitor</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0d0d0f; color: #e8e8e8; font-family: 'Segoe UI', system-ui, sans-serif; min-height: 100vh; }
  
  .header {
    background: #141417;
    border-bottom: 1px solid #2a2a2e;
    padding: 16px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .header-left { display: flex; align-items: center; gap: 12px; }
  .logo { font-size: 20px; font-weight: 700; color: #fff; letter-spacing: -0.3px; }
  .logo span { color: #e74c3c; }
  .subtitle { font-size: 12px; color: #666; }
  
  .status-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: #2ed573; box-shadow: 0 0 6px #2ed573;
    animation: pulse 2s infinite;
  }
  .status-dot.offline { background: #e74c3c; box-shadow: 0 0 6px #e74c3c; animation: none; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  
  .stats-bar {
    display: flex;
    gap: 1px;
    background: #2a2a2e;
    border-bottom: 1px solid #2a2a2e;
  }
  .stat-card {
    flex: 1;
    background: #141417;
    padding: 14px 20px;
    text-align: center;
  }
  .stat-num { font-size: 28px; font-weight: 700; color: #fff; }
  .stat-label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
  
  .controls {
    padding: 12px 24px;
    display: flex;
    gap: 8px;
    align-items: center;
    border-bottom: 1px solid #1e1e22;
  }
  .filter-btn {
    padding: 6px 14px; border-radius: 20px;
    border: 1px solid #2a2a2e; background: transparent;
    color: #888; font-size: 12px; cursor: pointer; transition: all 0.15s;
  }
  .filter-btn.active { background: #e74c3c; border-color: #e74c3c; color: #fff; }
  .filter-btn:hover:not(.active) { border-color: #444; color: #ccc; }
  .clear-btn {
    margin-left: auto; padding: 6px 14px; border-radius: 6px;
    border: 1px solid #333; background: transparent;
    color: #666; font-size: 12px; cursor: pointer; transition: all 0.15s;
  }
  .clear-btn:hover { border-color: #e74c3c; color: #e74c3c; }
  
  .log-container { padding: 16px 24px; display: flex; flex-direction: column; gap: 8px; }
  
  .log-entry {
    background: #141417;
    border: 1px solid #1e1e22;
    border-radius: 10px;
    padding: 12px 16px;
    display: flex;
    gap: 12px;
    align-items: flex-start;
    animation: slideIn 0.2s ease;
    transition: border-color 0.15s;
  }
  .log-entry:hover { border-color: #2a2a2e; }
  @keyframes slideIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
  
  .log-entry.type-message { border-left: 3px solid #3498db; }
  .log-entry.type-button  { border-left: 3px solid #9b59b6; }
  .log-entry.type-command { border-left: 3px solid #e74c3c; }
  
  .avatar {
    width: 36px; height: 36px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 13px; flex-shrink: 0;
  }
  .avatar.type-message { background: #1a3a5c; color: #5fa8e8; }
  .avatar.type-button  { background: #2d1f4a; color: #9b59b6; }
  .avatar.type-command { background: #3d1a1a; color: #e74c3c; }
  
  .log-body { flex: 1; min-width: 0; }
  .log-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
  .user-name { font-weight: 600; font-size: 13px; color: #fff; }
  .username { font-size: 11px; color: #555; }
  .type-badge {
    font-size: 10px; padding: 2px 8px; border-radius: 10px;
    font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;
  }
  .type-badge.type-message { background: #1a3a5c; color: #5fa8e8; }
  .type-badge.type-button  { background: #2d1f4a; color: #9b59b6; }
  .type-badge.type-command { background: #3d1a1a; color: #e74c3c; }
  
  .log-text { font-size: 13px; color: #aaa; word-break: break-word; }
  .log-text strong { color: #e8e8e8; }
  
  .log-time { font-size: 10px; color: #444; margin-top: 4px; }
  
  .chat-id-badge {
    font-size: 10px; color: #444; font-family: monospace;
    background: #1a1a1e; border: 1px solid #2a2a2e;
    padding: 1px 6px; border-radius: 4px;
  }
  
  .empty-state {
    text-align: center; padding: 60px 24px; color: #444;
  }
  .empty-state .icon { font-size: 48px; margin-bottom: 16px; }
  .empty-state p { font-size: 14px; }
  
  .connection-banner {
    padding: 8px 24px; font-size: 12px; text-align: center;
    display: none;
  }
  .connection-banner.show { display: block; }
  .connection-banner.connecting { background: #1a1a0a; color: #e6a817; }
  .connection-banner.error { background: #1a0a0a; color: #e74c3c; }
</style>
</head>
<body>

<div class="header">
  <div class="header-left">
    <div class="status-dot" id="statusDot"></div>
    <div>
      <div class="logo">🎬 <span>CHUCKY</span> MOVIE ZONE</div>
      <div class="subtitle">Live User Monitor</div>
    </div>
  </div>
  <div style="font-size:12px;color:#444;" id="lastUpdate">Connecting...</div>
</div>

<div class="stats-bar">
  <div class="stat-card">
    <div class="stat-num" id="statTotal">0</div>
    <div class="stat-label">Total Events</div>
  </div>
  <div class="stat-card">
    <div class="stat-num" id="statUsers">0</div>
    <div class="stat-label">Unique Users</div>
  </div>
  <div class="stat-card">
    <div class="stat-num" id="statCommands">0</div>
    <div class="stat-label">Commands</div>
  </div>
  <div class="stat-card">
    <div class="stat-num" id="statButtons">0</div>
    <div class="stat-label">Button Clicks</div>
  </div>
</div>

<div class="controls">
  <button class="filter-btn active" data-filter="all" onclick="setFilter('all', this)">All</button>
  <button class="filter-btn" data-filter="command" onclick="setFilter('command', this)">Commands</button>
  <button class="filter-btn" data-filter="message" onclick="setFilter('message', this)">Messages</button>
  <button class="filter-btn" data-filter="button" onclick="setFilter('button', this)">Buttons</button>
  <button class="clear-btn" onclick="clearLogs()">Clear</button>
</div>

<div class="connection-banner connecting" id="connBanner">⏳ Connecting to live feed...</div>

<div class="log-container" id="logContainer">
  <div class="empty-state" id="emptyState">
    <div class="icon">📡</div>
    <p>Waiting for bot activity...</p>
    <p style="margin-top:8px;font-size:12px;">Send a message to the bot to see it appear here.</p>
  </div>
</div>

<script>
let allLogs = [];
let uniqueUsers = new Set();
let commandCount = 0;
let buttonCount = 0;
let currentFilter = 'all';
let evtSource;

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

function getInitials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
}

function makeEntry(log) {
  const el = document.createElement('div');
  el.className = 'log-entry type-' + log.type;
  el.dataset.type = log.type;

  let badgeText = log.type === 'command' ? '⌨ Command' : log.type === 'button' ? '🔘 Button' : '💬 Message';
  let logText = '';
  if (log.type === 'button') {
    logText = '<strong>Clicked:</strong> ' + escHtml(log.data || '');
  } else {
    logText = escHtml(log.text || '');
  }

  el.innerHTML = \`
    <div class="avatar type-\${log.type}">\${getInitials(log.from)}</div>
    <div class="log-body">
      <div class="log-top">
        <span class="user-name">\${escHtml(log.from || 'Unknown')}</span>
        \${log.username ? '<span class="username">@' + escHtml(log.username) + '</span>' : ''}
        <span class="type-badge type-\${log.type}">\${badgeText}</span>
        <span class="chat-id-badge">#\${log.chatId || ''}</span>
      </div>
      <div class="log-text">\${logText}</div>
      <div class="log-time">\${formatTime(log.time)}</div>
    </div>
  \`;
  return el;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderLogs() {
  const container = document.getElementById('logContainer');
  const empty = document.getElementById('emptyState');
  const filtered = currentFilter === 'all' ? allLogs : allLogs.filter(l => l.type === currentFilter);

  container.querySelectorAll('.log-entry').forEach(e => e.remove());

  if (filtered.length === 0) {
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';
  filtered.forEach(log => container.appendChild(makeEntry(log)));
}

function updateStats() {
  document.getElementById('statTotal').textContent = allLogs.length;
  document.getElementById('statUsers').textContent = uniqueUsers.size;
  document.getElementById('statCommands').textContent = commandCount;
  document.getElementById('statButtons').textContent = buttonCount;
}

function addLogEntry(log) {
  allLogs.unshift(log);
  if (allLogs.length > 100) allLogs.pop();

  uniqueUsers.add(log.chatId || log.from);
  if (log.type === 'command') commandCount++;
  if (log.type === 'button') buttonCount++;

  updateStats();

  const empty = document.getElementById('emptyState');
  empty.style.display = 'none';

  if (currentFilter === 'all' || currentFilter === log.type) {
    const container = document.getElementById('logContainer');
    const el = makeEntry(log);
    container.insertBefore(el, container.firstChild);
  }

  document.getElementById('lastUpdate').textContent = 'Last update: ' + formatTime(log.time);
}

function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderLogs();
}

function clearLogs() {
  allLogs = []; uniqueUsers.clear(); commandCount = 0; buttonCount = 0;
  updateStats();
  document.getElementById('logContainer').querySelectorAll('.log-entry').forEach(e => e.remove());
  document.getElementById('emptyState').style.display = '';
}

function connect() {
  const banner = document.getElementById('connBanner');
  const dot = document.getElementById('statusDot');

  banner.textContent = '⏳ Connecting to live feed...';
  banner.className = 'connection-banner connecting show';

  evtSource = new EventSource('/live-stream');

  evtSource.onopen = () => {
    dot.className = 'status-dot';
    banner.className = 'connection-banner';
  };

  evtSource.onmessage = (e) => {
    try {
      const log = JSON.parse(e.data);
      addLogEntry(log);
    } catch(_) {}
  };

  evtSource.onerror = () => {
    dot.className = 'status-dot offline';
    banner.textContent = '🔴 Connection lost. Reconnecting in 3s...';
    banner.className = 'connection-banner error show';
    evtSource.close();
    setTimeout(connect, 3000);
  };
}

// Load existing logs on page load
fetch('/live-logs')
  .then(r => r.json())
  .then(logs => {
    logs.forEach(log => {
      allLogs.push(log);
      uniqueUsers.add(log.chatId || log.from);
      if (log.type === 'command') commandCount++;
      if (log.type === 'button') buttonCount++;
    });
    updateStats();
    renderLogs();
  })
  .catch(() => {});

connect();
</script>
</body>
</html>`);
});

// ---- SSE STREAM ENDPOINT ----
app.get('/live-stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(': connected\n\n');
    sseClients.push(res);

    req.on('close', () => {
        const i = sseClients.indexOf(res);
        if (i !== -1) sseClients.splice(i, 1);
    });
});

// ---- EXISTING LOGS ENDPOINT ----
app.get('/live-logs', (req, res) => {
    res.json(liveLog);
});

app.get('/', (req, res) => res.send('CHUCKY MOVIE ZONE Pro is Alive & Running!'));

app.post(\`/bot\${TELEGRAM_TOKEN}\`, async (req, res) => {
    try {
        const body = req.body;

        // ---- LIVE MONITORING LOGS ----
        if (body.message && body.message.text) {
            const msg = body.message;
            const text = msg.text;
            const type = text.startsWith('/') ? 'command' : 'message';
            console.log(\`👤 User: \${msg.from.first_name} (@\${msg.from.username || 'NoUser'}) | 💬 Message: \${text}\`);
            addLog({
                type,
                from: msg.from.first_name + (msg.from.last_name ? ' ' + msg.from.last_name : ''),
                username: msg.from.username || null,
                chatId: msg.chat.id,
                text
            });
        } else if (body.callback_query) {
            const cb = body.callback_query;
            console.log(\`🔘 Button Clicked by: \${cb.from.first_name} | 📊 Data: \${cb.data}\`);
            addLog({
                type: 'button',
                from: cb.from.first_name + (cb.from.last_name ? ' ' + cb.from.last_name : ''),
                username: cb.from.username || null,
                chatId: cb.message.chat.id,
                data: cb.data
            });
        }

        // ---- 1. TEXT COMMANDS HANDLING ----
        if (body.message && body.message.text) {
            const msg = body.message;
            const chatId = msg.chat.id;
            const text = msg.text;

            if (text.startsWith('/start') || text.startsWith('/help')) {
                const welcomeText = \`🎬 <b>Welcome to CHUCKY MOVIE ZONE!</b> 🍿\n\n\` +
                                    \`ලෝකේ තියෙන ඕනෑම Movie, TV Series හෝ Anime එකක් ලේසියෙන්ම සොයාගන්න!\n\n\` +
                                    \`<b>📌 Main Commands:</b>\n\` +
                                    \`🎥 <code>/movie [name]</code> - Search a Movie\n\` +
                                    \`📺 <code>/tv [name]</code> - Search a TV Series\n\` +
                                    \`⛩️ <code>/anime [name]</code> - Search Anime\n\` +
                                    \`🎭 <code>/actor [name]</code> - Search Actor/Actress\n\n\` +
                                    \`<b>🔥 Explore:</b>\n\` +
                                    \`📈 <code>/trending</code> - Today's Top Movies\n\` +
                                    \`🍿 <code>/upcoming</code> - Coming Soon Movies\n\` +
                                    \`🏆 <code>/imdb250</code> - Top Rated Masterpieces\n\` +
                                    \`🎲 <code>/random</code> - Random Suggestion\n\n\` +
                                    \`<i>💡 Example: /movie Avengers</i>\`;
                await bot.sendMessage(chatId, welcomeText, { parse_mode: 'HTML' });
            }

            else if (text.startsWith('/movie ')) {
                const movieName = text.replace('/movie ', '').trim();
                const searchingMsg = await bot.sendMessage(chatId, \`🔍 <i>Searching for "\${movieName}"...</i>\`, { parse_mode: 'HTML' });
                try {
                    const searchUrl = \`https://api.themoviedb.org/3/search/movie?api_key=\${TMDB_API_KEY}&query=\${encodeURIComponent(movieName)}&language=en-US\`;
                    const resApi = await axios.get(searchUrl);
                    const results = resApi.data.results.slice(0, 5);
                    if (results.length > 0) {
                        let inlineKeyboard = [];
                        results.forEach(movie => {
                            const year = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
                            inlineKeyboard.push([{ text: \`🎬 \${movie.title} (\${year})\`, callback_data: \`mov_det:\${movie.id}\` }]);
                        });
                        await bot.deleteMessage(chatId, searchingMsg.message_id);
                        await bot.sendMessage(chatId, \`🍿 <b>CHUCKY MOVIE ZONE</b>\n\n<i>"\${movieName}" සඳහා ගැලපෙන ප්‍රතිඵල මෙන්න. ඔයාට අවශ්‍ය එක ක්ලික් කරන්න:</i>\`, {
                            parse_mode: 'HTML',
                            reply_markup: { inline_keyboard: inlineKeyboard }
                        });
                    } else {
                        await bot.editMessageText('❌ Movie not found! වෙනත් නමක් උත්සාහ කරන්න.', { chat_id: chatId, message_id: searchingMsg.message_id });
                    }
                } catch (err) {
                    await bot.editMessageText('⚠️ Server Error.', { chat_id: chatId, message_id: searchingMsg.message_id });
                }
            }

            else if (text.startsWith('/tv ')) {
                const tvName = text.replace('/tv ', '').trim();
                const searchingMsg = await bot.sendMessage(chatId, \`🔍 <i>Searching TV Series "\${tvName}"...</i>\`, { parse_mode: 'HTML' });
                try {
                    const searchUrl = \`https://api.themoviedb.org/3/search/tv?api_key=\${TMDB_API_KEY}&query=\${encodeURIComponent(tvName)}&language=en-US\`;
                    const resApi = await axios.get(searchUrl);
                    const results = resApi.data.results.slice(0, 5);
                    if (results.length > 0) {
                        let inlineKeyboard = [];
                        results.forEach(tv => {
                            const year = tv.first_air_date ? tv.first_air_date.split('-')[0] : 'N/A';
                            inlineKeyboard.push([{ text: \`📺 \${tv.name} (\${year})\`, callback_data: \`tv_det:\${tv.id}\` }]);
                        });
                        await bot.deleteMessage(chatId, searchingMsg.message_id);
                        await bot.sendMessage(chatId, \`🍿 <b>CHUCKY MOVIE ZONE</b>\n\n<i>"\${tvName}" සඳහා ගැලපෙන TV Series මෙන්න:</i>\`, {
                            parse_mode: 'HTML',
                            reply_markup: { inline_keyboard: inlineKeyboard }
                        });
                    } else {
                        await bot.editMessageText('❌ TV Series not found!', { chat_id: chatId, message_id: searchingMsg.message_id });
                    }
                } catch (err) {
                    await bot.editMessageText('⚠️ Server Error.', { chat_id: chatId, message_id: searchingMsg.message_id });
                }
            }

            else if (text.startsWith('/anime ')) {
                const animeName = text.replace('/anime ', '').trim();
                const searchingMsg = await bot.sendMessage(chatId, \`⛩️ <i>Searching Anime "\${animeName}"...</i>\`, { parse_mode: 'HTML' });
                try {
                    const searchUrl = \`https://api.themoviedb.org/3/search/tv?api_key=\${TMDB_API_KEY}&query=\${encodeURIComponent(animeName)}&with_genres=16\`;
                    const resApi = await axios.get(searchUrl);
                    const results = resApi.data.results.slice(0, 5);
                    if (results.length > 0) {
                        let inlineKeyboard = [];
                        results.forEach(anime => {
                            const year = anime.first_air_date ? anime.first_air_date.split('-')[0] : 'N/A';
                            inlineKeyboard.push([{ text: \`⛩️ \${anime.name} (\${year})\`, callback_data: \`ani_det:\${anime.id}\` }]);
                        });
                        await bot.deleteMessage(chatId, searchingMsg.message_id);
                        await bot.sendMessage(chatId, \`🍿 <b>CHUCKY MOVIE ZONE</b>\n\n<i>"\${animeName}" සඳහා ගැලපෙන Anime මෙන්න:</i>\`, {
                            parse_mode: 'HTML',
                            reply_markup: { inline_keyboard: inlineKeyboard }
                        });
                    } else {
                        await bot.editMessageText('❌ Anime not found!', { chat_id: chatId, message_id: searchingMsg.message_id });
                    }
                } catch (err) {
                    await bot.editMessageText('⚠️ Server Error.', { chat_id: chatId, message_id: searchingMsg.message_id });
                }
            }

            else if (text.startsWith('/actor ')) {
                const actorName = text.replace('/actor ', '').trim();
                const searchingMsg = await bot.sendMessage(chatId, \`🎭 <i>Searching Actor "\${actorName}"...</i>\`, { parse_mode: 'HTML' });
                try {
                    const searchUrl = \`https://api.themoviedb.org/3/search/person?api_key=\${TMDB_API_KEY}&query=\${encodeURIComponent(actorName)}\`;
                    const resApi = await axios.get(searchUrl);
                    if (resApi.data.results.length > 0) {
                        const actor = resApi.data.results[0];
                        let msgText = \`🎭 <b>\${actor.name}</b>\n\n<b>🎬 Known For (ප්‍රසිද්ධ චිත්‍රපට):</b>\n\`;
                        actor.known_for.forEach((m, i) => { msgText += \`\${i + 1}. \${m.title || m.name}\n\`; });
                        msgText += \`\n<i>(Type /movie [name] to watch these!)</i>\`;
                        await bot.deleteMessage(chatId, searchingMsg.message_id);
                        if (actor.profile_path) {
                            await bot.sendPhoto(chatId, \`https://image.tmdb.org/t/p/w500\${actor.profile_path}\`, { caption: msgText, parse_mode: 'HTML' });
                        } else {
                            await bot.sendMessage(chatId, msgText, { parse_mode: 'HTML' });
                        }
                    } else {
                        await bot.editMessageText('❌ Actor not found!', { chat_id: chatId, message_id: searchingMsg.message_id });
                    }
                } catch (err) {
                    await bot.editMessageText('⚠️ Server Error.', { chat_id: chatId, message_id: searchingMsg.message_id });
                }
            }

            else if (text === '/imdb250') {
                const tmdbUrl = \`https://api.themoviedb.org/3/movie/top_rated?api_key=\${TMDB_API_KEY}&language=en-US&page=1\`;
                const resApi = await axios.get(tmdbUrl);
                const shuffled = resApi.data.results.sort(() => 0.5 - Math.random());
                let imdbMsg = \`🏆 <b>Top Rated Masterpieces (CHUCKY MOVIE ZONE):</b>\n\n\`;
                shuffled.slice(0, 5).forEach((m, index) => { imdbMsg += \`\${index + 1}. <b>\${m.title}</b> (⭐ \${m.vote_average.toFixed(1)})\n\`; });
                await bot.sendMessage(chatId, imdbMsg, { parse_mode: 'HTML' });
            }
            else if (text === '/trending') {
                const tmdbUrl = \`https://api.themoviedb.org/3/trending/movie/day?api_key=\${TMDB_API_KEY}\`;
                const resApi = await axios.get(tmdbUrl);
                let trendMsg = \`🔥 <b>Today's Trending Movies:</b>\n\n\`;
                resApi.data.results.slice(0, 5).forEach((m, index) => { trendMsg += \`\${index + 1}. <b>\${m.title}</b> (\${m.vote_average.toFixed(1)})\n\`; });
                await bot.sendMessage(chatId, trendMsg, { parse_mode: 'HTML' });
            }
            else if (text === '/upcoming') {
                const tmdbUrl = \`https://api.themoviedb.org/3/movie/upcoming?api_key=\${TMDB_API_KEY}&language=en-US&page=1\`;
                const resApi = await axios.get(tmdbUrl);
                let upMsg = \`🍿 <b>Upcoming Movies:</b>\n\n\`;
                resApi.data.results.slice(0, 5).forEach((m, index) => { upMsg += \`\${index + 1}. <b>\${m.title}</b> (\${m.release_date})\n\`; });
                await bot.sendMessage(chatId, upMsg, { parse_mode: 'HTML' });
            }
            else if (text === '/random') {
                const randomPage = Math.floor(Math.random() * 10) + 1;
                const tmdbUrl = \`https://api.themoviedb.org/3/movie/top_rated?api_key=\${TMDB_API_KEY}&language=en-US&page=\${randomPage}\`;
                const resApi = await axios.get(tmdbUrl);
                const movie = resApi.data.results[Math.floor(Math.random() * resApi.data.results.length)];
                await bot.sendMessage(chatId, \`🎲 <b>Random Suggestion!</b>\n\nTry watching: <b>\${movie.title}</b>\n\n(Type <code>/movie \${movie.title}</code> to get links!)\`, { parse_mode: 'HTML' });
            }
        }

        // ---- 2. INLINE BUTTON CLICKS (CALLBACK QUERIES) ----
        else if (body.callback_query) {
            const cb = body.callback_query;
            const chatId = cb.message.chat.id;
            const msgId = cb.message.message_id;
            const data = cb.data;

            await bot.answerCallbackQuery(cb.id);

            if (data.startsWith('mov_det:')) {
                const tmdbId = data.split(':')[1];
                const detailUrl = \`https://api.themoviedb.org/3/movie/\${tmdbId}?api_key=\${TMDB_API_KEY}&language=en-US&append_to_response=videos,credits,watch/providers\`;
                const resApi = await axios.get(detailUrl);
                const movie = resApi.data;

                const releaseYear = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
                const runtime = movie.runtime ? \`\${Math.floor(movie.runtime / 60)}h \${movie.runtime % 60}m\` : 'N/A';
                const genres = movie.genres ? movie.genres.map(g => g.name).join(', ') : 'N/A';
                const cast = movie.credits.cast ? movie.credits.cast.slice(0, 3).map(c => c.name).join(', ') : 'N/A';
                const imdbId = movie.imdb_id;

                const trailer = movie.videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
                const trailerUrl = trailer ? \`https://www.youtube.com/watch?v=\${trailer.key}\` : \`https://www.youtube.com/results?search_query=\${encodeURIComponent(movie.title + ' trailer')}\`;
                const subUrl = \`https://www.google.com/search?q=\${encodeURIComponent(movie.title + ' sinhala subtitles baiscope zoom.lk')}\`;
                const providers = movie['watch/providers']?.results?.US?.link;

                let inlineKeyboard = [];
                if (imdbId) {
                    inlineKeyboard.push(
                        [{ text: "🚀 Watch Server 1", url: \`https://vidsrc.to/embed/movie/\${imdbId}\` }],
                        [{ text: "⚡ Watch Server 2", url: \`https://embed.su/embed/movie/\${imdbId}\` }]
                    );
                } else {
                    inlineKeyboard.push([{ text: "🚀 Stream Server", url: \`https://vidsrc.to/embed/movie/\${movie.id}\` }]);
                }
                inlineKeyboard.push([{ text: "🎬 Trailer", url: trailerUrl }, { text: "📝 Sinhala Subs", url: subUrl }]);
                let thirdRow = [{ text: "💡 Similar Movies", callback_data: \`mov_sim:\${movie.id}\` }];
                if (imdbId) thirdRow.push({ text: "⭐ IMDb", url: \`https://www.imdb.com/title/\${imdbId}\` });
                if (providers) thirdRow.push({ text: "📺 OTT", url: providers });
                inlineKeyboard.push(thirdRow);

                const replyMessage = \`🎬 <b>\${movie.title}</b> (\${releaseYear})\n\n\` +
                                     \`⭐ <b>Rating:</b> \${movie.vote_average.toFixed(1)}/10\n\` +
                                     \`⏳ <b>Runtime:</b> \${runtime}\n\` +
                                     \`🎭 <b>Genres:</b> \${genres}\n\` +
                                     \`👥 <b>Cast:</b> \${cast}\n\n\` +
                                     \`📝 <b>Overview:</b> <i>\${movie.overview}</i>\n\n\` +
                                     \`⚡ <i>CHUCKY MOVIE ZONE PRO</i>\`;

                await bot.deleteMessage(chatId, msgId);
                if (movie.poster_path) {
                    await bot.sendPhoto(chatId, \`https://image.tmdb.org/t/p/w500\${movie.poster_path}\`, { caption: replyMessage, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                } else {
                    await bot.sendMessage(chatId, replyMessage, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                }
            }

            else if (data.startsWith('tv_det:') || data.startsWith('ani_det:')) {
                const tvId = data.split(':')[1];
                const detailUrl = \`https://api.themoviedb.org/3/tv/\${tvId}?api_key=\${TMDB_API_KEY}&language=en-US&append_to_response=videos,credits\`;
                const resApi = await axios.get(detailUrl);
                const tv = resApi.data;

                const year = tv.first_air_date ? tv.first_air_date.split('-')[0] : 'N/A';
                const seasons = tv.number_of_seasons ? \`\${tv.number_of_seasons} Seasons\` : 'N/A';
                const episodes = tv.number_of_episodes ? \`\${tv.number_of_episodes} Episodes\` : 'N/A';
                const genres = tv.genres ? tv.genres.map(g => g.name).join(', ') : 'N/A';
                const cast = tv.credits && tv.credits.cast ? tv.credits.cast.slice(0, 3).map(c => c.name).join(', ') : 'N/A';

                const trailer = tv.videos && tv.videos.results ? tv.videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube') : null;
                const trailerUrl = trailer ? \`https://www.youtube.com/watch?v=\${trailer.key}\` : \`https://www.youtube.com/results?search_query=\${encodeURIComponent(tv.name + ' trailer')}\`;
                const subUrl = \`https://www.google.com/search?q=\${encodeURIComponent(tv.name + ' tv series sinhala subtitles')}\`;

                let inlineKeyboard = [
                    [{ text: "🚀 Watch Server 1", url: \`https://vidsrc.to/embed/tv/\${tv.id}\` }],
                    [{ text: "⚡ Watch Server 2", url: \`https://embed.su/embed/tv/\${tv.id}/1/1\` }],
                    [{ text: "🎬 Trailer", url: trailerUrl }, { text: "📝 Sinhala Subs", url: subUrl }],
                    [{ text: "💡 Similar Shows", callback_data: \`tv_sim:\${tv.id}\` }]
                ];

                const msgText = \`📺 <b>\${tv.name}</b> (\${year})\n\n\` +
                                \`⭐ <b>Rating:</b> \${tv.vote_average.toFixed(1)}/10\n\` +
                                \`⏳ <b>Status:</b> \${seasons} (\${episodes})\n\` +
                                \`🎭 <b>Genres:</b> \${genres}\n\` +
                                \`👥 <b>Cast:</b> \${cast}\n\n\` +
                                \`📝 <b>Overview:</b> <i>\${tv.overview}</i>\n\n\` +
                                \`⚡ <i>CHUCKY MOVIE ZONE PRO</i>\`;

                await bot.deleteMessage(chatId, msgId);
                if (tv.poster_path) {
                    await bot.sendPhoto(chatId, \`https://image.tmdb.org/t/p/w500\${tv.poster_path}\`, { caption: msgText, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                } else {
                    await bot.sendMessage(chatId, msgText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                }
            }

            else if (data.startsWith('mov_sim:')) {
                const tmdbId = data.split(':')[1];
                try {
                    const simUrl = \`https://api.themoviedb.org/3/movie/\${tmdbId}/similar?api_key=\${TMDB_API_KEY}&language=en-US&page=1\`;
                    const resApi = await axios.get(simUrl);
                    const results = resApi.data.results.slice(0, 5);
                    if (results.length > 0) {
                        let inlineKeyboard = [];
                        results.forEach(m => {
                            const year = m.release_date ? m.release_date.split('-')[0] : 'N/A';
                            inlineKeyboard.push([{ text: \`🎬 \${m.title} (\${year})\`, callback_data: \`mov_det:\${m.id}\` }]);
                        });
                        await bot.sendMessage(chatId, \`💡 <b>මේ නිර්මාණයට සමාන තවත් සුපිරි Movies 5ක් මෙන්න:</b>\`, {
                            parse_mode: 'HTML',
                            reply_markup: { inline_keyboard: inlineKeyboard }
                        });
                    } else {
                        await bot.sendMessage(chatId, \`❌ සමාන නිර්මාණ හමු වුණේ නැත.\`);
                    }
                } catch (err) {
                    await bot.sendMessage(chatId, \`⚠️ Error fetching similar movies.\`);
                }
            }

            else if (data.startsWith('tv_sim:')) {
                const tvId = data.split(':')[1];
                try {
                    const simUrl = \`https://api.themoviedb.org/3/tv/\${tvId}/similar?api_key=\${TMDB_API_KEY}&language=en-US&page=1\`;
                    const resApi = await axios.get(simUrl);
                    const results = resApi.data.results.slice(0, 5);
                    if (results.length > 0) {
                        let inlineKeyboard = [];
                        results.forEach(t => {
                            const year = t.first_air_date ? t.first_air_date.split('-')[0] : 'N/A';
                            inlineKeyboard.push([{ text: \`📺 \${t.name} (\${year})\`, callback_data: \`tv_det:\${t.id}\` }]);
                        });
                        await bot.sendMessage(chatId, \`💡 <b>මේ නිර්මාණයට සමාන තවත් සුපිරි TV Shows මෙන්න:</b>\`, {
                            parse_mode: 'HTML',
                            reply_markup: { inline_keyboard: inlineKeyboard }
                        });
                    } else {
                        await bot.sendMessage(chatId, \`❌ සමාන නිර්මාණ හමු වුණේ නැත.\`);
                    }
                } catch (err) {
                    await bot.sendMessage(chatId, \`⚠️ Error fetching similar shows.\`);
                }
            }
        }
    } catch (e) {
        console.error("Webhook Error:", e);
    } finally {
        res.sendStatus(200);
    }
});

module.exports = app;
