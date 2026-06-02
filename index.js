const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

const app = express();
app.use(express.json()); 

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN; 
const TMDB_API_KEY = process.env.TMDB_API_KEY; 

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

app.post(`/bot${TELEGRAM_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

app.get('/', (req, res) => res.send('Bot is Alive with Premium Features!'));

module.exports = app;

// --- Premium Bot Logic ---
bot.onText(/\.movie (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const movieName = match[1].trim();

    // 1. Searching... මැසේජ් එකක් මුලින්ම යවනවා (User Experience එක වැඩි කරන්න)
    const searchingMsg = await bot.sendMessage(chatId, `🔍 *Searching for "${movieName}"... Please wait...*`, { parse_mode: 'Markdown' });

    try {
        const tmdbSearchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(movieName)}&language=en-US`;
        const tmdbSearchResponse = await axios.get(tmdbSearchUrl);
        
        if (tmdbSearchResponse.data.results.length > 0) {
            const firstResult = tmdbSearchResponse.data.results[0];
            
            const tmdbDetailUrl = `https://api.themoviedb.org/3/movie/${firstResult.id}?api_key=${TMDB_API_KEY}&language=en-US`;
            const tmdbDetailResponse = await axios.get(tmdbDetailUrl);
            const movie = tmdbDetailResponse.data;
            
            const releaseYear = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
            const imdbId = movie.imdb_id;
            const tmdbId = movie.id;

            // 2. ලස්සන Inline Buttons සාදාගැනීම
            let inlineKeyboard = [];

            if (imdbId) {
                inlineKeyboard = [
                    [{ text: "🚀 Server 1 (Multi-Quality)", url: `https://vidsrc.to/embed/movie/${imdbId}` }],
                    [{ text: "⚡ Server 2 (High Speed)", url: `https://embed.su/embed/movie/${imdbId}` }],
                    [{ text: "🌐 Server 3 (Backup)", url: `https://vidsrc.me/embed/movie?imdb=${imdbId}` }]
                ];
            } else {
                inlineKeyboard = [
                    [{ text: "🚀 Server 1 (Watch/Download)", url: `https://vidsrc.to/embed/movie/${tmdbId}` }]
                ];
            }

            // මැසේජ් එක Format කිරීම
            const replyMessage = `🎬 *${movie.title}* (${releaseYear})\n\n` +
                                 `⭐ *Rating:* ${movie.vote_average.toFixed(1)}/10\n` +
                                 `🌐 *Language:* ${movie.original_language.toUpperCase()}\n\n` +
                                 `📝 *Overview:* ${movie.overview}\n\n` +
                                 `-----------------------------------\n` +
                                 `📥 *Select a Server to Stream or Download:* \n` +
                                 `⏱️ _Note: This message will auto-delete in 5 minutes for copyright protection!_`;

            // කලින් යවපු "Searching..." මැසේජ් එක Delete කරනවා
            await bot.deleteMessage(chatId, searchingMsg.message_id);

            let sentMessage;

            // Poster එකත් එක්ක Buttons සහ විස්තර යවනවා
            if (movie.poster_path) {
                const posterUrl = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
                sentMessage = await bot.sendPhoto(chatId, posterUrl, { 
                    caption: replyMessage, 
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: inlineKeyboard }
                });
            } else {
                sentMessage = await bot.sendMessage(chatId, replyMessage, { 
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: inlineKeyboard }
                });
            }

            // 3. Auto-Delete Feature (විනාඩි 5කින් මැසේජ් එක Delete වෙන්න සැකසීම)
            // මිලිසෙකන්ඩ් 300000 කියන්නේ විනාඩි 5ක් (1000 * 60 * 5)
            setTimeout(async () => {
                try {
                    await bot.deleteMessage(chatId, sentMessage.message_id);
                    console.log(`Message ${sentMessage.message_id} auto-deleted successfully.`);
                } catch (delError) {
                    console.error("Failed to auto-delete message:", delError.message);
                }
            }, 300000); 

        } else {
            // සර්ච් කරපු එක නැතිනම් "Searching..." මැසේජ් එක Edit කරනවා
            await bot.editMessageText('❌ සමාවෙන්න, ඔය නමින් ෆිල්ම් එකක් සොයාගන්න බැරි වුණා.', {
                chat_id: chatId,
                message_id: searchingMsg.message_id
            });
        }
    } catch (error) {
        console.error(error);
        // Error එකක් ආවොත් "Searching..." මැසේජ් එක Edit කරනවා
        await bot.editMessageText('⚠️ සර්වර් එකේ පොඩි අවුලක් වුණා. පසුව උත්සාහ කරන්න.', {
            chat_id: chatId,
            message_id: searchingMsg.message_id
        });
    }
});
