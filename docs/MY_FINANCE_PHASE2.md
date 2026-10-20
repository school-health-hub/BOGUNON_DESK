# MY FINANCE Phase 2

Phase 2 extends the local encrypted MY FINANCE dataset with tax reference, investment, and net-worth views. It does not add household budgeting, cloud sync, brokerage APIs, automated tax filing, or plaintext export.

## Security boundary

- All records remain in the existing SQLCipher database; its key remains protected by Windows DPAPI.
- The only file export is the existing AES-256-GCM `.bgfnbk` encrypted backup.
- Tax preparation information is view-only inside the app. CSV, spreadsheet, clipboard, telemetry, and network export are intentionally absent.
- Every Phase 2 write uses the existing full snapshot identity as a compare-and-swap token and is rejected on stale state.

## Data model

- Tax reference is derived from Phase 1 income classifications and its income/local-income-tax deductions. Dividend withholding is added once from dividend records; Phase 1 income is never copied into a second tax table.
- Investment accounts own stocks or ETFs. Buy/sell records retain quantity, transaction price, fees, taxes, transaction currency, and the applied exchange rate. Current valuation retains its own price, rate, and valuation date.
- Average cost and realized profit are calculated from completed trades. Unrealized profit is calculated from remaining cost basis and the manually entered current valuation. Live prices are not fetched.
- Cash, deposits, and savings are manual dated balances. Brokerage value is derived only from investment positions and cannot be entered as a second manual asset category. Net worth therefore adds each amount once.
- Liabilities are manual dated balances. When several observations exist for the same label, kind, and currency, the latest observation at or before the selected date is used.

## Phase 1 compatibility

The portable snapshot schema version remains `2`. Phase 2 is an additive field with a serde default. A Phase 1 database or encrypted backup that has no `phase2` property is decoded with empty Phase 2 collections while preserving its dataset ID, revision history, and every income record. The migration is in-memory and the live database is changed only by a later confirmed transaction. Failed decode or validation leaves the original encrypted database and backup untouched.

Backups created after Phase 2 include all Phase 2 collections in the same authenticated encrypted envelope. Restoring into an older Phase 1 binary is not supported because that binary intentionally rejects unknown fields; restore into Phase 2 remains compatible with both Phase 1 and Phase 2 backups.

## Installed Windows manual QA

On 2026-10-21, the SHA-pinned synthetic TESTABLE produced by workflow run `39461701234` attempt `1` was exercised in a normal Windows user session on a school PC. The tested application source was `d6f546abb949e2a9d7e85263e1c7aa9a8689c240`; the installer SHA-256 was `62310fe205fc4fd6bfbd32da21405f35c1eaabe740f0952782dc989a4070abbc`.

The following results are user-performed installed-build QA, not automated CI evidence:

- Updating the existing Phase 1 QA installation preserved the synthetic `QA-37I` income record of KRW 123,456.
- Registering a brokerage account and instrument, buying 10 shares, and selling 4 shares produced an average acquisition price of KRW 50,050, a remaining quantity of 6, realized profit of KRW 39,200, and unrealized profit of KRW 29,700.
- Closing and reopening the application preserved the Phase 2 records.
- A KRW 3,000 dividend with KRW 462 withholding produced yearly tax-reference totals of KRW 126,456 income and KRW 125,994 net income.
- KRW 3,700,000 cash assets, KRW 330,000 brokerage valuation, and KRW 800,000 liabilities produced KRW 3,230,000 net worth without brokerage double counting.
- Encrypted backup creation succeeded. An incorrect password was rejected, while the correct password passed backup decryption and validity inspection.

Actual restore confirmation, physical transfer and restore between the school and home PCs, and validation of a combined v1.0 installer were not performed. They must not be reported as passed. Existing automated CI results remain separate from this manual QA record.
