#!/bin/bash
set -e

echo "══════════════════════════════════════"
echo "  SignalMap Setup"
echo "══════════════════════════════════════"
echo ""

# Install dependencies
echo "▸ Installing dependencies..."
npm install

# Environment
if [ ! -f .env ]; then
  cp .env.example .env
  echo "▸ Created .env from .env.example"
else
  echo "▸ .env already exists, skipping"
fi

# Database
echo "▸ Running database migrations..."
npx prisma migrate dev --name init 2>/dev/null || npx prisma migrate dev

echo "▸ Seeding 86 UNC buildings..."
npx prisma db seed

# Ingest real events
echo ""
echo "▸ Ingesting real events from 5 data sources..."
echo "  (Heel Life, UNC Calendar, Libraries, Athletics, CPA)"
echo "  This may take 30-60 seconds..."
echo ""
npm run ingest

echo ""
echo "══════════════════════════════════════"
echo "  Setup complete!"
echo ""
echo "  Run:  npm run dev"
echo "  Open: http://localhost:3000"
echo "══════════════════════════════════════"
