const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Railway එකේ දුවන්න Polling True කරනවා
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

const watchlists = new Map();
const warningsMap = new Map();
const postedMoviesCache = new Set();
const allowedAdmins = [6629519111, 6467952735];

// 🛑 100% API BASED BAD WORD FILTER
async function isBadWord(text) {
    if (!OPENROUTER_API_KEY || !text) return false;
    try {
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "meta-llama/llama-3-8b-instruct:free",
            messages: [
                { role: "system", content: "You are a toxic language detector. Does the following text contain bad words, profanity, insults, or toxic language in Sinhala, Singlish, or English? Reply ONLY with 'YES' or 'NO'." },
                { role: "user", content: text }
            ]
        }, { headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" }, timeout: 5000 });
        return response.data.choices[0].message.content.trim().toUpperCase().includes("YES");
    } catch (err) { return false; }
}

// 🔍 SINHALASUB API
async function getSinhalaSubLink(title) {
    try {
        const res = await axios.get(`https://sinhalasub.lk/wp-json/wp/v2/posts?search=${encodeURIComponent(title)}&per_page=1`, { timeout: 4000 });
        if (res.data && res.data.length > 0) return res.data[0].link;
    } catch (err) {}
    return `https://sinhalasub.lk/?s=${encodeURIComponent(title)}`;
}

// 📄 MOVIE SEARCH
async function sendMovieSearchResults(chatId, query, page = 1, msgId = null) {
    try {
        const res = await axios.get(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}`);
        const totalPages = res.data.total_pages;
        const results = res.data.results ? res.data.results.slice(0, 5) : [];

        if (results.length > 0) {
            let keyboard = [];
            results.forEach(m => keyboard.push([{ text: `🎬 ${m.title} (${m.release_date ? m.release_date.split('-')[0] : 'N/A'})`, callback_data: `mov_det:${m.id}` }]));
            
            let pgRow = [];
            if (page > 1) pgRow.push({ text: "⬅️ Prev", callback_data: `mov_p:${page - 1}:${query.substring(0,30)}` });
            if (page < totalPages) pgRow.push({ text: "Next ➡️", callback_data: `mov_p:${page + 1}:${query.substring(0,30)}` });
            if (pgRow.length > 0) keyboard.push(pgRow);

            const text = `🍿 <b>CHUCKY MOVIE ZONE</b>\n\n<i>"${query}" සඳහා ප්‍රතිඵල (Page ${page}/${totalPages}):</i>`;
            if (msgId) await bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } }).catch(()=>{});
            else await bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
        } else {
            if (msgId) await bot.editMessageText('❌ Movie not found!', { chat_id: chatId, message_id: msgId }).catch(()=>{});
            else await bot.sendMessage(chatId, '❌ Movie not found!');
        }
    } catch (err) { await bot.sendMessage(chatId, "⚠️ සර්වර් දෝෂයක්!"); }
}

// 🎯 MAIN MESSAGE HANDLER
bot.on('message', async (msg) => {
    if (!msg.text) return;
    const chatId = msg.chat.id;
    const text = msg.text;
    const userId = msg.from.id;
    const isGroup = msg.chat.type === 'supergroup' || msg.chat.type === 'group';

    // 🛑 BAD WORD LOGIC
    if (isGroup && !text.startsWith('/')) {
        if (await isBadWord(text)) {
            if (allowedAdmins.includes(userId)) {
                await bot.sendMessage(chatId, `⚠️ ${msg.from.first_name}, ඔබ Admin කෙනෙක් නිසා Telegram නීති අනුව මැසේජ් මකන්න බෑ. හැබැයි මේක කුණුහරුපයක්!`).catch(()=>{});
                return;
            }
            try {
                await bot.deleteMessage(chatId, msg.message_id);
                let warnings = (warningsMap.get(userId) || 0) + 1;
                warningsMap.set(userId, warnings);
                
                if (warnings >= 2) {
                    await bot.restrictChatMember(chatId, userId, { can_send_messages: false }, { until_date: Math.floor(Date.now() / 1000) + 86400 });
                    await bot.sendMessage(chatId, `🚫 ${msg.from.first_name} අසභ්‍ය වචන භාවිතය නිසා පැය 24කට Mute කරන ලදී.`);
                } else {
                    await bot.sendMessage(chatId, `⚠️ ${msg.from.first_name}, කරුණාකර අසභ්‍ය වචන භාවිතයෙන් වළකින්න!`);
                }
            } catch (e) { console.log("Mute error", e); }
            return;
        }
    }

    // COMMANDS
    if (text.startsWith('/start')) {
        await bot.sendMessage(chatId, "🎬 <b>Welcome to CHUCKY MOVIE ZONE!</b> 🍿\n\n/movie [name] - ෆිල්ම් හොයන්න\n/tv [name] - ටීවී සීරීස්\n/random - අහඹු\n/trending - ජනප්‍රියම\n/imdb250 - Top Rated\n/watchlist - ඔයාගේ ලිස්ට් එක", { parse_mode: 'HTML' });
    }
    else if (text.startsWith('/movie ')) { await sendMovieSearchResults(chatId, text.replace('/movie ', '').trim(), 1); }
    else if (text === '/random') {
        const res = await axios.get(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&page=${Math.floor(Math.random() * 50) + 1}`);
        const m = res.data.results[Math.floor(Math.random() * res.data.results.length)];
        await bot.sendMessage(chatId, `🎲 <b>අහඹු චිත්‍රපටයක්:</b>\n👉 <i>${m.title}</i>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: `🎬 විස්තර බලන්න`, callback_data: `mov_det:${m.id}` }]] } });
    }
    else if (text === '/trending') {
        const res = await axios.get(`https://api.themoviedb.org/3/trending/movie/day?api_key=${TMDB_API_KEY}`);
        let keyboard = res.data.results.slice(0, 10).map(m => [{ text: `🔥 ${m.title}`, callback_data: `mov_det:${m.id}` }]);
        await bot.sendMessage(chatId, "🔥 <b>අද ජනප්‍රියම:</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
    }
    else if (text === '/imdb250') {
        const res = await axios.get(`https://api.themoviedb.org/3/movie/top_rated?api_key=${TMDB_API_KEY}`);
        let keyboard = res.data.results.slice(0, 10).map(m => [{ text: `🏆 ${m.title} (${m.vote_average})`, callback_data: `mov_det:${m.id}` }]);
        await bot.sendMessage(chatId, "🏆 <b>Top Rated:</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
    }
    else if (text === '/watchlist') {
        const list = watchlists.get(userId) || [];
        if (list.length === 0) return bot.sendMessage(chatId, "📭 Your watchlist is empty.");
        let kb = list.map(i => [{ text: `🎬 ${i.title}`, callback_data: `mov_det:${i.id}` }]);
        await bot.sendMessage(chatId, "📋 <b>Your Watchlist:</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
    }
    // 🚀 SECRET TESTPOST
    else if (text === '/testpost' && allowedAdmins.includes(userId)) {
        if (!CHANNEL_ID) return bot.sendMessage(chatId, "⚠️ CHANNEL_ID නෑ!");
        await bot.sendMessage(chatId, "⏳ Auto Post Test ආරම්භ කරනවා...");
        try {
            let count = 0;
            for (let i = 0; i < 10; i++) {
                const res = await axios.get(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&page=${Math.floor(Math.random()*10)+1}`);
                const m = res.data.results[Math.floor(Math.random() * res.data.results.length)];
                if (!postedMoviesCache.has(m.id)) {
                    postedMoviesCache.add(m.id);
                    const year = m.release_date ? m.release_date.split('-')[0] : 'N/A';
                    const cap = `🎬 <b>${m.title} (${year})</b>\n\n👇 <b>Full Movie එක බලන්න අපේ Group එකට Join වෙන්න!</b>\n🔗 https://t.me/+W8xGn6KzYg81ZWU1`;
                    if (m.poster_path) await bot.sendPhoto(CHANNEL_ID, `https://image.tmdb.org/t/p/w500${m.poster_path}`, { caption: cap, parse_mode: 'HTML' }).catch(()=>{});
                    count++;
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
            await bot.sendMessage(chatId, `✅ පෝස්ට් ${count}ක් දැම්මා!`);
        } catch (e) { await bot.sendMessage(chatId, "❌ Error: " + e.message); }
    }
});

// 🔘 CALLBACK QUERIES (BUTTON CLICKS)
bot.on('callback_query', async (cb) => {
    const data = cb.data;
    const chatId = cb.message.chat.id;
    const msgId = cb.message.message_id;
    const userId = cb.from.id;

    try { await bot.answerCallbackQuery(cb.id); } catch(e){}

    if (data.startsWith('mov_p:')) {
        const parts = data.split(':');
        await sendMovieSearchResults(chatId, parts.slice(2).join(':'), parseInt(parts[1]), msgId);
    }
    else if (data.startsWith('watchlist_add:')) {
        const parts = data.split(':');
        if (!watchlists.has(userId)) watchlists.set(userId, []);
        watchlists.get(userId).push({ id: parts[1], title: decodeURIComponent(parts[2]) });
        await bot.sendMessage(chatId, "✅ Watchlist එකට ඇතුලත් කළා!");
    }
    else if (data.startsWith('mov_det:')) {
        const tmdbId = data.split(':')[1];
        const res = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=videos`);
        const m = res.data;
        const embedId = m.imdb_id || m.id;
        const subUrl = await getSinhalaSubLink(m.title);
        const trailer = m.videos?.results?.find(v => v.type === 'Trailer') || m.videos?.results?.[0];
        const tUrl = trailer ? `https://youtube.com/watch?v=${trailer.key}` : `https://youtube.com/results?search_query=${encodeURIComponent(m.title + ' trailer')}`;

        let kb = [
            [{ text: "🚀 Server 1 (VidSrc)", url: `https://vidsrc.pro/embed/movie/${embedId}` }],
            [{ text: "⚡ Server 2 (AutoEmbed)", url: `https://autoembed.co/movie/imdb/${embedId}` }],
            [{ text: "🎬 Watch Trailer", url: tUrl }, { text: "📝 Sinhala Subs", url: subUrl }],
            [{ text: "➕ Add to Watchlist", callback_data: `watchlist_add:${tmdbId}:${encodeURIComponent(m.title)}` }]
        ];

        const cap = `🎬 <b>${m.title}</b> (${m.release_date?.split('-')[0]||'N/A'})\n⭐ <b>Rating:</b> ${m.vote_average}/10\n\n📝 <b>Overview:</b> <i>${m.overview}</i>`;
        
        try { await bot.deleteMessage(chatId, msgId); } catch(e){}
        if (m.poster_path) await bot.sendPhoto(chatId, `https://image.tmdb.org/t/p/w500${m.poster_path}`, { caption: cap, parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } }).catch(()=>{});
        else await bot.sendMessage(chatId, cap, { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } }).catch(()=>{});
    }
});

// Railway Health Check Server (අනිවාර්යයි)
app.get('/', (req, res) => res.send('Bot is running on Railway!'));
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
