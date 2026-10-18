// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VC.CODE EDITOR COMPONENT — Srey Browser Suite
// Professional VS Code-style web editor inside the miniapp panel.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(function() {
  'use strict';

  const ROOT_ID = 'vc-editor-root';

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // VS CODE COLOR PALETTE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const THEME = {
    editorBg: '#1e1e1e',
    sidebarBg: '#252526',
    sidebarBorder: '#333333',
    panelBg: '#2d2d2d',
    statusBarBg: '#007acc',
    statusBarHover: '#0062a3',
    text: '#cccccc',
    textMuted: '#858585',
    accent: '#007acc',
    accentHover: '#3794ff',
    border: '#333333',
    lineNumber: '#858585',
    lineNumberActive: '#cccccc',
    selection: '#264f78',
    activeLine: '#2a2a2a'
  };

  const FILES = {
    'README.md': '# Srey Cinema Platform\n\nWelcome to VC.Code — a professional web-based code editor.\n\n## Available Files\n- index.html\n- app.js\n- styles.css\n- vc-editor.js\n- config.json\n\nWatch-to-earn active: 60s heartbeat, 30-min reward engine, 80/20 split.',
    'index.html': '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Sreymara Cinema</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n  <div class="app-container">\n    <h1>Sreymara Cinema</h1>\n  </div>\n  <script src="app.js"></script>\n</body>\n</html>',
    'app.js': '// SREYMARA URBAN CINEMA ENGINE\n(function() {\n  window.UrbanCinema = window.UrbanCinema || {};\n  window.UrbanCinema.switchTab = function(tabId) {\n    document.querySelectorAll(\'.panel-content\').forEach(p =>\n      p.classList.toggle(\'active\', p.id === \'panel-\' + tabId));\n  };\n  console.log(\'Cinema engine loaded\');\n})();',
    'styles.css': '/* Obsidian luxury glass theme */\n:root {\n  --bg: #07090e;\n  --gold: #d4af37;\n  --cyan: #00f2fe;\n}\n* { box-sizing: border-box; margin: 0; padding: 0; }\nbody {\n  background: var(--bg);\n  color: #f8fafc;\n  font-family: -apple-system, BlinkMacSystemFont, \'SF Pro Display\', Inter, sans-serif;\n  min-height: 100vh;\n}',
    'config.json': '{\n  "app": "Sreymara Cinema & VIP Lounge",\n  "version": "1.0.0",\n  "earning": {\n    "heartbeatSeconds": 60,\n    "rewardPoints": 15,\n    "rewardTrx": 0.03,\n    "split": { "owner": 70, "worker": 30 }\n  },\n  "theme": "obsidian",\n  "tabs": ["cinema", "vc", "srey", "vip", "vault"]\n}'
  };

  const FILE_ORDER = ['README.md', 'index.html', 'app.js', 'styles.css', 'config.json'];

  let currentFile = 'README.md';
  let editorContent = '';
  let isInitialized = false;
  let aiPanelOpen = false;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return (ctx || document).querySelectorAll(sel); }
  function esc(html) {
    return String(html).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":"&#39;",'"':'&quot;'}[c]));
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SVG GLYPHS FOR FILE TYPES (clean UTF-8, no mojibake)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const FILE_ICONS = {
    js: '<svg class="vc-icon-file vc-icon-js" viewBox="0 0 24 24" fill="none" stroke="#f7df1e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><circle cx="12" cy="12" r="3"></circle></svg>',
    mjs: '<svg class="vc-icon-file vc-icon-js" viewBox="0 0 24 24" fill="none" stroke="#f7df1e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><circle cx="12" cy="12" r="3"></circle></svg>',
    json: '<svg class="vc-icon-file vc-icon-json" viewBox="0 0 24 24" fill="none" stroke="#f7df1e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="6" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="18"></line></svg>',
    css: '<svg class="vc-icon-file vc-icon-css" viewBox="0 0 24 24" fill="none" stroke="#2965f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
    html: '<svg class="vc-icon-file vc-icon-html" viewBox="0 0 24 24" fill="none" stroke="#e34f26" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
    htm: '<svg class="vc-icon-file vc-icon-html" viewBox="0 0 24 24" fill="none" stroke="#e34f26" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
    md: '<svg class="vc-icon-file vc-icon-md" viewBox="0 0 24 24" fill="none" stroke="#083fa1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
    txt: '<svg class="vc-icon-file vc-icon-txt" viewBox="0 0 24 24" fill="none" stroke="#858585" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>'
  };

  function fileIcon(f) {
    const ext = f.split('.').pop().toLowerCase();
    return FILE_ICONS[ext] || FILE_ICONS.txt;
  }

  function langOf(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = { js: 'js', mjs: 'js', json: 'json', css: 'css', html: 'html', htm: 'html', md: 'md', txt: 'md' };
    return map[ext] || 'txt';
  }

  function highlight(code, lang) {
    let out = esc(code);
    if (lang === 'js' || lang === 'json') {
      out = out.replace(/\b(function|const|let|var|return|if|else|for|while|async|await|try|catch|class|new|this|export|import|default|switch|case|break|typeof|instanceof|void|delete|in|of)\b/g, '<span class="tok-kw">$1</span>');
      out = out.replace(/\b(true|false|null|undefined|NaN)\b/g, '<span class="tok-lit">$1</span>');
      out = out.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '<span class="tok-str">$&</span>');
      out = out.replace(/\b\d+\.?\d*\b/g, '<span class="tok-num">$&</span>');
      out = out.replace(/\/\/[^\n]*/g, '<span class="tok-cmt">$&</span>');
    } else if (lang === 'html') {
      out = out.replace(/<([\/]?[a-zA-Z0-9:-]+)/g, '<span class="tok-tag">&lt;$1</span>');
      out = out.replace(/\b(class|id|href|src|type|name|value|placeholder|style|lang|charset)\b/g, '<span class="tok-attr">$1</span>');
      out = out.replace(/="(?:[^"\\]|\\.)*"/g, '<span class="tok-str">$&</span>');
      out = out.replace(/<!--[\s\S]*?-->/g, '<span class="tok-cmt">$&</span>');
    } else if (lang === 'css') {
      out = out.replace(/([a-zA-Z-]+)\s*:/g, '<span class="tok-prop">$1</span>:');
      out = out.replace(/(?<=:)\s*([^;}]+)/g, '<span class="tok-val">$1</span>');
      out = out.replace(/\/\*[\s\S]*?\*\//g, '<span class="tok-cmt">$&</span>');
    }
    return out;
  }

  function lineNumbers(count) {
    const nums = [];
    for (let i = 1; i <= count; i++) nums.push(i);
    return nums.map(n => '<div class="vc-line">' + n + '</div>').join('');
  }

  function getGutter() { return document.getElementById('vc-gutter'); }
  function getTextarea() { return document.getElementById('vc-textarea'); }

  function updateGutter() {
    const ta = getTextarea();
    const gutter = getGutter();
    if (!ta || !gutter) return;
    const lines = ta.value.split('\n').length;
    const needed = lineNumbers(lines);
    if (gutter.innerHTML !== needed) gutter.innerHTML = needed;
    gutter.scrollTop = ta.scrollTop;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function render() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const file = FILES[currentFile] || '';
    editorContent = file;
    const lang = langOf(currentFile);
    const highlighted = highlight(file, lang);
    const lineCount = file.split('\n').length;

    root.innerHTML =
      '<div class="vc-toolbar glass">' +
        '<div class="vc-breadcrumbs">' +
          '<span class="vc-breadcrumb"><svg class="vc-icon-breadcrumb" viewBox="0 0 16 16" fill="none" stroke="#858585" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l2-2 2 2"/><path d="M9 15V5l-4-4"/></svg><span>srey-cinema</span></span>' +
          '<span class="vc-sep">›</span>' +
          '<span class="vc-breadcrumb"><svg class="vc-icon-file" style="width:12px;height:12px;" viewBox="0 0 24 24" fill="none" stroke="#858585" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg><span>' + esc(currentFile) + '</span></span>' +
        '</div>' +
        '<div class="vc-actions">' +
          '<button class="vc-btn vc-btn-run" title="Run / Preview" onclick="window.VCEditor.runPreview()">▶ Run</button>' +
          '<button class="vc-btn" title="Save" onclick="window.VCEditor.save()">💾 Save</button>' +
          '<button class="vc-btn" title="Format" onclick="window.VCEditor.format()">✨ Format</button>' +
          '<button class="vc-btn vc-btn-ai" title="AI Assist" onclick="window.VCEditor.toggleAI()">✨ AI Assist</button>' +
        '</div>' +
      '</div>' +
      '<div class="vc-editor-wrap glass">' +
        '<div class="vc-explorer">' +
          '<div class="vc-explorer-header">EXPLORER</div>' +
          '<ul class="vc-file-list">' +
            FILE_ORDER.map(f => '' +
              '<li class="vc-file-item' + (f === currentFile ? ' vc-active' : '') + '"' +
              ' onclick="window.VCEditor.openFile(\'' + esc(f) + '\')" title="' + esc(f) + '">' +
              '<span class="vc-file-icon">' + fileIcon(f) + '</span>' +
              '<span class="vc-file-name">' + esc(f) + '</span>' +
              '</li>').join('') +
          '</ul>' +
          '<div class="vc-explorer-footer">' +
            '<small class="vc-muted">' + FILE_ORDER.length + ' files • VC.Code</small>' +
          '</div>' +
        '</div>' +
        '<div class="vc-editor-panel">' +
          '<div class="vc-editor-tabs">' +
            '<div class="vc-tab vc-tab-active">' + esc(currentFile) + '</div>' +
            '<div class="vc-tab-close" onclick="event.stopPropagation(); window.VCEditor.toggleAI()">✕</div>' +
          '</div>' +
          '<div class="vc-gutter" id="vc-gutter">' + lineNumbers(lineCount) + '</div>' +
          '<textarea class="vc-textarea" id="vc-textarea" spellcheck="false" wrap="off">' + esc(file) + '</textarea>' +
        '</div>' +
      '</div>' +
      (aiPanelOpen ? renderAIPanel() : '') +
      '<div class="vc-statusbar glass">' +
        '<span class="vc-status-item">' + lang.toUpperCase() + '</span>' +
        '<span class="vc-status-sep">·</span>' +
        '<span class="vc-status-item">Spaces: 2</span>' +
        '<span class="vc-status-sep">·</span>' +
        '<span class="vc-status-item">UTF-8</span>' +
        '<span class="vc-status-sep">·</span>' +
        '<span class="vc-status-item" id="vc-modified"></span>' +
        '<span class="vc-status-right">Ln 1, Col 1</span>' +
      '</div>';

    const ta = getTextarea();
    if (ta) {
      ta.addEventListener('input', function() {
        editorContent = this.value;
        updateGutter();
        const mod = document.getElementById('vc-modified');
        if (mod) mod.textContent = '●';
        updateStatusLine();
      });
      ta.addEventListener('scroll', function() {
        const g = getGutter();
        if (g) g.scrollTop = this.scrollTop;
      });
      ta.addEventListener('keyup', updateStatusLine);
      ta.addEventListener('click', updateStatusLine);
    }
    updateGutter();
    updateStatusLine();
  }

  function updateStatusLine() {
    const ta = getTextarea();
    const right = document.querySelector('.vc-status-right');
    if (!ta || !right) return;
    const before = ta.value.substring(0, ta.selectionStart);
    const line = before.split('\n').length;
    const col = before.split('\n').pop().length + 1;
    right.textContent = 'Ln ' + line + ', Col ' + col;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // AI CHAT SUB-PANEL
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function renderAIPanel() {
    return '<div class="vc-ai-panel glass">' +
      '<div class="vc-ai-header">' +
        '<span class="vc-ai-title">✨ AI Assist</span>' +
        '<button class="vc-ai-close" onclick="window.VCEditor.toggleAI()">✕</button>' +
      '</div>' +
      '<div class="vc-ai-messages" id="vc-ai-messages">' +
        '<div class="vc-ai-msg vc-ai-msg-bot">Hi — I\'m your coding assistant. Ask me to write, patch, or explain code snippets safely.</div>' +
      '</div>' +
      '<div class="vc-ai-input">' +
        '<input class="vc-ai-text" id="vc-ai-text" placeholder="Type a command (e.g. "add a dark-mode toggle")" spellcheck="false">' +
        '<button class="vc-ai-send" onclick="window.VCEditor.aiSend()">Send</button>' +
      '</div>' +
    '</div>';
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PUBLIC API
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  window.VCEditor = {
    init() {
      if (isInitialized) return;
      isInitialized = true;
      render();
    },

    openFile(name) {
      currentFile = name;
      editorContent = FILES[name] || '';
      aiPanelOpen = false;
      render();
    },

    toggleAI() {
      aiPanelOpen = !aiPanelOpen;
      render();
      if (aiPanelOpen) {
        const input = document.getElementById('vc-ai-text');
        if (input) setTimeout(() => input.focus(), 50);
      }
    },

    aiSend() {
      const input = document.getElementById('vc-ai-text');
      if (!input) return;
      const text = input.value.trim();
      if (!text) return;
      const messages = document.getElementById('vc-ai-messages');
      input.value = '';
      if (messages) {
        messages.innerHTML += '<div class="vc-ai-msg vc-ai-msg-user">▶ ' + esc(text) + '</div>';
        messages.scrollTop = messages.scrollHeight;
      }
      setTimeout(function() {
        if (!messages) return;
        messages.innerHTML += '<div class="vc-ai-msg vc-ai-msg-bot">Here is a safe snippet you can paste into the editor:</div>' +
          '<div class="vc-ai-snippet"><pre><code>' + esc('// AI-generated suggestion for: ' + text + '\n// Paste this into your active file and review before saving.') + '</code></pre>' +
          '<button class="vc-ai-apply" onclick="window.VCEditor.aiApplyLast()">Apply to editor</button></div>';
        messages.scrollTop = messages.scrollHeight;
      }, 400);
    },

    aiApplyLast() {
      const ta = getTextarea();
      if (!ta) return;
      const snippet = '// AI-applied patch\n// Review before saving.\n';
      ta.value = snippet + ta.value;
      editorContent = ta.value;
      ta.dispatchEvent(new Event('input'));
      const mod = document.getElementById('vc-modified');
      if (mod) mod.textContent = '●';
    },

    runPreview() {
      const ta = getTextarea();
      const content = ta ? ta.value : (FILES[currentFile] || '');
      const blob = new Blob([content], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank', 'width=900,height=700');
      if (!win) alert('Popup blocked — allow popups for this site to preview.');
    },

    save() {
      const ta = getTextarea();
      const content = ta ? ta.value : editorContent;
      FILES[currentFile] = content;
      editorContent = content;
      const mod = document.getElementById('vc-modified');
      if (mod) mod.textContent = '✓ Saved';
      setTimeout(function() {
        if (mod) mod.textContent = '';
      }, 1200);
    },

    format() {
      const ta = getTextarea();
      if (!ta) return;
      let code = ta.value;
      code = code.replace(/[ \t]+$/gm, '');
      code = code.replace(/\n{3,}/g, '\n\n');
      if (!code.endsWith('\n')) code += '\n';
      ta.value = code;
      editorContent = code;
      ta.dispatchEvent(new Event('input'));
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { window.VCEditor.init(); });
  } else {
    window.VCEditor.init();
  }
})();
