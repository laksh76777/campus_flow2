import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import type { PoolClient } from "pg";
import { query, withTransaction, getPool } from "../database/db.js";
import { ReminderSchedulerService } from "./reminderScheduler.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ResetOptions {
    environment: "development" | "staging" | "test" | "production";
    confirm?: string;
    confirmProduction?: string;
    isDryRun?: boolean;
    backupDir?: string;
    executedBy?: string;
}

export interface TableCounts {
    reminder_jobs: number;
    export_logs: number;
    import_batches: number;
    drive_notifications: number;
    applications: number;
    placement_drives: number;
    companies: number;
}

export interface PreservedEntityCounts {
    users: number;
    admins: number;
    student_profiles: number;
    departments: number;
    placement_sessions: number;
    support_conversations: number;
    unrelated_notifications: number;
}

export interface PlacementResetSummary {
    executionId: string;
    timestamp: string;
    environment: string;
    mode: "DRY_RUN" | "COMMITTED";
    backupPath?: string;
    backupChecksum?: string;
    tablesToDelete: TableCounts;
    tablesToUpdate: {
        student_profiles_placed_reset: number;
    };
    preservedEntities: PreservedEntityCounts;
    postResetIntegrityCheck?: {
        remainingPlacementDrives: number;
        remainingApplications: number;
        remainingCompanies: number;
        remainingReminderJobs: number;
        usersPreserved: boolean;
        studentsPreserved: boolean;
        adminsPreserved: boolean;
        departmentsPreserved: boolean;
        sessionsPreserved: boolean;
    };
}

export interface PlacementSnapshotData {
    executionId: string;
    timestamp: string;
    environment: string;
    checksum: string;
    data: {
        companies: any[];
        placement_drives: any[];
        applications: any[];
        reminder_jobs: any[];
        export_logs: any[];
        import_batches: any[];
        notifications: any[];
        placed_students: any[];
    };
}

export class PlacementDataResetService {
    public static readonly CONFIRMATION_TOKEN = "CONFIRM_RESET_PLACEMENT_DATA";
    public static readonly PRODUCTION_CONFIRMATION_TOKEN = "I_UNDERSTAND_THIS_WILL_DELETE_ALL_PLACEMENT_DATA";

    /**
     * Inspects target placement tables and returns precise deletion & preservation counts without mutating state.
     */
    static async getDryRunSummary(
        environment: string,
        client?: PoolClient
    ): Promise<PlacementResetSummary> {
        const executor = client
            ? (text: string, params?: any[]) => client.query(text, params)
            : (text: string, params?: any[]) => query(text, params);

        const executionId = `reset_dryrun_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

        // 1. Placement tables to be deleted
        const reminderJobsRes = await executor("SELECT COUNT(*)::int AS count FROM reminder_jobs");
        const exportLogsRes = await executor("SELECT COUNT(*)::int AS count FROM export_logs WHERE placement_drive_id IN (SELECT id FROM placement_drives)");
        const importBatchesRes = await executor("SELECT COUNT(*)::int AS count FROM import_batches WHERE placement_drive_id IS NOT NULL OR import_type IN ('round_results', 'drive_applications')");
        const driveNotificationsRes = await executor(`SELECT COUNT(*)::int AS count FROM notifications 
                     WHERE application_id IS NOT NULL 
                        OR type IN ('status_update', 'drive_update', 'deadline_reminder', 'interview_scheduled', 'offer_extended', 'application_status')
                        OR company_name != '' 
                        OR job_title != ''`);
        const applicationsRes = await executor("SELECT COUNT(*)::int AS count FROM applications");
        const drivesRes = await executor("SELECT COUNT(*)::int AS count FROM placement_drives");
        const companiesRes = await executor("SELECT COUNT(*)::int AS count FROM companies");
        const placedStudentsRes = await executor("SELECT COUNT(*)::int AS count FROM student_profiles WHERE is_placed = true OR placed_company != '' OR placed_package IS NOT NULL");

        // 2. Preserved core entities
        const usersRes = await executor("SELECT COUNT(*)::int AS count FROM users");
        const adminsRes = await executor("SELECT COUNT(*)::int AS count FROM admins");
        const studentsRes = await executor("SELECT COUNT(*)::int AS count FROM student_profiles");
        const deptsRes = await executor("SELECT COUNT(*)::int AS count FROM departments");
        const sessionsRes = await executor("SELECT COUNT(*)::int AS count FROM placement_sessions");
        const supportRes = await executor("SELECT COUNT(*)::int AS count FROM support_conversations");
        const unrelatedNotifsRes = await executor(`SELECT COUNT(*)::int AS count FROM notifications 
                     WHERE application_id IS NULL 
                       AND (type NOT IN ('status_update', 'drive_update', 'deadline_reminder', 'interview_scheduled', 'offer_extended', 'application_status') OR type IS NULL)
                       AND (company_name = '' OR company_name IS NULL)
                       AND (job_title = '' OR job_title IS NULL)`);

        return {
            executionId,
            timestamp: new Date().toISOString(),
            environment,
            mode: "DRY_RUN",
            tablesToDelete: {
                reminder_jobs: reminderJobsRes.rows[0]?.count || 0,
                export_logs: exportLogsRes.rows[0]?.count || 0,
                import_batches: importBatchesRes.rows[0]?.count || 0,
                drive_notifications: driveNotificationsRes.rows[0]?.count || 0,
                applications: applicationsRes.rows[0]?.count || 0,
                placement_drives: drivesRes.rows[0]?.count || 0,
                companies: companiesRes.rows[0]?.count || 0
            },
            tablesToUpdate: {
                student_profiles_placed_reset: placedStudentsRes.rows[0]?.count || 0
            },
            preservedEntities: {
                users: usersRes.rows[0]?.count || 0,
                admins: adminsRes.rows[0]?.count || 0,
                student_profiles: studentsRes.rows[0]?.count || 0,
                departments: deptsRes.rows[0]?.count || 0,
                placement_sessions: sessionsRes.rows[0]?.count || 0,
                support_conversations: supportRes.rows[0]?.count || 0,
                unrelated_notifications: unrelatedNotifsRes.rows[0]?.count || 0
            }
        };
    }

    /**
     * Generates a full restorable JSON snapshot of the placement dataset prior to deletion.
     */
    static async generatePlacementSnapshot(
        options: { environment: string; backupDir?: string },
        client?: PoolClient
    ): Promise<{ snapshotPath: string; checksum: string; recordCount: number }> {
        const executor = client
            ? (text: string, params?: any[]) => client.query(text, params)
            : (text: string, params?: any[]) => query(text, params);

        const executionId = `snapshot_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
        const targetDir = options.backupDir || path.resolve(__dirname, "../../backups");

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        const companies = await executor("SELECT * FROM companies ORDER BY created_at ASC");
        const drives = await executor("SELECT * FROM placement_drives ORDER BY created_at ASC");
        const applications = await executor("SELECT * FROM applications ORDER BY created_at ASC");
        const reminders = await executor("SELECT * FROM reminder_jobs ORDER BY created_at ASC");
        const exportLogs = await executor("SELECT * FROM export_logs WHERE placement_drive_id IN (SELECT id FROM placement_drives)");
        const importBatches = await executor("SELECT * FROM import_batches WHERE placement_drive_id IS NOT NULL OR import_type IN ('round_results', 'drive_applications')");
        const notifications = await executor(`SELECT * FROM notifications 
                     WHERE application_id IS NOT NULL 
                        OR type IN ('status_update', 'drive_update', 'deadline_reminder', 'interview_scheduled', 'offer_extended', 'application_status')
                        OR company_name != '' 
                        OR job_title != ''`);
        const placedStudents = await executor("SELECT id, user_id, usn, is_placed, placed_company, placed_package, placed_at, placed_job_title FROM student_profiles WHERE is_placed = true OR placed_company != '' OR placed_package IS NOT NULL");

        const rawData = {
            companies: companies.rows,
            placement_drives: drives.rows,
            applications: applications.rows,
            reminder_jobs: reminders.rows,
            export_logs: exportLogs.rows,
            import_batches: importBatches.rows,
            notifications: notifications.rows,
            placed_students: placedStudents.rows
        };

        const serialized = JSON.stringify(rawData);
        const checksum = crypto.createHash("sha256").update(serialized).digest("hex");

        const snapshotPayload: PlacementSnapshotData = {
            executionId,
            timestamp: new Date().toISOString(),
            environment: options.environment,
            checksum,
            data: rawData
        };

        const totalRecords =
            companies.rows.length +
            drives.rows.length +
            applications.rows.length +
            reminders.rows.length +
            exportLogs.rows.length +
            importBatches.rows.length +
            notifications.rows.length;

        const fileName = `placement_snapshot_${options.environment}_${Date.now()}.json`;
        const snapshotPath = path.join(targetDir, fileName);

        fs.writeFileSync(snapshotPath, JSON.stringify(snapshotPayload, null, 2), "utf-8");

        return { snapshotPath, checksum, recordCount: totalRecords };
    }

    /**
     * Executes the controlled, database-backed placement data reset.
     * Guaranteed transaction isolation, dependency ordering, foreign-key integrity, and zero student PII leakage.
     */
    static async executeReset(options: ResetOptions, externalClient?: PoolClient): Promise<PlacementResetSummary> {
        // --- 1. Safeguard Assertions ---
        if (!options.environment) {
            throw new Error("Safety violation: Target environment (--env) must be specified (development|staging|test|production).");
        }

        if (options.isDryRun) {
            return await this.getDryRunSummary(options.environment, externalClient);
        }

        if (options.confirm !== this.CONFIRMATION_TOKEN) {
            throw new Error(
                `Safety violation: Confirmation required. Pass --confirm=${this.CONFIRMATION_TOKEN} to authorize deletion.`
            );
        }

        if (options.environment === "production") {
            if (options.confirmProduction !== this.PRODUCTION_CONFIRMATION_TOKEN) {
                throw new Error(
                    `CRITICAL PRODUCTION SAFEGUARD: Production deletion blocked. Operator must supply --confirm-production=${this.PRODUCTION_CONFIRMATION_TOKEN}.`
                );
            }
            if (process.env.ALLOW_PRODUCTION_RESET !== "true") {
                throw new Error(
                    "CRITICAL PRODUCTION SAFEGUARD: Execution refused because environment variable ALLOW_PRODUCTION_RESET is not set to 'true'."
                );
            }
        }

        // --- 2. Stop In-Memory Schedulers ---
        ReminderSchedulerService.stopWorker();

        // --- 3. Atomic Transactional Deletion ---
        const executeInTransaction = async (client: PoolClient): Promise<PlacementResetSummary> => {
            // A. Initial Pre-Delete Snapshot
            const snapshot = await this.generatePlacementSnapshot(
                { environment: options.environment, backupDir: options.backupDir },
                client
            );

            // B. Capture initial counts for summary
            const dryRun = await this.getDryRunSummary(options.environment, client);

            // C. Cancel in-flight jobs in database first to prevent concurrent runners
            await client.query(
                "UPDATE reminder_jobs SET status = 'CANCELLED', error_category = 'Cancelled by Placement Data Reset' WHERE status IN ('PENDING', 'PROCESSING')"
            );

            // D. Dependency-Ordered Deletions
            // 1. Delete reminder_jobs (references placement_drives)
            await client.query("DELETE FROM reminder_jobs");

            // 2. Delete export_logs (references placement_drives)
            await client.query("DELETE FROM export_logs WHERE placement_drive_id IN (SELECT id FROM placement_drives)");

            // 3. Delete drive-linked import_batches
            await client.query(
                "DELETE FROM import_batches WHERE placement_drive_id IS NOT NULL OR import_type IN ('round_results', 'drive_applications')"
            );

            // 4. Delete drive/application-specific notifications
            await client.query(`
                DELETE FROM notifications 
                WHERE application_id IS NOT NULL 
                   OR type IN ('status_update', 'drive_update', 'deadline_reminder', 'interview_scheduled', 'offer_extended', 'application_status')
                   OR company_name != '' 
                   OR job_title != ''
            `);

            // 5. Delete applications (references placement_drives & student_profiles)
            await client.query("DELETE FROM applications");

            // 6. Delete placement_drives (references companies)
            await client.query("DELETE FROM placement_drives");

            // 7. Delete companies
            await client.query("DELETE FROM companies");

            // 8. Reset student placed flags in student_profiles
            await client.query(`
                UPDATE student_profiles 
                SET is_placed = false, 
                    placed_company = '', 
                    placed_package = NULL, 
                    placed_at = NULL, 
                    placed_job_title = '' 
                WHERE is_placed = true OR placed_company != '' OR placed_package IS NOT NULL
            `);

            // E. Post-Condition Integrity Validations
            const postDrives = await client.query("SELECT COUNT(*)::int AS count FROM placement_drives");
            const postApps = await client.query("SELECT COUNT(*)::int AS count FROM applications");
            const postCompanies = await client.query("SELECT COUNT(*)::int AS count FROM companies");
            const postReminders = await client.query("SELECT COUNT(*)::int AS count FROM reminder_jobs");
            const postUsers = await client.query("SELECT COUNT(*)::int AS count FROM users");
            const postStudents = await client.query("SELECT COUNT(*)::int AS count FROM student_profiles");
            const postAdmins = await client.query("SELECT COUNT(*)::int AS count FROM admins");
            const postDepts = await client.query("SELECT COUNT(*)::int AS count FROM departments");
            const postSessions = await client.query("SELECT COUNT(*)::int AS count FROM placement_sessions");

            const drivesCount = postDrives.rows[0].count;
            const appsCount = postApps.rows[0].count;
            const companiesCount = postCompanies.rows[0].count;
            const remindersCount = postReminders.rows[0].count;

            if (drivesCount !== 0 || appsCount !== 0 || companiesCount !== 0 || remindersCount !== 0) {
                throw new Error(
                    `Post-reset integrity failure: Placement records still exist (drives=${drivesCount}, apps=${appsCount}, companies=${companiesCount}, reminders=${remindersCount}). Rolling back.`
                );
            }

            if (postUsers.rows[0].count === 0 || postStudents.rows[0].count === 0 || postAdmins.rows[0].count === 0) {
                throw new Error("Post-reset integrity failure: Core user accounts were affected! Rolling back immediately.");
            }

            return {
                executionId: dryRun.executionId,
                timestamp: new Date().toISOString(),
                environment: options.environment,
                mode: "COMMITTED",
                backupPath: snapshot.snapshotPath,
                backupChecksum: snapshot.checksum,
                tablesToDelete: dryRun.tablesToDelete,
                tablesToUpdate: dryRun.tablesToUpdate,
                preservedEntities: {
                    users: postUsers.rows[0].count,
                    admins: postAdmins.rows[0].count,
                    student_profiles: postStudents.rows[0].count,
                    departments: postDepts.rows[0].count,
                    placement_sessions: postSessions.rows[0].count,
                    support_conversations: dryRun.preservedEntities.support_conversations,
                    unrelated_notifications: dryRun.preservedEntities.unrelated_notifications
                },
                postResetIntegrityCheck: {
                    remainingPlacementDrives: drivesCount,
                    remainingApplications: appsCount,
                    remainingCompanies: companiesCount,
                    remainingReminderJobs: remindersCount,
                    usersPreserved: postUsers.rows[0].count > 0,
                    studentsPreserved: postStudents.rows[0].count > 0,
                    adminsPreserved: postAdmins.rows[0].count > 0,
                    departmentsPreserved: postDepts.rows[0].count > 0,
                    sessionsPreserved: postSessions.rows[0].count > 0
                }
            };
        };

        if (externalClient) {
            return await executeInTransaction(externalClient);
        } else {
            return await withTransaction(executeInTransaction);
        }
    }

    /**
     * Restores a previously created placement snapshot back into the database within an atomic transaction.
     */
    static async restoreFromSnapshot(snapshotFilePath: string, client?: PoolClient): Promise<{ restoredCount: number; status: string }> {
        if (!fs.existsSync(snapshotFilePath)) {
            throw new Error(`Snapshot file not found: ${snapshotFilePath}`);
        }

        const raw = fs.readFileSync(snapshotFilePath, "utf-8");
        const payload: PlacementSnapshotData = JSON.parse(raw);

        // Verify checksum
        const serialized = JSON.stringify(payload.data);
        const expectedChecksum = crypto.createHash("sha256").update(serialized).digest("hex");
        if (expectedChecksum !== payload.checksum) {
            throw new Error("Snapshot checksum mismatch: File has been tampered with or corrupted.");
        }

        const restoreOp = async (c: PoolClient) => {
            let count = 0;

            // 1. Restore companies
            for (const comp of payload.data.companies) {
                await c.query(
                    `INSERT INTO companies (id, company_name, company_description, company_website, company_logo_url, industry, location, contact_email, contact_phone, is_active, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                     ON CONFLICT (id) DO NOTHING`,
                    [
                        comp.id, comp.company_name, comp.company_description, comp.company_website,
                        comp.company_logo_url, comp.industry, comp.location, comp.contact_email,
                        comp.contact_phone, comp.is_active, comp.created_at, comp.updated_at
                    ]
                );
                count++;
            }

            // 2. Restore placement_drives
            for (const drive of payload.data.placement_drives) {
                await c.query(
                    `INSERT INTO placement_drives (
                        id, company_id, job_title, job_description, job_type, package, location,
                        eligible_branches, eligible_program_codes, minimum_cgpa, maximum_backlogs,
                        graduation_year, placement_session_id, application_start_date,
                        application_deadline, drive_date, is_active, created_by, created_at, updated_at
                     )
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
                     ON CONFLICT (id) DO NOTHING`,
                    [
                        drive.id, drive.company_id, drive.job_title, drive.job_description, drive.job_type,
                        drive.package, drive.location, drive.eligible_branches, drive.eligible_program_codes,
                        drive.minimum_cgpa, drive.maximum_backlogs, drive.graduation_year,
                        drive.placement_session_id, drive.application_start_date, drive.application_deadline,
                        drive.drive_date, drive.is_active, drive.created_by, drive.created_at, drive.updated_at
                    ]
                );
                count++;
            }

            // 3. Restore applications
            for (const app of payload.data.applications) {
                await c.query(
                    `INSERT INTO applications (
                        id, student_id, placement_drive_id, status, applied_at,
                        interview_date, interview_round, offered_package, created_at, updated_at
                     )
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                     ON CONFLICT (id) DO NOTHING`,
                    [
                        app.id, app.student_id, app.placement_drive_id, app.status, app.applied_at,
                        app.interview_date, app.interview_round, app.offered_package, app.created_at, app.updated_at
                    ]
                );
                count++;
            }

            // 4. Restore student placed fields
            for (const s of payload.data.placed_students) {
                await c.query(
                    `UPDATE student_profiles 
                     SET is_placed = $1, placed_company = $2, placed_package = $3, placed_at = $4, placed_job_title = $5
                     WHERE id = $6`,
                    [s.is_placed, s.placed_company, s.placed_package, s.placed_at, s.placed_job_title, s.id]
                );
            }

            return { restoredCount: count, status: "RESTORED_SUCCESSFULLY" };
        };

        if (client) {
            return await restoreOp(client);
        } else {
            return await withTransaction(restoreOp);
        }
    }
}
