export function isMissingSchemaError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };
  const message = maybeError.message?.toLowerCase() ?? '';

  return maybeError.code === '42P01'
    || maybeError.code === '42703'
    || maybeError.code === 'PGRST204'
    || maybeError.code === 'PGRST205'
    || message.includes('could not find')
    || message.includes('does not exist');
}
