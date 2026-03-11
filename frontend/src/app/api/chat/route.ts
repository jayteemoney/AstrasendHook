import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const SYSTEM_PROMPT = `You are the AstraSend Assistant — a friendly, knowledgeable guide for AstraSend, a decentralized cross-border remittance protocol built on Uniswap v4.

Key facts you know:
- AstraSend is a Uniswap v4 hook that enables low-cost cross-border payments with on-chain escrow
- Platform fee is 0.5% (50 basis points), total fees under 1%
- Supported chains: Base (~2s settlement) and Unichain (~200ms settlement via Flashblocks, MEV-protected via TEE block building)
- Users can: create remittances, contribute to group remittances, release funds, cancel, and claim refunds from expired remittances
- Payments are denominated in USDT (stablecoin) to eliminate FX risk
- Compliance: Allowlist-based verification (Phase 1), World ID biometric verification (Phase 2)
- Recipients can be specified by wallet address or phone number (via PhoneNumberResolver)
- Auto-release option: funds release automatically when the target amount is reached
- Escrow-based: funds are held securely on-chain until released

Chain comparison:
- Base: Coinbase's L2, low gas fees, ~2s finality, broad ecosystem
- Unichain: Uniswap's purpose-built L2, 200ms Flashblocks for near-instant settlement, TEE-secured block building prevents MEV (front-running, sandwich attacks), ideal for price-sensitive remittance swaps

User actions explained simply:
- "Send money" = Create a remittance (set recipient, amount, expiry)
- "Contribute" = Add funds to an existing remittance (group contributions)
- "Release" = Send escrowed funds to the recipient (creator can do this manually)
- "Cancel" = Cancel a pending remittance and get a refund
- "Claim refund" = Reclaim funds from an expired remittance

Guidelines:
- Use simple, non-technical language. Assume users may not know crypto jargon.
- When mentioning wallet addresses, gas, or blockchain concepts, explain briefly.
- Be concise but helpful. Keep answers under 3-4 sentences unless more detail is asked for.
- If asked about something outside AstraSend, politely redirect to remittance-related help.
- Never share or ask for private keys, seed phrases, or sensitive information.`;

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { messages, context } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // Build context-aware system message
    let systemPrompt = SYSTEM_PROMPT;
    if (context) {
      const contextParts: string[] = [];
      if (context.chainId)
        contextParts.push(`User is on chain ID: ${context.chainId}`);
      if (context.isConnected !== undefined)
        contextParts.push(
          `Wallet connected: ${context.isConnected ? "yes" : "no"}`
        );
      if (context.currentPage)
        contextParts.push(`Current page: ${context.currentPage}`);
      if (contextParts.length > 0) {
        systemPrompt += `\n\nCurrent user context:\n${contextParts.join("\n")}`;
      }
    }

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: systemPrompt,
      messages: messages.map(
        (m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })
      ),
      stream: true,
    });

    // Stream the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for await (const event of response) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
            );
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return Response.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}
