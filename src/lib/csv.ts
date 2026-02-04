// CSV utility functions for export and import
import { z } from 'zod';

export interface TransactionCSV {
  descricao: string;
  valor: string;
  tipo: string;
  forma_pagamento: string;
  fonte_pagamento: string;
  data: string;
  observacao: string;
}

// Validation constants
const MAX_AMOUNT = 999999999.99;
const MIN_AMOUNT = 0.01;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_NOTES_LENGTH = 1000;
const MAX_PAYMENT_SOURCE_LENGTH = 100;

// Zod schema for transaction validation
const transactionSchema = z.object({
  description: z.string()
    .trim()
    .min(1, 'Descrição é obrigatória')
    .max(MAX_DESCRIPTION_LENGTH, `Descrição deve ter no máximo ${MAX_DESCRIPTION_LENGTH} caracteres`)
    .transform(sanitizeText),
  amount: z.number()
    .min(MIN_AMOUNT, `Valor mínimo é R$ ${MIN_AMOUNT.toFixed(2)}`)
    .max(MAX_AMOUNT, `Valor máximo é R$ ${MAX_AMOUNT.toLocaleString('pt-BR')}`),
  type: z.enum(['income', 'expense']),
  payment_method: z.enum(['pix', 'boleto', 'credito', 'debito', 'dinheiro', 'transferencia']),
  payment_source: z.string()
    .max(MAX_PAYMENT_SOURCE_LENGTH, `Fonte deve ter no máximo ${MAX_PAYMENT_SOURCE_LENGTH} caracteres`)
    .transform(sanitizeText)
    .nullable(),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  notes: z.string()
    .max(MAX_NOTES_LENGTH, `Observação deve ter no máximo ${MAX_NOTES_LENGTH} caracteres`)
    .transform(sanitizeText)
    .nullable(),
});

// Sanitize text to prevent injection attacks
function sanitizeText(text: string): string {
  if (!text) return text;
  
  // Remove potentially dangerous characters while preserving common Brazilian text
  return text
    .replace(/[<>]/g, '') // Remove HTML brackets
    .replace(/javascript:/gi, '') // Remove javascript protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .trim();
}

export type ValidationError = {
  row: number;
  field: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
  validTransactions: TransactionData[];
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  credito: 'Crédito',
  debito: 'Débito',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
};

const PAYMENT_METHOD_REVERSE: Record<string, string> = {
  'pix': 'pix',
  'boleto': 'boleto',
  'credito': 'credito',
  'crédito': 'credito',
  'debito': 'debito',
  'débito': 'debito',
  'dinheiro': 'dinheiro',
  'transferencia': 'transferencia',
  'transferência': 'transferencia',
};

const TYPE_LABELS: Record<string, string> = {
  income: 'Receita',
  expense: 'Despesa',
};

const TYPE_REVERSE: Record<string, string> = {
  'receita': 'income',
  'despesa': 'expense',
};

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function parseCurrency(value: string): number {
  // Handle Brazilian format: 1.234,56 -> 1234.56
  const cleaned = value
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  return parseFloat(cleaned) || 0;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR');
}

export function parseDate(dateStr: string): string {
  // Handle DD/MM/YYYY format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  // Handle YYYY-MM-DD format
  if (dateStr.includes('-')) {
    return dateStr.split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

export interface TransactionData {
  id?: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  payment_method: 'pix' | 'boleto' | 'credito' | 'debito' | 'dinheiro' | 'transferencia';
  payment_source: string | null;
  transaction_date: string;
  notes: string | null;
}

export function transactionsToCSV(transactions: TransactionData[]): string {
  const headers = ['Descrição', 'Valor', 'Tipo', 'Forma de Pagamento', 'Fonte/Cartão', 'Data', 'Observação'];
  
  const rows = transactions.map(t => [
    escapeCsvField(t.description),
    formatCurrency(t.amount),
    TYPE_LABELS[t.type] || t.type,
    PAYMENT_METHOD_LABELS[t.payment_method] || t.payment_method,
    escapeCsvField(t.payment_source || ''),
    formatDate(t.transaction_date),
    escapeCsvField(t.notes || ''),
  ]);

  const csvContent = [
    headers.join(';'),
    ...rows.map(row => row.join(';'))
  ].join('\n');

  // Add BOM for Excel compatibility
  return '\ufeff' + csvContent;
}

function escapeCsvField(field: string): string {
  if (field.includes(';') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function parseCSV(csvContent: string): TransactionCSV[] {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('O arquivo CSV está vazio ou não contém dados');
  }

  // Remove BOM if present
  const headerLine = lines[0].replace(/^\ufeff/, '');
  const headers = parseCSVLine(headerLine);
  
  const results: TransactionCSV[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0 || values.every(v => !v.trim())) continue;
    
    const row: TransactionCSV = {
      descricao: findColumn(headers, values, ['descrição', 'descricao', 'description', 'pagamento', 'nome']) || '',
      valor: findColumn(headers, values, ['valor', 'value', 'amount', 'quantia']) || '0',
      tipo: findColumn(headers, values, ['tipo', 'type', 'categoria']) || 'expense',
      forma_pagamento: findColumn(headers, values, ['forma de pagamento', 'forma_pagamento', 'payment_method', 'metodo', 'método']) || 'pix',
      fonte_pagamento: findColumn(headers, values, ['fonte', 'fonte/cartão', 'fonte_pagamento', 'cartão', 'cartao', 'pagador', 'source']) || '',
      data: findColumn(headers, values, ['data', 'date', 'transaction_date', 'dia']) || '',
      observacao: findColumn(headers, values, ['observação', 'observacao', 'notes', 'obs', 'comentário', 'comentario']) || '',
    };
    
    results.push(row);
  }

  return results;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  // Support both ; and , as delimiters
  const delimiter = line.includes(';') ? ';' : ',';
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function findColumn(headers: string[], values: string[], possibleNames: string[]): string | undefined {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  
  for (const name of possibleNames) {
    const index = normalizedHeaders.indexOf(name.toLowerCase());
    if (index !== -1 && values[index] !== undefined) {
      return values[index];
    }
  }
  
  return undefined;
}

export function csvToTransactions(csvRows: TransactionCSV[]): Omit<TransactionData, 'id'>[] {
  return csvRows.map(row => {
    const normalizedType = row.tipo.toLowerCase().trim();
    const normalizedMethod = row.forma_pagamento.toLowerCase().trim();
    
    return {
      description: row.descricao.trim(),
      amount: parseCurrency(row.valor),
      type: (TYPE_REVERSE[normalizedType] || 'expense') as 'income' | 'expense',
      payment_method: (PAYMENT_METHOD_REVERSE[normalizedMethod] || 'pix') as TransactionData['payment_method'],
      payment_source: row.fonte_pagamento.trim() || null,
      transaction_date: parseDate(row.data),
      notes: row.observacao.trim() || null,
    };
  }).filter(t => t.description && t.amount > 0);
}

// Validate and sanitize transactions before database insertion
export function validateTransactions(csvRows: TransactionCSV[]): ValidationResult {
  const errors: ValidationError[] = [];
  const validTransactions: TransactionData[] = [];
  
  csvRows.forEach((row, index) => {
    const rowNumber = index + 1; // 1-indexed for user display
    const normalizedType = row.tipo.toLowerCase().trim();
    const normalizedMethod = row.forma_pagamento.toLowerCase().trim();
    
    const rawTransaction = {
      description: sanitizeText(row.descricao.trim()),
      amount: parseCurrency(row.valor),
      type: (TYPE_REVERSE[normalizedType] || 'expense') as 'income' | 'expense',
      payment_method: (PAYMENT_METHOD_REVERSE[normalizedMethod] || 'pix') as TransactionData['payment_method'],
      payment_source: row.fonte_pagamento.trim() ? sanitizeText(row.fonte_pagamento.trim()) : null,
      transaction_date: parseDate(row.data),
      notes: row.observacao.trim() ? sanitizeText(row.observacao.trim()) : null,
    };
    
    // Validate the transaction
    const result = transactionSchema.safeParse(rawTransaction);
    
    if (!result.success) {
      result.error.errors.forEach(err => {
        errors.push({
          row: rowNumber,
          field: err.path.join('.'),
          message: err.message,
        });
      });
    } else {
      // Additional validation: check for reasonable date range
      const transactionDate = new Date(rawTransaction.transaction_date);
      const now = new Date();
      const minDate = new Date('1990-01-01');
      const maxDate = new Date(now.getFullYear() + 1, 11, 31); // Allow up to end of next year
      
      if (transactionDate < minDate || transactionDate > maxDate) {
        errors.push({
          row: rowNumber,
          field: 'transaction_date',
          message: `Data fora do intervalo permitido (${minDate.getFullYear()}-${maxDate.getFullYear()})`,
        });
      } else {
        validTransactions.push(result.data as TransactionData);
      }
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
    validTransactions,
  };
}

// Export MAX_BATCH_SIZE for use in import dialog
export const MAX_IMPORT_BATCH_SIZE = 500;

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
