/**
 * Configuración global de las pruebas.
 *
 * Se ejecuta antes de importar cualquier módulo de la aplicación, por lo que
 * aquí se definen las variables de entorno y la base de datos en memoria.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-with-at-least-32-characters-long';
process.env.SQLITE_PATH = ':memory:';
process.env.INITIAL_ADMIN_PASSWORD = 'AdminTestPassword123';
process.env.INITIAL_REVISOR_PASSWORD = 'RevisorTestPassword123';
process.env.GEMINI_API_KEY = '';
