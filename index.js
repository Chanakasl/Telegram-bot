const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json()); 

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN; 
const TMDB_API_KEY = process.env.TMDB_API_KEY; 
const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_ID = process.env.ADMIN_ID;

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

// MongoDB Connection & Schema
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("MongoDB Connected!"))
    .catch(err => console.log(err));

const userSchema = new mongoose.Schema({
    chatId: { type: Number, unique: true },
    firstName: String,
    watchlist: [{ tmdbId: String, title: String, type: String }] // type = 'movie' or 'tv'
});
const User = mongoose.model('User', userSchema);

app.get('/', (req, res) => res.send('CHUCKY MOVIE ZONE V4 (Ultimate) is Running!'));

app.post(`/bot${TELEGRAM_TOKEN}`, async (req, res) => {
    try {
        const body = req.body;
        
        if (body.message && body.message.text) {
            const msg = body.message;
            const chatId = msg.chat.id;
            const text = msg.text;

            // User Registration in DB
            let dbUser = await User.findOne({ chatId: chatId });
            if (!dbUser) {
                dbUser = new User({ chatId: chatId, firstName: msg.chat.first_name });
                await dbUser.save();
                // Notify Admin about new user
                if (ADMIN_ID) bot.sendMessage(ADMIN_ID, `🔔 New User Joined: ${msg.chat.first_name}`);
            }

            // 1. ADMIN COMMANDS 👑
            if (chatId.toString() === ADMIN_ID) {
                if (text === '/stats') {
                    const userCount = await User.countDocuments();
                    return bot.sendMessage(chatId, `📊 <b>Admin Stats:</b>\n\nTotal Users: <b>${userCount}</b>`, { parse_mode: 'HTML' });
                }
                if (text.startsWith('/broadcast ')) {
                    const bMsg = text.replace('/broadcast ', '');
                    const users = await User.find({});
                    let sent = 0;
                    for (let u of users) {
                        try {
                            await bot.sendMessage(u.chatId, `📢 <b>Admin Announcement:</b>\n\n${bMsg}`, { parse_mode: 'HTML' });
                            sent++;
                        } catch (e) {} // Ignore blocked bots
                    }
                    return bot.sendMessage(chatId, `✅ Broadcast sent to ${sent} users.`);
                }
            }

            // 2. WATCHLIST COMMAND ❤️
            if (text === '/watchlist') {
                if (dbUser.watchlist.length === 0) return bot.sendMessage(chatId, "ඔයාගේ Watchlist එක හිස්! ෆිල්ම් සර්ච් කරලා '❤️ Add to Watchlist' ඔබන්න.");
                
                let wlMsg = `❤️ <b>ඔයාගේ Watchlist එක:</b>\n\n`;
                let inlineKeyboard = [];
                
                dbUser.watchlist.forEach((item, index) => {
                    wlMsg += `${index + 1}. ${item.title}\n`;
                    let prefix = item.type === 'movie' ? 'mov_det' : 'tv_det';
                    inlineKeyboard.push([{ text: `▶️ Play: ${item.title}`, callback_data: `${prefix}:${item.tmdbId}` }]);
                });
                
                return bot.sendMessage(chatId, wlMsg, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
            }

            // 3. START COMMAND
            if (text.startsWith('/start') || text.startsWith('/help')) {
                const welcomeText = `🎬 <b>Welcome to CHUCKY MOVIE ZONE!</b> 🍿\n\n` +
                                    `<b>📌 Main Commands:</b>\n` +
                                    `🎥 <code>/movie [name]</code> - Search a Movie\n` +
                                    `📺 <code>/tv [name]</code> - Search a TV Series\n` +
                                    `❤️ <code>/watchlist</code> - Your saved movies\n\n` +
                                    `<b>🔥 Explore:</b>\n` +
                                    `📈 <code>/trending</code> - Today's Top Movies\n` +
                                    `🏆 <code>/imdb250</code> - Top Rated Masterpieces\n` +
                                    `🎲 <code>/random</code> - Random Suggestion\n`;
                return bot.sendMessage(chatId, welcomeText, { parse_mode: 'HTML' });
            }

            // 4. MOVIE SEARCH (WITH PAGINATION) ⬅️ ➡️
            if (text.startsWith('/movie ')) {
                const movieName = text.replace('/movie ', '').trim();
                await sendPaginatedResults(chatId, movieName, 1, 'movie', bot, TMDB_API_KEY);
            }
            // 5. TV SEARCH (WITH PAGINATION)
            else if (text.startsWith('/tv ')) {
                const tvName = text.replace('/tv ', '').trim();
                await sendPaginatedResults(chatId, tvName, 1, 'tv', bot, TMDB_API_KEY);
            }
        }

        // ---- CALLBACK QUERIES (BUTTON CLICKS) ----
        else if (body.callback_query) {
            const cb = body.callback_query;
            const chatId = cb.message.chat.id;
            const msgId = cb.message.message_id;
            const data = cb.data;

            // Pagination Buttons (Next / Prev)
            if (data.startsWith('page:')) {
                const parts = data.split(':'); // page:movie:2:batman
                const type = parts[1];
                const page = parseInt(parts[2]);
                const query = parts[3];
                
                await bot.answerCallbackQuery(cb.id);
                await bot.deleteMessage(chatId, msgId);
                await sendPaginatedResults(chatId, query, page, type, bot, TMDB_API_KEY);
            }

            // Add to Watchlist
            else if (data.startsWith('addwl:')) {
                const parts = data.split(':'); // addwl:movie:12345:Title
                const type = parts[1];
                const tmdbId = parts[2];
                const title = parts.slice(3).join(':'); // If title has colons

                let dbUser = await User.findOne({ chatId: chatId });
                const exists = dbUser.watchlist.find(w => w.tmdbId === tmdbId);
                
                if (exists) {
                    await bot.answerCallbackQuery(cb.id, { text: "⚠️ මේක කලින්ම Watchlist එකේ තියෙනවා!", show_alert: true });
                } else {
                    dbUser.watchlist.push({ tmdbId, title, type });
                    await dbUser.save();
                    await bot.answerCallbackQuery(cb.id, { text: "❤️ Watchlist එකට සාර්ථකව එකතු කළා!", show_alert: true });
                }
            }

            // Movie Detail Clicked
            else if (data.startsWith('mov_det:')) {
                await bot.answerCallbackQuery(cb.id);
                const tmdbId = data.split(':')[1];
                const detailUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;
                const resApi = await axios.get(detailUrl);
                const movie = resApi.data;

                const releaseYear = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
                const imdbId = movie.imdb_id;
                
                let inlineKeyboard = [];
                if (imdbId) inlineKeyboard.push([{ text: "🚀 Watch Server 1", url: `https://vidsrc.to/embed/movie/${imdbId}` }]);
                
                // Add to Watchlist Button
                inlineKeyboard.push([{ text: "❤️ Add to Watchlist", callback_data: `addwl:movie:${movie.id}:${movie.title}` }]);

                const replyMessage = `🎬 <b>${movie.title}</b> (${releaseYear})\n⭐ <b>Rating:</b> ${movie.vote_average.toFixed(1)}/10\n\n⚡ <i>CHUCKY MOVIE ZONE PRO</i>`;

                await bot.deleteMessage(chatId, msgId);
                if (movie.poster_path) {
                    await bot.sendPhoto(chatId, `https://image.tmdb.org/t/p/w500${movie.poster_path}`, { caption: replyMessage, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                } else {
                    await bot.sendMessage(chatId, replyMessage, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                }
            }
        }
    } catch (e) {
        console.error("Webhook Error:", e);
    } finally {
        res.sendStatus(200);
    }
});

// Helper Function for Pagination
async function sendPaginatedResults(chatId, query, page, type, bot, apiKey) {
    const searchUrl = `https://api.themoviedb.org/3/search/${type}?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=en-US&page=1`;
    const resApi = await axios.get(searchUrl);
    
    // Split 20 results into pages of 5
    const limit = 5;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const results = resApi.data.results.slice(startIndex, endIndex);
    const totalPages = Math.ceil(resApi.data.results.length / limit);

    if (results.length > 0) {
        let inlineKeyboard = [];
        results.forEach(item => {
            const title = type === 'movie' ? item.title : item.name;
            const year = (item.release_date || item.first_air_date || '').split('-')[0] || 'N/A';
            inlineKeyboard.push([{ text: `🎬 ${title} (${year})`, callback_data: type === 'movie' ? `mov_det:${item.id}` : `tv_det:${item.id}` }]);
        });

        // Pagination Buttons
        let navButtons = [];
        if (page > 1) navButtons.push({ text: "⬅️ Prev", callback_data: `page:${type}:${page - 1}:${query.substring(0, 20)}` });
        if (page < totalPages) navButtons.push({ text: "Next ➡️", callback_data: `page:${type}:${page + 1}:${query.substring(0, 20)}` });
        if (navButtons.length > 0) inlineKeyboard.push(navButtons);

        await bot.sendMessage(chatId, `🍿 <b>CHUCKY MOVIE ZONE</b>\n\n<i>"${query}" - Page ${page}/${totalPages}</i>`, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: inlineKeyboard }
        });
    } else {
        await bot.sendMessage(chatId, `❌ "${query}" සඳහා ප්‍රතිඵල නැත.`);
    }
}

module.exports = app;
