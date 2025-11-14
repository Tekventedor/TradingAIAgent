import { NextRequest, NextResponse } from 'next/server';

// Alpaca API configuration for tradingbot account
const ALPACA_CONFIG = {
  baseUrl: 'https://paper-api.alpaca.markets',
  apiKey: process.env.ALPACA_API_KEY,
  secretKey: process.env.ALPACA_SECRET_KEY,
};

const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds
const ALPACA_CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes for Alpaca data (more frequent updates)

// Simple in-memory cache for localhost (works without Vercel)
const memoryCache: Record<string, { data: any; timestamp: number }> = {};

// Helper function to make authenticated requests to Alpaca
async function alpacaRequest(endpoint: string) {
  if (!ALPACA_CONFIG.apiKey || !ALPACA_CONFIG.secretKey) {
    throw new Error('Alpaca API credentials not configured');
  }

  const response = await fetch(`${ALPACA_CONFIG.baseUrl}${endpoint}`, {
    headers: {
      'APCA-API-KEY-ID': ALPACA_CONFIG.apiKey,
      'APCA-API-SECRET-KEY': ALPACA_CONFIG.secretKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Alpaca API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Helper function to display cache summary
function logCacheSummary() {
  const now = Date.now();
  console.log('\n📊 ========== CACHE STATUS ==========');

  const cacheKeys = Object.keys(memoryCache);
  if (cacheKeys.length === 0) {
    console.log('❌ No cached data available');
  } else {
    cacheKeys.forEach(key => {
      const cached = memoryCache[key];
      const ageMs = now - cached.timestamp;
      const ageMinutes = Math.floor(ageMs / (1000 * 60));
      const ageHours = Math.floor(ageMs / (1000 * 60 * 60));

      let ageDisplay = '';
      if (ageHours > 0) {
        ageDisplay = `${ageHours}h ${ageMinutes % 60}m`;
      } else {
        ageDisplay = `${ageMinutes}m`;
      }

      const isExpired = ageMs > (key.includes('stock-bars') || key.includes('spy-bars') || key.includes('qqq-bars')
        ? CACHE_DURATION_MS
        : ALPACA_CACHE_DURATION_MS);

      const status = isExpired ? '⏰ EXPIRED' : '✅ VALID';

      console.log(`${status} | ${key.padEnd(40)} | Age: ${ageDisplay}`);
    });
  }
  console.log('====================================\n');
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint');

  console.log(`\n📥 API Request: ${endpoint}`);

  try {
    switch (endpoint) {
      case 'account': {
        // Get account information from tradingbot account
        const cacheKey = 'alpaca-account';
        const now = Date.now();

        // Check cache
        const cached = memoryCache[cacheKey];
        if (cached && (now - cached.timestamp) < ALPACA_CACHE_DURATION_MS) {
          const ageMinutes = Math.floor((now - cached.timestamp) / (1000 * 60));
          console.log(`📦 Account: Using cached data (${ageMinutes}m old)`);
          return NextResponse.json(cached.data);
        }

        // Fetch fresh data
        console.log(`🌐 Account: Fetching fresh data from Alpaca...`);
        const account = await alpacaRequest('/v2/account');

        const responseData = {
          portfolio_value: parseFloat(account.portfolio_value),
          cash: parseFloat(account.cash),
          buying_power: parseFloat(account.buying_power),
          equity: parseFloat(account.equity),
          account_number: account.account_number,
          status: account.status,
        };

        // Cache for 5 minutes
        memoryCache[cacheKey] = { data: responseData, timestamp: now };
        console.log(`✅ Account: Cached for 5 minutes (Portfolio: $${responseData.portfolio_value.toLocaleString()})`);

        return NextResponse.json(responseData);
      }
      
      case 'positions': {
        // Get current positions from tradingbot account
        const cacheKey = 'alpaca-positions';
        const now = Date.now();

        // Check cache
        const cached = memoryCache[cacheKey];
        if (cached && (now - cached.timestamp) < ALPACA_CACHE_DURATION_MS) {
          const ageMinutes = Math.floor((now - cached.timestamp) / (1000 * 60));
          console.log(`📦 Positions: Using cached data (${ageMinutes}m old, ${cached.data.length} positions)`);
          return NextResponse.json(cached.data);
        }

        // Fetch fresh data
        console.log(`🌐 Positions: Fetching fresh data from Alpaca...`);
        const positions = await alpacaRequest('/v2/positions');

        const responseData = positions.map((pos: Record<string, unknown>) => ({
          asset_id: pos.asset_id as string,
          symbol: pos.symbol as string,
          qty: parseFloat(pos.qty as string),
          side: pos.side as string,
          market_value: parseFloat(pos.market_value as string),
          cost_basis: parseFloat(pos.cost_basis as string),
          avg_entry_price: parseFloat(pos.avg_entry_price as string),
          unrealized_pl: parseFloat(pos.unrealized_pl as string),
          unrealized_plpc: parseFloat(pos.unrealized_plpc as string),
          current_price: parseFloat(pos.current_price as string),
        }));

        const positionSymbols = responseData.map((p: any) => p.symbol).join(', ');

        // Cache for 5 minutes
        memoryCache[cacheKey] = { data: responseData, timestamp: now };
        console.log(`✅ Positions: Cached for 5 minutes (${responseData.length} positions: ${positionSymbols})`);

        return NextResponse.json(responseData);
      }
      
      case 'portfolio-history': {
        // Get portfolio history from tradingbot account - hourly data for detailed chart
        const cacheKey = 'alpaca-portfolio-history';
        const now = Date.now();

        // Check cache
        const cached = memoryCache[cacheKey];
        if (cached && (now - cached.timestamp) < ALPACA_CACHE_DURATION_MS) {
          const ageMinutes = Math.floor((now - cached.timestamp) / (1000 * 60));
          console.log(`📦 Portfolio History: Using cached data (${ageMinutes}m old, ${cached.data.equity?.length || 0} points)`);
          return NextResponse.json(cached.data);
        }

        // Fetch fresh data with fallback logic (DO NOT merge with persistent cache - it has $0 values)
        console.log(`🌐 Portfolio History: Fetching fresh data from Alpaca...`);

        try {
          // Try 3M period first (good balance of history and data availability)
          console.log(`🔍 Attempting portfolio history: period=3M, timeframe=1H`);
          const history = await alpacaRequest('/v2/account/portfolio/history?period=3M&timeframe=1H');

          const responseData = {
            equity: history.equity,
            timestamp: history.timestamp,
          };

          // Log first and last data points for verification
          if (responseData.equity && responseData.equity.length > 0) {
            const firstDate = new Date(responseData.timestamp[0] * 1000).toISOString();
            const lastDate = new Date(responseData.timestamp[responseData.timestamp.length - 1] * 1000).toISOString();
            const firstValue = responseData.equity[0];
            const lastValue = responseData.equity[responseData.equity.length - 1];
            console.log(`📊 Portfolio History Data Range: ${firstDate} ($${firstValue}) → ${lastDate} ($${lastValue})`);
          }

          // Cache for 5 minutes
          memoryCache[cacheKey] = { data: responseData, timestamp: now };
          console.log(`✅ Portfolio History: Cached for 5 minutes (${responseData.equity?.length || 0} data points, 3M period)`);

          return NextResponse.json(responseData);
        } catch (error) {
          console.log(`⚠️ Portfolio History: 3M failed, trying 'all' period...`);

          try {
            // Try 'all' to get maximum available history
            const history = await alpacaRequest('/v2/account/portfolio/history?period=all&timeframe=1H');

            const responseData = {
              equity: history.equity,
              timestamp: history.timestamp,
            };

            // Log first and last data points for verification
            if (responseData.equity && responseData.equity.length > 0) {
              const firstDate = new Date(responseData.timestamp[0] * 1000).toISOString();
              const lastDate = new Date(responseData.timestamp[responseData.timestamp.length - 1] * 1000).toISOString();
              const firstValue = responseData.equity[0];
              const lastValue = responseData.equity[responseData.equity.length - 1];
              console.log(`📊 Portfolio History Data Range: ${firstDate} ($${firstValue}) → ${lastDate} ($${lastValue})`);
            }

            memoryCache[cacheKey] = { data: responseData, timestamp: now };
            console.log(`✅ Portfolio History: Cached for 5 minutes (${responseData.equity?.length || 0} points, ALL period)`);

            return NextResponse.json(responseData);
            } catch (allError) {
              console.log(`⚠️ Portfolio History: 'all' failed, trying 1M fallback...`);
              console.error('ALL Error:', allError instanceof Error ? allError.message : String(allError));

              try {
                // Fallback to 1M period
              const history = await alpacaRequest('/v2/account/portfolio/history?period=1M&timeframe=1H');

              const responseData = {
                equity: history.equity,
                timestamp: history.timestamp,
              };

              memoryCache[cacheKey] = { data: responseData, timestamp: now };
              console.log(`✅ Portfolio History: Cached for 5 minutes (${responseData.equity?.length || 0} points, 1M period)`);

              return NextResponse.json(responseData);
            } catch (fallbackError) {
              console.log(`⚠️ Portfolio History: 1M failed, trying 1D timeframe...`);
              console.error('1M Error details:', fallbackError instanceof Error ? fallbackError.message : String(fallbackError));

              try {
                // Try with daily timeframe instead of hourly (might have more historical data)
                const history = await alpacaRequest('/v2/account/portfolio/history?period=1M&timeframe=1D');

                const responseData = {
                  equity: history.equity,
                  timestamp: history.timestamp,
                };

                memoryCache[cacheKey] = { data: responseData, timestamp: now };
                console.log(`✅ Portfolio History: Cached for 5 minutes (${responseData.equity?.length || 0} points, 1M/1D)`);

                return NextResponse.json(responseData);
              } catch (dailyError) {
                console.log(`⚠️ Portfolio History: 1M/1D failed, trying 1W...`);

                try {
                  // Final fallback to 1W period
                  const history = await alpacaRequest('/v2/account/portfolio/history?period=1W&timeframe=1H');

                  const responseData = {
                    equity: history.equity,
                    timestamp: history.timestamp,
                  };

                  memoryCache[cacheKey] = { data: responseData, timestamp: now };
                  console.log(`✅ Portfolio History: Cached for 5 minutes (${responseData.equity?.length || 0} points, 1W period)`);

                  return NextResponse.json(responseData);
                } catch (finalError) {
                  console.log(`⚠️ Portfolio History: All Alpaca methods failed, reconstructing from orders...`);

                  try {
                    // Reconstruct portfolio history from orders
                    // Get orders to reconstruct timeline
                    const ordersResponse = await alpacaRequest('/v2/orders?status=filled&limit=500&direction=asc');

                    if (!ordersResponse || ordersResponse.length === 0) {
                      console.log(`❌ No filled orders found, returning empty data`);
                      const emptyData = { equity: [], timestamp: [] };
                      return NextResponse.json(emptyData);
                    }

                    // Get current account for cash balance
                    const account = await alpacaRequest('/v2/account');
                    const startingCash = 100000; // Assuming $100k starting capital

                    // Sort orders chronologically
                    const sortedOrders = ordersResponse.sort((a: any, b: any) =>
                      new Date(a.filled_at || a.submitted_at).getTime() - new Date(b.filled_at || b.submitted_at).getTime()
                    );

                    const firstOrderTime = new Date(sortedOrders[0].filled_at || sortedOrders[0].submitted_at);
                    const now = new Date();

                    // Create hourly data points from first trade to now
                    const dataPoints = [];
                    const currentTime = new Date(firstOrderTime);
                    currentTime.setMinutes(0, 0, 0); // Round to hour

                    let cash = startingCash;
                    const positions: Record<string, { quantity: number; avgPrice: number }> = {};

                    // Process each hour
                    while (currentTime <= now) {
                      const pointTimestamp = currentTime.getTime();

                      // Apply all trades that happened before or at this point
                      sortedOrders.forEach((order: any) => {
                        const orderTime = new Date(order.filled_at || order.submitted_at).getTime();
                        const previousPoint = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].timestamp : 0;

                        if (orderTime > previousPoint && orderTime <= pointTimestamp) {
                          const symbol = order.symbol;
                          const quantity = parseFloat(order.filled_qty || order.qty);
                          const price = parseFloat(order.filled_avg_price);

                          if (order.side === 'buy') {
                            cash -= quantity * price;
                            if (!positions[symbol]) {
                              positions[symbol] = { quantity: 0, avgPrice: 0 };
                            }
                            const totalQty = positions[symbol].quantity + quantity;
                            positions[symbol].avgPrice =
                              ((positions[symbol].avgPrice * positions[symbol].quantity) + (price * quantity)) / totalQty;
                            positions[symbol].quantity = totalQty;
                          } else {
                            cash += quantity * price;
                            if (positions[symbol]) {
                              positions[symbol].quantity -= quantity;
                              if (positions[symbol].quantity <= 0) {
                                delete positions[symbol];
                              }
                            }
                          }
                        }
                      });

                      // Calculate portfolio value (use average price as approximation)
                      let equityValue = cash;
                      Object.entries(positions).forEach(([symbol, pos]) => {
                        equityValue += pos.quantity * pos.avgPrice;
                      });

                      dataPoints.push({
                        timestamp: pointTimestamp,
                        equity: Math.round(equityValue * 100) / 100
                      });

                      // Move to next hour
                      currentTime.setHours(currentTime.getHours() + 1);
                    }

                    const responseData = {
                      equity: dataPoints.map(p => p.equity),
                      timestamp: dataPoints.map(p => Math.floor(p.timestamp / 1000))
                    };

                    memoryCache[cacheKey] = { data: responseData, timestamp: now };
                    console.log(`✅ Portfolio History: Reconstructed from orders (${responseData.equity.length} points)`);

                    return NextResponse.json(responseData);
                  } catch (reconstructError) {
                    console.error(`❌ Portfolio reconstruction failed:`, reconstructError);

                    // Return empty data so dashboard doesn't crash
                    const emptyData = { equity: [], timestamp: [] };
                    memoryCache[cacheKey] = { data: emptyData, timestamp: now };

                    return NextResponse.json(emptyData);
                  }
                }
              }
            }
          }
        }
      }

      case 'orders': {
        // Get recent orders from tradingbot account - increased limit to capture all October trades
        const cacheKey = 'alpaca-orders';
        const now = Date.now();

        // Check cache
        const cached = memoryCache[cacheKey];
        if (cached && (now - cached.timestamp) < ALPACA_CACHE_DURATION_MS) {
          const ageMinutes = Math.floor((now - cached.timestamp) / (1000 * 60));
          console.log(`📦 Orders: Using cached data (${ageMinutes}m old, ${cached.data.length} orders)`);
          return NextResponse.json(cached.data);
        }

        // Fetch fresh data - MAXIMUM limit to capture ALL historical trades
        console.log(`🌐 Orders: Fetching fresh data from Alpaca...`);
        const orders = await alpacaRequest('/v2/orders?status=all&limit=10000&direction=desc');

        // Apply user log date mappings to correct dates that don't match user's logs
        try {
          const fs = await import('fs');
          const path = await import('path');
          const mappingsPath = path.join(process.cwd(), 'persistent_cache_2', 'user_log_date_mappings.json');

          if (fs.existsSync(mappingsPath)) {
            const mappingsData = JSON.parse(fs.readFileSync(mappingsPath, 'utf-8'));
            const dateMappings = mappingsData.date_mappings;

            // Apply date corrections to matching orders
            orders.forEach((order: any) => {
              if (dateMappings[order.id]) {
                const mapping = dateMappings[order.id];
                // Replace submitted_at with user's log date
                order.submitted_at = mapping.user_log_date;
                // Keep filled_at as is from Alpaca
                console.log(`✅ Applied user log date for ${order.symbol} ${order.side}`);
              }
            });
          }
        } catch (error) {
          console.log(`⚠️ Could not load date mappings:`, error);
        }

        // Inject reconstructed Oct 6 LRCX trade from persistent_cache_2
        try {
          const fs = await import('fs');
          const path = await import('path');
          const reconstructedPath = path.join(process.cwd(), 'persistent_cache_2', 'reconstructed_oct6_trade.json');

          if (fs.existsSync(reconstructedPath)) {
            const reconstructedData = JSON.parse(fs.readFileSync(reconstructedPath, 'utf-8'));
            const reconstructedTrade = reconstructedData.reconstructed_trade;

            // Format as Alpaca order structure
            const reconstructedOrder = {
              id: reconstructedTrade.id,
              client_order_id: reconstructedTrade.id,
              created_at: reconstructedTrade.timestamp,
              updated_at: reconstructedTrade.timestamp,
              submitted_at: reconstructedTrade.timestamp,
              filled_at: reconstructedTrade.timestamp,
              expired_at: null,
              canceled_at: null,
              failed_at: null,
              replaced_at: null,
              replaced_by: null,
              replaces: null,
              asset_id: 'RECONSTRUCTED',
              symbol: reconstructedTrade.symbol,
              asset_class: 'us_equity',
              notional: null,
              qty: reconstructedTrade.qty.toString(),
              filled_qty: reconstructedTrade.qty.toString(),
              filled_avg_price: reconstructedTrade.price.toString(),
              order_class: '',
              order_type: 'market',
              type: 'market',
              side: reconstructedTrade.side,
              time_in_force: 'day',
              limit_price: null,
              stop_price: null,
              status: 'filled',
              extended_hours: false,
              legs: null,
              trail_percent: null,
              trail_price: null,
              hwm: null,
              subtag: null,
              source: null
            };

            // Add to orders array (it should appear at the end since it's the oldest)
            orders.push(reconstructedOrder);
            console.log(`✅ Added reconstructed Oct 6 LRCX trade to orders`);
          }
        } catch (error) {
          console.log(`⚠️ Could not load reconstructed trade:`, error);
        }

        // Cache for 5 minutes
        memoryCache[cacheKey] = { data: orders, timestamp: now };
        console.log(`✅ Orders: Cached for 5 minutes (${orders.length} orders)`);

        return NextResponse.json(orders);
      }

      case 'spy-bars': {
        // Get SPY historical bars from Alpha Vantage API with in-memory caching
        const start = searchParams.get('start');
        const end = searchParams.get('end');

        if (!start || !end) {
          return NextResponse.json({ error: 'Missing start or end date' }, { status: 400 });
        }

        // Create cache key from date range
        const cacheKey = `spy-bars:${start.split('T')[0]}:${end.split('T')[0]}`;
        console.log(`🔍 SPY Request: ${start.split('T')[0]} to ${end.split('T')[0]}`);

        try {
          // Check in-memory cache
          const cached = memoryCache[cacheKey];
          const now = Date.now();
          if (cached && (now - cached.timestamp) < CACHE_DURATION_MS) {
            const ageHours = Math.floor((now - cached.timestamp) / (1000 * 60 * 60));
            console.log(`📦 SPY: Using cached data (${ageHours}h old, ${cached.data.bars?.length || 0} bars)`);
            return NextResponse.json(cached.data);
          }

          // Fetch fresh data from Alpha Vantage API
          console.log('🌐 SPY: Fetching fresh data from Alpha Vantage API...');
          const alphaVantageUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=SPY&interval=60min&outputsize=full&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;

          const response = await fetch(alphaVantageUrl);

          if (!response.ok) {
            console.error('Alpha Vantage API error:', response.status, await response.text());
            return NextResponse.json({ bars: null }, { status: 200 });
          }

          const data = await response.json();

          // Alpha Vantage returns: { "Time Series (60min)": { "2024-10-10 15:00:00": { "4. close": "573.45", ... } } }
          const timeSeries = data['Time Series (60min)'];
          if (timeSeries && typeof timeSeries === 'object') {
            const bars = Object.entries(timeSeries)
              .map(([timestamp, values]: [string, any]) => ({
                t: new Date(timestamp).toISOString(),
                c: parseFloat(values['4. close']),
              }))
              .sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());

            const responseData = { bars };

            // Cache in memory for 1 week
            memoryCache[cacheKey] = { data: responseData, timestamp: now };
            console.log(`✅ SPY: Fresh data cached (${bars.length} bars, expires in 7 days)`);

            return NextResponse.json(responseData);
          }

          console.log('⚠️ SPY: Alpha Vantage returned no valid data');

          // Try loading fallback cache from persistent_cache_2
          try {
            const fs = await import('fs');
            const path = await import('path');
            const fallbackPath = path.join(process.cwd(), 'persistent_cache_2', 'spy_fallback.json');

            if (fs.existsSync(fallbackPath)) {
              const fallbackData = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
              console.log(`✅ SPY: Using fallback cache (${fallbackData.bars?.length || 0} bars)`);

              // Cache the fallback data in memory
              memoryCache[cacheKey] = { data: fallbackData, timestamp: now };

              return NextResponse.json(fallbackData);
            }
          } catch (fallbackError) {
            console.log('⚠️ SPY: Could not load fallback cache:', fallbackError);
          }

          return NextResponse.json({ bars: null });
        } catch (error) {
          console.error('❌ SPY: Fetch error:', error);

          // Try loading fallback cache on error
          try {
            const fs = await import('fs');
            const path = await import('path');
            const fallbackPath = path.join(process.cwd(), 'persistent_cache_2', 'spy_fallback.json');

            if (fs.existsSync(fallbackPath)) {
              const fallbackData = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
              console.log(`✅ SPY: Using fallback cache after error (${fallbackData.bars?.length || 0} bars)`);

              // Cache the fallback data in memory
              const now = Date.now();
              memoryCache[cacheKey] = { data: fallbackData, timestamp: now };

              return NextResponse.json(fallbackData);
            }
          } catch (fallbackError) {
            console.log('⚠️ SPY: Could not load fallback cache:', fallbackError);
          }

          return NextResponse.json({ bars: null }, { status: 200 });
        }
      }

      case 'qqq-bars': {
        // Get QQQ (NASDAQ-100) historical bars from Alpha Vantage API with in-memory caching
        const start = searchParams.get('start');
        const end = searchParams.get('end');

        if (!start || !end) {
          return NextResponse.json({ error: 'Missing start or end date' }, { status: 400 });
        }

        // Create cache key from date range
        const cacheKey = `qqq-bars:${start.split('T')[0]}:${end.split('T')[0]}`;
        console.log(`🔍 QQQ Request: ${start.split('T')[0]} to ${end.split('T')[0]}`);

        try {
          // Check in-memory cache
          const cached = memoryCache[cacheKey];
          const now = Date.now();
          if (cached && (now - cached.timestamp) < CACHE_DURATION_MS) {
            const ageHours = Math.floor((now - cached.timestamp) / (1000 * 60 * 60));
            console.log(`📦 QQQ: Using cached data (${ageHours}h old, ${cached.data.bars?.length || 0} bars)`);
            return NextResponse.json(cached.data);
          }

          // Fetch fresh data from Alpha Vantage API
          console.log('🌐 QQQ: Fetching fresh data from Alpha Vantage API...');
          const alphaVantageUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=QQQ&interval=60min&outputsize=full&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;

          const response = await fetch(alphaVantageUrl);

          if (!response.ok) {
            console.error('Alpha Vantage API error:', response.status, await response.text());
            return NextResponse.json({ bars: null }, { status: 200 });
          }

          const data = await response.json();

          // Alpha Vantage returns: { "Time Series (60min)": { "2024-10-10 15:00:00": { "4. close": "573.45", ... } } }
          const timeSeries = data['Time Series (60min)'];
          if (timeSeries && typeof timeSeries === 'object') {
            const bars = Object.entries(timeSeries)
              .map(([timestamp, values]: [string, any]) => ({
                t: new Date(timestamp).toISOString(),
                c: parseFloat(values['4. close']),
              }))
              .sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());

            const responseData = { bars };

            // Cache in memory for 1 week
            memoryCache[cacheKey] = { data: responseData, timestamp: now };
            console.log(`✅ QQQ: Fresh data cached (${bars.length} bars, expires in 7 days)`);

            return NextResponse.json(responseData);
          }

          console.log('⚠️ QQQ: Alpha Vantage returned no valid data');

          // Try loading fallback cache from persistent_cache_2
          try {
            const fs = await import('fs');
            const path = await import('path');
            const fallbackPath = path.join(process.cwd(), 'persistent_cache_2', 'qqq_fallback.json');

            if (fs.existsSync(fallbackPath)) {
              const fallbackData = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
              console.log(`✅ QQQ: Using fallback cache (${fallbackData.bars?.length || 0} bars)`);

              // Cache the fallback data in memory
              memoryCache[cacheKey] = { data: fallbackData, timestamp: now };

              return NextResponse.json(fallbackData);
            }
          } catch (fallbackError) {
            console.log('⚠️ QQQ: Could not load fallback cache:', fallbackError);
          }

          return NextResponse.json({ bars: null });
        } catch (error) {
          console.error('❌ QQQ: Fetch error:', error);

          // Try loading fallback cache on error
          try {
            const fs = await import('fs');
            const path = await import('path');
            const fallbackPath = path.join(process.cwd(), 'persistent_cache_2', 'qqq_fallback.json');

            if (fs.existsSync(fallbackPath)) {
              const fallbackData = JSON.parse(fs.readFileSync(fallbackPath, 'utf-8'));
              console.log(`✅ QQQ: Using fallback cache after error (${fallbackData.bars?.length || 0} bars)`);

              // Cache the fallback data in memory
              const now = Date.now();
              memoryCache[cacheKey] = { data: fallbackData, timestamp: now };

              return NextResponse.json(fallbackData);
            }
          } catch (fallbackError) {
            console.log('⚠️ QQQ: Could not load fallback cache:', fallbackError);
          }

          return NextResponse.json({ bars: null }, { status: 200 });
        }
      }

      case 'stock-bars': {
        // Get any stock's historical bars from Alpha Vantage API with in-memory caching
        const symbol = searchParams.get('symbol');
        const start = searchParams.get('start');
        const end = searchParams.get('end');

        if (!symbol || !start || !end) {
          return NextResponse.json({ error: 'Missing symbol, start, or end date' }, { status: 400 });
        }

        // Create cache key from symbol and date range
        const cacheKey = `stock-bars:${symbol}:${start.split('T')[0]}:${end.split('T')[0]}`;
        console.log(`🔍 ${symbol} Request: ${start.split('T')[0]} to ${end.split('T')[0]}`);

        try {
          // Check in-memory cache
          const cached = memoryCache[cacheKey];
          const now = Date.now();
          if (cached && (now - cached.timestamp) < CACHE_DURATION_MS) {
            const ageHours = Math.floor((now - cached.timestamp) / (1000 * 60 * 60));
            console.log(`📦 ${symbol}: Using cached data (${ageHours}h old, ${cached.data.bars?.length || 0} bars)`);
            return NextResponse.json(cached.data);
          }

          // Fetch fresh data from Alpha Vantage API
          console.log(`🌐 ${symbol}: Fetching fresh data from Alpha Vantage API...`);
          const alphaVantageUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=60min&outputsize=full&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;

          const response = await fetch(alphaVantageUrl);

          if (!response.ok) {
            console.error(`Alpha Vantage API error for ${symbol}:`, response.status, await response.text());
            return NextResponse.json({ bars: null }, { status: 200 });
          }

          const data = await response.json();

          // Alpha Vantage returns: { "Time Series (60min)": { "2024-10-10 15:00:00": { "4. close": "573.45", ... } } }
          const timeSeries = data['Time Series (60min)'];
          if (timeSeries && typeof timeSeries === 'object') {
            const bars = Object.entries(timeSeries)
              .map(([timestamp, values]: [string, any]) => ({
                t: new Date(timestamp).toISOString(),
                c: parseFloat(values['4. close']),
              }))
              .sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());

            const responseData = { bars };

            // Cache in memory for 1 week
            memoryCache[cacheKey] = { data: responseData, timestamp: now };
            console.log(`✅ ${symbol}: Fresh data cached (${bars.length} bars, expires in 7 days)`);

            return NextResponse.json(responseData);
          }

          console.log(`⚠️ ${symbol}: Alpha Vantage returned no valid data`);
          return NextResponse.json({ bars: null });
        } catch (error) {
          console.error(`❌ ${symbol}: Fetch error:`, error);
          return NextResponse.json({ bars: null }, { status: 200 });
        }
      }

      case 'cache-status':
        // Special endpoint to view cache status
        logCacheSummary();
        return NextResponse.json({
          message: 'Cache status logged to console',
          cacheCount: Object.keys(memoryCache).length
        });

      default:
        return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ Alpaca API Error:', error);
    logCacheSummary(); // Show cache status on error
    return NextResponse.json({
      error: 'Failed to fetch data from Alpaca API',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
