import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../config/api';
import { useAssessmentRoles } from '../../assessment';
import {
  AssessmentCard,
  AssessmentSectionTitle,
  AssessmentAlert,
  AssessmentMeta,
  BtnPrimary,
  BtnSecondary
} from '../assessment/AssessmentPrimitives';
import CourseAnnouncementsPanel from '../course/CourseAnnouncementsPanel';
import CourseDiscussionsPanel from '../course/CourseDiscussionsPanel';
import s from './CommunicationHub.module.css';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'announcements', label: 'Announcements' },
  { id: 'discussions', label: 'Discussions' }
];

export default function CourseCommunicationHub({ courseId, courseTitle }) {
  const { isLecturer } = useAssessmentRoles();
  const [tab, setTab] = useState('overview');
  const [hub, setHub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHub = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/communication/course/${courseId}/hub`);
      setHub(res.data);
    } catch (err) {
      setHub(null);
      setError(err?.response?.data?.error || 'Failed to load communication hub');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadHub();
  }, [loadHub]);

  const summary = hub?.summary || {};

  return (
    <div>
      <div className={s.hubTabs} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`${s.hubTab} ${tab === t.id ? s.hubTabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <AssessmentAlert>{error}</AssessmentAlert> : null}
      {loading ? <AssessmentMeta>Loading communication...</AssessmentMeta> : null}

      {!loading && tab === 'overview' && hub ? (
        <AssessmentCard>
          <AssessmentSectionTitle>Course communication — {courseTitle || hub.course?.title}</AssessmentSectionTitle>
          <div className={s.summaryRow}>
            <div className={s.summaryChip}>
              <strong>{summary.announcementCount ?? 0}</strong>
              <span>Announcements</span>
            </div>
            <div className={s.summaryChip}>
              <strong>{summary.threadCount ?? 0}</strong>
              <span>Discussion topics</span>
            </div>
            <div className={s.summaryChip}>
              <strong>{summary.activeLiveClasses ?? 0}</strong>
              <span>Live now</span>
            </div>
            {isLecturer ? (
              <div className={s.summaryChip}>
                <strong>{summary.scheduledCount ?? 0}</strong>
                <span>Scheduled</span>
              </div>
            ) : null}
          </div>

          {hub.liveNotices?.length > 0 ? (
            <>
              <AssessmentMeta strong>Live class notices</AssessmentMeta>
              <ul className={s.noticeList}>
                {hub.liveNotices.map((notice) => (
                  <li key={notice.id} className={`${s.noticeItem} ${s.noticeLive}`}>
                    <div>
                      <strong>{notice.title}</strong>
                      <AssessmentMeta>Session in progress</AssessmentMeta>
                    </div>
                    <Link to={`/room/${notice.id}`} style={{ fontWeight: 600, color: 'var(--color-brand)' }}>
                      Join session
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <AssessmentMeta>No live sessions right now.</AssessmentMeta>
          )}

          {hub.announcements?.length > 0 ? (
            <div style={{ marginTop: 'var(--space-6)' }}>
              <AssessmentMeta strong>Recent announcements</AssessmentMeta>
              <ul className={s.noticeList} style={{ marginTop: 'var(--space-3)' }}>
                {hub.announcements.slice(0, 3).map((a) => (
                  <li key={a.id} className={s.noticeItem}>
                    <div>
                      {a.is_pinned ? <AssessmentMeta>Pinned</AssessmentMeta> : null}
                      <strong>{a.title}</strong>
                    </div>
                    <BtnSecondary type="button" onClick={() => setTab('announcements')}>View</BtnSecondary>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div style={{ marginTop: 'var(--space-5)' }}>
            <BtnPrimary type="button" onClick={() => setTab('discussions')}>Open discussions</BtnPrimary>
          </div>
        </AssessmentCard>
      ) : null}

      {tab === 'announcements' ? (
        <CourseAnnouncementsPanel
          courseId={courseId}
          canManage={isLecturer}
          onChanged={loadHub}
        />
      ) : null}

      {tab === 'discussions' ? (
        <CourseDiscussionsPanel
          courseId={courseId}
          canModerate={isLecturer}
          onChanged={loadHub}
        />
      ) : null}
    </div>
  );
}
