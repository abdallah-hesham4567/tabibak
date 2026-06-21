function safeJsonParse(str) {
  const cleaned = str.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match) => {
    return match.replace(/[\x00-\x1f]/g, (c) => {
      return '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0');
    });
  });
  return JSON.parse(cleaned);
}

function repairJSON(str) {
  try { JSON.parse(str); return str; } catch (e) {}

  let fixed = str
    .replace(/}\s*{/g, '},{')
    .replace(/\]\s*{/g, '],{')
    .replace(/}\s*\[/g, '},[')
    .replace(/,\s*]/g, ']')
    .replace(/,\s*}/g, '}');
  try { JSON.parse(fixed); return fixed; } catch (e) {}

  let depth = 0, validEnd = -1;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '{') depth++;
    if (str[i] === '}') { depth--; if (depth === 0) validEnd = i + 1; }
  }
  if (validEnd > 0) {
    try { return JSON.parse(str.substring(0, validEnd)); } catch (e) {}
  }

  throw new Error('لم يتمكن إصلاح JSON');
}
