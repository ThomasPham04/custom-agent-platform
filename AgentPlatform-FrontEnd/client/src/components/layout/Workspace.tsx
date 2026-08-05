import type { ReactNode } from 'react';
import './Workspace.css';

export const Workspace = ({ children }: { children: ReactNode }) => (
  <main className="workspace" id="workspace-content" tabIndex={-1}>
    {children}
  </main>
);
