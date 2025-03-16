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
    console.log("🔍 Received chat request");

    try {
        const { chat } = await req.json();
        const message = chat.messages[chat.messages.length - 1]?.content || "";

        console.log("📝 User message:", message);

      
       // Force "market TICKER [optional time]" format
if (message.trim().toLowerCase().startsWith("market ")) {
  const words = message.trim().split(/\s+/); 
  // words[0] === "market"
  // words[1] => ticker
  if (words.length < 2) {
    return new Response(
      JSON.stringify({
        reply: "Please provide a ticker after the 'market' keyword.",
      }),
      { status: 200 }
    );
  }

  // 1) Get the ticker
  const symbol = words[1].toUpperCase();
  console.log("📊 Fetching stock data for:", symbol);

  // 2) OPTIONAL: Parse the time from user message (e.g., "09:45")
  //    If the user typed "market TSLA 09:45", then '09:45' might be words[2].
  //    Or it might be anywhere in the string, so you can do a full regex on 'message'.
  let userDateTime: Date | undefined = undefined;
  const timeRegex = /(\d{2}:\d{2})/; // looks for HH:MM
  const match = message.match(timeRegex);
  if (match) {
    // user typed something like "09:45"
    // We'll create a Date for today's date at that time
    const [hh, mm] = match[1].split(":");
    const now = new Date(); // local system time
    now.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);
    userDateTime = now;
    console.log("User requested time:", userDateTime.toString());
  }

  // 3) Fetch data as usual
  const data = await getMarketData(symbol);
  if (data.error) {
    console.log("⚠️ Stock data fetch failed:", data.error);
    return new Response(
      JSON.stringify({
        reply: "⚠️ Sorry, I couldn't retrieve stock data. Please try again later.",
      }),
      { status: 200 }
    );
  }

  // 4) Analyze data for the optional userDateTime
  const analysis = analyzeMarketData(data, userDateTime);
  console.log("📈 Stock analysis:", analysis);

  // 5) Return SSE or JSON
  return new Response(
    JSON.stringify({
      reply: `📈 **Stock Update for ${symbol}**\n🕒 **Time:** ${analysis.latestTime}\n💰 **Open:** ${analysis.open}\n📊 **High:** ${analysis.high}\n📉 **Low:** ${analysis.low}\n🔒 **Close:** ${analysis.close}\n📦 **Volume:** ${analysis.volume}\n📢 **Recommendation:** ${analysis.recommendation}`,
    }),
    {
      headers: { "Content-Type": "application/json" },
      status: 200,
    }
  );
}

// Anything else => normal chat logic
console.log("🤖 Processing non-stock related message");
const intention: Intention = await determineIntention(chat);
// ...


        console.log("🤖 Processing non-stock related message");

        const intention: Intention = await determineIntention(chat);

        if (intention.type === "question") {
            return ResponseModule.respondToQuestion(chat, providers, pineconeIndex);
        } else if (intention.type === "hostile_message") {
            return ResponseModule.respondToHostileMessage(chat, providers);
        } else {
            return ResponseModule.respondToRandomMessage(chat, providers);
        }

    } catch (error) {
        console.error("❌ Chatbot API Error:", error);
        return new Response(JSON.stringify({ reply: "⚠️ Internal Server Error. Please try again later." }), { status: 500 });
    }
}
