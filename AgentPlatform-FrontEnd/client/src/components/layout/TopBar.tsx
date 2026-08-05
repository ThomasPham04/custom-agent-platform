import type { ReactNode } from 'react';
import './TopBar.css';

interface TopBarProps {
  onOpenSidebar: () => void;
  showMenuButton: boolean;
  children?: ReactNode;
}

export const TopBar = ({ onOpenSidebar, showMenuButton, children }: TopBarProps) => {
  if (!showMenuButton && !children) return null;

  return (
    <header className="topbar">
      {showMenuButton && (
        <button
          type="button"
          className="topbar__menu"
          onClick={onOpenSidebar}
          aria-label="Open sidebar"
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
            <path
              d="M2 4h12M2 8h12M2 12h12"
              stroke="currentColor"
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
      {children}
    </header>
  );
};
