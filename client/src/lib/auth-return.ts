/** Fixed server destinations only: never accept an arbitrary login redirect. */
export function getAuthReturnPath(search: string): string | null {
  const value = new URLSearchParams(search).get("returnTo");
  return value === "/mcp/consent" || value === "/mcp/connections" ? value : null;
}
