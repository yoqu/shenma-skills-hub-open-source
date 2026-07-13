import { useNavigate } from 'react-router-dom';
import { Button, DashTopBar } from '@/components/ui';
import { I } from '@/components/icons';
import { MemberShell } from './_shared/MemberShell';
import { PromptLibraryBody } from '../_shared/PromptLibraryBody';

export default function MemberPrompts() {
  const nav = useNavigate();
  return (
    <MemberShell active="prompts">
      <DashTopBar
        title="Prompt 库"
        hint="浏览团队 Prompt · 支持组合引用和 Markdown 导出"
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<I.plus size={12} />}
            onClick={() => nav('/create/prompt')}
          >
            提交 Prompt
          </Button>
        }
      />
      <PromptLibraryBody writer />
    </MemberShell>
  );
}
