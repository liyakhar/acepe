#!/bin/bash
# Generate all Acepe icons from a single source (assets/logo.svg)
# Brand colors: #F1EEE6 (cream bg), #1A1A1A (dark mark/bg), #EBCB8B (gold accent)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(dirname "$SCRIPT_DIR")"
ICONS_DIR="$DESKTOP_DIR/src-tauri/icons"
STATIC_DIR="$DESKTOP_DIR/static"
ASSETS_DIR="$(dirname "$(dirname "$DESKTOP_DIR")")/assets"
SOURCE_LOGO="$ASSETS_DIR/logo.svg"
SOURCE_LOGO_DARK="$ASSETS_DIR/logo-dark.svg"
MASTER_ICON_PNG="/tmp/acepe_icon_master.png"
DARK_LOGO_BACKGROUND="#1A1A1A"
DARK_LOGO_FOREGROUND="#EBCB8B"
LOGO_SOURCE_BACKGROUND="#F1EEE6"
WEBSITE_LOGO_LIGHT_BACKGROUND="#F1EEE6"

LOGO_DARK_TRANSPARENT_PNG="/tmp/acepe_logo_dark_mark.png"
LOGO_DARK_ALPHA_PNG="/tmp/acepe_logo_dark_alpha.png"
LOGO_DARK_MASK_PNG="/tmp/acepe_logo_dark_mask.png"
LOGO_DARK_MASK_BASE64="/tmp/acepe_logo_dark_mask.base64"

echo "Generating Acepe icons..."

if [ ! -f "$SOURCE_LOGO" ]; then
  echo "Missing source logo: $SOURCE_LOGO" >&2
  exit 1
fi

# Create the master icon by extracting the embedded PNG from the SVG source.
# This avoids SVG rendering artifacts (rounded corner anti-aliasing, background bleed).
EMBEDDED_PNG="/tmp/acepe_source_embedded.png"
python3 -c "
import re, base64, sys
svg = open(sys.argv[1]).read()
m = re.search(r'data:image/png;base64,([^\"]+)', svg)
if m: sys.stdout.buffer.write(base64.b64decode(m.group(1)))
" "$SOURCE_LOGO" > "$EMBEDDED_PNG"
magick "$EMBEDDED_PNG" -resize 1536x1536! -define png:color-type=6 "$MASTER_ICON_PNG"

echo "✓ Created master icon from shared logo asset"

# Generate all Tauri icons using the CLI
cd "$DESKTOP_DIR"
bunx tauri icon "$MASTER_ICON_PNG"

# Fix Android launcher background -- bunx tauri icon defaults to #fff
ANDROID_BG_XML="$ICONS_DIR/android/values/ic_launcher_background.xml"
if [ -f "$ANDROID_BG_XML" ]; then
  sed -i '' "s/#fff/$LOGO_SOURCE_BACKGROUND/g" "$ANDROID_BG_XML"
  echo "✓ Patched Android launcher background to $LOGO_SOURCE_BACKGROUND"
fi
echo "✓ Generated Tauri icons (icns, ico, pngs)"

# Generate favicon (32x32 with dark background)
magick "$MASTER_ICON_PNG" -resize 32x32 \
  -define png:color-type=6 \
  "$STATIC_DIR/favicon.png"
echo "✓ Generated favicon.png"

# Build a flat gold-on-dark SVG variant from the full-size master icon to preserve edge detail.
magick "$MASTER_ICON_PNG" -alpha on -fuzz 15% -transparent "$LOGO_SOURCE_BACKGROUND" "$LOGO_DARK_TRANSPARENT_PNG"
magick "$LOGO_DARK_TRANSPARENT_PNG" -alpha extract "$LOGO_DARK_ALPHA_PNG"
magick -size 1536x1536 xc:white "$LOGO_DARK_ALPHA_PNG" \
  -alpha off \
  -compose CopyOpacity \
  -composite \
  "png32:$LOGO_DARK_MASK_PNG"
base64 < "$LOGO_DARK_MASK_PNG" | tr -d '\n' > "$LOGO_DARK_MASK_BASE64"

cat > "$SOURCE_LOGO_DARK" <<EOF
<svg width="140" height="140" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="140" height="140" rx="26" fill="$DARK_LOGO_BACKGROUND"/>
<mask id="mark-mask" x="0" y="0" width="140" height="140" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
<image width="140" height="140" preserveAspectRatio="none" href="data:image/png;base64,$(cat "$LOGO_DARK_MASK_BASE64")"/>
</mask>
<rect width="140" height="140" fill="$DARK_LOGO_FOREGROUND" mask="url(#mark-mask)"/>
</svg>
EOF
echo "✓ Generated logo-dark.svg"

# --- Website icons ---
WEBSITE_DIR="$(dirname "$DESKTOP_DIR")/website"
WEBSITE_STATIC="$WEBSITE_DIR/static"
WEBSITE_ASSETS="$WEBSITE_DIR/src/lib/assets"

if [ -d "$WEBSITE_DIR" ]; then
  echo "Generating website icons..."

  mkdir -p "$WEBSITE_ASSETS"
  cp "$SOURCE_LOGO" "$WEBSITE_STATIC/favicon.svg"
  cp "$SOURCE_LOGO" "$WEBSITE_ASSETS/favicon.svg"

  # Website favicon PNGs (with dark background for better visibility)
  magick "$MASTER_ICON_PNG" -resize 16x16 -define png:color-type=6 "$WEBSITE_STATIC/favicon-16x16.png"
  magick "$MASTER_ICON_PNG" -resize 32x32 -define png:color-type=6 "$WEBSITE_STATIC/favicon-32x32.png"
  magick "$MASTER_ICON_PNG" -resize 192x192 -define png:color-type=6 "$WEBSITE_STATIC/favicon-192x192.png"
  magick "$MASTER_ICON_PNG" -resize 512x512 -define png:color-type=6 "$WEBSITE_STATIC/favicon-512x512.png"
  magick "$MASTER_ICON_PNG" -resize 180x180 -define png:color-type=6 "$WEBSITE_STATIC/apple-touch-icon.png"

  # favicon.ico (multi-resolution ICO for legacy browser support)
  magick "$MASTER_ICON_PNG" -resize 48x48 -define icon:auto-resize=48,32,16 "$WEBSITE_STATIC/favicon.ico"

  # OG / social preview image (1200x630, logo centered on light background)
  OG_BG_COLOR="$WEBSITE_LOGO_LIGHT_BACKGROUND"
  magick -size 1200x630 "xc:$OG_BG_COLOR" \
    \( "$MASTER_ICON_PNG" -resize 400x400 \) \
    -gravity center -composite \
    "$WEBSITE_STATIC/og-image.png"
  magick "$WEBSITE_STATIC/og-image.png" -quality 90 "$WEBSITE_STATIC/og-image.jpg"

  echo "✓ Generated website icons"
fi

echo ""
echo "All icons generated successfully!"
echo "Master icon saved to: $MASTER_ICON_PNG"
