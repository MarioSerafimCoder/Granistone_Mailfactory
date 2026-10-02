'use client';
import { useState } from 'react';
import type { BrandSettings as Brand } from '@/types/campaign';
import { Field, Modal } from './ui';
export function BrandSettings({
  brand,
  onSave,
  onClose,
}: {
  brand: Brand;
  onSave: (b: Brand) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(brand);
  const field = (key: keyof Brand, label: string, hint?: string) => (
    <Field
      label={label}
      hint={hint}
      value={value[key]}
      onChange={(e) => setValue({ ...value, [key]: e.target.value })}
    />
  );
  return (
    <Modal title="Marca e rodapé" onClose={onClose} wide>
      <p className="muted">
        Estas configurações são usadas por toda a equipe, em todos os templates e idiomas.
      </p>
      <p className="settings-impact">Ao salvar, novos previews e publicações usarão estas alterações. Versões já publicadas permanecem intactas.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(value);
          onClose();
        }}
      >
        <div className="settings-grid">
          <section>
            <h3>Identidade</h3>
            {field('brandName', 'Nome da marca')}
            {field('email', 'E-mail institucional')}
            <h3>Imagens para envio</h3>
            {field(
              'assetBaseUrl',
              'Endereço público dos arquivos',
              'Ex.: domínio HTTPS do aplicativo publicado. Deve servir os arquivos da pasta /brand.',
            )}
            {field(
              'logoUrl',
              'URL pública da logo (opcional)',
              'Sem este campo, usa /brand/granistone-logo.png no endereço acima.',
            )}
            <div className="brand-preview">
              <img src="/brand/granistone-logo.png" alt="Logo Granistone fornecida" />
            </div>
            <p className="muted">
              A logo original está incluída no projeto. Os arquivos locais aparecem no preview; o
              e-mail enviado precisa de imagens hospedadas publicamente.
            </p>
          </section>
          <section>
            <h3>Links do rodapé</h3>
            {field('facebook', 'Facebook')}
            {field('instagram', 'Instagram')}
            {field('website', 'Site')}
            {field('whatsapp', 'WhatsApp')}
            <h3>Descadastro</h3>
            <p className="muted">
              O link oficial da Granistone já é aplicado automaticamente em todos os e-mails.
            </p>
            {field('address', 'Endereço')}
            {field('phone', 'Telefone exibido')}
          </section>
        </div>
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="button primary">
            Salvar configurações
          </button>
        </div>
      </form>
    </Modal>
  );
}
