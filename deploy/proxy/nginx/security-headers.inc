# Preserve these headers when a nested location adds its own cache or content
# headers. nginx otherwise drops the server-level add_header set entirely.
add_header_inherit merge;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
add_header X-Request-Id $request_id always;
# The CSP is set by `web`, which owns the nonce. The API never answers HTML.
