# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from youtube_comment_downloader import YoutubeCommentDownloader
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from pytube import YouTube
from collections import Counter
import re
from typing import List, Dict, Any, Optional

# ---------- helpers ----------
SARCASM_CUES = [
    "yeah right", "as if", "totally", "sure buddy", "/s",
    "what a joke", "great job", "nice job", "of course",
    "so good", "amazing work", "best ever", "love this so much"
]

def clean_text(text: str) -> str:
    text = str(text).lower()
    text = re.sub(r"http\S+|www\S+", "", text)
    text = re.sub(r"[^a-z0-9\s]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text

def label_sentiment(compound: float) -> str:
    if compound >= 0.05:
        return "Positive"
    elif compound <= -0.05:
        return "Negative"
    else:
        return "Neutral"

def sarcasm_score(text: str) -> float:
    t = text.lower()
    hits = sum(cue in t for cue in SARCASM_CUES)
    return min(hits / 2, 1.0)

def mark_needs_review(compound: float, is_sarcastic: bool) -> bool:
    if is_sarcastic:
        return True
    if -0.1 < compound < 0.1:
        return True
    return False

def extract_video_id(raw_url: str) -> Optional[str]:
    """Attempt to extract video id from many YouTube URL shapes"""
    if not raw_url:
        return None
    # youtu.be short
    m = re.search(r"youtu\.be/([A-Za-z0-9_-]{6,})", raw_url)
    if m:
        return m.group(1)
    # watch?v=
    m = re.search(r"[?&]v=([A-Za-z0-9_-]{6,})", raw_url)
    if m:
        return m.group(1)
    # shorts/
    m = re.search(r"shorts/([A-Za-z0-9_-]{6,})", raw_url)
    if m:
        return m.group(1)
    # last fallback: try something that looks like an ID
    m = re.search(r"([A-Za-z0-9_-]{11})", raw_url)
    if m:
        return m.group(1)
    return None

def get_video_info_safe(raw_url: str) -> Dict[str, Any]:
    vid = extract_video_id(raw_url)
    if not vid:
        return {"title": "Unknown title", "channel": None, "views": None, "length_seconds": None, "thumbnail_url": None}
    try:
        url = f"https://www.youtube.com/watch?v={vid}"
        yt = YouTube(url)
        return {
            "title": yt.title,
            "channel": yt.author,
            "views": yt.views,
            "length_seconds": yt.length,
            "thumbnail_url": yt.thumbnail_url,
        }
    except Exception as e:
        # Print error to console for debugging — okay for local dev
        print("pytube error:", e)
        return {"title": "Unknown title", "channel": None, "views": None, "length_seconds": None, "thumbnail_url": None}

# ---------- FastAPI app ----------
app = FastAPI(title="YouTube Comment Checker API")

# CORS so React local dev can call it
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # open during dev; lock to your domains when deploying
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

analyzer = SentimentIntensityAnalyzer()

# ---------- Pydantic model ----------
class AnalyzeRequest(BaseModel):
    video_url: str

# ---------- Endpoints ----------
@app.get("/")
def root():
    return {"message": "YouTube Comment Checker API is running ✅"}

@app.post("/analyze_video")
def analyze_video(body: AnalyzeRequest) -> Dict[str, Any]:
    url = (body.video_url or "").strip()
    if not url:
        return {"error": "Empty video_url"}

    # 1) video info (safe)
    video_info = get_video_info_safe(url)

    # 2) scrape comments
    downloader = YoutubeCommentDownloader()
    try:
        gen = downloader.get_comments_from_url(url)
    except Exception as e:
        print("comment downloader error:", e)
        return {"error": "Failed to fetch comments. Check the URL or try again later.", "video_info": video_info}

    total = 0
    pos = neg = neu = sarcastic = 0
    words: List[str] = []
    sample_comments: List[Dict[str, Any]] = []

    # limit processed comments to avoid long waits — adjust as needed
    MAX_COMMENTS = 800

    for i, c in enumerate(gen):
        if i >= MAX_COMMENTS:
            break

        text = c.get("text") or ""
        if not str(text).strip():
            continue

        cleaned = clean_text(text)
        if not cleaned:
            continue

        scores = analyzer.polarity_scores(cleaned)
        compound = scores.get("compound", 0.0)
        label = label_sentiment(compound)
        s_score = sarcasm_score(cleaned)
        is_sarc = s_score > 0.5

        total += 1
        if label == "Positive":
            pos += 1
        elif label == "Negative":
            neg += 1
        else:
            neu += 1
        if is_sarc:
            sarcastic += 1

        words.extend(cleaned.split())

        if len(sample_comments) < 20:
            sample_comments.append({
                "original": text,
                "cleaned": cleaned,
                "author": c.get("author"),   # author from the scraper (may be None)
                "sentiment": label,
                "compound": compound,
                "sarcasm_score": s_score,
                "is_sarcastic": is_sarc,
                "needs_review": mark_needs_review(compound, is_sarc),
            })

    if total == 0:
        return {"error": "No comments found or video URL invalid.", "video_info": video_info}

    freq = Counter(words)
    top_words = [{"word": w, "count": c} for w, c in freq.most_common(20)]

    return {
        "video_info": video_info,
        "totals": {
            "total_comments": total,
            "positive": pos,
            "negative": neg,
            "neutral": neu,
            "sarcastic": sarcastic,
        },
        "percentages": {
            "positive_pct": round(pos * 100 / total, 1),
            "negative_pct": round(neg * 100 / total, 1),
            "neutral_pct": round(neu * 100 / total, 1),
            "sarcastic_pct": round(sarcastic * 100 / total, 1),
        },
        "top_words": top_words,
        "sample_comments": sample_comments,
    }
