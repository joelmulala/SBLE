import React, { useMemo, useState } from 'react';
import api from '../../config/api';
import {
  AssessmentAlert,
  AssessmentMeta,
  AssessmentEmpty,
  BtnPrimary,
  BtnSecondary,
  BtnDanger,
  Field,
  TextInput,
  TextArea
} from '../assessment/AssessmentPrimitives';
import { itemTypeLabel, countUnassigned } from './courseModuleUtils';
import s from './CourseModules.module.css';

const PLACEHOLDER_TYPES = [
  { value: 'communications', label: 'Announcements link' },
  { value: 'live', label: 'Live class link' },
  { value: 'link', label: 'External link' }
];

export default function LecturerModuleBuilder({ courseId, structure, onChanged }) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [newModule, setNewModule] = useState({ title: '', description: '' });
  const [placeholder, setPlaceholder] = useState({ moduleId: '', type: 'communications', title: '', linkUrl: '' });

  const modules = structure?.modules || [];
  const unassigned = structure?.unassigned || {};

  const unassignedOptions = useMemo(() => {
    const options = [];
    Object.entries(unassigned).forEach(([bucket, items]) => {
      (items || []).forEach((item) => {
        options.push({
          key: `${item.type}-${item.id}`,
          itemType: item.type,
          itemId: item.id,
          label: `${itemTypeLabel(item.type)}: ${item.title}`
        });
      });
    });
    return options;
  }, [unassigned]);

  const [assignSelection, setAssignSelection] = useState('');
  const [assignModuleId, setAssignModuleId] = useState('');

  const run = async (fn) => {
    setSaving(true);
    setError('');
    try {
      await fn();
      await onChanged?.();
    } catch (err) {
      setError(err?.response?.data?.error || 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  const createModule = () => run(async () => {
    if (!newModule.title.trim()) {
      setError('Module title is required');
      return;
    }
    await api.post(`/courses/${courseId}/modules`, newModule);
    setNewModule({ title: '', description: '' });
  });

  const moveModule = (index, direction) => run(async () => {
    const ids = modules.map((m) => m.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await api.put(`/courses/${courseId}/modules/reorder`, { moduleIds: ids });
  });

  const togglePublish = (mod) => run(async () => {
    await api.patch(`/courses/${courseId}/modules/${mod.id}`, {
      is_published: !mod.isPublished
    });
  });

  const removeModule = (mod) => {
    if (!window.confirm(`Delete module "${mod.title}"? Items will become unassigned.`)) return;
    run(async () => {
      await api.delete(`/courses/${courseId}/modules/${mod.id}`);
    });
  };

  const assignResource = () => run(async () => {
    if (!assignSelection || !assignModuleId) {
      setError('Select a resource and target module');
      return;
    }
    const dash = assignSelection.indexOf('-');
    const itemType = assignSelection.slice(0, dash);
    const itemId = assignSelection.slice(dash + 1);
    await api.patch(`/courses/${courseId}/modules/assign`, {
      itemType,
      itemId: Number(itemId),
      moduleId: Number(assignModuleId)
    });
    setAssignSelection('');
  });

  const addPlaceholder = () => run(async () => {
    if (!placeholder.moduleId) {
      setError('Select a module for the placeholder');
      return;
    }
    await api.post(`/courses/${courseId}/modules/${placeholder.moduleId}/items`, {
      item_type: placeholder.type,
      title: placeholder.title || undefined,
      link_url: placeholder.linkUrl || undefined
    });
    setPlaceholder((prev) => ({ ...prev, title: '', linkUrl: '' }));
  });

  const unassignItem = (itemType, itemId) => run(async () => {
    await api.patch(`/courses/${courseId}/modules/assign`, {
      itemType,
      itemId,
      moduleId: null
    });
  });

  const removePlaceholder = (moduleId, itemId) => run(async () => {
    await api.delete(`/courses/${courseId}/modules/${moduleId}/items/${itemId}`);
  });

  const moveItemInModule = (module, itemIndex, direction) => run(async () => {
    const items = [...(module.items || [])];
    const target = itemIndex + direction;
    if (target < 0 || target >= items.length) return;
    [items[itemIndex], items[target]] = [items[target], items[itemIndex]];
    await api.put(`/courses/${courseId}/modules/${module.id}/items/reorder`, { items });
  });

  return (
    <div>
      {error ? <AssessmentAlert>{error}</AssessmentAlert> : null}

      <section className={s.builderPanel}>
        <h3 className={s.sidebarTitle}>Add learning module</h3>
        <div className={s.builderForm}>
          <Field label="Module title">
            <TextInput
              value={newModule.title}
              onChange={(e) => setNewModule((p) => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Week 1 — Introduction"
            />
          </Field>
          <Field label="Description (optional)">
            <TextArea
              rows={2}
              value={newModule.description}
              onChange={(e) => setNewModule((p) => ({ ...p, description: e.target.value }))}
              placeholder="Learning objectives or weekly overview"
            />
          </Field>
        </div>
        <BtnPrimary type="button" disabled={saving} onClick={createModule}>
          {saving ? 'Saving...' : 'Create module'}
        </BtnPrimary>
      </section>

      {modules.length === 0 ? (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <AssessmentEmpty>
            No modules yet. Create your first module to organize course content.
          </AssessmentEmpty>
        </div>
      ) : (
        <div className={s.moduleList} style={{ marginTop: 'var(--space-5)' }}>
          {modules.map((mod, index) => (
            <article key={mod.id} className={`${s.moduleCard} ${mod.isPublished === false ? s.moduleCardDraft : ''}`}>
              <div className={s.moduleHeader} style={{ cursor: 'default' }}>
                <div className={s.moduleTitleWrap}>
                  <h3 className={s.moduleTitle}>{mod.title}</h3>
                  <span className={s.moduleMeta}>
                    {mod.items?.length || 0} items · {mod.isPublished ? 'Published' : 'Draft'}
                  </span>
                </div>
                <div className={s.builderActions}>
                  <div className={s.orderControls}>
                    <button type="button" className={s.orderBtn} disabled={saving || index === 0} onClick={() => moveModule(index, -1)} aria-label="Move up">↑</button>
                    <button type="button" className={s.orderBtn} disabled={saving || index === modules.length - 1} onClick={() => moveModule(index, 1)} aria-label="Move down">↓</button>
                  </div>
                  <BtnSecondary type="button" disabled={saving} onClick={() => togglePublish(mod)}>
                    {mod.isPublished ? 'Unpublish' : 'Publish'}
                  </BtnSecondary>
                  <BtnDanger type="button" disabled={saving} onClick={() => removeModule(mod)}>Delete</BtnDanger>
                </div>
              </div>

              <div className={s.moduleBody}>
                {mod.description ? <p className={s.moduleDescription}>{mod.description}</p> : null}
                <ul className={s.itemList}>
                  {(mod.items || []).map((item, itemIndex) => (
                    <li key={`${item.type}-${item.id}`} className={s.itemRow}>
                      <div className={s.itemMain}>
                        <span className={s.itemTitle}>{item.title}</span>
                        <span className={s.itemSub}>{itemTypeLabel(item.type)}</span>
                      </div>
                      <div className={s.builderActions}>
                        <div className={s.orderControls}>
                          <button type="button" className={s.orderBtn} disabled={saving || itemIndex === 0} onClick={() => moveItemInModule(mod, itemIndex, -1)}>↑</button>
                          <button type="button" className={s.orderBtn} disabled={saving || itemIndex === mod.items.length - 1} onClick={() => moveItemInModule(mod, itemIndex, 1)}>↓</button>
                        </div>
                        {['material', 'assignment', 'quiz', 'exam'].includes(item.type) ? (
                          <BtnSecondary type="button" disabled={saving} onClick={() => unassignItem(item.type, item.id)}>
                            Unassign
                          </BtnSecondary>
                        ) : (
                          <BtnDanger type="button" disabled={saving} onClick={() => removePlaceholder(mod.id, item.id)}>
                            Remove
                          </BtnDanger>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      )}

      {countUnassigned(unassigned) > 0 ? (
        <section className={`${s.builderPanel} ${s.unassignedBlock}`}>
          <h3 className={s.sidebarTitle}>Assign unorganized content</h3>
          <AssessmentMeta>{countUnassigned(unassigned)} resources not in a module</AssessmentMeta>
          <div className={`${s.assignRow} ${s.builderActions}`} style={{ marginTop: 'var(--space-3)' }}>
            <select className={s.selectInput} value={assignSelection} onChange={(e) => setAssignSelection(e.target.value)}>
              <option value="">Select resource</option>
              {unassignedOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
            <select className={s.selectInput} value={assignModuleId} onChange={(e) => setAssignModuleId(e.target.value)}>
              <option value="">Target module</option>
              {modules.map((mod) => (
                <option key={mod.id} value={mod.id}>{mod.title}</option>
              ))}
            </select>
            <BtnPrimary type="button" disabled={saving} onClick={assignResource}>Assign</BtnPrimary>
          </div>
        </section>
      ) : null}

      {modules.length > 0 ? (
        <section className={`${s.builderPanel} ${s.unassignedBlock}`}>
          <h3 className={s.sidebarTitle}>Add module link or placeholder</h3>
          <div className={`${s.builderForm} ${s.assignRow}`}>
            <select className={s.selectInput} value={placeholder.moduleId} onChange={(e) => setPlaceholder((p) => ({ ...p, moduleId: e.target.value }))}>
              <option value="">Module</option>
              {modules.map((mod) => (
                <option key={mod.id} value={mod.id}>{mod.title}</option>
              ))}
            </select>
            <select className={s.selectInput} value={placeholder.type} onChange={(e) => setPlaceholder((p) => ({ ...p, type: e.target.value }))}>
              {PLACEHOLDER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <TextInput
              value={placeholder.title}
              onChange={(e) => setPlaceholder((p) => ({ ...p, title: e.target.value }))}
              placeholder="Display title (optional)"
            />
            {placeholder.type === 'link' ? (
              <TextInput
                value={placeholder.linkUrl}
                onChange={(e) => setPlaceholder((p) => ({ ...p, linkUrl: e.target.value }))}
                placeholder="https://..."
              />
            ) : null}
            <BtnSecondary type="button" disabled={saving} onClick={addPlaceholder}>Add placeholder</BtnSecondary>
          </div>
        </section>
      ) : null}
    </div>
  );
}
