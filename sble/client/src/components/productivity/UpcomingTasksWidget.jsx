import React from 'react';
import { Link } from 'react-router-dom';
import { AssessmentEmpty, AssessmentLoading } from '../assessment/AssessmentPrimitives';
import s from './Productivity.module.css';

const BADGE_CLASS = {
  assignment: s.taskBadgeAssignment,
  quiz: s.taskBadgeQuiz,
  exam: s.taskBadgeExam,
  live: s.taskBadgeLive,
  grading: s.taskBadgeGrading,
  deadline: s.taskBadge
};

const BADGE_LABEL = {
  assignment: 'Assignment',
  quiz: 'Quiz',
  exam: 'Exam',
  live: 'Live',
  grading: 'Grading',
  deadline: 'Due'
};

function formatWhen(value) {
  if (!value) return '';
  const d = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((day - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function UpcomingTasksWidget({
  tasks,
  loading,
  emptyMessage,
  isLecturer,
  footerLink
}) {
  const defaultEmpty = isLecturer
    ? 'No pending teaching tasks. Your schedule is clear.'
    : 'No upcoming assignments or sessions. Check your courses.';

  if (loading) {
    return (
      <div className={s.panel}>
        <div className={s.panelHeader}>
          <h2 className={s.panelTitle}>Upcoming tasks</h2>
        </div>
        <div className={s.panelBody}>
          <AssessmentLoading label="Loading tasks…" />
        </div>
      </div>
    );
  }

  return (
    <div className={`${s.panel} wk-card`}>
      <div className={s.panelHeader}>
        <h2 className={s.panelTitle}>Upcoming tasks</h2>
        <p className={s.panelLead}>
          {isLecturer
            ? 'Grading, sessions, and assessment deadlines.'
            : 'Assignments, quizzes, exams, and live classes.'}
        </p>
      </div>
      <div className={s.panelBody}>
        {!tasks.length ? (
          <AssessmentEmpty>{emptyMessage || defaultEmpty}</AssessmentEmpty>
        ) : (
          <ul className={s.taskList}>
            {tasks.map((task) => {
              const badge = BADGE_LABEL[task.category] || 'Task';
              const inner = (
                <>
                  <span className={`${s.taskBadge} ${BADGE_CLASS[task.category] || ''}`}>{badge}</span>
                  <div className={s.taskContent}>
                    <span className={s.taskTitle}>{task.title}</span>
                    <span className={s.taskMeta}>{task.subtitle}</span>
                  </div>
                  <span className={s.taskWhen}>{formatWhen(task.at)}</span>
                </>
              );
              const className = `${s.taskItem} ${task.urgent ? s.taskItemUrgent : ''}`;
              if (task.href) {
                return (
                  <li key={task.id}>
                    <Link to={task.href} className={`${className} ${s.taskItemLink}`}>
                      {inner}
                    </Link>
                  </li>
                );
              }
              return (
                <li key={task.id} className={className}>
                  {inner}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {footerLink ? (
        <p className={s.panelFooter}>
          <Link to={footerLink}>View full calendar</Link>
        </p>
      ) : null}
    </div>
  );
}

