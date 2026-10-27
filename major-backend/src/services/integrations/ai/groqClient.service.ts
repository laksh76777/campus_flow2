import { env } from "../../../config/env.js";

export interface GroqMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export const callGroqChat = async (options: {
    messages: GroqMessage[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
    responseFormatJson?: boolean;
}): Promise<string> => {
    const apiKey = env.GROQ_API_KEY;
    if (!apiKey) {
        throw new Error("GROQ_API_KEY is not configured.");
    }

    const model = options.model || env.GROQ_MODEL || "qwen/qwen3.8-27b";

    // Sanitize and bound input messages
    const sanitizedMessages = options.messages.map((m) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content.slice(0, 4000) : ""
    }));

    const maxTokens = Math.min(2000, Math.max(50, options.maxTokens ?? 1500));
    const body: Record<string, any> = {
        model,
        messages: sanitizedMessages,
        temperature: Math.min(1.0, Math.max(0.0, options.temperature ?? 0.3)),
        max_tokens: maxTokens
    };

    if (options.responseFormatJson) {
        body.response_format = { type: "json_object" };
    }

    try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(10000)
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Groq API returned HTTP ${res.status}: ${errorText.slice(0, 200)}`);
        }

        const data: any = await res.json();
        return data?.choices?.[0]?.message?.content || "";
    } catch (err: any) {
        if (err.name === "TimeoutError" || err.message?.includes("timeout")) {
            throw new Error("Groq API request timed out (10s threshold).");
        }
        throw err;
    }
};
