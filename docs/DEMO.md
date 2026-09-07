# Submission demo and final checks

## A two-minute demo

1. Import a sample receipt, study note, event screenshot and a second copy of one image. Use non-sensitive examples you have permission to share.
2. Search an exact amount, then a phrase such as “bike repair bill”. Show the source image and extracted text.
3. Select a category to narrow the library.
4. Open a highlighted example and use Improve text recognition. Compare before approving; do not imply adaptive is always better.
5. Open Duplicates. Enlarge the images, demonstrate selection and cancellation. Delete only disposable test copies you intend to remove.
6. Review an event suggestion. Explain that approval downloads a file for the user's calendar rather than automatically creating an event.

## Before submitting

- Run `pnpm check` after cleanup.
- Refresh and confirm saved screenshots still load and remain searchable.
- Confirm accepted improved text survives refresh and appears in search.
- Dismiss a duplicate group, refresh, and confirm it stays dismissed. Restore it; delete a disposable copy and verify it stays deleted after refresh.
- Try a new import after deletion, and a mobile-width browser window.
- Commit and push source/configuration/docs, not node_modules, dist, private images or comparison reports.
- Verify judges can access the repository with the required visibility/access. Do not change privacy settings without considering the contents.
- If providing a live demo, check the exact submitted link in a browser session with the same access judges will have.
- Record a short backup demo video in case model downloads or the Codespace are unavailable. Do not claim an untested offline mode.

## Proposed next work

A representative OCR test set, highlight-region detection, a fully cached offline application and broader browser/mobile tests. Avoid adding new models immediately before submission.
