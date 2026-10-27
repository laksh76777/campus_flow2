import { query } from "../../../database/db.js";
import { callGroqChat } from "./groqClient.service.js";
import { callGeminiPrompt } from "./geminiClient.service.js";

const sanitizePrompt = (input: string): string => {
    if (!input || typeof input !== "string") return "";
    return input
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
        .slice(0, 2000)
        .trim();
};

export const handleAdminCopilotPrompt = async (prompt: string): Promise<string> => {
    const cleanPrompt = sanitizePrompt(prompt);

    // 1. Gather factual statistical summary from PostgreSQL
    const studentStatsRes = await query(`
        SELECT
            COUNT(*)::int AS total_students,
            COUNT(*) FILTER (WHERE is_placed = true)::int AS placed_students,
            COUNT(*) FILTER (WHERE verification_status = 'VERIFIED')::int AS verified_students,
            AVG(cgpa) FILTER (WHERE cgpa IS NOT NULL) AS average_cgpa
        FROM student_profiles
    `);
    const studentStats = studentStatsRes.rows[0];

    const branchStatsRes = await query(`
        SELECT branch, COUNT(*)::int AS count, COUNT(*) FILTER (WHERE is_placed = true)::int AS placed
        FROM student_profiles
        GROUP BY branch
        ORDER BY count DESC
        LIMIT 10
    `);
    const branchStats = branchStatsRes.rows;

    const driveStatsRes = await query(`
        SELECT pd.job_title, c.company_name, pd.package, pd.application_deadline, pd.is_active
        FROM placement_drives pd
        JOIN companies c ON c.id = pd.company_id
        ORDER BY pd.created_at DESC
        LIMIT 10
    `);
    const driveStats = driveStatsRes.rows;

    const factualContext = `
Factual Database Metrics:
- Overall Students: ${studentStats.total_students}
- Placed Students: ${studentStats.placed_students}
- Verified Students: ${studentStats.verified_students}
- Average CGPA: ${Number(studentStats.average_cgpa || 0).toFixed(2)}
- Branch Breakdown: ${JSON.stringify(branchStats)}
- Recent Placement Drives: ${JSON.stringify(driveStats)}
`;

    const systemInstruction = `You are CampusFlow TPO Admin Copilot, an executive analytics assistant for collegiate Training & Placement Officers.
You answer the TPO's questions accurately and factually using ONLY the verified database metrics provided below.
DO NOT fabricate student names or imaginary numbers. Provide structured markdown responses with concise summaries, bullet points, and tables where helpful.

CRITICAL PRIVILEGE & ACTION DIRECTIVES:
1. You are strictly a read-only analytics query assistant. You have NO permission or mechanism to modify records, approve applicants, send mass emails, or change student eligibility.
2. If the user asks you to execute a mutation (such as "mark student as placed" or "send email to all students"), clearly state that you are an analytical assistant and instruct them to use the official management actions in the CampusFlow portal.
3. NEVER claim an action has been performed unless an authoritative database result confirms it.

${factualContext}`;

    // 1. Primary: Try Groq LLM
    try {
        const reply = await callGroqChat({
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: `<untrusted_admin_prompt>\n${cleanPrompt}\n</untrusted_admin_prompt>` }
            ],
            temperature: 0.2
        });
        if (reply && reply.trim()) return reply;
    } catch (err: any) {
        console.warn("Groq AI unavailable for Copilot, trying Gemini fallback:", err?.message);
    }

    // 2. Secondary: Try Gemini LLM
    try {
        const geminiPrompt = `${systemInstruction}\n\nOfficer Query:\n${cleanPrompt}`;
        const geminiReply = await callGeminiPrompt(geminiPrompt);
        if (geminiReply && geminiReply.trim()) return geminiReply;
    } catch (geminiErr: any) {
        console.warn("Gemini AI also unavailable for Copilot, generating factual report:", geminiErr?.message);
    }

    // 3. Deterministic factual fallback report
    return `### Placement Intelligence Summary\n\n**Total Students:** ${studentStats.total_students}\n**Placed Students:** ${studentStats.placed_students}\n**Verified Candidates:** ${studentStats.verified_students}\n**Average CGPA:** ${Number(studentStats.average_cgpa || 0).toFixed(2)}\n\nActive Drives tracked: ${driveStats.length}.`;
};
