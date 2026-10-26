import { query } from "../../../database/db.js";
import { callGroqChat } from "./groqClient.service.js";

export const handleAdminCopilotPrompt = async (prompt: string): Promise<string> => {
    // 1. Gather factual statistical summary from PostgreSQL
    const studentStatsRes = await query(`
        SELECT
            COUNT(*) AS total_students,
            COUNT(*) FILTER (WHERE is_placed = true) AS placed_students,
            COUNT(*) FILTER (WHERE verification_status = 'VERIFIED') AS verified_students,
            AVG(cgpa) FILTER (WHERE cgpa IS NOT NULL) AS average_cgpa
        FROM student_profiles
    `);
    const studentStats = studentStatsRes.rows[0];

    const branchStatsRes = await query(`
        SELECT branch, COUNT(*) AS count, COUNT(*) FILTER (WHERE is_placed = true) AS placed
        FROM student_profiles
        GROUP BY branch
        ORDER BY count DESC
        LIMIT 10
    `);
    const branchStats = branchStatsRes.rows;

    const driveStatsRes = await query(`
        SELECT job_title, c.company_name, package, application_deadline, is_active
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

${factualContext}`;

    try {
        const reply = await callGroqChat({
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: prompt }
            ],
            temperature: 0.2
        });
        return reply;
    } catch (err: any) {
        console.warn("Groq AI unavailable for Copilot, generating factual report:", err?.message);
        return `### Placement Copilot Summary\n\n**Total Students:** ${studentStats.total_students}\n**Placed Students:** ${studentStats.placed_students}\n**Average CGPA:** ${Number(studentStats.average_cgpa || 0).toFixed(2)}\n\nActive Drives currently tracked: ${driveStats.length}.`;
    }
};
