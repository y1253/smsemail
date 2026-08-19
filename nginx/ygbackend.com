server {
    listen 80;
    server_name ygbackend.com emailontext.com;

    root /var/www/html;
    location /.well-known/acme-challenge/ { try_files $uri =404; }
    location / { return 301 https://$host$request_uri; }
}

# ygbackend.com serves the same app as emailontext.com. Without this redirect
# both hostnames return 200 for every URL, which is duplicate content across two
# domains and splits ranking signals. The cert already covers both names, so no
# certbot work is needed here.
server {
    listen 443 ssl http2;
    server_name ygbackend.com;

    ssl_certificate     /etc/letsencrypt/live/ygbackend.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ygbackend.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    return 301 https://emailontext.com$request_uri;
}

server {
    listen 443 ssl http2;
    server_name emailontext.com;

    # Don't leak the nginx version.
    server_tokens off;

    ssl_certificate     /etc/letsencrypt/live/ygbackend.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ygbackend.com/privkey.pem;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

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
    #   $uri     -> a prerendered file, e.g. /assets/*, /robots.txt
    #   $uri/    -> a prerendered directory, e.g. /guides/foo/index.html
    #   /app.html -> the noindex shell, for client-only routes (/login,
    #                /dashboard, /admin) and any unknown URL. Falling back to
    #                /index.html instead would serve the landing page — and its
    #                canonical tag — for every app route.
    location / {
        try_files $uri $uri/ /app.html;
    }
}
