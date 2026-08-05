import './agents.css';

interface AgentsPageProps {
  searchQuery: string;
}

const AgentsPage = ({ searchQuery }: AgentsPageProps) => (
  <div className="agents">
    <h1 className="agents__title">Agents</h1>
    <p className="agents__subtitle">Configure agents and the tools they can reach.</p>
    {searchQuery && <p className="agents__subtitle">Filtering by “{searchQuery}”.</p>}
  </div>
);

export default AgentsPage;
