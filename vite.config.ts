import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import obfuscator from 'vite-plugin-javascript-obfuscator';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const isProduction = mode === 'production';

  return {
    plugins: [
      react(), 
      tailwindcss(),
      // Enable obfuscation ONLY in production and with safer settings
      isProduction && (obfuscator as any)({
        compact: true,
        controlFlowFlattening: false, // Too aggressive, can cause runtime issues
        deadCodeInjection: false,
        debugProtection: false,
        disableConsoleOutput: true,
        identifierNamesGenerator: 'hexadecimal',
        log: false,
        numbersToExpressions: false, // Can break logic in complex libraries
        renameGlobals: false,
        selfDefending: false,
        simplify: true,
        splitStrings: false, // Breaks dynamic code and regexes
        stringArray: true,
        stringArrayCallsTransform: true,
        stringArrayEncoding: ['base64'],
        stringArrayIndexShift: true,
        stringArrayRotate: true,
        stringArrayShuffle: true,
        stringArrayThreshold: 0.75,
        transformObjectKeys: false, // CRITICAL: This breaks React and third-party libraries
        unicodeEscapeSequence: false
      })
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      'process.env.ADMIN_PASSWORD': JSON.stringify(env.ADMIN_PASSWORD || ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
