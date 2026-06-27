// Global state
let releaseEntries = [];
let simulatedTweets = [];
let currentFilterType = 'all';
let currentSearchQuery = '';

// Default Tweet templates generator
const TWEET_TEMPLATES = {
    'Feature': (text, date, link) => {
        const cleanedText = cleanTextForTweet(text);
        return `🚀 New Feature in BigQuery (${date})!\n\n"${cleanedText}"\n\nRead more: ${link} #GCP #BigQuery`;
    },
    'Change': (text, date, link) => {
        const cleanedText = cleanTextForTweet(text);
        return `⚙️ BigQuery Change (${date})\n\n"${cleanedText}"\n\nDetails: ${link} #GCP #BigQuery`;
    },
    'Deprecation': (text, date, link) => {
        const cleanedText = cleanTextForTweet(text);
        return `⚠️ BigQuery Deprecation (${date})\n\n"${cleanedText}"\n\nDetails: ${link} #GCP #BigQuery`;
    },
    'General': (text, date, link) => {
        const cleanedText = cleanTextForTweet(text);
        return `📝 BigQuery Update (${date})\n\n"${cleanedText}"\n\nLink: ${link} #GCP #BigQuery`;
    }
};

// State for active tweet modal
let activeUpdateForTweet = null;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize elements
    initElements();
    
    // Initialize theme
    initTheme();
    
    // Fetch initial data
    fetchReleases();
    fetchTweets();
});

// Cache elements
let elements = {};
function initElements() {
    elements = {
        btnRefresh: document.getElementById('btnRefresh'),
        refreshIcon: document.getElementById('refreshIcon'),
        cacheIndicator: document.getElementById('cacheIndicator'),
        searchInput: document.getElementById('searchInput'),
        filterChips: document.getElementById('filterChips'),
        loadingState: document.getElementById('loadingState'),
        feedSection: document.getElementById('feedSection'),
        feedTimeline: document.getElementById('feedTimeline'),
        emptyState: document.getElementById('emptyState'),
        btnClearFilters: document.getElementById('btnClearFilters'),
        tweetsHistory: document.getElementById('tweetsHistory'),
        btnExportCSV: document.getElementById('btnExportCSV'),
        btnThemeToggle: document.getElementById('btnThemeToggle'),
        themeIcon: document.getElementById('themeIcon'),
        
        // Modal
        tweetModal: document.getElementById('tweetModal'),
        btnModalClose: document.getElementById('btnModalClose'),
        btnModalCancel: document.getElementById('btnModalCancel'),
        modalSourceBadge: document.getElementById('modalSourceBadge'),
        modalSourceDate: document.getElementById('modalSourceDate'),
        modalSourceSnippet: document.getElementById('modalSourceSnippet'),
        tweetTextarea: document.getElementById('tweetTextarea'),
        charCount: document.getElementById('charCount'),
        charCounter: document.getElementById('charCounter'),
        btnResetTweetText: document.getElementById('btnResetTweetText'),
        btnSimulateTweet: document.getElementById('btnSimulateTweet'),
        btnRealTweet: document.getElementById('btnRealTweet'),
        
        // Container
        toastContainer: document.getElementById('toastContainer')
    };

    // Event listeners
    elements.btnRefresh.addEventListener('click', () => fetchReleases(true));
    elements.searchInput.addEventListener('input', handleSearchInput);
    elements.btnClearFilters.addEventListener('click', resetFilters);
    elements.btnExportCSV.addEventListener('click', exportToCSV);
    elements.btnThemeToggle.addEventListener('click', toggleTheme);
    
    // Filter chips
    elements.filterChips.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            const selectedChip = e.currentTarget;
            elements.filterChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            selectedChip.classList.add('active');
            currentFilterType = selectedChip.dataset.type;
            filterAndRenderTimeline();
        });
    });

    // Modal events
    elements.btnModalClose.addEventListener('click', closeModal);
    elements.btnModalCancel.addEventListener('click', closeModal);
    elements.tweetTextarea.addEventListener('input', handleTweetTextChange);
    elements.btnResetTweetText.addEventListener('click', restoreDefaultTweetTemplate);
    elements.btnSimulateTweet.addEventListener('click', submitSimulatedTweet);
    elements.btnRealTweet.addEventListener('click', shareRealTweet);
    
    // Close modal on clicking overlay
    elements.tweetModal.addEventListener('click', (e) => {
        if (e.target === elements.tweetModal) closeModal();
    });
}

// Initialize theme from localStorage
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        elements.themeIcon.className = 'fa-solid fa-moon';
    } else {
        document.body.classList.remove('light-theme');
        elements.themeIcon.className = 'fa-solid fa-sun';
    }
}

// Toggle theme between dark and light mode
function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    if (isLight) {
        localStorage.setItem('theme', 'light');
        elements.themeIcon.className = 'fa-solid fa-moon';
        showToast('Theme Changed', 'Switched to Light Mode', 'info');
    } else {
        localStorage.setItem('theme', 'dark');
        elements.themeIcon.className = 'fa-solid fa-sun';
        showToast('Theme Changed', 'Switched to Dark Mode', 'info');
    }
}

// Clean text to fit better inside a tweet quote
function cleanTextForTweet(text) {
    if (!text) return '';
    // Strip double spaces and double newlines
    let clean = text.replace(/\s+/g, ' ').trim();
    // Truncate to make sure total tweet doesn't exceed 280
    // Total template text without body is around ~100 characters. So body can be ~150 chars.
    if (clean.length > 150) {
        clean = clean.substring(0, 147) + '...';
    }
    return clean;
}

// Fetch Releases from Backend
async function fetchReleases(force = false) {
    toggleLoading(true, force);
    try {
        const url = `/api/releases${force ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (data.status === 'success') {
            releaseEntries = data.entries;
            updateCacheIndicator(data.source);
            filterAndRenderTimeline();
            if (force) {
                showToast('Success', 'Release notes fetched fresh from Google Cloud!', 'success');
            }
        } else {
            throw new Error(data.message || 'Unknown error fetching release notes');
        }
    } catch (error) {
        console.error('Error fetching release notes:', error);
        showToast('Fetch Failed', error.message || 'Could not fetch release notes.', 'error');
        // If we have previous releaseEntries, keep displaying them
        if (releaseEntries.length === 0) {
            showEmptyState(true);
        }
    } finally {
        toggleLoading(false);
    }
}

// Fetch Simulated Tweets from Backend
async function fetchTweets() {
    try {
        const response = await fetch('/api/tweets');
        if (response.ok) {
            const data = await response.json();
            if (data.status === 'success') {
                simulatedTweets = data.tweets;
                renderTweetHistory();
            }
        }
    } catch (e) {
        console.error('Error loading tweet history:', e);
    }
}

// Handle loading states
function toggleLoading(isLoading, force = false) {
    if (isLoading) {
        if (force) {
            elements.refreshIcon.classList.add('spinning');
            elements.btnRefresh.disabled = true;
        } else {
            elements.loadingState.style.display = 'flex';
            elements.feedSection.style.display = 'none';
            elements.emptyState.style.display = 'none';
        }
    } else {
        elements.refreshIcon.classList.remove('spinning');
        elements.btnRefresh.disabled = false;
        elements.loadingState.style.display = 'none';
    }
}

// Update the cache indicator UI badge
function updateCacheIndicator(source) {
    const indicator = elements.cacheIndicator;
    const textSpan = indicator.querySelector('span');
    const icon = indicator.querySelector('i');
    
    if (source === 'cache') {
        indicator.className = 'cache-indicator';
        textSpan.textContent = 'Cached Data (10m)';
        icon.className = 'fa-solid fa-clock-rotate-left';
    } else {
        indicator.className = 'cache-indicator fresh';
        textSpan.textContent = 'Live Feed';
        icon.className = 'fa-solid fa-circle-check';
    }
}

// Handle Search Text Input with Debounce
let searchTimeout;
function handleSearchInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        currentSearchQuery = elements.searchInput.value.trim().toLowerCase();
        filterAndRenderTimeline();
    }, 250);
}

// Reset Filters
function resetFilters() {
    elements.searchInput.value = '';
    currentSearchQuery = '';
    elements.filterChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    elements.filterChips.querySelector('[data-type="all"]').classList.add('active');
    currentFilterType = 'all';
    filterAndRenderTimeline();
}

// Get currently filtered list of updates
function getFilteredUpdates() {
    const filtered = [];
    releaseEntries.forEach(entry => {
        entry.updates.forEach(update => {
            if (currentFilterType !== 'all' && update.type.toLowerCase() !== currentFilterType.toLowerCase()) {
                return;
            }
            if (currentSearchQuery) {
                const textMatch = update.text.toLowerCase().includes(currentSearchQuery);
                const typeMatch = update.type.toLowerCase().includes(currentSearchQuery);
                const dateMatch = entry.date.toLowerCase().includes(currentSearchQuery);
                if (!textMatch && !typeMatch && !dateMatch) return;
            }
            filtered.push({
                date: entry.date,
                type: update.type,
                text: update.text,
                link: entry.link
            });
        });
    });
    return filtered;
}

// Export filtered updates to CSV
function exportToCSV() {
    const updates = getFilteredUpdates();
    if (updates.length === 0) {
        showToast('Export Failed', 'No release notes match the current filters to export.', 'error');
        return;
    }
    
    // Create CSV header
    let csvRows = ['"Date","Type","Content","Link"'];
    
    // Add data rows
    updates.forEach(item => {
        const date = item.date.replace(/"/g, '""');
        const type = item.type.replace(/"/g, '""');
        const text = item.text.replace(/"/g, '""');
        const link = item.link.replace(/"/g, '""');
        
        csvRows.push(`"${date}","${type}","${text}","${link}"`);
    });
    
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bigquery_release_notes_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    
    link.click();
    document.body.removeChild(link);
    showToast('Export Success', `Exported ${updates.length} release notes to CSV!`, 'success');
}

// Filter release entries and render timeline
function filterAndRenderTimeline() {
    elements.feedTimeline.innerHTML = '';
    let matchCount = 0;
    
    // Iterate through entries (grouped by date)
    releaseEntries.forEach(entry => {
        const filteredUpdates = entry.updates.filter(update => {
            // 1. Type Filter
            if (currentFilterType !== 'all') {
                if (update.type.toLowerCase() !== currentFilterType.toLowerCase()) {
                    return false;
                }
            }
            
            // 2. Search Text Filter
            if (currentSearchQuery) {
                const textMatch = update.text.toLowerCase().includes(currentSearchQuery);
                const typeMatch = update.type.toLowerCase().includes(currentSearchQuery);
                const dateMatch = entry.date.toLowerCase().includes(currentSearchQuery);
                return textMatch || typeMatch || dateMatch;
            }
            
            return true;
        });
        
        if (filteredUpdates.length > 0) {
            matchCount += filteredUpdates.length;
            renderTimelineGroup(entry.date, entry.link, filteredUpdates, entry.id);
        }
    });

    if (matchCount === 0) {
        elements.feedSection.style.display = 'none';
        showEmptyState(true);
    } else {
        showEmptyState(false);
        elements.feedSection.style.display = 'block';
    }
}

function showEmptyState(show) {
    if (show) {
        elements.emptyState.style.display = 'block';
    } else {
        elements.emptyState.style.display = 'none';
    }
}

// Render a specific date group in the timeline
function renderTimelineGroup(date, link, updates, entryId) {
    const group = document.createElement('div');
    group.className = 'timeline-group';
    
    group.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-date-header">
            <h3>${date}</h3>
            <span class="timeline-count-badge">${updates.length} update${updates.length > 1 ? 's' : ''}</span>
        </div>
        <div class="timeline-updates-container"></div>
    `;
    
    const container = group.querySelector('.timeline-updates-container');
    
    updates.forEach((update, index) => {
        const card = document.createElement('div');
        const updateTypeClass = `type-${update.type.toLowerCase()}`;
        const badgeClass = `badge-${update.type.toLowerCase()}`;
        
        card.className = `update-card ${updateTypeClass}`;
        
        // Generate a unique ID for this specific sub-update item
        const updateUniqueId = `${entryId}_${index}`;
        
        card.innerHTML = `
            <div class="card-header">
                <div class="card-type-indicator">
                    <span class="card-badge ${badgeClass}">${update.type}</span>
                </div>
                <div class="card-actions">
                    <button class="btn-card-action btn-copy" title="Copy text to clipboard">
                        <i class="fa-regular fa-copy"></i>
                    </button>
                    <button class="btn-card-action btn-tweet" title="Share on Twitter / X">
                        <i class="fa-brands fa-x-twitter"></i>
                    </button>
                </div>
            </div>
            <div class="card-body">
                ${update.html}
            </div>
        `;
        
        // Add action handlers
        card.querySelector('.btn-copy').addEventListener('click', () => {
            copyToClipboard(update.text);
        });
        
        card.querySelector('.btn-tweet').addEventListener('click', () => {
            openTweetModal({
                id: updateUniqueId,
                date: date,
                type: update.type,
                text: update.text,
                link: link
            });
        });
        
        container.appendChild(card);
    });
    
    elements.feedTimeline.appendChild(group);
}

// Copy Text utility
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied', 'Update text copied to clipboard!', 'info');
    }).catch(err => {
        console.error('Clipboard copy failed:', err);
        showToast('Error', 'Failed to copy text.', 'error');
    });
}

// Modal open
function openTweetModal(update) {
    activeUpdateForTweet = update;
    
    // Set UI preview
    elements.modalSourceBadge.textContent = update.type;
    elements.modalSourceBadge.className = `badge badge-${update.type.toLowerCase()}`;
    elements.modalSourceDate.textContent = update.date;
    elements.modalSourceSnippet.textContent = update.text;
    
    // Load default template text
    restoreDefaultTweetTemplate();
    
    // Show Modal
    elements.tweetModal.classList.add('active');
    elements.tweetTextarea.focus();
}

// Modal close
function closeModal() {
    elements.tweetModal.classList.remove('active');
    activeUpdateForTweet = null;
}

// Textarea input handler: check char limits
function handleTweetTextChange() {
    const text = elements.tweetTextarea.value;
    const len = text.length;
    elements.charCount.textContent = len;
    
    // Counter styling
    elements.charCounter.className = 'character-counter';
    if (len > 240 && len <= 280) {
        elements.charCounter.classList.add('warning');
    } else if (len > 280) {
        elements.charCounter.classList.add('danger');
    }
    
    // Disable action buttons if invalid
    const isInvalid = (len === 0 || len > 280);
    elements.btnSimulateTweet.disabled = isInvalid;
    elements.btnRealTweet.disabled = isInvalid;
}

// Load default tweet template
function restoreDefaultTweetTemplate() {
    if (!activeUpdateForTweet) return;
    
    const generator = TWEET_TEMPLATES[activeUpdateForTweet.type] || TWEET_TEMPLATES['General'];
    const templateText = generator(activeUpdateForTweet.text, activeUpdateForTweet.date, activeUpdateForTweet.link);
    
    elements.tweetTextarea.value = templateText;
    handleTweetTextChange();
}

// Share on X (opens Twitter web intent)
function shareRealTweet() {
    if (!activeUpdateForTweet) return;
    const text = elements.tweetTextarea.value;
    if (text.length === 0 || text.length > 280) return;
    
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(tweetUrl, '_blank', 'width=550,height=420');
    
    // Also save simulation when user tweets, to log it in history automatically
    submitSimulatedTweet(true);
}

// Submit simulated tweet to Flask backend API
async function submitSimulatedTweet(silent = false) {
    if (!activeUpdateForTweet) return;
    const text = elements.tweetTextarea.value;
    if (text.length === 0 || text.length > 280) return;
    
    try {
        const response = await fetch('/api/tweets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                update_id: activeUpdateForTweet.id,
                date: activeUpdateForTweet.date,
                type: activeUpdateForTweet.type
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.status === 'success') {
                simulatedTweets = data.tweets;
                renderTweetHistory();
                closeModal();
                if (!silent) {
                    showToast('Simulation Saved', 'Broadcast successfully saved to simulation log!', 'success');
                } else {
                    showToast('Broadcasting Intent', 'Twitter Composer opened. Log updated!', 'success');
                }
            } else {
                throw new Error(data.message || 'Error saving simulation');
            }
        }
    } catch (e) {
        console.error('Error saving simulated tweet:', e);
        showToast('Error', 'Failed to save simulated tweet.', 'error');
    }
}

// Format relative date for tweet history
function formatRelativeTime(dateString) {
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        
        return date.toLocaleDateString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'});
    } catch (e) {
        return '';
    }
}

// Render Tweet History in Sidebar
function renderTweetHistory() {
    const historyContainer = elements.tweetsHistory;
    historyContainer.innerHTML = '';
    
    if (simulatedTweets.length === 0) {
        historyContainer.innerHTML = `
            <div class="empty-history">
                <i class="fa-regular fa-paper-plane"></i>
                <p>No tweets broadcasted yet.</p>
                <span>Click "Tweet" on any release update to publish a mockup or actual tweet.</span>
            </div>
        `;
        return;
    }
    
    simulatedTweets.forEach(tweet => {
        const card = document.createElement('div');
        card.className = 'tweet-log-card';
        
        const badgeClass = `badge-${tweet.type.toLowerCase()}`;
        const relativeTime = formatRelativeTime(tweet.timestamp);
        
        // Link to original card if clicked (simple hash locator)
        card.innerHTML = `
            <div class="tweet-log-header">
                <div class="tweet-log-author">
                    <div class="tweet-log-avatar">
                        <i class="fa-brands fa-x-twitter"></i>
                    </div>
                    <div>
                        <span class="tweet-log-name">BQ Broadcast</span>
                        <span class="tweet-log-handle">@bq_release</span>
                    </div>
                </div>
                <span class="tweet-log-time">${relativeTime}</span>
            </div>
            <div class="tweet-log-body">${escapeHTML(tweet.text)}</div>
            <div class="tweet-log-footer">
                <span class="tweet-source-badge ${badgeClass}">${tweet.type}</span>
                <div class="tweet-log-actions">
                    <span><i class="fa-regular fa-heart"></i></span>
                    <span><i class="fa-regular fa-comment"></i></span>
                    <span><i class="fa-solid fa-arrow-up-from-bracket"></i></span>
                </div>
            </div>
        `;
        
        historyContainer.appendChild(card);
    });
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// Show Toast feedback
function showToast(title, message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconClass = 'fa-solid fa-circle-info';
    if (type === 'success') iconClass = 'fa-solid fa-circle-check';
    if (type === 'error') iconClass = 'fa-solid fa-circle-exclamation';
    
    toast.innerHTML = `
        <i class="${iconClass} toast-icon"></i>
        <div class="toast-content">
            <p>${title}</p>
            <span>${message}</span>
        </div>
        <button class="toast-close">&times;</button>
    `;
    
    // Close toast button event
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        setTimeout(() => toast.remove(), 300);
    });
    
    elements.toastContainer.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100px)';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}
