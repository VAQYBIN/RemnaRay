import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DataTable } from './data-table';
import { lastDays } from './date-range-picker';
import { fromMinor, toMinor } from './money-input';
import { Stat } from './stat';
import * as kit from './index';

const labels = { loadMore: 'More', emptyTitle: 'Nothing here' };
const columns = [{ key: 'name', header: 'Name', cell: (row: { name: string }) => row.name }];

describe('section 14.4 UI kit', () => {
  it('exports every component required by section 14.4', () => {
    for (const name of [
      'Button',
      'Input',
      'Select',
      'Dialog',
      'Sheet',
      'Table',
      'Tabs',
      'Badge',
      'ToastProvider',
      'Form',
      'DataTable',
      'MoneyInput',
      'DateRangePicker',
      'Stat',
      'EmptyState',
      'ErrorState',
      'Skeleton',
      'ConfirmDialog',
    ]) {
      expect(kit, name).toHaveProperty(name);
    }
  });

  it('renders the cursor table in loading, empty and ready states', () => {
    const loading = renderToStaticMarkup(
      createElement(DataTable<{ name: string }>, {
        columns,
        rows: [],
        rowKey: (row) => row.name,
        state: 'loading',
        labels,
      }),
    );
    expect(loading).toContain('data-state="loading"');

    const empty = renderToStaticMarkup(
      createElement(DataTable<{ name: string }>, {
        columns,
        rows: [],
        rowKey: (row) => row.name,
        labels,
      }),
    );
    expect(empty).toContain('data-state="empty"');
    expect(empty).toContain('Nothing here');

    const ready = renderToStaticMarkup(
      createElement(DataTable<{ name: string }>, {
        columns,
        rows: [{ name: 'Alice' }],
        rowKey: (row) => row.name,
        labels,
        nextCursor: 'cursor-1',
        onLoadMore: () => undefined,
      }),
    );
    expect(ready).toContain('data-state="ready"');
    expect(ready).toContain('Alice');
    expect(ready).toContain('More');
  });

  it('renders the error state with the request id', () => {
    const markup = renderToStaticMarkup(
      createElement(DataTable<{ name: string }>, {
        columns,
        rows: [],
        rowKey: (row) => row.name,
        state: 'error',
        labels,
        requestId: 'req-42',
        onRetry: () => undefined,
      }),
    );
    expect(markup).toContain('data-state="error"');
    expect(markup).toContain('req-42');
    expect(markup).toContain('role="alert"');
  });

  it('renders a stat tile', () => {
    expect(
      renderToStaticMarkup(createElement(Stat, { label: 'Revenue', value: '1 000' })),
    ).toContain('Revenue');
  });

  it('converts money without floating point error', () => {
    expect(toMinor('1234567890123.45')).toBe(123456789012345n);
    expect(toMinor('0,07')).toBe(7n);
    expect(toMinor('1.234')).toBeNull();
    expect(toMinor('')).toBeNull();
    expect(fromMinor(123456789012345n)).toBe('1234567890123.45');
    expect(fromMinor(-7n)).toBe('-0.07');
  });

  it('builds inclusive date-range presets', () => {
    expect(lastDays(7, new Date('2026-09-20T12:00:00Z'))).toEqual({
      from: '2026-09-14',
      to: '2026-09-20',
    });
  });
});
