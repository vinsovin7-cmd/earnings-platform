# Urban Cinema Mini App

The root `/cinema` route is the primary app shell. `/miniapp/` remains a
standalone public-domain sample player with wallet connection UI; it is not a
production checkout, earnings ledger, or payout service.

Checkout buttons are disabled. The legacy `/api/mock-purchase` route returns
HTTP 410 and never reports payment success. Connecting a wallet does not make a
payment.

Production earnings require a server-verified Telegram identity, persistent
task ledger, independently verified viewing/task evidence, and a funded payout
service. These must not be replaced by browser-local balances or client
assertions.
