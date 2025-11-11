# Persistent Cache V2 - Trade Data Reconstruction

## Purpose
This directory contains reconstructed historical trading data that fills gaps in the Alpaca API data.

## Data Sources
1. **Alpaca API** - Primary source for recent trades (Oct 10, 2025 onwards)
2. **User Trading Logs** - Manual logs with reasoning for all trades
3. **Alpha Vantage API** - Historical price data for reconstruction

## Known Issues
- Alpaca paper trading account missing data before Oct 10, 2025
- Oct 6 LRCX purchase (80 shares @ $141.91) not in Alpaca
- Date mismatches between user logs and Alpaca timestamps
- Nov 7-8 trades (NVDA, PRQR, QURE, LMND) not yet in Alpaca

## Files
- `alpaca_orders_fresh.json` - Latest Alpaca API fetch
- `user_logs_parsed.json` - Parsed user trading logs
- `reconstructed_trades.json` - Rebuilt historical trades
- `daily_portfolio_history.json` - Daily portfolio snapshots (2+ per day)
- `comparison_report.json` - Detailed mismatch analysis

## Status
🔄 IN PROGRESS - Reconstruction started Nov 8, 2025
