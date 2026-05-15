import React from 'react';
import {
  AssessmentShell,
  AssessmentPageHeader
} from '../../components/assessment/AssessmentPrimitives';
import AcademicCalendarView from '../../components/calendar/AcademicCalendarView';

export default function CalendarPage() {
  return (
    <AssessmentShell>
      <AssessmentPageHeader
        kicker="Institutional schedule"
        title="Academic calendar"
        lead="Centralized deadlines, assessments, live sessions, and announcements across your courses."
      />
      <AcademicCalendarView showScheduleForm />
    </AssessmentShell>
  );
}
