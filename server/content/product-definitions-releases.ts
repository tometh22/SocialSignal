/**
 * Append-only release ledger for the Admin product definitions.
 *
 * A rule edit must create a new semantic version instead of silently replacing
 * the hash associated with a published version.
 */
export const PRODUCT_DEFINITIONS_RELEASES = {
  "2.9.0": "9716406168202b05bc57c069ef2773695bec9c62699c42b8649e940541a246c7",
  "2.9.1": "d882c6aaca55ff19fd2d8c3f5ebae77279dbd0c59249ddc2da66fb234fcfa8b8",
  "2.9.2": "4194347d8992e229c2f80f91f806db0b33de72db0e715086bade84725fdfe3e0",
  "2.9.3": "dd6a5896ad17dfc075c8baece21523253e22dc1f94a7fee4ebe9ad1e2d1007a8",
} as const;
