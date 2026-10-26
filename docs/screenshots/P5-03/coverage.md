# boss/boss-2 — coverage & image QA

26 raw records · 52 AVIF renditions (800/350) · one shared vision pass.

| # | id | 800 | 350 | aspect Δ | pipeline PSNR | shipped≈fresh IoU | vision |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `boss-dc-2-dimension-c` | 413×800 | 181×350 | 7.8% | 44.01 dB | 0.995 | accept |
| 2 | `boss-dc-2w-dimension-c-waza-craft` | 413×800 | 181×350 | 8.8% | 42.11 dB | 0.996 | accept |
| 3 | `boss-dc-3-digital-dimension` | 413×800 | 181×350 | 7.8% | 42.81 dB | 0.995 | accept |
| 4 | `boss-dd-2-digital-delay` | 413×800 | 181×350 | 7.8% | 42.37 dB | 0.995 | accept |
| 5 | `boss-dd-20-giga-delay` | 800×717 | 350×314 | 1.9% | 41.99 dB | 1.000 | accept |
| 6 | `boss-dd-200-digital-delay` | 588×800 | 257×350 | 0.4% | 40.96 dB | 1.000 | accept |
| 7 | `boss-dd-3-digital-delay` | 413×800 | 181×350 | 8.8% | 41.20 dB | 0.996 | accept |
| 8 | `boss-dd-3t-digital-delay` | 413×800 | 181×350 | 8.8% | 42.29 dB | 0.996 | accept |
| 9 | `boss-dd-5-digital-delay` | 413×800 | 181×350 | 8.8% | 42.36 dB | 0.995 | accept |
| 10 | `boss-dd-500-digital-delay` | 800×640 | 350×280 | 1.5% | 42.19 dB | 1.000 | accept |
| 11 | `boss-dd-6-digital-delay` | 413×800 | 181×350 | 8.8% | 42.01 dB | 0.995 | accept |
| 12 | `boss-dd-7-digital-delay` | 413×800 | 181×350 | 8.8% | 42.54 dB | 0.996 | accept |
| 13 | `boss-dd-8-digital-delay` | 413×800 | 181×350 | 8.8% | 42.00 dB | 0.996 | accept |
| 14 | `boss-df-2-super-feedbacker-distortion` | 413×800 | 181×350 | 7.8% | 42.69 dB | 0.995 | accept |
| 15 | `boss-dm-101-delay-machine` | 800×553 | 350×242 | 0.2% | 40.34 dB | 1.000 | accept |
| 16 | `boss-dm-2-delay` | 413×800 | 181×350 | 7.8% | 42.12 dB | 0.995 | accept |
| 17 | `boss-dm-2w-delay-waza-craft` | 413×800 | 181×350 | 8.8% | 42.34 dB | 0.996 | accept |
| 18 | `boss-dm-3-delay` | 413×800 | 181×350 | 7.8% | 40.59 dB | 0.996 | accept |
| 19 | `boss-dn-2-dyna-drive` | 413×800 | 181×350 | 8.8% | 42.05 dB | 0.995 | accept |
| 20 | `boss-ds-1-distortion` | 413×800 | 181×350 | 8.8% | 42.33 dB | 0.995 | accept |
| 21 | `boss-ds-1-4a-anniversary-distortion` | 413×800 | 181×350 | 8.8% | 44.18 dB | 0.995 | accept |
| 22 | `boss-ds-1-wh-distortion` | 413×800 | 181×350 | 8.8% | 43.18 dB | 0.995 | accept |
| 23 | `boss-ds-1x-distortion` | 413×800 | 181×350 | 8.8% | 42.12 dB | 0.995 | accept |
| 24 | `boss-ds-1w-distortion` | 413×800 | 181×350 | 8.8% | 43.07 dB | 0.995 | accept |
| 25 | `boss-ds-2-turbo-distortion` | 413×800 | 181×350 | 8.8% | 42.41 dB | 0.996 | accept |
| 26 | `boss-dsd-2-digital-sampler-delay` | 413×800 | 181×350 | 7.8% | 43.02 dB | 0.996 | accept |

Notes:
- PSNR is the pipeline encode gate (fresh PNG cutout vs AVIF q80) on the recorded source; all ≥40 dB.
- `shipped≈fresh IoU` compares the committed AVIF alpha to a fresh deterministic render of the recorded source (same content, sub-pixel crop difference).
- `boss-dd-20-giga-delay` shipped without body-crop (matched exactly: 800×717, IoU 0.9998, 41.99 dB).
- Vision: 26/26 accept, 0 flag, 0 reject (contact sheet `boss-2-contact-sheet.png`).
