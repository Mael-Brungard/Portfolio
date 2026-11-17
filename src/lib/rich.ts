/** **gras** → <strong> (mise en valeur dorée) et \n → <br>. Contenu statique et de confiance. */
export const rich = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
