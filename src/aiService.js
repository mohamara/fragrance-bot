import { ChatOpenAI } from '@langchain/openai';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { config } from './config.js';
import knowledgeBase from './knowledgeBase.js';
import database from './database.js';

class AIService {
  constructor() {
    this.llm = new ChatOpenAI({
      apiKey: config.openai.apiKey,
      model: config.openai.model,
      temperature: config.openai.temperature,
      maxTokens: config.openai.maxTokens,
    });
  }

  async generateResponse(userId, userMessage) {
    try {
      // Get user profile for context
      const profile = database.getProfile(userId);
      const profileContext = profile?.context || '';

      // Get wizard data (age, gender, interests)
      const wizardData = database.getWizardData(userId);

      // Get user's perfumes
      const userPerfumes = database.getUserPerfumes(userId);
      
      // Get excluded perfumes (perfumes user doesn't want to consider)
      const excludedPerfumes = database.getExcludedPerfumes(userId) || [];
      
      // Check if user wants to exclude a perfume in this message
      const excludePatterns = [
        /(?:این|اون)\s*(?:عطر|عطرها)\s*(?:رو|را)\s*(?:در\s*نظر\s*نگیر|نادیده\s*بگیر|حذف\s*کن)/i,
        /(?:در\s*نظر\s*نگیر|نادیده\s*بگیر|حذف\s*کن)\s*(?:این|اون)\s*(?:عطر|عطرها)/i,
        /(?:نمی‌خوام|نمی‌خواهم)\s*(?:این|اون)\s*(?:عطر|عطرها)\s*(?:رو|را)/i,
        /(?:بدون|بدون\s*در\s*نظر\s*گرفتن)\s*(?:این|اون)\s*(?:عطر|عطرها)/i
      ];
      
      let shouldExcludePerfume = false;
      let perfumeToExclude = null;
      
      // Check if user wants to exclude a perfume
      for (const pattern of excludePatterns) {
        if (pattern.test(userMessage)) {
          shouldExcludePerfume = true;
          // Try to extract perfume name from message
          const perfumeMatch = userMessage.match(/\*\*([^*]+)\*\*/); // Match **perfume name**
          if (perfumeMatch) {
            perfumeToExclude = perfumeMatch[1].trim();
          } else {
            // Try to find perfume name from user's perfumes list
            for (const perfume of userPerfumes) {
              if (userMessage.includes(perfume)) {
                perfumeToExclude = perfume;
                break;
              }
            }
          }
          break;
        }
      }
      
      // If user wants to exclude a perfume, add it to excluded list
      if (shouldExcludePerfume && perfumeToExclude) {
        database.addExcludedPerfume(userId, perfumeToExclude);
        excludedPerfumes.push(perfumeToExclude);
      }

      // Get chat history
      const chatHistory = database.getChatHistory(userId, 10);
      
      // Get all knowledge base content (all .txt files)
      let knowledgeContext = '';
      if (knowledgeBase.isLoaded()) {
        const allContent = knowledgeBase.getAllContent();
        if (allContent && allContent.length > 0) {
          knowledgeContext = `\n\n📚 پایگاه دانش کامل - تمام اطلاعات عطرهای موجود:\n${allContent}\n`;
        }
      }
      
      // Build user perfumes context
      let userPerfumesContext = '';
      if (userPerfumes.length > 0) {
        const availablePerfumes = userPerfumes.filter(p => !excludedPerfumes.includes(p));
        if (availablePerfumes.length > 0) {
          userPerfumesContext = `\n\n🌹 *عطرهای موجود کاربر (حتماً در مشاوره در نظر بگیر):*\n`;
          userPerfumesContext += availablePerfumes.map(p => `- **${p}**`).join('\n');
          userPerfumesContext += `\n\n⚠️ *مهم:* این عطرها را کاربر در اختیار دارد و حتماً باید در مشاوره‌ها و پیشنهادات در نظر گرفته شوند. می‌توانی از این عطرها برای ترکیب‌سازی یا پیشنهاد مستقیم استفاده کنی.`;
        }
      }
      
      // Build excluded perfumes context
      let excludedPerfumesContext = '';
      if (excludedPerfumes.length > 0) {
        excludedPerfumesContext = `\n\n❌ *عطرهای حذف شده (در مشاوره در نظر نگیر):*\n`;
        excludedPerfumesContext += excludedPerfumes.map(p => `- **${p}**`).join('\n');
        excludedPerfumesContext += `\n\n⚠️ *مهم:* این عطرها را کاربر نمی‌خواهد در مشاوره در نظر گرفته شوند. هرگز این عطرها را پیشنهاد نده یا در ترکیب‌ها استفاده نکن.`;
      }

      // Build wizard data context (age, gender, interests)
      let wizardDataContext = '';
      if (wizardData) {
        const genderNames = {
          'male': 'مرد',
          'female': 'زن',
          'other': 'ترجیح می‌دهم نگویم'
        };
        const interestNames = {
          'warm': '🔥 گرم',
          'cool': '❄️ خنک',
          'sweet': '🍯 شیرین',
          'bitter': '☕ تلخ',
          'spicy': '🌶️ تند',
          'mild': '🌿 ملایم',
          'woody': '🪵 چوبی',
          'floral': '🌺 گلی',
          'fresh': '🍃 تازه',
          'oriental': '🕌 شرقی',
          'citrus': '🍊 مرکبات',
          'vanilla': '🌰 وانیلی'
        };

        wizardDataContext = `\n\n👤 *اطلاعات پروفایل کاربر (حتماً در مشاوره اعمال کن):*\n`;
        wizardDataContext += `🔢 *بازه سنی:* ${wizardData.age} سال\n`;
        wizardDataContext += `👤 *جنسیت:* ${genderNames[wizardData.gender]}\n`;
        
        if (wizardData.interests && wizardData.interests.length > 0) {
          wizardDataContext += `👃 *ذائقه بویایی:*\n`;
          wizardData.interests.forEach(interestId => {
            wizardDataContext += `   ${interestNames[interestId]}\n`;
          });
        }

        const workTypeNames = {
          'athlete': '🏃 ورزشکار',
          'manager': '👔 مدیر',
          'employee': '💼 کارمند',
          'government': '🏛️ دولتی',
          'private': '🏢 خصوصی',
          'freelancer': '💻 فریلنسر',
          'student': '🎓 دانشجو',
          'teacher': '📚 معلم',
          'doctor': '⚕️ پزشک',
          'artist': '🎨 هنرمند',
          'entrepreneur': '🚀 کارآفرین',
          'merchant': '💼 تاجر',
          'marketer': '📊 بازاری',
          'architect': '🏗️ معمار',
          'goldsmith': '💎 طلا فروش',
          'other': '🔷 سایر'
        };

        if (wizardData.workType) {
          wizardDataContext += `💼 *تیپ شخصیت کاری:* ${workTypeNames[wizardData.workType]}\n`;
        }

        wizardDataContext += `\n⚠️ *خیلی مهم:* این اطلاعات را حتماً در مشاوره‌ها و پیشنهادات در نظر بگیر:\n`;
        wizardDataContext += `- سن کاربر: ${wizardData.age} سال - عطرهای مناسب این بازه سنی را پیشنهاد بده\n`;
        wizardDataContext += `- جنسیت: ${genderNames[wizardData.gender]} - عطرهای متناسب با این جنسیت را در نظر بگیر\n`;
        if (wizardData.interests && wizardData.interests.length > 0) {
          wizardDataContext += `- ذائقه بویایی: ${wizardData.interests.map(id => interestNames[id]).join('، ')} - عطرهایی که با این ذائقه‌های بویایی هماهنگ هستند را پیشنهاد بده. این ذائقه‌ها نشان می‌دهد کاربر چه نوع بوهایی را دوست دارد (گرم، سرد، شیرین، تلخ، تند، ملایم، چوبی، گلی، تازه، شرقی، مرکبات، وانیلی)\n`;
        }
        if (wizardData.workType) {
          wizardDataContext += `- تیپ شخصیت کاری: ${workTypeNames[wizardData.workType]} - عطرهایی را پیشنهاد بده که با این تیپ شخصیت کاری هماهنگ باشند. برای مثال:\n`;
          wizardDataContext += `  • ورزشکار: عطرهای تازه و انرژی‌بخش\n`;
          wizardDataContext += `  • مدیر/کارمند: عطرهای حرفه‌ای و ملایم\n`;
          wizardDataContext += `  • دولتی/خصوصی: عطرهای رسمی و مناسب محیط کار\n`;
          wizardDataContext += `  • فریلنسر/کارآفرین: عطرهای منحصر به فرد و خلاقانه\n`;
          wizardDataContext += `  • دانشجو/معلم: عطرهای جوان و شاداب\n`;
          wizardDataContext += `  • پزشک: عطرهای ملایم و غیر مزاحم\n`;
          wizardDataContext += `  • هنرمند: عطرهای خلاقانه و منحصر به فرد\n`;
          wizardDataContext += `  • تاجر/بازاری: عطرهای اعتماد‌بخش و حرفه‌ای\n`;
          wizardDataContext += `  • معمار: عطرهای خلاقانه و مدرن\n`;
          wizardDataContext += `  • طلا فروش: عطرهای لوکس و گران‌بها\n`;
        }
        wizardDataContext += `- این اطلاعات را در توصیفات و پیشنهادات خود اعمال کن و عطرهایی را پیشنهاد بده که با سن، جنسیت، ذائقه بویایی و تیپ شخصیت کاری کاربر هماهنگ باشند`;
      }

      // Build system prompt for perfume consultant
      const systemPrompt = `تو برترین مشاور در حوزه عطر و اسانس در دنیا هستی که میتوانی با طبعی شاعرانه و قدرت کلام بالا و با توجه به شخصیت هر کس و نوع زندگی و کار و درخواست او از عطر برترین مشاوره ها رو در انتخاب و ترکیب عطر ها بدی.

${knowledgeContext ? `\n📚 عطرهای موجود در مجموعه:\n${knowledgeContext}\n` : ''}
${userPerfumesContext}
${excludedPerfumesContext}
${wizardDataContext}

دستورالعمل‌های مهم:
${wizardData ? '- **خیلی مهم:** کاربر اطلاعات پروفایل (سن، جنسیت، علاقه‌مندی‌ها) را تکمیل کرده. حتماً این اطلاعات را در تمام مشاوره‌ها و پیشنهادات اعمال کن. عطرهایی را پیشنهاد بده که با سن، جنسیت و علاقه‌مندی‌های کاربر هماهنگ باشند.' : ''}
${userPerfumes.length > 0 && userPerfumes.filter(p => !excludedPerfumes.includes(p)).length > 0 ? '- **خیلی مهم:** کاربر عطرهایی دارد که در بخش "عطرهای من" ثبت کرده. حتماً این عطرها را در مشاوره‌ها و پیشنهادات در نظر بگیر. می‌توانی از این عطرها برای ترکیب‌سازی یا پیشنهاد مستقیم استفاده کنی. این عطرها اولویت دارند.' : ''}
${excludedPerfumes.length > 0 ? '- **خیلی مهم:** کاربر عطرهایی را مشخص کرده که نمی‌خواهد در مشاوره در نظر گرفته شوند. هرگز این عطرها را پیشنهاد نده یا در ترکیب‌ها استفاده نکن.' : ''}
- عطرها محدود به مستنداتی هستند که برایت فرستاده شده، ولی در مشاوره می‌توانی به بوهای طبیعی و ترکیبشان با عطرهای موجود ارجاع بدی
- از هر کس سوالاتی بپرس که دانشت رو نسبت بهش و درخواستش قوی‌تر کنی و پاسخ درست بدی در صورت نیاز
- در ترکیب‌سازی طوری رفتار کن که با عطرهای موجود خروجی مناسب بگیری. مثلاً: "عطر این رو بزن بعد ۲ ساعت دقیقا روی همون این یکی عطر رو بزن" یا "اول یک پاف از این ۳ پاف از اون"
- در توصیف عطرها عمیق شو طوری که مخاطب مجذوب بشه و بخره
- برای کشف روحیات طرف و ویژگی‌های صحنه مورد درخواست مشتری سوالات مختصر ولی دقیق بپرس
- هرگز نگو "روحیه‌ت به چی بیشتر میخوره؟" - به جای آن سوالات خلاقانه‌تر بپرس
- در مشاوره‌هات احساس و رنگ و بو رو بیشتر ارائه بده و خیلی از حال و هوای عطر حرف بزن. خیلی خشک نگو "مناسب فلان چیز" - آب و تاب بده
- مثال عالی: "فقط یک پاف روی مچ دست راست، جایی که هنگام اشاره یا برداشتن فنجان، بو آزاد میشه"
- در پاسخ‌هایت حتماً زمانبندی و نقاط زدن عطر رو به دقت ارائه بده همچنین استایل متناسبش رو هم پیشنهاد بده
- وقتی داری از نت‌ها حرف می‌زنی دقیق بگو چه احساسی رو داره منتقل می‌کنه و توصیف شاعرانه‌ای داشته باش ازش
- حافظه هر چت برای خودش هست و با چت‌های دیگه ترکیب نکن

${profileContext ? `\n📌 اطلاعات قبلی کاربر: ${profileContext}` : ''}

همیشه با زبان شاعرانه، احساسی و جذاب صحبت کن. توصیفاتت باید مخاطب رو مجذوب کنه و به خرید ترغیب کنه.

**فرمت پاسخ برای تلگرام (Markdown):**
- از Markdown برای فرمت‌بندی استفاده کن: *italic* برای تاکید، **bold** برای نام عطرها و نکات مهم
- پاسخ‌ها را به پاراگراف‌های کوتاه و خوانا تقسیم کن (هر پاراگراف 2-3 خط)
- از emoji ها به صورت مناسب و زیبا استفاده کن
- نام عطرها را با **bold** بنویس (مثلاً: **نام عطر**)
- نکات مهم و کلیدی را با **bold** مشخص کن
- زمانبندی و نقاط زدن عطر را با \`code\` یا **bold** مشخص کن
- برای لیست‌ها از • یا - استفاده کن
- پاسخ را زیبا و خوانا فرمت کن تا در تلگرام عالی به نظر برسه
- از خطوط خالی بین پاراگراف‌ها استفاده کن برای خوانایی بهتر`;

      // Convert chat history to LangChain format
      const historyMessages = chatHistory.map(msg => ({
        role: msg.role === 'user' ? 'human' : 'ai',
        content: msg.content,
      }));

      // Create prompt template
      const prompt = ChatPromptTemplate.fromMessages([
        ['system', systemPrompt],
        new MessagesPlaceholder('history'),
        ['human', '{input}'],
      ]);

      // Create chain
      const chain = prompt.pipe(this.llm);

      // Generate response
      const response = await chain.invoke({
        input: userMessage,
        history: historyMessages,
      });

      const aiResponse = response.content;

      // Save messages to database
      database.addMessage(userId, 'user', userMessage);
      database.addMessage(userId, 'assistant', aiResponse);

      return aiResponse;
    } catch (error) {
      console.error('Error generating AI response:', error);
      throw error;
    }
  }

  async updateUserContext(userId, context) {
    database.updateProfileContext(userId, context);
  }
}

export default new AIService();

