import { Button, SectionHeader } from '@/components/ui';
import { I } from '@/components/icons';
import { SkillSourceUploader, uploadKindLabel } from './SkillSourceUploader';
import type { UploadInfo } from './types';

export interface Step1Props {
  upload: UploadInfo | null;
  setUpload: (u: UploadInfo | null) => void;
  onNext: () => void;
  onCancel?: () => void;
}

export function Step1Upload({ upload, setUpload, onNext, onCancel }: Step1Props) {
  return (
    <div>
      <SectionHeader
        title="上传 Skill 源文件"
        hint={
          upload
            ? `已就绪 · ${uploadKindLabel(upload.kind)}`
            : '支持完整压缩包、单文件 SKILL.md,或直接粘贴文本'
        }
      />

      <SkillSourceUploader upload={upload} setUpload={setUpload} showHint />

      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        <Button variant="ghost" size="md" onClick={onCancel}>
          取消
        </Button>
        {upload && (
          <>
            <span style={{ flex: 1 }} />
            <Button variant="primary" size="md" onClick={onNext} icon={<I.chevR size={12} />}>
              下一步 · 解析
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
