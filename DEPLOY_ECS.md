# ECS 部署说明

这份说明用于把项目部署到一台 Linux ECS。推荐方式是：GitHub 拉代码、PM2 常驻运行、Nginx 做域名反向代理。

## 1. 服务器准备

以下命令在 ECS 上执行。示例按 Ubuntu/Debian 写，如果你的服务器是 CentOS/Alibaba Cloud Linux，包管理命令可能需要换成 `yum` 或 `dnf`。

```bash
sudo apt update
sudo apt install -y git nginx
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

确认版本：

```bash
node -v
npm -v
pm2 -v
```

## 2. 拉取代码

```bash
mkdir -p /www
cd /www
git clone https://github.com/evergrow99/caichong3.git
cd caichong3
```

如果目录已经存在，以后更新代码用：

```bash
cd /www/caichong3
git pull origin main
```

## 3. 配置环境变量

```bash
cd /www/caichong3
cp .env.example .env.production
nano .env.production
```

至少需要填这些：

```bash
CAICHONG_BASE_URL=https://main-api.caichong.net
CAICHONG_API_KEY=你的才虫_API_Key
CAICHONG_MARKET_API_KEY=可选，专门用于读取才虫公开市场的 Agent API Key；不填则复用 CAICHONG_API_KEY
CAICHONG_MARKET_SYNC_INTERVAL_MINUTES=30
CAICHONG_MARKET_MAX_PAGES=10
CAICHONG_MARKET_DISPLAY_BASELINE_TASK_COUNT=0
CAICHONG_MARKET_DISPLAY_BASELINE_AMOUNT=0
CAICHONG_MARKET_DISPLAY_MONTH_BASELINE_TASK_COUNT=0
CAICHONG_MARKET_DISPLAY_MONTH_BASELINE_AMOUNT=0
CAICHONG_USE_MOCK=false
APP_BASE_URL=http://127.0.0.1:3000
NEXT_PUBLIC_SUPABASE_URL=你的 Supabase Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=你的 Supabase service_role key
CRON_SECRET=一段你自己生成的随机字符串
ORDER_REMINDER_SYNC_INTERVAL_MINUTES=5
ORDER_REMINDER_SUBMISSION_LOOKBACK_HOURS=48
ADMIN_PHONES=你的管理员手机号
ALLOW_DEV_LOGIN=false
AUTH_SMS_PROVIDER=aliyun
ALIYUN_SMS_ACCESS_KEY_ID=你的阿里云短信 AK
ALIYUN_SMS_ACCESS_KEY_SECRET=你的阿里云短信 AS
ALIYUN_SMS_SIGN_NAME=对牛弹琴
ALIYUN_SMS_TEMPLATE_CODE=SMS_480765177
ALIYUN_SMS_REGION_ID=cn-hangzhou
SMS_CODE_HASH_SECRET=另一段随机字符串
```

注意：不要把 `.env.production` 提交到 GitHub。

## 4. 安装依赖并构建

```bash
cd /www/caichong3
npm install
npm run build
```

## 5. 启动服务

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

`pm2 startup` 会输出一行 `sudo ...` 命令，把那一整行复制执行一次。这样 ECS 重启后服务会自动恢复。

查看状态：

```bash
pm2 status
pm2 logs caichong3
pm2 logs caichong3-market-sync
```

此时项目会运行在：

```bash
http://服务器公网IP:3000
```

`caichong3-market-sync` 会启动后立即同步一次才虫公开市场，之后按 `CAICHONG_MARKET_SYNC_INTERVAL_MINUTES` 间隔持续同步。同步接口使用 `CRON_SECRET` 保护。

## 6. 配置 Nginx 域名代理

假设域名是 `aichong.top`，创建配置：

```bash
sudo nano /etc/nginx/sites-available/caichong3
```

写入：

```nginx
server {
    listen 80;
    server_name aichong.top www.aichong.top;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/caichong3 /etc/nginx/sites-enabled/caichong3
sudo nginx -t
sudo systemctl reload nginx
```

如果提示 `sites-available` 不存在，说明你的系统 Nginx 目录结构不同，可以直接把配置放到 `/etc/nginx/conf.d/caichong3.conf`。

## 7. 配置 HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d aichong.top -d www.aichong.top
```

## 8. 以后每次更新

```bash
cd /www/caichong3
git pull origin main
npm install
npm run build
pm2 restart caichong3
pm2 restart caichong3-market-sync
```

## 9. 常用排查

查看服务：

```bash
pm2 status
pm2 logs caichong3
pm2 logs caichong3-market-sync
```

查看 Nginx：

```bash
sudo nginx -t
sudo systemctl status nginx
sudo tail -n 100 /var/log/nginx/error.log
```

确认本机访问：

```bash
curl -I http://127.0.0.1:3000
```
