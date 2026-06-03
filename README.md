# 🎬 CHUCKY MOVIE ZONE PRO 🍿

<p align="center">
  <img src="https://img.shields.io/badge/Bot%20Status-Active-brightgreen?style=for-the-badge&logo=telegram" alt="Bot Status">
  <img src="https://img.shields.io/badge/Deployment-Vercel-black?style=for-the-badge&logo=vercel" alt="Deployment">
  <img src="https://img.shields.io/badge/Language-JavaScript%20%2F%20Node.js-yellow?style=for-the-badge&logo=javascript" alt="Language">
</p>

---

## 💻 About the Project
**CHUCKY MOVIE ZONE PRO** කියන්නේ Express.js සහ `node-telegram-bot-api` භාවිතයෙන් සකස් කරපු, Vercel Serverless Functions මත 100%ක් නොමිලේ Run වන Telegram මූවී සර්ච් බොට් කෙනෙක්. මේ බොට් හරහා ලෝකයේ තියෙන ඕනෑම Movie, TV Series, Anime හෝ Actor කෙනෙක්ගේ තොරතුරු සහ Direct Watch සර්වර්ස් තත්පර ගණනකින් ලබාගන්න පුළුවන්.

### 🔥 Special Features:
* **Hacking Dashboard Live Animation:** බොට්ගේ ප්‍රධාන Vercel URL එකට යනකොට පට්ටම Terminal Hacking UI එකක් බලාගන්න පුළුවන්.
* **Easy Webhook Setup:** බ්‍රවුසර් එකෙන් කෙලින්ම `/setup` route එකට ගිහින් එක ක්ලික් එකෙන් Webhook එක සෙට් කරගැනීමේ හැකියාව.
* **Dual Streaming Servers:** Movies සහ TV Series සඳහා ලෝකයේ හොඳම ධාවක සර්වර් 2ක් (Vidsrc & Embed.su) ඇතුලත් කර ඇත.
* **Advanced Content Search:** Movies, TV Shows වගේම Anime (with Genre filter) සහ Actors වෙන වෙනම සර්ච් කල හැක.

---

## 📌 Main Bot Commands
| Command | Description | Example |
| :--- | :--- | :--- |
| `/start` හෝ `/help` | බොට්ගේ හැදින්වීම සහ විධාන ලැයිස්තුව | `/start` |
| `/movie [නම]` | ඕනෑම චිත්‍රපටයක් සර්ච් කිරීමට | `/movie Avengers` |
| `/tv [නම]` | TV Series සර්ච් කිරීමට | `/tv Breaking Bad` |
| `/anime [නම]` | ඇනිමේ නිර්මාණ සර්ච් කිරීමට | `/anime Naruto` |
| `/actor [නම]` | නළු නිලියන්ගේ විස්තර සර්ච් කිරීමට | `/actor Tom Cruise` |
| `/trending` | අද දවසේ ජනප්‍රියම Movies 5 | `/trending` |
| `/upcoming` | ළඟදීම තිරගත වීමට නියමිත Movies | `/upcoming` |
| `/imdb250` | IMDb ඉහලම රේටින්ග්ස් තියෙන චිත්‍රපට | `/imdb250` |
| `/random` | නරඹන්න අහඹු මූවී යෝජනාවක් ලබාගැනීමට | `/random` |

---

## 🛠️ Environment Variables Setup

මෙම Project එක හරියටම Run වෙන්න නම් Vercel Dashboard එකේ **Environment Variables** (Settings -> Environment Variables) වලට මෙන්න මේ Key 2ක අනිවාර්යයෙන්ම එකතු කරන්න ඕනේ:

1. `TELEGRAM_TOKEN` : BotFather ගෙන් ලබාගත් ඔයාගේ ටෙලිග්‍රෑම් බොට් API ටෝකන් එක.
2. `TMDB_API_KEY` : The Movie Database (TMDB) වෙබ් අඩවියෙන් ලබාගත් API Key එක.

---

## 🚀 How to Deploy & Setup Webhook

1. **Fork/Upload to GitHub:** මේ කෝඩ් ටික ඔයාගේ GitHub ගිණුමට අප්ලෝඩ් කරන්න.
2. **Deploy on Vercel:** Vercel එකට GitHub Repository එක සම්බන්ධ කරලා, Environment Variables ටික දීලා **Deploy** කරන්න.
3. **Set Webhook:** Deployment එක ඉවර වුණාම ලැබෙන Vercel Domain එකේ අගට `/setup` යොදා බ්‍රවුසර් එකෙන් පිවිසෙන්න.
   * *උදාහරණ:* `https://your-bot-name.vercel.app/setup`
4. තිරයේ **`[+] Webhook Setup Successful!`** ලෙස වැටුණු පසු බොට් වැඩ කිරීමට පටන් ගනී!

---

## 📂 Project Structure
```text
├── index.js          # ප්‍රධාන Bot Logic සහ Express සර්වර් කෝඩ් එක
├── package.json      # Node.js Dependencies (Express, Axios, Telegram API)
├── vercel.json       # Vercel Routing සහ Rewrite Settings ෆයිල් එක
└── README.md         # මෙම විස්තර ඇතුලත් ෆයිල් එක
