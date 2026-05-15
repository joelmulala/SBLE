import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AssessmentMeta,
  AssessmentEmpty
} from '../assessment/AssessmentPrimitives';
import { itemTypeLabel, resolveItemHref, countUnassigned } from './courseModuleUtils';
import s from './CourseModules.module.css';

export default function CourseStructureView({
  structure,
  rolePrefix,
  courseId,
  defaultExpandedId = null
}) {
  const [expanded, setExpanded] = useState(() => {
    if (defaultExpandedId) return { [defaultExpandedId]: true };
    return {};
  });

  const modules = structure?.modules || [];
  const unassignedTotal = countUnassigned(structure?.unassigned);
  const liveSessions = structure?.liveSessions || [];

  const firstModuleId = modules[0]?.id;
  const effectiveExpanded = useMemo(() => {
    if (Object.keys(expanded).length > 0) return expanded;
    if (firstModuleId) return { [firstModuleId]: true };
    return {};
  }, [expanded, firstModuleId]);

  const toggle = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!modules.length && !unassignedTotal && !liveSessions.length) {
    return <AssessmentEmpty>Course content will appear here once your lecturer organizes learning modules.</AssessmentEmpty>;
  }

  return (
    <div className={s.moduleList}>
      {liveSessions.map((room) => (
        <div key={room.id} className={s.liveStrip}>
          <div>
            <strong>{room.title}</strong>
            <AssessmentMeta>Live session in progress</AssessmentMeta>
          </div>
          <Link to={`/room/${room.id}`} className={s.sidebarLink}>Join</Link>
        </div>
      ))}

      {modules.map((mod) => {
        const isOpen = Boolean(effectiveExpanded[mod.id]);
        return (
          <article
            key={mod.id}
            className={`${s.moduleCard} ${mod.isPublished === false ? s.moduleCardDraft : ''}`}
          >
            <button type="button" className={s.moduleHeader} onClick={() => toggle(mod.id)} aria-expanded={isOpen}>
              <div className={s.moduleTitleWrap}>
                <h3 className={s.moduleTitle}>{mod.title}</h3>
                <span className={s.moduleMeta}>
                  {mod.items?.length || 0} items
                  {mod.description ? ' · ' : ''}
                  {mod.description ? 'Includes overview' : ''}
                </span>
              </div>
              <span className={s.moduleMeta}>{isOpen ? '−' : '+'}</span>
            </button>

            {isOpen ? (
              <div className={s.moduleBody}>
                {mod.description ? <p className={s.moduleDescription}>{mod.description}</p> : null}
                {mod.items?.length ? (
                  <ul className={s.itemList}>
                    {mod.items.map((item) => (
                      <ModuleItemRow
                        key={`${item.type}-${item.id}`}
                        item={item}
                        courseId={courseId}
                        rolePrefix={rolePrefix}
                      />
                    ))}
                  </ul>
                ) : (
                  <AssessmentMeta>No items in this module yet.</AssessmentMeta>
                )}
              </div>
            ) : null}
          </article>
        );
      })}

      {unassignedTotal > 0 ? (
        <div className={s.unassignedBlock}>
          <h4 className={s.moduleTitle}>Additional course resources</h4>
          <AssessmentMeta>Items not yet placed in a module</AssessmentMeta>
          <ul className={s.itemList} style={{ marginTop: 'var(--space-3)' }}>
            {Object.entries(structure.unassigned).flatMap(([bucket, items]) => (
              (items || []).map((item) => (
                <ModuleItemRow
                  key={`${bucket}-${item.type}-${item.id}`}
                  item={item}
                  courseId={courseId}
                  rolePrefix={rolePrefix}
                />
              ))
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ModuleItemRow({ item, courseId, rolePrefix }) {
  const href = resolveItemHref({
    type: item.type,
    id: item.id,
    courseId,
    rolePrefix,
    meta: item.meta
  });

  const sub = item.meta?.dueDate
    ? `Due ${new Date(item.meta.dueDate).toLocaleString()}`
    : item.meta?.scheduledAt
      ? `Scheduled ${new Date(item.meta.scheduledAt).toLocaleString()}`
      : item.meta?.fileName || '';

  const content = (
    <>
      <div className={s.itemMain}>
        <span className={s.itemTitle}>{item.title}</span>
        {sub ? <span className={s.itemSub}>{sub}</span> : null}
      </div>
      <span className={s.typeBadge}>{itemTypeLabel(item.type)}</span>
    </>
  );

  if (!href) {
    return <li className={s.itemRow}>{content}</li>;
  }

  const external = href.startsWith('http');

  if (external) {
    return (
      <li>
        <a href={href} className={`${s.itemRow} ${s.itemRowLink}`} target="_blank" rel="noopener noreferrer">
          {content}
        </a>
      </li>
    );
  }

  return (
    <li>
      <Link to={href} className={`${s.itemRow} ${s.itemRowLink}`}>
        {content}
      </Link>
    </li>
  );
}
