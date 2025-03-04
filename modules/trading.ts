export async function getMarketData(symbol: string = 'SPY', interval: string = '5min') {
    try {
        console.log(`📡 Requesting stock data for ${symbol}...`);

        const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
        if (!apiKey) {
            throw new Error("Missing Alpha Vantage API Key");
        }

        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${interval}&apikey=${apiKey}`;
        console.log("🌐 Fetching from URL:", url);

        const response = await fetch(url, { timeout: 10000 });

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
    }
}


export function analyzeMarketData(data: any) {
    if (!data || !data["Time Series (5min)"]) return { error: "Invalid data" };

    const timeSeries = data["Time Series (5min)"];
    const timestamps = Object.keys(timeSeries);
    const latestTime = timestamps[0];
    const latestData = timeSeries[latestTime];

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
