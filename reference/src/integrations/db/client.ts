/**
 * Cliente de Banco de Dados - PostgreSQL via API REST
 * Usa getApiUrl() para suportar ativafix.com com o mesmo build.
 */

import { fetchWithRetry } from '@/utils/fetchWithRetry';
import { getApiUrl } from '@/utils/apiUrl';

// Cliente PostgreSQL inicializado silenciosamente

interface QueryOptions {
  select?: string | string[];
  where?: Record<string, any>;
  orderBy?: { field: string; ascending?: boolean };
  limit?: number;
  offset?: number;
}

// Builder para INSERT com encadeamento .select().single()
class InsertBuilder {
  private tableName: string;
  private data: any;
  private getHeaders: () => Record<string, string>;
  private selectFields: string | string[] = '*';
  private returnSingle: boolean = false;

  constructor(tableName: string, data: any, getHeaders: () => Record<string, string>) {
    this.tableName = tableName;
    this.data = data;
    this.getHeaders = getHeaders;
  }

  select(fields: string | string[] = '*'): this {
    this.selectFields = fields;
    return this;
  }

  single(): Promise<{ data: any | null; error: any | null }> {
    this.returnSingle = true;
    return this.execute();
  }

  async execute(): Promise<{ data: any | null; error: any | null }> {
    const API_URL = getApiUrl();
    try {
      const response = await fetchWithRetry(`${API_URL}/insert/${this.tableName}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(this.data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erro ao inserir' }));
        return { data: null, error };
      }

      const result = await response.json();
      const rows = result.rows || result.data || [];
      
      if (this.returnSingle) {
        return { data: Array.isArray(rows) ? rows[0] : rows, error: null };
      }
      return { data: rows, error: null };
    } catch (error: any) {
      console.error(`[DB] Erro ao inserir em ${this.tableName}:`, error);
      return { data: null, error: { message: error.message } };
    }
  }

  // Permite usar como Promise diretamente
  then<TResult1 = { data: any | null; error: any | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: any | null; error: any | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
  ): Promise<{ data: any | null; error: any | null } | TResult> {
    return this.execute().catch(onrejected);
  }
}

// Builder para DELETE com encadeamento .eq().execute()
class DeleteBuilder {
  private tableName: string;
  private getHeaders: () => Record<string, string>;
  private where: Record<string, any> = {};

  constructor(tableName: string, getHeaders: () => Record<string, string>, initialWhere?: Record<string, any>) {
    this.tableName = tableName;
    this.getHeaders = getHeaders;
    if (initialWhere && Object.keys(initialWhere).length > 0) {
      this.where = { ...initialWhere };
    }
  }

  eq(field: string, value: any): this {
    this.where[field] = value;
    return this;
  }

  neq(field: string, value: any): this {
    this.where[`${field}__neq`] = value;
    return this;
  }

  async execute(): Promise<{ data: any | null; error: any | null }> {
    const API_URL = getApiUrl();
    try {
      const response = await fetchWithRetry(`${API_URL}/delete/${this.tableName}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ where: this.where }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erro ao deletar' }));
        return { data: null, error };
      }

      const result = await response.json();
      return { data: result.data || result, error: null };
    } catch (error: any) {
      console.error(`[DB] Erro ao deletar de ${this.tableName}:`, error);
      return { data: null, error: { message: error.message } };
    }
  }

  // Permite usar como Promise diretamente
  then<TResult1 = { data: any | null; error: any | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: any | null; error: any | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
  ): Promise<{ data: any | null; error: any | null } | TResult> {
    return this.execute().catch(onrejected);
  }
}

// Builder para UPDATE com encadeamento .eq().select().single()
class UpdateBuilder {
  private tableName: string;
  private data: any;
  private getHeaders: () => Record<string, string>;
  private where: Record<string, any> = {};
  private selectFields: string | string[] = '*';
  private returnSingle: boolean = false;

  constructor(tableName: string, data: any, getHeaders: () => Record<string, string>) {
    this.tableName = tableName;
    this.data = data;
    this.getHeaders = getHeaders;
  }

  eq(field: string, value: any): this {
    this.where[field] = value;
    return this;
  }

  neq(field: string, value: any): this {
    this.where[`${field}__neq`] = value;
    return this;
  }

  is(field: string, value: any): this {
    this.where[`${field}__is`] = value;
    return this;
  }

  select(fields: string | string[] = '*'): this {
    this.selectFields = fields;
    return this;
  }

  single(): Promise<{ data: any | null; error: any | null }> {
    this.returnSingle = true;
    return this.execute();
  }

  async execute(): Promise<{ data: any | null; error: any | null }> {
    const API_URL = getApiUrl();
    try {
      const response = await fetchWithRetry(`${API_URL}/update/${this.tableName}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ data: this.data, where: this.where }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erro ao atualizar' }));
        return { data: null, error };
      }

      const result = await response.json();
      const rows = result.rows || result.data || [];
      
      if (this.returnSingle) {
        return { data: Array.isArray(rows) ? rows[0] : rows, error: null };
      }
      return { data: rows, error: null };
    } catch (error: any) {
      console.error(`[DB] Erro ao atualizar ${this.tableName}:`, error);
      return { data: null, error: { message: error.message } };
    }
  }

  // Permite usar como Promise diretamente
  then<TResult1 = { data: any | null; error: any | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: any | null; error: any | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
  ): Promise<{ data: any | null; error: any | null } | TResult> {
    return this.execute().catch(onrejected);
  }
}

// Builder para maybeSingle() - permite encadeamento com .execute()
class MaybeSingleBuilder {
  private queryBuilder: DatabaseClient;

  constructor(queryBuilder: DatabaseClient) {
    this.queryBuilder = queryBuilder;
  }

  async execute(): Promise<{ data: any | null; error: any | null }> {
    const result = await this.queryBuilder.execute();
    if (result.error) return result;
    return { data: result.data?.[0] || null, error: null };
  }

  // Permite usar como Promise diretamente (await sem .execute())
  then<TResult1 = { data: any | null; error: any | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: any | null; error: any | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
  ): Promise<{ data: any | null; error: any | null } | TResult> {
    return this.execute().catch(onrejected);
  }
}

class DatabaseClient {
  private tableName: string;
  private options: QueryOptions = {};

  constructor(tableName: string) {
    this.tableName = tableName;
    this.options = {};
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  select(fields: string | string[]) {
    this.options.select = fields;
    return this;
  }

  eq(field: string, value: any) {
    if (!this.options.where) this.options.where = {};
    this.options.where[field] = value;
    return this;
  }

  neq(field: string, value: any) {
    if (!this.options.where) this.options.where = {};
    this.options.where[`${field}__neq`] = value;
    return this;
  }

  gt(field: string, value: any) {
    if (!this.options.where) this.options.where = {};
    this.options.where[`${field}__gt`] = value;
    return this;
  }

  gte(field: string, value: any) {
    if (!this.options.where) this.options.where = {};
    this.options.where[`${field}__gte`] = value;
    return this;
  }

  lt(field: string, value: any) {
    if (!this.options.where) this.options.where = {};
    this.options.where[`${field}__lt`] = value;
    return this;
  }

  lte(field: string, value: any) {
    if (!this.options.where) this.options.where = {};
    this.options.where[`${field}__lte`] = value;
    return this;
  }

  like(field: string, value: string) {
    if (!this.options.where) this.options.where = {};
    this.options.where[`${field}__like`] = value;
    return this;
  }

  ilike(field: string, value: string) {
    if (!this.options.where) this.options.where = {};
    this.options.where[`${field}__ilike`] = value;
    return this;
  }

  in(field: string, values: any[]) {
    if (!this.options.where) this.options.where = {};
    this.options.where[`${field}__in`] = values;
    return this;
  }

  or(conditions: string) {
    if (!this.options.where) this.options.where = {};
    this.options.where['__or'] = conditions;
    return this;
  }

  not(field: string, operator: string, value: any) {
    if (!this.options.where) this.options.where = {};
    this.options.where[`${field}__not__${operator}`] = value;
    return this;
  }

  is(field: string, value: any) {
    if (!this.options.where) this.options.where = {};
    this.options.where[`${field}__is`] = value;
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.options.orderBy = { field, ascending: options?.ascending !== false };
    return this;
  }

  limit(count: number) {
    this.options.limit = count;
    return this;
  }

  range(from: number, to: number) {
    this.options.offset = from;
    this.options.limit = to - from + 1;
    return this;
  }

  async execute(): Promise<{ data: any[] | null; error: any | null; count?: number }> {
    const API_URL = getApiUrl();
    try {
      const response = await fetchWithRetry(`${API_URL}/query/${this.tableName}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(this.options),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erro de conexão' }));
        console.error(`[DB] Erro ao consultar ${this.tableName}:`, error);
        return { data: null, error };
      }

      const result = await response.json();
      return { 
        data: result.rows || result.data || [], 
        error: null,
        count: result.count 
      };
    } catch (error: any) {
      console.error(`[DB] Erro de rede ao consultar ${this.tableName}:`, error);
      return { data: null, error: { message: error.message || 'Erro de conexão' } };
    }
  }

  async single(): Promise<{ data: any | null; error: any | null }> {
    this.options.limit = 1;
    const result = await this.execute();
    if (result.error) return result;
    
    if (!result.data || result.data.length === 0) {
      return { data: null, error: { code: 'PGRST116', message: 'Registro não encontrado' } };
    }
    return { data: result.data[0], error: null };
  }

  maybeSingle(): MaybeSingleBuilder {
    this.options.limit = 1;
    return new MaybeSingleBuilder(this);
  }

  insert(data: any): InsertBuilder {
    return new InsertBuilder(this.tableName, data, this.getHeaders.bind(this));
  }

  // Método update retorna UpdateBuilder para suportar encadeamento
  update(data: any): UpdateBuilder {
    const builder = new UpdateBuilder(this.tableName, data, this.getHeaders.bind(this));
    // Se já tem where definido (chamou .eq() antes), passar para o builder
    if (this.options.where) {
      Object.entries(this.options.where).forEach(([key, value]) => {
        if (!key.includes('__')) {
          builder.eq(key, value);
        }
      });
    }
    return builder;
  }

  async upsert(data: any, options?: { onConflict?: string }): Promise<{ data: any | null; error: any | null }> {
    const API_URL = getApiUrl();
    try {
      const response = await fetchWithRetry(`${API_URL}/upsert/${this.tableName}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ data, onConflict: options?.onConflict }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erro ao upsert' }));
        return { data: null, error };
      }

      const result = await response.json();
      return { data: result.data || result, error: null };
    } catch (error: any) {
      console.error(`[DB] Erro ao upsert ${this.tableName}:`, error);
      return { data: null, error: { message: error.message } };
    }
  }

  delete(): DeleteBuilder {
    return new DeleteBuilder(this.tableName, this.getHeaders.bind(this), this.options.where);
  }
}

/**
 * Função principal para acessar tabelas
 * Uso: from('tabela').select('*').eq('campo', valor).execute()
 */
export const from = (tableName: string): DatabaseClient => {
  return new DatabaseClient(tableName);
};

// Funções de compatibilidade (sempre retornam 'postgres')
export const getDbMode = () => 'postgres';
export const isPostgresMode = () => true;

// Exportações para compatibilidade com código legado (vão dar erro se usados)
export const supabase = null;
export const auth = null;
