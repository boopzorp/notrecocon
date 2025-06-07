
'use server';
/**
 * @fileOverview Provides a Genkit flow to extract song details (title and artist) from a Spotify track URL.
 *
 * - extractSongDetails - A function that takes a Spotify URL and returns the song title and artist.
 * - ExtractSongDetailsInput - The input type for the extractSongDetails function.
 * - ExtractSongDetailsOutput - The return type for the extractSongDetails function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractSongDetailsInputSchema = z.object({
  spotifyUrl: z.string().url().describe('The full Spotify track URL.'),
});
export type ExtractSongDetailsInput = z.infer<typeof ExtractSongDetailsInputSchema>;

const ExtractSongDetailsOutputSchema = z.object({
  songTitle: z.string().describe('The title of the song.'),
  songArtist: z.string().describe('The artist(s) of the song.'),
});
export type ExtractSongDetailsOutput = z.infer<typeof ExtractSongDetailsOutputSchema>;

export async function extractSongDetails(input: ExtractSongDetailsInput): Promise<ExtractSongDetailsOutput> {
  return extractSongDetailsFlow(input);
}

const extractSongDetailsFlow = ai.defineFlow(
  {
    name: 'extractSongDetailsFlow',
    inputSchema: ExtractSongDetailsInputSchema,
    outputSchema: ExtractSongDetailsOutputSchema,
  },
  async (input) => {
    const oEmbedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(input.spotifyUrl)}`;

    try {
      const response = await fetch(oEmbedUrl);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Spotify oEmbed request failed with status ${response.status}: ${errorText}`);
        throw new Error(`Failed to fetch song details from Spotify. Status: ${response.status}`);
      }

      const data = await response.json();

      const songTitle = data.title;
      const songArtist = data.author_name; // Spotify oEmbed uses author_name for artist

      if (!songTitle || !songArtist) {
        console.error('Spotify oEmbed response missing title or author_name:', data);
        throw new Error('Could not extract title or artist from Spotify response.');
      }

      return { songTitle, songArtist };
    } catch (error: any) {
      console.error('Error in extractSongDetailsFlow:', error);
      throw new Error(error.message || 'An unexpected error occurred while fetching song details.');
    }
  }
);
