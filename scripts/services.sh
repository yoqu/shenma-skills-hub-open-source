#!/bin/bash

# SkillStack Services Management Script
# 快速启动、停止、重启前后端服务

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$PROJECT_ROOT/.env"
    set +a
fi

BACKEND_PID_FILE="/tmp/skillstack-backend.pid"
FRONTEND_PID_FILE="/tmp/skillstack-frontend.pid"
BACKEND_PORT=8080
FRONTEND_PORT=5173

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

is_pid_running() {
    local pid_file=$1
    [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null
}

ensure_frontend_deps() {
    cd "$PROJECT_ROOT/frontend"
    if [ -x "./node_modules/.bin/vite" ]; then
        return 0
    fi

    log_warn "Frontend dependencies missing, installing with npm ci..."
    npm ci
    log_info "Frontend dependencies installed ✓"
}

prepare_backend_runtime() {
    cd "$PROJECT_ROOT/backend"
    if [ -f "target/classpath.txt" ] && [ "target/classpath.txt" -nt "pom.xml" ]; then
        mvn -q -DskipTests compile
        return 0
    fi

    mvn -q -DskipTests compile dependency:build-classpath -Dmdep.outputFile=target/classpath.txt
}

require_lsof() {
    if ! command -v lsof >/dev/null 2>&1; then
        log_error "lsof command not found; cannot check service ports"
        return 1
    fi
}

list_listen_pids_by_port() {
    local port=$1
    lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
}

first_listen_pid_by_port() {
    local port=$1
    list_listen_pids_by_port "$port" | head -n 1
}

wait_for_port() {
    local port=$1
    local pid=$2
    local log_file=$3

    require_lsof || return 1

    for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
        if [ -n "$(list_listen_pids_by_port "$port")" ]; then
            return 0
        fi
        if ! kill -0 "$pid" 2>/dev/null; then
            cat "$log_file"
            return 1
        fi
        sleep 1
    done

    cat "$log_file"
    return 1
}

record_listen_pid() {
    local port=$1
    local pid_file=$2
    local service_name=$3
    local listen_pid

    listen_pid=$(first_listen_pid_by_port "$port")
    if [ -z "$listen_pid" ]; then
        log_error "$service_name port $port is not listening"
        return 1
    fi

    echo "$listen_pid" > "$pid_file"
    log_info "$service_name running (PID: $listen_pid, port $port) ✓"
}

# 终止一个进程及其子进程；等待退出，必要时 SIGKILL
kill_process_tree() {
    local pid=$1
    if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
        return 0
    fi

    # 收集子进程（包括孙子进程）
    local children
    children=$(pgrep -P "$pid" 2>/dev/null || true)

    kill -TERM "$pid" 2>/dev/null || true
    for child in $children; do
        kill_process_tree "$child"
    done

    # 等待最多 8 秒优雅退出
    for _ in 1 2 3 4 5 6 7 8; do
        if ! kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
        sleep 1
    done

    # 仍未退出，强杀
    kill -KILL "$pid" 2>/dev/null || true
}

# 兜底：按端口杀掉残留进程
kill_by_port() {
    local port=$1
    local pids
    pids=$(list_listen_pids_by_port "$port")
    if [ -n "$pids" ]; then
        log_warn "Killing leftover process(es) on port $port: $pids"
        echo "$pids" | xargs kill -TERM 2>/dev/null || true
        sleep 2
        pids=$(list_listen_pids_by_port "$port")
        if [ -n "$pids" ]; then
            echo "$pids" | xargs kill -KILL 2>/dev/null || true
        fi
    fi
}

# 启动前后端服务
start_services() {
    log_info "Starting app services..."

    # 创建日志目录
    mkdir -p "$PROJECT_ROOT/backend/logs"
    mkdir -p "$PROJECT_ROOT/frontend/logs"

    # 启动后端
    BACKEND_LISTEN_PID=$(first_listen_pid_by_port "$BACKEND_PORT")
    if [ -n "$BACKEND_LISTEN_PID" ]; then
        echo "$BACKEND_LISTEN_PID" > "$BACKEND_PID_FILE"
        log_info "Backend already running (PID: $BACKEND_LISTEN_PID, port $BACKEND_PORT), skipping ✓"
    elif is_pid_running "$BACKEND_PID_FILE"; then
        log_info "Backend already running (PID: $(cat "$BACKEND_PID_FILE")), skipping ✓"
    else
        log_info "Starting backend (Spring Boot)..."
        cd "$PROJECT_ROOT/backend"
        prepare_backend_runtime
        BACKEND_CLASSPATH="target/classes:$(cat target/classpath.txt)"
        nohup java --enable-native-access=ALL-UNNAMED -cp "$BACKEND_CLASSPATH" com.skillstack.SkillStackApplication > ./logs/skillstack-backend.log 2>&1 < /dev/null &
        BACKEND_PID=$!
        disown "$BACKEND_PID" 2>/dev/null || true
        echo "$BACKEND_PID" > "$BACKEND_PID_FILE"
        log_info "Backend starting (PID: $BACKEND_PID)..."

        if ! wait_for_port "$BACKEND_PORT" "$BACKEND_PID" "./logs/skillstack-backend.log"; then
            log_error "Backend failed to start!"
            return 1
        fi
        record_listen_pid "$BACKEND_PORT" "$BACKEND_PID_FILE" "Backend"
    fi

    # 启动前端
    FRONTEND_LISTEN_PID=$(first_listen_pid_by_port "$FRONTEND_PORT")
    if [ -n "$FRONTEND_LISTEN_PID" ]; then
        echo "$FRONTEND_LISTEN_PID" > "$FRONTEND_PID_FILE"
        log_info "Frontend already running (PID: $FRONTEND_LISTEN_PID, port $FRONTEND_PORT), skipping ✓"
    elif is_pid_running "$FRONTEND_PID_FILE"; then
        log_info "Frontend already running (PID: $(cat "$FRONTEND_PID_FILE")), skipping ✓"
    else
        ensure_frontend_deps

        log_info "Starting frontend (React + Vite)..."
        cd "$PROJECT_ROOT/frontend"
        nohup ./node_modules/.bin/vite --host 127.0.0.1 --port "$FRONTEND_PORT" > ./logs/skillstack-frontend.log 2>&1 < /dev/null &
        FRONTEND_PID=$!
        disown "$FRONTEND_PID" 2>/dev/null || true
        echo "$FRONTEND_PID" > "$FRONTEND_PID_FILE"
        log_info "Frontend starting (PID: $FRONTEND_PID)..."

        if ! wait_for_port "$FRONTEND_PORT" "$FRONTEND_PID" "./logs/skillstack-frontend.log"; then
            log_error "Frontend failed to start!"
            return 1
        fi
        record_listen_pid "$FRONTEND_PORT" "$FRONTEND_PID_FILE" "Frontend"
    fi

    echo ""
    log_info "=========================================="
    log_info "App services started successfully! ✓"
    log_info "=========================================="
    log_info "Backend API: http://localhost:8080"
    log_info "Frontend: http://localhost:5173"
    log_info "Backend Swagger: http://localhost:8080/swagger-ui.html"
    echo ""
}

# 停止前后端服务
stop_services() {
    log_info "Stopping app services..."

    stop_app_services

    echo ""
    log_info "App services stopped ✓"
    echo ""
}

# 停止应用服务（前后端）
stop_app_services() {
    # 停止前端
    if [ -f "$FRONTEND_PID_FILE" ]; then
        FRONTEND_PID=$(cat "$FRONTEND_PID_FILE")
        if kill -0 "$FRONTEND_PID" 2>/dev/null; then
            log_info "Stopping frontend (PID: $FRONTEND_PID)..."
            kill_process_tree "$FRONTEND_PID"
            log_info "Frontend stopped ✓"
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi

    # 兜底清理旧版本写到 frontend/logs 下的 PID 文件
    if [ -f "$PROJECT_ROOT/frontend/logs/skillstack-frontend.pid" ]; then
        LEGACY_FRONTEND_PID=$(cat "$PROJECT_ROOT/frontend/logs/skillstack-frontend.pid")
        if kill -0 "$LEGACY_FRONTEND_PID" 2>/dev/null; then
            log_warn "Stopping legacy frontend (PID: $LEGACY_FRONTEND_PID)..."
            kill_process_tree "$LEGACY_FRONTEND_PID"
        fi
        rm -f "$PROJECT_ROOT/frontend/logs/skillstack-frontend.pid"
    fi

    # 停止后端
    if [ -f "$BACKEND_PID_FILE" ]; then
        BACKEND_PID=$(cat "$BACKEND_PID_FILE")
        if kill -0 "$BACKEND_PID" 2>/dev/null; then
            log_info "Stopping backend (PID: $BACKEND_PID)..."
            kill_process_tree "$BACKEND_PID"
            log_info "Backend stopped ✓"
        fi
        rm -f "$BACKEND_PID_FILE"
    fi

    # 端口兜底：确保 8080 / 5173 没有残留
    kill_by_port "$BACKEND_PORT"
    kill_by_port "$FRONTEND_PORT"
}

# 重启前后端服务
restart_services() {
    log_warn "Restarting app services..."
    stop_app_services
    sleep 2
    start_services
}

# 显示服务状态
status_services() {
    echo ""
    log_info "Service Status:"
    log_info "=========================================="

    # 检查后端
    BACKEND_LISTEN_PID=$(first_listen_pid_by_port "$BACKEND_PORT")
    if [ -n "$BACKEND_LISTEN_PID" ]; then
        echo "$BACKEND_LISTEN_PID" > "$BACKEND_PID_FILE"
        log_info "Backend: Running (PID: $BACKEND_LISTEN_PID, port $BACKEND_PORT)"
    else
        rm -f "$BACKEND_PID_FILE"
        log_warn "Backend: Stopped"
    fi

    # 检查前端
    FRONTEND_LISTEN_PID=$(first_listen_pid_by_port "$FRONTEND_PORT")
    if [ -n "$FRONTEND_LISTEN_PID" ]; then
        echo "$FRONTEND_LISTEN_PID" > "$FRONTEND_PID_FILE"
        log_info "Frontend: Running (PID: $FRONTEND_LISTEN_PID, port $FRONTEND_PORT)"
    else
        rm -f "$FRONTEND_PID_FILE"
        log_warn "Frontend: Stopped"
    fi

    echo ""
}

# 显示帮助信息
show_help() {
    cat << EOF
SkillStack Services Management Script

Usage: $0 [COMMAND]

Commands:
    start       Start app services (Backend, Frontend)
    stop        Stop app services
    restart     Restart app services
    status      Show service status
    help        Show this help message

Examples:
    $0 start
    $0 stop
    $0 restart
    $0 status

EOF
}

# 主程序
main() {
    case "${1:-help}" in
        start)
            start_services
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        status)
            status_services
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
