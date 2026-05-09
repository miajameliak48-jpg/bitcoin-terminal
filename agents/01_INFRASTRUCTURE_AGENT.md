# Agent 01 — Infrastructure Agent

## Зона ответственности
Настройка серверного окружения: Nginx, PM2, Node.js, SSL, firewall.

## Задачи

### 1. Установка зависимостей на сервере
```bash
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs nginx certbot python3-certbot-nginx
npm install -g pm2 typescript
```

### 2. Структура директорий на сервере
```
/var/www/bitcoin-terminal/
├── backend/          # Node.js API
├── frontend/         # React build (dist/)
└── logs/             # PM2 логи
```

### 3. Nginx конфигурация
Файл: `/etc/nginx/sites-available/bitcoin-terminal`

Nginx выполняет роль:
- Reverse proxy для `/api` и `/socket.io` → backend :3001
- Static file serving для React build → `/var/www/bitcoin-terminal/frontend/dist`
- WebSocket upgrade для Socket.IO

### 4. PM2 управление процессами
```bash
pm2 start dist/index.js --name bitcoin-terminal-api
pm2 save
pm2 startup
```

### 5. Firewall
```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

## Ключевые принципы
- Backend слушает только на `127.0.0.1:3001` — не открыт наружу
- Все внешние запросы проходят через Nginx
- PM2 обеспечивает автоперезапуск при падении
- Логи ротируются через PM2 logrotate

## Checklist
- [ ] Node.js 20+ установлен
- [ ] Nginx установлен и настроен
- [ ] PM2 установлен, процесс запущен и сохранён
- [ ] Firewall настроен
- [ ] Backend доступен через Nginx
