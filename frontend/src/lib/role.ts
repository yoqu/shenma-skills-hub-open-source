import { useSearchParams } from 'react-router-dom';

export type Role = 'Admin' | 'Member';

/** Read role from URL `?as=admin|member` (default Admin = current user zhao_yc). */
export function useRole(): Role {
  const [params] = useSearchParams();
  const v = (params.get('as') || '').toLowerCase();
  if (v === 'member') return 'Member';
  return 'Admin';
}
