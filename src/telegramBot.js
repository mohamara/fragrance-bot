import TelegramBot from "node-telegram-bot-api"
import { config } from "./config.js"
import database from "./database.js"
import aiService from "./aiService.js"
import knowledgeBase from "./knowledgeBase.js"

class TelegramBotService {
  constructor() {
    // Wizard state management
    this.wizardStates = new Map() // userId -> { step, data }
    
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

از منوی پایین صفحه می‌تونی به راحتی به دستورات دسترسی داشته باشی! 📱

حالا بگو، دنبال چه عطری هستی؟ یا می‌خوای ترکیبی خاص بسازی؟ 💭`

      // Send welcome message with menu keyboard
      await this.bot.sendMessage(msg.chat.id, welcomeMessage, {
        parse_mode: 'Markdown',
        reply_markup: this.getMainMenuKeyboard()
      })
    })

    // Help command
    this.bot.onText(/\/help/, async (msg) => {
      this.logMessage(msg, "command: /help")
      const helpMessage = `🌹 *راهنمای مشاور عطر*

*دستورات:*
/start - شروع مشاوره
/help - این راهنما
/clear - شروع مشاوره جدید (پاک کردن تاریخچه)
/profile - اطلاعات پروفایل شما
/wizard - تکمیل پروفایل (سن، جنسیت، علاقه‌مندی‌ها)
/myperfumes - مدیریت عطرهای من
/menu - نمایش منوی اصلی

*نحوه استفاده:*
فقط بگو دنبال چه عطری هستی یا چه سوالی داری! من:
• از مجموعه عطرهای موجود استفاده می‌کنم
• سوالات دقیق می‌پرسم تا بهترین پیشنهاد رو بدم
• ترکیب‌های خلاقانه بهت یاد می‌دم
• با توصیفات شاعرانه و عمیق، حال و هوای عطرها رو برات زنده می‌کنم
• زمانبندی و نقاط دقیق زدن عطر رو بهت می‌گم

*نکته:* می‌تونی از منوی پایین صفحه هم استفاده کنی! 📱

بیا شروع کنیم! 💫`

      await this.bot.sendMessage(msg.chat.id, helpMessage, {
        parse_mode: 'Markdown',
        reply_markup: this.getMainMenuKeyboard()
      })
    })

    // Clear chat history
    this.bot.onText(/\/clear/, async (msg) => {
      this.logMessage(msg, "command: /clear")
      const userId = msg.from.id
      database.clearChatHistory(userId)
      await this.bot.sendMessage(msg.chat.id, "✨ *تاریخچه پاک شد*\n\nآماده‌ام برای یک مشاوره جدید! بگو دنبال چه عطری هستی؟ 🌸", {
        parse_mode: 'Markdown',
        reply_markup: this.getMainMenuKeyboard()
      })
    })

    // Profile command
    this.bot.onText(/\/profile/, async (msg) => {
      this.logMessage(msg, "command: /profile")
      const userId = msg.from.id
      const user = database.getUser(userId)
      const profile = database.getProfile(userId)
      const chatHistory = database.getChatHistory(userId)
      const wizardData = database.getWizardData(userId)

      const userPerfumes = database.getUserPerfumes(userId)
      
      let profileMessage = `👤 *پروفایل مشاوره شما:*\n\n`
      profileMessage += `🌸 *نام:* ${user?.first_name || "عزیز"} ${user?.last_name || ""}\n`
      profileMessage += `💬 *تعداد گفتگوها:* ${chatHistory.length}\n`

      // Show wizard data if available
      if (wizardData) {
        const genderNames = {
          'male': 'مرد',
          'female': 'زن',
          'other': 'ترجیح می‌دهم نگویم'
        }
        const interestNames = {
          'sports': '⚽ ورزش',
          'music': '🎵 موسیقی',
          'travel': '✈️ سفر',
          'art': '🎨 هنر',
          'technology': '💻 تکنولوژی',
          'nature': '🌳 طبیعت',
          'fashion': '👗 مد و فشن',
          'books': '📚 کتاب و مطالعه',
          'cinema': '🎬 سینما و فیلم',
          'cooking': '🍳 آشپزی'
        }

        profileMessage += `\n📋 *اطلاعات پروفایل:*\n`
        profileMessage += `   🔢 *سن:* ${wizardData.age} سال\n`
        profileMessage += `   👤 *جنسیت:* ${genderNames[wizardData.gender]}\n`
        if (wizardData.interests && wizardData.interests.length > 0) {
          profileMessage += `   🎯 *علاقه‌مندی‌ها:*\n`
          wizardData.interests.forEach(interestId => {
            profileMessage += `      ${interestNames[interestId]}\n`
          })
        }
      } else {
        profileMessage += `\n💡 *نکته:* برای دریافت پیشنهادات بهتر، پروفایل خود را تکمیل کن!\n`
        profileMessage += `   از دکمه "✨ تکمیل پروفایل" یا دستور /wizard استفاده کن.\n`
      }

      if (userPerfumes.length > 0) {
        profileMessage += `\n🌹 *عطرهای من:*\n`
        userPerfumes.forEach((perfume, index) => {
          profileMessage += `${index + 1}. **${perfume}**\n`
        })
      }

      if (profile?.context) {
        profileMessage += `\n📌 *اطلاعات اضافی:*\n${profile.context}\n`
      }

      profileMessage += `\n💡 می‌خوای یک مشاوره جدید شروع کنیم؟ فقط بگو دنبال چه عطری هستی!`

      await this.bot.sendMessage(msg.chat.id, profileMessage, {
        parse_mode: 'Markdown',
        reply_markup: this.getMainMenuKeyboard()
      })
    })

    // Set context command
    this.bot.onText(/\/setcontext (.+)/, async (msg, match) => {
      this.logMessage(msg, "command: /setcontext")
      const userId = msg.from.id
      const context = match[1]

      aiService.updateUserContext(userId, context)
      await this.sendFormattedMessage(msg.chat.id, `✨ *اطلاعات ذخیره شد:*\n${context}\n\nحالا می‌تونم بهتر بهت مشاوره بدم! 🌸`)
    })

    // Wizard command - start profile wizard
    this.bot.onText(/\/wizard/, async (msg) => {
      this.logMessage(msg, "command: /wizard")
      const userId = msg.from.id
      await this.startWizard(userId, msg.chat.id)
    })

    // Menu command - show main menu
    this.bot.onText(/\/menu/, async (msg) => {
      this.logMessage(msg, "command: /menu")
      await this.bot.sendMessage(msg.chat.id, '📋 *منوی اصلی*', {
        parse_mode: 'Markdown',
        reply_markup: this.getMainMenuKeyboard()
      })
    })

    // My perfumes command - show inline keyboard to select perfumes
    this.bot.onText(/\/myperfumes/, async (msg) => {
      this.logMessage(msg, "command: /myperfumes")
      const userId = msg.from.id
      
      // Get user's current perfumes
      const userPerfumes = database.getUserPerfumes(userId)
      const excludedPerfumes = database.getExcludedPerfumes(userId)
      
      // Get all available perfumes
      const allPerfumes = knowledgeBase.getPerfumeTitles()
      
      if (allPerfumes.length === 0) {
        await this.bot.sendMessage(msg.chat.id, "❌ *خطا*\n\nفایل لیست عطرها پیدا نشد.", {
          parse_mode: 'Markdown',
          reply_markup: this.getMainMenuKeyboard()
        })
        return
      }

      // Create inline keyboard with perfume buttons
      const keyboard = this.createPerfumeKeyboard(allPerfumes, userPerfumes, excludedPerfumes)
      
      let message = `🌸 *عطرهای من*\n\n`
      if (userPerfumes.length > 0) {
        const availablePerfumes = userPerfumes.filter(p => !excludedPerfumes.includes(p))
        const excluded = userPerfumes.filter(p => excludedPerfumes.includes(p))
        
        if (availablePerfumes.length > 0) {
          message += `*عطرهای موجود (در مشاوره در نظر گرفته می‌شوند):*\n`
          availablePerfumes.forEach((perfume, index) => {
            message += `${index + 1}. **${perfume}** ✅\n`
          })
          message += `\n`
        }
        
        if (excluded.length > 0) {
          message += `*عطرهای حذف شده (در مشاوره در نظر گرفته نمی‌شوند):*\n`
          excluded.forEach((perfume, index) => {
            message += `${index + 1}. **${perfume}** ❌\n`
          })
          message += `\n`
        }
      } else {
        message += `هنوز عطری انتخاب نکردی.\n\n`
      }
      message += `💡 *راهنما:*\n`
      message += `• برای اضافه/حذف عطر از لیست، دکمه مربوطه رو بزن\n`
      message += `• برای exclude کردن عطر (در مشاوره در نظر گرفته نشود)، روی عطر بزن و بعد دکمه "❌ در نظر نگیر" رو بزن\n`
      message += `• عطرهای exclude شده با ❌ نشان داده می‌شوند`

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

      // Handle wizard callbacks
      if (data.startsWith('wizard_')) {
        await this.handleWizardCallback(query)
        return
      }

      // Handle separator (do nothing)
      if (data === 'separator') {
        await this.bot.answerCallbackQuery(query.id, {
          text: '',
          show_alert: false
        })
        return
      }

      // Handle perfume selection/deselection
      if (data.startsWith('perfume_')) {
        const action = data.split('_')[1] // 'add', 'remove', 'exclude', 'unexclude'
        const perfumeName = data.substring(data.indexOf('_', data.indexOf('_') + 1) + 1) // Extract perfume name

        try {
          if (action === 'add') {
            const added = database.addUserPerfume(userId, perfumeName)
            // Remove from excluded if it was excluded
            database.removeExcludedPerfume(userId, perfumeName)
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
            // Also remove from excluded
            database.removeExcludedPerfume(userId, perfumeName)
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
          } else if (action === 'exclude') {
            // Add to excluded list (must be in user perfumes first)
            const userPerfumes = database.getUserPerfumes(userId)
            if (userPerfumes.includes(perfumeName)) {
              const excluded = database.addExcludedPerfume(userId, perfumeName)
              if (excluded) {
                await this.bot.answerCallbackQuery(query.id, {
                  text: `✅ ${perfumeName} از مشاوره حذف شد`,
                  show_alert: false
                })
              } else {
                await this.bot.answerCallbackQuery(query.id, {
                  text: `⚠️ این عطر قبلاً حذف شده`,
                  show_alert: false
                })
              }
            } else {
              await this.bot.answerCallbackQuery(query.id, {
                text: `⚠️ ابتدا عطر را به لیست اضافه کن`,
                show_alert: false
              })
            }
          } else if (action === 'unexclude') {
            // Remove from excluded list
            const removed = database.removeExcludedPerfume(userId, perfumeName)
            if (removed) {
              await this.bot.answerCallbackQuery(query.id, {
                text: `✅ ${perfumeName} دوباره در مشاوره در نظر گرفته می‌شود`,
                show_alert: false
              })
            } else {
              await this.bot.answerCallbackQuery(query.id, {
                text: `⚠️ این عطر در لیست حذف شده نیست`,
                show_alert: false
              })
            }
          }

          // Update the message with new keyboard state
          const userPerfumes = database.getUserPerfumes(userId)
          const excludedPerfumes = database.getExcludedPerfumes(userId)
          const allPerfumes = knowledgeBase.getPerfumeTitles()
          const keyboard = this.createPerfumeKeyboard(allPerfumes, userPerfumes, excludedPerfumes)

          let message = `🌸 *عطرهای من*\n\n`
          if (userPerfumes.length > 0) {
            const availablePerfumes = userPerfumes.filter(p => !excludedPerfumes.includes(p))
            const excluded = userPerfumes.filter(p => excludedPerfumes.includes(p))
            
            if (availablePerfumes.length > 0) {
              message += `*عطرهای موجود (در مشاوره در نظر گرفته می‌شوند):*\n`
              availablePerfumes.forEach((perfume, index) => {
                message += `${index + 1}. **${perfume}** ✅\n`
              })
              message += `\n`
            }
            
            if (excluded.length > 0) {
              message += `*عطرهای حذف شده (در مشاوره در نظر گرفته نمی‌شوند):*\n`
              excluded.forEach((perfume, index) => {
                message += `${index + 1}. **${perfume}** ❌\n`
              })
              message += `\n`
            }
          } else {
            message += `هنوز عطری انتخاب نکردی.\n\n`
          }
          message += `💡 *راهنما:*\n`
          message += `• برای اضافه/حذف عطر از لیست، دکمه مربوطه رو بزن\n`
          message += `• برای exclude کردن عطر (در مشاوره در نظر گرفته نشود)، روی عطر بزن و بعد دکمه "❌ در نظر نگیر" رو بزن\n`
          message += `• عطرهای exclude شده با ❌ نشان داده می‌شوند`

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

      // Handle menu button clicks
      if (msg.text) {
        const menuActions = {
          '🌸 عطرهای من': async () => {
            const userId = msg.from.id
            const userPerfumes = database.getUserPerfumes(userId)
            const excludedPerfumes = database.getExcludedPerfumes(userId)
            const allPerfumes = knowledgeBase.getPerfumeTitles()
            
            if (allPerfumes.length === 0) {
              await this.bot.sendMessage(msg.chat.id, "❌ *خطا*\n\nفایل لیست عطرها پیدا نشد.", {
                parse_mode: 'Markdown',
                reply_markup: this.getMainMenuKeyboard()
              })
              return
            }

            const keyboard = this.createPerfumeKeyboard(allPerfumes, userPerfumes, excludedPerfumes)
            let message = `🌸 *عطرهای من*\n\n`
            if (userPerfumes.length > 0) {
              const availablePerfumes = userPerfumes.filter(p => !excludedPerfumes.includes(p))
              const excluded = userPerfumes.filter(p => excludedPerfumes.includes(p))
              
              if (availablePerfumes.length > 0) {
                message += `*عطرهای موجود (در مشاوره در نظر گرفته می‌شوند):*\n`
                availablePerfumes.forEach((perfume, index) => {
                  message += `${index + 1}. **${perfume}** ✅\n`
                })
                message += `\n`
              }
              
              if (excluded.length > 0) {
                message += `*عطرهای حذف شده (در مشاوره در نظر گرفته نمی‌شوند):*\n`
                excluded.forEach((perfume, index) => {
                  message += `${index + 1}. **${perfume}** ❌\n`
                })
                message += `\n`
              }
            } else {
              message += `هنوز عطری انتخاب نکردی.\n\n`
            }
            message += `💡 *راهنما:*\n`
            message += `• برای اضافه/حذف عطر از لیست، دکمه مربوطه رو بزن\n`
            message += `• برای exclude کردن عطر (در مشاوره در نظر گرفته نشود)، روی عطر بزن و بعد دکمه "❌ در نظر نگیر" رو بزن\n`
            message += `• عطرهای exclude شده با ❌ نشان داده می‌شوند`

            await this.bot.sendMessage(msg.chat.id, message, {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: keyboard
              }
            })
            return true
          },
          '👤 پروفایل من': async () => {
            const userId = msg.from.id
            const user = database.getUser(userId)
            const profile = database.getProfile(userId)
            const chatHistory = database.getChatHistory(userId)
            const wizardData = database.getWizardData(userId)
            const userPerfumes = database.getUserPerfumes(userId)
            
            let profileMessage = `👤 *پروفایل مشاوره شما:*\n\n`
            profileMessage += `🌸 *نام:* ${user?.first_name || "عزیز"} ${user?.last_name || ""}\n`
            profileMessage += `💬 *تعداد گفتگوها:* ${chatHistory.length}\n`

            // Show wizard data if available
            if (wizardData) {
              const genderNames = {
                'male': 'مرد',
                'female': 'زن',
                'other': 'ترجیح می‌دهم نگویم'
              }
              const interestNames = {
                'sports': '⚽ ورزش',
                'music': '🎵 موسیقی',
                'travel': '✈️ سفر',
                'art': '🎨 هنر',
                'technology': '💻 تکنولوژی',
                'nature': '🌳 طبیعت',
                'fashion': '👗 مد و فشن',
                'books': '📚 کتاب و مطالعه',
                'cinema': '🎬 سینما و فیلم',
                'cooking': '🍳 آشپزی'
              }

              profileMessage += `\n📋 *اطلاعات پروفایل:*\n`
              profileMessage += `   🔢 *سن:* ${wizardData.age} سال\n`
              profileMessage += `   👤 *جنسیت:* ${genderNames[wizardData.gender]}\n`
              if (wizardData.interests && wizardData.interests.length > 0) {
                profileMessage += `   🎯 *علاقه‌مندی‌ها:*\n`
                wizardData.interests.forEach(interestId => {
                  profileMessage += `      ${interestNames[interestId]}\n`
                })
              }
            } else {
              profileMessage += `\n💡 *نکته:* برای دریافت پیشنهادات بهتر، پروفایل خود را تکمیل کن!\n`
              profileMessage += `   از دکمه "✨ تکمیل پروفایل" یا دستور /wizard استفاده کن.\n`
            }

            if (userPerfumes.length > 0) {
              profileMessage += `\n🌹 *عطرهای من:*\n`
              userPerfumes.forEach((perfume, index) => {
                profileMessage += `${index + 1}. **${perfume}**\n`
              })
            }

            if (profile?.context) {
              profileMessage += `\n📌 *اطلاعات اضافی:*\n${profile.context}\n`
            }

            profileMessage += `\n💡 می‌خوای یک مشاوره جدید شروع کنیم؟ فقط بگو دنبال چه عطری هستی!`

            await this.bot.sendMessage(msg.chat.id, profileMessage, {
              parse_mode: 'Markdown',
              reply_markup: this.getMainMenuKeyboard()
            })
            return true
          },
          '🔄 مشاوره جدید': async () => {
            const userId = msg.from.id
            database.clearChatHistory(userId)
            await this.bot.sendMessage(msg.chat.id, "✨ *تاریخچه پاک شد*\n\nآماده‌ام برای یک مشاوره جدید! بگو دنبال چه عطری هستی؟ 🌸", {
              parse_mode: 'Markdown',
              reply_markup: this.getMainMenuKeyboard()
            })
            return true
          },
          '❓ راهنما': async () => {
            const helpMessage = `🌹 *راهنمای مشاور عطر*

*دستورات:*
/start - شروع مشاوره
/help - این راهنما
/clear - شروع مشاوره جدید (پاک کردن تاریخچه)
/profile - اطلاعات پروفایل شما
/wizard - تکمیل پروفایل (سن، جنسیت، علاقه‌مندی‌ها)
/myperfumes - مدیریت عطرهای من
/menu - نمایش منوی اصلی

*نحوه استفاده:*
فقط بگو دنبال چه عطری هستی یا چه سوالی داری! من:
• از مجموعه عطرهای موجود استفاده می‌کنم
• سوالات دقیق می‌پرسم تا بهترین پیشنهاد رو بدم
• ترکیب‌های خلاقانه بهت یاد می‌دم
• با توصیفات شاعرانه و عمیق، حال و هوای عطرها رو برات زنده می‌کنم
• زمانبندی و نقاط دقیق زدن عطر رو بهت می‌گم

*نکته:* می‌تونی از منوی پایین صفحه هم استفاده کنی! 📱

بیا شروع کنیم! 💫`

            await this.bot.sendMessage(msg.chat.id, helpMessage, {
              parse_mode: 'Markdown',
              reply_markup: this.getMainMenuKeyboard()
            })
            return true
          },
          '📋 منو': async () => {
            await this.bot.sendMessage(msg.chat.id, '📋 *منوی اصلی*', {
              parse_mode: 'Markdown',
              reply_markup: this.getMainMenuKeyboard()
            })
            return true
          },
          '✨ تکمیل پروفایل': async () => {
            const userId = msg.from.id
            await this.startWizard(userId, msg.chat.id)
            return true
          },
          '❌ مخفی کردن منو': async () => {
            await this.bot.sendMessage(msg.chat.id, '✅ منو مخفی شد. برای نمایش مجدد از دستور /menu استفاده کن.', {
              parse_mode: 'Markdown',
              reply_markup: { remove_keyboard: true }
            })
            return true
          }
        }

        if (menuActions[msg.text]) {
          console.log(`   📱 Menu button clicked: ${msg.text}`)
          await menuActions[msg.text]()
          return
        }
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

        // Send response with Markdown formatting and menu keyboard
        await this.sendFormattedMessageWithMenu(msg.chat.id, response)
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

  async sendFormattedMessageWithMenu(chatId, text) {
    // Telegram has a limit of 4096 characters per message
    const MAX_MESSAGE_LENGTH = 4000 // Leave some buffer
    
    if (text.length <= MAX_MESSAGE_LENGTH) {
      // Send as single message with Markdown and menu
      try {
        return await this.bot.sendMessage(chatId, text, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
          reply_markup: this.getMainMenuKeyboard()
        })
      } catch (error) {
        // If Markdown parsing fails, send as plain text
        console.warn('   ⚠️  Markdown parsing failed, sending as plain text:', error.message)
        return await this.bot.sendMessage(chatId, text, {
          disable_web_page_preview: true,
          reply_markup: this.getMainMenuKeyboard()
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
          // Only add menu to last part
          const replyMarkup = i === parts.length - 1 ? this.getMainMenuKeyboard() : undefined
          await this.bot.sendMessage(chatId, partText, {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            reply_markup: replyMarkup
          })
        } catch (error) {
          // If Markdown parsing fails, send as plain text
          console.warn(`   ⚠️  Markdown parsing failed for part ${i + 1}, sending as plain text:`, error.message)
          const replyMarkup = i === parts.length - 1 ? this.getMainMenuKeyboard() : undefined
          await this.bot.sendMessage(chatId, part, {
            disable_web_page_preview: true,
            reply_markup: replyMarkup
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

  getMainMenuKeyboard() {
    return {
      keyboard: [
        [
          { text: '🌸 عطرهای من' },
          { text: '👤 پروفایل من' }
        ],
        [
          { text: '✨ تکمیل پروفایل' },
          { text: '🔄 مشاوره جدید' }
        ],
        [
          { text: '❓ راهنما' },
          { text: '📋 منو' }
        ],
        [
          { text: '❌ مخفی کردن منو' }
        ]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    }
  }

  createPerfumeKeyboard(allPerfumes, userPerfumes, excludedPerfumes = []) {
    const keyboard = []
    const buttonsPerRow = 2 // 2 buttons per row
    
    for (let i = 0; i < allPerfumes.length; i += buttonsPerRow) {
      const row = []
      for (let j = 0; j < buttonsPerRow && i + j < allPerfumes.length; j++) {
        const perfume = allPerfumes[i + j]
        const isSelected = userPerfumes.includes(perfume)
        const isExcluded = excludedPerfumes.includes(perfume)
        
        let emoji, action
        if (isExcluded) {
          // Excluded perfume - show unexclude option
          emoji = '❌'
          action = 'unexclude'
        } else if (isSelected) {
          // Perfume is in user's list but not excluded - show remove option
          emoji = '✅'
          action = 'remove'
        } else {
          // Perfume is not in user's list - show add option
          emoji = '➕'
          action = 'add'
        }
        
        row.push({
          text: `${emoji} ${perfume}`,
          callback_data: `perfume_${action}_${perfume}`
        })
      }
      keyboard.push(row)
    }
    
    // Add a separator and exclude/unexclude buttons for user's perfumes
    if (userPerfumes.length > 0) {
      keyboard.push([{ text: '━━━━━━━━━━━━━━━━', callback_data: 'separator' }])
      
      // Add exclude/unexclude buttons for each user perfume
      userPerfumes.forEach((perfume) => {
        const isExcluded = excludedPerfumes.includes(perfume)
        const row = []
        
        if (isExcluded) {
          row.push({
            text: `🔄 فعال کردن: ${perfume}`,
            callback_data: `perfume_unexclude_${perfume}`
          })
        } else {
          row.push({
            text: `🚫 در نظر نگیر: ${perfume}`,
            callback_data: `perfume_exclude_${perfume}`
          })
        }
        
        keyboard.push(row)
      })
    }
    
    return keyboard
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

  async sendMessage(chatId, text) {
    return await this.sendFormattedMessage(chatId, text)
  }

  // ==================== Wizard Methods ====================

  async startWizard(userId, chatId) {
    // Initialize wizard state
    this.wizardStates.set(userId, {
      step: 'age',
      data: {
        age: null,
        gender: null,
        interests: []
      }
    })

    await this.showWizardStep(userId, chatId, 'age')
  }

  async showWizardStep(userId, chatId, step) {
    const wizardState = this.wizardStates.get(userId)
    if (!wizardState) {
      await this.bot.sendMessage(chatId, '❌ خطا در ویزارد. لطفاً دوباره /wizard را بزنید.', {
        parse_mode: 'Markdown',
        reply_markup: this.getMainMenuKeyboard()
      })
      return
    }

    switch (step) {
      case 'age':
        await this.showAgeStep(chatId)
        break
      case 'gender':
        await this.showGenderStep(chatId)
        break
      case 'interests':
        await this.showInterestsStep(chatId, wizardState.data.interests)
        break
      case 'complete':
        await this.completeWizard(userId, chatId, wizardState.data)
        break
    }
  }

  async showAgeStep(chatId) {
    const message = `🌸 *مرحله ۱ از ۳: سن شما*

لطفاً بازه سنی خود را انتخاب کنید:`

    const keyboard = {
      inline_keyboard: [
        [
          { text: '🔵 18-25 سال', callback_data: 'wizard_age_18-25' },
          { text: '🔵 26-30 سال', callback_data: 'wizard_age_26-30' }
        ],
        [
          { text: '🔵 31-35 سال', callback_data: 'wizard_age_31-35' },
          { text: '🔵 36-40 سال', callback_data: 'wizard_age_36-40' }
        ],
        [
          { text: '🔵 41-45 سال', callback_data: 'wizard_age_41-45' },
          { text: '🔵 46-50 سال', callback_data: 'wizard_age_46-50' }
        ],
        [
          { text: '🔵 بالای 50 سال', callback_data: 'wizard_age_50+' }
        ]
      ]
    }

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    })
  }

  async showGenderStep(chatId) {
    const message = `🌸 *مرحله ۲ از ۳: جنسیت*

لطفاً جنسیت خود را انتخاب کنید:`

    const keyboard = {
      inline_keyboard: [
        [
          { text: '👨 مرد', callback_data: 'wizard_gender_male' },
          { text: '👩 زن', callback_data: 'wizard_gender_female' }
        ],
        [
          { text: '🌈 ترجیح می‌دهم نگویم', callback_data: 'wizard_gender_other' }
        ]
      ]
    }

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    })
  }

  async showInterestsStep(chatId, selectedInterests) {
    const interests = [
      { id: 'sports', name: '⚽ ورزش', emoji: '⚽' },
      { id: 'music', name: '🎵 موسیقی', emoji: '🎵' },
      { id: 'travel', name: '✈️ سفر', emoji: '✈️' },
      { id: 'art', name: '🎨 هنر', emoji: '🎨' },
      { id: 'technology', name: '💻 تکنولوژی', emoji: '💻' },
      { id: 'nature', name: '🌳 طبیعت', emoji: '🌳' },
      { id: 'fashion', name: '👗 مد و فشن', emoji: '👗' },
      { id: 'books', name: '📚 کتاب و مطالعه', emoji: '📚' },
      { id: 'cinema', name: '🎬 سینما و فیلم', emoji: '🎬' },
      { id: 'cooking', name: '🍳 آشپزی', emoji: '🍳' }
    ]

    const message = `🌸 *مرحله ۳ از ۳: علاقه‌مندی‌ها*

لطفاً علاقه‌مندی‌های خود را انتخاب کنید (می‌تونی چند تا انتخاب کنی):

${selectedInterests.length > 0 ? `*انتخاب شده:* ${selectedInterests.map(i => interests.find(int => int.id === i)?.emoji || '').join(' ')}\n\n` : ''}بعد از انتخاب علاقه‌مندی‌ها، دکمه "✅ تکمیل" را بزن.`

    const keyboard = {
      inline_keyboard: []
    }

    // Add interest buttons (2 per row)
    for (let i = 0; i < interests.length; i += 2) {
      const row = []
      for (let j = 0; j < 2 && i + j < interests.length; j++) {
        const interest = interests[i + j]
        const isSelected = selectedInterests.includes(interest.id)
        const emoji = isSelected ? '✅' : interest.emoji
        row.push({
          text: `${emoji} ${interest.name}`,
          callback_data: `wizard_interest_${interest.id}`
        })
      }
      keyboard.inline_keyboard.push(row)
    }

    // Add complete button
    keyboard.inline_keyboard.push([
      { text: '✅ تکمیل و ذخیره', callback_data: 'wizard_complete' }
    ])

    await this.bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    })
  }

  async handleWizardCallback(query) {
    const userId = query.from.id
    const chatId = query.message.chat.id
    const messageId = query.message.message_id
    const data = query.data

    const wizardState = this.wizardStates.get(userId)
    if (!wizardState) {
      await this.bot.answerCallbackQuery(query.id, {
        text: '❌ ویزارد یافت نشد. لطفاً /wizard را بزنید.',
        show_alert: false
      })
      return
    }

    try {
      if (data.startsWith('wizard_age_')) {
        const age = data.replace('wizard_age_', '')
        wizardState.data.age = age
        wizardState.step = 'gender'
        
        await this.bot.answerCallbackQuery(query.id, {
          text: `✅ سن ${age} سال انتخاب شد`,
          show_alert: false
        })

        // Edit message to show completion
        await this.bot.editMessageText('✅ *سن انتخاب شد*\n\nدر حال انتقال به مرحله بعد...', {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown'
        })

        await this.showWizardStep(userId, chatId, 'gender')
      } else if (data.startsWith('wizard_gender_')) {
        const gender = data.replace('wizard_gender_', '')
        const genderNames = {
          'male': 'مرد',
          'female': 'زن',
          'other': 'ترجیح می‌دهم نگویم'
        }
        wizardState.data.gender = gender
        wizardState.step = 'interests'
        
        await this.bot.answerCallbackQuery(query.id, {
          text: `✅ ${genderNames[gender]} انتخاب شد`,
          show_alert: false
        })

        // Edit message to show completion
        await this.bot.editMessageText('✅ *جنسیت انتخاب شد*\n\nدر حال انتقال به مرحله بعد...', {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown'
        })

        await this.showWizardStep(userId, chatId, 'interests')
      } else if (data.startsWith('wizard_interest_')) {
        const interestId = data.replace('wizard_interest_', '')
        const interests = wizardState.data.interests || []
        
        if (interests.includes(interestId)) {
          // Remove interest
          wizardState.data.interests = interests.filter(i => i !== interestId)
          await this.bot.answerCallbackQuery(query.id, {
            text: '✅ علاقه‌مندی حذف شد',
            show_alert: false
          })
        } else {
          // Add interest
          wizardState.data.interests.push(interestId)
          await this.bot.answerCallbackQuery(query.id, {
            text: '✅ علاقه‌مندی اضافه شد',
            show_alert: false
          })
        }

        // Update the message
        await this.showInterestsStep(chatId, wizardState.data.interests)
        await this.bot.deleteMessage(chatId, messageId)
      } else if (data === 'wizard_complete') {
        if (wizardState.data.interests.length === 0) {
          await this.bot.answerCallbackQuery(query.id, {
            text: '⚠️ لطفاً حداقل یک علاقه‌مندی انتخاب کنید',
            show_alert: true
          })
          return
        }

        wizardState.step = 'complete'
        await this.bot.answerCallbackQuery(query.id, {
          text: '✅ در حال ذخیره...',
          show_alert: false
        })

        await this.completeWizard(userId, chatId, wizardState.data)
        await this.bot.deleteMessage(chatId, messageId)
      }
    } catch (error) {
      console.error('Error handling wizard callback:', error)
      await this.bot.answerCallbackQuery(query.id, {
        text: '❌ خطا در پردازش',
        show_alert: false
      })
    }
  }

  async completeWizard(userId, chatId, wizardData) {
    try {
      // Save wizard data to database
      database.saveWizardData(userId, wizardData)

      // Clear wizard state
      this.wizardStates.delete(userId)

      // Build summary message
      const genderNames = {
        'male': 'مرد',
        'female': 'زن',
        'other': 'ترجیح می‌دهم نگویم'
      }

      const interestNames = {
        'sports': '⚽ ورزش',
        'music': '🎵 موسیقی',
        'travel': '✈️ سفر',
        'art': '🎨 هنر',
        'technology': '💻 تکنولوژی',
        'nature': '🌳 طبیعت',
        'fashion': '👗 مد و فشن',
        'books': '📚 کتاب و مطالعه',
        'cinema': '🎬 سینما و فیلم',
        'cooking': '🍳 آشپزی'
      }

      let summaryMessage = `✨ *ویزارد پروفایل تکمیل شد!*\n\n`
      summaryMessage += `📋 *خلاصه اطلاعات شما:*\n\n`
      summaryMessage += `🔢 *سن:* ${wizardData.age} سال\n`
      summaryMessage += `👤 *جنسیت:* ${genderNames[wizardData.gender]}\n`
      summaryMessage += `🎯 *علاقه‌مندی‌ها:*\n`
      
      wizardData.interests.forEach(interestId => {
        summaryMessage += `   ${interestNames[interestId]}\n`
      })

      summaryMessage += `\n💫 حالا می‌تونم بهتر و دقیق‌تر عطر مناسب رو بهت پیشنهاد بدم!\n\n`
      summaryMessage += `بگو دنبال چه عطری هستی؟ 🌸`

      await this.bot.sendMessage(chatId, summaryMessage, {
        parse_mode: 'Markdown',
        reply_markup: this.getMainMenuKeyboard()
      })
    } catch (error) {
      console.error('Error completing wizard:', error)
      await this.bot.sendMessage(chatId, '❌ *خطا در ذخیره اطلاعات*\n\nلطفاً دوباره تلاش کنید.', {
        parse_mode: 'Markdown',
        reply_markup: this.getMainMenuKeyboard()
      })
    }
  }
}

export default TelegramBotService
