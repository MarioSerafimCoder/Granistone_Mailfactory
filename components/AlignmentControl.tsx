'use client';
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import type { ContentAlignment } from '@/types/campaign';

const choices = [
  { value: 'left', label: 'Alinhar à esquerda', Icon: AlignLeft },
  { value: 'center', label: 'Centralizar', Icon: AlignCenter },
  { value: 'right', label: 'Alinhar à direita', Icon: AlignRight },
] as const;

export default function AlignmentControl({ value, onChange, label = 'Alinhamento' }: {
  value: ContentAlignment; onChange: (value: ContentAlignment) => void; label?: string;
}) {
  return <div className="alignment-field"><span>{label}</span><div className="alignment-control" role="group" aria-label={label}>
    {choices.map(({ value: option, label: name, Icon }) => <button key={option} type="button" title={name} aria-label={name}
      aria-pressed={value === option} className={value === option ? 'active' : ''} onClick={() => onChange(option)}><Icon size={17} /></button>)}
  </div></div>;
}
