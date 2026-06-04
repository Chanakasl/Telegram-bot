const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

const app = express();
app.use(express.json()); 

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN; 
const TMDB_API_KEY = process.env.TMDB_API_KEY; 
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID; // Broadcast & Requests සඳහා

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

// 👥 Database එකක් නැති නිසා තාවකාලිකව Active Users ලා සේව් කරන තැන
const activeUsers = new Set();

// 🔍 SINHALASUB API එකෙන් EXACT LINK එක හොයන FUNCTION එක
async function getSinhalaSubLink(title) {
    try {
        const response = await axios.get(`https://sinhalasub.lk/wp-json/wp/v2/posts?search=${encodeURIComponent(title)}&per_page=1`, { timeout: 3500 });
        if (response.data && response.data.length > 0) return response.data[0].link; 
    } catch (err) { console.error("Sinhalasub API Error."); }
    return `https://sinhalasub.lk/?s=${encodeURIComponent(title)}`;
}

// 📄 PAGINATION SEARCH FUNCTIONS (Next/Prev බටන් සඳහා)
async function sendMovieSearchResults(chatId, query, page = 1, messageIdToEdit = null) {
    try {
        const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=${page}`;
        const resApi = await axios.get(searchUrl);
        const totalPages = resApi.data.total_pages;
        const results = resApi.data.results ? resApi.data.results.slice(0, 5) : [];

        if (results.length > 0) {
            let inlineKeyboard = [];
            results.forEach(movie => {
                const year = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
                inlineKeyboard.push([{ text: `🎬 ${movie.title} (${year})`, callback_data: `mov_det:${movie.id}` }]);
            });

            // ⏭️ Next / Prev Buttons
            let paginationRow = [];
            const safeQuery = query.substring(0, 30); // Telegram 64-byte limit එකෙන් බේරෙන්න
            if (page > 1) paginationRow.push({ text: "⬅️ Prev", callback_data: `mov_p:${page - 1}:${safeQuery}` });
            if (page < totalPages) paginationRow.push({ text: "Next ➡️", callback_data: `mov_p:${page + 1}:${safeQuery}` });
            if (paginationRow.length > 0) inlineKeyboard.push(paginationRow);

            const replyText = `🍿 <b>CHUCKY MOVIE ZONE</b>\n\n<i>"${query}" සඳහා ප්‍රතිඵල (Page ${page}/${totalPages}):</i>`;
            
            if (messageIdToEdit) await bot.editMessageText(replyText, { chat_id: chatId, message_id: messageIdToEdit, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
            else await bot.sendMessage(chatId, replyText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
        } else {
            if (messageIdToEdit) await bot.editMessageText('❌ Movie not found!', { chat_id: chatId, message_id: messageIdToEdit });
            else await bot.sendMessage(chatId, '❌ Movie not found!');
        }
    } catch (err) { console.error(err); }
}

async function sendTvSearchResults(chatId, query, page = 1, messageIdToEdit = null) {
    try {
        const searchUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=${page}`;
        const resApi = await axios.get(searchUrl);
        const totalPages = resApi.data.total_pages;
        const results = resApi.data.results ? resApi.data.results.slice(0, 5) : [];

        if (results.length > 0) {
            let inlineKeyboard = [];
            results.forEach(tv => {
                const year = tv.first_air_date ? tv.first_air_date.split('-')[0] : 'N/A';
                inlineKeyboard.push([{ text: `📺 ${tv.name} (${year})`, callback_data: `tv_det:${tv.id}` }]);
            });

            let paginationRow = [];
            const safeQuery = query.substring(0, 30);
            if (page > 1) paginationRow.push({ text: "⬅️ Prev", callback_data: `tv_p:${page - 1}:${safeQuery}` });
            if (page < totalPages) paginationRow.push({ text: "Next ➡️", callback_data: `tv_p:${page + 1}:${safeQuery}` });
            if (paginationRow.length > 0) inlineKeyboard.push(paginationRow);

            const replyText = `🍿 <b>CHUCKY MOVIE ZONE</b>\n\n<i>"${query}" සඳහා TV Series ප්‍රතිඵල (Page ${page}/${totalPages}):</i>`;
            
            if (messageIdToEdit) await bot.editMessageText(replyText, { chat_id: chatId, message_id: messageIdToEdit, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
            else await bot.sendMessage(chatId, replyText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
        } else {
            if (messageIdToEdit) await bot.editMessageText('❌ TV Series not found!', { chat_id: chatId, message_id: messageIdToEdit });
            else await bot.sendMessage(chatId, '❌ TV Series not found!');
        }
    } catch (err) { console.error(err); }
}

// ---- 🌐 1. HOME PAGE (DARK RED CYBERPUNK TERMINAL) ----
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CHUCKY MOVIE ZONE PRO - ONLINE</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');

            *, *::before, *::after {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
            }

            :root {
                --red-bright: #ff1a1a;
                --red-neon: #ff2d2d;
                --red-glow: #cc0000;
                --red-dim: #8b0000;
                --red-deep: #3d0000;
                --bg-black: #080808;
                --bg-card: #0e0505;
                --bg-card2: #140808;
                --charcoal: #1a0a0a;
                --text-muted: #a08080;
                --text-faint: #6b4040;
                --white: #f5e6e6;
            }

            html, body { height: 100%; }

            body {
                background-color: var(--bg-black);
                color: var(--red-neon);
                font-family: 'Share Tech Mono', 'Courier New', Courier, monospace;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                padding: 20px;
                overflow-x: hidden;
                position: relative;
            }

            body::before {
                content: ''; position: fixed; inset: 0;
                background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.18) 2px, rgba(0, 0, 0, 0.18) 4px);
                pointer-events: none; z-index: 9999; animation: flicker 8s infinite;
            }

            body::after {
                content: ''; position: fixed; inset: 0;
                background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.75) 100%);
                pointer-events: none; z-index: 9998;
            }

            @keyframes flicker { 0%, 92%, 94%, 97%, 100% { opacity: 1; } 93% { opacity: 0.82; } 96% { opacity: 0.88; } 99% { opacity: 0.9; } }

            .terminal {
                width: 100%; max-width: 760px; background: var(--bg-card);
                border: 1px solid var(--red-glow);
                box-shadow: 0 0 8px rgba(204, 0, 0, 0.4), 0 0 30px rgba(204, 0, 0, 0.15), inset 0 0 40px rgba(61, 0, 0, 0.3);
                padding: 28px; border-radius: 6px; position: relative; z-index: 1;
                animation: terminalPulse 4s ease-in-out infinite;
            }

            @keyframes terminalPulse { 0%, 100% { box-shadow: 0 0 8px rgba(204,0,0,0.4), 0 0 30px rgba(204,0,0,0.15), inset 0 0 40px rgba(61,0,0,0.3); } 50% { box-shadow: 0 0 14px rgba(255,30,30,0.6), 0 0 45px rgba(204,0,0,0.25), inset 0 0 50px rgba(61,0,0,0.4); } }

            .header { border-bottom: 1px solid var(--red-glow); padding-bottom: 12px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
            .header-title { font-size: clamp(13px, 3.5vw, 16px); font-weight: bold; color: var(--red-bright); text-shadow: 0 0 8px var(--red-bright), 0 0 20px var(--red-glow); letter-spacing: 2px; }
            .header-status { font-size: 12px; color: var(--red-neon); letter-spacing: 1px; display: flex; align-items: center; gap: 6px; }
            .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--red-bright); box-shadow: 0 0 6px var(--red-bright), 0 0 14px var(--red-glow); animation: dotBlink 1.4s ease-in-out infinite; }
            @keyframes dotBlink { 0%, 100% { opacity: 1; box-shadow: 0 0 6px var(--red-bright), 0 0 14px var(--red-glow); } 50% { opacity: 0.3; box-shadow: none; } }

            .output .log-line { margin-bottom: 10px; font-size: clamp(12px, 2.8vw, 14px); color: var(--text-muted); display: flex; align-items: center; }
            .log-line .line-text { border-right: 2px solid var(--red-bright); white-space: nowrap; overflow: hidden; width: 0; }
            .log-line .line-text.typing-done { border-right: none; width: auto; }
            .log-line .tag-ok { color: #ff6060; font-weight: bold; }
            .log-line .tag-success { color: var(--red-bright); font-weight: bold; text-shadow: 0 0 8px var(--red-bright); }
            .log-line .tag-connected { color: #ff8080; font-weight: bold; }
            .log-success-line { margin-top: 14px; font-size: clamp(12px, 3vw, 15px); font-weight: bold; color: var(--white); text-shadow: 0 0 10px var(--red-bright), 0 0 24px var(--red-glow); opacity: 0; transition: opacity 0.4s; }
            .log-success-line.visible { opacity: 1; }
            .cursor { display: inline-block; width: 8px; height: 1em; background: var(--red-bright); margin-left: 2px; animation: cursorBlink 0.7s step-end infinite; }
            @keyframes cursorBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

            .success-box { margin-top: 28px; border: 1px dashed var(--red-glow); padding: 18px 20px; text-align: center; background: rgba(80, 0, 0, 0.12); border-radius: 4px; }
            .success-box h3 { margin: 0 0 8px 0; color: var(--white); font-size: clamp(13px, 3.5vw, 16px); }
            .success-box p { margin: 0 0 16px 0; color: var(--text-muted); font-size: clamp(11px, 2.5vw, 13px); }

            .btn-webhook { display: inline-block; color: var(--white); text-decoration: none; font-weight: bold; font-family: 'Share Tech Mono', monospace; font-size: clamp(12px, 3vw, 14px); letter-spacing: 2px; padding: 12px 28px; border-radius: 3px; border: 1px solid var(--red-bright); background: rgba(180, 0, 0, 0.15); transition: background 0.2s, box-shadow 0.2s; position: relative; overflow: hidden; }
            .btn-webhook:hover { background: rgba(220, 0, 0, 0.28); box-shadow: 0 0 18px rgba(255, 30, 30, 0.65); animation: btnGlitch 0.25s steps(2) 1; }
            @keyframes btnGlitch { 0% { transform: translate(0,0); } 25% { transform: translate(-2px, 1px); } 50% { transform: translate(2px, -1px); } 75% { transform: translate(-1px, 0px); } 100% { transform: translate(0,0); } }
        </style>
    </head>
    <body>
        <div class="terminal">
            <div class="header">
                <span class="header-title">⚡ CHUCKY_CORE_OS_v3.0</span>
                <span class="header-status"><span class="status-dot"></span>STATUS: ONLINE</span>
            </div>
            <div class="output">
                <div class="log-line" id="line1"><span class="line-text" id="lt1"></span><span class="cursor" id="c1"></span></div>
                <div class="log-line" id="line2"><span class="line-text" id="lt2"></span><span class="cursor" id="c2" style="display:none"></span></div>
                <div class="log-line" id="line3"><span class="line-text" id="lt3"></span><span class="cursor" id="c3" style="display:none"></span></div>
                <div class="log-success-line" id="successLine">[+ SUCCESS] CHUCKY MOVIE ZONE IS FIXED & DEPLOYED! 🚀</div>
            </div>
            <div class="success-box">
                <h3>🤖 BOT SYSTEM STATUS: ACTIVE</h3>
                <p>බොට් වැඩ කරන්නේ නැත්නම් පහල බටන් එක ඔබන්න.</p>
                <a class="btn-webhook" href="/setup">🚀 SET TELEGRAM WEBHOOK</a>
            </div>
        </div>
        <script>
            const lines = [
                { id: 'lt1', cursor: 'c1', raw: '[>] Connecting to Vercel Serverless Gateway... ', tag: '[OK]', tagClass: 'tag-ok' },
                { id: 'lt2', cursor: 'c2', raw: '[>] Integrating Automated WordPress API Tunnel... ', tag: '[SUCCESS]', tagClass: 'tag-success' },
                { id: 'lt3', cursor: 'c3', raw: '[>] Establishing secure tunnel handshake with Telegram API... ', tag: '[CONNECTED]', tagClass: 'tag-connected' }
            ];
            function typeLine(lineData, done) {
                const el = document.getElementById(lineData.id); const cursor = document.getElementById(lineData.cursor);
                cursor.style.display = 'inline-block'; let i = 0; const full = lineData.raw;
                function tick() {
                    if (i <= full.length) { el.textContent = full.slice(0, i); i++; setTimeout(tick, 28); } 
                    else { const tag = document.createElement('span'); tag.className = lineData.tagClass; tag.textContent = lineData.tag; el.appendChild(tag); cursor.style.display = 'none'; el.classList.add('typing-done'); setTimeout(done, 220); }
                } tick();
            }
            function runSequence(index) { if (index >= lines.length) { setTimeout(() => document.getElementById('successLine').classList.add('visible'), 300); return; } typeLine(lines[index], () => runSequence(index + 1)); }
            setTimeout(() => runSequence(0), 600);
        </script>
    </body>
    </html>
    `);
});

// ---- 🛠️ 2. WEBHOOK SETUP ROUTE ----
app.get('/setup', async (req, res) => {
    try {
        const host = req.headers.host; 
        if (host) {
            const webhookUrl = `https://${host}/bot${TELEGRAM_TOKEN}`;
            await bot.setWebHook(webhookUrl);
            return res.send(`<h1 style="color:green;text-align:center;margin-top:20%;">✅ Webhook Setup Successful!</h1>`);
        }
        res.status(400).send('Error: Host not found!');
    } catch (error) { res.status(500).send(`Webhook Setup Failed: ${error.message}`); }
});

// ---- 🤖 3. BOT LOGIC ----
app.post(`/bot${TELEGRAM_TOKEN}`, async (req, res) => {
    // Express Route එකෙන් එන updates බොට් එන්ජිමට process කරන්න ලබාදීම
    bot.processUpdate(req.body);

    try {
        const body = req.body;

        // 🔎 INLINE SEARCH FEATURE (ඔනෑම ගෘප් එකක @botname ගහලා සර්ච් කරන්න)
        if (body.inline_query) {
            const query = body.inline_query.query;
            const inlineQueryId = body.inline_query.id;
            if (query && query.length > 2) {
                try {
                    const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US`;
                    const response = await axios.get(searchUrl);
                    const results = response.data.results ? response.data.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv').slice(0, 10) : [];
                    
                    const inlineResults = results.map(item => ({
                        type: 'article',
                        id: item.id.toString(),
                        title: item.title || item.name || 'Untitled',
                        description: `⭐ ${item.vote_average ? item.vote_average.toFixed(1) : '0.0'} | ${item.release_date || item.first_air_date || 'N/A'}`,
                        thumb_url: item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : '',
                        input_message_content: {
                            message_text: `🎬 මම <b>${item.title || item.name}</b> ෆිල්ම් එක CHUCKY MOVIE ZONE PRO එකෙන් හොයාගත්තා!\n\nබොට් ඇතුලට ගිහින් <code>/${item.media_type} ${item.title || item.name}</code> කියලා ගහලා ඔයාත් බලන්න.`,
                            parse_mode: 'HTML'
                        }
                    }));
                    await bot.answerInlineQuery(inlineQueryId, inlineResults);
                } catch (e) { console.error("Inline Query Fetch Error:", e); }
            }
            return res.sendStatus(200);
        }

        if (body.message && body.message.text) {
            const msg = body.message;
            const chatId = msg.chat.id;
            const text = msg.text;
            const userId = msg.from ? msg.from.id : null;

            // Broadcast එකට Active Users ලාව එකතු කරගැනීම
            if (userId) activeUsers.add(userId);

            if (text.startsWith('/start') || text.startsWith('/help')) {
                const welcomeText = `🎬 <b>Welcome to CHUCKY MOVIE ZONE!</b> 🍿\n\n` +
                                    `ලෝකේ තියෙන ඕනෑම Movie, TV Series එකක් ලේසියෙන්ම සොයාගන්න!\n\n` +
                                    `<b>📌 Main Commands:</b>\n` +
                                    `🎥 <code>/movie [name]</code>\n` +
                                    `📺 <code>/tv [name]</code>\n\n` +
                                    `<b>🔥 Pro Features:</b>\n` +
                                    `📩 <code>/request [Movie Name]</code> - හොයාගන්න බැරි ෆිල්ම් එකක් Admin ගෙන් ඉල්ලන්න\n` +
                                    `🔎 <b>Inline Search:</b> ඕනෑම ගෘප් එකකට ගිහින් <code>@ඔයාගේ_බොට්ගේ_යුසර්නේම්_එක [ෆිල්ම් එකේ නම]</code> ටයිප් කරලා යාලුවන්ට ශෙයා කරන්න.\n\n` +
                                    `⚠️ <b>වැදගත්:</b>\n<i>ඇඩ්ස් නැතුව බලන්න ලින්ක්ස් ඕපන් කරද්දී "Brave Browser" එක පාවිච්චි කරන්න! 🦁</i>`;
                await bot.sendMessage(chatId, welcomeText, { parse_mode: 'HTML' });
            }

            // 📩 MOVIE REQUEST FEATURE
            else if (text.startsWith('/request ')) {
                const reqMovie = text.replace('/request ', '').trim();
                if (ADMIN_CHAT_ID) {
                    const senderName = msg.from ? msg.from.first_name : 'User';
                    const senderUser = msg.from && msg.from.username ? `@${msg.from.username}` : 'N/A';
                    await bot.sendMessage(ADMIN_CHAT_ID, `📩 <b>New Movie Request!</b>\n\n👤 From: ${senderName} (${senderUser})\n🎬 Requested: <b>${reqMovie}</b>`, { parse_mode: 'HTML' });
                    await bot.sendMessage(chatId, `✅ ඔයාගේ Request එක ඇඩ්මින්ට යැව්වා! (Sent: ${reqMovie})`);
                } else {
                    await bot.sendMessage(chatId, `⚠️ ඇඩ්මින් සෙට් කරලා නෑ.`);
                }
            }

            // 📢 ADMIN BROADCAST FEATURE
            else if (text.startsWith('/broadcast ')) {
                if (ADMIN_CHAT_ID && chatId.toString() === ADMIN_CHAT_ID.toString()) {
                    const bMsg = text.replace('/broadcast ', '').trim();
                    let count = 0;
                    for (let uId of activeUsers) {
                        try {
                            await bot.sendMessage(uId, `📢 <b>CHUCKY MOVIE ZONE UPDATE</b>\n\n${bMsg}`, { parse_mode: 'HTML' });
                            count++;
                        } catch(e) {}
                    }
                    await bot.sendMessage(chatId, `✅ Broadcast sent to ${count} active users!`);
                } else {
                    await bot.sendMessage(chatId, `❌ මේක ඇඩ්මින්ට විතරයි පුළුවන්!`);
                }
            }

            else if (text.startsWith('/movie ')) {
                const movieName = text.replace('/movie ', '').trim();
                await sendMovieSearchResults(chatId, movieName, 1);
            }

            else if (text.startsWith('/tv ')) {
                const tvName = text.replace('/tv ', '').trim();
                await sendTvSearchResults(chatId, tvName, 1);
            }
        }

        // CALLBACK QUERIES
        else if (body.callback_query) {
            const cb = body.callback_query;
            const chatId = cb.message.chat.id;
            const msgId = cb.message.message_id;
            const data = cb.data;

            try { await bot.answerCallbackQuery(cb.id); } catch(e){}

            // ⏭️ Pagination Button Actions [FIXED JSON SPLIT LIMIT ERROR]
            if (data.startsWith('mov_p:')) {
                const parts = data.split(':');
                const pageNum = parseInt(parts[1]);
                const queryStr = parts.slice(2).join(':'); 
                await sendMovieSearchResults(chatId, queryStr, pageNum, msgId);
            }
            else if (data.startsWith('tv_p:')) {
                const parts = data.split(':');
                const pageNum = parseInt(parts[1]);
                const queryStr = parts.slice(2).join(':');
                await sendTvSearchResults(chatId, queryStr, pageNum, msgId);
            }

            // ---- MOVIES DETAILED VIEW ----
            else if (data.startsWith('mov_det:')) {
                const tmdbId = data.split(':')[1];
                const detailUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=videos`;
                const resApi = await axios.get(detailUrl);
                const movie = resApi.data;

                const releaseYear = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
                const genres = movie.genres ? movie.genres.map(g => g.name).join(', ') : 'N/A';
                
                const embedId = movie.imdb_id || movie.id;
                
                const subUrl = await getSinhalaSubLink(movie.title);
                const ottUrl = `https://www.justwatch.com/us/search?q=${encodeURIComponent(movie.title)}`;
                
                const trailerVideo = movie.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
                const trailerUrl = trailerVideo ? `https://www.youtube.com/watch?v=${trailerVideo.key}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + ' official trailer')}`;

                let inlineKeyboard = [
                    [{ text: "🚀 Server 1 (VidSrc PRO)", url: `https://vidsrc.pro/embed/movie/${embedId}` }],
                    [{ text: "⚡ Server 2 (AutoEmbed)", url: `https://autoembed.co/movie/imdb/${embedId}` }],
                    [{ text: "🔥 Server 3 (VidLink)", url: `https://vidlink.pro/movie/${embedId}` }],
                    [
                        { text: "🎬 Watch Trailer", url: trailerUrl },
                        { text: "🌐 OTT Platforms", url: ottUrl }
                    ],
                    [{ text: "📝 Download Sinhala Subs", url: subUrl }]
                ];

                const movieRating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
                const replyMessage = `🎬 <b>${movie.title}</b> (${releaseYear})\n\n⭐ <b>Rating:</b> ${movieRating}/10\n🎭 <b>Genres:</b> ${genres}\n\n📝 <b>Overview:</b> <i>${movie.overview || 'No overview available.'}</i>\n\n⚠️ <b>NOTE:</b> <i>To watch without ads, open links with <b>Brave Browser</b>.</i> 🦁`;

                try { await bot.deleteMessage(chatId, msgId); } catch(e){}
                
                if (movie.poster_path) {
                    await bot.sendPhoto(chatId, `https://image.tmdb.org/t/p/w500${movie.poster_path}`, { caption: replyMessage, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                } else { 
                    await bot.sendMessage(chatId, replyMessage, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } }); 
                }
            }

            // ---- TV SERIES DETAILED VIEW ----
            else if (data.startsWith('tv_det:')) {
                const tvId = data.split(':')[1];
                const detailUrl = `https://api.themoviedb.org/3/tv/${tvId}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=videos`;
                const resApi = await axios.get(detailUrl);
                const tv = resApi.data;
                
                const year = tv.first_air_date ? tv.first_air_date.split('-')[0] : 'N/A';
                const genres = tv.genres ? tv.genres.map(g => g.name).join(', ') : 'N/A';
                
                const subUrl = await getSinhalaSubLink(tv.name);
                const ottUrl = `https://www.justwatch.com/us/search?q=${encodeURIComponent(tv.name)}`;
                
                const trailerVideo = tv.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
                const trailerUrl = trailerVideo ? `https://www.youtube.com/watch?v=${trailerVideo.key}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(tv.name + ' official trailer')}`;

                let inlineKeyboard = [
                    [{ text: "🚀 Server 1 (VidSrc PRO)", url: `https://vidsrc.pro/embed/tv/${tv.id}` }],
                    [{ text: "⚡ Server 2 (AutoEmbed)", url: `https://autoembed.co/tv/tmdb/${tv.id}-1-1` }],
                    [{ text: "🔥 Server 3 (VidLink)", url: `https://vidlink.pro/tv/${tv.id}/1/1` }],
                    [
                        { text: "🎬 Watch Trailer", url: trailerUrl },
                        { text: "🌐 OTT Platforms", url: ottUrl }
                    ],
                    [{ text: "📝 Download Sinhala Subs", url: subUrl }]
                ];

                const tvRating = tv.vote_average ? tv.vote_average.toFixed(1) : 'N/A';
                const replyMessage = `📺 <b>${tv.name}</b> (${year})\n\n⭐ <b>Rating:</b> ${tvRating}/10\n🎭 <b>Genres:</b> ${genres}\n\n📝 <b>Overview:</b> <i>${tv.overview || 'No overview available.'}</i>\n\n⚠️ <b>NOTE:</b> <i>To watch without ads, open links with <b>Brave Browser</b>.</i> 🦁`;
                
                try { await bot.deleteMessage(chatId, msgId); } catch(e){}
                
                if (tv.poster_path) {
                    await bot.sendPhoto(chatId, `https://image.tmdb.org/t/p/w500${tv.poster_path}`, { caption: replyMessage, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                } else { 
                    await bot.sendMessage(chatId, replyMessage, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } }); 
                }
            }
        }
    } catch (e) { console.error("Webhook Update Error:", e); } finally { res.sendStatus(200); }
});

module.exports = app;
