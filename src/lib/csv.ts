// CSV utility functions for export and import

export interface TransactionCSV {
  descricao: string;
  valor: string;
  tipo: string;
  forma_pagamento: string;
  fonte_pagamento: string;
  data: string;
  observacao: string;
}

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
