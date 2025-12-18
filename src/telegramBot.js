import TelegramBot from "node-telegram-bot-api"
import { config } from "./config.js"
import database from "./database.js"
import aiService from "./aiService.js"

class TelegramBotService {
  constructor() {
    console.log("🔧 Connecting to Telegram...")
    console.log(`   Token: ${config.telegram.botToken ? config.telegram.botToken.substring(0, 10) + "..." : "NOT SET"}`)

    if (!config.telegram.botToken) {
      throw new Error("TELEGRAM_BOT_TOKEN is not set in .env file")
    }

    try {
      // Create bot with polling
      console.log("   Creating bot instance with polling...")
      this.bot = new TelegramBot(config.telegram.botToken, {
        polling: {
          interval: 1000,
          autoStart: true,
          params: {
            timeout: 10,
          },
        },
      })
      console.log("✅ Telegram bot instance created")
      console.log("   Polling: ENABLED")
      console.log("   Interval: 1000ms")
      console.log("   Library: node-telegram-bot-api (official npm package)")

      // Verification will be done in verifyConnection() method

      console.log("   Setting up handlers...")
      this.setupEventListeners() // Setup event listeners first
      this.setupHandlers() // Then setup command handlers
      console.log("✅ Handlers initialized")

      // Verify polling is active after a delay
      setTimeout(() => {
        console.log("\n📡 Bot is ready and listening for messages...")
        console.log("   Status: ACTIVE")
        console.log("   Library: node-telegram-bot-api (official)")
        console.log("   Waiting for incoming messages...\n")
      }, 1500)
    } catch (error) {
      console.error("❌ Error connecting to Telegram:", error)
      console.error("   Details:", error.message)
      console.error("   Stack:", error.stack)
      throw error
    }
  }

  setupEventListeners() {
    // Log polling errors
    this.bot.on("polling_error", (error) => {
      console.error("\n❌ Telegram polling error:", error.message || error)
      console.error("   Code:", error.code)
      console.error("   Response:", error.response)
      console.error("   This means the bot cannot receive messages!")
    })

    this.bot.on("webhook_error", (error) => {
      console.error("❌ Webhook error:", error)
    })

    // Log when polling starts successfully
    this.bot.on("polling_error", () => {
      // This is handled above
    })

    // Add a heartbeat to verify bot is alive
    setInterval(() => {
      this.bot
        .getMe()
        .then(() => {
          // Bot is still connected (silent check)
        })
        .catch((err) => {
          console.error("⚠️  Bot connection check failed:", err.message)
        })
    }, 30000) // Check every 30 seconds
  }

  logMessage(msg, type = "message") {
    const userId = msg.from?.id || "unknown"
    const username = msg.from?.username || "no-username"
    const firstName = msg.from?.first_name || ""
    const lastName = msg.from?.last_name || ""
    const text = msg.text || "[non-text message]"
    const timestamp = new Date().toISOString()

    console.log(`\n📨 [${timestamp}] ${type.toUpperCase()}`)
    console.log(`   👤 User: ${firstName} ${lastName} (@${username}) [ID: ${userId}]`)
    console.log(`   💬 Message: ${text}`)
    console.log(`   ──────────────────────────────────────`)
  }

  setupHandlers() {
    // Start command
    this.bot.onText(/\/start/, async (msg) => {
      this.logMessage(msg, "command: /start")
      const userId = msg.from.id
      const userData = msg.from

      // Create or update user
      database.createOrUpdateUser(userId, userData)

      // Create default profile if doesn't exist
      const profile = database.getProfile(userId)
      if (!profile) {
        database.createOrUpdateProfile(userId, {}, "", {
          firstInteraction: new Date().toISOString(),
        })
      }

      const welcomeMessage = `سلام ${userData.first_name || "عزیز"}! 🌸

من مشاور تخصصی عطر و اسانس شما هستم. با طبعی شاعرانه و دانش عمیق در دنیای عطرها، اینجا هستم تا بهت کمک کنم عطر رویایی‌ات رو پیدا کنی یا ترکیبی منحصر به فرد بسازی.

من می‌تونم:
✨ بر اساس شخصیت و سبک زندگی‌ت عطر مناسب رو پیشنهاد بدم
🌹 ترکیب‌های خلاقانه از عطرهای موجود رو بهت یاد بدم
💫 با توصیفات شاعرانه و عمیق، حال و هوای هر عطر رو برات زنده کنم
🎯 زمانبندی و نقاط دقیق زدن عطر رو بهت بگم

دستورات:
/help - راهنمای کامل
/clear - شروع یک مشاوره جدید (پاک کردن تاریخچه)
/profile - اطلاعات پروفایل

حالا بگو، دنبال چه عطری هستی؟ یا می‌خوای ترکیبی خاص بسازی؟ 💭`

      await this.bot.sendMessage(msg.chat.id, welcomeMessage)
    })

    // Help command
    this.bot.onText(/\/help/, async (msg) => {
      this.logMessage(msg, "command: /help")
      const helpMessage = `🌹 راهنمای مشاور عطر

دستورات:
/start - شروع مشاوره
/help - این راهنما
/clear - شروع مشاوره جدید (پاک کردن تاریخچه)
/profile - اطلاعات پروفایل شما

نحوه استفاده:
فقط بگو دنبال چه عطری هستی یا چه سوالی داری! من:
- از مجموعه عطرهای موجود استفاده می‌کنم
- سوالات دقیق می‌پرسم تا بهترین پیشنهاد رو بدم
- ترکیب‌های خلاقانه بهت یاد می‌دم
- با توصیفات شاعرانه و عمیق، حال و هوای عطرها رو برات زنده می‌کنم
- زمانبندی و نقاط دقیق زدن عطر رو بهت می‌گم

بیا شروع کنیم! 💫`

      await this.bot.sendMessage(msg.chat.id, helpMessage)
    })

    // Clear chat history
    this.bot.onText(/\/clear/, async (msg) => {
      this.logMessage(msg, "command: /clear")
      const userId = msg.from.id
      database.clearChatHistory(userId)
      await this.bot.sendMessage(msg.chat.id, "✨ تاریخچه پاک شد. آماده‌ام برای یک مشاوره جدید! بگو دنبال چه عطری هستی؟ 🌸")
    })

    // Profile command
    this.bot.onText(/\/profile/, async (msg) => {
      this.logMessage(msg, "command: /profile")
      const userId = msg.from.id
      const user = database.getUser(userId)
      const profile = database.getProfile(userId)
      const chatHistory = database.getChatHistory(userId)

      let profileMessage = `👤 پروفایل مشاوره شما:\n\n`
      profileMessage += `🌸 نام: ${user?.first_name || "عزیز"} ${user?.last_name || ""}\n`
      profileMessage += `💬 تعداد گفتگوها: ${chatHistory.length}\n`

      if (profile?.context) {
        profileMessage += `\n📌 اطلاعات ذخیره شده: ${profile.context}\n`
      }

      profileMessage += `\n💡 می‌خوای یک مشاوره جدید شروع کنیم؟ فقط بگو دنبال چه عطری هستی!`

      await this.bot.sendMessage(msg.chat.id, profileMessage)
    })

    // Set context command
    this.bot.onText(/\/setcontext (.+)/, async (msg, match) => {
      this.logMessage(msg, "command: /setcontext")
      const userId = msg.from.id
      const context = match[1]

      aiService.updateUserContext(userId, context)
      await this.bot.sendMessage(msg.chat.id, `✨ اطلاعات ذخیره شد:\n${context}\n\nحالا می‌تونم بهتر بهت مشاوره بدم! 🌸`)
    })

    // Handle all text messages
    this.bot.on("message", async (msg) => {
      // Log ALL incoming messages first (for debugging) - THIS SHOULD ALWAYS FIRE
      console.log(`\n🔔 [RAW UPDATE] Message received!`)
      console.log(`   Message ID: ${msg.message_id || "N/A"}`)
      console.log(`   From User ID: ${msg.from?.id || "unknown"}`)
      console.log(`   Chat ID: ${msg.chat?.id || "unknown"}`)
      console.log(`   Has text: ${!!msg.text}`)
      console.log(`   Text preview: ${msg.text?.substring(0, 50) || "N/A"}`)
      console.log(`   Message type: ${msg.photo ? "photo" : msg.document ? "document" : msg.text ? "text" : "other"}`)

      // Skip if it's a command (already handled by onText)
      if (msg.text && msg.text.startsWith("/")) {
        console.log("   ⏭️  This is a command, skipping (handled by onText)")
        return
      }

      // Handle non-text messages
      if (!msg.text) {
        if (msg.photo) {
          console.log(`   📷 Received photo from user [ID: ${msg.from?.id}]`)
        } else if (msg.document) {
          console.log(`   📄 Received document from user [ID: ${msg.from?.id}]`)
        } else {
          console.log(`   ⏭️  Non-text message (type: ${msg.photo ? "photo" : msg.document ? "document" : "other"}), skipping`)
        }
        return
      }

      const userId = msg.from.id
      const userMessage = msg.text

      // Log incoming message with full details
      this.logMessage(msg, "message")

      // Create or update user
      database.createOrUpdateUser(userId, msg.from)

      // Show typing indicator
      try {
        await this.bot.sendChatAction(msg.chat.id, "typing")
      } catch (error) {
        console.error("   ⚠️  Error sending typing indicator:", error.message)
      }

      try {
        console.log("   🔄 Generating response...")
        // Generate AI response
        const response = await aiService.generateResponse(userId, userMessage)

        // Log response (truncated if too long)
        const responsePreview = response.length > 100 ? response.substring(0, 100) + "..." : response
        console.log(`   🤖 Response generated: ${responsePreview}`)

        // Send response
        await this.bot.sendMessage(msg.chat.id, response)
        console.log("   ✅ Response sent")
      } catch (error) {
        console.error("❌ Error processing message:", error)
        console.error("   Stack:", error.stack)
        try {
          await this.bot.sendMessage(msg.chat.id, "❌ متأسفانه خطایی رخ داد. لطفاً دوباره تلاش کنید.")
        } catch (sendError) {
          console.error("❌ Error sending error message:", sendError)
        }
      }
    })
  }

  async verifyConnection() {
    try {
      console.log("   Attempting to get bot info...")
      if (!this.bot) {
        throw new Error("Bot instance is not initialized")
      }

      // Add timeout to getMe() call
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("getMe() timeout after 10 seconds")), 10000)
      })

      const botInfoPromise = this.bot.getMe()
      const botInfo = await Promise.race([botInfoPromise, timeoutPromise])

      console.log("   Bot info received:", JSON.stringify(botInfo, null, 2))
      console.log(`   ✅ Bot verified: @${botInfo.username} (${botInfo.first_name})`)
      console.log(`   Bot ID: ${botInfo.id}`)
      console.log(`   Connection status: ACTIVE`)
      return true
    } catch (err) {
      console.error("   ❌ Error verifying bot:")
      console.error("   Error message:", err.message)
      console.error("   Error code:", err.code)
      console.error("   Error response:", err.response)
      console.error("   Error stack:", err.stack)
      console.error("   Full error:", JSON.stringify(err, Object.getOwnPropertyNames(err)))
      console.error("   Bot may not be able to receive messages!")
      console.error("   Continuing anyway...")
      return false
    }
  }

  async sendMessage(chatId, text) {
    return await this.bot.sendMessage(chatId, text)
  }
}

export default TelegramBotService
