# BigQuery Release Notes Hub & Broadcaster

A modern, responsive web application built with **Python Flask** on the server and vanilla **HTML5, CSS3, and JavaScript** on the client. The application fetches, parses, and formats official Google BigQuery release notes and integrates a built-in tweet composer to draft and share updates to Twitter/X.

## Key Features

- **Granular Atom Feed Parsing**: Google aggregates daily release updates into a single block. This app parses the feed XML and splits it into independent, clear-cut release updates (`Feature`, `Change`, `Deprecation`, `General`).
- **Local Smart Cache**: Uses a 10-minute file-based cache (`feed_cache.json`) to minimize network bandwidth and prevent rate limiting from Google's servers. A refresh button allows manual bypass.
- **Search & Interactive Filters**: Real-time filtering by update types via styled chip selectors and inline search inputs.
- **Interactive Tweet Composer**: Automatically pre-fills optimized tweet templates depending on the update type, tracks character limits (280 characters max) with color-coded warnings, and links to X's Web Intent composer.
- **Broadcast Logs**: Stores and displays a live sidebar timeline of all simulated and shared tweets.

---

## File Structure

```
Practice1/
├── app.py                  # Python Flask server (feed fetching, XML/HTML parsing, logging, caching)
├── templates/
│   └── index.html          # HTML structure, filter chips, modal composer, and layout
├── static/
│   ├── css/
│   │   └── style.css       # Dark-theme glassmorphism CSS, animations, responsive design
│   └── js/
│       └── app.js          # Main client-side scripts, API handling, template composers, search/filter logic
├── .gitignore              # Ignores venv, bytecode pyc files, and local caches
└── README.md               # Project documentation
```

---

## Getting Started

### Prerequisites
* Python 3.12+ installed (already bundled in the workspace's local virtual environment `venv`).

### Installation & Run

1. **Activate the Virtual Environment & Run the Server**:
   Open a PowerShell window in the project's root folder and run:
   ```powershell
   .\venv\Scripts\python.exe app.py
   ```
   *The Flask dev server will boot up in debug mode on port 5000.*

2. **Open the Application**:
   Navigate to **[http://127.0.0.1:5000](http://127.0.0.1:5000)** in your web browser.

---

## How It Works Under the Hood

### Backend (Server)
* **XML Feed Reading**: Uses `xml.etree.ElementTree` with namespaces to isolate Atom `<entry>` tags.
* **Update Deconstructing**: Uses `BeautifulSoup` inside [app.py](file:///C:/agy-cli/Practice1/app.py) to loop through the content HTML and split it under every `<h3>` heading into a JSON list.
* **Local Log Storage**: Simulated tweets are appended to `sent_tweets.json` which is read by the client on page load.

### Frontend (Client)
* **Real-time Filter & Search**: Runs keyup and click listeners in [app.js](file:///C:/agy-cli/Practice1/static/js/app.js) to show or hide cards dynamically without reloading pages.
* **X/Twitter Intent Integration**: Opens `https://twitter.com/intent/tweet?text=...` in a popup window with URL-encoded text.
