const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// 💾 MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://Chanakasampath:YOyJJzz87v7FPWPx@cluster0.jizuo.mongodb.net/?appName=Cluster0";

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected Successfully!'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// 📝 MongoDB Schemas
const userSchema = new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    username: String,
    isPremium: { type: Boolean, default: false }, // 👑 VIP SYSTEM
    joinedAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const searchSchema = new mongoose.Schema({
    query: { type: String, unique: true },
    count: { type: Number, default: 1 } // 🔍 SEARCH HISTORY
});
const Search = mongoose.model('Search', searchSchema);

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

const watchlists = new Map();
const warningsMap = new Map();
const postedMoviesCache = new Set();
const allowedAdmins = [6629519111, 6467952735];

// 📊 Update Search Trends Function
async function trackSearch(query) {
    if (!query) return;
    try {
        const term = query.toLowerCase().trim();
        await Search.findOneAndUpdate(
            { query: term },
            { $inc: { count: 1 } },
            { upsert: true, new: true }
        );
    } catch(e) { console.error("Search Track Error:", e); }
}

// 🛑 STRICT API BAD WORD FILTER
async function isBadWord(text) {
    if (!OPENROUTER_API_KEY || !text) return false;
    try {
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "meta-llama/llama-3-8b-instruct:free",
            messages: [{ role: "system", content: "You are a strict profanity filter. Does this text contain ANY offensive words, bad words, or profanity in English, Sinhala, or Singlish? Reply ONLY with 'YES' or 'NO'." }, { role: "user", content: text }]
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

// 📄 SEARCH FUNCTIONS
async function sendSearchResults(chatId, query, type, page = 1, msgId = null) {
    try {
        const isTv = type === 'tv';
        const url = `https://api.themoviedb.org/3/search/${isTv ? 'tv' : 'movie'}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}`;
        const res = await axios.get(url);
        const totalPages = res.data.total_pages;
        const results = res.data.results ? res.data.results.slice(0, 5) : [];

        if (results.length > 0) {
            let keyboard = [];
            results.forEach(item => {
                const title = isTv ? item.name : item.title;
                const date = isTv ? item.first_air_date : item.release_date;
                const year = date ? date.split('-')[0] : 'N/A';
                const cbData = isTv ? `tv_det:${item.id}` : `mov_det:${item.id}`;
                keyboard.push([{ text: `🎬 ${title} (${year})`, callback_data: cbData }]);
            });
            
            let pgRow = [];
            const safeQuery = query.substring(0, 30);
            const pfix = isTv ? 'tv_p' : 'mov_p';
            if (page > 1) pgRow.push({ text: "⬅️ Prev", callback_data: `${pfix}:${page - 1}:${safeQuery}` });
            if (page < totalPages) pgRow.push({ text: "Next ➡️", callback_data: `${pfix}:${page + 1}:${safeQuery}` });
            if (pgRow.length > 0) keyboard.push(pgRow);

            const text = `🍿 <b>CHUCKY MOVIE ZONE</b>\n\n<i>"${query}" සඳහා ප්‍රතිඵල (Page ${page}/${totalPages}):</i>`;
            if (msgId) await bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } }).catch(()=>{});
            else await bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
        } else {
            const err = `❌ ${isTv ? 'TV Series' : 'Movie'} not found!`;
            if (msgId) await bot.editMessageText(err, { chat_id: chatId, message_id: msgId }).catch(()=>{});
            else await bot.sendMessage(chatId, err);
        }
    } catch (err) { await bot.sendMessage(chatId, "⚠️ සර්වර් දෝෂයක්. කරුණාකර නැවත උත්සහ කරන්න."); }
}

// 🎯 MAIN MESSAGE HANDLER
bot.on('message', async (msg) => {
    if (!msg.text) return;
    const chatId = msg.chat.id;
    const text = msg.text;
    const userId = msg.from.id;
    const isGroup = msg.chat.type === 'supergroup' || msg.chat.type === 'group';
    const isPrivate = msg.chat.type === 'private';

    // 💾 MONGODB: SAVE USER
    if (isPrivate) {
        try {
            const existingUser = await User.findOne({ userId: userId });
            if (!existingUser) {
                await User.create({ userId: userId, firstName: msg.from.first_name || 'Unknown', username: msg.from.username || '' });
            }
        } catch (dbErr) {}
    }

    // 🛑 BAD WORD LOGIC
    if (isGroup && !text.startsWith('/')) {
        if (await isBadWord(text)) {
            if (!allowedAdmins.includes(userId)) {
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
                } catch (e) {}
            }
            return;
        }
    }

    let args = text.split(' ');
    let cmd = args[0].toLowerCase();
    if (cmd.includes('@')) cmd = cmd.split('@')[0]; 
    const query = args.slice(1).join(' ').trim();

    try {
        if (cmd === '/start' || cmd === '/help') {
            const welcomeText = `🎬 <b>Welcome to CHUCKY MOVIE ZONE!</b> 🍿\n\n` +
                                `ලෝකේ තියෙන ඕනෑම Movie, TV Series එකක් ලේසියෙන්ම සොයාගන්න!\n\n` +
                                `📌 <b>Main Commands:</b>\n` +
                                `🎬 /movie [name] - චිත්‍රපට සෙවීමට\n` +
                                `📺 /tv [name] - ටෙලි කතාමාලා සෙවීමට\n` +
                                `🔥 /top - වැඩිපුරම සෙවූ චිත්‍රපට\n` +
                                `📋 /watchlist - Watchlist එක\n` +
                                `🎲 /random - අහඹු ෆිල්ම් එකක්\n` +
                                `📩 /request [name] - ඇඩ්මින්ගෙන් ඉල්ලන්න\n\n` +
                                `⚠️ <i>Ads නැතුව බලන්න ලින්ක්ස් ඕපන් කරද්දී "Brave Browser" පාවිච්චි කරන්න!</i>`;
            await bot.sendMessage(chatId, welcomeText, { parse_mode: 'HTML' }).catch(()=>{});
        }
        else if (cmd === '/movie') { 
            if (!query) return bot.sendMessage(chatId, "⚠️ කරුණාකර චිත්‍රපටයේ නම ඇතුලත් කරන්න.");
            await trackSearch(query); // Track history
            await sendSearchResults(chatId, query, 'movie', 1); 
        }
        else if (cmd === '/tv') { 
            if (!query) return bot.sendMessage(chatId, "⚠️ කරුණාකර TV Series එකේ නම ඇතුලත් කරන්න.");
            await trackSearch(query); // Track history
            await sendSearchResults(chatId, query, 'tv', 1); 
        }
        // 🔥 TOP SEARCHES
        else if (cmd === '/top') {
            const topSearches = await Search.find().sort({ count: -1 }).limit(10);
            if(topSearches.length === 0) return bot.sendMessage(chatId, "📭 තවමත් කිසිවක් සොයා නැත.");
            let msgText = "🔥 <b>වැඩිපුරම සෙවූ චිත්‍රපට 10:</b>\n\n";
            topSearches.forEach((s, i) => msgText += `<b>${i+1}.</b> ${s.query} <i>(${s.count} times)</i>\n`);
            await bot.sendMessage(chatId, msgText, { parse_mode: 'HTML' });
        }
        // 📊 BOT STATS (ADMIN ONLY)
        else if (cmd === '/stats' && allowedAdmins.includes(userId)) {
            const totalUsers = await User.countDocuments();
            const premiumUsers = await User.countDocuments({ isPremium: true });
            const totalSearches = await Search.countDocuments();
            const text = `📊 <b>Bot Statistics</b>\n\n👥 මුළු පරිශීලකයින්: ${totalUsers}\n👑 VIP මෙම්බර්ලා: ${premiumUsers}\n🔍 මුළු සෙවුම් ගණන: ${totalSearches}`;
            await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
        }
        // 👑 VIP MANAGEMENT (ADMIN ONLY)
        else if (cmd === '/addvip' && allowedAdmins.includes(userId)) {
            if(!query || isNaN(query)) return bot.sendMessage(chatId, "⚠️ කරුණාකර User ID එකක් ලබා දෙන්න. (උදා: /addvip 123456)");
            await User.findOneAndUpdate({ userId: parseInt(query) }, { isPremium: true });
            await bot.sendMessage(chatId, `✅ User ${query} ව VIP මෙම්බර් කෙනෙක් කළා!`);
            await bot.sendMessage(query, `🎉 <b>සුබපැතුම්!</b> ඔබව VIP මෙම්බර් කෙනෙක් ලෙස Active කර ඇත! දැන් ඔබට VIP ලින්ක්ස් භාවිතා කළ හැක.`, { parse_mode: 'HTML' }).catch(()=>{});
        }
        else if (cmd === '/rmvip' && allowedAdmins.includes(userId)) {
            if(!query || isNaN(query)) return bot.sendMessage(chatId, "⚠️ කරුණාකර User ID එකක් ලබා දෙන්න.");
            await User.findOneAndUpdate({ userId: parseInt(query) }, { isPremium: false });
            await bot.sendMessage(chatId, `❌ User ${query} ගේ VIP ඉවත් කළා!`);
        }
        // 📢 BROADCAST COMMAND
        else if (cmd === '/broadcast' && allowedAdmins.includes(userId)) {
            if (!query) return bot.sendMessage(chatId, "⚠️ කරුණාකර මැසේජ් එක ඇතුලත් කරන්න.");
            await bot.sendMessage(chatId, "⏳ Broadcast එක යැවීම ආරම්භ කරනවා...");
            const users = await User.find({});
            let sCount = 0, fCount = 0;
            for (let user of users) {
                try {
                    await bot.sendMessage(user.userId, `📢 <b>ඇඩ්මින්ගෙන් පණිවිඩයක්:</b>\n\n${query}`, { parse_mode: 'HTML' });
                    sCount++; await new Promise(r => setTimeout(r, 200)); 
                } catch (e) { fCount++; }
            }
            await bot.sendMessage(chatId, `✅ <b>Broadcast සම්පූර්ණයි!</b>\n✅ යැවූ: ${sCount} | ❌ අසාර්ථක: ${fCount}`, { parse_mode: 'HTML' });
        }
        // 🗑️ CLEAR DB
        else if (cmd === '/cleardb' && userId === 6629519111) {
            await bot.sendMessage(chatId, "⏳ Database එක Clear කිරීම ආරම්භ කළා...");
            const result = await User.deleteMany({});
            await Search.deleteMany({});
            await bot.sendMessage(chatId, `🗑️ <b>Database Fully Cleared!</b>\n✅ මැකූ Users: ${result.deletedCount}`, { parse_mode: 'HTML' });
        }
    } catch (error) {}
});

// 🔘 CALLBACK QUERIES
bot.on('callback_query', async (cb) => {
    const data = cb.data;
    const chatId = cb.message.chat.id;
    const msgId = cb.message.message_id;
    const userId = cb.from.id;

    try { await bot.answerCallbackQuery(cb.id); } catch(e){}

    if (data === 'vip_locked') {
        // 🔒 VIP Alert Message
        await bot.answerCallbackQuery(cb.id, { text: "👑 මේක VIP මෙම්බර්ලට විතරයි! VIP ලබාගන්න ඇඩ්මින්ව සම්බන්ද කරගන්න.", show_alert: true });
    }
    else if (data.startsWith('mov_p:')) {
        const parts = data.split(':');
        await sendSearchResults(chatId, parts.slice(2).join(':'), 'movie', parseInt(parts[1]), msgId);
    }
    else if (data.startsWith('tv_p:')) {
        const parts = data.split(':');
        await sendSearchResults(chatId, parts.slice(2).join(':'), 'tv', parseInt(parts[1]), msgId);
    }
    else if (data.startsWith('mov_det:') || data.startsWith('tv_det:')) {
        const isTv = data.startsWith('tv_det:');
        const tmdbId = data.split(':')[1];
        const typeUrl = isTv ? 'tv' : 'movie';
        
        try {
            // 👑 Check if user is VIP
            let isVip = false;
            const dbUser = await User.findOne({ userId: userId });
            if (dbUser && dbUser.isPremium) isVip = true;

            const res = await axios.get(`https://api.themoviedb.org/3/${typeUrl}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=videos`);
            const m = res.data;
            const embedId = m.imdb_id || m.id;
            const title = isTv ? m.name : m.title;
            const date = isTv ? m.first_air_date : m.release_date;
            const subUrl = await getSinhalaSubLink(title);

            let kb = [
                [{ text: "🚀 Server 1 (Free)", url: `https://vidsrc.pro/embed/${typeUrl}/${embedId}` }],
                [{ text: "⚡ Server 2 (Free)", url: `https://autoembed.co/${typeUrl}/imdb/${embedId}` }]
            ];

            // 👑 VIP Link Logic
            if (isVip) {
                kb.push([{ text: "👑 VIP Server (No Ads / 4K)", url: `https://vidsrc.net/embed/${typeUrl}/${embedId}` }]);
            } else {
                kb.push([{ text: "🔒 VIP Server (Locked)", callback_data: `vip_locked` }]);
            }

            kb.push([{ text: "📝 Sinhala Subs", url: subUrl }]);

            const cap = `🎬 <b>${title}</b> (${date?.split('-')[0]||'N/A'})\n⭐ <b>Rating:</b> ${m.vote_average}/10\n\n📝 <b>Overview:</b> <i>${m.overview}</i>`;
            
            try { await bot.deleteMessage(chatId, msgId); } catch(e){}
            if (m.poster_path) await bot.sendPhoto(chatId, `https://image.tmdb.org/t/p/w500${m.poster_path}`, { caption: cap, parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } }).catch(()=>{});
            else await bot.sendMessage(chatId, cap, { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } }).catch(()=>{});
        } catch(e) {}
    }
});

app.get('/', (req, res) => res.send('Bot is running on Railway!'));
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
