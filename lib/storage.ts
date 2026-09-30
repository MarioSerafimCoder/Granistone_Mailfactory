import { defaultBrand } from '@/data/brand';
import { demoCampaigns } from '@/data/demo';
import { emptyContent } from '@/campaigns/model';
import { templates, getTemplate } from '@/templates/registry';
import { campaignTypes, statuses, type BrandSettings, type Campaign } from '@/types/campaign';

export const STORAGE_KEY = 'granistone-mail-studio:v2';
export const LEGACY_STORAGE_KEY = 'granistone-mail-studio:v1';
const RECOVERY_KEY = 'granistone-mail-studio:pending';

export interface StudioData {
  version: 2;
  campaigns: Campaign[];
  brand: BrandSettings;
}

type ImageReference = { id: string; language: 'pt' | 'en' | 'es'; field: 'heroImage' | 'applicationImage' };

/** A small synchronous journal protects the last debounce interval during reload.
 * Photos already committed in IndexedDB are referenced, not copied into localStorage. */
export function saveRecovery(next: StudioData, committed: StudioData | null) {
  const references: ImageReference[] = [];
  const campaigns = next.campaigns.map((campaign) => {
    const previous = committed?.campaigns.find((item) => item.id === campaign.id);
    const content = { pt: { ...campaign.content.pt }, en: { ...campaign.content.en }, es: { ...campaign.content.es } };
    for (const language of ['pt', 'en', 'es'] as const) {
      for (const field of ['heroImage', 'applicationImage'] as const) {
        if (content[language][field].startsWith('data:') && content[language][field] === previous?.content[language][field]) {
          references.push({ id: campaign.id, language, field });
          content[language][field] = '';
        }
      }
    }
    return { ...campaign, content };
  });
  localStorage.setItem(RECOVERY_KEY, JSON.stringify({ data: { ...next, campaigns }, references }));
}

export function clearRecovery() { localStorage.removeItem(RECOVERY_KEY); }

function recover(base: StudioData): StudioData {
  const raw = localStorage.getItem(RECOVERY_KEY);
  if (!raw) return base;
  const pending = JSON.parse(raw) as { data: StudioData; references: ImageReference[] };
  const recovered = decodeBackup(JSON.stringify(pending.data));
  for (const reference of pending.references) {
    const target = recovered.campaigns.find((campaign) => campaign.id === reference.id);
    const source = base.campaigns.find((campaign) => campaign.id === reference.id);
    if (target && source) target.content[reference.language][reference.field] = source.content[reference.language][reference.field];
  }
  return recovered;
}

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

function validRich(value: unknown, depth = 0): boolean {
  return (
    depth < 25 &&
    record(value) &&
    typeof value.type === 'string' &&
    (value.text === undefined || typeof value.text === 'string') &&
    (value.content === undefined ||
      (Array.isArray(value.content) &&
        value.content.length <= 500 &&
        value.content.every((node) => validRich(node, depth + 1)))) &&
    (value.marks === undefined ||
      (Array.isArray(value.marks) &&
        value.marks.every(
          (mark) =>
            record(mark) && typeof mark.type === 'string' && (!mark.attrs || record(mark.attrs)),
        )))
  );
}

export function isCampaign(value: unknown): value is Campaign {
  if (
    !record(value) ||
    !['id', 'title', 'date', 'audience', 'objective', 'notes', 'updatedAt'].every(
      (key) => typeof value[key] === 'string',
    ) ||
    !campaignTypes.includes(value.campaignType as Campaign['campaignType']) ||
    !statuses.includes(value.status as Campaign['status']) ||
    !templates.some((template) => template.id === value.template) ||
    !['PT', 'EN', 'ES', 'PT / EN', 'PT / ES', 'EN / ES', 'PT / EN / ES'].includes(String(value.language)) ||
    !['left', 'center'].includes(String(value.alignment))
  )
    return false;
  if (
    !record(value.content) ||
    !['pt', 'en'].every((language) => {
      const content = (value.content as Record<string, unknown>)[language];
      return (
        record(content) &&
        Object.keys(emptyContent()).every((key) =>
          key === 'body' ? validRich(content.body) : typeof content[key] === 'string',
        )
      );
    })
  )
    return false;
  const allowed = getTemplate(value.template as Campaign['template']).blocks;
  return (
    Array.isArray(value.blocks) &&
    value.blocks.length > 0 &&
    value.blocks.length <= allowed.length &&
    new Set(value.blocks.map((block) => (record(block) ? block.id : undefined))).size ===
      value.blocks.length &&
    value.blocks.every(
      (block) =>
        record(block) &&
        allowed.includes(block.id as (typeof allowed)[number]) &&
        typeof block.enabled === 'boolean',
    )
  );
}

export function isBrand(value: unknown): value is BrandSettings {
  return record(value) && Object.keys(defaultBrand).every((key) => typeof value[key] === 'string') && (value.unsubscribeMode === undefined || ['link', 'rd-managed'].includes(String(value.unsubscribeMode)));
}

function migrateBrand(value: unknown, legacy: boolean): BrandSettings {
  if (!record(value)) throw new Error('Configuração de marca inválida.');
  const migrated = { ...defaultBrand, ...value };
  if (legacy) {
    for (const key of ['facebook', 'instagram', 'website', 'whatsapp'] as const)
      if (!String(migrated[key]).trim()) migrated[key] = defaultBrand[key];
  }
  if (!isBrand(migrated)) throw new Error('Configuração de marca inválida.');
  return migrated;
}

export function decodeBackup(text: string): StudioData {
  const value: unknown = JSON.parse(text);
  if (
    !record(value) ||
    ![1, 2].includes(Number(value.version)) ||
    !Array.isArray(value.campaigns) ||
    !value.campaigns.every(isCampaign)
  )
    throw new Error('Arquivo de backup inválido ou versão incompatível.');
  if (new Set(value.campaigns.map((campaign) => campaign.id)).size !== value.campaigns.length)
    throw new Error('O backup contém identificadores duplicados.');
  return {
    version: 2,
    campaigns: value.campaigns.map((campaign) => {
      const missing = getTemplate(campaign.template).blocks.filter(
        (id) => !campaign.blocks.some((block) => block.id === id),
      );
      // Preserve existing layouts; new image slots are optional in saved campaigns.
      return {
        ...campaign,
        content: { ...campaign.content, es: campaign.content.es ?? emptyContent() },
        blocks: [...campaign.blocks, ...missing.map((id) => ({ id, enabled: false }))],
      };
    }),
    brand: migrateBrand(value.brand, Number(value.version) === 1),
  };
}

let connection: IDBDatabase | undefined;
let opening: Promise<IDBDatabase> | undefined;
function database(): Promise<IDBDatabase> {
  if (connection) return Promise.resolve(connection);
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const request = indexedDB.open('granistone-mail-studio', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('workspace');
    request.onsuccess = () => {
      connection = request.result;
      connection.onversionchange = () => { connection?.close(); connection = undefined; opening = undefined; };
      resolve(connection);
    };
    request.onerror = () => { opening = undefined; reject(request.error); };
    request.onblocked = () => reject(new Error('Feche outras abas do Studio e tente novamente.'));
  });
  return opening;
}

export async function loadStudio(): Promise<StudioData> {
  const db = await database();
  const current = await new Promise<StudioData | undefined>((resolve, reject) => {
    const transaction = db.transaction('workspace', 'readonly');
    const request = transaction.objectStore('workspace').get('studio');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.onabort = () => reject(transaction.error);
  });
  if (current) return recover(decodeBackup(JSON.stringify(current)));
  const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
  return recover(saved
    ? decodeBackup(saved)
    : { version: 2, campaigns: demoCampaigns(), brand: defaultBrand });
}

export function persistStudio(data: StudioData): Promise<void> {
  const write = (db: IDBDatabase) => new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('workspace', 'readwrite');
    transaction.objectStore('workspace').put({ ...data, version: 2 }, 'studio');
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
  // An open connection lets pagehide begin the final transaction synchronously.
  return connection ? write(connection) : database().then(write);
}
