import { PROGRAM_CATALOG, resolveProgram, resolveStudentProgram } from "../constants/programCatalog.js";

export const getDriveProgramCodes = (drive: any): string[] => {
    if (!drive) return [];
    if (Array.isArray(drive.eligible_program_codes) && drive.eligible_program_codes.length > 0) {
        return drive.eligible_program_codes;
    }
    if (Array.isArray(drive.eligibleProgramCodes) && drive.eligibleProgramCodes.length > 0) {
        return drive.eligibleProgramCodes;
    }

    const branches = Array.isArray(drive.eligible_branches)
        ? drive.eligible_branches
        : Array.isArray(drive.eligibleBranches)
        ? drive.eligibleBranches
        : [];

    const codes = new Set<string>();
    for (const b of branches) {
        const p = resolveProgram(b);
        if (p) codes.add(p.code);
    }
    return Array.from(codes);
};

export const studentMatchesDriveProgram = (student: any, drive: any): boolean => {
    if (!student || !drive) return false;

    const studentProg = resolveStudentProgram({
        programCode: student.program_code || student.programCode,
        branch: student.branch,
        department: student.department,
        course: student.course,
        degreeType: student.degree_type || student.degreeType
    });

    if (!studentProg) return false;

    const driveProgramCodes = getDriveProgramCodes(drive);
    if (driveProgramCodes.length === 0) {
        // Fallback to checking branch strings
        const branches = drive.eligible_branches || drive.eligibleBranches || [];
        return branches.includes(studentProg.name) || branches.includes(student.branch);
    }

    return driveProgramCodes.includes(studentProg.code);
};
