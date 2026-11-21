'use client';

import { Lockup } from '@avero/ui';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useThemeMode } from '../../hooks/use-theme-mode';
import { nextMode, setMode, type ThemeMode } from '../../lib/theme';
import { isCurrent, navigation } from '../../components/navigation';
import { Icon } from '../../components/console/primitives';

export type ShellData = {
  runs: number;
  toDecide: number;
  risky: number;
  suites: number;
  dir: string;
  readOnly: boolean;
  recent: { id: string; task: string }[];
  suiteIds: string[];
};

type Target = { label: string; hint: string; href: string };

const themeWords: Record<ThemeMode, string> = { system: 'System', light: 'Light', dark: 'Dark' };

function ThemeKey() {
  const mode = useThemeMode();
  const next = nextMode[mode];
  return (
    <button
      type="button"
      data-btn
      aria-label={`Theme: ${themeWords[mode]}. Switch to ${themeWords[next]}`}
      title={`Theme: ${themeWords[mode]}`}
      onClick={() => setMode(next)}
    >
      <Icon name={mode === 'light' ? 'sun' : 'moon'} />
      {themeWords[mode]}
    </button>
  );
}

function Palette({
  open,
  onClose,
  targets,
}: {
  open: boolean;
  onClose: () => void;
  targets: Target[];
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      setQuery('');
      setActive(0);
      el.showModal();
    }
    if (!open && el.open) el.close();
  }, [open]);

  const shown = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return targets
      .filter((target) =>
        words.every((word) => `${target.label} ${target.hint}`.toLowerCase().includes(word)),
      )
      .slice(0, 30);
  }, [query, targets]);

  const go = (target: Target | undefined) => {
    if (!target) return;
    onClose();
    router.push(target.href);
  };

  return (
    <dialog
      ref={dialog}
      data-palette
      aria-label="Go to"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <input
        value={query}
        placeholder="Go to a page, run or suite…"
        aria-label="Search"
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((value) => Math.min(shown.length - 1, value + 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((value) => Math.max(0, value - 1));
          } else if (event.key === 'Enter') {
            event.preventDefault();
            go(shown[active]);
          }
        }}
      />
      {shown.length === 0 ? (
        <p data-none>Nothing matches “{query}”.</p>
      ) : (
        <ul role="listbox" aria-label="Results">
          {shown.map((target, index) => (
            <li key={target.href} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                onMouseMove={() => setActive(index)}
                onClick={() => go(target)}
              >
                {target.label}
                <small>{target.hint}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </dialog>
  );
}

function crumbs(pathname: string): { label: string; href?: string }[] {
  const [first, second, third] = pathname.split('/').filter(Boolean);
  const names: Record<string, string> = {
    overview: 'Desk',
    tasks: 'Tasks',
    runs: 'Runs',
    review: 'Review',
    evaluations: 'Evaluations',
    repositories: 'Repositories',
    agents: 'Agents',
    activity: 'Activity',
    settings: 'Settings',
  };
  if (!first) return [{ label: 'Desk' }];
  const root = { label: names[first] ?? first, href: `/${first}` };
  if (!second) return [{ label: root.label }];
  if (!third) return [root, { label: second }];
  return [root, { label: second, href: `/${first}/${second}` }, { label: third }];
}

/** The console's frame: sidebar, top bar and the go-to palette. */
export function ConsoleShell({ data, children }: { data: ShellData; children: ReactNode }) {
  const pathname = usePathname();
  // The menu is open for the page it was opened on, so going to another page closes it.
  const [openedOn, setOpenedOn] = useState<string>();
  const open = openedOn === pathname;
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPalette((value) => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const targets = useMemo<Target[]>(
    () => [
      ...navigation.flatMap((group) =>
        group.items.map((item) => ({ label: item.label, hint: 'Page', href: item.href })),
      ),
      ...data.suiteIds.map((id) => ({
        label: id,
        hint: 'Evaluation suite',
        href: `/evaluations/${id}`,
      })),
      ...data.recent.map((run) => ({
        label: run.task.length > 70 ? `${run.task.slice(0, 70)}…` : run.task,
        hint: run.id,
        href: `/runs/${run.id}`,
      })),
    ],
    [data.recent, data.suiteIds],
  );

  const counts: Record<string, { value: number; alert?: boolean } | undefined> = {
    '/runs': data.runs > 0 ? { value: data.runs } : undefined,
    '/review': data.toDecide > 0 ? { value: data.toDecide, alert: data.risky > 0 } : undefined,
    '/evaluations': data.suites > 0 ? { value: data.suites } : undefined,
  };

  const trail = crumbs(pathname);

  return (
    <div data-console>
      <div data-frame data-open={open ? '' : undefined}>
        <aside data-side aria-label="Console">
          <div data-brand>
            <Link href="/" aria-label="Avero home">
              <Lockup />
            </Link>
            <span data-tag-env>local</span>
          </div>

          <button type="button" data-search onClick={() => setPalette(true)}>
            <Icon name="search" />
            Go to…
            <kbd>Ctrl K</kbd>
          </button>

          <nav aria-label="Primary" data-nav>
            {navigation.map((group) => (
              <div key={group.label} data-nav>
                <p data-nav-label>{group.label}</p>
                {group.items.map((item) => {
                  const count = counts[item.href];
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      data-nav-item
                      aria-current={isCurrent(pathname, item.href) ? 'page' : undefined}
                    >
                      <Icon name={item.icon} />
                      {item.label}
                      {count ? (
                        <span data-count data-alert={count.alert ? '' : undefined}>
                          {count.value}
                          <span data-sr>{count.alert ? ' to decide, some risky' : ''}</span>
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div data-side-foot>
            <div data-foot-row>
              <span>Reading</span>
              {data.readOnly ? <span data-ro>read-only</span> : null}
            </div>
            <code title={data.dir}>{data.dir}</code>
            <ThemeKey />
          </div>
        </aside>

        <div data-main>
          <header data-top>
            <button
              type="button"
              data-btn
              data-menu-btn
              aria-label="Open the menu"
              aria-expanded={open}
              onClick={() => setOpenedOn(open ? undefined : pathname)}
            >
              <Icon name="menu" />
            </button>
            <nav aria-label="Breadcrumb" data-crumbs>
              {trail.map((crumb, index) => (
                <span key={`${crumb.label}-${index}`} style={{ display: 'contents' }}>
                  {index > 0 ? <span aria-hidden="true">/</span> : null}
                  {crumb.href ? (
                    <Link href={crumb.href}>{crumb.label}</Link>
                  ) : (
                    <span aria-current="page">{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
            <div data-top-actions>
              <Link href="/" data-btn>
                Site
              </Link>
            </div>
          </header>
          <main id="main" data-content>
            {children}
          </main>
        </div>
      </div>
      <Palette open={palette} onClose={() => setPalette(false)} targets={targets} />
    </div>
  );
}
