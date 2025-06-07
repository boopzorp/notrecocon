
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
    let responseDataText = ''; // To store response text for logging

    try {
      const response = await fetch(oEmbedUrl);
      responseDataText = await response.text(); // Get text for logging regardless of status

      if (!response.ok) {
        console.error(`Spotify oEmbed request failed with status ${response.status}. URL: ${oEmbedUrl}. Response: ${responseDataText}`);
        throw new Error(`Failed to fetch song details from Spotify. Status: ${response.status}`);
      }

      const data = JSON.parse(responseDataText); // Parse the text we already fetched

      const songTitle = data.title;
      const songArtist = data.author_name; // Spotify oEmbed uses author_name for artist

      if (!songTitle || !songArtist) {
        console.error('Spotify oEmbed response missing title or author_name. URL:', input.spotifyUrl, 'Raw Response:', responseDataText, 'Parsed Data:', JSON.stringify(data, null, 2));
        throw new Error('Could not extract title or artist from Spotify response. Please ensure the link is a valid Spotify track URL.');
      }

      return { songTitle, songArtist };
    } catch (error: any) {
      console.error('Error in extractSongDetailsFlow. URL:', input.spotifyUrl, 'oEmbed URL:', oEmbedUrl, 'Raw Response Text (if available):', responseDataText, 'Error:', error);
      // Re-throw a generic message or the specific one from above.
      if (error.message.startsWith('Could not extract') || error.message.startsWith('Failed to fetch')) {
        throw error;
      }
      throw new Error('An unexpected error occurred while fetching song details.');
    }
  }
);

