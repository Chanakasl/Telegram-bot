const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

const app = express();
app.use(express.json()); 

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN; 
const TMDB_API_KEY = process.env.TMDB_API_KEY; 

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

app.get('/', (req, res) => res.send('CHUCKY MOVIE ZONE Bot is Alive & Running!'));

app.post(`/bot${TELEGRAM_TOKEN}`, async (req, res) => {
    try {
        const body = req.body;
        
        if (body.message && body.message.text) {
            const msg = body.message;
            const chatId = msg.chat.id;
            const text = msg.text;

            // 1. Start & Help Commands (CHUCKY MOVIE ZONE Branding)
            if (text.startsWith('/start') || text.startsWith('/help')) {
                const welcomeText = `🎬 <b>Welcome to CHUCKY MOVIE ZONE!</b> 🍿\n\n` +
                                    `ලෝකේ තියෙන ඕනෑම Movie, TV Series එකක් හෝ Anime එකක් ලේසියෙන්ම හොයාගන්න!\n\n` +
                                    `<b>📌 Main Commands (ප්‍රධාන විධානයන්):</b>\n` +
                                    `🎥 <code>/movie [name]</code> - Search a Movie\n` +
                                    `📺 <code>/tv [name]</code> - Search a TV Series\n` +
                                    `⛩️ <code>/anime [name]</code> - Search Anime\n` +
                                    `🎭 <code>/actor [name]</code> - Search Actor/Actress\n\n` +
                                    `<b>🔥 Explore (ගවේෂණය කරන්න):</b>\n` +
                                    `📈 <code>/trending</code> - Today's Top Movies\n` +
                                    `🍿 <code>/upcoming</code> - Coming Soon...\n` +
                                    `🏆 <code>/imdb250</code> - Top Rated Masterpieces\n` +
                                    `🎲 <code>/random</code> - Random Movie Suggestion\n\n` +
                                    `<i>💡 Example: /movie Avatar</i>`;
                await bot.sendMessage(chatId, welcomeText, { parse_mode: 'HTML' });
            }

            // 2. Movie Search (/movie) - Added Watch Providers (OTT)
            else if (text.startsWith('/movie ')) {
                const movieName = text.replace('/movie ', '').trim();
                const searchingMsg = await bot.sendMessage(chatId, `🔍 <i>Searching for "${movieName}"...</i>`, { parse_mode: 'HTML' });

                try {
                    const tmdbSearchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(movieName)}&language=en-US`;
                    const tmdbSearchResponse = await axios.get(tmdbSearchUrl);
                    
                    if (tmdbSearchResponse.data.results.length > 0) {
                        const firstResult = tmdbSearchResponse.data.results[0];
                        
                        // Append watch/providers to get OTT Platforms
                        const tmdbDetailUrl = `https://api.themoviedb.org/3/movie/${firstResult.id}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=videos,credits,watch/providers`;
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

                        // Check for OTT Providers (US region as default)
                        const providers = movie['watch/providers']?.results?.US?.link;

                        let inlineKeyboard = [];
                        
                        if (imdbId) {
                            inlineKeyboard.push(
                                [{ text: "🚀 Watch Server 1", url: `https://vidsrc.to/embed/movie/${imdbId}` }],
                                [{ text: "⚡ Watch Server 2", url: `https://embed.su/embed/movie/${imdbId}` }]
                            );
                        } else {
                            inlineKeyboard.push([{ text: "🚀 Stream Server", url: `https://vidsrc.to/embed/movie/${movie.id}` }]);
                        }

                        inlineKeyboard.push([
                            { text: "🎬 Trailer", url: trailerUrl },
                            { text: "📝 Sinhala Subs", url: subUrl }
                        ]);
                        
                        let thirdRow = [];
                        if (imdbId) thirdRow.push({ text: "⭐ IMDb", url: `https://www.imdb.com/title/${imdbId}` });
                        if (providers) thirdRow.push({ text: "📺 Watch on OTT", url: providers });
                        
                        if(thirdRow.length > 0) inlineKeyboard.push(thirdRow);

                        const replyMessage = `🎬 <b>${movie.title}</b> (${releaseYear})\n\n` +
                                             `⭐ <b>Rating:</b> ${movie.vote_average.toFixed(1)}/10\n` +
                                             `⏳ <b>Runtime:</b> ${runtime}\n` +
                                             `🎭 <b>Genres:</b> ${genres}\n` +
                                             `👥 <b>Cast:</b> ${cast}\n\n` +
                                             `📝 <b>Overview:</b> <i>${movie.overview}</i>\n\n` +
                                             `⚡ <i>Powered by CHUCKY MOVIE ZONE</i>`;

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
                        await bot.editMessageText('❌ Movie not found! වෙනත් නමක් ලබාදෙන්න.', { chat_id: chatId, message_id: searchingMsg.message_id });
                    }
                } catch (error) {
                    await bot.editMessageText('⚠️ Server Error. කරුණාකර පසුව උත්සාහ කරන්න.', { chat_id: chatId, message_id: searchingMsg.message_id });
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
                        const year = tv.first_air_date ? tv.first_air_date.split('-')[0] : 'N/A';
                        
                        let inlineKeyboard = [
                            [{ text: "🚀 Watch Episodes", url: `https://vidsrc.to/embed/tv/${tv.id}` }],
                            [{ text: "📝 Sinhala Subs", url: `https://www.google.com/search?q=${encodeURIComponent(tv.name + ' tv series sinhala subtitles')}` }]
                        ];

                        const msgText = `📺 <b>${tv.name}</b> (${year})\n\n` +
                                        `⭐ <b>Rating:</b> ${tv.vote_average.toFixed(1)}/10\n` +
                                        `📝 <b>Overview:</b> <i>${tv.overview}</i>\n\n` +
                                        `⚡ <i>Powered by CHUCKY MOVIE ZONE</i>`;
                        
                        await bot.deleteMessage(chatId, searchingMsg.message_id);
                        if (tv.poster_path) {
                            await bot.sendPhoto(chatId, `https://image.tmdb.org/t/p/w500${tv.poster_path}`, { caption: msgText, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                        } else {
                            await bot.sendMessage(chatId, msgText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                        }
                    } else {
                        await bot.editMessageText('❌ Series not found!', { chat_id: chatId, message_id: searchingMsg.message_id });
                    }
                } catch (err) {
                    await bot.editMessageText('⚠️ API Error.', { chat_id: chatId, message_id: searchingMsg.message_id });
                }
            }

            // 4. Anime Search (/anime)
            else if (text.startsWith('/anime ')) {
                const animeName = text.replace('/anime ', '').trim();
                const searchingMsg = await bot.sendMessage(chatId, `⛩️ <i>Searching Anime "${animeName}"...</i>`, { parse_mode: 'HTML' });
                
                try {
                    const searchUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(animeName)}&with_genres=16`; // 16 = Animation
                    const resApi = await axios.get(searchUrl);
                    
                    if (resApi.data.results.length > 0) {
                        const anime = resApi.data.results[0];
                        
                        let inlineKeyboard = [
                            [{ text: "⛩️ Watch Anime", url: `https://vidsrc.to/embed/tv/${anime.id}` }],
                            [{ text: "📝 Subtitles", url: `https://www.google.com/search?q=${encodeURIComponent(anime.name + ' anime subtitles')}` }]
                        ];

                        const msgText = `⛩️ <b>${anime.name}</b>\n\n` +
                                        `⭐ <b>Rating:</b> ${anime.vote_average.toFixed(1)}/10\n` +
                                        `📝 <b>Overview:</b> <i>${anime.overview}</i>\n\n` +
                                        `⚡ <i>CHUCKY MOVIE ZONE</i>`;
                        
                        await bot.deleteMessage(chatId, searchingMsg.message_id);
                        if (anime.poster_path) {
                            await bot.sendPhoto(chatId, `https://image.tmdb.org/t/p/w500${anime.poster_path}`, { caption: msgText, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                        } else {
                            await bot.sendMessage(chatId, msgText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                        }
                    } else {
                        await bot.editMessageText('❌ Anime not found!', { chat_id: chatId, message_id: searchingMsg.message_id });
                    }
                } catch (err) {
                    await bot.editMessageText('⚠️ API Error.', { chat_id: chatId, message_id: searchingMsg.message_id });
                }
            }

            // 5. Actor Search (/actor)
            else if (text.startsWith('/actor ')) {
                const actorName = text.replace('/actor ', '').trim();
                const searchingMsg = await bot.sendMessage(chatId, `🎭 <i>Searching Actor "${actorName}"...</i>`, { parse_mode: 'HTML' });
                
                try {
                    const searchUrl = `https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(actorName)}`;
                    const resApi = await axios.get(searchUrl);
                    
                    if (resApi.data.results.length > 0) {
                        const actor = resApi.data.results[0];
                        
                        let msgText = `🎭 <b>${actor.name}</b>\n\n<b>🎬 Known For (ප්‍රසිද්ධ චිත්‍රපට):</b>\n`;
                        actor.known_for.forEach((m, i) => {
                            msgText += `${i + 1}. ${m.title || m.name}\n`;
                        });
                        msgText += `\n<i>(Type /movie [name] to watch these!)</i>`;
                        
                        await bot.deleteMessage(chatId, searchingMsg.message_id);
                        if (actor.profile_path) {
                            await bot.sendPhoto(chatId, `https://image.tmdb.org/t/p/w500${actor.profile_path}`, { caption: msgText, parse_mode: 'HTML' });
                        } else {
                            await bot.sendMessage(chatId, msgText, { parse_mode: 'HTML' });
                        }
                    } else {
                        await bot.editMessageText('❌ Actor not found!', { chat_id: chatId, message_id: searchingMsg.message_id });
                    }
                } catch (err) {
                    await bot.editMessageText('⚠️ API Error.', { chat_id: chatId, message_id: searchingMsg.message_id });
                }
            }

            // 6. Top Rated Masterpieces (/imdb250)
            else if (text === '/imdb250') {
                const tmdbUrl = `https://api.themoviedb.org/3/movie/top_rated?api_key=${TMDB_API_KEY}&language=en-US&page=1`;
                const resApi = await axios.get(tmdbUrl);
                
                // Shuffle and pick 5 random top rated movies
                const shuffled = resApi.data.results.sort(() => 0.5 - Math.random());
                const movies = shuffled.slice(0, 5);
                
                let imdbMsg = `🏆 <b>Top Rated Masterpieces (CHUCKY MOVIE ZONE):</b>\n\n`;
                movies.forEach((m, index) => {
                    imdbMsg += `${index + 1}. <b>${m.title}</b> (⭐ ${m.vote_average.toFixed(1)})\n`;
                });
                imdbMsg += `\n<i>(Type /movie [name] to watch!)</i>`;
                
                await bot.sendMessage(chatId, imdbMsg, { parse_mode: 'HTML' });
            }

            // 7. Trending & Upcoming & Random (As before but with Branding)
            else if (text === '/trending') {
                const tmdbUrl = `https://api.themoviedb.org/3/trending/movie/day?api_key=${TMDB_API_KEY}`;
                const resApi = await axios.get(tmdbUrl);
                const movies = resApi.data.results.slice(0, 5);
                
                let trendMsg = `🔥 <b>Today's Trending Movies:</b>\n\n`;
                movies.forEach((m, index) => {
                    trendMsg += `${index + 1}. <b>${m.title}</b> (${m.vote_average.toFixed(1)})\n`;
                });
                
                await bot.sendMessage(chatId, trendMsg, { parse_mode: 'HTML' });
            }
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
            else if (text === '/random') {
                const randomPage = Math.floor(Math.random() * 10) + 1;
                const tmdbUrl = `https://api.themoviedb.org/3/movie/top_rated?api_key=${TMDB_API_KEY}&language=en-US&page=${randomPage}`;
                const resApi = await axios.get(tmdbUrl);
                
                const randomMovieIndex = Math.floor(Math.random() * resApi.data.results.length);
                const movie = resApi.data.results[randomMovieIndex];
                
                await bot.sendMessage(chatId, `🎲 <b>Random Suggestion by CHUCKY MOVIE ZONE!</b>\n\nTry watching: <b>${movie.title}</b>\n\n(Type <code>/movie ${movie.title}</code> to get links!)`, { parse_mode: 'HTML' });
            }
        }
    } catch (e) {
        console.error("Webhook Error:", e);
    } finally {
        res.sendStatus(200);
    }
});

module.exports = app;
