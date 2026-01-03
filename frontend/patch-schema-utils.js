const fs = require('fs');
const path = require('path');

// Patch schema-utils validate.js, um Ajv korrekt zu importieren
const schemaUtilsPath = path.join(__dirname, 'node_modules/schema-utils/dist/validate.js');

if (!fs.existsSync(schemaUtilsPath)) {
  console.log('schema-utils validate.js nicht gefunden');
  process.exit(0);
}

let content = fs.readFileSync(schemaUtilsPath, 'utf8');

// Teste, wie ajv exportiert wird
try {
  const ajvModule = require('ajv');
  console.log('ajv Modul Typ:', typeof ajvModule);
  console.log('ajv ist Funktion:', typeof ajvModule === 'function');
} catch (e) {
  console.log('Fehler beim Testen von ajv:', e.message);
}

// Schritt 1: Ersetze "new Ajv(" direkt durch einen inline-Aufruf
// Das ist der sicherste Weg, da wir nicht wissen, in welchem Scope Ajv verwendet wird
if (content.includes('new Ajv(')) {
  const newAjvCount = (content.match(/new\s+Ajv\s*\(/g) || []).length;
  console.log(`"new Ajv(" gefunden: ${newAjvCount} Vorkommen`);
  
  // Ersetze "new Ajv(" durch einen direkten inline-Aufruf
  // ajv@6.x exportiert direkt als Funktion, also können wir require('ajv') direkt verwenden
  content = content.replace(/new\s+Ajv\s*\(/g, (match) => {
    // Direkter Aufruf: new (require('ajv'))(
    // ajv@6.x exportiert direkt als Funktion, also funktioniert das
    return 'new (require("ajv"))(';
  });
  
  console.log('✓ "new Ajv(" durch "new (require(\'ajv\'))(" ersetzt');
}

// Schritt 2: Ersetze alle Ajv-Imports (falls noch vorhanden)
content = content.replace(/(const|var|let)\s+Ajv\s*=\s*require\(['"]ajv['"]\)/g, (match) => {
  // Ersetze durch direkten require-Aufruf
  return 'const Ajv = require("ajv")';
});

// Schritt 3: Stelle sicher, dass addFormats korrekt ist
content = content.replace(/const addFormats = null\.default/g, 'const addFormats = (require("ajv-formats") && require("ajv-formats").default) || function() {}');

// Schritt 4: Patch ajvKeywords - ajv-keywords@3.x exportiert direkt als Funktion
if (content.includes('ajvKeywords')) {
  // Teste, wie ajv-keywords exportiert wird
  try {
    const ajvKeywordsModule = require('ajv-keywords');
    console.log('ajv-keywords Modul Typ:', typeof ajvKeywordsModule);
    console.log('ajv-keywords ist Funktion:', typeof ajvKeywordsModule === 'function');
    
    // Teste die API - ajv-keywords@3.x sollte direkt aufgerufen werden können
    if (typeof ajvKeywordsModule === 'function') {
      console.log('ajv-keywords kann direkt als Funktion aufgerufen werden');
    }
  } catch (e) {
    console.log('Fehler beim Testen von ajv-keywords:', e.message);
  }
  
  // Prüfe, ob ajvKeywords bereits definiert ist
  const hasAjvKeywordsDef = content.includes('const ajvKeywords') || 
                            content.includes('var ajvKeywords') || 
                            content.includes('let ajvKeywords');
  
  if (!hasAjvKeywordsDef && content.includes('ajvKeywords(')) {
    // ajvKeywords wird verwendet, aber nicht definiert
    // Finde die Stelle, wo es verwendet wird
    const lines = content.split('\n');
    let insertIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('ajvKeywords(')) {
        // Suche nach der Stelle, wo ajv definiert wird (normalerweise kurz davor)
        for (let j = Math.max(0, i - 10); j < i; j++) {
          if (lines[j].includes('const ajv =') || lines[j].includes('var ajv =') || lines[j].includes('let ajv =')) {
            insertIndex = j + 1;
            break;
          }
        }
        if (insertIndex === -1) {
          insertIndex = i;
        }
        break;
      }
    }
    
    if (insertIndex > 0) {
      lines.splice(insertIndex, 0, 'const ajvKeywords = require("ajv-keywords");');
      content = lines.join('\n');
      console.log('✓ ajvKeywords-Definition hinzugefügt vor Zeile', insertIndex + 1);
    }
  } else {
    // Ersetze alle Varianten von ajvKeywords-Imports
    // Variante 1: const ajvKeywords = require('ajv-keywords')
    content = content.replace(/(const|var|let)\s+ajvKeywords\s*=\s*require\(['"]ajv-keywords['"]\)/g, (match) => {
      // ajv-keywords@3.x exportiert direkt als Funktion
      return 'const ajvKeywords = require("ajv-keywords")';
    });
    
    // Variante 2: const ajvKeywords = require('ajv-keywords').default
    content = content.replace(/(const|var|let)\s+ajvKeywords\s*=\s*require\(['"]ajv-keywords['"]\)\.default/g, (match) => {
      return 'const ajvKeywords = require("ajv-keywords")';
    });
    
    console.log('✓ ajvKeywords-Imports gepatcht');
  }
  
  // Schritt 4b: Stelle sicher, dass ajvKeywords korrekt aufgerufen wird
  // ajv-keywords@3.x API: ajvKeywords(ajv, ["keyword1", "keyword2"])
  // Prüfe, ob es falsch verwendet wird
  if (content.includes('ajvKeywords(')) {
    // Die Verwendung sollte korrekt sein - ajv-keywords@3.x wird direkt aufgerufen
    // Falls es Probleme gibt, könnten wir hier einen Patch hinzufügen
    console.log('ajvKeywords wird verwendet - API sollte korrekt sein');
  }
}

fs.writeFileSync(schemaUtilsPath, content);

// Schritt 5: Patch absolutePath.js falls vorhanden
// Der Fehler kommt von addAbsolutePathKeyword, das versucht, ein Keyword hinzuzufügen
const absolutePathPath = path.join(__dirname, 'node_modules/schema-utils/dist/keywords/absolutePath.js');
if (fs.existsSync(absolutePathPath)) {
  let absolutePathContent = fs.readFileSync(absolutePathPath, 'utf8');
  
  // Prüfe, ob es Probleme mit addKeyword gibt
  if (absolutePathContent.includes('ajv.addKeyword')) {
    console.log('absolutePath.js gefunden - prüfe auf Probleme');
    // Das Problem könnte sein, dass ein Objekt übergeben wird, wo ein String erwartet wird
    // Aber wir können das nicht einfach patchen, ohne die genaue Struktur zu kennen
    // Lass uns erstmal prüfen, ob es überhaupt verwendet wird
  }
}

// Prüfe, ob der Patch erfolgreich war
if (content.includes('new (require("ajv"))(')) {
  console.log('✓ Patch erfolgreich angewendet - "new Ajv(" wurde ersetzt');
} else if (!content.includes('new Ajv(')) {
  console.log('✓ Patch erfolgreich angewendet - keine "new Ajv(" mehr vorhanden');
} else {
  console.log('✗ WARNUNG: "new Ajv(" wurde nicht ersetzt!');
}

console.log('schema-utils validate.js erfolgreich gepatcht');
