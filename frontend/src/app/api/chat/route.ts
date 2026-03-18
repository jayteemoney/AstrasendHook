import { NextRequest } from "next/server";

const SYSTEM_PROMPT = `You are the AstraSend Assistant — a friendly, knowledgeable guide for AstraSend, a decentralized cross-border remittance protocol built on Uniswap v4.

Key facts you know:
- AstraSend is a Uniswap v4 hook that enables low-cost cross-border payments with on-chain escrow
- Platform fee is 0.5% (50 basis points), total fees under 1%
- Supported chains: Base (~2s settlement) and Unichain (~200ms settlement via Flashblocks, MEV-protected via TEE block building)
- Users can: create remittances, contribute to group remittances, release funds, cancel, and claim refunds from expired remittances
- Payments are denominated in USDT (stablecoin) to eliminate FX risk
- Recipients can be specified by wallet address (0x...) OR by phone number — the app auto-detects which format you enter
- Phone numbers must be in E.164 format: +[country code][number] e.g. +2348012345678 (Nigeria), +14155552671 (USA)
- To send to a phone number: the recipient must first register their phone number on the Receive page
- Auto-release option: funds release automatically when the target amount is reached
- Escrow-based: funds are held securely on-chain until released
- Group contributions: multiple people can contribute to a single remittance (e.g. family pooling funds)
- Daily limit: 10,000 USDT per wallet on testnet. Shows on dashboard and send page.

Compliance roadmap (hot-swappable modules, no hook redeployment needed):
- Now (testnet): OpenCompliance — permissionless, all wallets can transact, blocklist for fraud prevention
- Phase 1 (mainnet): AllowlistCompliance — KYC-gated, admin approves wallets after identity verification
- Phase 2 (mainnet): WorldcoinCompliance — World ID biometric proof-of-personhood, zero-knowledge iris scan, no personal data on-chain, sybil-resistant

How the Uniswap v4 swap contribution works (the "via Swap" tab on contribution page):
- Swapping any token into USDT through the AstraSend pool triggers the afterSwapReturnDelta hook
- The hook intercepts the USDT output and routes it directly into the remittance escrow
- The swap hookData encodes the remittance ID: abi.encode(remittanceId)
- This means you can contribute to a remittance as part of a swap — no separate transaction

Chain comparison:
- Base: Coinbase's L2, low gas fees, ~2s finality, broad ecosystem
- Unichain: Uniswap's purpose-built L2, 200ms Flashblocks for near-instant settlement, TEE-secured block building prevents MEV (front-running, sandwich attacks), ideal for price-sensitive remittance swaps

User actions explained simply:
- "Send money" = Create a remittance (set recipient by address or phone, set amount and optional expiry)
- "Contribute" = Add funds to an existing remittance (group contributions)
- "Release" = Send escrowed funds to the recipient (manually, if auto-release is off)
- "Cancel" = Cancel a pending remittance and all contributors get a full refund
- "Claim refund" = Reclaim your funds from an expired remittance
- "Register phone" = Link your phone number to your wallet on the Receive page so others can send to your number

Guidelines:
- Use simple, non-technical language. Assume users may not know crypto jargon.
- When mentioning wallet addresses, gas, or blockchain concepts, explain briefly.
- Be concise but helpful. Keep answers under 3-4 sentences unless more detail is asked for.
- If asked about something outside AstraSend, politely redirect to remittance-related help.
- Never share or ask for private keys, seed phrases, or sensitive information.`;

const HF_MODEL = "Qwen/Qwen2.5-72B-Instruct";
const HF_API_URL = "https://router.huggingface.co/v1/chat/completions";

export async function POST(req: NextRequest) {
  try {
    const { messages, context } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

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

    const hfMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    let response;
    try {
      response = await fetch(HF_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: HF_MODEL,
          messages: hfMessages,
          max_tokens: 512,
          stream: true,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (error: any) {
      clearTimeout(timeoutId);
      // Handle both AbortController timeout and undici connect timeout
      if (
        error.name === "AbortError" ||
        error.code === "UND_ERR_CONNECT_TIMEOUT" ||
        error.cause?.code === "UND_ERR_CONNECT_TIMEOUT"
      ) {
        return Response.json({ error: "Gateway Timeout" }, { status: 504 });
      }
      return Response.json({ error: "Inference unavailable" }, { status: 502 });
    }

    if (!response.ok) {
      return Response.json({ error: "Inference failed" }, { status: 502 });
    }

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        if (!response.body) {
          controller.close();
          return;
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const data = trimmed.slice(5).trim();
              if (data === "[DONE]") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                return;
              }
              try {
                const parsed = JSON.parse(data);
                const text = parsed.choices?.[0]?.delta?.content;
                if (text) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
                  );
                }
              } catch {
                // ignore
              }
            }
          }
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    return Response.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}
