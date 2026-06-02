const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// ඔයාගේ Tokens මෙතනට දාන්න
const TELEGRAM_TOKEN = '8912463850:AAGXrU9SfrWYDwO5L0zIT_Y0cwYj7_IhxI0'; 
const TMDB_API_KEY = '521ee6538048f5e2c17866baf3433154'; // <--- TMDB Key එක මෙතනට දාන්න

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

console.log('නියමයි! Telegram Bot දැන් වැඩ කරන්න ලෑස්තියයි.');

bot.onText(/\.movie (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const movieName = match[1].trim();

    try {
        // 1. TMDB API එකෙන් විස්තර ගන්නවා
        const tmdbUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(movieName)}&language=en-US`;
        const tmdbResponse = await axios.get(tmdbUrl);
        
        if (tmdbResponse.data.results.length > 0) {
            const movie = tmdbResponse.data.results[0];
            const releaseYear = movie.release_date ? movie.release_date.split('-')[0] : '';

            // 2. YTS API එකෙන් Download Links හොයනවා
            let downloadLinksText = "📥 *Download Links:* \n_ලින්ක්ස් සොයාගත නොහැකි විය_";
            try {
                const ytsUrl = `https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(movie.title)}`;
                const ytsResponse = await axios.get(ytsUrl);
                
                if (ytsResponse.data.data.movie_count > 0) {
                    const ytsMovie = ytsResponse.data.data.movies.find(m => m.year == releaseYear) || ytsResponse.data.data.movies[0];
                    
                    if (ytsMovie && ytsMovie.torrents) {
                        downloadLinksText = "📥 *Download Links (Torrents):* \n";
                        ytsMovie.torrents.forEach(torrent => {
                            downloadLinksText += `🔗 *${torrent.quality} (${torrent.type.toUpperCase()})* - ${torrent.size}\n👉 ${torrent.url}\n\n`;
                        });
                    }
                }
            } catch (ytsError) {
                console.log("YTS ලින්ක්ස් සෙවීමේදී දෝෂයක්:", ytsError.message);
            }

            // 3. මැසේජ් එක ලස්සනට හදාගන්නවා
            const replyMessage = `🎬 *${movie.title}* (${releaseYear || 'N/A'})\n\n` +
                                 `⭐ *Rating:* ${movie.vote_average}/10\n` +
                                 `🌐 *Language:* ${movie.original_language.toUpperCase()}\n\n` +
                                 `📝 *Overview:* ${movie.overview}\n\n` +
                                 `${downloadLinksText}` +
                                 `💡 _Powered by TMDB & YTS_`;
            
            // Poster එකත් එක්ක රිප්ලයි කරනවා
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
