// Lightweight "lint" step used by CI: syntax-checks every backend source file.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const roots = ['src', 'tests'];
let count = 0;

const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (full.endsWith('.js')) {
      execFileSync(process.execPath, ['--check', full], { stdio: 'inherit' });
      count += 1;
    }
  }
};

roots.forEach(walk);
console.log(`Syntax OK: ${count} files checked`);
