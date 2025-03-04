import { NextResponse } from 'next/server';

const ALPHA_VANTAGE_API_KEY = process.env.KHVRSO6QKJ82XSA2;
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

        if (!data || data["Error Message"]) {
            return NextResponse.json({ error: "Failed to fetch market data" }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
