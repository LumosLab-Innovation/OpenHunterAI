export function dnsTxtContainsToken(records: string[][], expectedToken: string): boolean {
  return records.some((chunks) => chunks.join('') === expectedToken);
}

export function verificationRecordName(hostname: string): string {
  const prefix = process.env.VERIFICATION_TXT_RECORD_NAME || '_xhunter-verification';
  return `${prefix}.${hostname}`;
}
