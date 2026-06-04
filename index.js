const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

const app = express();
app.use(express.json()); 

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN; 
const TMDB_API_KEY = process.env.TMDB_API_KEY; 

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

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
            body { background-color: #050505; color: #00ff00; font-family: 'Courier New', Courier, monospace; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
            .terminal { width: 100%; max-width: 750px; background: rgba(0, 15, 0, 0.9); border: 1px solid #00ff00; box-shadow: 0 0 30px rgba(0, 255, 0, 0.2); padding: 25px; border-radius: 8px; }
            .header { border-bottom: 1px solid #00ff00; padding-bottom: 10px; margin-bottom: 20px; font-weight: bold; display: flex; justify-content: space-between; }
            .output div { margin-bottom: 8px; }
            .success-box { margin-top: 25px; border: 2px dashed #00ff00; padding: 15px; text-align: center; background: rgba(0, 40, 0, 0.3); }
            a { color: #000; text-decoration: none; font-weight: bold; background: #00ff00; padding: 8px 15px; border-radius: 4px; display: inline-block; margin-top: 10px; }
            a:hover { background: #fff; box-shadow: 0 0 15px #fff; }
        </style>
    </head>
    <body>
        <div class="terminal">
            <div class="header"><span>⚡ CHUCKY_CORE_OS_v3.0</span><span>STATUS: ONLINE</span></div>
            <div class="output">
                <div>[>] Connecting to Vercel Serverless Gateway... [OK]</div>
                <div>[>] Loading Environment Variables securely... [TOKEN LOADED]</div>
                <div>[>] Establishing secure tunnel handshake with Telegram API... [CONNECTED]</div>
                <div style="color: #ffffff; font-weight: bold; text-shadow: 0 0 10px #00ff00; margin-top:10px;">[+ SUCCESS] CHUCKY MOVIE ZONE PRO IS ALIVE & RUNNING! 🚀</div>
            </div>
            <div class="success-box">
                <h3 style="margin: 0 0 10px 0; color: #fff;">🤖 BOT SYSTEM STATUS: ACTIVE</h3>
                <p style="margin: 5px 0 15px 0; color: #ccc; font-size: 13px;">බොට් වැඩ කරන්නේ නැත්නම් පහල බටන් එක ඔබන්න.</p>
                <a href="/setup">🚀 SET TELEGRAM WEBHOOK</a>
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
            return res.send(`
                <div style="background-color: #050505; color: #00ff00; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: sans-serif;">
                    <h1>✅ Webhook Setup Successful!</h1>
                    <p>දැන් ටෙලිග්‍රෑම් එකට ගිහින් බොට්ට /start කියලා යවන්න.</p>
                </div>
            `);
        }
        res.status(400).send('Error: Host not found!');
    } catch (error) { 
        res.status(500).send(`Webhook Setup Failed: ${error.message}`); 
    }
});

// ---- 🤖 3. BOT LOGIC (COMMANDS & CALLBACKS) ----
app.post(`/bot${TELEGRAM_TOKEN}`, async (req, res) => {
    try {
        const body = req.body;

        // Handle text messages
        if (body.message && body.message.text) {
            const msg = body.message;
            const chatId = msg.chat.id;
            const text = msg.text;

            if (text.startsWith('/start') || text.startsWith('/help')) {
                const welcomeText = `🎬 <b>Welcome to CHUCKY MOVIE ZONE!</b> 🍿\n\n` +
                                    `ලෝකේ තියෙන ඕනෑම Movie, TV Series හෝ Anime එකක් ලේසියෙන්ම සොයාගන්න!\n\n` +
                                    `<b>📌 Main Commands:</b>\n` +
                                    `🎥 <code>/movie [name]</code> - Search a Movie\n` +
                                    `📺 <code>/tv [name]</code> - Search a TV Series\n` +
                                    `⛩️ <code>/anime [name]</code> - Search Anime\n\n` +
                                    `⚠️ <b>වැදගත්:</b>\n<i>ඇඩ්ස් (Ads) කරදරයක් නැතුව ෆිල්ම් බලන්න ලින්ක්ස් ඕපන් කරන්න "Brave Browser" එක පාවිච්චි කරන්න!</i> 🦁`;
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
                        await bot.sendMessage(chatId, `🍿 <b>CHUCKY MOVIE ZONE</b>\n\n<i>"${movieName}" සඳහා ගැලපෙන ප්‍රතිඵල මෙන්න:</i>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
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
                        await bot.sendMessage(chatId, `🍿 <b>CHUCKY MOVIE ZONE</b>\n\n<i>"${tvName}" සඳහා ගැලපෙන TV Series මෙන්න:</i>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                    } else { await bot.editMessageText('❌ TV Series not found!', { chat_id: chatId, message_id: searchingMsg.message_id }); }
                } catch (err) { await bot.editMessageText('⚠️ Server Error.', { chat_id: chatId, message_id: searchingMsg.message_id }); }
            }
        }

        // Handle inline button clicks
        else if (body.callback_query) {
            const cb = body.callback_query;
            const chatId = cb.message.chat.id;
            const msgId = cb.message.message_id;
            const data = cb.data;

            await bot.answerCallbackQuery(cb.id);

            if (data.startsWith('mov_det:')) {
                const tmdbId = data.split(':')[1];
                const detailUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;
                const resApi = await axios.get(detailUrl);
                const movie = resApi.data;

                const releaseYear = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
                const genres = movie.genres ? movie.genres.map(g => g.name).join(', ') : 'N/A';
                const imdbId = movie.imdb_id || movie.id;
                
                const subUrl = `https://www.google.com/search?q=${encodeURIComponent(movie.title + ' sinhala subtitles baiscope zoom.lk')}`;

                let inlineKeyboard = [
                    [{ text: "🚀 Server 1 (VidSrc PRO)", url: `https://vidsrc.pro/embed/movie/${imdbId}` }],
                    [{ text: "⚡ Server 2 (AutoEmbed)", url: `https://autoembed.co/movie/imdb/${imdbId}` }],
                    [{ text: "🔥 Server 3 (VidLink)", url: `https://vidlink.pro/movie/${imdbId}` }],
                    [{ text: "📝 Download Sinhala Subs", url: subUrl }]
                ];

                const replyMessage = `🎬 <b>${movie.title}</b> (${releaseYear})\n\n⭐ <b>Rating:</b> ${movie.vote_average.toFixed(1)}/10\n🎭 <b>Genres:</b> ${genres}\n\n📝 <b>Overview:</b> <i>${movie.overview}</i>\n\n⚠️ <b>NOTE:</b> <i>To watch without annoying ads, please open the server links using <b>Brave Browser</b>.</i> 🦁`;

                await bot.deleteMessage(chatId, msgId);
                if (movie.poster_path) {
                    await bot.sendPhoto(chatId, `https://image.tmdb.org/t/p/w500${movie.poster_path}`, { caption: replyMessage, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                } else { await bot.sendMessage(chatId, replyMessage, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } }); }
            }

            else if (data.startsWith('tv_det:')) {
                const tvId = data.split(':')[1];
                const detailUrl = `https://api.themoviedb.org/3/tv/${tvId}?api_key=${TMDB_API_KEY}&language=en-US`;
                const resApi = await axios.get(detailUrl);
                const tv = resApi.data;
                
                const year = tv.first_air_date ? tv.first_air_date.split('-')[0] : 'N/A';
                const genres = tv.genres ? tv.genres.map(g => g.name).join(', ') : 'N/A';
                const subUrl = `https://www.google.com/search?q=${encodeURIComponent(tv.name + ' tv series sinhala subtitles')}`;

                let inlineKeyboard = [
                    [{ text: "🚀 Server 1 (VidSrc PRO)", url: `https://vidsrc.pro/embed/tv/${tv.id}` }],
                    [{ text: "⚡ Server 2 (AutoEmbed)", url: `https://autoembed.co/tv/tmdb/${tv.id}-1-1` }],
                    [{ text: "🔥 Server 3 (VidLink)", url: `https://vidlink.pro/tv/${tv.id}/1/1` }],
                    [{ text: "📝 Download Sinhala Subs", url: subUrl }]
                ];

                const replyMessage = `📺 <b>${tv.name}</b> (${year})\n\n⭐ <b>Rating:</b> ${tv.vote_average.toFixed(1)}/10\n🎭 <b>Genres:</b> ${genres}\n\n📝 <b>Overview:</b> <i>${tv.overview}</i>\n\n⚠️ <b>NOTE:</b> <i>To watch without annoying ads, please open the server links using <b>Brave Browser</b>.</i> 🦁`;
                
                await bot.deleteMessage(chatId, msgId);
                if (tv.poster_path) {
                    await bot.sendPhoto(chatId, `https://image.tmdb.org/t/p/w500${tv.poster_path}`, { caption: replyMessage, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                } else { await bot.sendMessage(chatId, replyMessage, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } }); }
            }
        }
    } catch (e) { 
        console.error("Webhook Error:", e); 
    } finally { 
        res.sendStatus(200); 
    }
});

module.exports = app;
