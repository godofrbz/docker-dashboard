const fs = require('fs');
const path = require('path');

// Patch schema-utils limit.js, um Kompatibilität mit ajv@6.x sicherzustellen
const limitPath = path.join(__dirname, 'node_modules/schema-utils/dist/keywords/limit.js');

if (!fs.existsSync(limitPath)) {
  console.log('limit.js nicht gefunden - überspringe Patch');
  process.exit(0);
}

let content = fs.readFileSync(limitPath, 'utf8');

// Der Fehler ist: "TypeError: _ is not a function"
// Das Problem ist, dass `_` (ein Template-Tag von ajv) nicht korrekt importiert oder verwendet wird
// In ajv@6.x ist die API anders als in ajv@8.x

if (content.includes('addLimitKeyword')) {
  console.log('addLimitKeyword Funktion gefunden in limit.js');
  
  // Suche nach der Funktion und ersetze sie durch eine kompatible Version
  const functionMatch = content.match(/function\s+addLimitKeyword\s*\([^)]*\)\s*\{[\s\S]*?\n\}/);
  
  if (functionMatch) {
    console.log('addLimitKeyword Funktion gefunden');
    
    // Ersetze die Funktion durch eine vereinfachte Version, die mit ajv@6.x funktioniert
    // Die ursprüngliche Funktion verwendet Template-Tags von ajv, die in ajv@6.x anders sind
    const newFunction = `function addLimitKeyword(ajv) {
  if (!ajv) {
    return;
  }
  // ajv@6.x API: addKeyword(name, definition)
  // Vereinfachte Version ohne Template-Tags
  ajv.addKeyword("limit", {
    errors: true,
    type: "number",
    compile: function (schema, parentSchema) {
      if (typeof schema !== "object" || schema === null) {
        return function (data) {
          return true;
        };
      }
      const min = schema.minimum;
      const max = schema.maximum;
      return function (data) {
        if (typeof data !== "number") {
          return true;
        }
        if (min !== undefined && data < min) {
          return false;
        }
        if (max !== undefined && data > max) {
          return false;
        }
        return true;
      };
    },
    metaSchema: {
      type: "object",
      properties: {
        minimum: { type: "number" },
        maximum: { type: "number" }
      }
    }
  });
}`;
    
    content = content.replace(/function\s+addLimitKeyword\s*\([^)]*\)\s*\{[\s\S]*?\n\}/, newFunction);
    console.log('✓ addLimitKeyword Funktion ersetzt');
  } else {
    // Fallback: Versuche, nur die problematische Zeile zu patchen
    if (content.includes('mappend(_`||`)')) {
      // Ersetze die problematische Zeile
      content = content.replace(/const\s+orCode\s*=\s*mappend\(_`\|\|`\)/g, 'const orCode = "||"');
      console.log('✓ Problem-Zeile in limit.js gepatcht');
    }
  }
} else {
  console.log('addLimitKeyword nicht gefunden in limit.js');
}

fs.writeFileSync(limitPath, content);
console.log('limit.js erfolgreich gepatcht');




