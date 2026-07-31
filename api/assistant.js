export default async function handler(req, res) {
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

    const modelName = model || 'mistral-medium-latest';

    const safeUserName =
      typeof displayName === 'string' ? displayName.trim().slice(0, 60).replace(/[\r\n]+/g, ' ') : '';

    const personalization = safeUserName
      ? `\n\nL'utilisateur actuellement connecté s'appelle ${safeUserName} (pharmacien de l'officine). Adressez-vous à lui par son Nom et prenom précédé de Dr. de façon naturelle (par exemple en le saluant ou ponctuellement dans vos réponses), sans le répéter systématiquement à chaque message pour ne pas être lourd.`
      : '';

    const safeSummary =
      typeof previousSummary === 'string' ? previousSummary.trim().slice(0, 1500) : '';
    const summaryContext = safeSummary
      ? `\n\nRésumé du début de cette conversation (les messages détaillés correspondants ne sont plus envoyés) : ${safeSummary}`
      : '';
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

Ne générez la ligne ACTION que lorsque l'utilisateur demande explicitement l'une de ces deux actions, avec les informations nécessaires. Sinon, répondez simplement en tant qu'assistant, en vous appuyant sur vos connaissances et, si besoin, sur la recherche web.

QUESTIONNAIRE INTERACTIF : lorsque le pharmacien vous demande de préparer un questionnaire à faire remplir au patient (par exemple : "fais-moi un questionnaire sur sa douleur abdominale", "pose des questions au patient sur ses symptômes", "génère un questionnaire d'évaluation pour cette allergie"), vous devez impérativement générer un questionnaire structuré au format JSON. Pour cela, terminez votre réponse par le bloc exact suivant, et ne mettez rien après ce bloc (pas de phrase finale, pas de point, pas de retour à la ligne) :

QUESTIONNAIRE:{"title":"Titre court du questionnaire","questions":[{"id":"q1","type":"text","label":"Question ouverte"},{"id":"q2","type":"radio","label":"Question à choix unique","options":["Option A","Option B"]},{"id":"q3","type":"checkbox","label":"Question à choix multiples","options":["Option A","Option B","Option C"]},{"id":"q4","type":"scale","label":"Intensité (0 à 10)","min":0,"max":10}]}

ATTENTION : le JSON doit être sur une seule ligne, sans espaces superflus, et strictement valide. Utilisez des guillemets droits (") pour les chaînes. N'ajoutez aucun commentaire, aucun texte après le dernier '}'. Le marqueur "QUESTIONNAIRE:" doit être collé au JSON sans espace.

Règles pour les questions :
- Types autorisés : "text" (réponse libre courte), "radio" (choix unique parmi "options"), "checkbox" (choix multiples parmi "options"), "scale" (curseur numérique avec "min" et "max").
- Entre 4 et 8 questions maximum, pertinentes et ciblées.
- Chaque "id" doit être court, unique, sans espace ni accent.
- N'incluez jamais de ligne ACTION dans la même réponse qu'un bloc QUESTIONNAIRE.
- Avant le bloc, vous pouvez ajouter une courte phrase d'introduction (une seule phrase, ex. "Voici un questionnaire à faire remplir au patient :"), sans reformuler les questions en texte.

IMPORTANT : Si vous ne parvenez pas à générer un questionnaire valide, dites simplement en texte "Je ne peux pas générer de questionnaire pour cette demande." sans inclure le marqueur QUESTIONNAIRE.

Quand, plus tard dans la conversation, un message vous transmet les réponses du patient à un questionnaire (message commençant généralement par "Réponses du patient au questionnaire"), analysez ces réponses avec vos connaissances pharmaceutiques et médicales générales et ou des recherches sur le web (et la fiche patient si elle est fournie ci-dessus), puis proposez une analyse structurée : pistes probables, signes de gravité éventuels à surveiller, et une orientation (conseil à l'officine, orientation vers un médecin/urgences si besoin). Ne posez jamais de diagnostic formel et rappelez que la décision clinique finale revient au pharmacien.
Si l'utilisateur pose une question qui n'a pas de rapport avec la santé, la pharmacie ou la medecine en general, repondez puis redirigez le de façon polie vers la santé, la pharmacie ou la medecine en general. Et gardez à l'esprit que les patients sont en côte d'ivoire, donc certaines informations peuvent être différentes de celles d'autres pays (médicaments disponibles, réglementation, prix, etc.).`;

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

    console.log('=== RÉPONSE BRUTE DE MISTRAL ===');
    console.log(JSON.stringify(data.outputs, null, 2));
    console.log('=== FIN RÉPONSE BRUTE ===');

    const rawContent = extractAssistantText(data.outputs);
    console.log('=== RAW CONTENT EXTRAIT ===');
    console.log(rawContent);
    console.log('=== FIN RAW CONTENT ===');

    const { content, questionnaire } = extractQuestionnaire(rawContent);
    const action = questionnaire ? null : parseAction(content);

    res.status(200).json({ content, action, questionnaire });
  } catch (error) {
    console.error('Erreur Mistral:', error.message);
    res.status(500).json({ error: 'Erreur lors de la requête à Mistral' });
  }
}

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

const ALLOWED_QUESTION_TYPES = new Set(['text', 'radio', 'checkbox', 'scale']);

function extractQuestionnaire(text) {
  console.log('🔍 extractQuestionnaire appelé avec:', text);
  
  if (typeof text !== 'string') {
    console.warn('❌ text n\'est pas une chaîne');
    return { content: text, questionnaire: null };
  }

  const marker = 'QUESTIONNAIRE:';
  const markerIdx = text.indexOf(marker);
  console.log(`🔍 Recherche du marqueur "${marker}" à l'index:`, markerIdx);
  
  if (markerIdx === -1) {
    console.warn('❌ Marqueur non trouvé');
    return { content: text, questionnaire: null };
  }

  console.log('✅ Marqueur trouvé');

  // Utiliser une regex pour capturer tout ce qui ressemble à un JSON entre accolades
  const jsonRegex = /QUESTIONNAIRE:\s*(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/s;
  const match = text.match(jsonRegex);
  
  if (!match) {
    console.warn('❌ Aucun JSON trouvé après le marqueur');
    return { content: text, questionnaire: null };
  }

  let jsonStr = match[1].trim();
  console.log('📄 JSON extrait par regex:', jsonStr);

  // Nettoyage : retirer les sauts de ligne, les espaces inutiles
  jsonStr = jsonStr.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ');
  
  // Réparer les guillemets et les virgules
  jsonStr = jsonStr
    .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":')
    .replace(/:\s*'([^']*)'/g, ':"$1"')
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    .replace(/\\"/g, '"'); // Remplacer les guillemets échappés

  console.log('📄 JSON après nettoyage:', jsonStr);

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
    console.log('✅ JSON parsé avec succès:', parsed);
  } catch (e) {
    console.warn('⚠️ Échec du parsing JSON:', e.message);
    console.warn('⚠️ Tentative de récupération...');
    
    // Dernière tentative : essayer de réparer manuellement
    try {
      // Remplacer les guillemets simples par des doubles
      const fixed = jsonStr.replace(/'/g, '"');
      parsed = JSON.parse(fixed);
      console.log('✅ Récupération réussie (guillemets simples corrigés):', parsed);
    } catch (e2) {
      console.error('❌ Échec définitif du parsing:', e2.message);
      console.error('❌ JSON incriminé:', jsonStr);
      return { content: text, questionnaire: null };
    }
  }

  const questionnaire = normalizeQuestionnaire(parsed);
  console.log('📋 Questionnaire normalisé:', questionnaire);
  
  if (!questionnaire) {
    console.warn('❌ Normalisation échouée');
    return { content: text, questionnaire: null };
  }

  // Nettoyer le contenu original en supprimant le marqueur et le JSON
  const beforeMarker = text.slice(0, markerIdx);
  const afterJson = text.slice(markerIdx + marker.length + match[1].length);
  const cleanedContent = (beforeMarker + afterJson).trim();
  console.log('🧹 Contenu nettoyé:', cleanedContent);
  
  return { content: cleanedContent, questionnaire };
}

function normalizeQuestionnaire(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.questions)) return null;

  const seenIds = new Set();
  const questions = [];

  for (const q of raw.questions) {
    if (!q || typeof q !== 'object') continue;
    const type = ALLOWED_QUESTION_TYPES.has(q.type) ? q.type : null;
    const label = typeof q.label === 'string' ? q.label.trim().slice(0, 300) : '';
    let id = typeof q.id === 'string' ? q.id.trim().slice(0, 60) : '';
    if (!type || !label) continue;
    if (!id) id = `q${questions.length + 1}`;
    if (seenIds.has(id)) id = `${id}_${questions.length + 1}`;
    seenIds.add(id);

    const question = { id, type, label };

    if (type === 'radio' || type === 'checkbox') {
      let options = Array.isArray(q.options)
        ? q.options.filter((o) => typeof o === 'string' && o.trim() !== '').map((o) => o.trim().slice(0, 120)).slice(0, 12)
        : [];
      // S'assurer qu'il y a au moins 2 options
      if (options.length < 2) {
        options = type === 'radio' ? ['Oui', 'Non'] : ['Option 1', 'Option 2'];
      }
      question.options = options;
    }

    if (type === 'scale') {
      let min = Number.isFinite(q.min) ? q.min : 0;
      let max = Number.isFinite(q.max) ? q.max : 10;
      if (max <= min) { min = 0; max = 10; }
      question.min = min;
      question.max = max;
    }

    questions.push(question);
    if (questions.length >= 8) break;
  }

  if (questions.length === 0) return null;

  const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 150) : 'Questionnaire patient';
  return { title, questions };
}

function parseAction(text) {
  const match = text.match(/ACTION:\s*(\w+)\s*(?:\|(.+))?/);
  if (!match) return null;
  const [, type, paramsStr] = match;

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