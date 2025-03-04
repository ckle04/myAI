import { OpenAI } from "openai";
import { Pinecone } from "@pinecone-database/pinecone";
import { AIProviders, Chat, Intention } from "@/types";
import { IntentionModule } from "@/modules/intention";
import { ResponseModule } from "@/modules/response";
import { PINECONE_INDEX_NAME } from "@/configuration/pinecone";
import { getMarketData, analyzeMarketData } from "@/modules/trading";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

// Get API keys
const pineconeApiKey = process.env.PINECONE_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const fireworksApiKey = process.env.FIREWORKS_API_KEY;

// Check if API keys are set
if (!pineconeApiKey) {
  throw new Error("PINECONE_API_KEY is not set");
}
if (!openaiApiKey) {
  throw new Error("OPENAI_API_KEY is not set");
}

// Initialize Pinecone
const pineconeClient = new Pinecone({
  apiKey: pineconeApiKey,
});
const pineconeIndex = pineconeClient.Index(PINECONE_INDEX_NAME);

// Initialize Providers
const openaiClient = new OpenAI({
  apiKey: openaiApiKey,
});
const anthropicClient = new Anthropic({
  apiKey: anthropicApiKey,
});
const fireworksClient = new OpenAI({
  baseURL: "https://api.fireworks.ai/inference/v1",
  apiKey: fireworksApiKey,
});
const providers: AIProviders = {
  openai: openaiClient,
  anthropic: anthropicClient,
  fireworks: fireworksClient,
};

async function determineIntention(chat: Chat): Promise<Intention> {
  return await IntentionModule.detectIntention({
    chat: chat,
    openai: providers.openai,
  });
}

export async function POST(req: Request) {
  const { chat } = await req.json();
  const message = chat.messages[chat.messages.length - 1]?.content || "";

  // 📌 Step 1: Detect if the user is asking about a stock market update
  if (message.toLowerCase().includes("market") || message.toLowerCase().includes("stock")) {
    // Extract stock symbol from message (e.g., "market TSLA" → TSLA)
    const words = message.split(" ");
    const symbol = words.length > 1 ? words[1].toUpperCase() : "SPY"; // Default to S&P 500 (SPY)

    // 📌 Step 2: Fetch market data
    const data = await getMarketData(symbol);
    const analysis = analyzeMarketData(data);

    // 📌 Step 3: Return stock data response
    return new Response(JSON.stringify({
      reply: `📈 **Stock Update for ${symbol}**\n🕒 Time: ${analysis.latestTime}\n💰 Open: ${analysis.open}\n📊 High: ${analysis.high}\n📉 Low: ${analysis.low}\n🔒 Close: ${analysis.close}\n📦 Volume: ${analysis.volume}\n📢 **Recommendation:** ${analysis.recommendation}`
    }), { status: 200 });
  }

  // 📌 Step 4: If it's NOT a stock-related query, continue as usual
  const intention: Intention = await determineIntention(chat);

  if (intention.type === "question") {
    return ResponseModule.respondToQuestion(chat, providers, pineconeIndex);
  } else if (intention.type === "hostile_message") {
    return ResponseModule.respondToHostileMessage(chat, providers);
  } else {
    return ResponseModule.respondToRandomMessage(chat, providers);
  }
}


