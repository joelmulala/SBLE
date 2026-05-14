import React, { useCallback, useState } from 'react';
import styles from './ChatInput.module.css';

/**
 * @param {{ onSend: (text: string) => void, disabled?: boolean, placeholder?: string }} props
 */
export default function ChatInput({ onSend, disabled = false, placeholder = 'Message the class…' }) {
  const [value, setValue] = useState('');

  const submit = useCallback(() => {
    const t = value.trim();
    if (!t || disabled) return;
    onSend(t);
    setValue('');
  }, [value, disabled, onSend]);

  return (
    <div className={styles.wrap}>
      <label className={styles.srOnly} htmlFor="classroom-chat-input">Class message</label>
      <textarea
        id="classroom-chat-input"
        className={styles.field}
        rows={2}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <button type="button" className={styles.send} disabled={disabled || !value.trim()} onClick={submit}>
        Send
      </button>
    </div>
  );
}
