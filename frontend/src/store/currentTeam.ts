/**
 * Current team store
 *
 * 全局当前团队上下文。所有 `useCurrentTeam` 调用方共享同一份 state，
 * 任意一处切换团队都会立即触发所有订阅方重渲染（而不是等下次页面刷新
 * 才能从 localStorage 拿到新值）。
 */
import { create } from 'zustand';

export const CURRENT_TEAM_STORAGE_KEY = 'skillstack:currentTeamId';

function readInitial(): string {
  try {
    return localStorage.getItem(CURRENT_TEAM_STORAGE_KEY) || '';
  } catch (error) {
    console.warn('Failed to read team preference from localStorage:', error);
    return '';
  }
}

interface CurrentTeamState {
  currentTeamId: string;
  setCurrentTeamId: (teamId: string) => void;
}

export const useCurrentTeamStore = create<CurrentTeamState>((set) => ({
  currentTeamId: readInitial(),
  setCurrentTeamId: (teamId) => {
    set({ currentTeamId: teamId });
    try {
      localStorage.setItem(CURRENT_TEAM_STORAGE_KEY, teamId);
    } catch (error) {
      console.warn('Failed to save team preference to localStorage:', error);
    }
  },
}));
