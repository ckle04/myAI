export async function getMarketData(symbol: string = 'SPY', interval: string = '5min') {
    try {
        const response = await fetch(`/api/market-data?symbol=${symbol}&interval=${interval}`);
        
        if (!response.ok) {
            throw new Error(`Stock API error: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data || data["Error Message"]) {
            throw new Error("Invalid data received from Alpha Vantage API");
        }

        return data;
    } catch (error) {
        console.error("Market Data Fetch Error:", error);
        return { error: "Failed to retrieve stock data" };
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
