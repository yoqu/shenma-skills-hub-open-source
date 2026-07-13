import { useEffect, useState } from 'react';
import { TOKENS } from '@/lib/tokens';
import {
  Button,
  Card,
  DashTopBar,
  FormField,
  Input,
  Select,
  Textarea,
  toast,
} from '@/components/ui';
import { I } from '@/components/icons';
import {
  useAdminSmsProvider,
  useAdminOAuthProviders,
  useUpdateAdminSmsProvider,
  useUpdateAdminOAuthProvider,
} from '@/api/admin';
import type { AdminProviderVO, AdminSmsProviderVO, UpdateProviderReq, UpdateSmsProviderReq } from '@/api/endpoints';
import { AdminLayout } from './AdminLayout';

export default function AdminOAuthPage() {
  const providersQuery = useAdminOAuthProviders();
  const smsProviderQuery = useAdminSmsProvider();
  const providers = providersQuery.data ?? [];

  return (
    <AdminLayout active="oauth">
      <DashTopBar
        title="登录方式"
        hint="管理第三方登录的启用状态与参数"
      />
      <div
        style={{
          padding: '24px 32px 40px',
          overflow: 'auto',
          display: 'grid',
          gap: 12,
          maxWidth: 880,
        }}
      >
        {providersQuery.isLoading && (
          <div style={{ color: TOKENS.text3, fontSize: 13, padding: '16px 0' }}>加载中…</div>
        )}
        {(providersQuery.isError || smsProviderQuery.isError) && (
          <div style={{ color: TOKENS.danger, fontSize: 13, padding: '16px 0' }}>
            加载失败，请刷新重试
          </div>
        )}
        {smsProviderQuery.data && (
          <SmsProviderRow provider={smsProviderQuery.data} />
        )}
        {providers.map((p) => (
          <ProviderRow key={p.code} provider={p} />
        ))}
      </div>
    </AdminLayout>
  );
}

function isProviderConfigured(p: AdminProviderVO): boolean {
  return Boolean(p.clientId && p.clientId.length > 0 && p.clientSecretSet);
}

function isSmsProviderConfigured(p: AdminSmsProviderVO): boolean {
  if (p.providerType === 'LINGYANG_CHAOXIN') {
    const extra = parseJsonObject(p.extraJson);
    return Boolean(
      p.endpointUrl &&
        extra.appId &&
        extra.accessKey &&
        extra.signName &&
        extra.templateCode &&
        p.secretJsonSet,
    );
  }
  return Boolean(p.endpointUrl && p.endpointUrl.length > 0 && p.bodyTemplate && p.bodyTemplate.length > 0);
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function stringValue(value: unknown): string {
  return value == null ? '' : String(value);
}

function parseHeaders(value: string | null | undefined): SmsHeaderDraft[] {
  if (!value) {
    return [{ name: 'Content-Type', value: 'application/json', secret: false }];
  }
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      name: stringValue(item?.name),
      value: stringValue(item?.value),
      secret: Boolean(item?.secret) || String(item?.type ?? '').toUpperCase() === 'SECRET',
      valueSet: Boolean(item?.valueSet),
    }));
  } catch {
    return [];
  }
}

function buildLingyangExtraJson(draft: LingyangDraft): string {
  const extra: Record<string, string | number> = {
    appId: draft.appId,
    accessKey: draft.accessKey,
    signName: draft.signName,
    templateCode: draft.templateCode,
    templateParamKey: draft.templateParamKey || 'code',
  };
  if (draft.smsReport) extra.smsReport = draft.smsReport;
  if (draft.timeout) extra.timeout = Number(draft.timeout);
  if (draft.maxRetry) extra.maxRetry = Number(draft.maxRetry);
  return JSON.stringify(extra);
}

function buildLingyangSecretJson(draft: LingyangDraft, cleared: boolean): string | undefined {
  if (cleared) return '';
  if (draft.accessSecret) return JSON.stringify({ accessSecret: draft.accessSecret });
  if (draft.accessSecretSet) return JSON.stringify({ accessSecret: '', accessSecretSet: true });
  return undefined;
}

function isDraftConfigured(draft: SmsProviderDraft, accessSecretCleared: boolean): boolean {
  if (!draft.endpointUrl.trim()) return false;
  if (draft.providerType === 'HTTP') {
    return Boolean(draft.bodyTemplate.trim());
  }
  return Boolean(
    draft.lingyang.appId.trim() &&
      draft.lingyang.accessKey.trim() &&
      draft.lingyang.signName.trim() &&
      draft.lingyang.templateCode.trim() &&
      (draft.lingyang.accessSecret.trim() || (draft.lingyang.accessSecretSet && !accessSecretCleared)),
  );
}

interface ProviderRowProps {
  provider: AdminProviderVO;
}

function ProviderRow({ provider }: ProviderRowProps) {
  const updateMutation = useUpdateAdminOAuthProvider();
  const [configureOpen, setConfigureOpen] = useState(false);
  const [enableOnSave, setEnableOnSave] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);

  const configured = isProviderConfigured(provider);

  function openConfigure(enableAfter: boolean) {
    setEnableOnSave(enableAfter);
    setConfigureOpen(true);
  }

  function handleToggleEnabled(nextEnabled: boolean) {
    if (nextEnabled && !configured) {
      openConfigure(true);
      return;
    }
    if (!nextEnabled && provider.enabled) {
      setConfirmDisable(true);
      return;
    }
    doToggleEnabled(nextEnabled);
  }

  function doToggleEnabled(nextEnabled: boolean) {
    updateMutation.mutate(
      { code: provider.code, body: { enabled: nextEnabled } },
      {
        onSuccess: () =>
          toast({
            kind: 'success',
            message: nextEnabled
              ? `${provider.displayName} 已启用`
              : `${provider.displayName} 已关闭`,
          }),
        onError: (err) =>
          toast({
            kind: 'error',
            message: err instanceof Error ? `操作失败：${err.message}` : '操作失败',
          }),
      },
    );
  }

  return (
    <>
      <Card pad={16}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {provider.iconUrl ? (
            <img
              src={provider.iconUrl}
              alt=""
              style={{
                width: 32,
                height: 32,
                objectFit: 'contain',
                borderRadius: 6,
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: TOKENS.borderSoft,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <I.globe size={18} style={{ color: TOKENS.text3 }} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14.5,
                fontWeight: 600,
                color: TOKENS.text,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {provider.displayName}
              <StatusPill enabled={provider.enabled} configured={configured} />
            </div>
            <div style={{ fontSize: 11.5, color: TOKENS.text3, marginTop: 2 }}>
              {provider.code}
              {!configured && (
                <span style={{ color: TOKENS.warning, marginLeft: 8 }}>
                  · 未配置 Client ID / Secret
                </span>
              )}
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openConfigure(false)}
            disabled={updateMutation.isPending}
          >
            配置
          </Button>
          <ToggleSwitch
            checked={provider.enabled}
            onChange={handleToggleEnabled}
            disabled={updateMutation.isPending}
          />
        </div>
      </Card>

      {configureOpen && (
        <ConfigureDialog
          provider={provider}
          enableOnSave={enableOnSave}
          onClose={() => setConfigureOpen(false)}
        />
      )}

      {confirmDisable && (
        <DisableConfirmDialog
          providerName={provider.displayName}
          onConfirm={() => {
            setConfirmDisable(false);
            doToggleEnabled(false);
          }}
          onCancel={() => setConfirmDisable(false)}
        />
      )}
    </>
  );
}

interface SmsProviderRowProps {
  provider: AdminSmsProviderVO;
}

function SmsProviderRow({ provider }: SmsProviderRowProps) {
  const updateMutation = useUpdateAdminSmsProvider();
  const [configureOpen, setConfigureOpen] = useState(false);
  const [enableOnSave, setEnableOnSave] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const configured = isSmsProviderConfigured(provider);

  function openConfigure(enableAfter: boolean) {
    setEnableOnSave(enableAfter);
    setConfigureOpen(true);
  }

  function handleToggleEnabled(nextEnabled: boolean) {
    if (nextEnabled && !configured) {
      openConfigure(true);
      return;
    }
    if (!nextEnabled && provider.enabled) {
      setConfirmDisable(true);
      return;
    }
    doToggleEnabled(nextEnabled);
  }

  function doToggleEnabled(nextEnabled: boolean) {
    updateMutation.mutate(
      { enabled: nextEnabled },
      {
        onSuccess: () =>
          toast({
            kind: 'success',
            message: nextEnabled ? '短信验证码已启用' : '短信验证码已关闭',
          }),
        onError: (err) =>
          toast({
            kind: 'error',
            message: err instanceof Error ? `操作失败：${err.message}` : '操作失败',
          }),
      },
    );
  }

  return (
    <>
      <Card pad={16}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              background: TOKENS.primarySoft,
              color: TOKENS.primaryDeep,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <I.phone size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 14.5,
                fontWeight: 600,
                color: TOKENS.text,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {provider.displayName || '短信验证码'}
              <StatusPill enabled={provider.enabled} configured={configured} />
            </div>
            <div style={{ fontSize: 11.5, color: TOKENS.text3, marginTop: 2 }}>
              {provider.code}
              {!configured && (
                <span style={{ color: TOKENS.warning, marginLeft: 8 }}>
                  · 未配置请求地址 / 请求体模板
                </span>
              )}
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => openConfigure(false)}
            disabled={updateMutation.isPending}
          >
            配置
          </Button>
          <ToggleSwitch
            checked={provider.enabled}
            onChange={handleToggleEnabled}
            disabled={updateMutation.isPending}
          />
        </div>
      </Card>

      {configureOpen && (
        <SmsConfigureDialog
          provider={provider}
          enableOnSave={enableOnSave}
          onClose={() => setConfigureOpen(false)}
        />
      )}

      {confirmDisable && (
        <DisableConfirmDialog
          providerName={provider.displayName || '短信验证码'}
          onConfirm={() => {
            setConfirmDisable(false);
            doToggleEnabled(false);
          }}
          onCancel={() => setConfirmDisable(false)}
        />
      )}
    </>
  );
}

interface StatusPillProps {
  enabled: boolean;
  configured: boolean;
}

function StatusPill({ enabled, configured }: StatusPillProps) {
  const bg = enabled
    ? (TOKENS.successSoft)
    : configured
      ? (TOKENS.borderSoft)
      : (TOKENS.warningSoft);
  const fg = enabled
    ? (TOKENS.success)
    : configured
      ? TOKENS.text3
      : (TOKENS.warning);
  const label = enabled ? '已启用' : configured ? '已关闭' : '待配置';
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        padding: '2px 8px',
        borderRadius: 999,
        background: bg,
        color: fg,
      }}
    >
      {label}
    </span>
  );
}

interface ProviderDraft {
  displayName: string;
  buttonLabel: string;
  iconUrl: string;
  clientId: string;
  clientSecret: string | null;
  redirectUri: string;
  scope: string;
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  sortOrder: string;
  extraJson: string;
}

function toDraft(p: AdminProviderVO): ProviderDraft {
  return {
    displayName: p.displayName ?? '',
    buttonLabel: p.buttonLabel ?? '',
    iconUrl: p.iconUrl ?? '',
    clientId: p.clientId ?? '',
    clientSecret: null,
    redirectUri: p.redirectUri ?? '',
    scope: p.scope ?? '',
    authorizeUrl: p.authorizeUrl ?? '',
    tokenUrl: p.tokenUrl ?? '',
    userinfoUrl: p.userinfoUrl ?? '',
    sortOrder: String(p.sortOrder ?? 0),
    extraJson: p.extraJson ?? '',
  };
}

interface ConfigureDialogProps {
  provider: AdminProviderVO;
  enableOnSave: boolean;
  onClose: () => void;
}

function ConfigureDialog({ provider, enableOnSave, onClose }: ConfigureDialogProps) {
  const updateMutation = useUpdateAdminOAuthProvider();
  const [draft, setDraft] = useState<ProviderDraft>(() => toDraft(provider));
  const [secretCleared, setSecretCleared] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function set<K extends keyof ProviderDraft>(k: K, v: ProviderDraft[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  function buildReq(): UpdateProviderReq {
    const req: UpdateProviderReq = {
      displayName: draft.displayName || undefined,
      buttonLabel: draft.buttonLabel || undefined,
      iconUrl: draft.iconUrl || undefined,
      clientId: draft.clientId || undefined,
      redirectUri: draft.redirectUri || undefined,
      scope: draft.scope,
      authorizeUrl: draft.authorizeUrl || undefined,
      tokenUrl: draft.tokenUrl || undefined,
      userinfoUrl: draft.userinfoUrl || undefined,
      sortOrder: draft.sortOrder ? Number(draft.sortOrder) : undefined,
      extraJson: draft.extraJson || null,
    };
    if (secretCleared) {
      req.clientSecret = '';
    } else if (draft.clientSecret && draft.clientSecret.length > 0) {
      req.clientSecret = draft.clientSecret;
    }
    if (enableOnSave) {
      req.enabled = true;
    }
    return req;
  }

  function handleSave() {
    if (enableOnSave) {
      const willHaveClientId = draft.clientId.trim().length > 0;
      const willHaveSecret =
        (provider.clientSecretSet && !secretCleared) ||
        Boolean(draft.clientSecret && draft.clientSecret.length > 0);
      if (!willHaveClientId || !willHaveSecret) {
        toast({
          kind: 'error',
          message: '启用前请填写 Client ID 与 Client Secret',
        });
        return;
      }
    }

    updateMutation.mutate(
      { code: provider.code, body: buildReq() },
      {
        onSuccess: () => {
          toast({
            kind: 'success',
            message: enableOnSave
              ? `${provider.displayName} 已启用并保存`
              : `${provider.displayName} 配置已保存`,
          });
          onClose();
        },
        onError: (err) =>
          toast({
            kind: 'error',
            message: err instanceof Error ? `保存失败：${err.message}` : '保存失败',
          }),
      },
    );
  }

  const secretPlaceholder = provider.clientSecretSet && !secretCleared
    ? '已设置（留空表示不变）'
    : '输入新的 Client Secret';

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,.45)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(620px, 100%)',
          maxHeight: 'calc(100vh - 32px)',
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(15,23,42,.18)',
          border: `1px solid ${TOKENS.borderSoft}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '18px 24px',
            borderBottom: `1px solid ${TOKENS.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {provider.iconUrl ? (
            <img
              src={provider.iconUrl}
              alt=""
              style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4 }}
            />
          ) : (
            <I.globe size={22} style={{ color: TOKENS.text2 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 600, color: TOKENS.text }}>
              配置 {provider.displayName}
              {enableOnSave && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    marginLeft: 8,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: TOKENS.warningSoft,
                    color: TOKENS.warning,
                  }}
                >
                  首次启用
                </span>
              )}
            </h2>
            <div style={{ fontSize: 11.5, color: TOKENS.text3, marginTop: 2 }}>{provider.code}</div>
          </div>
          <Button variant="ghost"
            type="button"
            aria-label="关闭"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: TOKENS.text3,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <I.x size={18} />
          </Button>
        </div>

        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'grid',
            gap: 12,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormField label="显示名称">
              <Input
                value={draft.displayName}
                onChange={(e) => set('displayName', e.target.value)}
                placeholder={provider.displayName}
                maxLength={64}
              />
            </FormField>
            <FormField label="登录按钮文案" hint="空时使用显示名称">
              <Input
                value={draft.buttonLabel}
                onChange={(e) => set('buttonLabel', e.target.value)}
                placeholder={provider.displayName}
                maxLength={64}
              />
            </FormField>
          </div>

          <FormField label="Client ID">
            <Input
              value={draft.clientId}
              onChange={(e) => set('clientId', e.target.value)}
              placeholder="OAuth App 的 client_id"
            />
          </FormField>

          <FormField label="Client Secret">
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <Input
                  type="password"
                  value={draft.clientSecret ?? ''}
                  onChange={(e) => {
                    set('clientSecret', e.target.value || null);
                    if (secretCleared) setSecretCleared(false);
                  }}
                  placeholder={secretPlaceholder}
                  disabled={secretCleared}
                />
              </div>
              {(provider.clientSecretSet || secretCleared) && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (secretCleared) {
                      setSecretCleared(false);
                      set('clientSecret', null);
                    } else {
                      setSecretCleared(true);
                      set('clientSecret', null);
                    }
                  }}
                >
                  {secretCleared ? '撤销清空' : '清空 Secret'}
                </Button>
              )}
            </div>
            {secretCleared && (
              <div style={{ fontSize: 11.5, color: TOKENS.danger, marginTop: 4 }}>
                保存后将清除已设置的 Client Secret
              </div>
            )}
          </FormField>

          <FormField label="Redirect URI">
            <Input
              value={draft.redirectUri}
              onChange={(e) => set('redirectUri', e.target.value)}
              placeholder="https://yourapp.com/auth/oauth/{provider}/callback"
            />
          </FormField>

          <FormField label="Scope">
            <Input
              value={draft.scope}
              onChange={(e) => set('scope', e.target.value)}
              placeholder="read"
            />
          </FormField>

          <Button variant="ghost"
            type="button"
            onClick={() => setAdvancedOpen((o) => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 0',
              fontSize: 12.5,
              color: TOKENS.text2,
              fontFamily: 'inherit',
              fontWeight: 500,
            }}
          >
            <I.chev
              size={14}
              style={{
                color: TOKENS.text3,
                transform: advancedOpen ? 'rotate(180deg)' : 'rotate(-90deg)',
                transition: 'transform .15s',
              }}
            />
            高级设置
          </Button>

          {advancedOpen && (
            <div style={{ display: 'grid', gap: 12, paddingTop: 4 }}>
              <FormField label="图标 URL" hint="留空使用内置默认图标">
                <Input
                  value={draft.iconUrl}
                  onChange={(e) => set('iconUrl', e.target.value)}
                  placeholder="/auth/oauth/xxx.png 或 https://…"
                />
              </FormField>
              <FormField label="Authorize URL">
                <Input
                  value={draft.authorizeUrl}
                  onChange={(e) => set('authorizeUrl', e.target.value)}
                  placeholder="https://provider.example.com/oauth2/authorize"
                />
              </FormField>
              <FormField label="Token URL">
                <Input
                  value={draft.tokenUrl}
                  onChange={(e) => set('tokenUrl', e.target.value)}
                  placeholder="https://provider.example.com/oauth2/token"
                />
              </FormField>
              <FormField label="Userinfo URL">
                <Input
                  value={draft.userinfoUrl}
                  onChange={(e) => set('userinfoUrl', e.target.value)}
                  placeholder="https://provider.example.com/api/user"
                />
              </FormField>
              <FormField label="Sort Order">
                <Input
                  type="number"
                  value={draft.sortOrder}
                  onChange={(e) => set('sortOrder', e.target.value)}
                  placeholder="0"
                />
              </FormField>
              <FormField label="Extra JSON（预留）">
                <Textarea
                  value={draft.extraJson}
                  onChange={(e) => set('extraJson', e.target.value)}
                  placeholder="{}"
                  rows={3}
                />
              </FormField>
            </div>
          )}
        </div>

        <div
          style={{
            padding: '14px 24px',
            borderTop: `1px solid ${TOKENS.border}`,
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            取消
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleSave}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? '保存中…' : enableOnSave ? '保存并启用' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface SmsProviderDraft {
  displayName: string;
  providerType: 'HTTP' | 'LINGYANG_CHAOXIN';
  endpointUrl: string;
  method: string;
  headers: SmsHeaderDraft[];
  bodyTemplate: string;
  successStatus: string;
  successJsonPath: string;
  successExpectedValue: string;
  lingyang: LingyangDraft;
}

interface SmsHeaderDraft {
  name: string;
  value: string;
  secret: boolean;
  valueSet?: boolean;
}

interface LingyangDraft {
  appId: string;
  accessKey: string;
  accessSecret: string;
  accessSecretSet: boolean;
  signName: string;
  templateCode: string;
  templateParamKey: string;
  smsReport: string;
  timeout: string;
  maxRetry: string;
}

function toSmsDraft(p: AdminSmsProviderVO): SmsProviderDraft {
  const extra = parseJsonObject(p.extraJson);
  const secret = parseJsonObject(p.secretJson);
  return {
    displayName: p.displayName ?? '短信验证码',
    providerType: p.providerType ?? 'HTTP',
    endpointUrl: p.endpointUrl ?? '',
    method: p.method ?? 'POST',
    headers: parseHeaders(p.headersJson),
    bodyTemplate: p.bodyTemplate ?? '{\n  "phone": "${phone}",\n  "code": "${code}",\n  "purpose": "${purpose}",\n  "ttl": ${ttlSeconds}\n}',
    successStatus: String(p.successStatus ?? 200),
    successJsonPath: p.successJsonPath ?? '',
    successExpectedValue: p.successExpectedValue ?? '',
    lingyang: {
      appId: stringValue(extra.appId),
      accessKey: stringValue(extra.accessKey),
      accessSecret: stringValue(secret.accessSecret),
      accessSecretSet: Boolean(secret.accessSecretSet),
      signName: stringValue(extra.signName),
      templateCode: stringValue(extra.templateCode),
      templateParamKey: stringValue(extra.templateParamKey) || 'code',
      smsReport: stringValue(extra.smsReport),
      timeout: stringValue(extra.timeout),
      maxRetry: stringValue(extra.maxRetry),
    },
  };
}

interface SmsConfigureDialogProps {
  provider: AdminSmsProviderVO;
  enableOnSave: boolean;
  onClose: () => void;
}

function SmsConfigureDialog({ enableOnSave, onClose, provider }: SmsConfigureDialogProps) {
  const updateMutation = useUpdateAdminSmsProvider();
  const [draft, setDraft] = useState<SmsProviderDraft>(() => toSmsDraft(provider));
  const [accessSecretCleared, setAccessSecretCleared] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function set<K extends keyof SmsProviderDraft>(k: K, v: SmsProviderDraft[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  function setLingyang<K extends keyof LingyangDraft>(k: K, v: LingyangDraft[K]) {
    setDraft((d) => ({ ...d, lingyang: { ...d.lingyang, [k]: v } }));
  }

  function updateHeader(index: number, patch: Partial<SmsHeaderDraft>) {
    setDraft((d) => ({
      ...d,
      headers: d.headers.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  function addHeader() {
    setDraft((d) => ({ ...d, headers: [...d.headers, { name: '', value: '', secret: false }] }));
  }

  function removeHeader(index: number) {
    setDraft((d) => ({ ...d, headers: d.headers.filter((_item, i) => i !== index) }));
  }

  function validateJson(name: string, value: string) {
    if (!value.trim()) return true;
    try {
      JSON.parse(value);
      return true;
    } catch {
      toast({ kind: 'error', message: `${name} 不是合法 JSON` });
      return false;
    }
  }

  function validateBodyTemplate() {
    const sample = draft.bodyTemplate
      .split('${phone}').join('13900001111')
      .split('${code}').join('123456')
      .split('${purpose}').join('login')
      .split('${ttlSeconds}').join('300');
    return validateJson('请求体模板', sample);
  }

  function buildReq(): UpdateSmsProviderReq {
    const req: UpdateSmsProviderReq = {
      displayName: draft.displayName || undefined,
      providerType: draft.providerType,
      endpointUrl: draft.endpointUrl || undefined,
      method: draft.method || 'POST',
      headersJson: draft.providerType === 'HTTP' ? JSON.stringify(draft.headers) : null,
      bodyTemplate: draft.providerType === 'HTTP' ? draft.bodyTemplate || undefined : undefined,
      successStatus: draft.successStatus ? Number(draft.successStatus) : 200,
      successJsonPath: draft.successJsonPath || null,
      successExpectedValue: draft.successExpectedValue || null,
      extraJson: draft.providerType === 'LINGYANG_CHAOXIN' ? buildLingyangExtraJson(draft.lingyang) : null,
    };
    const secretJson = buildLingyangSecretJson(draft.lingyang, accessSecretCleared);
    if (draft.providerType === 'LINGYANG_CHAOXIN' && secretJson !== undefined) {
      req.secretJson = secretJson;
    }
    if (enableOnSave) req.enabled = true;
    return req;
  }

  function handleSave() {
    if (draft.providerType === 'HTTP' && !validateBodyTemplate()) return;
    if (enableOnSave && !isDraftConfigured(draft, accessSecretCleared)) {
      toast({ kind: 'error', message: '启用前请补全短信供应商配置' });
      return;
    }
    updateMutation.mutate(buildReq(), {
      onSuccess: () => {
        toast({
          kind: 'success',
          message: enableOnSave ? '短信验证码已启用并保存' : '短信验证码配置已保存',
        });
        onClose();
      },
      onError: (err) =>
        toast({
          kind: 'error',
          message: err instanceof Error ? `保存失败：${err.message}` : '保存失败',
        }),
    });
  }

  const providerLabel = draft.providerType === 'LINGYANG_CHAOXIN' ? '瓴羊超信' : 'HTTP 自定义供应商';

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,.45)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(760px, 100%)',
          maxHeight: 'calc(100vh - 32px)',
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 24px 60px rgba(15,23,42,.18)',
          border: `1px solid ${TOKENS.borderSoft}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '18px 24px',
            borderBottom: `1px solid ${TOKENS.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <I.phone size={22} style={{ color: TOKENS.primary }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 15.5, fontWeight: 600, color: TOKENS.text }}>
              配置短信验证码
              {enableOnSave && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    marginLeft: 8,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: TOKENS.warningSoft,
                    color: TOKENS.warning,
                  }}
                >
                  首次启用
                </span>
              )}
            </h2>
            <div style={{ fontSize: 11.5, color: TOKENS.text3, marginTop: 2 }}>{providerLabel}</div>
          </div>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: TOKENS.text3,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <I.x size={18} />
          </button>
        </div>

        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'grid',
            gap: 12,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 12 }}>
            <FormField label="显示名称">
              <Input
                value={draft.displayName}
                onChange={(e) => set('displayName', e.target.value)}
                maxLength={64}
              />
            </FormField>
            <FormField label="供应商">
              <Select
                value={draft.providerType}
                onValueChange={(value) => set('providerType', value as SmsProviderDraft['providerType'])}
                options={[
                  { value: 'HTTP', label: 'HTTP 自定义' },
                  { value: 'LINGYANG_CHAOXIN', label: '瓴羊超信' },
                ]}
              />
            </FormField>
          </div>

          <FormField label="请求地址">
            <Input
              value={draft.endpointUrl}
              onChange={(e) => set('endpointUrl', e.target.value)}
              placeholder={draft.providerType === 'LINGYANG_CHAOXIN' ? 'https://openapi.example.com' : 'https://sms-provider.example.com/send'}
            />
          </FormField>

          {draft.providerType === 'HTTP' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
                <FormField label="Method">
                  <Input
                    value={draft.method}
                    onChange={(e) => set('method', e.target.value.toUpperCase())}
                    placeholder="POST"
                  />
                </FormField>
                <FormField label="成功状态码">
                  <Input
                    type="number"
                    value={draft.successStatus}
                    onChange={(e) => set('successStatus', e.target.value)}
                    placeholder="200"
                  />
                </FormField>
              </div>

              <FormField label="Header 参数">
                <div style={{ display: 'grid', gap: 8 }}>
                  {draft.headers.map((header, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1.2fr 128px 36px',
                        gap: 8,
                        alignItems: 'center',
                      }}
                    >
                      <Input
                        value={header.name}
                        onChange={(e) => updateHeader(index, { name: e.target.value })}
                        placeholder="Header 名称"
                      />
                      <Input
                        value={header.value}
                        onChange={(e) => updateHeader(index, { value: e.target.value })}
                        placeholder={header.secret && header.valueSet ? '已设置（留空不变）' : 'Header 值'}
                      />
                      <Select
                        value={header.secret ? 'SECRET' : 'NORMAL'}
                        onValueChange={(value) => updateHeader(index, { secret: value === 'SECRET' })}
                        options={[
                          { value: 'NORMAL', label: '普通请求头' },
                          { value: 'SECRET', label: '敏感请求头' },
                        ]}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="删除 Header"
                        onClick={() => removeHeader(index)}
                        icon={<I.trash size={15} />}
                        style={{ width: 34, padding: 0 }}
                      />
                    </div>
                  ))}
                  <div>
                    <Button type="button" variant="secondary" size="sm" onClick={addHeader} icon={<I.plus size={14} />}>
                      增加 Header
                    </Button>
                  </div>
                </div>
              </FormField>

              <FormField label="请求体模板" hint="支持 ${phone} / ${code} / ${purpose} / ${ttlSeconds}">
                <Textarea
                  value={draft.bodyTemplate}
                  onChange={(e) => set('bodyTemplate', e.target.value)}
                  rows={7}
                />
              </FormField>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="成功 JSON 路径" hint="可空">
                  <Input
                    value={draft.successJsonPath}
                    onChange={(e) => set('successJsonPath', e.target.value)}
                    placeholder="data.success"
                  />
                </FormField>
                <FormField label="期望值" hint="可空">
                  <Input
                    value={draft.successExpectedValue}
                    onChange={(e) => set('successExpectedValue', e.target.value)}
                    placeholder="true"
                  />
                </FormField>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="AppId">
                  <Input value={draft.lingyang.appId} onChange={(e) => setLingyang('appId', e.target.value)} />
                </FormField>
                <FormField label="AccessKey">
                  <Input value={draft.lingyang.accessKey} onChange={(e) => setLingyang('accessKey', e.target.value)} />
                </FormField>
              </div>

              <FormField label="AccessSecret" hint="保存后不回显，留空表示不变">
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input
                    value={draft.lingyang.accessSecret}
                    disabled={accessSecretCleared}
                    onChange={(e) => {
                      setLingyang('accessSecret', e.target.value);
                      if (accessSecretCleared) setAccessSecretCleared(false);
                    }}
                    placeholder={draft.lingyang.accessSecretSet && !accessSecretCleared ? '已设置（留空不变）' : 'AccessSecret'}
                  />
                  {(draft.lingyang.accessSecretSet || accessSecretCleared) && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        if (accessSecretCleared) {
                          setAccessSecretCleared(false);
                          setLingyang('accessSecret', '');
                        } else {
                          setAccessSecretCleared(true);
                          setLingyang('accessSecret', '');
                        }
                      }}
                    >
                      {accessSecretCleared ? '撤销清空' : '清空'}
                    </Button>
                  )}
                </div>
              </FormField>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="短信签名">
                  <Input value={draft.lingyang.signName} onChange={(e) => setLingyang('signName', e.target.value)} />
                </FormField>
                <FormField label="模板编码">
                  <Input value={draft.lingyang.templateCode} onChange={(e) => setLingyang('templateCode', e.target.value)} />
                </FormField>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <FormField label="验证码变量名">
                  <Input
                    value={draft.lingyang.templateParamKey}
                    onChange={(e) => setLingyang('templateParamKey', e.target.value)}
                    placeholder="code"
                  />
                </FormField>
                <FormField label="超时时间" hint="毫秒，可空">
                  <Input
                    type="number"
                    value={draft.lingyang.timeout}
                    onChange={(e) => setLingyang('timeout', e.target.value)}
                  />
                </FormField>
                <FormField label="重试次数" hint="可空">
                  <Input
                    type="number"
                    value={draft.lingyang.maxRetry}
                    onChange={(e) => setLingyang('maxRetry', e.target.value)}
                  />
                </FormField>
              </div>

              <FormField label="回执地址" hint="可空">
                <Input value={draft.lingyang.smsReport} onChange={(e) => setLingyang('smsReport', e.target.value)} />
              </FormField>
            </>
          )}
        </div>

        <div
          style={{
            padding: '14px 24px',
            borderTop: `1px solid ${TOKENS.border}`,
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            取消
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleSave}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? '保存中…' : enableOnSave ? '保存并启用' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

function ToggleSwitch({ checked, onChange, disabled }: ToggleSwitchProps) {
  return (
    <Button variant="ghost"
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        width: 40,
        height: 22,
        borderRadius: 11,
        border: 'none',
        background: checked ? TOKENS.primary : TOKENS.border,
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: 0,
        flexShrink: 0,
        transition: 'background .2s',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 21 : 3,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left .2s',
          boxShadow: '0 1px 3px rgba(0,0,0,.2)',
        }}
      />
    </Button>
  );
}

interface DisableConfirmDialogProps {
  providerName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DisableConfirmDialog({ providerName, onConfirm, onCancel }: DisableConfirmDialogProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,.45)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(420px, 100%)',
          background: '#fff',
          borderRadius: 14,
          padding: '24px 24px 20px',
          boxShadow: '0 24px 60px rgba(15,23,42,.18)',
          border: `1px solid ${TOKENS.borderSoft}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: TOKENS.dangerSoft,
              color: TOKENS.danger,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <I.lock size={18} stroke={2.2} />
          </div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: TOKENS.text }}>
            关闭 {providerName} 登录？
          </h2>
        </div>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: TOKENS.text2 }}>
          关闭后，新用户将无法通过 {providerName} 登录。已登录用户不受影响，但再次登录时将不可用。
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <Button type="button" variant="secondary" size="md" onClick={onCancel}>
            取消
          </Button>
          <div style={{ flex: 1 }} />
          <Button type="button" variant="primary" size="md" onClick={onConfirm}
            style={{ background: TOKENS.danger, borderColor: TOKENS.danger }}
          >
            确认关闭
          </Button>
        </div>
      </div>
    </div>
  );
}
