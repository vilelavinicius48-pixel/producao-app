# Produção — acompanhamento de produção em tempo real

Sistema web (mini-MES) para acompanhamento de produção em tempo real. Ver `CLAUDE.md` para a
especificação completa do projeto, regras de negócio e fases de desenvolvimento.

## Stack

- Next.js (App Router) + TypeScript
- Supabase (Postgres, Auth, Realtime)
- Tailwind CSS

## Setup local

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie um projeto em [supabase.com](https://supabase.com), copie `.env.local.example` para
   `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e
   `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API).

3. Rode a migração inicial do banco em `supabase/migrations/0001_init.sql` no SQL Editor do
   painel do Supabase (ou via `supabase db push`, se estiver usando a CLI).

4. Crie o primeiro usuário gestor manualmente (veja instruções abaixo), já que a criação de
   contas exige que já exista pelo menos um gestor logado.

5. Rode o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

   Acesse [http://localhost:3000](http://localhost:3000).

## Criando o primeiro gestor

A tela **Usuários** (`/cadastros/operadores`) só é acessível a quem já é gestor — então o
primeiro precisa ser criado manualmente:

1. No painel do Supabase, em **Authentication → Users**, clique em "Add user" e crie um usuário
   com e-mail `SUAMATRICULA@producao.local` (em minúsculas) e uma senha.
2. No **SQL Editor**, rode:

   ```sql
   insert into public.operadores (id, matricula, nome, perfil)
   values ('<uuid do usuário criado>', 'SUAMATRICULA', 'Seu Nome', 'gestor');
   ```

3. Faça login em `/login` com a matrícula e a senha definidas. A partir daí, use a tela
   **Usuários** para cadastrar os demais gestores, operadores e qualidade.

## Login

O login é feito com **matrícula + senha** (não e-mail). Internamente, cada matrícula vira um
e-mail sintético `matricula@producao.local` no Supabase Auth — isso é transparente para o
usuário.
