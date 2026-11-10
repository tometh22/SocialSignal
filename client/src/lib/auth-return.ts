/** Fixed server destinations only: never accept an arbitrary login redirect. */
export function getAuthReturnPath(search: string): string | null {
  const value = new URLSearchParams(search).get("returnTo");
  return value === "/mcp/consent" || value === "/mcp/connections"
    || /^\/mcp\/status-changes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value ?? "") ? value : null;
}
