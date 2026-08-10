import type { ReactNode } from 'react';
import { Button } from '../button';
import './empty-state.css';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}

export const EmptyState = ({ icon, title, body, action }: EmptyStateProps) => (
  <div className="empty-state">
    {icon && <div className="empty-state__icon">{icon}</div>}
    {/* A <p>, not a heading: this must not compete with the page h1. */}
    <p className="empty-state__title">{title}</p>
    <p className="empty-state__body">{body}</p>
    {action && (
      <Button variant="primary" onClick={action.onClick}>
        {action.label}
      </Button>
    )}
  </div>
);
