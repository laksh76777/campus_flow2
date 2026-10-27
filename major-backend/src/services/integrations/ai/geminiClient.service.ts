import { env } from "../../../config/env.js";

export const callGeminiPrompt = async (prompt: string, systemInstruction?: string): Promise<string> => {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured.");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const contents: any[] = [];
    if (systemInstruction) {
        contents.push({ role: "user", parts: [{ text: `System Instruction: ${systemInstruction}` }] });
    }
    contents.push({ role: "user", parts: [{ text: prompt }] });

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents }),
            signal: AbortSignal.timeout(10000)
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Gemini API returned HTTP ${res.status}: ${errorText.slice(0, 200)}`);
        }

        const data: any = await res.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (err: any) {
        if (err.name === "TimeoutError" || err.message?.includes("timeout")) {
            throw new Error("Gemini API request timed out (10s threshold).");
        }
        throw err;
    }
};
