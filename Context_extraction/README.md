# Reel → Wiki Pipeline

Extract reel content → dual output (concise summary + deep analysis wiki)

## What it does

```
Reel URL → Download → Transcribe → AI Analysis → 2 Files
```

**Output 1:** Concise summary (3-5 lines, all key points)  
**Output 2:** Deep wiki entry (expert expanded analysis)

## Requirements

- Python 3.8+
- ffmpeg
- Anthropic API key

## Setup

```bash
# 1. Install deps
bash setup.sh

# 2. Set API key
export ANTHROPIC_API_KEY='your_key_here'
```

## Usage

```bash
python3 reel_to_wiki.py "https://instagram.com/reel/..."
```

**Supported platforms:**
- Instagram Reels
- TikTok
- YouTube Shorts
- Twitter/X videos

## Output

Files saved to `./wiki/`:

```
20240508_153045_my_reel_title_SUMMARY.txt  ← Quick overview
20240508_153045_my_reel_title_WIKI.md     ← Deep analysis
```

## Example

```bash
python3 reel_to_wiki.py "https://www.instagram.com/reel/C1234567890/"

# Creates:
# wiki/20240508_153045_cooking_tips_SUMMARY.txt
# wiki/20240508_153045_cooking_tips_WIKI.md
```

## Config

Edit script to change:

```python
WHISPER_MODEL = "base"  # base/small/medium/large
                        # larger = more accurate but slower
```

## Performance

| Model | Speed | Accuracy |
|-------|-------|----------|
| base | Fast | Good |
| small | Medium | Better |
| medium | Slow | Great |
| large | Very slow | Best |

## Troubleshooting

**Download fails:**
```bash
# Update yt-dlp
pip3 install -U yt-dlp
```

**API errors:**
- Check API key set correctly
- Check internet connection
- Script falls back to basic output if API fails

**No audio extracted:**
- Reel might be silent
- Check ffmpeg installed: `ffmpeg -version`

## Files Created

```
temp_reels/    ← Temp downloads (auto-cleaned)
wiki/          ← Final outputs
  ├── *_SUMMARY.txt
  └── *_WIKI.md
```

## License

MIT
