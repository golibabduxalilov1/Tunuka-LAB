import { existsSync } from 'node:fs';

// .env (api/ papkasida) bo'lsa yuklaydi; mavjud muhit o'zgaruvchilari ustun turadi. Boshqa importlardan oldin chaqiring.
if (existsSync('.env')) process.loadEnvFile('.env');
