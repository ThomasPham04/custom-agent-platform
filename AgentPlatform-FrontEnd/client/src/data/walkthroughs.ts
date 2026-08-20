import type { Walkthrough } from '../types/walkthrough';

/**
 * Content, not logic. Adding a walkthrough is one entry here and nothing else.
 *
 * Two rules govern every step. No step may depend on a record existing, because
 * the service boots cold with no agents. And no step may operate a control —
 * this feature points at things, it does not press them.
 */
export const WALKTHROUGHS: readonly Walkthrough[] = [
  {
    id: 'overview',
    name: 'What this is',
    summary: 'The four parts of the platform, in one pass.',
    steps: [
      {
        id: 'overview:what',
        title: 'An agent platform in four parts',
        body: 'You configure agents, give them tools they can call, test them in a chat, and read back the trace of every call they made. This walkthrough points at each part in turn, and changes nothing.',
      },
      {
        id: 'overview:sidebar',
        title: 'Two surfaces',
        body: 'Agents is where configuration lives. Chat is where you test one. Saved conversations collect underneath, and the dot at the bottom reports whether the API is answering.',
        target: 'sidebar',
        placement: 'right',
      },
      {
        id: 'overview:agents',
        title: 'An agent is a configuration',
        body: 'A model, a system prompt, and the set of tools it is allowed to reach. Nothing here runs until you send it a message.',
        target: 'agents-table',
        route: '/agents',
        placement: 'top',
      },
      {
        id: 'overview:chat',
        title: 'Answers arrive with their evidence',
        body: 'Send an agent a message and the reply carries the tools it called, in the order it called them, each with how long it took.',
        target: 'chat-messages',
        route: '/chat',
        placement: 'top',
      },
    ],
  },
  {
    id: 'create-agent',
    name: 'Create an agent',
    summary: 'Where new agents come from, and what you fill in.',
    steps: [
      {
        id: 'create:nav',
        title: 'Start in Agents',
        body: 'Every agent is created and edited from this one surface.',
        target: 'sidebar-agents',
        placement: 'right',
      },
      {
        id: 'create:list',
        title: 'Everything you have',
        body: 'One row per agent: the model it runs on, the tools it can reach, whether it is active, and when it last changed.',
        target: 'agents-table',
        route: '/agents',
        placement: 'top',
      },
      {
        id: 'create:viewbar',
        title: 'Find one quickly',
        body: 'The count is live, and the filter matches on name and description.',
        target: 'agents-viewbar',
        placement: 'bottom',
      },
      {
        id: 'create:new',
        title: 'New agent opens a blank draft',
        body: 'Name it, pick a model, choose the tools it may use, then save. The draft lives in the panel only — nothing is written to the server until you press Save agent.',
        target: 'agents-new',
        placement: 'bottom',
      },
      {
        id: 'create:panel',
        title: 'The draft opens on the right',
        body: 'Everything about an agent lives in this one panel. It exists only here until you save it.',
        target: 'agent-panel',
        route: '/agents/new',
        placement: 'left',
      },
      {
        id: 'create:name',
        title: 'Name it',
        body: 'The name is how you will find it in the table and pick it in a chat.',
        target: 'agent-name',
        placement: 'left',
      },
      {
        id: 'create:model',
        title: 'Choose a model',
        body: 'The model decides how the agent reasons, and how fast and how expensive each turn is.',
        target: 'agent-model',
        placement: 'left',
      },
      {
        id: 'create:tools',
        title: 'Give it tools',
        body: 'Tools are what let an agent do more than talk. Each one you enable here becomes something it can call mid-answer.',
        target: 'agent-tools',
        placement: 'left',
      },
      {
        id: 'create:triggers',
        title: 'Or let it run without you',
        body: 'A trigger fires this agent on a schedule, with nobody in the chat. Each firing lands in the activity log for that trigger rather than in a conversation. Schedules added here are written when the agent is.',
        target: 'agent-triggers',
        placement: 'left',
      },
      {
        id: 'create:save',
        title: 'Save writes it to the server',
        body: 'Until you press Save agent, the draft exists only in this panel. This walkthrough will not press it.',
        target: 'agent-save',
        placement: 'left',
      },
      {
        id: 'create:done',
        title: 'Nothing was created',
        body: 'This walkthrough only points at things. The draft closes when it ends. Press New agent when you want the real one.',
      },
    ],
  },
  {
    id: 'test-in-chat',
    name: 'Test an agent',
    summary: 'Send a message and read the tool calls behind the answer.',
    steps: [
      {
        id: 'chat:agent',
        title: 'Choose who answers',
        body: 'The switcher sets which agent this conversation is addressed to.',
        target: 'chat-agent-switcher',
        route: '/chat',
        placement: 'bottom',
      },
      {
        id: 'chat:composer',
        title: 'Ask it something',
        body: 'Enter sends. Shift and Enter together start a new line.',
        target: 'chat-composer',
        placement: 'top',
      },
      {
        id: 'chat:trace',
        title: 'The trace comes back with the answer',
        body: 'When an agent calls tools, they appear as a rail beside its reply: each call, what it was given, what it returned, and how long it took.',
        target: 'chat-messages',
        placement: 'top',
      },
      {
        id: 'chat:history',
        title: 'Conversations are kept',
        body: 'Every chat is saved and can be reopened from here.',
        target: 'sidebar-chats',
        placement: 'right',
      },
    ],
  },
];
