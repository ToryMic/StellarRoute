import { render, screen, cleanup, within } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import DocsPage from './page';

// The docs page is a server component that links out through next/link. Mock
// it as a plain anchor (same pattern as components/layout/footer.test.tsx) so
// the smoke test asserts on the rendered link surface, not on Next's client
// router internals.
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children?: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe('DocsPage', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders the docs page heading and intro copy', () => {
    render(<DocsPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: /StellarRoute Docs/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Documentation')).toBeInTheDocument();
    expect(
      screen.getByText(/Jump into the project guides, API references, and contract documentation/i)
    ).toBeInTheDocument();
  });

  it('renders exactly one main landmark and one h1', () => {
    render(<DocsPage />);

    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('renders documentation links', () => {
    render(<DocsPage />);

    // The page is a link hub: losing the grid would silently strand integrators.
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
    expect(links.length).toBe(5);
  });

  it('links the in-app guide as a client-side route', () => {
    render(<DocsPage />);

    const guideLink = screen.getByRole('link', { name: /First Live Swap Guide/i });
    expect(guideLink).toBeInTheDocument();
    expect(guideLink).toHaveAttribute('href', '/guide');
    // Internal routes must not open a new tab.
    expect(guideLink).not.toHaveAttribute('target');
  });

  it('links the API reference to the repository docs', () => {
    render(<DocsPage />);

    const apiLink = screen.getByRole('link', { name: /API Reference/i });
    expect(apiLink).toHaveAttribute(
      'href',
      'https://github.com/StellarRoute/StellarRoute/tree/main/docs/api'
    );
  });

  it('opens external documentation links safely', () => {
    render(<DocsPage />);

    const externalLinks = [
      /Documentation Index/i,
      /API Reference/i,
      /Developer Guide/i,
      /Contract Docs/i,
    ].map((name) => screen.getByRole('link', { name }));

    expect(externalLinks).toHaveLength(4);
    for (const link of externalLinks) {
      expect(link.getAttribute('href')).toContain('https://github.com/');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
      expect(link.getAttribute('rel')).toContain('noreferrer');
    }
  });

  it('describes each documentation destination', () => {
    render(<DocsPage />);

    const grid = screen.getByRole('link', { name: /First Live Swap Guide/i }).parentElement;
    expect(grid).not.toBeNull();

    // Every card carries a one-line description so the page stays scannable.
    expect(within(grid as HTMLElement).getByText(/connect a wallet, set trustlines/i)).toBeInTheDocument();
    expect(within(grid as HTMLElement).getByText(/Browse the main StellarRoute documentation directory/i)).toBeInTheDocument();
    expect(within(grid as HTMLElement).getByText(/Review REST API routes, schemas, websocket docs/i)).toBeInTheDocument();
    expect(within(grid as HTMLElement).getByText(/Set up the frontend, indexer, testing flow/i)).toBeInTheDocument();
    expect(within(grid as HTMLElement).getByText(/Read contract deployment, testing, router interface/i)).toBeInTheDocument();
  });

  it('stays a static docs surface with no interactive swap chrome', () => {
    render(<DocsPage />);

    // The docs page must not grow swap/wallet controls; those live on /swap.
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });
});
