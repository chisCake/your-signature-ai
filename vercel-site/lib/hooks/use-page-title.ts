import { useEffect } from 'react';

const SITE_NAME = 'Your Sign AI';

interface UsePageTitleOptions {
  title: string;
  siteName?: string;
}

export function usePageTitle({
  title,
  siteName = SITE_NAME,
}: UsePageTitleOptions) {
  useEffect(() => {
    const fullTitle = `${title} | ${siteName}`;
    const originalTitle = document.title;
    document.title = fullTitle;

    return () => {
      document.title = originalTitle;
    };
  }, [title, siteName]);
}
