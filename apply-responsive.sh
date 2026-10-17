#!/usr/bin/env bash
set -e
cd "$(dirname "$0")" 2>/dev/null || true
[ -f apps/web/src/main.js ] || { echo "Run this from the project root (the folder that contains apps/)"; exit 1; }

cat > apps/web/src/styles/responsive.css <<'EOF'
@media (min-width: 720px) {
  body {
    background: var(--paper);
  }

  .app {
    max-width: 1180px;
    box-shadow: none;
  }

  .bare {
    max-width: 460px;
  }

  .pad {
    padding: 28px 32px 0;
  }

  .grid2 {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 20px;
  }

  .cat4 {
    grid-template-columns: repeat(8, 1fr);
  }

  .fnav {
    width: 520px;
  }

  .app[data-page="home"] .search2 {
    max-width: 680px;
  }

  .app[data-page="dashboard"] .view,
  .app[data-page="my-listings"] .view,
  .app[data-page="profile"] .view,
  .app[data-page="add-listing"] .view,
  .app[data-page="listing"] .view,
  .app[data-page="notifications"] .view {
    max-width: 720px;
    margin-inline: auto;
  }

  .app[data-page="product"] .view,
  .app[data-page="seller"] .view {
    max-width: 880px;
    margin-inline: auto;
  }
}

@media (min-width: 1100px) {
  .pad {
    padding: 32px 40px 0;
  }
}
EOF

node - <<'EOF'
const fs = require('fs');
const edit = (file, fn) => { const s = fs.readFileSync(file, 'utf8'); const t = fn(s); fs.writeFileSync(file, t); return s !== t; };

const m = edit('apps/web/src/main.js', s =>
  s.includes('responsive.css') ? s : s.replace("import './styles/design.css';", "import './styles/design.css';\nimport './styles/responsive.css';"));

const l = edit('apps/web/src/components/layout.js', s => {
  if (s.includes('pageName')) return s;
  s = s.replace('function appLayout(app, withNav) {',
    "const pageName = path => path.split('/')[1] || 'home';\n\nfunction appLayout(app, withNav) {");
  s = s.replace("  const draw = () => {\n    if (nav) nav.innerHTML = navMarkup(current);\n  };",
    "  const frame = app.querySelector('.app');\n  const draw = () => {\n    frame.dataset.page = pageName(current);\n    if (nav) nav.innerHTML = navMarkup(current);\n  };");
  return s;
});

const ok = fs.readFileSync('apps/web/src/components/layout.js', 'utf8').includes('frame.dataset.page')
  && fs.readFileSync('apps/web/src/main.js', 'utf8').includes('responsive.css');
console.log(ok ? 'Done: responsive layout applied.' : 'WARNING: an edit did not match. Tell me and I will adjust it.');
EOF
