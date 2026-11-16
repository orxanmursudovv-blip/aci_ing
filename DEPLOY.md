# Deploy (Contabo VPS: PM2 + Nginx + Let's Encrypt)

> HTTPS mütləqdir: onsuz mikrofon işləmir və PWA quraşdırılmır.

## 1. Server hazırlığı (bir dəfə)
```bash
sudo apt update && sudo apt install -y nginx postgresql certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm i -g pm2

sudo -u postgres psql -c "CREATE USER berber WITH PASSWORD 'GÜCLÜ_PAROL';"
sudo -u postgres createdb -O berber berber
```

## 2. Tətbiq
```bash
git clone <repo> /var/www/berber && cd /var/www/berber
cp .env.example .env   # DATABASE_URL-i doldur
npm ci
npm run db:migrate
npm run build
pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
```

## 3. Nginx — `/etc/nginx/sites-available/berber`
```nginx
server {
    server_name berber.example.az;
    client_max_body_size 10m;   # Mərhələ 2: səs faylları
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/berber /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d berber.example.az
```

## 4. Yeniləmə
```bash
cd /var/www/berber && git pull && npm ci && npm run db:migrate && npm run build && pm2 reload berber
```

## PIN unudulubsa
```bash
npm run reset-pin -- 0501234567 1234
```
