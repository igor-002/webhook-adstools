const express = require('express');
const { filaMap } = require('../config/filaMap');
const { buildSyncPayload, syncToAdsTools } = require('../services/adstools');

const router = express.Router();

const HANDLED_EVENT = 'ENTRADA_NOVA_CONVERSA_FILA';

function log(level, msg, extra = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...extra,
  };
  console[level === 'error' ? 'error' : 'log'](JSON.stringify(entry));
}

// Validate the secret only when WEBHOOK_SECRET is set in env.
// Accepts it via header `x-webhook-secret` OR query param `?secret=`
// (Atendai cannot send custom headers, so the query param is the fallback).
function checkSecret(req, res, next) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return next();
  const provided = req.get('x-webhook-secret') || req.query.secret;
  if (provided === secret) return next();
  log('error', 'Invalid webhook secret', { ip: req.ip });
  return res.status(401).json({ success: false, error: 'invalid secret' });
}

router.post('/webhook', checkSecret, async (req, res) => {
  // TEMP DEBUG: dump raw payload to inspect Atendai field names.
  log('info', 'RAW payload', { body: req.body });

  const data = (req.body && req.body.data) || {};
  const evento = data.evento;
  const filaNome = data.filaPersonalizada && data.filaPersonalizada.nome_fila;
  const externalId = data.whatsappid;

  // Only handle the new-conversation-in-queue event for now.
  if (evento !== HANDLED_EVENT) {
    log('info', 'Event ignored (unhandled type)', { evento, externalId });
    return res.status(200).json({ success: true, ignored: 'event' });
  }

  const mapped = filaMap[filaNome];
  if (!mapped) {
    log('info', 'Queue not mapped, skipping sync', { filaNome, externalId });
    return res.status(200).json({ success: true, ignored: 'fila' });
  }

  const payload = buildSyncPayload(data, mapped);
  log('info', 'Webhook received', {
    evento,
    filaNome,
    externalId,
    status: mapped.status,
    tags: mapped.tags,
  });

  // Always return 200 to Atendai (avoid retry loop). Log ADS-Tools failures.
  try {
    const result = await syncToAdsTools(payload, process.env.ADSTOOLS_API_KEY);
    log('info', 'ADS-Tools sync ok', { externalId, response: result });
    return res.status(200).json({ success: true, synced: true });
  } catch (err) {
    log('error', 'ADS-Tools sync failed', {
      externalId,
      filaNome,
      status: err.response && err.response.status,
      error: (err.response && err.response.data) || err.message,
    });
    return res.status(200).json({ success: true, synced: false });
  }
});

module.exports = router;
