/**
 * Configuración de despliegue con PM2 (Ubuntu).
 *
 * Importante: mientras la base de datos sea SQLite, el proceso debe correr en
 * modo `fork` con una sola instancia. SQLite admite un único escritor por
 * archivo; varias instancias en clúster competirían por el archivo y podrían
 * provocar bloqueos. Si en el futuro se migra a MySQL, se puede cambiar a
 * `exec_mode: 'cluster'` con las instancias deseadas.
 *
 * Uso típico en el servidor:
 *   npm ci
 *   npm run build
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup
 */
module.exports = {
  apps: [
    {
      name: 'gesmttofcbv',
      script: 'dist/server.cjs',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      // El resto de variables (.env) las carga dotenv desde el archivo .env.
      env: {
        NODE_ENV: 'production',
      },
      // Logs con marca de tiempo, combinados en un único archivo por flujo.
      time: true,
      merge_logs: true,
      out_file: './logs/out.log',
      error_file: './logs/error.log',
    },
  ],
};
