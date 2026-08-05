import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AgentSwitcher } from '../../components/chat-section/agent-switcher/agent-switcher';
import { Composer } from '../../components/chat-section/composer';
import { MessageList } from '../../components/chat-section/message-list';
import { ConfirmDelete } from '../../components/ui/confirm-delete';
import { useAgentsContext } from '../../hooks/useAgents';
import { useChat } from '../../hooks/useChat';
import { useTools } from '../../hooks/useTools';
import './chat.css';

const LAST_AGENT_KEY = 'agentPlatform.lastAgentId';

const ChatPage = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const { agents } = useAgentsContext();
  const { tools } = useTools();
  const clearRef = useRef<HTMLButtonElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Route first, then the last agent this browser used, then whatever exists.
  const remembered = localStorage.getItem(LAST_AGENT_KEY);
  const selected =
    agents.find((agent) => agent.id === agentId) ??
    agents.find((agent) => agent.id === remembered) ??
    agents[0] ??
    null;

  const { messages, sending, send, retryLast, clear } = useChat(selected?.id ?? null);

  useEffect(() => {
    if (selected) localStorage.setItem(LAST_AGENT_KEY, selected.id);
  }, [selected]);

  return (
    <div className="chat">
      <div className="chat__header">
        <AgentSwitcher
          agents={agents}
          selected={selected}
          onSelect={(id) => navigate(`/chat/${id}`)}
        />
        <div className="chat__header-right">
          {selected && <span className="chat__model mono">{selected.model}</span>}
          {messages.length > 0 && (
            <>
              <button
                ref={clearRef}
                type="button"
                className="chat__clear"
                onClick={() => setConfirmClear(true)}
              >
                Clear
              </button>
              <ConfirmDelete
                open={confirmClear}
                onClose={() => setConfirmClear(false)}
                onConfirm={clear}
                anchor={clearRef}
                itemName="this conversation"
              />
            </>
          )}
        </div>
      </div>

      <div className="chat__column">
        <MessageList
          messages={messages}
          agent={selected}
          agents={agents}
          tools={tools}
          onRetry={() => void retryLast()}
          onPickPrompt={(prompt) => void send(prompt)}
          onGoToAgents={() => navigate('/agents')}
        />
        {selected && (
          <Composer
            agentName={selected.name}
            disabled={sending}
            onSend={(content) => void send(content)}
          />
        )}
      </div>
    </div>
  );
};

export default ChatPage;
