import React from 'react';
import ChatMessageList from './ChatMessageList';
import ChatInput from './ChatInput';
import styles from './ClassroomChatPanel.module.css';

/**
 * @param {{
 *   messages: import('../../services/classroom/classroomChatMessages').ClassroomChatRow[],
 *   localIdentity?: string|null,
 *   onSend: (text: string) => void,
 *   disabled?: boolean,
 *   title?: string
 * }} props
 */
export default function ClassroomChatPanel({
  messages,
  localIdentity = null,
  onSend,
  disabled = false,
  title = 'Class chat'
}) {
  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.sub}>Room messages only. Be concise and on-topic.</p>
      </div>
      <div className={styles.body}>
        {messages.length ? (
          <ChatMessageList messages={messages} localIdentity={localIdentity} />
        ) : (
          <p className={styles.empty}>No messages yet.</p>
        )}
      </div>
      <ChatInput onSend={onSend} disabled={disabled} />
    </div>
  );
}
