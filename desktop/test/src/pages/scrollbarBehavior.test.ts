import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('desktop internal scrollbar behavior', () => {
  it('keeps internal scrollbars hidden until their content area is scrolling', () => {
    const css = readFileSync(new URL('../../../src/styles.css', import.meta.url), 'utf8');
    const scrollbar = readFileSync(new URL('../../../src/pages/transientScrollbar.ts', import.meta.url), 'utf8');

    expect(css).toContain('.desktop-edge-scroll');
    expect(css).toContain('scrollbar-width: none;');
    expect(css).toContain('.desktop-edge-scroll::-webkit-scrollbar');
    expect(css).toContain('display: none;');
    expect(css).toContain('.desktop-edge-scroll-thumb');
    expect(css).toContain('background: #dedede;');
    expect(css).toContain('opacity 900ms ease');
    expect(scrollbar).toContain('thumbStyle');
    expect(scrollbar).toContain('opacity: isVisible && canScroll ? 1 : 0');
    expect(scrollbar).toContain('SCROLLBAR_FADE_DELAY_MS = 700');
    expect(css).not.toContain(':hover::-webkit-scrollbar-thumb');
  });

  it('uses page-level scroll containers aligned to the window edge', () => {
    const layout = readFileSync(new URL('../../../src/pages/DesktopLayout.tsx', import.meta.url), 'utf8');
    const mySkills = readFileSync(new URL('../../../src/pages/MySkillsPage.tsx', import.meta.url), 'utf8');
    const plaza = readFileSync(new URL('../../../src/pages/PlazaPage.tsx', import.meta.url), 'utf8');
    const recommendations = readFileSync(new URL('../../../src/pages/RecommendationsPage.tsx', import.meta.url), 'utf8');
    const settings = readFileSync(new URL('../../../src/pages/DesktopSettingsPage.tsx', import.meta.url), 'utf8');

    expect(layout).not.toContain('desktop-window-scroll');
    expect(layout).toContain("overflow: 'hidden'");
    expect(mySkills).toContain('useTransientScrollbar');
    expect(plaza).toContain('useTransientScrollbar');
    expect(recommendations).toContain('useTransientScrollbar');
    expect(settings).toContain('useTransientScrollbar');
    expect(mySkills).toContain('desktopEdgeScrollAreaStyle');
    expect(plaza).toContain('desktopEdgeScrollAreaStyle');
    expect(recommendations).toContain('desktopEdgeScrollAreaStyle');
    expect(settings).toContain('desktopEdgeScrollAreaStyle');
  });

  it('keeps My Skills category spacing fixed instead of stretching with window height', () => {
    const mySkills = readFileSync(new URL('../../../src/pages/MySkillsPage.tsx', import.meta.url), 'utf8');

    expect(mySkills).toContain("alignContent: 'start'");
    expect(mySkills).toContain('rowGap: 32');
    expect(mySkills).not.toContain('gap: 4');
  });

  it('aligns content page titles with the sidebar brand top edge', () => {
    const layout = readFileSync(new URL('../../../src/pages/DesktopLayout.tsx', import.meta.url), 'utf8');

    expect(layout).toContain("padding: '56px 16px 16px'");
    expect(layout).toContain("padding: '56px 0 44px 38px'");
    expect(layout).not.toContain("padding: '70px 0 44px 38px'");
  });
});
