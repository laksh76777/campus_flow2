export const DEFAULT_SELECTION_ROUNDS = [
    { roundNumber: 1, roundName: "Online Assessment / Aptitude Test", status: "in_progress", advancedCount: 0, rejectedCount: 0 },
    { roundNumber: 2, roundName: "Technical Interview Round 1", status: "pending", advancedCount: 0, rejectedCount: 0 },
    { roundNumber: 3, roundName: "Technical Interview Round 2 / Managerial", status: "pending", advancedCount: 0, rejectedCount: 0 },
    { roundNumber: 4, roundName: "HR Interview & Offer Discussion", status: "pending", advancedCount: 0, rejectedCount: 0 }
];

export const DEFAULT_STUDENT_REQUIREMENTS = {
    personalEmail: { requiredToApply: false, visibleToTpo: true, shareWithCompany: true },
    alternatePhone: { requiredToApply: false, visibleToTpo: true, shareWithCompany: true },
    aadharNumber: { requiredToApply: false, visibleToTpo: true, shareWithCompany: false },
    fatherName: { requiredToApply: false, visibleToTpo: true, shareWithCompany: false },
    fatherPhone: { requiredToApply: false, visibleToTpo: true, shareWithCompany: false },
    motherName: { requiredToApply: false, visibleToTpo: true, shareWithCompany: false },
    motherPhone: { requiredToApply: false, visibleToTpo: true, shareWithCompany: false },
    currentAddress: { requiredToApply: false, visibleToTpo: true, shareWithCompany: false },
    permanentAddress: { requiredToApply: false, visibleToTpo: true, shareWithCompany: false },
    tenthDetails: { requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
    twelfthOrDiplomaDetails: { requiredToApply: true, visibleToTpo: true, shareWithCompany: true },
    educationGaps: { requiredToApply: false, visibleToTpo: true, shareWithCompany: true },
    skills: { requiredToApply: false, visibleToTpo: true, shareWithCompany: true },
    certificates: { requiredToApply: false, visibleToTpo: true, shareWithCompany: true }
};

export const LEGAL_TRANSITIONS: Record<string, string[]> = {
    applied: ["shortlisted", "rejected", "on_hold", "withdrawn"],
    shortlisted: ["interview", "rejected", "on_hold", "withdrawn"],
    interview: ["interview", "selected", "offer_received", "rejected", "on_hold", "withdrawn"],
    on_hold: ["shortlisted", "interview", "selected", "rejected", "withdrawn"],
    selected: ["offer_received", "offer_accepted", "offer_declined", "withdrawn"],
    offer_received: ["offer_accepted", "offer_declined", "withdrawn"],
    offer_accepted: ["offer_declined", "withdrawn"],
    offer_declined: ["withdrawn"],
    rejected: ["applied"],
    withdrawn: []
};

export const ELIGIBILITY_RULES_VERSION = 2;
