import TelegramBot from "node-telegram-bot-api"
import { config } from "./config.js"
import database from "./database.js"
import aiService from "./aiService.js"
import knowledgeBase from "./knowledgeBase.js"

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

      const welcomeMessage = `سلام *${userData.first_name || "عزیز"}*! 🌸

من *مشاور تخصصی عطر و اسانس* شما هستم. با طبعی شاعرانه و دانش عمیق در دنیای عطرها، اینجا هستم تا بهت کمک کنم عطر رویایی‌ات رو پیدا کنی یا ترکیبی منحصر به فرد بسازی.

*من می‌تونم:*
✨ بر اساس شخصیت و سبک زندگی‌ت عطر مناسب رو پیشنهاد بدم
🌹 ترکیب‌های خلاقانه از عطرهای موجود رو بهت یاد بدم
💫 با توصیفات شاعرانه و عمیق، حال و هوای هر عطر رو برات زنده کنم
🎯 زمانبندی و نقاط دقیق زدن عطر رو بهت بگم

*دستورات:*
\`/help\` - راهنمای کامل
\`/clear\` - شروع یک مشاوره جدید (پاک کردن تاریخچه)
\`/profile\` - اطلاعات پروفایل
\`/myperfumes\` - مدیریت عطرهای من

حالا بگو، دنبال چه عطری هستی؟ یا می‌خوای ترکیبی خاص بسازی؟ 💭`

      await this.sendFormattedMessage(msg.chat.id, welcomeMessage)
    })

    // Help command
    this.bot.onText(/\/help/, async (msg) => {
      this.logMessage(msg, "command: /help")
      const helpMessage = `🌹 *راهنمای مشاور عطر*

*دستورات:*
\`/start\` - شروع مشاوره
\`/help\` - این راهنما
\`/clear\` - شروع مشاوره جدید (پاک کردن تاریخچه)
\`/profile\` - اطلاعات پروفایل شما
\`/myperfumes\` - مدیریت عطرهای من

*نحوه استفاده:*
فقط بگو دنبال چه عطری هستی یا چه سوالی داری! من:
• از مجموعه عطرهای موجود استفاده می‌کنم
• سوالات دقیق می‌پرسم تا بهترین پیشنهاد رو بدم
• ترکیب‌های خلاقانه بهت یاد می‌دم
• با توصیفات شاعرانه و عمیق، حال و هوای عطرها رو برات زنده می‌کنم
• زمانبندی و نقاط دقیق زدن عطر رو بهت می‌گم

بیا شروع کنیم! 💫`

      await this.sendFormattedMessage(msg.chat.id, helpMessage)
    })

    // Clear chat history
    this.bot.onText(/\/clear/, async (msg) => {
      this.logMessage(msg, "command: /clear")
      const userId = msg.from.id
      database.clearChatHistory(userId)
      await this.sendFormattedMessage(msg.chat.id, "✨ *تاریخچه پاک شد*\n\nآماده‌ام برای یک مشاوره جدید! بگو دنبال چه عطری هستی؟ 🌸")
    })

    // Profile command
    this.bot.onText(/\/profile/, async (msg) => {
      this.logMessage(msg, "command: /profile")
      const userId = msg.from.id
      const user = database.getUser(userId)
      const profile = database.getProfile(userId)
      const chatHistory = database.getChatHistory(userId)

      const userPerfumes = database.getUserPerfumes(userId)
      
      let profileMessage = `👤 *پروفایل مشاوره شما:*\n\n`
      profileMessage += `🌸 *نام:* ${user?.first_name || "عزیز"} ${user?.last_name || ""}\n`
      profileMessage += `💬 *تعداد گفتگوها:* ${chatHistory.length}\n`

      if (userPerfumes.length > 0) {
        profileMessage += `\n🌹 *عطرهای من:*\n`
        userPerfumes.forEach((perfume, index) => {
          profileMessage += `${index + 1}. **${perfume}**\n`
        })
      }

      if (profile?.context) {
        profileMessage += `\n📌 *اطلاعات ذخیره شده:*\n${profile.context}\n`
      }

      profileMessage += `\n💡 می‌خوای یک مشاوره جدید شروع کنیم؟ فقط بگو دنبال چه عطری هستی!\n`
      profileMessage += `\`/myperfumes\` - مدیریت عطرهای من`

      await this.sendFormattedMessage(msg.chat.id, profileMessage)
    })

    // Set context command
    this.bot.onText(/\/setcontext (.+)/, async (msg, match) => {
      this.logMessage(msg, "command: /setcontext")
      const userId = msg.from.id
      const context = match[1]

      aiService.updateUserContext(userId, context)
      await this.sendFormattedMessage(msg.chat.id, `✨ *اطلاعات ذخیره شد:*\n${context}\n\nحالا می‌تونم بهتر بهت مشاوره بدم! 🌸`)
    })

    // My perfumes command - show inline keyboard to select perfumes
    this.bot.onText(/\/myperfumes/, async (msg) => {
      this.logMessage(msg, "command: /myperfumes")
      const userId = msg.from.id
      
      // Get user's current perfumes
      const userPerfumes = database.getUserPerfumes(userId)
      
      // Get all available perfumes
      const allPerfumes = knowledgeBase.getPerfumeTitles()
      
      if (allPerfumes.length === 0) {
        await this.sendFormattedMessage(msg.chat.id, "❌ *خطا*\n\nفایل لیست عطرها پیدا نشد.")
        return
      }

      // Create inline keyboard with perfume buttons
      const keyboard = this.createPerfumeKeyboard(allPerfumes, userPerfumes)
      
      let message = `🌸 *عطرهای من*\n\n`
      if (userPerfumes.length > 0) {
        message += `*عطرهای انتخاب شده:*\n`
        userPerfumes.forEach((perfume, index) => {
          message += `${index + 1}. **${perfume}**\n`
        })
        message += `\n`
      } else {
        message += `هنوز عطری انتخاب نکردی.\n\n`
      }
      message += `برای اضافه یا حذف کردن عطر، دکمه مربوطه رو بزن:`

      await this.bot.sendMessage(msg.chat.id, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: keyboard
        }
      })
    })

    // Handle callback queries (button clicks)
    this.bot.on('callback_query', async (query) => {
      const userId = query.from.id
      const chatId = query.message.chat.id
      const data = query.data
      const messageId = query.message.message_id

      this.logMessage(query, "callback_query")

      // Handle perfume selection/deselection
      if (data.startsWith('perfume_')) {
        const action = data.split('_')[1] // 'add' or 'remove'
        const perfumeName = data.substring(data.indexOf('_', data.indexOf('_') + 1) + 1) // Extract perfume name

        try {
          if (action === 'add') {
            const added = database.addUserPerfume(userId, perfumeName)
            if (added) {
              await this.bot.answerCallbackQuery(query.id, {
                text: `✅ ${perfumeName} اضافه شد`,
                show_alert: false
              })
            } else {
              await this.bot.answerCallbackQuery(query.id, {
                text: `⚠️ این عطر قبلاً اضافه شده`,
                show_alert: false
              })
            }
          } else if (action === 'remove') {
            const removed = database.removeUserPerfume(userId, perfumeName)
            if (removed) {
              await this.bot.answerCallbackQuery(query.id, {
                text: `✅ ${perfumeName} حذف شد`,
                show_alert: false
              })
            } else {
              await this.bot.answerCallbackQuery(query.id, {
                text: `⚠️ این عطر در لیست شما نیست`,
                show_alert: false
              })
            }
          }

          // Update the message with new keyboard state
          const userPerfumes = database.getUserPerfumes(userId)
          const allPerfumes = knowledgeBase.getPerfumeTitles()
          const keyboard = this.createPerfumeKeyboard(allPerfumes, userPerfumes)

          let message = `🌸 *عطرهای من*\n\n`
          if (userPerfumes.length > 0) {
            message += `*عطرهای انتخاب شده:*\n`
            userPerfumes.forEach((perfume, index) => {
              message += `${index + 1}. **${perfume}**\n`
            })
            message += `\n`
          } else {
            message += `هنوز عطری انتخاب نکردی.\n\n`
          }
          message += `برای اضافه یا حذف کردن عطر، دکمه مربوطه رو بزن:`

          await this.bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: keyboard
            }
          })
        } catch (error) {
          console.error('Error handling callback query:', error)
          await this.bot.answerCallbackQuery(query.id, {
            text: '❌ خطا در پردازش',
            show_alert: false
          })
        }
      }
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

        // Send response with Markdown formatting
        await this.sendFormattedMessage(msg.chat.id, response)
        console.log("   ✅ Response sent")
      } catch (error) {
        console.error("❌ Error processing message:", error)
        console.error("   Stack:", error.stack)
        try {
          await this.sendFormattedMessage(msg.chat.id, "❌ *متأسفانه خطایی رخ داد*\n\nلطفاً دوباره تلاش کنید.")
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

  async sendFormattedMessage(chatId, text) {
    // Telegram has a limit of 4096 characters per message
    const MAX_MESSAGE_LENGTH = 4000 // Leave some buffer
    
    if (text.length <= MAX_MESSAGE_LENGTH) {
      // Send as single message with Markdown
      try {
        return await this.bot.sendMessage(chatId, text, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        })
      } catch (error) {
        // If Markdown parsing fails, send as plain text
        console.warn('   ⚠️  Markdown parsing failed, sending as plain text:', error.message)
        return await this.bot.sendMessage(chatId, text, {
          disable_web_page_preview: true
        })
      }
    } else {
      // Split long messages into multiple parts
      const parts = this.splitMessage(text, MAX_MESSAGE_LENGTH)
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        const partText = parts.length > 1 
          ? `*[قسمت ${i + 1} از ${parts.length}]*\n\n${part}`
          : part
        
        try {
          await this.bot.sendMessage(chatId, partText, {
            parse_mode: 'Markdown',
            disable_web_page_preview: true
          })
        } catch (error) {
          // If Markdown parsing fails, send as plain text
          console.warn(`   ⚠️  Markdown parsing failed for part ${i + 1}, sending as plain text:`, error.message)
          await this.bot.sendMessage(chatId, part, {
            disable_web_page_preview: true
          })
        }
        
        // Small delay between messages
        if (i < parts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300))
        }
      }
    }
  }

  splitMessage(text, maxLength) {
    const parts = []
    const paragraphs = text.split('\n\n')
    let currentPart = ''
    
    for (const paragraph of paragraphs) {
      if ((currentPart + paragraph + '\n\n').length > maxLength) {
        if (currentPart) {
          parts.push(currentPart.trim())
          currentPart = paragraph + '\n\n'
        } else {
          // Single paragraph is too long, split by sentences
          const sentences = paragraph.split(/[.!?]\s+/)
          for (const sentence of sentences) {
            if ((currentPart + sentence + '. ').length > maxLength) {
              if (currentPart) {
                parts.push(currentPart.trim())
                currentPart = sentence + '. '
              } else {
                // Even single sentence is too long, split by words
                const words = sentence.split(' ')
                for (const word of words) {
                  if ((currentPart + word + ' ').length > maxLength) {
                    if (currentPart) {
                      parts.push(currentPart.trim())
                    }
                    currentPart = word + ' '
                  } else {
                    currentPart += word + ' '
                  }
                }
              }
            } else {
              currentPart += sentence + '. '
            }
          }
        }
      } else {
        currentPart += paragraph + '\n\n'
      }
    }
    
    if (currentPart.trim()) {
      parts.push(currentPart.trim())
    }
    
    return parts.length > 0 ? parts : [text]
  }

  createPerfumeKeyboard(allPerfumes, userPerfumes) {
    const keyboard = []
    const buttonsPerRow = 2 // 2 buttons per row
    
    for (let i = 0; i < allPerfumes.length; i += buttonsPerRow) {
      const row = []
      for (let j = 0; j < buttonsPerRow && i + j < allPerfumes.length; j++) {
        const perfume = allPerfumes[i + j]
        const isSelected = userPerfumes.includes(perfume)
        const emoji = isSelected ? '✅' : '➕'
        const action = isSelected ? 'remove' : 'add'
        
        row.push({
          text: `${emoji} ${perfume}`,
          callback_data: `perfume_${action}_${perfume}`
        })
      }
      keyboard.push(row)
    }
    
    return keyboard
  }

  async sendMessage(chatId, text) {
    return await this.sendFormattedMessage(chatId, text)
  }
}

export default TelegramBotService
