# LockCloud Security Configuration

本文档描述 LockCloud 后端的安全配置和最佳实践。

## CORS (跨域资源共享)

### 配置

CORS 配置在 `config.py` 中定义，通过环境变量控制：

```python
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(',')
CORS_SUPPORTS_CREDENTIALS = True
CORS_ALLOW_HEADERS = ['Content-Type', 'Authorization']
CORS_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
```

### 环境变量

在 `.env` 文件中配置允许的源：

```bash
# 开发环境
CORS_ORIGINS=http://localhost:3000

# 生产环境 (多个域名用逗号分隔)
CORS_ORIGINS=https://cloud.funk-and.love,https://www.cloud.funk-and.love
```

### 特性

- ✅ 仅允许配置的域名访问 API
- ✅ 支持凭证 (cookies, JWT tokens)
- ✅ 限制允许的 HTTP 方法
- ✅ 限制允许的请求头

## 速率限制 (Rate Limiting)

### 配置

使用 Flask-Limiter 实现速率限制：

```python
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100 per minute"],
    storage_uri="memory://"
)
```

### 限制规则

#### 全局限制
- **100 请求/分钟** (每 IP 地址)
- 适用于所有未特别指定的端点

#### 认证端点限制
- **10 请求/分钟** (每 IP 地址)
- 适用端点：
  - `POST /api/auth/send-code` - 发送验证码
  - `POST /api/auth/register` - 用户注册
  - `POST /api/auth/login` - 用户登录

### 响应

超过速率限制时：
- HTTP 状态码: **429 Too Many Requests**
- 响应体:
```json
{
  "error": {
    "code": "RATE_LIMIT",
    "message": "请求过于频繁，请稍后再试"
  }
}
```

### 响应头

速率限制信息包含在响应头中：
- `X-RateLimit-Limit`: 限制数量
- `X-RateLimit-Remaining`: 剩余请求数
- `X-RateLimit-Reset`: 重置时间戳

### 存储配置

#### 开发环境 (内存存储)
```bash
RATELIMIT_STORAGE_URL=memory://
```

#### 生产环境 (Redis 存储 - 推荐)
```bash
RATELIMIT_STORAGE_URL=redis://localhost:6379
```

使用 Redis 的优势：
- 跨多个应用实例共享限制
- 持久化限制数据
- 更好的性能

## 安全响应头

### 自动添加的响应头

所有 API 响应自动包含以下安全头：

#### 1. Strict-Transport-Security (HSTS)
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```
- 强制浏览器使用 HTTPS
- 有效期: 1 年
- 包含所有子域名

#### 2. X-Content-Type-Options
```
X-Content-Type-Options: nosniff
```
- 防止浏览器 MIME 类型嗅探
- 减少 XSS 攻击风险

#### 3. X-Frame-Options
```
X-Frame-Options: DENY
```
- 防止点击劫持 (Clickjacking)
- 禁止在 iframe 中嵌入

#### 4. X-XSS-Protection
```
X-XSS-Protection: 1; mode=block
```
- 启用浏览器 XSS 过滤器 (旧版浏览器)
- 检测到 XSS 时阻止页面加载

#### 5. Referrer-Policy
```
Referrer-Policy: strict-origin-when-cross-origin
```
- 控制 Referrer 信息泄露
- 跨域请求时仅发送源信息

#### 6. Content-Security-Policy
```
Content-Security-Policy: default-src 'self'
```
- 限制资源加载来源
- 仅允许同源资源

### 实现

安全头在 `app.py` 的 `configure_security_headers()` 函数中配置：

```python
@app.after_request
def set_security_headers(response):
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Content-Security-Policy'] = "default-src 'self'"
    return response
```

## 生产环境部署检查清单

### 必须配置

- [ ] 设置 `FLASK_ENV=production`
- [ ] 使用强随机密钥 (`SECRET_KEY`, `JWT_SECRET_KEY`)
- [ ] 配置正确的 `CORS_ORIGINS` (不使用通配符 `*`)
- [ ] 使用 Redis 作为速率限制存储
- [ ] 通过 Nginx 启用 HTTPS
- [ ] 禁用 Flask debug 模式

### 推荐配置

- [ ] 配置防火墙规则
- [ ] 启用日志监控
- [ ] 定期轮换 S3 凭证
- [ ] 使用环境变量管理敏感信息
- [ ] 配置自动备份
- [ ] 设置错误报警

### Nginx 配置示例

```nginx
server {
    listen 443 ssl http2;
    server_name api.cloud.funk-and.love;

    ssl_certificate /etc/letsencrypt/live/api.cloud.funk-and.love/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.cloud.funk-and.love/privkey.pem;

    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name api.cloud.funk-and.love;
    return 301 https://$server_name$request_uri;
}
```

## 测试安全配置

### 测试 CORS

```bash
# 测试允许的源
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://localhost:5000/api/auth/login

# 测试不允许的源 (应该被拒绝)
curl -H "Origin: http://evil.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     http://localhost:5000/api/auth/login
```

### 测试速率限制

```bash
# 快速发送多个请求测试限制
for i in {1..15}; do
  curl -X POST http://localhost:5000/api/auth/send-code \
       -H "Content-Type: application/json" \
       -d '{"email":"test@zju.edu.cn"}'
  echo ""
done
```

第 11 个请求应该返回 429 状态码。

### 测试安全响应头

```bash
curl -I http://localhost:5000/health
```

检查响应头是否包含所有安全头。

## 监控和日志

### 速率限制日志

超过速率限制的请求会被记录：

```
WARNING: Rate limit exceeded: 127.0.0.1
```

### 安全事件日志

以下事件会被记录：
- 失败的登录尝试
- 无效的 JWT token
- 未授权的文件访问尝试
- CORS 违规

### 日志位置

- 应用日志: `logs/app.log`
- 错误日志: `logs/error.log`
- 访问日志: Nginx access.log

## 常见问题

### Q: 如何增加速率限制？

修改 `config.py` 中的 `RATELIMIT_DEFAULT` 配置：

```python
RATELIMIT_DEFAULT = '200 per minute'  # 增加到 200
```

### Q: 如何为特定端点设置不同的限制？

在路由装饰器中指定：

```python
@app.route('/api/special')
@limiter.limit("50 per minute")
def special_endpoint():
    pass
```

### Q: 如何禁用速率限制？

在 `config.py` 中设置：

```python
RATELIMIT_ENABLED = False
```

### Q: CORS 错误如何调试？

1. 检查 `CORS_ORIGINS` 环境变量
2. 确认前端请求的 Origin 头
3. 查看浏览器控制台的 CORS 错误信息
4. 检查 Flask 日志

## 参考资源

- [Flask-CORS 文档](https://flask-cors.readthedocs.io/)
- [Flask-Limiter 文档](https://flask-limiter.readthedocs.io/)
- [OWASP 安全头指南](https://owasp.org/www-project-secure-headers/)
- [MDN CORS 文档](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
