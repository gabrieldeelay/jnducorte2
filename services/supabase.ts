import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO DO BANCO DE DADOS (SUPABASE) ---
// Para que o agendamento funcione entre celular e computador, você precisa de um banco na nuvem.
// 1. Crie uma conta grátis em https://supabase.com
// 2. Crie um novo projeto
// 3. Vá em Project Settings > API
// 4. Copie a "Project URL" e a "anon public key" e cole abaixo.

// Chaves fornecidas pelo usuário
const SUPABASE_URL: string = 'https://yuzjhkvcvxydfqtsiwbl.supabase.co'; 
const SUPABASE_ANON_KEY: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1empoa3Zjdnh5ZGZxdHNpd2JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3ODkyNTYsImV4cCI6MjA4MDM2NTI1Nn0.27396ov3JLPSO83B9jbxrc_OHNl06BKOifpmoCqN5dA';

export const isSupabaseConfigured = () => {
  return SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '';
};

export const supabase = isSupabaseConfigured() 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// --- INSTRUÇÕES SQL ---
// Vá no "SQL Editor" do seu projeto Supabase e rode o código abaixo para criar a tabela e liberar o acesso:

/*
  -- 1. Cria a tabela de agendamentos
  create table bookings (
    id text primary key,
    "userName" text not null,
    "userPhone" text not null,
    "serviceName" text not null,
    "barberName" text not null,
    date text not null,
    time text not null,
    price numeric not null,
    "createdAt" timestamp with time zone default timezone('utc'::text, now()) not null,
    status text default 'pending',
    "completedAt" timestamp with time zone
  );

  -- SE VOCÊ JÁ CRIOU A TABELA ANTES, APENAS RODE ESTE COMANDO PARA ATUALIZAR:
  alter table bookings add column "completedAt" timestamp with time zone;

  -- 2. Habilita segurança (Row Level Security)
  alter table bookings enable row level security;

  -- 3. CRÍTICO: Cria uma política para permitir que o App (anon key) leia e escreva dados
  -- Sem isso, você terá erro de permissão!
  create policy "Acesso Publico Total" 
  on bookings 
  for all 
  using (true) 
  with check (true);

  -- 4. HABILITAR NOTIFICAÇÕES EM TEMPO REAL (REALTIME) -- ESTE PASSO É O MAIS IMPORTANTE PARA O DASHBOARD FUNCIONAR
  -- Rode este comando para que o painel receba notificações instantâneas
  alter publication supabase_realtime add table bookings;
*/