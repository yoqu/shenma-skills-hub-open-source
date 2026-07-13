import { useEffect, useState, type ReactNode } from 'react';
import { Check, Download, Folder, Monitor, RotateCw, Settings2, Target, type LucideIcon } from 'lucide-react';
import {
  Button,
  Input,
  Pressable,
  SegmentedControl,
  toast,
  TOKENS,
} from '@skillstack/ui';
import {
  defaultDesktopSettings,
  exportDesktopLogs,
  hasDesktopApi,
  openDesktopInstallDir,
  readDesktopSettings,
  saveDesktopSettings,
  testDesktopBackendConnection,
  type DesktopSettings,
} from './desktopBridge';
import { desktopEdgeScrollAreaStyle, desktopPageFrameStyle, useTransientScrollbar } from './transientScrollbar';
import type { DesktopAgent } from './types';

type ConnectionStatus = 'idle' | 'testing' | 'success' | 'error';

const agentOptions: Array<{ value: DesktopAgent; label: string }> = [
  { value: 'CLAUDE', label: 'Claude' },
  { value: 'CODEX', label: 'Codex' },
];

const storageOptions = [
  { value: 'skillstack', label: 'SkillStack', path: '~/.skillstack/skills' },
  { value: 'agents', label: 'Agents', path: '~/.agents/skills' },
];

const syncMethodOptions: Array<{ value: DesktopSettings['skillSyncMethod']; label: string }> = [
  { value: 'symlink', label: '软连接' },
  { value: 'copy', label: '文件复制' },
];

export default function DesktopSettingsPage() {
  const [settings, setSettings] = useState<DesktopSettings>(defaultDesktopSettings);
  const [apiBaseUrlDraft, setApiBaseUrlDraft] = useState(defaultDesktopSettings.apiBaseUrl);
  const [saving, setSaving] = useState(false);
  const [exportingLogs, setExportingLogs] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const scrollbar = useTransientScrollbar();
  const isDesktop = hasDesktopApi();

  useEffect(() => {
    let cancelled = false;

    readDesktopSettings()
      .then((value) => {
        if (!cancelled) {
          setSettings(value);
          setApiBaseUrlDraft(value.apiBaseUrl);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast({ kind: 'error', message: errorMessage(error, '设置读取失败') });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function persist(next: DesktopSettings) {
    setSettings(next);
    setSaving(true);
    try {
      const saved = await saveDesktopSettings(next);
      setSettings(saved);
      setApiBaseUrlDraft(saved.apiBaseUrl);
      toast({ kind: 'success', message: '设置已保存' });
    } catch (error) {
      toast({ kind: 'error', message: errorMessage(error, '设置保存失败') });
    } finally {
      setSaving(false);
    }
  }

  function toggleAgent(agent: DesktopAgent) {
    const selected = settings.agents.includes(agent);
    const agents = selected
      ? settings.agents.filter((item) => item !== agent)
      : [...settings.agents, agent];
    if (agents.length === 0) {
      return;
    }
    void persist({
      ...settings,
      agent: agents[0],
      agents,
    });
  }

  function updateSkillHomeDir(skillHomeDir: string) {
    void persist({ ...settings, skillHomeDir });
  }

  function updateSyncMethod(skillSyncMethod: DesktopSettings['skillSyncMethod']) {
    void persist({ ...settings, skillSyncMethod });
  }

  function saveBackendAddress() {
    const apiBaseUrl = apiBaseUrlDraft.trim();
    if (!apiBaseUrl || apiBaseUrl === settings.apiBaseUrl) {
      setApiBaseUrlDraft(settings.apiBaseUrl);
      return;
    }

    void persist({ ...settings, apiBaseUrl });
  }

  async function testBackendConnection() {
    setConnectionStatus('testing');
    try {
      await testDesktopBackendConnection(apiBaseUrlDraft);
      setConnectionStatus('success');
      toast({ kind: 'success', message: '后端连接正常' });
    } catch (error) {
      setConnectionStatus('error');
      toast({ kind: 'error', message: errorMessage(error, '后端连接失败') });
    }
  }

  async function openInstallDir() {
    try {
      await openDesktopInstallDir();
    } catch (error) {
      toast({ kind: 'error', message: errorMessage(error, '打开安装目录失败') });
    }
  }

  async function exportLogs() {
    setExportingLogs(true);
    try {
      const result = await exportDesktopLogs();
      toast({ kind: 'success', message: `日志已导出：${result.filePath}` });
    } catch (error) {
      toast({ kind: 'error', message: errorMessage(error, '导出日志失败') });
    } finally {
      setExportingLogs(false);
    }
  }

  const syncMethodLabel = syncMethodOptions.find((option) => option.value === settings.skillSyncMethod)?.label;
  const selectedAgentLabels = agentOptions
    .filter((option) => settings.agents.includes(option.value))
    .map((option) => option.label);

  return (
    <div style={pageStyle}>
      <div
        ref={scrollbar.scrollAreaRef}
        className="desktop-edge-scroll"
        onScroll={scrollbar.onScroll}
        style={desktopEdgeScrollAreaStyle}
      >
        <div style={contentStyle}>
          <h1 style={titleStyle}>设置</h1>

          <section style={{ ...panelStyle, ...connectionPanelStyle }}>
            <h2 style={sectionTitleStyle}>服务连接</h2>
            <div style={fieldLabelStyle}>服务器地址</div>
            <div style={connectionRowStyle}>
              <Input
                id="apiBaseUrl"
                value={apiBaseUrlDraft}
                onChange={(event) => {
                  setApiBaseUrlDraft(event.target.value);
                  setConnectionStatus('idle');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    saveBackendAddress();
                  }
                }}
                placeholder="http://localhost:8080"
                style={connectionInputStyle}
              />
              <span style={{ ...statusPillStyle, ...connectionStatusStyle(connectionStatus) }}>
                <span style={{ ...statusDotStyle, ...connectionStatusDotStyle(connectionStatus) }} />
                <span>{connectionStatusLabel(connectionStatus, isDesktop)}</span>
              </span>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => void testBackendConnection()}
                disabled={connectionStatus === 'testing'}
                style={testButtonStyle}
              >
                {connectionStatus === 'testing' ? '测试中' : '测试连接'}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={saveBackendAddress}
                disabled={saving || apiBaseUrlDraft.trim() === settings.apiBaseUrl}
                style={saveButtonStyle}
              >
                保存
              </Button>
            </div>
            <div style={dividerStyle} />
            <div style={deviceBlockStyle}>
              <div style={deviceTitleStyle}>当前设备</div>
              <div style={deviceRowStyle}>
                <Monitor size={34} strokeWidth={1.8} />
                <div>
                  <div style={deviceMainStyle}>
                    {isDesktop ? '桌面端' : '浏览器预览'}
                    <span style={deviceModeStyle}>
                      / {isDesktop ? '本地配置' : 'fallback 配置'}
                    </span>
                  </div>
                  <div style={devicePathStyle}>~/.skillstack/settings.json</div>
                </div>
              </div>
            </div>
          </section>

          <SettingsPanel icon={Folder} title="存储位置" value={settings.skillHomeDir}>
            <div style={storageChoiceGridStyle}>
              {storageOptions.map((option) => {
                const active = option.value === settings.skillStorageLocation;
                const disabled = option.value !== 'skillstack';
                return (
                  <Pressable
                    key={option.value}
                    disabled={disabled}
                    style={{
                      ...storageChoiceStyle,
                      ...(active ? activeStorageChoiceStyle : inactiveStorageChoiceStyle),
                      ...(disabled ? disabledStorageChoiceStyle : null),
                    }}
                  >
                    <span>{option.label}</span>
                    <span style={storageChoicePathStyle}>{option.path}</span>
                  </Pressable>
                );
              })}
            </div>
            <div style={fieldRowStyle}>
              <label htmlFor="skillHomeDir" style={compactLabelStyle}>Skills 主目录</label>
              <Input
                id="skillHomeDir"
                value={settings.skillHomeDir}
                onChange={(event) => updateSkillHomeDir(event.target.value)}
                style={compactInputStyle}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => void openInstallDir()}
                disabled={!isDesktop || saving}
                style={secondaryButtonStyle}
              >
                打开目录
              </Button>
            </div>
          </SettingsPanel>

          <SettingsPanel icon={RotateCw} title="同步方式" value={syncMethodLabel ?? settings.skillSyncMethod}>
            <SegmentedControl
              value={settings.skillSyncMethod}
              options={syncMethodOptions}
              onChange={updateSyncMethod}
              ariaLabel="技能同步方式"
              size="md"
            />
            <p style={helpTextStyle}>
              {settings.skillSyncMethod === 'symlink'
                ? '软连接节省磁盘空间并支持实时同步。注意：Windows 可能需要管理员权限或开启开发者模式。'
                : '文件复制兼容性更高，但安装后不会实时同步源目录变更。'}
            </p>
          </SettingsPanel>

          <SettingsPanel icon={Download} title="诊断日志" value={isDesktop ? '本地日志' : '不可用'}>
            <div style={diagnosticsRowStyle}>
              <div>
                <div style={diagnosticsTitleStyle}>桌面端日志</div>
                <div style={diagnosticsPathStyle}>~/.skillstack/logs/skillstack-desktop.log</div>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void exportLogs()}
                disabled={!isDesktop || exportingLogs}
                style={secondaryButtonStyle}
              >
                {exportingLogs ? '导出中' : '导出日志'}
              </Button>
            </div>
          </SettingsPanel>

          <SettingsPanel
            icon={Target}
            title="默认同步目标"
            value={selectedAgentLabels.length > 0 ? selectedAgentLabels.join(' / ') : '未选择'}
          >
            <div style={agentGridStyle}>
              {agentOptions.map((option) => {
                const active = settings.agents.includes(option.value);
                return (
                  <Pressable
                    key={option.value}
                    onClick={() => toggleAgent(option.value)}
                    style={{
                      ...agentButtonStyle,
                      ...(active ? activeAgentButtonStyle : inactiveAgentButtonStyle),
                    }}
                  >
                    <span style={agentTitleRowStyle}>
                      <span style={agentNameStyle}>{option.label}</span>
                      {active && <Check size={15} strokeWidth={2.4} />}
                    </span>
                    <span style={agentPathStyle}>
                      {option.value === 'CODEX' ? settings.codexSkillsDir : settings.claudeSkillsDir}
                    </span>
                  </Pressable>
                );
              })}
            </div>
          </SettingsPanel>
        </div>
      </div>
      <div className="desktop-edge-scroll-thumb" style={scrollbar.thumbStyle} />
    </div>
  );
}

interface SettingsPanelProps {
  icon: LucideIcon;
  title: string;
  value: ReactNode;
  children: ReactNode;
}

function SettingsPanel({ icon: Icon, title, value, children }: SettingsPanelProps) {
  return (
    <section style={panelStyle}>
      <div style={summaryHeaderStyle}>
        <Icon size={22} strokeWidth={1.9} style={summaryIconStyle} />
        <div style={summaryTitleStyle}>{title}</div>
        <div style={summaryValueStyle}>{value}</div>
        <Settings2 size={19} strokeWidth={1.9} style={summaryActionStyle} />
      </div>
      <div style={panelBodyStyle}>{children}</div>
    </section>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message || fallback : fallback;
}

function connectionStatusLabel(status: ConnectionStatus, isDesktop: boolean): string {
  if (status === 'testing') {
    return '测试中';
  }
  if (status === 'success') {
    return '已连接';
  }
  if (status === 'error') {
    return '连接失败';
  }
  return isDesktop ? '已连接' : '预览';
}

function connectionStatusStyle(status: ConnectionStatus): React.CSSProperties {
  if (status === 'error') {
    return {
      background: TOKENS.dangerSoft,
      color: TOKENS.danger,
    };
  }
  if (status === 'testing') {
    return {
      background: TOKENS.warningSoft,
      color: TOKENS.warning,
    };
  }
  return {};
}

function connectionStatusDotStyle(status: ConnectionStatus): React.CSSProperties {
  if (status === 'error') {
    return { background: TOKENS.danger };
  }
  if (status === 'testing') {
    return { background: TOKENS.warning };
  }
  return {};
}

const titleStyle: React.CSSProperties = {
  margin: '0 0 26px',
  fontSize: 25,
  lineHeight: 1,
  fontWeight: 850,
  color: TOKENS.text,
};

const pageStyle: React.CSSProperties = {
  ...desktopPageFrameStyle,
};

const contentStyle: React.CSSProperties = {
  width: 'min(920px, 100%)',
  display: 'grid',
  gap: 12,
  alignContent: 'start',
};

const panelStyle: React.CSSProperties = {
  border: `1px solid ${TOKENS.border}`,
  borderRadius: 8,
  background: TOKENS.bg,
};

const connectionPanelStyle: React.CSSProperties = {
  padding: '26px 26px 22px',
};

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 24px',
  color: TOKENS.text,
  fontSize: 20,
  lineHeight: 1.2,
  fontWeight: 850,
};

const fieldLabelStyle: React.CSSProperties = {
  marginBottom: 9,
  color: TOKENS.text,
  fontSize: 15,
  fontWeight: 720,
};

const connectionRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(280px, 1fr) 92px 112px 104px',
  gap: 18,
  alignItems: 'center',
};

const connectionInputStyle: React.CSSProperties = {
  height: 48,
  padding: '0 16px',
  borderColor: '#B9C1CA',
  borderRadius: 6,
  color: '#29323A',
  fontSize: 16,
};

const statusPillStyle: React.CSSProperties = {
  height: 28,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  borderRadius: 6,
  background: TOKENS.successSoft,
  color: TOKENS.successDeep,
  fontSize: 14,
  fontWeight: 760,
};

const statusDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: TOKENS.success,
};

const testButtonStyle: React.CSSProperties = {
  height: 42,
  borderRadius: 6,
  fontSize: 15,
  fontWeight: 720,
};

const saveButtonStyle: React.CSSProperties = {
  height: 42,
  borderRadius: 6,
  fontSize: 15,
  fontWeight: 720,
};

const dividerStyle: React.CSSProperties = {
  height: 1,
  margin: '26px 0 24px',
  background: TOKENS.borderSoft,
};

const deviceBlockStyle: React.CSSProperties = {
  display: 'grid',
  gap: 18,
};

const deviceTitleStyle: React.CSSProperties = {
  color: TOKENS.text,
  fontSize: 16,
  fontWeight: 820,
};

const deviceRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 24,
  paddingLeft: 10,
  color: TOKENS.text,
};

const deviceMainStyle: React.CSSProperties = {
  color: TOKENS.text,
  fontSize: 15,
  fontWeight: 780,
};

const deviceModeStyle: React.CSSProperties = {
  marginLeft: 10,
  color: TOKENS.text2,
  fontWeight: 650,
};

const devicePathStyle: React.CSSProperties = {
  marginTop: 6,
  color: TOKENS.text2,
  fontSize: 14,
};

const summaryHeaderStyle: React.CSSProperties = {
  minHeight: 70,
  display: 'grid',
  gridTemplateColumns: '34px 150px minmax(0, 1fr) 24px',
  alignItems: 'center',
  gap: 12,
  padding: '0 24px',
};

const summaryIconStyle: React.CSSProperties = {
  color: TOKENS.text,
};

const summaryTitleStyle: React.CSSProperties = {
  color: TOKENS.text,
  fontSize: 16,
  fontWeight: 800,
};

const summaryValueStyle: React.CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: TOKENS.text2,
  fontSize: 15,
};

const summaryActionStyle: React.CSSProperties = {
  color: TOKENS.text2,
};

const panelBodyStyle: React.CSSProperties = {
  borderTop: `1px solid ${TOKENS.borderSoft}`,
  padding: '16px 24px 18px',
};

const storageChoiceGridStyle: React.CSSProperties = {
  width: 'min(442px, 100%)',
  minHeight: 84,
  border: `1px solid ${TOKENS.border}`,
  borderRadius: 8,
  padding: 8,
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 8,
  background: TOKENS.bgAlt,
};

const storageChoiceStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 6,
  background: 'transparent',
  font: 'inherit',
  fontSize: 15,
  fontWeight: 750,
  display: 'grid',
  placeItems: 'center',
  gap: 4,
  padding: '10px 12px',
};

const activeStorageChoiceStyle: React.CSSProperties = {
  background: TOKENS.primary,
  color: '#fff',
};

const inactiveStorageChoiceStyle: React.CSSProperties = {
  color: TOKENS.text2,
};

const disabledStorageChoiceStyle: React.CSSProperties = {
  cursor: 'not-allowed',
  opacity: 0.7,
};

const storageChoicePathStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 650,
};

const fieldRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '104px minmax(0, 1fr) auto',
  gap: 10,
  alignItems: 'center',
  marginTop: 14,
};

const compactLabelStyle: React.CSSProperties = {
  color: TOKENS.text2,
  fontSize: 13,
  fontWeight: 700,
};

const compactInputStyle: React.CSSProperties = {
  height: 38,
  borderRadius: 6,
};

const secondaryButtonStyle: React.CSSProperties = {
  height: 38,
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 650,
};

const helpTextStyle: React.CSSProperties = {
  margin: '12px 0 0',
  fontSize: 13.5,
  lineHeight: 1.55,
  color: TOKENS.text2,
};

const diagnosticsRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
};

const diagnosticsTitleStyle: React.CSSProperties = {
  color: TOKENS.text,
  fontSize: 14,
  fontWeight: 760,
};

const diagnosticsPathStyle: React.CSSProperties = {
  marginTop: 5,
  color: TOKENS.text2,
  fontSize: 12.5,
};

const agentGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
};

const agentButtonStyle: React.CSSProperties = {
  border: `1px solid ${TOKENS.border}`,
  borderRadius: 8,
  padding: 12,
  textAlign: 'left',
  display: 'grid',
  gap: 5,
  font: 'inherit',
};

const activeAgentButtonStyle: React.CSSProperties = {
  borderColor: TOKENS.primary,
  background: TOKENS.primarySoft,
  color: TOKENS.primaryDeep,
};

const inactiveAgentButtonStyle: React.CSSProperties = {
  borderColor: TOKENS.border,
  background: TOKENS.bg,
  color: TOKENS.text,
};

const agentTitleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
};

const agentNameStyle: React.CSSProperties = {
  fontWeight: 750,
};

const agentPathStyle: React.CSSProperties = {
  color: TOKENS.text2,
  fontSize: 12,
};
