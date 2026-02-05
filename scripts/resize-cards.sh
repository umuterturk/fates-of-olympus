#!/bin/bash
#
# resize-cards.sh
# Resizes and optimizes card artwork from originals to web-ready format.
#
# Usage: ./scripts/resize-cards.sh [--dry-run] [--force] [--no-cleanup] [--verify-only]
#
# Options:
#   --dry-run     Show what would be done without making changes
#   --force       Overwrite existing files even if they're newer than source
#   --no-cleanup  Skip cleanup of orphaned files in target directory
#   --verify-only Only run verification checks, don't process images
#

set -e

# Configuration
SOURCE_DIR="art-work/originals/cards"
TARGET_DIR="web/public/cards"
CARDS_JSON="cards.json"
TARGET_WIDTH=384
TARGET_HEIGHT=576
QUALITY=85
OUTPUT_FORMAT="jpg"  # jpg or png

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
DRY_RUN=false
FORCE=false
NO_CLEANUP=false
VERIFY_ONLY=false
for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            ;;
        --force)
            FORCE=true
            ;;
        --no-cleanup)
            NO_CLEANUP=true
            ;;
        --verify-only)
            VERIFY_ONLY=true
            ;;
        --help|-h)
            echo "Usage: $0 [--dry-run] [--force] [--no-cleanup] [--verify-only]"
            echo ""
            echo "Resizes and optimizes card artwork from originals to web-ready format."
            echo ""
            echo "Options:"
            echo "  --dry-run     Show what would be done without making changes"
            echo "  --force       Overwrite existing files even if they're newer than source"
            echo "  --no-cleanup  Skip cleanup of orphaned files in target directory"
            echo "  --verify-only Only run verification checks, don't process images"
            exit 0
            ;;
    esac
done

# Find script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo -e "${BLUE}Card Image Resizer${NC}"
echo "===================="
echo ""

# Check for ImageMagick installation
MAGICK_CMD=""
MAGICK_VERSION=""

if command -v magick &> /dev/null; then
    # ImageMagick 7+ (preferred)
    MAGICK_CMD="magick"
    MAGICK_VERSION=$(magick --version | head -n1 | grep -oE 'ImageMagick [0-9]+\.[0-9]+\.[0-9]+' | head -n1)
    echo -e "${GREEN}✓${NC} Found $MAGICK_VERSION (using 'magick' command)"
elif command -v convert &> /dev/null; then
    # Check if it's actually ImageMagick's convert (not some other convert)
    if convert --version 2>/dev/null | grep -q "ImageMagick"; then
        MAGICK_CMD="convert"
        MAGICK_VERSION=$(convert --version | head -n1 | grep -oE 'ImageMagick [0-9]+\.[0-9]+\.[0-9]+' | head -n1)
        echo -e "${YELLOW}!${NC} Found $MAGICK_VERSION (using legacy 'convert' command)"
        echo -e "  ${YELLOW}Consider upgrading to ImageMagick 7+ for better performance${NC}"
    fi
fi

if [ -z "$MAGICK_CMD" ]; then
    echo -e "${RED}✗ Error: ImageMagick is not installed${NC}"
    echo ""
    echo "Please install ImageMagick:"
    echo ""
    echo "  macOS:   brew install imagemagick"
    echo "  Ubuntu:  sudo apt-get install imagemagick"
    echo "  Fedora:  sudo dnf install ImageMagick"
    echo ""
    exit 1
fi

# Verify source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo -e "${RED}✗ Error: Source directory not found: $SOURCE_DIR${NC}"
    exit 1
fi

# Create target directory if needed
if [ ! -d "$TARGET_DIR" ]; then
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}Would create:${NC} $TARGET_DIR"
    else
        mkdir -p "$TARGET_DIR"
        echo -e "${GREEN}Created:${NC} $TARGET_DIR"
    fi
fi

OUTPUT_FORMAT_UPPER=$(echo "$OUTPUT_FORMAT" | tr '[:lower:]' '[:upper:]')

echo ""
echo "Source: $SOURCE_DIR (PNG)"
echo "Target: $TARGET_DIR ($OUTPUT_FORMAT_UPPER)"
echo "Size:   ${TARGET_WIDTH}x${TARGET_HEIGHT}"
echo "Quality: $QUALITY%"
echo ""

# Cross-verification with cards.json
echo -e "${BLUE}Cross-verifying with cards.json...${NC}"

if [ ! -f "$CARDS_JSON" ]; then
    echo -e "${RED}✗ Error: cards.json not found${NC}"
    exit 1
fi

# Check for jq (JSON parser)
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}! Warning: jq not installed, skipping cards.json verification${NC}"
    echo "  Install with: brew install jq (macOS) or apt-get install jq (Ubuntu)"
    SKIP_JSON_VERIFY=true
else
    SKIP_JSON_VERIFY=false
fi

verify_errors=0
verify_warnings=0

if [ "$SKIP_JSON_VERIFY" = false ]; then
    # Extract card IDs from cards.json
    card_ids=$(jq -r '.cards[].id' "$CARDS_JSON" | sort -u)
    card_count=$(echo "$card_ids" | wc -l | tr -d ' ')
    
    # Get list of image files (without extension)
    image_files=$(find "$SOURCE_DIR" -type f -name "*.png" -exec basename {} .png \; | sort -u)
    image_count=$(echo "$image_files" | wc -l | tr -d ' ')
    
    echo ""
    echo "Cards in JSON: $card_count"
    echo "Image files:   $image_count"
    echo ""
    
    # Use comm to find differences (more reliable than loops)
    # Cards without images (in cards.json but not in images)
    missing_images=$(comm -23 <(echo "$card_ids") <(echo "$image_files"))
    verify_errors=$(echo "$missing_images" | grep -c . || true)
    
    # Images without cards (in images but not in cards.json)
    orphan_images=$(comm -13 <(echo "$card_ids") <(echo "$image_files"))
    verify_warnings=$(echo "$orphan_images" | grep -c . || true)
    
    if [ "$verify_errors" -gt 0 ]; then
        echo -e "${RED}✗ Cards missing artwork ($verify_errors):${NC}"
        echo "$missing_images" | while IFS= read -r id; do
            [ -n "$id" ] && echo "  - $id"
        done
        echo ""
    fi
    
    if [ "$verify_warnings" -gt 0 ]; then
        echo -e "${YELLOW}! Images without matching cards ($verify_warnings):${NC}"
        echo "$orphan_images" | while IFS= read -r name; do
            [ -n "$name" ] && echo "  - $name.png"
        done
        echo ""
    fi
    
    if [ "$verify_errors" -eq 0 ] && [ "$verify_warnings" -eq 0 ]; then
        echo -e "${GREEN}✓ All cards have matching images${NC}"
        echo -e "${GREEN}✓ All images have matching cards${NC}"
        echo ""
    fi
fi

# If verify-only mode, exit here
if [ "$VERIFY_ONLY" = true ]; then
    echo "===================="
    if [ "$verify_errors" -gt 0 ]; then
        echo -e "${RED}Verification failed: $verify_errors card(s) missing artwork${NC}"
        exit 1
    elif [ "$verify_warnings" -gt 0 ]; then
        echo -e "${YELLOW}Verification passed with warnings: $verify_warnings orphan image(s)${NC}"
        exit 0
    else
        echo -e "${GREEN}Verification passed${NC}"
        exit 0
    fi
fi

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}DRY RUN MODE - No changes will be made${NC}"
    echo ""
fi

# Build the resize command based on ImageMagick version
# Using -resize with geometry to fit within bounds while maintaining aspect ratio
# -strip removes metadata, -quality sets JPEG/PNG compression
build_resize_cmd() {
    local input="$1"
    local output="$2"
    
    if [ "$MAGICK_CMD" = "magick" ]; then
        # ImageMagick 7+ syntax
        echo "$MAGICK_CMD \"$input\" -resize ${TARGET_WIDTH}x${TARGET_HEIGHT} -strip -quality $QUALITY \"$output\""
    else
        # ImageMagick 6 (convert) syntax
        echo "$MAGICK_CMD \"$input\" -resize ${TARGET_WIDTH}x${TARGET_HEIGHT} -strip -quality $QUALITY \"$output\""
    fi
}

# Process images
processed=0
skipped=0
errors=0

# Find all PNG files in source directory (including subdirectories)
while IFS= read -r -d '' source_file; do
    # Get just the filename (no path) and change extension
    source_filename=$(basename "$source_file")
    base_name="${source_filename%.png}"
    target_filename="${base_name}.${OUTPUT_FORMAT}"
    target_file="$TARGET_DIR/$target_filename"
    
    # Check if we should skip this file
    if [ -f "$target_file" ] && [ "$FORCE" = false ]; then
        # Skip if target is newer than source
        if [ "$target_file" -nt "$source_file" ]; then
            ((skipped++))
            continue
        fi
    fi
    
    # Get relative path for display
    rel_source="${source_file#$PROJECT_ROOT/}"
    rel_target="${target_file#$PROJECT_ROOT/}"
    
    if [ "$DRY_RUN" = true ]; then
        echo -e "${BLUE}Would process:${NC} $rel_source → $rel_target"
        ((processed++))
    else
        echo -n "Processing: $source_filename → $target_filename... "
        
        # Build and execute the resize command
        if [ "$MAGICK_CMD" = "magick" ]; then
            if $MAGICK_CMD "$source_file" -resize "${TARGET_WIDTH}x${TARGET_HEIGHT}" -strip -quality "$QUALITY" "$target_file" 2>/dev/null; then
                echo -e "${GREEN}done${NC}"
                ((processed++))
            else
                echo -e "${RED}failed${NC}"
                ((errors++))
            fi
        else
            if $MAGICK_CMD "$source_file" -resize "${TARGET_WIDTH}x${TARGET_HEIGHT}" -strip -quality "$QUALITY" "$target_file" 2>/dev/null; then
                echo -e "${GREEN}done${NC}"
                ((processed++))
            else
                echo -e "${RED}failed${NC}"
                ((errors++))
            fi
        fi
    fi
done < <(find "$SOURCE_DIR" -type f -name "*.png" -print0)

echo ""
echo "===================="
echo -e "${GREEN}Processed:${NC} $processed"
echo -e "${YELLOW}Skipped:${NC}   $skipped (already up to date)"
if [ $errors -gt 0 ]; then
    echo -e "${RED}Errors:${NC}    $errors"
fi

# Cleanup orphaned files in target directory
if [ "$NO_CLEANUP" = false ]; then
    echo ""
    echo -e "${BLUE}Checking for orphaned files...${NC}"
    
    # Build list of valid base names from source (without extension)
    valid_bases=$(find "$SOURCE_DIR" -type f -name "*.png" -exec basename {} .png \; | sort -u)
    
    cleaned=0
    
    # Check for orphaned files in target directory
    for ext in png jpg; do
        for target_file in "$TARGET_DIR"/*."$ext"; do
            # Skip if no files match (glob didn't expand)
            [ -e "$target_file" ] || continue
            
            filename=$(basename "$target_file")
            # Get base name without extension
            base_name="${filename%.*}"
            
            # Check if base name exists in valid_bases
            if ! echo "$valid_bases" | grep -qx "$base_name"; then
                rel_target="${target_file#$PROJECT_ROOT/}"
                
                if [ "$DRY_RUN" = true ]; then
                    echo -e "${RED}Would delete:${NC} $rel_target (no matching original)"
                    cleaned=$((cleaned + 1))
                else
                    echo -e "${RED}Deleting:${NC} $rel_target (no matching original)"
                    rm "$target_file"
                    cleaned=$((cleaned + 1))
                fi
            fi
        done
    done
    
    # Also clean up old format files when switching formats (e.g., .png when using .jpg)
    if [ "$OUTPUT_FORMAT" = "jpg" ]; then
        for old_file in "$TARGET_DIR"/*.png; do
            [ -e "$old_file" ] || continue
            
            filename=$(basename "$old_file")
            base_name="${filename%.png}"
            new_file="$TARGET_DIR/${base_name}.jpg"
            
            # If corresponding new format file exists, delete the old one
            if [ -f "$new_file" ]; then
                rel_old="${old_file#$PROJECT_ROOT/}"
                
                if [ "$DRY_RUN" = true ]; then
                    echo -e "${YELLOW}Would delete:${NC} $rel_old (replaced by .jpg)"
                    cleaned=$((cleaned + 1))
                else
                    echo -e "${YELLOW}Deleting:${NC} $rel_old (replaced by .jpg)"
                    rm "$old_file"
                    cleaned=$((cleaned + 1))
                fi
            fi
        done
    fi
    
    if [ $cleaned -gt 0 ]; then
        echo -e "${RED}Cleaned:${NC}   $cleaned orphaned/old format file(s)"
    else
        echo -e "${GREEN}No orphaned files found${NC}"
    fi
fi

echo ""

if [ "$DRY_RUN" = true ]; then
    echo "Run without --dry-run to apply changes."
fi
