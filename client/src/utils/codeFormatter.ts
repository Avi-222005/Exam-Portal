/**
 * Universal Code Formatter / Prettifier
 * Formats Python, C, C++, Java, JavaScript, TypeScript, and general code
 * using language-aware tokenization, comment/string shielding, and structural indentation.
 */

interface FormatterOptions {
  indentSize?: number;
  useTabs?: boolean;
}

/**
 * Normalizes and formats code for the given language.
 */
export function formatCode(
  source: string,
  language: string,
  options: FormatterOptions = {},
): string {
  if (!source || !source.trim()) return source;

  const indentSize = options.indentSize ?? 4;
  const indentStr = options.useTabs ? '\t' : ' '.repeat(indentSize);
  const lang = (language || '').toLowerCase().trim();

  try {
    if (lang === 'python' || lang === 'py') {
      return formatPython(source, indentStr);
    }
    if (
      lang === 'c' ||
      lang === 'cpp' ||
      lang === 'c++' ||
      lang === 'java' ||
      lang === 'javascript' ||
      lang === 'js' ||
      lang === 'typescript' ||
      lang === 'ts' ||
      lang === 'csharp' ||
      lang === 'cs' ||
      lang === 'rust' ||
      lang === 'go' ||
      lang === 'php'
    ) {
      return formatCStyle(source, indentStr);
    }
    // Generic fallback: C-style formatter handles most brace-based languages cleanly
    return formatCStyle(source, indentStr);
  } catch (err) {
    console.warn('[codeFormatter] Fallback to simple line normalization', err);
    return fallbackNormalize(source, indentStr);
  }
}

/**
 * Protects strings and comments during operator/punctuation spacing
 */
class TokenShield {
  private tokens: string[] = [];
  private tokenPrefix = '___CV_FMT_TOK_';

  shield(code: string, isPython: boolean): string {
    this.tokens = [];
    let i = 0;
    const len = code.length;
    let result = '';

    while (i < len) {
      // 1. Triple-quoted strings in Python
      if (
        isPython &&
        (code.startsWith('"""', i) || code.startsWith("'''", i))
      ) {
        const quote = code.slice(i, i + 3);
        const endIdx = code.indexOf(quote, i + 3);
        const chunk = endIdx !== -1 ? code.slice(i, endIdx + 3) : code.slice(i);
        const id = `${this.tokenPrefix}${this.tokens.length}___`;
        this.tokens.push(chunk);
        result += id;
        i += chunk.length;
        continue;
      }

      // 2. Python line comments
      if (isPython && code[i] === '#') {
        const nextNewline = code.indexOf('\n', i);
        const chunk =
          nextNewline !== -1 ? code.slice(i, nextNewline) : code.slice(i);
        const id = `${this.tokenPrefix}${this.tokens.length}___`;
        this.tokens.push(chunk);
        result += id;
        i += chunk.length;
        continue;
      }

      // 3. C-Style block comments /* ... */
      if (!isPython && code.startsWith('/*', i)) {
        const endIdx = code.indexOf('*/', i + 2);
        const chunk = endIdx !== -1 ? code.slice(i, endIdx + 2) : code.slice(i);
        const id = `${this.tokenPrefix}${this.tokens.length}___`;
        this.tokens.push(chunk);
        result += id;
        i += chunk.length;
        continue;
      }

      // 4. C-Style line comments // ...
      if (!isPython && code.startsWith('//', i)) {
        const nextNewline = code.indexOf('\n', i);
        const chunk =
          nextNewline !== -1 ? code.slice(i, nextNewline) : code.slice(i);
        const id = `${this.tokenPrefix}${this.tokens.length}___`;
        this.tokens.push(chunk);
        result += id;
        i += chunk.length;
        continue;
      }

      // 5. String literals "..." or '...' or `...`
      const char = code[i];
      if (char === '"' || char === "'" || (!isPython && char === '`')) {
        const quote = char;
        let j = i + 1;
        let escaped = false;
        while (j < len) {
          if (code[j] === '\\') {
            escaped = !escaped;
          } else if (code[j] === quote && !escaped) {
            j++;
            break;
          } else {
            escaped = false;
          }
          j++;
        }
        const chunk = code.slice(i, j);
        const id = `${this.tokenPrefix}${this.tokens.length}___`;
        this.tokens.push(chunk);
        result += id;
        i = j;
        continue;
      }

      result += code[i];
      i++;
    }

    return result;
  }

  unshield(code: string): string {
    return code.replace(
      new RegExp(`${this.tokenPrefix}(\\d+)___`, 'g'),
      (_, idx) => {
        return this.tokens[parseInt(idx, 10)] ?? '';
      },
    );
  }
}

/**
 * Formats C, C++, Java, JavaScript, TypeScript, and brace-based languages
 */
function formatCStyle(source: string, indentStr: string): string {
  const shield = new TokenShield();
  const shielded = shield.shield(source, false);

  const lines = shielded.split(/\r?\n/);
  const formattedLines: string[] = [];
  let indentLevel = 0;

  for (let rawLine of lines) {
    let line = rawLine.trim();

    // Preserve empty lines (max 1 consecutive)
    if (!line) {
      if (
        formattedLines.length > 0 &&
        formattedLines[formattedLines.length - 1] !== ''
      ) {
        formattedLines.push('');
      }
      continue;
    }

    // Preprocessor directives in C/C++ (#include, #define, etc.) stay at col 0
    if (line.startsWith('#')) {
      formattedLines.push(line);
      continue;
    }

    // Standardize spacing around operators & punctuation on shielded code
    line = spaceOperatorsCStyle(line);

    // Adjust indentation for closing braces at start of line
    const leadingCloseBraces = (line.match(/^[\}\]\)]+/) || [''])[0].length;
    let currentIndent = Math.max(0, indentLevel - leadingCloseBraces);

    // Labels / case / default statements inside switch
    if (/^(case\s+[^:]+|default)\s*:/.test(line)) {
      currentIndent = Math.max(0, indentLevel - 1);
    }

    formattedLines.push(indentStr.repeat(currentIndent) + line);

    // Calculate net brace balance for next lines
    const openCount = (line.match(/[\{\[\(]/g) || []).length;
    const closeCount = (line.match(/[\}\]\)]/g) || []).length;
    indentLevel = Math.max(0, indentLevel + (openCount - closeCount));
  }

  const joined = formattedLines.join('\n');
  return shield.unshield(joined).trimEnd() + '\n';
}

function spaceOperatorsCStyle(line: string): string {
  let res = line;
  // Space after commas and semicolons (unless followed by whitespace/end)
  res = res.replace(/,([^\s])/g, ', $1');
  res = res.replace(/;([^\s])/g, '; $1');

  // Space around assignment and binary operators
  res = res.replace(
    /([a-zA-Z0-9_\)\]])\s*([=+\-*/%&|^!<>]=?|&&|\|\||<<|>>)\s*([a-zA-Z0-9_\(\[\"])/g,
    '$1 $2 $3',
  );

  // Space after keywords: if, for, while, switch, catch
  res = res.replace(/\b(if|for|while|switch|catch)\s*\(/g, '$1 (');

  // Space before opening brace {
  res = res.replace(/([^\s])\{/g, '$1 {');

  return res;
}

/**
 * Formats Python source code with correct block indentation and operator spacing
 */
function formatPython(source: string, indentStr: string): string {
  const shield = new TokenShield();
  const shielded = shield.shield(source, true);

  const rawLines = shielded.split(/\r?\n/);
  const formattedLines: string[] = [];

  let indentLevel = 0;
  let inOpenBracket = 0;

  for (let rawLine of rawLines) {
    let line = rawLine.trim();

    if (!line) {
      if (
        formattedLines.length > 0 &&
        formattedLines[formattedLines.length - 1] !== ''
      ) {
        formattedLines.push('');
      }
      continue;
    }

    // Dedent for block continuations: elif, else, except, finally
    if (/^(elif\b|else:|except\b|finally:)/.test(line)) {
      indentLevel = Math.max(0, indentLevel - 1);
    }

    // Normalize spacing on Python line
    line = spaceOperatorsPython(line);

    // Apply current indentation
    const actualIndent = inOpenBracket > 0 ? indentLevel + 1 : indentLevel;
    formattedLines.push(indentStr.repeat(actualIndent) + line);

    // Track brackets (), [], {}
    const openBrackets = (line.match(/[\(\[\{]/g) || []).length;
    const closeBrackets = (line.match(/[\)\]\}]/g) || []).length;
    inOpenBracket = Math.max(0, inOpenBracket + (openBrackets - closeBrackets));

    // If line ends with colon (block header), increase indent level for next line
    if (line.endsWith(':') && inOpenBracket === 0) {
      indentLevel++;
    } else if (/^(return\b|break\b|continue\b|pass\b|raise\b)/.test(line)) {
      // Return / break inside a single statement doesn't auto-dedent entire file,
      // but keeps formatting aligned
    }
  }

  const joined = formattedLines.join('\n');
  return shield.unshield(joined).trimEnd() + '\n';
}

function spaceOperatorsPython(line: string): string {
  let res = line;
  // Space after commas
  res = res.replace(/,([^\s])/g, ', $1');

  // Space around binary operators: +, -, *, /, //, %, **, ==, !=, <=, >=, =, +=, -=, *=, /=
  res = res.replace(
    /([a-zA-Z0-9_\)\]])\s*(==|!=|<=|>=|\/\/|\*\*|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|>>=|<<=|=|\+|-|\*|\/|%|<|>)\s*([a-zA-Z0-9_\(\[\"])/g,
    '$1 $2 $3',
  );

  // Colon in dictionary or type hints
  res = res.replace(/:\s+/g, ': ');

  return res;
}

/**
 * Fallback simple cleaner
 */
function fallbackNormalize(source: string, _indentStr: string): string {
  const lines = source.split(/\r?\n/);
  return (
    lines
      .map((l) => l.trimEnd())
      .filter((l, i, arr) => !(l.trim() === '' && arr[i - 1]?.trim() === ''))
      .join('\n')
      .trimEnd() + '\n'
  );
}
