import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AutoTextarea } from './textarea';

describe('AutoTextarea', () => {
  it('binds its label to the control', () => {
    render(<AutoTextarea label="System prompt" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('System prompt')).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('hides the label visually but keeps it for screen readers', () => {
    render(<AutoTextarea label="Message" hideLabel value="" onChange={() => {}} />);
    expect(screen.getByText('Message').className).toContain('sr-only');
    expect(screen.getByLabelText('Message')).toBeInTheDocument();
  });

  it('reports each keystroke as the new whole value', async () => {
    const onChange = vi.fn();
    render(<AutoTextarea label="Prompt" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Prompt'), 'Be');
    expect(onChange).toHaveBeenNthCalledWith(1, 'B');
    expect(onChange).toHaveBeenNthCalledWith(2, 'e');
  });

  it('sets an explicit height so the field grows with its content', () => {
    render(<AutoTextarea label="Prompt" value="one line" onChange={() => {}} />);
    const textarea = screen.getByLabelText('Prompt') as HTMLTextAreaElement;
    expect(textarea.style.height).not.toBe('');
  });

  it('caps growth at maxHeight and scrolls past it', () => {
    // jsdom reports scrollHeight 0, so assert the cap is applied as a style ceiling.
    render(
      <AutoTextarea label="Prompt" value={'x\n'.repeat(200)} onChange={() => {}} maxHeight={120} />,
    );
    const textarea = screen.getByLabelText('Prompt') as HTMLTextAreaElement;
    expect(textarea.style.maxHeight).toBe('120px');
    expect(textarea.style.overflowY).toBe('auto');
  });

  it('applies the mono face when asked', () => {
    render(<AutoTextarea label="Prompt" value="" onChange={() => {}} mono />);
    expect(screen.getByLabelText('Prompt').className).toContain('mono');
  });

  it('forwards keydown so callers can implement Enter-to-send', async () => {
    const onKeyDown = vi.fn();
    render(<AutoTextarea label="Message" value="hi" onChange={() => {}} onKeyDown={onKeyDown} />);
    await userEvent.type(screen.getByLabelText('Message'), '{Enter}');
    expect(onKeyDown).toHaveBeenCalled();
  });
});
