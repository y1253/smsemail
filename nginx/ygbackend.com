server {
    listen 80;
    server_name ygbackend.com www.ygbackend.com;

    root /var/www/html;
    location /.well-known/acme-challenge/ { try_files $uri =404; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl;
    server_name ygbackend.com www.ygbackend.com;

    ssl_certificate     /etc/letsencrypt/live/ygbackend.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ygbackend.com/privkey.pem;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    root  /root/sms-email-gui/dist;
    index index.html;

    client_max_body_size 10m;

    # Backend API
    location ~ ^/(users|emails|phones|sets|cc|webhooks|trypayment)(/.*)?$ {
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

    # Frontend SPA
    location / {
        try_files $uri $uri/ /index.html;
    }
}
