import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AgentPeek } from '../../components/agents-section/agent-peek';
import { AgentTable } from '../../components/agents-section/agent-table';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { useToast } from '../../components/ui/toast';
import { useAgentsContext } from '../../hooks/useAgents';
import type { SaveAgentResult } from '../../hooks/useAgents';
import { useTools } from '../../hooks/useTools';
import { newAgentDraft } from '../../lib/agent-draft';
import { agentPatch, hasAgentChanges } from '../../lib/agent-edit';
import type { Agent, AgentDraft, AgentPatch } from '../../types/agent';
import type { Tool } from '../../types/tool';
import './agents.css';

interface SavedAgentEditorProps {
  agent: Agent;
  tools: readonly Tool[];
  saveAgent: (id: string, patch: AgentPatch) => Promise<SaveAgentResult>;
  focusName: boolean;
  onNameFocused: () => void;
  operationError?: string;
  onRetryOperation: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const SavedAgentEditor = ({
  agent,
  tools,
  saveAgent,
  focusName,
  onNameFocused,
  operationError,
  onRetryOperation,
  onDelete,
  onClose,
}: SavedAgentEditorProps) => {
  const [baseline, setBaseline] = useState(agent);
  const [edited, setEdited] = useState(agent);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const dirty = hasAgentChanges(baseline, edited);

  const onSave = async () => {
    const patch = agentPatch(baseline, edited);
    if (Object.keys(patch).length === 0 || saving) return;

    const submitted = edited;
    setSaving(true);
    setSaveError(undefined);
    const result = await saveAgent(agent.id, patch);
    setSaving(false);

    if (!result.ok) {
      setSaveError(result.message);
      return;
    }

    setBaseline(result.agent);
    setEdited((current) => ({ ...result.agent, ...agentPatch(submitted, current) }));
  };

  return (
    <AgentPeek
      agent={edited}
      tools={tools}
      dirty={dirty}
      saving={saving}
      saveError={saveError}
      focusName={focusName}
      onNameFocused={onNameFocused}
      operationError={operationError}
      onRetryOperation={onRetryOperation}
      onChange={(patch) => {
        setEdited((current) => ({ ...current, ...patch }));
        setSaveError(undefined);
      }}
      onSave={() => void onSave()}
      onDelete={onDelete}
      onClose={onClose}
    />
  );
};

const AgentsPage = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const { show } = useToast();
  const {
    agents,
    loading,
    error,
    operationError,
    creating,
    saveDraft,
    duplicateAgent,
    deleteAgent,
    saveAgent,
    retryOperation,
    reload,
  } = useAgentsContext();
  const { tools } = useTools();
  const [filter, setFilter] = useState('');
  const [focusNameId, setFocusNameId] = useState<string | null>(null);
  // The draft lives here and nowhere else, so abandoning it costs one setState
  // and leaves no row on the server and no entry in the shared agent list.
  const [draft, setDraft] = useState<AgentDraft | null>(null);

  const query = filter.trim().toLowerCase();

  const visible = useMemo(() => {
    if (query.length === 0) return agents;
    return agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(query) || agent.description.toLowerCase().includes(query),
    );
  }, [agents, query]);

  const onCreate = () => {
    // A draft and an open agent are the same slot on screen, so the panel that
    // was open closes first.
    navigate('/agents');
    setDraft(newAgentDraft());
  };

  const onSaveDraft = async () => {
    if (!draft) return;
    const created = await saveDraft(draft);
    if (!created) return;
    setDraft(null);
    navigate(`/agents/${created.id}`);
  };

  const onRetryOperation = async () => {
    const result = await retryOperation();
    if (!result) return;

    if (result.kind === 'duplicate' && result.agent) {
      navigate(`/agents/${result.agent.id}`);
    } else if (result.kind === 'delete' && result.deleted) {
      show('Agent deleted');
      if (agentId === result.agentId) navigate('/agents');
    }
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

        {/*
          A failure belongs next to the control that caused it. Delete reports
          inside the open agent's panel, create inside the draft's — the banner
          takes only what has nowhere else to go.
        */}
        {operationError &&
          operationError.kind !== 'create' &&
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
          <Button variant="primary" onClick={onCreate}>
            New agent
          </Button>
        </div>

        {!loading && !error && agents.length === 0 && (
          <EmptyState
            icon="▤"
            title="No agents yet."
            body="Create your first agent to start testing."
            action={{ label: 'New agent', onClick: onCreate }}
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

      {draft && (
        <AgentPeek
          mode="draft"
          // Shaped as an Agent for the shared form; the blanks are never read,
          // because draft mode hides the fields that would show them.
          agent={{ ...draft, id: '', createdAt: '', updatedAt: '' }}
          tools={tools}
          focusName
          saving={creating}
          operationError={
            operationError?.kind === 'create' ? operationError.message : undefined
          }
          onChange={(patch) => setDraft((current) => (current ? { ...current, ...patch } : current))}
          onDelete={() => {}}
          onSaveDraft={() => void onSaveDraft()}
          onClose={() => setDraft(null)}
        />
      )}

      {!draft && selected && (
        <SavedAgentEditor
          key={selected.id}
          agent={selected}
          tools={tools}
          saveAgent={saveAgent}
          focusName={focusNameId === selected.id}
          onNameFocused={() => setFocusNameId(null)}
          operationError={
            operationError?.kind === 'delete' && operationError.agentId === selected.id
              ? operationError.message
              : undefined
          }
          onRetryOperation={() => void onRetryOperation()}
          onDelete={() => void onDelete(selected.id)}
          onClose={closePeek}
        />
      )}
    </div>
  );
};

export default AgentsPage;
