
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [googleAI()],
  // The default model for googleAI plugin is 'gemini-pro'.
  // Specific models should be set in ai.generate() calls or within ai.definePrompt() if needed.
});

