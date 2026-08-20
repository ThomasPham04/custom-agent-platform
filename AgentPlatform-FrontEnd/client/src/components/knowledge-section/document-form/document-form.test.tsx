import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DocumentForm, MAX_BODY_BYTES } from './document-form';

const ok = () => Promise.resolve({ ok: true as const });

describe('DocumentForm', () => {
  it('will not submit an empty title', async () => {
    const onSubmit = vi.fn(ok);
    render(<DocumentForm submitLabel="Add document" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Text'), 'Some text');
    await userEvent.click(screen.getByRole('button', { name: 'Add document' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Give the document a title.');
  });

  it('will not submit an empty body', async () => {
    const onSubmit = vi.fn(ok);
    render(<DocumentForm submitLabel="Add document" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Title'), 'A title');
    await userEvent.click(screen.getByRole('button', { name: 'Add document' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Add some text to search.');
  });

  it('submits a typed draft', async () => {
    const onSubmit = vi.fn(ok);
    render(<DocumentForm submitLabel="Add document" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Title'), 'A title');
    await userEvent.type(screen.getByLabelText('Text'), 'Some text');
    await userEvent.click(screen.getByRole('button', { name: 'Add document' }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'A title',
      body: 'Some text',
      source: 'typed',
    });
  });

  it('reads an uploaded file into the fields and marks the source', async () => {
    const onSubmit = vi.fn(ok);
    render(<DocumentForm submitLabel="Add document" onSubmit={onSubmit} />);

    const file = new File(['Uploaded text.'], 'policy.md', { type: 'text/markdown' });
    await userEvent.upload(screen.getByLabelText('Upload a .txt or .md file'), file);

    // The title defaults from the filename so the user can accept or replace it.
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('policy'));
    expect(screen.getByLabelText('Text')).toHaveValue('Uploaded text.');

    await userEvent.click(screen.getByRole('button', { name: 'Add document' }));
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'policy',
      body: 'Uploaded text.',
      source: 'upload',
    });
  });

  it('keeps a title the user already typed when a file is chosen', async () => {
    render(<DocumentForm submitLabel="Add document" onSubmit={vi.fn(ok)} />);

    await userEvent.type(screen.getByLabelText('Title'), 'My own title');
    const file = new File(['Uploaded text.'], 'policy.md', { type: 'text/markdown' });
    await userEvent.upload(screen.getByLabelText('Upload a .txt or .md file'), file);

    await waitFor(() => expect(screen.getByLabelText('Text')).toHaveValue('Uploaded text.'));
    expect(screen.getByLabelText('Title')).toHaveValue('My own title');
  });

  it('rejects a file past the byte limit before sending it', async () => {
    const onSubmit = vi.fn(ok);
    render(<DocumentForm submitLabel="Add document" onSubmit={onSubmit} />);

    const file = new File(['x'.repeat(MAX_BODY_BYTES + 1)], 'big.txt', { type: 'text/plain' });
    await userEvent.upload(screen.getByLabelText('Upload a .txt or .md file'), file);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'That file is larger than the 100,000 byte limit. Trim it and try again.',
      ),
    );
    expect(screen.getByLabelText('Text')).toHaveValue('');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the message when the server rejects the save', async () => {
    const onSubmit = vi.fn(() =>
      Promise.resolve({ ok: false as const, message: 'title is required.' }),
    );
    render(<DocumentForm submitLabel="Add document" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Title'), 'A title');
    await userEvent.type(screen.getByLabelText('Text'), 'Some text');
    await userEvent.click(screen.getByRole('button', { name: 'Add document' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('title is required.'));
  });

  it('starts from an existing document when one is given', () => {
    render(
      <DocumentForm
        initial={{ title: 'Existing', body: 'Existing body.' }}
        submitLabel="Save changes"
        onSubmit={vi.fn(ok)}
      />,
    );

    expect(screen.getByLabelText('Title')).toHaveValue('Existing');
    expect(screen.getByLabelText('Text')).toHaveValue('Existing body.');
  });
});
