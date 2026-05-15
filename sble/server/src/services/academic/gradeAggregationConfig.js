/**
 * Formal assessment categories for course grade aggregation.
 * Weights apply to gradable categories; placeholders reserve structure for future scoring.
 */
const ASSESSMENT_CATEGORIES = {
  assignments: {
    key: 'assignments',
    label: 'Assignments',
    weight: 0.4,
    gradable: true,
    visibleToStudent: true
  },
  quizzes: {
    key: 'quizzes',
    label: 'Quizzes',
    weight: 0.2,
    gradable: true,
    visibleToStudent: true
  },
  exams: {
    key: 'exams',
    label: 'Exams',
    weight: 0.25,
    gradable: false,
    placeholder: true,
    visibleToStudent: true
  },
  participation: {
    key: 'participation',
    label: 'Participation',
    weight: 0.1,
    gradable: false,
    placeholder: true,
    visibleToStudent: false
  },
  attendance: {
    key: 'attendance',
    label: 'Attendance',
    weight: 0.05,
    gradable: false,
    placeholder: true,
    visibleToStudent: true
  }
};

const GRADE_STATES = Object.freeze({
  MISSING: 'missing',
  UNGRADED: 'ungraded',
  GRADED: 'graded',
  LATE: 'late',
  EXCUSED: 'excused',
  IN_PROGRESS: 'in_progress',
  RELEASED: 'released',
  NOT_APPLICABLE: 'not_applicable'
});

const LETTER_SCALE = [
  { min: 75, letter: 'A', status: 'excellent' },
  { min: 60, letter: 'B', status: 'good' },
  { min: 50, letter: 'C', status: 'satisfactory' },
  { min: 40, letter: 'D', status: 'at_risk' },
  { min: 0, letter: 'F', status: 'failing' }
];

function getCategoryWeights() {
  return Object.fromEntries(
    Object.entries(ASSESSMENT_CATEGORIES).map(([key, cat]) => [key, cat.weight])
  );
}

function getGradableCategories() {
  return Object.values(ASSESSMENT_CATEGORIES).filter((c) => c.gradable);
}

module.exports = {
  ASSESSMENT_CATEGORIES,
  GRADE_STATES,
  LETTER_SCALE,
  getCategoryWeights,
  getGradableCategories
};
