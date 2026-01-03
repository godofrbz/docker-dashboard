#!/bin/bash

# Installationsskript für Synology NAS
# Dieses Skript erstellt die notwendigen Verzeichnisse und startet den Container

set -e

echo "=========================================="
echo "Docker Dashboard - Synology Installation"
echo "=========================================="
echo ""

# Standard-Pfad (kann angepasst werden)
BASE_DIR="/volume1/docker/docker-dashboard"
DATA_DIR="${BASE_DIR}/data"
LOGS_DIR="${BASE_DIR}/logs"
BACKUPS_DIR="${BASE_DIR}/backups"

echo "Erstelle Verzeichnisse..."
mkdir -p "${DATA_DIR}"
mkdir -p "${LOGS_DIR}"
mkdir -p "${BACKUPS_DIR}"

echo "Setze Berechtigungen..."
chmod -R 755 "${BASE_DIR}"
chmod -R 777 "${DATA_DIR}"
chmod -R 777 "${LOGS_DIR}"
chmod -R 777 "${BACKUPS_DIR}"

echo ""
echo "Verzeichnisse erstellt:"
echo "  - ${DATA_DIR}"
echo "  - ${LOGS_DIR}"
echo "  - ${BACKUPS_DIR}"
echo ""

# Prüfe ob Docker verfügbar ist
if ! command -v docker &> /dev/null; then
    echo "FEHLER: Docker ist nicht installiert oder nicht im PATH"
    echo "Bitte installieren Sie Docker über das Package Center"
    exit 1
fi

echo "Docker gefunden: $(docker --version)"
echo ""

# Prüfe Docker Socket Berechtigungen
DOCKER_SOCK="/var/run/docker.sock"
if [ ! -S "$DOCKER_SOCK" ]; then
    echo "FEHLER: Docker Socket nicht gefunden: $DOCKER_SOCK"
    exit 1
fi

if [ ! -r "$DOCKER_SOCK" ] || [ ! -w "$DOCKER_SOCK" ]; then
    echo "WARNUNG: Keine Berechtigung für Docker Socket"
    echo ""
    echo "Versuchen Sie eine der folgenden Lösungen:"
    echo ""
    echo "Option 1: Mit sudo ausführen:"
    echo "  sudo $0"
    echo ""
    echo "Option 2: Benutzer zur docker Gruppe hinzufügen (Synology):"
    echo "  sudo synogroup --add docker"
    echo "  sudo synogroup --member docker \$USER"
    echo "  # Dann neu einloggen"
    echo ""
    echo "Option 3: Berechtigungen temporär setzen (nicht empfohlen):"
    echo "  sudo chmod 666 $DOCKER_SOCK"
    echo ""
    read -p "Möchten Sie mit sudo fortfahren? (j/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[JjYy]$ ]]; then
        echo "Führe mit sudo aus..."
        exec sudo "$0" "$@"
    else
        echo "Installation abgebrochen"
        exit 1
    fi
fi

# Prüfe ob docker-compose verfügbar ist
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    echo "WARNUNG: docker-compose nicht gefunden"
    echo "Container muss manuell erstellt werden"
    exit 1
fi

# Prüfe ob BuildKit verfügbar ist
if docker buildx version &> /dev/null; then
    echo "BuildKit gefunden - verwende BuildKit für bessere Performance"
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1
    BUILD_CMD="docker buildx build --load"
else
    echo "BuildKit nicht verfügbar - verwende Standard Builder"
    BUILD_CMD="docker build"
fi

echo "Erstelle Docker Image..."
${BUILD_CMD} -t docker-dashboard:latest .

echo ""
echo "Starte Container..."
if [ -f "docker-compose.synology.yml" ]; then
    ${COMPOSE_CMD} -f docker-compose.synology.yml up -d
else
    echo "FEHLER: docker-compose.synology.yml nicht gefunden"
    exit 1
fi

echo ""
echo "=========================================="
echo "Installation abgeschlossen!"
echo "=========================================="
echo ""
echo "Das Dashboard sollte jetzt verfügbar sein unter:"
echo "  http://$(hostname -I | awk '{print $1}'):3001"
echo ""
echo "Container-Status prüfen:"
echo "  docker ps | grep docker-dashboard"
echo ""
echo "Logs anzeigen:"
echo "  docker logs docker-dashboard"
echo ""




