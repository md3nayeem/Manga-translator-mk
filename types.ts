
export type TextType = 'dialogue' | 'thought' | 'sfx' | 'narration';
export type BubbleShape = 'oval' | 'rectangular' | 'cloud' | 'none';

export interface Position {
  left: number;
  top: number;
  width: number;
  height: number;
  scaleX?: number;
  scaleY?: number;
}

export interface TextStyle {
  fontSize: number;
  fontFamily: string;
  fill: string;
  backgroundColor: string;
  fontWeight: string | number;
  textAlign: 'left' | 'center' | 'right';
  bold: boolean;
}

export interface TextBlock {
  id: string;
  originalText: string;
  translatedText: string;
  position: Position;
  type: TextType;
  shape: BubbleShape;
  style: TextStyle;
  visible: boolean;
  speaker?: string;
  confidence: number;
}

export interface TranslationResult {
  detectedTexts: TextBlock[];
  pageContext: string;
  overallTone: string;
}

export type WorkflowStep = 'upload' | 'detect' | 'translate' | 'edit' | 'export';

export interface AppSettings {
  autoSave: boolean;
  gridSnap: boolean;
  showIds: boolean;
}

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
