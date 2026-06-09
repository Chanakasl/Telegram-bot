const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

const app = express();
app.use(express.json()); 

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || ''; 
const TMDB_API_KEY = process.env.TMDB_API_KEY || ''; 
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

// Token එක නැත්නම් Crash වෙන්නේ නැති වෙන්න Check කිරීම
if (!TELEGRAM_TOKEN || !TMDB_API_KEY) {
    console.error("⚠️ FATAL ERROR: TELEGRAM_TOKEN or TMDB_API_KEY is missing in Environment Variables!");
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

// ⚠️ Note: Vercel වල Serverless නිසා මේවා ටික වෙලාවකින් Reset වෙන්න පුළුවන්. 
const activeUsers = new Set();
const watchlists = new Map();

// 🔍 SINHALASUB API
async function getSinhalaSubLink(title) {
    try {
        const response = await axios.get(`https://sinhalasub.lk/wp-json/wp/v2/posts?search=${encodeURIComponent(title)}&per_page=1`, { timeout: 4000 });
        if (response.data && response.data.length > 0) return response.data[0].link; 
    } catch (err) { console.error("Sinhalasub API Error."); }
    return `https://sinhalasub.lk/?s=${encodeURIComponent(title)}`;
}

// 📄 MOVIE SEARCH
async function sendMovieSearchResults(chatId, query, page = 1, messageIdToEdit = null) {
    try {
        const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=${page}`;
        const resApi = await axios.get(searchUrl, { timeout: 5000 });
        const totalPages = resApi.data.total_pages;
        const results = resApi.data.results ? resApi.data.results.slice(0, 5) : [];

        if (results.length > 0) {
            let inlineKeyboard = [];
            results.forEach(movie => {
                const year = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
                inlineKeyboard.push([{ text: `🎬 ${movie.title} (${year})`, callback_data: `mov_det:${movie.id}` }]);
            });

            let paginationRow = [];
            const safeQuery = query.substring(0, 30); 
            if (page > 1) paginationRow.push({ text: "⬅️ Prev", callback_data: `mov_p:${page - 1}:${safeQuery}` });
            if (page < totalPages) paginationRow.push({ text: "Next ➡️", callback_data: `mov_p:${page + 1}:${safeQuery}` });
            if (paginationRow.length > 0) inlineKeyboard.push(paginationRow);

            const replyText = `🍿 <b>CHUCKY MOVIE ZONE</b>\n\n<i>"${query}" සඳහා ප්‍රතිඵල (Page ${page}/${totalPages}):</i>`;
            
            if (messageIdToEdit) await bot.editMessageText(replyText, { chat_id: chatId, message_id: messageIdToEdit, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } }).catch(()=>{});
            else await bot.sendMessage(chatId, replyText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } }).catch(()=>{});
        } else {
            const errorMsg = '❌ Movie not found!';
            if (messageIdToEdit) await bot.editMessageText(errorMsg, { chat_id: chatId, message_id: messageIdToEdit }).catch(()=>{});
            else await bot.sendMessage(chatId, errorMsg).catch(()=>{});
        }
    } catch (err) { 
        console.error("Search Error:", err.message); 
        await bot.sendMessage(chatId, "⚠️ සර්වර් එකේ දෝෂයක්. කරුණාකර නැවත උත්සහ කරන්න.").catch(()=>{});
    }
}

// 📄 TV SERIES SEARCH
async function sendTvSearchResults(chatId, query, page = 1, messageIdToEdit = null) {
    try {
        const searchUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=${page}`;
        const resApi = await axios.get(searchUrl, { timeout: 5000 });
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
            
            if (messageIdToEdit) await bot.editMessageText(replyText, { chat_id: chatId, message_id: messageIdToEdit, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } }).catch(()=>{});
            else await bot.sendMessage(chatId, replyText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } }).catch(()=>{});
        } else {
            const errorMsg = '❌ TV Series not found!';
            if (messageIdToEdit) await bot.editMessageText(errorMsg, { chat_id: chatId, message_id: messageIdToEdit }).catch(()=>{});
            else await bot.sendMessage(chatId, errorMsg).catch(()=>{});
        }
    } catch (err) { 
        console.error("TV Search Error:", err.message); 
        await bot.sendMessage(chatId, "⚠️ සර්වර් එකේ දෝෂයක්. කරුණාකර නැවත උත්සහ කරන්න.").catch(()=>{});
    }
}

// ---- 🌐 HOME PAGE ----
app.get('/', (req, res) => {
    res.send(`<h1 style="color:red; text-align:center; font-family:monospace; margin-top:20%;">CHUCKY MOVIE ZONE PRO - ONLINE 🚀</h1><p style="text-align:center;"><a href="/setup">Set Webhook</a></p>`);
});

// ---- 🛠️ WEBHOOK SETUP ----
app.get('/setup', async (req, res) => {
    try {
        const host = req.headers.host; 
        if (host) {
            const webhookUrl = `https://${host}/bot${TELEGRAM_TOKEN}`;
            await bot.setWebHook(webhookUrl);
            return res.send(`<h1 style="color:green;text-align:center;margin-top:20%;">✅ Webhook Setup Successful!</h1><p style="text-align:center;">URL: ${webhookUrl}</p>`);
        }
        res.status(400).send('Error: Host not found!');
    } catch (error) { res.status(500).send(`Webhook Setup Failed: ${error.message}`); }
});

// ---- 🤖 BOT LOGIC ----
app.post(`/bot${TELEGRAM_TOKEN}`, async (req, res) => {
    try {
        const body = req.body;

        if (body.message && body.message.text) {
            const msg = body.message;
            const chatId = msg.chat.id;
            const text = msg.text;

            if (text.startsWith('/start') || text.startsWith('/help')) {
                const welcomeText = `🎬 <b>Welcome to CHUCKY MOVIE ZONE!</b> 🍿\n\n` +
                                    `ලෝකේ තියෙන ඕනෑම Movie, TV Series එකක් ලේසියෙන්ම සොයාගන්න!\n\n` +
                                    `<b>📌 Main Commands:</b>\n` +
                                    `🎥 <code>/movie [name]</code> - චිත්‍රපට සෙවීමට\n` +
                                    `📺 <code>/tv [name]</code> - ටෙලි කතාමාලා සෙවීමට\n` +
                                    `➕ <code>/addgroup</code> - Bot ව Group එකකට Add කරන්න\n\n` +
                                    `⚠️ <i>Ads නැතුව බලන්න ලින්ක්ස් ඕපන් කරද්දී "Brave Browser" එක පාවිච්චි කරන්න! 🦁</i>`;
                await bot.sendMessage(chatId, welcomeText, { parse_mode: 'HTML' });
            }

            else if (text.startsWith('/movie ')) {
                const movieName = text.replace('/movie ', '').trim();
                await sendMovieSearchResults(chatId, movieName, 1);
            }

            else if (text.startsWith('/tv ')) {
                const tvName = text.replace('/tv ', '').trim();
                await sendTvSearchResults(chatId, tvName, 1);
            }

            else if (text === '/addgroup') {
                let inlineKeyboard = [
                    [{ text: "➕ Add to Group", url: `https://t.me/Chucky_movie_zone_bot?startgroup=true` }]
                ];
                const addGroupText = `🤖 <b>Chucky Movie Zone Bot ඔබගේ Group එකට Add කරගන්න!</b>\n\n` +
                                     `පහත Button එක Click කරලා Bot ව ඔයාගේ Group එකට ඇඩ් කරගන්න. 🚀`;
                await bot.sendMessage(chatId, addGroupText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
            }
        }

        // CALLBACK QUERIES
        else if (body.callback_query) {
            const cb = body.callback_query;
            const chatId = cb.message.chat.id;
            const msgId = cb.message.message_id;
            const data = cb.data;

            try { await bot.answerCallbackQuery(cb.id); } catch(e){}

            if (data.startsWith('mov_p:')) {
                const parts = data.split(':');
                const pageNum = parseInt(parts[1]);
                const queryStr = parts.slice(2).join(':').trim(); 
                await sendMovieSearchResults(chatId, queryStr, pageNum, msgId);
            }
            else if (data.startsWith('tv_p:')) {
                const parts = data.split(':');
                const pageNum = parseInt(parts[1]);
                const queryStr = parts.slice(2).join(':').trim();
                await sendTvSearchResults(chatId, queryStr, pageNum, msgId);
            }
            else if (data.startsWith('mov_det:')) {
                const tmdbId = data.split(':')[1];
                const detailUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=videos`;
                const resApi = await axios.get(detailUrl, { timeout: 6000 });
                const movie = resApi.data;

                const releaseYear = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
                const genres = movie.genres ? movie.genres.map(g => g.name).join(', ') : 'N/A';
                const embedId = movie.imdb_id || movie.id;
                const subUrl = await getSinhalaSubLink(movie.title);
                
                let inlineKeyboard = [
                    [{ text: "🚀 Server 1 (VidSrc PRO)", url: `https://vidsrc.pro/embed/movie/${embedId}` }],
                    [{ text: "⚡ Server 2 (AutoEmbed)", url: `https://autoembed.co/movie/imdb/${embedId}` }],
                    [{ text: "📝 Sinhala Subs", url: subUrl }]
                ];

                const replyMessage = `🎬 <b>${movie.title}</b> (${releaseYear})\n\n⭐ <b>Rating:</b> ${movie.vote_average?.toFixed(1) || 'N/A'}/10\n🎭 <b>Genres:</b> ${genres}\n\n📝 <b>Overview:</b> <i>${movie.overview || 'N/A'}</i>`;

                try { await bot.deleteMessage(chatId, msgId); } catch(e){}
                if (movie.poster_path) {
                    await bot.sendPhoto(chatId, `https://image.tmdb.org/t/p/w500${movie.poster_path}`, { caption: replyMessage, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } }).catch(()=>{});
                } else { 
                    await bot.sendMessage(chatId, replyMessage, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } }).catch(()=>{}); 
                }
            }
        }
    } catch (e) { 
        console.error("Webhook Internal Error:", e.message); 
    } finally { 
        res.sendStatus(200); 
    }
});

module.exports = app;
