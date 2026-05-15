const { Op } = require('sequelize');
const { Announcement, Discussion, Room, Course, Enrollment, User } = require('../../models');

const isLecturerRole = (role) => role === 'lecturer' || role === 'admin';

function announcementVisibilityWhere(role) {
  if (isLecturerRole(role)) {
    return {};
  }
  const now = new Date();
  return {
    is_hidden: false,
    [Op.or]: [
      { publish_at: null },
      { publish_at: { [Op.lte]: now } }
    ]
  };
}

function buildDiscussionThreads(flat = []) {
  const byId = new Map();
  const roots = [];

  flat.forEach((row) => {
    const item = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
    item.replies = [];
    byId.set(item.id, item);
  });

  flat.forEach((row) => {
    const item = byId.get(row.id);
    if (item.parent_id) {
      const parent = byId.get(item.parent_id);
      if (parent) parent.replies.push(item);
      else roots.push(item);
    } else {
      roots.push(item);
    }
  });

  return roots;
}

async function getCourseCommunicationHub(courseId, { userId, role }) {
  const course = await Course.findByPk(courseId, { attributes: ['id', 'title', 'lecturer_id'] });
  if (!course) {
    const err = new Error('Course not found');
    err.status = 404;
    throw err;
  }

  const announcements = await Announcement.findAll({
    where: { course_id: courseId, ...announcementVisibilityWhere(role) },
    include: [{ model: User, as: 'author', attributes: ['id', 'full_name', 'role'] }],
    order: [['is_pinned', 'DESC'], ['created_at', 'DESC']],
    limit: 20
  });

  const discussionsFlat = await Discussion.findAll({
    where: { course_id: courseId },
    include: [{ model: User, as: 'author', attributes: ['id', 'full_name', 'role'] }],
    order: [['created_at', 'ASC']]
  });

  const threads = buildDiscussionThreads(discussionsFlat);

  const activeRooms = await Room.findAll({
    where: { course_id: courseId, is_active: true },
    attributes: ['id', 'title', 'room_token', 'created_at'],
    order: [['created_at', 'DESC']],
    limit: 5
  });

  const pinnedCount = announcements.filter((a) => a.is_pinned).length;
  const scheduledCount = isLecturerRole(role)
    ? announcements.filter((a) => a.publish_at && new Date(a.publish_at) > new Date()).length
    : 0;

  return {
    course: { id: course.id, title: course.title },
    summary: {
      announcementCount: announcements.length,
      pinnedCount,
      scheduledCount,
      threadCount: threads.length,
      replyCount: discussionsFlat.filter((d) => d.parent_id).length,
      activeLiveClasses: activeRooms.length
    },
    announcements,
    discussions: threads,
    liveNotices: activeRooms.map((room) => ({
      id: room.id,
      title: room.title || 'Live class in session',
      roomToken: room.room_token,
      startedAt: room.created_at
    }))
  };
}

async function notifyCourseStudents(courseId, event, data) {
  const { sendToUser } = require('../notifications/sseService');
  const enrollments = await Enrollment.findAll({
    where: { course_id: courseId },
    attributes: ['student_id']
  });
  enrollments.forEach((row) => {
    sendToUser(row.student_id, event, data);
  });
}

module.exports = {
  announcementVisibilityWhere,
  buildDiscussionThreads,
  getCourseCommunicationHub,
  notifyCourseStudents,
  isLecturerRole
};
