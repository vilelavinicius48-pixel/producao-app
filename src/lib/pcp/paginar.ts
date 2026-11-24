/** Busca todas as linhas de uma consulta Supabase, de 1000 em 1000 (limite padrão da API). */
export async function buscarTodos<T>(
  consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const tamanho = 1000;
  const todos: T[] = [];
  for (let de = 0; ; de += tamanho) {
    const { data, error } = await consulta(de, de + tamanho - 1);
    if (error) throw new Error(error.message);
    todos.push(...(data ?? []));
    if (!data || data.length < tamanho) break;
  }
  return todos;
}

export function emBlocos<T>(lista: T[], tamanho = 100): T[][] {
  const blocos: T[][] = [];
  for (let i = 0; i < lista.length; i += tamanho) blocos.push(lista.slice(i, i + tamanho));
  return blocos;
}
