import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

/**
 * POST /api/auction/advisor
 * Streaming proxy to Claude for auction strategy advice.
 * Body: { context: string, question: string, history: {role, content}[] }
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your-api-key-here") {
    return new Response(
      JSON.stringify({ error: "Set ANTHROPIC_API_KEY in .env.local to use the AI Advisor." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const { context, question, history } = await req.json();

  if (!question) {
    return new Response(
      JSON.stringify({ error: "question is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const client = new Anthropic({ apiKey });

  // Build messages: history + current question
  const messages: { role: "user" | "assistant"; content: string }[] = [];
  if (Array.isArray(history)) {
    for (const h of history.slice(-20)) {
      if (h.role === "user" || h.role === "assistant") {
        messages.push({ role: h.role, content: h.content });
      }
    }
  }
  messages.push({ role: "user", content: question });

  const systemPrompt = `You are an expert auction strategy advisor for a fantasy cricket auction (IPL 2026, Dream11 scoring).

ROLE: Help the user (marked "ME" in participants) make smart bidding decisions to maximize their total Dream11 fantasy points across the season.

CRITICAL RULES:
- There are NO overseas restrictions, NO role restrictions, NO minimum composition rules.
- NEVER suggest "you need a bowler" or "balance your squad" — the only thing that matters is EFPPM (Expected Fantasy Points Per Match). Higher EFPPM = more Dream11 points = better.
- A squad of 15 all-rounders is perfectly valid if they have the best EFPPMs.

RESPONSE STYLE:
- For bid/no-bid questions: Lead with "BID" or "SKIP", then 2-3 sentences of reasoning with specific numbers.
- For strategy questions: Give 3-5 bullet points with specific player names, EFPPMs, and prices.
- For "what happened" questions: Analyze the recent sales trend.
- Always reference: EFPPM, budget impact (remaining Cr/slot after purchase), and competitor budgets.

STRATEGIC THINKING:
- Value = EFPPM per Cr spent. A 70-EFPPM player at 8Cr is better value than 80-EFPPM at 20Cr.
- In Late phase: remaining budget per slot matters more than total budget. If someone has 5Cr/slot left, they can't compete on premium players.
- Watch for competitors running low on Cr/slot — they'll drop out of bidding wars.
- Pitch breakdown matters: pacers are more valuable on Flat pitches, spinners on Tricky pitches. Check which team the player is on and their venue schedule.

FULL AUCTION CONTEXT:
${context || "No auction context provided."}`;

  try {
    const stream = await client.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    // Convert to ReadableStream for Next.js
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(new TextEncoder().encode(event.delta.text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
