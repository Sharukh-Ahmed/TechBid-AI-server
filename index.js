import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();
const app = express();
const port = 5000;

app.use(cors({
  origin: 'https://tech-bid-ai.vercel.app/',
  credentials: true
}));
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPEN_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

let selectedModel = 'openai/gpt-3.5-turbo'; // fallback default

// Auto-detect best available model
async function detectBestModel() {
  const preferredModels = [
    'meta-llama/llama-3-70b-instruct',
    'meta-llama/llama-3-70b-instruct:free',
    'openai/gpt-3.5-turbo',
    'mistralai/mistral-7b-instruct'
  ];

  try {
    const response = await openai.models.list();
    const availableModels = response.data.map(m => m.id);

    const found = preferredModels.find(model => availableModels.includes(model));
    if (found) {
      selectedModel = found;
      console.log(`✅ Auto-selected model: ${selectedModel}`);
    } else {
      console.warn('⚠️ None of the preferred models found. Using fallback:', selectedModel);
    }
  } catch (err) {
    console.error('❌ Error detecting available models:', err.message);
  }
}

await detectBestModel(); // Run model detection on server start

app.post('/estimate', async (req, res) => {
  const { items } = req.body;
  console.log('📥 Received items:', items);

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Invalid items list' });
  }

  try {
    const estimatedItems = await Promise.all(
      items.map(async (item) => {
        const prompt = `Get the average market price in Saudi Riyals (SAR) for the following item for estimation and bidding purposes. Ensure you give only the Price Range. Dont give any explanations. If you assume something let it be known in the shortest possible ways: ${item}`;
        console.log(`📩 Prompt using ${selectedModel}:`, prompt);

        const completion = await openai.chat.completions.create({
          model: selectedModel,
          messages: [{ role: 'user', content: prompt }],
        });

        const priceEstimate = completion.choices[0].message.content.trim();
        return { item, price: priceEstimate };
      })
    );

    res.json({ data: estimatedItems });
  } catch (err) {
    console.error('❌ Error fetching price estimates:', err.response?.data || err.message);
    res.status(500).json({
      error: 'Error fetching price estimates',
      details: err.response?.data || err.message,
    });
  }
});

app.get('/', (req, res) => {
  res.send('✅ AI Price Estimator Backend is running.');
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
