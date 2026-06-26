from flask import Flask, jsonify, render_template, request
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
import datetime
import os
import json

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_FILE = "feed_cache.json"
CACHE_DURATION = datetime.timedelta(minutes=10)

# Simulated sent tweets file
TWEETS_FILE = "sent_tweets.json"

def get_cached_data():
    """Retrieve data from cache if valid, otherwise fetch fresh."""
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
            cached_time = datetime.datetime.fromisoformat(cache_data['fetched_at'])
            if datetime.datetime.now() - cached_time < CACHE_DURATION:
                return cache_data['entries']
        except Exception:
            pass
    return None

def save_to_cache(entries):
    """Save parsed entries to local cache file."""
    try:
        cache_data = {
            'fetched_at': datetime.datetime.now().isoformat(),
            'entries': entries
        }
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

def load_tweets():
    """Load simulated tweets from file."""
    if os.path.exists(TWEETS_FILE):
        try:
            with open(TWEETS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return []

def save_tweet(tweet_data):
    """Save a simulated tweet."""
    tweets = load_tweets()
    tweets.insert(0, tweet_data)  # Add new tweet to top
    # Limit to last 50 tweets
    tweets = tweets[:50]
    try:
        with open(TWEETS_FILE, 'w', encoding='utf-8') as f:
            json.dump(tweets, f, ensure_ascii=False, indent=2)
    except Exception:
        pass
    return tweets

def fetch_and_parse_feed(force_refresh=False):
    """Fetch release notes XML and parse into structured updates."""
    if not force_refresh:
        cached = get_cached_data()
        if cached:
            return cached, "cache"

    response = requests.get(FEED_URL, timeout=15)
    response.raise_for_status()
    xml_data = response.text
    
    root = ET.fromstring(xml_data)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    entries = []
    for entry in root.findall('atom:entry', ns):
        title = entry.find('atom:title', ns).text
        id_val = entry.find('atom:id', ns).text
        updated = entry.find('atom:updated', ns).text
        link_elem = entry.find("atom:link[@rel='alternate']", ns)
        link = link_elem.attrib['href'] if link_elem is not None else ''
        content_elem = entry.find('atom:content', ns)
        content_html = content_elem.text if content_elem is not None else ''
        
        # Parse XML content HTML into individual updates
        soup = BeautifulSoup(content_html, 'html.parser')
        updates = []
        
        current_type = "General"
        current_html = []
        current_text = []
        
        for child in soup.contents:
            if child.name == 'h3':
                # Save previous update if exists
                if current_html or current_text:
                    updates.append({
                        'type': current_type,
                        'html': ''.join(current_html),
                        'text': '\n'.join(current_text).strip()
                    })
                current_type = child.get_text().strip()
                current_html = []
                current_text = []
            elif child.name:
                current_html.append(str(child))
                txt = child.get_text().strip()
                if txt:
                    current_text.append(txt)
            else:
                val = str(child).strip()
                if val:
                    current_html.append(val)
                    current_text.append(val)
                    
        # Append the last update
        if current_html or current_text:
            updates.append({
                'type': current_type,
                'html': ''.join(current_html),
                'text': '\n'.join(current_text).strip()
            })
            
        entries.append({
            'date': title,
            'id': id_val,
            'updated': updated,
            'link': link,
            'updates': updates
        })
        
    save_to_cache(entries)
    return entries, "fresh"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases', methods=['GET'])
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    try:
        entries, source = fetch_and_parse_feed(force_refresh=force_refresh)
        return jsonify({
            'status': 'success',
            'source': source,
            'count': len(entries),
            'entries': entries
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/tweets', methods=['GET', 'POST'])
def handle_tweets():
    if request.method == 'POST':
        data = request.json or {}
        text = data.get('text', '').strip()
        update_id = data.get('update_id', '').strip()
        date = data.get('date', '').strip()
        update_type = data.get('type', '').strip()
        
        if not text:
            return jsonify({'status': 'error', 'message': 'Tweet text is required'}), 400
            
        tweet = {
            'id': datetime.datetime.now().strftime('%Y%m%d%H%M%S%f'),
            'text': text,
            'update_id': update_id,
            'date': date,
            'type': update_type,
            'timestamp': datetime.datetime.now().isoformat()
        }
        tweets = save_tweet(tweet)
        return jsonify({'status': 'success', 'tweets': tweets})
    else:
        return jsonify({'status': 'success', 'tweets': load_tweets()})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
