import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                shop: resolve(__dirname, 'shop.html'),
                reserve: resolve(__dirname, 'reserve.html'),
                checkout: resolve(__dirname, 'checkout.html'),
            }
        }
    }
});
