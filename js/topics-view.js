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

        btnSaveTopic.disabled = true;
        btnSaveTopic.textContent = 'Saving...';
        try {
            const saved = await HubStore.saveTopic({ name, icon, tag, description: desc });
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
        const countText = count === 1 ? '1 note' : `${count} notes`;
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

    const articles = HubStore.getArticles(topic.id);

    let html = `
        <div class="topic-detail-bar">
            <div class="topic-detail-tag">Category: <strong>${escapeHtml(topic.tag || 'Deep Learning')}</strong></div>
            <div class="topic-detail-actions">
                <a href="topics.html" class="btn btn-sm btn-secondary">← All Topics</a>
                <a href="editor.html?topic=${topic.id}" class="btn btn-sm btn-primary">+ Add Note in ${escapeHtml(topic.name)}</a>
                <button type="button" class="btn btn-sm btn-danger-ghost" id="btn-delete-topic" title="Delete this topic and its notes">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    <span>Delete Topic</span>
                </button>
            </div>
        </div>
    `;

    if (articles.length === 0) {
        html += `
            <div class="empty-state-card">
                <div class="empty-state-icon">📝</div>
                <h3>No Notes in this Topic Yet</h3>
                <p>Start writing research notes, math formulations, diagrams, and code for <strong>${escapeHtml(topic.name)}</strong>.</p>
                <div class="empty-actions">
                    <a href="editor.html?topic=${topic.id}" class="btn btn-primary">+ Write First Note</a>
                </div>
            </div>
        `;
    } else {
        html += '<div class="posts-list">';
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
            const diagramBadge = art.diagram ? `<span class="mini-tag tag-diagram">📐 diagram</span>` : '';

            html += `
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
                        </div>
                    </div>
                    <div class="post-arrow">→</div>
                </a>
            `;
        });
        html += '</div>';
    }

    container.innerHTML = html;

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
