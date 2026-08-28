// Copiez ce fichier en "config.local.js" (déjà ignoré par git, voir .gitignore)
// et renseignez-y votre/vos email(s) de super admin.
// Ce fichier n'est PAS envoyé à Anthropic ni à un serveur : il reste sur votre machine
// et n'est jamais poussé sur GitHub. Attention cependant : comme cette application est
// 100% client (React + Firebase SDK, sans backend), cette valeur finit tout de même
// dans le code JavaScript livré au navigateur lors du build — elle n'est donc pas un
// secret à l'exécution, seulement hors du dépôt de code source.
// La vraie protection contre une élévation de privilège malveillante doit être faite
// dans les règles de sécurité Firestore (voir le message associé à cette livraison).

export const SUPER_ADMIN_EMAILS = [
  // 'votre.email@exemple.com',
];
