---
'@remnaray/api': patch
'@remnaray/web': patch
---

Make theme SVGs inert. Theme assets are now served with a sandboxing `Content-Security-Policy` that allows no script, and the upload check closes the ways around it (a handler after a slash, namespaced `script`, encoded `javascript:` links, `foreignObject`, HTML `data:` URLs, non-UTF-8 files) and now covers every SVG of an uploaded theme archive.
