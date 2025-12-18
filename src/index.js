import database from "./database.js"
import knowledgeBase from "./knowledgeBase.js"
import TelegramBotService from "./telegramBot.js"
import { config } from "./config.js"

async function main() {
  try {
    console.log("🚀 Starting AI bot...\n")

    // Initialize database
    console.log("📦 Initializing database...")
    // Database is already initialized in the import

    // Load knowledge base
    console.log("📚 Loading knowledge base...")
    await knowledgeBase.loadKnowledgeBase()

    // Initialize Telegram bot
    console.log("🤖 Initializing Telegram bot...")
    const bot = new TelegramBotService()

    // Wait a bit for bot to be ready
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Verify bot connection (with timeout)
    console.log("   Verifying bot connection...")
    try {
      const verified = await Promise.race([bot.verifyConnection(), new Promise((resolve) => setTimeout(() => resolve(false), 15000))])

      if (!verified) {
        console.warn("   ⚠️  Bot verification failed or timed out, but continuing anyway...")
      }
    } catch (error) {
      console.error("   ⚠️  Error during verification:", error.message)
      console.warn("   Continuing anyway...")
    }

    console.log("\n✅ Bot started successfully!")
    console.log("📱 Bot is ready to receive messages...\n")

    // Graceful shutdown
    process.on("SIGINT", () => {
      console.log("\n\n🛑 Shutting down bot...")
      database.close()
      process.exit(0)
    })

    process.on("SIGTERM", () => {
      console.log("\n\n🛑 Shutting down bot...")
      database.close()
      process.exit(0)
    })
  } catch (error) {
    console.error("❌ Error starting bot:", error)
    process.exit(1)
  }
}

main()
