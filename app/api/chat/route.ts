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

        // Detect stock market queries
       let userDateTime: Date | undefined;
      
        if (
  message.toLowerCase().includes("market") ||
  message.toLowerCase().includes("stock")
) {
 const dateTimeRegex = /(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/;

      const match = message.match(dateTimeRegex);
  if (match) {
    userDateTime = new Date(match[1]);
  }
  const words = message.split(" ");
  let symbol = "";
  let error = false;

  if (words.length > 1) {
    symbol = words.filter((word: string) => /^[A-Z]+$/.test(word));
    if (symbol.length === 0) {
      error = true;
    }
  } else {
    error = true;
  }
   // const symbol = words.length > 1 ? words[1].toUpperCase() : "SPY";

  console.log("📊 Fetching stock data for:", symbol);

  // if there is an error, send an error message
  if (error) {
    const reply = "⚠️ Sorry, the stock ticker you asked for is not capitalized. Please retry with your stock in all caps."
     return new Response(
    new ReadableStream({
      start(controller) {
        const textEncoder = new TextEncoder();

        // Optional: enqueue a "loading" indicator first
        const loadingPayload = {
          type: "loading",
          indicator: { status: "Fetching market data...", icon: "thinking" },
        };
        controller.enqueue(textEncoder.encode(JSON.stringify(loadingPayload) + "\n"));

        // Send the final message chunk
        const streamedMessage = {
          type: "message",
          message: {
            role: "assistant",
            content: reply,
            citations: [],
          },
        };
        controller.enqueue(textEncoder.encode(JSON.stringify(streamedMessage) + "\n"));

        // Send the "done" event so front-end knows we're finished
        const donePayload = {
          type: "done",
          final_message: reply,
        };
        controller.enqueue(textEncoder.encode(JSON.stringify(donePayload) + "\n"));

        // Close the stream
        controller.close();
      },
    }),
    {
      headers: { "Content-Type": "text/event-stream" },
    }
  );
  }

  // 1. Fetch Market Data
 const data = await getMarketData(symbol);
  if (data.error) {
    console.log("⚠️ Stock data fetch failed:", data.error);
    // If there's an error, we can still do SSE but show a quick error message:
    return new Response(
      new ReadableStream({
        start(controller) {
          const textEncoder = new TextEncoder();

          // "loading" or "error" message
          const errorPayload = {
            type: "error",
            indicator: {
              status: "⚠️ Sorry, I couldn't retrieve stock data at this time.",
              icon: "error",
            },
          };
          controller.enqueue(textEncoder.encode(JSON.stringify(errorPayload) + "\n"));

          // End the stream
          controller.close();
        },
      }),
      {
        headers: { "Content-Type": "text/event-stream" },
      }
    );
  }

  // 2. Analyze Market Data
  const analysis = analyzeMarketData(data, userDateTime);
  console.log("📈 Stock analysis:", analysis);

  // Build the final "reply" text
  const reply = `📈 **Stock Update for ${symbol}**
🕒 **Time:** ${analysis.latestTime}
💰 **Open:** ${analysis.open}
📊 **High:** ${analysis.high}
📉 **Low:** ${analysis.low}
🔒 **Close:** ${analysis.close}
📦 **Volume:** ${analysis.volume}
📢 **Recommendation:** ${analysis.recommendation}`;

  // 3. Return SSE Stream
  return new Response(
    new ReadableStream({
      start(controller) {
        const textEncoder = new TextEncoder();

        // Optional: enqueue a "loading" indicator first
        const loadingPayload = {
          type: "loading",
          indicator: { status: "Fetching market data...", icon: "thinking" },
        };
        controller.enqueue(textEncoder.encode(JSON.stringify(loadingPayload) + "\n"));

        // Send the final message chunk
        const streamedMessage = {
          type: "message",
          message: {
            role: "assistant",
            content: reply,
            citations: [],
          },
        };
        controller.enqueue(textEncoder.encode(JSON.stringify(streamedMessage) + "\n"));

        // Send the "done" event so front-end knows we're finished
        const donePayload = {
          type: "done",
          final_message: reply,
        };
        controller.enqueue(textEncoder.encode(JSON.stringify(donePayload) + "\n"));

        // Close the stream
        controller.close();
      },
    }),
    {
      headers: { "Content-Type": "text/event-stream" },
    }
  );
}


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
