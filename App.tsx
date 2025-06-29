import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { AppState, OutputType } from './types';
import type { QuestionAnswer, EnhancedPromptResult, ReferenceImage } from './types';
import { 
  generateQuestions, 
  generateEnhancedPrompt, 
  generateImageDescription, 
  generateMagicPrompt, 
  generateCopyImagePrompt,
  generateStyleInfluencePrompt,
  refineEditedPrompt
} from './services/geminiService';
import TextInput, { TextArea } from './components/TextInput';
import Button from './components/Button';
import LoadingSpinner from './components/LoadingSpinner.tsx';

const MAX_IMAGE_SIZE_MB = 5;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const IPHONE_14_WALLPAPER_OPTION_VALUE = "iphone_14_14pro_wallpaper";
const NUMBER_OF_QUESTIONS_TO_ASK = 11;

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.INITIAL);
  const [basicPrompt, setBasicPrompt] = useState<string>('');
  const [questionAnswers, setQuestionAnswers] = useState<QuestionAnswer[]>([]);
  const [enhancedResult, setEnhancedResult] = useState<EnhancedPromptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyExists, setApiKeyExists] = useState<boolean>(false);
  
  const [copiedEnhancedPrompt, setCopiedEnhancedPrompt] = useState<boolean>(false);
  const [copiedNegativePrompt, setCopiedNegativePrompt] = useState<boolean>(false);
  const [copiedSuggestionIndex, setCopiedSuggestionIndex] = useState<number | null>(null);

  const [subjectReferenceImageFile, setSubjectReferenceImageFile] = useState<File | null>(null);
  const [subjectReferenceImagePreview, setSubjectReferenceImagePreview] = useState<string | null>(null);
  const subjectFileInputRef = useRef<HTMLInputElement>(null);

  const [styleReferenceImageFile, setStyleReferenceImageFile] = useState<File | null>(null);
  const [styleReferenceImagePreview, setStyleReferenceImagePreview] = useState<string | null>(null);
  const styleFileInputRef = useRef<HTMLInputElement>(null);

  const [outputAspectRatio, setOutputAspectRatio] = useState<string>('auto');
  const [outputCustomWidth, setOutputCustomWidth] = useState<string>('');
  const [outputCustomHeight, setOutputCustomHeight] = useState<string>('');

  const [isEditingEnhancedPrompt, setIsEditingEnhancedPrompt] = useState<boolean>(false);
  const [editedEnhancedPromptText, setEditedEnhancedPromptText] = useState<string>('');


  useEffect(() => {
    if (process.env.API_KEY && process.env.API_KEY !== "MISSING_API_KEY" && process.env.API_KEY.length > 10) { 
      setApiKeyExists(true);
    } else {
      const apiKeyError = "Klucz API Gemini nie jest skonfigurowany lub jest nieprawidłowy. Upewnij się, że zmienna środowiskowa API_KEY jest poprawnie ustawiona w pliku .env lub w konfiguracji środowiska wdrożenia. Aplikacja nie może działać bez ważnego klucza API.";
      setError(apiKeyError);
      setAppState(AppState.ERROR);
      console.error(apiKeyError);
    }
  }, []);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>, imageType: 'subject' | 'style') => {
    const file = event.target.files?.[0];
    if (file) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setError(`Nieprawidłowy format pliku (${file.name}). Dozwolone formaty: JPG, PNG, WEBP.`);
        if (imageType === 'subject') {
            setSubjectReferenceImageFile(null); setSubjectReferenceImagePreview(null);
        } else {
            setStyleReferenceImageFile(null); setStyleReferenceImagePreview(null);
        }
        return;
      }
      if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
        setError(`Plik ${file.name} jest zbyt duży. Maksymalny rozmiar to ${MAX_IMAGE_SIZE_MB}MB.`);
         if (imageType === 'subject') {
            setSubjectReferenceImageFile(null); setSubjectReferenceImagePreview(null);
        } else {
            setStyleReferenceImageFile(null); setStyleReferenceImagePreview(null);
        }
        return;
      }
      setError(null); 
      const reader = new FileReader();
      reader.onloadend = () => {
        if (imageType === 'subject') {
            setSubjectReferenceImageFile(file);
            setSubjectReferenceImagePreview(reader.result as string);
        } else {
            setStyleReferenceImageFile(file);
            setStyleReferenceImagePreview(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const clearReferenceImage = (imageType: 'subject' | 'style') => {
    if (imageType === 'subject') {
        setSubjectReferenceImageFile(null);
        setSubjectReferenceImagePreview(null);
        if (subjectFileInputRef.current) subjectFileInputRef.current.value = ""; 
    } else {
        setStyleReferenceImageFile(null);
        setStyleReferenceImagePreview(null);
        if (styleFileInputRef.current) styleFileInputRef.current.value = "";
    }
    setError(null); 
  };

  const handleGenerateDescriptionFromImage = useCallback(async () => {
    if (!subjectReferenceImageFile) {
      setError("Najpierw prześlij obraz (Temat/Obiekt), aby wygenerować jego opis.");
      return;
    }
    setError(null);
    setAppState(AppState.GENERATING_DESCRIPTION);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(subjectReferenceImageFile);
      });
      const imagePayload: ReferenceImage = {
        base64,
        mimeType: subjectReferenceImageFile.type
      };
      
      const description = await generateImageDescription(imagePayload); // This will be English
      setBasicPrompt(description); // basicPrompt is now English
      setAppState(AppState.INITIAL); 
      setError(null); 
    } catch (err) {
      console.error("Error generating image description:", err);
      setError((err as Error).message || "Nie udało się wygenerować opisu obrazu. Sprawdź konsolę.");
      setAppState(AppState.INITIAL); 
    }
  }, [subjectReferenceImageFile]);

  const handleBasicPromptSubmit = useCallback(async () => {
    if (!basicPrompt.trim()) {
      setError("Proszę wpisać podstawowy pomysł na prompt lub wygenerować go z obrazu tematu.");
      return;
    }
    setError(null);
    setAppState(AppState.GENERATING_QUESTIONS);
    try {
      // basicPrompt can be English (if from image desc) or Polish (if typed by user)
      // generateQuestions is designed to handle this and produce Polish questions
      const newQuestionAnswers = await generateQuestions(basicPrompt); 
      
      if (newQuestionAnswers.length !== NUMBER_OF_QUESTIONS_TO_ASK) {
          console.error(`Otrzymano ${newQuestionAnswers.length} pytań, oczekiwano ${NUMBER_OF_QUESTIONS_TO_ASK}.`);
          throw new Error(`Niespodziewana liczba pytań od AI. Otrzymano ${newQuestionAnswers.length}, oczekiwano ${NUMBER_OF_QUESTIONS_TO_ASK}.`);
      }

      setQuestionAnswers(newQuestionAnswers);
      setAppState(AppState.ASKING_QUESTIONS);
    } catch (err) {
      console.error(err);
      setError((err as Error).message || `Nie udało się wygenerować ${NUMBER_OF_QUESTIONS_TO_ASK} pytań. Sprawdź konsolę, aby uzyskać więcej szczegółów.`);
      setAppState(AppState.ERROR);
    }
  }, [basicPrompt]);

  const handleAnswerChange = (questionId: string, answer?: string, selectedOption?: string, isChecked?: boolean) => {
    setQuestionAnswers(prevQAs =>
      prevQAs.map(qa => {
        if (qa.id === questionId) {
          let newSelectedOptions = [...qa.selectedOptions];
          if (selectedOption !== undefined && isChecked !== undefined) { 
            if (isChecked) {
              if (!newSelectedOptions.includes(selectedOption)) {
                newSelectedOptions.push(selectedOption);
              }
            } else {
              newSelectedOptions = newSelectedOptions.filter(opt => opt !== selectedOption);
            }
          }
          return {
            ...qa,
            answer: answer !== undefined ? answer : qa.answer, 
            selectedOptions: newSelectedOptions,
          };
        }
        return qa;
      })
    );
  };

  const handleEnhancementSubmit = useCallback(async () => {
    setError(null);
    setAppState(AppState.GENERATING_ENHANCEMENT);

    let subjectImagePayload: ReferenceImage | null = null;
    if (subjectReferenceImageFile) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]); 
          reader.onerror = error => reject(error);
          reader.readAsDataURL(subjectReferenceImageFile);
        });
        subjectImagePayload = {
          base64,
          mimeType: subjectReferenceImageFile.type
        };
      } catch (imgError) { 
        console.error("Error processing subject reference image:", imgError);
        setError("Nie udało się przetworzyć obrazu referencyjnego tematu. Spróbuj ponownie lub kontynuuj bez obrazu.");
        setAppState(AppState.ASKING_QUESTIONS); 
        return;
      }
    }
    try {
      const result = await generateEnhancedPrompt(basicPrompt, questionAnswers, subjectImagePayload);
      setEnhancedResult(result); 
      setAppState(AppState.SHOWING_RESULTS);
    } catch (err) { 
        console.error(err);
        setError((err as Error).message || "Nie udało się wygenerować ulepszonego promptu. Sprawdź konsolę, aby uzyskać więcej szczegółów.");
        setAppState(AppState.ERROR);
    }
  }, [basicPrompt, questionAnswers, subjectReferenceImageFile]);

  const handleMagicPromptSubmit = useCallback(async () => {
     if (!basicPrompt.trim()) {
      setError("Proszę wpisać podstawowy pomysł na prompt (może być po polsku lub angielsku) lub wygenerować go z obrazu tematu. Dla 'Magicznego Promptu', ten tekst (wraz z obrazem referencyjnym tematu, jeśli dodano) posłuży AI do kreatywnego rozwinięcia. Wynikowy prompt będzie po angielsku.");
      return;
    }
    if (outputAspectRatio === 'custom' && (!outputCustomWidth.trim() || !outputCustomHeight.trim() || parseInt(outputCustomWidth) <= 0 || parseInt(outputCustomHeight) <= 0)) {
        setError("Dla niestandardowych wymiarów, proszę podać prawidłową szerokość i wysokość (większe od 0).");
        return;
    }
    setError(null);
    setAppState(AppState.GENERATING_MAGIC_PROMPT);
    let subjectImagePayload: ReferenceImage | null = null;
    if (subjectReferenceImageFile) { 
        try {
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve((reader.result as string).split(',')[1]);
              reader.onerror = error => reject(error);
              reader.readAsDataURL(subjectReferenceImageFile);
            });
            subjectImagePayload = {
              base64,
              mimeType: subjectReferenceImageFile.type
            };
        } catch (imgError) { 
            console.error("Error processing subject reference image for magic prompt:", imgError);
            setError("Nie udało się przetworzyć obrazu referencyjnego tematu dla magicznego promptu. Spróbuj ponownie lub kontynuuj bez obrazu.");
            setAppState(AppState.INITIAL);
            return;
        }
    }
    try {
        const currentOutputCustomWidth = outputAspectRatio === IPHONE_14_WALLPAPER_OPTION_VALUE ? "1170" : outputCustomWidth;
        const currentOutputCustomHeight = outputAspectRatio === IPHONE_14_WALLPAPER_OPTION_VALUE ? "2532" : outputCustomHeight;
        const result = await generateMagicPrompt(basicPrompt, outputAspectRatio, currentOutputCustomWidth, currentOutputCustomHeight, subjectImagePayload);
        setEnhancedResult(result); 
        setAppState(AppState.SHOWING_RESULTS);
    } catch (err) { 
        console.error("Error generating magic prompt:", err);
        setError((err as Error).message || "Nie udało się wygenerować magicznego promptu. Sprawdź konsolę.");
        setAppState(AppState.ERROR);
    }
  }, [basicPrompt, subjectReferenceImageFile, outputAspectRatio, outputCustomWidth, outputCustomHeight]);

  const handleCopyImageSubmit = useCallback(async () => {
    if (!subjectReferenceImageFile) {
      setError("Najpierw prześlij obraz (Temat/Obiekt), który chcesz skopiować.");
      return;
    }
    setError(null);
    setAppState(AppState.GENERATING_COPY_PROMPT);
    try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = error => reject(error);
          reader.readAsDataURL(subjectReferenceImageFile);
        });
        const imagePayload: ReferenceImage = {
          base64,
          mimeType: subjectReferenceImageFile.type
        };
        const result = await generateCopyImagePrompt(imagePayload);
        setEnhancedResult(result); 
        setAppState(AppState.SHOWING_RESULTS);
    } catch (err) { 
        console.error("Error generating copy image prompt:", err);
        setError((err as Error).message || "Nie udało się wygenerować promptu do kopiowania obrazu. Sprawdź konsolę.");
        setAppState(AppState.ERROR);
    }
  }, [subjectReferenceImageFile]);
  

  const handleStyleInfluenceSubmit = useCallback(async () => {
    if (!styleReferenceImageFile) {
      setError("Aby zastosować wpływ stylu, prześlij 'Obraz Stylu Referencyjnego'.");
      return;
    }
    if (!basicPrompt.trim() && !subjectReferenceImageFile) {
      setError("Podaj 'Podstawowy pomysł/prompt' (może być po polsku lub angielsku) opisujący temat LUB prześlij 'Obraz Referencyjny (Temat/Obiekt)'. Wynikowy prompt będzie po angielsku.");
      return;
    }
     if (outputAspectRatio === 'custom' && (!outputCustomWidth.trim() || !outputCustomHeight.trim() || parseInt(outputCustomWidth) <= 0 || parseInt(outputCustomHeight) <= 0)) {
        setError("Dla niestandardowych wymiarów, proszę podać prawidłową szerokość i wysokość (większe od 0).");
        return;
    }
    setError(null);
    setAppState(AppState.GENERATING_STYLE_INFLUENCE_PROMPT);

    let subjectImagePayload: ReferenceImage | null = null;
    if (subjectReferenceImageFile) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader(); reader.onload = () => resolve((reader.result as string).split(',')[1]); reader.onerror = error => reject(error); reader.readAsDataURL(subjectReferenceImageFile);
        });
        subjectImagePayload = { base64, mimeType: subjectReferenceImageFile.type };
      } catch (imgError) {
        console.error("Error processing subject reference image for style influence:", imgError);
        setError("Nie udało się przetworzyć obrazu referencyjnego tematu. Spróbuj ponownie.");
        setAppState(AppState.INITIAL); return;
      }
    }
    
    let styleImagePayload: ReferenceImage;
    try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader(); reader.onload = () => resolve((reader.result as string).split(',')[1]); reader.onerror = error => reject(error); reader.readAsDataURL(styleReferenceImageFile);
        });
        styleImagePayload = { base64, mimeType: styleReferenceImageFile.type };
    } catch (imgError) {
        console.error("Error processing style reference image:", imgError);
        setError("Nie udało się przetworzyć obrazu stylu referencyjnego. Spróbuj ponownie.");
        setAppState(AppState.INITIAL); return;
    }
    
    try {
      const currentOutputCustomWidth = outputAspectRatio === IPHONE_14_WALLPAPER_OPTION_VALUE ? "1170" : outputCustomWidth;
      const currentOutputCustomHeight = outputAspectRatio === IPHONE_14_WALLPAPER_OPTION_VALUE ? "2532" : outputCustomHeight;
      const result = await generateStyleInfluencePrompt(basicPrompt, styleImagePayload, subjectImagePayload, outputAspectRatio, currentOutputCustomWidth, currentOutputCustomHeight);
      setEnhancedResult(result); 
      setAppState(AppState.SHOWING_RESULTS);
    } catch (err) {
      console.error("Error generating style influence prompt:", err);
      setError((err as Error).message || "Nie udało się wygenerować promptu z wpływem stylu. Sprawdź konsolę.");
      setAppState(AppState.ERROR);
    }
  }, [basicPrompt, subjectReferenceImageFile, styleReferenceImageFile, outputAspectRatio, outputCustomWidth, outputCustomHeight]);

  const handleEditEnhancedPrompt = () => {
    if (enhancedResult) {
      setEditedEnhancedPromptText(enhancedResult.enhancedPrompt);
      setIsEditingEnhancedPrompt(true);
      setError(null); // Clear previous errors
    }
  };

  const handleCancelEditEnhancedPrompt = () => {
    setIsEditingEnhancedPrompt(false);
    setEditedEnhancedPromptText(''); // Clear edits
  };

  const handleSubmitRefinedPrompt = useCallback(async () => {
    if (!editedEnhancedPromptText.trim()) {
      setError("Edytowany prompt nie może być pusty.");
      return;
    }
    setError(null);
    setAppState(AppState.GENERATING_REFINEMENT);

    let subjectImagePayload: ReferenceImage | null = null;
    if (subjectReferenceImageFile) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = error => reject(error);
          reader.readAsDataURL(subjectReferenceImageFile);
        });
        subjectImagePayload = {
          base64,
          mimeType: subjectReferenceImageFile.type
        };
      } catch (imgError) {
        console.error("Error processing subject reference image for refinement:", imgError);
        setError("Nie udało się przetworzyć obrazu referencyjnego tematu dla poprawki. Spróbuj ponownie.");
        setAppState(AppState.SHOWING_RESULTS); // Go back to showing results, allowing another edit attempt
        setIsEditingEnhancedPrompt(true); // Keep edit mode active
        return;
      }
    }

    try {
      // basicPrompt (original user idea) and questionAnswers (original Q&A) provide context
      const result = await refineEditedPrompt(editedEnhancedPromptText, basicPrompt, questionAnswers, subjectImagePayload);
      setEnhancedResult(result);
      setAppState(AppState.SHOWING_RESULTS);
      setIsEditingEnhancedPrompt(false); // Exit edit mode
      setCopiedEnhancedPrompt(false); // Reset copy status for new prompt
      setCopiedNegativePrompt(false);
      setCopiedSuggestionIndex(null);
    } catch (err) {
      console.error("Error refining prompt:", err);
      setError((err as Error).message || "Nie udało się poprawić promptu. Sprawdź konsolę.");
      setAppState(AppState.ERROR); // Or AppState.SHOWING_RESULTS and setIsEditingEnhancedPrompt(true) to allow retry
    }
  }, [editedEnhancedPromptText, basicPrompt, questionAnswers, subjectReferenceImageFile]);


  const handleStartOver = () => {
    setAppState(AppState.INITIAL);
    setBasicPrompt('');
    setQuestionAnswers([]);
    setEnhancedResult(null);
    setError(null);
    setSubjectReferenceImageFile(null); setSubjectReferenceImagePreview(null);
    setStyleReferenceImageFile(null); setStyleReferenceImagePreview(null);
    if (subjectFileInputRef.current) subjectFileInputRef.current.value = "";
    if (styleFileInputRef.current) styleFileInputRef.current.value = "";
    setCopiedEnhancedPrompt(false);
    setCopiedNegativePrompt(false);
    setCopiedSuggestionIndex(null);
    setOutputAspectRatio('auto');
    setOutputCustomWidth('');
    setOutputCustomHeight('');
    setIsEditingEnhancedPrompt(false);
    setEditedEnhancedPromptText('');
  };

  const copyToClipboard = async (text: string, type: 'enhanced' | 'negative' | 'suggestion', index?: number) => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'enhanced') setCopiedEnhancedPrompt(true);
      else if (type === 'negative') setCopiedNegativePrompt(true);
      else if (type === 'suggestion' && index !== undefined) setCopiedSuggestionIndex(index);
      
      setTimeout(() => {
        if (type === 'enhanced') setCopiedEnhancedPrompt(false);
        else if (type === 'negative') setCopiedNegativePrompt(false);
        else if (type === 'suggestion') setCopiedSuggestionIndex(null);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      setError("Nie udało się skopiować tekstu do schowka.");
    }
  };
  
  const isCustomDimensionsInvalid = useMemo(() => {
    if (outputAspectRatio === 'custom') {
        if (!outputCustomWidth.trim() || !outputCustomHeight.trim()) {
            return true; 
        }
        const width = parseInt(outputCustomWidth, 10);
        const height = parseInt(outputCustomHeight, 10);
        if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0) {
            return true;
        }
    }
    return false; 
  }, [outputAspectRatio, outputCustomWidth, outputCustomHeight]);

  const renderContent = () => {
    if (!apiKeyExists && appState !== AppState.ERROR) { 
        return (
            <div className="p-4 bg-yellow-800/80 border border-yellow-600 text-yellow-200 rounded-lg text-center" role="alert">
              <p className="font-semibold text-lg mb-2">Problem z konfiguracją API</p>
              {error || "Klucz API Gemini nie jest poprawnie skonfigurowany. Sprawdź konsolę i ustawienia środowiska."}
            </div>
        );
    }

    switch (appState) {
      case AppState.INITIAL:
        return (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-3xl font-bold text-center text-primary-400">Ulepsz Swój Prompt Graficzny</h2>
            <p className="text-center text-secondary-400">
              Zacznij od wprowadzenia swojego podstawowego pomysłu (po polsku lub angielsku) lub wygeneruj go z obrazu tematu (opis będzie po angielsku).
              Poprzez {NUMBER_OF_QUESTIONS_TO_ASK} precyzyjnych pytań (po polsku, pierwsze o styl!) i dynamicznie generowanych opcji, pomożemy Ci stworzyć prompt "$100,000" (wynik po angielsku)!
              Możesz też załadować obraz stylu, aby nadać swojemu tematowi nowy artystyczny wygląd!
            </p>
            
            <TextArea
              label="Twój podstawowy pomysł/prompt (opisuje GŁÓWNY TEMAT; może być po polsku lub angielsku)"
              id="basic-prompt-input"
              value={basicPrompt}
              onChange={(e) => setBasicPrompt(e.target.value)}
              placeholder="Np. 'Astronauta na Marsie sadzący kwiaty', 'Cyberpunkowe miasto nocą w deszczu', 'Portret kota w stylu Van Gogha' (możesz użyć polskiego lub angielskiego)"
              rows={3}
              aria-label="Podstawowy pomysł na prompt"
            />

            <div className="p-4 border border-secondary-700 rounded-lg space-y-3 bg-secondary-850 shadow">
              <label htmlFor="subject-reference-image-upload" className="block text-sm font-medium text-secondary-300 mb-1">
                Obraz Referencyjny (Temat/Obiekt - opcjonalny; max {MAX_IMAGE_SIZE_MB}MB)
              </label>
              <input
                type="file" id="subject-reference-image-upload" ref={subjectFileInputRef}
                accept={ALLOWED_IMAGE_TYPES.join(',')}
                onChange={(e) => handleImageUpload(e, 'subject')}
                className="block w-full text-sm text-secondary-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-600 file:text-white hover:file:bg-primary-700 cursor-pointer"
                aria-describedby="subject-reference-image-description"
              />
              <p id="subject-reference-image-description" className="sr-only">Prześlij obraz referencyjny dla tematu lub obiektu Twojego promptu.</p>
              {subjectReferenceImagePreview && (
                <div className="mt-4 space-y-3">
                  <div className="relative group w-max mx-auto">
                    <img src={subjectReferenceImagePreview} alt="Podgląd obrazu referencyjnego tematu" className="max-w-xs max-h-48 mx-auto rounded-lg shadow-md" />
                    <Button onClick={() => clearReferenceImage('subject')} variant="danger" size="sm" className="absolute top-2 right-2 opacity-50 group-hover:opacity-100 transition-opacity !p-1.5" aria-label="Usuń obraz referencyjny tematu">
                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button onClick={handleGenerateDescriptionFromImage} variant="secondary" size="sm" className="w-full" aria-label="Wygeneruj opis podstawowego promptu z obrazu tematu (wynik po angielsku)" disabled={!subjectReferenceImageFile}>
                      Generuj Opis Tematu (EN)
                    </Button>
                    <Button onClick={handleCopyImageSubmit} variant="secondary" size="sm" className="w-full border-teal-500 hover:bg-teal-700/30 text-teal-300 focus:ring-teal-500" aria-label="Wygeneruj prompt do skopiowania obrazu tematu 1:1 (wynik po angielsku)" disabled={!subjectReferenceImageFile}>
                     🖼️ Skopiuj Obraz (EN)
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border border-secondary-700 rounded-lg space-y-3 bg-secondary-850 shadow">
              <label htmlFor="style-reference-image-upload" className="block text-sm font-medium text-secondary-300 mb-1">
                Obraz Stylu Referencyjnego (opcjonalny, dla funkcji 'Zastosuj Styl'; max {MAX_IMAGE_SIZE_MB}MB)
              </label>
              <input
                type="file" id="style-reference-image-upload" ref={styleFileInputRef}
                accept={ALLOWED_IMAGE_TYPES.join(',')}
                onChange={(e) => handleImageUpload(e, 'style')}
                className="block w-full text-sm text-secondary-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-600 file:text-white hover:file:bg-primary-700 cursor-pointer"
                aria-describedby="style-reference-image-description"
              />
               <p id="style-reference-image-description" className="sr-only">Prześlij obraz, którego styl artystyczny chcesz zastosować.</p>
              {styleReferenceImagePreview && (
                <div className="mt-4">
                  <div className="relative group w-max mx-auto">
                    <img src={styleReferenceImagePreview} alt="Podgląd obrazu stylu referencyjnego" className="max-w-xs max-h-48 mx-auto rounded-lg shadow-md" />
                     <Button onClick={() => clearReferenceImage('style')} variant="danger" size="sm" className="absolute top-2 right-2 opacity-50 group-hover:opacity-100 transition-opacity !p-1.5" aria-label="Usuń obraz stylu referencyjnego">
                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 border border-secondary-700 rounded-lg space-y-4 bg-secondary-850 shadow">
                <h3 className="text-lg font-semibold text-primary-300 mb-2">Ustawienia Wyjściowe (Opcjonalne)</h3>
                <div>
                    <label htmlFor="output-aspect-ratio" className="block text-sm font-medium text-secondary-300 mb-1">Proporcje Obrazu</label>
                    <select 
                        id="output-aspect-ratio"
                        value={outputAspectRatio}
                        onChange={(e) => setOutputAspectRatio(e.target.value)}
                        className="block w-full px-4 py-2.5 bg-secondary-800 border border-secondary-700 rounded-lg text-secondary-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors duration-150"
                    >
                        <option value="auto">Automatyczne / Z Promptu</option>
                        <option value="1:1">Kwadrat (1:1)</option>
                        <option value="16:9">Szeroki (16:9)</option>
                        <option value="9:16">Wysoki (9:16)</option>
                        <option value="4:3">Krajobraz (4:3)</option>
                        <option value="3:4">Portret (3:4)</option>
                        <option value={IPHONE_14_WALLPAPER_OPTION_VALUE}>Tapeta iPhone 14/Pro (1170x2532)</option>
                        <option value="custom">Niestandardowe</option>
                    </select>
                </div>
                {outputAspectRatio === 'custom' && (
                    <div className="grid grid-cols-2 gap-4">
                        <TextInput 
                            label="Szerokość (px)" 
                            type="number" 
                            id="custom-width"
                            value={outputCustomWidth}
                            onChange={(e) => setOutputCustomWidth(e.target.value)}
                            placeholder="np. 1024"
                            min="1"
                        />
                        <TextInput 
                            label="Wysokość (px)" 
                            type="number" 
                            id="custom-height"
                            value={outputCustomHeight}
                            onChange={(e) => setOutputCustomHeight(e.target.value)}
                            placeholder="np. 768"
                            min="1"
                        />
                    </div>
                )}
                 {(isCustomDimensionsInvalid && outputAspectRatio === 'custom') && (
                    <p className="text-xs text-red-400">Podaj prawidłowe, dodatnie wartości liczbowe dla szerokości i wysokości.</p>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <Button onClick={handleBasicPromptSubmit} className="w-full" size="lg" disabled={!basicPrompt.trim()} aria-label={`Uzyskaj ${NUMBER_OF_QUESTIONS_TO_ASK} pytań doprecyzowujących (pytania po polsku)`}>
                  Ulepsz z {NUMBER_OF_QUESTIONS_TO_ASK} Pytaniami (PL)
                </Button>
                <Button 
                  onClick={handleMagicPromptSubmit} 
                  variant="primary" 
                  className="w-full bg-purple-600 hover:bg-purple-700 focus:ring-purple-500" 
                  size="lg" 
                  disabled={!basicPrompt.trim() || isCustomDimensionsInvalid}
                  aria-label="Wygeneruj Magiczny Prompt (wynik po angielsku)"
                  title={!basicPrompt.trim() ? "Wprowadź podstawowy pomysł." : isCustomDimensionsInvalid ? "Podaj prawidłowe niestandardowe wymiary." : "Wygeneruj Magiczny Prompt (EN)"}
                >
                  ✨ Magiczny Prompt (EN) ✨
                </Button>
                <Button 
                  onClick={handleStyleInfluenceSubmit}
                  variant="primary"
                  className="w-full bg-green-600 hover:bg-green-700 focus:ring-green-500 sm:col-span-2" 
                  size="lg"
                  disabled={(!basicPrompt.trim() && !subjectReferenceImageFile) || !styleReferenceImageFile || isCustomDimensionsInvalid}
                  aria-label="Zastosuj Styl z Obrazu do Tematu (wynik po angielsku)"
                  title={((!basicPrompt.trim() && !subjectReferenceImageFile) || !styleReferenceImageFile) ? "Wymagany Obraz Stylu oraz Pomysł/Obraz Tematu." : isCustomDimensionsInvalid ? "Podaj prawidłowe niestandardowe wymiary." : "Zastosuj Styl z Obrazu (EN)"}
                >
                  🎨 Zastosuj Styl (EN) 🎨
                </Button>
            </div>
          </div>
        );
      case AppState.GENERATING_DESCRIPTION:
        return (
          <div className="flex flex-col items-center justify-center space-y-4 animate-fade-in h-64" role="status" aria-live="polite">
            <LoadingSpinner size="w-16 h-16" />
            <p className="text-xl text-primary-400">Generowanie opisu z obrazu (po angielsku)...</p>
            <p className="text-secondary-400">Analizujemy Twój obraz, aby stworzyć szczegółowy opis w języku angielskim.</p>
          </div>
        );
      case AppState.GENERATING_QUESTIONS:
        return (
          <div className="flex flex-col items-center justify-center space-y-4 animate-fade-in h-64" role="status" aria-live="polite">
            <LoadingSpinner size="w-16 h-16" />
            <p className="text-xl text-primary-400">Generowanie {NUMBER_OF_QUESTIONS_TO_ASK} Pytań i Opcji (po polsku)...</p>
            <p className="text-secondary-400">Przygotowujemy pytania (pierwsze o styl!) i dynamiczne sugestie odpowiedzi (po polsku), aby pomóc Ci stworzyć prompt "$100,000".</p>
          </div>
        );
      case AppState.ASKING_QUESTIONS:
        return (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-bold text-primary-400">Odpowiedz na {NUMBER_OF_QUESTIONS_TO_ASK} Pytań (Pierwsze o Styl!)</h2>
            <p className="text-secondary-400">Twoje odpowiedzi (lub ich brak) na poniższe polskie pytania pomogą nam stworzyć idealny prompt "$100,000" w języku angielskim! Możesz pominąć pytania lub dodać własne notatki.</p>
            <form onSubmit={(e) => { e.preventDefault(); handleEnhancementSubmit(); }} className="space-y-5">
              {questionAnswers.map((qa, index) => (
                <div key={qa.id} className="p-4 border border-secondary-700 rounded-lg bg-secondary-850 shadow">
                  <fieldset>
                    <legend className="text-lg font-semibold text-secondary-200 mb-2">{index + 1}. {qa.questionText}</legend>
                    {qa.options.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 max-h-60 overflow-y-auto pr-2">
                        {qa.options.map(option => (
                          <label key={option} className="flex items-start space-x-3 p-2 rounded-md hover:bg-secondary-700/70 transition-colors cursor-pointer">
                            <input
                              type="checkbox"
                              name={qa.id}
                              value={option}
                              checked={qa.selectedOptions.includes(option)}
                              onChange={(e) => handleAnswerChange(qa.id, undefined, option, e.target.checked)}
                              className="h-5 w-5 rounded text-primary-600 border-secondary-600 focus:ring-primary-500 bg-secondary-900 cursor-pointer mt-0.5 shrink-0"
                            />
                            <span className="text-sm text-secondary-300">{option}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                       <p className="text-sm text-secondary-400">To pytanie nie ma predefiniowanych opcji. Proszę użyć pola notatek poniżej, jeśli dotyczy.</p>
                    )}
                     <TextArea
                        label="Dodatkowe notatki (opcjonalne, mogą być po polsku lub angielsku)"
                        id={`${qa.id}-notes`}
                        value={qa.answer}
                        onChange={(e) => handleAnswerChange(qa.id, e.target.value)}
                        placeholder="Twoje dodatkowe uwagi do tego pytania..."
                        rows={2}
                        className="mt-3"
                      />
                  </fieldset>
                </div>
              ))}
              <Button type="submit" size="lg" className="w-full" aria-label="Generuj ulepszony prompt na podstawie odpowiedzi (wynik po angielsku)">
                Generuj Ulepszony Prompt "$100,000" (EN)
              </Button>
            </form>
            <Button onClick={handleStartOver} variant="secondary" className="w-full mt-4">Zacznij od Nowa</Button>
          </div>
        );
      case AppState.GENERATING_ENHANCEMENT:
        return (
          <div className="flex flex-col items-center justify-center space-y-4 animate-fade-in h-64" role="status" aria-live="polite">
            <LoadingSpinner size="w-16 h-16" />
            <p className="text-xl text-primary-400">Generowanie Ulepszonego Promptu "$100,000" (po angielsku)...</p>
            <p className="text-secondary-400">Łączymy Twoje odpowiedzi w potężny prompt o najwyższej jakości, w języku angielskim.</p>
          </div>
        );
      case AppState.GENERATING_MAGIC_PROMPT:
        return (
          <div className="flex flex-col items-center justify-center space-y-4 animate-fade-in h-64" role="status" aria-live="polite">
            <LoadingSpinner size="w-16 h-16" />
            <p className="text-xl text-primary-400">Tworzenie Magicznego Promptu "$100,000" (po angielsku)...</p>
            <p className="text-secondary-400">Nasza AI kreatywnie rozwija Twój pomysł, dążąc do perfekcji w języku angielskim.</p>
          </div>
        );
      case AppState.GENERATING_COPY_PROMPT:
         return (
          <div className="flex flex-col items-center justify-center space-y-4 animate-fade-in h-64" role="status" aria-live="polite">
            <LoadingSpinner size="w-16 h-16" />
            <p className="text-xl text-primary-400">Generowanie Promptu Kopiującego "$100,000" (po angielsku)...</p>
            <p className="text-secondary-400">Analizujemy obraz, aby stworzyć prompt (po angielsku) do jego rekonstrukcji o najwyższej jakości.</p>
          </div>
        );
      case AppState.GENERATING_STYLE_INFLUENCE_PROMPT:
        return (
          <div className="flex flex-col items-center justify-center space-y-4 animate-fade-in h-64" role="status" aria-live="polite">
            <LoadingSpinner size="w-16 h-16" />
            <p className="text-xl text-primary-400">Analizowanie stylu i generowanie promptu z wpływem artystycznym o jakości "$100,000" (po angielsku)...</p>
            <p className="text-secondary-400">Nasza AI intensywnie myśli, proszę czekać...</p>
          </div>
        );
      case AppState.GENERATING_REFINEMENT:
        return (
          <div className="flex flex-col items-center justify-center space-y-4 animate-fade-in h-64" role="status" aria-live="polite">
            <LoadingSpinner size="w-16 h-16" />
            <p className="text-xl text-primary-400">Poprawianie Twojego edytowanego promptu (po angielsku)...</p>
            <p className="text-secondary-400">AI analizuje Twoje zmiany i udoskonala prompt, zachowując kontekst.</p>
          </div>
        );
      case AppState.SHOWING_RESULTS:
        if (!enhancedResult) return <p>Brak wyników do wyświetlenia.</p>;
        return (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-3xl font-bold text-center text-primary-400">Twój Ulepszony Prompt o Jakości "$100,000" (po Angielsku)!</h2>
            
            <div className="space-y-3 p-4 border border-secondary-600 rounded-lg bg-secondary-900 shadow-lg">
              <h3 className="text-xl font-semibold text-primary-300">Ulepszony Prompt Główny (Enhanced Main Prompt - English):</h3>
              {isEditingEnhancedPrompt ? (
                <TextArea
                  id="edited-enhanced-prompt"
                  value={editedEnhancedPromptText}
                  onChange={(e) => setEditedEnhancedPromptText(e.target.value)}
                  rows={6}
                  className="text-sm bg-secondary-800 p-3 rounded-md whitespace-pre-wrap break-words text-secondary-200 shadow-inner w-full"
                  aria-label="Edytuj ulepszony prompt główny"
                />
              ) : (
                <pre className="text-sm bg-secondary-800 p-3 rounded-md whitespace-pre-wrap break-words text-secondary-200 shadow-inner">{enhancedResult.enhancedPrompt}</pre>
              )}
              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                {isEditingEnhancedPrompt ? (
                  <>
                    <Button onClick={handleSubmitRefinedPrompt} size="sm" variant="primary" className="w-full sm:w-auto" disabled={!editedEnhancedPromptText.trim()}>
                      Zapisz i Popraw Prompt
                    </Button>
                    <Button onClick={handleCancelEditEnhancedPrompt} size="sm" variant="secondary" className="w-full sm:w-auto">
                      Anuluj Edycję
                    </Button>
                  </>
                ) : (
                  <>
                    <Button onClick={handleEditEnhancedPrompt} size="sm" variant="secondary" className="w-full sm:w-auto">
                      Edytuj Główny Prompt
                    </Button>
                    <Button onClick={() => copyToClipboard(enhancedResult.enhancedPrompt, 'enhanced')} size="sm" variant="secondary" className="w-full sm:w-auto">
                      {copiedEnhancedPrompt ? 'Skopiowano!' : 'Kopiuj Prompt Główny'}
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-3 p-4 border border-secondary-600 rounded-lg bg-secondary-900 shadow-lg">
              <h3 className="text-xl font-semibold text-red-400">Prompt Negatywny (Negative Prompt - English):</h3>
              <pre className="text-sm bg-secondary-800 p-3 rounded-md whitespace-pre-wrap break-words text-secondary-200 shadow-inner">{enhancedResult.negativePrompt}</pre>
              <Button onClick={() => copyToClipboard(enhancedResult.negativePrompt, 'negative')} size="sm" variant="secondary" className="w-full sm:w-auto">
                {copiedNegativePrompt ? 'Skopiowano!' : 'Kopiuj Prompt Negatywny'}
              </Button>
            </div>
            
            {enhancedResult.suggestions && enhancedResult.suggestions.length > 0 && (
              <div className="space-y-4 p-4 border border-secondary-600 rounded-lg bg-secondary-900 shadow-lg">
                <h3 className="text-xl font-semibold text-purple-400">Sugestie Dalszych Ulepszeń (Further Suggestions - English):</h3>
                <ul className="space-y-3">
                  {enhancedResult.suggestions.map((suggestion, index) => (
                    <li key={index} className="p-3 bg-secondary-800 rounded-md shadow-inner">
                      <p className="text-sm text-secondary-200 mb-2">{suggestion}</p>
                      <Button onClick={() => copyToClipboard(suggestion, 'suggestion', index)} size="sm" variant="secondary" className="w-full sm:w-auto text-xs">
                        {copiedSuggestionIndex === index ? 'Skopiowano!' : `Kopiuj Sugestię ${index + 1}`}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
             <p className="text-xs text-center text-secondary-500 mt-2">Typ promptu: {enhancedResult.outputTypeUsed === OutputType.RASTER_PROMPT ? 'Prompt Rastrowy (np. dla DALL-E, Midjourney, Stable Diffusion)' : 'Nieznany typ'}</p>
            <Button onClick={handleStartOver} size="lg" className="w-full mt-6">Zacznij od Nowa</Button>
          </div>
        );
      case AppState.ERROR:
        return (
          <div className="space-y-4 text-center animate-fade-in p-6 bg-red-900/70 border border-red-700 rounded-xl shadow-2xl" role="alert">
            <h2 className="text-3xl font-bold text-red-300">Wystąpił Błąd</h2>
            <p className="text-red-200 text-base whitespace-pre-line">{error || "Napotkano nieoczekiwany problem."}</p>
            <Button onClick={handleStartOver} variant="secondary" size="lg" className="mt-4">Spróbuj Ponownie</Button>
          </div>
        );
      default:
        return null;
    }
  };
  

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-secondary-950 via-secondary-900 to-secondary-800">
      <main className="w-full max-w-3xl mx-auto bg-secondary-850/80 backdrop-blur-md p-5 sm:p-7 lg:p-9 rounded-xl shadow-2xl border border-secondary-700/70">
        <header className="mb-6 sm:mb-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-400 via-purple-500 to-pink-500">
              AI Prompt Enhancer Pro
            </span>
          </h1>
          <p className="mt-2 text-base sm:text-lg text-secondary-400">
            Przekształć pomysły w arcydzieła promptów rastrowych (wyniki po angielsku)! Z {NUMBER_OF_QUESTIONS_TO_ASK} pytaniami (po polsku, pierwsze o styl!) i dynamicznymi opcjami, magicznymi promptami, kopią obrazu, wpływem stylu i możliwością edycji promptu!
          </p>
        </header>
        
        {error && appState !== AppState.ERROR && (appState === AppState.INITIAL || appState === AppState.ASKING_QUESTIONS || (appState === AppState.SHOWING_RESULTS && isEditingEnhancedPrompt)) && (
          <div className="mb-5 p-3 bg-red-800/80 border border-red-600 text-red-200 rounded-lg text-sm animate-fade-in" role="alert">
            {error}
          </div>
        )}
        
        {renderContent()}
      </main>
      <footer className="mt-10 text-center text-secondary-500 text-sm">
        <p>&copy; {new Date().getFullYear()} AI Prompt Enhancer Pro. Powered by Gemini.</p>
        { !apiKeyExists && <p className="text-xs mt-1 text-yellow-400">Pamiętaj o konfiguracji klucza API Gemini w środowisku!</p>}
      </footer>
    </div>
  );
};

export default App;