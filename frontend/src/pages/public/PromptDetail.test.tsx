import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import PromptDetail from './PromptDetail';
import { promptApi, skillApi } from '@/api/endpoints';

vi.mock('@/api/client', () => ({
  getToken: () => null,
}));

vi.mock('@/api/data', () => ({
  useMyTeams: () => ({ data: [], me: undefined }),
}));

vi.mock('@/hooks/useCurrentTeam', () => ({
  useCurrentTeam: () => ({
    teamId: '',
    teamSlug: '',
    role: undefined,
    isReady: false,
    setCurrentTeamId: vi.fn(),
  }),
}));

function renderPromptDetail() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/prompts/ludou-fe/base-role']}>
        <Routes>
          <Route path="/prompts/:teamSlug/:promptSlug" element={<PromptDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PromptDetail', () => {
  it('renders prompt comments and loads prompt reviews through the prompt API', async () => {
    const detailSpy = vi.spyOn(promptApi, 'detail').mockResolvedValue({
      id: 7,
      slug: 'base-role',
      teamSlug: 'ludou-fe',
      teamName: '麓豆前端',
      name: '基础角色',
      shortDesc: '通用角色设定',
      cat: 'ai',
      visibility: 'PUBLIC',
      status: 'APPROVED',
      version: '1.2.0',
      score: 0,
      stars: 0,
      exports: 0,
      updated: '2026-05-25',
      tags: ['prompt'],
      author: { name: '赵一辰', handle: 'zhao_yc' },
      contentMd: '# 基础角色',
      resolved: { markdown: '# 基础角色', resolvedRefs: [] },
    });
    const promptReviewsSpy = vi.spyOn(promptApi, 'reviews').mockResolvedValue({
      avg: 0,
      total: 0,
      distribution: [5, 4, 3, 2, 1].map((star) => ({ star, count: 0 })),
      items: [],
      myReviewId: null,
    });
    const skillReviewsSpy = vi.spyOn(skillApi, 'reviews');

    renderPromptDetail();

    expect(await screen.findByText('基础角色')).toBeTruthy();
    expect(await screen.findByText('评论与评分')).toBeTruthy();

    await waitFor(() => {
      expect(promptReviewsSpy).toHaveBeenCalledWith(7);
    });
    expect(skillReviewsSpy).not.toHaveBeenCalled();
    expect(detailSpy).toHaveBeenCalledWith('ludou-fe', 'base-role');
  });
});
