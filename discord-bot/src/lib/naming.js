import { access } from 'node:fs/promises';
import path from 'node:path';

// Characters that are illegal in file names on Windows/macOS/Linux.
const ILLEGAL_FS_CHARS = /[/\\:*?"<>|]/g;
// ASCII control characters.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g;

/**
 * Turn an arbitrary label (username, channel name...) into something safe for a
 * filename on any OS while keeping it human-readable (accents/emoji-free names
 * are preserved rather than stripped to ASCII).
 */
export function sanitizeName(name) {
  return (
    String(name)
      .replace(ILLEGAL_FS_CHARS, '')
      .replace(CONTROL_CHARS, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\.+|\.+$/g, '') // no leading/trailing dots
      .trim()
      .slice(0, 100)
      .trim() || 'ticket'
  );
}

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Return a path in `dir` for `baseName + ext` that does not clash with an
 * existing file, appending " (2)", " (3)"... if needed.
 */
export async function uniquePath(dir, baseName, ext = '.html') {
  let candidate = path.join(dir, `${baseName}${ext}`);
  let i = 2;
  while (await fileExists(candidate)) {
    candidate = path.join(dir, `${baseName} (${i})${ext}`);
    i += 1;
  }
  return candidate;
}
