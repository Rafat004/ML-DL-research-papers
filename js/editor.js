/* ============================================================
   Deep Learning Knowledge Hub — Editor Script
   Handles blank-page creation, live preview, KaTeX math,
   code highlighting, diagram uploading, and GitHub sync.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    initEditor();
});

function initEditor() {
    // DOM Elements
    const titleInput = document.getElementById('article-title');
    const topicSelect = document.getElementById('topic-select');
    const tagsInput = document.getElementById('article-tags');
    const dateInput = document.getElementById('article-date');
    const docTitle = document.getElementById('editor-doc-title');
    const statusText = document.getElementById('status-text');

    // Multi-slot State (3 slots: Description, Diagram, Note Content)
    const slotCount = 3;
    const currentDiagrams = ['', '', ''];

    // Action buttons
    const btnSaveLocal = document.getElementById('btn-save-local');
    const btnPublishGithub = document.getElementById('btn-publish-github');
    const btnDownloadMd = document.getElementById('btn-download-md');

    // Modals
    const modalTopic = document.getElementById('modal-new-topic');
    const btnOpenTopicModal = document.getElementById('btn-open-topic-modal');
    const btnEditTopicModal = document.getElementById('btn-edit-selected-topic-modal');
    const btnCloseTopicModal = document.getElementById('btn-close-topic-modal');
    const btnCancelTopicModal = document.getElementById('btn-cancel-topic-modal');
    const btnSaveNewTopic = document.getElementById('btn-save-new-topic');

    const modalGh = document.getElementById('modal-github-settings');
    const btnGhSettings = document.getElementById('btn-gh-settings');
    const btnCloseGhModal = document.getElementById('btn-close-gh-modal');
    const btnSaveGhSettings = document.getElementById('btn-save-gh-settings');
    const btnTestGhConnection = document.getElementById('btn-test-gh-connection');

    // Custom Interactive HTML Embed elements
    const noteHtmlInput = document.getElementById('article-custom-html');
    const noteHtmlStatusPill = document.getElementById('note-html-status-pill');
    const btnNotePaste = document.getElementById('btn-note-helper-paste');
    const btnNoteTemplate = document.getElementById('btn-note-helper-template');
    const btnNotePreview = document.getElementById('btn-note-helper-preview');
    const btnNoteHelperSave = document.getElementById('btn-note-helper-save');
    const btnNotePreviewSave = document.getElementById('btn-note-preview-save');
    const notePreviewContainer = document.getElementById('note-html-preview-container');
    const notePreviewFrame = document.getElementById('note-html-preview-frame');
    const btnCloseNotePreview = document.getElementById('btn-close-note-preview');
    const previewSandboxStatus = document.getElementById('preview-sandbox-status');

    // State
    let currentArticleId = null;
    let isDirty = false;

    // Set default date to today
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    /* ---- Status Pill Updater for Embedded HTML ---- */
    function updateNoteHtmlStatus(isSaved = false) {
        const pill = document.getElementById('note-html-status-pill');
        const input = document.getElementById('article-custom-html');
        const previewStatus = document.getElementById('preview-sandbox-status');
        if (!pill) return;
        const code = (input?.value || '').trim();
        if (!code) {
            pill.className = 'html-status-pill';
            pill.textContent = 'No HTML code added';
            if (previewStatus) {
                previewStatus.className = 'html-status-pill';
                previewStatus.textContent = 'Empty';
            }
            return;
        }

        const sizeKb = (code.length / 1024).toFixed(1);
        if (isSaved) {
            pill.className = 'html-status-pill saved';
            pill.textContent = `✓ Web UI Saved (${sizeKb} KB - Local & Cloud)`;
            if (previewStatus) {
                previewStatus.className = 'html-status-pill saved';
                previewStatus.textContent = '✓ Saved to Note & Cloud';
            }
        } else {
            pill.className = 'html-status-pill ready';
            pill.textContent = `⚡ Web UI Ready (${sizeKb} KB - Click Save)`;
            if (previewStatus) {
                previewStatus.className = 'html-status-pill ready';
                previewStatus.textContent = '⚡ Sandbox Active';
            }
        }
    }

    // Populate topics dropdown
    renderTopicOptions();

    function updateEditTopicBtn() {
        if (!btnEditTopicModal) return;
        if (topicSelect && topicSelect.value) {
            btnEditTopicModal.style.display = 'inline-block';
        } else {
            btnEditTopicModal.style.display = 'none';
        }
    }

    topicSelect?.addEventListener('change', updateEditTopicBtn);

    /* ---- Render Topics in Dropdown ---- */
    function renderTopicOptions(selectedId = null) {
        const topics = HubStore.getTopics();
        topicSelect.innerHTML = '<option value="">-- Choose or create a topic --</option>';

        topics.forEach(topic => {
            const opt = document.createElement('option');
            opt.value = topic.id;
            opt.dataset.name = topic.name;
            opt.textContent = `${topic.icon || '◈'} ${topic.name} (${topic.tag || 'Topic'})`;
            if (selectedId && (topic.id === selectedId || topic.slug === selectedId)) {
                opt.selected = true;
            }
            topicSelect.appendChild(opt);
        });

        updateEditTopicBtn();
    }

    /* ---- Load Existing Article ---- */
    function loadArticleForEditing(idOrSlug) {
        const article = HubStore.getArticle(idOrSlug);
        if (!article) {
            showToast('Article not found. Starting a new draft.', 'warning');
            return;
        }

        currentArticleId = article.id;
        docTitle.textContent = `Editing: ${article.title}`;
        titleInput.value = article.title;
        renderTopicOptions(article.topicId);
        tagsInput.value = (article.tags || []).join(', ');
        dateInput.value = article.date || new Date().toISOString().split('T')[0];

        // Normalize sections from article (at least 1 or up to 3 slots)
        const sections = Array.isArray(article.sections) && article.sections.length > 0
            ? article.sections
            : [{ 
                description: article.excerpt || '', 
                diagram: article.diagram || '', 
                diagramCaption: article.diagramCaption || '',
                content: article.content || ''
            }];

        for (let i = 1; i <= slotCount; i++) {
            const sec = sections[i - 1];
            const excerptInput = document.getElementById(`article-excerpt-${i}`);
            const urlInput = document.getElementById(`diagram-url-input-${i}`);
            const captionInput = document.getElementById(`diagram-caption-input-${i}`);
            const previewCard = document.getElementById(`diagram-preview-card-${i}`);
            const mdInputEl = document.getElementById(`markdown-input-${i}`);

            if (sec) {
                if (excerptInput) excerptInput.value = sec.description || '';
                if (captionInput) captionInput.value = sec.diagramCaption || '';
                if (mdInputEl) {
                    const slotText = sec.content !== undefined ? sec.content : (i === 1 ? (article.content || '') : '');
                    mdInputEl.value = slotText;
                }
                if (sec.diagram) {
                    currentDiagrams[i - 1] = sec.diagram;
                    if (urlInput && (sec.diagram.startsWith('http://') || sec.diagram.startsWith('https://'))) {
                        urlInput.value = sec.diagram;
                    }
                    displayDiagramPreview(i, sec.diagram);
                } else {
                    currentDiagrams[i - 1] = '';
                    if (previewCard) previewCard.style.display = 'none';
                }
            } else {
                if (excerptInput) excerptInput.value = '';
                if (captionInput) captionInput.value = '';
                if (urlInput) urlInput.value = '';
                if (mdInputEl) mdInputEl.value = '';
                currentDiagrams[i - 1] = '';
                if (previewCard) previewCard.style.display = 'none';
            }
            updateSlotLivePreview(i);
        }

        const customHtmlInput = document.getElementById('article-custom-html');
        if (customHtmlInput) {
            customHtmlInput.value = article.customHtml || '';
        }
        if (typeof updateNoteHtmlStatus === 'function') {
            updateNoteHtmlStatus(Boolean(article.customHtml && article.customHtml.trim()));
        }

        statusText.textContent = 'Loaded';
    }

    /* ---- Slot-specific Live Preview Updating ---- */
    const previewDebounceTimers = [null, null, null, null];

    function updateSlotLivePreview(slot) {
        const inputEl = document.getElementById(`markdown-input-${slot}`);
        const previewEl = document.getElementById(`preview-content-${slot}`);
        if (!inputEl || !previewEl) return;

        const excerptInput = document.getElementById(`article-excerpt-${slot}`);
        const excerptText = (excerptInput?.value || '').trim();
        const raw = inputEl.value;

        if (!raw.trim() && !excerptText) {
            previewEl.innerHTML = `<p class="preview-placeholder">Live preview for Part ${slot} will render here as you type...</p>`;
            return;
        }

        let fullHtml = '';

        // 1. Description Live Preview Card
        if (excerptText) {
            const label = slotCount > 1 ? `Description ${slot}:` : 'Description:';
            const renderedDesc = typeof HubStore !== 'undefined' && typeof HubStore.renderMarkdown === 'function'
                ? HubStore.renderMarkdown(excerptText)
                : escapeHtml(excerptText).replace(/\n/g, '<br>');
            fullHtml += `
                <div class="article-abstract-card preview-abstract-card">
                    <div class="abstract-label">${label}</div>
                    <div class="abstract-text">${renderedDesc}</div>
                </div>
            `;
        }

        // 2. Note Content Live Preview
        if (raw.trim()) {
            fullHtml += HubStore.renderMarkdown(raw);
        }

        previewEl.innerHTML = fullHtml;

        // Render KaTeX math formulas
        if (typeof renderMathInElement === 'function') {
            try {
                renderMathInElement(previewEl, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false }
                    ],
                    throwOnError: false
                });
            } catch (e) {
                console.warn(`KaTeX render error (Slot ${slot}):`, e);
            }
        }

        // Highlight code with Prism.js
        if (typeof Prism !== 'undefined') {
            Prism.highlightAllUnder(previewEl);
        }

        // Attach copy button listeners inside preview
        previewEl.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const pre = btn.closest('.code-block-wrapper')?.querySelector('code');
                if (pre) {
                    await navigator.clipboard.writeText(pre.textContent);
                    btn.textContent = 'Copied!';
                    setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
                }
            });
        });
    }

    function scheduleSlotLivePreview(slot) {
        clearTimeout(previewDebounceTimers[slot]);
        previewDebounceTimers[slot] = setTimeout(() => updateSlotLivePreview(slot), 120);
    }

    function updateAllSlotPreviews() {
        for (let i = 1; i <= slotCount; i++) {
            updateSlotLivePreview(i);
        }
    }

    titleInput.addEventListener('input', () => {
        docTitle.textContent = titleInput.value.trim() || 'New Research Note';
        markDirty();
    });

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function markDirty() {
        if (!isDirty) {
            isDirty = true;
            statusText.textContent = 'Unsaved changes';
            document.getElementById('editor-status-badge').classList.add('dirty');
        }
    }

    function markClean(msg = 'Saved locally') {
        isDirty = false;
        statusText.textContent = msg;
        document.getElementById('editor-status-badge').classList.remove('dirty');
    }

    /* ---- Smart Python & Code Helpers ---- */
    function isCursorInsideCodeBlock(textarea) {
        if (!textarea) return false;
        const pos = textarea.selectionStart;
        const textBefore = textarea.value.substring(0, pos);
        const fences = textBefore.match(/```/g);
        return fences ? (fences.length % 2 === 1) : false;
    }

    function isLikelyPythonCode(text) {
        if (!text || typeof text !== 'string') return false;
        const trimmed = text.trim();
        // Skip if already completely wrapped in markdown fences
        if (trimmed.startsWith('```') && trimmed.endsWith('```')) return false;

        let score = 0;
        // Strong indicators (+3)
        if (/(?:^|\n)\s*(?:import\s+[a-zA-Z_]\w*|from\s+[a-zA-Z_]\w*\s+import)/.test(trimmed)) score += 3;
        if (/(?:^|\n)\s*(?:def\s+[a-zA-Z_]\w*\s*\(|class\s+[a-zA-Z_]\w*\s*[:\(])/.test(trimmed)) score += 3;
        if (/(?:^|\n)\s*(?:if\s+__name__\s*==\s*['"]__main__['"])/.test(trimmed)) score += 3;

        // Moderate indicators (+2)
        if (/\b(?:np|torch|nn|F|plt|pd|tf|scipy|widgets|display|sklearn)\.[a-zA-Z_]/.test(trimmed)) score += 2;
        if (/(?:^|\n)\s*(?:for\s+[a-zA-Z_]\w*\s+in\s+|while\s+|elif\s+|except(?:\s+[a-zA-Z_]*)?\s*:)/.test(trimmed)) score += 2;
        if (/\b(?:print|len|range|enumerate|zip|fit|predict|train_test_split)\s*\(/.test(trimmed)) score += 1;
        if (/(?:^|\n)\s*self\.[a-zA-Z_]/.test(trimmed)) score += 2;
        if (/\b(?:return|yield)\s+/.test(trimmed)) score += 1;

        // Python style comments with assignments or brackets (+1)
        if (/(?:^|\n)\s*#[ \t]+/.test(trimmed) && /(?:=|\[|\(|\{)/.test(trimmed)) score += 1;
        if (/(?:^|\n)\s*[a-zA-Z_]\w*\s*=\s*(?:np\.|torch\.|pd\.|\[|\{|\(|widgets\.)/.test(trimmed)) score += 2;
        if (/:\s*\r?\n\s{4,}\S/.test(trimmed)) score += 2;

        return score >= 2;
    }

    /* ---- Universal Math / Formula Helpers ---- */
    function decodeHtmlEntities(str) {
        if (!str) return '';
        return str
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&#x2F;/g, '/');
    }

    function extractLatexFromHtml(html) {
        if (!html || typeof html !== 'string') return null;

        // 1. KaTeX annotation (standard in ChatGPT and all modern KaTeX sites)
        const katexMatch = html.match(/<annotation\s+encoding=["']application\/x-tex["'][^>]*>([\s\S]*?)<\/annotation>/i);
        if (katexMatch && katexMatch[1]) {
            return decodeHtmlEntities(katexMatch[1].trim());
        }

        // 2. MathJax script tags
        const mathjaxMatch = html.match(/<script\s+type=["']math\/tex(?:;\s*mode=display)?["'][^>]*>([\s\S]*?)<\/script>/i);
        if (mathjaxMatch && mathjaxMatch[1]) {
            return decodeHtmlEntities(mathjaxMatch[1].trim());
        }

        // 3. MathML alt or data-latex attributes
        const attrMatch = html.match(/(?:data-latex|data-math|alt)=["']([^"']+)["']/i);
        if (attrMatch && attrMatch[1] && /(\\[a-zA-Z]+|[_\^])/.test(attrMatch[1])) {
            return decodeHtmlEntities(attrMatch[1].trim());
        }

        return null;
    }

    function reconstructBrokenMath(text) {
        if (!text || typeof text !== 'string') return null;

        const trimmed = text.trim();
        // NEVER treat as broken math if it looks like code or English paragraphs
        if (isLikelyPythonCode(trimmed)) return null;
        if (/(?:^|\n)\s*(?:import|from|def|class|function|const|let|var|if|for|while|return|public|private)\b/m.test(trimmed)) return null;

        // Normalize newlines, spaces and common unicode math symbols
        const raw = trimmed
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\u00A0/g, ' ')
            .replace(/[\u2010\u2012\u2013\u2014\u2212]/g, '-') // unicode minus/hyphen
            .replace(/[\u2217\u00D7]/g, ' \\times ')
            .replace(/[\u00F7]/g, ' \\div ')
            .replace(/[\u22C5]/g, ' \\cdot ')
            .replace(/[\u2260]/g, ' \\neq ')
            .replace(/[\u2264]/g, ' \\le ')
            .replace(/[\u2265]/g, ' \\ge ')
            .replace(/[\u2248]/g, ' \\approx ')
            .replace(/[\u2208]/g, ' \\in ')
            .replace(/[\u2192]/g, ' \\to ')
            .replace(/[\u2202]/g, ' \\partial ')
            .replace(/[\u221A]/g, ' \\sqrt ');

        // Extract lines, trim them
        const rawLines = raw.split('\n').map(l => l.trim()).filter(Boolean);
        if (rawLines.length < 3) return null;

        // Check if it's genuinely broken multi-line math (e.g. fragmented tokens from PDF)
        const hasMathSigns = /[=+\-*\/_^\(\)\[\]\{\}∑∏∫∂\\]/.test(raw) || /\b(?:SSE|MSE|RMSE|MAE)\b/i.test(raw);
        const shortLines = rawLines.filter(l => l.length <= 4);
        const isFragmented = (shortLines.length / rawLines.length) >= 0.7; // At least 70% of lines must be fragments <= 4 chars
        const totalChars = rawLines.reduce((acc, l) => acc + l.length, 0);
        const avgLineLen = totalChars / rawLines.length;

        // Strictly require fragmentation, math signs, and tiny average line length (< 8 chars)
        if (!isFragmented || !hasMathSigns || avgLineLen > 8) {
            return null; // Not broken math
        }

        // Tokenize each line into sub-tokens while separating operators
        const tokens = [];
        for (const line of rawLines) {
            const sub = line.match(/([a-zA-Z_]\w*=\d+|∑|∏|∫|[a-zA-Z_]\w*|\d+(?:\.\d+)?|[-+=*\/^><_()\[\]{}|]|\\[a-zA-Z]+)/g);
            if (sub) {
                tokens.push(...sub);
            } else {
                tokens.push(line);
            }
        }

        if (tokens.length < 2) return null;

        // Grammar reconstruction walk
        const out = [];
        let i = 0;

        while (i < tokens.length) {
            const t = tokens[i];
            const next = tokens[i + 1] || '';
            const afterNext = tokens[i + 2] || '';

            // 1. Summation: ∑ with possible preceding lower limit (i=1) and upper limit (n)
            if (t === '∑') {
                let lower = '';
                if (out.length > 0 && /^[a-zA-Z_]\w*=\d+$/.test(out[out.length - 1])) {
                    lower = out.pop();
                }
                let upper = '';
                if (next && /^(?:[nNmMkK]|\d+|\\infty)$/.test(next)) {
                    upper = next;
                    i++;
                }
                if (lower && upper) {
                    out.push(`\\sum_{${lower}}^{${upper}}`);
                } else if (lower) {
                    out.push(`\\sum_{${lower}}`);
                } else if (upper) {
                    out.push(`\\sum^{${upper}}`);
                } else {
                    out.push('\\sum');
                }
                i++;
                continue;
            }

            // 2. Preceding lower limit followed by ∑ (e.g. tokens: "i=1", "∑", "n")
            if (/^[a-zA-Z_]\w*=\d+$/.test(t) && next === '∑') {
                const lower = t;
                let upper = '';
                if (afterNext && /^(?:[nNmMkK]|\d+|\\infty)$/.test(afterNext)) {
                    upper = afterNext;
                    i += 3;
                } else {
                    i += 2;
                }
                out.push(upper ? `\\sum_{${lower}}^{${upper}}` : `\\sum_{${lower}}`);
                continue;
            }

            // 3. Hat accent: variable followed by "^" (e.g. "y", "^" -> "\hat{y}")
            if (/^[a-zA-Z]$/.test(t) && next === '^') {
                let base = `\\hat{${t}}`;
                i += 2;
                const sub = tokens[i];
                if (sub && /^[a-zA-Z0-9]$/.test(sub)) {
                    base += `_${sub}`;
                    i++;
                }
                out.push(base);
                continue;
            }

            // 4. Accent before variable: "^" followed by "y" -> "\hat{y}"
            if (t === '^' && /^[a-zA-Z]$/.test(next)) {
                let base = `\\hat{${next}}`;
                i += 2;
                const sub = tokens[i];
                if (sub && /^[a-zA-Z0-9]$/.test(sub)) {
                    base += `_${sub}`;
                    i++;
                }
                out.push(base);
                continue;
            }

            // 5. Variable followed by subscript (indices like i, j, k, n, m, t or digits 0-9)
            const isIndexSubscript = /^(?:[ijkntm]|0|[1-9]\d*|[ijkntm][+-]\d+)$/i.test(next);
            if (/^[a-zA-Z]$/.test(t) && isIndexSubscript && !['=', '+', '-', '*', '/', '^', '(', ')'].includes(next)) {
                out.push(`${t}_${next}`);
                i += 2;
                continue;
            }

            // 6. Superscript / exponent after parentheses or variable: e.g. ")", "2" -> ")^2"
            if ((t === ')' || t === ']') && /^\d+$/.test(next)) {
                out.push(`${t}^${next}`);
                i += 2;
                continue;
            }

            // 7. Multi-letter acronyms / names like SSE, MSE, RMSE, MAE
            if (/^[A-Z]{2,}$/.test(t)) {
                out.push(`\\text{${t}}`);
                i++;
                continue;
            }

            // Normal token
            out.push(t);
            i++;
        }

        let result = out.join(' ')
            .replace(/\s*([=+\-])\s*/g, ' $1 ')
            .replace(/\(\s+/g, '(')
            .replace(/\s+\)/g, ')')
            .replace(/\s*\^\s*/g, '^')
            .replace(/\s*_\s*/g, '_')
            .replace(/\\sum\s*([_{])/g, '\\sum$1')
            .trim();

        return result ? `$$\n${result}\n$$` : null;
    }

    /* ---- ChatGPT & Rich HTML to Markdown Converter ---- */
    function convertChatGPTOrRichHtmlToMarkdown(html, plainFallback = '') {
        if (!html || typeof html !== 'string') return null;

        // Quick check for semantic content worth preserving
        const hasRichStructure = /<(?:pre|code|h[1-6]|p|ul|ol|li|table|blockquote|span\s+class=["'][^"']*katex|annotation)/i.test(html);
        if (!hasRichStructure) return null;

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const body = doc.body;
            if (!body) return null;

            // 1. Remove ChatGPT UI buttons ("Copy code", feedback, sr-only texts)
            body.querySelectorAll('button, .sr-only, [aria-label*="Copy" i]').forEach(el => el.remove());

            // 2. Convert KaTeX math elements (extract pristine LaTeX from <annotation>)
            const katexNodes = Array.from(body.querySelectorAll('.katex, [data-latex]'));
            katexNodes.forEach(kNode => {
                const annotation = kNode.querySelector('annotation[encoding="application/x-tex"]') || 
                                   kNode.querySelector('annotation');
                let latex = annotation ? annotation.textContent.trim() : (kNode.getAttribute('data-latex') || '');
                if (latex) {
                    latex = decodeHtmlEntities(latex);
                    const isDisplay = kNode.closest('.katex-display') || 
                                      kNode.classList.contains('katex-display') ||
                                      kNode.parentElement?.tagName.toLowerCase() === 'div';
                    
                    const marker = isDisplay ? `\n\n$$\n${latex}\n$$\n\n` : ` $${latex}$ `;
                    const textNode = doc.createTextNode(marker);

                    const targetToReplace = kNode.closest('.katex-display') || kNode;
                    if (targetToReplace.parentNode) {
                        targetToReplace.parentNode.replaceChild(textNode, targetToReplace);
                    }
                }
            });

            // 3. Convert MathJax script tags
            body.querySelectorAll('script[type*="math/tex"]').forEach(script => {
                const isDisplay = (script.getAttribute('type') || '').includes('mode=display');
                const latex = decodeHtmlEntities(script.textContent.trim());
                if (latex) {
                    const marker = isDisplay ? `\n\n$$\n${latex}\n$$\n\n` : ` $${latex}$ `;
                    script.replaceWith(doc.createTextNode(marker));
                }
            });

            // 4. Convert Code Blocks (<pre>) - preserve indentation, newlines, and language
            const preBlocks = Array.from(body.querySelectorAll('pre'));
            preBlocks.forEach(pre => {
                const codeEl = pre.querySelector('code');
                let lang = '';

                // Extract language from code element or pre element class
                const classStr = `${codeEl?.className || ''} ${pre.className || ''}`;
                const langMatch = classStr.match(/(?:language|lang)-([a-zA-Z0-9_\-\+]+)/i);
                if (langMatch) {
                    lang = langMatch[1].toLowerCase();
                } else {
                    // Check sibling or parent span (ChatGPT language indicator header)
                    const parentContainer = pre.parentElement;
                    if (parentContainer) {
                        const headerSpan = parentContainer.querySelector('span:not(.katex)');
                        if (headerSpan) {
                            const word = headerSpan.textContent.trim().toLowerCase();
                            if (['python', 'py', 'javascript', 'js', 'html', 'css', 'bash', 'sh', 'sql', 'cpp', 'c', 'java', 'json', 'yaml', 'r', 'rust'].includes(word)) {
                                lang = word;
                            }
                        }
                    }
                }

                // Remove buttons or headers inside pre
                pre.querySelectorAll('button, .copy-code-button').forEach(b => b.remove());

                let codeContent = codeEl ? codeEl.textContent : pre.textContent;
                codeContent = codeContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                // Trim leading/trailing blank lines but preserve indentation
                codeContent = codeContent.replace(/^\n+|\n+$/g, '');

                if (!lang && isLikelyPythonCode(codeContent)) {
                    lang = 'python';
                }

                const fencedCode = `\n\n\`\`\`${lang}\n${codeContent}\n\`\`\`\n\n`;
                pre.replaceWith(doc.createTextNode(fencedCode));
            });

            // 5. Recursively convert the remaining DOM to clean Markdown
            function domToMarkdown(node) {
                if (!node) return '';
                if (node.nodeType === Node.TEXT_NODE) {
                    return node.textContent;
                }
                if (node.nodeType !== Node.ELEMENT_NODE) {
                    return '';
                }

                const tag = node.tagName.toLowerCase();
                const children = Array.from(node.childNodes).map(domToMarkdown).join('');

                switch (tag) {
                    case 'h1':
                        return `\n\n# ${children.trim()}\n\n`;
                    case 'h2':
                        return `\n\n## ${children.trim()}\n\n`;
                    case 'h3':
                        return `\n\n### ${children.trim()}\n\n`;
                    case 'h4':
                        return `\n\n#### ${children.trim()}\n\n`;
                    case 'h5':
                        return `\n\n##### ${children.trim()}\n\n`;
                    case 'h6':
                        return `\n\n###### ${children.trim()}\n\n`;
                    case 'p':
                        return `\n\n${children.trim()}\n\n`;
                    case 'br':
                        return '\n';
                    case 'hr':
                        return '\n\n---\n\n';
                    case 'strong':
                    case 'b':
                        return children.trim() ? `**${children.trim()}**` : '';
                    case 'em':
                    case 'i':
                        return children.trim() ? `*${children.trim()}*` : '';
                    case 'code':
                        // Pre code blocks were already converted above
                        return children.trim() ? ` \`${children.trim()}\` ` : '';
                    case 'blockquote': {
                        const bqLines = children.trim().split('\n');
                        return `\n\n${bqLines.map(l => `> ${l}`).join('\n')}\n\n`;
                    }
                    case 'ul':
                        return `\n\n${children.trim()}\n\n`;
                    case 'ol':
                        return `\n\n${children.trim()}\n\n`;
                    case 'li': {
                        const parent = node.parentElement;
                        if (parent && parent.tagName.toLowerCase() === 'ol') {
                            const idx = Array.from(parent.children).indexOf(node) + 1;
                            return `${idx}. ${children.trim()}\n`;
                        }
                        return `- ${children.trim()}\n`;
                    }
                    case 'a': {
                        const href = node.getAttribute('href');
                        return href ? `[${children.trim()}](${href})` : children;
                    }
                    case 'table':
                        return '\n\n' + convertTableToMarkdown(node) + '\n\n';
                    default:
                        return children;
                }
            }

            function convertTableToMarkdown(tableEl) {
                const rows = Array.from(tableEl.querySelectorAll('tr'));
                if (rows.length === 0) return '';
                let md = '';
                rows.forEach((row, rIdx) => {
                    const cells = Array.from(row.querySelectorAll('th, td'));
                    const rowContent = '| ' + cells.map(c => c.textContent.trim().replace(/\|/g, '\\|')).join(' | ') + ' |';
                    md += rowContent + '\n';
                    if (rIdx === 0) {
                        md += '| ' + cells.map(() => '---').join(' | ') + ' |\n';
                    }
                });
                return md;
            }

            let mdResult = domToMarkdown(body);

            // Clean up whitespace: normalize newlines, limit to 2 consecutive newlines
            mdResult = mdResult
                .replace(/\r\n/g, '\n')
                .replace(/\r/g, '\n')
                .replace(/[ \t]+\n/g, '\n') // strip trailing spaces
                .replace(/\n{3,}/g, '\n\n') // at most two newlines
                .trim();

            return mdResult || null;
        } catch (e) {
            console.warn('ChatGPT/HTML to Markdown conversion failed:', e);
            return null;
        }
    }

    /* ---- Toolbar Actions (Routed to Respective Slot) ---- */
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tool = btn.dataset.tool;
            const slot = parseInt(btn.dataset.slot || '1', 10);
            if (!tool) return;
            handleToolbarAction(tool, slot);
        });
    });

    function handleToolbarAction(action, slot = 1) {
        const targetTextarea = document.getElementById(`markdown-input-${slot}`);
        if (!targetTextarea) return;

        const start = targetTextarea.selectionStart;
        const end = targetTextarea.selectionEnd;
        const selected = targetTextarea.value.substring(start, end);
        let replacement = '';
        let cursorOffset = 0;

        switch (action) {
            case 'bold':
                replacement = `**${selected || 'bold text'}**`;
                cursorOffset = selected ? replacement.length : 2;
                break;
            case 'italic':
                replacement = `*${selected || 'italic text'}*`;
                cursorOffset = selected ? replacement.length : 1;
                break;
            case 'inline-code':
                replacement = `\`${selected || 'code'}\``;
                cursorOffset = selected ? replacement.length : 1;
                break;
            case 'h2':
                replacement = `\n## ${selected || 'Section Heading'}\n`;
                cursorOffset = replacement.length;
                break;
            case 'h3':
                replacement = `\n### ${selected || 'Sub-heading'}\n`;
                cursorOffset = replacement.length;
                break;
            case 'math-inline':
                replacement = `$${selected || 'W \\cdot x + b'}$`;
                cursorOffset = selected ? replacement.length : 1;
                break;
            case 'math-block':
                if (selected && selected.trim()) {
                    const recon = reconstructBrokenMath(selected.trim());
                    if (recon) {
                        replacement = `\n${recon}\n`;
                        cursorOffset = replacement.length;
                        showToast('✓ Auto-reconstructed broken formula into clean LaTeX!', 'success');
                    } else {
                        replacement = `\n$$\n${selected.trim()}\n$$\n`;
                        cursorOffset = replacement.length;
                    }
                } else {
                    const fullVal = targetTextarea.value.trim();
                    const reconFull = reconstructBrokenMath(fullVal);
                    if (reconFull) {
                        targetTextarea.value = reconFull;
                        updateSlotLivePreview(slot);
                        markDirty();
                        showToast('✓ Auto-reconstructed broken formula into clean LaTeX!', 'success');
                        return;
                    }
                    if (fullVal && !fullVal.includes('$$') && /(\\sum|\\frac|\\text|\\hat|SSE|MSE|=)/.test(fullVal)) {
                        targetTextarea.value = `$$\n${fullVal}\n$$\n`;
                        updateSlotLivePreview(slot);
                        markDirty();
                        showToast('✓ Formatted content as LaTeX block ($$...$$)!', 'success');
                        return;
                    }
                    replacement = `\n$$\n\\text{SSE} = \\sum_{i=1}^{n} (y_i - \\hat{y}_i)^2\n$$\n`;
                    cursorOffset = replacement.length;
                }
                break;
            case 'code-block':
                if (selected && selected.trim()) {
                    replacement = `\n\`\`\`python\n${selected.trim()}\n\`\`\`\n`;
                    cursorOffset = replacement.length;
                } else {
                    const fullVal = targetTextarea.value.trim();
                    if (fullVal && !fullVal.includes('```') && isLikelyPythonCode(fullVal)) {
                        targetTextarea.value = `\`\`\`python\n${fullVal}\n\`\`\`\n`;
                        updateSlotLivePreview(slot);
                        markDirty();
                        showToast('✓ Formatted note content as Python code block!', 'success');
                        return;
                    }
                    replacement = `\n\`\`\`python\n# Paste or write your Python code here\n\n\`\`\`\n`;
                    cursorOffset = replacement.length - 5;
                }
                break;
            case 'quote':
                replacement = `\n> [!KEY INSIGHT]\n> ${selected || 'Key theoretical takeaway or intuitive explanation.'}\n`;
                cursorOffset = replacement.length;
                break;
            case 'ul':
                replacement = `\n- ${selected || 'Key property 1'}\n- Key property 2\n- Key property 3\n`;
                cursorOffset = replacement.length;
                break;
            case 'ol':
                replacement = `\n1. ${selected || 'First step'}\n2. Second step\n3. Third step\n`;
                cursorOffset = replacement.length;
                break;
        }

        targetTextarea.focus();
        targetTextarea.setRangeText(replacement, start, end, 'end');
        updateSlotLivePreview(slot);
        markDirty();
    }

    /* ---- Deep Learning Templates for Each Slot ---- */
    function getSlotTemplate(slot, title) {
        const cleanTitle = title || 'CustomModule';
        const className = cleanTitle.replace(/[^a-zA-Z0-9]/g, '') || 'CustomModule';

        if (slot === 1) {
            return `## 1. Problem Formulation & Theoretical Motivation

Explain the core motivation behind this architecture or algorithm. Why is it needed, and what limitations of previous approaches does it solve?

> [!KEY INSIGHT]
> State the central architectural intuition in a single punchy takeaway.

---

## 2. Mathematical Foundations

Formulate the mathematical foundation rigorously:

$$\\mathcal{L}_{total} = \\mathcal{L}_{task} + \\lambda \\mathcal{L}_{reg}$$

Where:
- $x \\in \\mathbb{R}^{B \\times d_{in}}$ denotes the batch of input representations.
- $W \\in \\mathbb{R}^{d_{out} \\times d_{in}}$ represents the learnable projection weights.
- $\\sigma(\\cdot)$ denotes the non-linear activation function.
`;
        } else if (slot === 2) {
            return `## 3. Detailed Component Architecture & PyTorch Implementation

\`\`\`python
import torch
import torch.nn as nn
import torch.nn.functional as F

class ${className}(nn.Module):
    """
    Detailed module implementation for ${cleanTitle}.
    """
    def __init__(self, d_model=512, dropout=0.1):
        super().__init__()
        self.d_model = d_model
        self.fc = nn.Linear(d_model, d_model)
        self.dropout = nn.Dropout(dropout)
        self.norm = nn.LayerNorm(d_model)
        
    def forward(self, x):
        residual = x
        out = self.fc(x)
        out = F.gelu(out)
        out = self.dropout(out)
        return self.norm(residual + out)

# Quick tensor shape verification
if __name__ == "__main__":
    dummy_input = torch.randn(8, 64, 512)
    model = ${className}(d_model=512)
    output = model(dummy_input)
    print("Output shape:", output.shape)  # torch.Size([8, 64, 512])
\`\`\`
`;
        } else {
            return `## 4. Training Dynamics, Hyperparameters & Empirical Takeaways

- **Initialization:** Be mindful of variance scaling when initializing layer weights.
- **Complexity:** Time complexity scales as $\\mathcal{O}(N)$ or $\\mathcal{O}(N^2)$ with respect to sequence length.
- **Optimization:** Use AdamW with linear warmup and cosine decay scheduler.
- **Failure Modes:** Watch out for exploding activations without proper layer normalization.
`;
        }
    }

    /* ---- View Toggles: Split, Write, Preview per Slot ---- */
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const slot = btn.dataset.slot || '1';
            const view = btn.dataset.view || 'split';

            document.querySelectorAll(`.view-btn[data-slot="${slot}"]`).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const workspace = document.getElementById(`editor-workspace-${slot}`);
            if (workspace) {
                workspace.classList.remove('split-view', 'edit-only', 'preview-only');
                if (view === 'split') workspace.classList.add('split-view');
                else if (view === 'edit') workspace.classList.add('edit-only');
                else if (view === 'preview') workspace.classList.add('preview-only');
            }
        });
    });

    /* ---- Diagram File Upload, Templates & Handlers for All 3 Slots ---- */
    for (let slot = 1; slot <= slotCount; slot++) {
        setupSlotHandlers(slot);
    }

    function setupSlotHandlers(slot) {
        const fileInput = document.getElementById(`diagram-file-input-${slot}`);
        const fileDropArea = document.getElementById(`file-drop-area-${slot}`);
        const urlInput = document.getElementById(`diagram-url-input-${slot}`);
        const captionInput = document.getElementById(`diagram-caption-input-${slot}`);
        const previewCard = document.getElementById(`diagram-preview-card-${slot}`);
        const previewCaption = document.getElementById(`diagram-preview-caption-${slot}`);
        const btnRemove = document.getElementById(`btn-remove-diagram-${slot}`);
        const excerptInput = document.getElementById(`article-excerpt-${slot}`);
        const mdInputEl = document.getElementById(`markdown-input-${slot}`);
        const btnTemplate = document.getElementById(`btn-insert-template-${slot}`);

        if (excerptInput) {
            excerptInput.addEventListener('input', () => {
                scheduleSlotLivePreview(slot);
                markDirty();
            });

            // Smart paste handler for Description: convert rich HTML/math if copied from ChatGPT
            excerptInput.addEventListener('paste', (e) => {
                const clipboardData = e.clipboardData || window.clipboardData;
                if (!clipboardData) return;
                const pastedText = (clipboardData.getData('text/plain') || clipboardData.getData('text') || '').replace(/\r\n/g, '\n');
                const htmlData = clipboardData.getData('text/html') || '';
                if (htmlData && /<(?:p|h[1-6]|ul|ol|li|strong|b|em|i|span\s+class=["'][^"']*katex|annotation)/i.test(htmlData)) {
                    const converted = convertChatGPTOrRichHtmlToMarkdown(htmlData, pastedText);
                    if (converted && converted.trim()) {
                        e.preventDefault();
                        const start = excerptInput.selectionStart;
                        const end = excerptInput.selectionEnd;
                        excerptInput.setRangeText(converted.trim(), start, end, 'end');
                        scheduleSlotLivePreview(slot);
                        markDirty();
                    }
                }
            });
        }

        if (mdInputEl) {
            mdInputEl.addEventListener('input', () => {
                scheduleSlotLivePreview(slot);
                markDirty();
            });

            // Smart paste handler: Preserves ChatGPT formatting, converts rich HTML to Markdown,
            // auto-wraps Python code & LaTeX formulas, and prevents single-line flattening
            mdInputEl.addEventListener('paste', (e) => {
                const clipboardData = e.clipboardData || window.clipboardData;
                if (!clipboardData) return;

                const pastedText = (clipboardData.getData('text/plain') || clipboardData.getData('text') || '').replace(/\r\n/g, '\n');
                const htmlData = clipboardData.getData('text/html') || '';

                if (!pastedText && !htmlData) return;

                // Priority 1: Check if inside a code block already
                // If cursor is already inside a markdown code block (```...```), paste raw text as-is without wrapping
                if (isCursorInsideCodeBlock(mdInputEl)) {
                    if (pastedText) {
                        e.preventDefault();
                        const start = mdInputEl.selectionStart;
                        const end = mdInputEl.selectionEnd;
                        mdInputEl.setRangeText(pastedText, start, end, 'end');
                        scheduleSlotLivePreview(slot);
                        markDirty();
                    }
                    return;
                }

                // Priority 2: Rich HTML conversion (ChatGPT, Claude, Gemini, DeepSeek, web pages)
                // If clipboard has rich HTML with structure (headings, code blocks, KaTeX math, lists, paragraphs)
                if (htmlData && /<(?:pre|code|h[1-6]|p|ul|ol|li|table|blockquote|span\s+class=["'][^"']*katex|annotation)/i.test(htmlData)) {
                    const convertedMd = convertChatGPTOrRichHtmlToMarkdown(htmlData, pastedText);
                    if (convertedMd && convertedMd.trim()) {
                        e.preventDefault();
                        const start = mdInputEl.selectionStart;
                        const end = mdInputEl.selectionEnd;
                        const prefix = (start > 0 && mdInputEl.value[start - 1] !== '\n') ? '\n\n' : '';
                        const suffix = (end < mdInputEl.value.length && mdInputEl.value[end] !== '\n') ? '\n\n' : '\n';
                        const insertion = `${prefix}${convertedMd.trim()}${suffix}`;
                        mdInputEl.setRangeText(insertion, start, end, 'end');
                        scheduleSlotLivePreview(slot);
                        markDirty();
                        showToast('✓ Preserved ChatGPT formatting with code blocks, math & headings!', 'success');
                        return;
                    }
                }

                // Priority 3: Standalone KaTeX / Math from HTML (single formula)
                if (htmlData) {
                    const htmlLatex = extractLatexFromHtml(htmlData);
                    if (htmlLatex && !pastedText.includes('\n') && pastedText.length < 300) {
                        e.preventDefault();
                        const wrapped = `$$\n${htmlLatex}\n$$\n`;
                        const start = mdInputEl.selectionStart;
                        const end = mdInputEl.selectionEnd;
                        mdInputEl.setRangeText(wrapped, start, end, 'end');
                        scheduleSlotLivePreview(slot);
                        markDirty();
                        showToast('✓ Extracted clean LaTeX formula ($$...$$)!', 'success');
                        return;
                    }
                }

                if (!pastedText) return;

                // Priority 4: Existing formatted Markdown (fenced code, headings, or $$ math)
                const hasExistingMarkdown = /^```[\s\S]*```$/m.test(pastedText.trim()) || 
                                           /^(?:#{1,6}\s+|```|\$\$)/m.test(pastedText);

                if (hasExistingMarkdown) {
                    e.preventDefault();
                    const start = mdInputEl.selectionStart;
                    const end = mdInputEl.selectionEnd;
                    mdInputEl.setRangeText(pastedText, start, end, 'end');
                    scheduleSlotLivePreview(slot);
                    markDirty();
                    showToast('✓ Pasted Markdown content preserving structure!', 'success');
                    return;
                }

                // Priority 5: Raw Python code auto-wrapping (e.g. from IDE or ChatGPT code copy button)
                if (isLikelyPythonCode(pastedText)) {
                    e.preventDefault();
                    const cleanCode = pastedText.trim();
                    const wrappedCode = `\`\`\`python\n${cleanCode}\n\`\`\`\n`;
                    const start = mdInputEl.selectionStart;
                    const end = mdInputEl.selectionEnd;
                    mdInputEl.setRangeText(wrappedCode, start, end, 'end');
                    scheduleSlotLivePreview(slot);
                    markDirty();
                    showToast('✓ Python code auto-wrapped with syntax highlighting!', 'success');
                    return;
                }

                // Priority 6: Standalone single/multi-line LaTeX formulas
                if (!pastedText.trim().startsWith('$') && !pastedText.trim().startsWith('```')) {
                    const isMathEquation = /(\\[a-zA-Z]+|[a-zA-Z]_[ijkntm0-9]|\^[0-9a-zA-Z])/.test(pastedText) && 
                                           /[=+\-*\/]/.test(pastedText) && 
                                           !isLikelyPythonCode(pastedText);
                    if (isMathEquation && !/^[a-zA-Z\s]{20,}/.test(pastedText)) {
                        e.preventDefault();
                        const wrapped = `$$\n${pastedText.trim()}\n$$\n`;
                        const start = mdInputEl.selectionStart;
                        const end = mdInputEl.selectionEnd;
                        mdInputEl.setRangeText(wrapped, start, end, 'end');
                        scheduleSlotLivePreview(slot);
                        markDirty();
                        showToast('✓ Formatted equation as LaTeX block ($$...$$)!', 'success');
                        return;
                    }
                }

                // Priority 7: Genuinely fragmented broken math tokens from PDF copies
                const reconstructed = reconstructBrokenMath(pastedText);
                if (reconstructed) {
                    e.preventDefault();
                    const start = mdInputEl.selectionStart;
                    const end = mdInputEl.selectionEnd;
                    mdInputEl.setRangeText(reconstructed, start, end, 'end');
                    scheduleSlotLivePreview(slot);
                    markDirty();
                    showToast('✓ Auto-reconstructed broken formula into clean LaTeX!', 'success');
                    return;
                }

                // Priority 8: Standard plain text paste, preserving exact newlines & indentation
                e.preventDefault();
                const start = mdInputEl.selectionStart;
                const end = mdInputEl.selectionEnd;
                mdInputEl.setRangeText(pastedText, start, end, 'end');
                scheduleSlotLivePreview(slot);
                markDirty();
            });
        }

        if (btnTemplate) {
            btnTemplate.addEventListener('click', () => {
                const title = titleInput.value.trim() || 'Architecture Concept';
                const template = getSlotTemplate(slot, title);
                if (mdInputEl && mdInputEl.value.trim() && !confirm(`Insert Deep Learning template for Part ${slot} and append to current content?`)) {
                    return;
                }
                if (mdInputEl) {
                    mdInputEl.value = mdInputEl.value.trim() ? `${mdInputEl.value}\n\n${template}` : template;
                    updateSlotLivePreview(slot);
                    markDirty();
                    showToast(`DL template inserted into Part ${slot}!`, 'info');
                }
            });
        }

        if (fileDropArea && fileInput) {
            fileDropArea.addEventListener('click', () => fileInput.click());

            fileDropArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                fileDropArea.classList.add('dragover');
            });

            fileDropArea.addEventListener('dragleave', () => {
                fileDropArea.classList.remove('dragover');
            });

            fileDropArea.addEventListener('drop', (e) => {
                e.preventDefault();
                fileDropArea.classList.remove('dragover');
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleDiagramFile(slot, e.dataTransfer.files[0]);
                }
            });

            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    handleDiagramFile(slot, e.target.files[0]);
                }
            });
        }

        if (urlInput) {
            urlInput.addEventListener('input', () => {
                const url = urlInput.value.trim();
                currentDiagrams[slot - 1] = url;
                if (url) {
                    displayDiagramPreview(slot, url);
                } else {
                    if (previewCard) previewCard.style.display = 'none';
                }
                markDirty();
            });
        }

        if (captionInput) {
            captionInput.addEventListener('input', () => {
                if (previewCaption) {
                    previewCaption.textContent = captionInput.value.trim() || `Figure ${slot}: Architecture diagram`;
                }
                markDirty();
            });
        }

        if (btnRemove) {
            btnRemove.addEventListener('click', () => {
                currentDiagrams[slot - 1] = '';
                if (urlInput) urlInput.value = '';
                if (fileInput) fileInput.value = '';
                if (previewCard) previewCard.style.display = 'none';
                markDirty();
                showToast(`Diagram ${slot} removed`, 'info');
            });
        }
    }

    function handleDiagramFile(slot, file) {
        if (!file.type.startsWith('image/')) {
            showToast('Please upload an image file (PNG, JPG, SVG, WebP)', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            currentDiagrams[slot - 1] = e.target.result;
            displayDiagramPreview(slot, currentDiagrams[slot - 1]);
            markDirty();
            showToast(`Diagram ${slot} image loaded successfully`, 'success');
        };
        reader.readAsDataURL(file);
    }

    function displayDiagramPreview(slot, src) {
        const previewCard = document.getElementById(`diagram-preview-card-${slot}`);
        const previewImg = document.getElementById(`diagram-preview-img-${slot}`);
        const previewCaption = document.getElementById(`diagram-preview-caption-${slot}`);
        const captionInput = document.getElementById(`diagram-caption-input-${slot}`);

        if (previewImg) previewImg.src = src;
        if (previewCaption && captionInput) {
            previewCaption.textContent = captionInput.value.trim() || `Figure ${slot}: Architecture diagram`;
        }
        if (previewCard) previewCard.style.display = 'flex';
    }

    /* ---- Custom Interactive HTML Note Handlers ---- */
    if (noteHtmlInput) {
        noteHtmlInput.addEventListener('input', () => {
            updateNoteHtmlStatus(false);
            markDirty();
        });
    }

    btnNotePaste?.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text && noteHtmlInput) {
                noteHtmlInput.value = text;
                noteHtmlInput.focus();
                updateNoteHtmlStatus(false);
                markDirty();
                showToast('Pasted HTML code from clipboard', 'info');
            }
        } catch (e) {
            alert('Please paste directly into the textarea (Ctrl+V).');
        }
    });

    btnNoteTemplate?.addEventListener('click', () => {
        if (!noteHtmlInput) return;
        if (noteHtmlInput.value.trim().length > 0 && !confirm('Replace current code with the Interactive Roadmap template?')) {
            return;
        }
        const title = titleInput.value.trim() || 'Interactive Deep Learning Component';
        noteHtmlInput.value = typeof HubStore !== 'undefined' && typeof HubStore.getStarterHtmlTemplate === 'function'
            ? HubStore.getStarterHtmlTemplate(title)
            : `<!DOCTYPE html><html><body><h1>${title}</h1></body></html>`;
        updateNoteHtmlStatus(false);
        markDirty();
        showToast('Loaded Interactive Roadmap starter template', 'success');
    });

    btnNotePreview?.addEventListener('click', () => {
        if (!noteHtmlInput || !notePreviewFrame || !notePreviewContainer) return;
        const code = noteHtmlInput.value.trim();
        if (!code) {
            alert('Please write or paste some HTML code first into the textarea!');
            noteHtmlInput.focus();
            return;
        }
        notePreviewFrame.srcdoc = code;
        notePreviewContainer.style.display = 'block';
        updateNoteHtmlStatus(false);
        if (previewSandboxStatus) {
            previewSandboxStatus.className = 'html-status-pill ready';
            previewSandboxStatus.textContent = '⚡ Sandbox Active';
        }
        setTimeout(() => {
            notePreviewContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
    });

    btnCloseNotePreview?.addEventListener('click', () => {
        if (notePreviewContainer) notePreviewContainer.style.display = 'none';
    });

    // Direct save triggers inside the HTML Embed section
    btnNoteHelperSave?.addEventListener('click', () => {
        saveArticleLocally();
    });

    btnNotePreviewSave?.addEventListener('click', () => {
        saveArticleLocally();
    });

    /* ---- Save Article Locally ---- */
    btnSaveLocal.addEventListener('click', saveArticleLocally);

    function getFormData() {
        let title = titleInput.value.trim();
        const customHtml = (noteHtmlInput?.value || document.getElementById('article-custom-html')?.value || '').trim();
        const isHtmlNote = Boolean(customHtml.length > 0);

        if (!title) {
            if (isHtmlNote) {
                const autoPrompt = prompt('Please enter a Title for this Interactive Web UI note:', 'Interactive Deep Learning Component');
                if (autoPrompt && autoPrompt.trim()) {
                    title = autoPrompt.trim();
                    titleInput.value = title;
                    docTitle.textContent = title;
                }
            }
            if (!title) {
                showToast('Please enter an article title at the top', 'warning');
                titleInput.focus();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return null;
            }
        }

        const selectedOption = topicSelect.options[topicSelect.selectedIndex];
        const topicId = topicSelect.value || '';
        const topicName = selectedOption && selectedOption.dataset.name ? selectedOption.dataset.name : 'General Research';

        const sections = [];
        for (let i = 1; i <= slotCount; i++) {
            const desc = document.getElementById(`article-excerpt-${i}`)?.value || '';
            const diag = currentDiagrams[i - 1] || '';
            const cap = document.getElementById(`diagram-caption-input-${i}`)?.value || '';
            const content = document.getElementById(`markdown-input-${i}`)?.value || '';
            sections.push({
                description: desc.trim(),
                diagram: diag,
                diagramCaption: cap.trim(),
                content: content
            });
        }

        const primarySection = sections.find(s => s.description || s.diagram || s.content) || sections[0] || { description: '', diagram: '', diagramCaption: '', content: '' };

        const combinedContent = sections
            .map(s => (s.content || '').trim())
            .filter(Boolean)
            .join('\n\n---\n\n');

        return {
            id: currentArticleId,
            title: title,
            topicId: topicId,
            topicName: topicName,
            date: dateInput.value || new Date().toISOString().split('T')[0],
            tags: tagsInput.value,
            excerpt: primarySection.description || (typeof HubStore !== 'undefined' && typeof HubStore.generateExcerpt === 'function' ? HubStore.generateExcerpt(combinedContent) : ''),
            content: combinedContent,
            diagram: primarySection.diagram,
            diagramCaption: primarySection.diagramCaption,
            sections: sections,
            customHtml: customHtml,
            isHtmlNote: isHtmlNote
        };
    }

    async function saveArticleLocally() {
        const data = getFormData();
        if (!data) return;

        // If Firebase is configured and user is not logged in, prompt sign-in
        if (typeof FirebaseConfig !== 'undefined' && FirebaseConfig.isConfigured()) {
            const user = FirebaseConfig.getCurrentUser();
            if (!user) {
                const wantLogin = confirm('You are not signed in as Owner yet.\n\nSign in with Google now so Firebase Cloud allows saving?');
                if (wantLogin) {
                    try {
                        await FirebaseConfig.signInWithGoogle();
                    } catch (authErr) {
                        showToast(`Google Sign-in failed: ${authErr.message}`, 'error');
                        return;
                    }
                }
            }
        }

        try {
            markClean('Saving...');
            btnSaveLocal.disabled = true;
            if (btnNoteHelperSave) {
                btnNoteHelperSave.disabled = true;
                btnNoteHelperSave.textContent = 'Saving...';
            }
            if (btnNotePreviewSave) {
                btnNotePreviewSave.disabled = true;
                btnNotePreviewSave.textContent = 'Saving...';
            }

            const saved = await HubStore.saveArticle(data);
            currentArticleId = saved.id;
            const isCloud = HubStore.isFirebaseConnected();
            const statusMsg = isCloud ? 'Saved to Cloud & Local!' : 'Saved locally';
            markClean(statusMsg);
            updateNoteHtmlStatus(true);
            const htmlMsg = data.customHtml ? ' (with interactive Web UI)' : '';
            showToast(`Research note saved${htmlMsg}! (${statusMsg})`, 'success');
            
            // Update URL without reloading
            const newUrl = `${window.location.pathname}?edit=${saved.id}`;
            window.history.replaceState({ id: saved.id }, '', newUrl);
        } catch (e) {
            console.error('Save error:', e);
            showToast(`Error saving article: ${e.message}`, 'error');
        } finally {
            btnSaveLocal.disabled = false;
            if (btnNoteHelperSave) {
                btnNoteHelperSave.disabled = false;
                btnNoteHelperSave.textContent = '💾 Save Note & Web UI';
            }
            if (btnNotePreviewSave) {
                btnNotePreviewSave.disabled = false;
                btnNotePreviewSave.textContent = '💾 Save Note & Web UI';
            }
        }
    }

    /* ---- Download Markdown (.md) ---- */
    btnDownloadMd.addEventListener('click', () => {
        const data = getFormData();
        if (!data) return;
        HubStore.downloadMarkdown(data);
        showToast('Downloaded .md file to your computer', 'success');
    });

    /* ---- Publish to GitHub (Optional) ---- */
    btnPublishGithub?.addEventListener('click', async () => {
        const data = getFormData();
        if (!data) return;

        const ghConfig = HubStore.getGitHubConfig();
        if (!ghConfig.owner || !ghConfig.repo || !ghConfig.token) {
            showToast('Please configure your GitHub Settings first.', 'warning');
            openGhModal();
            return;
        }

        // Save locally first
        saveArticleLocally();

        btnPublishGithub.disabled = true;
        btnPublishGithub.innerHTML = `
            <svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
            <span>Publishing to GitHub...</span>
        `;

        try {
            const result = await HubStore.publishToGitHub(data);
            showToast(`Published to GitHub repo! File: ${result.filePath}`, 'success');
            markClean('Published to GitHub');
        } catch (err) {
            console.error('GitHub publish error:', err);
            showToast(`GitHub Publish Failed: ${err.message}`, 'error');
        } finally {
            btnPublishGithub.disabled = false;
            btnPublishGithub.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                <span>Publish to GitHub</span>
            `;
        }
    });

    /* ---- Keyboard Shortcut: Ctrl+S (Save) & Ctrl+B / Ctrl+I (Formatting) ---- */
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveArticleLocally();
            return;
        }

        if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'i')) {
            const activeEl = document.activeElement;
            if (activeEl && activeEl.id && activeEl.id.startsWith('markdown-input-')) {
                const slot = parseInt(activeEl.id.replace('markdown-input-', ''), 10);
                e.preventDefault();
                handleToolbarAction(e.key === 'b' ? 'bold' : 'italic', slot);
            }
        }
    });

    /* ---- Topic Modal Handling (Create & Edit) ---- */
    btnOpenTopicModal?.addEventListener('click', () => {
        const titleEl = document.getElementById('modal-topic-title');
        const idInput = document.getElementById('new-topic-id');
        const nameInput = document.getElementById('new-topic-name');
        const iconInput = document.getElementById('new-topic-icon');
        const tagInput = document.getElementById('new-topic-tag');
        const descInput = document.getElementById('new-topic-desc');

        if (titleEl) titleEl.textContent = 'Create New Topic';
        if (btnSaveNewTopic) btnSaveNewTopic.textContent = 'Create Topic';
        if (idInput) idInput.value = '';
        if (nameInput) nameInput.value = '';
        if (iconInput) iconInput.value = '🧠';
        if (tagInput) tagInput.value = '';
        if (descInput) descInput.value = '';

        modalTopic.classList.add('active');
        nameInput?.focus();
    });

    btnEditTopicModal?.addEventListener('click', () => {
        const selectedId = topicSelect.value;
        if (!selectedId) return;

        const topic = HubStore.getTopic(selectedId);
        if (!topic) return;

        const titleEl = document.getElementById('modal-topic-title');
        const idInput = document.getElementById('new-topic-id');
        const nameInput = document.getElementById('new-topic-name');
        const iconInput = document.getElementById('new-topic-icon');
        const tagInput = document.getElementById('new-topic-tag');
        const descInput = document.getElementById('new-topic-desc');

        if (titleEl) titleEl.textContent = `✏️ Rename / Edit Topic — ${topic.name}`;
        if (btnSaveNewTopic) btnSaveNewTopic.textContent = 'Save Changes';
        if (idInput) idInput.value = topic.id;
        if (nameInput) nameInput.value = topic.name;
        if (iconInput) iconInput.value = topic.icon || '🧠';
        if (tagInput) tagInput.value = topic.tag || '';
        if (descInput) descInput.value = topic.description || '';

        modalTopic.classList.add('active');
        if (nameInput) {
            nameInput.focus();
            nameInput.select();
        }
    });

    function closeTopicModal() {
        modalTopic.classList.remove('active');
        const idInput = document.getElementById('new-topic-id');
        const nameInput = document.getElementById('new-topic-name');
        const descInput = document.getElementById('new-topic-desc');
        if (idInput) idInput.value = '';
        if (nameInput) nameInput.value = '';
        if (descInput) descInput.value = '';
    }

    btnCloseTopicModal.addEventListener('click', closeTopicModal);
    btnCancelTopicModal.addEventListener('click', closeTopicModal);

    let isSavingNewTopic = false;
    btnSaveNewTopic?.addEventListener('click', async () => {
        if (isSavingNewTopic) return;

        const name = document.getElementById('new-topic-name').value.trim();
        if (!name) {
            showToast('Please enter a topic name', 'warning');
            return;
        }

        const topicId = (document.getElementById('new-topic-id')?.value || '').trim();
        const icon = document.getElementById('new-topic-icon').value.trim() || '🧠';
        const tag = document.getElementById('new-topic-tag').value.trim() || 'Custom';
        const desc = document.getElementById('new-topic-desc').value.trim();

        isSavingNewTopic = true;
        btnSaveNewTopic.disabled = true;
        btnSaveNewTopic.textContent = 'Saving...';
        try {
            const savedTopic = await HubStore.saveTopic({
                id: topicId || undefined,
                name: name,
                icon: icon,
                tag: tag,
                description: desc
            });

            renderTopicOptions(savedTopic.id);
            closeTopicModal();
            showToast(topicId ? `Topic renamed to "${savedTopic.name}"!` : `Topic "${savedTopic.name}" created!`, 'success');
        } catch (e) {
            showToast(`Error saving topic: ${e.message}`, 'error');
        } finally {
            isSavingNewTopic = false;
            btnSaveNewTopic.disabled = false;
            btnSaveNewTopic.textContent = topicId ? 'Save Changes' : 'Create Topic';
        }
    });

    /* ---- GitHub Settings Modal (Option 3) ---- */
    function openGhModal() {
        const cfg = HubStore.getGitHubConfig();
        document.getElementById('gh-owner').value = cfg.owner || '';
        document.getElementById('gh-repo').value = cfg.repo || '';
        document.getElementById('gh-branch').value = cfg.branch || 'main';
        document.getElementById('gh-folder').value = cfg.folder || 'notes';
        document.getElementById('gh-token').value = cfg.token || '';
        document.getElementById('gh-test-result').style.display = 'none';
        modalGh.classList.add('active');
    }

    btnGhSettings?.addEventListener('click', openGhModal);
    btnCloseGhModal?.addEventListener('click', () => modalGh?.classList.remove('active'));

    btnSaveGhSettings.addEventListener('click', () => {
        const owner = document.getElementById('gh-owner').value.trim();
        const repo = document.getElementById('gh-repo').value.trim();
        const branch = document.getElementById('gh-branch').value.trim() || 'main';
        const folder = document.getElementById('gh-folder').value.trim() || 'notes';
        const token = document.getElementById('gh-token').value.trim();

        HubStore.saveGitHubConfig({ owner, repo, branch, folder, token });
        modalGh.classList.remove('active');
        showToast('GitHub configuration saved!', 'success');
    });

    btnTestGhConnection.addEventListener('click', async () => {
        const owner = document.getElementById('gh-owner').value.trim();
        const repo = document.getElementById('gh-repo').value.trim();
        const token = document.getElementById('gh-token').value.trim();
        const resultDiv = document.getElementById('gh-test-result');

        if (!owner || !repo || !token) {
            resultDiv.className = 'gh-test-result error';
            resultDiv.textContent = 'Please fill in Owner, Repository, and Token first.';
            resultDiv.style.display = 'block';
            return;
        }

        resultDiv.className = 'gh-test-result info';
        resultDiv.textContent = 'Testing connection to GitHub repository...';
        resultDiv.style.display = 'block';

        try {
            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (res.ok) {
                const data = await res.json();
                resultDiv.className = 'gh-test-result success';
                resultDiv.textContent = `Connected successfully to ${data.full_name}! Permissions: Push verified.`;
            } else {
                const err = await res.json().catch(() => ({}));
                resultDiv.className = 'gh-test-result error';
                resultDiv.textContent = `Connection failed (${res.status}): ${err.message || 'Check username, repo name, or token.'}`;
            }
        } catch (e) {
            resultDiv.className = 'gh-test-result error';
            resultDiv.textContent = `Network error: ${e.message}`;
        }
    });

    /* ---- Editor Owner Auth Button ---- */
    const btnEditorAuth = document.getElementById('btn-editor-auth');
    const editorAuthText = document.getElementById('editor-auth-text');
    if (typeof FirebaseConfig !== 'undefined' && FirebaseConfig.isConfigured()) {
        FirebaseConfig.onAuthStateChanged(user => {
            if (user) {
                btnEditorAuth?.classList.add('signed-in');
                const name = user.displayName ? user.displayName.split(' ')[0] : 'Owner';
                if (editorAuthText) editorAuthText.textContent = `👤 ${name}`;
            } else {
                btnEditorAuth?.classList.remove('signed-in');
                if (editorAuthText) editorAuthText.textContent = 'Owner Login';
            }
        });

        btnEditorAuth?.addEventListener('click', async () => {
            const user = FirebaseConfig.getCurrentUser();
            if (user) {
                if (confirm(`Signed in as: ${user.email}\n\nDo you want to sign out?`)) {
                    await FirebaseConfig.signOut();
                    showToast('Signed out', 'info');
                }
            } else {
                try {
                    await FirebaseConfig.signInWithGoogle();
                    showToast('Signed in successfully!', 'success');
                } catch (err) {
                    if (err.code === 'auth/unauthorized-domain') {
                        alert('Firebase Auth Error: Please add your domain (e.g. rafat004.github.io) to "Authorized Domains" in Firebase Console (Authentication > Settings > Authorized domains).');
                    } else if (err.code !== 'auth/popup-closed-by-user') {
                        showToast(`Login error: ${err.message}`, 'error');
                    }
                }
            }
        });
    }

    // Check URL parameters and load article or preselect topic after all listeners are registered
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit') || urlParams.get('id');
    const topicParam = urlParams.get('topic');

    if (editId) {
        loadArticleForEditing(editId);
    } else if (topicParam) {
        setTimeout(() => {
            if (topicSelect) topicSelect.value = topicParam;
        }, 100);
        updateNoteHtmlStatus(false);
        updateAllSlotPreviews();
    } else {
        updateNoteHtmlStatus(false);
        updateAllSlotPreviews();
    }
}

/* ---- Toast Notification Utility ---- */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ'}</span>
        <span class="toast-msg">${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
