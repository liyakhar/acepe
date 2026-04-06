#!/bin/bash
# Generate all Acepe icons from the canonical source logos.
# Primary: dark bars on #F1EEE6 cream background
# Dark variant: light bars on #1A1A1A

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(dirname "$SCRIPT_DIR")"
ICONS_DIR="$DESKTOP_DIR/src-tauri/icons"
STATIC_DIR="$DESKTOP_DIR/static"
ASSETS_DIR="$(dirname "$(dirname "$DESKTOP_DIR")")/assets"
CANONICAL_LOGO_LIGHT="$ASSETS_DIR/acepe-logo-light-bg.png"
CANONICAL_LOGO_DARK="$ASSETS_DIR/acepe-logo-dark-bg.png"
GENERATED_LOGO_LIGHT="$ASSETS_DIR/logo.svg"
GENERATED_LOGO_DARK="$ASSETS_DIR/logo-dark.svg"
LOGO_SOURCE_BACKGROUND="#F1EEE6"
MASTER_ICON_PNG="/tmp/acepe_icon_master.png"
LOGO_LIGHT_BASE64="/tmp/acepe_logo_light.base64"
LOGO_DARK_BASE64="/tmp/acepe_logo_dark.base64"

echo "Generating Acepe icons..."

if [ ! -f "$CANONICAL_LOGO_LIGHT" ]; then
  echo "Missing canonical light logo: $CANONICAL_LOGO_LIGHT" >&2
  exit 1
fi

if [ ! -f "$CANONICAL_LOGO_DARK" ]; then
  echo "Missing canonical dark logo: $CANONICAL_LOGO_DARK" >&2
  exit 1
fi

# Mirror the canonical PNGs into the SVG paths the app already imports.
base64 < "$CANONICAL_LOGO_LIGHT" | tr -d '\n' > "$LOGO_LIGHT_BASE64"
cat > "$GENERATED_LOGO_LIGHT" <<EOF
<svg width="140" height="140" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
<image width="140" height="140" preserveAspectRatio="none" href="data:image/png;base64,$(cat "$LOGO_LIGHT_BASE64")"/>
</svg>
EOF
echo "✓ Generated logo.svg"

base64 < "$CANONICAL_LOGO_DARK" | tr -d '\n' > "$LOGO_DARK_BASE64"
cat > "$GENERATED_LOGO_DARK" <<EOF
<svg width="140" height="140" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
<image width="140" height="140" preserveAspectRatio="none" href="data:image/png;base64,$(cat "$LOGO_DARK_BASE64")"/>
</svg>
EOF
echo "✓ Generated logo-dark.svg"

# Create a square master icon from the canonical light logo so future icon rebuilds stay in sync.
magick "$CANONICAL_LOGO_LIGHT" \
  -background "$LOGO_SOURCE_BACKGROUND" \
  -gravity center \
  -extent 1460x1460 \
  -resize 1024x1024 \
  -define png:color-type=6 \
  "$MASTER_ICON_PNG"

echo "✓ Created master icon from canonical light logo"

# Generate all Tauri icons using the CLI
cd "$DESKTOP_DIR"
bunx tauri icon "$MASTER_ICON_PNG"
echo "✓ Generated Tauri icons (icns, ico, pngs)"

# Generate favicon (32x32 with dark background)
magick "$MASTER_ICON_PNG" -resize 32x32 \
  -define png:color-type=6 \
  "$STATIC_DIR/favicon.png"
echo "✓ Generated favicon.png"

# --- Website icons ---
WEBSITE_DIR="$(dirname "$DESKTOP_DIR")/website"
WEBSITE_STATIC="$WEBSITE_DIR/static"
WEBSITE_ASSETS="$WEBSITE_DIR/src/lib/assets"

if [ -d "$WEBSITE_DIR" ]; then
  echo "Generating website icons..."

  mkdir -p "$WEBSITE_ASSETS"
  cp "$GENERATED_LOGO_LIGHT" "$WEBSITE_STATIC/favicon.svg"
  cp "$GENERATED_LOGO_LIGHT" "$WEBSITE_ASSETS/favicon.svg"

  # Website favicon PNGs
  magick "$MASTER_ICON_PNG" -resize 16x16 -define png:color-type=6 "$WEBSITE_STATIC/favicon-16x16.png"
  magick "$MASTER_ICON_PNG" -resize 32x32 -define png:color-type=6 "$WEBSITE_STATIC/favicon-32x32.png"
  magick "$MASTER_ICON_PNG" -resize 192x192 -define png:color-type=6 "$WEBSITE_STATIC/favicon-192x192.png"
  magick "$MASTER_ICON_PNG" -resize 512x512 -define png:color-type=6 "$WEBSITE_STATIC/favicon-512x512.png"
  magick "$MASTER_ICON_PNG" -resize 180x180 -define png:color-type=6 "$WEBSITE_STATIC/apple-touch-icon.png"

  # Favicon.ico (multi-resolution for legacy browsers)
  magick "$MASTER_ICON_PNG" -resize 48x48 -define icon:auto-resize=48,32,16 "$WEBSITE_STATIC/favicon.ico"

  # OG image (1200x630 social preview with logo centered on brand background)
  magick -size 1200x630 "xc:$LOGO_SOURCE_BACKGROUND" \
    \( "$MASTER_ICON_PNG" -resize 400x400 \) \
    -gravity center -composite \
    "$WEBSITE_STATIC/og-image.png"
  magick "$WEBSITE_STATIC/og-image.png" -quality 90 "$WEBSITE_STATIC/og-image.jpg"

  # Patch Android launcher background (bunx tauri icon resets it to #fff)
  ANDROID_BG_FILE="$ICONS_DIR/android/values/ic_launcher_background.xml"
  if [ -f "$ANDROID_BG_FILE" ]; then
    sed -i '' "s/#fff/$LOGO_SOURCE_BACKGROUND/g" "$ANDROID_BG_FILE"
    echo "✓ Patched Android launcher background to $LOGO_SOURCE_BACKGROUND"
  fi

  echo "✓ Generated website icons"
fi

echo ""
echo "All icons generated successfully!"
echo "Master icon saved to: $MASTER_ICON_PNG"
