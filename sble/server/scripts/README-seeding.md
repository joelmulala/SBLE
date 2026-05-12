# Student Seeding Utility

Script: [seed-test-students.js](seed-test-students.js)

## Purpose
Generate test student accounts programmatically without hardcoding each student record.

## Command

```powershell
cd server
npm run seed:test-students -- 220001 2200135
```

## Range interpretation
If an extremely large numeric range is detected (example: `220001` to `2200135`), the script interprets the last 3 digits of the end token as total count and normalizes to:

- start: `220001`
- end: `220135`
- total: `135`

## Student login password
Students use the global configured default student password from environment:

- `TEMP_STUDENT_PASSWORD`

Expected value in your setup:

- `student123`

## Output
The script logs:
- created count
- updated existing count
- total students in DB
