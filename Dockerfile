# syntax=docker/dockerfile:1.4
# Multi-stage build für Frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
COPY frontend/.npmrc ./
# Installiere Dependencies mit legacy-peer-deps
# --loglevel=error reduziert Warnungen (nur Fehler werden angezeigt)
RUN npm install --legacy-peer-deps --loglevel=error
# Stelle sicher, dass ajv und ajv-keywords in kompatiblen Versionen installiert sind
# ajv@6.x ist kompatibel mit allen react-scripts Dependencies
RUN npm install ajv@^6.12.6 ajv-keywords@^3.5.2 --legacy-peer-deps --save-dev
# Entferne ajv-formats komplett, da es nur mit ajv@8.x funktioniert
RUN npm uninstall ajv-formats --legacy-peer-deps 2>/dev/null || true
RUN rm -rf node_modules/ajv-formats 2>/dev/null || true
# Entferne ajv-formats aus allen Sub-Paketen - MEHRFACH ausführen, um sicherzustellen
RUN find node_modules -type d -name "ajv-formats" -exec rm -rf {} + 2>/dev/null || true
RUN find node_modules -type d -name "ajv-formats" -exec rm -rf {} + 2>/dev/null || true
# Stelle sicher, dass schema-utils in fork-ts-checker-webpack-plugin die richtige ajv Version verwendet
RUN rm -rf node_modules/fork-ts-checker-webpack-plugin/node_modules/ajv* 2>/dev/null || true
RUN rm -rf node_modules/fork-ts-checker-webpack-plugin/node_modules/ajv-keywords 2>/dev/null || true
RUN rm -rf node_modules/fork-ts-checker-webpack-plugin/node_modules/ajv-formats 2>/dev/null || true
# Entferne auch ajv-formats aus der Haupt-schema-utils Installation
RUN rm -rf node_modules/schema-utils/node_modules/ajv-formats 2>/dev/null || true
# Entferne ajv-formats auch aus terser-webpack-plugin
RUN find node_modules/terser-webpack-plugin -type d -name "ajv-formats" -exec rm -rf {} + 2>/dev/null || true
RUN find node_modules -path "*/schema-utils/*/ajv-formats" -exec rm -rf {} + 2>/dev/null || true
# Kopiere Patch-Scripts vor dem Rest des Frontends
COPY frontend/patch-webpack.js ./patch-webpack.js
COPY frontend/patch-ajv-formats.js ./patch-ajv-formats.js
COPY frontend/patch-schema-utils.js ./patch-schema-utils.js
COPY frontend/patch-absolute-path.js ./patch-absolute-path.js
COPY frontend/patch-limit.js ./patch-limit.js
COPY frontend/patch-all-keywords.js ./patch-all-keywords.js
COPY frontend/ .
# Installiere fork-ts-checker-webpack-plugin wieder, da es von react-dev-utils benötigt wird
RUN npm install fork-ts-checker-webpack-plugin@^6.5.3 --legacy-peer-deps --save-dev
# Stelle sicher, dass fork-ts-checker-webpack-plugin die richtigen ajv Versionen verwendet
RUN rm -rf node_modules/fork-ts-checker-webpack-plugin/node_modules/ajv* 2>/dev/null || true
RUN rm -rf node_modules/fork-ts-checker-webpack-plugin/node_modules/ajv-keywords 2>/dev/null || true
RUN rm -rf node_modules/fork-ts-checker-webpack-plugin/node_modules/ajv-formats 2>/dev/null || true
# Installiere nur ajv und ajv-keywords in fork-ts-checker-webpack-plugin
RUN cd node_modules/fork-ts-checker-webpack-plugin && \
    npm install ajv@^6.12.6 ajv-keywords@^3.5.2 --legacy-peer-deps --no-save 2>/dev/null || true
# Entferne ajv-formats NOCHMAL nach der Installation von fork-ts-checker-webpack-plugin
RUN find node_modules -type d -name "ajv-formats" -exec rm -rf {} + 2>/dev/null || true
RUN find node_modules -type d -name "ajv-formats" -exec rm -rf {} + 2>/dev/null || true
# Stelle sicher, dass schema-utils die richtige ajv Version verwendet (nicht aus node_modules)
RUN rm -rf node_modules/schema-utils/node_modules/ajv 2>/dev/null || true
# Patch ajv-formats
RUN node patch-ajv-formats.js
# Teste, ob ajv korrekt installiert ist
RUN node -e "const Ajv = require('ajv'); console.log('ajv Typ:', typeof Ajv); console.log('ajv ist Funktion:', typeof Ajv === 'function'); try { const instance = new Ajv(); console.log('ajv kann als Konstruktor verwendet werden'); } catch(e) { console.log('FEHLER:', e.message); process.exit(1); }"
# Patch schema-utils validate.js separat
RUN node patch-schema-utils.js
# Patch absolutePath.js für ajv@6.x Kompatibilität
RUN node patch-absolute-path.js
# Patch limit.js für ajv@6.x Kompatibilität
RUN node patch-limit.js
# Patch alle Keyword-Dateien für ajv@6.x Kompatibilität
RUN node patch-all-keywords.js
# Deaktiviere fork-ts-checker-webpack-plugin in der Webpack-Konfiguration
RUN node patch-webpack.js
RUN npm run build

# Backend
FROM node:18-alpine
WORKDIR /app

# Installiere Docker CLI und tar für Backups
RUN apk add --no-cache docker-cli tar

# Backend dependencies
COPY backend/package*.json ./
RUN npm install --legacy-peer-deps

# Backend source
COPY backend/ .

# Kompiliere Backend TypeScript
RUN npm run build

# Frontend build
COPY --from=frontend-builder /app/frontend/build ./public

# Erstelle notwendige Verzeichnisse
RUN mkdir -p data logs backups

# Exponiere Port
EXPOSE 3001

# Starte Server
CMD ["npm", "start"]

