#!/bin/bash

APP_NAME="discussion-platform"
JAR_NAME="target/${APP_NAME}-1.0.0.jar"
LOG_FILE="app.log"

echo ">>> Stopping old process..."
PID=$(pgrep -f "${APP_NAME}.*\.jar")
if [ -n "$PID" ]; then
    kill -9 $PID
    echo "Terminated process: $PID"
    sleep 2
else
    echo "No running process found"
fi

echo ">>> Maven packaging (skipping tests)..."
mvn clean package -DskipTests
if [ $? -ne 0 ]; then
    echo "Packaging failed, terminating deployment"
    exit 1
fi

echo ">>> Starting in background..."
nohup java -jar $JAR_NAME > $LOG_FILE 2>&1 &
echo "Deployment completed, PID: $!, Log: $LOG_FILE"
