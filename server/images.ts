import { PhotonImage, resize, SamplingFilter } from '@cf-wasm/photon';
import { imageSize } from 'image-size';
import { HttpError } from './platform';
export const MAX_UPLOAD = 8_000_000;
export function optimizeImage(bytes: Uint8Array, mime: string, fileName: string) {
  if (bytes.length > MAX_UPLOAD) throw new HttpError(413, 'A imagem deve ter até 8 MB.');
  if (!bytes.length || /[/\\\u0000]/.test(fileName)) throw new HttpError(400, 'Arquivo inválido.');
  let dimensions;
  try { dimensions = imageSize(bytes); } catch { throw new HttpError(400, 'Imagem inválida ou corrompida.'); }
  const actual = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[dimensions.type || ''];
  const ext = fileName.toLowerCase().split('.').pop();
  if (!actual || actual !== mime || !({ 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/webp': ['webp'] }[actual]?.includes(ext!)))
    throw new HttpError(400, 'MIME, extensão e conteúdo devem corresponder a JPG, PNG ou WebP. GIF animado ainda não é aceito online.');
  if (!dimensions.width || !dimensions.height || dimensions.width * dimensions.height > 4_000_000 || Math.max(dimensions.width, dimensions.height) > 8000)
    throw new HttpError(400, 'Imagem acima de 4 megapixels. Use a otimização do editor antes de enviar.');
  // Do not silently flatten animated formats.
  const markers = new TextDecoder('latin1').decode(bytes);
  if ((actual === 'image/webp' && markers.includes('ANIM')) || (actual === 'image/png' && markers.includes('acTL')))
    throw new HttpError(400, 'Imagens animadas não são aceitas neste upload.');
  let input: PhotonImage | undefined; let output: PhotonImage | undefined;
  try {
    input = PhotonImage.new_from_byteslice(bytes);
    const scale = Math.min(1, 1600 / Math.max(input.get_width(), input.get_height()));
    output = resize(input, Math.max(1, Math.round(input.get_width() * scale)), Math.max(1, Math.round(input.get_height() * scale)), SamplingFilter.Triangle);
    const mimeType = actual === 'image/jpeg' ? 'image/jpeg' : 'image/png';
    const optimized = mimeType === 'image/jpeg' ? output.get_bytes_jpeg(85) : output.get_bytes();
    if (optimized.length > MAX_UPLOAD) throw new HttpError(413, 'Imagem otimizada acima do limite.');
    return { bytes: optimized, width: output.get_width(), height: output.get_height(), mimeType, fileSize: optimized.length };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Não foi possível decodificar a imagem.');
  } finally { output?.free(); input?.free(); }
}
