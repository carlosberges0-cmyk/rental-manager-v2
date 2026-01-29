// Postinstall script to ensure Prisma Client is generated
const { execSync } = require('child_process');

console.log('🔧 Generating Prisma Client...');
try {
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('✅ Prisma Client generated successfully');
} catch (error) {
  console.warn('⚠️  Failed to generate Prisma Client. Please run "npx prisma generate" manually.');
  process.exit(0); // Don't fail the install if this fails
}
