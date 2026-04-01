
export interface ProductInput {
  sku: string;
  chineseName: string;
}

export interface ProductResult {
  sku: string;
  chineseName: string;
  russianName: string;
  russianDescription: string;
  backTranslation: string;
}

export interface ProcessingStatus {
  total: number;
  completed: number;
  isProcessing: boolean;
  error?: string;
}
