# Osameh Neural Cipher icon pack

## Recommended usage

- `icon-32x32.png`: header icon at 1x density
- `icon-64x64.png`: header icon at 2x density
- `favicon.ico`: multi-size favicon containing 16, 32, and 48 px variants
- `apple-touch-icon.png`: Apple touch icon, 180 px
- `pwa-192x192.png`: standard PWA icon
- `pwa-512x512.png`: large PWA icon
- `icon-128x128.png` and `icon-256x256.png`: profile/UI uses
- `icon-1024x1024.png`: transparent high-resolution master
- `osameh-neural-cipher-source.png`: full generated source with corrected alpha transparency

Transparent icons include a small safe margin. Apple and PWA icons use an opaque `#070b0a` background and additional safe space so operating-system masks do not crop the face.

## Header example

```html
<img
  src="/icons/icon-32x32.png"
  srcset="/icons/icon-64x64.png 2x"
  width="32"
  height="32"
  alt="Osameh"
/>
```

## Document head

```html
<link rel="icon" href="/icons/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32x32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png">
```
