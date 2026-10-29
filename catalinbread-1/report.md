# Catalinbread batch 1 — image QA / coverage report

- Items: 26 (26 new Tier A)
- Images: 26 × 800/350 AVIF (52 files)
- Official: 18 · Planner last-resort: 8 (31%)
- Analyzer: all accept/flag, 0 reject; PSNR 41.94–51.05 dB
- Vision: 1 `catalog-image-reviewer` pass — approve-with-flags, 0 rejects

| id | source | 800 px | analyzer | PSNR dB |
|---|---|---|---|---|
| `catalinbread-adineko` | official | 429×800 | accept (aspect 0.015, persp 0.000) | 44.51 |
| `catalinbread-adineko-70s-collection` | official | 429×800 | accept (aspect 0.015, persp 0.004) | 41.94 |
| `catalinbread-adineko-ghost` | official | 427×800 | accept (aspect 0.020, persp 0.002) | 45.27 |
| `catalinbread-airstrip` | official | 427×800 | accept (aspect 0.020, persp 0.000) | 42.97 |
| `catalinbread-antichthon` | planner | 429×800 | accept (aspect 0.015, persp 0.001) | 51.05 |
| `catalinbread-antichthon-deluxe` | planner | 800×650 | flag (aspect 0.000, persp 0.160) | 49.22 |
| `catalinbread-belle-epoch` | official | 428×800 | accept (aspect 0.018, persp 0.001) | 45.26 |
| `catalinbread-belle-epoch-plus` | official | 423×800 | accept (aspect 0.029, persp 0.002) | 44.81 |
| `catalinbread-belle-epoch-deluxe` | official | 800×648 | flag (aspect 0.034, persp 0.135) | 45.60 |
| `catalinbread-bicycle-delay` | official | 433×800 | accept (aspect 0.006, persp 0.003) | 46.00 |
| `catalinbread-bitters` | official | 427×800 | accept (aspect 0.020, persp 0.001) | 42.68 |
| `catalinbread-blood-donor` | planner | 429×800 | accept (aspect 0.015, persp 0.001) | 46.36 |
| `catalinbread-cb-paint` | official | 429×800 | accept (aspect 0.015, persp 0.001) | 45.71 |
| `catalinbread-cb-tap` | planner | 316×800 | flag (aspect 0.083, persp 0.140) | 46.76 |
| `catalinbread-cbx` | official | 423×800 | accept (aspect 0.029, persp 0.001) | 42.15 |
| `catalinbread-csidman` | planner | 429×800 | accept (aspect 0.031, persp 0.001) | 46.06 |
| `catalinbread-csidman-ghost` | official | 430×800 | accept (aspect 0.029, persp 0.001) | 44.87 |
| `catalinbread-callisto` | planner | 429×800 | accept (aspect 0.011, persp 0.001) | 46.09 |
| `catalinbread-callisto-mkii` | planner | 429×800 | accept (aspect 0.015, persp 0.001) | 44.69 |
| `catalinbread-carbide` | official | 429×800 | accept (aspect 0.015, persp 0.002) | 45.50 |
| `catalinbread-clean-little-secret` | official | 429×800 | flag (aspect 0.015, persp 0.001) | 43.58 |
| `catalinbread-cloak` | official | 433×800 | accept (aspect 0.006, persp 0.004) | 43.50 |
| `catalinbread-coriolis-effect` | official | 800×657 | flag (aspect 0.011, persp 0.221) | 43.28 |
| `catalinbread-dirty-little-secret` | official | 428×800 | accept (aspect 0.018, persp 0.001) | 44.70 |
| `catalinbread-dirty-little-secret-deluxe` | official | 800×650 | flag (aspect 0.037, persp 0.140) | 43.68 |
| `catalinbread-dreamcoat` | planner | 429×800 | accept (aspect 0.015, persp 0.001) | 44.12 |

## Notes
- 6 `flag` cells: perspective/shape-taper on the 4 landscape units + CB Tap (flat top face confirmed at 1:1); `clean-little-secret` white-enclosure “background card” false positive (source transparent border 0/3000).
- No jack edges asserted: no official connector-face photo/manual diagram verified; `catalog:check-jacks` green.
- Planner last-resort items: antichthon, antichthon-deluxe, blood-donor, csidman, callisto, callisto-mkii, dreamcoat, cb-tap.
