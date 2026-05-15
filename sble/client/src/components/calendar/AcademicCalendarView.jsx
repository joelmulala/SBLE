import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../config/api';
import { useAssessmentRoles } from '../../assessment';
import {
  AssessmentCard,
  AssessmentAlert,
  AssessmentEmpty,
  AssessmentMeta,
  BtnPrimary,
  Field,
  SelectInput,
  TextInput,
  TextArea
} from '../assessment/AssessmentPrimitives';
import CalendarEventList from './CalendarEventList';
import { calendarBasePath } from './calendarUtils';
import s from './AcademicCalendar.module.css';

export default function AcademicCalendarView({ courseId: fixedCourseId = '', showScheduleForm = true }) {
  const { isLecturer } = useAssessmentRoles();
  const [searchParams] = useSearchParams();
  const initialCourseId = fixedCourseId || searchParams.get('courseId') || '';
  const [events, setEvents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [summary, setSummary] = useState({ upcoming: 0, overdue: 0, liveNow: 0 });
  const [courseFilter, setCourseFilter] = useState(initialCourseId ? String(initialCourseId) : '');
  const [view, setView] = useState('upcoming');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scheduleForm, setScheduleForm] = useState({
    courseId: fixedCourseId ? String(fixedCourseId) : '',
    title: '',
    description: '',
    event_type: 'office_hours',
    starts_at: '',
    ends_at: ''
  });
  const [saving, setSaving] = useState(false);

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      const cid = fixedCourseId || courseFilter;
      if (cid) params.set('courseId', cid);
      const res = await api.get(`/calendar?${params.toString()}`);
      setEvents(Array.isArray(res.data?.events) ? res.data.events : []);
      setCourses(Array.isArray(res.data?.courses) ? res.data.courses : []);
      setSummary(res.data?.summary || { upcoming: 0, overdue: 0, liveNow: 0 });
    } catch (err) {
      setEvents([]);
      setSummary({ upcoming: 0, overdue: 0, liveNow: 0 });
      setError(err?.response?.data?.error || 'Failed to load calendar');
    } finally {
      setLoading(false);
    }
  }, [courseFilter, fixedCourseId]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  const filteredEvents = useMemo(() => {
    const now = Date.now();
    if (view === 'overdue') {
      return events.filter((e) => {
        const end = new Date(e.endsAt || e.startsAt).getTime();
        return (e.type === 'assignment_due' || e.type === 'quiz_close') && end < now;
      });
    }
    if (view === 'live') {
      return events.filter((e) => e.type === 'live_class' || e.meta?.isActive);
    }
    if (view === 'upcoming') {
      return events.filter((e) => {
        const start = new Date(e.startsAt || e.endsAt || 0).getTime();
        return start >= now || e.meta?.isActive;
      });
    }
    return events;
  }, [events, view]);

  const createScheduledEvent = async (e) => {
    e.preventDefault();
    const cid = scheduleForm.courseId || courseFilter || fixedCourseId;
    if (!cid || !scheduleForm.title.trim() || !scheduleForm.starts_at) {
      setError('Course, title, and start time are required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await api.post(`/calendar/course/${cid}/events`, scheduleForm);
      setScheduleForm((prev) => ({
        ...prev,
        title: '',
        description: '',
        starts_at: '',
        ends_at: ''
      }));
      await loadCalendar();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to create event');
    } finally {
      setSaving(false);
    }
  };

  const calendarLink = calendarBasePath(isLecturer);

  return (
    <div>
      <div className={s.summaryRow}>
        <div className={s.summaryChip}>
          <strong>{summary.upcoming ?? 0}</strong>
          <span>Upcoming</span>
        </div>
        <div className={s.summaryChip}>
          <strong>{summary.overdue ?? 0}</strong>
          <span>Overdue</span>
        </div>
        <div className={s.summaryChip}>
          <strong>{summary.liveNow ?? 0}</strong>
          <span>Live now</span>
        </div>
      </div>

      {!fixedCourseId ? (
        <AssessmentCard>
          <div className={s.filterRow}>
            <Field label="Filter by course">
              <SelectInput value={courseFilter} onChange={(ev) => setCourseFilter(ev.target.value)}>
                <option value="">All courses</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </SelectInput>
            </Field>
          </div>
        </AssessmentCard>
      ) : null}

      <div className={s.viewTabs} role="tablist">
        {[
          { id: 'upcoming', label: 'Upcoming' },
          { id: 'all', label: 'All events' },
          { id: 'overdue', label: 'Overdue' },
          { id: 'live', label: 'Live' }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className={`${s.viewTab} ${view === tab.id ? s.viewTabActive : ''}`}
            onClick={() => setView(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? <AssessmentAlert>{error}</AssessmentAlert> : null}
      {loading ? <AssessmentMeta>Loading academic calendar...</AssessmentMeta> : null}

      {!loading && filteredEvents.length === 0 ? (
        <AssessmentEmpty>No events in this view.</AssessmentEmpty>
      ) : null}

      {!loading && filteredEvents.length > 0 ? (
        <CalendarEventList events={filteredEvents} />
      ) : null}

      {isLecturer && showScheduleForm ? (
        <AssessmentCard>
          <AssessmentMeta strong>Schedule office hours or milestone</AssessmentMeta>
          <form onSubmit={createScheduledEvent} className={s.scheduleForm}>
            {!fixedCourseId ? (
              <Field label="Course">
                <SelectInput
                  value={scheduleForm.courseId}
                  onChange={(ev) => setScheduleForm((p) => ({ ...p, courseId: ev.target.value }))}
                  required
                >
                  <option value="">Select course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </SelectInput>
              </Field>
            ) : null}
            <div className={s.formRow2}>
              <Field label="Type">
                <SelectInput
                  value={scheduleForm.event_type}
                  onChange={(ev) => setScheduleForm((p) => ({ ...p, event_type: ev.target.value }))}
                >
                  <option value="office_hours">Office hours</option>
                  <option value="milestone">Course milestone</option>
                </SelectInput>
              </Field>
              <Field label="Title">
                <TextInput
                  value={scheduleForm.title}
                  onChange={(ev) => setScheduleForm((p) => ({ ...p, title: ev.target.value }))}
                  placeholder="e.g. Office hours — Week 3"
                />
              </Field>
            </div>
            <Field label="Description (optional)">
              <TextArea
                rows={2}
                value={scheduleForm.description}
                onChange={(ev) => setScheduleForm((p) => ({ ...p, description: ev.target.value }))}
              />
            </Field>
            <div className={s.formRow2}>
              <Field label="Starts">
                <TextInput
                  type="datetime-local"
                  value={scheduleForm.starts_at}
                  onChange={(ev) => setScheduleForm((p) => ({ ...p, starts_at: ev.target.value }))}
                />
              </Field>
              <Field label="Ends (optional)">
                <TextInput
                  type="datetime-local"
                  value={scheduleForm.ends_at}
                  onChange={(ev) => setScheduleForm((p) => ({ ...p, ends_at: ev.target.value }))}
                />
              </Field>
            </div>
            <div>
              <BtnPrimary type="submit" disabled={saving}>{saving ? 'Saving...' : 'Add to calendar'}</BtnPrimary>
            </div>
          </form>
          {!fixedCourseId ? (
            <p className={s.panelFooter}>
              Assessment deadlines are synced automatically from assignments, quizzes, and exams.
            </p>
          ) : null}
        </AssessmentCard>
      ) : null}

      {!fixedCourseId ? (
        <p className={s.panelFooter}>
          <Link to={calendarLink}>Open full calendar</Link>
        </p>
      ) : null}
    </div>
  );
}
