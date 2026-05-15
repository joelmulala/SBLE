import React, { useCallback, useEffect, useState } from 'react';
import api from '../../config/api';
import {
  AssessmentCard,
  AssessmentSectionTitle,
  AssessmentAlert,
  AssessmentEmpty,
  AssessmentMeta,
  BtnPrimary,
  BtnSecondary,
  BtnDanger,
  TextInput,
  TextArea,
  Field
} from '../assessment/AssessmentPrimitives';
import hubStyles from '../communication/CommunicationHub.module.css';
import s from './CoursePanels.module.css';

const emptyForm = () => ({
  title: '',
  body: '',
  is_pinned: false,
  link_url: '',
  publish_at: '',
  is_hidden: false,
  attachment: null
});

export default function CourseAnnouncementsPanel({ courseId, canManage = false, onChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const loadItems = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/announcements/course/${courseId}`);
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setItems([]);
      setError(err?.response?.data?.error || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(false);
  };

  const buildFormData = (payload) => {
    const fd = new FormData();
    fd.append('title', payload.title.trim());
    fd.append('body', payload.body.trim());
    fd.append('is_pinned', payload.is_pinned ? 'true' : 'false');
    fd.append('is_hidden', payload.is_hidden ? 'true' : 'false');
    if (payload.link_url?.trim()) fd.append('link_url', payload.link_url.trim());
    if (payload.publish_at) fd.append('publish_at', payload.publish_at);
    if (payload.attachment) fd.append('attachment', payload.attachment);
    return fd;
  };

  const afterSave = async () => {
    resetForm();
    await loadItems();
    onChanged?.();
  };

  const saveAnnouncement = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      setError('Title and body are required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const fd = buildFormData(form);
      if (editingId) {
        await api.patch(`/announcements/${editingId}`, fd);
      } else {
        await api.post(`/announcements/course/${courseId}`, fd);
      }
      await afterSave();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save announcement');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setShowForm(true);
    setForm({
      title: item.title || '',
      body: item.body || '',
      is_pinned: Boolean(item.is_pinned),
      link_url: item.link_url || '',
      publish_at: item.publish_at ? toLocalInput(item.publish_at) : '',
      is_hidden: Boolean(item.is_hidden),
      attachment: null
    });
  };

  const removeAnnouncement = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await api.delete(`/announcements/${id}`);
      await loadItems();
      onChanged?.();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to delete announcement');
    }
  };

  const downloadAttachment = async (id, name) => {
    try {
      const res = await api.get(`/announcements/${id}/attachment`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = name || 'attachment';
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to download attachment');
    }
  };

  return (
    <AssessmentCard>
      <AssessmentSectionTitle
        action={canManage ? (
          <BtnPrimary
            type="button"
            onClick={() => {
              if (showForm && !editingId) resetForm();
              else {
                setEditingId(null);
                setForm(emptyForm());
                setShowForm((v) => !v);
              }
            }}
          >
            {showForm && !editingId ? 'Cancel' : 'New announcement'}
          </BtnPrimary>
        ) : null}
      >
        Announcements
      </AssessmentSectionTitle>
      <AssessmentMeta>Official course updates from your lecturer.</AssessmentMeta>

      {error ? <AssessmentAlert>{error}</AssessmentAlert> : null}

      {canManage && showForm ? (
        <form onSubmit={saveAnnouncement} className={`${s.composeForm} ${hubStyles.formGrid}`}>
          <Field label="Title">
            <TextInput
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Announcement title"
            />
          </Field>
          <Field label="Message">
            <TextArea
              value={form.body}
              onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
              rows={4}
              placeholder="Write the announcement..."
            />
          </Field>
          <div className={hubStyles.formRow2}>
            <Field label="Link URL (optional)">
              <TextInput
                value={form.link_url}
                onChange={(e) => setForm((prev) => ({ ...prev, link_url: e.target.value }))}
                placeholder="https://..."
              />
            </Field>
            <Field label="Schedule publish (optional)">
              <TextInput
                type="datetime-local"
                value={form.publish_at}
                onChange={(e) => setForm((prev) => ({ ...prev, publish_at: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Attachment (optional)">
            <input
              type="file"
              onChange={(e) => setForm((prev) => ({ ...prev, attachment: e.target.files?.[0] || null }))}
            />
          </Field>
          <label className={s.announcementMeta}>
            <input
              type="checkbox"
              checked={form.is_pinned}
              onChange={(e) => setForm((prev) => ({ ...prev, is_pinned: e.target.checked }))}
            />
            {' '}Pin to top
          </label>
          <label className={s.announcementMeta}>
            <input
              type="checkbox"
              checked={form.is_hidden}
              onChange={(e) => setForm((prev) => ({ ...prev, is_hidden: e.target.checked }))}
            />
            {' '}Hide from students
          </label>
          <div className={s.composeActions}>
            <BtnPrimary type="submit" disabled={saving}>
              {saving ? 'Saving...' : editingId ? 'Save changes' : 'Publish'}
            </BtnPrimary>
            {editingId ? (
              <BtnSecondary type="button" onClick={resetForm}>Cancel edit</BtnSecondary>
            ) : null}
          </div>
        </form>
      ) : null}

      {loading ? (
        <AssessmentMeta>Loading announcements...</AssessmentMeta>
      ) : items.length === 0 ? (
        <AssessmentEmpty>No announcements yet.</AssessmentEmpty>
      ) : (
        <ul className={s.announcementList}>
          {items.map((item) => {
            const scheduled = isScheduled(item.publish_at);
            const cardClass = [
              hubStyles.announcementCard,
              item.is_pinned ? hubStyles.announcementPinned : '',
              scheduled ? hubStyles.announcementScheduled : ''
            ].filter(Boolean).join(' ');

            return (
              <li key={item.id} className={cardClass}>
                <div className={s.announcementHead}>
                  <div>
                    {item.is_pinned ? <span className={s.pinnedBadge}>Pinned</span> : null}
                    {scheduled ? <span className={s.pinnedBadge}>Scheduled</span> : null}
                    {item.is_hidden && canManage ? <span className={s.pinnedBadge}>Hidden</span> : null}
                    <h3 className={s.announcementTitle}>{item.title}</h3>
                  </div>
                  {canManage ? (
                    <div className={hubStyles.announcementActions}>
                      <BtnSecondary type="button" onClick={() => startEdit(item)}>Edit</BtnSecondary>
                      <BtnDanger type="button" onClick={() => removeAnnouncement(item.id)}>Delete</BtnDanger>
                    </div>
                  ) : null}
                </div>
                <p className={s.announcementMeta}>
                  {item.author?.full_name || 'Lecturer'} · {formatWhen(item.created_at)}
                  {item.publish_at ? ` · Publishes ${formatWhen(item.publish_at)}` : ''}
                </p>
                <p className={s.announcementBody}>{item.body}</p>
                {item.link_url ? (
                  <p className={hubStyles.linkRow}>
                    <a href={item.link_url} target="_blank" rel="noopener noreferrer">{item.link_url}</a>
                  </p>
                ) : null}
                {item.attachment_name ? (
                  <div className={hubStyles.announcementActions}>
                    <BtnSecondary
                      type="button"
                      onClick={() => downloadAttachment(item.id, item.attachment_name)}
                    >
                      Download {item.attachment_name}
                    </BtnSecondary>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </AssessmentCard>
  );
}

function isScheduled(publishAt) {
  if (!publishAt) return false;
  return new Date(publishAt) > new Date();
}

function toLocalInput(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatWhen(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch (_) {
    return '';
  }
}
