**YouTube Comment Checker**  
Interactive YouTube comment sentiment analysis with a modern galaxy-themed UI.

This project performs **sentiment analysis**, **sarcasm detection**, and **top word frequency extraction** from YouTube video comments using a custom FastAPI backend (local or cloud) and a React-based frontend (deployed on GitHub Pages).

---

Features

 **What the app can do**
- Accept any YouTube video link  
- Show:
  - Total comments
  - Positive / Negative / Neutral percentages
  - Sarcastic comments detection
  - Most frequent words (word frequency)
  - Sample analyzed comments  
- Background animated galaxy UI  
- Clean and responsive design  
- FastAPI backend for:
  - Sentiment analysis (VADER)
  - Comment scraping
  - Data processing

---

**Frontend (React)**
The frontend is built using:

- React  
- Fetch API  
- CSS / Galaxy-style background animations  
- Responsive layout  

The frontend is deployed on **GitHub Pages**.

**Live Demo**
https://alenabygith.github.io/youtube-comment-checker/


---

**Backend (FastAPI)**
The backend performs:

- YouTube comment scraping  
- Text cleaning  
- Sentiment scoring (VADER)  
- Sarcasm detection  
- Comment statistics  
- Word frequency extraction  

**Running Backend Locally**
```bash
cd backend
venv\Scripts\activate
uvicorn main:app --reload

http://127.0.0.1:8000


