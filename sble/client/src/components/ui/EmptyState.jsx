import { WorkspaceEmpty } from './WorkspaceFeedback';

export default function EmptyState({ title, message, children, action }) {
  return (
    <WorkspaceEmpty
      title={title}
      message={message || (typeof children === 'string' ? children : undefined)}
      action={action}
    />
  );
}
