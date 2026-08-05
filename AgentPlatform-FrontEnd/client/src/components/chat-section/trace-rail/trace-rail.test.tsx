import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TraceRail } from './trace-rail';
import type { ToolCall } from '../../../types/message';
import type { Tool } from '../../../types/tool';

const tools: Tool[] = [
  { id: 'current_time', label: 'Current time', description: '', params: [] },
  { id: 'http_request', label: 'HTTP request', description: '', params: [] },
];

const call = (over: Partial<ToolCall> = {}): ToolCall => ({
  id: 'call_1',
  toolId: 'current_time',
  args: { timezone: 'Asia/Tokyo' },
  result: '2026-08-04T21:03:41+09:00',
  durationMs: 118,
  status: 'ok',
  ...over,
});

describe('TraceRail', () => {
  it('renders nothing when there are no tool calls, so the answer stands alone', () => {
    const { container } = render(<TraceRail toolCalls={[]} tools={tools} running={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders one node per call, labelled and timed', () => {
    render(
      <TraceRail
        toolCalls={[call(), call({ id: 'call_2', toolId: 'http_request', durationMs: 412 })]}
        tools={tools}
        running={false}
      />,
    );
    expect(screen.getByRole('button', { name: /Current time/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /HTTP request/ })).toBeInTheDocument();
    expect(screen.getByText('118 ms')).toBeInTheDocument();
    expect(screen.getByText('412 ms')).toBeInTheDocument();
  });

  it('collapses every node by default', () => {
    render(<TraceRail toolCalls={[call()]} tools={tools} running={false} />);
    expect(screen.getByRole('button', { name: /Current time/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByText(/Asia\/Tokyo/)).not.toBeVisible();
  });

  it('reveals the arguments and the result when expanded', async () => {
    render(<TraceRail toolCalls={[call()]} tools={tools} running={false} />);
    const header = screen.getByRole('button', { name: /Current time/ });

    await userEvent.click(header);

    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/"timezone": "Asia\/Tokyo"/)).toBeVisible();
    expect(screen.getByText(/2026-08-04T21:03:41\+09:00/)).toBeVisible();
  });

  it('is keyboard operable', async () => {
    render(<TraceRail toolCalls={[call()]} tools={tools} running={false} />);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: /Current time/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('reads a running call as working rather than showing a duration', () => {
    render(<TraceRail toolCalls={[call({ status: 'running' })]} tools={tools} running />);
    expect(screen.getByText('working…')).toBeInTheDocument();
    expect(screen.queryByText('118 ms')).not.toBeInTheDocument();
  });

  it('shows the error text instead of a result for a failed call', async () => {
    render(
      <TraceRail
        toolCalls={[
          call({ status: 'error', result: undefined, error: 'connection refused after 800ms' }),
        ]}
        tools={tools}
        running={false}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Current time/ }));
    expect(screen.getByText('connection refused after 800ms')).toBeVisible();
  });

  it('marks a failed node for assistive tech, not by colour alone', () => {
    render(
      <TraceRail
        toolCalls={[call({ status: 'error', error: 'boom' })]}
        tools={tools}
        running={false}
      />,
    );
    expect(screen.getByRole('button', { name: /failed/i })).toBeInTheDocument();
  });

  it('caps the rail only once the run has finished', () => {
    const { container: whileRunning } = render(
      <TraceRail toolCalls={[call()]} tools={tools} running />,
    );
    expect(whileRunning.querySelector('.trace-rail__cap')).toBeNull();

    const { container: finished } = render(
      <TraceRail toolCalls={[call()]} tools={tools} running={false} />,
    );
    expect(finished.querySelector('.trace-rail__cap')).not.toBeNull();
  });
});
