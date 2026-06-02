const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');

const app = express();
app.use(express.json()); 

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN; 
const TMDB_API_KEY = process.env.TMDB_API_KEY; 

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

app.get('/', (req, res) => res.send('CHUCKY MOVIE ZONE Pro is Alive & Running!'));

app.post(`/bot${TELEGRAM_TOKEN}`, async (req, res) => {
    try {
        const body = req.body;
        
        // ---- 1. TEXT COMMANDS HANDLING ----
        if (body.message && body.message.text) {
            const msg = body.message;
            const chatId = msg.chat.id;
            const text = msg.text;

            // Start & Help Command
            if (text.startsWith('/start') || text.startsWith('/help')) {
                const welcomeText = `🎬 <b>Welcome to CHUCKY MOVIE ZONE!</b> 🍿\n\n` +
                                    `ලෝකේ තියෙන ඕනෑම Movie, TV Series හෝ Anime එකක් ලේසියෙන්ම සොයාගන්න!\n\n` +
                                    `<b>📌 Main Commands:</b>\n` +
                                    `🎥 <code>/movie [name]</code> - Search a Movie\n` +
                                    `📺 <code>/tv [name]</code> - Search a TV Series\n` +
                                    `⛩️ <code>/anime [name]</code> - Search Anime\n` +
                                    `🎭 <code>/actor [name]</code> - Search Actor/Actress\n\n` +
                                    `<b>🔥 Explore:</b>\n` +
                                    `📈 <code>/trending</code> - Today's Top Movies\n` +
                                    `🍿 <code>/upcoming</code> - Coming Soon Movies\n` +
                                    `🏆 <code>/imdb250</code> - Top Rated Masterpieces\n` +
                                    `🎲 <code>/random</code> - Random Suggestion\n\n` +
                                    `<i>💡 Example: /movie Avengers</i>`;
                await bot.sendMessage(chatId, welcomeText, { parse_mode: 'HTML' });
            }

            // Movie Search
            else if (text.startsWith('/movie ')) {
                const movieName = text.replace('/movie ', '').trim();
                const searchingMsg = await bot.sendMessage(chatId, `🔍 <i>Searching for "${movieName}"...</i>`, { parse_mode: 'HTML' });

                try {
                    const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(movieName)}&language=en-US`;
                    const resApi = await axios.get(searchUrl);
                    const results = resApi.data.results.slice(0, 5);

                    if (results.length > 0) {
                        let inlineKeyboard = [];
                        results.forEach(movie => {
                            const year = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
                            inlineKeyboard.push([{ text: `🎬 ${movie.title} (${year})`, callback_data: `mov_det:${movie.id}` }]);
                        });

                        await bot.deleteMessage(chatId, searchingMsg.message_id);
                        await bot.sendMessage(chatId, `🍿 <b>CHUCKY MOVIE ZONE</b>\n\n<i>"${movieName}" සඳහා ගැලපෙන ප්‍රතිඵල මෙන්න. ඔයාට අවශ්‍ය එක ක්ලික් කරන්න:</i>`, {
                            parse_mode: 'HTML',
                            reply_markup: { inline_keyboard: inlineKeyboard }
                        });
                    } else {
                        await bot.editMessageText('❌ Movie not found! වෙනත් නමක් උත්සාහ කරන්න.', { chat_id: chatId, message_id: searchingMsg.message_id });
                    }
                } catch (err) {
                    await bot.editMessageText('⚠️ Server Error.', { chat_id: chatId, message_id: searchingMsg.message_id });
                }
            }

            // TV Series Search
            else if (text.startsWith('/tv ')) {
                const tvName = text.replace('/tv ', '').trim();
                const searchingMsg = await bot.sendMessage(chatId, `🔍 <i>Searching TV Series "${tvName}"...</i>`, { parse_mode: 'HTML' });
                
                try {
                    const searchUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(tvName)}&language=en-US`;
                    const resApi = await axios.get(searchUrl);
                    const results = resApi.data.results.slice(0, 5);

                    if (results.length > 0) {
                        let inlineKeyboard = [];
                        results.forEach(tv => {
                            const year = tv.first_air_date ? tv.first_air_date.split('-')[0] : 'N/A';
                            inlineKeyboard.push([{ text: `📺 ${tv.name} (${year})`, callback_data: `tv_det:${tv.id}` }]);
                        });

                        await bot.deleteMessage(chatId, searchingMsg.message_id);
                        await bot.sendMessage(chatId, `🍿 <b>CHUCKY MOVIE ZONE</b>\n\n<i>"${tvName}" සඳහා ගැලපෙන TV Series මෙන්න:</i>`, {
                            parse_mode: 'HTML',
                            reply_markup: { inline_keyboard: inlineKeyboard }
                        });
                    } else {
                        await bot.editMessageText('❌ TV Series not found!', { chat_id: chatId, message_id: searchingMsg.message_id });
                    }
                } catch (err) {
                    await bot.editMessageText('⚠️ Server Error.', { chat_id: chatId, message_id: searchingMsg.message_id });
                }
            }

            // Anime Search
            else if (text.startsWith('/anime ')) {
                const animeName = text.replace('/anime ', '').trim();
                const searchingMsg = await bot.sendMessage(chatId, `⛩️ <i>Searching Anime "${animeName}"...</i>`, { parse_mode: 'HTML' });
                
                try {
                    const searchUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(animeName)}&with_genres=16`;
                    const resApi = await axios.get(searchUrl);
                    const results = resApi.data.results.slice(0, 5);

                    if (results.length > 0) {
                        let inlineKeyboard = [];
                        results.forEach(anime => {
                            const year = anime.first_air_date ? anime.first_air_date.split('-')[0] : 'N/A';
                            inlineKeyboard.push([{ text: `⛩️ ${anime.name} (${year})`, callback_data: `ani_det:${anime.id}` }]);
                        });

                        await bot.deleteMessage(chatId, searchingMsg.message_id);
                        await bot.sendMessage(chatId, `🍿 <b>CHUCKY MOVIE ZONE</b>\n\n<i>"${animeName}" සඳහා ගැලපෙන Anime මෙන්න:</i>`, {
                            parse_mode: 'HTML',
                            reply_markup: { inline_keyboard: inlineKeyboard }
                        });
                    } else {
                        await bot.editMessageText('❌ Anime not found!', { chat_id: chatId, message_id: searchingMsg.message_id });
                    }
                } catch (err) {
                    await bot.editMessageText('⚠️ Server Error.', { chat_id: chatId, message_id: searchingMsg.message_id });
                }
            }

            // Actor Search
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
                    await bot.editMessageText('⚠️ Server Error.', { chat_id: chatId, message_id: searchingMsg.message_id });
                }
            }

            // Other Static Commands
            else if (text === '/imdb250') {
                const tmdbUrl = `https://api.themoviedb.org/3/movie/top_rated?api_key=${TMDB_API_KEY}&language=en-US&page=1`;
                const resApi = await axios.get(tmdbUrl);
                const shuffled = resApi.data.results.sort(() => 0.5 - Math.random());
                let imdbMsg = `🏆 <b>Top Rated Masterpieces (CHUCKY MOVIE ZONE):</b>\n\n`;
                shuffled.slice(0, 5).forEach((m, index) => { imdbMsg += `${index + 1}. <b>${m.title}</b> (⭐ ${m.vote_average.toFixed(1)})\n`; });
                await bot.sendMessage(chatId, imdbMsg, { parse_mode: 'HTML' });
            }
            else if (text === '/trending') {
                const tmdbUrl = `https://api.themoviedb.org/3/trending/movie/day?api_key=${TMDB_API_KEY}`;
                const resApi = await axios.get(tmdbUrl);
                let trendMsg = `🔥 <b>Today's Trending Movies:</b>\n\n`;
                resApi.data.results.slice(0, 5).forEach((m, index) => { trendMsg += `${index + 1}. <b>${m.title}</b> (${m.vote_average.toFixed(1)})\n`; });
                await bot.sendMessage(chatId, trendMsg, { parse_mode: 'HTML' });
            }
            else if (text === '/upcoming') {
                const tmdbUrl = `https://api.themoviedb.org/3/movie/upcoming?api_key=${TMDB_API_KEY}&language=en-US&page=1`;
                const resApi = await axios.get(tmdbUrl);
                let upMsg = `🍿 <b>Upcoming Movies:</b>\n\n`;
                resApi.data.results.slice(0, 5).forEach((m, index) => { upMsg += `${index + 1}. <b>${m.title}</b> (${m.release_date})\n`; });
                await bot.sendMessage(chatId, upMsg, { parse_mode: 'HTML' });
            }
            else if (text === '/random') {
                const randomPage = Math.floor(Math.random() * 10) + 1;
                const tmdbUrl = `https://api.themoviedb.org/3/movie/top_rated?api_key=${TMDB_API_KEY}&language=en-US&page=${randomPage}`;
                const resApi = await axios.get(tmdbUrl);
                const movie = resApi.data.results[Math.floor(Math.random() * resApi.data.results.length)];
                await bot.sendMessage(chatId, `🎲 <b>Random Suggestion!</b>\n\nTry watching: <b>${movie.title}</b>\n\n(Type <code>/movie ${movie.title}</code> to get links!)`, { parse_mode: 'HTML' });
            }
        }

        // ---- 2. INLINE BUTTON CLICKS (CALLBACK QUERIES) ----
        else if (body.callback_query) {
            const cb = body.callback_query;
            const chatId = cb.message.chat.id;
            const msgId = cb.message.message_id;
            const data = cb.data;

            await bot.answerCallbackQuery(cb.id);

            // Movie Detail Clicked
            if (data.startsWith('mov_det:')) {
                const tmdbId = data.split(':')[1];
                const detailUrl = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=videos,credits,watch/providers`;
                const resApi = await axios.get(detailUrl);
                const movie = resApi.data;

                const releaseYear = movie.release_date ? movie.release_date.split('-')[0] : 'N/A';
                const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : 'N/A';
                const genres = movie.genres ? movie.genres.map(g => g.name).join(', ') : 'N/A';
                const cast = movie.credits.cast ? movie.credits.cast.slice(0, 3).map(c => c.name).join(', ') : 'N/A';
                const imdbId = movie.imdb_id;
                
                const trailer = movie.videos.results.find(v => v.type === 'Trailer' && v.site === 'YouTube');
                const trailerUrl = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + ' trailer')}`;
                const subUrl = `https://www.google.com/search?q=${encodeURIComponent(movie.title + ' sinhala subtitles baiscope zoom.lk')}`;
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
                inlineKeyboard.push([{ text: "🎬 Trailer", url: trailerUrl }, { text: "📝 Sinhala Subs", url: subUrl }]);
                
                let thirdRow = [{ text: "💡 Similar Movies", callback_data: `mov_sim:${movie.id}` }];
                if (imdbId) thirdRow.push({ text: "⭐ IMDb", url: `https://www.imdb.com/title/${imdbId}` });
                if (providers) thirdRow.push({ text: "📺 OTT", url: providers });
                inlineKeyboard.push(thirdRow);

                const replyMessage = `🎬 <b>${movie.title}</b> (${releaseYear})\n\n` +
                                     `⭐ <b>Rating:</b> ${movie.vote_average.toFixed(1)}/10\n` +
                                     `⏳ <b>Runtime:</b> ${runtime}\n` +
                                     `🎭 <b>Genres:</b> ${genres}\n` +
                                     `👥 <b>Cast:</b> ${cast}\n\n` +
                                     `📝 <b>Overview:</b> <i>${movie.overview}</i>\n\n` +
                                     `⚡ <i>CHUCKY MOVIE ZONE PRO</i>`;

                await bot.deleteMessage(chatId, msgId);
                if (movie.poster_path) {
                    await bot.sendPhoto(chatId, `https://image.tmdb.org/t/p/w500${movie.poster_path}`, { caption: replyMessage, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                } else {
                    await bot.sendMessage(chatId, replyMessage, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                }
            }

            // TV Series / Anime Detail Clicked
            else if (data.startsWith('tv_det:') || data.startsWith('ani_det:')) {
                const tvId = data.split(':')[1];
                const detailUrl = `https://api.themoviedb.org/3/tv/${tvId}?api_key=${TMDB_API_KEY}&language=en-US&append_to_response=videos,credits`;
                const resApi = await axios.get(detailUrl);
                const tv = resApi.data;
                
                const year = tv.first_air_date ? tv.first_air_date.split('-')[0] : 'N/A';
                const seasons = tv.number_of_seasons ? `${tv.number_of_seasons} Seasons` : 'N/A';
                const episodes = tv.number_of_episodes ? `${tv.number_of_episodes} Episodes` : 'N/A';
                const genres = tv.genres ? tv.genres.map(g => g.name).join(', ') : 'N/A';
                const cast = tv.credits.credits?.cast ? tv.credits.cast.slice(0, 3).map(c => c.name).join(', ') : (tv.credits.cast ? tv.credits.cast.slice(0, 3).map(c => c.name).join(', ') : 'N/A');

                const trailer = tv.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
                const trailerUrl = trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(tv.name + ' trailer')}`;
                const subUrl = `https://www.google.com/search?q=${encodeURIComponent(tv.name + ' tv series sinhala subtitles')}`;

                let inlineKeyboard = [
                    [{ text: "🚀 Watch Server 1", url: `https://vidsrc.to/embed/tv/${tv.id}` }],
                    [{ text: "⚡ Watch Server 2", url: `https://embed.su/embed/tv/${tv.id}/1/1` }],
                    [{ text: "🎬 Trailer", url: trailerUrl }, { text: "📝 Sinhala Subs", url: subUrl }],
                    [{ text: "💡 Similar Shows", callback_data: `tv_sim:${tv.id}` }]
                ];

                const msgText = `📺 <b>${tv.name}</b> (${year})\n\n` +
                                `⭐ <b>Rating:</b> ${tv.vote_average.toFixed(1)}/10\n` +
                                `⏳ <b>Status:</b> ${seasons} (${episodes})\n` +
                                `🎭 <b>Genres:</b> ${genres}\n` +
                                `👥 <b>Cast:</b> ${cast}\n\n` +
                                `📝 <b>Overview:</b> <i>${tv.overview}</i>\n\n` +
                                `⚡ <i>CHUCKY MOVIE ZONE PRO</i>`;
                
                await bot.deleteMessage(chatId, msgId);
                if (tv.poster_path) {
                    await bot.sendPhoto(chatId, `https://image.tmdb.org/t/p/w500${tv.poster_path}`, { caption: msgText, parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                } else {
                    await bot.sendMessage(chatId, msgText, { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } });
                }
            }

            // Similar Movies Clicked
            else if (data.startsWith('mov_sim:')) {
                const tmdbId = data.split(':')[1];
                try {
                    const simUrl = `https://api.themoviedb.org/3/movie/${tmdbId}/similar?api_key=${TMDB_API_KEY}&language=en-US&page=1`;
                    const resApi = await axios.get(simUrl);
                    const results = resApi.data.results.slice(0, 5);

                    if (results.length > 0) {
                        let inlineKeyboard = [];
                        results.forEach(m => {
                            const year = m.release_date ? m.release_date.split('-')[0] : 'N/A';
                            inlineKeyboard.push([{ text: `🎬 ${m.title} (${year})`, callback_data: `mov_det:${m.id}` }]);
                        });
                        await bot.sendMessage(chatId, `💡 <b>මේ නිර්මාණයට සමාන තවත් සුපිරි Movies 5ක් මෙන්න:</b>`, {
                            parse_mode: 'HTML',
                            reply_markup: { inline_keyboard: inlineKeyboard }
                        });
                    } else {
                        await bot.sendMessage(chatId, `❌ සමාන නිර්මාණ හමු වුණේ නැත.`);
                    }
                } catch (err) {
                    await bot.sendMessage(chatId, `⚠️ Error fetching similar movies.`);
                }
            }

            // Similar TV Shows Clicked
            else if (data.startsWith('tv_sim:')) {
                const tvId = data.split(':')[1];
                try {
                    const simUrl = `https://api.themoviedb.org/3/tv/${tvId}/similar?api_key=${TMDB_API_KEY}&language=en-US&page=1`;
                    const resApi = await axios.get(simUrl);
                    const results = resApi.data.results.slice(0, 5);

                    if (results.length > 0) {
                        let inlineKeyboard = [];
                        results.forEach(t => {
                            const year = t.first_air_date ? t.first_air_date.split('-')[0] : 'N/A';
                            inlineKeyboard.push([{ text: `📺 ${t.name} (${year})`, callback_data: `tv_det:${t.id}` }]);
                        });
                        await bot.sendMessage(chatId, `💡 <b>මේ නිර්මාණයට සමාන තවත් සුපිරි TV Shows මෙන්න:</b>`, {
                            parse_mode: 'HTML',
                            reply_markup: { inline_keyboard: inlineKeyboard }
                        });
                    } else {
                        await bot.sendMessage(chatId, `❌ සමාන නිර්මාණ හමු වුණේ නැත.`);
                    }
                } catch (err) {
                    await bot.sendMessage(chatId, `⚠️ Error fetching similar shows.`);
                }
            }
        }
    } catch (e) {
        console.error("Webhook Error:", e);
    } finally {
        res.sendStatus(200);
    }
});

module.exports = app;
