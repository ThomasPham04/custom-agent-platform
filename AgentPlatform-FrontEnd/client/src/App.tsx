import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, useLocation, useNavigate } from 'react-router';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { Workspace } from './components/layout/Workspace';
import { ToastProvider } from './components/ui/toast';
import { BREAKPOINT_SIDEBAR, useMediaQuery } from './hooks/useMediaQuery';
import { AgentsProvider, useAgentsContext } from './hooks/useAgents';
import AppRoutes from './pages';
import './App.css';

const Shell = () => {
  const { agents } = useAgentsContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const isNarrow = useMediaQuery(BREAKPOINT_SIDEBAR);
  const navigate = useNavigate();
  const location = useLocation();

  // Searching is an Agents action, so typing moves you there.
  const onSearch = (query: string) => {
    setSearchQuery(query);
    if (query.length > 0 && !location.pathname.startsWith('/agents')) navigate('/agents');
  };

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

  return (
    <div className="app">
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
        onSearch={onSearch}
        searchQuery={searchQuery}
        isDrawer={isNarrow}
        returnFocusRef={menuRef}
      />

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
        <AppRoutes searchQuery={searchQuery} onClearSearch={() => setSearchQuery('')} />
      </Workspace>
    </div>
  );
};

const App = () => (
  <BrowserRouter>
    <ToastProvider>
      {/* One agent list for the whole app: sidebar, Agents, and Chat share it. */}
      <AgentsProvider>
        <Shell />
      </AgentsProvider>
    </ToastProvider>
  </BrowserRouter>
);

export default App;
