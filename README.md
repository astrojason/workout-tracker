# Health Dashboard

A personal health and workout tracking dashboard built with Next.js and deployed on Vercel.

## Features

- 📊 **Health Metrics Tracking**: Monitor daily steps and calories with streak counters
- 🏋️ **Workout Progress**: Track strength training progress for major lifts (squat, bench, deadlift, OHP, rows)
- 📈 **Data Visualization**: Interactive charts using Recharts
- 🔧 **Plate Calculator**: Smart barbell plate loading calculator based on available equipment
- 📱 **PWA Support**: Works as a Progressive Web App with offline capabilities

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: CSS-in-JS with custom Apple-inspired dark theme
- **Charts**: Recharts
- **Deployment**: Vercel
- **PWA**: Service Worker for offline functionality

## Getting Started

### Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Deployment to Vercel

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Deploy to Vercel**:
   ```bash
   vercel
   ```

3. **Follow the prompts**:
   - Link to existing project or create new
   - Set project name
   - Choose deployment settings

4. **Automatic Deployments**: 
   - Push to `main` branch for automatic production deployments
   - All branches get preview deployments

### Environment Setup

The app loads data from static JSON files in `/public/data/`:
- `goals.json` - Daily goals and strength targets
- `plates.json` - Available barbell plates for calculations
- `stats.json` - Historical workout and health data

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout with metadata
│   ├── page.tsx            # Main dashboard page
│   └── globals.css         # Global styles
public/
├── data/
│   ├── goals.json          # Goals and targets
│   ├── plates.json         # Available plates
│   └── stats.json          # Historical data
├── manifest.json           # PWA manifest
└── service-worker.js       # Service worker for PWA
```

## License

This project is for personal use.
