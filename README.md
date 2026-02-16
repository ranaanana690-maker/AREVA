# Smart Library Assistant (AREVA)

A voice-enabled library assistant powered by **Google Gemini 2.0 Flash**. It helps users search for books, check availability, and get shelf locations using natural language (Text or Voice).

## Features
- 🎙️ **Real-time Voice Chat**: Talk naturally to the assistant (powered by Gemini Live).
- 💬 **Text Chat**: Search books with smart context understanding.
- 📚 **Library Database**: JSON-based book inventory.
- 🔄 **Auto-Rotation**: Automatically switches between multiple API keys to avoid quotas.
- 🔊 **Audio Visualization**: Reactive voice interface.

## 🚀 Deployment (All Free)

### Option 1: Vercel (Recommended for Speed)
This project uses **Vite**, which runs perfect on Vercel.

1. **Fork/Upload** this folder to GitHub.
2. Go to [Vercel.com](https://vercel.com) -> **Add New Project**.
3. Import your GitHub repository.
4. **Environment Variables**:
   In the project settings on Vercel, add your keys:
   - `GOOGLE_KEY_1` = `AIz...`
   - `GOOGLE_KEY_2` = `AIz...`
   - ...etc
5. Click **Deploy**.

### Option 2: Glitch (Good for experimentation)
Glitch is great for quick edits in the browser, but slightly slower for Vite apps.

1. Go to [Glitch.com](https://glitch.com).
2. Click **New Project** -> **Import from GitHub**.
3. Add your keys in the `.env` file (Glitch provides a secure `.env` editor).
   - `GOOGLE_KEY_1=...`
4. Glitch will auto-install and run.
   - *Note*: You might need to change `npm run dev` to `npm run build && npm run preview` in `package.json` if it doesn't start automatically, or use a static site setup.

### Option 3: Netlify
Similar to Vercel. Drag and drop the `dist` folder (after running `npm run build`) or connect GitHub.

## 🔑 API Keys Security
- **NEVER** commit `.env` or `.env.local` to GitHub.
- Always add keys in the **Settings/Environment Variables** section of the hosting platform.

## 🛠️ Local Development
1. Clone repo.
2. `npm install`
3. Create `.env.local` with keys.
4. `npm run dev`
