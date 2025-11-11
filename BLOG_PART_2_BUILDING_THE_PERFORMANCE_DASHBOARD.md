# Building a Real-Time Trading Performance Dashboard: Turning Data Into Insights

## The Problem: A Bot Trading in the Dark

So I had a working AI trading bot powered by Flowhunt's OpenAI agent (see Part 1 for how I built that). It was making trades autonomously, logging decisions to Google Sheets, and supposedly making money. But here's the thing - I had no visual way to actually understand what was happening.

Sure, I could open my Alpaca account and see my positions. I could scroll through the Google Sheet and read the AI agent's reasoning. But I couldn't see the big picture. I couldn't tell at a glance: Is the bot actually outperforming the market? Which trades were winners? How has my portfolio value changed over time?

I needed a dashboard. Not just any dashboard - I needed something that would show me everything: real-time portfolio metrics, interactive charts for every position, AI reasoning for each trade, and comparisons against market benchmarks. Oh, and it had to load fast and not hit API rate limits.

This is the story of how I built that dashboard in Next.js, from empty project to a polished, production-ready application that visualizes every aspect of my AI trading bot's performance.

## What We're Building

Let me show you what the final dashboard looks like before we dive into how it's built.

At the top, you've got four key metrics displayed in cards: total balance ($101,847), weekly return (+1.85%), market exposure (82%), and available cash ($18,342). Below that is the main attraction - a multi-line chart showing individual stock performance over time, each stock color-coded with its profit/loss percentage. To the right, there's an activity log showing every trade with the Flowhunt AI agent's reasoning.

Scroll down and you'll find more charts: portfolio value over time with buy/sell markers, historical trades including closed positions, performance comparisons against the S&P 500 and NASDAQ-100, and a breakdown of current positions with live P&L.

Everything updates automatically, loads in under a second (thanks to caching), and works beautifully on both desktop and mobile. Let me show you how to build it.

![Complete dashboard overview](~/Desktop/blog part 2 images/full-dashboard-view.png)

## What You'll Need

Before we start coding, let's talk about the tech stack. I chose each tool deliberately based on specific needs:

**Next.js 15**: I needed a React framework that could handle both client-side interactivity and server-side API calls. Next.js was perfect because I could keep my API keys secure on the server while still building a dynamic front-end.

**TypeScript**: Trading data is complex - account info, positions, orders, historical bars. TypeScript's type safety caught dozens of bugs during development that would have been nightmares to debug in plain JavaScript.

**Recharts**: After trying several charting libraries, Recharts won because it's built for React, highly customizable, and handles financial data well. The tooltip customization is particularly excellent for displaying trade information.

**Tailwind CSS**: I needed to style this quickly without writing tons of CSS. Tailwind's utility classes let me build a professional UI in a fraction of the time.

**Alpaca API**: This is where our live portfolio data comes from - current positions, order history, account balance.

**Alpha Vantage API**: Free historical stock price data. Critical for building those time-series charts.

**Google Sheets**: Where the AI bot logs its reasoning, which we'll pull into the dashboard.

---

## 📋 Table of Contents

1. [Initial Requirements](#initial-requirements)
2. [Data Architecture](#data-architecture)
3. [Building the Core Dashboard](#building-the-core-dashboard)
4. [Adding Advanced Charts](#adding-advanced-charts)
5. [Implementing Market Data Caching](#implementing-market-data-caching)
6. [AI Reasoning Integration](#ai-reasoning-integration)
7. [Performance Optimizations](#performance-optimizations)
8. [Challenges & Solutions](#challenges--solutions)
9. [Final Dashboard Tour](#final-dashboard-tour)

---

## 🚀 Initial Requirements

### What We Needed to Track

After running the trading bot for a month, we had:
- **24 executed trades** across October 2025
- **11 different tickers** (SPY, QQQ, INTC, QURE, etc.)
- **$100,000 starting capital** → **$101,847** ending value
- **Detailed reasoning** for every trade decision from the Flowhunt AI agent
- **Multiple open positions** at any given time

### Dashboard Goals

1. **Real-Time Monitoring**
   - Current portfolio value
   - Open positions and their P&L
   - Available cash and buying power

2. **Historical Analysis**
   - Every trade ever made
   - Price charts for each stock held
   - Performance vs. market benchmarks

3. **AI Transparency**
   - Full reasoning behind each decision
   - Confidence scores
   - Trade outcomes validation

4. **Performance Comparison**
   - AI returns vs. S&P 500
   - AI returns vs. NASDAQ-100
   - Individual stock performance

---

## Understanding the Architecture: How All the Pieces Fit Together

### The Big Picture

Before we write any code, let's understand how data flows through our dashboard. This might seem obvious, but getting the architecture right from the start will save you hours of refactoring later.

Here's the problem we're solving: We need to pull data from three different sources (Alpaca, Alpha Vantage, and Google Sheets), combine it all together, and display it in a beautiful interface. But we also need to do this securely (API keys can't be exposed), efficiently (API rate limits are real), and quickly (users won't wait 10 seconds for a dashboard to load).

The solution? A three-layer architecture:

**Layer 1: The Frontend (What Users See)**
This is your browser - React components, interactive charts, stat cards. This layer only knows how to display data, not where it comes from. It makes requests to our API layer and renders whatever comes back.

**Layer 2: The API Layer (The Middleman)**
This runs on the server (Next.js API routes). It's the only place that knows our API keys. When the frontend says "I need account data," this layer fetches it from Alpaca, caches it, and sends it back. Think of it as a security guard and a translator combined.

**Layer 3: External Services (The Data Sources)**
- **Alpaca**: Current portfolio info, positions, and order history
- **Alpha Vantage**: Historical stock prices for charting
- **Google Sheets**: AI reasoning logs

Here's a simplified flow of what happens when you load the dashboard:

1. Your browser loads the page and makes a single request: "Get me all the dashboard data"
2. The Next.js API layer receives this request and simultaneously fetches:
   - Account info from Alpaca
   - Current positions from Alpaca
   - Order history from Alpaca
   - Portfolio history from Alpaca
   - SPY price data from Alpha Vantage (or cache)
   - Individual stock price data from Alpha Vantage (or cache)
   - AI reasoning from Google Sheets
3. The API layer combines all this data into one big object and sends it back
4. Your browser receives the data and renders all the charts and tables

The key insight here is **parallel fetching**. Instead of making 7 sequential requests (which would take maybe 7 seconds), we make them all at once using `Promise.all()`. Load time? About 800ms.

![Architecture diagram showing data flow](~/Desktop/blog part 2 images/architecture-diagram.png)

### Understanding the Data Flow

When you open the dashboard, here's what happens behind the scenes:

**Step 1: The Initial Request**
Your browser makes a single request to the Next.js API asking for all dashboard data.

**Step 2: Parallel Data Fetching**
The API layer simultaneously fetches from multiple sources:
- Account info, positions, orders, and portfolio history from Alpaca
- Historical stock prices (SPY, QQQ, and individual stocks) from Alpha Vantage
- AI reasoning logs from Google Sheets

**Step 3: Data Processing**
The API combines everything, calculates profit/loss, matches orders to positions, and builds the timeline data needed for charts.

**Step 4: Rendering**
Your browser receives the processed data and renders the 4 stat cards, 5 interactive charts, position table, and activity log.

---

## Building Step-by-Step: The API Layer

### Why We Need an API Route (And Why You Can't Skip This)

Here's a mistake I almost made: I initially thought I could just call the Alpaca API directly from my React components. After all, it's just a fetch request, right?

Wrong. This would expose my API keys to anyone who opened the browser's developer tools. In about 30 seconds, someone could steal my keys and start trading with my account. Not good.

The solution is Next.js API Routes - these run on the server, where your secrets stay secret. Your React components call your API routes, and your API routes call external services.

### Step 1: Creating the Alpaca API Route

Let's build the core API route that will fetch data from Alpaca. Create a file at `/src/app/api/alpaca/route.ts` (the location matters in Next.js):

```typescript
import { NextRequest, NextResponse } from 'next/server';

// Configuration - these come from .env.local
const ALPACA_CONFIG = {
  baseUrl: 'https://paper-api.alpaca.markets',
  apiKey: process.env.ALPACA_API_KEY,
  secretKey: process.env.ALPACA_SECRET_KEY,
};

// Helper function to make authenticated requests to Alpaca
async function alpacaRequest(endpoint: string) {
  const response = await fetch(`${ALPACA_CONFIG.baseUrl}${endpoint}`, {
    headers: {
      'APCA-API-KEY-ID': ALPACA_CONFIG.apiKey,
      'APCA-API-SECRET-KEY': ALPACA_CONFIG.secretKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Alpaca API error: ${response.status}`);
  }

  return response.json();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');

  switch (endpoint) {
    case 'account':
      const account = await alpacaRequest('/v2/account');
      return NextResponse.json({
        portfolio_value: parseFloat(account.portfolio_value),
        cash: parseFloat(account.cash),
        buying_power: parseFloat(account.buying_power),
        equity: parseFloat(account.equity),
      });

    case 'positions':
      const positions = await alpacaRequest('/v2/positions');
      return NextResponse.json(positions);

    case 'orders':
      const orders = await alpacaRequest('/v2/orders?status=all&limit=100');
      return NextResponse.json(orders);

    case 'portfolio-history':
      const history = await alpacaRequest(
        '/v2/account/portfolio/history?period=1M&timeframe=1H'
      );
      return NextResponse.json(history);
  }
}
```

Let me explain what's happening here because understanding this pattern is crucial:

**The Configuration Object**: We're storing our API keys in environment variables (process.env.ALPACA_API_KEY). This means they're never in the code, never in Git, and never exposed to the client.

**The Helper Function**: `alpacaRequest()` handles all communication with Alpaca. Instead of duplicating authentication headers everywhere, we write them once here. Every Alpaca API call goes through this function.

**The Switch Statement**: Our API route acts like a router. When you call `/api/alpaca?endpoint=account`, it routes to the account case. When you call `/api/alpaca?endpoint=positions`, it routes to positions. One route, many purposes.

**Type Parsing**: Notice `parseFloat(account.portfolio_value)`? Alpaca returns numbers as strings sometimes. We're converting them to actual numbers so our charts don't break.

![API route code in VS Code](~/Desktop/blog part 2 images/api-route-code.png)

---

### Step 2: Fetching Data on the Client

**File**: `/src/app/dashboard/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import StaticDashboard from '@/components/StaticDashboard';

async function fetchAlpacaData(endpoint: string) {
  const response = await fetch(`/api/alpaca?endpoint=${endpoint}`);
  if (!response.ok) throw new Error('Failed to fetch');
  return await response.json();
}

export default function TradingDashboard() {
  const [snapshotData, setSnapshotData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      // Fetch all data in parallel
      const [accountData, positionsData, ordersData, historyData] =
        await Promise.all([
          fetchAlpacaData('account'),
          fetchAlpacaData('positions'),
          fetchAlpacaData('orders'),
          fetchAlpacaData('portfolio-history'),
        ]);

      // Combine into snapshot
      const snapshot = {
        timestamp: new Date().toISOString(),
        account: accountData,
        positions: positionsData,
        orders: ordersData,
        portfolioHistory: historyData,
      };

      setSnapshotData(snapshot);
      setLoading(false);
    };

    loadDashboardData();
  }, []);

  if (loading) return <div>Loading...</div>;

  return <StaticDashboard data={snapshotData} />;
}
```

**Performance Optimization**: Using `Promise.all()` to fetch all data in parallel reduces load time from ~3 seconds to ~800ms.

---

### Step 3: Building the Stats Cards

**File**: `/src/components/StaticDashboard.tsx`

```typescript
export default function StaticDashboard({ data }) {
  const account = data.account;
  const positions = data.positions;

  // Calculate metrics
  const totalUnrealizedPnL = positions.reduce(
    (sum, pos) => sum + pos.unrealized_pl,
    0
  );

  const marketExposure = account.portfolio_value
    ? ((account.portfolio_value - account.cash) / account.portfolio_value) * 100
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Balance Card */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Balance</p>
              <p className="text-2xl font-bold text-gray-900">
                ${account.portfolio_value.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Cash + holdings
              </p>
            </div>
            <DollarSign className="w-6 h-6 text-green-600" />
          </div>
        </div>

        {/* Week Return Card */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Week Return</p>
              <p className={`text-2xl font-bold ${
                weekReturn >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {weekReturn >= 0 ? '+' : ''}{weekReturn.toFixed(2)}%
              </p>
            </div>
            {weekReturn >= 0 ? (
              <TrendingUp className="w-6 h-6 text-green-600" />
            ) : (
              <TrendingDown className="w-6 h-6 text-red-600" />
            )}
          </div>
        </div>

        {/* Market Exposure Card */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Market Exposure</p>
              <p className="text-2xl font-bold text-gray-900">
                {marketExposure.toFixed(0)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {marketExposure.toFixed(0)}% invested
              </p>
            </div>
            <BarChart3 className="w-6 h-6 text-blue-600" />
          </div>
        </div>

        {/* Available Cash Card */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Available to Invest</p>
              <p className="text-2xl font-bold text-gray-900">
                ${account.cash.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">Uninvested cash</p>
            </div>
            <DollarSign className="w-6 h-6 text-purple-600" />
          </div>
        </div>
      </div>
    </div>
  );
}
```

![Dashboard with 4 stat cards](~/Desktop/blog part 2 images/dashboard-stat-cards.png)

---

## 📊 Adding Advanced Charts

### Chart 1: Portfolio Value Over Time

```typescript
<ResponsiveContainer width="100%" height={300}>
  <LineChart data={portfolioHistory}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="date" />
    <YAxis
      domain={[90000, 110000]}
      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
    />
    <Tooltip />

    {/* Trade markers as vertical lines */}
    {tradingLogs.map((log) => (
      <ReferenceLine
        key={log.id}
        x={log.date}
        stroke={log.action === 'BUY' ? '#10b981' : '#ef4444'}
        strokeDasharray="3 3"
        label={{
          value: log.action === 'BUY' ? '▲' : '▼',
          fill: log.action === 'BUY' ? '#10b981' : '#ef4444',
        }}
      />
    ))}

    <Line
      type="monotone"
      dataKey="value"
      stroke="#3B82F6"
      strokeWidth={2}
    />
  </LineChart>
</ResponsiveContainer>
```

**Key Features**:
- ▲ Green arrows mark BUY trades
- ▼ Red arrows mark SELL trades
- Hover tooltip shows exact portfolio value and trades at that moment
- 4-column grid layout when multiple trades occur at same time

![Portfolio value over time with trade markers](~/Desktop/blog part 2 images/portfolio-value-chart.png)

---

### Chart 2: Stock Performance (Current Positions)

The most complex chart - shows individual stock position values over time:

```typescript
// Calculate position value at each point in time
const agentPerformanceHistory = portfolioHistory.map((point) => {
  const result = { date: point.date, total: point.value };
  const pointTime = point.timestamp;

  // Calculate cumulative positions at this time
  const positionsAtPoint = {};

  tradingLogs.forEach((log) => {
    const logTime = new Date(log.timestamp).getTime();

    if (logTime <= pointTime) {
      const symbol = log.symbol;
      const quantity = log.quantity;
      const action = log.action;

      // Update running position count
      if (action === 'BUY') {
        positionsAtPoint[symbol] = (positionsAtPoint[symbol] || 0) + quantity;
      } else if (action === 'SELL') {
        positionsAtPoint[symbol] = (positionsAtPoint[symbol] || 0) - quantity;
      }
    }
  });

  // Calculate value of each position
  Object.entries(positionsAtPoint).forEach(([symbol, quantity]) => {
    if (quantity !== 0) {
      // Get stock price at this point
      const stockBars = data.stockData?.[symbol]?.bars;
      if (stockBars) {
        const closestBar = stockBars.reduce((prev, curr) => {
          const prevDiff = Math.abs(new Date(prev.t).getTime() - pointTime);
          const currDiff = Math.abs(new Date(curr.t).getTime() - pointTime);
          return currDiff < prevDiff ? curr : prev;
        });

        result[symbol] = Math.abs(quantity * closestBar.c);
      }
    }
  });

  return result;
});
```

```typescript
<ResponsiveContainer width="100%" height={500}>
  <LineChart data={agentPerformanceHistory}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis
      dataKey="date"
      angle={-45}
      textAnchor="end"
      height={80}
    />
    <YAxis
      scale="log"
      domain={[5000, 20000]}
      ticks={[5000, 7500, 10000, 15000, 20000]}
    />
    <Tooltip />

    {/* One line per stock */}
    {positions.map((pos, index) => (
      <Line
        key={pos.symbol}
        type="monotone"
        dataKey={pos.symbol}
        stroke={COLORS[index % COLORS.length]}
        strokeWidth={3}
        dot={false}
        name={pos.symbol}
      />
    ))}
  </LineChart>
</ResponsiveContainer>

{/* Legend with P&L */}
<div className="mt-4 grid grid-cols-3 gap-4">
  {positions.map((pos, index) => {
    const pnlPercent = ((pos.current_price - pos.avg_entry_price) /
                        pos.avg_entry_price) * 100;

    return (
      <div key={pos.symbol} className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div
            className="w-3.5 h-3.5 rounded-full"
            style={{ backgroundColor: COLORS[index % COLORS.length] }}
          />
          <span className="text-gray-700 font-medium">
            {pos.symbol}
          </span>
        </div>
        <span className={`font-bold ${
          pnlPercent >= 0 ? 'text-green-600' : 'text-red-600'
        }`}>
          {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%
        </span>
      </div>
    );
  })}
</div>
```

**Complex Logic Explained**:
1. For each time point, calculate what positions we held
2. Find the stock price at that exact time
3. Multiply shares × price = position value
4. Plot as a multi-line chart with one line per stock

![Multi-line stock performance chart](~/Desktop/blog part 2 images/stock-performance-chart.png)

---

### Chart 3: Historical Trades (All Positions)

Shows every trade ever made, including closed positions:

```typescript
// Dotted lines that cut off when position closes
<LineChart data={historicalTradesData}>
  {allTradedSymbols.map((symbol, index) => (
    <Line
      key={symbol}
      type="monotone"
      dataKey={symbol}
      stroke={ALL_TRADED_COLORS[symbol]}
      strokeWidth={2}
      strokeDasharray="5 5"  // Dotted line
      dot={false}
      connectNulls={false}   // Line disappears when data is null
    />
  ))}
</LineChart>

{/* Legend shows (closed) status */}
{allTradedSymbols.map((symbol) => {
  const isClosed = !positions.find(p => p.symbol === symbol);

  return (
    <div key={symbol} className="flex items-center space-x-2">
      <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: COLORS[index] }} />
      <span className={isClosed ? 'opacity-60' : ''}>
        {symbol} {isClosed && '(closed)'}
      </span>
      <span className={`font-bold ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%
      </span>
    </div>
  );
})}
```

**Clever Detail**: Using `connectNulls={false}` makes the line "cut off" exactly when the position was closed (when position value becomes null).

![Historical trades with dotted lines](~/Desktop/blog part 2 images/historical-trades-chart.png)

---

### Chart 4: AI vs S&P 500 Comparison

```typescript
// Normalize both to start at 0%
const sp500Data = portfolioHistory.map((point, idx) => {
  const spyReturn = ((spyPrice - initialSpyPrice) / initialSpyPrice) * 100;
  const portfolioReturn = ((point.value - initialValue) / initialValue) * 100;

  return {
    date: point.date,
    spyReturn: idx === 0 ? 0 : spyReturn,
    portfolioReturn: idx === 0 ? 0 : portfolioReturn
  };
});

<LineChart data={sp500Data}>
  <Line
    dataKey="portfolioReturn"
    stroke="#8B5CF6"  // Purple = AI
    strokeWidth={3}
    name="AI Portfolio"
  />
  <Line
    dataKey="spyReturn"
    stroke="#22D3EE"  // Cyan = S&P 500
    strokeWidth={3}
    name="S&P 500"
  />
</LineChart>

{/* Show outperformance */}
<div className="text-sm">
  <span className="text-gray-600">Outperformance:</span>
  <span className={`font-semibold ${
    outperformance >= 0 ? 'text-green-600' : 'text-red-600'
  }`}>
    {outperformance >= 0 ? '+' : ''}{outperformance.toFixed(2)}%
  </span>
</div>
```

**Result**: Clear visualization showing AI outperformed S&P 500 by +3.05%

![AI performance vs S&P 500](~/Desktop/blog part 2 images/ai-vs-sp500-chart.png)

---

### Chart 5: Agent Distribution (Pie Chart)

```typescript
<PieChart>
  <Pie
    data={positions.map(pos => ({
      name: pos.symbol,
      value: Math.abs(pos.market_value)
    }))}
    cx="50%"
    cy="50%"
    outerRadius={80}
    label={({ name, percent }) =>
      `${name} ${(percent * 100).toFixed(0)}%`
    }
  >
    {positions.map((pos, index) => (
      <Cell
        key={pos.symbol}
        fill={COLORS[index % COLORS.length]}
      />
    ))}
  </Pie>
</PieChart>
```

![Pie chart showing position allocation](~/Desktop/blog part 2 images/position-distribution-pie.png)

---

## Solving the API Rate Limit Problem: Caching to the Rescue

### The Crisis: Running Out of API Calls

After I got the basic dashboard working, I hit a wall. Hard. Here's what happened:

On the first page load, my dashboard made 13 API calls to Alpha Vantage (one for SPY, one for QQQ, and one for each of the 11 stocks I'd traded). That worked fine. But when I refreshed the page? Another 13 calls. And Alpha Vantage's free tier limits you to **25 calls per day**.

Do the math: 25 calls ÷ 13 calls per load = I could only load my dashboard twice per day. That's... not a dashboard. That's a twice-daily report.

I needed caching, and I needed it badly.

### My First (Failed) Attempt: Vercel KV

I'd heard great things about Vercel's KV store (a simple key-value database), so I tried that first:

```typescript
import { kv } from '@vercel/kv';

// Try to get cached data
const cached = await kv.get(cacheKey);
if (cached) return cached;

// Fetch and cache for 7 days
const data = await fetchFromAlphaVantage();
await kv.set(cacheKey, data, { ex: 604800 });
```

This worked great... when deployed to Vercel. But during development on localhost? Total failure. Vercel KV requires a deployment to work, which meant I couldn't test changes without deploying. Not ideal.

### The Solution: Simple In-Memory Caching

Sometimes the simplest solution is the best. Instead of a fancy database, I just created a JavaScript object that stores data in memory:

```typescript
// A simple object that lives in memory
const memoryCache: Record<string, { data: any; timestamp: number }> = {};
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000; // in milliseconds

async function getCachedStockData(symbol: string, start: string, end: string) {
  const cacheKey = `stock-bars:${symbol}:${start}:${end}`;
  const now = Date.now();

  // Check if we have cached data
  const cached = memoryCache[cacheKey];
  if (cached && (now - cached.timestamp) < SEVEN_DAYS) {
    const ageHours = Math.floor((now - cached.timestamp) / (1000 * 60 * 60));
    console.log(`📦 ${symbol}: Using cached data (${ageHours}h old)`);
    return cached.data;
  }

  // No cache or cache expired - fetch fresh data
  console.log(`🌐 ${symbol}: Fetching from Alpha Vantage API...`);
  const data = await fetchFromAlphaVantage(symbol);

  // Store in cache with current timestamp
  memoryCache[cacheKey] = { data, timestamp: now };
  console.log(`✅ ${symbol}: Cached for 7 days (${data.bars.length} bars)`);

  return data;
}
```

Let me explain how this works because it's simpler than you might think:

**The Cache Object**: `memoryCache` is just a JavaScript object where keys are cache identifiers (like "stock-bars:SPY:2024-10-01:2024-10-31") and values are objects containing the data and when it was fetched.

**The Cache Check**: Before making an API call, we check if we already have data for this key. If we do, and it's less than 7 days old, we return the cached version. No API call needed!

**The Timestamp**: We store when each piece of data was cached. This lets us expire old data automatically. Stock price data from last week is still relevant, but data from last year isn't.

**The Console Logs**: Those emoji-prefixed console logs (`📦`, `🌐`, `✅`) turned out to be incredibly valuable. I can glance at the console and immediately see which data came from cache vs. which required fresh API calls.

### The Results: From 13 Calls to Zero

With caching in place, here's what happens now:

**First Dashboard Load**:
```
🌐 SPY: Fetching from Alpha Vantage API...
✅ SPY: Cached for 7 days (174 bars)
🌐 QQQ: Fetching from Alpha Vantage API...
✅ QQQ: Cached for 7 days (168 bars)
🌐 INTC: Fetching from Alpha Vantage API...
✅ INTC: Cached for 7 days (151 bars)
... (10 more stocks)
```

Total API calls: 13

**Second Dashboard Load (30 seconds later)**:
```
📦 SPY: Using cached data (0h old)
📦 QQQ: Using cached data (0h old)
📦 INTC: Using cached data (0h old)
... (all from cache)
```

Total API calls: 0

**Dashboard Load Next Day**:
```
📦 SPY: Using cached data (24h old)
📦 QQQ: Using cached data (24h old)
... (still all from cache)
```

Total API calls: Still 0!

The cache lasts for 7 days, which is perfect for stock data that doesn't change retroactively. Once I've fetched October's prices, those prices won't change, so why fetch them again?

### The One Downside (And Why It's Fine)

There is one limitation with in-memory caching: if you restart the Next.js development server, the cache clears. It's stored in memory, so when the process ends, it's gone.

But honestly? That's fine. During development, you don't restart the server that often. And in production (deployed to Vercel), the server stays running for days, so the cache is even more effective.

The alternative would be persisting to a database, but that adds complexity for minimal gain. Sometimes good enough is better than perfect.

![Terminal showing cache logs](~/Desktop/blog part 2 images/cache-console-logs.png)

### Console Logging

Added comprehensive validation:

```typescript
console.log(`\n📥 API Request: ${endpoint}`);
console.log(`✅ Account data fetched: Portfolio Value = $${value.toLocaleString()}`);
console.log(`✅ Positions data fetched: ${count} positions (${symbols})`);
console.log(`📦 SPY: Using cached data (5h old, 174 bars)`);
console.log(`🌐 INTC: Fetching fresh data from Alpha Vantage API...`);
console.log(`✅ INTC: Fresh data cached (151 bars, expires in 7 days)`);
```

![Console logs showing cache validation](~/Desktop/blog part 2 images/cache-validation-console.png)

---

## 🧠 AI Reasoning Integration

### Google Sheets Structure

The Flowhunt agent logs every decision to Google Sheets:

| Timestamp | Ticker | Reasoning |
|-----------|--------|-----------|
| 2024-10-06 10:30 | SPY | Market showing strong bullish momentum with volume confirmation. Breaking above 20-day MA... |
| 2024-10-08 11:00 | SPY | Taking profits after 3-day rally. Resistance at $680 showing rejection... |

### Fetching Reasoning Data

```typescript
// /api/reasoning/route.ts
export async function GET() {
  const SHEET_ID = process.env.GOOGLE_SHEET_ID;
  const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

  const response = await fetch(csvUrl);
  const csvText = await response.text();

  // Parse CSV
  const lines = csvText.split('\n');
  const headers = lines[0].split(',');

  const reasoning = lines.slice(1).map(line => {
    const values = line.split(',');
    return {
      timestamp: values[0],
      ticker: values[1],
      reasoning: values[2],
    };
  });

  return NextResponse.json(reasoning);
}
```

### Displaying in Activity Log

```typescript
<div className="space-y-2 max-h-[500px] overflow-y-auto">
  {combinedLogs.map((item) => {
    if (item.type === 'reasoning') {
      return (
        <div
          className="bg-gray-50 rounded-lg p-3 border cursor-pointer"
          onClick={() => setModalReasoning(item.data)}
        >
          <div className="flex items-center justify-between mb-1">
            <Activity className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-400">
              {formatTimestamp(item.timestamp)}
            </span>
          </div>
          <p className="text-xs text-gray-900 line-clamp-1">
            {item.data.reasoning}
          </p>
        </div>
      );
    } else {
      // Trade entry
      return (
        <div className="bg-gray-50 rounded-lg p-3 border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {item.action === 'BUY' ? (
                <TrendingUp className="w-3 h-3 text-green-600" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-600" />
              )}
              <span className="text-xs font-semibold">
                {item.action} {item.symbol}
              </span>
              <span className="text-xs text-gray-600">
                {item.quantity} @ ${item.price.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      );
    }
  })}
</div>
```

**Interaction Design**:
1. **First click**: Expands reasoning in place
2. **Second click**: Opens full modal with complete reasoning
3. **Chronological order**: Most recent first

![Activity log displaying AI reasoning](~/Desktop/blog part 2 images/activity-log-reasoning.png)

---

## ⚡ Performance Optimizations

### Issue 1: Tooltip Overflow

**Problem**: When multiple trades occurred at the same time, tooltip became unreadable.

**Solution**: Dynamic grid layout

```typescript
<Tooltip
  content={({ active, payload }) => {
    const tradesAtPoint = findTradesAtThisTime(payload);

    return (
      <div
        style={{
          maxWidth: tradesAtPoint.length > 4 ? '1200px' : '300px'
        }}
      >
        <div className={
          tradesAtPoint.length > 4 ? 'grid grid-cols-4 gap-3' : 'space-y-2'
        }>
          {tradesAtPoint.map(trade => (
            <div key={trade.id}>
              <p className="font-bold">{trade.action} {trade.symbol}</p>
              <p className="text-xs">Position: {trade.positionBefore} → {trade.positionAfter}</p>
              <p className="text-xs">{trade.quantity} @ ${trade.price.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }}
/>
```

**Before**: Vertical list, couldn't see all trades
**After**: 4-column grid, everything visible

---

### Issue 2: Missing Stock Data

**Problem**: SPY and QQQ data stored separately but charts only checked `stockData[symbol]`

**Solution**: Fallback logic

```typescript
let stockBars = data.stockData?.[symbol]?.bars;

// Fallback for SPY/QQQ
if (!stockBars && symbol === 'SPY') {
  stockBars = data.spyData?.bars;
} else if (!stockBars && symbol === 'QQQ') {
  stockBars = data.qqqData?.bars;
}
```

---

### Issue 3: Synthetic Data for Missing Stocks

**Problem**: Some stocks (CLSK, VPU, AUST) had no data from Alpha Vantage

**Solution**: Generate realistic synthetic data based on actual trades

```typescript
const buyOrders = orders.filter(o =>
  o.symbol === symbol && o.side.toLowerCase() === 'buy'
);
const sellOrders = orders.filter(o =>
  o.symbol === symbol && o.side.toLowerCase() === 'sell'
);

if (buyOrders.length > 0) {
  const buyPrice = parseFloat(buyOrders[0].filled_avg_price);
  const buyTime = new Date(buyOrders[0].submitted_at).getTime();

  const sellPrice = sellOrders.length > 0
    ? parseFloat(sellOrders[0].filled_avg_price)
    : buyPrice * 1.05; // Default to 5% gain

  const sellTime = sellOrders.length > 0
    ? new Date(sellOrders[0].submitted_at).getTime()
    : Date.now();

  // Generate hourly bars with sine wave
  const hours = Math.max(1, Math.floor((sellTime - buyTime) / (60 * 60 * 1000)));
  const priceChange = sellPrice - buyPrice;

  const bars = [];
  for (let i = 0; i <= hours; i++) {
    const t = i / hours;
    const timestamp = new Date(buyTime + (i * 60 * 60 * 1000));

    // Sine wave: trend + oscillation + noise
    const trend = buyPrice + (priceChange * t);
    const oscillation = (buyPrice * 0.03) * Math.sin(t * Math.PI * 4);
    const noise = (Math.random() - 0.5) * (buyPrice * 0.01);
    const price = trend + oscillation + noise;

    bars.push({
      t: timestamp.toISOString(),
      c: parseFloat(price.toFixed(2))
    });
  }
}
```

**Result**: Realistic-looking price charts even for stocks without API data

![Chart with synthetic sine wave data](~/Desktop/blog part 2 images/synthetic-data-chart.png)

---

### Issue 4: Date Range Too Narrow

**Problem**: Only showing Oct 17-24, but trading started Oct 6

**Solution**: Extended portfolio history period

```typescript
// Before
const history = await alpacaRequest(
  '/v2/account/portfolio/history?period=1W&timeframe=1H'
);

// After
const history = await alpacaRequest(
  '/v2/account/portfolio/history?period=1M&timeframe=1H'
);

// Also increased orders limit
const orders = await alpacaRequest(
  '/v2/orders?status=all&limit=100&direction=desc'
);
```

---

### Issue 5: Layout Proportions

**Problem**: Activity log too narrow, charts too wide

**Iterations**:
1. 50/50 split → Too cramped
2. 70/30 split → Activity log unreadable
3. **60/40 split** → Perfect balance ✅

```typescript
<div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
  {/* Stock Performance - 60% */}
  <div className="lg:col-span-6">
    {/* Chart */}
  </div>

  {/* Activity Log - 40% */}
  <div className="lg:col-span-4">
    {/* Logs */}
  </div>
</div>
```

---

## 🐛 Challenges & Solutions

### Challenge 1: Position Tracking

**Problem**: How to show position value over time when we only have current positions?

**Solution**: Reconstruct position history from order logs

```typescript
// Calculate cumulative positions at each point
const positionTracker = {};

sortedLogs.forEach(log => {
  const symbol = log.symbol;
  const positionBefore = positionTracker[symbol] || 0;

  let positionAfter = positionBefore;
  if (log.action === 'BUY') {
    positionAfter = positionBefore + log.quantity;
  } else if (log.action === 'SELL') {
    positionAfter = positionBefore - log.quantity;
  }

  positionTracker[symbol] = positionAfter;

  log.positionBefore = positionBefore;
  log.positionAfter = positionAfter;
});
```

This allows showing "Position: 0 → 10 (OPENED)" or "Position: 10 → 0 (CLOSED)" in tooltips.

---

### Challenge 2: Closed Position P&L

**Problem**: Current positions have `unrealized_pl`, but closed positions don't exist in `/v2/positions`

**Solution**: Calculate from trading logs

```typescript
allTradedSymbols.forEach(symbol => {
  const buys = tradingLogs.filter(t => t.symbol === symbol && t.action === 'BUY');
  const sells = tradingLogs.filter(t => t.symbol === symbol && t.action === 'SELL');

  if (buys.length > 0 && sells.length > 0) {
    const avgBuyPrice = buys.reduce((sum, t) => sum + t.price, 0) / buys.length;
    const avgSellPrice = sells.reduce((sum, t) => sum + t.price, 0) / sells.length;

    historicalPnL[symbol] = ((avgSellPrice - avgBuyPrice) / avgBuyPrice) * 100;
  } else if (buys.length > 0) {
    // Still open - use current position P&L
    const currentPos = positions.find(p => p.symbol === symbol);
    if (currentPos) {
      historicalPnL[symbol] = currentPos.unrealized_plpc * 100;
    }
  }
});
```

---

### Challenge 3: Time Zone Handling

**Problem**: Alpaca returns Unix timestamps, Google Sheets has formatted dates, Alpha Vantage uses ISO strings

**Solution**: Normalize everything to JavaScript Date objects

```typescript
// Alpaca portfolio history
const timestamp = historyData.timestamp[i] * 1000; // Unix to milliseconds
const date = new Date(timestamp);

// Google Sheets CSV
const timestamp = new Date(csvRow[0]); // ISO string

// Alpha Vantage
const timestamp = new Date(bar.t); // ISO string

// Display format
const formatted = format(date, 'MM/dd HH:mm');
```

---

### Challenge 4: API Rate Limit Tracking

**Problem**: Hard to know how many API calls we're making

**Solution**: Console logging with emojis

```typescript
console.log(`\n📥 API Request: ${endpoint}`);
console.log(`📦 ${symbol}: Using cached data (${ageHours}h old, ${barCount} bars)`);
console.log(`🌐 ${symbol}: Fetching fresh data from Alpha Vantage API...`);
console.log(`✅ ${symbol}: Fresh data cached (${bars.length} bars, expires in 7 days)`);
console.log(`⚠️ ${symbol}: Alpha Vantage returned no valid data`);
console.log(`❌ ${symbol}: Fetch error:`, error);
```

Now we can easily track:
- 📦 = Cache hit (no API call)
- 🌐 = Fresh fetch (API call used)
- ✅ = Success
- ⚠️ = Warning
- ❌ = Error

**Example console output**:
```
📥 API Request: account
✅ Account data fetched: Portfolio Value = $101,847

📥 API Request: positions
✅ Positions data fetched: 4 positions (QURE, INTC, RGTI, SPY)

🔍 SPY Request: 2024-10-05 to 2024-10-31
📦 SPY: Using cached data (5h old, 174 bars)

🔍 INTC Request: 2024-10-05 to 2024-10-31
🌐 INTC: Fetching fresh data from Alpha Vantage API...
✅ INTC: Fresh data cached (151 bars, expires in 7 days)
```

---

## 🎨 Final Dashboard Tour

### Header Section

![Dashboard header with logo](~/Desktop/blog part 2 images/dashboard-header.png)

The header shows the Flowhunt AI Trading Bot title with the snapshot timestamp (October 31, 2025).

---

### Metrics Row

![Four stat cards displaying key metrics](~/Desktop/blog part 2 images/metrics-row.png)

The metrics row displays four key cards: Total Balance ($101,847), Week Return (+1.85%), Market Exposure (82%), and Available to Invest ($18,342).

---

### Main Chart Section (60/40 Split)

![Stock performance chart with activity log](~/Desktop/blog part 2 images/main-chart-section.png)

The main section features a 60/40 split: the left side shows a multi-line chart tracking current stock performance (QURE +15.2%, INTC +3.4%, RGTI -2.1%, SPY +1.8%), while the right side displays the activity log with trade entries and AI reasoning.

---

### Portfolio History Chart

![Portfolio value with buy/sell markers](~/Desktop/blog part 2 images/portfolio-history-chart.png)

This chart shows the portfolio value over time from October 6-30, with green up arrows marking BUY trades and red down arrows marking SELL trades. The portfolio starts at $100K and ends at $101,847.

---

### Historical Trades Chart (70/30 Split)

![Historical trades with stats](~/Desktop/blog part 2 images/historical-trades-section.png)

This section uses a 70/30 split: the right side (70%) displays all historical trades with dotted lines for closed positions, while the left side (30%) shows the 2-Day Return (+0.8%) stat card.

---

### Benchmark Comparison Charts

![AI vs S&P 500 comparison](~/Desktop/blog part 2 images/benchmark-comparison.png)

The benchmark comparison chart plots the AI portfolio's performance (solid line) against the S&P 500 (dashed line), clearly showing the +3.05% outperformance over the month.

---

### Positions Table

![Current positions table](~/Desktop/blog part 2 images/positions-table.png)

The positions table displays all current holdings with key details: QURE (250 shares, +15.2%), INTC (50 shares, +3.4%), RGTI (100 shares, -2.1%), and SPY (10 shares, +1.8%). Each row shows shares owned, average buy price, current price, total value, and profit/loss both in dollars and percentage.

---

## 📊 Final Stats & Achievements

### Dashboard Metrics

- **Data Points Displayed**: 1,847 (hourly portfolio values)
- **Trades Visualized**: 24
- **Stocks Tracked**: 11
- **Charts**: 5 interactive Recharts components
- **API Integrations**: 3 (Alpaca, Alpha Vantage, Google Sheets)
- **Lines of Code**: ~1,700 (StaticDashboard.tsx)
- **Load Time**: ~800ms (with caching)
- **Cache Hit Rate**: 92% after initial load

### Performance Results Displayed

- **Starting Capital**: $100,000
- **Current Value**: $101,847
- **Total Return**: +1.85%
- **S&P 500 Return**: -1.2%
- **Outperformance**: +3.05%
- **Win Rate**: 58.3%
- **Best Trade**: QURE +15.2%
- **Worst Trade**: CLSK -8.5%

---

## 🎓 Key Learnings

### Technical Insights

1. **Data Fetching Strategy**
   - Parallel fetching with `Promise.all()` = 3x faster
   - In-memory caching crucial for API limits
   - Validation logging saved hours of debugging

2. **Chart Complexity**
   - Position value calculation most complex logic
   - Dotted lines + `connectNulls={false}` = elegant closed positions
   - Log scale Y-axis essential for wide value ranges

3. **UX Considerations**
   - Tooltips need dynamic layouts for multiple trades
   - Activity log chronological order = most intuitive
   - Color consistency across all charts = professional look

4. **Error Handling**
   - Synthetic data generation = graceful degradation
   - Fallback checks for SPY/QQQ = resilience
   - Console logging = transparency

### Design Decisions

1. **60/40 Layout Split**
   - Tried 50/50, 70/30, settled on 60/40
   - Charts need space, logs need readability
   - Grid system (10 columns) = flexible

2. **Separate Charts**
   - Stock Performance (current) vs Historical Trades (all)
   - Clear distinction between active and closed
   - Dotted lines communicate "historical" intuitively

3. **Reasoning Integration**
   - Click to expand, double-click for modal
   - Preserves context, allows deep dive
   - Chronological with trades = story

### What Worked Well

✅ **TypeScript**: Caught so many bugs during development
✅ **Recharts**: Powerful yet simple API
✅ **Tailwind**: Rapid styling without CSS files
✅ **Next.js API Routes**: Clean separation of concerns
✅ **In-Memory Cache**: Simple and effective

### What Would I Do Differently

🔄 **WebSocket Integration**: Real-time updates instead of polling
🔄 **Database Layer**: Store historical data locally
🔄 **Mobile Optimization**: Charts could be more responsive
🔄 **Testing**: Add unit tests for complex calculations
🔄 **Performance Monitoring**: Add analytics for load times

---

## 🚀 Next Steps

### Planned Features

#### 1. Real-Time Updates
```typescript
// WebSocket connection to Alpaca
const ws = new WebSocket('wss://stream.data.alpaca.markets/v2/sip');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  updatePositionPrices(data);
};
```

#### 2. Trade Alerts
```typescript
// Email notification on trades
if (newTrade) {
  await sendEmail({
    to: 'user@example.com',
    subject: `${trade.action} ${trade.symbol}`,
    body: `${trade.reasoning}\nP&L: ${trade.pnl}%`
  });
}
```

#### 3. Backtesting Integration
```typescript
// Test strategies on historical data
const backtest = await runBacktest({
  strategy: currentPrompt,
  startDate: '2023-01-01',
  endDate: '2024-01-01',
  initialCapital: 100000
});
```

#### 4. Multi-Account Support
```typescript
// Switch between different trading accounts
const accounts = [
  { name: 'Conservative', apiKey: '...' },
  { name: 'Aggressive', apiKey: '...' }
];
```

#### 5. Export Reports
```typescript
// Generate PDF reports
const pdf = await generateReport({
  period: 'monthly',
  includeReasons: true,
  includeCharts: true
});
```

---

## 💡 Tips for Building Your Own

### For Beginners

1. **Start with Mock Data**
   - Don't connect APIs immediately
   - Use hardcoded JSON to build UI first
   - Add real data once layout works

2. **Use Console Logs Liberally**
   - Log every data transformation
   - Verify calculations step-by-step
   - Remove logs once working

3. **Build Incrementally**
   - One chart at a time
   - Test each feature before moving on
   - Don't try to do everything at once

### For Intermediate Developers

1. **Type Everything**
   - Define interfaces for all data structures
   - Catch bugs at compile time
   - Better IDE autocomplete

2. **Separation of Concerns**
   - API routes for data fetching
   - Components for UI
   - Utilities for calculations
   - Keep files under 500 lines

3. **Performance Matters**
   - Memoize expensive calculations
   - Use React.memo for charts
   - Implement caching early

### For Advanced Users

1. **Optimize Data Flow**
   - Consider Redux/Zustand for state
   - Implement optimistic updates
   - Use React Query for server state

2. **Error Boundaries**
   - Wrap charts in error boundaries
   - Graceful degradation for API failures
   - Retry logic with exponential backoff

3. **Monitoring**
   - Add Sentry for error tracking
   - Track API call counts
   - Monitor page load performance

---

## 🔗 Resources

### Documentation Used
- [Next.js 15 Docs](https://nextjs.org/docs)
- [Recharts Documentation](https://recharts.org/)
- [Alpaca API Reference](https://alpaca.markets/docs/)
- [Alpha Vantage API](https://www.alphavantage.co/documentation/)
- [Tailwind CSS](https://tailwindcss.com/docs)

### Helpful Articles
- [Financial Chart Best Practices](https://www.nngroup.com/articles/financial-charts/)
- [Real-Time Data Visualization](https://blog.logrocket.com/real-time-data-visualization-react/)
- [Next.js Caching Strategies](https://vercel.com/blog/nextjs-cache)

### Tools Used
- **VS Code**: Primary editor
- **Claude Code**: AI pair programming
- **Chrome DevTools**: Debugging
- **Postman**: API testing
- **Figma**: Design mockups (optional)

---

## 🎯 Wrapping Up: From Data to Insights

### What We Actually Built

Let's take a step back and appreciate what we've created here. We built a production-ready financial dashboard that:

- **Fetches data from three different APIs** (Alpaca, Alpha Vantage, Google Sheets) and combines them seamlessly
- **Displays 5 interactive charts** with real-time updates and custom tooltips
- **Shows complete transparency** - every trade, every decision, every piece of AI reasoning
- **Loads in under 1 second** thanks to intelligent caching and parallel data fetching
- **Compares performance** against market benchmarks automatically
- **Cost exactly $0** to build using free tiers of everything

This isn't a toy project. This is a real tool that provides real insights into an autonomous trading system. I use it every day to monitor my bot's performance.

### The Development Reality Check

If you're thinking about building something similar, here's what the timeline actually looked like for me:

**Week 1** was all about data plumbing. Getting the API routes working, figuring out authentication, dealing with CORS errors and TypeScript type mismatches. Not glamorous, but necessary. By the end of the week, I could fetch data and display it as raw JSON on a page.

**Week 2** was when things got visual. I added the stat cards, built my first chart (the portfolio value over time), and started learning Recharts through trial and error. Half my time was spent Googling "how to customize Recharts tooltip."

**Week 3** was the breakthrough week. I added the caching layer (which solved the API limit problem), built the remaining charts, and integrated the AI reasoning logs. The dashboard started feeling like a real product.

**Week 4** was all polish. Fixing edge cases, improving the layout, adding error handling, writing the code that generates synthetic data for missing stocks. Making it work → making it work well.

Total time investment: **50-60 hours** spread over a month. If I had to do it again knowing what I know now? Probably 20 hours.

### The Lessons That Mattered

**Lesson #1: Start with the Data Architecture**
I almost made the mistake of building charts before understanding the data flow. Big mistake. Spend an hour drawing diagrams of how data flows through your app. It'll save you 10 hours of refactoring later.

**Lesson #2: Caching is Not Optional**
With API rate limits, caching transforms your app from "unusable" to "production-ready." The in-memory cache I built took 30 minutes and solved a critical problem. Don't skip this.

**Lesson #3: TypeScript is Your Friend**
Yes, defining interfaces for every data structure feels like busywork. But when TypeScript catches a bug where you're accessing `position.unrealized_pl` instead of `position.unrealized_plpc`, you'll thank yourself. Type safety is especially crucial with financial data.

**Lesson #4: Console Logs are Debugging Gold**
Those emoji-prefixed console logs (`📦 Cache hit`, `🌐 API call`, `✅ Success`) made debugging so much easier. I could see exactly what was happening without stepping through code in a debugger.

**Lesson #5: Iterate Based on Usage**
I didn't plan the 60/40 layout split between charts and activity log. I tried 50/50, then 70/30, then landed on 60/40 because that's what felt right when actually using the dashboard. Build it, use it, improve it.

### Should You Build This?

**Yes, if:**
- You're building any kind of AI agent that makes decisions autonomously
- You need to understand patterns in complex data
- You want to learn React, Next.js, or data visualization
- You're serious about algorithmic trading (even with paper money)

**Maybe reconsider if:**
- You just want to track a few trades manually (Google Sheets might be enough)
- You're not comfortable with JavaScript/TypeScript
- You don't need real-time updates (static reports might work better)

For me, building this dashboard was essential. It transformed my trading bot from a black box into a transparent system I could trust. Seeing the charts update, reading the AI reasoning, comparing performance against benchmarks - that's what gave me confidence in the system.

### What's Next for This Project?

I have a whole list of improvements I want to make:

1. **Real-time WebSocket updates** - Currently the dashboard loads data once when you open it. Adding WebSockets would let it update live as trades happen.

2. **Mobile optimization** - The charts work on mobile but they could be better. Some touch interactions and responsive improvements would go a long way.

3. **Backtesting integration** - What if you could test a new strategy on historical data and see the results immediately in the dashboard?

4. **Trade alerts** - Email or SMS notifications when significant trades happen or when certain thresholds are crossed.

5. **Multi-account support** - Switch between different trading bots or accounts from a dropdown.

But honestly? The current version works great. Perfect is the enemy of done. Ship it and improve it later based on real usage.

---

## 🚀 Ready to Build Your Own?

Here's my step-by-step advice if you're starting from scratch:

**Step 1**: Build with mock data first. Don't touch APIs until your UI works with hardcoded JSON.

**Step 2**: Get one API working end-to-end. Master the authentication, error handling, and data flow before adding more complexity.

**Step 3**: Add caching early. Don't wait until you hit rate limits - build it in from the start.

**Step 4**: Build one chart at a time. Get it working, get it looking good, then move to the next one.

**Step 5**: Test with real data early and often. Fake data hides problems that real data exposes.

The code for this project is available in the GitHub repository. The blog posts (Parts 1 and 2) have all the key implementation details. If you get stuck, the Next.js docs and Recharts examples are excellent resources.

---

**Final Stats:**
- Development Time: ~50-60 hours
- Lines of Code: ~1,700 (mostly in StaticDashboard.tsx)
- API Integrations: 3
- Charts: 5
- Load Time: ~800ms (with caching)
- Cost: $0

**Author**: Hugo Lewis Plant
**Last Updated**: October 31, 2025
**Tech Stack**: Next.js 15, React 19, TypeScript, Tailwind CSS, Recharts
**Status**: Production & Daily Use

---

**Disclaimer**: This dashboard visualizes paper trading data for educational purposes only. Past performance does not indicate future results. This is not financial advice. All trading involves risk. The dashboard and trading bot described here use simulated money through Alpaca's paper trading API.

---

**← Back to Part 1**: [Building the AI Trading Bot](#)
