# SkillStack Production Deployment

适用于宝塔服务器部署：

- 前端：构建 `frontend/dist` 后发布到宝塔站点根目录。
- 后端：先在 Docker 外部编译 jar，再用 `backend/Dockerfile` 打进运行时镜像。
- 数据库：直接连接外部 MySQL，脚本不会启动或部署 MySQL。

## 首次配置

生产配置通过环境变量注入，不要把数据库密码、JWT 密钥或服务器路径提交到仓库。

```bash
chmod +x deploy/deploy.sh
```

部署前至少设置：

- `FRONTEND_DEPLOY_DIR`：前端静态文件目录
- `UPLOADS_DIR`：后端上传文件目录
- 后端本机端口：`127.0.0.1:8080`
- `SKILLSTACK_DB_URL`、`SKILLSTACK_DB_USERNAME`、`SKILLSTACK_DB_PASSWORD`
- `SKILLSTACK_JWT_SECRET`、`SKILLSTACK_CORS_ALLOWED_ORIGINS`、`OAUTH_FRONTEND_ORIGIN`

## 宝塔 Nginx

在宝塔网站配置里加入 `deploy/nginx.skillstack.conf.example` 中的 location 配置。

前端生产包使用相对路径 `/api`，所以 Nginx 需要把 `/api/` 反代到 `127.0.0.1:8080`。

## 常用命令

完整部署：

```bash
./deploy/deploy.sh deploy
```

只构建：

```bash
./deploy/deploy.sh build
```

如果 Jenkins 已经单独完成后端编译，只构建 Docker 镜像：

```bash
cd backend
mvn -B clean package -DskipTests
cd ..
./deploy/deploy.sh build-image
```

如果 Jenkins 已经完成前端和后端编译，直接发布已有产物：

```bash
./deploy/deploy.sh release
```

服务管理：

```bash
./deploy/deploy.sh start
./deploy/deploy.sh stop
./deploy/deploy.sh restart
./deploy/deploy.sh status
./deploy/deploy.sh logs
```

## Jenkins Pipeline 示例

```groovy
pipeline {
  agent any

  stages {
    stage('Build Frontend') {
      steps {
        sh 'cd frontend && npm ci && npm run build'
      }
    }

    stage('Build Backend Jar') {
      steps {
        sh 'cd backend && mvn -B clean package -DskipTests'
      }
    }

    stage('Deploy') {
      steps {
        sh './deploy/deploy.sh release'
      }
    }
  }
}
```

如果希望所有步骤都交给部署脚本，也可以只执行：

```groovy
sh './deploy/deploy.sh deploy'
```
