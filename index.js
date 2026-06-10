const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

const app = express();
app.use(express.json()); 

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || ''; 
const TMDB_API_KEY = process.env.TMDB_API_KEY || ''; 
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const CHANNEL_ID = process.env.CHANNEL_ID; 
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY; // 👈 දැන් පාවිච්චි කරන්නේ OpenRouter

if (!TELEGRAM_TOKEN || !TMDB_API_KEY) {
    console.error("⚠️ FATAL ERROR: TELEGRAM_TOKEN or TMDB_API_KEY is missing!");
}

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

const activeUsers = new Set();
const watchlists = new Map();
const warningsMap = new Map(); // Bad word warnings ගණන් කරන්න

// 🔍 OPENROUTER API (BAD WORD FILTER)
async function isBadWord(text) {
    if (!OPENROUTER_API_KEY || !text) return false;
    
    try {
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "google/gemini-1.5-flash", // වේගවත්ම සහ සිංහල තේරෙන මොඩල් එකක්
            messages: [
                {
                    role: "system",
                    content: "You are a strict group moderator. Analyze the user's text. Does it contain bad words, profanity, or toxic language in English, Sinhala, or Singlish? Reply ONLY with the exact word 'YES' if it contains bad words, or 'NO' if it is clean. Do not explain."
                },
                {
                    role: "user",
                    content: text
                }
            ]
        }, {
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            timeout: 5000 // තත්පර 5ක් ඇතුලත රෙස්පොන්ස් එකක් ආවේ නැත්නම් අතහැර දමයි
        });

        const reply = response.data.choices[0].message.content.trim().toUpperCase();
        return reply.includes("YES"); // YES කියලා ආවොත් කුණුහරුපයක් ලෙස සලකයි
        
    } catch (err) {
        console.error("OpenRouter API Error:", err.message);
        return false;
    }
}

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
    }
}

// ---- 🤖 AUTO POST TO CHANNEL (CRON JOB ENDPOINT) ----
app.get('/api/autopost', async (req, res) => {
    try {
        if (!CHANNEL_ID) return res.status(400).send("No CHANNEL_ID configured.");
        
        // අහඹු පිටුවකින් ජනප්‍රියම ෆිල්ම් එකක් තෝරාගැනීම
        const randomPage = Math.floor(Math.random() * 20) + 1;
        const url = `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&language=en-US&page=${randomPage}`;
        const tmdbRes = await axios.get(url);
        
        const randomMovie = tmdbRes.data.results[Math.floor(Math.random() * tmdbRes.data.results.length)];
        const movieId = randomMovie.id;
        
        // Trailer එක ගන්නවා
        const vidUrl = `https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${TMDB_API_KEY}&language=en-US`;
        const vidRes = await axios.get(vidUrl);
        const trailer = vidRes.data.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        const trailerLink = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(randomMovie.title + ' trailer')}`;

        const year = randomMovie.release_date ? randomMovie.release_date.split('-')[0] : 'N/A';
        const rating = randomMovie.vote_average?.toFixed(1) || 'N/A';
        
        const caption = `🎬 <b>${randomMovie.title} (${year})</b>\n\n` +
                        `⭐ <b>Rating:</b> ${rating}/10\n\n` +
                        `📝 <b>Overview:</b> <i>${randomMovie.overview || 'විස්තරයක් නොමැත.'}</i>\n\n` +
                        `🎥 <b>Trailer:</b> <a href="${trailerLink}">YouTube හි නරඹන්න</a>\n\n` +
                        `👇 <b>Full Movie එක බලන්න අපේ Group එකට Join වෙන්න!</b>\n` +
                        `🔗 https://t.me/+W8xGn6KzYg81ZWU1`;

        let inlineKeyboard = [
            [{ text: "🎬 Watch Trailer", url: trailerLink }],
            [{ text: "🔥 Join our Group", url: "https://t.me/+W8xGn6KzYg81ZWU1" }]
        ];

        if (randomMovie.poster_path) {
            await bot.sendPhoto(CHANNEL_ID, `https://image.tmdb.org/t/p/w500${randomMovie.poster_path}`, { caption: caption, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
        } else {
            await bot.sendMessage(CHANNEL_ID, caption, { parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: { inline_keyboard: inlineKeyboard } });
        }
        
        res.status(200).send("Auto post published to channel successfully!");
    } catch (err) {
        console.error("Auto Post Error:", err.message);
        res.status(500).send("Auto post failed.");
    }
});

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
            return res.send(`<h1 style="color:green;text-align:center;margin-top:20%;">✅ Webhook Setup Successful!</h1>`);
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
            const userId = msg.from.id;
            const isGroup = msg.chat.type === 'supergroup' || msg.chat.type === 'group';

            // 🛑 OPENROUTER BAD WORD CHECKER (For Groups)
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
                            await bot.restrictChatMember(chatId, userId, {
                                can_send_messages: false,
                                can_send_media_messages: false,
                                can_send_other_messages: false
                            }, { until_date: untilDate });
                            await bot.sendMessage(chatId, `🚫 <a href="tg://user?id=${userId}">${msg.from.first_name}</a> <b>අසභ්‍ය වචන භාවිතය නිසා පැය 24කට Mute කරන ලදී.</b>`, { parse_mode: 'HTML' });
                        }
                    } catch (err) { console.error("Mute Error:", err.message); }
                    return; 
                }
            }

            // Normal Commands
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

            else if (text.startsWith('/addgroup') || text.startsWith('/addchannel')) {
                let inlineKeyboard = [
                    [{ text: "📢 Add to Channel", url: `https://t.me/Chucky_movie_zone_bot?startchannel=true` }],
                    [{ text: "➕ Add to Group", url: `https://t.me/Chucky_movie_zone_bot?startgroup=true` }]
                ];
                const addGroupText = `🤖 <b>Chucky Movie Zone Bot ඔබගේ Channel හෝ Group එකට Add කරගන්න!</b>\n\n` +
                                     `👉 පහත තියෙන බටන්ස් ක්ලික් කරලා ඔයාට ලේසියෙන්ම බොට්ව ඔයාගේ <b>Channel</b> එකට හරි <b>Group</b> එකට හරි ඇඩ් කරගන්න පුළුවන්! 🚀`;
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
                
                const trailerVideo = movie.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
                const trailerUrl = trailerVideo ? `https://www.youtube.com/watch?v=${trailerVideo.key}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + ' trailer')}`;

                let inlineKeyboard = [
                    [{ text: "🚀 Server 1 (VidSrc PRO)", url: `https://vidsrc.pro/embed/movie/${embedId}` }],
                    [{ text: "⚡ Server 2 (AutoEmbed)", url: `https://autoembed.co/movie/imdb/${embedId}` }],
                    [{ text: "🔥 Server 3 (MultiEmbed)", url: `https://multiembed.mov/directstream.php?video_id=${tmdbId}&tmdb=1` }],
                    [{ text: "💎 Server 4 (EmbedSu)", url: `https://embed.su/embed/movie/${tmdbId}` }],
                    [{ text: "🛠️ Server 5 (VidSrc ME)", url: `https://vidsrc.me/embed/movie?tmdb=${tmdbId}` }],
                    [
                        { text: "🎬 Watch Trailer", url: trailerUrl },
                        { text: "📝 Sinhala Subs", url: subUrl }
                    ]
                ];

                const replyMessage = `🎬 <b>${movie.title}</b> (${releaseYear})\n\n⭐ <b>Rating:</b> ${movie.vote_average?.toFixed(1) || 'N/A'}/10\n🎭 <b>Genres:</b> ${genres}\n\n📝 <b>Overview:</b> <i>${movie.overview || 'N/A'}</i>\n\n⚠️ <i>Ads නැතිව බලන්න Brave Browser එක පාවිච්චි කරන්න.</i> 🦁`;

                try { await bot.deleteMessage(chatId, msgId); } catch(e){}
                if (movie.poster_path) {
                    await bot.sendPhoto(chatId, `https://image.tmdb.org/t/p/w500${movie.poster_path}`, { caption: replyMessage, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } }).catch(()=>{});
                } else { 
                    await bot.sendMessage(chatId, replyMessage, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } }).catch(()=>{}); 
                }
            }
        }
    } catch (e) { console.error("Webhook Internal Error:", e.message); } finally { res.sendStatus(200); }
});

module.exports = app;
