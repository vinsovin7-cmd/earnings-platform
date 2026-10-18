// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
// VC.CODE EDITOR COMPONENT â€” Srey Browser Suite
// Self-contained VS Codeâ€“style editor inside the miniapp panel.
// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
(function() {
  'use strict';

  const ROOT_ID = 'vc-editor-root';

  const FILES = {
    'README.md': '# Srey Cinema Platform\n\nWelcome to the VC.Code Editor.\n\n## Files\n- index.html\n- app.js\n- styles.css\n- vc-editor.js\n- config.json\n\nWatch-to-earn active: 60s heartbeat, 30-min reward engine, 80/20 split.',
    'index.html': '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Sreymara Cinema</title><link rel="stylesheet" href="styles.css"></head><body><div class="app-container"><header class="header-pill glass"><div class="user-chip"><span class="avatar-ring">ðŸ‘¤</span><div class="user-info"><span class="user-name" id="user-display">Guest</span></div></div></header><nav class="nav-tabs glass"><button class="tab-btn active" data-tab="cinema">ðŸ¿ Cinema</button><button class="tab-btn" data-tab="vc">ðŸ’» VC.Code</button><button class="tab-btn" data-tab="srey">ðŸŒ Srey Browser</button></nav><main class="panels-container"><section id="panel-cinema" class="panel-content active"><video id="main-video" playsinline preload="auto"></video></section></main></div><script src="app.js"></script></body></html>',
    'app.js': '// SREYMARA URBAN CINEMA ENGINE\n(function() {\n  window.UrbanCinema = window.UrbanCinema || {};\n  window.UrbanCinema.switchTab = function(tabId) {\n    document.querySelectorAll(\'.panel-content\').forEach(p =>\n      p.classList.toggle(\'active\', p.id === \'panel-\' + tabId));\n  };\n  console.log(\'Cinema engine loaded\');\n})();',
    'styles.css': '/* Obsidian luxury glass theme */\n:root {\n  --bg: #07090e;\n  --gold: #d4af37;\n  --cyan: #00f2fe;\n  --emerald: #00e676;\n  --text: #f8fafc;\n  --muted: #94a3b8;\n}\n* { box-sizing: border-box; margin: 0; padding: 0; }\nbody {\n  background: var(--bg);\n  color: var(--text);\n  font-family: -apple-system, BlinkMacSystemFont, \'SF Pro Display\', Inter, sans-serif;\n  min-height: 100vh;\n}\n.glass {\n  background: rgba(18, 24, 38, 0.75);\n  border: 1px solid rgba(255,255,255,0.08);\n  border-radius: 18px;\n}',
    'config.json': '{\n  "app": "Sreymara Cinema & VIP Lounge",\n  "version": "1.0.0",\n  "earning": {\n    "heartbeatSeconds": 60,\n    "rewardPoints": 15,\n    "rewardTrx": 0.03,\n    "split": { "owner": 70, "worker": 30 }\n  },\n  "theme": "obsidian",\n  "tabs": ["cinema", "vc", "srey", "vip", "vault"]\n}'
  };
  const FILE_ORDER = ['README.md', 'index.html', 'app.js', 'styles.css', 'config.json'];

  let currentFile = 'README.md';
  let editorContent = '';
  let isInitialized = false;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function esc(html) {
    return String(html).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\'':'&#39;','"':'&quot;'}[c]));
  }
  function highlight(code, lang) {
    let out = esc(code);
    if (lang === 'js' || lang === 'json') {
      out = out.replace(/\b(function|const|let|var|return|if|else|for|while|async|await|try|catch|class|new|this|export|import|default|switch|case|break|typeof|instanceof|void|delete|in|of)\b/g, '<span class="tok-kw">$1</span>');
      out = out.replace(/(true|false|null|undefined|NaN)/g, '<span class="tok-lit">$1</span>');
      out = out.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '<span class="tok-str">$1</span>');
      out = out.replace(/\b\d+\.?\d*\b/g, '<span class="tok-num">$&</span>');
      out = out.replace(/\/\/[^\n]*/g, '<span class="tok-cmt">$&</span>');
    }
    return out;
  }
  function langOf(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = { js: 'js', mjs: 'js', json: 'json', css: 'css', html: 'html', htm: 'html', md: 'md', txt: 'md' };
    return map[ext] || 'txt';
  }

  function lineNumbers(code) {
    const lines = code.split('\\n').length;
    return Array.from({length: lines}, (_, i) => (i + 1)).join('<div class="vc-line"></div>');
  }

  function fileIcon(f) {
    const ext = f.split('.').pop().toLowerCase();
    const map = { js: 'ðŸ“œ', mjs: 'ðŸ“œ', json: 'ðŸ“‹', css: 'ðŸŽ¨', html: 'ðŸŒ', htm: 'ðŸŒ', md: 'ðŸ“', txt: 'ðŸ“„' };
    return map[ext] || 'ðŸ“„';
  }

  function getGutter() { return document.getElementById('vc-gutter'); }
  function updateGutter() {
    const ta = document.getElementById('vc-textarea');
    const gutter = getGutter();
    if (!ta || !gutter) return;
    const lines = ta.value.split('\\n').length;
    const needed = Array.from({length: lines}, (_, i) => i + 1).join('<div class="vc-line"></div>');
    if (gutter.innerHTML !== needed) gutter.innerHTML = needed;
  }

  function render() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const file = FILES[currentFile] || '';
    const lang = langOf(currentFile);

    root.innerHTML = '' +
      '<div class="vc-toolbar glass">' +
        '<div class="vc-breadcrumbs">' +
          '<span class="vc-breadcrumb"><span class="vc-icon">ðŸ“</span> srey-cinema</span>' +
          '<span class="vc-sep">â€º</span>' +
          '<span class="vc-breadcrumb"><span class="vc-icon">ðŸ“„</span>' + esc(currentFile) + '</span>' +
        '</div>' +
        '<div class="vc-actions">' +
          '<button class="vc-btn" title="Run / Preview" onclick="window.VCEditor.runPreview()">â–¶ Run</button>' +
          '<button class="vc-btn" title="Save" onclick="window.VCEditor.save()">ðŸ’¾ Save</button>' +
          '<button class="vc-btn" title="Format" onclick="window.VCEditor.format()">âœ¨ Format</button>' +
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
            '<small class="vc-muted">5 files â€¢ VC.Code</small>' +
          '</div>' +
        '</div>' +
        '<div class="vc-editor-panel">' +
          '<div class="vc-editor-tabs">' +
            '<div class="vc-tab vc-tab-active">' + esc(currentFile) + '</div>' +
            '<div class="vc-tab-close" onclick="event.stopPropagation();">Ã—</div>' +
          '</div>' +
          '<div class="vc-gutter" id="vc-gutter">' + lineNumbers(file) + '</div>' +
          '<textarea class="vc-textarea" id="vc-textarea" spellcheck="false" wrap="off">' + esc(file) + '</textarea>' +
        '</div>' +
      '</div>' +
      '<div class="vc-statusbar glass">' +
        '<span class="vc-status-item">' + lang.toUpperCase() + '</span>' +
        '<span class="vc-status-sep">Â·</span>' +
        '<span class="vc-status-item">Spaces: 2</span>' +
        '<span class="vc-status-sep">Â·</span>' +
        '<span class="vc-status-item">UTF-8</span>' +
        '<span class="vc-status-sep">Â·</span>' +
        '<span class="vc-status-item" id="vc-modified"></span>' +
        '<span class="vc-status-right">Ln 1, Col 1</span>' +
      '</div>';

    const ta = document.getElementById('vc-textarea');
    if (ta) {
      ta.addEventListener('input', function() {
        editorContent = this.value;
        updateGutter();
        const mod = document.getElementById('vc-modified');
        if (mod) mod.textContent = 'â—';
      });
      ta.addEventListener('scroll', function() {
        const g = getGutter();
        if (g) g.scrollTop = this.scrollTop;
      });
    }
    updateGutter();
  }

  window.VCEditor = {
    init() {
      if (isInitialized) return;
      isInitialized = true;
      render();
    },
    openFile(name) {
      currentFile = name;
      editorContent = FILES[name] || '';
      render();
    },
    runPreview() {
      const ta = document.getElementById('vc-textarea');
      const content = ta ? ta.value : (FILES[currentFile] || '');
      const blob = new Blob([content], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank', 'width=800,height=600');
      if (!win) alert('Popup blocked â€” allow popups for this site to preview.');
    },
    save() {
      const ta = document.getElementById('vc-textarea');
      const content = ta ? ta.value : editorContent;
      FILES[currentFile] = content;
      editorContent = content;
      const mod = document.getElementById('vc-modified');
      if (mod) mod.textContent = '';
      setTimeout(function() {
        if (mod) mod.textContent = 'âœ“ Saved';
        setTimeout(function() { if (mod) mod.textContent = ''; }, 1200);
      }, 0);
    },
    format() {
      const ta = document.getElementById('vc-textarea');
      if (!ta) return;
      let code = ta.value;
      code = code.replace(/[ \\t]+$/gm, '');
      code = code.replace(/\\n{3,}/g, '\\n\\n');
      if (!code.endsWith('\\n')) code += '\\n';
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
