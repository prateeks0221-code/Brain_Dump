#!/bin/bash
# Setup script for reel-to-wiki pipeline

echo "Setting up reel-to-wiki pipeline..."
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "✗ Python3 not found. Install Python 3.8+"
    exit 1
fi
echo "✓ Python3 found"

# Check ffmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "✗ ffmpeg not found"
    echo "Install:"
    echo "  macOS: brew install ffmpeg"
    echo "  Ubuntu: sudo apt install ffmpeg"
    echo "  Windows: Download from https://ffmpeg.org"
    exit 1
fi
echo "✓ ffmpeg found"

# Install Python deps
echo ""
echo "Installing Python packages..."
pip3 install -r requirements.txt

echo ""
echo "✓ Setup complete!"
echo ""
echo "Set API key:"
echo "  export ANTHROPIC_API_KEY='your_key_here'"
echo ""
echo "Usage:"
echo "  python3 reel_to_wiki.py <reel_url>"
