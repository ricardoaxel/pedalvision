# boss/boss-3 coverage

26 raw records; 26 x 800 + 26 x 350 AVIF renditions. Vision QA: final pass 26 accept / 0 flag / 0 reject.

| id | deviceType | formFactor | effectTypes | jacks | image source | QA |
| --- | --- | --- | --- | --- | --- | --- |
| boss-dsd-3-digital-sampler-delay | stompbox | compact | delay | verified | https://pedalplayground.com/public/images/pedals/boss-dsd3.png | accept |
| boss-eh-2-enhancer | stompbox | compact | utility | verified | https://pedalplayground.com/public/images/pedals/boss-eh2.png | accept |
| boss-eq-20-advanced-eq | stompbox | double | eq | unknown | https://pedalplayground.com/public/images/pedals/boss-eq20.png | accept |
| boss-eq-200-graphic-equalizer | stompbox | standard | eq | verified | https://pedalplayground.com/public/images/pedals/boss-eq200.png | accept |
| boss-es-5-effects-switching-system | switcher | standard | controller, utility | verified | https://pedalplayground.com/public/images/pedals/boss-es5.png | accept |
| boss-es-8-effects-switching-system | switcher | standard | controller, utility | verified | https://pedalplayground.com/public/images/pedals/boss-es8.png | accept |
| boss-ev-1-wl-wireless-midi-expression-pedal | controller | expression | controller | verified | https://pedalplayground.com/public/images/pedals/boss-ev1wl.png | accept |
| boss-ev-30-dual-expression-pedal | controller | expression | controller | verified | https://pedalplayground.com/public/images/pedals/boss-ev30.png | accept |
| boss-ev-5-expression-pedal | controller | expression | controller | unknown | https://pedalplayground.com/public/images/pedals/boss-ev5.png | accept |
| boss-fb-2-feedbacker-booster | stompbox | compact | boost | unknown | https://pedalplayground.com/public/images/pedals/boss-fb2.png | accept |
| boss-fbm-1-59-fender-bassman | stompbox | standard | amp-modeler | unknown | https://pedalplayground.com/public/images/pedals/boss-fbm1.png | accept |
| boss-fdr-1-fender-65-deluxe-reverb | stompbox | standard | amp-modeler, reverb | unknown | https://pedalplayground.com/public/images/pedals/boss-fdr1.png | accept |
| boss-frv-1-63-fender-reverb | stompbox | compact | reverb | unknown | https://pedalplayground.com/public/images/pedals/boss-frv1.png | accept |
| boss-fs-1-wl-wireless-footswitch | controller | standard | controller | unknown | https://pedalplayground.com/public/images/pedals/boss-fs1wl.png | accept |
| boss-fs-5l-foot-switch | controller | other | controller | unknown | https://pedalplayground.com/public/images/pedals/boss-fs5l.png | accept |
| boss-fs-5u-foot-switch | controller | other | controller | unknown | https://pedalplayground.com/public/images/pedals/boss-fs5u.png | accept |
| boss-fs-6-dual-foot-switch | controller | standard | controller | unknown | https://pedalplayground.com/public/images/pedals/boss-fs6.png | accept |
| boss-fs-7-dual-foot-switch | controller | other | controller | verified | https://pedalplayground.com/public/images/pedals/boss-fs7.png | accept |
| boss-ft-2-dynamic-filter | stompbox | compact | filter | verified | https://pedalplayground.com/public/images/pedals/boss-ft2.png | accept |
| boss-fv-100-guitar-volume | controller | expression | utility | unknown | https://pedalplayground.com/public/images/pedals/boss-fv100.png | accept |
| boss-fv-30-foot-volume | controller | expression | utility | unknown | https://pedalplayground.com/public/images/pedals/boss-fv30.png | accept |
| boss-fv-500-volume-pedal | controller | expression | utility | unknown | https://pedalplayground.com/public/images/pedals/boss-fv500.png | accept |
| boss-fz-1w-fuzz | stompbox | compact | fuzz | verified | https://pedalplayground.com/public/images/pedals/boss-fz1w.png | accept |
| boss-fz-2-hyper-fuzz | stompbox | compact | fuzz | verified | https://pedalplayground.com/public/images/pedals/boss-fz2.png | accept |
| boss-fz-3-fuzz | stompbox | compact | fuzz | verified | https://pedalplayground.com/public/images/pedals/boss-fz3.png | accept |
| boss-fz-5-fuzz | stompbox | compact | fuzz | unknown | https://pedalplayground.com/public/images/pedals/boss-fz5.png | accept |

## Notes

- All images are the documented last-resort planner cutouts (`public-asset`) after official/authorized top-down art was exhausted; per-item source URLs are in the table.
- FV-100 and FZ-5 were re-sourced from a clean transparent variant after vision pass 1 flagged a shadow/background residual; final PSNR 41.59 dB and 42.28 dB. FV-100 ships as AVIF (no PNG fallback).
- 12 records carry verified jack layouts; 14 omit edges (`unknown`) because no official connector-face source was available.
