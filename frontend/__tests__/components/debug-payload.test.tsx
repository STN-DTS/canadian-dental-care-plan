import { fireEvent, render, screen } from '@testing-library/react';

import { faCheck, faClipboard } from '@fortawesome/free-solid-svg-icons';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DebugPayload } from '~/components/debug-payload';

describe('DebugPayload', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  it('renders JSON data correctly', () => {
    const data = { key: 'value' };
    render(<DebugPayload data={data} enableCopy={false} />);

    expect(screen.getByText(/"key": "value"/)).toBeInTheDocument();
  });

  it('does not render copy button when enableCopy is false', () => {
    render(<DebugPayload data={{ key: 'value' }} enableCopy={false} />);

    expect(screen.queryByText('Copy')).not.toBeInTheDocument();
  });

  it('renders copy button when enableCopy is true', () => {
    render(<DebugPayload data={{ key: 'value' }} enableCopy={true} />);

    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('copies JSON data to clipboard when copy button is clicked', () => {
    const data = { key: 'value' };
    render(<DebugPayload data={data} enableCopy={true} />);

    fireEvent.click(screen.getByText('Copy'));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });

  it('changes icon on click and resets after 2 seconds', async () => {
    render(<DebugPayload data={{ key: 'value' }} enableCopy={true} />);

    // Find the button
    const button = screen.getByText('Copy').closest('button') as HTMLButtonElement;
    expect(button).toBeTruthy();

    // Find the <svg> inside the button
    const icon = button.querySelector('svg');

    // Initially should be clipboard
    expect(icon).toHaveAttribute('data-icon', faClipboard.iconName);

    // Click button
    fireEvent.click(button);

    // Wait for icon to change to check
    await vi.waitFor(() => {
      expect(icon).toHaveAttribute('data-icon', faCheck.iconName);
    });

    // Fast-forward 2 seconds
    vi.advanceTimersByTime(2000);

    // Wait for icon to reset to clipboard
    await vi.waitFor(() => {
      expect(icon).toHaveAttribute('data-icon', faClipboard.iconName);
    });
  });
});
