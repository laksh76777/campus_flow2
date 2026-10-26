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

    const body: Record<string, any> = {
        model,
        messages: options.messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 1500
    };

    if (options.responseFormatJson) {
        body.response_format = { type: "json_object" };
    }

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Groq API returned HTTP ${res.status}: ${errorText}`);
    }

    const data: any = await res.json();
    return data?.choices?.[0]?.message?.content || "";
};
