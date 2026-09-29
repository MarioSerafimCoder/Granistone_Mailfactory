export type ImageSlot = 'hero' | 'application';

export async function prepareImage(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type))
    throw new Error('Escolha uma imagem JPG, PNG, WebP ou GIF.');
  if (file.size > 20_000_000) throw new Error('Escolha uma imagem de até 20 MB.');
  const read = () => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível ler este arquivo.'));
    reader.readAsDataURL(file);
  });
  if (file.type === 'image/gif') {
    if (file.size > 1_000_000) throw new Error('Para preservar a animação, use um GIF de até 1 MB.');
    return read();
  }
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('O navegador não conseguiu preparar a imagem.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    // Keep small originals, including transparent PNGs. Larger photos become compact JPEGs.
    if (file.size <= 450_000 && scale === 1) return read();
    context.globalCompositeOperation = 'destination-over';
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (const quality of [0.86, 0.72, 0.58]) {
      const result = canvas.toDataURL('image/jpeg', quality);
      if (result.length < 750_000) return result;
    }
    const compact = document.createElement('canvas');
    compact.width = Math.round(canvas.width * 0.65);
    compact.height = Math.round(canvas.height * 0.65);
    compact.getContext('2d')!.drawImage(canvas, 0, 0, compact.width, compact.height);
    return compact.toDataURL('image/jpeg', 0.65);
  } catch (error) {
    throw new Error(error instanceof Error && error.message.includes('navegador')
      ? error.message : 'Não foi possível abrir a imagem. Tente outro JPG ou PNG.');
  } finally {
    URL.revokeObjectURL(source);
  }
}
