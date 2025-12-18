#!/bin/bash

echo "🚀 در حال راه‌اندازی پروژه ربات هوشمند..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 ایجاد فایل .env از .env.example..."
    cp .env.example .env
    echo "⚠️  لطفاً فایل .env را ویرایش کرده و کلیدهای API را وارد کنید!"
fi

# Create necessary directories
echo "📁 ایجاد پوشه‌های لازم..."
mkdir -p knowledge_base
mkdir -p data

# Install dependencies
echo "📦 در حال نصب وابستگی‌ها..."
npm install

echo ""
echo "✅ راه‌اندازی کامل شد!"
echo ""
echo "📋 مراحل بعدی:"
echo "1. فایل .env را ویرایش کرده و کلیدهای API را وارد کنید"
echo "2. فایل‌های متنی خود را در پوشه knowledge_base قرار دهید"
echo "3. با دستور 'npm start' ربات را اجرا کنید"
echo ""

