import React from 'react';
import AcademicCalendarPanel from '../productivity/AcademicCalendarPanel';

/** @deprecated Use AcademicCalendarPanel — kept for course sidebar compatibility */
export default function CalendarUpcomingPanel(props) {
  return <AcademicCalendarPanel {...props} />;
}
