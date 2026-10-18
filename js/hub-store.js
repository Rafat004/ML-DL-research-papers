/* ============================================================
   Deep Learning Knowledge Hub — Data Store & Sync Manager
   Handles LocalStorage, Firebase Firestore & Storage,
   GitHub REST API commits, Markdown parsing, and JSON Backup/Restore.
   ============================================================ */

const HubStore = (() => {
    const STORAGE_KEY_TOPICS = 'dl_hub_topics_v1';
    const STORAGE_KEY_ARTICLES = 'dl_hub_articles_v1';
    const STORAGE_KEY_GITHUB = 'dl_hub_github_config_v1';

    const INITIAL_TOPICS = [
        {
            id: 'top-mldl-roadmap',
            name: 'ML/DL roadmap',
            slug: 'mldl-roadmap',
            icon: '🧠',
            tag: 'roadmap',
            order: 0,
            description: 'Custom deep learning topic notes and code.',
            createdAt: 1700000000000,
            updatedAt: 1700000000000
        }
    ];
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

    /* ---- Helper: Detect if topic is Roadmap topic ---- */
    function isRoadmapTopic(topic) {
        if (!topic) return false;
        const s = (topic.slug || '').toLowerCase();
        const n = (topic.name || '').toLowerCase();
        const t = (topic.tag || '').toLowerCase();
        return s.includes('roadmap') || n.includes('roadmap') || t.includes('roadmap') || Boolean(topic.isRoadmap) || Boolean(topic.customHtml && topic.customHtml.trim().length > 0) || Boolean(topic.customHtmlUrl && topic.customHtmlUrl.trim().length > 0);
    }

    /* ---- Helper: Detect if topic has an interactive HTML page ---- */
    function topicHasHtml(topic) {
        if (!topic) return false;
        if (topic.customHtml && topic.customHtml.trim().length > 0) return true;
        if (topic.customHtmlUrl && topic.customHtmlUrl.trim().length > 0) return true;
        return isRoadmapTopic(topic);
    }

    function getStarterHtmlTemplate(topicName = 'Deep Learning Topic') {
        const safeName = (topicName || 'Deep Learning Topic').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeName} — Interactive Overview</title>
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
    <h1>${safeName}</h1>
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

    function getTopicHtmlInfo(topic) {
        if (!topic) return null;
        const isRoadmap = isRoadmapTopic(topic);
        const hasCode = Boolean(topic.customHtml && topic.customHtml.trim().length > 0);
        const hasUrl = Boolean(topic.customHtmlUrl && topic.customHtmlUrl.trim().length > 0);

        if (!hasCode && !hasUrl && !isRoadmap) return null;

        return {
            hasCode,
            hasUrl,
            customHtml: hasCode ? topic.customHtml : '',
            url: hasUrl ? topic.customHtmlUrl : (isRoadmap ? 'ml.html' : ''),
            title: topic.htmlTitle || (isRoadmap ? '🗺️ Machine Learning Interactive Roadmap' : '🗺️ Interactive View'),
            tag: topic.htmlTag || (isRoadmap ? '10 Core Branches' : 'Interactive App')
        };
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

    /* ---- Deduplication & Concurrency Guards ---- */
    const pendingTopicSaves = new Map();
    let isCleaningFirestoreDuplicates = false;

    function deduplicateTopics(topicsList) {
        if (!Array.isArray(topicsList) || topicsList.length === 0) {
            return { deduped: [], duplicatesToDelete: [] };
        }

        const uniqueMap = new Map();
        const duplicatesToDelete = [];

        topicsList.forEach(topic => {
            if (!topic || (!topic.name && !topic.slug && !topic.id)) return;
            const rawName = (topic.name || '').trim();
            const s = (topic.slug || slugify(rawName || 'untitled-topic')).toLowerCase().trim();
            const n = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
            // Key primarily by slug, fallback to alphanumeric name
            const key = s || n;
            if (!key) return;

            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, { ...topic, slug: topic.slug || s });
            } else {
                const existing = uniqueMap.get(key);
                const existingHasHtml = Boolean((existing.customHtml && existing.customHtml.trim()) || existing.customHtmlUrl);
                const topicHasHtml = Boolean((topic.customHtml && topic.customHtml.trim()) || topic.customHtmlUrl);

                let winner = existing;
                let loser = topic;

                if (topicHasHtml && !existingHasHtml) {
                    winner = { ...topic, slug: topic.slug || s };
                    loser = existing;
                } else if (!topicHasHtml && existingHasHtml) {
                    winner = existing;
                    loser = topic;
                } else {
                    const timeA = existing.updatedAt || existing.createdAt || 0;
                    const timeB = topic.updatedAt || topic.createdAt || 0;
                    if (timeB >= timeA) {
                        winner = { ...topic, slug: topic.slug || s };
                        loser = existing;
                    } else {
                        winner = existing;
                        loser = topic;
                    }
                }

                // Preserve non-empty fields from loser if winner lacks them
                if (!winner.description && loser.description) winner.description = loser.description;
                if (!winner.customHtml && loser.customHtml) winner.customHtml = loser.customHtml;
                if (!winner.customHtmlUrl && loser.customHtmlUrl) winner.customHtmlUrl = loser.customHtmlUrl;
                if (!winner.htmlTitle && loser.htmlTitle) winner.htmlTitle = loser.htmlTitle;
                if (!winner.htmlTag && loser.htmlTag) winner.htmlTag = loser.htmlTag;
                if (!winner.icon && loser.icon) winner.icon = loser.icon;
                if (!winner.tag && loser.tag) winner.tag = loser.tag;
                if (winner.order === undefined && loser.order !== undefined) winner.order = loser.order;
                if (!winner.createdAt || (loser.createdAt && loser.createdAt < winner.createdAt)) {
                    winner.createdAt = loser.createdAt;
                }

                uniqueMap.set(key, winner);

                if (loser.id && loser.id !== winner.id) {
                    duplicatesToDelete.push({ loserId: loser.id, winnerId: winner.id, slug: winner.slug });
                }
            }
        });

        const deduped = Array.from(uniqueMap.values());
        deduped.sort((a, b) => {
            const orderA = (a.order !== undefined && a.order !== null) ? a.order : 9999;
            const orderB = (b.order !== undefined && b.order !== null) ? b.order : 9999;
            if (orderA !== orderB) return orderA - orderB;
            return (a.createdAt || 0) - (b.createdAt || 0);
        });
        return { deduped, duplicatesToDelete };
    }

    function remapArticleTopicIds(duplicates) {
        if (!duplicates || duplicates.length === 0) return;
        try {
            const rawArticles = localStorage.getItem(STORAGE_KEY_ARTICLES);
            if (!rawArticles) return;
            const articles = JSON.parse(rawArticles);
            if (!Array.isArray(articles) || articles.length === 0) return;

            let changed = false;
            const remapMap = new Map();
            duplicates.forEach(d => {
                if (d.loserId && d.winnerId && d.loserId !== d.winnerId) {
                    remapMap.set(d.loserId, d.winnerId);
                }
            });

            if (remapMap.size === 0) return;

            articles.forEach(art => {
                if (art.topicId && remapMap.has(art.topicId)) {
                    art.topicId = remapMap.get(art.topicId);
                    changed = true;
                }
            });

            if (changed) {
                localStorage.setItem(STORAGE_KEY_ARTICLES, JSON.stringify(articles));
            }
        } catch (e) {
            console.warn('Error remapping article topic IDs:', e);
        }
    }

    async function cleanupFirestoreTopicDuplicates(duplicates) {
        const db = getFirebaseDb();
        if (!db || !Array.isArray(duplicates) || duplicates.length === 0) return;
        if (isCleaningFirestoreDuplicates) return;
        isCleaningFirestoreDuplicates = true;

        try {
            for (const item of duplicates) {
                if (item.loserId && item.loserId !== item.winnerId) {
                    try {
                        await db.collection('topics').doc(item.loserId).delete();
                        console.log(`[HubStore] Cleaned up duplicate topic doc from Firestore: ${item.loserId} (${item.slug})`);
                    } catch (docErr) {
                        console.warn(`[HubStore] Could not delete duplicate topic doc ${item.loserId}:`, docErr.message);
                    }
                }
            }
        } finally {
            isCleaningFirestoreDuplicates = false;
        }
    }

    /* ---- Topics Storage ---- */
    function getTopics() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_TOPICS);
            let list = null;
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        list = parsed;
                    }
                } catch (e) {}
            }
            if (!list) {
                return [...INITIAL_TOPICS];
            }

            const { deduped, duplicatesToDelete } = deduplicateTopics(list);
            if (duplicatesToDelete.length > 0 || deduped.length !== list.length) {
                localStorage.setItem(STORAGE_KEY_TOPICS, JSON.stringify(deduped));
                if (duplicatesToDelete.length > 0) {
                    remapArticleTopicIds(duplicatesToDelete);
                    cleanupFirestoreTopicDuplicates(duplicatesToDelete);
                }
            }
            return deduped;
        } catch (e) {
            console.error('Error reading topics from localStorage:', e);
            return [...INITIAL_TOPICS];
        }
    }

    function getTopic(idOrSlug) {
        if (!idOrSlug) return null;
        const topics = getTopics();
        let found = topics.find(t => t.id === idOrSlug || t.slug === idOrSlug);
        if (!found) {
            const clean = idOrSlug.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
            found = topics.find(t => (t.slug || '').toLowerCase().replace(/[^a-z0-9]/g, '') === clean || 
                                     (t.name || '').toLowerCase().replace(/[^a-z0-9]/g, '') === clean);
        }
        if (!found && (idOrSlug.toLowerCase().includes('roadmap') || idOrSlug === 'top-mldl-roadmap')) {
            found = INITIAL_TOPICS.find(t => t.slug === 'mldl-roadmap');
        }
        return found || null;
    }

    async function saveTopic(topicData) {
        if (!topicData || !topicData.name || !topicData.name.trim()) {
            throw new Error('Topic name is required');
        }

        const name = topicData.name.trim();
        const slug = slugify(name || 'untitled-topic');

        // Mutex: Coalesce concurrent save requests for the same slug
        if (pendingTopicSaves.has(slug)) {
            return await pendingTopicSaves.get(slug);
        }

        const saveAction = (async () => {
            const topics = getTopics();
            const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '');

            let existingIndex = -1;
            if (topicData.id) {
                existingIndex = topics.findIndex(t => t.id === topicData.id);
            }
            if (existingIndex < 0) {
                existingIndex = topics.findIndex(t => 
                    t.slug === slug || 
                    (t.name && t.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedName)
                );
            }

            const now = Date.now();
            const existing = existingIndex >= 0 ? topics[existingIndex] : null;

            const topicRecord = {
                id: (existing && existing.id) ? existing.id : (topicData.id || uid('top')),
                name: name,
                slug: slug,
                order: (existing && existing.order !== undefined) ? existing.order : (topicData.order !== undefined ? topicData.order : topics.length),
                icon: topicData.icon || (existing ? existing.icon : '🧠'),
                tag: topicData.tag || (existing ? existing.tag : 'Deep Learning'),
                description: (topicData.description !== undefined ? topicData.description : (existing ? existing.description : '')).trim(),
                customHtml: topicData.customHtml !== undefined ? topicData.customHtml : (existing ? existing.customHtml || '' : ''),
                customHtmlUrl: topicData.customHtmlUrl !== undefined ? topicData.customHtmlUrl : (existing ? existing.customHtmlUrl || '' : ''),
                htmlTitle: topicData.htmlTitle !== undefined ? topicData.htmlTitle : (existing ? existing.htmlTitle || '' : ''),
                htmlTag: topicData.htmlTag !== undefined ? topicData.htmlTag : (existing ? existing.htmlTag || '' : ''),
                createdAt: existing ? (existing.createdAt || now) : now,
                updatedAt: now
            };

            if (existingIndex >= 0) {
                topics[existingIndex] = topicRecord;
            } else {
                topics.push(topicRecord);
            }

            const { deduped, duplicatesToDelete } = deduplicateTopics(topics);
            localStorage.setItem(STORAGE_KEY_TOPICS, JSON.stringify(deduped));
            if (duplicatesToDelete.length > 0) {
                remapArticleTopicIds(duplicatesToDelete);
                cleanupFirestoreTopicDuplicates(duplicatesToDelete);
            }

            let cloudSaved = false;
            let cloudError = null;

            // Save to Firebase Firestore if connected
            const db = getFirebaseDb();
            if (db) {
                try {
                    await db.collection('topics').doc(topicRecord.id).set(topicRecord);
                    cloudSaved = true;
                } catch (err) {
                    console.error('Failed to save topic to Firebase:', err);
                    cloudError = err.message;
                }
            }

            return { ...topicRecord, cloudSaved, cloudError };
        })();

        pendingTopicSaves.set(slug, saveAction);
        try {
            return await saveAction;
        } finally {
            pendingTopicSaves.delete(slug);
        }
    }

    async function deleteTopic(topicIdOrSlug) {
        const topic = getTopic(topicIdOrSlug);
        const targetId = topic ? topic.id : topicIdOrSlug;
        const targetSlug = topic ? topic.slug : topicIdOrSlug;
        const targetName = topic ? topic.name : '';

        const normalizedTargetSlug = (targetSlug || slugify(targetName || '')).toLowerCase().trim();
        const normalizedTargetName = (targetName || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');

        const allTopics = getTopics();
        const idsToDelete = new Set();
        if (targetId) idsToDelete.add(targetId);

        allTopics.forEach(t => {
            const s = (t.slug || slugify(t.name || '')).toLowerCase().trim();
            const n = (t.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            if (t.id === targetId || s === normalizedTargetSlug || (normalizedTargetName && n === normalizedTargetName)) {
                if (t.id) idsToDelete.add(t.id);
            }
        });

        let topics = allTopics.filter(t => !idsToDelete.has(t.id));
        localStorage.setItem(STORAGE_KEY_TOPICS, JSON.stringify(topics));

        // Also remove articles belonging to this topic locally
        let articles = getArticles().filter(a => 
            !idsToDelete.has(a.topicId) && 
            a.topicSlug !== targetSlug && 
            (!targetName || a.topicName !== targetName)
        );
        if (topics.length === 0) {
            articles = [];
        }
        localStorage.setItem(STORAGE_KEY_ARTICLES, JSON.stringify(articles));

        // Delete from Firebase Firestore if connected
        const db = getFirebaseDb();
        if (db) {
            try {
                for (const id of idsToDelete) {
                    try {
                        await db.collection('topics').doc(id).delete();
                    } catch (err) {}
                }

                // Delete matching articles from Firestore by topicId
                for (const id of idsToDelete) {
                    const artsSnap = await db.collection('articles')
                        .where('topicId', '==', id)
                        .get();
                    if (!artsSnap.empty) {
                        const batch = db.batch();
                        artsSnap.forEach(doc => batch.delete(doc.ref));
                        await batch.commit();
                    }
                }

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

    async function reorderTopics(orderedIds) {
        if (!Array.isArray(orderedIds) || orderedIds.length === 0) return getTopics();

        const topics = getTopics();
        const idMap = new Map();
        topics.forEach(t => idMap.set(t.id, t));

        const now = Date.now();
        const reordered = [];
        const changedTopics = [];

        orderedIds.forEach((id, idx) => {
            const t = idMap.get(id);
            if (t) {
                if (t.order !== idx) {
                    t.order = idx;
                    t.updatedAt = now;
                    changedTopics.push(t);
                }
                reordered.push(t);
                idMap.delete(id);
            }
        });

        // Any leftover topics not in orderedIds are appended at the end
        Array.from(idMap.values()).forEach((t, extraIdx) => {
            const newOrder = reordered.length + extraIdx;
            if (t.order !== newOrder) {
                t.order = newOrder;
                t.updatedAt = now;
                changedTopics.push(t);
            }
            reordered.push(t);
        });

        localStorage.setItem(STORAGE_KEY_TOPICS, JSON.stringify(reordered));

        // Sync with Firebase Firestore if connected
        const db = getFirebaseDb();
        if (db && changedTopics.length > 0) {
            try {
                const batch = db.batch();
                changedTopics.forEach(t => {
                    const docRef = db.collection('topics').doc(t.id);
                    batch.set(docRef, t, { merge: true });
                });
                await batch.commit();
            } catch (err) {
                console.warn('[HubStore] Cloud batch update topic order fallback:', err.message);
                for (const t of changedTopics) {
                    try {
                        await db.collection('topics').doc(t.id).set(t, { merge: true });
                    } catch (e) {}
                }
            }
        }

        return reordered;
    }

    /* ---- Drag & Drop Topic Cards Reordering (PowerPoint Slide style) ---- */
    let suppressCardClick = false;

    function showTopicReorderToast(message) {
        let toast = document.getElementById('topic-reorder-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'topic-reorder-toast';
            toast.className = 'topic-reorder-toast';
            document.body.appendChild(toast);
        }
        const safeMsg = (message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        toast.innerHTML = `<span style="font-size: 1.1rem; line-height: 1;">⇅</span><span>${safeMsg}</span>`;
        toast.classList.add('visible');
        if (toast._timer) clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.classList.remove('visible');
        }, 2200);
    }

    function initTopicDragAndDrop(gridContainer, callback) {
        if (!gridContainer) return;

        let draggedCard = null;
        const cards = gridContainer.querySelectorAll('.topic-card:not(.topic-card-add)');

        cards.forEach(card => {
            card.setAttribute('draggable', 'true');

            // Drag Start
            card.addEventListener('dragstart', (e) => {
                draggedCard = card;
                suppressCardClick = true;
                card.classList.add('is-dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', card.getAttribute('data-topic-id') || '');

                setTimeout(() => {
                    if (draggedCard === card) {
                        card.style.opacity = '0.35';
                    }
                }, 0);
            });

            // Drag Over
            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (!draggedCard || draggedCard === card) return;

                const rect = card.getBoundingClientRect();
                const midX = rect.left + rect.width / 2;

                if (e.clientX < midX) {
                    card.classList.add('drop-before');
                    card.classList.remove('drop-after');
                } else {
                    card.classList.add('drop-after');
                    card.classList.remove('drop-before');
                }
            });

            // Drag Leave
            card.addEventListener('dragleave', (e) => {
                if (!card.contains(e.relatedTarget)) {
                    card.classList.remove('drop-before', 'drop-after');
                }
            });

            // Drop
            card.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                if (!draggedCard || draggedCard === card) {
                    cleanupDragStyles();
                    return;
                }

                const isBefore = card.classList.contains('drop-before');
                cleanupDragStyles();

                // Re-insert dragged card in DOM
                if (isBefore) {
                    gridContainer.insertBefore(draggedCard, card);
                } else {
                    gridContainer.insertBefore(draggedCard, card.nextSibling);
                }

                // Immediately re-serialize numbers 01, 02, 03... on all cards
                const currentCards = gridContainer.querySelectorAll('.topic-card:not(.topic-card-add)');
                const newOrderedIds = [];
                let newMovedIndex = -1;
                const movedTopicId = draggedCard.getAttribute('data-topic-id');
                const movedTopicTitle = draggedCard.querySelector('.topic-title')?.textContent?.trim() || 'Topic';

                currentCards.forEach((c, index) => {
                    const id = c.getAttribute('data-topic-id');
                    if (id) newOrderedIds.push(id);
                    if (id === movedTopicId) {
                        newMovedIndex = index;
                    }
                    const numEl = c.querySelector('.topic-number');
                    if (numEl) {
                        const newNumStr = (index + 1).toString().padStart(2, '0');
                        if (numEl.textContent !== newNumStr) {
                            numEl.textContent = newNumStr;
                            numEl.classList.remove('updated-pulse');
                            void numEl.offsetWidth; // Trigger reflow for animation
                            numEl.classList.add('updated-pulse');
                        }
                    }
                });

                // Persist the new sequence in LocalStorage and Firebase
                try {
                    await reorderTopics(newOrderedIds);
                    const serialStr = (newMovedIndex + 1).toString().padStart(2, '0');
                    showTopicReorderToast(`Moved "${movedTopicTitle}" to #${serialStr}`);
                    if (typeof callback === 'function') {
                        callback(newOrderedIds);
                    }
                } catch (err) {
                    console.warn('Error saving topic order:', err);
                }
            });

            // Drag End
            card.addEventListener('dragend', () => {
                cleanupDragStyles();
                // Block navigation click after drag
                setTimeout(() => {
                    suppressCardClick = false;
                    draggedCard = null;
                }, 200);
            });

            // Prevent link navigation if drag occurred
            card.addEventListener('click', (e) => {
                if (suppressCardClick) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            });
        });

        // Also allow dropping onto the "+ Add Topic" action card (moves item to the end)
        const addCard = gridContainer.querySelector('.topic-card-add');
        if (addCard) {
            addCard.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                addCard.classList.add('drop-before');
            });
            addCard.addEventListener('dragleave', () => {
                addCard.classList.remove('drop-before');
            });
            addCard.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                addCard.classList.remove('drop-before');
                if (!draggedCard) return;

                gridContainer.insertBefore(draggedCard, addCard);
                cleanupDragStyles();

                const currentCards = gridContainer.querySelectorAll('.topic-card:not(.topic-card-add)');
                const newOrderedIds = [];
                currentCards.forEach((c, index) => {
                    const id = c.getAttribute('data-topic-id');
                    if (id) newOrderedIds.push(id);
                    const numEl = c.querySelector('.topic-number');
                    if (numEl) {
                        numEl.textContent = (index + 1).toString().padStart(2, '0');
                    }
                });
                await reorderTopics(newOrderedIds);
                showTopicReorderToast(`Topic moved to end of sequence`);
            });
        }

        function cleanupDragStyles() {
            if (draggedCard) {
                draggedCard.classList.remove('is-dragging');
                draggedCard.style.opacity = '';
            }
            gridContainer.querySelectorAll('.topic-card').forEach(c => {
                c.classList.remove('drop-before', 'drop-after', 'is-dragging');
                c.style.opacity = '';
            });
        }
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
            isHtmlNote: Boolean(articleData.isHtmlNote),
            customHtml: articleData.customHtml || '',
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
        const rawMerged = Array.from(map.values());
        const { deduped, duplicatesToDelete } = deduplicateTopics(rawMerged);
        localStorage.setItem(STORAGE_KEY_TOPICS, JSON.stringify(deduped));
        if (duplicatesToDelete.length > 0) {
            remapArticleTopicIds(duplicatesToDelete);
            cleanupFirestoreTopicDuplicates(duplicatesToDelete);
        }
        return deduped;
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
            const rawRemoteTopics = [];
            topicsSnap.forEach(doc => {
                const data = doc.data();
                if (data && (data.name || data.id)) {
                    if (!data.id) data.id = doc.id;
                    rawRemoteTopics.push(data);
                }
            });

            const { deduped: remoteTopics, duplicatesToDelete } = deduplicateTopics(rawRemoteTopics);
            if (duplicatesToDelete.length > 0) {
                remapArticleTopicIds(duplicatesToDelete);
                cleanupFirestoreTopicDuplicates(duplicatesToDelete);
            }

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
                    if (data && (data.name || data.id)) {
                        if (!data.id) data.id = d.id;
                        list.push(data);
                    }
                });
                const { deduped, duplicatesToDelete } = deduplicateTopics(list);
                if (duplicatesToDelete.length > 0) {
                    remapArticleTopicIds(duplicatesToDelete);
                    cleanupFirestoreTopicDuplicates(duplicatesToDelete);
                }
                localStorage.setItem(STORAGE_KEY_TOPICS, JSON.stringify(deduped));
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
        reorderTopics,
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
        slugify,
        deduplicateTopics,
        cleanupFirestoreTopicDuplicates,
        isRoadmapTopic,
        topicHasHtml,
        getTopicHtmlInfo,
        getStarterHtmlTemplate,
        initTopicDragAndDrop,
        showTopicReorderToast
    };
})();
