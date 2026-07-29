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
    const { messages, model, userName } = req.body;
    if (!messages) {
      return res.status(400).json({ error: 'Messages requis' });
    }

    const mistralApiKey = process.env.MISTRAL_API_KEY;
    if (!mistralApiKey) {
      console.error('Clé Mistral manquante');
      return res.status(500).json({ error: 'Configuration serveur manquante' });
    }

    // mistral-tiny ne supporte pas la Conversations API / le websearch :
    // on utilise un modèle par défaut compatible.
    const modelName = model || 'mistral-medium-latest';

    // Nom du pharmacien connecté (fourni par le frontend depuis Firebase Auth).
    // On le nettoie sommairement pour éviter d'injecter du texte indésirable
    // dans les instructions système.
    const safeUserName =
      typeof userName === 'string' ? userName.trim().slice(0, 60).replace(/[\r\n]+/g, ' ') : '';

    const personalization = safeUserName
      ? `\n\nL'utilisateur actuellement connecté s'appelle ${safeUserName} (pharmacien de l'officine). Adressez-vous à lui par son prénom de façon naturelle (par exemple en le saluant ou ponctuellement dans vos réponses), sans le répéter systématiquement à chaque message pour ne pas être lourd.`
      : '';

    const instructions = `Vous êtes Vignon, un assistant médical pour la pharmacie Sainte Marie Majeure. Vous êtes un assistant conversationnel bienveillant et rigoureux.${personalization}

Vous pouvez aider à effectuer deux actions précises dans l'application :
- rechercher un patient dans la base
- afficher la fiche d'un patient

Pour toute autre question (question médicale ou pharmaceutique, question générale, actualité, information changeante...), répondez du mieux possible en utilisant vos connaissances. Vous disposez également d'un outil de recherche web en temps réel : utilisez-le chaque fois que la question porte sur une information récente, changeante, chiffrée avec précision, ou que vous n'êtes pas certain de connaître (actualités, nouveaux médicaments, disponibilité, prix, réglementation récente, etc.). N'hésitez pas à vous en servir plutôt que de deviner.

IMPORTANT : vous ne devez inclure une ligne "ACTION: nomAction|paramètres" que si l'utilisateur demande explicitement l'une des deux actions suivantes : rechercher un patient, afficher une fiche patient. Dans tous les autres cas (y compris toute question générale, même si vous utilisez la recherche web), vous répondez de manière naturelle et vous n'incluez AUCUNE ligne ACTION.
Si l'utilisateur demande une action sans fournir le nom complet, demandez-lui poliment de préciser (par exemple : "Pour rechercher un patient, veuillez me donner son nom").

Les actions disponibles sont :
- searchPatient|query (recherche un patient) -> exemple : "ACTION: searchPatient|Dupont"
- showPatient|{"name":"nom"} (affiche la fiche) -> exemple : "ACTION: showPatient|{\"name\":\"Dupont\"}"

Ne générez la ligne ACTION que lorsque l'utilisateur demande explicitement l'une de ces deux actions, avec les informations nécessaires. Sinon, répondez simplement en tant qu'assistant, en vous appuyant sur vos connaissances et, si besoin, sur la recherche web.`;

    // Historique de la conversation, sans message système (géré via `instructions`)
    const inputs = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }));

    const mistralResponse = await fetch('https://api.mistral.ai/v1/conversations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mistralApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelName,
        instructions,
        inputs,
        tools: [{ type: 'web_search' }],
        store: false,
        completion_args: { temperature: 0.7 },
      }),
    });

    if (!mistralResponse.ok) {
      const errorText = await mistralResponse.text();
      throw new Error(errorText);
    }

    const data = await mistralResponse.json();
    const content = extractAssistantText(data.outputs);
    const action = parseAction(content);

    res.status(200).json({ content, action });
  } catch (error) {
    console.error('Erreur Mistral:', error.message);
    res.status(500).json({ error: 'Erreur lors de la requête à Mistral' });
  }
}

// Les réponses de l'API Conversations sont une liste d'entrées (message.output,
// tool.execution, ...). On récupère le texte du dernier message assistant, que
// son contenu soit une simple chaîne ou une liste de "chunks" (texte + références
// de recherche web).
function extractAssistantText(outputs) {
  if (!Array.isArray(outputs)) return '';

  const messageOutputs = outputs.filter(
    (entry) => entry.type === 'message.output' || (entry.role === 'assistant' && entry.content)
  );
  const last = messageOutputs[messageOutputs.length - 1];
  if (!last) return '';

  const { content } = last;
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .filter((chunk) => chunk.type === 'text')
      .map((chunk) => chunk.text)
      .join('');
  }

  return '';
}

function parseAction(text) {
  const match = text.match(/ACTION:\s*(\w+)\s*(?:\|(.+))?/);
  if (!match) return null;
  const [, type, paramsStr] = match;

  // Garde-fou côté serveur : seules ces deux actions sont autorisées.
  const ALLOWED_ACTIONS = new Set(['searchPatient', 'showPatient']);
  if (!ALLOWED_ACTIONS.has(type)) return null;

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