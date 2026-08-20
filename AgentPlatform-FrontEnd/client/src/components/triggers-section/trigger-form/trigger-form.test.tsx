import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TriggerForm } from './trigger-form';
import type { TriggerDraft } from '../../../types/trigger';

const daily: TriggerDraft = {
  agentId: 'agent_support',
  name: 'Support check',
  message: 'Check support.',
  kind: 'daily',
  timeOfDay: '09:00',
  weekdays: [0, 2],
  timezone: 'UTC',
  enabled: true,
};

describe('TriggerForm', () => {
  it('edits daily time, weekdays, and timezone', async () => {
    const onChange = vi.fn();
    render(<TriggerForm draft={daily} onChange={onChange} />);

    expect(screen.getByRole('combobox', { name: 'Repeats' })).toHaveValue('daily');
    expect(screen.getByLabelText('Mon')).toBeChecked();
    expect(screen.getByLabelText('Tue')).not.toBeChecked();

    await userEvent.click(screen.getByLabelText('Tue'));
    expect(onChange).toHaveBeenCalledWith({ weekdays: [0, 1, 2] });

    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '10:30' } });
    expect(onChange).toHaveBeenLastCalledWith({ timeOfDay: '10:30' });
  });

  it('switches to an interval with a usable default', async () => {
    const onChange = vi.fn();
    render(<TriggerForm draft={daily} onChange={onChange} />);

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Repeats' }),
      'interval',
    );
    expect(onChange).toHaveBeenCalledWith({ kind: 'interval', intervalMinutes: 60 });
  });

  it('renders and edits interval minutes', async () => {
    const onChange = vi.fn();
    render(
      <TriggerForm
        draft={{ ...daily, kind: 'interval', intervalMinutes: 15 }}
        onChange={onChange}
      />,
    );

    const minutes = screen.getByRole('spinbutton', { name: 'Every (minutes)' });
    expect(minutes).toHaveValue(15);
    fireEvent.change(minutes, { target: { value: '30' } });
    expect(onChange).toHaveBeenLastCalledWith({ intervalMinutes: 30 });
    expect(screen.queryByLabelText('Time')).not.toBeInTheDocument();
  });

  it('disables every control while an action is pending', () => {
    render(<TriggerForm draft={daily} disabled onChange={() => {}} />);
    expect(screen.getByRole('combobox', { name: 'Repeats' })).toBeDisabled();
    expect(screen.getByLabelText('Time')).toBeDisabled();
    expect(screen.getByLabelText('Mon')).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Time zone' })).toBeDisabled();
  });
});
