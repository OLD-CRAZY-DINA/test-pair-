const express = require('express');
const { 
  makeCacheableSignalKeyStore, 
  initAuthCreds, 
  initAuthKeyStore, 
  default: makeWASocket, 
  delay, 
  Browsers 
} = require('@whiskeysockets/baileys');
const pino = require('pino');

const router = express.Router();

let isPairingInProgress = false;  // concurrency control

router.get('/', async (req, res) => {
  let num = req.query.number;

  if (!num) {
    return res.status(400).json({ error: "Missing 'number' query parameter" });
  }

  if (isPairingInProgress) {
    return res.status(429).json({ error: "Pairing already in progress, please wait" });
  }

  isPairingInProgress = true;

  async function startPairing() {
    try {
      // Initialize in-memory auth state (no file storage)
      const state = {
        creds: initAuthCreds(),
        keys: initAuthKeyStore(),
      };

      const sock = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys),
        },
        logger: pino({ level: 'fatal' }),
        printQRInTerminal: false,
        generateHighQualityLinkPreview: true,
        browser: Browsers.macOS('Safari'),
      });

      // Clean number: remove non-digit chars
      num = num.replace(/[^0-9]/g, '');

      if (!sock.authState.creds.registered) {
        await delay(1500);

        const code = await sock.requestPairingCode(num);

        if (!res.headersSent) {
          res.json({ code });
        }
      }

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
          await delay(3000);

          const successMessage = `✅ ඔබේ WhatsApp BOT පේයාර් වීම සාර්ථකයි! 📱 ඔබ දැන් BOT එක සමඟ සම්බන්ධ වී ඇත. 📌 Support: wa.me/94760663483`;

          await sock.sendMessage(sock.user.id, {
            text: successMessage,
            contextInfo: {
              externalAdReply: {
                title: 'DTZ BOT • Pairing Success',
                thumbnailUrl: 'https://i.ibb.co/ymS2BQ49/SulaMd.jpg',
                sourceUrl: 'https://wa.me/94760663483',
                mediaType: 1,
                renderLargerThumbnail: true,
              },
            },
          });

          await delay(3000);

          await sock.ws.close();

          console.log(`👤 ${sock.user.id} connected (in-memory session).`);

          isPairingInProgress = false;
          process.exit(0);
        } else if (connection === 'close') {
          // If unauthorized, do not retry
          if (lastDisconnect?.error?.output?.statusCode === 401) {
            console.log('❌ Unauthorized. Stopping pairing.');
            isPairingInProgress = false;
            if (!res.headersSent) {
              res.status(401).json({ error: 'Unauthorized pairing attempt' });
            }
            return;
          }

          // Retry pairing after small delay
          console.log('⚠️ Connection closed unexpectedly. Retrying...');
          await delay(2000);
          if (!res.headersSent) {
            // To avoid multiple response sends
            try {
              await startPairing();
            } catch (e) {
              console.error('❗ Retry pairing failed:', e);
              isPairingInProgress = false;
              if (!res.headersSent) {
                res.status(500).json({ error: 'Retry failed' });
              }
            }
          }
        }
      });

      sock.ev.on('creds.update', () => {
        // Can persist creds here if you want, for now do nothing
      });
    } catch (err) {
      console.error('❗ Pairing error:', err);
      isPairingInProgress = false;
      if (!res.headersSent) {
        res.status(503).json({ error: 'Service Unavailable' });
      }
    }
  }

  await startPairing();
});

module.exports = router;
