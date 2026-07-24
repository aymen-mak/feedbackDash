import { createTranscript, ExportReturnType } from 'discord-html-transcripts';

/**
 * Build a full HTML transcript of a channel and return it as a Buffer.
 * `limit: -1` fetches the entire channel history.
 */
export async function buildTranscript(channel, fileName) {
  return createTranscript(channel, {
    limit: -1,
    returnType: ExportReturnType.Buffer,
    filename: fileName,
    saveImages: false, // keep file small; images stay as links to Discord CDN
    poweredBy: false,
    footerText: 'Exported {number} message{s}',
  });
}
