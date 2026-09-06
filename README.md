# SnapSort

Private screenshot recall, running in your browser.

## Run

Use Node.js 20 or newer and pnpm 11.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed in the terminal. Import PNG, JPEG, or WebP screenshots. The first use needs internet access to download OCR and semantic model assets.

## Features

- Tesseract.js OCR in a browser worker.
- Local semantic search with Transformers.js and the quantized Xenova/all-MiniLM-L6-v2 model.
- Overlapping text chunks, normalized embeddings, cosine similarity ranking, and exact-text matches promoted first.
- Images, OCR text, and embeddings stored in browser IndexedDB. No login or application backend.
- Text search remains available if semantic setup fails.

## Demo

Import a repair receipt, flight itinerary, and programming notes. Compare Text search with Semantic search using “bike repair bill”, “my plane ticket”, and “beginner coding notes”. Exact phrases do not have to appear in the screenshot for semantic matching.

## Privacy and limits

Images and search phrases are processed locally. Public OCR/model assets download from third-party hosts; those hosts receive normal asset requests, not screenshot contents or queries. Model assets may be cached by the browser. Full offline reload and fresh OCR are not yet verified; this prototype does not include an offline app-shell service worker. Browser storage can be cleared or evicted and is not separately encrypted by this app.

Semantic matching uses extracted text, not a vision model: it cannot interpret unlabeled chart geometry, arrows, or relationships. Similarity results are suggestions, not guaranteed answers. The 0.22 retrieval threshold is a prototype setting and has not been calibrated on a large benchmark. This is a browser prototype, not a native mobile app or background camera-roll scanner.

## Checks

```sh
pnpm typecheck
pnpm build
```

Model: https://huggingface.co/Xenova/all-MiniLM-L6-v2
