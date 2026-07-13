import { useNavigate } from 'react-router-dom';
import { Button, DashTopBar } from '@/components/ui';
import { I } from '@/components/icons';
import { useTeamPrompts } from '@/api/data';
import { AdminShell } from './_shared/AdminShell';
import { PromptLibraryBody } from '../_shared/PromptLibraryBody';

export default function AdminPrompts() {
  const nav = useNavigate();
  const { data: prompts = [] } = useTeamPrompts({ size: 1 });
  return (
    <AdminShell active="prompts">
      <DashTopBar
        title="Prompt 库"
        hint={`团队可复用提示词 · ${prompts.length} 项可见`}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<I.plus size={12} />}
            onClick={() => nav('/create/prompt')}
          >
            新建 Prompt
          </Button>
        }
      />
      <PromptLibraryBody writer />
    </AdminShell>
  );
}
