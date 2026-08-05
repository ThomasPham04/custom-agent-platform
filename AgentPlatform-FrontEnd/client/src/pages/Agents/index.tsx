import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AgentTable } from '../../components/agents-section/agent-table';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { useToast } from '../../components/ui/toast';
import { useAgentsContext } from '../../hooks/useAgents';
import { useTools } from '../../hooks/useTools';
import './agents.css';

interface AgentsPageProps {
  searchQuery: string;
}

const AgentsPage = ({ searchQuery }: AgentsPageProps) => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const { show } = useToast();
  const { agents, loading, error, createAgent, duplicateAgent, deleteAgent, reload } =
    useAgentsContext();
  const { tools } = useTools();
  const [filter, setFilter] = useState('');

  // The sidebar search and the local filter mean the same thing to the reader.
  const query = (searchQuery || filter).trim().toLowerCase();

  const visible = useMemo(() => {
    if (query.length === 0) return agents;
    return agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(query) || agent.description.toLowerCase().includes(query),
    );
  }, [agents, query]);

  const onCreate = async () => {
    const created = await createAgent();
    if (created) navigate(`/agents/${created.id}`);
  };

  const onDelete = async (id: string) => {
    if (await deleteAgent(id)) {
      show('Agent deleted');
      if (agentId === id) navigate('/agents');
    }
  };

  return (
    <div className="agents-surface">
      <div className="agents">
        <h1 className="agents__title">Agents</h1>
        <p className="agents__subtitle">Configure agents and the tools they can reach.</p>

        {error && (
          <p className="agents__error" role="alert">
            {error}{' '}
            <button type="button" className="agents__retry" onClick={() => void reload()}>
              Try again
            </button>
          </p>
        )}

        <div className="agents__viewbar">
          <span className="agents__count mono">
            {agents.length} {agents.length === 1 ? 'agent' : 'agents'}
          </span>
          <input
            type="search"
            className="agents__filter"
            aria-label="Filter agents"
            placeholder="Filter…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <Button variant="primary" onClick={() => void onCreate()}>
            New agent
          </Button>
        </div>

        {!loading && agents.length === 0 && (
          <EmptyState
            icon="▤"
            title="No agents yet."
            body="Create your first agent to start testing."
            action={{ label: 'New agent', onClick: () => void onCreate() }}
          />
        )}

        {!loading && agents.length > 0 && visible.length === 0 && (
          <EmptyState
            title={`No agents match “${query}”.`}
            body="Try a shorter search, or clear the filter to see everything."
            action={{ label: 'Clear filter', onClick: () => setFilter('') }}
          />
        )}

        {(loading || visible.length > 0) && (
          <AgentTable
            agents={visible}
            tools={tools}
            loading={loading}
            selectedId={agentId ?? null}
            onSelect={(id) => navigate(`/agents/${id}`)}
            onTestInChat={(id) => navigate(`/chat/${id}`)}
            onDuplicate={(id) => {
              void duplicateAgent(id).then((copy) => {
                if (copy) navigate(`/agents/${copy.id}`);
              });
            }}
            onDelete={(id) => void onDelete(id)}
          />
        )}
      </div>
    </div>
  );
};

export default AgentsPage;
