import { resolveStudentProgram } from "../constants/programCatalog.js";
import { getDriveProgramCodes, studentMatchesDriveProgram } from "./programTargeting.service.js";

export const EligibilityStatus = {
    ELIGIBLE: "ELIGIBLE",
    INELIGIBLE: "INELIGIBLE",
    MISSING_DATA: "MISSING_DATA"
} as const;

export type EligibilityStatusType = (typeof EligibilityStatus)[keyof typeof EligibilityStatus];

export interface CriteriaBreakdownItem {
    criterion: string;
    required: string;
    actual: string;
    passed: boolean;
}

export interface EligibilityReport {
    status: EligibilityStatusType;
    isEligible: boolean;
    summary: string;
    reasons: string[];
    missingFields: string[];
    criteriaBreakdown: CriteriaBreakdownItem[];
}

export class EligibilityService {
    static evaluate(student: any, drive: any): EligibilityReport {
        if (!student) {
            return {
                status: EligibilityStatus.MISSING_DATA,
                isEligible: false,
                summary: "Student profile does not exist",
                reasons: ["Academic profile has not been created yet"],
                missingFields: ["studentProfile"],
                criteriaBreakdown: []
            };
        }

        if (!drive) {
            return {
                status: EligibilityStatus.INELIGIBLE,
                isEligible: false,
                summary: "Placement drive not found",
                reasons: ["Invalid or inactive placement drive"],
                missingFields: [],
                criteriaBreakdown: []
            };
        }

        const missingFields: string[] = [];
        const failureReasons: string[] = [];
        const criteriaBreakdown: CriteriaBreakdownItem[] = [];

        // 1. Resolve student metrics using verified data first
        const studentCGPA = student.verified_cgpa != null
            ? Number(student.verified_cgpa)
            : student.verifiedCGPA != null
            ? Number(student.verifiedCGPA)
            : student.cgpa != null
            ? Number(student.cgpa)
            : null;

        const studentActiveBacklogs = student.active_backlogs != null
            ? Number(student.active_backlogs)
            : student.activeBacklogs != null
            ? Number(student.activeBacklogs)
            : student.backlogs != null
            ? Number(student.backlogs)
            : null;

        const studentHistBacklogs = student.historical_backlogs != null
            ? Number(student.historical_backlogs)
            : student.historicalBacklogs != null
            ? Number(student.historicalBacklogs)
            : Array.isArray(student.backlog_details || student.backlogDetails)
            ? (student.backlog_details || student.backlogDetails).length
            : 0;

        const tenthDetails = student.tenth_details || student.tenthDetails;
        const studentTenth = tenthDetails?.percentage != null
            ? Number(tenthDetails.percentage)
            : student.tenth_percentage != null
            ? Number(student.tenth_percentage)
            : student.tenthPercentage != null
            ? Number(student.tenthPercentage)
            : null;

        const twelfthDetails = student.twelfth_or_diploma_details || student.twelfthOrDiplomaDetails;
        const studentTwelfth = twelfthDetails?.percentage != null
            ? Number(twelfthDetails.percentage)
            : student.twelfth_percentage != null
            ? Number(student.twelfth_percentage)
            : student.twelfthPercentage != null
            ? Number(student.twelfthPercentage)
            : null;

        const studentResumeUrl = student.resume_url || student.resume?.url || student.resumeUrl;

        // 2. Strict Missing Data Detection
        if (studentCGPA === null || isNaN(studentCGPA)) missingFields.push("CGPA");
        if (!student.branch && !student.department) missingFields.push("Department / Branch");
        if (student.graduation_year == null && student.graduationYear == null) missingFields.push("Graduation Year");
        if (studentActiveBacklogs === null || isNaN(studentActiveBacklogs)) missingFields.push("Backlog Status");

        const requiresTenthCheck = drive.check_tenth_marks || drive.checkTenthMarks || Number(drive.minimum_tenth_percentage || drive.minimumTenthPercentage || 0) > 0;
        if (requiresTenthCheck) {
            if (studentTenth === null || isNaN(studentTenth)) {
                missingFields.push("10th Standard Percentage");
            }
        }

        const requiresTwelfthCheck = drive.check_twelfth_marks || drive.checkTwelfthMarks || Number(drive.minimum_twelfth_percentage || drive.minimumTwelfthPercentage || 0) > 0;
        if (requiresTwelfthCheck) {
            if (studentTwelfth === null || isNaN(studentTwelfth)) {
                missingFields.push("12th / Diploma Percentage");
            }
        }

        if (!studentResumeUrl) {
            missingFields.push("Master Resume Document");
        }

        if (missingFields.length > 0) {
            return {
                status: EligibilityStatus.MISSING_DATA,
                isEligible: false,
                summary: "Cannot evaluate eligibility: Academic profile has missing required information",
                reasons: missingFields.map((f) => `Missing ${f} in profile`),
                missingFields,
                criteriaBreakdown: [
                    {
                        criterion: "Profile Completeness & Documents",
                        required: "All required academic metrics and verified resume",
                        actual: `Missing: ${missingFields.join(", ")}`,
                        passed: false
                    }
                ]
            };
        }

        // 3. Drive Status & Deadline Check
        const now = new Date();
        const deadlineStr = drive.application_deadline || drive.applicationDeadline;
        const deadline = deadlineStr ? new Date(deadlineStr) : null;
        const isDriveActive = Boolean(drive.is_active ?? drive.isActive);
        const isDeadlineOpen = deadline ? now <= deadline : true;

        criteriaBreakdown.push({
            criterion: "Drive Status & Deadline",
            required: "Active drive with open deadline",
            actual: isDeadlineOpen ? "Deadline open" : "Deadline passed",
            passed: isDriveActive && isDeadlineOpen
        });

        if (!isDriveActive) {
            failureReasons.push("Placement drive has been closed or archived by TPO");
        } else if (!isDeadlineOpen) {
            failureReasons.push("Application deadline has passed");
        }

        // 4. Graduation Cohort Matching
        const studentGradYear = Number(student.graduation_year ?? student.graduationYear);
        const driveGradYear = Number(drive.graduation_year ?? drive.graduationYear);
        const gradYearMatches = studentGradYear === driveGradYear;

        criteriaBreakdown.push({
            criterion: "Graduation Cohort",
            required: `Class of ${driveGradYear}`,
            actual: `Class of ${studentGradYear}`,
            passed: gradYearMatches
        });

        if (!gradYearMatches) {
            failureReasons.push(
                `Drive is reserved for Class of ${driveGradYear}; your profile indicates Class of ${studentGradYear}`
            );
        }

        // 5. Branch / Program Match
        const studentProgram = resolveStudentProgram({
            programCode: student.program_code || student.programCode,
            course: student.course,
            branch: student.branch,
            department: student.department
        });
        const eligibleBranches = Array.isArray(drive.eligible_branches || drive.eligibleBranches)
            ? (drive.eligible_branches || drive.eligibleBranches)
            : [];
        const targetProgramCodes = getDriveProgramCodes(drive);
        const isAllBranches = targetProgramCodes.length === 13;
        const branchMatches = studentMatchesDriveProgram(student, drive);
        const requiredPrograms = isAllBranches
            ? "All approved programs"
            : targetProgramCodes.length
            ? targetProgramCodes.map((code) => resolveStudentProgram({ programCode: code })?.name || code).join(", ")
            : eligibleBranches.join(", ");

        criteriaBreakdown.push({
            criterion: "Department / Branch",
            required: requiredPrograms || "No approved programs configured",
            actual: studentProgram?.name || student.branch || student.department || "Unknown",
            passed: branchMatches
        });

        if (!branchMatches) {
            failureReasons.push(
                `Your academic program (${studentProgram?.name || student.branch || student.department || "unknown"}) is not in the eligible programs list (${requiredPrograms || "none"})`
            );
        }

        // 6. CGPA Cutoff Evaluation
        const shouldCheckCgpa = (drive.check_cgpa ?? drive.checkCgpa) !== false;
        const minCGPA = Number(drive.minimum_cgpa ?? drive.minimumCGPA) || 0;
        if (shouldCheckCgpa && minCGPA > 0) {
            const cgpaPassed = (studentCGPA || 0) >= minCGPA;
            criteriaBreakdown.push({
                criterion: "CGPA Score",
                required: `>= ${minCGPA.toFixed(2)}`,
                actual: (studentCGPA || 0).toFixed(2),
                passed: cgpaPassed
            });

            if (!cgpaPassed) {
                failureReasons.push(
                    `Current CGPA (${(studentCGPA || 0).toFixed(2)}) is below minimum required (${minCGPA.toFixed(2)})`
                );
            }
        }

        // 7. Active Backlogs Evaluation
        const shouldCheckBacklogs = (drive.check_backlogs ?? drive.checkBacklogs) !== false;
        if (shouldCheckBacklogs) {
            const maxAllowedBacklogs = Number(drive.maximum_backlogs ?? drive.maximumBacklogs) || 0;
            const backlogsPassed = (studentActiveBacklogs || 0) <= maxAllowedBacklogs;

            criteriaBreakdown.push({
                criterion: "Active Backlogs",
                required: `<= ${maxAllowedBacklogs} backlogs`,
                actual: `${studentActiveBacklogs || 0} active backlogs`,
                passed: backlogsPassed
            });

            if (!backlogsPassed) {
                failureReasons.push(
                    `Active backlogs (${studentActiveBacklogs || 0}) exceed maximum allowed (${maxAllowedBacklogs})`
                );
            }
        }

        // 8. 10th Cutoff
        if (requiresTenthCheck) {
            const minTenth = Number(drive.minimum_tenth_percentage ?? drive.minimumTenthPercentage) || 0;
            const tenthPassed = (studentTenth || 0) >= minTenth;

            criteriaBreakdown.push({
                criterion: "10th Standard Cutoff",
                required: `>= ${minTenth}%`,
                actual: `${studentTenth || 0}%`,
                passed: tenthPassed
            });

            if (!tenthPassed) {
                failureReasons.push(
                    `10th percentage (${studentTenth || 0}%) is below minimum required (${minTenth}%)`
                );
            }
        }

        // 9. 12th Cutoff
        if (requiresTwelfthCheck) {
            const minTwelfth = Number(drive.minimum_twelfth_percentage ?? drive.minimumTwelfthPercentage) || 0;
            const twelfthPassed = (studentTwelfth || 0) >= minTwelfth;

            criteriaBreakdown.push({
                criterion: "12th / Diploma Cutoff",
                required: `>= ${minTwelfth}%`,
                actual: `${studentTwelfth || 0}%`,
                passed: twelfthPassed
            });

            if (!twelfthPassed) {
                failureReasons.push(
                    `12th / Diploma percentage (${studentTwelfth || 0}%) is below minimum required (${minTwelfth}%)`
                );
            }
        }

        // 10. Education Gaps
        const checkEducationGaps = drive.check_education_gaps ?? drive.checkEducationGaps;
        if (checkEducationGaps) {
            const gapsList = student.education_gaps || student.educationGaps;
            const studentHasGap = Boolean(
                student.has_education_gap || student.hasEducationGap ||
                (Array.isArray(gapsList) && gapsList.length > 0)
            );
            let totalGapYears = 0;
            if (Array.isArray(gapsList) && gapsList.length > 0) {
                totalGapYears = gapsList.reduce((sum: number, g: any) => {
                    if (g.durationMonths) return sum + (g.durationMonths / 12);
                    if (g.startYear && g.endYear && g.endYear >= g.startYear) return sum + Math.max(1, g.endYear - g.startYear);
                    return sum + 1;
                }, 0);
                totalGapYears = Math.round(totalGapYears * 10) / 10;
            } else if (studentHasGap) {
                totalGapYears = 1;
            }

            const allowsGaps = (drive.allow_education_gaps ?? drive.allowEducationGaps) !== false;
            const maxAllowedGapYears = Number(drive.max_education_gap_years ?? drive.maxEducationGapYears) || 0;
            let gapPassed = true;
            let gapReason = "";

            if (studentHasGap) {
                if (!allowsGaps) {
                    gapPassed = false;
                    gapReason = "Education gaps are not permitted for this placement drive";
                } else if (totalGapYears > maxAllowedGapYears) {
                    gapPassed = false;
                    gapReason = `Total education gap (${totalGapYears} year(s)) exceeds allowed threshold (${maxAllowedGapYears} year(s))`;
                }
            }

            criteriaBreakdown.push({
                criterion: "Education Gap Check",
                required: !allowsGaps ? "No education gaps permitted" : `Max ${maxAllowedGapYears} year(s) gap allowed`,
                actual: studentHasGap ? `${totalGapYears} year(s) gap declared` : "No education gaps",
                passed: gapPassed
            });

            if (!gapPassed) {
                failureReasons.push(gapReason);
            }
        }

        // 11. Historical Backlogs Limit
        const maxHistRaw = drive.maximum_historical_backlogs ?? drive.maximumHistoricalBacklogs;
        if (maxHistRaw != null && maxHistRaw >= 0) {
            const maxHist = Number(maxHistRaw);
            const histPassed = studentHistBacklogs <= maxHist;

            criteriaBreakdown.push({
                criterion: "Historical Backlogs Ledger",
                required: `<= ${maxHist} historical backlogs`,
                actual: `${studentHistBacklogs} historical backlogs`,
                passed: histPassed
            });

            if (!histPassed) {
                failureReasons.push(
                    `Historical backlogs count (${studentHistBacklogs}) exceeds allowed threshold (${maxHist})`
                );
            }
        }

        const isEligible = failureReasons.length === 0;

        return {
            status: isEligible ? EligibilityStatus.ELIGIBLE : EligibilityStatus.INELIGIBLE,
            isEligible,
            summary: isEligible
                ? "Eligible: Meets all academic, cohort, and document requirements"
                : "Ineligible for this placement drive",
            reasons: failureReasons,
            missingFields: [],
            criteriaBreakdown
        };
    }
}
