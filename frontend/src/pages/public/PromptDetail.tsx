import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TOKENS } from '@/lib/tokens';
import { Badge, Button, Card, EmptyState } from '@/components/ui';
import { TopBar } from '@/components/chrome/TopBar';
import { I } from '@/components/icons';
import { getToken } from '@/api/client';
import { promptApi } from '@/api/endpoints';
import { PromptCommentsModule } from './Detail/Comments';
import type { SkillVersion } from './Detail/types';

type ContentTab = 'resolved' | 'raw';

export default function PromptDetail() {
  const nav = useNavigate();
  const { teamSlug = '', promptSlug = '' } = useParams();
  const [tab, setTab] = useState<ContentTab>('resolved');
  const promptQuery = useQuery({
    queryKey: ['prompt-detail', teamSlug, promptSlug],
    queryFn: () => promptApi.detail(teamSlug, promptSlug),
    enabled: !!teamSlug && !!promptSlug,
  });
  const prompt = promptQuery.data;
  const versionsQuery = useQuery({
    queryKey: ['prompt-versions', prompt?.id],
    queryFn: () => promptApi.versions(prompt!.id),
    enabled: typeof prompt?.id === 'number',
  });
  const resolvedMarkdown = prompt?.resolved?.markdown || prompt?.contentMd || '';
  const refs = useMemo(() => prompt?.resolved?.resolvedRefs ?? [], [prompt]);
  const versions: SkillVersion[] = useMemo(() => {
    if (!prompt) return [];
    const remote = versionsQuery.data ?? [];
    if (remote.length > 0) {
      return remote.map((v) => ({
        id: v.id,
        version: v.version,
        date: v.publishedAt || '',
        note: v.changelog || (v.version === prompt.version ? '当前审核版本' : '历史版本'),
        changelog: v.changelog,
        author: prompt.author?.name || '',
        installs: prompt.exports ?? 0,
        latest: v.version === prompt.version,
      }));
    }
    return [
      {
        version: prompt.version || '0.0.0',
        date: prompt.updated || '',
        note: '当前审核版本',
        author: prompt.author?.name || '',
        installs: prompt.exports ?? 0,
        latest: true,
      },
    ];
  }, [prompt, versionsQuery.data]);

  async function download(raw: boolean) {
    try {
      const { blob, fileName } = await promptApi.download(teamSlug, promptSlug, raw);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '下载失败');
    }
  }

  return (
    <div style={{ background: TOKENS.bgAlt, minHeight: '100%' }}>
      <TopBar active="plaza" authed={!!getToken()} />
      {promptQuery.isError ? (
        <div style={{ maxWidth: 980, margin: '0 auto', padding: 32 }}>
          <Card pad={24}>
            <EmptyState
              icon={<I.x size={20} />}
              title="Prompt 加载失败"
              hint={promptQuery.error instanceof Error ? promptQuery.error.message : '请稍后重试'}
              action={<Button variant="secondary" size="sm" onClick={() => promptQuery.refetch()}>重试</Button>}
            />
          </Card>
        </div>
      ) : promptQuery.isLoading || !prompt ? (
        <div style={{ maxWidth: 980, margin: '0 auto', padding: 32 }}>
          <Card pad={24}>
            <EmptyState icon={<I.clock size={20} />} title="正在加载 Prompt…" />
          </Card>
        </div>
      ) : (
        <>
          <section style={{ background: '#fff', borderBottom: `1px solid ${TOKENS.border}`, padding: '30px 32px' }}>
            <div style={{ maxWidth: 1080, margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
                {prompt.iconUrl ? (
                  <img
                    src={prompt.iconUrl}
                    alt=""
                    aria-hidden="true"
                    width={58}
                    height={58}
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: 10,
                      objectFit: 'cover',
                      display: 'block',
                      flex: '0 0 auto',
                      border: `1px solid ${TOKENS.borderSoft}`,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: 10,
                      background: TOKENS.bgGray,
                      color: TOKENS.primary,
                      display: 'grid',
                      placeItems: 'center',
                      flex: '0 0 auto',
                    }}
                  >
                    <I.code size={24} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>{prompt.name}</h1>
                    <Badge tone={prompt.visibility === 'PUBLIC' ? 'primary' : 'info'} size="sm">
                      {prompt.visibility === 'PUBLIC' ? '公开' : '团队私有'}
                    </Badge>
                    <Badge tone="neutral" size="sm">v{prompt.version}</Badge>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13.5, color: TOKENS.text2, lineHeight: 1.65 }}>
                    {prompt.shortDesc}
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', gap: 12, color: TOKENS.text3, fontSize: 12 }}>
                    <span>{prompt.teamName || prompt.teamSlug}</span>
                    <span>/{prompt.slug}</span>
                    <span>{prompt.exports ?? 0} 次导出</span>
                    <span>{refs.length} 个展开引用</span>
                  </div>
                </div>
                <Button variant="secondary" size="md" onClick={() => nav('/plaza')}>返回广场</Button>
                <Button variant="primary" size="md" icon={<I.download size={13} />} onClick={() => download(false)}>
                  下载 Markdown
                </Button>
              </div>
            </div>
          </section>

          <main
            style={{
              maxWidth: 1080,
              margin: '0 auto',
              padding: '24px 32px 54px',
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 300px',
              gap: 16,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <Card pad={0}>
                <div
                  style={{
                    padding: '12px 14px',
                    borderBottom: `1px solid ${TOKENS.borderSoft}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Button variant="ghost" type="button" onClick={() => setTab('resolved')} style={tabButton(tab === 'resolved')}>
                    展开预览
                  </Button>
                  <Button variant="ghost" type="button" onClick={() => setTab('raw')} style={tabButton(tab === 'raw')}>
                    原始 Markdown
                  </Button>
                  <span style={{ flex: 1 }} />
                  <Button variant="ghost" size="sm" icon={<I.download size={12} />} onClick={() => download(tab === 'raw')}>
                    下载当前视图
                  </Button>
                </div>
                <pre style={markdownStyle}>{tab === 'raw' ? prompt.contentMd : resolvedMarkdown}</pre>
              </Card>
              <PromptCommentsModule versions={versions} prompt={prompt} />
            </div>

            <aside style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Card pad={16}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>引用关系</div>
                {refs.length === 0 ? (
                  <div style={{ fontSize: 12, color: TOKENS.text3 }}>没有引用其他 Prompt。</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {refs.map((ref) => (
                      <Button variant="ghost"
                        key={`${ref.teamSlug}/${ref.slug}`}
                        type="button"
                        onClick={() => nav(`/prompts/${ref.teamSlug}/${ref.slug}`)}
                        style={{
                          padding: '8px 10px',
                          border: `1px solid ${TOKENS.borderSoft}`,
                          borderRadius: 6,
                          background: '#fff',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: TOKENS.text }}>{ref.name}</div>
                        <div style={{ fontSize: 11, color: TOKENS.text3, marginTop: 2 }}>
                          {ref.teamSlug}/{ref.slug}@{ref.version}
                        </div>
                      </Button>
                    ))}
                  </div>
                )}
              </Card>
              <Card pad={16}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>标签</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(prompt.tags ?? []).map((tag) => (
                    <Badge key={tag} tone="neutral" size="sm">{tag}</Badge>
                  ))}
                  {(prompt.tags ?? []).length === 0 && (
                    <span style={{ fontSize: 12, color: TOKENS.text3 }}>暂无标签</span>
                  )}
                </div>
              </Card>
              <Card pad={16}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>版本回溯</div>
                {versionsQuery.isLoading ? (
                  <div style={{ fontSize: 12, color: TOKENS.text3 }}>正在加载版本…</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {versions.slice(0, 5).map((v) => (
                      <Button variant="ghost"
                        key={v.id ?? v.version}
                        type="button"
                        onClick={() => nav(`/create/prompt?promptId=${prompt.id}&mode=version&version=${encodeURIComponent(v.version)}`)}
                        style={{
                          padding: '8px 10px',
                          border: `1px solid ${v.latest ? `${TOKENS.primary}55` : TOKENS.borderSoft}`,
                          borderRadius: 6,
                          background: v.latest ? TOKENS.primarySoft : '#fff',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: TOKENS.text }}>v{v.version}</span>
                          {v.latest && <Badge tone="success" size="sm">当前</Badge>}
                        </div>
                        <div style={{ fontSize: 11, color: TOKENS.text3, marginTop: 3 }}>
                          {v.date || '—'} · {v.note || '无变更说明'}
                        </div>
                      </Button>
                    ))}
                  </div>
                )}
              </Card>
            </aside>
          </main>
        </>
      )}
    </div>
  );
}

function tabButton(active: boolean): React.CSSProperties {
  return {
    height: 30,
    padding: '0 10px',
    border: `1px solid ${active ? TOKENS.primary : TOKENS.border}`,
    borderRadius: 6,
    background: active ? TOKENS.primarySoft : '#fff',
    color: active ? TOKENS.primaryDeep : TOKENS.text2,
    fontSize: 12,
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
}

const markdownStyle: React.CSSProperties = {
  margin: 0,
  padding: 20,
  minHeight: 520,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
  fontSize: 13,
  lineHeight: 1.7,
  color: TOKENS.text2,
};
