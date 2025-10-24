// Simple build script to prepare server code for Vercel
// Vercel will handle TS compilation, we just need to ensure deps are available
import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distDir = resolve(__dirname, '../packages/server/dist');

// Create dist directory if it doesn't exist (for local testing)
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

console.log('✅ Server build prepared for Vercel');
console.log('   Vercel will compile TypeScript at runtime');
