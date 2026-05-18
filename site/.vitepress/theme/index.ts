import DefaultTheme from 'vitepress/theme';
import { useRouter, type Theme } from 'vitepress';

export default {
  extends: DefaultTheme,
  enhanceApp({ router }) {
    // Send a GA4 page_view on every client-side route change (SPA navigation)
    const routeChanged = () => {
      const track = () => {
        if (typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'page_view', {
            page_title: document.title,
            page_location: window.location.href,
            page_path: window.location.pathname + window.location.search,
          });
        }
      };
      // Defer to next microtask so the document.title and URL reflect the new page
      setTimeout(track, 0);
    };

    router.onAfterRouteChanged = (to: string) => {
      routeChanged();
    };
  },
} satisfies Theme;
