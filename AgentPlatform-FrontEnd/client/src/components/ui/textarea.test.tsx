import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('caps growth at maxHeight', () => {
    render(
      <AutoTextarea label="Prompt" value={'x\n'.repeat(200)} onChange={() => {}} maxHeight={120} />,
    );
    expect((screen.getByLabelText('Prompt') as HTMLTextAreaElement).style.maxHeight).toBe('120px');
  });

  it('keeps a fixed field at its row height and scrolls overflowing content internally', () => {
    render(<AutoTextarea label="Prompt" value="one line" onChange={() => {}} minRows={8} fixed />);
    const textarea = screen.getByLabelText('Prompt') as HTMLTextAreaElement;
    expect(textarea).toHaveAttribute('rows', '8');
    expect(textarea.style.height).toBe('');
    expect(textarea.style.overflowY).toBe('auto');
  });

  it('enforces an optional maximum length before reporting a changed value', () => {
    const onChange = vi.fn();
    render(
      <AutoTextarea label="Prompt" value="" onChange={onChange} maxLength={500} />,
    );
    const textarea = screen.getByLabelText('Prompt');
    expect(textarea).toHaveAttribute('maxlength', '500');

    fireEvent.change(textarea, { target: { value: 'x'.repeat(501) } });
    expect(onChange).toHaveBeenCalledWith('x'.repeat(500));
  });

  it('hides the scrollbar while the content fits, so an empty field looks clean', () => {
    // jsdom reports scrollHeight 0, which is the "content fits" case.
    render(<AutoTextarea label="Message" value="" onChange={() => {}} maxHeight={200} />);
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).style.overflowY).toBe('hidden');
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
