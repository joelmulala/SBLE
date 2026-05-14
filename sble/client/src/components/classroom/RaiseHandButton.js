import React from 'react';

/**
 * @param {{
 *   pressed: boolean,
 *   onToggle: () => void,
 *   className?: string,
 *   activeClassName?: string,
 *   disabled?: boolean
 * }} props
 */
export default function RaiseHandButton({
  pressed,
  onToggle,
  className = '',
  activeClassName = '',
  disabled = false
}) {
  return (
    <button
      type="button"
      className={[className, pressed ? activeClassName : ''].filter(Boolean).join(' ')}
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={pressed}
    >
      {pressed ? 'Lower hand' : 'Raise hand'}
    </button>
  );
}
