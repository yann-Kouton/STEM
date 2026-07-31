// Envoi de SMS via SMSGate (https://sms-gate.app) — passerelle open source
// gratuite qui transforme un téléphone Android (avec la carte SIM de la
// pharmacie) en API d'envoi de SMS. Aucun frais d'API : seul le coût SMS
// habituel de l'opérateur s'applique, comme un SMS envoyé à la main.
//
// Configuration requise (variables d'environnement Vercel) :
//   SMSGATE_USERNAME  -> identifiant affiché dans l'app SMSGate (écran d'accueil)
//   SMSGATE_PASSWORD  -> mot de passe affiché dans l'app SMSGate (écran d'accueil)
//   SMSGATE_DEVICE_ID -> (optionnel mais recommandé) ID de l'appareil affiché
//                        dans l'app, pour cibler précisément le téléphone de
//                        la pharmacie même si d'autres appareils sont
//                        enregistrés sur le même compte plus tard.
//
// Voir /mnt/user-data/outputs/SMS-SETUP.md pour la procédure d'installation.

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: 'Numéro de téléphone et message requis' });
    }

    const smsUsername = process.env.SMSGATE_USERNAME;
    const smsPassword = process.env.SMSGATE_PASSWORD;
    const smsDeviceId = process.env.SMSGATE_DEVICE_ID; // optionnel

    if (!smsUsername || !smsPassword) {
      console.error('Identifiants SMSGate manquants (SMSGATE_USERNAME / SMSGATE_PASSWORD)');
      return res.status(500).json({ error: 'Configuration SMS manquante côté serveur' });
    }

    const normalizedPhone = normalizeToE164(phone);
    if (!normalizedPhone) {
      return res.status(400).json({ error: 'Numéro de téléphone invalide' });
    }

    // Message borné en longueur pour éviter un envoi multi-segments coûteux
    // par accident (une erreur de frappe, un texte trop long, etc.)
    const safeMessage = String(message).trim().slice(0, 480);

    const auth = Buffer.from(`${smsUsername}:${smsPassword}`).toString('base64');

    const payload = {
      textMessage: { text: safeMessage },
      phoneNumbers: [normalizedPhone],
    };
    if (smsDeviceId) {
      payload.deviceId = smsDeviceId;
    }

    const smsResponse = await fetch('https://api.sms-gate.app/3rdparty/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!smsResponse.ok) {
      const errorText = await smsResponse.text();
      throw new Error(errorText);
    }

    const data = await smsResponse.json();
    res.status(200).json({ success: true, id: data.id || null });
  } catch (error) {
    console.error('Erreur envoi SMS:', error.message);
    res.status(500).json({ error: "Erreur lors de l'envoi du SMS" });
  }
}

// Convertit un numéro ivoirien saisi localement (ex: "07 12 34 56 78" ou
// "0712345678") au format international E.164 (+225...) attendu par
// l'API SMSGate. Accepte aussi un numéro déjà international.
function normalizeToE164(rawPhone) {
  const trimmed = String(rawPhone).trim();
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    return digits ? `+${digits}` : null;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('225')) return `+${digits}`;
  if (digits.startsWith('0')) return `+225${digits.slice(1)}`;
  return `+225${digits}`;
}