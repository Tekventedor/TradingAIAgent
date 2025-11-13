"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Activity,
  AlertCircle,
  Target
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine } from 'recharts';
import { format } from 'date-fns';

// Type definitions
interface Account {
  portfolio_value: number;
  cash: number;
  buying_power: number;
  equity: number;
  account_number?: string;
  status?: string;
}

interface Position {
  asset_id: string;
  symbol: string;
  qty: number;
  side: string;
  market_value: number;
  cost_basis: number;
  avg_entry_price: number;
  unrealized_pl: number;
  unrealized_plpc: number;
  current_price: number;
}

interface Order {
  id: string;
  symbol: string;
  qty: string;
  side: string;
  type: string;
  status: string;
  filled_avg_price: string | null;
  submitted_at: string;
  filled_at?: string;
}

interface PortfolioHistory {
  equity: number[];
  timestamp: number[];
}

interface SPYData {
  bars: Array<{ t: string; c: number }>;
}

interface QQQData {
  bars: Array<{ t: string; c: number }>;
}

interface SnapshotData {
  timestamp: string;
  account: Account;
  positions: Position[];
  portfolioHistory: PortfolioHistory;
  orders: Order[];
  spyData: SPYData | null;
  qqqData: QQQData | null;
  stockData: Record<string, {
    bars: Array<{ t: string; c: number }>;
  }>;
  reasoning: Array<{
    timestamp: string;
    ticker: string;
    reasoning: string;
  }>;
}

interface StaticDashboardProps {
  data: SnapshotData;
}

export default function StaticDashboard({ data }: StaticDashboardProps) {
  const [mounted, setMounted] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [tradingLogs, setTradingLogs] = useState<Record<string, unknown>[]>([]);
  const [portfolioHistory, setPortfolioHistory] = useState<Array<{date: string, value: number, pnl: number, timestamp: number}>>([]);
  const [portfolioHistoryOnePoint, setPortfolioHistoryOnePoint] = useState<Array<{date: string, value: number, pnl: number, timestamp: number}>>([]);
  const [sp500Data, setSp500Data] = useState<Array<{date: string, spyReturn: number, portfolioReturn: number}>>([]);
  const [nasdaq100Data, setNasdaq100Data] = useState<Array<{date: string, qqqReturn: number, portfolioReturn: number}>>([]);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [modalReasoning, setModalReasoning] = useState<{ text: string; ticker: string; timestamp: string } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !data) return;

    // Process account data
    setAccount(data.account);

    // Process positions
    setPositions(data.positions);

    // Process orders into trading logs - increased to capture all October trades
    const logs = data.orders.slice(0, 100).map((order) => {
      const submittedDate = new Date(order.submitted_at);
      const filledDate = order.filled_at ? new Date(order.filled_at) : null;

      // Calculate if there's a significant date difference (more than 1 day)
      const hasDateDiscrepancy = filledDate &&
        Math.abs(filledDate.getTime() - submittedDate.getTime()) > (24 * 60 * 60 * 1000);

      return {
        id: order.id,
        title: `${order.symbol} ${order.side.toUpperCase()}`,
        description: `${order.type} order - ${order.status}`,
        action: order.side.toUpperCase(),
        symbol: order.symbol,
        quantity: parseFloat(order.qty),
        price: order.filled_avg_price ? parseFloat(order.filled_avg_price) : null,
        total_value: order.filled_avg_price ? parseFloat(order.filled_avg_price) * parseFloat(order.qty) : null,
        reason: `${order.type} ${order.side}`,
        confidence_score: order.status === 'filled' ? 1.0 : 0.5,
        market_data: {},
        tags: [order.status],
        timestamp: order.submitted_at,
        filled_at: order.filled_at,
        hasDateDiscrepancy
      };
    });

    // Calculate position tracking for net effect display
    // Sort logs chronologically to calculate cumulative positions
    const sortedLogs = [...logs].sort((a, b) => {
      if (!a.timestamp || !b.timestamp) return 0;
      return new Date(a.timestamp as string).getTime() - new Date(b.timestamp as string).getTime();
    });

    const positionTracker: Record<string, number> = {};
    const logsWithPositions = sortedLogs.map((log) => {
      const symbol = log.symbol as string;
      const quantity = log.quantity as number;
      const action = log.action as string;

      // Calculate position before trade
      const positionBefore = positionTracker[symbol] || 0;

      // Calculate position after trade
      let positionAfter = positionBefore;
      if (action === 'BUY') {
        positionAfter = positionBefore + quantity;
      } else if (action === 'SELL') {
        positionAfter = positionBefore - quantity;
      }

      // Update tracker
      positionTracker[symbol] = positionAfter;

      return {
        ...log,
        positionBefore,
        positionAfter
      };
    });

    setTradingLogs(logsWithPositions);

    // Process portfolio history
    if (data.portfolioHistory?.equity && data.portfolioHistory?.timestamp) {
      const historyData = data.portfolioHistory.equity
        .map((value: number, index: number) => ({
          timestamp: data.portfolioHistory.timestamp[index] * 1000,
          value: value,
        }))
        .filter((item: { timestamp: number; value: number }) => item.value > 1000);

      // Extend portfolio history to today with current account value
      // This ensures we always have data up to the current moment, even if Alpaca's history is behind
      const lastHistoryTimestamp = historyData.length > 0 ? historyData[historyData.length - 1].timestamp : 0;
      const now = Date.now();
      const sixHoursMs = 6 * 60 * 60 * 1000;

      // If the last data point is more than 6 hours old, fill the gap with interpolated points
      if (account && now - lastHistoryTimestamp > sixHoursMs) {
        const currentValue = account.portfolio_value || 0;
        const lastValue = historyData.length > 0 ? historyData[historyData.length - 1].value : currentValue;

        if (currentValue > 1000) {
          // Add data points to fill the gap from last history point to now
          const gapStartTime = lastHistoryTimestamp || (now - 24 * 60 * 60 * 1000);
          const hoursInGap = Math.ceil((now - gapStartTime) / (60 * 60 * 1000));

          // Add hourly points to fill the gap
          for (let i = 1; i <= Math.min(hoursInGap, 72); i++) { // Cap at 72 hours (3 days)
            const timestamp = gapStartTime + (i * 60 * 60 * 1000);
            if (timestamp <= now) {
              // Linear interpolation between last value and current value
              const progress = (timestamp - gapStartTime) / (now - gapStartTime);
              const interpolatedValue = lastValue + ((currentValue - lastValue) * progress);

              historyData.push({
                timestamp: timestamp,
                value: interpolatedValue
              });
            }
          }

          // Add final point at current time
          historyData.push({
            timestamp: now,
            value: currentValue
          });
        }
      }

      const filteredHistory = historyData;

      // Helper function to get up to 2 data points per day (for Stock Performance & Historical Trades)
      // IMPORTANT: Always includes at least 1 point per day, never skips days
      const getTwoPointsPerDay = (data: Array<{ timestamp: number; value: number }>) => {
        if (data.length === 0) return [];

        const dailyData: Record<string, Array<{ timestamp: number; value: number }>> = {};

        // Group by day
        data.forEach((item) => {
          const date = new Date(item.timestamp);
          const dayKey = format(date, 'yyyy-MM-dd');
          if (!dailyData[dayKey]) {
            dailyData[dayKey] = [];
          }
          dailyData[dayKey].push(item);
        });

        // Get all days in range (don't skip any days)
        const allDays = Object.keys(dailyData).sort();
        if (allDays.length === 0) return [];

        const firstDay = new Date(allDays[0]);
        const lastDay = new Date(allDays[allDays.length - 1]);

        // Fill in any missing days with the last known value
        const completeDailyData: Record<string, Array<{ timestamp: number; value: number }>> = {};
        let lastKnownData: Array<{ timestamp: number; value: number }> = [];

        for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
          const dayKey = format(d, 'yyyy-MM-dd');
          if (dailyData[dayKey]) {
            completeDailyData[dayKey] = dailyData[dayKey];
            lastKnownData = dailyData[dayKey];
          } else if (lastKnownData.length > 0) {
            // Use last known value for missing days
            const missingDayTimestamp = new Date(dayKey + 'T16:00:00Z').getTime();
            completeDailyData[dayKey] = [{
              timestamp: missingDayTimestamp,
              value: lastKnownData[lastKnownData.length - 1].value
            }];
          }
        }

        const result: Array<{ timestamp: number; value: number }> = [];

        // For each day, select up to 2 points
        Object.keys(completeDailyData).sort().forEach(dayKey => {
          const dayPoints = completeDailyData[dayKey].sort((a, b) => a.timestamp - b.timestamp);

          if (dayPoints.length === 1) {
            result.push(dayPoints[0]);
          } else if (dayPoints.length === 2) {
            result.push(dayPoints[0], dayPoints[1]);
          } else if (dayPoints.length > 2) {
            // Find point around afternoon (14:00-16:00 for trade time)
            const afternoonPoint = dayPoints.find(p => {
              const hour = new Date(p.timestamp).getHours();
              return hour >= 14 && hour <= 16;
            }) || dayPoints[Math.floor(dayPoints.length / 2)];

            // Find point at market close/evening (19:00-23:00)
            const eveningPoint = [...dayPoints].reverse().find(p => {
              const hour = new Date(p.timestamp).getHours();
              return hour >= 19 && hour <= 23;
            }) || dayPoints[dayPoints.length - 1];

            if (afternoonPoint.timestamp !== eveningPoint.timestamp) {
              if (afternoonPoint.timestamp < eveningPoint.timestamp) {
                result.push(afternoonPoint, eveningPoint);
              } else {
                result.push(eveningPoint, afternoonPoint);
              }
            } else {
              result.push(afternoonPoint);
            }
          }
        });

        return result.sort((a, b) => a.timestamp - b.timestamp);
      };

      // Helper function to get 1 data point per day (for Portfolio Value, S&P, NASDAQ)
      // IMPORTANT: Always includes at least 1 point per day, never skips days
      const getOnePointPerDay = (data: Array<{ timestamp: number; value: number }>) => {
        if (data.length === 0) return [];

        const dailyData: Record<string, { timestamp: number; value: number }> = {};

        data.forEach((item) => {
          const date = new Date(item.timestamp);
          const dayKey = format(date, 'yyyy-MM-dd');

          // Keep the last (latest) point of each day
          if (!dailyData[dayKey] || item.timestamp > dailyData[dayKey].timestamp) {
            dailyData[dayKey] = item;
          }
        });

        // Fill in missing days
        const allDays = Object.keys(dailyData).sort();
        if (allDays.length === 0) return [];

        const firstDay = new Date(allDays[0]);
        const lastDay = new Date(allDays[allDays.length - 1]);
        const completeDailyData: Record<string, { timestamp: number; value: number }> = {};
        let lastKnownValue = 0;

        for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
          const dayKey = format(d, 'yyyy-MM-dd');
          if (dailyData[dayKey]) {
            completeDailyData[dayKey] = dailyData[dayKey];
            lastKnownValue = dailyData[dayKey].value;
          } else if (lastKnownValue > 0) {
            // Use last known value for missing days (weekends/holidays)
            const missingDayTimestamp = new Date(dayKey + 'T16:00:00Z').getTime();
            completeDailyData[dayKey] = {
              timestamp: missingDayTimestamp,
              value: lastKnownValue
            };
          }
        }

        return Object.values(completeDailyData).sort((a, b) => a.timestamp - b.timestamp);
      };

      // Create datasets with different sampling rates
      const twoPointsData = getTwoPointsPerDay(filteredHistory);
      const onePointData = getOnePointPerDay(filteredHistory);

      // Format the 2-points-per-day data for Stock Performance and Historical Trades
      const formattedHistoryTwoPoints = twoPointsData
        .map((item: { timestamp: number; value: number }, index: number, arr) => {
          const date = new Date(item.timestamp);

          return {
            date: format(date, 'MM/dd HH:mm'),
            timestamp: item.timestamp,
            value: item.value,
            pnl: index > 0 ? item.value - arr[index - 1].value : 0
          };
        });

      // Format the 1-point-per-day data for Portfolio Value, S&P, NASDAQ
      const formattedHistoryOnePoint = onePointData
        .map((item: { timestamp: number; value: number }, index: number, arr) => {
          const date = new Date(item.timestamp);

          return {
            date: format(date, 'MM/dd'),
            timestamp: item.timestamp,
            value: item.value,
            pnl: index > 0 ? item.value - arr[index - 1].value : 0
          };
        });

      // Set both datasets
      setPortfolioHistory(formattedHistoryTwoPoints);
      setPortfolioHistoryOnePoint(formattedHistoryOnePoint);

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
          const initialSpyBar = validSpyBars.reduce((prev: { t: string; c: number }, curr: { t: string; c: number }) => {
            const prevDiff = firstPortfolioTimestamp - new Date(prev.t).getTime();
            const currDiff = firstPortfolioTimestamp - new Date(curr.t).getTime();
            return currDiff < prevDiff && currDiff >= 0 ? curr : prev;
          });
          const initialSpyPrice = initialSpyBar.c;

          // Calculate comparison data
          const rawComparisonData = formattedHistoryOnePoint.map((item) => {
            const itemTimestamp = item.timestamp;
            const validBarsForPoint = spyBars.filter((bar: { t: string; c: number }) =>
              new Date(bar.t).getTime() <= itemTimestamp
            );

            const closestSpyBar = validBarsForPoint.length > 0
              ? validBarsForPoint.reduce((prev: { t: string; c: number }, curr: { t: string; c: number }) => {
                  const prevTime = new Date(prev.t).getTime();
                  const currTime = new Date(curr.t).getTime();
                  return currTime > prevTime ? curr : prev;
                })
              : spyBars[0];

            const spyReturn = ((closestSpyBar.c - initialSpyPrice) / initialSpyPrice) * 100;
            const portfolioReturn = ((item.value - initialPortfolioValue) / initialPortfolioValue) * 100;

            return {
              date: item.date,
              spyReturn,
              portfolioReturn
            };
          });

          // Normalize to start at 0
          let normalizedData: Array<{date: string, spyReturn: number, portfolioReturn: number}> = [];
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

      // Process QQQ comparison data (use 1-point-per-day data)
      if (data.qqqData?.bars && formattedHistoryOnePoint.length > 0) {
        const qqqBars = data.qqqData.bars;
        const initialPortfolioValue = formattedHistoryOnePoint[0].value;
        const firstPortfolioTimestamp = formattedHistoryOnePoint[0].timestamp;

        // Find initial QQQ price
        const validQqqBars = qqqBars.filter((bar: { t: string; c: number }) =>
          new Date(bar.t).getTime() <= firstPortfolioTimestamp
        );

        if (validQqqBars.length > 0) {
          const initialQqqBar = validQqqBars.reduce((prev: { t: string; c: number }, curr: { t: string; c: number }) => {
            const prevDiff = firstPortfolioTimestamp - new Date(prev.t).getTime();
            const currDiff = firstPortfolioTimestamp - new Date(curr.t).getTime();
            return currDiff < prevDiff && currDiff >= 0 ? curr : prev;
          });
          const initialQqqPrice = initialQqqBar.c;

          // Calculate comparison data
          const rawComparisonData = formattedHistoryOnePoint.map((item) => {
            const itemTimestamp = item.timestamp;
            const validBarsForPoint = qqqBars.filter((bar: { t: string; c: number }) =>
              new Date(bar.t).getTime() <= itemTimestamp
            );

            const closestQqqBar = validBarsForPoint.length > 0
              ? validBarsForPoint.reduce((prev: { t: string; c: number }, curr: { t: string; c: number }) => {
                  const prevTime = new Date(prev.t).getTime();
                  const currTime = new Date(curr.t).getTime();
                  return currTime > prevTime ? curr : prev;
                })
              : qqqBars[0];

            const qqqReturn = ((closestQqqBar.c - initialQqqPrice) / initialQqqPrice) * 100;
            const portfolioReturn = ((item.value - initialPortfolioValue) / initialPortfolioValue) * 100;

            return {
              date: item.date,
              qqqReturn,
              portfolioReturn
            };
          });

          // Normalize to start at 0
          let normalizedData: Array<{date: string, qqqReturn: number, portfolioReturn: number}> = [];
          if (rawComparisonData.length > 0) {
            const firstQqqReturn = rawComparisonData[0].qqqReturn;
            const firstPortfolioReturn = rawComparisonData[0].portfolioReturn;

            normalizedData = rawComparisonData.map((point, idx) => ({
              date: point.date,
              qqqReturn: idx === 0 ? 0 : point.qqqReturn - firstQqqReturn,
              portfolioReturn: idx === 0 ? 0 : point.portfolioReturn - firstPortfolioReturn
            }));
          }

          setNasdaq100Data(normalizedData);
        }
      }
    }
  }, [mounted, data]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 flex items-center justify-center">
        <div className="text-gray-900 text-xl">Loading dashboard...</div>
      </div>
    );
  }

  const totalUnrealizedPnL = positions.reduce((sum, pos) => sum + pos.unrealized_pl, 0);

  // Calculate portfolio returns
  const currentPortfolioValue = account?.portfolio_value || 0;

  // Week Return (7 days)
  const weekStartValue = portfolioHistory.length > 0 ? portfolioHistory[0].value : 100000;
  const weekReturn = weekStartValue > 0
    ? ((currentPortfolioValue - weekStartValue) / weekStartValue) * 100
    : 0;
  const weekReturnDollar = currentPortfolioValue - weekStartValue;

  // Day Return (last 48 hours of activity)
  const fortyEightHoursAgo = Date.now() - (48 * 60 * 60 * 1000);
  const dayStartPoint = portfolioHistory.find(point => point.timestamp >= fortyEightHoursAgo);
  const dayStartValue = dayStartPoint ? dayStartPoint.value : weekStartValue;

  console.log('[2-DAY RETURN DEBUG]', {
    currentPortfolioValue,
    fortyEightHoursAgo: new Date(fortyEightHoursAgo).toISOString(),
    dayStartPoint: dayStartPoint ? { date: dayStartPoint.date, value: dayStartPoint.value } : 'NOT FOUND',
    dayStartValue,
    portfolioHistoryLength: portfolioHistory.length,
    firstPoint: portfolioHistory[0] ? { date: portfolioHistory[0].date, timestamp: portfolioHistory[0].timestamp, value: portfolioHistory[0].value } : 'NONE',
    lastPoint: portfolioHistory[portfolioHistory.length - 1] ? { date: portfolioHistory[portfolioHistory.length - 1].date, timestamp: portfolioHistory[portfolioHistory.length - 1].timestamp, value: portfolioHistory[portfolioHistory.length - 1].value } : 'NONE'
  });

  const dayReturn = dayStartValue > 0
    ? ((currentPortfolioValue - dayStartValue) / dayStartValue) * 100
    : 0;
  const dayReturnDollar = currentPortfolioValue - dayStartValue;

  // Month Return (30 days)
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const monthStartPoint = portfolioHistory.find(point => point.timestamp >= thirtyDaysAgo);
  const monthStartValue = monthStartPoint ? monthStartPoint.value : weekStartValue;
  const monthReturn = monthStartValue > 0
    ? ((currentPortfolioValue - monthStartValue) / monthStartValue) * 100
    : 0;
  const monthReturnDollar = currentPortfolioValue - monthStartValue;

  // Get all unique symbols that were ever traded
  const allTradedSymbols = Array.from(
    new Set(tradingLogs.map(log => log.symbol as string).filter(Boolean))
  );

  // Calculate Win Rate (percentage of profitable closed trades)
  const closedTrades = allTradedSymbols.filter(symbol => {
    const symbolTrades = tradingLogs.filter(log => log.symbol === symbol);
    const buys = symbolTrades.filter(t => t.action === 'BUY');
    const sells = symbolTrades.filter(t => t.action === 'SELL');
    // A trade is closed if it has both buys and sells
    return buys.length > 0 && sells.length > 0;
  });

  const profitableClosedTrades = closedTrades.filter(symbol => {
    const symbolTrades = tradingLogs.filter(log => log.symbol === symbol);
    const buys = symbolTrades.filter(t => t.action === 'BUY');
    const sells = symbolTrades.filter(t => t.action === 'SELL');
    const avgBuyPrice = buys.reduce((sum, t) => sum + (t.price as number || 0), 0) / buys.length;
    const avgSellPrice = sells.reduce((sum, t) => sum + (t.price as number || 0), 0) / sells.length;
    // Profitable if sell price > buy price
    return avgSellPrice > avgBuyPrice;
  });

  const winRate = closedTrades.length > 0
    ? (profitableClosedTrades.length / closedTrades.length) * 100
    : 0;

  // Calculate Market Exposure
  const investedAmount = (account?.portfolio_value || 0) - (account?.cash || 0);
  const marketExposure = account?.portfolio_value
    ? (investedAmount / account.portfolio_value) * 100
    : 0;

  // Define color palette
  const COLORS = ['#8b5cf6', '#22d3ee', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#a855f7'];

  // Assign colors to current positions (for Stock Performance chart)
  const AGENT_COLORS: Record<string, string> = {};
  positions.forEach((pos, index) => {
    if (pos.symbol && !AGENT_COLORS[pos.symbol]) {
      AGENT_COLORS[pos.symbol] = COLORS[index % COLORS.length];
    }
  });

  // Assign colors to ALL traded symbols (for historical chart)
  const ALL_TRADED_COLORS: Record<string, string> = {};
  allTradedSymbols.forEach((symbol, index) => {
    if (symbol && !ALL_TRADED_COLORS[symbol]) {
      ALL_TRADED_COLORS[symbol] = COLORS[index % COLORS.length];
    }
  });

  // Calculate agent performance history with real stock data
  // First, find the earliest buy date for current positions only
  const currentSymbols = new Set(positions.map(p => p.symbol));
  let earliestCurrentPositionTime = Infinity;

  tradingLogs.forEach((log) => {
    const symbol = log.symbol as string;
    const action = log.action as string;
    const logTime = log.timestamp ? new Date(log.timestamp as string).getTime() : Infinity;

    // Only consider BUY trades for symbols we currently hold
    if (currentSymbols.has(symbol) && action === 'BUY' && logTime < earliestCurrentPositionTime) {
      earliestCurrentPositionTime = logTime;
    }
  });

  console.log('[STOCK PERFORMANCE] Current positions:', positions.map(p => p.symbol));
  console.log('[STOCK PERFORMANCE] Available stock data symbols:', Object.keys(data.stockData || {}));
  console.log('[STOCK PERFORMANCE] Portfolio history points:', portfolioHistory.length);
  if (portfolioHistory.length > 0 && portfolioHistory[0]?.timestamp) {
    console.log('[STOCK PERFORMANCE] First portfolio point:', portfolioHistory[0].date, new Date(portfolioHistory[0].timestamp).toISOString());
  }
  if (portfolioHistory.length > 0 && portfolioHistory[portfolioHistory.length - 1]?.timestamp) {
    console.log('[STOCK PERFORMANCE] Last portfolio point:', portfolioHistory[portfolioHistory.length - 1].date, new Date(portfolioHistory[portfolioHistory.length - 1].timestamp).toISOString());
  }
  console.log('[STOCK PERFORMANCE] Current time:', new Date().toISOString());
  console.log('[STOCK PERFORMANCE] Earliest current position time:',
    earliestCurrentPositionTime === Infinity ? 'No positions found' : new Date(earliestCurrentPositionTime).toISOString());

  const agentPerformanceHistory = portfolioHistory.map((point) => {
    const result: Record<string, string | number> = { date: point.date, total: point.value, timestamp: point.timestamp };
    const pointTime = point.timestamp;

    // Calculate the current position for each symbol at this point in time
    const positionsAtPoint: Record<string, number> = {};

    // Go through all trades up to this point to calculate cumulative positions
    tradingLogs.forEach((log) => {
      const symbol = log.symbol as string;
      const logTime = log.timestamp ? new Date(log.timestamp as string).getTime() : 0;

      // Only consider trades that happened before or at this point
      if (logTime <= pointTime && symbol) {
        // Use the position after this trade
        const positionAfter = log.positionAfter as number | undefined;
        if (positionAfter !== undefined) {
          positionsAtPoint[symbol] = positionAfter;
        }
      }
    });

    // Track if we have any CURRENT positions at this point (not closed positions)
    let hasCurrentPosition = false;

    // Now calculate the value of each CURRENT position using historical prices
    Object.entries(positionsAtPoint).forEach(([symbol, quantity]) => {
      // Only include current positions (symbols we still hold)
      if (quantity !== 0 && currentSymbols.has(symbol)) {
        hasCurrentPosition = true;
        // Find the closest price data for this symbol at this time
        // Check stockData first, then spyData/qqqData for SPY/QQQ
        let stockBars = data.stockData?.[symbol]?.bars;
        if (!stockBars && symbol === 'SPY') {
          stockBars = data.spyData?.bars;
        } else if (!stockBars && symbol === 'QQQ') {
          stockBars = data.qqqData?.bars;
        }

        if (!stockBars || stockBars.length === 0) {
          console.log(`[STOCK PERFORMANCE] No stock bars for ${symbol}, bars count:`, stockBars?.length || 0);
        }

        if (stockBars && stockBars.length > 0) {
          // Find the closest bar to this timestamp
          const closestBar = stockBars.reduce((prev, curr) => {
            const prevDiff = Math.abs(new Date(prev.t).getTime() - pointTime);
            const currDiff = Math.abs(new Date(curr.t).getTime() - pointTime);
            return currDiff < prevDiff ? curr : prev;
          });

          // Calculate position value: quantity × price
          const positionValue = Math.abs(quantity * closestBar.c);
          result[symbol] = positionValue;
        } else {
          // Fallback: If no Alpha Vantage data, use current price from position
          const currentPosition = positions.find(p => p.symbol === symbol);
          if (currentPosition && currentPosition.current_price) {
            const positionValue = Math.abs(quantity * currentPosition.current_price);
            result[symbol] = positionValue;
          }
        }
      }
    });

    // Mark this point as having current positions or not
    result.hasActivePosition = hasCurrentPosition ? 1 : 0;

    return result;
  }).filter((point: any) =>
    point.hasActivePosition && point.timestamp >= earliestCurrentPositionTime
  ); // Only keep points with current positions from the earliest current position onwards

  console.log('[STOCK PERFORMANCE] Agent performance history points after filter:', agentPerformanceHistory.length);
  if (agentPerformanceHistory.length > 0) {
    const firstPoint = agentPerformanceHistory[0];
    const lastPoint = agentPerformanceHistory[agentPerformanceHistory.length - 1];
    if (firstPoint?.timestamp) {
      console.log('[STOCK PERFORMANCE] First agent point:', firstPoint.date, new Date(firstPoint.timestamp as number).toISOString());
    }
    if (lastPoint?.timestamp) {
      console.log('[STOCK PERFORMANCE] Last agent point:', lastPoint.date, new Date(lastPoint.timestamp as number).toISOString());
    }
  }

  // Calculate P&L % for current positions only
  const agentPnLPercent: Record<string, number> = {};
  positions.forEach(pos => {
    if (pos.symbol) {
      const pnlPercent = ((pos.current_price - pos.avg_entry_price) / pos.avg_entry_price) * 100;
      agentPnLPercent[pos.symbol] = pnlPercent;
    }
  });

  // Calculate entry prices for all symbols (for dynamic tooltip calculations)
  const entryPrices: Record<string, number> = {};
  allTradedSymbols.forEach(symbol => {
    if (!symbol) return;
    const symbolTrades = tradingLogs.filter(log => log.symbol === symbol);
    const buys = symbolTrades.filter(t => t.action === 'BUY' && t.price);
    if (buys.length > 0) {
      entryPrices[symbol] = buys.reduce((sum, t) => sum + (t.price as number), 0) / buys.length;
    }
  });

  // Track quantities at each point for P&L calculation
  const quantitiesAtPoint: Record<string, Record<string, number>> = {}; // { timestamp: { symbol: quantity } }

  portfolioHistory.forEach((point) => {
    const pointTime = point.timestamp;
    const quantities: Record<string, number> = {};

    tradingLogs.forEach((log) => {
      const symbol = log.symbol as string;
      const logTime = log.timestamp ? new Date(log.timestamp as string).getTime() : 0;

      if (logTime <= pointTime && symbol) {
        const positionAfter = log.positionAfter as number | undefined;
        if (positionAfter !== undefined) {
          quantities[symbol] = positionAfter;
        }
      }
    });

    quantitiesAtPoint[pointTime.toString()] = quantities;
  });

  // Calculate historical chart data for ALL trades (including closed positions)
  // First, determine holding periods for each symbol (first buy to last sell)
  // Only consider trades within the portfolio history timeframe (ignore reconstructed pre-history trades)
  const portfolioStartTime = portfolioHistory.length > 0 ? portfolioHistory[0].timestamp : 0;

  const symbolHoldingPeriods: Record<string, { firstBuy: number; lastSell: number | null }> = {};

  allTradedSymbols.forEach(symbol => {
    if (!symbol) return;

    const symbolTrades = tradingLogs.filter(log => log.symbol === symbol);

    // Only consider buys that are within the portfolio history timeframe
    const buys = symbolTrades.filter(t => {
      if (t.action !== 'BUY') return false;
      const tradeTime = t.timestamp ? new Date(t.timestamp as string).getTime() : 0;
      return tradeTime >= portfolioStartTime; // Filter out pre-history trades
    });

    const sells = symbolTrades.filter(t => t.action === 'SELL');

    if (buys.length > 0) {
      // Get first buy timestamp (within portfolio history)
      const firstBuyTime = Math.min(...buys.map(b =>
        b.timestamp ? new Date(b.timestamp as string).getTime() : Infinity
      ));

      // Get last sell timestamp (or null if still holding)
      let lastSellTime: number | null = null;
      if (sells.length > 0) {
        lastSellTime = Math.max(...sells.map(s =>
          s.timestamp ? new Date(s.timestamp as string).getTime() : 0
        ));
      }

      symbolHoldingPeriods[symbol] = {
        firstBuy: firstBuyTime,
        lastSell: lastSellTime
      };

      // Debug logging for holding periods
      console.log(`[HOLDING PERIOD] ${symbol}:`, {
        firstBuy: new Date(firstBuyTime).toISOString(),
        lastSell: lastSellTime ? new Date(lastSellTime).toISOString() : 'Still holding',
        portfolioStartTime: new Date(portfolioStartTime).toISOString(),
        buys: buys.map(b => ({ timestamp: b.timestamp, price: b.price })),
        sells: sells.map(s => ({ timestamp: s.timestamp, price: s.price }))
      });
    }
  });

  const historicalTradesData = portfolioHistory.map((point) => {
    const result: Record<string, string | number> = { date: point.date, total: point.value };
    const pointTime = point.timestamp;

    // Calculate the current position for each symbol at this point in time
    const positionsAtPoint: Record<string, number> = {};

    // Go through all trades up to this point to calculate cumulative positions
    tradingLogs.forEach((log) => {
      const symbol = log.symbol as string;
      const logTime = log.timestamp ? new Date(log.timestamp as string).getTime() : 0;

      // Only consider trades that happened before or at this point
      if (logTime <= pointTime && symbol) {
        const positionAfter = log.positionAfter as number | undefined;
        if (positionAfter !== undefined) {
          positionsAtPoint[symbol] = positionAfter;
        }
      }
    });

    // Now calculate the value of each position using historical prices
    Object.entries(positionsAtPoint).forEach(([symbol, quantity]) => {
      // Check if this point is within the holding period for this symbol
      const holdingPeriod = symbolHoldingPeriods[symbol];
      if (!holdingPeriod) return;

      // Only show data between first buy and last sell (or current time if still holding)
      if (pointTime < holdingPeriod.firstBuy) return;
      if (holdingPeriod.lastSell && pointTime > holdingPeriod.lastSell) return;

      // For historical chart, show value even when position was open (not just current positions)
      // Check stockData first, then spyData/qqqData for SPY/QQQ
      let stockBars = data.stockData?.[symbol]?.bars;
      if (!stockBars && symbol === 'SPY') {
        stockBars = data.spyData?.bars;
      } else if (!stockBars && symbol === 'QQQ') {
        stockBars = data.qqqData?.bars;
      }

      if (stockBars && stockBars.length > 0) {
        // Find the closest bar to this timestamp
        const closestBar = stockBars.reduce((prev, curr) => {
          const prevDiff = Math.abs(new Date(prev.t).getTime() - pointTime);
          const currDiff = Math.abs(new Date(curr.t).getTime() - pointTime);
          return currDiff < prevDiff ? curr : prev;
        });

        // Calculate position value: quantity × price
        // If position is 0, don't show on chart (line stops)
        if (quantity !== 0) {
          const positionValue = Math.abs(quantity * closestBar.c);
          result[symbol] = positionValue;
        }
      }
    });

    return result;
  });

  // Calculate P&L for closed positions (for historical chart legend)
  const historicalPnLPercent: Record<string, number> = {};

  allTradedSymbols.forEach(symbol => {
    const symbolTrades = tradingLogs.filter(log => log.symbol === symbol);
    if (symbolTrades.length > 0) {
      const buys = symbolTrades.filter(t => t.action === 'BUY');
      const sells = symbolTrades.filter(t => t.action === 'SELL');

      if (buys.length > 0 && sells.length > 0) {
        const avgBuyPrice = buys.reduce((sum, t) => sum + (t.price as number || 0), 0) / buys.length;
        const avgSellPrice = sells.reduce((sum, t) => sum + (t.price as number || 0), 0) / sells.length;

        if (avgBuyPrice > 0) {
          historicalPnLPercent[symbol] = ((avgSellPrice - avgBuyPrice) / avgBuyPrice) * 100;
        }
      } else if (buys.length > 0 && positions.find(p => p.symbol === symbol)) {
        // Use current position P&L if still open
        historicalPnLPercent[symbol] = agentPnLPercent[symbol] || 0;
      }
    }
  });

  // Custom tooltip positioning function - centers on cursor, prevents bottom overflow
  const centerTooltipPosition = (props: any) => {
    if (!props || !props.coordinate) return { x: 0, y: 0 };

    const { x, y } = props.coordinate;
    const tooltipWidth = 300;

    // Dynamically calculate tooltip height based on number of items in payload
    const numItems = props.payload?.length || 1;
    const headerHeight = 60; // Date header + padding
    const itemHeight = 28; // Each stock line
    const tooltipHeight = headerHeight + (numItems * itemHeight);

    const chartHeight = 600;

    // Center tooltip horizontally on cursor (cursor in middle of tooltip)
    let centeredX = x - tooltipWidth / 2;

    // Center tooltip vertically on cursor (cursor in middle of tooltip)
    let centeredY = y - tooltipHeight / 2;

    // Prevent going below x-axis - x-axis labels take ~100px, so stop well before that
    // Chart plotting area ends about 100px before the bottom of the container
    const xAxisLabelHeight = 100; // Space reserved for x-axis labels
    const chartPlottingBottom = chartHeight - xAxisLabelHeight;

    // If tooltip would extend below the chart plotting area, move it up
    if (centeredY + tooltipHeight > chartPlottingBottom) {
      centeredY = chartPlottingBottom - tooltipHeight;
    }

    // Prevent going above chart
    if (centeredY < 10) {
      centeredY = 10;
    }

    // Prevent going off left edge
    if (centeredX < 10) {
      centeredX = 10;
    }

    // Prevent going off right edge
    const chartWidth = 1200; // approximate chart width
    if (centeredX + tooltipWidth > chartWidth - 10) {
      centeredX = chartWidth - tooltipWidth - 10;
    }

    return { x: centeredX, y: centeredY };
  };

  // Custom Tooltip Component for Dynamic P&L Calculation
  const CustomStockTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const dataPoint = payload[0].payload;
    const timestamp = portfolioHistory.find(p => p.date === dataPoint.date)?.timestamp;

    if (!timestamp) return null;

    const quantities = quantitiesAtPoint[timestamp.toString()] || {};

    return (
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        padding: '8px 12px',
        color: '#111827'
      }}>
        <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>{dataPoint.date}</p>
        {payload
          .sort((a: any, b: any) => b.value - a.value)
          .map((entry: any) => {
            const symbol = entry.name;
            const value = entry.value;
            const quantity = quantities[symbol] || 0;
            const entryPrice = entryPrices[symbol] || 0;

            let pnl = 0;
            if (quantity > 0 && entryPrice > 0) {
              const currentPrice = value / quantity;
              pnl = ((currentPrice - entryPrice) / entryPrice) * 100;
            }

            return (
              <div key={symbol} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span style={{ color: entry.stroke, fontWeight: 'bold' }}>{symbol}:</span>
                <span>${value.toLocaleString()} ({pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%)</span>
              </div>
            );
          })}
      </div>
    );
  };

  // Custom Tooltip for Historical Trades (same logic, different chart)
  const CustomHistoricalTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    const dataPoint = payload[0].payload;
    const timestamp = portfolioHistory.find(p => p.date === dataPoint.date)?.timestamp;

    if (!timestamp) return null;

    const quantities = quantitiesAtPoint[timestamp.toString()] || {};

    return (
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        padding: '8px 12px',
        color: '#111827'
      }}>
        <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>{dataPoint.date}</p>
        {payload
          .filter((entry: any) => entry.value !== null && entry.value !== undefined)
          .sort((a: any, b: any) => b.value - a.value)
          .map((entry: any) => {
            const symbol = entry.name;
            const value = entry.value;
            const quantity = quantities[symbol] || 0;
            const entryPrice = entryPrices[symbol] || 0;

            let pnl = 0;
            if (quantity > 0 && entryPrice > 0) {
              const currentPrice = value / quantity;
              pnl = ((currentPrice - entryPrice) / entryPrice) * 100;
            }

            return (
              <div key={symbol} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span style={{ color: entry.stroke, fontWeight: 'bold' }}>{symbol}:</span>
                <span>${value.toLocaleString()} ({pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%)</span>
              </div>
            );
          })}
      </div>
    );
  };

  // VERIFICATION LOGGING - Check data for each stock
  console.log('\n========== STOCK DATA VERIFICATION ==========');
  allTradedSymbols.forEach(symbol => {
    if (!symbol) return;

    // Check if we have price data
    let hasPriceData = false;
    let barCount = 0;
    if (data.stockData?.[symbol]?.bars) {
      hasPriceData = true;
      barCount = data.stockData[symbol].bars.length;
    } else if (symbol === 'SPY' && data.spyData?.bars) {
      hasPriceData = true;
      barCount = data.spyData.bars.length;
    } else if (symbol === 'QQQ' && data.qqqData?.bars) {
      hasPriceData = true;
      barCount = data.qqqData.bars.length;
    }

    // Check position status
    const isOpen = positions.some(p => p.symbol === symbol);
    const positionStatus = isOpen ? 'Open' : 'Closed';

    // Get buy/sell prices from trading logs
    const symbolTrades = tradingLogs.filter(log => log.symbol === symbol);
    const buys = symbolTrades.filter(t => t.action === 'BUY');
    const sells = symbolTrades.filter(t => t.action === 'SELL');

    const buyPrice = buys.length > 0 ? (buys[0].price as number) : null;
    const sellPrice = sells.length > 0 ? (sells[sells.length - 1].price as number) : null;

    console.log(`${symbol}    ${hasPriceData ? `✅ ${barCount} bars` : '❌ Missing'}    ${positionStatus}    Buy: ${buyPrice ? '$' + buyPrice.toFixed(2) : '❌'}    Sell: ${sellPrice ? '$' + sellPrice.toFixed(2) : isOpen ? 'N/A (Open)' : '❌'}`);
  });
  console.log('============================================\n');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img
                src="https://static.flowhunt.io/images/logo.svg"
                alt="Flowhunt Logo"
                className="h-8"
              />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">AI Trading Bot</h1>
                <p className="text-xs text-gray-600">Snapshot from {new Date(data.timestamp).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Card 1: Total Balance */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Balance</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${account?.portfolio_value?.toLocaleString() || '0'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Cash + holdings</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Card 2: Monthly Return */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Monthly Return</p>
                <p className={`text-2xl font-bold ${monthReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {monthReturn >= 0 ? '+' : ''}{monthReturn.toFixed(2)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {monthReturnDollar >= 0 ? '+' : ''}${monthReturnDollar.toLocaleString()} (30 days)
                </p>
              </div>
              <div className={`p-3 rounded-lg ${monthReturn >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                {monthReturn >= 0 ? (
                  <TrendingUp className="w-6 h-6 text-green-600" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-red-600" />
                )}
              </div>
            </div>
          </div>

          {/* Card 3: Invested in Stocks */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Invested in Stocks</p>
                <p className="text-2xl font-bold text-gray-900">
                  {marketExposure.toFixed(0)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {marketExposure.toFixed(0)}% invested
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Card 4: Buying Power */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Buying Power</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${account?.cash?.toLocaleString() || '0'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Uninvested cash</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Stock Performance Chart - Full Width */}
        <div className="mb-8">
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Stock Performance (AI Trades)</h3>
              <div className="text-sm text-gray-600">
                Unrealized P&L: <span className={`font-bold ${totalUnrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalUnrealizedPnL >= 0 ? '+' : ''}{((totalUnrealizedPnL / (account?.portfolio_value || 1)) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={500}>
                <LineChart data={agentPerformanceHistory.length > 0 ? agentPerformanceHistory : portfolioHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis
                    dataKey="date"
                    stroke="#6B7280"
                    style={{ fontSize: '10px' }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                <YAxis
                  stroke="#6B7280"
                  scale="log"
                  domain={[5000, 20000]}
                  ticks={[5000, 7500, 10000, 15000, 20000]}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                  style={{ fontSize: '12px' }}
                />
                <Tooltip
                  position={centerTooltipPosition}
                  content={<CustomStockTooltip />}
                  wrapperStyle={{ pointerEvents: 'none' }}
                  allowEscapeViewBox={{ x: false, y: true }}
                  isAnimationActive={false}
                />
                {positions.map((pos, index) => pos.symbol && (
                  <Line
                    key={pos.symbol}
                    type="monotone"
                    dataKey={pos.symbol}
                    stroke={AGENT_COLORS[pos.symbol] || COLORS[index % COLORS.length]}
                    strokeWidth={3}
                    dot={false}
                    name={pos.symbol}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            {/* Stock Performance Legend - Current positions only */}
            <div className="mt-4 grid grid-cols-3 gap-x-4 gap-y-2">
              {positions.slice(0, 9).map((pos, originalIndex) => {
                if (!pos.symbol) return null;

                // Use the original index to get the consistent color
                const colorIndex = originalIndex % COLORS.length;

                return (
                  <div key={pos.symbol} className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: AGENT_COLORS[pos.symbol] || COLORS[colorIndex] }}
                      ></div>
                      <span className="text-gray-700 font-medium">{pos.symbol}</span>
                    </div>
                    <span className={`font-bold ml-2 ${(agentPnLPercent[pos.symbol] || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(agentPnLPercent[pos.symbol] || 0) >= 0 ? '+' : ''}{(agentPnLPercent[pos.symbol] || 0).toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Activity Log - Full Width */}
        <div className="mb-8">
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center space-x-2 mb-4">
              <Activity className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">Activity Log</h3>
            </div>

            <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
              {(() => {
                // All reasoning entries are now standalone logs (no ticker matching)
                const reasoningLogs = (data.reasoning || []).map((r, idx) => ({
                  type: 'reasoning' as const,
                  timestamp: r.timestamp,
                  data: { ...r, id: `reasoning-${idx}` }
                }));

                // Create combined list of trades and reasoning logs
                const combinedLogs: Array<{
                  type: 'trade' | 'reasoning';
                  timestamp: string;
                  data: any;
                }> = [
                  ...tradingLogs.map(log => ({
                    type: 'trade' as const,
                    timestamp: log.timestamp as string,
                    data: log
                  })),
                  ...reasoningLogs
                ];

                // Sort by timestamp descending (most recent first)
                combinedLogs.sort((a, b) =>
                  new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );

                return combinedLogs.map((item, index) => {
                  if (item.type === 'reasoning') {
                    // Reasoning log entry (all reasoning is now standalone)
                    const reasoning = item.data;
                    const isExpanded = expandedLogIds.has(reasoning.id);

                    return (
                      <div
                        key={reasoning.id}
                        className={`rounded-lg p-3 border hover:bg-gray-100 transition-all cursor-pointer relative ${
                          isExpanded
                            ? 'bg-white/95 backdrop-blur-md border-gray-400 shadow-2xl ring-2 ring-purple-200 z-10'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                        onClick={() => {
                          const reasoningId = reasoning.id;
                          const isCurrentlyExpanded = expandedLogIds.has(reasoningId);

                          if (isCurrentlyExpanded) {
                            // Second click: Open modal
                            setModalReasoning({
                              text: reasoning.reasoning,
                              ticker: 'Analysis',
                              timestamp: reasoning.timestamp
                            });
                          } else {
                            // First click: Expand in place
                            setExpandedLogIds(prev => {
                              const newSet = new Set(prev);
                              newSet.add(reasoningId);
                              return newSet;
                            });
                          }
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <Activity className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <span className="text-xs text-gray-400">
                              {new Date(reasoning.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                              {new Date(reasoning.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                            </span>
                          </div>
                        </div>
                        <p className={`text-xs text-gray-900 leading-snug ${isExpanded ? '' : 'line-clamp-1'}`}>
                          {reasoning.reasoning}
                        </p>
                      </div>
                    );
                  } else {
                    // Trade entry display
                    const log = item.data;
                    const isPending = !log.price || log.price === null;

                    return (
                      <div
                        key={log.id as string}
                        className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            {log.action === 'BUY' ? (
                              <TrendingUp className="w-3 h-3 text-green-600 flex-shrink-0" />
                            ) : log.action === 'SELL' ? (
                              <TrendingDown className="w-3 h-3 text-red-600 flex-shrink-0" />
                            ) : (
                              <Activity className="w-3 h-3 text-gray-600 flex-shrink-0" />
                            )}
                            <span className={`text-xs font-semibold ${
                              log.action === 'BUY' ? 'text-green-600' :
                              log.action === 'SELL' ? 'text-red-600' :
                              'text-gray-600'
                            }`}>
                              {log.action as string}
                            </span>
                            <span className="text-xs text-gray-900">{log.symbol as string}</span>
                            {log.timestamp && (
                              <span className="text-xs text-gray-400">
                                {new Date(log.timestamp as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                                {new Date(log.timestamp as string).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                {log.hasDateDiscrepancy && log.filled_at && (
                                  <>
                                    {'\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'}Filled {new Date(log.filled_at as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                                    {new Date(log.filled_at as string).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                  </>
                                )}
                              </span>
                            )}
                            {isPending && (
                              <span className="text-xs text-gray-500 font-semibold">(Pending)</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            {isPending ? (
                              <>
                                <span className="text-xs text-gray-600">{log.quantity as number} shares</span>
                                <span className="text-xs text-gray-500 font-medium italic">Awaiting fill</span>
                              </>
                            ) : (
                              <>
                                <span className="text-xs text-gray-600">{log.quantity as number} @ ${(log.price as number | undefined)?.toFixed(2)}</span>
                                <span className="text-xs text-gray-900 font-medium">
                                  ${(log.total_value as number | undefined)?.toLocaleString()}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                });
              })()}
              {tradingLogs.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No activity yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Portfolio Value - Full Width */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Portfolio Value</h3>
              {portfolioHistoryOnePoint.length > 0 && (() => {
                const values = portfolioHistoryOnePoint.map(h => h.value);
                const max = Math.max(...values);
                const min = Math.min(...values);
                const avg = values.reduce((a, b) => a + b, 0) / values.length;

                return (
                  <div className="flex items-center space-x-3 text-xs">
                    <div className="flex items-center space-x-1">
                      <span className="text-gray-600">Max:</span>
                      <span className="text-green-600 font-semibold">${max.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-gray-600">Min:</span>
                      <span className="text-red-600 font-semibold">${min.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-gray-600">Avg:</span>
                      <span className="text-blue-600 font-semibold">${avg.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
              <ResponsiveContainer width="100%" height={600}>
                <LineChart data={portfolioHistoryOnePoint}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis
                    dataKey="date"
                    stroke="#6B7280"
                    style={{ fontSize: '10px' }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval={0}
                  />
                <YAxis
                  stroke="#6B7280"
                  domain={[90000, 110000]}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                  style={{ fontSize: '12px' }}
                />
                <Tooltip
                  position={centerTooltipPosition}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    color: '#111827'
                  }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;

                      // Find ALL trades at this point
                      const tradesAtPoint = tradingLogs.filter(log => {
                        if (!log.timestamp) return false;
                        const tradeTimestamp = new Date(log.timestamp as string).getTime();
                        const closestPoint = portfolioHistoryOnePoint.reduce((prev, curr) => {
                          const prevDiff = Math.abs(prev.timestamp - tradeTimestamp);
                          const currDiff = Math.abs(curr.timestamp - tradeTimestamp);
                          return currDiff < prevDiff ? curr : prev;
                        });
                        return closestPoint.date === data.date;
                      });

                      return (
                        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg" style={{ maxWidth: tradesAtPoint.length > 4 ? '1200px' : '300px' }}>
                          <p className="text-gray-600 text-xs mb-1">{data.date}</p>
                          <p className="text-gray-900 font-semibold">
                            Portfolio Value: ${data.value.toLocaleString()}
                          </p>
                          {tradesAtPoint.length > 0 && (
                            <div className={`mt-2 pt-2 border-t border-gray-200 gap-3 ${tradesAtPoint.length > 4 ? 'grid grid-cols-4' : 'space-y-2'}`}>
                              {tradesAtPoint.map((trade, idx) => {
                                const positionBefore = trade.positionBefore as number | undefined;
                                const positionAfter = trade.positionAfter as number | undefined;

                                return (
                                  <div key={idx} className={trade.action === 'BUY' ? 'text-green-600' : 'text-red-600'}>
                                    <p className="font-bold text-sm">
                                      {trade.action} {trade.symbol}
                                    </p>
                                    {positionBefore !== undefined && positionAfter !== undefined && (
                                      <p className="text-xs text-gray-600 mb-1">
                                        Position: {positionBefore} → {positionAfter}
                                        {positionAfter === 0 && ' (CLOSED)'}
                                      </p>
                                    )}
                                    <p className="text-xs">
                                      {trade.quantity} shares @ ${(trade.price as number)?.toFixed(2)}
                                    </p>
                                    <p className="text-xs font-semibold">
                                      Total: ${(trade.total_value as number)?.toLocaleString()}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {tradingLogs.filter(log => log.timestamp).map((log) => {
                  const tradeTimestamp = new Date(log.timestamp as string).getTime();
                  const isBuy = log.action === 'BUY';

                  // Safety check - need data points to match against
                  if (portfolioHistoryOnePoint.length === 0) return null;

                  // Find closest data point in portfolio history
                  const closestPoint = portfolioHistoryOnePoint.reduce((prev, curr) => {
                    const prevDiff = Math.abs(prev.timestamp - tradeTimestamp);
                    const currDiff = Math.abs(curr.timestamp - tradeTimestamp);
                    return currDiff < prevDiff ? curr : prev;
                  });

                  return (
                    <ReferenceLine
                      key={log.id as string}
                      x={closestPoint.date}
                      stroke={isBuy ? '#10b981' : '#ef4444'}
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      label={{
                        value: isBuy ? '▲' : '▼',
                        position: 'top',
                        fill: isBuy ? '#10b981' : '#ef4444',
                        fontSize: 14,
                      }}
                    />
                  );
                })}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6' }}
                />
              </LineChart>
            </ResponsiveContainer>
        </div>

        {/* Agent Distribution with Metrics - Full Width */}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 mb-8">
          {/* Left Side - Stats Cards (30% width) */}
          <div className="lg:col-span-3 space-y-4">
            {/* Week Return Card */}
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-xs font-medium">Week Return</p>
                  <p className={`text-xl font-bold ${weekReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {weekReturn >= 0 ? '+' : ''}{weekReturn.toFixed(2)}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {weekReturnDollar >= 0 ? '+' : ''}${weekReturnDollar.toLocaleString()} (7 days)
                  </p>
                </div>
                <div className={`p-2 rounded-lg ${weekReturn >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                  {weekReturn >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  )}
                </div>
              </div>
            </div>

            {/* 2-Day Return Card */}
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-xs font-medium">2-Day Return</p>
                  <p className={`text-xl font-bold ${dayReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {dayReturn >= 0 ? '+' : ''}{dayReturn.toFixed(2)}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {dayReturnDollar >= 0 ? '+' : ''}${dayReturnDollar.toLocaleString()} (48 hours)
                  </p>
                </div>
                <div className={`p-2 rounded-lg ${dayReturn >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                  {dayReturn >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  )}
                </div>
              </div>
            </div>

            {/* Win Rate Card */}
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-xs font-medium">Win Rate</p>
                  <p className={`text-xl font-bold ${winRate >= 50 ? 'text-green-600' : 'text-orange-600'}`}>
                    {winRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {profitableClosedTrades.length}/{closedTrades.length} profitable
                  </p>
                </div>
                <div className={`p-2 rounded-lg ${winRate >= 50 ? 'bg-green-100' : 'bg-orange-100'}`}>
                  <Target className={`w-5 h-5 ${winRate >= 50 ? 'text-green-600' : 'text-orange-600'}`} />
                </div>
              </div>
            </div>

            {/* Total Trades Card */}
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-xs font-medium">Total Trades</p>
                  <p className="text-xl font-bold text-gray-900">
                    {tradingLogs.length}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {tradingLogs.filter(log => log.action === 'BUY').length} buys, {tradingLogs.filter(log => log.action === 'SELL').length} sells
                  </p>
                </div>
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Activity className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Agent Distribution Pie Chart (70% width) */}
          <div className="lg:col-span-7 bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Agent Distribution</h3>
            {positions.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={positions.map(pos => ({
                      name: pos.symbol,
                      value: Math.abs(pos.market_value) // Use absolute value for pie chart
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {positions.map((pos, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={AGENT_COLORS[pos.symbol] || COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    position={centerTooltipPosition}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      color: '#111827'
                    }}
                    formatter={(value: number, name: string) => {
                      const pnl = agentPnLPercent[name] || 0;
                      return [`$${value.toLocaleString()} (${pnl >= 0 ? '+' : ''}${pnl.toFixed(1)}%)`, `Agent ${name}`];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                <div className="text-center">
                  <AlertCircle className="w-12 h-12 mx-auto mb-2" />
                  <p>No positions found</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Historical Trades Chart - Full Width */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Historical Trades (All Positions)</h3>
          <ResponsiveContainer width="100%" height={600}>
                <LineChart data={historicalTradesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis
                    dataKey="date"
                    stroke="#6B7280"
                    style={{ fontSize: '10px' }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                <YAxis
                  stroke="#6B7280"
                  scale="log"
                  domain={[1000, 50000]}
                  ticks={[1000, 2000, 5000, 10000, 20000, 50000]}
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                  style={{ fontSize: '12px' }}
                />
                <Tooltip
                  position={centerTooltipPosition}
                  content={<CustomHistoricalTooltip />}
                  wrapperStyle={{ pointerEvents: 'none' }}
                  allowEscapeViewBox={{ x: false, y: true }}
                  isAnimationActive={false}
                />
                {allTradedSymbols.map((symbol, index) => symbol && (
                  <Line
                    key={symbol}
                    type="monotone"
                    dataKey={symbol}
                    stroke={ALL_TRADED_COLORS[symbol] || COLORS[index % COLORS.length]}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name={symbol}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
            {/* Historical Trades Legend - All traded stocks */}
            <div className="mt-4 grid grid-cols-4 gap-x-3 gap-y-2">
              {allTradedSymbols.map((symbol, originalIndex) => {
                if (!symbol) return null;

                const isClosed = !positions.find(p => p.symbol === symbol);

                return (
                  <div key={symbol} className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: ALL_TRADED_COLORS[symbol] || COLORS[originalIndex % COLORS.length] }}
                      ></div>
                      <span className={`text-gray-700 font-medium ${isClosed ? 'opacity-60' : ''}`}>
                        {symbol} {isClosed && '(closed)'}
                      </span>
                    </div>
                    <span className={`font-bold ml-2 ${(historicalPnLPercent[symbol] || 0) >= 0 ? 'text-green-600' : 'text-red-600'} ${isClosed ? 'opacity-60' : ''}`}>
                      {(historicalPnLPercent[symbol] || 0) >= 0 ? '+' : ''}{(historicalPnLPercent[symbol] || 0).toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
        </div>

        {/* AI Performance vs S&P 500 */}
        {sp500Data.length > 0 && (
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">AI Performance vs. S&P 500</h3>
                <p className="text-xs text-gray-600 mt-1">Market hours comparison</p>
              </div>
              {sp500Data.length > 0 && (() => {
                const aiReturn = sp500Data[sp500Data.length - 1].portfolioReturn;
                const spyReturn = sp500Data[sp500Data.length - 1].spyReturn;
                const outperformance = aiReturn - spyReturn;

                return (
                  <div className="flex flex-col items-end space-y-1 text-xs">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <span className="text-gray-600">AI:</span>
                        <span className={`font-semibold ${aiReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {aiReturn >= 0 ? '+' : ''}{aiReturn.toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="text-gray-600">S&P 500:</span>
                        <span className={`font-semibold ${spyReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {spyReturn >= 0 ? '+' : ''}{spyReturn.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-gray-600">Outperformance:</span>
                      <span className={`font-semibold ${outperformance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {outperformance >= 0 ? '+' : ''}{outperformance.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
              <ResponsiveContainer width="100%" height={550}>
                <LineChart data={sp500Data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis
                    dataKey="date"
                    stroke="#6B7280"
                    style={{ fontSize: '10px' }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval={0}
                  />
                <YAxis
                  stroke="#6B7280"
                  tickFormatter={(value) => `${value.toFixed(1)}%`}
                  style={{ fontSize: '12px' }}
                />
                <Tooltip
                  position={centerTooltipPosition}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    color: '#111827'
                  }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;

                      // Find ALL trades at this point
                      const tradesAtPoint = tradingLogs.filter(log => {
                        if (!log.timestamp) return false;
                        const tradeTimestamp = new Date(log.timestamp as string).getTime();
                        const closestPoint = portfolioHistory.reduce((prev, curr) => {
                          const prevDiff = Math.abs(prev.timestamp - tradeTimestamp);
                          const currDiff = Math.abs(curr.timestamp - tradeTimestamp);
                          return currDiff < prevDiff ? curr : prev;
                        });
                        return closestPoint.date === data.date;
                      });

                      return (
                        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg" style={{ maxWidth: tradesAtPoint.length > 4 ? '1200px' : '300px' }}>
                          <p className="text-gray-600 text-xs mb-1">{data.date}</p>
                          <p className="text-purple-600 font-semibold text-sm">
                            AI: {data.portfolioReturn >= 0 ? '+' : ''}{data.portfolioReturn.toFixed(2)}%
                          </p>
                          <p className="text-cyan-600 font-semibold text-sm">
                            S&P 500: {data.spyReturn >= 0 ? '+' : ''}{data.spyReturn.toFixed(2)}%
                          </p>
                          {tradesAtPoint.length > 0 && (
                            <div className={`mt-2 pt-2 border-t border-gray-200 gap-3 ${tradesAtPoint.length > 4 ? 'grid grid-cols-4' : 'space-y-2'}`}>
                              {tradesAtPoint.map((trade, idx) => {
                                const positionBefore = trade.positionBefore as number | undefined;
                                const positionAfter = trade.positionAfter as number | undefined;

                                return (
                                  <div key={idx} className={trade.action === 'BUY' ? 'text-green-600' : 'text-red-600'}>
                                    <p className="font-bold text-sm">
                                      {trade.action} {trade.symbol}
                                    </p>
                                    {positionBefore !== undefined && positionAfter !== undefined && (
                                      <p className="text-xs text-gray-600 mb-1">
                                        Position: {positionBefore} → {positionAfter}
                                        {positionAfter === 0 && ' (CLOSED)'}
                                      </p>
                                    )}
                                    <p className="text-xs">
                                      {trade.quantity} shares @ ${(trade.price as number)?.toFixed(2)}
                                    </p>
                                    <p className="text-xs font-semibold">
                                      Total: ${(trade.total_value as number)?.toLocaleString()}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {tradingLogs.filter(log => log.timestamp).map((log) => {
                  const tradeTimestamp = new Date(log.timestamp as string).getTime();
                  const isBuy = log.action === 'BUY';

                  // Safety checks - need data points to match against
                  if (sp500Data.length === 0 || portfolioHistory.length === 0) return null;

                  // Find closest data point in portfolio history first
                  const closestPoint = portfolioHistory.reduce((prev, curr) => {
                    const prevDiff = Math.abs(prev.timestamp - tradeTimestamp);
                    const currDiff = Math.abs(curr.timestamp - tradeTimestamp);
                    return currDiff < prevDiff ? curr : prev;
                  });

                  // Find the corresponding sp500Data point by matching date
                  const sp500Point = sp500Data.find(h => h.date === closestPoint.date);
                  if (!sp500Point) return null;

                  return (
                    <ReferenceLine
                      key={log.id as string}
                      x={sp500Point.date}
                      stroke={isBuy ? '#10b981' : '#ef4444'}
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      label={{
                        value: isBuy ? '▲' : '▼',
                        position: 'top',
                        fill: isBuy ? '#10b981' : '#ef4444',
                        fontSize: 14,
                      }}
                    />
                  );
                })}
                <Line
                  type="monotone"
                  dataKey="portfolioReturn"
                  stroke="#8B5CF6"
                  strokeWidth={3}
                  dot={false}
                  name="AI Portfolio"
                />
                <Line
                  type="monotone"
                  dataKey="spyReturn"
                  stroke="#22D3EE"
                  strokeWidth={3}
                  dot={false}
                  name="S&P 500 Index"
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 flex items-center justify-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-0.5 bg-purple-500"></div>
                <span className="text-gray-700">AI Portfolio</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-0.5 bg-cyan-400"></div>
                <span className="text-gray-700">S&P 500 Index</span>
              </div>
            </div>
          </div>
        )}

        {/* AI Performance vs NASDAQ-100 */}
        {nasdaq100Data.length > 0 && (
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">AI Performance vs. NASDAQ-100</h3>
                <p className="text-xs text-gray-600 mt-1">Market hours comparison</p>
              </div>
              {nasdaq100Data.length > 0 && (() => {
                const aiReturn = nasdaq100Data[nasdaq100Data.length - 1].portfolioReturn;
                const qqqReturn = nasdaq100Data[nasdaq100Data.length - 1].qqqReturn;
                const outperformance = aiReturn - qqqReturn;

                return (
                  <div className="flex flex-col items-end space-y-1 text-xs">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <span className="text-gray-600">AI:</span>
                        <span className={`font-semibold ${aiReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {aiReturn >= 0 ? '+' : ''}{aiReturn.toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="text-gray-600">NASDAQ-100:</span>
                        <span className={`font-semibold ${qqqReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {qqqReturn >= 0 ? '+' : ''}{qqqReturn.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-gray-600">Outperformance:</span>
                      <span className={`font-semibold ${outperformance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {outperformance >= 0 ? '+' : ''}{outperformance.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
              <ResponsiveContainer width="100%" height={550}>
                <LineChart data={nasdaq100Data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis
                    dataKey="date"
                    stroke="#6B7280"
                    style={{ fontSize: '10px' }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval={0}
                  />
                <YAxis
                  stroke="#6B7280"
                  tickFormatter={(value) => `${value.toFixed(1)}%`}
                  style={{ fontSize: '12px' }}
                />
                <Tooltip
                  position={centerTooltipPosition}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    color: '#111827'
                  }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;

                      // Find ALL trades at this point
                      const tradesAtPoint = tradingLogs.filter(log => {
                        if (!log.timestamp) return false;
                        const tradeTimestamp = new Date(log.timestamp as string).getTime();
                        const closestPoint = portfolioHistory.reduce((prev, curr) => {
                          const prevDiff = Math.abs(prev.timestamp - tradeTimestamp);
                          const currDiff = Math.abs(curr.timestamp - tradeTimestamp);
                          return currDiff < prevDiff ? curr : prev;
                        });
                        return closestPoint.date === data.date;
                      });

                      return (
                        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg" style={{ maxWidth: tradesAtPoint.length > 4 ? '1200px' : '300px' }}>
                          <p className="text-gray-600 text-xs mb-1">{data.date}</p>
                          <p className="text-purple-600 font-semibold text-sm">
                            AI: {data.portfolioReturn >= 0 ? '+' : ''}{data.portfolioReturn.toFixed(2)}%
                          </p>
                          <p className="text-red-600 font-semibold text-sm">
                            NASDAQ-100: {data.qqqReturn >= 0 ? '+' : ''}{data.qqqReturn.toFixed(2)}%
                          </p>
                          {tradesAtPoint.length > 0 && (
                            <div className={`mt-2 pt-2 border-t border-gray-200 gap-3 ${tradesAtPoint.length > 4 ? 'grid grid-cols-4' : 'space-y-2'}`}>
                              {tradesAtPoint.map((trade, idx) => {
                                const positionBefore = trade.positionBefore as number | undefined;
                                const positionAfter = trade.positionAfter as number | undefined;

                                return (
                                  <div key={idx} className={trade.action === 'BUY' ? 'text-green-600' : 'text-red-600'}>
                                    <p className="font-bold text-sm">
                                      {trade.action} {trade.symbol}
                                    </p>
                                    {positionBefore !== undefined && positionAfter !== undefined && (
                                      <p className="text-xs text-gray-600 mb-1">
                                        Position: {positionBefore} → {positionAfter}
                                        {positionAfter === 0 && ' (CLOSED)'}
                                      </p>
                                    )}
                                    <p className="text-xs">
                                      {trade.quantity} shares @ ${(trade.price as number)?.toFixed(2)}
                                    </p>
                                    <p className="text-xs font-semibold">
                                      Total: ${(trade.total_value as number)?.toLocaleString()}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {tradingLogs.filter(log => log.timestamp).map((log) => {
                  const tradeTimestamp = new Date(log.timestamp as string).getTime();
                  const isBuy = log.action === 'BUY';

                  // Safety checks - need data points to match against
                  if (nasdaq100Data.length === 0 || portfolioHistory.length === 0) return null;

                  // Find closest data point in portfolio history first
                  const closestPoint = portfolioHistory.reduce((prev, curr) => {
                    const prevDiff = Math.abs(prev.timestamp - tradeTimestamp);
                    const currDiff = Math.abs(curr.timestamp - tradeTimestamp);
                    return currDiff < prevDiff ? curr : prev;
                  });

                  // Find the corresponding nasdaq100Data point by matching date
                  const nasdaq100Point = nasdaq100Data.find(h => h.date === closestPoint.date);
                  if (!nasdaq100Point) return null;

                  return (
                    <ReferenceLine
                      key={log.id as string}
                      x={nasdaq100Point.date}
                      stroke={isBuy ? '#10b981' : '#ef4444'}
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      label={{
                        value: isBuy ? '▲' : '▼',
                        position: 'top',
                        fill: isBuy ? '#10b981' : '#ef4444',
                        fontSize: 14,
                      }}
                    />
                  );
                })}
                <Line
                  type="monotone"
                  dataKey="portfolioReturn"
                  stroke="#8B5CF6"
                  strokeWidth={3}
                  dot={false}
                  name="AI Portfolio"
                />
                <Line
                  type="monotone"
                  dataKey="qqqReturn"
                  stroke="#EF4444"
                  strokeWidth={3}
                  dot={false}
                  name="NASDAQ-100 Index"
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 flex items-center justify-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-0.5 bg-purple-500"></div>
                <span className="text-gray-700">AI Portfolio</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-0.5 bg-red-500"></div>
                <span className="text-gray-700">NASDAQ-100 Index</span>
              </div>
            </div>
          </div>
        )}

        {/* Positions Table */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Positions</h3>
          {positions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-gray-900">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Stock</th>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Shares</th>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Avg Buy Price</th>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Current Price</th>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Value</th>
                    <th className="text-left py-3 px-4 text-gray-700 font-semibold">Profit/Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position) => {
                    const pnlPercent = ((position.current_price - position.avg_entry_price) / position.avg_entry_price) * 100;
                    const isProfit = position.unrealized_pl >= 0;

                    return (
                      <tr key={position.asset_id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: AGENT_COLORS[position.symbol] || '#8884d8' }}
                            ></div>
                            <div className="font-medium">{position.symbol}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4">{position.qty}</td>
                        <td className="py-3 px-4 text-gray-600">${position.avg_entry_price.toFixed(2)}</td>
                        <td className="py-3 px-4 font-medium">${position.current_price.toFixed(2)}</td>
                        <td className="py-3 px-4 font-medium">${position.market_value.toLocaleString()}</td>
                        <td className={`py-3 px-4 font-semibold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                          <div className="flex flex-col">
                            <span>{isProfit ? '+' : ''}${position.unrealized_pl.toFixed(2)}</span>
                            <span className="text-xs opacity-80">({isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%)</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-2" />
              <p>No positions found</p>
            </div>
          )}
        </div>
      </div>

      {/* Reasoning Modal */}
      {modalReasoning && (
        <div
          className="fixed inset-0 backdrop-blur-md bg-black/30 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setModalReasoning(null);
            // Also collapse the expanded state
            setExpandedLogIds(new Set());
          }}
        >
          <div
            className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{modalReasoning.ticker}</h3>
                <p className="text-sm text-gray-500">
                  {modalReasoning.timestamp && !isNaN(new Date(modalReasoning.timestamp).getTime()) ? (
                    <>
                      {new Date(modalReasoning.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                      {new Date(modalReasoning.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                    </>
                  ) : (
                    'Date unavailable'
                  )}
                </p>
              </div>
              <button
                onClick={() => {
                  setModalReasoning(null);
                  setExpandedLogIds(new Set());
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-gray-700 leading-relaxed">
              {modalReasoning.text}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
