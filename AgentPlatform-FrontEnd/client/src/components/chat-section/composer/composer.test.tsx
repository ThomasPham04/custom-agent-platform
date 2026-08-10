import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Composer } from './composer';

const setup = (over: Partial<Parameters<typeof Composer>[0]> = {}) => {
  const onSend = vi.fn();
  render(<Composer agentName="Support Bot" disabled={false} onSend={onSend} {...over} />);
  return { onSend, field: screen.getByRole('textbox', { name: /Message Support Bot/ }) };
};

describe('Composer', () => {
  it('names the agent it will message', () => {
    setup();
    expect(screen.getByPlaceholderText('Message Support Bot…')).toBeInTheDocument();
  });

  it('sends on Enter and clears the field', async () => {
    const { onSend, field } = setup();
    await userEvent.type(field, 'what time is it?{Enter}');
    expect(onSend).toHaveBeenCalledWith('what time is it?');
    expect(field).toHaveValue('');
  });

  it('inserts a newline on Shift+Enter without sending', async () => {
    const { onSend, field } = setup();
    await userEvent.type(field, 'line one{Shift>}{Enter}{/Shift}line two');
    expect(onSend).not.toHaveBeenCalled();
    expect(field).toHaveValue('line one\nline two');
  });

  it('refuses to send whitespace', async () => {
    const { onSend, field } = setup();
    await userEvent.type(field, '   {Enter}');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('disables the send button until there is something to send', async () => {
    const { field } = setup();
    const send = screen.getByRole('button', { name: 'Send message' });
    expect(send).toBeDisabled();
    await userEvent.type(field, 'hi');
    expect(send).toBeEnabled();
  });

  it('sends on a click of the send button', async () => {
    const { onSend, field } = setup();
    await userEvent.type(field, 'hello');
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(onSend).toHaveBeenCalledWith('hello');
  });

  it('blocks input entirely while a run is in flight', async () => {
    const { onSend, field } = setup({ disabled: true });
    expect(field).toBeDisabled();
    await userEvent.type(field, 'hi{Enter}');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('states the keyboard contract', () => {
    setup();
    expect(screen.getByText('Enter to send · Shift+Enter for newline')).toBeInTheDocument();
  });
});
