import { Link, Navigate, Route, Routes } from 'react-router';
import AgentsPage from './Agents';
import ChatPage from './Chat';

interface AppRoutesProps {
  searchQuery: string;
  onClearSearch: () => void;
}

const NotFound = () => (
  <div className="agents">
    <h1 className="agents__title">Nothing here</h1>
    <p className="agents__subtitle">
      That address does not match a surface. <Link to="/agents">Go to Agents</Link>.
    </p>
  </div>
);

const AppRoutes = ({ searchQuery, onClearSearch }: AppRoutesProps) => (
  <Routes>
    <Route path="/" element={<Navigate to="/agents" replace />} />
    <Route
      path="/agents"
      element={<AgentsPage searchQuery={searchQuery} onClearSearch={onClearSearch} />}
    />
    <Route
      path="/agents/:agentId"
      element={<AgentsPage searchQuery={searchQuery} onClearSearch={onClearSearch} />}
    />
    <Route path="/chat" element={<ChatPage />} />
    <Route path="/chat/:agentId" element={<ChatPage />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

export default AppRoutes;
