import GoogleGenerativeAI from '@google/genai';
import type { QuestionAnswer, EnhancedPromptResult, ReferenceImage, OutputType } from '../types';

const API_KEY = process.env.API_KEY || process.env.GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error('GEMINI_API_KEY is not configured');
}

const genAI = new GoogleGenerativeAI(API_KEY);

export async function generateQuestions(basicPrompt: string): Promise<QuestionAnswer[]> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `Based on this basic image prompt idea: "${basicPrompt}"

Generate exactly 11 questions in Polish to help enhance this prompt. The first question should always be about artistic style. Each question should have 10 relevant options.

Return a JSON array with this exact structure:
[
  {
    "id": "q1",
    "questionText": "Jaki styl artystyczny preferujesz?",
    "options": ["Fotorealistyczny", "Malarstwo olejne", "Akwarela", "Cyfrowy", "Szkic ołówkiem", "Pop art", "Surrealizm", "Impresjonizm", "Minimalistyczny", "Abstrakcyjny"]
  }
]

Make sure all questions and options are in Polish. Focus on aspects like style, mood, lighting, composition, colors, details, etc.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Parse JSON response
    const questionsData = JSON.parse(response);
    
    return questionsData.map((q: any) => ({
      id: q.id,
      questionText: q.questionText,
      fullQuestionPrompt: JSON.stringify(q),
      answer: '',
      options: q.options || [],
      selectedOptions: []
    }));
  } catch (error) {
    console.error('Error generating questions:', error);
    throw new Error('Failed to generate questions');
  }
}

export async function generateEnhancedPrompt(
  basicPrompt: string, 
  questionAnswers: QuestionAnswer[], 
  subjectImage?: ReferenceImage | null
): Promise<EnhancedPromptResult> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const answersText = questionAnswers
      .map(qa => {
        const selected = qa.selectedOptions.length > 0 ? qa.selectedOptions.join(', ') : 'None selected';
        const notes = qa.answer ? `Notes: ${qa.answer}` : '';
        return `${qa.questionText}\nSelected: ${selected}\n${notes}`;
      })
      .join('\n\n');

    const prompt = `Create a high-quality English image generation prompt based on:

Basic idea: ${basicPrompt}

User preferences:
${answersText}

Generate:
1. Enhanced main prompt (detailed, professional, in English)
2. Negative prompt (what to avoid, in English)
3. 3-5 suggestions for further improvements (in English)

Return as JSON:
{
  "enhancedPrompt": "detailed prompt here",
  "negativePrompt": "negative prompt here",
  "suggestions": ["suggestion 1", "suggestion 2", ...]
}`;

    const parts = [{ text: prompt }];
    
    if (subjectImage) {
      parts.push({
        inlineData: {
          mimeType: subjectImage.mimeType,
          data: subjectImage.base64
        }
      } as any);
    }

    const result = await model.generateContent(parts);
    const response = result.response.text();
    
    const enhancedData = JSON.parse(response);
    
    return {
      enhancedPrompt: enhancedData.enhancedPrompt,
      negativePrompt: enhancedData.negativePrompt,
      suggestions: enhancedData.suggestions || [],
      outputTypeUsed: 'RASTER_PROMPT' as OutputType
    };
  } catch (error) {
    console.error('Error generating enhanced prompt:', error);
    throw new Error('Failed to generate enhanced prompt');
  }
}

export async function generateImageDescription(image: ReferenceImage): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `Analyze this image and create a detailed English description that could be used as a base for an image generation prompt. Focus on:
- Main subject/objects
- Style and artistic elements
- Colors and lighting
- Composition and mood
- Important details

Provide a concise but descriptive prompt in English.`;

    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: image.mimeType,
          data: image.base64
        }
      }
    ]);
    
    return result.response.text();
  } catch (error) {
    console.error('Error generating image description:', error);
    throw new Error('Failed to generate image description');
  }
}

export async function generateMagicPrompt(
  basicPrompt: string,
  aspectRatio: string,
  customWidth: string,
  customHeight: string,
  subjectImage?: ReferenceImage | null
): Promise<EnhancedPromptResult> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    let dimensionsText = '';
    if (aspectRatio !== 'auto') {
      if (aspectRatio === 'custom') {
        dimensionsText = `Dimensions: ${customWidth}x${customHeight}px`;
      } else {
        dimensionsText = `Aspect ratio: ${aspectRatio}`;
      }
    }

    const prompt = `Create a magical, highly detailed English image generation prompt based on: "${basicPrompt}"

${dimensionsText}

Transform this basic idea into a stunning, professional-quality prompt with:
- Rich artistic details
- Professional photography/art terminology
- Specific lighting and mood descriptions
- High-quality rendering specifications

Also provide:
- Negative prompt (what to avoid)
- 3-5 creative suggestions for variations

Return as JSON:
{
  "enhancedPrompt": "magical detailed prompt here",
  "negativePrompt": "negative prompt here",
  "suggestions": ["suggestion 1", "suggestion 2", ...]
}`;

    const parts = [{ text: prompt }];
    
    if (subjectImage) {
      parts.push({
        inlineData: {
          mimeType: subjectImage.mimeType,
          data: subjectImage.base64
        }
      } as any);
    }

    const result = await model.generateContent(parts);
    const response = result.response.text();
    
    const magicData = JSON.parse(response);
    
    return {
      enhancedPrompt: magicData.enhancedPrompt,
      negativePrompt: magicData.negativePrompt,
      suggestions: magicData.suggestions || [],
      outputTypeUsed: 'RASTER_PROMPT' as OutputType
    };
  } catch (error) {
    console.error('Error generating magic prompt:', error);
    throw new Error('Failed to generate magic prompt');
  }
}

export async function generateCopyImagePrompt(image: ReferenceImage): Promise<EnhancedPromptResult> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `Analyze this image in extreme detail and create a comprehensive English prompt that would recreate this image as closely as possible. Include:

- Exact description of all subjects/objects
- Precise artistic style and technique
- Detailed lighting setup and shadows
- Color palette and saturation
- Composition and framing
- Texture and material details
- Background elements
- Camera settings if photographic

Also provide:
- Negative prompt to avoid unwanted elements
- 3-5 suggestions for fine-tuning

Return as JSON:
{
  "enhancedPrompt": "extremely detailed recreation prompt here",
  "negativePrompt": "negative prompt here",
  "suggestions": ["suggestion 1", "suggestion 2", ...]
}`;

    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: image.mimeType,
          data: image.base64
        }
      }
    ]);
    
    const response = result.response.text();
    const copyData = JSON.parse(response);
    
    return {
      enhancedPrompt: copyData.enhancedPrompt,
      negativePrompt: copyData.negativePrompt,
      suggestions: copyData.suggestions || [],
      outputTypeUsed: 'RASTER_PROMPT' as OutputType
    };
  } catch (error) {
    console.error('Error generating copy image prompt:', error);
    throw new Error('Failed to generate copy image prompt');
  }
}

export async function generateStyleInfluencePrompt(
  basicPrompt: string,
  styleImage: ReferenceImage,
  subjectImage?: ReferenceImage | null,
  aspectRatio?: string,
  customWidth?: string,
  customHeight?: string
): Promise<EnhancedPromptResult> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    let dimensionsText = '';
    if (aspectRatio && aspectRatio !== 'auto') {
      if (aspectRatio === 'custom' && customWidth && customHeight) {
        dimensionsText = `Dimensions: ${customWidth}x${customHeight}px`;
      } else {
        dimensionsText = `Aspect ratio: ${aspectRatio}`;
      }
    }

    const prompt = `Create an English image generation prompt that combines:

Subject/Theme: ${basicPrompt}
${dimensionsText}

Analyze the style reference image and apply its artistic characteristics to the subject. Focus on:
- Artistic technique and medium
- Color palette and mood
- Lighting style
- Brushwork or rendering technique
- Overall aesthetic approach

Create a detailed prompt that merges the subject with the reference style.

Also provide:
- Negative prompt
- 3-5 creative variations

Return as JSON:
{
  "enhancedPrompt": "style-influenced prompt here",
  "negativePrompt": "negative prompt here",
  "suggestions": ["suggestion 1", "suggestion 2", ...]
}`;

    const parts = [{ text: prompt }];
    
    // Add style reference image
    parts.push({
      inlineData: {
        mimeType: styleImage.mimeType,
        data: styleImage.base64
      }
    } as any);
    
    // Add subject image if provided
    if (subjectImage) {
      parts.push({
        inlineData: {
          mimeType: subjectImage.mimeType,
          data: subjectImage.base64
        }
      } as any);
    }

    const result = await model.generateContent(parts);
    const response = result.response.text();
    
    const styleData = JSON.parse(response);
    
    return {
      enhancedPrompt: styleData.enhancedPrompt,
      negativePrompt: styleData.negativePrompt,
      suggestions: styleData.suggestions || [],
      outputTypeUsed: 'RASTER_PROMPT' as OutputType
    };
  } catch (error) {
    console.error('Error generating style influence prompt:', error);
    throw new Error('Failed to generate style influence prompt');
  }
}

export async function refineEditedPrompt(
  editedPrompt: string,
  originalBasicPrompt: string,
  questionAnswers: QuestionAnswer[],
  subjectImage?: ReferenceImage | null
): Promise<EnhancedPromptResult> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const answersContext = questionAnswers
      .map(qa => {
        const selected = qa.selectedOptions.length > 0 ? qa.selectedOptions.join(', ') : 'None';
        const notes = qa.answer ? `Notes: ${qa.answer}` : '';
        return `${qa.questionText}: ${selected} ${notes}`;
      })
      .join('\n');

    const prompt = `Refine and improve this edited prompt while maintaining the user's intent:

Edited Prompt: ${editedPrompt}

Original Context:
- Basic idea: ${originalBasicPrompt}
- User preferences: ${answersContext}

Improve the edited prompt by:
- Fixing any grammar or clarity issues
- Enhancing technical terminology
- Maintaining the user's creative vision
- Adding professional quality specifications

Provide:
- Refined enhanced prompt
- Updated negative prompt
- 3-5 suggestions for further refinement

Return as JSON:
{
  "enhancedPrompt": "refined prompt here",
  "negativePrompt": "negative prompt here",
  "suggestions": ["suggestion 1", "suggestion 2", ...]
}`;

    const parts = [{ text: prompt }];
    
    if (subjectImage) {
      parts.push({
        inlineData: {
          mimeType: subjectImage.mimeType,
          data: subjectImage.base64
        }
      } as any);
    }

    const result = await model.generateContent(parts);
    const response = result.response.text();
    
    const refinedData = JSON.parse(response);
    
    return {
      enhancedPrompt: refinedData.enhancedPrompt,
      negativePrompt: refinedData.negativePrompt,
      suggestions: refinedData.suggestions || [],
      outputTypeUsed: 'RASTER_PROMPT' as OutputType
    };
  } catch (error) {
    console.error('Error refining edited prompt:', error);
    throw new Error('Failed to refine edited prompt');
  }
}