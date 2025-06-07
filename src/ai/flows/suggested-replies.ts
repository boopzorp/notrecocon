'use server';

/**
 * @fileOverview Provides sentiment-based empathetic reply suggestions for daily notes.
 *
 * - generateSuggestedReplies - A function that generates suggested replies based on the sentiment of a note.
 * - SuggestedRepliesInput - The input type for the generateSuggestedReplies function.
 * - SuggestedRepliesOutput - The return type for the generateSuggestedReplies function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestedRepliesInputSchema = z.object({
  note: z.string().describe('The daily note to analyze for sentiment.'),
});
export type SuggestedRepliesInput = z.infer<typeof SuggestedRepliesInputSchema>;

const SuggestedRepliesOutputSchema = z.object({
  suggestedReplies: z
    .array(z.string())
    .describe('An array of suggested empathetic replies based on the note.'),
});
export type SuggestedRepliesOutput = z.infer<typeof SuggestedRepliesOutputSchema>;

export async function generateSuggestedReplies(input: SuggestedRepliesInput): Promise<SuggestedRepliesOutput> {
  return generateSuggestedRepliesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestedRepliesPrompt',
  input: {schema: SuggestedRepliesInputSchema},
  output: {schema: SuggestedRepliesOutputSchema},
  prompt: `You are a relationship expert specializing in empathetic communication.

  Based on the sentiment expressed in the following note, suggest three different replies that are supportive, caring, and thoughtful. 

  Note: {{{note}}}

  Format your response as a JSON array of strings.
  `,
});

const generateSuggestedRepliesFlow = ai.defineFlow(
  {
    name: 'generateSuggestedRepliesFlow',
    inputSchema: SuggestedRepliesInputSchema,
    outputSchema: SuggestedRepliesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
