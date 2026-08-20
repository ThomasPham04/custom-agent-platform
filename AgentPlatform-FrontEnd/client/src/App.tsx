import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BrowserRouter } from 'react-router';
import { Sidebar } from './components/layout/Sidebar';
import {
  SIDEBAR_WIDTH_DEFAULT,
  SidebarResizer,
  clampSidebarWidth,
} from './components/layout/sidebar-resizer';
import { TopBar } from './components/layout/TopBar';
import { Workspace } from './components/layout/Workspace';
import { ToastProvider } from './components/ui/toast';
import { BREAKPOINT_SIDEBAR, useMediaQuery } from './hooks/useMediaQuery';
import { AgentsProvider, useAgentsContext } from './hooks/useAgents';
import { SessionsProvider } from './hooks/useSessions';
import { WalkthroughProvider } from './hooks/useWalkthrough';
import AppRoutes from './pages';
import './App.css';

const SIDEBAR_WIDTH_KEY = 'agentPlatform.sidebarWidth';

const storedSidebarWidth = () => {
  const stored = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
  return stored ? clampSidebarWidth(stored) : SIDEBAR_WIDTH_DEFAULT;
};

const Shell = () => {
  const { agents } = useAgentsContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(storedSidebarWidth);
  const menuRef = useRef<HTMLButtonElement>(null);
  const isNarrow = useMediaQuery(BREAKPOINT_SIDEBAR);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  // A wide viewport has no drawer to leave open.
  useEffect(() => {
    if (!isNarrow) setSidebarOpen(false);
  }, [isNarrow]);

  useEffect(() => {
    if (!isNarrow || !sidebarOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isNarrow, sidebarOpen]);

  /*
    Set here rather than on :root so Sidebar.css picks it up by inheritance and
    nothing else has to know the sidebar can be resized. The cast is only
    because CSSProperties has no index signature for custom properties.
  */
  const shellStyle = { '--sidebar-width': `${sidebarWidth}px` } as CSSProperties;

  return (
    <div className="app" style={shellStyle}>
      <a
        className="app__skip"
        href="#workspace-content"
        inert={isNarrow && sidebarOpen ? true : undefined}
        aria-hidden={isNarrow && sidebarOpen ? 'true' : undefined}
      >
        Skip to content
      </a>

      <Sidebar
        agents={agents}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isDrawer={isNarrow}
        returnFocusRef={menuRef}
      />

      <SidebarResizer width={sidebarWidth} onResize={setSidebarWidth} />

      {isNarrow && sidebarOpen && (
        <button
          type="button"
          className="app__scrim"
          aria-label="Close sidebar"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Workspace inert={isNarrow && sidebarOpen}>
        <TopBar
          menuRef={menuRef}
          onOpenSidebar={() => setSidebarOpen(true)}
          showMenuButton={isNarrow}
        />
        <AppRoutes />
      </Workspace>
    </div>
  );
};

const App = () => (
  <BrowserRouter>
    <ToastProvider>
      {/* One agent list for the whole app: sidebar, Agents, and Chat share it. */}
      <AgentsProvider>
        {/* One session list for the whole app: the sidebar and the chat page share it. */}
        <SessionsProvider>
          <WalkthroughProvider>
            <Shell />
          </WalkthroughProvider>
        </SessionsProvider>
      </AgentsProvider>
    </ToastProvider>
  </BrowserRouter>
);

export default App;
