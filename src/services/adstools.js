const axios = require('axios');

const ADSTOOLS_SYNC_URL =
  'https://api-tools.helbioads.com/api/v1/integration/sync';

/**
 * Build the /sync payload from an Atendai `data` object and a mapping entry.
 * @param {object} data - Atendai webhook `data` object.
 * @param {{status: string, tags: string[]}} mapped - filaMap entry.
 * @returns {object} payload for ADS-Tools /sync.
 */
function buildSyncPayload(data, mapped) {
  const fila = data.filaPersonalizada || {};
  return {
    externalId: String(data.whatsappid),
    contact: {
      name: data.nome,
      phone: String(data.whatsappid),
    },
    lead: {
      status: mapped.status,
      source: 'whatsapp',
    },
    tags: mapped.tags,
    metadata: {
      atendimento_id: data.id,
      fila_id: fila.id,
      fila_nome: fila.nome_fila,
    },
  };
}

/**
 * POST a payload to the ADS-Tools /sync endpoint.
 * @param {object} payload
 * @param {string} apiKey - Bearer token (ADSTOOLS_API_KEY).
 * @returns {Promise<object>} axios response data.
 */
async function syncToAdsTools(payload, apiKey) {
  const res = await axios.post(ADSTOOLS_SYNC_URL, payload, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });
  return res.data;
}

module.exports = { buildSyncPayload, syncToAdsTools, ADSTOOLS_SYNC_URL };
