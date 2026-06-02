const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

const app = express();
app.use(express.json()); 

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN; 
const TMDB_API_KEY = process.env.TMDB_API_KEY; 

// Polling false කල යුතුය (Serverless නිසා)
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

// Webhook Route එක
app.post(`/bot${TELEGRAM_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

app.get('/', (req, res) => res.send('Bot is Alive!'));

module.exports = app;

// --- Bot Logic ---
bot.onText(/\.movie (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const movieName = match[1].trim();

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

            let downloadLinksText = "📥 *Direct Download & Stream Servers:* \n\n";
            
            if (imdbId) {
                downloadLinksText += `🚀 *Server 1 (Multi-Quality):* \n🔗 [Watch / Download Here](https://vidsrc.to/embed/movie/${imdbId})\n\n`;
                downloadLinksText += `⚡ *Server 2 (High Speed):* \n🔗 [Watch / Download Here](https://embed.su/embed/movie/${imdbId})\n\n`;
                downloadLinksText += `🌐 *Server 3 (Backup Server):* \n🔗 [Watch / Download Here](https://vidsrc.me/embed/movie?imdb=${imdbId})\n\n`;
            } else {
                downloadLinksText += `🚀 *Server 1:* \n🔗 [Watch / Download Here](https://vidsrc.to/embed/movie/${tmdbId})\n\n`;
            }

            const replyMessage = `🎬 *${movie.title}* (${releaseYear})\n\n` +
                                 `⭐ *Rating:* ${movie.vote_average.toFixed(1)}/10\n` +
                                 `🌐 *Language:* ${movie.original_language.toUpperCase()}\n\n` +
                                 `📝 *Overview:* ${movie.overview}\n\n` +
                                 `-----------------------------------\n` +
                                 `${downloadLinksText}` +
                                 `💡 _Tip: Open links in Chrome browser to play or download the movie file directly._`;
            
            if (movie.poster_path) {
                const posterUrl = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
                await bot.sendPhoto(chatId, posterUrl, { caption: replyMessage, parse_mode: 'Markdown' });
            } else {
                await bot.sendMessage(chatId, replyMessage, { parse_mode: 'Markdown' });
            }
        } else {
            await bot.sendMessage(chatId, '❌ සමාවෙන්න, ඔය නමින් ෆිල්ම් එකක් සොයාගන්න බැරි වුණා.');
        }
    } catch (error) {
        console.error(error);
        await bot.sendMessage(chatId, '⚠️ සර්වර් එකේ පොඩි අවුලක් වුණා. පසුව උත්සාහ කරන්න.');
    }
});
