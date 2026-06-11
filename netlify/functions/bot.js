const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const CHANNEL_ID = process.env.CHANNEL_ID;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const allowedAdmins = [6629519111, 6467952735];

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const watchlists = new Map();
const postedMoviesCache = new Set();

// 🛑 AI BAD WORD FILTER (STRICT)
async function isBadWord(text) {
    if (!OPENROUTER_API_KEY || !text) return false;
    try {
        const res = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "meta-llama/llama-3-8b-instruct:free",
            messages: [{ role: "user", content: `Is this toxic? Reply ONLY YES or NO: ${text}` }]
        }, { headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}` }, timeout: 5000 });
        return res.data.choices[0].message.content.includes("YES");
    } catch (e) { return false; }
}

// 🎯 MESSAGE & CALLBACK HANDLER
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    const userId = msg.from.id;

    // Filter Bad Words
    if (msg.chat.type !== 'private' && !text.startsWith('/')) {
        if (await isBadWord(text) && !allowedAdmins.includes(userId)) {
            await bot.deleteMessage(chatId, msg.message_id).catch(()=>{});
            await bot.sendMessage(chatId, `🚫 ${msg.from.first_name}, අසභ්‍ය වචන තහනම්!`).catch(()=>{});
            return;
        }
    }

    // Commands
    if (text.startsWith('/start')) {
        await bot.sendMessage(chatId, "🎬 Welcome to Chucky Bot!\n\nCommands:\n/movie [name]\n/tv [name]\n/genres\n/year [year]\n/actor [name]\n/random\n/trending\n/watchlist\n/imdb250");
    }
    else if (text.startsWith('/movie ')) {
        const q = text.split('/movie ')[1];
        const res = await axios.get(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(q)}`);
        const m = res.data.results[0];
        if (m) await bot.sendMessage(chatId, `🎬 ${m.title} (${m.release_date})\n\n${m.overview}`, { reply_markup: { inline_keyboard: [[{text: "➕ Add to Watchlist", callback_data: `add_wl:${m.id}:${m.title}`}]] } });
    }
    else if (text === '/random') {
        const res = await axios.get(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}`);
        const m = res.data.results[Math.floor(Math.random() * res.data.results.length)];
        await bot.sendMessage(chatId, `🎲 ${m.title}\n⭐ ${m.vote_average}`);
    }
    else if (text === '/watchlist') {
        const list = watchlists.get(userId) || [];
        if (list.length === 0) return bot.sendMessage(chatId, "📭 Empty!");
        let out = "📋 Your Watchlist:\n";
        list.forEach(i => out += `\n🎬 ${i.title}`);
        await bot.sendMessage(chatId, out);
    }
    else if (text === '/testpost' && allowedAdmins.includes(userId)) {
        await bot.sendMessage(chatId, "⏳ Posting...");
        const res = await axios.get(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_API_KEY}`);
        for(let m of res.data.results.slice(0, 5)) {
            if (!postedMoviesCache.has(m.id)) {
                await bot.sendPhoto(CHANNEL_ID, `https://image.tmdb.org/t/p/w500${m.poster_path}`, { caption: `🎬 ${m.title}` }).catch(()=>{});
                postedMoviesCache.add(m.id);
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }
});

// Callback Query Handler (Buttons)
bot.on('callback_query', async (cb) => {
    const data = cb.data;
    const userId = cb.from.id;
    if (data.startsWith('add_wl:')) {
        const [_, id, title] = data.split(':');
        if (!watchlists.has(userId)) watchlists.set(userId, []);
        watchlists.get(userId).push({ id, title });
        await bot.answerCallbackQuery(cb.id, { text: "Added to Watchlist!" });
    }
});
