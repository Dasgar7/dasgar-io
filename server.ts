import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialized Gemini client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', game: 'Dasgar.io', version: '2.0.0' });
});

// AI Endpoint: Generate Anime-Inspired Usernames & Battle Titles
app.post('/api/ai/generate-names', async (req, res) => {
  try {
    const { theme = 'cyber-ninja', count = 5 } = req.body || {};
    const ai = getGeminiClient();

    if (!ai) {
      const defaultNames = [
        { name: 'KageRyu_99', title: 'Shadow Dragon Master', quote: 'Slice through the void!' },
        { name: 'NeonValkyrie', title: 'Cybernetic Aegis', quote: 'My neon pulse never fades.' },
        { name: 'Akira_Void', title: 'Astral Devourer', quote: 'Consume all in the singularity.' },
        { name: 'KitsuneZero', title: 'Nine-Tailed Cyber Phantom', quote: 'Can you catch a phantom?' },
        { name: 'ZenithTitan', title: 'Celestial Colossus', quote: 'Unstoppable mass, infinite power!' },
      ];
      return res.json({ names: defaultNames, source: 'preset' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Generate ${count} cool, anime/cyberpunk-themed gaming usernames for the .io cell eating game "Dasgar.io".
Theme vibe: ${theme}.
Return a JSON array of objects, each with:
- "name": string (between 4 and 14 characters, catchy gamer tag)
- "title": string (epic anime title/epithet like "Void Emperor", "Silent Shinobi")
- "quote": string (short 1-sentence victory/taunt quote)`,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '[]');
    res.json({ names: parsed, source: 'gemini' });
  } catch (error: any) {
    console.error('Error generating AI names:', error);
    res.json({
      names: [
        { name: 'HyperKage', title: 'Speed of Shadow', quote: 'Too fast for the grid.' },
        { name: 'NovaShinobi', title: 'Cosmic Blade', quote: 'Bursting with starlight.' },
      ],
      source: 'fallback',
    });
  }
});

// AI Endpoint: Generate Bot Behavioral Strategies & Anime Personalities
app.post('/api/ai/bot-behavior', async (req, res) => {
  try {
    const { botName, mass, topRival, surroundingViruses } = req.body || {};
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        strategy: (mass || 100) > 300 ? 'HUNT_AND_SPLIT' : 'GRAZE_AND_DODGE',
        taunt: 'Watch your back, rookie!',
        targetPreference: 'weaker_cells',
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an anime bot AI controller for "Dasgar.io".
Bot Name: ${botName || 'MechaRyu'}
Current Mass: ${mass || 100}
Top Rival nearby: ${topRival || 'None'}
Surrounding Viruses: ${surroundingViruses || 0}

Determine the tactical behavior and an anime battle shout.
Return JSON with:
- "strategy": "AGGRESSIVE_SPLIT" | "VIRUS_BAIT" | "STEALTH_FEED" | "TACTICAL_RETREAT" | "CLUSTER_ABSORB"
- "taunt": short dramatic anime one-liner
- "targetPreference": "nearest_food" | "smaller_player" | "virus_feeding"`,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error('Error in bot behavior AI:', error);
    res.json({ strategy: 'GRAZE_AND_DODGE', taunt: 'Let us clash!', targetPreference: 'nearest_food' });
  }
});

// AI Endpoint: Anime Battle Commentary & Tactical Master Coach (Sensei)
app.post('/api/ai/tactical-advice', async (req, res) => {
  try {
    const { playerScore = 100, rank = 1, cellsCount = 1, biggestThreat = 'A roaming giant' } = req.body || {};
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        advice: Number(playerScore) > 500
          ? 'Sensei Tip: Split precisely toward corners to trap fleeing opponents!'
          : 'Sensei Tip: Avoid green spiky viruses until your cell is safely small!',
        hypeCommentary: 'Keep growing, aspiring Cell Meister!',
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are the energetic Anime Battle Sensei commentator in "Dasgar.io".
Player Stats:
- Current Mass/Score: ${playerScore}
- Leaderboard Rank: ${rank || 'Unranked'}
- Cell Split Count: ${cellsCount}
- Biggest Threat Nearby: ${biggestThreat || 'A roaming giant'}

Provide 1 short strategic tip and 1 enthusiastic anime-style commentator cheer.
Return JSON with:
- "advice": string
- "hypeCommentary": string`,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({
      advice: parsed.advice || 'Sensei Tip: Keep your cells tight and harvest pellets!',
      hypeCommentary: parsed.hypeCommentary || 'Show them your true anime power!',
    });
  } catch (error: any) {
    console.error('Error generating tactical advice:', error);
    res.json({
      advice: 'Sensei Tip: Stay nimble and watch your split timing!',
      hypeCommentary: 'Show them your true anime power!',
    });
  }
});

// Start server with Vite middleware in dev or static build in prod
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Dasgar.io Server running on port ${PORT}`);
  });
}

startServer();
