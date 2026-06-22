const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');
const mongoose = require('mongoose');
const cheerio = require('cheerio');
const { default: makeWASocket, initAuthCreds, BufferJSON, DisconnectReason, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// 🔑 Environment Variables
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://Chanakasampath:YOyJJzz87v7FPWPx@cluster0.jizuo.mongodb.net/?appName=Cluster0";

// 💾 MongoDB Connection (with options for compatibility)
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log('✅ MongoDB Connected Successfully!'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// 📝 MongoDB Schemas
const userSchema = new mongoose.Schema({
    userId: { type: Number, unique: true },
    firstName: String,
    username: String,
    isPremium: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

const searchSchema = new mongoose.Schema({
    query: { type: String, unique: true },
    count: { type: Number, default: 1 }
});
const Search = mongoose.model('Search', searchSchema);

const sessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    sessionData: { type: String, required: true }
});
const SessionDB = mongoose.model('SessionDB', sessionSchema);

// 🤖 Bot Initialization (Polling disabled for Webhook mode)
const bot = new TelegramBot(TELEGRAM_TOKEN);

// Webhook Receiver Endpoint (with error handling)
app.post(`/bot${TELEGRAM_TOKEN}`, (req, res) => {
    try {
        bot.processUpdate(req.body);
        res.sendStatus(200);
    } catch (err) {
        console.error('Webhook processing error:', err);
        res.sendStatus(500);
    }
});

const watchlists = new Map();
const warningsMap = new Map();
const postedMoviesCache = new Set();
const allowedAdmins = [6629519111, 6467952735];
const activeSockets = new Map();

// -----------------------------------------------------------
// 🟢 WHATSAPP FUNCTIONS (Fully Error-Handled)
// -----------------------------------------------------------
async function useMongoDBAuthState(sessionId) {
    let creds;
    let keys = {};
    const existingSession = await SessionDB.findOne({ sessionId });
    if (existingSession) {
        const parsedData = JSON.parse(existingSession.sessionData, BufferJSON.reviver);
        creds = parsedData.creds;
        keys = parsedData.keys || {};
    } else {
        creds = initAuthCreds();
    }
    const saveState = async () => {
        const sessionData = JSON.stringify({ creds, keys }, BufferJSON.replacer);
        await SessionDB.findOneAndUpdate({ sessionId }, { sessionData }, { upsert: true, new: true });
    };
    return {
        state: {
            creds,
            keys: {
                get: (type, ids) => {
                    const dict = {};
                    ids.forEach(id => {
                        // Avoid optional chaining for older Node compatibility
                        if (keys[type] && keys[type][id]) {
                            dict[id] = keys[type][id];
                        }
                    });
                    return dict;
                },
                set: (data) => {
                    for (const category in data) {
                        keys[category] = keys[category] || {};
                        Object.assign(keys[category], data[category]);
                    }
                    saveState();
                }
            }
        },
        saveCreds: saveState
    };
}

async function connectToWhatsApp(userId, phoneNumber = null, reqChatId = null) {
    const sessionName = `session_${userId}`;
    try {
        const { state, saveCreds } = await useMongoDBAuthState(sessionName);
        const waSock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['Ubuntu', 'Chrome', '20.0.04']
        });
        waSock.ev.on('creds.update', saveCreds);
        activeSockets.set(userId, waSock);

        waSock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) connectToWhatsApp(userId);
                else activeSockets.delete(userId);
            } else if (connection === 'open') {
                if (reqChatId) bot.sendMessage(reqChatId, '✅ <b>WhatsApp සාර්ථකව Connect විය!</b>', { parse_mode: 'HTML' }).catch(() => {});
            }
        });

        waSock.ev.on('messages.upsert', async ({ messages }) => {
            const m = messages[0];
            if (!m.message || m.key.fromMe) return;
            const waChatId = m.key.remoteJid;
            const textMessage = m.message.conversation || m.message.extendedTextMessage?.text;
            if (textMessage === '!ping') {
                await waSock.sendMessage(waChatId, { text: '🏓 Pong! Chucky Bot WhatsApp හරහා ක්‍රියාත්මකයි!' });
            }
        });

        if (phoneNumber && !(waSock.authState && waSock.authState.creds && waSock.authState.creds.me)) {
            await delay(1500);
            try {
                const code = await waSock.requestPairingCode(phoneNumber);
                if (reqChatId) {
                    const text = `🔢 <b>ඔබගේ WhatsApp Pairing Code එක:</b>\n\n<code>${code}</code>\n\n<i>උඩ Code එක Click කරලා Copy කරගෙන, WhatsApp එකේ "Link with phone number instead" ගිහින් Paste කරන්න.</i>`;
                    bot.sendMessage(reqChatId, text, { parse_mode: 'HTML' });
                }
            } catch (err) {
                if (reqChatId) bot.sendMessage(reqChatId, '❌ දෝෂයක්! අංකය නිවැරදිදැයි පරීක්ෂා කරන්න (උදා: 94771234567).');
            }
        }
    } catch (err) {
        console.error('WhatsApp connection error:', err);
        if (reqChatId) bot.sendMessage(reqChatId, '⚠️ WhatsApp Connect කිරීමේදී දෝෂයක්!');
    }
}

// -----------------------------------------------------------
// 📊 BOT HELPERS & SCRAPERS
// -----------------------------------------------------------
async function trackSearch(query) {
    if (!query) return;
    try {
        const term = query.toLowerCase().trim();
        await Search.findOneAndUpdate({ query: term }, { $inc: { count: 1 } }, { upsert: true, new: true });
    } catch (e) {}
}

async function isBadWord(text) {
    if (!OPENROUTER_API_KEY || !text) return false;
    try {
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "meta-llama/llama-3-8b-instruct:free",
            messages: [
                { role: "system", content: "You are a strict profanity filter. Does this text contain ANY offensive words, bad words, or profanity in English, Sinhala, or Singlish? Reply ONLY with 'YES' or 'NO'." },
                { role: "user", content: text }
            ]
        }, {
            headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
            timeout: 5000
        });
        return response.data.choices[0].message.content.trim().toUpperCase().includes("YES");
    } catch (err) {
        return false;
    }
}

async function getSinhalaSubLink(title) {
    try {
        const searchUrl = `https://cinesubz.lk/?s=${encodeURIComponent(title)}`;  // Changed .co → .lk
        const { data } = await axios.get(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 5000
        });
        const $ = cheerio.load(data);
        let subLink = null;
        $('article').first().each((i, el) => {
            const link = $(el).find('a').attr('href');
            if (link) subLink = link;
        });
        return subLink ? subLink : searchUrl;
    } catch (err) {
        return `https://cinesubz.lk/?s=${encodeURIComponent(title)}`;
    }
}

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
            if (msgId) {
                await bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } }).catch(() => {});
            } else {
                await bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
            }
        } else {
            const err = `❌ ${isTv ? 'TV Series' : 'Movie'} not found!`;
            if (msgId) await bot.editMessageText(err, { chat_id: chatId, message_id: msgId }).catch(() => {});
            else await bot.sendMessage(chatId, err);
        }
    } catch (err) {
        await bot.sendMessage(chatId, "⚠️ සර්වර් දෝෂයක්. කරුණාකර නැවත උත්සහ කරන්න.");
    }
}

async function sendActorSearchResults(chatId, actorName) {
    try {
        const res = await axios.get(`https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(actorName)}`);
        if (!res.data.results || res.data.results.length === 0) return bot.sendMessage(chatId, '❌ Actor not found!');
        const actor = res.data.results[0];
        const credRes = await axios.get(`https://api.themoviedb.org/3/person/${actor.id}/combined_credits?api_key=${TMDB_API_KEY}`);
        let keyboard = [];
        (credRes.data.cast || []).slice(0, 10).forEach(item => {
            const title = item.title || item.name;
            const cb = item.media_type === 'movie' ? `mov_det:${item.id}` : `tv_det:${item.id}`;
            keyboard.push([{ text: `🎬 ${title}`, callback_data: cb }]);
        });
        await bot.sendMessage(chatId, `🎭 <b>${actor.name}</b> රඟපෑ නිර්මාණ:`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
    } catch (e) {
        await bot.sendMessage(chatId, "⚠️ සර්වර් දෝෂයක්!");
    }
}

async function sendYearSearchResults(chatId, year, page = 1, msgId = null) {
    try {
        const res = await axios.get(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&primary_release_year=${year}&page=${page}`);
        const results = res.data.results ? res.data.results.slice(0, 5) : [];
        if (results.length > 0) {
            let keyboard = results.map(m => [{ text: `🎬 ${m.title}`, callback_data: `mov_det:${m.id}` }]);
            let pgRow = [];
            if (page > 1) pgRow.push({ text: "⬅️ Prev", callback_data: `year_p:${page - 1}:${year}` });
            if (page < res.data.total_pages) pgRow.push({ text: "Next ➡️", callback_data: `year_p:${page + 1}:${year}` });
            if (pgRow.length > 0) keyboard.push(pgRow);
            const text = `🍿 <b>CHUCKY MOVIE ZONE</b>\n\n<i>📅 <b>${year}</b> වසරේ චිත්‍රපට (Page ${page}):</i>`;
            if (msgId) {
                await bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } }).catch(() => {});
            } else {
                await bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
            }
        } else {
            const err = '❌ No movies found!';
            if (msgId) await bot.editMessageText(err, { chat_id: chatId, message_id: msgId }).catch(() => {});
            else await bot.sendMessage(chatId, err);
        }
    } catch (e) {
        await bot.sendMessage(chatId, "⚠️ සර්වර් දෝෂයක්!");
    }
}

// -----------------------------------------------------------
// 🎯 MAIN MESSAGE HANDLER
// -----------------------------------------------------------
bot.on('message', async (msg) => {
    if (!msg.text) return;
    const chatId = msg.chat.id;
    const text = msg.text;
    const userId = msg.from.id;
    const isGroup = msg.chat.type === 'supergroup' || msg.chat.type === 'group';

    try {
        const existingUser = await User.findOne({ userId: userId });
        if (!existingUser) {
            await User.create({ userId: userId, firstName: msg.from.first_name || 'Unknown', username: msg.from.username || '' });
        }
    } catch (dbErr) {}

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
                `👤 /actor [name] - නළුවෙක් අනුව\n` +
                `📅 /year [year] - වර්ෂය අනුව\n` +
                `🎭 /genres - කාණ්ඩය අනුව\n` +
                `🔥 /top - වැඩිපුරම සෙවූ චිත්‍රපට\n` +
                `📋 /watchlist - Watchlist එක\n` +
                `🎲 /random - අහඹු ෆිල්ම් එකක්\n` +
                `🌟 /trending - අද ජනප්‍රියම\n` +
                `➕ /addgroup - Group එකට Add කරන්න\n` +
                `📩 /request [name] - ඇඩ්මින්ගෙන් ඉල්ලන්න\n\n` +
                `⚠️ <i>Ads නැතුව බලන්න ලින්ක්ස් ඕපන් කරද්දී "Brave Browser" පාවිච්චි කරන්න!</i>`;
            await bot.sendMessage(chatId, welcomeText, { parse_mode: 'HTML' }).catch(() => {});
        } else if (cmd === '/movie') {
            if (!query) return bot.sendMessage(chatId, "⚠️ කරුණාකර චිත්‍රපටයේ නම ඇතුලත් කරන්න.");
            await trackSearch(query);
            await sendSearchResults(chatId, query, 'movie', 1);
        } else if (cmd === '/tv') {
            if (!query) return bot.sendMessage(chatId, "⚠️ කරුණාකර TV Series එකේ නම ඇතුලත් කරන්න.");
            await trackSearch(query);
            await sendSearchResults(chatId, query, 'tv', 1);
        } else if (cmd === '/actor') {
            if (!query) return bot.sendMessage(chatId, "⚠️ කරුණාකර නළුවාගේ නම ඇතුලත් කරන්න.");
            await sendActorSearchResults(chatId, query);
        } else if (cmd === '/year') {
            if (/^\d{4}$/.test(query)) await sendYearSearchResults(chatId, query, 1);
            else await bot.sendMessage(chatId, "⚠️ නිවැරදි වර්ෂයක් ඇතුලත් කරන්න.");
        } else if (cmd === '/genres') {
            let kb = [
                [{ text: "💥 Action", callback_data: "gen_p:28:1:Action" }, { text: "😂 Comedy", callback_data: "gen_p:35:1:Comedy" }],
                [{ text: "👻 Horror", callback_data: "gen_p:27:1:Horror" }, { text: "🚀 Sci-Fi", callback_data: "gen_p:878:1:Sci-Fi" }],
                [{ text: "💖 Romance", callback_data: "gen_p:10749:1:Romance" }, { text: "🎬 Drama", callback_data: "gen_p:18:1:Drama" }]
            ];
            await bot.sendMessage(chatId, "🎭 <b>ඔබ කැමති කාණ්ඩය තෝරන්න:</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
        } else if (cmd === '/watchlist') {
            const list = watchlists.get(userId) || [];
            if (list.length === 0) return bot.sendMessage(chatId, "📭 ඔබගේ Watchlist එක හිස්!");
            let text = "📋 <b>ඔබගේ Watchlist එක:</b>\n\n";
            list.forEach((m, i) => { text += `<b>${i+1}.</b> ${m.title}\n`; });
            await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
        } else if (cmd === '/random') {
            const res = await axios.get(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&page=${Math.floor(Math.random() * 50) + 1}`);
            const m = res.data.results[Math.floor(Math.random() * res.data.results.length)];
            await bot.sendMessage(chatId, `🎲 <b>අහඹු චිත්‍රපටයක්:</b>\n👉 <i>${m.title}</i>`, {
                parse_mode: 'HTML',
                reply_markup: { inline_keyboard: [[{ text: `🎬 විස්තර බලන්න`, callback_data: `mov_det:${m.id}` }]] }
            });
        } else if (cmd === '/top') {
            const topSearches = await Search.find().sort({ count: -1 }).limit(10);
            if (topSearches.length === 0) return bot.sendMessage(chatId, "📭 තවමත් කිසිවක් සොයා නැත.");
            let msgText = "🔥 <b>වැඩිපුරම සෙවූ චිත්‍රපට 10:</b>\n\n";
            topSearches.forEach((s, i) => msgText += `<b>${i+1}.</b> ${s.query} <i>(${s.count} times)</i>\n`);
            await bot.sendMessage(chatId, msgText, { parse_mode: 'HTML' });
        } else if (cmd === '/trending') {
            const res = await axios.get(`https://api.themoviedb.org/3/trending/movie/day?api_key=${TMDB_API_KEY}`);
            let kb = res.data.results.slice(0, 10).map(m => [{ text: `🔥 ${m.title}`, callback_data: `mov_det:${m.id}` }]);
            await bot.sendMessage(chatId, "🔥 <b>අද ජනප්‍රියම චිත්‍රපට:</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
        } else if (cmd === '/request') {
            if (!query) return bot.sendMessage(chatId, "⚠️ කරුණාකර චිත්‍රපටයේ නම ඇතුලත් කරන්න.");
            if (ADMIN_CHAT_ID) {
                await bot.sendMessage(ADMIN_CHAT_ID, `📩 <b>New Request!</b>\n🎬 ${query}\n👤 By: @${msg.from.username || msg.from.first_name}`, { parse_mode: 'HTML' });
                await bot.sendMessage(chatId, `✅ Request එක ඇඩ්මින්ට යැව්වා!`);
            }
        } else if (cmd === '/stats' && allowedAdmins.includes(userId)) {
            const totalUsers = await User.countDocuments();
            const premiumUsers = await User.countDocuments({ isPremium: true });
            const totalSearches = await Search.countDocuments();
            const activeWA = activeSockets.size;
            const text = `📊 <b>Bot Statistics</b>\n\n👥 මුළු පරිශීලකයින්: ${totalUsers}\n👑 VIP මෙම්බර්ලා: ${premiumUsers}\n🔍 මුළු සෙවුම් ගණන: ${totalSearches}\n🟢 Active WA Connections: ${activeWA}`;
            await bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
        } else if (cmd === '/addvip' && allowedAdmins.includes(userId)) {
            if (!query || isNaN(query)) return bot.sendMessage(chatId, "⚠️ කරුණාකර User ID එකක් ලබා දෙන්න.");
            await User.findOneAndUpdate({ userId: parseInt(query) }, { isPremium: true });
            await bot.sendMessage(chatId, `✅ User ${query} ව VIP මෙම්බර් කෙනෙක් කළා!`);
        } else if (cmd === '/broadcast' && allowedAdmins.includes(userId)) {
            if (!query) return bot.sendMessage(chatId, "⚠️ කරුණාකර මැසේජ් එක ඇතුලත් කරන්න.");
            await bot.sendMessage(chatId, "⏳ Broadcast එක යැවීම ආරම්භ කරනවා...");
            const users = await User.find({});
            let sCount = 0, fCount = 0;
            for (let user of users) {
                try {
                    await bot.sendMessage(user.userId, `📢 <b>ඇඩ්මින්ගෙන් පණිවිඩයක්:</b>\n\n${query}`, { parse_mode: 'HTML' });
                    sCount++;
                    await new Promise(r => setTimeout(r, 200));
                } catch (e) { fCount++; }
            }
            await bot.sendMessage(chatId, `✅ <b>Broadcast සම්පූර්ණයි!</b>\n✅ යැවූ: ${sCount} | ❌ අසාර්ථක: ${fCount}`, { parse_mode: 'HTML' });
        } else if (cmd === '/cleardb' && userId === 6629519111) {
            await bot.sendMessage(chatId, "⏳ Database එක Clear කිරීම ආරම්භ කළා...");
            const result = await User.deleteMany({});
            await Search.deleteMany({});
            await SessionDB.deleteMany({});
            await bot.sendMessage(chatId, `🗑️ <b>Database Fully Cleared!</b>\n✅ මැකූ Users: ${result.deletedCount}`, { parse_mode: 'HTML' });
        } else if (cmd === '/walink') {
            let kb = [
                [{ text: "🔗 Get Pairing Code", callback_data: "wa_req_pair" }],
                [{ text: "🔄 Check Status", callback_data: "wa_status" }, { text: "🚪 Logout WA", callback_data: "wa_logout" }]
            ];
            await bot.sendMessage(chatId, "🟢 <b>WhatsApp Device Linking Manager</b>\n\nපහතින් අවශ්‍ය සැකසුම තෝරන්න:", { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
        } else if (cmd === '/pair') {
            if (!query) return bot.sendMessage(chatId, "⚠️ කරුණාකර අංකය ලබා දෙන්න.\nඋදා: <code>/pair 94771234567</code>", { parse_mode: 'HTML' });
            const phone = query.replace(/[^0-9]/g, '');
            await bot.sendMessage(chatId, "⏳ Pairing Code එක Generate කරමින් පවතී...");
            connectToWhatsApp(userId, phone, chatId);
        }
    } catch (error) {
        console.error('Message handler error:', error);
        await bot.sendMessage(chatId, "⚠️ යම් දෝෂයක් සිදුවිය. නැවත උත්සාහ කරන්න.");
    }
});

// -----------------------------------------------------------
// 🔘 CALLBACK QUERIES
// -----------------------------------------------------------
bot.on('callback_query', async (cb) => {
    const data = cb.data;
    const chatId = cb.message.chat.id;
    const msgId = cb.message.message_id;
    const userId = cb.from.id;

    try {
        const existingUser = await User.findOne({ userId: userId });
        if (!existingUser) {
            await User.create({ userId: userId, firstName: cb.from.first_name || 'Unknown', username: cb.from.username || '' });
        }
    } catch (dbErr) {}

    try {
        await bot.answerCallbackQuery(cb.id);
    } catch (e) {}

    if (data === 'wa_req_pair') {
        await bot.sendMessage(chatId, "📲 <b>Pairing Code එක ලබා ගැනීමට:</b>\n\nඔබගේ අංකය රටේ කේතය (94) සමඟ පහත විධානයෙන් යොමු කරන්න.\n\n👉 <code>/pair 94771234567</code>", { parse_mode: 'HTML' });
    } else if (data === 'wa_status') {
        const userSock = activeSockets.get(userId);
        if (userSock && userSock.authState && userSock.authState.creds && userSock.authState.creds.me) {
            await bot.sendMessage(chatId, "✅ ඔබගේ WhatsApp දැනටමත් Connect වී ඇත!");
        } else {
            await bot.sendMessage(chatId, "❌ ඔබගේ WhatsApp Connect වී නොමැත.");
        }
    } else if (data === 'wa_logout') {
        const userSock = activeSockets.get(userId);
        if (userSock) {
            try {
                userSock.logout();
                activeSockets.delete(userId);
                await SessionDB.deleteOne({ sessionId: `session_${userId}` });
                await bot.sendMessage(chatId, "🚪 WhatsApp Logout කරන ලදී!");
            } catch (e) {
                await bot.sendMessage(chatId, "⚠️ Logout කිරීමේදී දෝෂයක්.");
            }
        } else {
            await bot.sendMessage(chatId, "⚠️ ඔබ දැනටමත් Logout වී ඇත.");
        }
    } else if (data === 'vip_locked') {
        await bot.answerCallbackQuery(cb.id, { text: "👑 මේක VIP මෙම්බර්ලට විතරයි!", show_alert: true }).catch(() => {});
    } else if (data.startsWith('mov_p:')) {
        const parts = data.split(':');
        await sendSearchResults(chatId, parts.slice(2).join(':'), 'movie', parseInt(parts[1]), msgId);
    } else if (data.startsWith('tv_p:')) {
        const parts = data.split(':');
        await sendSearchResults(chatId, parts.slice(2).join(':'), 'tv', parseInt(parts[1]), msgId);
    } else if (data.startsWith('year_p:')) {
        const parts = data.split(':');
        await sendYearSearchResults(chatId, parts[2], parseInt(parts[1]), msgId);
    } else if (data.startsWith('gen_p:')) {
        const parts = data.split(':');
        try {
            const res = await axios.get(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${parts[1]}&page=${parts[2]}`);
            let kb = res.data.results.slice(0, 5).map(m => [{ text: `🎬 ${m.title}`, callback_data: `mov_det:${m.id}` }]);
            let pgRow = [];
            if (parseInt(parts[2]) > 1) pgRow.push({ text: "⬅️ Prev", callback_data: `gen_p:${parts[1]}:${parseInt(parts[2]) - 1}:${parts[3]}` });
            if (parseInt(parts[2]) < res.data.total_pages) pgRow.push({ text: "Next ➡️", callback_data: `gen_p:${parts[1]}:${parseInt(parts[2]) + 1}:${parts[3]}` });
            if (pgRow.length > 0) kb.push(pgRow);
            await bot.editMessageText(`🎭 <b>${parts[3]}</b> චිත්‍රපට:`, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } }).catch(() => {});
        } catch (e) {}
    } else if (data.startsWith('watchlist_add:')) {
        const parts = data.split(':');
        if (!watchlists.has(userId)) watchlists.set(userId, []);
        watchlists.get(userId).push({ id: parts[1], title: decodeURIComponent(parts[2]) });
        await bot.sendMessage(chatId, "✅ Watchlist එකට ඇතුලත් කළා!");
    } else if (data.startsWith('mov_det:') || data.startsWith('tv_det:')) {
        const isTv = data.startsWith('tv_det:');
        const tmdbId = data.split(':')[1];
        const typeUrl = isTv ? 'tv' : 'movie';

        try {
            let isVip = false;
            const dbUser = await User.findOne({ userId: userId });
            if (dbUser && dbUser.isPremium) isVip = true;

            const res = await axios.get(`https://api.themoviedb.org/3/${typeUrl}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=videos`);
            const m = res.data;
            const embedId = m.imdb_id || m.id;
            const title = isTv ? m.name : m.title;
            const date = isTv ? m.first_air_date : m.release_date;

            const subUrl = await getSinhalaSubLink(title);
            const trailer = m.videos?.results?.find(v => v.type === 'Trailer');
            const tUrl = trailer ? `https://youtube.com/watch?v=${trailer.key}` : `https://youtube.com/results?search_query=${encodeURIComponent(title + ' trailer')}`;

            let kb = [
                [{ text: "🚀 Server 1 (Free)", url: `https://vidsrc.pro/embed/${typeUrl}/${embedId}` }],
                [{ text: "⚡ Server 2 (Free)", url: `https://autoembed.co/${typeUrl}/imdb/${embedId}` }]
            ];

            if (isVip) {
                kb.push([{ text: "👑 VIP Server (No Ads / 4K)", url: `https://vidsrc.net/embed/${typeUrl}/${embedId}` }]);
            } else {
                kb.push([{ text: "🔒 VIP Server (Locked)", callback_data: `vip_locked` }]);
            }

            kb.push([{ text: "🎬 Watch Trailer", url: tUrl }, { text: "📝 Sinhala Subs", url: subUrl }]);
            kb.push([{ text: "➕ Add to Watchlist", callback_data: `watchlist_add:${tmdbId}:${encodeURIComponent(title)}` }]);

            const cap = `🎬 <b>${title}</b> (${date?.split('-')[0] || 'N/A'})\n⭐ <b>Rating:</b> ${m.vote_average}/10\n\n📝 <b>Overview:</b> <i>${m.overview}</i>`;

            try { await bot.deleteMessage(chatId, msgId); } catch (e) {}
            if (m.poster_path) {
                await bot.sendPhoto(chatId, `https://image.tmdb.org/t/p/w500${m.poster_path}`, {
                    caption: cap,
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: kb }
                }).catch(() => {});
            } else {
                await bot.sendMessage(chatId, cap, {
                    parse_mode: 'HTML',
                    reply_markup: { inline_keyboard: kb }
                }).catch(() => {});
            }
        } catch (e) {}
    }
});

// -----------------------------------------------------------
// 🔄 Auto-restore WhatsApp Sessions
// -----------------------------------------------------------
async function restoreSessions() {
    try {
        const sessions = await SessionDB.find({});
        for (const session of sessions) {
            const userId = parseInt(session.sessionId.replace('session_', ''));
            if (!isNaN(userId)) {
                await connectToWhatsApp(userId);
            }
        }
    } catch (e) {
        console.error('Session restore error:', e);
    }
}
restoreSessions();

// -----------------------------------------------------------
// 🌐 DASHBOARD & WEBHOOK FIXER (with Error Handling)
// -----------------------------------------------------------
app.get('/', (req, res) => {
    const html = `
    <html>
        <head>
            <title>Chucky Bot Dashboard</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="font-family: Arial; padding: 50px; text-align: center; background-color: #121212; color: white;">
            <h2>🤖 Chucky Bot Dashboard</h2>
            <p style="color: #00E676;">🟢 Server is Running on Railway!</p>
            <form action="/fix-webhook" method="GET">
                <button type="submit" style="padding: 15px 30px; font-size: 16px; background-color: #0088cc; color: white; border: none; border-radius: 8px; cursor: pointer; margin-top: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
                    🔌 Fix Webhook (Click Here)
                </button>
            </form>
        </body>
    </html>
    `;
    res.send(html);
});

app.get('/fix-webhook', async (req, res) => {
    const domain = req.get('host');
    const webhookUrl = `https://${domain}/bot${TELEGRAM_TOKEN}`;

    try {
        await bot.setWebHook(webhookUrl);
        res.send(`
            <body style="font-family: Arial; padding: 50px; text-align: center; background-color: #121212; color: white;">
                <h2 style="color: #00E676;">✅ Webhook Successfully Set!</h2>
                <p>URL: <code>${webhookUrl}</code></p>
                <p>දැන් Telegram එකට ගිහින් බොට්ව පරීක්ෂා කරන්න.</p>
                <br>
                <a href="/" style="color: #0088cc; text-decoration: none;">⬅️ Back to Dashboard</a>
            </body>
        `);
    } catch (error) {
        res.send(`
            <body style="background-color: #121212; color: white; text-align: center; padding: 50px;">
                <h2 style="color: #FF5252;">❌ Webhook Setup Error</h2>
                <p>${error.message}</p>
                <a href="/" style="color: #0088cc; text-decoration: none;">⬅️ Back to Dashboard</a>
            </body>
        `);
    }
});

app.listen(PORT, () => console.log(`🚀 Server started on port ${PORT}`));
