# S&P 500 & NASDAQ-100 Comparison Charts Analysis

## Overview
This document compares the implementation of the SPY (S&P 500) and QQQ (NASDAQ-100) comparison charts between the working version (Nov 11, 2025) and the current version (Nov 14, 2025).

## Current Issue
**Problem**: Charts not rendering despite API data being successfully fetched
**Error**: `No valid SPY/QQQ bars found before first portfolio timestamp`
**Symptoms**:
- `sp500Data.length: 0` and `nasdaq100Data.length: 0` at render time
- SPY data exists: 374 bars, QQQ data exists: 352 bars
- Data reaches component but state never gets set

---

## Implementation Comparison

### Nov 11, 2025 Version (WORKING) - Commit d7f2c4b

**Key Code:**
```typescript
// Process SPY comparison data (use 1-point-per-day data)
if (data.spyData?.bars && formattedHistoryOnePoint.length > 0) {
  const spyBars = data.spyData.bars;
  const initialPortfolioValue = formattedHistoryOnePoint[0].value;
  const firstPortfolioTimestamp = formattedHistoryOnePoint[0].timestamp;

  // Find initial SPY price
  const validSpyBars = spyBars.filter((bar: { t: string; c: number }) =>
    new Date(bar.t).getTime() <= firstPortfolioTimestamp
  );

  if (validSpyBars.length > 0) {
    const initialSpyBar = validSpyBars.reduce((prev, curr) => {
      const prevDiff = firstPortfolioTimestamp - new Date(prev.t).getTime();
      const currDiff = firstPortfolioTimestamp - new Date(curr.t).getTime();
      return currDiff < prevDiff && currDiff >= 0 ? curr : prev;
    });
    const initialSpyPrice = initialSpyBar.c;

    // Calculate comparison data for each portfolio point
    const rawComparisonData = formattedHistoryOnePoint.map((item) => {
      const itemTimestamp = item.timestamp;
      const validBarsForPoint = spyBars.filter((bar) =>
        new Date(bar.t).getTime() <= itemTimestamp
      );

      const closestSpyBar = validBarsForPoint.length > 0
        ? validBarsForPoint.reduce((prev, curr) => {
            const prevTime = new Date(prev.t).getTime();
            const currTime = new Date(curr.t).getTime();
            return currTime > prevTime ? curr : prev;
          })
        : spyBars[0];

      const spyReturn = ((closestSpyBar.c - initialSpyPrice) / initialSpyPrice) * 100;
      const portfolioReturn = ((item.value - initialPortfolioValue) / initialPortfolioValue) * 100;

      return { date: item.date, spyReturn, portfolioReturn };
    });

    // Normalize to start at 0
    let normalizedData = [];
    if (rawComparisonData.length > 0) {
      const firstSpyReturn = rawComparisonData[0].spyReturn;
      const firstPortfolioReturn = rawComparisonData[0].portfolioReturn;

      normalizedData = rawComparisonData.map((point, idx) => ({
        date: point.date,
        spyReturn: idx === 0 ? 0 : point.spyReturn - firstSpyReturn,
        portfolioReturn: idx === 0 ? 0 : point.portfolioReturn - firstPortfolioReturn
      }));
    }

    setSp500Data(normalizedData);
  }
}
```

**What Made It Work:**
- No logging overhead
- Simple filter logic: `new Date(bar.t).getTime() <= firstPortfolioTimestamp`
- Fallback to first bar if no valid bars found: `spyBars[0]`
- Direct state setting without complex validation

---

### Nov 14, 2025 Version (CURRENT - NOT WORKING)

**Key Code:**
```typescript
// Process SPY comparison data (use 1-point-per-day data)
console.log('[SPY COMPARISON] Checking SPY data:', {
  hasSpyData: !!data.spyData,
  hasBars: !!data.spyData?.bars,
  barsLength: data.spyData?.bars?.length || 0,
  portfolioHistoryLength: formattedHistoryOnePoint.length
});

if (data.spyData?.bars && formattedHistoryOnePoint.length > 0) {
  const spyBars = data.spyData.bars;
  console.log('[SPY COMPARISON] Processing SPY data, bars count:', spyBars.length);
  const initialPortfolioValue = formattedHistoryOnePoint[0].value;
  const firstPortfolioTimestamp = formattedHistoryOnePoint[0].timestamp;

  // Debug: Show timestamp ranges
  console.log('[SPY COMPARISON] Timestamp comparison:', {
    firstPortfolioDate: new Date(firstPortfolioTimestamp).toISOString(),
    firstPortfolioTimestamp,
    firstSpyBar: spyBars[0]?.t,
    firstSpyTimestamp: spyBars[0]?.t ? new Date(spyBars[0].t).getTime() : 'N/A',
    lastSpyBar: spyBars[spyBars.length - 1]?.t,
    lastSpyTimestamp: spyBars[spyBars.length - 1]?.t ? new Date(spyBars[spyBars.length - 1].t).getTime() : 'N/A'
  });

  // Find initial SPY price
  const validSpyBars = spyBars.filter((bar: { t: string; c: number }) =>
    new Date(bar.t).getTime() <= firstPortfolioTimestamp
  );

  console.log('[SPY COMPARISON] Valid bars found:', validSpyBars.length);

  if (validSpyBars.length > 0) {
    // ... same logic as before ...
    setSp500Data(normalizedData);
    console.log('[SPY COMPARISON] Set SP500 data, length:', normalizedData.length, 'Sample:', normalizedData.slice(0, 3));
  } else {
    console.warn('[SPY COMPARISON] No valid SPY bars found before first portfolio timestamp');
  }
} else {
  console.warn('[SPY COMPARISON] Skipped - Missing SPY data or portfolio history');
}
```

**What Changed:**
- Added extensive console logging (good for debugging)
- Added timestamp comparison logging
- **CRITICAL**: Removed fallback to `spyBars[0]` when no valid bars found
- Now shows warning and skips setting state if no valid bars

---

## Root Cause Analysis

### The Problem
The filter `validSpyBars = spyBars.filter(bar => new Date(bar.t).getTime() <= firstPortfolioTimestamp)` returns 0 results.

**This means**: ALL SPY bars have timestamps AFTER the first portfolio timestamp.

### Possible Causes

1. **Date Range Mismatch**
   - Portfolio starts: Oct 10, 2025
   - SPY data range: Oct 9 - Nov 13, 2025
   - If SPY data is in wrong timezone or has wrong dates, filter will fail

2. **Timestamp Format Issue**
   - Portfolio timestamp: Unix milliseconds
   - SPY bar timestamp: ISO string
   - Conversion via `new Date(bar.t).getTime()` might be failing

3. **Data Freshness**
   - Alpha Vantage might be returning data that starts AFTER portfolio start
   - Fallback cache might have wrong date range

4. **Timezone Problems**
   - SPY timestamps might be UTC
   - Portfolio timestamps might be local time
   - Comparison fails due to timezone offset

---

## API Data Flow

### Data Sources

1. **Alpha Vantage API** (Primary)
   ```
   https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=SPY&interval=60min&outputsize=full
   ```
   - Returns: `{ "Time Series (60min)": { "2025-10-10 15:00:00": { "4. close": "573.45" } } }`
   - Cached for 7 days in memory

2. **Fallback Cache** (Secondary)
   ```
   persistent_cache_2/spy_fallback.json
   ```
   - Contains: 352 bars from Oct 9 - Nov 7, 2025
   - Used when Alpha Vantage returns no data or errors

### Request Flow
```
Browser → /api/alpaca?endpoint=spy-bars&start=X&end=Y
         ↓
API Route: Check in-memory cache
         ↓
If expired: Fetch from Alpha Vantage
         ↓
If Alpha Vantage fails: Load from persistent_cache_2/spy_fallback.json
         ↓
Return { bars: [{t: "2025-10-09T02:00:00.000Z", c: 672.79}, ...] }
         ↓
Dashboard Component receives data
         ↓
Process in useEffect → Filter bars → Set state
         ↓
Render chart if sp500Data.length > 0
```

---

## Chart Rendering

### Chart Component (Lines 1797-1900)
```typescript
{(() => {
  console.log('[RENDER] SP500 chart condition - sp500Data.length:', sp500Data.length);
  return null;
})()}
{sp500Data.length > 0 && (
  <div className="bg-gray-800 rounded-lg p-6 mb-6">
    <h2 className="text-2xl font-bold text-white mb-4">
      AI Performance vs S&P 500
    </h2>
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={sp500Data}>
        {/* Chart configuration */}
      </LineChart>
    </ResponsiveContainer>
  </div>
)}
```

**Current Output:** `sp500Data.length: 0` → Chart not rendered

---

## Solution Strategy

### Step 1: Diagnose Timestamp Mismatch
Need to see actual timestamp values from console:
```
[SPY COMPARISON] Timestamp comparison: {
  firstPortfolioDate: "2025-10-10T00:00:00.000Z",
  firstPortfolioTimestamp: 1728518400000,
  firstSpyBar: "2025-10-09T02:00:00.000Z",
  firstSpyTimestamp: 1728439200000,
  lastSpyBar: "2025-11-13T18:00:00.000Z",
  lastSpyTimestamp: 1731524400000
}
```

### Step 2: Fix Filter Logic
If portfolio starts AFTER spy data, we need to:
- Use the FIRST SPY bar as baseline (even if before portfolio)
- Or find the CLOSEST SPY bar to portfolio start

### Step 3: Restore Fallback Behavior
Old version had: `spyBars[0]` as fallback
New version has: Nothing (state never set)

**Recommended Fix:**
```typescript
const validSpyBars = spyBars.filter((bar) =>
  new Date(bar.t).getTime() <= firstPortfolioTimestamp
);

// Use closest bar, even if after portfolio start
const initialSpyBar = validSpyBars.length > 0
  ? validSpyBars.reduce((prev, curr) => {
      const prevDiff = firstPortfolioTimestamp - new Date(prev.t).getTime();
      const currDiff = firstPortfolioTimestamp - new Date(curr.t).getTime();
      return currDiff < prevDiff && currDiff >= 0 ? curr : prev;
    })
  : spyBars[0]; // FALLBACK: Use first bar if none found before portfolio
```

---

## Next Steps

1. **Get Console Output**: User needs to refresh browser and share timestamp comparison logs
2. **Analyze Dates**: Compare actual timestamps to understand the mismatch
3. **Apply Fix**: Restore fallback logic or adjust date filtering
4. **Test**: Verify charts render correctly
5. **Clean Up**: Remove excessive logging once working

---

## Related Files

- `src/components/StaticDashboard.tsx` - Main dashboard component (lines 384-530)
- `src/app/api/alpaca/route.ts` - API proxy with fallback logic (lines 479-684)
- `src/app/dashboard/page.tsx` - Dashboard loader (fetches data)
- `persistent_cache_2/spy_fallback.json` - SPY backup data (352 bars)
- `persistent_cache_2/qqq_fallback.json` - QQQ backup data (336 bars)

---

**Document Created**: Nov 14, 2025
**Status**: Awaiting console output to diagnose timestamp mismatch
