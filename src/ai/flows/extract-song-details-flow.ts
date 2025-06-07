
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
    let responseDataText = ''; // To store response text for logging
    let cleanedSpotifyUrl = input.spotifyUrl;

    try {
      // Attempt to parse the URL and remove query parameters
      const parsedUrl = new URL(input.spotifyUrl);
      cleanedSpotifyUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.pathname}`;
    } catch (urlParseError) {
      // If URL parsing fails, log it but proceed with the original URL
      // This might happen if the URL is already malformed, though Zod validation should catch most.
      console.warn(`Could not parse and clean Spotify URL: ${input.spotifyUrl}. Error: ${urlParseError}. Proceeding with original URL.`);
    }
    
    const oEmbedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(cleanedSpotifyUrl)}`;

    try {
      const response = await fetch(oEmbedUrl);
      responseDataText = await response.text(); // Get text for logging regardless of status

      if (!response.ok) {
        console.error(`Spotify oEmbed request failed with status ${response.status} ${response.statusText}. URL: ${oEmbedUrl}. Original Input URL: ${input.spotifyUrl}. Cleaned URL: ${cleanedSpotifyUrl}. Response: ${responseDataText}`);
        throw new Error(`Failed to fetch song details from Spotify. Status: ${response.status}`);
      }

      let data: any;
      try {
        data = JSON.parse(responseDataText);
      } catch (jsonParseError: any) {
        console.error('Failed to parse Spotify oEmbed response as JSON. URL:', oEmbedUrl, 'Raw Response:', responseDataText, 'Error:', jsonParseError);
        throw new Error('Spotify oEmbed response was not valid JSON.');
      }
      
      // Log the parsed data immediately to see its structure
      console.log('Parsed Spotify oEmbed data:', JSON.stringify(data, null, 2));

      const songTitle = data.title;
      const songArtist = data.author_name; // Spotify oEmbed uses author_name for artist

      if (!songTitle || !songArtist || typeof songTitle !== 'string' || typeof songArtist !== 'string' || songTitle.trim() === '' || songArtist.trim() === '') {
        console.error(
          'Spotify oEmbed response missing title or artist, or they are not non-empty strings. Keys in data:', Object.keys(data),
          'Original Input URL:', input.spotifyUrl, 
          'Cleaned URL for oEmbed:', cleanedSpotifyUrl, 
          'Raw Response:', responseDataText, 
          'Parsed Data:', JSON.stringify(data, null, 2)
        );
        throw new Error('Could not extract title or artist from Spotify response. Please ensure the link is a valid Spotify track URL.');
      }

      return { songTitle, songArtist };
    } catch (error: any) {
      console.error('Error in extractSongDetailsFlow. Original Input URL:', input.spotifyUrl, 'Cleaned URL for oEmbed:', cleanedSpotifyUrl, 'oEmbed URL:', oEmbedUrl, 'Raw Response Text (if available):', responseDataText, 'Error:', error);
      // Re-throw a specific message or the original one.
      if (error.message.startsWith('Could not extract') || error.message.startsWith('Failed to fetch') || error.message.startsWith('Spotify oEmbed response was not valid JSON')) {
        throw error;
      }
      throw new Error('An unexpected error occurred while fetching song details.');
    }
  }
);

