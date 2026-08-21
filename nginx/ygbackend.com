server {
    listen 80;
    server_name ygbackend.com emailontext.com;

    root /var/www/html;
    location /.well-known/acme-challenge/ { try_files $uri =404; }
    location / { return 301 https://$host$request_uri; }
}

# Both hostnames are served here deliberately. Do NOT add a 301 from
# ygbackend.com to emailontext.com: the Gmail Pub/Sub push subscription, the
# SignalWire webhook and the Stripe webhook are all registered against
# ygbackend.com, and none of those callers follow redirects — a 3xx is a
# silently dropped delivery, which stops emails being forwarded as SMS.
# Duplicate content is handled by the absolute <link rel="canonical"> that every
# prerendered page carries, pointing at emailontext.com.
server {
    listen 443 ssl http2;
    server_name ygbackend.com emailontext.com;

    # Don't leak the nginx version.
    server_tokens off;

    ssl_certificate     /etc/letsencrypt/live/ygbackend.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ygbackend.com/privkey.pem;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_protocols       TLSv1.2 TLSv1.3;
    # Mozilla "intermediate" suite list: AEAD only (GCM / ChaCha20-Poly1305)
    # and forward-secret only (ECDHE / DHE). The previous `HIGH:!aNULL:!MD5`
    # still permitted CBC-mode and SHA-1 MAC suites, which is what CASA means
    # by cipher suites with known weaknesses.
    ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384:DHE-RSA-CHACHA20-POLY1305;
    # With an AEAD-only list the client's preference is safe to honour, which
    # is what Mozilla recommends for the intermediate profile.
    ssl_prefer_server_ciphers off;

    # ── Security headers (CASA / OWASP ASVS). `always` so they are sent on error
    # responses too, which the DAST scanner checks. ─────────────────────────────
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "no-referrer" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Cross-Origin-Resource-Policy "same-origin" always;
    # CSP: self-only by default. Stripe needs its js + frame for card input;
    # connect-src allows the API + Stripe. No unsafe-eval. Tighten further if the
    # client bundle allows removing 'unsafe-inline' from style-src.
    add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' https://js.stripe.com; frame-src https://js.stripe.com https://hooks.stripe.com; connect-src 'self' https://api.stripe.com; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:" always;

    root  /root/sms-email-gui/dist;
    index index.html;

    client_max_body_size 10m;

    # Explicit, though off is already the nginx default: no directory listing
    # is ever served for any location in this server block.
    autoindex off;

    # Admin API (subpaths only; bare /admin is the SPA page)
    location ~ ^/admin/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # Backend API
    location ~ ^/(users|emails|phones|sets|cc|webhooks|pricing)(/.*)?$ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        'upgrade';
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }

    # Hashed filenames, so they can be cached indefinitely. Use `expires` only:
    # an `add_header` in a nested location cancels every inherited add_header,
    # which would silently drop the security headers above.
    location /assets/ {
        expires 1y;
    }

    # Frontend SPA.
    #   $uri      -> a real file (/assets/*, /robots.txt), or `/` -> index.html
    #   $uri.html -> a prerendered page, e.g. /guides/foo -> /guides/foo.html
    #   /app.html -> the noindex shell, for client-only routes (/login,
    #                /dashboard, /admin) and any unknown URL. Falling back to
    #                /index.html instead would serve the landing page — and its
    #                canonical tag — for every app route.
    #
    # `$uri/` is deliberately absent: it makes nginx issue an external 301 to
    # add a trailing slash, which would redirect every canonical URL. That also
    # means bare `/` can't resolve through try_files, so it gets its own exact
    # match below.
    location = / {
        try_files /index.html =404;
    }

    location / {
        try_files $uri $uri.html /app.html;
    }
}
