const sequelize = require('../config/database');
const User = require('./User');
const Course = require('./Course');
const Enrollment = require('./Enrollment');
const Material = require('./Material');
const Assignment = require('./Assignment');
const Submission = require('./Submission');
const Quiz = require('./Quiz');
const QuizQuestion = require('./QuizQuestion');
const QuizAttempt = require('./QuizAttempt');
const Exam = require('./Exam');
const Room = require('./Room');
const AuditLog = require('./AuditLog');

// Associations
Course.belongsTo(User, { as: 'lecturer', foreignKey: 'lecturer_id' });
Course.hasMany(Enrollment, { foreignKey: 'course_id' });
Course.hasMany(Material, { foreignKey: 'course_id' });
Course.hasMany(Assignment, { foreignKey: 'course_id' });
Course.hasMany(Quiz, { foreignKey: 'course_id' });
Course.hasMany(Exam, { foreignKey: 'course_id' });
Course.hasMany(Room, { foreignKey: 'course_id' });

User.hasMany(Enrollment, { foreignKey: 'student_id' });
Enrollment.belongsTo(User, { foreignKey: 'student_id' });
Enrollment.belongsTo(Course, { foreignKey: 'course_id' });

Assignment.hasMany(Submission, { foreignKey: 'assignment_id' });
Submission.belongsTo(Assignment, { foreignKey: 'assignment_id' });
Submission.belongsTo(User, { as: 'student', foreignKey: 'student_id' });

Quiz.hasMany(QuizQuestion, { foreignKey: 'quiz_id' });
Quiz.hasMany(QuizAttempt, { foreignKey: 'quiz_id' });
QuizQuestion.belongsTo(Quiz, { foreignKey: 'quiz_id' });
QuizAttempt.belongsTo(Quiz, { foreignKey: 'quiz_id' });
QuizAttempt.belongsTo(User, { as: 'student', foreignKey: 'student_id' });

module.exports = {
  sequelize,
  User, Course, Enrollment, Material,
  Assignment, Submission, Quiz, QuizQuestion,
  QuizAttempt, Exam, Room, AuditLog
};
