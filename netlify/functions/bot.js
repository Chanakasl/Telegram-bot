const express = require('express');
const serverless = require('serverless-http');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const app = express();
app.use(express.json()); 

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || ''; 
const TMDB_API_KEY = process.env.TMDB_API_KEY || ''; 
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY; 

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });
const watchlists = new Map();
const warningsMap = new Map(); 

// 🛑 රිපීට් වීම වැළැක්වීමේ Cache එක
const postedMoviesCache = new Set();

// 🛑 OPENROUTER API (BAD WORD FILTER - FREE MODEL)
async function isBadWord(text) {
    if (!OPENROUTER_API_KEY || !text) return false;
    try {
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "meta-llama/llama-3-8b-instruct:free", 
            messages: [
                { role: "system", content: "You are a strict group moderator. Analyze the user's text. Does it contain bad words, profanity, or toxic language in English, Sinhala, or Singlish? Reply ONLY with the exact word 'YES' if it contains bad words, or 'NO' if it is clean. Do not explain." },
                { role: "user", content: text }
            ]
        }, {
            headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
            timeout: 5000 
        });
        return response.data.choices[0].message.content.trim().toUpperCase().includes("YES"); 
    } catch (err) { return false; }
}

// 🔍 SINHALASUB API
async function getSinhalaSubLink(title) {
    try {
        const response = await axios.get(`https://sinhalasub.lk/wp-json/wp/v2/posts?search=${encodeURIComponent(title)}&per_page=1`, { timeout: 4000 });
        if (response.data && response.data.length > 0) return response.data[0].link; 
    } catch (err) {}
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
    } catch (err) { await bot.sendMessage(chatId, "⚠️ සර්වර් එකේ දෝෂයක්. කරුණාකර නැවත උත්සහ කරන්න.").catch(()=>{}); }
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
    } catch (err) {}
}

// 📅 YEAR SEARCH
async function sendYearSearchResults(chatId, year, page = 1, messageIdToEdit = null) {
    try {
        const url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&primary_release_year=${year}&sort_by=popularity.desc&page=${page}`;
        const resApi = await axios.get(url);
        const totalPages = Math.min(resApi.data.total_pages, 500);
        const results = resApi.data.results ? resApi.data.results.slice(0, 5) : [];

        if (results.length > 0) {
            let inlineKeyboard = [];
            results.forEach(movie => { inlineKeyboard.push([{ text: `🎬 ${movie.title}`, callback_data: `mov_det:${movie.id}` }]); });
            let paginationRow = [];
            if (page > 1) paginationRow.push({ text: "⬅️ Prev", callback_data: `year_p:${page - 1}:${year}` });
            if (page < totalPages) paginationRow.push({ text: "Next ➡️", callback_data: `year_p:${page + 1}:${year}` });
            if (paginationRow.length > 0) inlineKeyboard.push(paginationRow);

            const replyText = `🍿 <b>CHUCKY MOVIE ZONE</b>\n\n<i>📅 <b>${year}</b> වසරේ චිත්‍රපට (Page ${page}/${totalPages}):</i>`;
            if (messageIdToEdit) await bot.editMessageText(replyText, { chat_id: chatId, message_id: messageIdToEdit, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
            else await bot.sendMessage(chatId, replyText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
        } else {
            if (messageIdToEdit) await bot.editMessageText('❌ No movies found!', { chat_id: chatId, message_id: messageIdToEdit });
            else await bot.sendMessage(chatId, '❌ No movies found!');
        }
    } catch (err) { }
}

// 🎭 GENRE SEARCH
async function sendGenreSearchResults(chatId, genreId, genreName, page = 1, messageIdToEdit = null) {
    try {
        const url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&page=${page}`;
        const resApi = await axios.get(url);
        const totalPages = Math.min(resApi.data.total_pages, 500);
        const results = resApi.data.results ? resApi.data.results.slice(0, 5) : [];

        if (results.length > 0) {
            let inlineKeyboard = [];
            results.forEach(movie => { inlineKeyboard.push([{ text: `🎬 ${movie.title}`, callback_data: `mov_det:${movie.id}` }]); });
            let paginationRow = [];
            if (page > 1) paginationRow.push({ text: "⬅️ Prev", callback_data: `gen_p:${genreId}:${page - 1}:${genreName}` });
            if (page < totalPages) paginationRow.push({ text: "Next ➡️", callback_data: `gen_p:${genreId}:${page + 1}:${genreName}` });
            if (paginationRow.length > 0) inlineKeyboard.push(paginationRow);

            const replyText = `🍿 <b>CHUCKY MOVIE ZONE</b>\n\n<i>🎭 <b>${genreName}</b> කාණ්ඩයේ චිත්‍රපට (Page ${page}/${totalPages}):</i>`;
            if (messageIdToEdit) await bot.editMessageText(replyText, { chat_id: chatId, message_id: messageIdToEdit, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
            else await bot.sendMessage(chatId, replyText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
        }
    } catch (err) { }
}

// 👤 ACTOR SEARCH
async function sendActorSearchResults(chatId, actorName, page = 1) {
    try {
        const searchUrl = `https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(actorName)}`;
        const resApi = await axios.get(searchUrl);
        const persons = resApi.data.results;
        
        if (!persons || persons.length === 0) {
            await bot.sendMessage(chatId, '❌ Actor not found!'); return;
        }
        
        const actorId = persons[0].id;
        const creditsUrl = `https://api.themoviedb.org/3/person/${actorId}/combined_credits?api_key=${TMDB_API_KEY}`;
        const creditsRes = await axios.get(creditsUrl);
        const cast = (creditsRes.data.cast || []).slice(0, 10);
        
        let inlineKeyboard = [];
        cast.forEach(item => {
            const title = item.title || item.name;
            const callback = item.media_type === 'movie' ? `mov_det:${item.id}` : `tv_det:${item.id}`;
            inlineKeyboard.push([{ text: `🎬 ${title}`, callback_data: callback }]);
        });
        await bot.sendMessage(chatId, `🎭 <b>${persons[0].name}</b> රඟපෑ නිර්මාණ:`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
    } catch (err) {}
}

// 📋 WATCHLIST FUNCTIONS
function addToWatchlist(userId, itemId, title, type) {
    if (!watchlists.has(userId)) watchlists.set(userId, []);
    const list = watchlists.get(userId);
    if (!list.some(item => item.id === itemId)) {
        list.push({ id: itemId, title, type });
        return true;
    }
    return false;
}
function removeFromWatchlist(userId, itemId) {
    if (!watchlists.has(userId)) return false;
    watchlists.set(userId, watchlists.get(userId).filter(item => item.id !== itemId));
    return true;
}
async function showWatchlist(chatId, userId) {
    const list = watchlists.get(userId) || [];
    if (list.length === 0) { await bot.sendMessage(chatId, "📭 Your watchlist is empty."); return; }
    let inlineKeyboard = [];
    list.forEach(item => {
        inlineKeyboard.push([{ text: `🎬 ${item.title}`, callback_data: `${item.type === 'movie' ? 'mov_det' : 'tv_det'}:${item.id}` }]);
        inlineKeyboard.push([{ text: `❌ Remove`, callback_data: `watchlist_remove:${item.id}:${item.type}` }]);
    });
    await bot.sendMessage(chatId, "📋 <b>Your Watchlist:</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
}

// 🛠️ WEBHOOK SETUP ROUTE
app.get('/*setup', async (req, res) => {
    try {
        const host = req.headers.host; 
        const webhookUrl = `https://${host}/.netlify/functions/bot/webhook`;
        await bot.setWebHook(webhookUrl);
        res.send(`<h1 style="color:green;text-align:center;margin-top:20%;">✅ Netlify Webhook Setup Successful!</h1><p style="text-align:center;">URL: ${webhookUrl}</p>`);
    } catch (error) { res.status(500).send(`Setup Failed: ${error.message}`); }
});

// 🤖 MAIN BOT LOGIC ROUTE
app.post('/*webhook', async (req, res) => {
    try {
        const body = req.body;

        if (body.message && body.message.text) {
            const msg = body.message;
            const chatId = msg.chat.id;
            const text = msg.text;
            const userId = msg.from.id;
            const isGroup = msg.chat.type === 'supergroup' || msg.chat.type === 'group';

            // 🛑 BAD WORD FILTER
            if (isGroup && OPENROUTER_API_KEY && !text.startsWith('/')) {
                const isToxic = await isBadWord(text);
                if (isToxic) {
                    try {
                        await bot.deleteMessage(chatId, msg.message_id);
                        let warnings = warningsMap.get(userId) || 0;
                        warnings++;
                        warningsMap.set(userId, warnings);

                        if (warnings === 1) {
                            await bot.sendMessage(chatId, `⚠️ <a href="tg://user?id=${userId}">${msg.from.first_name}</a>, <b>කරුණාකර අසභ්‍ය වචන භාවිතයෙන් වළකින්න!</b>\nමීළඟ වතාවේ ඔබව Group එකෙන් Mute කරනු ලැබේ.`, { parse_mode: 'HTML' });
                        } else {
                            const untilDate = Math.floor(Date.now() / 1000) + (24 * 60 * 60); 
                            await bot.restrictChatMember(chatId, userId, { can_send_messages: false }, { until_date: untilDate });
                            await bot.sendMessage(chatId, `🚫 <a href="tg://user?id=${userId}">${msg.from.first_name}</a> <b>අසභ්‍ය වචන භාවිතය නිසා පැය 24කට Mute කරන ලදී.</b>`, { parse_mode: 'HTML' });
                        }
                    } catch (err) {}
                    return res.sendStatus(200); 
                }
            }

            // 🎯 NORMAL COMMANDS
            if (text.startsWith('/start') || text.startsWith('/help')) {
                const welcomeText = `🎬 <b>Welcome to CHUCKY MOVIE ZONE!</b> 🍿\n\n` +
                                    `ලෝකේ තියෙන ඕනෑම Movie, TV Series එකක් ලේසියෙන්ම සොයාගන්න!\n\n` +
                                    `<b>📌 Main Commands:</b>\n` +
                                    `/movie [name] - චිත්‍රපට සෙවීමට\n` +
                                    `/tv [name] - ටෙලි කතාමාලා සෙවීමට\n` +
                                    `/genres - කාණ්ඩය අනුව බලන්න\n` +
                                    `/year [year] - වර්ෂය අනුව\n` +
                                    `/actor [name] - නළුවෙක් අනුව\n` +
                                    `/watchlist - Watchlist එක\n` +
                                    `/random - අහඹු ෆිල්ම් එකක්\n` +
                                    `/trending - අද ජනප්‍රියම\n` +
                                    `/nowplaying - දැන් තිරගත වන\n` +
                                    `/populartv - ජනප්‍රිය ටෙලිකතා\n` +
                                    `/imdb250 - Top Rated ෆිල්ම්ස්\n` +
                                    `/upcoming - ළඟදීම එන ෆිල්ම්ස්\n` +
                                    `/addgroup - Bot ව Group එකකට Add කරන්න\n` +
                                    `/request [name] - ඇඩ්මින්ගෙන් ඉල්ලන්න\n\n` +
                                    `⚠️ <i>Ads නැතුව බලන්න "Brave Browser" පාවිච්චි කරන්න! 🦁</i>`;
                await bot.sendMessage(chatId, welcomeText, { parse_mode: 'HTML' }).catch(()=>{});
            }

            else if (text.startsWith('/movie ')) { await sendMovieSearchResults(chatId, text.replace('/movie ', '').trim(), 1); }
            else if (text.startsWith('/tv ')) { await sendTvSearchResults(chatId, text.replace('/tv ', '').trim(), 1); }
            else if (text.startsWith('/actor ')) { await sendActorSearchResults(chatId, text.replace('/actor ', '').trim(), 1); }
            
            else if (text.startsWith('/year ')) {
                const year = text.replace('/year ', '').trim();
                if (/^\d{4}$/.test(year)) await sendYearSearchResults(chatId, year, 1);
                else await bot.sendMessage(chatId, "⚠️ නිවැරදි වර්ෂයක් ඇතුලත් කරන්න. (Ex: /year 2025)");
            }
            
            else if (text === '/genres') {
                let inlineKeyboard = [
                    [{ text: "💥 Action", callback_data: "gen_p:28:1:Action" }, { text: "😂 Comedy", callback_data: "gen_p:35:1:Comedy" }],
                    [{ text: "👻 Horror", callback_data: "gen_p:27:1:Horror" }, { text: "🚀 Sci-Fi", callback_data: "gen_p:878:1:Sci-Fi" }],
                    [{ text: "💖 Romance", callback_data: "gen_p:10749:1:Romance" }, { text: "🎬 Drama", callback_data: "gen_p:18:1:Drama" }],
                    [{ text: "🕵️ Thriller", callback_data: "gen_p:53:1:Thriller" }, { text: "🤠 Animation", callback_data: "gen_p:16:1:Animation" }]
                ];
                await bot.sendMessage(chatId, "🎭 <b>ඔබ කැමති සිනමා කාණ්ඩය තෝරන්න:</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
            }

            else if (text === '/trending') {
                const resApi = await axios.get(`https://api.themoviedb.org/3/trending/movie/day?api_key=${TMDB_API_KEY}`);
                let inlineKeyboard = resApi.data.results.slice(0, 10).map(m => [{ text: `🔥 ${m.title}`, callback_data: `mov_det:${m.id}` }]);
                await bot.sendMessage(chatId, "🔥 <b>අද දවසේ ජනප්‍රියම චිත්‍රපට:</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
            }

            else if (text === '/nowplaying') {
                const resApi = await axios.get(`https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_API_KEY}&language=en-US&page=1`);
                let inlineKeyboard = resApi.data.results.slice(0, 10).map(m => [{ text: `🎬 ${m.title}`, callback_data: `mov_det:${m.id}` }]);
                await bot.sendMessage(chatId, "🍿 <b>දැන් තිරගත වන චිත්‍රපට:</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
            }

            else if (text === '/populartv') {
                const resApi = await axios.get(`https://api.themoviedb.org/3/tv/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1`);
                let inlineKeyboard = resApi.data.results.slice(0, 10).map(t => [{ text: `📺 ${t.name}`, callback_data: `tv_det:${t.id}` }]);
                await bot.sendMessage(chatId, "📺 <b>ජනප්‍රියම ටෙලි කතාමාලා:</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
            }

            else if (text === '/upcoming') {
                const resApi = await axios.get(`https://api.themoviedb.org/3/movie/upcoming?api_key=${TMDB_API_KEY}&language=en-US&page=1`);
                let inlineKeyboard = resApi.data.results.slice(0, 10).map(m => [{ text: `🌟 ${m.title}`, callback_data: `mov_det:${m.id}` }]);
                await bot.sendMessage(chatId, "🌟 <b>ළඟදීම තිරගත වීමට නියමිත චිත්‍රපට:</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
            }

            else if (text === '/imdb250') {
                const resApi = await axios.get(`https://api.themoviedb.org/3/movie/top_rated?api_key=${TMDB_API_KEY}&language=en-US&page=1`);
                let inlineKeyboard = resApi.data.results.slice(0, 10).map(m => [{ text: `🏆 ${m.title} (${m.vote_average})`, callback_data: `mov_det:${m.id}` }]);
                await bot.sendMessage(chatId, "🏆 <b>ලොව ඉහලින්ම ශ්‍රේණිගත කළ චිත්‍රපට:</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
            }

            else if (text === '/random') {
                const randomPage = Math.floor(Math.random() * 50) + 1;
                const resApi = await axios.get(`https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=en-US&sort_by=popularity.desc&page=${randomPage}`);
                const randomMovie = resApi.data.results[Math.floor(Math.random() * resApi.data.results.length)];
                await bot.sendMessage(chatId, `🎲 <b>අහඹු චිත්‍රපටයක්:</b>\n👉 <i>${randomMovie.title}</i>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: `🎬 විස්තර බලන්න`, callback_data: `mov_det:${randomMovie.id}` }]] } });
            }

            else if (text === '/watchlist') { await showWatchlist(chatId, userId); }

            else if (text.startsWith('/addgroup') || text.startsWith('/addchannel')) {
                let inlineKeyboard = [
                    [{ text: "📢 Add to Channel", url: `https://t.me/Chucky_movie_zone_bot?startchannel=true` }],
                    [{ text: "➕ Add to Group", url: `https://t.me/Chucky_movie_zone_bot?startgroup=true` }]
                ];
                await bot.sendMessage(chatId, `🤖 <b>Bot ඔබගේ Channel හෝ Group එකට Add කරගන්න!</b>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } }).catch(()=>{});
            }

            else if (text.startsWith('/request ')) {
                if (ADMIN_CHAT_ID) {
                    await bot.sendMessage(ADMIN_CHAT_ID, `📩 <b>New Request!</b>\n🎬 ${text.replace('/request ', '')}`, { parse_mode: 'HTML' });
                    await bot.sendMessage(chatId, `✅ Request එක ඇඩ්මින්ට යැව්වා!`);
                }
            }

            // 🚀 TOP SECRET MANUAL CHANNEL POSTING TEST COMMAND
            else if (text === '/testpost') {
                const allowedAdmins = [6629519111, 6467952735]; // ඔයාගේ ID දෙක පමණි
                
                // ඇඩ්මින් කෙනෙක් නෙවෙයි නම් කිසිම දෙයක් නොකර නිශ්ශබ්දව ඉන්නවා
                if (!allowedAdmins.includes(userId)) {
                    return res.sendStatus(200);
                }
                
                if (!CHANNEL_ID) {
                    await bot.sendMessage(chatId, "⚠️ CHANNEL_ID එක සෙට් කරලා නෑ!");
                    return res.sendStatus(200);
                }
                
                await bot.sendMessage(chatId, "⏳ Auto Post Test ආරම්භ කරනවා... (අලුත් ෆිල්ම්ස් 10ක් හොයනවා)");
                
                try {
                    let postedCount = 0;
                    for (let i = 0; i < 10; i++) {
                        let randomMovie = null;
                        let attempts = 0;
                        
                        // රිපීට් වෙන්නෙ නැති ෆිල්ම් එකක් හොයනකම් ලූප් වෙනවා
                        while (attempts < 20) {
                            const randomPage = Math.floor(Math.random() * 20) + 1;
                            const tmdbRes = await axios.get(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&language=en-US&page=${randomPage}`);
                            const candidate = tmdbRes.data.results[Math.floor(Math.random() * tmdbRes.data.results.length)];
                            
                            if (!postedMoviesCache.has(candidate.id)) {
                                randomMovie = candidate;
                                postedMoviesCache.add(candidate.id);
                                
                                // Cache එක ඕනෑවට වඩා පිරුණොත් පරණම ඒවා මකනවා (Memory සීමාවන් නිසා)
                                if (postedMoviesCache.size > 500) { 
                                    postedMoviesCache.delete(postedMoviesCache.values().next().value);
                                }
                                break;
                            }
                            attempts++;
                        }

                        if (!randomMovie) continue; // අලුත් එකක් හම්බුනේ නැත්නම් ඊළඟ එකට යනවා
                        
                        const vidRes = await axios.get(`https://api.themoviedb.org/3/movie/${randomMovie.id}/videos?api_key=${TMDB_API_KEY}&language=en-US`);
                        const trailer = vidRes.data.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
                        const trailerLink = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(randomMovie.title + ' trailer')}`;

                        const year = randomMovie.release_date ? randomMovie.release_date.split('-')[0] : 'N/A';
                        const caption = `🎬 <b>${randomMovie.title} (${year})</b>\n\n` +
                                        `🎥 <b>Trailer:</b> <a href="${trailerLink}">YouTube හි නරඹන්න</a>\n\n` +
                                        `👇 <b>Full Movie එක බලන්න අපේ Group එකට Join වෙන්න!</b>\n` +
                                        `🔗 https://t.me/+W8xGn6KzYg81ZWU1`;

                        let inlineKeyboard = [
                            [{ text: "🎬 Watch Trailer", url: trailerLink }],
                            [{ text: "🔥 Join our Group", url: "https://t.me/+W8xGn6KzYg81ZWU1" }]
                        ];

                        if (randomMovie.poster_path) {
                            await bot.sendPhoto(CHANNEL_ID, `https://image.tmdb.org/t/p/w500${randomMovie.poster_path}`, { caption: caption, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } }).catch(()=>{});
                        } else {
                            await bot.sendMessage(CHANNEL_ID, caption, { parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: { inline_keyboard: inlineKeyboard } }).catch(()=>{});
                        }
                        
                        postedCount++;
                        // Netlify Timeout limit (10s) බේරගන්න Delay එක 300ms කරලා තියෙන්නේ.
                        await new Promise(resolve => setTimeout(resolve, 300)); 
                    }
                    await bot.sendMessage(chatId, `✅ අලුත් පෝස්ට් ${postedCount}ක් සාර්ථකව චැනල් එකට දැම්මා! (Top Secret 😎)`);
                } catch (err) {
                    await bot.sendMessage(chatId, `❌ Auto Post දෝෂයක්: ${err.message}`);
                }
            }
        }

        // 🔘 CALLBACK QUERIES (BUTTON CLICKS)
        else if (body.callback_query) {
            const cb = body.callback_query;
            const chatId = cb.message.chat.id;
            const msgId = cb.message.message_id;
            const data = cb.data;
            const userId = cb.from.id;

            try { await bot.answerCallbackQuery(cb.id); } catch(e){}

            if (data.startsWith('watchlist_add:')) {
                const parts = data.split(':');
                addToWatchlist(userId, parts[1], decodeURIComponent(parts[3]), parts[2]);
            }
            else if (data.startsWith('watchlist_remove:')) {
                removeFromWatchlist(userId, data.split(':')[1]);
                await showWatchlist(chatId, userId);
            }
            else if (data.startsWith('mov_p:')) {
                const parts = data.split(':');
                await sendMovieSearchResults(chatId, parts.slice(2).join(':').trim(), parseInt(parts[1]), msgId);
            }
            else if (data.startsWith('tv_p:')) {
                const parts = data.split(':');
                await sendTvSearchResults(chatId, parts.slice(2).join(':').trim(), parseInt(parts[1]), msgId);
            }
            else if (data.startsWith('year_p:')) {
                const parts = data.split(':');
                await sendYearSearchResults(chatId, parts[2].trim(), parseInt(parts[1]), msgId);
            }
            else if (data.startsWith('gen_p:')) {
                const parts = data.split(':');
                await sendGenreSearchResults(chatId, parts[1], parts[3].trim(), parseInt(parts[2]), msgId);
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
                
                const trailerVideo = movie.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
                const trailerUrl = trailerVideo ? `https://www.youtube.com/watch?v=${trailerVideo.key}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + ' trailer')}`;

                let inlineKeyboard = [
                    [{ text: "🚀 Server 1 (VidSrc PRO)", url: `https://vidsrc.pro/embed/movie/${embedId}` }],
                    [{ text: "⚡ Server 2 (AutoEmbed)", url: `https://autoembed.co/movie/imdb/${embedId}` }],
                    [{ text: "🔥 Server 3 (MultiEmbed)", url: `https://multiembed.mov/directstream.php?video_id=${tmdbId}&tmdb=1` }],
                    [{ text: "💎 Server 4 (EmbedSu)", url: `https://embed.su/embed/movie/${tmdbId}` }],
                    [{ text: "🛠️ Server 5 (VidSrc ME)", url: `https://vidsrc.me/embed/movie?tmdb=${tmdbId}` }],
                    [ { text: "🎬 Watch Trailer", url: trailerUrl }, { text: "📝 Sinhala Subs", url: subUrl } ],
                    [{ text: "➕ Add to Watchlist", callback_data: `watchlist_add:${tmdbId}:movie:${encodeURIComponent(movie.title)}` }]
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
    } catch (e) { } 
    finally { res.sendStatus(200); }
});

module.exports.handler = serverless(app);
