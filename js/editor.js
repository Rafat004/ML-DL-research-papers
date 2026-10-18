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
    const excerptInput = document.getElementById('article-excerpt');
    const mdInput = document.getElementById('markdown-input');
    const previewContent = document.getElementById('preview-content');
    const docTitle = document.getElementById('editor-doc-title');
    const statusText = document.getElementById('status-text');

    // Multi-slot Description & Architecture Diagram state (3 slots)
    const slotCount = 3;
    const currentDiagrams = ['', '', ''];

    // Action buttons
    const btnSaveLocal = document.getElementById('btn-save-local');
    const btnPublishGithub = document.getElementById('btn-publish-github');
    const btnDownloadMd = document.getElementById('btn-download-md');
    const btnInsertTemplate = document.getElementById('btn-insert-template');

    // Modals
    const modalTopic = document.getElementById('modal-new-topic');
    const btnOpenTopicModal = document.getElementById('btn-open-topic-modal');
    const btnCloseTopicModal = document.getElementById('btn-close-topic-modal');
    const btnCancelTopicModal = document.getElementById('btn-cancel-topic-modal');
    const btnSaveNewTopic = document.getElementById('btn-save-new-topic');

    const modalGh = document.getElementById('modal-github-settings');
    const btnGhSettings = document.getElementById('btn-gh-settings');
    const btnCloseGhModal = document.getElementById('btn-close-gh-modal');
    const btnSaveGhSettings = document.getElementById('btn-save-gh-settings');
    const btnTestGhConnection = document.getElementById('btn-test-gh-connection');

    // State
    let currentArticleId = null;
    let isDirty = false;

    // Set default date to today
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    // Populate topics dropdown
    renderTopicOptions();

    // Check URL parameters for ?edit=articleId
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit') || urlParams.get('id');
    const topicParam = urlParams.get('topic');

    if (editId) {
        loadArticleForEditing(editId);
    } else if (topicParam) {
        // Pre-select topic
        setTimeout(() => {
            if (topicSelect) {
                topicSelect.value = topicParam;
            }
        }, 100);
    }

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
        mdInput.value = article.content || '';

        // Normalize sections from article (at least 1 or up to 3)
        const sections = Array.isArray(article.sections) && article.sections.length > 0
            ? article.sections
            : [{ description: article.excerpt || '', diagram: article.diagram || '', diagramCaption: article.diagramCaption || '' }];

        for (let i = 1; i <= slotCount; i++) {
            const sec = sections[i - 1];
            const excerptInput = document.getElementById(`article-excerpt-${i}`);
            const urlInput = document.getElementById(`diagram-url-input-${i}`);
            const captionInput = document.getElementById(`diagram-caption-input-${i}`);
            const previewCard = document.getElementById(`diagram-preview-card-${i}`);

            if (sec) {
                if (excerptInput) excerptInput.value = sec.description || '';
                if (captionInput) captionInput.value = sec.diagramCaption || '';
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
                currentDiagrams[i - 1] = '';
                if (previewCard) previewCard.style.display = 'none';
            }
        }

        const customHtmlInput = document.getElementById('article-custom-html');
        if (customHtmlInput) {
            customHtmlInput.value = article.customHtml || '';
        }
        if (typeof updateNoteHtmlStatus === 'function') {
            updateNoteHtmlStatus(Boolean(article.customHtml && article.customHtml.trim()));
        }

        updateLivePreview();
        statusText.textContent = 'Loaded';
    }

    /* ---- Live Preview Updating ---- */
    let previewDebounceTimer = null;
    function updateLivePreview() {
        const raw = mdInput.value;
        const title = titleInput.value.trim();
        const customHtml = (document.getElementById('article-custom-html')?.value || '').trim();

        // Collect all non-empty slots
        const activeSlots = [];
        for (let i = 1; i <= slotCount; i++) {
            const desc = document.getElementById(`article-excerpt-${i}`)?.value.trim() || '';
            const diag = currentDiagrams[i - 1] || '';
            const cap = document.getElementById(`diagram-caption-input-${i}`)?.value.trim() || `Figure ${i}: Architecture diagram`;
            if (desc || diag) {
                activeSlots.push({ slot: i, desc, diag, cap });
            }
        }

        if (!raw.trim() && !title && activeSlots.length === 0 && !customHtml) {
            previewContent.innerHTML = '<p class="preview-placeholder">Live preview will render here as you type...</p>';
            return;
        }

        let headerHtml = '';
        if (title) {
            headerHtml += `<h1 class="preview-title">${escapeHtml(title)}</h1>`;
        }

        let customHtmlPreview = '';
        if (customHtml) {
            customHtmlPreview = `
                <div class="editor-live-webui-card">
                    <div class="editor-live-webui-header">
                        <div style="display: flex; align-items: center; gap: 0.4rem;">
                            <span>🌐 Interactive Web UI Preview</span>
                            <span class="mini-tag html-note-badge" style="font-size: 0.65rem;">Active Sandbox</span>
                        </div>
                        <span style="font-size: 0.72rem; color: #9caec8;">Renders at top of published note</span>
                    </div>
                    <iframe class="editor-live-webui-iframe" id="split-preview-iframe" title="Interactive Web UI Preview" sandbox="allow-scripts allow-forms allow-same-origin allow-modals"></iframe>
                </div>
            `;
        }

        let sectionsHtml = '';
        if (activeSlots.length > 0) {
            activeSlots.forEach(item => {
                if (item.desc) {
                    const label = activeSlots.length > 1 ? `Description ${item.slot}:` : 'Description:';
                    sectionsHtml += `
                        <div class="article-abstract-card">
                            <div class="abstract-label">${label}</div>
                            <p class="abstract-text">${escapeHtml(item.desc)}</p>
                        </div>
                    `;
                }
                if (item.diag) {
                    sectionsHtml += `
                        <section class="article-diagram-wrapper" style="margin: 1.25rem 0 1.75rem;">
                            <div class="diagram-display-card">
                                <div class="diagram-tag">📐 Architecture Diagram ${activeSlots.length > 1 ? `#${item.slot}` : ''}</div>
                                <div class="diagram-image-container">
                                    <img src="${item.diag}" alt="Architecture Diagram ${item.slot}" style="max-height: 380px; max-width: 100%; border-radius: 6px;">
                                </div>
                                <p class="diagram-caption">${escapeHtml(item.cap)}</p>
                            </div>
                        </section>
                    `;
                }
            });
        }

        const html = HubStore.renderMarkdown(raw);
        previewContent.innerHTML = headerHtml + customHtmlPreview + sectionsHtml + html;

        if (customHtml) {
            const splitIframe = previewContent.querySelector('#split-preview-iframe');
            if (splitIframe) {
                splitIframe.srcdoc = customHtml;
            }
        }

        // Render KaTeX math formulas
        if (typeof renderMathInElement === 'function') {
            try {
                renderMathInElement(previewContent, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false }
                    ],
                    throwOnError: false
                });
            } catch (e) {
                console.warn('KaTeX render error:', e);
            }
        }

        // Highlight code with Prism.js
        if (typeof Prism !== 'undefined') {
            Prism.highlightAllUnder(previewContent);
        }

        // Attach copy button listeners inside preview
        previewContent.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const pre = btn.closest('.code-block-wrapper').querySelector('code');
                if (pre) {
                    await navigator.clipboard.writeText(pre.textContent);
                    btn.textContent = 'Copied!';
                    setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
                }
            });
        });
    }

    function scheduleLivePreview() {
        clearTimeout(previewDebounceTimer);
        previewDebounceTimer = setTimeout(updateLivePreview, 120);
    }

    mdInput.addEventListener('input', () => {
        scheduleLivePreview();
        markDirty();
    });

    titleInput.addEventListener('input', () => {
        docTitle.textContent = titleInput.value.trim() || 'New Research Note';
        scheduleLivePreview();
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

    /* ---- Toolbar Actions ---- */
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tool = btn.dataset.tool;
            if (!tool) return;
            handleToolbarAction(tool);
        });
    });

    function handleToolbarAction(action) {
        const start = mdInput.selectionStart;
        const end = mdInput.selectionEnd;
        const selected = mdInput.value.substring(start, end);
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
                replacement = `\n$$\n${selected || '\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V'}\n$$\n`;
                cursorOffset = replacement.length;
                break;
            case 'code-block':
                replacement = `\n\`\`\`python\nimport torch\nimport torch.nn as nn\n\n# ${selected || 'Model Implementation'}\nclass MyModule(nn.Module):\n    def __init__(self):\n        super().__init__()\n        self.linear = nn.Linear(512, 512)\n        \n    def forward(self, x):\n        return self.linear(x)\n\`\`\`\n`;
                cursorOffset = replacement.length;
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

        mdInput.focus();
        mdInput.setRangeText(replacement, start, end, 'end');
        updateLivePreview();
        markDirty();
    }

    /* ---- Insert Academic DL Template ---- */
    if (btnInsertTemplate) {
        btnInsertTemplate.addEventListener('click', () => {
            const title = titleInput.value.trim() || 'Architecture Concept';
            const template = `## 1. Problem Formulation & Intuition

Explain the core motivation behind this architecture or algorithm. Why is it needed, and what limitations of previous approaches does it solve?

> [!KEY INSIGHT]
> Summarize the central idea in a single punchy takeaway sentence.

---

## 2. Mathematical Derivation

Formulate the mathematical foundation rigorously.

$$\\mathcal{L}_{total} = \\mathcal{L}_{task} + \\lambda \\mathcal{L}_{reg}$$

Where:
- $x \\in \\mathbb{R}^{d_{in}}$ denotes the input representations.
- $W \\in \\mathbb{R}^{d_{out} \\times d_{in}}$ represents the learnable projection weights.
- $\\sigma(\\cdot)$ denotes the non-linear activation function.

---

## 3. PyTorch Implementation

\`\`\`python
import torch
import torch.nn as nn
import torch.nn.functional as F

class ${title.replace(/\s+/g, '') || 'CustomModule'}(nn.Module):
    """
    Implementation of ${title}.
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
    model = ${title.replace(/\s+/g, '') || 'CustomModule'}(d_model=512)
    output = model(dummy_input)
    print("Output shape:", output.shape)  # torch.Size([8, 64, 512])
\`\`\`

---

## 4. Key Takeaways & Empirical Gotchas

- **Initialization:** Be mindful of variance scaling when initializing layer weights.
- **Complexity:** Time complexity scales as $\\mathcal{O}(N)$ or $\\mathcal{O}(N^2)$ with respect to sequence length.
- **Failure Modes:** Watch out for exploding activations without proper layer normalization.
`;
            if (mdInput.value.trim() && !confirm('Insert template and append to your current document?')) {
                return;
            }

            mdInput.value = mdInput.value ? `${mdInput.value}\n\n${template}` : template;
            updateLivePreview();
            markDirty();
            showToast('Deep learning note template inserted!', 'info');
        });
    }

    /* ---- View Toggles: Split, Write, Preview ---- */
    const workspace = document.getElementById('editor-workspace');
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const view = btn.dataset.view;

            workspace.classList.remove('split-view', 'edit-only', 'preview-only');
            if (view === 'split') workspace.classList.add('split-view');
            else if (view === 'edit') workspace.classList.add('edit-only');
            else if (view === 'preview') workspace.classList.add('preview-only');
        });
    });

    /* ---- Diagram File Upload & Drag and Drop for All 3 Slots ---- */
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

        if (excerptInput) {
            excerptInput.addEventListener('input', () => {
                scheduleLivePreview();
                markDirty();
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
                scheduleLivePreview();
                markDirty();
            });
        }

        if (captionInput) {
            captionInput.addEventListener('input', () => {
                if (previewCaption) {
                    previewCaption.textContent = captionInput.value.trim() || `Figure ${slot}: Architecture diagram`;
                }
                scheduleLivePreview();
                markDirty();
            });
        }

        if (btnRemove) {
            btnRemove.addEventListener('click', () => {
                currentDiagrams[slot - 1] = '';
                if (urlInput) urlInput.value = '';
                if (fileInput) fileInput.value = '';
                if (previewCard) previewCard.style.display = 'none';
                scheduleLivePreview();
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
            scheduleLivePreview();
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
    const noteHtmlInput = document.getElementById('article-custom-html');
    const btnNotePaste = document.getElementById('btn-note-helper-paste');
    const btnNoteTemplate = document.getElementById('btn-note-helper-template');
    const btnNotePreview = document.getElementById('btn-note-helper-preview');
    const btnNoteHelperSave = document.getElementById('btn-note-helper-save');
    const btnNotePreviewSave = document.getElementById('btn-note-preview-save');
    const noteHtmlStatusPill = document.getElementById('note-html-status-pill');
    const notePreviewContainer = document.getElementById('note-html-preview-container');
    const notePreviewFrame = document.getElementById('note-html-preview-frame');
    const btnCloseNotePreview = document.getElementById('btn-close-note-preview');
    const previewSandboxStatus = document.getElementById('preview-sandbox-status');

    function updateNoteHtmlStatus(isSaved = false) {
        if (!noteHtmlStatusPill) return;
        const code = (noteHtmlInput?.value || '').trim();
        if (!code) {
            noteHtmlStatusPill.className = 'html-status-pill';
            noteHtmlStatusPill.textContent = 'No HTML code added';
            if (previewSandboxStatus) {
                previewSandboxStatus.className = 'html-status-pill';
                previewSandboxStatus.textContent = 'Empty';
            }
            return;
        }

        const sizeKb = (code.length / 1024).toFixed(1);
        if (isSaved) {
            noteHtmlStatusPill.className = 'html-status-pill saved';
            noteHtmlStatusPill.textContent = `✓ Web UI Saved (${sizeKb} KB - Local & Cloud)`;
            if (previewSandboxStatus) {
                previewSandboxStatus.className = 'html-status-pill saved';
                previewSandboxStatus.textContent = '✓ Saved to Note & Cloud';
            }
        } else {
            noteHtmlStatusPill.className = 'html-status-pill ready';
            noteHtmlStatusPill.textContent = `⚡ Web UI Ready (${sizeKb} KB - Click Save)`;
            if (previewSandboxStatus) {
                previewSandboxStatus.className = 'html-status-pill ready';
                previewSandboxStatus.textContent = '⚡ Sandbox Active';
            }
        }
    }

    if (noteHtmlInput) {
        noteHtmlInput.addEventListener('input', () => {
            updateNoteHtmlStatus(false);
            markDirty();
            clearTimeout(previewDebounceTimer);
            previewDebounceTimer = setTimeout(updateLivePreview, 400);
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
                updateLivePreview();
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
        updateLivePreview();
        showToast('Loaded Interactive Roadmap starter template', 'success');
    });

    btnNotePreview?.addEventListener('click', () => {
        if (!noteHtmlInput || !notePreviewFrame || !notePreviewContainer) return;
        const code = noteHtmlInput.value.trim();
        if (!code) {
            alert('Please write or paste some HTML code first!');
            return;
        }
        notePreviewFrame.srcdoc = code;
        notePreviewContainer.style.display = 'block';
        updateNoteHtmlStatus(false);
        if (previewSandboxStatus) {
            previewSandboxStatus.className = 'html-status-pill ready';
            previewSandboxStatus.textContent = '⚡ Sandbox Active';
        }
        notePreviewContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
        const title = titleInput.value.trim();
        if (!title) {
            showToast('Please enter an article title', 'warning');
            titleInput.focus();
            return null;
        }

        const selectedOption = topicSelect.options[topicSelect.selectedIndex];
        const topicId = topicSelect.value || '';
        const topicName = selectedOption && selectedOption.dataset.name ? selectedOption.dataset.name : 'General Research';

        const sections = [];
        for (let i = 1; i <= slotCount; i++) {
            const desc = document.getElementById(`article-excerpt-${i}`)?.value || '';
            const diag = currentDiagrams[i - 1] || '';
            const cap = document.getElementById(`diagram-caption-input-${i}`)?.value || '';
            sections.push({
                description: desc.trim(),
                diagram: diag,
                diagramCaption: cap.trim()
            });
        }

        const primarySection = sections.find(s => s.description || s.diagram) || sections[0] || { description: '', diagram: '', diagramCaption: '' };
        const customHtml = (document.getElementById('article-custom-html')?.value || '').trim();
        const isHtmlNote = Boolean(customHtml.length > 0);

        return {
            id: currentArticleId,
            title: title,
            topicId: topicId,
            topicName: topicName,
            date: dateInput.value || new Date().toISOString().split('T')[0],
            tags: tagsInput.value,
            excerpt: primarySection.description,
            content: mdInput.value,
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

    /* ---- Keyboard Shortcut: Ctrl+S / Cmd+S ---- */
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveArticleLocally();
        }
    });

    /* ---- New Topic Modal Handling ---- */
    btnOpenTopicModal.addEventListener('click', () => {
        modalTopic.classList.add('active');
        document.getElementById('new-topic-name').focus();
    });

    function closeTopicModal() {
        modalTopic.classList.remove('active');
        document.getElementById('new-topic-name').value = '';
        document.getElementById('new-topic-desc').value = '';
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

        const icon = document.getElementById('new-topic-icon').value.trim() || '🧠';
        const tag = document.getElementById('new-topic-tag').value.trim() || 'Custom';
        const desc = document.getElementById('new-topic-desc').value.trim();

        isSavingNewTopic = true;
        btnSaveNewTopic.disabled = true;
        btnSaveNewTopic.textContent = 'Saving...';
        try {
            const savedTopic = await HubStore.saveTopic({
                name: name,
                icon: icon,
                tag: tag,
                description: desc
            });

            renderTopicOptions(savedTopic.id);
            closeTopicModal();
            showToast(`Topic "${savedTopic.name}" created!`, 'success');
        } catch (e) {
            showToast(`Error creating topic: ${e.message}`, 'error');
        } finally {
            isSavingNewTopic = false;
            btnSaveNewTopic.disabled = false;
            btnSaveNewTopic.textContent = 'Save Topic';
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
