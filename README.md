# ◈ Deep Learning Knowledge Hub

> **A personalized, distraction-free digital laboratory for deep learning research notes, mathematical derivations, neural network architectures, and PyTorch implementations.**

🌐 **Live Website:** [https://rafat004.github.io/ML-DL-research-papers/](https://rafat004.github.io/ML-DL-research-papers/)  
📁 **Repository:** [https://github.com/Rafat004/ML-DL-research-papers](https://github.com/Rafat004/ML-DL-research-papers)  
📄 **Full About Document:** [`about.md`](about.md)

---

## 📖 About This Knowledge Hub

When studying machine learning and deep learning research papers, conventional note-taking tools often struggle with the trifecta of machine learning documentation:
1. **Complex Mathematical Derivations** (gradient formulations, loss functions, backpropagation).
2. **Clean Code Implementations** (PyTorch modules, training loops, tensor manipulations).
3. **Architecture Diagrams** (flowcharts, attention matrix schematics, pipeline visualizations).

This **Deep Learning Knowledge Hub** is engineered specifically to solve that problem. It is designed as a **blank, customizable digital laboratory** where you can build your own personal encyclopedia of deep learning concepts without any cluttered, pre-baked filler topics.

---

## ⚡ Key Features

- **🎯 Fully Customizable Topics:** Create and organize your own chapters and topics (e.g. *Transformers*, *Diffusion Models*, *Reinforcement Learning*, *Vision Transformers*, *Optimization*).
- **📝 Real-time Split-Screen Editor:** Write in Markdown and see live KaTeX mathematical equations and syntax-highlighted code side-by-side.
- **🧮 KaTeX LaTeX Rendering:** High-speed, publication-grade math rendering for inline equations (`$\mathcal{L}_{\text{total}}$`) and block formulas (`$$\nabla_\theta J(\theta)$$`).
- **💻 Syntax-Highlighted Code Blocks:** Clean syntax highlighting with one-click copy buttons, optimized for Python and PyTorch.
- **📐 Interactive Architecture Lightbox:** Attach high-resolution model architectures, schematics, and diagrams with a full-screen zoomable lightbox viewer.
- **🗑️ Complete Topic & Note Management:** Full deletion controls with confirmation safeguards—delete topics and all related notes directly from the topic page or directory cards.
- **💾 Local-First Persistence & Backup:** All your notes and topics are saved locally in your browser storage with zero login friction. Includes one-click complete JSON backup export and import.
- **🚀 GitHub Sync & GitHub Pages Ready:** Host the entire site for free via GitHub Pages, with optional GitHub REST API sync to commit `.md` notes straight to your repository.

---

## 🛠️ How to Use

### 1. Creating a Topic
- Click **`+ New Topic`** on the homepage or in the Topic Directory.
- Provide a title, choose an icon/emoji (e.g. ⚡, 🧠, 🎨), assign a category tag, and add an optional short description.

### 2. Writing Research Notes
- Click **`+ New Note`** to launch the editor.
- Fill in:
  - **Title** of your paper or concept.
  - **Topic**: Select which topic category it belongs to.
  - **Description**: Add a concise summary of the key findings or takeaways.
  - **Architecture Diagram**: Paste an image URL or upload a diagram file.
  - **Markdown Body**: Write your notes, derivations, and code snippets.
- Use the quick toolbar buttons to insert headings, LaTeX math templates, Python code blocks, and callout boxes.
- Click **`Save Note`** to store locally, or **`Download .md`** to export an offline copy.

### 3. Reading and Studying
- Open any note in the clean academic reader.
- Use the interactive **Table of Contents** sidebar to jump between sections.
- Click on any architecture diagram to open the interactive zoom lightbox.

### 4. Deleting Topics and Notes
- **To delete a note:** Open the note and click the red trash icon in the top action bar.
- **To delete a topic:** 
  - Click the trash icon 🗑️ on any topic card in the directory.
  - Or open the topic page and click the **`Delete Topic`** button in the header bar.

---

## 📂 Repository Structure

```text
├── index.html           # Knowledge hub homepage with topic directory & quick stats
├── topics.html          # Dynamic topic directory and topic-filtered notes view
├── editor.html          # Real-time split-screen Markdown, LaTeX & code editor
├── article.html         # Publication-grade article reader with TOC & diagram lightbox
├── about.md             # Complete description and documentation of this hub
├── README.md            # GitHub repository overview & documentation
├── css/
│   └── style.css        # Academic light theme, typography tokens & responsive layout
└── js/
    ├── hub-store.js     # Data layer: LocalStorage, GitHub REST API, Markdown parser
    ├── editor.js        # Split-screen editor logic, live KaTeX/Prism preview
    ├── article.js       # Article reader typesetting, code copy, & deletion handling
    ├── topics-view.js   # Dynamic topics listing and single-topic view rendering
    └── main.js          # Homepage interactions, search overlay, & backup handlers
```

---

## 🚀 Hosting on GitHub Pages

1. Go to your repository **Settings** → **Pages**.
2. Under **Build and deployment**, select:
   - **Source:** `Deploy from a branch`
   - **Branch:** `main` / `(root)`
3. Click **Save**. Within 1–2 minutes, your hub is live online!

---

*Built with passion for deep learning research, mathematics, and clean code.*
