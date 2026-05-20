import React from 'react';
import { WorkspacePageShell } from '../ui';

/**
 * @deprecated Layout owns the page title. Use WorkspacePageShell + PageActions instead.
 */
export default function AdminPageHeader({ lead, actions = null }) {
  return (
    <WorkspacePageShell lead={lead}>
      {actions ? <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>{actions}</div> : null}
    </WorkspacePageShell>
  );
}
