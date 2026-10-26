# P5-03 boss/boss-1 — image QA evidence

- Contact sheet: `contact-sheet.png` (26 cells, 4 columns × 7 rows, row-major order).
- Manifest: generated from `data/catalog/research/pedals/boss/boss-1.json` (order matches the raw file).
- Reviewer: `catalog-image-reviewer` (vision, opencode-go/deepseek-v4.1-flash), one pass.
- Verdicts: 24 accept, 2 flag (CE-1, CE-20: photo-like/soft base shading; flat, no halo/clipping), 0 reject.
- AVIF: 26 × 800 + 26 × 350, q80 (q90 for CE-20 and CE-3 after the PSNR gate); PSNR 39.7–44.5 dB.
- Demo link (PR preview origin): see the batch PR description.
