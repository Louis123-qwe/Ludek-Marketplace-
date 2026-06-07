const { google } = require('googleapis');

const FIREBASE_PROJECT_ID = 'dmb-5b8e2';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tokens, title, body, url, type } = req.body;

    if (!tokens || !tokens.length) {
      return res.status(400).json({ error: 'No tokens provided' });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT),
      scopes: ['https://www.googleapis.com/auth/firebase.messaging']
    });

    const accessToken = await auth.getAccessToken();

    const results = await Promise.allSettled(
      tokens.map(token =>
        fetch(
          `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + accessToken
            },
            body: JSON.stringify({
              message: {
                token,
                // NO top-level notification block — forces SW handler
                data: {
                  url:  url  || 'https://ludek-marketplace.vercel.app',
                  type: type || 'general',
                  title: title || 'Ludek Marketplace',
                  body:  body  || ''
                },
                webpush: {
                  notification: {
                    title: title || 'Ludek Marketplace',
                    body:  body  || '',
                    icon:  '/assets/icon-192.png',
                    badge: '/assets/icon-192.png'
                  },
                  fcm_options: {
                    link: url || 'https://ludek-marketplace.vercel.app'
                  }
                }
              }
            })
          }
        )
      )
    );

    const success = results.filter(r => r.status === 'fulfilled').length;
    const failed  = results.filter(r => r.status === 'rejected').length;

    return res.status(200).json({ success, failed });

  } catch (err) {
    console.error('[FCM V1] Error:', err);
    return res.status(500).json({ error: err.message });
  }
      }
