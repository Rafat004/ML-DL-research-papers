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

    // Abstract / Summary
    const abstractCard = document.getElementById('article-abstract');
    const abstractText = document.getElementById('article-abstract-text');
    if (abstractCard && abstractText) {
        if (article.excerpt && article.excerpt.trim()) {
            abstractText.textContent = article.excerpt.trim();
            abstractCard.style.display = 'block';
        } else {
            abstractCard.style.display = 'none';
        }
    }

    // Architecture Diagram Display
    const diagramWrapper = document.getElementById('article-diagram-wrapper');
    const diagramImg = document.getElementById('article-diagram-img');
    const diagramCaption = document.getElementById('article-diagram-caption');

    if (article.diagram) {
        diagramImg.src = article.diagram;
        diagramCaption.textContent = article.diagramCaption || 'Figure: Architecture diagram';
        diagramWrapper.style.display = 'block';

        // Lightbox zoom setup
        const lightbox = document.getElementById('lightbox-overlay');
        const lightboxImg = document.getElementById('lightbox-img');
        const lightboxClose = document.getElementById('lightbox-close');

        diagramImg.addEventListener('click', () => {
            lightboxImg.src = article.diagram;
            lightbox.classList.add('active');
        });

        lightboxClose?.addEventListener('click', () => lightbox.classList.remove('active'));
        lightbox?.addEventListener('click', (e) => {
            if (e.target === lightbox) lightbox.classList.remove('active');
        });
    } else {
        diagramWrapper.style.display = 'none';
    }

    // Render Body Markdown
    const bodyEl = document.getElementById('article-body');
    const html = HubStore.renderMarkdown(article.content || '');
    bodyEl.innerHTML = html;

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
        btnDelete.addEventListener('click', () => {
            if (confirm(`Are you sure you want to delete "${article.title}"? This cannot be undone.`)) {
                HubStore.deleteArticle(article.id);
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
