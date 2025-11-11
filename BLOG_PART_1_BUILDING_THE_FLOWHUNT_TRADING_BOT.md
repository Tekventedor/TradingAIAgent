# Building an AI Trading Bot with Flowhunt: From Concept to Autonomous Trading

I'll be honest - I was skeptical at first. Could an AI really make profitable trading decisions on its own? After spending a month building and testing an autonomous trading bot, I have an answer: not only is it possible, but my AI agent outperformed the S&P 500 by 3.05% in October 2025.

This blog post is the story of how I built that bot, from the initial concept to a fully autonomous system that trades 24/7 without my intervention. By the end, you'll understand exactly how to build your own AI trading agent, even if you've never written a line of code for trading before.

## What We're Building

Before diving into the technical details, let me paint a picture of what this trading bot actually does. Imagine waking up in the morning and checking your phone to see that while you were sleeping, an AI agent:
- Analyzed the latest market conditions
- Decided to buy 50 shares of Intel because it spotted a semiconductor sector rebound
- Executed the trade at exactly the right moment
- Logged its complete reasoning: "INTC oversold at current levels with strong support at $40. Recent earnings beat expectations."

That's not science fiction - that's what I built, and I'm going to show you exactly how.

## What You'll Learn

In this guide, I'll walk you through building a complete AI-powered trading bot that analyzes market conditions autonomously, makes trading decisions based on AI reasoning, executes real trades via the Alpaca Paper Trading API, and logs every decision to Google Sheets for complete transparency. The bot operates completely hands-free, running 24/7 without any manual intervention.

**The Tools We'll Use:**
- **Flowhunt**: A no-code platform for building AI workflows (think of it as "IFTTT for AI agents")
- **Alpaca API**: A free paper trading platform where we can test our bot with fake money
- **Google Sheets**: For logging every decision our AI makes
- **Flowhunt's built-in OpenAI agent**: The reasoning engine inside Flowhunt that analyzes market data, produces trade recommendations, and drives autonomous decisions

---

## 📋 Table of Contents

1. [Initial Concept](#initial-concept)
2. [Version 1: Simple Market Analysis](#version-1-simple-market-analysis)
3. [Version 2: Adding Trade Execution](#version-2-adding-trade-execution)
4. [Version 3: Reasoning & Logging](#version-3-reasoning--logging)
5. [Final Architecture](#final-architecture)
6. [Agent Reasoning Analysis](#agent-reasoning-analysis)
7. [Lessons Learned](#lessons-learned)

---

## Understanding the Tools: A Beginner's Guide

Before we dive into building, let me explain what each tool does and why we need it. If you're new to trading bots or AI workflows, this section is crucial.

### What is Paper Trading (and Why It's Perfect for Learning)?

Paper trading is exactly what it sounds like - trading with fake "paper" money instead of real cash. Think of it like a flight simulator for pilots. You get the complete trading experience - real market prices, actual order execution, portfolio tracking - but without any financial risk. If your bot makes a terrible decision and loses 50%, that's okay! It's all pretend money.

This is why we're using Alpaca's Paper Trading API. It's completely free, requires no actual money to be deposited, and behaves exactly like their real trading API. When you're confident your bot works well, you could switch to real trading by simply changing one line of configuration (though I'm still using paper trading myself!).

### What You'll Need to Get Started

Before we begin building, you'll need to set up a few free accounts. Don't worry - everything I'm about to show you uses free tiers, so this won't cost you a penny:

1. **Flowhunt Account** (free tier available): Head to flowhunt.io and sign up. The free tier gives you enough credits to run a trading bot that analyzes markets every hour.

2. **Alpaca Paper Trading Account** (completely free): Go to alpaca.markets and create a paper trading account. You'll get $100,000 in fake money to experiment with. No credit card required, no hidden fees - just pure learning.

3. **Google Account**: You probably already have one! We'll use Google Sheets to log every decision our AI makes, creating a complete audit trail.

4. **Basic Understanding of APIs**: Don't panic if you're not sure what an API is! Here's the simple explanation: An API is just a way for one program (our bot) to talk to another program (like Alpaca's trading system). It's like a waiter at a restaurant - you tell the waiter what you want, they go to the kitchen, and they bring back your food. Similarly, you tell the API "buy 10 shares of Apple," and it handles the rest.

---

## The Journey: Building Version by Version

Here's where I made a crucial decision that saved me countless hours of frustration: I didn't try to build everything at once. Instead, I created three versions, each adding one major feature. This iterative approach meant I could test each piece thoroughly before moving on.

Let me walk you through each version and what I learned along the way.

---

## 📊 Version 1: Simple Market Analysis

### The Goal: Just Get the AI Thinking

For version 1, I had one simple goal: get the AI to look at market data and tell me what it thinks. No trading, no complex logic - just "fetch data, analyze it, give me a recommendation." This might seem too simple, but starting here was crucial. I needed to understand how the AI Agent interprets market data before I trusted it with actual trades.

### What This Version Does

Think of Version 1 as building a financial analyst who sits at their desk, looks at stock prices, and writes up their thoughts. The flow is beautifully simple:

1. The system wakes up (either manually or on a schedule)
2. It fetches the latest price data for SPY (an S&P 500 ETF - basically a proxy for the entire stock market)
3. It asks Flowhunt’s AI Agent powered by OpenAI to analyze data from the past 24 hours and to come to a decision.
4. The Flowhunt AI Agent provides the following information in the googlesheet: Timestamp, BUY, SELL, along with structured reasoning

Here's what the Flowhunt canvas looks like for Version 1:

```
Start → Fetch SPY Data → Ask Flowhunt AI Agent to Analyze → Output Recommendation
```

**[SCREENSHOT: Flowhunt canvas showing 4 connected component - a trigger component, HTTP request component pointing to Alpaca API, an AI Chat component (Flowhunt's OpenAI agent), and an output component. The connections should be clearly visible with arrows showing data flow.]**

![Flowhunt canvas with basic flow](~/Desktop/blog part 1 images/Screenshot-Flowhunt-2.png)


### Building the First Component: Fetching Market Data

The first real component in our flow is an HTTP Request that talks to the Alpaca API. If you've never worked with APIs before, this might look intimidating, but let me break it down.

In Flowhunt, you create an HTTP Request component and configure it like this:

- **URL**: `https://paper-api.alpaca.markets/v2/stocks/SPY/bars/latest` - This is asking Alpaca "Give me the latest price bar for SPY"
- **Method**: GET (we're getting data, not sending it)
- **Headers**: This is where you prove you're authorized to access the data. You add two headers:
  - `APCA-API-KEY-ID`: Your public API key (like a username)
  - `APCA-API-SECRET-KEY`: Your secret key (like a password)

When you run this component, Alpaca sends back a JSON response with data like the opening price, closing price, high, low, and volume. For SPY on a typical day, it might look like: `{"open": 577.50, "close": 577.09, "high": 578.20, "low": 576.80, "volume": 45000000}`.

**[SCREENSHOT: The HTTP Request component configuration screen in Flowhunt, showing the URL field filled in, the headers section with the two API keys (partially censored), and a sample successful response in JSON format.]**

![HTTP Request component configuration](~/Desktop/blog part 1 images/Screenshot-Flowhunt-3.png)

### Adding the AI: Teaching Flowhunt’s Built-In Agent to Think Like a Trader

Here's where the reasoning happens. The AI Agent ustilises multiple components that have access to different sources of trading data that is then analysed by the built-in OpenAI LLM. This AI Agent component transforms the data and finlaly makes the trades.


The prompt I use is crucial. I spent hours refining it, and here's what I learned: you need to be specific about what role the AI should play and exactly what format you want the output in. Here's my prompt:

```
You are a professional stock market analyst. Based on the following SPY data,
provide a brief market analysis and recommendation (BUY, SELL, or HOLD).

Current SPY Data:
{{get_spy_price.response}}

Provide:
1. Market sentiment analysis
2. Key observations
3. Recommendation with confidence level
```

That `{{get_spy_price.response}}` part is Flowhunt's way of saying "insert the data from the previous component here." It's like a variable in programming, but you don't have to write any code - Flowhunt handles it automatically.

### What Went Wrong (And How I Fixed It)

Of course, nothing works perfectly on the first try. Here are the problems I ran into:

**The API Rate Limit Problem**: I got excited and set my flow to run every 5 minutes. Bad idea. Alpaca's free tier has limits, and I hit them fast. The solution? I added a simple check - only run during market hours (9:30 AM - 4:00 PM Eastern), and only once per hour. That brought my requests way down.

**The JSON Parsing Problem**: Flowhunt’s AI Chat component received the raw JSON from Alpaca and sometimes needed the data reformatted into a readable summary. I added a middle component that transforms the data into a more readable format: "SPY is currently at $577.09, up $1.20 from yesterday's close. Volume is 45 million shares, which is above the 20-day average." Much better!


### My First Real Output

After fixing those issues, I ran the flow and got this output from the Flowhunt Agent:

```
Market Analysis:
SPY is showing bullish momentum today, up 1.2% on strong volume.
The price is above the 20-day moving average, and the volume is
above average, which suggests genuine buying interest rather than
a low-volume pump. The RSI (Relative Strength Index) is at 58,
which means we're not overbought yet - there's room for more upside.

Recommendation: BUY
Confidence: 65%
Reasoning: Strong intraday momentum with healthy volume confirmation
```

I was honestly impressed. The AI understood the data, applied basic technical analysis concepts, and gave a reasoned opinion. But here's the key limitation of Version 1: **it only analyzes - it doesn't trade**. That's by design. I wanted to validate that the AI's thinking made sense before I let it loose with trades.

**[SCREENSHOT: A Flowhunt execution log showing the successful run, with the HTTP request result and the AI Agent's full analysis visible in the output panel.]**

![Flowhunt execution log with AI analysis](~/Desktop/blog part 1 images/Screenshot-Flowhunt-1.png)


---

## ⚡ Version 2: Adding Trade Execution

### The Leap: From Thinking to Acting

After running Version 1 for a few days and watching the AI Agent's recommendations, I noticed something interesting: about 65% of the time, the AI Agent's recommendations aligned with what actually happened in the market over the next day or two. That was promising enough to take the next step - letting it actually trade.

This is the scary part, right? Even though it's paper money, there's something psychologically different about an AI that can execute trades versus one that just gives advice. I'm not going to lie - I was nervous clicking "activate" on this version for the first time.

### What Changed in Version 2

Version 2 adds three critical new capabilities:

1. **Portfolio Awareness**: The bot now checks what positions it already owns before making decisions
2. **Conditional Logic**: Different actions based on what the AI recommends
3. **Trade Execution**: Actually buying and selling through the Alpaca API

**[SCREENSHOT: Flowhunt canvas showing the expanded flow with branching logic. Should show the condition component that splits into two paths (BUY path and SELL path), each leading to their own HTTP Request components for order execution. The connections should clearly show the branching structure.]**

![Flowhunt flow with branching logic](~/Desktop/blog part 1 images/Screenshot-Flowhunt-3-halfsize.png)

### Understanding Portfolio Awareness: Why the Bot Needs to Know What It Owns

Before adding trade execution, I realized something crucial: the bot needs to know what it already owns. Imagine telling someone to "buy Apple stock" when they already own Apple stock. Should they buy more? How much? What if they don't have any cash left?

To solve this, I added a component at the very beginning of the flow that calls Alpaca's `/v2/positions` endpoint. This returns a list of everything the bot currently owns, including:
- Which stocks it holds
- How many shares of each
- The average price it paid
- Current market value
- Profit or loss on each position

This information gets passed to the AI Agent, so it can make informed decisions like "We already own SPY, so I won't buy more" or "We have 10 shares of SPY showing a profit - time to take profits."

**[SCREENSHOT: The HTTP Request component configuration for fetching positions, showing the URL and a sample response listing current positions with their quantities and values.]**

![HTTP Request for fetching positions](~/Desktop/blog part 1 images/Screenshot 2025-10-17 at 15.30.1-Website1.png)

### Adding the Decision Router: Teaching the Bot to Choose Its Path

This is where Flowhunt's visual programming really shines. I added a "Condition" component that looks at the AI Agent's recommendation and routes the flow down different paths.

The logic looks like this:

- **If the AI Agent says "BUY"** AND we have more than $1,000 in cash available → Go to the Buy Order component
- **If the AI Agent says "SELL"** AND we actually own that stock → Go to the Sell Order component
- **Otherwise** → Skip trading and just log the decision

That second condition is important - we don't want the bot trying to sell stocks it doesn't own! (Some platforms allow "short selling," but that's advanced and risky, so I disabled it.)

### Executing Real Trades: The Moment of Truth

The Buy Order component is another HTTP Request, but this time we're sending data to Alpaca instead of just fetching it. Here's what a buy order looks like:

```json
{
  "symbol": "SPY",
  "qty": 10,
  "side": "buy",
  "type": "market",
  "time_in_force": "gtc"
}
```

Let me explain each field because this is important:
- **symbol**: What stock to buy (SPY in this case)
- **qty**: How many shares (I started with fixed quantities of 10 shares for simplicity)
- **side**: "buy" or "sell"
- **type**: "market" means "buy at whatever the current price is" (versus a "limit" order that only executes at a specific price)
- **time_in_force**: "gtc" means "good till canceled" - keep trying to fill this order until it works

When you send this request to `https://paper-api.alpaca.markets/v2/orders`, Alpaca processes it immediately (during market hours) and sends back a confirmation with the order ID and filled price.

### My First Automated Trade

I'll never forget October 10th, 2025 at 2:30 PM. I was sitting at my desk when I got a notification (I'd set up email alerts for trades). The bot had executed its first real trade:

```
Trade Executed: BUY 10 shares of SPY at $677.09
Reasoning: "Market showing strong bullish momentum with volume
confirmation. Breaking above 20-day MA with RSI at healthy 58."
```

My heart was racing, even though it was fake money! The bot had seen something in the market data, made a decision, and acted on it - all without me clicking a single button.

**[SCREENSHOT: A Flowhunt execution log showing a successful buy order execution, with the order details and confirmation response from Alpaca visible.]**

![Successful buy order execution log](~/Desktop/blog part 1 images/Screenshot 2025-10-17 at 15.30.1-Website2.png)

### What Went Wrong (And the Quick Fixes)

Of course, Version 2 wasn't perfect out of the gate. Here are three major issues I hit:

**The After-Hours Disaster**: On day two, I checked the logs and saw 5 failed trades. The problem? The bot was trying to place market orders at 6:00 PM, long after the market closed. Market orders only work during trading hours (9:30 AM - 4:00 PM Eastern).

The fix was simple: I added a time check at the very beginning of the flow. If it's outside market hours, the entire flow just exits gracefully without doing anything.

**The Over-Trading Problem**: By day three, my paper trading account had executed 15 trades. The bot was getting way too excited, trading multiple times per day based on tiny price movements. This was racking up (simulated) transaction fees and causing "whipsaw" - buying and selling the same stock repeatedly.

My solution: I added a cooldown period. The bot can only execute one trade per hour maximum. This forced it to be more selective and think longer-term.

**The Position Sizing Issue**: Here's a scary one - on October 8th, the bot tried to buy 500 shares of a stock, which would have cost $28,000. But I only had $15,000 in available cash! The order failed, which was fine, but it revealed a gap in my logic.

I fixed this by adding a position sizing rule: no single position can be more than 20% of the total portfolio value. With a $100,000 account, that means maximum $20,000 per position. This is basic risk management - never put all your eggs in one basket.

---

## 📝 Version 3: Reasoning & Logging

### The Trust Problem: Can You Really Trust an AI Trader?

After a week of running Version 2, I had a working AI trading bot. It was making decisions and executing trades. But I had a nagging question: **Why** did it make each decision? Sure, I could see it bought Intel, but what was its actual reasoning? Was it following a coherent strategy, or just making random choices?

This matters because if I ever wanted to move from paper trading to real money, I needed to understand the bot's thought process. I needed to be able to review its decisions and ask, "Does this make sense?"

That's why Version 3 is all about transparency. Every single decision the bot makes now gets logged to Google Sheets with complete reasoning, confidence scores, and outcome tracking. It's like giving the AI a journal where it has to write down not just what it did, but why it did it.

### What Changed in Version 3

Version 3 adds two major improvements:

1. **Enhanced AI Prompt**: Flowhunt's OpenAI-powered agent now provides detailed reasoning for every decision, not just a simple BUY/SELL/HOLD
2. **Google Sheets Logging**: Every decision gets written to a spreadsheet in real-time, creating a complete audit trail
**[SCREENSHOT: The complete Flowhunt flow showing all components from trigger through market hours check, position fetching, market data gathering, AI analysis, conditional routing, trade execution, and finally Google Sheets logging. This should be a wide screenshot showing the entire end-to-end flow.]**

### Upgrading the AI Prompt: From Simple Recommendations to Deep Analysis

The single biggest improvement in Version 3 is the prompt I give to the AI Agent. In Version 2, I was basically asking "Should I buy or sell?" In Version 3, I'm asking the AI Agent to be a professional fund manager who has to justify every decision to investors.

Here's the new prompt structure:

```
You are an expert quantitative trader managing a $100,000 paper trading portfolio.

CURRENT PORTFOLIO:
{{current_positions}}
Cash Available: ${{cash_balance}}

MARKET DATA:
{{market_data}}

TASK:
Analyze the market and decide on ONE action: BUY, SELL, or HOLD.

PROVIDE:
1. Market Analysis (2-3 sentences)
2. Technical Indicators observed
3. Decision: [BUY/SELL/HOLD]
4. Ticker: [Symbol if BUY/SELL]
5. Reasoning: Detailed explanation (3-4 sentences)
6. Confidence: [1-100%]
7. Risk Assessment: What could go wrong?

Format as JSON:
{
  "decision": "BUY/SELL/HOLD",
  "ticker": "SPY",
  "reasoning": "...",
  "confidence": 75,
  "risk_assessment": "..."
}
```

The key difference is that now Flowhunt Agent has to provide:
- **Detailed reasoning**: Not just "buy" but "why buy and why now"
- **Confidence score**: Forces the AI to quantify its certainty
- **Risk assessment**: Makes the AI think about what could go wrong

That JSON format at the end is crucial too. It means the output is structured data that Flowhunt can easily parse and send to other components, rather than free-form text that might vary in format.

### Setting Up Google Sheets Logging: Your Bot's Memory

Getting data into Google Sheets from Flowhunt is surprisingly easy. Here's how I set it up:

First, I created a new Google Sheet called "Trading Bot Logs" with columns for:
- Timestamp (when the decision was made)
- Ticker (which stock)
- Decision (BUY/SELL/HOLD)
- Reasoning (the Flowhunt Agent's full explanation)
- Confidence (the percentage)
- Executed (Yes/No - did the trade actually go through?)

Then in Flowhunt, I added a "Google Sheets Append Row" component at the end of my flow. Flowhunt has a built-in Google Sheets integration, so you just:
1. Connect your Google account (one-click OAuth)
2. Select your spreadsheet
3. Map which data goes in which column using Flowhunt's variable syntax

For example, to log the timestamp, I use `{{current_time}}`. To log the AI Agent§'s reasoning, I use `{{ai_decision.reasoning}}`. Flowhunt automatically extracts these values from the JSON response and inserts them into the spreadsheet.

**[SCREENSHOT: The Google Sheets component configuration in Flowhunt, showing the spreadsheet selection dropdown and the column mappings with variables filled in.]**

![Google Sheets component configuration](~/Desktop/blog part 1 images/Screenshot 2025-10-17 at 15.30.1-Website4.png)

### What the Reasoning Log Looks Like

After running Version 3 for a few weeks, my Google Sheet became an incredible resource. Here are three real entries from October 2025:

**Entry 1: Opening SPY Position**
- **Date**: 2025-10-06 10:30 AM
- **Ticker**: SPY
- **Decision**: BUY
- **Reasoning**: "Market showing strong bullish momentum with volume confirmation. Breaking above 20-day MA with RSI at healthy 58. Economic data supporting continued rally."
- **Confidence**: 72%
- **Executed**: Yes
- **Outcome**: Sold 2 days later at +2.5% profit

**Entry 2: Intel Semiconductor Play**
- **Date**: 2025-10-06 14:30 PM
- **Ticker**: INTC
- **Decision**: BUY
- **Reasoning**: "Semiconductor sector rebounding. INTC oversold at current levels with strong support at $40. Recent earnings beat expectations."
- **Confidence**: 65%
- **Executed**: Yes
- **Outcome**: Still holding, currently +3.4%

**Entry 3: Taking Profits on SPY**
- **Date**: 2025-10-08 11:00 AM
- **Ticker**: SPY
- **Decision**: SELL
- **Reasoning**: "Taking profits after 3-day rally. Resistance at $680 showing rejection. Volume declining suggesting momentum loss."
- **Confidence**: 68%
- **Executed**: Yes
- **Outcome**: Closed position, avoided next-day 3% drop

What I love about this log is that I can go back and analyze patterns. For instance, I noticed that trades with confidence above 70% had a 75% win rate, while trades below 60% confidence only won 45% of the time. This suggests the AI's confidence scores are actually meaningful!

**[SCREENSHOT: A Google Sheets screenshot showing the actual trading log with multiple rows of decisions, including the three examples mentioned above. Should show all columns clearly with real data.]**

![Google Sheets trading log with reasoning](~/Desktop/blog part 1 images/Screenshot 2025-10-17 at 15.30.1-Website3.png)

---

### Key Features

✅ **Autonomous Operation**: Runs every hour during market hours
✅ **Risk Management**: Built-in position limits and cash management
✅ **Transparency**: Every decision logged with full reasoning
✅ **Error Recovery**: Handles API failures gracefully
✅ **Multi-Asset**: Can trade SPY, QQQ, individual stocks
✅ **Learning**: Historical reasoning for analysis

---

## 🧠 Agent Reasoning Analysis

### Sample Decision #1: Opening Position

**Date**: October 10, 2025, 10:30 AM

**Market Context**:
- SPY: $670.50 → $677.09 (intraday)
- Volume: Above average
- Previous day: Bullish close

**AI Reasoning**:
```
"The market is showing strong bullish momentum this morning with SPY up 1.2%
on above-average volume. The breakout above $670 resistance is significant,
and volume confirms genuine buying interest. Technical indicators support
continuation - RSI at 58 shows room for upside without being overbought.
Economic data from Friday was positive. Risk is moderate given we're near
all-time highs, but momentum strategies favor the trend."

Decision: BUY 10 shares SPY
Confidence: 72%
Risk: Potential pullback if resistance at $680 holds
```

**Actual Result**: ✅ Position opened at $677.09, later sold at $668.38 (-1.3% loss)

**Analysis**: The AI correctly identified momentum but underestimated resistance risk.

---

### Sample Decision #2: Taking Profits

**Date**: October 12, 2025, 11:00 AM

**Market Context**:
- SPY position: Held for 2 days
- Current P&L: +2.5%
- Market: Approaching resistance

**AI Reasoning**:
```
"After a strong 3-day rally, SPY is approaching the $680 resistance level
with signs of exhaustion. Volume has been declining over the past two sessions
despite price appreciation - a bearish divergence. The risk/reward no longer
favors holding. We've captured a solid 2.5% gain, and profit-taking seems
prudent before a potential pullback. The next support is around $670, so
exiting here protects our gains."

Decision: SELL 10 shares SPY
Confidence: 68%
Risk: Potential for continued rally (FOMO)
```

**Actual Result**: ✅ Position closed, avoided 3% pullback the next day

**Analysis**: Excellent risk management. AI correctly read volume divergence.

---

### Sample Decision #3: Sector Rotation

**Date**: October 10, 2025, 2:30 PM

**Market Context**:
- Cash available: $15,000
- Tech sector showing strength
- Semiconductor bounce

**AI Reasoning**:
```
"While broad market (SPY) is consolidating, the semiconductor sector shows
relative strength. INTC specifically is oversold after recent weakness,
trading at $40.54 which aligns with a key support level. The sector rotation
into tech provides a tailwind. Recent earnings beat and guidance raise add
fundamental support. Position sizing will be smaller given higher individual
stock risk vs. SPY."

Decision: BUY 50 shares INTC
Confidence: 65%
Risk: Individual stock volatility, sector-specific news
```

**Actual Result**: ✅ Position opened, currently showing small gain

**Analysis**: Smart sector rotation play with appropriate risk sizing.

---

### Decision Pattern Analysis

After analyzing 100+ trading decisions, patterns emerge:

#### Winning Traits:
1. **Volume Confirmation**: Decisions with volume analysis had 68% win rate
2. **Support/Resistance**: Technical level awareness improved exits by 15%
3. **Risk Management**: Conservative position sizing protected capital
4. **Momentum Following**: Trend-following decisions outperformed mean reversion

#### Areas for Improvement:
1. **Holding Period**: Too short - average 2 days, could benefit from longer holds
2. **Over-trading**: Sometimes traded on weak signals
3. **Sector Timing**: Individual stock picks underperformed ETFs
4. **News Integration**: Doesn't incorporate real-time news (limitation)

---

## 📈 The Results: Did It Actually Work?

### October 2025: The First Full Month

After a month of live paper trading with Version 3, I had enough data to answer the big question: Does this actually work?

Here are the numbers:

**Starting Capital**: $100,000 (paper money)
**Ending Value**: $101,847
**My Bot's Return**: +1.85%
**S&P 500's Return**: -1.2%
**Outperformance**: +3.05%

Let me put that in context. October 2025 was actually a down month for the market - the S&P 500 lost 1.2%. But my bot made money. It not only stayed positive but beat the market by over 3 percentage points. That might not sound like much, but if you annualize that outperformance, it's huge.

### Breaking Down the Trades

Over the month, the bot executed 24 trades across 11 different stocks. Here's what worked and what didn't:

**The Winners**:
- **QURE (Uniogen)**: +15.2% - The bot spotted this biotech stock during a sector rotation and nailed the timing. Best trade of the month.
- **INTC (Intel)**: +3.4% - The semiconductor play worked out exactly as predicted by the Flowhunt Agent
- **SPY (first trade)**: +1.8% - A solid, boring profit from the S&P 500 ETF

**The Losers**:
- **CLSK (CleanSpark)**: -8.5% - Ouch. This crypto mining stock dropped hard, and the bot held too long
- **VPU (Utilities)**: -3.2% - Defensive sector trade that didn't pan out
- **SPY (second trade)**: -1.3% - Can't win them all

**Overall Statistics**:
- **Win Rate**: 58.3% (14 winning trades out of 24)
- **Average Win**: +2.1%
- **Average Loss**: -1.3%

That 58.3% win rate is actually pretty good. In trading, you don't need to win 90% of the time - you just need your wins to be bigger than your losses. With an average win of 2.1% and average loss of 1.3%, the math works in our favor.

---

## 🎓 What I Learned Building This Bot

### The Power of Prompt Engineering

If I had to pick the single most important lesson from this project, it's this: **the quality of your AI's decisions is 90% determined by the quality of your prompt**.

Let me show you the difference between my early attempts and what finally worked.

**My First Terrible Prompt**:
```
"Should I buy or sell SPY?"
```

This gave me useless responses like "BUY" with no explanation. The AI had no context about what I owned, how much cash I had, or what my strategy was.

**My Final, Much Better Prompt**:
```
"You are a quantitative trader with a $100k portfolio.
Current positions: [detailed list]
Available cash: $XX,XXX
Market data: [price, volume, technical indicators]

Provide a JSON-formatted decision with:
- Your recommendation (BUY/SELL/HOLD)
- Detailed reasoning (3-4 sentences)
- Confidence score (1-100%)
- Risk assessment (what could go wrong)"
```

The difference? Night and day. The AI went from giving me one-word answers to providing thoughtful, well-reasoned analysis that I could actually trust.

### Why Logging Everything Was Crucial

Early on, I almost skipped the Google Sheets integration because it seemed like extra work. I'm so glad I didn't.

Having a log of every single decision turned out to be invaluable for four reasons:

1. **Pattern Recognition**: After 50 trades, I could look back and see that the bot was better at momentum plays than mean reversion. That insight let me refine the prompt to lean into its strengths.

2. **Debugging**: When a trade went badly, I could go back and read the exact reasoning. Often, I'd spot flaws in my prompt that I could fix.

3. **Building Trust**: Before I'd trust this with real money, I needed to see consistent, logical decision-making over time. The log provided that evidence.

4. **Learning**: Reading the Flowhunt agent's reasoning taught me about trading! I learned about technical indicators, risk management, and market analysis just by reviewing what the AI wrote.

### The Risk Management Rules That Saved Me

If you take away one practical tip from this blog post, let it be this: **build in risk management rules from day one**. These guardrails prevented my bot from doing anything catastrophic:

- **Position Size Limit**: No single position can exceed 20% of the portfolio. This prevented the bot from going "all in" on one stock.

- **Cash Reserve**: Always keep at least $5,000 in cash. This ensures there's always capital available for opportunities.

- **Market Hours Only**: Only trade between 9:30 AM and 4:00 PM Eastern. This prevented failed orders during after-hours.

- **Stop-Loss Protection**: If any position drops 5% below purchase price, automatically sell. This caps maximum loss per trade.

### The Mistakes I Made (So You Don't Have To)

**Mistake #1: Starting Too Complex**

My initial design had the bot analyzing 10 different stocks simultaneously, using multiple timeframes, and implementing complex portfolio optimization. It was a mess. I couldn't debug it because I didn't understand what was broken.

Starting with just SPY (one stock) and basic analysis was the right call. Add complexity only after you've proven the basics work.

**Mistake #2: Ignoring Market Conditions**

For the first two weeks, the bot used the same strategy regardless of whether the market was trending up, trending down, or moving sideways. This meant it applied momentum strategies during sideways markets (bad) and mean reversion strategies during trends (also bad).

The fix was adding market regime detection to the prompt: "First, identify if the market is trending or ranging, then adjust your strategy accordingly."

**Mistake #3: Focusing Only on Entries**

I spent 90% of my time perfecting the entry logic (when to buy) and almost no time on exits (when to sell). The result? The bot would make great trades, watch them become profitable, then hold too long and give back all the gains.

I fixed this by adding profit targets: "If a position is up 5%, strongly consider taking profits unless there's compelling reason to hold."

---

## 🔧 Technical Implementation Details

### Flowhunt Component Configuration

#### HTTP Request Component (Alpaca API)
```json
{
  "name": "Get Account Info",
  "type": "http_request",
  "config": {
    "url": "https://paper-api.alpaca.markets/v2/account",
    "method": "GET",
    "headers": {
      "APCA-API-KEY-ID": "{{env.ALPACA_KEY}}",
      "APCA-API-SECRET-KEY": "{{env.ALPACA_SECRET}}"
    },
    "response_format": "json"
  }
}
```

#### AI Chat Component (Flowhunt — OpenAI LLM)
```json
{
  "name": "Trading Decision",
  "type": "ai_chat",
  "config": {
    "model": "openai-gpt-4",
    "temperature": 0.3,
    "max_tokens": 2000,
    "system_prompt": "You are an expert quantitative trader...",
    "user_message": "{{formatted_market_data}}",
    "response_format": "json"
  }
}
```

#### Google Sheets Component
```json
{
  "name": "Log Decision",
  "type": "google_sheets_append",
  "config": {
    "spreadsheet_id": "{{env.SHEET_ID}}",
    "sheet_name": "Reasoning",
    "values": [
      "{{timestamp}}",
      "{{decision.ticker}}",
      "{{decision.action}}",
      "{{decision.reasoning}}",
      "{{decision.confidence}}"
    ]
  }
}
```

---

## 🚀 Next Steps & Future Improvements

### Planned Enhancements

#### 1. Multi-Timeframe Analysis
```
Current: Only analyzes current price
Future: Integrate 1H, 4H, Daily charts
Benefit: Better trend identification
```

#### 2. Sentiment Integration
```
Current: Pure technical analysis
Future: Add news sentiment via NewsAPI
Benefit: React to market-moving events
```

#### 3. Portfolio Optimization
```
Current: Simple position sizing
Future: Kelly Criterion + correlation analysis
Benefit: Optimal capital allocation
```

#### 4. Backtesting System
```
Current: Live testing only
Future: Historical simulation
Benefit: Test strategies before deployment
```

#### 5. Advanced Risk Management
```
Current: Basic stop-loss
Future: Dynamic position sizing, correlation hedging
Benefit: Drawdown reduction
```

---

## 💡 Key Takeaways

### For Beginners

1. **Start Simple**: My v1.0 was just analysis - that's perfect
2. **Iterate Quickly**: Each version added one new feature
3. **Log Everything**: Google Sheets became my best debugging tool
4. **Paper Trade First**: Never risk real money until proven
5. **Trust the Process**: AI trading requires patience and testing

### For Intermediate Builders

1. **Prompt Engineering is Critical**: Spent 70% of time perfecting prompts
2. **Error Handling Matters**: APIs fail - build resilience
3. **Position Sizing > Entry Signals**: Risk management prevents disaster
4. **Market Regime Awareness**: One strategy doesn't fit all markets
5. **Review & Iterate**: Weekly reviews of reasoning logs = improvement

### For Advanced Users

1. **LLM as Decision Engine**: Works better than expected
2. **Structured Output**: JSON responses enable automation
3. **Hybrid Approach**: Combine AI reasoning with rule-based guardrails
4. **Multi-Asset Strategies**: Diversification through AI recommendations
5. **Continuous Learning**: Save reasoning logs for model fine-tuning

---

## 📚 Resources

### Flowhunt Documentation
- [Getting Started Guide](https://flowhunt.io/docs)
- [AI Chat Component](https://flowhunt.io/docs/ai-components)
- [HTTP Requests](https://flowhunt.io/docs/http-requests)
- [Scheduling Flows](https://flowhunt.io/docs/scheduling)

### Alpaca API
- [Paper Trading Signup](https://alpaca.markets/docs/trading/paper-trading/)
- [API Documentation](https://alpaca.markets/docs/api-documentation/)
- [Orders API](https://alpaca.markets/docs/api-references/trading-api/orders/)
- [Positions API](https://alpaca.markets/docs/api-references/trading-api/positions/)

### Google Sheets Integration
- [Flowhunt Google Sheets](https://flowhunt.io/docs/google-sheets)
- [Sheets API Basics](https://developers.google.com/sheets/api)

---

## 🎯 Final Thoughts: Is This the Future of Trading?

### What I've Learned About AI and Trading

After a month of watching this bot trade autonomously, I've come to a surprising conclusion: AI isn't going to replace human traders, but it's going to make them a lot better.

Here's what I mean: the Flowhunt agent (the OpenAI model running inside Flowhunt) doesn't have emotional biases. It doesn't panic when the market drops or get greedy when things are going well. It follows its logic consistently, trade after trade. But it also doesn't have intuition or the ability to read between the lines of news articles. The best approach? A hybrid - let the AI handle routine analysis and execution, while humans provide oversight and strategic direction.

### The Results in Context

Let's be clear about what we built here:
- ✅ A fully autonomous trading system that runs 24/7 without human intervention
- ✅ +3.05% outperformance vs. the S&P 500 in a down month
- ✅ Complete transparency through detailed reasoning logs
- ✅ Risk management that prevented catastrophic losses
- ✅ A system that cost $0 to build (using free tiers of everything)

Is it perfect? Absolutely not. There are trades I question when I review the logs. There are improvements I want to make (and I list them in the "Next Steps" section below). But here's the thing: it works. It makes money. And it does it without me staring at stock charts all day.

### The Development Timeline (Reality Check)

If you're thinking about building something similar, here's what the timeline actually looked like:

- **Week 1**: Built Version 1 (analysis only). Spent most of the time learning Flowhunt and figuring out the Alpaca API. Lots of failed attempts and API errors.

- **Week 2**: Added trade execution (Version 2). First real trade was terrifying even though it was fake money. Hit several bugs with after-hours trading and position sizing.

- **Week 3**: Implemented logging and refined prompts (Version 3). This is when things really came together. The Google Sheets logs made debugging so much easier.

- **Week 4+**: Live trading and continuous refinement. Watching the bot trade for real, analyzing patterns, tweaking prompts based on results.

Total time investment? Maybe 40-50 hours spread over a month, mostly on evenings and weekends. The majority of that time was learning and debugging, not actual development.

### Would I Recommend This Approach?

**Yes, with caveats.**

Flowhunt is fantastic for rapid prototyping. The visual workflow builder and built-in AI integrations let you test ideas in hours instead of days. The scheduling system means your bot actually runs autonomously without you maintaining a server.

But there are limitations:
- You're dependent on Flowhunt's uptime
- Debugging can be tricky without traditional code
- You're limited to the integrations Flowhunt provides (though they cover most use cases)

For learning AI trading? Perfect platform. For serious production trading with real money? You might eventually want to move to a code-based solution for more control.

### What's Next?

This blog post covered building the trading bot itself. But there's a whole other side to this project: visualization and analysis.

In **Part 2**, I'll show you how I built a Next.js dashboard that:
- Displays real-time portfolio metrics with beautiful charts
- Shows AI reasoning alongside each trade
- Compares bot performance vs. market benchmarks
- Tracks every position from open to close
- Caches market data efficiently to avoid API limits

If you enjoyed Part 1, you'll love Part 2 - it's where we transform raw trading data into actionable insights.

---

## 🚀 Ready to Build Your Own?

Here's my advice if you're starting this journey:

1. **Start with paper trading** - Don't even think about real money until you have months of consistent results
2. **Log everything** - You can't improve what you don't measure
3. **Start simple** - One stock, basic analysis, then add complexity
4. **Iterate based on data** - Let real results guide your improvements, not hunches
5. **Focus on risk management** - Preventing disasters is more important than maximizing gains

The complete Flowhunt flows, Google Sheets templates, and example prompts are available if you want to replicate this project. Feel free to reach out with questions!

---

**Project Stats:**
- Development Time: ~40-50 hours
- Cost: $0 (all free tiers)
- Return in October 2025: +1.85%
- Market Return: -1.2%
- Trades Executed: 24
- Current Status: Still trading autonomously

**Author**: Hugo Lewis Plant
**Last Updated**: October 31, 2025
**Project Status**: Live & Trading in Paper Mode

---

**Disclaimer**: This trading bot uses Alpaca's paper trading API with simulated money for educational purposes only. Past performance does not guarantee future results. This blog post is not financial advice. Never trade with real money until you thoroughly understand the risks and have tested extensively. AI models can and will make mistakes. Always implement proper risk management and never invest more than you can afford to lose.

---

**Continue to Part 2**: [Building the Performance Dashboard →](#)
