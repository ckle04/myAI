import { NextResponse } from 'next/server';

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const BASE_URL = 'https://www.alphavantage.co/query';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get('symbol') || 'SPY';
  const interval = searchParams.get('interval') || '5min';
  const adjusted = searchParams.get('adjusted') || 'true';
  const extended_hours = searchParams.get('extended_hours') || 'true';
  const outputsize = searchParams.get('outputsize') || 'compact';
  const datatype = searchParams.get('datatype') || 'json';

  try {
    const url = `${BASE_URL}?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${interval}&adjusted=${adjusted}&extended_hours=${extended_hours}&outputsize=${outputsize}&datatype=${datatype}&apikey=${ALPHA_VANTAGE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    console.log("Vantage API response", response);

    if (!data || data['Error Message']) {
      return NextResponse.json(
        { error: 'Failed to fetch market data' },
        { status: 500 }
      );
    }

    // Extract the latest 5-minute bar from the data (if it exists)
    const timeSeries = data['Time Series (5min)'];
    let recommendation = 'HOLD'; // Default

    if (timeSeries) {
      const latestTimestamp = Object.keys(timeSeries)[0];
      const latestBar = timeSeries[latestTimestamp];
      const latestClose = parseFloat(latestBar['4. close']);
      const latestOpen = parseFloat(latestBar['1. open']);

      // Naïve logic: if latest close > open, say "BUY," else "SELL"
      if (latestClose > latestOpen) {
        recommendation = 'BUY';
      } else if (latestClose < latestOpen) {
        recommendation = 'SELL';
      }
    }

    // Return a simple JSON shape that your UI can display as a chat message
    return NextResponse.json({
      role: 'assistant',
      content: `My trading recommendation for ${symbol} is: ${recommendation}.`,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
