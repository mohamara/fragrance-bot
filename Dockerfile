# استفاده از Node.js LTS به عنوان base image
FROM node:20-alpine AS base

# نصب dependencies مورد نیاز برای کامپایل native modules
RUN apk add --no-cache python3 make g++ sqlite

# تنظیم working directory
WORKDIR /app

# کپی فایل‌های package
COPY package*.json ./

# Stage برای build
FROM base AS builder

# نصب تمام dependencies (شامل dev dependencies)
RUN npm ci

# کپی تمام فایل‌های پروژه
COPY . .

# Stage نهایی - فقط runtime dependencies
FROM node:20-alpine AS production

# نصب sqlite runtime library و su-exec (مورد نیاز برای better-sqlite3 و user switching)
RUN apk add --no-cache sqlite su-exec

# تنظیم working directory
WORKDIR /app

# کپی package.json
COPY --from=builder /app/package*.json ./

# کپی node_modules از builder (شامل compiled native modules)
COPY --from=builder /app/node_modules ./node_modules

# کپی فایل‌های پروژه
COPY --from=builder /app/src ./src
COPY --from=builder /app/knowledge_base ./knowledge_base

# کپی entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# ایجاد پوشه‌های مورد نیاز
RUN mkdir -p /app/data

# تنظیم کاربر غیر root برای امنیت
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app && \
    chmod -R 755 /app/data

# Set entrypoint (runs as root to fix permissions, then switches to nodejs)
# Note: USER directive is handled in entrypoint script
ENTRYPOINT ["docker-entrypoint.sh"]

# Expose port (در صورت نیاز)
# EXPOSE 3000

# متغیرهای محیطی
ENV NODE_ENV=production

# دستور اجرا
CMD ["node", "src/index.js"]

