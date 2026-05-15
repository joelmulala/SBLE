import React, { useCallback, useEffect, useState } from 'react';
import api from '../../config/api';
import { useKeycloak } from '../../auth/AuthProvider';
import {
  AssessmentCard,
  AssessmentSectionTitle,
  AssessmentAlert,
  AssessmentEmpty,
  AssessmentMeta,
  BtnPrimary,
  BtnDanger,
  BtnSecondary,
  TextArea,
  Field
} from '../assessment/AssessmentPrimitives';
import hubStyles from '../communication/CommunicationHub.module.css';
import s from './CoursePanels.module.css';

export default function CourseDiscussionsPanel({ courseId, canModerate = false, onChanged }) {
  const { keycloak } = useKeycloak();
  const userId = keycloak.tokenParsed?.sub;
  const [threads, setThreads] = useState([]);
  const [topicMessage, setTopicMessage] = useState('');
  const [replyDrafts, setReplyDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  const loadThreads = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/courses/${courseId}/discussions?threaded=true`);
      setThreads(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setThreads([]);
      setError(err?.response?.data?.error || 'Failed to load discussions');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const postMessage = async (e, parentId = null) => {
    e.preventDefault();
    const trimmed = parentId
      ? String(replyDrafts[parentId] || '').trim()
      : topicMessage.trim();
    if (!trimmed) return;

    setPosting(true);
    setError('');
    try {
      const payload = { message: trimmed };
      if (parentId) payload.parent_id = parentId;
      await api.post(`/courses/${courseId}/discussions`, payload);
      if (parentId) {
        setReplyDrafts((prev) => ({ ...prev, [parentId]: '' }));
      } else {
        setTopicMessage('');
      }
      await loadThreads();
      onChanged?.();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to post message');
    } finally {
      setPosting(false);
    }
  };

  const removePost = async (discussionId) => {
    if (!window.confirm('Remove this post?')) return;
    try {
      await api.delete(`/courses/${courseId}/discussions/${discussionId}`);
      await loadThreads();
      onChanged?.();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to remove post');
    }
  };

  return (
    <AssessmentCard>
      <AssessmentSectionTitle>Course discussions</AssessmentSectionTitle>
      <AssessmentMeta>Structured topics and replies for this course.</AssessmentMeta>

      {error ? <AssessmentAlert>{error}</AssessmentAlert> : null}

      <form onSubmit={(e) => postMessage(e)} className={s.composeForm}>
        <Field label="Start a topic">
          <TextArea
            value={topicMessage}
            onChange={(e) => setTopicMessage(e.target.value)}
            rows={3}
            placeholder="Ask a question or start a topic..."
            disabled={posting}
          />
        </Field>
        <div className={s.composeActions}>
          <BtnPrimary type="submit" disabled={posting || !topicMessage.trim()}>
            {posting ? 'Posting...' : 'Post topic'}
          </BtnPrimary>
        </div>
      </form>

      {loading ? (
        <AssessmentMeta>Loading discussion...</AssessmentMeta>
      ) : threads.length === 0 ? (
        <AssessmentEmpty>No discussion topics yet. Start the conversation.</AssessmentEmpty>
      ) : (
        <div>
          {threads.map((thread) => (
            <ThreadBlock
              key={thread.id}
              thread={thread}
              userId={userId}
              canModerate={canModerate}
              replyDrafts={replyDrafts}
              setReplyDrafts={setReplyDrafts}
              posting={posting}
              onReply={postMessage}
              onDelete={removePost}
            />
          ))}
        </div>
      )}
    </AssessmentCard>
  );
}

function ThreadBlock({
  thread,
  userId,
  canModerate,
  replyDrafts,
  setReplyDrafts,
  posting,
  onReply,
  onDelete
}) {
  const isOwn = String(thread.user_id) === String(userId);
  const canDelete = canModerate || isOwn;
  const authorName = thread.author?.full_name || 'Course member';
  const role = thread.author?.role;
  const showReplyForm = true;

  return (
    <article className={hubStyles.thread}>
      <div className={hubStyles.threadHead}>
        <div>
          <span className={hubStyles.threadAuthor}>{authorName}</span>
          {role ? (
            <span className={`${hubStyles.roleBadge} ${role === 'lecturer' || role === 'admin' ? hubStyles.roleLecturer : hubStyles.roleStudent}`}>
              {role}
            </span>
          ) : null}
          <AssessmentMeta>{formatWhen(thread.created_at)}</AssessmentMeta>
        </div>
        {canDelete ? (
          <BtnDanger type="button" onClick={() => onDelete(thread.id)}>Remove</BtnDanger>
        ) : null}
      </div>
      <p className={hubStyles.threadBody}>{thread.message}</p>

      {showReplyForm ? (
        <form onSubmit={(e) => onReply(e, thread.id)} className={hubStyles.replyForm}>
          <TextArea
            value={replyDrafts[thread.id] || ''}
            onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [thread.id]: e.target.value }))}
            rows={2}
            placeholder="Write a reply..."
            disabled={posting}
          />
          <div className={s.composeActions}>
            <BtnSecondary type="submit" disabled={posting || !(replyDrafts[thread.id] || '').trim()}>
              Reply
            </BtnSecondary>
          </div>
        </form>
      ) : null}

      {thread.replies?.length > 0 ? (
        <div className={hubStyles.replies}>
          {thread.replies.map((reply) => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              userId={userId}
              canModerate={canModerate}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function ReplyItem({ reply, userId, canModerate, onDelete }) {
  const isOwn = String(reply.user_id) === String(userId);
  const canDelete = canModerate || isOwn;
  const role = reply.author?.role;

  return (
    <div className={hubStyles.reply}>
      <div className={hubStyles.threadHead}>
        <div>
          <span className={hubStyles.threadAuthor}>{reply.author?.full_name || 'Course member'}</span>
          {role ? (
            <span className={`${hubStyles.roleBadge} ${role === 'lecturer' || role === 'admin' ? hubStyles.roleLecturer : hubStyles.roleStudent}`}>
              {role}
            </span>
          ) : null}
          <span className={hubStyles.threadTime}> · {formatWhen(reply.created_at)}</span>
        </div>
        {canDelete ? (
          <BtnDanger type="button" onClick={() => onDelete(reply.id)}>Remove</BtnDanger>
        ) : null}
      </div>
      <p className={hubStyles.threadBody}>{reply.message}</p>
    </div>
  );
}

function formatWhen(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch (_) {
    return '';
  }
}
