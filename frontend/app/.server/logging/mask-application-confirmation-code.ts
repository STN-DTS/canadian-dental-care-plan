export function maskApplicationConfirmationCode(code: string): string {
  return code.replace(/\d(?=(?:\D*\d){0,3}\D*$)/g, '*');
}
