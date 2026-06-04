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

// ---- 🌐 1. HOME PAGE (HACKING ANIMATION) ----
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CHUCKY MOVIE ZONE PRO - ONLINE</title>
        <style>
            /* ── Reset & base ── */
            *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

            body {
                background-color: #050505;
                color: #00ff00;
                font-family: 'Courier New', Courier, monospace;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                padding: 20px;
                overflow-x: hidden;
                position: relative;
            }

            /* ── CRT scanline overlay ── */
            body::before {
                content: '';
                position: fixed;
                inset: 0;
                pointer-events: none;
                z-index: 999;
                background: repeating-linear-gradient(
                    to bottom,
                    transparent 0px,
                    transparent 3px,
                    rgba(0, 0, 0, 0.18) 3px,
                    rgba(0, 0, 0, 0.18) 4px
                );
            }

            /* ── Subtle screen flicker ── */
            body::after {
                content: '';
                position: fixed;
                inset: 0;
                pointer-events: none;
                z-index: 998;
                background: rgba(0, 255, 0, 0.015);
                animation: flicker 8s infinite;
            }

            @keyframes flicker {
                0%,  19%,  21%,  23%,  25%,  54%,  56%,  100% { opacity: 1; }
                20%,  22%,  24%,  55% { opacity: 0.85; }
            }

            /* ── Terminal card ── */
            .terminal {
                width: 100%;
                max-width: 750px;
                background: rgba(0, 15, 0, 0.92);
                border: 1px solid #00ff00;
                box-shadow:
                    0 0 18px rgba(0, 255, 0, 0.25),
                    0 0 60px rgba(0, 255, 0, 0.08),
                    inset 0 0 30px rgba(0, 255, 0, 0.03);
                padding: 25px;
                border-radius: 8px;
                position: relative;
                animation: terminalBoot 0.4s ease-out;
            }

            @keyframes terminalBoot {
                from { opacity: 0; transform: scaleY(0.96); }
                to   { opacity: 1; transform: scaleY(1); }
            }

            /* ── Header ── */
            .header {
                border-bottom: 1px solid #00ff00;
                padding-bottom: 10px;
                margin-bottom: 20px;
                font-weight: bold;
                display: flex;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 6px;
            }

            .header span:last-child {
                animation: statusPulse 2.5s ease-in-out infinite;
            }

            @keyframes statusPulse {
                0%, 100% { color: #00ff00; text-shadow: 0 0 6px #00ff00; }
                50%       { color: #00cc00; text-shadow: 0 0 14px #00ff00, 0 0 28px rgba(0,255,0,0.4); }
            }

            /* ── Log output lines (typing animation) ── */
            .output { overflow: hidden; }

            .output .line {
                margin-bottom: 8px;
                overflow: hidden;
                white-space: nowrap;
                opacity: 0;
                animation: typeLine 0.05s steps(1, end) forwards;
            }

            /* Each character "types" in via width expand */
            .output .line span {
                display: inline-block;
                overflow: hidden;
                white-space: nowrap;
                width: 0;
                animation: typeChars var(--dur, 0.7s) steps(var(--steps, 50), end) forwards;
                animation-delay: var(--delay, 0s);
            }

            /* Line fade-in trigger */
            .output .line { animation: none; opacity: 1; }

            .output .line span {
                width: 0;
                max-width: 100%;
            }

            @keyframes typeChars {
                from { width: 0; }
                to   { width: 100%; }
            }

            /* Blinking cursor on the last line */
            .output .line:last-child span::after {
                content: '█';
                animation: blink 0.9s step-end infinite;
                margin-left: 1px;
                font-size: 0.9em;
            }

            @keyframes blink {
                0%, 100% { opacity: 1; }
                50%       { opacity: 0; }
            }

            /* ── [+ SUCCESS] neon glow ── */
            .success-line {
                color: #ffffff !important;
                font-weight: bold;
                margin-top: 10px;
                text-shadow:
                    0 0 6px  #00ff00,
                    0 0 14px #00ff00,
                    0 0 30px rgba(0,255,0,0.6);
                animation: successGlow 2s ease-in-out infinite alternate;
            }

            @keyframes successGlow {
                from {
                    text-shadow: 0 0 6px #00ff00, 0 0 14px #00ff00, 0 0 30px rgba(0,255,0,0.5);
                }
                to {
                    text-shadow: 0 0 10px #00ff00, 0 0 26px #00ff00, 0 0 55px rgba(0,255,0,0.8), 0 0 80px rgba(0,255,0,0.3);
                }
            }

            /* ── Success box ── */
            .success-box {
                margin-top: 25px;
                border: 2px dashed #00ff00;
                padding: 15px;
                text-align: center;
                background: rgba(0, 40, 0, 0.3);
                box-shadow: inset 0 0 20px rgba(0,255,0,0.05);
            }

            /* ── Webhook button ── */
            a.btn {
                color: #000;
                text-decoration: none;
                font-weight: bold;
                background: #00ff00;
                padding: 10px 20px;
                border-radius: 4px;
                display: inline-block;
                margin-top: 10px;
                font-family: 'Courier New', Courier, monospace;
                font-size: 15px;
                letter-spacing: 0.04em;
                transition:
                    background   0.25s ease,
                    color        0.25s ease,
                    box-shadow   0.25s ease,
                    transform    0.15s ease;
                box-shadow:
                    0 0 10px rgba(0,255,0,0.5),
                    0 0 22px rgba(0,255,0,0.2);
            }

            a.btn:hover {
                background: #ffffff;
                color: #000;
                transform: translateY(-2px) scale(1.03);
                box-shadow:
                    0 0 18px rgba(255,255,255,0.9),
                    0 0 40px rgba(0,255,0,0.6),
                    0 0 70px rgba(0,255,0,0.3);
            }

            a.btn:active {
                transform: translateY(0) scale(0.98);
                box-shadow: 0 0 8px rgba(0,255,0,0.4);
            }

            /* ── Mobile ── */
            @media (max-width: 480px) {
                .terminal { padding: 18px 14px; }
                .header { font-size: 13px; }
                .output .line span { font-size: 12px; }
                a.btn { font-size: 13px; padding: 9px 16px; }
            }
        </style>
    </head>
    <body>
        <div class="terminal">
            <div class="header">
                <span>⚡ CHUCKY_CORE_OS_v3.0</span>
                <span>STATUS: ONLINE</span>
            </div>
            <div class="output">
                <div class="line">
                    <span style="--dur:1.1s; --steps:52; --delay:0.2s">[&gt;] Connecting to Vercel Serverless Gateway... [OK]</span>
                </div>
                <div class="line">
                    <span style="--dur:1.4s; --steps:64; --delay:1.5s">[&gt;] Integrating Automated WordPress API Tunnel... [SUCCESS]</span>
                </div>
                <div class="line">
                    <span style="--dur:1.5s; --steps:70; --delay:3.1s">[&gt;] Establishing secure tunnel handshake with Telegram API... [CONNECTED]</span>
                </div>
                <div class="line success-line">
                    <span style="--dur:1.2s; --steps:55; --delay:4.8s">[+ SUCCESS] CHUCKY MOVIE ZONE IS FIXED &amp; DEPLOYED! 🚀</span>
                </div>
            </div>
            <div class="success-box">
                <h3 style="margin: 0 0 10px 0; color: #fff;">🤖 BOT SYSTEM STATUS: ACTIVE</h3>
                <p style="margin: 5px 0 15px 0; color: #ccc; font-size: 13px;">බොට් වැඩ කරන්නේ නැත්නම් පහල බටන් එක ඔබන්න.</p>
                <a href="/setup" class="btn">🚀 SET TELEGRAM WEBHOOK</a>
            </div>
        </div>
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
