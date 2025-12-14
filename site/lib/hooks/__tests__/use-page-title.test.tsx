import { renderHook } from '@testing-library/react';
import { usePageTitle } from '../use-page-title';

describe('usePageTitle', () => {
  const originalTitle = document.title;

  beforeEach(() => {
    document.title = originalTitle;
  });

  afterEach(() => {
    document.title = originalTitle;
  });

  it('should set page title on mount', () => {
    renderHook(() => usePageTitle({ title: 'Test Page' }));

    expect(document.title).toBe('Test Page | Your Sign AI');
  });

  it('should update title when title changes', () => {
    const { rerender } = renderHook(({ title }) => usePageTitle({ title }), {
      initialProps: { title: 'Initial Title' },
    });

    expect(document.title).toBe('Initial Title | Your Sign AI');

    rerender({ title: 'Updated Title' });

    expect(document.title).toBe('Updated Title | Your Sign AI');
  });

  it('should restore original title on unmount', () => {
    document.title = 'Original Title';

    const { unmount } = renderHook(() => usePageTitle({ title: 'Test Page' }));

    expect(document.title).toBe('Test Page | Your Sign AI');

    unmount();

    expect(document.title).toBe('Original Title');
  });

  it('should use custom siteName when provided', () => {
    renderHook(() =>
      usePageTitle({ title: 'Test Page', siteName: 'Custom Site' })
    );

    expect(document.title).toBe('Test Page | Custom Site');
  });

  it('should use default siteName when not provided', () => {
    renderHook(() => usePageTitle({ title: 'Test Page' }));

    expect(document.title).toBe('Test Page | Your Sign AI');
  });

  it('should update title when siteName changes', () => {
    const { rerender } = renderHook(
      ({ siteName }) => usePageTitle({ title: 'Test Page', siteName }),
      {
        initialProps: { siteName: 'Site 1' },
      }
    );

    expect(document.title).toBe('Test Page | Site 1');

    rerender({ siteName: 'Site 2' });

    expect(document.title).toBe('Test Page | Site 2');
  });

  it('should handle empty title', () => {
    renderHook(() => usePageTitle({ title: '' }));

    expect(document.title).toBe('| Your Sign AI');
  });

  it('should handle empty siteName', () => {
    renderHook(() => usePageTitle({ title: 'Test Page', siteName: '' }));

    expect(document.title).toBe('Test Page |');
  });
});
