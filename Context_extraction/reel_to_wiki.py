#!/usr/bin/env python3
"""
Reel → Wiki pipeline
Download reel → transcribe → dual output (summary + deep analysis)
"""

import os
import sys
import subprocess
import json
from pathlib import Path
import whisper
from datetime import datetime

# Config
TEMP_DIR = Path("./temp_reels")
OUTPUT_DIR = Path("./wiki")
WHISPER_MODEL = "base"  # base/small/medium/large

def setup_dirs():
    """Create temp + output dirs"""
    TEMP_DIR.mkdir(exist_ok=True)
    OUTPUT_DIR.mkdir(exist_ok=True)

def download_reel(url: str) -> Path:
    """Download reel via yt-dlp"""
    print(f"[1/5] Downloading reel...")
    
    output_template = str(TEMP_DIR / "reel_%(id)s.%(ext)s")
    
    cmd = [
        "yt-dlp",
        url,
        "-o", output_template,
        "--format", "best",
        "--write-info-json"
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        raise Exception(f"Download failed: {result.stderr}")
    
    # Find downloaded video file
    video_files = list(TEMP_DIR.glob("reel_*.*"))
    video_files = [f for f in video_files if f.suffix != ".json"]
    
    if not video_files:
        raise Exception("No video file found after download")
    
    return video_files[0]

def extract_audio(video_path: Path) -> Path:
    """Extract audio from video"""
    print("[2/5] Extracting audio...")
    
    audio_path = video_path.with_suffix(".mp3")
    
    cmd = [
        "ffmpeg",
        "-i", str(video_path),
        "-q:a", "0",
        "-map", "a",
        "-y",
        str(audio_path)
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        raise Exception(f"Audio extraction failed: {result.stderr}")
    
    return audio_path

def transcribe_audio(audio_path: Path) -> dict:
    """Transcribe audio with Whisper"""
    print(f"[3/5] Transcribing (model: {WHISPER_MODEL})...")
    
    model = whisper.load_model(WHISPER_MODEL)
    result = model.transcribe(str(audio_path))
    
    return {
        "text": result["text"],
        "segments": result.get("segments", []),
        "language": result.get("language", "unknown")
    }

def get_metadata(url: str) -> dict:
    """Get reel metadata from info.json if exists"""
    info_files = list(TEMP_DIR.glob("reel_*.info.json"))
    
    if info_files:
        with open(info_files[0]) as f:
            data = json.load(f)
            return {
                "title": data.get("title", "Unknown"),
                "uploader": data.get("uploader", "Unknown"),
                "description": data.get("description", ""),
                "duration": data.get("duration", 0),
                "upload_date": data.get("upload_date", ""),
                "view_count": data.get("view_count", 0),
            }
    
    return {"title": "Unknown", "uploader": "Unknown"}

def generate_summary(transcript: str, metadata: dict) -> str:
    """Generate concise summary via Claude API"""
    print("[4/5] Generating summary...")
    
    prompt = f"""Given this reel transcript, create a super concise 3-5 line summary with all key points.

Metadata:
- Title: {metadata.get('title', 'Unknown')}
- Creator: {metadata.get('uploader', 'Unknown')}

Transcript:
{transcript}

Summary (3-5 lines, dense info):"""

    # Using Claude API
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}]
        )
        
        return message.content[0].text.strip()
    
    except Exception as e:
        print(f"Warning: API call failed ({e}), using basic summary")
        # Fallback: truncate transcript
        return transcript[:500] + "..." if len(transcript) > 500 else transcript

def generate_deep_analysis(transcript: str, metadata: dict, url: str) -> str:
    """Generate expert deep-dive markdown"""
    print("[5/5] Generating deep analysis...")
    
    prompt = f"""You are an expert analyst. Given this reel transcript, create a comprehensive markdown wiki entry that:

1. Expands concepts into deeper dimensions
2. Provides context and background
3. Identifies key themes and insights
4. Adds expert commentary and implications
5. Structures information hierarchically
6. Cross-links related concepts

Make it thorough like a Wikipedia article - not just transcript copy.

Metadata:
- Title: {metadata.get('title', 'Unknown')}
- Creator: {metadata.get('uploader', 'Unknown')}
- Duration: {metadata.get('duration', 0)}s
- Source: {url}

Transcript:
{transcript}

Create comprehensive markdown wiki entry:"""

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}]
        )
        
        return message.content[0].text.strip()
    
    except Exception as e:
        print(f"Warning: API call failed ({e}), using basic format")
        # Fallback: basic markdown
        return f"""# {metadata.get('title', 'Reel Analysis')}

**Creator:** {metadata.get('uploader', 'Unknown')}  
**Source:** {url}  
**Duration:** {metadata.get('duration', 0)}s

## Transcript

{transcript}

## Analysis

*Deep analysis not available - API error*
"""

def save_outputs(summary: str, deep_md: str, metadata: dict, url: str):
    """Save both outputs"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    title_slug = metadata.get('title', 'reel').replace(' ', '_')[:50]
    
    # Save summary
    summary_file = OUTPUT_DIR / f"{timestamp}_{title_slug}_SUMMARY.txt"
    with open(summary_file, 'w') as f:
        f.write(f"REEL SUMMARY\n")
        f.write(f"{'='*60}\n")
        f.write(f"Title: {metadata.get('title', 'Unknown')}\n")
        f.write(f"Creator: {metadata.get('uploader', 'Unknown')}\n")
        f.write(f"Source: {url}\n")
        f.write(f"{'='*60}\n\n")
        f.write(summary)
    
    print(f"\n✓ Summary saved: {summary_file}")
    
    # Save deep analysis
    wiki_file = OUTPUT_DIR / f"{timestamp}_{title_slug}_WIKI.md"
    with open(wiki_file, 'w') as f:
        f.write(deep_md)
    
    print(f"✓ Wiki saved: {wiki_file}")

def cleanup_temp():
    """Remove temp files"""
    for f in TEMP_DIR.glob("*"):
        f.unlink()
    print("\n✓ Cleaned temp files")

def main():
    if len(sys.argv) < 2:
        print("Usage: python reel_to_wiki.py <reel_url>")
        print("\nExample:")
        print("  python reel_to_wiki.py https://instagram.com/reel/...")
        sys.exit(1)
    
    url = sys.argv[1]
    
    print(f"\n{'='*60}")
    print("REEL → WIKI PIPELINE")
    print(f"{'='*60}\n")
    print(f"Input: {url}\n")
    
    try:
        setup_dirs()
        
        # Pipeline
        video_path = download_reel(url)
        audio_path = extract_audio(video_path)
        transcript_data = transcribe_audio(audio_path)
        metadata = get_metadata(url)
        
        transcript = transcript_data["text"]
        
        # Dual output generation
        summary = generate_summary(transcript, metadata)
        deep_md = generate_deep_analysis(transcript, metadata, url)
        
        # Save
        save_outputs(summary, deep_md, metadata, url)
        
        # Cleanup
        cleanup_temp()
        
        print(f"\n{'='*60}")
        print("✓ PIPELINE COMPLETE")
        print(f"{'='*60}\n")
        
    except Exception as e:
        print(f"\n✗ ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
