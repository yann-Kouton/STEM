export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { messages, model } = req.body;
    if (!messages) {
      return res.status(400).json({ error: 'Messages requis' });
    }

    const mistralApiKey = process.env.MISTRAL_API_KEY;
    if (!mistralApiKey) {
      console.error('Clé Mistral manquante');
      return res.status(500).json({ error: 'Configuration serveur manquante' });
    }

    const modelName = model || 'mistral-tiny';

    const systemMessage = {
      role: 'system',
      content: `Vous êtes Vignon, un assistant médical pour la pharmacie Sainte Marie Majeure. Vous êtes un assistant conversationnel. Vous pouvez aider à rechercher des patients, afficher des fiches, ajouter des consultations, vérifier des interactions médicamenteuses et calculer des posologies. 

IMPORTANT : vous ne devez inclure une ligne "ACTION: nomAction|paramètres" que si l'utilisateur demande explicitement l'une des actions suivantes : rechercher un patient, afficher une fiche, ajouter une consultation, vérifier une interaction, calculer une posologie. Dans tous les autres cas, vous répondez de manière naturelle et vous n'incluez AUCUNE ligne ACTION.
Si l'utilisateur demande une action sans fournir le nom complet, vous lui demandez poliment de préciser (par exemple : "Pour rechercher un patient, veuillez me donner son nom").

Les actions disponibles sont :
- searchPatient|query (recherche un patient) -> exemple : "ACTION: searchPatient|Dupont"
- showPatient|{"name":"nom"} (affiche la fiche) -> exemple : "ACTION: showPatient|{\"name\":\"Dupont\"}"
- addConsultation|{"patientId":"id"} (ajoute une consultation) -> exemple : "ACTION: addConsultation|{\"patientId\":\"abc123\"}"
- listPatients (liste les patients) -> exemple : "ACTION: listPatients"
- checkInteraction|{"moleculeA":"nom","moleculeB":"nom"} -> exemple : "ACTION: checkInteraction|{\"moleculeA\":\"Aspirine\",\"moleculeB\":\"Warfarine\"}"
- calculateDosage|{"molecule":"nom","weight":poids} -> exemple : "ACTION: calculateDosage|{\"molecule\":\"Paracétamol\",\"weight\":20}"

Ne générez la ligne ACTION que lorsque l'utilisateur demande explicitement une de ces actions, avec les informations nécessaires. Sinon, répondez simplement en tant qu'assistant.`
    };

    const fullMessages = [systemMessage, ...messages];

    const mistralResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mistralApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        messages: fullMessages,
        temperature: 0.7,
      }),
    });

    if (!mistralResponse.ok) {
      const errorText = await mistralResponse.text();
      throw new Error(errorText);
    }

    const data = await mistralResponse.json();
    const content = data.choices[0].message.content;
    const action = parseAction(content);

    res.status(200).json({ content, action });
  } catch (error) {
    console.error('Erreur Mistral:', error.message);
    res.status(500).json({ error: 'Erreur lors de la requête à Mistral' });
  }
}

function parseAction(text) {
  const match = text.match(/ACTION:\s*(\w+)\s*(?:\|(.+))?/);
  if (!match) return null;
  const [, type, paramsStr] = match;
  let params = {};
  if (paramsStr) {
    try {
      params = JSON.parse(paramsStr);
    } catch {
      params = { query: paramsStr };
    }
  }
  return { type, params };
}