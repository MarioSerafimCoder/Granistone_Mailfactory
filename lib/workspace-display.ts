export function editorName(email?: string | null) {
  if (!email) return 'Usuário da equipe';
  const first = email.split('@')[0].split(/[._+-]/)[0];
  return first ? first.charAt(0).toLocaleUpperCase('pt-BR') + first.slice(1) : 'Usuário da equipe';
}
export function activityTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
export function relativeTime(value?: string | null) {
  if (!value) return '';
  const delta = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(delta)) return '';
  const minutes = Math.max(0, Math.floor(delta / 60000));
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `em ${new Date(value).toLocaleDateString('pt-BR')}`;
}
