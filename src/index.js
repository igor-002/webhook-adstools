require('dotenv').config();
const express = require('express');
const webhookRouter = require('./routes/webhook');

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.status(200).json({ success: true, service: 'webhook-adstools' });
});

app.use('/', webhookRouter);

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: 'info',
      msg: `webhook-adstools listening on port ${PORT}`,
    })
  );
});
