require('dotenv').config();
const express = require('express');
const cors = require('cors');
// const { OpenAI } = require('openai');
require('./firebase');
const verifyFirebaseToken = require('./authMiddleware');

const app = express();
const corsOptions = {
  origin: 'https://legal-ai-app-8653b.web.app',  // Allow frontend domain
  methods: ['GET', 'POST', 'OPTIONS'],           // Explicitly allow OPTIONS
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "https://legal-ai-app-8653b.web.app");
  res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-type, Accept, Authorization");
  next();
});


app.use(express.json());
// const openai = new OpenAI({apiKey: process.env.OPENAI_API_KEY});

// app.post('/generate', verifyFirebaseToken, async (req, res) => {
//   const { prompt } = req.body;
//   try {
//     const completion = await openai.chat.completions.create({
//       model: 'gpt-3.5-turbo',  // You can change the model here
//       messages: [
//         { role: 'system', content: 'You are a legal assistant drafting formal legal documents.' },
//         { role: 'user', content: prompt },
//       ],
//       temperature: 0.5,
//       max_tokens: 1000,
//     });

//     res.json({ response: completion.choices[0].message.content });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Error generating response' });
//   }
// });

const port = process.env.PORT || 3000;  // Use the provided port or fallback to 3000
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});