# Apple Uniformm — Purchase UI

Electron + React desktop app for purchase / stock / production flow.

## Run (browser)

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Run (Electron)

```bash
npm run electron:dev
```

## Windows 7 installer

See [WINDOWS_SETUP_GUIDE.md](./WINDOWS_SETUP_GUIDE.md).

```bash
npm run dist:win7
```

Uses **Electron 22.3.27** (last version that supports Windows 7).

## Opening stock CSVs

When Apple Uniformm provides opening stock (~10 days), drop rows into:

- `seed-templates/fabric_stock.csv`
- `seed-templates/accessory_stock.csv`

Then seed via the purchase backend stock APIs / Stock page.

## Brand assets

- `src/assets/apple-uniformm-logo.png` — full wordmark (header)
- `src/assets/apple-uniformm-logo-light.png` — apple mark (sidebar / browser tab)
- `public/favicon.png` — browser tab icon
