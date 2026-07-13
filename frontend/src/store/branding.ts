/**
 * Branding store
 *
 * 全站品牌信息（站点名 / 副标题 / Logo / Footer）。
 * App 启动时从 `GET /api/site/branding` 拉一次写入；超管在 `/admin/settings`
 * 修改后再调用 `set()` 即时更新。
 */
import { create } from 'zustand';
import { BRAND_LOGO_SRC, BRAND_NAME } from '@/lib/brand';

export interface Branding {
  name: string;
  tagline: string;
  logoUrl: string;
  footer: string;
}

interface BrandingState extends Branding {
  loaded: boolean;
  set: (b: Partial<Branding>) => void;
  markLoaded: () => void;
}

const CACHE_KEY = 'skillstack.branding';

const DEFAULT_BRANDING: Branding = {
  name: BRAND_NAME,
  tagline: '',
  logoUrl: BRAND_LOGO_SRC,
  footer: '',
};

/**
 * 首屏从 localStorage 读取上次已知品牌，避免刷新时先闪一下默认名/Logo 再被
 * `GET /api/site/branding` 覆盖。后端返回后会刷新缓存，下次刷新即用最新值。
 */
function readCache(): Branding {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return DEFAULT_BRANDING;
    const parsed = JSON.parse(raw) as Partial<Branding>;
    return {
      name: parsed.name || DEFAULT_BRANDING.name,
      tagline: parsed.tagline ?? '',
      logoUrl: parsed.logoUrl || DEFAULT_BRANDING.logoUrl,
      footer: parsed.footer ?? '',
    };
  } catch {
    return DEFAULT_BRANDING;
  }
}

function writeCache(b: Branding): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(b));
  } catch {
    // localStorage 不可用（隐私模式 / 配额）时静默跳过，不影响内存态
  }
}

export const useBrandingStore = create<BrandingState>((set) => ({
  // 初始值优先取 localStorage 缓存，缺失时回退到硬编码默认
  ...readCache(),
  loaded: false,
  set: (b) =>
    set((prev) => {
      const next = { ...prev, ...b };
      writeCache({ name: next.name, tagline: next.tagline, logoUrl: next.logoUrl, footer: next.footer });
      return next;
    }),
  markLoaded: () => set({ loaded: true }),
}));

/** 用于无 Hook 上下文（如 axios interceptor / 工具函数）直接读取。 */
export function getBranding(): Branding {
  const { name, tagline, logoUrl, footer } = useBrandingStore.getState();
  return { name, tagline, logoUrl, footer };
}
