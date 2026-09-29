# MediTrack Product Type Images

Place the following square PNG image files (recommended: 400×400px, white/light background, object-fit: contain)
in this folder before deploying the app:

| Filename               | Product Type     |
|------------------------|------------------|
| ventilator.png         | Ventilator       |
| wheelchair.png         | Wheelchair       |
| infusion-pump.png      | Infusion Pump    |
| defibrillator.png      | Defibrillator    |
| portable-monitor.png   | Portable Monitor |

## Notes
- Images are optional: if a file is missing or fails to load, the tile will automatically
  fall back to an emoji placeholder (🫁, ♿, 💉, ⚡, 🖥️ respectively).
- Keep a transparent or white background so the tile's light-gray square area looks clean.
- Format: PNG, 400×400px or any square crop. JPEG works too but rename to .jpg and update
  the image_url in the product_types table accordingly.
- Images are served statically from the same directory as index.html.
  No CDN or build step is required.
