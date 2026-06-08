#!/bin/bash

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
PROJECT_ROOT=${PROJECT_ROOT:-$SCRIPT_DIR}

APP=${APP:-app:app}
PORT=${PORT:-8787}
APP_DIR=${APP_DIR:-$PROJECT_ROOT}
LOG_DIR=${LOG_DIR:-/root/Code/hundao_app/log/2_options_calc}
PYTHON_GUNICORN=${PYTHON_GUNICORN:-/root/Code/venv_313/bin/gunicorn}

export PYTHONPATH="$APP_DIR:$PROJECT_ROOT:$PYTHONPATH"
GREP_KEYWORD=${GREP_KEYWORD:-$APP}

# Optional proxy for servers that cannot access Binance directly.
# Example:
# export HTTPS_PROXY=http://127.0.0.1:7890
# export HTTP_PROXY=http://127.0.0.1:7890

ACCESS_LOG_FORMAT='%({X-Real-IP}i)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" '

CMDLINE_EXC="nohup \
$PYTHON_GUNICORN \
--chdir $APP_DIR \
-w 2 -b 127.0.0.1:$PORT $APP \
--access-logfile $LOG_DIR/access.log \
--access-logformat='$ACCESS_LOG_FORMAT' \
>> $LOG_DIR/no_hup.log 2>&1 &"

mkdir -p "$LOG_DIR"
umask 022

ACTION=$1
if [ -z "$ACTION" ]; then
    echo "usage: $0 {start|stop|status|restart}"
    exit 1
fi

show_proc_status(){
    ps -ef | grep "$GREP_KEYWORD" | grep -v grep
}

check_proc_run(){
    PIDs=$(pgrep -of "$GREP_KEYWORD")
    if [ x"$PIDs" != x ]; then
        return 1
    else
        return 0
    fi
}

case $ACTION in
    status)
        echo "Checking service process status"
        show_proc_status
        ;;

    start)
        check_proc_run
        if [ $? -ne 0 ]; then
            echo "Service is already running, exit..."
            show_proc_status
            exit 1
        fi

        echo "Starting service..."
        eval "$CMDLINE_EXC"
        sleep 1

        check_proc_run
        if [ $? -ne 0 ]; then
            echo "Service started"
            show_proc_status
        else
            echo "Service failed, check log: $LOG_DIR/no_hup.log"
            exit 1
        fi
        ;;

    stop)
        echo "Stopping service..."
        while true; do
            PID=$(pgrep -of "$GREP_KEYWORD")
            if [ -z "$PID" ]; then
                break
            else
                kill -9 "$PID"
                sleep 0.5
            fi
        done
        echo "Service stopped"
        ;;

    restart)
        echo "Restarting service"
        "$0" stop
        sleep 1
        "$0" start
        ;;

    *)
        echo "Invalid action: $ACTION"
        echo "usage: $0 {start|stop|status|restart}"
        exit 1
        ;;
esac

exit 0
