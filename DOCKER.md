# راهنمای Docker

این راهنما نحوه اجرای پروژه با Docker را توضیح می‌دهد.

## پیش‌نیازها

- Docker (نسخه 20.10 یا بالاتر)
- Docker Compose (نسخه 2.0 یا بالاتر)

## راه‌اندازی سریع

### 1. تنظیم متغیرهای محیطی

فایل `.env.example` را کپی کرده و به `.env` تغییر نام دهید:

```bash
cp .env.example .env
```

سپس فایل `.env` را ویرایش کرده و مقادیر زیر را وارد کنید:

```env
OPENAI_API_KEY=your_openai_api_key_here
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
```

### 2. ساخت و اجرای کانتینر

با استفاده از Docker Compose:

```bash
# ساخت و اجرای کانتینر
docker-compose up -d

# مشاهده لاگ‌ها
docker-compose logs -f

# توقف کانتینر
docker-compose down
```

یا با استفاده از Docker مستقیم:

```bash
# ساخت image
docker build -t ldora-ai-bot .

# اجرای کانتینر
docker run -d \
  --name ldora-ai-bot \
  --restart unless-stopped \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/knowledge_base:/app/knowledge_base:ro \
  ldora-ai-bot

# مشاهده لاگ‌ها
docker logs -f ldora-ai-bot
```

## مدیریت کانتینر

### مشاهده وضعیت

```bash
docker-compose ps
```

### مشاهده لاگ‌ها

```bash
# لاگ‌های زنده
docker-compose logs -f

# آخرین 100 خط لاگ
docker-compose logs --tail=100
```

### توقف و راه‌اندازی مجدد

```bash
# توقف
docker-compose stop

# راه‌اندازی مجدد
docker-compose start

# راه‌اندازی مجدد با rebuild
docker-compose up -d --build
```

### حذف کانتینر

```bash
# توقف و حذف کانتینر
docker-compose down

# حذف همراه با volumes (⚠️ داده‌ها پاک می‌شوند)
docker-compose down -v
```

## ساختار Volumes

پروژه از volumes زیر استفاده می‌کند:

- `./data` - پایگاه داده SQLite (persistent)
- `./knowledge_base` - فایل‌های پایگاه دانش (read-only)

## به‌روزرسانی

برای به‌روزرسانی پروژه:

```bash
# دریافت آخرین تغییرات
git pull

# rebuild و restart
docker-compose up -d --build
```

## عیب‌یابی

### بررسی لاگ‌های خطا

```bash
docker-compose logs ldora-bot | grep -i error
```

### ورود به کانتینر

```bash
docker-compose exec ldora-bot sh
```

### بررسی وضعیت سلامت

```bash
docker-compose ps
```

کانتینر باید در وضعیت `healthy` باشد.

## تنظیمات پیشرفته

### تغییر پورت (در صورت نیاز)

در `docker-compose.yml` می‌توانید پورت را expose کنید:

```yaml
ports:
  - "3000:3000"
```

### تنظیمات منابع

می‌توانید محدودیت منابع را در `docker-compose.yml` تنظیم کنید:

```yaml
deploy:
  resources:
    limits:
      cpus: '1'
      memory: 512M
    reservations:
      cpus: '0.5'
      memory: 256M
```

## نکات امنیتی

1. **هرگز فایل `.env` را commit نکنید**
2. از secrets management برای production استفاده کنید
3. کاربر کانتینر به صورت non-root اجرا می‌شود
4. knowledge_base به صورت read-only mount شده است

