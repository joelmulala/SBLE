import React, { useState } from 'react';
import api from '../../config/api';
import s from '../ui/system.module.css';
import { Button } from '../ui';

export default function EnrollmentPanel({ courseId, onEnrollmentChange }) {
  const [studentId, setStudentId] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null);

  if (!courseId) {
    return null;
  }

  const enrollSingle = async (e) => {
    e.preventDefault();
    if (!studentId.trim()) return;

    setBusy(true);
    setMessage('');
    setResult(null);
    try {
      const res = await api.post(`/courses/${courseId}/enroll`, { student_id: studentId.trim() });
      setMessage(`Enrolled: ${res.data?.student?.full_name || res.data?.student?.student_id || studentId.trim()}`);
      setStudentId('');
      await onEnrollmentChange?.();
    } catch (err) {
      setMessage(err?.response?.data?.error || 'Failed to enroll student');
    } finally {
      setBusy(false);
    }
  };

  const enrollByCsv = async (e) => {
    e.preventDefault();
    if (!csvFile) return;

    setBusy(true);
    setMessage('');
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      const res = await api.post(`/courses/${courseId}/enroll/csv`, formData);
      setResult(res.data);
      setMessage('CSV enrollment processed');
      setCsvFile(null);
      await onEnrollmentChange?.();
    } catch (err) {
      setMessage(err?.response?.data?.error || 'Failed to process CSV');
    } finally {
      setBusy(false);
    }
  };

  const noticeClass = message.toLowerCase().includes('failed')
    ? `${s.notice} ${s.noticeError}`
    : `${s.notice} ${s.noticeSuccess}`;

  return (
    <div className={s.enrollGrid}>
      <form onSubmit={enrollSingle} className={s.panel}>
        <div className={s.panelHeader}>
          <h3 className={s.panelTitle}>Add student</h3>
          <p className={s.panelLead}>Enroll by student ID.</p>
        </div>
        <div className={s.panelBody}>
          <div className={s.field}>
            <label htmlFor="enroll-student-id">Student ID</label>
            <input
              id="enroll-student-id"
              className={s.input}
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="e.g. STU-2024-001"
              required
            />
          </div>
          <Button type="submit" disabled={busy} variant="primary">
            {busy ? 'Saving…' : 'Add student'}
          </Button>
        </div>
      </form>

      <form onSubmit={enrollByCsv} className={s.panel}>
        <div className={s.panelHeader}>
          <h3 className={s.panelTitle}>Bulk CSV</h3>
          <p className={s.panelLead}>Upload a roster file for batch enrollment.</p>
        </div>
        <div className={s.panelBody}>
          <div className={s.field}>
            <label htmlFor="enroll-csv">CSV file</label>
            <input
              id="enroll-csv"
              type="file"
              accept=".csv"
              className={s.input}
              onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
              required
            />
          </div>
          <Button type="submit" disabled={busy || !csvFile}>
            {busy ? 'Uploading…' : 'Upload CSV'}
          </Button>
        </div>
      </form>

      {message ? <p className={`${noticeClass} ${s.enrollGridFull}`}>{message}</p> : null}

      {result ? (
        <div className={`${s.panel} ${s.enrollGridFull}`}>
          <div className={s.panelHeader}>
            <h3 className={s.panelTitle}>CSV result</h3>
          </div>
          <div className={s.panelBody}>
            <p className={s.cellMuted}>Enrolled: {result.enrolled?.length || 0}</p>
            <p className={s.cellMuted}>Already enrolled: {result.alreadyEnrolled?.length || 0}</p>
            <p className={s.cellMuted}>Not found: {result.notFound?.length || 0}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
