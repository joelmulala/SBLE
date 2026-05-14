const { Op } = require('sequelize');
const { LiveClassSession, LiveClassAttendance, Room, User, Enrollment, Course } = require('../../models');

const MAX_PING_GAP_SEC = Number(process.env.LIVE_CLASS_MAX_PING_GAP_SEC || 90);
const LATE_AFTER_MIN = Number(process.env.ATTENDANCE_LATE_AFTER_MIN || 10);
const PARTIAL_RATIO = Number(process.env.ATTENDANCE_PARTIAL_RATIO || 0.45);
const LEFT_EARLY_MIN = Number(process.env.ATTENDANCE_LEFT_EARLY_MIN || 8);

function safeJsonParse(s) {
  if (!s || typeof s !== 'string') return null;
  try {
    return JSON.parse(s);
  } catch (_) {
    return null;
  }
}

function mergeParticipation(prevObj, metrics) {
  const o = prevObj && typeof prevObj === 'object' ? { ...prevObj } : {
    pings: 0,
    raisedHandPings: 0,
    questionPings: 0,
    screenSharePings: 0,
    speakingPings: 0
  };
  o.pings = (o.pings || 0) + 1;
  if (metrics?.raisedHand) o.raisedHandPings = (o.raisedHandPings || 0) + 1;
  if (metrics?.hasQuestion) o.questionPings = (o.questionPings || 0) + 1;
  if (metrics?.screenSharing) o.screenSharePings = (o.screenSharePings || 0) + 1;
  if (metrics?.speaking) o.speakingPings = (o.speakingPings || 0) + 1;
  return o;
}

/**
 * @param {import('../models/Room')} room
 */
async function ensureOpenSession(room) {
  let session = await LiveClassSession.findOne({
    where: { room_id: room.id, ended_at: { [Op.is]: null } }
  });
  if (session) return session;
  try {
    session = await LiveClassSession.create({
      room_id: room.id,
      course_id: room.course_id,
      started_at: new Date()
    });
    return session;
  } catch (_) {
    session = await LiveClassSession.findOne({
      where: { room_id: room.id, ended_at: { [Op.is]: null } }
    });
    if (session) return session;
    throw new Error('Could not create live class session');
  }
}

function computeStatus({ firstJoinedAt, sessionStart, sessionEnd, cumulativeSeconds, lastLeftAt }) {
  const startMs = new Date(sessionStart).getTime();
  const endMs = new Date(sessionEnd).getTime();
  const sessionDurSec = Math.max(60, Math.floor((endMs - startMs) / 1000));
  const ratio = cumulativeSeconds / sessionDurSec;

  if (ratio < PARTIAL_RATIO) return 'partial_attendance';

  const lateThreshold = startMs + LATE_AFTER_MIN * 60 * 1000;
  if (new Date(firstJoinedAt).getTime() > lateThreshold) return 'late';

  if (lastLeftAt && endMs - new Date(lastLeftAt).getTime() > LEFT_EARLY_MIN * 60 * 1000) {
    return 'left_early';
  }

  return 'present';
}

/**
 * @param {import('../models/LiveClassAttendance')} row
 * @param {Date} endTime
 */
function applyFinalPingDelta(row, endTime) {
  if (!row.last_ping_at) return row.cumulative_seconds || 0;
  const deltaMs = endTime.getTime() - new Date(row.last_ping_at).getTime();
  const sec = Math.min(MAX_PING_GAP_SEC, Math.max(0, Math.floor(deltaMs / 1000)));
  return (row.cumulative_seconds || 0) + sec;
}

/**
 * @param {import('../models/Room')} room
 */
async function finalizeSessionForRoom(room) {
  const session = await LiveClassSession.findOne({
    where: { room_id: room.id, ended_at: { [Op.is]: null } }
  });
  if (!session) return null;

  const endTime = new Date();
  await session.update({ ended_at: endTime });
  session.setDataValue('ended_at', endTime);

  const rows = await LiveClassAttendance.findAll({
    where: { session_id: session.id },
    include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email'], required: false }]
  });

  for (const row of rows) {
    const cum = applyFinalPingDelta(row, endTime);
    const lastLeft = row.last_left_at || endTime;
    const status = computeStatus({
      firstJoinedAt: row.first_joined_at,
      sessionStart: session.started_at,
      sessionEnd: endTime,
      cumulativeSeconds: cum,
      lastLeftAt: lastLeft
    });
    await row.update({
      cumulative_seconds: cum,
      last_left_at: lastLeft,
      last_ping_at: row.last_ping_at,
      computed_status: status
    });
  }

  const refreshed = await LiveClassAttendance.findAll({
    where: { session_id: session.id },
    include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email'], required: false }]
  });

  const summary = buildSessionSummary(session, refreshed);
  await session.update({ summary_json: JSON.stringify(summary) });
  return summary;
}

function buildSessionSummary(session, attendanceRows) {
  const presenters = attendanceRows.filter((r) => {
    const p = safeJsonParse(r.participation_json);
    return (p?.screenSharePings || 0) > 0;
  }).length;

  return {
    sessionId: session.id,
    roomId: session.room_id,
    courseId: session.course_id,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    totalParticipants: attendanceRows.length,
    attendance: attendanceRows.map((r) => ({
      userId: r.user_id,
      name: r.user?.full_name || null,
      email: r.user?.email || null,
      role: r.role,
      firstJoinedAt: r.first_joined_at,
      lastLeftAt: r.last_left_at,
      cumulativeSeconds: r.cumulative_seconds,
      computedStatus: r.computed_status,
      participation: safeJsonParse(r.participation_json)
    })),
    participationOverview: {
      withRaisedHandSamples: attendanceRows.filter((r) => {
        const p = safeJsonParse(r.participation_json);
        return (p?.raisedHandPings || 0) > 0;
      }).length,
      withQuestionSamples: attendanceRows.filter((r) => {
        const p = safeJsonParse(r.participation_json);
        return (p?.questionPings || 0) > 0;
      }).length,
      distinctPresenters: presenters,
      withSpeakingSamples: attendanceRows.filter((r) => {
        const p = safeJsonParse(r.participation_json);
        return (p?.speakingPings || 0) > 0;
      }).length
    },
    rules: {
      lateAfterMinutes: LATE_AFTER_MIN,
      partialAttendanceBelowRatio: PARTIAL_RATIO,
      leftEarlyIfLeftMinutesBeforeEnd: LEFT_EARLY_MIN
    }
  };
}

/**
 * @param {object} params
 * @param {import('../models/Room')} params.room
 * @param {object} params.user
 * @param {string} params.role lecturer|student|admin
 * @param {object} [params.metrics]
 */
async function recordPing({ room, user, role, metrics }) {
  const session = await ensureOpenSession(room);
  const now = new Date();

  let row = await LiveClassAttendance.findOne({
    where: { session_id: session.id, user_id: user.id }
  });

  const enrollment = role === 'student'
    ? await Enrollment.findOne({ where: { course_id: room.course_id, student_id: user.id } })
    : null;

  if (!row) {
    const part = mergeParticipation(null, metrics);
    row = await LiveClassAttendance.create({
      session_id: session.id,
      user_id: user.id,
      role: role === 'admin' ? 'admin' : role === 'lecturer' ? 'lecturer' : 'student',
      enrollment_id: enrollment?.id || null,
      first_joined_at: now,
      last_ping_at: now,
      cumulative_seconds: 0,
      participation_json: JSON.stringify(part)
    });
    return { sessionId: session.id, cumulativeSeconds: 0, firstJoin: true };
  }

  let addSec = 0;
  if (row.last_ping_at) {
    const deltaMs = now.getTime() - new Date(row.last_ping_at).getTime();
    addSec = Math.min(MAX_PING_GAP_SEC, Math.max(0, Math.floor(deltaMs / 1000)));
  }

  const nextCum = (row.cumulative_seconds || 0) + addSec;
  const part = mergeParticipation(safeJsonParse(row.participation_json), metrics);

  await row.update({
    cumulative_seconds: nextCum,
    last_ping_at: now,
    participation_json: JSON.stringify(part),
    last_left_at: null
  });

  return { sessionId: session.id, cumulativeSeconds: nextCum, firstJoin: false };
}

/**
 * @param {import('../models/Room')} room
 * @param {object} user
 */
async function recordLeave({ room, user }) {
  const session = await LiveClassSession.findOne({
    where: { room_id: room.id, ended_at: { [Op.is]: null } }
  });
  if (!session) return;

  const row = await LiveClassAttendance.findOne({
    where: { session_id: session.id, user_id: user.id }
  });
  if (!row) return;

  const now = new Date();
  const cum = applyFinalPingDelta(row, now);
  await row.update({
    cumulative_seconds: cum,
    last_left_at: now,
    last_ping_at: row.last_ping_at
  });
}

/**
 * @param {import('../models/Room')} room
 */
async function getOpenSessionSummaryForLecturer(room) {
  const session = await LiveClassSession.findOne({
    where: { room_id: room.id },
    order: [['id', 'DESC']]
  });
  if (!session) return null;

  if (session.summary_json) {
    try {
      return JSON.parse(session.summary_json);
    } catch (_) {
      /* fall through */
    }
  }

  const rows = await LiveClassAttendance.findAll({
    where: { session_id: session.id },
    include: [{ model: User, as: 'user', attributes: ['id', 'full_name', 'email'], required: false }]
  });
  return buildSessionSummary(session, rows);
}

/**
 * Live “seated” count: ping within stale window.
 * @param {import('../models/Room')} room
 */
async function getLiveMetrics(room) {
  const session = await LiveClassSession.findOne({
    where: { room_id: room.id, ended_at: { [Op.is]: null } }
  });
  if (!session) {
    return { sessionActive: false, presentApprox: 0 };
  }

  const staleBefore = new Date(Date.now() - (MAX_PING_GAP_SEC + 30) * 1000);
  const rows = await LiveClassAttendance.findAll({ where: { session_id: session.id } });

  let presentApprox = 0;
  for (const r of rows) {
    if (r.last_ping_at && new Date(r.last_ping_at) > staleBefore) {
      presentApprox += 1;
    }
  }

  return {
    sessionActive: true,
    sessionId: session.id,
    presentApprox
  };
}

module.exports = {
  ensureOpenSession,
  finalizeSessionForRoom,
  recordPing,
  recordLeave,
  getOpenSessionSummaryForLecturer,
  getLiveMetrics,
  buildSessionSummary,
  computeStatus,
  ATTENDANCE_RULES: {
    lateAfterMinutes: LATE_AFTER_MIN,
    partialAttendanceBelowRatio: PARTIAL_RATIO,
    leftEarlyIfLeftMinutesBeforeEnd: LEFT_EARLY_MIN,
    maxPingGapSec: MAX_PING_GAP_SEC
  }
};
