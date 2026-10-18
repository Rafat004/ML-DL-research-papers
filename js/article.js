/* ============================================================
   Deep Learning Knowledge Hub — Article Reader Script
   Loads and renders individual research notes dynamically.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    initArticleViewer();
});

function initArticleViewer() {
    const urlParams = new URLSearchParams(window.location.search);
    const articleId = urlParams.get('id') || urlParams.get('slug');

    if (!articleId) {
        showArticleError('No article selected. Please return to the homepage.');
        return;
    }

    const article = HubStore.getArticle(articleId);
    if (!article) {
        if (typeof FirebaseConfig !== 'undefined' && FirebaseConfig.isConfigured()) {
            const articleTitleEl = document.getElementById('article-title');
            if (articleTitleEl) articleTitleEl.textContent = 'Loading note from Cloud...';
            window.addEventListener('hub:synced', () => {
                const fetched = HubStore.getArticle(articleId);
                if (fetched) {
                    initArticleViewer();
                } else {
                    showArticleError('Article not found in local or cloud storage.');
                }
            }, { once: true });
            return;
        }
        showArticleError('Article not found. It may have been deleted or moved.');
        return;
    }

    // Populate metadata
    document.title = `${article.title} — DL Knowledge Hub`;
    document.getElementById('breadcrumb-title').textContent = article.title;
    document.getElementById('article-title').textContent = article.title;
    
    // Topic breadcrumb & pill
    const topicPill = document.getElementById('article-topic-pill');
    const breadcrumbTopic = document.getElementById('breadcrumb-topic');
    topicPill.textContent = article.topicName || 'General';
    breadcrumbTopic.textContent = article.topicName || 'Topics';
    breadcrumbTopic.href = `topics.html?topic=${article.topicSlug || ''}`;

    // Date
    if (article.date) {
        try {
            const d = new Date(article.date + 'T00:00:00');
            const dateStr = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            document.getElementById('article-date').textContent = dateStr;
        } catch (e) {
            document.getElementById('article-date').textContent = article.date;
        }
    }

    // Reading time calculation (~200 words per minute)
    const wordCount = (article.content || '').split(/\s+/).filter(Boolean).length;
    const readMinutes = Math.max(1, Math.ceil(wordCount / 200));
    document.getElementById('article-read-time').textContent = `${readMinutes} min read`;

    // Tags
    const tagsContainer = document.getElementById('article-tags-list');
    tagsContainer.innerHTML = '';
    if (article.tags && article.tags.length > 0) {
        article.tags.forEach(tag => {
            const span = document.createElement('span');
            span.className = 'article-tag-item';
            span.textContent = `#${tag}`;
            tagsContainer.appendChild(span);
        });
    }

    // Lightbox zoom setup
    const lightbox = document.getElementById('lightbox-overlay');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxClose = document.getElementById('lightbox-close');

    function openLightbox(src) {
        if (lightbox && lightboxImg) {
            lightboxImg.src = src;
            lightbox.classList.add('active');
        }
    }

    lightboxClose?.addEventListener('click', () => lightbox.classList.remove('active'));
    lightbox?.addEventListener('click', (e) => {
        if (e.target === lightbox) lightbox.classList.remove('active');
    });

    // Multi-slot Description & Architecture Diagram Display
    const sectionsContainer = document.getElementById('article-sections-container');
    const sections = Array.isArray(article.sections) && article.sections.length > 0
        ? article.sections
        : [{ description: article.excerpt || '', diagram: article.diagram || '', diagramCaption: article.diagramCaption || '' }];

    const activeSections = sections.filter(s => (s.description && s.description.trim()) || s.diagram);

    if (sectionsContainer) {
        if (activeSections.length > 0) {
            sectionsContainer.innerHTML = '';
            activeSections.forEach((sec, idx) => {
                const sectionEl = document.createElement('div');
                sectionEl.className = 'article-section-block';

                if (sec.description && sec.description.trim()) {
                    const label = activeSections.length > 1 ? `Description ${idx + 1}:` : 'Description:';
                    const abstractCard = document.createElement('div');
                    abstractCard.className = 'article-abstract-card';
                    abstractCard.innerHTML = `
                        <div class="abstract-label">${label}</div>
                        <p class="abstract-text">${escapeHtml(sec.description.trim())}</p>
                    `;
                    sectionEl.appendChild(abstractCard);
                }

                if (sec.diagram) {
                    const diagCard = document.createElement('section');
                    diagCard.className = 'article-diagram-wrapper';
                    const tagLabel = activeSections.length > 1 ? `📐 Architecture Diagram #${idx + 1}` : '📐 Architecture Diagram';
                    const captionText = sec.diagramCaption || `Figure ${idx + 1}: Architecture diagram`;

                    diagCard.innerHTML = `
                        <div class="diagram-display-card">
                            <div class="diagram-tag">${tagLabel}</div>
                            <div class="diagram-image-container">
                                <img src="${sec.diagram}" alt="Architecture Diagram ${idx + 1}" class="diagram-zoomable">
                            </div>
                            <p class="diagram-caption">${escapeHtml(captionText)}</p>
                        </div>
                    `;

                    const img = diagCard.querySelector('.diagram-zoomable');
                    if (img) {
                        img.addEventListener('click', () => openLightbox(sec.diagram));
                    }

                    sectionEl.appendChild(diagCard);
                }

                sectionsContainer.appendChild(sectionEl);
            });
            sectionsContainer.style.display = 'block';
        } else {
            sectionsContainer.innerHTML = '';
            sectionsContainer.style.display = 'none';
        }
    }

    // Render Body Markdown
    const bodyEl = document.getElementById('article-body');
    const html = HubStore.renderMarkdown(article.content || '');
    bodyEl.innerHTML = html;

    // Render Interactive HTML container if article has custom HTML code
    const hasCustomHtml = Boolean(article.customHtml && article.customHtml.trim().length > 0);
    if (hasCustomHtml) {
        const interactiveContainer = document.createElement('div');
        interactiveContainer.className = 'topic-roadmap-container';
        interactiveContainer.style.margin = '1rem 0 2rem';
        interactiveContainer.innerHTML = `
            <div class="topic-roadmap-header">
                <div class="topic-roadmap-header-left">
                    <span class="topic-roadmap-title">🌐 Interactive Web App / Custom HTML Document</span>
                    <span class="topic-roadmap-tag">Interactive App</span>
                </div>
                <div class="topic-roadmap-header-actions">
                    <button type="button" class="btn-roadmap-action" id="btn-art-html-expand">Expand All +</button>
                    <button type="button" class="btn-roadmap-action" id="btn-art-html-collapse">Collapse All −</button>
                    <button type="button" class="btn-roadmap-action btn-roadmap-primary" id="btn-art-html-fullscreen">Open Fullscreen ↗</button>
                </div>
            </div>
            <iframe class="topic-roadmap-iframe" id="article-html-iframe" title="${escapeHtml(article.title)}"></iframe>
        `;
        bodyEl.prepend(interactiveContainer);
        const artIframe = interactiveContainer.querySelector('#article-html-iframe');
        if (artIframe) artIframe.srcdoc = article.customHtml;

        interactiveContainer.querySelector('#btn-art-html-expand')?.addEventListener('click', () => {
            try { artIframe?.contentWindow?.document.querySelectorAll('details.branch, details').forEach(d => d.open = true); } catch (e) {}
        });
        interactiveContainer.querySelector('#btn-art-html-collapse')?.addEventListener('click', () => {
            try { artIframe?.contentWindow?.document.querySelectorAll('details.branch, details').forEach(d => d.open = false); } catch (e) {}
        });
        interactiveContainer.querySelector('#btn-art-html-fullscreen')?.addEventListener('click', () => {
            const blob = new Blob([article.customHtml], { type: 'text/html;charset=utf-8' });
            window.open(URL.createObjectURL(blob), '_blank');
        });
    }

    // Render KaTeX Math
    if (typeof renderMathInElement === 'function') {
        try {
            renderMathInElement(bodyEl, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false }
                ],
                throwOnError: false
            });
        } catch (e) {
            console.warn('KaTeX render warning:', e);
        }
    }

    // Highlight code blocks with Prism.js
    if (typeof Prism !== 'undefined') {
        Prism.highlightAllUnder(bodyEl);
    }

    // Attach copy button listeners to code blocks
    bodyEl.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const pre = btn.closest('.code-block-wrapper').querySelector('code');
            if (pre) {
                await navigator.clipboard.writeText(pre.textContent);
                btn.textContent = 'Copied!';
                setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
            }
        });
    });

    // Build Table of Contents (TOC)
    buildTableOfContents(bodyEl);

    // Edit button actions
    const editUrl = `editor.html?edit=${article.id}`;
    document.getElementById('btn-edit-article').href = editUrl;
    const sidebarEdit = document.getElementById('btn-sidebar-edit');
    if (sidebarEdit) {
        sidebarEdit.addEventListener('click', () => { window.location.href = editUrl; });
    }

    // Download .md action
    const handleDownload = () => {
        HubStore.downloadMarkdown(article);
    };
    document.getElementById('btn-download-article-md').addEventListener('click', handleDownload);
    const sidebarDl = document.getElementById('btn-sidebar-download');
    if (sidebarDl) {
        sidebarDl.addEventListener('click', handleDownload);
    }

    // Delete button action
    const btnDelete = document.getElementById('btn-delete-article');
    if (btnDelete) {
        btnDelete.addEventListener('click', async () => {
            if (confirm(`Are you sure you want to delete "${article.title}"? This cannot be undone.`)) {
                btnDelete.disabled = true;
                await HubStore.deleteArticle(article.id);
                alert('Article deleted.');
                window.location.href = 'index.html';
            }
        });
    }
}

function buildTableOfContents(container) {
    const tocNav = document.getElementById('toc-nav');
    if (!tocNav) return;

    const headings = container.querySelectorAll('h2, h3');
    if (headings.length === 0) {
        tocNav.innerHTML = '<p class="toc-empty">No section headings in this note.</p>';
        return;
    }

    tocNav.innerHTML = '';
    headings.forEach((heading, idx) => {
        const id = heading.id || `section-${idx}`;
        heading.id = id;

        const a = document.createElement('a');
        a.href = `#${id}`;
        a.className = `toc-link ${heading.tagName.toLowerCase()}`;
        a.textContent = heading.textContent;
        tocNav.appendChild(a);
    });
}

function showArticleError(msg) {
    const main = document.getElementById('article-main');
    if (main) {
        main.innerHTML = `
            <div class="empty-state-card">
                <div class="empty-state-icon">⚠️</div>
                <h2>${msg}</h2>
                <p>You can create a new research note or return to your knowledge hub.</p>
                <div class="empty-state-actions">
                    <a href="index.html" class="btn btn-secondary">← Back to Hub</a>
                    <a href="editor.html" class="btn btn-primary">+ Create New Note</a>
                </div>
            </div>
        `;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
