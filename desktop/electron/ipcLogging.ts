const noisySuccessfulOperations = new Set([
  'api:request',
  'config:get',
  'local-installs:list',
  'window:mode',
  'log:event',
]);

export function shouldLogDesktopOperationSuccess(operationName: string): boolean {
  return !noisySuccessfulOperations.has(operationName);
}
