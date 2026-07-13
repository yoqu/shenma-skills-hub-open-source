import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCurrentTeam } from '../useCurrentTeam';
import { useCurrentTeamStore } from '@/store/currentTeam';
import type { MyTeam } from '@/mocks/team';

// Mock the API data hook
vi.mock('@/api/data', () => ({
  useMyTeams: vi.fn(),
}));

import { useMyTeams } from '@/api/data';

const mockUseMyTeams = useMyTeams as any;

// Mimic the state after a real app boot where the store has just read
// localStorage. Tests use this to simulate "previous session persisted X".
function seedStoredTeam(id: string) {
  localStorage.setItem('skillstack:currentTeamId', id);
  useCurrentTeamStore.setState({ currentTeamId: id });
}

// Sample teams for testing
const TEAM_1: MyTeam = {
  id: 'team-1',
  slug: 'team-one',
  name: 'Team One',
  avatar: 'T1',
  color: '#FF0000',
  role: 'Admin',
  members: 10,
  unread: 0,
};

const TEAM_2: MyTeam = {
  id: 'team-2',
  slug: 'team-two',
  name: 'Team Two',
  avatar: 'T2',
  color: '#00FF00',
  role: 'Member',
  members: 5,
  unread: 2,
};

const TEAM_3: MyTeam = {
  id: 'team-3',
  slug: 'team-three',
  name: 'Team Three',
  avatar: 'T3',
  color: '#0000FF',
  role: 'Viewer',
  members: 3,
  unread: 1,
};

describe('useCurrentTeam', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset the shared zustand store so cases stay isolated
    useCurrentTeamStore.setState({ currentTeamId: '' });
    vi.clearAllMocks();
    // Suppress console warnings during tests
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('localStorage error handling', () => {
    it('should handle localStorage.getItem errors gracefully on store init', async () => {
      // The initial localStorage read happens at store module load time, so we
      // need to reset and re-import to exercise that path with the spy active.
      vi.resetModules();
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
      getItemSpy.mockImplementationOnce(() => {
        throw new Error('localStorage not available');
      });

      const { useCurrentTeamStore: freshStore } = await import('@/store/currentTeam');

      // Falls back to '' instead of throwing
      expect(freshStore.getState().currentTeamId).toBe('');
      expect(getItemSpy).toHaveBeenCalledWith('skillstack:currentTeamId');
    });

    it('should handle localStorage.setItem errors gracefully', () => {
      const setItemSpy = vi
        .spyOn(Storage.prototype, 'setItem')
        .mockImplementationOnce(() => {
          throw new Error('localStorage not available');
        });

      mockUseMyTeams.mockReturnValue({
        data: [TEAM_1, TEAM_2],
      });

      const { result } = renderHook(() => useCurrentTeam(true));

      // Should not throw, just log a warning
      expect(() => {
        act(() => {
          result.current.setCurrentTeamId('team-1');
        });
      }).not.toThrow();

      expect(setItemSpy).toHaveBeenCalledWith('skillstack:currentTeamId', 'team-1');
    });
  });

  describe('initial render with empty teams array', () => {
    it('should start with empty teamId when no teams are available', () => {
      mockUseMyTeams.mockReturnValue({
        data: [],
      });

      const { result } = renderHook(() => useCurrentTeam(false));

      expect(result.current.teamId).toBe('');
      expect(result.current.teamSlug).toBe('');
      expect(result.current.role).toBeUndefined();
      expect(result.current.isReady).toBe(false);
    });

    it('should not set currentTeamId when teams are empty', () => {
      mockUseMyTeams.mockReturnValue({
        data: [],
      });

      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      renderHook(() => useCurrentTeam(false));

      expect(setItemSpy).not.toHaveBeenCalled();
    });
  });

  describe('selecting first team when no stored preference exists', () => {
    it('should auto-select first team when no localStorage preference is found', () => {
      mockUseMyTeams.mockReturnValue({
        data: [TEAM_1, TEAM_2, TEAM_3],
      });

      const { result } = renderHook(() => useCurrentTeam(true));

      // After teams load, first team should be selected
      expect(result.current.teamId).toBe('team-1');
      expect(result.current.teamSlug).toBe('team-one');
      expect(result.current.role).toBe('Admin');
      expect(result.current.isReady).toBe(true);
    });

    it('should persist first team selection to localStorage', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      mockUseMyTeams.mockReturnValue({
        data: [TEAM_1, TEAM_2, TEAM_3],
      });

      renderHook(() => useCurrentTeam(true));

      expect(setItemSpy).toHaveBeenCalledWith('skillstack:currentTeamId', 'team-1');
    });

    it('should not auto-select when teams array is undefined', () => {
      mockUseMyTeams.mockReturnValue({
        data: undefined,
      });

      const { result } = renderHook(() => useCurrentTeam(false));

      expect(result.current.teamId).toBe('');
      expect(result.current.isReady).toBe(false);
    });
  });

  describe('switching teams and verifying localStorage updates', () => {
    it('should update currentTeamId when setCurrentTeamId is called', () => {
      mockUseMyTeams.mockReturnValue({
        data: [TEAM_1, TEAM_2, TEAM_3],
      });

      const { result } = renderHook(() => useCurrentTeam(true));

      act(() => {
        result.current.setCurrentTeamId('team-2');
      });

      expect(result.current.teamId).toBe('team-2');
      expect(result.current.teamSlug).toBe('team-two');
      expect(result.current.role).toBe('Member');
    });

    it('should persist team switch to localStorage', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      mockUseMyTeams.mockReturnValue({
        data: [TEAM_1, TEAM_2, TEAM_3],
      });

      const { result } = renderHook(() => useCurrentTeam(true));

      act(() => {
        result.current.setCurrentTeamId('team-3');
      });

      // Should be called twice: once for initial team selection, once for switch
      expect(setItemSpy).toHaveBeenCalledWith('skillstack:currentTeamId', 'team-3');
    });

    it('should restore team from localStorage on init', () => {
      // The store snapshot is reset in beforeEach to mimic a fresh app boot;
      // seed it as if the previous session persisted "team-2" to localStorage.
      seedStoredTeam('team-2');

      mockUseMyTeams.mockReturnValue({
        data: [TEAM_1, TEAM_2, TEAM_3],
      });

      const { result } = renderHook(() => useCurrentTeam(true));

      expect(result.current.teamId).toBe('team-2');
      expect(result.current.teamSlug).toBe('team-two');
      expect(result.current.role).toBe('Member');
      expect(result.current.isReady).toBe(true);
    });
  });

  describe('finding team by slug when ID doesn\'t match', () => {
    it('should find team by ID first', () => {
      seedStoredTeam('team-1');

      mockUseMyTeams.mockReturnValue({
        data: [TEAM_1, TEAM_2, TEAM_3],
      });

      const { result } = renderHook(() => useCurrentTeam(true));

      expect(result.current.teamSlug).toBe('team-one');
      expect(result.current.role).toBe('Admin');
    });

    it('should fallback to finding team by slug when ID doesn\'t match', () => {
      seedStoredTeam('team-one');

      mockUseMyTeams.mockReturnValue({
        data: [TEAM_1, TEAM_2, TEAM_3],
      });

      const { result } = renderHook(() => useCurrentTeam(true));

      // Should find the team by slug fallback
      expect(result.current.teamSlug).toBe('team-one');
      expect(result.current.role).toBe('Admin');
      expect(result.current.isReady).toBe(true);
    });

    it('should prefer ID match over slug match if both available', () => {
      const TEAM_WITH_MATCHING_SLUG: MyTeam = {
        ...TEAM_2,
        id: 'different-id',
        slug: 'team-one', // Same slug as TEAM_1
      };

      seedStoredTeam('team-1');

      mockUseMyTeams.mockReturnValue({
        data: [TEAM_1, TEAM_WITH_MATCHING_SLUG],
      });

      const { result } = renderHook(() => useCurrentTeam(true));

      // Should prefer exact ID match over slug match
      expect(result.current.role).toBe('Admin');
    });
  });

  describe('handling invalid team ID gracefully', () => {
    it('should recover to the first available team when stored team is stale', () => {
      seedStoredTeam('nonexistent-team');

      mockUseMyTeams.mockReturnValue({
        data: [TEAM_1, TEAM_2, TEAM_3],
      });

      const { result } = renderHook(() => useCurrentTeam(true));

      expect(result.current.teamId).toBe('team-1');
      expect(result.current.teamSlug).toBe('team-one');
      expect(result.current.role).toBe('Admin');
      expect(result.current.isReady).toBe(true);
      expect(localStorage.getItem('skillstack:currentTeamId')).toBe('team-1');
    });

    it('should not warn when stale stored team is recovered', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      seedStoredTeam('nonexistent-team');

      mockUseMyTeams.mockReturnValue({
        data: [TEAM_1, TEAM_2, TEAM_3],
      });

      renderHook(() => useCurrentTeam(true));

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should not log warning when team is found', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      seedStoredTeam('team-1');

      mockUseMyTeams.mockReturnValue({
        data: [TEAM_1, TEAM_2, TEAM_3],
      });

      renderHook(() => useCurrentTeam(true));

      // Should only warn about localStorage issues, not team not found
      expect(warnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Team with ID')
      );
    });
  });

  describe('authed parameter handling', () => {
    it('should pass authed parameter to useMyTeams', () => {
      mockUseMyTeams.mockReturnValue({
        data: [TEAM_1],
      });

      renderHook(() => useCurrentTeam(true));

      expect(mockUseMyTeams).toHaveBeenCalledWith(true);
    });

    it('should default authed parameter to false', () => {
      mockUseMyTeams.mockReturnValue({
        data: [TEAM_1],
      });

      renderHook(() => useCurrentTeam());

      expect(mockUseMyTeams).toHaveBeenCalledWith(false);
    });
  });

  describe('return value shape', () => {
    it('should return all expected properties', () => {
      mockUseMyTeams.mockReturnValue({
        data: [TEAM_1],
      });

      const { result } = renderHook(() => useCurrentTeam(true));

      expect(result.current).toHaveProperty('teamId');
      expect(result.current).toHaveProperty('teamSlug');
      expect(result.current).toHaveProperty('role');
      expect(result.current).toHaveProperty('setCurrentTeamId');
      expect(result.current).toHaveProperty('isReady');
    });

    it('setCurrentTeamId should be a callable function', () => {
      mockUseMyTeams.mockReturnValue({
        data: [TEAM_1, TEAM_2],
      });

      const { result } = renderHook(() => useCurrentTeam(true));

      expect(typeof result.current.setCurrentTeamId).toBe('function');

      expect(() => {
        act(() => {
          result.current.setCurrentTeamId('team-2');
        });
      }).not.toThrow();
    });
  });
});
