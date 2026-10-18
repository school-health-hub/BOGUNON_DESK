# Disconnected Surface renderer

Reuse the existing BOGUNON mint, navy and quiet neutral palette without importing Main styles or providers. A single responsive status card identifies Surface, shows unavailable data, and exposes exactly two disabled actions. No motion, external assets, navigation, data inputs, storage or IPC. System fonts, visible labels, semantic heading/status and native disabled controls support keyboard and screen-reader use.

The renderer has its own HTML, React root, CSS and Vite build directory. Its CSP denies connections and all external content. This static document does not establish a separate browser origin or WebView2 user data folder. The inactive Rust StorageContract remains the authority for a future adapter; this task creates neither adapter nor window.
