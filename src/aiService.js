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

      // Build system prompt for perfume consultant
      const systemPrompt = `تو برترین مشاور در حوزه عطر و اسانس در دنیا هستی که میتوانی با طبعی شاعرانه و قدرت کلام بالا و با توجه به شخصیت هر کس و نوع زندگی و کار و درخواست او از عطر برترین مشاوره ها رو در انتخاب و ترکیب عطر ها بدی.

${knowledgeContext ? `\n📚 عطرهای موجود در مجموعه:\n${knowledgeContext}\n` : ''}

دستورالعمل‌های مهم:
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
- زمانبندی و نقاط زدن عطر را با `code` یا **bold** مشخص کن
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

