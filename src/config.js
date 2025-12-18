import dotenv from "dotenv"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import fs from "fs-extra"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config()

export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: parseFloat(process.env.TEMPERATURE) || 0.7,
    maxTokens: parseInt(process.env.MAX_TOKENS) || 2000,
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
  },
  database: {
    path: process.env.DB_PATH || join(__dirname, "../data/chatbot.db"),
  },
  knowledgeBase: {
    path: process.env.KNOWLEDGE_BASE_PATH || join(__dirname, "../knowledge_base"),
  },
}

// Validate required configuration
if (!config.openai.apiKey) {
  throw new Error("OPENAI_API_KEY is required in .env file")
}

if (!config.telegram.botToken) {
  throw new Error("TELEGRAM_BOT_TOKEN is required in .env file")
}

// Ensure directories exist
fs.ensureDirSync(join(__dirname, "../data"))
fs.ensureDirSync(config.knowledgeBase.path)
