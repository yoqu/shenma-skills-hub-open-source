import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { TOKENS } from '../tokens';
import {
  Badge,
  type BadgeTone,
} from './Badge';
import { I } from '../icons';

export interface TagsInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** 已存在时拒绝二次添加。 */
  unique?: boolean;
  /** 标签上限,达上限后输入框 disable。 */
  maxTags?: number;
  /** 单个标签长度上限。 */
  maxTagLength?: number;
  /** 输入框占位文案。 */
  placeholder?: string;
  /**
   * 添加前做正规化(默认 trim + toLowerCase)。返回空字符串视作丢弃。
   */
  normalize?: (raw: string) => string;
  /**
   * 标签合法性校验,返回错误描述则拒绝并把消息传给 onError。
   * 在 normalize 之后调用。
   */
  validate?: (tag: string) => string | null;
  /** 把内部产生的瞬时错误暴露给父组件渲染。 */
  onError?: (msg: string | null) => void;
  /** 错误态会把外框染红。 */
  state?: 'default' | 'error';
  disabled?: boolean;
  /** 标签视觉色调,默认 primary。 */
  tone?: BadgeTone;
  /** 整体根节点附加样式。 */
  style?: CSSProperties;
  className?: string;
  /** 触发添加的字符,默认 Enter / Tab / 逗号 / 空格。 */
  delimiterKeys?: ReadonlyArray<string>;
  /**
   * 粘贴时按这些分隔符切分批量加入,默认 `[',', '\n', '\t']`。
   * 不在此列表的字符会保留(如空格,标签内允许)。
   */
  pasteSeparators?: ReadonlyArray<string>;
  /** ARIA 标签,留空时不渲染。 */
  ariaLabel?: string;
}

export interface TagsInputHandle {
  focus: () => void;
}

const DEFAULT_NORMALIZE = (raw: string) => raw.trim().toLowerCase();
const DEFAULT_DELIMITERS: readonly string[] = ['Enter', 'Tab', ',', ' '];
const DEFAULT_PASTE_SEPARATORS: readonly string[] = [',', '\n', '\t'];

export const TagsInput = forwardRef<TagsInputHandle, TagsInputProps>(function TagsInput(
  {
    value,
    onChange,
    unique = true,
    maxTags,
    maxTagLength,
    placeholder,
    normalize = DEFAULT_NORMALIZE,
    validate,
    onError,
    state = 'default',
    disabled = false,
    tone = 'primary',
    style,
    className,
    delimiterKeys = DEFAULT_DELIMITERS,
    pasteSeparators = DEFAULT_PASTE_SEPARATORS,
    ariaLabel,
  },
  ref,
) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => inputRef.current?.focus(),
    }),
    [],
  );

  const atLimit = typeof maxTags === 'number' && value.length >= maxTags;
  const errored = state === 'error';

  const reportError = useCallback(
    (msg: string | null) => {
      if (onError) onError(msg);
    },
    [onError],
  );

  const addOne = useCallback(
    (raw: string): boolean => {
      const t = normalize(raw);
      if (!t) return false;
      if (typeof maxTagLength === 'number' && t.length > maxTagLength) {
        reportError(`单个标签不超过 ${maxTagLength} 字符`);
        return false;
      }
      if (unique && value.includes(t)) {
        reportError('标签已存在');
        return false;
      }
      if (typeof maxTags === 'number' && value.length >= maxTags) {
        reportError(`最多 ${maxTags} 个标签`);
        return false;
      }
      const err = validate ? validate(t) : null;
      if (err) {
        reportError(err);
        return false;
      }
      onChange([...value, t]);
      reportError(null);
      return true;
    },
    [normalize, maxTagLength, unique, value, maxTags, validate, reportError, onChange],
  );

  const addMany = useCallback(
    (parts: string[]) => {
      let next = value.slice();
      const errs: string[] = [];
      for (const raw of parts) {
        const t = normalize(raw);
        if (!t) continue;
        if (typeof maxTagLength === 'number' && t.length > maxTagLength) {
          errs.push(`「${raw}」超过 ${maxTagLength} 字符`);
          continue;
        }
        if (unique && next.includes(t)) continue;
        if (typeof maxTags === 'number' && next.length >= maxTags) {
          errs.push(`最多 ${maxTags} 个标签`);
          break;
        }
        const err = validate ? validate(t) : null;
        if (err) {
          errs.push(err);
          continue;
        }
        next.push(t);
      }
      if (next.length !== value.length) onChange(next);
      reportError(errs[0] ?? null);
    },
    [value, normalize, maxTagLength, unique, maxTags, validate, onChange, reportError],
  );

  const removeAt = useCallback(
    (i: number) => {
      if (disabled) return;
      const next = value.slice();
      next.splice(i, 1);
      onChange(next);
      reportError(null);
    },
    [disabled, value, onChange, reportError],
  );

  const splitOnPaste = useMemo(() => {
    if (pasteSeparators.length === 0) return null;
    const escaped = pasteSeparators
      .map((s) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'))
      .join('|');
    return new RegExp(escaped);
  }, [pasteSeparators]);

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (delimiterKeys.includes(e.key)) {
      // 空格 / 回车 / Tab / 逗号 都触发提交,但要避免空文本时吞掉默认 Tab 焦点切换
      const raw = text;
      if (!raw.trim()) {
        if (e.key === 'Enter' || e.key === ',') e.preventDefault();
        return;
      }
      e.preventDefault();
      if (addOne(raw)) setText('');
      return;
    }
    if (e.key === 'Backspace' && !text && value.length > 0) {
      e.preventDefault();
      removeAt(value.length - 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    if (disabled || !splitOnPaste) return;
    const raw = e.clipboardData.getData('text');
    if (!raw) return;
    if (!splitOnPaste.test(raw)) return; // 单条粘贴交给原生
    e.preventDefault();
    addMany(raw.split(splitOnPaste));
    setText('');
  };

  const borderColor = errored
    ? TOKENS.danger
    : focused
    ? TOKENS.primary
    : TOKENS.border;
  const ring = focused && !errored ? `0 0 0 3px ${TOKENS.primary}1a` : 'none';

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={className}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        padding: 6,
        minHeight: 40,
        alignItems: 'center',
        background: disabled ? TOKENS.bgGray : '#fff',
        border: `1px solid ${borderColor}`,
        borderRadius: 8,
        cursor: disabled ? 'not-allowed' : 'text',
        transition: 'border-color .15s, box-shadow .15s',
        boxShadow: ring,
        ...style,
      }}
      aria-label={ariaLabel}
    >
      {value.map((t, i) => (
        <Badge
          key={`${t}-${i}`}
          tone={tone}
          size="sm"
          style={{
            paddingRight: 4,
            gap: 2,
          }}
        >
          <span style={{ paddingRight: 2 }}>{t}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeAt(i);
            }}
            disabled={disabled}
            aria-label={`移除 ${t}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 16,
              height: 16,
              borderRadius: 999,
              background: 'transparent',
              border: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              color: 'inherit',
              opacity: 0.7,
              padding: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}
          >
            <I.x size={10} stroke={2.5} />
          </button>
        </Badge>
      ))}
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKey}
        onPaste={handlePaste}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          // 失焦时若有残留草稿,做一次温和的提交,避免用户漏写
          if (text.trim()) {
            if (addOne(text)) setText('');
          }
        }}
        disabled={disabled || atLimit}
        placeholder={atLimit ? `已达 ${maxTags} 个上限` : placeholder}
        style={{
          flex: 1,
          minWidth: 120,
          border: 0,
          outline: 'none',
          padding: '4px 4px',
          fontSize: 13,
          background: 'transparent',
          color: TOKENS.text,
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
});
