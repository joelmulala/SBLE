# SBLE System Verification Checklist

This checklist is aligned with the automated utility in [server/scripts/verify-system.js](server/scripts/verify-system.js).

## 1. Pre-Run Setup

- Backend server is running on http://localhost:5000
- PostgreSQL is running and reachable
- At least one lecturer and one student account exist
- Temp passwords are configured in server environment:
  - TEMP_ADMIN_PASSWORD
  - TEMP_LECTURER_PASSWORD
  - TEMP_STUDENT_PASSWORD
- Optional for full email validation:
  - EMAIL_ENABLED=true
  - EMAIL_MODE=dev or demo

## 2. Automated Verification Utility

Run:

```powershell
cd server
npm run verify:system
```

Artifacts:
- Utility script: [server/scripts/verify-system.js](server/scripts/verify-system.js)
- Workflow log output: [server/logs/system-verification.log](server/logs/system-verification.log)

Expected summary:
- PASS for all core workflow steps
- FAIL count = 0 for full success

## 3. Workflow Coverage (Automated)

The utility verifies:

1. Health endpoint reachability
2. Login flow:
   - Admin login
   - Lecturer login
   - Student login
3. Course workflow:
   - Lecturer creates course
4. Enrollment workflow:
   - Lecturer enrolls student
5. Materials workflow:
   - Upload material
   - Confirm encrypted storage path (.enc)
   - Student download
6. Assignment workflow:
   - Lecturer creates assignment
   - Student submits assignment file
7. Quiz workflow:
   - Lecturer creates quiz
   - Lecturer publishes quiz
   - Student attempts quiz
8. Exam workflow:
   - Lecturer uploads exam file
   - Lecturer releases exam
9. Notifications workflow:
   - Student SSE stream connection
   - exam-released event delivery
10. Debug/status workflow:
    - Admin debug endpoint returns service diagnostics
11. Email diagnostics:
    - Verifies current mode and enabled state are visible
12. Backend critical log scan:
    - Checks recent logs for startup/uncaught critical failures

## 4. Email Verification (Dev + Demo)

Current mode is visible via admin debug endpoint:
- [server/src/routes/debug.js](server/src/routes/debug.js)
- Endpoint: GET /api/admin/debug/system

### Dev mode checklist

- EMAIL_MODE=dev
- EMAIL_ENABLED=true
- Trigger a login
- Confirm debug endpoint shows email diagnostics with latest dispatch
- Confirm backend logs contain Ethereal preview URL

### Demo mode checklist

- EMAIL_MODE=demo
- EMAIL_ENABLED=true
- GMAIL_USER is set
- GMAIL_APP_PASSWORD is set
- Trigger login/exam release/grade events
- Confirm email diagnostics update on debug endpoint

## 5. Optional Manual Frontend Checks

Use browser DevTools Console while running main flows:

- Login as lecturer/student/admin
- Create/enroll/upload/submit/attempt/release actions
- Confirm no uncaught critical frontend errors
- Confirm API errors show readable message instead of generic Network Error

Relevant frontend API handler:
- [client/src/config/api.js](client/src/config/api.js)

## 6. Admin Debug Endpoint

Implemented endpoint:
- Route file: [server/src/routes/debug.js](server/src/routes/debug.js)
- Mounted path: /api/admin/debug/system
- Access: admin role required

Returns:
- System status
- Active services:
  - API
  - Database
  - Performance service
  - Redis configuration
  - MinIO configuration
  - Active SSE clients
- Email mode diagnostics
- Auth mode
- Runtime metadata (timestamp, uptime, Node version)

## 7. Pass/Fail Criteria

Pass if:
- All required automated workflow steps are PASS
- No critical backend failures in recent logs
- Manual frontend check has no critical uncaught console errors

Fail if:
- Any major workflow step fails
- SSE notification event is not received
- Login fails for any required role
- Critical backend runtime errors appear (uncaught/unhandled/startup failures)
