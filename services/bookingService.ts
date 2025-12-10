import { BookingRecord } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

const DB_KEY = 'jn_bookings_history';
const SHOP_STATUS_ID = 'SHOP_STATUS_SETTINGS';

// Simula um delay de rede para feedback visual
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Dados iniciais para popular o banco caso esteja vazio (Para demonstração local)
const SEED_DATA: BookingRecord[] = [
  {
    id: 'demo-1',
    userName: 'Marcos Cliente Exemplo',
    userPhone: '(27) 99999-0000',
    serviceName: 'Corte + Barba',
    barberName: 'Jeilson Aprijo',
    date: new Date().toLocaleDateString('pt-BR'),
    time: '10:00',
    price: 60.00,
    createdAt: new Date(Date.now() - 86400000).toISOString(), 
    status: 'completed'
  }
];

export const bookingService = {
  // LISTAR (SELECT *)
  async getAll(): Promise<BookingRecord[]> {
    // MODO NUVEM (SUPABASE)
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        // Filtra para não trazer o registro de configuração da loja na lista normal
        .neq('id', SHOP_STATUS_ID)
        .order('createdAt', { ascending: false });
      
      if (error) {
        throw new Error(`Erro Supabase: ${error.message}`);
      }
      return data as BookingRecord[] || [];
    }

    // MODO LOCAL
    console.warn("⚠️ Usando Banco Local (Sem sincronização).");
    return this.getLocalOnly();
  },

  // Busca agendamentos específicos de um dia e barbeiro para verificar disponibilidade
  async getAvailability(date: string, barberName: string): Promise<string[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('bookings')
        .select('time')
        .eq('date', date)
        .eq('barberName', barberName)
        .neq('status', 'cancelled') // Não bloquear horários cancelados
        .neq('id', SHOP_STATUS_ID);

      if (error) return [];
      return data.map((d: any) => d.time);
    }
    
    // Fallback Local
    const records = await this.getLocalOnly();
    return records
      .filter(r => r.date === date && r.barberName === barberName && r.status !== 'cancelled')
      .map(r => r.time);
  },

  // Busca APENAS local
  async getLocalOnly(): Promise<BookingRecord[]> {
    await delay(600);
    const data = localStorage.getItem(DB_KEY);
    
    if (!data) {
      if (!isSupabaseConfigured()) {
        localStorage.setItem(DB_KEY, JSON.stringify(SEED_DATA));
        return SEED_DATA;
      }
      return [];
    }

    try {
      const list = JSON.parse(data);
      // Filtra o settings ID caso tenha vazado pro local storage
      return list
        .filter((r: BookingRecord) => r.id !== SHOP_STATUS_ID)
        .sort((a: BookingRecord, b: BookingRecord) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    } catch (error) {
      return [];
    }
  },

  // CRIAR (INSERT)
  async create(booking: BookingRecord): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase
        .from('bookings')
        .insert([booking]);
      
      if (error) {
        console.error('Erro ao salvar no Supabase:', error);
        throw error;
      }
      return;
    }

    await delay(800);
    const data = localStorage.getItem(DB_KEY);
    const currentList = data ? JSON.parse(data) : [];
    const newList = [...currentList, booking];
    localStorage.setItem(DB_KEY, JSON.stringify(newList));
  },

  // ATUALIZAR STATUS (UPDATE)
  async updateStatus(id: string, status: 'completed' | 'cancelled'): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase
        .from('bookings')
        .update({ status })
        .eq('id', id);
        
      if (error) console.error('Erro ao atualizar Supabase:', error);
    }

    const data = localStorage.getItem(DB_KEY);
    if (data) {
        const list: BookingRecord[] = JSON.parse(data);
        const updatedList = list.map(item => 
          item.id === id ? { ...item, status } : item
        );
        localStorage.setItem(DB_KEY, JSON.stringify(updatedList));
    }
  },

  // DELETAR (DELETE)
  async delete(id: string): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);

      if (error) console.error('Erro ao deletar Supabase:', error);
    }

    const data = localStorage.getItem(DB_KEY);
    if (data) {
        const list: BookingRecord[] = JSON.parse(data);
        const updatedList = list.filter(item => item.id !== id);
        localStorage.setItem(DB_KEY, JSON.stringify(updatedList));
    }
  },

  // --- MÉTODOS DE TRAVA DA LOJA ---
  // Usaremos um registro "fake" na tabela bookings para guardar o status da loja
  
  async getShopStatus(): Promise<'open' | 'closed'> {
    if (isSupabaseConfigured() && supabase) {
      const { data } = await supabase
        .from('bookings')
        .select('status')
        .eq('id', SHOP_STATUS_ID)
        .single();
      
      // Se status for 'cancelled', consideramos 'closed' para reaproveitar os enums, ou usamos o texto direto.
      // Vamos usar: status='pending' (ABERTO), status='cancelled' (FECHADO) para facilitar.
      if (data) {
        return data.status === 'cancelled' ? 'closed' : 'open';
      }
      return 'open'; // Padrão aberto
    }
    return 'open';
  },

  async setShopStatus(isOpen: boolean): Promise<void> {
    const status = isOpen ? 'pending' : 'cancelled'; // pending = open, cancelled = closed
    
    if (isSupabaseConfigured() && supabase) {
      // Upsert: atualiza se existir, cria se não existir
      const { error } = await supabase
        .from('bookings')
        .upsert({
          id: SHOP_STATUS_ID,
          userName: 'SYSTEM_SETTINGS',
          userPhone: '00000000000',
          serviceName: 'Shop Status Control',
          barberName: 'System',
          date: '01/01/2099',
          time: '00:00',
          price: 0,
          status: status
        });

      if (error) console.error("Erro ao atualizar status da loja", error);
    }
  }
};