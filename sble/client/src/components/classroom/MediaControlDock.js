import React, { useSyncExternalStore } from 'react';
import ReactionPopover from './ReactionPopover';
import styles from './MediaControlDock.module.css';

function mqSubscribe(query, onChange) {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia(query);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

function mqMatches(query) {
  return typeof window !== 'undefined' && window.matchMedia(query).matches;
}

const MQ_DOCK_NARROW = '(max-width: 560px)';
const MQ_DOCK_MICRO = '(max-width: 400px)';

function IconChat() {
  return (
    <svg className={styles.svgIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M7 18v-2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-6l-5 4z" strokeLinejoin="round" />
    </svg>
  );
}

function IconMic({ muted }) {
  return (
    <svg className={styles.svgIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      {muted ? (
        <>
          <path d="M12 14v-2a3 3 0 0 0-3-3H9" strokeLinecap="round" />
          <path d="M17 11v2a5 5 0 0 1-5 5H12" strokeLinecap="round" />
          <path d="M12 19v2M8 22h8M3 3l18 18" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M12 14v-2a3 3 0 0 0-3-3H9a3 3 0 0 0-3 3v2" strokeLinecap="round" />
          <path d="M17 11v2a5 5 0 0 1-5 5H12" strokeLinecap="round" />
          <path d="M12 19v2M8 22h8" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function IconCam({ off }) {
  return (
    <svg className={styles.svgIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M15 10l4-2v8l-4-2v-4z" strokeLinejoin="round" />
      <rect x="3" y="7" width="12" height="10" rx="2" />
      {off ? <path d="M3 3l18 18" strokeLinecap="round" /> : null}
    </svg>
  );
}

function IconShare({ active }) {
  return (
    <svg className={styles.svgIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="4" width="14" height="12" rx="2" />
      <path d="M11 16v3M8 22h6" strokeLinecap="round" />
      <path d="M17 8h4v10H7" strokeLinecap="round" strokeLinejoin="round" />
      {active ? <circle cx="18" cy="6" r="2.5" fill="currentColor" stroke="none" opacity="0.35" /> : null}
    </svg>
  );
}

function IconPeople() {
  return (
    <svg className={styles.svgIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="9" cy="8" r="3" />
      <path d="M4 20v-1a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v1" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15 20v-0.5a3 3 0 0 1 3-3h0" strokeLinecap="round" />
    </svg>
  );
}

function IconNotes() {
  return (
    <svg className={styles.svgIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M8 4h8a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V6a2 2 0 0 1 2-2z" strokeLinejoin="round" />
      <path d="M9 9h6M9 13h4" strokeLinecap="round" />
    </svg>
  );
}

function IconHangUp() {
  return (
    <svg className={styles.hangIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"
      />
    </svg>
  );
}

function DockItem({
  label,
  pressed,
  activeClass,
  offClass,
  onClick,
  title,
  disabled,
  children
}) {
  return (
    <button
      type="button"
      className={[styles.dockItem, pressed && activeClass, offClass].filter(Boolean).join(' ')}
      onClick={onClick}
      aria-pressed={Boolean(pressed)}
      title={title}
      disabled={disabled}
    >
      <span className={styles.dockIconRing}>{children}</span>
      <span className={styles.dockLabel}>{label}</span>
    </button>
  );
}

/**
 * Mockup-style dock: labeled tools + reactions + end.
 */
export default function MediaControlDock({
  role,
  micOn,
  camOn,
  screenSharing,
  participationLocked,
  sidebarOpen,
  sidebarTab,
  notesOpen = false,
  onToggleChat,
  onTogglePeople,
  onToggleNotes,
  onToggleMic,
  onToggleCam,
  onToggleShare,
  onToggleRaiseHand,
  raisedHand,
  participationAck = null,
  onToggleUnderstood,
  onToggleAgree,
  onEndOrLeave,
  isLecturer
}) {
  const dockNarrow = useSyncExternalStore(
    (cb) => mqSubscribe(MQ_DOCK_NARROW, cb),
    () => mqMatches(MQ_DOCK_NARROW),
    () => false
  );
  const dockMicro = useSyncExternalStore(
    (cb) => mqSubscribe(MQ_DOCK_MICRO, cb),
    () => mqMatches(MQ_DOCK_MICRO),
    () => false
  );
  const density = dockMicro ? 'micro' : dockNarrow ? 'tight' : 'cozy';
  const chatActive = sidebarOpen && sidebarTab === 'chat';
  const peopleActive = sidebarOpen && sidebarTab === 'participants';
  const notesActive = notesOpen;
  const showShare = role === 'lecturer';

  return (
    <div className={styles.anchor} role="toolbar" aria-label="Class controls">
      <div className={styles.pill} data-density={density}>
        <div className={styles.group}>
          <DockItem
            label="Chat"
            pressed={chatActive}
            activeClass={styles.dockItemActive}
            onClick={onToggleChat}
            title={chatActive ? 'Close chat' : 'Open chat'}
          >
            <IconChat />
          </DockItem>
          <DockItem
            label="People"
            pressed={peopleActive}
            activeClass={styles.dockItemActive}
            onClick={onTogglePeople}
            title="People & session"
          >
            <IconPeople />
          </DockItem>
          <DockItem
            label="Notes"
            pressed={notesActive}
            activeClass={styles.dockItemActive}
            onClick={onToggleNotes}
            title={notesActive ? 'Close notes' : 'Session notes'}
          >
            <IconNotes />
          </DockItem>
        </div>

        <div className={styles.divider} aria-hidden />

        <div className={styles.group}>
          <ReactionPopover
            dockLayout
            raisedHand={raisedHand}
            participationAck={participationAck}
            participationLocked={participationLocked}
            onToggleRaiseHand={onToggleRaiseHand}
            onToggleUnderstood={onToggleUnderstood}
            onToggleAgree={onToggleAgree}
            compact={dockNarrow || dockMicro}
          />
        </div>

        <div className={styles.divider} aria-hidden />

        <div className={styles.group}>
          {showShare ? (
            <DockItem
              label="Share"
              pressed={screenSharing}
              activeClass={styles.dockItemActive}
              onClick={onToggleShare}
              title={screenSharing ? 'Stop sharing' : 'Share screen'}
            >
              <IconShare active={screenSharing} />
            </DockItem>
          ) : null}
          <DockItem
            label="Camera"
            pressed={camOn}
            activeClass={styles.dockItemActive}
            offClass={!camOn ? styles.dockItemWarn : ''}
            onClick={onToggleCam}
            title={camOn ? 'Turn camera off' : 'Turn camera on'}
          >
            <IconCam off={!camOn} />
          </DockItem>
          <DockItem
            label="Mic"
            pressed={micOn}
            activeClass={styles.dockItemActive}
            offClass={!micOn ? styles.dockItemWarn : ''}
            onClick={onToggleMic}
            title={micOn ? 'Mute microphone' : 'Unmute microphone'}
          >
            <IconMic muted={!micOn} />
          </DockItem>
        </div>

        <div className={styles.divider} aria-hidden />

        <button
          type="button"
          className={isLecturer ? styles.leaveLecturer : styles.leaveStudent}
          onClick={onEndOrLeave}
          title={isLecturer ? 'End class for everyone' : 'Leave class'}
        >
          <IconHangUp />
          <span>{isLecturer ? 'End' : 'Leave'}</span>
        </button>
      </div>
    </div>
  );
}
