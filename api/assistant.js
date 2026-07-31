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
    const { messages, model, displayName, summarize, previousSummary, patientContext } = req.body;
    if (!messages) {
      return res.status(400).json({ error: 'Messages requis' });
    }

    const mistralApiKey = process.env.MISTRAL_API_KEY;
    if (!mistralApiKey) {
      console.error('Clé Mistral manquante');
      return res.status(500).json({ error: 'Configuration serveur manquante' });
    }

    // === Mode résumé (appel caché, modèle léger, pas d'outils) ===
    // Le front envoie ici un lot de vieux messages à condenser pour
    // économiser des tokens sur les prochains appels. On utilise un modèle
    // moins cher (mistral-small) et une consigne stricte pour ne jamais
    // perdre d'information cliniquement ou administrativement importante.
    if (summarize) {
      const summarySystemPrompt = `Tu résumes un extrait de conversation entre un pharmacien d'officine et un assistant IA médical, pour compresser l'historique et économiser des tokens.

Règles impératives :
- Résumé factuel, 4 à 8 phrases maximum, en français.
- Conserve absolument : noms de patients cités, symptômes/pathologies évoqués, médicaments/posologies mentionnés, actions déjà réalisées (recherche patient, fiche affichée), questions restées sans réponse, décisions ou recommandations données.
- N'invente strictement aucune information absente de l'échange.
- Pas de formules de politesse, pas de commentaire, uniquement le résumé.
- Si un résumé précédent est fourni, fusionne-le avec les nouveaux messages en un seul résumé cohérent (ne double pas les informations déjà couvertes).`;

      const summaryUserContent = previousSummary
        ? `Résumé précédent :\n${previousSummary}\n\nNouveaux messages à intégrer :\n` +
          messages.map((m) => `${m.role === 'user' ? 'Pharmacien' : 'Assistant'}: ${m.content}`).join('\n')
        : `Messages à résumer :\n` +
          messages.map((m) => `${m.role === 'user' ? 'Pharmacien' : 'Assistant'}: ${m.content}`).join('\n');

      const summaryResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mistralApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [
            { role: 'system', content: summarySystemPrompt },
            { role: 'user', content: summaryUserContent },
          ],
          temperature: 0.2,
          max_tokens: 350,
        }),
      });

      if (!summaryResponse.ok) {
        const errorText = await summaryResponse.text();
        throw new Error(errorText);
      }

      const summaryData = await summaryResponse.json();
      const summary = summaryData.choices?.[0]?.message?.content?.trim() || '';
      return res.status(200).json({ summary });
    }

    // mistral-tiny ne supporte pas la Conversations API / le websearch :
    // on utilise un modèle par défaut compatible.
    const modelName = model || 'mistral-medium-latest';

    // Nom du pharmacien connecté (fourni par le frontend depuis Firebase Auth).
    // On le nettoie sommairement pour éviter d'injecter du texte indésirable
    // dans les instructions système.
    const safeUserName =
      typeof displayName === 'string' ? displayName.trim().slice(0, 60).replace(/[\r\n]+/g, ' ') : '';

    const personalization = safeUserName
      ? `\n\nL'utilisateur actuellement connecté s'appelle ${safeUserName} (pharmacien de l'officine). Adressez-vous à lui par son Nom et prenom précédé de Dr. de façon naturelle (par exemple en le saluant ou ponctuellement dans vos réponses), sans le répéter systématiquement à chaque message pour ne pas être lourd.`
      : '';

    // Résumé condensé du début de la conversation, généré côté client via le
    // mode `summarize` ci-dessus. Permet de garder le contexte (nom du
    // patient, symptômes, actions déjà faites...) sans renvoyer tous les
    // messages bruts à chaque requête.
    const safeSummary =
      typeof previousSummary === 'string' ? previousSummary.trim().slice(0, 1500) : '';
    const summaryContext = safeSummary
      ? `\n\nRésumé du début de cette conversation (les messages détaillés correspondants ne sont plus envoyés) : ${safeSummary}`
      : '';

    // Fiche du patient actuellement sélectionné par le pharmacien dans
    // l'application (facultatif). Construite et déjà mise en forme côté
    // client (voir buildPatientContext dans App.jsx), on se contente ici de
    // la borner en longueur par sécurité avant de l'injecter dans les
    // instructions du modèle.
    const safePatientContext =
      typeof patientContext === 'string' ? patientContext.trim().slice(0, 4000) : '';
    const patientContextBlock = safePatientContext
      ? `\n\n=== FICHE DU PATIENT ACTUELLEMENT EN CONTEXTE ===\nLe pharmacien consulte actuellement la fiche du patient suivant. Utilisez ces informations pour répondre précisément à ses questions à son sujet (allergies, traitements, antécédents, historique de consultations, constantes physiologiques...). Ne mentionnez jamais d'information qui ne figure pas ci-dessous : si une donnée demandée est absente de la fiche, dites clairement qu'elle n'est pas renseignée plutôt que de l'inventer.\n${safePatientContext}\n=== FIN DE LA FICHE PATIENT ===`
      : '';

    const instructions = `Vous êtes Vignon, un assistant médical pour la pharmacie Sainte Marie Majeure, crée par Kouton Vignon Esmel un etudiant en data science et IA. Vous êtes un assistant conversationnel bienveillant et rigoureux.${personalization}${summaryContext}${patientContextBlock}

Vous pouvez aider à effectuer deux actions précises dans l'application :
- rechercher un patient dans la base
- afficher la fiche d'un patient

Pour toute autre question (question médicale ou pharmaceutique, question générale, actualité, information changeante...), répondez du mieux possible en utilisant vos connaissances. Vous disposez également d'un outil de recherche web en temps réel : utilisez-le chaque fois que la question porte sur une information récente, changeante, chiffrée avec précision, ou que vous n'êtes pas certain de connaître (actualités, nouveaux médicaments, disponibilité, prix, réglementation récente, etc.). N'hésitez pas à vous en servir plutôt que de deviner.

Si une fiche patient est fournie ci-dessus (section "FICHE DU PATIENT ACTUELLEMENT EN CONTEXTE"), appuyez-vous dessus en priorité pour toute question concernant ce patient (allergies, traitements en cours, antécédents, historique de consultations, évolution du poids/tension/glycémie...). Croisez-la si besoin avec vos connaissances pharmaceutiques générales (ex. interactions médicamenteuses, contre-indications liées à une pathologie ou une allergie mentionnée) pour donner un avis utile, mais rappelez que la décision clinique finale revient au pharmacien. Si aucune fiche n'est fournie et que la question porte sur un patient précis, invitez le pharmacien à d'abord afficher la fiche de ce patient.

IMPORTANT : vous ne devez inclure une ligne "ACTION: nomAction|paramètres" que si l'utilisateur demande explicitement l'une des deux actions suivantes : rechercher un patient, afficher une fiche patient. Dans tous les autres cas (y compris toute question générale, même si vous utilisez la recherche web), vous répondez de manière naturelle et vous n'incluez AUCUNE ligne ACTION.
Si l'utilisateur demande une action sans fournir le nom complet, demandez-lui poliment de préciser (par exemple : "Pour rechercher un patient, veuillez me donner son nom").

Les actions disponibles sont :
- searchPatient|query (recherche un patient) -> exemple : "ACTION: searchPatient|Dupont"
- showPatient|{"name":"nom"} (affiche la fiche) -> exemple : "ACTION: showPatient|{\"name\":\"Dupont\"}"

Ne générez la ligne ACTION que lorsque l'utilisateur demande explicitement l'une de ces deux actions, avec les informations nécessaires. Sinon, répondez simplement en tant qu'assistant, en vous appuyant sur vos connaissances et, si besoin, sur la recherche web. Si l'utilisateur pose une question qui n'a pas de rapport avec la santé, la pharmacie ou la medecine en general, repondez puis redirigez le de façon polie vers la santé, la pharmacie ou la medecine en general. Et gardez à l'esprit que les patients sont en côte d'ivoire, donc certaines informations peuvent être différentes de celles d'autres pays (médicaments disponibles, réglementation, prix, etc.).`;

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