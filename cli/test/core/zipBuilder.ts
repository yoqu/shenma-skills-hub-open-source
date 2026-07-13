import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

/** Build a zip from in-memory entries by writing them to a temp dir and invoking the system `zip` binary. */
export class ZipBuilder {
  private entries: Array<{ name: string; data: string }> = [];
  add(name: string, data: string): this { this.entries.push({ name, data }); return this; }

  /** Build using the system `zip` binary (names are path-resolved by the OS). */
  build(): Buffer {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zb-'));
    try {
      for (const e of this.entries) {
        const full = path.join(tmp, e.name);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, e.data);
      }
      const out = path.join(os.tmpdir(), `zb-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`);
      execFileSync('zip', ['-r', '-q', out, '.'], { cwd: tmp });
      const buf = fs.readFileSync(out);
      fs.unlinkSync(out);
      return buf;
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  /**
   * Build using Python's zipfile module so entry names are stored verbatim
   * (no OS path resolution). Required for zip-slip test cases where the entry
   * name contains `..` traversal components.
   */
  buildRaw(): Buffer {
    const entriesJson = JSON.stringify(this.entries);
    const out = path.join(os.tmpdir(), `zb-raw-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`);
    const script = `
import zipfile, json, sys
entries = json.loads(sys.argv[1])
out = sys.argv[2]
with zipfile.ZipFile(out, 'w') as zf:
    for e in entries:
        zf.writestr(e['name'], e['data'])
`;
    execFileSync('python3', ['-c', script, entriesJson, out]);
    const buf = fs.readFileSync(out);
    fs.unlinkSync(out);
    return buf;
  }
}
