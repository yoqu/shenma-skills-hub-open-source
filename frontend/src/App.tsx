import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { onAuthReset } from './api/client';
import { siteApi } from './api/endpoints';
import { useBrandingStore } from './store/branding';
import { ToastViewport, toast } from '@/components/ui';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // staleTime 仅用于短时间内的去重；路由切换时统一交由 refetchOnMount 触发刷新
      staleTime: 10_000,
      // 路由跳转 / 组件重挂载时始终在后台拉一次最新数据，避免页面切换后看到过期列表。
      // 缓存仍会立即渲染，新数据到达后无感更新。
      refetchOnMount: 'always',
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function App() {
  // Hydrate site branding once on mount. Failure falls back to defaults so the
  // UI never blocks waiting on /api/site/branding.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await siteApi.branding();
        if (!cancelled && data) {
          useBrandingStore.getState().set({
            name: data.name || useBrandingStore.getState().name,
            tagline: data.tagline ?? '',
            logoUrl: data.logoUrl || useBrandingStore.getState().logoUrl,
            footer: data.footer ?? '',
          });
        }
      } catch {
        // 静默降级到默认品牌
      } finally {
        if (!cancelled) useBrandingStore.getState().markLoaded();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Mirror site.name into <title>. 先用（缓存的）当前名兜底，避免标题闪一下默认值。
  useEffect(() => {
    const initial = useBrandingStore.getState().name;
    if (initial) document.title = initial;
    return useBrandingStore.subscribe((state) => {
      if (state.name) document.title = state.name;
    });
  }, []);

  // Mirror site logo into the browser tab favicon。站点设置里改的图标即 logoUrl，
  // 这里把它同步到 <link rel="icon">，否则标签页一直显示静态 /favicon.png。
  useEffect(() => {
    const applyFavicon = (logoUrl: string) => {
      if (!logoUrl) return;
      let link = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      // 移除写死的 type="image/png"，让浏览器按实际资源（png/svg/...）自行识别。
      link.removeAttribute('type');
      link.href = logoUrl;
    };
    applyFavicon(useBrandingStore.getState().logoUrl);
    return useBrandingStore.subscribe((state) => applyFavicon(state.logoUrl));
  }, []);

  useEffect(() => {
    // When the backend tells us the token is no longer valid (X-Auth-Reset / 40110),
    // wipe React-Query caches and push the user back to /login.
    return onAuthReset(() => {
      queryClient.clear();
      const path = window.location.pathname;
      const isPublic = ['/', '/login', '/register', '/plaza'].includes(path)
        || path.startsWith('/skills/')
        || path.startsWith('/teams/')
        || path.startsWith('/u/');
      if (!isPublic) {
        toast({ kind: 'warning', message: '登录已失效，请重新登录' });
        const next = encodeURIComponent(path + window.location.search);
        window.location.assign(`/login?next=${next}`);
      }
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ToastViewport />
    </QueryClientProvider>
  );
}
