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
