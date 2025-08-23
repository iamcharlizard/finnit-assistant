// Importar y ejecutar el seed JavaScript
import { execSync } from 'child_process';
import { join } from 'path';

const seedPath = join(__dirname, '../prisma/seeders/seed.js');

try {
  console.log('🌱 Ejecutando seed desde TypeScript...');
  execSync(`node ${seedPath} ${process.argv.slice(2).join(' ')}`, {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  console.log('✅ Seed completado exitosamente');
} catch (error) {
  console.error('❌ Error ejecutando seed:', error);
  process.exit(1);
}
