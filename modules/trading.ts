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

export function analyzeMarketData(data: any) {
    if (!data || !data["Time Series (5min)"]) return { error: "Invalid data" };

    const timeSeries = data["Time Series (5min)"];
    const timestamps = Object.keys(timeSeries).sort().reverse(); // Ensure most recent is first
    const latestTime = timestamps[0]; // Get latest time entry
    const latestData = timeSeries[latestTime];

    if (!latestData) return { error: "No recent stock data available" };

    const open = parseFloat(latestData["1. open"]);
    const high = parseFloat(latestData["2. high"]);
    const low = parseFloat(latestData["3. low"]);
    const close = parseFloat(latestData["4. close"]);
    const volume = parseInt(latestData["5. volume"]);

    let recommendation = "HOLD";
    if (close > open) recommendation = "BUY";
    else if (close < open) recommendation = "SELL";

    return {
        latestTime,
        open,
        high,
        low,
        close,
        volume,
        recommendation
    };
}

function analyzeMarketDataForTimestamp(
  data: any,
  requestedDateTime?: Date
) {
  // For intraday data, look at "Time Series (5min)"
  const timeSeries = data["Time Series (5min)"];
  if (!timeSeries) {
    return { 
      error: "No intraday data found in the response", 
      open: undefined, 
      high: undefined, 
      low: undefined, 
      close: undefined, 
      volume: undefined, 
      recommendation: "N/A",
      latestTime: undefined
    };
  }

  // Turn the time-series keys into an array. The first element is the latest candle.
  const allTimestamps = Object.keys(timeSeries); 
  if (allTimestamps.length === 0) {
    return { 
      error: "No timestamps found", 
      open: undefined, 
      high: undefined, 
      low: undefined, 
      close: undefined, 
      volume: undefined, 
      recommendation: "N/A",
      latestTime: undefined
    };
  }

  // If the user didn't provide a date/time, pick the newest candle
  if (!requestedDateTime) {
    const newestTimestamp = allTimestamps[0];
    return buildAnalysisResult(timeSeries, newestTimestamp);
  }

  // Otherwise, find the candle closest to requestedDateTime
  // Sort timestamps by absolute difference from requestedDateTime
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
      open: undefined,
      high: undefined,
      low: undefined,
      close: undefined,
      volume: undefined,
      recommendation: "N/A",
      latestTime: undefined
    };
  }

  const open = parseFloat(bar["1. open"]);
  const high = parseFloat(bar["2. high"]);
  const low = parseFloat(bar["3. low"]);
  const close = parseFloat(bar["4. close"]);
  const volume = parseFloat(bar["5. volume"]);

  // Naïve logic for buy/sell
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
