import { useRef, useState, type ReactNode } from 'react';
import { Chip } from '../../ui/chip';
import { Select } from '../../ui/select';
import { AutoTextarea } from '../../ui/textarea';
import { ToolPicker } from '../tool-picker/tool-picker';
import { MODELS } from '../../../config/models';
import { formatRelativeTime } from '../../../lib/format';
import { toolLabel } from '../../../hooks/useTools';
import type { Agent, AgentPatch, AgentStatus } from '../../../types/agent';
import type { Tool } from '../../../types/tool';
import './agent-form.css';

interface AgentFormProps {
  agent: Agent;
  tools: readonly Tool[];
  onChange: (patch: AgentPatch) => void;
  triggerField?: ReactNode;
  /** False for an unsaved draft, which has no history to date. */
  showTimestamps?: boolean;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
];

const MODEL_OPTIONS = MODELS.map((model) => ({ value: model.id, label: model.label }));
const SYSTEM_PROMPT_MAX_LENGTH = 500;

export const AgentForm = ({
  agent,
  tools,
  onChange,
  triggerField,
  showTimestamps = true,
}: AgentFormProps) => {
  const toolButtonRef = useRef<HTMLButtonElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="agent-form">
      <div className="agent-form__row">
        <span className="agent-form__label">Status</span>
        <div className="agent-form__value">
          <Select
            label="Status"
            hideLabel
            value={agent.status}
            options={STATUS_OPTIONS}
            onChange={(value) => onChange({ status: value as AgentStatus })}
          />
        </div>
      </div>

      <div className="agent-form__row" data-walkthrough="agent-model">
        <span className="agent-form__label">Model</span>
        <div className="agent-form__value">
          <Select
            label="Model"
            hideLabel
            mono
            value={agent.model}
            options={MODEL_OPTIONS}
            onChange={(value) => onChange({ model: value })}
          />
        </div>
      </div>

      <div className="agent-form__row agent-form__row--tools" data-walkthrough="agent-tools">
        <span className="agent-form__label">Tools</span>
        <div className="agent-form__value">
          <div className="agent-form__chips">
            {agent.toolIds.map((toolId) => (
              <Chip
                key={toolId}
                tone="trace"
                removeLabel={`Remove ${toolLabel(tools, toolId)}`}
                onRemove={() =>
                  onChange({ toolIds: agent.toolIds.filter((id) => id !== toolId) })
                }
              >
                {toolLabel(tools, toolId)}
              </Chip>
            ))}
            <button
              ref={toolButtonRef}
              type="button"
              className="button button--primary button--sm agent-form__add-tool"
              onClick={() => setPickerOpen(true)}
            >
              {agent.toolIds.length === 0 ? 'Attach a tool' : 'Add'}
            </button>
          </div>
          <ToolPicker
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            anchor={toolButtonRef}
            tools={tools}
            selectedIds={agent.toolIds}
            onChange={(toolIds) => onChange({ toolIds })}
          />
        </div>
      </div>

      {triggerField && (
        <div className="agent-form__row agent-form__row--triggers" data-walkthrough="agent-triggers">
          <span className="agent-form__label">Triggers</span>
          <div className="agent-form__value">{triggerField}</div>
        </div>
      )}

      {showTimestamps && (
        <>
          <div className="agent-form__row">
            <span className="agent-form__label">Created</span>
            <span className="agent-form__value agent-form__readonly mono">
              {formatRelativeTime(agent.createdAt)}
            </span>
          </div>

          <div className="agent-form__row">
            <span className="agent-form__label">Updated</span>
            <span className="agent-form__value agent-form__readonly mono">
              {formatRelativeTime(agent.updatedAt)}
            </span>
          </div>
        </>
      )}

      <hr className="agent-form__divider" />

      <h2 className="agent-form__heading">System prompt</h2>
      <AutoTextarea
        label="System prompt"
        hideLabel
        mono
        minRows={8}
        fixed
        maxLength={SYSTEM_PROMPT_MAX_LENGTH}
        placeholder="Describe how this agent should behave, and when to reach for a tool."
        value={agent.systemPrompt}
        onChange={(value) => onChange({ systemPrompt: value })}
      />
      <p className="agent-form__count mono">
        {agent.systemPrompt.length}/{SYSTEM_PROMPT_MAX_LENGTH} characters
      </p>

      <hr className="agent-form__divider" />

      <label className="agent-form__heading" htmlFor="agent-description">
        Description
      </label>
      <input
        id="agent-description"
        type="text"
        className="agent-form__input"
        placeholder="One line on what this agent is for."
        value={agent.description}
        onChange={(event) => onChange({ description: event.target.value })}
      />
    </div>
  );
};
