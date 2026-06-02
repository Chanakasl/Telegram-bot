const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

const app = express();
app.use(express.json()); 

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN; 
const TMDB_API_KEY = process.env.TMDB_API_KEY; 

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

app.get('/', (req, res) => res.send('Movie Bot V2.1 with Slash Commands is Alive!'));

app.post(`/bot${TELEGRAM_TOKEN}`, async (req, res) => {
    try {
        const body = req.body;
        
        if (body.message && body.message.text) {
            const msg = body.message;
            const chatId = msg.chat.id;
            const text = msg.text;

            // 1. Start & Help Commands
            if (text.startsWith('/start') || text.startsWith('/help')) {
                const welcomeText = `🎬 <b>Welcome to Premium Movie Bot!</b> 🍿\n\n` +
                                    `මම හරහා ඔයාට ලෝකේ ඕනෑම ෆිල්ම් එකක්, ටීවී සීරීස් එකක් හොයාගන්න පුළුවන්.\n\n` +
                                    `<b>උපදෙස් (Commands):</b>\n` +
                                    `🎥 <code>/movie [name]</code> - ෆිල්ම් එකක් හොයන්න\n` +
                                    `📺 <code>/tv [name]</code> - TV Series එකක් හොයන්න\n` +
                                    `🔥 <code>/trending</code> - දැනට ජනප්‍රියම දේවල්\n` +
                                    `🍿 <code>/upcoming</code> - ළඟදීම එන ෆිල්ම්ස්\n` +
                                    `🎲 <code>/random</code> - බලන්න පට්ට ෆිල්ම් එකක්\n\n` +
                                    `<i>උදාහරණ: /movie Avatar</i>`;
                await bot.sendMessage(chatId, welcomeText, { parse_mode: 'HTML' });
            }

            // 2. Movie Search (/movie)
            else if (text.startsWith('/movie ')) {
                const movieName = text.replace('/movie ', '').trim();
                const searchingMsg = await bot.sendMessage(chatId, `🔍 <i>Searching for "${movieName}"... Please wait...</i>`, { parse_mode: 'HTML' });

                try {
                    const tmdbSearchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(movieName)}&language=en-US`;
                    const tmdbSearchResponse = await axios.get(tmdbSearchUrl);
                    
                    if (tmdbSearchResponse.data.results.length > 0) {
                        const firstResult = tmdbSearchResponse.data.results[0];
                        
                        const tmdbDetailUrl = `https://api.themoviedb.org/3/movie/${firstResult.id}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=videos,credits`;
                        const tmdbDetailResponse = await axios.get(tmdbDetailUrl);
                        const movie = tmdbDetailResponse.data;
                        
                        const releaseYear = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
                        const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : 'N/A';
                        const genres = movie.genres ? movie.genres.map(g => g.name).join(', ') : 'N/A';
                        const cast = movie.credits.cast ? movie.credits.cast.slice(0, 3).map(c => c.name).join(', ') : 'N/A';
                        const imdbId = movie.imdb_id;
                        
                        const trailer = movie.videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
                        const trailerUrl = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + ' trailer')}`;
                        
                        const subUrl = `https://www.google.com/search?q=${encodeURIComponent(movie.title + ' sinhala subtitles baiscope zoom.lk')}`;

                        let inlineKeyboard = [];
                        
                        if (imdbId) {
                            inlineKeyboard.push(
                                [{ text: "🚀 Server 1 (Multi-Quality)", url: `https://vidsrc.to/embed/movie/${imdbId}` }],
                                [{ text: "⚡ Server 2 (High Speed)", url: `https://embed.su/embed/movie/${imdbId}` }]
                            );
                        } else {
                            inlineKeyboard.push([{ text: "🚀 Stream Server", url: `https://vidsrc.to/embed/movie/${movie.id}` }]);
                        }

                        inlineKeyboard.push([
                            { text: "🎬 Trailer", url: trailerUrl },
                            { text: "📝 Sinhala Subs", url: subUrl }
                        ]);
                        if (imdbId) inlineKeyboard.push([{ text: "⭐ View on IMDb", url: `https://www.imdb.com/title/${imdbId}` }]);

                        const replyMessage = `🎬 <b>${movie.title}</b> (${releaseYear})\n\n` +
                                             `⭐ <b>Rating:</b> ${movie.vote_average.toFixed(1)}/10\n` +
                                             `⏳ <b>Runtime:</b> ${runtime}\n` +
                                             `🎭 <b>Genres:</b> ${genres}\n` +
                                             `👥 <b>Cast:</b> ${cast}\n\n` +
                                             `📝 <b>Overview:</b> <i>${movie.overview}</i>\n\n` +
                                             `📥 <b>Select an option below:</b>`;

                        await bot.deleteMessage(chatId, searchingMsg.message_id);

                        if (movie.poster_path) {
                            await bot.sendPhoto(chatId, `https://image.tmdb.org/t/p/w500${movie.poster_path}`, { 
                                caption: replyMessage, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard }
                            });
                        } else {
                            await bot.sendMessage(chatId, replyMessage, { 
                                parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard }
                            });
                        }
                    } else {
                        await bot.editMessageText('❌ සමාවෙන්න, ෆිල්ම් එකක් සොයාගන්න බැරි වුණා.', { chat_id: chatId, message_id: searchingMsg.message_id });
                    }
                } catch (error) {
                    await bot.editMessageText('⚠️ සර්වර් එකේ දෝෂයක්. පසුව උත්සාහ කරන්න.', { chat_id: chatId, message_id: searchingMsg.message_id });
                }
            }

            // 3. TV Series Search (/tv)
            else if (text.startsWith('/tv ')) {
                const tvName = text.replace('/tv ', '').trim();
                const searchingMsg = await bot.sendMessage(chatId, `🔍 <i>Searching TV Series "${tvName}"...</i>`, { parse_mode: 'HTML' });
                
                try {
                    const searchUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(tvName)}&language=en-US`;
                    const resApi = await axios.get(searchUrl);
                    
                    if (resApi.data.results.length > 0) {
                        const tv = resApi.data.results[0];
                        const tvId = tv.id;
                        const year = tv.first_air_date ? tv.first_air_date.split('-')[0] : 'N/A';
                        
                        let inlineKeyboard = [
                            [{ text: "🚀 Watch Episodes", url: `https://vidsrc.to/embed/tv/${tvId}` }],
                            [{ text: "📝 Sinhala Subs", url: `https://www.google.com/search?q=${encodeURIComponent(tv.name + ' tv series sinhala subtitles')}` }]
                        ];

                        const msgText = `📺 <b>${tv.name}</b> (${year})\n\n` +
                                        `⭐ <b>Rating:</b> ${tv.vote_average.toFixed(1)}/10\n` +
                                        `📝 <b>Overview:</b> <i>${tv.overview}</i>`;
                        
                        await bot.deleteMessage(chatId, searchingMsg.message_id);
                        if (tv.poster_path) {
                            await bot.sendPhoto(chatId, `https://image.tmdb.org/t/p/w500${tv.poster_path}`, { caption: msgText, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                        } else {
                            await bot.sendMessage(chatId, msgText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                        }
                    } else {
                        await bot.editMessageText('❌ සමාවෙන්න, TV Series එක සොයාගන්න බැහැ.', { chat_id: chatId, message_id: searchingMsg.message_id });
                    }
                } catch (err) {
                    await bot.editMessageText('⚠️ API දෝෂයක්.', { chat_id: chatId, message_id: searchingMsg.message_id });
                }
            }

            // 4. Trending Movies (/trending)
            else if (text === '/trending') {
                const tmdbUrl = `https://api.themoviedb.org/3/trending/movie/day?api_key=${TMDB_API_KEY}`;
                const resApi = await axios.get(tmdbUrl);
                const movies = resApi.data.results.slice(0, 5);
                
                let trendMsg = `🔥 <b>Today's Trending Movies:</b>\n\n`;
                movies.forEach((m, index) => {
                    trendMsg += `${index + 1}. <b>${m.title}</b> (${m.vote_average.toFixed(1)}/10)\n`;
                });
                trendMsg += `\n<i>(Type /movie [name] to watch them!)</i>`;
                
                await bot.sendMessage(chatId, trendMsg, { parse_mode: 'HTML' });
            }

            // 5. Upcoming Movies (/upcoming)
            else if (text === '/upcoming') {
                const tmdbUrl = `https://api.themoviedb.org/3/movie/upcoming?api_key=${TMDB_API_KEY}&language=en-US&page=1`;
                const resApi = await axios.get(tmdbUrl);
                const movies = resApi.data.results.slice(0, 5);
                
                let upMsg = `🍿 <b>Upcoming Movies:</b>\n\n`;
                movies.forEach((m, index) => {
                    upMsg += `${index + 1}. <b>${m.title}</b> (${m.release_date})\n`;
                });
                
                await bot.sendMessage(chatId, upMsg, { parse_mode: 'HTML' });
            }

            // 6. Random Movie (/random)
            else if (text === '/random') {
                const randomPage = Math.floor(Math.random() * 10) + 1;
                const tmdbUrl = `https://api.themoviedb.org/3/movie/top_rated?api_key=${TMDB_API_KEY}&language=en-US&page=${randomPage}`;
                const resApi = await axios.get(tmdbUrl);
                
                const randomMovieIndex = Math.floor(Math.random() * resApi.data.results.length);
                const movie = resApi.data.results[randomMovieIndex];
                
                await bot.sendMessage(chatId, `🎲 <b>Random Suggestion!</b>\n\nTry watching: <b>${movie.title}</b>\n(Type <code>/movie ${movie.title}</code> to get links!)`, { parse_mode: 'HTML' });
            }
        }
    } catch (e) {
        console.error("Webhook Error:", e);
    } finally {
        res.sendStatus(200);
    }
});

module.exports = app;
