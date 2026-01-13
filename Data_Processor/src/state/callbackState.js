/**
 * Callback State
 *
 * Estado persistido em ficheiro para guardar o callbackUrl do XML Service
 *
 * Como o XML Service corre localmente (IP dinâmico),
 * ele regista-se via POST /webhook/ready quando arranca.
 *
 * Persiste em ficheiro para sobreviver a restarts do container.
 */

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '../../.callback-state.json');

/**
 * Lê o estado do ficheiro
 * @returns {Object|null}
 */
function readState() {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      return null;
    }
    const data = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao ler callback state:', error.message);
    return null;
  }
}

/**
 * Guarda o estado no ficheiro
 * @param {Object} state
 */
function writeState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (error) {
    console.error('Erro ao guardar callback state:', error.message);
    throw error;
  }
}

module.exports = {
  /**
   * Obtém o callbackUrl actual
   * @returns {string|null}
   */
  get: () => {
    const state = readState();
    return state?.callbackUrl || null;
  },

  /**
   * Define o callbackUrl (chamado pelo /webhook/ready)
   * @param {string} url - Ex: "http://192.168.1.100:3001/receive"
   */
  set: (url) => {
    writeState({
      callbackUrl: url,
      updatedAt: new Date().toISOString()
    });
  },

  /**
   * Limpa o callbackUrl
   */
  clear: () => {
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE);
    }
  },

  /**
   * Verifica se há um callbackUrl disponível
   * @returns {boolean}
   */
  isAvailable: () => {
    const url = module.exports.get();
    return url !== null && url !== undefined && url !== '';
  }
};