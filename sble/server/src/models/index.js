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
const LiveClassSession = require('./LiveClassSession');
const LiveClassAttendance = require('./LiveClassAttendance');
const Discussion = require('./Discussion');
const Announcement = require('./Announcement');
const CourseModule = require('./CourseModule');
const CourseModuleItem = require('./CourseModuleItem');
const CalendarCustomEvent = require('./CalendarCustomEvent');
const AuditLog = require('./AuditLog');

// Associations
Course.belongsTo(User, { as: 'lecturer', foreignKey: 'lecturer_id' });
Course.hasMany(Enrollment, { foreignKey: 'course_id', onDelete: 'CASCADE', hooks: true });
Course.hasMany(Material, { foreignKey: 'course_id' });
Course.hasMany(Assignment, { foreignKey: 'course_id' });
Course.hasMany(Quiz, { foreignKey: 'course_id' });
Course.hasMany(Exam, { foreignKey: 'course_id' });
Exam.belongsTo(Course, { foreignKey: 'course_id' });
Course.hasMany(Room, { foreignKey: 'course_id' });
Room.belongsTo(Course, { foreignKey: 'course_id' });
Room.hasMany(LiveClassSession, { foreignKey: 'room_id' });
LiveClassSession.belongsTo(Room, { foreignKey: 'room_id' });
LiveClassSession.hasMany(LiveClassAttendance, { foreignKey: 'session_id' });
LiveClassAttendance.belongsTo(LiveClassSession, { foreignKey: 'session_id' });
LiveClassAttendance.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Course.hasMany(Discussion, { foreignKey: 'course_id' });
Discussion.belongsTo(Course, { foreignKey: 'course_id' });
Course.hasMany(Announcement, { foreignKey: 'course_id' });
Announcement.belongsTo(Course, { foreignKey: 'course_id' });
Announcement.belongsTo(User, { as: 'author', foreignKey: 'author_id' });

Course.hasMany(CourseModule, { foreignKey: 'course_id', onDelete: 'CASCADE', hooks: true });
CourseModule.belongsTo(Course, { foreignKey: 'course_id' });
CourseModule.hasMany(CourseModuleItem, { as: 'items', foreignKey: 'module_id', onDelete: 'CASCADE', hooks: true });
CourseModuleItem.belongsTo(CourseModule, { foreignKey: 'module_id' });

CourseModule.hasMany(Material, { foreignKey: 'module_id' });
CourseModule.hasMany(Assignment, { foreignKey: 'module_id' });
CourseModule.hasMany(Quiz, { foreignKey: 'module_id' });
CourseModule.hasMany(Exam, { foreignKey: 'module_id' });
Material.belongsTo(CourseModule, { foreignKey: 'module_id' });
Assignment.belongsTo(CourseModule, { foreignKey: 'module_id' });
Quiz.belongsTo(CourseModule, { foreignKey: 'module_id' });
Exam.belongsTo(CourseModule, { foreignKey: 'module_id' });

Course.hasMany(CalendarCustomEvent, { foreignKey: 'course_id', onDelete: 'CASCADE', hooks: true });
CalendarCustomEvent.belongsTo(Course, { foreignKey: 'course_id' });

User.hasMany(Enrollment, { as: 'enrollments', foreignKey: 'student_id', onDelete: 'CASCADE' });
Enrollment.belongsTo(User, { as: 'student', foreignKey: 'student_id', onDelete: 'CASCADE' });
Enrollment.belongsTo(Course, { foreignKey: 'course_id', onDelete: 'CASCADE' });
User.hasMany(Discussion, { as: 'discussions', foreignKey: 'user_id' });
Discussion.belongsTo(User, { as: 'author', foreignKey: 'user_id' });
Discussion.belongsTo(Discussion, { as: 'parent', foreignKey: 'parent_id' });
Discussion.hasMany(Discussion, { as: 'replies', foreignKey: 'parent_id' });

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
  QuizAttempt, Exam, Room, LiveClassSession, LiveClassAttendance, Discussion, Announcement,
  CourseModule, CourseModuleItem, CalendarCustomEvent, AuditLog
};
