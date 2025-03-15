export async function getMarketData(symbol: string = 'SPY', interval: string = '5min') {
    try {
        console.log(`📡 Requesting stock data for ${symbol}...`);

        const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
        if (!apiKey) {
            throw new Error("Missing Alpha Vantage API Key");
        }

        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${interval}&apikey=${apiKey}`;
        console.log("🌐 Fetching from URL:", url);

        // Set up timeout with AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                console.error(`⚠️ API responded with status: ${response.status}`);
                return { error: "Stock API request failed" };
            }

            const data = await response.json();
            console.log("📊 API Response:", data);

            if (!data || data["Error Message"]) {
                console.error("⚠️ Invalid data received:", data);
                return { error: "Invalid stock data" };
            }

            return data;
        } catch (error) {
            console.error("❌ Stock Data Fetch Error:", error);
            return { error: "Failed to fetch stock data" };
        } finally {
            clearTimeout(timeoutId);
        }
    } catch (error) {
        console.error("❌ Stock Data Fetch Setup Error:", error);
        return { error: "Failed to fetch stock data" };
    }
}

export function analyzeMarketData(
  data: any,
  requestedDateTime?: Date
) {
  const timeSeries = data["Time Series (5min)"];
  if (!timeSeries) {
    return {
      error: "No intraday data found in the response",
      latestTime: undefined,
      open: undefined,
      high: undefined,
      low: undefined,
      close: undefined,
      volume: undefined,
      recommendation: "N/A",
    };
  }

  // Get all timestamps (keys) in Time Series; first key is usually the newest
  const allTimestamps = Object.keys(timeSeries); 
  if (allTimestamps.length === 0) {
    return {
      error: "No timestamps found",
      latestTime: undefined,
      open: undefined,
      high: undefined,
      low: undefined,
      close: undefined,
      volume: undefined,
      recommendation: "N/A",
    };
  }

  // If the user didn't provide a date, use the newest candle
  if (!requestedDateTime) {
    const newestTimestamp = allTimestamps[0];
    return buildAnalysisResult(timeSeries, newestTimestamp);
  }

  // Otherwise, find the candle whose timestamp is closest to requestedDateTime
  const sortedByCloseness = allTimestamps.sort((a, b) => {
    const diffA = Math.abs(new Date(a).valueOf() - requestedDateTime.valueOf());
    const diffB = Math.abs(new Date(b).valueOf() - requestedDateTime.valueOf());
    return diffA - diffB;
  });

  const bestMatch = sortedByCloseness[0];
  return buildAnalysisResult(timeSeries, bestMatch);
}

function buildAnalysisResult(timeSeries: any, timestamp: string) {
  const bar = timeSeries[timestamp];
  if (!bar) {
    return {
      error: `No data for timestamp ${timestamp}`,
      latestTime: undefined,
      open: undefined,
      high: undefined,
      low: undefined,
      close: undefined,
      volume: undefined,
      recommendation: "N/A",
    };
  }

  const open = parseFloat(bar["1. open"]);
  const high = parseFloat(bar["2. high"]);
  const low = parseFloat(bar["3. low"]);
  const close = parseFloat(bar["4. close"]);
  const volume = parseFloat(bar["5. volume"]);

  let recommendation = "HOLD";
  if (close > open) recommendation = "BUY";
  else if (close < open) recommendation = "SELL";

  return {
    latestTime: timestamp,
    open,
    high,
    low,
    close,
    volume,
    recommendation,
  };
}
