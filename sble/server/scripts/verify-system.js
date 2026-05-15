/* eslint-disable no-console */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');

const API_BASE = process.env.VERIFY_API_BASE || 'http://localhost:5000/api';
const LOG_FILE = path.join(__dirname, '..', 'logs', 'system-verification.log');

const nowIso = () => new Date().toISOString();

const ensureLogDir = () => {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const writeLog = (line) => {
  ensureLogDir();
  fs.appendFileSync(LOG_FILE, `${line}\n`, 'utf8');
  console.log(line);
};

const unwrapData = (payload) => {
  if (!payload || typeof payload !== 'object') return payload;
  if (Object.prototype.hasOwnProperty.call(payload, 'data') && Object.prototype.hasOwnProperty.call(payload, 'success')) {
    return payload.data;
  }
  return payload;
};

const http = async (method, pathName, { token, json, formData, expectedStatus } = {}) => {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }

  if (formData !== undefined) {
    body = formData;
  }

  const response = await fetch(`${API_BASE}${pathName}`, {
    method,
    headers,
    body
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (expectedStatus && response.status !== expectedStatus) {
    throw new Error(`Expected ${expectedStatus} for ${method} ${pathName}, got ${response.status}. Payload: ${JSON.stringify(payload)}`);
  }

  return {
    status: response.status,
    ok: response.ok,
    payload,
    data: unwrapData(payload),
    headers: response.headers
  };
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const step = async (title, fn, results) => {
  const started = Date.now();
  try {
    const output = await fn();
    const duration = Date.now() - started;
    results.push({ title, status: 'PASS', durationMs: duration });
    writeLog(`[PASS] ${title} (${duration}ms)`);
    return output;
  } catch (err) {
    const duration = Date.now() - started;
    results.push({ title, status: 'FAIL', durationMs: duration, error: err.message });
    writeLog(`[FAIL] ${title} (${duration}ms) -> ${err.message}`);
    return null;
  }
};

const login = async (email, password) => {
  const res = await http('POST', '/auth/login', {
    json: { email, password },
    expectedStatus: 200
  });

  const data = res.data || {};
  const token = data.token;
  const user = data.user;

  assert(Boolean(token), `Missing token for ${email}`);
  assert(Boolean(user?.id), `Missing user payload for ${email}`);

  return { token, user };
};

const toFormDataWithFile = (fields, filename, mimeType, contentText) => {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, String(value)));
  const blob = new Blob([contentText], { type: mimeType });
  form.append('file', blob, filename);
  return form;
};

const waitForSseEvent = async (token, eventName, timeoutMs = 7000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE}/notifications/stream?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`SSE connection failed with status ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream')) {
      throw new Error(`Unexpected SSE content type: ${contentType}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      if (buffer.includes(`event: ${eventName}`)) {
        return true;
      }
    }

    return false;
  } catch (err) {
    if (err.name === 'AbortError') return false;
    throw err;
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
};

const run = async () => {
  writeLog(`\n==== SBLE SYSTEM VERIFICATION START ${nowIso()} ====`);
  const results = [];

  const passwords = {
    admin: process.env.TEMP_ADMIN_PASSWORD || 'admin123',
    lecturer: process.env.TEMP_LECTURER_PASSWORD || 'lecturer123',
    student: process.env.TEMP_STUDENT_PASSWORD || 'student123'
  };

  let adminAuth;
  let lecturerAuth;
  let studentAuth;
  let createdCourse;
  let createdMaterial;
  let createdAssignment;
  let createdQuiz;
  let createdExam;

  await step('Health endpoint reachable', async () => {
    const res = await http('GET', '/health', { expectedStatus: 200 });
    assert(res.data?.api === 'up', 'API status is not up');
  }, results);

  adminAuth = await step('Admin login', async () => login('admin1@sble.local', passwords.admin), results);

  const usersPayload = await step('Fetch user list as admin', async () => {
    const res = await http('GET', '/users', { token: adminAuth.token, expectedStatus: 200 });
    assert(Array.isArray(res.data), 'Users payload should be an array');
    return res.data;
  }, results);

  const lecturerUser = (usersPayload || []).find((u) => u.role === 'lecturer');
  const studentUser = (usersPayload || []).find((u) => u.role === 'student');

  lecturerAuth = await step('Lecturer login', async () => {
    assert(Boolean(lecturerUser?.email), 'No lecturer user found in system');
    return login(lecturerUser.email, passwords.lecturer);
  }, results);

  studentAuth = await step('Student login', async () => {
    assert(Boolean(studentUser?.email), 'No student user found in system');
    return login(studentUser.email, passwords.student);
  }, results);

  createdCourse = await step('Course creation (lecturer)', async () => {
    const title = `System Verification Course ${Date.now()}`;
    const res = await http('POST', '/courses', {
      token: lecturerAuth.token,
      expectedStatus: 201,
      json: { title, description: 'Automated verification course' }
    });
    assert(Boolean(res.data?.id), 'Course id missing from response');
    return res.data;
  }, results);

  await step('Student enrollment', async () => {
    const identifier = studentUser?.student_id || studentUser?.id;
    assert(Boolean(identifier), 'No student identifier for enrollment');

    const res = await http('POST', `/courses/${createdCourse.id}/enroll`, {
      token: lecturerAuth.token,
      json: { student_id: identifier }
    });

    assert([201, 409].includes(res.status), `Unexpected enrollment status ${res.status}`);
  }, results);

  createdMaterial = await step('Material upload (encrypted)', async () => {
    const form = toFormDataWithFile(
      { courseId: createdCourse.id, title: 'Verification Material' },
      'verification-material.pdf',
      'application/pdf',
      'SBLE verification material content'
    );

    const res = await http('POST', '/materials/upload', {
      token: lecturerAuth.token,
      expectedStatus: 201,
      formData: form
    });

    assert(Boolean(res.data?.id), 'Material id missing');
    assert(String(res.data?.file_path || '').endsWith('.enc'), 'Material is expected to be stored as .enc');
    return res.data;
  }, results);

  await step('Material download', async () => {
    const res = await fetch(`${API_BASE}/materials/${createdMaterial.id}/download`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${studentAuth.token}` }
    });

    assert(res.ok, `Material download failed with ${res.status}`);
    const buf = await res.arrayBuffer();
    assert(buf.byteLength > 0, 'Downloaded material is empty');
  }, results);

  createdAssignment = await step('Assignment create and student submission', async () => {
    const createRes = await http('POST', '/assignments', {
      token: lecturerAuth.token,
      expectedStatus: 201,
      json: {
        courseId: createdCourse.id,
        title: 'Verification Assignment',
        description: 'Automated verification assignment',
        allows_handwritten: true
      }
    });

    const assignmentId = createRes.data?.id;
    assert(Boolean(assignmentId), 'Assignment id missing');

    const submitForm = toFormDataWithFile(
      { submission_type: 'typed' },
      'verification-submission.pdf',
      'application/pdf',
      'SBLE verification submission'
    );

    const submitRes = await http('POST', `/assignments/${assignmentId}/submit`, {
      token: studentAuth.token,
      formData: submitForm
    });

    assert(
      [200, 201].includes(submitRes.status),
      `Unexpected submission status ${submitRes.status}. Payload: ${JSON.stringify(submitRes.payload)}`
    );
    return createRes.data;
  }, results);

  createdQuiz = await step('Quiz create/publish/attempt', async () => {
    const createRes = await http('POST', '/quizzes', {
      token: lecturerAuth.token,
      expectedStatus: 201,
      json: {
        course_id: createdCourse.id,
        title: 'Verification Quiz',
        duration_minutes: 15,
        questions: [
          {
            question_text: '2 + 2 = ?',
            question_type: 'mcq',
            options: ['3', '4', '5'],
            correct_answer: '4',
            marks: 1
          }
        ]
      }
    });

    const quizId = createRes.data?.id;
    assert(Boolean(quizId), 'Quiz id missing');

    await http('PATCH', `/quizzes/${quizId}/publish`, {
      token: lecturerAuth.token,
      expectedStatus: 200,
      json: { start_time: new Date().toISOString(), duration_minutes: 15 }
    });

    const openRes = await http('GET', `/quizzes/${quizId}`, {
      token: studentAuth.token,
      expectedStatus: 200
    });

    const questions = openRes.data?.QuizQuestions || [];
    assert(questions.length > 0, 'Quiz should expose questions to student');
    const questionId = questions[0].id;

    const attemptRes = await http('POST', `/quizzes/${quizId}/attempt`, {
      token: studentAuth.token,
      expectedStatus: 201,
      json: {
        answers: {
          [questionId]: '4'
        }
      }
    });

    assert(Boolean(attemptRes.data?.attempt?.id || attemptRes.data?.attempt_id), 'Quiz attempt id missing');
    return createRes.data;
  }, results);

  createdExam = await step('Exam upload and release', async () => {
    const uploadForm = toFormDataWithFile(
      { courseId: createdCourse.id, title: 'Verification Exam' },
      'verification-exam.pdf',
      'application/pdf',
      'SBLE verification exam'
    );

    const uploadRes = await http('POST', '/exams/upload', {
      token: lecturerAuth.token,
      expectedStatus: 201,
      formData: uploadForm
    });

    const examId = uploadRes.data?.id;
    assert(Boolean(examId), 'Exam id missing');

    const releaseRes = await http('PATCH', `/exams/${examId}/release`, {
      token: lecturerAuth.token,
      expectedStatus: 200,
      json: { start_time: new Date().toISOString(), duration_minutes: 120 }
    });

    assert(Boolean(releaseRes.data?.is_released), 'Exam should be marked released');
    return uploadRes.data;
  }, results);

  await step('SSE notification stream receives exam-released event', async () => {
    const waiter = waitForSseEvent(studentAuth.token, 'exam-released', 7000);

    await http('PATCH', `/exams/${createdExam.id}/release`, {
      token: lecturerAuth.token,
      expectedStatus: 200,
      json: { start_time: new Date().toISOString(), duration_minutes: 120 }
    });

    const received = await waiter;
    assert(received, 'Did not receive exam-released SSE event in time');
  }, results);

  await step('Admin debug endpoint reports system status', async () => {
    const res = await http('GET', '/admin/debug/system', {
      token: adminAuth.token,
      expectedStatus: 200
    });

    assert(Boolean(res.data?.services?.database?.up), 'Debug endpoint reports database down');
    assert(Boolean(res.data?.email), 'Debug endpoint missing email diagnostics');
  }, results);

  await step('Email mode diagnostics visible (dev/demo)', async () => {
    const res = await http('GET', '/admin/debug/system', {
      token: adminAuth.token,
      expectedStatus: 200
    });

    const email = res.data?.email || {};
    const mode = email.mode;

    assert(['dev', 'demo', 'production'].includes(mode), `Unexpected email mode: ${mode}`);

    if (mode === 'dev' || mode === 'demo') {
      writeLog(`[INFO] Email mode verification target: ${mode} (enabled=${email.enabled})`);
    }
  }, results);

  await step('Recent backend log scan for critical failures', async () => {
    const backendLogFile = path.join(__dirname, '..', 'logs', 'combined.log');
    if (!fs.existsSync(backendLogFile)) {
      writeLog('[INFO] Backend combined log not found; skipping critical error scan');
      return;
    }

    const stat = fs.statSync(backendLogFile);
    const maxBytes = 256 * 1024;
    const readStart = Math.max(0, stat.size - maxBytes);
    const fd = fs.openSync(backendLogFile, 'r');
    const buffer = Buffer.alloc(Math.min(maxBytes, stat.size));
    fs.readSync(fd, buffer, 0, buffer.length, readStart);
    fs.closeSync(fd);
    const tail = buffer.toString('utf8');
    const lines = tail.split(/\r?\n/).filter(Boolean).slice(-200);
    const ignoredPatterns = [
      /EADDRINUSE/i
    ];
    const relevantLines = lines.filter((line) => !ignoredPatterns.some((pattern) => pattern.test(line)));
    const tailText = relevantLines.join('\n');

    const criticalPatterns = [
      /Unhandled promise rejection/i,
      /Uncaught exception/i,
      /Server startup failed/i,
      /Database connection failed \(attempt .*\/.*\)/i
    ];

    const criticalHit = criticalPatterns.find((pattern) => pattern.test(tailText));
    assert(!criticalHit, `Detected critical backend log pattern: ${criticalHit}`);
  }, results);

  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;

  writeLog('\n---- VERIFICATION SUMMARY ----');
  results.forEach((r) => {
    writeLog(`${r.status} | ${r.title}${r.error ? ` | ${r.error}` : ''}`);
  });
  writeLog(`TOTAL: ${results.length}, PASS: ${passCount}, FAIL: ${failCount}`);
  writeLog(`==== SBLE SYSTEM VERIFICATION END ${nowIso()} ====\n`);

  process.exitCode = failCount > 0 ? 1 : 0;
};

run().catch((err) => {
  writeLog(`[FATAL] Verification runner crashed: ${err.message}`);
  process.exit(1);
});
