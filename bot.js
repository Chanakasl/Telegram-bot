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

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

const watchlists = new Map();
const warningsMap = new Map();
const postedMoviesCache = new Set();
const allowedAdmins = [6629519111, 6467952735];

// 🛑 STRICT API BAD WORD FILTER
async function isBadWord(text) {
    if (!OPENROUTER_API_KEY || !text) return false;
    try {
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "meta-llama/llama-3-8b-instruct:free",
            messages: [{ role: "system", content: "You are a strict profanity filter. Does this text contain ANY offensive words, bad words, or profanity in English (e.g., fuck), Sinhala (e.g., හුත්තා, පකෝ), or Singlish? Reply ONLY with 'YES' or 'NO'." }, { role: "user", content: text }]
        }, { headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" }, timeout: 5000 });
        return response.data.choices[0].message.content.trim().toUpperCase().includes("YES");
    } catch (err) { 
        console.error("AI Filter Error:", err.message);
        return false; 
    }
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
    } catch (e) { await bot.sendMessage(chatId, "⚠️ සර්වර් දෝෂයක්!"); }
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
            if (msgId) await bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
            else await bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } });
        } else {
            if (msgId) await bot.editMessageText('❌ No movies found!', { chat_id: chatId, message_id: msgId }).catch(()=>{});
            else await bot.sendMessage(chatId, '❌ No movies found!');
        }
    } catch (e) { await bot.sendMessage(chatId, "⚠️ සර්වර් දෝෂයක්!"); }
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
                } catch (e) { console.error("Failed to delete/mute"); }
            }
            return;
        }
    }

    // COMMAND NORMALIZATION (Fixes the @bot_username issue)
    let args = text.split(' ');
    let cmd = args[0].toLowerCase();
    if (cmd.includes('@')) cmd = cmd.split('@')[0]; 
    const query = args.slice(1).join(' ').trim();

    try {
        // COMMANDS
        if (cmd === '/start' || cmd === '/help') {
            const welcomeText = `🎬 <b>Welcome to CHUCKY MOVIE ZONE!</b> 🍿\n\n` +
                                `ලෝකේ තියෙන ඕනෑම Movie, TV Series එකක් ලේසියෙන්ම සොයාගන්න!\n\n` +
                                `📌 <b>Main Commands:</b>\n` +
                                `🎬 /movie [name] - චිත්‍රපට සෙවීමට\n` +
                                `📺 /tv [name] - ටෙලි කතාමාලා සෙවීමට\n` +
                                `🎭 /genres - කාණ්ඩය අනුව බලන්න\n` +
                                `📅 /year [year] - වර්ෂය අනුව\n` +
                                `👤 /actor [name] - නළුවෙක් අනුව\n` +
                                `📋 /watchlist - Watchlist එක\n` +
                                `🎲 /random - අහඹු ෆිල්ම් එකක්\n` +
                                `🔥 /trending - අද ජනප්‍රියම\n` +
                                `🍿 /nowplaying - දැන් තිරගත වන\n` +
                                `📺 /populartv - ජනප්‍රිය ටෙලිකතා\n` +
                                `🏆 /imdb250 - Top Rated ෆිල්ම්ස්\n` +
                                `🌟 /upcoming - ළඟදීම එන ෆිල්ම්ස්\n` +
                                `➕ /addgroup - Bot ව Group එකකට Add කරන්න\n` +
                                `📩 /request [name] - ඇඩ්මින්ගෙන් ඉල්ලන්න\n\n` +
                                `⚠️ <i>Ads නැතුව බලන්න ලින්ක්ස් ඕපන් කරද්දී "Brave Browser" එක පාවිච්චි කරන්න! 🦁</i>`;
            await bot.sendMessage(chatId, welcomeText, { parse_mode: 'HTML' }).catch(()=>{});
        }
        else if (cmd === '/movie') { 
            if (!query) return bot.sendMessage(chatId, "⚠️ කරුණාකර චිත්‍රපටයේ නම ඇතුලත් කරන්න. (උදා: /movie Avatar)");
            await sendSearchResults(chatId, query, 'movie', 1); 
        }
        else if (cmd === '/tv') { 
            if (!query) return bot.sendMessage(chatId, "⚠️ කරුණාකර TV Series එකේ නම ඇතුලත් කරන්න. (උදා: /tv Loki)");
            await sendSearchResults(chatId, query, 'tv', 1); 
        }
        else if (cmd === '/actor') { 
            if (!query) return bot.sendMessage(chatId, "⚠️ කරුණාකර නළුවාගේ නම ඇතුලත් කරන්න. (උදා: /actor Vijay)");
            await sendActorSearchResults(chatId, query); 
        }
        else if (cmd === '/year') { 
            if (/^\d{4}$/.test(query)) await sendYearSearchResults(chatId, query, 1);
            else await bot.sendMessage(chatId, "⚠️ නිවැරදි වර්ෂයක් ඇතුලත් කරන්න. (උදා: /year 2024)");
        }
        else if (cmd === '/genres') {
            let kb = [
                [{ text: "💥 Action", callback_data: "gen_p:28:1:Action" }, { text: "😂 Comedy", callback_data: "gen_p:35:1:Comedy" }],
                [{ text: "👻 Horror", callback_data: "gen_p:27:1:Horror" }, { text: "🚀 Sci-Fi", callback_data: "gen_p:878:1:Sci-Fi" }],
                [{ text: "💖 Romance", callback_data: "gen_p:10749:1:Romance" }, { text: "🎬 Drama", callback_data: "gen_p:18:1:Drama" }]
            ];
            await bot.sendMessage(chatId, "🎭 <b>ඔබ කැමති කාණ්ඩය තෝරන්න:</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
        }
        else if (cmd === '/random') {
            const res = await axios.get(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&page=${Math.floor(Math.random()*50)+1}`);
            const m = res.data.results[Math.floor(Math.random() * res.data.results.length)];
            await bot.sendMessage(chatId, `🎲 <b>අහඹු චිත්‍රපටයක්:</b>\n👉 <i>${m.title}</i>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: `🎬 විස්තර බලන්න`, callback_data: `mov_det:${m.id}` }]] } });
        }
        else if (cmd === '/trending') {
            const res = await axios.get(`https://api.themoviedb.org/3/trending/movie/day?api_key=${TMDB_API_KEY}`);
            let kb = res.data.results.slice(0, 10).map(m => [{ text: `🔥 ${m.title}`, callback_data: `mov_det:${m.id}` }]);
            await bot.sendMessage(chatId, "🔥 <b>අද ජනප්‍රියම චිත්‍රපට:</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
        }
        else if (cmd === '/nowplaying') {
            const res = await axios.get(`https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_API_KEY}`);
            let kb = res.data.results.slice(0, 10).map(m => [{ text: `🍿 ${m.title}`, callback_data: `mov_det:${m.id}` }]);
            await bot.sendMessage(chatId, "🍿 <b>දැන් තිරගත වන:</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
        }
        else if (cmd === '/populartv') {
            const res = await axios.get(`https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_API_KEY}`);
            let kb = res.data.results.slice(0, 10).map(m => [{ text: `📺 ${m.name}`, callback_data: `tv_det:${m.id}` }]);
            await bot.sendMessage(chatId, "📺 <b>ජනප්‍රියම ටෙලි කතාමාලා:</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
        }
        else if (cmd === '/upcoming') {
            const res = await axios.get(`https://api.themoviedb.org/3/movie/upcoming?api_key=${TMDB_API_KEY}`);
            let kb = res.data.results.slice(0, 10).map(m => [{ text: `🌟 ${m.title}`, callback_data: `mov_det:${m.id}` }]);
            await bot.sendMessage(chatId, "🌟 <b>ළඟදීම තිරගත වීමට නියමිත:</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
        }
        else if (cmd === '/imdb250') {
            const res = await axios.get(`https://api.themoviedb.org/3/movie/top_rated?api_key=${TMDB_API_KEY}`);
            let kb = res.data.results.slice(0, 10).map(m => [{ text: `🏆 ${m.title} (${m.vote_average})`, callback_data: `mov_det:${m.id}` }]);
            await bot.sendMessage(chatId, "🏆 <b>ලොව ඉහලින්ම ශ්‍රේණිගත කළ චිත්‍රපට:</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
        }
        else if (cmd === '/watchlist') {
            const list = watchlists.get(userId) || [];
            if (list.length === 0) return bot.sendMessage(chatId, "📭 Your watchlist is empty.");
            let kb = list.map(i => [{ text: `🎬 ${i.title}`, callback_data: `mov_det:${i.id}` }]);
            await bot.sendMessage(chatId, "📋 <b>Your Watchlist:</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
        }
        else if (cmd === '/addgroup' || cmd === '/addchannel') {
            let kb = [[{ text: "📢 Add to Channel", url: `https://t.me/Chucky_movie_zone_bot?startchannel=true` }], [{ text: "➕ Add to Group", url: `https://t.me/Chucky_movie_zone_bot?startgroup=true` }]];
            await bot.sendMessage(chatId, `🤖 <b>Bot ඔබගේ Channel හෝ Group එකට Add කරගන්න!</b>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } });
        }
        else if (cmd === '/request') {
            if (!query) return bot.sendMessage(chatId, "⚠️ කරුණාකර චිත්‍රපටයේ නම ඇතුලත් කරන්න.");
            if (ADMIN_CHAT_ID) {
                await bot.sendMessage(ADMIN_CHAT_ID, `📩 <b>New Request!</b>\n🎬 ${query}`, { parse_mode: 'HTML' });
                await bot.sendMessage(chatId, `✅ Request එක ඇඩ්මින්ට යැව්වා!`);
            }
        }
        else if (cmd === '/testpost' && allowedAdmins.includes(userId)) {
            if (!CHANNEL_ID) return bot.sendMessage(chatId, "⚠️ CHANNEL_ID නෑ!");
            await bot.sendMessage(chatId, "⏳ Auto Post Test ආරම්භ කරනවා...");
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
        }
    } catch (error) {
        console.error("Command Error:", error.message);
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
        await sendSearchResults(chatId, parts.slice(2).join(':'), 'movie', parseInt(parts[1]), msgId);
    }
    else if (data.startsWith('tv_p:')) {
        const parts = data.split(':');
        await sendSearchResults(chatId, parts.slice(2).join(':'), 'tv', parseInt(parts[1]), msgId);
    }
    else if (data.startsWith('year_p:')) {
        const parts = data.split(':');
        await sendYearSearchResults(chatId, parts[2], parseInt(parts[1]), msgId);
    }
    else if (data.startsWith('gen_p:')) {
        const parts = data.split(':');
        try {
            const res = await axios.get(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${parts[1]}&page=${parts[2]}`);
            let kb = res.data.results.slice(0,5).map(m => [{ text: `🎬 ${m.title}`, callback_data: `mov_det:${m.id}` }]);
            let pgRow = [];
            if (parseInt(parts[2]) > 1) pgRow.push({ text: "⬅️ Prev", callback_data: `gen_p:${parts[1]}:${parseInt(parts[2])-1}:${parts[3]}` });
            if (parseInt(parts[2]) < res.data.total_pages) pgRow.push({ text: "Next ➡️", callback_data: `gen_p:${parts[1]}:${parseInt(parts[2])+1}:${parts[3]}` });
            if (pgRow.length > 0) kb.push(pgRow);
            await bot.editMessageText(`🎭 <b>${parts[3]}</b> චිත්‍රපට:`, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } }).catch(()=>{});
        } catch(e) {}
    }
    else if (data.startsWith('watchlist_add:')) {
        const parts = data.split(':');
        if (!watchlists.has(userId)) watchlists.set(userId, []);
        watchlists.get(userId).push({ id: parts[1], title: decodeURIComponent(parts[2]) });
        await bot.sendMessage(chatId, "✅ Watchlist එකට ඇතුලත් කළා!");
    }
    else if (data.startsWith('mov_det:') || data.startsWith('tv_det:')) {
        const isTv = data.startsWith('tv_det:');
        const tmdbId = data.split(':')[1];
        const typeUrl = isTv ? 'tv' : 'movie';
        try {
            const res = await axios.get(`https://api.themoviedb.org/3/${typeUrl}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=videos`);
            const m = res.data;
            
            const embedId = m.imdb_id || m.id;
            const title = isTv ? m.name : m.title;
            const date = isTv ? m.first_air_date : m.release_date;
            const subUrl = await getSinhalaSubLink(title);
            const trailer = m.videos?.results?.find(v => v.type === 'Trailer');
            const tUrl = trailer ? `https://youtube.com/watch?v=${trailer.key}` : `https://youtube.com/results?search_query=${encodeURIComponent(title + ' trailer')}`;

            let kb = [
                [{ text: "🚀 Server 1 (VidSrc)", url: `https://vidsrc.pro/embed/${typeUrl}/${embedId}` }],
                [{ text: "⚡ Server 2 (AutoEmbed)", url: `https://autoembed.co/${typeUrl}/imdb/${embedId}` }],
                [{ text: "🎬 Watch Trailer", url: tUrl }, { text: "📝 Sinhala Subs", url: subUrl }],
                [{ text: "➕ Add to Watchlist", callback_data: `watchlist_add:${tmdbId}:${encodeURIComponent(title)}` }]
            ];

            const cap = `🎬 <b>${title}</b> (${date?.split('-')[0]||'N/A'})\n⭐ <b>Rating:</b> ${m.vote_average}/10\n\n📝 <b>Overview:</b> <i>${m.overview}</i>`;
            
            try { await bot.deleteMessage(chatId, msgId); } catch(e){}
            if (m.poster_path) await bot.sendPhoto(chatId, `https://image.tmdb.org/t/p/w500${m.poster_path}`, { caption: cap, parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } }).catch(()=>{});
            else await bot.sendMessage(chatId, cap, { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } }).catch(()=>{});
        } catch(e) {}
    }
});

app.get('/', (req, res) => res.send('Bot is running on Railway!'));
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
