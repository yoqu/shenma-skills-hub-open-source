#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

APP_NAME="${APP_NAME:-skillstack}"
BACKEND_CONTAINER_NAME="${BACKEND_CONTAINER_NAME:-skillstack-backend}"
BACKEND_IMAGE_NAME="${BACKEND_IMAGE_NAME:-skillstack-backend:latest}"
BACKEND_PORT="${BACKEND_PORT:-8080}"
BACKEND_INTERNAL_PORT="${BACKEND_INTERNAL_PORT:-8080}"
FRONTEND_DEPLOY_DIR="${FRONTEND_DEPLOY_DIR:?Set FRONTEND_DEPLOY_DIR}"
UPLOADS_DIR="${UPLOADS_DIR:?Set UPLOADS_DIR}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

usage() {
    cat <<EOF
SkillStack production deployment script

Usage:
  $0 build        Build frontend static files, backend jar, and backend Docker image
  $0 build-image  Build backend Docker image from an existing backend/target/*.jar
  $0 release      Publish existing frontend/dist, build image from existing jar, and restart backend
  $0 start        Start backend container
  $0 stop         Stop backend container
  $0 restart      Restart backend container
  $0 deploy       Build, publish frontend, and restart backend
  $0 status       Show backend container and frontend directory status
  $0 logs         Follow backend container logs
  $0 help         Show this help

Config:
  Backend production config is read from backend/src/main/resources/application-pro.yaml.
  No production env file is required.
EOF
}

require_cmd() {
    if ! command -v "$1" >/dev/null 2>&1; then
        log_error "Required command not found: $1"
        exit 1
    fi
}

require_runtime() {
    require_cmd docker
}

require_build_tools() {
    require_runtime
    require_cmd npm
}

require_backend_build_tools() {
    require_cmd mvn
}

build_frontend() {
    require_build_tools
    log_info "Building frontend..."
    cd "$PROJECT_ROOT/frontend"
    npm ci
    npm run build
}

build_backend_jar() {
    require_backend_build_tools
    log_info "Building backend jar locally..."
    cd "$PROJECT_ROOT/backend"
    mvn -B clean package -DskipTests
}

ensure_backend_jar() {
    if find "$PROJECT_ROOT/backend/target" -maxdepth 1 -type f -name '*.jar' ! -name '*-sources.jar' ! -name '*-javadoc.jar' | grep -q .; then
        return 0
    fi

    log_error "No backend jar found under backend/target."
    log_error "Run '$0 build' or 'cd backend && mvn clean package -DskipTests' before building the image."
    exit 1
}

ensure_frontend_dist() {
    if [ -f "$PROJECT_ROOT/frontend/dist/index.html" ]; then
        return 0
    fi

    log_error "No frontend dist found under frontend/dist."
    log_error "Run '$0 build' or 'cd frontend && npm ci && npm run build' before publishing."
    exit 1
}

build_backend_image() {
    require_runtime
    ensure_backend_jar
    log_info "Building backend Docker image: $BACKEND_IMAGE_NAME"
    docker build -t "$BACKEND_IMAGE_NAME" "$PROJECT_ROOT/backend"
}

publish_frontend() {
    ensure_frontend_dist
    log_info "Publishing frontend to $FRONTEND_DEPLOY_DIR"
    mkdir -p "$FRONTEND_DEPLOY_DIR"
    if command -v rsync >/dev/null 2>&1; then
        rsync -a --delete "$PROJECT_ROOT/frontend/dist/" "$FRONTEND_DEPLOY_DIR/"
    else
        find "$FRONTEND_DEPLOY_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
        cp -a "$PROJECT_ROOT/frontend/dist/." "$FRONTEND_DEPLOY_DIR/"
    fi
}

container_exists() {
    docker ps -a --format '{{.Names}}' | grep -Fx "$BACKEND_CONTAINER_NAME" >/dev/null 2>&1
}

container_running() {
    docker ps --format '{{.Names}}' | grep -Fx "$BACKEND_CONTAINER_NAME" >/dev/null 2>&1
}

stop_backend() {
    require_runtime
    if container_exists; then
        log_info "Stopping backend container: $BACKEND_CONTAINER_NAME"
        docker stop "$BACKEND_CONTAINER_NAME" >/dev/null 2>&1 || true
        docker rm "$BACKEND_CONTAINER_NAME" >/dev/null 2>&1 || true
    else
        log_warn "Backend container does not exist: $BACKEND_CONTAINER_NAME"
    fi
}

start_backend() {
    require_runtime
    mkdir -p "$UPLOADS_DIR"

    if container_running; then
        log_info "Backend container already running: $BACKEND_CONTAINER_NAME"
        return 0
    fi

    if container_exists; then
        docker rm "$BACKEND_CONTAINER_NAME" >/dev/null 2>&1 || true
    fi

    log_info "Starting backend container: $BACKEND_CONTAINER_NAME"
    docker run -d \
        --name "$BACKEND_CONTAINER_NAME" \
        --restart unless-stopped \
        --security-opt seccomp=unconfined \
        -p "127.0.0.1:${BACKEND_PORT}:${BACKEND_INTERNAL_PORT}" \
        -v "$UPLOADS_DIR:/data/skillstack/uploads" \
        "$BACKEND_IMAGE_NAME" >/dev/null

    log_info "Backend started on 127.0.0.1:$BACKEND_PORT"
}

build_all() {
    build_frontend
    build_backend_jar
    build_backend_image
}

deploy_all() {
    build_frontend
    publish_frontend
    build_backend_jar
    build_backend_image
    stop_backend
    start_backend
    status
}

release_all() {
    publish_frontend
    build_backend_image
    stop_backend
    start_backend
    status
}

restart_backend() {
    stop_backend
    start_backend
}

status() {
    require_runtime
    echo ""
    log_info "Backend container:"
    docker ps -a --filter "name=^/${BACKEND_CONTAINER_NAME}$" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' || true
    echo ""
    log_info "Frontend deploy dir: $FRONTEND_DEPLOY_DIR"
    if [ -f "$FRONTEND_DEPLOY_DIR/index.html" ]; then
        ls -ld "$FRONTEND_DEPLOY_DIR"
        log_info "Frontend index.html exists"
    else
        log_warn "Frontend index.html not found"
    fi
    echo ""
}

logs() {
    require_runtime
    docker logs -f --tail=200 "$BACKEND_CONTAINER_NAME"
}

main() {
    case "${1:-help}" in
        build)
            build_all
            ;;
        build-image)
            build_backend_image
            ;;
        release)
            release_all
            ;;
        start)
            start_backend
            ;;
        stop)
            stop_backend
            ;;
        restart)
            restart_backend
            ;;
        deploy)
            deploy_all
            ;;
        status)
            status
            ;;
        logs)
            logs
            ;;
        help|--help|-h)
            usage
            ;;
        *)
            log_error "Unknown command: ${1:-}"
            usage
            exit 1
            ;;
    esac
}

main "$@"
