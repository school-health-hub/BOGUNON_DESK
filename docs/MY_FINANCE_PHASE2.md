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
