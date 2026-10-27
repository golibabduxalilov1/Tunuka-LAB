/** @type {import('next').NextConfig} */
const API_URL = process.env.API_URL || 'http://localhost:4000';

export default {
  // /api/* so'rovlari NestJS ga uzatiladi — brauzer uchun bitta manzil, CORS shart emas
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};
