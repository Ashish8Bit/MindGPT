const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Load environment variables from .env file
const { GoogleGenerativeAI } = require('@google/generative-ai');

const rateLimit = require('express-rate-limit');
const app = express();
const PORT = 3000;

// Startup check to ensure the API key is loaded
if (!process.env.GEMINI_API_KEY) {
    console.error('FATAL ERROR: GEMINI_API_KEY is not defined. Please create a .env file and add your API key.');
    process.exit(1); // Exit the application with an error code
}

// Access your API key as an environment variable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- CORS Configuration ---
// We create a whitelist of domains that are allowed to make requests to this server.
const allowedOrigins = [
    'https://mindgpt-ai.vercel.app', // Your Vercel frontend URL
    'http://localhost:5500',         // Common port for VS Code Live Server
    'http://127.0.0.1:5500',         // Another address for VS Code Live Server
];

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, Postman) or from our whitelist
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
};

// Middleware
app.use(cors(corsOptions)); // Use the secure CORS configuration
app.use(express.json()); // Middleware to parse incoming JSON requests

// Simple request logger middleware to help with debugging
app.use((req, res, next) => {
    console.log(`Request received: ${req.method} ${req.originalUrl}`);
    next();
});
/*
MindGPT/
├── api/
│   └── index.js      <-- This is your renamed and modified server.js
├── assets/
│   └── ...
├── about.html
├── index.html
├── script.js
├── style.css
├── vercel.json
└── ... other files */


// Rate Limiter: Limit each IP to 15 requests per 5 minutes
const apiLimiter = rateLimit({
	windowMs: 5 * 60 * 1000, // 5 minutes
	max: 15, // Limit each IP to 15 requests per `window`
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { error: 'Too many requests from this IP, please try again after 5 minutes.' },
});

// New endpoint for real-time suggestions
app.post('/generate-suggestions', apiLimiter, async (req, res) => {
    const { query } = req.body;

    // Don't generate for very short or empty queries to save resources
    if (!query || query.trim().length < 3) {
        return res.json({ suggestions: [] });
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const prompt = `Based on the user's partial search query "${query}", generate a list of 4 relevant and diverse search topic suggestions to help them complete their thought. Each suggestion should be on a new line. Do not include numbering or bullet points.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const suggestions = text.split('\n').filter(s => s.trim() !== ''); // Split by newline and remove empty lines
        res.json({ suggestions });
    } catch (error) {
        console.error('Error generating suggestions:', error.message);
        // On failure, return an empty array to prevent frontend errors
        res.json({ suggestions: [] });
    }
});

/**
 * Creates a tailored prompt for the Gemini API based on the user's topic and desired response style.
 * @param {string} topic The user's input topic or question.
 * @param {string} style The selected response style (e.g., 'Detailed Answer').
 * @returns {string} The fully constructed prompt.
 */
function getPromptForStyle(topic, style) {
    // A common instruction to guide formatting. Avoids using asterisks for emphasis.
    const formattingInstruction = "Do not use asterisks for emphasis (like *word*). Only use asterisks for bullet points. After the main response, provide a list of 3 relevant web search queries that would help the user learn more. Each query must be on a new line and prefixed with 'SEARCH_QUERY:'. For example:\\nSEARCH_QUERY: history of artificial intelligence";

    switch (style) {
        case 'Professional':
            return `You are a professional assistant. Respond to the following topic in a formal, structured, and business-appropriate tone. ${formattingInstruction} Topic: "${topic}"`;
        case 'Casual':
            return `You are a friendly and casual AI companion. Respond to the following in a relaxed, conversational, and approachable tone. Use informal language where appropriate. ${formattingInstruction} Topic: "${topic}"`;
        case 'Simple':
            return `You are an expert at simplification. Explain the following topic in simple, clear, and easy-to-understand terms. Avoid jargon and use analogies if it helps. ${formattingInstruction} Topic: "${topic}"`;
        case 'Creative':
            return `You are a creative and witty AI. Respond to the following topic with originality, humor, and a touch of cleverness. Feel free to be imaginative. ${formattingInstruction} Topic: "${topic}"`;
        default: // Default to "Default"
            return `You are a helpful and knowledgeable AI assistant. Provide a detailed and informative answer for the following question or topic. ${formattingInstruction} Topic: "${topic}"`;
    }
}

// Define a route for generating the main response
app.post('/generate-post', apiLimiter, async (req, res) => {
    const { topic, style } = req.body;

    if (!topic) {
        return res.status(400).json({ error: 'Topic is required' });
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const prompt = getPromptForStyle(topic, style);
        const result = await model.generateContent(prompt);
        const response = await result.response;

        // Add more robust response handling to check for blocked content or empty responses.
        if (!response || !response.text) {
            const blockReason = response?.promptFeedback?.blockReason;
            const errorMessage = blockReason
                ? `Request was blocked by the AI's safety filters. Reason: ${blockReason}. Please try a different topic.`
                : 'The AI model returned an empty or invalid response.';
            throw new Error(errorMessage);
        }
        const fullResponseText = response.text();

        // Parse the response to separate the main text from search queries
        const lines = fullResponseText.split('\n');
        const responseTextLines = [];
        const searchQueries = [];

        lines.forEach(line => {
            if (line.startsWith('SEARCH_QUERY:')) {
                searchQueries.push(line.replace('SEARCH_QUERY:', '').trim());
            } else {
                responseTextLines.push(line);
            }
        });

        // Send the generated post back to the client
        res.json({ responseText: responseTextLines.join('\n').trim(), searchQueries });
    } catch (error) {
        console.error('\n--- ERROR CALLING GEMINI API ---');
        console.error('Timestamp:', new Date().toISOString());
        console.error('Error Details:', error.message || 'No specific message available.');
        console.error('--- END OF ERROR ---\n');

        // Check if the error message indicates a rate limit / quota issue from Google's side.
        if (error.message && (error.message.includes('429') || error.message.includes('quota'))) {
            // Send a specific 429 status code and a user-friendly message.
            return res.status(429).json({ error: "The daily API quota has been reached. Please try again tomorrow." });
        }

        // For all other errors, send a generic 500 server error.
        res.status(500).json({ error: 'An unexpected server error occurred. Please check the server logs.' });
    }
});

// This is the crucial change for Vercel deployment.
// Vercel handles the server lifecycle, so we must not call app.listen().
// Instead, we export the Express app instance for the serverless environment.
module.exports = app;