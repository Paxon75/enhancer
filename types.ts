export enum AppState {
  INITIAL = 'INITIAL',
  GENERATING_DESCRIPTION = 'GENERATING_DESCRIPTION',
  GENERATING_QUESTIONS = 'GENERATING_QUESTIONS',
  ASKING_QUESTIONS = 'ASKING_QUESTIONS',
  GENERATING_ENHANCEMENT = 'GENERATING_ENHANCEMENT',
  SHOWING_RESULTS = 'SHOWING_RESULTS',
  ERROR = 'ERROR',
  GENERATING_MAGIC_PROMPT = 'GENERATING_MAGIC_PROMPT',
  GENERATING_COPY_PROMPT = 'GENERATING_COPY_PROMPT',
  // GENERATING_PRODUCT_PHOTO_PROMPT = 'GENERATING_PRODUCT_PHOTO_PROMPT', // Removed
  GENERATING_STYLE_INFLUENCE_PROMPT = 'GENERATING_STYLE_INFLUENCE_PROMPT', // Added for new feature
  GENERATING_REFINEMENT = 'GENERATING_REFINEMENT', // Added for editing/refining prompt
}

export enum OutputType {
  RASTER_PROMPT = 'RASTER_PROMPT', // Prompt for generating raster images (e.g., PNG, JPG)
}

export interface QuestionAnswer {
  id: string;
  questionText: string; // The main text of the question, now directly from AI
  // fullQuestionPrompt is less critical if questionText is clean and options are separate.
  // It could store the original AI object for the question if needed for debugging.
  fullQuestionPrompt: string; // Can store the original raw question object string from AI for context/debugging
  answer: string; // For custom text input / additional notes for each question
  options: string[]; // Dynamically generated suggested options from AI (now 10 options)
  selectedOptions: string[]; // Selected checkbox options
}

export interface EnhancedPromptResult {
  enhancedPrompt: string; // Can be a raster prompt
  negativePrompt: string;
  suggestions: string[];
  outputTypeUsed: OutputType; // To know what kind of content enhancedPrompt holds (will always be RASTER_PROMPT)
}

export interface ReferenceImage {
  base64: string;
  mimeType: string;
}