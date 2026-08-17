import { Link, Navigate, Route, Routes } from 'react-router';
import AgentsPage from './Agents';
import ChatPage from './Chat';

const NotFound = () => (
  <div className="agents">
    <h1 className="agents__title">Nothing here</h1>
    <p className="agents__subtitle">
      That address does not match a surface. <Link to="/agents">Go to Agents</Link>.
    </p>
  </div>
);

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/agents" replace />} />
    <Route path="/agents" element={<AgentsPage />} />
    <Route path="/agents/:agentId" element={<AgentsPage />} />
    <Route path="/chat" element={<ChatPage />} />
    {/* One param, two id kinds: sess_* opens that chat, agent_* opens the
        agent's most recent one. */}
    <Route path="/chat/:id" element={<ChatPage />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

export default AppRoutes;
