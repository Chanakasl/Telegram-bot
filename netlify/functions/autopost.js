const { schedule } = require('@netlify/functions');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const CHANNEL_ID = process.env.CHANNEL_ID;

exports.handler = schedule("0 12 * * *", async (event) => {
    if (!CHANNEL_ID || !TELEGRAM_TOKEN || !TMDB_API_KEY) {
        console.error("Missing Environment Variables");
        return { statusCode: 400 };
    }

    const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

    try {
        for (let i = 0; i < 10; i++) {
            const randomPage = Math.floor(Math.random() * 20) + 1;
            const url = `https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}&language=en-US&page=${randomPage}`;
            const tmdbRes = await axios.get(url);
            
            const randomMovie = tmdbRes.data.results[Math.floor(Math.random() * tmdbRes.data.results.length)];
            const movieId = randomMovie.id;
            
            const vidUrl = `https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${TMDB_API_KEY}&language=en-US`;
            const vidRes = await axios.get(vidUrl);
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
            
            // Telegram API එක හිරවෙන්නේ නැති වෙන්න තත්පර 2ක් නවතිනවා
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        return { statusCode: 200 };
    } catch (err) {
        return { statusCode: 500 };
    }
});
