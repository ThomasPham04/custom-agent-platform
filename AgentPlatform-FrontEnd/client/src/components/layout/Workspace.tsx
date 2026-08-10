import type { ReactNode } from 'react';
import './Workspace.css';

interface WorkspaceProps {
  children: ReactNode;
  inert?: boolean;
}

export const Workspace = ({ children, inert = false }: WorkspaceProps) => (
  <main
    className="workspace"
    id="workspace-content"
    tabIndex={-1}
    inert={inert ? true : undefined}
    aria-hidden={inert ? 'true' : undefined}
  >
    {children}
  </main>
);
