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

## Categories and suggested actions

The desktop library and sidebar use a 3:1 split. The sidebar uses a 7:3 split for categories and suggested actions, with independent scrolling. On smaller screens the panels stack below the library.

Categories are detected from OCR text using local rules: events, travel, receipts, study, health, credentials and other. A screenshot can match multiple categories. Category selection combines with the current search.

Event, appointment and deadline text can produce a calendar suggestion. Review the source screenshot, edit title/date/time/location, select timed or all-day, confirm details and approve to download an `.ics` file. Open that file in a calendar application to complete the import. No calendar account is connected and nothing is added automatically. Dismissed and exported actions are saved locally, with a history view and a Review again action.

These suggestions are rule-based, not generative AI. Ambiguous or missing dates require review. No full screenshot text is automatically copied into calendar notes. Clearing browser storage removes stored screenshots and action history.

## Demo

Import a repair receipt, flight itinerary, and programming notes. Compare Text search with Semantic search using “bike repair bill”, “my plane ticket”, and “beginner coding notes”. Exact phrases do not have to appear in the screenshot for semantic matching.

## Privacy and limits

Images and search phrases are processed locally. Public OCR/model assets download from third-party hosts; those hosts receive normal asset requests, not screenshot contents or queries. Model assets may be cached by the browser. Full offline reload and fresh OCR are not yet verified; this prototype does not include an offline app-shell service worker. Browser storage can be cleared or evicted and is not separately encrypted by this app.

Semantic matching uses extracted text, not a vision model: it cannot interpret unlabeled chart geometry, arrows, or relationships. Similarity results are suggestions, not guaranteed answers. The 0.22 retrieval threshold is a prototype setting and has not been calibrated on a large benchmark. This is a browser prototype, not a native mobile app or background camera-roll scanner.

## Checks

```sh
pnpm typecheck
pnpm build
node --experimental-strip-types --test tests/insights.test.mjs
```

The test command requires Node.js 22.6+ (Node 24 recommended).

Model: https://huggingface.co/Xenova/all-MiniLM-L6-v2

## Experimental OCR comparison lab

Choose **OCR lab** in the header. Add up to 20 PNG/JPEG/WebP samples, label their type and enter the correct transcription. Compare the unprocessed originals; the lab reports setup, recognition and total time separately, plus character/word error rates. Normalization collapses whitespace and applies Unicode NFC while preserving case and punctuation. Error rates can exceed 100% for insertions. Very long text is not scored. Memory consumption is not measured. Reports contain source filenames and transcriptions, but no image bytes. Samples/results are temporary until exported; the main screenshot library is untouched.

The lab now compares Tesseract's standard Otsu thresholding with local Sauvola adaptive thresholding using the same English model. PaddleOCR has been removed. No extra installation or model is required beyond the existing Tesseract setup. Original files remain unchanged. This does not detect highlight meaning, interpret arrows, or guarantee handwriting/calligraphy recognition.

## Improve text recognition in the library

Open a ready screenshot and choose **Improve text recognition**. Adaptive Tesseract runs in a separate worker with cancellation and a three-minute timeout. Compare the current text with the adaptive result and choose **Use improved text** or **Keep current text**. Empty, identical or stale candidates cannot be applied. Accepted changes are saved before the UI updates; the previous transcription is retained in the screenshot record. The original image remains unchanged. Existing text-dependent search indexing, categories and calendar suggestions refresh from the accepted text. No automatic accuracy claim is made.

This update passed TypeScript, production build and the 19 existing automated tests. The newly added browser approval flow still needs a live UI check; those existing tests do not cover its IndexedDB transaction or buttons.
