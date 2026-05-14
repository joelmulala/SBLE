import React from 'react';

/**
 * @param {{
 *   hasQuestion: boolean,
 *   onToggle: () => void,
 *   className?: string,
 *   activeClassName?: string,
 *   disabled?: boolean
 * }} props
 */
export default function QuestionSignalButton({
  hasQuestion,
  onToggle,
  className = '',
  activeClassName = '',
  disabled = false
}) {
  return (
    <button
      type="button"
      className={[className, hasQuestion ? activeClassName : ''].filter(Boolean).join(' ')}
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={hasQuestion}
    >
      {hasQuestion ? 'Clear question' : 'I have a question'}
    </button>
  );
}
