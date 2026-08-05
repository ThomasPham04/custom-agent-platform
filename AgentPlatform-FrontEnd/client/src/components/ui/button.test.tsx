import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button', () => {
  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>New agent</Button>);
    expect(screen.getByRole('button', { name: 'New agent' })).toHaveAttribute('type', 'button');
  });

  it('applies the variant and size classes', () => {
    render(
      <Button variant="primary" size="sm">
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.className).toContain('button--primary');
    expect(button.className).toContain('button--sm');
  });

  it('defaults to the secondary variant', () => {
    render(<Button>Cancel</Button>);
    expect(screen.getByRole('button', { name: 'Cancel' }).className).toContain('button--secondary');
  });

  it('forwards native attributes and does not fire when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick} aria-label="Delete agent">
        Delete
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Delete agent' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps a caller-supplied className alongside its own', () => {
    render(<Button className="agents__new">New</Button>);
    const button = screen.getByRole('button', { name: 'New' });
    expect(button.className).toContain('button');
    expect(button.className).toContain('agents__new');
  });
});
