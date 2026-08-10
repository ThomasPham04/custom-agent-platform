import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AgentPeek } from '../../components/agents-section/agent-peek';
import { AgentTable } from '../../components/agents-section/agent-table';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { useToast } from '../../components/ui/toast';
import { useAgentsContext } from '../../hooks/useAgents';
import { useTools } from '../../hooks/useTools';
import './agents.css';

interface AgentsPageProps {
  searchQuery: string;
  onClearSearch: () => void;
}

const AgentsPage = ({ searchQuery, onClearSearch }: AgentsPageProps) => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const { show } = useToast();
  const {
    agents,
    loading,
    error,
    saveStates,
    operationError,
    createAgent,
    duplicateAgent,
    deleteAgent,
    updateAgent,
    flushUpdates,
    retrySave,
    retryOperation,
    reload,
  } = useAgentsContext();
  const { tools } = useTools();
  const [filter, setFilter] = useState('');
  const [focusNameId, setFocusNameId] = useState<string | null>(null);

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
    if (created) {
      setFocusNameId(created.id);
      navigate(`/agents/${created.id}`);
    }
  };

  const onRetryOperation = async () => {
    const result = await retryOperation();
    if (!result) return;

    if ((result.kind === 'create' || result.kind === 'duplicate') && result.agent) {
      if (result.kind === 'create') setFocusNameId(result.agent.id);
      navigate(`/agents/${result.agent.id}`);
    } else if (result.kind === 'delete' && result.deleted) {
      show('Agent deleted');
      if (agentId === result.agentId) navigate('/agents');
    }
  };

  const clearActiveFilter = () => {
    setFilter('');
    onClearSearch();
  };

  const onDelete = async (id: string) => {
    if (await deleteAgent(id)) {
      show('Agent deleted');
      if (agentId === id) navigate('/agents');
    }
  };

  const selected = agents.find((agent) => agent.id === agentId) ?? null;

  const closePeek = () => {
    const returnTo = agentId;
    navigate('/agents');
    // Return focus to the row that opened the panel.
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-agent-row="${returnTo}"]`)?.focus();
    });
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
              Reload
            </button>
          </p>
        )}

        {operationError &&
          !(operationError.kind === 'delete' && operationError.agentId === selected?.id) && (
          <p className="agents__error" role="alert">
            {operationError.message}{' '}
            <button
              type="button"
              className="agents__retry"
              onClick={() => void onRetryOperation()}
            >
              Retry
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

        {!loading && !error && agents.length === 0 && (
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
            action={{ label: 'Clear filter', onClick: clearActiveFilter }}
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

      {selected && (
        <AgentPeek
          agent={selected}
          tools={tools}
          saveState={saveStates[selected.id] ?? { kind: 'idle' }}
          focusName={focusNameId === selected.id}
          onNameFocused={() => setFocusNameId(null)}
          operationError={
            operationError?.kind === 'delete' && operationError.agentId === selected.id
              ? operationError.message
              : undefined
          }
          onRetryOperation={() => void onRetryOperation()}
          onChange={(patch) => updateAgent(selected.id, patch)}
          onFlush={() => void flushUpdates(selected.id)}
          onRetrySave={() => retrySave(selected.id)}
          onDelete={() => void onDelete(selected.id)}
          onClose={closePeek}
        />
      )}
    </div>
  );
};

export default AgentsPage;
