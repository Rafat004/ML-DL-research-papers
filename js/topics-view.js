/* ============================================================
   Deep Learning Knowledge Hub — Topics View Script
   Renders topic list or topic-specific articles dynamically.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    initTopicsView();
});

window.addEventListener('hub:synced', () => {
    initTopicsView();
});

function initTopicsView() {
    const container = document.getElementById('topics-view-container');
    const pageTitle = document.getElementById('topics-page-title');
    const pageDesc = document.getElementById('topics-page-desc');

    const urlParams = new URLSearchParams(window.location.search);
    const topicSlug = urlParams.get('topic');

    const modal = document.getElementById('modal-topics-page-topic');
    const btnAddTopic = document.getElementById('btn-topics-add-topic');
    const btnCloseModal = document.getElementById('btn-close-topic-page-modal');
    const btnCancelModal = document.getElementById('btn-cancel-topic-page-modal');
    const btnSaveTopic = document.getElementById('btn-save-topic-page-modal');

    // Modal controls
    btnAddTopic?.addEventListener('click', () => {
        modal.classList.add('active');
        document.getElementById('page-topic-name')?.focus();
    });

    const closeModal = () => modal.classList.remove('active');
    btnCloseModal?.addEventListener('click', closeModal);
    btnCancelModal?.addEventListener('click', closeModal);

    btnSaveTopic?.addEventListener('click', async () => {
        const name = document.getElementById('page-topic-name').value.trim();
        if (!name) {
            alert('Please enter a topic name');
            return;
        }

        const icon = document.getElementById('page-topic-icon').value.trim() || '🧠';
        const tag = document.getElementById('page-topic-tag').value.trim() || 'Category';
        const desc = document.getElementById('page-topic-desc').value.trim();
        const customHtml = (document.getElementById('page-topic-custom-html')?.value || '').trim();
        const htmlTitle = (document.getElementById('page-topic-html-title')?.value || '').trim();
        const htmlTag = (document.getElementById('page-topic-html-tag')?.value || '').trim();

        btnSaveTopic.disabled = true;
        btnSaveTopic.textContent = 'Saving...';
        try {
            const saved = await HubStore.saveTopic({ name, icon, tag, description: desc, customHtml, htmlTitle, htmlTag });
            closeModal();
            window.location.href = `topics.html?topic=${saved.slug}`;
        } catch (e) {
            alert(`Error saving topic: ${e.message}`);
        } finally {
            btnSaveTopic.disabled = false;
            btnSaveTopic.textContent = 'Create Topic';
        }
    });

    if (topicSlug) {
        // Render Single Topic Detail
        renderSingleTopic(topicSlug, container, pageTitle, pageDesc);
    } else {
        // Render All Topics Grid
        renderAllTopics(container, pageTitle, pageDesc);
    }
}

function renderAllTopics(container, pageTitle, pageDesc) {
    pageTitle.textContent = 'Topic Directory';
    pageDesc.textContent = 'Your custom deep learning research topics. Click any topic to view its articles, code, and architecture diagrams.';

    const topics = HubStore.getTopics();
    const articles = HubStore.getArticles();

    if (topics.length === 0) {
        container.innerHTML = `
            <div class="empty-state-card">
                <div class="empty-state-icon">✨</div>
                <h3>No Topics Created Yet</h3>
                <p>Click below to create your first topic category or jump right into the blank editor!</p>
                <div class="empty-actions">
                    <button type="button" class="btn btn-primary" onclick="document.getElementById('modal-topics-page-topic').classList.add('active')">
                        + Create First Topic
                    </button>
                    <a href="editor.html" class="btn btn-secondary">+ Write a Note</a>
                </div>
            </div>
        `;
        return;
    }

    let html = '<div class="topics-grid">';
    topics.forEach((topic, idx) => {
        const topicArticles = articles.filter(a => a.topicId === topic.id || a.topicSlug === topic.slug);
        const count = topicArticles.length;
        const isRoadmap = isRoadmapTopic(topic);
        const countText = isRoadmap 
            ? (count > 0 ? `${count} note${count === 1 ? '' : 's'} • 🗺️ Roadmap` : '🗺️ Interactive Roadmap') 
            : (count === 1 ? '1 note' : `${count} notes`);
        const numStr = (idx + 1).toString().padStart(2, '0');

        html += `
            <a href="topics.html?topic=${topic.slug}" class="topic-card">
                <button type="button" class="topic-card-delete-btn" data-topic-id="${topic.id}" data-topic-name="${escapeHtml(topic.name)}" title="Delete topic">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
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

    html += `
        <div class="topic-card topic-card-add" onclick="document.getElementById('modal-topics-page-topic').classList.add('active')" role="button" tabindex="0">
            <div class="add-card-inner">
                <div class="add-card-icon">+</div>
                <h3 class="add-card-title">Add New Topic</h3>
                <p class="add-card-desc">Create another category or chapter for your deep learning research.</p>
            </div>
        </div>
    `;

    html += '</div>';
    container.innerHTML = html;

    // Attach card delete button handlers
    container.querySelectorAll('.topic-card-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = btn.getAttribute('data-topic-id');
            const name = btn.getAttribute('data-topic-name');
            const artCount = HubStore.getArticles(id).length;
            const noteMsg = artCount > 0 ? ` and all ${artCount} note(s) inside it` : '';
            if (confirm(`Are you sure you want to delete topic "${name}"${noteMsg}? This cannot be undone.`)) {
                await HubStore.deleteTopic(id);
                alert(`Topic "${name}" deleted.`);
                renderAllTopics(container, pageTitle, pageDesc);
            }
        });
    });
}

function isRoadmapTopic(topic) {
    if (!topic) return false;
    if (typeof HubStore !== 'undefined' && typeof HubStore.isRoadmapTopic === 'function') {
        return HubStore.isRoadmapTopic(topic);
    }
    const s = (topic.slug || '').toLowerCase();
    const n = (topic.name || '').toLowerCase();
    const t = (topic.tag || '').toLowerCase();
    return s.includes('roadmap') || n.includes('roadmap') || t.includes('roadmap') || Boolean(topic.isRoadmap);
}

function getStarterHtmlTemplate(topicName) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(topicName)} — Interactive Overview</title>
  <!-- KaTeX for math formulas -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css">
  <style>
    :root {
      --bg: #0b1020;
      --panel: #121a2e;
      --panel-hover: #19243c;
      --text: #e5ecf7;
      --muted: #9caec8;
      --border: #283752;
      --accent: #60a5fa;
      --cyan: #67e8f9;
      --purple: #c4b5fd;
      --green: #6ee7b7;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 30px 18px;
      background: radial-gradient(ellipse at top, #172447 0%, transparent 60%), var(--bg);
      color: var(--text);
      font-family: Inter, system-ui, -apple-system, sans-serif;
      line-height: 1.6;
    }
    .container { max-width: 950px; margin: auto; }
    header { text-align: center; margin-bottom: 32px; }
    .eyebrow { color: var(--cyan); font-size: 11px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; }
    h1 {
      margin: 8px 0;
      font-size: clamp(28px, 5vw, 46px);
      letter-spacing: -1px;
      background: linear-gradient(90deg, var(--accent), var(--purple), var(--green));
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    p.subtitle { color: var(--muted); max-width: 600px; margin: 10px auto; font-size: 15px; }
    .tree { border-left: 2px solid #344765; margin-left: 12px; padding-left: 22px; }
    .branch {
      position: relative;
      margin: 0 0 16px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: rgba(18, 26, 46, 0.95);
      overflow: hidden;
      transition: all 0.2s;
    }
    .branch:hover { border-color: #50678b; background: var(--panel-hover); }
    .branch::before {
      content: "";
      position: absolute;
      left: -24px;
      top: 24px;
      width: 22px;
      border-top: 2px solid #344765;
    }
    summary {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px;
      font-weight: 700;
      font-size: 16px;
      cursor: pointer;
      list-style: none;
      user-select: none;
    }
    summary::-webkit-details-marker { display: none; }
    .number {
      display: grid;
      place-items: center;
      min-width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #172d4b;
      color: var(--accent);
      font-size: 13px;
      font-weight: 800;
    }
    .content { padding: 0 18px 18px 62px; color: #cbd7e8; font-size: 14px; }
    .math {
      background: #0f172a;
      border: 1px solid #283752;
      border-radius: 8px;
      padding: 10px 14px;
      margin: 10px 0;
      color: #93c5fd;
    }
    code {
      background: #1e293b;
      color: #7dd3fc;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 13px;
    }
  </style>
</head>
<body>
<div class="container">
  <header>
    <div class="eyebrow">Interactive Overview</div>
    <h1>${escapeHtml(topicName)}</h1>
    <p class="subtitle">Custom interactive knowledge branch with expandable modules and mathematical formulations.</p>
  </header>

  <section class="tree">
    <details class="branch" open>
      <summary>
        <span class="number">01</span>
        <span>Core Foundations & Intuition</span>
      </summary>
      <div class="content">
        <p>Key mathematical formulation for this architecture:</p>
        <div class="math">$$f(x) = \\sigma(W \\cdot x + b)$$</div>
        <ul>
          <li><strong>Input Space:</strong> Multi-dimensional tensor representations.</li>
          <li><strong>Transformation:</strong> Linear projection followed by non-linear activation.</li>
        </ul>
      </div>
    </details>

    <details class="branch">
      <summary>
        <span class="number">02</span>
        <span>Optimization & Implementation</span>
      </summary>
      <div class="content">
        <p>Loss function and gradient updates:</p>
        <div class="math">$$\\mathcal{L} = -\\sum_{i} y_i \\log(\\hat{y}_i)$$</div>
        <p>Implementation tip: Use PyTorch tensor broadcasting and mixed-precision operations.</p>
      </div>
    </details>
  </section>
</div>

<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/contrib/auto-render.min.js"
  onload="renderMathInElement(document.body, {delimiters: [{left: '$$', right: '$$', display: true}, {left: '\\\\(', right: '\\\\)', display: false}], throwOnError: false});"></script>
</body>
</html>`;
}

function setupTopicHtmlModal(topic) {
    const modal = document.getElementById('modal-topic-html-embed');
    if (!modal) return;

    const titleEl = document.getElementById('modal-html-topic-title');
    const inputId = document.getElementById('topic-html-topic-id');
    const inputTitle = document.getElementById('topic-html-input-title');
    const inputTag = document.getElementById('topic-html-input-tag');
    const inputCode = document.getElementById('topic-html-code');
    const btnRemove = document.getElementById('btn-remove-topic-html');
    const btnSave = document.getElementById('btn-save-topic-html');
    const btnClose = document.getElementById('btn-close-topic-html-modal');
    const btnCancel = document.getElementById('btn-cancel-topic-html-modal');
    const btnPaste = document.getElementById('btn-helper-paste');
    const btnTemplate = document.getElementById('btn-helper-roadmap-template');
    const btnPreview = document.getElementById('btn-helper-preview');
    const previewContainer = document.getElementById('modal-html-preview-container');
    const previewFrame = document.getElementById('modal-html-preview-frame');
    const btnClosePreview = document.getElementById('btn-close-modal-preview');

    const openModal = () => {
        titleEl.textContent = `🌐 Embed Custom HTML — ${topic.name}`;
        inputId.value = topic.id;
        inputTitle.value = topic.htmlTitle || (isRoadmapTopic(topic) ? 'Machine Learning Interactive Roadmap' : `${topic.name} Interactive View`);
        inputTag.value = topic.htmlTag || (isRoadmapTopic(topic) ? '10 Core Branches' : 'Interactive App');
        inputCode.value = topic.customHtml || '';
        
        if (topic.customHtml && topic.customHtml.trim().length > 0) {
            btnRemove.style.display = 'inline-flex';
        } else {
            btnRemove.style.display = 'none';
        }

        previewContainer.style.display = 'none';
        modal.classList.add('active');
        inputCode.focus();
    };

    const closeModal = () => {
        modal.classList.remove('active');
        previewContainer.style.display = 'none';
    };

    document.getElementById('btn-open-topic-html-modal')?.addEventListener('click', openModal);
    document.getElementById('btn-iframe-edit-code')?.addEventListener('click', openModal);
    btnClose?.addEventListener('click', closeModal);
    btnCancel?.addEventListener('click', closeModal);

    btnPaste?.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                inputCode.value = text;
                inputCode.focus();
            }
        } catch (e) {
            alert('Please paste code directly into the textarea (Ctrl+V).');
        }
    });

    btnTemplate?.addEventListener('click', () => {
        if (inputCode.value.trim().length > 0 && !confirm('Replace current editor code with the Interactive Roadmap template?')) {
            return;
        }
        inputCode.value = getStarterHtmlTemplate(topic.name);
        if (!inputTitle.value.trim()) inputTitle.value = `${topic.name} Interactive Roadmap`;
        if (!inputTag.value.trim()) inputTag.value = 'Curriculum Tree';
    });

    btnPreview?.addEventListener('click', () => {
        const code = inputCode.value;
        if (!code.trim()) {
            alert('Please paste or write some HTML code first!');
            return;
        }
        previewFrame.srcdoc = code;
        previewContainer.style.display = 'block';
    });

    btnClosePreview?.addEventListener('click', () => {
        previewContainer.style.display = 'none';
    });

    btnSave?.addEventListener('click', async () => {
        const code = inputCode.value.trim();
        const htmlTitle = inputTitle.value.trim() || `${topic.name} Interactive View`;
        const htmlTag = inputTag.value.trim() || 'Interactive App';

        if (!code && !isRoadmapTopic(topic)) {
            alert('Please paste your HTML code before saving.');
            return;
        }

        btnSave.disabled = true;
        btnSave.textContent = 'Saving...';
        try {
            await HubStore.saveTopic({
                ...topic,
                customHtml: code,
                htmlTitle: htmlTitle,
                htmlTag: htmlTag
            });
            closeModal();
            initTopicsView();
        } catch (err) {
            alert(`Error saving HTML: ${err.message}`);
        } finally {
            btnSave.disabled = false;
            btnSave.textContent = '💾 Save & Render Interactive Page';
        }
    });

    btnRemove?.addEventListener('click', async () => {
        if (confirm(`Remove custom HTML from "${topic.name}"? The topic will return to standard notes view.`)) {
            await HubStore.saveTopic({
                ...topic,
                customHtml: '',
                htmlTitle: '',
                htmlTag: ''
            });
            closeModal();
            initTopicsView();
        }
    });
}

function renderSingleTopic(topicSlug, container, pageTitle, pageDesc) {
    const topic = HubStore.getTopic(topicSlug);
    if (!topic) {
        container.innerHTML = `
            <div class="empty-state-card">
                <div class="empty-state-icon">⚠️</div>
                <h3>Topic Not Found</h3>
                <p>The requested topic category could not be located.</p>
                <div class="empty-actions">
                    <a href="topics.html" class="btn btn-secondary">← View All Topics</a>
                    <a href="editor.html" class="btn btn-primary">+ Write New Note</a>
                </div>
            </div>
        `;
        return;
    }

    pageTitle.innerHTML = `<span style="font-size: 0.9em; margin-right: 8px;">${topic.icon || '🧠'}</span>${escapeHtml(topic.name)}`;
    pageDesc.textContent = topic.description || `Research notes, derivations, and code for ${topic.name}.`;

    const hasHtml = HubStore.topicHasHtml(topic);
    const htmlInfo = HubStore.getTopicHtmlInfo(topic);
    const articles = HubStore.getArticles(topic.id);

    let html = `
        <div class="topic-detail-bar">
            <div class="topic-detail-tag">Category: <strong>${escapeHtml(topic.tag || 'Deep Learning')}</strong></div>
            <div class="topic-detail-actions">
                <a href="topics.html" class="btn btn-sm btn-secondary">← All Topics</a>
                ${hasHtml 
                    ? `<button type="button" class="btn btn-sm btn-secondary" id="btn-open-topic-html-modal">⚙️ Edit HTML Page</button>` 
                    : `<button type="button" class="btn btn-sm btn-secondary" id="btn-open-topic-html-modal">🌐 Embed Custom HTML</button>`}
                ${hasHtml ? `<button type="button" class="btn btn-sm btn-secondary" id="btn-topic-fullscreen">🗺️ Fullscreen View ↗</button>` : ''}
                <a href="editor.html?topic=${topic.id}" class="btn btn-sm btn-primary">+ Add Note in ${escapeHtml(topic.name)}</a>
                <button type="button" class="btn btn-sm btn-danger-ghost" id="btn-delete-topic" title="Delete this topic and its notes">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    <span>Delete Topic</span>
                </button>
            </div>
        </div>
    `;

    if (hasHtml && htmlInfo) {
        html += `
            <div class="topic-tabs-bar" id="topic-tabs-bar">
                <button type="button" class="topic-tab-btn active" data-tab="roadmap" id="tab-btn-roadmap">
                    <span>${escapeHtml(htmlInfo.title || '🗺️ Interactive View')}</span>
                </button>
                <button type="button" class="topic-tab-btn" data-tab="notes" id="tab-btn-notes">
                    <span>📝 Topic Notes</span>
                    <span class="topic-tab-badge">${articles.length}</span>
                </button>
            </div>

            <!-- TAB 1: INTERACTIVE VIEW (Embedded Custom HTML or ml.html) -->
            <div id="view-tab-roadmap" class="topic-tab-pane">
                <div class="topic-roadmap-container">
                    <div class="topic-roadmap-header">
                        <div class="topic-roadmap-header-left">
                            <span class="topic-roadmap-title">${escapeHtml(htmlInfo.title || '🗺️ Interactive View')}</span>
                            <span class="topic-roadmap-tag">${escapeHtml(htmlInfo.tag || 'Interactive App')}</span>
                        </div>
                        <div class="topic-roadmap-header-actions">
                            <button type="button" class="btn-roadmap-action" id="btn-iframe-expand">Expand All +</button>
                            <button type="button" class="btn-roadmap-action" id="btn-iframe-collapse">Collapse All −</button>
                            <button type="button" class="btn-roadmap-action btn-roadmap-primary" id="btn-iframe-fullscreen">Open Fullscreen ↗</button>
                            <button type="button" class="btn-roadmap-action" id="btn-iframe-edit-code">⚙️ Edit Code</button>
                        </div>
                    </div>
                    <iframe class="topic-roadmap-iframe" id="topic-roadmap-iframe" title="${escapeHtml(htmlInfo.title || 'Interactive View')}"></iframe>
                </div>
            </div>

            <!-- TAB 2: TOPIC NOTES -->
            <div id="view-tab-notes" class="topic-tab-pane" style="display: none;">
                <div class="featured-roadmap-card" id="card-featured-roadmap">
                    <div class="featured-roadmap-info">
                        <div class="featured-roadmap-icon">🗺️</div>
                        <div>
                            <h3 class="featured-roadmap-title">${escapeHtml(htmlInfo.title || 'Interactive Overview')}</h3>
                            <p class="featured-roadmap-desc">${escapeHtml(topic.description || 'Interactive curriculum, math formulations, and code architecture.')}</p>
                            <div class="featured-roadmap-badges">
                                <span class="featured-roadmap-badge">${escapeHtml(htmlInfo.tag || 'Interactive App')}</span>
                                <span class="featured-roadmap-badge">#${escapeHtml(topic.tag || 'interactive')}</span>
                                <span class="featured-roadmap-badge">Custom HTML</span>
                            </div>
                        </div>
                    </div>
                    <div class="featured-roadmap-action">
                        <span>View Interactive Tree →</span>
                    </div>
                </div>
        `;
    }

    let notesHtml = '';
    if (articles.length === 0) {
        notesHtml = `
            <div class="empty-state-card" style="margin-top: 1rem;">
                <div class="empty-state-icon">📝</div>
                <h3>No Research Notes in this Topic Yet</h3>
                <p>Start writing research notes, math formulations, diagrams, and code for <strong>${escapeHtml(topic.name)}</strong>.</p>
                <div class="empty-actions">
                    <a href="editor.html?topic=${topic.id}" class="btn btn-primary">+ Write First Note</a>
                </div>
            </div>
        `;
    } else {
        notesHtml = '<div class="posts-list">';
        articles.forEach(art => {
            let day = '17';
            let month = 'Oct';
            if (art.date) {
                try {
                    const d = new Date(art.date + 'T00:00:00');
                    day = d.getDate().toString();
                    month = d.toLocaleString('en-US', { month: 'short' });
                } catch (e) {}
            }

            const tagsHtml = (art.tags || []).map(t => `<span class="mini-tag">#${escapeHtml(t)}</span>`).join('');
            const diagramCount = art.sections ? art.sections.filter(s => s.diagram).length : (art.diagram ? 1 : 0);
            const diagramBadge = diagramCount > 1 
                ? `<span class="mini-tag tag-diagram">📐 ${diagramCount} diagrams</span>` 
                : (diagramCount === 1 ? `<span class="mini-tag tag-diagram">📐 diagram</span>` : '');
            const htmlBadge = art.isHtmlNote ? `<span class="mini-tag html-note-badge">🌐 Interactive HTML</span>` : '';

            notesHtml += `
                <a href="article.html?id=${art.id}" class="post-card">
                    <div class="post-date">
                        <span class="post-day">${day}</span>
                        <span class="post-month">${month}</span>
                    </div>
                    <div class="post-content">
                        <div class="post-category">${escapeHtml(topic.name)}</div>
                        <h3 class="post-title">${escapeHtml(art.title)}</h3>
                        <p class="post-excerpt">${escapeHtml(art.excerpt || '')}</p>
                        <div class="post-tags">
                            ${tagsHtml}
                            ${diagramBadge}
                            ${htmlBadge}
                        </div>
                    </div>
                    <div class="post-arrow">→</div>
                </a>
            `;
        });
        notesHtml += '</div>';
    }

    if (hasHtml && htmlInfo) {
        html += notesHtml + '</div>';
    } else {
        html += notesHtml;
    }

    container.innerHTML = html;

    // Load iframe content safely
    if (hasHtml && htmlInfo) {
        const iframe = document.getElementById('topic-roadmap-iframe');
        if (iframe) {
            if (htmlInfo.hasCode) {
                iframe.srcdoc = htmlInfo.customHtml;
            } else if (htmlInfo.url) {
                iframe.src = htmlInfo.url;
            }
        }

        const tabRoadmap = document.getElementById('tab-btn-roadmap');
        const tabNotes = document.getElementById('tab-btn-notes');
        const viewRoadmap = document.getElementById('view-tab-roadmap');
        const viewNotes = document.getElementById('view-tab-notes');
        const featuredCard = document.getElementById('card-featured-roadmap');

        const switchTab = (tab) => {
            if (tab === 'roadmap') {
                tabRoadmap?.classList.add('active');
                tabNotes?.classList.remove('active');
                if (viewRoadmap) viewRoadmap.style.display = 'block';
                if (viewNotes) viewNotes.style.display = 'none';
            } else {
                tabNotes?.classList.add('active');
                tabRoadmap?.classList.remove('active');
                if (viewNotes) viewNotes.style.display = 'block';
                if (viewRoadmap) viewRoadmap.style.display = 'none';
            }
        };

        tabRoadmap?.addEventListener('click', () => switchTab('roadmap'));
        tabNotes?.addEventListener('click', () => switchTab('notes'));
        featuredCard?.addEventListener('click', () => switchTab('roadmap'));

        // Communicating with iframe for expand / collapse
        document.getElementById('btn-iframe-expand')?.addEventListener('click', () => {
            try {
                iframe?.contentWindow?.document.querySelectorAll('details.branch, details').forEach(d => d.open = true);
            } catch (e) {}
        });
        document.getElementById('btn-iframe-collapse')?.addEventListener('click', () => {
            try {
                iframe?.contentWindow?.document.querySelectorAll('details.branch, details').forEach(d => d.open = false);
            } catch (e) {}
        });

        // Fullscreen action
        const openFullscreen = () => {
            if (htmlInfo.url) {
                window.open(htmlInfo.url, '_blank');
            } else if (htmlInfo.customHtml) {
                const blob = new Blob([htmlInfo.customHtml], { type: 'text/html;charset=utf-8' });
                const blobUrl = URL.createObjectURL(blob);
                window.open(blobUrl, '_blank');
            }
        };
        document.getElementById('btn-topic-fullscreen')?.addEventListener('click', openFullscreen);
        document.getElementById('btn-iframe-fullscreen')?.addEventListener('click', openFullscreen);
    }

    // Setup the Embed/Edit Custom HTML Modal
    setupTopicHtmlModal(topic);

    // Attach single topic delete action
    const btnDeleteTopic = document.getElementById('btn-delete-topic');
    if (btnDeleteTopic) {
        btnDeleteTopic.addEventListener('click', async () => {
            const artCount = HubStore.getArticles(topic.id).length;
            const noteMsg = artCount > 0 ? ` and all ${artCount} note(s) inside it` : '';
            if (confirm(`Are you sure you want to delete topic "${topic.name}"${noteMsg}? This cannot be undone.`)) {
                await HubStore.deleteTopic(topic.id);
                alert(`Topic "${topic.name}" deleted.`);
                window.location.href = 'topics.html';
            }
        });
    }
}

function escapeHtml(string) {
    if (!string) return '';
    return String(string)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
