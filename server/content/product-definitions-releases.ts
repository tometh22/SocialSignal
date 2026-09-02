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
  "2.13.0": "322b4525717b17314cab9698a7721583bdb73c6a834338ac712217c047850f57",
  "2.13.1": "30604e8098c0169cd42c2647a6d36354131086fed01d8f8d5082cdd78c82a1c5",
  "2.14.0": "9eab28174c43b378662acc9fe6011b43fc3d866ccd870c6308a03d6226f8330a",
  "2.15.0": "8ea90cedf10c74260643ce01a97123520f7d05e6d0e8e4be8b03310655c24ed6",
  "2.16.0": "22070ff3e8090423d693e5dc116624fd8b19f2ca14c439bc02460ee765ac02b8",
  "2.17.0": "7fe4722f50027191ec6c2c75165977c98cbe01389bc0eea259ef938ed9ee564e",
  "2.18.0": "4f916a39bef34d16c3389ed841f9f6763d57e56c36d8942b3691a37ab20a1a03",
  "2.19.0": "8c1b8588b67d7b535a984a721d3aed310b1b85878b97e5c2dd53dc736e213764",
} as const;
