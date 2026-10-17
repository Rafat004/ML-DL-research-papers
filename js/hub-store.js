/* ============================================================
   Deep Learning Knowledge Hub — Data Store & Sync Manager
   Handles LocalStorage, IndexedDB, GitHub REST API commits,
   Markdown parsing, and JSON Backup/Restore.
   ============================================================ */

const HubStore = (() => {
    const STORAGE_KEY_TOPICS = 'dl_hub_topics_v1';
    const STORAGE_KEY_ARTICLES = 'dl_hub_articles_v1';
    const STORAGE_KEY_GITHUB = 'dl_hub_github_config_v1';

    // Default topics to start with if completely empty (or empty array)
    // We start completely clean as the user requested "i dont want this topics that u have written, i want to add topics of my own"
    const INITIAL_TOPICS = [];
    const INITIAL_ARTICLES = [];

    /* ---- Helper: Generate unique ID ---- */
    function uid(prefix = 'id') {
        return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
    }

    /* ---- Helper: Slugify string ---- */
    function slugify(text) {
        return text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-');
    }

    /* ---- Topics Storage ---- */
    function getTopics() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_TOPICS);
            if (!raw) {
                return INITIAL_TOPICS;
            }
            return JSON.parse(raw);
        } catch (e) {
            console.error('Error reading topics from localStorage:', e);
            return [];
        }
    }

    function getTopic(idOrSlug) {
        const topics = getTopics();
        return topics.find(t => t.id === idOrSlug || t.slug === idOrSlug) || null;
    }

    function saveTopic(topicData) {
        const topics = getTopics();
        const slug = slugify(topicData.name || 'untitled-topic');
        
        let existingIndex = -1;
        if (topicData.id) {
            existingIndex = topics.findIndex(t => t.id === topicData.id);
        } else {
            existingIndex = topics.findIndex(t => t.slug === slug);
        }

        const now = Date.now();
        const topicRecord = {
            id: topicData.id || uid('top'),
            name: topicData.name.trim(),
            slug: slug,
            icon: topicData.icon || '◈',
            tag: topicData.tag || 'Deep Learning',
            description: (topicData.description || '').trim(),
            createdAt: existingIndex >= 0 ? topics[existingIndex].createdAt : now,
            updatedAt: now
        };

        if (existingIndex >= 0) {
            topics[existingIndex] = topicRecord;
        } else {
            topics.push(topicRecord);
        }

        localStorage.setItem(STORAGE_KEY_TOPICS, JSON.stringify(topics));
        return topicRecord;
    }

    function deleteTopic(topicIdOrSlug) {
        const topic = getTopic(topicIdOrSlug);
        const targetId = topic ? topic.id : topicIdOrSlug;
        const targetSlug = topic ? topic.slug : topicIdOrSlug;

        let topics = getTopics().filter(t => t.id !== targetId && t.slug !== targetSlug);
        localStorage.setItem(STORAGE_KEY_TOPICS, JSON.stringify(topics));

        // Also remove articles belonging to this topic
        let articles = getArticles().filter(a => a.topicId !== targetId && a.topicSlug !== targetSlug);
        localStorage.setItem(STORAGE_KEY_ARTICLES, JSON.stringify(articles));
        return true;
    }

    /* ---- Articles Storage ---- */
    function getArticles(topicIdOrSlug = null) {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_ARTICLES);
            let articles = raw ? JSON.parse(raw) : INITIAL_ARTICLES;

            if (topicIdOrSlug) {
                articles = articles.filter(a => a.topicId === topicIdOrSlug || a.topicSlug === topicIdOrSlug);
            }

            // Sort newest first
            return articles.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        } catch (e) {
            console.error('Error reading articles:', e);
            return [];
        }
    }

    function getArticle(idOrSlug) {
        const articles = getArticles();
        return articles.find(a => a.id === idOrSlug || a.slug === idOrSlug) || null;
    }

    function saveArticle(articleData) {
        const articles = getArticles();
        const slug = slugify(articleData.title || 'untitled-article');
        
        let existingIndex = -1;
        if (articleData.id) {
            existingIndex = articles.findIndex(a => a.id === articleData.id);
        } else {
            existingIndex = articles.findIndex(a => a.slug === slug);
        }

        const now = Date.now();
        const dateStr = articleData.date || new Date().toISOString().split('T')[0];

        // Format tags array
        let tags = [];
        if (Array.isArray(articleData.tags)) {
            tags = articleData.tags;
        } else if (typeof articleData.tags === 'string') {
            tags = articleData.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
        }

        const articleRecord = {
            id: articleData.id || uid('art'),
            title: (articleData.title || 'Untitled Article').trim(),
            slug: slug,
            topicId: articleData.topicId || '',
            topicName: articleData.topicName || 'General',
            topicSlug: slugify(articleData.topicName || 'general'),
            date: dateStr,
            excerpt: (articleData.excerpt || '').trim() || generateExcerpt(articleData.content || ''),
            tags: tags,
            content: articleData.content || '',
            diagram: articleData.diagram || '', // base64 or URL
            diagramCaption: (articleData.diagramCaption || '').trim(),
            createdAt: existingIndex >= 0 ? articles[existingIndex].createdAt : now,
            updatedAt: now
        };

        if (existingIndex >= 0) {
            articles[existingIndex] = articleRecord;
        } else {
            articles.unshift(articleRecord);
        }

        localStorage.setItem(STORAGE_KEY_ARTICLES, JSON.stringify(articles));

        // Ensure topic exists
        if (articleRecord.topicName) {
            const topic = getTopic(articleRecord.topicSlug);
            if (!topic) {
                saveTopic({
                    name: articleRecord.topicName,
                    icon: '🧠',
                    tag: 'Custom Topic',
                    description: `Research notes and implementations for ${articleRecord.topicName}`
                });
            }
        }

        return articleRecord;
    }

    function deleteArticle(articleId) {
        let articles = getArticles().filter(a => a.id !== articleId);
        localStorage.setItem(STORAGE_KEY_ARTICLES, JSON.stringify(articles));
        return true;
    }

    function generateExcerpt(content, maxLen = 160) {
        if (!content) return '';
        // strip markdown formatting
        const plain = content
            .replace(/#+\s+/g, '')
            .replace(/\$\$[\s\S]*?\$\$/g, '[math formula]')
            .replace(/\$[^$]*\$/g, '[math]')
            .replace(/```[\s\S]*?```/g, '[code snippet]')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
            .replace(/[*_~>]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        return plain.length > maxLen ? plain.slice(0, maxLen) + '...' : plain;
    }

    /* ---- Hub Statistics ---- */
    function getStats() {
        const topics = getTopics();
        const articles = getArticles();

        let codeCount = 0;
        let diagramCount = 0;

        articles.forEach(art => {
            if (art.content && art.content.includes('```')) {
                // count occurrences of ```
                const matches = art.content.match(/```[a-z]*/gi);
                if (matches) codeCount += Math.floor(matches.length / 2);
            }
            if (art.diagram) {
                diagramCount++;
            }
        });

        return {
            topicsCount: topics.length,
            articlesCount: articles.length,
            codeCount: Math.max(codeCount, articles.length > 0 ? 1 : 0),
            diagramsCount: diagramCount
        };
    }

    /* ---- GitHub Integration (Option 3) ---- */
    function getGitHubConfig() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_GITHUB);
            return raw ? JSON.parse(raw) : {
                owner: '',
                repo: '',
                branch: 'main',
                token: '',
                folder: 'notes'
            };
        } catch (e) {
            return { owner: '', repo: '', branch: 'main', token: '', folder: 'notes' };
        }
    }

    function saveGitHubConfig(cfg) {
        localStorage.setItem(STORAGE_KEY_GITHUB, JSON.stringify(cfg));
    }

    /**
     * Publish an article to GitHub via REST API
     * Creates or updates a Markdown file in the user's repository with YAML frontmatter
     */
    async function publishToGitHub(article) {
        const config = getGitHubConfig();
        if (!config.owner || !config.repo || !config.token) {
            throw new Error('Please configure your GitHub settings (Username, Repository, and Token) first.');
        }

        const fileName = `${article.slug || slugify(article.title)}.md`;
        const folder = (config.folder || 'notes').replace(/^\/+|\/+$/g, '');
        const filePath = folder ? `${folder}/${fileName}` : fileName;

        // Construct Markdown with YAML Frontmatter
        const frontmatter = [
            '---',
            `title: "${article.title.replace(/"/g, '\\"')}"`,
            `date: "${article.date}"`,
            `topic: "${article.topicName.replace(/"/g, '\\"')}"`,
            `tags: [${article.tags.map(t => `"${t}"`).join(', ')}]`,
            `excerpt: "${(article.excerpt || '').replace(/"/g, '\\"')}"`,
            article.diagramCaption ? `diagram_caption: "${article.diagramCaption.replace(/"/g, '\\"')}"` : '',
            '---',
            '',
            article.content
        ].filter(Boolean).join('\n');

        // Convert content to Base64 (handling UTF-8)
        const utf8Bytes = new TextEncoder().encode(frontmatter);
        let binaryStr = '';
        utf8Bytes.forEach(b => binaryStr += String.fromCharCode(b));
        const base64Content = btoa(binaryStr);

        const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${filePath}`;

        // Check if file already exists to get its SHA for update
        let sha = null;
        try {
            const checkRes = await fetch(apiUrl, {
                headers: {
                    'Authorization': `Bearer ${config.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            if (checkRes.ok) {
                const checkData = await checkRes.json();
                sha = checkData.sha;
            }
        } catch (e) {
            // Ignore 404
        }

        const commitPayload = {
            message: `Publish research note: ${article.title}`,
            content: base64Content,
            branch: config.branch || 'main'
        };
        if (sha) {
            commitPayload.sha = sha;
        }

        const res = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${config.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(commitPayload)
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.message || `GitHub API error (${res.status})`);
        }

        const result = await res.json();
        return {
            success: true,
            commitUrl: result.commit?.html_url || `https://github.com/${config.owner}/${config.repo}`,
            filePath: filePath
        };
    }

    /**
     * Download article as .md file directly to user's computer
     */
    function downloadMarkdown(article) {
        const frontmatter = [
            '---',
            `title: "${article.title.replace(/"/g, '\\"')}"`,
            `date: "${article.date}"`,
            `topic: "${article.topicName.replace(/"/g, '\\"')}"`,
            `tags: [${article.tags.map(t => `"${t}"`).join(', ')}]`,
            `excerpt: "${(article.excerpt || '').replace(/"/g, '\\"')}"`,
            '---',
            '',
            article.content
        ].join('\n');

        const blob = new Blob([frontmatter], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${article.slug || 'note'}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /* ---- Backup & Restore ---- */
    function exportBackup() {
        const data = {
            version: 1,
            exportedAt: new Date().toISOString(),
            topics: getTopics(),
            articles: getArticles(),
            githubConfig: {
                ...getGitHubConfig(),
                token: '' // don't export sensitive token
            }
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dl-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function importBackup(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            if (!parsed.topics && !parsed.articles) {
                throw new Error('Invalid backup file format: missing topics or articles.');
            }

            if (Array.isArray(parsed.topics)) {
                localStorage.setItem(STORAGE_KEY_TOPICS, JSON.stringify(parsed.topics));
            }
            if (Array.isArray(parsed.articles)) {
                localStorage.setItem(STORAGE_KEY_ARTICLES, JSON.stringify(parsed.articles));
            }
            return {
                success: true,
                topicsCount: parsed.topics ? parsed.topics.length : 0,
                articlesCount: parsed.articles ? parsed.articles.length : 0
            };
        } catch (e) {
            throw new Error(`Failed to import backup: ${e.message}`);
        }
    }

    /* ---- Markdown to HTML parser (Safe & Lightweight with KaTeX / Prism preserved) ---- */
    function renderMarkdown(rawMd) {
        if (!rawMd) return '';

        // If marked.js is available on window, use it
        if (typeof window.marked !== 'undefined' && typeof window.marked.parse === 'function') {
            return window.marked.parse(rawMd);
        }

        // Robust fallback markdown parser
        let html = rawMd;

        // Escape raw HTML tags for safety
        html = html
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Preserve Code blocks ```lang ... ```
        const codeBlocks = [];
        html = html.replace(/```([a-zA-Z0-9_\-\+]*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const id = `__CODE_BLOCK_${codeBlocks.length}__`;
            codeBlocks.push({ lang: lang || 'python', code: code });
            return id;
        });

        // Preserve Math Display: $$ ... $$
        const mathBlocks = [];
        html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
            const id = `__MATH_BLOCK_${mathBlocks.length}__`;
            mathBlocks.push(formula);
            return id;
        });

        // Preserve Math Inline: $ ... $
        const mathInlines = [];
        html = html.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
            const id = `__MATH_INLINE_${mathInlines.length}__`;
            mathInlines.push(formula);
            return id;
        });

        // Headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

        // Blockquotes & Callouts
        html = html.replace(/^>\s*\[!NOTE\]\s*(.*$)/gim, '<div class="callout callout-note"><strong>Note:</strong> $1</div>');
        html = html.replace(/^>\s*\[!KEY INSIGHT\]\s*(.*$)/gim, '<div class="callout callout-insight"><strong>Key Insight:</strong> $1</div>');
        html = html.replace(/^>\s*\[!WARNING\]\s*(.*$)/gim, '<div class="callout callout-warning"><strong>Warning:</strong> $1</div>');
        html = html.replace(/^>\s*(.*$)/gim, '<blockquote>$1</blockquote>');

        // Bold & Italic
        html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');

        // Inline Code
        html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

        // Lists
        html = html.replace(/^\s*\*\s+(.*$)/gim, '<li>$1</li>');
        html = html.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');

        // Paragraphs
        html = html.split(/\n\s*\n/).map(para => {
            para = para.trim();
            if (!para) return '';
            if (para.startsWith('<h') || para.startsWith('<ul') || para.startsWith('<div') || para.startsWith('<blockquote') || para.startsWith('__CODE_BLOCK_') || para.startsWith('__MATH_BLOCK_')) {
                return para;
            }
            return `<p>${para.replace(/\n/g, '<br>')}</p>`;
        }).join('\n');

        // Restore Math Inline
        mathInlines.forEach((formula, i) => {
            html = html.replace(`__MATH_INLINE_${i}__`, `$${formula}$`);
        });

        // Restore Math Blocks
        mathBlocks.forEach((formula, i) => {
            html = html.replace(`__MATH_BLOCK_${i}__`, `<div class="math-block">$$${formula}$$</div>`);
        });

        // Restore Code Blocks
        codeBlocks.forEach((item, i) => {
            const wrapper = `
                <div class="code-block-wrapper">
                    <div class="code-header">
                        <span class="code-lang">${item.lang}</span>
                        <button class="copy-btn" type="button">Copy</button>
                    </div>
                    <pre><code class="language-${item.lang}">${item.code}</code></pre>
                </div>
            `;
            html = html.replace(`__CODE_BLOCK_${i}__`, wrapper);
        });

        return html;
    }

    return {
        getTopics,
        getTopic,
        saveTopic,
        deleteTopic,
        getArticles,
        getArticle,
        saveArticle,
        deleteArticle,
        getStats,
        getGitHubConfig,
        saveGitHubConfig,
        publishToGitHub,
        downloadMarkdown,
        exportBackup,
        importBackup,
        renderMarkdown,
        slugify
    };
})();
