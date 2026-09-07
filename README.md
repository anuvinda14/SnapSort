# SnapSort

**Find what you remember.** A privacy-first screenshot library with browser-local OCR, semantic search and manual duplicate review.

Screenshots capture useful information but are difficult to retrieve later. SnapSort helps students and anyone saving receipts, tickets or reference material search their screenshots without sending image contents to an OCR service.

## Run locally or in Codespaces

Use Node.js 24 and pnpm. From the folder containing `package.json`:

```sh
pnpm install --frozen-lockfile
pnpm dev --host 0.0.0.0
```

Open the URL/forwarded port printed by Vite. The first use needs internet for OCR and search-model downloads. Import PNG, JPEG or WebP images; files are stored in that browser origin's IndexedDB. A different port or browser has a separate library.

## What works in the prototype

- **Text recognition:** English Tesseract.js OCR in browser workers, with progress and retry controls.
- **Search:** exact words/numbers or local semantic retrieval using Transformers.js and quantized `Xenova/all-MiniLM-L6-v2`. Search is based on OCR text, not a visual understanding model.
- **Improve text recognition:** compare the current text with adaptive Sauvola OCR and approve replacement. Originals stay unchanged; accepted text refreshes search, categories and suggestions.
- **Categories:** local text rules organize screenshots into events, travel, receipts, study, health, credentials and other. Screenshots may belong to multiple categories.
- **Suggested calendar actions:** review extracted event details, correct them and approve a local `.ics` download. Open that file in a calendar to complete the import. No automatic calendar writes.
- **Duplicate review:** stored 64-bit dHash, Hamming distance <=4, approximately 2% aspect-ratio tolerance, a five-band candidate index and union-find groups. Review thumbnails, select copies and confirm deletion. No automatic deletion. Dismissals persist.
- **OCR lab:** compare standard and adaptive processing against a manually entered reference; export timings and character/word error rates locally.

## Privacy and practical limits

Image contents and search queries are processed locally by the application. OCR/model assets download from third-party hosts, which receive ordinary asset requests. This is **not a verified fully offline application**: there is no offline app-shell service worker. Browser data can be cleared or evicted and is not separately encrypted by SnapSort.

Highlight-aware text extraction can improve some screenshots but worsen others. Highlight semantics, arrow interpretation and reliable handwriting/calligraphy recognition are not implemented. Cropping and large annotations can prevent duplicate matches; similar layouts or changed amounts/dates can cause false matches. Duplicate groups can contain transitive chains rather than every pair being within the threshold. Dense hash collisions can still be expensive. Always review before deletion or calendar export.

This is a browser prototype, not a native mobile app or automatic background camera-roll scanner. Categories and action suggestions use rules, not generative AI. A Codespaces preview requires a running Codespace and appropriate viewer access; it is not a permanent deployment.

## Validation

```sh
pnpm check
```

Runs TypeScript, all 25 automated tests and the production build. Tests cover category/event extraction, calendar validation, OCR scoring and perceptual-hash grouping. They do not substitute for browser interaction tests.

During development, browser OCR/search and calendar-file preparation were exercised. A user-supplied highlighted sample reduced character error rate from 8.12% to 0.68% with adaptive OCR; another sample became worse. This is a small exploratory comparison, **not a general accuracy benchmark**. End-to-end persistence, improved-text approval and duplicate deletion still warrant the manual checks in [the demo guide](docs/DEMO.md).

## Project structure

```text
public/             Logo
src/components/     Library dialogs, insights panel and OCR lab
src/hooks/          Semantic search, insights and duplicate coordination
src/lib/            Browser storage, OCR, image utilities and algorithms
src/workers/        Semantic search, adaptive OCR and image hashing
src/App.tsx         Main library
src/main.tsx        Application entry point
scripts/            Conservative repository cleanup helper
tests/              Automated algorithm and validation tests
```

Development: React, TypeScript, Vite, Tailwind CSS and Lucide icons. OCR: [Tesseract.js](https://github.com/naptha/tesseract.js). Semantic model: [all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2).

For an older repository containing root-level source copies, run `node scripts/cleanup.mjs` to preview cleanup, then `node scripts/cleanup.mjs --apply`. A backup is created outside the repository. Review the changes and run `pnpm check` before committing. Unknown files are left untouched.
