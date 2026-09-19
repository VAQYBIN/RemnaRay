export function markdownToHtml(markdown: string): string {
  const escaped = escapeHtml(markdown.trim());
  return escaped
    .split(/\n{2,}/)
    .map((block) => {
      if (block.startsWith('# ')) return `<h1>${block.slice(2)}</h1>`;
      if (block.startsWith('## ')) return `<h2>${block.slice(3)}</h2>`;
      if (block.split('\n').every((line) => line.startsWith('- '))) {
        return `<ul>${block
          .split('\n')
          .map((line) => `<li>${line.slice(2)}</li>`)
          .join('')}</ul>`;
      }
      return `<p>${block.replaceAll('\n', '<br />')}</p>`;
    })
    .join('');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
