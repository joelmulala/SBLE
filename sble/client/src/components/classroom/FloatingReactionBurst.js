import React, { useEffect, useState } from 'react';
import styles from './FloatingReactionBurst.module.css';

const BURST_ICONS = {
  hand: '🤚',
  understood: '✅',
  agree: '🤝'
};

/**
 * Subtle upward float when the local user sends a reaction.
 */
export default function FloatingReactionBurst({ kind = null, burstKey = 0 }) {
  const [visible, setVisible] = useState(false);
  const icon = kind && BURST_ICONS[kind] ? BURST_ICONS[kind] : null;

  useEffect(() => {
    if (!icon || !burstKey) return undefined;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2200);
    return () => clearTimeout(t);
  }, [icon, burstKey]);

  if (!icon || !visible) return null;

  return (
    <div className={styles.host} aria-hidden>
      <span key={burstKey} className={styles.bubble}>
        {icon}
      </span>
    </div>
  );
}
