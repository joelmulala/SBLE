/* eslint-disable no-console */
/**
 * Full lecturer + student workflow smoke test.
 * Run: node scripts/smoke-e2e-full.js
 * Cleanup: node scripts/cleanup-smoke-data.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');

const API_BASE = process.env.VERIFY_API_BASE || 'http://localhost:5000/api';
const RUN_ID = `SMOKE_${Date.now()}`;
const REPORT_FILE = path.join(__dirname, '..', 'logs', `smoke-e2e-${RUN_ID}.json`);

const passwords = {
  admin: process.env.TEMP_ADMIN_PASSWORD || 'admin123',
  lecturer: process.env.TEMP_LECTURER_PASSWORD || 'lecturer123',
  student: process.env.TEMP_STUDENT_PASSWORD || 'student123'
};

const state = {
  runId: RUN_ID,
  created: {},
  results: []
};

const unwrap = (payload) => {
  if (payload && typeof payload === 'object' && 'data' in payload && 'success' in payload) {
    return payload.data;
  }
  return payload;
};

const http = async (method, pathName, { token, json, formData, allowStatuses } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }
  if (formData !== undefined) body = formData;

  const res = await fetch(`${API_BASE}${pathName}`, { method, headers, body });
  const ct = res.headers.get('content-type') || '';
  const payload = ct.includes('application/json') ? await res.json() : await res.text();
  const data = unwrap(payload);

  if (allowStatuses && !allowStatuses.includes(res.status)) {
    throw new Error(`${method} ${pathName} -> ${res.status}: ${JSON.stringify(payload)}`);
  }

  return { status: res.status, ok: res.ok, payload, data };
};

const step = async (section, title, fn) => {
  const t0 = Date.now();
  try {
    const detail = await fn();
    const row = { section, title, status: 'PASS', ms: Date.now() - t0, detail: detail ?? null };
    state.results.push(row);
    console.log(`[PASS] [${section}] ${title}`);
    return detail;
  } catch (err) {
    const row = { section, title, status: 'FAIL', ms: Date.now() - t0, error: err.message };
    state.results.push(row);
    console.log(`[FAIL] [${section}] ${title} — ${err.message}`);
    return null;
  }
};

const login = async (email, password) => {
  const res = await http('POST', '/auth/login', {
    json: { email, password },
    allowStatuses: [200]
  });
  if (!res.data?.token) throw new Error(`Login failed for ${email}`);
  return { token: res.data.token, user: res.data.user };
};

const fileForm = (fields, filename, mime, text) => {
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, String(v)));
  form.append('file', new Blob([text], { type: mime }), filename);
  return form;
};

const run = async () => {
  console.log(`\n=== SBLE Full Smoke Test ${RUN_ID} ===\n`);

  let admin;
  let lecturer;
  let student;
  let lecturerUser;
  let studentUser;

  await step('Setup', 'API health', async () => {
    const res = await http('GET', '/health', { allowStatuses: [200, 503] });
    if (res.data?.database !== 'up') throw new Error('Database not up');
    return res.data;
  });

  admin = await step('Setup', 'Admin login', () => login('admin1@sble.local', passwords.admin));

  const users = await step('Setup', 'Resolve lecturer and student accounts', async () => {
    const res = await http('GET', '/users', { token: admin.token, allowStatuses: [200] });
    const list = Array.isArray(res.data) ? res.data : [];
    lecturerUser = list.find((u) => u.role === 'lecturer');
    studentUser = list.find((u) => u.role === 'student');
    if (!lecturerUser?.email) throw new Error('No lecturer user in database');
    if (!studentUser?.email) throw new Error('No student user in database');
    return { lecturer: lecturerUser.email, student: studentUser.email };
  });

  lecturer = await step('Lecturer', 'Login', () => login(lecturerUser.email, passwords.lecturer));
  student = await step('Student', 'Login', () => login(studentUser.email, passwords.student));

  const course = await step('Lecturer', 'Create course', async () => {
    const res = await http('POST', '/courses', {
      token: lecturer.token,
      json: {
        title: `${RUN_ID} Introduction to Secure Systems`,
        description: 'Automated smoke test course — delete after run'
      },
      allowStatuses: [201]
    });
    state.created.courseId = res.data.id;
    return res.data;
  });

  await step('Lecturer', 'Enroll student', async () => {
    const id = studentUser.student_id || studentUser.id;
    const res = await http('POST', `/courses/${course.id}/enroll`, {
      token: lecturer.token,
      json: { student_id: id },
      allowStatuses: [201, 409]
    });
    return res.status;
  });

  await step('Lecturer', 'List enrollments', async () => {
    const res = await http('GET', `/courses/${course.id}/enrollments`, {
      token: lecturer.token,
      allowStatuses: [200]
    });
    if (!Array.isArray(res.data) || res.data.length < 1) throw new Error('No enrollments');
    return res.data.length;
  });

  const material = await step('Lecturer', 'Upload material', async () => {
    const res = await http('POST', '/materials/upload', {
      token: lecturer.token,
      formData: fileForm(
        { courseId: course.id, title: `${RUN_ID} Lecture notes` },
        'notes.pdf',
        'application/pdf',
        '%PDF-1.4 smoke test material'
      ),
      allowStatuses: [201]
    });
    state.created.materialId = res.data.id;
    return res.data;
  });

  await step('Student', 'List course materials', async () => {
    const res = await http('GET', `/materials/course/${course.id}`, {
      token: student.token,
      allowStatuses: [200]
    });
    const found = (res.data || []).some((m) => m.id === material.id);
    if (!found) throw new Error('Uploaded material not visible to student');
    return res.data.length;
  });

  await step('Student', 'Download material', async () => {
    const res = await fetch(`${API_BASE}/materials/${material.id}/download`, {
      headers: { Authorization: `Bearer ${student.token}` }
    });
    if (!res.ok) throw new Error(`Download ${res.status}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 1) throw new Error('Empty download');
    return buf.byteLength;
  });

  const assignment = await step('Lecturer', 'Create assignment', async () => {
    const due = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await http('POST', '/assignments', {
      token: lecturer.token,
      json: {
        courseId: course.id,
        title: `${RUN_ID} Essay`,
        description: 'Smoke test assignment',
        due_date: due,
        allows_handwritten: true
      },
      allowStatuses: [201]
    });
    state.created.assignmentId = res.data.id;
    return res.data;
  });

  const submission = await step('Student', 'Submit assignment', async () => {
    const res = await http('POST', `/assignments/${assignment.id}/submit`, {
      token: student.token,
      formData: fileForm(
        { submission_type: 'typed' },
        'essay.pdf',
        'application/pdf',
        'Smoke submission content'
      ),
      allowStatuses: [200, 201]
    });
    state.created.submissionId = res.data?.id;
    return res.data;
  });

  await step('Lecturer', 'Grade assignment', async () => {
    const res = await http('PATCH', `/assignments/submissions/${submission.id}/grade`, {
      token: lecturer.token,
      json: { grade: 88, feedback: 'Smoke test grade', publish: true },
      allowStatuses: [200]
    });
    return res.data?.grading_status || res.data?.grade;
  });

  const quiz = await step('Lecturer', 'Create and publish quiz', async () => {
    const createRes = await http('POST', '/quizzes', {
      token: lecturer.token,
      json: {
        course_id: course.id,
        title: `${RUN_ID} Quiz`,
        duration_minutes: 30,
        questions: [{
          question_text: '1 + 1 = ?',
          question_type: 'mcq',
          options: ['1', '2', '3'],
          correct_answer: '2',
          marks: 1
        }]
      },
      allowStatuses: [201]
    });
    const quizId = createRes.data.id;
    state.created.quizId = quizId;

    const start = new Date();
    const end = new Date(Date.now() + 2 * 60 * 60 * 1000);
    await http('PATCH', `/quizzes/${quizId}/publish`, {
      token: lecturer.token,
      json: {
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        duration_minutes: 30
      },
      allowStatuses: [200]
    });

    return { quizId };
  });

  await step('Student', 'Take quiz (submit attempt)', async () => {
    const openRes = await http('GET', `/quizzes/${quiz.quizId}`, {
      token: student.token,
      allowStatuses: [200, 403]
    });

    if (openRes.status === 403 && openRes.data?.error?.includes('expired')) {
      throw new Error(`Quiz window bug: ${openRes.data.error} (expires_at may be in the past)`);
    }

    const questions = openRes.data?.QuizQuestions || [];
    if (!questions.length) throw new Error('No questions on quiz open');

    const qid = questions[0].id;
    const attemptRes = await http('POST', `/quizzes/${quiz.quizId}/attempt`, {
      token: student.token,
      json: { answers: { [qid]: '2' } },
      allowStatuses: [201, 403]
    });

    if (attemptRes.status === 403) {
      const msg = attemptRes.payload?.message || attemptRes.data?.error || 'blocked';
      if (String(msg).includes('expired') || String(msg).includes('already')) {
        throw new Error(`Quiz attempt blocked: ${msg}`);
      }
    }

    state.created.quizAttemptId = attemptRes.data?.attempt?.id;
    return { score: attemptRes.data?.grading?.score, status: attemptRes.status };
  });

  const exam = await step('Lecturer', 'Upload and release exam', async () => {
    const uploadRes = await http('POST', '/exams/upload', {
      token: lecturer.token,
      formData: fileForm(
        { courseId: course.id, title: `${RUN_ID} Final exam` },
        'exam.pdf',
        'application/pdf',
        '%PDF-1.4 exam'
      ),
      allowStatuses: [201]
    });
    const examId = uploadRes.data.id;
    state.created.examId = examId;

    await http('PATCH', `/exams/${examId}/release`, {
      token: lecturer.token,
      json: {
        start_time: new Date().toISOString(),
        duration_minutes: 120
      },
      allowStatuses: [200]
    });

    return { examId };
  });

  await step('Student', 'List released exams', async () => {
    const res = await http('GET', `/exams/course/${course.id}`, {
      token: student.token,
      allowStatuses: [200]
    });
    const found = (res.data || []).some((e) => e.id === exam.examId);
    if (!found) throw new Error('Released exam not visible');
    return res.data.length;
  });

  const announcement = await step('Lecturer', 'Post announcement', async () => {
    const res = await http('POST', `/announcements/course/${course.id}`, {
      token: lecturer.token,
      formData: (() => {
        const f = new FormData();
        f.append('title', `${RUN_ID} Welcome`);
        f.append('body', 'Smoke test announcement body');
        return f;
      })(),
      allowStatuses: [201]
    });
    state.created.announcementId = res.data.id;
    return res.data;
  });

  await step('Student', 'Read course announcements', async () => {
    const res = await http('GET', `/announcements/course/${course.id}`, {
      token: student.token,
      allowStatuses: [200]
    });
    const found = (res.data || []).some((a) => a.id === announcement.id);
    if (!found) throw new Error('Announcement not visible');
    return res.data.length;
  });

  const discussion = await step('Student', 'Post discussion', async () => {
    const res = await http('POST', `/courses/${course.id}/discussions`, {
      token: student.token,
      json: { message: `${RUN_ID} discussion post` },
      allowStatuses: [201]
    });
    state.created.discussionId = res.data.id;
    return res.data;
  });

  await step('Lecturer', 'View discussions', async () => {
    const res = await http('GET', `/courses/${course.id}/discussions`, {
      token: lecturer.token,
      allowStatuses: [200]
    });
    const list = Array.isArray(res.data) ? res.data : [];
    if (!list.length && !discussion.id) throw new Error('No discussions');
    return list.length;
  });

  const module = await step('Lecturer', 'Create course module', async () => {
    const res = await http('POST', `/courses/${course.id}/modules`, {
      token: lecturer.token,
      json: { title: `${RUN_ID} Week 1`, description: 'Module smoke', sort_order: 1 },
      allowStatuses: [201]
    });
    state.created.moduleId = res.data.id;
    return res.data;
  });

  await step('Student', 'View course structure', async () => {
    const res = await http('GET', `/courses/${course.id}/structure`, {
      token: student.token,
      allowStatuses: [200]
    });
    if (!res.data?.modules) throw new Error('Structure missing modules');
    return res.data.modules.length;
  });

  const room = await step('Lecturer', 'Create live class room', async () => {
    const res = await http('POST', '/rooms/create', {
      token: lecturer.token,
      json: { courseId: course.id, title: `${RUN_ID} Live session` },
      allowStatuses: [201]
    });
    state.created.roomToken = res.data?.roomId || res.data?.room_id || res.data?.room_token;
    return res.data;
  });

  await step('Lecturer', 'LiveKit token (optional)', async () => {
    if (!state.created.roomToken) throw new Error('No room token');
    const res = await http('POST', `/rooms/${state.created.roomToken}/livekit-token`, {
      token: lecturer.token,
      json: {},
      allowStatuses: [200, 503]
    });
    if (res.status === 503) return { skipped: true, reason: 'LiveKit not configured' };
    if (!res.data?.token && !res.data?.accessToken && !res.data?.participantToken) {
      throw new Error(res.data?.error || 'No LiveKit token in response');
    }
    return { ok: true };
  });

  await step('Lecturer', 'Gradebook (course)', async () => {
    const res = await http('GET', `/gradebook/course/${course.id}`, {
      token: lecturer.token,
      allowStatuses: [200]
    });
    if (!res.data?.course?.id && !res.data?.courseId && !res.data?.course_id) {
      throw new Error('Gradebook payload missing course');
    }
    return res.data?.statistics ? 'ok' : 'loaded';
  });

  await step('Student', 'Gradebook (course)', async () => {
    const res = await http('GET', `/gradebook/course/${course.id}`, {
      token: student.token,
      allowStatuses: [200]
    });
    if (!res.data) throw new Error('Empty gradebook');
    return 'ok';
  });

  await step('Both', 'Calendar upcoming', async () => {
    const lec = await http('GET', '/calendar/upcoming?limit=5', {
      token: lecturer.token,
      allowStatuses: [200]
    });
    const stu = await http('GET', '/calendar/upcoming?limit=5', {
      token: student.token,
      allowStatuses: [200]
    });
    return { lecturer: (lec.data || []).length, student: (stu.data || []).length };
  });

  await step('Lecturer', 'Close live room', async () => {
    if (!state.created.roomToken) return { skipped: true };
    const res = await http('PATCH', `/rooms/${encodeURIComponent(state.created.roomToken)}/close`, {
      token: lecturer.token,
      allowStatuses: [200]
    });
    return res.data;
  });

  const pass = state.results.filter((r) => r.status === 'PASS').length;
  const fail = state.results.filter((r) => r.status === 'FAIL').length;

  const summary = { runId: RUN_ID, pass, fail, total: state.results.length, created: state.created };
  state.summary = summary;

  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, JSON.stringify({ summary, results: state.results, created: state.created }, null, 2));

  console.log('\n--- SUMMARY ---');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Report: ${REPORT_FILE}`);
  console.log(`Cleanup: node scripts/cleanup-smoke-data.js ${RUN_ID}\n`);

  process.exitCode = fail > 0 ? 1 : 0;
};

run().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
