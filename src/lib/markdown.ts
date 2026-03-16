function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderTable(block: string): string {
  const lines = block.trim().split("\n");
  if (lines.length < 2) return block;

  const parseRow = (line: string): string[] =>
    line.split("|").slice(1, -1).map((c) => c.trim());

  const headers = parseRow(lines[0]);
  // lines[1] is the separator (|---|---|)
  const rows = lines.slice(2).map(parseRow);

  let html = '<table class="md-table"><thead><tr>';
  for (const h of headers) {
    html += `<th>${h}</th>`;
  }
  html += "</tr></thead><tbody>";
  for (const row of rows) {
    html += "<tr>";
    for (const cell of row) {
      html += `<td>${cell}</td>`;
    }
    html += "</tr>";
  }
  html += "</tbody></table>";
  return html;
}

export function renderMarkdown(text: string): string {
  // Extract and render tables first
  const tablePattern = /^(\|.+\|)\n(\|[\s:|-]+\|)\n((?:\|.+\|\n?)+)/gm;
  let result = text.replace(tablePattern, (match) => renderTable(match));

  return result
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
      `<pre class="md-code-block"><code>${escapeHtml(code.trim())}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^#### (.+)$/gm, '<h4 class="md-h4">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')
    .replace(/^---$/gm, '<hr class="md-hr"/>')
    .replace(/^- (.+)$/gm, '<li class="md-li">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="md-li-num">$1</li>')
    .replace(/(<li class="md-li">[\s\S]*?<\/li>)/g, '<ul class="md-ul">$1</ul>')
    .replace(/(<li class="md-li-num">[\s\S]*?<\/li>)/g, '<ol class="md-ol">$1</ol>')
    .replace(/<\/ul>\n?<ul class="md-ul">/g, "")
    .replace(/<\/ol>\n?<ol class="md-ol">/g, "")
    .replace(/\n\n/g, '</p><p class="md-p">')
    .replace(/\n/g, "<br/>");
}
