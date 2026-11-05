/** Stdout carries the MCP protocol, so logs go to stderr. Log metadata only, never mail content. */
export function logInfo(message: string): void {
  process.stderr.write(`[tecnico-mail-mcp] ${message}\n`);
}
