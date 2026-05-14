import React, { useEffect, useRef } from 'react';
import SystemMessageItem from './SystemMessageItem';
import styles from './ChatMessageList.module.css';

/**
 * @param {{ messages: import('../../services/classroom/classroomChatMessages').ClassroomChatRow[], localIdentity?: string|null }} props
 */
export default function ChatMessageList({ messages, localIdentity = null }) {
  const bottomRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    el.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages]);

  const formatTime = (t) => {
    try {
      return new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    } catch (_) {
      return '';
    }
  };

  return (
    <ul className={styles.list} ref={listRef} aria-live="polite" aria-relevant="additions">
      {messages.map((m) => {
        if (m.kind === 'system') {
          return (
            <SystemMessageItem key={m.id} body={m.body} timeLabel={formatTime(m.t)} />
          );
        }
        const isLocal = localIdentity != null && m.identity === localIdentity;
        const isLecturer = m.role === 'lecturer' || m.role === 'admin';
        return (
          <li
            key={m.id}
            className={[
              styles.msg,
              isLocal && styles.msgLocal,
              isLecturer && styles.msgLecturer
            ].filter(Boolean).join(' ')}
          >
            <div className={styles.msgHead}>
              <span className={styles.msgName}>{m.name}</span>
              <span className={styles.msgRole}>{m.role === 'admin' ? 'Admin' : m.role === 'lecturer' ? 'Instructor' : 'Student'}</span>
              <span className={styles.msgTime}>{formatTime(m.t)}</span>
            </div>
            <p className={styles.msgBody}>{m.body}</p>
          </li>
        );
      })}
      <li ref={bottomRef} className={styles.anchor} aria-hidden />
    </ul>
  );
}
