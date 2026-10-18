/* ============================================================
   Deep Learning Knowledge Hub — Data Store & Sync Manager
   Handles LocalStorage, Firebase Firestore & Storage,
   GitHub REST API commits, Markdown parsing, and JSON Backup/Restore.
   ============================================================ */

const HubStore = (() => {
    const STORAGE_KEY_TOPICS = 'dl_hub_topics_v1';
    const STORAGE_KEY_ARTICLES = 'dl_hub_articles_v1';
    const STORAGE_KEY_GITHUB = 'dl_hub_github_config_v1';

    const INITIAL_TOPICS = [];
    const INITIAL_ARTICLES = [];

    let realtimeActive = false;

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

    /* ---- Firebase Helper ---- */
    function getFirebaseDb() {
        if (typeof FirebaseConfig !== 'undefined' && FirebaseConfig.isConfigured()) {
            return FirebaseConfig.getDb();
        }
        return null;
    }

    function getFirebaseStorage() {
        if (typeof FirebaseConfig !== 'undefined' && FirebaseConfig.isConfigured()) {
            return FirebaseConfig.getStorage();
        }
        return null;
    }

    function isFirebaseConnected() {
        return Boolean(getFirebaseDb());
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

    async function saveTopic(topicData) {
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

        // Save to Firebase Firestore if connected
        const db = getFirebaseDb();
        if (db) {
            try {
                await db.collection('topics').doc(topicRecord.id).set(topicRecord);
            } catch (err) {
                console.error('Failed to save topic to Firebase:', err);
            }
        }

        return topicRecord;
    }

    async function deleteTopic(topicIdOrSlug) {
        const topic = getTopic(topicIdOrSlug);
        const targetId = topic ? topic.id : topicIdOrSlug;
        const targetSlug = topic ? topic.slug : topicIdOrSlug;
        const targetName = topic ? topic.name : '';

        let topics = getTopics().filter(t => t.id !== targetId && t.slug !== targetSlug);
        localStorage.setItem(STORAGE_KEY_TOPICS, JSON.stringify(topics));

        // Also remove articles belonging to this topic locally
        let articles = getArticles().filter(a => 
            a.topicId !== targetId && 
            a.topicSlug !== targetSlug && 
            (!targetName || a.topicName !== targetName)
        );
        // If no topics remain, clean any orphan articles
        if (topics.length === 0) {
            articles = [];
        }
        localStorage.setItem(STORAGE_KEY_ARTICLES, JSON.stringify(articles));

        // Delete from Firebase Firestore if connected
        const db = getFirebaseDb();
        if (db) {
            try {
                await db.collection('topics').doc(targetId).delete();

                // Delete matching articles from Firestore by topicId
                const artsSnap = await db.collection('articles')
                    .where('topicId', '==', targetId)
                    .get();
                const batch = db.batch();
                artsSnap.forEach(doc => batch.delete(doc.ref));
                await batch.commit();

                // Also delete by topicSlug if any
                if (targetSlug) {
                    const slugSnap = await db.collection('articles')
                        .where('topicSlug', '==', targetSlug)
                        .get();
                    if (!slugSnap.empty) {
                        const batch2 = db.batch();
                        slugSnap.forEach(doc => batch2.delete(doc.ref));
                        await batch2.commit();
                    }
                }
            } catch (err) {
                console.error('Failed to delete topic from Firebase:', err);
            }
        }

        return true;
    }

    /* ---- Articles Storage ---- */
    function getArticles(topicIdOrSlug = null) {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_ARTICLES);
            let articles = raw ? JSON.parse(raw) : INITIAL_ARTICLES;

            // Self-healing: if no topics exist, purge any stale orphan articles
            const topicsRaw = localStorage.getItem(STORAGE_KEY_TOPICS);
            const topics = topicsRaw ? JSON.parse(topicsRaw) : [];
            if (topics.length === 0 && articles.length > 0) {
                localStorage.setItem(STORAGE_KEY_ARTICLES, JSON.stringify([]));
                return [];
            }

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
        const article = articles.find(a => a.id === idOrSlug || a.slug === idOrSlug) || null;
        if (article && (!article.sections || !Array.isArray(article.sections) || article.sections.length === 0)) {
            article.sections = [
                {
                    description: article.excerpt || '',
                    diagram: article.diagram || '',
                    diagramCaption: article.diagramCaption || ''
                }
            ];
        }
        return article;
    }

    async function uploadDiagramIfNeeded(articleId, diagramData) {
        if (!diagramData) return '';
        // If already an HTTP/HTTPS URL, no upload needed
        if (diagramData.startsWith('http://') || diagramData.startsWith('https://')) {
            return diagramData;
        }

        // If it's a base64 data URL and Firebase Storage is available
        const storage = getFirebaseStorage();
        if (storage && diagramData.startsWith('data:image/')) {
            try {
                const uploadPromise = (async () => {
                    const ext = diagramData.split(';')[0].split('/')[1] || 'png';
                    const fileRef = storage.ref(`diagrams/${articleId}-${Date.now()}.${ext}`);
                    const snap = await fileRef.putString(diagramData, 'data_url');
                    return await snap.ref.getDownloadURL();
                })();

                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Storage timeout')), 2500)
                );

                return await Promise.race([uploadPromise, timeoutPromise]);
            } catch (err) {
                console.warn('Firebase Storage upload timeout or failed, keeping inline:', err.message);
                return diagramData;
            }
        }

        return diagramData;
    }

    async function saveArticle(articleData) {
        const articles = getArticles();
        const slug = slugify(articleData.title || 'untitled-article');
        const artId = articleData.id || uid('art');
        
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

        // Normalize and upload multi-slot sections
        let sections = [];
        if (Array.isArray(articleData.sections) && articleData.sections.length > 0) {
            sections = JSON.parse(JSON.stringify(articleData.sections));
        } else {
            sections = [
                {
                    description: (articleData.excerpt || '').trim(),
                    diagram: articleData.diagram || '',
                    diagramCaption: (articleData.diagramCaption || '').trim()
                }
            ];
        }

        // Upload any base64 diagrams in sections to Firebase Storage if available
        for (let i = 0; i < sections.length; i++) {
            if (sections[i].diagram && sections[i].diagram.startsWith('data:image/')) {
                try {
                    sections[i].diagram = await uploadDiagramIfNeeded(`${artId}-diag-${i + 1}`, sections[i].diagram);
                } catch (e) {
                    console.warn(`Error uploading diagram ${i + 1}:`, e);
                }
            }
        }

        const primarySection = sections.find(s => s.description || s.diagram) || sections[0] || { description: '', diagram: '', diagramCaption: '' };
        const primaryDiagram = primarySection.diagram || articleData.diagram || '';
        const primaryCaption = primarySection.diagramCaption || (articleData.diagramCaption || '').trim();
        const primaryExcerpt = primarySection.description || (articleData.excerpt || '').trim() || generateExcerpt(articleData.content || '');

        const articleRecord = {
            id: artId,
            title: (articleData.title || 'Untitled Article').trim(),
            slug: slug,
            topicId: articleData.topicId || '',
            topicName: articleData.topicName || 'General',
            topicSlug: slugify(articleData.topicName || 'general'),
            date: dateStr,
            excerpt: primaryExcerpt,
            tags: tags,
            content: articleData.content || '',
            diagram: primaryDiagram,
            diagramCaption: primaryCaption,
            sections: sections,
            createdAt: existingIndex >= 0 ? articles[existingIndex].createdAt : now,
            updatedAt: now
        };

        if (existingIndex >= 0) {
            articles[existingIndex] = articleRecord;
        } else {
            articles.unshift(articleRecord);
        }

        localStorage.setItem(STORAGE_KEY_ARTICLES, JSON.stringify(articles));

        // Ensure topic exists locally and in cloud
        if (articleRecord.topicName) {
            const topic = getTopic(articleRecord.topicSlug);
            if (!topic) {
                saveTopic({
                    name: articleRecord.topicName,
                    icon: '🧠',
                    tag: 'Custom Topic',
                    description: `Research notes and implementations for ${articleRecord.topicName}`
                }).catch(console.error);
            }
        }

        // Save to Firebase Firestore if connected
        const db = getFirebaseDb();
        if (db) {
            try {
                const writePromise = db.collection('articles').doc(articleRecord.id).set(articleRecord);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Cloud write timeout')), 3000)
                );
                await Promise.race([writePromise, timeoutPromise]);
            } catch (err) {
                console.warn('Firebase save note:', err.message);
                if (err.code === 'permission-denied') {
                    throw new Error('Firebase Permission Denied! Please check your Firestore Rules in Firebase Console.');
                }
            }
        }

        return articleRecord;
    }

    async function deleteArticle(articleId) {
        let articles = getArticles().filter(a => a.id !== articleId);
        localStorage.setItem(STORAGE_KEY_ARTICLES, JSON.stringify(articles));

        // Delete from Firebase Firestore if connected
        const db = getFirebaseDb();
        if (db) {
            try {
                await db.collection('articles').doc(articleId).delete();
            } catch (err) {
                console.error('Failed to delete article from Firebase:', err);
            }
        }

        return true;
    }

    function generateExcerpt(content, maxLen = 160) {
        if (!content) return '';
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
                const matches = art.content.match(/```[a-z]*/gi);
                if (matches) codeCount += Math.floor(matches.length / 2);
            }
            if (art.sections && Array.isArray(art.sections)) {
                diagramCount += art.sections.filter(s => s.diagram).length;
            } else if (art.diagram) {
                diagramCount++;
            }
        });

        return {
            topicsCount: topics.length,
            articlesCount: articles.length,
            codeCount: codeCount,
            diagramsCount: diagramCount
        };
    }

    /* ---- Helper: Smart merge to prevent local data loss ---- */
    function mergeTopics(remoteList) {
        const local = getTopics();
        const map = new Map();
        local.forEach(t => map.set(t.id, t));
        remoteList.forEach(r => {
            const existing = map.get(r.id);
            if (!existing || (r.updatedAt || 0) >= (existing.updatedAt || 0)) {
                map.set(r.id, r);
            }
        });
        const merged = Array.from(map.values());
        localStorage.setItem(STORAGE_KEY_TOPICS, JSON.stringify(merged));
        return merged;
    }

    function mergeArticles(remoteList) {
        const local = getArticles();
        const map = new Map();
        local.forEach(a => map.set(a.id, a));
        remoteList.forEach(r => {
            const existing = map.get(r.id);
            if (!existing || (r.updatedAt || 0) >= (existing.updatedAt || 0)) {
                map.set(r.id, r);
            }
        });
        const merged = Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        localStorage.setItem(STORAGE_KEY_ARTICLES, JSON.stringify(merged));
        return merged;
    }

    /* ---- Local Cache Cleaner ---- */
    function clearLocalCache() {
        localStorage.removeItem(STORAGE_KEY_TOPICS);
        localStorage.removeItem(STORAGE_KEY_ARTICLES);
        window.dispatchEvent(new CustomEvent('hub:synced', { detail: { cleared: true } }));
    }

    /* ---- Cloud Sync with Firebase Firestore ---- */
    async function syncFromFirebase() {
        const db = getFirebaseDb();
        if (!db) return false;

        try {
            // Fetch topics from Firestore
            const topicsSnap = await db.collection('topics').get();
            const remoteTopics = [];
            topicsSnap.forEach(doc => {
                const data = doc.data();
                if (data && (data.name || data.id)) remoteTopics.push(data);
            });

            // Fetch articles from Firestore
            const articlesSnap = await db.collection('articles').get();
            const remoteArticles = [];
            articlesSnap.forEach(doc => {
                const data = doc.data();
                if (data && (data.title || data.id)) remoteArticles.push(data);
            });

            // Mirror authoritative cloud state into localStorage
            localStorage.setItem(STORAGE_KEY_TOPICS, JSON.stringify(remoteTopics));
            localStorage.setItem(STORAGE_KEY_ARTICLES, JSON.stringify(remoteArticles));

            window.dispatchEvent(new CustomEvent('hub:synced', {
                detail: {
                    topicsCount: remoteTopics.length,
                    articlesCount: remoteArticles.length
                }
            }));

            // Start real-time listener if not active
            setupRealtimeSync(db);

            return {
                topicsCount: remoteTopics.length,
                articlesCount: remoteArticles.length
            };
        } catch (err) {
            console.error('Firebase sync failed:', err);
            return false;
        }
    }

    function setupRealtimeSync(db) {
        if (realtimeActive || !db) return;
        realtimeActive = true;

        try {
            db.collection('topics').onSnapshot(snap => {
                const list = [];
                snap.forEach(d => {
                    const data = d.data();
                    if (data && (data.name || data.id)) list.push(data);
                });
                localStorage.setItem(STORAGE_KEY_TOPICS, JSON.stringify(list));
                window.dispatchEvent(new CustomEvent('hub:synced'));
            }, err => console.warn('Topics listener warning:', err));

            db.collection('articles').onSnapshot(snap => {
                const list = [];
                snap.forEach(d => {
                    const data = d.data();
                    if (data && (data.title || data.id)) list.push(data);
                });
                localStorage.setItem(STORAGE_KEY_ARTICLES, JSON.stringify(list));
                window.dispatchEvent(new CustomEvent('hub:synced'));
            }, err => console.warn('Articles listener warning:', err));
        } catch (e) {
            console.warn('Realtime sync setup error:', e);
        }
    }

    /* ---- Migrate Local Data up to Firebase ---- */
    async function uploadLocalDataToFirebase() {
        const db = getFirebaseDb();
        if (!db) throw new Error('Firebase is not configured or connected yet.');

        const topics = getTopics();
        const articles = getArticles();

        let uploadedTopics = 0;
        let uploadedArticles = 0;

        // Batch upload topics
        for (const t of topics) {
            await db.collection('topics').doc(t.id).set(t);
            uploadedTopics++;
        }

        // Batch upload articles
        for (const a of articles) {
            await db.collection('articles').doc(a.id).set(a);
            uploadedArticles++;
        }

        return {
            topicsCount: uploadedTopics,
            articlesCount: uploadedArticles
        };
    }

    /* ---- GitHub Integration ---- */
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

    async function publishToGitHub(article) {
        const config = getGitHubConfig();
        if (!config.owner || !config.repo || !config.token) {
            throw new Error('Please configure your GitHub settings (Username, Repository, and Token) first.');
        }

        const fileName = `${article.slug || slugify(article.title)}.md`;
        const folder = (config.folder || 'notes').replace(/^\/+|\/+$/g, '');
        const filePath = folder ? `${folder}/${fileName}` : fileName;

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

        const utf8Bytes = new TextEncoder().encode(frontmatter);
        let binaryStr = '';
        utf8Bytes.forEach(b => binaryStr += String.fromCharCode(b));
        const base64Content = btoa(binaryStr);

        const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${filePath}`;

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
        } catch (e) {}

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
                token: ''
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

    /* ---- Markdown to HTML parser ---- */
    function renderMarkdown(rawMd) {
        if (!rawMd) return '';

        if (typeof window.marked !== 'undefined' && typeof window.marked.parse === 'function') {
            return window.marked.parse(rawMd);
        }

        let html = rawMd
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        const codeBlocks = [];
        html = html.replace(/```([a-zA-Z0-9_\-\+]*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const id = `__CODE_BLOCK_${codeBlocks.length}__`;
            codeBlocks.push({ lang: lang || 'python', code: code });
            return id;
        });

        const mathBlocks = [];
        html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
            const id = `__MATH_BLOCK_${mathBlocks.length}__`;
            mathBlocks.push(formula);
            return id;
        });

        const mathInlines = [];
        html = html.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
            const id = `__MATH_INLINE_${mathInlines.length}__`;
            mathInlines.push(formula);
            return id;
        });

        html = html
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
            .replace(/`([^`]+)`/gim, '<code>$1</code>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener">$1</a>')
            .replace(/\n\n+/g, '</p><p>')
            .replace(/\n/g, '<br>');

        html = `<p>${html}</p>`;

        mathBlocks.forEach((formula, i) => {
            html = html.replace(`__MATH_BLOCK_${i}__`, `<div class="katex-display-wrapper">$$${formula}$$</div>`);
        });

        mathInlines.forEach((formula, i) => {
            html = html.replace(`__MATH_INLINE_${i}__`, `<span class="katex-inline-wrapper">$${formula}$</span>`);
        });

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

    // Attempt Firebase sync in background immediately upon script execution
    setTimeout(() => {
        syncFromFirebase();
    }, 100);

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
        isFirebaseConnected,
        syncFromFirebase,
        uploadLocalDataToFirebase,
        clearLocalCache,
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
