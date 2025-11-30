import { useState } from "react";
import "./App.css";
import {
  PieChart,
  Pie,
  ResponsiveContainer,
  Tooltip,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const BACKEND_URL = "https://youtube-comment-checker.onrender.com/analyze_video";


// helper to extract ID from different YouTube URL formats
function extractVideoId(url) {
  const short = url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
  if (short) return short[1];

  const watch = url.match(/[?&]v=([A-Za-z0-9_-]{6,})/);
  if (watch) return watch[1];

  const shorts = url.match(/shorts\/([A-Za-z0-9_-]{6,})/);
  if (shorts) return shorts[1];

  return null;
}

function App() {
  const [url, setUrl] = useState("");
  const [data, setData] = useState(null);
  const [videoId, setVideoId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ---------- chart data ----------
  const totals = data?.totals;
  const pct = data?.percentages;

  const sentimentData = totals
    ? [
        { name: "Positive", value: totals.positive },
        { name: "Negative", value: totals.negative },
        { name: "Neutral", value: totals.neutral },
        { name: "Sarcastic", value: totals.sarcastic },
      ]
    : [];

  const topWordData =
    data?.top_words?.slice(0, 10).map((w) => ({
      name: w.word,
      value: w.count,
    })) || [];

  // ---------- main action ----------
  const handleAnalyze = async () => {
    if (!url.trim()) {
      setError("Please paste a YouTube URL.");
      return;
    }
    const id = extractVideoId(url.trim());
    setVideoId(id);

    try {
      setLoading(true);
      setError("");
      setData(null);

      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: url }),
      });

      if (!res.ok) {
        throw new Error("Backend error");
      }

      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
      }
    } catch (err) {
      setError("Something went wrong. Make sure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const info = data?.video_info;

  return (
    <div className="app-root">
      <div className="app-card">
        <div>
          <h1 className="app-title">🌌 YouTube Comment Checker</h1>
          <p className="app-subtitle">
            Paste any YouTube video link to see how its comments are reacting:
            positive, negative, neutral and sarcastic.
          </p>
        </div>

        <div className="input-row">
          <input
            className="url-input"
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button className="primary-btn" onClick={handleAnalyze}>
            Analyze
          </button>
        </div>
        <p className="helper-text">
          Make sure your FastAPI backend is running on 127.0.0.1:8000.
        </p>

        {loading && <p>Analyzing comments… this may take a few seconds.</p>}
        {error && <p className="error-text">{error}</p>}

        {data && !error && (
          <div className="main-grid">
            {/* LEFT: video + comments */}
            <div className="video-box">
              <p className="video-title">
                {info?.title || "Video details unavailable"}
              </p>
              <p className="video-meta">
                {info?.channel && <>Channel: {info.channel} · </>}
                {info?.views != null && (
                  <>Views: {info.views.toLocaleString()}</>
                )}
              </p>

              {videoId ? (
                <iframe
                  className="video-frame"
                  src={`https://www.youtube.com/embed/${videoId}`}
                  title="YouTube video player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <p className="helper-text">
                  Couldn’t extract video preview from this URL, but analysis
                  still worked.
                </p>
              )}

              <p className="section-title">Sample Comments</p>
              <div className="comment-list">
                {data.sample_comments?.map((c, idx) => (
                  <div key={idx} className="comment-item">
                    <div>{c.original}</div>
                    <div className="helper-text">
                      By {c.author || "Unknown"} · Sentiment: {c.sentiment} ·
                      score {c.compound.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT: stats + charts */}
            <div>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Total Comments</div>
                  <div className="stat-value">
                    {totals?.total_comments ?? "-"}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Positive</div>
                  <div className="stat-value">
                    {totals?.positive ?? 0} ({pct?.positive_pct ?? 0}%)
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Negative</div>
                  <div className="stat-value">
                    {totals?.negative ?? 0} ({pct?.negative_pct ?? 0}%)
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Neutral</div>
                  <div className="stat-value">
                    {totals?.neutral ?? 0} ({pct?.neutral_pct ?? 0}%)
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Sarcastic</div>
                  <div className="stat-value">
                    {totals?.sarcastic ?? 0} ({pct?.sarcastic_pct ?? 0}%)
                  </div>
                </div>
              </div>

              <p className="section-title">Top Words</p>
              <div>
                {data.top_words?.map((w, idx) => (
                  <span key={idx} className="word-chip">
                    {w.word} · {w.count}
                  </span>
                ))}
              </div>

              <p className="section-title">Charts</p>
              <div className="charts-grid">
                <div className="chart-box">
                  <p className="helper-text">Sentiment Distribution</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={sentimentData}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={80}
                        label
                      >
                        {sentimentData.map((entry, index) => (
                          <Cell key={`cell-${index}`} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-box">
                  <p className="helper-text">Top 10 Words</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={topWordData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        interval={0}
                        angle={-35}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
