import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { AgentPeek } from '../../components/agents-section/agent-peek';
import { AgentTable } from '../../components/agents-section/agent-table';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { Magnifier } from '../../components/ui/magnifier';
import { useToast } from '../../components/ui/toast';
import { useAgentsContext } from '../../hooks/useAgents';
import type { SaveAgentResult } from '../../hooks/useAgents';
import { useTools } from '../../hooks/useTools';
import { newAgentDraft } from '../../lib/agent-draft';
import { agentPatch, hasAgentChanges } from '../../lib/agent-edit';
import { hasFieldErrors, validateAgent } from '../../lib/agent-validation';
import { apiUrl } from '../../lib/api-host';
import type { Agent, AgentDraft, AgentPatch } from '../../types/agent';
import type { Tool } from '../../types/tool';
import type { TriggerDraft } from '../../types/trigger';
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

const runLogFilename = (agent: Agent): string => {
  const name = agent.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const date = new Date().toISOString().slice(0, 10);
  return `${name || 'agent'}-run-logs-${date}.json`;
};

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
  // Latched by the first rejected save, so the panel stays quiet while a field
  // is merely half-typed. After that the messages track the value live.
  const [checked, setChecked] = useState(false);
  const dirty = hasAgentChanges(baseline, edited);
  const errors = checked ? validateAgent(edited) : {};

  const onSave = async () => {
    if (saving) return;

    const found = validateAgent(edited);
    if (hasFieldErrors(found)) {
      setChecked(true);
      return;
    }
    setChecked(false);

    const patch = agentPatch(baseline, edited);
    if (Object.keys(patch).length === 0) return;

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
      errors={errors}
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
  const location = useLocation();
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
  // Route-driven so the walkthrough (and a deep link) can open it from outside
  // this component: /agents/new means "draft open", anything else means closed.
  const [draft, setDraft] = useState<AgentDraft | null>(null);
  const isNewRoute = location.pathname === '/agents/new';
  const [draftTriggers, setDraftTriggers] = useState<TriggerDraft[]>([]);
  const [draftChecked, setDraftChecked] = useState(false);

  // A draft and an open agent are the same slot on screen, so opening one
  // closes the other. Idempotent under StrictMode's double-invoke: the
  // functional update only creates a draft when one doesn't already exist.
  useEffect(() => {
    setDraft((current) => {
      if (!isNewRoute) return null;
      return current ?? newAgentDraft();
    });
    if (!isNewRoute) {
      setDraftTriggers([]);
      setDraftChecked(false);
    }
  }, [isNewRoute]);

  const query = filter.trim().toLowerCase();

  const visible = useMemo(() => {
    if (query.length === 0) return agents;
    return agents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(query) || agent.description.toLowerCase().includes(query),
    );
  }, [agents, query]);

  const onCreate = () => {
    navigate('/agents/new');
  };

  const onSaveDraft = async () => {
    if (!draft) return;

    const found = validateAgent(draft);
    if (hasFieldErrors(found)) {
      setDraftChecked(true);
      return;
    }
    setDraftChecked(false);

    const created = await saveDraft(draft, draftTriggers);
    if (!created) return;
    setDraft(null);
    setDraftTriggers([]);
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

  const onDownloadRunLogs = (id: string) => {
    const agent = agents.find((candidate) => candidate.id === id);
    if (!agent) return;

    const link = document.createElement('a');
    link.href = apiUrl(`/api/runs/export?agentId=${encodeURIComponent(id)}`);
    link.download = runLogFilename(agent);
    link.click();
    show('Run-log download started.');
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
          !(operationError.kind === 'create' && draft) &&
          !(operationError.kind === 'delete' && operationError.agentId === selected?.id) && (
          <p className="agents__error" role="alert">
            {operationError.message}
            {operationError.kind !== 'create' && (
              <>
                {' '}
                <button
                  type="button"
                  className="agents__retry"
                  onClick={() => void onRetryOperation()}
                >
                  Retry
                </button>
              </>
            )}
          </p>
          )}

        <div className="agents__viewbar" data-walkthrough="agents-viewbar">
          <span className="agents__count mono">
            {agents.length} {agents.length === 1 ? 'agent' : 'agents'}
          </span>
          <div className="agents__filter">
            <input
              type="search"
              className="agents__filter-input"
              aria-label="Filter agents"
              placeholder="Filter…"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
            <Magnifier className="agents__filter-icon" />
          </div>
          <Button variant="primary" data-walkthrough="agents-new" onClick={onCreate}>
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
            onDownloadRunLogs={onDownloadRunLogs}
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
          draftTriggers={draftTriggers}
          onDraftTriggersChange={setDraftTriggers}
          focusName
          saving={creating}
          errors={draftChecked ? validateAgent(draft) : {}}
          operationError={
            operationError?.kind === 'create' ? operationError.message : undefined
          }
          onChange={(patch) => setDraft((current) => (current ? { ...current, ...patch } : current))}
          onDelete={() => {}}
          onSaveDraft={() => void onSaveDraft()}
          onClose={() => navigate('/agents')}
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
