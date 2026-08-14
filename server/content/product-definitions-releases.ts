/**
 * Append-only release ledger for the Admin product definitions.
 *
 * A rule edit must create a new semantic version instead of silently replacing
 * the hash associated with a published version.
 */
export const PRODUCT_DEFINITIONS_RELEASES = {
  "2.9.0": "9716406168202b05bc57c069ef2773695bec9c62699c42b8649e940541a246c7",
  "2.9.1": "d882c6aaca55ff19fd2d8c3f5ebae77279dbd0c59249ddc2da66fb234fcfa8b8",
} as const;
