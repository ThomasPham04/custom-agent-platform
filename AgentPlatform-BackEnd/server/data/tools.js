export const TOOLS = [
  {
    id: 'current_time',
    label: 'Current time',
    description: 'Reads the current time in a given timezone.',
    params: [
      {
        name: 'timezone',
        type: 'string',
        required: false,
        description: 'IANA timezone name. Defaults to UTC.',
      },
    ],
  },
  {
    id: 'http_request',
    label: 'HTTP request',
    description: 'Fetches a URL and returns the status and body.',
    params: [
      { name: 'url', type: 'string', required: true, description: 'Absolute URL to request.' },
      { name: 'method', type: 'string', required: false, description: 'HTTP method. Defaults to GET.' },
    ],
  },
  {
    id: 'calculator',
    label: 'Calculator',
    description: 'Evaluates an arithmetic expression.',
    params: [
      { name: 'expression', type: 'string', required: true, description: 'Expression to evaluate.' },
    ],
  },
  {
    id: 'knowledge_search',
    label: 'Knowledge search',
    description: 'Searches the internal knowledge base.',
    params: [
      { name: 'query', type: 'string', required: true, description: 'Search terms.' },
      { name: 'limit', type: 'number', required: false, description: 'Maximum results. Defaults to 5.' },
    ],
  },
];
