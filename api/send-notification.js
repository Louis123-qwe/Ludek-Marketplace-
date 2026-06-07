const { google } = require('googleapis');

const FIREBASE_PROJECT_ID = 'dmb-5b8e2'; // ← your project ID

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tokens, title, body, url, type } = req.body;

    if (!tokens || !tokens.length) {
      return res.status(400).json({ error: 'No tokens provided' });
    }

    // Get OAuth2 access token using service account
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT),
      scopes: ['https://www.googleapis.com/auth/firebase.messaging']
    });

    const accessToken = await auth.getAccessToken();

    // Send to each token (V1 API doesn't support multicast directly)
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
                notification: { title, body },
                data: { url: url || 'https://ludek-marketplace.vercel.app', type: type || 'general' },
                webpush: {
                  notification: {
                    icon: '/favicon.svg',
                    badge: '/favicon.svg'
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
