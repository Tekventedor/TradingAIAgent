# Flowhunt AI Trading Bot Dashboard

A comprehensive trading dashboard that displays real-time data from an autonomous AI trading bot running on Flowhunt. Monitors portfolio performance, stock positions, and AI decision-making with complete transparency.

## 🎯 Project Overview

This dashboard visualizes the performance of an AI trading agent built with **Flowhunt** that autonomously runs **every 24 hours**:
- Fetches live market data from the **last 24 hours only** (Polygon API)
- Gathers news and sentiment via Google Search
- Analyzes market conditions using AI (GPT-4 via FlowHunt)
- Makes BUY/SELL/HOLD/SHORT decisions with full reasoning
- Executes trades via Alpaca Paper Trading API
- Logs all decisions and reasoning to Google Sheets for complete transparency

**Results**: +1.85% return, outperforming S&P 500 by +3.05% in October 2025 (24 trades across 11 stocks)

### Key Architecture Features:
- **24-Hour Cycle**: Agent runs once per day, analyzing only fresh data from the last 24 hours
- **Multi-Source Data**: Combines Polygon (market data), Google Search (news/sentiment), Alpaca (portfolio state)
- **Autonomous Execution**: Fully hands-off trading with risk management rules built-in
- **Complete Audit Trail**: Every decision logged to Google Sheets with timestamp, reasoning, and confidence score
- **Shorting Capability**: Agent can short stocks on high confidence + downtrend signals
- **Data Reconstruction**: Dashboard fills missing historical data using logs and synthetic generation

## ✨ Features

### Core Dashboard
- 🤖 **AI Trading Bot Integration** - Real-time data from Flowhunt AI agent
- 📊 **Live Portfolio Metrics** - Portfolio value, P&L, invested in stocks, buying power
- 📈 **Stock Performance Charts** - Multi-line charts showing current and historical positions
- 📉 **Benchmark Comparisons** - AI performance vs. S&P 500 and NASDAQ-100
- 💼 **Position Tracking** - Current holdings with live prices and unrealized P&L
- 📝 **Activity Log** - Complete order history with AI reasoning for each trade
- 🧠 **AI Reasoning Display** - Full decision logs from Google Sheets integration
- 🎯 **Win Rate Tracking** - Percentage of profitable closed trades with color indicators

### Advanced Features
- 📅 **Historical Data Reconstruction** - Fills missing trade data from user logs (persistent_cache_2)
- ⏱️ **Portfolio History Extension** - Automatically fills gaps from last API data to current time
- 📊 **Smart Trade Filtering** - Stock lines only display during actual holding periods
- 🎯 **Custom Tooltips** - Centered on cursor with dynamic height, respects chart boundaries
- 🔄 **Date Mapping System** - Corrects order submission vs execution date discrepancies

### Performance Features
- 🔄 **Smart Caching** - In-memory caching for all API data (Alpaca 5min, market data 7 days)
- ⚡ **Fast Loading** - Parallel data fetching (~800ms load time)
- 🎨 **Beautiful UI** - Responsive Tailwind design with interactive Recharts
- 📱 **Mobile Friendly** - Works on all devices
- 🌐 **No Authentication** - Public dashboard, no login required

## 🏗️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Trading API**: Alpaca Paper Trading API
- **Market Data**: Alpha Vantage API (free tier, 25 calls/day)
- **AI Reasoning**: Google Sheets (CSV export)
- **Charts**: Recharts
- **Deployment**: Vercel (or localhost)
- **Icons**: Lucide React

## 📁 Project Structure

```
TradingAIAgent/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── alpaca/route.ts       # Main API with caching
│   │   │   └── reasoning/route.ts    # Google Sheets integration
│   │   ├── dashboard/page.tsx        # Dashboard loader
│   │   └── page.tsx                  # Landing page
│   └── components/
│       └── StaticDashboard.tsx       # Main dashboard component (1700+ lines)
├── public/
│   └── flowhunt-logo.svg
├── blog_images/                      # All dashboard and FlowHunt screenshots
├── BLOG_COMPLETE_AI_TRADING_BOT.md  # Comprehensive blog (9,500 words)
└── README.md                         # This file
```

## 🚀 Setup

### 1. Environment Variables

Create `.env.local`:

```bash
# Alpaca API (Paper Trading) - Free at https://alpaca.markets
ALPACA_API_KEY=your_alpaca_api_key
ALPACA_SECRET_KEY=your_alpaca_secret_key

# Alpha Vantage API (Market Data) - Free at https://www.alphavantage.co
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key

# Optional: Google Sheets for AI reasoning logs
GOOGLE_SHEET_ID=your_google_sheet_id
```

### 2. Install & Run

```bash
npm install
npm run dev
```

Open http://localhost:3000/dashboard

## 📊 Dashboard Sections

### 1. **Header Stats Cards**
- 💰 Total Balance (Cash + holdings)
- 📈 Week Return (7-day performance)
- 📊 Invested in Stocks (% of portfolio in stocks)
- 💵 Buying Power (cash available for new trades)
- 🎯 Win Rate (% of profitable closed trades with color coding)

### 2. **Stock Performance Chart** (60% width)
- Multi-line chart showing individual stock performance
- Real-time P&L percentage for each position
- Logarithmic Y-axis for wide value ranges
- Interactive tooltips with trade details

### 3. **Activity Log** (40% width)
- Chronological trading history (last 100 trades)
- BUY/SELL indicators with color coding
- AI reasoning integration (click to expand)
- Position tracking (shows 0→10 OPENED, 10→0 CLOSED)

### 4. **Portfolio Value Chart**
- Historical portfolio value over time
- Buy/sell trade markers (▲ green, ▼ red)
- Tooltips show all trades at that moment (4-column grid layout)
- Max/Min/Avg statistics

### 5. **Historical Trades Chart** (70% width)
- Shows ALL trades ever made (including closed positions)
- Dotted lines for historical positions
- **Smart filtering**: Lines only appear during actual holding periods (first buy to last sell)
- Lines automatically "cut off" when position closes
- Accurate P&L calculations based on actual trade windows
- Stats cards on the left (2-Day Return, Win Rate)

### 6. **AI vs. S&P 500 Chart**
- Purple line: AI Portfolio percentage return
- Cyan line: S&P 500 Index
- Shows outperformance/underperformance
- Trade markers on comparison chart

### 7. **AI vs. NASDAQ-100 Chart**
- Purple line: AI Portfolio
- Red line: NASDAQ-100 Index
- Same features as S&P 500 comparison

### 8. **Agent Distribution Pie Chart**
- Position allocation by stock
- Color-coded by ticker
- Percentage labels

### 9. **Current Positions Table**
- Stock ticker symbols with color indicators
- Shares, avg buy price, current price
- Total value and profit/loss ($ and %)

## 🔧 API Endpoints

### `GET /api/alpaca?endpoint={endpoint}`

Proxy for Alpaca API with built-in caching.

**Endpoints:**
- `account` - Account information (cached 5 minutes)
- `positions` - Current positions (cached 5 minutes)
- `orders` - Order history, limit=100 (cached 5 minutes)
- `portfolio-history` - 1 month hourly data (cached 5 minutes)
- `spy-bars` - SPY historical data (cached 7 days)
- `qqq-bars` - QQQ historical data (cached 7 days)
- `stock-bars` - Any stock historical data (cached 7 days)
- `cache-status` - View current cache status

**Examples:**
```bash
# Get account info
curl http://localhost:3000/api/alpaca?endpoint=account

# Get SPY historical bars
curl "http://localhost:3000/api/alpaca?endpoint=spy-bars&start=2024-10-01T00:00:00.000Z&end=2024-10-31T23:59:59.999Z"

# View cache status
curl http://localhost:3000/api/alpaca?endpoint=cache-status
```

### `GET /api/reasoning`

Fetches AI reasoning logs from Google Sheets.

**Returns:**
```json
[
  {
    "timestamp": "2024-10-06 10:30",
    "ticker": "SPY",
    "reasoning": "Market showing strong bullish momentum..."
  }
]
```

## 🔄 Data Reconstruction System

### Historical Data Recovery

The dashboard includes a sophisticated data reconstruction system in `persistent_cache_2/`:

**Problem Solved:**
- Alpaca paper trading data only goes back to Oct 10, 2025
- Missing trades before that date (e.g., Oct 6 LRCX purchase)
- Discrepancies between order submission dates and execution dates

**Solution:**
1. **Trade Reconstruction** - Missing trades reconstructed from user logs with reasoning
2. **Date Mapping** - `user_log_date_mappings.json` corrects submission vs execution dates
3. **Portfolio Snapshots** - Hourly snapshots with 2+ points per day minimum
4. **Alpha Vantage Integration** - Historical price data for reconstructed trades

**Files:**
- `reconstructed_oct6_trade.json` - Missing LRCX trade (80 shares @ $141.91)
- `user_log_date_mappings.json` - Order date corrections for LMND, AMCR, QURE
- `daily_portfolio_snapshots_oct6-10.json` - Historical portfolio values
- `RECONSTRUCTION_SUMMARY.md` - Full documentation of the process
- `COMPARISON_TABLE.md` - Trade-by-trade verification

### Portfolio History Extension

The dashboard automatically extends portfolio history from the last Alpaca data point to the current time:

```typescript
// If last data point is > 1 hour old, fill hourly gaps
const hoursToFill = Math.ceil((now - lastTimestampMs) / (60 * 60 * 1000));
for (let i = 1; i <= hoursToFill; i++) {
  historyData.timestamp.push(newTimestamp);
  historyData.equity.push(currentEquity);
}
```

This ensures graphs always show data up to the current moment, even when Alpaca data is stale.

## 💾 Caching System

### How It Works

All data is cached in-memory to reduce API calls and improve performance:

**Alpaca Data** (5-minute cache):
- Account information
- Positions
- Orders
- Portfolio history

**Market Data** (7-day cache):
- SPY bars
- QQQ bars
- Individual stock bars

### Cache Benefits

1. **Faster Loading**: Second page load ~100ms instead of ~3 seconds
2. **API Limit Protection**: Alpha Vantage free tier = 25 calls/day
3. **Resilience**: Dashboard works even if APIs are slow/down
4. **Better UX**: No waiting for API calls on refresh

### Cache Verification

Console logs show cache status:
```
📦 Account: Using cached data (2m old)
🌐 SPY: Fetching fresh data from Alpha Vantage API...
✅ SPY: Cached for 7 days (174 bars)
```

View complete cache status:
```bash
curl http://localhost:3000/api/alpaca?endpoint=cache-status
```

Output example:
```
📊 ========== CACHE STATUS ==========
✅ VALID | alpaca-account                       | Age: 3m
✅ VALID | alpaca-positions                     | Age: 3m
✅ VALID | alpaca-orders                        | Age: 3m
✅ VALID | spy-bars:2024-10-05:2024-10-31      | Age: 2h 15m
✅ VALID | stock-bars:INTC:2024-10-05:2024-10-31| Age: 1h 45m
====================================
```

**Note**: Cache clears on server restart (acceptable for development)

## 🎨 Chart Features

### Synthetic Data Generation

For stocks without Alpha Vantage data, the system generates realistic sine wave patterns based on actual buy/sell orders:

```typescript
// Generates hourly bars between buy and sell with:
// - Linear trend from buy price to sell price
// - Sine wave oscillation (±3% amplitude)
// - Random noise (±1%)
```

This ensures all traded stocks appear on charts even without market data.

### Interactive Tooltips

**Smart Positioning:**
- Centered on cursor position (both X and Y axes)
- Dynamic height calculation based on number of stocks displayed
- Prevents overflow below x-axis (reserves 100px for date labels)
- Prevents overflow off screen edges
- Smooth following of cursor movement

**Content:**
- **Single trade**: Compact tooltip with trade details
- **Multiple trades**: Expands to 4-column grid layout
- **Shows**: Symbol, action, quantity, price, position change, P&L percentage

### Color Palette

10 unique colors for stock positions:
```typescript
const COLORS = [
  '#8b5cf6', // Purple
  '#22d3ee', // Cyan
  '#f59e0b', // Amber
  '#10b981', // Green
  '#ef4444', // Red
  '#ec4899', // Pink
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#a855f7', // Violet
];
```

## 🔍 Development

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

### TypeScript

All components are fully typed:
```typescript
interface SnapshotData {
  timestamp: string;
  account: Account;
  positions: Position[];
  portfolioHistory: PortfolioHistory;
  orders: Order[];
  spyData: SPYData | null;
  qqqData: QQQData | null;
  stockData: Record<string, StockData>;
  reasoning: ReasoningEntry[];
}
```

## 🚢 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

**Environment Variables Required:**
- `ALPACA_API_KEY`
- `ALPACA_SECRET_KEY`
- `ALPHA_VANTAGE_API_KEY`
- `GOOGLE_SHEET_ID` (optional)

Auto-deploys on every push to `main`.

### Alternative: Localhost Only

If you don't deploy, the in-memory cache works perfectly on localhost:
```bash
npm run dev
# Keep server running - cache persists until restart
```

## 📈 Performance Results

**October 2025 Trading Summary:**
- Starting Capital: $100,000
- Ending Value: $101,847
- Return: +1.85%
- S&P 500 Return: -1.2%
- **Outperformance: +3.05%**
- NASDAQ-100 comparison also tracked

**Trade Statistics:**
- Total Trades: 24
- Win Rate: 58.3%
- Average Win: +2.1%
- Average Loss: -1.3%
- Best Trade: QURE +15.2%
- Worst Trade: CLSK -8.5%

## 🐛 Troubleshooting

### Dashboard Shows No Data

1. Check browser console for errors
2. Verify API keys in `.env.local`
3. Ensure Alpaca account has trades
4. Check cache status: `/api/alpaca?endpoint=cache-status`

### Alpaca API Errors (500)

The caching system prevents most errors. If you see errors:
1. Wait 30 seconds and refresh (may be temporary API issue)
2. Check cache - if data is cached, it will load from cache
3. Verify API keys are correct

### Alpha Vantage Rate Limit

**Free tier**: 25 calls/day

**Solution**: Caching! Data is cached for 7 days:
- First load: Uses all 13 API calls (SPY, QQQ, 11 stocks)
- Subsequent loads: Uses 0 API calls (all from cache)
- Refresh daily: Only uses 4 calls (Alpaca data)

### Charts Not Showing

1. Open browser console
2. Look for data verification table:
   ```
   ========== STOCK DATA VERIFICATION ==========
   SPY    ✅ 174 bars    Closed    Buy: $677.09    Sell: $668.38
   INTC   ✅ 151 bars    Open      Buy: $40.54     Sell: N/A (Open)
   ```
3. If all show ❌ Missing, check Alpha Vantage API key

### TypeScript Build Errors

```bash
npm run build
# Fix any type errors shown
```

## 📚 Documentation

See the comprehensive blog post in this repository:
- **BLOG_COMPLETE_AI_TRADING_BOT.md** - Complete guide covering:
  - Understanding FlowHunt platform
  - Building the autonomous agent (24h cycle, data sources, decision logic)
  - Evolution from v1 (analysis only) to v4 (with shorting)
  - Building the Next.js dashboard (charts, caching, data reconstruction)
  - Performance analysis and lessons learned
  - 9,500 words, ~38 min read, with 21 screenshots

## 🔐 Security Notes

- ✅ API keys stored server-side only (`.env.local`)
- ✅ All API calls proxied through Next.js API routes
- ✅ No API keys exposed to client
- ✅ Public dashboard shows data only (no trading controls)
- ⚠️ Uses Alpaca **paper trading** API (not real money)

## 🤝 Contributing

Pull requests welcome! Please ensure:
- TypeScript types are correct
- Code is formatted with Prettier
- Caching logic is preserved
- Console logging follows emoji pattern
- UI changes are responsive

## 📄 License

MIT

## 🙏 Acknowledgments

- **Flowhunt** - AI agent orchestration platform
- **Alpaca** - Paper trading API
- **Alpha Vantage** - Free market data API
- **Vercel** - Hosting and deployment

---

**⚠️ Disclaimer**: This project uses Alpaca's **paper trading** API for educational purposes. Past performance does not guarantee future results. Never use live trading credentials without proper testing and risk management.

**🤖 Powered by**: Flowhunt AI | Built with Claude Code

**📧 Questions?** See the blog posts for detailed implementation guides.

**Last Updated**: November 14, 2025

## 🆕 Recent Changes (November 2025)

- ✅ Added NASDAQ-100 benchmark comparison (alongside S&P 500)
- ✅ Combined blog posts into single comprehensive guide (BLOG_COMPLETE_AI_TRADING_BOT.md)
- ✅ Added 21 screenshots showing FlowHunt agent and dashboard evolution
- ✅ Updated README with 24-hour cycle architecture details
- ✅ Improved documentation with shorting capability and data reconstruction details
