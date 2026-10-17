/* ============================================================
   Deep Learning Knowledge Hub — Main Script
   Handles dynamic homepage rendering, live search, topic creation,
   backup import/export, and UI interactions.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    initHeader();
    initMobileMenu();
    initDynamicHub();
    initSearch();
    initBackupHandlers();
    initHomeTopicModal();
    initKaTeX();
});

/* ---- Header scroll effect ---- */
function initHeader() {
    const header = document.getElementById('site-header');
    if (!header) return;
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 10) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }, { passive: true });
}

/* ---- Mobile menu toggle ---- */
function initMobileMenu() {
    const btn = document.getElementById('mobile-menu-btn');
    const nav = document.getElementById('main-nav');
    if (!btn || !nav) return;
    
    btn.addEventListener('click', () => {
        nav.classList.toggle('open');
        btn.classList.toggle('active');
    });

    nav.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            nav.classList.remove('open');
            btn.classList.remove('active');
        });
    });
}

/* ---- Dynamic Homepage Rendering ---- */
function initDynamicHub() {
    renderStats();
    renderTopicsGrid();
    renderRecentPosts();
}

function renderStats() {
    if (typeof HubStore === 'undefined') return;
    const stats = HubStore.getStats();

    const elTopics = document.getElementById('stat-topics');
    const elPosts = document.getElementById('stat-posts');
    const elCode = document.getElementById('stat-code');
    const elDiagrams = document.getElementById('stat-diagrams');

    if (elTopics) elTopics.textContent = stats.topicsCount;
    if (elPosts) elPosts.textContent = stats.articlesCount;
    if (elCode) elCode.textContent = stats.codeCount;
    if (elDiagrams) elDiagrams.textContent = stats.diagramsCount;
}

function renderTopicsGrid() {
    const grid = document.getElementById('topics-grid');
    if (!grid || typeof HubStore === 'undefined') return;

    const topics = HubStore.getTopics();
    const articles = HubStore.getArticles();

    if (topics.length === 0) {
        grid.innerHTML = `
            <div class="empty-state-card" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">✨</div>
                <h3>Your Knowledge Hub is Blank & Ready</h3>
                <p>No pre-defined topics! You can add your own custom deep learning topics and chapters whenever you want.</p>
                <div class="empty-actions">
                    <button type="button" class="btn btn-primary" id="btn-empty-add-topic">
                        <span>+ Create Your First Topic</span>
                    </button>
                </div>
            </div>
        `;

        document.getElementById('btn-empty-add-topic')?.addEventListener('click', openHomeTopicModal);
        return;
    }

    let html = '';
    topics.forEach((topic, idx) => {
        const topicArticles = articles.filter(a => a.topicId === topic.id || a.topicSlug === topic.slug);
        const count = topicArticles.length;
        const countText = count === 1 ? '1 note' : `${count} notes`;
        const numStr = (idx + 1).toString().padStart(2, '0');

        html += `
            <a href="topics.html?topic=${topic.slug}" class="topic-card" id="topic-card-${topic.slug}">
                <div class="topic-number">${numStr}</div>
                <div class="topic-icon">${topic.icon || '🧠'}</div>
                <h3 class="topic-title">${escapeHtml(topic.name)}</h3>
                <p class="topic-desc">${escapeHtml(topic.description || 'Custom deep learning topic notes and code.')}</p>
                <div class="topic-meta">
                    <span class="topic-tag">${escapeHtml(topic.tag || 'Topic')}</span>
                    <span class="topic-count">${countText}</span>
                </div>
                <div class="topic-arrow">→</div>
            </a>
        `;
    });

    // Add a trailing "+ Add Topic" action card
    html += `
        <div class="topic-card topic-card-add" id="card-add-topic-trigger" role="button" tabindex="0">
            <div class="add-card-inner">
                <div class="add-card-icon">+</div>
                <h3 class="add-card-title">Add New Topic</h3>
                <p class="add-card-desc">Create another category or chapter for your deep learning research.</p>
            </div>
        </div>
    `;

    grid.innerHTML = html;

    document.getElementById('card-add-topic-trigger')?.addEventListener('click', openHomeTopicModal);
}

function renderRecentPosts() {
    const list = document.getElementById('posts-list');
    if (!list || typeof HubStore === 'undefined') return;

    const articles = HubStore.getArticles();

    if (articles.length === 0) {
        list.innerHTML = `
            <div class="empty-state-card">
                <div class="empty-state-icon">📝</div>
                <h3>No Research Notes Added Yet</h3>
                <p>Click the button below to open a blank writing page where you can write formulas, add code, attach diagrams, and publish to GitHub!</p>
                <div class="empty-actions">
                    <a href="editor.html" class="btn btn-primary">
                        <span>+ Open Blank Note Editor</span>
                    </a>
                </div>
            </div>
        `;
        return;
    }

    // Show up to 6 recent articles
    const recent = articles.slice(0, 6);
    let html = '';

    recent.forEach(art => {
        let day = '17';
        let month = 'Oct';
        if (art.date) {
            try {
                const d = new Date(art.date + 'T00:00:00');
                day = d.getDate().toString();
                month = d.toLocaleString('en-US', { month: 'short' });
            } catch (e) {}
        }

        const tagsHtml = (art.tags || []).slice(0, 4).map(t => `<span class="mini-tag">#${escapeHtml(t)}</span>`).join('');
        const diagramBadge = art.diagram ? `<span class="mini-tag tag-diagram">📐 diagram</span>` : '';

        html += `
            <a href="article.html?id=${art.id}" class="post-card" id="post-${art.id}">
                <div class="post-date">
                    <span class="post-day">${day}</span>
                    <span class="post-month">${month}</span>
                </div>
                <div class="post-content">
                    <div class="post-category">${escapeHtml(art.topicName || 'General')}</div>
                    <h3 class="post-title">${escapeHtml(art.title)}</h3>
                    <p class="post-excerpt">${escapeHtml(art.excerpt || '')}</p>
                    <div class="post-tags">
                        ${tagsHtml}
                        ${diagramBadge}
                    </div>
                </div>
                <div class="post-arrow">→</div>
            </a>
        `;
    });

    list.innerHTML = html;
}

/* ---- Home Topic Creation Modal ---- */
function initHomeTopicModal() {
    const modal = document.getElementById('modal-home-topic');
    const btnOpen = document.getElementById('btn-modal-create-topic');
    const btnHeaderOpen = document.getElementById('btn-header-create-topic');
    const btnClose = document.getElementById('btn-close-home-topic-modal');
    const btnCancel = document.getElementById('btn-cancel-home-topic-modal');
    const btnSave = document.getElementById('btn-save-home-topic');

    if (!modal) return;

    btnOpen?.addEventListener('click', openHomeTopicModal);
    btnHeaderOpen?.addEventListener('click', openHomeTopicModal);
    btnClose?.addEventListener('click', closeHomeTopicModal);
    btnCancel?.addEventListener('click', closeHomeTopicModal);

    btnSave?.addEventListener('click', () => {
        const name = document.getElementById('home-topic-name').value.trim();
        if (!name) {
            alert('Please enter a topic name');
            return;
        }

        const icon = document.getElementById('home-topic-icon').value.trim() || '🧠';
        const tag = document.getElementById('home-topic-tag').value.trim() || 'Topic';
        const desc = document.getElementById('home-topic-desc').value.trim();

        HubStore.saveTopic({ name, icon, tag, description: desc });
        closeHomeTopicModal();
        renderStats();
        renderTopicsGrid();
    });
}

function openHomeTopicModal() {
    const modal = document.getElementById('modal-home-topic');
    if (modal) {
        modal.classList.add('active');
        document.getElementById('home-topic-name')?.focus();
    }
}

function closeHomeTopicModal() {
    const modal = document.getElementById('modal-home-topic');
    if (modal) {
        modal.classList.remove('active');
        const nameInput = document.getElementById('home-topic-name');
        const descInput = document.getElementById('home-topic-desc');
        if (nameInput) nameInput.value = '';
        if (descInput) descInput.value = '';
    }
}

/* ---- Backup Export & Import ---- */
function initBackupHandlers() {
    const btnExport = document.getElementById('btn-export-backup');
    const fileImport = document.getElementById('file-import-backup');

    btnExport?.addEventListener('click', () => {
        HubStore.exportBackup();
    });

    fileImport?.addEventListener('change', (e) => {
        if (!e.target.files || !e.target.files[0]) return;
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const res = HubStore.importBackup(evt.target.result);
                alert(`Backup restored successfully!\nTopics: ${res.topicsCount}\nArticles: ${res.articlesCount}`);
                window.location.reload();
            } catch (err) {
                alert(`Import failed: ${err.message}`);
            }
        };
        reader.readAsText(file);
    });
}

/* ---- Dynamic Search Functionality ---- */
function initSearch() {
    const searchBox = document.getElementById('search-box');
    const searchOverlay = document.getElementById('search-overlay');
    const searchInput = document.getElementById('search-overlay-input');
    const searchClose = document.getElementById('search-close');
    const searchResults = document.getElementById('search-results');
    const headerInput = document.getElementById('search-input');

    if (!searchOverlay) return;

    function openSearch() {
        searchOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        setTimeout(() => searchInput?.focus(), 100);
    }

    function closeSearch() {
        searchOverlay.classList.remove('active');
        document.body.style.overflow = '';
        if (searchInput) searchInput.value = '';
        if (searchResults) {
            searchResults.innerHTML = '<p class="search-hint">Type to search notes and code...</p>';
        }
    }

    if (searchBox) searchBox.addEventListener('click', openSearch);
    if (headerInput) headerInput.addEventListener('focus', (e) => {
        e.target.blur();
        openSearch();
    });

    if (searchClose) searchClose.addEventListener('click', closeSearch);
    searchOverlay.addEventListener('click', (e) => {
        if (e.target === searchOverlay) closeSearch();
    });

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && !isInputFocused())) {
            e.preventDefault();
            openSearch();
        }
        if (e.key === 'Escape') closeSearch();
    });

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (!query) {
                searchResults.innerHTML = '<p class="search-hint">Type to search notes and code...</p>';
                return;
            }
            performSearch(query, searchResults);
        });
    }
}

function performSearch(query, resultsContainer) {
    if (typeof HubStore === 'undefined') return;
    const articles = HubStore.getArticles();
    const topics = HubStore.getTopics();

    const matchedArticles = articles.filter(art => {
        const text = `${art.title} ${art.topicName} ${art.excerpt} ${(art.tags || []).join(' ')} ${art.content || ''}`.toLowerCase();
        return text.includes(query);
    });

    const matchedTopics = topics.filter(top => {
        const text = `${top.name} ${top.tag} ${top.description}`.toLowerCase();
        return text.includes(query);
    });

    if (matchedArticles.length === 0 && matchedTopics.length === 0) {
        resultsContainer.innerHTML = '<div class="no-results">No notes or topics found matching your query.</div>';
        return;
    }

    let html = '';

    if (matchedTopics.length > 0) {
        html += '<div class="search-group-title">Topics</div>';
        matchedTopics.forEach(top => {
            html += `
                <a href="topics.html?topic=${top.slug}" class="search-result-item">
                    <div class="result-category">Topic: ${escapeHtml(top.tag || 'Category')}</div>
                    <div class="result-title">${top.icon || '◈'} ${highlightMatch(top.name, query)}</div>
                    <div class="result-excerpt">${highlightMatch(top.description || '', query)}</div>
                </a>
            `;
        });
    }

    if (matchedArticles.length > 0) {
        html += '<div class="search-group-title">Research Notes</div>';
        matchedArticles.forEach(art => {
            html += `
                <a href="article.html?id=${art.id}" class="search-result-item">
                    <div class="result-category">${escapeHtml(art.topicName || 'General')}</div>
                    <div class="result-title">${highlightMatch(art.title, query)}</div>
                    <div class="result-excerpt">${highlightMatch(art.excerpt || '', query)}</div>
                </a>
            `;
        });
    }

    resultsContainer.innerHTML = html;
}

function highlightMatch(text, query) {
    if (!text) return '';
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<mark style="background: #FEF08A; padding: 0 2px; border-radius: 2px;">$1</mark>');
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(string) {
    if (!string) return '';
    return String(string)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function isInputFocused() {
    const el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

/* ---- KaTeX Math Rendering ---- */
function initKaTeX() {
    if (typeof renderMathInElement === 'function') {
        renderMathInElement(document.body, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false }
            ],
            throwOnError: false
        });
    }
}
