const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

const app = express();
app.use(express.json()); 

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN; 
const TMDB_API_KEY = process.env.TMDB_API_KEY; 

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

app.get('/', (req, res) => res.send('Vercel Movie Bot is Alive!'));

// Webhook එකට මැසේජ් එන ප්‍රධාන Route එක
app.post(`/bot${TELEGRAM_TOKEN}`, async (req, res) => {
    try {
        const body = req.body;
        
        // මැසේජ් එකක් තියෙනවද සහ ඒකේ Text එකක් තියෙනවද කියලා බලනවා
        if (body.message && body.message.text) {
            const msg = body.message;
            const chatId = msg.chat.id;
            const text = msg.text;

            // ".movie" වලින් පටන් ගන්නවද බලනවා
            if (text.startsWith('.movie ')) {
                const movieName = text.replace('.movie ', '').trim();

                // 1. Searching මැසේජ් එක යවනවා
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

                        // 2. Inline Buttons
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

                        const replyMessage = `🎬 *${movie.title}* (${releaseYear})\n\n` +
                                             `⭐ *Rating:* ${movie.vote_average.toFixed(1)}/10\n` +
                                             `🌐 *Language:* ${movie.original_language.toUpperCase()}\n\n` +
                                             `📝 *Overview:* ${movie.overview}\n\n` +
                                             `-----------------------------------\n` +
                                             `📥 *Select a Server to Stream or Download:*`;

                        // කලින් යැවූ Searching මැසේජ් එක මකනවා
                        await bot.deleteMessage(chatId, searchingMsg.message_id);

                        // Poster එක සහ විස්තර යවනවා
                        if (movie.poster_path) {
                            const posterUrl = `https://image.tmdb.org/t/p/w500${movie.poster_path}`;
                            await bot.sendPhoto(chatId, posterUrl, { 
                                caption: replyMessage, 
                                parse_mode: 'Markdown',
                                reply_markup: { inline_keyboard: inlineKeyboard }
                            });
                        } else {
                            await bot.sendMessage(chatId, replyMessage, { 
                                parse_mode: 'Markdown',
                                reply_markup: { inline_keyboard: inlineKeyboard }
                            });
                        }

                    } else {
                        await bot.editMessageText('❌ සමාවෙන්න, ඔය නමින් ෆිල්ම් එකක් සොයාගන්න බැරි වුණා.', {
                            chat_id: chatId,
                            message_id: searchingMsg.message_id
                        });
                    }
                } catch (error) {
                    console.error("API Error:", error);
                    await bot.editMessageText('⚠️ සර්වර් එකේ පොඩි අවුලක් වුණා. TMDB API Key එක හරිද බලන්න.', {
                        chat_id: chatId,
                        message_id: searchingMsg.message_id
                    });
                }
            }
        }
    } catch (e) {
        console.error("Webhook Error:", e);
    } finally {
        // මේක අනිවාර්යයෙන්ම අන්තිමටම තමයි තියෙන්න ඕනේ. එතකොට Vercel එක මැසේජ් එක යවනකම් ඉන්නවා.
        res.sendStatus(200);
    }
});

module.exports = app;
