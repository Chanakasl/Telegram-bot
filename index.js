const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

const app = express();
app.use(express.json()); 

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN; 
const TMDB_API_KEY = process.env.TMDB_API_KEY; 

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

// 🔍 SINHALASUB API එකෙන් EXACT LINK එක හොයන FUNCTION එක
async function getSinhalaSubLink(title) {
    try {
        // Sinhalasub API එකට රහසින්ම පින් එකක් ගසා බැලීම
        const response = await axios.get(`https://sinhalasub.lk/wp-json/wp/v2/posts?search=${encodeURIComponent(title)}&per_page=1`, { timeout: 3500 });
        if (response.data && response.data.length > 0) {
            return response.data[0].link; // ෆිල්ම් එක තිබ්බොත් කෙලින්ම පෝස්ට් එකේ ලින්ක් එක දෙනවා
        }
    } catch (err) {
        console.error("Sinhalasub API Error or Timeout, switching to fallback.");
    }
    // සයිට් එකේ නැත්නම් හෝ API එක වැඩ නැත්නම් Search ලින්ක් එක සෙට් කරනවා
    return `https://sinhalasub.lk/?s=${encodeURIComponent(title)}`;
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

            html, body {
                height: 100%;
            }

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

            /* ── CRT SCANLINES + FLICKER OVERLAY ── */
            body::before {
                content: '';
                position: fixed;
                inset: 0;
                background: repeating-linear-gradient(
                    0deg,
                    transparent,
                    transparent 2px,
                    rgba(0, 0, 0, 0.18) 2px,
                    rgba(0, 0, 0, 0.18) 4px
                );
                pointer-events: none;
                z-index: 9999;
                animation: flicker 8s infinite;
            }

            /* Micro-glitch vignette */
            body::after {
                content: '';
                position: fixed;
                inset: 0;
                background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.75) 100%);
                pointer-events: none;
                z-index: 9998;
            }

            @keyframes flicker {
                0%   { opacity: 1; }
                92%  { opacity: 1; }
                93%  { opacity: 0.82; }
                94%  { opacity: 1; }
                96%  { opacity: 0.88; }
                97%  { opacity: 1; }
                99%  { opacity: 0.9; }
                100% { opacity: 1; }
            }

            /* ── MAIN TERMINAL CARD ── */
            .terminal {
                width: 100%;
                max-width: 760px;
                background: var(--bg-card);
                border: 1px solid var(--red-glow);
                box-shadow:
                    0 0 8px rgba(204, 0, 0, 0.4),
                    0 0 30px rgba(204, 0, 0, 0.15),
                    0 0 60px rgba(204, 0, 0, 0.08),
                    inset 0 0 40px rgba(61, 0, 0, 0.3);
                padding: 28px;
                border-radius: 6px;
                position: relative;
                z-index: 1;
                animation: terminalPulse 4s ease-in-out infinite;
            }

            @keyframes terminalPulse {
                0%, 100% { box-shadow: 0 0 8px rgba(204,0,0,0.4), 0 0 30px rgba(204,0,0,0.15), 0 0 60px rgba(204,0,0,0.08), inset 0 0 40px rgba(61,0,0,0.3); }
                50%       { box-shadow: 0 0 14px rgba(255,30,30,0.6), 0 0 45px rgba(204,0,0,0.25), 0 0 80px rgba(204,0,0,0.12), inset 0 0 50px rgba(61,0,0,0.4); }
            }

            /* ── HEADER BAR ── */
            .header {
                border-bottom: 1px solid var(--red-glow);
                padding-bottom: 12px;
                margin-bottom: 24px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 8px;
            }

            .header-title {
                font-size: clamp(13px, 3.5vw, 16px);
                font-weight: bold;
                color: var(--red-bright);
                text-shadow: 0 0 8px var(--red-bright), 0 0 20px var(--red-glow);
                letter-spacing: 2px;
                animation: titleGlow 2.5s ease-in-out infinite;
            }

            @keyframes titleGlow {
                0%, 100% { text-shadow: 0 0 8px var(--red-bright), 0 0 20px var(--red-glow); }
                50%       { text-shadow: 0 0 14px #ff4444, 0 0 35px var(--red-bright), 0 0 60px var(--red-glow); }
            }

            .header-status {
                font-size: 12px;
                color: var(--red-neon);
                letter-spacing: 1px;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: var(--red-bright);
                box-shadow: 0 0 6px var(--red-bright), 0 0 14px var(--red-glow);
                animation: dotBlink 1.4s ease-in-out infinite;
                display: inline-block;
            }

            @keyframes dotBlink {
                0%, 100% { opacity: 1; box-shadow: 0 0 6px var(--red-bright), 0 0 14px var(--red-glow); }
                50%       { opacity: 0.3; box-shadow: none; }
            }

            /* ── TERMINAL LOG OUTPUT ── */
            .output {
                margin-bottom: 8px;
            }

            .output .log-line {
                margin-bottom: 10px;
                font-size: clamp(12px, 2.8vw, 14px);
                color: var(--text-muted);
                min-height: 1.4em;
                display: flex;
                align-items: center;
                gap: 0;
            }

            .log-line .line-text {
                border-right: 2px solid var(--red-bright);
                white-space: nowrap;
                overflow: hidden;
                width: 0;
                animation: none;
            }

            .log-line .line-text.typing-done {
                border-right: none;
                width: auto;
            }

            /* highlight [SUCCESS] / [OK] / [CONNECTED] tokens */
            .log-line .tag-ok       { color: #ff6060; font-weight: bold; }
            .log-line .tag-success  { color: var(--red-bright); font-weight: bold; text-shadow: 0 0 8px var(--red-bright); }
            .log-line .tag-connected{ color: #ff8080; font-weight: bold; }

            /* The big SUCCESS line */
            .log-success-line {
                margin-top: 14px;
                font-size: clamp(12px, 3vw, 15px);
                font-weight: bold;
                color: var(--white);
                text-shadow: 0 0 10px var(--red-bright), 0 0 24px var(--red-glow);
                letter-spacing: 1px;
                animation: successPulse 2s ease-in-out infinite;
                opacity: 0;
                transition: opacity 0.4s;
            }

            .log-success-line.visible {
                opacity: 1;
            }

            @keyframes successPulse {
                0%, 100% { text-shadow: 0 0 10px var(--red-bright), 0 0 24px var(--red-glow); }
                50%       { text-shadow: 0 0 18px #ff4444, 0 0 40px var(--red-bright), 0 0 70px var(--red-glow); }
            }

            /* blinking cursor used during typing */
            .cursor {
                display: inline-block;
                width: 8px;
                height: 1em;
                background: var(--red-bright);
                box-shadow: 0 0 6px var(--red-bright);
                vertical-align: middle;
                margin-left: 2px;
                animation: cursorBlink 0.7s step-end infinite;
            }

            @keyframes cursorBlink {
                0%, 100% { opacity: 1; }
                50%       { opacity: 0; }
            }

            /* ── SUCCESS BOX ── */
            .success-box {
                margin-top: 28px;
                border: 1px dashed var(--red-glow);
                padding: 18px 20px;
                text-align: center;
                background: rgba(80, 0, 0, 0.12);
                border-radius: 4px;
                box-shadow: 0 0 16px rgba(180, 0, 0, 0.1);
            }

            .success-box h3 {
                margin: 0 0 8px 0;
                color: var(--white);
                font-size: clamp(13px, 3.5vw, 16px);
                text-shadow: 0 0 10px rgba(255, 100, 100, 0.5);
            }

            .success-box p {
                margin: 0 0 16px 0;
                color: var(--text-muted);
                font-size: clamp(11px, 2.5vw, 13px);
                font-family: 'Share Tech Mono', monospace;
            }

            /* ── CYBERPUNK WEBHOOK BUTTON ── */
            .btn-webhook {
                display: inline-block;
                color: var(--white);
                text-decoration: none;
                font-weight: bold;
                font-family: 'Share Tech Mono', 'Courier New', monospace;
                font-size: clamp(12px, 3vw, 14px);
                letter-spacing: 2px;
                padding: 12px 28px;
                border-radius: 3px;
                border: 1px solid var(--red-bright);
                background: rgba(180, 0, 0, 0.15);
                box-shadow:
                    0 0 10px rgba(255, 30, 30, 0.35),
                    0 0 25px rgba(204, 0, 0, 0.2),
                    inset 0 0 10px rgba(180, 0, 0, 0.1);
                cursor: pointer;
                position: relative;
                overflow: hidden;
                transition: background 0.2s, box-shadow 0.2s;
            }

            .btn-webhook::before {
                content: '';
                position: absolute;
                top: 0; left: -100%;
                width: 60%;
                height: 100%;
                background: linear-gradient(120deg, transparent, rgba(255,40,40,0.18), transparent);
                transition: left 0.45s ease;
            }

            .btn-webhook:hover::before {
                left: 150%;
            }

            .btn-webhook:hover {
                background: rgba(220, 0, 0, 0.28);
                box-shadow:
                    0 0 18px rgba(255, 30, 30, 0.65),
                    0 0 45px rgba(204, 0, 0, 0.4),
                    0 0 80px rgba(180, 0, 0, 0.2),
                    inset 0 0 18px rgba(220, 0, 0, 0.2);
                animation: btnGlitch 0.25s steps(2) 1;
            }

            @keyframes btnGlitch {
                0%   { transform: translate(0,0); filter: none; }
                25%  { transform: translate(-2px, 1px); filter: hue-rotate(15deg) brightness(1.2); }
                50%  { transform: translate(2px, -1px); filter: hue-rotate(-10deg) brightness(1.3); }
                75%  { transform: translate(-1px, 0px); filter: none; }
                100% { transform: translate(0,0); }
            }

            .btn-webhook:active {
                transform: scale(0.97);
                box-shadow: 0 0 8px rgba(255,30,30,0.4);
            }

            /* ── RESPONSIVE ── */
            @media (max-width: 520px) {
                .terminal { padding: 18px 14px; }
                .success-box { padding: 14px 12px; }
                .btn-webhook { padding: 10px 20px; letter-spacing: 1px; }
            }
        </style>
    </head>
    <body>
        <div class="terminal">
            <div class="header">
                <span class="header-title">⚡ CHUCKY_CORE_OS_v3.0</span>
                <span class="header-status">
                    <span class="status-dot"></span>
                    STATUS: ONLINE
                </span>
            </div>

            <div class="output">
                <div class="log-line" id="line1">
                    <span class="line-text" id="lt1"></span><span class="cursor" id="c1"></span>
                </div>
                <div class="log-line" id="line2">
                    <span class="line-text" id="lt2"></span><span class="cursor" id="c2" style="display:none"></span>
                </div>
                <div class="log-line" id="line3">
                    <span class="line-text" id="lt3"></span><span class="cursor" id="c3" style="display:none"></span>
                </div>

                <div class="log-success-line" id="successLine">
                    [+ SUCCESS] CHUCKY MOVIE ZONE IS FIXED &amp; DEPLOYED! 🚀
                </div>
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
                { id: 'lt3', cursor: 'c3', raw: '[>] Establishing secure tunnel handshake with Telegram API... ', tag: '[CONNECTED]', tagClass: 'tag-connected' },
            ];

            function typeLine(lineData, done) {
                const el     = document.getElementById(lineData.id);
                const cursor = document.getElementById(lineData.cursor);
                cursor.style.display = 'inline-block';

                const full = lineData.raw;
                let i = 0;
                const speed = 28; // ms per character

                function tick() {
                    if (i <= full.length) {
                        el.textContent = full.slice(0, i);
                        i++;
                        setTimeout(tick, speed + (Math.random() * 18 | 0));
                    } else {
                        // Append coloured tag
                        const tag = document.createElement('span');
                        tag.className = lineData.tagClass;
                        tag.textContent = lineData.tag;
                        el.appendChild(tag);
                        cursor.style.display = 'none';
                        el.classList.add('typing-done');
                        setTimeout(done, 220);
                    }
                }
                tick();
            }

            function runSequence(index) {
                if (index >= lines.length) {
                    // Reveal success line
                    setTimeout(() => {
                        document.getElementById('successLine').classList.add('visible');
                    }, 300);
                    return;
                }
                typeLine(lines[index], () => runSequence(index + 1));
            }

            // Slight delay before starting so the terminal card animates in first
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
    try {
        const body = req.body;

        if (body.message && body.message.text) {
            const msg = body.message;
            const chatId = msg.chat.id;
            const text = msg.text;

            if (text.startsWith('/start') || text.startsWith('/help')) {
                const welcomeText = `🎬 <b>Welcome to CHUCKY MOVIE ZONE!</b> 🍿\n\n` +
                                    `ලෝකේ තියෙන ඕනෑම Movie, TV Series හෝ Anime එකක් ලේසියෙන්ම සොයාගන්න!\n\n` +
                                    `<b>📌 Main Commands:</b>\n` +
                                    `🎥 <code>/movie [name]</code>\n` +
                                    `📺 <code>/tv [name]</code>\n\n` +
                                    `⚠️ <b>වැදගත්:</b>\n<i>ඇඩ්ස් නැතුව බලන්න ලින්ක්ස් ඕපන් කරද්දී "Brave Browser" එක පාවිච්චි කරන්න!</i> 🦁`;
                await bot.sendMessage(chatId, welcomeText, { parse_mode: 'HTML' });
            }

            else if (text.startsWith('/movie ')) {
                const movieName = text.replace('/movie ', '').trim();
                const searchingMsg = await bot.sendMessage(chatId, `🔍 <i>Searching for "${movieName}"...</i>`, { parse_mode: 'HTML' });
                try {
                    const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(movieName)}&language=en-US`;
                    const resApi = await axios.get(searchUrl);
                    const results = resApi.data.results.slice(0, 5);
                    if (results.length > 0) {
                        let inlineKeyboard = [];
                        results.forEach(movie => {
                            const year = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
                            inlineKeyboard.push([{ text: `🎬 ${movie.title} (${year})`, callback_data: `mov_det:${movie.id}` }]);
                        });
                        await bot.deleteMessage(chatId, searchingMsg.message_id);
                        await bot.sendMessage(chatId, `🍿 <b>CHUCKY MOVIE ZONE</b>\n\n<i>ප්‍රතිඵල මෙන්න:</i>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                    } else { await bot.editMessageText('❌ Movie not found!', { chat_id: chatId, message_id: searchingMsg.message_id }); }
                } catch (err) { await bot.editMessageText('⚠️ Server Error.', { chat_id: chatId, message_id: searchingMsg.message_id }); }
            }

            else if (text.startsWith('/tv ')) {
                const tvName = text.replace('/tv ', '').trim();
                const searchingMsg = await bot.sendMessage(chatId, `🔍 <i>Searching TV Series "${tvName}"...</i>`, { parse_mode: 'HTML' });
                try {
                    const searchUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(tvName)}&language=en-US`;
                    const resApi = await axios.get(searchUrl);
                    const results = resApi.data.results.slice(0, 5);
                    if (results.length > 0) {
                        let inlineKeyboard = [];
                        results.forEach(tv => {
                            const year = tv.first_air_date ? tv.first_air_date.split('-')[0] : 'N/A';
                            inlineKeyboard.push([{ text: `📺 ${tv.name} (${year})`, callback_data: `tv_det:${tv.id}` }]);
                        });
                        await bot.deleteMessage(chatId, searchingMsg.message_id);
                        await bot.sendMessage(chatId, `🍿 <b>CHUCKY MOVIE ZONE</b>\n\n<i>ප්‍රතිඵල මෙන්න:</i>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                    } else { await bot.editMessageText('❌ TV Series not found!', { chat_id: chatId, message_id: searchingMsg.message_id }); }
                } catch (err) { await bot.editMessageText('⚠️ Server Error.', { chat_id: chatId, message_id: searchingMsg.message_id }); }
            }
        }

        // CALLBACK QUERIES
        else if (body.callback_query) {
            const cb = body.callback_query;
            const chatId = cb.message.chat.id;
            const msgId = cb.message.message_id;
            const data = cb.data;

            await bot.answerCallbackQuery(cb.id);

            // ---- MOVIES ----
            if (data.startsWith('mov_det:')) {
                const tmdbId = data.split(':')[1];
                const detailUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=videos`;
                const resApi = await axios.get(detailUrl);
                const movie = resApi.data;

                const releaseYear = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
                const genres = movie.genres ? movie.genres.map(g => g.name).join(', ') : 'N/A';
                const imdbId = movie.imdb_id || movie.id;
                
                // 🚀 මෙතනදී සින්හලසබ් ලින්ක් එක Automated ක්‍රමයට API එකෙන් ගන්නවා
                const subUrl = await getSinhalaSubLink(movie.title);
                const ottUrl = `https://www.justwatch.com/us/search?q=${encodeURIComponent(movie.title)}`;
                
                const trailerVideo = movie.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
                const trailerUrl = trailerVideo ? `https://www.youtube.com/watch?v=${trailerVideo.key}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + ' official trailer')}`;

                let inlineKeyboard = [
                    [{ text: "🚀 Server 1 (VidSrc PRO)", url: `https://vidsrc.pro/embed/movie/${imdbId}` }],
                    [{ text: "⚡ Server 2 (AutoEmbed)", url: `https://autoembed.co/movie/imdb/${imdbId}` }],
                    [{ text: "🔥 Server 3 (VidLink)", url: `https://vidlink.pro/movie/${imdbId}` }],
                    [
                        { text: "🎬 Watch Trailer", url: trailerUrl },
                        { text: "🌐 OTT Platforms", url: ottUrl }
                    ],
                    [{ text: "📝 Download Sinhala Subs", url: subUrl }]
                ];

                const replyMessage = `🎬 <b>${movie.title}</b> (${releaseYear})\n\n⭐ <b>Rating:</b> ${movie.vote_average.toFixed(1)}/10\n🎭 <b>Genres:</b> ${genres}\n\n📝 <b>Overview:</b> <i>${movie.overview}</i>\n\n⚠️ <b>NOTE:</b> <i>To watch without annoying ads, open links with <b>Brave Browser</b>.</i> 🦁`;

                await bot.deleteMessage(chatId, msgId);
                if (movie.poster_path) {
                    await bot.sendPhoto(chatId, `https://image.tmdb.org/t/p/w500${movie.poster_path}`, { caption: replyMessage, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                } else { await bot.sendMessage(chatId, replyMessage, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } }); }
            }

            // ---- TV SERIES ----
            else if (data.startsWith('tv_det:')) {
                const tvId = data.split(':')[1];
                const detailUrl = `https://api.themoviedb.org/3/tv/${tvId}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=videos`;
                const resApi = await axios.get(detailUrl);
                const tv = resApi.data;
                
                const year = tv.first_air_date ? tv.first_air_date.split('-')[0] : 'N/A';
                const genres = tv.genres ? tv.genres.map(g => g.name).join(', ') : 'N/A';
                
                // 🚀 TV Series සඳහාත් API එකෙන් Exact ලින්ක් එක සෙට් කිරීම
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

                const replyMessage = `📺 <b>${tv.name}</b> (${year})\n\n⭐ <b>Rating:</b> ${tv.vote_average.toFixed(1)}/10\n🎭 <b>Genres:</b> ${genres}\n\n📝 <b>Overview:</b> <i>${tv.overview}</i>\n\n⚠️ <b>NOTE:</b> <i>To watch without annoying ads, open links with <b>Brave Browser</b>.</i> 🦁`;
                
                await bot.deleteMessage(chatId, msgId);
                if (tv.poster_path) {
                    await bot.sendPhoto(chatId, `https://image.tmdb.org/t/p/w500${tv.poster_path}`, { caption: replyMessage, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                } else { await bot.sendMessage(chatId, replyMessage, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } }); }
            }
        }
    } catch (e) { console.error("Webhook Error:", e); } finally { res.sendStatus(200); }
});

module.exports = app;
