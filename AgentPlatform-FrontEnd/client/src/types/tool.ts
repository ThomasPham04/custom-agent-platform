export interface ToolParam {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  description: string;
}

export interface Tool {
  id: string;
  label: string;
  description: string;
  params: ToolParam[];
}
