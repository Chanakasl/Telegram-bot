const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

const app = express();
app.use(express.json()); 

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN; 
const TMDB_API_KEY = process.env.TMDB_API_KEY; 
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

const activeUsers = new Set();

// 🔍 SINHALASUB API
async function getSinhalaSubLink(title) {
    try {
        const response = await axios.get(`https://sinhalasub.lk/wp-json/wp/v2/posts?search=${encodeURIComponent(title)}&per_page=1`, { timeout: 3500 });
        if (response.data && response.data.length > 0) return response.data[0].link; 
    } catch (err) { console.error("Sinhalasub API Error."); }
    return `https://sinhalasub.lk/?s=${encodeURIComponent(title)}`;
}

// 📄 MOVIE SEARCH FUNCTION
async function sendMovieSearchResults(chatId, query, page = 1, messageIdToEdit = null) {
    try {
        const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=${page}`;
        const resApi = await axios.get(searchUrl);
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
            
            if (messageIdToEdit) await bot.editMessageText(replyText, { chat_id: chatId, message_id: messageIdToEdit, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
            else await bot.sendMessage(chatId, replyText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
        } else {
            const errorMsg = '❌ Movie not found!';
            if (messageIdToEdit) await bot.editMessageText(errorMsg, { chat_id: chatId, message_id: messageIdToEdit });
            else await bot.sendMessage(chatId, errorMsg);
        }
    } catch (err) { console.error(err); }
}

// 📄 TV SERIES SEARCH FUNCTION
async function sendTvSearchResults(chatId, query, page = 1, messageIdToEdit = null) {
    try {
        const searchUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US&page=${page}`;
        const resApi = await axios.get(searchUrl);
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
            
            if (messageIdToEdit) await bot.editMessageText(replyText, { chat_id: chatId, message_id: messageIdToEdit, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
            else await bot.sendMessage(chatId, replyText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
        } else {
            const errorMsg = '❌ TV Series not found!';
            if (messageIdToEdit) await bot.editMessageText(errorMsg, { chat_id: chatId, message_id: messageIdToEdit });
            else await bot.sendMessage(chatId, errorMsg);
        }
    } catch (err) { console.error(err); }
}

// 📅 DISCOVER BY YEAR SEARCH FUNCTION
async function sendYearSearchResults(chatId, year, page = 1, messageIdToEdit = null) {
    try {
        const url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&primary_release_year=${year}&sort_by=popularity.desc&page=${page}`;
        const resApi = await axios.get(url);
        const totalPages = Math.min(resApi.data.total_pages, 500); // TMDB limit
        const results = resApi.data.results ? resApi.data.results.slice(0, 5) : [];

        if (results.length > 0) {
            let inlineKeyboard = [];
            results.forEach(movie => {
                inlineKeyboard.push([{ text: `🎬 ${movie.title}`, callback_data: `mov_det:${movie.id}` }]);
            });

            let paginationRow = [];
            if (page > 1) paginationRow.push({ text: "⬅️ Prev", callback_data: `year_p:${page - 1}:${year}` });
            if (page < totalPages) paginationRow.push({ text: "Next ➡️", callback_data: `year_p:${page + 1}:${year}` });
            if (paginationRow.length > 0) inlineKeyboard.push(paginationRow);

            const replyText = `🍿 <b>CHUCKY MOVIE ZONE</b>\n\n<i>📅 <b>${year}</b> වසරේ නිකුත් වූ ජනප්‍රිය චිත්‍රපට (Page ${page}/${totalPages}):</i>`;
            
            if (messageIdToEdit) await bot.editMessageText(replyText, { chat_id: chatId, message_id: messageIdToEdit, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
            else await bot.sendMessage(chatId, replyText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
        } else {
            if (messageIdToEdit) await bot.editMessageText('❌ No movies found for this year!', { chat_id: chatId, message_id: messageIdToEdit });
            else await bot.sendMessage(chatId, '❌ No movies found for this year!');
        }
    } catch (err) { console.error(err); }
}

// 🎭 DISCOVER BY GENRE SEARCH FUNCTION
async function sendGenreSearchResults(chatId, genreId, genreName, page = 1, messageIdToEdit = null) {
    try {
        const url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&page=${page}`;
        const resApi = await axios.get(url);
        const totalPages = Math.min(resApi.data.total_pages, 500);
        const results = resApi.data.results ? resApi.data.results.slice(0, 5) : [];

        if (results.length > 0) {
            let inlineKeyboard = [];
            results.forEach(movie => {
                const year = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
                inlineKeyboard.push([{ text: `🎬 ${movie.title} (${year})`, callback_data: `mov_det:${movie.id}` }]);
            });

            let paginationRow = [];
            if (page > 1) paginationRow.push({ text: "⬅️ Prev", callback_data: `gen_p:${genreId}:${page - 1}:${genreName}` });
            if (page < totalPages) paginationRow.push({ text: "Next ➡️", callback_data: `gen_p:${genreId}:${page + 1}:${genreName}` });
            if (paginationRow.length > 0) inlineKeyboard.push(paginationRow);

            const replyText = `🍿 <b>CHUCKY MOVIE ZONE</b>\n\n<i>🎭 <b>${genreName}</b> කාණ්ඩයේ ජනප්‍රිය චිත්‍රපට (Page ${page}/${totalPages}):</i>`;
            
            if (messageIdToEdit) await bot.editMessageText(replyText, { chat_id: chatId, message_id: messageIdToEdit, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
            else await bot.sendMessage(chatId, replyText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
        } else {
            if (messageIdToEdit) await bot.editMessageText('❌ No movies found for this genre!', { chat_id: chatId, message_id: messageIdToEdit });
            else await bot.sendMessage(chatId, '❌ No movies found for this genre!');
        }
    } catch (err) { console.error(err); }
}

// ---- 🌐 1. HOME PAGE ----
app.get('/', (req, res) => {
    res.send(`<h1 style="color:red; text-align:center; font-family:monospace; margin-top:20%;">CHUCKY MOVIE ZONE PRO - ONLINE 🚀</h1><p style="text-align:center;"><a href="/setup">Set Webhook</a></p>`);
});

// ---- 🛠️ 2. WEBHOOK SETUP ----
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
    bot.processUpdate(req.body);

    try {
        const body = req.body;

        if (body.message && body.message.text) {
            const msg = body.message;
            const chatId = msg.chat.id;
            const text = msg.text;
            const userId = msg.from ? msg.from.id : null;

            if (userId) activeUsers.add(userId);

            if (text.startsWith('/start') || text.startsWith('/help')) {
                const welcomeText = `🎬 <b>Welcome to CHUCKY MOVIE ZONE!</b> 🍿\n\n` +
                                    `ලෝකේ තියෙන ඕනෑම Movie, TV Series එකක් ලේසියෙන්ම සොයාගන්න!\n\n` +
                                    `<b>📌 Main Commands:</b>\n` +
                                    `🎥 <code>/movie [name]</code> - චිත්‍රපට සෙවීමට\n` +
                                    `📺 <code>/tv [name]</code> - ටෙලි කතාමාලා සෙවීමට\n` +
                                    `🎭 <code>/genres</code> - කැටගරි (Genres) අනුව බලන්න\n` +
                                    `📅 <code>/year [year]</code> - වර්ෂය අනුව සෙවීමට (Ex: /year 2025)\n\n` +
                                    `<b>🔥 Pro Features:</b>\n` +
                                    `🔥 <code>/trending</code> - අද දවසේ ජනප්‍රියම ෆิල්ම්ස්\n` +
                                    `🌟 <code>/upcoming</code> - ළඟදීම එන ෆิල්ම්ස්\n` +
                                    `🎲 <code>/random</code> - අහඹු ෆิල්ම් එකක්\n` +
                                    `🏆 <code>/imdb250</code> - Top Rated ෆิල්ම්ස්\n` +
                                    `📩 <code>/request [name]</code> - ඇඩ්මින්ගෙන් ඉල්ලන්න\n\n` +
                                    `⚠️ <b>වැදගත්:</b>\n<i>ඇඩ්ස් නැතුව බලන්න ලින්ක්ස් ඕපන් කරද්දී "Brave Browser" එක පාවිච්චි කරන්න! 🦁</i>`;
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

            else if (text.startsWith('/year ')) {
                const year = text.replace('/year ', '').trim();
                if (/^\d{4}$/.test(year)) {
                    await sendYearSearchResults(chatId, year, 1);
                } else {
                    await bot.sendMessage(chatId, "⚠️ කරුණාකර නිවැරදි වර්ෂයක් ඇතුලත් කරන්න. (Example: <code>/year 2025</code>)", { parse_mode: 'HTML' });
                }
            }

            else if (text === '/genres') {
                let inlineKeyboard = [
                    [{ text: "💥 Action", callback_data: "gen_p:28:1:Action" }, { text: "😂 Comedy", callback_data: "gen_p:35:1:Comedy" }],
                    [{ text: "👻 Horror", callback_data: "gen_p:27:1:Horror" }, { text: "🚀 Sci-Fi", callback_data: "gen_p:878:1:Sci-Fi" }],
                    [{ text: "💖 Romance", callback_data: "gen_p:10749:1:Romance" }, { text: "🎬 Drama", callback_data: "gen_p:18:1:Drama" }],
                    [{ text: "🕵️ Thriller", callback_data: "gen_p:53:1:Thriller" }, { text: "🤠 Animation", callback_data: "gen_p:16:1:Animation" }]
                ];
                await bot.sendMessage(chatId, "🎭 <b>ඔබ කැමති සිනමා කාණ්ඩය (Genre) තෝරන්න:</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
            }

            else if (text === '/trending') {
                const url = `https://api.themoviedb.org/3/trending/movie/day?api_key=${TMDB_API_KEY}`;
                const resApi = await axios.get(url);
                const results = resApi.data.results.slice(0, 10);
                let inlineKeyboard = results.map(m => [{ text: `🔥 ${m.title}`, callback_data: `mov_det:${m.id}` }]);
                await bot.sendMessage(chatId, "🔥 <b>අද දවසේ ජනප්‍රියම චිත්‍රපට:</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
            }

            else if (text === '/upcoming') {
                const url = `https://api.themoviedb.org/3/movie/upcoming?api_key=${TMDB_API_KEY}&language=en-US&page=1`;
                const resApi = await axios.get(url);
                const results = resApi.data.results.slice(0, 10);
                let inlineKeyboard = results.map(m => [{ text: `🌟 ${m.title}`, callback_data: `mov_det:${m.id}` }]);
                await bot.sendMessage(chatId, "🌟 <b>ළඟදීම තිරගත වීමට නියමිත චිත්‍රපට:</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
            }

            else if (text === '/imdb250') {
                const url = `https://api.themoviedb.org/3/movie/top_rated?api_key=${TMDB_API_KEY}&language=en-US&page=1`;
                const resApi = await axios.get(url);
                const results = resApi.data.results.slice(0, 10);
                let inlineKeyboard = results.map(m => [{ text: `🏆 ${m.title} (${m.vote_average})`, callback_data: `mov_det:${m.id}` }]);
                await bot.sendMessage(chatId, "🏆 <b>ලොව ඉහලින්ම ශ්‍රේණිගත කළ චිත්‍රපට:</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
            }

            else if (text === '/random') {
                const randomPage = Math.floor(Math.random() * 50) + 1;
                const url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=en-US&sort_by=popularity.desc&page=${randomPage}`;
                const resApi = await axios.get(url);
                const results = resApi.data.results;
                const randomMovie = results[Math.floor(Math.random() * results.length)];
                
                let inlineKeyboard = [[{ text: `🎬 ${randomMovie.title} විස්තර බලන්න`, callback_data: `mov_det:${randomMovie.id}` }]];
                await bot.sendMessage(chatId, `🎲 <b>ඔබට ගැලපෙන අහඹු චිත්‍රපටයක්:</b>\n\n👉 <i>${randomMovie.title}</i>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
            }

            else if (text === '/watchlist') {
                await bot.sendMessage(chatId, "📌 <b>Watchlist Feature:</b>\n\nමෙම පහසුකම මේ වන විට සකස් කරමින් පවතී. ඉදිරි අප්ඩේට් එකෙන් බලාපොරොත්තු වන්න! 🛠️", { parse_mode: 'HTML' });
            }

            else if (text.startsWith('/request ')) {
                const reqMovie = text.replace('/request ', '').trim();
                if (ADMIN_CHAT_ID) {
                    await bot.sendMessage(ADMIN_CHAT_ID, `📩 <b>New Movie Request!</b>\n\n🎬 Requested: <b>${reqMovie}</b>`, { parse_mode: 'HTML' });
                    await bot.sendMessage(chatId, `✅ ඔයාගේ Request එක ඇඩ්මින්ට යැව්වා!`);
                }
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
                const queryStr = parts.slice(2).join(':'); 
                await sendMovieSearchResults(chatId, queryStr, pageNum, msgId);
            }
            else if (data.startsWith('tv_p:')) {
                const parts = data.split(':');
                const pageNum = parseInt(parts[1]);
                const queryStr = parts.slice(2).join(':');
                await sendTvSearchResults(chatId, queryStr, pageNum, msgId);
            }
            else if (data.startsWith('year_p:')) {
                const parts = data.split(':');
                const pageNum = parseInt(parts[1]);
                const yearStr = parts[2];
                await sendYearSearchResults(chatId, yearStr, pageNum, msgId);
            }
            else if (data.startsWith('gen_p:')) {
                const parts = data.split(':');
                const genreId = parts[1];
                const pageNum = parseInt(parts[2]);
                const genreName = parts[3];
                await sendGenreSearchResults(chatId, genreId, genreName, pageNum, msgId);
            }

            // 🎭 SIMILAR MOVIES CALLBACK
            else if (data.startsWith('mov_sim:')) {
                const tmdbId = data.split(':')[1];
                const simUrl = `https://api.themoviedb.org/3/movie/${tmdbId}/recommendations?api_key=${TMDB_API_KEY}&language=en-US&page=1`;
                const resApi = await axios.get(simUrl);
                const results = resApi.data.results ? resApi.data.results.slice(0, 5) : [];

                if (results.length > 0) {
                    let inlineKeyboard = results.map(m => [{ text: `🎬 ${m.title}`, callback_data: `mov_det:${m.id}` }]);
                    inlineKeyboard.push([{ text: "⬅️ Back to Movie", callback_data: `mov_det:${tmdbId}` }]);
                    await bot.sendMessage(chatId, "🎭 <b>මීට සමාන ජනප්‍රිය චිත්‍රපට කිහිපයක්:</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                } else {
                    await bot.sendMessage(chatId, "❌ සමාන චිත්‍රපට කිසිවක් සොයාගත නොහැකි විය.");
                }
            }

            // 📺 SIMILAR TV SHOWS CALLBACK
            else if (data.startsWith('tv_sim:')) {
                const tvId = data.split(':')[1];
                const simUrl = `https://api.themoviedb.org/3/tv/${tvId}/recommendations?api_key=${TMDB_API_KEY}&language=en-US&page=1`;
                const resApi = await axios.get(simUrl);
                const results = resApi.data.results ? resApi.data.results.slice(0, 5) : [];

                if (results.length > 0) {
                    let inlineKeyboard = results.map(t => [{ text: `📺 ${t.name}`, callback_data: `tv_det:${t.id}` }]);
                    inlineKeyboard.push([{ text: "⬅️ Back to TV Show", callback_data: `tv_det:${tvId}` }]);
                    await bot.sendMessage(chatId, "📺 <b>මීට සමාන ජනප්‍රිය ටෙලි කතාමාලා කිහිපයක්:</b>", { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                } else {
                    await bot.sendMessage(chatId, "❌ සමාන ටෙලි කතාමාලා කිසිවක් සොයාගත නොහැකි විය.");
                }
            }

            // ---- MOVIES DETAILED VIEW ----
            else if (data.startsWith('mov_det:')) {
                const tmdbId = data.split(':')[1];
                const detailUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=videos`;
                const resApi = await axios.get(detailUrl);
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
                    [
                        { text: "🎬 Watch Trailer", url: trailerUrl },
                        { text: "📝 Sinhala Subs", url: subUrl }
                    ],
                    [{ text: "🎭 Similar Movies (සමාන ඒවා)", callback_data: `mov_sim:${tmdbId}` }]
                ];

                const replyMessage = `🎬 <b>${movie.title}</b> (${releaseYear})\n\n⭐ <b>Rating:</b> ${movie.vote_average?.toFixed(1) || 'N/A'}/10\n🎭 <b>Genres:</b> ${genres}\n\n📝 <b>Overview:</b> <i>${movie.overview || 'N/A'}</i>\n\n⚠️ <i>Ads නැතිව බලන්න Brave Browser එක පාවිච්චි කරන්න.</i> 🦁`;

                try { await bot.deleteMessage(chatId, msgId); } catch(e){}
                if (movie.poster_path) {
                    await bot.sendPhoto(chatId, `https://image.tmdb.org/t/p/w500${movie.poster_path}`, { caption: replyMessage, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                } else { 
                    await bot.sendMessage(chatId, replyMessage, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } }); 
                }
            }

            // ---- TV SERIES DETAILED VIEW ----
            else if (data.startsWith('tv_det:')) {
                const tvId = data.split(':')[1];
                const detailUrl = `https://api.themoviedb.org/3/tv/${tvId}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=videos`;
                const resApi = await axios.get(detailUrl);
                const tv = resApi.data;
                
                const year = tv.first_air_date ? tv.first_air_date.split('-')[0] : 'N/A';
                const genres = tv.genres ? tv.genres.map(g => g.name).join(', ') : 'N/A';
                const subUrl = await getSinhalaSubLink(tv.name);
                
                const trailerVideo = tv.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
                const trailerUrl = trailerVideo ? `https://www.youtube.com/watch?v=${trailerVideo.key}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(tv.name + ' trailer')}`;

                let inlineKeyboard = [
                    [{ text: "🚀 Server 1 (VidSrc PRO)", url: `https://vidsrc.pro/embed/tv/${tv.id}` }],
                    [{ text: "⚡ Server 2 (AutoEmbed)", url: `https://autoembed.co/tv/tmdb/${tv.id}-1-1` }],
                    [
                        { text: "🎬 Watch Trailer", url: trailerUrl },
                        { text: "📝 Sinhala Subs", url: subUrl }
                    ],
                    [{ text: "📺 Similar TV Shows (සමාන ඒවා)", callback_data: `tv_sim:${tvId}` }]
                ];

                const replyMessage = `📺 <b>${tv.name}</b> (${year})\n\n⭐ <b>Rating:</b> ${tv.vote_average?.toFixed(1) || 'N/A'}/10\n🎭 <b>Genres:</b> ${genres}\n\n📝 <b>Overview:</b> <i>${tv.overview || 'N/A'}</i>\n\n⚠️ <i>Ads නැතිව බලන්න Brave Browser එක පාවිච්චි කරන්න.</i> 🦁`;
                
                try { await bot.deleteMessage(chatId, msgId); } catch(e){}
                if (tv.poster_path) {
                    await bot.sendPhoto(chatId, `https://image.tmdb.org/t/p/w500${tv.poster_path}`, { caption: replyMessage, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                } else { 
                    await bot.sendMessage(chatId, replyMessage, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } }); 
                }
            }
        }
    } catch (e) { console.error("Webhook Error:", e); } finally { res.sendStatus(200); }
});

module.exports = app;
