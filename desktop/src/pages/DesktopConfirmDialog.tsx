import { ConfirmDialog, type ConfirmDialogProps } from '@skillstack/ui';

export type DesktopConfirmDialogProps = ConfirmDialogProps;

export function DesktopConfirmDialog(props: DesktopConfirmDialogProps) {
  return <ConfirmDialog {...props} />;
}
