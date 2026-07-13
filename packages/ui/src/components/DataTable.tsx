import type {
  CSSProperties,
  HTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react';
import { TOKENS } from '../tokens';

export interface DataTableProps extends TableHTMLAttributes<HTMLTableElement> {
  children: ReactNode;
  containerStyle?: CSSProperties;
  wrapperStyle?: CSSProperties;
}

export function DataTable({
  children,
  style,
  containerStyle,
  wrapperStyle,
  ...props
}: DataTableProps) {
  return (
    <div style={{ overflowX: 'auto', ...wrapperStyle, ...containerStyle }}>
      <table
        {...props}
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13,
          ...style,
        }}
      >
        {children}
      </table>
    </div>
  );
}

export function DataTableHead({ children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props}>{children}</thead>;
}

export function DataTableBody({ children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props}>{children}</tbody>;
}

export function DataTableRow({ children, style, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      {...props}
      style={{
        borderTop: `1px solid ${TOKENS.borderSoft}`,
        ...style,
      }}
    >
      {children}
    </tr>
  );
}

export interface DataTableHeaderProps extends ThHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right';
}

export function DataTableHeader({
  children,
  align = 'left',
  style,
  ...props
}: DataTableHeaderProps) {
  return (
    <th
      {...props}
      style={{
        textAlign: align,
        fontWeight: 500,
        fontSize: 12,
        color: TOKENS.text3,
        padding: '8px 10px',
        borderBottom: `1px solid ${TOKENS.border}`,
        ...style,
      }}
    >
      {children}
    </th>
  );
}

export interface DataTableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right';
  empty?: boolean;
}

export function DataTableCell({
  children,
  align,
  empty,
  style,
  ...props
}: DataTableCellProps) {
  return (
    <td
      {...props}
      style={{
        padding: empty ? '24px 10px' : '12px 10px',
        verticalAlign: 'middle',
        textAlign: empty ? 'center' : align,
        color: empty ? TOKENS.text3 : undefined,
        fontSize: empty ? 12.5 : undefined,
        ...style,
      }}
    >
      {children}
    </td>
  );
}

export function DataTableEmpty({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <DataTableRow>
      <DataTableCell
        colSpan={colSpan}
        style={{
          padding: '24px 10px',
          color: TOKENS.text3,
          textAlign: 'center',
          fontSize: 12.5,
        }}
      >
        {children}
      </DataTableCell>
    </DataTableRow>
  );
}
